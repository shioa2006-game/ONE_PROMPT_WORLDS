// ずらしでどれだけ結果が変わるかを測る（各戦いの各手番で、ずらさない場合と最善のずらしを比べる）
'use strict';
const Z = require('../js/sim.js');
const N = +(process.argv[2] || 4);
const POL = process.argv[3] || 'smart';
const agg = {};
for (let g = 0; g < N; g++) {
  const s = Z.newGame(777 + g * 13);
  while (s.stage <= Z.FINAL) {
    const idx = s.stage;
    Z.startBattle(s, idx);
    const a = agg[idx] || (agg[idx] = { n: 0, d0: 0, d1: 0, k0: 0, k1: 0, gl0: 0, gl1: 0, better: 0, guardLost: 0, turns: 0 });
    let t = 0;
    while (!s.b.over && t < 60) {
      Z.spin(s);
      const r0 = Z.predict(s);
      const best = Z.bestShift(s);
      s.b.offs = best.offs.slice();
      const r1 = Z.predict(s);
      a.n++; a.d0 += r0.dmg; a.d1 += r1.dmg; a.k0 += r0.kills + r0.fled; a.k1 += r1.kills + r1.fled; a.gl0 += r0.guardLoss; a.gl1 += r1.guardLoss;
      if (Z.score(s, r1) > Z.score(s, r0) + 3) a.better++;
      if (POL === 'none') s.b.offs = s.b.offs.map(() => 0);
      const g0 = s.b.guard;
      Z.cast(s);
      if (!s.b.over) Z.enemyPhase(s);
      a.guardLost += g0 - s.b.guard;
      t++;
    }
    a.turns += t;
    Z.finishBattle(s);
    if (s.stage === idx) break;
    // 組み方は簡単に：持ち物を空きへ
    if (s.gift) Z.takeGift(s, 0);
    for (const it of Z.shopList(s)) if (it.cost <= s.gold) Z.buy(s, it.k);
    while (s.inv.length) {
      const w = s.inv[0];
      const ri = s.reels.findIndex((r, i) => Z.canPlace(s, w, i));
      if (ri < 0) { s.inv.shift(); continue; }
      const r = s.reels[ri];
      let slot = r.strip.findIndex(x => x.k !== w.k && (Z.W[x.k].blank || (x.k === 'sword' && x.lv === 1)));
      if (slot < 0) { s.inv.shift(); continue; }
      Z.place(s, 0, ri, slot);
    }
  }
}
for (const k of Object.keys(agg)) {
  const a = agg[k];
  console.log(`${Z.STAGES[k].name.padEnd(9, '　')} 手番${(a.turns / N).toFixed(1)} 平均ダメージ ずらさない${(a.d0 / a.n).toFixed(1)}→最善${(a.d1 / a.n).toFixed(1)}  撃破 ${(a.k0 / a.n).toFixed(1)}→${(a.k1 / a.n).toFixed(1)}  次の被害 ${(a.gl0 / a.n).toFixed(2)}→${(a.gl1 / a.n).toFixed(2)}  ずらすと明らかに良い手番 ${((a.better / a.n) * 100).toFixed(0)}%  守りの損失/戦 ${(a.guardLost / N).toFixed(1)}`);
}
