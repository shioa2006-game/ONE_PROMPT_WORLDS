// Simulated "player" in the final arena: each turn tries N random aims, fires the one that rings most bells
// (ties: most mushroom hits). Counts shots until all five ring. Variants set by env: REST, TRUNK, N
const { S, C, fresh, plant, groupHits } = require('./lib.js');
let seed = +(process.env.SEED || 3); function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const N = +(process.env.N || 40), trials = +(process.env.TRIALS || 10);
const out = [];
for (let t = 0; t < trials; t++) {
  globalThis.PON_ARENA = { R: +(process.env.R || 0) || undefined, bellR: +(process.env.BELLR || 0) || undefined, rest: +(process.env.REST || 0) || undefined };
  const world0 = require('../js/world.js').build();
  const world = S.buildIndex(world0), state = S.newState(world), A = world.arena;
  const G = +(process.env.G || 5), bs = world.bells.filter(b => b.group === G), cen = { x: bs.reduce((s, b) => s + b.x, 0) / bs.length, y: bs.reduce((s, b) => s + b.y, 0) / bs.length };
  if (process.env.START) { const [sx, sy] = process.env.START.split(',').map(Number); plant(state, sx, sy, 1); } else plant(state, A.x - (A.R - 70) * 0.62, A.y + (A.R - 70) * 0.78, 1);   // the first mushroom just inside the doorway
  let shots = 0, bestEver = 0;
  while (!state.gateOpen[G] && shots < 80) {
    const mine = state.mush.filter(m => m.kind === 'own' && Math.hypot(m.x - cen.x, m.y - cen.y) < 420);
    let best = null;
    for (let k = 0; k < N; k++) {
      const L = mine[Math.floor(rand() * mine.length)], ang = rand() * 6.283, sp = C.VMIN + (C.VMAX - C.VMIN) * (0.4 + rand() * 0.6);
      const res = S.simulate(world, state, L, Math.cos(ang) * sp, Math.sin(ang) * sp);
      const sc = groupHits(world, res, G) * 100 + res.combo + (res.end.type === 'sprout' ? 0.5 : 0);
      if (!best || sc > best.sc) best = { sc, res };
    }
    bestEver = Math.max(bestEver, groupHits(world, best.res, G));
    S.applyShot(world, state, best.res); shots++;
  }
  out.push({ shots, won: !!state.gateOpen[G], own: state.mush.filter(m => m.kind === 'own').length, bestCombo: state.stats.bestCombo });
}
out.sort((a, b) => a.shots - b.shots);
console.log(JSON.stringify({ R: process.env.R, BELLR: process.env.BELLR, REST: process.env.REST, N, won: out.filter(o => o.won).length + '/' + trials, shotsMin: out[0].shots, shotsMedian: out[Math.floor(trials / 2)].shots, shotsMax: out[trials - 1].shots, ownMedian: out[Math.floor(trials / 2)].own, comboMedian: out[Math.floor(trials / 2)].bestCombo }));
