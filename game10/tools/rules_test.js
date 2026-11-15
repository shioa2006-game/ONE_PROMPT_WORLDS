/*
 * ぐるり、夜まつり ― しくみの 確認（node tools/rules_test.js）
 * 結果は tools/results/rules-test.txt にも 書く。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = require(path.join(__dirname, '../js/data.js'));
const S = require(path.join(__dirname, '../js/sim.js'));

const out = [];
let ok = 0, ng = 0;
function check(name, cond, extra) {
  if (cond) ok++; else ng++;
  out.push((cond ? 'OK ' : 'NG ') + name + (extra ? '　（' + extra + '）' : ''));
}
const I = (x, y) => S.idx(x, y);
function setBoard(st, rows) {
  // rows: 7文字×7行。H D K L = 玉、. = 空き、j = おじゃま（葉っぱ）、y = 豆だぬき（体力 hp）
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    const ch = rows[y][x];
    let p = null;
    if ('HDKL'.includes(ch)) p = { id: st.nid++, k: 't', t: ch };
    else if (ch === 'j') p = { id: st.nid++, k: 'j', t: 'leaf' };
    else if (ch === 'y') p = { id: st.nid++, k: 'y', sp: 'mame', hp: 2, mhp: 2, atk: 1, cd: 3, cdMax: 3, fresh: false };
    st.cells[I(x, y)] = p;
  }
}
function walk(st, cells) {
  // ひとつずつ tryStep で なぞる。輪は さいごに はじめの マスを 入れる
  const p = [cells[0]];
  let closed = false;
  for (let k = 1; k < cells.length; k++) {
    const r = S.tryStep(st, p, closed, cells[k]);
    if (r === 'add') p.push(cells[k]);
    else if (r === 'close') closed = true;
    else return { path: p, closed, fail: r || 'null', at: k };
  }
  return { path: p, closed };
}

// 1. はじめの戦い：花火3つで 豆だぬきを おいはらう
{
  const P = S.newPlayer();
  const st = S.newBattle('a1b1', P, 1);
  const w = walk(st, [I(2, 1), I(2, 2), I(2, 3)]);
  const info = S.preview(st, w.path, w.closed);
  check('1-1 の 手ほどき：花火3つ が 豆だぬきに 3 あたる', info.valid && info.targets.length === 1 && info.targets[0].dmg === 3 && info.targets[0].kill);
  const r = S.resolve(st, w.path, w.closed);
  const drop = st.cells[I(3, 2)];
  check('おいはらった 妖の マスに 小判が おちる', drop && drop.k === 't' && drop.t === 'K' && r.ev.some(e => e.e === 'defeat'));
}
// 2. 二つめの戦い：小判の 輪で むすぶ
{
  const P = S.newPlayer();
  const st = S.newBattle('a1b2', P, 1);
  const w = walk(st, [I(3, 1), I(4, 2), I(3, 3), I(2, 2), I(3, 1)]);
  check('1-2 の 手ほどき：ひし形の 4つで 輪に なる', w.closed && w.path.length === 4);
  const info = S.preview(st, w.path, w.closed);
  check('輪の 中の 豆だぬきが ともだちに なる予定', info.befriend.length === 1);
  check('小判 = 輪4 + むすんだ ごほうび2', info.coins === 6, 'coins=' + info.coins);
  S.resolve(st, w.path, w.closed);
  check('むすぶと ともだちに 記録される', P.friends.mame === 1);
  check('ともだちの ちから：豆だぬきで 小判の 鎖 +1', S.stats(P).koban === 1);
}
// 3. なぞりの きまり
{
  const st = S.newBattle('a2b1', S.newPlayer(), 3);
  setBoard(st, [
    'HHKKDDK',
    'HHKKDDK',
    'DDLDDKK',
    'KKHHHHH',
    'DDDDDDD',
    'KKKKKKK',
    'HDKHDKH'
  ]);
  // ななめが 交差する 線は つなげない
  const p = [I(0, 0), I(1, 1), I(1, 0)];
  check('ななめが 交差する 線は つなげない', S.tryStep(st, p, false, I(0, 1)) === null);
  // 三角では 輪に ならない（中に マスが ない）
  const tri = [I(0, 0), I(1, 0), I(1, 1)];
  check('三角は 輪に ならない（中に マスが ない）', S.tryStep(st, tri, false, I(0, 0)) === null);
  // ひもの 長さ 6 まで
  const row = [I(0, 4), I(1, 4), I(2, 4), I(3, 4), I(4, 4), I(5, 4)];
  check('ひもの 長さ（6）を こえると つなげない', S.tryStep(st, row, false, I(6, 4)) === 'full');
  // 提灯は どの玉とも つながる
  const w2 = walk(st, [I(1, 1), I(2, 2), I(3, 3)]);
  check('提灯（L）を はさんで 花火と 花火が つながる', w2.path.length === 3 && S.chainType(st, w2.path) === 'H');
  check('ちがう 種類は つながらない', S.tryStep(st, [I(0, 2), I(1, 2)], false, I(2, 1)) === null);
  check('もどると 1つ ほどける', S.tryStep(st, [I(0, 4), I(1, 4), I(2, 4)], false, I(1, 4)) === 'back');
}
// 4. 花火は となりの 数だけ あたる
{
  const st = S.newBattle('a2b1', S.newPlayer(), 3);
  setBoard(st, [
    'KKKKKKK',
    'KHHHKKK',
    'KHyDKKK',
    'KDDDKKK',
    'KKKKKKK',
    'DDDDDDD',
    'KKKKKKK'
  ]);
  const y = st.cells[I(2, 2)]; y.hp = 9; y.mhp = 9;
  const w = walk(st, [I(1, 2), I(1, 1), I(2, 1), I(3, 1)]);
  const info = S.preview(st, w.path, w.closed);
  check('となりの 花火 4つ → 4 あたる', info.targets.length === 1 && info.targets[0].dmg === 4, 'dmg=' + (info.targets[0] || {}).dmg);
  st.P.items.hanabidama = 1; st.S = S.stats(st.P);
  check('大玉花火で 1つの 妖に +1', S.preview(st, w.path, w.closed).targets[0].dmg === 5);
}
// 5. 輪の 中の 玉は 輪の 色として かぞえる
{
  const st = S.newBattle('a2b1', S.newPlayer(), 3);
  setBoard(st, [
    'HHHHHHH',
    'HDDDHHH',
    'HDKDHHH',
    'HDDDHHH',
    'HHHHHHH',
    'HHHHHHH',
    'HHHHHHH'
  ]);
  st.P.hp = 2;
  const ring = [I(1, 1), I(2, 1), I(3, 1), I(3, 2), I(3, 3), I(2, 3), I(1, 3), I(1, 2)];
  st.P.items.himo = 2; st.S = S.stats(st.P);
  const w = walk(st, ring.concat([I(1, 1)]));
  const info = S.preview(st, w.path, w.closed);
  check('団子8つの 輪の 中の 小判1つも 団子として 9', w.closed && info.count === 9 && info.healRaw === 9, 'count=' + info.count);
}
// 6. 妖は 落ちない・玉は うしろを すりぬける
{
  const st = S.newBattle('a2b1', S.newPlayer(), 3);
  st.queue = [];
  setBoard(st, [
    'KDKDKDK',
    'DKHKDKD',
    'KDyDKDK',
    'DKDKDKD',
    'KDKDKDK',
    'DKDKDKD',
    'KDKDKDK'
  ]);
  const above = st.cells[I(2, 1)].id;
  st.cells[I(2, 3)] = null;
  S.settle(st);
  check('妖は 宙に うかんだまま', st.cells[I(2, 2)].k === 'y');
  check('妖の 上の 玉が 妖を すりぬけて 下へ 落ちる', st.cells[I(2, 3)].id === above);
}
// 7. 妖の 番：数字・こうげき・お面
{
  const P = S.newPlayer();
  P.items.omen = 1;
  const st = S.newBattle('a1b1', P, 1);
  const y = st.cells[I(3, 2)];
  y.cd = 1;
  const ev = S.enemies(st);
  check('数字が 0 → こうげき（お面が ふせぐ）', ev.some(e => e.e === 'blocked') && P.hp === 12 && st.blocks === 0);
  y.cd = 1;
  const ev2 = S.enemies(st);
  check('お面が なければ 体力が へる', ev2.some(e => e.e === 'hurt') && P.hp === 11);
  check('こうげきの あと 数字は もとに もどる', y.cd === y.cdMax);
}
// 8. めずらしい妖は にげる／河童は 小判を とる／鬼火は はじける
{
  const P = S.newPlayer();
  const st = S.newBattle('a1e', P, 5);
  const rare = S.yokaiList(st).map(i => st.cells[i]).find(c => c.sp === 'zashiki');
  check('★の 道では めずらしい妖が はじめから いる', !!rare);
  const lanterns = S.neighbors8(S.findPiece(st, rare.id)).filter(j => st.cells[j] && st.cells[j].t === 'L').length;
  check('めずらしい妖は 提灯を もって あらわれる（となりに 2つ以上）', lanterns >= 2, 'となりの 提灯 ' + lanterns);
  const ri = S.findPiece(st, rare.id);
  check('めずらしい妖は 盤の 内側（ふちから 2マス以上）', S.cx(ri) >= 2 && S.cx(ri) <= 4 && S.cy(ri) >= 2 && S.cy(ri) <= 4);
  let fled = false;
  for (let k = 0; k < 6 && !fled; k++) { for (const i of S.yokaiList(st)) if (st.cells[i].sp !== 'zashiki') st.cells[i].cd = 99; const ev = S.enemies(st); fled = ev.some(e => e.e === 'flee'); }
  check('めずらしい妖は 6手で にげる', fled && S.findPiece(st, rare.id) < 0);

  const P2 = S.newPlayer(); P2.coins = 10;
  const st2 = S.newBattle('a3b1', P2, 7);
  const kp = S.yokaiList(st2).map(i => st2.cells[i]).find(c => c.sp === 'kappa');
  for (const i of S.yokaiList(st2)) st2.cells[i].cd = 99;
  kp.cd = 1;
  S.enemies(st2);
  check('河童は 小判を 3まい とる', P2.coins === 7);

  const st3 = S.newBattle('a2b1', S.newPlayer(), 3);
  setBoard(st3, [
    'KKKKKKK',
    'KHHHKKK',
    'KDyyKKK',
    'KDDDKKK',
    'KKKKKKK',
    'DDDDDDD',
    'KKKKKKK'
  ]);
  const a = st3.cells[I(2, 2)], b = st3.cells[I(3, 2)];
  a.sp = 'onibi'; a.hp = 1; b.hp = 5; b.mhp = 5;
  const w = walk(st3, [I(1, 1), I(2, 1), I(3, 1)]);
  S.resolve(st3, w.path, w.closed);
  // となりの妖（体力5）は 花火2つで 2、鬼火の 火で 3 → 0
  check('鬼火を おいはらうと となりの妖に 3 あたる', b.hp === 0, 'となりの 体力 ' + b.hp);
}
// 9. ぬし
{
  const P = S.newPlayer();
  const st = S.newBattle('a1boss', P, 9);
  check('ぬしが いる', st.boss && st.boss.sp === 'danuki' && st.boss.hp === D.SPECIES.danuki.hp);
  // 花火の 鎖を さがして ぬしへの とどき を 確かめる
  const m = S.searchChains(st, (info) => info.type === 'H' ? info.count : -1);
  const info = S.preview(st, m.path, m.closed);
  check('花火の 鎖は つないだ数だけ ぬしに とどく', info.bossDmg === info.count + st.S.fire);
  st.boss.hp = 1;
  const r = S.resolve(st, m.path, m.closed);
  check('ぬしの 体力が 0 → おとなしくなって ともだちに', st.outcome === 'win' && P.friends.danuki === 1 && r.ev.some(e => e.e === 'bossCalm'));
}
// 10. かこめる妖の 見つけかたと、じっさいの なぞりの 一致（ランダムな 盤で）
{
  let found = 0, valid = 0, onEdge = 0, stuckBoards = 0, total = 0;
  for (let s = 1; s <= 400; s++) {
    const bid = ['a1b2', 'a2b2', 'a3b2', 'a4b1'][s % 4];
    const st = S.newBattle(bid, S.newPlayer(), s * 13);
    for (let t = 0; t < 4 && !st.outcome; t++) {
      total++;
      for (const i of S.yokaiList(st)) if (!S.inner(S.cx(i), S.cy(i)) && st.cells[i].sp !== 'kasa') onEdge++;
      if (!S.hasMove(st)) stuckBoards++;
      for (const r of S.ringables(st)) {
        found++;
        const w = walk(st, r.ring.concat([r.ring[0]]));
        const info = S.preview(st, w.path, w.closed);
        if (w.closed && info.befriend.includes(r.id) && w.path.length <= st.S.cord) valid++;
      }
      const m = S.searchChains(st, (info) => info.count, { budget: 3000 });
      if (!m) break;
      S.fullTurn(st, m.path, m.closed);
    }
  }
  check('「かこめる」と 光らせた妖は、その輪を じっさいに なぞれる', found > 0 && valid === found, valid + ' / ' + found);
  check('妖が 盤の ふちに あらわれない', onEdge === 0, 'ふち ' + onEdge);
  check('つなげる 手が ない 盤が のこらない（まぜなおし）', stuckBoards === 0, total + ' 盤を 確認');
}
// 11. 同じ たね → 同じ 盤
{
  const a = S.newBattle('a3b2', S.newPlayer(), 42), b = S.newBattle('a3b2', S.newPlayer(), 42);
  check('同じ たねなら 同じ 盤', JSON.stringify(a.cells) === JSON.stringify(b.cells));
}

out.push('');
out.push(`合計 ${ok + ng} 項目：OK ${ok} / NG ${ng}`);
const text = out.join('\n');
console.log(text);
fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'results', 'rules-test.txt'), text + '\n');
process.exitCode = ng ? 1 : 0;
