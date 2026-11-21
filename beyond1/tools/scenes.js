/* 賽駆け 天下 — 画面検証用のシーン（保存データ）を作る
   node tools/scenes.js [out.json]
   本物のエンジン（E.newGame など）で状態を作り、領地・軍勢・季節などを書き換えて、ふつうの保存データの形で出す。
   通常のプレイで到達した状態ではない（人工的な検証用の状態）ことを示すため、各状態に testScene を付ける。
   使い方：tools/ui_check.py が、使い捨てのブラウザの保存領域に入れて「つづきから」で読み込む。
   利用者のブラウザの保存データには触れない。 */
'use strict';
const fs = require('fs');
const E = require('../js/engine.js');
const PI = E.PI, P = E.P;

function bfsFrom(start, ok) {
  const seen = new Set([start]), q = [start], out = [];
  while (q.length) { const u = q.shift(); out.push(u); for (const v of E.padj[u]) if (!seen.has(v) && ok(v)) { seen.add(v); q.push(v); } }
  return out;
}
// 本拠から近い順に国を与える（stop(s) が真になるまで）
function grow(s, c, stop, opt) {
  opt = opt || {};
  const order = bfsFrom(PI[E.CLAN[c].start[0]], v => !(opt.avoid || []).includes(v));
  for (const p of order) { if (stop(s)) break; s.owner[p] = c; }
}
function cleanup(s) {
  for (const c of E.CLAN_IDS) {
    if (!s.clans[c].alive) continue;
    if (E.provCount(s, c) === 0) { s.clans[c].alive = false; s.clans[c].fell = { turn: s.turn, by: s.player }; s.armies = s.armies.filter(a => a.c !== c); }
  }
  // 他家の城に立っている軍勢、重なった軍勢を取り除く
  const used = new Set();
  s.armies = s.armies.filter(a => {
    const nd = E.nodes[a.n];
    if (nd.kind === 'c' && s.owner[nd.p] !== a.c) return false;
    if (used.has(a.n)) return false;
    used.add(a.n); return true;
  });
}
// 自軍を n 部隊にそろえる（自分の城 → 城の外の国境の順に置く。前線を優先）
function setArmies(s, c, n, t) {
  cleanup(s);
  s.armies = s.armies.filter(a => a.c !== c);
  const taken = new Set(s.armies.map(a => a.n));
  const mine = E.provsOf(s, c);
  const front = p => E.padj[p].some(q => s.owner[q] !== c);
  const spots = mine.filter(front).concat(mine.filter(p => !front(p)));
  for (const p of mine) for (const m of E.adj[p]) { const nd = E.nodes[m]; if (s.owner[nd.a] !== c || s.owner[nd.b] !== c) spots.push(m); }
  for (const n0 of spots) {
    if (E.armiesOf(s, c).length >= n) break;
    if (taken.has(n0)) continue;
    taken.add(n0);
    s.armies.push({ id: s.aid++, c, n: n0, t: t || 8, mv: false });
  }
}
function finish(s, id, note, opt) {
  opt = opt || {};
  cleanup(s);
  for (let p = 0; p < P; p++) s.gar[p] = Math.min(E.garMax(s, p, s.owner[p]), Math.max(1, s.gar[p]));
  s.order = s.baseOrder.filter(c => s.clans[c].alive);
  s.oi = 0; s.cur = s.player;
  s.phase = opt.phase || 'roll';
  s.dice = (opt.dice || []).map(v => ({ v, u: false }));
  s.rer = false;
  for (const a of s.armies) { a.mv = false; delete a.dom; }
  for (const c of E.CLAN_IDS) { const n = E.provCount(s, c); if (n > s.clans[c].peak) s.clans[c].peak = n; }
  s.hist.push((() => { const k = E.kokAll(s), o = {}; for (const c in k) if (k[c] > 0) o[c] = k[c]; return o; })());
  s.testScene = id;
  s.testNote = note;
  return s;
}
const kokOf = (s, c) => E.kokOf(s, c);

const scenes = {};
function add(id, note, s) { scenes[id] = s; }

// S01〜S04：賽の数（織田＝振り直しの家風あり）
for (const [id, want, kyo] of [['S01', 6, false], ['S02', 7, false], ['S03', 8, false], ['S04', 9, true]]) {
  const s = E.newGame('oda', 101, {}); s.turn = 12;
  const avoid = kyo ? [] : [E.KYO];
  grow(s, 'oda', x => E.diceCount(x, 'oda') >= want, { avoid });
  if (kyo && s.owner[E.KYO] !== 'oda') s.owner[E.KYO] = 'oda';
  setArmies(s, 'oda', Math.min(E.slots(s, 'oda'), want + 1), 8);
  add(id, '賽' + want + '個', finish(s, id, '賽' + want + '個' + (kyo ? '・京を支配' : '')));
  if (E.diceCount(s, 'oda') !== want) throw new Error(id + ' dice ' + E.diceCount(s, 'oda'));
}
// S05：軍勢12部隊
{
  const s = E.newGame('oda', 105, {}); s.turn = 20;
  grow(s, 'oda', x => E.slots(x, 'oda') >= 12, { avoid: [E.KYO] });
  setArmies(s, 'oda', 12, 7);
  add('S05', '軍勢12', finish(s, 'S05', '軍勢12部隊'));
}
// S06〜S09：大きな領国
for (const [id, n] of [['S06', 20], ['S07', 40], ['S08', 60], ['S09', 85]]) {
  const s = E.newGame('oda', 106 + n, {}); s.turn = 24 + n / 5;
  grow(s, 'oda', x => E.provCount(x, 'oda') >= n);
  setArmies(s, 'oda', E.slots(s, 'oda'), 8);
  add(id, n + 'か国', finish(s, id, '領国' + n + 'か国'));
}
// S10：北九州で軍勢が密集した合戦前（大友）
{
  const s = E.newGame('otomo', 110, {}); s.turn = 14;
  for (const id of ['chikugo', 'higo']) s.owner[PI[id]] = 'otomo';
  s.armies = s.armies.filter(a => !['otomo', 'ryuzoji', 'kamachi', 'arima', 'aso'].includes(a.c));
  const put = (c, ref, t) => s.armies.push({ id: s.aid++, c, n: E.nodeOf(ref), t, mv: false });
  put('otomo', 'chikuzen', 9); put('otomo', 'chikugo', 8); put('otomo', 'bungo', 9); put('otomo', 'higo', 7);
  put('otomo', 'chikugo-higo', 6); put('otomo', 'chikuzen-chikugo', 7);
  put('ryuzoji', 'hizen', 9); put('ryuzoji', 'chikuzen-hizen', 8); put('ryuzoji', 'chikugo-hizen', 7); put('ryuzoji', 'hizen-nishihizen', 5);
  put('arima', 'nishihizen', 5); put('arima', 'higo-nishihizen', 4);
  put('shimazu', 'higo-minamihigo', 8); put('sagara', 'minamihigo', 5);
  add('S10', '密集', finish(s, 'S10', '北九州で軍勢が密集'));
}
// S11：臣従の申し出（北条に里見が）
{
  const s = E.newGame('hojo', 111, {}); s.turn = 16;
  grow(s, 'hojo', x => E.provCount(x, 'hojo') >= 9, { avoid: [PI.kazusa, PI.boshu] });
  setArmies(s, 'hojo', E.slots(s, 'hojo'), 8);
  finish(s, 'S11', '臣従の申し出');
  s.offers = [{ c: 'satomi', turn: s.turn }];
  add('S11', '臣従', s);
}
// S12：期間の区切り（決断待ち）
{
  const s = E.newGame('mori', 112, {});
  grow(s, 'mori', x => E.provCount(x, 'mori') >= 9);
  setArmies(s, 'mori', E.slots(s, 'mori'), 8);
  finish(s, 'S12', '区切りの決断');
  s.turn = 40; s.maxTurn = 40; s.phase = 'decide'; s.cur = null;
  add('S12', '区切り', s);
}
// S13：最後の一国（美濃）を攻める直前。奇襲の出目1を持つ
{
  const s = E.newGame('oda', 113, {}); s.turn = 90; s.maxTurn = 100; s.ext = 3;
  for (let p = 0; p < P; p++) s.owner[p] = 'oda';
  s.owner[PI.mino] = 'saito';
  s.armies = [];
  const put = (c, ref, t) => s.armies.push({ id: s.aid++, c, n: E.nodeOf(ref), t, mv: false });
  put('oda', 'mino-owari', 10); put('oda', 'mino-hida', 9); put('oda', 'echizen-mino', 9); put('oda', 'mino-minamishinano', 9);
  finish(s, 'S13', '天下統一の直前', { phase: 'move', dice: [1, 3, 5, 6, 2, 4, 6, 3, 2] });
  s.gar[PI.mino] = 1;
  add('S13', '統一前', s);
}
// S15：日向の軍勢と、豊予海峡の陣（Dots の UI-03 の再現用）。強行軍で 4+4
{
  const s = E.newGame('shimazu', 115, {}); s.turn = 18;
  for (const id of ['osumi', 'hyuga', 'minamihigo', 'bungo', 'buzen']) s.owner[PI[id]] = 'shimazu';
  s.armies = s.armies.filter(a => !['shimazu', 'otomo', 'ito', 'kimotsuki', 'sagara'].includes(a.c));
  const put = (c, ref, t) => s.armies.push({ id: s.aid++, c, n: E.nodeOf(ref), t, mv: false });
  put('shimazu', 'hyuga', 9); put('shimazu', 'satsuma', 8); put('shimazu', 'bungo', 6);
  put('kono', 'iyo', 6);
  finish(s, 'S15', '日向から豊予海峡へ', { phase: 'move', dice: [4, 4, 2] });
  add('S15', '上端', s);
}

const out = process.argv[2] || null;
const json = JSON.stringify(scenes);
if (out) fs.writeFileSync(out, json);
for (const id in scenes) {
  const s = scenes[id];
  console.log(id, s.testNote, '| player', s.player, 'provs', E.provCount(s, s.player), 'kok', kokOf(s, s.player), 'dice', E.diceCount(s, s.player), 'armies', E.armiesOf(s, s.player).length + '/' + E.slots(s, s.player), 'phase', s.phase, 'bytes', JSON.stringify(s).length);
}
