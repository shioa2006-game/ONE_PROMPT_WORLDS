// 各鉢の最短年数を幅優先で調べる。  node tools/solve.js [鉢番号] [最大年数]
// 手 = 「好きなだけ切る → 春を呼ぶ」。状態は形だけで同一視する。
const K = require('../js/core.js');
const LV = require('../js/levels.js');

function closure(S, cap) {
  // 切るだけで行ける状態をすべて集める
  const seen = new Map([[K.stateKey(S), { S, cuts: [] }]]);
  const q = [{ S, cuts: [] }];
  while (q.length) {
    const cur = q.shift();
    for (const id in cur.S.nodes) {
      const n = cur.S.nodes[id];
      if (n.parent < 0) continue;
      const T = K.clone(cur.S);
      K.cut(T, n.id);
      const k = K.stateKey(T);
      if (seen.has(k)) continue;
      const e = { S: T, cuts: cur.cuts.concat([[n.x, n.y]]) };
      seen.set(k, e); q.push(e);
      if (seen.size > cap) return [...seen.values()];
    }
  }
  return [...seen.values()];
}

function solve(def, maxYears, cap) {
  const L = K.parseLevel(def);
  let frontier = [{ S: K.newState(L), path: [] }];
  const seen = new Set();
  let total = 0;
  for (let y = 1; y <= maxYears; y++) {
    const next = [];
    for (const f of frontier) {
      for (const c of closure(f.S, 4000)) {
        const T = K.clone(c.S);
        const g = K.spring(T, L);
        if (!g.length) continue;
        const k = K.stateKey(T);
        if (seen.has(k)) continue;
        seen.add(k);
        const path = f.path.concat([{ year: y, cuts: c.cuts }]);
        if (K.solved(T, L)) return { years: y, path, states: total + next.length };
        next.push({ S: T, path });
        if (next.length > cap) break;
      }
      if (next.length > cap) break;
    }
    total += next.length;
    frontier = next;
    if (!frontier.length) break;
  }
  return { years: null, states: total };
}

// 切らずに春だけ呼び続けたら解けるか
function naive(def, maxYears) {
  const L = K.parseLevel(def), S = K.newState(L);
  for (let y = 0; y < maxYears; y++) { K.spring(S, L); if (K.solved(S, L)) return y + 1; }
  return null;
}

if (require.main === module) {
  const only = process.argv[2] !== undefined && process.argv[2] !== 'all' ? +process.argv[2] : -1;
  const maxY = +(process.argv[3] || 12);
  LV.forEach((def, i) => {
    if (def.free || (only >= 0 && only !== i)) return;
    const t = Date.now();
    const r = solve(def, maxY, 300000);
    console.log(`#${i + 1} ${def.name}  目標${def.par}年  最短=${r.years}  切らない=${naive(def, 20)}  状態数=${r.states}  ${Date.now() - t}ms`);
    if (r.path && process.argv.includes('-v')) for (const s of r.path) console.log('   ' + s.year + '年目の前に切る: ' + (s.cuts.map(c => '(' + c + ')').join(' ') || 'なし'));
  });
}
module.exports = { solve, naive };
