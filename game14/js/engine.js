/* engine.js — pure game logic for 天下賽配 (no DOM). Works in browser and Node (sim). */
(function (root) {
  'use strict';
  const GD = root.GAME_DATA;

  // ------------------------------------------------------------------ tunable rules
  const RULES = {
    turns: 20,               // 1560 autumn .. 1565 summer
    startSeason: 2,          // 0 spring 1 summer 2 autumn 3 winter
    startYear: 1560,
    diceBase: 3,
    diceSteps: [2, 4, 7],    // +1 die at these province counts
    diceMax: 6,
    troopsStartBase: 4, troopsStartMul: 1,       // starting troops = 4 + 軍事力
    capBase: 8, capMul: 1,                        // clan troop cap = Σ(8 + 軍事力)
    growth: 1,               // natural growth per province per season (while under cap)
    incomeMul: [1, 1, 2, 1], // autumn harvest
    raidMax: 2,              // faces <= raidMax may make a 奇襲 (surprise attack)
    raidCastle: 1,           // 1: the castle still counts against a 奇襲 (only the defender die / 備え are bypassed)
    raidCap: n => (n > 1 ? 9 : 6),   // troops that may join a 奇襲 (single die / ゾロ目)
    plotMax: 3,              // faces <= plotMax may be used for 調略
    plotCap: 3,              // at most this many troops defect per 調略 (+1 with ゾロ目)
    plotFrac: 0.34,          // >0: and at most this fraction of the target's troops
    plotCost: 2,             // gold per 調略
    recruitMilDiv: 2,        // recruit gain = 裏 + floor((mil-3)/recruitMilDiv)
    recruitCostMul: 1,       // gold per recruited troop
    devMul: 3,
    devNeed: lvl => RULES.devMul * (lvl + 1),   // progress needed to raise a stat from lvl
    statMax: 5,
    tweakCost: 2,            // gold per ±1
    tweakMax: 2,             // at most this many ±1 per season
    rerolls: 1,              // free single-die rerolls per season
    extraDieCost: 8,         // >0: gold to buy one extra die per season (軍資金)
    extraDieStep: 6,         // extra cost per die above the base hand
    extraDieMax: 6,          // dice in hand cannot exceed this
    zoromeBonus: 1,          // each extra stacked die adds this bonus (v+v+1, v+v+v+2 ...)
    stackMax: 3,             // at most this many same-face dice in one order
    winLossAttacker: dt => Math.ceil(dt / 2),
    failLossAttacker: c => Math.ceil(c / 2),
    failLossDefender: c => Math.floor(c / 4),
    snowWinter: true,
    homeMul: 2, homeBonus: 3, // 本城: original home castle = 守備×homeMul + homeBonus, cannot be surprise-attacked
    garrison: 0,             // 1: keep the province's 守備力 at home when marching out
    recruitTires: 1,         // a province that recruited cannot launch an attack in the same season
    sonae: 1,                // 備え: your largest unused die floors your defence die vs. 力攻め until your next turn
    sonaeMax: 5,             // 備え is capped and drops by 1 each time it holds a battle
    unusedGold: 1,           // other unused dice become gold
    truceFirst: 1,           // nobody may attack in the first season
    defenderDice: 1,
    coalitionMin: 5, coalitionLead: 2,
    occupyBonus: 1,          // 国衆: local levies join the occupier
    crushMargin: 5, crushBonus: 2,   // 圧勝: winning by crushMargin+ brings crushBonus extra levies
    endCoalitionTurns: 4,    // in the last N seasons any clear leader (>=4, +1) draws a coalition
  };

  // ------------------------------------------------------------------ RNG (mulberry32, state kept in game state)
  function rnd(st) {
    let t = (st.rng = (st.rng + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const d6 = st => 1 + Math.floor(rnd(st) * 6);
  function defRoll(st) { let m = 0; for (let k = 0; k < RULES.defenderDice; k++) m = Math.max(m, d6(st)); return m; }
  // P(ap > base + max(defender roll, floor))
  function winProb(ap, base, floor) {
    const n = RULES.defenderDice; const fl = floor || 0; let w = 0;
    for (let f = 1; f <= 6; f++) {
      const pf = Math.pow(f / 6, n) - Math.pow((f - 1) / 6, n);
      if (ap > base + Math.max(f, fl)) w += pf;
    }
    return w;
  }

  // ------------------------------------------------------------------ map topology
  let ADJ = null;
  function adjacency() {
    if (ADJ) return ADJ;
    ADJ = GD.PROVINCES.map(() => []);
    for (const r of root.MAPDATA.routes) { ADJ[r.a].push(r.b); ADJ[r.b].push(r.a); }
    return ADJ;
  }
  // own provinces reachable from p through own territory (excluding p)
  function reachable(st, p) {
    const o = st.provs[p].owner, adj = adjacency();
    const seen = new Set([p]), out = [], q = [p];
    while (q.length) { const u = q.shift(); for (const v of adj[u]) if (!seen.has(v) && st.provs[v].owner === o) { seen.add(v); out.push(v); q.push(v); } }
    return out;
  }

  // ------------------------------------------------------------------ state
  function create(opts) {
    const o = opts || {};
    const st = {
      v: 2, seed: o.seed >>> 0, rng: (o.seed >>> 0) || 1, turn: 0, player: o.player == null ? -1 : o.player,
      phase: 'start', provs: [], dmy: [], log: [], history: [], over: null, coalition: null,
      stats: { battles: 0, conquests: 0, raids: 0, sieges: 0, siegeWins: 0, plots: 0, recruits: 0, devs: 0, moves: 0, tweaks: 0, stacks: 0, sonaeSaves: 0 },
    };
    GD.PROVINCES.forEach((p, i) => {
      st.provs.push({ owner: i, troops: RULES.troopsStartBase + RULES.troopsStartMul * p.mil, econ: p.econ, mil: p.mil, def: p.def,
        prog: { econ: 0, mil: 0, def: 0 }, tired: false, plotT: -1, lastConq: -1 });
    });
    GD.DAIMYO.forEach((d, i) => {
      st.dmy.push({ alive: true, gold: 2 + GD.PROVINCES[i].econ, dice: [], sonae: 0, rerolls: 0, tweaks: 0, diedTurn: -1, peak: 1, conquests: 0, lost: 0 });
    });
    record(st);
    return st;
  }
  function seasonOf(st) { return (RULES.startSeason + st.turn) % 4; }
  function yearOf(st) { return RULES.startYear + Math.floor((RULES.startSeason + st.turn) / 4); }
  function dateLabel(st, t) {
    const turn = t == null ? st.turn : t;
    const s = (RULES.startSeason + turn) % 4, y = RULES.startYear + Math.floor((RULES.startSeason + turn) / 4);
    const ey = y - GD.ERA.baseYear;
    const kan = ['元', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
    return { era: GD.ERA.name + kan[ey] + '年', season: GD.SEASONS[s], year: y, s };
  }
  function owned(st, d) { const r = []; st.provs.forEach((p, i) => { if (p.owner === d) r.push(i); }); return r; }
  function countOwned(st, d) { let n = 0; for (const p of st.provs) if (p.owner === d) n++; return n; }
  function diceCount(st, d) {
    const n = countOwned(st, d);
    let k = RULES.diceBase; for (const s of RULES.diceSteps) if (n >= s) k++;
    return Math.min(RULES.diceMax, k);
  }
  function nextDiceAt(st, d) { const n = countOwned(st, d); for (const s of RULES.diceSteps) if (n < s) return s; return null; }
  function income(st, d) {
    let g = 0; for (const p of st.provs) if (p.owner === d) g += p.econ;
    return g * RULES.incomeMul[seasonOf(st)];
  }
  function troopCap(st, d) { let c = 0; for (const p of st.provs) if (p.owner === d) c += RULES.capBase + RULES.capMul * p.mil; return c; }
  function totalTroops(st, d) { let t = 0; for (const p of st.provs) if (p.owner === d) t += p.troops; return t; }
  function isSnowBlocked(st, a, b) {
    if (!RULES.snowWinter || seasonOf(st) !== 3) return false;
    return GD.PROVINCES[a].snow || GD.PROVINCES[b].snow;
  }
  function power(st, d) {
    let e = 0, m = 0, f = 0, t = 0; for (const p of st.provs) if (p.owner === d) { e += p.econ; m += p.mil; f += p.def; t += p.troops; }
    return { econ: e, mil: m, def: f, troops: t };
  }
  // ranking: provinces, then 国力 (econ+mil+def), then troops, then gold
  function rankings(st) {
    const rows = st.dmy.map((d, i) => {
      const pw = power(st, i);
      return { id: i, provinces: countOwned(st, i), econ: pw.econ, mil: pw.mil, def: pw.def, troops: pw.troops, gold: d.gold, alive: d.alive, diedTurn: d.diedTurn };
    });
    rows.sort((a, b) => b.provinces - a.provinces || (b.econ + b.mil + b.def) - (a.econ + a.mil + a.def) || b.troops - a.troops || b.gold - a.gold || b.diedTurn - a.diedTurn || a.id - b.id);
    rows.forEach((r, k) => r.rank = k + 1);
    return rows;
  }
  function record(st) { st.history.push(st.dmy.map((_, i) => countOwned(st, i))); }
  function log(st, type, text, extra) { const e = Object.assign({ t: st.turn, type, text }, extra || {}); st.log.push(e); if (st.log.length > 400) st.log.splice(0, st.log.length - 400); return e; }
  const dn = d => GD.DAIMYO[d].short || GD.DAIMYO[d].clan;
  const pn = p => GD.PROVINCES[p].name;
  const isHome = (st, p) => st.provs[p].owner === p; // daimyo i starts in province i

  // ------------------------------------------------------------------ season flow
  function startSeason(st) {
    const ev = [];
    const s = seasonOf(st);
    st.provs.forEach(p => { p.tired = false; });
    st.dmy.forEach((d, i) => {
      if (!d.alive) return;
      const g = income(st, i); d.gold += g;
      d.dice = [];
      // natural growth: +growth per province while under the clan cap
      let room = troopCap(st, i) - totalTroops(st, i);
      if (room > 0) for (const p of owned(st, i)) { if (room <= 0) break; const add = Math.min(RULES.growth, room); st.provs[p].troops += add; room -= add; }
      if (i === st.player) ev.push({ type: 'income', d: i, gold: g, harvest: s === 2 });
    });
    st.phase = 'roll';
    return ev;
  }
  function rollDice(st, d) {
    const n = diceCount(st, d);
    const dice = [];
    for (let k = 0; k < n; k++) dice.push({ v: d6(st), used: false, id: k });
    st.dmy[d].dice = dice;
    st.dmy[d].sonae = 0;       // your own readiness lapses when you take your turn
    st.dmy[d].rerolls = RULES.rerolls; st.dmy[d].tweaks = 0; st.dmy[d].bought = false;
    if (d === st.player) st.phase = 'orders';
    return dice.map(x => x.v);
  }
  // end of a daimyo's turn: the largest unused die becomes 備え, the others become gold
  function closeTurn(st, d) {
    const me = st.dmy[d]; if (!me.alive) return 0;
    const left = me.dice.filter(x => !x.used).map(x => x.v).sort((a, b) => b - a);
    me.sonae = RULES.sonae && left.length ? Math.min(RULES.sonaeMax, left[0]) : 0;
    me.gold += Math.max(0, left.length - (RULES.sonae && left.length ? 1 : 0)) * RULES.unusedGold;
    me.dice.forEach(x => { x.used = true; });
    if (d === st.player && !st.over) st.phase = 'closed';
    return me.sonae;
  }

  // ------------------------------------------------------------------ order helpers
  function dieValue(st, d, idxs) {
    const dice = st.dmy[d].dice;
    const vs = idxs.map(i => dice[Number(i)].v);
    if (vs.length === 1) return { v: vs[0], u: 7 - vs[0], face: vs[0], stacked: false, n: 1 };
    const same = vs.every(x => x === vs[0]);
    if (!same) return null;
    const bonus = RULES.zoromeBonus * (vs.length - 1);
    return { v: vs.reduce((a, b) => a + b, 0) + bonus, u: vs.reduce((a, b) => a + 7 - b, 0) + bonus, face: vs[0], stacked: true, n: vs.length };
  }
  function diceFree(st, d, idxs) {
    const dice = st.dmy[d].dice;
    if (!Array.isArray(idxs) || !idxs.length || idxs.length > RULES.stackMax) return false;
    const seen = new Set();
    for (const raw of idxs) {
      const i = Number(raw);
      if (!Number.isInteger(i) || !dice[i] || dice[i].used || seen.has(i)) return false;
      seen.add(i);
    }
    return true;
  }
  const intOr = (v, dflt) => (v == null ? dflt : (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : NaN));
  function keepOf(P) { return RULES.garrison ? Math.max(1, P.def) : 1; }
  function maxOut(P) { return Math.max(0, P.troops - keepOf(P)); }
  function canAttack(st, d, from, to) {
    const P = st.provs[from], Q = st.provs[to];
    if (!P || !Q || P.owner !== d || Q.owner === d) return false;
    if (!adjacency()[from].includes(to)) return false;
    if (maxOut(P) < 1 || P.tired) return false;
    if (isSnowBlocked(st, from, to)) return false;
    if (RULES.truceFirst && st.turn === 0) return false;
    return true;
  }
  // battle numbers. 奇襲 (low face, not vs 本城): castle and 備え ignored, no defender die, at most raidCap×n troops, sure capture if it reaches.
  function attackCalc(st, from, to, commit, dv) {
    const Q = st.provs[to];
    const home = isHome(st, to);
    const raid = dv.face <= RULES.raidMax && !home;
    if (raid) {
      const c = Math.min(commit, RULES.raidCap(dv.n));
      const ap = c + dv.v;
      const castle = RULES.raidCastle ? Q.def : 0;
      const base = Q.troops + castle;
      return { raid: true, commit: c, ap, castle, base, sonae: 0, defTroops: Q.troops, pWin: ap > base ? 1 : 0, home, need: base + 1 - ap };
    }
    const castle = home ? Q.def * RULES.homeMul + RULES.homeBonus : Q.def;
    const ap = commit + dv.v;
    const base = Q.troops + castle;
    const sonae = RULES.sonae ? st.dmy[Q.owner].sonae : 0;
    return { raid: false, commit, ap, castle, base, sonae, defTroops: Q.troops, pWin: winProb(ap, base, sonae), home, need: base + Math.max(1, sonae) + 1 - ap };
  }
  function plotCalc(st, from, to, dv) {
    const Q = st.provs[to];
    const k = Math.max(0, Math.min(Q.troops - 1, Math.floor(dv.u / 2), dv.stacked ? RULES.plotCap + 1 : RULES.plotCap, RULES.plotFrac ? Math.floor(Q.troops * RULES.plotFrac) : 99));
    return { steal: k, used: Q.plotT === st.turn };
  }
  function recruitCalc(st, at, dv) {
    const P = st.provs[at];
    const raw = Math.max(1, dv.u + Math.floor((P.mil - 3) / RULES.recruitMilDiv));
    const room = Math.max(0, troopCap(st, P.owner) - totalTroops(st, P.owner));
    const gain = Math.min(raw, room);
    const cost = Math.ceil(gain * RULES.recruitCostMul);
    return { gain, raw, cost, room };
  }
  function devCalc(st, at, stat, dv) {
    const P = st.provs[at];
    const lvl = P[stat];
    if (lvl >= RULES.statMax) return { maxed: true, lvl };
    let prog = P.prog[stat] + dv.u, l = lvl, ups = 0;
    while (l < RULES.statMax && prog >= RULES.devNeed(l)) { prog -= RULES.devNeed(l); l++; ups++; }
    if (l >= RULES.statMax) prog = 0;
    return { lvl, newLvl: l, ups, prog, need: RULES.devNeed(Math.min(l, RULES.statMax - 1)) };
  }

  // validate & describe an order without executing
  function check(st, o) {
    const d = o.d;
    if (!st.dmy[d] || !st.dmy[d].alive) return { ok: false, why: 'dead' };
    if (!diceFree(st, d, o.dice)) return { ok: false, why: 'dice' };
    const dv = dieValue(st, d, o.dice);
    if (!dv) return { ok: false, why: 'stack' };
    const adj = adjacency();
    switch (o.type) {
      case 'attack': {
        if (!canAttack(st, d, o.from, o.to)) return { ok: false, why: 'route' };
        const P = st.provs[o.from];
        const want = intOr(o.commit, maxOut(P));
        if (Number.isNaN(want)) return { ok: false, why: 'commit' };
        const commit = Math.max(1, Math.min(maxOut(P), want));
        const calc = attackCalc(st, o.from, o.to, commit, dv);
        if (calc.raid && calc.pWin <= 0) return { ok: false, why: 'short', dv, commit: calc.commit, calc };
        return { ok: true, dv, commit: calc.commit, calc };
      }
      case 'plot': {
        if (dv.face > RULES.plotMax) return { ok: false, why: 'face' };
        const P = st.provs[o.from], Q = st.provs[o.to];
        if (!P || !Q || P.owner !== d || Q.owner === d || !adj[o.from].includes(o.to)) return { ok: false, why: 'route' };
        const calc = plotCalc(st, o.from, o.to, dv);
        if (calc.used) return { ok: false, why: 'plotted', dv, calc };
        if (calc.steal < 1) return { ok: false, why: 'empty', dv, calc };
        if (st.dmy[d].gold < RULES.plotCost) return { ok: false, why: 'gold', dv, calc };
        return { ok: true, dv, calc };
      }
      case 'recruit': {
        const P = st.provs[o.at]; if (!P || P.owner !== d) return { ok: false, why: 'own' };
        const c = recruitCalc(st, o.at, dv);
        if (c.gain < 1) return { ok: false, why: 'cap', calc: c, dv };
        if (st.dmy[d].gold < c.cost) return { ok: false, why: 'gold', calc: c, dv };
        return { ok: true, dv, calc: c };
      }
      case 'develop': {
        const P = st.provs[o.at]; if (!P || P.owner !== d) return { ok: false, why: 'own' };
        if (!['econ', 'mil', 'def'].includes(o.stat)) return { ok: false, why: 'stat' };
        const c = devCalc(st, o.at, o.stat, dv);
        if (c.maxed) return { ok: false, why: 'max', calc: c };
        return { ok: true, dv, calc: c };
      }
      case 'move': {
        const P = st.provs[o.from], Q = st.provs[o.to];
        if (!P || !Q || P.owner !== d || Q.owner !== d || o.from === o.to) return { ok: false, why: 'route' };
        if (!reachable(st, o.from).includes(o.to)) return { ok: false, why: 'route' };
        if (maxOut(P) < 1) return { ok: false, why: 'troops' };
        const want = intOr(o.amount, maxOut(P));
        if (Number.isNaN(want)) return { ok: false, why: 'amount' };
        const amount = Math.max(1, Math.min(maxOut(P), want));
        return { ok: true, dv, amount };
      }
    }
    return { ok: false, why: 'type' };
  }

  function useDice(st, d, idxs) { idxs.forEach(i => { st.dmy[d].dice[Number(i)].used = true; }); }

  function execute(st, o) {
    const c = check(st, o);
    if (!c.ok) return { ok: false, why: c.why, events: [] };
    const d = o.d, ev = [];
    useDice(st, d, o.dice);
    switch (o.type) {
      case 'attack': {
        const P = st.provs[o.from], Q = st.provs[o.to];
        const calc = c.calc;
        const defender = Q.owner;
        let roll = 0, raw = 0, win, dp;
        if (calc.raid) { win = true; dp = calc.base; }
        else {
          raw = defRoll(st); roll = Math.max(raw, calc.sonae || 0);
          dp = calc.base + roll; win = calc.ap > dp;
          if (calc.sonae && raw < calc.sonae) { if (!win && calc.ap > calc.base + raw) st.stats.sonaeSaves++; st.dmy[defender].sonae = Math.max(0, st.dmy[defender].sonae - 1); }
        }
        st.stats.battles++; if (calc.raid) st.stats.raids++; if (calc.home) st.stats.sieges++; if (c.dv.stacked) st.stats.stacks++;
        P.troops -= c.commit;
        const e = { type: 'battle', d, defender, from: o.from, to: o.to, commit: c.commit, dv: c.dv, raid: calc.raid, home: calc.home, ap: calc.ap,
          defTroops: Q.troops, castle: calc.castle, sonae: calc.sonae || 0, raw, roll, dp, win };
        if (win) {
          const loss = calc.raid ? 0 : Math.min(c.commit - 1, RULES.winLossAttacker(Q.troops));
          const crush = !calc.raid && calc.ap - dp >= RULES.crushMargin;
          const occupy = Math.max(1, c.commit - loss) + RULES.occupyBonus + (crush ? RULES.crushBonus : 0);
          e.crush = crush;
          e.loss = loss; e.defLoss = Q.troops; e.occupy = occupy;
          Q.owner = d; Q.troops = occupy; Q.tired = true; Q.prog = { econ: 0, mil: 0, def: 0 }; Q.lastConq = st.turn;
          st.dmy[d].conquests++; st.dmy[defender].lost++;
          st.stats.conquests++; if (calc.home) st.stats.siegeWins++;
          ev.push(e);
          ev.push(log(st, 'conquest', `${dn(d)}、${pn(o.to)}を${calc.raid ? '奇襲で' : ''}攻略`, { d, defender, p: o.to, from: o.from }));
          if (countOwned(st, defender) === 0) {
            st.dmy[defender].alive = false; st.dmy[defender].diedTurn = st.turn; st.dmy[defender].sonae = 0;
            ev.push(log(st, 'fall', `${dn(defender)}家、滅亡`, { d: defender, by: d, p: o.to }));
          }
          st.dmy[d].peak = Math.max(st.dmy[d].peak, countOwned(st, d));
        } else {
          const aLoss = Math.min(c.commit, RULES.failLossAttacker(c.commit));
          const dLoss = Math.min(Q.troops - 1, RULES.failLossDefender(c.commit));
          P.troops += c.commit - aLoss;
          Q.troops -= dLoss;
          P.tired = true;
          e.loss = aLoss; e.defLoss = dLoss;
          ev.push(e);
          ev.push(log(st, 'repulse', `${dn(defender)}、${pn(o.to)}で${dn(d)}を撃退`, { d, defender, p: o.to, from: o.from }));
        }
        break;
      }
      case 'plot': {
        const P = st.provs[o.from], Q = st.provs[o.to];
        const k = c.calc.steal;
        Q.troops -= k; P.troops += k; Q.plotT = st.turn; st.stats.plots++; st.dmy[d].gold -= RULES.plotCost;
        ev.push({ type: 'plot', d, from: o.from, to: o.to, steal: k, defender: Q.owner, dv: c.dv });
        if (k >= 3 || Q.owner === st.player) ev.push(log(st, 'plot', `${dn(d)}の調略、${pn(o.to)}の兵${k}が寝返る`, { d, defender: Q.owner, p: o.to }));
        break;
      }
      case 'recruit': {
        const P = st.provs[o.at];
        P.troops += c.calc.gain; st.dmy[d].gold -= c.calc.cost; st.stats.recruits++;
        if (RULES.recruitTires) P.tired = true;
        ev.push({ type: 'recruit', d, at: o.at, gain: c.calc.gain, cost: c.calc.cost, dv: c.dv });
        break;
      }
      case 'develop': {
        const P = st.provs[o.at];
        const r = c.calc;
        P[o.stat] = r.newLvl; P.prog[o.stat] = r.prog; st.stats.devs++;
        ev.push({ type: 'develop', d, at: o.at, stat: o.stat, ups: r.ups, lvl: r.newLvl, prog: r.prog, need: r.need, dv: c.dv });
        if (r.ups > 0 && d === st.player) log(st, 'grow', `${pn(o.at)}の${STAT_JP[o.stat]}が${r.newLvl}に上昇`, { d, p: o.at });
        break;
      }
      case 'move': {
        const P = st.provs[o.from], Q = st.provs[o.to];
        P.troops -= c.amount; Q.troops += c.amount; st.stats.moves++;
        ev.push({ type: 'move', d, from: o.from, to: o.to, amount: c.amount, dv: c.dv });
        break;
      }
    }
    checkOver(st);
    return { ok: true, events: ev };
  }
  const STAT_JP = { econ: '経済力', mil: '軍事力', def: '守備力' };

  function tweak(st, d, i, delta) {
    if (delta !== 1 && delta !== -1) return false;
    const die = st.dmy[d].dice[i];
    if (!die || die.used) return false;
    const nv = die.v + delta;
    if (nv < 1 || nv > 6) return false;
    if (st.dmy[d].gold < RULES.tweakCost) return false;
    if ((st.dmy[d].tweaks || 0) >= RULES.tweakMax) return false;
    st.dmy[d].gold -= RULES.tweakCost; st.dmy[d].tweaks = (st.dmy[d].tweaks || 0) + 1; die.v = nv; die.tweaked = (die.tweaked || 0) + 1; st.stats.tweaks++;
    return true;
  }
  function buyDieCost(st, d) { return RULES.extraDieCost + RULES.extraDieStep * Math.max(0, st.dmy[d].dice.length - RULES.diceBase); }
  function canBuyDie(st, d) {
    const me = st.dmy[d];
    return RULES.extraDieCost > 0 && me.alive && me.dice.length > 0 && !me.bought && me.dice.length < RULES.extraDieMax && me.gold >= buyDieCost(st, d);
  }
  function buyDie(st, d) {
    if (!canBuyDie(st, d)) return false;
    const me = st.dmy[d];
    me.gold -= buyDieCost(st, d); me.bought = true;
    const v = d6(st);
    me.dice.push({ v, used: false, id: me.dice.length, bought: true });
    st.stats.bought = (st.stats.bought || 0) + 1;
    return v;
  }
  function reroll(st, d, i) {
    const me = st.dmy[d], die = me.dice[i];
    if (!die || die.used || !(me.rerolls > 0)) return false;
    me.rerolls--; die.v = d6(st); die.rerolled = true; st.stats.rerolls = (st.stats.rerolls || 0) + 1;
    return die.v;
  }

  function checkOver(st) {
    if (st.over) return st.over;
    if (st.player >= 0 && !st.dmy[st.player].alive) { st.over = { kind: 'defeat', turn: st.turn }; st.phase = 'over'; record(st); return st.over; }
    const alive = st.dmy.filter(d => d.alive).length;
    if (alive === 1) {
      const w = st.dmy.findIndex(d => d.alive);
      st.over = { kind: w === st.player ? 'unify' : 'unify-cpu', winner: w, turn: st.turn }; st.phase = 'over'; record(st);
    }
    return st.over;
  }

  // run every CPU daimyo (random order). returns events.
  function runCPU(st) {
    const order = [];
    st.dmy.forEach((d, i) => { if (d.alive && i !== st.player) order.push(i); });
    for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(rnd(st) * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    const ev = [];
    updateCoalition(st, ev);
    for (const d of order) {
      if (st.over) break;
      if (!st.dmy[d].alive) continue;
      rollDice(st, d);
      const evs = root.AI.takeTurn(st, d);
      for (const e of evs) ev.push(e);
      closeTurn(st, d);
    }
    return ev;
  }
  // a dominant power provokes a coalition (包囲網)
  function updateCoalition(st, ev) {
    const rk = rankings(st);
    const top = rk[0], second = rk[1];
    const prev = st.coalition;
    const late = st.turn >= RULES.turns - RULES.endCoalitionTurns;
    const min = late ? Math.min(4, RULES.coalitionMin) : RULES.coalitionMin, lead = late ? 1 : RULES.coalitionLead;
    if (top.provinces >= min && top.provinces >= second.provinces + lead) {
      if (!prev || prev.target !== top.id) {
        st.coalition = { target: top.id, since: st.turn };
        ev.push(log(st, 'coalition', `${dn(top.id)}包囲網、結成`, { d: top.id }));
      }
    } else if (prev && (top.id !== prev.target || top.provinces < min - 1)) {
      st.coalition = null;
      ev.push(log(st, 'coalition-end', `${dn(prev.target)}包囲網、解ける`, { d: prev.target }));
    }
  }
  function endSeason(st) {
    const ev = [];
    st.dmy.forEach(d => { if (d.alive) d.dice = []; });
    if (!st.over) {
      st.turn++;
      record(st);
      if (st.turn >= RULES.turns) {
        const rk = rankings(st);
        st.over = { kind: rk[0].id === st.player ? 'victory' : 'timeup', winner: rk[0].id, turn: st.turn };
        st.phase = 'over';
      }
    }
    return ev;
  }

  function serialize(st) { return JSON.stringify(st); }
  function deserialize(s) { const st = JSON.parse(s); return st && st.v === 2 ? st : null; }

  root.Engine = {
    RULES, create, startSeason, rollDice, closeTurn, check, execute, tweak, reroll, buyDie, canBuyDie, buyDieCost, runCPU, endSeason,
    adjacency, reachable, owned, countOwned, diceCount, nextDiceAt, income, troopCap, totalTroops, seasonOf, yearOf, dateLabel, rankings, power,
    attackCalc, canAttack, plotCalc, recruitCalc, devCalc, winProb, keepOf, maxOut, dieValue, isSnowBlocked, isHome, rnd, d6, serialize, deserialize, checkOver,
    STAT_JP, dn, pn,
  };
})(typeof window !== 'undefined' ? window : globalThis);
