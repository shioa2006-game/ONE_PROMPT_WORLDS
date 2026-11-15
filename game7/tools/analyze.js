// システム検証: (1) 最短手順を JSON に書き出す (2) でたらめに切るボットの成績 (3) 石・しずくを抜いたときの最短年数
//   node tools/analyze.js
const fs = require('fs');
const K = require('../js/core.js');
const LV = require('../js/levels.js');
const { solve, naive } = require('./solve.js');

function randomBot(def, trials, limit) {
  const L = K.parseLevel(def);
  let win = 0, par = 0, seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let t = 0; t < trials; t++) {
    const S = K.newState(L);
    while (S.year < limit) {
      for (let c = 0; c < 2; c++) {
        const ids = Object.keys(S.nodes).filter(k => S.nodes[k].parent >= 0);
        if (ids.length && rnd() < 0.35) K.cut(S, +ids[(rnd() * ids.length) | 0]);
      }
      const g = K.spring(S, L);
      if (!g.length) { const ids = Object.keys(S.nodes).filter(k => S.nodes[k].parent >= 0); if (!ids.length) break; K.cut(S, +ids[(rnd() * ids.length) | 0]); }
      if (K.solved(S, L)) { win++; if (S.year <= def.par) par++; break; }
    }
  }
  return { win: win / trials, par: par / trials };
}

const strip = (def, ch) => Object.assign({}, def, { map: def.map.map((r, y) => r.split('').map((c, x) => (c === ch && !(def.dir === 2 && x === 0)) ? '.' : c).join('')) });
const out = [], lines = [];
LV.forEach((def, i) => {
  if (def.free) return;
  const r = solve(def, 12, 300000);
  out.push({ level: i, years: r.years, path: r.path });
  const bot = randomBot(def, 3000, def.par * 2);
  const has = ch => def.map.some((row, y) => row.split('').some((c, x) => c === ch && !(def.dir === 2 && x === 0)));
  const noStone = has('#') ? solve(strip(def, '#'), 12, 300000).years : '-';
  const noDew = has('o') ? solve(strip(def, 'o'), 12, 300000).years : '-';
  lines.push(`#${i + 1} ${def.name}: 最短${r.years} / めやす${def.par} / 切らない=${naive(def, 20)} / 乱択ボット 完成${(bot.win * 100).toFixed(1)}% 名木${(bot.par * 100).toFixed(1)}% / 石なし最短=${noStone} / しずくなし最短=${noDew}`);
  console.log(lines[lines.length - 1]);
});
fs.mkdirSync(__dirname + '/results', { recursive: true });
fs.writeFileSync(__dirname + '/results/solutions.json', JSON.stringify(out));
fs.writeFileSync(__dirname + '/results/analyze.txt', lines.join('\n') + '\n');
