/*
 * ころころ、ひらけ列島 ― ボットで まるごと 遊ばせて、バランスを 見る（検証用）
 *
 *   node tools/sim.js [回数=200] [あなたの方針=smart] [--log]
 *
 * あなた（0番）を 方針（smart / simple / kon / pon）で、ライバル2社は ゲームと同じ CPU で 動かす。
 * ボットが 知るのは ゲームの 画面で わかることと 同じ（地図・持ち物・目的地）。サイコロの 先の目は 知らない。
 */
const path = require('path');
const base = path.join(__dirname, '..', 'js');
for (const f of ['core.js', 'data.js', 'map.js', 'engine.js', 'ai.js']) require(path.join(base, f));
const KR = globalThis.KR, E = KR.E, AI = KR.AI, M = KR.MAP;

const args = process.argv.slice(2);
const N = parseInt(args[0] || '200', 10);
const pol = args[1] || 'smart';
const LOG = args.includes('--log');

function play(seed) {
  const G = E.create(seed);
  E.advance(G);
  const pers = [pol, 'kon', 'pon'];
  const rnd = KR.rng(seed * 7 + 1);
  const info = { opens: [], dests: [], cards: {}, events: 0, sells: 0, tolls: 0, buys: 0, mono: 0, exact: 0, maxOpt: 0, warp: 0, decisions: 0 };
  let guard = 0;
  while (!G.over && guard++ < 20000) {
    const need = G.need;
    if (need.k === 'landing') info.maxOpt = Math.max(info.maxOpt, G.opts.length);
    let d;
    const pp = pers[need.p];
    // 比べるための 方針（あなたの 0番だけ）
    if (need.p === 0 && pp === 'nobuy' && need.k === 'buy') d = { type: 'done' };
    else if (need.p === 0 && pp === 'nocard' && need.k === 'action') d = { type: 'roll' };
    else if (need.p === 0 && pp === 'nodest' && need.k === 'landing') {
      const per = Object.assign({}, AI.PERSONA.smart, { destW: 0 });
      d = { type: 'land', i: AI.pickLanding(G, G.P[0], per) };
    } else d = AI.decide(G, ['nobuy', 'nocard', 'nodest'].indexOf(pp) >= 0 ? 'smart' : pp, rnd);
    info.decisions++;
    E.decide(G, d);
    for (const e of G.ev) {
      if (e.t === 'open') info.opens.push({ turn: G.turn, r: KR.REGIONS[e.r].name, p: e.p });
      if (e.t === 'arrive') { info.dests.push({ turn: G.turn, p: e.p, prize: e.prize, dist: e.dist }); if (e.exact) info.exact++; }
      if (e.t === 'use') info.cards[e.card] = (info.cards[e.card] || 0) + 1;
      if (e.t === 'evres') info.events++;
      if (e.t === 'sell') info.sells++;
      if (e.t === 'move') info.tolls += e.marks.filter((m) => m.kind === 'toll').length;
      if (e.t === 'buy' || e.t === 'takeover') { info.buys++; if (e.mono) info.mono++; }
      if (e.t === 'warp') info.warp++;
      if (LOG && ['arrive', 'open', 'settle', 'over'].includes(e.t)) console.log(KR.turnLabel(G.turn), JSON.stringify(e).slice(0, 200));
    }
    G.ev.length = 0;
  }
  if (!G.over) throw new Error('終わらない seed=' + seed);
  return { G, info };
}

const agg = { win: [0, 0, 0], assets: [[], [], []], dests: [], opens: [], allOpen: 0, openTurnLast: [], exact: 0, sells: 0, tolls: 0, buys: 0, mono: 0, cards: {}, events: 0, maxOpt: 0, destBy: [0, 0, 0], tollIn: [0, 0, 0], income: [0, 0, 0], stamps: [0, 0, 0], decisions: 0 };
const t0 = Date.now();
for (let s = 1; s <= N; s++) {
  const { G, info } = play(s * 1013);
  agg.win[G.rank[0].p]++;
  G.P.forEach((P, i) => {
    agg.assets[i].push(E.assets(G, i)); agg.destBy[i] += P.st.dest; agg.tollIn[i] += P.st.tollIn; agg.income[i] += P.st.income; agg.stamps[i] += P.stamps.length;
  });
  agg.dests.push(info.dests.length);
  agg.opens.push(info.opens.length);
  if (G.open.every((o) => o)) agg.allOpen++;
  if (info.opens.length) agg.openTurnLast.push(info.opens[info.opens.length - 1].turn);
  agg.exact += info.exact; agg.sells += info.sells; agg.tolls += info.tolls; agg.buys += info.buys; agg.mono += info.mono; agg.events += info.events;
  agg.maxOpt = Math.max(agg.maxOpt, info.maxOpt); agg.decisions += info.decisions;
  for (const k in info.cards) agg.cards[k] = (agg.cards[k] || 0) + info.cards[k];
  if (s === 1 && LOG) console.log(info);
}
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
console.log(`方針 ${pol} × ${N} 回（${((Date.now() - t0) / 1000).toFixed(1)} 秒）`);
console.log('1位の回数  あなた/コン/ポン :', agg.win.join(' / '));
console.log('最終資産の中央値（万円）:', agg.assets.map(med).join(' / '));
console.log('目的地 到着回数（1ゲーム平均）:', avg(agg.dests).toFixed(2), ' 会社別:', agg.destBy.map((v) => (v / N).toFixed(2)).join(' / '), ' ぴったり:', (agg.exact / N).toFixed(2));
console.log('ひらいた地方（平均）:', avg(agg.opens).toFixed(2), ' 全部ひらいた:', agg.allOpen + '/' + N, ' 最後に ひらいたターン 中央値:', med(agg.openTurnLast));
console.log('通行料（1ゲーム）:', (agg.tolls / N).toFixed(2), '回  受けとり額 平均:', agg.tollIn.map((v) => Math.round(v / N)).join(' / '));
console.log('決算収入 平均:', agg.income.map((v) => Math.round(v / N)).join(' / '), ' 購入:', (agg.buys / N).toFixed(1), ' 独占:', (agg.mono / N).toFixed(2), ' 売却:', (agg.sells / N).toFixed(2));
console.log('スタンプ 平均:', agg.stamps.map((v) => (v / N).toFixed(1)).join(' / '), ' できごと:', (agg.events / N).toFixed(1), ' 行き先の候補 最大:', agg.maxOpt);
console.log('きっぷ使用（1ゲーム）:', Object.entries(agg.cards).map(([k, v]) => k + ' ' + (v / N).toFixed(2)).join(', '));
console.log('判断の回数（1ゲーム、3社合計）:', (agg.decisions / N).toFixed(0));
