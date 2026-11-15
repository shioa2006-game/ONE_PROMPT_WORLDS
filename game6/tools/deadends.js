// 各階で「到達できる状態」のうち、どれだけが行きづまり（出口へ届かない）かを数える。
//   node tools/deadends.js
const path = require('path');
const R = require(path.join(__dirname, '..', 'js', 'rules.js'));
const LEVELS = require(path.join(__dirname, '..', 'js', 'levels.js'));
console.log('階  名前          到達できる状態  出口へ届く  行きづまり率  計算時間');
LEVELS.forEach((d, i) => {
  const L = R.parse(d), t = Date.now(), an = new R.Analyzer(L);
  an.step(0);
  let alive = 0;
  for (const v of an.alive) alive += v;
  console.log(String(i + 1).padEnd(3), d.name.padEnd(8, '　'), String(an.alive.length).padStart(12), String(alive).padStart(10),
    ((1 - alive / an.alive.length) * 100).toFixed(0).padStart(10) + '%', String(Date.now() - t).padStart(8) + 'ms');
});
