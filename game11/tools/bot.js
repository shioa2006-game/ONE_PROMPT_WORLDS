/*
 * ひゅるり、凧びより ― 自動プレイ（検証用）
 *
 * つかいかた: node tools/bot.js [方針] [--quiet] [--max 秒]
 *   方針  greedy … いちばん近い「まきこめる大きいもの」へ。凧に足りたら凧へ。こわせるものは ドン（ふつうの方針）
 *         nobreak … ドンを つかわない（こわすしくみ が 進行に いるか を みる）
 *         small  … いつも いちばん近いもの へ（大きさを えらばない）
 *         random … 3秒ごとに でたらめな方向（つまり や はまり を さがす）
 *
 * ボットが 知っていること：世界の ぜんぶの もの の 位置・大きさ（人より ずっと 多い）。
 * 入力は ゲームと 同じ「目標の位置（マウスの先）」と「ドン」だけ。1/60秒きざみ。
 * ここでの 時間は シミュレーション上の 時間で、人が 遊んだ時間では ない。
 */
// node では ゲームの js を 読みこむ。ブラウザ（通しプレイの検証）では ページの TJ を つかう
if (typeof window === 'undefined') {
  const path = require('path');
  const JS = path.join(__dirname, '..', 'js');
  for (const f of ['core.js', 'data.js', 'world.js', 'sim.js']) require(path.join(JS, f));
}
const TJ = globalThis.TJ;
const TY = TJ.TYPES;

function run(policy, opts) {
  opts = opts || {};
  skip.clear(); routeCache = null; cur = null; retarget = 0; commit = 0;
  const sim = new TJ.Sim();
  const dt = 1 / 60;
  const maxT = opts.max || 3600;
  const log = [];
  const kiteT = [];
  let target = null, lastS = sim.wind.S, stuckT = 0, rndT = 0, rnd = TJ.rng(5);
  let blasts = 0, breaks = 0, bumps = 0, hard = 0, pops = 0;
  const ev = {};
  let steps = 0;
  while (!sim.ending && sim.time < maxT) {
    const w = sim.wind, S = w.S;
    target = next(sim, policy, dt);
    let blast = false;
    if (policy !== 'nobreak' && sim.blastCd <= 0 && sim.orbitReady() > 0) blast = wantBlast(sim, policy);
    if (policy === 'random') {
      rndT -= dt;
      if (rndT <= 0) { rndT = 3; const a = rnd() * 6.28; target = { x: w.x + Math.cos(a) * S * 8, y: w.y + Math.sin(a) * S * 8 }; }
      blast = rnd() < 0.02;
    }
    const inp = target ? { tx: target.x, ty: target.y, pxPerCm: 76 / sim.Sref, blast } : { blast };
    sim.step(dt, inp);
    steps++;
    for (const e of sim.events) {
      ev[e.type] = (ev[e.type] || 0) + 1;
      if (e.type === 'kite') { kiteT.push({ i: e.i, t: +sim.time.toFixed(1), S: +S.toFixed(1), count: sim.count }); if (!opts.quiet) console.log('kite', e.i, 't=' + sim.time.toFixed(1), 'S=' + S.toFixed(1)); }
      if (e.type === 'bossEnter' && !opts.quiet) console.log('boss enter t=' + sim.time.toFixed(1), 'S=' + S.toFixed(0));
      if (e.type === 'bossDown' && !opts.quiet) console.log('boss down t=' + sim.time.toFixed(1), 'S=' + S.toFixed(0));
    }
    // つまり 検出
    if (steps % 600 === 0) {
      if (sim.wind.S <= lastS * 1.002) stuckT += 10; else stuckT = 0;
      lastS = sim.wind.S;
      if (!opts.quiet && steps % 3600 === 0) console.log('t=' + sim.time.toFixed(0), 'S=' + sim.wind.S.toFixed(1), 'zone' + sim.zoneAt(w.x, w.y), 'kite' + sim.kiteIdx, 'orbit' + sim.orbit.length, 'boss:' + sim.boss.st + '/' + sim.boss.hp);
      if (stuckT >= 120) { if (!opts.quiet) console.log('STUCK at t=' + sim.time.toFixed(0)); break; }
    }
  }
  return { policy, time: +sim.time.toFixed(1), ending: sim.ending, S: +sim.wind.S.toFixed(1), kiteT, count: sim.count, found: sim.found.size, tre: Array.from(sim.tre), ev };
}

// まっすぐ 行けるか（つむじの 太さ を こみで、とちゅうに かたいものが ないか）
function clear(sim, solids, x, y, fromX, fromY) {
  const w = sim.wind;
  const x0 = fromX === undefined ? w.x : fromX, y0 = fromY === undefined ? w.y : fromY;
  const rc = w.S * 0.32;
  const n = Math.min(120, Math.max(6, Math.ceil(Math.hypot(x - x0, y - y0) / Math.max(25, rc * 0.7))));
  for (let i = 1; i <= n; i++) {
    const px = x0 + (x - x0) * i / n, py = y0 + (y - y0) * i / n;
    for (const s of solids) {
      if (s.shape === 'rect') { if (px > s.x0 - rc && px < s.x1 + rc && py > s.y0 - rc && py < s.y1 + rc) return false; }
      else if (Math.hypot(px - s.x, py - s.y) < s.r + rc) return false;
    }
    if (!sim.inPlay(px, py, rc * 0.9)) return false;
  }
  return true;
}

// まっすぐ 行けないときは、つむじの まわりを 粗い格子で しらべて（幅優先）道を さがす
let routeCache = null;
function route(sim, solids, tx, ty) {
  if (clear(sim, solids, tx, ty)) { routeCache = null; return { x: tx, y: ty }; }
  const w = sim.wind, S = w.S;
  if (routeCache && routeCache.tx === tx && routeCache.ty === ty && sim.time < routeCache.until) {
    const p = routeCache.pts;
    while (p.length > 1 && Math.hypot(p[0].x - w.x, p[0].y - w.y) < S * 0.4) p.shift();
    if (p.length) { const r = Object.assign({}, pickFar(sim, solids, p)); if (routeCache.fail) r.fail = true; return r; }
  }
  const cell = Math.max(S * 0.6, 35), N = 80, size = N * 2 + 1;
  const ox = w.x - N * cell, oy = w.y - N * cell, rc = S * 0.32;
  const blocked = new Int8Array(size * size).fill(-1);
  const isBlocked = (i, j) => {
    const k = j * size + i;
    if (blocked[k] >= 0) return blocked[k];
    const x = ox + i * cell, y = oy + j * cell;
    let b = sim.inPlay(x, y, rc) ? 0 : 1;
    if (!b) for (const s of solids) {
      if (s.shape === 'rect') { if (x > s.x0 - rc && x < s.x1 + rc && y > s.y0 - rc && y < s.y1 + rc) { b = 1; break; } }
      else if (Math.hypot(x - s.x, y - s.y) < s.r + rc) { b = 1; break; }
    }
    blocked[k] = b; return b;
  };
  let ti = Math.round((tx - ox) / cell), tj = Math.round((ty - oy) / cell);
  ti = Math.max(0, Math.min(size - 1, ti)); tj = Math.max(0, Math.min(size - 1, tj));
  const prev = new Int32Array(size * size).fill(-1);
  const q = new Int32Array(size * size);
  let qh = 0, qt = 0;
  const start = N * size + N;
  q[qt++] = start; prev[start] = start;
  let goal = -1, bestK = start, bestD = Infinity;
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (qh < qt) {
    const k = q[qh++];
    const i = k % size, j = (k / size) | 0;
    const dd = Math.hypot(i - ti, j - tj);
    if (dd < bestD) { bestD = dd; bestK = k; }
    if (i === ti && j === tj) { goal = k; break; }
    for (const [di, dj] of D8) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= size || nj >= size) continue;
      const nk = nj * size + ni;
      if (prev[nk] >= 0 || isBlocked(ni, nj)) continue;
      prev[nk] = k; q[qt++] = nk;
    }
  }
  let k = goal >= 0 ? goal : bestK;
  // とどかない：さがせた いちばん 近い 点から 目標が すいこみ範囲より 遠い
  const bx = ox + (bestK % size) * cell, by = oy + ((bestK / size) | 0) * cell;
  const fail = goal < 0 && Math.hypot(bx - tx, by - ty) > S * 0.6;
  const pts = [];
  while (k !== start && pts.length < 600) { pts.push({ x: ox + (k % size) * cell, y: oy + ((k / size) | 0) * cell }); k = prev[k]; }
  pts.reverse();
  routeCache = { tx, ty, pts, until: sim.time + 1.5, fail };
  const r = Object.assign({}, pickFar(sim, solids, pts) || { x: tx, y: ty });
  if (fail) r.fail = true;
  return r;
}
// 経路の点のうち、まっすぐ行ける いちばん遠い点
function pickFar(sim, solids, pts) {
  for (let i = Math.min(pts.length - 1, 40); i >= 0; i--) if (clear(sim, solids, pts[i].x, pts[i].y)) { pts.splice(0, i); return pts[0]; }
  return pts[0];
}

const skip = new Map();
// 目標を えらぶ（えらんだ ものは しばらく まもる。ころころ かえて まよわないように）
let cur = null, retarget = 0, commit = 0;
function next(sim, policy, dt) {
  retarget -= dt; commit -= dt;
  const gone = !cur || (cur.o && cur.o.st !== 0);
  if (gone || (retarget <= 0 && commit <= 0) || (retarget <= 0 && !cur.o)) {
    retarget = 0.25;
    const t = choose(sim, policy);
    if (!cur || !t || !cur.o || !t.o || cur.o !== t.o) commit = 1.5;
    cur = t;
  } else if (retarget <= 0 && cur && cur.o) {
    // 同じ ものへの 道すじだけ 更新
    retarget = 0.25;
    const solids = allSolids(sim);
    if (!clear(sim, solids, cur.o.x, cur.o.y)) { const r = route(sim, solids, cur.o.x, cur.o.y); cur = Object.assign(r, { o: cur.o }); if (r.fail) { skip.set(cur.o.id, sim.time + 12); cur = null; } }
    else cur = { x: cur.o.x, y: cur.o.y, o: cur.o };
  }
  return cur;
}
function choose(sim, policy, rnd) {
  for (let tries = 0; tries < 6; tries++) {
    const r = choose1(sim, policy, rnd);
    if (!r || !r.fail || !r.o) return r;
    skip.set(r.o.id, sim.time + 12);
  }
  return null;
}
// ボットは 遠くの かべも 見る（ゲームの 当たり判定は 近くだけ しらべる）
function allSolids(sim) {
  const S = sim.wind.S, out = [];
  for (const s of sim.W.solids) if (s.pass > S) out.push(s);
  for (const o of sim.solidObjs) if (o.st === 0 && o.s > S) out.push(Object.assign({ shape: 'rect' }, o.solid));
  return out;
}
function choose1(sim, policy, rnd) {
  const w = sim.wind, S = w.S;
  const solids = allSolids(sim);
  const k = sim.W.kites[sim.kiteIdx];
  if (k && S >= k.req && !(sim.kiteIdx === 4 && sim.boss.st !== 'gone')) return route(sim, solids, k.x, k.y);
  const B = sim.boss;
  if (B.st === 'fight') {
    // こおったものを ひろいなおしてから、かげの ふちで ドン
    if (sim.orbitReady() < 6 && sim.dropped.length) {
      let best = null, bd = Infinity;
      for (const d of sim.dropped) { const dd = Math.hypot(d.x - w.x, d.y - w.y); if (dd < bd && Math.hypot(d.x - B.x, d.y - B.y) > B.r) { bd = dd; best = d; } }
      if (best) return { x: best.x, y: best.y };
    }
    if (sim.orbitReady() >= 3) return { x: B.x, y: B.y };
  }
  let best = null, bs = -Infinity;
  for (const o of sim.W.objs) {
    if (o.st !== 0 || o.pop) continue;
    if (skip.has(o.id) && skip.get(o.id) > sim.time) continue;
    const ty = TY[o.t];
    const d = Math.hypot(o.x - w.x, o.y - w.y);
    let score;
    if (o.s <= S) {
      if (policy === 'small') score = -d;
      else score = (o.s * o.s * ty.w) / Math.pow(d + S * 2, 1.6);
    } else if (ty.k === 'break' && S >= ty.min && policy !== 'nobreak' && policy !== 'small') {
      score = (o.s * o.s * 0.6) / Math.pow(d + S * 2, 1.6);
    } else continue;
    if (score > bs) {
      const gx = o.solid ? (o.solid.x0 + o.solid.x1) / 2 + (w.x < o.x ? -1 : 1) * S * 0.6 : o.x;
      const ok = o.solid ? true : clear(sim, solids, o.x, o.y);
      if (!ok) { if (d < S * 6) { bs = score * 0.5; best = { x: o.x, y: o.y, o, far: 1 }; } continue; }
      bs = score; best = o.solid ? { x: gx, y: o.y, o } : o;
    }
  }
  if (policy === 'small') { if (!best && k) return route(sim, solids, k.x, k.y); if (!best) return null; if (best.far) return Object.assign(route(sim, solids, best.x, best.y), { o: best.o }); return { x: best.x, y: best.y, o: best }; }
  for (const tr of sim.W.trees) {
    if (!tr.fruit || (tr.dropped >= tr.fruitN && (!tr.tre || tr.treDone)) || policy === 'nobreak') continue;
    const d = Math.hypot(tr.x - w.x, tr.y - w.y);
    if (TY[tr.fruit].s > S) continue;
    const sc = (TY[tr.fruit].s ** 2 * 3) / Math.pow(d + S * 2, 1.6);
    const tx = tr.x + tr.r + S * 0.5, ty2 = tr.y + tr.r + S * 0.5;
    if (sc > bs && clear(sim, solids, tx, ty2)) { bs = sc; best = { x: tx, y: ty2, tree: tr }; }
  }
  for (const c of sim.W.creatures) {
    if ((c.kind === 'crow' || c.kind === 'tobi') && c.item && c.x !== undefined && c.st === 'circle' && policy !== 'nobreak' && TY[c.item].s <= S * 3) {
      // からすの まわる わの 上で まちぶせ
      const a = Math.atan2((w.y - c.cy) / 0.75, w.x - c.cx);
      const px = c.cx + Math.cos(a) * c.rad, py = c.cy + Math.sin(a) * c.rad * 0.75;
      const d = Math.hypot(px - w.x, py - w.y);
      const sc = (TY[c.item].s ** 2 * 6 + S * S * 0.05) / Math.pow(d + S * 2, 1.6);
      if (sc > bs && clear(sim, solids, px, py)) { bs = sc; best = { x: px, y: py }; }
    }
  }
  if (!best && k) return route(sim, solids, k.x, k.y);
  if (!best) return null;
  if (best.id !== undefined) return { x: best.x, y: best.y, o: best };
  if (best.far) return Object.assign(route(sim, solids, best.x, best.y), { o: best.o });
  return best;
}

function wantBlast(sim, policy) {
  const w = sim.wind, S = w.S, R = S * TJ.SIM_CONST.BLAST_R;
  if (policy === 'small') {
    // かんたんな方針：ゆきぐも と、行く手を ふさぐ 門だけ ドン
    const B = sim.boss;
    if (B.st === 'fight' && Math.hypot(B.x - w.x, B.y - w.y) < R + B.r * 0.5) return true;
    for (const o of sim.solidObjs) if (o.st === 0 && o.s > S && S >= TY[o.t].min && Math.hypot(o.x - w.x, o.y - w.y) < R + o.s * 0.3) return true;
    return false;
  }
  for (const o of sim.W.objs) {
    if (o.st !== 0 || o.pop || TY[o.t].k !== 'break' || o.s <= S) continue;
    if (S < TY[o.t].min) continue;
    if (Math.hypot(o.x - w.x, o.y - w.y) < R + o.s * 0.3) return true;
  }
  if (policy === 'small') { if (!best && k) return route(sim, solids, k.x, k.y); if (!best) return null; if (best.far) return Object.assign(route(sim, solids, best.x, best.y), { o: best.o }); return { x: best.x, y: best.y, o: best }; }
  for (const tr of sim.W.trees) {
    if (!tr.fruit || (tr.dropped >= tr.fruitN && (!tr.tre || tr.treDone))) continue;
    if (Math.hypot(tr.x - w.x, tr.y - w.y) < R + tr.crown * 0.5) return true;
  }
  for (const c of sim.W.creatures) {
    if ((c.kind === 'crow' || c.kind === 'tobi') && c.item && c.x !== undefined && c.st === 'circle' && Math.hypot(c.x - w.x, c.y - w.y) < R + c.s + c.h * 0.25) return true;
  }
  const B = sim.boss;
  if (B.st === 'fight' && Math.hypot(B.x - w.x, B.y - w.y) < R + B.r * 0.5) return true;
  return false;
}

globalThis.TJBot = { choose, next, wantBlast, reset: () => { skip.clear(); routeCache = null; cur = null; } };
if (typeof module !== 'undefined' && typeof require !== 'undefined' && require.main === module) {
  const args = process.argv.slice(2);
  const policy = args.find(a => !a.startsWith('--')) || 'greedy';
  const quiet = args.includes('--quiet');
  const mi = args.indexOf('--max');
  const res = run(policy, { quiet, max: mi >= 0 ? +args[mi + 1] : 3600 });
  console.log(JSON.stringify(res));
}
if (typeof module !== 'undefined') module.exports = { run };
