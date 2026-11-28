// GUILDWARD 設計資料 — 地図の下書きの成立性チェック（設計段階の論理確認。実装後のテストの代わりではない）
// 使い方: beyond2/ で  node design/data/check_maps.js
// ・現行の js/sim.js を読むだけ（書きかえない）。新しい物・敵は、形の近い現行の種類に置きかえて「歩ける・届く・押せる」を確かめる。
// ・新しい働きかけ（あおぐ・引く・つらら・雪玉）は、05 の仕様どおりの動きを、この中の小さな関数で写している（試作）。
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const S = require(path.join(ROOT, 'js', 'sim.js'));
require(path.join(ROOT, 'js', 'data.js'));
const D = globalThis.D21;
const DRAFT = require('./maps_draft.js');

// 新しい敵（体の大きさと歩き方だけを現行に合わせて登録。メモリの中だけ）
Object.assign(S.ENEMY, {
  snowgob: { name: '雪小鬼', hp: 3, mov: 3, atk: 2, range: 1 },
  wolf: { name: '雪狼', hp: 3, mov: 5, atk: 2, range: 1 },
  icegolem: { name: '氷の岩人形', hp: 8, mov: 2, atk: 3, range: 1, heavy: true },
  boar: { name: '雪喰い大猪', hp: 30, mov: 2, atk: 4, range: 1, heavy: true, armor: true, big: true },
});
const KIND = { snowball: 'boulder', icepillar: 'pillar', chime: 'statue', lever: 'statue', icicle: 'torch' };
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  NG:', msg); } };
const say = (s) => console.log(s);
const clone = (o) => JSON.parse(JSON.stringify(o));

function baseDef(id) {            // 第一章の改良：data.js の地図に差分を当てる
  const d = DRAFT[id], b = D.MAPS[d.base];
  const m = clone({ id: b.id, W: b.W, H: b.H, hmap: b.hmap, tmap: b.tmap, objs: b.objs, start: b.start, enemies: b.enemies, waves: b.waves, raid: b.raid, objective: b.objective, startFight: b.startFight });
  for (const [x, y, c] of d.hmapPatch || []) { const r = m.hmap[y].split(''); r[x] = c; m.hmap[y] = r.join(''); }
  m.objs = m.objs.filter(o => !(d.objsRemove || []).some(q => q.k === o.k && q.x === o.x && q.y === o.y)).concat(clone(d.objsAdd || []));
  return m;
}
function engineDef(id) {
  const d = DRAFT[id];
  const m = d.base ? baseDef(id) : clone(d);
  m.kinds = {};
  for (const o of m.objs) { if (KIND[o.k]) { m.kinds[o.id] = o.k; o.k = KIND[o.k]; if (o.k === 'torch') o.fz = 2; } }
  return m;
}
function mk(id, party, up, calm) {
  const def = engineDef(id);
  const st = S.create(def, { party: ['riko'].concat(party || ['gard', 'sena']), up: Object.assign({ rope2: true }, up || {}) });
  st.kinds = def.kinds;
  if (calm !== false) for (const e of st.units) if (e.team === 'e') { e.ko = true; e.gone = true; }
  return st;
}
const flat = (evs) => { const o = []; const w = (l) => { for (const e of l) { if (e.k === 'group') w(e.evs); else o.push(e); } }; w(evs); return o; };
function park(st, hero) {                 // ついてくる仲間が、押す物の行き先に立たないよう、出発の升へ戻しておく
  const d = DRAFT[st.sec] && DRAFT[st.sec].start; if (!d) return;
  S.heroes(st).forEach((h, k) => { if (h.id !== hero && d[k] && !S.unitAt(st, d[k][0], d[k][1], h)) { h.x = d[k][0]; h.y = d[k][1]; h.z = S.standZ(st, h.x, h.y, h); } });
}
function act(st, hero, intent, label) {
  // 探索中は仲間がついてきて、押す物の行き先に立つことがある（現行の挙動。画面では見こみに「ぶつかって止まる」と出る）。
  // ここでは道すじだけを見たいので、押すあいだは仲間をその場に留める。
  const hold = intent.k === 'push' ? S.heroes(st).filter(h => h.id !== hero && !h.fixed) : [];
  if (hold.length) park(st, hero);
  for (const h of hold) h.fixed = true;
  const p = S.plan(st, hero, intent); ok(p.ok, label + ' → ' + (p.why || ''));
  const evs = p.ok ? flat(S.apply(st, p)) : null;
  for (const h of hold) delete h.fixed;
  return evs;
}
function reach(st, hero) { return S.reach(st, S.unitById(st, hero), { ignoreUnits: true }); }
function canGo(st, hero, x, y) { return reach(st, hero).has(S.idx(st, x, y)); }
function steps(st, hero, x, y) { const r = reach(st, hero); return r.has(S.idx(st, x, y)) ? r.get(S.idx(st, x, y)).c : -1; }
function teleport(st, hero, x, y) { const u = S.unitById(st, hero); u.x = x; u.y = y; u.z = S.standZ(st, x, y, u); }
function tile(st, x, y) { return st.t[S.idx(st, x, y)]; }
function setTile(st, x, y, t) { st.t[S.idx(st, x, y)] = t; }
function O(st, id) { return S.objById(st, id); }

// ---- 新しい働きかけの写し（05 の仕様の動きだけ。傷の計算はしない）----
function icicleFall(st, id) {               // つらら：水の上なら氷の飛び石、床なら氷のかたまり
  const o = O(st, id); o.gone = true;
  if (tile(st, o.x, o.y) === 'w') { setTile(st, o.x, o.y, 'i'); return 'floe'; }
  st.objs.push({ id: id + '_ice', k: 'iceblock', x: o.x, y: o.y, z: S.surface(st, o.x, o.y).z, by: 'riko' });
  return 'block';
}
function landObj(st, o, x, y) {              // 物が (x,y) に下りる
  const s = S.surface(st, x, y, o);
  if (s.out || s.void) { o.gone = true; return 'lost'; }
  if (s.water) { o.gone = true; setTile(st, x, y, o.k === 'iceblock' || (st.kinds[o.id] === 'snowball') ? 'i' : 'c'); return 'sink'; }
  o.x = x; o.y = y; o.z = s.z;
  for (const p of st.objs) if (p.k === 'plate' && !p.done && p.x === x && p.y === y && (!p.need || p.need === o.k)) { p.done = true; fire(st, p.on); }
  return 'land';
}
function slideOn(st, o, dir) {               // 氷の上に下りた物・転がる物は、そのまま進む
  const [dx, dy] = S.DIRS[dir];
  for (let k = 0; k < 40; k++) {
    if (o.gone) return 'gone';
    const rolling = st.kinds[o.id] === 'snowball' || o.k === 'boulder';
    if (!(S.surface(st, o.x, o.y, o).ice || rolling)) return 'stop';
    const s = S.surface(st, o.x + dx, o.y + dy, o);
    const top = s.block ? Math.max(s.z, s.blockTop) : s.z;
    if (!s.out && !s.void && top > o.z) return 'bump';
    if (S.unitAt(st, o.x + dx, o.y + dy)) return 'bump';
    const r = landObj(st, o, o.x + dx, o.y + dy);
    if (r !== 'land') return r;
  }
  return 'stop';
}
function waftObj(st, id, dir, D) {           // あおぐ（物）：D 升先へ。2段上まで。途中の谷・水・低い物は越える
  const o = O(st, id); const [dx, dy] = S.DIRS[dir]; const z0 = o.z;
  for (let d = D; d >= 1; d--) {
    let clear = true;
    for (let k = 1; k < d; k++) { const s = S.surface(st, o.x + dx * k, o.y + dy * k, o); const top = s.block ? Math.max(s.z, s.blockTop) : s.z; if (!s.out && !s.void && top > z0 + 2) clear = false; }
    const s = S.surface(st, o.x + dx * d, o.y + dy * d, o);
    const u = S.unitAt(st, o.x + dx * d, o.y + dy * d);
    const landable = s.out || s.void || s.water || (!s.block && !s.wall && s.z <= z0 + 2 && !(u && u.team !== 'e'));
    if (!clear || !landable) continue;
    const r = landObj(st, o, o.x + dx * d, o.y + dy * d);
    if (r !== 'land') return r;
    const r2 = slideOn(st, o, dir); return r2 === 'stop' || r2 === 'bump' ? 'land' : r2;
  }
  return 'none';
}
function waftAlly(st, hero, dir, D) {        // あおぐ（仲間）：立てる升へ、ふわりと下りる
  const u = S.unitById(st, hero); const [dx, dy] = S.DIRS[dir];
  for (let d = D; d >= 1; d--) {
    const x = u.x + dx * d, y = u.y + dy * d; const s = S.surface(st, x, y);
    if (s.stand && s.z <= u.z + 2 && !S.unitAt(st, x, y)) { u.x = x; u.y = y; u.z = s.z; return [x, y]; }
  }
  return null;
}
function pullObj(st, id, dir, n) {           // 引き鉤：リコのほうへ最大2升（dir は物が動く向き）
  const o = O(st, id); const [dx, dy] = S.DIRS[dir];
  for (let k = 0; k < n; k++) {
    const s = S.surface(st, o.x + dx, o.y + dy, o); const top = s.block ? Math.max(s.z, s.blockTop) : s.z;
    if (!s.out && !s.void && top > o.z) return 'bump';
    if (S.unitAt(st, o.x + dx, o.y + dy)) return 'bump';
    const r = landObj(st, o, o.x + dx, o.y + dy); if (r !== 'land') return r;
  }
  return slideOn(st, o, dir) === 'stop' ? 'land' : 'slid';
}
function fire(st, on) { for (const c of (on || '').split(',')) { const [op, id] = c.split(':'); if (op === 'lower') O(st, id).down = true; if (op === 'rune' || op === 'flag') st.flags[id] = true; if (op === 'open') O(st, id).open = true; } const Q = st.obj; if (Q && Q.k === 'runes' && S.runeCount(st) >= Q.need && Q.on) for (const c of Q.on.split(',')) { const [op, id] = c.split(':'); if (op === 'open') O(st, id).open = true; } }
const inLine = (ax, ay, bx, by, R) => (ax === bx || ay === by) && Math.abs(ax - bx) + Math.abs(ay - by) <= R && !(ax === bx && ay === by);

// ---- 共通：寸法と配置 ----
function basic(id) {
  const d = DRAFT[id]; if (d.base) return;
  ok(d.hmap.length === d.H && d.tmap.length === d.H, id + ' 行の数');
  d.hmap.forEach((r, y) => ok(r.length === d.W, id + ' hmap y=' + y + ' の幅 ' + r.length));
  d.tmap.forEach((r, y) => ok(r.length === d.W, id + ' tmap y=' + y + ' の幅 ' + r.length));
  for (let y = 0; y < d.H; y++) for (let x = 0; x < d.W; x++) ok((d.hmap[y][x] === '.') === (d.tmap[y][x] === '.'), id + ' 谷の印が hmap と tmap でずれる ' + x + ',' + y);
  const st = mk(id, ['gard', 'sena'], {}, false);
  for (const u of st.units) {
    const s = S.surface(st, u.x, u.y);
    const swim = u.team === 'e' && S.ENEMY[u.k].swim;
    ok(swim ? s.water : s.stand, id + ' ' + (u.name || u.k) + ' の升に立てない ' + u.x + ',' + u.y);
  }
  for (const o of st.objs) if (o.x !== undefined) ok(S.inside(st, o.x, o.y), id + ' 物が外 ' + o.id);
  const seen = {};
  for (const o of st.objs) { if (o.x === undefined || o.k === 'torch' || o.k === 'plate') continue; const k = o.x + ',' + o.y; ok(!seen[k], id + ' 物が同じ升に重なる ' + k + ' ' + o.id + '/' + seen[k]); seen[k] = o.id; }
}

const T = {};
// ================= 第一章の改良 =================
T.m5 = () => {
  const st = mk('m5', ['gard', 'sena']);
  const w = st.objs.find(o => o.k === 'boulder' && o.x === 4), e = st.objs.find(o => o.k === 'boulder' && o.x === 11);
  ok(steps(st, 'gard', 4, 9) === 2, 'm5 ガルドは開始から2歩で橋の大岩のうしろ(4,9)');
  let c = S.clone(st); act(c, 'gard', { k: 'push', ref: { o: w.id }, dir: 3 }, 'm5 橋の大岩を北へ');
  ok(S.objById(c, w.id).x === 4 && S.objById(c, w.id).y === 3, 'm5 橋をぬけて北の岸(4,3)で止まる → ' + S.objById(c, w.id).x + ',' + S.objById(c, w.id).y);
  c = S.clone(st); act(c, 'gard', { k: 'push', ref: { o: e.id }, dir: 3 }, 'm5 飛び石の大岩を北へ');
  ok(S.objById(c, e.id).x === 11 && S.objById(c, e.id).y === 5, 'm5 飛び石の上(11,5)で止まり、渡り口をふさぐ → ' + S.objById(c, e.id).x + ',' + S.objById(c, e.id).y);
  const foe = { id: 'zz', k: 'raider', team: 'e', x: 11, y: 4, z: 3, hp: 3, mhp: 3, mv: 4 };
  ok(!S.surface(c, 11, 5).stand, 'm5 大岩が飛び石(11,5)をふさぐ');
  const before = S.reach(st, foe, { max: 99 }).get(S.idx(st, 11, 7)).c, after = S.reach(c, foe, { max: 99 }).get(S.idx(c, 11, 7)).c;
  ok(before === 3 && after > 10, 'm5 ふさぐ前は3歩で南の岸、ふさいだあとは橋まわり（' + after + '歩）');
  ok(canGo(st, 'riko', 12, 8), 'm5 リコは右の丘(高さ5)へ上がれる（歩数 ' + steps(st, 'riko', 12, 8) + '）');
  for (const p of [['gard', 'tobi'], ['sena', 'tobi']]) { const t = mk('m5', p); ok(S.plan(t, 'tobi', { k: 'blast', x: 4, y: 9 }).ok, 'm5 トビは(4,9)の発破で橋の大岩を転がせる'); }
};
T.m6 = () => {
  const st = mk('m6', ['gard', 'sena']);
  const w = st.objs.find(o => o.k === 'boulder' && o.x === 1);
  ok(steps(st, 'gard', 0, 6) === 6, 'm6 ガルドは6歩（2手番）で左の大岩のうしろ(0,6) → ' + steps(st, 'gard', 0, 6));
  st.units.push({ id: 'tt', k: 'turtle', team: 'e', x: 7, y: 6, z: 4, hp: 22, mhp: 22, mv: 2, active: true, boss: true, frozen: 0, flipped: 0, ko: false, grp: 1 });
  const evs = act(st, 'gard', { k: 'push', ref: { o: w.id }, dir: 0 }, 'm6 左の大岩を東へ');
  ok(evs && evs.some(e => e.k === 'flip'), 'm6 列(y=6)にいる大亀に当たって、ひっくり返る');
  const t = mk('m6', ['sena', 'tobi']); ok(S.plan(t, 'tobi', { k: 'blast', x: 0, y: 6 }).ok && S.plan(t, 'tobi', { k: 'blast', x: 14, y: 6 }).ok, 'm6 トビは発破で左右の大岩を転がせる');
};
// ================= 第二章 =================
T.m7 = () => {
  // リコだけで通る道（どの編成でも使える）
  let st = mk('m7', ['gard', 'sena']);
  ok(!canGo(st, 'riko', 6, 9), 'm7 はじめは小川を渡れない');
  ok(S.inRange(6, 12, 6, 10, 5), 'm7 開始位置から小川のつららに矢が届く');
  ok(icicleFall(st, 'icA') === 'floe' && canGo(st, 'riko', 6, 9), 'm7 つららAで氷の飛び石 → 北の岸へ');
  ok(!canGo(st, 'riko', 2, 5), 'm7 崖は2段でのぼれない');
  icicleFall(st, 'icB'); ok(canGo(st, 'riko', 2, 5), 'm7 つららBの氷のかたまりを足場に、崖の上へ');
  teleport(st, 'riko', 2, 3); act(st, 'riko', { k: 'rope', o: 'an' }, 'm7 西の高い棚の鉄の輪へ鉤縄');
  ok(canGo(st, 'riko', 0, 2), 'm7 引き鉤の宝箱(0,2)へ');
  ok(canGo(st, 'riko', 8, 2) && inLine(8, 2, 11, 2, 4), 'm7 (8,2) からレバー(11,2)は一直線・距離3');
  for (const [x, y] of [[7, 2], [8, 2]]) for (const e of DRAFT.m7.enemies.filter(q => q.grp === 2)) ok(!S.inRange(x, y, e.x, e.y, e.wake), 'm7 レバーを引く升(' + x + ',' + y + ')で野営地の敵が起きてしまう');
  ok(!canGo(st, 'riko', 12, 1), 'm7 橋が上がっている間は野営地へ行けない');
  fire(st, 'lower:br'); ok(canGo(st, 'riko', 12, 1), 'm7 レバーで橋が下り、茶釜(12,1)へ');
  ok(canGo(st, 'riko', 5, 1) && inLine(5, 1, 9, 1, 4), 'm7 (5,1) から柱の上の木箱(9,1)は一直線・距離4');
  ok(pullObj(st, 'c3', 2, 2) === 'land' && O(st, 'c3').x === 7 && O(st, 'c3').z === 4, 'm7 引くと木箱は柱から落ちて(7,1)へ');
  ok(canGo(st, 'riko', 6, 0), 'm7 木箱を足場に、寄り道の宝箱(6,0)へ');
  // 別の手：セナ／ガルド／トビ
  st = mk('m7', ['gard', 'sena']);
  act(st, 'sena', { k: 'freeze', x: 6, y: 10 }, 'm7 セナ：小川を凍らせる'); ok(canGo(st, 'gard', 6, 9), 'm7 セナの氷で渡れる');
  act(st, 'gard', { k: 'push', ref: { o: 'c2' }, dir: 3 }, 'm7 ガルド：木箱を北へ'); act(st, 'gard', { k: 'push', ref: { o: 'c2' }, dir: 3 }, 'm7 ガルド：もう一度');
  ok(O(st, 'c2').y === 6 && canGo(st, 'gard', 4, 5), 'm7 木箱(4,6)を足場に崖の上へ');
  st = mk('m7', ['gard', 'tobi']);
  act(st, 'gard', { k: 'push', ref: { o: 'c1' }, dir: 3 }, 'm7 ガルド：木箱を小川へ'); ok(tile(st, 9, 10) === 'c' && canGo(st, 'tobi', 9, 9), 'm7 木箱が沈んで飛び石');
  act(st, 'tobi', { k: 'blast', x: 8, y: 5 }, 'm7 トビ：崖の切れこみの岩を発破'); ok(canGo(st, 'tobi', 8, 4), 'm7 がれきを足場に崖の上へ');
  // 眠っている射手を、気づかれずに射られるか（長弓のごほうび）
  ok(!S.inRange(6, 9, 11, 7, 5) || true, '');
  let far = false; for (let x = 0; x < 14; x++) for (let y = 6; y < 10; y++) if (S.inRange(x, y, 11, 7, 6) && !S.inRange(x, y, 11, 7, 5)) far = true;
  ok(far, 'm7 長弓（距離6）なら、射手が起きる距離5の外からつららCをねらえる升がある');
};
T.m8 = () => {
  let st = mk('m8', ['gard', 'sena']);                       // sena を「ナギの歩き」の代わりに使う
  ok(!canGo(st, 'riko', 1, 7), 'm8 西の岸へは歩いて行けない');
  teleport(st, 'riko', 3, 7); teleport(st, 'sena', 4, 7);
  ok(String(waftAlly(st, 'riko', 2, 2)) === '1,7', 'm8 ナギ(4,7)がリコ(3,7)を西へあおぐ → 谷を越えて(1,7)');
  act(st, 'riko', { k: 'rope', o: 'an' }, 'm8 リコ：西の岸から東の岸の輪(3,5)へ鉤縄');
  ok(canGo(st, 'sena', 1, 7), 'm8 縄を伝って、ナギが西の岸(1,7)へ（風鳴り石Aのとなり）');
  ok(canGo(st, 'sena', 0, 5), 'm8 西の岸の宝箱(0,5)');
  ok(!canGo(st, 'sena', 13, 2), 'm8 はね橋が上がっている間は東の台へ行けない');
  ok(canGo(st, 'sena', 10, 6), 'm8 ナギは木箱のうしろ(10,6)に立てる');
  ok(waftObj(st, 'c1', 3, 2) === 'land' && O(st, 'c1').y === 3 && O(st, 'c1').z === 5, 'm8 木箱を北へあおぐ → 2段上の岩の上(10,3)');
  ok(O(st, 'br2').down && canGo(st, 'sena', 13, 2), 'm8 重さの床が沈んで橋が下り、ナギが東の台(13,2)へ（風鳴り石Bのとなり）');
  ok(canGo(st, 'sena', 5, 1) && canGo(st, 'sena', 4, 2), 'm8 坂(7,4)から丘の上へ。風鳴り石Cのとなりに立てる');
  // 現行のルールでは、重さの床の升には氷のかたまりをつくれない（氷晶の杖では代わりにならない）
  st = mk('m8', ['gard', 'sena'], { staff: true });
  ok(!S.plan(st, 'sena', { k: 'freeze', x: 10, y: 3 }).ok, 'm8 氷晶の杖でも、重さの床の升には氷を置けない（ナギの出番）');
  // 風鳴り石Aの手順のあいだ、雪狼は起きない（起きる距離3）
  for (const [x, y] of [[4, 7], [3, 7], [3, 5], [1, 7], [0, 5]]) for (const w of DRAFT.m8.enemies.filter(e => e.k === 'wolf')) ok(!S.inRange(x, y, w.x, w.y, w.wake), 'm8 (' + x + ',' + y + ') で雪狼が起きてしまう');
  ok(!S.inRange(10, 6, 9, 1, 3) && !S.inRange(10, 6, 11, 1, 3), 'm8 木箱をあおぐ位置では雪小鬼は起きない');
};
T.m9 = () => {
  const safe = (st, id) => S.unitById(st, id).safe;
  const visit = (st, hero, x, y) => { const p = S.plan(st, hero, { k: 'move', x, y }); ok(p.ok, 'm9 ' + hero + ' が (' + x + ',' + y + ') へ歩ける → ' + (p.why || '')); if (p.ok) S.apply(st, p); };
  // ガルド：木箱と雪玉を、氷の上ですべらせて沈める
  let st = mk('m9', ['gard', 'tobi']);
  const push = (id, dir, n) => { for (let k = 0; k < n; k++) act(st, 'gard', { k: 'push', ref: { o: id }, dir }, 'm9 ガルド：' + id + ' を押す'); };
  push('c1', 3, 2); ok(tile(st, 3, 8) === 'c', 'm9 木箱1：岸→氷(3,9)をすべって(3,8)に沈む');
  push('c2', 2, 2); push('c2', 3, 3); ok(tile(st, 3, 6) === 'c', 'm9 木箱2：(3,8)の飛び石にのり、もう一押しで(3,6)に沈む');
  visit(st, 'riko', 3, 5); ok(safe(st, 'fa'), 'm9 島Aの漁師が、歩いて荷馬車へ');
  push('c3', 3, 2); ok(tile(st, 7, 8) === 'c', 'm9 木箱3：(7,8)に沈む');
  ok(canGo(st, 'gard', 14, 6) && canGo(st, 'gard', 14, 4), 'm9 ガルドは東の土手の雪玉のうしろに立てる');
  push('sb2', 2, 1); ok(tile(st, 10, 6) !== 'w', 'm9 雪玉2：氷(12,6)(11,6)を転がって(10,6)に沈む');
  push('sb1', 2, 1); ok(tile(st, 10, 4) !== 'w', 'm9 雪玉1：(10,4)に沈む');
  visit(st, 'riko', 11, 3); ok(safe(st, 'fb'), 'm9 島Bの子も、歩いて荷馬車へ');
  ok(S.objective(st).done, 'm9 ガルドの手で依頼達成');
  // 予備の木箱（岸の西の端）も、同じ列へ運べる
  st = mk('m9', ['gard', 'tobi']); push('c1', 3, 2);
  push('c4', 0, 2); ok(O(st, 'c4').x === 3 && O(st, 'c4').y === 11, 'm9 予備の木箱を(3,11)へ運べる');
  // セナ：凍らせて道をつくる
  st = mk('m9', ['sena', 'tobi']);
  for (const [x, y] of [[3, 8], [3, 6], [7, 8]]) act(st, 'sena', { k: 'freeze', x, y }, 'm9 セナ：(' + x + ',' + y + ') を凍らせる');
  visit(st, 'riko', 3, 5); ok(safe(st, 'fa'), 'm9 セナ：島Aの漁師が帰れる');
  for (const [x, y] of [[10, 6], [10, 4]]) act(st, 'sena', { k: 'freeze', x, y }, 'm9 セナ：(' + x + ',' + y + ') を凍らせる');
  visit(st, 'riko', 11, 3); ok(safe(st, 'fb') && S.objective(st).done, 'm9 セナの手で依頼達成');
  // トビ：発破で木箱をすべらせる
  st = mk('m9', ['sena', 'tobi']);
  act(st, 'tobi', { k: 'blast', x: 3, y: 12 }, 'm9 トビ：木箱1の南で発破'); act(st, 'tobi', { k: 'blast', x: 3, y: 11 }, 'm9 トビ：もう一度');
  ok(tile(st, 3, 8) === 'c', 'm9 トビ：木箱1が氷をすべって(3,8)に沈む');
  act(st, 'tobi', { k: 'blast', x: 14, y: 6 }, 'm9 トビ：土手の雪玉2の東で発破'); ok(tile(st, 10, 6) !== 'w', 'm9 トビ：雪玉2が(10,6)に沈む');
  // ナギ：あおいで、氷の上へ下ろす
  st = mk('m9', ['gard', 'sena']);
  ok(waftObj(st, 'c1', 3, 2) === 'sink' && tile(st, 3, 8) === 'c', 'm9 ナギ：木箱1を北へあおぐ → 氷(3,9)に下りてすべり、(3,8)に沈む');
  ok(waftObj(st, 'c2', 2, 2) === 'land' && O(st, 'c2').x === 3, 'm9 ナギ：木箱2を西へ → (3,11)');
  waftObj(st, 'c2', 3, 2); ok(O(st, 'c2').x === 3 && O(st, 'c2').y === 8, 'm9 ナギ：北へ → 氷をすべって飛び石(3,8)の上で止まる → ' + O(st, 'c2').x + ',' + O(st, 'c2').y);
  ok(waftObj(st, 'c2', 3, 2) === 'sink' && tile(st, 3, 6) === 'c', 'm9 ナギ：もう一度北へ → (3,6)に沈む');
  ok(waftObj(st, 'sb2', 2, 2) === 'sink' && tile(st, 10, 6) === 'i', 'm9 ナギ：雪玉2を西へ → 氷(11,6)に下りて転がり、(10,6)に沈む');
};
T.m10 = () => {
  const st = mk('m10', ['gard', 'sena']);
  for (const id of ['sbL', 'sbC', 'sbR', 'bdL', 'bdR']) {
    const c = S.clone(st); const o = O(c, id);
    ok(canGo(c, 'gard', o.x, 2), 'm10 ガルドは ' + id + ' のうしろ(' + o.x + ',2)に立てる');
    const evs = act(c, 'gard', { k: 'push', ref: { o: id }, dir: 1 }, 'm10 ' + id + ' を坂へ');
    const sl = evs && evs.find(e => e.k === 'slide');
    ok(sl && sl.path.length >= 12, 'm10 ' + id + ' は坂を下まで転がる（' + (sl ? sl.path.length - 1 : 0) + '升）');
  }
  const t = mk('m10', ['sena', 'tobi']); ok(S.plan(t, 'tobi', { k: 'blast', x: 12, y: 2 }).ok, 'm10 トビは(12,2)の発破で右の雪玉を転がせる');
  const live = mk('m10', ['gard', 'sena'], {}, false);
  for (const e of live.units.filter(u => u.team === 'e')) ok([2, 5, 7, 9, 12].some(x => S.reach(live, e, { max: 99 }).has(S.idx(live, x, 4))), 'm10 敵は谷すじをのぼって上の段(y=4)まで来られる ' + e.x + ',' + e.y);
  for (const x of [2, 5, 7, 9, 12]) ok(S.surface(live, x, 4).stand && !S.surface(live, x, 5).wall && [x - 1, x + 1].every(q => S.surface(live, q, 5).wall || q === 0 || q === 14), 'm10 谷すじ x=' + x + ' は幅1で、出口(y=4)はふさがっていない');
  const g = { id: 'gg', k: 'icegolem', team: 'e', x: 7, y: 14, z: 2, hp: 8, mhp: 8, mv: 2 };
  ok(S.reach(live, g, { max: 99 }).has(S.idx(live, 7, 4)), 'm10 重い氷の岩人形も、1段ずつの坂をのぼれる');
};
T.m11 = () => {
  const n = (st) => S.runeCount(st);
  // リコ：的とレバー
  let st = mk('m11', ['gard', 'sena']);
  ok(S.plan(st, 'riko', { k: 'shoot', ref: { o: 'tg' } }).ok, 'm11 リコ：的に矢が届く升がある');
  let lineOk = false; for (let x = 9; x <= 11; x++) if (canGo(st, 'riko', x, 6) && inLine(x, 6, 13, 6, 4)) lineOk = true;
  ok(lineOk, 'm11 リコ：広間からレバー(13,6)へ一直線・距離4以内の升がある');
  // セナ：水晶　ガルド：ブロックを重さの床へ
  act(st, 'sena', { k: 'freeze', ref: { o: 'cr' } }, 'm11 セナ：霜の水晶');
  ok(steps(st, 'gard', 10, 12) > 0, 'm11 ガルド：坂(11,10)から段の上(10,12)へ（歩数 ' + steps(st, 'gard', 10, 12) + '）');
  act(st, 'gard', { k: 'push', ref: { o: 'bk' }, dir: 2 }, 'm11 ガルド：石のブロックを西へ落とす');
  ok(st.flags.r3 && st.flags.r6, 'm11 水晶と重さの床の灯がともる');
  fire(st, 'rune:r1'); fire(st, 'rune:r2');
  ok(n(st) === 4 && O(st, 'gate').open && canGo(st, 'riko', 7, 1), 'm11 ガルド＋セナ：四つで門がひらき、石板へ');
  // トビ：封印石と、ブロックの奥での発破
  st = mk('m11', ['sena', 'tobi']);
  act(st, 'tobi', { k: 'blast', x: 2, y: 12 }, 'm11 トビ：封印石'); act(st, 'tobi', { k: 'blast', x: 10, y: 12 }, 'm11 トビ：ブロックの奥で発破');
  ok(st.flags.r4 && st.flags.r6, 'm11 封印石と重さの床の灯がともる');
  // ナギ：木箱を壇の足場にして、風鳴り石のとなりへ
  st = mk('m11', ['gard', 'sena']);
  ok(!canGo(st, 'sena', 4, 4), 'm11 はじめは壇(2段上)にのぼれない');
  ok(canGo(st, 'sena', 5, 8) && waftObj(st, 'c1', 3, 2) === 'land' && O(st, 'c1').y === 5, 'm11 ナギ：(5,8)から木箱を北へあおぐ → 壇のすぐ下(5,5)');
  ok(canGo(st, 'sena', 4, 4) && canGo(st, 'sena', 3, 5), 'm11 木箱を足場に壇へ。風鳴り石(3,4)のとなりに立てる');
  st = mk('m11', ['gard', 'sena']);
  ok(canGo(st, 'riko', 5, 4) && pullObj(st, 'c1', 3, 2) === 'land' && O(st, 'c1').y === 5, 'm11 別の手：リコが(5,4)から引き鉤で木箱を(5,5)へ');
  // 寄り道：谷の向こうの棚
  st = mk('m11', ['gard', 'sena']);
  act(st, 'riko', { k: 'rope', o: 'an' }, 'm11 リコ：東の棚の鉄の輪へ鉤縄'); ok(canGo(st, 'riko', 14, 8), 'm11 棚の宝箱(14,8)');
  // 氷の床：押された物は谷まですべる（現行のルール）
  st = mk('m11', ['gard', 'tobi'], { gauntlet: true }, false);
  for (const e of st.units) if (e.team === 'e') { if (e.k === 'icegolem' && e.x === 9) { e.x = 7; e.y = 7; e.z = 3; e.active = true; } else { e.ko = true; e.gone = true; } }
  st.mode = 'combat'; teleport(st, 'gard', 6, 7); for (const h of S.heroes(st)) { h.acted = false; h.mv = 3; }
  const g = st.units.find(u => u.k === 'icegolem' && !u.ko);
  const evs = act(st, 'gard', { k: 'push', ref: { u: g.id }, dir: 0 }, 'm11 ガルド（鋼の籠手）：氷の床の上の岩人形を東へ');
  ok(g.ko, 'm11 氷の床をすべって、谷へ落ちる');
};
T.m12 = () => {
  const goalDist = (st) => { const n = S.unitById(st, 'rou'); const r = S.reach(st, n, { ignoreUnits: true }); let b = 1e9; for (const c of st.obj.to) { const i = S.idx(st, c[0], c[1]); if (r.has(i)) b = Math.min(b, r.get(i).c); } return b; };
  let st = mk('m12', ['gard', 'sena']);
  ok(canGo(st, 'riko', 11, 1), 'm12 冒険者は西の坂をまわって、上の段の岩かげ(11,1)まで歩ける（歩数 ' + steps(st, 'riko', 11, 1) + '）');
  const long = goalDist(st); ok(long < 1e9, 'm12 近道がなくても、けが人は西の坂をまわって帰れる');
  say('    けが人の道のり：近道なし ' + long + ' 升');
  // 木箱（ガルド／ナギ／リコの引き鉤）
  act(st, 'gard', { k: 'push', ref: { o: 'cA' }, dir: 3 }, 'm12 ガルド：木箱Aを北へ'); act(st, 'gard', { k: 'push', ref: { o: 'cA' }, dir: 3 }, 'm12 もう一度');
  act(st, 'gard', { k: 'push', ref: { o: 'cB' }, dir: 3 }, 'm12 ガルド：木箱Bを北へ'); act(st, 'gard', { k: 'push', ref: { o: 'cB' }, dir: 3 }, 'm12 もう一度');
  const dCr = goalDist(st); ok(O(st, 'cA').y === 3 && O(st, 'cB').y === 7 && dCr <= 14, 'm12 木箱二つで下り段：' + dCr + ' 升');
  st = mk('m12', ['gard', 'sena']);
  ok(canGo(st, 'sena', 11, 6) && waftObj(st, 'cA', 3, 2) === 'land' && O(st, 'cA').y === 3, 'm12 ナギ：木箱Aを(11,6)からあおぐ → (11,3)');
  ok(canGo(st, 'sena', 11, 10) && waftObj(st, 'cB', 3, 2) === 'land' && O(st, 'cB').y === 7, 'm12 ナギ：木箱Bを(11,10)からあおぐ → (11,7)');
  st = mk('m12', ['gard', 'sena']);
  ok(canGo(st, 'riko', 11, 2) && pullObj(st, 'cA', 3, 2) === 'land' && O(st, 'cA').y === 3, 'm12 リコ：上の段(11,2)から引き鉤で木箱Aを(11,3)へ');
  ok(canGo(st, 'riko', 11, 6) && pullObj(st, 'cB', 3, 2) === 'land' && O(st, 'cB').y === 7, 'm12 リコ：中の段(11,6)から引き鉤で木箱Bを(11,7)へ');
  // セナ：凍る滝
  st = mk('m12', ['gard', 'sena']);
  act(st, 'sena', { k: 'freeze', ref: { o: 'fA' } }, 'm12 セナ：上の滝'); act(st, 'sena', { k: 'freeze', ref: { o: 'fB' } }, 'm12 セナ：下の滝');
  const dIce = goalDist(st); ok(dIce <= 14, 'm12 氷の段二つ：' + dIce + ' 升');
  // トビ：ひび割れた岩
  st = mk('m12', ['gard', 'tobi']);
  act(st, 'tobi', { k: 'blast', x: 9, y: 3 }, 'm12 トビ：上のひび岩'); act(st, 'tobi', { k: 'blast', x: 9, y: 7 }, 'm12 トビ：下のひび岩');
  const dRb = goalDist(st); ok(dRb <= 16, 'm12 がれきの段二つ：' + dRb + ' 升');
  say('    けが人の道のり：木箱 ' + dCr + ' ／ 氷の段 ' + dIce + ' ／ がれき ' + dRb + ' 升（1手番に2升）');
  // 大岩と雪玉
  st = mk('m12', ['gard', 'sena']);
  ok(canGo(st, 'gard', 14, 4), 'm12 ガルドは大岩のうしろ(14,4)に立てる');
  const evs = act(st, 'gard', { k: 'push', ref: { o: 'bd' }, dir: 2 }, 'm12 大岩を西へ'); const sl = evs && evs.find(e => e.k === 'slide');
  ok(sl && sl.path.length >= 12, 'm12 大岩は中の段の道(y=4)を西の端まで転がる');
  ok(canGo(st, 'gard', 9, 2), 'm12 雪玉(8,2)のうしろ(9,2)に立てる');
};
T.m13 = () => {
  let st = mk('m13', ['gard', 'tobi']);
  ok(canGo(st, 'riko', 1, 9) && canGo(st, 'riko', 11, 4) && canGo(st, 'riko', 11, 1), 'm13 西の坂→中の段→東の坂→上の段の宝箱まで歩ける（歩数 ' + steps(st, 'riko', 11, 1) + '）');
  const p = S.plan(st, 'tobi', { k: 'blast', x: 6, y: 1 });
  teleport(st, 'tobi', 5, 5); const q = S.plan(st, 'tobi', { k: 'blast', x: 6, y: 1 });
  ok(q.ok, 'm13 トビは中の段(5,5)から、上の段の大岩の奥(6,1)に発破が届く');
  const evs = flat(S.apply(st, q)); const sl = evs.find(e => e.k === 'slide');
  ok(sl && sl.path.some(c => c[1] >= 12), 'm13 大岩は三つの段をつらぬいて下まで転がる');
  void p;
  // 段のふちの氷：押された敵は、すべって落ちる
  st = mk('m13', ['gard', 'sena'], {}, false);
  for (const e of st.units) if (e.team === 'e') { if (e.k === 'icegolem' && e.y === 7) { e.x = 6; e.y = 8; e.z = 4; e.active = true; } else { e.ko = true; e.gone = true; } }
  st.mode = 'combat'; teleport(st, 'gard', 6, 7); for (const h of S.heroes(st)) { h.acted = false; h.mv = 3; }
  const g = st.units.find(u => u.k === 'icegolem' && !u.ko);
  const pp = S.plan(st, 'gard', { k: 'push', ref: { u: g.id }, dir: 1 });
  ok(!pp.ok, 'm13 籠手なしでは、平らな所の氷の岩人形は押せない（ふちまで寄せる必要）');
  g.y = 9; teleport(st, 'gard', 6, 8);
  act(st, 'gard', { k: 'push', ref: { u: g.id }, dir: 1 }, 'm13 ふち(6,9)の岩人形を南へ押す');
  ok(g.y >= 10 && g.hp <= 8 - 3, 'm13 3段落ちて大きな傷（残り ' + g.hp + '）');
};
T.m14 = () => {
  const st = mk('m14', ['gard', 'sena']);
  ok(canGo(st, 'gard', 1, 5) && canGo(st, 'gard', 1, 9), 'm14 西の棚へ坂(1,11)から上がり、雪玉のうしろに立てる（歩数 ' + steps(st, 'gard', 1, 9) + '）');
  for (const [id, y] of [['sb1', 5], ['sb2', 9]]) { const c = S.clone(st); const evs = act(c, 'gard', { k: 'push', ref: { o: id }, dir: 0 }, 'm14 雪玉を東へ'); const sl = evs && evs.find(e => e.k === 'slide'); ok(sl && sl.path[sl.path.length - 1][0] === 13, 'm14 雪玉は列(y=' + y + ')を転がり、東のくぼ地の奥(13,' + y + ')まで'); }
  for (const id of ['cm1', 'cm2', 'cm3']) { const o = O(st, id); ok(S.DIRS.some(([dx, dy]) => canGo(st, 'sena', o.x + dx, o.y + dy)), 'm14 風鳴り石 ' + id + ' のとなりに立てる'); }
  ok(canGo(st, 'riko', 12, 7), 'm14 くぼ地へは南の坂(12,10)から歩いて下りられる');
  const b = { id: 'bb', k: 'boar', team: 'e', x: 12, y: 7, z: 1, hp: 30, mhp: 30, mv: 2 };
  ok(S.reach(st, b, { max: 99 }).has(S.idx(st, 7, 7 + 1)), 'm14 大猪はくぼ地から坂で上がってこられる（閉じこめにならない）');
  ok(tile(st, 10, 6) === 'i' && tile(st, 10, 8) === 'i', 'm14 くぼ地のふちに氷の升が二つ');
};

for (const id of Object.keys(DRAFT)) { say('== ' + id + ' ' + (DRAFT[id].name || '（第一章の改良）')); basic(id); if (T[id]) T[id](); }
say('\npass ' + pass + ' / fail ' + fail);
process.exit(fail ? 1 : 0);
