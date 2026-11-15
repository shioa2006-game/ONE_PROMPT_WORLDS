// 自動プレイ：ゲーム本体と同じ sim.js を、方針のちがうボットで動かして比べる
//   node tools/bot.js [部屋id|all] [乱数種の数]
// ボットが知っていること：岩・玉・カエルの位置すべて（人より多い）。入力は人と同じ { tx, btn, ax, ay } だけ。
//   smart  … 落ちてくる玉の着地点を読み、はね返る向きの「ねらい線」がいちばん得になる位置へ動く（くわえない）
//   catch  … 毎回 舌でくわえ、いちばん得になる向きを えらんで はきだす（ゆっくり・正確）
//   center … 玉の真下で はね返すだけ（ねらわない）
//   sloppy … smart に「判断の遅れ 0.25秒」と「位置のぶれ ±22px」を足したもの
const S = require('../js/sim.js');
const D = require('../js/levels.js');

function scoreTrace(w, tr, wantExit) {
  if (!tr) return -1;
  if (tr.exit) return wantExit ? 10000 : -50;
  if (tr.i === undefined) return 0;
  const t = tr.type;
  let s = 1 + (S.MAT[t].val || 0) * 0.5;
  if (t === S.T.LID) s += 60;
  if (t === S.T.ANCHOR) s += 40;
  if (t === S.T.TREAS) s += 25;
  if (t === S.T.BLAST) s += 30;
  if (tr.falling) s += tr.falling.length * 6 + (tr.falling.some((i) => w.item[i] >= 0) ? 40 : 0) + (tr.falling.some((i) => w.g[i] === S.T.BODY) ? 200 : 0);
  // 高いところほど少しだけ よい（上へ ほりすすむ）
  if (tr.pts && tr.pts.length) s += Math.max(0, 600 - tr.pts[tr.pts.length - 1][1]) * 0.02;
  return s;
}

function evalDir(w, ox, oy, dx, dy, wantExit) {
  const tr = w.trace(ox, oy, dx, dy, 1500, false);
  const out = { exit: !!tr.exit, i: tr.i, type: tr.type, pts: tr.pts };
  if (tr.i !== undefined) {
    const dmg = w.dmg(w.balls[0]);
    const br = tr.type === S.T.LID ? w.lidHp <= dmg : w.hp[tr.i] <= dmg;
    out.falling = br && tr.type !== S.T.LID ? w.fallingIf(tr.i) : [];
  }
  return scoreTrace(w, out, wantExit);
}

// human … 人に近づけた ゆるい方針：0.22秒ごとにしか 判断しない、位置は ±28px ぶれる、
//          ねらい線を見て 位置を えらぶのは 4回に1回（あとは 玉の真下へ行くだけ）、
//          3回に1回は ボタンを おして くわえ、0.9秒 ねらってから ±5° の ぶれで はく。あぶないものは よけない。
function makeHuman(rng) {
  let tx = null, nextT = 0, mode = 'bounce', aimT = 0, aimA = -Math.PI / 2, decided = false;
  return function (w) {
    const b = w.balls[0], f = w.frog;
    const itemsLeft = (w.level.items || []).filter((id) => w.found.indexOf(id) < 0).length;
    if (w.lidOpen && w.lidT === undefined) w.lidT = w.t;
    const wantExit = w.lidOpen && (itemsLeft === 0 || w.t - w.lidT > 20);
    const inp = { tx: tx === null ? f.x : tx, btn: false };
    if (b.state === 'held' || b.state === 'tongue') {
      if (!decided) {
        const m = w.mouth();
        let best = -Infinity, ba = -Math.PI / 2;
        for (let deg = -165; deg <= -15; deg += 2.5) {
          const a = deg * Math.PI / 180;
          const s = evalDir(w, m.x, m.y, Math.cos(a), Math.sin(a), wantExit);
          if (s > best) { best = s; ba = a; }
        }
        aimA = ba + (rng() - 0.5) * 0.17; aimT = 0; decided = true;
      }
      aimT += S.DT;
      const m = w.mouth();
      inp.ax = m.x + Math.cos(aimA) * 200; inp.ay = m.y + Math.sin(aimA) * 200;
      inp.btn = mode === 'catch' && aimT < 0.9;
      inp.spit = mode !== 'catch' && aimT > 0.9 && b.state === 'held';
      return inp;
    }
    decided = false;
    if (b.state !== 'free') return inp;
    if (w.t >= nextT) {
      nextT = w.t + 0.22;
      if (b.vy <= 0) { tx = b.x + (rng() - 0.5) * 56; mode = rng() < 0.33 ? 'catch' : 'bounce'; }
      else {
        const sp = Math.hypot(b.vx, b.vy);
        const tr = w.trace(b.x, b.y, b.vx / sp, b.vy / sp, 1600, true);
        const land = tr.land !== undefined ? tr.land : b.x;
        let u = 0;
        if (mode === 'bounce' && rng() < 0.25) {
          let best = -Infinity;
          for (let q = -0.9; q <= 0.91; q += 0.1) {
            const a = q * 62 * Math.PI / 180;
            const s = evalDir(w, land, S.PAD_Y - S.BALL_R, Math.sin(a), -Math.cos(a), wantExit);
            if (s > best) { best = s; u = q; }
          }
        }
        tx = land - u * S.FROG_HALF + (rng() - 0.5) * 56;
      }
    }
    inp.tx = tx;
    inp.btn = mode === 'catch' && b.vy > 0;
    return inp;
  };
}

function makeBot(kind, rng) {
  if (kind === 'human') return makeHuman(rng);
  let pendingTx = null, delayT = 0, wantSpit = false, holdAim = null;
  return function (w) {
    const b = w.balls[0], f = w.frog;
    const itemsLeft = (w.level.items || []).filter((id) => w.found.indexOf(id) < 0).length;
    const wantExit = w.lidOpen && (itemsLeft === 0 || w.t - (w.lidT || w.t) > 15);
    if (w.lidOpen && w.lidT === undefined) w.lidT = w.t;
    const inp = { tx: f.x, btn: false };
    if (b.state === 'held' || b.state === 'tongue') {
      // いちばん よい向きを えらぶ
      const m = w.mouth();
      let best = -Infinity, ba = -Math.PI / 2;
      if (kind === 'center') { ba = -Math.PI / 2 + (rng() - 0.5) * 1.2; }
      else {
        for (let deg = -165; deg <= -15; deg += 2.5) {
          const a = deg * Math.PI / 180;
          const s = evalDir(w, m.x, m.y, Math.cos(a), Math.sin(a), wantExit);
          if (s > best) { best = s; ba = a; }
        }
      }
      inp.ax = m.x + Math.cos(ba) * 200; inp.ay = m.y + Math.sin(ba) * 200;
      inp.spit = b.state === 'held' && b.holdT > 0.1;
      inp.btn = kind === 'catch' && b.state === 'tongue';
      return inp;
    }
    if (b.state !== 'free') return inp;
    if (b.vy <= 0) { inp.tx = kind === 'center' ? b.x : f.x; return inp; }   // のぼっているあいだは その場で待つ
    const sp = Math.hypot(b.vx, b.vy);
    const tr = w.trace(b.x, b.y, b.vx / sp, b.vy / sp, 1600, true);
    if (tr.land === undefined) { inp.tx = b.x; if (kind === 'catch') inp.btn = true; return inp; }
    if (kind === 'catch') { inp.tx = tr.land; inp.btn = true; return inp; }
    if (kind === 'center') { inp.tx = tr.land + (rng() - 0.5) * 30; return inp; }
    let best = -Infinity, bu = 0;
    for (let u = -0.95; u <= 0.951; u += 0.05) {
      const a = u * 62 * Math.PI / 180;
      const s = evalDir(w, tr.land, S.PAD_Y - S.BALL_R, Math.sin(a), -Math.cos(a), wantExit) - Math.abs(u) * 0.5;
      if (s > best) { best = s; bu = u; }
    }
    let tx = tr.land - bu * S.FROG_HALF;
    if (kind === 'sloppy') {
      delayT -= S.DT;
      if (delayT <= 0 || pendingTx === null) { pendingTx = tx + (rng() - 0.5) * 44; delayT = 0.25; }
      tx = pendingTx;
    }
    inp.tx = tx;
    return inp;
  };
}

function run(ch, kind, seed, limit) {
  const w = new S.World(ch, { seed });
  const rng = S.mulberry32(seed * 7 + 3);
  const bot = makeBot(kind, rng);
  const steps = Math.round(limit / S.DT);
  let lidAt = null;
  for (let k = 0; k < steps; k++) {
    w.step(bot(w));
    w.events.length = 0;
    if (w.lidOpen && lidAt === null) lidAt = w.t;
    if (w.done) break;
  }
  return { done: w.done, t: w.t, lidAt, found: w.found.length, items: (ch.items || []).length + (ch.bossItem !== undefined ? 1 : 0), gems: w.gems, st: w.stats };
}

if (require.main === module) {
  const which = process.argv[2] || 'all';
  const seeds = +(process.argv[3] || 3);
  const kinds = (process.argv[4] || 'smart,catch,sloppy,center').split(',');
  const list = which === 'all' ? D.CHAMBERS : D.CHAMBERS.filter((c) => c.id === which);
  for (const ch of list) {
    const row = [];
    for (const kind of kinds) {
      const rs = [];
      for (let s = 1; s <= seeds; s++) rs.push(run(ch, kind, s, 300));
      const done = rs.filter((r) => r.done);
      const ts = done.map((r) => r.t.toFixed(0)).join('/');
      const fnd = rs.map((r) => r.found + '/' + r.items).join(' ');
      const st = rs[0].st;
      row.push(`${kind}: ${done.length}/${rs.length} [${ts}s] items ${fnd} miss=${st.misses} pads=${st.pads} maxC=${st.maxCollapse} stun=${st.stuns}`);
    }
    console.log(ch.id, ch.name);
    for (const r of row) console.log('   ', r);
  }
}

module.exports = { run, makeBot };
