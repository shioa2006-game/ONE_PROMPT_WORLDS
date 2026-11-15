// System checks on the real simulation:
//  1. seals   — no shot can land beyond a closed gate, or inside the hidden garden except by river
//  2. routes  — the stream has several genuinely different crossings; the far gap needs a grown mushroom
const { S, C, fresh, plant } = require('./lib.js');
function mossGrid(world, x0, x1, step, pred) { const out = []; for (let x = x0; x <= x1; x += step) for (let y = 100; y <= world.H - 100; y += step) if (S.inMoss(world, x, y) && (!pred || pred(x, y))) out.push({ x, y }); return out; }
function sweep(world, state, pts, nAng, nPow, fn) {
  for (const p of pts) {
    if (state.mush.some(m => Math.hypot(m.x - p.x, m.y - p.y) < C.MR[m.size] + 18)) continue;
    const L = plant(state, p.x, p.y, 1);
    for (let a = 0; a < nAng; a++) for (let pw = 1; pw <= nPow; pw++) {
      const ang = a / nAng * 6.2832, sp = C.VMIN + (C.VMAX - C.VMIN) * pw / nPow;
      fn(S.simulate(world, state, L, Math.cos(ang) * sp, Math.sin(ang) * sp), p);
    }
    state.mush.pop();
  }
}
const divX = [1300, 2500, 3750, 5000];
// --- 1. seals
for (let r = 0; r < 4; r++) {
  const { world, state } = fresh(); for (let g = 1; g <= r; g++) state.gateOpen[g] = true;
  const pts = mossGrid(world, r ? divX[r - 1] : 0, divX[r], 70); let leaks = 0, n = 0;
  sweep(world, state, pts, 180, 4, res => { n++; if (res.end.type === 'sprout' && res.end.x > divX[r]) leaks++; });
  console.log(`seal: room ${r} with gate ${r + 1} closed — ${n} shots from ${pts.length} spots, landings beyond the gate: ${leaks}`);
}
{
  const { world, state } = fresh(); for (let g = 1; g <= 3; g++) state.gateOpen[g] = true;
  const inGarden = (x, y) => Math.hypot(x - 4740, y - 1950) < 330;
  const pts = mossGrid(world, 3750, 5000, 60, (x, y) => !inGarden(x, y)); let dry = 0, wet = 0, n = 0;
  sweep(world, state, pts, 240, 5, res => { n++; if (res.end.type === 'sprout' && inGarden(res.end.x, res.end.y)) { if (res.end.floated) wet++; else dry++; } });
  console.log(`garden: ${n} shots from outside — landings by air: ${dry}, landings by river: ${wet}`);
}
// --- 2. routes across the stream (room 2)
{
  const { world, state } = fresh(); state.gateOpen[1] = state.gateOpen[2] = true;
  const west = mossGrid(world, 2500, 2900, 40), east = (x, y) => x > 3300 && y < 1500 && x < 3750;
  let direct = 0, viaGiant = 0, toIslet = 0, n = 0;
  const giant = state.mush.find(m => m.kind === 'giant');
  sweep(world, state, west, 240, 5, res => { n++; if (res.end.type !== 'sprout') return; if (east(res.end.x, res.end.y)) { if (res.mushHits[giant.id]) viaGiant++; else direct++; } if (res.end.floated && res.end.y > 1950) toIslet++; });
  console.log(`stream: ${n} shots from the west bank — east-bank landings: direct ${direct}, via the giant mushroom ${viaGiant}; river carries to the islet ${toIslet}`);
  let fromIslet = 0; sweep(world, state, mossGrid(world, 2960, 3220, 40, (x, y) => y > 2000), 240, 5, res => { if (res.end.type === 'sprout' && res.end.x > 3300) fromIslet++; });
  console.log(`stream: landings on the east side when shooting from the islet: ${fromIslet}`);
  // third way: a mushroom of your own, grown to full size at the bank
  const own3 = plant(state, 2850, 1010, 3); let viaOwn = 0;
  sweep(world, state, west.filter(p => Math.hypot(p.x - 2850, p.y - 1010) < 300), 240, 5, res => { if (res.end.type === 'sprout' && east(res.end.x, res.end.y) && res.mushHits[own3.id] && !res.mushHits[giant.id]) viaOwn++; });
  console.log(`stream: east-bank landings via your own full-grown mushroom: ${viaOwn}`);
}
// --- far gap in room 3: needs the bank mushroom grown
for (const size of [2, 3]) {
  const { world, state } = fresh(); for (let g = 1; g <= 3; g++) state.gateOpen[g] = true;
  const w = state.mush.find(m => m.kind === 'wild' && Math.abs(m.x - 4045) < 2); w.size = size;
  let ok = 0, n = 0; sweep(world, state, mossGrid(world, 3780, 4080, 40, (x, y) => y < 1400), 240, 5, res => { n++; if (res.end.type === 'sprout' && res.end.x > 4500 && !res.end.floated) ok++; });
  console.log(`far gap with the bank mushroom at size ${size}: ${ok} landings on the far island out of ${n} shots`);
}
