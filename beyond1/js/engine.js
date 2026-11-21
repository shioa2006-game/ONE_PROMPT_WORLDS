/* 戦国すごろく全国版 — ルールエンジン（状態は素の JSON。ブラウザと node の両方で動く） */
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
  const padj = DATA.PROV.map(() => []);   // 国どうしの隣接（海路も含む）
  DATA.EDGES.split(';').map(x => x.trim()).filter(Boolean).forEach(line => {
    const [a, b, t] = line.split(/\s+/);
    if (PI[a] === undefined || PI[b] === undefined) throw new Error('bad edge ' + line);
    const i = nodes.length;
    const key = [a, b].sort().join('-');
    const nm = DATA.PASS_NAMES[a + '-' + b] || DATA.PASS_NAMES[b + '-' + a] || null;
    const snowy = !!(DATA.PROV[PI[a]].snow || DATA.PROV[PI[b]].snow);
    nodes.push({ i, kind: 'b', a: PI[a], b: PI[b], t, key, name: nm, snowy });
    adj.push([PI[a], PI[b]]);
    adj[PI[a]].push(i); adj[PI[b]].push(i);
    padj[PI[a]].push(PI[b]); padj[PI[b]].push(PI[a]);
    borderKey[a + '-' + b] = i; borderKey[b + '-' + a] = i;
  });
  const N = nodes.length;
  const CLAN = {}; DATA.CLANS.forEach(c => { CLAN[c.id] = c; });
  const CLAN_IDS = DATA.CLANS.map(c => c.id);
  // 本拠（各家の最初の国）の城は堅い
  const CAPITAL = new Array(P).fill(false);
  DATA.CLANS.forEach(c => { CAPITAL[PI[c.start[0]]] = true; });
  const BASEK = DATA.PROV.map(p => p.k);

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
      v: 2, seed: seed >>> 0, rs: (seed >>> 0) || 1, turn: 0,
      maxTurn: opt.maxTurn || R.maxTurn, ext: 0,
      player: player || null,
      owner: DATA.PROV.map(() => null),
      kok: BASEK.slice(), kp: DATA.PROV.map(() => 0),
      fort: DATA.PROV.map(() => 0), fp: DATA.PROV.map(() => 0),
      gar: DATA.PROV.map(() => 1),
      armies: [], aid: 1,
      clans: {},
      order: [], oi: 0, cur: null, phase: 'idle',
      dice: [], rer: false,
      coal: null, over: null, hist: [], offers: [], decl: {},
      lastCap: {},
    };
    for (const c of DATA.CLANS) {
      s.clans[c.id] = { alive: true, won: 0, lost: 0, cap: 0, kishu: 0, peak: 0, fell: null, sub: 0, dom: { recruit: 0, develop: 0, fortify: 0 } };
      for (const pid of c.start) s.owner[PI[pid]] = c.id;
    }
    for (let p = 0; p < P; p++) s.gar[p] = garMax(s, p, s.owner[p]);
    for (const c of DATA.CLANS) {
      const list = c.armies || c.start.slice(0, 2).map((pid, i) => [pid, i === 0 ? 5 : 4]);
      for (const [ref, t] of list) s.armies.push({ id: s.aid++, c: c.id, n: nodeOf(ref), t, mv: false });
      s.clans[c.id].peak = provCount(s, c.id);
    }
    for (let i = 0; i < 5; i++) rand(s);
    s.hist.push(histRow(s));
    makeOrder(s);
    return s;
  }
  // 手番の順は対局ごとに一度だけ決める（プレイヤーが先頭）
  function makeOrder(s) {
    if (!s.baseOrder) {
      const cpu = CLAN_IDS.filter(id => id !== s.player);
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
  const isAutumn = s => season(s) === 2;
  const trait = c => (c && CLAN[c] ? CLAN[c].trait : null);
  const isMajor = c => !!(CLAN[c] && CLAN[c].major);
  function counts(s) { const o = {}; for (const id of CLAN_IDS) o[id] = 0; s.owner.forEach(c => { if (c) o[c]++; }); return o; }
  function kokAll(s) { const o = {}; for (const id of CLAN_IDS) o[id] = 0; s.owner.forEach((c, p) => { if (c) o[c] += s.kok[p]; }); return o; }
  const provCount = (s, c) => s.owner.reduce((n, o) => n + (o === c ? 1 : 0), 0);
  const kokOf = (s, c) => s.owner.reduce((n, o, p) => n + (o === c ? s.kok[p] : 0), 0);
  const provsOf = (s, c) => s.owner.map((o, i) => (o === c ? i : -1)).filter(i => i >= 0);
  const armiesOf = (s, c) => s.armies.filter(a => a.c === c);
  function armyAt(s, n) { for (const a of s.armies) if (a.n === n) return a; return null; }
  const armyById = (s, id) => s.armies.find(a => a.id === id) || null;
  function histRow(s) { const k = kokAll(s), o = {}; for (const c in k) if (k[c] > 0) o[c] = k[c]; return o; }
  const slots = (s, c) => Math.min(R.slotMax, R.slotBase + Math.floor(kokOf(s, c) / R.slotDiv));
  function diceCount(s, c) {
    return Math.min(R.diceMax, R.diceBase + Math.floor(kokOf(s, c) / R.diceDiv)) + (s.owner[KYO] === c ? 1 : 0);
  }
  // 守備兵の上限：石高と普請（築城）で増える
  function garMax(s, p, c) {
    return R.garBase + Math.floor(s.kok[p] / R.garDiv) + (s.fort ? s.fort[p] : 0) + (c && trait(c) === 'meimon' ? 1 : 0);
  }
  // 城の守り。本拠と最後の一城の補正は主要大名だけ（小大名が皆、難攻不落になるのを防ぐ）
  function castleDef(s, p, c) {
    const maj = c && isMajor(c);
    return DATA.PROV[p].d + (CAPITAL[p] && maj ? R.capitalDef : 0) + (c && trait(c) === 'fortress' ? 1 : 0) + (maj && R.lastStand && provCount(s, c) === 1 ? R.lastStand : 0);
  }
  function nodeCost(s, c, n) {
    const nd = nodes[n];
    if (nd.kind === 'c') return 1;
    const tr = trait(c);
    const win = isWinter(s) && tr !== 'snow';
    if (nd.t === 'R') return 1 + (win && nd.snowy ? R.snowExtra : 0);
    if (nd.t === 'P') return tr === 'mountain' ? 1 : R.passCost + (win ? R.winterExtra : 0);
    return R.seaCost + (win ? R.winterExtra : 0);
  }
  const supVal = c => (trait(c) === 'arrows' ? 3 : R.support);

  // 敵の軍勢に隣接する（＝足が止まる）マス
  function zocSet(s, c) {
    const z = new Uint8Array(N);
    for (const a of s.armies) if (a.c !== c) for (const m of adj[a.n]) z[m] = 1;
    return z;
  }

  // ───────── 行軍範囲（歩数は小さな整数なのでバケツ式の最短路） ─────────
  // 戻り値: dist[], prev[], moves:[node], attacks:[{t, from, cost, left}]
  function reach(s, army, budget) {
    const c = army.c;
    const occ = new Array(N).fill(null);
    for (const a of s.armies) occ[a.n] = a;
    const zoc = zocSet(s, c);
    const dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1);
    const done = new Uint8Array(N);
    const bk = []; for (let i = 0; i <= budget; i++) bk.push([]);
    dist[army.n] = 0; bk[0].push(army.n);
    for (let d = 0; d <= budget; d++) {
      const list = bk[d];
      for (let k = 0; k < list.length; k++) {
        const u = list[k];
        if (done[u] || dist[u] !== d) continue;
        done[u] = 1;
        if (u !== army.n && zoc[u]) continue;           // 敵の隣に入ったら止まる
        for (const v of adj[u]) {
          const o = occ[v];
          if (o && o.c !== c) continue;                  // 敵の軍勢（攻撃は別扱い）
          if (nodes[v].kind === 'c' && s.owner[nodes[v].p] !== c) continue;  // 他家の城
          const nd = d + nodeCost(s, c, v);
          if (nd <= budget && nd < dist[v]) { dist[v] = nd; prev[v] = u; bk[nd].push(v); }
        }
      }
    }
    const moves = [];
    for (let i = 0; i < N; i++) if (i !== army.n && dist[i] <= budget && !occ[i]) moves.push(i);
    const attacks = [];
    const tset = new Set();
    for (const a of s.armies) if (a.c !== c) tset.add(a.n);
    // 城攻めは、手番のはじめに城の隣にいる軍勢だけ（R.siegeAdj）
    for (const m of adj[army.n]) if (nodes[m].kind === 'c' && s.owner[nodes[m].p] !== c && !occ[m]) tset.add(m);
    for (const t of tset) {
      const o = occ[t];
      const isTarget = (o && o.c !== c) || (!o && nodes[t].kind === 'c' && s.owner[nodes[t].p] !== c);
      if (!isTarget) continue;
      let bestCost = Infinity, from = -1;
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

  // 準備は軍勢・陣地・目標・城主に結び付く。従来の記録には siegePlan がない。
  function siegePoints(s, army, target) {
    const plan = army && army.siegePlan;
    return plan && plan.target === target && plan.node === army.n && plan.clan === army.c &&
      plan.owner === s.owner[target] && plan.owner !== army.c ? plan.points : 0;
  }
  function clearInvalidPlans(s) {
    for (const a of s.armies) {
      if (a.siegePlan && !siegePoints(s, a, a.siegePlan.target)) delete a.siegePlan;
    }
  }
  function siegeOptions(s, a, i) {
    const die = s.dice[i];
    if (s.over || s.phase !== 'move' || !die || die.u || !a || a.mv ||
        a.c !== s.cur || a.t < R.siegeMinArmy || nodes[a.n].kind !== 'b') return [];
    const gain = die.v >= R.siegeHighDie ? R.siegeHighGain : R.siegeLowGain;
    const options = [];
    for (const target of adj[a.n]) {
      if (!s.owner[target] || s.owner[target] === a.c) continue;
      const before = siegePoints(s, a, target);
      if (before < R.siegeMax) options.push({ target, before, after: Math.min(R.siegeMax, before + gain) });
    }
    return options;
  }
  function prepareSiege(s, armyId, i, target) {
    const a = armyById(s, armyId);
    const option = siegeOptions(s, a, i).find(o => o.target === target);
    if (!option) return null;
    a.siegePlan = { clan: a.c, node: a.n, owner: s.owner[target], target, points: option.after };
    a.mv = true;
    s.dice[i].u = true;
    return [{ type: 'prepare', army: a.id, clan: a.c, v: s.dice[i].v, ...option },
      { type: 'dice', used: [i], army: a.id }];
  }

  // ───────── 合戦の見積もり ─────────
  function attackParts(s, army, t, left) {
    const c = army.c, kishu = left === 0;
    const parts = [['兵', army.t]];
    if (kishu) parts.push(['奇襲', 0]); else parts.push(['勢い', Math.min(left, R.momentumCap)]);
    let sup = 0;
    for (const m of adj[t]) { const a = armyAt(s, m); if (a && a.c === c && a.id !== army.id) sup++; }
    if (sup) parts.push(['加勢', sup * supVal(c)]);
    const tr = trait(c);
    if (tr === 'charge') parts.push(['軍神', 1]);
    const prep = siegePoints(s, army, t);
    if (prep) parts.push(['攻城準備', prep]);
    if (kishu && tr === 'ambush') parts.push(['野伏せ', 2]);
    if (tr === 'cannon' && nodes[t].kind === 'c') parts.push(['国崩し', 2]);
    return { parts, kishu, total: parts.reduce((x, p) => x + p[1], 0) };
  }
  function defenseParts(s, t) {
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
    const A = attackParts(s, army, t, left), D = defenseParts(s, t);
    let win = 0;
    if (A.kishu) win = A.total > D.total ? 1 : 0;
    else for (let d = 1; d <= 6; d++) if (A.total > D.total + d) win++;
    return { A, D, kishu: A.kishu, p: A.kishu ? win : win / 6 };
  }

  // ───────── 内政 ─────────
  const devCap = p => BASEK[p] + R.devCap;
  const devNeed = (s, p) => R.devNeed0 + R.devNeedStep * Math.max(0, s.kok[p] - BASEK[p]);
  const fortNeed = (s, p) => R.fortNeed0 + R.fortNeedStep * s.fort[p];
  function recruitGain(s, a, p) {
    const g = R.recruitBase + Math.floor(s.kok[p] / R.recruitDiv) + (isAutumn(s) ? R.recruitAutumn : 0) + (trait(a.c) === 'ichiryo' ? 2 : 0);
    return Math.max(0, Math.min(R.armyMax - a.t, g));
  }
  // 内政の見積もり（kind: recruit 徴兵 / develop 開墾 / fortify 築城）
  function governPreview(s, a, kind, v) {
    const nd = nodes[a.n];
    if (nd.kind !== 'c' || s.owner[nd.p] !== a.c) return { ok: false, why: '自分の城にいる軍勢だけが内政できる' };
    const p = nd.p;
    const bonus = trait(a.c) === 'gold' ? 2 : 0;
    if (kind === 'recruit') {
      const g = recruitGain(s, a, p);
      return { ok: g > 0, why: g > 0 ? '' : '兵が満ちている', gain: g, from: a.t, to: a.t + g, p };
    }
    if (kind === 'develop') {
      if (s.kok[p] >= devCap(p)) return { ok: false, why: 'これ以上は開けない', p, cap: true, kok: s.kok[p] };
      const add = v + bonus;
      let kp = s.kp[p] + add, k = s.kok[p], up = 0;
      for (;;) { const need = R.devNeed0 + R.devNeedStep * (k - BASEK[p]); if (k >= devCap(p) || kp < need) break; kp -= need; k++; up++; }
      if (k >= devCap(p)) kp = 0;
      return { ok: true, add, cur: s.kp[p], need: devNeed(s, p), up, kok: s.kok[p], kok1: k, kp1: kp, p };
    }
    if (kind === 'fortify') {
      const gm = garMax(s, p, a.c);
      if (s.fort[p] >= R.fortMax && s.gar[p] >= gm) return { ok: false, why: '普請は済んでいる', p, cap: true, fort: s.fort[p] };
      const add = v + bonus;
      let fp = s.fp[p] + add, f = s.fort[p], up = 0;
      for (;;) { const need = R.fortNeed0 + R.fortNeedStep * f; if (f >= R.fortMax || fp < need) break; fp -= need; f++; up++; }
      if (f >= R.fortMax) fp = 0;
      // 築城すると守備兵は（普請が成ったぶんも含めて）上限まで満ちる
      return { ok: true, add, cur: s.fp[p], need: fortNeed(s, p), up, fort: s.fort[p], fort1: f, fp1: fp, gar: s.gar[p], gar1: gm + up, p };
    }
    return { ok: false, why: '' };
  }
  function govern(s, armyId, i, kind) {
    const a = armyById(s, armyId);
    if (!a || a.c !== s.cur || a.mv || s.phase !== 'move') return null;
    if (!s.dice[i] || s.dice[i].u) return null;
    const v = s.dice[i].v;
    const o = governPreview(s, a, kind, v);
    if (!o.ok) return null;
    const p = o.p;
    if (kind === 'recruit') a.t += o.gain;
    else if (kind === 'develop') { s.kok[p] = o.kok1; s.kp[p] = o.kp1; }
    else if (kind === 'fortify') { s.fort[p] = o.fort1; s.fp[p] = o.fp1; s.gar[p] = Math.max(s.gar[p], o.gar1); }
    s.dice[i].u = true; a.mv = true; a.dom = kind;
    s.clans[a.c].dom[kind]++;
    return [{ type: 'govern', army: a.id, clan: a.c, prov: p, kind, v, o }, { type: 'dice', used: [i], army: a.id }];
  }
  function setDelegate(s, armyId, on) {
    const a = armyById(s, armyId);
    if (!a) return false;
    if (on) a.dg = true; else delete a.dg;
    return true;
  }

  // ───────── 手番の進行 ─────────
  function beginClanTurn(s) {
    const c = s.cur, ev = [];
    s.dice = []; s.rer = false;
    for (const a of s.armies) if (a.c === c) { a.mv = false; delete a.dom; }
    // 守備兵の回復
    const step = trait(c) === 'meimon' ? 2 : 1;
    for (const p of provsOf(s, c)) s.gar[p] = Math.min(garMax(s, p, c), s.gar[p] + step);
    s.phase = spawnOptions(s, c).length ? 'place' : 'roll';
    ev.push({ type: 'turn', clan: c });
    return ev;
  }
  // 新しい軍勢の出陣先：軍勢のいない自分の城。どの城にも軍勢がいるときは、城のすぐ外（国境のマス）
  function spawnOptions(s, c) {
    if (armiesOf(s, c).length >= slots(s, c)) return [];
    const mine = provsOf(s, c);
    const free = mine.filter(p => !armyAt(s, p));
    if (free.length) return free;
    const out = [];
    const zoc = zocSet(s, c);
    for (const p of mine) for (const m of adj[p]) if (!armyAt(s, m) && !out.includes(m) && !zoc[m]) out.push(m);
    if (out.length) return out;
    for (const p of mine) for (const m of adj[p]) if (!armyAt(s, m) && !out.includes(m)) out.push(m);
    return out;
  }
  function spawn(s, node) {
    const c = s.cur;
    const ev = [];
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
    delete a.siegePlan;
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
    const prep = siegePoints(s, a, t);
    if (prep) b.prep = prep;
    const cs = s.clans[c];
    if (pv.kishu) cs.kishu++;
    if (m > 0) {
      const lossD = 1 + Math.floor(m / 2) + (trait(c) === 'mamushi' ? 1 : 0);
      const lossA = (castle ? 1 : 0) + (m <= 2 ? 1 : 0);
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
        clearInvalidPlans(s);
        // 戦火で荒れる
        if (s.kok[p] > BASEK[p]) s.kok[p]--;
        if (s.fort[p] > 0) s.fort[p]--;
        s.kp[p] = 0; s.fp[p] = 0;
        if (trait(c) === 'plunder') a.t = Math.min(R.armyMax, a.t + 1);
        cs.cap++;
        s.lastCap[p] = s.turn;
        ev.push({ type: 'capture', prov: p, from: old, to: c, army: a.id });
        if (old && provCount(s, old) === 0) eliminate(s, old, c, ev);
        const n = provCount(s, c);
        if (n > cs.peak) cs.peak = n;
        checkUnify(s, ev);
      }
    } else {
      const lossA = 1 + Math.floor(-m / 2) + (dc && trait(dc) === 'mamushi' ? 1 : 0);
      const lossD = (-m <= 2) ? 1 : 0;
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
    if (da && da.siegePlan && da.t < b.def.t0) {
      const before = da.siegePlan.points;
      const after = da.n === da.siegePlan.node && armyById(s, da.id) ? Math.max(0, before - R.siegeDisruption) : 0;
      // 表示用スナップショットと共有されている可能性があるので、準備を新しい値で置き換える。
      if (after) da.siegePlan = { ...da.siegePlan, points: after };
      else delete da.siegePlan;
      ev.push({ type: 'disrupt', army: da.id, before, after });
    }
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
  // 臣従：c の国と軍勢が to のものになる
  function absorb(s, c, to, ev) {
    const provs = provsOf(s, c);
    provs.forEach(p => { s.owner[p] = to; });
    const moved = [];
    for (const a of s.armies) if (a.c === c) { a.c = to; a.mv = true; delete a.dom; delete a.dg; moved.push(a.id); }
    s.clans[c].alive = false; s.clans[c].fell = { turn: s.turn, by: to, sub: true };
    s.clans[to].sub++;
    clearInvalidPlans(s);
    const n = provCount(s, to);
    if (n > s.clans[to].peak) s.clans[to].peak = n;
    ev.push({ type: 'submit', clan: c, to, provs, armies: moved });
    checkUnify(s, ev);
  }
  function checkUnify(s, ev) {
    if (s.over) return;
    const c = s.owner[0];
    if (!c) return;
    for (let p = 1; p < P; p++) if (s.owner[p] !== c) return;
    s.over = { kind: c === s.player ? 'win' : 'lose', reason: 'unify', clan: c, turn: s.turn };
    s.phase = 'over';
    ev.push({ type: 'over', over: s.over });
  }

  function healAmount(s, a) {
    const nd = nodes[a.n];
    let h = (nd.kind === 'c' && s.owner[nd.p] === a.c) ? R.healCastle : R.healField;
    if (isAutumn(s)) h += 1;
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
    if (s.over || s.phase === 'decide') return ev;
    for (;;) {
      s.oi++;
      if (s.oi >= s.order.length) { endRound(s, ev); if (s.over || s.phase === 'decide') return ev; s.oi = 0; }
      s.cur = s.order[s.oi];
      if (s.clans[s.cur].alive) break;
    }
    return ev;
  }
  function rankList(s) {
    const k = kokAll(s), n = counts(s);
    return CLAN_IDS.filter(c => s.clans[c].alive).map(c => ({ c, k: k[c], n: n[c] })).sort((a, b) => b.k - a.k || b.n - a.n);
  }
  function endRound(s, ev) {
    s.turn++;
    s.hist.push(histRow(s));
    // 包囲網（石高で見る）
    const rk = rankList(s);
    const prev = s.coal;
    s.coal = null;
    if (rk.length > 1 && rk[0].k >= R.coalitionKok && rk[0].k >= R.coalitionRatio * rk[1].k) s.coal = rk[0].c;
    if (s.coal && s.coal !== prev) ev.push({ type: 'coalition', clan: s.coal });
    if (!s.coal && prev) ev.push({ type: 'coalition-end', clan: prev });
    checkSubmissions(s, ev);
    if (s.over) return;
    if (s.turn >= s.maxTurn) {
      if (s.player && s.clans[s.player].alive && !s.autoEnd) {
        s.phase = 'decide'; s.cur = null;
        ev.push({ type: 'decide', turn: s.turn });
        return;
      }
      conclude(s, ev);
      return;
    }
    makeOrder(s);
    ev.push({ type: 'season', turn: s.turn });
  }
  // 期間を延長して続ける
  function extend(s) {
    if (s.phase !== 'decide') return [];
    s.maxTurn += R.extTurns; s.ext++;
    s.phase = 'idle';
    makeOrder(s);
    return [{ type: 'extend', maxTurn: s.maxTurn }, { type: 'season', turn: s.turn }];
  }
  // ここで決着（石高の順位で判定）
  function conclude(s, ev) {
    ev = ev || [];
    if (s.over) return ev;
    const rank = rankList(s);
    const pr = s.player ? rank.findIndex(r => r.c === s.player) : -1;
    s.over = { kind: pr === 0 ? 'top' : 'time', reason: 'time', rank, place: pr + 1, turn: s.turn };
    s.phase = 'over';
    ev.push({ type: 'over', over: s.over });
    return ev;
  }

  // 臣従の判定（季節の終わり）
  function checkSubmissions(s, ev) {
    const kk = kokAll(s), pc = counts(s);
    let total = 0; for (const c in kk) total += kk[c];
    let dom = null;
    for (const c of CLAN_IDS) if (s.clans[c].alive && s.owner[KYO] === c && kk[c] >= 0.6 * total) dom = c;
    const list = shuffle(s, CLAN_IDS.filter(c => s.clans[c].alive && c !== s.player));
    s.offers = (s.offers || []).filter(o => s.clans[o.c] && s.clans[o.c].alive);
    for (const x of list) {
      if (!s.clans[x].alive || s.over) continue;
      const n = pc[x];
      if (!n) continue;
      const kx = kk[x];
      // 隣の大名
      const nb = new Set();
      for (const p of provsOf(s, x)) for (const q of padj[p]) { const o = s.owner[q]; if (o && o !== x) nb.add(o); }
      let best = null, bk = -1;
      for (const y of nb) {
        if (!s.clans[y].alive) continue;
        if (kk[y] >= Math.max(R.subMinKok, R.subRatio * kx) && kk[y] > bk) { best = y; bk = kk[y]; }
      }
      let chance = 0;
      if (best && n <= R.subMaxProv) {
        // 城の隣に相手の軍勢が来ていると、戦わずに降ることがある
        let press = false;
        for (const p of provsOf(s, x)) for (const m of adj[p]) { const a = armyAt(s, m); if (a && a.c === best) press = true; }
        const ratio = bk / Math.max(1, kx);
        if (press) chance = R.subChance + Math.min(0.15, (ratio - R.subRatio) * 0.015);
        else if (ratio >= 2 * R.subRatio) chance = R.subFar;
      }
      if (dom && dom !== x && n <= 2) { best = best && kk[best] > kk[dom] ? best : dom; chance = Math.max(chance, R.subDom); }
      if (!best || chance <= 0) continue;
      if (rand(s) >= chance) continue;
      if (best === s.player) {
        if (s.decl[x] != null && s.turn - s.decl[x] < R.subDeclineWait) continue;
        if (!s.offers.some(o => o.c === x)) { s.offers.push({ c: x, turn: s.turn }); ev.push({ type: 'offer', clan: x }); }
        continue;
      }
      absorb(s, x, best, ev);
      kk[best] += kx; kk[x] = 0; pc[best] += n; pc[x] = 0;
    }
  }
  function acceptOffer(s, c) {
    const ev = [];
    const i = (s.offers || []).findIndex(o => o.c === c);
    if (i < 0) return ev;
    s.offers.splice(i, 1);
    if (!s.clans[c].alive || !s.player) return ev;
    absorb(s, c, s.player, ev);
    // 自分の手番の途中で加わった軍勢は、この季は動かない
    return ev;
  }
  function declineOffer(s, c) {
    const i = (s.offers || []).findIndex(o => o.c === c);
    if (i >= 0) s.offers.splice(i, 1);
    s.decl[c] = s.turn;
    return [];
  }

  // ───────── 表示用 ─────────
  const KANJI = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  function kanjiNum(n) {
    if (n <= 10) return KANJI[n];
    if (n < 20) return '十' + KANJI[n - 10];
    return KANJI[Math.floor(n / 10)] + '十' + (n % 10 ? KANJI[n % 10] : '');
  }
  const SEASONS = ['春', '夏', '秋', '冬'];
  const ERAS = [[1558, '永禄'], [1570, '元亀'], [1573, '天正'], [1592, '文禄'], [1596, '慶長'], [1615, '元和'], [1624, '寛永'], [1644, '正保'], [1648, '慶安'], [1652, '承応'], [1655, '明暦'], [1658, '万治'], [1661, '寛文'], [1673, '延宝'], [1681, '天和'], [1684, '貞享'], [1688, '元禄']];
  function dateLabel(turn) {
    const y = 1560 + Math.floor(turn / 4);
    let e = ERAS[0];
    for (const x of ERAS) if (y >= x[0]) e = x;
    const ey = y - e[0] + 1;
    const era = y >= 1704 ? y + '年' : e[1] + (ey === 1 ? '元' : kanjiNum(ey)) + '年';
    return { era, season: SEASONS[turn % 4], year: y };
  }

  const E = {
    DATA, R, nodes, adj, padj, N, P, PI, KYO, CLAN, CLAN_IDS, CAPITAL, BASEK, nodeOf,
    rand, d6, newGame, clone, season, isWinter, isAutumn, trait, isMajor, counts, kokAll, kokOf, provCount, provsOf, armiesOf, armyAt, armyById,
    slots, diceCount, garMax, castleDef, nodeCost, supVal, zocSet, reach, pathTo, attackParts, defenseParts, preview,
    devCap, devNeed, fortNeed, recruitGain, governPreview, govern, setDelegate,
    beginClanTurn, spawnOptions, spawn, roll, canReroll, reroll, budgetOf, move, endClanTurn, advance,
    rankList, extend, conclude, acceptOffer, declineOffer, absorb,
    siegePoints, siegeOptions, prepareSiege,
    healAmount, dateLabel, kanjiNum, SEASONS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  else { root.SG = root.SG || {}; root.SG.E = E; }
})(typeof window !== 'undefined' ? window : globalThis);
