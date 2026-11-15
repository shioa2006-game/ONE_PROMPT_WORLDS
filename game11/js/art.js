/*
 * ひゅるり、凧びより ― もの の絵（すべて Canvas で その場で描く）
 *   1 = その もの の 大きさ。地面に たつ もの は 足もとが y=+0.45。
 *   ねている もの（flat）は 中心が (0,0)。
 * 一度 描いた絵は 大きさごとに しまっておき、drawImage で 使いまわす。
 */
(function (root) {
  'use strict';
  const TJ = root.TJ = root.TJ || {};
  const Art = TJ.Art = {};
  const OUT = '#3b2b24';
  const LW = 0.045;
  const PI = Math.PI, TAU = PI * 2;

  // ── 小道具
  function fs(c, fill, stroke, lw) {
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke !== false) { c.strokeStyle = stroke || OUT; c.lineWidth = lw || LW; c.stroke(); }
  }
  function circ(c, x, y, r, fill, stroke, lw) { c.beginPath(); c.arc(x, y, r, 0, TAU); fs(c, fill, stroke, lw); }
  function ell(c, x, y, rx, ry, rot, fill, stroke, lw) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU); fs(c, fill, stroke, lw); }
  function rr(c, x, y, w, h, r, fill, stroke, lw) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
    fs(c, fill, stroke, lw);
  }
  function poly(c, pts, fill, stroke, lw, open) {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    if (!open) c.closePath();
    fs(c, open ? null : fill, stroke, lw);
  }
  function ln(c, x0, y0, x1, y1, col, lw) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.strokeStyle = col || OUT; c.lineWidth = lw || LW; c.stroke(); }
  function arcS(c, x, y, r, a0, a1, col, lw) { c.beginPath(); c.arc(x, y, r, a0, a1); c.strokeStyle = col || OUT; c.lineWidth = lw || LW; c.stroke(); }
  function shine(c, x, y, rx, ry, a) { ell(c, x, y, rx, ry, a || 0, 'rgba(255,255,255,0.55)', false); }
  function txt(c, s, x, y, size, col, font) {
    c.save(); c.translate(x, y); c.scale(0.01, 0.01);
    c.font = (font || '700 ') + Math.round(size * 100) + 'px "Yu Mincho","Hiragino Mincho ProN","MS Mincho",serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col || OUT;
    c.fillText(s, 0, 0); c.restore();
  }
  function vtxt(c, s, x, y, size, col) { for (let i = 0; i < s.length; i++) txt(c, s[i], x, y + i * size * 1.05, size, col); }
  function blob(c, cx, cy, rx, ry, n, seed, jit, fill, stroke, lw) {
    const R = TJ.rng(seed);
    c.beginPath();
    const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU; const k = 1 - jit + R() * jit * 2; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      if (i === 0) c.moveTo(mx, my); else c.quadraticCurveTo(p[0], p[1], mx, my);
    }
    const p = pts[0], q = pts[1];
    c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    c.closePath();
    fs(c, fill, stroke, lw);
  }
  Art.h = { fs, circ, ell, rr, poly, ln, arcS, shine, txt, vtxt, blob, OUT };

  const D = {};
  // ════ その一 ════
  D.kareha = (c, v) => {
    if (v === 0) {
      const p = [];
      for (let i = 0; i < 10; i++) { const a = -PI / 2 + i / 10 * TAU; const r = i % 2 ? 0.2 : 0.48; p.push(Math.cos(a) * r, Math.sin(a) * r * 0.95); }
      poly(c, p, '#d8562f'); ln(c, 0, 0, 0, 0.45, '#8e3a1f', 0.05);
      ln(c, 0, 0, 0, -0.38, '#9c3f22', 0.025); ln(c, 0, 0, -0.38, -0.12, '#9c3f22', 0.025); ln(c, 0, 0, 0.38, -0.12, '#9c3f22', 0.025);
    } else if (v === 1) {
      c.beginPath(); c.moveTo(0, -0.48); c.quadraticCurveTo(0.42, -0.1, 0, 0.42); c.quadraticCurveTo(-0.42, -0.1, 0, -0.48); fs(c, '#a8703c');
      ln(c, 0, -0.42, 0, 0.48, '#6f4523', 0.035);
      for (let i = 0; i < 3; i++) { ln(c, 0, -0.2 + i * 0.18, 0.18, -0.3 + i * 0.18, '#7a4c28', 0.022); ln(c, 0, -0.2 + i * 0.18, -0.18, -0.3 + i * 0.18, '#7a4c28', 0.022); }
    } else {
      c.beginPath(); c.moveTo(0, 0.3); c.lineTo(-0.44, -0.18); c.quadraticCurveTo(-0.2, -0.5, 0, -0.32); c.quadraticCurveTo(0.2, -0.5, 0.44, -0.18); c.closePath(); fs(c, '#efc23c');
      ln(c, 0, 0.3, 0, 0.48, '#a88220', 0.045);
      for (let i = -2; i <= 2; i++) ln(c, 0, 0.26, i * 0.15, -0.28, 'rgba(160,120,20,0.6)', 0.018);
    }
  };
  D.matsuba = (c) => { ln(c, 0, 0.42, -0.16, -0.46, '#5d6b2e', 0.07); ln(c, 0, 0.42, 0.16, -0.46, '#6b7a33', 0.07); ln(c, -0.03, 0.42, 0.03, 0.42, '#7b5a2e', 0.12); };
  D.koishi = (c, v) => {
    const cols = ['#9d9a92', '#b8ad9c', '#7f8288'];
    blob(c, 0, 0, 0.46, 0.36, 7, 11 + v * 7, 0.18, cols[v]);
    shine(c, -0.12, -0.12, 0.13, 0.07, -0.4);
  };
  D.donguri = (c) => {
    ell(c, 0, 0.1, 0.27, 0.34, 0, '#9a6230');
    shine(c, -0.09, 0.08, 0.06, 0.13, 0.2);
    c.beginPath(); c.ellipse(0, -0.12, 0.31, 0.2, 0, PI, TAU); c.lineTo(0.31, -0.08); c.quadraticCurveTo(0, 0.02, -0.31, -0.08); c.closePath(); fs(c, '#6e5534');
    for (let i = -2; i <= 2; i++) ln(c, i * 0.1, -0.25, i * 0.1 + 0.05, -0.08, 'rgba(40,30,20,0.5)', 0.02);
    ln(c, 0, -0.3, 0.04, -0.44, OUT, 0.06);
  };
  D.mikankawa = (c) => {
    const p = [];
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; const r = i % 2 ? 0.16 : 0.47; p.push(Math.cos(a) * r, Math.sin(a) * r); }
    poly(c, p, '#f08a24');
    const q = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; const r = i % 2 ? 0.1 : 0.34; q.push(Math.cos(a) * r, Math.sin(a) * r); }
    poly(c, q, '#fde7c2', false);
  };
  D.ohajiki = (c, v) => {
    const cols = ['rgba(90,170,230,0.85)', 'rgba(240,120,160,0.85)', 'rgba(110,200,140,0.85)', 'rgba(250,210,80,0.85)'];
    ell(c, 0, 0, 0.46, 0.42, 0, cols[v]);
    c.save(); c.beginPath(); c.moveTo(-0.2, 0.1); c.quadraticCurveTo(0, -0.25, 0.25, 0.05); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.08; c.stroke(); c.restore();
    shine(c, -0.18, -0.16, 0.12, 0.07, -0.5);
  };
  D.biidama = (c, v) => {
    const cols = [['#bfe6f5', '#3d9ad1'], ['#ffe0ea', '#e2557e'], ['#e0f6d6', '#4fae5b']][v];
    const g = c.createRadialGradient(-0.12, -0.14, 0.05, 0, 0, 0.46);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, cols[0]); g.addColorStop(1, cols[1]);
    circ(c, 0, 0, 0.44, g);
    c.beginPath(); c.moveTo(-0.25, 0.15); c.bezierCurveTo(-0.05, -0.2, 0.1, 0.25, 0.27, -0.1); c.strokeStyle = cols[1]; c.lineWidth = 0.08; c.stroke();
    shine(c, -0.16, -0.18, 0.1, 0.06, -0.5);
  };
  D.umehana = (c) => {
    for (let i = 0; i < 5; i++) { const a = -PI / 2 + i / 5 * TAU; circ(c, Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.2, '#f6b7c8', '#c76d86', 0.03); }
    circ(c, 0, 0, 0.1, '#f7d45a', false);
  };
  D.tsuchi = (c) => { blob(c, 0, 0, 0.45, 0.36, 7, 5, 0.25, '#7a5a3c'); circ(c, -0.1, -0.05, 0.05, '#5b402a', false); circ(c, 0.15, 0.1, 0.04, '#5b402a', false); };
  D.hachikake = (c) => { poly(c, [-0.45, -0.1, -0.15, -0.35, 0.4, -0.2, 0.45, 0.15, 0.05, 0.05, -0.35, 0.2], '#c86d3c'); ln(c, -0.35, 0.05, 0.38, -0.05, '#e39466', 0.05); };
  D.hane = (c) => {
    const cols = ['#e2553b', '#f2c544', '#5cb36a', '#3d8fd6'];
    for (let i = 0; i < 4; i++) {
      const a = -PI / 2 + (i - 1.5) * 0.35;
      c.save(); c.translate(0, 0.18); c.rotate(a + PI / 2);
      ell(c, 0, -0.32, 0.1, 0.24, 0, cols[i], OUT, 0.03); ln(c, 0, -0.1, 0, -0.52, 'rgba(255,255,255,0.7)', 0.02);
      c.restore();
    }
    circ(c, 0, 0.27, 0.16, '#2a2422');
    shine(c, -0.05, 0.22, 0.05, 0.03);
  };
  D.menko = (c, v) => {
    const cols = [['#e2553b', '#f6d34a'], ['#2f6fb5', '#f4f1e6'], ['#3a8a4a', '#f2c544']][v];
    rr(c, -0.42, -0.32, 0.84, 0.64, 0.05, cols[1]);
    rr(c, -0.36, -0.26, 0.72, 0.52, 0.03, cols[0], false);
    circ(c, 0, 0, 0.18, cols[1], OUT, 0.03);
    txt(c, ['龍', '虎', '鷹'][v], 0, 0.01, 0.24, OUT);
  };
  D.koma = (c, v) => {
    const cols = v ? ['#e2553b', '#3d8fd6', '#f2c544'] : ['#5cb36a', '#e2553b', '#f2c544'];
    ln(c, 0, -0.45, 0, -0.18, '#6f4a2c', 0.08);
    c.beginPath(); c.moveTo(-0.46, -0.08); c.quadraticCurveTo(-0.4, 0.25, 0, 0.42); c.quadraticCurveTo(0.4, 0.25, 0.46, -0.08); c.closePath(); fs(c, cols[0]);
    ell(c, 0, -0.08, 0.46, 0.16, 0, cols[2]);
    ell(c, 0, -0.08, 0.3, 0.1, 0, cols[1], false);
    ell(c, 0, -0.08, 0.12, 0.04, 0, cols[2], false);
    c.beginPath(); c.moveTo(-0.3, 0.12); c.quadraticCurveTo(0, 0.2, 0.3, 0.12); c.strokeStyle = cols[1]; c.lineWidth = 0.06; c.stroke();
  };
  D.sentaku = (c, v) => {
    const col = ['#f28aa8', '#6cc0e8', '#f5d34f'][v];
    rr(c, -0.1, -0.48, 0.2, 0.96, 0.08, col);
    ln(c, 0, -0.45, 0, 0.45, 'rgba(0,0,0,0.25)', 0.03);
    circ(c, 0, 0.05, 0.07, '#ddd', OUT, 0.025);
  };
  D.mikan = (c) => {
    circ(c, 0, 0.04, 0.41, '#f39223');
    for (let i = 0; i < 8; i++) circ(c, Math.cos(i) * 0.25, 0.04 + Math.sin(i * 1.7) * 0.22, 0.015, 'rgba(180,90,10,0.4)', false);
    shine(c, -0.15, -0.1, 0.1, 0.06, -0.5);
    c.beginPath(); c.moveTo(0, -0.34); c.quadraticCurveTo(0.18, -0.52, 0.32, -0.4); c.quadraticCurveTo(0.16, -0.3, 0, -0.34); fs(c, '#4f8a3a', OUT, 0.03);
    circ(c, 0, -0.35, 0.05, '#6a5a2a', false);
  };
  D.tebukuro = (c, v) => {
    const col = v ? '#3d7cc4' : '#d94a3a';
    rr(c, -0.26, -0.44, 0.46, 0.7, 0.22, col);
    ell(c, 0.28, -0.04, 0.1, 0.18, -0.6, col);
    rr(c, -0.3, 0.2, 0.54, 0.24, 0.05, '#f4efe3');
    for (let i = 0; i < 3; i++) ln(c, -0.2, -0.2 + i * 0.12, 0.14, -0.2 + i * 0.12, 'rgba(255,255,255,0.45)', 0.035);
  };
  D.keito = (c, v) => {
    const col = v ? '#9b6cc2' : '#e2804a';
    circ(c, 0, 0.02, 0.4, col);
    for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(0, 0.02, 0.4, 0.12 + i * 0.05, -0.5 + i * 0.35, 0, PI); c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 0.025; c.stroke(); }
    c.beginPath(); c.moveTo(0.3, 0.28); c.quadraticCurveTo(0.5, 0.45, 0.25, 0.48); c.strokeStyle = col; c.lineWidth = 0.05; c.stroke();
  };
  D.kendama = (c) => {
    rr(c, -0.05, -0.18, 0.1, 0.62, 0.03, '#d9b47d');
    rr(c, -0.26, -0.12, 0.52, 0.12, 0.05, '#d9b47d');
    ell(c, -0.26, -0.06, 0.06, 0.08, 0, '#c99a62'); ell(c, 0.26, -0.06, 0.06, 0.08, 0, '#c99a62');
    circ(c, 0, -0.33, 0.17, '#d9473a');
    shine(c, -0.06, -0.39, 0.05, 0.03, -0.5);
    c.beginPath(); c.moveTo(0, -0.17); c.quadraticCurveTo(0.2, 0.0, 0.05, 0.25); c.strokeStyle = '#eee'; c.lineWidth = 0.02; c.stroke();
  };
  function daruma(c, v, eyes) {
    const body = v === 1 ? '#f4efe6' : (v === 2 ? '#f0c24a' : '#d73a2f');
    c.beginPath(); c.moveTo(0, -0.45); c.bezierCurveTo(0.44, -0.45, 0.48, 0.2, 0.36, 0.38); c.quadraticCurveTo(0, 0.5, -0.36, 0.38); c.bezierCurveTo(-0.48, 0.2, -0.44, -0.45, 0, -0.45); fs(c, body);
    ell(c, 0, -0.12, 0.25, 0.21, 0, '#fbf3e4');
    // まゆ・ひげ
    c.beginPath(); c.moveTo(-0.2, -0.24); c.quadraticCurveTo(-0.12, -0.32, -0.04, -0.24); c.moveTo(0.04, -0.24); c.quadraticCurveTo(0.12, -0.32, 0.2, -0.24); c.strokeStyle = OUT; c.lineWidth = 0.04; c.stroke();
    circ(c, -0.1, -0.13, 0.065, '#fff', OUT, 0.02); circ(c, 0.1, -0.13, 0.065, '#fff', OUT, 0.02);
    if (eyes >= 1) circ(c, -0.1, -0.13, 0.04, OUT, false);
    if (eyes >= 2) circ(c, 0.1, -0.13, 0.04, OUT, false);
    c.beginPath(); c.moveTo(-0.14, -0.01); c.quadraticCurveTo(0, 0.04, 0.14, -0.01); c.stroke();
    txt(c, '福', 0, 0.22, 0.2, v === 2 ? '#d73a2f' : '#f0c24a');
    shine(c, -0.22, -0.28, 0.06, 0.1, 0.4);
  }
  D.daruma_s = (c, v) => daruma(c, v, 0);
  D.daruma_m = (c, v) => daruma(c, v, 1);
  D.daruma_l = (c) => daruma(c, 0, 1);
  D.daruma_xl = (c) => daruma(c, 0, 1);
  D.t_negai = (c) => daruma(c, 2, 2);
  D.geta = (c) => {
    rr(c, -0.46, -0.06, 0.92, 0.2, 0.06, '#c99a62');
    rr(c, -0.34, 0.14, 0.12, 0.26, 0.02, '#a0703f'); rr(c, 0.22, 0.14, 0.12, 0.26, 0.02, '#a0703f');
    c.beginPath(); c.moveTo(-0.3, -0.06); c.quadraticCurveTo(0.05, -0.4, 0.05, -0.06); c.moveTo(0.05, -0.06); c.quadraticCurveTo(0.08, -0.4, 0.34, -0.06); c.strokeStyle = '#d63a3a'; c.lineWidth = 0.07; c.stroke();
  };
  D.kagami = (c) => {
    poly(c, [-0.42, 0.2, 0.42, 0.2, 0.36, 0.45, -0.36, 0.45], '#e8d2a2'); rr(c, -0.1, 0.27, 0.2, 0.12, 0.02, '#c6a96f', OUT, 0.025);
    ell(c, 0, 0.08, 0.38, 0.15, 0, '#fbf8f0'); ell(c, 0, -0.08, 0.3, 0.13, 0, '#fdfbf5');
    circ(c, 0, -0.27, 0.13, '#f39223'); c.beginPath(); c.ellipse(0.05, -0.39, 0.08, 0.035, -0.4, 0, TAU); fs(c, '#4f8a3a', OUT, 0.02);
    ln(c, -0.38, 0.17, 0.38, 0.17, '#d63a3a', 0.03);
  };
  D.kakizome = (c, v) => {
    rr(c, -0.3, -0.48, 0.6, 0.96, 0.02, '#fbf6ea');
    txt(c, ['春', '夢', '凧'][v], 0, -0.08, 0.5, '#1f1a18');
    rr(c, 0.08, 0.28, 0.12, 0.12, 0.01, '#d63a3a', false);
    txt(c, 'こはる', -0.14, 0.33, 0.08, '#1f1a18', '400 ');
  };
  D.hagoita = (c, v) => {
    c.beginPath(); c.moveTo(-0.22, 0.12); c.lineTo(-0.24, -0.38); c.quadraticCurveTo(0, -0.52, 0.24, -0.38); c.lineTo(0.22, 0.12); c.closePath(); fs(c, '#e9c890');
    rr(c, -0.06, 0.1, 0.12, 0.35, 0.03, '#d6b07a');
    circ(c, 0, -0.26, 0.09, '#fbe8d8', OUT, 0.025);
    c.beginPath(); c.moveTo(-0.09, -0.32); c.quadraticCurveTo(0, -0.42, 0.09, -0.32); fs(c, '#2a2422', false);
    poly(c, [-0.16, -0.16, 0.16, -0.16, 0.18, 0.08, -0.18, 0.08], v ? '#3d7cc4' : '#d63a3a', OUT, 0.025);
    ln(c, -0.12, -0.04, 0.12, -0.04, '#f2c544', 0.04);
  };
  D.zaru = (c) => {
    circ(c, 0, 0, 0.47, '#d8b46e');
    for (let i = 1; i < 5; i++) circ(c, 0, 0, i * 0.1, false, 'rgba(120,85,40,0.5)', 0.02);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ln(c, 0, 0, Math.cos(a) * 0.46, Math.sin(a) * 0.46, 'rgba(120,85,40,0.35)', 0.015); }
    circ(c, 0, 0, 0.47, false, OUT, 0.05);
  };
  D.jouro = (c) => {
    rr(c, -0.3, -0.18, 0.46, 0.62, 0.08, '#5aa36b');
    ell(c, -0.07, -0.18, 0.23, 0.06, 0, '#4b8a5b');
    poly(c, [0.12, 0.25, 0.46, -0.32, 0.4, -0.35, 0.1, 0.15], '#5aa36b');
    ell(c, 0.44, -0.36, 0.06, 0.08, 0.6, '#4b8a5b');
    c.beginPath(); c.arc(-0.3, 0.06, 0.16, PI * 0.5, PI * 1.5); c.strokeStyle = OUT; c.lineWidth = 0.07; c.stroke();
    shine(c, -0.18, 0.05, 0.04, 0.16);
  };
  D.baketsu = (c) => {
    poly(c, [-0.36, -0.25, 0.36, -0.25, 0.27, 0.43, -0.27, 0.43], '#7fa6c8');
    ell(c, 0, -0.25, 0.36, 0.09, 0, '#4e6f8c');
    c.beginPath(); c.moveTo(-0.36, -0.25); c.quadraticCurveTo(0, -0.62, 0.36, -0.25); c.strokeStyle = OUT; c.lineWidth = 0.035; c.stroke();
    ln(c, -0.32, 0.0, 0.32, 0.0, 'rgba(0,0,0,0.2)', 0.03); ln(c, -0.3, 0.2, 0.3, 0.2, 'rgba(0,0,0,0.2)', 0.03);
    shine(c, -0.18, 0.05, 0.05, 0.18);
  };
  D.ita = (c) => { rr(c, -0.48, -0.12, 0.96, 0.24, 0.03, '#b98a55'); for (let i = 0; i < 3; i++) ln(c, -0.42, -0.06 + i * 0.06, 0.42, -0.07 + i * 0.07, 'rgba(90,60,30,0.35)', 0.015); };

  // ════ その二 ════
  D.tourou = (c) => {
    const st = '#a7a49b', sd = '#7f7c74';
    rr(c, -0.3, 0.32, 0.6, 0.12, 0.02, st);
    rr(c, -0.08, 0.0, 0.16, 0.32, 0.02, st);
    rr(c, -0.22, -0.06, 0.44, 0.08, 0.02, sd);
    rr(c, -0.16, -0.28, 0.32, 0.22, 0.02, st);
    rr(c, -0.06, -0.24, 0.12, 0.13, 0.01, '#3b3530', false);
    poly(c, [-0.36, -0.3, 0, -0.44, 0.36, -0.3, 0.28, -0.26, -0.28, -0.26], sd);
    circ(c, 0, -0.47, 0.05, st);
    circ(c, -0.2, 0.36, 0.03, '#7b9a5a', false); circ(c, 0.15, -0.36, 0.03, '#7b9a5a', false);
  };
  D.wara = (c) => {
    for (let i = -5; i <= 5; i++) ln(c, i * 0.035, -0.45, i * 0.06, 0.45, i % 2 ? '#e3c26c' : '#c9a24e', 0.05);
    rr(c, -0.2, -0.04, 0.4, 0.09, 0.02, '#a0703f');
  };
  D.daikon = (c) => {
    c.beginPath(); c.moveTo(-0.12, -0.12); c.quadraticCurveTo(-0.14, 0.3, 0, 0.47); c.quadraticCurveTo(0.14, 0.3, 0.12, -0.12); c.closePath(); fs(c, '#f7f5ec');
    ln(c, -0.04, 0.05, 0.03, 0.06, 'rgba(0,0,0,0.2)', 0.015); ln(c, -0.05, 0.2, 0.02, 0.21, 'rgba(0,0,0,0.2)', 0.015);
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(i * 0.07, -0.3, 0.07, 0.2, i * 0.3, 0, TAU); fs(c, '#4f9a3c', OUT, 0.025); }
    ell(c, 0, -0.12, 0.12, 0.04, 0, '#c8e6a8', false);
  };
  D.hakusai = (c) => {
    ell(c, 0, 0.05, 0.3, 0.42, 0, '#9fcf6a');
    ell(c, -0.05, 0.12, 0.18, 0.33, -0.15, '#f1f4e2');
    ell(c, 0.1, 0.1, 0.16, 0.33, 0.2, '#e4efc8');
    ell(c, 0.02, -0.18, 0.22, 0.2, 0, '#b8de85', OUT, 0.03);
  };
  D.negi = (c) => {
    rr(c, -0.07, -0.05, 0.14, 0.5, 0.06, '#f6f6ea');
    ln(c, -0.04, -0.05, -0.2, -0.48, '#5a9e3c', 0.08); ln(c, 0, -0.05, 0.02, -0.5, '#4b8c33', 0.08); ln(c, 0.04, -0.05, 0.2, -0.45, '#5a9e3c', 0.08);
    for (let i = 0; i < 4; i++) ln(c, -0.05 + i * 0.03, 0.44, -0.07 + i * 0.04, 0.5, '#d6cfa8', 0.015);
  };
  D.kaki = (c) => {
    ell(c, 0, 0.06, 0.44, 0.37, 0, '#ee7a22');
    shine(c, -0.18, -0.06, 0.1, 0.06, -0.4);
    const p = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; const r = i % 2 ? 0.08 : 0.22; p.push(Math.cos(a) * r, -0.26 + Math.sin(a) * r * 0.5); }
    poly(c, p, '#5e7a33', OUT, 0.025);
    ln(c, 0, -0.28, 0, -0.42, '#5a4a2a', 0.05);
  };
  D.kago = (c) => {
    poly(c, [-0.36, -0.4, 0.36, -0.4, 0.26, 0.44, -0.26, 0.44], '#b98a4e');
    for (let i = 0; i < 5; i++) ln(c, -0.33 + i * 0.01, -0.3 + i * 0.16, 0.33 - i * 0.01, -0.3 + i * 0.16, 'rgba(90,60,30,0.45)', 0.03);
    for (let i = -3; i <= 3; i++) ln(c, i * 0.1, -0.4, i * 0.075, 0.44, 'rgba(90,60,30,0.3)', 0.02);
    ell(c, 0, -0.4, 0.36, 0.07, 0, '#8e6638');
  };
  D.nagagutsu = (c) => {
    c.beginPath(); c.moveTo(-0.2, -0.45); c.lineTo(0.12, -0.45); c.lineTo(0.14, 0.15); c.quadraticCurveTo(0.44, 0.2, 0.44, 0.38); c.lineTo(-0.22, 0.38); c.closePath(); fs(c, '#2f6e4a');
    rr(c, -0.24, 0.34, 0.7, 0.1, 0.03, '#2a2422');
    rr(c, -0.22, -0.48, 0.36, 0.08, 0.02, '#3f8a5e');
    shine(c, -0.08, -0.1, 0.03, 0.2);
  };
  D.shichirin = (c) => {
    poly(c, [-0.36, -0.2, 0.36, -0.2, 0.3, 0.44, -0.3, 0.44], '#e8cfa0');
    ell(c, 0, -0.2, 0.36, 0.09, 0, '#4a3b32');
    for (let i = -3; i <= 3; i++) ln(c, i * 0.09, -0.27, i * 0.09, -0.13, '#999', 0.02);
    rr(c, -0.12, 0.15, 0.24, 0.15, 0.02, '#6b4a3a');
    ln(c, -0.33, 0.05, 0.33, 0.05, '#d6b67e', 0.03);
  };
  D.yakan = (c) => {
    c.beginPath(); c.moveTo(-0.36, 0.4); c.quadraticCurveTo(-0.46, -0.1, 0, -0.14); c.quadraticCurveTo(0.46, -0.1, 0.36, 0.4); c.closePath(); fs(c, '#c8cdd2');
    poly(c, [0.3, 0.1, 0.5, -0.12, 0.46, -0.16, 0.26, 0.0], '#b3b9bf');
    c.beginPath(); c.arc(0, -0.12, 0.28, PI, TAU); c.strokeStyle = OUT; c.lineWidth = 0.05; c.stroke();
    circ(c, 0, -0.15, 0.06, '#2a2422');
    shine(c, -0.2, 0.1, 0.05, 0.14, 0.2);
  };
  D.zabuton = (c, v) => {
    const col = v ? '#c8463b' : '#3f5f9a';
    rr(c, -0.46, -0.46, 0.92, 0.92, 0.18, col);
    rr(c, -0.38, -0.38, 0.76, 0.76, 0.14, false, 'rgba(255,255,255,0.35)', 0.03);
    for (const p of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3], [0, 0]]) circ(c, p[0], p[1], 0.04, '#f2c544', false);
  };
  D.kine = (c) => {
    rr(c, -0.04, -0.2, 0.08, 0.65, 0.03, '#c99a62');
    rr(c, -0.38, -0.46, 0.76, 0.28, 0.1, '#b98a55');
    ell(c, -0.38, -0.32, 0.06, 0.14, 0, '#d9b47d'); ell(c, 0.38, -0.32, 0.06, 0.14, 0, '#d9b47d');
  };
  D.usu = (c) => {
    c.beginPath(); c.moveTo(-0.42, -0.25); c.quadraticCurveTo(-0.3, 0.1, -0.4, 0.42); c.lineTo(0.4, 0.42); c.quadraticCurveTo(0.3, 0.1, 0.42, -0.25); c.closePath(); fs(c, '#a0703f');
    ell(c, 0, -0.25, 0.42, 0.14, 0, '#c99a62'); ell(c, 0, -0.24, 0.3, 0.09, 0, '#6f4a2c', false);
    ell(c, 0, -0.25, 0.22, 0.06, 0, '#fbf8f0', false);
    for (let i = 0; i < 3; i++) ln(c, -0.32, 0.0 + i * 0.13, 0.32, 0.0 + i * 0.13, 'rgba(60,40,20,0.3)', 0.02);
  };
  D.ichirinsha = (c) => {
    poly(c, [-0.32, -0.12, 0.3, -0.12, 0.18, 0.16, -0.24, 0.16], '#4b8a5b');
    ln(c, -0.3, -0.06, -0.5, -0.24, '#6f4a2c', 0.05); ln(c, 0.28, -0.06, 0.48, -0.2, '#6f4a2c', 0.05);
    ln(c, -0.1, 0.16, -0.14, 0.42, '#555', 0.04);
    circ(c, 0.24, 0.3, 0.14, '#2a2422'); circ(c, 0.24, 0.3, 0.05, '#aaa', false);
  };
  D.sukoppu = (c) => {
    rr(c, -0.035, -0.32, 0.07, 0.48, 0.02, '#c99a62');
    rr(c, -0.12, -0.46, 0.24, 0.12, 0.05, '#c99a62');
    c.beginPath(); c.moveTo(-0.15, 0.12); c.lineTo(0.15, 0.12); c.lineTo(0.13, 0.36); c.quadraticCurveTo(0, 0.48, -0.13, 0.36); c.closePath(); fs(c, '#8f9aa3');
    shine(c, -0.06, 0.25, 0.03, 0.08);
  };
  D.kuwa = (c) => {
    ln(c, -0.32, 0.45, 0.25, -0.45, '#c99a62', 0.08);
    poly(c, [0.15, -0.35, 0.45, -0.18, 0.4, -0.05, 0.1, -0.25], '#8f9aa3');
  };
  D.shatsu = (c, v) => {
    const col = ['#f4f1e6', '#7fb0dc', '#e8a3a3'][v];
    poly(c, [-0.18, -0.42, -0.46, -0.28, -0.38, -0.08, -0.26, -0.14, -0.26, 0.44, 0.26, 0.44, 0.26, -0.14, 0.38, -0.08, 0.46, -0.28, 0.18, -0.42, 0.08, -0.34, -0.08, -0.34], col);
    poly(c, [-0.08, -0.34, 0, -0.22, 0.08, -0.34], '#fff', OUT, 0.025);
    ln(c, 0, -0.22, 0, 0.42, 'rgba(0,0,0,0.25)', 0.02);
    for (let i = 0; i < 3; i++) circ(c, 0, -0.1 + i * 0.16, 0.025, '#aaa', false);
  };
  D.taoru = (c, v) => {
    rr(c, -0.48, -0.22, 0.96, 0.44, 0.03, '#fbf6ea');
    if (v) { for (let i = 0; i < 6; i++) circ(c, -0.38 + i * 0.15, (i % 2 ? -0.07 : 0.07), 0.05, '#d63a3a', false); }
    else { for (let i = 0; i < 5; i++) ln(c, -0.4 + i * 0.2, -0.2, -0.3 + i * 0.2, 0.2, '#3f5f9a', 0.06); }
  };
  D.kutsushita = (c, v) => {
    c.beginPath(); c.moveTo(-0.2, -0.46); c.lineTo(0.12, -0.46); c.lineTo(0.12, 0.08); c.quadraticCurveTo(0.42, 0.12, 0.42, 0.32); c.quadraticCurveTo(0.42, 0.46, 0.1, 0.44); c.lineTo(-0.12, 0.44); c.quadraticCurveTo(-0.24, 0.42, -0.2, 0.2); c.closePath(); fs(c, v ? '#f2c544' : '#e8e2d2');
    for (let i = 0; i < 3; i++) ln(c, -0.19, -0.38 + i * 0.1, 0.11, -0.38 + i * 0.1, v ? '#d63a3a' : '#3f5f9a', 0.04);
  };
  D.mugiwara = (c) => {
    ell(c, 0, 0.22, 0.48, 0.16, 0, '#e8c97a');
    c.beginPath(); c.moveTo(-0.26, 0.2); c.quadraticCurveTo(-0.26, -0.3, 0, -0.3); c.quadraticCurveTo(0.26, -0.3, 0.26, 0.2); c.closePath(); fs(c, '#efd38a');
    rr(c, -0.26, 0.04, 0.52, 0.1, 0.02, '#d63a3a', false);
    for (let i = 0; i < 4; i++) arcS(c, 0, 0.22, 0.3 + i * 0.04, PI * 0.1, PI * 0.9, 'rgba(150,110,40,0.4)', 0.015);
  };
  D.kimono = (c) => {
    poly(c, [-0.2, -0.44, -0.48, -0.32, -0.48, 0.0, -0.24, 0.0, -0.24, 0.44, 0.24, 0.44, 0.24, 0.0, 0.48, 0.0, 0.48, -0.32, 0.2, -0.44, 0, -0.2], '#5a7fa8');
    rr(c, -0.2, -0.05, 0.16, 0.18, 0.02, '#c9a24e', OUT, 0.02); rr(c, 0.06, 0.18, 0.16, 0.16, 0.02, '#c8463b', OUT, 0.02); rr(c, -0.44, -0.28, 0.14, 0.12, 0.02, '#7aa35a', OUT, 0.02);
    ln(c, -0.24, 0.05, 0.24, 0.05, '#2a2422', 0.07);
  };
  function pole(c, col, node, ring) {
    rr(c, -0.48, -0.05, 0.96, 0.1, 0.05, col);
    if (node) for (let i = -2; i <= 2; i++) ln(c, i * 0.2, -0.05, i * 0.2, 0.05, node, 0.03);
    if (ring) { circ(c, 0.46, 0, 0.05, ring); }
  }
  D.take = (c) => pole(c, '#7fb04f', '#4f7a2c');
  D.hashira = (c) => pole(c, '#c9a46a', '#8e6638');
  D.tawara = (c) => {
    rr(c, -0.46, -0.24, 0.92, 0.6, 0.28, '#e3c26c');
    ell(c, -0.36, 0.06, 0.12, 0.3, 0, '#c9a24e'); ell(c, 0.36, 0.06, 0.12, 0.3, 0, '#c9a24e');
    for (const x of [-0.18, 0.0, 0.18]) ln(c, x, -0.24, x, 0.36, '#8e6638', 0.04);
    for (let i = -6; i <= 6; i++) ln(c, i * 0.06, -0.18, i * 0.06, 0.32, 'rgba(160,120,50,0.3)', 0.012);
  };
  D.kadomatsu = (c) => {
    for (const [x, h] of [[-0.12, -0.42], [0.12, -0.32], [0, -0.48]]) {
      rr(c, x - 0.07, h, 0.14, 0.62, 0.02, '#6fab45');
      poly(c, [x - 0.07, h + 0.06, x + 0.07, h, x + 0.07, h + 0.03], '#d9ecb0', OUT, 0.02);
      ln(c, x - 0.07, h + 0.3, x + 0.07, h + 0.3, '#3f7a2a', 0.02);
    }
    for (const s of [-1, 1]) { for (let i = 0; i < 4; i++) ln(c, s * 0.2, 0.05, s * (0.3 + i * 0.04), -0.1 - i * 0.05, '#2f6a35', 0.035); }
    rr(c, -0.26, 0.1, 0.52, 0.34, 0.06, '#d4b06a');
    for (let i = 0; i < 3; i++) ln(c, -0.26, 0.17 + i * 0.1, 0.26, 0.17 + i * 0.1, '#8e6638', 0.035);
    circ(c, 0.22, 0.1, 0.05, '#e2553b', false); circ(c, -0.2, 0.08, 0.04, '#e2553b', false);
  };
  D.monita = (c) => {
    rr(c, -0.48, -0.32, 0.96, 0.64, 0.02, '#9b6c3c');
    for (let i = 1; i < 5; i++) ln(c, -0.48 + i * 0.19, -0.32, -0.48 + i * 0.19, 0.32, 'rgba(50,30,15,0.45)', 0.025);
    ln(c, -0.48, -0.12, 0.48, -0.12, '#6f4a2c', 0.06); ln(c, -0.48, 0.14, 0.48, 0.14, '#6f4a2c', 0.06);
  };
  D.hoshigaki = (c) => {
    ln(c, 0, -0.48, 0, 0.42, '#a88a5a', 0.03);
    for (let i = 0; i < 5; i++) { ell(c, (i % 2 ? 0.07 : -0.07), -0.36 + i * 0.18, 0.12, 0.09, 0, '#b8562a'); }
  };
  D.mushiro = (c) => {
    rr(c, -0.48, -0.3, 0.96, 0.6, 0.03, '#d6b874');
    for (let i = -7; i <= 7; i++) ln(c, i * 0.06, -0.28, i * 0.06, 0.28, 'rgba(140,100,40,0.35)', 0.015);
    rr(c, -0.48, -0.3, 0.96, 0.6, 0.03, false, '#a8823e', 0.04);
  };

  // ════ その三 ════
  D.jitensha = (c, v) => {
    const col = ['#d63a3a', '#3d7cc4', '#3f8a5e'][v];
    circ(c, -0.28, 0.2, 0.2, false, OUT, 0.05); circ(c, 0.28, 0.2, 0.2, false, OUT, 0.05);
    circ(c, -0.28, 0.2, 0.03, '#999', false); circ(c, 0.28, 0.2, 0.03, '#999', false);
    poly(c, [-0.28, 0.2, -0.04, 0.2, 0.18, -0.08, -0.12, -0.08], false, col, 0.06, false);
    ln(c, -0.04, 0.2, -0.14, -0.2, col, 0.06); ln(c, 0.18, -0.08, 0.28, 0.2, col, 0.06); ln(c, 0.18, -0.08, 0.14, -0.24, col, 0.05);
    rr(c, -0.24, -0.26, 0.18, 0.06, 0.03, '#2a2422'); ln(c, 0.08, -0.26, 0.22, -0.26, '#2a2422', 0.05);
    rr(c, 0.18, -0.24, 0.2, 0.14, 0.02, false, '#888', 0.03);
  };
  D.riyakaa = (c) => {
    rr(c, -0.46, -0.12, 0.8, 0.18, 0.02, '#9aa3a9');
    rr(c, -0.4, -0.38, 0.28, 0.26, 0.02, '#e9c27a', OUT, 0.03); rr(c, -0.08, -0.36, 0.28, 0.24, 0.02, '#e9c27a', OUT, 0.03);
    circ(c, -0.24, -0.4, 0.05, '#f39223', false); circ(c, 0.06, -0.38, 0.05, '#f39223', false);
    ln(c, 0.34, -0.03, 0.5, -0.03, '#6f6f6f', 0.04);
    circ(c, -0.05, 0.22, 0.2, false, OUT, 0.05); circ(c, -0.05, 0.22, 0.04, '#999', false);
  };
  function tanuki(c, hat) {
    const b = '#8a5a35', bl = '#d9b48a';
    ell(c, 0, 0.18, 0.36, 0.28, 0, b);
    ell(c, 0, 0.2, 0.22, 0.2, 0, bl);
    circ(c, 0, -0.22, 0.22, b);
    circ(c, -0.16, -0.38, 0.07, b); circ(c, 0.16, -0.38, 0.07, b);
    ell(c, 0, -0.18, 0.15, 0.1, 0, bl, false);
    ell(c, -0.08, -0.25, 0.06, 0.045, 0, '#3a2a20', false); ell(c, 0.08, -0.25, 0.06, 0.045, 0, '#3a2a20', false);
    circ(c, -0.08, -0.26, 0.02, '#fff', false); circ(c, 0.08, -0.26, 0.02, '#fff', false);
    circ(c, 0, -0.17, 0.035, '#2a2422', false);
    if (hat) { ell(c, 0, -0.42, 0.26, 0.07, 0, '#d6b16a'); poly(c, [-0.14, -0.42, 0, -0.56, 0.14, -0.42], '#d6b16a', OUT, 0.03); }
    rr(c, 0.22, -0.02, 0.14, 0.24, 0.05, '#e8e2d2'); txt(c, '酒', 0.29, 0.1, 0.1, OUT);
    shine(c, -0.12, 0.05, 0.05, 0.1);
  }
  D.tanuki_s = (c) => tanuki(c, false);
  D.tanuki_m = (c) => tanuki(c, true);
  D.tanuki_l = (c) => tanuki(c, true);
  D.nobori = (c, v) => {
    const col = ['#d63a3a', '#3d7cc4', '#3f8a5e'][v];
    ln(c, -0.2, -0.48, -0.2, 0.45, '#8e6638', 0.04);
    ln(c, -0.2, -0.46, 0.2, -0.46, '#8e6638', 0.03);
    rr(c, -0.18, -0.44, 0.36, 0.78, 0.01, col);
    vtxt(c, ['福', '初売', '大安'][v], 0, -0.32, 0.18, '#fbf6ea');
  };
  D.chouchin = (c) => {
    ell(c, 0, 0, 0.3, 0.4, 0, '#e2453a');
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(0, i * 0.12, 0.3 * Math.sqrt(1 - (i * 0.12 / 0.4) ** 2), 0.02, 0, 0, TAU); c.strokeStyle = 'rgba(80,20,10,0.4)'; c.lineWidth = 0.02; c.stroke(); }
    rr(c, -0.16, -0.46, 0.32, 0.08, 0.02, '#2a2422'); rr(c, -0.16, 0.38, 0.32, 0.08, 0.02, '#2a2422');
    txt(c, '祭', 0, 0.0, 0.26, '#2a2422');
    shine(c, -0.14, -0.1, 0.05, 0.14);
  };
  D.kanban = (c, v) => {
    poly(c, [-0.3, 0.45, -0.2, -0.45, 0.2, -0.45, 0.3, 0.45], false, '#6f4a2c', 0.05);
    rr(c, -0.24, -0.42, 0.48, 0.66, 0.02, v ? '#fbf6ea' : '#2f4b3a');
    vtxt(c, v ? 'だんご' : 'おしるこ', 0, -0.3, 0.13, v ? '#2a2422' : '#fbf6ea');
  };
  D.sakadaru = (c) => {
    rr(c, -0.36, -0.36, 0.72, 0.8, 0.12, '#e8dcc0');
    ell(c, 0, -0.36, 0.36, 0.08, 0, '#c99a62');
    for (const y of [-0.2, 0.3]) ln(c, -0.36, y, 0.36, y, '#2a2422', 0.05);
    rr(c, -0.18, -0.12, 0.36, 0.36, 0.02, '#d63a3a', OUT, 0.03);
    txt(c, '寿', 0, 0.06, 0.22, '#fbf6ea');
  };
  D.kibako = (c) => {
    poly(c, [-0.42, -0.2, 0.32, -0.2, 0.44, -0.34, -0.3, -0.34], '#d9b47d');
    rr(c, -0.42, -0.2, 0.74, 0.62, 0.02, '#c99a62');
    poly(c, [0.32, -0.2, 0.44, -0.34, 0.44, 0.28, 0.32, 0.42], '#a0703f');
    for (let i = 1; i < 3; i++) ln(c, -0.42, -0.2 + i * 0.2, 0.32, -0.2 + i * 0.2, 'rgba(80,50,20,0.5)', 0.025);
    txt(c, 'りんご', -0.05, 0.1, 0.12, '#d63a3a', '700 ');
  };
  D.ringo = (c) => {
    c.beginPath(); c.moveTo(0, -0.28); c.bezierCurveTo(0.5, -0.5, 0.55, 0.3, 0, 0.42); c.bezierCurveTo(-0.55, 0.3, -0.5, -0.5, 0, -0.28); fs(c, '#d8333a');
    shine(c, -0.18, -0.08, 0.07, 0.12, 0.3);
    ln(c, 0, -0.28, 0.04, -0.46, '#5a3a20', 0.05); ell(c, 0.13, -0.38, 0.1, 0.05, -0.4, '#4f8a3a', OUT, 0.025);
  };
  D.fukubukuro = (c, v) => {
    const col = v ? '#f0c24a' : '#d63a3a';
    c.beginPath(); c.moveTo(-0.16, -0.3); c.quadraticCurveTo(-0.46, -0.1, -0.4, 0.3); c.quadraticCurveTo(0, 0.5, 0.4, 0.3); c.quadraticCurveTo(0.46, -0.1, 0.16, -0.3); c.closePath(); fs(c, col);
    poly(c, [-0.16, -0.3, -0.24, -0.46, 0, -0.38, 0.24, -0.46, 0.16, -0.3], col);
    ln(c, -0.18, -0.3, 0.18, -0.3, v ? '#d63a3a' : '#f0c24a', 0.06);
    circ(c, 0, 0.06, 0.17, v ? '#d63a3a' : '#fbf6ea', false);
    txt(c, '福', 0, 0.07, 0.22, v ? '#fbf6ea' : '#d63a3a');
    if (v) { for (let i = 0; i < 4; i++) { const a = i * 1.6; circ(c, Math.cos(a) * 0.3, 0.1 + Math.sin(a) * 0.2, 0.025, '#fff', false); } }
  };
  D.omen = (c, v) => {
    if (v === 0) {
      c.beginPath(); c.moveTo(0, 0.42); c.quadraticCurveTo(-0.4, 0.05, -0.32, -0.3); c.lineTo(-0.2, -0.46); c.lineTo(-0.1, -0.3); c.lineTo(0.1, -0.3); c.lineTo(0.2, -0.46); c.lineTo(0.32, -0.3); c.quadraticCurveTo(0.4, 0.05, 0, 0.42); fs(c, '#fbf8f0');
      poly(c, [-0.22, -0.12, -0.06, -0.06, -0.2, -0.04], '#d63a3a', false); poly(c, [0.22, -0.12, 0.06, -0.06, 0.2, -0.04], '#d63a3a', false);
      ln(c, -0.18, -0.08, -0.08, -0.06, OUT, 0.03); ln(c, 0.18, -0.08, 0.08, -0.06, OUT, 0.03);
      circ(c, 0, 0.32, 0.04, OUT, false); poly(c, [-0.24, -0.38, -0.2, -0.3, -0.14, -0.33], '#d63a3a', false); poly(c, [0.24, -0.38, 0.2, -0.3, 0.14, -0.33], '#d63a3a', false);
    } else if (v === 1) {
      ell(c, 0, 0, 0.36, 0.44, 0, '#f2d27a');
      circ(c, -0.13, -0.1, 0.06, '#fff', OUT, 0.025); circ(c, 0.14, -0.14, 0.08, '#fff', OUT, 0.025); circ(c, -0.13, -0.1, 0.025, OUT, false); circ(c, 0.14, -0.14, 0.03, OUT, false);
      circ(c, 0.22, 0.18, 0.06, '#f6c4a8', OUT, 0.025); ln(c, 0.04, 0.12, 0.2, 0.18, OUT, 0.03);
      ln(c, -0.2, -0.26, -0.06, -0.22, OUT, 0.03); ln(c, 0.06, -0.3, 0.22, -0.3, OUT, 0.03);
    } else {
      ell(c, 0, 0.02, 0.4, 0.44, 0, '#fbf8f0');
      ell(c, -0.22, 0.12, 0.08, 0.05, 0, '#f4a3a3', false); ell(c, 0.22, 0.12, 0.08, 0.05, 0, '#f4a3a3', false);
      arcS(c, -0.13, -0.06, 0.06, PI * 1.1, PI * 1.9, OUT, 0.03); arcS(c, 0.13, -0.06, 0.06, PI * 1.1, PI * 1.9, OUT, 0.03);
      circ(c, -0.12, -0.3, 0.035, OUT, false); circ(c, 0.12, -0.3, 0.035, OUT, false);
      arcS(c, 0, 0.15, 0.07, PI * 0.15, PI * 0.85, '#d63a3a', 0.04);
    }
  };
  D.kazaguruma = (c, v) => {
    ln(c, 0, -0.05, 0, 0.47, '#c99a62', 0.045);
    const cols = v ? ['#e2553b', '#f2c544', '#5cb36a', '#3d8fd6'] : ['#f28aa8', '#fbf6ea', '#9b6cc2', '#fbf6ea'];
    for (let i = 0; i < 4; i++) { c.save(); c.translate(0, -0.18); c.rotate(i * PI / 2 + 0.3); poly(c, [0, 0, 0.3, -0.04, 0.02, -0.3], cols[i], OUT, 0.025); c.restore(); }
    circ(c, 0, -0.18, 0.04, '#f2c544');
  };
  D.wataame = (c) => {
    ln(c, 0, 0.0, 0, 0.47, '#e8dcc0', 0.04);
    for (const [x, y, r] of [[0, -0.2, 0.22], [-0.17, -0.1, 0.16], [0.17, -0.1, 0.16], [-0.1, -0.35, 0.14], [0.12, -0.33, 0.14]]) circ(c, x, y, r, '#f9c4da', false);
    blob(c, 0, -0.2, 0.36, 0.3, 9, 3, 0.15, false, '#e590b4', 0.03);
    shine(c, -0.1, -0.3, 0.07, 0.04);
  };
  D.taiyaki = (c) => {
    c.beginPath(); c.moveTo(-0.46, 0); c.quadraticCurveTo(-0.2, -0.32, 0.22, -0.18); c.lineTo(0.46, -0.3); c.lineTo(0.38, 0); c.lineTo(0.46, 0.3); c.lineTo(0.22, 0.18); c.quadraticCurveTo(-0.2, 0.32, -0.46, 0); fs(c, '#c8863e');
    circ(c, -0.3, -0.04, 0.04, OUT, false);
    for (let i = 0; i < 4; i++) arcS(c, -0.05 + i * 0.08, 0, 0.1, -0.9, 0.9, 'rgba(100,60,20,0.4)', 0.02);
  };
  D.ringoame = (c) => { ln(c, 0, 0.0, 0, 0.47, '#e8dcc0', 0.04); circ(c, 0, -0.16, 0.28, '#e42b3a'); shine(c, -0.1, -0.26, 0.08, 0.05, -0.5); ln(c, 0, -0.42, 0.02, -0.5, '#5a3a20', 0.04); };
  D.yane = (c, v) => {
    rr(c, -0.48, -0.3, 0.96, 0.6, 0.02, '#fbf6ea');
    for (let i = 0; i < 5; i++) rr(c, -0.48 + i * 0.2, -0.3, 0.1, 0.6, 0, v ? '#3d7cc4' : '#d63a3a', false);
    for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(-0.4 + i * 0.16, 0.3, 0.08, 0, PI); fs(c, v ? '#3d7cc4' : '#d63a3a', OUT, 0.02); }
    rr(c, -0.48, -0.3, 0.96, 0.6, 0.02, false);
  };
  D.benchi = (c) => {
    rr(c, -0.48, -0.36, 0.96, 0.14, 0.03, '#5d8f9e');
    rr(c, -0.48, -0.04, 0.96, 0.14, 0.03, '#5d8f9e');
    for (const x of [-0.4, 0.4]) { ln(c, x, -0.36, x, 0.42, '#555', 0.05); }
    txt(c, 'バスてい', 0, -0.29, 0.09, '#fbf6ea', '700 ');
  };
  D.posuto = (c) => {
    rr(c, -0.24, -0.3, 0.48, 0.72, 0.06, '#d8323a');
    ell(c, 0, -0.32, 0.28, 0.12, 0, '#c02a32'); ell(c, 0, -0.36, 0.2, 0.08, 0, '#d8323a');
    rr(c, -0.14, -0.14, 0.28, 0.05, 0.02, '#2a2422');
    txt(c, '〒', 0, 0.12, 0.2, '#fbf6ea');
    rr(c, -0.26, 0.38, 0.52, 0.07, 0.02, '#4a3b32');
    shine(c, -0.15, 0.0, 0.03, 0.2);
  };
  D.keitora = (c, v) => {
    const cab = v ? '#7fb0dc' : '#f4f1e6';
    rr(c, -0.48, -0.08, 0.62, 0.3, 0.02, '#c8cdd2');
    rr(c, -0.46, -0.24, 0.26, 0.16, 0.02, '#e9c27a', OUT, 0.025); rr(c, -0.18, -0.24, 0.26, 0.16, 0.02, '#e9c27a', OUT, 0.025);
    for (let i = 0; i < 5; i++) circ(c, -0.42 + i * 0.11, -0.27, 0.045, '#f39223', false);
    c.beginPath(); c.moveTo(0.14, 0.22); c.lineTo(0.14, -0.3); c.lineTo(0.34, -0.3); c.lineTo(0.48, -0.06); c.lineTo(0.48, 0.22); c.closePath(); fs(c, cab);
    poly(c, [0.2, -0.24, 0.32, -0.24, 0.42, -0.07, 0.2, -0.07], '#9bd0ec', OUT, 0.025);
    circ(c, -0.3, 0.26, 0.11, '#2a2422'); circ(c, 0.3, 0.26, 0.11, '#2a2422'); circ(c, -0.3, 0.26, 0.04, '#bbb', false); circ(c, 0.3, 0.26, 0.04, '#bbb', false);
  };
  D.niito = (c, v) => {
    const col = ['#d63a3a', '#3d7cc4', '#5cb36a'][v];
    c.beginPath(); c.moveTo(-0.38, 0.3); c.quadraticCurveTo(-0.4, -0.3, 0, -0.32); c.quadraticCurveTo(0.4, -0.3, 0.38, 0.3); c.closePath(); fs(c, col);
    rr(c, -0.4, 0.16, 0.8, 0.2, 0.06, '#fbf6ea');
    circ(c, 0, -0.36, 0.12, '#fbf6ea');
    for (let i = -3; i <= 3; i++) ln(c, i * 0.09, -0.2, i * 0.11, 0.14, 'rgba(255,255,255,0.3)', 0.025);
  };
  D.boushi = (c) => {
    ell(c, 0, 0.18, 0.48, 0.13, 0, '#6b5a4a');
    c.beginPath(); c.moveTo(-0.28, 0.16); c.lineTo(-0.24, -0.2); c.quadraticCurveTo(0, -0.34, 0.24, -0.2); c.lineTo(0.28, 0.16); c.closePath(); fs(c, '#7a6754');
    rr(c, -0.28, 0.04, 0.56, 0.08, 0.01, '#2a2422', false);
    ln(c, -0.1, -0.26, 0.12, -0.25, 'rgba(0,0,0,0.3)', 0.03);
  };
  D.kasa = (c, v) => {
    const col = v ? '#d63a3a' : '#3d7cc4';
    c.beginPath(); c.moveTo(-0.48, 0.0); c.quadraticCurveTo(0, -0.62, 0.48, 0.0); c.closePath(); fs(c, col);
    for (let i = -2; i <= 2; i++) ln(c, 0, -0.32, i * 0.22, 0.0, 'rgba(255,255,255,0.4)', 0.025);
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-0.36 + i * 0.24, 0.0, 0.12, 0, PI); fs(c, col, OUT, 0.025); }
    ln(c, 0, -0.38, 0, 0.36, '#555', 0.035); arcS(c, -0.06, 0.36, 0.06, 0, PI, '#6f4a2c', 0.05);
  };
  D.kamibukuro = (c) => {
    rr(c, -0.3, -0.24, 0.6, 0.68, 0.02, '#c8996a');
    arcS(c, -0.1, -0.24, 0.08, PI, TAU, '#6f4a2c', 0.035); arcS(c, 0.1, -0.24, 0.08, PI, TAU, '#6f4a2c', 0.035);
    circ(c, 0, 0.1, 0.13, '#d63a3a', false); txt(c, '初', 0, 0.11, 0.15, '#fbf6ea');
    for (const p of [[-0.12, -0.32], [0.14, -0.3]]) circ(c, p[0], p[1], 0.06, '#f39223', OUT, 0.02);
  };
  D.furoshiki = (c) => {
    blob(c, 0, 0.1, 0.42, 0.32, 8, 21, 0.06, '#5a3f8a');
    poly(c, [-0.14, -0.2, 0, -0.06, 0.14, -0.2, 0.22, -0.38, 0.06, -0.28, -0.06, -0.28, -0.22, -0.38], '#5a3f8a');
    for (let i = 0; i < 6; i++) arcS(c, -0.25 + i * 0.1, 0.12 + (i % 2) * 0.1, 0.05, 0, PI * 1.5, 'rgba(255,255,255,0.45)', 0.025);
  };
  D.bonsai = (c) => {
    rr(c, -0.36, 0.22, 0.72, 0.2, 0.04, '#3f5f9a');
    ln(c, -0.05, 0.22, 0.02, -0.08, '#6f4a2c', 0.08); ln(c, 0.02, -0.08, 0.2, -0.2, '#6f4a2c', 0.05);
    for (const [x, y, r] of [[-0.18, -0.12, 0.16], [0.1, -0.22, 0.17], [0.26, -0.1, 0.13], [-0.02, -0.36, 0.12]]) ell(c, x, y, r, r * 0.6, 0, '#3f7a3a');
  };
  D.yukidaruma = (c) => {
    circ(c, 0, 0.18, 0.28, '#fbfdff'); circ(c, 0, -0.22, 0.2, '#fbfdff');
    rr(c, -0.14, -0.5, 0.28, 0.16, 0.03, '#7fa6c8');
    circ(c, -0.07, -0.25, 0.03, OUT, false); circ(c, 0.07, -0.25, 0.03, OUT, false);
    poly(c, [0, -0.2, 0.18, -0.16, 0, -0.14], '#f08a24', OUT, 0.02);
    ln(c, -0.24, 0.1, -0.44, -0.06, '#6f4a2c', 0.035); ln(c, 0.24, 0.1, 0.44, -0.04, '#6f4a2c', 0.035);
    rr(c, -0.2, -0.06, 0.4, 0.07, 0.03, '#d63a3a', false);
    shine(c, -0.12, 0.08, 0.06, 0.1, 0.3);
  };

  // ════ その四 ════
  D.kobune = (c) => {
    c.beginPath(); c.moveTo(-0.48, -0.08); c.lineTo(0.48, -0.08); c.quadraticCurveTo(0.42, 0.22, 0.2, 0.26); c.lineTo(-0.3, 0.26); c.quadraticCurveTo(-0.46, 0.2, -0.48, -0.08); fs(c, '#8a5a35');
    ell(c, 0, -0.08, 0.48, 0.11, 0, '#c99a62');
    ell(c, 0, -0.08, 0.4, 0.07, 0, '#6f4a2c', false);
    rr(c, -0.06, -0.13, 0.12, 0.1, 0.01, '#c99a62', OUT, 0.02);
    ln(c, 0.1, -0.12, 0.5, -0.36, '#c99a62', 0.04);
    ln(c, -0.44, 0.06, 0.44, 0.06, 'rgba(255,255,255,0.25)', 0.025);
  };
  D.maruta = (c) => {
    rr(c, -0.48, -0.12, 0.96, 0.24, 0.12, '#8a5a35');
    for (let i = 0; i < 3; i++) ln(c, -0.4, -0.06 + i * 0.06, 0.4, -0.05 + i * 0.06, 'rgba(50,30,15,0.4)', 0.015);
    ell(c, 0.42, 0, 0.06, 0.12, 0, '#d9b47d'); circ(c, 0.42, 0, 0.03, false, '#a0703f', 0.01);
  };
  D.ami = (c) => {
    blob(c, 0, 0, 0.46, 0.4, 9, 31, 0.12, 'rgba(120,140,110,0.35)', '#5d6b4a', 0.03);
    c.save(); c.beginPath(); c.ellipse(0, 0, 0.44, 0.38, 0, 0, TAU); c.clip();
    for (let i = -6; i <= 6; i++) { ln(c, i * 0.09 - 0.5, -0.5, i * 0.09 + 0.5, 0.5, 'rgba(70,80,60,0.6)', 0.012); ln(c, i * 0.09 + 0.5, -0.5, i * 0.09 - 0.5, 0.5, 'rgba(70,80,60,0.6)', 0.012); }
    c.restore();
    for (const p of [[-0.3, -0.2], [0.25, -0.25], [0.3, 0.2], [-0.2, 0.28]]) circ(c, p[0], p[1], 0.05, '#f08a24');
  };
  D.iwa = (c, v) => {
    blob(c, 0, 0.05, 0.47, 0.38, 8, v ? 77 : 41, 0.16, v ? '#8f8a80' : '#a29c90');
    blob(c, -0.05, -0.08, 0.3, 0.18, 7, v ? 78 : 42, 0.2, 'rgba(255,255,255,0.18)', false);
    ln(c, 0.05, -0.05, 0.2, 0.15, 'rgba(0,0,0,0.25)', 0.025);
    circ(c, -0.25, 0.2, 0.05, '#7b9a5a', false);
  };
  D.susuki = (c) => {
    for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(i * 0.03, 0.45); c.quadraticCurveTo(i * 0.08, 0.0, i * 0.12 + 0.05, -0.3); c.strokeStyle = '#b39a5a'; c.lineWidth = 0.025; c.stroke(); }
    for (let i = -3; i <= 3; i++) { c.save(); c.translate(i * 0.1 + 0.05, -0.32 + Math.abs(i) * 0.04); c.rotate(i * 0.2); ell(c, 0, -0.08, 0.05, 0.13, 0, '#efe6c8', '#c9b78a', 0.02); c.restore(); }
  };
  D.zaimoku = (c) => {
    rr(c, -0.48, -0.16, 0.96, 0.12, 0.01, '#d9b47d'); rr(c, -0.46, -0.03, 0.94, 0.12, 0.01, '#c99a62'); rr(c, -0.48, 0.1, 0.96, 0.12, 0.01, '#d9b47d');
    ln(c, -0.2, -0.18, -0.2, 0.24, '#6f4a2c', 0.04); ln(c, 0.25, -0.18, 0.25, 0.24, '#6f4a2c', 0.04);
  };
  D.tsurizao = (c) => { ln(c, -0.48, 0.03, 0.48, -0.03, '#3f5a3a', 0.035); circ(c, -0.32, 0.03, 0.06, '#999'); c.beginPath(); c.moveTo(0.48, -0.03); c.quadraticCurveTo(0.3, 0.2, 0.1, 0.25); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.012; c.stroke(); };
  D.shimekazari = (c) => {
    c.beginPath(); c.moveTo(-0.4, -0.15); c.quadraticCurveTo(0, 0.25, 0.4, -0.15); c.quadraticCurveTo(0, 0.05, -0.4, -0.15); fs(c, '#e3c26c');
    for (let i = -2; i <= 2; i++) ln(c, i * 0.1, 0.05, i * 0.12, 0.4, '#e3c26c', 0.03);
    for (const x of [-0.18, 0.18]) poly(c, [x - 0.04, 0.0, x + 0.04, 0.0, x + 0.06, 0.12, x - 0.02, 0.14, x + 0.02, 0.28, x - 0.06, 0.3], '#fbfbf5', OUT, 0.02);
    circ(c, 0, 0.0, 0.1, '#f08a24'); ell(c, 0.07, -0.1, 0.07, 0.03, -0.4, '#4f8a3a', false);
  };
  D.oke = (c) => {
    poly(c, [-0.42, -0.25, 0.42, -0.25, 0.36, 0.42, -0.36, 0.42], '#c99a62');
    ell(c, 0, -0.25, 0.42, 0.1, 0, '#8e6638');
    for (let i = -3; i <= 3; i++) ln(c, i * 0.12, -0.22, i * 0.1, 0.42, 'rgba(80,50,20,0.35)', 0.015);
    ln(c, -0.4, -0.05, 0.4, -0.05, '#3f6b8a', 0.05); ln(c, -0.38, 0.26, 0.38, 0.26, '#3f6b8a', 0.05);
  };
  D.yakatabune = (c) => {
    c.beginPath(); c.moveTo(-0.48, 0.05); c.lineTo(0.48, 0.05); c.quadraticCurveTo(0.44, 0.28, 0.25, 0.32); c.lineTo(-0.3, 0.32); c.quadraticCurveTo(-0.46, 0.25, -0.48, 0.05); fs(c, '#6f4a2c');
    rr(c, -0.34, -0.2, 0.62, 0.26, 0.01, '#f4ead2');
    for (let i = 0; i < 5; i++) rr(c, -0.3 + i * 0.12, -0.16, 0.08, 0.14, 0.01, '#f9d98a', OUT, 0.015);
    poly(c, [-0.4, -0.2, -0.3, -0.34, 0.24, -0.34, 0.34, -0.2], '#3f4a52');
    for (let i = 0; i < 4; i++) { ln(c, -0.26 + i * 0.16, -0.34, -0.26 + i * 0.16, -0.27, OUT, 0.01); ell(c, -0.26 + i * 0.16, -0.24, 0.035, 0.045, 0, '#e2453a', OUT, 0.015); }
  };
  D.hashigo = (c) => { ln(c, -0.48, -0.15, 0.48, -0.15, '#b98a55', 0.06); ln(c, -0.48, 0.15, 0.48, 0.15, '#b98a55', 0.06); for (let i = -4; i <= 4; i++) ln(c, i * 0.11, -0.15, i * 0.11, 0.15, '#a0703f', 0.045); };
  D.kame = (c) => {
    c.beginPath(); c.moveTo(-0.2, -0.36); c.quadraticCurveTo(-0.5, -0.1, -0.3, 0.44); c.lineTo(0.3, 0.44); c.quadraticCurveTo(0.5, -0.1, 0.2, -0.36); c.closePath(); fs(c, '#7a4b30');
    ell(c, 0, -0.38, 0.24, 0.07, 0, '#5a3522');
    c.beginPath(); c.moveTo(-0.38, -0.05); c.quadraticCurveTo(0, 0.08, 0.38, -0.05); c.strokeStyle = '#c99a62'; c.lineWidth = 0.04; c.stroke();
    shine(c, -0.18, 0.05, 0.05, 0.16, 0.2);
  };
  D.yoshizu = (c) => { rr(c, -0.48, -0.32, 0.96, 0.64, 0.01, '#d9c38a'); for (let i = -11; i <= 11; i++) ln(c, i * 0.042, -0.32, i * 0.042, 0.32, 'rgba(140,110,50,0.45)', 0.012); ln(c, -0.48, -0.15, 0.48, -0.15, '#8e6638', 0.025); ln(c, -0.48, 0.15, 0.48, 0.15, '#8e6638', 0.025); };

  // ════ その五 ════
  D.tento = (c, v) => {
    for (const x of [-0.4, 0.4]) ln(c, x, -0.16, x, 0.44, '#888', 0.04);
    c.beginPath(); c.moveTo(-0.48, -0.12); c.lineTo(-0.32, -0.42); c.lineTo(0.32, -0.42); c.lineTo(0.48, -0.12); c.closePath(); fs(c, '#fbf8f0');
    if (v) for (let i = 0; i < 4; i++) poly(c, [-0.44 + i * 0.24, -0.12, -0.3 + i * 0.22, -0.42, -0.2 + i * 0.22, -0.42, -0.32 + i * 0.24, -0.12], '#d63a3a', false);
    rr(c, -0.48, -0.14, 0.96, 0.12, 0.01, v ? '#d63a3a' : '#3d7cc4');
    rr(c, -0.3, 0.12, 0.6, 0.12, 0.01, '#c99a62', OUT, 0.03);
    txt(c, '本部', 0, -0.08, 0.08, '#fbf8f0', '700 ');
  };
  D.taiko = (c) => {
    ln(c, -0.36, 0.1, -0.44, 0.44, '#6f4a2c', 0.05); ln(c, 0.36, 0.1, 0.44, 0.44, '#6f4a2c', 0.05);
    ell(c, 0, -0.05, 0.38, 0.36, 0, '#9a3a2a');
    ell(c, -0.3, -0.05, 0.1, 0.34, 0, '#f2e6cc'); ell(c, 0.3, -0.05, 0.1, 0.34, 0, '#f2e6cc');
    for (let i = 0; i < 7; i++) circ(c, -0.25, -0.3 + i * 0.085, 0.02, '#f0c24a', false);
    ln(c, -0.2, -0.32, 0.2, 0.22, '#f0c24a', 0.03); ln(c, -0.2, 0.22, 0.2, -0.32, '#f0c24a', 0.03);
    txt(c, '祭', 0.3, -0.05, 0.16, '#d63a3a');
  };
  D.torakku = (c, v) => {
    const col = v ? '#3d7cc4' : '#5aa36b';
    rr(c, -0.48, -0.32, 0.64, 0.5, 0.02, '#e9e4d6');
    txt(c, 'たこ', -0.16, -0.08, 0.16, col);
    c.beginPath(); c.moveTo(0.18, 0.18); c.lineTo(0.18, -0.22); c.lineTo(0.36, -0.22); c.lineTo(0.48, 0.0); c.lineTo(0.48, 0.18); c.closePath(); fs(c, col);
    poly(c, [0.24, -0.17, 0.34, -0.17, 0.42, -0.02, 0.24, -0.02], '#9bd0ec', OUT, 0.02);
    for (const x of [-0.34, -0.12, 0.34]) { circ(c, x, 0.24, 0.1, '#2a2422'); circ(c, x, 0.24, 0.035, '#bbb', false); }
  };
  D.monooki = (c) => {
    rr(c, -0.42, -0.28, 0.84, 0.72, 0.02, '#c8cdd2');
    poly(c, [-0.48, -0.26, 0, -0.42, 0.48, -0.26], '#7f8a94');
    rr(c, -0.36, -0.18, 0.34, 0.56, 0.01, '#b3b9bf', OUT, 0.025); rr(c, 0.02, -0.18, 0.34, 0.56, 0.01, '#b3b9bf', OUT, 0.025);
    for (let i = 0; i < 6; i++) ln(c, -0.36, -0.1 + i * 0.08, 0.36, -0.1 + i * 0.08, 'rgba(0,0,0,0.12)', 0.015);
  };
  D.roll = (c) => {
    rr(c, -0.42, -0.36, 0.8, 0.72, 0.36, '#d9b45e');
    ell(c, 0.26, 0, 0.18, 0.36, 0, '#e8c875');
    for (let i = 1; i < 4; i++) ell(c, 0.26, 0, i * 0.045, i * 0.09, 0, false, 'rgba(140,100,40,0.5)', 0.015);
    for (let i = 0; i < 5; i++) ln(c, -0.35, -0.25 + i * 0.12, 0.15, -0.25 + i * 0.12, 'rgba(150,110,40,0.3)', 0.015);
  };
  D.yuki = (c) => { blob(c, 0, 0.05, 0.46, 0.36, 7, 61, 0.15, '#f4f8fc'); blob(c, 0.05, 0.15, 0.36, 0.2, 6, 62, 0.2, 'rgba(160,190,220,0.4)', false); shine(c, -0.15, -0.1, 0.14, 0.06); };
  D.kiri = (c, v) => {
    const pts = v ? [[0, 0, 0.3], [-0.24, 0.06, 0.22], [0.25, 0.04, 0.24], [-0.1, -0.16, 0.2], [0.14, -0.14, 0.18]] : [[0, 0, 0.26], [-0.28, 0.05, 0.2], [0.3, 0.08, 0.18], [0.05, -0.14, 0.22], [-0.15, -0.1, 0.16]];
    for (const p of pts) circ(c, p[0], p[1] + 0.06, p[2], 'rgba(190,205,220,0.6)', false);
    for (const p of pts) circ(c, p[0], p[1], p[2], 'rgba(255,255,255,0.85)', false);
  };
  D.kumo = (c) => {
    for (const p of [[0, 0, 0.28], [-0.26, 0.06, 0.2], [0.26, 0.04, 0.22], [-0.08, -0.16, 0.2], [0.12, -0.14, 0.18]]) circ(c, p[0], p[1], p[2], '#c9d2dc', false);
    for (const p of [[-0.04, -0.06, 0.2], [0.14, -0.08, 0.14]]) circ(c, p[0], p[1], p[2], '#e6ecf2', false);
    for (let i = 0; i < 5; i++) circ(c, -0.3 + i * 0.15, 0.3 + (i % 2) * 0.08, 0.03, '#fff', false);
  };
  D.basu = (c) => {
    rr(c, -0.48, -0.3, 0.96, 0.5, 0.06, '#f4ead2');
    rr(c, -0.48, 0.0, 0.96, 0.08, 0, '#e2553b', false);
    for (let i = 0; i < 6; i++) rr(c, -0.42 + i * 0.13, -0.22, 0.1, 0.13, 0.01, '#9bd0ec', OUT, 0.015);
    rr(c, 0.38, -0.22, 0.08, 0.28, 0.01, '#9bd0ec', OUT, 0.015);
    for (const x of [-0.3, 0.3]) { circ(c, x, 0.22, 0.09, '#2a2422'); circ(c, x, 0.22, 0.03, '#bbb', false); }
    rr(c, -0.48, -0.3, 0.96, 0.5, 0.06, false);
  };
  D.oonobori = (c, v) => {
    const col = ['#d63a3a', '#f0c24a', '#3d7cc4'][v];
    ln(c, -0.12, -0.48, -0.12, 0.45, '#8e6638', 0.035);
    rr(c, -0.1, -0.45, 0.22, 0.82, 0.01, col);
    vtxt(c, '凧揚祭', 0.01, -0.33, 0.13, v === 1 ? '#d63a3a' : '#fbf6ea');
  };

  // ════ こわせる入れもの ════
  D.ueki = (c) => {
    poly(c, [-0.34, -0.05, 0.34, -0.05, 0.26, 0.44, -0.26, 0.44], '#c86d3c');
    rr(c, -0.38, -0.12, 0.76, 0.12, 0.03, '#d9824e');
    ell(c, 0, -0.1, 0.3, 0.05, 0, '#5b402a', false);
    ln(c, 0, -0.1, -0.02, -0.38, '#4f7a2c', 0.04);
    for (const [x, y] of [[-0.14, -0.3], [0.12, -0.34], [-0.02, -0.46]]) ell(c, x, y, 0.1, 0.05, x * 2, '#5c9a3a');
    circ(c, 0.12, -0.36, 0.05, '#f6b7c8', false);
  };
  D.fusezaru = (c) => {
    c.beginPath(); c.moveTo(-0.46, 0.38); c.quadraticCurveTo(-0.46, -0.3, 0, -0.32); c.quadraticCurveTo(0.46, -0.3, 0.46, 0.38); c.closePath(); fs(c, '#d8b46e');
    for (let i = 1; i < 5; i++) arcS(c, 0, 0.38, i * 0.13, PI * 1.08, PI * 1.92, 'rgba(120,85,40,0.45)', 0.02);
    for (let i = -3; i <= 3; i++) ln(c, i * 0.12, 0.38, i * 0.05, -0.28, 'rgba(120,85,40,0.3)', 0.015);
  };
  D.kido = (c) => {
    rr(c, -0.42, -0.45, 0.84, 0.9, 0.02, '#9b6c3c');
    for (let i = 1; i < 6; i++) ln(c, -0.42 + i * 0.14, -0.45, -0.42 + i * 0.14, 0.45, 'rgba(50,30,15,0.45)', 0.02);
    ln(c, -0.42, -0.2, 0.42, -0.2, '#6f4a2c', 0.05); ln(c, -0.42, 0.22, 0.42, 0.22, '#6f4a2c', 0.05);
  };
  D.monohoshi = (c) => {
    for (const x of [-0.4, 0.4]) { ln(c, x, -0.3, x, 0.45, '#8e6638', 0.04); ln(c, x - 0.1, -0.3, x + 0.1, -0.3, '#8e6638', 0.04); }
    ln(c, -0.48, -0.3, 0.48, -0.3, '#7fb04f', 0.045);
    const cols = ['#f4f1e6', '#7fb0dc', '#e8a3a3', '#f2c544', '#fbf6ea'];
    for (let i = 0; i < 5; i++) { const x = -0.3 + i * 0.15; rr(c, x - 0.06, -0.3, 0.12, 0.2 + (i % 2) * 0.08, 0.02, cols[i], OUT, 0.02); }
  };
  D.kakashi = (c) => {
    ln(c, 0, -0.2, 0, 0.45, '#6f4a2c', 0.05);
    ln(c, -0.44, -0.08, 0.44, -0.08, '#7fb04f', 0.04);
    poly(c, [-0.36, -0.14, 0.36, -0.14, 0.24, 0.24, -0.24, 0.24], '#5a7fa8');
    rr(c, -0.12, 0.0, 0.12, 0.12, 0.02, '#c8463b', OUT, 0.02);
    circ(c, 0, -0.27, 0.13, '#f4ead2');
    circ(c, -0.05, -0.28, 0.02, OUT, false); circ(c, 0.05, -0.28, 0.02, OUT, false); arcS(c, 0, -0.24, 0.04, 0.2, PI - 0.2, OUT, 0.02);
    ell(c, 0, -0.38, 0.22, 0.06, 0, '#e8c97a'); c.beginPath(); c.moveTo(-0.12, -0.38); c.quadraticCurveTo(0, -0.52, 0.12, -0.38); fs(c, '#efd38a');
  };
  D.kakashi_m = (c) => { D.kakashi(c); circ(c, -0.05, -0.28, 0.035, false, OUT, 0.015); circ(c, 0.05, -0.28, 0.035, false, OUT, 0.015); };
  D.warani = (c) => {
    c.beginPath(); c.moveTo(-0.44, 0.42); c.quadraticCurveTo(-0.46, -0.1, -0.2, -0.22); c.lineTo(0, -0.46); c.lineTo(0.2, -0.22); c.quadraticCurveTo(0.46, -0.1, 0.44, 0.42); c.closePath(); fs(c, '#d9b45e');
    for (let i = -6; i <= 6; i++) ln(c, i * 0.06, -0.15 + Math.abs(i) * 0.02, i * 0.07, 0.42, 'rgba(150,110,40,0.35)', 0.015);
    ln(c, -0.32, 0.1, 0.32, 0.1, '#8e6638', 0.03);
    poly(c, [-0.18, -0.24, 0, -0.48, 0.18, -0.24], '#c9a24e', OUT, 0.025);
  };
  D.mon = (c) => {
    rr(c, -0.46, -0.3, 0.92, 0.74, 0.02, '#8a5a35');
    ln(c, 0, -0.3, 0, 0.44, OUT, 0.03);
    for (let i = 1; i < 6; i++) ln(c, -0.46 + i * 0.15, -0.3, -0.46 + i * 0.15, 0.44, 'rgba(50,30,15,0.35)', 0.015);
    rr(c, -0.2, 0.0, 0.4, 0.06, 0.01, '#4a3b32');
    poly(c, [-0.5, -0.3, -0.4, -0.44, 0.4, -0.44, 0.5, -0.3], '#4a4a52');
  };
  D.yatai = (c) => {
    for (const x of [-0.42, 0.42]) ln(c, x, -0.2, x, 0.44, '#8e6638', 0.04);
    rr(c, -0.46, 0.1, 0.92, 0.32, 0.02, '#c99a62');
    rr(c, -0.4, 0.14, 0.8, 0.07, 0.01, '#fbf6ea', OUT, 0.02);
    txt(c, 'やたい', 0, 0.3, 0.09, '#fbf6ea', '700 ');
    circ(c, -0.25, 0.04, 0.07, '#fbf8f0'); circ(c, -0.08, 0.04, 0.07, '#f2d27a'); circ(c, 0.1, 0.0, 0.07, '#f9c4da'); circ(c, 0.26, 0.04, 0.06, '#e42b3a');
    c.beginPath(); c.moveTo(-0.5, -0.12); c.lineTo(-0.38, -0.42); c.lineTo(0.38, -0.42); c.lineTo(0.5, -0.12); c.closePath(); fs(c, '#fbf6ea');
    for (let i = 0; i < 5; i++) poly(c, [-0.46 + i * 0.2, -0.12, -0.36 + i * 0.18, -0.42, -0.27 + i * 0.18, -0.42, -0.36 + i * 0.2, -0.12], '#d63a3a', false);
    for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(-0.42 + i * 0.168, -0.12, 0.084, 0, PI); fs(c, i % 2 ? '#fbf6ea' : '#d63a3a', OUT, 0.015); }
  };
  D.saku = (c) => { for (let i = -4; i <= 4; i++) rr(c, i * 0.1 - 0.035, -0.4 + (i % 2) * 0.04, 0.07, 0.84, 0.03, '#8fb05f', OUT, 0.02); ln(c, -0.46, -0.2, 0.46, -0.2, '#6f4a2c', 0.04); ln(c, -0.46, 0.2, 0.46, 0.2, '#6f4a2c', 0.04); };
  D.koya = (c) => {
    rr(c, -0.4, -0.12, 0.8, 0.56, 0.02, '#8a6a48');
    for (let i = 1; i < 6; i++) ln(c, -0.4, -0.12 + i * 0.09, 0.4, -0.12 + i * 0.09, 'rgba(40,25,10,0.35)', 0.015);
    poly(c, [-0.48, -0.1, -0.3, -0.42, 0.3, -0.42, 0.48, -0.1], '#6b7a85');
    rr(c, -0.12, 0.08, 0.22, 0.36, 0.01, '#4a3526');
    blob(c, 0.27, 0.12, 0.1, 0.16, 7, 3, 0.1, 'rgba(120,140,110,0.6)', '#5d6b4a', 0.02);
  };
  D.dondo = (c) => {
    c.beginPath(); c.moveTo(-0.42, 0.44); c.lineTo(0, -0.48); c.lineTo(0.42, 0.44); c.closePath(); fs(c, '#a8c470');
    for (let i = -4; i <= 4; i++) ln(c, i * 0.1, 0.44, i * 0.012, -0.46, '#6f9a45', 0.02);
    for (let i = 0; i < 3; i++) ln(c, -0.3 + i * 0.07, 0.15 - i * 0.25, 0.3 - i * 0.07, 0.15 - i * 0.25, '#8e6638', 0.03);
    circ(c, -0.12, 0.25, 0.07, '#d73a2f'); circ(c, 0.14, 0.3, 0.06, '#d73a2f');
    for (const [x, y] of [[-0.05, -0.05], [0.12, 0.08]]) { poly(c, [x - 0.06, y, x + 0.06, y, x, y + 0.08], '#e3c26c', OUT, 0.015); }
    rr(c, -0.4, 0.34, 0.8, 0.1, 0.02, '#e3c26c');
  };
  D.taoreki = (c) => {
    rr(c, -0.48, -0.08, 0.96, 0.16, 0.08, '#6f4a2c');
    for (let i = 0; i < 6; i++) { const x = -0.35 + i * 0.14; ln(c, x, -0.08, x + 0.05, -0.25 - (i % 2) * 0.05, '#4a3526', 0.025); ell(c, x + 0.06, -0.26 - (i % 2) * 0.05, 0.08, 0.04, 0, '#2f5a35', false); }
    ell(c, 0.46, 0, 0.04, 0.08, 0, '#d9b47d');
  };
  D.kamakura = (c) => {
    c.beginPath(); c.moveTo(-0.46, 0.42); c.quadraticCurveTo(-0.48, -0.42, 0, -0.42); c.quadraticCurveTo(0.48, -0.42, 0.46, 0.42); c.closePath(); fs(c, '#f4f8fc');
    c.beginPath(); c.moveTo(-0.16, 0.42); c.quadraticCurveTo(-0.16, 0.02, 0, 0.02); c.quadraticCurveTo(0.16, 0.02, 0.16, 0.42); c.closePath(); fs(c, '#2f3a52');
    c.beginPath(); c.moveTo(-0.1, 0.42); c.quadraticCurveTo(-0.1, 0.12, 0, 0.12); c.quadraticCurveTo(0.1, 0.12, 0.1, 0.42); fs(c, 'rgba(255,190,90,0.6)', false);
    shine(c, -0.22, -0.18, 0.12, 0.06, -0.5);
    ell(c, 0.25, 0.1, 0.12, 0.2, 0, 'rgba(160,190,220,0.35)', false);
  };
  D.yagura = (c) => {
    for (const x of [-0.36, 0.36]) ln(c, x, -0.2, x * 1.15, 0.45, '#8e6638', 0.05);
    ln(c, -0.36, 0.1, 0.36, 0.1, '#8e6638', 0.04); ln(c, -0.36, -0.2, 0.42, 0.45, '#8e6638', 0.02); ln(c, 0.36, -0.2, -0.42, 0.45, '#8e6638', 0.02);
    rr(c, -0.42, -0.24, 0.84, 0.14, 0.01, '#fbf6ea');
    for (let i = 0; i < 6; i++) rr(c, -0.42 + i * 0.14, -0.24, 0.07, 0.14, 0, '#d63a3a', false);
    for (let i = 0; i < 5; i++) ell(c, -0.32 + i * 0.16, -0.06, 0.04, 0.05, 0, '#e2453a', OUT, 0.015);
    poly(c, [-0.46, -0.24, -0.3, -0.42, 0.3, -0.42, 0.46, -0.24], '#3f4a52');
    circ(c, 0, -0.46, 0.05, '#f0c24a');
  };

  // ════ おたから ════
  D.t_biidama = (c) => { D.biidama(c, 0); };
  D.t_donguri = (c) => {
    ell(c, 0, 0.1, 0.27, 0.34, 0, '#f2c544'); shine(c, -0.09, 0.05, 0.07, 0.15, 0.2);
    c.beginPath(); c.ellipse(0, -0.12, 0.31, 0.2, 0, PI, TAU); c.lineTo(0.31, -0.08); c.quadraticCurveTo(0, 0.02, -0.31, -0.08); c.closePath(); fs(c, '#c8962a');
    ln(c, 0, -0.3, 0.04, -0.44, OUT, 0.06);
  };
  D.t_otoshidama = (c) => {
    rr(c, -0.26, -0.4, 0.52, 0.8, 0.03, '#fbf0f4');
    poly(c, [-0.26, -0.4, 0, -0.18, 0.26, -0.4], '#f7d6e0', OUT, 0.03);
    circ(c, 0, 0.06, 0.12, '#d63a3a', false); txt(c, '寿', 0, 0.07, 0.16, '#fbf6ea');
    for (let i = 0; i < 3; i++) circ(c, -0.15 + i * 0.15, 0.3, 0.04, '#f2c544', false);
  };
  D.t_suzu = (c) => {
    ln(c, 0, -0.46, 0, -0.3, '#d63a3a', 0.06);
    circ(c, 0, 0.02, 0.36, '#f2c544'); ln(c, -0.36, 0.0, 0.36, 0.0, '#b8862a', 0.035);
    ell(c, 0, 0.18, 0.06, 0.1, 0, '#6b4a1a', false); ln(c, 0, 0.18, 0, 0.36, '#6b4a1a', 0.03);
    shine(c, -0.14, -0.14, 0.1, 0.06, -0.5);
  };
  D.t_koban = (c) => { ell(c, 0, 0, 0.3, 0.46, 0, '#f2c544'); for (let i = 0; i < 6; i++) ln(c, -0.18, -0.25 + i * 0.1, 0.18, -0.25 + i * 0.1, 'rgba(160,110,20,0.6)', 0.02); ell(c, 0, 0, 0.1, 0.14, 0, '#e6b030', OUT, 0.02); shine(c, -0.12, -0.2, 0.05, 0.1, 0.2); };
  D.t_megane = (c) => { circ(c, -0.24, 0, 0.18, 'rgba(200,230,250,0.4)', OUT, 0.05); circ(c, 0.24, 0, 0.18, 'rgba(200,230,250,0.4)', OUT, 0.05); arcS(c, 0, 0, 0.07, PI * 1.15, PI * 1.85, OUT, 0.04); ln(c, -0.42, -0.04, -0.48, -0.1, OUT, 0.04); ln(c, 0.42, -0.04, 0.48, -0.1, OUT, 0.04); };
  D.t_maneki = (c) => {
    ell(c, 0, 0.18, 0.3, 0.27, 0, '#fbf8f0');
    circ(c, 0, -0.18, 0.24, '#fbf8f0');
    poly(c, [-0.22, -0.3, -0.18, -0.46, -0.06, -0.38], '#fbf8f0'); poly(c, [0.22, -0.3, 0.18, -0.46, 0.06, -0.38], '#fbf8f0');
    ell(c, 0.27, -0.28, 0.08, 0.13, 0.3, '#fbf8f0');
    arcS(c, -0.09, -0.18, 0.05, PI * 1.1, PI * 1.9, OUT, 0.03); arcS(c, 0.09, -0.18, 0.05, PI * 1.1, PI * 1.9, OUT, 0.03);
    rr(c, -0.2, -0.02, 0.4, 0.06, 0.03, '#d63a3a', false); circ(c, 0, 0.03, 0.04, '#f2c544', false);
    ell(c, 0, 0.24, 0.13, 0.17, 0, '#f2c544', OUT, 0.03); txt(c, '千', 0, 0.24, 0.12, '#b8862a');
    ell(c, -0.13, -0.08, 0.04, 0.025, 0, '#f4a3a3', false); ell(c, 0.13, -0.08, 0.04, 0.025, 0, '#f4a3a3', false);
  };
  D.t_fuurin = (c) => {
    c.beginPath(); c.moveTo(-0.26, 0.04); c.quadraticCurveTo(-0.26, -0.34, 0, -0.34); c.quadraticCurveTo(0.26, -0.34, 0.26, 0.04); c.closePath(); fs(c, 'rgba(180,225,245,0.85)');
    for (let i = 0; i < 3; i++) circ(c, -0.12 + i * 0.12, -0.12, 0.04, '#e2453a', false);
    ln(c, 0, 0.04, 0, 0.2, OUT, 0.02);
    rr(c, -0.08, 0.2, 0.16, 0.26, 0.01, '#fbf6ea'); txt(c, '涼', 0, 0.33, 0.1, '#3d7cc4');
    shine(c, -0.12, -0.2, 0.05, 0.09, 0.3);
  };
  D.t_itomaki = (c) => {
    rr(c, -0.34, -0.38, 0.68, 0.1, 0.03, '#a0703f'); rr(c, -0.34, 0.28, 0.68, 0.1, 0.03, '#a0703f');
    rr(c, -0.22, -0.28, 0.44, 0.56, 0.04, '#fbf6ea');
    for (let i = 0; i < 9; i++) ln(c, -0.22, -0.25 + i * 0.065, 0.22, -0.23 + i * 0.065, 'rgba(120,100,70,0.35)', 0.015);
    rr(c, -0.04, -0.46, 0.08, 0.92, 0.03, '#6f4a2c');
  };
  D.t_kappa = (c) => { ell(c, 0, 0, 0.46, 0.3, 0, '#9cc9a4'); ell(c, 0, -0.02, 0.32, 0.18, 0, '#c7e6cc', false); ell(c, -0.1, -0.08, 0.1, 0.04, -0.3, 'rgba(255,255,255,0.6)', false); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; circ(c, Math.cos(a) * 0.4, Math.sin(a) * 0.26, 0.03, '#6fa37a', false); } };
  D.t_koi = (c) => {
    c.beginPath(); c.moveTo(-0.44, 0); c.quadraticCurveTo(-0.1, -0.3, 0.26, -0.08); c.lineTo(0.48, -0.24); c.lineTo(0.4, 0); c.lineTo(0.48, 0.24); c.lineTo(0.26, 0.08); c.quadraticCurveTo(-0.1, 0.3, -0.44, 0); fs(c, '#f2c544');
    circ(c, -0.3, -0.04, 0.035, OUT, false); ln(c, -0.44, 0.02, -0.5, 0.08, '#c8962a', 0.02);
    for (let i = 0; i < 4; i++) arcS(c, -0.12 + i * 0.09, 0, 0.08, -0.9, 0.9, 'rgba(180,120,20,0.5)', 0.02);
    shine(c, -0.12, -0.1, 0.12, 0.04, -0.2);
  };
  D.t_usagi = (c) => {
    ell(c, 0, 0.12, 0.44, 0.3, 0, '#fbfdff');
    ell(c, -0.14, -0.24, 0.08, 0.2, -0.3, '#4f8a3a'); ell(c, 0.06, -0.26, 0.08, 0.2, 0.2, '#4f8a3a');
    circ(c, -0.26, 0.02, 0.05, '#d8243a', false); circ(c, -0.08, 0.0, 0.05, '#d8243a', false);
    ell(c, 0.15, 0.25, 0.16, 0.08, 0, 'rgba(160,190,220,0.35)', false);
  };
  D.t_uchiwa = (c) => {
    ln(c, 0, 0.1, 0, 0.48, '#8e6638', 0.05);
    for (let i = 0; i < 7; i++) { const a = -PI / 2 + (i - 3) * 0.32; c.save(); c.translate(0, 0.08); c.rotate(a + PI / 2); ell(c, 0, -0.28, 0.08, 0.26, 0, '#3f7a3a', OUT, 0.02); ln(c, 0, -0.05, 0, -0.5, '#a8d08a', 0.015); c.restore(); }
    circ(c, 0, 0.08, 0.06, '#d63a3a');
  };
  D.t_hoshi = (c) => {
    const p = []; for (let i = 0; i < 10; i++) { const a = -PI / 2 + i / 10 * TAU; const r = i % 2 ? 0.2 : 0.48; p.push(Math.cos(a) * r, Math.sin(a) * r); }
    poly(c, p, '#ffe36e', '#d9a520', 0.04);
    const q = []; for (let i = 0; i < 10; i++) { const a = -PI / 2 + i / 10 * TAU; const r = i % 2 ? 0.1 : 0.24; q.push(Math.cos(a) * r, Math.sin(a) * r - 0.02); }
    poly(c, q, '#fff8c8', false);
  };

  // ════ 凧 ════
  D.k_yakko = (c) => {
    rr(c, -0.48, -0.1, 0.96, 0.26, 0.02, '#3d7cc4');
    for (let i = 0; i < 4; i++) rr(c, -0.44 + i * 0.24, -0.06, 0.12, 0.18, 0.01, '#fbf6ea', false);
    poly(c, [-0.18, 0.16, 0.18, 0.16, 0.26, 0.48, -0.26, 0.48], '#d63a3a');
    ln(c, 0, 0.16, 0, 0.48, '#2a2422', 0.03);
    circ(c, 0, -0.25, 0.19, '#fbe8d8');
    rr(c, -0.18, -0.48, 0.36, 0.12, 0.04, '#2a2422');
    ln(c, -0.1, -0.28, -0.03, -0.26, OUT, 0.03); ln(c, 0.03, -0.26, 0.1, -0.28, OUT, 0.03);
    arcS(c, 0, -0.18, 0.05, 0.3, PI - 0.3, '#d63a3a', 0.03);
  };
  D.k_kaku = (c) => {
    rr(c, -0.36, -0.46, 0.72, 0.92, 0.02, '#fbf6ea');
    rr(c, -0.32, -0.42, 0.64, 0.84, 0.01, false, '#d63a3a', 0.04);
    txt(c, '龍', 0, 0.02, 0.62, '#d63a3a');
    ln(c, -0.36, -0.46, 0.36, 0.46, 'rgba(110,80,50,0.25)', 0.015); ln(c, 0.36, -0.46, -0.36, 0.46, 'rgba(110,80,50,0.25)', 0.015);
  };
  D.k_semi = (c) => {
    ell(c, -0.26, 0.0, 0.26, 0.42, 0.35, 'rgba(210,235,245,0.9)'); ell(c, 0.26, 0.0, 0.26, 0.42, -0.35, 'rgba(210,235,245,0.9)');
    for (const s of [-1, 1]) { ln(c, s * 0.05, -0.2, s * 0.4, 0.2, 'rgba(60,90,110,0.5)', 0.02); ln(c, s * 0.05, 0.0, s * 0.35, 0.32, 'rgba(60,90,110,0.5)', 0.02); }
    ell(c, 0, 0.02, 0.13, 0.36, 0, '#5a6b3a');
    circ(c, -0.08, -0.3, 0.06, '#2a2422'); circ(c, 0.08, -0.3, 0.06, '#2a2422');
    for (let i = 0; i < 4; i++) ln(c, -0.1, 0.06 + i * 0.07, 0.1, 0.06 + i * 0.07, '#3f4a2a', 0.02);
  };
  D.k_ren = (c) => { poly(c, [0, -0.46, 0.4, 0, 0, 0.46, -0.4, 0], '#d63a3a'); circ(c, 0, 0, 0.16, '#fbf6ea', false); txt(c, '連', 0, 0.01, 0.2, '#d63a3a'); };
  D.k_oodako = (c) => {
    rr(c, -0.4, -0.48, 0.8, 0.96, 0.02, '#fbf6ea');
    rr(c, -0.36, -0.44, 0.72, 0.88, 0.01, false, '#2a2422', 0.03);
    circ(c, 0, -0.1, 0.3, '#d63a3a', false);
    txt(c, '寿', 0, -0.1, 0.42, '#fbf6ea');
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-0.34, 0.28 + i * 0.06); c.quadraticCurveTo(-0.17, 0.22 + i * 0.06, 0, 0.28 + i * 0.06); c.quadraticCurveTo(0.17, 0.34 + i * 0.06, 0.34, 0.28 + i * 0.06); c.strokeStyle = '#3d7cc4'; c.lineWidth = 0.03; c.stroke(); }
    txt(c, 'たこあげ村', 0, 0.42, 0.06, '#2a2422', '700 ');
  };

  Art.D = D;
  Art.has = (t) => !!D[t];

  // ── しまっておく絵
  const cache = new Map();
  const BUCKETS = [24, 48, 96, 192, 320];
  Art.sprite = function (t, v, px) {
    let b = BUCKETS[BUCKETS.length - 1];
    for (const k of BUCKETS) { if (k >= px) { b = k; break; } }
    const key = t + '|' + (v || 0) + '|' + b;
    let cv = cache.get(key);
    if (cv) return cv;
    const size = Math.ceil(b * 1.5);
    cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(size, size) : document.createElement('canvas');
    cv.width = size; cv.height = size;
    const c = cv.getContext('2d');
    c.translate(size / 2, size / 2); c.scale(b, b);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const fn = D[t];
    try { if (fn) fn(c, v || 0); else { circ(c, 0, 0, 0.45, '#c9a', OUT); } } catch (e) { circ(c, 0, 0, 0.45, '#f0f', OUT); }
    cv.unit = b;
    cache.set(key, cv);
    return cv;
  };
  Art.cacheSize = () => cache.size;

  // ふだん使う色（小さすぎて点で描くとき）
  Art.dotColor = {
    kareha: ['#d8562f', '#a8703c', '#efc23c'], koishi: ['#9d9a92', '#b8ad9c', '#7f8288'], matsuba: '#5d6b2e', donguri: '#9a6230', mikan: '#f39223', kaki: '#ee7a22',
    daikon: '#f7f5ec', hakusai: '#b8de85', negi: '#5a9e3c', wara: '#e3c26c', tawara: '#e3c26c', susuki: '#d9cfa8', iwa: '#a29c90', roll: '#d9b45e', kiri: '#ffffff', tento: '#fbf8f0'
  };
})(typeof window !== 'undefined' ? window : globalThis);
