/*
 * ころころ、ひらけ列島 ― ルールの核（描画なし。node からも動く）
 *
 * 使いかた：
 *   const G = KR.E.create(seed);  KR.E.advance(G);
 *   G.need に「いま決めること」が入る（action / landing / buy / event / open / over）。
 *   KR.E.decide(G, 決めたこと) で すすむ。起きたことは G.ev に たまる（画面の演出用。読んだら空にする）。
 * 状態 G は ふつうの JSON なので、そのまま 保存・再開できる。
 */
(function (root) {
  'use strict';
  const KR = root.KR;
  const M = KR.MAP;
  const E = KR.E = {};
  const NP = KR.COMPANIES.length;

  E.START_CASH = 3000;
  E.STAMP_MONEY = 50;
  E.REGION_STAMP_BONUS = 500;
  E.TOLL = 200;
  E.SELL_RATE = 0.7;
  E.RATE = 0.05;        // 名物の 季節ごとの 収益（値段に対して）
  E.SHUN = 3;           // 旬の 季節は 3倍
  E.MONO = 2;           // 独占で 2倍

  // ------------------------------------------------------------ 乱数（G に 状態を もつ）
  E.rand = function (G) { const r = KR.rngNext(G.rs); G.rs = r[0]; return r[1]; };
  E.d6 = (G) => 1 + Math.floor(E.rand(G) * 6);
  const pickR = (G, arr) => arr[Math.floor(E.rand(G) * arr.length)];
  const r10 = (v) => Math.round(v / 10) * 10;
  const f = (G) => KR.inflation(G.turn);

  // ------------------------------------------------------------ 地図の ひらき具合
  E.active = function (G, ni) {
    const n = M.nodes[ni];
    return n.r >= 0 ? G.open[n.r] : (G.open[n.rr[0]] && G.open[n.rr[1]]);
  };
  const openKey = (G) => G.open.map((o) => (o ? 1 : 0)).join('');
  const distCache = new Map();
  // src から すべての マスへの 歩数（ひらいている ところだけ）
  E.dist = function (G, src, openOverride) {
    const key = src + '|' + (openOverride ? openOverride.join('') : openKey(G));
    let d = distCache.get(key);
    if (d) return d;
    const isOpen = openOverride ? (ni) => { const n = M.nodes[ni]; return n.r >= 0 ? !!openOverride[n.r] : (!!openOverride[n.rr[0]] && !!openOverride[n.rr[1]]); } : (ni) => E.active(G, ni);
    d = new Int16Array(M.nodes.length).fill(-1);
    d[src] = 0; const q = [src];
    for (let h = 0; h < q.length; h++) {
      const u = q[h];
      for (const v of M.adj[u]) if (d[v] < 0 && isOpen(v)) { d[v] = d[u] + 1; q.push(v); }
    }
    if (distCache.size > 4000) distCache.clear();
    distCache.set(key, d);
    return d;
  };
  E.destDist = function (G, node) {
    if (G.dest < 0) return 99;
    const d = E.dist(G, G.dest)[node];
    return d < 0 ? 99 : d;
  };

  // ------------------------------------------------------------ はじめる
  E.create = function (seed, opt) {
    opt = opt || {};
    const tokyo = M.stIdx.tokyo;
    const G = {
      v: 1, seed: seed >>> 0, rs: (seed >>> 0) || 1,
      turn: 0, cur: 0, phase: 'start',
      P: KR.COMPANIES.map((c, i) => ({
        i, key: c.key, cash: E.START_CASH, node: tokyo, prev: -1,
        cards: [{ id: 'kaisoku' }, { id: 'kakueki' }],
        used: false, diceN: 1, fixed: 0, slow: false,
        stamps: [tokyo],
        st: { dest: 0, exact: 0, opened: 0, tollIn: 0, tollOut: 0, bought: 0, income: 0, plus: 0, minus: 0, ev: 0, best: 0 },
      })),
      own: new Array(M.props.length).fill(-1),
      open: KR.REGIONS.map((r) => !!r.open),
      gateOwner: new Array(M.gates.length).fill(-1),
      dest: -1, destFrom: tokyo, destDist: 0, destHist: [], destCount: 0,
      evHist: [], need: null, over: false, ev: [], buySt: -1, opts: null, evInst: null, arrived: null,
    };
    if (opt.cash) G.P.forEach((p) => (p.cash = opt.cash));
    // さいしょの目的地は、東京から 5マス以上の 東海の駅
    const d0 = E.dist(G, tokyo);
    const cands = KR.STATIONS.map((s, i) => i).filter((i) => G.open[M.nodes[i].r] && d0[i] >= 5);
    setDest(G, cands, tokyo);
    G.ev.length = 0; // さいしょの目的地は 開始の演出で 見せる
    return G;
  };

  function setDest(G, cands, from) {
    const busy = new Set(G.P.map((p) => p.node));
    let list = cands.filter((i) => !busy.has(i) && i !== G.dest && G.destHist.slice(-3).indexOf(i) < 0);
    if (!list.length) list = cands.filter((i) => i !== G.dest);
    const st = pickR(G, list);
    G.dest = st; G.destFrom = from;
    const d = E.dist(G, from)[st];
    G.destDist = d < 0 ? 12 : d;
    G.destHist.push(st);
    G.ev.push({ t: 'dest', st, dist: G.destDist });
  }

  // ------------------------------------------------------------ 進める
  E.advance = function (G) {
    let guard = 0;
    while (!G.need && !G.over && guard++ < 200) {
      if (G.phase === 'start') startTurn(G);
      else if (G.phase === 'end') endTurn(G);
      else if (G.phase === 'buy') G.need = { k: 'buy', p: G.cur, st: G.buySt };
      else throw new Error('phase? ' + G.phase);
    }
    return G;
  };

  function startTurn(G) {
    const P = G.P[G.cur];
    P.used = false; P.diceN = 1; P.fixed = 0;
    G.ev.push({ t: 'turn', p: G.cur, turn: G.turn });
    G.phase = 'action';
    G.need = { k: 'action', p: G.cur };
  }

  function endTurn(G) {
    G.cur = (G.cur + 1) % NP;
    G.buySt = -1; G.opts = null; G.evInst = null;
    if (G.cur === 0) {
      if (G.turn % 6 === 5) settle(G);
      G.turn++;
      if (G.turn >= KR.TURNS) { finish(G); return; }
      if (G.turn % 6 === 0) G.ev.push({ t: 'season', s: KR.seasonOf(G.turn) });
    }
    G.phase = 'start';
  }

  // ------------------------------------------------------------ 決める
  E.decide = function (G, d) {
    const need = G.need;
    if (!need) throw new Error('need なし');
    const P = G.P[need.p];
    G.need = null;
    switch (need.k) {
      case 'action':
        if (d.type === 'card') {
          const ok = useCard(G, P, d);
          if (!ok) G.need = need;
          else if (G.phase === 'action') G.need = need;
        } else roll(G, P);
        break;
      case 'landing': {
        const opt = G.opts[d.i | 0] || G.opts[0];
        applyMove(G, P, opt);
        break;
      }
      case 'buy':
        if (d.type === 'buy') { buy(G, P, d.prop); G.need = need; }
        else if (d.type === 'takeover') { takeover(G, P, d.prop); G.need = need; }
        else { G.phase = 'end'; }
        break;
      case 'event':
        applyEvent(G, P, G.evInst, d.i | 0);
        G.phase = 'end';
        break;
      case 'open':
        openRegion(G, P, d.r);
        afterArrival(G, P);
        break;
      default:
        break;
    }
    return E.advance(G);
  };

  // ------------------------------------------------------------ きっぷ
  E.drawCardId = function (G) {
    const ids = Object.keys(KR.CARDS);
    let tot = 0; for (const k of ids) tot += KR.CARDS[k].w;
    let r = E.rand(G) * tot;
    for (const k of ids) { r -= KR.CARDS[k].w; if (r < 0) return k; }
    return ids[0];
  };
  function giveCard(G, P, id, why) {
    if (id === 'random') id = E.drawCardId(G);
    if (P.cards.length >= KR.HAND_MAX) {
      const m = r10(200 * f(G)); P.cash += m;
      G.ev.push({ t: 'cardsold', p: P.i, card: id, money: m, why });
      return id;
    }
    const c = { id }; if (KR.CARDS[id].uses) c.n = KR.CARDS[id].uses;
    P.cards.push(c);
    G.ev.push({ t: 'card', p: P.i, card: id, why });
    return id;
  }
  E.canUseCard = function (G, P, idx) {
    const c = P.cards[idx];
    if (!c || P.used || P.slow) return false;
    if (c.id === 'baishu') return false; // 駅の画面で つかう
    if (c.id === 'tobinori') return E.tobinoriTargets(G, P).length > 0;
    return true;
  };
  E.tobinoriTargets = function (G, P) {
    if (G.dest < 0) return [];
    const r = M.nodes[G.dest].r;
    return KR.STATIONS.map((s, i) => i).filter((i) => M.nodes[i].r === r && i !== G.dest && i !== P.node && G.open[r]);
  };
  function consume(P, idx) {
    const c = P.cards[idx];
    if (c.n && c.n > 1) c.n--; else P.cards.splice(idx, 1);
  }
  function useCard(G, P, d) {
    const idx = d.idx | 0;
    if (!E.canUseCard(G, P, idx)) return false;
    const id = P.cards[idx].id;
    const e = { t: 'use', p: P.i, card: id };
    if (id === 'kaisoku' || id === 'kaisuu') P.diceN = 2;
    else if (id === 'tokkyu') P.diceN = 3;
    else if (id === 'kakueki') { P.fixed = KR.clamp(d.value | 0, 1, 6); e.value = P.fixed; }
    else if (id === 'daruma') { const m = r10(500 * f(G)); P.cash += m; e.money = m; }
    else if (id === 'fumikiri') {
      const t = d.target | 0;
      if (t === P.i || !G.P[t]) return false;
      G.P[t].slow = true; e.target = t;
    } else if (id === 'tobinori') {
      const ts = E.tobinoriTargets(G, P);
      const to = pickR(G, ts);
      e.from = P.node; e.to = to;
      consume(P, idx); P.used = true;
      G.ev.push(e);
      P.node = to; P.prev = -1;
      const marks = [];
      stampAt(G, P, to, marks, 0);
      G.ev.push({ t: 'warp', p: P.i, from: e.from, to, marks });
      G.buySt = to; G.phase = 'buy';
      return true;
    }
    consume(P, idx); P.used = true;
    G.ev.push(e);
    return true;
  }

  // ------------------------------------------------------------ サイコロと 行き先
  function roll(G, P) {
    let dice, mode = 'normal';
    if (P.fixed) { dice = [P.fixed]; mode = 'kakueki'; }
    else if (P.slow) { dice = [1 + Math.floor(E.rand(G) * 3)]; mode = 'slow'; }
    else { dice = []; for (let i = 0; i < P.diceN; i++) dice.push(E.d6(G)); if (P.diceN > 1) mode = 'multi'; }
    const total = dice.reduce((a, b) => a + b, 0);
    P.slow = false; P.fixed = 0; P.diceN = 1;
    G.ev.push({ t: 'roll', p: P.i, dice, total, mode });
    G.opts = E.reach(G, P.i, total);
    G.phase = 'landing';
    G.need = { k: 'landing', p: P.i, total };
  }

  const better = (a, b) => (a.tolls !== b.tolls ? a.tolls < b.tolls : a.stamps > b.stamps);

  // ちょうど steps 歩で 行けるマス。
  //  ・おなじマスは なるべく 通らない（行き止まりで 進めないときだけ、来た道を もどれる）
  //  ・目的地を 通るときは そこで止まる
  //  ・「ぴったり」は 出目が 目的地までの いちばん近い マス数と 同じで、そのとおりに 着いたとき
  E.reach = function (G, pi, steps) {
    const P = G.P[pi];
    const stamped = new Set(P.stamps);
    const shortest = E.destDist(G, P.node);
    const ends = new Map();
    const path = [];
    const seen = new Uint8Array(M.nodes.length);
    seen[P.node] = 1;
    const consider = (node, rec) => {
      const o = ends.get(node);
      if (!o || (rec.exact && !o.exact) || (rec.exact === o.exact && better(rec, o))) ends.set(node, rec);
    };
    let budget = 60000;
    const dfs = (u, prev, k, tolls, stamps) => {
      if (--budget < 0) return;
      const act = M.adj[u].filter((v) => E.active(G, v));
      let nx = act.filter((v) => !seen[v]);
      if (!nx.length) nx = act.filter((v) => v === prev); // 行き止まり：もどる
      if (!nx.length) nx = act;
      for (const v of nx) {
        const n = M.nodes[v];
        const go = n.t === 'gate' ? G.gateOwner[n.gate] : -1;
        const t2 = tolls + (go >= 0 && go !== pi ? 1 : 0);
        const s2 = stamps + (n.t === 'st' && !stamped.has(v) && !seen[v] ? 1 : 0);
        path.push(v);
        const was = seen[v]; seen[v] = 1;
        if (v === G.dest) {
          consider(v, { path: path.slice(), tolls: t2, stamps: s2, dest: true, exact: k + 1 === steps && steps === shortest });
        } else if (k + 1 === steps) {
          consider(v, { path: path.slice(), tolls: t2, stamps: s2 });
        } else dfs(v, u, k + 1, t2, s2);
        seen[v] = was;
        path.pop();
      }
    };
    if (steps > 0) dfs(P.node, P.prev, 0, 0, 0);
    const dd = G.dest >= 0 ? E.dist(G, G.dest) : null;
    const out = [];
    for (const [node, s] of ends) {
      out.push({ node, path: s.path, dest: !!s.dest, exact: !!s.exact, tolls: s.tolls, stamps: s.stamps, dd: dd ? dd[node] : 0 });
    }
    out.sort((a, b) => (b.dest - a.dest) || (a.dd - b.dd) || (a.node - b.node));
    if (!out.length) out.push({ node: P.node, path: [], dest: false, exact: false, tolls: 0, stamps: 0, dd: dd ? dd[P.node] : 0 });
    return out;
  };

  function stampAt(G, P, v, marks, k) {
    if (M.nodes[v].t !== 'st' || P.stamps.indexOf(v) >= 0) return;
    P.stamps.push(v);
    const m = r10(E.STAMP_MONEY * f(G));
    P.cash += m;
    marks.push({ k, kind: 'stamp', st: v, money: m });
    const r = M.nodes[v].r;
    const all = KR.STATIONS.every((s, i) => M.nodes[i].r !== r || P.stamps.indexOf(i) >= 0);
    if (all) {
      const b = r10(E.REGION_STAMP_BONUS * f(G));
      P.cash += b;
      marks.push({ k, kind: 'region', r, money: b });
    }
  }

  function applyMove(G, P, opt) {
    const marks = [];
    const from = P.node;
    let prev = P.prev, cur = P.node;
    opt.path.forEach((v, k) => {
      const n = M.nodes[v];
      if (n.t === 'gate') {
        const o = G.gateOwner[n.gate];
        if (o >= 0 && o !== P.i) {
          const amt = r10(E.TOLL * f(G));
          P.cash -= amt; G.P[o].cash += amt;
          P.st.tollOut += amt; G.P[o].st.tollIn += amt;
          marks.push({ k, kind: 'toll', gate: n.gate, to: o, money: amt });
        }
      }
      stampAt(G, P, v, marks, k);
      prev = cur; cur = v;
    });
    P.node = cur; P.prev = opt.path.length ? prev : P.prev;
    G.ev.push({ t: 'move', p: P.i, from, path: opt.path.slice(), marks, dest: opt.dest, exact: opt.exact });
    cover(G, P);
    G.opts = null;
    if (opt.dest) arrive(G, P, opt.exact);
    else land(G, P, cur);
  }

  // ------------------------------------------------------------ とまったマス
  function land(G, P, v) {
    const n = M.nodes[v];
    const F = f(G);
    if (n.t === 'st') { G.buySt = v; G.phase = 'buy'; return; }
    if (n.t === 'plus' || n.t === 'gate') {
      const m = r10((80 + Math.floor(E.rand(G) * 17) * 10) * F);
      P.cash += m; P.st.plus += m;
      G.ev.push({ t: 'land', p: P.i, node: v, kind: n.t, money: m });
    } else if (n.t === 'minus') {
      const m = r10((50 + Math.floor(E.rand(G) * 14) * 10) * F);
      P.cash -= m; P.st.minus += m;
      G.ev.push({ t: 'land', p: P.i, node: v, kind: 'minus', money: -m });
      cover(G, P);
    } else if (n.t === 'card') {
      G.ev.push({ t: 'land', p: P.i, node: v, kind: 'card' });
      giveCard(G, P, 'random', 'square');
    } else if (n.t === 'event') {
      G.ev.push({ t: 'land', p: P.i, node: v, kind: 'event' });
      G.evInst = drawEvent(G, P, v);
      G.phase = 'event';
      G.need = { k: 'event', p: P.i };
      return;
    }
    G.phase = 'end';
  }

  // ------------------------------------------------------------ 目的地
  function arrive(G, P, exact) {
    const st = G.dest;
    const prize = r10((1000 + 120 * G.destDist) * f(G) * (exact ? 1.5 : 1));
    P.cash += prize; P.st.dest++; if (exact) P.st.exact++;
    P.st.best = Math.max(P.st.best, prize);
    G.destCount++;
    G.ev.push({ t: 'arrive', p: P.i, st, prize, exact, dist: G.destDist });
    G.arrived = st;
    const opts = E.openable(G);
    if (opts.length) {
      G.phase = 'open';
      G.need = { k: 'open', p: P.i, options: opts };
    } else afterArrival(G, P);
  }
  // ひらける地方（ひらいている地方と 関所で つながっている）
  E.openable = function (G) {
    const out = [];
    KR.REGIONS.forEach((r, i) => {
      if (G.open[i]) return;
      if (M.gates.some((g) => (g.ra === i && G.open[g.rb]) || (g.rb === i && G.open[g.ra]))) out.push(i);
    });
    return out;
  };
  function openRegion(G, P, r) {
    const opts = E.openable(G);
    if (opts.indexOf(r) < 0) r = opts[0];
    G.open[r] = true;
    const gates = [];
    M.gates.forEach((g) => {
      if ((g.ra === r && G.open[g.rb]) || (g.rb === r && G.open[g.ra])) {
        if (G.gateOwner[g.i] < 0) { G.gateOwner[g.i] = P.i; gates.push(g.i); }
      }
    });
    P.st.opened++;
    G.ev.push({ t: 'open', p: P.i, r, gates });
    G.openedR = r;
  }
  function afterArrival(G, P) {
    const from = G.arrived;
    if (G.openedR != null) {
      const r = G.openedR; G.openedR = null;
      const cands = KR.STATIONS.map((s, i) => i).filter((i) => M.nodes[i].r === r);
      setDest(G, cands, from);
    } else {
      const d = E.dist(G, from);
      let cands = KR.STATIONS.map((s, i) => i).filter((i) => E.active(G, i) && d[i] >= 14);
      if (cands.length < 3) cands = KR.STATIONS.map((s, i) => i).filter((i) => E.active(G, i) && d[i] >= 8);
      setDest(G, cands, from);
    }
    // おいかぜ：新しい目的地から いちばん遠い会社に きっぷ
    let far = -1, fd = -1;
    G.P.forEach((q) => {
      if (q.i === P.i) return;
      const dd = E.destDist(G, q.node);
      if (dd > fd) { fd = dd; far = q.i; }
    });
    if (far >= 0 && fd >= 12) giveCard(G, G.P[far], fd >= 22 ? 'tokkyu' : 'kaisoku', 'oikaze');
    G.buySt = from; G.phase = 'buy';
  }

  // ------------------------------------------------------------ 名物を 買う
  E.monoOwner = function (G, st) {
    const pis = KR.STATIONS[st].pi;
    const o = G.own[pis[0]];
    if (o < 0) return -1;
    for (const pi of pis) if (G.own[pi] !== o) return -1;
    return o;
  };
  function buy(G, P, prop) {
    const pr = M.props[prop];
    if (!pr || pr.st !== G.buySt || G.own[prop] >= 0 || P.cash < pr.price) return false;
    P.cash -= pr.price; G.own[prop] = P.i; P.st.bought++;
    const mono = E.monoOwner(G, pr.st) === P.i;
    G.ev.push({ t: 'buy', p: P.i, prop, price: pr.price, mono });
    return true;
  }
  E.takeoverPrice = (pr) => r10(pr.price * 1.5);
  function takeover(G, P, prop) {
    const pr = M.props[prop];
    const ci = P.cards.findIndex((c) => c.id === 'baishu');
    if (!pr || pr.st !== G.buySt || ci < 0) return false;
    const o = G.own[prop];
    if (o < 0 || o === P.i) return false;
    const price = E.takeoverPrice(pr);
    if (P.cash < price) return false;
    P.cash -= price; G.P[o].cash += price;
    G.own[prop] = P.i;
    consume(P, ci);
    const mono = E.monoOwner(G, pr.st) === P.i;
    G.ev.push({ t: 'takeover', p: P.i, from: o, prop, price, mono });
    return true;
  }
  // お金が マイナスに なったら、名物を 手放して うめる（独占を こわさないものから、安い順）
  function cover(G, P) {
    while (P.cash < 0) {
      const mine = [];
      G.own.forEach((o, i) => { if (o === P.i) mine.push(i); });
      if (!mine.length) return;
      mine.sort((a, b) => {
        const ma = E.monoOwner(G, M.props[a].st) === P.i ? 1 : 0, mb = E.monoOwner(G, M.props[b].st) === P.i ? 1 : 0;
        return (ma - mb) || (M.props[a].price - M.props[b].price);
      });
      const pr = M.props[mine[0]];
      const got = r10(pr.price * E.SELL_RATE);
      G.own[pr.i] = -1; P.cash += got;
      G.ev.push({ t: 'sell', p: P.i, prop: pr.i, money: got });
    }
  }
  E.assets = function (G, pi) {
    let a = G.P[pi].cash;
    G.own.forEach((o, i) => { if (o === pi) a += M.props[i].price; });
    return a;
  };
  E.propsOf = function (G, pi) { const out = []; G.own.forEach((o, i) => { if (o === pi) out.push(i); }); return out; };

  // ------------------------------------------------------------ できごと
  function regionOfNode(v) { const n = M.nodes[v]; return n.r >= 0 ? n.r : n.rr[0]; }
  function drawEvent(G, P, v) {
    const s = KR.seasonOf(G.turn);
    const rid = KR.REGIONS[regionOfNode(v)].id;
    const recent = G.evHist.slice(-8);
    let list = KR.EVENTS.filter((e) => (!e.season || e.season.indexOf(s) >= 0) && (!e.region || e.region.indexOf(rid) >= 0));
    let fresh = list.filter((e) => recent.indexOf(e.id) < 0);
    if (!fresh.length) fresh = list;
    // 地方や季節の できごとを すこし 出やすく
    const w = fresh.map((e) => (e.region ? 3 : e.season ? 1.6 : 1));
    let tot = w.reduce((a, b) => a + b, 0), r = E.rand(G) * tot, pick = fresh[0];
    for (let i = 0; i < fresh.length; i++) { r -= w[i]; if (r < 0) { pick = fresh[i]; break; } }
    G.evHist.push(pick.id);
    // 相手が いる できごとは、いちばん近い ライバル
    let rival = -1, rd = 1e9;
    const d = E.dist(G, P.node);
    G.P.forEach((q) => { if (q.i !== P.i && d[q.node] >= 0 && d[q.node] < rd) { rd = d[q.node]; rival = q.i; } });
    if (rival < 0) rival = (P.i + 1) % NP;
    P.st.ev++;
    return { id: pick.id, rival };
  }
  E.eventDef = (id) => KR.EVENTS.find((e) => e.id === id);
  function applyEvent(G, P, inst, ci) {
    const def = E.eventDef(inst.id);
    const ch = def.ch[KR.clamp(ci, 0, def.ch.length - 1)];
    const res = { money: 0, cards: [], say: '' };
    applyEff(G, P, ch.eff, inst, res);
    G.ev.push({ t: 'evres', p: P.i, id: inst.id, choice: ci, res, rival: inst.rival });
    cover(G, P); cover(G, G.P[inst.rival]);
  }
  function applyEff(G, P, eff, inst, res) {
    const F = f(G);
    if (eff.say) res.say = eff.say;
    if (eff.cost) { const m = r10(eff.cost * F); P.cash -= m; res.money -= m; }
    if (eff.money) { const m = r10(eff.money * F); P.cash += m; res.money += m; }
    if (eff.card) { const id = giveCard(G, P, eff.card, 'event'); res.cards.push(id); }
    if (eff.perProp) { const n = E.propsOf(G, P.i).length; const m = r10(eff.perProp * n * F); P.cash += m; res.money += m; res.count = n; }
    if (eff.fromRival) {
      const R = G.P[inst.rival];
      const m = Math.max(0, Math.min(r10(eff.fromRival * F), Math.max(0, R.cash)));
      R.cash -= m; P.cash += m; res.money += m; res.rivalMoney = -m;
    }
    if (eff.duel) {
      const R = G.P[inst.rival];
      const a = E.d6(G), b = E.d6(G);
      const m = r10(eff.duel * F);
      res.duel = { a, b, amt: 0 };
      if (a > b) { const t = Math.min(m, Math.max(0, R.cash)); R.cash -= t; P.cash += t; res.money += t; res.duel.amt = t; res.duel.win = 1; res.say = 'サイコロ勝負に 勝った！'; }
      else if (b > a) { P.cash -= m; R.cash += m; res.money -= m; res.duel.amt = m; res.duel.win = -1; res.say = 'サイコロ勝負に 負けた…'; }
      else { res.duel.win = 0; res.say = 'あいこ。握手して わかれた。'; }
    }
    if (eff.dice) {
      const v = E.d6(G);
      res.dice = v;
      const row = eff.dice.find((r) => v >= r[0] && v <= r[1]);
      if (row) applyEff(G, P, row[2], inst, res);
    }
  }

  // ------------------------------------------------------------ 決算（季節の おわり）
  E.incomeOf = function (G, pi, season) {
    let total = 0; const items = [];
    G.own.forEach((o, i) => {
      if (o !== pi) return;
      const pr = M.props[i];
      const shun = pr.season === season;
      const mono = E.monoOwner(G, pr.st) === pi;
      const v = pr.price * E.RATE * (shun ? E.SHUN : 1) * (mono ? E.MONO : 1);
      total += v;
      items.push({ prop: i, v: Math.round(v), shun, mono });
    });
    items.sort((a, b) => b.v - a.v);
    return { total: Math.round(total), items };
  };
  function settle(G) {
    const s = KR.seasonOf(G.turn);
    const rows = G.P.map((P) => {
      const inc = E.incomeOf(G, P.i, s);
      P.cash += inc.total; P.st.income += inc.total;
      return { p: P.i, income: inc.total, items: inc.items.slice(0, 4), count: inc.items.length };
    });
    G.ev.push({ t: 'settle', s, rows, final: G.turn === KR.TURNS - 1 });
  }

  function finish(G) {
    G.over = true; G.phase = 'over';
    const rank = G.P.map((P) => ({ p: P.i, assets: E.assets(G, P.i) })).sort((a, b) => b.assets - a.assets);
    G.rank = rank;
    G.ev.push({ t: 'over', rank });
    G.need = { k: 'over' };
  }

  // 見やすさのための ヘルパー
  E.monoCount = function (G, pi) { let n = 0; KR.STATIONS.forEach((s, i) => { if (E.monoOwner(G, i) === pi) n++; }); return n; };
  E.nextSettleSeason = (G) => KR.seasonOf(G.turn);
})(typeof window !== 'undefined' ? window : globalThis);
