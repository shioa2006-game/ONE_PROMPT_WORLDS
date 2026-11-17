// からり、国盗り ― CPU 大名の思考
// プレイヤーと同じルール・同じサイコロで動く。使う情報は盤面に見えているものだけ
(function (root) {
  'use strict';
  var node = (typeof module !== 'undefined' && module.exports);
  var D = node ? require('./data.js') : root.KD;
  var E = node ? require('./engine.js') : root.KE;

  // 攻め手の目 a と守り手の目 d で a-d > k となる確率（k = -5..4）
  var PD = { '-5': 35 / 36, '-4': 33 / 36, '-3': 30 / 36, '-2': 26 / 36, '-1': 21 / 36, '0': 15 / 36, '1': 10 / 36, '2': 6 / 36, '3': 3 / 36, '4': 1 / 36 };
  function pDiff(k) { return k <= -6 ? 1 : k >= 5 ? 0 : PD[k]; }

  // 自国 p が落とされる見込み。extra は守りに足す量
  function pFall(G, p, extra, c) {
    var S = -1;
    D.ADJ[p].forEach(function (q) { var Q = G.prov[q]; if (Q.owner !== c && Q.troops - 1 > S) S = Q.troops - 1; });
    if (S < 1) return 0;
    // 相手はサイコロを重ねてくることもあるので、少し強めに見積もる
    return pDiff(E.defBase(G.prov[p]) + (extra || 0) - S - 2);
  }
  function frontier(G, p, c) {
    for (var i = 0; i < D.ADJ[p].length; i++) if (G.prov[D.ADJ[p][i]].owner !== c) return true;
    return false;
  }
  function worth(G, p, c, nOwn) { return 5 + G.prov[p].eco + (nOwn === 1 ? 5 : 0); }

  // 評価の重み（tools/sim.js の席替え対戦で決めた）
  var W0 = { atk: 1.0, def: 1.6, fort: 1.0, rec: 0.9, dev: 0.6, devCiv: 0.8, devLeft: 0.14, mv: 1.2, rr: 2.6, flip: 2.0, hold: 0.1, expose: 0.7, buyKeep: 6 };

  function candidates(G, c, pol) {
    var me = G.clan[c], ps = E.provsOf(G, c), nOwn = ps.length, out = [];
    var W = pol.w || W0;
    var aggr = pol.aggr != null ? pol.aggr : me.aggr, civ = me.civ;
    var thr = pol.thr != null ? pol.thr : 0.42 + 0.38 * (1 - aggr);
    var left = E.R.TURNS - G.turn;
    var free = [];
    G.dice.forEach(function (d, i) { if (!d.used) free.push(i); });
    if (!free.length) return out;
    var ip = E.incomeParts(G, c), strain = ip.upkeep >= ip.gross ? 0.35 : ip.upkeep * 2 >= ip.gross ? 0.75 : 1;
    var top = null;
    if (!pol.noLeaderBias) { var rk = E.ranking(G); if (rk[0].n >= 4) top = rk[0].clan; }

    // 出陣
    if (!pol.noAttack && G.turn >= E.R.PEACE) {
      var combos = free.map(function (i) { return [i]; });
      if (!pol.noStack) for (var x = 0; x < free.length; x++) for (var y = x + 1; y < free.length; y++) combos.push([free[x], free[y]]);
      ps.forEach(function (p) {
        var P = G.prov[p];
        if (P.troops < 3) return;
        var fallNow = pFall(G, p, 0, c);
        D.ADJ[p].forEach(function (t) {
          var T = G.prov[t];
          if (T.owner === c || T.truce) return;
          // 残す兵：ほかの敵に備える分
          var S = -1;
          D.ADJ[p].forEach(function (q) { if (q !== t && G.prov[q].owner !== c && G.prov[q].troops - 1 > S) S = G.prov[q].troops - 1; });
          var keep = 1;
          if (S > 0) keep = Math.max(1, Math.min(P.troops - 2, S + 2 - P.cas * E.R.CASTLE - P.guard));
          var St = -1;
          D.ADJ[t].forEach(function (q) { if (q !== p && G.prov[q].owner !== c && G.prov[q].troops - 1 > St) St = G.prov[q].troops - 1; });
          var ns = [P.troops - 1];
          if (keep > 1) ns.push(P.troops - keep);
          var val = 4 + T.eco + (E.countOf(G, T.owner) === 1 ? 2.5 : 0) + (T.owner === top && top !== c ? 3 : 0);
          ns.forEach(function (n) {
            combos.forEach(function (cb) {
              var V = E.attackValue(cb.map(function (i) { return G.dice[i].v; }));
              var pw = E.winProb(G, t, n, V);
              if (pw < thr - (T.owner === top && top !== c ? 0.17 : 0)) return;
              var exposeAfter = 0;
              if (S > 0) exposeAfter = pDiff((P.troops - n) + P.cas * E.R.CASTLE + P.guard - S - 2);
              // 奪ったあと持ちこたえられるか（平定が明けたときの見込み）
              var surv = n - Math.min(n - 1, Math.ceil(T.troops / E.R.WINLOSS));
              var holdRisk = St > 0 ? pDiff(surv + Math.max(1, T.cas - E.R.RAZE) * E.R.CASTLE - St - 2) : 0;
              var sc = W.atk * pw * val * (0.6 + 0.8 * aggr) * (1 - W.hold * holdRisk) - (1 - pw) * n * 0.25 - 0.1 * V - (cb.length - 1) * 1.2
                - Math.max(0, exposeAfter - fallNow) * worth(G, p, c, nOwn) * W.expose - T.troops * 0.08;
              out.push({ sc: sc, k: 'attack', dis: cb, from: p, to: t, n: n });
            });
          });
        });
      });
    }

    free.forEach(function (i) {
      var v = G.dice[i].v, u = 7 - v;
      ps.forEach(function (p) {
        var P = G.prov[p], fr = frontier(G, p, c), w = worth(G, p, c, nOwn);
        var f0 = (fr ? pFall(G, p, 0, c) : 0);
        if (!pol.noGuard && fr && v > P.guard && f0 > 0.02) {
          out.push({ sc: (f0 - pFall(G, p, v - P.guard, c)) * w * W.def - 0.1 * (6 - v), k: 'guard', di: i, p: p });
        }
        if (!pol.noFortify && E.canFortify(G, i, p)) {
          out.push({ sc: (f0 - pFall(G, p, E.R.CASTLE, c)) * w * W.def + (fr ? W.fort : W.fort * 0.2) + 0.03 * left - 0.15 * (u - P.cas) - 0.1 * E.fortCost(P.cas), k: 'fortify', di: i, p: p });
        }
        var n = E.recruitN(G, i, p);
        if (!pol.noRecruit && n > 0) {
          out.push({ sc: (f0 - pFall(G, p, n, c)) * w * W.def + n * (fr ? W.rec * (0.4 + aggr) : W.rec * 0.2) * strain - 0.1 * (u - n), k: 'recruit', di: i, p: p });
        }
        if (!pol.noDevelop && E.canDevelop(G, i, p)) {
          out.push({ sc: W.dev + civ * W.devCiv + W.devLeft * left - f0 * 3 - 0.15 * (u - P.eco) - 0.1 * E.buildCost(P.eco), k: 'develop', di: i, p: p });
        }
        // 奥の国から前線へ兵を送る
        if (!fr && P.troops > 1) {
          D.ADJ[p].forEach(function (q) {
            if (G.prov[q].owner !== c || !frontier(G, q, c)) return;
            var m = E.moveMax(G, p, q);
            if (m > 0) out.push({ sc: W.mv + 0.25 * m - 0.2 * Math.max(v, u), k: 'move', di: i, from: p, to: q, n: m });
          });
        }
      });
    });
    return out;
  }
  function bestOf(cs) {
    var best = null;
    cs.forEach(function (a) { if (!best || a.sc > best.sc) best = a; });
    return best;
  }

  function exec(G, a) {
    switch (a.k) {
      case 'attack': return E.attack(G, a.dis, a.from, a.to, a.n);
      case 'guard': return E.guard(G, a.di, a.p);
      case 'fortify': return E.fortify(G, a.di, a.p);
      case 'recruit': return E.recruit(G, a.di, a.p);
      case 'develop': return E.develop(G, a.di, a.p);
      case 'move': return E.move(G, a.di, a.from, a.to, a.n);
      case 'reroll': return E.reroll(G);
      case 'flip': return E.flip(G, a.di);
      case 'buy': return E.buyDie(G);
    }
    return null;
  }

  // いまの盤面でいちばん良い一手（サイコロは振ってある前提）。{k:'reroll'} や {k:'flip'} も返す
  function choose(G, c, pol) {
    pol = pol || {};
    var W = pol.w || W0;
    var cs = candidates(G, c, pol);
    if (pol.random) {
      if (!cs.length) return null;
      return cs[Math.floor(E.rnd(G) * cs.length)];
    }
    var best = bestOf(cs);
    var free = 0; G.dice.forEach(function (d) { if (!d.used) free++; });
    if (!G.rerolled && !pol.noReroll && free > 0 && (!best || best.sc < W.rr)) return { k: 'reroll', sc: 0 };
    // 金に余裕があれば裏返しも考える
    if (!pol.noFlip && G.clan[c].gold >= E.flipCost(G)) {
      var b0 = best ? best.sc : 0, pick = -1, gain = 0.5;
      G.dice.forEach(function (d, i) {
        if (d.used || d.f || d.v === 3 || d.v === 4) return;
        var fc = E.flipCost(G); d.v = 7 - d.v; G.clan[c].gold -= fc;
        var b = bestOf(candidates(G, c, pol));
        d.v = 7 - d.v; G.clan[c].gold += fc;
        var fp = W.flip * Math.max(0.15, Math.min(1, 1 - (G.clan[c].gold - fc) / 30)); if (b && b.sc - fp - b0 > gain) { gain = b.sc - fp - b0; pick = i; }
      });
      if (pick >= 0) return { k: 'flip', di: pick, sc: b0 + gain };
    }
    // 使い切ったあと、金が余っていれば賽を買い足す
    if (!pol.noBuy && free === 0 && E.canBuy(G) && G.clan[c].gold >= E.buyCost(G) + W.buyKeep) return { k: 'buy', sc: 1 };
    if (!best || best.sc < 0.3) return null;
    return best;
  }

  function takeTurn(G, c, pol) {
    var ev = E.beginTurn(G, c), guardN = 0;
    while (guardN++ < 60 && !G.over) {
      var a = choose(G, c, pol);
      if (!a) break;
      var e = exec(G, a);
      if (!e) break;
      ev.push(e);
    }
    ev.push(E.endTurn(G));
    return ev;
  }

  var AI = { W0: W0, takeTurn: takeTurn, choose: choose, exec: exec, candidates: candidates, pFall: pFall, frontier: frontier };
  if (node) module.exports = AI;
  else root.KAI = AI;
})(typeof window !== 'undefined' ? window : globalThis);
