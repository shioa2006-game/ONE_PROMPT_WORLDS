/*
 * ぐるり、夜まつり ― 絵（すべて Canvas で その場で描く。外部の画像は使わない）
 * 玉・おじゃま・妖・ゆい・背景・小物
 */
(function (root) {
  'use strict';
  const FONT = '"BIZ UDPGothic","Yu Gothic UI","Yu Gothic","Meiryo","Hiragino Kaku Gothic ProN",sans-serif';
  const FONT_SOFT = '"UD デジタル 教科書体 NK-R","UD Digi Kyokasho NK-R","Hiragino Maru Gothic ProN","BIZ UDPGothic","Yu Gothic",sans-serif';
  const FONT_TITLE = '"Yu Mincho","YuMincho","Hiragino Mincho ProN","BIZ UDPMincho","MS PMincho",serif';
  const TAU = Math.PI * 2;

  const R = { FONT, FONT_SOFT, FONT_TITLE, k: 1, cache: {} };

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  R.rr = rr;
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  R.hash = hash;
  function mkCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * R.k); cv.height = Math.ceil(h * R.k);
    const c = cv.getContext('2d');
    c.scale(R.k, R.k);
    return { cv, c, w, h };
  }
  R.setScale = function (k) { if (Math.abs(k - R.k) > 0.01) { R.k = k; R.cache = {}; } };

  // ================================================================ 玉
  const TCOL = {
    H: { rim: '#ff6a55', bg0: '#3a1420', bg1: '#24101a' },
    D: { rim: '#86d46a', bg0: '#16301e', bg1: '#0f2016' },
    K: { rim: '#ffc94a', bg0: '#3a2a10', bg1: '#251a0a' },
    L: { rim: '#ffe7bd', bg0: '#3e2c22', bg1: '#2a1c16' }
  };
  R.TCOL = TCOL;

  function chip(c, s, col) {
    const r = s * 0.43;
    const g = c.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, col.bg0); g.addColorStop(1, col.bg1);
    rr(c, -r, -r, 2 * r, 2 * r, s * 0.16);
    c.fillStyle = g; c.fill();
    c.lineWidth = s * 0.035; c.strokeStyle = col.rim; c.globalAlpha = 0.55; c.stroke(); c.globalAlpha = 1;
    rr(c, -r + s * 0.04, -r + s * 0.04, 2 * r - s * 0.08, r * 0.7, s * 0.12);
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.fill();
  }

  function iconHanabi(c, s) {
    const r = s * 0.27;
    // 導火線
    c.strokeStyle = '#3a2418'; c.lineWidth = s * 0.035; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -r * 0.95); c.quadraticCurveTo(r * 0.25, -r * 1.35, r * 0.5, -r * 1.3); c.stroke();
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#ffb08a'); g.addColorStop(0.45, '#f2553f'); g.addColorStop(1, '#a21d24');
    circ(c, 0, 0, r); c.fillStyle = g; c.fill();
    // 玉の 紙の すじ
    c.strokeStyle = 'rgba(90,10,20,0.45)'; c.lineWidth = s * 0.018;
    for (const k of [-0.5, 0, 0.5]) { c.beginPath(); c.ellipse(0, 0, r * Math.abs(k) + r * 0.02, r, 0, -Math.PI / 2, Math.PI / 2, k < 0); c.stroke(); }
    c.beginPath(); c.ellipse(0, 0, r, r * 0.35, 0, 0, TAU); c.stroke();
    // 星
    c.fillStyle = 'rgba(255,240,200,0.9)';
    for (const [x, y] of [[-0.45, -0.1], [0.3, -0.45], [0.38, 0.32], [-0.2, 0.45]]) { circ(c, x * r, y * r, s * 0.022); c.fill(); }
    // 火花
    c.fillStyle = '#ffe27a';
    const fx = r * 0.5, fy = -r * 1.3;
    c.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8, rr2 = k % 2 ? s * 0.03 : s * 0.075; c.lineTo(fx + Math.cos(a) * rr2, fy + Math.sin(a) * rr2); }
    c.closePath(); c.fill();
  }
  function iconDango(c, s) {
    c.save(); c.rotate(-0.62);
    c.strokeStyle = '#c99a62'; c.lineWidth = s * 0.04; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, s * 0.36); c.lineTo(0, -s * 0.36); c.stroke();
    const cols = [['#a7dd84', '#5f9e45'], ['#fff6e6', '#cdb9a0'], ['#ffb2c6', '#d8738d']];
    for (let k = 0; k < 3; k++) {
      const y = s * (0.17 - k * 0.17);
      const g = c.createRadialGradient(-s * 0.04, y - s * 0.04, s * 0.01, 0, y, s * 0.11);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, cols[k][0]); g.addColorStop(1, cols[k][1]);
      circ(c, 0, y, s * 0.105); c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(60,30,20,0.35)'; c.lineWidth = s * 0.012; c.stroke();
    }
    c.restore();
  }
  function iconKoban(c, s) {
    const rx = s * 0.2, ry = s * 0.31;
    const g = c.createLinearGradient(-rx, -ry, rx, ry);
    g.addColorStop(0, '#fff2a8'); g.addColorStop(0.45, '#f4c23b'); g.addColorStop(1, '#a8741a');
    ell(c, 0, 0, rx, ry); c.fillStyle = g; c.fill();
    c.strokeStyle = '#7a4f10'; c.lineWidth = s * 0.018; c.stroke();
    ell(c, 0, 0, rx * 0.8, ry * 0.86); c.strokeStyle = 'rgba(122,79,16,0.55)'; c.stroke();
    c.strokeStyle = 'rgba(122,79,16,0.5)'; c.lineWidth = s * 0.012;
    for (let k = -3; k <= 3; k++) { if (Math.abs(k) <= 1) continue; const y = k * ry * 0.22, w = rx * 0.7 * Math.sqrt(1 - (y / ry) ** 2); c.beginPath(); c.moveTo(-w, y); c.lineTo(w, y); c.stroke(); }
    rr(c, -rx * 0.32, -ry * 0.22, rx * 0.64, ry * 0.44, s * 0.02); c.fillStyle = 'rgba(122,79,16,0.25)'; c.fill();
    ell(c, -rx * 0.35, -ry * 0.45, rx * 0.18, ry * 0.2, -0.4); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill();
  }
  function iconLantern(c, s, glow) {
    const w = s * 0.24, h = s * 0.32;
    if (glow) {
      const gg = c.createRadialGradient(0, 0, 0, 0, 0, s * 0.48);
      gg.addColorStop(0, 'rgba(255,200,120,0.55)'); gg.addColorStop(1, 'rgba(255,160,80,0)');
      c.fillStyle = gg; circ(c, 0, 0, s * 0.48); c.fill();
    }
    c.fillStyle = '#2a1c18';
    rr(c, -w * 0.55, -h - s * 0.05, w * 1.1, s * 0.08, s * 0.02); c.fill();
    rr(c, -w * 0.55, h - s * 0.03, w * 1.1, s * 0.08, s * 0.02); c.fill();
    const g = c.createRadialGradient(0, 0, s * 0.02, 0, 0, w * 1.2);
    g.addColorStop(0, '#fffaf0'); g.addColorStop(0.6, '#ffe2b0'); g.addColorStop(1, '#f2a860');
    c.beginPath();
    c.moveTo(-w * 0.55, -h);
    c.bezierCurveTo(-w * 1.25, -h * 0.6, -w * 1.25, h * 0.6, -w * 0.55, h);
    c.lineTo(w * 0.55, h);
    c.bezierCurveTo(w * 1.25, h * 0.6, w * 1.25, -h * 0.6, w * 0.55, -h);
    c.closePath(); c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(160,80,40,0.45)'; c.lineWidth = s * 0.012;
    for (let k = -3; k <= 3; k++) {
      const y = k * h * 0.27, ww = w * (1.05 - 0.45 * (k / 3.4) ** 2);
      c.beginPath(); c.moveTo(-ww, y); c.lineTo(ww, y); c.stroke();
    }
    circ(c, 0, 0, s * 0.075); c.fillStyle = '#d8372c'; c.fill();
  }

  R.tileSprite = function (t) {
    const key = 'tile_' + t;
    if (R.cache[key]) return R.cache[key];
    const S = 96;
    const o = mkCanvas(S, S);
    o.c.translate(S / 2, S / 2);
    const s = S * 0.94;
    chip(o.c, s, TCOL[t]);
    if (t === 'H') iconHanabi(o.c, s);
    else if (t === 'D') iconDango(o.c, s);
    else if (t === 'K') iconKoban(o.c, s);
    else iconLantern(o.c, s, true);
    R.cache[key] = o;
    return o;
  };
  // 玉を 描く（x,y は中心、size はマスの大きさ）
  R.drawTile = function (c, t, x, y, size, scale, alpha) {
    const o = R.tileSprite(t);
    const d = size * (scale == null ? 1 : scale);
    if (d <= 0.5) return;
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.drawImage(o.cv, x - d / 2, y - d / 2, d, d);
    c.globalAlpha = 1;
  };
  R.drawIcon = function (c, t, x, y, s) {
    c.save(); c.translate(x, y);
    if (t === 'H') iconHanabi(c, s); else if (t === 'D') iconDango(c, s); else if (t === 'K') iconKoban(c, s); else iconLantern(c, s, false);
    c.restore();
  };

  // ================================================================ おじゃま
  R.junkSprite = function (t) {
    const key = 'junk_' + t;
    if (R.cache[key]) return R.cache[key];
    const S = 96, o = mkCanvas(S, S), c = o.c, s = S * 0.94;
    c.translate(S / 2, S / 2);
    chip(c, s, { rim: '#6b6b78', bg0: '#26262e', bg1: '#18181e' });
    if (t === 'leaf') {
      c.save(); c.rotate(-0.5);
      c.beginPath(); c.moveTo(0, -s * 0.34);
      c.bezierCurveTo(s * 0.3, -s * 0.2, s * 0.24, s * 0.2, 0, s * 0.3);
      c.bezierCurveTo(-s * 0.24, s * 0.2, -s * 0.3, -s * 0.2, 0, -s * 0.34);
      const g = c.createLinearGradient(-s * 0.2, -s * 0.3, s * 0.2, s * 0.3);
      g.addColorStop(0, '#9ccf5a'); g.addColorStop(1, '#3f7a2e');
      c.fillStyle = g; c.fill();
      c.strokeStyle = '#2c5420'; c.lineWidth = s * 0.02;
      c.beginPath(); c.moveTo(0, -s * 0.3); c.lineTo(0, s * 0.38); c.stroke();
      for (const k of [-0.15, 0, 0.15]) { c.beginPath(); c.moveTo(0, k * s); c.lineTo(s * 0.13, k * s - s * 0.1); c.moveTo(0, k * s); c.lineTo(-s * 0.13, k * s - s * 0.1); c.stroke(); }
      c.restore();
    } else if (t === 'azuki') {
      for (let k = 0; k < 13; k++) {
        const a = hash(k + 3) * TAU, r = Math.sqrt(hash(k + 11)) * s * 0.24;
        const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.7 + s * 0.05;
        ell(c, x, y, s * 0.06, s * 0.045, a);
        c.fillStyle = k % 3 ? '#8a1f2a' : '#a8323a'; c.fill();
        ell(c, x - s * 0.015, y - s * 0.012, s * 0.016, s * 0.01, a); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill();
      }
    } else if (t === 'bubble') {
      circ(c, 0, 0, s * 0.3);
      const g = c.createRadialGradient(-s * 0.1, -s * 0.12, s * 0.02, 0, 0, s * 0.3);
      g.addColorStop(0, 'rgba(255,255,255,0.65)'); g.addColorStop(0.5, 'rgba(160,220,255,0.18)'); g.addColorStop(1, 'rgba(120,200,255,0.45)');
      c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(200,240,255,0.8)'; c.lineWidth = s * 0.02; c.stroke();
      ell(c, -s * 0.12, -s * 0.13, s * 0.07, s * 0.04, -0.6); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fill();
    } else {
      c.beginPath();
      const pts = [[-0.3, 0.12], [-0.22, -0.18], [0.02, -0.3], [0.26, -0.16], [0.32, 0.12], [0.12, 0.27], [-0.18, 0.26]];
      pts.forEach(([x, y], k) => k ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s));
      c.closePath();
      const g = c.createLinearGradient(0, -s * 0.3, 0, s * 0.3);
      g.addColorStop(0, '#a4a4ae'); g.addColorStop(1, '#5a5a66');
      c.fillStyle = g; c.fill(); c.strokeStyle = '#33333c'; c.lineWidth = s * 0.02; c.stroke();
      c.beginPath(); c.moveTo(-s * 0.05, -s * 0.2); c.lineTo(s * 0.02, -s * 0.02); c.lineTo(-s * 0.06, s * 0.12); c.stroke();
    }
    R.cache[key] = o;
    return o;
  };
  R.drawJunk = function (c, t, x, y, size, scale, alpha) {
    const o = R.junkSprite(t), d = size * (scale == null ? 1 : scale);
    if (d <= 0.5) return;
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.drawImage(o.cv, x - d / 2, y - d / 2, d, d);
    c.globalAlpha = 1;
  };

  // ================================================================ 妖
  function eyes(c, x, y, gap, r, o) {
    o = o || {};
    const blink = o.blink;
    for (const sx of [-1, 1]) {
      const ex = x + sx * gap;
      if (blink || o.happy) {
        c.strokeStyle = o.ink || '#1a1016'; c.lineWidth = r * 0.45; c.lineCap = 'round';
        c.beginPath();
        if (o.happy) c.arc(ex, y + r * 0.3, r * 0.75, Math.PI * 1.15, Math.PI * 1.85);
        else { c.moveTo(ex - r * 0.8, y); c.lineTo(ex + r * 0.8, y); }
        c.stroke();
        continue;
      }
      circ(c, ex, y, r); c.fillStyle = o.white || '#fff'; c.fill();
      circ(c, ex + (o.lx || 0) * r * 0.3, y + (o.ly || 0) * r * 0.3, r * 0.62); c.fillStyle = o.ink || '#1a1016'; c.fill();
      circ(c, ex + (o.lx || 0) * r * 0.3 - r * 0.22, y - r * 0.25, r * 0.22); c.fillStyle = '#fff'; c.fill();
    }
  }
  function cheeks(c, x, y, gap, r, col) {
    c.fillStyle = col || 'rgba(255,120,140,0.45)';
    for (const sx of [-1, 1]) { ell(c, x + sx * gap, y, r, r * 0.6); c.fill(); }
  }
  function mouth(c, x, y, w, kind, col) {
    c.strokeStyle = col || '#2a1416'; c.lineWidth = Math.max(1, w * 0.18); c.lineCap = 'round';
    c.beginPath();
    if (kind === 'o') { ell(c, x, y, w * 0.32, w * 0.4); c.fillStyle = '#5a1a22'; c.fill(); return; }
    if (kind === 'grin') { c.moveTo(x - w * 0.5, y); c.quadraticCurveTo(x, y + w * 0.6, x + w * 0.5, y); c.stroke(); return; }
    if (kind === 'w') { c.moveTo(x - w * 0.5, y); c.quadraticCurveTo(x - w * 0.25, y + w * 0.35, x, y); c.quadraticCurveTo(x + w * 0.25, y + w * 0.35, x + w * 0.5, y); c.stroke(); return; }
    c.moveTo(x - w * 0.35, y); c.quadraticCurveTo(x, y + w * 0.3, x + w * 0.35, y); c.stroke();
  }
  function shade(c, x, y, r, top, bot) {
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.15);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    return g;
  }

  // 各妖の描き方。s は 目安の大きさ（マス）。原点は 足もとより少し上の中心
  const Y = {};
  Y.mame = function (c, s, t, o) {
    const r = s * 0.3;
    // しっぽ
    c.fillStyle = '#7a5232';
    ell(c, r * 0.95, r * 0.55, r * 0.35, r * 0.55, -0.8); c.fill();
    c.fillStyle = '#3a2618'; ell(c, r * 1.12, r * 0.25, r * 0.16, r * 0.18, -0.8); c.fill();
    // 耳
    c.fillStyle = '#5a3a22';
    circ(c, -r * 0.62, -r * 0.78, r * 0.28); c.fill(); circ(c, r * 0.62, -r * 0.78, r * 0.28); c.fill();
    c.fillStyle = shade(c, 0, 0, r, '#c8945e', '#7d5634');
    ell(c, 0, 0, r * 1.02, r * 0.95); c.fill();
    c.fillStyle = '#f2dcb8'; ell(c, 0, r * 0.42, r * 0.55, r * 0.45); c.fill();
    // 目のまわりの くま
    c.fillStyle = '#3a2618';
    ell(c, -r * 0.36, -r * 0.12, r * 0.3, r * 0.22, 0.3); c.fill(); ell(c, r * 0.36, -r * 0.12, r * 0.3, r * 0.22, -0.3); c.fill();
    eyes(c, 0, -r * 0.12, r * 0.36, r * 0.15, o);
    c.fillStyle = '#2a1810'; ell(c, 0, r * 0.1, r * 0.1, r * 0.07); c.fill();
    mouth(c, 0, r * 0.2, r * 0.3, o.mouth || 'w');
    // 頭の葉っぱ
    c.save(); c.translate(r * 0.1, -r * 0.95); c.rotate(0.4 + Math.sin(t * 2) * 0.08);
    c.fillStyle = '#7cc05a'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(r * 0.35, -r * 0.2, 0, -r * 0.55); c.quadraticCurveTo(-r * 0.35, -r * 0.2, 0, 0); c.fill();
    c.restore();
  };
  Y.kooni = function (c, s, t, o) {
    const r = s * 0.3;
    // 角
    c.fillStyle = '#fff3d6';
    for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * r * 0.32, -r * 0.8); c.lineTo(sx * r * 0.62, -r * 1.35); c.lineTo(sx * r * 0.72, -r * 0.72); c.closePath(); c.fill(); }
    c.fillStyle = shade(c, 0, 0, r, '#ff8a7a', '#c0303a');
    ell(c, 0, 0, r, r * 0.98); c.fill();
    // 髪
    c.fillStyle = '#2a1a22';
    c.beginPath(); c.moveTo(-r * 0.9, -r * 0.35);
    for (let k = 0; k <= 6; k++) { const x = -r * 0.9 + k * r * 0.3; c.lineTo(x, -r * (k % 2 ? 0.55 : 0.95)); }
    c.lineTo(r * 0.9, -r * 0.35); c.quadraticCurveTo(0, -r * 1.25, -r * 0.9, -r * 0.35); c.fill();
    eyes(c, 0, -r * 0.05, r * 0.36, r * 0.17, o);
    cheeks(c, 0, r * 0.25, r * 0.55, r * 0.14);
    mouth(c, 0, r * 0.35, r * 0.4, o.mouth || 'grin');
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(r * 0.08, r * 0.38); c.lineTo(r * 0.16, r * 0.52); c.lineTo(r * 0.22, r * 0.36); c.fill();
    // とらがら の こしまき
    c.fillStyle = '#ffcf3a'; rr(c, -r * 0.7, r * 0.62, r * 1.4, r * 0.32, r * 0.12); c.fill();
    c.fillStyle = '#2a1a22'; for (let k = -2; k <= 2; k++) { c.fillRect(k * r * 0.26 - r * 0.04, r * 0.64, r * 0.08, r * 0.28); }
  };
  Y.zashiki = function (c, s, t, o) {
    const r = s * 0.3;
    // きもの
    c.fillStyle = '#d8304a';
    c.beginPath(); c.moveTo(-r * 0.75, r * 1.0); c.quadraticCurveTo(-r * 0.7, r * 0.1, 0, r * 0.15); c.quadraticCurveTo(r * 0.7, r * 0.1, r * 0.75, r * 1.0); c.closePath(); c.fill();
    c.strokeStyle = '#ffd9a0'; c.lineWidth = r * 0.06;
    c.beginPath(); c.moveTo(-r * 0.25, r * 0.2); c.lineTo(0, r * 0.55); c.lineTo(r * 0.25, r * 0.2); c.stroke();
    c.fillStyle = '#ffd36a'; rr(c, -r * 0.55, r * 0.55, r * 1.1, r * 0.16, r * 0.04); c.fill();
    // かお
    c.fillStyle = shade(c, 0, -r * 0.25, r * 0.7, '#fff3e6', '#f2cdb4');
    circ(c, 0, -r * 0.25, r * 0.62); c.fill();
    // おかっぱ
    c.fillStyle = '#16101a';
    c.beginPath(); c.arc(0, -r * 0.3, r * 0.72, Math.PI, 0); c.lineTo(r * 0.72, r * 0.05); c.lineTo(r * 0.5, r * 0.05); c.lineTo(r * 0.5, -r * 0.42);
    c.lineTo(-r * 0.5, -r * 0.42); c.lineTo(-r * 0.5, r * 0.05); c.lineTo(-r * 0.72, r * 0.05); c.closePath(); c.fill();
    eyes(c, 0, -r * 0.2, r * 0.24, r * 0.1, Object.assign({}, o, { happy: o.happy !== false && !o.blink }));
    cheeks(c, 0, -r * 0.05, r * 0.34, r * 0.1, 'rgba(255,110,130,0.6)');
    mouth(c, 0, r * 0.03, r * 0.18, 'smile');
  };
  Y.kasa = function (c, s, t, o) {
    const r = s * 0.32;
    // 一本足
    c.strokeStyle = '#e8cfa0'; c.lineWidth = r * 0.14; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, r * 0.5); c.lineTo(0, r * 1.0); c.stroke();
    c.fillStyle = '#e8cfa0'; ell(c, r * 0.12, r * 1.02, r * 0.2, r * 0.08); c.fill();
    // かさ
    const g = c.createLinearGradient(-r, 0, r, 0);
    g.addColorStop(0, '#7a2a3a'); g.addColorStop(0.5, '#c8485a'); g.addColorStop(1, '#7a2a3a');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, -r * 1.2); c.quadraticCurveTo(r * 0.6, -r * 0.4, r * 0.95, r * 0.55);
    c.lineTo(-r * 0.95, r * 0.55); c.quadraticCurveTo(-r * 0.6, -r * 0.4, 0, -r * 1.2); c.fill();
    c.strokeStyle = 'rgba(40,10,20,0.5)'; c.lineWidth = r * 0.04;
    for (const k of [-0.6, -0.2, 0.2, 0.6]) { c.beginPath(); c.moveTo(0, -r * 1.15); c.lineTo(k * r * 1.05, r * 0.55); c.stroke(); }
    c.fillStyle = '#3a1a20'; c.fillRect(-r * 0.06, -r * 1.42, r * 0.12, r * 0.25);
    // ひとつ目
    const blink = o.blink;
    if (blink) { c.strokeStyle = '#1a0c10'; c.lineWidth = r * 0.08; c.beginPath(); c.moveTo(-r * 0.22, -r * 0.2); c.lineTo(r * 0.22, -r * 0.2); c.stroke(); }
    else {
      circ(c, 0, -r * 0.2, r * 0.27); c.fillStyle = '#fff'; c.fill();
      circ(c, (o.lx || 0) * r * 0.08, -r * 0.2, r * 0.16); c.fillStyle = '#1a0c10'; c.fill();
      circ(c, -r * 0.06, -r * 0.27, r * 0.06); c.fillStyle = '#fff'; c.fill();
    }
    // べろ
    c.fillStyle = '#ff7a8a';
    c.beginPath(); c.moveTo(-r * 0.12, r * 0.22); c.quadraticCurveTo(-r * 0.12, r * 0.62, r * 0.05, r * 0.6); c.quadraticCurveTo(r * 0.16, r * 0.55, r * 0.12, r * 0.22); c.fill();
    c.strokeStyle = '#3a1016'; c.lineWidth = r * 0.06; c.beginPath(); c.moveTo(-r * 0.25, r * 0.2); c.quadraticCurveTo(0, r * 0.32, r * 0.25, r * 0.2); c.stroke();
  };
  Y.takenoko = function (c, s, t, o) {
    const r = s * 0.3 * (o.grow || 1);
    c.fillStyle = shade(c, 0, 0, r, '#e9c88a', '#9a6a36');
    c.beginPath(); c.moveTo(0, -r * 1.35); c.quadraticCurveTo(r * 0.95, -r * 0.1, r * 0.85, r * 0.8);
    c.lineTo(-r * 0.85, r * 0.8); c.quadraticCurveTo(-r * 0.95, -r * 0.1, 0, -r * 1.35); c.fill();
    // かわ
    c.fillStyle = '#7a4a22';
    for (let k = 0; k < 3; k++) {
      const y = -r * 0.6 + k * r * 0.48;
      c.beginPath(); c.moveTo(-r * 0.8, y + r * 0.42); c.quadraticCurveTo(-r * 0.2, y + r * 0.12, r * (0.25 + k * 0.1), y - r * 0.1);
      c.quadraticCurveTo(-r * 0.05, y + r * 0.32, -r * 0.8, y + r * 0.42); c.fill();
    }
    c.fillStyle = '#9ccf5a'; c.beginPath(); c.moveTo(0, -r * 1.35); c.lineTo(r * 0.12, -r * 1.05); c.lineTo(-r * 0.1, -r * 1.05); c.fill();
    eyes(c, 0, r * 0.12, r * 0.3, r * 0.13, o);
    mouth(c, 0, r * 0.42, r * 0.3, o.mouth || 'o');
  };
  Y.kamaitachi = function (c, s, t, o) {
    const r = s * 0.3;
    // つむじ風
    c.strokeStyle = 'rgba(200,240,255,0.55)'; c.lineWidth = r * 0.08; c.lineCap = 'round';
    for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(0, r * 0.2, r * (1.05 + k * 0.12), t * 4 + k * 2, t * 4 + k * 2 + 1.6); c.stroke(); }
    // しっぽ
    c.fillStyle = '#f2ece2';
    c.beginPath(); c.moveTo(r * 0.5, r * 0.4); c.quadraticCurveTo(r * 1.4, r * 0.1, r * 1.05, -r * 0.75); c.quadraticCurveTo(r * 0.9, r * 0.0, r * 0.3, r * 0.15); c.fill();
    c.fillStyle = shade(c, 0, 0, r, '#ffffff', '#cfc6bb');
    ell(c, 0, r * 0.15, r * 0.8, r * 0.75); c.fill();
    c.fillStyle = '#e8ded2';
    for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * r * 0.3, -r * 0.45); c.lineTo(sx * r * 0.62, -r * 0.82); c.lineTo(sx * r * 0.72, -r * 0.35); c.fill(); }
    eyes(c, 0, -r * 0.02, r * 0.3, r * 0.13, o);
    c.fillStyle = '#ff9aa8'; ell(c, 0, r * 0.18, r * 0.08, r * 0.06); c.fill();
    // かまの 手
    c.strokeStyle = '#b8d8e8'; c.lineWidth = r * 0.1;
    for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * r * 0.85, r * 0.45, r * 0.35, sx > 0 ? -1.9 : -Math.PI + 0.2, sx > 0 ? -0.2 : -Math.PI + 1.9); c.stroke(); }
  };
  Y.kappa = function (c, s, t, o) {
    const r = s * 0.3;
    // こうら
    c.fillStyle = '#4a6a2a'; ell(c, 0, r * 0.45, r * 0.85, r * 0.55); c.fill();
    c.fillStyle = shade(c, 0, 0, r, '#9be07a', '#3f8a44');
    ell(c, 0, 0, r * 0.95, r * 0.9); c.fill();
    // 髪
    c.fillStyle = '#2a5a30';
    c.beginPath();
    for (let k = 0; k <= 10; k++) { const a = Math.PI + k * Math.PI / 10; const rr2 = r * (k % 2 ? 0.98 : 1.12); c.lineTo(Math.cos(a) * rr2, -r * 0.25 + Math.sin(a) * rr2 * 0.75); }
    c.closePath(); c.fill();
    // お皿
    c.fillStyle = '#eaf6ff'; ell(c, 0, -r * 0.82, r * 0.42, r * 0.16); c.fill();
    c.strokeStyle = '#9ab8c8'; c.lineWidth = r * 0.05; c.stroke();
    eyes(c, 0, -r * 0.05, r * 0.36, r * 0.15, o);
    // くちばし
    c.fillStyle = '#ffc84a';
    c.beginPath(); c.moveTo(-r * 0.3, r * 0.28); c.quadraticCurveTo(0, r * 0.12, r * 0.3, r * 0.28); c.quadraticCurveTo(0, r * 0.55, -r * 0.3, r * 0.28); c.fill();
    c.strokeStyle = '#a8761a'; c.lineWidth = r * 0.04; c.beginPath(); c.moveTo(-r * 0.28, r * 0.3); c.lineTo(r * 0.28, r * 0.3); c.stroke();
  };
  Y.azuki = function (c, s, t, o) {
    const r = s * 0.3;
    // ざる
    c.fillStyle = '#c99a5a'; ell(c, 0, r * 0.75, r * 0.85, r * 0.28); c.fill();
    c.strokeStyle = '#8a6030'; c.lineWidth = r * 0.04;
    for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(k * r * 0.22, r * 0.52); c.lineTo(k * r * 0.25, r * 0.98); c.stroke(); }
    c.fillStyle = '#8a1f2a';
    for (let k = 0; k < 7; k++) { circ(c, (k - 3) * r * 0.18, r * 0.58 + hash(k) * r * 0.06, r * 0.08); c.fill(); }
    // からだ（ずきん）
    c.fillStyle = shade(c, 0, 0, r, '#b8c4d8', '#5a6a8a');
    c.beginPath(); c.moveTo(-r * 0.8, r * 0.55); c.quadraticCurveTo(-r * 0.95, -r * 0.6, 0, -r * 0.95); c.quadraticCurveTo(r * 0.95, -r * 0.6, r * 0.8, r * 0.55); c.closePath(); c.fill();
    c.fillStyle = shade(c, 0, -r * 0.1, r * 0.5, '#fff0dc', '#e2bc98');
    ell(c, 0, -r * 0.1, r * 0.5, r * 0.45); c.fill();
    eyes(c, 0, -r * 0.18, r * 0.22, r * 0.1, Object.assign({}, o, { happy: !o.blink && (t % 3 < 1.6) }));
    mouth(c, 0, r * 0.08, r * 0.24, 'w');
    c.fillStyle = 'rgba(255,120,140,0.5)'; ell(c, -r * 0.3, r * 0.0, r * 0.08, r * 0.05); c.fill(); ell(c, r * 0.3, r * 0.0, r * 0.08, r * 0.05); c.fill();
  };
  Y.ryu = function (c, s, t, o) {
    const r = s * 0.3;
    // からだ
    c.strokeStyle = '#3aa8b8'; c.lineWidth = r * 0.42; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-r * 0.2, r * 0.1); c.bezierCurveTo(-r * 1.2, r * 0.4, -r * 0.6, r * 1.1, r * 0.3, r * 0.8); c.quadraticCurveTo(r * 1.0, r * 0.6, r * 0.9, r * 0.1); c.stroke();
    c.strokeStyle = '#bff2e8'; c.lineWidth = r * 0.12;
    c.beginPath(); c.moveTo(-r * 0.6, r * 0.65); c.quadraticCurveTo(-r * 0.2, r * 0.95, r * 0.3, r * 0.78); c.stroke();
    // あたま
    c.fillStyle = shade(c, 0, -r * 0.2, r * 0.7, '#8ff0e8', '#2a8a9a');
    ell(c, 0, -r * 0.25, r * 0.62, r * 0.52); c.fill();
    c.fillStyle = '#6ad6c8'; ell(c, r * 0.35, -r * 0.1, r * 0.35, r * 0.25); c.fill();
    // つの
    c.strokeStyle = '#ffe6a0'; c.lineWidth = r * 0.08;
    for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * r * 0.2, -r * 0.7); c.lineTo(sx * r * 0.35, -r * 1.05); c.lineTo(sx * r * 0.5, -r * 0.98); c.stroke(); }
    // ひげ
    c.strokeStyle = 'rgba(255,240,200,0.8)'; c.lineWidth = r * 0.04;
    c.beginPath(); c.moveTo(r * 0.55, -r * 0.05); c.quadraticCurveTo(r * 1.0, -r * 0.1 + Math.sin(t * 3) * r * 0.1, r * 1.1, r * 0.2); c.stroke();
    eyes(c, -r * 0.05, -r * 0.3, r * 0.22, r * 0.12, o);
  };
  Y.onibi = function (c, s, t, o) {
    const r = s * 0.32;
    const fl = (k) => Math.sin(t * 7 + k) * r * 0.08;
    const g = c.createRadialGradient(0, r * 0.2, r * 0.1, 0, 0, r * 1.3);
    g.addColorStop(0, 'rgba(120,220,255,0.5)'); g.addColorStop(1, 'rgba(60,120,255,0)');
    c.fillStyle = g; circ(c, 0, 0, r * 1.3); c.fill();
    c.fillStyle = shade(c, 0, r * 0.2, r, '#e8fbff', '#3a8cff');
    c.beginPath(); c.moveTo(0, -r * 1.25 + fl(1));
    c.bezierCurveTo(r * 0.45, -r * 0.7 + fl(2), r * 0.95, -r * 0.1, r * 0.8, r * 0.4);
    c.bezierCurveTo(r * 0.6, r * 0.95, -r * 0.6, r * 0.95, -r * 0.8, r * 0.4);
    c.bezierCurveTo(-r * 0.95, -r * 0.2, -r * 0.3, -r * 0.5 + fl(3), 0, -r * 1.25 + fl(1));
    c.fill();
    eyes(c, 0, r * 0.2, r * 0.28, r * 0.13, Object.assign({ ink: '#0a2a5a' }, o));
    mouth(c, 0, r * 0.48, r * 0.22, 'o');
  };
  Y.chochin = function (c, s, t, o) {
    const r = s * 0.32;
    c.save(); c.rotate(Math.sin(t * 2) * 0.06);
    c.fillStyle = '#2a1c18'; rr(c, -r * 0.45, -r * 1.05, r * 0.9, r * 0.18, r * 0.05); c.fill(); rr(c, -r * 0.45, r * 0.85, r * 0.9, r * 0.18, r * 0.05); c.fill();
    const g = c.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, '#fff6dc'); g.addColorStop(0.7, '#ffcf8a'); g.addColorStop(1, '#e88a4a');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-r * 0.45, -r * 0.9); c.bezierCurveTo(-r * 1.05, -r * 0.5, -r * 1.05, r * 0.5, -r * 0.45, r * 0.88);
    c.lineTo(r * 0.45, r * 0.88); c.bezierCurveTo(r * 1.05, r * 0.5, r * 1.05, -r * 0.5, r * 0.45, -r * 0.9); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(150,70,30,0.5)'; c.lineWidth = r * 0.04;
    for (let k = -3; k <= 3; k++) { const y = k * r * 0.24, w = r * (0.92 - 0.42 * (k / 3.4) ** 2); c.beginPath(); c.moveTo(-w, y); c.lineTo(w, y); c.stroke(); }
    // やぶれ
    c.fillStyle = '#3a2418'; c.beginPath(); c.moveTo(r * 0.35, -r * 0.5); c.lineTo(r * 0.62, -r * 0.42); c.lineTo(r * 0.5, -r * 0.2); c.lineTo(r * 0.68, -r * 0.05); c.lineTo(r * 0.4, -r * 0.1); c.closePath(); c.fill();
    // ひとつ目と べろ
    if (o.blink) { c.strokeStyle = '#1a0c10'; c.lineWidth = r * 0.08; c.beginPath(); c.moveTo(-r * 0.4, -r * 0.2); c.lineTo(-r * 0.05, -r * 0.2); c.stroke(); }
    else { circ(c, -r * 0.22, -r * 0.2, r * 0.22); c.fillStyle = '#fff'; c.fill(); circ(c, -r * 0.2, -r * 0.18, r * 0.12); c.fillStyle = '#1a0c10'; c.fill(); }
    c.fillStyle = '#ff6a7a';
    c.beginPath(); c.moveTo(-r * 0.15, r * 0.3); c.quadraticCurveTo(-r * 0.05, r * 1.0, r * 0.18, r * 0.75); c.quadraticCurveTo(r * 0.2, r * 0.45, r * 0.18, r * 0.3); c.fill();
    c.strokeStyle = '#3a1016'; c.lineWidth = r * 0.06; c.beginPath(); c.moveTo(-r * 0.35, r * 0.3); c.lineTo(r * 0.35, r * 0.3); c.stroke();
    c.restore();
  };
  Y.kitsune = function (c, s, t, o) {
    const r = s * 0.3;
    // しっぽ
    c.fillStyle = '#f2a050';
    c.beginPath(); c.moveTo(r * 0.4, r * 0.6); c.bezierCurveTo(r * 1.4, r * 0.7, r * 1.4, -r * 0.4, r * 0.95, -r * 0.6); c.bezierCurveTo(r * 0.9, r * 0.0, r * 0.6, r * 0.3, r * 0.3, r * 0.3); c.fill();
    c.fillStyle = '#fff6ea'; ell(c, r * 1.0, -r * 0.48, r * 0.16, r * 0.2, 0.4); c.fill();
    // 耳
    for (const sx of [-1, 1]) {
      c.fillStyle = '#f2a050'; c.beginPath(); c.moveTo(sx * r * 0.2, -r * 0.55); c.lineTo(sx * r * 0.62, -r * 1.15); c.lineTo(sx * r * 0.82, -r * 0.35); c.fill();
      c.fillStyle = '#5a2a18'; c.beginPath(); c.moveTo(sx * r * 0.4, -r * 0.6); c.lineTo(sx * r * 0.62, -r * 0.98); c.lineTo(sx * r * 0.7, -r * 0.5); c.fill();
    }
    c.fillStyle = shade(c, 0, 0, r, '#ffc888', '#e07a30');
    ell(c, 0, 0, r * 0.88, r * 0.78); c.fill();
    c.fillStyle = '#fff6ea'; ell(c, 0, r * 0.32, r * 0.55, r * 0.38); c.fill();
    eyes(c, 0, -r * 0.08, r * 0.32, r * 0.12, Object.assign({}, o, { happy: !o.blink }));
    c.fillStyle = '#2a1410'; ell(c, 0, r * 0.18, r * 0.07, r * 0.05); c.fill();
    // 赤い まえかけ
    c.fillStyle = '#d8302a'; c.beginPath(); c.moveTo(-r * 0.5, r * 0.6); c.lineTo(r * 0.5, r * 0.6); c.lineTo(0, r * 0.98); c.closePath(); c.fill();
    c.fillStyle = '#ffd36a'; circ(c, 0, r * 0.66, r * 0.07); c.fill();
  };

  // ---- ぬし（大きい。s は 高さの目安）
  Y.danuki = function (c, s, t, o) {
    const r = s * 0.3;
    // しっぽ
    c.fillStyle = '#6a4428'; ell(c, r * 1.05, r * 0.5, r * 0.4, r * 0.65, -0.7); c.fill();
    c.fillStyle = '#2e1e14'; ell(c, r * 1.3, r * 0.1, r * 0.2, r * 0.22, -0.7); c.fill();
    // からだ
    c.fillStyle = shade(c, 0, r * 0.3, r, '#b8865a', '#6a4428');
    ell(c, 0, r * 0.35, r * 0.95, r * 0.85); c.fill();
    c.fillStyle = '#f2dcb8'; ell(c, 0, r * 0.5, r * 0.62, r * 0.6); c.fill();
    c.strokeStyle = 'rgba(160,110,70,0.5)'; c.lineWidth = r * 0.03; ell(c, 0, r * 0.5, r * 0.62, r * 0.6); c.stroke();
    // かお
    c.fillStyle = '#4e321e'; circ(c, -r * 0.45, -r * 0.82, r * 0.18); c.fill(); circ(c, r * 0.45, -r * 0.82, r * 0.18); c.fill();
    c.fillStyle = shade(c, 0, -r * 0.45, r * 0.6, '#c8945e', '#7d5634');
    ell(c, 0, -r * 0.45, r * 0.62, r * 0.5); c.fill();
    c.fillStyle = '#3a2618'; ell(c, -r * 0.22, -r * 0.52, r * 0.18, r * 0.13, 0.3); c.fill(); ell(c, r * 0.22, -r * 0.52, r * 0.18, r * 0.13, -0.3); c.fill();
    eyes(c, 0, -r * 0.52, r * 0.22, r * 0.09, o);
    c.fillStyle = '#2a1810'; ell(c, 0, -r * 0.36, r * 0.07, r * 0.05); c.fill();
    mouth(c, 0, -r * 0.28, r * 0.24, o.calm ? 'smile' : 'grin');
    // かさ
    c.fillStyle = '#d8b46a';
    c.beginPath(); c.moveTo(-r * 0.75, -r * 0.82); c.quadraticCurveTo(0, -r * 1.5, r * 0.75, -r * 0.82); c.quadraticCurveTo(0, -r * 0.95, -r * 0.75, -r * 0.82); c.fill();
    c.strokeStyle = '#8a6a30'; c.lineWidth = r * 0.025;
    for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(k * r * 0.05, -r * 1.18); c.lineTo(k * r * 0.33, -r * 0.88); c.stroke(); }
    // 葉っぱ
    c.save(); c.translate(-r * 0.75, r * 0.3); c.rotate(-0.6 + Math.sin(t * 1.5) * 0.1);
    c.fillStyle = '#7cc05a'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(r * 0.3, -r * 0.2, 0, -r * 0.5); c.quadraticCurveTo(-r * 0.3, -r * 0.2, 0, 0); c.fill();
    c.restore();
  };
  Y.tengu = function (c, s, t, o) {
    const r = s * 0.3;
    // つばさ
    c.fillStyle = '#2a2a3a';
    for (const sx of [-1, 1]) {
      c.beginPath(); c.moveTo(sx * r * 0.4, -r * 0.1);
      c.quadraticCurveTo(sx * r * 1.6, -r * 1.0 + Math.sin(t * 2) * r * 0.1, sx * r * 1.45, r * 0.4);
      c.quadraticCurveTo(sx * r * 0.95, r * 0.25, sx * r * 0.5, r * 0.5); c.fill();
    }
    // ころも
    c.fillStyle = '#e8e2d2'; ell(c, 0, r * 0.45, r * 0.75, r * 0.7); c.fill();
    c.fillStyle = '#d8a83a'; for (const sx of [-1, 1]) { circ(c, sx * r * 0.18, r * 0.15, r * 0.1); c.fill(); }
    // かお
    c.fillStyle = shade(c, 0, -r * 0.4, r * 0.6, '#ff7a6a', '#b02a2a');
    ell(c, 0, -r * 0.4, r * 0.55, r * 0.55); c.fill();
    // 長い鼻
    c.fillStyle = '#e04a40';
    c.beginPath(); c.moveTo(-r * 0.1, -r * 0.42); c.quadraticCurveTo(r * 0.9, -r * 0.55, r * 0.95, -r * 0.35); c.quadraticCurveTo(r * 0.5, -r * 0.25, -r * 0.05, -r * 0.25); c.fill();
    // まゆ
    c.strokeStyle = '#fff'; c.lineWidth = r * 0.08; c.lineCap = 'round';
    for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * r * 0.08, -r * 0.62); c.lineTo(sx * r * 0.42, o.calm ? -r * 0.68 : -r * 0.75); c.stroke(); }
    eyes(c, -r * 0.02, -r * 0.5, r * 0.2, r * 0.08, o);
    // ときん
    c.fillStyle = '#1a1a22'; c.beginPath(); c.moveTo(-r * 0.15, -r * 0.88); c.lineTo(0, -r * 1.15); c.lineTo(r * 0.15, -r * 0.88); c.closePath(); c.fill();
    // ひげ
    c.fillStyle = '#f2f2f2'; c.beginPath(); c.moveTo(-r * 0.4, -r * 0.18); c.quadraticCurveTo(0, r * 0.35, r * 0.4, -r * 0.18); c.quadraticCurveTo(0, -r * 0.05, -r * 0.4, -r * 0.18); c.fill();
    // うちわ
    c.save(); c.translate(-r * 0.95, r * 0.25); c.rotate(-0.4 + Math.sin(t * 2.5) * 0.25);
    c.strokeStyle = '#6a4a2a'; c.lineWidth = r * 0.06; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -r * 0.35); c.stroke();
    c.fillStyle = '#3a6a3a';
    for (let k = -3; k <= 3; k++) { c.save(); c.translate(0, -r * 0.35); c.rotate(k * 0.22); ell(c, 0, -r * 0.3, r * 0.09, r * 0.32); c.fill(); c.restore(); }
    c.restore();
  };
  Y.gama = function (c, s, t, o) {
    const r = s * 0.32;
    const puff = 1 + Math.sin(t * 1.6) * 0.03;
    c.fillStyle = shade(c, 0, 0, r, '#b8c87a', '#5a6a2a');
    ell(c, 0, r * 0.2, r * 1.1 * puff, r * 0.85 * puff); c.fill();
    c.fillStyle = '#e8e2b8'; ell(c, 0, r * 0.55, r * 0.8, r * 0.42); c.fill();
    // いぼ
    c.fillStyle = 'rgba(80,90,30,0.55)';
    for (let k = 0; k < 14; k++) { const a = hash(k + 7) * Math.PI - Math.PI, rr2 = r * (0.5 + hash(k) * 0.45); circ(c, Math.cos(a) * rr2, r * 0.05 + Math.sin(a) * rr2 * 0.7, r * (0.04 + hash(k + 3) * 0.04)); c.fill(); }
    // 目（上に とびだす）
    for (const sx of [-1, 1]) {
      c.fillStyle = '#8a9a4a'; circ(c, sx * r * 0.5, -r * 0.5, r * 0.3); c.fill();
      if (o.blink) { c.strokeStyle = '#1a1a10'; c.lineWidth = r * 0.06; c.beginPath(); c.moveTo(sx * r * 0.5 - r * 0.15, -r * 0.5); c.lineTo(sx * r * 0.5 + r * 0.15, -r * 0.5); c.stroke(); }
      else {
        circ(c, sx * r * 0.5, -r * 0.52, r * 0.2); c.fillStyle = '#ffe86a'; c.fill();
        ell(c, sx * r * 0.5, -r * 0.52, r * 0.05, r * 0.15); c.fillStyle = '#1a1a10'; c.fill();
      }
    }
    // 口
    c.strokeStyle = '#3a3a14'; c.lineWidth = r * 0.06;
    c.beginPath(); c.moveTo(-r * 0.85, r * 0.1); c.quadraticCurveTo(0, o.calm ? r * 0.38 : r * 0.28, r * 0.85, r * 0.1); c.stroke();
    // 前足
    c.fillStyle = '#7a8a3a';
    for (const sx of [-1, 1]) { ell(c, sx * r * 0.75, r * 0.95, r * 0.28, r * 0.13); c.fill(); }
  };
  Y.oni = function (c, s, t, o) {
    const r = s * 0.3;
    // たいこ
    c.fillStyle = '#7a2a1a'; ell(c, 0, r * 0.95, r * 0.75, r * 0.32); c.fill();
    c.fillStyle = '#f2e2c2'; ell(c, 0, r * 0.82, r * 0.68, r * 0.22); c.fill();
    c.fillStyle = '#d8302a'; circ(c, 0, r * 0.82, r * 0.12); c.fill();
    // からだ
    c.fillStyle = shade(c, 0, 0, r, '#ff6a5a', '#9a1a24');
    ell(c, 0, r * 0.15, r * 0.95, r * 0.75); c.fill();
    // とらがら
    c.fillStyle = '#ffcf3a'; rr(c, -r * 0.8, r * 0.35, r * 1.6, r * 0.3, r * 0.1); c.fill();
    c.fillStyle = '#2a1a22'; for (let k = -3; k <= 3; k++) c.fillRect(k * r * 0.22 - r * 0.035, r * 0.37, r * 0.07, r * 0.26);
    // かお
    c.fillStyle = shade(c, 0, -r * 0.45, r * 0.6, '#ff7a6a', '#b02a2a');
    ell(c, 0, -r * 0.45, r * 0.6, r * 0.55); c.fill();
    c.fillStyle = '#2a1a22';
    c.beginPath(); c.moveTo(-r * 0.6, -r * 0.6); c.quadraticCurveTo(0, -r * 1.3, r * 0.6, -r * 0.6); c.quadraticCurveTo(r * 0.3, -r * 0.8, 0, -r * 0.72); c.quadraticCurveTo(-r * 0.3, -r * 0.8, -r * 0.6, -r * 0.6); c.fill();
    c.fillStyle = '#fff3d6';
    for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * r * 0.22, -r * 0.88); c.lineTo(sx * r * 0.42, -r * 1.35); c.lineTo(sx * r * 0.52, -r * 0.82); c.closePath(); c.fill(); }
    c.strokeStyle = '#2a1a22'; c.lineWidth = r * 0.07; c.lineCap = 'round';
    for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * r * 0.08, -r * 0.62); c.lineTo(sx * r * 0.38, o.calm ? -r * 0.66 : -r * 0.74); c.stroke(); }
    eyes(c, 0, -r * 0.48, r * 0.22, r * 0.1, Object.assign({ white: '#fff6a0' }, o));
    mouth(c, 0, -r * 0.2, r * 0.36, o.calm ? 'smile' : 'grin');
    c.fillStyle = '#fff'; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * r * 0.14, -r * 0.18); c.lineTo(sx * r * 0.2, -r * 0.05); c.lineTo(sx * r * 0.26, -r * 0.16); c.fill(); }
    // ばち
    c.strokeStyle = '#d8b06a'; c.lineWidth = r * 0.09;
    const sw = Math.sin(t * 3) * 0.3;
    for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * r * 0.85, r * 0.1); c.lineTo(sx * r * (0.95 + 0.25 * Math.sin(sw * sx)), -r * 0.55); c.stroke(); }
  };

  // 妖を描く。x,y は マスの中心
  R.drawYokai = function (c, sp, x, y, s, t, o) {
    o = o || {};
    const f = Y[sp];
    if (!f) return;
    c.save();
    c.translate(x, y);
    const bob = o.still ? 0 : Math.sin(t * 2.6 + (o.seed || 0)) * s * 0.025;
    c.translate(0, bob + (o.dy || 0));
    if (o.sx || o.sy) c.scale(o.sx || 1, o.sy || 1);
    if (o.rot) c.rotate(o.rot);
    if (o.shadow !== false) {
      c.fillStyle = 'rgba(0,0,0,0.28)'; ell(c, 0, s * 0.36 - bob, s * 0.28, s * 0.07); c.fill();
    }
    const blink = !o.noBlink && ((t + (o.seed || 0) * 1.7) % 3.7) < 0.12;
    if (o.silhouette || o.flash) {
      // かげ絵・白く光る：いったん 別の 紙に 描いてから 色を のせる
      const sz = Math.ceil(s * 3.2), buf = scratch(sz);
      const b = buf.c;
      b.setTransform(R.k, 0, 0, R.k, 0, 0);
      b.clearRect(0, 0, sz, sz);
      b.save(); b.translate(sz / 2, sz / 2);
      f(b, s, t, o.silhouette ? { blink: true } : Object.assign({ blink }, o));
      b.globalCompositeOperation = 'source-atop';
      b.fillStyle = o.silhouette || ('rgba(255,255,255,' + Math.min(1, o.flash) + ')');
      b.fillRect(-sz, -sz, sz * 2, sz * 2);
      b.restore();
      c.drawImage(buf.cv, 0, 0, sz * R.k, sz * R.k, -sz / 2, -sz / 2, sz, sz);
    } else {
      f(c, s, t, Object.assign({ blink }, o));
    }
    c.restore();
  };
  const scratchBufs = {};
  function scratch(sz) {
    const key = Math.ceil(sz / 64) * 64;
    let b = scratchBufs[key];
    if (!b || b.k !== R.k) {
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(key * R.k); cv.height = Math.ceil(key * R.k);
      b = scratchBufs[key] = { cv, c: cv.getContext('2d'), k: R.k };
    }
    return b;
  }

  // ================================================================ ゆい（主人公）
  R.drawYui = function (c, x, y, s, t, mood) {
    // s = 身長の目安（px）
    const u = s / 100;
    c.save(); c.translate(x, y);
    const breathe = Math.sin(t * 2) * u * 0.8;
    const hurt = mood === 'hurt', happy = mood === 'happy';
    if (hurt) c.translate(Math.sin(t * 60) * u * 1.5, 0);
    // かげ
    c.fillStyle = 'rgba(0,0,0,0.3)'; ell(c, 0, u * 50, u * 26, u * 5); c.fill();
    // ゆかた
    c.fillStyle = '#2a3c78';
    c.beginPath(); c.moveTo(-u * 20, u * 48); c.lineTo(-u * 17, u * 2 + breathe); c.quadraticCurveTo(0, -u * 4 + breathe, u * 17, u * 2 + breathe); c.lineTo(u * 20, u * 48); c.closePath(); c.fill();
    // あさがお もよう
    c.fillStyle = 'rgba(255,255,255,0.75)';
    for (const [px, py] of [[-9, 18], [8, 32], [-6, 40], [11, 12]]) {
      c.save(); c.translate(px * u, py * u);
      for (let k = 0; k < 5; k++) { c.rotate(TAU / 5); ell(c, 0, -u * 2.4, u * 1.6, u * 2.2); c.fill(); }
      c.restore();
    }
    c.fillStyle = '#ff9ab0'; for (const [px, py] of [[-9, 18], [8, 32], [-6, 40], [11, 12]]) { circ(c, px * u, py * u, u * 1.2); c.fill(); }
    // えり
    c.strokeStyle = '#f2ece2'; c.lineWidth = u * 2.2;
    c.beginPath(); c.moveTo(-u * 7, u * 2 + breathe); c.lineTo(u * 3, u * 16 + breathe); c.stroke();
    c.beginPath(); c.moveTo(u * 7, u * 2 + breathe); c.lineTo(-u * 1, u * 12 + breathe); c.stroke();
    // おび
    c.fillStyle = '#e8b83a'; c.fillRect(-u * 18, u * 18 + breathe, u * 36, u * 8);
    c.fillStyle = '#d8302a'; c.fillRect(-u * 18, u * 21 + breathe, u * 36, u * 2);
    // 手と ひも
    const arm = happy ? -u * 12 : 0;
    c.fillStyle = '#ffe2c8';
    circ(c, -u * 18, u * 24 + arm * 0.6 + breathe, u * 3.6); c.fill();
    circ(c, u * 18, u * 24 + arm + breathe, u * 3.6); c.fill();
    // 紅白の ひも（手から たれる）
    const sway = Math.sin(t * 1.8) * u * 3;
    for (let k = 0; k < 2; k++) {
      c.strokeStyle = k ? '#ffffff' : '#e0323a'; c.lineWidth = u * 2.2; c.setLineDash([u * 4, u * 4]); c.lineDashOffset = k * u * 4;
      c.beginPath(); c.moveTo(u * 18, u * 24 + arm + breathe); c.quadraticCurveTo(u * 26 + sway, u * 40, u * 22 + sway, u * 52); c.stroke();
    }
    c.setLineDash([]);
    // げた
    c.fillStyle = '#7a4a2a'; rr(c, -u * 13, u * 47, u * 10, u * 3.5, u * 1); c.fill(); rr(c, u * 3, u * 47, u * 10, u * 3.5, u * 1); c.fill();
    // あたま
    const hy = -u * 16 + breathe;
    c.fillStyle = '#16101a';
    ell(c, 0, hy + u * 2, u * 21, u * 20); c.fill();
    c.fillStyle = '#ffe8d4'; ell(c, 0, hy + u * 4, u * 16, u * 15); c.fill();
    // まえがみ
    c.fillStyle = '#16101a';
    c.beginPath(); c.moveTo(-u * 18, hy + u * 2);
    c.quadraticCurveTo(-u * 10, hy - u * 22, u * 4, hy - u * 17);
    c.quadraticCurveTo(u * 18, hy - u * 14, u * 18, hy + u * 4);
    c.lineTo(u * 12, hy - u * 4); c.lineTo(u * 6, hy - u * 1); c.lineTo(u * 1, hy - u * 6); c.lineTo(-u * 5, hy - u * 1); c.lineTo(-u * 11, hy - u * 5);
    c.closePath(); c.fill();
    // かみかざり（紅白の むすび）
    c.save(); c.translate(u * 15, hy - u * 12);
    c.fillStyle = '#e0323a'; ell(c, -u * 4, 0, u * 5, u * 3.4, -0.4); c.fill(); ell(c, u * 4, 0, u * 5, u * 3.4, 0.4); c.fill();
    c.fillStyle = '#fff'; circ(c, 0, 0, u * 2.4); c.fill();
    c.restore();
    // かお
    const ey = hy + u * 4;
    if (hurt) {
      c.strokeStyle = '#2a1416'; c.lineWidth = u * 1.6; c.lineCap = 'round';
      for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * u * 8, ey - u * 2); c.lineTo(sx * u * 4, ey); c.lineTo(sx * u * 8, ey + u * 2); c.stroke(); }
    } else {
      const blink = (t % 4.1) < 0.12;
      eyes(c, 0, ey, u * 6.2, u * 2.8, { blink, happy: happy && !blink });
    }
    cheeks(c, 0, ey + u * 5, u * 9, u * 2.6, 'rgba(255,120,140,0.5)');
    mouth(c, 0, ey + u * 8, u * 5, hurt ? 'o' : (happy ? 'grin' : 'smile'));
    c.restore();
  };

  // ================================================================ 背景
  function starField(c, w, h, n, seed) {
    for (let k = 0; k < n; k++) {
      const x = hash(k * 3 + seed) * w, y = hash(k * 7 + seed + 1) * h;
      const b = hash(k * 11 + seed);
      c.fillStyle = 'rgba(255,255,240,' + (0.25 + b * 0.6) + ')';
      circ(c, x, y, 0.5 + b * 1.1); c.fill();
    }
  }
  function moon(c, x, y, r, col) {
    const g = c.createRadialGradient(x, y, r * 0.2, x, y, r * 4);
    g.addColorStop(0, 'rgba(255,240,200,0.35)'); g.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = g; circ(c, x, y, r * 4); c.fill();
    circ(c, x, y, r); c.fillStyle = col || '#fff4d6'; c.fill();
    c.fillStyle = 'rgba(200,190,160,0.35)';
    circ(c, x - r * 0.3, y - r * 0.2, r * 0.18); c.fill(); circ(c, x + r * 0.25, y + r * 0.3, r * 0.12); c.fill();
  }
  function hills(c, w, baseY, amp, col, seed, step) {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, 720);
    for (let x = 0; x <= w + step; x += step) c.lineTo(x, baseY - amp * (0.5 + 0.5 * Math.sin(x * 0.006 + seed) * Math.cos(x * 0.0023 + seed * 2)));
    c.lineTo(w, 720); c.closePath(); c.fill();
  }
  function lanternString(c, x0, y0, x1, y1, n, sag, col) {
    c.strokeStyle = 'rgba(30,20,20,0.8)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag, x1, y1); c.stroke();
    for (let k = 1; k < n; k++) {
      const u = k / n, x = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * (x0 + x1) / 2 + u * u * x1;
      const y = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * ((y0 + y1) / 2 + sag) + u * u * y1;
      const g = c.createRadialGradient(x, y + 10, 1, x, y + 10, 26);
      g.addColorStop(0, 'rgba(255,190,110,0.45)'); g.addColorStop(1, 'rgba(255,150,80,0)');
      c.fillStyle = g; circ(c, x, y + 10, 26); c.fill();
      c.fillStyle = col || '#ffd7a0'; ell(c, x, y + 10, 6, 8.5); c.fill();
      c.fillStyle = '#c8302a'; c.fillRect(x - 4, y + 2, 8, 2); c.fillRect(x - 4, y + 17, 8, 2);
    }
  }

  R.background = function (areaId) {
    const key = 'bg_' + areaId;
    if (R.cache[key]) return R.cache[key];
    const W = 1280, H = 720, o = mkCanvas(W, H), c = o.c;
    const skies = {
      0: ['#0a0c22', '#1d1840', '#3a2050'],
      1: ['#121a44', '#3a3a6a', '#b0706a'],
      2: ['#06101e', '#0f2436', '#2a4a48'],
      3: ['#050a1e', '#10204a', '#22406a'],
      4: ['#0c0618', '#2a1030', '#6a2838'],
      5: ['#0c0618', '#2a1030', '#7a3040']
    };
    const sk = skies[areaId] || skies[0];
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sk[0]); g.addColorStop(0.55, sk[1]); g.addColorStop(1, sk[2]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    starField(c, W, H * 0.6, areaId === 1 ? 70 : 160, areaId * 17);
    if (areaId === 1) {
      // あぜ道：ゆうぐれの 田んぼ
      moon(c, 1090, 110, 26, '#ffe8c0');
      hills(c, W, 470, 60, '#2a2440', 1.3, 20);
      hills(c, W, 520, 40, '#1e1a30', 2.1, 16);
      // 田んぼの 水面
      const wg = c.createLinearGradient(0, 520, 0, H);
      wg.addColorStop(0, '#3a3456'); wg.addColorStop(1, '#14122a');
      c.fillStyle = wg; c.fillRect(0, 540, W, H - 540);
      c.strokeStyle = 'rgba(255,200,170,0.12)'; c.lineWidth = 1;
      for (let y = 552; y < H; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y + 4); c.stroke(); }
      // いね
      c.strokeStyle = '#1a2a1e'; c.lineWidth = 2;
      for (let k = 0; k < 260; k++) {
        const x = hash(k) * W, y = 545 + hash(k + 99) * 170, h2 = 12 + hash(k + 7) * 18;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 3, y - h2 * 0.6, x + 6 * (hash(k + 5) - 0.5) * 2, y - h2); c.stroke();
      }
      // 遠くの 社の灯り
      lanternString(c, 760, 455, 980, 450, 7, 14, '#ffd0a0');
    } else if (areaId === 2) {
      // 竹林
      moon(c, 940, 120, 40);
      for (let layer = 0; layer < 3; layer++) {
        const col = ['#0f2a28', '#14362e', '#1a4434'][layer];
        const n = [26, 18, 12][layer], wdt = [10, 16, 24][layer];
        for (let k = 0; k < n; k++) {
          const x = hash(k * 13 + layer * 101) * W, lean = (hash(k * 5 + layer) - 0.5) * 30;
          c.strokeStyle = col; c.lineWidth = wdt;
          c.beginPath(); c.moveTo(x, H); c.quadraticCurveTo(x + lean * 0.3, H * 0.5, x + lean, -20); c.stroke();
          c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2;
          for (let y = H - 60 - hash(k) * 40; y > 0; y -= 70 + layer * 20) { const xx = x + lean * (1 - y / H) * 0.9; c.beginPath(); c.moveTo(xx - wdt / 2, y); c.lineTo(xx + wdt / 2, y); c.stroke(); }
          c.fillStyle = col;
          for (let q = 0; q < 3; q++) {
            const yy = 120 + hash(k * 3 + q + layer) * 400, xx = x + lean * (1 - yy / H) * 0.9;
            c.save(); c.translate(xx, yy); c.rotate((hash(k + q) - 0.5) * 2);
            ell(c, wdt * 1.5, 0, wdt * 1.6, wdt * 0.35); c.fill(); c.restore();
          }
        }
      }
      const fog = c.createLinearGradient(0, 400, 0, H);
      fog.addColorStop(0, 'rgba(120,180,170,0)'); fog.addColorStop(1, 'rgba(120,180,170,0.18)');
      c.fillStyle = fog; c.fillRect(0, 400, W, H - 400);
    } else if (areaId === 3) {
      // 川べり
      moon(c, 260, 110, 34);
      hills(c, W, 380, 70, '#0e1a36', 0.7, 20);
      // 社の石段（遠く）
      c.fillStyle = '#0a1228';
      c.beginPath(); c.moveTo(1040, 380); c.lineTo(1120, 250); c.lineTo(1160, 250); c.lineTo(1240, 380); c.fill();
      // 川
      const rg = c.createLinearGradient(0, 400, 0, H);
      rg.addColorStop(0, '#1a3060'); rg.addColorStop(1, '#0a1430');
      c.fillStyle = rg; c.fillRect(0, 400, W, H - 400);
      c.fillStyle = '#0c1424'; c.beginPath(); c.moveTo(0, 400); c.quadraticCurveTo(300, 380, 640, 404); c.quadraticCurveTo(980, 420, 1280, 396); c.lineTo(1280, 410); c.lineTo(0, 412); c.fill();
      c.strokeStyle = 'rgba(180,210,255,0.12)'; c.lineWidth = 2;
      for (let k = 0; k < 40; k++) { const x = hash(k) * W, y = 420 + hash(k + 5) * 290; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30 + hash(k) * 50, y); c.stroke(); }
      // 橋
      c.strokeStyle = '#3a1a1a'; c.lineWidth = 10;
      c.beginPath(); c.moveTo(80, 430); c.quadraticCurveTo(320, 340, 560, 430); c.stroke();
      c.lineWidth = 4; c.beginPath(); c.moveTo(80, 405); c.quadraticCurveTo(320, 315, 560, 405); c.stroke();
      for (let k = 0; k <= 8; k++) { const u = k / 8, x = 80 + u * 480, y = 430 - Math.sin(u * Math.PI) * 68; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 25); c.stroke(); }
    } else if (areaId === 4 || areaId === 5) {
      // 社の石段・境内
      moon(c, 1100, 100, 30, '#ffdcc8');
      hills(c, W, 330, 80, '#1a0c20', 0.3, 20);
      // 鳥居
      const tx = 640, ty = 120;
      c.fillStyle = '#7a1a1a';
      c.fillRect(tx - 150, ty + 30, 18, 380); c.fillRect(tx + 132, ty + 30, 18, 380);
      c.fillRect(tx - 175, ty + 60, 350, 14);
      c.beginPath(); c.moveTo(tx - 200, ty + 18); c.quadraticCurveTo(tx, ty + 34, tx + 200, ty + 18); c.lineTo(tx + 190, ty + 36); c.quadraticCurveTo(tx, ty + 48, tx - 190, ty + 36); c.fill();
      // 石段
      for (let k = 0; k < 14; k++) {
        const y = 420 + k * 22, w2 = 260 + k * 40;
        c.fillStyle = k % 2 ? '#2a2030' : '#241a2a';
        c.fillRect(640 - w2 / 2, y, w2, 22);
      }
      // ちょうちんの 列
      lanternString(c, 0, 210, 470, 250, 9, 30);
      lanternString(c, 810, 250, 1280, 210, 9, 30);
      lanternString(c, 0, 330, 380, 370, 6, 24);
      lanternString(c, 900, 370, 1280, 330, 6, 24);
      if (areaId === 5) {
        // 夜店
        for (let k = 0; k < 6; k++) {
          const x = 60 + k * 210 + (k >= 3 ? 120 : 0), y = 520;
          if (x > 520 && x < 760) continue;
          c.fillStyle = '#3a1820'; c.fillRect(x, y, 150, 120);
          c.fillStyle = ['#d8302a', '#2a6ad8', '#e8a020', '#3aa860', '#d8308a', '#e86a20'][k];
          c.beginPath(); c.moveTo(x - 10, y); c.lineTo(x + 160, y); c.lineTo(x + 150, y - 30); c.lineTo(x, y - 30); c.fill();
          c.fillStyle = 'rgba(255,230,180,0.5)'; c.fillRect(x + 10, y + 20, 130, 50);
        }
      }
    } else {
      // 表紙
      moon(c, 1060, 130, 44, '#fff0d0');
      hills(c, W, 470, 90, '#160c26', 0.9, 20);
      hills(c, W, 560, 60, '#0e0818', 2.2, 16);
      lanternString(c, -20, 120, 640, 200, 12, 50);
      lanternString(c, 640, 200, 1300, 110, 12, 50);
    }
    R.cache[key] = o;
    return o;
  };

  // うごく背景（ほたる・灯籠・星のまたたき）
  R.bgAnim = function (c, areaId, t) {
    if (areaId === 1) {
      for (let k = 0; k < 26; k++) {
        const x = (hash(k) * 1280 + Math.sin(t * 0.3 + k) * 40 + t * 6 * (hash(k + 3) - 0.5)) % 1280;
        const y = 420 + hash(k + 9) * 260 + Math.sin(t * 0.7 + k * 2) * 18;
        const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.6 + k * 1.3));
        const g = c.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, 'rgba(220,255,140,' + a + ')'); g.addColorStop(1, 'rgba(200,255,120,0)');
        c.fillStyle = g; circ(c, x, y, 9); c.fill();
      }
    } else if (areaId === 2) {
      for (let k = 0; k < 14; k++) {
        const y = (hash(k) * 760 + t * (16 + hash(k + 1) * 14)) % 760 - 20;
        const x = hash(k + 4) * 1280 + Math.sin(t + k) * 30;
        c.save(); c.translate(x, y); c.rotate(t * (hash(k) - 0.5) * 2 + k);
        c.fillStyle = 'rgba(120,180,120,0.5)'; ell(c, 0, 0, 7, 2); c.fill(); c.restore();
      }
    } else if (areaId === 3) {
      for (let k = 0; k < 9; k++) {
        const x = (hash(k) * 1400 + t * (10 + hash(k + 2) * 8)) % 1400 - 60;
        const y = 450 + hash(k + 7) * 240 + Math.sin(t * 1.2 + k) * 3;
        const g = c.createRadialGradient(x, y, 0, x, y, 30);
        g.addColorStop(0, 'rgba(255,190,110,0.5)'); g.addColorStop(1, 'rgba(255,150,80,0)');
        c.fillStyle = g; circ(c, x, y, 30); c.fill();
        c.fillStyle = '#ffe0b0'; rr(c, x - 7, y - 9, 14, 12, 2); c.fill();
        c.fillStyle = '#5a3020'; c.fillRect(x - 10, y + 3, 20, 4);
        c.fillStyle = 'rgba(255,200,140,0.18)'; c.fillRect(x - 3, y + 8, 6, 26);
      }
    } else if (areaId === 4 || areaId === 5 || areaId === 0) {
      for (let k = 0; k < 18; k++) {
        const x = hash(k + 40) * 1280, y = hash(k + 41) * 380;
        const a = 0.2 + 0.8 * Math.max(0, Math.sin(t * 2 + k * 1.7));
        c.fillStyle = 'rgba(255,240,220,' + a * 0.8 + ')'; circ(c, x, y, 1.3); c.fill();
      }
    }
  };

  // ================================================================ 小物
  R.heart = function (c, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s / 20, s / 20);
    c.beginPath(); c.moveTo(0, 7);
    c.bezierCurveTo(-12, -2, -8, -12, 0, -5); c.bezierCurveTo(8, -12, 12, -2, 0, 7);
    c.fillStyle = col || '#ff6a80'; c.fill(); c.restore();
  };
  R.mask = function (c, x, y, s) {
    // きつねのお面
    c.save(); c.translate(x, y);
    c.fillStyle = '#fff8ee';
    c.beginPath(); c.moveTo(-s * 0.45, -s * 0.15); c.lineTo(-s * 0.35, -s * 0.55); c.lineTo(-s * 0.12, -s * 0.28); c.lineTo(s * 0.12, -s * 0.28); c.lineTo(s * 0.35, -s * 0.55); c.lineTo(s * 0.45, -s * 0.15);
    c.quadraticCurveTo(s * 0.4, s * 0.35, 0, s * 0.5); c.quadraticCurveTo(-s * 0.4, s * 0.35, -s * 0.45, -s * 0.15); c.fill();
    c.strokeStyle = '#d8302a'; c.lineWidth = s * 0.06; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-s * 0.28, -s * 0.05); c.lineTo(-s * 0.08, s * 0.02); c.moveTo(s * 0.28, -s * 0.05); c.lineTo(s * 0.08, s * 0.02); c.stroke();
    c.fillStyle = '#d8302a'; circ(c, 0, s * 0.3, s * 0.05); c.fill();
    c.restore();
  };
  R.cord = function (c, x, y, s) {
    // ひもの アイコン（むすび目）
    c.save(); c.translate(x, y);
    c.lineWidth = s * 0.16; c.lineCap = 'round';
    c.strokeStyle = '#e0323a';
    c.beginPath(); c.ellipse(-s * 0.22, 0, s * 0.24, s * 0.16, -0.3, 0, TAU); c.stroke();
    c.strokeStyle = '#fff';
    c.beginPath(); c.ellipse(s * 0.22, 0, s * 0.24, s * 0.16, 0.3, 0, TAU); c.stroke();
    c.restore();
  };

  // ふち付きの 文字
  R.text = function (c, str, x, y, o) {
    o = o || {};
    c.font = (o.weight || 'bold') + ' ' + (o.size || 18) + 'px ' + (o.font || FONT);
    c.textAlign = o.align || 'center'; c.textBaseline = o.base || 'middle';
    if (o.stroke) { c.lineJoin = 'round'; c.lineWidth = o.sw || 4; c.strokeStyle = o.stroke; c.strokeText(str, x, y); }
    c.fillStyle = o.color || '#fff'; c.fillText(str, x, y);
  };
  // 和紙ふうの 板
  R.panel = function (c, x, y, w, h, o) {
    o = o || {};
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 18; c.shadowOffsetY = 6;
    rr(c, x, y, w, h, o.r || 14);
    c.fillStyle = o.fill || 'rgba(20,14,30,0.86)'; c.fill();
    c.restore();
    rr(c, x, y, w, h, o.r || 14);
    c.lineWidth = 2; c.strokeStyle = o.border || 'rgba(255,214,150,0.45)'; c.stroke();
    if (o.inner !== false) { rr(c, x + 5, y + 5, w - 10, h - 10, Math.max(2, (o.r || 14) - 4)); c.lineWidth = 1; c.strokeStyle = 'rgba(255,214,150,0.15)'; c.stroke(); }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
  else root.G10Render = R;
})(typeof window !== 'undefined' ? window : globalThis);
