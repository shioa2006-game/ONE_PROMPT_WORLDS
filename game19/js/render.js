// せーの、星見の露台へ — クォータービューの描画（低解像度 640x360 に描いて2倍に拡大）
(function (root) {
  'use strict';
  const S = root.S19;
  const LW = 640, LH = 360;
  const R = { LW, LH, rot: 0, cam: { x: 0, y: 0 }, time: 0, fx: [], hi: {}, fade: {}, focus: null };

  // ---------- 回転と投影 ----------
  function dims(st) { return R.rot % 2 === 0 ? [st.W, st.H] : [st.H, st.W]; }
  function rotXY(st, x, y) {
    const W = st.W, H = st.H;
    switch (R.rot) {
      case 0: return [x, y];
      case 1: return [H - 1 - y, x];
      case 2: return [W - 1 - x, H - 1 - y];
      default: return [y, W - 1 - x];
    }
  }
  function unrot(st, u, v) {
    const W = st.W, H = st.H;
    switch (R.rot) {
      case 0: return [u, v];
      case 1: return [v, H - 1 - u];
      case 2: return [W - 1 - u, H - 1 - v];
      default: return [W - 1 - v, u];
    }
  }
  // 世界の向き(0..3) → 画面の向き(0=右下,1=左下,2=左上,3=右上)
  function sdir(wdir) {
    const [dx, dy] = S.DIRS[wdir];
    let du, dv;
    switch (R.rot) {
      case 0: du = dx; dv = dy; break;
      case 1: du = -dy; dv = dx; break;
      case 2: du = -dx; dv = -dy; break;
      default: du = dy; dv = -dx; break;
    }
    if (du > 0) return 0; if (dv > 0) return 1; if (du < 0) return 2; return 3;
  }
  // 画面の向き → 世界の向き
  function wdirOf(sd) {
    for (let d = 0; d < 4; d++) if (sdir(d) === sd) return d;
    return 0;
  }
  function rawProj(st, x, y, z) {
    const [u, v] = rotXY(st, x, y);
    return [(u - v) * 16, (u + v) * 8 - z * 8];
  }
  function proj(st, x, y, z) {
    const [a, b] = rawProj(st, x, y, z);
    return [Math.round(a + LW / 2 - R.cam.x), Math.round(b + LH / 2 - R.cam.y)];
  }
  function projF(st, x, y, z) {
    const [a, b] = rawProj(st, x, y, z);
    return [a + LW / 2 - R.cam.x, b + LH / 2 - R.cam.y];
  }

  // ---------- 色 ----------
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  const TOP = {
    r: hex('#24384c'), f: hex('#5e6684'), g: hex('#4f7a46'), d: hex('#7a6248'), p: hex('#8a6440'), m: hex('#a8a4b8'),
    x: hex('#3c3a4c'), i: hex('#a6dcf2'), c: hex('#8a6440'), w: hex('#24384c'), k: hex('#46465a'), s: hex('#8c7a5c'), r: hex('#6a5a5a'),
  };
  const FACE = {
    r: hex('#2c3448'), f: hex('#454a62'), g: hex('#454a62'), d: hex('#5c4836'), p: hex('#5c4836'), m: hex('#7c788e'),
    x: hex('#4a3c46'), i: hex('#454a62'), c: hex('#454a62'), w: hex('#2c3448'), k: hex('#383848'), s: hex('#5c4e3a'), r: hex('#4e4040'),
  };
  function hash(a, b, c, d) {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647 + d * 1274126177) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function clampC(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

  // ---------- 柱の焼きこみ（キャッシュ） ----------
  const cache = new Map();
  let BASE = -2;
  function terrainTop(st, i) {
    const t = st.t[i];
    if (t === 'v') return null;
    if (t === 'w' || t === 'r') return st.h[i] - 1; // 水底
    return st.h[i];
  }
  function nbTop(st, x, y) {
    if (!S.inside(st, x, y)) return BASE;
    const v = terrainTop(st, S.idx(st, x, y));
    return v === null ? BASE : v;
  }
  function frontNbs(st, x, y) {
    const [u, v] = rotXY(st, x, y);
    const [Wr, Hr] = dims(st);
    const l = v + 1 < Hr ? unrot(st, u, v + 1) : null; // 左下の面のとなり
    const r = u + 1 < Wr ? unrot(st, u + 1, v) : null; // 右下の面のとなり
    return [l, r];
  }
  function columnCanvas(st, x, y) {
    const i = S.idx(st, x, y);
    const top = terrainTop(st, i);
    if (top === null) return null;
    const [l, r] = frontNbs(st, x, y);
    const zl = l ? nbTop(st, l[0], l[1]) : BASE;
    const zr = r ? nbTop(st, r[0], r[1]) : BASE;
    const dl = Math.max(0, top - zl), dr = Math.max(0, top - zr);
    const t = st.t[i];
    const key = st.W + 'x' + x + ',' + y + '|' + R.rot + '|' + top + '|' + t + '|' + dl + '|' + dr + '|' + (st.by[i] || '');
    let c = cache.get(i);
    if (c && c.key === key) return c;
    c = { key, cv: buildColumn(x, y, top, t, dl, dr, st.by[i]), top, dl, dr };
    cache.set(i, c);
    return c;
  }
  function buildColumn(x, y, top, t, dl, dr, by) {
    const H = 16 + Math.max(dl, dr) * 8 + 1;
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(32, H);
    const D = img.data;
    const put = (px, py, r, g, b) => { if (px < 0 || py < 0 || px >= 32 || py >= H) return; const o = (py * 32 + px) * 4; D[o] = clampC(r); D[o + 1] = clampC(g); D[o + 2] = clampC(b); D[o + 3] = 255; };
    const lift = (top - BASE) * 2.2;
    const tc = TOP[t] || TOP.f;
    // 上面
    for (let row = 0; row < 16; row++) {
      const half = row < 8 ? 2 * row + 1 : 31 - 2 * row;
      for (let px = 16 - half; px < 16 + half; px++) {
        let [rr, gg, bb] = tc;
        const n = (hash(x, y, px, row) - 0.5) * 10;
        rr += n + lift; gg += n + lift; bb += n + lift;
        const edgeL = px === 16 - half || px === 16 - half + 1, edgeR = px === 16 + half - 1 || px === 16 + half - 2;
        if ((edgeL || edgeR) && row < 8) { rr += 22; gg += 22; bb += 24; }
        if ((edgeL || edgeR) && row >= 8) { rr -= 16; gg -= 16; bb -= 14; }
        if (t === 'g' && hash(px, row, x, y + 7) > 0.8) { rr += 18; gg += 28; bb += 6; }
        if (t === 'g' && hash(px, row, x + 3, y) < 0.12) { rr -= 14; gg -= 6; bb -= 8; }
        if (t === 'd' && hash(px, row, x, y + 3) > 0.86) { rr -= 22; gg -= 20; bb -= 16; }
        if ((t === 'p' || t === 'c') && ((px + row * 2) % 8 === 0)) { rr -= 26; gg -= 22; bb -= 18; }
        if (t === 'c' && (px + row * 2) % 8 === 4 && row > 3 && row < 12) { rr += 12; gg += 8; }
        if (t === 'm' && Math.abs(((px - row * 2) % 11)) === 0 && hash(px, row, x, y) > 0.4) { rr -= 18; gg -= 18; bb -= 12; }
        if (t === 'i') {
          if (Math.abs((px * 3 + row * 5 + x * 7 + y * 3) % 17) === 0) { rr += 30; gg += 25; bb += 10; }
          if (hash(px, row, x, y) > 0.94) { rr = 250; gg = 255; bb = 255; }
        }
        if (t === 'x' && hash(px, row, x, y) > 0.7) { rr -= 10; gg -= 10; bb -= 8; }
        if (t === 'f' && ((px + row * 2 + 4) % 16 === 0 || (px - row * 2 + 4 + 64) % 16 === 0)) { rr -= 8; gg -= 8; bb -= 6; }
        put(px, row, rr, gg, bb);
      }
    }
    // 側面
    const fc = FACE[t] || FACE.f;
    const face = (side, drop) => {
      const n = drop * 8;
      for (let p = 0; p < 16; p++) {
        const px = side === 'L' ? p : 31 - p;
        const q = p;
        const ft = Math.floor((q + 15) / 2) + 1;
        for (let r = 0; r < n; r++) {
          const py = ft + r;
          const band = Math.floor(r / 8);
          const zlev = top - 1 - band;
          let k = side === 'L' ? 1.0 : 0.72;
          let [rr, gg, bb] = fc;
          if (t === 'i' && band === 0) { rr = 120; gg = 176; bb = 206; }
          if (t === 'g' && r < 2 + ((p * 7 + x) % 3 === 0 ? 1 : 0)) { rr = 70; gg = 112; bb = 60; }
          rr *= k; gg *= k; bb *= k;
          const par = (zlev & 1) ? 6 : -2;
          rr += par; gg += par; bb += par;
          const nz = (hash(x * 3 + p, y, r, side === 'L' ? 1 : 2) - 0.5) * 9;
          rr += nz; gg += nz; bb += nz;
          // 段の境目（目地）
          if (r % 8 === 7) { rr -= 22; gg -= 22; bb -= 20; }
          // 石積みの縦目地
          const bx = (p + (band & 1) * 4) % 8;
          if (bx === 0 && r % 8 < 7 && t !== 'i') { rr -= 12; gg -= 12; bb -= 10; }
          // 上のふち
          if (r === 0) { rr += 14; gg += 14; bb += 16; }
          // 外側の線
          if (p === 0) { rr -= 18; gg -= 18; bb -= 16; }
          put(px, py, rr, gg, bb);
        }
      }
    };
    if (dl > 0) face('L', dl);
    if (dr > 0) face('R', dr);
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  function resetCache(st) {
    cache.clear();
    BASE = 99;
    for (let i = 0; i < st.W * st.H; i++) { const v = terrainTop(st, i); if (v !== null && v < BASE) BASE = v; }
    BASE = (BASE === 99 ? 0 : BASE) - 2;
    if (st.base !== undefined) BASE = st.base;
  }

  // ---------- 小さな図形 ----------
  function diamond(ctx, cx, cy, A, color) {
    // 半幅 A、半高 A/2 の菱形（cy は中心）
    ctx.fillStyle = color;
    const hh = A / 2;
    for (let i = 0; i < A; i++) {
      const dy = i - hh;
      const half = Math.max(0, A - 2 * Math.abs(dy + 0.5)) | 0;
      if (half > 0) ctx.fillRect(cx - half, cy + dy, half * 2, 1);
    }
  }
  function diamondLine(ctx, cx, cy, A, color) {
    ctx.fillStyle = color;
    const hh = A / 2;
    for (let i = 0; i < A; i++) {
      const dy = i - hh;
      const half = Math.max(0, A - 2 * Math.abs(dy + 0.5)) | 0;
      if (half > 0) { ctx.fillRect(cx - half, cy + dy, 2, 1); ctx.fillRect(cx + half - 2, cy + dy, 2, 1); }
    }
  }
  function box(ctx, cx, by, A, ht, cT, cL, cR) {
    // 底の中心(cx,by)、上面までの高さ ht
    const hh = A / 2;
    ctx.fillStyle = cL;
    for (let p = 0; p < A; p++) { const ye = by + Math.floor(p / 2); ctx.fillRect(cx - A + p, ye - ht, 1, ht + 1); }
    ctx.fillStyle = cR;
    for (let p = 0; p < A; p++) { const ye = by + Math.floor(p / 2); ctx.fillRect(cx + A - 1 - p, ye - ht, 1, ht + 1); }
    diamond(ctx, cx, by - ht, A, cT);
    return hh;
  }

  // ---------- 背景 ----------
  function drawBackdrop(ctx, sec, t) {
    const bg = (sec && sec.bg) || {};
    const g = ctx.createLinearGradient(0, 0, 0, LH);
    g.addColorStop(0, bg.top || '#0b0a1c');
    g.addColorStop(0.6, bg.mid || '#14122a');
    g.addColorStop(1, bg.bot || '#07060f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH);
    const px = -R.cam.x * 0.06, py = -R.cam.y * 0.04;
    // 遠い光の粒（星のような水晶）
    for (let k = 0; k < 70; k++) {
      const x = ((hash(k, 1, 2, 3) * 900 + px) % 700 + 700) % 700 - 30;
      const y = (hash(k, 5, 6, 7) * 220 + py) | 0;
      const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + hash(k, 9, 9, 9) * 1.5) + k);
      const lit = R.starsLit || 0;
      const a = 0.12 + tw * 0.25 + lit * 0.5;
      ctx.fillStyle = `rgba(${150 + lit * 100 | 0},${190 + lit * 60 | 0},255,${a})`;
      ctx.fillRect(x | 0, y, 1, 1);
      if (lit > 0.3 && k % 3 === 0) ctx.fillRect((x | 0) - 1, y, 3, 1);
    }
    // 遠景の岩の稜線
    ctx.fillStyle = bg.ridge || '#100e22';
    for (let x = 0; x < LW; x += 2) {
      const h = 40 + Math.sin((x - px * 2) * 0.013) * 18 + Math.sin((x - px * 2) * 0.041) * 9 + hash(x >> 3, 1, 1, 1) * 6;
      ctx.fillRect(x, LH - h - 40 + py * 0.5, 2, h + 60);
    }
    // 目的地（遠くの露台と灯籠）
    if (bg.goal) {
      const gx = (bg.goal[0] + px * 1.4) | 0, gy = (bg.goal[1] + py) | 0;
      // 遠くの岩の台と、その上の露台（小さく、かすかに）
      ctx.fillStyle = '#15132a';
      for (let k = -26; k <= 26; k++) {
        const w = Math.abs(k);
        const top = gy + 3 + (w > 14 ? (w - 14) * 3 : 0) + ((hash(k + 40, 3, 1, 1) * 2) | 0);
        ctx.fillRect(gx + k, top, 1, 46 - Math.min(40, w));
      }
      ctx.fillStyle = '#211f3a';
      ctx.fillRect(gx - 12, gy + 2, 24, 1);
      ctx.fillStyle = '#26243f';
      ctx.fillRect(gx - 1, gy - 6, 3, 7);
      ctx.fillRect(gx - 3, gy - 8, 7, 2);
      const lit = R.goalLit || 0;
      const fl = 0.6 + 0.4 * Math.sin(t * 3);
      if (lit > 0) {
        const rg = ctx.createRadialGradient(gx, gy - 6, 0, gx, gy - 6, 60 * lit);
        rg.addColorStop(0, `rgba(255,210,120,${0.7 * lit})`); rg.addColorStop(1, 'rgba(255,160,60,0)');
        ctx.fillStyle = rg; ctx.fillRect(gx - 70, gy - 80, 140, 140);
        ctx.fillStyle = '#fff0b0'; ctx.fillRect(gx - 1, gy - 7, 2, 2);
      } else {
        ctx.fillStyle = `rgba(150,170,220,${0.25 + 0.15 * fl})`; ctx.fillRect(gx - 1, gy - 7, 2, 2);
      }
    }
    // 霧
    const fog = ctx.createLinearGradient(0, LH * 0.55, 0, LH);
    fog.addColorStop(0, 'rgba(40,40,80,0)'); fog.addColorStop(1, 'rgba(30,26,60,0.55)');
    ctx.fillStyle = fog; ctx.fillRect(0, 0, LW, LH);
  }

  // ---------- 物の絵 ----------
  const OBJ_RECT = { crate: [-12, -16, 24, 20], block: [-14, -16, 28, 20], iceblock: [-14, -16, 28, 20], boulder: [-9, -16, 18, 18], pillar: [-11, -30, 22, 34],
    anchor: [-12, -26, 10, 26], target: [-7, -21, 16, 22], lantern: [-9, -30, 18, 32] };
  function drawObj(ctx, st, o, t, disp, noRect) {
    const pos = disp || o;
    let z = pos.z;
    const [sx, sy] = proj(st, pos.x, pos.y, z);
    const rr = OBJ_RECT[o.k];
    if (rr && !noRect && !o.hidden && !(o.k === 'chest' && o.open) && !(o.k === 'target' && o.hit)) R.objRects.push({ id: o.id, x: sx + rr[0], y: sy + rr[1], w: rr[2], h: rr[3] });
    const sel = R.hi.objs && R.hi.objs[o.id];
    if (o.hidden) return;
    switch (o.k) {
      case 'crate': {
        box(ctx, sx, sy, 12, 8, '#b98a52', '#8e6338', '#6a4626');
        ctx.fillStyle = '#5a3a1e';
        ctx.fillRect(sx - 6, sy - 10, 12, 1); ctx.fillRect(sx - 1, sy - 14, 2, 8);
        ctx.fillStyle = '#d8ac6c'; ctx.fillRect(sx - 2, sy - 15, 4, 1);
        if (sel) diamondLine(ctx, sx, sy - 8, 12, sel);
        break;
      }
      case 'block': {
        box(ctx, sx, sy, 14, 8, '#9a98aa', '#727086', '#545266');
        ctx.fillStyle = '#c4c2d2'; ctx.fillRect(sx - 3, sy - 9, 6, 1);
        if (sel) diamondLine(ctx, sx, sy - 8, 14, sel);
        break;
      }
      case 'iceblock': {
        ctx.globalAlpha = 0.92;
        box(ctx, sx, sy, 14, 8, '#c6f0ff', '#7cc8ec', '#5aa2d0');
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 6, sy - 9, 3, 1); ctx.fillRect(sx + 3, sy - 6, 1, 3);
        if (sel) diamondLine(ctx, sx, sy - 8, 14, sel);
        break;
      }
      case 'beam': {
        box(ctx, sx, sy, 15, 8, '#a6a2b4', '#7a768c', '#5a566c');
        ctx.fillStyle = '#6a667c'; ctx.fillRect(sx - 1, sy - 15, 2, 6);
        break;
      }
      case 'boulder': {
        const cy = sy - 7;
        const ang = (disp && disp.roll) || 0;
        ctx.fillStyle = '#4a4656'; circle(ctx, sx, cy + 1, 8);
        ctx.fillStyle = '#76707e'; circle(ctx, sx, cy, 7.5);
        ctx.fillStyle = '#9a94a2'; circle(ctx, sx - 2, cy - 2, 4.5);
        ctx.fillStyle = '#4e4a5a';
        for (let k = 0; k < 3; k++) { const a = ang + k * 2.1; ctx.fillRect((sx + Math.cos(a) * 4) | 0, (cy + Math.sin(a) * 3) | 0, 2, 2); }
        if (sel) { ctx.strokeStyle = sel; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx + 0.5, cy + 0.5, 9, 0, 6.3); ctx.stroke(); }
        break;
      }
      case 'pillar': {
        box(ctx, sx, sy, 11, 24, '#b6b2c4', '#8a869c', '#66627a');
        ctx.fillStyle = '#5e5a70';
        for (let k = 1; k < 3; k++) ctx.fillRect(sx - 11, sy - 8 * k, 22, 1);
        ctx.fillStyle = '#d0ccdc'; ctx.fillRect(sx - 4, sy - 25, 8, 1);
        if (sel) diamondLine(ctx, sx, sy - 24, 11, sel);
        break;
      }
      case 'anchor': {
        const ax = sx - 7, ay = sy - 3;
        box(ctx, ax, ay, 3, 16, '#8a6240', '#6a4a2e', '#4c321e');
        const ry = ay - 19;
        ctx.strokeStyle = '#c8ccd8'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ax + 0.5, ry + 0.5, 3, 0, 6.3); ctx.stroke();
        const gl = 0.5 + 0.5 * Math.sin(t * 4 + o.x);
        ctx.fillStyle = `rgba(255,255,255,${0.4 + gl * 0.6})`; ctx.fillRect(ax + 2, ry - 2, 1, 1);
        if (sel) { ctx.strokeStyle = sel; ctx.beginPath(); ctx.arc(ax + 0.5, ry + 0.5, 6, 0, 6.3); ctx.stroke(); }
        break;
      }
      case 'target': {
        const cy = sy - 14;
        ctx.fillStyle = '#5a4030'; ctx.fillRect(sx, sy - 8, 2, 8);
        if (o.hit) {
          ctx.fillStyle = '#6a6070'; ellipse(ctx, sx + 1, cy + 4, 6, 2);
          ctx.fillStyle = '#c8b090'; ctx.fillRect(sx - 2, cy + 1, 6, 1);
        } else {
          ctx.fillStyle = '#f0ece0'; circle(ctx, sx + 1, cy, 6);
          ctx.fillStyle = '#d0342c'; circle(ctx, sx + 1, cy, 4.5);
          ctx.fillStyle = '#f0ece0'; circle(ctx, sx + 1, cy, 2.8);
          ctx.fillStyle = '#d0342c'; circle(ctx, sx + 1, cy, 1.4);
          if (sel) { ctx.strokeStyle = sel; ctx.beginPath(); ctx.arc(sx + 1.5, cy + 0.5, 8, 0, 6.3); ctx.stroke(); }
        }
        break;
      }
      case 'door': {
        const lift = disp && disp.lift !== undefined ? disp.lift : (o.open ? 22 : 0);
        if (lift >= 22) { break; }
        ctx.globalAlpha = 1;
        const ht = 22 - lift;
        box(ctx, sx, sy - lift, 15, ht > 2 ? ht : 2, '#4a4458', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)');
        ctx.fillStyle = '#2a2632';
        for (let k = -12; k <= 12; k += 4) {
          const yb = sy - lift + Math.floor(Math.abs(k) / 2) * 0 + (k < 0 ? Math.floor((k + 15) / 2) - 7 : Math.floor((15 - k) / 2) - 7);
          ctx.fillRect(sx + k, yb - ht, 2, ht);
        }
        ctx.fillStyle = '#6c6680';
        ctx.fillRect(sx - 14, sy - lift - ht - 1, 28, 2);
        break;
      }
      case 'chest': {
        const page = o.item && o.item.indexOf('page') === 0;
        if (page) {
          ctx.fillStyle = '#5a4a3a'; ctx.fillRect(sx - 1, sy - 6, 2, 6);
          if (!o.open) {
            const b = Math.sin(t * 3 + o.x) * 1.5;
            const gy = (sy - 13 + b) | 0;
            const rg = ctx.createRadialGradient(sx, gy, 0, sx, gy, 12);
            rg.addColorStop(0, 'rgba(255,240,180,0.55)'); rg.addColorStop(1, 'rgba(255,220,120,0)');
            ctx.fillStyle = rg; ctx.fillRect(sx - 12, gy - 12, 24, 24);
            ctx.fillStyle = '#f4ead2'; ctx.fillRect(sx - 4, gy - 3, 8, 6);
            ctx.fillStyle = '#c8b48c'; ctx.fillRect(sx - 4, gy - 3, 8, 1); ctx.fillRect(sx - 4, gy + 2, 8, 1);
            ctx.fillStyle = '#8a6a4a'; ctx.fillRect(sx - 2, gy - 1, 4, 1); ctx.fillRect(sx - 2, gy + 1, 3, 1);
          }
          break;
        }
        box(ctx, sx, sy, 9, 6, o.open ? '#3a2416' : '#b0602e', '#8a4622', '#663218');
        ctx.fillStyle = '#f0c048'; ctx.fillRect(sx - 1, sy - 6, 2, 3);
        if (o.open) {
          ctx.fillStyle = '#c86e34'; ctx.fillRect(sx - 8, sy - 14, 16, 3);
        } else {
          const gl = 0.5 + 0.5 * Math.sin(t * 3 + o.y);
          ctx.fillStyle = `rgba(255,240,160,${gl})`; ctx.fillRect(sx + 4, sy - 12, 1, 1); ctx.fillRect(sx + 3, sy - 11, 3, 1); ctx.fillRect(sx + 4, sy - 10, 1, 1);
        }
        break;
      }
      case 'plate': {
        diamond(ctx, sx, sy, 10, o.done ? '#7ae0ff' : '#6a6a80');
        diamondLine(ctx, sx, sy, 10, o.done ? '#d0f8ff' : '#3a3a4c');
        break;
      }
      case 'exit': {
        const gl = 0.6 + 0.4 * Math.sin(t * 2);
        const rg = ctx.createRadialGradient(sx, sy - 10, 0, sx, sy - 10, 22);
        rg.addColorStop(0, `rgba(255,220,150,${0.35 * gl})`); rg.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = rg; ctx.fillRect(sx - 24, sy - 34, 48, 48);
        ctx.fillStyle = '#2a2232';
        ctx.fillRect(sx - 9, sy - 24, 3, 22); ctx.fillRect(sx + 7, sy - 24, 3, 22); ctx.fillRect(sx - 9, sy - 27, 19, 4);
        ctx.fillStyle = '#6a5a70'; ctx.fillRect(sx - 9, sy - 28, 19, 1);
        ctx.fillStyle = `rgba(255,214,140,${0.25 + 0.2 * gl})`; ctx.fillRect(sx - 6, sy - 23, 13, 20);
        diamond(ctx, sx, sy, 8, `rgba(255,220,140,${0.35 * gl})`);
        break;
      }
      case 'torch': {
        const fz = o.fz || 2;
        const [tx, ty] = proj(st, o.x, o.y, z + fz);
        ctx.fillStyle = '#4a3a2a'; ctx.fillRect(tx - 1, ty - 1, 3, 5);
        const f = Math.sin(t * 13 + o.x * 3) * 0.6 + Math.sin(t * 7.3 + o.y) * 0.4;
        ctx.fillStyle = '#ff8a30'; ctx.fillRect(tx - 1, ty - 5 - (f > 0 ? 1 : 0), 3, 4);
        ctx.fillStyle = '#ffe08a'; ctx.fillRect(tx, ty - 4, 1, 2);
        break;
      }
      case 'lantern': {
        box(ctx, sx, sy, 8, 6, '#8a8494', '#666072', '#4c4658');
        box(ctx, sx, sy - 6, 4, 8, '#7a7486', '#5c566a', '#443e52');
        box(ctx, sx, sy - 14, 8, 8, o.lit ? '#fff0b0' : '#3a3648', o.lit ? '#ffc860' : '#2c2838', o.lit ? '#e09838' : '#221e2c');
        box(ctx, sx, sy - 22, 10, 2, '#8a8494', '#666072', '#4c4658');
        ctx.fillStyle = '#8a8494'; ctx.fillRect(sx - 1, sy - 28, 2, 4);
        if (o.lit) { ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 1, sy - 20, 2, 3); }
        break;
      }
      case 'bridge': break;
      case 'statue': {
        box(ctx, sx, sy, 10, 4, '#7a7688', '#5a566a', '#423e50');
        ctx.fillStyle = '#6a667a'; ctx.fillRect(sx - 4, sy - 16, 8, 12);
        ctx.fillStyle = '#8a869a'; ctx.fillRect(sx - 3, sy - 20, 6, 5);
        break;
      }
    }
  }
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); }
  function ellipse(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.3); ctx.fill(); }

  // 跳ね橋の板（升ごと）
  function drawBridgeCell(ctx, st, o, x, y, prog) {
    if (R.bridgeProg && R.bridgeProg[o.id] !== undefined) prog = R.bridgeProg[o.id];
    const [sx, sy] = proj(st, x, y, o.z + (1 - prog) * 4);
    if (prog > 0) {
      ctx.globalAlpha = Math.min(1, prog * 2);
      box(ctx, sx, sy + 3, 16, 3, '#9a7048', '#6e4c2e', '#523820');
      ctx.fillStyle = '#5a3c22';
      for (let k = -12; k <= 12; k += 6) ctx.fillRect(sx + k, sy - 1 + Math.floor(Math.abs(k) / 4) - 3, 1, 4);
      ctx.globalAlpha = 1;
    }
  }

  // 上がっている跳ね橋（ちょうつがいの升に、板が立っている）
  function drawRaisedBridge(ctx, st, o, x, y) {
    const [sx, sy] = proj(st, x, y, o.z);
    const h = o.cells.length * 8 + 4;
    ctx.fillStyle = '#5a3c22'; ctx.fillRect(sx - 9, sy - h - 2, 18, h + 2);
    ctx.fillStyle = '#8e6440'; ctx.fillRect(sx - 8, sy - h - 1, 16, h);
    ctx.fillStyle = '#6a4a2c';
    for (let k = -6; k <= 6; k += 4) ctx.fillRect(sx + k, sy - h, 1, h - 1);
    ctx.fillStyle = '#b8b0a0'; ctx.fillRect(sx - 10, sy - h - 3, 1, h + 4); ctx.fillRect(sx + 9, sy - h - 3, 1, h + 4);
    // 指せるように（「跳ね橋」と名前を出す）
    if (R.objRects) R.objRects.push({ id: o.id, x: sx - 11, y: sy - h - 4, w: 22, h: h + 6 });
  }

  // 滝
  function drawFall(ctx, st, o, t) {
    const [x0, y0] = proj(st, o.x, o.y, st.h[S.idx(st, o.x, o.y)]);
    const [x1, y1] = proj(st, o.bx, o.by, o.bz);
    const mx = ((x0 + x1) / 2) | 0;
    const top = Math.min(y0 + 4, y1), bot = y1;
    const w = 8 + (o.strong === true ? 2 : (o.strong || 0)) * 3;
    if (o.frozen) {
      ctx.fillStyle = 'rgba(170,225,250,0.92)'; ctx.fillRect(mx - w, top, w * 2, bot - top);
      ctx.fillStyle = '#e8fbff';
      for (let k = -w + 2; k < w; k += 4) ctx.fillRect(mx + k, top + 2, 1, bot - top - 4);
      ctx.fillStyle = '#7cc0e4';
      for (let yy = top + 4; yy < bot; yy += 8) ctx.fillRect(mx - w, yy, w * 2, 1);
      return;
    }
    for (let k = -w; k < w; k++) {
      for (let yy = top; yy < bot; yy++) {
        const v = (yy - t * 90 + hash(k + 50, 0, 0, 0) * 40) % 12;
        const a = v < 0 ? v + 12 : v;
        ctx.fillStyle = a < 2 ? 'rgba(230,248,255,0.85)' : a < 6 ? 'rgba(110,170,230,0.7)' : 'rgba(80,130,200,0.55)';
        ctx.fillRect(mx + k, yy, 1, 1);
      }
    }
    ctx.fillStyle = 'rgba(240,250,255,0.6)';
    for (let k = 0; k < 6; k++) { const a = t * 5 + k * 1.3; ctx.fillRect(mx + Math.cos(a) * (w + 2) | 0, bot - 2 + Math.sin(a * 1.7) * 2 | 0, 2, 1); }
  }

  // ---------- 主人公・敵 ----------
  function drawUnit(ctx, st, u, d, t) {
    // d: {x,y,z, pose, flash, sd}
    const [sx, sy] = proj(st, d.x, d.y, d.z);
    const SP = root.SPR19;
    const sd = d.sd !== undefined ? d.sd : sdir(u.face);
    let pose = d.pose || 'idle';
    if (u.ko && u.team === 'h') pose = 'idle';
    const fr = SP.frame(u.k, sd, pose, false);
    if (!fr) return;
    // 影
    if (!(u.k === 'bat' && !u.frozen)) { ctx.fillStyle = 'rgba(8,6,18,0.45)'; ellipse(ctx, sx, sy + 1, 7, 3); }
    else { ctx.fillStyle = 'rgba(8,6,18,0.3)'; ellipse(ctx, sx, (proj(st, d.x, d.y, d.gz !== undefined ? d.gz : d.z)[1]) + 1, 5, 2); }
    // 選択の輪
    if (d.ring) {
      const a = 0.6 + 0.4 * Math.sin(t * 5);
      ctx.globalAlpha = a; diamondLine(ctx, sx, sy, 12, d.ring); ctx.globalAlpha = 1;
    }
    let bob = 0;
    if (pose === 'idle' && !u.ko && !(u.frozen > 0)) bob = (Math.sin(t * 3 + (u.id.charCodeAt(0) || 0)) > 0.6) ? 1 : 0;
    if (u.k === 'bat' && !u.frozen) bob = Math.round(Math.sin(t * 6 + u.x) * 2) - 6;
    if (u.k === 'wisp') bob = Math.round(Math.sin(t * 3 + u.x) * 1.5) - 2;
    const hop = d.hop || 0;
    const x0 = sx - (fr.w >> 1), y0 = sy - fr.h + 1 + bob - hop;
    if (u.ko && u.team === 'h') {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(fr.c, 0, 0, fr.w, fr.h - 6, x0, y0 + 6, fr.w, fr.h - 6);
      ctx.globalAlpha = 1;
      return;
    }
    if (d.alpha !== undefined) ctx.globalAlpha = d.alpha;
    ctx.drawImage(fr.c, x0, y0);
    if (d.flash) { const w = SP.frame(u.k, sd, pose, true); ctx.globalAlpha = d.flash; ctx.drawImage(w.c, x0, y0); ctx.globalAlpha = 1; }
    if (d.alpha !== undefined) ctx.globalAlpha = 1;
    if (u.frozen > 0) {
      ctx.fillStyle = 'rgba(150,220,255,0.45)';
      ctx.fillRect(x0 - 1, y0 + 2, fr.w + 2, fr.h - 2);
      ctx.fillStyle = 'rgba(230,250,255,0.9)';
      ctx.fillRect(x0 - 1, y0 + 2, fr.w + 2, 1); ctx.fillRect(x0 - 1, y0 + 2, 1, fr.h - 2); ctx.fillRect(x0 + 2, y0 + 5, 2, 1);
    }
    R.unitRects.push({ id: u.id, x: x0, y: y0 - 2, w: fr.w, h: fr.h + 2, sx, sy });
  }
  R.unitRects = [];

  // 透かし（壁の向こうにいるとき）
  function drawGhost(ctx, st, u, d, color) {
    const SP = root.SPR19;
    const [sx, sy] = proj(st, d.x, d.y, d.z);
    const sd = d.sd !== undefined ? d.sd : sdir(u.face);
    const fr = SP.frame(u.k, sd, d.pose || 'idle', true);
    if (!fr) return;
    ctx.globalAlpha = 0.5;
    const c = tintCache(u.k + sd + (d.pose || 'idle'), fr, color);
    ctx.drawImage(c, sx - (fr.w >> 1), sy - fr.h + 1);
    ctx.globalAlpha = 1;
  }
  const tcache = {};
  function tintCache(key, fr, color) {
    const k = key + color;
    if (tcache[k]) return tcache[k];
    const c = document.createElement('canvas'); c.width = fr.w; c.height = fr.h;
    const x = c.getContext('2d'); x.drawImage(fr.c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, fr.w, fr.h);
    tcache[k] = c; return c;
  }

  // ---------- 一枚を描く ----------
  // view: {st, sec, disp:{id:{x,y,z,pose,...}}, odisp:{id:{...}}, tint:{i:color}, focus:[x,y,z], overlay(fn)}
  R.draw = function (ctx, view, t) {
    R.time = t;
    R.unitRects = [];
    R.objRects = [];
    const st = view.st;
    drawBackdrop(ctx, view.sec, t);
    const [Wr, Hr] = dims(st);
    // 物を升に振りわける
    const buckets = new Map();
    const addB = (s, item) => { if (!buckets.has(s)) buckets.set(s, []); buckets.get(s).push(item); };
    for (const o of st.objs) {
      if (o.gone && !(view.odisp && view.odisp[o.id])) continue;
      if (o.k === 'bridge' || o.k === 'fall') continue;
      const d = (view.odisp && view.odisp[o.id]) || o;
      if (d.hide) continue;
      const [u, v] = rotXY(st, d.x, d.y);
      const s = Math.ceil(u - 1e-6) + Math.ceil(v - 1e-6);
      addB(s, { kind: 'o', o, d, z: d.z, w: Math.ceil(u - 1e-6) });
    }
    for (const un of st.units) {
      if ((un.gone || (un.ko && un.team === 'e')) && !(view.disp && view.disp[un.id])) continue;
      const d = (view.disp && view.disp[un.id]) || un;
      const [u, v] = rotXY(st, d.x, d.y);
      const s = Math.ceil(u - 1e-6) + Math.ceil(v - 1e-6);
      addB(s, { kind: 'u', u: un, d, z: d.z + 0.5, w: Math.ceil(u - 1e-6) });
    }
    // 手前でふさぐ柱をうすくする目印
    const foc = view.focus ? proj(st, view.focus[0], view.focus[1], view.focus[2]) : null;
    const focS = view.focus ? (() => { const [u, v] = rotXY(st, view.focus[0], view.focus[1]); return Math.round(u) + Math.round(v); })() : 0;
    // 仲間をふさぐ物だけを写しとる（あとで、隠れた部分だけを透かす）
    const masks = [];
    const faded = new Set();
    R.faded = faded;
    const occ = (rx, ry, rw, rh, fn) => {
      for (const m of masks) {
        if (rx + rw <= m.x0 || rx >= m.x0 + m.w || ry + rh <= m.y0 || ry >= m.y0 + m.h) continue;
        m.ctx.save(); m.ctx.translate(-m.x0, -m.y0); fn(m.ctx); m.ctx.restore(); m.any = true;
      }
    };
    const bridgeCells = new Map();
    const raisedAt = new Map();
    for (const o of st.objs) {
      if (o.k !== 'bridge') continue;
      if (o.down) for (const c of o.cells) bridgeCells.set(S.idx(st, c[0], c[1]), o);
      else if (o.hinge) raisedAt.set(S.idx(st, o.hinge[0], o.hinge[1]), o);
    }
    const maxS = Wr + Hr - 2;
    for (let s = 0; s <= maxS + 1; s++) {
      for (let u = Math.max(0, s - (Hr - 1)); u <= Math.min(Wr - 1, s); u++) {
        const v = s - u;
        const [x, y] = unrot(st, u, v);
        const i = S.idx(st, x, y);
        const col = columnCanvas(st, x, y);
        if (col) {
          const [sx, sy] = proj(st, x, y, col.top);
          let fade = false;
          if (foc && s > focS && sy - 8 < foc[1] - 4 && Math.abs(sx - foc[0]) < 28 && col.top > view.focus[2] + 1 && sy + 8 + Math.max(col.dl, col.dr) * 8 > foc[1] - 26) fade = true;
          if (fade) faded.add(i);
          if (fade) ctx.globalAlpha = 0.35;
          ctx.drawImage(col.cv, sx - 16, sy - 8);
          if (masks.length && !fade) occ(sx - 16, sy - 8, 32, col.cv.height, (c) => c.drawImage(col.cv, sx - 16, sy - 8));
          // 水面
          if (st.t[i] === 'w' || st.t[i] === 'r') drawWater(ctx, st, x, y, t, st.t[i] === 'r');
          // 色の印（届く範囲など）
          const tc = view.tint && view.tint[i];
          if (tc) { ctx.globalAlpha = (fade ? 0.35 : 1) * (tc.a || 0.35); diamond(ctx, sx, sy + (st.t[i] === 'w' ? 2 : 0), 16, tc.c || tc); ctx.globalAlpha = fade ? 0.35 : 1; }
          if (fade) ctx.globalAlpha = 1;
        }
        const up = raisedAt.get(i);
        if (up) drawRaisedBridge(ctx, st, up, x, y);
        const bo = bridgeCells.get(i);
        if (bo) { drawBridgeCell(ctx, st, bo, x, y, 1); if (masks.length) { const [bx, by] = proj(st, x, y, bo.z); occ(bx - 16, by - 12, 32, 24, (c) => drawBridgeCell(c, st, bo, x, y, 1)); } }
        if (view.cellHook) view.cellHook(ctx, x, y, i);
      }
      // 滝（その列のあと）
      for (const o of st.objs) if (o.k === 'fall' && !o.gone) {
        const [u1, v1] = rotXY(st, o.bx, o.by);
        if (u1 + v1 === s) drawFall(ctx, st, o, t);
      }
      const list = buckets.get(s);
      if (list) {
        list.sort((a, b) => a.z - b.z || a.w - b.w);
        for (const it of list) {
          if (it.kind === 'o') {
            drawObj(ctx, st, it.o, t, it.d);
            if (masks.length) { const [ox, oy] = proj(st, it.d.x, it.d.y, it.d.z || 0); occ(ox - 16, oy - 40, 32, 48, (c) => drawObj(c, st, it.o, t, it.d, true)); }
          } else {
            const before = R.unitRects.length;
            if (masks.length && it.u.team !== 'h') { const [ux, uy] = proj(st, it.d.x, it.d.y, it.d.z); occ(ux - 12, uy - 34, 24, 36, (c) => { const keep = R.unitRects.length; drawUnit(c, st, it.u, Object.assign({}, it.d, { ring: null }), t); R.unitRects.length = keep; }); }
            drawUnit(ctx, st, it.u, it.d, t);
            if (it.u.team === 'h' && !it.u.ko && R.unitRects.length > before) {
              const r = R.unitRects[R.unitRects.length - 1];
              let m = maskPool[it.u.id];
              if (!m) { const cv = document.createElement('canvas'); cv.width = 40; cv.height = 48; m = maskPool[it.u.id] = { cv, ctx: cv.getContext('2d') }; }
              m.ctx.clearRect(0, 0, 40, 48);
              m.x0 = r.x - 2; m.y0 = r.y - 2; m.w = Math.min(40, r.w + 4); m.h = Math.min(48, r.h + 4); m.any = false; m.u = it.u; m.d = it.d;
              masks.push(m);
            }
          }
        }
      }
    }
    // 壁や人の陰になった部分だけ、仲間の形を色で透かす
    const occluded = {};
    for (const m of masks) {
      if (!m.any) continue;
      const SP = root.SPR19;
      const u = m.u, d = m.d;
      const sd = d.sd !== undefined ? d.sd : sdir(u.face);
      const fr = SP.frame(u.k, sd, d.pose || 'idle', false);
      const [sx, sy] = proj(st, d.x, d.y, d.z);
      const ux = sx - (fr.w >> 1), uy = sy - fr.h + 1;
      const c = m.ctx;
      c.globalCompositeOperation = 'destination-in';
      c.drawImage(fr.c, ux - m.x0, uy - m.y0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = S.HERO[u.k].color; c.fillRect(0, 0, 40, 48);
      c.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.62;
      ctx.drawImage(m.cv, m.x0, m.y0);
      ctx.globalAlpha = 1;
      occluded[u.id] = true;
    }
    R.occluded = occluded;
  };
  const maskPool = {};

  function drawWater(ctx, st, x, y, t, fast) {
    const z = st.h[S.idx(st, x, y)];
    const [sx, sy0] = proj(st, x, y, z);
    const sy = sy0 + 2;
    ctx.globalAlpha = 0.78;
    diamond(ctx, sx, sy, 16, fast ? '#2a6aa0' : '#2c5f8e');
    ctx.globalAlpha = 1;
    if (fast) {
      // 速い流れ：白い筋が流れていく
      ctx.fillStyle = 'rgba(220,240,255,0.7)';
      for (let k = 0; k < 4; k++) {
        const ph = ((t * 1.6 + k * 0.25 + (x + y) * 0.13) % 1);
        const oy = Math.round(-6 + ph * 12), ox = Math.round((k - 1.5) * 6 + ph * 4);
        ctx.fillRect(sx + ox - 2, sy + oy, 4, 1);
      }
      return;
    }
    // さざ波
    ctx.fillStyle = 'rgba(160,210,255,0.55)';
    for (let k = 0; k < 3; k++) {
      const ph = t * 1.3 + x * 0.7 + y * 1.1 + k * 2.1;
      const ox = Math.round(Math.sin(ph) * 7), oy = Math.round(Math.cos(ph * 0.8) * 3);
      ctx.fillRect(sx + ox - 2, sy + oy, 4, 1);
    }
  }

  // ---------- 画面の座標 → 升 ----------
  R.pick = function (st, mx, my) {
    // 立てない壁（物のないもの）は、奥に升があればそちらを選ぶ
    let wallHit = null;
    const [Wr, Hr] = dims(st);
    const maxS = Wr + Hr - 2;
    for (let s = maxS; s >= 0; s--) {
      for (let u = Math.min(Wr - 1, s); u >= Math.max(0, s - (Hr - 1)); u--) {
        const v = s - u;
        const [x, y] = unrot(st, u, v);
        const sf = S.surface(st, x, y);
        let top;
        const i = S.idx(st, x, y);
        const tt = terrainTop(st, i);
        if (tt === null && !sf.bridge) continue;
        if (R.faded && R.faded.has(i)) continue;
        top = sf.void ? tt : ((st.t[i] === 'w' || st.t[i] === 'r') ? st.h[i] : Math.max(sf.z, tt === null ? -99 : tt));
        if (sf.block) top = Math.max(top, sf.blockTop);
        const col = columnCanvas(st, x, y);
        const [sx, sy] = proj(st, x, y, top);
        const dx = mx - sx;
        if (Math.abs(dx) > 16) continue;
        const yt = sy - 8 + Math.abs(dx) / 2 + 0.5;
        const drop = col ? (dx < 0 ? col.dl : col.dr) : 0;
        const ztop = sf.top || sf.block ? (top - (tt === null ? top : tt)) : 0;
        const yb = sy + 8 - Math.abs(dx) / 2 + (drop + ztop) * 8;
        if (my >= yt && my <= yb) {
          const plainWall = st.t[i] === 'x' && !st.objs.some(o => !o.gone && o.x === x && o.y === y);
          if (!plainWall) return [x, y];
          if (!wallHit) wallHit = [x, y];
        }
      }
    }
    return wallHit;
  };

  R.sdir = sdir; R.wdirOf = wdirOf; R.proj = proj; R.projF = projF; R.rawProj = rawProj; R.rotXY = rotXY; R.unrot = unrot;
  R.resetCache = resetCache; R.diamond = diamond; R.diamondLine = diamondLine; R.box = box; R.circle = circle; R.ellipse = ellipse;
  R.drawUnit = drawUnit; R.drawObj = drawObj; R.hash = hash; R.drawBackdrop = drawBackdrop;
  root.R19 = R;
})(typeof window !== 'undefined' ? window : globalThis);
