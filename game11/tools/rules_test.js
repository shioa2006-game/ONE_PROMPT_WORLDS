/*
 * ひゅるり、凧びより ― しくみの確認（検証用）
 *   node tools/rules_test.js
 * 描画なしで ルールの核（js/sim.js）を うごかし、ねらいどおり に はたらくか を たしかめる。
 */
const path = require('path');
for (const f of ['core.js', 'data.js', 'world.js', 'sim.js']) require(path.join(__dirname, '..', 'js', f));
const TJ = globalThis.TJ, TY = TJ.TYPES;
const bot = require('./bot.js');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ok  ', msg); } else { fail++; console.log('  NG  ', msg); } }
function step(sim, n, inp) { for (let i = 0; i < n; i++) sim.step(1 / 60, inp || {}); }

console.log('1. すべての もの が 手に入るか（世界に ある／なかみ／木の み／とり／ぼうし／ゆきぐも）');
{
  const sim = new TJ.Sim();
  const src = new Set();
  for (const o of sim.W.objs) { src.add(o.t); if (o.content) src.add(o.content); }
  for (const o of sim.W.objs) { const ty = TY[o.t]; if (ty.drops) for (const [t] of ty.drops) src.add(t); }
  for (const tr of sim.W.trees) { if (tr.fruit) src.add(tr.fruit); if (tr.tre) src.add(tr.tre); }
  for (const c of sim.W.creatures) if (c.item) src.add(c.item);
  src.add('kumo'); src.add('t_hoshi');
  const missing = Object.keys(TY).filter(k => !src.has(k));
  ok(missing.length === 0, 'すべての しゅるいに 入手元が ある（ないもの: ' + (missing.join(',') || 'なし') + '）');
  const tre = Object.keys(TY).filter(k => TY[k].k === 'tre');
  ok(tre.length === 15, 'おたからは 15こ（' + tre.length + '）');
}

console.log('2. じぶんより 大きいものは まきこめない');
{
  const sim = new TJ.Sim();
  const w = sim.wind;
  const big = sim.W.objs.find(o => o.t === 'baketsu');
  w.x = big.x; w.y = big.y - 10;
  step(sim, 30);
  ok(big.st === 0, 'S=5cm で バケツ（' + big.s.toFixed(0) + 'cm）は のこる');
  w.S = big.s + 1;
  step(sim, 40);
  ok(big.st === 2, 'S を バケツより 大きくすると まきこまれる');
}

console.log('3. ドン：かたいものは S が min に たりないと こわれない');
{
  const sim = new TJ.Sim();
  const w = sim.wind;
  const pot = sim.W.objs.find(o => o.t === 'ueki' && o.content);
  w.x = pot.x - 14; w.y = pot.y + 6; w.S = 6;
  for (let i = 0; i < 5; i++) sim.addOrbit('kareha', 0, 4, i, 0.5);
  sim.blastCd = 0; sim.blast(); step(sim, 60);
  ok(pot.hp === pot.maxhp, 'S=6cm（min 9cm）では へらない');
  w.S = 10; sim.blastCd = 0; sim.blast(); step(sim, 60);
  ok(pot.hp === pot.maxhp - 1, 'S=10cm で 1 へる（' + pot.hp + '/' + pot.maxhp + '）');
  sim.blastCd = 0; sim.blast(); step(sim, 60);
  ok(pot.st === 3, '2回で こわれる');
  const tre = sim.W.objs.find(o => o.t === 't_biidama');
  ok(!!tre, 'なかから おたから が でる');
  ok(sim.found.has('ueki'), 'こわした入れものは まきこみ帳に のる');
}

console.log('4. まわるものが ないと ドンは でない');
{
  const sim = new TJ.Sim();
  sim.blastCd = 0; sim.blast();
  ok(sim.events.some(e => e.type === 'blastEmpty') || sim.blastT > 1, 'から の ときは blastEmpty');
}

console.log('5. 凧は じゅんばん に、ひつようの 大きさ で あがる');
{
  const sim = new TJ.Sim();
  const w = sim.wind;
  const k1 = sim.W.kites[1];
  w.x = k1.x; w.y = k1.y; w.S = 300;
  step(sim, 10);
  ok(k1.st === 0, '凧1（けんた）は 凧0より さきには あがらない');
  const sim2 = new TJ.Sim();
  const w2 = sim2.wind;
  const k0 = sim2.W.kites[0];
  w2.x = k0.x; w2.y = k0.y; w2.S = 25;
  for (const o of sim2.W.objs) if (Math.hypot(o.x - k0.x, o.y - k0.y) < 60) o.st = 2; // まわりの ものを どけて 大きさを かえない
  step(sim2, 10);
  ok(k0.st === 0, 'S=25cm では やっこだこ（30cm）は あがらない');
  w2.S = 31; step(sim2, 10);
  ok(k0.st === 1 && sim2.kiteIdx === 1, 'S=31cm で あがる');
}

console.log('6. ゆきぐもが いるあいだ おおだこは あがらない');
{
  const sim = new TJ.Sim();
  const w = sim.wind;
  for (let i = 0; i < 4; i++) { sim.W.kites[i].st = 1; }
  sim.kiteIdx = 4;
  const k = sim.W.kites[4];
  w.S = 2300; w.x = k.x - 3000; w.y = k.y;
  step(sim, 5);
  ok(sim.boss.st === 'enter', 'おかに 入ると ゆきぐもが くる');
  w.x = k.x; w.y = k.y; step(sim, 10);
  ok(k.st === 0, 'ゆきぐもが いると おおだこは あがらない');
  step(sim, 200);
  for (let i = 0; i < 7; i++) { sim.addOrbit('roll', 0, 300, 0, 0.1); w.x = sim.boss.x; w.y = sim.boss.y; sim.blastCd = 0; sim.blast(); step(sim, 30); }
  ok(sim.boss.st === 'down' || sim.boss.st === 'gone', '7回 当てると たおれる（' + sim.boss.st + '）');
  step(sim, 120);
  w.x = k.x; w.y = k.y; w.S = 2300; step(sim, 10);
  ok(sim.ending, 'たおしたあと おおだこが あがり、むすびへ');
}

console.log('7. 門：こわすか、こえられる大きさまで とおれない');
{
  const sim = new TJ.Sim();
  const w = sim.wind;
  const kido = sim.W.objs.find(o => o.t === 'kido');
  w.x = -250; w.y = 10; w.S = 20;
  step(sim, 120, { kx: -1, ky: 0 });
  ok(w.x > -300, 'S=20cm、きどが あると 西へ でられない（x=' + w.x.toFixed(0) + '）');
  for (let i = 0; i < 6; i++) sim.addOrbit('kareha', 0, 4, i, 0.2);
  for (let i = 0; i < 4; i++) { sim.blastCd = 0; sim.blast(); step(sim, 60); }
  ok(kido.st === 3, 'ドン 4回で きどが こわれる');
  step(sim, 120, { kx: -1, ky: 0 });
  ok(w.x < -340, 'こわれたら 西へ でられる（x=' + w.x.toFixed(0) + '）');
}

console.log('8. 保存 → 読みこみ で 同じ状態に もどる');
{
  const sim = new TJ.Sim();
  // ボットで しばらく あそぶ
  const orig = TJ.Sim.prototype.step;
  let saved = null, snap = null;
  TJ.Sim.prototype.step = function (dt, inp) { orig.call(this, dt, inp); if (!saved && this.time > 200) { saved = JSON.parse(JSON.stringify(this.save())); snap = { S: this.wind.S, kite: this.kiteIdx, count: this.count, abs: this.absorbed.size, broken: this.broken.size, found: this.found.size, tre: this.tre.size, remain: this.W.objs.filter(o => o.st === 0).length }; } };
  bot.run('greedy', { quiet: true, max: 201 });
  TJ.Sim.prototype.step = orig;
  const s2 = new TJ.Sim(saved);
  const remain2 = s2.W.objs.filter(o => o.st === 0).length;
  ok(Math.abs(s2.wind.S - snap.S) < 0.01 && s2.kiteIdx === snap.kite && s2.count === snap.count, '大きさ・凧・数が もどる（S ' + snap.S.toFixed(1) + '→' + s2.wind.S.toFixed(1) + ', 凧 ' + snap.kite + '→' + s2.kiteIdx + '）');
  ok(s2.absorbed.size === snap.abs && s2.broken.size === snap.broken && s2.found.size === snap.found && s2.tre.size === snap.tre, 'まきこんだもの・こわしたもの・帳・おたから が もどる');
  ok(Math.abs(remain2 - snap.remain) <= 3, '地面に のこっているものの 数が ほぼ 同じ（' + snap.remain + '→' + remain2 + '。とちゅうで とんでいた ものの 差だけ）');
}

console.log('\n合計: ok ' + pass + ' / NG ' + fail);
process.exit(fail ? 1 : 0);
