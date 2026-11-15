// 各階の総当たり検証（幅優先探索）。
//   node tools/solve.js            全階の最短手数・行動を制限した場合の最短・乱打ボットの結果
//   node tools/solve.js 3 path     3階の最短手順を表示
const path = require('path');
const R = require(path.join(__dirname, '..', 'js', 'rules.js'));
const LEVELS = require(path.join(__dirname, '..', 'js', 'levels.js'));

function solve(L, opts) {
  opts = opts || {};
  const acts = opts.actions || ['F', 'B', 'L', 'R', 'W'];
  const max = opts.maxStates || 3000000;
  const s0 = R.initState(L);
  const seen = new Map();
  seen.set(R.stateKey(s0), null);
  let frontier = [s0], depth = 0;
  while (frontier.length) {
    const next = [];
    depth++;
    for (const s of frontier) {
      const pk = R.stateKey(s);
      for (const a of acts) {
        const t = R.clone(s);
        const ev = R.tick(L, t, a);
        if (ev.length && ev[0].t === 'bump') continue;
        if (t.caught >= 0) continue;
        // 制限つきの調査：赤を視線で止めない／青を視線で動かさない／鏡を使わない
        if (opts.noFreeze) {
          const sf = R.seenFlags(L, t);
          if (t.h.some((o, i) => L.haniwa[i].type === 'r' && s.h[i].st === R.AWAKE && o.st === R.AWAKE && sf[i])) continue;
        }
        if (opts.noPush && ev.some(e => e.t === 'move' && L.haniwa[e.i].type === 'b')) continue;
        if (opts.noMirror && R.mirrorAhead(L, R.visKey(L, t), t.px, t.py, t.pd)) continue;
        if (t.won) {
          if (opts.needGem && !t.gem) continue;
          let p = a, k = pk;
          while (seen.get(k)) { const e = seen.get(k); p = e.a + p; k = e.p; }
          return { len: depth, path: p, states: seen.size };
        }
        const k = R.stateKey(t);
        if (seen.has(k)) continue;
        seen.set(k, { p: pk, a: a });
        next.push(t);
      }
      if (seen.size > max) return { len: -2, states: seen.size };
    }
    frontier = next;
  }
  return { len: -1, states: seen.size };
}

// でたらめに操作するだけのボット。つかまったらその階をやり直す。
function randomBot(L, runs, budget, seed) {
  let x = seed || 12345;
  const rnd = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  let wins = 0;
  for (let r = 0; r < runs; r++) {
    let s = R.initState(L);
    for (let n = 0; n < budget; n++) {
      const a = 'FFFLRBW'[(rnd() * 7) | 0];
      R.tick(L, s, a);
      if (s.won) { wins++; break; }
      if (s.caught >= 0) s = R.initState(L);
    }
  }
  return wins / runs;
}

function fmt(r) { return r.len === -1 ? '不可' : r.len === -2 ? '打切' : String(r.len); }

if (require.main === module) {
  const only = process.argv[2] && /^\d+$/.test(process.argv[2]) ? +process.argv[2] : 0;
  const showPath = process.argv.includes('path');
  console.log('階  名前        最短  玉あり  後退なし 待ちなし 赤を止めない 青を押さない 鏡なし  状態数  乱打成功率');
  LEVELS.forEach((def, i) => {
    if (only && only !== i + 1) return;
    const L = R.parse(def);
    const full = solve(L);
    const gem = L.gem ? solve(L, { needGem: true }) : { len: -1 };
    const noB = solve(L, { actions: ['F', 'L', 'R', 'W'] });
    const noW = solve(L, { actions: ['F', 'B', 'L', 'R'] });
    const noF = solve(L, { noFreeze: true });
    const noP = solve(L, { noPush: true });
    const noM = solve(L, { noMirror: true });
    const rb = randomBot(L, 200, 600, 777 + i);
    console.log(
      String(i + 1).padEnd(3), def.name.padEnd(8, '　'),
      fmt(full).padStart(5), fmt(gem).padStart(6), fmt(noB).padStart(8), fmt(noW).padStart(8),
      fmt(noF).padStart(10), fmt(noP).padStart(10), fmt(noM).padStart(8), String(full.states).padStart(9), (rb * 100).toFixed(1).padStart(8) + '%'
    );
    if (def.par && def.par !== full.len) console.log('   ！par が最短と違う:', def.par, full.len);
    if (showPath) { console.log('  最短:', full.path); if (gem.path) console.log('  玉あり:', gem.path); }
  });
}
module.exports = { solve, randomBot };
