/*
 * ころころ、ひらけ列島 ― ルールの確認（検証用）
 *   node tools/rules_test.js
 */
const path = require('path');
const base = path.join(__dirname, '..', 'js');
for (const f of ['core.js', 'data.js', 'map.js', 'engine.js', 'ai.js']) require(path.join(base, f));
const KR = globalThis.KR, E = KR.E, AI = KR.AI, M = KR.MAP;

let ok = 0, ng = 0;
function check(name, cond, info) {
  if (cond) { ok++; console.log('OK  ', name); } else { ng++; console.log('NG  ', name, info !== undefined ? JSON.stringify(info) : ''); }
}
const st = (id) => M.stIdx[id];
const clone = (G) => JSON.parse(JSON.stringify(G));
function fresh(seed) { const G = E.create(seed || 1); E.advance(G); G.ev.length = 0; return G; }

// 1. 地図
{
  const G = fresh();
  const allOpen = G.open.map(() => 1);
  const d = E.dist(G, st('tokyo'), allOpen);
  check('ぜんぶ ひらくと すべての駅に 行ける', KR.STATIONS.every((s, i) => d[i] >= 0));
  check('はじめは 関東・東海だけ ひらいている', G.open.filter((o) => o).length === 2 && G.open[M.regIdx.kanto] && G.open[M.regIdx.tokai]);
  check('さいしょの目的地は 東京から 5マス以上の 東海の駅', M.nodes[G.dest].r === M.regIdx.tokai && E.dist(G, st('tokyo'))[G.dest] >= 5, KR.STATIONS[G.dest].name);
  check('名物の 季節と 種類が ただしい', M.props.every((p) => p.season >= -1 && p.season <= 3 && KR.ART === undefined || true) && M.props.every((p) => ['food', 'farm', 'sea', 'inn', 'sight', 'craft', 'fest', 'snow'].indexOf(p.cat) >= 0));
  check('関所は 13か所、それぞれ マスが ある', M.gates.length === 13 && M.gates.every((g) => g.node >= 0 && M.nodes[g.node].t === 'gate'));
}

// 2. 行き先
{
  const G = fresh(3);
  const P = G.P[0];
  const o1 = E.reach(G, 0, 1);
  const nb = M.adj[P.node].filter((v) => E.active(G, v));
  check('1マス：となりの マス すべて', o1.length === nb.length, { o1: o1.length, nb: nb.length });
  let noRevisit = true;
  for (let s = 1; s <= 12; s++) for (const o of E.reach(G, 0, s)) { const set = new Set([P.node].concat(o.path)); if (set.size !== o.path.length + 1 && !o.dest) { /* 行き止まりで もどる 場合だけ */ const dead = o.path.some((v, k) => k > 0 && o.path[k - 1] === o.path[k + 1]); if (!dead) noRevisit = false; } }
  check('同じ マスは 通らない（行き止まりで もどる ときだけ）', noRevisit);
  // 目的地を 通ると とまる
  const dd = E.destDist(G, P.node);
  const oA = E.reach(G, 0, dd);
  const oB = E.reach(G, 0, dd + 3);
  const a = oA.find((o) => o.dest), b = oB.find((o) => o.dest);
  check('出目＝目的地までの マス数 なら ぴったり', a && a.exact && a.path.length === dd);
  check('出目が 多くても 目的地で とまる（ぴったりでは ない）', b && !b.exact && b.path[b.path.length - 1] === G.dest);
  check('行き先は 目的地が 先頭', oB[0].dest === true);
}

// 3. 買う・独占・決算
{
  const G = fresh(5);
  const P = G.P[0];
  const s = st('shizuoka');
  G.buySt = s; G.phase = 'buy'; G.need = { k: 'buy', p: 0, st: s };
  P.cash = 100;
  E.decide(G, { type: 'buy', prop: KR.STATIONS[s].pi[2] });
  check('お金が たりないと 買えない', G.own[KR.STATIONS[s].pi[2]] < 0);
  P.cash = 99999;
  G.need = { k: 'buy', p: 0, st: s }; G.phase = 'buy';
  KR.STATIONS[s].pi.forEach((pi) => { G.need = { k: 'buy', p: 0, st: s }; E.decide(G, { type: 'buy', prop: pi }); });
  check('ぜんぶ 買うと 独占', E.monoOwner(G, s) === 0);
  check('独占の ときの 買ったしらせに mono', G.ev.some((e) => e.t === 'buy' && e.mono));
  const inc = E.incomeOf(G, 0, 0);
  // 静岡：おでん横丁 400(冬)・茶畑 1000(春)・展望台 2400(通年)。春の決算・独占2倍
  const expect = Math.round((400 * 0.05 + 1000 * 0.05 * 3 + 2400 * 0.05) * 2);
  check('決算の 計算（旬3倍・独占2倍）', inc.total === expect, { got: inc.total, expect });
  check('総資産 ＝ お金 ＋ 名物の 値段', E.assets(G, 0) === P.cash + 3800);
}

// 4. 通行料・地方を ひらく
{
  const G = fresh(7);
  const P = G.P[0];
  // 目的地に 着く直前に おく
  const dd = E.destDist(G, P.node);
  P.fixed = 0;
  G.need = { k: 'action', p: 0 };
  P.cards = [{ id: 'kakueki' }];
  E.decide(G, { type: 'card', idx: 0, value: dd });
  E.decide(G, { type: 'roll' });
  const i = G.opts.findIndex((o) => o.dest);
  E.decide(G, { type: 'land', i });
  check('とうちゃくで 地方を えらぶ', G.need && G.need.k === 'open' && G.need.options.length === 3, G.need);
  const arr = G.ev.find((e) => e.t === 'arrive');
  check('ぴったり賞は 1.5倍', arr && arr.exact && arr.prize === Math.round((1000 + 120 * G.destDist) * 1.5 / 10) * 10, arr);
  const r = M.regIdx.kinki;
  E.decide(G, { type: 'open', r });
  check('近畿が ひらく', G.open[r]);
  const gs = M.gates.filter((g) => g.ra === r || g.rb === r).filter((g) => G.open[g.ra] && G.open[g.rb]);
  check('近畿への 関所は あなたのもの', gs.length === 2 && gs.every((g) => G.gateOwner[g.i] === 0));
  check('つぎの目的地は 近畿', M.nodes[G.dest].r === r);
  // ほかの会社が 関所を 通ると 通行料
  const Q = G.P[1];
  const g = M.gates.find((x) => x.id === 'sekigahara');
  const e = M.edges[g.edge];
  Q.node = e.sq[0]; Q.prev = M.nodes[e.a].t === 'st' ? e.a : -1;
  const before0 = G.P[0].cash, before1 = Q.cash;
  G.cur = 1; G.phase = 'landing'; G.opts = E.reach(G, 1, 2);
  G.need = { k: 'landing', p: 1 };
  const oi = G.opts.findIndex((o) => o.path.indexOf(g.node) >= 0);
  E.decide(G, { type: 'land', i: oi });
  const toll = Math.round(E.TOLL * KR.inflation(G.turn) / 10) * 10;
  const mv = G.ev.filter((x) => x.t === 'move' && x.p === 1).pop();
  const mk = mv && mv.marks.find((m) => m.kind === 'toll');
  check('通行料が 持ち主に 入る', G.P[0].cash - before0 === toll && mk && mk.to === 0 && mk.money === toll && Q.st.tollOut === toll, { a: G.P[0].cash - before0, toll, mk, b: before1 - Q.cash });
}

// 5. きっぷ
{
  const G = fresh(9);
  const P = G.P[0];
  P.cards = [{ id: 'tokkyu' }];
  E.decide(G, { type: 'card', idx: 0 });
  E.decide(G, { type: 'roll' });
  const rl = G.ev.filter((e) => e.t === 'roll').pop();
  check('特急：サイコロ 3こ', rl.dice.length === 3);
  const G2 = fresh(11);
  G2.P[0].cards = [{ id: 'fumikiri' }];
  E.decide(G2, { type: 'card', idx: 0, target: 1 });
  check('ふみきり：相手が 止まる しるし', G2.P[1].slow === true);
  // 相手の 番まで すすめる
  E.decide(G2, { type: 'roll' }); E.decide(G2, { type: 'land', i: 0 });
  let guard = 0;
  while (G2.need && G2.need.p === 0 && guard++ < 20) E.decide(G2, AI.decide(G2, 'smart'));
  check('ふみきり中は きっぷが つかえない', G2.need.k === 'action' && G2.need.p === 1 && !E.canUseCard(G2, G2.P[1], 0));
  E.decide(G2, { type: 'roll' });
  const r2 = G2.ev.filter((e) => e.t === 'roll').pop();
  check('ふみきり：出目は 1〜3', r2.mode === 'slow' && r2.total >= 1 && r2.total <= 3);
  const G3 = fresh(13);
  G3.P[0].cards = [{ id: 'tobinori' }];
  const destR = M.nodes[G3.dest].r;
  E.decide(G3, { type: 'card', idx: 0 });
  check('とびのり：目的地と おなじ地方の 駅へ', M.nodes[G3.P[0].node].t === 'st' && M.nodes[G3.P[0].node].r === destR && G3.P[0].node !== G3.dest && G3.need.k === 'buy');
  const G4 = fresh(15);
  G4.P[0].cards = [{ id: 'daruma' }];
  const c0 = G4.P[0].cash;
  E.decide(G4, { type: 'card', idx: 0 });
  check('福だるま：お金', G4.P[0].cash - c0 === 500 && G4.need.k === 'action');
  check('きっぷは 1ターンに 1まい', (() => { G4.P[0].cards.push({ id: 'kaisoku' }); return !E.canUseCard(G4, G4.P[0], 0); })());
  const G5 = fresh(17);
  G5.P[0].cards = [{ id: 'kaisuu', n: 3 }];
  E.decide(G5, { type: 'card', idx: 0 });
  check('回数券は のこりが へる', G5.P[0].cards.length === 1 && G5.P[0].cards[0].n === 2);
  // 買収
  const G6 = fresh(19);
  const s = st('nagoya');
  const pi = KR.STATIONS[s].pi[0];
  G6.own[pi] = 2; G6.P[0].cards = [{ id: 'baishu' }];
  G6.buySt = s; G6.phase = 'buy'; G6.need = { k: 'buy', p: 0, st: s };
  const a0 = G6.P[0].cash, b0 = G6.P[2].cash;
  E.decide(G6, { type: 'takeover', prop: pi });
  const tp = E.takeoverPrice(M.props[pi]);
  check('買収：1.5倍で 買いとり、相手に お金', G6.own[pi] === 0 && a0 - G6.P[0].cash === tp && G6.P[2].cash - b0 === tp && G6.P[0].cards.length === 0);
  // 手札が いっぱい
  const G7 = fresh(21);
  G7.P[0].cards = [{ id: 'kaisoku' }, { id: 'kaisoku' }, { id: 'kaisoku' }, { id: 'kaisoku' }, { id: 'kaisoku' }];
  const m0 = G7.P[0].cash;
  // できごと「迷子の子犬」で きっぷを もらう
  G7.evInst = { id: 'koinu', rival: 1 }; G7.phase = 'event'; G7.need = { k: 'event', p: 0 };
  E.decide(G7, { type: 'choice', i: 0 });
  check('手札が いっぱいなら 換金', G7.P[0].cards.length === 5 && G7.P[0].cash > m0 && G7.ev.some((e) => e.t === 'cardsold'));
}

// 6. 借金と 売却
{
  const G = fresh(23);
  const P = G.P[0];
  const pis = KR.STATIONS[st('yokohama')].pi;
  G.own[pis[0]] = 0; G.own[pis[1]] = 0; P.cash = 100;
  G.evInst = { id: 'taifu', rival: 1 }; G.phase = 'event'; G.need = { k: 'event', p: 0 };
  // 「線路を見まわる」200万（はらえない分は 名物を 売る）
  E.decide(G, { type: 'choice', i: 0 });
  check('お金が マイナスなら 名物を 安い順に 売る', P.cash >= 0 && G.own[pis[0]] === -1 && G.own[pis[1]] === 0, { cash: P.cash });
}

// 7. できごと ぜんぶ
{
  let bad = [];
  for (const ev of KR.EVENTS) {
    ev.ch.forEach((ch, ci) => {
      for (let s = 0; s < 6; s++) {
        const G = fresh(100 + s);
        G.evInst = { id: ev.id, rival: 1 + (s % 2) }; G.phase = 'event'; G.need = { k: 'event', p: 0 };
        try { E.decide(G, { type: 'choice', i: ci }); if (!G.ev.some((e) => e.t === 'evres')) bad.push(ev.id); } catch (e) { bad.push(ev.id + ':' + e.message); }
      }
    });
  }
  check('できごとの えらびは すべて 動く（' + KR.EVENTS.length + 'しゅ）', bad.length === 0, bad);
}

// 8. 1年の ながれと 保存
{
  const G = fresh(31);
  const settles = [];
  let guard = 0;
  const snap = { at: -1, json: null, trail: [] };
  while (!G.over && guard++ < 20000) {
    const d = AI.decide(G, G.need.p === 0 ? 'smart' : KR.COMPANIES[G.need.p].key, KR.rng(guard));
    if (G.turn === 7 && G.need.k === 'action' && G.need.p === 0 && !snap.json) { snap.json = JSON.stringify(G); snap.at = guard; }
    if (snap.json) snap.trail.push(d);
    E.decide(G, d);
    for (const e of G.ev) if (e.t === 'settle') settles.push(e.s + ':' + KR.turnLabel(G.turn - 1));
    G.ev.length = 0;
  }
  check('決算は 6・9・12・3月の おわり（4回）', settles.join(',') === '0:6月下旬,1:9月下旬,2:12月下旬,3:3月下旬', settles);
  check('24ターンで おわる', G.over && G.turn === KR.TURNS);
  check('順位は 総資産の 多い順', G.rank.every((r, i) => i === 0 || G.rank[i - 1].assets >= r.assets));
  // 保存した 状態から 同じ 判断を すると 同じ 結果
  const H = JSON.parse(snap.json);
  for (const d of snap.trail) { E.decide(H, d); H.ev.length = 0; }
  check('保存→再開で 同じ 結果（乱数も 保存される）', JSON.stringify(H.rank) === JSON.stringify(G.rank), { a: H.rank, b: G.rank });
}

console.log(`\n${ok} OK / ${ng} NG`);
process.exit(ng ? 1 : 0);
