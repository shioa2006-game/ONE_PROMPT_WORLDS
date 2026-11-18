/* 戦国すごろく全国版 — 投影（緯度経度 → 世界座標）
   人の多い地方（近畿・関東南奥羽・北九州）を少し大きく見せる「複数の虫めがね」を使う。
   ブラウザと node の両方で動く。 */
(function (root) {
  'use strict';
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.SG.DATA;
  const CFG = root.MAPCFG || {};
  const LON0 = 136.5, LAT0 = 36.2, KX = Math.cos(36 * Math.PI / 180);
  const SC = CFG.SC || 150;     // 1単位（緯度1度）あたりの世界座標
  // 虫めがね：中心・倍率・広がり（長軸・短軸）・傾き
  const BUMPS = CFG.BUMPS || [
    { lat: 34.85, lon: 135.75, a: 1.2, s1: 1.2, s2: 0.75, ang: -0.32 },   // 近畿〜東海
    { lat: 37.0, lon: 140.0, a: 0.55, s1: 1.1, s2: 1.0, ang: -1.0 },      // 関東・南奥羽
    { lat: 33.2, lon: 130.6, a: 0.25, s1: 0.75, s2: 0.75, ang: 0 },       // 北九州
    { lat: 34.9, lon: 133.3, a: 0.45, s1: 1.4, s2: 0.75, ang: -0.15 },      // 瀬戸内
  ];
  function raw(lat, lon) { return [(lon - LON0) * KX, -(lat - LAT0)]; }
  const BC = BUMPS.map(b => { const c = raw(b.lat, b.lon); return { cx: c[0], cy: c[1], a: b.a, s1: b.s1, s2: b.s2, ca: Math.cos(b.ang), sa: Math.sin(b.ang) }; });
  function warp(p) {
    let x = p[0], y = p[1];
    for (const b of BC) {
      const dx = p[0] - b.cx, dy = p[1] - b.cy;
      const u = dx * b.ca + dy * b.sa, v = -dx * b.sa + dy * b.ca;
      const f = b.a * Math.exp(-(u * u) / (b.s1 * b.s1) - (v * v) / (b.s2 * b.s2));
      x += dx * f; y += dy * f;
    }
    return [x, y];
  }
  // 表示範囲は海岸線から決める
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const k in D.COAST) {
    if (k === 'ezo') continue;
    for (const q of D.COAST[k]) {
      const w = warp(raw(q[0], q[1]));
      x0 = Math.min(x0, w[0]); x1 = Math.max(x1, w[0]); y0 = Math.min(y0, w[1]); y1 = Math.max(y1, w[1]);
    }
  }
  const M = CFG.MARGIN || 0.35;
  x0 -= M; x1 += M; y0 -= M * 1.2; y1 += M;
  const W = Math.ceil((x1 - x0) * SC), H = Math.ceil((y1 - y0) * SC);
  function proj(lat, lon) {
    const q = warp(raw(lat, lon));
    return [(q[0] - x0) * SC, (q[1] - y0) * SC];
  }
  function polyProj(pts) {
    // 長い辺は細かく分けてから投影（虫めがねで曲がるため）
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const n = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / 0.08));
      for (let k = 0; k < n; k++) out.push(proj(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n));
    }
    return out;
  }
  const PJ = { W, H, SC, proj, polyProj };
  if (typeof module !== 'undefined' && module.exports) module.exports = PJ;
  else { root.SG = root.SG || {}; root.SG.PJ = PJ; }
})(typeof window !== 'undefined' ? window : globalThis);
