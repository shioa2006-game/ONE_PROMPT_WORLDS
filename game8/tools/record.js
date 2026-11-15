/*
 * 通しプレイ用の入力記録を作る（node tools/record.js）
 * 各ステージを自動プレイ（smart）で解き、1/60秒ごとの入力 [x, y, 走る] を tools/results/replay.json に保存する。
 * playthrough.py がこれを実際のゲーム画面に流し込み、同じ結果になるかを確かめる。
 */
'use strict';
const fs = require('fs'), path = require('path');
const LEVELS = require(path.join(__dirname, '..', 'js', 'levels.js'));
const { run } = require('./bot.js');
const out = [];
LEVELS.forEach((lv, i) => {
  let found = null;
  for (let seed = 11; seed < 400 && !found; seed += 13) {
    const r = run(lv, 'smart', seed, { record: true, maxT: 240 });
    if (r.done) found = { level: i, seed, time: r.time, rec: r.rec };
  }
  if (!found) { console.log('NG', i + 1, lv.name); process.exitCode = 1; return; }
  console.log('ok', i + 1, lv.name, 'seed', found.seed, 'time', found.time.toFixed(1), 'frames', found.rec.length);
  out.push(found);
});
fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'results', 'replay.json'), JSON.stringify(out));
