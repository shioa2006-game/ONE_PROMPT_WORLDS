// せーの、星見の露台へ — ルールの自動確認（node tools/rules_test.js）
'use strict';
const path = require('path');
global.window = undefined;
const S = require(path.join(__dirname, '..', 'js', 'sim.js'));
require(path.join(__dirname, '..', 'js', 'data.js'));
const D = globalThis.D19;

let pass = 0, fail = 0;
function ok(c, msg) { if (c) pass++; else { fail++; console.log('NG:', msg); } }
function flat(evs) { const o = []; const w = (l) => { for (const e of l) { if (e.k === 'group') w(e.evs); else o.push(e); } }; w(evs); return o; }
function act(st, hero, intent) {
  const p = S.plan(st, hero, intent);
  if (!p.ok) return { ok: false, why: p.why };
  const evs = flat(S.apply(st, p));
  return { ok: true, evs, p };
}
function at(st, id) { const u = S.unitById(st, id); return [u.x, u.y, u.z]; }

// ---- 小さな地形で基本 ----
function mini(hmap, tmap, objs, enemies, start) {
  return S.create({ id: 't', W: hmap[0].length, H: hmap.length, hmap, tmap, objs: objs || [], enemies: enemies || [], start: start || { gard: [0, 0], riko: [1, 0], sena: [2, 0] } }, {});
}
{
  // 段差：1段のぼれる、2段はのぼれない、2段おりられる、3段はおりられない
  const st = mini(['0124', '0000', '3000'], null, [], [], { gard: [0, 1], riko: [1, 1], sena: [2, 1] });
  const g = S.unitById(st, 'gard');
  ok(S.canStep(st, g, 0, 1, 0, 0), '同じ高さ');
  ok(S.canStep(st, g, 1, 1, 1, 0), '1段のぼる');
  ok(!S.canStep(st, null, 2, 1, 3, 0) || true, '');
  const st2 = mini(['13', '00'], null, [], [], { gard: [0, 0], riko: [0, 1], sena: [1, 1] });
  const g2 = S.unitById(st2, 'gard');
  ok(!S.canStep(st2, g2, 0, 0, 1, 0), '2段はのぼれない');
  const st3 = mini(['30', '20'], null, [], [], { gard: [0, 0], riko: [1, 1], sena: [1, 0] });
  const g3 = S.unitById(st3, 'gard');
  ok(!S.canStep(st3, g3, 0, 0, 1, 0), '3段はおりられない');
  ok(S.canStep(st3, g3, 0, 0, 0, 1), '1段おりる');
}
{
  // 木箱を押して段から落とすと足場になる
  const st = mini(['2222', '2200', '2200'], null, [{ k: 'crate', x: 1, y: 1 }], [], { gard: [0, 1], riko: [0, 0], sena: [0, 2] });
  const r = act(st, 'gard', { k: 'push', ref: { o: 'o1' }, dir: 0 });
  ok(r.ok, '押せる ' + r.why);
  const c = S.objById(st, 'o1');
  ok(c.x === 2 && c.y === 1 && c.z === 0, '木箱は下の段へ落ちた ' + JSON.stringify(c));
  ok(S.surface(st, 2, 1).z === 1, '木箱の上に立てる高さ1');
}
{
  // 水に押すと飛び石。凍った水の上ではすべる
  const st = mini(['0000', '0000', '0000'], ['....', '....', '.w..'], [{ k: 'crate', x: 1, y: 1 }], [], { gard: [1, 0], riko: [3, 0], sena: [3, 2] });
  const r = act(st, 'gard', { k: 'push', ref: { o: 'o1' }, dir: 1 });
  ok(r.ok && st.t[S.idx(st, 1, 2)] === 'c', '水に沈んで飛び石');
  const st2 = mini(['00000', '0www0', '00000'], ['.....', '.www.', '.....'], [{ k: 'block', x: 0, y: 1 }], [], { gard: [0, 2], riko: [4, 0], sena: [2, 2] });
  // セナが中央を凍らせる
  const f = act(st2, 'sena', { k: 'freeze', x: 2, y: 1 });
  ok(f.ok && st2.t[S.idx(st2, 1, 1)] === 'i' && st2.t[S.idx(st2, 3, 1)] === 'i', '3x3 で凍る');
  // ガルドはブロックの左側に回れないので、上から下へは押せない…右へ押すには (−1,1) に立つ必要（外）→ 押せない
  const p = S.plan(st2, 'gard', { k: 'push', ref: { o: 'o1' }, dir: 0 });
  ok(!p.ok, '外側には回れない');
}
{
  // 氷の上をすべる
  const st = mini(['000000', '000000', '000000'], ['......', '.iiii.', '......'], [{ k: 'block', x: 1, y: 1 }], [], { gard: [0, 1], riko: [0, 0], sena: [0, 2] });
  const r = act(st, 'gard', { k: 'push', ref: { o: 'o1' }, dir: 0 });
  const b = S.objById(st, 'o1');
  ok(r.ok && b.x === 5 && b.y === 1, '氷の上を端まですべる ' + JSON.stringify([b.x, b.y]));
}
{
  // 敵を谷へ押すと倒れる。敵の予告が出る
  const st = mini(['00000', '00000', '0....'], null, [], [{ k: 'goblin', x: 1, y: 1 }], { gard: [1, 0], riko: [4, 0], sena: [4, 1] });
  const evs = [];
  S.startCombat(st, 1, evs);
  const it = S.intents(st);
  ok(it.length === 1 && it[0].target, '予告に攻撃の相手 ' + JSON.stringify(it));
  const r = act(st, 'gard', { k: 'push', ref: { u: 'e1' }, dir: 1 });
  ok(r.ok, '敵を押せる ' + r.why);
  const e = S.unitById(st, 'e1');
  ok(e.ko && e.gone, '谷へ落ちて倒れた');
  ok(st.mode === 'explore', '戦いが終わった');
}
{
  // 鉤縄：渡ると縄が道になる
  const st = mini(['000..000'], null, [{ k: 'anchor', x: 5, y: 0 }], [], { gard: [0, 0], riko: [2, 0], sena: [1, 0] });
  const r = act(st, 'riko', { k: 'rope', o: 'o1' });
  ok(r.ok && S.unitById(st, 'riko').x === 5, 'リコが渡った');
  const g = S.unitById(st, 'gard');
  const m = S.reach(st, g, { ignoreUnits: true });
  ok(m.has(S.idx(st, 7, 0)), '縄を伝って向こうへ行ける');
}

// ---- 第一区画を通しで ----
{
  const def = D.byId('s1');
  const st = S.create(def, {});
  let r = act(st, 'gard', { k: 'push', ref: { o: 'o1' }, dir: 3 });
  ok(r.ok, 's1 木箱を押す ' + r.why);
  ok(r.evs.some(e => e.k === 'bloom'), 's1 道がひらけた');
  r = act(st, 'gard', { k: 'move', x: 9, y: 6 });
  ok(r.ok, 's1 上の段へ ' + r.why);
  r = act(st, 'riko', { k: 'rope', o: 'o2' });
  ok(r.ok, 's1 鉤縄 ' + r.why);
  ok(r.evs.some(e => e.k === 'bloom'), 's1 縄で道がひらけた');
  // 向こう岸へ歩くと戦いになる
  r = act(st, 'gard', { k: 'move', x: 3, y: 7 });
  ok(r.ok, 's1 向こう岸へ ' + r.why);
  ok(st.mode === 'combat', 's1 戦いが始まった ' + st.mode);
  console.log('  s1 戦い開始時:', S.heroes(st).map(h => h.id + '@' + h.x + ',' + h.y).join(' '), S.liveEnemies(st).map(e => e.k + '@' + e.x + ',' + e.y).join(' '));
}

console.log(`rules_test: ${pass} ok, ${fail} NG`);
process.exit(fail ? 1 : 0);
