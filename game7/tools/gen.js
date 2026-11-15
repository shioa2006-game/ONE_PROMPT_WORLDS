// 鉢の候補を乱数で作り、「石やしずくが効いている配置」だけを拾う下ごしらえ用。
//   node tools/gen.js <種> <試行数> <ひだまり数> <しずく数> <石数> <樹勢> [向き] [幅] [高さ]
const { solve } = require('./solve.js');
let seed = +(process.argv[2] || 1);
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const N = +(process.argv[3] || 50), NS = +(process.argv[4] || 2), ND = +(process.argv[5] || 0), NR = +(process.argv[6] || 1), V = +(process.argv[7] || 1);
const DIR = +(process.argv[8] || 0), W = +(process.argv[9] || 7), H = +(process.argv[10] || 6);
for (let t = 0; t < N; t++) {
  const g = []; for (let y = 0; y < H; y++) g.push(new Array(W).fill('.'));
  const rx = DIR === 2 ? 0 : (W >> 1), ry = DIR === 2 ? 2 : H - 1;
  g[ry][rx] = 'R';
  if (DIR === 2) for (let y = ry + 1; y < H; y++) g[y][0] = '#';
  const put = (c, n) => { for (let i = 0; i < n; i++) for (let k = 0; k < 50; k++) { const x = (rnd() * W) | 0, y = (rnd() * H) | 0; if (g[y][x] === '.' && !(Math.abs(x - rx) <= 1 && Math.abs(y - ry) <= 1 && c !== 'o')) { g[y][x] = c; break; } } };
  put('*', NS); put('o', ND); put('#', NR);
  const map = g.map(r => r.join(''));
  const strip = ch => map.map(r => r.split(ch).join('.'));
  const full = solve({ vigor: V, dir: DIR, map }, 10, 20000).years;
  if (!full || full < 5) continue;
  const noStone = NR ? solve({ vigor: V, dir: DIR, map: DIR === 2 ? map.map((r, i) => r[0] + r.slice(1).split('#').join('.')) : strip('#') }, 10, 20000).years : full;
  const noDew = ND ? solve({ vigor: V, dir: DIR, map: strip('o') }, 10, 20000).years : full;
  const tag = (noStone === null || noStone > full ? ' 石が助け' : noStone < full ? ' 石が邪魔' : '') + (noDew === null || noDew > full ? ' しずく有効(' + noDew + ')' : '');
  if (!tag) continue;
  console.log('--- 最短' + full + ' 石なし' + noStone + ' しずくなし' + noDew + tag + '\n' + map.join('\n'));
}
