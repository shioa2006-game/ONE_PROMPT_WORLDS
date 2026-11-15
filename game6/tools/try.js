// 階の案を手早く試す：node tools/try.js 案ファイル.json
const R = require('../js/rules.js'), { solve, randomBot } = require('./solve.js');
const defs = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const f = r => r.len;
for (const d of defs) {
  let L; try { L = R.parse(d); } catch (e) { console.log(d.name, 'ERR', e.message); continue; }
  const o = { maxStates: 4000000 };
  const full = solve(L, o), g = L.gem ? solve(L, Object.assign({ needGem: true }, o)) : { len: -1 };
  console.log(d.name, '最短', full.len, '玉', g.len, '止めない', f(solve(L, { noFreeze: true })), '押さない', f(solve(L, { noPush: true })),
    '鏡なし', f(solve(L, { noMirror: true })), '後退なし', f(solve(L, { actions: ['F', 'L', 'R', 'W'] })), '状態', full.states, '乱打', randomBot(L, 100, 600, 5));
  if (full.path) console.log('   ', full.path); if (g.path) console.log('  g ', g.path);
}
