// からり、国盗り ― 地図の塗りと、絵の部品
(function (root) {
  'use strict';
  var D = root.KD, M = root.KM;
  var S = 1.5;
  var m = null, W = 0, H = 0;
  var mapC = null, mctx = null, img = null, px = null;
  var decoC = null;
  var grain = null, seaD = null, lists = null, bbox = null;
  var lastOwners = null, lastPlayer = -1;

  function hex(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  var RGB = D.PROV.map(function (p) { return hex(p.color); });
  var PAPER = [236, 224, 196];

  function init() {
    m = M.build(S); W = m.W; H = m.H;
    mapC = document.createElement('canvas'); mapC.width = W; mapC.height = H;
    mctx = mapC.getContext('2d');
    img = mctx.createImageData(W, H); px = img.data;
    var id = m.id, n = W * H, i, x, y;
    grain = new Uint8Array(n);
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var g = M.noise(x / 3.1, y / 3.1, 9) * 0.5 + M.noise(x / 41, y / 41, 8) * 0.5;
      grain[y * W + x] = 200 + Math.floor(g * 55);
    }
    // 海：岸からの距離（波線に使う）
    seaD = new Uint8Array(n).fill(255);
    for (i = 0; i < n; i++) if (id[i] > M.LAKE) seaD[i] = 0;
    for (y = 1; y < H; y++) for (x = 1; x < W - 1; x++) { i = y * W + x; var v = Math.min(seaD[i - 1] + 2, seaD[i - W] + 2, seaD[i - W - 1] + 3, seaD[i - W + 1] + 3); if (v < seaD[i]) seaD[i] = v; }
    for (y = H - 2; y >= 0; y--) for (x = W - 2; x > 0; x--) { i = y * W + x; var v2 = Math.min(seaD[i + 1] + 2, seaD[i + W] + 2, seaD[i + W + 1] + 3, seaD[i + W - 1] + 3); if (v2 < seaD[i]) seaD[i] = v2; }
    // 国ごとの画素
    var cnt = D.PROV.map(function () { return 0; });
    for (i = 0; i < n; i++) if (id[i] >= 0) cnt[id[i]]++;
    lists = cnt.map(function (c) { return new Int32Array(c); });
    bbox = cnt.map(function () { return [W, H, 0, 0]; });
    var k = cnt.map(function () { return 0; });
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var a = id[y * W + x];
      if (a < 0) continue;
      lists[a][k[a]++] = y * W + x;
      var b = bbox[a];
      if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
    }
    buildDeco();
  }

  // 街道・山・地名など、持ち主が変わっても変わらない線画
  function buildDeco() {
    decoC = document.createElement('canvas'); decoC.width = W; decoC.height = H;
    var c = decoC.getContext('2d');
    c.scale(S, S);
    // 街道
    c.lineCap = 'round';
    D.LINKS.forEach(function (l) {
      var a = m.castle[l[0]], b = m.castle[l[1]];
      c.strokeStyle = 'rgba(60,40,20,0.55)'; c.lineWidth = 3.2; c.setLineDash([]);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      c.strokeStyle = 'rgba(250,240,215,0.9)'; c.lineWidth = 1.6; c.setLineDash([5, 5]);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    });
    c.setLineDash([]);
    // 山
    var id = m.id;
    function mountain(x, y, s) {
      c.fillStyle = 'rgba(70,60,50,0.34)';
      c.beginPath(); c.moveTo(x - s, y + s * 0.6); c.lineTo(x, y - s * 0.7); c.lineTo(x + s, y + s * 0.6); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.beginPath(); c.moveTo(x - s * 0.3, y - s * 0.3); c.lineTo(x, y - s * 0.7); c.lineTo(x + s * 0.3, y - s * 0.3); c.lineTo(x, y - s * 0.15); c.closePath(); c.fill();
    }
    for (var gy = 20; gy < M.MH; gy += 17) for (var gx = 20; gx < M.MW; gx += 19) {
      var jx = gx + (M.noise(gx, gy, 21) - 0.5) * 14, jy = gy + (M.noise(gx, gy, 22) - 0.5) * 12;
      var pid = id[Math.round(jy * S) * W + Math.round(jx * S)];
      if (!(pid >= 0)) continue;
      var rough = D.PROV[pid].def >= 5 ? 0.75 : D.PROV[pid].def >= 4 ? 0.3 : 0.08;
      if (M.noise(gx * 1.7, gy * 1.3, 23) > rough) continue;
      var cs = m.castle[pid];
      if (Math.abs(jx - cs.x) < 40 && Math.abs(jy - cs.y) < 30) continue;
      mountain(jx, jy, 5 + M.noise(gx, gy, 24) * 4);
    }
    // 海と湖の名
    c.fillStyle = 'rgba(235,240,235,0.5)';
    c.font = '600 19px "Yu Mincho","Hiragino Mincho ProN",serif';
    c.textAlign = 'center';
    spaced(c, '日本海', 200, 110, 14);
    spaced(c, '太平洋', 560, 640, 14);
    c.font = '600 12px "Yu Mincho","Hiragino Mincho ProN",serif';
    c.fillStyle = 'rgba(240,245,240,0.75)';
    var lk = M.proj(136.12, 35.32); c.fillText('琵琶湖', lk[0] + 1, lk[1]);
  }
  function spaced(c, s, x, y, gap) {
    var w = 0, i; for (i = 0; i < s.length; i++) w += c.measureText(s[i]).width + gap;
    var cx = x - w / 2;
    for (i = 0; i < s.length; i++) { var cw = c.measureText(s[i]).width; c.fillText(s[i], cx + cw / 2, y); cx += cw + gap; }
  }

  function landColor(owner, g, out) {
    var c = RGB[owner], k = g / 255;
    out[0] = (c[0] * 0.8 + PAPER[0] * 0.2) * k; out[1] = (c[1] * 0.8 + PAPER[1] * 0.2) * k; out[2] = (c[2] * 0.8 + PAPER[2] * 0.2) * k;
  }

  // 持ち主に合わせて地図全体を塗りなおす
  function paint(owners, player) {
    lastOwners = owners.slice(); lastPlayer = player;
    var id = m.id, o, x, y, a, col = [0, 0, 0];
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      o = y * W + x; a = id[o];
      var q = o * 4, g = grain[o];
      if (a < M.OUT) {
        // 海・湖
        var d = seaD[o], t = Math.min(1, d / 60), k = g / 255;
        var r = 46 + (1 - t) * 44, gg = 92 + (1 - t) * 50, b = 112 + (1 - t) * 38;
        if (a === M.LAKE) { r = 96; gg = 150; b = 160; }
        var band = d % 14;
        if (d > 3 && d < 46 && band < 2) { r += 26; gg += 26; b += 22; }
        px[q] = r * k; px[q + 1] = gg * k; px[q + 2] = b * k; px[q + 3] = 255;
        continue;
      }
      if (a === M.OUT) {
        var hatch = ((x + y) % 9 === 0) ? 0.9 : 1;
        px[q] = 176 * g / 255 * hatch; px[q + 1] = 168 * g / 255 * hatch; px[q + 2] = 148 * g / 255 * hatch; px[q + 3] = 255;
      } else {
        landColor(owners[a], g, col);
        px[q] = col[0]; px[q + 1] = col[1]; px[q + 2] = col[2]; px[q + 3] = 255;
      }
      // 境目
      if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) continue;
      var oa = a >= 0 ? owners[a] : -9, edge = 0, mineEdge = false;
      for (var e = 0; e < 8; e++) {
        var dist = e < 4 ? 1 : 3;
        var no = o + (e % 4 === 0 ? dist : e % 4 === 1 ? -dist : e % 4 === 2 ? dist * W : -dist * W);
        var b2 = id[no];
        if (b2 === a) continue;
        if (b2 < M.OUT) { if (dist === 1) edge = Math.max(edge, 3); if (oa === player) mineEdge = true; continue; }
        var ob = b2 >= 0 ? owners[b2] : -9;
        if (ob !== oa) { edge = Math.max(edge, dist === 1 ? 3 : 2); if (oa === player) mineEdge = true; }
        else if (dist === 1) edge = Math.max(edge, 1);
      }
      if (mineEdge) { px[q] = px[q] * 0.25 + 255 * 0.75; px[q + 1] = px[q + 1] * 0.25 + 236 * 0.75; px[q + 2] = px[q + 2] * 0.25 + 150 * 0.75; }
      else if (edge === 3) { px[q] *= 0.3; px[q + 1] *= 0.28; px[q + 2] *= 0.26; }
      else if (edge === 2) { px[q] *= 0.62; px[q + 1] *= 0.6; px[q + 2] *= 0.58; }
      else if (edge === 1) { px[q] *= 0.8; px[q + 1] *= 0.79; px[q + 2] *= 0.77; }
    }
    mctx.putImageData(img, 0, 0);
  }

  // 国盗りの演出：(ox,oy) から新しい色が広がる。t は 0..1
  function wipe(i, fromOwner, toOwner, ox, oy, t) {
    var L = lists[i], b = bbox[i], col = [0, 0, 0];
    var far = 0, cs = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]];
    cs.forEach(function (c) { var d = Math.hypot(c[0] - ox * S, c[1] - oy * S); if (d > far) far = d; });
    var R = far * t * 1.08, R2 = R * R, band = 10 * S;
    for (var k = 0; k < L.length; k++) {
      var o = L[k], x = o % W, y = (o / W) | 0, dx = x - ox * S, dy = y - oy * S, d2 = dx * dx + dy * dy, q = o * 4;
      if (d2 < R2) {
        landColor(toOwner, grain[o], col);
        var dd = R - Math.sqrt(d2);
        if (dd < band) { var w = 1 - dd / band; col[0] += (255 - col[0]) * w; col[1] += (250 - col[1]) * w; col[2] += (220 - col[2]) * w; }
      } else landColor(fromOwner, grain[o], col);
      px[q] = col[0]; px[q + 1] = col[1]; px[q + 2] = col[2];
    }
    mctx.putImageData(img, 0, 0, b[0], b[1], b[2] - b[0] + 1, b[3] - b[1] + 1);
  }
  // 国をいっとき明るくする（内政の成長など）
  function provinceAt(mx, my) {
    var x = Math.round(mx * S), y = Math.round(my * S);
    if (x < 0 || y < 0 || x >= W || y >= H) return -1;
    var a = m.id[y * W + x];
    return a >= 0 ? a : -1;
  }
  // 国の形の切り抜き（強調表示用）
  var maskCache = {};
  function mask(i, rgba) {
    var key = i + rgba;
    if (maskCache[key]) return maskCache[key];
    var b = bbox[i], w = b[2] - b[0] + 1, h = b[3] - b[1] + 1;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var cx = c.getContext('2d'), im = cx.createImageData(w, h), L = lists[i];
    for (var k = 0; k < L.length; k++) {
      var o = L[k], x = o % W - b[0], y = ((o / W) | 0) - b[1], q = (y * w + x) * 4;
      im.data[q] = rgba[0]; im.data[q + 1] = rgba[1]; im.data[q + 2] = rgba[2]; im.data[q + 3] = rgba[3];
    }
    cx.putImageData(im, 0, 0);
    maskCache[key] = { c: c, x: b[0] / S, y: b[1] / S, w: w / S, h: h / S };
    return maskCache[key];
  }

  // ---- 絵の部品 ----
  var FONT = '"Yu Mincho","Hiragino Mincho ProN","YuMincho","MS PMincho",serif';
  var GOTH = '"Yu Gothic","Hiragino Kaku Gothic ProN","Meiryo",sans-serif';
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  var PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  // サイコロ。tone: 'omote' 象牙色 / 'ura' 藍色
  function die(c, cx, cy, size, v, tone, rot) {
    c.save(); c.translate(cx, cy); if (rot) c.rotate(rot);
    var h = size / 2, ura = tone === 'ura';
    c.fillStyle = 'rgba(0,0,0,0.28)'; rr(c, -h + 2, -h + 4, size, size, size * 0.2); c.fill();
    var g = c.createLinearGradient(-h, -h, h, h);
    if (ura) { g.addColorStop(0, '#4a6a94'); g.addColorStop(1, '#27405f'); }
    else { g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#e2d5bb'); }
    c.fillStyle = g; rr(c, -h, -h, size, size, size * 0.2); c.fill();
    c.lineWidth = Math.max(1, size * 0.035); c.strokeStyle = ura ? '#16263b' : '#8f7f62'; c.stroke();
    var d = size * 0.27, r = size * (v === 1 ? 0.105 : 0.085);
    (PIPS[v] || []).forEach(function (p) {
      c.beginPath(); c.arc(p[0] * d, p[1] * d, r, 0, 6.3);
      c.fillStyle = ura ? '#f3ecd9' : (v === 1 ? '#c4302b' : '#2b2622'); c.fill();
    });
    c.restore();
  }
  // 旗
  function flag(c, x, y, h, clan, lit) {
    var w = h * 0.78, P = D.PROV[clan];
    c.fillStyle = '#3a2c20'; c.fillRect(x - 1.2, y - 2, 2.2, h + 8);
    c.fillStyle = P.color; c.fillRect(x + 1, y, w, h);
    c.strokeStyle = lit ? '#fff2b0' : 'rgba(30,20,10,0.8)'; c.lineWidth = lit ? 2 : 1; c.strokeRect(x + 1, y, w, h);
    c.fillStyle = lum(P.color) > 150 ? '#221a14' : '#fff8e8';
    c.font = '700 ' + Math.round(h * 0.6) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(P.flag, x + 1 + w / 2, y + h / 2 + 1);
    c.textBaseline = 'alphabetic';
  }
  function lum(col) { var c = hex(col); return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; }
  // 城
  function castle(c, x, y, s, lv) {
    c.fillStyle = '#4a4038'; c.fillRect(x - s * 0.9, y + s * 0.2, s * 1.8, s * 0.5);
    c.fillStyle = '#f4efe2'; c.fillRect(x - s * 0.55, y - s * 0.35, s * 1.1, s * 0.6);
    c.fillStyle = '#39424a';
    c.beginPath(); c.moveTo(x - s * 0.85, y - s * 0.3); c.lineTo(x, y - s * 0.95); c.lineTo(x + s * 0.85, y - s * 0.3); c.closePath(); c.fill();
    if (lv >= 4) { c.fillStyle = '#f4efe2'; c.fillRect(x - s * 0.3, y - s * 1.2, s * 0.6, s * 0.35); c.fillStyle = '#39424a'; c.beginPath(); c.moveTo(x - s * 0.55, y - s * 1.15); c.lineTo(x, y - s * 1.6); c.lineTo(x + s * 0.55, y - s * 1.15); c.closePath(); c.fill(); }
  }
  // 和紙の地
  var paperPat = null;
  function paper(c) {
    if (paperPat) return paperPat;
    var t = document.createElement('canvas'); t.width = t.height = 128;
    var x = t.getContext('2d'), im = x.createImageData(128, 128);
    for (var i = 0; i < 128 * 128; i++) {
      var g = M.noise((i % 128) / 2.3, ((i / 128) | 0) / 2.3, 31) * 14 + M.noise((i % 128) / 17, ((i / 128) | 0) / 17, 32) * 12;
      im.data[i * 4] = 232 + g - 13; im.data[i * 4 + 1] = 220 + g - 13; im.data[i * 4 + 2] = 192 + g - 13; im.data[i * 4 + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    paperPat = c.createPattern(t, 'repeat');
    return paperPat;
  }
  // 金雲
  function cloud(c, x, y, w, h, a) {
    c.save(); c.globalAlpha = a;
    var g = c.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#f0d892'); g.addColorStop(1, '#c9a24a');
    c.fillStyle = g;
    for (var i = 0; i < 3; i++) { var yy = y + i * h / 3, off = (i % 2) * w * 0.14; rr(c, x + off, yy, w * (0.86 - i * 0.08), h / 3 + 1, h / 6); c.fill(); }
    c.restore();
  }

  root.KG = { init: init, paint: paint, wipe: wipe, provinceAt: provinceAt, mask: mask, die: die, flag: flag, castle: castle,
    rr: rr, paper: paper, cloud: cloud, lum: lum, hex: hex, FONT: FONT, GOTH: GOTH, S: S,
    map: function () { return mapC; }, deco: function () { return decoC; }, geo: function () { return m; },
    repaint: function () { if (lastOwners) paint(lastOwners, lastPlayer); } };
})(window);
