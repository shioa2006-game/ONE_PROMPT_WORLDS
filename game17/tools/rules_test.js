// ずらり、砦くずし — ルールの自動確認
// 使い方: node tools/rules_test.js
'use strict';
const Z = require('../js/sim.js');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log('NG:', name); } }
function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), `${name}  got=${JSON.stringify(a)} want=${JSON.stringify(b)}`); }

// 盤面を自由に作る
function setup(reels, enemies, parts, opts) {
  const s = Z.newGame(1);
  s.reels = reels.map((keys, i) => ({ role: Z.REEL_ROLES[i], strip: keys.map(k => (typeof k === 'string' ? Z.wd(k) : Z.wd(k[0], k[1]))), pos: 0 }));
  Z.startBattle(s, (opts && opts.stage) || 0);
  const b = s.b;
  b.en = [];
  b.nextId = 1;
  for (const [lane, col, t, hp] of enemies) { const e = Z.mkEnemy(b, lane, col, t); if (hp) { e.hp = hp; e.max = hp; } }
  if (parts) parts.forEach((hp, i) => { b.parts[i].hp = hp; b.parts[i].max = hp; b.parts[i].dead = hp <= 0; });
  b.offs = s.reels.map(() => 0);
  b.mana = (opts && opts.mana) || 3;
  Z.spin(s, s.reels.map(() => 0));
  return s;
}
const S8 = k => new Array(8).fill(k);

// --- 行の呪文 ---
{
  const s = setup([['fire', 'sword', 'ice', ...S8('sword').slice(3)], S8('point'), ['x2', 'p1', 'x3', ...S8('p1').slice(3)]], [], [10, 10, 10]);
  const sp0 = Z.rowSpell(s, 0), sp2 = Z.rowSpell(s, 2);
  eq([sp0.src, sp0.shape, sp0.power], ['fire', 'point', 6], '1行目＝炎・一点・×2 で力6');
  eq([sp2.src, sp2.power], ['ice', 6], '3行目＝氷・×3 で力6');
}
// 空きの行は呪文にならない
{
  const s = setup([S8('sword'), ['gap', 'point', 'gap', ...S8('point').slice(3)], S8('p1')], [[0, 2, 'gob']], [10, 10, 10]);
  ok(Z.rowSpell(s, 0).dead && !Z.rowSpell(s, 1).dead, '形が空きの行は dead');
  const res = Z.cast(s);
  ok(res.fires.every(f => f.row !== 0), '空きの行からは何も飛ばない');
  eq(s.b.en.length, 1, '上の道の小鬼は残る');
}
// 一点は手前の一体に2倍、空いた道なら砦へ
{
  const s = setup([S8('sword'), S8('point'), S8('p1')], [[0, 3, 'gob'], [0, 5, 'gob']], [10, 10, 10]);
  const res = Z.cast(s);
  eq(s.b.en.filter(e => e.lane === 0).map(e => e.col), [5], '一点は手前の一体だけ');
  eq([s.b.parts[1].hp, s.b.parts[2].hp], [6, 6], '空いた道の一点は砦に力×2');
  ok(res.kills === 1, '倒した数1');
}
// 貫く：倒した体力ぶん減って奥へ、砦まで
{
  const s = setup([S8('fire'), S8('lance'), S8('x3')], [[1, 1, 'gob', 2], [1, 3, 'gob', 2], [1, 5, 'shield', 5]], [20, 20, 20]);
  // 力9：小鬼2→7、小鬼2→5、盾兵(5、半分)→ 2.5→2 しか入らず止まる
  Z.cast(s);
  const sh = s.b.en.find(e => e.t === 'shield');
  eq(sh && sh.hp, 3, '盾兵は貫くを半分に受け、そこで止まる');
  eq(s.b.parts[1].hp, 20, '止まったので砦には届かない');
}
{
  const s = setup([S8('fire'), S8('lance'), S8('x3')], [[1, 1, 'gob', 2], [1, 3, 'gob', 2]], [20, 20, 20]);
  Z.cast(s);
  eq(s.b.parts[1].hp, 15, '貫く 9 − 小鬼2 − 小鬼2 = 5 が砦へ');
}
// 雷は盾をすり抜ける
{
  const s = setup([S8('bolt'), S8('lance'), S8('x3')], [[1, 1, 'shield', 5]], [20, 20, 20]);
  Z.cast(s);
  eq(s.b.en.length, 0, '雷の貫く6は盾兵(5)を倒す');
  eq(s.b.parts[1].hp, 19, '残り1が砦へ');
}
// 光は砦に2倍
{
  const s = setup([S8('light'), S8('point'), S8('p1')], [], [20, 20, 20]);
  Z.cast(s);
  eq(s.b.parts[0].hp, 12, '光・一点：力2×2×砦2倍=8');
}
// なぎ払い：各道の手前
{
  const s = setup([S8('sword'), ['sweep', 'gap', 'gap', ...S8('gap').slice(3)], S8('p1')], [[0, 4, 'gob', 2], [1, 2, 'shield', 5], [1, 3, 'gob', 2]], [10, 10, 10]);
  Z.cast(s);
  eq(s.b.en.map(e => [e.lane, e.col, e.hp]), [[1, 2, 3], [1, 3, 2]], 'なぎ払いは各道の手前に（盾は横から効かない）');
  eq(s.b.parts[2].hp, 8, '空いた道は砦の部分に');
}
// はじける：まわり八方
{
  const s = setup([S8('fire'), ['gap', 'burst', 'gap', ...S8('gap').slice(3)], S8('p1')], [[0, 3, 'gob'], [1, 3, 'gob'], [1, 4, 'gob'], [2, 2, 'gob'], [1, 6, 'gob']], [10, 10, 10]);
  Z.cast(s);
  eq(s.b.en.map(e => [e.lane, e.col]), [[1, 6]], 'はじけるは3×3、外の一体だけ残る');
}
// あらし：すべてに半分
{
  const s = setup([S8('fire'), S8('storm'), S8('p1')], [[0, 3, 'ogre'], [2, 5, 'gob']], [10, 10, 10]);
  Z.cast(s);
  // 3行ともあらし（力3→1）
  eq(s.b.en.find(e => e.t === 'ogre').hp, 9, 'あらし3回×1');
  eq(s.b.parts.map(p => p.hp), [7, 7, 7], '砦にも届く');
}
// 二度
{
  const s = setup([S8('sword'), S8('point'), S8('twice')], [[0, 2, 'gob'], [0, 4, 'gob']], [10, 10, 10]);
  Z.cast(s);
  eq(s.b.en.filter(e => e.lane === 0).length, 0, '二度の一点で手前から2体');
}
// 響：三道
{
  const s = setup([['fire', 'sword', 'sword', ...S8('sword').slice(3)], ['lance', 'gap', 'gap', ...S8('gap').slice(3)], S8('p1'), S8('p1'), ['all', 'e0', 'e0', ...S8('e0').slice(3)]], [], [10, 10, 10]);
  const sp = Z.rowSpell(s, 0);
  eq(sp.lanes, [0, 1, 2], '三道で三本の道すべて');
  Z.cast(s);
  eq(s.b.parts.map(p => p.hp), [7, 7, 7], '1行目の炎・貫くが三本の道で砦に3ずつ');
}
// 氷：凍らせる→次の手番は動かない。凍った砦は出さない
{
  const s = setup([S8('ice'), S8('point'), S8('p1')], [[0, 3, 'ogre']], [10, 10, 10]);
  Z.cast(s);
  const og = s.b.en[0];
  ok(og.frz === 1, '大鬼が凍る');
  Z.enemyPhase(s);
  eq(og.col, 3, '凍った大鬼は動かない');
  ok(og.frz === 0, '一手番で解ける');
}
// 砦が崩れると、その道の魔物と中の守備兵が逃げる
{
  const s = setup([S8('fire'), S8('lance'), S8('x3')], [[0, 2, 'gob'], [0, 5, 'gob']], [5, 99, 99], { stage: 1 });
  const g0 = Z.garrisonLeft(s.b, 0).length;
  const res = Z.cast(s);
  ok(s.b.parts[0].dead, '北の櫓が崩れる');
  eq(s.b.en.filter(e => e.lane === 0).length, 0, '上の道に魔物は残らない');
  ok(res.fled >= g0, '中の守備兵も逃げた数に入る');
}
// ずらし：魔力・戻すと戻る・上限
{
  const s = setup([S8('sword'), S8('point'), S8('p1')], [], [10, 10, 10], { mana: 2 });
  ok(Z.shift(s, 0, 1) && Z.shift(s, 1, -1), '2コマずらせる');
  ok(!Z.shift(s, 2, 1), '3コマ目は魔力不足');
  ok(Z.shift(s, 0, -1), '戻すのは魔力いらず');
  eq(Z.manaLeft(s), 1, '戻すと魔力が1もどる');
  ok(Z.shift(s, 2, 1), 'もどった魔力でまたずらせる');
}
// ずらした向き：▲(+1) で下のコマが窓に入る
{
  const s = setup([['fire', 'sword', 'sword', 'ice', 'sword', 'sword', 'sword', 'light'], S8('point'), S8('p1')], [], [10, 10, 10]);
  eq(Z.wordAt(s, 0, 2).k, 'sword', '窓の3行目');
  Z.shift(s, 0, 1);
  eq([Z.wordAt(s, 0, 0).k, Z.wordAt(s, 0, 2).k], ['sword', 'ice'], '▲で下の「氷」が3行目へ');
  Z.shift(s, 0, -1); Z.shift(s, 0, -1);
  eq(Z.wordAt(s, 0, 0).k, 'light', '▼で上の「光」が1行目へ');
}
// 放つとずらしが確定する
{
  const s = setup([['fire', 'sword', 'sword', 'sword', 'ice', 'sword', 'sword', 'light'], S8('point'), S8('p1')], [], [10, 10, 10]);
  Z.shift(s, 0, 1);
  Z.cast(s);
  eq([s.reels[0].pos, s.b.offs[0]], [1, 0], '位置が確定し、ずらしは0に');
}
// 見こみは本物の状態を変えない
{
  const s = setup([S8('fire'), S8('lance'), S8('x3')], [[1, 1, 'gob']], [20, 20, 20]);
  Z.shift(s, 0, 1);
  const snap = JSON.stringify(s);
  Z.predict(s); Z.foresee(s);
  ok(JSON.stringify(s) === snap, 'predict / foresee は状態を変えない');
}
// 魔王軍：歩く・陣を攻める・弓・大鬼の休み
{
  const s = setup([S8('sword'), S8('gap'), S8('p1')], [[0, 0, 'gob'], [1, 3, 'wolf'], [2, 4, 'archer'], [2, 1, 'ogre']], [10, 10, 10]);
  Z.cast(s);
  const g0 = s.b.guard;
  const ev = Z.enemyPhase(s);
  ok(ev.some(e => e.k === 'strike'), '列0の小鬼は陣を攻める');
  eq(s.b.en.find(e => e.t === 'wolf').col, 1, '黒狼は2歩');
  eq(s.b.en.find(e => e.t === 'ogre').col, 0, '大鬼は最初の手番は歩く');
  ok(ev.some(e => e.k === 'aim'), '弓兵は狙う');
  eq(g0 - s.b.guard, 1, '守りが1減る');
  s.b.phase = 'aim'; Z.cast(s);
  const ev2 = Z.enemyPhase(s);
  ok(ev2.some(e => e.k === 'shoot'), '弓兵は二手番目に射る');
  ok(ev2.some(e => e.k === 'rest'), '大鬼は次の手番は休む');
}
// 砦の守備兵：決まった数だけ出る
{
  const s = Z.newGame(1);
  Z.startBattle(s, 0);
  const total = Z.STAGES[0].spawn.reduce((a, sp) => a + sp.list.length, 0);
  let spawned = 0;
  for (let t = 0; t < 30; t++) { s.b.phase = 'enemy'; s.b.en = []; const ev = Z.enemyPhase(s); spawned += ev.filter(e => e.k === 'spawn').length; }
  eq(spawned, total, '守備兵は決まった数だけ出る');
}
// 全部崩すと勝ち・守りが0で負け
{
  const s = setup([S8('fire'), S8('point'), S8('x3')], [], [5, 5, 5]);
  const res = Z.cast(s);
  ok(res.win && s.b.over === 'win', '三つとも崩すと勝ち');
}
{
  const s = setup([S8('sword'), S8('gap'), S8('p1')], [[0, 0, 'ogre']], [10, 10, 10]);
  s.b.guard = 2;
  Z.cast(s); Z.enemyPhase(s);
  ok(s.b.over === 'lose', '守りが0で負け');
}
// 工房：置く・入れ替え・外す・鍛える・買う
{
  const s = Z.newGame(1);
  s.inv.push(Z.wd('lance'));
  ok(!Z.place(s, 0, 0, 0), '形の言葉は源のリールに置けない');
  ok(Z.place(s, 0, 1, 3), '形のリールの空きに置ける');
  eq(s.reels[1].strip[3].k, 'lance', '置いた');
  ok(s.reels[1].strip[3].nw, '新しい印');
  eq(s.inv.length, 0, '空きを埋めても持ち物は増えない');
  ok(Z.swapSlots(s, 1, 3, 0), '入れ替え');
  eq([s.reels[1].strip[0].k, s.reels[1].strip[3].k], ['lance', 'point'], '入れ替わった');
  ok(Z.unplace(s, 1, 0), '外す');
  eq([s.reels[1].strip[0].k, s.inv[0].k], ['gap', 'lance'], '外すと空きになり持ち物へ');
  s.shop = ['fire', 'up1']; s.gold = 20;
  ok(Z.buy(s, 'fire') && !Z.buy(s, 'fire'), '同じ言葉は一つずつ');
  s.reels[0].strip[1] = Z.wd('fire');
  ok(Z.upgrade(s, 0, 1) && s.reels[0].strip[1].lv === 2, '鍛えるとLv2');
  ok(!Z.upgrade(s, 0, 1), 'Lv3は鍛冶の腕が上がってから');
}
// 勝ったあと：お礼・リール追加
{
  const s = Z.newGame(1);
  for (let i = 0; i < 4; i++) {
    Z.startBattle(s, i); s.b.over = 'win';
    Z.finishBattle(s);
    if (s.gift) Z.takeGift(s, 0);
  }
  eq(s.reels.length, 5, '四つ目の砦のあとでリールは5本');
  eq(s.maxMana, 3, '魔力の器は3');
  eq(s.stage, 4, '次は五つ目');
}
// 保存（JSON）からの再現
{
  const s = setup([S8('fire'), S8('lance'), S8('x2')], [[1, 1, 'gob'], [1, 3, 'gob']], [20, 20, 20]);
  const t = JSON.parse(JSON.stringify(s));
  const r1 = Z.cast(s), r2 = Z.cast(t);
  eq(r1.dmg, r2.dmg, '同じ状態からは同じ結果');
}
// 二戦目のはじめの「教える回転」
{
  let found = 0;
  for (let slot = 0; slot < 8; slot++) {
    const s = Z.newGame(3);
    s.reels[1].strip[slot] = { k: 'lance', lv: 1, nw: true };
    Z.startBattle(s, 1);
    if (Z.findTeachSpin(s)) found++;
  }
  ok(found >= 6, `「貫く」をどこに置いても教える回転が見つかる（${found}/8）`);
}
// 退却：砦の傷は残り、挑むたびに援軍（守り+1、最大+3）
{
  const s = Z.newGame(1);
  for (let k = 1; k <= 4; k++) {
    Z.startBattle(s, 2);
    if (k === 1) { s.b.parts[0].hp = 5; s.b.parts[2].hp = 0; s.b.parts[2].dead = true; }
    if (k > 1) {
      eq([s.b.parts[0].hp, s.b.parts[2].dead], [5, true], `${k}回目の挑戦でも傷が残る`);
      eq(s.b.guard, s.guardMax + Math.min(3, k - 1), `${k}回目の挑戦は守り+${Math.min(3, k - 1)}`);
    }
    s.b.over = 'lose';
    Z.finishBattle(s);
  }
  Z.startBattle(s, 2); s.b.over = 'win'; Z.finishBattle(s);
  ok(s.siege === null, '勝つと傷の記録は消える');
}
// 大軍勢：魔王を崩すと全軍が退き、その場で決着
{
  const s = setup([S8('fire'), S8('lance'), S8('x3')], [], null, { stage: Z.FINAL });
  s.b.parts[1].hp = 3;
  const res = Z.cast(s);
  ok(s.b.lordDown && s.b.over === 'win' && res.win, '魔王が倒れて決着');
  eq(s.b.en.length, 0, '全軍が退く');
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
