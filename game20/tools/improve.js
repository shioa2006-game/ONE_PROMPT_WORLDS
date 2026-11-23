// tools/solutions.json の配置から、一人ずつ動かして（または二人を入れかえて）よりよい配置を探す
// 使い方: node tools/improve.js 4-2 [--up=...]
const fs = require('fs');
const path = require('path');
const { load, waveById } = require('./lib');
const { D, S } = load();
const sol = JSON.parse(fs.readFileSync(path.join(__dirname, 'solutions.json'), 'utf8'));
const id = process.argv[2];
let up = {};
for (const a of process.argv.slice(3)) if (a.startsWith('--up=')) for (const u of a.slice(5).split(',')) up[u] = true;
const wave = waveById(D, id);
const slots = D.SLOTS.map((s) => s.id);
function score(pl) {
  const st = S.run(S.create({ wave, placement: pl, upgrades: up, keepEvents: false }));
  const downs = st.allies.filter((a) => a.down).length;
  return { s: (st.result.win ? 100 : 0) + st.result.lamps * 10 - downs * 2 - st.result.t * 0.01, lamps: st.result.lamps, win: st.result.win, t: st.result.t, downs };
}
let cur = Object.assign({}, sol[id]);
let cs = score(cur);
console.log('start', JSON.stringify(cur), cs);
for (let it = 0; it < 4; it++) {
  let best = null, bs = cs;
  for (const a of wave.allies) for (const sid of slots) {
    const pl = Object.assign({}, cur);
    const other = Object.keys(pl).find((k) => pl[k] === sid);
    if (other === a) continue;
    if (other) pl[other] = pl[a];
    pl[a] = sid;
    const r = score(pl);
    if (r.s > bs.s) { bs = r; best = pl; }
  }
  if (!best) break;
  cur = best; cs = bs;
  console.log('better', JSON.stringify(cur), cs);
}
