/* 戦国すごろく全国版 — 自動対戦シミュレーション
   node tools/sim.js world [games] [--turns=40] [--set=KEY=VAL]   全大名をCPUで回し、勢力図の推移を見る
   node tools/sim.js seat <clan> [games] [--policy=smart|nodom|domx2|recruitonly|nofort|nodev|rush|turtle]   その大名を指定方針で動かす
   node tools/sim.js allseats [games] [--policy=...]   主要大名を順に
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
const TURNS = Number(flag('turns', 40));
const verbose = args.includes('-v');
const POL = {
  smart: null,
  nodom: { noGovern: true },
  domx2: { govMul: 2 },
  recruitonly: { govKinds: ['recruit'] },
  nofort: { govKinds: ['recruit', 'develop'] },
  nodev: { govKinds: ['recruit', 'fortify'] },
  rush: { pers: { aggr: 1.6, caut: 0.4, dev: 0.6 } },
  turtle: { pers: { aggr: 0.6, caut: 1.6, dev: 1.3 } },
};

function runGame(player, seed) {
  const s = E.newGame(player, seed, { maxTurn: TURNS });
  s.autoEnd = true;
  const st = { battles: 0, caps: 0, clanCaps: 0, recaps: 0, kishu: 0, elim: [], subs: [], coal: [], t0: Date.now(), maxClanMs: 0, seasonMs: [], dom: { recruit: 0, develop: 0, fortify: 0 }, moves: 0 };
  const lastCap = {};
  let guard = 0, tSeason = Date.now(), lastTurn = 0;
  while (!s.over && guard++ < 20000) {
    E.beginClanTurn(s);
    const t1 = Date.now();
    const opt = s.cur === player ? POL[policy] : null;
    const ev = AI.playTurn(s, opt || undefined);
    st.maxClanMs = Math.max(st.maxClanMs, Date.now() - t1);
    for (const e of ev) {
      if (e.type === 'battle') { st.battles++; if (e.kishu) st.kishu++; }
      if (e.type === 'capture') { st.caps++; if (lastCap[e.prov] != null && s.turn - lastCap[e.prov] <= 4) st.recaps++; lastCap[e.prov] = s.turn; }
      if (e.type === 'eliminated') st.elim.push(e.clan + '@' + s.turn);
      if (e.type === 'govern') st.dom[e.kind]++;
      if (e.type === 'move') st.moves++;
    }
    if (s.over) break;
    const ev2 = E.advance(s);
    for (const e of ev2) {
      if (e.type === 'coalition') st.coal.push(e.clan + '@' + s.turn);
      if (e.type === 'submit') st.subs.push(e.clan + '>' + e.to + '@' + s.turn);
    }
    if (s.turn !== lastTurn) { st.seasonMs.push(Date.now() - tSeason); tSeason = Date.now(); lastTurn = s.turn; }
  }
  st.ms = Date.now() - st.t0;
  return { s, st };
}

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
function curveOf(res, fn) {
  const out = [];
  for (let t = 0; t <= TURNS; t += Math.max(4, TURNS / 10)) {
    const v = res.map(r => r.s.hist[t] ? fn(r.s.hist[t], r) : null).filter(x => x != null);
    out.push(t + ':' + (v.length ? mean(v).toFixed(1) : '-'));
  }
  return out.join(' ');
}

function summarize(res, player) {
  const n = res.length;
  const wins = {}, overs = {};
  for (const { s } of res) {
    const o = s.over;
    const k = o.reason === 'unify' ? 'unify:' + o.clan : o.reason === 'time' ? 'top:' + o.rank[0].c : o.reason;
    wins[k] = (wins[k] || 0) + 1;
    if (player) overs[o.kind + (o.place ? o.place : '')] = (overs[o.kind + (o.place ? o.place : '')] || 0) + 1;
  }
  console.log('games', n, 'turns', TURNS, 'avg end turn', mean(res.map(r => r.s.over.turn)).toFixed(1));
  console.log('top/outcome', JSON.stringify(wins));
  if (player) console.log('player', player, policy, JSON.stringify(overs));
  const avg = k => mean(res.map(r => r.st[k])).toFixed(1);
  console.log('battles', avg('battles'), 'caps', avg('caps'), 'recaps<=4', avg('recaps'), 'kishu', avg('kishu'), 'moves', avg('moves'));
  console.log('domestic/game', ['recruit', 'develop', 'fortify'].map(k => k + ' ' + mean(res.map(r => r.st.dom[k])).toFixed(0)).join(' '));
  console.log('ms/game', avg('ms'), 'ms/season avg', mean(res.map(r => mean(r.st.seasonMs))).toFixed(1), 'max', Math.max(...res.map(r => Math.max(...r.st.seasonMs))), 'max ms/clan', Math.max(...res.map(r => r.st.maxClanMs)));
  console.log('leader kok   ', curveOf(res, h => Math.max(...Object.values(h))));
  console.log('alive clans  ', curveOf(res, h => Object.keys(h).length));
  console.log('alive majors ', curveOf(res, h => Object.keys(h).filter(c => E.CLAN[c].major).length));
  if (player) console.log('player kok   ', curveOf(res, h => h[player] || 0));
  const el = {}; for (const r of res) for (const e of r.st.elim) { const c = e.split('@')[0]; if (E.CLAN[c].major) el[c] = (el[c] || 0) + 1; }
  console.log('majors elim  ', JSON.stringify(el));
  console.log('submissions/game', mean(res.map(r => r.st.subs.length)).toFixed(1), 'eliminations/game', mean(res.map(r => r.st.elim.length)).toFixed(1));
  const co = {}; for (const r of res) for (const e of r.st.coal) { const c = e.split('@')[0]; co[c] = (co[c] || 0) + 1; }
  console.log('coalitions', JSON.stringify(co));
  // 終局の首位（主要大名ごと）と平均石高
  const fin = {};
  for (const r of res) { const h = r.s.hist[r.s.hist.length - 1]; for (const c in h) if (E.CLAN[c].major) (fin[c] = fin[c] || []).push(h[c]); }
  console.log('final kok (major, avg incl. 0)', E.DATA.CLANS.filter(c => c.major).map(c => c.n + ':' + (mean(fin[c.id] || []) * (fin[c.id] || []).length / n).toFixed(0)).join(' '));
  if (verbose) for (const r of res) console.log(JSON.stringify(r.s.over.rank.slice(0, 5)));
}

if (mode === 'world') {
  const games = Number(args[1]) || 10;
  const res = [];
  for (let g = 0; g < games; g++) res.push(runGame(null, 1000 + g * 7919));
  summarize(res, null);
} else if (mode === 'seat') {
  const clan = args[1];
  const games = Number(args[2]) || 10;
  const res = [];
  for (let g = 0; g < games; g++) res.push(runGame(clan, 5000 + g * 104729));
  summarize(res, clan);
} else if (mode === 'allseats') {
  const games = Number(args[1]) || 6;
  for (const c of E.DATA.CLANS.filter(c => c.major)) {
    const res = [];
    for (let g = 0; g < games; g++) res.push(runGame(c.id, 5000 + g * 104729));
    const o = {}; res.forEach(r => { const k = r.s.over.kind === 'lose' ? 'lose' : 'p' + r.s.over.place; o[k] = (o[k] || 0) + 1; });
    const fin = res.map(r => r.s.hist[r.s.hist.length - 1][c.id] || 0);
    const peak = res.map(r => Math.max(...r.s.hist.map(h => h[c.id] || 0)));
    console.log(c.id.padEnd(10), policy, JSON.stringify(o), 'final kok avg', mean(fin).toFixed(1), 'median', fin.sort((a, b) => a - b)[fin.length >> 1], 'peak med', peak.sort((a, b) => a - b)[peak.length >> 1]);
  }
}
module.exports = { runGame };
