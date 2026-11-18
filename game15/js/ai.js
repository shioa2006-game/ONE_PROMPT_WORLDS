/* 賽駆け — CPU大名の思考
   1手ずつ「どの軍勢に、どの賽を、どこへ」を評価して最良のものを選ぶ（貪欲法）。
   位置の評価: 攻めやすい城への近さ／敵に狙われる危険／自国の城を守る価値／休んで兵を戻す価値 */
(function (root) {
  'use strict';
  const E = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.SG.E;
  const { nodes, adj, N, P, KYO } = E;
  const PROV = E.DATA.PROV;

  // ───── 静的な最短距離（占有・所有を無視）。冬・山越えの違いでキャッシュ ─────
  const distCache = {};
  function staticDist(s, c) {
    const mountain = E.trait(c) === 'mountain';
    const winter = E.isWinter(s);
    const key = (mountain ? 'm' : 'n') + (winter ? 'w' : 's');
    if (distCache[key]) return distCache[key];
    const cost = n => {
      const nd = nodes[n];
      if (nd.kind === 'c' || nd.t === 'R') return 1;
      if (mountain && nd.t === 'P') return 1;
      return 2 + (winter ? 1 : 0);
    };
    const D = [];
    for (let s0 = 0; s0 < N; s0++) {
      const d = new Array(N).fill(99); d[s0] = 0;
      const q = [s0]; // 小さい重みなので単純な緩和で十分
      for (let it = 0; it < q.length; it++) {
        const u = q[it];
        for (const v of adj[u]) { const nd = d[u] + cost(v); if (nd < d[v]) { d[v] = nd; q.push(v); } }
      }
      D.push(d);
    }
    distCache[key] = D;
    return D;
  }

  const sig = x => 1 / (1 + Math.exp(-x));

  function personality(s, c) {
    s.pers = s.pers || {};
    if (!s.pers[c]) s.pers[c] = { aggr: 0.85 + E.rand(s) * 0.4, caut: 0.75 + E.rand(s) * 0.45 };
    return s.pers[c];
  }

  // ───── その手番の思考の下ごしらえ ─────
  function context(s, c, opt) {
    opt = opt || {};
    const D = staticDist(s, c);
    const pers = opt.pers || personality(s, c);
    const cn = E.counts(s);
    const live = Object.keys(cn).filter(k => s.clans[k].alive && k !== c).sort((a, b) => cn[b] - cn[a]);
    const rival = live[0];
    const enemies = s.armies.filter(a => a.c !== c);
    const occ = new Array(N).fill(null);
    for (const a of s.armies) occ[a.n] = a;
    // 城の価値と守り
    const val = new Array(P).fill(0), defv = new Array(P).fill(0);
    for (let p = 0; p < P; p++) {
      const o = s.owner[p];
      let v = 7 + 4 * PROV[p].k + (p === KYO ? 10 : 0);
      if (o && o !== c) {
        v += 2;
        if (s.coal && o === s.coal && c !== s.coal) v += 9;
        if (o === rival && cn[rival] >= 8) v += 2;
        if (cn[o] === 1) v += 4;             // 滅ぼせる
        if (opt.hate && o === opt.hate) v += opt.hateBonus || 0;
      }
      if (o === c && p === KYO) v += 6;
      if (o === c) {
        const mine = cn[c] || 0;
        if (mine <= 2) v *= 2.5;           // 最後の砦は何としても守る
        else if (E.CAPITAL[p]) v *= 1.4;
      }
      val[p] = v;
      const a = occ[p];
      defv[p] = (a && !E.R.garWithArmy ? 0 : s.gar[p]) + E.castleDef(s, p, o) + (a ? a.t : 0);
    }
    // 自国の城への脅威（その城が落ちる確率のおおまかな見積もり）
    const threat = new Array(P).fill(0);
    for (const p of E.provsOf(s, c)) {
      let best = 0;
      for (const e of enemies) {
        const d = D[e.n][p];
        if (d > 7) continue;
        // 城攻めは隣からなので、隣にいる敵がいちばん危ない
        const pr = E.R.siegeAdj ? (adj[p].includes(e.n) ? 0.9 : d <= 6 ? 0.08 : 0) : (d <= 6 ? 0.85 : 0.3);
        const att = e.t + 3 + (E.trait(e.c) === 'charge' ? 1 : 0);
        best = Math.max(best, pr * sig((att - (s.gar[p] + E.castleDef(s, p, c) + 3.5)) / 1.6));
      }
      threat[p] = best;
    }
    // 本拠まわりの「露出」：次の季に敵が陣取れる城（守り手が近くにいないと危ない）
    const expo = new Array(P).fill(0);
    const mine = s.armies.filter(a => a.c === c);
    for (const p of E.provsOf(s, c)) {
      let e0 = 0;
      for (const e of enemies) {
        const d = D[e.n][p];
        if (d > 9) continue;
        const v = sig((e.t + 3 - (s.gar[p] + E.castleDef(s, p, c) + 3.5)) / 1.6) * (d <= 6 ? 0.65 : 0.3);
        if (v > e0) e0 = v;
      }
      expo[p] = e0;
    }
    return { s, c, D, pers, enemies, occ, val, defv, threat, cn, opt, expo, mine };
  }
  // 軍勢 id が n0 から n1 へ移ると、守り手のいなくなる城の損失
  function coverLoss(X, id, n0, n1) {
    const { s, c, D, expo, mine, val } = X;
    let loss = 0;
    for (let p = 0; p < P; p++) {
      if (s.owner[p] !== c || expo[p] < 0.15) continue;
      if (D[n0][p] > 3) continue;                // もともと守っていない
      if (D[n1][p] <= 3) continue;               // 移っても守れる
      let other = false;
      for (const a of mine) if (a.id !== id && D[a.n][p] <= 3) { other = true; break; }
      if (other) continue;
      loss += val[p] * expo[p] * 0.7;
    }
    return loss;
  }

  // ある位置にいる兵Tの軍勢の価値
  function posValue(X, n, T, selfId) {
    const { s, c, D, pers, enemies, occ, val, defv } = X;
    const nd = nodes[n];
    let opp = 0, nearest = 99;
    const siege = E.R.siegeAdj;
    for (let p = 0; p < P; p++) {
      if (s.owner[p] === c) continue;
      const d = D[n][p];
      if (d < nearest) nearest = d;
      if (d > 14) continue;
      // その城を囲む味方の数（加勢になる）
      let ring = 0;
      for (const m of adj[p]) { const a = occ[m]; if (a && a.c === c && a.id !== selfId && m !== n) ring++; }
      const adjHere = nd.kind === 'b' && (nd.a === p || nd.b === p);
      const sup = ring * E.supVal(c) * (adjHere ? 1 : 0.6);
      const pw = sig((T + 3.5 + sup - defv[p] - 3.5) / 1.6);
      let f;
      if (siege) f = adjHere ? 1 : d <= 7 ? 0.55 * (1 - d / 12) : 0.25 * (14 - d) / 14;
      else f = d <= 6 ? 1 - d * 0.05 : 0.7 * (12 - d) / 6;
      const v = val[p] * pw * f;
      if (v > opp) opp = v;
    }
    for (const e of enemies) {
      const d = D[n][e.n];
      if (d > 8) continue;
      const ed = e.t + (nodes[e.n].kind === 'c' ? defv[nodes[e.n].p] - e.t : 0) + 3.5;
      const pw = sig((T + 3 - ed) / 1.6);
      const f = d <= 6 ? 1 - d * 0.06 : 0.3;
      const v = (e.t * 1.6 + 3) * pw * f;
      if (v > opp) opp = v;
    }
    // 自分のいる場所の守り
    let myDef = T + 3.5;
    let ownCastle = false;
    if (nd.kind === 'c' && s.owner[nd.p] === c) { myDef += s.gar[nd.p] + E.castleDef(s, nd.p, c); ownCastle = true; }
    else if (nd.kind === 'b' && nd.t === 'P') myDef += 1;
    let sup = 0;
    for (const m of adj[n]) { const a = occ[m]; if (a && a.c === c && a.id !== selfId) sup++; }
    myDef += sup * E.supVal(c) * 0.6;
    let danger = 0;
    for (const e of enemies) {
      const d = D[e.n][n];
      if (d > 7) continue;
      const att = e.t + 3 + (E.trait(e.c) === 'charge' ? 1 : 0);
      const pl = sig((att - myDef) / 1.6) * (d <= 6 ? 0.75 : 0.25);
      danger += pl * (T * 0.9 + 3);
    }
    let defend = 0;
    if (ownCastle) {
      const p = nd.p;
      const before = X.threat[p];
      if (before > 0.05) {
        const extra = sig(-(T) / 2.2); // 兵が入るほど落ちにくい
        defend = val[p] * before * (1 - extra) * 1.1;
      }
    }
    const pull = nearest < 99 ? -0.35 * nearest : 0;
    if (X.dbg) X.dbg.push({ n, opp, defend, danger, pull });
    return opp * pers.aggr + defend - danger * pers.caut + pull;
  }

  function healValue(s, a) {
    const h = E.healAmount(s, a);
    return h * (a.t <= 4 ? 2.2 : a.t <= 6 ? 1.4 : 0.8);
  }

  // ───── 候補手の列挙と評価 ─────
  function diceOptions(s) {
    const free = s.dice.map((d, i) => (d.u ? -1 : i)).filter(i => i >= 0);
    const singles = [], seen = {};
    for (const i of free) { const v = s.dice[i].v; if (!seen[v]) { seen[v] = 1; singles.push([i]); } }
    const pairs = [], ps = {};
    for (let x = 0; x < free.length; x++) for (let y = x + 1; y < free.length; y++) {
      const a = s.dice[free[x]].v, b = s.dice[free[y]].v;
      const k = Math.min(a, b) + ',' + Math.max(a, b);
      if (!ps[k]) { ps[k] = 1; pairs.push([free[x], free[y]]); }
    }
    return { singles, pairs, free: free.length };
  }

  function evaluate(s, c, opt) {
    const X = context(s, c, opt);
    const mine = s.armies.filter(a => a.c === c && !a.mv);
    if (!mine.length) return null;
    const dopt = diceOptions(s);
    if (!dopt.singles.length) return null;
    const opts = dopt.singles.concat(dopt.free > mine.length || dopt.free >= 3 ? dopt.pairs : []);
    const maxB = Math.max.apply(null, opts.map(o => E.budgetOf(s, o)));
    let best = null;
    for (const a of mine) {
      const r = E.reach(s, a, maxB);
      const stay = posValue(X, a.n, a.t, a.id) + healValue(s, a);
      // 移動先の位置価値を一度だけ計算
      const pv = {};
      for (const n of r.moves) pv[n] = posValue(X, n, a.t, a.id);
      for (const o of opts) {
        const b = E.budgetOf(s, o);
        const penalty = o.length === 2 ? 2.5 + Math.min(s.dice[o[0]].v, s.dice[o[1]].v) * 0.4 : 0;
        for (const n of r.moves) {
          if (r.dist[n] > b) continue;
          const sc = pv[n] - stay - penalty - coverLoss(X, a.id, a.n, n);
          if (!best || sc > best.score) best = { army: a.id, idxs: o, target: n, score: sc, kind: 'move' };
        }
        for (const at of r.attacks) {
          if (at.cost > b) continue;
          const left = b - at.cost;
          // 見積もりは「仕掛ける地点に立った状態」で
          const n0 = a.n; a.n = at.from;
          const pv2 = E.preview(s, a, at.t, left);
          a.n = n0;
          const tn = nodes[at.t];
          const da = X.occ[at.t];
          let gain;
          if (tn.kind === 'c') {
            gain = X.val[tn.p] + (da ? da.t * 1.2 : 0);
            // 落とした後に取り返される危険
            gain -= 0.5 * posDangerAfter(X, at.t, Math.max(1, a.t - 1));
          } else {
            gain = da.t * 1.7 + 3;
            // 自国の城を脅かしている敵なら価値が上がる
            for (const m of adj[at.t]) if (nodes[m].kind === 'c' && s.owner[nodes[m].p] === c) gain += X.val[nodes[m].p] * (0.2 + 0.6 * X.threat[nodes[m].p]);
          }
          const p = pv2.p;
          const lossFail = 1 + Math.max(0, (pv2.D.total + 3.5 - pv2.A.total) / 2);
          const sc = p * gain * X.pers.aggr - (1 - p) * (lossFail * 1.7 + 3) - p * 1.0 - healValue(s, a) * 0.5 - penalty
            + (pv2.kishu && p >= 1 ? 1.5 : 0) - coverLoss(X, a.id, a.n, at.from) * 0.8;
          if (!best || sc > best.score) best = { army: a.id, idxs: o, target: at.t, score: sc, kind: 'attack', p };
        }
      }
    }
    return best;
  }

  function posDangerAfter(X, n, T) {
    const { s, c, D, enemies } = X;
    const nd = nodes[n];
    let myDef = T + 3.5 + 1 + E.castleDef(s, nd.p, c);
    let danger = 0;
    for (const e of enemies) {
      const d = D[e.n][n];
      if (d > 7) continue;
      const att = e.t + 3;
      danger += sig((att - myDef) / 1.6) * (d <= 6 ? 0.7 : 0.2) * (X.val[nd.p] * 0.6);
    }
    return Math.min(danger, X.val[nd.p]);
  }

  function chooseSpawn(s, c) {
    const optsN = E.spawnOptions(s, c);
    if (!optsN.length) return null;
    const X = context(s, c);
    const T = E.R.newArmy + (E.trait(c) === 'bigarmy' ? 2 : 0);
    let best = optsN[0], bs = -Infinity;
    for (const n of optsN) {
      const v = posValue(X, n, T, -1) + X.threat[nodes[n].p] * X.val[nodes[n].p] * 0.5 + E.rand(s) * 0.5;
      if (v > bs) { bs = v; best = n; }
    }
    return best;
  }

  function maybeReroll(s, c, opt) {
    if (!E.canReroll(s)) return [];
    // いちばん小さい賽の使い道が乏しければ振り直す
    let lo = -1;
    s.dice.forEach((d, i) => { if (!d.u && (lo < 0 || d.v < s.dice[lo].v)) lo = i; });
    if (lo < 0 || s.dice[lo].v >= 4) return [];
    const keep = s.dice.map(d => d.u);
    s.dice.forEach((d, i) => { d.u = i !== lo; });
    const b = evaluate(s, c, opt);
    s.dice.forEach((d, i) => { d.u = keep[i]; });
    if (b && b.score > 3) return [];
    return E.reroll(s, lo);
  }

  // 1手選ぶ（なければ null）
  function nextMove(s, c, opt) {
    const b = evaluate(s, c, opt);
    if (!b || b.score < 0.3) return null;
    return b;
  }

  // CPUの手番を丸ごと進める（beginClanTurn 済みの状態から）
  function playTurn(s, opt) {
    const c = s.cur, ev = [];
    if (s.phase === 'place') ev.push.apply(ev, E.spawn(s, chooseSpawn(s, c)));
    if (s.phase === 'roll') ev.push.apply(ev, E.roll(s));
    ev.push.apply(ev, maybeReroll(s, c, opt));
    for (let guard = 0; guard < 8 && !s.over; guard++) {
      const m = nextMove(s, c, opt);
      if (!m) break;
      const e = E.move(s, m.army, m.idxs, m.target);
      if (!e) break;
      ev.push.apply(ev, e);
    }
    if (!s.over) ev.push.apply(ev, E.endClanTurn(s));
    return ev;
  }

  const AI = { staticDist, context, posValue, evaluate, nextMove, chooseSpawn, maybeReroll, playTurn, personality };
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
  else { root.SG = root.SG || {}; root.SG.AI = AI; }
})(typeof window !== 'undefined' ? window : globalThis);
