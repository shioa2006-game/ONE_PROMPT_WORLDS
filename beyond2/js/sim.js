// GUILDWARD — ルール本体（描画に依存しない。node でも動く）
// 第19作「せーの、星見の露台へ」のルールをもとに、編成式（リコ＋仲間2人）に作りなおした。
// 座標: x は画面の右下へ、y は左下へ。高さ z は1段ずつの整数。
(function (root) {
  'use strict';

  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  // 冒険者。verbs はその人ができる働きかけ（行動の判定は名前ではなく、これで行う）
  const HERO = {
    // 「引く」は引き鉤（up.hook）を持っているときだけ（v0.3。can・heroWith で見る）
    riko: { name: 'リコ', role: '斥候', hp: 6, mov: 4, verbs: ['shoot', 'rope', 'pull'], verbName: '射る・鉤縄', color: '#8fd45e' },
    gard: { name: 'ガルド', role: '重戦士', hp: 9, mov: 3, verbs: ['push'], verbName: '押す', color: '#ef8a45', heavy: true },   // 重い（ナギはあおげない）
    sena: { name: 'セナ', role: '氷の術師', hp: 6, mov: 3, verbs: ['freeze'], verbName: '凍らせる', color: '#72cdff' },
    tobi: { name: 'トビ', role: '発破師', hp: 7, mov: 3, verbs: ['blast'], verbName: '発破', color: '#c792ff' },
    // 第二章（v0.3）：風守りナギ。となりの軽い物・敵・仲間を、2升先へ運ぶ（04 2章・05 2.1）
    nagi: { name: 'ナギ', role: '風守り', hp: 6, mov: 4, verbs: ['waft'], verbName: 'あおぐ', color: '#f2c14e' },
  };
  const COMPANIONS = ['gard', 'sena', 'tobi', 'nagi'];
  const ENEMY = {
    goblin: { name: '小鬼', hp: 3, mov: 3, atk: 2, range: 1 },
    raider: { name: '盗っ人小鬼', hp: 3, mov: 4, atk: 1, range: 1, raid: true },
    archer: { name: '骨の射手', hp: 2, mov: 2, atk: 1, range: 4, ranged: true },
    slime: { name: '粘体', hp: 4, mov: 2, atk: 1, range: 1 },
    bat: { name: '洞コウモリ', hp: 2, mov: 4, atk: 1, range: 1, fly: true },
    golem: { name: '岩人形', hp: 7, mov: 2, atk: 2, range: 1, heavy: true },
    wisp: { name: '水霊', hp: 3, mov: 3, atk: 2, range: 3, ranged: true, swim: true },
    turtle: { name: '岩喰い大亀', hp: 22, mov: 2, atk: 3, range: 1, heavy: true, armor: true, slam: true, big: true },
    // 第二章（v0.3）。snow: 深い雪でも遅くならない
    snowgob: { name: '雪小鬼', hp: 3, mov: 3, atk: 2, range: 1, snow: true },
    // climb: のぼり下りできる段（2段）／pack: ねらった相手のとなりに、ほかの雪狼がいれば傷+1（05 4.3）
    wolf: { name: '雪狼', hp: 3, mov: 5, atk: 2, range: 1, snow: true, climb: 2, pack: 1 },
  };
  // お守りの効果（一人に一つ。新しい働きかけは持たせない）。名前と手に入れ方は data.js の CHARMS
  const CHARM_FX = { c_plate: { hp: 2 }, c_tag: { endure: 1 }, c_tabi: { mov: 1 }, c_hawk: { range: 1 } };
  // 行き場がなくなった敵が逃げるまでの手番（盗っ人だけ長い。05 1.4）
  const STUCK = { normal: 2, raid: 4 };
  const NPC = {
    miner: { name: '鉱夫' }, tobi: { name: 'トビ' }, kid: { name: '子ども' },
  };
  const RANGE = { shoot: 5, rope: 5, rope2: 8, freeze: 4, blast: 4 };
  const OBJ_H = { crate: 1, block: 1, iceblock: 1, beam: 1, boulder: 1, rubble: 1, pillar: 3, door: 3, statue: 2, crack: 2, crystal: 2, deco: 2, wagon: 2, lantern: 2, lever: 2, chime: 2 };
  const TOPS = ['crate', 'block', 'iceblock', 'beam', 'rubble'];          // 上に立てる物
  const BLOCKS = ['pillar', 'boulder', 'door', 'statue', 'crack', 'crystal', 'deco', 'wagon', 'lantern', 'lever', 'chime']; // ふさぐ物
  const PUSHABLE = ['crate', 'block', 'iceblock', 'boulder'];
  // 引き鉤で引ける物（軽い物。05 2.2）。つららは升の真上にぶら下がる（その升には立てる）
  const PULLABLE = ['crate', 'iceblock'];
  const ICICLE_Z = 3;   // つららがぶら下がっている高さ（升の地面から）
  const PULL_MAX = 4, PULL_MOVE = 2;
  // あおぐ（ナギ）：運べる物。距離は2（大うちわで3）
  const WAFTABLE = ['crate', 'iceblock'];
  function waftDist(st) { return st.up && st.up.fan ? 3 : 2; }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function idx(st, x, y) { return y * st.W + x; }
  function inside(st, x, y) { return x >= 0 && y >= 0 && x < st.W && y < st.H; }
  function d2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
  function inRange(ax, ay, bx, by, R) { return d2(ax, ay, bx, by) <= R * R + R; }
  function isHero(u) { return u.team === 'h'; }
  function isNpc(u) { return u.team === 'n'; }
  function isFoe(u) { return u.team === 'e'; }
  function info(u) { return isHero(u) ? HERO[u.k] : isFoe(u) ? ENEMY[u.k] : NPC[u.k] || { name: u.name || '人' }; }
  function fly(u) { return isFoe(u) && !!ENEMY[u.k].fly && !(u.frozen > 0); }
  function weak(u) { return isNpc(u) || !!u.guest; }  // 縄は渡れない（救助する人・けが人）
  // その人がいまできる働きかけ（引く＝引き鉤を持っているとき）
  function verbsOf(st, k) { const v = HERO[k] ? HERO[k].verbs : []; return v.filter(x => x !== 'pull' || (st && st.up && st.up.hook)); }
  function verbLabel(k, up) { if (k === 'riko' && up && up.hook) return '射る・鉤縄・引く'; return HERO[k] ? HERO[k].verbName : ''; }
  function can(st, heroId, verb) { const u = unitById(st, heroId); return !!u && isHero(u) && verbsOf(st, u.k).indexOf(verb) >= 0; }
  function heroWith(st, verb) { const u = st.units.find(h => isHero(h) && !h.ko && verbsOf(st, h.k).indexOf(verb) >= 0); return u ? u.id : null; }

  function newStats() {
    // foeKo: 倒した敵の種類と倒れ方／downs: 倒れた仲間の数／bestRoll: 大岩ひとつで倒した最多／boulderFlip: 大岩でひっくり返した回数
    // fightLen: 戦いごとの手番数／bossTurn: 強敵を倒した手番（腕だめしの印の判定に使う）
    return { acts: {}, kills: {}, combos: 0, turns: 0, fights: 0, undo: 0, hints: 0, retries: 0, steps: 0,
      foeKo: [], downs: 0, bestRoll: 0, boulderFlip: 0, fightLen: {}, bossTurn: 0 };
  }
  function movOf(u) { return u.mov !== undefined ? u.mov : (HERO[u.k] ? HERO[u.k].mov : 0); }

  // ---------- 依頼の地図をつくる ----------
  // carry: { party:['riko','gard','sena'], up:{bow,rope2,gauntlet,staff,bigbomb}, hpb: ランクによる体力の上のせ }
  function create(def, carry) {
    carry = carry || {};
    const W = def.W, H = def.H;
    const party = (carry.party || def.party || ['riko', 'gard', 'sena']).slice();
    const st = {
      sec: def.id, W, H, h: [], t: [], by: {}, objs: [], units: [], links: [],
      mode: 'explore', turn: 0, flags: {}, said: {}, party,
      up: Object.assign({}, carry.up || {}), hpb: carry.hpb || 0, items: (carry.items || []).slice(),
      stats: carry.stats ? clone(carry.stats) : newStats(),
      moments: carry.moments ? clone(carry.moments) : [],
      seq: 1, obj: clone(def.objective || { k: 'none' }), coins: 0, found: [],
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const hc = def.hmap[y][x];
        const tc = def.tmap ? (def.tmap[y][x] || '.') : '.';
        if (hc === '.' || hc === ' ' || hc === undefined) { st.h.push(0); st.t.push('v'); }
        else { st.h.push(parseInt(hc, 36)); st.t.push(tc === '.' ? 'f' : tc); }
      }
    }
    for (const o of def.objs || []) {
      const ob = clone(o);
      ob.id = ob.id || ('o' + (st.seq++));
      if (ob.z === undefined && ob.x !== undefined && inside(st, ob.x, ob.y)) {
        const i = idx(st, ob.x, ob.y);
        ob.z = st.t[i] === 'v' ? 0 : st.h[i];
        if (OBJ_H[ob.k] && ob.k !== 'door') {
          for (const p of st.objs) if (p.x === ob.x && p.y === ob.y && TOPS.includes(p.k)) ob.z = Math.max(ob.z, p.z + (p.rh || 1));
        }
      }
      if (ob.k === 'fall' && ob.bz === undefined) ob.bz = st.h[idx(st, ob.bx, ob.by)];
      if (ob.k === 'bridge' && ob.z === undefined) ob.z = 0;
      st.objs.push(ob);
    }
    // 受けなおし：前に持ち帰った宝箱は空（05 1.7）
    for (const cid of carry.taken || []) { const o = st.objs.find(q => q.id === cid); if (o && o.k === 'chest') o.taken = true; }
    const charms = carry.charms || {};
    (def.start || []).forEach((p, k) => {
      const id = party[k];
      if (!id) return;
      const cid = charms[id] && CHARM_FX[charms[id]] ? charms[id] : null;
      const fx = cid ? CHARM_FX[cid] : {};
      const hp = HERO[id].hp + st.hpb + (fx.hp || 0);
      const mov = HERO[id].mov + (fx.mov || 0);
      const u = { id, k: id, team: 'h', x: p[0], y: p[1], z: 0, hp, mhp: hp, mov, mv: mov, acted: false, frozen: 0, ko: false, face: p[2] === undefined ? 3 : p[2] };
      if (cid) u.charm = cid;
      if (fx.endure) u.tag = 1;          // 身がわりの木札：依頼ごとに一度だけ、倒れる傷を体力1でこらえる
      if (fx.range) u.rangeUp = fx.range; // 鷹の目の羽かざり：射る・凍らせる・発破の届く距離+1
      st.units.push(u);
    });
    // 同行のゲスト：選んだ二人に加えて、その仲間が最初から4人目として出る（ふつうに歩ける。v0.3）
    if (def.guest && !party.includes(def.guest) && def.start && def.start[party.length]) {
      const p = def.start[party.length], id = def.guest;
      const cid = charms[id] && CHARM_FX[charms[id]] ? charms[id] : null;
      const fx = cid ? CHARM_FX[cid] : {};
      const hp = HERO[id].hp + st.hpb + (fx.hp || 0), mov = HERO[id].mov + (fx.mov || 0);
      const u = { id, k: id, team: 'h', x: p[0], y: p[1], z: 0, hp, mhp: hp, mov, mv: mov, acted: false, frozen: 0, ko: false, face: p[2] === undefined ? 3 : p[2], guestHero: true };
      if (cid) u.charm = cid;
      if (fx.endure) u.tag = 1;
      if (fx.range) u.rangeUp = fx.range;
      st.units.push(u);
    }
    for (const n of def.npcs || []) {
      st.units.push({ id: n.id, k: n.k, team: 'n', x: n.x, y: n.y, z: 0, hp: 9, mhp: 9, mv: 0, acted: true, frozen: 0, ko: false, face: n.face === undefined ? 1 : n.face, name: n.name || (NPC[n.k] || {}).name, guest: n.guest || null, found: !!n.found, safe: false, rescue: n.rescue !== false, foundSay: n.foundSay || null, safeSay: n.safeSay || null, onFound: n.onFound || null, sit: !!n.sit });
    }
    let n = 1;
    for (const e of def.enemies || []) st.units.push(makeEnemy(st, e, 'e' + (n++)));
    st.eseq = n;
    st.base = def.base;
    for (const u of st.units) placeZ(st, u, def);
    st.trig = clone(def.trig || []);
    st.fightSay = clone(def.fightSay || {});
    st.winSay = clone(def.winSay || {});
    st.capAt = clone(def.capAt || {});          // 大岩が止まった升ごとの字幕（m5 の栓など）
    st.flipSay = clone(def.flipSay || null);    // はじめてひっくり返したときのひとこと
    st.rollSay = clone(def.rollSay || null);    // 大岩でまとめて倒したときのひとこと
    st.waftSay = clone(def.waftSay || null);    // はじめて雪狼をあおいで谷へ落としたときのひとこと（v0.3）
    st.runeSay = clone(def.runeSay || null);    // 装置が一つ動くたびのひとこと（{n} は数）
    st.drains = clone(def.drains || []);
    st.waves = clone(def.waves || []);
    st.raid = def.raid ? { cells: clone(def.raid.cells), sacks: def.raid.sacks, max: def.raid.sacks } : null;
    for (const L of def.links || []) st.links.push(clone(L));
    return st;
  }
  function makeEnemy(st, e, id) {
    const E = ENEMY[e.k];
    const hp = e.hp || E.hp;
    return { id, k: e.k, team: 'e', x: e.x, y: e.y, z: e.z === undefined ? 0 : e.z, zz: e.z, hp, mhp: hp, mv: E.mov, acted: false, frozen: 0, flipped: 0, ko: false, face: e.face === undefined ? 1 : e.face, grp: e.grp || 1, active: !!e.active, wake: e.wake === undefined ? 5 : e.wake, boss: !!e.boss };
  }
  function placeZ(st, u, def) {
    const sf = surface(st, u.x, u.y);
    if (sf.void || (sf.water && isFoe(u) && ENEMY[u.k] && ENEMY[u.k].fly)) u.z = u.zz !== undefined ? u.zz : 6;
    else u.z = standZ(st, u.x, u.y, u);
    delete u.zz;
  }

  function unitById(st, id) { return st.units.find(u => u.id === id); }
  function objById(st, id) { return st.objs.find(o => o.id === id); }
  function heroes(st) { return st.units.filter(u => u.team === 'h'); }
  function npcs(st) { return st.units.filter(u => u.team === 'n'); }
  function enemies(st) { return st.units.filter(u => u.team === 'e'); }
  function liveEnemies(st) { return st.units.filter(u => u.team === 'e' && !u.ko); }
  function unitAt(st, x, y, except) {
    for (const u of st.units) if (!u.ko && u !== except && u.x === x && u.y === y) return u;
    return null;
  }
  function pendingWaves(st) { return (st.waves || []).filter(w => !w.done).length; }

  // ---------- 地形の高さ ----------
  function surface(st, x, y, ex) {
    if (!inside(st, x, y)) return { z: -99, void: true, stand: false, out: true };
    const i = idx(st, x, y), t = st.t[i];
    const r = { z: t === 'v' ? -99 : st.h[i], stand: !(t === 'v' || t === 'w' || t === 'r' || t === 'x'), water: t === 'w' || t === 'r', fast: t === 'r', ice: t === 'i', wall: t === 'x', void: t === 'v', block: null, blockTop: -99, top: null, plate: null };
    for (const o of st.objs) {
      if (o.gone || o === ex) continue;
      if (o.k === 'bridge') {
        if (o.down && o.cells.some(c => c[0] === x && c[1] === y) && o.z >= r.z) { r.z = o.z; r.stand = true; r.void = false; r.water = false; r.ice = false; r.wall = false; r.bridge = o; }
        continue;
      }
      if (o.x !== x || o.y !== y) continue;
      if (TOPS.includes(o.k)) {
        const top = o.z + (o.rh || 1);
        if (top >= r.z) { r.z = top; r.stand = true; r.void = false; r.water = false; r.fast = false; r.wall = false; r.ice = o.k === 'iceblock'; r.top = o; }
      } else if (BLOCKS.includes(o.k)) {
        if (o.k === 'door' && o.open) continue;
        r.block = o; r.blockTop = o.z + (o.h || OBJ_H[o.k] || 1);
      } else if (o.k === 'plate') r.plate = o;
    }
    if (r.block) r.stand = false;
    return r;
  }
  function standZ(st, x, y, u) {
    const s = surface(st, x, y);
    if (s.void) return u && u.z !== undefined ? u.z : 0;
    return s.z;
  }

  // ---------- 歩けるか ----------
  function canStep(st, u, fx, fy, tx, ty) {
    if (!inside(st, tx, ty)) return false;
    const b = surface(st, tx, ty);
    const az = u ? u.z : surface(st, fx, fy).z;
    if (u && isFoe(u) && ENEMY[u.k] && ENEMY[u.k].swim && !(u.frozen > 0)) return (b.water && !b.fast) || false;
    if (u && fly(u)) {
      if (b.wall) return false;
      if (b.block) return b.blockTop <= az + 1;
      if (b.void || b.water) return true;
      return b.z - az <= 3;
    }
    if (!b.stand) return false;
    const a = surface(st, fx, fy);
    const fromZ = a.void ? az : a.z;
    const dz = b.z - fromZ;
    // 重い敵（岩人形・大亀）は、1段ずつしか上り下りできない
    if (u && isFoe(u) && ENEMY[u.k] && ENEMY[u.k].heavy) return dz <= 1 && dz >= -1;
    // 雪狼は、段を2段のぼれる（下りも2段。05 4.3）
    if (u && isFoe(u) && ENEMY[u.k] && ENEMY[u.k].climb) return dz <= ENEMY[u.k].climb && dz >= -ENEMY[u.k].climb;
    return dz <= 1 && dz >= -2;
  }
  function linkFrom(st, x, y, u) {
    const out = [];
    for (const L of st.links) {
      if (L.hidden) continue;
      if (u && weak(u) && L.k === 'rope') continue;
      if (L.a[0] === x && L.a[1] === y) out.push([L.b[0], L.b[1], L]);
      else if (L.b[0] === x && L.b[1] === y) out.push([L.a[0], L.a[1], L]);
    }
    return out;
  }

  // ダイクストラ。opt: {max, ignoreUnits, linkCost, noLinks}
  function reach(st, u, opt) {
    opt = opt || {};
    const max = opt.max === undefined ? 999 : opt.max;
    const linkCost = opt.linkCost || 1;
    const W = st.W;
    const start = idx(st, u.x, u.y);
    const dist = new Map();
    dist.set(start, { c: 0, p: -1, z: u.z });
    const open = [start];
    const flying = fly(u);
    while (open.length) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (dist.get(open[k]).c < dist.get(open[bi]).c) bi = k;
      const cur = open.splice(bi, 1)[0];
      const cd = dist.get(cur);
      const cx = cur % W, cy = (cur / W) | 0;
      const nbs = [];
      for (const [dx, dy] of DIRS) nbs.push([cx + dx, cy + dy, 1]);
      if (!flying && !opt.noLinks) for (const [lx, ly] of linkFrom(st, cx, cy, u)) nbs.push([lx, ly, linkCost, true]);
      for (const [nx, ny, cost, isLink] of nbs) {
        if (!inside(st, nx, ny)) continue;
        const ni = idx(st, nx, ny);
        const nc = cd.c + (isLink ? cost : cost * snowCost(st, u, nx, ny));
        if (nc > max) continue;
        if (dist.has(ni) && dist.get(ni).c <= nc) continue;
        const tmp = { x: cx, y: cy, z: cd.z, k: u.k, team: u.team, frozen: u.frozen, guest: u.guest };
        if (isLink) {
          if (!surface(st, nx, ny).stand) continue;
        } else if (!canStep(st, tmp, cx, cy, nx, ny)) continue;
        if (!opt.ignoreUnits) {
          const o = unitAt(st, nx, ny, u);
          if (o && o.team !== u.team && !(isHero(u) && isNpc(o)) && !(isNpc(u) && isHero(o))) continue;
          // 凍った敵は、ほかの敵の通り道もふさぐ（「凍らせて通せんぼ」。v0.1 の資料とヒントのとおりに直した。飛ぶ敵は上を越える）
          if (o && isFoe(u) && isFoe(o) && (o.frozen > 0 || o.iceHold) && !flying) continue;
        }
        const s = surface(st, nx, ny);
        dist.set(ni, { c: nc, p: cur, z: s.void ? cd.z : s.z });
        open.push(ni);
      }
    }
    return dist;
  }
  // 深い雪：戦いの中で、その升へ入る歩数が2（雪に慣れた敵・飛ぶ敵は1。物の上に立つなら雪ではない）。探索中は影響なし（05 3.1）
  function snowCost(st, u, x, y) {
    if (st.mode !== 'combat') return 1;
    if (st.t[idx(st, x, y)] !== 'n') return 1;
    if (isFoe(u) && ENEMY[u.k] && (ENEMY[u.k].snow || fly(u))) return 1;
    if (u.escort) return 1;
    for (const o of st.objs) if (!o.gone && o.x === x && o.y === y && TOPS.includes(o.k)) return 1;
    return 2;
  }
  function pathTo(st, dist, i) {
    const out = [];
    let k = i;
    while (k !== -1 && dist.has(k)) { out.push(k); k = dist.get(k).p; }
    return out.reverse();
  }
  function cellsXYZ(st, list) {
    return list.map(i => { const x = i % st.W, y = (i / st.W) | 0; const s = surface(st, x, y); return [x, y, s.void ? 0 : s.z]; });
  }
  function partyReach(st) {
    const set = new Set();
    for (const u of heroes(st)) {
      if (u.ko || u.fixed) continue;
      for (const k of reach(st, u, { ignoreUnits: true }).keys()) set.add(k);
    }
    return set;
  }

  // ---------- 押せるもの ----------
  // opt.force: 爆風（重い物も動く）
  function pushInfo(st, ref, opt) {
    opt = opt || {};
    let ent, kind;
    if (ref.u) { ent = unitById(st, ref.u); kind = 'u'; } else { ent = objById(st, ref.o); kind = 'o'; }
    if (!ent || ent.gone || ent.ko) return { ok: false, why: 'ない' };
    if (kind === 'u') {
      if (!isFoe(ent)) return { ok: false, why: '仲間は押さない' };
      const E = ENEMY[ent.k];
      if (E.heavy && !(ent.frozen > 0) && !opt.force && !st.up.gauntlet) {
        // 重い相手でも、段のふち（押す先が低い・谷・水）なら一押しで落とせる
        let edge = false;
        if (opt.dir !== undefined) { const [dx, dy] = DIRS[opt.dir]; const n = surface(st, ent.x + dx, ent.y + dy); edge = !n.out && !n.block && !n.wall && (n.void || n.water || ent.z - n.z >= 1) && !unitAt(st, ent.x + dx, ent.y + dy); }
        if (!edge) return { ok: false, why: '重すぎて平らな所では動かない（段のふちなら押し落とせる。凍らせればすべる・鋼の籠手なら押せる）', heavy: true };
      }
      if (E.swim && !(ent.frozen > 0)) return { ok: false, why: '水霊には手ごたえがない（水ごと凍らせれば閉じこめられる）' };
      return { ok: true, ent, kind };
    }
    if (ent.k === 'pillar') {
      if (opt.force) return { ok: false, why: '石柱はびくともしない' };
      if (!st.up.gauntlet) return { ok: false, why: '重すぎて動かない（鋼の籠手があれば倒せる）', heavy: true };
      return { ok: true, ent, kind, topple: true };
    }
    if (!PUSHABLE.includes(ent.k)) return { ok: false, why: '押せない' };
    for (const o of st.objs) if (!o.gone && o !== ent && o.x === ent.x && o.y === ent.y && o.z > ent.z && (o.k === 'pillar' || o.k === 'boulder' || o.k === 'crack')) return { ok: false, why: '上に重い物がのっている' };
    const u = unitAt(st, ent.x, ent.y);
    if (u) return { ok: false, why: '上にだれかが立っている' };
    return { ok: true, ent, kind };
  }

  // ---------- あおげるもの（05 2.1） ----------
  // kind: 'o' 物／'e' 敵／'h' 仲間。slide: 凍った重い敵（浮かずにすべりだす）／flyer: 飛ぶ敵（2D 升まで流される）
  function waftInfo(st, ref, heroId) {
    const isU = !!ref.u;
    const ent = isU ? unitById(st, ref.u) : objById(st, ref.o);
    if (!ent || ent.gone || ent.ko) return { ok: false, why: 'ない' };
    if (isU) {
      if (ent.id === heroId) return { ok: false, why: '自分は運べない' };
      if (isHero(ent)) {
        if (HERO[ent.k] && HERO[ent.k].heavy) return { ok: false, why: '重すぎる（' + HERO[ent.k].name + 'はあおげない）', heavy: true };
        if (ent.fixed || ent.guest) return { ok: false, why: '歩けない人は運べない' };
        return { ok: true, ent, kind: 'h' };
      }
      if (isNpc(ent)) return { ok: false, why: '救助される人は運べない' };
      if (!ent.active) return { ok: false, why: '眠っている敵はあおげない' };
      const E = ENEMY[ent.k];
      if (E.swim) return { ok: false, why: '水霊には風が通らない' };
      if (E.heavy) return ent.frozen > 0 ? { ok: true, ent, kind: 'e', slide: true } : { ok: false, why: '重すぎる（凍らせれば、すべりだす）', heavy: true };
      if (fly(ent)) return { ok: true, ent, kind: 'e', flyer: true };
      return { ok: true, ent, kind: 'e' };
    }
    if (ent.k === 'chime') return ent.rung ? { ok: false, why: 'もう鳴った' } : { ok: true, ent, chime: true };
    if (['boulder', 'block', 'pillar', 'icepillar'].includes(ent.k)) return { ok: false, why: '重すぎる', heavy: true };
    if (!WAFTABLE.includes(ent.k)) return { ok: false, why: 'あおげない' };
    for (const o of st.objs) if (!o.gone && o !== ent && o.x === ent.x && o.y === ent.y && o.z > ent.z && !['plate', 'icicle', 'torch'].includes(o.k)) return { ok: false, why: '上に物がのっている' };
    if (unitAt(st, ent.x, ent.y)) return { ok: false, why: '上にだれかが立っている' };
    return { ok: true, ent, kind: 'o' };
  }
  // 下りる升：d＝D から 1 へ順に調べる。途中の升は「もとの高さ＋2」以下（谷・水・外は越える）。stand はナギの立つ升（下りる先にしない）
  function waftDest(st, ent, kind, dir, D, stand, actorId) {
    const [dx, dy] = DIRS[dir];
    const z0 = ent.z;
    const isO = kind === 'o';
    let high = false, blocked = false;
    for (let d = D; d >= 1; d--) {
      let clear = true;
      for (let k = 1; k < d; k++) {
        const s = surface(st, ent.x + dx * k, ent.y + dy * k, isO ? ent : null);
        if (s.out || s.void || s.water) continue;
        const top = s.block ? Math.max(s.z, s.blockTop) : s.z;
        if (top > z0 + 2 || s.wall) { clear = false; break; }
      }
      if (!clear) { high = true; continue; }
      const x = ent.x + dx * d, y = ent.y + dy * d;
      const s = surface(st, x, y, isO ? ent : null);
      let u = unitAt(st, x, y, isO ? null : ent);
      if (u && u.id === actorId) u = null;   // あおぐ本人は、立つ升へ歩いていく
      const here = stand && stand[0] === x && stand[1] === y;
      if (isO) {
        if (s.out || (s.void && !u)) return { d, x, y, land: 'lost' };
        if (u && isFoe(u)) { if (u.z <= z0 + 2) return { d, x, y, z: u.z, land: 'hit', foe: u }; high = true; continue; }
        if (u || here) { blocked = true; continue; }
        if (s.water) return { d, x, y, z: st.h[idx(st, x, y)], land: 'sink' };
        if (s.block || s.wall || !s.stand) { blocked = true; continue; }
        if (s.z > z0 + 2) { high = true; continue; }
        return { d, x, y, z: s.z, land: s.ice ? 'ice' : 'floor' };
      }
      if (kind === 'e') {
        if (s.out || (s.void && !u)) return { d, x, y, land: 'void' };
        if (u || here) { blocked = true; continue; }
        if (s.water) return { d, x, y, z: st.h[idx(st, x, y)], land: 'drown' };
        if (!s.stand) { blocked = true; continue; }
        if (s.z > z0 + 2) { high = true; continue; }
        return { d, x, y, z: s.z, land: s.ice ? 'ice' : 'floor' };
      }
      // 仲間：だれもいない立てる升へ（谷・水・外へは下ろさない）
      if (s.out || s.void || s.water || !s.stand || u || here) { blocked = true; continue; }
      if (s.z > z0 + 2) { high = true; continue; }
      return { d, x, y, z: s.z, land: 'floor' };
    }
    return { why: high && !blocked ? '3段上で届かない' : high ? '下りる先がない（高すぎる升・ふさがった升）' : '下りる先がない' };
  }

  // ---------- 引けるもの（引き鉤。05 2.2） ----------
  function pullInfo(st, ref) {
    const isU = !!ref.u;
    const ent = isU ? unitById(st, ref.u) : objById(st, ref.o);
    if (!ent || ent.gone || ent.ko) return { ok: false, why: 'ない' };
    if (isU) {
      if (!isFoe(ent)) return { ok: false, why: '仲間は引かない' };
      if (!ent.active) return { ok: false, why: '眠っている敵は引けない' };
      const E = ENEMY[ent.k];
      if (E.swim && !(ent.frozen > 0)) return { ok: false, why: '水霊には手ごたえがない（水ごと凍らせれば閉じこめられる）' };
      if (E.heavy && !(ent.frozen > 0)) return { ok: false, why: '重すぎて引けない（凍らせれば、すべって寄ってくる）', heavy: true };
      return { ok: true, ent, isU };
    }
    if (ent.k === 'lever') return ent.done ? { ok: false, why: 'もう引いた' } : { ok: true, ent, lever: true };
    if (['boulder', 'block', 'pillar', 'icepillar'].includes(ent.k)) return { ok: false, why: '重すぎて引けない', heavy: true };
    if (!PULLABLE.includes(ent.k)) return { ok: false, why: '引けない' };
    for (const o of st.objs) if (!o.gone && o !== ent && o.x === ent.x && o.y === ent.y && o.z > ent.z && !['plate', 'icicle', 'torch'].includes(o.k)) return { ok: false, why: '上に物がのっている' };
    if (unitAt(st, ent.x, ent.y)) return { ok: false, why: '上にだれかが立っている' };
    return { ok: true, ent, isU: false };
  }
  // 写しの上で、リコを stand に立たせて引いてみる（最初の1升が動くか）
  function pullTrial(st, heroId, ref, d, stand) {
    try {
      const c = clone(st);
      if (c.mode !== 'combat') c.units = c.units.filter(x => !(isHero(x) && x.id !== heroId && !x.fixed));
      const r = unitById(c, heroId); r.x = stand[0]; r.y = stand[1]; r.z = standZ(c, r.x, r.y, r);
      const ent = ref.u ? unitById(c, ref.u) : objById(c, ref.o);
      const res = pushEntity(c, ent, !!ref.u, d, [], { who: [heroId], text: '', kills: 0, combo: false, big: 0 }, { dist: PULL_MOVE, why: 'pull', noHit: true, stopAt: stand });
      return res.moved > 0;
    } catch (err) { return false; }
  }

  // ---------- 行動の計画（どこに立って、何をするか） ----------
  // intent: {k:'move',x,y} {k:'push',ref,dir} {k:'shoot',ref} {k:'rope',o} {k:'freeze',x,y|ref} {k:'blast',x,y}
  function plan(st, heroId, intent) {
    const u = unitById(st, heroId);
    if (!u || u.ko || !isHero(u)) return { ok: false, why: '動けない' };
    const combat = st.mode === 'combat';
    if (combat && u.acted && intent.k !== 'move') return { ok: false, why: 'この手番は行動ずみ' };
    if (u.fixed && intent.k === 'move') return { ok: false, why: (HERO[u.k] || {}).name + 'は足をいためていて、歩けない' };
    const max = u.fixed ? 0 : combat ? u.mv : 999;
    const dist = reach(st, u, { max, ignoreUnits: !combat, linkCost: combat ? 2 : 1 });
    const okStand = (i) => {
      const x = i % st.W, y = (i / st.W) | 0;
      if (combat) { const o = unitAt(st, x, y, u); if (o) return false; }
      if (!combat && i !== idx(st, u.x, u.y)) { const o = unitAt(st, x, y, u); if (o && isNpc(o)) return false; }
      return surface(st, x, y).stand;
    };
    const pick = (cands, score) => {
      let best = null, bs = 1e9;
      for (const i of cands) {
        if (!dist.has(i) || !okStand(i)) continue;
        const s = dist.get(i).c + (score ? score(i) : 0);
        if (s < bs) { bs = s; best = i; }
      }
      return best;
    };
    const res = (stand, extra) => {
      const path = pathTo(st, dist, stand);
      return Object.assign({ ok: true, hero: heroId, intent, stand: [stand % st.W, (stand / st.W) | 0], path, cost: dist.get(stand).c }, extra || {});
    };
    const verbOk = (v, who) => { if (!can(st, heroId, v)) return { ok: false, why: who }; return null; };

    if (intent.k === 'move') {
      if (!inside(st, intent.x, intent.y)) return { ok: false, why: '外' };
      const i = idx(st, intent.x, intent.y);
      if (!dist.has(i)) { const why = whyNot(st, u, intent.x, intent.y, combat); return { ok: false, why, whyAt: whyNot.at }; }
      if (!okStand(i)) return { ok: false, why: 'そこには立てない' };
      return res(i);
    }
    if (intent.k === 'push') {
      const no = verbOk('push', '押せるのはガルド'); if (no) return no;
      const pi = pushInfo(st, intent.ref, { dir: intent.dir });
      if (!pi.ok) return { ok: false, why: pi.why, heavy: pi.heavy };
      const e = pi.ent;
      const [dx, dy] = DIRS[intent.dir];
      const sx = e.x - dx, sy = e.y - dy;
      if (!inside(st, sx, sy)) return { ok: false, why: 'そちら側に回れない' };
      const ss = surface(st, sx, sy);
      if (!ss.stand) return { ok: false, why: 'そちら側に立てない' };
      if (Math.abs(ss.z - e.z) > 1) return { ok: false, why: '高さがちがって押せない' };
      const i = idx(st, sx, sy);
      if (!dist.has(i) || !okStand(i)) return { ok: false, why: combat ? 'そこまで歩けない' : 'そちら側に回れない' };
      return res(i, { topple: !!pi.topple });
    }
    if (intent.k === 'waft') {
      // あおぐ（05 2.1）：となりの軽い物・敵・仲間を、反対側へ2升（大うちわで3）。風鳴り石は鳴らす
      if (!can(st, heroId, 'waft')) return { ok: false, why: 'あおげるのはナギ' };
      const wi = waftInfo(st, intent.ref, heroId);
      if (!wi.ok) return wi;
      const e = wi.ent;
      if (wi.chime) {
        let best = null;
        for (const [dx, dy] of DIRS) {
          const sx = e.x + dx, sy = e.y + dy;
          if (!inside(st, sx, sy)) continue;
          const i = idx(st, sx, sy), ss = surface(st, sx, sy);
          if (!ss.stand || Math.abs(ss.z - e.z) > 1 || !dist.has(i) || !okStand(i)) continue;
          if (!best || dist.get(i).c < dist.get(best).c) best = i;
        }
        if (best === null) return { ok: false, why: combat ? 'この手番では、となりへ行けない' : 'となりに立てない' };
        return res(best, { tx: e.x, ty: e.y, tz: e.z, chime: true });
      }
      if (intent.dir === undefined) return { ok: false, why: '向きがない' };
      const [dx, dy] = DIRS[intent.dir];
      const sx = e.x - dx, sy = e.y - dy;
      if (!inside(st, sx, sy)) return { ok: false, why: 'そちら側に回れない' };
      const ss = surface(st, sx, sy);
      if (!ss.stand) return { ok: false, why: 'そちら側に立てない' };
      if (Math.abs(ss.z - e.z) > 1) return { ok: false, why: '高さがちがって、あおげない' };
      const i = idx(st, sx, sy);
      if (!dist.has(i) || !okStand(i)) return { ok: false, why: combat ? 'そこまで歩けない' : 'そちら側に回れない' };
      if (i === idx(st, e.x, e.y)) return { ok: false, why: '自分は運べない' };
      // 下りる升（凍った重い敵はすべりだす・飛ぶ敵は流される）
      if (!wi.slide && !wi.flyer) {
        const dest = waftDest(st, e, wi.kind, intent.dir, waftDist(st), [sx, sy], heroId);
        if (!dest.land) return { ok: false, why: dest.why };
      }
      return res(i, { tx: e.x, ty: e.y, tz: e.z });
    }
    if (intent.k === 'pull') {
      // 引き鉤（05 2.2）：相手と一直線（間の升が1〜3）。相手はリコのほうへ最大2升。レバーは距離1〜4
      if (!can(st, heroId, 'pull')) return { ok: false, why: u.k === 'riko' ? '引き鉤があれば、引ける' : '引けるのはリコ（引き鉤）', needHook: u.k === 'riko' };
      const pi = pullInfo(st, intent.ref);
      if (!pi.ok) return pi;
      const e = pi.ent;
      const dirs = intent.dir !== undefined ? [intent.dir] : [0, 1, 2, 3];
      let best = null, why = null;
      for (const d of dirs) {
        const [dx, dy] = DIRS[d];
        let bd = null;
        for (let k = pi.lever ? 1 : 2; k <= PULL_MAX; k++) {
          const sx = e.x + dx * k, sy = e.y + dy * k;
          if (!inside(st, sx, sy)) break;
          const i = idx(st, sx, sy);
          if (!dist.has(i) || !okStand(i)) continue;
          if (e.z > dist.get(i).z + 2) { why = why || '高すぎて届かない（引けるのは2段上まで）'; continue; }
          // 探索中は、眠っている敵を起こさない升を先に選ぶ（歩数が同じくらいなら）
          const c = dist.get(i).c + (!combat && wakeCheck(st, sx, sy) ? 50 : 0);
          if (!bd || c < bd.c) bd = { i, d, c };
        }
        if (!bd) continue;
        // 最初の1升が動けないなら、引けない（写しで試す）
        if (!pi.lever && !pullTrial(st, heroId, intent.ref, d, [bd.i % st.W, (bd.i / st.W) | 0])) { why = '引っかかって動かない'; continue; }
        if (!best || bd.c < best.c) best = bd;
      }
      if (!best) return { ok: false, why: why || (combat ? 'この手番では、一直線に並ぶ升まで行けない（距離' + PULL_MAX + 'まで）' : '一直線に並ぶ升に立てない（距離' + PULL_MAX + 'まで）'), range: PULL_MAX };
      if (u.fixed && best.i !== idx(st, u.x, u.y)) return { ok: false, why: 'ここからでは引けない' };
      return res(best.i, { tx: e.x, ty: e.y, tz: e.z, pullDir: best.d, lever: !!pi.lever });
    }
    if (intent.k === 'shoot' || intent.k === 'rope' || intent.k === 'freeze' || intent.k === 'blast') {
      const no = verbOk(intent.k, { shoot: '射られるのはリコ', rope: '鉤縄はリコ', freeze: '凍らせられるのはセナ', blast: '発破はトビ' }[intent.k]); if (no) return no;
      let tx, ty, tz, R, extra = {};
      if (intent.k === 'rope') {
        const a = objById(st, intent.o);
        if (!a || a.k !== 'anchor') return { ok: false, why: 'ない' };
        tx = a.x; ty = a.y; tz = surface(st, tx, ty).z;
        R = st.up.rope2 ? RANGE.rope2 : RANGE.rope;
        if (unitAt(st, tx, ty, u)) return { ok: false, why: '輪の下にだれかいる' };
        if (u.x === tx && u.y === ty) return { ok: false, why: 'もう輪のところにいる' };
      } else if (intent.k === 'shoot') {
        R = RANGE.shoot + (st.up.bow ? 1 : 0) + (u.rangeUp || 0);
        if (intent.ref.u) {
          const t = unitById(st, intent.ref.u);
          if (!t || t.ko || !isFoe(t)) return { ok: false, why: '射る相手がいない' };
          tx = t.x; ty = t.y; tz = t.z;
        } else {
          const o = objById(st, intent.ref.o);
          if (o && o.k === 'icicle') {
            // つらら：射ると落ちる（05 3.2）。下に仲間・救助される人がいる升は落とせない
            if (o.gone) return { ok: false, why: 'もう落ちた' };
            // 探索中は、ついてくる仲間（とリコ自身）は歩いてどくので、動けない人だけを見る
            const under = unitAt(st, o.x, o.y);
            const movesAway = !combat && under && isHero(under) && !under.fixed;
            if (under && !isFoe(under) && !movesAway) return { ok: false, why: '下に仲間がいる（落とせない）' };
            tx = o.x; ty = o.y; tz = o.z + ICICLE_Z;
          } else {
            if (!o || o.k !== 'target' || o.hit) return { ok: false, why: 'もう当たっている' };
            tx = o.x; ty = o.y; tz = o.z;
          }
        }
      } else if (intent.k === 'blast') {
        R = RANGE.blast + (u.rangeUp || 0);
        tx = intent.x; ty = intent.y;
        if (!inside(st, tx, ty)) return { ok: false, why: '外' };
        const sf = surface(st, tx, ty);
        tz = sf.void ? 0 : sf.block ? Math.max(sf.z, sf.blockTop - 1) : sf.z;
        const b = blastSet(st, tx, ty);
        if (!b.any) return { ok: false, why: 'ここで発破しても、何も起きない' };
      } else {
        R = RANGE.freeze + (st.up.staff ? 1 : 0) + (u.rangeUp || 0);
        if (intent.ref && intent.ref.u) {
          const t = unitById(st, intent.ref.u);
          if (!t || t.ko || !isFoe(t)) return { ok: false, why: 'ない' };
          if (t.resist > 0) return { ok: false, why: '氷を振りはらったばかりで、いまは凍らない' };
          tx = t.x; ty = t.y; tz = t.z;
        } else if (intent.ref && intent.ref.o) {
          const o = objById(st, intent.ref.o);
          if (!o) return { ok: false, why: 'ない' };
          if (o.k === 'crystal') {
            if (o.lit) return { ok: false, why: 'もう凍っている' };
            tx = o.x; ty = o.y; tz = o.z + 1;
          } else {
            if (o.k !== 'fall' || o.frozen) return { ok: false, why: 'もう凍っている' };
            if (o.strong) return { ok: false, why: '水の勢いが強すぎて、凍らせても砕ける', strong: true };
            tx = o.bx; ty = o.by; tz = o.bz;
          }
        } else {
          tx = intent.x; ty = intent.y; tz = st.h[idx(st, tx, ty)];
          if (!freezeCells(st, tx, ty).length) {
            if (!st.up.staff) return { ok: false, why: '凍らせる水がない' };
            const sf = surface(st, tx, ty);
            if (!sf.stand || sf.top || unitAt(st, tx, ty) || st.objs.some(o => !o.gone && o.x === tx && o.y === ty && o.k !== 'torch')) return { ok: false, why: 'ここには氷をつくれない' };
            tz = sf.z; extra.make = true;
          }
        }
      }
      const cands = [];
      let tooHigh = false;
      for (const i of dist.keys()) {
        const x = i % st.W, y = (i / st.W) | 0;
        if (!inRange(x, y, tx, ty, R) || (x === tx && y === ty && intent.k !== 'freeze')) continue;
        if (intent.k === 'rope' && tz - dist.get(i).z > 2) { tooHigh = true; continue; }
        if (intent.k === 'blast' && Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1) continue; // 自分は爆風の外から投げる
        if (extra.make && x === tx && y === ty) continue;
        cands.push(i);
      }
      const score = (i) => {
        if (intent.k !== 'shoot' || !intent.ref.u) return 0;
        const d = dist.get(i);
        return d.z >= tz + 2 ? -0.6 : 0;
      };
      if (u.fixed) {
        const me = idx(st, u.x, u.y);
        if (!cands.includes(me)) return { ok: false, why: 'ここからでは届かない（距離' + R + 'まで）', range: R };
        return res(me, Object.assign(extra, { tx, ty, tz, range: R }));
      }
      const best = pick(cands, score);
      if (best === null && tooHigh) return { ok: false, why: '輪が高すぎる（鉤縄は2段上までしか届かない）', range: R };
      if (best === null) return { ok: false, why: combat ? 'この手番では届かない（距離' + R + 'まで）' : '届く場所がない（距離' + R + 'まで）', range: R };
      return res(best, Object.assign(extra, { tx, ty, tz, range: R }));
    }
    return { ok: false, why: '?' };
  }

  function whyNot(st, u, x, y, combat) {
    whyNot.at = null;
    const s = surface(st, x, y);
    if (s.void) return '足場がない';
    if (s.fast) return '流れの速い水。凍らせられない（重い物を沈めれば飛び石になる）';
    if (s.water) return '深い水。歩いては渡れない';
    if (s.block && s.block.k === 'crack') return 'ひび割れた岩。発破なら砕ける';
    if (s.wall || s.block) return '立てない';
    if (combat) return 'この手番では届かない';
    const r = reach(st, u, { ignoreUnits: true });
    let best = null, bd = 1e9;
    for (const i of r.keys()) {
      const ax = i % st.W, ay = (i / st.W) | 0;
      const a = surface(st, ax, ay);
      for (const [dx, dy] of DIRS) {
        const nx = ax + dx, ny = ay + dy;
        if (!inside(st, nx, ny) || r.has(idx(st, nx, ny))) continue;
        const n = surface(st, nx, ny);
        const d = d2(nx, ny, x, y) + d2(ax, ay, x, y) * 0.3;
        if (d < bd) { bd = d; best = { a, n, at: [ax, ay, a.z, nx, ny] }; }
      }
    }
    if (!best) return 'いまは行く道がない';
    const { a, n } = best;
    whyNot.at = best.at;
    if (n.void) return '谷にさえぎられて行けない';
    if (n.fast) return '流れの速い水にさえぎられて行けない';
    if (n.water) return '深い水にさえぎられて行けない';
    if (n.block && n.block.k === 'crack') return 'ひび割れた岩にふさがれている（発破なら砕ける）';
    if (n.block) return '物にふさがれて行けない';
    if (n.wall) return '壁にさえぎられて行けない';
    const dz = n.z - a.z;
    if (dz >= 2) return '段差が高い（' + dz + '段）。のぼれるのは1段まで';
    if (dz <= -3) return '下りるには高すぎる（' + (-dz) + '段）。飛びおりられるのは2段まで';
    return 'いまは行く道がない';
  }

  function freezeCells(st, tx, ty) {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = tx + dx, y = ty + dy;
      if (!inside(st, x, y)) continue;
      if (st.t[idx(st, x, y)] !== 'w') continue;
      out.push([x, y]);
    }
    return out;
  }

  // 爆風が届くもの（中心と、上下左右。大玉ならさらに外まで押す）
  function blastSet(st, tx, ty) {
    const out = { center: null, cracks: [], push: [], icicles: [], snow: [], any: false };
    const cu = unitAt(st, tx, ty);
    if (cu && isFoe(cu)) { out.center = cu; out.any = true; }
    const cells = [[tx, ty, -1]].concat(DIRS.map(([dx, dy], d) => [tx + dx, ty + dy, d]));
    for (const [x, y, d] of cells) {
      if (!inside(st, x, y)) continue;
      for (const o of st.objs) if (!o.gone && o.k === 'crack' && o.x === x && o.y === y) { out.cracks.push(o); out.any = true; }
      // つらら：爆心か上下左右なら落ちる（下に仲間がいれば落とさない）。深い雪は飛んで土になる（v0.3）
      for (const o of st.objs) if (!o.gone && o.k === 'icicle' && o.x === x && o.y === y) { const un = unitAt(st, x, y); if (!un || isFoe(un)) { out.icicles.push(o); out.any = true; } }
      // 雪だけでは「何か起きる」に数えない（ほかの物を吹き飛ばすついでに、雪も飛ぶ）
      if (st.t[idx(st, x, y)] === 'n' && !st.objs.some(o => !o.gone && o.x === x && o.y === y && TOPS.includes(o.k))) out.snow.push([x, y]);
      if (d < 0) continue;
      const u = unitAt(st, x, y);
      if (u && isFoe(u) && !(ENEMY[u.k].swim && !(u.frozen > 0))) { out.push.push({ ref: { u: u.id }, dir: d }); out.any = true; continue; }
      if (u) continue;
      const tops = st.objs.filter(o => !o.gone && o.x === x && o.y === y && PUSHABLE.includes(o.k)).sort((a, b) => b.z - a.z);
      if (tops.length) { const pi = pushInfo(st, { o: tops[0].id }, { force: true }); if (pi.ok) { out.push.push({ ref: { o: tops[0].id }, dir: d }); out.any = true; } }
    }
    return out;
  }

  // ---------- 行動の実行 ----------
  function apply(st, p) {
    const evs = [];
    const u = unitById(st, p.hero);
    const combat = st.mode === 'combat';
    const before = combat ? null : partyReach(st);
    if (p.path && p.path.length > 1) {
      if (combat) {
        const xyz = cellsXYZ(st, p.path);
        u.mv = Math.max(0, u.mv - p.cost);
        moveUnitTo(st, u, p.stand[0], p.stand[1]);
        evs.push({ k: 'walk', id: u.id, path: xyz });
        st.stats.steps += xyz.length - 1;
      } else {
        // ついてくる仲間は、この行動で動く物・敵の通り道と行き先の升に止まらない（05 1.6）
        partyWalk(st, u, p.path, evs, p.intent.k !== 'move' ? actionCells(st, p) : null, p.intent.k === 'waft' && p.intent.ref && p.intent.ref.u ? p.intent.ref.u : null);
        const ce = evs.find(e => e.k === 'combat');
        if (ce) {
          if (p.intent.k !== 'move') ce.cancel = { who: u.id, verb: VERB[p.intent.k] || '行動' };
          postCheck(st, evs, before, null); return evs;
        }
      }
    } else if (!combat && p.intent.k !== 'move') {
      // 歩かずに働きかけるときも、動く物の行き先・つららの下にいる仲間はどく（v0.3）
      const av = actionCells(st, p);
      const keep = p.intent.k === 'waft' && p.intent.ref && p.intent.ref.u ? p.intent.ref.u : null;
      if (heroes(st).some(h => h !== u && h.id !== keep && !h.ko && !h.fixed && av.has(idx(st, h.x, h.y)))) {
        partyWalk(st, u, [idx(st, u.x, u.y)], evs, av, keep);
        const ce = evs.find(e => e.k === 'combat');
        if (ce) { ce.cancel = { who: u.id, verb: VERB[p.intent.k] || '行動' }; postCheck(st, evs, before, null); return evs; }
      }
    }
    const I = p.intent;
    if (I.k === 'move') {
      collectAt(st, u, evs);
      if (!combat) triggersAt(st, evs);
      postCheck(st, evs, before, null);
      return evs;
    }
    const tp = I.k === 'push' || I.k === 'pull' || I.k === 'waft' ? objOrUnitPos(st, I.ref) : [p.tx, p.ty];
    u.face = faceTo(u.x, u.y, tp[0], tp[1], u.face);
    const credit = { who: [u.id], text: '', kills: 0, combo: false, big: 0 };
    st.stats.acts[u.id] = (st.stats.acts[u.id] || 0) + 1;
    if (I.k === 'push') doPush(st, u, I.ref, I.dir, evs, credit);
    else if (I.k === 'pull') doPull(st, u, I, evs, credit, p);
    else if (I.k === 'waft') doWaft(st, u, I, evs, credit, p);
    else if (I.k === 'shoot') doShoot(st, u, I.ref, evs, credit);
    else if (I.k === 'rope') doRope(st, u, I.o, evs, credit);
    else if (I.k === 'freeze') doFreeze(st, u, I, evs, credit, p);
    else if (I.k === 'blast') doBlast(st, u, I, evs, credit);
    if (combat) { u.acted = true; u.mv = 0; }
    postCheck(st, evs, before, credit);
    return evs;
  }

  const VERB = { push: '押す', shoot: '射る', rope: '鉤縄で渡る', freeze: '凍らせる', blast: '発破', pull: '引く', waft: 'あおぐ' };
  function objOrUnitPos(st, ref) {
    const e = ref.u ? unitById(st, ref.u) : objById(st, ref.o);
    return [e.x, e.y];
  }
  function faceTo(x0, y0, x1, y1, def) {
    const dx = x1 - x0, dy = y1 - y0;
    if (dx === 0 && dy === 0) return def;
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 0 : 2;
    return dy > 0 ? 1 : 3;
  }
  function moveUnitTo(st, u, x, y) {
    if (u.x !== x || u.y !== y) u.face = faceTo(u.x, u.y, x, y, u.face);
    u.x = x; u.y = y; u.z = standZ(st, x, y, u);
  }

  // 行動で動く物・敵の通り道と行き先（ついてくる仲間を立たせない升）。仲間がいないものとして写しで試す
  function actionCells(st, p) {
    const out = new Set();
    try {
      const c = clone(st);
      c.units = c.units.filter(x => !(isHero(x) && x.id !== p.hero && !x.fixed));
      const u = unitById(c, p.hero);
      u.x = p.stand[0]; u.y = p.stand[1]; u.z = standZ(c, u.x, u.y, u);
      const evs = [], credit = { who: [u.id], text: '', kills: 0, combo: false, big: 0 };
      const I = p.intent;
      if (I.k === 'push') doPush(c, u, I.ref, I.dir, evs, credit);
      else if (I.k === 'blast') doBlast(c, u, I, evs, credit);
      else if (I.k === 'freeze') doFreeze(c, u, I, evs, credit, p);
      else if (I.k === 'pull') doPull(c, u, I, evs, credit, p);
      else if (I.k === 'waft') doWaft(c, u, I, evs, credit, p);
      else if (I.k === 'shoot' && I.ref && I.ref.o) { const o = objById(c, I.ref.o); if (o && o.k === 'icicle') out.add(idx(st, o.x, o.y)); return out; }
      else return out;
      const walk = (l) => { for (const e of l) {
        if (e.k === 'group') walk(e.evs);
        else if (e.k === 'slide') for (let k = 1; k < e.path.length; k++) out.add(idx(st, e.path[k][0], e.path[k][1]));
        else if (e.k === 'fall' && e.to) out.add(idx(st, e.to[0], e.to[1]));
        else if (e.k === 'topple') for (const b of e.beams) out.add(idx(st, b.x, b.y));
        else if (e.k === 'iceblock' && e.o) out.add(idx(st, e.o.x, e.o.y));
        else if (e.k === 'icicle') out.add(idx(st, e.x, e.y));
        else if (e.k === 'waft' && e.to) out.add(idx(st, e.to[0], e.to[1]));
      } };
      walk(evs);
    } catch (err) { /* 試せなければ、ふつうに歩く */ }
    return out;
  }

  // 探索中の移動：選んだ一人が先頭で歩き、仲間がついてくる
  function partyWalk(st, lead, path, evs, avoid, keep) {
    const W = st.W;
    let cut = path.length;
    for (let k = 1; k < path.length; k++) {
      const x = path[k] % W, y = (path[k] / W) | 0;
      if (wakeCheck(st, x, y)) { cut = k + 1; break; }
    }
    path = path.slice(0, cut);
    const xyz = cellsXYZ(st, path);
    const group = [{ k: 'walk', id: lead.id, path: xyz }];
    const end = path[path.length - 1];
    lead.face = path.length > 1 ? faceTo(xyz[xyz.length - 2][0], xyz[xyz.length - 2][1], xyz[xyz.length - 1][0], xyz[xyz.length - 1][1], lead.face) : lead.face;
    lead.x = end % W; lead.y = (end / W) | 0; lead.z = standZ(st, lead.x, lead.y, lead);
    st.stats.steps += path.length - 1;
    const others = heroes(st).filter(h => h !== lead && !h.ko && !h.fixed && h.id !== keep);
    const taken = new Set([end]);
    for (const o of st.objs) if (!o.gone && (PUSHABLE.includes(o.k) || o.k === 'anchor' || o.k === 'chest')) taken.add(idx(st, o.x, o.y));
    for (const u of st.units) if (!u.ko && (isNpc(u) || u.fixed || u.id === keep)) taken.add(idx(st, u.x, u.y));
    if (avoid) for (const i of avoid) taken.add(i);
    const trail = path.slice(0, -1).reverse();
    const goals = [];
    const nearMap = reach(st, lead, { ignoreUnits: true, max: 3, noLinks: true });
    const free = (i) => !taken.has(i) && surface(st, i % W, (i / W) | 0).stand;
    for (const i of trail) { if (goals.length >= others.length) break; if (nearMap.has(i) && free(i)) { goals.push(i); taken.add(i); } }
    if (goals.length < others.length) {
      const near = [...nearMap.entries()].sort((a, b) => a[1].c - b[1].c);
      for (const [i] of near) { if (goals.length >= others.length) break; if (free(i)) { goals.push(i); taken.add(i); } }
    }
    for (const i of trail) { if (goals.length >= others.length) break; if (free(i)) { goals.push(i); taken.add(i); } }
    others.sort((a, b) => d2(a.x, a.y, lead.x, lead.y) - d2(b.x, b.y, lead.x, lead.y));
    others.forEach((h, n) => {
      const g = goals[n];
      if (g === undefined) return;
      const dist = reach(st, h, { ignoreUnits: true });
      if (!dist.has(g)) return;
      const pth = pathTo(st, dist, g);
      if (pth.length < 2) return;
      const pxyz = cellsXYZ(st, pth);
      group.push({ k: 'walk', id: h.id, path: pxyz, follow: true });
      h.face = faceTo(pxyz[pxyz.length - 2][0], pxyz[pxyz.length - 2][1], pxyz[pxyz.length - 1][0], pxyz[pxyz.length - 1][1], h.face);
      h.x = g % W; h.y = (g / W) | 0; h.z = standZ(st, h.x, h.y, h);
    });
    evs.push(group.length > 1 ? { k: 'group', evs: group } : group[0]);
    for (const h of heroes(st)) collectAt(st, h, evs);
    const woke = wakeCheck(st);
    if (woke) startCombat(st, woke, evs);
  }

  function wakeCheck(st, x, y) {
    for (const e of enemies(st)) {
      if (e.ko || e.active) continue;
      if (x !== undefined) { if (inRange(x, y, e.x, e.y, e.wake)) return e.grp; continue; }
      for (const h of heroes(st)) if (!h.ko && !h.fixed && inRange(h.x, h.y, e.x, e.y, e.wake)) return e.grp;
    }
    return 0;
  }
  function startCombat(st, grp, evs) {
    for (const e of enemies(st)) if (e.grp === grp && !e.ko) e.active = true;
    st.mode = 'combat'; st.turn = 1; st.grp = grp;
    st.stats.fights++;
    for (const h of heroes(st)) { h.acted = false; h.mv = h.fixed ? 0 : movOf(h); }
    evs.push({ k: 'combat', grp });
    const def = st.fightSay && st.fightSay[grp];
    if (def) for (const s of def) { if (!sayOk(st, s[2])) continue; const who = speaker(st, s[0]); if (who) evs.push({ k: 'say', who, text: sayText(s, who) }); }
  }
  // 台詞を出す（話し手がその編成にいない行は出さない。語り narr と、地図にいる人はそのまま）
  function sayLines(st, list, evs) {
    for (const s of list || []) {
      if (!sayOk(st, s[2])) continue;
      const who = speaker(st, s[0]);
      if (!who) continue;
      if (who !== 'narr' && HERO[who] && !unitById(st, who)) continue;
      evs.push({ k: 'say', who, text: sayText(s, who) });
    }
  }
  // 台詞の出る条件（3つめの要素）。ifObj：その物がまだある／ifDown・ifUp：はね橋が下りている・上がっている（v0.3）
  function sayOk(st, c) {
    if (!c) return true;
    if (c.ifHero && !unitById(st, c.ifHero)) return false;
    if (c.ifObj) { const o = objById(st, c.ifObj); if (!o || o.gone) return false; }
    if (c.ifDown && !(objById(st, c.ifDown) || {}).down) return false;
    if (c.ifUp && (objById(st, c.ifUp) || {}).down) return false;
    if (c.ifNotReach) { const i = idx(st, c.ifNotReach[0], c.ifNotReach[1]); if (partyReach(st).has(i)) return false; }
    return true;
  }
  // 'gard|tobi' のように書いた話し手は、編成にいる最初の一人（だれもいなければ出さない）
  function speaker(st, who) {
    if (who.indexOf('|') < 0) return who;
    for (const w of who.split('|')) { const u = unitById(st, w); if (u && !u.ko) return w; }
    return null;
  }
  // 台詞は文字列か、話し手ごとの言いまわし { gard: '…', tobi: '…' }
  function sayText(s, who) { return typeof s[1] === 'string' ? s[1] : (s[1][who] || ''); }

  function collectAt(st, u, evs) {
    if (!isHero(u)) return;
    for (const o of st.objs) {
      if (o.gone || o.k !== 'chest' || o.open) continue;
      if (o.x === u.x && o.y === u.y) {
        o.open = true;
        // 依頼の目的の品（角笛・石板）は報酬ではないので、受けなおしでも毎回ある
        const goal = st.obj && o.item && st.obj.item === o.item;
        if (o.taken && !goal) {
          evs.push({ k: 'collect', o: o.id, item: null, coins: 0, empty: true, by: u.id, x: o.x, y: o.y, z: o.z });
          evs.push({ k: 'caption', who: [u.id], text: '宝箱は空だった（前に来たとき、もう持ち帰った）' });
          continue;
        }
        if (o.item) { st.items.push(o.item); if (o.up) st.up[o.up] = true; }
        if (o.coins) st.coins += o.coins;
        st.found.push(o.id);
        evs.push({ k: 'collect', o: o.id, item: o.item, coins: o.coins || 0, by: u.id, x: o.x, y: o.y, z: o.z });
        if (o.say) sayLines(st, o.say, evs);
      }
    }
  }

  function triggersAt(st, evs) {
    for (const tr of st.trig || []) {
      if (st.said[tr.id]) continue;
      if (tr.flag && !st.flags[tr.flag]) continue;
      if (tr.need && !tr.need.some(v => heroWith(st, v))) continue;
      if (tr.up && !st.up[tr.up]) continue;
      if (tr.notDown && (objById(st, tr.notDown) || {}).down) continue;
      // link：縄の道の片はしが、この範囲にある（v0.3）／who：その人が範囲に入ったとき
      if (tr.link && !st.links.some(L => L.k === 'rope' && [L.a, L.b].some(c => c[0] >= tr.link[0] && c[1] >= tr.link[1] && c[0] <= tr.link[2] && c[1] <= tr.link[3]))) continue;
      if (tr.flagNot && st.flags[tr.flagNot]) continue;
      const hit = !tr.r || heroes(st).some(h => !h.ko && !h.fixed && (!tr.who || h.id === tr.who) && h.x >= tr.r[0] && h.y >= tr.r[1] && h.x <= tr.r[2] && h.y <= tr.r[3]);
      if (!hit) continue;
      st.said[tr.id] = 1;
      sayLines(st, tr.say, evs);
      if (tr.on) runOn(st, tr.on, evs, null);
    }
  }

  // ---------- 押す・吹き飛ばす ----------
  function hurt(st, u, n, why, evs, credit) {
    if (u.ko || n <= 0) return;
    if (isFoe(u) && ENEMY[u.k].armor && why !== 'enemy') {
      if (!(u.flipped > 0)) {
        // drop：つらら・あおいだ物が上から落ちて当たった（05 2.1・3.2）
        if (why === 'fall' || why === 'crush' || why === 'rock' || why === 'drop') { flip(st, u, evs, credit); n = 2; }
        // 甲羅のすきまに刺さる高所の矢は、傷1に固定（05 1.2。風切りの弓で2）
        else if (why === 'arrowHigh') { if (credit) credit.gap = true; n = 1 + (st.up.bow2 ? 1 : 0); }
        else { evs.push({ k: 'clang', id: u.id }); if (credit) credit.clang = (credit.clang || 0) + 1; return; }
      } else if (why !== 'fall') n += 1; // ひっくり返ったお腹は、やわらかい（重ねても、すきは延びない）
    }
    // 身がわりの木札：倒れる傷を、依頼ごとに一度だけ体力1でこらえる
    if (isHero(u) && u.tag && !u.tagUsed && u.hp - n <= 0) {
      n = u.hp - 1; u.tagUsed = true;
      evs.push({ k: 'endure', id: u.id });
      if (n <= 0) return;
    }
    u.hp -= n;
    evs.push({ k: 'dmg', id: u.id, n, why, hp: Math.max(0, u.hp) });
    if (u.hp <= 0) ko(st, u, why, evs, credit);
  }
  // すき：次の自分の手番の終わりまで（05 1.1）。flipped は「残りの自分の手番の数」。
  // 自分の手番にできたら 2（直後の敵の手番は休み、次の自分の手番の終わりまで）。敵の手番にできたら 1
  function flip(st, u, evs, credit) {
    u.flipped = st.phase === 'enemy' ? 1 : 2; u.frozen = 0;
    const ev = { k: 'flip', id: u.id, left: u.flipped };
    evs.push(ev);
    if (credit) credit.flip = true;
    if (!st.said.flip1) {
      st.said.flip1 = 1;
      ev.first = true;      // 画面では、はじめてのすきに「次の手番の終わりまで、お腹が出ている」を大きく出す
      if (credit) credit.firstFlip = true;
      for (const s of st.flipSay || []) { const who = speaker(st, s[0]); if (who) evs.push({ k: 'say', who, text: sayText(s, who) }); }
    }
  }
  function ko(st, u, how, evs, credit) {
    if (u.ko) return;
    u.ko = true; u.hp = Math.max(0, u.hp);
    if (how === 'void' || how === 'drown' || how === 'ice' || !isHero(u)) u.gone = true;
    evs.push({ k: 'ko', id: u.id, how });
    if (isFoe(u)) {
      st.stats.foeKo = st.stats.foeKo || [];
      st.stats.foeKo.push({ k: u.k, how });
      if (u.boss) st.stats.bossTurn = st.turn;
    } else if (isHero(u)) st.stats.downs = (st.stats.downs || 0) + 1;
    if (isFoe(u) && credit) {
      credit.kills++;
      st.stats.kills[credit.who[0]] = (st.stats.kills[credit.who[0]] || 0) + 1;
    }
  }
  function fallDmg(drop) { return drop >= 4 ? 99 : drop === 3 ? 3 : drop === 2 ? 1 : 0; }

  function doPush(st, g, ref, dir, evs, credit) {
    const pi = pushInfo(st, ref, { dir });
    if (!pi.ok) { credit.text = '押せなかった（' + pi.why + '）'; return; }
    const ent = pi.ent;
    evs.push({ k: 'act', id: g.id, verb: 'push', tx: ent.x, ty: ent.y, tz: ent.z, dir });
    if (pi.topple) return topple(st, g, ent, dir, evs, credit);
    const r = pushEntity(st, ent, pi.kind === 'u', dir, evs, credit);
    finishPushCaption(st, ent, pi.kind === 'u', r, credit);
  }

  // 一つの物・敵を dir へ押す（すべる・転がる・落ちる・沈む）。結果を返す
  function pushEntity(st, ent, isU, dir, evs, credit, opt) {
    opt = opt || {};
    const [dx, dy] = DIRS[dir];
    const slip = (isU && ent.frozen > 0) || ent.k === 'iceblock';
    const roll = ent.k === 'boulder';
    if (slip && (ent.frozenBy || ent.by) === 'sena') addWho(credit, 'sena');
    if (isU && !opt.noHit) hurt(st, ent, 1, opt.why || 'push', evs, credit);
    if (isU && ent.ko) return { end: 'ko', path: [[ent.x, ent.y, ent.z]], moved: 0 };
    let x = ent.x, y = ent.y, z = ent.z;
    const path = [[x, y, z]];
    const ref2 = isU ? { u: ent.id } : { o: ent.id };
    let end = 'stop', bumpInto = null, steps = 0, iceUsed = false, crushed = 0, pushes = 0;
    let rollKills = 0, rollHit = null, noMomentum = null;
    const hits = [];   // 転がる大岩が通りがかりに当てた傷（演出では、大岩がその升に来たときに見せる）
    const flyer = isU && fly(ent);
    const maxPush = opt.dist || 1;
    while (steps++ < 40) {
      const nx = x + dx, ny = y + dy;
      // 引き鉤：リコのとなりまで来たら止まる（リコは傷を受けない）
      if (opt.stopAt && nx === opt.stopAt[0] && ny === opt.stopAt[1]) { end = 'stop'; break; }
      const s = surface(st, nx, ny, isU ? null : ent);
      const occ = unitAt(st, nx, ny, isU ? ent : null);
      if (flyer) {
        if (s.out || (s.block && s.blockTop > z + 1) || s.wall || occ) { end = 'bump'; bumpInto = occ; break; }
        x = nx; y = ny; path.push([x, y, s.void || s.water ? z : Math.max(s.z, z)]);
        if (++pushes >= maxPush) break;
        continue;
      }
      const armored = isU && ENEMY[ent.k].armor;
      if ((s.void || s.out) && !occ) {
        if (armored) { end = 'bump'; bumpInto = 'wall'; break; } // 大亀は、ふちで踏んばる
        x = nx; y = ny; path.push([x, y, z]); path.push([x, y, z - 14]);
        end = 'void'; break;
      }
      if (armored && s.water && !occ) { end = 'bump'; bumpInto = 'wall'; break; }
      const top = s.block ? Math.max(s.z, s.blockTop) : s.z;
      if (top > z) { end = 'bump'; bumpInto = s.block || 'wall'; break; }
      if (occ) {
        if (occ.z >= z - 1) {
          // 転がる物は、1升以上転がってから当たったときだけ傷を与え、すきを作る（05 1.3）
          if (roll && isFoe(occ) && pushes >= 1) {
            const h0 = evs.length, wasFlipped = occ.flipped > 0;
            hurt(st, occ, 3, 'crush', evs, credit); crushed++;
            const hit = evs.splice(h0);
            if (!wasFlipped && occ.flipped > 0) st.stats.boulderFlip = (st.stats.boulderFlip || 0) + 1;
            if (occ.ko) {
              rollKills++;
              x = nx; y = ny; z = s.z; path.push([x, y, z]);
              for (const h of hit) { h.atCell = path.length - 1; hits.push(h); }
              continue;
            }
            for (const h of hit) { h.atCell = path.length; hits.push(h); }
            rollHit = occ;
          } else if (roll && isFoe(occ)) noMomentum = occ;
          end = 'bump'; bumpInto = occ; break;
        }
        if (!isU) {
          path.push([nx, ny, z]);
          const sl0 = { k: 'slide', ref: ref2, path: path.slice(), roll };
          evs.push(hits.length ? { k: 'group', evs: [sl0].concat(hits), roll: true } : sl0);
          if (rollKills) st.stats.bestRoll = Math.max(st.stats.bestRoll || 0, rollKills);
          if (isFoe(occ)) hurt(st, occ, 3, 'rock', evs, credit);
          if (occ.ko || !isFoe(occ)) { ent.x = nx; ent.y = ny; ent.z = s.z; if (!occ.ko) { ent.gone = true; evs.push({ k: 'break', ref: ref2, x: nx, y: ny, z: occ.z + 2 }); } else { evs.push({ k: 'fall', ref: ref2, from: [nx, ny, z], to: [nx, ny, s.z], drop: z - s.z }); afterLand(st, ent, evs, credit); } }
          else { ent.gone = true; evs.push({ k: 'break', ref: ref2, x: nx, y: ny, z: occ.z + 2 }); }
          return { end: 'rock', path, moved: path.length - 1, already: true };
        }
        end = 'bump'; bumpInto = occ; break;
      }
      x = nx; y = ny;
      const drop = z - s.z;
      z = s.z;
      path.push([x, y, z]);
      pushes++;
      if (s.ice) { iceUsed = true; const i = idx(st, x, y); if (st.by[i] === 'sena') addWho(credit, 'sena'); }
      if (s.water) { end = isU ? (ENEMY[ent.k].swim ? 'stop' : 'drown') : 'sink'; break; }
      if (isU && drop >= 2) {
        const fd = fallDmg(drop);
        if (fd) { end = 'fall'; ent._fallDmg = fd; ent._drop = drop; break; }
      }
      if (s.plate && !isU) { end = 'plate'; break; }
      if (!(slip || roll || s.ice) && pushes >= maxPush) { end = 'stop'; break; }
    }
    const ox = ent.x, oy = ent.y, oz = ent.z;
    const riders = isU ? [] : st.objs.filter(o => !o.gone && o !== ent && o.x === ox && o.y === oy && o.z > oz && o.k !== 'plate');
    ent.x = x; ent.y = y; ent.z = Math.max(z, -99);
    const moved = path.length > 1;
    if (moved) {
      const sl = { k: 'slide', ref: ref2, path, roll, slip: slip || iceUsed };
      evs.push(hits.length ? { k: 'group', evs: [sl].concat(hits), roll: true } : sl);
    }
    if (rollKills) {
      st.stats.bestRoll = Math.max(st.stats.bestRoll || 0, rollKills);
      if (rollKills >= 3 && st.rollSay && !st.said.bigRoll) {
        st.said.bigRoll = 1;
        for (const s of st.rollSay) { const who = speaker(st, s[0]); if (who) evs.push({ k: 'say', who, text: sayText(s, who) }); }
      }
    }
    if (moved) for (const rd of riders) {
      const dz = rd.z - oz;
      rd.x = x; rd.y = y; rd.z = ent.z + dz;
      evs.push({ k: 'slide', ref: { o: rd.id }, path: path.map(q => [q[0], q[1], q[2] + dz]), roll: false, slip: true, rider: true });
      if (end === 'void') { rd.gone = true; evs.push({ k: 'lost', ref: { o: rd.id } }); }
    }
    if (end === 'sink') for (const rd of riders) { rd.z = st.h[idx(st, x, y)]; }
    if (end === 'bump') {
      evs.push({ k: 'bump', ref: ref2, dir, x, y, z });
      if (isU) hurt(st, ent, 1, 'bump', evs, credit);
      // 転がる物：当てた傷はもう入っている／勢いがなければ傷なし（ぶつかって止まっただけ）
      if (bumpInto && bumpInto.team && isFoe(bumpInto) && !roll) hurt(st, bumpInto, 1, 'bump', evs, credit);
    }
    if (end === 'void') {
      if (isU) ko(st, ent, 'void', evs, credit); else ent.gone = true;
      evs.push({ k: 'lost', ref: ref2 });
    }
    if (end === 'drown') ko(st, ent, 'drown', evs, credit);
    if (end === 'sink') sink(st, ent, evs, credit);
    if (end === 'fall') { const fd = ent._fallDmg; delete ent._fallDmg; hurt(st, ent, fd, 'fall', evs, credit); delete ent._drop; }
    if (!isU && end !== 'void' && end !== 'sink') afterLand(st, ent, evs, credit);
    if (isU && !ent.ko) ent.z = standZ(st, ent.x, ent.y, ent);
    return { end, path, moved: path.length - 1, iceUsed, crushed, rollKills, rollHit, noMomentum, fromZ: path[0][2] };
  }
  function addWho(credit, w) { if (credit && credit.who.indexOf(w) < 0) { credit.who.push(w); credit.combo = true; } }

  // how: 'push'（押す・既定）／'pull'（引き鉤）
  function finishPushCaption(st, ent, isU, r, credit, how) {
    const name = isU ? ENEMY[ent.k].name : objName(ent);
    const pull = how === 'pull';
    const end = r.end, moved = r.moved, iceUsed = r.iceUsed;
    let t = '';
    if (end === 'ko') t = name + 'を押して、倒した';
    else if (end === 'void' && iceUsed && moved > 1) t = name + 'は氷の上をすべって、谷底へ落ちていった';
    else if (end === 'void') t = name + 'は谷底へ落ちていった';
    else if (end === 'drown') t = name + 'は水に沈んだ';
    else if (end === 'sink' && credit.sinkLabel) t = credit.sinkLabel;
    else if (end === 'sink' && iceUsed && moved > 1) t = name + 'は氷の上をすべり、水に沈んで飛び石になった';
    else if (end === 'sink') t = name + 'が水に沈んで、飛び石になった';
    else if (end === 'rock') t = name + 'を落として、下の敵にぶつけた';
    else if (end === 'fall') t = ent.ko ? name + 'は段の下へ落ちて倒れた' : (credit.flip ? name + 'は段の下へ落ちて、ひっくり返った！' : name + 'は段の下へ落ちた');
    else if (end === 'bump') t = moved ? name + 'はすべって、ぶつかった' : name + 'はぶつかって止まった';
    else if (end === 'plate') t = credit.plateLabel || (name + 'が床の仕掛けにのった');
    else if (!isU && r.path && r.path.length > 1 && r.path[0][2] > ent.z) t = (pull ? '引き鉤で引くと、' : '') + name + 'が段の下へ落ちて、足場になった';
    else if (iceUsed && moved > 1) t = name + 'は氷の上をすべっていった';
    else t = name + (pull ? 'を引きよせた' : 'を押した');
    const rc = rollCaption(st, ent, isU, r, '');
    if (rc) t = rc;
    if (isU && ent.ko && end === 'bump') t = name + 'はぶつかって倒れた';
    if (credit.flip && end !== 'fall') t += flipNote(credit);
    credit.text = t;
  }
  // 転がる大岩の字幕。pre は「爆風で」など
  function rollCaption(st, ent, isU, r, pre) {
    if (isU || ent.k !== 'boulder') return '';
    const name = objName(ent);
    let t = '';
    if (r.rollKills) t = pre + name + 'が転がり、' + r.rollKills + '体をなぎ倒した' + (r.rollHit ? '。' + ENEMY[r.rollHit.k].name + 'に当たって止まった' : '');
    else if (r.rollHit) t = pre + name + 'が転がって、' + ENEMY[r.rollHit.k].name + 'に当たった';
    else if (r.noMomentum) t = pre + name + 'は、となりの' + ENEMY[r.noMomentum.k].name + 'にぶつかって止まった（転がる勢いがないと、傷は入らない）';
    const cap = st.capAt && st.capAt[ent.x + ',' + ent.y];
    if (cap && r.moved && !r.rollKills && !r.rollHit) t = cap;
    return t;
  }
  function flipNote(credit) {
    return '（ひっくり返った！）';   // はじめてのときの「次の手番の終わりまで…」は、画面の見出しで出す
  }

  function objName(o) {
    return { crate: '木箱', block: '石のブロック', iceblock: '氷のかたまり', boulder: '大岩', pillar: '石柱', rubble: 'がれき', icicle: 'つらら', lever: 'レバー', chime: '風鳴り石' }[o.k] || '物';
  }

  function sink(st, o, evs, credit) {
    const i = idx(st, o.x, o.y);
    o.gone = true;
    st.t[i] = o.k === 'iceblock' ? 'i' : o.k === 'crate' ? 'c' : 'k';
    st.by[i] = credit && credit.who ? credit.who[0] : 'gard';
    evs.push({ k: 'sink', ref: { o: o.id }, x: o.x, y: o.y, z: st.h[i], t: st.t[i] });
    for (const p of st.objs) {
      if (p.k === 'plate' && !p.done && p.x === o.x && p.y === o.y) { p.done = true; evs.push({ k: 'plate', o: p.id }); if (p.label && credit) credit.sinkLabel = p.label; runOn(st, p.on, evs, credit); }
    }
  }
  function afterLand(st, o, evs, credit) {
    if (o.gone) return;
    for (const p of st.objs) {
      if (p.k === 'plate' && !p.done && p.x === o.x && p.y === o.y) {
        p.done = true;
        evs.push({ k: 'plate', o: p.id });
        if (p.label && credit) credit.plateLabel = p.label;
        runOn(st, p.on, evs, credit);
      }
    }
  }

  function topple(st, g, p, dir, evs, credit) {
    const [dx, dy] = DIRS[dir];
    const cells = [];
    for (let k = 1; k <= 3; k++) {
      const x = p.x + dx * k, y = p.y + dy * k;
      if (!inside(st, x, y)) break;
      const s = surface(st, x, y, p);
      const top = s.block ? Math.max(s.z, s.blockTop) : s.z;
      if (!s.void && top > p.z) break;
      cells.push([x, y]);
    }
    p.gone = true;
    const beams = [];
    for (const [x, y] of cells) {
      const occ = unitAt(st, x, y);
      if (occ && isFoe(occ)) hurt(st, occ, ENEMY[occ.k].armor ? 2 : 99, 'crush', evs, credit);
      const b = { id: 'o' + (st.seq++), k: 'beam', x, y, z: p.z, dir, by: 'gard' };
      st.objs.push(b); beams.push(b);
    }
    evs.push({ k: 'topple', o: p.id, dir, x: p.x, y: p.y, z: p.z, beams: clone(beams) });
    credit.text = cells.length >= 2 ? '石柱が倒れて、橋になった' : '石柱が倒れた';
    if (credit.kills) credit.text = '石柱が倒れて、' + credit.kills + '体を押しつぶした';
    if (credit.flip) credit.text += flipNote(credit);
  }

  // ---------- トビ：発破 ----------
  function doBlast(st, t, I, evs, credit) {
    const sf = surface(st, I.x, I.y);
    const tz = sf.void ? 0 : sf.block ? sf.blockTop - 1 : sf.z;
    const set = blastSet(st, I.x, I.y);
    evs.push({ k: 'act', id: t.id, verb: 'blast', tx: I.x, ty: I.y, tz });
    evs.push({ k: 'bomb', from: [t.x, t.y, t.z], to: [I.x, I.y, tz] });
    const big = !!st.up.bigbomb;
    evs.push({ k: 'boom', x: I.x, y: I.y, z: tz, big });
    let shattered = 0, flung = 0, felled = 0;
    const flungNames = [], flungEnds = [];
    let rolled = null;
    if (set.center && !set.center.ko) {
      const c = set.center;
      let n = 2 + (big ? 1 : 0);
      if (c.frozen > 0) { n++; if (c.frozenBy === 'sena') addWho(credit, 'sena'); }
      hurt(st, c, n, 'blast', evs, credit);
    }
    for (const o of set.cracks) {
      o.gone = true; shattered++;
      const out = { k: 'shatter', o: o.id, x: o.x, y: o.y, z: o.z, h: o.h || OBJ_H.crack };
      if (o.rubble !== false) {
        const rb = { id: 'o' + (st.seq++), k: 'rubble', x: o.x, y: o.y, z: o.z, rh: o.rh || 1, by: 'tobi' };
        st.objs.push(rb); out.rb = clone(rb);
      }
      evs.push(out);
      if (o.on) runOn(st, o.on, evs, credit);
      if (o.label) credit.crackLabel = o.label;
    }
    // つらら（爆心か上下左右）が落ちる
    const icTexts = [];
    for (const o of set.icicles) {
      if (o.gone) continue;
      const un = unitAt(st, o.x, o.y);
      if (un && !isFoe(un)) continue;
      icTexts.push(icicleCaption(dropIcicle(st, o, evs, credit)));
    }
    // 外側から順に押す（ぶつかり合いを減らす）
    const list = set.push.slice();
    for (const it of list) {
      const isU = !!it.ref.u;
      const ent = isU ? unitById(st, it.ref.u) : objById(st, it.ref.o);
      if (!ent || ent.gone || ent.ko) continue;
      const r = pushEntity(st, ent, isU, it.dir, evs, credit, { dist: big ? 2 : 1, why: 'blast' });
      if (r.moved) { flung++; flungNames.push(isU ? ENEMY[ent.k].name : objName(ent)); flungEnds.push(r.end); }
      const rc = rollCaption(st, ent, isU, r, '爆風で');
      if (rc) rolled = rc;
      if (isU && ent.ko) felled++;
    }
    // 深い雪は吹き飛んで、土になる（05 3.1）
    const snow = set.snow.filter(([x, y]) => st.t[idx(st, x, y)] === 'n');
    if (snow.length) { for (const [x, y] of snow) st.t[idx(st, x, y)] = 'd'; evs.push({ k: 'snowClear', cells: snow }); }
    st.stats.blasts = (st.stats.blasts || 0) + 1;
    let tx = '';
    if (shattered && credit.crackLabel) tx = credit.crackLabel;
    else if (shattered) tx = 'ひび割れた岩を砕いた。がれきは足場になる';
    const OUTCOME = { drown: '。水に沈んだ', void: '。谷へ落ちていった', sink: '。水に沈んで、飛び石になった', fall: '。段の下へ落ちた', rock: '。下の敵にぶつかった' };
    if (credit.kills && !(flung === 1 && credit.kills === 1 && OUTCOME[flungEnds[0]])) tx = (tx ? tx + '。' : '') + '爆風で ' + credit.kills + '体を倒した';
    else if (flung === 1 && OUTCOME[flungEnds[0]]) tx = (tx ? tx + '。' : '') + '爆風で ' + flungNames[0] + 'を吹き飛ばした' + OUTCOME[flungEnds[0]];
    else if (flung) tx = (tx ? tx + '。' : '') + '爆風で ' + (flung === 1 ? flungNames[0] + 'を' : flung + 'つを') + '吹き飛ばした';
    if (rolled) tx = rolled;
    if (icTexts.length) tx = (tx && !credit.kills ? tx + '。' : '') + icTexts.join('。');
    if (credit.plateLabel) tx = (tx ? tx + '。' : '') + credit.plateLabel;
    if (credit.sinkLabel) tx = (tx ? tx + '。' : '') + credit.sinkLabel;
    if (credit.flip) tx += flipNote(credit);
    if (credit.clang && !credit.flip && !credit.kills && !flung) tx = '甲羅にはじかれた。落とすか、ひっくり返せば効く';
    if (!tx && snow.length) tx = '深い雪が吹き飛んで、土が出た';
    if (!tx) tx = set.center ? ENEMY[set.center.k].name + 'に発破が命中した' : '発破した';
    credit.text = tx;
    credit.blast = true;
  }

  // ---------- リコ：射る・鉤縄 ----------
  function doShoot(st, r, ref, evs, credit) {
    if (ref.u) {
      const t = unitById(st, ref.u);
      let n = 2 + (st.up.bow ? 1 : 0);
      const high = r.z >= t.z + 2;
      if (high) n++;
      const shatter = t.frozen > 0;
      if (shatter) { n++; if (t.frozenBy === 'sena') addWho(credit, 'sena'); }
      evs.push({ k: 'act', id: r.id, verb: 'shoot', tx: t.x, ty: t.y, tz: t.z });
      evs.push({ k: 'arrow', from: [r.x, r.y, r.z], to: [t.x, t.y, t.z], hit: true });
      hurt(st, t, n, high ? 'arrowHigh' : 'arrow', evs, credit);
      if (credit.clang) { credit.text = '矢は甲羅にはじかれた。ひっくり返せば効く（2段上からなら、すきまに傷1）'; return; }
      if (credit.gap && !(t.flipped > 0)) { credit.text = t.ko ? '高所からの矢が、甲羅のすきまに刺さった。倒れた' : 'すきまに刺さった（傷' + (1 + (st.up.bow2 ? 1 : 0)) + '）。ひっくり返せば、もっと通る'; return; }
      credit.text = ENEMY[t.k].name + 'を射た' + (high ? '（高所から）' : '') + (shatter ? '（凍って砕けやすい）' : '') + (t.flipped > 0 && ENEMY[t.k].armor ? '（お腹に通った）' : '') + (t.ko ? '。倒れた' : '');
      return;
    }
    const o = objById(st, ref.o);
    if (o.k === 'icicle') {
      const hz = o.z + ICICLE_Z;
      evs.push({ k: 'act', id: r.id, verb: 'shoot', tx: o.x, ty: o.y, tz: hz });
      evs.push({ k: 'arrow', from: [r.x, r.y, r.z], to: [o.x, o.y, hz], hit: true });
      const res = dropIcicle(st, o, evs, credit);
      credit.text = icicleCaption(res);
      return;
    }
    evs.push({ k: 'act', id: r.id, verb: 'shoot', tx: o.x, ty: o.y, tz: o.z });
    evs.push({ k: 'arrow', from: [r.x, r.y, r.z], to: [o.x, o.y, o.z], hit: true, target: o.id });
    o.hit = true;
    evs.push({ k: 'target', o: o.id });
    credit.text = o.label || '的を射ぬいた';
    runOn(st, o.on, evs, credit);
  }

  function doRope(st, r, oid, evs, credit) {
    const a = objById(st, oid);
    const from = [r.x, r.y, r.z];
    st.links = st.links.filter(L => L.o !== a.id);
    const L = { k: 'rope', a: [r.x, r.y], b: [a.x, a.y], o: a.id, by: 'riko' };
    st.links.push(L);
    evs.push({ k: 'act', id: r.id, verb: 'rope', tx: a.x, ty: a.y, tz: a.z });
    evs.push({ k: 'rope', from, to: [a.x, a.y, surface(st, a.x, a.y).z], link: clone(L) });
    r.face = faceTo(r.x, r.y, a.x, a.y, r.face);
    r.x = a.x; r.y = a.y; r.z = standZ(st, a.x, a.y, r);
    evs.push({ k: 'zip', id: r.id, from, to: [r.x, r.y, r.z] });
    credit.text = '鉄の輪に鉤縄をかけて渡った。縄は仲間の道になる';
    collectAt(st, r, evs);
    if (st.mode === 'explore') triggersAt(st, evs);
  }

  // ---------- リコ：引き鉤（05 2.2） ----------
  function doPull(st, r, I, evs, credit, p) {
    const ref = I.ref;
    const ent = ref.u ? unitById(st, ref.u) : objById(st, ref.o);
    const tz = ref.u ? ent.z + 1 : ent.z + (OBJ_H[ent.k] || 1) * 0.6;
    evs.push({ k: 'act', id: r.id, verb: 'pull', tx: ent.x, ty: ent.y, tz: ent.z });
    evs.push({ k: 'hook', from: [r.x, r.y, r.z], to: [ent.x, ent.y, tz] });
    st.stats.pulls = (st.stats.pulls || 0) + 1;
    if (ent.k === 'lever') {
      ent.done = true;
      evs.push({ k: 'lever', o: ent.id });
      credit.text = ent.label || 'レバーを引いた';
      runOn(st, ent.on, evs, credit);
      for (const s of ent.say || []) evs.push({ k: 'say', who: s[0], text: s[1] });
      return;
    }
    const dir = p && p.pullDir !== undefined ? p.pullDir : faceTo(ent.x, ent.y, r.x, r.y, 0);
    const res = pushEntity(st, ent, !!ref.u, dir, evs, credit, { dist: PULL_MOVE, why: 'pull', noHit: true, stopAt: [r.x, r.y] });
    finishPushCaption(st, ent, !!ref.u, res, credit, 'pull');
  }

  // ---------- ナギ：あおぐ（05 2.1） ----------
  function doWaft(st, n, I, evs, credit, p) {
    const ref = I.ref;
    const isU = !!ref.u;
    const ent = isU ? unitById(st, ref.u) : objById(st, ref.o);
    st.stats.wafts = (st.stats.wafts || 0) + 1;
    if (!isU && ent.k === 'chime') {
      // 風鳴り石：となりからあおぐと鳴る（一度きり）
      evs.push({ k: 'act', id: n.id, verb: 'waft', tx: ent.x, ty: ent.y, tz: ent.z });
      evs.push({ k: 'gust', from: [n.x, n.y, n.z], to: [ent.x, ent.y, ent.z], dir: faceTo(n.x, n.y, ent.x, ent.y, 0) });
      ent.rung = true;
      evs.push({ k: 'chime', o: ent.id, x: ent.x, y: ent.y, z: ent.z });
      credit.text = ent.label || '風鳴り石が鳴った';
      runOn(st, ent.on, evs, credit);
      return;
    }
    const wi = waftInfo(st, ref, n.id);
    const dir = I.dir;
    const name = isU ? (isHero(ent) ? HERO[ent.k].name : ENEMY[ent.k].name) : objName(ent);
    evs.push({ k: 'act', id: n.id, verb: 'waft', tx: ent.x, ty: ent.y, tz: ent.z, dir });
    evs.push({ k: 'gust', from: [n.x, n.y, n.z], to: [ent.x, ent.y, ent.z], dir });
    if (isU && isHero(ent)) addWho(credit, ent.id);
    // 凍った重い敵：浮かずに、その向きへ1升すべりだして、止まるまですべる（05 1.5）
    if (wi.slide) {
      if (ent.frozenBy === 'sena') addWho(credit, 'sena');
      const r = pushEntity(st, ent, true, dir, evs, credit, { noHit: true, why: 'waft' });
      finishPushCaption(st, ent, true, r, credit, 'push');
      credit.text = credit.text.replace('を押した', 'は風に押されて、すべりだした');
      return;
    }
    // 飛ぶ敵：2D 升まで、ぶつかるまで流される。壁・高い物にぶつかれば傷1。地図の外へ出れば飛び去る
    if (wi.flyer) {
      const D2 = waftDist(st) * 2;
      const [dx, dy] = DIRS[dir];
      let x = ent.x, y = ent.y, end = 'stop';
      const path = [[x, y, ent.z]];
      for (let k = 0; k < D2; k++) {
        const nx = x + dx, ny = y + dy;
        if (!inside(st, nx, ny)) { end = 'away'; path.push([nx, ny, ent.z + 1]); break; }
        const s = surface(st, nx, ny);
        if (s.wall || (s.block && s.blockTop > ent.z + 1) || unitAt(st, nx, ny, ent) || (!s.void && !s.water && s.z > ent.z + 1)) { end = 'bump'; break; }
        x = nx; y = ny; path.push([x, y, ent.z]);
      }
      if (path.length > 1) evs.push({ k: 'slide', ref: { u: ent.id }, path, slip: true, wind: true });
      if (end === 'away') {
        ent.ko = true; ent.gone = true;
        evs.push({ k: 'ko', id: ent.id, how: 'away' });
        st.stats.foeKo.push({ k: ent.k, how: 'away' });
        credit.kills++; st.stats.kills[credit.who[0]] = (st.stats.kills[credit.who[0]] || 0) + 1;
        st.stats.waftKo = (st.stats.waftKo || []).concat([{ k: ent.k, how: 'away' }]);
        credit.text = name + 'は風に流されて、飛び去った';
        return;
      }
      ent.x = x; ent.y = y;
      if (end === 'bump') { evs.push({ k: 'bump', ref: { u: ent.id }, dir, x, y, z: ent.z }); hurt(st, ent, 1, 'bump', evs, credit); }
      credit.text = ent.ko ? name + 'は風に流されて、ぶつかって倒れた' : end === 'bump' ? name + 'は風に流されて、ぶつかった' : name + 'は風に流された';
      return;
    }
    const D = waftDist(st);
    const dest = waftDest(st, ent, wi.kind, dir, D, [n.x, n.y]);
    if (!dest.land) { credit.text = 'あおげなかった（' + dest.why + '）'; return; }
    const from = [ent.x, ent.y, ent.z];
    const z0 = ent.z;
    const crossed = (() => { const [dx, dy] = DIRS[dir]; let v = '', w = ''; for (let k = 1; k < dest.d; k++) { const s = surface(st, ent.x + dx * k, ent.y + dy * k, isU ? null : ent); if (s.void) v = '谷'; else if (s.water) w = '水'; } return v || w; })();
    const toZ = dest.land === 'lost' || dest.land === 'void' ? z0 - 14 : dest.land === 'hit' ? dest.foe.z + 1 : dest.z;
    const ref2 = isU ? { u: ent.id } : { o: ent.id };
    evs.push({ k: 'waft', ref: ref2, from, to: [dest.x, dest.y, toZ], land: dest.land, arc: 1.4 + Math.max(0, (toZ - z0)) * 0.6 + (dest.d - 1) * 0.3 });
    const up = dest.z !== undefined && dest.z > z0 ? dest.z - z0 : 0;
    const how = up ? up + '段上へ' : crossed ? crossed + 'を越えて' : dest.d + '升先へ';
    // ---- 仲間 ----
    if (wi.kind === 'h') {
      ent.x = dest.x; ent.y = dest.y; ent.z = dest.z;
      credit.text = 'ナギの風にのって、' + name + 'が' + (crossed ? crossed + 'を越えた' : up ? up + '段上へ下りた' : 'ふわりと' + dest.d + '升先へ下りた');
      collectAt(st, ent, evs);
      if (st.mode === 'explore') triggersAt(st, evs);
      return;
    }
    // ---- 敵 ----
    if (wi.kind === 'e') {
      if (ent.frozen > 0 && ent.frozenBy === 'sena') addWho(credit, 'sena');
      if (dest.land === 'void') {
        ent.x = dest.x; ent.y = dest.y;
        ko(st, ent, 'void', evs, credit); evs.push({ k: 'lost', ref: ref2 });
        noteWaftKo(st, ent, 'void', evs);
        credit.text = name + 'を' + (crossed ? crossed + 'の上へ' : '') + 'あおいで、谷へ落とした';
        return;
      }
      if (dest.land === 'drown') {
        ent.x = dest.x; ent.y = dest.y; ent.z = dest.z;
        ko(st, ent, 'drown', evs, credit);
        noteWaftKo(st, ent, 'drown', evs);
        credit.text = name + 'をあおいで、水に沈めた';
        return;
      }
      ent.x = dest.x; ent.y = dest.y; ent.z = dest.z;
      const drop = z0 - dest.z;
      // 2段以上低い升へ下りれば落下の傷。凍っていれば+1（落差がなくても1。05 2.1）
      const dmg = fallDmg(drop) + (ent.frozen > 0 ? 1 : 0);
      if (dmg) hurt(st, ent, dmg, 'fall', evs, credit);
      if (ent.ko) { noteWaftKo(st, ent, 'fall', evs); credit.text = name + 'をあおいで、' + (drop >= 2 ? '段の下へ落とした。倒れた' : '倒した'); return; }
      if (dest.land === 'ice') { const r = pushEntity(st, ent, true, dir, evs, credit, { noHit: true, why: 'waft' }); if (ent.ko) noteWaftKo(st, ent, r.end, evs); credit.text = name + 'をあおぐと、氷の上をすべっていった' + (r.end === 'void' ? '。谷へ落ちた' : r.end === 'drown' ? '。水に沈んだ' : ''); return; }
      credit.text = name + 'を' + how + '飛ばした' + (drop >= 2 ? '（落下の傷 ' + dmg + '）' : dmg ? '（凍っていて、砕けやすい。傷 ' + dmg + '）' : '');
      return;
    }
    // ---- 物 ----
    if (dest.land === 'lost') { ent.x = dest.x; ent.y = dest.y; ent.gone = true; evs.push({ k: 'lost', ref: ref2 }); credit.text = name + 'は谷へ落ちていった'; return; }
    if (dest.land === 'sink') { ent.x = dest.x; ent.y = dest.y; ent.z = dest.z; sink(st, ent, evs, credit); credit.text = credit.sinkLabel || name + (ent.k === 'iceblock' ? 'が水に落ちて、氷の床になった' : 'が水に沈んで、飛び石になった'); return; }
    if (dest.land === 'hit') {
      const foe = dest.foe, fname = ENEMY[foe.k].name;
      hurt(st, foe, 3, 'drop', evs, credit);
      if (foe.ko) {
        const s = surface(st, dest.x, dest.y, ent);
        ent.x = dest.x; ent.y = dest.y; ent.z = s.z;
        evs.push({ k: 'fall', ref: ref2, from: [dest.x, dest.y, toZ], to: [dest.x, dest.y, s.z], drop: Math.max(0, toZ - s.z) });
        afterLand(st, ent, evs, credit);
        credit.text = name + 'が' + fname + 'に当たった。倒れた';
      } else {
        ent.gone = true;
        evs.push({ k: 'break', ref: ref2, x: dest.x, y: dest.y, z: toZ });
        credit.text = name + 'が' + fname + 'に当たった（傷3）。' + name + 'は砕けた' + (credit.flip ? '（ひっくり返った！）' : '');
      }
      return;
    }
    ent.x = dest.x; ent.y = dest.y; ent.z = dest.z;
    if (dest.land === 'ice') {
      const r = pushEntity(st, ent, false, dir, evs, credit, { noHit: true, why: 'waft' });
      credit.text = name + 'は氷の上に下りて、すべっていった' + (r.end === 'sink' ? '。水に沈んで、飛び石になった' : r.end === 'void' ? '。谷へ落ちていった' : '');
      if (r.end !== 'void' && r.end !== 'sink') afterLand(st, ent, evs, credit);
      return;
    }
    afterLand(st, ent, evs, credit);
    credit.text = credit.plateLabel || (name + 'を' + how + '運んだ' + (up ? '（あおぐと2段上まで上がる）' : ''));
  }
  // あおいで倒した記録（印 m8①）と、はじめて雪狼を谷へ落としたときのひとこと
  function noteWaftKo(st, ent, how, evs) {
    st.stats.waftKo = (st.stats.waftKo || []).concat([{ k: ent.k, how }]);
    if (ent.k === 'wolf' && (how === 'void' || how === 'drown') && st.waftSay && !st.said.waftWolf) { st.said.waftWolf = 1; sayLines(st, st.waftSay, evs); }
  }

  // ---------- つらら（05 3.2） ----------
  // 落ちると：その升の敵に傷3（上から落ちた物）。敵がいない・倒れた → 水なら氷の飛び石、床なら氷のかたまり。敵が生き残れば砕ける
  function dropIcicle(st, o, evs, credit) {
    o.gone = true;
    const i = idx(st, o.x, o.y);
    const sf = surface(st, o.x, o.y);
    const e = unitAt(st, o.x, o.y);
    const foe = e && isFoe(e) ? e : null;
    const z1 = foe ? foe.z + 1 : sf.void ? o.z - 14 : sf.water ? st.h[i] : sf.z;
    evs.push({ k: 'icicle', o: o.id, x: o.x, y: o.y, z0: o.z + ICICLE_Z, z1 });
    st.stats.icicles = (st.stats.icicles || 0) + 1;
    const sleeping = foe && !foe.active && st.mode === 'explore';
    let res = null;
    if (foe) {
      hurt(st, foe, 3, 'drop', evs, credit);
      if (foe.ko) st.stats.icicleKo = (st.stats.icicleKo || 0) + 1;
      if (!foe.ko) { res = 'shatter'; evs.push({ k: 'iceShatter', x: o.x, y: o.y, z: foe.z + 1 }); }
    }
    if (!res) {
      if (sf.void) res = 'lost';
      else if (sf.water) { st.t[i] = 'i'; st.by[i] = 'riko'; evs.push({ k: 'freezeCells', cells: [[o.x, o.y]], by: 'riko' }); res = 'floe'; }
      else if (sf.stand && !sf.block) {
        const b = { id: 'o' + (st.seq++), k: 'iceblock', x: o.x, y: o.y, z: sf.z, by: 'riko' };
        st.objs.push(b); evs.push({ k: 'iceblock', o: clone(b) });
        afterLand(st, b, evs, credit);
        res = 'block';
      } else { res = 'shatter'; evs.push({ k: 'iceShatter', x: o.x, y: o.y, z: sf.z }); }
    }
    if (res !== 'shatter' && res !== 'lost') for (const s of o.say || []) { const who = speaker(st, s[0]); if (who) evs.push({ k: 'say', who, text: sayText(s, who) }); }
    // 眠っている敵に当たれば、その組の戦いが始まる
    if (sleeping && st.mode === 'explore') startCombat(st, foe.grp, evs);
    return { res, foe, name: foe ? ENEMY[foe.k].name : '' };
  }
  function icicleCaption(r) {
    const left = r.res === 'block' ? '（氷のかたまりが残った）' : r.res === 'floe' ? '（氷の飛び石が残った）' : '';
    if (r.foe && r.foe.ko) return 'つららが' + r.name + 'に当たった。倒れた' + left;
    if (r.foe) return 'つららが' + r.name + 'に当たった（傷3）。つららは砕けた' + (r.foe.flipped > 0 ? '（ひっくり返った！）' : '');
    if (r.res === 'floe') return 'つららが落ちて、氷の飛び石になった';
    if (r.res === 'block') return 'つららが落ちて、氷のかたまりになった（のれる・足場になる）';
    if (r.res === 'lost') return 'つららは谷へ落ちていった';
    return 'つららが落ちて、砕けた';
  }

  // ---------- セナ：凍らせる ----------
  function doFreeze(st, s, I, evs, credit, p) {
    if (I.ref && I.ref.u) {
      const t = unitById(st, I.ref.u);
      evs.push({ k: 'act', id: s.id, verb: 'freeze', tx: t.x, ty: t.y, tz: t.z });
      evs.push({ k: 'frost', from: [s.x, s.y, s.z], to: [t.x, t.y, t.z] });
      if (t.k === 'slime') {
        t.ko = true; t.gone = true;
        const b = { id: 'o' + (st.seq++), k: 'iceblock', x: t.x, y: t.y, z: t.z, by: 'sena' };
        st.objs.push(b);
        evs.push({ k: 'ko', id: t.id, how: 'ice' });
        evs.push({ k: 'iceblock', o: clone(b) });
        credit.kills++; st.stats.kills.sena = (st.stats.kills.sena || 0) + 1;
        credit.text = '粘体が凍って、氷のかたまりになった（押せる・のれる）';
        return;
      }
      // すきの間の甲羅：凍らせても、すきは解けない。止める効果はなく、霜の傷（1＋お腹の1）だけが入る（05 1.1）
      if (ENEMY[t.k].armor && t.flipped > 0) {
        hurt(st, t, 1, 'frost', evs, credit);
        credit.text = t.ko ? '霜がお腹に通って、' + ENEMY[t.k].name + 'は倒れた' : '霜がお腹に通った（すきの間は、凍らせても止まらない）';
        return;
      }
      t.frozen = 1; t.frozenBy = 'sena'; t.flipped = 0;
      evs.push({ k: 'freezeUnit', id: t.id });
      if (!ENEMY[t.k].armor) hurt(st, t, 1, 'frost', evs, credit);
      if (!t.ko && ENEMY[t.k].fly) {
        const sf = surface(st, t.x, t.y);
        const from = [t.x, t.y, t.z];
        if (sf.void) { evs.push({ k: 'fall', ref: { u: t.id }, from, to: [t.x, t.y, t.z - 14], drop: 14 }); ko(st, t, 'void', evs, credit); credit.text = ENEMY[t.k].name + 'が凍って、谷へ落ちた'; return; }
        if (sf.water) { evs.push({ k: 'fall', ref: { u: t.id }, from, to: [t.x, t.y, sf.z], drop: t.z - sf.z }); ko(st, t, 'drown', evs, credit); credit.text = ENEMY[t.k].name + 'が凍って、水に落ちた'; return; }
        const drop = t.z - sf.z;
        t.z = sf.z;
        if (drop > 0) evs.push({ k: 'fall', ref: { u: t.id }, from, to: [t.x, t.y, sf.z], drop });
        if (drop >= 2) hurt(st, t, fallDmg(drop), 'fall', evs, credit);
        credit.text = ENEMY[t.k].name + 'が凍って、落ちた';
        return;
      }
      if (!t.ko && ENEMY[t.k].swim) {
        const i = idx(st, t.x, t.y);
        if (st.t[i] === 'w') { st.t[i] = 'i'; st.by[i] = 'sena'; evs.push({ k: 'freezeCells', cells: [[t.x, t.y]], by: 'sena' }); ko(st, t, 'ice', evs, credit); credit.text = '水霊ごと、水を凍らせた'; return; }
      }
      credit.text = t.ko ? ENEMY[t.k].name + 'は凍りついて倒れた' : ENEMY[t.k].name + 'を凍らせた（次の手番うごけない・押すとすべる）';
      return;
    }
    if (I.ref && I.ref.o) {
      const f = objById(st, I.ref.o);
      if (f.k === 'crystal') {
        evs.push({ k: 'act', id: s.id, verb: 'freeze', tx: f.x, ty: f.y, tz: f.z });
        evs.push({ k: 'frost', from: [s.x, s.y, s.z], to: [f.x, f.y, f.z + 1.5] });
        f.lit = true;
        evs.push({ k: 'crystal', o: f.id });
        credit.text = f.label || '水晶が凍りついて、青く光った';
        runOn(st, f.on, evs, credit);
        return;
      }
      evs.push({ k: 'act', id: s.id, verb: 'freeze', tx: f.bx, ty: f.by, tz: f.bz });
      evs.push({ k: 'frost', from: [s.x, s.y, s.z], to: [f.bx, f.by, f.bz + 1] });
      f.frozen = true;
      if (f.final) credit.climax = true;
      const L = { k: 'ice', a: [f.bx, f.by], b: [f.x, f.y], o: f.id, by: 'sena' };
      st.links.push(L);
      const cells = freezeCells(st, f.bx, f.by);
      for (const [x, y] of cells) { const i = idx(st, x, y); st.t[i] = 'i'; st.by[i] = 'sena'; }
      evs.push({ k: 'freezeFall', o: f.id, link: clone(L), cells, final: !!f.final });
      credit.text = f.label || '滝が凍って、のぼれる氷の段になった';
      if (f.frozenSay) for (const s2 of f.frozenSay) evs.push({ k: 'say', who: s2[0], text: s2[1] });
      return;
    }
    if (p && p.make) {
      const z = surface(st, I.x, I.y).z;
      evs.push({ k: 'act', id: s.id, verb: 'freeze', tx: I.x, ty: I.y, tz: z });
      evs.push({ k: 'frost', from: [s.x, s.y, s.z], to: [I.x, I.y, z] });
      const b = { id: 'o' + (st.seq++), k: 'iceblock', x: I.x, y: I.y, z, by: 'sena' };
      st.objs.push(b);
      evs.push({ k: 'iceblock', o: clone(b), made: true });
      credit.text = '氷のかたまりをつくった（のれる・押すとすべる）';
      afterLand(st, b, evs, credit);
      return;
    }
    const cells = freezeCells(st, I.x, I.y);
    evs.push({ k: 'act', id: s.id, verb: 'freeze', tx: I.x, ty: I.y, tz: st.h[idx(st, I.x, I.y)] });
    evs.push({ k: 'frost', from: [s.x, s.y, s.z], to: [I.x, I.y, st.h[idx(st, I.x, I.y)]] });
    for (const [x, y] of cells) { const i = idx(st, x, y); st.t[i] = 'i'; st.by[i] = 'sena'; }
    evs.push({ k: 'freezeCells', cells, by: 'sena', cx: I.x, cy: I.y });
    for (const [x, y] of cells) { const e = unitAt(st, x, y); if (e && isFoe(e) && ENEMY[e.k].swim) ko(st, e, 'ice', evs, credit); }
    credit.text = '水が凍って、歩ける氷の床になった' + (credit.kills ? '（水霊を閉じこめた）' : '');
  }

  // 仕掛けの発動
  function runOn(st, on, evs, credit) {
    if (!on) return;
    for (const cmd of on.split(',')) {
      const [op, id] = cmd.split(':');
      const o = objById(st, id);
      if (op === 'lower' && o) { o.down = true; evs.push({ k: 'lower', o: o.id }); }
      else if (op === 'open' && o) { o.open = true; evs.push({ k: 'open', o: o.id }); }
      else if (op === 'link') { const L = st.links.find(l => l.id === id); if (L) { L.hidden = false; evs.push({ k: 'linkShow', id }); } }
      else if (op === 'flag') { st.flags[id] = true; evs.push({ k: 'flag', id }); }
      else if (op === 'rune') {
        st.flags[id] = true; const n = runeCount(st);
        evs.push({ k: 'rune', id, n });
        const rs = st.runeSay && st.runeSay[n];
        if (rs && !(st.obj.need && n >= st.obj.need)) sayLines(st, rs.map(q => [q[0], typeof q[1] === 'string' ? q[1].split('{n}').join(String(n)) : q[1], q[2]]), evs);
        runeCheck(st, evs);
      }
      else if (op === 'drain') { drain(st, id, evs); }
      else if (op === 'show' && o) { o.hidden = false; evs.push({ k: 'show', o: o.id }); }
      else if (op === 'wake') { if (st.mode === 'explore') startCombat(st, +id, evs); }
    }
  }
  function runeCount(st) { return (st.obj.flags || []).filter(f => st.flags[f]).length; }
  function runeCheck(st, evs) {
    const O = st.obj;
    if (O.k !== 'runes' || st.flags.runesDone) return;
    if (runeCount(st) >= O.need) { st.flags.runesDone = true; if (O.on) runOn(st, O.on, evs, null); evs.push({ k: 'runesDone', label: O.doneLabel || null }); if (O.doneSay) sayLines(st, O.doneSay, evs); }
  }
  function drain(st, id, evs) {
    const cells = [];
    for (const d of st.drains || []) if (d.id === id) for (const [x, y, z] of d.cells) { const i = idx(st, x, y); if (st.t[i] === 'w') { st.t[i] = 'd'; st.h[i] = z; cells.push([x, y, z]); } }
    evs.push({ k: 'drain', cells });
  }

  // ---------- 救助：見つけて、帰り道ができたら荷馬車へ ----------
  function rescueCheck(st, evs) {
    if (st.mode !== 'explore') return;
    const O = st.obj;
    for (const n of st.units) {
      if (n.ko || !(isNpc(n) || n.guest) || n.safe) continue;
      if (!n.found) {
        const near = heroes(st).some(h => !h.ko && !h.guest && Math.abs(h.x - n.x) + Math.abs(h.y - n.y) <= 1 && Math.abs(h.z - n.z) <= 2);
        if (!near) continue;
        n.found = true;
        evs.push({ k: 'found', id: n.id });
        for (const s of n.foundSay || []) evs.push({ k: 'say', who: s[0] === 'self' ? n.id : s[0], text: s[1] });
        if (n.guest) {
          // 足をいためた仲間：その場から働きかけられる（歩けない）
          n.team = 'h'; n.k = n.guest; n.fixed = true; n.mv = 0; n.acted = false;
          const hp = HERO[n.k].hp + st.hpb; n.hp = hp - 2; n.mhp = hp;
          evs.push({ k: 'guest', id: n.id });
        }
        if (n.onFound) runOn(st, n.onFound, evs, null);
        if (st.mode !== 'explore') return;
      }
      if (!n.found || !n.rescue || !O.to) continue;
      // 荷馬車までの道（縄は渡れない）
      const dist = reach(st, n, { ignoreUnits: true });
      let goal = null, gd = 1e9;
      for (const c of O.to) {
        const i = idx(st, c[0], c[1]);
        if (!dist.has(i)) continue;
        if (st.units.some(u => u !== n && !u.ko && (isNpc(u) || u.safe) && u.x === c[0] && u.y === c[1])) continue;
        if (dist.get(i).c < gd) { gd = dist.get(i).c; goal = i; }
      }
      if (goal === null) continue;
      const pth = pathTo(st, dist, goal);
      const xyz = cellsXYZ(st, pth);
      if (xyz.length > 1) evs.push({ k: 'walk', id: n.id, path: xyz, follow: true, slow: true });
      n.x = goal % st.W; n.y = (goal / st.W) | 0; n.z = standZ(st, n.x, n.y, n);
      if (xyz.length > 1) n.face = faceTo(xyz[xyz.length - 2][0], xyz[xyz.length - 2][1], n.x, n.y, n.face);
      n.safe = true;
      evs.push({ k: 'safe', id: n.id, name: n.name });
      for (const s of n.safeSay || []) evs.push({ k: 'say', who: s[0] === 'self' ? n.id : s[0], text: s[1] });
    }
  }
  function rescuees(st) { return st.units.filter(u => (isNpc(u) || u.guest) && u.rescue && !u.ko); }

  // ---------- 目的 ----------
  function objective(st) {
    const O = st.obj || { k: 'none' };
    switch (O.k) {
      case 'kill': { const n = liveEnemies(st).length + (st.waves || []).filter(w => !w.done).reduce((s, w) => s + w.units.length, 0); return { done: n === 0, left: n }; }
      case 'item': return { done: st.items.includes(O.item) };
      case 'rescue': { const r = rescuees(st); const s = r.filter(u => u.safe).length; return { done: r.length > 0 && s === r.length, n: s, of: r.length }; }
      case 'runes': return { done: st.items.includes(O.item) || (!O.item && runeCount(st) >= O.need), n: runeCount(st), of: O.need };
      case 'defend': { const n = liveEnemies(st).length + pendingWaves(st); return { done: n === 0 && st.raid && st.raid.sacks > 0, sacks: st.raid ? st.raid.sacks : 0 }; }
      case 'boss': { const b = st.units.find(u => u.boss); return { done: !!b && b.ko, hp: b ? b.hp : 0 }; }
      default: return { done: false };
    }
  }

  // ---------- 行動のあと ----------
  function postCheck(st, evs, before, credit) {
    if (st.mode === 'explore' && !st.lost && !evs.some(e => e.k === 'combat')) { const woke = wakeCheck(st); if (woke) startCombat(st, woke, evs); }
    if (st.mode === 'combat') {
      const live = liveEnemies(st).filter(e => e.active);
      if (!live.length && !pendingWaves(st)) winCombat(st, evs);
      else if (heroes(st).every(h => h.ko)) { evs.push({ k: 'lose' }); st.lost = true; }
    }
    const after0 = st.mode === 'explore' && before ? partyReach(st) : null;
    if (credit && credit.text && after0 && /が段の下へ落ちて、足場になった$/.test(credit.text)) {
      let fresh0 = 0; for (const k of after0) if (!before.has(k)) fresh0++;
      if (!fresh0) credit.text = credit.text.replace(/が段の下へ落ちて、足場になった$/, 'は段の下へ落ちた。ここでは足場にならない（Z で戻せる）');
    }
    if (credit && credit.text) {
      evs.push({ k: 'caption', who: credit.who.slice(), text: credit.text, combo: credit.combo, kills: credit.kills });
      if (credit.combo) st.stats.combos++;
    }
    if (st.mode === 'explore' && before) {
      const after = after0 || partyReach(st);
      const fresh = [];
      for (const k of after) if (!before.has(k)) fresh.push(k);
      if (fresh.length) {
        const cells = fresh.map(i => [i % st.W, (i / st.W) | 0, surface(st, i % st.W, (i / st.W) | 0).z]);
        const poi = [];
        for (const o of st.objs) {
          if (o.gone) continue;
          if (!['chest', 'anchor', 'target', 'fall', 'crystal', 'crack', 'lever', 'icicle', 'chime'].includes(o.k)) continue;
          if (o.k === 'chime' && o.rung) continue;
          if (o.k === 'chest' && o.open) continue;
          if (o.k === 'target' && o.hit) continue;
          if (o.k === 'crystal' && o.lit) continue;
          if (o.k === 'lever' && o.done) continue;
          let near = false;
          if (o.k === 'chest') near = after.has(idx(st, o.x, o.y)) && cells.some(c => Math.abs(c[0] - o.x) + Math.abs(c[1] - o.y) <= 2);
          else if (o.k === 'anchor') near = heroWith(st, 'rope') && cells.some(c => inRange(c[0], c[1], o.x, o.y, st.up.rope2 ? RANGE.rope2 : RANGE.rope)) && !after.has(idx(st, o.x, o.y));
          else if (o.k === 'target') near = cells.some(c => inRange(c[0], c[1], o.x, o.y, RANGE.shoot));
          else if (o.k === 'fall') near = heroWith(st, 'freeze') && !o.frozen && cells.some(c => inRange(c[0], c[1], o.bx, o.by, RANGE.freeze));
          else if (o.k === 'crystal') near = heroWith(st, 'freeze') && cells.some(c => inRange(c[0], c[1], o.x, o.y, RANGE.freeze));
          else if (o.k === 'crack') near = heroWith(st, 'blast') && cells.some(c => inRange(c[0], c[1], o.x, o.y, RANGE.blast));
          else if (o.k === 'lever') near = heroWith(st, 'pull') && cells.some(c => (c[0] === o.x || c[1] === o.y) && Math.abs(c[0] - o.x) + Math.abs(c[1] - o.y) <= PULL_MAX);
          else if (o.k === 'icicle') near = cells.some(c => inRange(c[0], c[1], o.x, o.y, RANGE.shoot));
          else if (o.k === 'chime') near = heroWith(st, 'waft') && cells.some(c => Math.abs(c[0] - o.x) + Math.abs(c[1] - o.y) === 1);
          if (near) poi.push(o.id);
        }
        evs.push({ k: 'bloom', cells, poi, who: credit ? credit.who.slice() : [] });
        if (credit) credit.big = fresh.length;
      }
    }
    rescueCheck(st, evs);
    if (credit && credit.text) {
      const score = (credit.big || 0) + credit.kills * 6 + (credit.combo ? 8 : 0) + (credit.flip ? 10 : 0) + (credit.climax ? 300 : 0);
      if (score >= 6 && !credit.noMoment) {
        st.moments.push({ sec: st.sec, who: credit.who.slice(), text: credit.text, score, cells: credit.big || 0, kills: credit.kills });
        st.moments.sort((a, b) => b.score - a.score);
        if (st.moments.length > 12) st.moments.length = 12;
      }
    }
    if (!st.flags.cleared && !st.lost && objective(st).done) { st.flags.cleared = true; evs.push({ k: 'cleared' }); }
  }

  // len: その戦いにかかった手番（敵の手番のあとで終わったときは、その手番まで）
  function winCombat(st, evs, len) {
    st.mode = 'explore';
    st.stats.fightLen = st.stats.fightLen || {};
    st.stats.fightLen[st.grp] = len === undefined ? st.turn : len;
    for (const h of heroes(st)) { h.ko = false; h.hp = h.mhp; h.acted = false; h.mv = h.fixed ? 0 : movOf(h); h.frozen = 0; }
    evs.push({ k: 'win', grp: st.grp, turns: st.stats.fightLen[st.grp] });
    st.flags['won' + st.grp] = true;
    const def = st.winSay && st.winSay[st.grp];
    if (def) for (const s of def) { if (!sayOk(st, s[2])) continue; const who = speaker(st, s[0]); if (who && (who === 'narr' || unitById(st, who))) evs.push({ k: 'say', who, text: sayText(s, who) }); }
    st.grp = 0;
    triggersAt(st, evs);
  }

  // ---------- 手番 ----------
  function endPlayerPhase(st) {
    const evs = [];
    if (st.mode !== 'combat') return evs;
    evs.push({ k: 'phase', side: 'enemy', turn: st.turn });
    st.phase = 'enemy';
    enemyPhase(st, evs);
    st.phase = 'player';
    if (st.mode !== 'combat' || st.lost) return evs;
    st.turn++;
    st.stats.turns++;
    spawnWaves(st, evs);
    for (const h of heroes(st)) { h.acted = h.ko; h.mv = h.ko || h.fixed ? 0 : movOf(h); }
    evs.push({ k: 'phase', side: 'player', turn: st.turn });
    // すきが切れる手番の始めに知らせる
    for (const e of liveEnemies(st)) if (e.active && e.flipped === 1 && ENEMY[e.k].armor) evs.push({ k: 'caption', who: [], text: ENEMY[e.k].name + 'が起きあがろうとしている（すき あと1手番）' });
    // 波のあいまに敵がいなくなっていたら、そのまま次へ
    if (!liveEnemies(st).filter(e => e.active).length && !pendingWaves(st)) { winCombat(st, evs, st.turn - 1); if (!st.flags.cleared && objective(st).done) { st.flags.cleared = true; evs.push({ k: 'cleared' }); } }
    return evs;
  }
  function spawnWaves(st, evs) {
    for (const w of st.waves || []) {
      if (w.done || w.turn > st.turn) continue;
      w.done = true;
      const ids = [];
      for (const e of w.units) {
        let x = e.x, y = e.y;
        if (unitAt(st, x, y)) {
          let found = false;
          for (let r = 1; r <= 2 && !found; r++) for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) {
            const nx = x + dx, ny = y + dy;
            if (inside(st, nx, ny) && surface(st, nx, ny).stand && !unitAt(st, nx, ny)) { x = nx; y = ny; found = true; }
          }
          if (!found) continue;
        }
        const u = makeEnemy(st, Object.assign({}, e, { x, y, active: true }), 'e' + (st.eseq++));
        u.grp = st.grp || 1;
        st.units.push(u); placeZ(st, u);
        ids.push(clone(u));
      }
      evs.push({ k: 'spawn', units: ids, text: w.text || '' });
      if (w.say) sayLines(st, w.say, evs);
    }
  }
  function nextWave(st) {
    const w = (st.waves || []).filter(q => !q.done).sort((a, b) => a.turn - b.turn)[0];
    return w ? w.turn - st.turn : null;
  }

  // 敵の思考（決定的）
  // 凍って休んだ敵は、その敵の手番のあいだずっと、ほかの敵の通り道をふさぐ（iceHold。手番の終わりに消す）
  function enemyPhase(st, evs, record) {
    try { enemyPhase0(st, evs, record); } finally { for (const u of st.units) delete u.iceHold; }
  }
  function enemyPhase0(st, evs, record) {
    const list = liveEnemies(st).filter(e => e.active).sort((a, b) => (a.id.length - b.id.length) || (a.id < b.id ? -1 : 1));
    for (const e of list) {
      if (e.ko) continue;
      if (e.frozen > 0) {
        e.frozen--;
        e.iceHold = true;
        if (ENEMY[e.k].armor) e.resist = 1;
        evs.push({ k: 'frozenSkip', id: e.id, left: e.frozen, resist: !!ENEMY[e.k].armor });
        if (record) record.push({ id: e.id, frozen: true });
        continue;
      }
      // すき：2 なら休んで 1 に（次の自分の手番もお腹が出たまま）。1 なら起きあがって、ふつうに動く
      if (e.flipped >= 2) {
        e.flipped = 1;
        evs.push({ k: 'flipSkip', id: e.id, left: e.flipped });
        if (record) record.push({ id: e.id, flipped: true, rest: true });
        continue;
      }
      if (e.flipped === 1) {
        e.flipped = 0;
        evs.push({ k: 'flipUp', id: e.id });
      }
      const E = ENEMY[e.k];
      if (!record) e.resist = 0;
      const hs = heroes(st).filter(h => !h.ko);
      if (!hs.length) break;
      const dist = reach(st, e, { max: e.mv });
      // 盗っ人：倉へ一直線
      if (E.raid && st.raid) {
        let best = null;
        for (const c of st.raid.cells) {
          const i = idx(st, c[0], c[1]);
          if (dist.has(i) && !unitAt(st, c[0], c[1], e) && (!best || dist.get(i).c < best.c)) best = { i, c: dist.get(i).c };
        }
        if (best) {
          const pth = cellsXYZ(st, pathTo(st, dist, best.i));
          moveUnitTo(st, e, best.i % st.W, (best.i / st.W) | 0);
          if (pth.length > 1) evs.push({ k: 'walk', id: e.id, path: pth, enemy: true });
          st.raid.sacks--;
          e.ko = true; e.gone = true;
          evs.push({ k: 'steal', id: e.id, left: st.raid.sacks, x: e.x, y: e.y, z: e.z });
          if (record) record.push({ id: e.id, to: [e.x, e.y], steal: true });
          if (st.raid.sacks <= 0) { evs.push({ k: 'lose', why: 'raid' }); st.lost = true; return; }
          continue;
        }
        const all = reach(st, e, { max: 99 });
        let goal = null, gd = 1e9;
        for (const c of st.raid.cells) { const i = idx(st, c[0], c[1]); if (all.has(i) && all.get(i).c < gd) { gd = all.get(i).c; goal = i; } }
        if (goal !== null) {
          const full = pathTo(st, all, goal);
          let stop = -1;
          for (let k = full.length - 1; k >= 1; k--) { const ci = full[k]; if (dist.has(ci) && !unitAt(st, ci % st.W, (ci / st.W) | 0, e)) { stop = k; break; } }
          if (stop > 0) {
            const pth = cellsXYZ(st, full.slice(0, stop + 1));
            const ci = full[stop];
            moveUnitTo(st, e, ci % st.W, (ci / st.W) | 0);
            evs.push({ k: 'walk', id: e.id, path: pth, enemy: true });
            if (record) record.push({ id: e.id, to: [e.x, e.y], raid: true });
            continue;
          }
        }
        // 道をふさがれたら、ふさいでいる者をたたく（下へ）
      }
      let best = null;
      for (const [i, d] of dist) {
        const x = i % st.W, y = (i / st.W) | 0;
        const occ = unitAt(st, x, y, e);
        if (occ) continue;
        const zc = d.z;
        for (const h of hs) {
          let ok = false;
          if (E.ranged) ok = inRange(x, y, h.x, h.y, E.range) && !(x === h.x && y === h.y);
          else ok = Math.abs(x - h.x) + Math.abs(y - h.y) === 1 && Math.abs(zc - h.z) <= 1 + (E.fly ? 2 : 0);
          if (!ok) continue;
          // 雪狼の群れ：ねらった相手のとなりに、ほかの雪狼がいれば傷+1（05 4.3）
          const pack = E.pack && st.units.some(w => w !== e && !w.ko && w.k === e.k && Math.abs(w.x - h.x) + Math.abs(w.y - h.y) === 1) ? E.pack : 0;
          const dmg = E.atk + (E.ranged && zc >= h.z + 2 ? 1 : 0) + pack;
          const also = [];
          if (E.slam) for (const h2 of hs) if (h2 !== h && Math.abs(x - h2.x) + Math.abs(y - h2.y) === 1 && Math.abs(zc - h2.z) <= 1) also.push({ id: h2.id, dmg: E.atk - 1 });
          let score = dmg * 10 - h.hp - d.c * 0.3 + (E.ranged ? zc * 0.4 : 0) + (dmg >= h.hp ? 6 : 0) + also.length * 8;
          score -= edgeRisk(st, x, y, zc) * 0.8;
          if (!best || score > best.score + 1e-9) best = { score, i, h, dmg, x, y, also };
        }
      }
      if (best) {
        if (best.i !== idx(st, e.x, e.y)) {
          const pth = cellsXYZ(st, pathTo(st, dist, best.i));
          moveUnitTo(st, e, best.x, best.y);
          if (fly(e)) e.z = pth[pth.length - 1][2];
          evs.push({ k: 'walk', id: e.id, path: pth, enemy: true });
        }
        e.face = faceTo(e.x, e.y, best.h.x, best.h.y, e.face);
        evs.push({ k: 'eatk', id: e.id, target: best.h.id, ranged: !!E.ranged, slam: !!E.slam, from: [e.x, e.y, e.z], to: [best.h.x, best.h.y, best.h.z] });
        hurt(st, best.h, best.dmg, 'enemy', evs, null);
        for (const a of best.also) { const h2 = unitById(st, a.id); if (h2 && !h2.ko) hurt(st, h2, a.dmg, 'enemy', evs, null); }
        if (record) record.push({ id: e.id, to: [e.x, e.y], target: best.h.id, dmg: best.dmg, also: best.also });
        if (heroes(st).every(h => h.ko)) { evs.push({ k: 'lose' }); st.lost = true; return; }
        continue;
      }
      const all = reach(st, e, { max: 99 });
      let goal = null, gd = 1e9;
      for (const h of hs) {
        for (const [dx, dy] of DIRS) {
          const gi = inside(st, h.x + dx, h.y + dy) ? idx(st, h.x + dx, h.y + dy) : -1;
          if (gi < 0 || !all.has(gi)) continue;
          if (!E.ranged && Math.abs(all.get(gi).z - h.z) > 1 + (E.fly ? 2 : 0)) continue; // 段差で殴れない升はめざさない
          if (all.get(gi).c < gd) { gd = all.get(gi).c; goal = gi; }
        }
      }
      if (goal === null) {
        // どこへも行けない敵は、しばらくすると逃げていく（行き詰まりを防ぐ）
        const lim = E.raid ? STUCK.raid : STUCK.normal;
        if (!record) { e.stuck = (e.stuck || 0) + 1; if (e.stuck >= lim && !e.boss) { e.ko = true; e.gone = true; evs.push({ k: 'flee', id: e.id }); continue; } }
        if (record) record.push({ id: e.id, idle: true, stuck: (e.stuck || 0) + 1 >= lim && !e.boss, wait: E.raid ? Math.max(0, lim - (e.stuck || 0) - 1) : 0 });
        continue;
      }
      e.stuck = 0;
      const full = pathTo(st, all, goal);
      let stop = -1;
      for (let k = full.length - 1; k >= 1; k--) {
        const ci = full[k];
        if (dist.has(ci) && !unitAt(st, ci % st.W, (ci / st.W) | 0, e)) { stop = k; break; }
      }
      if (stop > 0) {
        const pth = cellsXYZ(st, full.slice(0, stop + 1));
        const ci = full[stop];
        moveUnitTo(st, e, ci % st.W, (ci / st.W) | 0);
        if (fly(e)) e.z = pth[pth.length - 1][2];
        evs.push({ k: 'walk', id: e.id, path: pth, enemy: true });
        if (record) record.push({ id: e.id, to: [e.x, e.y] });
      } else if (record) record.push({ id: e.id, idle: true });
    }
  }
  function edgeRisk(st, x, y, z) {
    let r = 0;
    for (const [dx, dy] of DIRS) {
      const s = surface(st, x + dx, y + dy);
      if (s.void || s.water) r += 1; else if (z - s.z >= 3) r += 0.5;
    }
    return r;
  }

  // 手番を終えたときの敵の動き（画面の赤い線）。rec.heroes に、仲間それぞれの見こみ（体力・倒れる・こらえる）
  function intents(st) {
    if (st.mode !== 'combat') return [];
    const c = clone(st);
    c.phase = 'enemy';
    const rec = [];
    const rising = new Set(liveEnemies(st).filter(e => e.flipped === 1).map(e => e.id));
    const evs = [];
    enemyPhase(c, evs, rec);
    for (const r of rec) if (rising.has(r.id)) r.rise = true;
    rec.heroes = {};
    for (const h of heroes(c)) rec.heroes[h.id] = { hp: h.hp, ko: !!h.ko, endure: evs.some(e => e.k === 'endure' && e.id === h.id) };
    return rec;
  }

  // ---------- ボット・ヒント用：いまできる行動の一覧 ----------
  function options(st, heroId) {
    const out = [];
    const u = unitById(st, heroId);
    if (!u || u.ko || !isHero(u)) return out;
    const tryP = (intent) => { const p = plan(st, heroId, intent); if (p.ok) out.push(p); };
    const vs = verbsOf(st, u.k);
    const active = liveEnemies(st).filter(e => e.active || st.mode === 'explore');
    if (vs.includes('push')) {
      for (const o of st.objs) if (!o.gone && (PUSHABLE.includes(o.k) || o.k === 'pillar')) for (let d = 0; d < 4; d++) tryP({ k: 'push', ref: { o: o.id }, dir: d });
      for (const e of active) for (let d = 0; d < 4; d++) tryP({ k: 'push', ref: { u: e.id }, dir: d });
    }
    if (vs.includes('rope')) for (const o of st.objs) if (!o.gone && o.k === 'anchor') tryP({ k: 'rope', o: o.id });
    if (vs.includes('shoot')) {
      for (const o of st.objs) if (!o.gone && (o.k === 'target' && !o.hit || o.k === 'icicle')) tryP({ k: 'shoot', ref: { o: o.id } });
      for (const e of liveEnemies(st)) if (e.active) tryP({ k: 'shoot', ref: { u: e.id } });
    }
    if (vs.includes('waft')) {
      for (const o of st.objs) if (!o.gone && (WAFTABLE.includes(o.k) || (o.k === 'chime' && !o.rung))) {
        if (o.k === 'chime') tryP({ k: 'waft', ref: { o: o.id } }); else for (let d = 0; d < 4; d++) tryP({ k: 'waft', ref: { o: o.id }, dir: d });
      }
      if (st.mode === 'combat') for (const e of active) for (let d = 0; d < 4; d++) tryP({ k: 'waft', ref: { u: e.id }, dir: d });
      for (const h of heroes(st)) if (h.id !== heroId && !h.ko) for (let d = 0; d < 4; d++) tryP({ k: 'waft', ref: { u: h.id }, dir: d });
    }
    if (vs.includes('pull')) {
      for (const o of st.objs) if (!o.gone && (PULLABLE.includes(o.k) || (o.k === 'lever' && !o.done))) {
        if (o.k === 'lever') tryP({ k: 'pull', ref: { o: o.id } }); else for (let d = 0; d < 4; d++) tryP({ k: 'pull', ref: { o: o.id }, dir: d });
      }
      for (const e of active) if (st.mode === 'combat') for (let d = 0; d < 4; d++) tryP({ k: 'pull', ref: { u: e.id }, dir: d });
    }
    if (vs.includes('freeze')) {
      const seen = new Set();
      for (let y = 0; y < st.H; y++) for (let x = 0; x < st.W; x++) if (st.t[idx(st, x, y)] === 'w') { const key = x + ',' + y; if (!seen.has(key)) { seen.add(key); tryP({ k: 'freeze', x, y }); } }
      for (const o of st.objs) if (!o.gone && ((o.k === 'fall' && !o.frozen) || (o.k === 'crystal' && !o.lit))) tryP({ k: 'freeze', ref: { o: o.id } });
      for (const e of liveEnemies(st)) if (e.active) tryP({ k: 'freeze', ref: { u: e.id } });
    }
    if (vs.includes('blast')) {
      const cells = new Set();
      for (const e of liveEnemies(st)) if (e.active) { cells.add(e.x + ',' + e.y); for (const [dx, dy] of DIRS) cells.add((e.x + dx) + ',' + (e.y + dy)); }
      for (const o of st.objs) if (!o.gone && (o.k === 'crack' || PUSHABLE.includes(o.k))) { cells.add(o.x + ',' + o.y); for (const [dx, dy] of DIRS) cells.add((o.x + dx) + ',' + (o.y + dy)); }
      for (const k of cells) { const [x, y] = k.split(',').map(Number); if (inside(st, x, y)) tryP({ k: 'blast', x, y }); }
    }
    return out;
  }

  function preview(st, p) {
    const c = clone(st);
    const evs = apply(c, p);
    const flat = [];
    const walk = (l) => { for (const e of l) { if (e.k === 'group') walk(e.evs); else flat.push(e); } };
    walk(evs);
    const out = { evs: flat, dmg: {}, ko: [], cap: null, bloom: 0, moves: {}, flips: [], shatter: [], safe: [] };
    for (const e of flat) {
      if (e.k === 'dmg') out.dmg[e.id] = (out.dmg[e.id] || 0) + e.n;
      if (e.k === 'ko') out.ko.push(e.id);
      if (e.k === 'caption') out.cap = e;
      if (e.k === 'bloom') out.bloom = e.cells.length;
      if (e.k === 'flip') out.flips.push(e.id);
      if (e.k === 'shatter') out.shatter.push(e.o);
      if (e.k === 'safe') out.safe.push(e.id);
      if (e.k === 'slide' || e.k === 'fall' || e.k === 'waft') { const key = e.ref.u || e.ref.o; out.moves[key] = e.path ? e.path[e.path.length - 1] : e.to; }
    }
    out.state = c;
    return out;
  }

  const api = {
    DIRS, HERO, COMPANIONS, ENEMY, NPC, RANGE, OBJ_H, PUSHABLE, PULLABLE, ICICLE_Z, PULL_MAX, CHARM_FX, STUCK, movOf, speaker,
    verbsOf, verbLabel, pullInfo, snowCost, waftInfo, waftDest, waftDist, WAFTABLE,
    clone, idx, inside, inRange, create, surface, standZ, canStep, reach, pathTo, partyReach,
    plan, apply, preview, options, intents, endPlayerPhase, startCombat, wakeCheck, triggersAt, objective, nextWave, runeCount,
    unitById, objById, unitAt, heroes, npcs, enemies, liveEnemies, freezeCells, pushInfo, objName, whyNot, isHero, isNpc, isFoe, fly, faceTo,
    can, heroWith, blastSet, rescueCheck, rescuees, pendingWaves, info,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.S21 = api;
})(typeof window !== 'undefined' ? window : globalThis);
