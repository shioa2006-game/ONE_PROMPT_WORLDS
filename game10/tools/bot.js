/*
 * ぐるり、夜まつり ― 自動プレイ（ルールとバランスの確認用）
 *
 * ボットが知っていること：盤の上の すべての玉・妖（数字や体力も）。人と同じ情報。
 * ボットが使う入力：sim.searchChains が 見つけた鎖（深さ優先、手数に上限あり）を そのまま はなす。
 *   なぞる速さ・まちがい・見おとし は ない（人より ずっと 正確）。
 * 方針：
 *   smart   … 輪で むすべるなら むすぶ。あとは あぶない妖から おどかす／体力が へったら 団子
 *   noring  … 輪を つかわない（ふつうの鎖だけ）。ほかは smart と同じ
 *   long    … いちばん 長い鎖を えらぶだけ（輪も 長ければ えらぶ）
 *   random  … 有効な鎖から でたらめに えらぶ（3〜6つ）
 *
 * 使い方：node tools/bot.js [方針|all] [回数]
 */
'use strict';
const path = require('path');
const D = require(path.join(__dirname, '../js/data.js'));
const S = require(path.join(__dirname, '../js/sim.js'));

function scoreSmart(info, st) {
  const P = st.P, Sx = st.S;
  let s = 0;
  for (const id of info.befriend) {
    const i = S.findPiece(st, id), y = st.cells[i];
    s += D.SPECIES[y.sp].rare ? 90 : 45;
  }
  if (info.type === 'H') {
    for (const tg of info.targets) {
      const y = st.cells[tg.idx], sp = D.SPECIES[y.sp];
      const danger = (y.cd <= 1 ? 2 : 1) * Math.max(1, sp.atk);
      if (sp.rare) { s -= tg.kill ? 60 : 5; continue; }
      if (tg.kill) s += 12 + danger * 4 + y.hp * 2;
      else s += Math.min(tg.dmg, y.hp) * 3 + danger;
    }
    s += info.bossDmg * 1.2;
  }
  // 体力が へっているほど 団子の 値うちが 高い（まんたんでも 盤を うごかす 手には なる）
  if (info.healRaw) s += info.heal * (P.hp <= Sx.maxHp * 0.45 ? 3.2 : 1.0);
  s += info.coins * (P.coins < 50 ? 0.45 : 0.15);
  s += info.burn.length * 1.5;
  s += info.count * 0.12;
  return s;
}
const POLICIES = {
  smart: (st) => S.searchChains(st, scoreSmart),
  noring: (st) => S.searchChains(st, (info, st2) => info.closed ? -1e9 : scoreSmart(info, st2)),
  long: (st) => S.searchChains(st, (info) => info.count + (info.closed ? 0.5 : 0)),
  random: (st) => {
    // 3〜6つの まっすぐでない 鎖を でたらめに つくる
    for (let tries = 0; tries < 200; tries++) {
      const starts = [];
      for (let i = 0; i < S.N; i++) if (S.canStart(st, i)) starts.push(i);
      const p = [starts[(st.rnd() * starts.length) | 0]];
      const want = 3 + ((st.rnd() * 4) | 0);
      for (let k = 0; k < 12 && p.length < want; k++) {
        const nb = S.neighbors8(p[p.length - 1]).filter(j => S.tryStep(st, p, false, j) === 'add');
        if (!nb.length) break;
        p.push(nb[(st.rnd() * nb.length) | 0]);
      }
      if (p.length >= 3 && S.chainType(st, p)) return { path: p, closed: false };
    }
    return S.searchChains(st, (info) => info.count);
  }
};

function shop(P, shopId, log) {
  const items = D.SHOPS[shopId];
  const Sx = () => S.stats(P);
  const bought = new Set();
  const buy = (k) => {
    const it = D.SHOP_ITEMS[k];
    if (!items.includes(k) || P.coins < it.price || bought.has(k)) return false;
    if (it.once && P.items[k]) return false;
    bought.add(k);
    P.coins -= it.price;
    if (k === 'takoyaki') P.hp = Sx().maxHp;
    else { P.items[k]++; if (k === 'ringoame') P.hp += 3; }
    log.push('buy:' + k);
    return true;
  };
  if (P.hp < Sx().maxHp * 0.6) buy('takoyaki');
  let guard = 0;
  while (guard++ < 6) {
    if (buy('himo')) continue;
    if (buy('hanabidama')) continue;
    if (buy('omen')) continue;
    if (buy('ringoame')) continue;
    if (buy('kingyo') || buy('wataame')) continue;
    break;
  }
  if (P.hp < Sx().maxHp * 0.8) buy('takoyaki');
}

function playBattle(bid, P, policy, seed, rec) {
  let attempt = 0;
  for (;;) {
    attempt++;
    const snap = JSON.parse(JSON.stringify(P));
    const st = S.newBattle(bid, P, seed + attempt * 7777);
    let turns = 0, ringOpp = 0, ringUsed = 0, ringYokaiTurns = 0;
    let hurt = 0, healed = 0, maxChain = 0;
    while (!st.outcome && turns < 120) {
      const rg = S.ringables(st);
      if (rg.length) ringOpp++;
      ringYokaiTurns += S.yokaiList(st).length ? 1 : 0;
      const mv = POLICIES[policy](st);
      if (!mv) { rec.stuck = (rec.stuck || 0) + 1; break; }
      const r = S.fullTurn(st, mv.path, mv.closed);
      if (!r.info.valid) { rec.invalid = (rec.invalid || 0) + 1; break; }
      if (mv.closed) ringUsed++;
      maxChain = Math.max(maxChain, r.info.count);
      for (const e of r.ev) { if (e.e === 'hurt') hurt += e.n; if (e.e === 'heal') healed += e.n; }
      turns++;
    }
    const out = { bid, attempt, outcome: st.outcome || 'timeout', turns, hp: P.hp, maxHp: st.S.maxHp, coins: P.coins,
      gainedCoins: st.gained.coins, friends: st.gained.friends.slice(), defeated: st.gained.defeated, fled: st.gained.fled,
      rings: ringUsed, ringOpp, ringRate: ringYokaiTurns ? ringOpp / ringYokaiTurns : 0, hurt, healed, maxChain };
    rec.battles.push(out);
    if (st.outcome === 'win') return out;
    if (attempt >= 6) return out;
    // まけたら：その戦いの はじめに もどし、体力は 上限の6わりまで もどす
    Object.assign(P, JSON.parse(JSON.stringify(snap)));
    P.friends = JSON.parse(JSON.stringify(st.P.friends));
    P.hp = Math.max(snap.hp, Math.ceil(S.stats(P).maxHp * 0.6));
  }
}

function playRun(policy, seed, opt) {
  opt = opt || {};
  const P = S.newPlayer();
  const rec = { policy, seed, battles: [], log: [] };
  let k = 0;
  for (const area of D.AREAS) {
    for (const node of area.nodes) {
      let n = node;
      if (Array.isArray(node)) {
        const stx = S.stats(P);
        n = (opt.route === 'rest' || (opt.route !== 'elite' && P.hp < stx.maxHp * 0.5)) ? node[1] : node[0];
      }
      if (n === 'rest') { P.hp = S.stats(P).maxHp; rec.log.push('rest'); continue; }
      if (n.startsWith('shop')) { shop(P, n, rec.log); continue; }
      const b = playBattle(n, P, policy, seed * 1000 + (k++) * 13, rec);
      if (b.outcome !== 'win') { rec.fail = n; return rec; }
    }
  }
  rec.clear = true;
  rec.P = P;
  return rec;
}

function summarize(runs) {
  const by = {};
  for (const r of runs) for (const b of r.battles) {
    const o = by[b.bid] || (by[b.bid] = { n: 0, win: 0, lose: 0, turns: 0, hurt: 0, rings: 0, ringRate: 0, coins: 0, friends: 0, maxChain: 0, rareGot: 0, rareTry: 0 });
    o.n++; if (b.outcome === 'win') o.win++; else o.lose++;
    o.turns += b.turns; o.hurt += b.hurt; o.rings += b.rings; o.ringRate += b.ringRate; o.coins += b.gainedCoins; o.friends += b.friends.length;
    o.maxChain = Math.max(o.maxChain, b.maxChain);
    const cfg = D.BATTLES[b.bid];
    if (cfg.rareFirst) { o.rareTry++; if (b.friends.includes(cfg.queue[0])) o.rareGot++; }
  }
  const lines = [];
  lines.push('battle      n  負け  手数  被ダメ  輪/戦  輪が作れた手の割合  小判  ともだち  最長  めずらしい');
  for (const bid of Object.keys(D.BATTLES)) {
    const o = by[bid];
    if (!o) continue;
    lines.push(`${bid.padEnd(8)} ${String(o.n).padStart(4)} ${String(o.lose).padStart(4)}  ${(o.turns / o.n).toFixed(1).padStart(5)}  ${(o.hurt / o.n).toFixed(1).padStart(5)}  ${(o.rings / o.n).toFixed(2).padStart(5)}  ${(100 * o.ringRate / o.n).toFixed(0).padStart(5)}%            ${(o.coins / o.n).toFixed(1).padStart(5)}  ${(o.friends / o.n).toFixed(1).padStart(5)}  ${String(o.maxChain).padStart(4)}  ${o.rareTry ? (o.rareGot + '/' + o.rareTry) : ''}`);
  }
  const clears = runs.filter(r => r.clear).length;
  const turnsTotal = runs.map(r => r.battles.reduce((a, b) => a + b.turns, 0));
  const retries = runs.map(r => r.battles.filter(b => b.outcome !== 'win').length);
  lines.push(`クリア ${clears}/${runs.length}  1周の手数 平均 ${(turnsTotal.reduce((a, b) => a + b, 0) / runs.length).toFixed(0)}  まけ（やりなおし）の回数 平均 ${(retries.reduce((a, b) => a + b, 0) / runs.length).toFixed(2)}  最大 ${Math.max(...retries)}`);
  const sp = {};
  for (const r of runs) if (r.P) for (const k of Object.keys(r.P.friends)) sp[k] = (sp[k] || 0) + 1;
  lines.push('ともだちに なった種類（周回数）: ' + D.SPECIES_ORDER.map(k => `${D.SPECIES[k].name}${sp[k] || 0}`).join(' '));
  return lines.join('\n');
}

if (require.main === module) {
  const which = process.argv[2] || 'smart';
  const n = +(process.argv[3] || 6);
  const route = process.argv[4] || 'auto';
  const pols = which === 'all' ? Object.keys(POLICIES) : [which];
  const out = [];
  for (const pol of pols) {
    const runs = [];
    const t0 = Date.now();
    for (let s = 1; s <= n; s++) runs.push(playRun(pol, s, { route }));
    out.push(`== 方針 ${pol}（${n}周、わかれ道 ${route}、${((Date.now() - t0) / 1000).toFixed(1)}秒）`);
    out.push(summarize(runs));
    out.push('');
  }
  console.log(out.join('\n'));
}
module.exports = { playRun, playBattle, POLICIES, scoreSmart, summarize };
