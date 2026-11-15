// 入力の記録：node 上で smart ボットに各部屋を解かせ、1/120 秒ごとの入力を記録する。
//   node tools/record.js  →  tools/results/replay.json
// 記録した入力は tools/playthrough.py が ゲーム本体（ブラウザ）の1ステップ送りに流し込み、同じ結果になるかを確かめる。
// 入力は 先に まるめてから ボット自身の sim に入れる（まるめる前の値で進めると、ブラウザ側と ずれる）。
const fs = require('fs');
const path = require('path');
const S = require('../js/sim.js');
const D = require('../js/levels.js');
const { makeBot } = require('./bot.js');

const r2 = (v) => (v === undefined ? undefined : Math.round(v));   // 1px 単位に まるめる
const out = [];
for (let i = 0; i < D.CHAMBERS.length; i++) {
  const ch = D.CHAMBERS[i];
  const seed = 500 + i;
  const w = new S.World(ch, { seed });
  const bot = makeBot('smart', S.mulberry32(seed));
  const inputs = [];
  let k = 0;
  for (; k < 300 * 120 && !w.done; k++) {
    const raw = bot(w);
    const inp = { tx: r2(raw.tx), btn: !!raw.btn };
    if (raw.ax !== undefined) { inp.ax = r2(raw.ax); inp.ay = r2(raw.ay); }
    if (raw.spit) inp.spit = true;
    w.step(inp);
    w.events.length = 0;
    // 同じ入力が続くところは まとめる（[回数, tx, btn, ax, ay, spit]）
    const row = [inp.tx, inp.btn ? 1 : 0, inp.ax === undefined ? null : inp.ax, inp.ay === undefined ? null : inp.ay, inp.spit ? 1 : 0];
    const last = inputs[inputs.length - 1];
    if (last && last.slice(1).every((v, q) => v === row[q])) last[0]++;
    else inputs.push([1].concat(row));
  }
  out.push({ i, id: ch.id, seed, steps: k, done: w.done, t: +w.t.toFixed(3), gems: w.gems, found: w.found.slice(), inputs });
  console.log(ch.id, 'done', w.done, 'steps', k, 't', w.t.toFixed(1), 'gems', w.gems, 'found', w.found.join(','));
}
const dir = path.join(__dirname, 'results');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'replay.json'), JSON.stringify(out));
console.log('wrote', path.join(dir, 'replay.json'));
