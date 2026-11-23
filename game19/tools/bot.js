// せーの、星見の露台へ — 戦いのボット（ルールだけで戦う）
// 方針:
//   greedy … 三人の順番を全部ためし、一人ずつ「その場でいちばん良くなる行動」を選ぶ。
//            良さ＝敵の残り体力・数が減る／手番を終えたとき受ける見こみ（画面の赤い線と同じ計算）が減る。
//            地形で倒す手（谷・水へ押す、凍らせて押す）も、結果が良ければ自然に選ぶ。
//   simple … 地形を考えない。いちばん多く直接ダメージを与える行動を選ぶ（押す向きは問わない）。
//            受ける見こみも見ない。届かないときは近い敵へ寄るだけ。
// どちらも次の手番の敵の動きは、画面の予告と同じ情報しか使わない（乱数はない）。
'use strict';
(function () {
const IN_PAGE = typeof window !== 'undefined' && window.S19;
const path = IN_PAGE ? null : require('path');
const S = IN_PAGE ? window.S19 : require(path.join(__dirname, '..', 'js', 'sim.js'));

const PERMS = [['gard', 'riko', 'sena'], ['gard', 'sena', 'riko'], ['riko', 'gard', 'sena'], ['riko', 'sena', 'gard'], ['sena', 'gard', 'riko'], ['sena', 'riko', 'gard']];

function enemyHp(st) { return S.liveEnemies(st).filter(e => e.active).reduce((s, e) => s + e.hp, 0); }
function evalState(st) {
  if (st.mode !== 'combat') return 100000 + S.heroes(st).reduce((s, h) => s + h.hp, 0);
  if (st.lost) return -100000;
  const live = S.liveEnemies(st).filter(e => e.active);
  let inc = 0; const per = {};
  for (const it of S.intents(st)) if (it.target) { inc += it.dmg; per[it.target] = (per[it.target] || 0) + it.dmg; }
  let koRisk = 0;
  for (const h of S.heroes(st)) if (!h.ko && (per[h.id] || 0) >= h.hp) koRisk++;
  const hp = S.heroes(st).reduce((s, h) => s + (h.ko ? 0 : h.hp), 0);
  const frozen = live.reduce((s, e) => s + (e.frozen > 0 ? 1 : 0), 0);
  return -enemyHp(st) * 20 - live.length * 45 + hp * 6 - inc * 9 - koRisk * 70 + frozen * 6;
}
function candidates(st, hero) {
  const u = S.unitById(st, hero);
  if (!u || u.ko || u.acted) return [];
  const out = S.options(st, hero).filter(p => p.intent.k !== 'rope' || true);
  const m = S.reach(st, u, { max: u.mv, linkCost: 2 });
  for (const [i] of m) {
    const x = i % st.W, y = (i / st.W) | 0;
    if (x === u.x && y === u.y) continue;
    const p = S.plan(st, hero, { k: 'move', x, y });
    if (p.ok) out.push(p);
  }
  return out;
}
function nearestEnemyDist(st, u) {
  let d = 1e9;
  for (const e of S.liveEnemies(st)) if (e.active) d = Math.min(d, Math.abs(e.x - u.x) + Math.abs(e.y - u.y));
  return d > 1e8 ? 0 : d;
}
function choose(st, hero, policy) {
  const cands = candidates(st, hero);
  let best = null, bs = -1e18;
  const base = policy === 'simple' ? 0 : evalState(st);
  for (const p of cands) {
    const c = S.clone(st);
    S.apply(c, p);
    let sc;
    if (policy === 'simple') {
      if (p.intent.k === 'rope' || (p.intent.k === 'push' && p.intent.ref.o) || (p.intent.k === 'freeze' && !p.intent.ref)) continue;
      const dealt = enemyHp(st) - enemyHp(c);
      const u = S.unitById(c, hero);
      sc = dealt * 100 - nearestEnemyDist(c, u) - p.cost * 0.01 + (c.mode !== 'combat' ? 1000 : 0);
    } else sc = evalState(c) - p.cost * 0.01;
    if (sc > bs) { bs = sc; best = p; }
  }
  if (policy !== 'simple' && best && bs <= base) return null;
  return best;
}
function playerPhase(st, policy) {
  let best = null;
  for (const order of PERMS) {
    const c = S.clone(st);
    for (const h of order) { if (c.mode !== 'combat') break; const a = choose(c, h, policy); if (a) S.apply(c, a); }
    const sc = evalState(c);
    if (!best || sc > best.sc) best = { sc, order };
    if (policy === 'simple') break;
  }
  const acts = [];
  for (const h of best.order) {
    if (st.mode !== 'combat') break;
    const a = choose(st, h, policy);
    if (a) { S.apply(st, a); acts.push(h + ':' + a.intent.k + (a.intent.ref ? '>' + (a.intent.ref.u || a.intent.ref.o) : '') + (a.intent.dir !== undefined ? '/d' + a.intent.dir : '')); }
  }
  return acts;
}
function fight(st, policy, maxTurns, verbose) {
  let turns = 0, taken = 0, downs = 0;
  const log = [];
  while (st.mode === 'combat' && !st.lost && turns < (maxTurns || 30)) {
    const acts = playerPhase(st, policy);
    log.push('T' + st.turn + ' ' + acts.join(' '));
    if (st.mode !== 'combat') break;
    const evs = S.endPlayerPhase(st);
    for (const e of evs) { if (e.k === 'dmg' && ['gard', 'riko', 'sena'].includes(e.id)) taken += e.n; if (e.k === 'ko' && ['gard', 'riko', 'sena'].includes(e.id)) downs++; }
    turns++;
  }
  if (verbose) console.log(log.join('\n'));
  const hp = S.heroes(st).map(h => h.id + ':' + h.hp).join(' ');
  return { result: st.mode !== 'combat' ? 'win' : st.lost ? 'lose' : 'timeout', turns: turns + 1, log, hp, taken, downs };
}

// 一手番ぶんの「選んだ行動」の並びを返す（ページ内で本物のクリックに置きかえるため）
function planPhase(st, policy) {
  let best = null;
  for (const order of PERMS) {
    const c = S.clone(st);
    for (const h of order) { if (c.mode !== 'combat') break; const a = choose(c, h, policy); if (a) S.apply(c, a); }
    const sc = evalState(c);
    if (!best || sc > best.sc) best = { sc, order };
    if (policy === 'simple') break;
  }
  const c = S.clone(st);
  const out = [];
  for (const h of best.order) {
    if (c.mode !== 'combat') break;
    const a = choose(c, h, policy);
    if (a) { out.push({ hero: h, intent: a.intent, stand: a.stand }); S.apply(c, a); }
  }
  return out;
}

const API = { fight, choose, evalState, playerPhase, planPhase };
if (IN_PAGE) { window.BOT19 = API; return; }
module.exports = API;

if (require.main === module) {
  // 例: node tools/bot.js s2 greedy
  require(path.join(__dirname, '..', 'js', 'data.js'));
  const D = globalThis.D19;
  const ROUTES = require(path.join(__dirname, 'routes.js'));
  const sec = process.argv[2] || 's1', policy = process.argv[3] || 'greedy';
  let carry = {};
  for (const def of D.SECTIONS) {
    const st = S.create(def, carry);
    if (def.startFight) S.startCombat(st, def.startFight, []);
    for (const [hero, intent] of ROUTES[def.id] || []) {
      if (st.mode === 'combat') break;
      const p = S.plan(st, hero, intent);
      if (!p.ok) { console.log('NG', def.id, hero, JSON.stringify(intent), p.why); break; }
      S.apply(st, p);
      if (st.mode === 'combat') break;
    }
    if (def.id === sec) {
      if (st.mode !== 'combat') { console.log('戦いが始まらなかった'); break; }
      const r = fight(st, policy, 30, !process.argv.includes('-q'));
      console.log(sec, policy, r.result, '手番', r.turns, '受けたダメージ', r.taken, '倒れた', r.downs);
      break;
    }
    // 次の区画へ（持ち物だけ引きつぐ）
    carry = { up: Object.assign({}, st.up, { rope2: def.id >= 's3' ? true : st.up.rope2 }), items: st.items, stats: st.stats, moments: st.moments };
  }
}
})();
