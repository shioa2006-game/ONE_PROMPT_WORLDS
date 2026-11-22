/* 戦国すごろく全国版 — 地図の生成
   geography.js の投影で陸と湖を描き、最寄りの種点による下塗りに共有国境を重ねる。 */
(function (root) {
  'use strict';
  const SG = root.SG;
  const D = SG.DATA, E = SG.E, PJ = SG.PJ;
  const W = PJ.W, H = PJ.H;
  // 地図定義を渡さずに生成する過去の比較用ページは元の図を使う。
  const geography = SG.GEO;
  const proj = geography ? geography.project : PJ.proj;
  const polyProj = geography ? geography.outline : PJ.polyProj;

  // ───── ノード位置 ─────
  const POS = [];
  const castlePoint = geography?.castlePoint || (p => [p.lat,p.lon]);
  D.PROV.forEach((p, i) => { POS[i] = proj(...castlePoint(p)); });
  // 国境の位置：まずは二つの城の中点（海路は手で補正）。陸の国境は build() で接する線の上へ置き直す
  const BORDER_NUDGE = {
    'boshu-sagami': [4, 10], 'higo-nishihizen': [-6, 8], 'aki-iyo': [0, 6],
  };
  for (let i = E.P; i < E.N; i++) {
    const nd = E.nodes[i];
    const a = POS[nd.a], b = POS[nd.b];
    let x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2;
    const nk = BORDER_NUDGE[nd.key];
    if (nk) { x += nk[0]; y += nk[1]; }
    POS[i] = [x, y];
  }
  if (geography) {
    for (const [key, point] of Object.entries(geography.straits)) POS[E.nodeOf(key)] = proj(...point);
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
    RS = RS || 1.25;
    const MW = Math.round(W * RS), MH = Math.round(H * RS);
    const isl = {};
    const coast = geography ? geography.coastlines : D.COAST;
    const islNames = Object.keys(coast);
    const islandIds = Object.fromEntries(islNames.map((k,i) => [k,i+1]));
    islNames.forEach(k => { isl[k] = polyProj(coast[k]); });
    const lakes = (geography ? geography.lakes : D.LAKES).map(l => polyProj(l));

    // 陸地マスク（島ごとに番号を塗る）
    const mc = document.createElement('canvas'); mc.width = MW; mc.height = MH;
    const mx = mc.getContext('2d');
    mx.imageSmoothingEnabled = false;
    // 半透明の岸では非乗算RGBに戻すと最大1ほど丸まる。島番号に間隔を空け、
    // 四国の縁や小島の画素が本州など別の島の国として塗られるのを防ぐ。
    // 既存28島の符号は固定し、増えた島は緑のチャンネルで区別する。
    const islandStep = geography ? 9 : 1;
    islNames.forEach((k, i) => {
      const red = geography ? (i % 28 + 1) * islandStep : i + 1;
      const green = geography ? Math.floor(i / 28) * 80 : 0;
      mx.fillStyle = 'rgb(' + red + ',' + green + ',0)';
      mx.beginPath();
      isl[k].forEach((p, j) => { if (j) mx.lineTo(p[0] * RS, p[1] * RS); else mx.moveTo(p[0] * RS, p[1] * RS); });
      mx.closePath(); mx.fill();
    });
    mx.fillStyle = 'rgb(0,0,0)';
    lakes.forEach(lake => { mx.beginPath(); lake.forEach((p, j) => { if (j) mx.lineTo(p[0] * RS, p[1] * RS); else mx.moveTo(p[0] * RS, p[1] * RS); }); mx.closePath(); mx.fill(); });
    const md = mx.getImageData(0, 0, MW, MH).data;
    const land = new Uint8Array(MW * MH);
    for (let i = 0; i < land.length; i++) {
      const r = Math.round(md[i * 4] / islandStep) + 28 * Math.round(md[i * 4 + 1] / 80), a = md[i * 4 + 3];
      land[i] = a > 127 && r > 0 && r <= islNames.length ? r : 0;
    }

    // 種点
    const seeds = [];
    const islOf = (x, y) => { for (let i = 0; i < islNames.length; i++) if (pointInPoly(x, y, isl[islNames[i]])) return i + 1; return 0; };
    D.PROV.forEach((p, i) => {
      const pts = [castlePoint(p)].concat(p.x || []);
      pts.forEach(q => { const w = proj(q[0], q[1]); seeds.push({ x: w[0], y: w[1], id: i, isl: islOf(w[0], w[1]) || 1 }); });
    });
    D.OUTER.forEach((o, k) => {
      o.pts.forEach(q => { const w = proj(q[0], q[1]); seeds.push({ x: w[0], y: w[1], id: 100 + k, isl: islNames.indexOf(o.isl) + 1 }); });
    });

    // 最寄り種点（ゆがみ付き）。ブロックごとに候補を絞る
    const nz1 = makeNoise(7, 70), nz2 = makeNoise(11, 70), nz3 = makeNoise(13, 22), nz4 = makeNoise(17, 22);
    const WARP = 14, WARP2 = 4;
    const idx = new Uint8Array(MW * MH).fill(255);
    const islandProvince = {};
    for (const [island,id] of Object.entries(geography?.islandProvince || {})) {
      islandProvince[islandIds[island]] = E.PI[id];
    }
    for (const [island,parent] of Object.entries(geography?.outerIslands || {})) {
      islandProvince[islandIds[island]] = 100 + D.OUTER.findIndex(o => o.isl === parent);
    }
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
            if (islandProvince[li] !== undefined) { idx[i] = islandProvince[li]; continue; }
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

    if (geography) geography.paint(idx, land, MW, MH, RS, islandIds);

    // 国境のマスを、二国が実際に接している線の上（両城の中点にいちばん近い所）へ置く
    {
      const want = {};
      for (let i = E.P; i < E.N; i++) {
        const nd = E.nodes[i];
        if (nd.t === 'S') continue;
        const a = POS[nd.a], b = POS[nd.b];
        want[Math.min(nd.a, nd.b) * 256 + Math.max(nd.a, nd.b)] = { i, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, best: Infinity, x: 0, y: 0, choices: [] };
      }
      const CASTLES = POS.slice(0, E.P);
      const R2 = Math.round(9 * RS);
      const consider = (i1, i2, x, y) => {
        const a = idx[i1], b = idx[i2];
        if (a === b || a >= E.P || b >= E.P) return;
        const w = want[Math.min(a, b) * 256 + Math.max(a, b)];
        if (!w) return;
        const wx = x / RS, wy = y / RS;
        let coast = 0;
        if (!land[i1 - R2] || !land[i1 + R2] || !land[i1 - R2 * MW] || !land[i1 + R2 * MW]) coast = 40;
        let d = Math.hypot(wx - w.mx, wy - w.my) + coast;
        for (const cp of CASTLES) { const dc = Math.hypot(wx - cp[0], wy - cp[1]); if (dc < 26) d += (26 - dc) * 4; }
        if (geography) w.choices.push([wx, wy, d]);
        if (d < w.best) { w.best = d; w.x = wx; w.y = wy; }
      };
      for (let y = 1; y < MH - 1; y += 1) for (let x = 1; x < MW - 1; x += 1) {
        const i = y * MW + x;
        if (!land[i]) continue;
        if (land[i + 1]) consider(i, i + 1, x, y);
        if (land[i + MW]) consider(i, i + MW, x, y);
      }
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
            if (!land[i - R2] || !land[i + R2] || !land[i - R2 * MW] || !land[i + R2 * MW]) d += 25;
            for (const cp of CASTLES) { const dc = Math.hypot(wx - cp[0], wy - cp[1]); if (dc < 26) d += (26 - dc) * 4; }
            if (d < w.best2 || w.best2 === undefined) { w.best2 = d; w.x = wx; w.y = wy; }
          }
        }
      }
      for (const k in want) {
        const w = want[k];
        if (w.best < Infinity || w.best2 !== undefined) POS[w.i] = [w.x, w.y];
      }
      if (geography) {
        // 三つの国が近くで接する所では、別々の峠・街道が同じ角に寄りやすい。
        // 海路と城を固定し、陸路を保てる位置を共有国境の上で探す。
        const crowdedGap = 22, gap = 28;
        const clearance = (n, x, y) => {
          let min = gap * gap;
          for (let i = 0; i < E.N; i++) {
            if (i === n) continue;
            const dx = x - POS[i][0], dy = y - POS[i][1];
            min = Math.min(min, dx * dx + dy * dy);
          }
          return Math.sqrt(min);
        };
        const onLand = (castle, node, point) => {
          const path = [POS[castle], ...between(castle, node), point];
          for (let i = 1; i < path.length; i++) {
            const [x, y] = path[i - 1], [tx, ty] = path[i];
            const steps = Math.max(1, Math.ceil(Math.hypot(tx - x, ty - y) * RS));
            for (let k = 0; k <= steps; k++) {
              const u = Math.floor((x + (tx - x) * k / steps) * RS);
              const v = Math.floor((y + (ty - y) * k / steps) * RS);
              if (!land[v * MW + u]) return false;
            }
          }
          return true;
        };
        const crowded = Object.values(want)
          .filter(w => w.choices.length)
          .map(w => ({ ...w, space: clearance(w.i, w.x, w.y) }))
          .filter(w => w.space < crowdedGap)
          .sort((a, b) => a.space - b.space);
        for (const w of crowded) {
          let bestGap = clearance(w.i, ...POS[w.i]);
          if (bestGap >= crowdedGap) continue;
          const { a, b } = E.nodes[w.i];
          const separated = POS.filter(([x, y]) => Math.hypot(x - w.x, y - w.y) >= crowdedGap);
          w.choices.sort((a, b) => a[2] - b[2]);
          for (const [x, y] of w.choices) {
            if (Math.hypot(x - w.x, y - w.y) > 48) continue;
            const space = clearance(w.i, x, y);
            if (space < gap && space < bestGap + 1) continue;
            if (space < crowdedGap && separated.some(([px, py]) => Math.hypot(x - px, y - py) < crowdedGap)) continue;
            const point = [x, y];
            if (!onLand(a, w.i, point) || !onLand(b, w.i, point)) continue;
            POS[w.i] = point;
            bestGap = space;
            if (space >= gap) break;
          }
        }
      }
      build.missing = miss.map(w => E.nodes[w.i].key);
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
      if (!m.n) { m.x0 = m.y0 = 0; m.x1 = m.y1 = 0; }
      const w = m.x1 - m.x0 + 1, h = m.y1 - m.y0 + 1;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d');
      const im = cx.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (idx[(y + m.y0) * MW + x + m.x0] === p) { const o = (y * w + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = 255; im.data[o + 3] = 255; }
      }
      cx.putImageData(im, 0, 0);
      m.cv = cv; m.w = w; m.h = h;
      m.cx = m.n ? m.sx / m.n / RS : POS[p][0]; m.cy = m.n ? m.sy / m.n / RS : POS[p][1];
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
        const o = i * 4; bd[o] = 70; bd[o + 1] = 52; bd[o + 2] = 34; bd[o + 3] = Math.max(bd[o + 3], 130);
        const o2 = (lr && r !== a) ? (i + 1) * 4 : (i + MW) * 4; bd[o2] = 70; bd[o2 + 1] = 52; bd[o2 + 2] = 34; bd[o2 + 3] = Math.max(bd[o2 + 3], 70);
      }
    }
    bx2.putImageData(bim, 0, 0);

    return { RS, MW, MH, isl, lakes, land, idx, masks, borders: bc, seeds };
  }

  const straight = [];
  const between = geography ? geography.between : () => straight;
  function routePosition(from, to, fraction) {
    const points = [POS[from], ...between(from,to), POS[to]];
    const lengths = points.slice(1).map(([x,y], i) => Math.hypot(x - points[i][0], y - points[i][1]));
    let left = fraction * lengths.reduce((a,b) => a+b, 0);
    for (let i=0; i<lengths.length; i++) {
      if (left <= lengths[i] && lengths[i]) {
        const a = points[i], b = points[i+1], t = left / lengths[i];
        return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t];
      }
      left -= lengths[i];
    }
    return POS[to];
  }
  const MAP = { W, H, proj, polyProj, POS, build, makeNoise, mul, pointInPoly, between, routePosition };
  root.SG.MAP = MAP;
})(window);
