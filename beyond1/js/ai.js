/* 戦国すごろく全国版 — CPU大名の思考
   主要大名：1手ずつ「どの軍勢に、どの賽を、どこへ（または何の内政に）」を評価して最良のものを選ぶ（貪欲法）。
   その他の大名：隣の城・隣の敵・自分の城の内政だけを見る軽い判断。 */
(function (root) {
  'use strict';
  const E = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.SG.E;
  const { nodes, adj, N, P, KYO } = E;
  const PROV = E.DATA.PROV;
  const R = E.R;

  // ───── 静的な最短距離（占有・所有を無視）。冬・家風の違いでキャッシュ ─────
  const distCache = {};
  function staticDist(s, c) {
    const tr = E.trait(c);
    const mountain = tr === 'mountain';
    const winter = E.isWinter(s) && tr !== 'snow';
    const key = (mountain ? 'm' : 'n') + (winter ? 'w' : 's');
    if (distCache[key]) return distCache[key];
    const cost = n => {
      const nd = nodes[n];
      if (nd.kind === 'c') return 1;
      if (nd.t === 'R') return 1 + (winter && nd.snowy ? 1 : 0);
      if (nd.t === 'P') return mountain ? 1 : 2 + (winter ? 1 : 0);
      return 2 + (winter ? 1 : 0);
    };
    const D = [];
    for (let s0 = 0; s0 < N; s0++) {
      const d = new Array(N).fill(99); d[s0] = 0;
      const q = [s0];
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
    if (!s.pers[c]) s.pers[c] = { aggr: 0.85 + (R.aiAggr || 0) + E.rand(s) * 0.4, caut: 0.75 + E.rand(s) * 0.45, dev: 0.8 + E.rand(s) * 0.5 };
    return s.pers[c];
  }

  // ───── その手番の思考の下ごしらえ ─────
  function context(s, c, opt) {
    opt = opt || {};
    const D = staticDist(s, c);
    const pers = opt.pers || personality(s, c);
    const kk = E.kokAll(s), cn = E.counts(s);
    const live = Object.keys(kk).filter(k => s.clans[k].alive && k !== c).sort((a, b) => kk[b] - kk[a]);
    const rival = live[0];
    const occ = new Array(N).fill(null);
    for (const a of s.armies) occ[a.n] = a;
    const mine = s.armies.filter(a => a.c === c);
    const myProvs = E.provsOf(s, c);
    // 近くの敵だけを見る（全国の軍勢を毎回なめると重い）
    const enemies = s.armies.filter(a => {
      if (a.c === c) return false;
      for (const m of mine) if (D[m.n][a.n] <= 12) return true;
      for (const p of myProvs) if (D[p][a.n] <= 10) return true;
      return false;
    });
    // 城の価値と守り
    const val = new Array(P).fill(0), defv = new Array(P).fill(0);
    for (let p = 0; p < P; p++) {
      const o = s.owner[p];
      let v = 7 + 2.5 * s.kok[p] + (p === KYO ? 10 : 0);
      if (o && o !== c) {
        v += 2;
        if (s.coal && o === s.coal && c !== s.coal) v += 9;
        if (o === rival && kk[rival] >= 25) v += 2;
        if (cn[o] === 1) v += 4;             // 滅ぼせる
        if (!E.isMajor(o)) v += 1;
        if (opt.hate && o === opt.hate) v += opt.hateBonus || 0;
      }
      if (o === c && p === KYO) v += 6;
      if (o === c) {
        const n = cn[c] || 0;
        if (n <= 2) v *= 2.5;               // 最後の砦は何としても守る
        else if (E.CAPITAL[p]) v *= 1.4;
      }
      val[p] = v;
      const a = occ[p];
      defv[p] = (a && !R.garWithArmy ? 0 : s.gar[p]) + E.castleDef(s, p, o) + (a ? a.t : 0);
    }
    // 自国の城への脅威
    const threat = new Array(P).fill(0), expo = new Array(P).fill(0), near = new Array(P).fill(99);
    for (const p of myProvs) {
      let best = 0, e0 = 0, nd = 99;
      for (const e of enemies) {
        const d = D[e.n][p];
        if (d < nd) nd = d;
        if (d > 9) continue;
        const pr = adj[p].includes(e.n) ? 0.9 : d <= 6 ? 0.08 : 0;
        const att = e.t + 3 + (E.trait(e.c) === 'charge' ? 1 : 0);
        best = Math.max(best, pr * sig((att - (s.gar[p] + E.castleDef(s, p, c) + 3.5)) / 1.6));
        const v = sig((e.t + 3 - (s.gar[p] + E.castleDef(s, p, c) + 3.5)) / 1.6) * (d <= 6 ? 0.65 : 0.3);
        if (v > e0) e0 = v;
      }
      threat[p] = best; expo[p] = e0; near[p] = nd;
    }
    return { s, c, D, pers, enemies, occ, val, defv, threat, cn, kk, opt, expo, near, mine, myProvs };
  }
  // 軍勢 id が n0 から n1 へ移ると、守り手のいなくなる城の損失
  function coverLoss(X, id, n0, n1) {
    const { D, expo, mine, val, myProvs } = X;
    let loss = 0;
    for (const p of myProvs) {
      if (expo[p] < 0.15) continue;
      if (D[n0][p] > 3) continue;
      if (D[n1][p] <= 3) continue;
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
    for (let p = 0; p < P; p++) {
      if (s.owner[p] === c) continue;
      const d = D[n][p];
      if (d < nearest) nearest = d;
      if (d > 14) continue;
      let ring = 0;
      for (const m of adj[p]) { const a = occ[m]; if (a && a.c === c && a.id !== selfId && m !== n) ring++; }
      const adjHere = nd.kind === 'b' && (nd.a === p || nd.b === p);
      const sup = ring * E.supVal(c) * (adjHere ? 1 : 0.6);
      const pw = sig((T + 3.5 + sup - defv[p] - 3.5) / 1.6);
      const f = adjHere ? 1 : d <= 7 ? 0.55 * (1 - d / 12) : 0.25 * (14 - d) / 14;
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
        const extra = sig(-(T) / 2.2);
        defend = val[p] * before * (1 - extra) * 1.1;
      }
    }
    const pull = nearest < 99 ? -0.35 * nearest : 0;
    return opp * pers.aggr + defend - danger * pers.caut + pull;
  }

  function healValue(s, a) {
    const h = E.healAmount(s, a);
    return h * (a.t <= 4 ? 2.2 : a.t <= 6 ? 1.4 : 0.8);
  }

  // 内政の価値（その場にとどまって休む場合との差は呼び出し側で引く）
  const KOK_VALUE = 4;
  function governValue(X, a, kind, v) {
    const { s, threat, expo, near, val, pers } = X;
    const o = E.governPreview(s, a, kind, v);
    if (!o.ok) return null;
    const p = o.p;
    const front = near[p] <= 4 ? 1 : 0;
    if (kind === 'recruit') {
      const w = a.t <= 4 ? 1.7 : a.t <= 7 ? 1.05 : 0.6;
      return o.gain * w * (1 + 1.4 * threat[p] + 0.5 * front) - 0.22 * (v - 1);
    }
    if (kind === 'develop') {
      const safe = Math.max(0.1, 1 - Math.min(0.9, threat[p] * 1.5 + expo[p] * 0.8));
      const prog = o.up + (o.kp1 - (o.up ? 0 : o.cur)) / Math.max(1, o.need);
      return Math.max(0, prog) * KOK_VALUE * safe * (pers.dev || 1);
    }
    if (kind === 'fortify') {
      const risk = 0.04 + 0.8 * expo[p] + 1.2 * threat[p];
      const prog = o.up + (o.fp1 - (o.up ? 0 : o.cur)) / Math.max(1, o.need);
      const garGain = Math.max(0, o.gar1 - o.gar);
      // 守備兵が効くのは城が空いているときだけなので、差し迫った脅威がなければ控えめに
      return prog * Math.min(val[p], 22) * risk * 0.18 + garGain * threat[p] * 1.2;
    }
    return null;
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

  // filter: 動かしてよい軍勢（省略時はその家の未行動の軍勢すべて）
  function evaluate(s, c, opt, filter) {
    const X = context(s, c, opt);
    const mine = s.armies.filter(a => a.c === c && !a.mv && (!filter || filter(a)));
    if (!mine.length) return null;
    const dopt = diceOptions(s);
    if (!dopt.singles.length) return null;
    const opts = dopt.singles.concat(dopt.free > mine.length || dopt.free >= 3 ? dopt.pairs : []);
    const maxB = Math.max.apply(null, opts.map(o => E.budgetOf(s, o)));
    let best = null;
    for (const a of mine) {
      const r = E.reach(s, a, maxB);
      const stay = posValue(X, a.n, a.t, a.id) + healValue(s, a);
      const pv = {};
      for (const n of r.moves) pv[n] = posValue(X, n, a.t, a.id);
      // 内政
      const ndh = nodes[a.n];
      if (ndh.kind === 'c' && s.owner[ndh.p] === c && !(opt && opt.noGovern)) {
        const hv = healValue(s, a);
        const gm = (opt && opt.govMul) || 1;
        for (const o of dopt.singles) {
          const v = s.dice[o[0]].v;
          for (const kind of (opt && opt.govKinds) || ['recruit', 'develop', 'fortify']) {
            const gv = governValue(X, a, kind, v);
            if (gv == null) continue;
            const sc = gv * gm - hv;
            if (!best || sc > best.score) best = { army: a.id, idxs: o, kind: 'govern', gov: kind, score: sc };
          }
        }
      }
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
          const n0 = a.n; a.n = at.from;
          const pv2 = E.preview(s, a, at.t, left);
          a.n = n0;
          const tn = nodes[at.t];
          const da = X.occ[at.t];
          let gain;
          if (tn.kind === 'c') {
            gain = X.val[tn.p] + (da ? da.t * 1.2 : 0);
            gain -= 0.5 * posDangerAfter(X, at.t, Math.max(1, a.t - 1));
          } else {
            gain = da.t * 1.7 + 3;
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
    const myDef = T + 3.5 + 1 + E.castleDef(s, nd.p, c);
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
    const T = R.newArmy + (E.trait(c) === 'bigarmy' ? 2 : 0);
    let best = optsN[0], bs = -Infinity;
    for (const n of optsN) {
      const v = posValue(X, n, T, -1) + (nodes[n].kind === 'c' ? X.threat[nodes[n].p] * X.val[nodes[n].p] * 0.5 : 0) + E.rand(s) * 0.5;
      if (v > bs) { bs = v; best = n; }
    }
    return best;
  }

  function maybeReroll(s, c, opt) {
    if (!E.canReroll(s)) return [];
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

  function apply(s, m) {
    if (m.kind === 'prepare') return E.prepareSiege(s, m.army, m.idxs[0], m.target);
    if (m.kind === 'govern') return E.govern(s, m.army, m.idxs[0], m.gov);
    return E.move(s, m.army, m.idxs, m.target);
  }

  // 次季に単骰1・5、または強行軍8で攻める機会を、賽の使いやすさで重み付けする。
  function siegeChance(s, a, target, extra) {
    let best = 0;
    for (const [budget, weight] of [[1, 0.55], [5, 0.80], [8, 0.85]]) {
      const { A, D, kishu } = E.preview(s, a, target, budget - 1);
      const diff = A.total + extra - D.total;
      const chance = kishu ? Number(diff > 0) : Math.min(6, Math.max(0, diff - 1)) / 6;
      best = Math.max(best, chance * weight);
    }
    return best;
  }

  function considerSiege(s, ordinary, filter) {
    let best = ordinary;
    const dice = [];
    for (let i = 0; i < s.dice.length; i++) {
      const d = s.dice[i];
      if (!d.u && !dice.some(j => s.dice[j].v === d.v)) dice.push(i);
    }
    for (const a of s.armies) {
      if (a.c !== s.cur || a.mv || a.t < R.siegeMinArmy || nodes[a.n].kind !== 'b' || (filter && !filter(a))) continue;
      for (const i of dice) for (const { target, before, after } of E.siegeOptions(s, a, i)) {
        const defender = E.armyAt(s, target);
        const value = 9 + 2.5 * s.kok[target] + (defender ? defender.t : 0) + (target === KYO ? 8 : 0);
        const now = siegeChance(s, a, target, 0);
        const next = siegeChance(s, a, target, after - before);
        const later = siegeChance(s, a, target, Math.min(R.siegeMax, after + R.siegeLowGain) - before);
        const risk = defender ? E.preview(s, defender, a.n, Math.max(0, 4 - E.nodeCost(s, defender.c, a.n))).p : 0;
        const score = value * (0.8 * (next - now) + 0.27 * (later - next)) - 0.7 - 3 * risk - 0.13 * s.dice[i].v;
        if (score >= 0.3 && (!best || score > best.score)) best = { kind: 'prepare', army: a.id, idxs: [i], target, score };
      }
    }
    return best;
  }

  // 1手選ぶ（なければ null）
  function nextMove(s, c, opt, filter) {
    const b = evaluate(s, c, opt, filter);
    return considerSiege(s, b && b.score >= 0.3 ? b : null, filter);
  }

  // ───── その他の大名（簡易CPU） ─────
  function simpleNext(s, c) {
    const D = staticDist(s, c);
    const mine = s.armies.filter(a => a.c === c && !a.mv);
    const free = s.dice.map((d, i) => (d.u ? -1 : i)).filter(i => i >= 0);
    if (!mine.length || !free.length) return null;
    const uniq = []; const seen = {};
    for (const i of free) if (!seen[s.dice[i].v]) { seen[s.dice[i].v] = 1; uniq.push(i); }
    const maxV = Math.max.apply(null, uniq.map(i => s.dice[i].v));
    const enemies = s.armies.filter(a => a.c !== c);
    const cn = E.provCount(s, c);
    let best = null;
    const consider = m => { if (!best || m.score > best.score) best = m; };
    for (const a of mine) {
      const r = E.reach(s, a, maxV);
      const here = nodes[a.n];
      const atHome = here.kind === 'c' && s.owner[here.p] === c;
      // この軍勢の近くの敵
      let nearE = 99, strongE = 0;
      for (const e of enemies) { const d = D[a.n][e.n]; if (d < nearE) nearE = d; if (d <= 4 && e.t >= a.t) strongE++; }
      const hv = E.healAmount(s, a) * (a.t <= 4 ? 1.6 : 0.8);
      for (const i of uniq) {
        const v = s.dice[i].v;
        // 攻め
        for (const at of r.attacks) {
          if (at.cost > v) continue;
          const n0 = a.n; a.n = at.from;
          const pv = E.preview(s, a, at.t, v - at.cost);
          a.n = n0;
          if (pv.p < 0.5) continue;
          const tn = nodes[at.t];
          const gain = tn.kind === 'c' ? 6 + 2.5 * s.kok[tn.p] + (tn.p === KYO ? 6 : 0) : (pv.D.army ? pv.D.army.t * 1.3 + 2 : 2);
          consider({ army: a.id, idxs: [i], target: at.t, kind: 'attack', score: pv.p * gain - (1 - pv.p) * 5 - 0.5 });
        }
        // 内政
        if (atHome) {
          const p = here.p;
          let danger = 0;
          for (const e of enemies) if (D[e.n][p] <= 4) danger++;
          const rc = E.governPreview(s, a, 'recruit', v);
          if (rc.ok) consider({ army: a.id, idxs: [i], kind: 'govern', gov: 'recruit', score: rc.gain * (a.t <= 5 ? 1.4 : 0.7) * (1 + 0.5 * danger) - hv - 0.2 * (v - 1) });
          const dv = E.governPreview(s, a, 'develop', v);
          if (dv.ok) consider({ army: a.id, idxs: [i], kind: 'govern', gov: 'develop', score: (dv.add / Math.max(1, dv.need)) * 2.5 * (danger ? 0.3 : 1) - hv });
          const fv = E.governPreview(s, a, 'fortify', v);
          if (fv.ok && danger) consider({ army: a.id, idxs: [i], kind: 'govern', gov: 'fortify', score: (fv.add / Math.max(1, fv.need)) * 2 * danger + Math.max(0, fv.gar1 - fv.gar) * 0.6 - hv });
        }
        // 寄せ：隣の他家の城の隣に陣取る／守るべき城へ戻る
        for (const n of r.moves) {
          if (r.dist[n] > v) continue;
          const nd = nodes[n];
          let sc = -Infinity;
          if (nd.kind === 'b') {
            for (const q of [nd.a, nd.b]) {
              if (s.owner[q] === c) continue;
              const occ = E.armyAt(s, q);
              const def = (occ ? occ.t : s.gar[q]) + E.castleDef(s, q, s.owner[q]) + 3.5;
              const pw = sig((a.t + 3 - def) / 1.6);
              if (pw < 0.45) continue;
              let dz = 0;
              for (const e of enemies) if (D[e.n][n] <= 3 && e.t >= a.t - 1) dz++;
              const val = 4 + 2 * s.kok[q] - dz * 3 - (cn <= 1 ? 2 : 0);
              if (val * pw > sc) sc = val * pw;
            }
          } else if (nd.kind === 'c' && s.owner[nd.p] === c && !atHome) {
            let th = 0;
            for (const e of enemies) if (adj[nd.p].includes(e.n)) th++;
            sc = th ? 3 + 2 * th : (strongE ? 1.5 : -1);
          }
          if (sc > -Infinity) consider({ army: a.id, idxs: [i], target: n, kind: 'move', score: sc - 1.2 - (atHome ? hv * 0.5 : 0) - 0.1 * v });
        }
      }
    }
    if (!best || best.score < 0.3) return null;
    return best;
  }

  function simpleSpawn(s, c) {
    const optsN = E.spawnOptions(s, c);
    if (!optsN.length) return null;
    const D = staticDist(s, c);
    let best = optsN[0], bs = -Infinity;
    for (const n of optsN) {
      let v = E.CAPITAL[n] ? 1 : 0;
      for (const a of s.armies) if (a.c !== c && D[a.n][n] <= 4) v += 2;
      v += E.rand(s) * 0.5;
      if (v > bs) { bs = v; best = n; }
    }
    return best;
  }

  // 主要大名の思考を使うか（小勢力でも大きくなれば本格的に考える）
  function usesFullAI(s, c) { return E.isMajor(c) || E.provCount(s, c) >= 6; }

  // CPUの手番を丸ごと進める（beginClanTurn 済みの状態から）
  function playTurn(s, opt) {
    const c = s.cur, ev = [];
    const full = usesFullAI(s, c);
    if (s.phase === 'place') ev.push.apply(ev, E.spawn(s, full ? chooseSpawn(s, c) : simpleSpawn(s, c)));
    if (s.phase === 'roll') ev.push.apply(ev, E.roll(s));
    if (full) ev.push.apply(ev, maybeReroll(s, c, opt));
    for (let guard = 0; guard < 14 && !s.over; guard++) {
      const m = full ? nextMove(s, c, opt) : considerSiege(s, simpleNext(s, c));
      if (!m) break;
      const e = apply(s, m);
      if (!e) break;
      ev.push.apply(ev, e);
    }
    if (!s.over) ev.push.apply(ev, E.endClanTurn(s));
    return ev;
  }

  // プレイヤーの軍勢を思考で動かす（委任・おまかせ）。filter で対象の軍勢を絞る
  function playFor(s, filter, maxMoves) {
    const c = s.cur, ev = [];
    for (let guard = 0; guard < (maxMoves || 14) && !s.over; guard++) {
      const m = nextMove(s, c, null, filter);
      if (!m) break;
      const e = apply(s, m);
      if (!e) break;
      ev.push.apply(ev, e);
    }
    return ev;
  }

  const AI = { staticDist, context, posValue, evaluate, nextMove, chooseSpawn, maybeReroll, playTurn, playFor, personality, simpleNext, usesFullAI, apply, governValue };
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
  else { root.SG = root.SG || {}; root.SG.AI = AI; }
})(typeof window !== 'undefined' ? window : globalThis);
