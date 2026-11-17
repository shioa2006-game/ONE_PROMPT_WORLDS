// sim.js — headless balance simulation for 天下賽配 (uses the same js/ files as the browser).
// usage: node tools/sim.js [games=200] [mode=all|player] [seed=1] [--policy=ai|greedy|turtle|raider]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGame() {
  const ctx = { console, Math, JSON, Date };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['mapdata.js', 'data.js', 'engine.js', 'ai.js', 'bots.js']) {
    const p = path.join(__dirname, '..', 'js', f);
    if (!fs.existsSync(p)) { if (f === 'bots.js') continue; throw new Error('missing ' + p); }
    vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
  }
  const tb = path.join(__dirname, 'testbots.js');
  if (fs.existsSync(tb)) vm.runInContext(fs.readFileSync(tb, 'utf8'), ctx, { filename: 'testbots.js' });
  return ctx;
}

function runGame(G, opts) {
  const st = G.Engine.create({ player: opts.player, seed: opts.seed });
  const t0 = process.hrtime.bigint();
  let cpuNs = 0n;
  const bot = opts.policy && opts.policy !== 'ai' ? G.TestBots[opts.policy] : null;
  while (!st.over) {
    G.Engine.startSeason(st);
    if (st.player >= 0 && st.dmy[st.player].alive) {
      G.Engine.rollDice(st, st.player);
      if (bot) bot(st, st.player); else G.AI.takeTurn(st, st.player);
      G.Engine.closeTurn(st, st.player);
    }
    const c0 = process.hrtime.bigint();
    if (!st.over) G.Engine.runCPU(st);
    cpuNs += process.hrtime.bigint() - c0;
    G.Engine.endSeason(st);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { st, ms, cpuMs: Number(cpuNs) / 1e6 };
}

function main() {
  const args = process.argv.slice(2);
  const games = +(args.find(a => /^\d+$/.test(a)) || 200);
  const mode = args.includes('player') ? 'player' : 'all';
  const policy = (args.find(a => a.startsWith('--policy=')) || '--policy=ai').split('=')[1];
  const seed0 = +((args.find(a => a.startsWith('--seed=')) || '--seed=1').split('=')[1]);
  const only = args.find(a => a.startsWith('--only='));
  const G = loadGame();
  const setArg = args.find(a => a.startsWith('--set='));
  if (setArg) for (const kv of setArg.slice(6).split(',')) { const [k, v] = kv.split('='); if (k in G.AI.AIP) G.AI.AIP[k] = +v; else G.Engine.RULES[k] = v.includes('/') ? v.split('/').map(Number) : (isNaN(+v) ? v : +v); }
  const D = G.GAME_DATA.DAIMYO, P = G.GAME_DATA.PROVINCES;
  const N = D.length;
  const pad = (s, n) => (String(s) + ' '.repeat(n)).slice(0, n);

  if (mode === 'all') {
    const wins = new Array(N).fill(0), finalProv = new Array(N).fill(0), alive = new Array(N).fill(0), early = new Array(N).fill(0);
    let totalCpu = 0, maxCpuSeason = 0, unify = 0, battles = 0, conq = 0, aliveEnd = 0, topProv = 0;
    const winnerProvHist = {}; const agg = {};
    for (let g = 0; g < games; g++) {
      const { st, cpuMs } = runGame(G, { player: -1, seed: seed0 + g * 7919 });
      totalCpu += cpuMs; maxCpuSeason = Math.max(maxCpuSeason, cpuMs / st.turn);
      const rk = G.Engine.rankings(st);
      wins[rk[0].id]++;
      winnerProvHist[rk[0].provinces] = (winnerProvHist[rk[0].provinces] || 0) + 1;
      topProv += rk[0].provinces;
      if (st.over.kind.startsWith('unify')) unify++;
      rk.forEach(r => { finalProv[r.id] += r.provinces; if (r.alive) alive[r.id]++; });
      st.dmy.forEach((d, i) => { if (!d.alive && d.diedTurn <= 3) early[i]++; });
      battles += st.stats.battles; conq += st.stats.conquests; for (const k in st.stats) agg[k] = (agg[k] || 0) + st.stats[k];
      aliveEnd += st.dmy.filter(d => d.alive).length;
    }
    console.log(`ALL-CPU ${games} games | avg battles ${(battles / games).toFixed(1)} conquests ${(conq / games).toFixed(1)} | alive at end ${(aliveEnd / games).toFixed(1)} | unify ${unify} | winner provinces avg ${(topProv / games).toFixed(1)}`);
    console.log('winner province histogram', JSON.stringify(winnerProvHist));
    console.log('per game:', Object.entries(agg).map(([k, v]) => k + ' ' + (v / games).toFixed(1)).join(' | '));
    console.log(`cpu time per game ${(totalCpu / games).toFixed(1)}ms, per season ${(totalCpu / games / 20).toFixed(2)}ms`);
    console.log('daimyo           win%  avgProv alive%  diedBy t3');
    D.forEach((d, i) => console.log(pad(d.name, 14), pad((100 * wins[i] / games).toFixed(1), 6), pad((finalProv[i] / games).toFixed(2), 8), pad((100 * alive[i] / games).toFixed(0), 7), (100 * early[i] / games).toFixed(0) + '%'));
    // winner entropy
    let H = 0; wins.forEach(w => { if (w) { const p = w / games; H -= p * Math.log2(p); } });
    console.log('winner entropy (bits):', H.toFixed(2), ' distinct winners:', wins.filter(w => w).length);
  } else {
    const ids = only ? only.split('=')[1].split(',').map(Number) : D.map((_, i) => i);
    console.log(`PLAYER mode policy=${policy}, ${games} games each`);
    console.log('daimyo           win%  rank  prov  surv%  diedT<=4');
    const rows = [];
    for (const i of ids) {
      let win = 0, rankSum = 0, provSum = 0, surv = 0, early = 0;
      for (let g = 0; g < games; g++) {
        const { st } = runGame(G, { player: i, seed: seed0 + g * 7919 + i * 31, policy });
        const rk = G.Engine.rankings(st);
        const me = rk.find(r => r.id === i);
        if (st.over.kind === 'victory' || st.over.kind === 'unify') win++;
        rankSum += me.rank; provSum += me.provinces;
        if (st.dmy[i].alive) surv++; else if (st.dmy[i].diedTurn <= 4) early++;
      }
      rows.push([i, win, rankSum, provSum, surv, early]);
      console.log(pad(D[i].name, 14), pad((100 * win / games).toFixed(1), 6), pad((rankSum / games).toFixed(1), 6), pad((provSum / games).toFixed(1), 6), pad((100 * surv / games).toFixed(0), 6), (100 * early / games).toFixed(0) + '%');
    }
  }
}
main();
