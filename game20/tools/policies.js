// 単純な置き方と、工夫した置き方（tools/solutions.json）を、全陣で比べる
// 使い方: node tools/policies.js
// 贈りものは毎回1つめを選んだとして計算する。
const fs = require('fs');
const path = require('path');
const { load } = require('./lib');
const { D, S } = load();
const sol = JSON.parse(fs.readFileSync(path.join(__dirname, 'solutions.json'), 'utf8'));

const POL = {
  // 本丸のまわりで固める（どの道も最後は本丸へ来る、という考え）
  keep: { ilza: 'k_stair', ruu: 'k_corner', kai: 'k_front', dugan: 'c_bend', mel: 'c_mid' },
  // 正面の石段で受ける（第一夜に覚えた形を、そのまま続ける）
  front: { ilza: 's_land', ruu: 'w_sw', kai: 'w_se', dugan: 'g_in', mel: 's_top' },
};
const up = {};
const rows = [];
let prevSol = null;
D.NIGHTS.forEach((N, n) => {
  for (const w of N.waves) {
    const r = { id: w.id };
    const run = (pl) => {
      const p = {};
      for (const a of w.allies) if (pl[a]) p[a] = pl[a];
      const st = S.run(S.create({ wave: w, placement: p, upgrades: up, keepEvents: false }));
      return (st.result.win ? 'W' : 'L') + st.result.lamps + '/' + st.result.lampsMax;
    };
    r.keep = run(POL.keep);
    r.front = run(POL.front);
    // 前の陣の配置をそのまま使い、新しい仲間は空いている中庭の辻へ
    if (prevSol) {
      const p = Object.assign({}, prevSol);
      for (const a of w.allies) if (!p[a]) p[a] = Object.values(p).includes('c_mid') ? 'k_front' : 'c_mid';
      r.carry = run(p);
    } else r.carry = '-';
    r.sol = run(sol[w.id]);
    rows.push(r);
    prevSol = sol[w.id];
  }
  const g = D.GIFTS.find((x) => x.after === n + 1);
  if (g) up[g.options[0].id] = true;
});
console.log('陣\t本丸固め\t石段で受ける\t前の陣のまま\t工夫した例');
for (const r of rows) console.log(`${r.id}\t${r.keep}\t${r.front}\t${r.carry}\t${r.sol}`);
