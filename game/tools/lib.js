// shared helpers for headless probes / bots
const S = require('../js/sim.js');
const Wd = require('../js/world.js');
const C = S.C;
function fresh() { const world = S.buildIndex(Wd.build()); return { world, state: S.newState(world) }; }
function shots(world, state, L, nAng, nPow, fn) {
  for (let a = 0; a < nAng; a++) {
    const ang = a / nAng * Math.PI * 2;
    for (let p = 1; p <= nPow; p++) {
      const sp = C.VMIN + (C.VMAX - C.VMIN) * p / nPow;
      const res = S.simulate(world, state, L, Math.cos(ang) * sp, Math.sin(ang) * sp);
      fn(res, ang, sp);
    }
  }
}
function plant(state, x, y, size) { const m = { id: state.nextId++, x, y, size: size || 1, hits: 0, kind: 'own' }; state.mush.push(m); return m; }
function groupHits(world, res, g) { let n = 0; world.bells.forEach((b, i) => { if (b.group === g && res.bellsHit[i]) n++; }); return n; }
module.exports = { S, C, fresh, shots, plant, groupHits };
