// ルールの核の検査
//   node tools/rules_test.js
'use strict';
var D = require('../js/data.js'), E = require('../js/engine.js'), AI = require('../js/ai.js');
var ok = 0, ng = 0;
function t(name, cond, extra) { if (cond) ok++; else { ng++; console.log('NG:', name, extra || ''); } }

// データ
t('国は20', D.PROV.length === 20);
t('隣接は対称', D.ADJ.every(function (a, i) { return a.every(function (j) { return D.ADJ[j].indexOf(i) >= 0; }); }));
(function () { // 全部つながっている
  var seen = [0], q = [0];
  while (q.length) { var x = q.pop(); D.ADJ[x].forEach(function (y) { if (seen.indexOf(y) < 0) { seen.push(y); q.push(y); } }); }
  t('地図は一続き', seen.length === 20);
})();

function run(seed, player, pol, hook) {
  var G = E.create({ seed: seed, player: player }), guard = 0;
  while (!G.over && guard++ < 100) {
    E.startSeason(G);
    for (; G.oi < G.order.length && !G.over; G.oi++) {
      var c = G.order[G.oi];
      if (!G.clan[c].alive) continue;
      if (hook) G = hook(G) || G;
      AI.takeTurn(G, c, c === player ? pol : {});
      check(G);
    }
    if (!G.over) E.endSeason(G);
  }
  return G;
}
var bad = {};
function check(G) {
  G.prov.forEach(function (P, i) {
    if (!(P.troops >= 1)) bad['兵が1未満'] = i;
    if (!(P.eco >= 1 && P.eco <= 6 && P.cas >= 1 && P.cas <= 6)) bad['経済・城の範囲'] = i;
    if (!G.clan[P.owner].alive) bad['滅んだ家が国を持つ'] = i;
  });
  G.clan.forEach(function (c, i) { if (c.gold < 0) bad['金が負'] = i; if (c.alive !== (E.countOf(G, i) > 0)) bad['生死と国数の食い違い'] = i; });
}

// 20大名すべてをプレイヤー席にして最後まで
for (var p = 0; p < 20; p++) {
  var G = run(100 + p, p, { aggr: 0.9 });
  t(D.PROV[p].house + ' で終局する', !!G.over && (G.over.type === 'time' || G.over.type === 'unify'));
  t(D.PROV[p].house + ' 勝者は首位', G.over.winner === E.ranking(G)[0].clan);
  t(D.PROV[p].house + ' 履歴の長さ', G.over.type === 'unify' || G.history.length === E.R.TURNS + 1);
  var rk = E.ranking(G);
  for (var i = 1; i < rk.length; i++) if (rk[i].alive) t('順位は国数順', rk[i - 1].n >= rk[i].n);
}
// でたらめな采配でも壊れない
for (var s = 0; s < 60; s++) run(900 + s, s % 20, { random: true });
t('不変条件', Object.keys(bad).length === 0, JSON.stringify(bad));

// 保存して続きから：同じ結末になる
(function () {
  var a = run(4242, 5, {}), n = 0;
  var b = run(4242, 5, {}, function (G) { n++; return n % 7 === 0 ? JSON.parse(JSON.stringify(G)) : G; });
  t('保存と再開で同じ結末', JSON.stringify(a.prov) === JSON.stringify(b.prov) && a.rng === b.rng);
})();

// 個別のルール
(function () {
  var G = E.create({ seed: 7, player: 19, noJitter: true });
  E.startSeason(G); E.beginTurn(G, 19);
  var g0 = G.clan[19].gold;
  t('秋の年貢は2倍', g0 === 5 + 10);
  G.dice = [{ v: 6, used: false }, { v: 2, used: false }, { v: 1, used: false }];
  t('裏1では経済5を開発できない', !E.canDevelop(G, 0, 19));
  t('裏5なら経済5を開発できる', E.canDevelop(G, 1, 19));
  t('最初の季節は出陣できない', E.attack(G, [0], 19, 9, 5) === null);
  E.develop(G, 1, 19);
  t('開発で経済+1・金が減る', G.prov[19].eco === 6 && G.clan[19].gold === g0 - 6);
  var n = E.recruitN(G, 2, 19);
  t('徴兵は裏の目・金・上限のいちばん小さいもの', n === Math.min(6, Math.floor(G.clan[19].gold / 2), 12 - 9), n);
  E.guard(G, 0, 19);
  t('備えは表の目', G.prov[19].guard === 6);
  E.endTurn(G);
  G.turn = 1; E.beginTurn(G, 19);
  t('自分の番で備えは消える', G.prov[19].guard === 0);
  G.dice = [{ v: 4, used: false }, { v: 4, used: false }, { v: 3, used: false }];
  t('ゾロ目は+3', E.attackValue([4, 4]) === 11 && E.attackValue([4, 3]) === 7);
  G.prov[19].troops = 30; G.prov[9].troops = 4; G.prov[9].cas = 2; G.prov[9].guard = 0;
  t('勝ち目の計算', E.winProb(G, 9, 5, 11) === 1 && E.winProb(G, 9, 1, 7) === 0);
  var ev = E.attack(G, [0, 1], 19, 9, 20);
  t('勝てば国が移る', ev && ev.win && G.prov[9].owner === 19 && G.prov[9].truce === true);
  t('徳川は滅亡', !G.clan[9].alive && ev.fell);
  t('勝った側の損害', ev.attLoss === Math.ceil(4 / 3) && G.prov[9].troops === 20 - ev.attLoss);
  t('賽が増える（2国→3個、3国→4個）', E.diceCount(2) === 3 && E.diceCount(3) === 4 && E.diceCount(20) === 6);
  // 平定中は攻められない
  G.cur = 8; t('平定中は攻められない', !E.canAttack(G, 8, 9)); G.cur = 19;
  // 負け
  G.dice = [{ v: 1, used: false }];
  G.prov[10].troops = 20; var c0 = G.prov[10].cas;
  var ev2 = E.attack(G, [0], 19, 10, 6);
  t('攻めきれないと半分を失い、城が1段くずれる', ev2 && !ev2.win && ev2.attLoss === 3 && G.prov[10].cas === c0 - 1 && ev2.defLoss === 2);
  // 裏返し
  G.dice = [{ v: 2, used: false }, { v: 5, used: false }]; G.clan[19].gold = 20; G.flips = 0;
  E.flip(G, 0);
  t('裏返すと 7−目、金4', G.dice[0].v === 5 && G.clan[19].gold === 16);
  E.flip(G, 1);
  t('2回目は金8', G.dice[1].v === 2 && G.clan[19].gold === 8);
  t('同じ賽は二度裏返せない', !E.canFlip(G, 0));
  G.clan[19].gold = 100; G.bought = 0;
  var nd = G.dice.length; E.buyDie(G); E.buyDie(G); E.buyDie(G);
  t('賽を買う：金10・20・30、1季に3個まで', G.dice.length === nd + 3 && G.clan[19].gold === 40 && !E.canBuy(G));
  G.dice.length = nd; G.clan[19].gold = 8;
  var ev3 = E.endTurn(G);
  t('余った賽は金1', ev3.n === 2 && G.clan[19].gold === 10);
})();
// 統一の判定
(function () {
  var G = E.create({ seed: 3, player: 0 });
  G.prov.forEach(function (P) { P.owner = 0; });
  G.prov[5].owner = 5; G.prov[5].troops = 1; G.prov[5].cas = 1;
  G.clan.forEach(function (c, i) { c.alive = i === 0 || i === 5; });
  G.turn = 3; G.cur = 0; G.dice = [{ v: 6, used: false }, { v: 6, used: false }]; G.prov[3].troops = 30;
  var ev = E.attack(G, [0, 1], 3, 5, 20);
  t('20国で天下統一', ev.win && G.over && G.over.type === 'unify' && G.over.winner === 0);
})();

console.log(ng ? 'NG ' + ng + ' 件 / OK ' + ok : 'すべて OK（' + ok + ' 項目）');
process.exit(ng ? 1 : 0);
