// STAIRWARD — クォータービューの描画（640×360 に描いて2倍に拡大）
(function (root) {
  'use strict';
  const D = root.K20D, S = root.K20S, SP = root.K20SP;
  const R = {};
  const LW = 640, LH = 360;
  R.LW = LW; R.LH = LH;
  R.OX = 320; R.OY = 82;
  const BASE_Z = -1.6; // 盤のふちの深さ

  function iso(wx, wy, wz) { return { x: R.OX + (wx - wy) * 16, y: R.OY + (wx + wy) * 8 - wz * 8 }; }
  R.iso = iso;

  // 決まった値の揺らぎ（タイルの模様用）
  function hash(x, y, k) {
    let h = (x * 374761393 + y * 668265263 + (k || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ---------------- 色 ----------------
  const PAL = {
    night: {
      grass: ['#2c4638', '#33503f', '#27402f'], grassSide: ['#3a2e2a', '#2c2320'],
      floor: '#4a5064', floorLine: '#3a4052', pave: '#665e58', paveLine: '#544c48',
      rock: '#4a4234', rockSide: ['#3a332c', '#2a2420'], rockLine: '#5c5242', moss: '#3e5236',
      wall: '#7a7688', wallSide: ['#5a586a', '#464456'], brick: '#383644',
      tower: '#7a5a42', towerLine: '#56402e', stair: '#7c788a', stairLine: '#52506a', stairRise: '#504c60',
      dirt: '#4a3c32', dirtLine: '#3c3028', ramp: '#544232',
      skyTop: '#090a1c', skyBot: '#24203e', mount: '#1a1a30', snow: '#8a96b8',
      light: 1,
    },
    dawn: {
      grass: ['#5a8a4a', '#64944f', '#4f7c42'], grassSide: ['#6a5440', '#544232'],
      floor: '#8a8c94', floorLine: '#74767e', pave: '#a8988a', paveLine: '#8c7e72',
      rock: '#80745e', rockSide: ['#6a5e4c', '#54493a'], rockLine: '#968a70', moss: '#6a8a4e',
      wall: '#b8b0a4', wallSide: ['#988e82', '#7c746a'], brick: '#5e574e',
      tower: '#8a6a4e', towerLine: '#6a503a', stair: '#9c968c', stairLine: '#7c766c', stairRise: '#8a847a',
      dirt: '#7a6048', dirtLine: '#664e3a', ramp: '#806448',
      skyTop: '#7ea6d8', skyBot: '#f4c8a0', mount: '#6a7aa0', snow: '#f4f6fa',
      light: 0.15,
    },
  };
  R.PAL = PAL;

  // 灯り（地面に焼きこむ）
  const LIGHTS = [
    { x: 6.6, y: 10.4, z: 4, r: 2.6, c: [255, 150, 60] },
    { x: 10.4, y: 10.4, z: 4, r: 2.6, c: [255, 150, 60] },
    { x: 11.4, y: 3.6, z: 4, r: 2.4, c: [255, 150, 60] },
    { x: 11.4, y: 7.4, z: 4, r: 2.4, c: [255, 150, 60] },
    { x: 3.9, y: 1.5, z: 5, r: 3.0, c: [255, 190, 90] },
    { x: 9.5, y: 2.5, z: 3, r: 2.8, c: [255, 140, 50] },
    { x: 1.7, y: 6.8, z: 4, r: 2.0, c: [255, 150, 60] },
    { x: 7.4, y: 11.6, z: 2, r: 2.0, c: [255, 150, 60] },
  ];
  R.LIGHTS = LIGHTS;

  // ---------------- タイル ----------------
  function topCorners(x, y, t) {
    const h = t.h;
    if (t.k === 'A') return [[x, y, h], [x + 1, y, h], [x + 1, y + 1, h - 1], [x, y + 1, h - 1]];
    if (t.k === 'B' || t.k === 'R') return [[x, y, h], [x + 1, y, h - 1], [x + 1, y + 1, h - 1], [x, y + 1, h]];
    return [[x, y, h], [x + 1, y, h], [x + 1, y + 1, h], [x, y + 1, h]];
  }
  // 隣の升の、共有する辺の低いほうの高さ
  function edgeZ(nx, ny, side) {
    const t = S.tile(nx, ny);
    if (!t) return BASE_Z;
    if (t.k === 'v') return -3;
    if (t.k === 'A') return side === 'x' ? t.h - 1 : t.h - 1;
    if (t.k === 'B' || t.k === 'R') return side === 'y' ? t.h - 1 : t.h;
    return t.h;
  }

  let tileCache = { night: null, dawn: null };
  function buildTiles(palName) {
    const P = PAL[palName];
    const list = [];
    for (let y = 0; y < D.H; y++) for (let x = 0; x < D.W; x++) {
      const t = S.tile(x, y);
      if (t.k === 'v') continue;
      const tc = topCorners(x, y, t);
      // +x 面：(x+1, y)〜(x+1, y+1)、+y 面：(x, y+1)〜(x+1, y+1)
      const zx = edgeZ(x + 1, y, 'x');
      const zy = edgeZ(x, y + 1, 'y');
      const pts = tc.map((c) => iso(c[0], c[1], c[2]));
      const bx1 = iso(x + 1, y, zx), bx2 = iso(x + 1, y + 1, zx);
      const by1 = iso(x, y + 1, zy), by2 = iso(x + 1, y + 1, zy);
      let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      for (const p of pts.concat([bx1, bx2, by1, by2])) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
      const extra = (t.k === 'w' || t.k === 't') ? 6 : 0;
      minY -= extra + 1; minX -= 1; maxX += 1; maxY += 1;
      const cw = Math.ceil(maxX - minX), ch = Math.ceil(maxY - minY);
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const g = c.getContext('2d');
      const ox = Math.floor(minX), oy = Math.floor(minY);
      g.translate(-ox, -oy);
      drawTile(g, x, y, t, tc, pts, zx, zy, P);
      list.push({ x, y, depth: x + y + 1, c, ox, oy, k: t.k });
    }
    return list;
  }

  function poly(g, ps, fill) {
    g.beginPath();
    g.moveTo(ps[0].x, ps[0].y);
    for (let i = 1; i < ps.length; i++) g.lineTo(ps[i].x, ps[i].y);
    g.closePath();
    g.fillStyle = fill; g.fill();
  }
  function line(g, a, b, col) {
    g.strokeStyle = col; g.lineWidth = 1;
    g.beginPath(); g.moveTo(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5); g.lineTo(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5); g.stroke();
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r * f)));
    gg = Math.max(0, Math.min(255, Math.round(gg * f)));
    b = Math.max(0, Math.min(255, Math.round(b * f)));
    return 'rgb(' + r + ',' + gg + ',' + b + ')';
  }
  R.shade = shade;

  function drawTile(g, x, y, t, tc, pts, zx, zy, P) {
    const k = t.k;
    let top, sideL, sideR;
    if (k === 'g') { top = P.grass[Math.floor(hash(x, y) * 3)]; sideL = P.grassSide[0]; sideR = P.grassSide[1]; }
    else if (k === 'f' || k === 'G') { top = P.floor; sideL = P.wallSide[0]; sideR = P.wallSide[1]; }
    else if (k === 'p' || k === 'K') { top = P.pave; sideL = P.wallSide[0]; sideR = P.wallSide[1]; }
    else if (k === 'r') { top = P.rock; sideL = P.rockSide[0]; sideR = P.rockSide[1]; }
    else if (k === 'w') { top = P.wall; sideL = P.wallSide[0]; sideR = P.wallSide[1]; }
    else if (k === 't') { top = P.tower; sideL = P.wallSide[0]; sideR = P.wallSide[1]; }
    else if (k === 'A' || k === 'B') { top = P.stair; sideL = P.wallSide[0]; sideR = P.wallSide[1]; }
    else if (k === 'R') { top = P.ramp; sideL = P.grassSide[0]; sideR = P.grassSide[1]; }
    else if (k === 'd') { top = P.dirt; sideL = P.rockSide[0]; sideR = P.rockSide[1]; }
    else { top = '#ff00ff'; sideL = sideR = '#ff00ff'; }
    // 盤のふち（外側）は土の色
    const outerX = !S.tile(x + 1, y), outerY = !S.tile(x, y + 1);
    const grassy = k === 'g' || k === 'R';
    // 側面 +y（左手前）
    const c2 = tc[2], c3 = tc[3];
    if (Math.max(c2[2], c3[2]) > zy + 0.01) {
      const p2 = pts[2], p3 = pts[3];
      const q2 = iso(x + 1, y + 1, zy), q3 = iso(x, y + 1, zy);
      const col = outerY && grassy ? P.grassSide[0] : sideL;
      poly(g, [p3, p2, q2, q3], col);
      sideDetail(g, x, y, k, 'y', c3[2], c2[2], zy, P, outerY);
    }
    // 側面 +x（右手前）
    const c1 = tc[1];
    if (Math.max(c1[2], c2[2]) > zx + 0.01) {
      const p1 = pts[1], p2 = pts[2];
      const q1 = iso(x + 1, y, zx), q2 = iso(x + 1, y + 1, zx);
      const col = outerX && grassy ? P.grassSide[1] : sideR;
      poly(g, [p1, p2, q2, q1], col);
      sideDetail(g, x, y, k, 'x', c1[2], c2[2], zx, P, outerX);
    }
    // 上面
    poly(g, pts, top);
    topDetail(g, x, y, t, tc, P);
    // 灯りの照り返し
    if (P.light > 0.2) bakeLight(g, x, y, t, pts, P);
  }

  function sideDetail(g, x, y, k, side, zA, zB, zBot, P, outer) {
    const zTop = Math.min(zA, zB);
    if (k === 'w' || k === 't' || k === 'f' || k === 'p' || k === 'G' || k === 'K' || k === 'A' || k === 'B') {
      // 石積みの目地
      for (let z = Math.floor(zTop * 2) / 2 - 0.5; z > zBot; z -= 0.5) {
        const a = side === 'x' ? iso(x + 1, y, z) : iso(x, y + 1, z);
        const b = side === 'x' ? iso(x + 1, y + 1, z) : iso(x + 1, y + 1, z);
        line(g, a, b, P.brick);
        const off = (Math.round(z * 2) % 2) ? 0.25 : 0.75;
        const m1 = side === 'x' ? iso(x + 1, y + off, z) : iso(x + off, y + 1, z);
        const m2 = side === 'x' ? iso(x + 1, y + off, z + 0.5) : iso(x + off, y + 1, z + 0.5);
        if (z + 0.5 <= zTop + 0.01) line(g, m1, m2, P.brick);
      }
    } else if (k === 'r' || k === 'd') {
      for (let i = 0; i < 3; i++) {
        const u = hash(x, y, i + (side === 'x' ? 7 : 3));
        const z = zBot + (zTop - zBot) * hash(x, y, i + 11);
        const a = side === 'x' ? iso(x + 1, y + u, z) : iso(x + u, y + 1, z);
        const b = side === 'x' ? iso(x + 1, y + u + 0.2, z - 0.3) : iso(x + u + 0.2, y + 1, z - 0.3);
        line(g, a, b, P.rockSide[1]);
      }
    } else if (k === 'g' || k === 'R') {
      // 土の層
      if (zTop - zBot > 0.6) {
        const a = side === 'x' ? iso(x + 1, y, zTop - 0.25) : iso(x, y + 1, zTop - 0.25);
        const b = side === 'x' ? iso(x + 1, y + 1, zTop - 0.25) : iso(x + 1, y + 1, zTop - 0.25);
        line(g, a, b, shade(P.grass[0], 0.9));
      }
    }
  }

  function topDetail(g, x, y, t, tc, P) {
    const k = t.k, h = t.h;
    if (k === 'g') {
      for (let i = 0; i < 4; i++) {
        const u = hash(x, y, i * 3 + 1), v = hash(x, y, i * 3 + 2);
        const p = iso(x + 0.15 + u * 0.7, y + 0.15 + v * 0.7, h);
        g.fillStyle = hash(x, y, i + 40) > 0.5 ? shade(P.grass[0], 1.25) : shade(P.grass[0], 0.8);
        g.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 2);
      }
    } else if (k === 'f' || k === 'p' || k === 'K' || k === 'G') {
      const col = k === 'f' || k === 'G' ? P.floorLine : P.paveLine;
      line(g, iso(x + 0.5, y, h), iso(x + 0.5, y + 1, h), col);
      line(g, iso(x, y + 0.5, h), iso(x + 1, y + 0.5, h), col);
    } else if (k === 'r') {
      const a = iso(x + 0.2 + hash(x, y, 5) * 0.3, y + 0.3, h), b = iso(x + 0.6, y + 0.4 + hash(x, y, 6) * 0.3, h);
      line(g, a, b, P.rockLine);
      for (let i = 0; i < 3; i++) {
        const p = iso(x + 0.15 + hash(x, y, 50 + i) * 0.7, y + 0.15 + hash(x, y, 60 + i) * 0.7, h);
        g.fillStyle = P.moss; g.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1);
      }
    } else if (k === 'w') {
      line(g, iso(x + 0.5, y, h), iso(x + 0.5, y + 1, h), P.brick);
      // 胸壁（外側のふち）
      const outerX = x === 11, outerY = y === 10;
      if (outerX) merlons(g, x + 1, y, x + 1, y + 1, h, P);
      if (outerY) merlons(g, x, y + 1, x + 1, y + 1, h, P);
    } else if (k === 't') {
      for (let i = 1; i < 4; i++) line(g, iso(x + i / 4, y, h), iso(x + i / 4, y + 1, h), P.towerLine);
      merlons(g, x + 1, y, x + 1, y + 1, h, P);
      merlons(g, x, y + 1, x + 1, y + 1, h, P);
    } else if (k === 'A') {
      for (let i = 1; i < 4; i++) {
        const z = h - i / 4;
        line(g, iso(x, y + i / 4, z), iso(x + 1, y + i / 4, z), P.stairLine);
      }
    } else if (k === 'B') {
      for (let i = 1; i < 4; i++) {
        const z = h - i / 4;
        line(g, iso(x + i / 4, y, z), iso(x + i / 4, y + 1, z), P.stairLine);
      }
    } else if (k === 'R' || k === 'd') {
      const z0 = k === 'R' ? h - 0.5 : h;
      for (let i = 0; i < 3; i++) {
        const u = hash(x, y, 30 + i);
        const p = iso(x + 0.2 + u * 0.6, y + 0.3 + hash(x, y, 33 + i) * 0.4, z0);
        g.fillStyle = P.dirtLine; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
      }
    }
  }
  function merlons(g, x0, y0, x1, y1, h, P) {
    for (let i = 0; i < 2; i++) {
      const u0 = 0.12 + i * 0.5, u1 = u0 + 0.26;
      const a = iso(x0 + (x1 - x0) * u0, y0 + (y1 - y0) * u0, h), b = iso(x0 + (x1 - x0) * u1, y0 + (y1 - y0) * u1, h);
      g.fillStyle = P.wallSide[0];
      g.fillRect(Math.round(Math.min(a.x, b.x)), Math.round(Math.min(a.y, b.y)) - 4, Math.max(2, Math.round(Math.abs(b.x - a.x))), 4 + Math.round(Math.abs(b.y - a.y)));
      g.fillStyle = P.wall;
      g.fillRect(Math.round(Math.min(a.x, b.x)), Math.round(Math.min(a.y, b.y)) - 5, Math.max(2, Math.round(Math.abs(b.x - a.x))), 2);
    }
  }
  function bakeLight(g, x, y, t, pts, P) {
    for (const L of LIGHTS) {
      const d = Math.hypot(L.x - (x + 0.5), L.y - (y + 0.5));
      if (d > L.r + 0.8 || Math.abs(L.z - t.h) > 2.2) continue;
      const c = iso(L.x, L.y, t.h);
      const rad = L.r * 16;
      const gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, rad);
      gr.addColorStop(0, 'rgba(' + L.c.join(',') + ',0.30)');
      gr.addColorStop(0.5, 'rgba(' + L.c.join(',') + ',0.12)');
      gr.addColorStop(1, 'rgba(' + L.c.join(',') + ',0)');
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < 4; i++) g.lineTo(pts[i].x, pts[i].y); g.closePath();
      g.clip();
      g.fillStyle = gr; g.fillRect(c.x - rad, c.y - rad, rad * 2, rad * 2);
      g.restore();
    }
  }

  R.init = function () {
    tileCache.night = buildTiles('night');
    tileCache.dawn = buildTiles('dawn');
    R.stars = [];
    for (let i = 0; i < 90; i++) R.stars.push({ x: hash(i, 1, 9) * LW, y: hash(i, 2, 9) * 150, b: hash(i, 3, 9) });
  };

  // ---------------- 背景 ----------------
  function drawSky(g, M, P) {
    const gr = g.createLinearGradient(0, 0, 0, LH);
    gr.addColorStop(0, P.skyTop); gr.addColorStop(1, P.skyBot);
    g.fillStyle = gr; g.fillRect(0, 0, LW, LH);
    if (M.pal === 'night') {
      for (const s of R.stars) {
        const tw = 0.5 + 0.5 * Math.sin(M.time * 1.3 + s.b * 20);
        g.fillStyle = 'rgba(220,230,255,' + (0.25 + 0.5 * s.b * tw).toFixed(2) + ')';
        g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      }
      // 月
      g.fillStyle = '#f2ecd0'; g.beginPath(); g.arc(560, 40, 11, 0, Math.PI * 2); g.fill();
      g.fillStyle = P.skyTop; g.beginPath(); g.arc(565, 37, 10, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = 'rgba(255,240,200,0.6)'; g.beginPath(); g.arc(520, 70, 18, 0, Math.PI * 2); g.fill();
    }
    // 峠の山なみ（夜ごとに雪がとけていく）
    const melt = M.melt || 0;
    g.fillStyle = P.mount;
    g.beginPath(); g.moveTo(0, 150);
    const ridge = [[0, 150], [60, 110], [120, 128], [190, 70], [250, 105], [300, 88], [360, 120], [430, 64], [500, 112], [560, 92], [640, 130], [640, 360], [0, 360]];
    for (const p of ridge) g.lineTo(p[0], p[1]);
    g.closePath(); g.fill();
    // 雪
    g.fillStyle = P.snow;
    const snowH = 26 - melt * 4.5;
    for (const pk of [[190, 70], [430, 64], [60, 110], [300, 88], [560, 92]]) {
      if (snowH <= 2) continue;
      g.beginPath();
      g.moveTo(pk[0], pk[1]);
      g.lineTo(pk[0] - snowH * 0.9, pk[1] + snowH);
      g.lineTo(pk[0] - snowH * 0.3, pk[1] + snowH * 0.75);
      g.lineTo(pk[0], pk[1] + snowH * 0.95);
      g.lineTo(pk[0] + snowH * 0.4, pk[1] + snowH * 0.7);
      g.lineTo(pk[0] + snowH * 0.9, pk[1] + snowH);
      g.closePath(); g.fill();
    }
    // 峠道
    g.strokeStyle = M.pal === 'night' ? 'rgba(140,150,190,0.35)' : 'rgba(120,90,60,0.5)';
    g.beginPath(); g.moveTo(330, 150); g.lineTo(360, 122); g.lineTo(400, 108); g.lineTo(430, 70); g.stroke();
  }

  // ---------------- 本丸 ----------------
  function drawKeep(g, M) {
    const P = PAL[M.pal];
    const z0 = 5, z1 = 8.4, zr = 10.6;
    const night = M.pal === 'night';
    const wallL = night ? '#6a5e58' : '#b8a690', wallR = night ? '#54484a' : '#968472';
    // +y 面（左手前）
    poly(g, [iso(0, 3, z1), iso(3, 3, z1), iso(3, 3, z0), iso(0, 3, z0)], wallL);
    // +x 面（右手前）
    poly(g, [iso(3, 0, z1), iso(3, 3, z1), iso(3, 3, z0), iso(3, 0, z0)], wallR);
    // 木組み
    for (const u of [0, 1.5, 3]) line(g, iso(u, 3, z0), iso(u, 3, z1), night ? '#3a2e2a' : '#6a5038');
    for (const u of [0, 3]) line(g, iso(3, u, z0), iso(3, u, z1), night ? '#3a2e2a' : '#6a5038');
    line(g, iso(0, 3, z1 - 0.1), iso(3, 3, z1 - 0.1), night ? '#3a2e2a' : '#6a5038');
    line(g, iso(3, 0, z1 - 0.1), iso(3, 3, z1 - 0.1), night ? '#3a2e2a' : '#6a5038');
    // 窓（+y 面）
    const lit = night ? '#ffcf70' : '#5a4a3a';
    for (const u of [0.7, 2.3]) poly(g, [iso(u - 0.25, 3, 7.4), iso(u + 0.25, 3, 7.4), iso(u + 0.25, 3, 6.5), iso(u - 0.25, 3, 6.5)], lit);
    // 扉（+x 面、y = 1.5）
    const open = M.doorOpen ? 1 : 0;
    poly(g, [iso(3, 1.05, 7.0), iso(3, 1.95, 7.0), iso(3, 1.95, 5), iso(3, 1.05, 5)], open ? '#ffdf90' : (night ? '#5a3a24' : '#7a5034'));
    if (!open) { line(g, iso(3, 1.5, 7.0), iso(3, 1.5, 5), '#2a1a10'); }
    if (M.doorFlash > 0) {
      g.save(); g.globalAlpha = Math.min(1, M.doorFlash) * 0.7;
      poly(g, [iso(3, 1.05, 7.0), iso(3, 1.95, 7.0), iso(3, 1.95, 5), iso(3, 1.05, 5)], '#ff4030');
      g.restore();
    }
    // 屋根
    const ov = 0.35;
    const a = iso(-ov, -ov, z1), b = iso(3 + ov, -ov, z1), c = iso(3 + ov, 3 + ov, z1), d = iso(-ov, 3 + ov, z1);
    const top1 = iso(1.5, 0.6, zr), top2 = iso(1.5, 2.4, zr);
    const roofL = night ? '#3a3a58' : '#6a5a8a', roofR = night ? '#2c2c46' : '#54466e';
    poly(g, [d, c, top2, top1].map((p) => p), roofL);
    poly(g, [c, b, top1, top2], roofR);
    poly(g, [d, a, top1], night ? '#33334f' : '#5e5080');
    line(g, top1, top2, night ? '#5a5a80' : '#8a7ab0');
    // 煙突と煙
    const ch = iso(0.7, 1.0, zr - 0.6);
    g.fillStyle = night ? '#4a4040' : '#8a7060'; g.fillRect(Math.round(ch.x) - 2, Math.round(ch.y) - 8, 4, 8);
    for (let i = 0; i < 3; i++) {
      const tt = (M.time * 0.4 + i / 3) % 1;
      g.fillStyle = 'rgba(200,200,220,' + (0.25 * (1 - tt)).toFixed(2) + ')';
      g.beginPath(); g.arc(ch.x + Math.sin(tt * 4 + i) * 3, ch.y - 10 - tt * 22, 2 + tt * 4, 0, Math.PI * 2); g.fill();
    }
    // 灯（扉の上に並ぶ）
    const n = M.lampsMax || 5;
    for (let i = 0; i < n; i++) {
      const u = 0.25 + (2.5 * i) / Math.max(1, n - 1);
      const p = iso(3, u, 7.7);
      const on = i < (M.lamps == null ? n : M.lamps);
      const fl = on ? 0.8 + 0.2 * Math.sin(M.time * 9 + i * 1.7) : 0;
      g.strokeStyle = '#2a2020'; g.beginPath(); g.moveTo(p.x, p.y - 4); g.lineTo(p.x, p.y - 1); g.stroke();
      if (on) {
        const gl = g.createRadialGradient(p.x, p.y + 1, 0, p.x, p.y + 1, 9);
        gl.addColorStop(0, 'rgba(255,200,100,' + (0.55 * fl).toFixed(2) + ')'); gl.addColorStop(1, 'rgba(255,160,60,0)');
        g.fillStyle = gl; g.fillRect(p.x - 9, p.y - 8, 18, 18);
        g.fillStyle = '#ffd070'; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 4);
        g.fillStyle = '#fff2c0'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 2);
      } else {
        g.fillStyle = '#3a3036'; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 4);
      }
    }
  }

  // ---------------- 門 ----------------
  function drawGate(g, M) {
    const gs = M.gate || { hp: 1, max: 1, broken: false };
    const night = M.pal === 'night';
    const z0 = 3, z1 = 4.7;
    // 門の上の梁
    poly(g, [iso(11, 5, 5.0), iso(12, 5, 5.0), iso(12, 6, 5.0), iso(11, 6, 5.0)], night ? '#625f72' : '#a49c90');
    poly(g, [iso(12, 5, 5.0), iso(12, 6, 5.0), iso(12, 6, z1), iso(12, 5, z1)], night ? '#3e3c4c' : '#726a60');
    if (!gs.broken) {
      const dmg = 1 - gs.hp / gs.max;
      const wood = night ? '#6a4a2e' : '#8a6040';
      poly(g, [iso(12, 5.02, z1), iso(12, 5.98, z1), iso(12, 5.98, z0), iso(12, 5.02, z0)], wood);
      for (const u of [5.25, 5.5, 5.75]) line(g, iso(12, u, z1), iso(12, u, z0), night ? '#4a321e' : '#6a4a2e');
      for (const zz of [3.5, 4.2]) line(g, iso(12, 5.02, zz), iso(12, 5.98, zz), '#2e2a30');
      if (dmg > 0.35) { line(g, iso(12, 5.3, 4.4), iso(12, 5.6, 3.6), '#1a1010'); }
      if (dmg > 0.7) { line(g, iso(12, 5.6, 4.5), iso(12, 5.8, 3.4), '#1a1010'); line(g, iso(12, 5.2, 3.9), iso(12, 5.45, 3.2), '#1a1010'); }
      if (gs.hitT > 0) {
        g.save(); g.globalAlpha = 0.5;
        poly(g, [iso(12, 5.02, z1), iso(12, 5.98, z1), iso(12, 5.98, z0), iso(12, 5.02, z0)], '#ffe0a0');
        g.restore();
      }
    } else {
      // こわれた扉の板
      g.fillStyle = night ? '#5a3e26' : '#7a5636';
      const p1 = iso(12.3, 5.2, 3.05), p2 = iso(11.6, 5.75, 3.05);
      g.fillRect(Math.round(p1.x) - 5, Math.round(p1.y) - 1, 9, 2);
      g.fillRect(Math.round(p2.x) - 4, Math.round(p2.y) - 1, 7, 2);
    }
  }

  // ---------------- 松明・小物 ----------------
  const TORCHES = [[6.6, 10.4, 4], [10.4, 10.4, 4], [11.4, 3.6, 4], [11.4, 7.4, 4], [1.7, 6.8, 4], [7.4, 11.6, 2]];
  function drawTorch(g, M, x, y, z) {
    const p = iso(x, y, z);
    g.fillStyle = '#3a2a20'; g.fillRect(Math.round(p.x), Math.round(p.y) - 9, 1, 9);
    if (M.pal !== 'night') return;
    const f = Math.sin(M.time * 13 + x * 7) * 0.5 + 0.5;
    const gl = g.createRadialGradient(p.x, p.y - 11, 0, p.x, p.y - 11, 10);
    gl.addColorStop(0, 'rgba(255,170,70,0.45)'); gl.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = gl; g.fillRect(p.x - 10, p.y - 21, 20, 20);
    g.fillStyle = '#ff9a3a'; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 13 + Math.round(f), 3, 4 - Math.round(f));
    g.fillStyle = '#ffe9a0'; g.fillRect(Math.round(p.x), Math.round(p.y) - 12 + Math.round(f), 1, 2);
  }
  function drawCampfire(g, M) {
    const p = iso(9.5, 2.5, 3);
    g.fillStyle = '#3a2a22'; g.fillRect(Math.round(p.x) - 4, Math.round(p.y) - 1, 8, 2);
    if (M.pal === 'night' || M.morning) {
      const f = Math.sin(M.time * 11) * 0.5 + 0.5;
      g.fillStyle = '#ff8a30'; g.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 5 - Math.round(f), 5, 4 + Math.round(f));
      g.fillStyle = '#ffe08a'; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 4, 2, 3);
    }
    // 大鍋（朝）
    if (M.morning && M.night >= 2) {
      g.fillStyle = '#2a2a30'; g.fillRect(Math.round(p.x) - 4, Math.round(p.y) - 8, 9, 5);
      g.fillStyle = '#d8c890'; g.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 8, 7, 1);
      for (let i = 0; i < 2; i++) {
        const tt = (M.time * 0.6 + i * 0.5) % 1;
        g.fillStyle = 'rgba(255,255,255,' + (0.4 * (1 - tt)).toFixed(2) + ')';
        g.fillRect(Math.round(p.x) - 1 + i * 2, Math.round(p.y) - 10 - Math.round(tt * 10), 1, 2);
      }
    }
  }
  function drawProps(g, M) {
    // 井戸
    const w = iso(9.5, 7.5, 3);
    g.fillStyle = M.pal === 'night' ? '#4a4858' : '#8a8890';
    g.fillRect(Math.round(w.x) - 5, Math.round(w.y) - 5, 10, 5);
    g.fillStyle = '#1a1a24'; g.fillRect(Math.round(w.x) - 4, Math.round(w.y) - 5, 8, 2);
    g.fillStyle = '#5a4030'; g.fillRect(Math.round(w.x) - 5, Math.round(w.y) - 11, 1, 6); g.fillRect(Math.round(w.x) + 4, Math.round(w.y) - 11, 1, 6);
    g.fillRect(Math.round(w.x) - 5, Math.round(w.y) - 12, 10, 1);
  }

  // ---------------- 人物 ----------------
  function viewOf(face) {
    const sx = face[0] - face[1], sy = face[0] + face[1];
    return { view: sy >= -0.05 ? 'f' : 'b', mirror: sx < 0 };
  }
  R.viewOf = viewOf;

  function drawUnit(g, M, u) {
    const p = iso(u.x, u.y, u.z);
    const name = u.sprite;
    const sz = SP.size(name);
    const vm = u.face ? viewOf(u.face) : { view: 'f', mirror: false };
    let frame = 'idle';
    if (u.walking) frame = (Math.floor(M.time * 6 + u.phase) % 2) ? 'step' : 'idle';
    else if (Math.floor(M.time * 1.6 + u.phase) % 2) frame = 'idle2';
    if (u.fly) frame = (Math.floor(M.time * 7 + u.phase) % 2) ? 'step' : 'idle';
    let ox = 0, oy = 0;
    if (u.atk > 0) {
      const sx = u.face[0] - u.face[1], sy = (u.face[0] + u.face[1]) * 0.5;
      const k = Math.sin(Math.min(1, u.atk / 0.22) * Math.PI) * 2;
      ox = Math.round(sx * k); oy = Math.round(sy * k);
    }
    const bx = Math.round(p.x - sz.w / 2) + ox, by = Math.round(p.y - sz.h + 3) + oy - (u.lift || 0);
    // 空を飛ぶ敵は、真下の地面に影を落とす（どこを飛んでいるか分かるように）
    if (u.fly) {
      const gz = S.zAt(u.x, u.y);
      const q = iso(u.x, u.y, Math.max(0, gz));
      g.fillStyle = 'rgba(20,0,0,0.45)';
      g.beginPath(); g.ellipse(Math.round(q.x), Math.round(q.y), 5, 2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,80,60,0.55)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(Math.round(q.x) + 0.5, Math.round(q.y) + 0.5, 6, 3, 0, 0, Math.PI * 2); g.stroke();
    }
    // 影
    if (!u.noShadow) {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(Math.round(p.x), Math.round(p.y) + 1, Math.max(4, sz.w * 0.32), 2.2, 0, 0, Math.PI * 2); g.fill();
    }
    if (u.ring) {
      g.strokeStyle = u.ring; g.lineWidth = 1;
      g.globalAlpha = u.ringAlpha == null ? 0.9 : u.ringAlpha;
      g.beginPath(); g.ellipse(Math.round(p.x) + 0.5, Math.round(p.y) + 1.5, 7, 3.5, 0, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
    }
    if (u.down) {
      // 倒れた：横たわる
      const c = SP.get(name, 'f', 'idle', vm.mirror);
      g.save();
      g.globalAlpha = 0.85;
      g.translate(Math.round(p.x), Math.round(p.y) - 2);
      g.rotate(vm.mirror ? -Math.PI / 2 : Math.PI / 2);
      g.filter = 'grayscale(0.7) brightness(0.8)';
      g.drawImage(c, -c.width / 2, -c.height / 2);
      g.restore();
      return { x: p.x, y: by };
    }
    if (u.alpha != null) g.globalAlpha = u.alpha;
    const c = SP.get(name, vm.view, frame, vm.mirror);
    g.drawImage(c, bx, by);
    if (u.white > 0) {
      g.globalAlpha = Math.min(0.75, u.white * 6) * (u.alpha == null ? 1 : u.alpha);
      g.drawImage(SP.get(name, vm.view, frame, vm.mirror, 'white'), bx, by);
    }
    g.globalAlpha = 1;
    u._sx = p.x; u._top = by; u._bx = bx; u._by = by; u._view = vm; u._frame = frame;
    return { x: p.x, y: by };
  }
  R.drawUnit = drawUnit;

  // ---------------- 世界の描画 ----------------
  // M: { pal, time, units:[...], gate, lamps, lampsMax, melt, overlay(g) , fxWorld(g) }
  R.drawWorld = function (g, M) {
    const P = PAL[M.pal];
    g.save();
    if (M.shake > 0) g.translate(Math.round((Math.random() - 0.5) * M.shake * 3), Math.round((Math.random() - 0.5) * M.shake * 3));
    drawSky(g, M, P);
    // 盤の下の影
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    const c0 = iso(0, 0, BASE_Z - 0.4), c1 = iso(D.W, 0, BASE_Z - 0.4), c2 = iso(D.W, D.H, BASE_Z - 0.4), c3 = iso(0, D.H, BASE_Z - 0.4);
    g.moveTo(c0.x, c0.y + 6); g.lineTo(c1.x + 4, c1.y + 6); g.lineTo(c2.x, c2.y + 8); g.lineTo(c3.x - 4, c3.y + 6); g.closePath(); g.fill();

    const items = [];
    for (const t of tileCache[M.pal]) items.push({ d: t.depth, k: 0, t });
    items.push({ d: 4.6, k: 1, f: drawKeep });
    items.push({ d: 17.2, k: 1, f: drawGate });
    items.push({ d: 12.6, k: 1, f: drawCampfire });
    items.push({ d: 17.4, k: 1, f: drawProps });
    for (const tc of TORCHES) items.push({ d: tc[0] + tc[1] + 0.05, k: 1, f: (gg, MM) => drawTorch(gg, MM, tc[0], tc[1], tc[2]) });
    for (const u of M.units) items.push({ d: u.x + u.y + 0.02 + (u.depthBias || 0), k: 2, u });
    if (M.extraItems) for (const it of M.extraItems) items.push(it);
    items.sort((a, b) => a.d - b.d || a.k - b.k);
    for (const it of items) {
      if (it.k === 0) g.drawImage(it.t.c, it.t.ox, it.t.oy);
      else if (it.k === 1) it.f(g, M);
      else if (it.k === 2) drawUnit(g, M, it.u);
      else if (it.k === 3) it.f(g, M, it.u);
    }
    // 壁ごしの輪郭（隠れた人物も見える）
    g.globalAlpha = 0.6;
    for (const u of M.units) {
      if (u.down || !u._view || u.noGhost || u.alpha != null) continue;
      if (!occluded(u)) continue;
      const c = SP.get(u.sprite, u._view.view, u._frame, u._view.mirror, 'ghost');
      g.drawImage(c, u._bx, u._by);
    }
    g.globalAlpha = 1;
    if (M.fxWorld) M.fxWorld(g, M);
    if (M.overlay) M.overlay(g, M);
    g.restore();
  };

  function occluded(u) {
    const sx = u.x - u.y, d = u.x + u.y;
    for (let ty = Math.floor(u.y) - 1; ty <= Math.floor(u.y) + 3; ty++) for (let tx = Math.floor(u.x) - 1; tx <= Math.floor(u.x) + 3; tx++) {
      const t = S.tile(tx, ty);
      if (!t || t.k === 'v') continue;
      if (tx + ty + 1 <= d + 0.3) continue;
      if (Math.abs((tx - ty) - sx) > 1.1) continue;
      if (t.h <= u.z + 1.0) continue;
      return true;
    }
    return false;
  }
  R.occluded = occluded;

  // 画面の点 → 指している持ち場（高さを考えて、手前の旗を優先）
  R.slotAt = function (lx, ly, ids) {
    let best = null, bd = 1e9;
    for (const sl of D.SLOTS) {
      if (ids && ids.indexOf(sl.id) < 0) continue;
      const s = S.slots[sl.id];
      const p = iso(s.wx, s.wy, s.wz);
      // 立ち姿（足もとから上へ 20 画素）と足もとの菱形を当たりにする
      const dx = lx - p.x, dy = ly - (p.y - 7);
      const inBody = Math.abs(dx) <= 9 && dy >= -13 && dy <= 9;
      const inTile = Math.abs(lx - p.x) / 16 + Math.abs(ly - p.y) / 8 <= 1.05;
      if (!inBody && !inTile) continue;
      const dist = Math.hypot(dx, dy * 1.2) - (s.wx + s.wy) * 0.05;
      if (dist < bd) { bd = dist; best = sl.id; }
    }
    return best;
  };

  R.hash = hash;
  R.poly = poly;
  R.line = line;
  root.K20R = R;
})(window);
