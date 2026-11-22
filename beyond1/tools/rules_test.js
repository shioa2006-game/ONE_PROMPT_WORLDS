/* 賽駆け 天下 — ルールの自動確認（node tools/rules_test.js） */
'use strict';
const E = require('../js/engine.js');
const AI = require('../js/ai.js');
const R = E.R;
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('NG:', msg); } }
const N = r => E.nodeOf(r);
const P = id => E.PI[id];

// 盤面をほぼ空にする（指定した国だけ持ち主あり・軍勢なし）。持ち主のいない国は「誰でもない城」
function blank(player, owners) {
  const s = E.newGame(player || 'oda', 1);
  s.armies = [];
  s.owner = s.owner.map(() => 'kono');      // 遠くの小大名で埋める（滅亡判定を避ける）
  for (const k in owners || {}) s.owner[P(k)] = owners[k];
  s.kok = E.BASEK.slice(); s.kp = s.kp.map(() => 0); s.fort = s.fort.map(() => 0); s.fp = s.fp.map(() => 0);
  for (let p = 0; p < E.P; p++) s.gar[p] = E.garMax(s, p, s.owner[p]);
  s.turn = 0; s.cur = player || 'oda'; s.phase = 'move';
  for (const c in s.clans) s.clans[c].alive = true;
  return s;
}
function army(s, c, ref, t) { const a = { id: s.aid++, c, n: N(ref), t, mv: false }; s.armies.push(a); return a; }
function dice(s, vals) { s.dice = vals.map(v => ({ v, u: false })); s.phase = 'move'; }

// 1. データと盤面
{
  ok(E.P === 85, '85 provinces');
  ok(E.DATA.CLANS.length === 59 && E.DATA.CLANS.filter(c => c.major).length === 15, '59 clans, 15 majors');
  const seen = new Set([0]), st = [0];
  while (st.length) { const u = st.pop(); for (const v of E.adj[u]) if (!seen.has(v)) { seen.add(v); st.push(v); } }
  ok(seen.size === E.N, 'graph connected (with sea lanes)');
  ok(E.nodes.filter(n => n.kind === 'b').every(n => E.adj[n.i].length === 2), 'border has two sides');
  const s = E.newGame('oda', 3);
  ok(s.owner.every(o => !!o), 'every province has a real clan at start');
  ok(E.DATA.CLANS.every(c => E.armiesOf(s, c.id).length >= 1), 'every clan starts with an army');
  ok(E.DATA.CLANS.find(c => c.id === 'oda').major, 'oda is selectable');
}

// 2. 歩数：街道1、峠2、冬の峠3、雪国の街道は冬2、海路2、武田は峠1、伊達は冬の追加なし
{
  const s = blank('oda', { owari: 'oda', mino: 'oda', hida: 'oda' });
  const a = army(s, 'oda', 'owari', 5);
  let r = E.reach(s, a, 6);
  ok(r.dist[N('owari-mino')] === 1 && r.dist[P('mino')] === 2, 'road costs 1 per node');
  ok(r.dist[N('mino-hida')] === 4, 'pass costs 2');
  s.turn = 3;
  r = E.reach(s, a, 6);
  ok(r.dist[N('mino-hida')] === 5, 'winter pass costs 3');
  const s2 = blank('takeda', { kai: 'takeda' }); s2.turn = 3; s2.cur = 'takeda';
  const t = army(s2, 'takeda', 'kai', 5);
  ok(E.reach(s2, t, 6).dist[N('kai-suruga')] === 1, 'takeda crosses pass in 1 even in winter');
  const s3 = blank('uesugi', { echigo: 'uesugi', kitaechigo: 'uesugi' }); s3.cur = 'uesugi';
  const u = army(s3, 'uesugi', 'echigo', 5);
  ok(E.reach(s3, u, 6).dist[N('echigo-kitaechigo')] === 1, 'snowy road 1 in spring');
  s3.turn = 3;
  ok(E.reach(s3, u, 6).dist[N('echigo-kitaechigo')] === 2, 'snowy road 2 in winter');
  ok(E.reach(s3, u, 6).dist[N('echigo-sado')] === 3, 'sea 3 in winter');
  const s4 = blank('date', { okitama: 'date', shinobu: 'date' }); s4.cur = 'date'; s4.turn = 3;
  const d = army(s4, 'date', 'okitama', 5);
  ok(E.reach(s4, d, 6).dist[N('okitama-shinobu')] === 2, 'date: winter pass costs only 2');
}

// 3. 敵の隣で足が止まる。他家の城の先へは進めない
{
  const s = blank('oda', { owari: 'oda', mikawa: 'oda', totomi: 'oda' });
  const a = army(s, 'oda', 'owari', 6);
  army(s, 'imagawa', 'mikawa-minamishinano', 5);
  const r = E.reach(s, a, 6);
  ok(r.dist[P('mikawa')] === 2, 'can enter castle adjacent to enemy');
  ok(r.dist[N('mikawa-totomi')] === Infinity, 'cannot pass through ZOC node');
  ok(r.attacks.some(x => x.t === N('mikawa-minamishinano')), 'can attack enemy from ZOC node');
  ok(r.dist[P('ise')] === Infinity, 'other clan castle blocks passage');
}

// 4. 城攻めは手番のはじめに城の隣にいる軍勢だけ
{
  const s = blank('oda', { owari: 'oda', mino: 'saito' });
  const a = army(s, 'oda', 'owari', 7);
  let r = E.reach(s, a, 6);
  ok(!r.attacks.some(x => x.t === P('mino')), 'cannot siege from two steps away');
  a.n = N('owari-mino');
  r = E.reach(s, a, 3);
  const at = r.attacks.find(x => x.t === P('mino'));
  ok(at && at.cost === 1 && at.left === 2, 'siege from adjacent node: cost 1, momentum = left');
}

// 5. 合戦：勢い・奇襲・加勢・家風（国崩し・軍神）
{
  const s = blank('oda', { owari: 'oda', mino: 'saito' });
  const a = army(s, 'oda', 'owari-mino', 6);
  const pv = E.preview(s, a, P('mino'), 3);
  ok(pv.A.total === 6 + 3, 'attack = troops + momentum');
  ok(pv.D.total === s.gar[P('mino')] + E.castleDef(s, P('mino'), 'saito'), 'empty castle defense = garrison + castle');
  const pk = E.preview(s, a, P('mino'), 0);
  ok(pk.kishu && (pk.p === 0 || pk.p === 1), 'kishu: no defender die');
  army(s, 'oda', 'mino-hida', 4);
  ok(E.preview(s, a, P('mino'), 3).A.total === 6 + 3 + 2, 'support +2');
  const s2 = blank('otomo', { bungo: 'otomo', higo: 'aso' }); s2.cur = 'otomo';
  const o = army(s2, 'otomo', 'bungo-higo', 6);
  ok(E.preview(s2, o, P('higo'), 2).A.parts.some(p => p[0] === '国崩し' && p[1] === 2), 'otomo cannon +2 vs castle');
  ok(E.castleDef(s2, P('higo'), 'aso') === E.DATA.PROV[P('higo')].d, 'minor clan castle: no capital/last-stand bonus');
  const s3 = blank('oda', { owari: 'oda' });
  ok(E.castleDef(s3, P('owari'), 'oda') === E.DATA.PROV[P('owari')].d + R.capitalDef + R.lastStand, 'major last castle: capital +1 and last stand +2');
}

// 6. 内政：徴兵
{
  const s = blank('oda', { owari: 'oda' });
  const a = army(s, 'oda', 'owari', 4);
  dice(s, [1, 6]);
  const pv = E.governPreview(s, a, 'recruit', 1);
  const g = R.recruitBase + Math.floor(s.kok[P('owari')] / R.recruitDiv);
  ok(pv.ok && pv.gain === g, 'recruit gain = 2 + kok/2 (any die)');
  ok(E.governPreview(s, a, 'recruit', 6).gain === g, 'recruit does not depend on die');
  const ev = E.govern(s, a.id, 0, 'recruit');
  ok(ev && a.t === 4 + g && a.mv && a.dom === 'recruit' && s.dice[0].u, 'recruit applies, army acted, die used');
  ok(E.govern(s, a.id, 1, 'develop') === null, 'army cannot act twice');
  const s2 = blank('oda', { owari: 'oda' }); s2.turn = 2;
  const a2 = army(s2, 'oda', 'owari', 2);
  ok(E.governPreview(s2, a2, 'recruit', 3).gain === g + 1, 'autumn recruit +1');
  const s3 = blank('chosokabe', { tosa: 'chosokabe' }); s3.cur = 'chosokabe';
  const c3 = army(s3, 'chosokabe', 'tosa', 2);
  ok(E.governPreview(s3, c3, 'recruit', 3).gain === R.recruitBase + Math.floor(s3.kok[P('tosa')] / 2) + 2, 'ichiryo +2');
  const a4 = army(s, 'oda', 'owari-mino', 3);
  ok(!E.governPreview(s, a4, 'recruit', 3).ok, 'cannot govern outside own castle');
  const s5 = blank('oda', { owari: 'oda' });
  const a5 = army(s5, 'oda', 'owari', R.armyMax);
  ok(!E.governPreview(s5, a5, 'recruit', 3).ok, 'full army cannot recruit');
}

// 7. 内政：開墾と築城
{
  const s = blank('oda', { owari: 'oda' });
  const a = army(s, 'oda', 'owari', 6);
  const k0 = s.kok[P('owari')];
  dice(s, [3]);
  E.govern(s, a.id, 0, 'develop');
  ok(s.kok[P('owari')] === k0 && s.kp[P('owari')] === 3, 'develop accumulates die value');
  a.mv = false; dice(s, [4]);
  E.govern(s, a.id, 0, 'develop');
  ok(s.kok[P('owari')] === k0 + 1 && s.kp[P('owari')] === 3 + 4 - R.devNeed0, 'develop levels up at need, carries over');
  ok(E.devNeed(s, P('owari')) === R.devNeed0 + R.devNeedStep, 'second level costs more');
  s.kok[P('owari')] = E.devCap(P('owari'));
  ok(!E.governPreview(s, a, 'develop', 6).ok, 'develop capped at base + devCap');
  const s2 = blank('oda', { owari: 'oda' });
  const b = army(s2, 'oda', 'owari', 6);
  const gm0 = E.garMax(s2, P('owari'), 'oda');
  s2.gar[P('owari')] = 1;
  dice(s2, [3]);
  E.govern(s2, b.id, 0, 'fortify');
  ok(s2.fort[P('owari')] === 1 && E.garMax(s2, P('owari'), 'oda') === gm0 + 1 && s2.gar[P('owari')] === gm0 + 1, 'fortify level up raises garrison max and fills garrison');
  const s3 = blank('satake', { hitachi: 'satake' }); s3.cur = 'satake';
  const c3 = army(s3, 'satake', 'hitachi', 5);
  ok(E.governPreview(s3, c3, 'develop', 2).add === 4, 'satake gold: +2 progress');
}

// 8. 休養：城で+1、野外で0、秋+1、内政した軍勢は休まない
{
  const s = blank('oda', { owari: 'oda' });
  const a = army(s, 'oda', 'owari', 5), b = army(s, 'oda', 'owari-mino', 5);
  ok(E.healAmount(s, a) === R.healCastle && E.healAmount(s, b) === R.healField, 'heal castle 1 / field 0');
  s.turn = 2;
  ok(E.healAmount(s, a) === R.healCastle + 1 && E.healAmount(s, b) === R.healField + 1, 'autumn +1');
  dice(s, [2]);
  E.govern(s, a.id, 0, 'develop');
  E.endClanTurn(s);
  ok(a.t === 5 && b.t === 5 + R.healField + 1, 'governing army does not heal, idle one does');
}

// 9. 石高から賽と軍勢の枠。京で賽+1
{
  const s = blank('oda', { owari: 'oda' });
  ok(E.diceCount(s, 'oda') === Math.min(R.diceMax, R.diceBase + Math.floor(5 / R.diceDiv)), 'dice from kok');
  ok(E.slots(s, 'oda') === R.slotBase + Math.floor(5 / R.slotDiv), 'slots from kok');
  s.owner[E.KYO] = 'oda';
  ok(E.diceCount(s, 'oda') === E.diceCount(blank('oda', { owari: 'oda' }), 'oda') + 1, 'kyoto +1 die');
  const big = blank('oda', {}); for (let p = 0; p < E.P; p++) big.owner[p] = 'oda';
  ok(E.diceCount(big, 'oda') === 9, '京ありで賽は最大9個');
  ok(E.slots(big, 'oda') === 29, '全国の初期石高1,900万石で29枠');
  big.kok = big.kok.map((_, p) => E.devCap(p));
  ok(E.slots(big, 'oda') === 53, '全国の開墾上限3,600万石で53枠');
  big.owner[E.KYO] = 'hojo';
  ok(E.diceCount(big, 'oda') === 8, '京なしで賽は最大8個');
}

// 大勢力の軍勢枠。領国・石高を実プレイ報告に合わせ、旧上限12部隊の記録から出陣する。
{
  const s = blank('oda', {});
  s.owner = s.owner.map((_, p) => p < 50 ? 'oda' : p < 74 ? 'uesugi' : 'hojo');
  for (const [clan, total] of [['oda', 196], ['uesugi', 83]]) {
    let remaining = total - E.kokOf(s, clan);
    for (const p of E.provsOf(s, clan)) {
      const gain = Math.min(remaining, E.devCap(p) - s.kok[p]);
      s.kok[p] += gain;
      remaining -= gain;
    }
    ok(E.kokOf(s, clan) === total, clan + ' 比較用の石高');
  }
  ok(E.slots(s, 'oda') === 30 && E.slots(s, 'uesugi') === 13, '石高196と83の軍勢枠に差が出る');
  for (const p of E.provsOf(s, 'oda').slice(0, 12)) {
    s.armies.push({ id: s.aid++, c: 'oda', n: p, t: 10, mv: false });
  }
  const loaded = JSON.parse(JSON.stringify(s));
  for (let count = 12; count < 30; count++) {
    E.beginClanTurn(loaded);
    const n = E.spawnOptions(loaded, 'oda')[0];
    ok(loaded.phase === 'place' && E.spawn(loaded, n).length === 1 &&
      E.armiesOf(loaded, 'oda').length === count + 1 && loaded.phase === 'roll', '出陣で' + (count + 1) + '部隊');
    E.endClanTurn(loaded);
  }
  E.beginClanTurn(loaded);
  ok(loaded.phase === 'roll' && !E.spawnOptions(loaded, 'oda').length, '石高に応じた30枠が埋まれば出陣停止');
}

// 10. 出陣：城が埋まっていれば城のすぐ外
{
  const s = blank('oda', { owari: 'oda', mino: 'saito' });
  s.cur = 'oda';
  army(s, 'oda', 'owari', 5);
  const opts = E.spawnOptions(s, 'oda');
  ok(opts.length > 0 && opts.every(n => n >= E.P && E.adj[n].includes(P('owari'))), 'spawn outside when castle occupied');
  const s2 = blank('oda', { owari: 'oda', mino: 'oda' });
  army(s2, 'oda', 'owari', 5);
  ok(E.spawnOptions(s2, 'oda').length === 1 && E.spawnOptions(s2, 'oda')[0] === P('mino'), 'spawn at free castle first');
}

// 11. 落城：所有が移り、戦火で石高・普請が下がる。滅亡で軍勢が消える
{
  const s = blank('oda', { owari: 'oda', mino: 'saito' });
  s.kok[P('mino')] = E.BASEK[P('mino')] + 2; s.fort[P('mino')] = 2; s.kp[P('mino')] = 3;
  s.gar[P('mino')] = 1;
  const a = army(s, 'oda', 'owari-mino', 10);
  army(s, 'saito', 'mino-hida', 3);
  army(s, 'oda', 'mino-minamishinano', 5);
  army(s, 'oda', 'echizen-mino', 5);
  dice(s, [1]);
  // 守りの賽を固定するため奇襲（ぴったり）で攻める
  const ev = E.move(s, a.id, [0], P('mino'));
  const won = s.owner[P('mino')] === 'oda';
  ok(ev && won, 'capture with overwhelming force');
  ok(s.kok[P('mino')] === E.BASEK[P('mino')] + 1 && s.fort[P('mino')] === 1 && s.kp[P('mino')] === 0 && s.gar[P('mino')] === R.capGar, 'war damage on capture');
  ok(!s.clans.saito.alive && !s.armies.some(x => x.c === 'saito'), 'clan with no castle is eliminated, armies removed');
}

// 12. 臣従：軍勢が城の隣に迫ると降る。プレイヤーには申し出
{
  const save = { c: R.subChance };
  R.subChance = 1;
  const s = E.newGame(null, 5);
  // 北条を大きくして、隣の小大名（里見）に軍勢で迫る
  for (const id of ['musashi', 'sagami', 'izu', 'kozuke', 'shimotsuke', 'shimousa', 'hitachi', 'kai', 'suruga']) s.owner[P(id)] = 'hojo';
  s.armies = s.armies.filter(a => a.c !== 'satomi' || true);
  s.armies.push({ id: s.aid++, c: 'hojo', n: N('kazusa-shimousa'), t: 8, mv: false });
  const ev = [];
  s.turn = 1;
  E.advance(s); // 何手か進めても判定は季節の終わり
  // 季節の終わりを直接呼ぶ
  const before = s.clans.satomi.alive;
  for (let i = 0; i < 400 && s.clans.satomi.alive; i++) { E.beginClanTurn(s); E.endClanTurn(s); ev.push(...E.advance(s)); }
  ok(before && !s.clans.satomi.alive && s.clans.satomi.fell && s.clans.satomi.fell.sub, 'minor submits when big neighbour presses its castle');
  ok(s.owner[P('kazusa')] === 'hojo' && s.owner[P('boshu')] === 'hojo', 'submitted provinces transfer');
  ok(ev.some(e => e.type === 'submit' && e.clan === 'satomi'), 'submit event');
  // プレイヤーへの申し出
  const p = E.newGame('hojo', 5);
  for (const id of ['musashi', 'sagami', 'izu', 'kozuke', 'shimotsuke', 'shimousa', 'hitachi', 'kai', 'suruga']) p.owner[P(id)] = 'hojo';
  p.armies.push({ id: p.aid++, c: 'hojo', n: N('kazusa-shimousa'), t: 8, mv: false });
  for (let i = 0; i < 400 && !(p.offers || []).some(o => o.c === 'satomi'); i++) { E.beginClanTurn(p); E.endClanTurn(p); E.advance(p); if (p.phase === 'decide') E.extend(p); }
  ok((p.offers || []).some(o => o.c === 'satomi') && p.clans.satomi.alive, 'player receives an offer instead of auto-absorb');
  const q = JSON.parse(JSON.stringify(p));
  E.acceptOffer(p, 'satomi');
  ok(!p.clans.satomi.alive && p.owner[P('kazusa')] === 'hojo' && p.armies.some(a => a.c === 'hojo' && a.mv), 'accept: provinces and armies join (armies rest this season)');
  E.declineOffer(q, 'satomi');
  ok(q.clans.satomi.alive && q.decl.satomi === q.turn && !q.offers.length, 'decline: remembered');
  R.subChance = save.c;
}

// 手番開始後の臣従で出陣枠が埋まる場合と、石高増加で新しく空く場合。
{
  const s = blank('oda', {});
  s.owner = s.owner.map((_, p) => p < 65 ? 'oda' : p < 68 ? 'hojo' : 'kasai');
  s.kok[0] = E.devCap(0);
  for (let n = 0; n < 23; n++) s.armies.push({ id: s.aid++, c: 'oda', n, t: 10, mv: false });
  for (const n of E.provsOf(s, 'hojo')) s.armies.push({ id: s.aid++, c: 'hojo', n, t: 10, mv: false });
  s.offers = [{ c: 'hojo', turn: s.turn }];
  E.beginClanTurn(s);
  ok(s.phase === 'place', '臣従前は23/24で出陣できる');
  for (const count of [23, 24, 26]) {
    const t = E.clone(s);
    t.armies = t.armies.filter(a => a.c === 'oda' || a.n < 65 + count - 23);
    E.acceptOffer(t, 'hojo');
    ok(E.armiesOf(t, 'oda').length === count && E.slots(t, 'oda') === 24, '加入した全軍を維持');
    ok(t.phase === (count < 24 ? 'place' : 'roll'), '臣従後' + count + '/24の出陣判定');
    ok(t.armies.filter(a => a.n >= 65).every(a => a.mv), '加入した軍勢は行動済み');
  }
  const t = blank('oda', { owari: 'oda', mino: 'hojo' });
  army(t, 'oda', 'owari', 10); army(t, 'oda', 'owari-mino', 10);
  t.offers = [{ c: 'hojo', turn: t.turn }];
  E.beginClanTurn(t);
  ok(t.phase === 'roll', '臣従前は2/2で出陣不可');
  E.acceptOffer(t, 'hojo');
  ok(t.phase === 'place' && E.spawnOptions(t, 'oda').length > 0, '石高増加で新しい出陣枠が空く');
}

// 13. 区切り：プレイヤーがいれば決断待ち、延長で続き、決着で順位
{
  const s = E.newGame('oda', 9, { maxTurn: 2 });
  let guard = 0;
  while (s.phase !== 'decide' && !s.over && guard++ < 2000) { E.beginClanTurn(s); if (s.cur !== 'oda') AI.playTurn(s); else { if (s.phase === 'place') E.spawn(s, null); E.roll(s); E.endClanTurn(s); } E.advance(s); }
  ok(s.phase === 'decide' && s.turn === 2 && !s.over, 'decide at period end');
  const t = JSON.parse(JSON.stringify(s));
  const ev = E.extend(s);
  ok(s.maxTurn === 2 + R.extTurns && s.phase !== 'decide' && s.cur === 'oda' && ev.some(e => e.type === 'extend'), 'extend continues with player first');
  E.conclude(t);
  ok(t.over && t.over.reason === 'time' && t.over.rank.length > 0 && t.over.place >= 1, 'conclude ranks by kok');
  const r0 = t.over.rank;
  ok(r0.every((x, i) => i === 0 || r0[i - 1].k >= x.k), 'rank sorted by kok');
}

// 14. 天下統一
{
  const s = blank('oda', {});
  for (let p = 0; p < E.P; p++) s.owner[p] = 'oda';
  s.owner[P('mino')] = 'saito';
  for (const c in s.clans) s.clans[c].alive = c === 'oda' || c === 'saito';
  s.gar[P('mino')] = 1;
  const a = army(s, 'oda', 'owari-mino', 10);
  army(s, 'oda', 'mino-hida', 5); army(s, 'oda', 'echizen-mino', 5); army(s, 'oda', 'mino-minamishinano', 5);
  dice(s, [1]);
  E.move(s, a.id, [0], P('mino'));
  ok(s.over && s.over.reason === 'unify' && s.over.kind === 'win', 'unify when all provinces are owned');
}

// 15. 保存からの再現性（同じ状態から同じ結果）と委任の保存
{
  const s = E.newGame('mori', 77);
  for (let i = 0; i < 120; i++) { E.beginClanTurn(s); if (s.cur === 'mori') { E.roll(s); E.endClanTurn(s); } else AI.playTurn(s); E.advance(s); if (s.phase === 'decide') break; }
  const a = s.armies.find(x => x.c === 'mori');
  if (a) E.setDelegate(s, a.id, true);
  const c1 = JSON.parse(JSON.stringify(s)), c2 = JSON.parse(JSON.stringify(s));
  for (const x of [c1, c2]) for (let i = 0; i < 80; i++) { E.beginClanTurn(x); AI.playTurn(x); E.advance(x); if (x.phase === 'decide' || x.over) break; }
  ok(JSON.stringify(c1) === JSON.stringify(c2), 'deterministic from saved state');
  ok(!a || JSON.parse(JSON.stringify(s)).armies.find(x => x.id === a.id).dg === true, 'delegation flag survives save');
}

// 16. 委任：おまかせの思考は指定した軍勢だけを動かす
{
  const s = E.newGame('oda', 4);
  E.beginClanTurn(s);
  if (s.phase === 'place') E.spawn(s, null);
  E.roll(s);
  const mine = s.armies.filter(a => a.c === 'oda');
  const keep = mine[0].id;
  const ev = AI.playFor(s, a => a.id !== keep);
  ok(!s.armies.find(a => a.id === keep).mv, 'playFor leaves filtered-out army alone');
  ok(ev.every(e => e.army == null || e.army !== keep), 'no events for filtered-out army');
}

// 17. CPUだけで数季回してもエラーがなく、速い
{
  const s = E.newGame(null, 31, { maxTurn: 12 }); s.autoEnd = true;
  const t0 = Date.now();
  let guard = 0, errs = 0;
  while (!s.over && guard++ < 3000) { try { E.beginClanTurn(s); AI.playTurn(s); E.advance(s); } catch (e) { errs++; console.log(e); break; } }
  const ms = Date.now() - t0;
  ok(!errs && s.over && s.over.reason === 'time', 'cpu-only game runs to the period end');
  ok(ms / 12 < 300, 'cpu season under 300ms in node (' + (ms / 12).toFixed(0) + 'ms)');
  ok(s.owner.every(o => o && s.clans[o].alive), 'owners are alive clans');
  ok(s.armies.every(a => s.clans[a.c].alive), 'armies belong to alive clans');
  ok(s.armies.every((a, i) => s.armies.findIndex(b => b.n === a.n) === i), 'no two armies on one node');
}

// 18. 全大名の軍勢に同じ条件を適用し、準備データのない旧形式からも命令できる。
for (const clan of E.CLAN_IDS) {
  const other = clan === 'hojo' ? 'oda' : 'hojo';
  const s = blank(clan, { owari: clan, mino: other });
  const a = army(s, clan, 'owari-mino', 7);
  const target = P('mino');
  dice(s, [3, 4]);
  ok(!E.prepareSiege(s, a.id, 0, target), clan + ' 兵7では準備不可');
  a.t = 8;
  const old = JSON.stringify(s);
  ok(!E.prepareSiege(s, a.id, 0, P('owari')) && JSON.stringify(s) === old, clan + ' 無効な命令は消費なし');
  ok(E.prepareSiege(s, a.id, 0, target)[0].after === 2 && a.mv && s.dice[0].u, clan + ' 出目3で2点');
  ok(!E.prepareSiege(s, a.id, 1, target), clan + ' 1季1命令');
  for (const value of [5, 6]) {
    E.endClanTurn(s); E.beginClanTurn(s); dice(s, [4]);
    ok(E.prepareSiege(s, a.id, 0, target)[0].after === value, clan + ' 出目4で3点、上限6');
  }
  const copy = E.clone(s), actor = E.armyById(copy, a.id);
  E.beginClanTurn(copy); dice(copy, [1]);
  ok(!E.prepareSiege(copy, a.id, 0, target) && !copy.dice[0].u, clan + ' 満了時は消費なし');
  actor.t = 6;
  const forecast = E.preview(copy, actor, target, 0);
  const b = E.move(copy, a.id, [0], target).find(e => e.type === 'battle');
  ok(b.prep === 6 && b.SA === forecast.A.total && b.p === forecast.p && !actor.siegePlan, clan + ' 保存後・負傷後も攻城で使い切る');
}

// 迎撃・撤兵・臣従・目標変更のあとに準備が復活しない。
{
  const s = blank('oda', { owari: 'oda', mino: 'hojo' });
  const a = army(s, 'oda', 'owari-mino', 10), d = army(s, 'hojo', 'mino', 10);
  dice(s, [4]); E.prepareSiege(s, a.id, 0, P('mino'));
  const prepared = E.clone(s);
  const failed = E.clone(s), weak = E.armyById(failed, a.id);
  weak.t = 2;
  E.beginClanTurn(failed); dice(failed, [1]);
  const loss = E.move(failed, a.id, [0], P('mino')).find(e => e.type === 'battle');
  ok(!loss.win && loss.prep === 3 && !weak.siegePlan, '攻城に敗れても準備は消費');
  const harmless = E.clone(s); harmless.cur = 'hojo'; dice(harmless, [1]);
  E.armyById(harmless, d.id).t = 1;
  E.move(harmless, d.id, [0], a.n);
  ok(E.siegePoints(harmless, E.armyById(harmless, a.id), P('mino')) === 3, '迎撃で兵に実損がなければ維持');
  const capture = E.clone(s);
  capture.armies = capture.armies.filter(unit => unit.id !== d.id);
  const ally = army(capture, 'oda', 'mino-hida', 10);
  capture.gar[P('mino')] = 1;
  dice(capture, [1]);
  const victory = E.move(capture, ally.id, [0], P('mino'));
  ok(victory.some(e => e.type === 'capture') && !E.armyById(capture, a.id).siegePlan, '別働隊が城を取れば元の準備も消える');
  s.cur = 'hojo'; dice(s, [1]);
  const ev = E.move(s, d.id, [0], a.n);
  ok(ev.some(e => e.type === 'disrupt' && e.before === 3 && e.after === 1), '迎撃で兵を削ると準備が2減る');
  const retreat = E.clone(prepared); retreat.cur = 'hojo'; dice(retreat, [6, 6]);
  ok(E.move(retreat, d.id, [0, 1], a.n).some(e => e.type === 'retreat') && !E.armyById(retreat, a.id).siegePlan, '退却で準備解除');
  for (const c of ['oda', 'hojo']) {
    const sub = E.clone(prepared); E.absorb(sub, c, 'mori', []);
    ok(!E.armyById(sub, a.id).siegePlan, '臣従で軍または城主が変われば解除');
  }
  E.beginClanTurn(prepared); dice(prepared, [4]);
  const other = E.clone(prepared); other.owner[P('owari')] = 'mori';
  ok(E.prepareSiege(other, a.id, 0, P('owari'))[0].after === 3 && E.siegePoints(other, E.armyById(other, a.id), P('mino')) === 0, '目標変更は0から準備');
  ok(E.move(prepared, a.id, [0], P('owari')) && !E.armyById(prepared, a.id).siegePlan, '移動で準備解除');
}

// 固い城に隣接し小さい賽が残ったとき、主要・小大名双方のCPUと委任の判断を通す。
for (const clan of ['oda', 'kono']) {
  const s = E.newGame(clan, 1); s.armies = [];
  s.owner[P('owari')] = clan; s.owner[P('mino')] = 'hojo';
  const a = army(s, clan, 'owari-mino', 10);
  army(s, 'hojo', 'mino', 10);
  dice(s, [1]);
  const cpu = E.clone(s);
  ok(AI.playTurn(cpu).some(e => e.type === 'prepare' && e.after === 2), clan + ' CPUの手番で準備');
  ok(!AI.playFor(s, unit => unit.dg).length && !s.dice[0].u, '委任外は賽を使わない');
  E.setDelegate(s, a.id, true);
  ok(AI.playFor(s, unit => unit.dg).some(e => e.type === 'prepare'), clan + ' 委任軍が準備');
}

console.log('pass', pass, 'fail', fail);
process.exit(fail ? 1 : 0);
