// GUILDWARD — 依頼5・依頼6の想定攻略手順（ネタバレ）。node でもページの中でも動く
// design/missions/chapter1/ の m5・m6 の6章「攻略の例」を、手番ごとの手に書きおろしたもの。道具はなし（長い鉤縄だけ）。
// ボットは一手番先しか見ないので、段取りの要る手（大岩の列に並ぶのを待つ・おとりで大亀をさそう）を組めない（10 4章）。
//   tools/plan_route.js  … ルールだけで通す（手番ごとの記録つき）
//   tools/solve_check.js … m6 はこの手順で通す（ボットだけの結果は参考に出す）。m5 はボットで通し、この手順も試す
//   tools/playthrough.py … ページに読みこみ、手順の一手ずつを本物のクリックに置きかえる
// 手の書き方：[仲間, 行動]。ref:'boss' は大亀、'near:x,y' はその升にいちばん近い取りまき。at:'boss:0,-1' は大亀の北どなりの升。
//   'bot' は大亀に手を出さない小さな手（取りまきの相手）をボットに選ばせる。'botAny' はなんでも。{ expect:'x,y' } は赤い線の確かめ。
'use strict';
(function () {
const IN_PAGE = typeof window !== 'undefined' && window.S21;
const S = IN_PAGE ? window.S21 : require(require('path').join(__dirname, '..', 'js', 'sim.js'));
const BOT = IN_PAGE ? window.BOT21 : require('./bot.js');
const L = (x, y) => ({ k: 'move', x, y });
const M6 = {
  GS: [
    // 第1手番：ガルドは左の大岩へ向かう。リコは開始位置のまま小鬼を射る。セナは右の小鬼を凍らせる
    [['gard', L(2, 7)], ['riko', { k: 'shoot', ref: 'near:2,5' }], ['sena', { k: 'freeze', ref: 'near:12,5' }]],
    // 第2手番：ガルドは大岩のうしろ (0,6) へ。リコはおとり。赤い線で、大亀が (7,6) へ来るのを確かめる
    [['gard', L(0, 6)], ['riko', { k: 'shoot', ref: 'near:4,6' }], ['sena', { k: 'freeze', ref: 'near:11,7', soft: true }], { expect: '7,6' }],
    // 第3手番：大岩を東へ → ひっくり返る。リコと セナでお腹へ
    [['gard', { k: 'push', ref: { o: 'o1' }, dir: 0 }], ['riko', { k: 'shoot', ref: 'boss' }], ['sena', { k: 'freeze', ref: 'boss' }]],
    // 第4手番：すきの続き。リコとセナは下の段（高さ2）へ下りてからお腹へ（大亀は1段しか上り下りできず、下の段には来られない）。
    // ガルドは中段を戻ってくる。起きあがった大亀は、中段に残ったガルドのほうへ、南のふち（y=7）を歩いてくる
    [['riko', L(7, 8)], ['riko', { k: 'shoot', ref: 'boss' }], ['sena', L(9, 8)], ['sena', { k: 'freeze', ref: 'boss' }], ['gard', L(3, 6)]],
    // 第5手番：ガルドは止まっていた大岩 (6,6) のうしろ (5,6) へ回り、東へ転がす（取りまきのコウモリに当てる）。
    // 中段にいるのはガルドだけ。大亀はガルドのとなり＝南のふち (5,7) へ来て止まる。リコとセナは下の段から取りまきを
    [['gard', { k: 'push', ref: { o: 'o1' }, dir: 0 }], ['riko', 'bot'], ['sena', 'bot'], { expect: '5,7' }],
    // 第6手番：二度目のすき。ガルドが、ふちの大亀を南へ押し落とす（下の段へ2段落ちて、ひっくり返る）。リコとセナはお腹へ
    [['gard', { k: 'push', ref: 'boss', dir: 1 }], ['riko', { k: 'shoot', ref: 'boss' }], ['sena', { k: 'freeze', ref: 'boss' }]],
    // 第7手番：すきの続きで倒す
    [['riko', { k: 'shoot', ref: 'boss' }], ['sena', { k: 'freeze', ref: 'boss' }], ['gard', 'botAny']],
    [['riko', 'botAny'], ['sena', 'botAny'], ['gard', 'botAny']],
  ],
  GT: [
    // 第1手番：リコは開始位置のまま（おとり）小鬼を射る。トビは下の段 (11,8) へ下りて、右の小鬼に発破。ガルドは左の大岩へ向かう
    [['riko', { k: 'shoot', ref: 'near:2,5' }], ['tobi', L(11, 8)], ['tobi', { k: 'blast', at: 'near:12,5', soft: true }], ['gard', L(2, 7)]],
    // 第2手番：ガルドは左の大岩のうしろ (0,6) へ。赤い線で、大亀が (7,6) へ来るのを確かめる
    [['gard', L(0, 6)], ['riko', { k: 'shoot', ref: 'near:4,6', soft: true }], ['tobi', { k: 'blast', at: 'near:11,7', soft: true }], { expect: '7,6' }],
    // 第3手番：トビが (14,6) で発破 → 右の大岩が列を西へ転がって当たる → ひっくり返る。リコはお腹へ
    [['tobi', { k: 'blast', x: 14, y: 6 }], ['riko', { k: 'shoot', ref: 'boss' }]],
    // 第4手番：すきの続き。リコは下の段へ下りてお腹へ、トビはお腹の上で発破。中段に残るのは、左の大岩のうしろのガルドだけ
    // → 起きあがった大亀は、ガルドのほうへ南のふち（y=7）を歩いてくる
    [['riko', L(7, 8)], ['riko', { k: 'shoot', ref: 'boss' }], ['tobi', { k: 'blast', at: 'boss' }]],
    // 第5手番：ふちの大亀の北の升 (6,6) で発破 → 下の段へ落ちて、二度目のすき。リコはお腹へ
    [['tobi', { k: 'blast', x: 6, y: 6 }], ['riko', { k: 'shoot', ref: 'boss' }], ['gard', 'bot']],
    // 第6手番：すきの続きで倒す
    [['riko', { k: 'shoot', ref: 'boss' }], ['tobi', { k: 'blast', at: 'boss' }], ['gard', 'botAny']],
    [['riko', 'botAny'], ['tobi', 'botAny'], ['gard', 'botAny']],
  ],
  ST: [
    // 第1手番：リコは開始位置のまま（おとり）右の小鬼を射る。セナは左の小鬼を凍らせる。トビは下の段 (11,8) へ
    [['riko', { k: 'shoot', ref: 'near:12,5' }], ['sena', { k: 'freeze', ref: 'near:2,5' }], ['tobi', L(11, 8)], ['tobi', { k: 'blast', at: 'near:12,5', soft: true }]],
    // 第2手番：リコは凍った小鬼を射る（セナとトビは、その場で待つ）。赤い線で、大亀が (7,6) へ来るのを確かめる
    [['riko', { k: 'shoot', ref: 'near:2,5', soft: true }], { expect: '7,6' }],
    // 第3手番：トビが (14,6) で発破 → 右の大岩が西へ転がって当たる → ひっくり返る。リコとセナはお腹へ
    [['tobi', { k: 'blast', x: 14, y: 6 }], ['riko', { k: 'shoot', ref: 'boss' }], ['sena', { k: 'freeze', ref: 'boss' }]],
    // 第4手番：すきの続き。リコとセナは下の段へ下りてからお腹へ、トビはお腹の上で発破。
    // 起きあがった大亀は、下の段の三人のほうへ、東の段（14,8）をめざして中段を歩いていく
    [['riko', L(8, 8)], ['riko', { k: 'shoot', ref: 'boss' }], ['sena', L(5, 8)], ['sena', { k: 'freeze', ref: 'boss' }], ['tobi', { k: 'blast', at: 'boss' }]],
    // 第5手番：セナが凍らせ、トビが大亀の北どなりの升で発破 → 凍った大亀が南へすべって、段の下へ落ちる（連携）→ 二度目のすき
    [['sena', { k: 'freeze', ref: 'boss' }], ['tobi', { k: 'blast', at: 'boss:0,-1' }], ['riko', { k: 'shoot', ref: 'boss' }]],
    // 第6手番：すきの続きで倒す
    [['riko', { k: 'shoot', ref: 'boss' }], ['sena', { k: 'freeze', ref: 'boss' }], ['tobi', { k: 'blast', at: 'boss' }]],
    [['riko', 'botAny'], ['sena', 'botAny'], ['tobi', 'botAny']],
  ],
};
// 依頼5：右の渡り口を止め、橋の出口を仲間がふさぐ → 盗っ人が橋の上に並ぶ → ふさいだ仲間がよけて、大岩を北へ
const M5 = {
  GS: [
    // 第1手番：ガルドは橋の大岩のうしろ (4,9) へ。リコは橋の出口のそばへ。セナは飛び石が届く (9,8) へ
    [['gard', L(4, 9)], ['riko', L(5, 8)], ['sena', L(9, 8)]],
    // 第2手番：リコが橋の出口 (4,7) をふさぐ。セナは飛び石の上の盗っ人を凍らせて、右の渡り口を止める（凍った敵は通せんぼになる）
    [['riko', L(4, 7)], ['sena', { k: 'freeze', ref: 'near:11,5' }]],
    // 第3手番：もう一度凍らせて、右を止めたまま待つ。行き場のない盗っ人は、橋の出口のリコをめざして橋の上に並ぶ
    [['sena', { k: 'freeze', ref: 'near:11,5' }]],
    // 第4手番：リコがよけて、ガルドが大岩を北へ → 橋の上の列をまとめてなぎ倒す
    [['riko', L(3, 8)], ['gard', { k: 'push', ref: { o: 'o2' }, dir: 3 }]],
  ],
  GT: [
    // 第1手番：トビが (11,9) で発破 → 右の大岩が飛び石の上で止まって栓になる。ガルドは橋の大岩のうしろへ
    [['tobi', { k: 'blast', x: 11, y: 9 }], ['gard', L(4, 9)], ['riko', L(5, 8)]],
    // 第2手番：リコが橋の出口をふさぐ。第3手番は待つ（盗っ人が橋に並ぶのを、赤い線で見る）
    [['riko', L(4, 7)]],
    [],
    [['riko', L(3, 8)], ['gard', { k: 'push', ref: { o: 'o2' }, dir: 3 }]],
  ],
  ST: [
    [['tobi', { k: 'blast', x: 11, y: 9 }], ['sena', L(5, 8)]],
    [['sena', L(4, 7)]],
    [],
    // 第4手番：セナがよけて、トビが大岩のうしろ (4,9) で発破 → 大岩が橋をぬけて転がる
    [['sena', L(3, 8)], ['tobi', { k: 'blast', x: 4, y: 9 }]],
  ],
};
const PLANS = { m5: M5, m6: M6 };

function resolveRef(st, who) {
  const live = S.liveEnemies(st).filter(e => e.active);
  if (who === 'boss') return live.find(e => e.boss);
  if (who.startsWith('id:')) return live.find(e => e.id === who.slice(3));
  if (who.startsWith('near:')) { const [x, y] = who.slice(5).split(',').map(Number); return live.filter(e => !e.boss).sort((a, b) => (Math.abs(a.x - x) + Math.abs(a.y - y)) - (Math.abs(b.x - x) + Math.abs(b.y - y)))[0]; }
  return null;
}
function intentOf(st, it) {
  const I = JSON.parse(JSON.stringify(it));
  delete I.soft;
  if (I.ref && typeof I.ref === 'string') { const e = resolveRef(st, I.ref); if (!e) return null; I.ref = { u: e.id }; }
  if (I.at && typeof I.at === 'string') {
    const off = I.at.startsWith('boss:') ? I.at.slice(5) : null;
    const e = resolveRef(st, off ? 'boss' : I.at); if (!e) return null;
    const [dx, dy] = off ? off.split(',').map(Number) : [0, 0];
    I.x = e.x + dx; I.y = e.y + dy; delete I.at;
  }
  return I;
}
// 'bot'：大亀に手を出さない手のうち、ボットの評価がいちばん良いもの
function botPick(st, hero, any) {
  const boss = st.units.find(u => u.boss && !u.ko);
  const cands = BOT.candidates(st, hero).filter(q => any || !boss || (!(q.intent.ref && q.intent.ref.u === boss.id) && !(q.intent.k === 'blast' && Math.abs(q.intent.x - boss.x) + Math.abs(q.intent.y - boss.y) <= 1)));
  let best = null, bs = -1e18;
  for (const q of cands) { const c = S.clone(st); S.apply(c, q); const sc = BOT.evalState(c); if (sc > bs) { bs = sc; best = q; } }
  return best;
}
// いまの手番の手を、写しの上で順に試して、具体的な行動の並びにする
function turnActions(st, pk) {
  const plan = (PLANS[st.sec] || {})[pk] || [];
  const steps = plan[st.turn - 1] || S.heroes(st).map(h => [h.id, 'botAny']);
  const c = S.clone(st);
  const out = [];
  for (const step of steps) {
    if (c.mode !== 'combat') break;
    if (step.expect) { const it = S.intents(c).find(r => r.id === (c.units.find(u => u.boss) || {}).id); out.push({ expect: step.expect, got: it && it.to ? it.to.join(',') : '' }); continue; }
    const [hero, it0] = step;
    const u = S.unitById(c, hero);
    if (!u || u.ko || u.acted) continue;
    if (it0 === 'bot' || it0 === 'botAny') { const q = botPick(c, hero, it0 === 'botAny'); if (q) { out.push({ hero, intent: q.intent, bot: true }); S.apply(c, q); } continue; }
    const I = intentOf(c, it0);
    if (!I) { out.push({ hero, skip: true }); continue; }
    const p = S.plan(c, hero, I);
    if (!p.ok) { out.push({ hero, intent: I, fail: p.why, soft: !!it0.soft }); continue; }
    out.push({ hero, intent: I });
    S.apply(c, p);
  }
  return out;
}
const API = { PLANS, turnActions, intentOf, botPick };
if (IN_PAGE) { window.PLAN21 = API; return; }
module.exports = API;
})();
