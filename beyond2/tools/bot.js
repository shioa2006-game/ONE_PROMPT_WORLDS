// GUILDWARD — 戦いのボット（ルールだけで戦う。ページの中でも node でも動く）
// 方針:
//   greedy … 出撃した仲間の順番を全部ためし、一人ずつ「その場でいちばん良くなる行動」を選ぶ。
//            良さ＝敵の残り体力・数が減る／手番を終えたとき受ける見こみ（画面の赤い線と同じ計算）が減る／米俵が減らない。
//   simple … 地形を考えない。いちばん多く直接ダメージを与える行動を選ぶ。受ける見こみも見ない。
// どちらも、次の手番の敵の動きは画面の予告と同じ情報しか使わない（乱数はない）。
'use strict';
(function () {
const IN_PAGE = typeof window !== 'undefined' && window.S21;
const path = IN_PAGE ? null : require('path');
const S = IN_PAGE ? window.S21 : require(path.join(__dirname, '..', 'js', 'sim.js'));

function perms(a) {
  if (a.length <= 1) return [a.slice()];
  const out = [];
  a.forEach((x, i) => { for (const r of perms(a.slice(0, i).concat(a.slice(i + 1)))) out.push([x].concat(r)); });
  return out;
}
function enemyHp(st) { return S.liveEnemies(st).filter(e => e.active).reduce((s, e) => s + e.hp + (e.boss && !(e.flipped > 0) ? 4 : 0), 0); }
function evalState(st) {
  if (st.lost) return -100000;
  if (st.mode !== 'combat') return 100000 + S.heroes(st).reduce((s, h) => s + h.hp, 0);
  const live = S.liveEnemies(st).filter(e => e.active);
  let inc = 0; const per = {}; let steal = 0, raidNear = 0;
  for (const it of S.intents(st)) {
    if (it.target) { inc += it.dmg; per[it.target] = (per[it.target] || 0) + it.dmg; for (const a of it.also || []) { inc += a.dmg; per[a.id] = (per[a.id] || 0) + a.dmg; } }
    if (it.steal) steal++;
  }
  if (st.raid) for (const e of live) if (S.ENEMY[e.k].raid) { let d = 99; for (const c of st.raid.cells) d = Math.min(d, Math.abs(c[0] - e.x) + Math.abs(c[1] - e.y)); raidNear += Math.max(0, 12 - d); }
  let koRisk = 0;
  for (const h of S.heroes(st)) if (!h.ko && (per[h.id] || 0) >= h.hp) koRisk++;
  const hp = S.heroes(st).reduce((s, h) => s + (h.ko ? 0 : h.hp), 0);
  const frozen = live.reduce((s, e) => s + (e.frozen > 0 ? 1 : 0) + (e.flipped > 0 ? 2 : 0), 0);
  const sacks = st.raid ? st.raid.sacks : 0;
  let far = 0;
  for (const e of live) { let d = 99; for (const h of S.heroes(st)) if (!h.ko && !h.fixed) d = Math.min(d, Math.abs(h.x - e.x) + Math.abs(h.y - e.y)); far += Math.min(d, 20); }
  for (const h of S.heroes(st)) { if (h.ko || h.fixed) continue; let d = 99; for (const e of live) d = Math.min(d, Math.abs(h.x - e.x) + Math.abs(h.y - e.y)); if (d < 99) far += Math.min(d, 20) * 0.4; }
  // 大亀：段のふちにいて、押し手が反対側に立てる／リコが2段上から狙える、をよしとする
  let boss = 0;
  for (const e of live) {
    if (!S.ENEMY[e.k].armor || e.flipped > 0) continue;
    const canFreeze = S.heroes(st).some(h => !h.ko && h.k === 'sena');
    const pushers = S.heroes(st).filter(h => !h.ko && (h.k === 'gard' || h.k === 'tobi'));
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = S.DIRS[d];
      const n = S.surface(st, e.x + dx, e.y + dy);
      if (n.out || n.block || n.wall || e.z - n.z < 2) continue;
      boss += 4;
      for (const h of pushers) {
        if (h.k === 'gard' && h.x === e.x - dx && h.y === e.y - dy && Math.abs(h.z - e.z) <= 1) boss += 40;
        if (h.k === 'tobi' && S.inRange(h.x, h.y, e.x - dx, e.y - dy, 4) && Math.abs(h.x - e.x) + Math.abs(h.y - e.y) > 2) boss += 20;
      }
    }
    for (const h of S.heroes(st)) if (!h.ko && h.k === 'riko' && h.z >= e.z + 2 && S.inRange(h.x, h.y, e.x, e.y, 5)) boss += 10;
  }
  return boss - enemyHp(st) * 20 - live.length * 45 + hp * 6 - inc * 9 - koRisk * 70 + frozen * 6 + sacks * 400 - steal * 300 - raidNear * 3 - far * 0.6;
}
function candidates(st, hero) {
  const u = S.unitById(st, hero);
  if (!u || u.ko || u.acted) return [];
  const out = S.options(st, hero);
  if (!u.fixed) {
    const m = S.reach(st, u, { max: u.mv, linkCost: 2 });
    for (const [i] of m) {
      const x = i % st.W, y = (i / st.W) | 0;
      if (x === u.x && y === u.y) continue;
      const p = S.plan(st, hero, { k: 'move', x, y });
      if (p.ok) out.push(p);
    }
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
function order(st, policy) {
  const ids = S.heroes(st).filter(h => !h.ko && !h.acted).map(h => h.id);
  let best = null;
  for (const o of perms(ids)) {
    const c = S.clone(st);
    for (const h of o) { if (c.mode !== 'combat') break; const a = choose(c, h, policy); if (a) S.apply(c, a); }
    const sc = evalState(c);
    if (!best || sc > best.sc) best = { sc, order: o };
    if (policy === 'simple') break;
  }
  return best.order;
}
function playerPhase(st, policy) {
  const acts = [];
  for (const h of order(st, policy)) {
    if (st.mode !== 'combat') break;
    const a = choose(st, h, policy);
    if (a) { S.apply(st, a); acts.push(h + ':' + a.intent.k + (a.intent.ref ? '>' + (a.intent.ref.u || a.intent.ref.o) : '') + (a.intent.x !== undefined ? '@' + a.intent.x + ',' + a.intent.y : '') + (a.intent.dir !== undefined ? '/d' + a.intent.dir : '')); }
  }
  return acts;
}
function fight(st, policy, maxTurns, verbose) {
  let turns = 0, taken = 0, downs = 0;
  const log = [];
  const ids = S.heroes(st).map(h => h.id);
  while (st.mode === 'combat' && !st.lost && turns < (maxTurns || 30)) {
    const acts = playerPhase(st, policy);
    log.push('T' + st.turn + ' ' + acts.join(' '));
    if (st.mode !== 'combat' || st.lost) break;
    const evs = S.endPlayerPhase(st);
    for (const e of evs) { if (e.k === 'dmg' && ids.includes(e.id)) taken += e.n; if (e.k === 'ko' && ids.includes(e.id)) downs++; }
    turns++;
  }
  if (verbose) console.log(log.join('\n'));
  const hp = S.heroes(st).map(h => h.id + ':' + h.hp).join(' ');
  return { result: st.lost ? 'lose' : st.mode !== 'combat' ? 'win' : 'timeout', turns: turns + 1, log, hp, taken, downs, sacks: st.raid ? st.raid.sacks : null };
}
// 一手番ぶんの「選んだ行動」の並び（ページ内で本物のクリックに置きかえる）
function planPhase(st, policy) {
  const c = S.clone(st);
  const out = [];
  for (const h of order(st, policy)) {
    if (c.mode !== 'combat') break;
    const a = choose(c, h, policy);
    if (a) { out.push({ hero: h, intent: a.intent, stand: a.stand }); S.apply(c, a); }
  }
  return out;
}

const API = { fight, choose, evalState, playerPhase, planPhase };
if (IN_PAGE) { window.BOT21 = API; return; }
module.exports = API;
})();
