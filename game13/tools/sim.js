// CPU 同士の対戦シミュレーター
//   node tools/sim.js world [回数]            … 全員 CPU。勢力図の散らばりを見る
//   node tools/sim.js seat [回数] [方針]      … 20大名それぞれを「プレイヤー席（先手）」に座らせて方針別に比べる
//   node tools/sim.js one [seed] [大名番号]   … 1ゲームの年表を出す
// 方針：smart（CPUと同じ）/ bold（攻め気0.9）/ turtle（攻めない）/ brawn（内政しない）/ random / noguard / noreroll
'use strict';
var D = require('../js/data.js'), E = require('../js/engine.js'), AI = require('../js/ai.js');

var POL = {
  smart: {}, bold: { aggr: 0.9 }, careful: { aggr: 0.2 }, turtle: { noAttack: true },
  brawn: { noDevelop: true, noFortify: true, aggr: 0.9 }, random: { random: true },
  noguard: { noGuard: true }, noreroll: { noReroll: true }, noflip: { noFlip: true }, nobuy: { noBuy: true }, nostack: { noStack: true }, rush: { aggr: 0.95, thr: 0.34 }
};

function play(seed, player, pol) {
  var G = E.create({ seed: seed, player: player });
  var battles = 0, wins = 0;
  while (!G.over) {
    E.startSeason(G);
    for (var i = 0; i < G.order.length && !G.over; i++) {
      var c = G.order[i];
      if (!G.clan[c].alive) continue;
      var ev = AI.takeTurn(G, c, c === player ? pol : {});
      ev.forEach(function (e) { if (e.type === 'battle') { battles++; if (e.win) wins++; } });
    }
    if (!G.over) E.endSeason(G);
  }
  return { G: G, battles: battles, wins: wins };
}

process.argv.forEach(function (a) { if (a.indexOf('--set=') === 0) a.slice(6).split(',').forEach(function (kv) { var x = kv.split('='); E.R[x[0]] = +x[1]; }); });
process.argv = process.argv.filter(function (a) { return a.indexOf('--') !== 0; });
function wv(o) { var w = {}; for (var k in AI.W0) w[k] = AI.W0[k]; for (var j in o) w[j] = o[j]; return w; }
// 重み違い（名前:値;名前:値）
function polOf(nm) {
  if (POL[nm]) return POL[nm];
  var o = {}, pol = {};
  nm.split(';').forEach(function (kv) { var x = kv.split(':'); if (x[0] === 'aggr' || x[0] === 'thr') pol[x[0]] = +x[1]; else o[x[0]] = +x[1]; });
  pol.w = wv(o); return pol;
}
var mode = process.argv[2] || 'world';
var N = +process.argv[3] || 200;

if (mode === 'world') {
  var winCount = D.PROV.map(function () { return 0; }), topN = [], alive = [], bat = 0, surv = D.PROV.map(function () { return 0; });
  var goldS = 0, ecoS = 0, casS = 0, trS = 0, per = [];
  var avgN = D.PROV.map(function () { return 0; }), unify = 0, rankSum = D.PROV.map(function () { return 0; });
  for (var s = 0; s < N; s++) {
    var r = play(1000 + s, -1, {});
    var rk = E.ranking(r.G);
    winCount[rk[0].clan]++; topN.push(rk[0].n); bat += r.battles;
    alive.push(rk.filter(function (x) { return x.alive; }).length);
    rk.forEach(function (x, i) { if (x.alive) surv[x.clan]++; avgN[x.clan] += x.n; rankSum[x.clan] += i + 1; });
    if (r.G.over.type === 'unify') unify++;
    r.G.clan.forEach(function (c) { goldS += c.gold; }); r.G.prov.forEach(function (p) { ecoS += p.eco; casS += p.cas; trS += p.troops; });
    r.G.chron.forEach(function (c) { per[c.t] = (per[c.t] || 0) + 1; });
  }
  topN.sort(function (a, b) { return a - b; });
  console.log('games', N, ' 合戦/局', (bat / N).toFixed(1), ' 首位の国数 中央', topN[N >> 1], '最小', topN[0], '最大', topN[N - 1],
    ' 生存大名 平均', (alive.reduce(function (a, b) { return a + b; }) / N).toFixed(1), ' 統一', unify);
  console.log('終局の平均 金/家', (goldS / N / 20).toFixed(1), '経済/国', (ecoS / N / 20).toFixed(2), '城/国', (casS / N / 20).toFixed(2), '兵/国', (trS / N / 20).toFixed(1));
  var ps = ''; for (var t = 0; t < E.R.TURNS; t++) ps += ((per[t] || 0) / N).toFixed(1) + ' '; console.log('季ごとの国替え', ps);
  console.log('大名\t\t優勝%\t生存%\t平均国数\t平均順位');
  D.PROV.forEach(function (p, i) {
    console.log((p.house + '　　　　').slice(0, 5) + '\t' + (100 * winCount[i] / N).toFixed(1) + '\t' + (100 * surv[i] / N).toFixed(0) + '\t' + (avgN[i] / N).toFixed(2) + '\t\t' + (rankSum[i] / N).toFixed(1));
  });
} else if (mode === 'seat') {
  var names = (process.argv[4] || 'smart,bold,careful,turtle,brawn,random').split(',');
  console.log('大名\t' + names.map(function (n) { return n + '(優勝%/平均国数/滅亡%)'; }).join('\t'));
  var tot = names.map(function () { return [0, 0, 0]; });
  D.PROV.forEach(function (p, i) {
    var line = (p.house + '　　　　').slice(0, 5);
    names.forEach(function (nm, k) {
      var w = 0, n = 0, dead = 0;
      for (var s = 0; s < N; s++) {
        var r = play(5000 + s * 7, i, polOf(nm));
        if (r.G.over.winner === i) w++;
        n += E.countOf(r.G, i); if (!r.G.clan[i].alive) dead++;
      }
      tot[k][0] += w; tot[k][1] += n; tot[k][2] += dead;
      line += '\t' + (100 * w / N).toFixed(0) + ' / ' + (n / N).toFixed(1) + ' / ' + (100 * dead / N).toFixed(0);
    });
    console.log(line);
  });
  console.log('全体\t' + tot.map(function (t) { return (100 * t[0] / N / 20).toFixed(1) + ' / ' + (t[1] / N / 20).toFixed(2) + ' / ' + (100 * t[2] / N / 20).toFixed(0); }).join('\t'));
} else if (mode === 'one') {
  var r1 = play(+process.argv[3] || 1, process.argv[4] == null ? -1 : +process.argv[4], {});
  r1.G.chron.forEach(function (c) {
    var d = E.dateOf(c.t);
    console.log(d.year + d.season, D.PROV[c.a].house, '→', D.PROV[c.p].name, '(' + D.PROV[c.d].house + ')', c.k === 'fall' ? '【滅亡】' : '');
  });
  E.ranking(r1.G).slice(0, 8).forEach(function (x, i) { console.log(i + 1, D.PROV[x.clan].house, x.n + '国', '経済' + x.eco, '兵' + x.troops, '金' + x.gold); });
  console.log(r1.G.over, '合戦', r1.battles, '勝ち', r1.wins);
}
