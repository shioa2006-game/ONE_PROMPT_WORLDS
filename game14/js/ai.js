/* ai.js — CPU daimyo for 天下賽配. Greedy per-die choice with exact battle odds and a simple threat model. */
(function (root) {
  'use strict';
  const GD = root.GAME_DATA;
  const E = () => root.Engine;
  // era ramp: CPUs consolidate cautiously early and grow bolder over time
  const AIP = { rampTurns: 6, earlyRisk: 0.2, earlyAggr: 0.5, sonaeW: 1.0, playerHomeTurns: 4, playerHomeRisk: 0.9, playerBias: 0.7, buyReserve: 4 };

  function probWin(ap, base, floor) { return E().winProb(ap, base, floor); }
  // probability that some adjacent enemy can take province p next round (good die; raids if possible)
  function lossRisk(st, p, troopsOverride, sonae) {
    const Eg = E(), adj = Eg.adjacency(), R = Eg.RULES;
    const P = st.provs[p];
    const troops = troopsOverride == null ? P.troops : troopsOverride;
    const home = P.owner === p;
    const castle = home ? P.def * R.homeMul + R.homeBonus : P.def;
    let worst = 0;
    for (const q of adj[p]) {
      const Q = st.provs[q];
      if (Q.owner === P.owner || Q.troops < 2 || !st.dmy[Q.owner].alive) continue;
      if (Eg.isSnowBlocked(st, q, p)) continue;
      const commit = Q.troops - 1;
      const pf = probWin(commit + 5, troops + castle, sonae || 0) * 0.85 + probWin(commit + 6, troops + castle, sonae || 0) * 0.15;
      const pr = home ? 0 : (Math.min(commit, R.raidCap(1)) + 2 > troops + (R.raidCastle ? P.def : 0) ? 0.55 : 0); // a 1 or 2 shows up often
      worst = Math.max(worst, pf, pr);
    }
    return worst;
  }
  function provValue(st, q, d) {
    const Q = st.provs[q];
    let v = 10 + 3 * Q.econ + 1.2 * Q.mil + 0.8 * Q.def;
    const owner = Q.owner;
    if (E().countOwned(st, owner) === 1) v += 5; // eliminates a clan
    if (st.coalition && st.coalition.target === owner && owner !== d) v += 8;
    const pers = GD.DAIMYO[d].ai;
    if (pers.rival && GD.PROVINCES[q].key === pers.rival) v += 4;
    // CPUs do not single out the human (unless a coalition targets them)
    if (owner === st.player && owner !== d && !(st.coalition && st.coalition.target === owner)) v *= AIP.playerBias;
    return v;
  }

  function buildCache(st, d) {
    const Eg = E(), adj = Eg.adjacency();
    const mine = Eg.owned(st, d);
    const enemies = {}, risk = {}, pval = {};
    const targets = new Set();
    for (const p of mine) {
      enemies[p] = adj[p].filter(q => st.provs[q].owner !== d);
      risk[p] = lossRisk(st, p);
      pval[p] = provValue(st, p, d);
      for (const q of enemies[p]) targets.add(q);
    }
    for (const p of mine) if (enemies[p].some(q => st.provs[q].troops + st.provs[q].def < st.provs[p].troops)) targets.add(p);
    return { mine, enemies, risk, pval, targets, room: Eg.troopCap(st, d) - Eg.totalTroops(st, d) };
  }

  function options(st, d, idxs, dv, pers, cache) {
    const Eg = E(), R = Eg.RULES;
    const me = st.dmy[d];
    const out = [];
    const turnsLeft = R.turns - st.turn;
    const ramp = Math.min(1, st.turn / (AIP.rampTurns || 1));
    for (const p of cache.mine) {
      const P = st.provs[p];
      const enemies = cache.enemies[p];
      // ---- attack (force or raid)
      if (Eg.maxOut(P) >= 1 && !P.tired) {
        for (const q of enemies) {
          if (!Eg.canAttack(st, d, p, q)) continue;
          const others = enemies.filter(x => x !== q && st.provs[x].troops >= 3).length;
          const keep = Math.min(P.troops - 1, others ? Math.max(1, Math.round(P.troops * 0.3)) : 1);
          let commit = Math.max(1, P.troops - keep);
          const c = Eg.attackCalc(st, p, q, commit, dv);
          if (c.pWin <= 0) continue;
          commit = c.commit;
          const val = provValue(st, q, d);
          const left = P.troops - commit;
          const exposure = others || cache.risk[p] > 0 ? lossRisk(st, p, left) * cache.pval[p] * 0.7 : 0;
          let score = c.pWin * val - (1 - c.pWin) * commit * 0.6 - exposure;
          let risk = pers.risk + (1 - ramp) * AIP.earlyRisk;
          // early insurance for the human's home castle
          if (st.provs[q].owner === st.player && q === st.player && st.turn <= AIP.playerHomeTurns) risk = Math.max(risk, AIP.playerHomeRisk);
          if (c.pWin < risk) score -= (risk - c.pWin) * 30;
          score *= (0.55 + pers.aggr) * (AIP.earlyAggr + (1 - AIP.earlyAggr) * ramp);
          if (c.raid) score += 2; // free capture, no losses
          out.push({ score, order: { type: 'attack', d, dice: idxs, from: p, to: q, commit } });
        }
      }
      // ---- plot (low faces)
      if (dv.face <= R.plotMax) {
        for (const q of enemies) {
          const pc = Eg.plotCalc(st, p, q, dv);
          if (pc.used || pc.steal <= 0 || me.gold < R.plotCost) continue;
          const danger = cache.risk[p];
          const score = pc.steal * (1.3 + 2.0 * danger + (cache.targets.has(q) ? 0.6 : 0)) * (pers.ninja ? 1.3 : 1) - R.plotCost * 0.4;
          out.push({ score, order: { type: 'plot', d, dice: idxs, from: p, to: q } });
        }
      }
      // ---- recruit (uses 裏)
      if (cache.room > 0) {
        const rc = Eg.recruitCalc(st, p, dv);
        if (rc.gain > 0 && me.gold >= rc.cost) {
          const front = enemies.length > 0 ? 1 : 0;
          const danger = cache.risk[p];
          let score = rc.gain * (0.25 + 2.2 * danger + 0.6 * front + (cache.targets.has(p) ? 0.25 : 0)) - rc.cost * 0.3;
          if (pers.zeal) score *= 1.2;
          out.push({ score, order: { type: 'recruit', d, dice: idxs, at: p } });
        }
      }
      // ---- develop (uses 裏)
      for (const stat of ['econ', 'mil', 'def']) {
        const dc = Eg.devCalc(st, p, stat, dv);
        if (dc.maxed) continue;
        const frac = (dv.u + (dc.ups ? 2 : 0)) / R.devNeed(dc.lvl);
        let w;
        if (stat === 'econ') w = 2.4 * Math.max(0, turnsLeft - 3) / 6;
        else if (stat === 'mil') w = 1.4 + (enemies.length ? 0.5 : 0);
        else w = 0.6 + 4 * cache.risk[p] + (enemies.length ? 0.6 : 0);
        const score = frac * w * (0.6 + pers.dev) * 2.2;
        out.push({ score, order: { type: 'develop', d, dice: idxs, at: p, stat } });
      }
      // ---- move (anywhere through own land) toward danger / staging
      if (Eg.maxOut(P) >= 2) {
        const myRisk = cache.risk[p];
        for (const q of Eg.reachable(st, p)) {
          const amount = enemies.length ? Math.floor(Eg.maxOut(P) / 2) : Eg.maxOut(P);
          if (amount < 2) continue;
          const gain = cache.risk[q] - myRisk * 0.7 + (cache.enemies[q].length && !enemies.length ? 0.35 : 0) + (cache.targets.has(q) ? 0.25 : 0);
          if (gain <= 0.05) continue;
          const score = amount * gain * 1.6 - dv.face * 0.05;
          out.push({ score, order: { type: 'move', d, dice: idxs, from: p, to: q, amount } });
        }
      }
    }
    return out;
  }

  // value of holding back a die of value v as 備え (floors our defence die vs. 力攻め)
  function sonaeValue(st, d, v, cache) {
    if (!E().RULES.sonae) return -1;
    let s = 0;
    for (const p of cache.mine) {
      const r0 = cache.risk[p]; if (r0 <= 0.02) continue;
      const r1 = lossRisk(st, p, null, v);
      s += (r0 - r1) * cache.pval[p];
    }
    return s * AIP.sonaeW;
  }

  function takeTurn(st, d, persOverride) {
    const Eg = E();
    const pers = persOverride || GD.DAIMYO[d].ai;
    const me = st.dmy[d];
    const events = [];
    // buy an extra die with war funds when comfortably rich
    if (Eg.canBuyDie(st, d) && me.gold >= Eg.buyDieCost(st, d) + AIP.buyReserve) Eg.buyDie(st, d);
    let guard = 0;
    while (guard++ < 16) {
      if (st.over || !me.alive) break;
      const free = me.dice.map((x, i) => (x.used ? -1 : i)).filter(i => i >= 0);
      if (!free.length) break;
      const cache = buildCache(st, d);
      let best = null;
      const groups = free.map(i => [i]);
      for (let a = 0; a < free.length; a++) for (let b = a + 1; b < free.length; b++) {
        if (me.dice[free[a]].v === me.dice[free[b]].v) groups.push([free[a], free[b]]);
      }
      for (const g of groups) {
        const dv = Eg.dieValue(st, d, g);
        if (!dv) continue;
        for (const o of options(st, d, g, dv, pers, cache)) {
          const sc = g.length > 1 ? o.score * 0.82 : o.score;
          if (!best || sc > best.score) best = { score: sc, order: o.order };
        }
      }
      if (me.gold >= 6 && (me.tweaks || 0) < Eg.RULES.tweakMax) {
        for (const i of free) for (const delta of [-1, 1]) {
          const v = me.dice[i].v + delta; if (v < 1 || v > 6) continue;
          const old = me.dice[i].v; me.dice[i].v = v;
          const dv = Eg.dieValue(st, d, [i]);
          const opts = options(st, d, [i], dv, pers, cache);
          me.dice[i].v = old;
          for (const o of opts) {
            const sc = o.score - 3.5;
            if (!best || sc > best.score + 2) best = { score: sc, order: o.order, tweak: { i, delta } };
          }
        }
      }
      // free reroll: if the best thing a die can do is poor, reroll the middle-most free die once
      if (me.rerolls > 0 && free.length >= 2 && best && best.score < 4) {
        let pick = free[0], dist = 9;
        for (const i of free) { const dd = Math.abs(me.dice[i].v - 3.5); if (dd < dist) { dist = dd; pick = i; } }
        Eg.reroll(st, d, pick);
        continue;
      }
      // keep the biggest remaining die as 備え if that is worth more than anything else we could do with dice
      if (free.length <= 2 || !best) {
        const maxFree = Math.max(...free.map(i => me.dice[i].v));
        const sv = sonaeValue(st, d, maxFree, cache);
        if (!best || sv > best.score) break;
      }
      if (best.tweak && !Eg.tweak(st, d, best.tweak.i, best.tweak.delta)) { me.tweaks = Eg.RULES.tweakMax; continue; }
      const r = Eg.execute(st, best.order);
      if (!r.ok) { best.order.dice.forEach(i => { me.dice[i].used = true; }); continue; }
      for (const e of r.events) events.push(e);
    }
    return events;
  }

  root.AI = { takeTurn, lossRisk, probWin, AIP, sonaeValue, buildCache, provValue };
})(typeof window !== 'undefined' ? window : globalThis);
