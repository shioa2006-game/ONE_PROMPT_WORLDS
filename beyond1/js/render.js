/* 戦国すごろく全国版 — 描画（Canvas 2D）
   地図の地紋（海・陸・山・国境・街道）は世界座標で焼いておき、城・軍勢・文字は画面座標で描く。
   拡大率で描く細かさを変える（全国図＝勢力の色と家名、近づくと城・国境のマス・兵数・国名）。 */
(function (root) {
  'use strict';
  const SG = root.SG;
  const D = SG.DATA, E = SG.E, MAP = SG.MAP;
  const W = MAP.W, H = MAP.H, POS = MAP.POS;
  const CL = {}; D.CLANS.forEach(c => { CL[c.id] = c; });

  const COL = {
    sea: '#3d6680', wave: 'rgba(190,220,232,0.16)', shallow: 'rgba(160,205,215,0.55)',
    paper: '#ece2c6', ink: '#2e2418', road: 'rgba(92,70,40,0.78)', gold: '#f3c344', red: '#d63a2a',
  };
  const FONT_M = '"Yu Mincho","YuMincho","Hiragino Mincho ProN","Noto Serif JP","MS PMincho",serif';
  const FONT_G = '"Yu Gothic UI","Yu Gothic","Hiragino Sans","Meiryo",sans-serif';
  const RSV = 1.25;     // 地紋の解像度（世界座標1あたりの画素）

  let cv, ctx, M, layers = {}, dpr = 1, view = { s: 1, ox: 0, oy: 0, w: 1, h: 1, z: 1 };
  const tintCache = {};
  let terrDirty = true, terrOwners = null, clanLabels = [];
  const mini = { base: null, terr: null, dirty: true, w: 0, h: 0 };

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // ───── 初期化：静的レイヤを焼く ─────
  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    M = MAP.build(RSV);
    bakeBase();
    bakeOver();
    bakeSnow();
    resize();
  }
  function pathPoly(c, pts, s) {
    c.beginPath();
    pts.forEach((p, i) => { if (i) c.lineTo(p[0] * s, p[1] * s); else c.moveTo(p[0] * s, p[1] * s); });
    c.closePath();
  }
  function paperPattern(c) {
    const t = mk(256, 256), x = t.getContext('2d');
    const rnd = MAP.mul(99);
    const im = x.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const v = 200 + rnd() * 55;
      im.data[i * 4] = v; im.data[i * 4 + 1] = v - 6; im.data[i * 4 + 2] = v - 18; im.data[i * 4 + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    x.globalAlpha = 0.18; x.strokeStyle = '#8a7350'; x.lineWidth = 0.6;
    for (let i = 0; i < 70; i++) {
      const sx = rnd() * 256, sy = rnd() * 256, a = rnd() * Math.PI * 2, l = 6 + rnd() * 18;
      x.beginPath(); x.moveTo(sx, sy); x.quadraticCurveTo(sx + Math.cos(a + 0.6) * l * 0.5, sy + Math.sin(a + 0.6) * l * 0.5, sx + Math.cos(a) * l, sy + Math.sin(a) * l); x.stroke();
    }
    return c.createPattern(t, 'repeat');
  }
  function wavePattern(c) {
    const t = mk(48, 24), x = t.getContext('2d');
    x.strokeStyle = COL.wave; x.lineWidth = 1.1;
    const arcs = (cx, cy) => { for (let r = 11; r > 2; r -= 3.5) { x.beginPath(); x.arc(cx, cy, r, Math.PI, 2 * Math.PI); x.stroke(); } };
    arcs(0, 24); arcs(24, 24); arcs(48, 24); arcs(12, 12); arcs(36, 12);
    return c.createPattern(t, 'repeat');
  }

  function bakeBase() {
    const RS = M.RS, c = mk(M.MW, M.MH), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, M.MH);
    g.addColorStop(0, '#355d78'); g.addColorStop(1, '#2c5068');
    x.fillStyle = g; x.fillRect(0, 0, M.MW, M.MH);
    x.save(); x.scale(RS, RS); x.fillStyle = wavePattern(x); x.fillRect(0, 0, W, H); x.restore();
    x.save();
    x.shadowColor = COL.shallow; x.shadowBlur = 22 * RS; x.fillStyle = COL.shallow;
    Object.values(M.isl).forEach(p => { pathPoly(x, p, RS); x.fill(); });
    x.restore();
    x.fillStyle = COL.paper;
    Object.values(M.isl).forEach(p => { pathPoly(x, p, RS); x.fill(); });
    const tex = mk(M.MW, M.MH), tx = tex.getContext('2d');
    tx.fillStyle = paperPattern(tx); tx.fillRect(0, 0, M.MW, M.MH);
    tx.globalCompositeOperation = 'destination-in';
    Object.values(M.isl).forEach(p => { pathPoly(tx, p, RS); tx.fill(); });
    x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.55; x.drawImage(tex, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    // 遊べない陸（灰色＋斜線）
    const out = mk(M.MW, M.MH), ox = out.getContext('2d');
    const oim = ox.createImageData(M.MW, M.MH);
    for (let i = 0; i < M.idx.length; i++) if (M.idx[i] >= 100 && M.idx[i] < 255) { oim.data[i * 4] = 120; oim.data[i * 4 + 1] = 110; oim.data[i * 4 + 2] = 92; oim.data[i * 4 + 3] = 80; }
    ox.putImageData(oim, 0, 0);
    ox.globalCompositeOperation = 'source-atop';
    ox.strokeStyle = 'rgba(80,66,48,0.25)'; ox.lineWidth = 1.2 * RS;
    for (let k = -M.MH; k < M.MW; k += 9 * RS) { ox.beginPath(); ox.moveTo(k, 0); ox.lineTo(k + M.MH, M.MH); ox.stroke(); }
    x.drawImage(out, 0, 0);
    drawMountains(x, RS);
    M.lakes.forEach(lake => {
      x.fillStyle = '#4c7891'; pathPoly(x, lake, RS); x.fill();
      x.save(); pathPoly(x, lake, RS); x.clip(); x.scale(RS, RS); x.fillStyle = wavePattern(x); x.fillRect(0, 0, W, H); x.restore();
    });
    layers.base = c;
  }

  function drawMountains(x, RS) {
    const rnd = MAP.mul(4242);
    const glyphs = [];
    const roadSegs = [];
    for (const nd of E.nodes.slice(E.P)) {
      const path = [POS[nd.a], ...MAP.between(nd.a,nd.i), POS[nd.i], ...MAP.between(nd.i,nd.b), POS[nd.b]];
      for (let i=1; i<path.length; i++) roadSegs.push([path[i-1],path[i]]);
    }
    const segDist = (px, py, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t);
    };
    D.PROV.forEach((p, pi) => {
      const w = D.MOUNTAIN[p.id] || 0.12;
      const m = M.masks[pi];
      const area = m.n / (RS * RS);
      const cnt = Math.round(w * area / 600);
      let tries = 0, placed = 0;
      while (placed < cnt && tries < cnt * 30) {
        tries++;
        const X = m.x0 + rnd() * m.w, Y = m.y0 + rnd() * m.h;
        const ii = Math.floor(Y) * M.MW + Math.floor(X);
        if (M.idx[ii] !== pi) continue;
        const wx = X / RS, wy = Y / RS;
        let ok = true;
        for (let n = 0; n < E.N && ok; n++) if (Math.hypot(POS[n][0] - wx, POS[n][1] - wy) < (n < E.P ? 26 : 13)) ok = false;
        for (const sg of roadSegs) { if (!ok) break; if (segDist(wx, wy, sg[0], sg[1]) < 7) ok = false; }
        for (const g of glyphs) { if (!ok) break; if (Math.hypot(g[0] - wx, g[1] - wy) < 11) ok = false; }
        if (!ok) continue;
        glyphs.push([wx, wy, 5 + rnd() * 4.5 * (0.6 + w), pi]);
        placed++;
      }
    });
    glyphs.sort((a, b) => a[1] - b[1]);
    x.save(); x.scale(RS, RS);
    for (const [gx, gy, s] of glyphs) {
      x.beginPath();
      x.moveTo(gx - s, gy); x.quadraticCurveTo(gx - s * 0.35, gy - s * 0.7, gx, gy - s * 1.05);
      x.quadraticCurveTo(gx + s * 0.4, gy - s * 0.6, gx + s, gy);
      x.closePath();
      x.fillStyle = 'rgba(150,132,96,0.35)'; x.fill();
      x.strokeStyle = 'rgba(88,72,48,0.7)'; x.lineWidth = 1; x.stroke();
      x.beginPath(); x.moveTo(gx, gy - s * 1.05); x.lineTo(gx + s * 0.15, gy - s * 0.35);
      x.strokeStyle = 'rgba(88,72,48,0.35)'; x.stroke();
    }
    x.restore();
    layers.mtn = glyphs;
  }

  function bakeSnow() {
    const RS = M.RS, c = mk(M.MW, M.MH), x = c.getContext('2d');
    x.scale(RS, RS);
    for (const [gx, gy, s, pi] of layers.mtn) {
      const pr = D.PROV[pi];
      if (!pr.snow && (D.MOUNTAIN[pr.id] || 0) < 0.7) continue;
      x.beginPath(); x.moveTo(gx - s * 0.7, gy - s * 0.35); x.quadraticCurveTo(gx - s * 0.3, gy - s * 0.75, gx, gy - s * 1.05);
      x.quadraticCurveTo(gx + s * 0.35, gy - s * 0.7, gx + s * 0.72, gy - s * 0.32); x.lineTo(gx + s * 0.3, gy - s * 0.45); x.lineTo(gx, gy - s * 0.3); x.lineTo(gx - s * 0.3, gy - s * 0.45); x.closePath();
      x.fillStyle = 'rgba(255,255,255,0.97)'; x.fill();
      x.strokeStyle = 'rgba(120,140,160,0.6)'; x.lineWidth = 0.6; x.stroke();
    }
    layers.snow = c;
    // 冬の霜（雪国の陸を青白く）
    const f = mk(M.MW, M.MH), fx = f.getContext('2d');
    D.PROV.forEach((p, pi) => {
      if (!p.snow) return;
      const m = M.masks[pi];
      fx.drawImage(m.cv, m.x0, m.y0);
    });
    fx.globalCompositeOperation = 'source-in';
    fx.fillStyle = '#e4eefa'; fx.fillRect(0, 0, M.MW, M.MH);
    layers.frost = f;
  }

  function bakeOver() {
    const RS = M.RS, c = mk(M.MW, M.MH), x = c.getContext('2d');
    x.drawImage(M.borders, 0, 0);
    x.save(); x.scale(RS, RS);
    x.lineJoin = 'round';
    Object.values(M.isl).forEach(p => { pathPoly(x, p, 1); x.strokeStyle = 'rgba(40,30,20,0.85)'; x.lineWidth = 1.5; x.stroke(); });
    M.lakes.forEach(l => { pathPoly(x, l, 1); x.strokeStyle = 'rgba(40,30,20,0.7)'; x.lineWidth = 1; x.stroke(); });
    // 街道
    for (let i = E.P; i < E.N; i++) {
      const nd = E.nodes[i];
      const a = POS[nd.a], m = POS[i], b = POS[nd.b];
      x.beginPath(); x.moveTo(...a);
      for (const p of MAP.between(nd.a,i)) x.lineTo(...p);
      x.lineTo(...m);
      for (const p of MAP.between(i,nd.b)) x.lineTo(...p);
      x.lineTo(...b);
      if (nd.t === 'S') { x.setLineDash([2, 5]); x.strokeStyle = 'rgba(235,240,230,0.85)'; x.lineWidth = 2; }
      else if (nd.t === 'P') { x.setLineDash([6, 4]); x.strokeStyle = COL.road; x.lineWidth = 1.8; }
      else { x.setLineDash([]); x.strokeStyle = COL.road; x.lineWidth = 2; }
      x.stroke();
    }
    x.setLineDash([]);
    x.font = '600 14px ' + FONT_M; x.textAlign = 'center'; x.textBaseline = 'middle';
    D.OUTER.forEach(o => {
      const q = MAP.proj(o.pts[0][0], o.pts[0][1]);
      x.fillStyle = 'rgba(70,58,40,0.55)'; x.fillText(o.n, q[0], q[1]);
    });
    x.restore();
    layers.over = c;
  }

  // ───── 勢力色のレイヤ ─────
  function tinted(p, col) {
    const tc = tintCache[p];
    if (tc && tc.col === col) return tc.cv;
    const m = M.masks[p];
    const c = mk(m.w, m.h), x = c.getContext('2d');
    x.drawImage(m.cv, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = col; x.fillRect(0, 0, m.w, m.h);
    tintCache[p] = { col, cv: c };
    return c;
  }
  function rebuildTerritory(owners) {
    if (!layers.terr) layers.terr = mk(M.MW, M.MH);
    const x = layers.terr.getContext('2d');
    x.clearRect(0, 0, M.MW, M.MH);
    for (let p = 0; p < E.P; p++) {
      const o = owners[p];
      if (!o) continue;
      const m = M.masks[p];
      x.drawImage(tinted(p, CL[o].col), m.x0, m.y0);
    }
    terrOwners = owners.slice();
    // 家名の位置（地続きのかたまりごと）
    clanLabels = [];
    const seen = new Uint8Array(E.P);
    for (let p = 0; p < E.P; p++) {
      if (seen[p] || !owners[p]) continue;
      const c = owners[p];
      const comp = [p]; seen[p] = 1;
      for (let k = 0; k < comp.length; k++) for (const q of E.padj[comp[k]]) if (!seen[q] && owners[q] === c) { seen[q] = 1; comp.push(q); }
      let sx = 0, sy = 0, sa = 0;
      for (const q of comp) { const m = M.masks[q]; const a = Math.max(1, m.n); sx += m.cx * a; sy += m.cy * a; sa += a; }
      const area = sa / (M.RS * M.RS);
      // 重心がよその国に落ちたら、いちばん大きい国の重心へ
      let lx = sx / sa, ly = sy / sa;
      const ii = Math.floor(ly * M.RS) * M.MW + Math.floor(lx * M.RS);
      if (!comp.includes(M.idx[ii])) { let big = comp[0]; for (const q of comp) if (M.masks[q].n > M.masks[big].n) big = q; lx = M.masks[big].cx; ly = M.masks[big].cy; }
      clanLabels.push({ c, x: lx, y: ly, area, n: comp.length });
    }
    mini.dirty = true;
  }

  // ───── 視点：fit（全体が収まる倍率）× z、中心 (cx, cy) は世界座標 ─────
  let zoom = { z: 1, cx: W / 2, cy: H / 2 };
  let cam = null;
  const maxZoom = () => Math.max(4.6, 2.4 / fitScale());
  function fitScale() { return Math.min(root.innerWidth / W, root.innerHeight / H); }
  function applyView() {
    const w = root.innerWidth, h = root.innerHeight;
    const s = fitScale() * zoom.z;
    // 地図の外へは、パネルの幅（約320px）ぶんまでしかはみ出さない
    const hw = w / s / 2, hh = h / s / 2, m = 320 / s;
    const lim = (c, half, size) => (size + 2 * m <= 2 * half ? size / 2 : Math.max(half - m, Math.min(size - half + m, c)));
    zoom.cx = lim(zoom.cx, hw, W);
    zoom.cy = lim(zoom.cy, hh, H);
    view = { s, ox: w / 2 - zoom.cx * s, oy: h / 2 - zoom.cy * s, w, h, z: zoom.z };
  }
  function resize() {
    dpr = Math.min(2, root.devicePixelRatio || 1);
    const w = root.innerWidth, h = root.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    applyView();
  }
  function zoomAt(sx, sy, f) {
    cam = null;
    const [wx, wy] = toWorld(sx, sy);
    const nz = Math.max(1, Math.min(maxZoom(), zoom.z * f));
    if (nz === zoom.z) return;
    const w = root.innerWidth, h = root.innerHeight;
    const s = fitScale() * nz;
    zoom.z = nz;
    zoom.cx = wx - (sx - w / 2) / s; zoom.cy = wy - (sy - h / 2) / s;
    applyView();
  }
  function panBy(dx, dy) { cam = null; zoom.cx -= dx / view.s; zoom.cy -= dy / view.s; applyView(); }
  function resetView(ms) { flyTo(W / 2, H / 2, 1, ms == null ? 450 : ms); }
  const ease = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  function flyTo(cx, cy, z, ms) {
    z = Math.max(1, Math.min(maxZoom(), z == null ? zoom.z : z));
    if (!ms) { cam = null; zoom = { z, cx, cy }; applyView(); return; }
    cam = { from: Object.assign({}, zoom), to: { z, cx, cy }, t0: performance.now(), dur: ms };
  }
  // 世界座標の矩形が収まるように（余白 pad は画面px）
  function fitBox(x0, y0, x1, y1, ms, opt) {
    opt = opt || {};
    const w = root.innerWidth - (opt.padL || 0) - (opt.padR || 0), h = root.innerHeight - (opt.padT || 0) - (opt.padB || 0);
    const bw = Math.max(60, x1 - x0), bh = Math.max(60, y1 - y0);
    let s = Math.min(w / bw, h / bh);
    if (opt.maxS) s = Math.min(s, opt.maxS);
    if (opt.minS) s = Math.max(s, opt.minS);
    const z = s / fitScale();
    const sc = fitScale() * Math.max(1, Math.min(maxZoom(), z));
    // 余白のぶん中心をずらす
    const cx = (x0 + x1) / 2 - ((opt.padL || 0) - (opt.padR || 0)) / 2 / sc;
    const cy = (y0 + y1) / 2 - ((opt.padT || 0) - (opt.padB || 0)) / 2 / sc;
    flyTo(cx, cy, z, ms);
  }
  function updateCam() {
    if (!cam) return;
    const k = Math.min(1, (performance.now() - cam.t0) / cam.dur), e = ease(k);
    // 拡大率は対数で補間
    zoom.z = Math.exp(Math.log(cam.from.z) + (Math.log(cam.to.z) - Math.log(cam.from.z)) * e);
    zoom.cx = cam.from.cx + (cam.to.cx - cam.from.cx) * e;
    zoom.cy = cam.from.cy + (cam.to.cy - cam.from.cy) * e;
    applyView();
    if (k >= 1) cam = null;
  }
  // カメラが動いている途中か。途中でクリックされたら、動きを終わらせる（その位置で操作させない）
  const camMoving = () => !!cam;
  function finishCam() { if (!cam) return; zoom = Object.assign({}, cam.to); cam = null; applyView(); }
  const toWorld = (sx, sy) => [(sx - view.ox) / view.s, (sy - view.oy) / view.s];
  const toScreen = (wx, wy) => [view.ox + wx * view.s, view.oy + wy * view.s];
  function onScreen(wx, wy, m) { const [x, y] = toScreen(wx, wy); m = m || 0; return x > -m && y > -m && x < view.w + m && y < view.h + m; }
  // 画面上の大きさの倍率（城・軍勢・文字）
  const glyphScale = () => Math.max(0.5, Math.min(1.2, view.s));
  const detail = () => (view.s < 0.62 ? 0 : view.s < 0.95 ? 1 : 2);

  // ───── 部品（画面座標で描く） ─────
  function castleGlyph(x, cx, cy, roof, sz, dim) {
    const s = sz || 1;
    x.save(); x.translate(cx, cy); x.scale(s, s);
    x.beginPath(); x.moveTo(-11, 7); x.lineTo(11, 7); x.lineTo(8.5, 1); x.lineTo(-8.5, 1); x.closePath();
    x.fillStyle = dim ? '#8b8270' : '#7d7466'; x.fill(); x.strokeStyle = COL.ink; x.lineWidth = 1; x.stroke();
    x.fillStyle = '#f6f1e4'; x.fillRect(-6.5, -6, 13, 7); x.strokeRect(-6.5, -6, 13, 7);
    x.fillStyle = COL.ink; x.fillRect(-3.5, -3.5, 2, 2); x.fillRect(1.5, -3.5, 2, 2);
    x.beginPath(); x.moveTo(-10, -5); x.quadraticCurveTo(0, -9, 10, -5); x.lineTo(5.5, -9.5); x.lineTo(-5.5, -9.5); x.closePath();
    x.fillStyle = roof; x.fill(); x.stroke();
    x.beginPath(); x.moveTo(-6.5, -9.5); x.quadraticCurveTo(0, -12.5, 6.5, -9.5); x.lineTo(3, -14); x.lineTo(-3, -14); x.closePath();
    x.fillStyle = roof; x.fill(); x.stroke();
    x.restore();
  }

  function armyToken(x, a, px, py, o) {
    o = o || {};
    const c = CL[a.c];
    const r = 14;
    x.save();
    x.translate(px, py);
    x.scale(o.scale || 1, o.scale || 1);
    if (o.alpha != null) x.globalAlpha = o.alpha;
    x.fillStyle = 'rgba(0,0,0,0.28)'; x.beginPath(); x.ellipse(1.5, r - 1, r * 0.95, r * 0.38, 0, 0, Math.PI * 2); x.fill();
    if (!o.simple) {
      x.fillStyle = '#3a2a1a'; x.fillRect(r * 0.55, -r - 15, 1.6, r + 8);
      x.fillStyle = c.col; x.strokeStyle = 'rgba(30,20,10,0.8)'; x.lineWidth = 0.8;
      const wv = o.t ? Math.sin(o.t * 6 + a.id) * 1.2 : 0;
      x.beginPath(); x.moveTo(r * 0.55 + 1.6, -r - 15); x.lineTo(r * 0.55 + 10, -r - 15 + wv); x.lineTo(r * 0.55 + 10, -r - 2 + wv); x.lineTo(r * 0.55 + 1.6, -r - 2); x.closePath(); x.fill(); x.stroke();
    }
    x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2);
    x.fillStyle = c.col; x.fill();
    x.lineWidth = o.me ? 3 : 2.2; x.strokeStyle = o.me ? '#fff2c0' : '#1c140c'; x.stroke();
    if (o.me) { x.beginPath(); x.arc(0, 0, r + 1.8, 0, Math.PI * 2); x.lineWidth = 1.4; x.strokeStyle = '#1c140c'; x.stroke(); }
    x.beginPath(); x.arc(0, 0, r - 3, 0, Math.PI * 2); x.lineWidth = 1.2; x.strokeStyle = 'rgba(255,250,235,0.85)'; x.stroke();
    x.fillStyle = '#fffaf0'; x.font = '700 14px ' + FONT_M; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(c.mon, 0, 1);
    if (!o.simple || o.me) {
      const tcol = a.t <= 3 ? '#b8281c' : '#1c140c';
      x.beginPath(); x.arc(r * 0.78, r * 0.62, 8, 0, Math.PI * 2); x.fillStyle = '#fbf6e8'; x.fill(); x.lineWidth = 1.5; x.strokeStyle = tcol; x.stroke();
      x.fillStyle = tcol; x.font = '700 11px ' + FONT_G; x.fillText(String(a.t), r * 0.78, r * 0.62 + 0.5);
    }
    if (o.moved) {
      x.beginPath(); x.arc(0, 0, r + 1, 0, Math.PI * 2); x.fillStyle = 'rgba(236,226,198,0.45)'; x.fill();
    }
    if (o.die) {
      x.save(); x.translate(-r * 0.85, -r * 0.75);
      dieFace(x, o.die, 7);
      x.restore();
    }
    if (o.dom) {
      const t = { recruit: '徴', develop: '開', fortify: '築', prepare: '備' }[o.dom] || '内';
      x.beginPath(); x.arc(-r * 0.8, r * 0.62, 8, 0, Math.PI * 2); x.fillStyle = '#2f6b3a'; x.fill(); x.lineWidth = 1.3; x.strokeStyle = '#fbf6e8'; x.stroke();
      x.fillStyle = '#fbf6e8'; x.font = '700 10px ' + FONT_M; x.fillText(t, -r * 0.8, r * 0.62 + 0.5);
    }
    if (o.dg) {
      x.beginPath(); x.arc(0, -r - 2, 7.5, 0, Math.PI * 2); x.fillStyle = '#4a3a86'; x.fill(); x.lineWidth = 1.2; x.strokeStyle = '#fbf6e8'; x.stroke();
      x.fillStyle = '#fbf6e8'; x.font = '700 9px ' + FONT_M; x.fillText('委', 0, -r - 1.5);
    }
    x.restore();
  }
  function dieFace(x, v, s) {
    x.fillStyle = '#fbf6e8'; x.strokeStyle = '#1c140c'; x.lineWidth = 1;
    roundRect(x, -s, -s, 2 * s, 2 * s, 2); x.fill(); x.stroke();
    const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v] || [];
    for (const [dx, dy] of P) { x.beginPath(); x.arc(dx * s * 0.5, dy * s * 0.5, v === 1 ? s * 0.32 : s * 0.18, 0, Math.PI * 2); x.fillStyle = v === 1 ? '#c8281c' : '#1c140c'; x.fill(); }
  }
  function roundRect(x, X, Y, w, h, r) {
    x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
  }
  function label(x, txt, px, py, font, fill, halo, hw) {
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round';
    if (halo) { x.strokeStyle = halo; x.lineWidth = hw || 3.5; x.strokeText(txt, px, py); }
    x.fillStyle = fill; x.fillText(txt, px, py);
  }

  // ───── 1フレーム描画 ─────
  // V: 表示用の状態, U: UIの状態（選択・ハイライト・演出）
  function draw(V, U, t) {
    updateCam();
    if (!terrOwners || terrDirty || V.owner.some((o, i) => o !== terrOwners[i] && !(U.spread && U.spread[i]))) {
      const owners = V.owner.map((o, i) => (U.spread && U.spread[i] ? U.spread[i].from : o));
      rebuildTerritory(owners); terrDirty = false;
    }
    const x = ctx;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#2c5068'; x.fillRect(0, 0, cv.width, cv.height);
    const sh = U.shake ? U.shake : 0;
    const shx = sh ? (Math.random() - 0.5) * sh : 0, shy = sh ? (Math.random() - 0.5) * sh : 0;
    const s = view.s;
    x.setTransform(s * dpr, 0, 0, s * dpr, (view.ox + shx) * dpr, (view.oy + shy) * dpr);
    x.imageSmoothingEnabled = true;
    x.drawImage(layers.base, 0, 0, W, H);
    x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.62;
    x.drawImage(layers.terr, 0, 0, W, H);
    if (U.spread) for (const k in U.spread) {
      const sp = U.spread[k], p = +k, m = M.masks[p];
      const k01 = Math.min(1, (t - sp.t0) / Math.max(0.001, sp.dur));
      if (!sp.to) continue;
      const cx = POS[p][0], cy = POS[p][1];
      const rmax = Math.hypot(Math.max(Math.abs(m.x0 / M.RS - cx), Math.abs(m.x1 / M.RS - cx)), Math.max(Math.abs(m.y0 / M.RS - cy), Math.abs(m.y1 / M.RS - cy)));
      x.save();
      x.beginPath(); x.arc(cx, cy, rmax * easeOut(k01) + 1, 0, Math.PI * 2); x.clip();
      x.drawImage(tinted(p, CL[sp.to].col), m.x0 / M.RS, m.y0 / M.RS, m.w / M.RS, m.h / M.RS);
      x.restore();
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    if (U.flash) {
      // 選んだ家の領地を光らせる
      const k = 0.35 + 0.25 * Math.sin(t * 6);
      x.globalAlpha = k; x.globalCompositeOperation = 'lighter';
      for (let p = 0; p < E.P; p++) if (V.owner[p] === U.flash) { const m = M.masks[p]; x.drawImage(tinted(p, '#ffe9a8'), m.x0 / M.RS, m.y0 / M.RS, m.w / M.RS, m.h / M.RS); }
      x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    }
    if (U.winter) {
      x.globalAlpha = 0.95; x.drawImage(layers.snow, 0, 0, W, H);
      x.globalAlpha = 0.28; x.drawImage(layers.frost, 0, 0, W, H); x.globalAlpha = 1;
    }
    x.drawImage(layers.over, 0, 0, W, H);
    if (U.spread) for (const k in U.spread) {
      const sp = U.spread[k], p = +k;
      const k01 = Math.min(1, (t - sp.t0) / Math.max(0.001, sp.dur));
      if (k01 >= 1 || !sp.to) continue;
      const m = M.masks[p];
      const cx = POS[p][0], cy = POS[p][1];
      const rmax = Math.hypot(Math.max(Math.abs(m.x0 / M.RS - cx), Math.abs(m.x1 / M.RS - cx)), Math.max(Math.abs(m.y0 / M.RS - cy), Math.abs(m.y1 / M.RS - cy)));
      x.save();
      x.globalCompositeOperation = 'lighter';
      x.globalAlpha = 0.5 * (1 - k01);
      x.drawImage(tinted(p, '#ffe9a8'), m.x0 / M.RS, m.y0 / M.RS, m.w / M.RS, m.h / M.RS);
      x.restore();
      x.beginPath(); x.arc(cx, cy, rmax * easeOut(k01), 0, Math.PI * 2);
      x.strokeStyle = 'rgba(255,240,190,' + (0.8 * (1 - k01)) + ')'; x.lineWidth = 3 / Math.max(0.5, s); x.stroke();
    }

    // ここから画面座標
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = glyphScale(), lvl = detail();
    const SP = new Array(E.N);
    for (let n = 0; n < E.N; n++) SP[n] = [view.ox + POS[n][0] * s + shx, view.oy + POS[n][1] * s + shy];
    const vis = (q, m) => q[0] > -m && q[1] > -m && q[0] < view.w + m && q[1] < view.h + m;

    // 家名（全国図）
    if (lvl === 0) {
      for (const L of clanLabels) {
        const fs = Math.max(11, Math.min(34, Math.sqrt(L.area) * s * 0.2));
        if (L.n === 1 && fs < 12 && L.c !== (U.me || '')) continue;
        const px = view.ox + L.x * s, py = view.oy + L.y * s;
        if (!vis([px, py], 80)) continue;
        const me = L.c === U.me;
        label(x, CL[L.c].n, px, py, '800 ' + Math.round(fs) + 'px ' + FONT_M, me ? '#fff2c0' : '#2a1d10', me ? 'rgba(60,30,10,0.9)' : 'rgba(244,236,214,0.85)', Math.max(3, fs * 0.22));
      }
    }

    drawHighlights(x, V, U, t, SP, g);

    // 国境のマス
    if (lvl >= 1) {
      for (let i = E.P; i < E.N; i++) {
        const nd = E.nodes[i], p = SP[i];
        if (!vis(p, 20)) continue;
        x.save(); x.translate(p[0], p[1]); x.scale(g, g);
        if (nd.t === 'P') {
          x.beginPath(); x.moveTo(-6, 4); x.lineTo(0, -5); x.lineTo(6, 4); x.closePath();
          x.fillStyle = '#efe6cc'; x.fill(); x.strokeStyle = COL.ink; x.lineWidth = 1.3; x.stroke();
        } else if (nd.t === 'S') {
          x.beginPath(); x.arc(0, 0, 5, 0, Math.PI * 2); x.fillStyle = '#d7e6ea'; x.fill(); x.strokeStyle = COL.ink; x.lineWidth = 1.2; x.stroke();
          x.beginPath(); x.moveTo(-3, 0); x.quadraticCurveTo(-1.5, -2, 0, 0); x.quadraticCurveTo(1.5, 2, 3, 0); x.stroke();
        } else {
          x.beginPath(); x.arc(0, 0, 4, 0, Math.PI * 2); x.fillStyle = '#efe6cc'; x.fill(); x.strokeStyle = COL.ink; x.lineWidth = 1.3; x.stroke();
        }
        x.restore();
      }
    }
    // 城
    const occ = {};
    for (const a of V.armies) occ[a.n] = 1;
    for (let p = 0; p < E.P; p++) {
      const q = SP[p];
      if (!vis(q, 40)) continue;
      const held = occ[p] && !(U.armyPos && V.armies.some(a => a.n === p && U.armyPos[a.id]));
      const o = U.spread && U.spread[p] && (t - U.spread[p].t0) < U.spread[p].dur * 0.5 ? U.spread[p].from : V.owner[p];
      const roof = o ? CL[o].col : '#8a8170';
      const hl = U.nodeHL && U.nodeHL[p];
      if (hl) {
        const rr = (23 + Math.sin(t * 5) * 2) * g;
        x.beginPath(); x.arc(q[0], q[1], rr, 0, Math.PI * 2); x.fillStyle = hl; x.fill();
        x.lineWidth = 3; x.strokeStyle = 'rgba(255,248,210,' + (0.6 + 0.3 * Math.sin(t * 5)) + ')'; x.stroke();
      }
      if (lvl === 0) {
        if (!held) castleGlyph(x, q[0], q[1], roof, g * 0.8);
        if (p === E.KYO) label(x, '京', q[0] + 12 * g, q[1] - 12 * g, '800 ' + Math.round(13 * g + 3) + 'px ' + FONT_M, '#a8201a', 'rgba(244,236,214,0.9)');
        continue;
      }
      if (held) castleGlyph(x, q[0] - 13 * g, q[1] - 12 * g, roof, 0.8 * g);
      else castleGlyph(x, q[0], q[1], roof, (p === E.KYO ? 1.15 : 1) * g);
      if (!held) {
        const gv = V.gar[p];
        const bx = q[0] - 15 * g, by = q[1] + 7 * g;
        x.beginPath(); x.arc(bx, by, 7 * g, 0, Math.PI * 2);
        x.fillStyle = o ? '#2a1d10' : '#6b6152'; x.fill();
        x.fillStyle = '#f6efdc'; x.font = '700 ' + Math.round(10 * g) + 'px ' + FONT_G; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(String(gv), bx, by + 0.5);
      }
      if (p === E.KYO) label(x, '京', q[0] + (held ? -24 : 15) * g, q[1] - (held ? 18 : 7) * g, '700 ' + Math.round(11 * g + 1) + 'px ' + FONT_M, '#a8201a', 'rgba(244,236,214,0.9)');
      if (U.danger && U.danger[p]) {
        const a = 0.6 + 0.4 * Math.sin(t * 7);
        const dx = (held ? -20 : 15) * g, dy = (held ? 6 : 7) * g;
        x.beginPath(); x.arc(q[0] + dx, q[1] + dy, 7.5 * g, 0, Math.PI * 2); x.fillStyle = 'rgba(214,58,42,' + a + ')'; x.fill();
        label(x, '!', q[0] + dx, q[1] + dy + 0.5, '900 ' + Math.round(11 * g) + 'px ' + FONT_G, '#fff', null);
      }
    }

    // 軍勢
    const drawn = U.armyPos || {};
    const sel = U.selArmy;
    const list = V.armies.slice().sort((a, b) => (POS[a.n][1] - POS[b.n][1]));
    const me = U.me;
    const tokens = [];
    for (const a of list) {
      if (U.hide && U.hide[a.id]) continue;
      const wp = drawn[a.id];
      const p = wp ? [view.ox + wp[0] * s + shx, view.oy + wp[1] * s + shy] : SP[a.n];
      if (!vis(p, 40)) continue;
      if (sel === a.id) {
        x.beginPath(); x.arc(p[0], p[1], (20 + Math.sin(t * 6) * 2) * g, 0, Math.PI * 2);
        x.strokeStyle = COL.gold; x.lineWidth = 3; x.stroke();
        x.fillStyle = 'rgba(243,195,68,0.25)'; x.fill();
      } else if (U.canAct && U.canAct[a.id]) {
        x.beginPath(); x.arc(p[0], p[1], 18 * g, 0, Math.PI * 2);
        x.strokeStyle = 'rgba(243,195,68,' + (0.45 + 0.35 * Math.sin(t * 4)) + ')'; x.lineWidth = 2; x.stroke();
      }
      const hop = U.hop && U.hop[a.id] ? U.hop[a.id] * g : 0;
      armyToken(x, a, p[0], p[1] - hop, { t, moved: U.moved && U.moved[a.id], die: U.armyDie && U.armyDie[a.id], dom: U.armyDom && U.armyDom[a.id], dg: a.c === me && a.dg, me: a.c === me && lvl === 0, simple: lvl === 0, scale: g * (U.armyScale && U.armyScale[a.id] != null ? U.armyScale[a.id] : 1) });
      if (U.armyHint && U.armyHint[a.id]) {
        const hv = U.armyHint[a.id];
        const k = hv.startsWith('kishu');
        const dv = hv.indexOf(':') > 0 ? hv.split(':')[1] : '';
        const txt = (k ? '奇' : '攻') + dv;
        const bx = p[0] - 18 * g, by = p[1] - (21 + Math.abs(Math.sin(t * 4)) * 3) * g;
        const w = (dv ? 24 : 18);
        x.save(); x.translate(bx, by); x.scale(g, g);
        x.fillStyle = k ? '#ffcf3a' : '#e8452c';
        roundRect(x, -w / 2, -9, w, 18, 9); x.fill(); x.lineWidth = 1.5; x.strokeStyle = '#1c140c'; x.stroke();
        x.fillStyle = k ? '#3a1a00' : '#fff'; x.font = '800 11px ' + FONT_M; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(txt, 0, 0.5);
        x.restore();
      }
      if (U.heal && U.heal[a.id]) label(x, '+' + U.heal[a.id], p[0] - 2, p[1] + 26 * g, '700 ' + Math.round(12 * g + 1) + 'px ' + FONT_G, '#1f7a3a', 'rgba(244,236,214,0.9)');
      tokens.push([p[0], p[1] - hop, a, g * (U.armyScale && U.armyScale[a.id] != null ? U.armyScale[a.id] : 1)]);
    }
    if (lvl >= 1 || tokens.some(t => t[2].c === me)) {
      for (const [px, py, a, sc] of tokens) {
        if (lvl === 0 && a.c !== me) continue;
        if (sc <= 0.05) continue;
        const r = 14, tcol = a.t <= 3 ? '#b8281c' : '#1c140c';
        x.save(); x.translate(px, py); x.scale(sc, sc);
        x.beginPath(); x.arc(r * 0.78, r * 0.62, 8, 0, Math.PI * 2); x.fillStyle = '#fbf6e8'; x.fill(); x.lineWidth = 1.5; x.strokeStyle = tcol; x.stroke();
        x.fillStyle = tcol; x.font = '700 11px ' + FONT_G; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(a.t), r * 0.78, r * 0.62 + 0.5);
        x.restore();
      }
    }
    // 国名（軍勢の上に描いて読めるように）
    if (lvl >= 1) {
      const fs = Math.round(14 * g);
      const tr = 17 * g;
      for (let p = 0; p < E.P; p++) {
        const q = SP[p];
        if (!vis(q, 40)) continue;
        const kyoto = p === E.KYO;
        const lx = q[0] + (kyoto ? 24 * g : 0);
        const ly = q[1] + (kyoto ? 19 : 27) * g, hw = D.PROV[p].n.length * fs * 0.52;
        let hit = false;
        for (const t of tokens) { if (t[3] <= 0.05) continue; if (Math.abs(t[0] - lx) < hw + tr && Math.abs(t[1] - ly) < fs * 0.5 + tr && !(t[0] === q[0] && t[1] === q[1])) { hit = true; break; } }
        if (hit) x.globalAlpha = 0.38;
        label(x, D.PROV[p].n, lx, ly, '700 ' + fs + 'px ' + FONT_M, '#2a1d10', 'rgba(244,236,214,0.92)');
        x.globalAlpha = 1;
      }
    }
    if (U.winter) {
      x.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 110; i++) {
        const sx = (i * 197.3 + Math.sin(t * 0.7 + i) * 18) % view.w;
        const sy = ((i * 89.7 + t * (14 + (i % 5) * 4)) % (view.h + 20)) - 10;
        x.beginPath(); x.arc(sx, sy, 1.2 + (i % 3) * 0.6, 0, Math.PI * 2); x.fill();
      }
    }
    if (U.fx) U.fx.forEach(f => f.draw && f.draw(x, t, g));
    if (U.targets) for (const tg of U.targets) drawTargetBadge(x, tg, t, SP[tg.n], g);
  }

  function drawHighlights(x, V, U, t, SP, g) {
    if (U.enemyReach) {
      for (const [n, k] of U.enemyReach) {
        const p = SP[n];
        x.beginPath(); x.arc(p[0], p[1], (n < E.P ? 18 : 11) * g, 0, Math.PI * 2);
        x.fillStyle = 'rgba(232,96,40,' + (0.3 + 0.35 * k) + ')'; x.fill();
        x.strokeStyle = 'rgba(120,30,10,0.85)'; x.lineWidth = 1.5; x.stroke();
      }
    }
    if (U.nodeHL) for (const k in U.nodeHL) {
      const n = +k; if (n < E.P) continue;
      const p = SP[n];
      const rr = (15 + Math.sin(t * 5) * 2) * g;
      x.beginPath(); x.arc(p[0], p[1], rr, 0, Math.PI * 2); x.fillStyle = U.nodeHL[k]; x.fill();
      x.lineWidth = 2.5; x.strokeStyle = 'rgba(255,248,210,0.8)'; x.stroke();
    }
    if (U.reach) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 5);
      for (const n of U.reach) {
        const p = SP[n];
        const r = (n < E.P ? 17 : 11) * g;
        x.beginPath(); x.arc(p[0], p[1], r + (3 + pulse * 2) * g, 0, Math.PI * 2);
        x.strokeStyle = 'rgba(255,255,255,' + (0.55 + 0.35 * pulse) + ')'; x.lineWidth = 2.5; x.stroke();
        x.beginPath(); x.arc(p[0], p[1], r, 0, Math.PI * 2);
        x.fillStyle = 'rgba(120,220,255,0.55)'; x.fill();
        x.strokeStyle = '#0d3550'; x.lineWidth = 2; x.stroke();
      }
    }
    if (U.stage) {
      for (const n of U.stage) {
        const p = SP[n];
        x.save(); x.translate(p[0], p[1]); x.scale(g, g);
        x.beginPath(); x.arc(0, 0, 15, 0, Math.PI * 2);
        x.setLineDash([4, 3]); x.strokeStyle = 'rgba(200,30,20,0.95)'; x.lineWidth = 2.2; x.stroke(); x.setLineDash([]);
        x.fillStyle = '#3a2a1a'; x.fillRect(9, -26, 1.6, 18);
        x.fillStyle = '#c8281c'; x.fillRect(10.6, -26, 12, 11);
        x.fillStyle = '#fff6e0'; x.font = '700 9px ' + FONT_M; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText('陣', 16.6, -20);
        x.restore();
      }
    }
    if (U.path && U.path.length > 1) {
      x.save();
      x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath();
      U.path.forEach((n, i) => {
        const p = SP[n];
        if (!i) { x.moveTo(...p); return; }
        for (const [wx,wy] of MAP.between(U.path[i-1],n)) x.lineTo(p[0]+(wx-POS[n][0])*view.s,p[1]+(wy-POS[n][1])*view.s);
        x.lineTo(...p);
      });
      x.strokeStyle = 'rgba(30,20,10,0.55)'; x.lineWidth = 7; x.stroke();
      x.setLineDash([8, 6]); x.lineDashOffset = -t * 30;
      x.strokeStyle = U.pathAttack ? '#ff6b4a' : '#ffd760'; x.lineWidth = 3.5; x.stroke();
      x.restore();
      let acc = 0;
      for (let i = 1; i < U.path.length; i++) {
        acc += U.pathCost ? U.pathCost[i] : 1;
        const p = SP[U.path[i]];
        x.beginPath(); x.arc(p[0] + 11 * g, p[1] - 11 * g, 7.5, 0, Math.PI * 2); x.fillStyle = '#1c140c'; x.fill();
        x.fillStyle = '#ffe9a8'; x.font = '700 10px ' + FONT_G; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(String(acc), p[0] + 11 * g, p[1] - 10.5 * g);
      }
    }
  }

  function drawTargetBadge(x, tg, t, p, g) {
    const pulse = 1 + 0.06 * Math.sin(t * 6);
    x.save(); x.translate(p[0], p[1]); x.scale(Math.max(0.75, g), Math.max(0.75, g));
    x.beginPath(); x.arc(0, 0, 19 * pulse, 0, Math.PI * 2);
    const kc = tg.kishu && tg.p > 0;
    x.strokeStyle = kc ? '#ffcf3a' : '#e8452c'; x.lineWidth = 3; x.stroke();
    x.lineWidth = 2;
    x.beginPath(); x.moveTo(-23, -23); x.lineTo(-14, -14); x.moveTo(23, -23); x.lineTo(14, -14); x.stroke();
    const txt = tg.kishu && tg.p > 0 ? '奇襲 ' + Math.round(tg.p * 100) + '%' : Math.round(tg.p * 100) + '%';
    x.font = '700 12px ' + FONT_G;
    const w = x.measureText(txt).width + 10;
    x.fillStyle = kc ? '#7a1a10' : 'rgba(28,20,12,0.88)';
    roundRect(x, -w / 2, 18, w, 17, 4); x.fill();
    x.fillStyle = tg.p >= 0.67 ? '#ffe9a8' : tg.p >= 0.34 ? '#ffd0a0' : '#ff9d8a';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 0, 27);
    x.restore();
  }

  const easeOut = k => 1 - Math.pow(1 - k, 3);

  // 画面座標での当たり判定。opt.borders=false で国境のマスを拾わない
  function hitTest(sx, sy, V, opt) {
    opt = opt || {};
    const g = glyphScale(), s = view.s;
    const scr = n => [view.ox + POS[n][0] * s, view.oy + POS[n][1] * s];
    let best = null, bd = Infinity;
    for (const a of V.armies) {
      const p = scr(a.n);
      const d = Math.hypot(p[0] - sx, p[1] - sy);
      if (d < Math.max(10, 17 * g) && d < bd) { bd = d; best = { kind: 'army', id: a.id, n: a.n }; }
    }
    if (best && opt.preferArmy !== false) return best;
    const borders = opt.borders != null ? opt.borders : detail() >= 1;
    const extra = opt.extra || null;
    let bn = null; bd = Infinity;
    for (let n = 0; n < E.N; n++) {
      if (n >= E.P && !borders && !(extra && extra.has(n))) continue;
      const p = scr(n);
      const d = Math.hypot(p[0] - sx, p[1] - sy);
      const lim = n < E.P ? Math.max(10, 19 * g) : Math.max(8, 12 * g);
      if (d < lim && d < bd) { bd = d; bn = n; }
    }
    if (bn != null) return { kind: 'node', n: bn };
    const [wx, wy] = toWorld(sx, sy);
    const RS = M.RS;
    const ix = Math.floor(wx * RS), iy = Math.floor(wy * RS);
    if (ix >= 0 && iy >= 0 && ix < M.MW && iy < M.MH) {
      const id = M.idx[iy * M.MW + ix];
      if (id < E.P) return { kind: 'prov', p: id };
    }
    return null;
  }

  // ───── 小さな全国図 ─────
  function drawMini(el, V, me) {
    if (!el || !layers.base) return;
    const w = el.width, h = el.height;
    if (mini.w !== w || mini.h !== h || !mini.base) {
      mini.base = mk(w, h); mini.w = w; mini.h = h; mini.dirty = true;
      const bx = mini.base.getContext('2d');
      bx.drawImage(layers.base, 0, 0, w, h);
    }
    if (mini.dirty && layers.terr) {
      mini.terr = mini.terr && mini.terr.width === w ? mini.terr : mk(w, h);
      const tx = mini.terr.getContext('2d');
      tx.clearRect(0, 0, w, h);
      tx.drawImage(mini.base, 0, 0);
      tx.globalCompositeOperation = 'multiply'; tx.globalAlpha = 0.8;
      tx.drawImage(layers.terr, 0, 0, w, h);
      tx.globalCompositeOperation = 'source-over'; tx.globalAlpha = 1;
      // 自分の領地を縁取り
      if (me && V) {
        tx.globalAlpha = 0.9; tx.globalCompositeOperation = 'lighter';
        for (let p = 0; p < E.P; p++) if (V.owner[p] === me) { const m = M.masks[p]; tx.drawImage(tinted(p, '#7a6a30'), m.x0 / M.MW * w, m.y0 / M.MH * h, m.w / M.MW * w, m.h / M.MH * h); }
        tx.globalAlpha = 1; tx.globalCompositeOperation = 'source-over';
      }
      mini.dirty = false;
    }
    const c = el.getContext('2d');
    c.clearRect(0, 0, w, h);
    if (mini.terr) c.drawImage(mini.terr, 0, 0);
    // 見えている範囲
    const [x0, y0] = toWorld(0, 0), [x1, y1] = toWorld(view.w, view.h);
    c.strokeStyle = '#ffe9a8'; c.lineWidth = 1.5;
    c.strokeRect(x0 / W * w, y0 / H * h, (x1 - x0) / W * w, (y1 - y0) / H * h);
  }
  function miniToWorld(el, mx, my) { return [mx / el.width * W, my / el.height * H]; }

  root.SG.R = {
    init, resize, draw, hitTest, toWorld, toScreen, onScreen, zoomAt, panBy, resetView, flyTo, fitBox, castleGlyph, armyToken, dieFace, roundRect, label,
    drawMini, miniToWorld, glyphScale, detail, camMoving, finishCam,
    COL, FONT_M, FONT_G, POS, W, H, get view() { return view; }, get zoom() { return zoom; }, markDirty() { terrDirty = true; mini.dirty = true; }, get M() { return M; },
  };
})(window);
