const { S, C, fresh, shots, plant, groupHits } = require('./lib.js');
const { world, state } = fresh();
console.log('moss', world.moss.length, 'thorns', world.thorns.length, 'walls', world.walls.length, 'bells', world.bells.length, 'ff', world.fireflies.length);
// gate probe: for a group, from sample launch points (grid over moss near the bells), share of shots that ring all
function gateProbe(g, st, pts) {
  const need = world.bells.filter(b => b.group === g).length;
  let best = 0, okPts = 0, total = 0, okShots = 0, bestAt = null;
  for (const p of pts) {
    const L = plant(st, p.x, p.y, 1); let ok = 0;
    shots(world, st, L, 720, 6, (res) => { const h = groupHits(world, res, g); total++; if (h > best) { best = h; bestAt = p; } if (h === need) ok++; });
    st.mush.pop(); if (ok) okPts++; okShots += ok;
  }
  console.log('group', g, 'need', need, 'best', best, 'launchPts ok', okPts + '/' + pts.length, 'shot share', (okShots / total * 100).toFixed(3) + '%', bestAt);
}
function mossPts(x0, x1, y0, y1, step) { const out = []; for (let x = x0; x <= x1; x += step) for (let y = y0; y <= y1; y += step) { if (S.inMoss(world, x, y) && !state.mush.some(m => Math.hypot(m.x - x, m.y - y) < C.MR[m.size] + 20)) out.push({ x, y }); } return out; }
gateProbe(1, state, mossPts(700, 1260, 900, 1500, 60));
gateProbe(2, state, mossPts(2150, 2400, 760, 1000, 40));
gateProbe(3, state, mossPts(3340, 3700, 850, 1460, 50));
gateProbe(4, state, mossPts(4480, 4960, 1800, 2110, 50));
gateProbe(5, state, mossPts(5300, 5980, 800, 1500, 70));
