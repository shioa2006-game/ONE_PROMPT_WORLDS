/* 賽駆け — 地図の生成
   緯度経度 → 平面（近畿を拡大する魚眼）→ 1600×900 の世界座標。
   国の塗り分けは「最寄りの種点（ゆがみ付き）」によるラスタで作る。 */
(function (root) {
  'use strict';
  const SG = root.SG;
  const D = SG.DATA, E = SG.E;
  const W = 1600, H = 900;

  // ───── 投影 ─────
  const LON0 = 136.0, LAT0 = 35.6, KX = Math.cos(35.5 * Math.PI / 180);
  const CFG = root.MAPCFG || {};
  const FC = CFG.FC || { lat: 34.98, lon: 136.2 };
  const FA = CFG.FA || 0.85, FS = CFG.FS || 1.25;
  function raw(lat, lon) { return [(lon - LON0) * KX, -(lat - LAT0)]; }
  const C0 = raw(FC.lat, FC.lon);
  // 楕円形の魚眼（近畿〜東海の帯を拡大）
  const FANG = CFG.FANG != null ? CFG.FANG : -0.32, FS2 = CFG.FS2 || 0.65;
  const CA = Math.cos(FANG), SA = Math.sin(FANG);
  function fish(p) {
    const dx = p[0] - C0[0], dy = p[1] - C0[1];
    const u = dx * CA + dy * SA, v = -dx * SA + dy * CA;
    const r2 = (u * u) / (FS * FS) + (v * v) / (FS2 * FS2);
    const f = 1 + FA * Math.exp(-r2);
    return [C0[0] + dx * f, C0[1] + dy * f];
  }
  // 表示範囲（魚眼後の平面）
  const VIEW = CFG.VIEW || { x0: -3.95, x1: 4.55, y0: -2.75, y1: 2.28 };
  const SC = Math.min(W / (VIEW.x1 - VIEW.x0), H / (VIEW.y1 - VIEW.y0));
  const OX = (W - (VIEW.x1 - VIEW.x0) * SC) / 2, OY = (H - (VIEW.y1 - VIEW.y0) * SC) / 2;
  function proj(lat, lon) {
    const q = fish(raw(lat, lon));
    return [OX + (q[0] - VIEW.x0) * SC, OY + (q[1] - VIEW.y0) * SC];
  }
  function polyProj(pts) {
    // 長い辺は細かく分けてから投影（魚眼で曲がるため）
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const n = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / 0.08));
      for (let k = 0; k < n; k++) out.push(proj(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n));
    }
    return out;
  }

  // ───── ノード位置 ─────
  const POS = [];
  D.PROV.forEach((p, i) => { POS[i] = proj(p.lat, p.lon); });
  // 国境の位置：二つの城の中点（必要なら手で補正）
  const BORDER_NUDGE = {
    'kitaomi-wakasa': [0, -6], 'echizen-wakasa': [-4, -10], 'echizen-mino': [6, -14], 'mino-minamishinano': [0, 0],
    'awa-sagami': [0, 4], 'iga-minamiomi': [-8, 4], 'ise-minamiomi': [10, 8],
    'ise-yamato': [8, 6], 'ise-kii': [10, 0], 'kawachi-yamashiro': [6, -4],
  };
  for (let i = E.P; i < E.N; i++) {
    const nd = E.nodes[i];
    const a = POS[nd.a], b = POS[nd.b];
    let x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2;
    const nk = BORDER_NUDGE[nd.key];
    if (nk) { x += nk[0]; y += nk[1]; }
    POS[i] = [x, y];
  }

  // ───── 乱数・ノイズ ─────
  function mul(seed) { let t = seed >>> 0; return () => { t = (t + 0x6D2B79F5) | 0; let r = Math.imul(t ^ (t >>> 15), t | 1); r ^= r + Math.imul(r ^ (r >>> 7), r | 61); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
  function makeNoise(seed, cell) {
    const rnd = mul(seed);
    const GW = Math.ceil(W / cell) + 3, GH = Math.ceil(H / cell) + 3;
    const g = new Float32Array(GW * GH);
    for (let i = 0; i < g.length; i++) g[i] = rnd() * 2 - 1;
    return (x, y) => {
      const fx = x / cell + 1, fy = y / cell + 1;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const i0 = Math.max(0, Math.min(GH - 2, iy)) * GW + Math.max(0, Math.min(GW - 2, ix));
      const a = g[i0], b = g[i0 + 1], c = g[i0 + GW], d = g[i0 + GW + 1];
      return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
    };
  }

  function pointInPoly(x, y, poly) {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
    }
    return ins;
  }

  // ───── 地図の構築（ブラウザ） ─────
  function build(RS) {
    RS = RS || 1.5;
    const MW = Math.round(W * RS), MH = Math.round(H * RS);
    const isl = {};
    const islNames = Object.keys(D.COAST);
    islNames.forEach(k => { isl[k] = polyProj(D.COAST[k]); });
    const lake = polyProj(D.LAKE);

    // 陸地マスク（島ごとに番号を塗る）
    const mc = document.createElement('canvas'); mc.width = MW; mc.height = MH;
    const mx = mc.getContext('2d');
    mx.imageSmoothingEnabled = false;
    islNames.forEach((k, i) => {
      mx.fillStyle = 'rgb(' + (i + 1) + ',0,0)';
      mx.beginPath();
      isl[k].forEach((p, j) => { if (j) mx.lineTo(p[0] * RS, p[1] * RS); else mx.moveTo(p[0] * RS, p[1] * RS); });
      mx.closePath(); mx.fill();
    });
    mx.fillStyle = 'rgb(0,0,0)';
    mx.beginPath(); lake.forEach((p, j) => { if (j) mx.lineTo(p[0] * RS, p[1] * RS); else mx.moveTo(p[0] * RS, p[1] * RS); }); mx.closePath(); mx.fill();
    const md = mx.getImageData(0, 0, MW, MH).data;
    const land = new Uint8Array(MW * MH);
    for (let i = 0; i < land.length; i++) {
      // 縁のアンチエイリアス値は 0 か島番号に丸める
      const r = md[i * 4], a = md[i * 4 + 3];
      land[i] = a > 127 && r > 0 && r <= islNames.length ? r : 0;
    }

    // 種点
    const seeds = [];
    const islOf = (x, y) => { for (let i = 0; i < islNames.length; i++) if (pointInPoly(x, y, isl[islNames[i]])) return i + 1; return 0; };
    D.PROV.forEach((p, i) => {
      const pts = [[p.lat, p.lon]].concat(p.x || []);
      pts.forEach(q => { const w = proj(q[0], q[1]); seeds.push({ x: w[0], y: w[1], id: i, isl: islOf(w[0], w[1]) || 1 }); });
    });
    D.OUTER.forEach((o, k) => {
      o.pts.forEach(q => { const w = proj(q[0], q[1]); seeds.push({ x: w[0], y: w[1], id: 100 + k, isl: islNames.indexOf(o.isl) + 1 }); });
    });

    // 最寄り種点（ゆがみ付き）。ブロックごとに候補を絞る
    const nz1 = makeNoise(7, 70), nz2 = makeNoise(11, 70), nz3 = makeNoise(13, 22), nz4 = makeNoise(17, 22);
    const WARP = 15, WARP2 = 4;
    const idx = new Uint8Array(MW * MH).fill(255);
    const B = 16;
    const bySl = {};
    seeds.forEach(sd => { (bySl[sd.isl] = bySl[sd.isl] || []).push(sd); });
    for (let by = 0; by < MH; by += B) {
      for (let bx = 0; bx < MW; bx += B) {
        const cx = (bx + B / 2) / RS, cy = (by + B / 2) / RS;
        const rad = (B / RS) * 0.75 + (WARP + WARP2) * 1.5;
        const cache = {};
        for (let y = by; y < Math.min(MH, by + B); y++) {
          for (let x = bx; x < Math.min(MW, bx + B); x++) {
            const i = y * MW + x;
            const li = land[i];
            if (!li) continue;
            let cand = cache[li];
            if (!cand) {
              const list = bySl[li] || seeds;
              let dmin = Infinity;
              for (const sd of list) { const d = Math.hypot(sd.x - cx, sd.y - cy); if (d < dmin) dmin = d; }
              cand = cache[li] = list.filter(sd => Math.hypot(sd.x - cx, sd.y - cy) <= dmin + 2 * rad);
            }
            const wx = x / RS, wy = y / RS;
            const px = wx + nz1(wx, wy) * WARP + nz3(wx, wy) * WARP2;
            const py = wy + nz2(wx, wy) * WARP + nz4(wx, wy) * WARP2;
            let best = 255, bd = Infinity;
            for (const sd of cand) {
              const d = (sd.x - px) * (sd.x - px) + (sd.y - py) * (sd.y - py);
              if (d < bd) { bd = d; best = sd.id; }
            }
            idx[i] = best;
          }
        }
      }
    }

    // 国境のマスを、二国が実際に接している線の上（両城の中点にいちばん近い所）へ置く
    {
      const want = {};
      for (let i = E.P; i < E.N; i++) {
        const nd = E.nodes[i];
        if (nd.t === 'S') continue;
        const a = POS[nd.a], b = POS[nd.b];
        want[Math.min(nd.a, nd.b) * 256 + Math.max(nd.a, nd.b)] = { i, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, best: Infinity, x: 0, y: 0 };
      }
      const consider = (i1, i2, x, y) => {
        const a = idx[i1], b = idx[i2];
        if (a === b || a >= E.P || b >= E.P) return;
        const w = want[Math.min(a, b) * 256 + Math.max(a, b)];
        if (!w) return;
        const wx = x / RS, wy = y / RS;
        // 海岸から少し離す（近くに海があれば遠い扱い）
        let coast = 0;
        const R2 = Math.round(10 * RS);
        if (!land[i1 - R2] || !land[i1 + R2] || !land[i1 - R2 * MW] || !land[i1 + R2 * MW]) coast = 40;
        let d = Math.hypot(wx - w.mx, wy - w.my) + coast;
        // 城のすぐそばは避ける
        for (const cp of CASTLES) { const dc = Math.hypot(wx - cp[0], wy - cp[1]); if (dc < 32) d += (32 - dc) * 4; }
        if (d < w.best) { w.best = d; w.x = wx; w.y = wy; }
      };
      const CASTLES = POS.slice(0, E.P);
      for (let y = 1; y < MH - 1; y += 1) for (let x = 1; x < MW - 1; x += 1) {
        const i = y * MW + x;
        if (!land[i]) continue;
        if (land[i + 1]) consider(i, i + 1, x, y);
        if (land[i + MW]) consider(i, i + MW, x, y);
      }
      // 接していない組（間に海や他国がある）は、どちらかの国の陸で中点にいちばん近い所
      const miss = Object.values(want).filter(w => w.best === Infinity);
      if (miss.length) {
        const st = Math.max(1, Math.round(RS));
        for (let y = 0; y < MH; y += st) for (let x = 0; x < MW; x += st) {
          const i = y * MW + x;
          if (!land[i]) continue;
          const id = idx[i];
          for (const w of miss) {
            const nd = E.nodes[w.i];
            if (id !== nd.a && id !== nd.b) continue;
            const wx = x / RS, wy = y / RS;
            let d = Math.hypot(wx - w.mx, wy - w.my);
            const R2 = Math.round(10 * RS);
            if (!land[i - R2] || !land[i + R2] || !land[i - R2 * MW] || !land[i + R2 * MW]) d += 25;
            for (const cp of CASTLES) { const dc = Math.hypot(wx - cp[0], wy - cp[1]); if (dc < 32) d += (32 - dc) * 4; }
            if (d < w.best2 || w.best2 === undefined) { w.best2 = d; w.x = wx; w.y = wy; }
          }
        }
      }
      for (const k in want) {
        const w = want[k];
        if (w.best < Infinity || w.best2 !== undefined) POS[w.i] = [w.x, w.y];
      }
    }

    // 国ごとのマスク
    const masks = [];
    for (let p = 0; p < E.P; p++) masks.push({ x0: MW, y0: MH, x1: -1, y1: -1, n: 0, sx: 0, sy: 0 });
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const id = idx[y * MW + x];
      if (id < E.P) {
        const m = masks[id];
        if (x < m.x0) m.x0 = x; if (x > m.x1) m.x1 = x; if (y < m.y0) m.y0 = y; if (y > m.y1) m.y1 = y;
        m.n++; m.sx += x; m.sy += y;
      }
    }
    masks.forEach((m, p) => {
      const w = m.x1 - m.x0 + 1, h = m.y1 - m.y0 + 1;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d');
      const im = cx.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (idx[(y + m.y0) * MW + x + m.x0] === p) { const o = (y * w + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = 255; im.data[o + 3] = 255; }
      }
      cx.putImageData(im, 0, 0);
      m.cv = cv; m.w = w; m.h = h;
      m.cx = m.sx / m.n / RS; m.cy = m.sy / m.n / RS;
    });

    // 境界（国境と海岸）
    const bc = document.createElement('canvas'); bc.width = MW; bc.height = MH;
    const bx2 = bc.getContext('2d');
    const bim = bx2.createImageData(MW, MH);
    const bd = bim.data;
    for (let y = 0; y < MH - 1; y++) for (let x = 0; x < MW - 1; x++) {
      const i = y * MW + x;
      const a = idx[i], r = idx[i + 1], d = idx[i + MW];
      const la = land[i], lr = land[i + 1], ld = land[i + MW];
      if (la && ((lr && r !== a) || (ld && d !== a))) {
        const o = i * 4; bd[o] = 70; bd[o + 1] = 52; bd[o + 2] = 34; bd[o + 3] = Math.max(bd[o + 3], 120);
        const o2 = (lr && r !== a) ? (i + 1) * 4 : (i + MW) * 4; bd[o2] = 70; bd[o2 + 1] = 52; bd[o2 + 2] = 34; bd[o2 + 3] = Math.max(bd[o2 + 3], 70);
      }
    }
    bx2.putImageData(bim, 0, 0);

    return { RS, MW, MH, isl, lake, land, idx, masks, borders: bc, seeds };
  }

  const MAP = { W, H, proj, polyProj, POS, build, makeNoise, mul, pointInPoly };
  root.SG.MAP = MAP;
})(window);
