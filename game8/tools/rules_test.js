/*
 * しくみの確認（node tools/rules_test.js）
 * 「歩けば まとまる／走れば 散る」など、ねらった相互作用が sim.js で実際に成り立つかを数値で確かめる。
 */
'use strict';
const path = require('path');
const Sim = require(path.join(__dirname, '..', 'js', 'sim.js'));
const LEVELS = require(path.join(__dirname, '..', 'js', 'levels.js'));
const byName = n => LEVELS.find(l => l.name === n);
let fails = 0;
function check(name, ok, detail) { console.log((ok ? 'OK  ' : 'NG  ') + name + '  … ' + detail); if (!ok) fails++; }
function run(s, sec, fn) { for (let i = 0; i < sec * 60; i++) { const inp = fn(s, i / 60); Sim.step(s, inp, 1 / 60); s.events.length = 0; } }
const spread = (as) => { const cx = as.reduce((a, b) => a + b.x, 0) / as.length, cy = as.reduce((a, b) => a + b.y, 0) / as.length; return Math.max(...as.map(a => Math.hypot(a.x - cx, a.y - cy))); };
const meanX = as => as.reduce((a, b) => a + b.x, 0) / as.length;
const open = (sheep, goats, extra) => Object.assign({ name: 't', time: 'noon', dog: [150, 400], sheep: sheep || [], goats: goats || [], pens: [] }, extra || {});
const flock = [[500, 380], [530, 400], [500, 420], [470, 400], [520, 370], [480, 430], [540, 425], [465, 372]];

// 1) 歩きと走りで、群れのまとまりが変わる
{
  const a = Sim.create(open(flock), 3), b = Sim.create(open(flock), 3);
  run(a, 5, s => ({ tx: meanX(s.animals) - 60, ty: 400, dash: false }));
  run(b, 5, s => ({ tx: meanX(s.animals) - 20, ty: 400, dash: true }));
  check('歩き：まとまったまま進む', spread(a.animals) < 70 && meanX(a.animals) > 620, `ひろがり ${spread(a.animals).toFixed(0)}px / 進み ${(meanX(a.animals) - 500).toFixed(0)}px`);
  check('走り：群れが散る', spread(b.animals) > spread(a.animals) * 2, `ひろがり ${spread(b.animals).toFixed(0)}px（歩きの ${(spread(b.animals) / spread(a.animals)).toFixed(1)} 倍）`);
}
// 2) クローバーのひつじは歩きでは動かず、走りで動く
{
  const lv = open([[500, 400], [520, 410], [490, 385]], [], { grass: [{ x: 505, y: 400, r: 70 }] });
  const a = Sim.create(lv, 3); run(a, 1.5, s => ({ tx: 150, ty: 400, dash: false }));
  const x0 = meanX(a.animals); run(a, 4, s => ({ tx: 470, ty: 400, dash: false }));
  check('クローバー：歩くコロでは動かない', Math.abs(meanX(a.animals) - x0) < 12 && a.animals.every(q => q.graze), `ずれ ${(meanX(a.animals) - x0).toFixed(1)}px`);
  run(a, 1, s => ({ tx: 250, ty: 400, dash: false }));
  run(a, 1.2, s => ({ tx: 700, ty: 400, dash: true }));
  check('クローバー：走るコロなら とび出す', a.animals.every(q => !Sim.grassAt(a, q.x, q.y, 0)), `クローバーの外へ出た数 ${a.animals.filter(q => !Sim.grassAt(a, q.x, q.y, 0)).length}/3`);
}
// 3) やぎは歩きを無視し、走りにはコロと反対へまっすぐ
{
  const a = Sim.create(open([], [[500, 400]]), 3);
  run(a, 3, s => ({ tx: 470, ty: 400, dash: false }));
  check('やぎ：歩くコロでは動かない', Math.hypot(a.animals[0].x - 500, a.animals[0].y - 400) < 15, `ずれ ${Math.hypot(a.animals[0].x - 500, a.animals[0].y - 400).toFixed(1)}px`);
  const b = Sim.create(open([], [[500, 400]], { dog: [300, 300] }), 3);
  run(b, 1.6, s => ({ tx: s.animals[0].x - 6, ty: s.animals[0].y - 3, dash: true }));
  const g = b.animals[0], ang = Math.atan2(g.y - 400, g.x - 500) * 180 / Math.PI;
  check('やぎ：走るコロと反対へ まっすぐ', g.x > 560 && Math.abs(ang - 26.6) < 15, `動いた向き ${ang.toFixed(0)}°（コロ→やぎ の向きは 27°）/ 距離 ${Math.hypot(g.x - 500, g.y - 400).toFixed(0)}px`);
}
// 4) 歩きは ふるいになる（わける）
{
  const s = Sim.create(byName('わける'), 5);
  run(s, 7, q => ({ tx: Math.max(...q.animals.filter(a => a.kind === 'sheep').map(a => a.x)) + 45, ty: 380, dash: false }));
  const sh = s.animals.filter(a => a.kind === 'sheep'), go = s.animals.filter(a => a.kind === 'goat');
  check('わける：歩いて押すと ひつじだけ動く', meanX(sh) < 520 && meanX(go) - meanX(sh) > 80 && Math.abs(meanX(go) - 630) < 40, `ひつじの平均x ${meanX(sh).toFixed(0)} / やぎの平均x ${meanX(go).toFixed(0)}`);
}
// 5) 門のクローバーは発射台になる（門番）
{
  const lv = Object.assign({}, byName('門番'), { goats: [], sheep: [[625, 380], [640, 400], [650, 375], [632, 415], [655, 405]], dog: [300, 390] });
  const s = Sim.create(lv, 5);
  run(s, 2, q => ({ tx: 300, ty: 390, dash: false }));
  const grazing = s.animals.filter(a => a.graze).length;
  run(s, 1.6, q => ({ tx: 640, ty: 390, dash: true }));
  const through = s.animals.filter(a => a.x > 660).length;
  check('門番：門のクローバーから走りで むこうへ', grazing === 5 && through >= 4, `食べていた数 ${grazing}/5 → 門のむこうへ出た数 ${through}/5`);
}
// 6) 泳いでいるあいだは おどろかせない
{
  const lv = open([[700, 400], [720, 415]], [], { ponds: [{ x: 500, y: 400, rx: 150, ry: 90 }], dog: [420, 400] });
  const s = Sim.create(lv, 3); let panics = 0, maxGait = 0;
  for (let i = 0; i < 120; i++) { Sim.step(s, { tx: 640, ty: 400, dash: true }, 1 / 60); if (s.dog.swim) maxGait = Math.max(maxGait, s.dog.gait); panics += s.events.filter(e => e.type === 'panic').length; s.events.length = 0; if (!s.dog.swim && i > 30) break; }
  check('池：泳いでいるあいだは走りにならない', maxGait < 2, `泳ぎ中の最大の足どり ${maxGait}（2が走り）`);
}
// 7) 壁ぎわのやぎを、壁から はがせる
{
  const s = Sim.create(open([], [[1236, 400]], { dog: [1200, 600] }), 3);
  run(s, 2.5, q => ({ tx: q.animals[0].x, ty: q.animals[0].y + 4, dash: true }));
  const g = s.animals[0];
  check('壁ぎわ：追うと内がわへ それる', Sim.C.BX1 - g.x > 26, `生け垣からの距離 ${(Sim.C.BX1 - g.x).toFixed(0)}px（はじめは 10px）`);
}
// 8) 小屋に入ると落ちつく／絵のちがう動物は門を通れない
{
  const pen = { x: 1060, y: 290, w: 180, h: 180, gate: 'L', gw: 96, accept: 'sheep' };
  const a = Sim.create(open([[1020, 380]], [], { pens: [pen], dog: [900, 380] }), 3);
  run(a, 4, q => ({ tx: q.animals[0].x - 40, ty: 380, dash: false }));
  const b = Sim.create(open([], [[1020, 380]], { pens: [pen], dog: [850, 380] }), 3);
  let maxX = 0;
  run(b, 3, q => { maxX = Math.max(maxX, q.animals[0].x); return { tx: q.animals[0].x - 6, ty: q.animals[0].y, dash: true }; });
  check('小屋：絵の合う動物だけが入って落ちつく', a.animals[0].settled && !b.animals[0].settled && maxX < 1060,
    `ひつじ 落ちついた=${a.animals[0].settled} / やぎ 落ちついた=${b.animals[0].settled}（門 x=1060 に対し、やぎの最大 x=${maxX.toFixed(0)}）`);
}
// 9) 小屋と生け垣のすきまに入りこめない
{
  const lv = LEVELS[LEVELS.length - 1], s = Sim.create(lv, 3), g = s.animals.find(a => a.kind === 'goat');
  g.x = 990; g.y = 90; s.dog.x = 900; s.dog.y = 90;
  run(s, 3, q => ({ tx: g.x - 5, ty: 90, dash: true }));
  check('すきま：小屋の上の細いすきまへ入れない', !(g.x > 1030 && g.y < 100), `やぎの位置 (${g.x.toFixed(0)}, ${g.y.toFixed(0)})（すきまは x>1030, y<100）`);
}
console.log(fails ? `\nNG ${fails} 件` : '\nぜんぶ OK');
process.exitCode = fails ? 1 : 0;
