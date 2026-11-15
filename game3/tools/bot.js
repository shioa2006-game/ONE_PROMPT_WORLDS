// Playthrough bot. Node: `node tools/bot.js [skilled|naive] [seed] [-v]`.
// Browser: load this file, then EMB.debug.bot = EMB.makeBot(() => EMB.S.g, true) (see NOTES).
(function (root) {
const EMB = root.EMB || require('../js/sim.js');
const T = EMB.T, hyp = Math.hypot;
EMB.makeBot = function (getG, SK) {
let g = getG();
// goal list ---------------------------------------------------------------
const GOALS = [
  { z: 0, hit: [25, 21] }, { z: 0, hit: [45, 20] },
  { z: 0, hit: [37, 5] }, { z: 0, hit: [49, 9] }, { z: 0, chest: [55, 6] },
  { z: 0, hit: [40, 38] }, { z: 0, arena: 'ra', at: [63, 36] }, { z: 0, chest: [63, 35] },
  { z: 0, lamp: 'L2', at: [60, 21] }, { z: 0, arena: 'boss1', at: [77, 24] }, { z: 0, stairs: [91, 21], to: 1 },
  { z: 1, lamp: 'L3', at: [49, 29] },
  { z: 1, hit: [29, 26] }, { z: 1, chest: [19, 11] }, { z: 1, hit: [21, 33], from: [21.5, 30.6], w: 'spear' },
  { z: 1, arena: 'a3', at: [8, 26] }, { z: 1, lamp: 'L4', at: [7, 28] }, { z: 1, chest: [7, 31] },
  { z: 1, warp: 'L3' },
  { z: 1, hit: [65, 24] }, { z: 1, chest: [70, 49] }, { z: 1, crack: [81, 28], from: [80.5, 28.5], w: 'hammer' }, { z: 1, crack: [81, 29], from: [80.5, 29.5], w: 'hammer' },
  { z: 1, arena: 'b3', at: [88, 28] }, { z: 1, lamp: 'L5', at: [90, 29] }, { z: 1, chest: [90, 32] },
  { z: 1, warp: 'L3b' }, { z: 1, stairs: [49, 46], to: 2 },
  { z: 2, lamp: 'L6', at: [27, 5] }, { z: 2, lamp: 'L7', at: [30, 30] }, { z: 2, arena: 'final', at: [30, 42] }, { z: 2, heart: [30, 50] }
];
let gi = 0;
function objAt(x, y, k) { return g.z.objs.find(o => o.x === x && o.y === y && (!k || o.k === k)); }
function spawnAt(z, x, y, k) { return g.defs[z].spawns.find(s => s.x === x && s.y === y && s.k === k); }
function goalDone(G) {
  g = getG();
  if (G.hit) return !!g.flags.lit[spawnAt(G.z, G.hit[0], G.hit[1], 'brazier').id];
  if (G.chest) return !!g.flags.chests[spawnAt(G.z, G.chest[0], G.chest[1], 'chest').id];
  if (G.crack) return !!g.flags.cracks[spawnAt(G.z, G.crack[0], G.crack[1], 'crack').id];
  if (G.arena) return !!g.flags.cleared[g.defs[G.z].id + '.' + G.arena];
  if (G.lamp) return !!g.flags.lamps[G.lamp] && G.rested;
  if (G.stairs) return g.z.i === G.to;
  if (G.warp) return !!G.done;
  if (G.heart) return g.ended;
}

// pathfinding ---------------------------------------------------------------
function walk(x, y) { const z = g.z; if (x < 0 || y < 0 || x >= z.w || y >= z.h) return false; const i = y * z.w + x; return z.tiles[i] === T.FLOOR && !z.solid[i]; }
function path(sx, sy, goalFn) {
  const z = g.z, W = z.w, prev = new Int32Array(W * z.h).fill(-2), q = [sx + sy * W]; prev[q[0]] = -1;
  const roll = new Uint8Array(W * z.h);
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi], cx = c % W, cy = (c - cx) / W;
    if (goalFn(cx, cy)) { const out = []; let k = c; while (prev[k] !== -1) { out.push({ x: k % W, y: (k - k % W) / W, roll: roll[k] }); k = prev[k]; } return out.reverse(); }
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let nx = cx + d[0], ny = cy + d[1], r = 0;
      if (!walk(nx, ny)) { if (g.tile(nx, ny) === T.PIT && walk(nx + d[0], ny + d[1])) { nx += d[0]; ny += d[1]; r = 1; } else continue; }
      const n = nx + ny * W; if (prev[n] !== -2) continue; prev[n] = c; roll[n] = r; q.push(n);
    }
  }
  return null;
}
const inp = {};
function clear() { inp.mx = 0; inp.my = 0; inp.attack = false; inp.roll = false; inp.flare = false; inp.flask = false; inp.interact = false; inp.swap = false; inp.aim = undefined; }
let pathCache = null, pathT = 0;
function moveTo(tx, ty, goalFn) {
  const p = g.p, px = Math.floor(p.x), py = Math.floor(p.y);
  if (hyp(tx - p.x, ty - p.y) < 1.2 && g.los(p.x, p.y, tx, ty) && g.tile(Math.floor(tx), Math.floor(ty)) !== T.PIT) { go(tx, ty); return true; }
  const pa = path(px, py, goalFn || ((x, y) => x === Math.floor(tx) && y === Math.floor(ty)));
  if (!pa) return false;
  if (!pa.length) { go(tx, ty); return true; }
  const n = pa[0];
  if (n.roll) {
    // align on axis then roll
    const dx = n.x - px, dy = n.y - py; const cx = px + 0.5, cy = py + 0.5;
    const off = dx ? Math.abs(p.y - cy) : Math.abs(p.x - cx);
    if (off > 0.12) { go(dx ? p.x : cx, dx ? cy : p.y); }
    else { inp.mx = Math.sign(dx); inp.my = Math.sign(dy); if (p.state === 'idle' && p.rollCd <= 0) inp.roll = true; }
    return true;
  }
  // look ahead for straight-line shortcut
  let t = n; for (let i = Math.min(pa.length - 1, 3); i > 0; i--) { if (!pa.slice(0, i + 1).some(s => s.roll) && clearLine(p.x, p.y, pa[i].x + 0.5, pa[i].y + 0.5)) { t = pa[i]; break; } }
  go(t.x + 0.5, t.y + 0.5); return true;
}
function clearLine(x0, y0, x1, y1) {
  const d = hyp(x1 - x0, y1 - y0), n = Math.ceil(d / 0.2);
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (g.blocked(x, y, 0.32, true)) return false; }
  return true;
}
function go(x, y) { const p = g.p, dx = x - p.x, dy = y - p.y, d = hyp(dx, dy); if (d > 0.05) { inp.mx = dx / d; inp.my = dy / d; } }
function selectWeapon(id) { const p = g.p; if (p.weapons[p.wi] === id) return true; if (p.weapons.indexOf(id) < 0) return true; if (p.state === 'idle') inp.swap = true; return false; }
function adj(ox, oy) { return (x, y) => Math.abs(x - ox) + Math.abs(y - oy) === 1; }

// combat ---------------------------------------------------------------
function threats() {
  const p = g.p, z = g.z; let th = null;
  for (const e of z.enemies) {
    if (e.dead) continue; const d = hyp(e.x - p.x, e.y - p.y);
    if (e.state === 'wind' && e.T - e.t < 0.2) {
      if (e.type === 'spitter') continue;
      const sweep = (e.type === 'knight' || e.type === 'eater') && e.atk === 'sweep';
      if (e.type === 'eater' && e.atk === 'burst') continue;
      const reach = sweep ? 3.3 : e.type === 'blob' ? 2.8 : e.type === 'brood' ? 4 : 8;
      if (d < reach) th = { a: sweep ? Math.atan2(p.y - e.y, p.x - e.x) : e.aim + Math.PI / 2 * (EMB.angDiff(Math.atan2(p.y - e.y, p.x - e.x), e.aim) > 0 ? 1 : -1) };
    }
    if (e.state === 'atk' && d < 2 && e.type !== 'spitter' && p.inv <= 0) th = th || { a: e.aim + Math.PI / 2 };
    if (e.state === 'fallw' && d < 2.2) th = { a: Math.atan2(p.y - e.y, p.x - e.x), run: true };
  }
  for (const l of z.lobs) if (l.T - l.t < 0.45 && hyp(l.tx - p.x, l.ty - p.y) < l.r + 0.4) th = { a: Math.atan2(p.y - l.ty, p.x - l.tx) || 0, run: l.T - l.t > 0.25 };
  for (const r of z.rings) { const d = hyp(p.x - r.x, p.y - r.y); if (!r.hit && d > r.rad && d - r.rad < 0.9) th = { a: Math.atan2(r.y - p.y, r.x - p.x) }; }
  for (const s of z.shots) { const d = hyp(s.x - p.x, s.y - p.y); if (d < 1.1) th = { a: Math.atan2(s.vy, s.vx) + Math.PI }; }
  return th;
}
function fight() {
  const p = g.p, z = g.z;
  const es = z.enemies.filter(e => !e.dead && (e.aggro || e.wave));
  if (!es.length) return false;
  const w = g.weapon();
  if (SK) {
    const th = threats();
    if (th) {
      if (th.run) { inp.mx = Math.cos(th.a); inp.my = Math.sin(th.a); return true; }
      if (p.rollCd <= 0 && (p.state === 'idle' || p.state === 'attack')) {
        // pick a roll direction that doesn't end in a pit/wall
        for (const off of [0, Math.PI, 0.8, -0.8]) { const a = th.a + off, ex = p.x + Math.cos(a) * 2.6, ey = p.y + Math.sin(a) * 2.6; if (g.tile(Math.floor(ex), Math.floor(ey)) === T.FLOOR || off === -0.8) { inp.mx = Math.cos(a); inp.my = Math.sin(a); inp.roll = true; return true; } }
      }
    }
    if (p.hp < g.maxhp() * 0.45 && p.flasks > 0 && p.state === 'idle') { inp.flask = true; return true; }
    if (p.hasFlare && p.flare >= 100 && es.some(e => !e.air && hyp(e.x - p.x, e.y - p.y) < 2.6)) { inp.flare = true; return true; }
  } else if (p.hp < g.maxhp() * 0.35 && p.flasks > 0 && p.state === 'idle') { inp.flask = true; return true; }
  // final boss: light braziers
  const boss = es.find(e => e.type === 'eater');
  if (boss && SK && boss.state !== 'scorch') {
    const un = z.objs.filter(o => o.k === 'brazier' && !o.lit);
    if (un.length) { un.sort((a, b) => hyp(a.cx - p.x, a.cy - p.y) - hyp(b.cx - p.x, b.cy - p.y)); const b = un[0]; if (hyp(b.cx - p.x, b.cy - p.y) < 1.5) { inp.attack = true; inp.aim = Math.atan2(b.cy - p.y, b.cx - p.x); } else moveTo(b.cx, b.cy, adj(b.x, b.y)); return true; }
  }
  let t = null, bd = 1e9;
  for (const e of es) { let d = hyp(e.x - p.x, e.y - p.y); if (e.air) d += 50; if (e.type === 'spitter') d -= 1.5; if (d < bd) { bd = d; t = e; } }
  const d = hyp(t.x - p.x, t.y - p.y), a = Math.atan2(t.y - p.y, t.x - p.x);
  if (t.air) { inp.mx = -Math.cos(a); inp.my = -Math.sin(a); return true; }
  if (SK && t.type === 'shell' && !w.hammer && t.stun <= 0 && t.state !== 'rec') {
    if (p.weapons.indexOf('hammer') >= 0) { selectWeapon('hammer'); return true; }
    // circle to its back
    const back = t.face + Math.PI, bx = t.x + Math.cos(back) * 1.3, by = t.y + Math.sin(back) * 1.3;
    if (Math.abs(EMB.angDiff(t.face, a + Math.PI)) >= 1.15 && d < 1.9) { inp.attack = true; inp.aim = a; return true; }
    if (!moveTo(bx, by)) go(bx, by); return true;
  }
  if (d - t.r < w.range * 0.8 && g.los(p.x, p.y, t.x, t.y)) { inp.attack = true; inp.aim = SK ? a : undefined; if (!SK) { inp.mx = Math.cos(a) * 0.01; inp.my = Math.sin(a) * 0.01; g.p.face = a; } return true; }
  if (!moveTo(t.x, t.y, (x, y) => hyp(x + 0.5 - t.x, y + 0.5 - t.y) < 1.3)) go(t.x, t.y);
  return true;
}


let stuckT = 0, lastPos = [0, 0], frames = 0, hurtN = 0, hurtD = 0, goalStart = 0; const log = [];
function note(s) { const p = g.p; const line = `[${(g.stats.time / 60).toFixed(1)}m] ${s}  (Lv${p.lvl} hp${p.hp}/${g.maxhp()} atk${g.atk()} cry${p.cry} deaths${g.stats.deaths})`; log.push(line); }
function shop() { let b = true; while (b) { b = false; const p = g.p; const first = p.forge.blade <= p.forge.cloak ? 'blade' : 'cloak'; if (g.buy(first) || g.buy(first === 'blade' ? 'cloak' : 'blade')) b = true; } }
function step() {
  g = getG(); clear(); frames++;
  const p = g.p;
  while (gi < GOALS.length && goalDone(GOALS[gi])) { note('done ' + JSON.stringify(GOALS[gi]) + ' hurt ' + hurtN + '/' + hurtD + ' in ' + (g.stats.time - goalStart).toFixed(0) + 's'); hurtN = hurtD = 0; gi++; goalStart = g.stats.time; }
  if (gi >= GOALS.length) return inp;
  const G = GOALS[gi];
  if (p.state !== 'dead' && !fight()) {
    if (p.hp < g.maxhp() * 0.6 && p.flasks > 0 && p.state === 'idle') inp.flask = true;
    else if (G.z !== g.z.i) { const st = g.z.objs.find(o => o.k === 'stairs' && o.s.down === (G.z > g.z.i)); moveTo(st.cx, st.cy); }
    else if (G.hit || G.crack) {
      const t = G.hit || G.crack;
      if (!G.w || selectWeapon(G.w)) {
        if (G.from) { if (hyp(G.from[0] - p.x, G.from[1] - p.y) > 0.12) moveTo(G.from[0], G.from[1]); else { inp.attack = true; inp.aim = Math.atan2(t[1] + 0.5 - p.y, t[0] + 0.5 - p.x); } }
        else if (hyp(t[0] + 0.5 - p.x, t[1] + 0.5 - p.y) < 1.45) { inp.attack = true; inp.aim = Math.atan2(t[1] + 0.5 - p.y, t[0] + 0.5 - p.x); }
        else if (!moveTo(t[0] + 0.5, t[1] + 0.5, adj(t[0], t[1]))) stuckT += 1;
      }
    } else if (G.chest || G.heart) {
      const t = G.chest || G.heart;
      if (hyp(t[0] + 0.5 - p.x, t[1] + 0.5 - p.y) < 1.4) inp.interact = true; else if (!moveTo(t[0] + 0.5, t[1] + 0.5, adj(t[0], t[1]))) stuckT += 1;
    } else if (G.arena) { if (!moveTo(G.at[0] + 0.5, G.at[1] + 0.5)) stuckT += 1; }
    else if (G.lamp) {
      if (hyp(G.at[0] + 0.5 - p.x, G.at[1] + 0.5 - p.y) < 1.4) { inp.interact = true; }
      else if (!moveTo(G.at[0] + 0.5, G.at[1] + 0.5, adj(G.at[0], G.at[1]))) stuckT += 1;
    } else if (G.warp) { g.warp('L3'); G.done = true; shop(); }
    else if (G.stairs) { if (!moveTo(G.stairs[0] + 0.5, G.stairs[1] + 0.5)) stuckT += 1; }
  }
  if (frames % 120 === 0) { if (hyp(p.x - lastPos[0], p.y - lastPos[1]) < 0.05 && p.state === 'idle' && !g.z.enemies.some(e => e.aggro)) stuckT += 120; else stuckT = 0; lastPos = [p.x, p.y]; }
  return inp;
}
function onEvents(ev) {
  for (const e of ev) {
    if (e.t === 'hurt') { hurtN++; hurtD += e.n; }
    if (e.t === 'rest' && e.menu) { shop(); if (gi < GOALS.length && GOALS[gi].lamp === e.lamp) GOALS[gi].rested = true; }
    if (e.t === 'die') note('DIED during ' + JSON.stringify(GOALS[gi]));
    if (e.t === 'respawn') shop();
  }
}
return { step: step, onEvents: onEvents, log: log, note: note, stuck: () => stuckT > 900, goal: () => gi, shop: shop };
};

if (typeof module !== 'undefined' && require.main === module) {
  const mode = process.argv[2] || 'skilled', seed = +(process.argv[3] || 1), verbose = process.argv.includes('-v');
  const g = new EMB.Game(null, seed), bot = EMB.makeBot(() => g, mode === 'skilled');
  while (!g.ended && g.stats.time < 60 * 60) {
    const inp = bot.step(); g.update(1 / 60, inp); bot.onEvents(g.ev);
    if (bot.stuck()) { bot.note('STUCK at ' + g.p.x.toFixed(1) + ',' + g.p.y.toFixed(1) + ' goal#' + bot.goal()); break; }
    if (g.stats.deaths > 40) { bot.note('too many deaths'); break; }
  }
  bot.note(g.ended ? 'ENDING REACHED' : 'NOT FINISHED goal#' + bot.goal());
  console.log((verbose ? bot.log : bot.log.filter(l => /DIED|STUCK|ENDING|NOT|arena|lamp|stairs/.test(l))).join(String.fromCharCode(10)));
  console.log(JSON.stringify({ mode, seed, ended: g.ended, time: +(g.stats.time / 60).toFixed(1), lvl: g.p.lvl, deaths: g.stats.deaths, kills: g.stats.kills, cry: g.p.cry, forge: g.p.forge, charms: g.p.charms }));
}
})(typeof window !== 'undefined' ? window : globalThis);
