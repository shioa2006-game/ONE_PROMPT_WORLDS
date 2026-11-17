// testbots.js — player-side policies for balance testing (loaded only by tools/sim.js)
(function (root) {
  'use strict';
  const E = () => root.Engine, AI = () => root.AI;
  const clone = st => JSON.parse(JSON.stringify(st));
  const PERSONAS = [
    { aggr: 0.3, dev: 0.9, risk: 0.80 },   // builder / turtle
    { aggr: 0.55, dev: 0.5, risk: 0.65 },  // balanced
    { aggr: 0.85, dev: 0.3, risk: 0.55 },  // aggressive
    { aggr: 1.1, dev: 0.2, risk: 0.45 },   // reckless
    { aggr: 0.6, dev: 0.8, risk: 0.72 },   // careful grower
  ];
  function evaluate(st, me) {
    const Eg = E();
    if (!st.dmy[me].alive) return -1000;
    const pw = Eg.power(st, me);
    const n = Eg.countOwned(st, me);
    let risk = 0;
    for (const p of Eg.owned(st, me)) risk += AI().lossRisk(st, p);
    return n * 30 + pw.troops * 0.5 + pw.econ * 2 + pw.mil + st.dmy[me].gold * 0.15 - risk * 12;
  }
  // 1-step lookahead over playing styles (each style simulated, CPU phase rolled out R times)
  function planner(st, me, R) {
    const Eg = E(); R = R || 5;
    let best = null;
    PERSONAS.forEach(pers => {
      const c = clone(st);
      AI().takeTurn(c, me, pers);
      Eg.closeTurn(c, me);
      let sc = 0;
      for (let r = 0; r < R; r++) {
        const c2 = clone(c); c2.rng = (c2.rng ^ Math.imul(r + 1, 2654435761)) >>> 0;
        if (!c2.over) Eg.runCPU(c2);
        Eg.endSeason(c2);
        sc += evaluate(c2, me);
      }
      sc /= R;
      if (!best || sc > best.sc) best = { sc, pers };
    });
    AI().takeTurn(st, me, best.pers);
  }

  // "focused siege": keep one target for several seasons, stage troops next to it, soften it with 調略, strike when the odds are good.
  function focus(st, me) {
    const Eg = E(), R = Eg.RULES, adj = Eg.adjacency();
    const memo = st._focus || (st._focus = {});
    const mine = Eg.owned(st, me);
    const dm = st.dmy[me];
    const free = () => dm.dice.map((x, i) => (x.used ? -1 : i)).filter(i => i >= 0);
    // choose / keep a target
    const frontier = new Set();
    mine.forEach(p => adj[p].forEach(q => { if (st.provs[q].owner !== me) frontier.add(q); }));
    const strength = q => { const Q = st.provs[q]; const home = Eg.isHome(st, q); return Q.troops + (home ? Q.def * R.homeMul + R.homeBonus : Q.def) + st.dmy[Q.owner].sonae; };
    if (!(memo.t >= 0 && frontier.has(memo.t))) {
      let best = -1, bs = -1e9;
      frontier.forEach(q => { const Q = st.provs[q]; const s = (8 + 3 * Q.econ) / (4 + strength(q)); if (s > bs) { bs = s; best = q; } });
      memo.t = best;
    }
    const t = memo.t;
    if (t < 0) { AI().takeTurn(st, me); return; }
    const stagers = adj[t].filter(p => st.provs[p].owner === me);
    const stage = stagers.sort((a, b) => st.provs[b].troops - st.provs[a].troops)[0];
    let guard = 0;
    while (free().length && guard++ < 12 && !st.over) {
      const f = free();
      // 1) strike if any single die / stack gives >= 0.7
      let strike = null;
      const groups = f.map(i => [i]);
      for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) if (dm.dice[f[a]].v === dm.dice[f[b]].v) groups.push([f[a], f[b]]);
      for (const g of groups) for (const p of stagers) {
        const c = Eg.check(st, { type: 'attack', d: me, dice: g, from: p, to: t });
        if (c.ok && c.calc.pWin >= 0.7 && (!strike || c.calc.pWin > strike.pw)) strike = { pw: c.calc.pWin, o: { type: 'attack', d: me, dice: g, from: p, to: t } };
      }
      // also opportunistic sure raids anywhere
      if (!strike) for (const i of f) for (const p of mine) for (const q of adj[p]) {
        if (st.provs[q].owner === me) continue;
        const c = Eg.check(st, { type: 'attack', d: me, dice: [i], from: p, to: q });
        if (c.ok && c.calc.raid) { strike = { pw: 1, o: { type: 'attack', d: me, dice: [i], from: p, to: q } }; break; }
      }
      if (strike) { Eg.execute(st, strike.o); if (st.provs[t].owner === me) memo.t = -1; continue; }
      // 2) otherwise prepare: lowest die -> recruit at stage (or plot target), others move/develop; keep the top die as 備え if threatened
      const sorted = f.slice().sort((a, b) => dm.dice[a].v - dm.dice[b].v);
      const lo = sorted[0], hi = sorted[sorted.length - 1];
      const threatened = mine.some(p => AI().lossRisk(st, p) > 0.35);
      if (f.length === 1 && threatened && dm.dice[hi].v >= 4) break; // keep as 備え
      let done = false;
      if (dm.dice[lo].v <= R.plotMax && stage != null) { const r = Eg.execute(st, { type: 'plot', d: me, dice: [lo], from: stage, to: t }); done = r.ok; }
      if (!done && stage != null) { const r = Eg.execute(st, { type: 'recruit', d: me, dice: [lo], at: stage }); done = r.ok; }
      if (!done && stage != null) {
        // move the biggest other stack to the stage
        const src = mine.filter(p => p !== stage && Eg.maxOut(st.provs[p]) >= 2).sort((a, b) => st.provs[b].troops - st.provs[a].troops)[0];
        if (src != null) { const r = Eg.execute(st, { type: 'move', d: me, dice: [lo], from: src, to: stage }); done = r.ok; }
      }
      if (!done) {
        // develop the stage's defence or the richest province's economy
        for (const s of ['def', 'econ', 'mil']) { const at = stage != null ? stage : mine[0]; const r = Eg.execute(st, { type: 'develop', d: me, dice: [lo], at, stat: s }); if (r.ok) { done = true; break; } }
      }
      if (!done) dm.dice[lo].used = true;
    }
  }

  root.TestBots = {
    planner: (st, me) => planner(st, me, 5),
    turtle: (st, me) => AI().takeTurn(st, me, PERSONAS[0]),
    aggressive: (st, me) => AI().takeTurn(st, me, PERSONAS[2]),
    focus,
  };
})(typeof window !== 'undefined' ? window : globalThis);
