// くるり、呪いほどき — ルールの自動確認（node tools/rules_test.js）
'use strict';
global.RR = require('../js/sim.js');
global.RRD = require('../js/data.js');
const RG = require('../js/game.js');
const RR = global.RR, D = global.RRD;

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log('NG:', name); } }
const C = (t, lv) => RR.cell(t, lv);
// grid[c][r] を文字列で作る：列ごとに上から3文字。L=光 I=氷 B=雷 S=星 G=魔晶 _=石。小文字は Lv2
function grid(cols) { return cols.map(col => col.split('').map(ch => { const st = RR.strip(ch); return st[0]; })); }
function battleWith(cols, mons, opts) {
  const s = RG.newGame(5);
  s.reels = cols.map(col => ({ strip: RR.strip(col + '_____'), pos: 0 }));
  RR.startBattle(s, { id: 'test', reels: cols.length, hearts: 3, waves: [], finale: opts && opts.finale });
  const b = s.b;
  for (const m of mons) b.mons.push(RR.makeMon(b, { kind: m.k || 'imp', r: m.r, hp: m.hp, w: m.w || 1, h: m.h || 1, opt: m.opt || {} }, m.c));
  return s;
}

// 1. つながり
{
  const cl = RR.clusters(grid(['LL_', 'L__', '__L']));
  const big = cl.find(x => x.cells.length === 3);
  ok(big && big.el === 'light' && big.P === 3 && big.dmg === 6, '光3つのつながり：力3、2倍で6');
  ok(cl.length === 2, 'はなれた光は別のつながり');
}
{
  const cl = RR.clusters(grid(['LSI', '___', '___']));
  const l = cl.find(x => x.el === 'light'), i = cl.find(x => x.el === 'ice');
  ok(l && l.cells.length === 2 && i && i.cells.length === 2, '星は光にも氷にもつながる');
}
{
  const cl = RR.clusters(grid(['SS_', '___', '___']));
  ok(cl.length === 1 && cl[0].el === 'light' && cl[0].starOnly, '星だけのつながりは光として働く');
}
{
  const cl = RR.clusters(grid(['LG_', 'L__', '___']));
  const l = cl.find(x => x.el === 'light');
  ok(l.mult === 2 && l.power === 4 && l.dmg === 8, '魔晶Lv1は2倍（光2つ→力4→8ほどく）');
  const cl2 = RR.clusters([[C('light'), C('gem', 2), C('blank')], [C('gem'), C('blank'), C('blank')]]);
  ok(cl2.find(x => x.el === 'light').mult === 6, '魔晶Lv2(3倍)と魔晶Lv1(2倍)は重なって6倍');
}
{
  const cl = RR.clusters(grid(['l__', 'L__', '___']));
  ok(cl[0].P === 3, 'Lv2の紋は力2として数える');
}
// 2. ほどく力
{
  const s = battleWith(['L__', 'L__', '___'], [{ c: 0, r: 0, hp: 4 }, { c: 1, r: 0, hp: 5 }]);
  const res = RR.preview(s);
  ok(res.total[1] === 4 && res.total[2] === 4, '光2つのつながりの上の魔物は、どちらも4ほどかれる');
  ok(res.purified.length === 1 && res.purified[0] === 1, '呪い4はほどけ、5は残る');
}
{
  const s = battleWith(['I__', '___', '___'], [{ c: 0, r: 0, hp: 5 }]);
  const res = RR.preview(s);
  ok(res.total[1] === 1 && res.frozen.indexOf(1) >= 0, '氷は等倍で、凍らせる');
}
{
  const s = battleWith(['B__', '___', '___'], [{ c: 0, r: 0, hp: 9 }, { c: 1, r: 0, hp: 9 }, { c: 1, r: 1, hp: 9 }, { c: 2, r: 2, hp: 9 }]);
  const res = RR.preview(s);
  ok(res.total[1] === 1 && res.total[2] === 1 && res.total[3] === 1 && !res.total[4], '雷はくっついて並ぶ魔物へ跳び、はなれた魔物には跳ばない');
}
{
  const s = battleWith(['L__', '___', '___'], [{ c: 0, r: 0, hp: 9, k: 'golem', opt: { armor: 3 } }]);
  let res = RR.preview(s);
  ok(!res.total[1] && res.hits[1][0].blocked, '盾3の岩鬼は、2の一撃を弾く');
  const s2 = battleWith(['LL_', '___', '___'], [{ c: 0, r: 0, hp: 9, k: 'golem', opt: { armor: 3 } }]);
  res = RR.preview(s2);
  ok(res.total[1] === 4, '4の一撃は盾3を通る');
}
// 3. ずらしと魔力、固定
{
  const s = battleWith(['L__', '___', '___'], []);
  const b = s.b;
  b.mp = 2; b.phase = 'aim';
  ok(RR.shift(s, 0, 1) && RR.mpLeft(b) === 1, 'ずらすと魔力を1使う');
  ok(RR.shift(s, 0, -1) && RR.mpLeft(b) === 2, '戻すと魔力も戻る');
  ok(RR.shift(s, 1, 1) && RR.shift(s, 2, -1) && !RR.shift(s, 0, 1), '魔力が尽きるとずらせない');
  RR.resetShift(s);
  ok(RR.mpLeft(b) === 2, 'まとめて戻せる');
}
{
  const s = battleWith(['L__', '_L_', '__L'], []);
  const b = s.b;
  b.mp = 3;
  ok(RR.toggleHold(s, 0) && RR.toggleHold(s, 1) && !RR.toggleHold(s, 2), '全部のリールは固定できない');
  const p0 = s.reels[0].pos, p1 = s.reels[1].pos;
  RR.spin(s);
  ok(s.reels[0].pos === p0 && s.reels[1].pos === p1 && b.mp === 1, '固定したリールは回らず、魔力を1ずつ使う');
}
{
  // ずらした結果が詠唱で確定する
  const s = battleWith(['_L_', '___', '___'], [{ c: 0, r: 0, hp: 2 }]);
  s.b.phase = 'aim';
  RR.shift(s, 0, 1);
  const res = RR.cast(s);
  ok(res.purified.length === 1 && s.reels[0].pos === 1 && s.b.mp === s.b.mpMax - 1, 'ずらして詠唱すると、位置と魔力の消費が確定する');
}
// 4. 魔物の歩み
{
  const s = battleWith(['___', '___', '___'], [{ c: 2, r: 0, hp: 5, k: 'wolf' }, { c: 1, r: 1, hp: 5, k: 'knight' }, { c: 0, r: 2, hp: 5 }]);
  const b = s.b; b.phase = 'advance';
  const ev = RR.advance(s);
  const wolf = b.mons.find(m => m.k === 'wolf'), kn = b.mons.find(m => m.k === 'knight');
  ok(wolf.c === 0, '影狼は二歩進む');
  ok(kn.c === 1, '影の騎士は二手に一歩（はじめは休む）');
  ok(ev.exits.length === 1 && b.hearts === 2, '左端から出た魔物は結界を一つ欠く');
}
{
  const s = battleWith(['___', '___', '___'], [{ c: 0, r: 0, hp: 5 }, { c: 1, r: 0, hp: 5 }]);
  const b = s.b;
  b.mons[0].frozen = 1; b.phase = 'advance';
  RR.advance(s);
  ok(b.mons[0].c === 0 && b.mons[1].c === 1, '凍った魔物は止まり、後ろの魔物もつかえる');
}
{
  const s = battleWith(['___', '___', '___'], [{ c: 0, r: 0, hp: 50, k: 'boss', w: 2, h: 2 }]);
  const b = s.b; b.mons[0].tick = 1; b.phase = 'advance';
  RR.advance(s);
  ok(b.over === 'lose', '呪いの主が結界に着くと負け');
}
// 5. 主をほどくと、残りもほどける
{
  const s = battleWith(['LL_', 'LL_', '___'], [{ c: 0, r: 0, hp: 8, k: 'boss', w: 2, h: 2 }, { c: 2, r: 2, hp: 30 }]);
  s.b.sched.push({ turn: 5, kind: 'imp', r: 0, hp: 3, w: 1, h: 1, opt: {} });
  s.b.phase = 'aim';
  const res = RR.cast(s);
  ok(res.bossDown && res.after.length === 1 && !s.b.sched.length && s.b.over === 'win', '主がほどけると、残りの魔物と予定もほどけて勝ち');
}
// 6. 最後の大詠唱
{
  const s = battleWith(['LLL', 'LLL', 'LLL'], [{ c: 0, r: 0, hp: 8, k: 'boss', w: 2, h: 2 }], { finale: { casts: 3, hp: [1, 1, 1], mpBonus: 3 } });
  const b = s.b; b.phase = 'aim';
  let res = RR.cast(s);
  ok(res.finaleStart && !b.over && b.finale, '主がほどけると大詠唱が始まる');
  RR.advance(s);
  ok(b.mons.length === 9 && b.mp === b.mpMax + 3, '大詠唱では床のすべてのマスに人々が現れ、魔力が満ちる');
  for (let i = 0; i < 3; i++) { b.phase = 'aim'; res = RR.cast(s); if (!b.over) RR.advance(s); }
  ok(b.over === 'win' && b.finale.rescued === 27, '3回の大詠唱のあと勝ち（全員救えば27人）');
}
// 7. 出現の時刻
{
  const s = RG.newGame(3);
  RR.startBattle(s, { id: 't', reels: 3, hearts: 3, waves: [[0, 'imp', 0, 2], [1, 'imp', 1, 2], [2, 'imp', 2, 2]] });
  const b = s.b;
  ok(b.mons.length === 2 && b.mons[0].c === 2 && b.mons[1].c === 3, '手番0の魔物は床の右端、手番1の魔物は接近の列に');
  RR.spin(s); RR.cast(s); RR.advance(s);
  const m1 = b.mons.find(m => m.r === 1), m2 = b.mons.find(m => m.r === 2);
  ok(m1 && m1.c === 2 && m2 && m2.c === 3, '一手ごとに接近の列から床へ入り、次の魔物が接近の列に現れる');
}
// 8. 保存と再現
{
  const s = RG.newGame(42);
  RG.startStage(s);
  const copy = JSON.parse(JSON.stringify(s));
  const play = st => { const out = []; for (let i = 0; i < 6 && !st.b.over; i++) { RR.spin(st); const bs = RR.bestShift(st); st.b.offs = bs.offs.slice(); const r = RR.cast(st); out.push(r.purified.length + ':' + st.reels.map(x => x.pos).join('')); if (!st.b.over) RR.advance(st); } return out.join(','); };
  ok(play(s) === play(copy), '保存した状態から同じ手を打つと、同じ結果になる');
}
// 9. 全地方の定義
{
  let bad = 0;
  for (const st of D.STAGES) {
    const s = RG.newGame(9);
    while (s.reels.length < st.reels) s.reels.push({ strip: RR.strip('________'), pos: 0 });
    RR.startBattle(s, st);
    const n = s.b.mons.length + s.b.sched.length;
    if (n !== st.waves.length) bad++;
  }
  ok(bad === 0, 'すべての地方で、予定した魔物がすべて登場する');
}
// 10. 工房
{
  const s = RG.newGame(1);
  s.inv.push({ t: 'ice', lv: 1 });
  RR.place(s, 0, 0, 0);
  ok(s.reels[0].strip[0].t === 'ice' && s.inv.length === 1 && s.inv[0].t === 'light', '紋を置くと、元の紋は持ち物にもどる');
  RR.swapCells(s, 0, 0, 1, 1);
  ok(s.reels[1].strip[1].t === 'ice' && s.reels[0].strip[0].t === 'light', 'リールの紋どうしを入れ替えられる');
  s.smith = true; s.coins = 100;
  ok(RG.upgradeCell(s, 1, 1) && s.reels[1].strip[1].lv === 2 && s.coins === 94, '鍛えると Lv が上がり、しるしを使う');
}

console.log(`rules_test: ${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
