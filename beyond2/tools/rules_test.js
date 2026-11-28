// GUILDWARD — ルールの自動確認（node tools/rules_test.js）
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
  // v0.2：すきは次の自分の手番の終わりまで（v0.1 は、その手番の残りだけだった）
  ok(b2.flipped === 1, 'ひっくり返した直後の敵の手番は休み、次の自分の手番もすきのまま → ' + b2.flipped);
  // 高所からの矢は甲羅のすきまに刺さる（v0.2：すきなしなら傷1。v0.1 は 3〜4 入っていた）
  const st3 = mini(['6000', '6000'], null, [], [{ k: 'turtle', x: 2, y: 0, wake: 99, active: true, boss: true }], [[0, 0], [0, 1], [3, 1]], ['riko', 'sena', 'tobi']);
  st3.mode = 'combat'; st3.turn = 1;
  const b3 = S.unitById(st3, 'e1');
  act(st3, 'riko', { k: 'shoot', ref: { u: 'e1' } });
  ok(b3.hp === b3.mhp - 1, '2段以上の高所からの矢は、すきのない甲羅のすきまに傷1 → ' + (b3.mhp - b3.hp));
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

// =====================================================================
// v0.2　段階0・段階1で足した決まり（design/05・03・09）
// =====================================================================
const steps = (st, id, x, y) => { const r = S.reach(st, S.unitById(st, id), { ignoreUnits: true }); const i = S.idx(st, x, y); return r.has(i) ? r.get(i).c : -1; };
const put = (st, id, x, y) => { const u = S.unitById(st, id); u.x = x; u.y = y; u.z = S.standZ(st, x, y, u); };
const calm = (st) => { for (const u of st.units) if (u.team === 'e') { u.ko = true; u.gone = true; } };
// ---- 05 1.1 すき：次の自分の手番の終わりまで。重ねても延びない。凍らせても解けない ----
{
  const st = mini(['44420', '44420', '44420'], null, [], [{ k: 'turtle', x: 2, y: 1, wake: 99, active: true, boss: true }], [[0, 0], [0, 1], [0, 2]], ['riko', 'gard', 'tobi']);
  st.mode = 'combat'; st.turn = 1;
  const b = S.unitById(st, 'e1');
  act(st, 'tobi', { k: 'blast', x: 1, y: 1 });
  ok(b.flipped === 2 && b.hp === 20, 'すき：自分の手番にひっくり返すと、残り2（傷2） → ' + b.flipped + ' hp' + b.hp);
  let it = S.intents(st).find(r => r.id === 'e1');
  ok(it && it.rest, 'すき：赤い線に「休む」');
  S.endPlayerPhase(st);
  ok(b.flipped === 1 && b.x === 3 && b.y === 1, 'すき：直後の敵の手番は休む（動かない）');
  const hp0 = b.hp;
  act(st, 'riko', { k: 'shoot', ref: { u: 'e1' } });
  ok(hp0 - b.hp === 4, 'すき：次の自分の手番も、お腹に矢が通る（2＋高所1＋すき1） → ' + (hp0 - b.hp));
  it = S.intents(st).find(r => r.id === 'e1');
  ok(it && it.rise && !it.rest, 'すき：その手番の赤い線に「起きあがる」');
  S.endPlayerPhase(st);
  ok(b.flipped === 0, 'すき：次の自分の手番の終わりで切れる');
  // 重ねても延びない（落下の傷だけ入る）
  const st2 = mini(['44420', '44420', '44420'], null, [], [{ k: 'turtle', x: 2, y: 1, wake: 99, active: true, boss: true }], [[0, 0], [0, 1], [0, 2]], ['riko', 'gard', 'tobi']);
  st2.mode = 'combat'; st2.turn = 1;
  const b2 = S.unitById(st2, 'e1'); b2.flipped = 1;
  act(st2, 'tobi', { k: 'blast', x: 1, y: 1 });
  ok(b2.flipped === 1 && b2.hp === 19, 'すき：すきの間にもう一度落としても延びない（傷は入る：爆風1＋すき1＋落下1） → fl' + b2.flipped + ' hp' + b2.hp);
  // 凍らせても解けない。霜の傷（1＋1）だけ、止める効果はなし
  const st3 = mini(['0000', '0000'], null, [], [{ k: 'turtle', x: 2, y: 0, wake: 99, active: true, boss: true }], [[0, 0], [0, 1], [3, 1]], ['riko', 'sena', 'tobi']);
  st3.mode = 'combat'; st3.turn = 1;
  const b3 = S.unitById(st3, 'e1'); b3.flipped = 2;
  ok(act(st3, 'sena', { k: 'freeze', ref: { u: 'e1' } }).ok && b3.hp === 20 && b3.flipped === 2 && !(b3.frozen > 0), 'すき：凍らせても解けず、霜の傷2だけ → hp' + b3.hp + ' fl' + b3.flipped + ' fz' + b3.frozen);
}
// ---- 05 1.2 高所の矢：すきのない甲羅には傷1（長弓でも1）。すきの間はふつうの計算 ----
{
  const st = mini(['6000', '6000'], null, [], [{ k: 'turtle', x: 2, y: 0, wake: 99, active: true, boss: true }], [[0, 0], [0, 1], [3, 1]], ['riko', 'sena', 'tobi'], { bow: true });
  st.mode = 'combat'; st.turn = 1;
  const b = S.unitById(st, 'e1');
  const r = act(st, 'riko', { k: 'shoot', ref: { u: 'e1' } });
  ok(b.mhp - b.hp === 1, '高所の矢：長弓でも、すきのない甲羅には傷1 → ' + (b.mhp - b.hp));
  ok(r.evs.some(e => e.k === 'caption' && /すきまに刺さった（傷1）/.test(e.text)), '高所の矢：字幕「すきまに刺さった（傷1）。ひっくり返せば、もっと通る」');
  const st2 = mini(['6000', '6000'], null, [], [{ k: 'turtle', x: 2, y: 0, wake: 99, active: true, boss: true }], [[0, 0], [0, 1], [3, 1]], ['riko', 'sena', 'tobi'], { bow: true });
  st2.mode = 'combat'; st2.turn = 1;
  const c = S.unitById(st2, 'e1'); c.flipped = 2;
  act(st2, 'riko', { k: 'shoot', ref: { u: 'e1' } });
  ok(c.mhp - c.hp === 5, '高所の矢：すきの間は、ふつうの計算（2＋長弓1＋高所1＋すき1） → ' + (c.mhp - c.hp));
}
// ---- 05 1.3 転がる勢い：1升以上転がってから当たったときだけ傷。となりからは「ぶつかって止まった」 ----
{
  const st = mini(['000000'], null, [{ k: 'boulder', x: 2, y: 0 }], [{ k: 'golem', x: 3, y: 0, wake: 99, active: true }], [[0, 0], [1, 0], [5, 0]], ['riko', 'gard', 'sena']);
  st.mode = 'combat'; st.turn = 1;
  const r = act(st, 'gard', { k: 'push', ref: { o: 'o1' }, dir: 0 });
  const g = S.unitById(st, 'e1');
  ok(r.ok && g.hp === 7 && S.objById(st, 'o1').x === 2, '転がる勢い：となりの敵には傷なし（大岩も動かない） → hp' + g.hp);
  ok(r.evs.some(e => e.k === 'caption' && /ぶつかって止まった/.test(e.text)), '転がる勢い：字幕に「ぶつかって止まった」');
  const st2 = mini(['000000'], null, [{ k: 'boulder', x: 1, y: 0 }], [{ k: 'golem', x: 4, y: 0, wake: 99, active: true }], [[5, 0], [0, 0], [5, 0]], ['riko', 'gard']);
  st2.mode = 'combat'; st2.turn = 1;
  act(st2, 'gard', { k: 'push', ref: { o: 'o1' }, dir: 0 });
  ok(S.unitById(st2, 'e1').hp === 4 && S.objById(st2, 'o1').x === 3, '転がる勢い：2升転がって当たれば傷3（ぶつかりの傷は重ねない） → hp' + S.unitById(st2, 'e1').hp);
  const st3 = mini(['0000000'], null, [{ k: 'boulder', x: 1, y: 0 }], [{ k: 'turtle', x: 5, y: 0, wake: 99, active: true, boss: true }], [[6, 0], [0, 0]], ['riko', 'gard']);
  st3.mode = 'combat'; st3.turn = 1;
  const r3 = act(st3, 'gard', { k: 'push', ref: { o: 'o1' }, dir: 0 });
  const t3 = S.unitById(st3, 'e1');
  ok(t3.flipped === 2 && t3.hp === 20, '転がる勢い：転がった大岩で大亀がひっくり返る（傷2ちょうど） → fl' + t3.flipped + ' hp' + t3.hp);
  ok(st3.stats.boulderFlip === 1, '転がる勢い：大岩でひっくり返した回数を数える（印 m6①）');
  ok(r3.evs.some(e => e.k === 'flip' && e.atCell === 4), '演出：当たった傷は、大岩がその升に来たときに見せる（atCell）');
  const raw = S.apply((() => { const s = mini(['0000000'], null, [{ k: 'boulder', x: 1, y: 0 }], [{ k: 'goblin', x: 5, y: 0, wake: 99, active: true }], [[6, 0], [0, 0]], ['riko', 'gard']); s.mode = 'combat'; s.turn = 1; return s; })(), S.plan((() => { const s = mini(['0000000'], null, [{ k: 'boulder', x: 1, y: 0 }], [{ k: 'goblin', x: 5, y: 0, wake: 99, active: true }], [[6, 0], [0, 0]], ['riko', 'gard']); s.mode = 'combat'; s.turn = 1; return s; })(), 'gard', { k: 'push', ref: { o: 'o1' }, dir: 0 }));
  ok(raw.some(e => e.k === 'group' && e.roll && e.evs[0].k === 'slide' && e.evs.some(s => s.k === 'ko' && s.atCell === 4)), '演出：転がる大岩と、通りがかりに倒した敵は一つの group');
}
// ---- 凍らせて通せんぼ：凍った敵は、ほかの敵の通り道もふさぐ（v0.1 の資料・ヒントのとおり。v0.2 で実装を直した） ----
{
  // 幅1の通路：先頭の小鬼を凍らせると、うしろの小鬼は通れない
  const st = mini(['0000000'], null, [], [{ k: 'goblin', x: 4, y: 0, wake: 99, active: true }, { k: 'goblin', x: 5, y: 0, wake: 99, active: true }], [[0, 0], [1, 0]], ['riko', 'sena']);
  st.mode = 'combat'; st.turn = 1;
  act(st, 'sena', { k: 'freeze', ref: { u: 'e1' } });
  const it = S.intents(st).find(r => r.id === 'e2');
  ok(it && !it.target && (!it.to || it.to[0] >= 5), '通せんぼ：凍った小鬼のうしろの小鬼は、通りぬけて攻めてこない → ' + JSON.stringify(it));
  S.endPlayerPhase(st);
  ok(S.unitById(st, 'e2').x === 5, '通せんぼ：凍った敵は、その敵の手番のあいだずっとふさぐ（先に動いても、あとに動いても）');
  // 飛ぶ敵は上を越える
  const st2 = mini(['0000000'], null, [], [{ k: 'goblin', x: 4, y: 0, wake: 99, active: true }, { k: 'bat', x: 5, y: 0, wake: 99, active: true }], [[0, 0], [1, 0]], ['riko', 'sena']);
  st2.mode = 'combat'; st2.turn = 1;
  act(st2, 'sena', { k: 'freeze', ref: { u: 'e1' } });
  const it2 = S.intents(st2).find(r => r.id === 'e2');
  ok(it2 && it2.target, '通せんぼ：飛ぶ敵（コウモリ）は、凍った小鬼の上を越えてくる');
  // 凍っていなければ、敵どうしは通りぬけられる（v0.1 のまま）
  const st3 = mini(['0000000'], null, [], [{ k: 'goblin', x: 4, y: 0, wake: 99, active: true }, { k: 'goblin', x: 5, y: 0, wake: 99, active: true }], [[0, 0], [2, 0]], ['riko', 'sena']);
  st3.mode = 'combat'; st3.turn = 1;
  S.endPlayerPhase(st3);
  ok(S.unitById(st3, 'e2').x < 5, '通せんぼ：凍っていない仲間の敵は、通りぬけて進む');
}
// ---- 05 1.4 行き場のない盗っ人は4手番逃げない（ほかの敵は2手番） ----
{
  const st = mini(['00.00'], null, [], [{ k: 'raider', x: 4, y: 0, wake: 99, active: true }], [[0, 0], [1, 0]], ['riko', 'gard']);
  st.raid = { cells: [[1, 0]], sacks: 3, max: 3 };
  st.mode = 'combat'; st.turn = 1;
  for (let k = 0; k < 3; k++) S.endPlayerPhase(st);
  ok(S.liveEnemies(st).length === 1 && st.mode === 'combat', '盗っ人：3手番では逃げない');
  ok(S.intents(st)[0] && S.intents(st)[0].stuck, '盗っ人：逃げる手番の赤い線に「逃げていく」');
  S.endPlayerPhase(st);
  ok(S.liveEnemies(st).length === 0 && st.mode === 'explore', '盗っ人：4手番で逃げて、戦いが終わる');
}
// ---- 05 1.6 ついてくる仲間は、押した物の行き先に立たない ----
{
  const st = mini(['000000'], null, [{ k: 'crate', x: 3, y: 0 }], [], [[1, 0], [0, 0], [5, 0]], ['riko', 'gard', 'sena']);
  const r = act(st, 'gard', { k: 'push', ref: { o: 'o1' }, dir: 2 });
  ok(r.ok && S.objById(st, 'o1').x === 2, 'ついてくる仲間：木箱の行き先 (2,0) に立たず、木箱がそこまで動く → ' + S.objById(st, 'o1').x);
  ok(!S.heroes(st).some(h => h.id !== 'gard' && h.x === 2 && h.y === 0), 'ついてくる仲間：行き先の升にはだれもいない');
  const pv = S.preview(mini(['000000'], null, [{ k: 'crate', x: 3, y: 0 }], [], [[1, 0], [0, 0], [5, 0]], ['riko', 'gard', 'sena']), S.plan(mini(['000000'], null, [{ k: 'crate', x: 3, y: 0 }], [], [[1, 0], [0, 0], [5, 0]], ['riko', 'gard', 'sena']), 'gard', { k: 'push', ref: { o: 'o1' }, dir: 2 }));
  ok(pv.moves.o1 && pv.moves.o1[0] === 2, 'ついてくる仲間：見こみ（preview）も同じ結果');
}
// ---- 岩喰い大亀の体力（05 4.5） ----
ok(S.ENEMY.turtle.hp === 22, '大亀の体力は22');
// ---- お守り（03 5章）：胸当て＝体力+2、足袋＝移動+1、木札＝依頼ごとに一度こらえる ----
{
  const st = S.create({ id: 't', W: 4, H: 1, hmap: ['0000'], objs: [], enemies: [{ k: 'goblin', x: 1, y: 0, wake: 99, active: true }], start: [[0, 0], [3, 0], [2, 0]] }, { party: ['riko', 'gard', 'sena'], charms: { gard: 'c_plate', sena: 'c_tabi', riko: 'c_tag' } });
  const R0 = S.unitById(st, 'riko'), G0 = S.unitById(st, 'gard'), S0 = S.unitById(st, 'sena');
  ok(G0.mhp === 11 && G0.hp === 11, 'お守り：かたい胸当てで体力+2 → ' + G0.mhp);
  ok(S0.mov === 4 && S0.mv === 4, 'お守り：韋駄天の足袋で移動+1 → ' + S0.mov);
  S.startCombat(st, 1, []);
  ok(S0.mv === 4, 'お守り：戦いの手番の歩数も+1');
  R0.hp = 2;
  const it = S.intents(st);
  ok(it.heroes.riko && it.heroes.riko.endure && !it.heroes.riko.ko, 'お守り：見こみに「こらえる」（倒れない）');
  S.endPlayerPhase(st);
  ok(!R0.ko && R0.hp === 1 && R0.tagUsed, 'お守り：身がわりの木札で、倒れる傷を体力1でこらえる');
  ok(S.intents(st).heroes.riko.ko, 'お守り：木札は一度きり（次は倒れる見こみ）');
  S.endPlayerPhase(st);
  ok(R0.ko, 'お守り：二度目はこらえない');
  const st2 = S.create({ id: 't', W: 4, H: 1, hmap: ['0000'], objs: [], enemies: [], start: [[0, 0], [3, 0], [2, 0]] }, { party: ['riko', 'gard', 'sena'], charms: { gard: 'nothing' } });
  ok(S.unitById(st2, 'gard').mhp === 9 && !S.unitById(st2, 'gard').charm, 'お守り：知らない品は効かない');
  const p = C.newProfile();
  p.charms = ['c_plate', 'c_tabi'];
  C.equipCharm(p, 'gard', 'c_plate'); C.equipCharm(p, 'sena', 'c_plate');
  ok(p.equip.sena === 'c_plate' && !p.equip.gard, 'お守り：同じ物は二つとない（ほかの人へ移る）');
  C.equipCharm(p, 'riko', 'c_tag');
  ok(!p.equip.riko, 'お守り：持っていない物は持たせられない');
  const cr = C.carry(p, ['gard', 'tobi'], 'm1');
  ok(!cr.charms.sena && Object.keys(cr.charms).length === 0, 'お守り：連れていかない人のお守りは、地図に持っていかない');
  C.equipCharm(p, 'gard', 'c_tabi');
  ok(C.carry(p, ['gard', 'sena'], 'm1').charms.gard === 'c_tabi' && C.carry(p, ['gard', 'sena'], 'm1').charms.sena === 'c_plate', 'お守り：同行する二人のお守りを持っていく');
  C.equipCharm(p, 'gard', null);
  ok(!p.equip.gard, 'お守り：外せる');
}
// ---- 受けなおしの自由編成・宝箱は初回だけ（03 6.1・05 1.7） ----
{
  const p = C.newProfile();
  const r1 = D.req('m1'), r3 = D.req('m3');
  ok(C.fixedParty(p, r1), '受けなおし：初回の m1 は同行が決まっている');
  // m1 初回：宝箱の銀貨30
  let st = S.create(D.MAPS.m1, C.carry(p, ['gard', 'sena'], 'm1'));
  calm(st); put(st, 'riko', 3, 1);
  act(st, 'riko', { k: 'move', x: 2, y: 1 });
  ok(st.coins === 30 && st.found.includes('o3'), '宝箱：初回は銀貨30');
  st.flags.cleared = true;
  const res1 = C.complete(p, 'm1', st);
  ok(res1.found === 30 && p.coins === 110 && p.chests.m1.includes('o3'), '宝箱：持ち帰った宝箱を記録する');
  ok(!C.fixedParty(p, r1), '受けなおし：達成したあとは、だれとでも');
  ok(p.firstParty.m1 === 'gard+sena', '受けなおし：初回の二人を記録する');
  // 受けなおし：宝箱は空
  st = S.create(D.MAPS.m1, C.carry(p, ['gard', 'sena'], 'm1'));
  calm(st); put(st, 'riko', 3, 1);
  const rr = act(st, 'riko', { k: 'move', x: 2, y: 1 });
  ok(st.coins === 0 && rr.evs.some(e => e.k === 'collect' && e.empty), '宝箱：受けなおしでは空（もう持ち帰った）');
  st.flags.cleared = true;
  const c0 = p.coins;
  C.complete(p, 'm1', st);
  ok(p.coins === c0 + 20, '宝箱：受けなおしの銀貨は報酬の4分の1だけ → ' + (p.coins - c0));
  // m2：目的の角笛は受けなおしでも毎回ある。宝箱の記録には入れない
  st = S.create(D.MAPS.m2, C.carry(p, ['gard', 'sena'], 'm2'));
  calm(st); put(st, 'riko', 6, 1);
  act(st, 'riko', { k: 'move', x: 5, y: 1 });
  ok(st.items.includes('horn'), '宝箱：目的の品（角笛）は取れる');
  st.flags.cleared = true; C.complete(p, 'm2', st);
  ok(!p.chests.m2.includes('o3'), '宝箱：目的の品の箱は「持ち帰った宝箱」に入れない');
  st = S.create(D.MAPS.m2, C.carry(p, ['gard', 'sena'], 'm2'));
  calm(st); put(st, 'riko', 6, 1);
  act(st, 'riko', { k: 'move', x: 5, y: 1 });
  ok(st.items.includes('horn') && S.objective(st).done, '宝箱：受けなおしでも角笛を取って達成できる');
  // m3：受けなおしでもトビは選べない
  p.roster.push('tobi');
  ok(!C.pickable(p, r3).includes('tobi') && C.pickable(p, D.req('m4')).includes('tobi'), '受けなおし：m3 だけトビを選べない');
  ok(C.pairs(p, r1).length === 3 && C.pairs(p, r3).length === 1, '受けなおし：組める二人の数（m1 は3通り、m3 は1通り）');
}
// ---- 保存の移行（09 5章） ----
{
  const v1prof = {
    v: 1, rank: 1, merit: 6, coins: 300, roster: ['gard', 'sena', 'tobi'],
    done: { m1: { times: 1, party: ['gard', 'sena'], turns: 4 }, m2: { times: 1, party: ['gard', 'sena'] }, m3: { times: 2, party: ['sena', 'gard'] }, m4: { times: 2, party: ['gard', 'tobi'] } },
    items: ['rope2', 'horn', 'tablet'], up: { rope2: true, bow: true }, trophies: ['pumpkin', 'flag', 'stone', 'tablet'], seenReq: { m1: true }, chapterDone: false, time: 1234,
    stats: { fights: 6, combos: 2, turns: 12, kills: { riko: 3 }, acts: { gard: 5 }, runs: 6, retries: 0, hints: 1, undo: 2 },
    moments: [], lastParty: ['gard', 'tobi'], talked: {}, partyLog: { m1: ['gard+sena'], m2: ['gard+sena'], m3: ['gard+sena'], m4: ['sena+tobi', 'gard+tobi'] },
  };
  const sv1 = { v: 1, prof: v1prof, play: { req: 'm5', st: { sec: 'm5' } }, firstFight: false };
  const m = C.migrate(JSON.parse(JSON.stringify(sv1)));
  ok(m && m.v === 2 && m.prof.v === 2, '移行：v1 → v2');
  ok(m.play === null && m.migratedPlay, '移行：依頼の途中の保存は捨てる（タイトルで知らせる）');
  ok(m.prof.coins === 300 && m.prof.merit === 6 && m.prof.roster.length === 3 && m.prof.up.bow && m.prof.trophies.length === 4 && m.prof.time === 1234, '移行：ランク・銀貨・仲間・道具・飾り棚・時間はそのまま');
  ok(JSON.stringify(m.prof.stamps) === '{}' && m.prof.charms.length === 0 && JSON.stringify(m.prof.equip) === '{}' && JSON.stringify(m.prof.ledger) === '{}', '移行：印・お守り・持たせ方・帳面は空');
  ok(m.prof.chests.m1.join() === 'o3' && m.prof.chests.m2.join() === 'o5' && m.prof.chests.m3.join() === 'o5' && m.prof.chests.m4.join() === 'o2', '移行：達成ずみの依頼の宝箱は、持ち帰ったものとして埋める');
  ok(m.prof.firstParty.m4 === 'sena+tobi' && m.prof.firstParty.m3 === 'gard+sena', '移行：初回の二人は partyLog の最初から');
  ok(m.prof.rank === 3, '移行：ランクの★を功績から入れなおす → ' + m.prof.rank);
  ok(m.firstFight === false, '移行：はじめての戦いの説明を見たかどうかは保つ');
  const again = C.migrate(JSON.parse(JSON.stringify(m)));
  ok(again && again.v === 2 && JSON.stringify(again.prof) === JSON.stringify(m.prof), '移行：v2 の保存は、そのまま読める');
  ok(C.migrate({ v: 9, prof: {} }) === null && C.migrate(null) === null, '移行：知らない版・空は読まない');
  // 移行した記録で、受けなおしの宝箱は空
  const st = S.create(D.MAPS.m1, C.carry(m.prof, ['gard', 'sena'], 'm1'));
  ok(S.objById(st, 'o3').taken, '移行：移行した記録の受けなおしでは、宝箱は空');
}
// ---- ランク表（03 3章） ----
{
  const p = C.newProfile();
  const at = (m) => { p.merit = m; return C.rankInfo(p).star; };
  ok(D.RANKS.length === 7 && at(0) === 1 && at(2) === 2 && at(6) === 3 && at(11) === 4 && at(15) === 5 && at(24) === 6 && at(31) === 6 && at(32) === 7, 'ランク表は★7まで（功績 0/2/6/11/15/24/32）');
  p.merit = 11; ok(C.carry(p, ['gard', 'sena']).hpb === 3, '★4 で体力+3');
}
// ---- 腕だめしの印（03 6章）：18個の条件 ----
{
  ok(Object.values(D.STAMPS).reduce((s, l) => s + l.length, 0) === 18, '印：第一章で18個');
  const base = () => { const st = S.create({ id: 't', W: 2, H: 1, hmap: ['00'], start: [[0, 0], [1, 0]] }, { party: ['riko', 'gard', 'sena'] }); return st; };
  const T = (id, st, info) => D.stamp(id).test(st, info || { first: true, pair: 'gard+sena', firstPair: null });
  const w = (f) => { const st = base(); f(st); return st; };
  ok(T('m1a', w(s => s.stats.foeKo.push({ k: 'goblin', how: 'fall' }))) && !T('m1a', w(s => s.stats.foeKo.push({ k: 'goblin', how: 'arrow' }))), '印 m1①：小鬼を崖から押し落とす');
  ok(T('m1b', w(s => { s.stats.fightLen[1] = 3; })) && !T('m1b', w(s => { s.stats.fightLen[1] = 4; })) && !T('m1b', base()), '印 m1②：3手番以内');
  ok(T('m2a', w(s => s.stats.foeKo.push({ k: 'archer', how: 'drown' }))) && !T('m2a', base()), '印 m2①：堀に沈める');
  ok(T('m2b', base()) && !T('m2b', w(s => { s.stats.downs = 1; })), '印 m2②：だれも倒れない');
  ok(T('m3a', w(s => s.stats.foeKo.push({ k: 'golem', how: 'drown' }))) && !T('m3a', w(s => s.stats.foeKo.push({ k: 'golem', how: 'blast' }))), '印 m3①：岩人形を池へ');
  ok(T('m3b', base()) && !T('m3b', w(s => { s.stats.hints = 1; })), '印 m3②：ヒントを使わない');
  ok(T('m4a', w(s => { for (const f of ['r1', 'r2', 'r3', 'r4']) s.flags[f] = true; })) && !T('m4a', w(s => { for (const f of ['r1', 'r2', 'r3']) s.flags[f] = true; })), '印 m4①：灯を四つ');
  ok(T('m4b', w(s => { s.stats.foeKo.push({ k: 'golem', how: 'drown' }, { k: 'golem', how: 'void' }); })) && !T('m4b', w(s => { s.stats.foeKo.push({ k: 'golem', how: 'drown' }, { k: 'golem', how: 'blast' }); })), '印 m4②：岩人形を二体とも落とす');
  ok(T('m5a', w(s => { s.stats.bestRoll = 3; })) && !T('m5a', w(s => { s.stats.bestRoll = 2; })), '印 m5①：大岩で3体');
  ok(T('m5b', w(s => { s.raid = { sacks: 3 }; })) && !T('m5b', w(s => { s.raid = { sacks: 2 }; })), '印 m5②：米俵を三つとも');
  ok(T('m6a', w(s => { s.stats.boulderFlip = 1; })) && !T('m6a', base()), '印 m6①：大岩で大亀を返す');
  ok(T('m6b', w(s => { s.stats.bossTurn = 8; })) && !T('m6b', w(s => { s.stats.bossTurn = 9; })) && !T('m6b', base()), '印 m6②：8手番以内');
  for (const id of ['m1c', 'm2c', 'm3c', 'm4c', 'm5c', 'm6c']) {
    ok(T(id, base(), { first: false, pair: 'gard+tobi', firstPair: 'gard+sena' }) && !T(id, base(), { first: false, pair: 'gard+sena', firstPair: 'gard+sena' }) && !T(id, base(), { first: true, pair: 'gard+tobi', firstPair: null }), '印 ' + id + '：初回と違う二人');
  }
  // 実際の動きで条件を満たす（m1①・m5①・m6①）
  let st = S.create(D.MAPS.m1, { party: ['riko', 'gard', 'sena'] });
  put(st, 'gard', 2, 6); put(st, 'riko', 5, 6); put(st, 'sena', 4, 5);
  S.startCombat(st, 1, []);
  act(st, 'gard', { k: 'push', ref: { u: 'e1' }, dir: 1 });
  ok(T('m1a', st), '印 m1①：実際に小鬼を崖の下へ押し落とす → ' + JSON.stringify(st.stats.foeKo));
  st = S.create(D.MAPS.m5, { party: ['riko', 'gard', 'sena'] });
  for (const u of st.units) if (u.team === 'e') { u.ko = true; u.gone = true; }
  st.waves = [];
  [[4, 4], [4, 5], [4, 6]].forEach(([x, y], k) => { const e = { id: 'r' + k, k: 'raider', team: 'e', x, y, z: 3, hp: 3, mhp: 3, mv: 4, active: true, frozen: 0, flipped: 0, ko: false, grp: 1, wake: 99 }; st.units.push(e); });
  put(st, 'gard', 4, 9);
  S.startCombat(st, 1, []);
  const rr = act(st, 'gard', { k: 'push', ref: { o: 'o2' }, dir: 3 });
  ok(rr.ok && st.stats.bestRoll === 3 && T('m5a', st), '印 m5①：橋に並んだ3体を大岩でなぎ倒す → ' + st.stats.bestRoll);
  ok(rr.evs.some(e => e.k === 'say' && e.who === 'riko' && /まとめて/.test(e.text)), 'm5：3体以上に当たると、リコ「やったー！ まとめて！」');
  ok(rr.evs.some(e => e.k === 'caption' && /3体をなぎ倒した/.test(e.text)), 'm5：字幕「大岩が転がり、3体をなぎ倒した」');
  // 帰ったときの判定と、重複しないこと
  const p = C.newProfile();
  const fk = (id, party, f) => { const s = S.create(D.MAPS[id], C.carry(p, party, id)); s.flags.cleared = true; if (f) f(s); return s; };
  let r = C.complete(p, 'm1', fk('m1', ['gard', 'sena'], s => { s.stats.foeKo.push({ k: 'goblin', how: 'fall' }); s.stats.fightLen[1] = 3; }));
  ok(r.stamps.map(x => x.id).join() === 'm1a,m1b' && C.stampCount(p) === 2, '印：初回で①②がつく（③はつかない）');
  r = C.complete(p, 'm1', fk('m1', ['gard', 'sena'], s => { s.stats.foeKo.push({ k: 'goblin', how: 'fall' }); }));
  ok(r.stamps.length === 0 && C.stampCount(p) === 2, '印：一つにつき一度きり。同じ二人では③はつかない');
  p.roster.push('tobi');
  r = C.complete(p, 'm1', fk('m1', ['gard', 'tobi']));
  ok(r.stamps.map(x => x.id).join() === 'm1c', '印：別の二人で受けなおすと③');
  ok(r.ledgerNew.includes(3), '印：3つで腕だめし帳のごほうびに届く');
  const live = C.stampLive(p, 'm2', fk('m2', ['gard', 'sena'], s => { s.stats.foeKo.push({ k: 'goblin', how: 'drown' }); s.flags.cleared = false; }));
  ok(live.map(x => x.id).join() === 'm2a', '印：地図の上の知らせは、その場で分かる①だけ（②「倒れない」は達成してから）');
}
// ---- ドーラの腕だめし帳（03 6.3） ----
{
  const p = C.newProfile();
  ok(!C.ledgerOpen(p), '腕だめし帳：はじめはまだひらかない');
  p.done.m3 = { times: 1 };
  ok(C.ledgerOpen(p), '腕だめし帳：石切り場のあとからひらく');
  p.stamps = { m1a: true, m1b: true };
  ok(!C.claim(p, 3).ok, '腕だめし帳：印2つでは受けとれない');
  p.stamps.m2a = true;
  const r = C.claim(p, 3);
  ok(r.ok && p.charms.includes('c_tag') && p.ledger[3], '腕だめし帳：印3つで「身がわりの木札」');
  ok(!C.claim(p, 3).ok, '腕だめし帳：同じ段は二度受けとれない');
  for (const id of ['m2b', 'm3a', 'm3b']) p.stamps[id] = true;
  const c0 = p.coins; C.claim(p, 6);
  ok(p.coins === c0 + 100, '腕だめし帳：印6つで銀貨100');
  for (const id of ['m4a', 'm4b', 'm5a']) p.stamps[id] = true;
  C.claim(p, 9);
  ok(p.charms.includes('c_tabi'), '腕だめし帳：印9つで「韋駄天の足袋」');
  for (const id of ['m5b', 'm6a', 'm6b', 'm1c', 'm2c', 'm4c', 'm5c']) p.stamps[id] = true;
  C.claim(p, 12); C.claim(p, 16);
  ok(p.trophies.includes('oldbook') && C.stampCount(p) === 16, '腕だめし帳：印16で飾り棚「ドーラの古い依頼帳」');
}
// ---- 鍛冶屋：お守りの品 ----
{
  const p = C.newProfile();
  ok(!C.shop(p).some(x => x.s.id === 'c_plate'), '鍛冶屋：かたい胸当ては、はじめは並ばない');
  p.done.m3 = { times: 1 }; p.coins = 200;
  const it = C.shop(p).find(x => x.s.id === 'c_plate');
  ok(it && it.member && !it.owned, '鍛冶屋：石切り場のあと、かたい胸当て（150）');
  ok(C.buy(p, 'c_plate').ok && p.charms.includes('c_plate') && p.coins === 50 && !p.up.c_plate, '鍛冶屋：お守りを買うと、お守りの持ち物に入る');
  ok(!C.buy(p, 'c_plate').ok, '鍛冶屋：お守りは二つ買えない');
}
// ---- m5 川辺の村の米倉（missions/chapter1/m5 の10章・技術） ----
{
  const st = S.create(D.MAPS.m5, { party: ['riko', 'gard', 'sena'] });
  calm(st);
  ok(steps(st, 'gard', 4, 9) === 2 && steps(st, 'gard', 11, 9) === 5, 'm5：ガルドは (4,9) へ2歩、(11,9) へ5歩');
  let c = S.clone(st); act(c, 'gard', { k: 'push', ref: { o: 'o2' }, dir: 3 });
  ok(S.objById(c, 'o2').x === 4 && S.objById(c, 'o2').y === 3, 'm5：橋の大岩は北の岸 (4,3) で止まる');
  c = S.clone(st); const rr = act(c, 'gard', { k: 'push', ref: { o: 'o3' }, dir: 3 });
  ok(S.objById(c, 'o3').x === 11 && S.objById(c, 'o3').y === 5 && !S.surface(c, 11, 5).stand, 'm5：右の大岩は飛び石 (11,5) の上で止まり、ふさぐ');
  ok(rr.evs.some(e => e.k === 'caption' && /飛び石をふさいだ/.test(e.text)), 'm5：字幕「大岩が飛び石をふさいだ。盗っ人は橋へ回る」');
  const foe = { id: 'zz', k: 'raider', team: 'e', x: 11, y: 4, z: 3, hp: 3, mhp: 3, mv: 4 };
  const b0 = S.reach(st, foe, { max: 99 }).get(S.idx(st, 11, 7)).c, b1 = S.reach(c, foe, { max: 99 }).get(S.idx(c, 11, 7)).c;
  ok(b0 === 3 && b1 > 10, 'm5：ふさぐ前は3歩で南の岸、ふさいだあとは橋まわり（' + b1 + '歩）');
  ok(steps(st, 'riko', 12, 8) > 0 && S.surface(st, 12, 8).z === 5, 'm5：リコは右の丘（高さ5）へ上がれる（' + steps(st, 'riko', 12, 8) + '歩）');
  const t = S.create(D.MAPS.m5, { party: ['riko', 'gard', 'tobi'] }); calm(t);
  ok(S.plan(t, 'tobi', { k: 'blast', x: 4, y: 9 }).ok, 'm5：トビは (4,9) の発破で橋の大岩を転がせる');
  ok(!S.reach(st, S.unitById(st, 'riko'), { ignoreUnits: true }).has(S.idx(st, 1, 8)), 'm5：左の崖の上には、だれも上がれない');
}
// ---- m6 岩喰い大亀（missions/chapter1/m6 の10章・技術） ----
{
  const st = S.create(D.MAPS.m6, { party: ['riko', 'gard', 'sena'] });
  calm(st);
  ok(steps(st, 'gard', 0, 6) === 6 && steps(st, 'gard', 14, 6) >= 6, 'm6：ガルドは (5,7) から6歩で (0,6) に立てる → ' + steps(st, 'gard', 0, 6));
  const tt = { id: 'tt', k: 'turtle', team: 'e', x: 7, y: 6, z: 4, hp: 22, mhp: 22, mv: 2, active: true, boss: true, frozen: 0, flipped: 0, ko: false, grp: 1 };
  let c = S.clone(st); c.units.push(S.clone(tt)); put(c, 'gard', 0, 6); put(c, 'riko', 7, 8); put(c, 'sena', 9, 8); c.mode = 'combat'; c.turn = 1;
  let r = act(c, 'gard', { k: 'push', ref: { o: 'o1' }, dir: 0 });
  ok(r.ok && S.unitById(c, 'tt').flipped === 2 && S.unitById(c, 'tt').hp === 20 && S.objById(c, 'o1').x === 6, 'm6：列 y=6 の大亀に、端から転がした大岩が当たってすきができる（大岩は (6,6) に止まる）');
  // となりから押した大岩では、すきはできない
  c = S.clone(st); const t2 = S.clone(tt); c.units.push(t2); const bo = S.objById(c, 'o1'); bo.x = 6; bo.y = 6; put(c, 'gard', 5, 6); put(c, 'riko', 7, 8); put(c, 'sena', 9, 8); c.mode = 'combat'; c.turn = 1;
  r = act(c, 'gard', { k: 'push', ref: { o: 'o1' }, dir: 0 });
  ok(r.ok && !(S.unitById(c, 'tt').flipped > 0) && S.unitById(c, 'tt').hp === 22, 'm6：となりから押した大岩では、すきができない');
  const t = S.create(D.MAPS.m6, { party: ['riko', 'sena', 'tobi'] }); calm(t);
  ok(S.plan(t, 'tobi', { k: 'blast', x: 0, y: 6 }).ok && S.plan(t, 'tobi', { k: 'blast', x: 14, y: 6 }).ok, 'm6：トビは (0,6)・(14,6) の発破で大岩を転がせる');
  // 石柱（鋼の籠手）：倒れた梁は穴へ落ちず、通行をふさがない
  const g = S.create(D.MAPS.m6, { party: ['riko', 'gard', 'sena'], up: { gauntlet: true } }); calm(g);
  const rp = act(g, 'gard', { k: 'push', ref: { o: 'o3' }, dir: 0 });
  const beams = g.objs.filter(o => o.k === 'beam' && !o.gone).map(o => o.x + ',' + o.y).join(' ');
  ok(rp.ok && beams === '3,9 4,9 5,9', 'm6：左の石柱 (2,9) を東へ倒すと (3,9)〜(5,9) → ' + beams);
  ok(['3,9', '4,9', '5,9'].every(k => { const [x, y] = k.split(',').map(Number); return S.surface(g, x, y).stand; }), 'm6：倒れた梁の上は歩ける（ふさがない）');
}
// ---- 実装の地図が、設計の下書き（design/data/maps_draft.js）とずれていないこと（10 2.1） ----
{
  const DRAFT = require(path.join(__dirname, '..', 'design', 'data', 'maps_draft.js'));
  for (const id of ['m5', 'm6']) {
    const d = DRAFT[id], m = D.MAPS[id];
    for (const [x, y, c] of d.hmapPatch || []) ok(m.hmap[y][x] === c, id + '：下書きの高さ (' + x + ',' + y + ')=' + c + ' → ' + m.hmap[y][x]);
    for (const q of d.objsAdd || []) ok(m.objs.some(o => o.k === q.k && o.x === q.x && o.y === q.y), id + '：下書きの ' + q.k + ' (' + q.x + ',' + q.y + ') がある');
    for (const q of d.objsRemove || []) ok(!m.objs.some(o => o.k === q.k && o.x === q.x && o.y === q.y), id + '：下書きで動かした ' + q.k + ' (' + q.x + ',' + q.y + ') は、もとの升にない');
  }
}

console.log('pass', pass, 'fail', fail);
process.exit(fail ? 1 : 0);
