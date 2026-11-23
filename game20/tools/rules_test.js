// 迎撃の規則の自動確認
// 使い方: node tools/rules_test.js
const { load } = require('./lib');
const { D, S } = load();
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('NG', msg); } }
function wave(groups, allies) { return { id: 't', title: 't', allies: allies || ['ilza', 'ruu', 'kai', 'dugan', 'mel'], groups }; }
function runUntil(st, fn, maxT) { while (!st.over && st.t < (maxT || 200)) { S.step(st); if (fn && fn(st)) break; st.events.length = 0; } return st; }

// 1. 同じ配置なら同じ結果（乱数なし）
{
  const w = D.NIGHTS[1].waves[1];
  const pl = { ilza: 's_land', ruu: 'w_sw', kai: 'w_se' };
  const a = S.run(S.create({ wave: w, placement: pl, keepEvents: false }));
  const b = S.run(S.create({ wave: w, placement: pl, keepEvents: false }));
  ok(a.result.win === b.result.win && a.result.lamps === b.result.lamps && Math.abs(a.result.t - b.result.t) < 1e-9 && a.stats.killed === b.stats.killed, '決定的であること');
}
// 2. だれもいなければ、敵は扉まで歩き、灯が消える
{
  const st = S.run(S.create({ wave: wave([{ r: 'S', e: 'goblin', n: 3, t: 0, gap: 1 }], ['ilza']), placement: {} }));
  ok(st.lamps === 2 && st.stats.leaks.S === 3, '止める者がいなければ通される lamps=' + st.lamps);
}
// 3. 踊り場のイルザが先頭を止め、後ろが列になって詰まる
{
  const st = S.create({ wave: wave([{ r: 'S', e: 'goblin', n: 4, t: 0, gap: 0.5 }], ['ilza']), placement: { ilza: 's_land' } });
  let seen = false;
  while (!st.over && st.t < 30) { S.step(st); for (const e of st.events) if (e.type === 'block') seen = true; st.events.length = 0; if (seen) break; }
  for (let i = 0; i < 60; i++) { S.step(st); st.events.length = 0; }
  const alive = st.enemies.filter((e) => S.alive(e)).sort((p, q) => q.d - p.d);
  ok(alive.length >= 3 && alive[0].eng && alive[0].eng.id === 'ilza', '先頭が受け止められる');
  let gaps = true;
  for (let i = 1; i < alive.length; i++) if (alive[i - 1].d - alive[i].d > 0.7) gaps = false;
  ok(gaps, '後ろが詰まって列になる');
  ok(alive.slice(1).every((e) => e.mode === 'wait' || e.mode === 'press'), '後ろは待つか、肩ごしに打つ');
}
// 4. 門は敵を止め、壊れると通れる
{
  const st = S.create({ wave: wave([{ r: 'G', e: 'goblin', n: 3, t: 0, gap: 0.6 }], ['ilza']), placement: {} });
  runUntil(st, (s) => s.t > 6);
  const front = st.enemies.filter((e) => S.alive(e)).sort((p, q) => q.d - p.d)[0];
  ok(front.d < S.routes.G.gateD && front.mode === 'gate', '門の前で止まり、門を叩く');
  runUntil(st, (s) => s.gate.broken);
  ok(st.gate.broken, '門は叩かれ続けると壊れる');
  S.run(st);
  ok(st.stats.leaks.G === 3, '門が壊れたあとは通る');
}
// 5. 受け止められる数を超えた敵は、すり抜ける（合流点）
{
  const st = S.create({ wave: wave([{ r: 'S', e: 'goblin', n: 3, t: 0, gap: 0.2 }, { r: 'C', e: 'goblin', n: 3, t: 6, gap: 0.2 }], ['mel']), placement: { mel: 'k_front' } });
  let slip = false;
  while (!st.over && st.t < 60) { S.step(st); for (const e of st.events) if (e.type === 'slip') slip = true; st.events.length = 0; }
  ok(slip, 'メル（1体まで）の本丸の前で、二つの道から来た敵がすり抜ける');
}
// 6. 大鬼はイルザしか止められない
{
  const st = S.create({ wave: wave([{ r: 'S', e: 'ogre', n: 1, t: 0, gap: 1 }], ['dugan']), placement: { dugan: 's_land' } });
  let blocked = false;
  while (!st.over && st.t < 80) { S.step(st); for (const e of st.events) if (e.type === 'block') blocked = true; st.events.length = 0; }
  ok(!blocked && st.stats.leaks.S === 1, 'ドゥーガンは大鬼を止められない');
  const st2 = S.create({ wave: wave([{ r: 'S', e: 'ogre', n: 1, t: 0, gap: 1 }], ['ilza']), placement: { ilza: 's_land' } });
  let b2 = false;
  while (!st2.over && st2.t < 30) { S.step(st2); for (const e of st2.events) if (e.type === 'block' && e.a.id === 'ilza') b2 = true; st2.events.length = 0; }
  ok(b2, 'イルザは大鬼を止める');
}
// 7. 高所の仲間は受け止めない（近寄られない）
{
  const st = S.run(S.create({ wave: wave([{ r: 'S', e: 'goblin', n: 2, t: 0, gap: 1 }], ['kai']), placement: { kai: 'w_sw' } }));
  ok(st.stats.allies.kai.held === 0, '城壁の上のカイは受け止めない');
}
// 8. 近寄られたルゥは詠唱できない
{
  const st = S.create({ wave: wave([{ r: 'S', e: 'goblin', n: 1, t: 0, gap: 1 }], ['ruu']), placement: { ruu: 's_land' } });
  let interrupted = false, castWhileEng = false;
  while (!st.over && st.t < 40) {
    S.step(st);
    const r = st.allies[0];
    if (r.eng.length && r.cast) castWhileEng = true;
    st.events.length = 0;
  }
  ok(!castWhileEng, '受け止めている間は詠唱しない');
}
// 9. 槍は狼を一突きで倒す
{
  const st = S.create({ wave: wave([{ r: 'C', e: 'wolf', n: 1, t: 0, gap: 1 }], ['dugan']), placement: { dugan: 'c_bend' } });
  S.run(st);
  ok(st.stats.combos.wolf_spear === 1 && st.stats.leaks.C === 0, '槍ぶすま');
}
// 10. 夜鴉は地上の仲間に止められない
{
  const st = S.run(S.create({ wave: wave([{ r: 'F', e: 'crow', n: 2, t: 0, gap: 1 }], ['ilza']), placement: { ilza: 'k_front' } }));
  ok(st.stats.leaks.F === 2, '夜鴉は空を通る');
  const st2 = S.run(S.create({ wave: wave([{ r: 'F', e: 'crow', n: 2, t: 0, gap: 1.5 }], ['kai']), placement: { kai: 'k_corner' } }));
  ok(st2.stats.leaks.F === 0, '張り出しのカイは夜鴉を射落とす');
}
// 11. 高い所からは遠くまで届く
{
  const k = S.allyStats('kai', {});
  ok(S.reachOf('archer', k, 6, 2, false) > S.reachOf('archer', k, 2, 2, false), '高低差で射程がのびる');
}
// 12. 作戦の読み：踊り場のイルザは石段を止め、城壁のルゥとの連携が出る
{
  const an = S.analyze(D.NIGHTS[0].waves[0], { ilza: 's_land', ruu: 'w_sw' }, {});
  ok(an.routes.S.block && an.routes.S.block.ally === 'ilza', '止める所の読み');
  ok(an.links.some((l) => l.kind === 'burn' && l.a === 'ruu' && l.b === 'ilza'), '受けて、焼くの予感');
}
// 13. 城壁の内側に9秒いる敵は松明を投げこむ。一体が消す灯は一つまで
{
  const st = S.run(S.create({ wave: wave([{ r: 'S', e: 'goblin', n: 2, t: 0, gap: 3 }], ['ilza']), placement: {} }));
  ok(st.stats.torches === 2 && st.lamps === 3, '素通りした小鬼2体は、松明か扉のどちらかで灯2つ lamps=' + st.lamps + ' torches=' + st.stats.torches);
  const st2 = S.create({ wave: wave([{ r: 'S', e: 'shield', n: 1, t: 0, gap: 1 }], ['mel']), placement: { mel: 'c_mid' } });
  S.run(st2);
  ok(st2.stats.torches === 1, '中庭の辻で受け止めていても、内側に長くいれば松明を投げる');
  const st3 = S.run(S.create({ wave: wave([{ r: 'S', e: 'shield', n: 1, t: 0, gap: 1 }], ['mel']), placement: { mel: 's_land' } }));
  ok(st3.stats.torches === 0, '踊り場（外）で受け止めている間は松明を投げない');
}
console.log(`rules_test: ${pass} ok, ${fail} ng`);
process.exit(fail ? 1 : 0);
