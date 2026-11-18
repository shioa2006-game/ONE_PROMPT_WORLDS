/* 賽駆け — 自動対戦シミュレーション
   node tools/sim.js world [games] [--set=KEY=VAL]     全大名をCPUで回し、勢力図の推移を見る
   node tools/sim.js seat <clan> [games] [--policy=smart|simple|turtle|rush]   その大名を指定方針で動かす
   ボットが知るのは盤面の全情報（敵の賽の出目は知らない）。人間の操作の代わりではない。 */
'use strict';
const E = require('../js/engine.js');
const AI = require('../js/ai.js');

const args = process.argv.slice(2);
const mode = args[0] || 'world';
const sets = args.filter(a => a.startsWith('--set=')).map(a => a.slice(6).split('='));
for (const [k, v] of sets) E.R[k] = Number(v);
const flag = (k, d) => { const f = args.find(a => a.startsWith('--' + k + '=')); return f ? f.split('=')[1] : d; };
const policy = flag('policy', 'smart');
const verbose = args.includes('-v');

// 単純な方針: いちばん勝率の高い攻撃、なければ最寄りの敵城へ近づく
function simpleMove(s, c) {
  const mine = s.armies.filter(a => a.c === c && !a.mv);
  const free = s.dice.map((d, i) => (d.u ? -1 : i)).filter(i => i >= 0);
  if (!mine.length || !free.length) return null;
  const D = AI.staticDist(s, c);
  let best = null;
  for (const a of mine) for (const i of free) {
    const r = E.reach(s, a, s.dice[i].v);
    for (const at of r.attacks) {
      const n0 = a.n; a.n = at.from; const pv = E.preview(s, a, at.t, at.left); a.n = n0;
      if (pv.p >= 0.5 && (!best || pv.p > best.score)) best = { army: a.id, idxs: [i], target: at.t, score: pv.p };
    }
    if (!best || best.score < 0.5) {
      let tn = -1, td = 99;
      for (const n of r.moves) {
        let md = 99;
        for (let p = 0; p < E.P; p++) if (s.owner[p] !== c) md = Math.min(md, D[n][p]);
        if (md < td) { td = md; tn = n; }
      }
      let cur = 99; for (let p = 0; p < E.P; p++) if (s.owner[p] !== c) cur = Math.min(cur, D[a.n][p]);
      if (tn >= 0 && td < cur && !best) best = { army: a.id, idxs: [i], target: tn, score: 0.1 };
    }
  }
  return best;
}

function playSeat(s) {
  const c = s.cur, ev = [];
  if (policy === 'smart') return AI.playTurn(s);
  const opt = policy === 'turtle' ? { pers: { aggr: 0.6, caut: 1.6 } } : policy === 'rush' ? { pers: { aggr: 1.6, caut: 0.4 } } : null;
  if (opt) return AI.playTurn(s, opt);
  if (s.phase === 'place') ev.push(...E.spawn(s, E.spawnOptions(s, c)[0]));
  if (s.phase === 'roll') ev.push(...E.roll(s));
  for (let g = 0; g < 8 && !s.over; g++) {
    const m = simpleMove(s, c); if (!m) break;
    const e = E.move(s, m.army, m.idxs, m.target); if (!e) break; ev.push(...e);
  }
  if (!s.over) ev.push(...E.endClanTurn(s));
  return ev;
}

function runGame(player, seed) {
  const s = E.newGame(player, seed);
  const lastCap = {};
  const st = { battles: 0, caps: 0, clanCaps: 0, recaps: 0, kishu: 0, elim: [], coal: [], t0: Date.now(), maxClanMs: 0, firstCapTurn: {} };
  let guard = 0;
  while (!s.over && guard++ < 5000) {
    E.beginClanTurn(s);
    const t1 = Date.now();
    const ev = s.cur === player ? playSeat(s) : AI.playTurn(s);
    st.maxClanMs = Math.max(st.maxClanMs, Date.now() - t1);
    for (const e of ev) {
      if (e.type === 'battle') { st.battles++; if (e.kishu) st.kishu++; }
      if (e.type === 'capture') { st.caps++; if (e.from) st.clanCaps++; if (lastCap[e.prov] != null && s.turn - lastCap[e.prov] <= 4) st.recaps++; lastCap[e.prov] = s.turn; }
      if (e.type === 'eliminated') st.elim.push(e.clan + '@' + s.turn);
    }
    if (s.over) break;
    const ev2 = E.advance(s);
    for (const e of ev2) if (e.type === 'coalition') st.coal.push(e.clan + '@' + s.turn);
  }
  st.ms = Date.now() - st.t0;
  return { s, st };
}

function summarize(res, player) {
  const n = res.length;
  const wins = {}, overs = {};
  let turns = 0;
  for (const { s } of res) {
    const o = s.over;
    const k = o.reason === 'tenka' ? 'tenka:' + o.clan : o.reason === 'time' ? 'time:' + o.rank[0].c : o.reason + ':' + (o.by || '');
    wins[k] = (wins[k] || 0) + 1;
    turns += o.turn;
    if (player) {
      const pk = o.kind;
      overs[pk] = (overs[pk] || 0) + 1;
    }
  }
  console.log('games', n, 'avg end turn', (turns / n).toFixed(1));
  console.log('outcomes', JSON.stringify(wins));
  if (player) console.log('player', player, policy, overs);
  const avg = k => (res.reduce((x, r) => x + r.st[k], 0) / n).toFixed(1);
  console.log('battles', avg('battles'), 'caps', avg('caps'), 'clanCaps', avg('clanCaps'), 'recaps<=4', avg('recaps'), 'kishu', avg('kishu'), 'ms/game', avg('ms'), 'max ms/clan', Math.max(...res.map(r => r.st.maxClanMs)));
  // 4季ごとの首位勢力の国数
  const curve = [];
  for (let t = 0; t <= 40; t += 4) {
    const v = res.map(r => r.s.hist[t] ? Math.max(...Object.values(r.s.hist[t])) : null).filter(x => x != null);
    curve.push(t + ':' + (v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '-'));
  }
  console.log('leader provs', curve.join(' '));
  if (player) {
    const pc = [];
    for (let t = 0; t <= 40; t += 4) {
      const v = res.map(r => r.s.hist[t] ? r.s.hist[t][player] : null).filter(x => x != null);
      pc.push(t + ':' + (v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '-'));
    }
    console.log('player provs', pc.join(' '));
  }
  const el = {};
  for (const r of res) for (const e of r.st.elim) { const c = e.split('@')[0]; el[c] = (el[c] || 0) + 1; }
  console.log('eliminated', JSON.stringify(el));
  const co = {}; for (const r of res) for (const e of r.st.coal) { const c = e.split('@')[0]; co[c] = (co[c] || 0) + 1; }
  console.log('coalitions', JSON.stringify(co));
  if (verbose) for (const r of res) console.log(r.s.over, JSON.stringify(r.s.hist[r.s.hist.length - 1]));
}

if (mode === 'world') {
  const games = Number(args[1]) || 20;
  const res = [];
  for (let g = 0; g < games; g++) res.push(runGame(null, 1000 + g * 7919));
  summarize(res, null);
} else if (mode === 'seat') {
  const clan = args[1];
  const games = Number(args[2]) || 20;
  const res = [];
  for (let g = 0; g < games; g++) res.push(runGame(clan, 5000 + g * 104729));
  summarize(res, clan);
} else if (mode === 'allseats') {
  const games = Number(args[1]) || 10;
  for (const c of E.DATA.CLANS) {
    const res = [];
    for (let g = 0; g < games; g++) res.push(runGame(c.id, 5000 + g * 104729));
    const o = {}; res.forEach(r => { o[r.s.over.kind] = (o[r.s.over.kind] || 0) + 1; });
    const fin = res.map(r => r.s.hist[r.s.hist.length - 1][c.id]);
    console.log(c.id.padEnd(8), policy, JSON.stringify(o), 'final provs avg', (fin.reduce((a, b) => a + b, 0) / games).toFixed(1), 'endturn', (res.reduce((a, r) => a + r.s.over.turn, 0) / games).toFixed(1));
  }
}
module.exports = { runGame };
