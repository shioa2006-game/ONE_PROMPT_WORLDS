/*
 * ひゅるり、凧びより ― 育ちの上限しらべ（検証用）
 * 区間ごとに「その区間で まきこめるものを ちいさい順に ぜんぶ まきこんだら どこまで育つか」を計算する。
 *   nobreak … こわさない（入れものは じぶんより ちいさくなったら まるごと）
 *   break   … こわせるものは こわして なかみも まきこむ
 * 位置や移動は 考えない（上限の めやす）。
 */
const path = require('path');
for (const f of ['core.js', 'data.js', 'world.js', 'sim.js']) require(path.join(__dirname, '..', 'js', f));
const TJ = globalThis.TJ, TY = TJ.TYPES;
const sim = new TJ.Sim();
const zones = { 1: [], 2: [], 3: [], 4: [], 5: [] };
for (const o of sim.W.objs) zones[sim.zoneAt(o.x, o.y)].push(o);
// 木の み と からすの もちもの も たす
for (const tr of sim.W.trees) if (tr.fruit) { const z = sim.zoneAt(tr.x, tr.y); for (let i = 0; i < tr.fruitN; i++) zones[z].push({ t: tr.fruit, s: TY[tr.fruit].s, fruit: 1 }); }
const gain = (t, s) => TJ.GROW * TJ.ZONE_MUL[TY[t].z] * TY[t].w * s * s;
function maxS(start, list, useBreak) {
  let S = start;
  const items = [];
  for (const o of list) {
    const ty = TY[o.t];
    if (ty.k === 'break' && useBreak) {
      items.push({ s: ty.min, open: o });
    } else if (!o.fruit || useBreak) items.push({ s: o.s, t: o.t });
  }
  items.sort((a, b) => a.s - b.s);
  let changed = true;
  const used = new Set();
  while (changed) {
    changed = false;
    for (let i = 0; i < items.length; i++) {
      if (used.has(i)) continue;
      const it = items[i];
      if (it.s > S) break;
      used.add(i); changed = true;
      if (it.open) {
        for (const [t, n] of TY[it.open.t].drops) for (let k = 0; k < n; k++) items.push({ s: TY[t].s, t });
        if (it.open.content) items.push({ s: TY[it.open.content].s, t: it.open.content });
        items.sort((a, b) => a.s - b.s); used.clear(); // 並べなおし（かんたんのため最初から）
        return maxS(S, list.filter(o => o !== it.open).concat(TY[it.open.t].drops.flatMap(([t, n]) => Array(n).fill({ t, s: TY[t].s }))), useBreak);
      }
      S = Math.sqrt(S * S + gain(it.t, it.s));
    }
  }
  return S;
}
const starts = { 1: 5, 2: 30, 3: 140, 4: 450, 5: 1100 };
const reqs = TJ.KITES.map(k => k.req);
for (const z of [1, 2, 3, 4, 5]) {
  const a = maxS(starts[z], zones[z], false), b = maxS(starts[z], zones[z], true);
  console.log('その' + z, '開始', starts[z], '凧', reqs[z - 1], '→ こわさない上限', a.toFixed(0), '／ こわす上限', b.toFixed(0), '（' + zones[z].length + 'こ）');
}
