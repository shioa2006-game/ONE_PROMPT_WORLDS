/*
 * ころころ、ひらけ列島 ― 地図の 描画（カメラ・季節・線路・マス・駅・雲・コマ・演出）
 */
(function (root) {
  'use strict';
  const KR = root.KR;
  const M = KR.MAP, A = KR.ART;
  const TAU = Math.PI * 2;
  const R = KR.R = {
    c: null, W: 1280, H: 720, sc: 1, dpr: 1,
    cam: { x: 1700, y: 2000, z: 0.9, tx: 1700, ty: 2000, tz: 0.9 },
    season: 0, prevSeason: 0, seasonT: 1,
    fx: [], texts: [], rings: [],
    tok: [], cands: null, candHover: -1, previewPath: null,
    cloudOpen: KR.REGIONS.map((r) => (r.open ? 1 : 0)), // 0=雲 1=晴れ
    openAnim: KR.REGIONS.map(() => 0),
    time: 0, shake: 0,
    gatePulse: -1,
  };

  // ------------------------------------------------------------ 季節の 色
  const SEA = ['#a3d3df', '#74bfd8', '#8cb3c6', '#a3bccf'];
  const LAND = [
    ['#e3edc0', '#d4e8a8', '#cfe6a0'], // 春：北→南
    ['#a9d488', '#9dcd7c', '#94c873'], // 夏
    ['#e7c58c', '#dccb8c', '#cdd18e'], // 秋
    ['#f7f9fb', '#e7ecdf', '#cbdcae'], // 冬
  ];
  const mix = (a, b, t) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  };
  R.mix = mix;

  R.init = function (canvas) {
    R.canvas = canvas;
    R.c = canvas.getContext('2d');
    // 青海波の 模様
    const t = document.createElement('canvas'); t.width = 64; t.height = 32;
    const g = t.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1.6;
    const arcs = (cx, cy) => { for (const r of [14, 9.5, 5]) { g.beginPath(); g.arc(cx, cy, r, Math.PI, 0); g.stroke(); } };
    for (const [cx, cy] of [[0, 16], [32, 16], [64, 16], [16, 32], [48, 32], [16, 0], [48, 0]]) arcs(cx, cy);
    R.seaTile = t;
    R.seaPat = R.c.createPattern(t, 'repeat');
    // 雲の かたまり（地方ごと）
    R.cloudPuffs = KR.REGIONS.map((reg, ri) => {
      const pts = [];
      M.nodes.forEach((n) => { if (n.r === ri) pts.push([n.x, n.y]); });
      const rnd = KR.rng(ri * 97 + 3);
      const puffs = [];
      for (const p of pts) {
        for (let k = 0; k < 2; k++) puffs.push({ x: p[0] + (rnd() - 0.5) * 60, y: p[1] + (rnd() - 0.5) * 60, r: 58 + rnd() * 40, ph: rnd() * TAU });
      }
      let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1]; }
      cx /= Math.max(1, pts.length); cy /= Math.max(1, pts.length);
      return { puffs, cx, cy };
    });
    // 地方の 中心（名前の ラベル用）
    R.regCenter = KR.REGIONS.map((reg, ri) => {
      let x = 0, y = 0, n = 0;
      KR.STATIONS.forEach((s, i) => { if (M.nodes[i].r === ri) { x += M.nodes[i].x; y += M.nodes[i].y; n++; } });
      return [x / n, y / n];
    });
    R.tok = KR.COMPANIES.map(() => ({ x: 0, y: 0, dir: 1, hop: 0, vis: true, node: -1, anim: false }));
  };

  R.resize = function (w, h, dpr) {
    R.dpr = dpr;
    R.canvas.width = Math.round(w * dpr); R.canvas.height = Math.round(h * dpr);
    R.canvas.style.width = w + 'px'; R.canvas.style.height = h + 'px';
    // 論理座標：高さ 720 を 基準に、横は 窓に あわせる（最低 1280）
    let sc = h / 720;
    if (w / sc < 1280) sc = w / 1280;
    R.sc = sc * dpr; R.cssSc = sc;
    R.W = w / sc; R.H = h / sc;
  };

  // ------------------------------------------------------------ カメラ
  R.w2s = (x, y) => [(x - R.cam.x) * R.cam.z + R.W / 2, (y - R.cam.y) * R.cam.z + R.H / 2];
  R.s2w = (x, y) => [(x - R.W / 2) / R.cam.z + R.cam.x, (y - R.H / 2) / R.cam.z + R.cam.y];
  R.clampZ = (z) => KR.clamp(z, 0.17, 1.7);
  R.camTo = function (x, y, z, instant) {
    R.cam.tx = x; R.cam.ty = y; if (z) R.cam.tz = R.clampZ(z);
    if (instant) { R.cam.x = x; R.cam.y = y; if (z) R.cam.z = R.cam.tz; }
  };
  // 点の あつまりが 画面に おさまるように
  R.fit = function (pts, pad, maxZ, minZ) {
    if (!pts.length) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    pad = pad || 120;
    // 上の帯（日付・目的地）・右の札・下の説明に かくれない 範囲に おさめる
    const top = 112, bottom = 150, left = 30, right = 290;
    const availW = R.W - left - right, availH = R.H - top - bottom;
    const z = Math.max(minZ || 0, R.clampZ(Math.min(maxZ || 1.0, availW / (x1 - x0 + pad * 2), availH / (y1 - y0 + pad * 2), 99)));
    const scx = left + availW / 2, scy = top + availH / 2;
    R.camTo((x0 + x1) / 2 - (scx - R.W / 2) / z, (y0 + y1) / 2 - (scy - R.H / 2) / z, z);
  };
  R.updateCam = function (dt) {
    const k = 1 - Math.pow(0.0025, dt);
    R.cam.x += (R.cam.tx - R.cam.x) * k; R.cam.y += (R.cam.ty - R.cam.y) * k; R.cam.z += (R.cam.tz - R.cam.z) * k;
  };

  // ------------------------------------------------------------ 演出の 部品
  R.addText = function (x, y, s, col, size, opt) {
    opt = opt || {};
    R.texts.push({ x, y, s, col: col || '#fff', size: size || 26, t: 0, life: opt.life || 1.6, out: opt.out || 'rgba(40,25,10,0.85)', screen: !!opt.screen, rise: opt.rise == null ? 46 : opt.rise });
  };
  R.burst = function (x, y, kind, n, opt) {
    opt = opt || {};
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = (opt.speed || 160) * (0.4 + Math.random() * 0.8);
      R.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opt.up || 80), g: opt.g == null ? 260 : opt.g, t: 0, life: (opt.life || 1.0) * (0.7 + Math.random() * 0.6), kind, col: opt.cols ? opt.cols[i % opt.cols.length] : opt.col || '#f3c64a', s: (opt.size || 6) * (0.7 + Math.random() * 0.6), rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10, screen: !!opt.screen });
    }
  };
  R.ring = function (x, y, col, r, life, screen) { R.rings.push({ x, y, col, r: r || 60, t: 0, life: life || 0.7, screen: !!screen }); };
  // 画面いっぱいに ふる（季節の かわりめ・決算・とうちゃく）
  R.rain = function (kind, n, cols) {
    for (let i = 0; i < n; i++) {
      R.fx.push({ x: Math.random() * R.W, y: -20 - Math.random() * R.H * 0.6, vx: (Math.random() - 0.3) * 60, vy: 60 + Math.random() * 80, g: 20, t: 0, life: 4 + Math.random() * 2, kind, col: cols[i % cols.length], s: 5 + Math.random() * 6, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 4, screen: true, sway: Math.random() * TAU });
    }
  };

  R.update = function (dt) {
    R.time += dt;
    R.updateCam(dt);
    if (R.seasonT < 1) R.seasonT = Math.min(1, R.seasonT + dt / 1.6);
    for (let i = 0; i < R.openAnim.length; i++) if (R.openAnim[i] > 0 && R.openAnim[i] < 1) R.openAnim[i] = Math.min(1, R.openAnim[i] + dt / 1.8);
    R.shake = Math.max(0, R.shake - dt * 2.5);
    for (const p of R.fx) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt + (p.sway != null ? Math.sin(R.time * 2 + p.sway) * 20 * dt : 0); p.y += p.vy * dt; p.rot += p.vr * dt; }
    R.fx = R.fx.filter((p) => p.t < p.life);
    for (const t of R.texts) t.t += dt;
    R.texts = R.texts.filter((t) => t.t < t.life);
    for (const r of R.rings) r.t += dt;
    R.rings = R.rings.filter((r) => r.t < r.life);
  };

  // ------------------------------------------------------------ 地図
  function smoothPath(c, pts) {
    const n = pts.length;
    c.beginPath();
    const mid = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
    const m0 = mid(n - 1); c.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const m = mid(i); c.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
    c.closePath();
  }
  function landGrad(c, s) {
    const g = c.createLinearGradient(0, 300, 0, M.H - 200);
    g.addColorStop(0, LAND[s][0]); g.addColorStop(0.45, LAND[s][1]); g.addColorStop(1, LAND[s][2]);
    return g;
  }

  R.worldTransform = function () {
    const c = R.c, z = R.cam.z;
    const sx = (Math.random() - 0.5) * R.shake * 10, sy = (Math.random() - 0.5) * R.shake * 10;
    c.setTransform(R.sc * z, 0, 0, R.sc * z, R.sc * (R.W / 2 - R.cam.x * z + sx), R.sc * (R.H / 2 - R.cam.y * z + sy));
  };
  R.screenTransform = function () { R.c.setTransform(R.sc, 0, 0, R.sc, 0, 0); };

  R.drawMap = function (G) {
    const c = R.c, z = R.cam.z;
    const s = R.season, ps = R.prevSeason, st = R.seasonT;
    R.screenTransform();
    // 海
    c.fillStyle = st < 1 ? mix(SEA[ps], SEA[s], st) : SEA[s];
    c.fillRect(0, 0, R.W, R.H);
    if (R.seaPat && R.seaPat.setTransform) {
      const m = new DOMMatrix([z * 1.4, 0, 0, z * 1.4, (R.W / 2 - R.cam.x * z) % (64 * z * 1.4), (R.H / 2 - R.cam.y * z) % (32 * z * 1.4)]);
      R.seaPat.setTransform(m);
      c.fillStyle = R.seaPat; c.fillRect(0, 0, R.W, R.H);
    }
    R.worldTransform();
    // 浜（白い ふち）
    c.lineJoin = 'round';
    for (const k in M.coast) { smoothPath(c, M.coast[k]); c.strokeStyle = 'rgba(255,255,255,0.65)'; c.lineWidth = 16; c.stroke(); }
    for (const k in M.coast) { smoothPath(c, M.coast[k]); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 34; c.stroke(); }
    // 陸
    const drawLand = (season, alpha) => {
      c.globalAlpha = alpha;
      c.fillStyle = landGrad(c, season);
      for (const k in M.coast) { smoothPath(c, M.coast[k]); c.fill(); }
      c.globalAlpha = 1;
    };
    if (st < 1) { drawLand(ps, 1); drawLand(s, st); } else drawLand(s, 1);
    for (const k in M.coast) { smoothPath(c, M.coast[k]); c.strokeStyle = 'rgba(90,70,40,0.55)'; c.lineWidth = 2.2; c.stroke(); }
    for (const k in M.lakes) { smoothPath(c, M.lakes[k]); c.fillStyle = st < 1 ? mix(SEA[ps], SEA[s], st) : SEA[s]; c.fill(); c.strokeStyle = 'rgba(90,70,40,0.4)'; c.lineWidth = 1.6; c.stroke(); }

    // 見えている 範囲
    const [vx0, vy0] = R.s2w(-40, -40), [vx1, vy1] = R.s2w(R.W + 40, R.H + 40);
    const vis = (x, y, m) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

    // 山
    for (const m of M.mountains) {
      if (!vis(m.x, m.y, 80)) continue;
      drawMountain(c, m, s);
    }
    // 木
    if (z > 0.26) {
      for (const t of M.trees) {
        if (!vis(t.x, t.y, 20)) continue;
        drawTree(c, t, s);
      }
    }

    // 線路
    const act = (ni) => KR.E.active(G, ni);
    for (const e of M.edges) {
      const pts = [e.a].concat(e.sq, [e.b]).map((i) => M.nodes[i]);
      const all = pts.every((n) => act(n.i));
      if (!all) {
        // 関所の 手前まで（この先 未開通）
        if (e.gate != null) {
          const aOpen = act(e.a), bOpen = act(e.b);
          if (aOpen !== bOpen) {
            const g = M.gates[e.gate];
            const gn = M.nodes[g.node];
            const fromN = aOpen ? M.nodes[e.a] : M.nodes[e.b];
            const list = aOpen ? pts : pts.slice().reverse();
            c.strokeStyle = 'rgba(80,60,40,0.45)'; c.lineWidth = 4; c.setLineDash([6, 8]);
            c.beginPath(); c.moveTo(fromN.x, fromN.y);
            for (const n of list) { c.lineTo(n.x, n.y); if (n === gn) break; }
            c.stroke(); c.setLineDash([]);
          }
        }
        continue;
      }
      const g = e.gate != null ? M.gates[e.gate] : null;
      if (g && g.kind === 'ship') {
        c.strokeStyle = '#2f5f93'; c.lineWidth = 3.4; c.setLineDash([5, 7]);
        c.beginPath(); pts.forEach((n, i) => (i ? c.lineTo(n.x, n.y) : c.moveTo(n.x, n.y))); c.stroke(); c.setLineDash([]);
        continue;
      }
      c.beginPath(); pts.forEach((n, i) => (i ? c.lineTo(n.x, n.y) : c.moveTo(n.x, n.y)));
      c.strokeStyle = g && G.gateOwner[g.i] >= 0 ? KR.COMPANIES[G.gateOwner[g.i]].dark : '#4a3a2c';
      c.lineWidth = 7; c.stroke();
      c.strokeStyle = '#fbf3e2'; c.lineWidth = 3.6; c.setLineDash(g && g.kind === 'tunnel' ? [4, 10] : [11, 11]); c.stroke(); c.setLineDash([]);
    }
  };

  function drawMountain(c, m, s) {
    const big = m.kind === 'big' || m.kind === 'fuji';
    const w = big ? 44 : 30, h = big ? 38 : 24;
    c.fillStyle = s === 2 ? '#a9845a' : s === 3 ? '#9aa4ae' : '#7f9a6a';
    if (m.kind === 'fuji') c.fillStyle = '#6f88a8';
    c.beginPath(); c.moveTo(m.x - w, m.y + h * 0.4); c.lineTo(m.x, m.y - h); c.lineTo(m.x + w, m.y + h * 0.4); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(60,45,30,0.45)'; c.lineWidth = 1.6; c.stroke();
    const cap = m.kind === 'fuji' ? (s === 1 ? 0.18 : 0.45) : s === 3 ? 0.55 : big ? 0.28 : 0;
    if (cap > 0) {
      c.fillStyle = '#fbfdff';
      c.beginPath(); c.moveTo(m.x - w * cap, m.y - h + h * 1.4 * cap); c.lineTo(m.x, m.y - h);
      c.lineTo(m.x + w * cap, m.y - h + h * 1.4 * cap);
      c.lineTo(m.x + w * cap * 0.4, m.y - h + h * 1.2 * cap); c.lineTo(m.x, m.y - h + h * 1.45 * cap); c.lineTo(m.x - w * cap * 0.4, m.y - h + h * 1.2 * cap);
      c.closePath(); c.fill();
    }
    if (m.kind === 'smoke') {
      for (let i = 0; i < 3; i++) {
        const t = (R.time * 0.25 + i / 3) % 1;
        c.fillStyle = 'rgba(240,240,240,' + (0.6 * (1 - t)) + ')';
        A.circle(c, m.x + t * 20, m.y - h - 6 - t * 40, 6 + t * 12); c.fill();
      }
    }
  }
  function drawTree(c, t, s) {
    const x = t.x, y = t.y, k = t.s;
    let col;
    if (s === 0) col = t.k === 0 ? '#f4b6c8' : '#8fbf6a';
    else if (s === 1) col = t.k === 0 ? '#4f9a4a' : '#62a957';
    else if (s === 2) col = t.k === 0 ? '#d9653a' : '#e8b03e';
    else col = t.lat > 37.5 ? '#f2f6f8' : t.k === 0 ? '#5d8a64' : '#76946a';
    c.fillStyle = 'rgba(60,45,30,0.18)'; c.beginPath(); c.ellipse(x + 2, y + 7 * k, 8 * k, 3 * k, 0, 0, TAU); c.fill();
    c.fillStyle = '#7a5a3a'; c.fillRect(x - 1.2 * k, y, 2.4 * k, 7 * k);
    c.fillStyle = col; A.circle(c, x, y - 2 * k, 7.5 * k); c.fill();
    if (s === 3 && t.lat > 37.5) { c.strokeStyle = 'rgba(120,140,160,0.5)'; c.lineWidth = 1; c.stroke(); }
  }

  // ------------------------------------------------------------ マス・駅・関所（画面の 座標で 描く）
  R.nodeR = () => KR.clamp(13 * R.cam.z, 5, 15);
  R.drawNodes = function (G, opt) {
    opt = opt || {};
    const c = R.c, z = R.cam.z;
    R.screenTransform();
    const act = (ni) => KR.E.active(G, ni);
    const r = R.nodeR();
    // 目的地の 光
    if (G.dest >= 0) {
      const d = M.nodes[G.dest];
      const [sx, sy] = R.w2s(d.x, d.y);
      const pr = 30 + Math.sin(R.time * 3) * 4;
      c.fillStyle = 'rgba(255,214,90,0.35)'; A.circle(c, sx, sy, pr * Math.max(0.7, z) + 10); c.fill();
      c.strokeStyle = 'rgba(255,190,40,0.9)'; c.lineWidth = 3; A.circle(c, sx, sy, pr * Math.max(0.7, z)); c.stroke();
    }
    for (const n of M.nodes) {
      if (n.t === 'st' || !act(n.i)) continue;
      const [sx, sy] = R.w2s(n.x, n.y);
      if (sx < -30 || sy < -30 || sx > R.W + 30 || sy > R.H + 30) continue;
      const S = A.SQ[n.t];
      if (n.t === 'gate') {
        const o = G.gateOwner[n.gate];
        c.fillStyle = S.col; A.circle(c, sx, sy, r * 1.15); c.fill();
        c.strokeStyle = o >= 0 ? KR.COMPANIES[o].color : S.ring; c.lineWidth = Math.max(2, r * 0.28); A.circle(c, sx, sy, r * 1.15); c.stroke();
        if (r > 8) A.sqIcon(c, 'gate', sx, sy, r * 0.85);
        if (z > 0.5) {
          const g = M.gates[n.gate];
          A.textOutline(c, g.name, sx, sy + r * 1.15 + 10, 12, '#4a3626', 'rgba(255,250,235,0.9)', 4);
          if (o >= 0) A.textOutline(c, KR.COMPANIES[o].short, sx, sy - r * 1.15 - 9, 11, '#fff', KR.COMPANIES[o].dark, 4);
        }
        if (R.gatePulse === n.gate) { c.strokeStyle = 'rgba(255,220,80,' + (0.5 + 0.5 * Math.sin(R.time * 8)) + ')'; c.lineWidth = 4; A.circle(c, sx, sy, r * 1.8); c.stroke(); }
        continue;
      }
      c.fillStyle = 'rgba(40,25,10,0.25)'; A.circle(c, sx + 1, sy + 2, r); c.fill();
      c.fillStyle = S.col; A.circle(c, sx, sy, r); c.fill();
      c.strokeStyle = S.ring; c.lineWidth = Math.max(1.4, r * 0.16); A.circle(c, sx, sy, r); c.stroke();
      if (r > 7.5) A.sqIcon(c, n.t, sx, sy, r * 0.82);
    }
    // 未開通の 関所（この先 工事中）
    for (const g of M.gates) {
      const n = M.nodes[g.node];
      if (act(n.i)) continue;
      const aOpen = G.open[g.ra], bOpen = G.open[g.rb];
      if (aOpen === bOpen) continue;
      const [sx, sy] = R.w2s(n.x, n.y);
      if (sx < -30 || sy < -30 || sx > R.W + 30 || sy > R.H + 30) continue;
      drawBarrier(c, sx, sy, Math.max(0.6, Math.min(1.2, z * 1.2)));
    }
    // 駅
    for (let i = 0; i < KR.STATIONS.length; i++) {
      if (!act(i)) continue;
      drawStation(c, G, i, opt);
    }
  };
  function drawBarrier(c, x, y, k) {
    c.save(); c.translate(x, y); c.scale(k, k);
    c.fillStyle = '#5a4532'; c.fillRect(-14, -2, 3, 14); c.fillRect(11, -2, 3, 14);
    c.fillStyle = '#f4d34a'; A.rr(c, -17, -9, 34, 9, 2); c.fill();
    c.save(); A.rr(c, -17, -9, 34, 9, 2); c.clip();
    c.fillStyle = '#2b2018'; for (let i = -20; i < 20; i += 8) { c.beginPath(); c.moveTo(i, -9); c.lineTo(i + 4, -9); c.lineTo(i, 0); c.lineTo(i - 4, 0); c.closePath(); c.fill(); }
    c.restore();
    c.strokeStyle = '#2b2018'; c.lineWidth = 1.4; A.rr(c, -17, -9, 34, 9, 2); c.stroke();
    c.restore();
  }
  function drawStation(c, G, i, opt) {
    const n = M.nodes[i], s = KR.STATIONS[i];
    const z = R.cam.z;
    const [sx, sy] = R.w2s(n.x, n.y);
    if (sx < -80 || sy < -60 || sx > R.W + 80 || sy > R.H + 60) return;
    const mono = KR.E.monoOwner(G, i);
    const fs = KR.clamp(11 + 6 * z, 10, 18);
    c.font = KR.FONT(fs, 800);
    const tw = c.measureText(s.name).width;
    const pw = tw + fs * 1.0, ph = fs * 1.55;
    // 駅の 印（丸）
    const rr = KR.clamp(15 * z, 7, 17);
    c.fillStyle = 'rgba(40,25,10,0.3)'; A.circle(c, sx + 1.5, sy + 2.5, rr); c.fill();
    c.fillStyle = mono >= 0 ? KR.COMPANIES[mono].color : '#fffaf0'; A.circle(c, sx, sy, rr); c.fill();
    c.strokeStyle = mono >= 0 ? KR.COMPANIES[mono].dark : '#4a3626'; c.lineWidth = Math.max(2, rr * 0.2); A.circle(c, sx, sy, rr); c.stroke();
    if (rr > 9) {
      c.fillStyle = mono >= 0 ? '#fff' : '#4a3626';
      A.circle(c, sx, sy, rr * 0.35); c.fill();
    }
    // 名前の 札
    let lx = sx, ly = sy;
    const off = rr + 6;
    const lab = s.lab || 's';
    if (lab.indexOf('n') >= 0) ly = sy - off - ph / 2; else if (lab.indexOf('s') >= 0) ly = sy + off + ph / 2;
    if (lab.indexOf('e') >= 0) lx = sx + off + pw / 2 - (lab.length > 1 ? pw * 0.3 : 0); else if (lab.indexOf('w') >= 0) lx = sx - off - pw / 2 + (lab.length > 1 ? pw * 0.3 : 0);
    if (lab === 'e' || lab === 'w') ly = sy;
    if (z < 0.3 && !opt.allNames) {
      if (i !== G.dest) return;
    }
    c.fillStyle = 'rgba(40,25,10,0.25)'; A.rr(c, lx - pw / 2 + 1.5, ly - ph / 2 + 2.5, pw, ph, ph * 0.3); c.fill();
    c.fillStyle = mono >= 0 ? KR.COMPANIES[mono].color : '#fffaf0'; A.rr(c, lx - pw / 2, ly - ph / 2, pw, ph, ph * 0.3); c.fill();
    c.strokeStyle = mono >= 0 ? KR.COMPANIES[mono].dark : '#4a3626'; c.lineWidth = 1.8; A.rr(c, lx - pw / 2, ly - ph / 2, pw, ph, ph * 0.3); c.stroke();
    c.fillStyle = mono >= 0 ? '#fff' : '#3a2a1c'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s.name, lx, ly + 1);
    // 名物の 持ち主（小さな 丸）
    if (z > 0.38) {
      const pis = s.pi, dr = 3.6, gap = 9;
      const y0 = ly + ph / 2 + 6;
      pis.forEach((pi, k) => {
        const o = G.own[pi];
        const px = lx + (k - (pis.length - 1) / 2) * gap;
        c.fillStyle = o >= 0 ? KR.COMPANIES[o].color : 'rgba(255,255,255,0.85)';
        A.circle(c, px, y0, dr); c.fill();
        c.strokeStyle = 'rgba(60,40,20,0.7)'; c.lineWidth = 1.1; c.stroke();
      });
      if (mono >= 0) A.textOutline(c, '独占', lx + pw / 2 + 4, ly - ph / 2 - 2, 10, '#fff', KR.COMPANIES[mono].dark, 3.5);
    }
    // 目的地の 旗
    if (i === G.dest) drawFlag(c, sx, sy - rr, Math.max(0.75, Math.min(1.25, z * 1.3)));
  }
  function drawFlag(c, x, y, k) {
    c.save(); c.translate(x, y); c.scale(k, k);
    c.strokeStyle = '#4a3626'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -62); c.stroke();
    c.fillStyle = '#f3c64a'; A.circle(c, 0, -64, 4); c.fill();
    const wv = Math.sin(R.time * 4) * 3;
    c.fillStyle = '#e4402f';
    c.beginPath(); c.moveTo(1, -60); c.quadraticCurveTo(26, -60 + wv, 50, -56); c.quadraticCurveTo(48, -46, 50, -36); c.quadraticCurveTo(26, -40 - wv, 1, -36); c.closePath(); c.fill();
    c.strokeStyle = '#8f2316'; c.lineWidth = 1.8; c.stroke();
    A.text(c, '目的地', 25, -47 + wv * 0.3, 12, '#fff', 'center', 900);
    c.restore();
  }

  // ------------------------------------------------------------ 雲（未開通の 地方）
  R.drawClouds = function (G) {
    const c = R.c, z = R.cam.z;
    R.worldTransform();
    KR.REGIONS.forEach((reg, ri) => {
      const oa = R.openAnim[ri];
      if (G.open[ri] && (oa === 0 || oa >= 1)) return;
      const cp = R.cloudPuffs[ri];
      const t = G.open[ri] ? KR.easeOut(oa) : 0;
      c.globalAlpha = 1 - t;
      for (const p of cp.puffs) {
        const dx = p.x - cp.cx, dy = p.y - cp.cy, dl = Math.hypot(dx, dy) || 1;
        const px = p.x + (dx / dl) * t * 260 + Math.sin(R.time * 0.4 + p.ph) * 6, py = p.y + (dy / dl) * t * 260 + Math.cos(R.time * 0.3 + p.ph) * 4;
        c.fillStyle = 'rgba(120,130,150,0.22)'; A.circle(c, px + 6, py + 10, p.r * (1 + t * 0.5)); c.fill();
      }
      for (const p of cp.puffs) {
        const dx = p.x - cp.cx, dy = p.y - cp.cy, dl = Math.hypot(dx, dy) || 1;
        const px = p.x + (dx / dl) * t * 260 + Math.sin(R.time * 0.4 + p.ph) * 6, py = p.y + (dy / dl) * t * 260 + Math.cos(R.time * 0.3 + p.ph) * 4;
        c.fillStyle = '#f8f6f1'; A.circle(c, px, py, p.r * (1 + t * 0.5)); c.fill();
      }
      c.globalAlpha = 1;
    });
    // 地方の 名前
    R.screenTransform();
    KR.REGIONS.forEach((reg, ri) => {
      if (G.open[ri]) return;
      const [cx, cy] = R.regCenter[ri];
      const [sx, sy] = R.w2s(cx, cy);
      if (sx < -200 || sy < -100 || sx > R.W + 200 || sy > R.H + 100) return;
      const k = KR.clamp(z * 1.6, 0.6, 1.3);
      A.textOutline(c, '未開通', sx, sy - 26 * k, 14 * k, '#8a7a66', '#f8f6f1', 5);
      A.textOutline(c, reg.name, sx, sy, 30 * k, '#6a5a48', '#f8f6f1', 6, 'center', 900);
      if (reg.teaser) A.textOutline(c, reg.teaser, sx, sy + 28 * k, 13 * k, '#8a7a66', '#f8f6f1', 5);
    });
  };

  // 地方の 名前（ひいた とき）
  R.drawRegionNames = function (G) {
    const c = R.c, z = R.cam.z;
    if (z > 0.42) return;
    R.screenTransform();
    KR.REGIONS.forEach((reg, ri) => {
      if (!G.open[ri]) return;
      const [cx, cy] = R.regCenter[ri];
      const [sx, sy] = R.w2s(cx, cy);
      c.globalAlpha = KR.clamp((0.42 - z) / 0.12, 0, 0.75);
      A.textOutline(c, reg.name, sx, sy, 22, reg.ink, 'rgba(255,255,255,0.8)', 5, 'center', 900);
      c.globalAlpha = 1;
    });
  };

  // ------------------------------------------------------------ コマ
  R.tokenScale = () => KR.clamp(0.9 * R.cam.z + 0.25, 0.55, 1.35);
  R.placeTokens = function (G) {
    // うごいていない コマを 駅・マスの 位置へ（同じ場所なら ずらす）
    const at = {};
    G.P.forEach((P, i) => { if (!R.tok[i].anim) { (at[P.node] = at[P.node] || []).push(i); } });
    for (const k in at) {
      const list = at[k], n = M.nodes[k];
      list.forEach((pi, j) => {
        const off = list.length > 1 ? (j - (list.length - 1) / 2) * 30 : 0;
        const t = R.tok[pi];
        t.x = n.x + off / Math.max(0.5, R.cam.z); t.y = n.y - 2 / Math.max(0.5, R.cam.z); t.node = +k;
      });
    }
  };
  R.drawTokens = function (G, cur) {
    const c = R.c;
    R.screenTransform();
    const order = G.P.map((P, i) => i).sort((a, b) => (a === cur) - (b === cur) || R.tok[a].y - R.tok[b].y);
    const s = R.tokenScale();
    for (const i of order) {
      const t = R.tok[i];
      if (!t.vis) continue;
      const [sx, sy] = R.w2s(t.x, t.y);
      const hop = t.hop > 0 ? -Math.sin(t.hop * Math.PI) * 16 * s : 0;
      const bob = i === cur ? Math.sin(R.time * 5) * 1.5 : 0;
      A.train(c, i, sx, sy - 14 * s + hop, s, t.dir, bob, i === cur);
      if (i === cur && !t.anim) {
        // 番の 会社の しるし
        const ay = sy - 44 * s + Math.sin(R.time * 4) * 3;
        c.fillStyle = KR.COMPANIES[i].color;
        c.beginPath(); c.moveTo(sx - 8, ay - 10); c.lineTo(sx + 8, ay - 10); c.lineTo(sx, ay); c.closePath(); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      }
    }
  };

  // ------------------------------------------------------------ 行き先の 候補
  R.drawCands = function (G) {
    if (!R.cands) return;
    const c = R.c;
    R.screenTransform();
    // えらんでいる 道
    const h = R.cands[R.candHover];
    if (h) {
      const P = G.P[G.cur];
      const pts = [M.nodes[P.node]].concat(h.opt.path.map((i) => M.nodes[i]));
      c.save();
      c.lineJoin = 'round'; c.lineCap = 'round';
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 12;
      c.beginPath(); pts.forEach((n, k) => { const [x, y] = R.w2s(n.x, n.y); k ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
      c.strokeStyle = KR.COMPANIES[G.cur].color; c.lineWidth = 6; c.setLineDash([10, 8]); c.lineDashOffset = -R.time * 40;
      c.stroke(); c.setLineDash([]);
      pts.forEach((n, k) => { if (!k) return; const [x, y] = R.w2s(n.x, n.y); c.fillStyle = '#fff'; A.circle(c, x, y, 9); c.fill(); A.text(c, String(k), x, y + 0.5, 11, KR.COMPANIES[G.cur].dark, 'center', 900); });
      c.restore();
    }
    // 引いて 見ているときは 印を 小さく（となりどうしが 重ならないように）
    const k = KR.clamp(0.45 + 0.6 * R.cam.z, 0.62, 1);
    R.cands.forEach((cd, i) => {
      const n = M.nodes[cd.opt.node];
      const [sx, sy] = R.w2s(n.x, n.y);
      cd.sx = sx; cd.sy = sy;
      const hov = i === R.candHover;
      const bounce = Math.abs(Math.sin(R.time * 5 + i * 0.7)) * 5 * k;
      const rr = ((cd.opt.dest ? 24 : 17) + (hov ? 4 : 0)) * k;
      c.strokeStyle = cd.opt.dest ? '#f3b21f' : KR.COMPANIES[G.cur].color;
      c.lineWidth = hov ? 5 : 3.2;
      c.fillStyle = cd.opt.dest ? 'rgba(255,220,90,0.35)' : 'rgba(255,255,255,0.3)';
      A.circle(c, sx, sy, rr); c.fill(); c.stroke();
      // 何の マスかが ひと目で わかる 小さな 札
      const by = sy - rr - 14 * k - bounce;
      const br = 11 * k * (hov ? 1.15 : 1);
      const t = n.t;
      c.fillStyle = 'rgba(40,25,10,0.3)'; A.circle(c, sx + 1, by + 2, br + 2); c.fill();
      if (cd.opt.dest) { c.fillStyle = '#f3b21f'; A.circle(c, sx, by, br + 2); c.fill(); A.text(c, '★', sx, by + 1, br * 1.4, '#fff', 'center', 900); }
      else if (t === 'st') { c.fillStyle = '#fffaf0'; A.circle(c, sx, by, br + 2); c.fill(); c.strokeStyle = '#4a3626'; c.lineWidth = 2; c.stroke(); A.text(c, '駅', sx, by + 1, br * 1.15, '#4a3626', 'center', 900); }
      else {
        const S = A.SQ[t];
        c.fillStyle = S.col; A.circle(c, sx, by, br + 2); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
        A.sqIcon(c, t, sx, by, br * 0.85);
      }
      if (cd.opt.tolls) A.textOutline(c, '通行料', sx + br + 18 * k, by, 10, '#fff', '#a02a1a', 3);
      if (cd.opt.dest) A.textOutline(c, cd.opt.exact ? 'ぴったり！' : 'とうちゃく！', sx, sy + rr + 16, 16, '#fff', '#c45a12', 5, 'center', 900);
    });
  };

  // ------------------------------------------------------------ 演出（世界の 座標と 画面の 座標の 両方）
  R.drawFx = function (only) {
    const c = R.c;
    for (const pass of [false, true]) {
      if (only != null && only !== pass) continue;
      if (pass) R.screenTransform(); else R.worldTransform();
      const k = pass ? 1 : 1 / R.cam.z;
      for (const r of R.rings) {
        if (r.screen !== pass) continue;
        const t = r.t / r.life;
        c.strokeStyle = r.col; c.globalAlpha = 1 - t; c.lineWidth = 5 * (1 - t) * k + 1;
        A.circle(c, r.x, r.y, r.r * KR.easeOut(t) * (pass ? 1 : k)); c.stroke();
        c.globalAlpha = 1;
      }
      for (const p of R.fx) {
        if (p.screen !== pass) continue;
        const a = Math.min(1, (p.life - p.t) * 2.5);
        c.globalAlpha = a;
        const s = p.s * k;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        if (p.kind === 'coin') {
          c.fillStyle = '#f5c242'; c.beginPath(); c.ellipse(0, 0, s, s * Math.abs(Math.cos(p.rot * 2)) + s * 0.2, 0, 0, TAU); c.fill();
          c.strokeStyle = '#b07a12'; c.lineWidth = 1.2 * k; c.stroke();
        } else if (p.kind === 'petal') {
          c.fillStyle = p.col; c.beginPath(); c.ellipse(0, 0, s, s * 0.6, 0, 0, TAU); c.fill();
        } else if (p.kind === 'leaf') {
          c.fillStyle = p.col; c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; const rr = (i % 2 ? 0.45 : 1) * s; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill();
        } else if (p.kind === 'snow') {
          c.fillStyle = '#fff'; A.circle(c, 0, 0, s * 0.6); c.fill();
        } else if (p.kind === 'confetti') {
          c.fillStyle = p.col; c.fillRect(-s * 0.6, -s * 0.3, s * 1.2, s * 0.6);
        } else if (p.kind === 'smoke') {
          c.fillStyle = 'rgba(255,255,255,0.8)'; A.circle(c, 0, 0, s * (1 + p.t)); c.fill();
        } else if (p.kind === 'drop') {
          c.fillStyle = '#5b8fd8'; c.beginPath(); c.ellipse(0, 0, s * 0.45, s * 0.8, 0, 0, TAU); c.fill();
        } else if (p.kind === 'ink') {
          c.fillStyle = p.col; A.circle(c, 0, 0, s * 0.5); c.fill();
        } else {
          c.fillStyle = p.col; c.beginPath();
          for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; const rr = (i % 2 ? 0.4 : 1) * s; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
          c.closePath(); c.fill();
        }
        c.restore();
        c.globalAlpha = 1;
      }
      for (const t of R.texts) {
        if (t.screen !== pass) continue;
        const u = t.t / t.life;
        const pop = u < 0.12 ? KR.easeOutBack(u / 0.12) : 1;
        c.globalAlpha = u > 0.75 ? (1 - u) / 0.25 : 1;
        let x = t.x, y = t.y - t.rise * KR.easeOut(Math.min(1, u * 1.6)) * k;
        if (!pass) { const sp = R.w2s(x, y); R.screenTransform(); x = sp[0]; y = sp[1]; }
        A.textOutline(c, t.s, x, y, t.size * pop, t.col, t.out, 6, 'center', 900);
        if (!pass) R.worldTransform();
        c.globalAlpha = 1;
      }
    }
    R.screenTransform();
  };

  // 画面の外に ある ものへの 矢印
  R.edgeArrow = function (wx, wy, col, label) {
    const [sx, sy] = R.w2s(wx, wy);
    const m = 46;
    if (sx > m && sy > 70 && sx < R.W - m && sy < R.H - m) return false;
    const cx = R.W / 2, cy = R.H / 2;
    const dx = sx - cx, dy = sy - cy;
    const k = Math.min((R.W / 2 - m) / Math.abs(dx || 1e-6), (R.H / 2 - m - 20) / Math.abs(dy || 1e-6));
    const ax = cx + dx * k, ay = cy + dy * k + 10;
    const a = Math.atan2(dy, dx);
    const c = R.c;
    R.screenTransform();
    c.save(); c.translate(ax, ay);
    c.fillStyle = 'rgba(255,250,235,0.92)'; A.circle(c, 0, 0, 22); c.fill();
    c.strokeStyle = col; c.lineWidth = 3; A.circle(c, 0, 0, 22); c.stroke();
    c.rotate(a); c.fillStyle = col; c.beginPath(); c.moveTo(30, 0); c.lineTo(18, -9); c.lineTo(18, 9); c.closePath(); c.fill();
    c.restore();
    if (label) A.text(c, label, ax, ay + 1, 11, col, 'center', 900);
    return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
