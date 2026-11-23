// tools/solutions.json の配置で、全陣を（贈りものは毎回1つめを選んだとして）迎え撃つ
// 使い方: node tools/check_solutions.js [--gifts=1,1,1,1]  （1 = 2つめを選ぶ）
const fs = require('fs');
const path = require('path');
const { load } = require('./lib');
const { D, S } = load();
const sol = JSON.parse(fs.readFileSync(path.join(__dirname, 'solutions.json'), 'utf8'));
let pick = [0, 0, 0, 0];
for (const a of process.argv.slice(2)) if (a.startsWith('--gifts=')) pick = a.slice(8).split(',').map(Number);
const up = {};
let all = true;
D.NIGHTS.forEach((N, n) => {
  for (const w of N.waves) {
    const st = S.run(S.create({ wave: w, placement: sol[w.id], upgrades: up, keepEvents: false }));
    const r = st.result;
    const downs = st.allies.filter((a) => a.down).map((a) => a.id);
    console.log(`${w.id} ${r.win ? 'WIN ' : 'LOSE'} lamps=${r.lamps}/${r.lampsMax} t=${r.t.toFixed(1)} downs=${downs.join(',') || '-'} combos=${Object.keys(st.stats.combos).join(',')}`);
    if (!r.win) all = false;
  }
  const g = D.GIFTS.find((x) => x.after === n + 1);
  if (g) up[g.options[pick[n] || 0].id] = true;
});
console.log(all ? 'ALL WIN' : 'SOME LOST');
process.exit(all ? 0 : 1);
