// せーの、星見の露台へ — ルール本体（描画に依存しない。node でも動く）
// 座標: x は画面の右下へ、y は左下へ。高さ z は1段ずつの整数。
(function (root) {
  'use strict';

  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const HERO_IDS = ['gard', 'riko', 'sena'];
  const HERO = {
    gard: { name: 'ガルド', role: '盾の戦士', hp: 9, mov: 3, verb: 'push', verbName: '押す', color: '#ef8a45' },
    riko: { name: 'リコ', role: '斥候', hp: 6, mov: 4, verb: 'shoot', verbName: '射る・鉤縄', color: '#8fd45e' },
    sena: { name: 'セナ', role: '氷の術師', hp: 6, mov: 3, verb: 'freeze', verbName: '凍らせる', color: '#72cdff' },
  };
  const ENEMY = {
    goblin: { name: '小鬼', hp: 3, mov: 3, atk: 2, range: 1 },
    archer: { name: '骨の射手', hp: 2, mov: 2, atk: 1, range: 4, ranged: true },
    slime: { name: '粘体', hp: 4, mov: 2, atk: 1, range: 1 },
    bat: { name: '洞コウモリ', hp: 2, mov: 4, atk: 1, range: 1, fly: true },
    golem: { name: '岩人形', hp: 8, mov: 2, atk: 2, range: 1, heavy: true },
    wisp: { name: '水霊', hp: 3, mov: 3, atk: 2, range: 3, ranged: true, swim: true },
  };
  const RANGE = { shoot: 5, rope: 5, rope2: 8, freeze: 4 };
  const OBJ_H = { crate: 1, block: 1, iceblock: 1, beam: 1, boulder: 1, pillar: 3, door: 3, lantern: 2, statue: 2 };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function idx(st, x, y) { return y * st.W + x; }
  function inside(st, x, y) { return x >= 0 && y >= 0 && x < st.W && y < st.H; }
  function d2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
  function inRange(ax, ay, bx, by, R) { return d2(ax, ay, bx, by) <= R * R + R; }
  function isHero(u) { return u.team === 'h'; }
  function info(u) { return isHero(u) ? HERO[u.k] : ENEMY[u.k]; }
  function fly(u) { return !isHero(u) && !!ENEMY[u.k].fly && !(u.frozen > 0); }

  function newStats() {
    return { push: 0, shoot: 0, rope: 0, freeze: 0, kills: { gard: 0, riko: 0, sena: 0 }, combos: 0, turns: 0, fights: 0, undo: 0, hints: 0, retries: 0 };
  }

  // ---------- 区画をつくる ----------
  function create(def, carry) {
    carry = carry || {};
    const W = def.W, H = def.H;
    const st = {
      sec: def.id, W, H, h: [], t: [], by: {}, objs: [], units: [], links: [],
      mode: 'explore', turn: 0, sel: 'gard', flags: {}, said: {},
      up: Object.assign({}, carry.up || {}), items: (carry.items || []).slice(),
      stats: carry.stats ? clone(carry.stats) : newStats(),
      moments: carry.moments ? clone(carry.moments) : [],
      seq: 1,
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
        // 木箱を木箱の上に置いた定義は、下から積む
        if (OBJ_H[ob.k] && ob.k !== 'door') {
          for (const p of st.objs) if (p.x === ob.x && p.y === ob.y && (p.k === 'crate' || p.k === 'block')) ob.z = Math.max(ob.z, p.z + 1);
        }
      }
      if (ob.k === 'fall' && ob.bz === undefined) ob.bz = st.h[idx(st, ob.bx, ob.by)];
      if (ob.k === 'bridge' && ob.z === undefined) ob.z = 0;
      st.objs.push(ob);
    }
    for (const id of HERO_IDS) {
      const p = def.start[id];
      const hp = HERO[id].hp + (st.up['hp_' + id] || 0);
      const u = { id, k: id, team: 'h', x: p[0], y: p[1], z: 0, hp, mhp: hp, mv: HERO[id].mov, acted: false, frozen: 0, ko: false, face: p[2] === undefined ? 3 : p[2] };
      st.units.push(u);
    }
    let n = 1;
    for (const e of def.enemies || []) {
      const E = ENEMY[e.k];
      const hp = e.hp || E.hp;
      st.units.push({ id: 'e' + (n++), k: e.k, team: 'e', x: e.x, y: e.y, z: 0, hp, mhp: hp, mv: E.mov, acted: false, frozen: 0, ko: false, face: e.face === undefined ? 1 : e.face, grp: e.grp || 1, active: false, wake: e.wake || 5, boss: !!e.boss });
    }
    st.base = def.base;
    for (const u of st.units) {
      const sf = surface(st, u.x, u.y);
      if (sf.void || (sf.water && u.team === 'e' && ENEMY[u.k] && ENEMY[u.k].fly)) {
        const e = (def.enemies || []).find(q => q.x === u.x && q.y === u.y);
        u.z = (e && e.z !== undefined) ? e.z : 6;
      } else u.z = standZ(st, u.x, u.y, u);
    }
    st.trig = clone(def.trig || []);
    st.fightSay = clone(def.fightSay || {});
    st.winSay = clone(def.winSay || {});
    st.drains = clone(def.drains || []);
    for (const L of def.links || []) st.links.push(clone(L));
    return st;
  }

  function unitById(st, id) { return st.units.find(u => u.id === id); }
  function objById(st, id) { return st.objs.find(o => o.id === id); }
  function heroes(st) { return st.units.filter(u => u.team === 'h'); }
  function enemies(st) { return st.units.filter(u => u.team === 'e'); }
  function liveEnemies(st) { return st.units.filter(u => u.team === 'e' && !u.ko); }
  function unitAt(st, x, y, except) {
    for (const u of st.units) if (!u.ko && u !== except && u.x === x && u.y === y) return u;
    return null;
  }

  // ---------- 地形の高さ ----------
  // ある升の「いちばん上の面」と、立てるかどうか
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
      if (o.k === 'crate' || o.k === 'block' || o.k === 'iceblock' || o.k === 'beam') {
        const top = o.z + 1;
        if (top >= r.z) { r.z = top; r.stand = true; r.void = false; r.water = false; r.fast = false; r.wall = false; r.ice = o.k === 'iceblock'; r.top = o; }
      } else if (o.k === 'pillar' || o.k === 'boulder' || (o.k === 'door' && !o.open) || o.k === 'lantern' || o.k === 'statue') {
        r.block = o; r.blockTop = o.z + (OBJ_H[o.k] || 1);
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
    if (u && u.team === 'e' && ENEMY[u.k] && ENEMY[u.k].swim && !(u.frozen > 0)) {
      return (b.water && !b.fast) || false;
    }
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
    return dz <= 1 && dz >= -2;
  }
  function linkFrom(st, x, y) {
    const out = [];
    for (const L of st.links) {
      if (L.hidden) continue;
      if (L.a[0] === x && L.a[1] === y) out.push([L.b[0], L.b[1], L]);
      else if (L.b[0] === x && L.b[1] === y) out.push([L.a[0], L.a[1], L]);
    }
    return out;
  }

  // ダイクストラ。opt: {max, ignoreUnits, linkCost}
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
      if (!flying && !opt.noLinks) for (const [lx, ly] of linkFrom(st, cx, cy)) nbs.push([lx, ly, linkCost, true]);
      for (const [nx, ny, cost, isLink] of nbs) {
        if (!inside(st, nx, ny)) continue;
        const ni = idx(st, nx, ny);
        const nc = cd.c + cost;
        if (nc > max) continue;
        if (dist.has(ni) && dist.get(ni).c <= nc) continue;
        const tmp = { x: cx, y: cy, z: cd.z, k: u.k, team: u.team, frozen: u.frozen };
        if (isLink) {
          if (!surface(st, nx, ny).stand) continue;
        } else if (!canStep(st, tmp, cx, cy, nx, ny)) continue;
        if (!opt.ignoreUnits) {
          const o = unitAt(st, nx, ny, u);
          if (o && o.team !== u.team) continue;
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

  // 一行で全員が行ける範囲（花ひらき・出口判定に使う）
  function partyReach(st) {
    const set = new Set();
    for (const u of heroes(st)) {
      if (u.ko) continue;
      for (const k of reach(st, u, { ignoreUnits: true }).keys()) set.add(k);
    }
    return set;
  }

  // ---------- 押せるもの ----------
  function pushInfo(st, ref) {
    let ent, kind;
    if (ref.u) { ent = unitById(st, ref.u); kind = 'u'; } else { ent = objById(st, ref.o); kind = 'o'; }
    if (!ent || ent.gone || ent.ko) return { ok: false, why: 'ない' };
    if (kind === 'u') {
      if (isHero(ent)) return { ok: false, why: '仲間は押さない' };
      if (ENEMY[ent.k].heavy && !(ent.frozen > 0)) return { ok: false, why: '重すぎて動かない（凍らせれば、すべるかも）', heavy: true };
      if (ENEMY[ent.k].swim) return { ok: false, why: '水霊には手ごたえがない（水ごと凍らせれば閉じこめられる）' };
      return { ok: true, ent, kind };
    }
    if (ent.k === 'pillar') {
      if (!st.up.gauntlet) return { ok: false, why: '重すぎて動かない', heavy: true };
      return { ok: true, ent, kind, topple: true };
    }
    if (!(ent.k === 'crate' || ent.k === 'block' || ent.k === 'iceblock' || ent.k === 'boulder')) return { ok: false, why: '押せない' };
    for (const o of st.objs) if (!o.gone && o !== ent && o.x === ent.x && o.y === ent.y && o.z > ent.z && (o.k === 'pillar' || o.k === 'boulder' || o.k === 'lantern')) return { ok: false, why: '上に重い物がのっている' };
    const u = unitAt(st, ent.x, ent.y);
    if (u) return { ok: false, why: '上にだれかが立っている' };
    return { ok: true, ent, kind };
  }

  // ---------- 行動の計画（どこに立って、何をするか） ----------
  // intent: {k:'move',x,y} {k:'push',ref,dir} {k:'shoot',ref} {k:'rope',o} {k:'freeze',x,y|ref} {k:'light'}
  function plan(st, heroId, intent) {
    const u = unitById(st, heroId);
    if (!u || u.ko) return { ok: false, why: '動けない' };
    const combat = st.mode === 'combat';
    if (combat && u.acted && intent.k !== 'move') return { ok: false, why: 'この手番は行動ずみ' };
    const max = combat ? u.mv : 999;
    const dist = reach(st, u, { max, ignoreUnits: !combat, linkCost: combat ? 2 : 1 });
    const okStand = (i) => {
      const x = i % st.W, y = (i / st.W) | 0;
      if (combat) { const o = unitAt(st, x, y, u); if (o) return false; }
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

    if (intent.k === 'move') {
      if (!inside(st, intent.x, intent.y)) return { ok: false, why: '外' };
      const i = idx(st, intent.x, intent.y);
      if (!dist.has(i)) { const why = whyNot(st, u, intent.x, intent.y, combat); return { ok: false, why, whyAt: whyNot.at }; }
      if (!okStand(i)) return { ok: false, why: 'そこには立てない' };
      return res(i);
    }
    if (intent.k === 'push') {
      if (heroId !== 'gard') return { ok: false, why: '押せるのはガルド' };
      const pi = pushInfo(st, intent.ref);
      if (!pi.ok) return { ok: false, why: pi.why, heavy: pi.heavy };
      const e = pi.ent;
      const [dx, dy] = DIRS[intent.dir];
      const sx = e.x - dx, sy = e.y - dy;
      if (!inside(st, sx, sy)) return { ok: false, why: 'そちら側に回れない' };
      const ss = surface(st, sx, sy);
      if (!ss.stand) return { ok: false, why: 'そちら側に立てない' };
      const ez = e.z;
      if (Math.abs(ss.z - ez) > 1) return { ok: false, why: '高さがちがって押せない' };
      const i = idx(st, sx, sy);
      if (!dist.has(i) || !okStand(i)) return { ok: false, why: combat ? 'そこまで歩けない' : 'そちら側に回れない' };
      return res(i, { topple: !!pi.topple });
    }
    if (intent.k === 'shoot' || intent.k === 'rope' || intent.k === 'freeze') {
      const need = intent.k === 'freeze' ? 'sena' : 'riko';
      if (heroId !== need) return { ok: false, why: need === 'sena' ? '凍らせられるのはセナ' : '射られるのはリコ' };
      let tx, ty, tz, R, extra = {};
      if (intent.k === 'rope') {
        const a = objById(st, intent.o);
        if (!a || a.k !== 'anchor') return { ok: false, why: 'ない' };
        tx = a.x; ty = a.y; tz = surface(st, tx, ty).z;
        R = st.up.rope2 ? RANGE.rope2 : RANGE.rope;
        if (unitAt(st, tx, ty, u)) return { ok: false, why: '輪の下にだれかいる' };
        if (u.x === tx && u.y === ty) return { ok: false, why: 'もう輪のところにいる' };
      } else if (intent.k === 'shoot') {
        R = RANGE.shoot;
        if (intent.ref.u) {
          const t = unitById(st, intent.ref.u);
          if (!t || t.ko || isHero(t)) return { ok: false, why: '射る相手がいない' };
          tx = t.x; ty = t.y; tz = t.z;
        } else {
          const o = objById(st, intent.ref.o);
          if (!o || o.k !== 'target' || o.hit) return { ok: false, why: 'もう当たっている' };
          tx = o.x; ty = o.y; tz = o.z;
        }
      } else {
        R = RANGE.freeze + (st.up.ring ? 1 : 0);
        if (intent.ref && intent.ref.u) {
          const t = unitById(st, intent.ref.u);
          if (!t || t.ko || isHero(t)) return { ok: false, why: 'ない' };
          tx = t.x; ty = t.y; tz = t.z;
        } else if (intent.ref && intent.ref.o) {
          const o = objById(st, intent.ref.o);
          if (!o || o.k !== 'fall' || o.frozen) return { ok: false, why: 'もう凍っている' };
          if (o.strong) return { ok: false, why: '水の勢いが強すぎて、凍らせても砕ける', strong: true };
          tx = o.bx; ty = o.by; tz = o.bz;
        } else {
          tx = intent.x; ty = intent.y; tz = st.h[idx(st, tx, ty)];
          if (!freezeCells(st, tx, ty).length) return { ok: false, why: '凍らせる水がない' };
        }
      }
      const cands = [];
      let tooHigh = false;
      for (const i of dist.keys()) {
        const x = i % st.W, y = (i / st.W) | 0;
        if (!inRange(x, y, tx, ty, R) || (x === tx && y === ty && intent.k !== 'freeze')) continue;
        // 鉤縄は、立っている所から2段上までしか届かない
        if (intent.k === 'rope' && tz - dist.get(i).z > 2) { tooHigh = true; continue; }
        cands.push(i);
      }
      const score = (i) => {
        if (intent.k !== 'shoot' || !intent.ref.u) return 0;
        const d = dist.get(i);
        return d.z >= tz + 2 ? -0.6 : 0;
      };
      const best = pick(cands, score);
      if (best === null && tooHigh) return { ok: false, why: '輪が高すぎる（鉤縄は2段上までしか届かない）', range: R };
      if (best === null) return { ok: false, why: combat ? 'この手番では届かない（距離' + R + 'まで）' : '届く場所がない（距離' + R + 'まで）', range: R };
      return res(best, Object.assign(extra, { tx, ty, tz, range: R }));
    }
    if (intent.k === 'light') {
      const L = st.objs.find(o => o.k === 'lantern' && !o.lit);
      if (!L) return { ok: false, why: 'ない' };
      const near = heroes(st).every(h => !h.ko && Math.abs(h.x - L.x) + Math.abs(h.y - L.y) <= 2);
      if (!near) return { ok: false, why: '三人そろって灯籠のそばへ' };
      return { ok: true, hero: heroId, intent, stand: [u.x, u.y], path: [idx(st, u.x, u.y)], cost: 0 };
    }
    return { ok: false, why: '?' };
  }

  function whyNot(st, u, x, y, combat) {
    whyNot.at = null;
    const s = surface(st, x, y);
    if (s.void) return '足場がない';
    if (s.fast) return '流れの速い水。凍らせられない（重い物を沈めれば飛び石になる）';
    if (s.water) return '深い水。歩いては渡れない';
    if (s.wall || s.block) return '立てない';
    if (combat) return 'この手番では届かない';
    // 行ける範囲のふちで、目的地にいちばん近い「越えられない境目」を説明する
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
      const i = idx(st, x, y);
      if (st.t[i] !== 'w') continue;
      // 木箱が沈んでいる升などは対象外
      out.push([x, y]);
    }
    return out;
  }

  // ---------- 行動の実行 ----------
  function apply(st, p) {
    const evs = [];
    const u = unitById(st, p.hero);
    const combat = st.mode === 'combat';
    const before = combat ? null : partyReach(st);
    // 移動
    if (p.path && p.path.length > 1) {
      if (combat) {
        const xyz = cellsXYZ(st, p.path);
        u.mv = Math.max(0, u.mv - p.cost);
        moveUnitTo(st, u, p.stand[0], p.stand[1]);
        evs.push({ k: 'walk', id: u.id, path: xyz });
        st.stats.steps = (st.stats.steps || 0) + xyz.length - 1;
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
      if (!combat) { triggersAt(st, evs); exitCheck(st, u, evs); }
      return evs;
    }
    u.face = faceTo(u.x, u.y, I.k === 'push' ? objOrUnitPos(st, I.ref)[0] : p.tx, I.k === 'push' ? objOrUnitPos(st, I.ref)[1] : p.ty, u.face);
    const credit = { who: [u.id], text: '', kills: 0, combo: false, big: 0 };
    if (I.k === 'push') doPush(st, u, I.ref, I.dir, evs, credit);
    else if (I.k === 'shoot') doShoot(st, u, I.ref, evs, credit);
    else if (I.k === 'rope') doRope(st, u, I.o, evs, credit);
    else if (I.k === 'freeze') doFreeze(st, u, I, evs, credit);
    else if (I.k === 'light') doLight(st, u, evs, credit);
    if (combat) { u.acted = true; u.mv = 0; }
    postCheck(st, evs, before, credit);
    return evs;
  }

  const VERB = { push: '押す', shoot: '射る', rope: '鉤縄で渡る', freeze: '凍らせる', light: '灯す' };
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

  // 探索中の移動：選んだ一人が先頭で歩き、二人がついてくる
  function partyWalk(st, lead, path, evs) {
    const W = st.W;
    let cut = path.length;
    // 途中で敵に気づかれたら、そこで止まる
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
    st.stats.steps = (st.stats.steps || 0) + path.length - 1;
    // ついてくる二人の目的地
    const others = heroes(st).filter(h => h !== lead && !h.ko);
    const taken = new Set([end]);
    for (const o of st.objs) if (!o.gone && (o.k === 'crate' || o.k === 'block' || o.k === 'iceblock' || o.k === 'anchor')) taken.add(idx(st, o.x, o.y));
    const trail = path.slice(0, -1).reverse();
    const goals = [];
    // 先頭のすぐそば（縄を渡らずに行ける升）から選ぶ。歩いてきた跡を優先
    const nearMap = reach(st, lead, { ignoreUnits: true, max: 3, noLinks: true });
    for (const i of trail) { if (goals.length >= others.length) break; if (nearMap.has(i) && !taken.has(i) && surface(st, i % W, (i / W) | 0).stand) { goals.push(i); taken.add(i); } }
    if (goals.length < others.length) {
      const near = [...nearMap.entries()].sort((a, b) => a[1].c - b[1].c);
      for (const [i] of near) { if (goals.length >= others.length) break; if (!taken.has(i) && surface(st, i % W, (i / W) | 0).stand) { goals.push(i); taken.add(i); } }
    }
    for (const i of trail) { if (goals.length >= others.length) break; if (!taken.has(i) && surface(st, i % W, (i / W) | 0).stand) { goals.push(i); taken.add(i); } }
    // 近い者から近い目的地へ
    others.sort((a, b) => d2(a.x, a.y, lead.x, lead.y) - d2(b.x, b.y, lead.x, lead.y));
    others.forEach((h, n) => {
      const g = goals[n];
      if (g === undefined) return;
      const dist = reach(st, h, { ignoreUnits: true });
      if (!dist.has(g)) {
        // 届かないなら、届く中で目的地にいちばん近い升（動かないのも可）
        return;
      }
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

  // 眠っている敵のそばに来たか。来たら群れの番号を返す
  function wakeCheck(st, x, y) {
    for (const e of enemies(st)) {
      if (e.ko || e.active) continue;
      if (x !== undefined) { if (inRange(x, y, e.x, e.y, e.wake)) return e.grp; continue; }
      for (const h of heroes(st)) if (!h.ko && inRange(h.x, h.y, e.x, e.y, e.wake)) return e.grp;
    }
    return 0;
  }
  function startCombat(st, grp, evs) {
    for (const e of enemies(st)) if (e.grp === grp && !e.ko) e.active = true;
    st.mode = 'combat'; st.turn = 1; st.grp = grp;
    st.stats.fights++;
    for (const h of heroes(st)) { h.acted = false; h.mv = HERO[h.k].mov; }
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
        evs.push({ k: 'collect', o: o.id, item: o.item, by: u.id, x: o.x, y: o.y, z: o.z });
        if (o.say) for (const s of o.say) evs.push({ k: 'say', who: s[0], text: s[1] });
      }
    }
  }

  function triggersAt(st, evs) {
    for (const tr of st.trig || []) {
      if (st.said[tr.id]) continue;
      if (tr.flag && !st.flags[tr.flag]) continue;
      const hit = heroes(st).some(h => !h.ko && h.x >= tr.r[0] && h.y >= tr.r[1] && h.x <= tr.r[2] && h.y <= tr.r[3]);
      if (!hit) continue;
      st.said[tr.id] = 1;
      for (const s of tr.say || []) evs.push({ k: 'say', who: s[0], text: s[1] });
    }
  }

  function exitCheck(st, u, evs) {
    const ex = st.objs.find(o => o.k === 'exit' && !o.gone && o.x === u.x && o.y === u.y);
    if (!ex) return;
    if (liveEnemies(st).some(e => e.active)) return;
    // 全員がたどり着けるか
    const W = st.W;
    const goal = idx(st, ex.x, ex.y);
    const group = [];
    for (const h of heroes(st)) {
      if (h === u) continue;
      const dist = reach(st, h, { ignoreUnits: true });
      if (!dist.has(goal)) { evs.push({ k: 'say', who: u.id, text: HERO[h.k].name + 'が、ここまで来られない。みんなで行こう' }); return; }
      const pth = pathTo(st, dist, goal);
      if (pth.length > 1) group.push({ k: 'walk', id: h.id, path: cellsXYZ(st, pth), follow: true });
      h.x = ex.x; h.y = ex.y; h.z = standZ(st, h.x, h.y, h);
    }
    if (group.length) evs.push(group.length > 1 ? { k: 'group', evs: group } : group[0]);
    st.flags.exited = true;
    evs.push({ k: 'exit', to: ex.to });
  }

  // ---------- ガルド：押す ----------
  function hurt(st, u, n, why, evs, credit) {
    if (u.ko || n <= 0) return;
    u.hp -= n;
    evs.push({ k: 'dmg', id: u.id, n, why, hp: Math.max(0, u.hp) });
    if (u.hp <= 0) ko(st, u, why, evs, credit);
  }
  function ko(st, u, how, evs, credit) {
    if (u.ko) return;
    u.ko = true; u.hp = Math.max(0, u.hp);
    if (how === 'void' || how === 'drown' || how === 'ice' || !isHero(u)) u.gone = true;
    evs.push({ k: 'ko', id: u.id, how });
    if (!isHero(u) && credit) {
      credit.kills++;
      st.stats.kills[credit.who[0]] = (st.stats.kills[credit.who[0]] || 0) + 1;
    }
  }

  function fallDmg(drop) { return drop >= 4 ? 99 : drop === 3 ? 3 : drop === 2 ? 1 : 0; }

  function doPush(st, g, ref, dir, evs, credit) {
    st.stats.push++;
    const pi = pushInfo(st, ref);
    if (!pi.ok) { credit.text = '押せなかった（' + pi.why + '）'; return; }
    const ent = pi.ent;
    evs.push({ k: 'act', id: g.id, verb: 'push', tx: ent.x, ty: ent.y, tz: ent.z, dir });
    if (pi.topple) return topple(st, g, ent, dir, evs, credit);
    const isU = pi.kind === 'u';
    const [dx, dy] = DIRS[dir];
    const slip = (isU && ent.frozen > 0) || ent.k === 'iceblock';
    const roll = ent.k === 'boulder';
    if (slip && (ent.frozenBy || ent.by) === 'sena') { addWho(credit, 'sena'); }
    if (isU) hurt(st, ent, 1, 'push', evs, credit);
    if (isU && ent.ko) return;
    let x = ent.x, y = ent.y, z = ent.z;
    const path = [[x, y, z]];
    const ref2 = isU ? { u: ent.id } : { o: ent.id };
    let end = 'stop', bumpInto = null, steps = 0, iceUsed = false, crushed = 0;
    const flyer = isU && fly(ent);
    while (steps++ < 40) {
      const nx = x + dx, ny = y + dy;
      const s = surface(st, nx, ny, isU ? null : ent);
      const occ = unitAt(st, nx, ny, isU ? ent : null);
      if (flyer) {
        // 飛ぶ者は一升だけ押される
        if (s.out || (s.block && s.blockTop > z + 1) || s.wall || occ) { end = 'bump'; bumpInto = occ; break; }
        x = nx; y = ny; path.push([x, y, s.void || s.water ? z : Math.max(s.z, z - 0)]);
        break;
      }
      if ((s.void || s.out) && !occ) {
        x = nx; y = ny; path.push([x, y, z]); path.push([x, y, z - 14]);
        end = 'void'; break;
      }
      const top = s.block ? Math.max(s.z, s.blockTop) : s.z;
      if (top > z) { end = 'bump'; bumpInto = s.block || 'wall'; break; }
      if (occ) {
        if (occ.z >= z - 1) {
          if (roll && !isHero(occ)) {
            hurt(st, occ, 3, 'crush', evs, credit); crushed++;
            if (occ.ko) { x = nx; y = ny; z = s.z; path.push([x, y, z]); continue; }
          }
          end = 'bump'; bumpInto = occ; break;
        }
        // 下にいる者の上へ落ちる
        if (!isU) {
          path.push([nx, ny, z]);
          evs.push({ k: 'slide', ref: ref2, path: path.slice(), roll });
          hurt(st, occ, 3, 'rock', evs, credit);
          if (occ.ko) { ent.x = nx; ent.y = ny; ent.z = s.z; evs.push({ k: 'fall', ref: ref2, from: [nx, ny, z], to: [nx, ny, s.z], drop: z - s.z }); afterLand(st, ent, evs, credit); }
          else { ent.gone = true; evs.push({ k: 'break', ref: ref2, x: nx, y: ny, z: occ.z + 2 }); }
          return finishPushCaption(st, g, ent, isU, 'rock', credit, iceUsed, evs);
        }
        end = 'bump'; bumpInto = occ; break;
      }
      x = nx; y = ny;
      const drop = z - s.z;
      z = s.z;
      path.push([x, y, z]);
      if (s.ice) { iceUsed = true; const i = idx(st, x, y); if (st.by[i] === 'sena') addWho(credit, 'sena'); }
      if (s.water) { end = isU ? (ENEMY[ent.k].swim ? 'stop' : 'drown') : 'sink'; break; }
      if (isU && drop >= 2) {
        const fd = fallDmg(drop);
        if (fd) { end = 'fall'; ent._fallDmg = fd; ent._drop = drop; break; }
      }
      if (s.plate && !isU) { end = 'plate'; break; }
      if (!(slip || roll || s.ice)) { end = 'stop'; break; }
    }
    // 結果を反映
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
      if (bumpInto && bumpInto.team) hurt(st, bumpInto, 1, 'bump', evs, credit);
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
    return finishPushCaption(st, g, ent, isU, end, credit, iceUsed, evs, path, crushed);
  }
  function addWho(credit, w) { if (credit.who.indexOf(w) < 0) { credit.who.push(w); credit.combo = true; } }

  function finishPushCaption(st, g, ent, isU, end, credit, iceUsed, evs, path, crushed) {
    const name = isU ? ENEMY[ent.k].name : objName(ent);
    const moved = path ? path.length - 1 : 0;
    let t = '';
    if (end === 'void' && iceUsed && moved > 1) t = name + 'は氷の上をすべって、谷底へ落ちていった';
    else if (end === 'void') t = name + 'は谷底へ落ちていった';
    else if (end === 'drown') t = name + 'は水に沈んだ';
    else if (end === 'sink' && credit.sinkLabel) t = credit.sinkLabel;
    else if (end === 'sink' && iceUsed && moved > 1) t = name + 'は氷の上をすべり、水に沈んで飛び石になった';
    else if (end === 'sink') t = name + 'が水に沈んで、飛び石になった';
    else if (end === 'rock') t = name + 'を落として、下の敵にぶつけた';
    else if (end === 'fall') t = ent.ko ? name + 'は段の下へ落ちて倒れた' : name + 'は段の下へ落ちた';
    else if (end === 'bump') t = moved ? name + 'はすべって、ぶつかった' : name + 'はぶつかって止まった';
    else if (end === 'plate') t = name + 'が床の仕掛けにのった';
    else if (!isU && ent.z !== undefined && path && path.length > 1 && path[0][2] > ent.z) t = name + 'が段の下へ落ちて、足場になった';
    else if (iceUsed && moved > 1) t = name + 'は氷の上をすべっていった';
    else t = name + 'を押した';
    if (crushed) t = name + 'が転がり、' + crushed + '体をなぎ倒した';
    if (isU && ent.ko && end === 'bump') t = name + 'はぶつかって倒れた';
    credit.text = t;
  }

  function objName(o) {
    return { crate: '木箱', block: '石のブロック', iceblock: '氷のかたまり', boulder: '大岩', pillar: '石柱' }[o.k] || '物';
  }

  function sink(st, o, evs, credit) {
    const i = idx(st, o.x, o.y);
    o.gone = true;
    st.t[i] = o.k === 'iceblock' ? 'i' : o.k === 'crate' ? 'c' : 'k';
    st.by[i] = 'gard';
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
      if (occ && !isHero(occ)) hurt(st, occ, 99, 'crush', evs, credit);
      const b = { id: 'o' + (st.seq++), k: 'beam', x, y, z: p.z, dir, by: 'gard' };
      st.objs.push(b); beams.push(b);
    }
    evs.push({ k: 'topple', o: p.id, dir, x: p.x, y: p.y, z: p.z, beams: clone(beams) });
    credit.text = cells.length >= 2 ? '石柱が倒れて、橋になった' : '石柱が倒れた';
    if (credit.kills) credit.text = '石柱が倒れて、' + credit.kills + '体を押しつぶした';
  }

  // ---------- リコ：射る・鉤縄 ----------
  function doShoot(st, r, ref, evs, credit) {
    st.stats.shoot++;
    if (ref.u) {
      const t = unitById(st, ref.u);
      let n = 2;
      const high = r.z >= t.z + 2;
      if (high) n++;
      const shatter = t.frozen > 0;
      if (shatter) { n++; if (t.frozenBy === 'sena') addWho(credit, 'sena'); }
      evs.push({ k: 'act', id: r.id, verb: 'shoot', tx: t.x, ty: t.y, tz: t.z });
      evs.push({ k: 'arrow', from: [r.x, r.y, r.z], to: [t.x, t.y, t.z], hit: true });
      hurt(st, t, n, 'arrow', evs, credit);
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
    st.stats.rope++;
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
    credit.text = '鉄の輪に鉤縄をかけて渡った。縄はみんなの道になる';
    collectAt(st, r, evs);
  }

  // ---------- セナ：凍らせる ----------
  function doFreeze(st, s, I, evs, credit) {
    st.stats.freeze++;
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
        credit.kills++; st.stats.kills.sena++;
        credit.text = '粘体が凍って、氷のかたまりになった（押せる・のれる）';
        return;
      }
      t.frozen = 1; t.frozenBy = 'sena';
      evs.push({ k: 'freezeUnit', id: t.id });
      hurt(st, t, 1, 'frost', evs, credit);
      if (!t.ko && ENEMY[t.k].fly) {
        // 飛べなくなって落ちる
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
      evs.push({ k: 'act', id: s.id, verb: 'freeze', tx: f.bx, ty: f.by, tz: f.bz });
      evs.push({ k: 'frost', from: [s.x, s.y, s.z], to: [f.bx, f.by, f.bz + 1] });
      f.frozen = true;
      if (f.final) credit.climax = true;
      const L = { k: 'ice', a: [f.bx, f.by], b: [f.x, f.y], o: f.id, by: 'sena' };
      st.links.push(L);
      // 滝つぼも凍る
      const cells = freezeCells(st, f.bx, f.by);
      for (const [x, y] of cells) { const i = idx(st, x, y); st.t[i] = 'i'; st.by[i] = 'sena'; }
      evs.push({ k: 'freezeFall', o: f.id, link: clone(L), cells, final: !!f.final });
      credit.text = f.label || '滝が凍って、のぼれる氷の段になった';
      if (f.frozenSay) for (const s2 of f.frozenSay) evs.push({ k: 'say', who: s2[0], text: s2[1] });
      return;
    }
    const cells = freezeCells(st, I.x, I.y);
    evs.push({ k: 'act', id: s.id, verb: 'freeze', tx: I.x, ty: I.y, tz: st.h[idx(st, I.x, I.y)] });
    evs.push({ k: 'frost', from: [s.x, s.y, s.z], to: [I.x, I.y, st.h[idx(st, I.x, I.y)]] });
    for (const [x, y] of cells) { const i = idx(st, x, y); st.t[i] = 'i'; st.by[i] = 'sena'; }
    evs.push({ k: 'freezeCells', cells, by: 'sena', cx: I.x, cy: I.y });
    // 水にいた水霊は閉じこめられる
    for (const [x, y] of cells) { const e = unitAt(st, x, y); if (e && !isHero(e) && ENEMY[e.k].swim) ko(st, e, 'ice', evs, credit); }
    credit.text = '水が凍って、歩ける氷の床になった' + (credit.kills ? '（水霊を閉じこめた）' : '');
  }

  function doLight(st, u, evs, credit) {
    const L = st.objs.find(o => o.k === 'lantern' && !o.lit);
    L.lit = true;
    credit.who = HERO_IDS.slice(); credit.combo = true; credit.noMoment = true;
    evs.push({ k: 'light', o: L.id });
    credit.text = '三人で、大灯籠に火を入れた';
    st.flags.lit = true;
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
      else if (op === 'calm' && o) {
        o.strong = Math.max(0, (o.strong === true ? 1 : (o.strong || 0)) - 1);
        evs.push({ k: 'calm', o: o.id, left: o.strong });
        if (!o.strong) { o.strong = false; if (o.calmSay) for (const s of o.calmSay) evs.push({ k: 'say', who: s[0], text: s[1] }); }
        else if (o.halfSay) for (const s of o.halfSay) evs.push({ k: 'say', who: s[0], text: s[1] });
      }
      else if (op === 'flag') { st.flags[id] = true; }
      else if (op === 'drain') { drain(st, id, evs); }
    }
  }
  function drain(st, id, evs) {
    // 水を抜く（id のついた水の升を床にする）
    const cells = [];
    for (const d of st.drains || []) if (d.id === id) for (const [x, y, z] of d.cells) { const i = idx(st, x, y); if (st.t[i] === 'w') { st.t[i] = 'd'; st.h[i] = z; cells.push([x, y, z]); } }
    evs.push({ k: 'drain', cells });
  }

  // ---------- 行動のあと ----------
  function postCheck(st, evs, before, credit) {
    // 戦いの決着
    if (st.mode === 'combat') {
      const live = liveEnemies(st).filter(e => e.active);
      if (!live.length) winCombat(st, evs);
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
    // 道がひらけたか
    if (st.mode === 'explore' && before) {
      const after = after0 || partyReach(st);
      const fresh = [];
      for (const k of after) if (!before.has(k)) fresh.push(k);
      if (fresh.length) {
        const cells = fresh.map(i => [i % st.W, (i / st.W) | 0, surface(st, i % st.W, (i / st.W) | 0).z]);
        const poi = [];
        for (const o of st.objs) {
          if (o.gone) continue;
          if (!['chest', 'exit', 'anchor', 'target', 'lantern', 'fall'].includes(o.k)) continue;
          if (o.k === 'chest' && o.open) continue;
          if (o.k === 'target' && o.hit) continue;
          let near = false;
          if (o.k === 'chest' || o.k === 'exit' || o.k === 'lantern') near = after.has(idx(st, o.x, o.y)) && cells.some(c => Math.abs(c[0] - o.x) + Math.abs(c[1] - o.y) <= 2);
          else if (o.k === 'anchor') near = cells.some(c => inRange(c[0], c[1], o.x, o.y, st.up.rope2 ? RANGE.rope2 : RANGE.rope)) && !after.has(idx(st, o.x, o.y));
          else if (o.k === 'target') near = cells.some(c => inRange(c[0], c[1], o.x, o.y, RANGE.shoot));
          else if (o.k === 'fall') near = !o.frozen && cells.some(c => inRange(c[0], c[1], o.bx, o.by, RANGE.freeze));
          if (near) poi.push(o.id);
        }
        evs.push({ k: 'bloom', cells, poi, who: credit ? credit.who.slice() : [] });
        if (credit) credit.big = fresh.length;
      }
    }
    if (credit && credit.text) {
      const score = (credit.big || 0) + credit.kills * 6 + (credit.combo ? 8 : 0) + (credit.climax ? 300 : 0);
      if (score >= 6 && !credit.noMoment) {
        st.moments.push({ sec: st.sec, who: credit.who.slice(), text: credit.text, score, cells: credit.big || 0, kills: credit.kills });
        st.moments.sort((a, b) => b.score - a.score);
        if (st.moments.length > 12) st.moments.length = 12;
      }
    }
  }

  function winCombat(st, evs) {
    st.mode = 'explore';
    for (const h of heroes(st)) { h.ko = false; h.hp = h.mhp; h.acted = false; h.mv = HERO[h.k].mov; h.frozen = 0; }
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
    for (const h of heroes(st)) { h.acted = h.ko; h.mv = h.ko ? 0 : HERO[h.k].mov; }
    evs.push({ k: 'phase', side: 'player', turn: st.turn });
    return evs;
  }

  // 敵の思考（決定的）
  function enemyPhase(st, evs, record) {
    const list = liveEnemies(st).filter(e => e.active).sort((a, b) => a.id < b.id ? -1 : 1);
    for (const e of list) {
      if (e.ko) continue;
      if (e.frozen > 0) {
        e.frozen--;
        evs.push({ k: 'frozenSkip', id: e.id, left: e.frozen });
        if (record) record.push({ id: e.id, frozen: true });
        continue;
      }
      const E = ENEMY[e.k];
      const dist = reach(st, e, { max: e.mv });
      let best = null;
      const hs = heroes(st).filter(h => !h.ko);
      if (!hs.length) break;
      for (const [i, d] of dist) {
        const x = i % st.W, y = (i / st.W) | 0;
        const occ = unitAt(st, x, y, e);
        if (occ) continue;
        const zc = d.z;
        for (const h of hs) {
          let can = false;
          if (E.ranged) can = inRange(x, y, h.x, h.y, E.range) && !(x === h.x && y === h.y);
          else can = Math.abs(x - h.x) + Math.abs(y - h.y) === 1 && Math.abs(zc - h.z) <= 1 + (E.fly ? 2 : 0);
          if (!can) continue;
          let dmg = E.atk + (E.ranged && zc >= h.z + 2 ? 1 : 0);
          let score = dmg * 10 - h.hp - d.c * 0.3 + (E.ranged ? zc * 0.4 : 0) + (dmg >= h.hp ? 6 : 0);
          // 崖っぷちは少し避ける（押し落とされたくない）
          score -= edgeRisk(st, x, y, zc) * 0.8;
          if (!best || score > best.score + 1e-9) best = { score, i, h, dmg, x, y };
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
        evs.push({ k: 'eatk', id: e.id, target: best.h.id, ranged: !!E.ranged, from: [e.x, e.y, e.z], to: [best.h.x, best.h.y, best.h.z] });
        hurt(st, best.h, best.dmg, 'enemy', evs, null);
        if (record) record.push({ id: e.id, to: [e.x, e.y], target: best.h.id, dmg: best.dmg });
        if (heroes(st).every(h => h.ko)) { evs.push({ k: 'lose' }); st.lost = true; return; }
        continue;
      }
      // 近づく
      const all = reach(st, e, { max: 99 });
      let goal = null, gd = 1e9;
      for (const h of hs) {
        for (const [dx, dy] of DIRS) {
          const gi = inside(st, h.x + dx, h.y + dy) ? idx(st, h.x + dx, h.y + dy) : -1;
          if (gi >= 0 && all.has(gi) && all.get(gi).c < gd) { gd = all.get(gi).c; goal = gi; }
        }
      }
      if (goal === null) { if (record) record.push({ id: e.id, idle: true }); continue; }
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

  // 敵の次の動きの予告（いま手番を終えたら）
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
    if (!u || u.ko) return out;
    const tryP = (intent) => { const p = plan(st, heroId, intent); if (p.ok) out.push(p); };
    if (heroId === 'gard') {
      for (const o of st.objs) if (!o.gone && ['crate', 'block', 'iceblock', 'boulder', 'pillar'].includes(o.k)) for (let d = 0; d < 4; d++) tryP({ k: 'push', ref: { o: o.id }, dir: d });
      for (const e of liveEnemies(st)) if (e.active || st.mode === 'explore') for (let d = 0; d < 4; d++) tryP({ k: 'push', ref: { u: e.id }, dir: d });
    }
    if (heroId === 'riko') {
      for (const o of st.objs) if (!o.gone && o.k === 'anchor') tryP({ k: 'rope', o: o.id });
      for (const o of st.objs) if (!o.gone && o.k === 'target' && !o.hit) tryP({ k: 'shoot', ref: { o: o.id } });
      for (const e of liveEnemies(st)) if (e.active) tryP({ k: 'shoot', ref: { u: e.id } });
    }
    if (heroId === 'sena') {
      const seen = new Set();
      for (let y = 0; y < st.H; y++) for (let x = 0; x < st.W; x++) if (st.t[idx(st, x, y)] === 'w') { const key = x + ',' + y; if (!seen.has(key)) { seen.add(key); tryP({ k: 'freeze', x, y }); } }
      for (const o of st.objs) if (!o.gone && o.k === 'fall' && !o.frozen) tryP({ k: 'freeze', ref: { o: o.id } });
      for (const e of liveEnemies(st)) if (e.active) tryP({ k: 'freeze', ref: { u: e.id } });
    }
    return out;
  }

  // 結果の見こみ（試しに実行して、何が起きるかをまとめる）
  function preview(st, p) {
    const c = clone(st);
    const evs = apply(c, p);
    const flat = [];
    const walk = (l) => { for (const e of l) { if (e.k === 'group') walk(e.evs); else flat.push(e); } };
    walk(evs);
    const out = { evs: flat, dmg: {}, ko: [], cap: null, bloom: 0, moves: {} };
    for (const e of flat) {
      if (e.k === 'dmg') out.dmg[e.id] = (out.dmg[e.id] || 0) + e.n;
      if (e.k === 'ko') out.ko.push(e.id);
      if (e.k === 'caption') out.cap = e;
      if (e.k === 'bloom') out.bloom = e.cells.length;
      if (e.k === 'slide' || e.k === 'fall') { const key = e.ref.u || e.ref.o; out.moves[key] = e.path ? e.path[e.path.length - 1] : e.to; }
    }
    out.state = c;
    return out;
  }

  const api = {
    DIRS, HERO, HERO_IDS, ENEMY, RANGE, OBJ_H,
    clone, idx, inside, inRange, create, surface, standZ, canStep, reach, pathTo, partyReach,
    plan, apply, preview, options, intents, endPlayerPhase, startCombat, wakeCheck, triggersAt,
    unitById, objById, unitAt, heroes, enemies, liveEnemies, freezeCells, pushInfo, objName, whyNot, isHero, fly, faceTo,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.S19 = api;
})(typeof window !== 'undefined' ? window : globalThis);
