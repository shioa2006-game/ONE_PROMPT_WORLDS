/* 賽駆け — 描画（Canvas 2D） */
(function (root) {
  'use strict';
  const SG = root.SG;
  const D = SG.DATA, E = SG.E, MAP = SG.MAP;
  const W = MAP.W, H = MAP.H, POS = MAP.POS;
  const CL = {}; D.CLANS.forEach(c => { CL[c.id] = c; });

  const COL = {
    sea: '#3d6680', sea2: '#2f5670', wave: 'rgba(190,220,232,0.16)', shallow: 'rgba(160,205,215,0.55)',
    paper: '#ece2c6', paperDark: '#d9ccab', ink: '#2e2418', inkSoft: 'rgba(60,45,28,0.75)',
    road: 'rgba(92,70,40,0.78)', gold: '#f3c344', red: '#d63a2a',
  };
  const FONT_M = '"Yu Mincho","YuMincho","Hiragino Mincho ProN","Noto Serif JP","MS PMincho",serif';
  const FONT_G = '"Yu Gothic UI","Yu Gothic","Hiragino Sans","Meiryo",sans-serif';

  let cv, ctx, M, layers = {}, dpr = 1, view = { s: 1, ox: 0, oy: 0 };
  const tintCache = {};      // prov → { col, cv }
  let terrDirty = true, terrOwners = null;

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // ───── 初期化：静的レイヤを焼く ─────
  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    M = MAP.build(1.5);
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
    for (let i = 0; i < 70; i++) { // 繊維
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
    // 海
    const g = x.createLinearGradient(0, 0, 0, M.MH);
    g.addColorStop(0, '#355d78'); g.addColorStop(1, '#2c5068');
    x.fillStyle = g; x.fillRect(0, 0, M.MW, M.MH);
    x.save(); x.scale(RS, RS); x.fillStyle = wavePattern(x); x.fillRect(0, 0, W, H); x.restore();
    // 浅瀬のにじみ
    x.save();
    x.shadowColor = COL.shallow; x.shadowBlur = 26 * RS; x.fillStyle = COL.shallow;
    Object.values(M.isl).forEach(p => { pathPoly(x, p, RS); x.fill(); });
    x.restore();
    // 陸
    x.fillStyle = COL.paper;
    Object.values(M.isl).forEach(p => { pathPoly(x, p, RS); x.fill(); });
    // 紙の質感（陸だけ）
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
    // 山
    drawMountains(x, RS);
    // 湖
    x.fillStyle = '#4c7891'; pathPoly(x, M.lake, RS); x.fill();
    x.save(); pathPoly(x, M.lake, RS); x.clip(); x.scale(RS, RS); x.fillStyle = wavePattern(x); x.fillRect(0, 0, W, H); x.restore();
    layers.base = c;
  }

  function drawMountains(x, RS) {
    const rnd = MAP.mul(4242);
    const glyphs = [];
    const roadSegs = [];
    for (let i = E.P; i < E.N; i++) { const nd = E.nodes[i]; roadSegs.push([POS[nd.a], POS[i]], [POS[i], POS[nd.b]]); }
    const segDist = (px, py, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t);
    };
    D.PROV.forEach((p, pi) => {
      const w = D.MOUNTAIN[p.id] || 0.12;
      const m = M.masks[pi];
      const area = m.n / (RS * RS);
      const cnt = Math.round(w * area / 650);
      let tries = 0, placed = 0;
      while (placed < cnt && tries < cnt * 30) {
        tries++;
        const X = m.x0 + rnd() * m.w, Y = m.y0 + rnd() * m.h;
        const ii = Math.floor(Y) * M.MW + Math.floor(X);
        if (M.idx[ii] !== pi) continue;
        const wx = X / RS, wy = Y / RS;
        let ok = true;
        for (let n = 0; n < E.N && ok; n++) if (Math.hypot(POS[n][0] - wx, POS[n][1] - wy) < (n < E.P ? 34 : 16)) ok = false;
        for (const sg of roadSegs) { if (!ok) break; if (segDist(wx, wy, sg[0], sg[1]) < 9) ok = false; }
        for (const g of glyphs) { if (!ok) break; if (Math.hypot(g[0] - wx, g[1] - wy) < 13) ok = false; }
        if (!ok) continue;
        glyphs.push([wx, wy, 6 + rnd() * 5 * (0.6 + w)]);
        placed++;
      }
    });
    // 遊べない陸にも少し
    glyphs.sort((a, b) => a[1] - b[1]);
    x.save(); x.scale(RS, RS);
    for (const [gx, gy, s] of glyphs) {
      x.beginPath();
      x.moveTo(gx - s, gy); x.quadraticCurveTo(gx - s * 0.35, gy - s * 0.7, gx, gy - s * 1.05);
      x.quadraticCurveTo(gx + s * 0.4, gy - s * 0.6, gx + s, gy);
      x.closePath();
      x.fillStyle = 'rgba(150,132,96,0.35)'; x.fill();
      x.strokeStyle = 'rgba(88,72,48,0.7)'; x.lineWidth = 1.1; x.stroke();
      x.beginPath(); x.moveTo(gx, gy - s * 1.05); x.lineTo(gx + s * 0.15, gy - s * 0.35);
      x.strokeStyle = 'rgba(88,72,48,0.35)'; x.stroke();
    }
    x.restore();
    layers.mtn = glyphs;
  }

  function bakeSnow() {
    const RS = M.RS, c = mk(M.MW, M.MH), x = c.getContext('2d');
    x.scale(RS, RS);
    for (const [gx, gy, s] of layers.mtn) {
      if (gy > 600) continue;
      x.beginPath(); x.moveTo(gx - s * 0.7, gy - s * 0.35); x.quadraticCurveTo(gx - s * 0.3, gy - s * 0.75, gx, gy - s * 1.05);
      x.quadraticCurveTo(gx + s * 0.35, gy - s * 0.7, gx + s * 0.72, gy - s * 0.32); x.lineTo(gx + s * 0.3, gy - s * 0.45); x.lineTo(gx, gy - s * 0.3); x.lineTo(gx - s * 0.3, gy - s * 0.45); x.closePath();
      x.fillStyle = 'rgba(255,255,255,0.97)'; x.fill();
      x.strokeStyle = 'rgba(120,140,160,0.6)'; x.lineWidth = 0.6; x.stroke();
    }
    layers.snow = c;
    // 冬の霜（陸を青白く）
    const f = mk(M.MW, M.MH), fx = f.getContext('2d');
    const g = fx.createLinearGradient(0, 0, 0, M.MH);
    g.addColorStop(0, '#e8f2ff'); g.addColorStop(0.6, '#cfe0f0'); g.addColorStop(1, '#b8cde0');
    fx.fillStyle = g;
    Object.values(M.isl).forEach(p => { pathPoly(fx, p, RS); fx.fill(); });
    layers.frost = f;
  }

  function bakeOver() {
    const RS = M.RS, c = mk(M.MW, M.MH), x = c.getContext('2d');
    x.drawImage(M.borders, 0, 0);
    // 海岸線（墨）
    x.save(); x.scale(RS, RS);
    x.lineJoin = 'round';
    Object.values(M.isl).forEach(p => {
      pathPoly(x, p, 1); x.strokeStyle = 'rgba(40,30,20,0.85)'; x.lineWidth = 1.6; x.stroke();
    });
    pathPoly(x, M.lake, 1); x.strokeStyle = 'rgba(40,30,20,0.7)'; x.lineWidth = 1.1; x.stroke();
    // 街道
    for (let i = E.P; i < E.N; i++) {
      const nd = E.nodes[i];
      const a = POS[nd.a], m = POS[i], b = POS[nd.b];
      x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(m[0], m[1]); x.lineTo(b[0], b[1]);
      if (nd.t === 'S') { x.setLineDash([2, 5]); x.strokeStyle = 'rgba(235,240,230,0.85)'; x.lineWidth = 2; }
      else if (nd.t === 'P') { x.setLineDash([6, 4]); x.strokeStyle = COL.road; x.lineWidth = 2; }
      else { x.setLineDash([]); x.strokeStyle = COL.road; x.lineWidth = 2.2; }
      x.stroke();
    }
    x.setLineDash([]);
    // 遊べない地域の名前
    x.font = '600 15px ' + FONT_M; x.textAlign = 'center'; x.textBaseline = 'middle';
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
  }

  // 表示倍率：fit（全体が収まる倍率）× z、中心 (cx, cy) は世界座標
  let zoom = { z: 1, cx: W / 2, cy: H / 2 };
  function applyView() {
    const w = root.innerWidth, h = root.innerHeight;
    const fit = Math.min(w / W, h / H);
    const s = fit * zoom.z;
    // はみ出しすぎないように中心を制限
    const hw = w / s / 2, hh = h / s / 2;
    zoom.cx = Math.max(Math.min(hw, W / 2), Math.min(Math.max(W - hw, W / 2), zoom.cx));
    zoom.cy = Math.max(Math.min(hh, H / 2), Math.min(Math.max(H - hh, H / 2), zoom.cy));
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
    const [wx, wy] = toWorld(sx, sy);
    const nz = Math.max(1, Math.min(2.6, zoom.z * f));
    if (nz === zoom.z) return;
    // カーソルの下の点を動かさない
    const w = root.innerWidth, h = root.innerHeight;
    const s = Math.min(w / W, h / H) * nz;
    zoom.z = nz;
    zoom.cx = wx - (sx - w / 2) / s; zoom.cy = wy - (sy - h / 2) / s;
    applyView();
  }
  function panBy(dx, dy) { zoom.cx -= dx / view.s; zoom.cy -= dy / view.s; applyView(); }
  function resetView() { zoom = { z: 1, cx: W / 2, cy: H / 2 }; applyView(); }
  const toWorld = (sx, sy) => [(sx - view.ox) / view.s, (sy - view.oy) / view.s];
  const toScreen = (wx, wy) => [view.ox + wx * view.s, view.oy + wy * view.s];

  // ───── 部品 ─────
  function castleGlyph(x, cx, cy, roof, sz, dim) {
    const s = sz || 1;
    x.save(); x.translate(cx, cy); x.scale(s, s);
    // 石垣
    x.beginPath(); x.moveTo(-11, 7); x.lineTo(11, 7); x.lineTo(8.5, 1); x.lineTo(-8.5, 1); x.closePath();
    x.fillStyle = dim ? '#8b8270' : '#7d7466'; x.fill(); x.strokeStyle = COL.ink; x.lineWidth = 1; x.stroke();
    // 本体
    x.fillStyle = '#f6f1e4'; x.fillRect(-6.5, -6, 13, 7); x.strokeRect(-6.5, -6, 13, 7);
    x.fillStyle = COL.ink; x.fillRect(-3.5, -3.5, 2, 2); x.fillRect(1.5, -3.5, 2, 2);
    // 屋根
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
    if (o.scale) x.scale(o.scale, o.scale);
    if (o.alpha != null) x.globalAlpha = o.alpha;
    // 影
    x.fillStyle = 'rgba(0,0,0,0.28)'; x.beginPath(); x.ellipse(1.5, r - 1, r * 0.95, r * 0.38, 0, 0, Math.PI * 2); x.fill();
    // 幟（のぼり）
    x.fillStyle = '#3a2a1a'; x.fillRect(r * 0.55, -r - 15, 1.6, r + 8);
    x.fillStyle = c.col; x.strokeStyle = 'rgba(30,20,10,0.8)'; x.lineWidth = 0.8;
    const wv = o.t ? Math.sin(o.t * 6 + a.id) * 1.2 : 0;
    x.beginPath(); x.moveTo(r * 0.55 + 1.6, -r - 15); x.lineTo(r * 0.55 + 10, -r - 15 + wv); x.lineTo(r * 0.55 + 10, -r - 2 + wv); x.lineTo(r * 0.55 + 1.6, -r - 2); x.closePath(); x.fill(); x.stroke();
    // 本体
    x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2);
    x.fillStyle = c.col; x.fill();
    x.lineWidth = 2.2; x.strokeStyle = '#1c140c'; x.stroke();
    x.beginPath(); x.arc(0, 0, r - 3, 0, Math.PI * 2); x.lineWidth = 1.2; x.strokeStyle = 'rgba(255,250,235,0.85)'; x.stroke();
    x.fillStyle = '#fffaf0'; x.font = '700 14px ' + FONT_M; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(c.mon, 0, 1);
    // 兵数
    const tcol = a.t <= 3 ? '#b8281c' : '#1c140c';
    x.beginPath(); x.arc(r * 0.78, r * 0.62, 8, 0, Math.PI * 2); x.fillStyle = '#fbf6e8'; x.fill(); x.lineWidth = 1.5; x.strokeStyle = tcol; x.stroke();
    x.fillStyle = tcol; x.font = '700 11px ' + FONT_G; x.fillText(String(a.t), r * 0.78, r * 0.62 + 0.5);
    if (o.moved) {
      x.beginPath(); x.arc(0, 0, r + 1, 0, Math.PI * 2); x.fillStyle = 'rgba(236,226,198,0.45)'; x.fill();
    }
    if (o.die) {
      x.save(); x.translate(-r * 0.85, -r * 0.75);
      dieFace(x, o.die, 7);
      x.restore();
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
  function label(x, txt, px, py, font, fill, halo) {
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round';
    if (halo) { x.strokeStyle = halo; x.lineWidth = 3.5; x.strokeText(txt, px, py); }
    x.fillStyle = fill; x.fillText(txt, px, py);
  }

  // ───── 1フレーム描画 ─────
  // V: 表示用の状態, U: UIの状態（選択・ハイライト・演出）
  function draw(V, U, t) {
    if (!terrOwners || terrDirty || V.owner.some((o, i) => o !== terrOwners[i] && !(U.spread && U.spread[i]))) {
      const owners = V.owner.map((o, i) => (U.spread && U.spread[i] ? U.spread[i].from : o));
      rebuildTerritory(owners); terrDirty = false;
    }
    const x = ctx;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#2c5068'; x.fillRect(0, 0, cv.width, cv.height);
    const sh = U.shake ? U.shake : 0;
    const shx = sh ? (Math.random() - 0.5) * sh : 0, shy = sh ? (Math.random() - 0.5) * sh : 0;
    x.setTransform(view.s * dpr, 0, 0, view.s * dpr, (view.ox + shx) * dpr, (view.oy + shy) * dpr);
    x.imageSmoothingEnabled = true;
    x.drawImage(layers.base, 0, 0, W, H);
    // 勢力色
    x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.62;
    x.drawImage(layers.terr, 0, 0, W, H);
    // 塗り広げの演出
    if (U.spread) for (const k in U.spread) {
      const sp = U.spread[k], p = +k, m = M.masks[p];
      const k01 = Math.min(1, (t - sp.t0) / sp.dur);
      if (!sp.to) continue;
      const cx = POS[p][0], cy = POS[p][1];
      const rmax = Math.hypot(Math.max(Math.abs(m.x0 / M.RS - cx), Math.abs(m.x1 / M.RS - cx)), Math.max(Math.abs(m.y0 / M.RS - cy), Math.abs(m.y1 / M.RS - cy)));
      x.save();
      x.beginPath(); x.arc(cx, cy, rmax * easeOut(k01) + 1, 0, Math.PI * 2); x.clip();
      x.drawImage(tinted(p, CL[sp.to].col), m.x0 / M.RS, m.y0 / M.RS, m.w / M.RS, m.h / M.RS);
      x.restore();
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    if (U.winter) {
      x.globalAlpha = 0.95; x.drawImage(layers.snow, 0, 0, W, H);
      x.globalAlpha = 0.2; x.drawImage(layers.frost, 0, 0, W, H); x.globalAlpha = 1;
    }
    x.drawImage(layers.over, 0, 0, W, H);
    // 塗り広げの縁取り（光）
    if (U.spread) for (const k in U.spread) {
      const sp = U.spread[k], p = +k;
      const k01 = Math.min(1, (t - sp.t0) / sp.dur);
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
      x.strokeStyle = 'rgba(255,240,190,' + (0.8 * (1 - k01)) + ')'; x.lineWidth = 3; x.stroke();
    }

    // 範囲・経路のハイライト（ノードの下）
    drawHighlights(x, V, U, t);

    // 国境のマス
    for (let i = E.P; i < E.N; i++) {
      const nd = E.nodes[i], p = POS[i];
      if (nd.t === 'P') {
        x.beginPath(); x.moveTo(p[0] - 6, p[1] + 4); x.lineTo(p[0], p[1] - 5); x.lineTo(p[0] + 6, p[1] + 4); x.closePath();
        x.fillStyle = '#efe6cc'; x.fill(); x.strokeStyle = COL.ink; x.lineWidth = 1.3; x.stroke();
      } else if (nd.t === 'S') {
        x.beginPath(); x.arc(p[0], p[1], 5, 0, Math.PI * 2); x.fillStyle = '#d7e6ea'; x.fill(); x.strokeStyle = COL.ink; x.lineWidth = 1.2; x.stroke();
        x.beginPath(); x.moveTo(p[0] - 3, p[1]); x.quadraticCurveTo(p[0] - 1.5, p[1] - 2, p[0], p[1]); x.quadraticCurveTo(p[0] + 1.5, p[1] + 2, p[0] + 3, p[1]); x.stroke();
      } else {
        x.beginPath(); x.arc(p[0], p[1], 4, 0, Math.PI * 2); x.fillStyle = '#efe6cc'; x.fill(); x.strokeStyle = COL.ink; x.lineWidth = 1.3; x.stroke();
      }
    }
    // 城と国名
    const occ = {};
    for (const a of V.armies) occ[a.n] = 1;
    for (let p = 0; p < E.P; p++) {
      const q = POS[p];
      const held = occ[p] && !(U.armyPos && V.armies.some(a => a.n === p && U.armyPos[a.id]));
      const o = U.spread && U.spread[p] && (t - U.spread[p].t0) < U.spread[p].dur * 0.5 ? U.spread[p].from : V.owner[p];
      const roof = o ? CL[o].col : '#8a8170';
      const hl = U.castleHL && U.castleHL[p];
      if (hl) {
        const rr = 23 + Math.sin(t * 5) * 2;
        x.beginPath(); x.arc(q[0], q[1], rr, 0, Math.PI * 2); x.fillStyle = hl; x.fill();
        x.lineWidth = 3; x.strokeStyle = 'rgba(255,248,210,' + (0.6 + 0.3 * Math.sin(t * 5)) + ')'; x.stroke();
      }
      if (held) castleGlyph(x, q[0] - 13, q[1] - 12, roof, 0.8);
      else castleGlyph(x, q[0], q[1], roof, p === E.KYO ? 1.15 : 1);
      const pr = D.PROV[p];
      // 守備兵（軍勢が籠もっていれば出さない）
      if (!held) {
        const g = V.gar[p];
        x.beginPath(); x.arc(q[0] - 15, q[1] + 7, 7, 0, Math.PI * 2);
        x.fillStyle = o ? '#2a1d10' : '#6b6152'; x.fill();
        x.fillStyle = '#f6efdc'; x.font = '700 10px ' + FONT_G; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(String(g), q[0] - 15, q[1] + 7.5);
      }
      if (p === E.KYO) label(x, '京', q[0] + (held ? -24 : 15), q[1] - (held ? 18 : 7), '700 11px ' + FONT_M, '#a8201a', 'rgba(244,236,214,0.9)');
      if (U.danger && U.danger[p]) {
        const a = 0.6 + 0.4 * Math.sin(t * 7);
        const dx = held ? -20 : 15, dy = held ? 6 : 7;
        x.beginPath(); x.arc(q[0] + dx, q[1] + dy, 7.5, 0, Math.PI * 2); x.fillStyle = 'rgba(214,58,42,' + a + ')'; x.fill();
        label(x, '!', q[0] + dx, q[1] + dy + 0.5, '900 11px ' + FONT_G, '#fff', null);
      }
    }

    // 軍勢
    const drawn = U.armyPos || {};
    const sel = U.selArmy;
    const list = V.armies.slice().sort((a, b) => (POS[a.n][1] - POS[b.n][1]));
    for (const a of list) {
      if (U.hide && U.hide[a.id]) continue;
      const p = drawn[a.id] || POS[a.n];
      if (sel === a.id) {
        x.beginPath(); x.arc(p[0], p[1], 20 + Math.sin(t * 6) * 2, 0, Math.PI * 2);
        x.strokeStyle = COL.gold; x.lineWidth = 3; x.stroke();
        x.fillStyle = 'rgba(243,195,68,0.25)'; x.fill();
      } else if (U.canAct && U.canAct[a.id]) {
        x.beginPath(); x.arc(p[0], p[1], 18, 0, Math.PI * 2);
        x.strokeStyle = 'rgba(243,195,68,' + (0.45 + 0.35 * Math.sin(t * 4)) + ')'; x.lineWidth = 2; x.stroke();
      }
      armyToken(x, a, p[0], p[1] - (U.hop && U.hop[a.id] ? U.hop[a.id] : 0), { t, moved: U.moved && U.moved[a.id], die: U.armyDie && U.armyDie[a.id], scale: U.armyScale && U.armyScale[a.id] });
      if (U.armyHint && U.armyHint[a.id]) {
        const hv = U.armyHint[a.id];
        const k = hv.startsWith('kishu');
        const dv = hv.indexOf(':') > 0 ? hv.split(':')[1] : '';
        const txt = (k ? '奇' : '攻') + dv;
        const bx = p[0] - 18, by = p[1] - 21 - Math.abs(Math.sin(t * 4)) * 3;
        const w = dv ? 24 : 18;
        x.fillStyle = k ? '#ffcf3a' : '#e8452c';
        roundRect(x, bx - w / 2, by - 9, w, 18, 9); x.fill(); x.lineWidth = 1.5; x.strokeStyle = '#1c140c'; x.stroke();
        x.fillStyle = k ? '#3a1a00' : '#fff'; x.font = '800 11px ' + FONT_M; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(txt, bx, by + 0.5);
      }
      if (U.heal && U.heal[a.id]) {
        label(x, '+' + U.heal[a.id], p[0] - 2, p[1] + 26, '700 12px ' + FONT_G, '#1f7a3a', 'rgba(244,236,214,0.9)');
      }
    }
    // 国名（軍勢の上に描いて読めるように）
    for (let p = 0; p < E.P; p++) {
      const q = POS[p];
      label(x, D.PROV[p].n, q[0], q[1] + 27, '700 14px ' + FONT_M, '#2a1d10', 'rgba(244,236,214,0.92)');
    }
    // 冬の雪
    if (U.winter) {
      x.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 90; i++) {
        const sx = (i * 197.3 + Math.sin(t * 0.7 + i) * 18) % W;
        const sy = ((i * 89.7 + t * (14 + (i % 5) * 4)) % (H + 20)) - 10;
        x.beginPath(); x.arc(sx, sy, 1.2 + (i % 3) * 0.6, 0, Math.PI * 2); x.fill();
      }
    }
    // 演出
    if (U.fx) U.fx.forEach(f => f.draw && f.draw(x, t));
    // 攻撃先の勝率
    if (U.targets) for (const tg of U.targets) drawTargetBadge(x, tg, t);
  }

  function drawHighlights(x, V, U, t) {
    if (U.enemyReach) {
      for (const [n, k] of U.enemyReach) {
        const p = POS[n];
        x.beginPath(); x.arc(p[0], p[1], n < E.P ? 18 : 11, 0, Math.PI * 2);
        x.fillStyle = 'rgba(232,96,40,' + (0.3 + 0.35 * k) + ')'; x.fill();
        x.strokeStyle = 'rgba(120,30,10,0.85)'; x.lineWidth = 1.5; x.stroke();
      }
    }
    if (U.reach) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 5);
      for (const n of U.reach) {
        const p = POS[n];
        const r = n < E.P ? 17 : 11;
        x.beginPath(); x.arc(p[0], p[1], r + 3 + pulse * 2, 0, Math.PI * 2);
        x.strokeStyle = 'rgba(255,255,255,' + (0.55 + 0.35 * pulse) + ')'; x.lineWidth = 2.5; x.stroke();
        x.beginPath(); x.arc(p[0], p[1], r, 0, Math.PI * 2);
        x.fillStyle = 'rgba(120,220,255,0.55)'; x.fill();
        x.strokeStyle = '#0d3550'; x.lineWidth = 2; x.stroke();
      }
    }
    if (U.stage) {
      for (const n of U.stage) {
        const p = POS[n];
        x.beginPath(); x.arc(p[0], p[1], 15, 0, Math.PI * 2);
        x.setLineDash([4, 3]); x.strokeStyle = 'rgba(200,30,20,0.95)'; x.lineWidth = 2.2; x.stroke(); x.setLineDash([]);
        // 陣の旗
        x.fillStyle = '#3a2a1a'; x.fillRect(p[0] + 9, p[1] - 26, 1.6, 18);
        x.fillStyle = '#c8281c'; x.fillRect(p[0] + 10.6, p[1] - 26, 12, 11);
        x.fillStyle = '#fff6e0'; x.font = '700 9px ' + FONT_M; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText('陣', p[0] + 16.6, p[1] - 20);
      }
    }
    if (U.path && U.path.length > 1) {
      x.save();
      x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath();
      U.path.forEach((n, i) => { const p = POS[n]; if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); });
      x.strokeStyle = 'rgba(30,20,10,0.55)'; x.lineWidth = 7; x.stroke();
      x.setLineDash([8, 6]); x.lineDashOffset = -t * 30;
      x.strokeStyle = U.pathAttack ? '#ff6b4a' : '#ffd760'; x.lineWidth = 3.5; x.stroke();
      x.restore();
      // 歩数
      let acc = 0;
      for (let i = 1; i < U.path.length; i++) {
        acc += U.pathCost ? U.pathCost[i] : 1;
        const p = POS[U.path[i]];
        x.beginPath(); x.arc(p[0] + 11, p[1] - 11, 7.5, 0, Math.PI * 2); x.fillStyle = '#1c140c'; x.fill();
        x.fillStyle = '#ffe9a8'; x.font = '700 10px ' + FONT_G; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(String(acc), p[0] + 11, p[1] - 10.5);
      }
    }
  }

  function drawTargetBadge(x, tg, t) {
    const p = POS[tg.n];
    const pulse = 1 + 0.06 * Math.sin(t * 6);
    x.save(); x.translate(p[0], p[1]);
    x.beginPath(); x.arc(0, 0, 19 * pulse, 0, Math.PI * 2);
    const kc = tg.kishu && tg.p > 0;
    x.strokeStyle = kc ? '#ffcf3a' : '#e8452c'; x.lineWidth = 3; x.stroke();
    // 交差した槍
    x.strokeStyle = kc ? '#ffcf3a' : '#e8452c'; x.lineWidth = 2;
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

  function hitTest(sx, sy, V, preferArmy) {
    const [wx, wy] = toWorld(sx, sy);
    let best = null, bd = Infinity;
    for (const a of V.armies) {
      const p = POS[a.n];
      const d = Math.hypot(p[0] - wx, p[1] - wy);
      if (d < 18 && d < bd) { bd = d; best = { kind: 'army', id: a.id, n: a.n }; }
    }
    if (best && preferArmy !== false) return best;
    let bn = null; bd = Infinity;
    for (let n = 0; n < E.N; n++) {
      const p = POS[n];
      const d = Math.hypot(p[0] - wx, p[1] - wy);
      const lim = n < E.P ? 20 : 13;
      if (d < lim && d < bd) { bd = d; bn = n; }
    }
    if (bn != null) return { kind: 'node', n: bn };
    // 国の上
    const RS = M.RS;
    const ix = Math.floor(wx * RS), iy = Math.floor(wy * RS);
    if (ix >= 0 && iy >= 0 && ix < M.MW && iy < M.MH) {
      const id = M.idx[iy * M.MW + ix];
      if (id < E.P) return { kind: 'prov', p: id };
    }
    return null;
  }

  root.SG.R = {
    init, resize, draw, hitTest, toWorld, toScreen, zoomAt, panBy, resetView, castleGlyph, armyToken, dieFace, roundRect, label,
    COL, FONT_M, FONT_G, POS, get view() { return view; }, markDirty() { terrDirty = true; }, get M() { return M; },
  };
})(window);
