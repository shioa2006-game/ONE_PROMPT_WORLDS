/* 賽駆け — ルールエンジン（状態は素の JSON。ブラウザと node の両方で動く） */
(function (root) {
  'use strict';
  const DATA = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.SG.DATA;
  const R = DATA.RULES;

  // ───────── 盤面グラフ ─────────
  const P = DATA.PROV.length;
  const PI = {}; DATA.PROV.forEach((p, i) => { PI[p.id] = i; });
  const KYO = DATA.PROV.findIndex(p => p.kyo);
  const nodes = [];
  const adj = [];
  DATA.PROV.forEach((p, i) => { nodes.push({ i, kind: 'c', p: i }); adj.push([]); });
  const borderKey = {};
  DATA.EDGES.split(';').map(x => x.trim()).filter(Boolean).forEach(line => {
    const [a, b, t] = line.split(/\s+/);
    if (PI[a] === undefined || PI[b] === undefined) throw new Error('bad edge ' + line);
    const i = nodes.length;
    const key = [a, b].sort().join('-');
    const nm = DATA.PASS_NAMES[a + '-' + b] || DATA.PASS_NAMES[b + '-' + a] || null;
    nodes.push({ i, kind: 'b', a: PI[a], b: PI[b], t, key, name: nm });
    adj.push([PI[a], PI[b]]);
    adj[PI[a]].push(i); adj[PI[b]].push(i);
    borderKey[a + '-' + b] = i; borderKey[b + '-' + a] = i;
  });
  const N = nodes.length;
  const CLAN = {}; DATA.CLANS.forEach(c => { CLAN[c.id] = c; });
  // 本拠（各家の最初の国）の城は堅い
  const CAPITAL = new Array(P).fill(false);
  DATA.CLANS.forEach(c => { CAPITAL[PI[c.start[0]]] = true; });

  function nodeOf(ref) {
    if (PI[ref] !== undefined) return PI[ref];
    if (borderKey[ref] !== undefined) return borderKey[ref];
    throw new Error('unknown node ' + ref);
  }

  // ───────── 乱数 ─────────
  function rand(s) {
    let t = (s.rs = (s.rs + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const d6 = s => 1 + Math.floor(rand(s) * 6);
  function shuffle(s, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ───────── 新しいゲーム ─────────
  function newGame(player, seed, opt) {
    opt = opt || {};
    const s = {
      v: 1, seed: seed >>> 0, rs: (seed >>> 0) || 1, turn: 0,
      maxTurn: opt.maxTurn || R.maxTurn, winProv: opt.winProv || R.winProv,
      player: player || null,
      owner: DATA.PROV.map(() => null),
      gar: DATA.PROV.map(p => p.g),
      armies: [], aid: 1,
      clans: {},
      order: [], oi: 0, cur: null, phase: 'idle',
      dice: [], rer: false,
      coal: null, over: null, hist: [], log: [],
      lastCap: {},
    };
    for (const c of DATA.CLANS) {
      s.clans[c.id] = { alive: true, won: 0, lost: 0, cap: 0, kishu: 0, peak: 0, fell: null };
      for (const pid of c.start) { const p = PI[pid]; s.owner[p] = c.id; s.gar[p] = garMax(s, p, c.id); }
      for (const [ref, t] of c.armies) s.armies.push({ id: s.aid++, c: c.id, n: nodeOf(ref), t, mv: false });
    }
    // 4〜5回すこし回して乱数をなじませる
    for (let i = 0; i < 5; i++) rand(s);
    s.hist.push(counts(s));
    makeOrder(s);
    return s;
  }
  // 手番の順は対局ごとに一度だけ決める（どの家も、敵が陣取ってから攻めるまでに必ず1回動ける）
  function makeOrder(s) {
    if (!s.baseOrder) {
      const cpu = DATA.CLANS.map(c => c.id).filter(id => id !== s.player);
      shuffle(s, cpu);
      s.baseOrder = s.player ? [s.player].concat(cpu) : cpu;
    }
    s.order = s.baseOrder.filter(id => s.clans[id].alive);
    s.oi = 0; s.cur = s.order[0];
  }

  const clone = s => JSON.parse(JSON.stringify(s));

  // ───────── 参照系 ─────────
  const season = s => s.turn % 4;           // 0春 1夏 2秋 3冬
  const isWinter = s => season(s) === 3;
  const trait = c => (c && CLAN[c] ? CLAN[c].trait : null);
  function counts(s) { const o = {}; for (const c of DATA.CLANS) o[c.id] = 0; s.owner.forEach(c => { if (c) o[c]++; }); return o; }
  const provCount = (s, c) => s.owner.reduce((n, o) => n + (o === c ? 1 : 0), 0);
  const provsOf = (s, c) => s.owner.map((o, i) => (o === c ? i : -1)).filter(i => i >= 0);
  const armiesOf = (s, c) => s.armies.filter(a => a.c === c);
  function armyAt(s, n) { for (const a of s.armies) if (a.n === n) return a; return null; }
  const armyById = (s, id) => s.armies.find(a => a.id === id) || null;
  const slots = (s, c) => Math.min(R.slotMax, R.slotBase + Math.floor(provCount(s, c) / R.slotDiv));
  function diceCount(s, c) {
    const n = provCount(s, c);
    return Math.min(6, 3 + (n >= 8 ? 1 : 0) + (n >= 15 ? 1 : 0) + (s.owner[KYO] === c ? 1 : 0));
  }
  function garMax(s, p, c) {
    if (!c) return DATA.PROV[p].g;
    return Math.round(DATA.PROV[p].k * R.garMul) + R.garBonus + (trait(c) === 'meimon' ? 1 : 0);
  }
  function castleDef(s, p, c) {
    return DATA.PROV[p].d + R.defBonus + (CAPITAL[p] ? R.capitalDef : 0) + (c && trait(c) === 'fortress' ? 1 : 0) + (c && R.lastStand && provCount(s, c) === 1 ? R.lastStand : 0);
  }
  function nodeCost(s, c, n) {
    const nd = nodes[n];
    if (nd.kind === 'c' || nd.t === 'R') return 1;
    if (trait(c) === 'mountain' && nd.t === 'P') return 1;
    return (nd.t === 'P' ? R.passCost : R.seaCost) + (isWinter(s) ? R.winterExtra : 0);
  }
  const supVal = c => (trait(c) === 'arrows' ? 3 : R.support);

  // 敵の軍勢に隣接する（＝足が止まる）マス
  function zocSet(s, c) {
    const z = new Uint8Array(N);
    for (const a of s.armies) if (a.c !== c) for (const m of adj[a.n]) z[m] = 1;
    return z;
  }

  // ───────── 行軍範囲 ─────────
  // 戻り値: dist[], prev[], moves:[node], attacks:[{t, from, cost, left}]
  function reach(s, army, budget) {
    const c = army.c;
    const occ = new Array(N).fill(null);
    for (const a of s.armies) occ[a.n] = a;
    const zoc = zocSet(s, c);
    const dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1);
    const done = new Uint8Array(N);
    dist[army.n] = 0;
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0) break;
      done[u] = 1;
      if (u !== army.n && zoc[u]) continue;           // 敵の隣に入ったら止まる
      for (const v of adj[u]) {
        const o = occ[v];
        if (o && o.c !== c) continue;                  // 敵の軍勢（攻撃は別扱い）
        if (nodes[v].kind === 'c' && s.owner[nodes[v].p] !== c) continue;  // 他家・中立の城
        const nd = dist[u] + nodeCost(s, c, v);
        if (nd <= budget && nd < dist[v]) { dist[v] = nd; prev[v] = u; }
      }
    }
    const moves = [];
    for (let i = 0; i < N; i++) if (i !== army.n && dist[i] <= budget && !occ[i]) moves.push(i);
    const attacks = [];
    for (let t = 0; t < N; t++) {
      const o = occ[t];
      const isTarget = (o && o.c !== c) || (!o && nodes[t].kind === 'c' && s.owner[nodes[t].p] !== c);
      if (!isTarget) continue;
      let bestCost = Infinity, from = -1;
      // 城攻めは、手番のはじめに城の隣にいる軍勢だけ（R.siegeAdj）
      const siege = nodes[t].kind === 'c' && R.siegeAdj;
      for (const p of adj[t]) {
        if (siege && p !== army.n) continue;
        if (dist[p] === Infinity) continue;
        if (p !== army.n && occ[p]) continue;         // 味方がいるマスからは仕掛けられない
        const cost = dist[p] + nodeCost(s, c, t);
        if (cost <= budget && (cost < bestCost || (cost === bestCost && p === army.n))) { bestCost = cost; from = p; }
      }
      if (from >= 0) attacks.push({ t, from, cost: bestCost, left: budget - bestCost });
    }
    return { dist, prev, moves, attacks, budget };
  }
  function pathTo(r, start, n) {
    const out = [];
    for (let u = n; u !== -1; u = r.prev[u]) { out.push(u); if (u === start) break; }
    return out.reverse();
  }

  // ───────── 合戦の見積もり ─────────
  function attackParts(s, army, t, left) {
    const c = army.c, kishu = left === 0;
    const parts = [['兵', army.t]];
    if (kishu) parts.push(['奇襲', 0]); else parts.push(['勢い', Math.min(left, R.momentumCap)]);
    let sup = 0;
    for (const m of adj[t]) { const a = armyAt(s, m); if (a && a.c === c && a.id !== army.id) sup++; }
    if (sup) parts.push(['加勢', sup * supVal(c)]);
    if (trait(c) === 'charge') parts.push(['軍神', 1]);
    if (kishu && trait(c) === 'ambush') parts.push(['背後', 2]);
    return { parts, kishu, total: parts.reduce((x, p) => x + p[1], 0) };
  }
  function defenseParts(s, t, attClan) {
    const nd = nodes[t];
    const da = armyAt(s, t);
    const dc = da ? da.c : (nd.kind === 'c' ? s.owner[nd.p] : null);
    const parts = [];
    if (da) parts.push(['兵', da.t]);
    if (nd.kind === 'c') {
      if (!da || R.garWithArmy) parts.push(['守備', s.gar[nd.p]]);
      parts.push(['城', castleDef(s, nd.p, dc)]);
    } else if (nd.t === 'P') parts.push(['峠', R.passDefense]);
    if (dc) {
      let sup = 0;
      for (const m of adj[t]) { const a = armyAt(s, m); if (a && a.c === dc && (!da || a.id !== da.id)) sup++; }
      if (sup) parts.push(['加勢', sup * supVal(dc)]);
    }
    return { parts, clan: dc, army: da, total: parts.reduce((x, p) => x + p[1], 0) };
  }
  function preview(s, army, t, left) {
    const A = attackParts(s, army, t, left), D = defenseParts(s, t, army.c);
    let win = 0;
    if (A.kishu) win = A.total > D.total ? 1 : 0;
    else for (let d = 1; d <= 6; d++) if (A.total > D.total + d) win++;
    return { A, D, kishu: A.kishu, p: A.kishu ? win : win / 6 };
  }

  // ───────── 手番の進行 ─────────
  function beginClanTurn(s) {
    const c = s.cur, ev = [];
    s.dice = []; s.rer = false;
    for (const a of s.armies) if (a.c === c) a.mv = false;
    // 守備兵の回復
    const step = trait(c) === 'meimon' ? 2 : 1;
    for (const p of provsOf(s, c)) s.gar[p] = Math.min(garMax(s, p, c), s.gar[p] + step);
    s.phase = spawnOptions(s, c).length ? 'place' : 'roll';
    ev.push({ type: 'turn', clan: c });
    return ev;
  }
  function spawnOptions(s, c) {
    if (armiesOf(s, c).length >= slots(s, c)) return [];
    return provsOf(s, c).filter(p => !armyAt(s, p));
  }
  function spawn(s, node) {
    const c = s.cur;
    let ev = [];
    if (node != null && spawnOptions(s, c).includes(node)) {
      const a = { id: s.aid++, c, n: node, t: R.newArmy + (trait(c) === 'bigarmy' ? 2 : 0), mv: false };
      s.armies.push(a);
      ev.push({ type: 'spawn', army: Object.assign({}, a) });
    }
    s.phase = 'roll';
    return ev;
  }
  function roll(s) {
    const n = diceCount(s, s.cur);
    s.dice = [];
    for (let i = 0; i < n; i++) s.dice.push({ v: d6(s), u: false });
    s.phase = 'move';
    return [{ type: 'roll', dice: s.dice.map(d => d.v) }];
  }
  function canReroll(s) { return s.phase === 'move' && trait(s.cur) === 'reroll' && !s.rer; }
  function reroll(s, i) {
    if (!canReroll(s) || !s.dice[i] || s.dice[i].u) return [];
    const old = s.dice[i].v;
    s.dice[i].v = d6(s); s.rer = true;
    return [{ type: 'reroll', i, old, v: s.dice[i].v }];
  }

  function budgetOf(s, idxs) { return idxs.reduce((x, i) => x + s.dice[i].v, 0); }

  // 移動または攻撃
  function move(s, armyId, idxs, target) {
    const a = armyById(s, armyId);
    if (!a || a.c !== s.cur || a.mv || s.phase !== 'move') return null;
    if (!idxs.length || idxs.length > 2 || idxs.some(i => !s.dice[i] || s.dice[i].u)) return null;
    if (new Set(idxs).size !== idxs.length) return null;
    const budget = budgetOf(s, idxs);
    const r = reach(s, a, budget);
    const ev = [];
    const atk = r.attacks.find(x => x.t === target);
    if (atk) {
      const path = pathTo(r, a.n, atk.from);
      idxs.forEach(i => { s.dice[i].u = true; });
      a.mv = true;
      if (path.length > 1) ev.push({ type: 'move', army: a.id, clan: a.c, path });
      a.n = atk.from;
      battle(s, a, target, atk.from, atk.left, ev);
    } else if (r.moves.includes(target)) {
      const path = pathTo(r, a.n, target);
      idxs.forEach(i => { s.dice[i].u = true; });
      a.mv = true;
      ev.push({ type: 'move', army: a.id, clan: a.c, path });
      a.n = target;
    } else return null;
    ev.push({ type: 'dice', used: idxs.slice(), army: a.id });
    return ev;
  }

  function battle(s, a, t, from, left, ev) {
    const c = a.c;
    const pv = preview(s, a, t, left);
    const D = pv.D, da = D.army, dc = D.clan;
    const nd = nodes[t];
    const castle = nd.kind === 'c';
    const die = pv.kishu ? 0 : d6(s);
    const SA = pv.A.total, SD = D.total + die;
    const m = SA - SD;
    const b = {
      type: 'battle', node: t, from, castle, prov: castle ? nd.p : -1,
      att: { id: a.id, c, t0: a.t }, def: { id: da ? da.id : null, c: dc, t0: da ? da.t : 0, g0: castle ? s.gar[nd.p] : 0 },
      A: pv.A.parts, D: D.parts, SA, SDb: D.total, die, kishu: pv.kishu, p: pv.p, win: m > 0,
    };
    const cs = s.clans[c];
    if (pv.kishu) cs.kishu++;
    if (m > 0) {
      let lossD = 1 + Math.floor(m / 2) + (trait(c) === 'mamushi' ? 1 : 0);
      let lossA = (castle ? 1 : 0) + (m <= 2 ? 1 : 0);
      a.t = Math.max(1, a.t - lossA);
      b.lossA = lossA; b.lossD = lossD;
      cs.won++;
      if (dc) s.clans[dc].lost++;
      ev.push(b);
      if (da) {
        da.t -= lossD;
        if (da.t <= 0) { removeArmy(s, da); ev.push({ type: 'rout', army: da.id, clan: da.c, node: t }); }
        else {
          const r = retreatNode(s, da, t, from);
          if (r < 0) { removeArmy(s, da); ev.push({ type: 'rout', army: da.id, clan: da.c, node: t, trapped: true }); }
          else { da.n = r; ev.push({ type: 'retreat', army: da.id, clan: da.c, from: t, to: r, t: da.t }); }
        }
      }
      a.n = t;
      ev.push({ type: 'advance', army: a.id, from, to: t });
      if (castle) {
        const p = nd.p, old = s.owner[p];
        s.owner[p] = c; s.gar[p] = R.capGar;
        if (trait(c) === 'plunder') a.t = Math.min(R.armyMax, a.t + 1);
        cs.cap++;
        s.lastCap[p] = s.turn;
        ev.push({ type: 'capture', prov: p, from: old, to: c, army: a.id });
        if (old && provCount(s, old) === 0) eliminate(s, old, c, ev);
        const n = provCount(s, c);
        if (n > cs.peak) cs.peak = n;
        checkVictory(s, ev);
      }
    } else {
      let lossA = 1 + Math.floor(-m / 2) + (dc && trait(dc) === 'mamushi' ? 1 : 0);
      let lossD = (-m <= 2) ? 1 : 0;
      b.lossA = lossA; b.lossD = lossD;
      cs.lost++;
      if (dc) s.clans[dc].won++;
      ev.push(b);
      a.t -= lossA;
      if (lossD) {
        if (da) da.t = Math.max(1, da.t - lossD);
        else if (castle) s.gar[nd.p] = Math.max(1, s.gar[nd.p] - lossD);
      }
      if (a.t <= 0) { removeArmy(s, a); ev.push({ type: 'rout', army: a.id, clan: c, node: from }); }
    }
    b.att.t1 = a.t;
    b.def.t1 = da ? da.t : 0;
    b.def.g1 = castle ? s.gar[nd.p] : 0;
  }
  function retreatNode(s, da, t, from) {
    let best = -1, bs = -Infinity;
    for (const r of adj[t]) {
      if (r === from || armyAt(s, r)) continue;
      const nd = nodes[r];
      let sc;
      if (nd.kind === 'c') { if (s.owner[nd.p] !== da.c) continue; sc = 10; }
      else {
        sc = 0;
        for (const q of adj[r]) if (nodes[q].kind === 'c' && s.owner[nodes[q].p] === da.c) sc += 3;
      }
      sc += rand(s) * 0.5;
      if (sc > bs) { bs = sc; best = r; }
    }
    return best;
  }
  function removeArmy(s, a) { s.armies = s.armies.filter(x => x.id !== a.id); }
  function eliminate(s, c, by, ev) {
    s.clans[c].alive = false; s.clans[c].fell = { turn: s.turn, by };
    const gone = s.armies.filter(a => a.c === c).map(a => a.id);
    s.armies = s.armies.filter(a => a.c !== c);
    ev.push({ type: 'eliminated', clan: c, by, armies: gone });
    if (c === s.player && !s.over) {
      s.over = { kind: 'lose', reason: 'fall', turn: s.turn, by };
      s.phase = 'over';
      ev.push({ type: 'over', over: s.over });
    }
  }
  function checkVictory(s, ev) {
    if (s.over) return;
    for (const c of DATA.CLANS) {
      if (!s.clans[c.id].alive) continue;
      if (s.owner[KYO] === c.id && provCount(s, c.id) >= s.winProv) {
        s.over = { kind: c.id === s.player ? 'win' : 'lose', reason: 'tenka', clan: c.id, turn: s.turn };
        s.phase = 'over';
        ev.push({ type: 'over', over: s.over });
        return;
      }
    }
  }

  function healAmount(s, a) {
    const nd = nodes[a.n];
    let h = (nd.kind === 'c' && s.owner[nd.p] === a.c) ? R.healCastle + Math.floor(DATA.PROV[nd.p].k * R.healK) : R.healField;
    if (season(s) === 2) h += 1;
    if (trait(a.c) === 'rich') h += 1;
    return Math.max(0, Math.min(R.armyMax - a.t, h));
  }
  function endClanTurn(s) {
    const c = s.cur, list = [];
    for (const a of s.armies) {
      if (a.c !== c || a.mv) continue;
      const h = healAmount(s, a);
      if (h > 0) { a.t += h; list.push({ id: a.id, h }); }
    }
    for (const a of s.armies) if (a.c === c) a.mv = false;
    s.dice = [];
    s.phase = 'idle';
    return list.length ? [{ type: 'heal', list }] : [];
  }

  // 次の大名へ。季節の終わりならまとめて処理
  function advance(s) {
    const ev = [];
    if (s.over) return ev;
    for (;;) {
      s.oi++;
      if (s.oi >= s.order.length) { endRound(s, ev); if (s.over) return ev; s.oi = 0; }
      s.cur = s.order[s.oi];
      if (s.clans[s.cur].alive) break;
    }
    return ev;
  }
  function endRound(s, ev) {
    // 中立の城の守備兵がもどる
    for (let p = 0; p < P; p++) if (!s.owner[p]) s.gar[p] = Math.min(DATA.PROV[p].g, s.gar[p] + 1);
    s.turn++;
    const cn = counts(s);
    s.hist.push(cn);
    // 包囲網
    const live = Object.keys(cn).filter(c => s.clans[c].alive).sort((a, b) => cn[b] - cn[a]);
    const prev = s.coal;
    s.coal = null;
    if (live.length > 1 && cn[live[0]] >= R.coalitionMin && cn[live[0]] >= R.coalitionRatio * cn[live[1]]) s.coal = live[0];
    if (s.coal && s.coal !== prev) ev.push({ type: 'coalition', clan: s.coal });
    if (!s.coal && prev) ev.push({ type: 'coalition-end', clan: prev });
    if (s.turn >= s.maxTurn) {
      const rank = live.map(c => ({ c, n: cn[c] }));
      const pr = s.player ? rank.findIndex(r => r.c === s.player) : -1;
      s.over = { kind: pr === 0 ? 'top' : 'time', reason: 'time', rank, place: pr + 1, turn: s.turn };
      s.phase = 'over';
      ev.push({ type: 'over', over: s.over });
      return;
    }
    makeOrder(s);
    ev.push({ type: 'season', turn: s.turn });
  }

  // ───────── 表示用 ─────────
  const KANJI = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  function kanjiNum(n) {
    if (n <= 10) return KANJI[n];
    if (n < 20) return '十' + KANJI[n - 10];
    return KANJI[Math.floor(n / 10)] + '十' + (n % 10 ? KANJI[n % 10] : '');
  }
  const SEASONS = ['春', '夏', '秋', '冬'];
  function dateLabel(turn) {
    const y = 1560 + Math.floor(turn / 4);
    const ey = y - 1557;
    return { era: '永禄' + (ey === 1 ? '元' : kanjiNum(ey)) + '年', season: SEASONS[turn % 4], year: y };
  }

  const E = {
    DATA, R, nodes, adj, N, P, PI, KYO, CLAN, CAPITAL, nodeOf,
    rand, d6, newGame, clone, season, isWinter, trait, counts, provCount, provsOf, armiesOf, armyAt, armyById,
    slots, diceCount, garMax, castleDef, nodeCost, supVal, zocSet, reach, pathTo, attackParts, defenseParts, preview,
    beginClanTurn, spawnOptions, spawn, roll, canReroll, reroll, budgetOf, move, endClanTurn, advance,
    healAmount, dateLabel, kanjiNum, SEASONS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  else { root.SG = root.SG || {}; root.SG.E = E; }
})(typeof window !== 'undefined' ? window : globalThis);
