/*
 * 検証用の自動プレイ（node tools/bot.js [policy] [level]）
 *   policy: smart（近くは歩き、遠まわりは走る） / dash（つねに走る） / walk（つねに歩く）
 * ゲーム本体と同じ sim.js を 60Hz で回し、全ステージの完了可否と時間を出す。
 */
'use strict';
const path = require('path');
const Sim = require(path.join(__dirname, '..', 'js', 'sim.js'));
const LEVELS = require(path.join(__dirname, '..', 'js', 'levels.js'));
const C = Sim.C, CELL = 16, GW = Math.ceil(C.W / CELL), GH = Math.ceil(C.H / CELL);

function segDist(px, py, w) {
  const dx = w[2] - w[0], dy = w[3] - w[1], l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - w[0]) * dx + (py - w[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (w[0] + dx * t), py - (w[1] + dy * t));
}
function makeGrids(s) {
  const blockA = new Uint8Array(GW * GH), blockD = new Uint8Array(GW * GH), water = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const x = gx * CELL + CELL / 2, y = gy * CELL + CELL / 2, i = gy * GW + gx;
    let out = x < C.BX0 + 8 || x > C.BX1 - 8 || y < C.BY0 + 8 || y > C.BY1 - 8, near = false;
    let near2 = false;
    for (const w of s.walls) { const sd = segDist(x, y, w); if (sd < 15) near = true; if (sd < 17) near2 = true; }
    if (out || near) blockA[i] = 1;
    if (out || near2) blockD[i] = 1;
    if (Sim.inPond(s, x, y, 12)) blockA[i] = 1;
    if (Sim.inPond(s, x, y, 0)) water[i] = 1;
  }
  return { blockA, blockD, water };
}
const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
function dijkstra(block, sources, costFn) {
  const dist = new Float32Array(GW * GH).fill(1e9);
  const open = [];
  for (const i of sources) { dist[i] = 0; open.push(i); }
  // 小さい格子なので素朴な SPFA で足りる
  let head = 0;
  while (head < open.length) {
    const i = open[head++], gx = i % GW, gy = (i / GW) | 0;
    for (const [dx, dy, c] of N8) {
      const nx = gx + dx, ny = gy + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const j = ny * GW + nx;
      if (block[j]) continue;
      if (dx && dy && (block[gy * GW + nx] || block[ny * GW + gx])) continue;
      const nd = dist[i] + c * (costFn ? costFn(j) : 1);
      if (nd < dist[j] - 1e-4) { dist[j] = nd; open.push(j); }
    }
    if (open.length > 400000) break;
  }
  return dist;
}
const cellOf = (x, y) => Math.max(0, Math.min(GH - 1, (y / CELL) | 0)) * GW + Math.max(0, Math.min(GW - 1, (x / CELL) | 0));
let WALLS = [];
function crosses(x1, y1, x2, y2) {
  for (const w of WALLS) {
    const d = (x2 - x1) * (w[3] - w[1]) - (y2 - y1) * (w[2] - w[0]); if (Math.abs(d) < 1e-9) continue;
    const t = ((w[0] - x1) * (w[3] - w[1]) - (w[1] - y1) * (w[2] - w[0])) / d, u = ((w[0] - x1) * (y2 - y1) - (w[1] - y1) * (x2 - x1)) / d;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) return true;
  }
  return false;
}
function nearestFree(block, x, y) {
  let best = -1, bd = 1e9;
  const gx0 = (x / CELL) | 0, gy0 = (y / CELL) | 0;
  for (let r = 0; r < 12 && best < 0; r++)
    for (let gy = gy0 - r; gy <= gy0 + r; gy++) for (let gx = gx0 - r; gx <= gx0 + r; gx++) {
      if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
      const i = gy * GW + gx; if (block[i]) continue;
      if (crosses(x, y, gx * CELL + 8, gy * CELL + 8)) continue;
      const d = Math.hypot(gx * CELL + 8 - x, gy * CELL + 8 - y);
      if (d < bd) { bd = d; best = i; }
    }
  return best;
}
function descend(field, block, x, y, steps) {
  let i = nearestFree(block, x, y);
  for (let k = 0; k < steps; k++) {
    const gx = i % GW, gy = (i / GW) | 0; let b = i, bd = field[i];
    for (const [dx, dy] of N8) {
      const nx = gx + dx, ny = gy + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const j = ny * GW + nx; if (field[j] < bd) { bd = field[j]; b = j; }
    }
    if (b === i) break; i = b;
  }
  return { x: (i % GW) * CELL + 8, y: ((i / GW) | 0) * CELL + 8 };
}

function run(level, policy, seed, opts) {
  opts = opts || {};
  const s = Sim.create(level, seed);
  WALLS = s.walls;
  const G = makeGrids(s);
  const fields = {};
  for (const kind of ['sheep', 'goat']) {
    const src = [];
    s.pens.forEach(p => {
      if (p.accept !== 'any' && p.accept !== kind) return;
      for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
        const x = gx * CELL + 8, y = gy * CELL + 8;
        if (x > p.x + 20 && x < p.x + p.w - 20 && y > p.y + 20 && y < p.y + p.h - 20) src.push(gy * GW + gx);
      }
    });
    const blk = G.blockA.slice();
    for (const g of s.closed[kind]) for (let j = 0; j < GW * GH; j++) { if (segDist((j % GW) * CELL + 8, ((j / GW) | 0) * CELL + 8, g) < 15) blk[j] = 1; }
    fields[kind] = dijkstra(blk, src);
  }
  const order = opts.order || level.botOrder || ['sheep', 'goat'];
  const dt = 1 / 60, inp = { tx: s.dog.x, ty: s.dog.y, dash: false };
  let backUntil = -9, stubHold = false;
  let dogField = null, lastPlan = -1, target = null, P = null, panics = 0, nzx = 0, nzy = 0;
  const sloppy = policy === 'sloppy', nrnd = Sim.mulberry((seed || 1) * 7 + 3), rec = opts.record ? [] : null;
  if (sloppy) policy = 'smart';
  const maxT = opts.maxT || 300;
  while (!s.done && s.t < maxT) {
    const un = s.animals.filter(a => !a.settled);
    if ((s.t - lastPlan) > (sloppy ? 0.5 : 0.25)) {
      if (sloppy) { nzx = (nrnd() - 0.5) * 70; nzy = (nrnd() - 0.5) * 70; }
      lastPlan = s.t;
      let kind = order.find(k => un.some(a => a.kind === k));
      const cand = un.filter(a => a.kind === kind);
      let best = null, bf = -1;
      for (const a of cand) { const f = fields[kind][nearestFree(G.blockA, a.x, a.y)]; if (f > bf) { bf = f; best = a; } }
      if (kind === 'goat' && target && !target.settled && target.kind === 'goat') best = target;   // やぎは一匹ずつ
      target = best;
      if (target) {
        const ahead = descend(fields[kind], G.blockA, target.x, target.y, 5);
        let gx = ahead.x - target.x, gy = ahead.y - target.y; const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
        const stub = target.kind === 'goat' || target.graze;
        const off = stub ? 100 : 50;
        // 真うしろに立てないとき（壁ぎわ）は、立てる角度までずらす
        let px = 0, py = 0, pc = -1;
        search:
        for (const ang of [0, 0.5, -0.5, 1.0, -1.0]) {
          for (const o2 of (stub ? [off, 70, 40] : [off, 34])) {
            const ca = Math.cos(ang), sa = Math.sin(ang), bx = gx * ca - gy * sa, by = gx * sa + gy * ca;
            px = target.x - bx * o2; py = target.y - by * o2;
            const inside = px > C.BX0 + 11 && px < C.BX1 - 11 && py > C.BY0 + 11 && py < C.BY1 - 11;
            if (inside && !G.blockD[cellOf(px, py)] && !crosses(target.x, target.y, px, py)) { pc = cellOf(px, py); gx = bx; gy = by; break search; }
          }
        }
        // うしろに回れないほど壁ぎわなら、いったん離れて 動物が内がわへ出てくるのを待つ
        if (pc < 0 && s.t > backUntil + 1.5) backUntil = s.t + 1.6;
        if (s.t < backUntil) {
          const mx = (C.BX0 + C.BX1) / 2 - target.x, my = (C.BY0 + C.BY1) / 2 - target.y, ml = Math.hypot(mx, my) || 1;
          px = target.x + mx / ml * 190; py = target.y + my / ml * 190; pc = nearestFree(G.blockD, px, py); stubHold = true;
        } else stubHold = false;
        if (pc < 0) { px = target.x - gx * off; py = target.y - gy * off; pc = nearestFree(G.blockD, px, py); }
        P = { x: (pc % GW) * CELL + 8, y: ((pc / GW) | 0) * CELL + 8, gx, gy, stub };
        P.moved = Math.hypot(P.x - px, P.y - py) > 24;
        const cost = new Float32Array(GW * GH);
        for (let j = 0; j < GW * GH; j++) {
          if (G.blockD[j]) continue;
          const x = (j % GW) * CELL + 8, y = ((j / GW) | 0) * CELL + 8; let c = G.water[j] ? 2.4 : 1;
          if (Math.hypot(x - P.x, y - P.y) > 30) for (const a of un) { const d = Math.hypot(a.x - x, a.y - y); if (d < 85) c += (85 - d) / 12; }
          cost[j] = c;
        }
        dogField = dijkstra(G.blockD, [pc], j => cost[j]);
      }
    }
    if (target && P) {
      const d = s.dog, toP = Math.hypot(P.x - d.x, P.y - d.y);
      const wp = descend(dogField, G.blockD, d.x, d.y, 3);
      let near = 1e9; for (const a of un) if (a.kind === 'sheep' && !a.graze) near = Math.min(near, Math.hypot(a.x - d.x, a.y - d.y));
      let dash = false; inp.tx = toP < 40 ? P.x : wp.x; inp.ty = toP < 40 ? P.y : wp.y;
      if (stubHold) { inp.dash = false; }
      else if (P.stub) {
        const ax = target.x - d.x, ay = target.y - d.y, al = Math.hypot(ax, ay) || 1;
        const dot = (ax * P.gx + ay * P.gy) / al;
        if ((dot > 0.96 && al < 200) || (P.moved && toP < 45 && al < 240)) { inp.tx = target.x - P.gx * 8; inp.ty = target.y - P.gy * 8; dash = policy !== 'walk'; }
        else dash = policy === 'dash' || (policy === 'smart' && near > 230 && toP > 60);
      } else {
        dash = policy === 'dash' || (policy === 'smart' && near > 235 && toP > 90);
      }
      inp.dash = dash;
    }
    if (sloppy) { inp.tx += nzx; inp.ty += nzy; }
    const rx = Math.round(inp.tx), ry = Math.round(inp.ty);   // 記録と同じ値（整数）で動かす
    if (rec) rec.push([rx, ry, inp.dash ? 1 : 0]);
    Sim.step(s, { tx: Math.max(C.BX0, Math.min(C.BX1, rx)), ty: Math.max(C.BY0, Math.min(C.BY1, ry)), dash: !!inp.dash }, dt);
    for (const e of s.events) if (e.type === 'panic') panics++;
    s.events.length = 0;
  }
  return { done: s.done, time: s.clock, panics, dashUse: s.dashUse, settled: s.settled, total: s.total, rec };
}

if (require.main === module) {
  const policies = process.argv[2] && process.argv[2] !== 'all' ? [process.argv[2]] : ['smart', 'sloppy', 'dash', 'walk'];
  const only = process.argv[3] != null ? [+process.argv[3]] : LEVELS.map((_, i) => i);
  for (const li of only) {
    const lv = LEVELS[li];
    for (const pol of policies) {
      const rs = [1, 2, 3, 4, 5].map(seed => run(lv, pol, seed * 101));
      const ok = rs.filter(r => r.done), times = ok.map(r => r.time).sort((a, b) => a - b);
      console.log(`${li + 1} ${lv.name.padEnd(10, '　')} ${pol.padEnd(5)} 完了 ${ok.length}/5  時間 ${times.map(t => t.toFixed(0)).join(',') || '-'}  おどろき ${(rs.reduce((a, r) => a + r.panics, 0) / 5).toFixed(0)}  未完時の収容 ${rs.filter(r => !r.done).map(r => r.settled + '/' + r.total).join(' ')}`);
    }
  }
}
module.exports = { run, makeGrids };
