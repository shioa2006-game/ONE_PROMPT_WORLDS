// がらり、迷宮ひらき — ルールの自動確認
// 使い方: node tools/rules_test.js
const path = require('path');
const G = require(path.join(__dirname, '..', 'js', 'sim.js'));
const D = require(path.join(__dirname, '..', 'js', 'data.js'));
G.setData(D);

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log('NG:', name); } }
const C = (k, lv) => G.cell(k, lv);
// 窓に [上, 中, 下] が並ぶリールを作る（残りは空き）
function reelOf(rows) { const strip = rows.map(k => (Array.isArray(k) ? C(k[0], k[1]) : C(k))); while (strip.length < 8) strip.push(C('gap')); return { strip: strip, pos: 0 }; }
function setup(cols, enemies, walls) {
  const s = G.newGame(3);
  s.reels = cols.map(reelOf);
  G.startBattle(s, null, 'practice', 's1_hall');
  s.b.kind = 'battle';
  s.b.en = [];
  s.b.spawns = [];
  (enemies || []).forEach(e => G.addEnemy(s.b, e[0], e[1], e[2]));
  s.b.walls = walls || [{ kind: 'rock' }, { kind: 'rock' }, { kind: 'rock' }];
  s.b.offs = s.reels.map(() => 0);
  s.b.phase = 'aim';
  s.b.mp = s.mpMax;
  return s;
}

// ---------- 行の読み方 ----------
{
  const s = setup([['sword', 'fire', 'gap'], ['sword', 'fire', 'sword'], ['sword', 'sword', 'sword']]);
  const L = G.lines(s);
  ok(L.length === 2, '行は左から読む（下の行は1本目が空きなので呪文にならない）');
  ok(L[0].el === 'sword' && L[0].n === 3 && L[0].power === 6, '剣×3 = 3 × 2 = 6');
  ok(L[1].el === 'fire' && L[1].n === 2 && L[1].power === 2, '炎×2 = 2 × 1 = 2（3本目の剣で途切れる）');
}
{
  const s = setup([['star'], ['fire'], ['fire'], ['fire'], ['ice']]);
  const L = G.lineOf(s, 0);
  ok(L.el === 'fire' && L.n === 4 && L.power === 4 * 4 * 2, '星は代わりになり、行の力を2倍（炎×4 = 4×4×2 = 32）');
  const s2 = setup([['star'], ['star']]);
  ok(G.lineOf(s2, 0).el === 'star' && G.lineOf(s2, 0).power === 4, '星だけの行は「星」の呪文');
  const s3 = setup([[['sword', 2]], [['sword', 3]], [['sword', 1]], ['sword'], ['sword']]);
  ok(G.lineOf(s3, 0).power === (2 + 3 + 1 + 1 + 1) * 8, 'Lv の合計 × 5つの倍率 8');
  ok(G.LEN_MULT[2] === 1 && G.LEN_MULT[3] === 2 && G.LEN_MULT[4] === 4 && G.LEN_MULT[5] === 8, '倍率は 2つ×1・3つ×2・4つ×4・5つ×8');
}

// ---------- 貫く・壁 ----------
{
  const s = setup([['sword'], ['sword'], ['sword']], [['goblin', 0, 1], ['goblin', 0, 3]], [{ id: 'wx', kind: 'crack', need: 'any', th: 2 }, { kind: 'rock' }, { kind: 'rock' }]);
  const r = G.predict(s);
  ok(r.kills === 2 && r.evs[0].rem === 2 && r.walls[0] === 'wx', '剣×3=6：小鬼2体（2+2）を貫き、余った2がひびの壁(2)を崩す');
  ok(s.b.en.every(e => e.hp > 0) && !s.b.walls[0].broken, '見こみは状態を変えない');
}
{
  const s = setup([['fire'], ['fire'], ['fire']], [['thornling', 1, 2]]);
  s.reels.forEach(R => { R.pos = 7; });
  const s2 = setup([['gap', 'fire'], ['gap', 'fire'], ['gap', 'fire']], [['thornling', 1, 2]], [{ kind: 'rock' }, { id: 'wt', kind: 'thorn', need: 'fire', th: 3 }, { kind: 'rock' }]);
  const r = G.predict(s2);
  ok(r.evs[0].hits[0].kill && r.evs[0].hits[0].m === 2 && r.evs[0].rem === 4 && r.walls[0] === 'wt', '炎は茨っこに2倍：体力3を2の力で倒し、余り4で茨（炎3）が燃える');
  const s3 = setup([['gap', 'sword'], ['gap', 'sword'], ['gap', 'sword']], [], [{ kind: 'rock' }, { id: 'wt', kind: 'thorn', need: 'fire', th: 3 }, { kind: 'rock' }]);
  const r3 = G.predict(s3);
  ok(r3.evs[0].wall && !r3.evs[0].wall.fits && !r3.walls.length, '剣の行は茨にはじかれる（合う紋が要る）');
  const s4 = setup([['gap', 'fire'], ['gap', 'fire']], [], [{ kind: 'rock' }, { id: 'wt', kind: 'thorn', need: 'fire', th: 3 }, { kind: 'rock' }]);
  const r4 = G.predict(s4);
  ok(r4.evs[0].wall.fits && !r4.evs[0].wall.ok && r4.evs[0].wall.power === 2, '炎×2=2 は茨(3)に届くが足りない');
}
{
  const s = setup([['sword'], ['sword'], ['sword']], [['crab', 0, 1]]);
  const r = G.predict(s);
  ok(r.evs[0].hits[0].dmg === 3 && !r.evs[0].hits[0].kill && r.evs[0].rem === 0, '水晶ガニは剣が半分（6→3）。倒せなければ止まる');
}
// ---------- 雷・氷 ----------
{
  const s = setup([['bolt'], ['bolt'], ['bolt']], [['goblin', 0, 1], ['crab', 0, 2], ['slime', 0, 3]], [{ id: 'wg', kind: 'gear', need: 'bolt', th: 6 }, { kind: 'rock' }, { kind: 'rock' }]);
  const r = G.predict(s);
  const h = r.evs[0].hits;
  ok(h.length === 3 && h[0].dmg === 2 && h[1].dmg === 6 && h[1].kill && h[2].dmg === 5 && h[2].kill, '雷は列の魔物すべてに同じ力（ガニは雷に2倍）');
  ok(r.walls[0] === 'wg', '雷：列をみな倒せば、力がそのまま壁に届く（歯車が動く）');
}
{
  const s = setup([['ice'], ['ice']], [['goblin', 2, 1], ['chief', 2, 3]]);
  s.reels.forEach(R => { R.pos = 6; });
  // 下の行に氷が来るように
  const s2 = setup([['gap', 'gap', 'ice'], ['gap', 'gap', 'ice']], [['goblin', 2, 1], ['chief', 2, 3]]);
  G.cast(s2);
  const chief = s2.b.en.find(e => e.t === 'chief');
  ok(chief.frozen === 1, '氷の行は、生き残った魔物を凍らせる');
  const before = chief.col;
  s2.b.phase = 'enemy';
  G.enemyPhase(s2);
  ok(chief.col === before && chief.frozen === 0, '凍った魔物は一歩止まり、とける');
}
// ---------- ずらしと魔力 ----------
{
  const s = setup([['sword'], ['sword'], ['sword']]);
  ok(G.shift(s, 0, 1) && s.b.mp === 1, 'ずらすと魔力を1使う');
  ok(G.shift(s, 0, -1) && s.b.mp === 2, '戻すと魔力がもどる');
  ok(G.shift(s, 1, 1) && G.shift(s, 2, -1) && !G.shift(s, 0, 1), '魔力が尽きるとずらせない');
  G.resetShift(s);
  ok(s.b.offs.every(o => o === 0) && s.b.mp === s.mpMax, '全部もどす');
  const q = G.newGame(3);
  G.startBattle(q, 'b_thorn', 'quiet', 's1_thorn');
  ok(G.mpOf(q) === q.mpMax + 2 && q.b.en.length === 0, '静かな部屋は魔物なし・魔力+2');
}
// ---------- 魔物の手番 ----------
{
  const s = setup([['sword']], [['goblin', 0, 0], ['goblin', 0, 1], ['bat', 0, 5], ['archer', 2, 5], ['chief', 1, 4]]);
  s.b.phase = 'enemy';
  const hp0 = s.b.hp;
  const ev = G.enemyPhase(s);
  ok(s.b.hp === hp0 - 1, '目の前（col 0）の小鬼が心を1減らす');
  ok(s.b.en[1].col === 1, '前がふさがっていると進めない');
  ok(s.b.en[2].col === 3, 'コウモリは二歩すすむ');
  ok(s.b.en[3].col === 4, '弓小鬼は歩く（まだ三歩より遠い）');
  ok(ev.some(e => e.k === 'rest' && e.id === s.b.en[4].id), '親分は一手おきに休む');
  s.b.en[3].col = 3; s.b.phase = 'enemy';
  const hp1 = s.b.hp;
  G.enemyPhase(s);
  ok(s.b.hp <= hp1 - 2 && s.b.en[3].col === 3, '弓小鬼は三歩の距離から矢を射る');
}
{
  const s = setup([['sword']], [['arm', 0, 5]]);
  s.b.en[0].cd = 1;
  s.b.phase = 'enemy';
  const hp0 = s.b.hp;
  G.enemyPhase(s);
  ok(s.b.hp === hp0 - G.EN.arm.atk && s.b.en[0].cd === G.EN.arm.every, '番人の腕は数手ごとに一撃（数字が0で振りおろす）');
}
// ---------- 増援・巣・勝ち負け ----------
{
  const s = setup([['sword']], [], [{ kind: 'rock' }, { id: 'wn', kind: 'thorn', need: 'fire', th: 3, nest: { t: 'thornling', every: 2, left: 2, cd: 2 } }, { kind: 'rock' }]);
  s.b.spawns = [{ after: 4, t: 'goblin', lane: 0 }];
  s.b.phase = 'enemy';
  const ev = G.enemyPhase(s);
  ok(ev.filter(e => e.k === 'spawn').length === 1 && s.b.en.some(e => e.t === 'goblin'), '場が空なら、次の増援を前倒しで呼ぶ');
  const s9 = setup([['sword']], [], [{ kind: 'rock' }, { id: 'wn', kind: 'thorn', need: 'fire', th: 3, nest: { t: 'thornling', every: 2, left: 2, cd: 2 } }, { kind: 'rock' }]);
  s9.b.phase = 'enemy';
  const ev9 = G.enemyPhase(s9);
  ok(ev9.some(e => e.k === 'spawn' && e.nest), '増援がなく場が空なら、巣の魔物がすぐ出てくる');
  ok(G.pendingSpawns(s.b), '巣が残っていれば、まだ勝ちではない');
  s.b.walls[1].broken = true;
  ok(!G.pendingSpawns(s.b), '壁を崩すと巣は止まる');
}
{
  const s = G.newGame(5);
  G.startBattle(s, 'b_chief', 'battle', 's1_root');
  const b = s.b;
  const chief = b.en.find(e => e.t === 'chief');
  chief.hp = 1; chief.lane = 1;
  b.en.filter(e => e !== chief && e.lane === 1).forEach(e => { e.hp = 0; });
  s.reels = [reelOf(['gap', 'sword']), reelOf(['gap', 'sword'])];
  b.offs = [0, 0]; b.phase = 'aim';
  const r = G.cast(s);
  ok(r.bossDead && r.fled.length > 0 && b.en.every(e => e.hp <= 0) && r.end === 'win', '主を倒すと取り巻きは逃げ、勝ち');
  const got = G.winBattle(s);
  ok(got.some(it => it.reel) && s.reels.length === 3 && b.pick && b.pick.length === 2, 'ほうび（リール）と、持ち帰る紋の二択');
  const n = s.bag.length;
  G.takePick(s, 0);
  ok(s.bag.length === n + 1 && !b.pick, '二択から一つを持ち帰る');
}
{
  const s = G.newGame(5);
  G.startBattle(s, 'b_chief', 'battle', 's1_root');
  s.b.en[0].hp = 7;
  s.b.hp = 1;
  s.b.en.push(Object.assign(G.addEnemy(s.b, 'goblin', 2, 0), {}));
  s.b.phase = 'enemy';
  G.enemyPhase(s);
  ok(s.b.phase === 'lose', '心が尽きると負け');
  G.startBattle(s, 'b_chief', 'battle', 's1_root');
  ok(s.b.en[0].hp === 7 && s.b.scarred, '主の傷は次の挑戦に残る');
}
// ---------- 番人の殻 ----------
{
  const s = G.newGame(5);
  G.startBattle(s, 'b_final', 'battle', 's4_gate');
  const heart = s.b.en.find(e => e.t === 'heart');
  ok(heart.shell === 1 && G.mult('light', heart) === 1, '腕が残っていると胸は殻で半分（光の2倍と打ち消し）');
  s.b.en.filter(e => e.t === 'arm').forEach(e => { e.hp = 0; });
  G.updateShell(s.b);
  ok(heart.shell === 0 && G.mult('light', heart) === 2, '腕を崩すと殻がはがれ、光が2倍');
}
// ---------- 組みかえ ----------
{
  const s = G.newGame(5);
  s.bag.push(C('fire'));
  const old = s.reels[0].strip[0].k;
  G.place(s, 0, 0, 0);
  ok(s.reels[0].strip[0].k === 'fire' && s.reels[0].strip[0].nw && s.bag.length === (old === 'gap' ? 0 : 1), '持ち物の紋を刻む（前の紋は持ち物へ）');
  G.swap(s, 0, 0, 1, 1);
  ok(s.reels[1].strip[1].k === 'fire', '入れかえ（ほかのリールとも）');
  G.unplace(s, 1, 1);
  ok(s.reels[1].strip[1].k === 'gap' && s.bag.some(c => c.k === 'fire'), '外すと空きになり、持ち物へ');
  s.forge = 1;
  const c = s.reels[0].strip.find(x => x.k === 'sword');
  ok(G.forgeUp(s, c) && c.lv === 2 && s.forge === 0 && !G.forgeUp(s, c), '鍛え石で Lv+1');
}
// ---------- 地図 ----------
{
  const s = G.newGame(5);
  ok(G.known(s, 's1_hall') && G.known(s, 's1_thorn') && !G.known(s, 's1_cache') && !G.known(s, 's1_forge'), 'はじめは師匠の下書きの部屋だけ見える（隠し部屋・鍛冶の跡は見えない）');
  ok(G.path(s, 's1_in', 's1_bats') === null, 'たたかっていない広間は通りぬけられない');
  G.enterRoom(s, 's1_hall'); G.rs(s, 's1_hall').c = 1;
  ok(JSON.stringify(G.path(s, 's1_in', 's1_bats')) === '["s1_in","s1_hall","s1_bats"]', '追いはらった部屋は通りぬけられる');
  G.enterRoom(s, 's1_bats');
  ok(G.known(s, 's1_forge'), '部屋に入ると、となりの部屋が地図に出る');
  ok(G.path(s, 's1_hall', 's1_cache') === null, '茨が残っていると奥へは行けない');
  const out = G.openWall(s, 'w_thorn');
  ok(out.indexOf('s1_cache') >= 0 && G.known(s, 's1_cache'), '壁を崩すと、その先の部屋が地図に出る');
}
{
  // すべての壁が開けば、すべての部屋へ行ける
  const s = G.newGame(5);
  for (const id in D.ROOMS) { G.rs(s, id).v = 1; G.rs(s, id).k = 1; G.rs(s, id).c = 1; }
  for (const e of D.EDGES) if (e.gate) s.walls[e.gate] = 1;
  ok(Object.keys(D.ROOMS).every(id => G.path(s, 's1_in', id)), 'すべての部屋がつながっている');
  const wallsInData = new Set(); Object.values(D.BATTLES).forEach(b => (b.walls || []).forEach(w => w && w.id && wallsInData.add(w.id)));
  ok(D.EDGES.filter(e => e.gate).every(e => wallsInData.has(e.gate)), 'どの門も、どこかの戦場の奥にある');
}
// ---------- 教える回転 ----------
{
  // 茨の間：炎を3つ、どのマスに刻んでも「一つずらせば茨が燃える」止まり方が見つかる
  let found = 0, total = 0;
  for (let a = 0; a < 8; a += 3) for (let b2 = 0; b2 < 8; b2 += 3) for (let c = 0; c < 8; c += 2) {
    const s = G.newGame(9 + a * 64 + b2 * 8 + c);
    s.reels[0].strip[a] = C('fire'); s.reels[1].strip[b2] = C('fire'); s.reels[2].strip[c] = C('fire');
    G.startBattle(s, 'b_thorn', 'battle', 's1_thorn');
    const f = G.findTeachSpin(s, (r0, r1) => r0.walls.indexOf('w_thorn') < 0 && r1.walls.indexOf('w_thorn') >= 0);
    total++; if (f) found++;
  }
  ok(found === total, `茨の間の教える回転：炎の置き場所 ${total} 通りすべてで見つかる（${found}/${total}）`);
}
// ---------- 保存 ----------
{
  const s = G.newGame(5);
  G.enterRoom(s, 's1_hall'); G.rs(s, 's1_hall').c = 1; s.bag.push(C('fire', 2));
  const sv = JSON.parse(JSON.stringify(G.save(s)));
  ok(sv.b === null && sv.bag[0].lv === 2 && G.visited(sv, 's1_hall') && G.path(sv, 's1_in', 's1_bats'), '保存して読みこんでも同じ');
}

console.log(`${pass}/${pass + fail} 通過`);
process.exit(fail ? 1 : 0);
