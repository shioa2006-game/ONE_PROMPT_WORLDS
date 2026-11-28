// だれと行く？ — ルールの自動確認（node tools/rules_test.js）
'use strict';
const path = require('path');
const S = require(path.join(__dirname, '..', 'js', 'sim.js'));
require(path.join(__dirname, '..', 'js', 'data.js'));
require(path.join(__dirname, '..', 'js', 'campaign.js'));
const D = globalThis.D21, C = globalThis.C21;

let pass = 0, fail = 0;
function ok(c, msg) { if (c) pass++; else { fail++; console.log('NG:', msg); } }
function flat(evs) { const o = []; const w = (l) => { for (const e of l) { if (e.k === 'group') w(e.evs); else o.push(e); } }; w(evs); return o; }
function act(st, hero, intent) {
  const p = S.plan(st, hero, intent);
  if (!p.ok) return { ok: false, why: p.why };
  return { ok: true, evs: flat(S.apply(st, p)), p };
}
function mini(hmap, tmap, objs, enemies, start, party, up) {
  return S.create({ id: 't', W: hmap[0].length, H: hmap.length, hmap, tmap, objs: objs || [], enemies: enemies || [], start: start || [[0, 0], [1, 0], [2, 0]] }, { party: party || ['riko', 'gard', 'sena'], up: up || {} });
}

// ---- 編成：リコはいつも先頭。同行者の働きは verbs で決まる ----
{
  const st = mini(['0000', '0000'], null, [], [], [[0, 0], [1, 0], [2, 0]], ['riko', 'sena', 'tobi']);
  ok(S.heroes(st).map(h => h.id).join() === 'riko,sena,tobi', '編成どおりに三人が出る');
  ok(!S.unitById(st, 'gard'), '連れていかない仲間はいない');
  ok(S.can(st, 'tobi', 'blast') && !S.can(st, 'riko', 'blast'), '発破はトビだけ');
  ok(S.heroWith(st, 'push') === null, '押せる人がいない編成');
  const p = S.plan(st, 'tobi', { k: 'push', ref: { o: 'x' }, dir: 0 });
  ok(!p.ok, 'トビは押せない');
}
// ---- 発破：上下左右を外へ吹き飛ばす。崖から落とす・重い敵も動く ----
{
  // 中央の段（高さ3）に敵、まわりは谷
  const st = mini(['.....', '.333.', '.333.', '.333.', '00000'], null, [], [{ k: 'goblin', x: 2, y: 2, wake: 99, active: true }, { k: 'golem', x: 3, y: 2, wake: 99, active: true }], [[0, 4], [1, 4], [2, 4]], ['riko', 'gard', 'tobi']);
  st.mode = 'combat';
  // 小鬼の上で発破：小鬼は爆心で傷2、となりの岩人形は右（谷）へ飛ぶ
  const r = act(st, 'tobi', { k: 'blast', x: 2, y: 2 });
  ok(r.ok, '発破できる ' + (r.why || ''));
  const gob = S.unitById(st, 'e1'), gol = S.unitById(st, 'e2');
  ok(gob.hp === 1, '爆心の小鬼は傷2 → ' + gob.hp);
  ok(gol.ko && gol.gone, '重い岩人形も爆風で谷へ落ちる');
}
{
  // 爆風で物を押す：木箱が段から落ちて足場になる
  const st = mini(['0000', '2220', '0000'], null, [{ k: 'crate', x: 2, y: 1 }], [], [[0, 2], [1, 2], [2, 2]], ['riko', 'gard', 'tobi']);
  const r = act(st, 'tobi', { k: 'blast', x: 1, y: 1 });
  ok(r.ok, '木箱のとなりで発破 ' + (r.why || ''));
  const c = S.objById(st, 'o1');
  ok(c.x === 3 && c.y === 1, '木箱は外へ一升 → ' + c.x + ',' + c.y);
  ok(c.z === 0, '段から落ちた');
}
{
  // 大玉：2マス吹き飛ぶ
  const st = mini(['00000', '00000'], null, [{ k: 'crate', x: 2, y: 0 }], [], [[0, 1], [1, 1], [2, 1]], ['riko', 'gard', 'tobi'], { bigbomb: true });
  act(st, 'tobi', { k: 'blast', x: 1, y: 0 });
  ok(S.objById(st, 'o1').x === 4, '大玉の発破で2マス → ' + S.objById(st, 'o1').x);
}
{
  // 仲間は爆風に巻きこまれない
  const st = mini(['0000', '0000', '0000'], null, [], [{ k: 'goblin', x: 1, y: 1, wake: 99, active: true }], [[2, 1], [0, 2], [3, 2]], ['riko', 'gard', 'tobi']);
  st.mode = 'combat';
  const r = act(st, 'tobi', { k: 'blast', x: 1, y: 1 });
  ok(r.ok, '敵の上で発破');
  const rk = S.unitById(st, 'riko');
  ok(rk.x === 2 && rk.y === 1 && rk.hp === rk.mhp, '仲間は動かず無傷');
}
// ---- ひび割れた岩：発破で砕け、がれきが足場になる ----
{
  const st = mini(['0112', '0112'], null, [{ k: 'crack', x: 2, y: 0, h: 2 }, { k: 'crack', x: 2, y: 1, h: 2 }], [], [[0, 0], [0, 1], [1, 1]], ['riko', 'gard', 'tobi']);
  const t = S.unitById(st, 'tobi');
  const before = S.reach(st, S.unitById(st, 'riko'), { ignoreUnits: true }).has(S.idx(st, 3, 0));
  ok(!before, '岩にふさがれて奥へ行けない');
  const r = act(st, 'tobi', { k: 'blast', x: 2, y: 0 });
  ok(r.ok && r.evs.some(e => e.k === 'shatter'), '岩が砕ける');
  ok(S.objById(st, 'o1').gone, '岩は消える');
  const rb = st.objs.find(o => o.k === 'rubble' && o.x === 2 && o.y === 0);
  ok(rb && S.surface(st, 2, 0).z === 2, 'がれき（高さ1）が足場 → ' + S.surface(st, 2, 0).z);
  ok(S.reach(st, S.unitById(st, 'riko'), { ignoreUnits: true }).has(S.idx(st, 3, 0)), 'がれき伝いに奥の段へ行ける');
  void t;
}
// ---- 救助：見つけて、縄を使わない帰り道ができたら荷馬車へ ----
{
  const def = D.MAPS.m3;
  const st = S.create(def, { party: ['riko', 'gard', 'sena'], up: { rope2: true } });
  const tb = S.unitById(st, 'tb');
  ok(tb.team === 'n' && !tb.found, 'はじめトビは見つかっていない');
  // 木箱で台へ → 縄で岩棚 → 見つける
  act(st, 'gard', { k: 'move', x: 6, y: 6 });
  if (st.mode === 'combat') { for (const e of S.liveEnemies(st)) if (e.active) { e.ko = true; e.gone = true; } st.mode = 'explore'; }
  act(st, 'gard', { k: 'push', ref: { o: 'o1' }, dir: 3 });
  const r = act(st, 'riko', { k: 'rope', o: 'o2' });
  ok(r.ok, '岩棚へ縄 ' + (r.why || ''));
  ok(tb.found && tb.team === 'h' && tb.fixed, 'トビが見つかり、歩けない仲間（ゲスト）になる');
  ok(st.mode === 'combat', '岩人形が目ざめる');
  for (const e of S.liveEnemies(st)) { e.ko = true; e.gone = true; }
  st.mode = 'explore';
  ok(!tb.safe, '縄では帰れない');
  const r2 = act(st, 'tb', { k: 'blast', x: 1, y: 6 });
  ok(r2.ok && S.unitById(st, 'm1').safe && S.unitById(st, 'm2').safe, '岩を砕くと、鉱夫が荷馬車へ歩く ' + (r2.why || ''));
  const r3 = act(st, 'sena', { k: 'freeze', ref: { o: 'o3' } });
  ok(r3.ok && tb.safe, '滝を凍らせると、トビも氷の段で帰れる');
  ok(S.objective(st).done && st.flags.cleared, '三人とも助けて依頼達成');
}
// ---- 遺跡：四つのうち三つの装置で門がひらく（どの二人を連れても） ----
{
  const def = D.MAPS.m4;
  for (const party of [['gard', 'sena'], ['gard', 'tobi'], ['sena', 'tobi']]) {
    const st = S.create(def, { party: ['riko'].concat(party) });
    for (const e of st.units) if (e.team === 'e') { e.ko = true; e.gone = true; }
    const v = new Set(['shoot']); for (const id of party) for (const x of S.HERO[id].verbs) v.add(x);
    let n = 0;
    if (act(st, 'riko', { k: 'shoot', ref: { o: 'o3' } }).ok) n++;
    if (v.has('freeze') && act(st, S.heroWith(st, 'freeze'), { k: 'freeze', ref: { o: 'o4' } }).ok) n++;
    if (v.has('blast') && act(st, 'tobi', { k: 'blast', x: 2, y: 12 }).ok) n++;
    if (n < 3 && v.has('push')) { if (act(st, 'gard', { k: 'push', ref: { o: 'o5' }, dir: 2 }).ok) n++; }
    if (n < 3 && v.has('blast')) { if (act(st, 'tobi', { k: 'blast', x: 12, y: 7 }).ok) n++; }
    ok(st.flags.runesDone && S.objById(st, 'gate').open, party.join('+') + ' でも門がひらく（' + S.runeCount(st) + '）');
  }
}
// ---- 米倉：盗っ人は倉へ一直線。ふさがれたら、ふさいだ者をたたく ----
{
  const st = mini(['00000'], null, [], [{ k: 'raider', x: 0, y: 0, wake: 99, active: true }], [[3, 0], [2, 0], [1, 0]], ['riko', 'gard', 'sena']);
  st.raid = { cells: [[4, 0]], sacks: 3, max: 3 };
  st.mode = 'combat'; st.turn = 1;
  const it = S.intents(st);
  ok(it[0] && it[0].target, '道をふさがれた盗っ人は、ふさぐ者をたたく');
  const st2 = mini(['00000', '00000'], null, [], [{ k: 'raider', x: 1, y: 0, wake: 99, active: true }], [[0, 1], [1, 1], [2, 1]], ['riko', 'gard', 'sena']);
  st2.raid = { cells: [[4, 0]], sacks: 2, max: 2 };
  st2.mode = 'combat'; st2.turn = 1;
  S.endPlayerPhase(st2);
  ok(st2.raid.sacks === 1, '倉に届いた盗っ人は米俵を一つ盗って逃げる');
}
// ---- 大亀：甲羅は矢・押し・爆風をはじく。2段落とすとひっくり返り、お腹に効く ----
{
  const st = mini(['444444', '444444', '444444'], null, [], [{ k: 'turtle', x: 1, y: 1, wake: 99, active: true, boss: true }], [[0, 0], [0, 1], [4, 0]], ['riko', 'sena', 'tobi']);
  st.mode = 'combat'; st.turn = 1;
  const b = S.unitById(st, 'e1');
  act(st, 'riko', { k: 'shoot', ref: { u: 'e1' } });
  ok(b.hp === b.mhp, '同じ高さからの矢ははじかれる');
  const r = act(st, 'tobi', { k: 'blast', x: 1, y: 1 });
  ok(r.ok && b.hp === b.mhp, '爆心でも甲羅ではじく');
  const st2 = mini(['44420', '44420', '44420'], null, [], [{ k: 'turtle', x: 2, y: 1, wake: 99, active: true, boss: true }], [[0, 0], [0, 1], [0, 2]], ['riko', 'gard', 'tobi']);
  st2.mode = 'combat'; st2.turn = 1;
  const b2 = S.unitById(st2, 'e1');
  const r2 = act(st2, 'tobi', { k: 'blast', x: 1, y: 1 });
  ok(r2.ok && b2.flipped > 0 && b2.x === 3, '爆風で段から落ちて、ひっくり返る → ' + b2.x + ' fl' + b2.flipped);
  const hp0 = b2.hp;
  act(st2, 'riko', { k: 'shoot', ref: { u: 'e1' } });
  ok(hp0 - b2.hp === 4, 'ひっくり返ったお腹には矢が通る（2＋高所1＋お腹1） → ' + (hp0 - b2.hp));
  S.endPlayerPhase(st2);
  ok(b2.flipped === 0, 'ひっくり返っている間は、次の手番うごけない（起きあがる）');
  // 高所からの矢は甲羅のすきまに刺さる
  const st3 = mini(['6000', '6000'], null, [], [{ k: 'turtle', x: 2, y: 0, wake: 99, active: true, boss: true }], [[0, 0], [0, 1], [3, 1]], ['riko', 'sena', 'tobi']);
  st3.mode = 'combat'; st3.turn = 1;
  const b3 = S.unitById(st3, 'e1');
  act(st3, 'riko', { k: 'shoot', ref: { u: 'e1' } });
  ok(b3.hp === b3.mhp - 3, '2段以上の高所からの矢は甲羅のすきまに刺さる → ' + b3.hp);
  // 凍らせた次の手番は、氷を振りはらう（続けて凍らない）
  const st4 = mini(['0000', '0000'], null, [], [{ k: 'turtle', x: 2, y: 0, wake: 99, active: true, boss: true }], [[0, 0], [0, 1], [3, 1]], ['riko', 'sena', 'tobi']);
  st4.mode = 'combat'; st4.turn = 1;
  ok(act(st4, 'sena', { k: 'freeze', ref: { u: 'e1' } }).ok, '大亀を凍らせる');
  S.endPlayerPhase(st4);
  ok(!S.plan(st4, 'sena', { k: 'freeze', ref: { u: 'e1' } }).ok, '続けては凍らない');
  // 谷・水へは落ちない（ふちで踏んばる）
  const st5 = mini(['44.', '44.'], null, [], [{ k: 'turtle', x: 1, y: 0, wake: 99, active: true, boss: true }], [[0, 1], [0, 0], [1, 1]], ['riko', 'gard', 'tobi'], { gauntlet: true });
  st5.mode = 'combat'; st5.turn = 1;
  act(st5, 'gard', { k: 'push', ref: { u: 'e1' }, dir: 0 });
  ok(!S.unitById(st5, 'e1').ko, '大亀は谷へ落ちない');
}
// ---- 鍛えた道具 ----
{
  // 鋼の籠手：岩人形を押せる
  const st = mini(['0000'], null, [], [{ k: 'golem', x: 2, y: 0, wake: 99, active: true }], [[0, 0], [1, 0], [3, 0]], ['riko', 'gard', 'sena']);
  st.mode = 'combat';
  ok(!S.plan(st, 'gard', { k: 'push', ref: { u: 'e1' }, dir: 0 }).ok, '籠手なしでは岩人形を押せない');
  st.up.gauntlet = true;
  ok(S.plan(st, 'gard', { k: 'push', ref: { u: 'e1' }, dir: 2 }).ok || S.plan(st, 'gard', { k: 'push', ref: { u: 'e1' }, dir: 0 }).ok, '鋼の籠手で押せる');
  // 氷晶の杖：乾いた床に氷のかたまり
  const st2 = mini(['0002', '0000'], null, [], [], [[0, 0], [0, 1], [1, 1]], ['riko', 'gard', 'sena'], { staff: true });
  const r = act(st2, 'sena', { k: 'freeze', x: 2, y: 0 });
  ok(r.ok && st2.objs.some(o => o.k === 'iceblock' && o.x === 2 && o.y === 0), '氷のかたまりをつくれる ' + (r.why || ''));
  ok(S.canStep(st2, null, 1, 0, 2, 0) && S.surface(st2, 2, 0).z === 1, '氷のかたまりは足場');
  const st3 = mini(['0000'], null, [], [], [[0, 0], [1, 0], [3, 0]], ['riko', 'gard', 'sena']);
  ok(!S.plan(st3, 'sena', { k: 'freeze', x: 2, y: 0 }).ok, '杖がなければ床は凍らない');
  // 狩人の長弓：矢 +1
  const st4 = mini(['0000'], null, [], [{ k: 'golem', x: 3, y: 0, wake: 99, active: true }], [[0, 0], [1, 0], [2, 0]], ['riko', 'gard', 'sena'], { bow: true });
  st4.mode = 'combat';
  act(st4, 'riko', { k: 'shoot', ref: { u: 'e1' } });
  ok(S.unitById(st4, 'e1').hp === 7 - 3, '長弓の矢は3 → ' + S.unitById(st4, 'e1').hp);
}
// ---- 行き詰まり防止：どこへも行けない敵は逃げる ----
{
  const st = mini(['00.00'], null, [], [{ k: 'goblin', x: 4, y: 0, wake: 99, active: true }], [[0, 0], [1, 0], [0, 0]], ['riko', 'gard']);
  st.mode = 'combat'; st.turn = 1;
  S.endPlayerPhase(st); S.endPlayerPhase(st);
  ok(S.liveEnemies(st).length === 0 && st.mode === 'explore', '谷の向こうで動けない小鬼は、二手番で逃げて戦いが終わる');
}
// ---- ギルド：報酬・ランク・仲間の加入・解放 ----
{
  const p = C.newProfile();
  ok(C.board(p).map(x => x.r.id).join() === 'm1', 'はじめの依頼板は一つ');
  const fake = (id, party) => { const st = S.create(D.MAPS[D.req(id).map], C.carry(p, party)); st.flags.cleared = true; return st; };
  let r = C.complete(p, 'm1', fake('m1', ['gard', 'sena']));
  ok(r.first && p.coins === 80 && p.merit === 1 && p.trophies.includes('pumpkin'), '依頼1の報酬');
  ok(r.newReqs.includes('m2') && r.shopNew.includes('bow'), '依頼2と長弓が届く');
  r = C.complete(p, 'm2', fake('m2', ['gard', 'sena']));
  ok(r.rankUp && r.rankUp.to.star === 2 && p.up.rope2, 'ランク★2と長い鉤縄');
  ok(C.carry(p, ['gard', 'sena']).hpb === 1, '★2で体力+1');
  r = C.complete(p, 'm3', fake('m3', ['gard', 'sena']));
  ok(r.joined.includes('tobi') && p.roster.includes('tobi'), 'トビが仲間になる');
  ok(r.newReqs.includes('m4') && r.newReqs.includes('m5') && !r.newReqs.includes('m6'), '遺跡と米倉が届く（大亀はまだ）');
  r = C.complete(p, 'm4', fake('m4', ['sena', 'tobi']));
  ok(r.rankUp && r.rankUp.to.star === 3 && !r.newReqs.includes('m6'), '遺跡か米倉の一つめで★3（大亀はまだ）');
  r = C.complete(p, 'm5', fake('m5', ['gard', 'tobi']));
  ok(r.newReqs.includes('m6'), '遺跡と米倉の両方で、大亀の依頼');
  r = C.complete(p, 'm6', fake('m6', ['gard', 'sena']));
  ok(r.chapter && p.chapterDone && C.rankInfo(p).star === 4, '大亀で第一章のしめくくり・★4');
  const c0 = p.coins;
  r = C.complete(p, 'm4', fake('m4', ['gard', 'tobi']));
  ok(!r.first && r.merit === 0 && p.coins === c0 + Math.round(150 / 4), '2回目は報酬少なめ・功績なし');
  ok(p.partyLog.m4.length === 2, '攻略した編成が残る');
  const b = C.buy(p, 'gauntlet');
  ok(b.ok && p.up.gauntlet, '鍛冶屋で買える');
  ok(!C.buy(p, 'gauntlet').ok, '二度は買えない');
}

console.log('pass', pass, 'fail', fail);
process.exit(fail ? 1 : 0);
