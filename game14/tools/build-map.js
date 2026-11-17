// build-map.js — generates js/mapdata.js (SVG paths, adjacency, anchors) for 天下賽 (game14)
// Usage: node tools/build-map.js [--preview out.svg]
// Pure Node, no dependencies. Geography is hand-entered lon/lat (approximate, stylised).
'use strict';
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- geography
// Mainland outline (lon, lat). Goes along the Japan-Sea coast W->E, closes off-map, Pacific coast E->W.
const MAINLAND = [
  [134.30, 35.60], [134.60, 35.66], [134.82, 35.66], [134.95, 35.70], [135.07, 35.73], [135.17, 35.76],
  [135.22, 35.78], [135.30, 35.73], [135.30, 35.66], [135.21, 35.58], [135.28, 35.53], [135.36, 35.50],
  [135.42, 35.53], [135.50, 35.51], [135.58, 35.53], [135.66, 35.51], [135.73, 35.50], [135.78, 35.55],
  [135.85, 35.60], [135.92, 35.63], [135.97, 35.70], [136.01, 35.76], [136.04, 35.69], [136.07, 35.66],
  [136.09, 35.71], [136.06, 35.80], [136.03, 35.92], [136.04, 36.03], [136.10, 36.13], [136.13, 36.23],
  [136.22, 36.30], [136.33, 36.38], [136.42, 36.45], [136.52, 36.55], [136.62, 36.65], [136.70, 36.76],
  [136.75, 36.88], [136.72, 37.00], [136.70, 37.10], [136.70, 37.20], [136.70, 37.30], [136.80, 37.38],
  [136.90, 37.41], [137.00, 37.43], [137.13, 37.47], [137.25, 37.52], [137.36, 37.53], [137.32, 37.45],
  [137.26, 37.38], [137.15, 37.30], [137.05, 37.17], [136.97, 37.06], [136.98, 36.95], [136.98, 36.86],
  [137.03, 36.79], [137.13, 36.76], [137.22, 36.76], [137.32, 36.78], [137.40, 36.82], [137.47, 36.88],
  [137.55, 36.93], [137.62, 36.96], [137.72, 37.00], [137.86, 37.04], [137.98, 37.09], [138.10, 37.14],
  [138.24, 37.18], [138.35, 37.25], [138.47, 37.32], [138.55, 37.38], [138.63, 37.47], [138.72, 37.58],
  [138.80, 37.67], [138.90, 37.77], [139.02, 37.90], [139.15, 37.98], [139.28, 38.05], [139.40, 38.14],
  [139.52, 38.30], [139.70, 38.60], [141.00, 38.60], [141.00, 35.60], [140.30, 35.62],
  // Pacific side, east -> west
  [139.90, 35.62], [139.75, 35.55], [139.68, 35.40], [139.66, 35.25], [139.62, 35.15], [139.57, 35.27],
  [139.48, 35.30], [139.35, 35.32], [139.22, 35.29], [139.15, 35.24], [139.12, 35.15], [139.08, 35.10],
  [139.12, 35.00], [139.12, 34.88], [139.05, 34.77], [138.97, 34.68], [138.86, 34.60], [138.78, 34.68],
  [138.76, 34.76], [138.75, 34.87], [138.77, 34.97], [138.82, 35.03], [138.87, 35.09], [138.78, 35.12],
  [138.68, 35.13], [138.58, 35.08], [138.52, 35.03], [138.48, 34.97], [138.42, 34.95], [138.32, 34.86],
  [138.27, 34.75], [138.22, 34.62], [138.10, 34.64], [137.95, 34.66], [137.80, 34.66], [137.65, 34.67],
  [137.55, 34.67], [137.42, 34.64], [137.25, 34.60], [137.05, 34.58], [137.03, 34.63], [137.17, 34.68],
  [137.30, 34.73], [137.32, 34.78], [137.22, 34.80], [137.12, 34.80], [137.05, 34.85], [136.98, 34.87],
  [136.95, 34.80], [136.96, 34.72], [136.97, 34.68], [136.90, 34.71], [136.84, 34.82], [136.84, 34.95],
  [136.88, 35.03], [136.85, 35.07], [136.76, 35.05], [136.70, 35.04], [136.66, 35.00], [136.63, 34.95],
  [136.60, 34.90], [136.57, 34.83], [136.53, 34.73], [136.55, 34.62], [136.62, 34.55], [136.72, 34.52],
  [136.84, 34.48], [136.88, 34.38], [136.90, 34.30], [136.80, 34.27], [136.65, 34.24], [136.50, 34.18],
  [136.35, 34.12], [136.20, 34.05], [136.10, 33.88], [136.00, 33.72], [135.90, 33.60], [135.78, 33.45],
  [135.60, 33.50], [135.40, 33.65], [135.25, 33.80], [135.15, 33.90], [135.13, 34.02], [135.15, 34.13],
  [135.17, 34.22], [135.10, 34.28], [135.20, 34.33], [135.30, 34.40], [135.38, 34.47], [135.44, 34.55],
  [135.43, 34.63], [135.42, 34.68], [135.38, 34.71], [135.30, 34.72], [135.20, 34.69], [135.10, 34.65],
  [135.00, 34.64], [134.85, 34.72], [134.68, 34.77], [134.50, 34.76], [134.30, 34.74],
];
const ISLANDS = {
  awaji: [[135.02, 34.60], [134.97, 34.53], [134.93, 34.45], [134.92, 34.35], [134.97, 34.28], [134.85, 34.22],
    [134.72, 34.20], [134.67, 34.25], [134.75, 34.35], [134.85, 34.45], [134.95, 34.55]],
  sado: [[138.38, 38.33], [138.52, 38.30], [138.55, 38.18], [138.47, 38.08], [138.55, 38.00], [138.52, 37.90],
    [138.38, 37.80], [138.24, 37.82], [138.30, 37.92], [138.38, 38.00], [138.23, 38.10], [138.22, 38.20], [138.30, 38.30]],
  shikoku: [[134.20, 34.32], [134.45, 34.28], [134.60, 34.22], [134.66, 34.12], [134.62, 34.00], [134.70, 33.86],
    [134.62, 33.70], [134.20, 33.55], [133.90, 33.60], [133.90, 34.30]],
  oshima: [[139.36, 34.79], [139.42, 34.78], [139.44, 34.72], [139.40, 34.68], [139.35, 34.71]],
};
const LAKES = {
  biwa: [[136.10, 35.52], [136.17, 35.53], [136.22, 35.48], [136.26, 35.42], [136.27, 35.37], [136.25, 35.28],
    [136.20, 35.22], [136.10, 35.15], [136.03, 35.11], [135.96, 35.07], [135.92, 35.03], [135.90, 34.98],
    [135.87, 35.00], [135.88, 35.06], [135.92, 35.10], [135.96, 35.17], [136.00, 35.24], [136.03, 35.30],
    [136.06, 35.36], [136.06, 35.43], [136.08, 35.49]],
  hamana: [[137.55, 34.70], [137.60, 34.69], [137.63, 34.73], [137.61, 34.80], [137.56, 34.79], [137.53, 34.74]],
};

// 20 playable provinces (index = No.-1). seeds: [lon, lat] points whose Voronoi union forms the province.
const PROVINCES = [
  { key: 'noto', name: '能登', seeds: [[136.85, 37.28], [137.10, 37.40], [136.80, 37.05], [136.95, 37.15], [136.86, 36.92]] },
  { key: 'echigo', name: '越後', seeds: [[137.95, 36.98], [138.20, 37.05], [138.45, 37.15], [138.70, 37.35], [138.95, 37.20],
    [138.80, 36.97], [139.10, 37.70], [139.30, 37.88], [139.45, 38.10], [138.95, 37.55]] },
  { key: 'izu', name: '伊豆', seeds: [[138.95, 34.80], [138.97, 35.00], [139.12, 35.25], [139.28, 35.40], [139.10, 35.45]] },
  { key: 'kaga', name: '加賀', seeds: [[136.45, 36.40], [136.62, 36.55], [136.72, 36.38], [136.74, 36.68], [136.70, 36.18]] },
  { key: 'etchu', name: '越中', seeds: [[136.98, 36.68], [137.20, 36.65], [137.40, 36.75], [137.55, 36.86], [137.15, 36.52], [137.42, 36.58]] },
  { key: 'echizen', name: '越前', seeds: [[136.22, 36.05], [136.15, 35.85], [136.45, 35.98], [136.45, 36.13], [136.08, 35.70], [136.58, 35.86]] },
  { key: 'wakasa', name: '若狭', seeds: [[135.75, 35.47], [135.58, 35.45], [135.90, 35.55]] },
  { key: 'hida', name: '飛騨', seeds: [[137.25, 36.15], [137.30, 36.35], [136.95, 36.25], [137.20, 35.85], [137.50, 36.10], [136.88, 36.12]] },
  { key: 'suruga', name: '遠江・駿河', seeds: [[137.66, 34.76], [137.95, 34.82], [137.85, 35.00], [138.30, 34.95], [138.40, 35.18],
    [138.62, 35.20], [138.15, 35.12], [138.85, 35.22]] },
  { key: 'mikawa', name: '三河', seeds: [[137.15, 34.92], [137.40, 34.80], [137.55, 34.95], [137.35, 35.10], [137.60, 35.14]] },
  { key: 'mino', name: '美濃', seeds: [[136.70, 35.40], [136.95, 35.50], [137.20, 35.45], [137.45, 35.50], [136.95, 35.80], [136.55, 35.55], [137.15, 35.66], [136.60, 35.26], [136.50, 35.36], [136.80, 35.90]] },
  { key: 'yamato', name: '大和', seeds: [[135.80, 34.66], [135.78, 34.50], [135.95, 34.50], [135.85, 34.30], [135.85, 34.08], [136.03, 34.38]] },
  { key: 'kitaomi', name: '北近江', seeds: [[136.28, 35.45], [136.30, 35.33], [136.27, 35.25], [136.18, 35.55], [136.05, 35.40], [136.00, 35.30]] },
  { key: 'minamiomi', name: '南近江', seeds: [[136.15, 35.10], [136.27, 35.05], [136.05, 35.00], [136.15, 34.92], [135.90, 35.05], [135.93, 35.15], [136.38, 35.10]] },
  { key: 'iga', name: '伊賀', seeds: [[136.13, 34.77], [136.10, 34.63]] },
  { key: 'ise', name: '伊勢・志摩', seeds: [[136.58, 35.02], [136.45, 34.85], [136.42, 34.68], [136.45, 34.50], [136.70, 34.45],
    [136.85, 34.33], [136.30, 34.46]] },
  { key: 'yamashiro', name: '山城', seeds: [[135.75, 35.02], [135.75, 34.88], [135.82, 34.78], [135.72, 35.12]] },
  { key: 'settsu', name: '摂津・河内', seeds: [[135.45, 34.75], [135.30, 34.80], [135.60, 34.85], [135.60, 34.62], [135.55, 34.45],
    [135.40, 34.45], [135.15, 34.72]] },
  { key: 'kai', name: '甲斐・信濃', seeds: [[138.20, 36.65], [138.36, 36.85], [137.90, 36.42], [138.25, 36.38], [138.48, 36.22],
    [137.97, 36.22], [138.00, 35.90], [137.80, 35.55], [137.65, 35.78], [138.55, 35.66], [138.42, 35.50], [138.85, 35.60],
    [138.80, 35.45], [138.35, 35.85]] },
  { key: 'owari', name: '尾張', seeds: [[136.90, 35.18], [136.85, 35.30], [136.98, 35.30], [136.88, 34.92], [136.95, 35.38], [136.76, 35.20]] },
];
// Off-map lands (not playable; drawn muted with faint names)
const NEUTRAL = [
  { key: 'tango', name: '丹後', seeds: [[135.18, 35.62], [135.28, 35.68]] },
  { key: 'tamba', name: '丹波', seeds: [[135.30, 35.28], [135.48, 35.18], [135.15, 35.15], [135.48, 35.36], [135.62, 35.22]] },
  { key: 'tajima', name: '但馬', seeds: [[134.78, 35.45], [134.55, 35.40]] },
  { key: 'harima', name: '播磨', seeds: [[134.80, 34.95], [134.55, 34.95], [134.98, 34.88]] },
  { key: 'kii', name: '紀伊', seeds: [[135.45, 34.05], [135.72, 33.82], [136.02, 33.95], [135.30, 34.15], [136.12, 34.15], [136.25, 34.16], [135.55, 34.22]] },
  { key: 'kanto', name: '関東', seeds: [[139.55, 35.65], [139.35, 35.92], [139.65, 36.10], [139.80, 35.40]] },
  { key: 'kozuke', name: '上野', seeds: [[138.95, 36.40], [138.85, 36.58], [139.20, 36.35]] },
  { key: 'ou', name: '奥羽', seeds: [[139.75, 37.60], [139.72, 38.15], [139.60, 37.25], [140.2, 37.0]] },
  { key: 'awaji', name: '淡路', island: 'awaji', seeds: [[134.85, 34.40]] },
  { key: 'sado', name: '佐渡', island: 'sado', seeds: [[138.40, 38.05]] },
  { key: 'shikoku', name: '四国', island: 'shikoku', seeds: [[134.3, 33.9]] },
  { key: 'oshima', name: '大島', island: 'oshima', seeds: [[139.40, 34.74]] },
];

// Intended adjacency (by key). The generator verifies the raster against this list.
const INTENDED = [
  ['noto', 'kaga'], ['noto', 'etchu'], ['echigo', 'etchu'], ['echigo', 'kai'], ['izu', 'suruga'], ['izu', 'kai'],
  ['kaga', 'etchu'], ['kaga', 'echizen'], ['kaga', 'hida'], ['etchu', 'hida'], ['echizen', 'wakasa'], ['echizen', 'kitaomi'],
  ['echizen', 'mino'], ['wakasa', 'kitaomi'], ['hida', 'mino'], ['hida', 'kai'], ['suruga', 'mikawa'], ['suruga', 'kai'],
  ['mikawa', 'owari'], ['mikawa', 'kai'], ['mikawa', 'mino'], ['mino', 'kitaomi'], ['mino', 'owari'], ['mino', 'ise'], ['mino', 'kai'],
  ['yamato', 'yamashiro'], ['yamato', 'settsu'], ['yamato', 'iga'], ['yamato', 'ise'], ['kitaomi', 'minamiomi'],
  ['minamiomi', 'yamashiro'], ['minamiomi', 'iga'], ['minamiomi', 'ise'], ['iga', 'ise'], ['iga', 'yamashiro'],
  ['ise', 'owari'], ['yamashiro', 'settsu'],
];
// Touching pairs that are deliberately NOT connected (drawn as mountain ridges): e.g. Northern Alps.
const IMPASSABLE = [['etchu', 'kai']];

// Manual label anchor overrides (lon, lat) where the automatic pole is awkward
const ANCHOR_OVERRIDE = {
  izu: [138.98, 35.03],
  ise: [136.47, 34.74],
  yamato: [135.84, 34.56],
};

// ---------------------------------------------------------------- projection (separable "Kinai magnifier")
const W = 1000;
const CROP = { lon0: 135.0, lon1: 139.72, lat0: 34.06, lat1: 38.02 };
const KX = Math.cos(36 * Math.PI / 180);
function erf(x) { // Abramowitz-Stegun 7.1.26
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const MAG = { lonC: 136.02, lonW: 0.62, lonA: 0.85, latC: 35.05, latW: 0.58, latA: 0.62 };
function Flon(lon) { return (lon - MAG.lonC) + MAG.lonA * MAG.lonW * Math.sqrt(Math.PI) / 2 * erf((lon - MAG.lonC) / MAG.lonW); }
function Flat(lat) { return (lat - MAG.latC) + MAG.latA * MAG.latW * Math.sqrt(Math.PI) / 2 * erf((lat - MAG.latC) / MAG.latW); }
const X0 = Flon(CROP.lon0) * KX, X1 = Flon(CROP.lon1) * KX;
const Y0 = -Flat(CROP.lat1), Y1 = -Flat(CROP.lat0);
const S = W / (X1 - X0);
const H = Math.round((Y1 - Y0) * S);
function proj(p) { return [(Flon(p[0]) * KX - X0) * S, (-Flat(p[1]) - Y0) * S]; }

// ---------------------------------------------------------------- raster
const CS = 2; // cell size (viewBox units)
const GW = Math.ceil(W / CS), GH = Math.ceil(H / CS);
const N = GW * GH;
const idx = (i, j) => j * GW + i;

function scanFill(polys, mask, value) {
  // even-odd scanline fill of projected polygons into mask (cell centers)
  for (let j = 0; j < GH; j++) {
    const y = (j + 0.5) * CS;
    const xs = [];
    for (const poly of polys) {
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], b = poly[(k + 1) % poly.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil(xs[k] / CS - 0.5)), i1 = Math.min(GW - 1, Math.floor(xs[k + 1] / CS - 0.5));
      for (let i = i0; i <= i1; i++) mask[idx(i, j)] = value;
    }
  }
}

const mainP = MAINLAND.map(proj);
const islandP = {}; for (const k in ISLANDS) islandP[k] = ISLANDS[k].map(proj);
const lakeP = {}; for (const k in LAKES) lakeP[k] = LAKES[k].map(proj);

const land = new Uint8Array(N); // 1 = mainland, 2.. = island id
scanFill([mainP], land, 1);
const islandKeys = Object.keys(ISLANDS);
islandKeys.forEach((k, n) => scanFill([islandP[k]], land, 2 + n));
const lake = new Uint8Array(N);
scanFill([lakeP.biwa], lake, 1);
scanFill([lakeP.hamana], lake, 2);

// regions: 0..19 provinces, 20.. neutral
const REGIONS = PROVINCES.map((p, i) => ({ ...p, id: i, playable: true }))
  .concat(NEUTRAL.map((p, i) => ({ ...p, id: 20 + i, playable: false })));
const keyToId = {}; REGIONS.forEach(r => keyToId[r.key] = r.id);
const seeds = [];
for (const r of REGIONS) for (const s of r.seeds) { const q = proj(s); seeds.push({ x: q[0], y: q[1], id: r.id, island: r.island || null }); }

// noise for organic borders
function hash2(ix, iy, seed) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  const top = a + (b - a) * sx, bot = c + (d - c) * sx;
  return top + (bot - top) * sy;
}
function fbm(x, y, seed) {
  return (vnoise(x, y, seed) - 0.5) + 0.5 * (vnoise(x * 2.13, y * 2.13, seed + 7) - 0.5) + 0.25 * (vnoise(x * 4.37, y * 4.37, seed + 13) - 0.5);
}
const WARP_F = 46, WARP_A = 17;

const label = new Int16Array(N).fill(-1);
const islandKeyOfLand = v => (v >= 2 ? islandKeys[v - 2] : null);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
  const c = idx(i, j);
  if (!land[c]) continue;
  const x = (i + 0.5) * CS, y = (j + 0.5) * CS;
  const isl = islandKeyOfLand(land[c]);
  if (isl) { // islands get their fixed neutral region
    const r = REGIONS.find(rr => rr.island === isl); label[c] = r.id; continue;
  }
  const wx = x + WARP_A * fbm(x / WARP_F, y / WARP_F, 11), wy = y + WARP_A * fbm(x / WARP_F, y / WARP_F, 29);
  let best = 1e18, bid = -1;
  for (const s of seeds) {
    if (s.island) continue;
    const dx = s.x - wx, dy = s.y - wy, d = dx * dx + dy * dy;
    if (d < best) { best = d; bid = s.id; }
  }
  label[c] = bid;
}

// contiguity cleanup: every region keeps only its largest 4-connected component on land; fragments merge into neighbours
function components(lbl) {
  const comp = new Int32Array(N).fill(-1); const list = [];
  for (let c = 0; c < N; c++) {
    if (lbl[c] < 0 || comp[c] >= 0) continue;
    const id = list.length, stack = [c], cells = []; comp[c] = id;
    while (stack.length) {
      const u = stack.pop(); cells.push(u);
      const i = u % GW, j = (u / GW) | 0;
      const nb = [i > 0 ? u - 1 : -1, i < GW - 1 ? u + 1 : -1, j > 0 ? u - GW : -1, j < GH - 1 ? u + GW : -1];
      for (const v of nb) if (v >= 0 && comp[v] < 0 && lbl[v] === lbl[c]) { comp[v] = id; stack.push(v); }
    }
    list.push({ id, label: lbl[c], cells });
  }
  return { comp, list };
}
for (let iter = 0; iter < 8; iter++) {
  const { list } = components(label);
  const biggest = {};
  for (const cp of list) if (!biggest[cp.label] || biggest[cp.label].cells.length < cp.cells.length) biggest[cp.label] = cp;
  let changed = 0;
  for (const cp of list) {
    if (biggest[cp.label] === cp) continue;
    const r = REGIONS[cp.label]; if (r.island) continue;
    const votes = {};
    for (const u of cp.cells) {
      const i = u % GW, j = (u / GW) | 0;
      for (const v of [i > 0 ? u - 1 : -1, i < GW - 1 ? u + 1 : -1, j > 0 ? u - GW : -1, j < GH - 1 ? u + GW : -1]) {
        if (v >= 0 && label[v] >= 0 && label[v] !== cp.label) votes[label[v]] = (votes[label[v]] || 0) + 1;
      }
    }
    let bl = -1, bv = -1; for (const k in votes) if (votes[k] > bv) { bv = votes[k]; bl = +k; }
    if (bl >= 0) { for (const u of cp.cells) label[u] = bl; changed++; }
  }
  if (!changed) break;
}

// true land (excludes lakes) for adjacency/anchors
const trueLand = new Uint8Array(N);
for (let c = 0; c < N; c++) trueLand[c] = land[c] && !lake[c] ? 1 : 0;

// sea band: propagate labels a few cells into the sea so fills extend under the coastline (clipped later)
const BAND = 5;
{
  let frontier = [];
  const dist = new Int16Array(N).fill(-1);
  for (let c = 0; c < N; c++) if (label[c] >= 0) { dist[c] = 0; frontier.push(c); }
  for (let step = 1; step <= BAND; step++) {
    const next = [];
    for (const u of frontier) {
      const i = u % GW, j = (u / GW) | 0;
      for (const v of [i > 0 ? u - 1 : -1, i < GW - 1 ? u + 1 : -1, j > 0 ? u - GW : -1, j < GH - 1 ? u + GW : -1]) {
        if (v >= 0 && dist[v] < 0) { dist[v] = step; label[v] = label[u]; next.push(v); }
      }
    }
    frontier = next;
  }
}

// ---------------------------------------------------------------- boundary chains
// lattice vertex key
const VW = GW + 1;
const vkey = (i, j) => j * VW + i;
const L = (i, j) => (i < 0 || j < 0 || i >= GW || j >= GH) ? -1 : label[idx(i, j)];
// edges stored as: key -> {u, v, a(left), b(right)} with direction u->v; left/right relative to direction
const edges = [];
const vertEdges = new Map(); // vertex -> list of edge indices
function addEdge(u, v, left, right) {
  const e = { u, v, left, right, used: false };
  const k = edges.length; edges.push(e);
  if (!vertEdges.has(u)) vertEdges.set(u, []); vertEdges.get(u).push(k);
  if (!vertEdges.has(v)) vertEdges.set(v, []); vertEdges.get(v).push(k);
}
// horizontal edges: from (i,j) to (i+1,j); moving +x (screen, y down): left = cell above (i,j-1), right = cell below (i,j)
for (let j = 0; j <= GH; j++) for (let i = 0; i < GW; i++) {
  const up = L(i, j - 1), dn = L(i, j);
  if (up !== dn) addEdge(vkey(i, j), vkey(i + 1, j), up, dn);
}
// vertical edges: from (i,j) to (i,j+1); moving +y: left = cell right (i,j), right = cell left (i-1,j)
for (let j = 0; j < GH; j++) for (let i = 0; i <= GW; i++) {
  const lf = L(i - 1, j), rt = L(i, j);
  if (lf !== rt) addEdge(vkey(i, j), vkey(i, j + 1), rt, lf);
}
const pairKey = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
function isNode(vk) {
  const es = vertEdges.get(vk);
  if (!es || es.length !== 2) return true;
  const e0 = edges[es[0]], e1 = edges[es[1]];
  return pairKey(e0.left, e0.right) !== pairKey(e1.left, e1.right);
}
const vxy = vk => [(vk % VW) * CS, Math.floor(vk / VW) * CS];

const chains = [];
function walk(startV, ek) {
  // returns chain of vertex keys and the label on the left of the walking direction
  const pts = [startV];
  let cur = startV, e = edges[ek];
  const fwd0 = e.u === cur;
  const leftLbl = fwd0 ? e.left : e.right, rightLbl = fwd0 ? e.right : e.left;
  for (;;) {
    e.used = true;
    const nxt = e.u === cur ? e.v : e.u;
    pts.push(nxt);
    if (nxt === startV) break;
    if (isNode(nxt)) break;
    const es = vertEdges.get(nxt);
    const ne = es.map(k => edges[k]).find(x => !x.used);
    if (!ne) break;
    cur = nxt; e = ne;
  }
  return { pts, left: leftLbl, right: rightLbl, closed: pts[0] === pts[pts.length - 1] };
}
for (const [vk, es] of vertEdges) {
  if (!isNode(vk)) continue;
  for (const ek of es) if (!edges[ek].used) chains.push(walk(vk, ek));
}
for (let k = 0; k < edges.length; k++) if (!edges[k].used) chains.push(walk(edges[k].u, k));

// geometry: edge midpoints (de-staircase) + Chaikin + RDP
function chainGeom(ch) {
  const P = ch.pts.map(vxy);
  let pts;
  if (ch.closed) {
    pts = [];
    for (let k = 0; k < P.length - 1; k++) pts.push([(P[k][0] + P[k + 1][0]) / 2, (P[k][1] + P[k + 1][1]) / 2]);
    for (let it = 0; it < 2; it++) {
      const q = [];
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k], b = pts[(k + 1) % pts.length];
        q.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
      }
      pts = q;
    }
    pts.push(pts[0]);
  } else {
    pts = [P[0]];
    for (let k = 0; k < P.length - 1; k++) pts.push([(P[k][0] + P[k + 1][0]) / 2, (P[k][1] + P[k + 1][1]) / 2]);
    pts.push(P[P.length - 1]);
    for (let it = 0; it < 2; it++) {
      const q = [pts[0]];
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1];
        if (k > 0) q.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
        if (k < pts.length - 2) q.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
      }
      q.push(pts[pts.length - 1]);
      pts = q;
    }
  }
  return rdp(pts, 0.28);
}
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    const ax = pts[s][0], ay = pts[s][1], bx = pts[e][0], by = pts[e][1];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
    let md = -1, mi = -1;
    for (let k = s + 1; k < e; k++) {
      const d = Math.abs((pts[k][0] - ax) * dy - (pts[k][1] - ay) * dx) / len;
      if (d > md) { md = d; mi = k; }
    }
    if (md > eps) { keep[mi] = 1; stack.push([s, mi], [mi, e]); }
  }
  return pts.filter((_, k) => keep[k]);
}
for (const ch of chains) ch.geom = chainGeom(ch);

const f1 = v => Math.round(v * 10) / 10;
const ptsToD = (pts, close) => 'M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L') + (close ? 'Z' : '');

// region rings: chains oriented with region on the left
function regionPath(rid) {
  const segs = [];
  for (const ch of chains) {
    if (ch.left === rid) segs.push({ s: ch.pts[0], e: ch.pts[ch.pts.length - 1], g: ch.geom, closed: ch.closed });
    else if (ch.right === rid) segs.push({ s: ch.pts[ch.pts.length - 1], e: ch.pts[0], g: ch.geom.slice().reverse(), closed: ch.closed });
  }
  const rings = [];
  const byStart = new Map();
  segs.forEach((sg, k) => { if (!sg.closed) { if (!byStart.has(sg.s)) byStart.set(sg.s, []); byStart.get(sg.s).push(k); } });
  const used = new Uint8Array(segs.length);
  segs.forEach((sg, k) => { if (sg.closed) { used[k] = 1; rings.push(sg.g); } });
  for (let k = 0; k < segs.length; k++) {
    if (used[k]) continue;
    let ring = [], cur = k, guard = 0;
    const start = segs[k].s;
    while (cur >= 0 && !used[cur] && guard++ < 100000) {
      used[cur] = 1;
      const g = segs[cur].g;
      ring = ring.concat(ring.length ? g.slice(1) : g);
      if (segs[cur].e === start) break;
      const cand = (byStart.get(segs[cur].e) || []).filter(x => !used[x]);
      cur = cand.length ? cand[0] : -1;
    }
    rings.push(ring);
  }
  return rings.map(r => ptsToD(r, true)).join('');
}

// ---------------------------------------------------------------- adjacency (true land only)
const shared = {};
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
  const c = idx(i, j);
  if (!trueLand[c]) continue;
  for (const [ni, nj] of [[i + 1, j], [i, j + 1]]) {
    if (ni >= GW || nj >= GH) continue;
    const d = idx(ni, nj);
    if (!trueLand[d]) continue;
    const a = label[c], b = label[d];
    if (a === b || a < 0 || b < 0) continue;
    const k = pairKey(a, b); shared[k] = (shared[k] || 0) + 1;
  }
}
const touching = [];
for (const k in shared) {
  const [a, b] = k.split(',').map(Number);
  if (a < 20 && b < 20 && shared[k] >= 3) touching.push([a, b, shared[k]]);
}
const intendedSet = new Set(INTENDED.map(([a, b]) => pairKey(keyToId[a], keyToId[b])));
const impSet = new Set(IMPASSABLE.map(([a, b]) => pairKey(keyToId[a], keyToId[b])));
const report = { missing: [], extra: [], impassableOk: [] };
const touchSet = new Set(touching.map(t => pairKey(t[0], t[1])));
for (const k of intendedSet) if (!touchSet.has(k)) report.missing.push(k.split(',').map(n => REGIONS[+n].name).join('-'));
for (const t of touching) {
  const k = pairKey(t[0], t[1]);
  if (!intendedSet.has(k)) {
    if (impSet.has(k)) report.impassableOk.push(REGIONS[t[0]].name + '-' + REGIONS[t[1]].name + ' (' + t[2] + ')');
    else report.extra.push(REGIONS[t[0]].name + '-' + REGIONS[t[1]].name + ' (' + t[2] + ')');
  }
}

// ---------------------------------------------------------------- anchors (pole of inaccessibility on true land)
const INF = 1e9;
const dist = new Float32Array(N);
for (let c = 0; c < N; c++) {
  const i = c % GW, j = (c / GW) | 0;
  if (!trueLand[c]) { dist[c] = 0; continue; }
  let edge = false;
  for (const [ni, nj] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {
    if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) { edge = true; break; }
    const d = idx(ni, nj); if (!trueLand[d] || label[d] !== label[c]) { edge = true; break; }
  }
  dist[c] = edge ? 1 : INF;
}
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { // forward chamfer
  const c = idx(i, j); if (dist[c] <= 1) continue;
  let m = dist[c];
  if (i > 0) m = Math.min(m, dist[c - 1] + 1);
  if (j > 0) m = Math.min(m, dist[c - GW] + 1);
  if (i > 0 && j > 0) m = Math.min(m, dist[c - GW - 1] + 1.414);
  if (i < GW - 1 && j > 0) m = Math.min(m, dist[c - GW + 1] + 1.414);
  dist[c] = m;
}
for (let j = GH - 1; j >= 0; j--) for (let i = GW - 1; i >= 0; i--) { // backward chamfer
  const c = idx(i, j); if (dist[c] <= 1) continue;
  let m = dist[c];
  if (i < GW - 1) m = Math.min(m, dist[c + 1] + 1);
  if (j < GH - 1) m = Math.min(m, dist[c + GW] + 1);
  if (i < GW - 1 && j < GH - 1) m = Math.min(m, dist[c + GW + 1] + 1.414);
  if (i > 0 && j < GH - 1) m = Math.min(m, dist[c + GW - 1] + 1.414);
  dist[c] = m;
}
const cent = REGIONS.map(() => ({ x: 0, y: 0, n: 0 }));
for (let c = 0; c < N; c++) if (trueLand[c] && label[c] >= 0) {
  const r = cent[label[c]]; r.x += (c % GW + 0.5) * CS; r.y += (((c / GW) | 0) + 0.5) * CS; r.n++;
}
cent.forEach(r => { if (r.n) { r.x /= r.n; r.y /= r.n; } });
const anchors = REGIONS.map(() => null);
const best = REGIONS.map(() => -1e9);
for (let c = 0; c < N; c++) {
  if (!trueLand[c] || label[c] < 0) continue;
  const r = label[c];
  const x = (c % GW + 0.5) * CS, y = (((c / GW) | 0) + 0.5) * CS;
  const score = Math.min(dist[c], 28) * CS - 0.12 * Math.hypot(x - cent[r].x, y - cent[r].y);
  if (score > best[r]) { best[r] = score; anchors[r] = [x, y, dist[c] * CS]; }
}
for (const k in ANCHOR_OVERRIDE) { const r = keyToId[k]; const q = proj(ANCHOR_OVERRIDE[k]); anchors[r] = [q[0], q[1], anchors[r][2]]; }

// ---------------------------------------------------------------- borders for drawing
const borderLines = []; // {a, b, d, kind}
for (const ch of chains) {
  const a = ch.left, b = ch.right;
  if (a < 0 || b < 0) continue;
  const k = pairKey(a, b);
  const kind = (a < 20 && b < 20) ? (intendedSet.has(k) ? 'border' : 'ridge') : ((a < 20 || b < 20) ? 'edge' : 'faint');
  borderLines.push({ a: Math.min(a, b), b: Math.max(a, b), kind, d: ptsToD(ch.geom, ch.closed), len: ch.pts.length });
}
// route control point: midpoint of the longest shared chain (on true land preferably)
function routeMid(a, b) {
  let bestCh = null, bl = -1;
  for (const ch of chains) {
    if (!((ch.left === a && ch.right === b) || (ch.left === b && ch.right === a))) continue;
    // count true-land length
    let n = 0;
    for (const vk of ch.pts) { const [x, y] = vxy(vk); const c = idx(Math.min(GW - 1, Math.floor(x / CS)), Math.min(GH - 1, Math.floor(y / CS))); if (trueLand[c]) n++; }
    if (n > bl) { bl = n; bestCh = ch; }
  }
  if (!bestCh) return null;
  // choose the true-land point nearest to the middle of the land part
  const land_pts = bestCh.pts.map(vxy).filter(([x, y]) => trueLand[idx(Math.min(GW - 1, Math.floor(x / CS)), Math.min(GH - 1, Math.floor(y / CS)))]);
  const arr = land_pts.length ? land_pts : bestCh.pts.map(vxy);
  return arr[Math.floor(arr.length / 2)];
}
// Dijkstra path between two anchors that stays inside provinces a and b (never crosses a third province or a lake)
function routePath(a, b) {
  const A = anchors[a], B = anchors[b];
  const cellOf = p => idx(Math.min(GW - 1, Math.floor(p[0] / CS)), Math.min(GH - 1, Math.floor(p[1] / CS)));
  const s = cellOf(A), g = cellOf(B);
  const ok = c => trueLand[c] && (label[c] === a || label[c] === b);
  const D = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const heap = []; // [cost, cell]
  const push = (d, c) => { heap.push([d, c]); let k = heap.length - 1; while (k > 0) { const pk = (k - 1) >> 1; if (heap[pk][0] <= heap[k][0]) break; [heap[pk], heap[k]] = [heap[k], heap[pk]]; k = pk; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  D[s] = 0; push(0, s);
  const nb8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [d, u] = pop();
    if (d > D[u]) continue;
    if (u === g) break;
    const i = u % GW, j = (u / GW) | 0;
    for (const [di, dj, w] of nb8) {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
      const v = idx(ni, nj); if (!ok(v)) continue;
      // prefer the interior: penalise cells near any border/coast
      const nd = d + w * (1 + 6 / (1 + dist[v]));
      if (nd < D[v]) { D[v] = nd; prev[v] = u; push(nd, v); }
    }
  }
  if (prev[g] < 0 && s !== g) return null;
  const pts = [];
  for (let c = g; c >= 0; c = prev[c]) { pts.push([(c % GW + 0.5) * CS, (((c / GW) | 0) + 0.5) * CS]); if (c === s) break; }
  pts.reverse();
  pts[0] = [A[0], A[1]]; pts[pts.length - 1] = [B[0], B[1]];
  // smooth: RDP then Chaikin
  let q = rdp(pts, 3.0);
  for (let it = 0; it < 3; it++) {
    const r = [q[0]];
    for (let k = 0; k < q.length - 1; k++) {
      const p0 = q[k], p1 = q[k + 1];
      if (k > 0) r.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]);
      if (k < q.length - 2) r.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]);
    }
    r.push(q[q.length - 1]); q = r;
  }
  q = rdp(q, 0.4);
  // length & midpoint
  let len = 0; for (let k = 1; k < q.length; k++) len += Math.hypot(q[k][0] - q[k - 1][0], q[k][1] - q[k - 1][1]);
  return { d: ptsToD(q, false), len: f1(len), pts: q };
}
const routes = INTENDED.map(([ka, kb]) => {
  const a = keyToId[ka], b = keyToId[kb];
  const m = routeMid(a, b);
  const rp = routePath(a, b);
  if (!rp) console.warn('NO ROUTE', ka, kb);
  return { a, b, m: m ? [f1(m[0]), f1(m[1])] : null, d: rp ? rp.d : null, len: rp ? rp.len : 0 };
});

// ---------------------------------------------------------------- decoration: mountain glyph sites
const MOUNTAINOUS = { hida: 1.0, kai: 0.9, echigo: 0.55, etchu: 0.5, mino: 0.45, echizen: 0.35, kaga: 0.35, iga: 0.4, yamato: 0.35,
  kozuke: 0.6, ou: 0.6, tamba: 0.4, kii: 0.55, tajima: 0.3, suruga: 0.35, mikawa: 0.25, wakasa: 0.25, kitaomi: 0.2, ise: 0.25, noto: 0.2 };
const mountains = [];
{
  let rs = 12345;
  const rnd = () => { rs = (Math.imul(rs, 1103515245) + 12345) >>> 0; return rs / 4294967296; };
  const cand = [];
  for (let c = 0; c < N; c += 1) {
    if (!trueLand[c] || label[c] < 0) continue;
    const r = REGIONS[label[c]]; const w = MOUNTAINOUS[r.key] || 0; if (!w) continue;
    if (dist[c] < 5) continue;
    cand.push(c);
  }
  for (let t = 0; t < 2600; t++) {
    const c = cand[Math.floor(rnd() * cand.length)];
    const r = REGIONS[label[c]]; const w = MOUNTAINOUS[r.key];
    if (rnd() > w) continue;
    const x = (c % GW + 0.5) * CS, y = (((c / GW) | 0) + 0.5) * CS;
    const an = anchors[label[c]];
    if (an && Math.hypot(x - an[0], y - (an[1] + 6)) < 46) continue;
    if (mountains.some(m => Math.hypot(m[0] - x, m[1] - y) < 26)) continue;
    const sz = 7 + rnd() * 6 + (r.key === 'hida' || r.key === 'kai' ? 3 : 0);
    mountains.push([f1(x), f1(y), f1(sz)]);
  }
}
const fuji = proj([138.73, 35.36]).map(f1);

// ---------------------------------------------------------------- coast paths (smoothed, closed Catmull-Rom)
function smoothClosed(P) {
  // Catmull-Rom to cubic Bezier
  const n = P.length; let d = 'M' + f1(P[0][0]) + ' ' + f1(P[0][1]);
  for (let k = 0; k < n; k++) {
    const p0 = P[(k - 1 + n) % n], p1 = P[k], p2 = P[(k + 1) % n], p3 = P[(k + 2) % n];
    const t = 0.5 / 3;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += 'C' + [c1, c2, p2].map(p => f1(p[0]) + ' ' + f1(p[1])).join(' ');
  }
  return d + 'Z';
}
const coast = [smoothClosed(mainP)].concat(islandKeys.map(k => smoothClosed(islandP[k])));
const lakes = { biwa: smoothClosed(lakeP.biwa), hamana: smoothClosed(lakeP.hamana) };

// ---------------------------------------------------------------- output
const out = {
  w: W, h: H,
  provinces: PROVINCES.map((p, i) => ({ key: p.key, name: p.name, d: regionPath(i), anchor: anchors[i].map(f1), cx: f1(cent[i].x), cy: f1(cent[i].y) })),
  neutral: NEUTRAL.map((p, n) => { const id = 20 + n; return { key: p.key, name: p.name, d: regionPath(id), anchor: anchors[id] ? anchors[id].map(f1) : null }; }),
  borders: borderLines.filter(b => b.len > 1).map(b => ({ a: b.a, b: b.b, kind: b.kind, d: b.d })),
  routes,
  coast, lakes,
  mountains, fuji,
};
const js = '// generated by tools/build-map.js — do not edit by hand\nwindow.MAPDATA = ' + JSON.stringify(out) + ';\n';
const outPath = path.join(__dirname, '..', 'js', 'mapdata.js');
fs.writeFileSync(outPath, js);
console.log('wrote', outPath, (js.length / 1024).toFixed(1) + ' KB', 'viewBox', W, H, 'grid', GW, GH);
console.log('adjacency report:', JSON.stringify(report, null, 1));
// degree summary
const deg = {};
for (const [a, b] of INTENDED) { deg[a] = (deg[a] || 0) + 1; deg[b] = (deg[b] || 0) + 1; }
console.log('degrees:', PROVINCES.map(p => p.name + deg[p.key]).join(' '));

// optional preview SVG
const pv = process.argv.indexOf('--preview');
if (pv > 0) {
  const COLORS = ['#c0392b', '#2e86c1', '#1e8449', '#7d3c98', '#b9770e', '#a04000', '#117a65', '#5d6d7e', '#cb4335', '#2874a6',
    '#239b56', '#884ea0', '#d68910', '#6e2c00', '#148f77', '#566573', '#e74c3c', '#3498db', '#27ae60', '#9b59b6'];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  s += `<rect width="${W}" height="${H}" fill="#9fb7c4"/><defs><clipPath id="land"><path d="${coast.join('')}"/></clipPath></defs>`;
  s += `<path d="${coast.join('')}" fill="#e8dcc0"/>`;
  s += `<g clip-path="url(#land)">`;
  out.neutral.forEach(r => { s += `<path d="${r.d}" fill="#d9ceb4" fill-rule="evenodd"/>`; });
  out.provinces.forEach((p, i) => { s += `<path d="${p.d}" fill="${COLORS[i]}" fill-opacity="0.75" fill-rule="evenodd"/>`; });
  out.borders.forEach(b => { s += `<path d="${b.d}" fill="none" stroke="${b.kind === 'ridge' ? '#f00' : '#222'}" stroke-width="${b.kind === 'border' || b.kind === 'ridge' ? 1.6 : (b.kind === 'edge' ? 1.2 : 0.5)}"/>`; });
  s += `</g>`;
  s += `<path d="${lakes.biwa}" fill="#9fb7c4" stroke="#222" stroke-width="1"/><path d="${lakes.hamana}" fill="#9fb7c4" stroke="#222" stroke-width="0.6"/>`;
  s += `<path d="${coast.join('')}" fill="none" stroke="#222" stroke-width="1.4"/>`;
  routes.forEach(r => {
    if (r.d) s += `<path d="${r.d}" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  });
  mountains.forEach(m => { s += `<path d="M${m[0] - m[2]} ${m[1] + m[2] * 0.4}L${m[0]} ${m[1] - m[2] * 0.6}L${m[0] + m[2]} ${m[1] + m[2] * 0.4}" fill="none" stroke="#333" stroke-width="1"/>`; });
  out.provinces.forEach(p => { s += `<circle cx="${p.anchor[0]}" cy="${p.anchor[1]}" r="4" fill="#fff"/><text x="${p.anchor[0]}" y="${p.anchor[1] - 8}" font-size="16" text-anchor="middle" font-family="Yu Mincho" fill="#000">${p.name}</text>`; });
  out.neutral.forEach(p => { if (p.anchor) s += `<text x="${p.anchor[0]}" y="${p.anchor[1]}" font-size="13" text-anchor="middle" font-family="Yu Mincho" fill="#776">${p.name}</text>`; });
  s += `<text x="${fuji[0]}" y="${fuji[1]}" font-size="14">▲</text>`;
  s += '</svg>';
  fs.writeFileSync(process.argv[pv + 1], s);
  console.log('preview', process.argv[pv + 1]);
}
