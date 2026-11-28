// GUILDWARD — ルール本体（描画に依存しない。node でも動く）
// 第19作「せーの、星見の露台へ」のルールをもとに、編成式（リコ＋仲間2人）に作りなおした。
// 座標: x は画面の右下へ、y は左下へ。高さ z は1段ずつの整数。
(function (root) {
  'use strict';

  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  // 冒険者。verbs はその人ができる働きかけ（行動の判定は名前ではなく、これで行う）
  const HERO = {
    riko: { name: 'リコ', role: '斥候', hp: 6, mov: 4, verbs: ['shoot', 'rope'], verbName: '射る・鉤縄', color: '#8fd45e' },
    gard: { name: 'ガルド', role: '重戦士', hp: 9, mov: 3, verbs: ['push'], verbName: '押す', color: '#ef8a45' },
    sena: { name: 'セナ', role: '氷の術師', hp: 6, mov: 3, verbs: ['freeze'], verbName: '凍らせる', color: '#72cdff' },
    tobi: { name: 'トビ', role: '発破師', hp: 7, mov: 3, verbs: ['blast'], verbName: '発破', color: '#c792ff' },
  };
  const COMPANIONS = ['gard', 'sena', 'tobi'];
  const ENEMY = {
    goblin: { name: '小鬼', hp: 3, mov: 3, atk: 2, range: 1 },
    raider: { name: '盗っ人小鬼', hp: 3, mov: 4, atk: 1, range: 1, raid: true },
    archer: { name: '骨の射手', hp: 2, mov: 2, atk: 1, range: 4, ranged: true },
    slime: { name: '粘体', hp: 4, mov: 2, atk: 1, range: 1 },
    bat: { name: '洞コウモリ', hp: 2, mov: 4, atk: 1, range: 1, fly: true },
    golem: { name: '岩人形', hp: 7, mov: 2, atk: 2, range: 1, heavy: true },
    wisp: { name: '水霊', hp: 3, mov: 3, atk: 2, range: 3, ranged: true, swim: true },
    turtle: { name: '岩喰い大亀', hp: 12, mov: 2, atk: 3, range: 1, heavy: true, armor: true, slam: true, big: true },
  };
  const NPC = {
    miner: { name: '鉱夫' }, tobi: { name: 'トビ' }, kid: { name: '子ども' },
  };
  const RANGE = { shoot: 5, rope: 5, rope2: 8, freeze: 4, blast: 4 };
  const OBJ_H = { crate: 1, block: 1, iceblock: 1, beam: 1, boulder: 1, rubble: 1, pillar: 3, door: 3, statue: 2, crack: 2, crystal: 2, deco: 2, wagon: 2, lantern: 2 };
  const TOPS = ['crate', 'block', 'iceblock', 'beam', 'rubble'];          // 上に立てる物
  const BLOCKS = ['pillar', 'boulder', 'door', 'statue', 'crack', 'crystal', 'deco', 'wagon', 'lantern']; // ふさぐ物
  const PUSHABLE = ['crate', 'block', 'iceblock', 'boulder'];

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
  function can(st, heroId, verb) { const u = unitById(st, heroId); return !!u && isHero(u) && HERO[u.k].verbs.indexOf(verb) >= 0; }
  function heroWith(st, verb) { const u = st.units.find(h => isHero(h) && !h.ko && HERO[h.k].verbs.indexOf(verb) >= 0); return u ? u.id : null; }

  function newStats() {
    return { acts: {}, kills: {}, combos: 0, turns: 0, fights: 0, undo: 0, hints: 0, retries: 0, steps: 0 };
  }

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
    (def.start || []).forEach((p, k) => {
      const id = party[k];
      if (!id) return;
      const hp = HERO[id].hp + st.hpb;
      st.units.push({ id, k: id, team: 'h', x: p[0], y: p[1], z: 0, hp, mhp: hp, mv: HERO[id].mov, acted: false, frozen: 0, ko: false, face: p[2] === undefined ? 3 : p[2] });
    });
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
        const nc = cd.c + cost;
        if (nc > max) continue;
        if (dist.has(ni) && dist.get(ni).c <= nc) continue;
        const tmp = { x: cx, y: cy, z: cd.z, k: u.k, team: u.team, frozen: u.frozen, guest: u.guest };
        if (isLink) {
          if (!surface(st, nx, ny).stand) continue;
        } else if (!canStep(st, tmp, cx, cy, nx, ny)) continue;
        if (!opt.ignoreUnits) {
          const o = unitAt(st, nx, ny, u);
          if (o && o.team !== u.team && !(isHero(u) && isNpc(o)) && !(isNpc(u) && isHero(o))) continue;
        }
        const s = surface(st, nx, ny);
        dist.set(ni, { c: nc, p: cur, z: s.void ? cd.z : s.z });
        open.push(ni);
      }
    }
    return dist;
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
        R = RANGE.shoot + (st.up.bow ? 1 : 0);
        if (intent.ref.u) {
          const t = unitById(st, intent.ref.u);
          if (!t || t.ko || !isFoe(t)) return { ok: false, why: '射る相手がいない' };
          tx = t.x; ty = t.y; tz = t.z;
        } else {
          const o = objById(st, intent.ref.o);
          if (!o || o.k !== 'target' || o.hit) return { ok: false, why: 'もう当たっている' };
          tx = o.x; ty = o.y; tz = o.z;
        }
      } else if (intent.k === 'blast') {
        R = RANGE.blast;
        tx = intent.x; ty = intent.y;
        if (!inside(st, tx, ty)) return { ok: false, why: '外' };
        const sf = surface(st, tx, ty);
        tz = sf.void ? 0 : sf.block ? Math.max(sf.z, sf.blockTop - 1) : sf.z;
        const b = blastSet(st, tx, ty);
        if (!b.any) return { ok: false, why: 'ここで発破しても、何も起きない' };
      } else {
        R = RANGE.freeze + (st.up.staff ? 1 : 0);
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
    const out = { center: null, cracks: [], push: [], any: false };
    const cu = unitAt(st, tx, ty);
    if (cu && isFoe(cu)) { out.center = cu; out.any = true; }
    const cells = [[tx, ty, -1]].concat(DIRS.map(([dx, dy], d) => [tx + dx, ty + dy, d]));
    for (const [x, y, d] of cells) {
      if (!inside(st, x, y)) continue;
      for (const o of st.objs) if (!o.gone && o.k === 'crack' && o.x === x && o.y === y) { out.cracks.push(o); out.any = true; }
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
        partyWalk(st, u, p.path, evs);
        const ce = evs.find(e => e.k === 'combat');
        if (ce) {
          if (p.intent.k !== 'move') ce.cancel = { who: u.id, verb: VERB[p.intent.k] || '行動' };
          postCheck(st, evs, before, null); return evs;
        }
      }
    }
    const I = p.intent;
    if (I.k === 'move') {
      collectAt(st, u, evs);
      if (!combat) triggersAt(st, evs);
      postCheck(st, evs, before, null);
      return evs;
    }
    const tp = I.k === 'push' ? objOrUnitPos(st, I.ref) : [p.tx, p.ty];
    u.face = faceTo(u.x, u.y, tp[0], tp[1], u.face);
    const credit = { who: [u.id], text: '', kills: 0, combo: false, big: 0 };
    st.stats.acts[u.id] = (st.stats.acts[u.id] || 0) + 1;
    if (I.k === 'push') doPush(st, u, I.ref, I.dir, evs, credit);
    else if (I.k === 'shoot') doShoot(st, u, I.ref, evs, credit);
    else if (I.k === 'rope') doRope(st, u, I.o, evs, credit);
    else if (I.k === 'freeze') doFreeze(st, u, I, evs, credit, p);
    else if (I.k === 'blast') doBlast(st, u, I, evs, credit);
    if (combat) { u.acted = true; u.mv = 0; }
    postCheck(st, evs, before, credit);
    return evs;
  }

  const VERB = { push: '押す', shoot: '射る', rope: '鉤縄で渡る', freeze: '凍らせる', blast: '発破' };
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

  // 探索中の移動：選んだ一人が先頭で歩き、仲間がついてくる
  function partyWalk(st, lead, path, evs) {
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
    const others = heroes(st).filter(h => h !== lead && !h.ko && !h.fixed);
    const taken = new Set([end]);
    for (const o of st.objs) if (!o.gone && (PUSHABLE.includes(o.k) || o.k === 'anchor' || o.k === 'chest')) taken.add(idx(st, o.x, o.y));
    for (const u of st.units) if (!u.ko && (isNpc(u) || u.fixed)) taken.add(idx(st, u.x, u.y));
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
    for (const h of heroes(st)) { h.acted = false; h.mv = h.fixed ? 0 : HERO[h.k].mov; }
    evs.push({ k: 'combat', grp });
    const def = st.fightSay && st.fightSay[grp];
    if (def) for (const s of def) evs.push({ k: 'say', who: s[0], text: s[1] });
  }

  function collectAt(st, u, evs) {
    if (!isHero(u)) return;
    for (const o of st.objs) {
      if (o.gone || o.k !== 'chest' || o.open) continue;
      if (o.x === u.x && o.y === u.y) {
        o.open = true;
        if (o.item) { st.items.push(o.item); if (o.up) st.up[o.up] = true; }
        if (o.coins) st.coins += o.coins;
        st.found.push(o.id);
        evs.push({ k: 'collect', o: o.id, item: o.item, coins: o.coins || 0, by: u.id, x: o.x, y: o.y, z: o.z });
        if (o.say) for (const s of o.say) evs.push({ k: 'say', who: s[0], text: s[1] });
      }
    }
  }

  function triggersAt(st, evs) {
    for (const tr of st.trig || []) {
      if (st.said[tr.id]) continue;
      if (tr.flag && !st.flags[tr.flag]) continue;
      if (tr.need && !tr.need.some(v => heroWith(st, v))) continue;
      const hit = heroes(st).some(h => !h.ko && !h.fixed && h.x >= tr.r[0] && h.y >= tr.r[1] && h.x <= tr.r[2] && h.y <= tr.r[3]);
      if (!hit) continue;
      st.said[tr.id] = 1;
      for (const s of tr.say || []) evs.push({ k: 'say', who: s[0], text: s[1] });
      if (tr.on) runOn(st, tr.on, evs, null);
    }
  }

  // ---------- 押す・吹き飛ばす ----------
  function hurt(st, u, n, why, evs, credit) {
    if (u.ko || n <= 0) return;
    if (isFoe(u) && ENEMY[u.k].armor && why !== 'enemy') {
      if (!(u.flipped > 0)) {
        if (why === 'fall' || why === 'crush' || why === 'rock') { flip(st, u, evs, credit); n = 2; }
        else if (why === 'arrowHigh') { if (credit) credit.gap = true; }
        else { evs.push({ k: 'clang', id: u.id }); if (credit) credit.clang = (credit.clang || 0) + 1; return; }
      } else if (why !== 'fall') n += 1; // ひっくり返ったお腹は、やわらかい
    }
    u.hp -= n;
    evs.push({ k: 'dmg', id: u.id, n, why, hp: Math.max(0, u.hp) });
    if (u.hp <= 0) ko(st, u, why, evs, credit);
  }
  function flip(st, u, evs, credit) {
    u.flipped = 1; u.frozen = 0;
    evs.push({ k: 'flip', id: u.id });
    if (credit) credit.flip = true;
  }
  function ko(st, u, how, evs, credit) {
    if (u.ko) return;
    u.ko = true; u.hp = Math.max(0, u.hp);
    if (how === 'void' || how === 'drown' || how === 'ice' || !isHero(u)) u.gone = true;
    evs.push({ k: 'ko', id: u.id, how });
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
    if (isU) hurt(st, ent, 1, opt.why || 'push', evs, credit);
    if (isU && ent.ko) return { end: 'ko', path: [[ent.x, ent.y, ent.z]], moved: 0 };
    let x = ent.x, y = ent.y, z = ent.z;
    const path = [[x, y, z]];
    const ref2 = isU ? { u: ent.id } : { o: ent.id };
    let end = 'stop', bumpInto = null, steps = 0, iceUsed = false, crushed = 0, pushes = 0;
    const flyer = isU && fly(ent);
    const maxPush = opt.dist || 1;
    while (steps++ < 40) {
      const nx = x + dx, ny = y + dy;
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
          if (roll && isFoe(occ)) {
            hurt(st, occ, 3, 'crush', evs, credit); crushed++;
            if (occ.ko) { x = nx; y = ny; z = s.z; path.push([x, y, z]); continue; }
          }
          end = 'bump'; bumpInto = occ; break;
        }
        if (!isU) {
          path.push([nx, ny, z]);
          evs.push({ k: 'slide', ref: ref2, path: path.slice(), roll });
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
    if (moved) evs.push({ k: 'slide', ref: ref2, path, roll, slip: slip || iceUsed });
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
      if (bumpInto && bumpInto.team && isFoe(bumpInto)) hurt(st, bumpInto, 1, 'bump', evs, credit);
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
    return { end, path, moved: path.length - 1, iceUsed, crushed, fromZ: path[0][2] };
  }
  function addWho(credit, w) { if (credit && credit.who.indexOf(w) < 0) { credit.who.push(w); credit.combo = true; } }

  function finishPushCaption(st, ent, isU, r, credit) {
    const name = isU ? ENEMY[ent.k].name : objName(ent);
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
    else if (!isU && r.path && r.path.length > 1 && r.path[0][2] > ent.z) t = name + 'が段の下へ落ちて、足場になった';
    else if (iceUsed && moved > 1) t = name + 'は氷の上をすべっていった';
    else t = name + 'を押した';
    if (r.crushed) t = name + 'が転がり、' + r.crushed + '体をなぎ倒した';
    if (isU && ent.ko && end === 'bump') t = name + 'はぶつかって倒れた';
    if (credit.flip && end !== 'fall') t += '（ひっくり返った！）';
    credit.text = t;
  }

  function objName(o) {
    return { crate: '木箱', block: '石のブロック', iceblock: '氷のかたまり', boulder: '大岩', pillar: '石柱', rubble: 'がれき' }[o.k] || '物';
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
    // 外側から順に押す（ぶつかり合いを減らす）
    const list = set.push.slice();
    for (const it of list) {
      const isU = !!it.ref.u;
      const ent = isU ? unitById(st, it.ref.u) : objById(st, it.ref.o);
      if (!ent || ent.gone || ent.ko) continue;
      const r = pushEntity(st, ent, isU, it.dir, evs, credit, { dist: big ? 2 : 1, why: 'blast' });
      if (r.moved) { flung++; flungNames.push(isU ? ENEMY[ent.k].name : objName(ent)); flungEnds.push(r.end); }
      if (r.crushed) rolled = { name: objName(ent), n: r.crushed };
      if (isU && ent.ko) felled++;
    }
    st.stats.blasts = (st.stats.blasts || 0) + 1;
    let tx = '';
    if (shattered && credit.crackLabel) tx = credit.crackLabel;
    else if (shattered) tx = 'ひび割れた岩を砕いた。がれきは足場になる';
    const OUTCOME = { drown: '。水に沈んだ', void: '。谷へ落ちていった', sink: '。水に沈んで、飛び石になった', fall: '。段の下へ落ちた', rock: '。下の敵にぶつかった' };
    if (credit.kills && !(flung === 1 && credit.kills === 1 && OUTCOME[flungEnds[0]])) tx = (tx ? tx + '。' : '') + '爆風で ' + credit.kills + '体を倒した';
    else if (flung === 1 && OUTCOME[flungEnds[0]]) tx = (tx ? tx + '。' : '') + '爆風で ' + flungNames[0] + 'を吹き飛ばした' + OUTCOME[flungEnds[0]];
    else if (flung) tx = (tx ? tx + '。' : '') + '爆風で ' + (flung === 1 ? flungNames[0] + 'を' : flung + 'つを') + '吹き飛ばした';
    if (rolled) tx = '爆風で' + rolled.name + 'が転がり、' + rolled.n + '体をなぎ倒した';
    if (credit.plateLabel) tx = (tx ? tx + '。' : '') + credit.plateLabel;
    if (credit.sinkLabel) tx = (tx ? tx + '。' : '') + credit.sinkLabel;
    if (credit.flip) tx += '（ひっくり返った！）';
    if (credit.clang && !credit.flip && !credit.kills && !flung) tx = '甲羅にはじかれた。落とすか、ひっくり返せば効く';
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
      if (credit.clang) { credit.text = '矢は甲羅にはじかれた。2段上から射るか、ひっくり返せば効く'; return; }
      if (credit.gap && !(t.flipped > 0)) { credit.text = '高所からの矢が、甲羅のすきまに刺さった' + (t.ko ? '。倒れた' : ''); return; }
      credit.text = ENEMY[t.k].name + 'を射た' + (high ? '（高所から）' : '') + (shatter ? '（凍って砕けやすい）' : '') + (t.ko ? '。倒れた' : '');
      return;
    }
    const o = objById(st, ref.o);
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
      else if (op === 'rune') { st.flags[id] = true; evs.push({ k: 'rune', id, n: runeCount(st) }); runeCheck(st, evs); }
      else if (op === 'drain') { drain(st, id, evs); }
      else if (op === 'show' && o) { o.hidden = false; evs.push({ k: 'show', o: o.id }); }
      else if (op === 'wake') { if (st.mode === 'explore') startCombat(st, +id, evs); }
    }
  }
  function runeCount(st) { return (st.obj.flags || []).filter(f => st.flags[f]).length; }
  function runeCheck(st, evs) {
    const O = st.obj;
    if (O.k !== 'runes' || st.flags.runesDone) return;
    if (runeCount(st) >= O.need) { st.flags.runesDone = true; if (O.on) runOn(st, O.on, evs, null); evs.push({ k: 'runesDone' }); }
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
          if (!['chest', 'anchor', 'target', 'fall', 'crystal', 'crack'].includes(o.k)) continue;
          if (o.k === 'chest' && o.open) continue;
          if (o.k === 'target' && o.hit) continue;
          if (o.k === 'crystal' && o.lit) continue;
          let near = false;
          if (o.k === 'chest') near = after.has(idx(st, o.x, o.y)) && cells.some(c => Math.abs(c[0] - o.x) + Math.abs(c[1] - o.y) <= 2);
          else if (o.k === 'anchor') near = heroWith(st, 'rope') && cells.some(c => inRange(c[0], c[1], o.x, o.y, st.up.rope2 ? RANGE.rope2 : RANGE.rope)) && !after.has(idx(st, o.x, o.y));
          else if (o.k === 'target') near = cells.some(c => inRange(c[0], c[1], o.x, o.y, RANGE.shoot));
          else if (o.k === 'fall') near = heroWith(st, 'freeze') && !o.frozen && cells.some(c => inRange(c[0], c[1], o.bx, o.by, RANGE.freeze));
          else if (o.k === 'crystal') near = heroWith(st, 'freeze') && cells.some(c => inRange(c[0], c[1], o.x, o.y, RANGE.freeze));
          else if (o.k === 'crack') near = heroWith(st, 'blast') && cells.some(c => inRange(c[0], c[1], o.x, o.y, RANGE.blast));
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

  function winCombat(st, evs) {
    st.mode = 'explore';
    for (const h of heroes(st)) { h.ko = false; h.hp = h.mhp; h.acted = false; h.mv = h.fixed ? 0 : HERO[h.k].mov; h.frozen = 0; }
    evs.push({ k: 'win', grp: st.grp });
    st.flags['won' + st.grp] = true;
    const def = st.winSay && st.winSay[st.grp];
    if (def) for (const s of def) evs.push({ k: 'say', who: s[0], text: s[1] });
    st.grp = 0;
    triggersAt(st, evs);
  }

  // ---------- 手番 ----------
  function endPlayerPhase(st) {
    const evs = [];
    if (st.mode !== 'combat') return evs;
    evs.push({ k: 'phase', side: 'enemy', turn: st.turn });
    enemyPhase(st, evs);
    if (st.mode !== 'combat' || st.lost) return evs;
    st.turn++;
    st.stats.turns++;
    spawnWaves(st, evs);
    for (const h of heroes(st)) { h.acted = h.ko; h.mv = h.ko || h.fixed ? 0 : HERO[h.k].mov; }
    evs.push({ k: 'phase', side: 'player', turn: st.turn });
    // 波のあいまに敵がいなくなっていたら、そのまま次へ
    if (!liveEnemies(st).filter(e => e.active).length && !pendingWaves(st)) { winCombat(st, evs); if (!st.flags.cleared && objective(st).done) { st.flags.cleared = true; evs.push({ k: 'cleared' }); } }
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
      if (w.say) for (const s of w.say) evs.push({ k: 'say', who: s[0], text: s[1] });
    }
  }
  function nextWave(st) {
    const w = (st.waves || []).filter(q => !q.done).sort((a, b) => a.turn - b.turn)[0];
    return w ? w.turn - st.turn : null;
  }

  // 敵の思考（決定的）
  function enemyPhase(st, evs, record) {
    const list = liveEnemies(st).filter(e => e.active).sort((a, b) => (a.id.length - b.id.length) || (a.id < b.id ? -1 : 1));
    for (const e of list) {
      if (e.ko) continue;
      if (e.frozen > 0) {
        e.frozen--;
        if (ENEMY[e.k].armor) e.resist = 1;
        evs.push({ k: 'frozenSkip', id: e.id, left: e.frozen, resist: !!ENEMY[e.k].armor });
        if (record) record.push({ id: e.id, frozen: true });
        continue;
      }
      if (e.flipped > 0) {
        e.flipped--;
        evs.push({ k: 'flipSkip', id: e.id, left: e.flipped });
        if (record) record.push({ id: e.id, flipped: true });
        continue;
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
          const dmg = E.atk + (E.ranged && zc >= h.z + 2 ? 1 : 0);
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
        if (!record) { e.stuck = (e.stuck || 0) + 1; if (e.stuck >= 2 && !e.boss) { e.ko = true; e.gone = true; evs.push({ k: 'flee', id: e.id }); continue; } }
        if (record) record.push({ id: e.id, idle: true, stuck: (e.stuck || 0) + 1 >= 2 && !e.boss });
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

  function intents(st) {
    if (st.mode !== 'combat') return [];
    const c = clone(st);
    const rec = [];
    enemyPhase(c, [], rec);
    return rec;
  }

  // ---------- ボット・ヒント用：いまできる行動の一覧 ----------
  function options(st, heroId) {
    const out = [];
    const u = unitById(st, heroId);
    if (!u || u.ko || !isHero(u)) return out;
    const tryP = (intent) => { const p = plan(st, heroId, intent); if (p.ok) out.push(p); };
    const vs = HERO[u.k].verbs;
    const active = liveEnemies(st).filter(e => e.active || st.mode === 'explore');
    if (vs.includes('push')) {
      for (const o of st.objs) if (!o.gone && (PUSHABLE.includes(o.k) || o.k === 'pillar')) for (let d = 0; d < 4; d++) tryP({ k: 'push', ref: { o: o.id }, dir: d });
      for (const e of active) for (let d = 0; d < 4; d++) tryP({ k: 'push', ref: { u: e.id }, dir: d });
    }
    if (vs.includes('rope')) for (const o of st.objs) if (!o.gone && o.k === 'anchor') tryP({ k: 'rope', o: o.id });
    if (vs.includes('shoot')) {
      for (const o of st.objs) if (!o.gone && o.k === 'target' && !o.hit) tryP({ k: 'shoot', ref: { o: o.id } });
      for (const e of liveEnemies(st)) if (e.active) tryP({ k: 'shoot', ref: { u: e.id } });
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
      if (e.k === 'slide' || e.k === 'fall') { const key = e.ref.u || e.ref.o; out.moves[key] = e.path ? e.path[e.path.length - 1] : e.to; }
    }
    out.state = c;
    return out;
  }

  const api = {
    DIRS, HERO, COMPANIONS, ENEMY, NPC, RANGE, OBJ_H, PUSHABLE,
    clone, idx, inside, inRange, create, surface, standZ, canStep, reach, pathTo, partyReach,
    plan, apply, preview, options, intents, endPlayerPhase, startCombat, wakeCheck, triggersAt, objective, nextWave, runeCount,
    unitById, objById, unitAt, heroes, npcs, enemies, liveEnemies, freezeCells, pushInfo, objName, whyNot, isHero, isNpc, isFoe, fly, faceTo,
    can, heroWith, blastSet, rescueCheck, rescuees, pendingWaves, info,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.S21 = api;
})(typeof window !== 'undefined' ? window : globalThis);
