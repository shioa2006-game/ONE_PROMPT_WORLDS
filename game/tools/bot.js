// Full playthrough bots on the real simulation, from the initial state to the ending.
//   node tools/bot.js smart [seed]   — greedy bot with one-step lookahead (completability + shot counts)
//   node tools/bot.js naive [seed]   — "always full power straight at the next goal" (should stall)
const { S, C, fresh, groupHits } = require('./lib.js');
let seed = +(process.argv[3] || 1);
function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const { world, state } = fresh();
const own = st => st.mush.filter(m => m.kind === 'own' || m.kind === 'mother');
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const log = [];
function sample(st, launchers, nAng, nPow, fn) {
  for (const L of launchers) for (let a = 0; a < nAng; a++) {
    const ang = (a + rand()) / nAng * Math.PI * 2;
    for (let p = 1; p <= nPow; p++) {
      const sp = C.VMIN + (C.VMAX - C.VMIN) * (p - rand() * 0.5) / nPow;
      const res = S.simulate(world, st, L, Math.cos(ang) * sp, Math.sin(ang) * sp); res._v = [L.id, Math.cos(ang) * sp, Math.sin(ang) * sp]; fn(res, L, ang, sp);
    }
  }
}
const replay = [];
function fire(st, shot, why) { replay.push({ why, v: shot.res._v, end: shot.res.end.type }); const out = S.applyShot(world, st, shot.res); log.push({ why, end: shot.res.end.type, opened: out.opened, grown: out.grown.length }); return out; }
const centroid = g => { const b = world.bells.filter(x => x.group === g); return { x: b.reduce((s, x) => s + x.x, 0) / b.length, y: b.reduce((s, x) => s + x.y, 0) / b.length }; };
function bestBells(st, g, nAng, nPow) {
  const c = centroid(g); let best = { n: -1 };
  sample(st, own(st).filter(m => dist(m, c) < 650), nAng || 180, nPow || 4, (res, L, ang, sp) => { const n = groupHits(world, res, g); if (n > best.n) best = { n, res, L, ang, sp }; });
  return best;
}

/* ---------- smart bot ---------- */
function landNear(st, P, R, budget) {
  let stuck = 0;
  while (budget-- > 0) {
    const cur = Math.min(...own(st).map(m => dist(m, P)));
    if (cur < R) return true;
    const near = own(st).sort((a, b) => dist(a, P) - dist(b, P)).slice(0, 4);
    let best = null;
    sample(st, near, 240, 6, (res, L, ang, sp) => { if (res.end.type !== 'sprout') return; const d = dist(res.end, P); if (!best || d < best.d) best = { d, res }; });
    if (best && best.d < cur - 15) { fire(st, best, 'land'); stuck = 0; continue; }
    // cannot get closer by landing: grow whatever mushroom can be hit near the frontier
    let g = null;
    sample(st, near, 180, 5, (res) => { let h = 0; for (const id in res.mushHits) { const m = st.mush.find(x => x.id == id); if (m && m.kind !== 'giant' && m.size < 3) h += res.mushHits[id]; } const sc = h * 10 + (res.end.type === 'sprout' ? 1 : 0) + rand(); if (h > 0 && (!g || sc > g.sc)) g = { sc, res }; });
    if (!g || ++stuck > 12) return false;
    fire(st, g, 'grow');
  }
  return false;
}
function openGate(st, g, budget) {
  const need = world.bells.filter(b => b.group === g).length;
  while (budget-- > 0) {
    const b = bestBells(st, g, 360, 6);
    if (b.n === need) { fire(st, b, 'gate' + g); return true; }
    // one-step lookahead over candidate shots that change the table near the bells
    const c = centroid(g); const cands = [];
    sample(st, own(st).filter(m => dist(m, c) < 650), 40, 3, (res) => { if ((res.end.type === 'sprout' && dist(res.end, c) < 420) || Object.keys(res.mushHits).length) cands.push(res); });
    let pick = null;
    for (let k = 0; k < Math.min(26, cands.length); k++) {
      const res = cands[Math.floor(rand() * cands.length)], st2 = structuredClone(st);
      S.applyShot(world, st2, res);
      const v = bestBells(st2, g, 120, 3).n + rand() * 0.5;
      if (!pick || v > pick.v) pick = { v, res };
    }
    if (!pick) return false;
    fire(st, pick, 'build' + g);
  }
  return false;
}
function smart() {
  const st = state, t0 = Date.now(); const marks = [];
  const step = (name, ok) => { console.error(name, ok, st.stats.shots, ((Date.now() - t0) / 1000).toFixed(0) + 's'); marks.push(name + ':' + (ok ? 'ok' : 'FAIL') + '@' + st.stats.shots); return ok; };
  const plan = [
    ['near bell 1', () => landNear(st, centroid(1), 330, 40)], ['gate 1', () => openGate(st, 1, 30)],
    ['near bells 2', () => landNear(st, { x: 2260, y: 880 }, 90, 60)], ['gate 2', () => openGate(st, 2, 40)],
    ['cross stream', () => landNear(st, { x: 3500, y: 1150 }, 160, 80)], ['gate 3', () => openGate(st, 3, 40)],
    ['far island', () => landNear(st, { x: 4690, y: 1060 }, 120, 80)], ['hidden garden', () => landNear(st, { x: 4700, y: 1930 }, 220, 80)], ['gate 4', () => openGate(st, 4, 60)],
    ['arena', () => landNear(st, { x: world.arena.x, y: world.arena.y }, 170, 80)], ['great tree', () => openGate(st, 5, 120)]
  ];
  let ok = true;
  for (const [name, fn] of plan) { if (!step(name, fn())) { ok = false; break; } }
  console.log(JSON.stringify({ bot: 'smart', seed: +(process.argv[3] || 1), completed: ok && st.won, shots: st.stats.shots, planted: st.stats.planted, lost: st.stats.lost, fireflies: st.ff.filter(Boolean).length, ownAtEnd: own(st).length, ms: Date.now() - t0 }));
  console.log(marks.join('  '));
  require('fs').writeFileSync(__dirname + '/replay.json', JSON.stringify(replay));
}

/* ---------- naive bot: nearest mushroom, full power, straight at the goal ---------- */
function naive() {
  const st = state;
  const goals = [[centroid(1), () => st.gateOpen[1]], [{ x: 1500, y: 1250 }], [centroid(2), () => st.gateOpen[2]], [{ x: 2720, y: 1150 }], [{ x: 3500, y: 1150 }], [centroid(3), () => st.gateOpen[3]], [{ x: 3930, y: 1150 }], [{ x: 4690, y: 1060 }], [centroid(4), () => st.gateOpen[4]], [centroid(5), () => st.won]];
  let gi = 0, furthest = 0;
  for (let n = 0; n < 400 && !st.won; n++) {
    const P = goals[gi][0], done = goals[gi][1];
    const L = own(st).sort((a, b) => dist(a, P) - dist(b, P))[0];
    if ((done ? done() : dist(L, P) < 140) && gi < goals.length - 1) { gi++; continue; }
    const ang = Math.atan2(P.y - L.y, P.x - L.x) + (rand() - 0.5) * 0.35;
    const res = S.simulate(world, st, L, Math.cos(ang) * C.VMAX, Math.sin(ang) * C.VMAX);
    S.applyShot(world, st, res);
    furthest = Math.max(furthest, ...own(st).map(m => m.x));
  }
  console.log(JSON.stringify({ bot: 'naive', seed: +(process.argv[3] || 1), completed: st.won, shots: st.stats.shots, gatesOpened: Object.keys(st.gateOpen).length, furthestX: Math.round(furthest), goalIndexReached: gi + ' / ' + (goals.length - 1) }));
}
(process.argv[2] === 'naive' ? naive : smart)();
