// ルールの核の単体確認  node tools/rules_test.js
const K = require('../js/core.js'), assert = require('assert');
const at = (S, x, y) => { for (const k in S.nodes) if (S.nodes[k].x === x && S.nodes[k].y === y) return S.nodes[k].id; return -1; };
const mk = (map, vigor, dir) => { const L = K.parseLevel({ map, vigor, dir }); return [L, K.newState(L)]; };
let [L, S] = mk(['.....', '.....', '.....', '.....', '..R..'], 2);
K.spring(S, L); K.spring(S, L);
assert.strictEqual(at(S, 2, 2) >= 0, true, '2回の春で2ます伸びる');
let r = K.cut(S, at(S, 2, 2));
assert.deepStrictEqual(S.nodes[at(S, 2, 1)].buds, [7, 1], '裸の切り口は左ななめ・右ななめの二芽');
K.spring(S, L);
assert.ok(at(S, 1, 2) >= 0 && at(S, 3, 2) >= 0, '二芽とも伸びる（水2）');
r = K.cut(S, at(S, 1, 2));
assert.strictEqual(r.forked, false, '枝が残っている節は芽を吹かない');
// 水1: 同じ高さなら左が先、右は眠る
[L, S] = mk(['.....', '.....', '.....', '.....', '..R..'], 1);
K.spring(S, L); K.spring(S, L); K.cut(S, at(S, 2, 2));
let p = K.plan(S, L);
assert.deepStrictEqual(p.map(b => b.status), ['grow', 'sleep']); assert.strictEqual(p[0].dir, 7);
// 石でふさがれた芽は水を飲まない
[L, S] = mk(['.....', '.....', '.#...', '.....', '..R..'], 1);
K.spring(S, L); K.spring(S, L); K.cut(S, at(S, 2, 2));
p = K.plan(S, L);
assert.deepStrictEqual(p.map(b => b.status).sort(), ['block', 'grow']);
// ひだまりで花になって止まる／しずくで水が増える
[L, S] = mk(['..*..', '..o..', '..R..'], 1);
K.spring(S, L); assert.strictEqual(K.vigor(S, L), 2);
K.spring(S, L); assert.ok(K.solved(S, L)); assert.strictEqual(K.plan(S, L).length, 0);
K.cut(S, at(S, 2, 2)); assert.ok(!K.solved(S, L), '花の枝を切ると未完成に戻る');
// 斜めの枝どうしは交差できない
[L, S] = mk(['....', '....', '....', 'R...'], 3, 1);
K.spring(S, L);                       // (1,1)
K.cut(S, at(S, 1, 1));                // 根から 上(0) と 右(2)
K.spring(S, L);                       // (0,1) と (1,0)
K.cut(S, at(S, 0, 1)); K.cut(S, at(S, 1, 0)); // 根が裸に → また二芽
assert.deepStrictEqual(S.nodes[0].buds, [0, 2]);
[L, S] = mk(['....', '....', '....', 'R...'], 3, 1);
K.spring(S, L);                       // 根(0,0) → (1,1) の斜めの枝
S.nodes[9] = { id: 9, x: 1, y: 0, parent: 0, din: 2, children: [], buds: [7], bloom: false, born: 0 }; S.nodes[0].children.push(9);
p = K.plan(S, L).filter(b => b.node === 9);
assert.strictEqual(p[0].status, 'block', '(1,0)→(0,1) は (0,0)→(1,1) と交差するので伸びられない');
console.log('ルール確認: すべて成功');
