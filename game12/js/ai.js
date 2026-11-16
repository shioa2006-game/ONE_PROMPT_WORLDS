/*
 * ころころ、ひらけ列島 ― ライバルの考えかた（CPU）
 * ゲームと 同じ「決めること（G.need）」だけを 見て、同じ 決めかたを 返す。
 * CPU は 地図と 公開情報だけを 使う（サイコロの 先の目は 知らない）。
 *   kon（コン社長）：目的地まっしぐら。きっぷを 早めに 切り、ふみきりで じゃまもする。
 *   pon（ポン社長）：名物あつめ。寄り道しても 駅に とまりたがる。
 *   smart / simple ：検証用（あなたの かわりに 遊ばせる ボット）
 */
(function (root) {
  'use strict';
  const KR = root.KR;
  const M = KR.MAP, E = KR.E;
  const AI = KR.AI = {};

  AI.PERSONA = {
    kon: { destW: 1.2, buyW: 0.85, reserve: 300, risk: 0.25, aggro: 0.8, moveCard: 7 },
    pon: { destW: 0.9, buyW: 1.35, reserve: 300, risk: -0.1, aggro: 0.4, moveCard: 9 },
    smart: { destW: 1.2, buyW: 1.15, reserve: 300, risk: 0, aggro: 0.6, moveCard: 7 },
  };

  AI.decide = function (G, persona, rnd) {
    const need = G.need;
    if (!need) return null;
    rnd = rnd || Math.random;
    if (persona === 'simple') return simple(G, need);
    const per = AI.PERSONA[persona] || AI.PERSONA.smart;
    const P = G.P[need.p];
    switch (need.k) {
      case 'action': return action(G, P, per, rnd);
      case 'landing': return { type: 'land', i: AI.pickLanding(G, P, per) };
      case 'buy': return buyStep(G, P, per);
      case 'event': return { type: 'choice', i: eventChoice(G, P, per, rnd) };
      case 'open': return { type: 'open', r: openChoice(G, P, need.options) };
      default: return null;
    }
  };

  function simple(G, need) {
    const P = G.P[need.p];
    if (need.k === 'action') return { type: 'roll' };
    if (need.k === 'landing') return { type: 'land', i: 0 };
    if (need.k === 'buy') {
      const pis = KR.STATIONS[G.buySt].pi.filter((i) => G.own[i] < 0 && M.props[i].price <= P.cash);
      if (pis.length && !P._boughtHere) { P._boughtHere = true; pis.sort((a, b) => M.props[a].price - M.props[b].price); return { type: 'buy', prop: pis[0] }; }
      P._boughtHere = false;
      return { type: 'done' };
    }
    if (need.k === 'event') return { type: 'choice', i: 0 };
    if (need.k === 'open') return { type: 'open', r: need.options[0] };
    return null;
  }

  // ---------------------------------------------------------- サイコロの前
  function action(G, P, per, rnd) {
    if (P.slow || P.used) return { type: 'roll' };
    const dd = E.destDist(G, P.node);
    const idx = (id) => P.cards.findIndex((c) => c.id === id);
    // 各停で ぴったり到着
    const kk = idx('kakueki');
    if (kk >= 0 && dd <= 6) {
      for (let v = 1; v <= 6; v++) {
        if (E.reach(G, P.i, v).some((o) => o.dest && o.exact)) return { type: 'card', idx: kk, value: v };
      }
    }
    // とびのり（遠いとき）
    const tb = idx('tobinori');
    if (tb >= 0 && dd >= 14 && E.canUseCard(G, P, tb)) return { type: 'card', idx: tb };
    // ふみきり：ゴール近くの ライバルを 止める
    const fk = idx('fumikiri');
    if (fk >= 0) {
      let tgt = -1, best = 99;
      G.P.forEach((q) => { if (q.i !== P.i && !q.slow) { const d = E.destDist(G, q.node); if (d < best) { best = d; tgt = q.i; } } });
      if (tgt >= 0 && best <= 7 && best < dd && rnd() < per.aggro) return { type: 'card', idx: fk, target: tgt };
    }
    // 速く走る きっぷ
    if (dd >= per.moveCard) {
      const order = dd >= 11 ? ['tokkyu', 'kaisuu', 'kaisoku'] : ['kaisuu', 'kaisoku', 'tokkyu'];
      for (const id of order) { const i = idx(id); if (i >= 0) return { type: 'card', idx: i }; }
    }
    const dr = idx('daruma');
    if (dr >= 0) return { type: 'card', idx: dr };
    return { type: 'roll' };
  }

  // ---------------------------------------------------------- どこに とまるか
  AI.stationValue = function (G, P, st, per) {
    const F = KR.inflation(G.turn);
    const pis = KR.STATIONS[st].pi;
    let budget = P.cash - per.reserve * F;
    let v = 0, free = 0, mine = 0, need = 0;
    for (const i of pis) {
      if (G.own[i] === P.i) mine++;
      else if (G.own[i] < 0) { free++; need += M.props[i].price; if (M.props[i].price <= budget) { v += 150 * F; budget -= M.props[i].price; } }
    }
    if (free && mine + free === pis.length && need <= P.cash - per.reserve * F) v += 450 * F;
    return v * per.buyW;
  };
  AI.scoreLanding = function (G, P, o, per) {
    const F = KR.inflation(G.turn);
    if (o.dest) return 1e6 + (o.exact ? 1 : 0);
    const dNow = E.destDist(G, P.node);
    let s = per.destW * (dNow - o.dd) * 160 * F;
    const t = M.nodes[o.node].t;
    if (t === 'st') s += AI.stationValue(G, P, o.node, per);
    else if (t === 'plus' || t === 'gate') s += 160 * F;
    else if (t === 'minus') s -= 115 * F;
    else if (t === 'card') s += P.cards.length < KR.HAND_MAX ? 220 * F : 150 * F;
    else if (t === 'event') s += 120 * F;
    s -= o.tolls * 200 * F;
    s += o.stamps * 60 * F;
    return s;
  };
  AI.pickLanding = function (G, P, per) {
    let bi = 0, bs = -1e18;
    G.opts.forEach((o, i) => { const s = AI.scoreLanding(G, P, o, per); if (s > bs) { bs = s; bi = i; } });
    return bi;
  };

  // ---------------------------------------------------------- 名物を 買う
  function buyStep(G, P, per) {
    const F = KR.inflation(G.turn);
    const st = G.buySt;
    const pis = KR.STATIONS[st].pi;
    const reserve = per.reserve * F;
    const season = KR.seasonOf(G.turn);
    // 買収
    if (P.cards.some((c) => c.id === 'baishu')) {
      const theirs = pis.filter((i) => G.own[i] >= 0 && G.own[i] !== P.i);
      const free = pis.filter((i) => G.own[i] < 0);
      for (const i of theirs) {
        const price = E.takeoverPrice(M.props[i]);
        const willMono = theirs.length === 1 && free.every((j) => M.props[j].price <= P.cash - price - reserve);
        if (price <= P.cash - reserve && (willMono || M.props[i].price >= 1500)) return { type: 'takeover', prop: i };
      }
    }
    const free = pis.filter((i) => G.own[i] < 0);
    if (!free.length) return { type: 'done' };
    const othersOwned = pis.some((i) => G.own[i] >= 0 && G.own[i] !== P.i);
    const totalFree = free.reduce((a, i) => a + M.props[i].price, 0);
    let order = free.slice();
    if (!othersOwned && totalFree <= P.cash - reserve * 0.5) {
      // 独占できるなら 高いほうから まとめて
      order.sort((a, b) => M.props[b].price - M.props[a].price);
      return { type: 'buy', prop: order[0] };
    }
    order = order.filter((i) => M.props[i].price <= P.cash - reserve);
    if (!order.length) return { type: 'done' };
    const key = (i) => (M.props[i].season === season ? 0 : 1) * 1e6 + M.props[i].price;
    order.sort((a, b) => key(a) - key(b));
    return { type: 'buy', prop: order[0] };
  }

  // ---------------------------------------------------------- できごと
  function evValue(G, P, eff, F, per) {
    let v = 0;
    if (eff.cost) v -= eff.cost * F;
    if (eff.money) v += eff.money * F;
    if (eff.card) v += P.cards.length < KR.HAND_MAX ? 220 * F : 200 * F;
    if (eff.perProp) v += eff.perProp * E.propsOf(G, P.i).length * F;
    if (eff.fromRival) v += eff.fromRival * F;
    if (eff.duel) v += per.risk * eff.duel * F * 0.4;
    if (eff.dice) {
      for (const r of eff.dice) v += ((r[1] - r[0] + 1) / 6) * evValue(G, P, r[2], F, per);
      v += per.risk * 150 * F;
    }
    return v;
  }
  function eventChoice(G, P, per, rnd) {
    const def = E.eventDef(G.evInst.id);
    const F = KR.inflation(G.turn);
    let bi = 0, bs = -1e18;
    def.ch.forEach((c, i) => {
      if (c.eff.cost && P.cash < c.eff.cost * F) return;
      const s = evValue(G, P, c.eff, F, per) + (rnd() - 0.5) * 60 * F;
      if (s > bs) { bs = s; bi = i; }
    });
    return bi;
  }

  // ---------------------------------------------------------- どの地方を ひらくか
  function openChoice(G, P, options) {
    let best = options[0], bs = -1e9;
    for (const r of options) {
      const ov = G.open.map((o) => (o ? 1 : 0)); ov[r] = 1;
      const sts = KR.STATIONS.map((s, i) => i).filter((i) => M.nodes[i].r === r);
      const near = (q) => { const d = E.dist(G, q.node, ov); let m = 99; for (const s of sts) if (d[s] >= 0 && d[s] < m) m = d[s]; return m; };
      const me = near(P);
      let other = 0, n = 0;
      G.P.forEach((q) => { if (q.i !== P.i) { other += near(q); n++; } });
      const gates = M.gates.filter((g) => (g.ra === r && G.open[g.rb]) || (g.rb === r && G.open[g.ra])).length;
      const s = other / Math.max(1, n) - me + gates * 0.8;
      if (s > bs) { bs = s; best = r; }
    }
    return best;
  }
})(typeof window !== 'undefined' ? window : globalThis);
