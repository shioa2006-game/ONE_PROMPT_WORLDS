// からり、国盗り ― 地図の形を作る
// 海岸線の多角形を塗り、陸の各点をいちばん近い seed の国に割り当てる
(function (root) {
  'use strict';
  var node = (typeof module !== 'undefined' && module.exports);
  var D = node ? require('./data.js') : root.KD;

  var MW = 700, MH = 720, MX = 14, MY = 12;
  var B = D.BOUNDS;

  // 畿内は国が小さく密なので、西と南を少し広げる投影にしている
  function sm(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function sx(lon) { return 1.45 - 0.65 * sm((lon - 136.6) / 1.0); }
  function sy(lat) { return 1.4 - 0.6 * sm((lat - 35.6) / 0.8); }
  function integ(f, a, b) { var n = 200, h = (b - a) / n, s = 0; for (var i = 0; i < n; i++) s += f(a + (i + 0.5) * h) * h; return s; }
  var FX = integ(sx, B.lon0, B.lon1), FY = integ(sy, B.lat0, B.lat1);
  function proj(lon, lat) {
    return [MX + integ(sx, B.lon0, lon) / FX * (MW - 2 * MX), MH - MY - integ(sy, B.lat0, lat) / FY * (MH - 2 * MY)];
  }

  function hash(x, y, s) { var n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); }
  function noise(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function fillPoly(buf, W, H, pts, val, onlyIf) {
    for (var y = 0; y < H; y++) {
      var yc = y + 0.5, xs = [];
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort(function (p, q) { return p - q; });
      for (var k = 0; k + 1 < xs.length; k += 2) {
        var x0 = Math.max(0, Math.ceil(xs[k] - 0.5)), x1 = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
        for (var x = x0; x <= x1; x++) if (onlyIf == null || buf[y * W + x] === onlyIf) buf[y * W + x] = val;
      }
    }
  }

  // 海岸線をなめらかに（Chaikin）
  function smooth(pts, n) {
    for (var k = 0; k < n; k++) {
      var o = [];
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      pts = o;
    }
    return pts;
  }

  var SEA = -3, LAKE = -2, OUT = -1;

  // S：1マップ単位あたりのピクセル数
  function build(S) {
    var W = Math.round(MW * S), H = Math.round(MH * S);
    var id = new Int8Array(W * H).fill(SEA);
    function P(list) { return list.map(function (q) { var p = proj(q[0], q[1]); return [p[0] * S, p[1] * S]; }); }
    var coast = smooth(P(D.COAST), 2), lake = smooth(P(D.LAKE), 2), sado = smooth(P(D.SADO), 2);
    fillPoly(id, W, H, coast, 99);
    fillPoly(id, W, H, sado, OUT);
    fillPoly(id, W, H, lake, LAKE);
    var seeds = [];
    D.PROV.forEach(function (pv, i) { pv.seeds.forEach(function (q) { var p = proj(q[0], q[1]); seeds.push([p[0], p[1], i]); }); });
    D.OUTSIDE.forEach(function (q) { var p = proj(q[0], q[1]); seeds.push([p[0], p[1], OUT]); });
    var ns = seeds.length, sxs = new Float32Array(ns), sys = new Float32Array(ns), sid = new Int8Array(ns);
    seeds.forEach(function (s, i) { sxs[i] = s[0]; sys[i] = s[1]; sid[i] = s[2]; });
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var o = y * W + x;
        if (id[o] !== 99) continue;
        var mx = x / S, my = y / S;
        var wx = mx + (noise(mx / 34, my / 34, 1) - 0.5) * 20 + (noise(mx / 11, my / 11, 3) - 0.5) * 6;
        var wy = my + (noise(mx / 34, my / 34, 2) - 0.5) * 20 + (noise(mx / 11, my / 11, 4) - 0.5) * 6;
        var best = 1e9, bi = 0;
        for (var k = 0; k < ns; k++) {
          var dx = wx - sxs[k], dy = wy - sys[k], d = dx * dx + dy * dy;
          if (d < best) { best = d; bi = k; }
        }
        id[o] = sid[bi];
      }
    }
    var castle = D.PROV.map(function (pv) { var p = proj(pv.seeds[0][0], pv.seeds[0][1]); return { x: p[0], y: p[1] }; });
    return { W: W, H: H, S: S, id: id, castle: castle, coast: coast, lake: lake };
  }

  // 地図の上で実際に接している国の組（検証用）
  function touching(m) {
    var set = {}, W = m.W, H = m.H, id = m.id;
    for (var y = 0; y < H - 1; y++) for (var x = 0; x < W - 1; x++) {
      var a = id[y * W + x];
      if (a < 0) continue;
      [id[y * W + x + 1], id[(y + 1) * W + x]].forEach(function (b) {
        if (b >= 0 && b !== a) { var k = Math.min(a, b) + '-' + Math.max(a, b); set[k] = (set[k] || 0) + 1; }
      });
    }
    return set;
  }

  var M = { MW: MW, MH: MH, proj: proj, build: build, touching: touching, noise: noise, SEA: SEA, LAKE: LAKE, OUT: OUT };
  if (node) module.exports = M;
  else root.KM = M;
})(typeof window !== 'undefined' ? window : globalThis);
