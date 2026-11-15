// しくみの確認（node）：ねらいどおりに 成り立っているかを 1項目ずつ確かめる
//   node tools/rules_test.js  → 結果を表示し、tools/results/rules-test.txt にも書く
const fs = require('fs');
const path = require('path');
const S = require('../js/sim.js');
const D = require('../js/levels.js');
const { T, CELL, COLS } = S;
const lines = [];
let pass = 0, fail = 0;
function ok(name, cond, info) { (cond ? pass++ : fail++); const l = (cond ? 'OK  ' : 'NG  ') + name + (info ? '  … ' + info : ''); lines.push(l); console.log(l); }
const room = (id, seed) => new S.World(D.CHAMBERS.find((c) => c.id === id), { seed: seed || 1 });
const idx = (c, r) => r * COLS + c;
function run(w, n, inp) { for (let k = 0; k < n; k++) { w.step(typeof inp === 'function' ? inp(w) : (inp || { tx: w.frog.x })); } }
function drain(w) { const e = w.events.slice(); w.events.length = 0; return e; }

// 1. くずれる：1-1 で 左のかたまりの つけね（6段9列）を こわすと、16マスが まとめて落ち、着水で おとしものが出る
{
  const w = room('1-1');
  w.destroyCell(idx(9, 6), 'test'); w.collapse();
  const ev = drain(w);
  const col = ev.find((e) => e.type === 'collapse');
  ok('つけねを こわすと かたまりごと落ちる', col && col.n === 16, 'n=' + (col && col.n));
  run(w, 240, { tx: 320 });
  const ev2 = drain(w);
  ok('着水すると おとしものが出る', ev2.some((e) => e.type === 'item' && e.id === 0) && ev2.some((e) => e.type === 'splash'));
  const sp = ev2.find((e) => e.type === 'splash');
  ok('かたまりで落とすと きららが多い（16マスで +' + (sp && sp.gain) + '、1マスずつ なら 16）', sp && sp.gain > 16 * 2);
}

// 2. ねらい線（くわえて はく）の予測と、じっさいに 最初にこわれたマスが一致するか
{
  let same = 0, total = 0;
  const rooms = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '5-2'];
  for (const id of rooms) {
    for (let deg = -160; deg <= -20; deg += 4) {
      const w = room(id, 3);
      const a = deg * Math.PI / 180;
      w.aim = a;
      const m = w.mouth();
      const ai = w.aimInfo();
      w.spit(w.balls[0]);
      drain(w);
      let hit = null;
      for (let k = 0; k < 600 && hit === null; k++) {
        w.step({ tx: w.frog.x });
        for (const e of drain(w)) if ((e.type === 'chip' || e.type === 'break' || e.type === 'lid') && hit === null) hit = e.i !== undefined ? e.i : 'lid';
        if (w.balls[0].state !== 'free') break;
      }
      if (ai.i === undefined && !ai.exit) continue;
      total++;
      const pred = ai.type === T.LID ? 'lid' : ai.i;
      if (pred === hit || (pred === 'lid' && hit !== null && w.g[hit] === undefined)) same++;
    }
  }
  ok('ねらい線の さきと、じっさいに当たるマスが一致する（' + same + '/' + total + '）', same / total >= 0.95, (100 * same / total).toFixed(1) + '%');
}

// 3. おちてくる玉の 着地点の予測と、じっさいに頭で はね返った位置
{
  let errSum = 0, n = 0, maxErr = 0;
  for (let s = 1; s <= 30; s++) {
    const w = room('1-2', s);
    w.aim = (-150 + s * 4) * Math.PI / 180; w.spit(w.balls[0]);
    let pred = null;
    for (let k = 0; k < 3000; k++) {
      const b = w.balls[0];
      if (b.state === 'free' && b.vy > 0 && b.y > 300 && pred === null) { const ai = w.aimInfo(); if (ai && ai.land !== null) pred = ai.land; }
      // 予測した場所へ カエルを動かす
      w.step({ tx: pred !== null ? pred : w.frog.x });
      const pad = drain(w).find((e) => e.type === 'pad');
      if (pad && pred !== null) { const er = Math.abs(pad.x - pred); errSum += er; maxErr = Math.max(maxErr, er); n++; break; }
      if (b.vy < 0) pred = null;
    }
  }
  ok('着地点の予測は ずれが小さい（平均 ' + (errSum / Math.max(1, n)).toFixed(1) + 'px、最大 ' + maxErr.toFixed(1) + 'px、' + n + '回）', n >= 20 && maxErr < 12);
}

// 4. はずみ：3回で 力が2ばい、6回で つらぬく
{
  const w = room('1-1');
  w.mom = 2; ok('はずみ2 では 1', w.dmg(w.balls[0]) === 1);
  w.mom = 3; ok('はずみ3 で 2ばい', w.dmg(w.balls[0]) === 2);
  // つらぬく：つちの柱に まっすぐ はくと、はね返らずに 何マスも こわす
  const w2 = room('1-1');
  w2.mom = 6; w2.aim = -Math.PI / 2; w2.frog.x = 112; w2.balls[0].x = 112;
  w2.spit(w2.balls[0]); drain(w2);
  let broken = 0;
  for (let k = 0; k < 600; k++) { w2.step({ tx: 112 }); broken += drain(w2).filter((e) => e.type === 'break').length; if (w2.balls[0].vy > 0) break; }
  const w3 = room('1-1');
  w3.mom = 0; w3.aim = -Math.PI / 2; w3.frog.x = 112; w3.balls[0].x = 112;
  w3.spit(w3.balls[0]); drain(w3);
  let broken0 = 0;
  for (let k = 0; k < 600; k++) { w3.step({ tx: 112 }); broken0 += drain(w3).filter((e) => e.type === 'break').length; if (w3.balls[0].vy > 0) break; }
  ok('はずみ6 は つちを つらぬく（1回の のぼりで ' + broken + 'マス、はずみ0 は ' + broken0 + 'マス）', broken >= 3 && broken0 <= 1);
}

// 5. くわえる：ボタンを おしたまま おちてくる玉を待つと くわえ、はなすと ねらった向きへ はく
{
  const w = room('1-1');
  w.aim = -Math.PI / 2 - 0.4; w.spit(w.balls[0]);
  let caught = false, t0 = 0;
  for (let k = 0; k < 2400 && !caught; k++) { w.step({ tx: w.balls[0].x, btn: true, ax: 0, ay: 0 }); if (w.balls[0].state === 'held') { caught = true; t0 = k; } }
  ok('ボタンを おしたままで くわえる', caught);
  const mom = w.mom;
  run(w, 10, { tx: 0, btn: true, ax: w.frog.x + 100, ay: 300 });
  w.step({ tx: 0, btn: false, ax: w.frog.x + 100, ay: 300 });
  const b = w.balls[0];
  ok('はなすと はく（向きは ねらいの点のほう）', b.state === 'free' && b.vx > 0 && b.vy < 0);
  ok('くわえても はずみが ふえる', mom >= 1, 'mom=' + mom);
}

// 6. おとす：玉が水に落ちると はずみは 0、0.7秒ほどで くわえた状態に もどる（やりなおしは いらない）
{
  const w = room('1-1');
  w.mom = 5; w.aim = -Math.PI / 2; w.spit(w.balls[0]);
  let sunk = false, back = false, ts = 0;
  for (let k = 0; k < 3600; k++) {
    w.step({ tx: 600 });
    if (w.balls[0].state === 'sunk' && !sunk) { sunk = true; ts = w.t; }
    if (sunk && w.balls[0].state === 'held') { back = true; ts = w.t - ts; break; }
  }
  ok('水に落ちると はずみ 0', sunk && w.mom === 0);
  ok('すぐ くわえた状態に もどる（' + ts.toFixed(2) + '秒）', back && ts < 1);
}

// 7. 守り主：生きているあいだ ふたは こわれない。くさびを ぜんぶ こわすと 落ち、ふたが あく
{
  const w = room('1-3');
  const lid = [...w.g].findIndex((t) => t === T.LID);
  w.damage(lid, 10, 'test');
  ok('守り主が いるあいだ ふたは こわれない', !w.lidOpen && drain(w).some((e) => e.type === 'sealed'));
  for (let i = 0; i < w.N; i++) if (w.g[i] === T.ANCHOR && i % COLS === 6) w.destroyCell(i, 'test');
  w.collapse();
  ok('左の なわだけでは 落ちない', !w.guardian.down);
  for (let i = 0; i < w.N; i++) if (w.g[i] === T.ANCHOR && i % COLS === 13 && ((i / COLS) | 0) === 2) w.destroyCell(i, 'test');
  w.collapse();
  ok('両方の なわを きると 落ちて、ふたが あく', w.guardian.down && w.lidOpen);
}

// 8. はぜ石：2-1 の いちばん下の はぜ石を こわすと、ななめに つながった はぜ石が つぎつぎ はぜる
{
  const w = room('2-1');
  w.destroyCell(idx(3, 7), 'test');
  let booms = 0;
  for (let k = 0; k < 240; k++) { w.step({ tx: 320 }); booms += drain(w).filter((e) => e.type === 'boom').length; }
  ok('はぜ石の 連鎖（' + booms + '回）', booms === 6);
}

// 9. どろむし：すきまを どろで ふさぐ。玉が当たると たおれる
{
  const w = room('2-1');
  let mud = 0;
  for (let k = 0; k < 120 * 12; k++) { w.step({ tx: 320 }); mud += drain(w).filter((e) => e.type === 'mud').length; }
  ok('どろむしは すきまを ふさぐ（12秒で ' + mud + 'か所）', mud >= 1);
}

// 10. 土ぐも：きった くさびを はりなおす
{
  const w = room('2-3');
  const a = w.guardian.anchors0.find((i) => i % COLS === 5);
  w.destroyCell(a, 'test'); w.collapse(); drain(w);
  let regrow = 0;
  for (let k = 0; k < 120 * 10; k++) { w.step({ tx: 320 }); regrow += drain(w).filter((e) => e.type === 'regrow').length; }
  ok('土ぐもは いとを はりなおす', regrow >= 1 && w.g[a] === T.ANCHOR);
}

// 11. ぬける：ふたの あなに 玉を通すと 部屋を ぬける
{
  const w = room('1-1');
  for (let r = 1; r <= 3; r++) for (let c = 8; c <= 11; c++) w.destroyCell(idx(c, r), 'test');
  w.collapse(); w.openLid('test'); drain(w);
  w.frog.x = 320; w.aim = -Math.PI / 2; w.spit(w.balls[0]);
  run(w, 300, { tx: 320 });
  ok('あなへ 玉を とおすと ぬける', w.done);
}

// 12. はじめの状態で 浮いた岩がない（全15部屋）／ 玉が 岩盤のあいだを 行ったり来たり し続けない
{
  let floating = 0;
  for (const ch of D.CHAMBERS) { const w = new S.World(ch, { seed: 1 }); floating += w.findFalling(w.g).out.length; }
  ok('どの部屋も はじめから浮いた岩はない', floating === 0);
  const w = room('1-1');
  w.balls[0].state = 'free'; w.balls[0].x = 40; w.balls[0].y = 400; w.balls[0].vx = w.speed; w.balls[0].vy = 0.001;
  let padT = null;
  for (let k = 0; k < 120 * 20; k++) { w.step({ tx: w.balls[0].x }); if (drain(w).some((e) => e.type === 'pad')) { padT = w.t; break; } }
  ok('ほぼ水平に とんだ玉も いずれ もどってくる', padT !== null, padT && padT.toFixed(2) + '秒');
}

lines.push('', 'pass ' + pass + ' / fail ' + fail);
console.log('pass', pass, 'fail', fail);
const dir = path.join(__dirname, 'results'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'rules-test.txt'), lines.join('\n'), 'utf8');
process.exit(fail ? 1 : 0);
