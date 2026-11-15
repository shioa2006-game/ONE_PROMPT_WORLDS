// angular success window for a gate from given launch points. usage: node tools/window.js group [extra mushrooms as x,y,size ...]
const { S, C, fresh, plant, groupHits } = require('./lib.js');
function windowAt(world, st, g, p, need) {
  const L = plant(st, p.x, p.y, 1); let best = 0, bestInfo = null;
  for (let pw = 3; pw <= 8; pw++) {
    const sp = C.VMIN + (C.VMAX - C.VMIN) * pw / 8; let run = 0;
    for (let a = 0; a < 3600 + 200; a++) {
      const ang = a / 3600 * Math.PI * 2;
      const res = S.simulate(world, st, L, Math.cos(ang) * sp, Math.sin(ang) * sp);
      if (groupHits(world, res, g) === need) { run++; if (run > best) { best = run; bestInfo = { deg: (a % 3600) / 10, pw }; } } else run = 0;
    }
  }
  st.mush.pop();
  return { win: best / 10, info: bestInfo };
}
function scan(world, st, g, box, step) {
  const need = world.bells.filter(b => b.group === g).length; const out = [];
  for (let x = box[0]; x <= box[1]; x += step) for (let y = box[2]; y <= box[3]; y += step) {
    if (!S.inMoss(world, x, y) || st.mush.some(m => Math.hypot(m.x - x, m.y - y) < C.MR[m.size] + 20)) continue;
    const r = windowAt(world, st, g, { x, y }, need); if (r.win > 0) out.push({ x, y, win: r.win, ...r.info });
  }
  out.sort((a, b) => b.win - a.win);
  return out;
}
module.exports = { windowAt, scan };
if (require.main === module) {
  const { world, state } = fresh();
  const g = +process.argv[2]; const box = process.argv[3].split(',').map(Number); const step = +(process.argv[4] || 50);
  for (const e of process.argv.slice(5)) { const [x, y, s] = e.split(',').map(Number); plant(state, x, y, s); }
  const out = scan(world, state, g, box, step);
  console.log('group', g, 'points with a solution:', out.length, 'top:', JSON.stringify(out.slice(0, 6)));
  console.log('points with window>=1deg:', out.filter(o => o.win >= 1).length, ' >=2deg:', out.filter(o => o.win >= 2).length);
}
