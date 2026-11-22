// ずらり、砦くずし — ルールだけで全編を回すボット（バランス確認用）
// 使い方: node tools/bot.js [局数] [戦い方 none|one|smart] [組み方 random|smart]
// ボットが知っていること：盤面・魔物・砦・次の手番の予告（画面に出ているものと同じ）。次の回転の出目は知らない。
'use strict';
const Z = require('../js/sim.js');

const N = +(process.argv[2] || 10);
const PLAY = process.argv[3] || 'smart';
const BUILD = process.argv[4] || 'smart';
const VERBOSE = process.argv.includes('-v');

function playTurn(s) {
  const b = s.b;
  Z.spin(s);
  if (PLAY !== 'none') {
    const best = Z.bestShift(s, PLAY === 'one' ? { maxMana: 1 } : {});
    if (best) b.offs = best.offs.slice();
  }
  const res = Z.cast(s);
  if (!b.over) Z.enemyPhase(s);
  return res;
}

// 置き場所：その言葉を置いたら、ずらさずに回したときの平均がどれだけ上がるか（同じ乱数の回転で比べる）
function evalReels(s, stage, spins) {
  const t = Z.clone(s);
  t.rs = 12345;
  Z.startBattle(t, Math.min(stage, Z.FINAL - 1));
  const b0 = Z.clone(t.b);
  let sum = 0;
  for (let k = 0; k < spins; k++) {
    t.b = Z.clone(b0);
    Z.spin(t);
    const res = Z.predict(t);
    sum += Z.score(t, res);
  }
  return sum / spins;
}

const PRIO = ['all', 'x3', 'lance', 'fire', 'storm', 'x2', 'twice', 'burst', 'bolt', 'light', 'sweep', 'ice', 'up', 'down'];
function build(s, rng) {
  // 贈り物
  if (s.gift) {
    let i = 0;
    if (BUILD === 'random') i = Math.floor(rng() * s.gift.opts.length);
    else {
      let bi = 1e9;
      s.gift.opts.forEach((g, j) => { const p = PRIO.indexOf(g[0].k); if (p >= 0 && p < bi) { bi = p; i = j; } });
    }
    Z.takeGift(s, i);
  }
  // 買い物
  for (let guard = 0; guard < 20; guard++) {
    const items = Z.shopList(s).filter(it => it.cost <= s.gold && !it.sold);
    // 鍛える（源のリールの言葉）
    const ups = [];
    s.reels[0].strip.forEach((w, slot) => { const c = Z.upCost(s, w); if (c !== null && c <= s.gold && w.k !== 'sword') ups.push({ slot, c, w }); });
    if (BUILD === 'random') {
      const all = items.length + ups.length;
      if (!all || rng() < 0.25) break;
      const j = Math.floor(rng() * all);
      if (j < items.length) Z.buy(s, items[j].k); else Z.upgrade(s, 0, ups[j - items.length].slot);
      continue;
    }
    if (ups.length && (rng() < 0.5 || !items.length)) { Z.upgrade(s, 0, ups[0].slot); continue; }
    items.sort((a, c) => PRIO.indexOf(a.k) - PRIO.indexOf(c.k));
    if (!items.length) break;
    Z.buy(s, items[0].k);
  }
  // 置く
  for (let guard = 0; guard < 30 && s.inv.length; guard++) {
    const w = s.inv[0];
    const ris = s.reels.map((r, i) => i).filter(i => Z.canPlace(s, w, i));
    if (!ris.length) { s.inv.shift(); continue; }
    if (BUILD === 'random') {
      const ri = ris[Math.floor(rng() * ris.length)];
      Z.place(s, 0, ri, Math.floor(rng() * Z.STRIP));
      continue;
    }
    let best = null;
    const base = evalReels(s, s.stage, 50);
    for (const ri of ris) {
      for (let slot = 0; slot < Z.STRIP; slot++) {
        const t = Z.clone(s);
        Z.place(t, 0, ri, slot);
        const v = evalReels(t, s.stage, 50);
        if (!best || v > best.v) best = { v, ri, slot };
      }
    }
    if (best && best.v > base - 0.01) Z.place(s, 0, best.ri, best.slot);
    else s.inv.shift();
  }
}

const stats = { clear: 0, tries: {}, turns: {}, best: {}, bestDmg: {}, firstTry: {}, total: [], gold: {} };
for (let g = 0; g < N; g++) {
  let seed = 1000 + g * 7919;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const s = Z.newGame(9000 + g * 31);
  let turnsAll = 0;
  while (s.stage <= Z.FINAL) {
    const idx = s.stage;
    let tries = 0, won = false;
    while (!won && tries < 6) {
      tries++;
      Z.startBattle(s, idx);
      let t = 0;
      while (!s.b.over && t < 60) { playTurn(s); t++; }
      turnsAll += t;
      (stats.turns[idx] = stats.turns[idx] || []).push(t);
      const b = s.b;
      (stats.best[idx] = stats.best[idx] || []).push(b.bestKills);
      (stats.bestDmg[idx] = stats.bestDmg[idx] || []).push(b.bestDmg);
      won = b.over === 'win';
      if (VERBOSE) console.log(`g${g} st${idx} try${tries} ${b.over} t=${t} guard=${b.guard} kills=${b.kills} best=${b.bestKills} dmg=${b.bestDmg} gold=${s.gold}`);
      Z.finishBattle(s);
    }
    (stats.tries[idx] = stats.tries[idx] || []).push(tries);
    if (tries === 1) stats.firstTry[idx] = (stats.firstTry[idx] || 0) + 1;
    (stats.gold[idx] = stats.gold[idx] || []).push(s.gold);
    if (!won) break;
    build(s, rng);
  }
  if (s.cleared) stats.clear++;
  stats.total.push(turnsAll);
  if (VERBOSE) console.log('reels:', s.reels.map(r => r.strip.map(w => Z.W[w.k].glyph + (w.lv > 1 ? w.lv : '')).join(' ')).join(' | '));
}
const avg = a => (a && a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-');
console.log(`play=${PLAY} build=${BUILD} games=${N} clear=${stats.clear}/${N} 総手番=${avg(stats.total)}`);
for (let i = 0; i <= Z.FINAL; i++) {
  console.log(`${Z.STAGES[i].name.padEnd(10, '　')} 一発=${(((stats.firstTry[i] || 0) / N) * 100).toFixed(0)}% 挑戦=${avg(stats.tries[i])} 手番=${avg(stats.turns[i])} 一手の最多撃破=${avg(stats.best[i])} 一手の最大ダメージ=${avg(stats.bestDmg[i])}`);
}
