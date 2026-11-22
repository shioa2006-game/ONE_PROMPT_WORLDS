// くるり、呪いほどき — ルールだけで全編を回すボット
//   node tools/bot.js [回数] [戦い方] [組み方] [-v]
// 戦い方：none（ずらさない） / one（魔力を使うのは1コマまで） / smart（魔力の範囲で全組み合わせを試して最善）
// 組み方：random（買うものも置き場所も適当） / smart（G.suggestBuy・G.suggestPlace：ランダムな回転を120回ためして、
//         つながりが大きく出る場所に置く）
// ボットは盤面と魔物の予定をすべて知っている。次の回転の出目は知らない。固定は使わない。
'use strict';
global.RR = require('../js/sim.js');
global.RRD = require('../js/data.js');
const RG = require('../js/game.js');
const RR = global.RR, D = global.RRD;

const N = +(process.argv[2] || 20);
const BATTLE = process.argv[3] || 'smart';
const BUILD = process.argv[4] || 'smart';
const VERBOSE = process.argv.includes('-v');

function rngOf(seed) { let x = seed | 0 || 1; return () => { x = (Math.imul(x, 1103515245) + 12345) & 0x7fffffff; return x / 0x7fffffff; }; }

function workshop(s, rng, g) {
  if (s.gifts) RG.pickGift(s, BUILD === 'smart' ? 0 : Math.floor(rng() * s.gifts.length));
  RR.clearFresh(s);
  let guard = 0;
  while (guard++ < 40) {
    if (BUILD === 'smart') {
      const a = RG.suggestBuy(s, rng);
      if (!a) break;
      if (a.kind === 'mp') RG.buyMp(s);
      else if (a.kind === 'regen') RG.buyRegen(s);
      else if (a.kind === 'up') RG.upgradeCell(s, a.r, a.k);
      else if (a.kind === 'buy') RG.buy(s, a.t);
    } else {
      const can = s.shop.filter(t => s.coins >= D.PRICE[t]);
      if (!can.length) break;
      RG.buy(s, can[Math.floor(rng() * can.length)]);
    }
  }
  while (s.inv.length) {
    if (BUILD === 'smart') {
      const p = RG.suggestPlace(s, 99 + g * 13 + s.stage);
      if (!p) break;
      RR.place(s, p.ii, p.r, p.k);
    } else {
      const blanks = [];
      s.reels.forEach((rl, r) => rl.strip.forEach((c, k) => { if (c.t === 'blank') blanks.push([r, k]); }));
      if (!blanks.length) break;
      const [r, k] = blanks[Math.floor(rng() * blanks.length)];
      RR.place(s, 0, r, k);
    }
  }
}

function playBattle(s, st) {
  const b = s.b;
  let guard = 0;
  while (!b.over && guard++ < 200) {
    RR.spin(s);
    if (BATTLE !== 'none') {
      const best = RR.bestShift(s, BATTLE === 'one' ? { budget: Math.min(1, b.mp) } : {});
      if (best) b.offs = best.offs.slice();
    }
    const res = RR.cast(s);
    const n = res.purified.length + res.after.length;
    if (n > st.bestCast) st.bestCast = n;
    if (res.totalDmg > st.bestDmg) st.bestDmg = res.totalDmg;
    if (b.over) break;
    RR.advance(s);
  }
  return b.over;
}

const stats = D.STAGES.map(() => ({ first: 0, tries: 0, rescued: 0, total: 0, turns: 0, wins: 0, bestCast: 0, bestDmg: 0, sumBest: 0 }));
let clears = 0;
const fills = [];
for (let g = 0; g < N; g++) {
  const s = RG.newGame(1000 + g * 7);
  const rng = rngOf(77 + g);
  let attempts = 0;
  while (s.stage < D.STAGES.length && attempts < 40) {
    attempts++;
    const si = s.stage, def = D.STAGES[si];
    RG.startStage(s);
    const total = s.b.sched.length + s.b.mons.length;
    const st = { bestCast: 0, bestDmg: 0 };
    const r = playBattle(s, st);
    const x = stats[si];
    x.tries++;
    if (r === 'win') {
      if (!s.fails[def.id]) x.first++;
      const fin = s.b.finale ? s.b.finale.rescued : 0;
      x.wins++; x.rescued += s.b.rescued - fin; x.total += total; x.turns += s.b.turn;
      if (s.b.finale) { x.fin = (x.fin || 0) + fin; x.finBest = Math.max(x.finBest || 0, s.b.finale.best); }
      x.sumBest += st.bestCast;
    }
    x.bestCast = Math.max(x.bestCast, st.bestCast); x.bestDmg = Math.max(x.bestDmg, st.bestDmg);
    if (VERBOSE) console.log(g, def.id, r, 'turn', s.b.turn, 'rescued', s.b.rescued + '/' + total, 'best', st.bestCast, 'coins', s.coins, 'mp', s.mpMax + '+' + s.mpRegen);
    RG.finishBattle(s);
    if (s.phase !== 'ending') workshop(s, rng, g);
  }
  if (s.stage >= D.STAGES.length) clears++;
  const filled = s.reels.reduce((a, rl) => a + rl.strip.filter(c => c.t !== 'blank').length, 0);
  fills.push(filled + '/' + s.reels.length * 8);
  if (VERBOSE) console.log('reels', s.reels.map(r => r.strip.map(c => (c.t === 'blank' ? '_' : c.t[0]) + (c.lv > 1 ? c.lv : '')).join('')).join(' | '));
}
console.log(`戦い方=${BATTLE} 組み方=${BUILD} ${N}局`);
D.STAGES.forEach((st, i) => {
  const x = stats[i];
  const rate = x.total ? x.rescued / x.total : 0;
  const finTxt = x.fin ? `  大詠唱で救った人 平均${(x.fin / Math.max(1, x.wins)).toFixed(1)}/45` : '';
  console.log(`${st.id.padEnd(3)} 一発成功 ${(100 * x.first / N).toFixed(0).padStart(3)}%  挑戦/局 ${(x.tries / N).toFixed(2)}  救出率(大詠唱を除く) ${(100 * rate).toFixed(0).padStart(3)}%  手番 ${(x.turns / Math.max(1, x.wins)).toFixed(1).padStart(4)}  一手の最多 平均${(x.sumBest / Math.max(1, x.wins)).toFixed(1)} 最大${x.bestCast}  一手の最大ほどき ${x.bestDmg}${finTxt}`);
});
console.log(`クリア ${clears}/${N}  最後のリールの埋まり ${fills.slice(0, 5).join(' ')}`);
