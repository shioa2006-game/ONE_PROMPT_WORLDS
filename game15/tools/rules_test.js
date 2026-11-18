/* 賽駆け — ルールの自動確認（node tools/rules_test.js） */
'use strict';
const E = require('../js/engine.js');
const AI = require('../js/ai.js');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('NG:', msg); } }
const N = r => E.nodeOf(r);
const P = id => E.PI[id];

// 空の盤面を作る（全部中立・軍勢なし）
function blank(player) {
  const s = E.newGame(player || 'oda', 1);
  s.armies = [];
  s.owner = s.owner.map(() => null);
  s.gar = E.DATA.PROV.map(p => p.g);
  s.turn = 0; s.cur = player || 'oda'; s.phase = 'move';
  return s;
}
function army(s, c, ref, t) { const a = { id: s.aid++, c, n: N(ref), t, mv: false }; s.armies.push(a); return a; }

// 1. 盤面はつながっている
{
  const seen = new Set([0]), st = [0];
  while (st.length) { const u = st.pop(); for (const v of E.adj[u]) if (!seen.has(v)) { seen.add(v); st.push(v); } }
  ok(seen.size === E.N, 'graph connected');
  ok(E.nodes.filter(n => n.kind === 'b').every(n => E.adj[n.i].length === 2), 'border has two sides');
}

// 2. 街道は1歩、峠は2歩、冬は3歩、武田は峠1歩
{
  const s = blank('oda');
  s.owner[P('owari')] = 'oda'; s.owner[P('mino')] = 'oda';
  const a = army(s, 'oda', 'owari', 5);
  let r = E.reach(s, a, 2);
  ok(r.dist[N('owari-mino')] === 1 && r.dist[P('mino')] === 2, 'road costs 1 per node');
  s.owner[P('hida')] = 'oda';
  r = E.reach(s, a, 6);
  ok(r.dist[N('mino-hida')] === 4, 'pass costs 2 (2+2)');
  s.turn = 3;
  r = E.reach(s, a, 6);
  ok(r.dist[N('mino-hida')] === 5, 'winter pass costs 3');
  const s2 = blank('takeda');
  s2.owner[P('kai')] = 'takeda'; s2.turn = 3;
  const t = army(s2, 'takeda', 'kai', 5);
  const r2 = E.reach(s2, t, 6);
  ok(r2.dist[N('kai-suruga')] === 1, 'takeda crosses pass in 1 even in winter');
}

// 3. 敵の隣で足が止まる（ZOC）。中立の城の先へは進めない
{
  const s = blank('oda');
  s.owner[P('owari')] = 'oda'; s.owner[P('mikawa')] = 'oda'; s.owner[P('totomi')] = 'oda';
  const a = army(s, 'oda', 'owari', 6);
  army(s, 'imagawa', 'mikawa-minamishinano', 5); // 三河の城の隣
  const r = E.reach(s, a, 6);
  ok(r.dist[P('mikawa')] === 2, 'can enter castle adjacent to enemy');
  ok(r.dist[N('mikawa-totomi')] === Infinity, 'cannot pass through ZOC node');
  ok(r.attacks.some(x => x.t === N('mikawa-minamishinano')), 'can attack enemy from ZOC node');
  ok(r.dist[P('ise')] === Infinity, 'neutral castle blocks passage');
}

// 4. 城攻めは手番のはじめに城の隣にいる軍勢だけ
{
  const s = blank('oda');
  s.owner[P('owari')] = 'oda';
  const far = army(s, 'oda', 'owari', 8);
  const near = army(s, 'oda', 'owari-ise', 8);
  ok(!E.reach(s, far, 6).attacks.some(x => x.t === P('ise')), 'castle siege needs adjacency (far army)');
  const at = E.reach(s, near, 3).attacks.find(x => x.t === P('ise'));
  ok(at && at.left === 2 && at.from === near.n, 'adjacent army can siege, leftover = die - 1');
}

// 5. 勢い・奇襲・加勢の計算
{
  const s = blank('oda');
  s.owner[P('owari')] = 'oda';
  const a = army(s, 'oda', 'owari-ise', 6);
  let pv = E.preview(s, a, P('ise'), 3);
  ok(pv.A.total === 9 && !pv.kishu, 'momentum adds leftover');
  pv = E.preview(s, a, P('ise'), 0);
  ok(pv.kishu && pv.A.total === 6, 'exact landing = kishu');
  const g = s.gar[P('ise')] + E.castleDef(s, P('ise'), null);
  ok(pv.p === (6 > g ? 1 : 0), 'kishu is deterministic');
  army(s, 'oda', 'iga-ise', 3);
  pv = E.preview(s, a, P('ise'), 3);
  ok(pv.A.total === 11, 'support +2 per adjacent friendly army');
  pv = E.preview(s, a, P('ise'), 12);
  ok(pv.A.parts.find(p => p[0] === '勢い')[1] === E.R.momentumCap, 'momentum cap');
}

// 6. 移動の妥当性：使った賽・動いた軍勢・届かない先は拒否
{
  const s = blank('oda');
  s.owner[P('owari')] = 'oda';
  const a = army(s, 'oda', 'owari', 6);
  s.dice = [{ v: 1, u: false }, { v: 2, u: false }];
  ok(E.move(s, a.id, [0], N('owari-mikawa')) !== null, 'valid move');
  ok(E.move(s, a.id, [1], N('owari-ise')) === null, 'moved army cannot move again');
  const b = army(s, 'oda', 'owari-ise', 4);
  ok(E.move(s, b.id, [0], N('owari-mino')) === null, 'used die rejected');
  ok(E.move(s, b.id, [1], P('kii')) === null, 'out of reach rejected');
}

// 7. 合戦：落城で国が移る・守備兵がもどる・退却と包囲壊滅
{
  const s = blank('oda');
  s.owner[P('owari')] = 'oda'; s.owner[P('ise')] = 'imagawa'; s.gar[P('ise')] = 1;
  const a = army(s, 'oda', 'owari-ise', 10);
  s.dice = [{ v: 1, u: false }];
  const ev = E.move(s, a.id, [0], P('ise'));
  ok(ev && ev.some(e => e.type === 'capture'), 'castle captured');
  ok(s.owner[P('ise')] === 'oda' && s.gar[P('ise')] === E.R.capGar && a.n === P('ise'), 'owner/garrison/advance after capture');
  ok(s.clans.imagawa.alive === false && ev.some(e => e.type === 'eliminated'), 'clan with no province is eliminated');
}
{
  const s = blank('oda');
  s.owner[P('owari')] = 'oda'; s.owner[P('mino')] = 'saito_none';
  // 包囲：退く先のない軍勢は壊滅
  s.owner[P('mino')] = 'imagawa'; s.owner[P('ise')] = 'oda';
  const d = army(s, 'imagawa', 'ise-mino', 2);
  const a = army(s, 'oda', 'ise', 10);
  army(s, 'oda', 'mino-owari', 3); // 美濃側の隣は空いている → 退却できる
  s.dice = [{ v: 6, u: false }];
  let ev = E.move(s, a.id, [0], N('ise-mino'));
  ok(ev.some(e => e.type === 'retreat' || e.type === 'rout'), 'defender retreats or routs');
}
{
  const s = blank('oda');
  s.owner[P('owari')] = 'oda'; s.owner[P('ise')] = 'oda'; s.owner[P('mino')] = 'oda';
  s.owner[P('kii')] = 'imagawa';
  const d = army(s, 'imagawa', 'ise-mino', 4);  // 両側とも織田の城 → 退く先がない
  const a = army(s, 'oda', 'ise', 10);
  s.dice = [{ v: 6, u: false }];
  const ev = E.move(s, a.id, [0], N('ise-mino'));
  const b = ev.find(e => e.type === 'battle');
  if (b && b.win) ok(ev.some(e => e.type === 'rout'), 'trapped defender is destroyed');
  else ok(true, 'battle lost (dice), skip trap check');
}

// 8. 休むと兵が戻る（城＞野、秋は+1、三好は+1）
{
  const s = blank('miyoshi');
  s.owner[P('settsu')] = 'miyoshi';
  const a = army(s, 'miyoshi', 'settsu', 3);
  const b = army(s, 'miyoshi', 'settsu-harima', 3);
  const hc = E.healAmount(s, a), hf = E.healAmount(s, b);
  ok(hc > hf, 'castle rest heals more than field');
  s.turn = 2;
  ok(E.healAmount(s, b) === hf + 1, 'autumn +1');
}

// 9. 軍勢の枠・賽の数・京
{
  const s = blank('oda');
  for (let p = 0; p < 15; p++) s.owner[p] = 'oda';
  ok(E.diceCount(s, 'oda') === 5, '15 provinces -> 5 dice');
  s.owner[E.KYO] = 'oda';
  ok(E.diceCount(s, 'oda') === 6, 'kyo +1 die');
  ok(E.slots(s, 'oda') === E.R.slotMax, 'slot cap');
}

// 10. 勝利と時間切れ
{
  const s = blank('oda');
  let k = 0; for (let p = 0; p < E.P && k < s.winProv - 1; p++) if (p !== E.KYO && p !== P('owari')) { s.owner[p] = 'oda'; k++; }
  s.owner[P('owari')] = null;
  s.owner[E.KYO] = 'imagawa'; s.gar[E.KYO] = 1;
  const a = army(s, 'oda', 'yamashiro-settsu', 10);
  s.owner[P('settsu')] = 'oda';
  s.dice = [{ v: 1, u: false }];
  const ev = E.move(s, a.id, [0], E.KYO);
  ok(s.over && s.over.kind === 'win' && ev.some(e => e.type === 'over'), 'tenka victory with kyo + winProv');
}
{
  const s = E.newGame('oda', 5);
  let guard = 0;
  while (!s.over && guard++ < 3000) { E.beginClanTurn(s); AI.playTurn(s); if (s.over) break; E.advance(s); }
  ok(!!s.over, 'game reaches an end');
  ok(s.over.turn <= s.maxTurn, 'ends within time limit');
}

// 11. 保存と再開：同じ状態から同じ結果になる
{
  const s = E.newGame('hojo', 77);
  for (let i = 0; i < 30; i++) { E.beginClanTurn(s); AI.playTurn(s); if (s.over) break; E.advance(s); }
  const c1 = E.clone(s), c2 = JSON.parse(JSON.stringify(s));
  for (let i = 0; i < 40; i++) {
    for (const x of [c1, c2]) { if (x.over) continue; E.beginClanTurn(x); AI.playTurn(x); if (!x.over) E.advance(x); }
  }
  ok(JSON.stringify(c1.owner) === JSON.stringify(c2.owner) && c1.rs === c2.rs, 'deterministic after save/load');
}

// 12. どの国の城も、どこかの国境から攻められる（到達不能がない）
{
  let bad = 0;
  for (let p = 0; p < E.P; p++) if (!E.adj[p].length) bad++;
  ok(bad === 0, 'every castle has a border');
}

console.log('pass', pass, 'fail', fail);
process.exit(fail ? 1 : 0);
