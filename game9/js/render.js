/*
 * そこから、そら ― 描画（Canvas 2D。外部素材なし、すべて手続きで描く）
 */
(function (root) {
  'use strict';
  const S = root.SKS;
  const { CELL, COLS, ROWS, PAD_Y, WATER_Y, BALL_R, T, MAT } = S;
  const FX0 = 320;                       // 井戸の断面の左はし（画面座標）
  const FONT = '"BIZ UDPGothic","Yu Gothic UI","Yu Gothic","Meiryo","Hiragino Kaku Gothic ProN",sans-serif';
  const FONT_SOFT = '"UD デジタル 教科書体 NK-R","UD Digi Kyokasho NK-R","Hiragino Maru Gothic ProN","BIZ UDPGothic","Yu Gothic",sans-serif';

  // 層ごとの色
  const PAL = [
    { bg0: '#081420', bg1: '#11283a', far: '#17324a', bed: '#16202b', bedHi: '#26384a', soil: '#3e5a72', stone: '#5c7088', hard: '#7d8ea3', ore: '#8ff0ff', root: '#8a6e50', mud: '#4b3a2c', water0: '#1d8fa6', water1: '#0b4a63', rim: '#7fe6ec', glow: '#a8f4ff', panel: '#0d1a26', ink: '#d9f2ff', accent: '#8fdcff' },
    { bg0: '#1a0f09', bg1: '#2c1a10', far: '#3a2416', bed: '#24170f', bedHi: '#3b281a', soil: '#9c5c32', stone: '#7b5b45', hard: '#a4836a', ore: '#ffb46b', root: '#8a6e50', mud: '#4d3420', water0: '#2a8f98', water1: '#0e4a52', rim: '#ffc58a', glow: '#ffd6a8', panel: '#1d130c', ink: '#ffe9d4', accent: '#ffb877' },
    { bg0: '#0e110d', bg1: '#1b2118', far: '#242c20', bed: '#1f231b', bedHi: '#343a2c', soil: '#5e4b36', stone: '#6e6c60', hard: '#8e8878', ore: '#f0cf5c', root: '#8a6e50', mud: '#3e3224', water0: '#2a9686', water1: '#0d4a42', rim: '#d8f0a8', glow: '#e9ffc4', panel: '#121610', ink: '#eef6dc', accent: '#cfe89a' },
    { bg0: '#130f22', bg1: '#211a36', far: '#2c2446', bed: '#1f1a30', bedHi: '#352d4c', soil: '#7e6a7c', stone: '#8a90a6', hard: '#aab0c6', ore: '#ff9fd2', root: '#8a6e50', mud: '#4a3a48', water0: '#3a9cc4', water1: '#173e62', rim: '#ffd0f2', glow: '#ffe2f6', panel: '#151026', ink: '#f6ecff', accent: '#ffb3e0' },
    { bg0: '#170f08', bg1: '#2c1f10', far: '#3a2a16', bed: '#251a0f', bedHi: '#3e2e1a', soil: '#6d4a29', stone: '#7e6d57', hard: '#9d8c70', ore: '#ffe28a', root: '#b98f5a', mud: '#3f2b18', water0: '#43aab2', water1: '#155058', rim: '#ffe9b0', glow: '#fff3cf', panel: '#1b130b', ink: '#fff2dc', accent: '#ffd98a' }
  ];

  function hash(a, b, c) {
    let h = (a * 374761393 + b * 668265263 + (c || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (k >= 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
    else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ------------------------------------------------------------------
  // マスの絵（層 × 種類 × 3通り）をあらかじめ作っておく
  const tileCache = {};
  function tile(layer, type, v) {
    const key = layer + ':' + type + ':' + v;
    if (tileCache[key]) return tileCache[key];
    const P = PAL[layer];
    const c = mk(CELL, CELL), g = c.getContext('2d');
    const rnd = (() => { let s = (layer * 131 + type * 17 + v * 7 + 1) | 0; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
    let base = P.soil;
    if (type === T.STONE || type === T.TREAS || type === T.ORE) base = P.stone;
    if (type === T.HARD) base = P.hard;
    if (type === T.BED) base = P.bed;
    if (type === T.MUD) base = P.mud;
    if (type === T.ROOT) base = P.root;
    if (type === T.BLAST) base = '#5a2a22';
    if (type === T.POUCH) base = P.soil;
    const grd = g.createLinearGradient(0, 0, 0, CELL);
    grd.addColorStop(0, shade(base, -0.12 + v * 0.03));
    grd.addColorStop(1, shade(base, 0.06 + v * 0.02));
    g.fillStyle = grd; g.fillRect(0, 0, CELL, CELL);
    // ざらざら
    const nDots = type === T.SOIL || type === T.MUD ? 26 : 14;
    for (let k = 0; k < nDots; k++) {
      const x = rnd() * CELL, y = rnd() * CELL, s = 1 + rnd() * (type === T.SOIL ? 2 : 3);
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.07)';
      g.fillRect(x, y, s, s);
    }
    if (type === T.SOIL) {
      for (let k = 0; k < 2; k++) {
        g.fillStyle = shade(base, 0.18); g.beginPath();
        g.ellipse(4 + rnd() * 24, 4 + rnd() * 24, 2 + rnd() * 2, 1.5 + rnd(), rnd() * 3, 0, 7); g.fill();
      }
    }
    if (type === T.STONE || type === T.TREAS || type === T.ORE) {
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(rnd() * 10, 6 + rnd() * 20); g.lineTo(12 + rnd() * 8, 10 + rnd() * 12); g.lineTo(22 + rnd() * 10, 4 + rnd() * 24); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.beginPath(); g.moveTo(3, 3); g.lineTo(18, 3); g.lineTo(8, 14); g.closePath(); g.fill();
    }
    if (type === T.HARD) {
      if (layer === 2) {          // 井戸の石組み
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
        g.strokeRect(1, 1, 30, 14); g.strokeRect(-15 + (v % 2) * 8, 17, 30, 14); g.strokeRect(15 + (v % 2) * 8, 17, 30, 14);
        g.fillStyle = 'rgba(120,150,90,0.25)';
        for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(rnd() * 32, rnd() * 32, 3 + rnd() * 3, 2, 0, 0, 7); g.fill(); }
      } else {
        g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(0, 16 + rnd() * 6); g.lineTo(32, 12 + rnd() * 6); g.stroke();
        g.beginPath(); g.moveTo(10 + rnd() * 10, 0); g.lineTo(12 + rnd() * 8, 14); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(2, 2, 28, 3);
      }
    }
    if (type === T.ORE) {
      for (let k = 0; k < 3; k++) {
        const x = 6 + rnd() * 20, y = 6 + rnd() * 20, s = 3 + rnd() * 4, a = rnd() * 3;
        g.save(); g.translate(x, y); g.rotate(a);
        g.fillStyle = P.ore; g.beginPath(); g.moveTo(0, -s * 1.4); g.lineTo(s * 0.7, 0); g.lineTo(0, s * 1.2); g.lineTo(-s * 0.7, 0); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.moveTo(0, -s * 1.4); g.lineTo(s * 0.3, -s * 0.2); g.lineTo(0, 0); g.closePath(); g.fill();
        g.restore();
      }
    }
    if (type === T.BED) {
      if (layer >= 2) {
        g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2;
        g.strokeRect(1, 1, 30, 14); g.strokeRect(-15 + (v % 2) * 10, 17, 30, 14); g.strokeRect(15 + (v % 2) * 10, 17, 30, 14);
        g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(2, 2, 28, 4);
      } else {
        g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(rnd() * 32, 0); g.lineTo(rnd() * 32, 32); g.stroke();
      }
    }
    if (type === T.MUD) {
      g.fillStyle = 'rgba(255,255,255,0.12)';
      for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(6 + rnd() * 20, 6 + rnd() * 20, 4, 1.5, -0.4, 0, 7); g.fill(); }
    }
    if (type === T.ROOT) {
      g.fillStyle = shade(P.root, -0.35); g.fillRect(0, 0, CELL, CELL);
      for (let k = 0; k < 4; k++) {
        g.strokeStyle = k % 2 ? shade(P.root, 0.15) : shade(P.root, -0.05); g.lineWidth = 4 + rnd() * 3;
        g.beginPath(); g.moveTo(rnd() * 32, -2); g.bezierCurveTo(rnd() * 32, 10, rnd() * 32, 22, rnd() * 32, 34); g.stroke();
      }
    }
    if (type === T.BLAST) {
      g.strokeStyle = '#ff9a3c'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(5, 8); g.lineTo(14, 15); g.lineTo(11, 25); g.moveTo(14, 15); g.lineTo(26, 11); g.moveTo(20, 13); g.lineTo(25, 26); g.stroke();
    }
    // ふち（立体感）
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(0, 0, CELL, 1.5); g.fillRect(0, 0, 1.5, CELL);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, CELL - 1.5, CELL, 1.5); g.fillRect(CELL - 1.5, 0, 1.5, CELL);
    tileCache[key] = c;
    return c;
  }

  // 背景（層ごと）
  const bgCache = {};
  function background(layer) {
    if (bgCache[layer]) return bgCache[layer];
    const P = PAL[layer];
    const c = mk(640, 720), g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 720);
    grd.addColorStop(0, P.bg0); grd.addColorStop(1, P.bg1);
    g.fillStyle = grd; g.fillRect(0, 0, 640, 720);
    let s = 99 + layer * 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    // 地層のすじ
    for (let k = 0; k < 9; k++) {
      const y = 40 + k * 70 + rnd() * 30;
      g.strokeStyle = rgba(P.far, 0.6); g.lineWidth = 6 + rnd() * 10;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= 640; x += 40) g.lineTo(x, y + Math.sin(x * 0.012 + k) * 8 + rnd() * 4);
      g.stroke();
    }
    // 層ごとの遠景
    g.globalAlpha = 0.22;
    for (let k = 0; k < 7; k++) {
      const x = 60 + rnd() * 520, y = 40 + rnd() * 520, sz = 14 + rnd() * 22;
      g.strokeStyle = P.far; g.fillStyle = P.far; g.lineWidth = 3;
      if (layer === 0) { g.beginPath(); for (let a = 0; a < 12; a += 0.2) { const rr2 = sz * a / 12; g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } g.stroke(); }
      else if (layer === 1) { g.beginPath(); g.arc(x, y, sz, 0.3, 2.2); g.stroke(); for (let q = 0; q < 4; q++) { g.beginPath(); g.arc(x, y, sz - 4 - q * 3, 0.5, 2); g.stroke(); } }
      else if (layer === 2) { g.strokeRect(x - sz, y - sz * 0.5, sz * 2, sz); g.strokeRect(x - sz * 0.5, y + sz * 0.5, sz * 2, sz); }
      else if (layer === 3) { g.beginPath(); g.arc(x, y, sz * 0.6, 0, 7); g.stroke(); g.beginPath(); g.arc(x - 3, y - 3, sz * 0.2, 0, 7); g.fill(); }
      else { g.beginPath(); g.moveTo(x, y - sz * 2); g.bezierCurveTo(x + 20, y - sz, x - 20, y, x + 6, y + sz * 2); g.stroke(); }
    }
    g.globalAlpha = 1;
    // まわりを暗く
    const v = g.createRadialGradient(320, 380, 200, 320, 380, 520);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = v; g.fillRect(0, 0, 640, 720);
    bgCache[layer] = c;
    return c;
  }

  // ------------------------------------------------------------------
  // パーティクル
  const FX = {
    list: [], texts: [], ripples: [], shake: 0, flash: 0, flashColor: '#fff',
    clear() { this.list.length = 0; this.texts.length = 0; this.ripples.length = 0; this.shake = 0; this.flash = 0; },
    add(p) { if (this.list.length < 900) this.list.push(p); },
    debris(x, y, color, n, power) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, sp = (40 + Math.random() * 160) * (power || 1);
        this.add({ k: 'deb', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 900, life: 0.5 + Math.random() * 0.5, t: 0, s: 2 + Math.random() * 4, c: color, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10 });
      }
    },
    dust(x, y, n, color) {
      for (let k = 0; k < n; k++) this.add({ k: 'dust', x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 40, vy: -10 - Math.random() * 30, g: -10, life: 0.6 + Math.random() * 0.6, t: 0, s: 6 + Math.random() * 10, c: color || 'rgba(200,190,170,' });
    },
    sparkle(x, y, n, color, spread) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * (spread || 140);
        this.add({ k: 'spk', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 60, life: 0.4 + Math.random() * 0.5, t: 0, s: 2 + Math.random() * 3, c: color || '#fff' });
      }
    },
    splash(x, n, color, power) {
      for (let k = 0; k < n; k++) {
        const vx = (Math.random() - 0.5) * 220 * (power || 1), vy = -(120 + Math.random() * 260) * (power || 1);
        this.add({ k: 'drop', x: x + (Math.random() - 0.5) * 30 * (power || 1), y: WATER_Y, vx, vy, g: 900, life: 1.2, t: 0, s: 2 + Math.random() * 3, c: color || '#bff4ff' });
      }
      this.ripple(x, 1 + (power || 1) * 0.6);
    },
    ripple(x, size) { this.ripples.push({ x, t: 0, size: size || 1 }); },
    text(x, y, s, opt) { this.texts.push(Object.assign({ x, y, s, t: 0, life: 1.1, size: 18, color: '#fff', vy: -40 }, opt || {})); },
    update(dt) {
      for (const p of this.list) {
        p.t += dt; p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.vr) p.rot += p.vr * dt;
        if (p.k === 'deb' && p.y > WATER_Y) { p.t = p.life; if (Math.random() < 0.3) this.ripples.push({ x: p.x, t: 0, size: 0.3 }); }
        if (p.k === 'drop' && p.y > WATER_Y && p.vy > 0) p.t = p.life;
        if (p.k === 'fly') {
          const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
          const sp = 200 + p.t * 1400;
          if (d < 14) { p.t = p.life; if (p.done) p.done(); } else { p.x += dx / d * sp * dt - p.vx * dt; p.y += dy / d * sp * dt - p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; }
        }
      }
      this.list = this.list.filter((p) => p.t < p.life);
      for (const t of this.texts) { t.t += dt; t.y += t.vy * dt; t.vy *= 0.94; }
      this.texts = this.texts.filter((t) => t.t < t.life);
      for (const r of this.ripples) r.t += dt;
      this.ripples = this.ripples.filter((r) => r.t < 1.2);
      this.shake = Math.max(0, this.shake - dt * 30);
      this.flash = Math.max(0, this.flash - dt * 2.5);
    },
    draw(ctx, ox, oy) {
      for (const p of this.list) {
        const a = 1 - p.t / p.life;
        const x = p.x + ox, y = p.y + oy;
        if (p.k === 'deb') {
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, a * 2);
          ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore();
        } else if (p.k === 'dust') {
          ctx.globalAlpha = a * 0.35; ctx.fillStyle = p.c + '1)';
          ctx.beginPath(); ctx.arc(x, y, p.s * (1.4 - a * 0.4), 0, 7); ctx.fill();
        } else if (p.k === 'spk' || p.k === 'fly') {
          ctx.globalAlpha = p.k === 'fly' ? 1 : a; ctx.fillStyle = p.c;
          const s = p.s * (p.k === 'fly' ? 1.2 : 1);
          ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x, y + s * 1.6); ctx.lineTo(x - s * 0.6, y); ctx.closePath(); ctx.fill();
        } else if (p.k === 'drop') {
          ctx.globalAlpha = Math.min(1, a * 1.5); ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(x, y, p.s, 0, 7); ctx.fill();
        } else if (p.k === 'ring') {
          ctx.globalAlpha = a * 0.8; ctx.strokeStyle = p.c; ctx.lineWidth = 3 * a + 1;
          ctx.beginPath(); ctx.arc(x, y, p.s + (1 - a) * p.grow, 0, 7); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    },
    drawTexts(ctx, ox, oy) {
      for (const t of this.texts) {
        const a = t.t < t.life * 0.7 ? 1 : 1 - (t.t - t.life * 0.7) / (t.life * 0.3);
        const pop = t.t < 0.12 ? 0.6 + t.t / 0.12 * 0.5 : t.t < 0.2 ? 1.1 - (t.t - 0.12) / 0.08 * 0.1 : 1;
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = 'bold ' + Math.round(t.size * pop) + 'px ' + FONT;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(t.s, t.x + ox, t.y + oy);
        ctx.fillStyle = t.color; ctx.fillText(t.s, t.x + ox, t.y + oy);
      }
      ctx.globalAlpha = 1;
    }
  };

  // ------------------------------------------------------------------
  // 世界を描く
  function drawWorld(ctx, w, layer, oy, t, opt) {
    opt = opt || {};
    const P = PAL[layer];
    ctx.save();
    ctx.beginPath(); ctx.rect(FX0, 0, 640, 720); ctx.clip();
    ctx.drawImage(background(layer), FX0, oy);
    ctx.translate(FX0, oy);
    // ふたが あいたら 光がさしこむ
    if (w.lidOpen) {
      const lx = w.lidX || 320;
      const k = Math.min(1, (w.lidOpenT || 0) * 1.5);
      const grd = ctx.createLinearGradient(0, 0, 0, 640);
      grd.addColorStop(0, rgba(P.glow, 0.35 * k)); grd.addColorStop(1, rgba(P.glow, 0));
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.moveTo(lx - 64, 0); ctx.lineTo(lx + 64, 0); ctx.lineTo(lx + 150, 640); ctx.lineTo(lx - 150, 640); ctx.closePath(); ctx.fill();
    }
    // ただよう ちり（場の さびしさを へらす。動きは 時間だけで決まる）
    for (let k = 0; k < 26; k++) {
      const sp = 6 + (k % 5) * 3;
      const x = (k * 113.7 + Math.sin(t * 0.6 + k) * 18 + 640) % 600 + 20;
      const y = 700 - ((k * 61.3 + t * sp) % 680);
      const a = 0.08 + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.3 + k * 2.1));
      ctx.fillStyle = rgba(P.glow, a);
      ctx.fillRect(x, y, k % 3 ? 2 : 3, k % 3 ? 2 : 3);
    }
    drawCells(ctx, w, layer, t, opt);
    drawMonsters(ctx, w, layer, t);
    if (w.guardian && !w.guardian.down) drawGuardian(ctx, w.guardian, w, layer, t, null);
    drawHazards(ctx, w, layer, t);
    drawChunks(ctx, w, layer, t);
    ctx.restore();
  }

  function drawCells(ctx, w, layer, t, opt) {
    const P = PAL[layer];
    const g = w.g;
    const lidCells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c, ty = g[i];
        if (!ty) continue;
        const x = c * CELL, y = r * CELL;
        if (ty === T.LID) { lidCells.push(i); continue; }
        if (ty === T.BODY) continue;
        if (ty === T.ANCHOR) { drawAnchor(ctx, w, layer, c, r, t); continue; }
        if (ty === T.BUMP) { drawBumper(ctx, x + 16, y + 16, t, w.bumpT && w.bumpT[i] !== undefined ? S.clamp(1 - (w.t - w.bumpT[i]) * 4, 0, 1) : 0); continue; }
        const v = (hash(c, r, layer) * 3) | 0;
        ctx.drawImage(tile(layer, ty === T.TREAS ? T.STONE : ty === T.POUCH ? T.SOIL : ty, v), x, y);
        if (ty === T.TREAS) drawTreasureCell(ctx, w, i, x, y, t, layer);
        if (ty === T.POUCH) drawPouch(ctx, x + 16, y + 17, t);
        if (ty === T.BLAST) {
          const a = 0.35 + 0.25 * Math.sin(t * 5 + c);
          ctx.fillStyle = 'rgba(255,140,60,' + a + ')';
          ctx.beginPath(); ctx.arc(x + 15, y + 15, 7, 0, 7); ctx.fill();
        }
        const max = MAT[ty].hp;
        if (max !== Infinity && max > 1 && w.hp[i] < max) drawCracks(ctx, x, y, 1 - w.hp[i] / max, c * 7 + r);
      }
    }
    // ふち：むき出しの面に線、下向きの面には 水の照りかえし
    ctx.lineWidth = 2;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c, ty = g[i];
        if (!ty || ty === T.BODY || ty === T.BUMP || ty === T.ANCHOR) continue;
        const x = c * CELL, y = r * CELL;
        const up = r > 0 && !g[i - COLS], down = r < ROWS - 1 ? !g[i + COLS] : true;
        const left = c > 0 && !g[i - 1], right = c < COLS - 1 && !g[i + 1];
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        if (up) { ctx.moveTo(x, y + 1); ctx.lineTo(x + CELL, y + 1); }
        if (left) { ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + CELL); }
        if (right) { ctx.moveTo(x + CELL - 1, y); ctx.lineTo(x + CELL - 1, y + CELL); }
        ctx.stroke();
        if (down) {
          const a = 0.35 + 0.3 * Math.sin(t * 2.2 + c * 0.9 + r * 0.4);
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.beginPath(); ctx.moveTo(x, y + CELL - 1); ctx.lineTo(x + CELL, y + CELL - 1); ctx.stroke();
          ctx.strokeStyle = rgba(P.rim, a);
          ctx.beginPath(); ctx.moveTo(x + 1, y + CELL - 3); ctx.lineTo(x + CELL - 1, y + CELL - 3); ctx.stroke();
        }
      }
    }
    if (lidCells.length) drawLid(ctx, w, layer, lidCells, t);
  }

  function drawCracks(ctx, x, y, k, seed) {
    ctx.strokeStyle = 'rgba(15,10,5,' + (0.5 + k * 0.4) + ')';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const n = k > 0.6 ? 3 : k > 0.3 ? 2 : 1;
    for (let q = 0; q < n; q++) {
      const sx = x + 6 + hash(seed, q, 1) * 20, sy = y + 4 + hash(seed, q, 2) * 8;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (hash(seed, q, 3) - 0.5) * 14, sy + 8 + hash(seed, q, 4) * 6);
      ctx.lineTo(sx + (hash(seed, q, 5) - 0.5) * 20, sy + 18 + hash(seed, q, 6) * 8);
    }
    ctx.stroke();
  }

  function drawTreasureCell(ctx, w, i, x, y, t, layer) {
    const id = w.item[i];
    ctx.fillStyle = 'rgba(255,230,170,0.16)';
    ctx.beginPath(); ctx.arc(x + 16, y + 16, 12, 0, 7); ctx.fill();
    if (id >= 0) {
      ctx.globalAlpha = 0.85;
      drawItem(ctx, id, x + 16, y + 16, 24, t);
      ctx.globalAlpha = 1;
    }
    const ph = (t * 0.7 + hash(i, 3, 3)) % 2.2;
    if (ph < 0.4) {
      const a = Math.sin(ph / 0.4 * Math.PI);
      ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
      const sx = x + 24, sy = y + 8, s = 5 * a;
      ctx.beginPath(); ctx.moveTo(sx, sy - s); ctx.lineTo(sx + s * 0.3, sy); ctx.lineTo(sx, sy + s); ctx.lineTo(sx - s * 0.3, sy); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx - s, sy); ctx.lineTo(sx, sy - s * 0.3); ctx.lineTo(sx + s, sy); ctx.lineTo(sx, sy + s * 0.3); ctx.closePath(); ctx.fill();
    }
  }

  function drawPouch(ctx, x, y, t) {
    ctx.fillStyle = '#c9a46a';
    ctx.beginPath(); ctx.moveTo(x - 9, y - 4); ctx.quadraticCurveTo(x - 13, y + 11, x, y + 12); ctx.quadraticCurveTo(x + 13, y + 11, x + 9, y - 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a77f45'; ctx.fillRect(x - 6, y - 8, 12, 5);
    ctx.strokeStyle = '#7a3b2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 7, y - 4); ctx.lineTo(x + 7, y - 4); ctx.stroke();
    const cols = ['#7fd8ff', '#ff8fc8', '#ffe07a'];
    for (let k = 0; k < 3; k++) { ctx.fillStyle = cols[k]; ctx.beginPath(); ctx.arc(x - 5 + k * 5, y - 9 + (k % 2) * 2, 2.6, 0, 7); ctx.fill(); }
  }

  function drawBumper(ctx, x, y, t, pulse) {
    pulse = pulse || 0;      // 当たった直後だけ ふくらむ（0〜1）
    const r = 13 + pulse * 4;
    const grd = ctx.createRadialGradient(x - 4, y - 5, 2, x, y, r);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.3, '#b9ecff'); grd.addColorStop(1, '#3d8fd0');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.4 + pulse * 0.6) + ')'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,120,190,0.8)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, r * 0.55, t * 2, t * 2 + 2.2); ctx.stroke();
  }

  function drawLid(ctx, w, layer, cells, t) {
    let x0 = 1e9, x1 = -1e9;
    for (const i of cells) { const c = i % COLS; x0 = Math.min(x0, c * CELL); x1 = Math.max(x1, c * CELL + CELL); }
    const y = 0, h = CELL;
    const cx = (x0 + x1) / 2;
    const k = w.lidHp / MAT[T.LID].hp;
    const sealed = w.guardian && !w.guardian.down;
    if (layer <= 1) {
      // まるい石のふた
      ctx.fillStyle = '#6d6a64'; rr(ctx, x0 + 2, y + 2, x1 - x0 - 4, h - 3, 10); ctx.fill();
      ctx.strokeStyle = '#2c2a26'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#b8a27a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x0 + 8, y + 16); ctx.lineTo(x1 - 8, y + 16); ctx.stroke();
      ctx.strokeStyle = '#8a7656'; ctx.lineWidth = 1.5;
      for (let x = x0 + 10; x < x1 - 8; x += 7) { ctx.beginPath(); ctx.moveTo(x, y + 13); ctx.lineTo(x + 4, y + 19); ctx.stroke(); }
    } else {
      // 木のふた（鉄のたが）
      ctx.fillStyle = '#7a5532'; rr(ctx, x0 + 2, y + 2, x1 - x0 - 4, h - 3, 4); ctx.fill();
      ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#5a3d22'; ctx.lineWidth = 1.5;
      for (let x = x0 + 18; x < x1 - 6; x += 18) { ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y + h - 3); ctx.stroke(); }
      ctx.fillStyle = '#5b5e62'; ctx.fillRect(x0 + 6, y + 12, x1 - x0 - 12, 5);
    }
    // ひびと、すきまから もれる光
    if (k < 1) drawCracks(ctx, cx - 16, y, 1 - k, 99);
    if (k < 0.99) { drawCracks(ctx, x0 + 10, y, 1 - k, 77); drawCracks(ctx, x1 - 40, y, 1 - k, 55); }
    const a = 0.25 + 0.2 * Math.sin(t * 3);
    ctx.strokeStyle = rgba(PAL[layer].glow, sealed ? 0.12 : a);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0 + 4, y + h - 1); ctx.lineTo(x1 - 4, y + h - 1); ctx.stroke();
    if (sealed) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, x0 + 2, y + 2, x1 - x0 - 4, h - 3, 6); ctx.fill();
    }
  }

  // 守り主をつなぎとめる くさび（種類ごとに 絵がちがう）
  function drawAnchor(ctx, w, layer, c, r, t) {
    const x = c * CELL, y = r * CELL;
    const i = r * COLS + c;
    const k = w.hp[i] / MAT[T.ANCHOR].hp;
    const kind = w.guardian ? w.guardian.kind : 'namazu';
    const glow = 0.35 + 0.3 * Math.sin(t * 4 + c + r);
    ctx.fillStyle = 'rgba(255,214,120,' + (glow * 0.35) + ')';
    ctx.fillRect(x, y, CELL, CELL);
    ctx.save(); ctx.translate(x + 16, y + 16);
    if (kind === 'namazu') {
      // しめなわ（よじった わらの なわ）
      ctx.fillStyle = '#d9c48a'; ctx.fillRect(-7, -16, 14, 32);
      ctx.strokeStyle = '#9a8450'; ctx.lineWidth = 2;
      for (let q = -16; q < 16; q += 7) { ctx.beginPath(); ctx.moveTo(-7, q); ctx.lineTo(7, q + 6); ctx.stroke(); }
      ctx.strokeStyle = '#6e5c34'; ctx.lineWidth = 1.5; ctx.strokeRect(-7, -16, 14, 32);
      if ((r + c) % 2 === 0) {
        ctx.fillStyle = '#fffaf0';
        ctx.beginPath(); ctx.moveTo(7, -6); ctx.lineTo(14, -6); ctx.lineTo(10, 0); ctx.lineTo(15, 0); ctx.lineTo(11, 7); ctx.lineTo(8, 7); ctx.lineTo(11, 1); ctx.lineTo(7, 1); ctx.closePath(); ctx.fill();
      }
    } else if (kind === 'tsuchigumo') {
      ctx.strokeStyle = 'rgba(240,240,255,0.9)'; ctx.lineWidth = 1.5;
      for (let a = 0; a < 6; a++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a * 1.05) * 16, Math.sin(a * 1.05) * 16); ctx.stroke(); }
      for (let q = 1; q <= 2; q++) { ctx.beginPath(); for (let a = 0; a <= 6; a++) ctx.lineTo(Math.cos(a * 1.05) * q * 6, Math.sin(a * 1.05) * q * 6); ctx.stroke(); }
      ctx.fillStyle = '#f4f0ff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
    } else if (kind === 'tsurube') {
      ctx.strokeStyle = '#c9a66b'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 16); ctx.stroke();
      ctx.fillStyle = '#b08850'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
      ctx.strokeStyle = '#6b4e28'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.moveTo(-6, -5); ctx.lineTo(6, 5); ctx.stroke();
    } else if (kind === 'karakuri') {
      ctx.fillStyle = '#9aa2ad'; ctx.beginPath();
      for (let a = 0; a < 6; a++) ctx.lineTo(Math.cos(a * 1.047 + 0.5) * 12, Math.sin(a * 1.047 + 0.5) * 12);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#4a4f57'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#3a3f46'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(-4, -5, 3, 0, 7); ctx.fill();
    } else {
      ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-15, -6); ctx.quadraticCurveTo(0, 8, 15, -4); ctx.stroke();
      ctx.strokeStyle = '#b48a55'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, -7); ctx.quadraticCurveTo(0, 6, 14, -5); ctx.stroke();
      ctx.fillStyle = '#7fbf5a'; ctx.beginPath(); ctx.ellipse(6, -9, 5, 2.5, -0.6, 0, 7); ctx.fill();
    }
    ctx.restore();
    if (k < 1) drawCracks(ctx, x, y, 1 - k, c * 13 + r);
    ctx.strokeStyle = 'rgba(255,220,130,' + (0.5 + glow * 0.5) + ')';
    ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.strokeRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3); ctx.setLineDash([]);
  }

  // ------------------------------------------------------------------
  // 生きもの
  function drawMonsters(ctx, w, layer, t) {
    for (const m of w.monsters) {
      if (m.dead) continue;
      if (m.kind === 'bat') drawBat(ctx, m, t);
      else if (m.kind === 'grub') drawGrub(ctx, m, t);
      else if (m.kind === 'drip') drawDrip(ctx, m, t);
    }
  }

  function drawBat(ctx, m, t) {
    ctx.save(); ctx.translate(m.x, m.y);
    if (m.state === 'sleep') {
      ctx.strokeStyle = '#2a2236'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, -12); ctx.lineTo(-3, -8); ctx.moveTo(3, -12); ctx.lineTo(3, -8); ctx.stroke();
      ctx.fillStyle = '#3d3150'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 11, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#4e4166'; ctx.beginPath(); ctx.ellipse(0, 1, 6, 9, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(220,220,255,0.7)'; ctx.font = '10px ' + FONT; ctx.textAlign = 'center';
      ctx.fillText('z', 10 + Math.sin(t * 2) * 2, -6 - (t * 8 % 10));
      ctx.restore(); return;
    }
    const flap = Math.sin(t * (m.state === 'dive' ? 30 : 16));
    const tele = m.state === 'tele';
    if (tele) ctx.translate(Math.sin(t * 60) * 1.5, 0);
    ctx.fillStyle = '#3d3150';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0, -2);
      ctx.quadraticCurveTo(s * 14, -10 - flap * 8, s * 22, -2 + flap * 6);
      ctx.quadraticCurveTo(s * 15, 2, s * 12, 6 + flap * 2);
      ctx.quadraticCurveTo(s * 7, 2, 0, 4); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#4e4166'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 9, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-5, -13); ctx.lineTo(-2, -7); ctx.moveTo(6, -6); ctx.lineTo(5, -13); ctx.lineTo(2, -7); ctx.fill();
    ctx.fillStyle = tele || m.state === 'dive' ? '#ff4a3a' : '#fff4c8';
    ctx.beginPath(); ctx.arc(-3, -2, 2.2, 0, 7); ctx.arc(3, -2, 2.2, 0, 7); ctx.fill();
    if (tele) {
      ctx.strokeStyle = 'rgba(255,90,70,' + (0.5 + 0.5 * Math.sin(t * 20)) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 16 + Math.sin(t * 20) * 2, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }

  function drawGrub(ctx, m, t) {
    ctx.save(); ctx.translate(m.x, m.y);
    const build = m.state === 'build';
    const wig = Math.sin(t * (build ? 26 : 8));
    const segs = 4;
    for (let k = segs - 1; k >= 0; k--) {
      const sx = (k - 1.5) * 6 * (m.face || 1) * -1, sy = Math.sin(t * 8 + k) * 1.5 + (build ? wig * 1.5 : 0);
      ctx.fillStyle = k === 0 ? '#c98a6a' : (k % 2 ? '#a8664a' : '#b97758');
      ctx.beginPath(); ctx.arc(sx, sy, 6 - k * 0.4, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(70,45,25,0.7)'; ctx.beginPath(); ctx.arc(sx + 2, sy + 2, 1.6, 0, 7); ctx.fill();
    }
    const hx = -1.5 * 6 * (m.face || 1) * -1;
    ctx.fillStyle = '#1b1410'; ctx.beginPath(); ctx.arc(hx - 2, -2, 1.3, 0, 7); ctx.arc(hx + 2, -2, 1.3, 0, 7); ctx.fill();
    if (build) {
      ctx.fillStyle = '#5a4030'; ctx.beginPath(); ctx.arc(hx, 6 + Math.abs(wig) * 3, 3.5, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function drawDrip(ctx, m, t) {
    ctx.strokeStyle = 'rgba(230,240,255,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(m.x, m.ay); ctx.lineTo(m.x, m.y - 6); ctx.stroke();
    ctx.save(); ctx.translate(m.x, m.y);
    ctx.strokeStyle = '#1c2230'; ctx.lineWidth = 1.6;
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const a = -0.9 + k * 0.55;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 9, -4 + k * 3, s * (12 + Math.sin(t * 6 + k) * 1.5), a * 8 + 6); ctx.stroke();
    }
    ctx.fillStyle = '#2b3448'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5f7ab0'; ctx.beginPath(); ctx.ellipse(0, -2, 3, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8f2ff'; ctx.beginPath(); ctx.arc(-2.5, 3, 1.4, 0, 7); ctx.arc(2.5, 3, 1.4, 0, 7); ctx.fill();
    if (m.state === 'tele') {
      const k = 1 - m.st / 0.7;
      ctx.fillStyle = 'rgba(140,210,255,0.9)';
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.quadraticCurveTo(4 * k + 1, 12 + k * 6, 0, 13 + k * 8); ctx.quadraticCurveTo(-4 * k - 1, 12 + k * 6, 0, 8); ctx.fill();
    }
    ctx.restore();
  }

  function drawHazards(ctx, w, layer, t) {
    const G = w.guardian;
    if (G && !G.down && G.state === 'tele' && G.kind === 'tsurube') {
      // おけが おちてくる場所
      const k = 1 - G.st / 0.9;
      ctx.fillStyle = 'rgba(255,90,60,' + (0.25 + 0.4 * k) + ')';
      ctx.beginPath(); ctx.ellipse(G.tx, PAD_Y + 36, 34 - k * 10, 7, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,170,' + (0.25 + 0.4 * k) + ')'; ctx.setLineDash([5, 7]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(G.tx, G.y1 + 10); ctx.lineTo(G.tx, PAD_Y + 30); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 0.35 + 0.3 * k; drawBucket(ctx, G.tx, G.y1 + 22, 0.8); ctx.globalAlpha = 1;
    }
    for (const h of w.hazards) {
      if (h.kind === 'pebble') {
        if (h.tele > 0) {
          const k = 1 - h.tele / 0.85;
          ctx.fillStyle = 'rgba(200,190,170,' + (0.3 + 0.3 * Math.sin(t * 30)) + ')';
          ctx.beginPath(); ctx.arc(h.x + Math.sin(t * 40) * 2, h.y + 4, 6 + k * 4, 0, 7); ctx.fill();
          // 落ちる場所のしるし
          ctx.fillStyle = 'rgba(255,90,60,' + (0.25 + 0.35 * k) + ')';
          ctx.beginPath(); ctx.ellipse(h.x, PAD_Y + 36, 18 - k * 6, 5, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(255,200,180,' + (0.2 + 0.3 * k) + ')'; ctx.setLineDash([3, 6]); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(h.x, h.y + 10); ctx.lineTo(h.x, PAD_Y + 30); ctx.stroke(); ctx.setLineDash([]);
          continue;
        }
        ctx.fillStyle = '#7d7468'; ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.y * 0.05);
        ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(2, -9); ctx.lineTo(9, -2); ctx.lineTo(6, 7); ctx.lineTo(-5, 8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#3a342c'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
        ctx.fillStyle = 'rgba(255,90,60,0.4)'; ctx.beginPath(); ctx.ellipse(h.x, PAD_Y + 36, 12, 4, 0, 0, 7); ctx.fill();
      } else if (h.kind === 'drop') {
        ctx.fillStyle = 'rgba(140,210,255,0.95)';
        ctx.beginPath(); ctx.moveTo(h.x, h.y - 9); ctx.quadraticCurveTo(h.x + 6, h.y, h.x, h.y + 5); ctx.quadraticCurveTo(h.x - 6, h.y, h.x, h.y - 9); ctx.fill();
        ctx.fillStyle = 'rgba(140,210,255,0.3)'; ctx.beginPath(); ctx.ellipse(h.x, PAD_Y + 36, 10, 3, 0, 0, 7); ctx.fill();
      } else if (h.kind === 'web') {
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(t * 5);
        ctx.fillStyle = 'rgba(240,240,255,0.85)'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1;
        for (let a = 0; a < 6; a++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); ctx.stroke(); }
        ctx.restore();
      } else if (h.kind === 'cork') {
        if (h.tele > 0) continue;
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(t * 8);
        ctx.fillStyle = '#c8955a'; rr(ctx, -6, -8, 12, 16, 3); ctx.fill();
        ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#8a6036'; ctx.beginPath(); ctx.arc(-2, -2, 1.2, 0, 7); ctx.arc(2, 3, 1.2, 0, 7); ctx.fill();
        ctx.restore();
      } else if (h.kind === 'bucket') {
        ctx.strokeStyle = '#c9a66b'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(h.x, h.y0 - 30); ctx.lineTo(h.x, h.y - 18); ctx.stroke();
        drawBucket(ctx, h.x, h.y, 1);
      }
    }
  }

  function drawBucket(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#9b6a3a';
    ctx.beginPath(); ctx.moveTo(-20, -16); ctx.lineTo(20, -16); ctx.lineTo(16, 18); ctx.lineTo(-16, 18); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#3e3e44'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-19, -8); ctx.lineTo(19, -8); ctx.moveTo(-17, 10); ctx.lineTo(17, 10); ctx.stroke();
    ctx.strokeStyle = '#6b4826'; ctx.lineWidth = 1.2;
    for (let k = -12; k <= 12; k += 8) { ctx.beginPath(); ctx.moveTo(k, -16); ctx.lineTo(k * 0.85, 18); ctx.stroke(); }
    ctx.strokeStyle = '#c9a66b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -16, 18, Math.PI, 0); ctx.stroke();
    ctx.restore();
  }

  function drawChunks(ctx, w, layer, t) {
    for (const ch of w.chunks) {
      ctx.save();
      ctx.translate(ch.cx, ch.cy + ch.oy);
      ctx.rotate(ch.rot);
      ctx.globalAlpha = 0.95;
      for (const cl of ch.cells) {
        const x = cl.c * CELL - ch.cx, y = cl.r * CELL - ch.cy;
        if (cl.t === T.BODY) continue;
        if (cl.t === T.ANCHOR) { ctx.fillStyle = '#8a7a62'; ctx.fillRect(x, y, CELL, CELL); continue; }
        const v = (hash(cl.c, cl.r, layer) * 3) | 0;
        ctx.drawImage(tile(layer, cl.t === T.TREAS ? T.STONE : cl.t === T.POUCH ? T.SOIL : cl.t, v), x, y);
        if (cl.t === T.TREAS && cl.item >= 0) drawItem(ctx, cl.item, x + 16, y + 16, 24, t);
        if (cl.t === T.POUCH) drawPouch(ctx, x + 16, y + 17, t);
      }
      // 落ちるかたまりの ふち（外がわだけ。ひとつの かたまりに 見えるように）
      if (!ch.edge) {
        const set = new Set(ch.cells.map((cl) => cl.c + ',' + cl.r));
        ch.edge = [];
        for (const cl of ch.cells) {
          if (cl.t === T.BODY) continue;
          const x = cl.c * CELL - ch.cx, y = cl.r * CELL - ch.cy;
          if (!set.has(cl.c + ',' + (cl.r - 1))) ch.edge.push([x, y, x + CELL, y]);
          if (!set.has(cl.c + ',' + (cl.r + 1))) ch.edge.push([x, y + CELL, x + CELL, y + CELL]);
          if (!set.has((cl.c - 1) + ',' + cl.r)) ch.edge.push([x, y, x, y + CELL]);
          if (!set.has((cl.c + 1) + ',' + cl.r)) ch.edge.push([x + CELL, y, x + CELL, y + CELL]);
        }
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (const [x0, y0, x1, y1] of ch.edge) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (ch.body && w.guardian) drawGuardian(ctx, w.guardian, w, layer, t, ch);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------
  // 守り主
  function drawGuardian(ctx, G, w, layer, t, chunk) {
    const cx0 = (G.x0 + G.x1) / 2, cy0 = (G.y0 + G.y1) / 2;
    const gw = G.x1 - G.x0, gh = G.y1 - G.y0;
    ctx.save();
    if (chunk) ctx.translate(cx0 - chunk.cx, cy0 - chunk.cy);
    else ctx.translate(cx0, cy0);
    const fl = G.flinch > 0 ? Math.sin(t * 70) * 3 * G.flinch / 0.35 : 0;
    const tele = !chunk && G.state === 'tele';
    ctx.translate(fl, tele ? Math.sin(t * 50) * 1.5 : 0);
    const anger = chunk ? 1 : (G.anger || 0);
    const fall = !!chunk;
    // 体のまわりの つなぎ（糸・なわ）
    if (!chunk && (G.kind === 'tsuchigumo' || G.kind === 'tsurube' || G.kind === 'karakuri' || G.kind === 'nekko' || G.kind === 'namazu')) {
      for (let i = 0; i < w.N; i++) {
        if (w.g[i] !== T.ANCHOR) continue;
        const ax = (i % COLS) * CELL + 16 - cx0, ay = ((i / COLS) | 0) * CELL + 16 - cy0;
        const col = G.kind === 'tsuchigumo' ? 'rgba(235,235,255,0.6)' : G.kind === 'karakuri' ? 'rgba(160,170,180,0.7)' : G.kind === 'nekko' ? 'rgba(122,90,52,0.9)' : 'rgba(201,166,107,0.8)';
        ctx.strokeStyle = col; ctx.lineWidth = G.kind === 'nekko' ? 6 : 2;
        ctx.beginPath(); ctx.moveTo(ax * 0.35, ay * 0.35); ctx.lineTo(ax, ay); ctx.stroke();
      }
    }
    if (G.kind === 'namazu') drawNamazu(ctx, gw, gh, t, anger, fall, tele);
    else if (G.kind === 'tsuchigumo') drawSpider(ctx, gw, gh, t, anger, fall, tele);
    else if (G.kind === 'tsurube') drawTsurube(ctx, gw, gh, t, anger, fall, tele);
    else if (G.kind === 'karakuri') drawKarakuri(ctx, gw, gh, t, anger, fall, tele);
    else drawNekko(ctx, gw, gh, t, anger, fall, tele);
    ctx.restore();
  }

  function eye(ctx, x, y, r, open, look, angry) {
    ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.ellipse(x, y, r, r * open, 0, 0, 7); ctx.fill();
    if (open > 0.2) { ctx.fillStyle = '#1a140e'; ctx.beginPath(); ctx.arc(x + (look || 0), y + 1, r * 0.45, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#1a140e'; ctx.lineWidth = 2;
    if (angry) { ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.9 - (x < 0 ? -3 : 3)); ctx.lineTo(x + r, y - r * 0.9 + (x < 0 ? -3 : 3)); ctx.stroke(); }
  }

  function drawNamazu(ctx, w, h, t, anger, fall, tele) {
    // 岩にうまった おおなまず
    ctx.fillStyle = '#3d4636';
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.52, h * 0.52, 0, 0, 7); ctx.fill();
    const grd = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    grd.addColorStop(0, '#59654c'); grd.addColorStop(1, '#88957a');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.ellipse(0, 4, w * 0.47, h * 0.44, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(30,36,26,0.35)';
    for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(-w * 0.35 + k * w * 0.12, -h * 0.18 + Math.sin(k * 2) * 6, 4, 0, 7); ctx.fill(); }
    // くち
    ctx.fillStyle = '#2a1e18';
    ctx.beginPath(); ctx.ellipse(0, h * 0.2, w * 0.3, 7 + anger * 6 + (tele ? 4 : 0), 0, 0, Math.PI); ctx.fill();
    // ひげ
    ctx.strokeStyle = '#2e3426'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * w * 0.25, h * 0.18);
      ctx.quadraticCurveTo(s * w * 0.48, h * 0.3 + Math.sin(t * 2 + s) * 10, s * w * 0.62, h * 0.5 + Math.sin(t * 1.6 + s) * 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * w * 0.2, h * 0.24);
      ctx.quadraticCurveTo(s * w * 0.32, h * 0.5, s * w * 0.4 + Math.sin(t * 2.3) * 6, h * 0.72); ctx.stroke();
    }
    const open = fall ? 1 : Math.min(1, 0.1 + anger * 1.2 + (tele ? 0.6 : 0));
    eye(ctx, -w * 0.28, -h * 0.08, 9, open, Math.sin(t) * 2, anger > 0.4);
    eye(ctx, w * 0.28, -h * 0.08, 9, open, Math.sin(t) * 2, anger > 0.4);
  }

  function drawSpider(ctx, w, h, t, anger, fall, tele) {
    ctx.strokeStyle = '#4a3424'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const a = -0.8 + k * 0.5, len = w * 0.62;
      const kx = s * Math.cos(a) * len * 0.6, ky = Math.sin(a) * len * 0.5 - 12;
      ctx.beginPath(); ctx.moveTo(s * 18, -4 + k * 6); ctx.lineTo(kx, ky + Math.sin(t * 3 + k) * 3); ctx.lineTo(s * Math.cos(a) * len, Math.sin(a) * len * 0.7 + 18); ctx.stroke();
    }
    const grd = ctx.createRadialGradient(-10, -14, 4, 0, 0, w * 0.4);
    grd.addColorStop(0, '#9a6a44'); grd.addColorStop(1, '#4a2e1c');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.ellipse(0, 4, w * 0.38, h * 0.42, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#c99a5a';
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(0, 14 + k * 9, 14 - k * 3, 3, 0, 0, 7); ctx.fill(); }
    const open = fall ? 1 : 0.6 + anger * 0.4;
    for (const [x, y, r] of [[-13, -14, 7], [13, -14, 7], [-26, -6, 4], [26, -6, 4], [-6, -26, 3.5], [6, -26, 3.5]]) eye(ctx, x, y, r, open, 0, false);
    if (tele) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(0, h * 0.42, 6 + Math.sin(t * 30) * 2, 0, 7); ctx.fill(); }
  }

  function drawTsurube(ctx, w, h, t, anger, fall, tele) {
    // 大きな顔の妖怪（ちょんまげ）
    ctx.fillStyle = '#e8c9a0';
    ctx.beginPath(); ctx.ellipse(0, 4, w * 0.46, h * 0.5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.ellipse(0, -h * 0.42, w * 0.3, h * 0.16, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(-6, -h * 0.62, 12, 14);
    ctx.fillStyle = '#e0a090'; ctx.beginPath(); ctx.ellipse(-w * 0.3, h * 0.12, 12, 7, 0, 0, 7); ctx.ellipse(w * 0.3, h * 0.12, 12, 7, 0, 0, 7); ctx.fill();
    const open = fall ? 1 : 0.7 + anger * 0.3;
    eye(ctx, -w * 0.17, -h * 0.06, 11, open, Math.sin(t * 1.3) * 4, anger > 0.3);
    eye(ctx, w * 0.17, -h * 0.06, 11, open, Math.sin(t * 1.3) * 4, anger > 0.3);
    ctx.fillStyle = '#5a1e18';
    const mo = tele ? 10 : 4 + anger * 4;
    ctx.beginPath(); ctx.ellipse(0, h * 0.26, w * 0.18, mo, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-10, h * 0.26, 8, 5); ctx.fillRect(3, h * 0.26, 8, 5);
  }

  function drawKarakuri(ctx, w, h, t, anger, fall, tele) {
    ctx.fillStyle = '#9fa8b4'; rr(ctx, -w * 0.42, -h * 0.45, w * 0.84, h * 0.9, 10); ctx.fill();
    ctx.strokeStyle = '#4a5260'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#c2c9d2'; rr(ctx, -w * 0.36, -h * 0.4, w * 0.72, h * 0.3, 6); ctx.fill();
    ctx.fillStyle = '#5a6270';
    for (const [x, y] of [[-0.38, -0.4], [0.38, -0.4], [-0.38, 0.4], [0.38, 0.4]]) { ctx.beginPath(); ctx.arc(x * w, y * h, 3, 0, 7); ctx.fill(); }
    // 目（電球）
    const on = tele ? 1 : 0.5 + anger * 0.5;
    for (const s of [-1, 1]) {
      ctx.fillStyle = 'rgba(255,' + (200 - anger * 120) + ',80,' + on + ')';
      ctx.beginPath(); ctx.arc(s * w * 0.18, -h * 0.25, 11, 0, 7); ctx.fill();
      ctx.strokeStyle = '#3a404a'; ctx.lineWidth = 2; ctx.stroke();
    }
    // くちの 大砲
    ctx.fillStyle = '#3a404a'; rr(ctx, -16, h * 0.08, 32, 16, 4); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, h * 0.16, 6, 0, 7); ctx.fill();
    // むねの メーター
    ctx.fillStyle = '#e8eef4'; ctx.beginPath(); ctx.arc(0, h * 0.34, 10, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#d0402a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, h * 0.34); ctx.lineTo(Math.cos(Math.PI + 0.5 + anger * 2) * 9, h * 0.34 + Math.sin(Math.PI + 0.5 + anger * 2) * 9); ctx.stroke();
    // ゼンマイ
    ctx.save(); ctx.translate(w * 0.42, -h * 0.05); ctx.rotate(t * (1 + anger * 3));
    ctx.fillStyle = '#d8b84a'; ctx.fillRect(-2, -3, 18, 6);
    ctx.beginPath(); ctx.ellipse(18, 0, 6, 10, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#4a5260'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -h * 0.45); ctx.lineTo(0, -h * 0.62); ctx.stroke();
    ctx.fillStyle = '#ff6a5a'; ctx.beginPath(); ctx.arc(0, -h * 0.64, 5, 0, 7); ctx.fill();
  }

  function drawNekko(ctx, w, h, t, anger, fall, tele) {
    ctx.strokeStyle = '#5e4326'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      ctx.beginPath(); ctx.moveTo(-w * 0.4 + k * w * 0.16, -h * 0.45);
      ctx.bezierCurveTo(-w * 0.5 + k * w * 0.2, 0, -w * 0.3 + k * w * 0.13 + Math.sin(t + k) * 4, h * 0.3, -w * 0.38 + k * w * 0.15, h * 0.55); ctx.stroke();
    }
    const grd = ctx.createRadialGradient(0, -6, 6, 0, 0, w * 0.4);
    grd.addColorStop(0, '#a37a48'); grd.addColorStop(1, '#5a3e22');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.34, h * 0.42, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(40,26,12,0.5)'; ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(0, 0, w * 0.1 + k * 9, h * 0.1 + k * 6, 0, 0.3, 2.8); ctx.stroke(); }
    ctx.fillStyle = '#86c060';
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(-w * 0.3 + k * w * 0.15, -h * 0.4 + Math.sin(k) * 4, 7, 3.5, k - 2, 0, 7); ctx.fill(); }
    const open = fall ? 1 : 0.5 + anger * 0.5;
    ctx.fillStyle = 'rgba(255,240,170,' + (0.6 + 0.4 * open) + ')';
    ctx.beginPath(); ctx.ellipse(-18, -4, 7, 5 * open, 0, 0, 7); ctx.ellipse(18, -4, 7, 5 * open, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a1a0c'; ctx.beginPath(); ctx.ellipse(0, 18, 12, tele ? 8 : 4, 0, 0, Math.PI); ctx.fill();
  }

  // ------------------------------------------------------------------
  // カエル（アオ）と玉
  function drawFrog(ctx, f, x, y, t, st) {
    // y = 頭のてっぺん（はね返る面）
    st = st || {};
    const sq = st.squash || 0;
    ctx.save();
    ctx.translate(x, y);
    // ハスの葉
    ctx.fillStyle = '#2f7a3c';
    ctx.beginPath(); ctx.ellipse(0, 40, 66, 12, 0, 0.15, Math.PI * 2 - 0.15); ctx.lineTo(0, 40); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4fa45a'; ctx.lineWidth = 1.5;
    for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(k * 18, 40 + (Math.abs(k) < 3 ? 9 : 4)); ctx.stroke(); }
    ctx.scale(1 + sq * 0.12, 1 - sq * 0.14);
    ctx.translate(0, sq * 4);
    const stun = st.stun > 0;
    // 体
    const body = ctx.createLinearGradient(0, 0, 0, 44);
    body.addColorStop(0, '#7fd05a'); body.addColorStop(1, '#4e9c3a');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 22, 50, 22, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f2f0c4'; ctx.beginPath(); ctx.ellipse(0, 30, 30, 12, 0, 0, 7); ctx.fill();
    // 手
    ctx.fillStyle = '#5fae44';
    ctx.beginPath(); ctx.ellipse(-30, 38, 9, 5, 0.2, 0, 7); ctx.ellipse(30, 38, 9, 5, -0.2, 0, 7); ctx.fill();
    // 目
    const lx = st.lookX || 0, ly = st.lookY || 0;
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#7fd05a'; ctx.beginPath(); ctx.arc(s * 24, 6, 15, 0, 7); ctx.fill();
      ctx.fillStyle = '#fffef4'; ctx.beginPath(); ctx.arc(s * 24, 5, 11, 0, 7); ctx.fill();
      if (stun) {
        ctx.strokeStyle = '#1a2a14'; ctx.lineWidth = 2;
        ctx.beginPath(); for (let a = 0; a < 9; a += 0.4) ctx.lineTo(s * 24 + Math.cos(a + t * 8) * a * 0.9, 5 + Math.sin(a + t * 8) * a * 0.9); ctx.stroke();
      } else if (st.blink) {
        ctx.strokeStyle = '#1a2a14'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(s * 24 - 8, 6); ctx.lineTo(s * 24 + 8, 6); ctx.stroke();
      } else {
        ctx.fillStyle = '#16200f'; ctx.beginPath(); ctx.ellipse(s * 24 + lx * 4, 5 + ly * 4, 5.5, 6.5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 24 + lx * 4 - 2, 2 + ly * 4, 2, 0, 7); ctx.fill();
      }
    }
    // ほっぺ
    const puff = st.holding ? 1 : 0;
    ctx.fillStyle = 'rgba(255,140,150,0.55)';
    ctx.beginPath(); ctx.ellipse(-34, 22, 7 + puff * 4, 4 + puff * 3, 0, 0, 7); ctx.ellipse(34, 22, 7 + puff * 4, 4 + puff * 3, 0, 0, 7); ctx.fill();
    // くち
    ctx.strokeStyle = '#1f3a16'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    if (st.holding) { ctx.ellipse(0, 18, 9, 6, 0, 0, 7); }
    else if (st.happy) { ctx.arc(0, 12, 16, 0.25, Math.PI - 0.25); }
    else { ctx.moveTo(-20, 17); ctx.quadraticCurveTo(0, 25, 20, 17); }
    ctx.stroke();
    if (stun) {
      for (let k = 0; k < 3; k++) {
        const a = t * 6 + k * 2.1;
        drawStar(ctx, Math.cos(a) * 34, -14 + Math.sin(a) * 6, 5, '#ffe36a');
      }
    }
    if (st.slow > 0) {
      ctx.strokeStyle = 'rgba(240,240,255,0.7)'; ctx.lineWidth = 1;
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-44 + k * 16, 0); ctx.lineTo(-30 + k * 12, 40); ctx.stroke(); }
    }
    ctx.restore();
  }

  function drawStar(ctx, x, y, r, col) {
    ctx.fillStyle = col; ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, rr2 = k % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
    ctx.closePath(); ctx.fill();
  }

  function drawTongue(ctx, x0, y0, x1, y1, k) {
    ctx.strokeStyle = '#ff7f96'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k); ctx.stroke();
    ctx.fillStyle = '#ff5f7e'; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, 6, 0, 7); ctx.fill();
  }

  function drawBall(ctx, b, x, y, lv, t, main) {
    if (main && lv >= 1) {
      const col = lv >= 2 ? 'rgba(255,120,40,' : 'rgba(255,220,90,';
      const ox = x - b.x, oy = y - b.y;   // あとは 世界座標で記録している
      for (let k = 0; k < b.trail.length; k++) {
        const p = b.trail[k], a = (k + 1) / b.trail.length;
        ctx.fillStyle = col + (a * (lv >= 2 ? 0.45 : 0.25)) + ')';
        ctx.beginPath(); ctx.arc(p[0] + ox, p[1] + oy, BALL_R * (0.5 + a * 0.6), 0, 7); ctx.fill();
      }
      ctx.fillStyle = col + '0.35)'; ctx.beginPath(); ctx.arc(x, y, BALL_R + 6 + Math.sin(t * 20) * 1.5, 0, 7); ctx.fill();
    }
    if (main) {
      const grd = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, BALL_R);
      if (lv >= 2) { grd.addColorStop(0, '#fffbe8'); grd.addColorStop(1, '#ff8a3c'); }
      else if (lv >= 1) { grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#f2c24e'); }
      else { grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#a9b2bc'); }
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, BALL_R, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2; ctx.stroke();
    } else {
      const grd = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, BALL_R);
      grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.5, 'rgba(160,230,255,0.9)'); grd.addColorStop(1, 'rgba(60,140,220,0.9)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, BALL_R, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,110,180,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 4, t * 3, t * 3 + 2); ctx.stroke();
    }
  }

  // 水
  function drawWater(ctx, layer, t, ox) {
    const P = PAL[layer];
    const y0 = WATER_Y;
    const grd = ctx.createLinearGradient(0, y0, 0, 720);
    grd.addColorStop(0, rgba(P.water0, 0.85)); grd.addColorStop(1, rgba(P.water1, 0.95));
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.moveTo(ox, 720);
    for (let x = 0; x <= 640; x += 16) ctx.lineTo(ox + x, y0 + Math.sin(t * 2 + x * 0.04) * 2 + Math.sin(t * 3.3 + x * 0.09) * 1.2);
    ctx.lineTo(ox + 640, 720); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba(P.rim, 0.6); ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= 640; x += 16) ctx.lineTo(ox + x, y0 + Math.sin(t * 2 + x * 0.04) * 2 + Math.sin(t * 3.3 + x * 0.09) * 1.2);
    ctx.stroke();
    ctx.fillStyle = rgba(P.rim, 0.25);
    for (let k = 0; k < 10; k++) {
      const x = (k * 71 + t * 20 * (k % 2 ? 1 : -1)) % 640;
      ctx.fillRect(ox + (x + 640) % 640, y0 + 12 + (k % 4) * 10, 18, 2);
    }
    for (const r of FX.ripples) {
      const a = 1 - r.t / 1.2;
      ctx.strokeStyle = rgba(P.rim, a * 0.7); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(ox + r.x, y0 + 2, 10 + r.t * 60 * r.size, 3 + r.t * 7 * r.size, 0, 0, 7); ctx.stroke();
    }
  }

  // ねらい線
  function drawAim(ctx, w, ai, t, ox, oy, layer) {
    if (!ai) return;
    const P = PAL[layer];
    if (ai.land !== null && ai.land !== undefined) {
      const col = ai.onPad ? '255,255,255' : '255,170,90';
      const pulse = 0.5 + 0.5 * Math.sin(t * 10);
      const x = ox + ai.land, y = oy + PAD_Y - 4;
      ctx.fillStyle = 'rgba(' + col + ',0.95)';
      ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x - 9, y - 10); ctx.lineTo(x + 9, y - 10); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(' + col + ',' + (0.35 + 0.35 * pulse) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, oy + WATER_Y + 3, 14 + pulse * 4, 4, 0, 0, 7); ctx.stroke();
    }
    if (!ai.pts) return;
    // 落ちる かたまり
    if (ai.falling && ai.falling.length) {
      const pulse = 0.25 + 0.2 * Math.sin(t * 10);
      let sx = 0, sy = 0;
      for (const i of ai.falling) {
        const c = i % COLS, r = (i / COLS) | 0;
        const jx = Math.sin(t * 40 + i) * 1.2;
        ctx.fillStyle = 'rgba(255,236,140,' + pulse + ')';
        ctx.fillRect(ox + c * CELL + jx, oy + r * CELL, CELL, CELL);
        sx += c * CELL + 16; sy += r * CELL + 16;
      }
      ctx.strokeStyle = 'rgba(255,240,170,0.9)'; ctx.lineWidth = 2;
      for (const i of ai.falling) {
        const c = i % COLS, r = (i / COLS) | 0;
        const g = w.g;
        const x = ox + c * CELL, y = oy + r * CELL;
        ctx.beginPath();
        if (r === 0 || ai.falling.indexOf(i - COLS) < 0) { ctx.moveTo(x, y); ctx.lineTo(x + CELL, y); }
        if (ai.falling.indexOf(i + COLS) < 0) { ctx.moveTo(x, y + CELL); ctx.lineTo(x + CELL, y + CELL); }
        if (ai.falling.indexOf(i - 1) < 0) { ctx.moveTo(x, y); ctx.lineTo(x, y + CELL); }
        if (ai.falling.indexOf(i + 1) < 0) { ctx.moveTo(x + CELL, y); ctx.lineTo(x + CELL, y + CELL); }
        ctx.stroke();
      }
      if (ai.falling.length >= 2) {
        const n = ai.falling.length;
        ctx.font = 'bold 17px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const lx = ox + sx / n, ly = oy + sy / n;
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText('がらっ ×' + n, lx, ly);
        ctx.fillStyle = '#fff2b0'; ctx.fillText('がらっ ×' + n, lx, ly);
      }
    }
    // 点線
    const pts = ai.pts;
    let acc = 0;
    const gap = 13;
    const col = ai.exit ? P.glow : (ai.falling && ai.falling.length) ? '#fff2b0' : '#ffffff';
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
      const L = Math.hypot(x1 - x0, y1 - y0);
      let d = (gap - (acc % gap)) % gap;
      while (d < L) {
        const x = x0 + (x1 - x0) * d / L, y = y0 + (y1 - y0) * d / L;
        const a = Math.max(0.15, 0.85 - (acc + d) / 900);
        ctx.fillStyle = rgba(col.length === 7 ? col : '#ffffff', a);
        ctx.beginPath(); ctx.arc(ox + x, oy + y, 2.4, 0, 7); ctx.fill();
        d += gap;
      }
      acc += L;
    }
    // 当たる場所
    if (ai.i !== undefined) {
      const c = ai.i % COLS, r = (ai.i / COLS) | 0;
      ctx.strokeStyle = ai.breaks ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(ox + c * CELL + 2, oy + r * CELL + 2, CELL - 4, CELL - 4);
    }
    if (ai.exit) {
      const p = pts[pts.length - 1];
      ctx.fillStyle = rgba(P.glow, 0.9); ctx.font = 'bold 22px ' + FONT; ctx.textAlign = 'center';
      ctx.fillText('↑', ox + p[0], oy + 30 + Math.sin(t * 8) * 3);
    }
  }

  // ------------------------------------------------------------------
  // おとしものの 絵
  function drawItem(ctx, id, x, y, s, t) {
    const k = s / 40;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    switch (id) {
      case 0: { // アンモナイト
        ctx.fillStyle = '#b8a07a'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
        ctx.strokeStyle = '#6e5a3c'; ctx.lineWidth = 2.5; ctx.beginPath();
        for (let a = 0; a < 15; a += 0.15) { const r = 15 * a / 15; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.stroke();
        ctx.lineWidth = 1.2; for (let a = 0; a < 6.2; a += 0.7) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); ctx.stroke(); }
        break;
      }
      case 1: { // 魚の化石
        ctx.fillStyle = '#a99c86'; ctx.beginPath(); ctx.ellipse(0, 0, 18, 13, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#4e4436'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(10, 0); ctx.moveTo(10, 0); ctx.lineTo(16, -6); ctx.moveTo(10, 0); ctx.lineTo(16, 6); ctx.stroke();
        for (let q = -8; q <= 6; q += 3.5) { ctx.beginPath(); ctx.moveTo(q, -6); ctx.lineTo(q + 2, 0); ctx.lineTo(q, 6); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(-11, -2, 1.8, 0, 7); ctx.stroke();
        break;
      }
      case 2: { // 水晶
        const cr = [[-7, 6, 0.3, 18], [0, 8, 0, 24], [8, 7, -0.35, 16]];
        for (const [cx, cy, a, h] of cr) {
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
          ctx.fillStyle = '#bff2ff'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-4, -h + 6); ctx.lineTo(0, -h); ctx.lineTo(4, -h + 6); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-3, -h + 6, 2, h - 8);
          ctx.strokeStyle = '#5ab4d0'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
        }
        break;
      }
      case 3: { // 要石
        ctx.fillStyle = '#8f8a80'; rr(ctx, -9, -16, 18, 32, 8); ctx.fill();
        ctx.strokeStyle = '#4a463e'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#e8dcae'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-11, -4); ctx.lineTo(11, -6); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-3, -5); ctx.lineTo(2, -5); ctx.lineTo(0, 6); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill();
        break;
      }
      case 4: { // 縄文土器のかけら
        ctx.fillStyle = '#c2763e'; ctx.beginPath(); ctx.moveTo(-16, -10); ctx.lineTo(12, -15); ctx.lineTo(17, 6); ctx.lineTo(4, 15); ctx.lineTo(-14, 10); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#7a4520'; ctx.lineWidth = 1.5;
        for (let q = -10; q <= 10; q += 5) { ctx.beginPath(); for (let x = -12; x <= 12; x += 3) ctx.lineTo(x, q + ((x / 3) % 2 ? 2 : -1)); ctx.stroke(); }
        break;
      }
      case 5: { // 勾玉
        ctx.fillStyle = '#4fbf7a';
        ctx.beginPath(); ctx.arc(-3, -4, 11, Math.PI * 0.5, Math.PI * 2.3); ctx.quadraticCurveTo(14, 12, 2, 16); ctx.quadraticCurveTo(-4, 10, -3, 7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(-7, -8, 3, 0, 7); ctx.fill();
        ctx.fillStyle = '#1b2a20'; ctx.beginPath(); ctx.arc(-3, -4, 3, 0, 7); ctx.fill();
        break;
      }
      case 6: { // 黒曜石のやじり
        ctx.fillStyle = '#26232e'; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(11, 10); ctx.lineTo(4, 7); ctx.lineTo(0, 16); ctx.lineTo(-4, 7); ctx.lineTo(-11, 10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(180,190,255,0.45)'; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(4, 0); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
        break;
      }
      case 7: { // 土偶
        ctx.fillStyle = '#b5774a';
        ctx.beginPath(); ctx.ellipse(0, -9, 12, 9, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-16, 4); ctx.lineTo(-12, 9); ctx.lineTo(-6, 6); ctx.lineTo(-8, 18); ctx.lineTo(8, 18); ctx.lineTo(6, 6); ctx.lineTo(12, 9); ctx.lineTo(16, 4); ctx.lineTo(6, -2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#6a3e1e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(-5, -9, 5, 3, 0, 0, 7); ctx.ellipse(5, -9, 5, 3, 0, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-7, -9); ctx.lineTo(-3, -9); ctx.moveTo(3, -9); ctx.lineTo(7, -9); ctx.stroke();
        break;
      }
      case 8: { // 寛永通宝
        ctx.fillStyle = '#9a7a3a'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
        ctx.strokeStyle = '#5e4a20'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.stroke();
        ctx.fillStyle = '#2a2014'; ctx.fillRect(-4, -4, 8, 8);
        ctx.strokeStyle = '#4a3a18'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-2, -11); ctx.lineTo(2, -11); ctx.moveTo(0, -12); ctx.lineTo(0, -7); ctx.moveTo(-2, 8); ctx.lineTo(2, 11); ctx.moveTo(-11, -2); ctx.lineTo(-8, 2); ctx.moveTo(8, -2); ctx.lineTo(11, 2); ctx.stroke();
        break;
      }
      case 9: { // かんざし
        ctx.strokeStyle = '#c8a050'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, 16); ctx.lineTo(8, -8); ctx.stroke();
        for (let a = 0; a < 5; a++) { ctx.fillStyle = '#ff9ab8'; ctx.beginPath(); ctx.ellipse(10 + Math.cos(a * 1.26) * 6, -10 + Math.sin(a * 1.26) * 6, 5, 3.5, a * 1.26, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(10, -10, 3, 0, 7); ctx.fill();
        ctx.strokeStyle = '#d8b860'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(2, 10); ctx.stroke(); ctx.fillStyle = '#ff6a8a'; ctx.beginPath(); ctx.arc(2, 12, 2.5, 0, 7); ctx.fill();
        break;
      }
      case 10: { // 鈴
        ctx.strokeStyle = '#c34a3a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, -15, 4, 0, 7); ctx.stroke();
        const grd = ctx.createRadialGradient(-5, -5, 2, 0, 0, 15); grd.addColorStop(0, '#fff2b0'); grd.addColorStop(1, '#c99a2a');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 1, 14, 0, 7); ctx.fill();
        ctx.strokeStyle = '#6a4a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, 3); ctx.lineTo(9, 3); ctx.stroke();
        ctx.fillStyle = '#3a2808'; ctx.beginPath(); ctx.arc(0, 8, 2.5, 0, 7); ctx.fill(); ctx.fillRect(-1, 8, 2, 6);
        break;
      }
      case 11: { // お守り
        ctx.fillStyle = '#c8323a'; rr(ctx, -11, -12, 22, 28, 4); ctx.fill();
        ctx.strokeStyle = '#f0c040'; ctx.lineWidth = 1.5; ctx.strokeRect(-8, -6, 16, 19);
        ctx.strokeStyle = '#f0c040'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -15, 4, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = '#fff4d0'; ctx.font = 'bold 13px ' + FONT_SOFT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('水', 0, 4);
        break;
      }
      case 12: { // ビー玉
        const grd = ctx.createRadialGradient(-5, -6, 2, 0, 0, 15); grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.5, 'rgba(190,240,255,0.95)'); grd.addColorStop(1, 'rgba(90,170,230,0.95)');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
        ctx.strokeStyle = '#2f7fd0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-9, 6); ctx.bezierCurveTo(-3, -6, 4, 8, 9, -6); ctx.stroke();
        break;
      }
      case 13: { // めんこ
        ctx.fillStyle = '#f2d24a'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
        ctx.strokeStyle = '#c0382a'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#f4d0b0'; ctx.beginPath(); ctx.arc(0, -1, 8, 0, 7); ctx.fill();
        ctx.fillStyle = '#2a2a3a'; ctx.beginPath(); ctx.arc(0, -4, 8, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#c0382a'; ctx.fillRect(-9, -6, 18, 3);
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-3, 0, 1.3, 0, 7); ctx.arc(3, 0, 1.3, 0, 7); ctx.fill();
        break;
      }
      case 14: { // ラムネのびん
        ctx.fillStyle = 'rgba(120,220,200,0.85)';
        ctx.beginPath(); ctx.moveTo(-8, 18); ctx.lineTo(-8, 0); ctx.quadraticCurveTo(-8, -6, -4, -8); ctx.lineTo(-5, -12); ctx.quadraticCurveTo(-5, -16, -3, -18); ctx.lineTo(3, -18); ctx.quadraticCurveTo(5, -16, 5, -12); ctx.lineTo(4, -8); ctx.quadraticCurveTo(8, -6, 8, 0); ctx.lineTo(8, 18); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(40,120,110,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(0, -10, 3.5, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-6, 0, 2, 15);
        break;
      }
      case 15: { // ゼンマイのかぎ
        ctx.fillStyle = '#d8b84a';
        ctx.beginPath(); ctx.ellipse(-8, -6, 8, 11, -0.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(8, -6, 8, 11, 0.5, 0, 7); ctx.fill();
        ctx.fillRect(-3, -2, 6, 20);
        ctx.fillStyle = '#8a6a1a'; ctx.beginPath(); ctx.ellipse(-8, -6, 3, 5, -0.5, 0, 7); ctx.ellipse(8, -6, 3, 5, 0.5, 0, 7); ctx.fill();
        break;
      }
      case 16: { // 十円玉
        const grd = ctx.createRadialGradient(-5, -5, 2, 0, 0, 16); grd.addColorStop(0, '#f0a878'); grd.addColorStop(1, '#a8582e');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
        ctx.strokeStyle = '#7a3a1a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.stroke();
        ctx.fillStyle = '#7a3a1a'; ctx.beginPath(); ctx.moveTo(-9, -1); ctx.lineTo(0, -7); ctx.lineTo(9, -1); ctx.closePath(); ctx.fill();
        ctx.fillRect(-7, -1, 14, 2); ctx.fillRect(-5, 1, 2, 6); ctx.fillRect(3, 1, 2, 6); ctx.fillRect(-8, 7, 16, 2);
        break;
      }
      case 17: { // じてんしゃの カギ
        ctx.fillStyle = '#c8ccd4'; ctx.beginPath(); ctx.arc(-7, -7, 9, 0, 7); ctx.fill();
        ctx.fillStyle = '#333a44'; ctx.beginPath(); ctx.arc(-7, -7, 3, 0, 7); ctx.fill();
        ctx.fillStyle = '#c8ccd4'; ctx.save(); ctx.rotate(0.78); ctx.fillRect(-2, 2, 6, 20); ctx.fillRect(4, 14, 4, 3); ctx.fillRect(4, 19, 3, 3); ctx.restore();
        ctx.fillStyle = '#e04a4a'; ctx.beginPath(); ctx.arc(-13, -13, 3, 0, 7); ctx.fill();
        break;
      }
      case 18: { // てがみ
        ctx.fillStyle = '#f4ecd8'; ctx.save(); ctx.rotate(-0.1); rr(ctx, -16, -11, 32, 22, 2); ctx.fill();
        ctx.strokeStyle = '#a89870'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-16, -11); ctx.lineTo(0, 2); ctx.lineTo(16, -11); ctx.stroke();
        ctx.fillStyle = '#e05a6a'; ctx.beginPath(); ctx.arc(0, 3, 3.5, 0, 7); ctx.fill(); ctx.restore();
        break;
      }
      case 19: { // どんぐり
        ctx.fillStyle = '#a8662e'; ctx.beginPath(); ctx.ellipse(0, 4, 10, 13, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(-4, 2, 3, 6, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#7a5a34'; ctx.beginPath(); ctx.ellipse(0, -7, 12, 7, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-12, -8, 24, 4);
        ctx.strokeStyle = '#5a4022'; ctx.lineWidth = 1; for (let q = -10; q <= 10; q += 4) { ctx.beginPath(); ctx.moveTo(q, -12); ctx.lineTo(q + 2, -5); ctx.stroke(); }
        ctx.strokeStyle = '#5a4022'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(2, -18); ctx.stroke();
        break;
      }
      default:
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function itemSilhouette(ctx, x, y, s) {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(x, y, s * 0.4, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = 'bold ' + Math.round(s * 0.45) + 'px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('？', x, y + 1);
  }

  // 折り返しのある文字
  const KINSOKU = '。、，．」』）！？…ーぁぃぅぇぉっゃゅょ）';
  function wrapText(ctx, text, x, y, maxW, lh) {
    const lines = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const ch of para) {
        // 「。」「、」などは 行の頭に来ないよう、前の行に ぶらさげる
        if (ctx.measureText(line + ch).width > maxW && line && KINSOKU.indexOf(ch) < 0) { lines.push(line); line = ch; }
        else line += ch;
      }
      lines.push(line);
    }
    lines.forEach((l, k) => ctx.fillText(l, x, y + k * lh));
    return lines.length;
  }

  root.SKR = { PAL, FX0, FONT, FONT_SOFT, FX, drawWorld, drawFrog, drawBall, drawTongue, drawWater, drawAim, drawItem, itemSilhouette, drawStar, wrapText, rr, rgba, shade, background, tile, drawBucket, drawGuardian };
})(window);
