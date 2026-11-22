// ずらり、砦くずし — 絵（Canvas 2D だけで描く。外部素材なし）
(function (root) {
  'use strict';
  const V = {};
  V.SERIF = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","BIZ UDPMincho","MS PMincho",serif';
  V.SANS = '"Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo","BIZ UDPGothic",sans-serif';
  V.font = (px, w, serif) => `${w || 600} ${px}px ${serif ? V.SERIF : V.SANS}`;

  V.SRC_COL = { sword: '#cfd9e6', fire: '#ff7b3a', ice: '#86dcff', bolt: '#ffd84a', light: '#fff1a8' };
  V.SRC_DARK = { sword: '#56657a', fire: '#8a2a10', ice: '#1d5f86', bolt: '#7a5a08', light: '#8a7420' };
  V.ROLE_COL = { src: '#e7c48a', shape: '#9fb4ff', pow: '#f0c75a', echo: '#c9a2ff' };

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  V.rr = rr;
  V.text = function (ctx, s, x, y, o) {
    o = o || {};
    ctx.font = o.font || V.font(o.size || 16, o.weight, o.serif);
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'middle';
    if (o.stroke) { ctx.lineWidth = o.sw || 4; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(s, x, y);
  };
  // 折り返し（日本語は1文字ずつ測る）
  V.wrap = function (ctx, s, maxW) {
    const out = [];
    for (const para of String(s).split('\n')) {
      let line = '';
      for (const ch of para) {
        if (ctx.measureText(line + ch).width > maxW && line) {
          if ('、。」）！？'.indexOf(ch) >= 0) { line += ch; continue; }
          out.push(line); line = ch;
        } else line += ch;
      }
      out.push(line);
    }
    return out;
  };
  V.para = function (ctx, s, x, y, maxW, o) {
    o = o || {};
    ctx.font = o.font || V.font(o.size || 16, o.weight || 500, o.serif);
    const lines = V.wrap(ctx, s, maxW);
    const lh = o.lh || (o.size || 16) * 1.55;
    lines.forEach((l, i) => V.text(ctx, l, x, y + i * lh, Object.assign({}, o, { base: 'top' })));
    return lines.length * lh;
  };

  // ---------- 羊皮紙の枠 ----------
  V.panel = function (ctx, x, y, w, h, o) {
    o = o || {};
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    rr(ctx, x, y, w, h, o.r || 14);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (o.dark) { g.addColorStop(0, 'rgba(30,26,44,.94)'); g.addColorStop(1, 'rgba(18,15,28,.96)'); }
    else { g.addColorStop(0, '#f6ead0'); g.addColorStop(1, '#e8d4ad'); }
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, o.r || 14);
    ctx.lineWidth = 2; ctx.strokeStyle = o.dark ? 'rgba(214,186,120,.55)' : '#9b7a46'; ctx.stroke();
    if (!o.dark) { rr(ctx, x + 5, y + 5, w - 10, h - 10, (o.r || 14) - 4); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(155,122,70,.45)'; ctx.stroke(); }
  };

  V.button = function (ctx, b, t) {
    const hot = b.hot && !b.disabled;
    const x = b.x, y = b.y, w = b.w, h = b.h;
    ctx.save();
    const press = hot ? -1 : 0;
    rr(ctx, x, y + press, w, h, b.r || 10);
    let c1 = '#5b4a7e', c2 = '#3a2f56', edge = '#d9b96b', fg = '#fff6df';
    if (b.kind === 'main') { c1 = '#ffcf6a'; c2 = '#e08a2a'; edge = '#fff1c0'; fg = '#3a1d05'; }
    if (b.kind === 'light') { c1 = '#fbf2dc'; c2 = '#e6d3ab'; edge = '#9b7a46'; fg = '#3b2a14'; }
    if (b.kind === 'ghost') { c1 = 'rgba(40,34,60,.75)'; c2 = 'rgba(25,20,40,.8)'; edge = 'rgba(217,185,107,.6)'; }
    if (b.kind === 'red') { c1 = '#d45a4a'; c2 = '#8e2a26'; edge = '#ffd0c0'; }
    if (b.disabled) { c1 = '#4a4558'; c2 = '#353042'; edge = '#6b6478'; fg = '#9e98ab'; }
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    if (hot) { ctx.shadowColor = b.kind === 'main' ? 'rgba(255,200,90,.8)' : 'rgba(255,230,160,.45)'; ctx.shadowBlur = 16; }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = b.glow ? 3 : 1.6;
    ctx.strokeStyle = b.glow ? `rgba(255,236,150,${0.6 + 0.4 * Math.sin(t * 6)})` : edge;
    ctx.stroke();
    if (b.glow) {
      ctx.shadowColor = '#ffe27a'; ctx.shadowBlur = 14 + 8 * Math.sin(t * 6);
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    if (b.draw) b.draw(ctx, x, y + press, w, h, fg);
    else {
      V.text(ctx, b.label, x + w / 2, y + h / 2 + press + 1, { align: 'center', size: b.size || 18, weight: 700, color: fg, serif: b.serif });
      if (b.sub) V.text(ctx, b.sub, x + w / 2, y + h - 11 + press, { align: 'center', size: 11, weight: 500, color: fg });
    }
    ctx.restore();
  };

  // ---------- 言葉（リールのコマ） ----------
  // w: {k, lv, nw}, opts: {dim, hot, small, glow}
  V.word = function (ctx, ZW, w, x, y, ww, hh, o) {
    o = o || {};
    const d = ZW[w.k];
    const role = d.role;
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (d.blank) {
      rr(ctx, x + 3, y + 3, ww - 6, hh - 6, 10);
      ctx.fillStyle = 'rgba(10,8,18,.35)'; ctx.fill();
      ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(220,200,160,.35)'; ctx.stroke(); ctx.setLineDash([]);
      if (w.k === 'gap') V.text(ctx, '空き', x + ww / 2, y + hh / 2, { align: 'center', size: o.small ? 11 : 14, weight: 500, color: 'rgba(230,215,180,.45)' });
      else V.text(ctx, '・', x + ww / 2, y + hh / 2, { align: 'center', size: o.small ? 14 : 20, weight: 500, color: 'rgba(230,215,180,.4)' });
      ctx.restore();
      return;
    }
    rr(ctx, x + 3, y + 3, ww - 6, hh - 6, 10);
    let g = ctx.createLinearGradient(0, y, 0, y + hh);
    let glyphCol = '#fff', sub = '#fff';
    if (role === 'src') {
      const c = V.SRC_COL[w.k], dk = V.SRC_DARK[w.k];
      g.addColorStop(0, shade(c, 0.15)); g.addColorStop(1, dk);
      glyphCol = '#fff'; sub = '#fff7e6';
    } else if (role === 'shape') {
      g.addColorStop(0, '#5662c4'); g.addColorStop(1, '#262a6e');
      glyphCol = '#eef1ff';
    } else if (role === 'pow') {
      g.addColorStop(0, '#f6d27a'); g.addColorStop(1, '#9b6a1a');
      glyphCol = '#3a2205'; sub = '#3a2205';
    } else {
      g.addColorStop(0, '#9e74d8'); g.addColorStop(1, '#3e2470');
      glyphCol = '#fbf3ff';
    }
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = o.hot ? 3 : 1.5;
    ctx.strokeStyle = o.hot ? '#ffe9a0' : 'rgba(255,255,255,.45)';
    ctx.stroke();
    // 小さな絵
    const cx = x + ww / 2, cy = y + hh * (o.small ? 0.47 : 0.42);
    if (role === 'shape') V.shapeIcon(ctx, w.k, cx, cy, Math.min(ww, hh) * (o.small ? 0.28 : 0.3), 'rgba(255,255,255,.18)');
    if (role === 'src') V.srcIcon(ctx, w.k, cx, cy, Math.min(ww, hh) * 0.32, 'rgba(255,255,255,.22)');
    const gs = o.small ? Math.min(ww, hh) * 0.42 : Math.min(ww * 0.5, hh * 0.42);
    V.text(ctx, d.glyph, cx, cy, { align: 'center', size: Math.round(gs), weight: 800, serif: role !== 'pow', color: glyphCol, stroke: role === 'pow' ? 'rgba(255,240,200,.6)' : 'rgba(0,0,0,.35)', sw: 3 });
    if (!o.small) V.text(ctx, d.name, cx, y + hh - 16, { align: 'center', size: 12, weight: 700, color: sub });
    if (role === 'src') {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(x + 14 + i * 9, y + 14, 3, 0, Math.PI * 2);
        ctx.fillStyle = i < w.lv ? '#fff7c4' : 'rgba(0,0,0,.3)'; ctx.fill();
      }
    }
    if (w.nw && !o.noNew) {
      rr(ctx, x + ww - 30, y + 6, 24, 18, 6); ctx.fillStyle = '#ff5a6e'; ctx.fill();
      V.text(ctx, '新', x + ww - 18, y + 15.5, { align: 'center', size: 12, weight: 800, color: '#fff' });
    }
    ctx.restore();
  };
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.min(255, Math.round(r + (255 - r) * k)); g = Math.min(255, Math.round(g + (255 - g) * k)); b = Math.min(255, Math.round(b + (255 - b) * k));
    return `rgb(${r},${g},${b})`;
  }
  V.shade = shade;

  V.srcIcon = function (ctx, k, cx, cy, r, col) {
    ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3;
    if (k === 'sword') { ctx.beginPath(); ctx.moveTo(cx - r, cy + r); ctx.lineTo(cx + r, cy - r); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy + r * 0.1); ctx.lineTo(cx - r * 0.1, cy + r * 0.6); ctx.stroke(); }
    else if (k === 'fire') { ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.quadraticCurveTo(cx + r, cy, cx, cy + r); ctx.quadraticCurveTo(cx - r, cy, cx, cy - r); ctx.fill(); }
    else if (k === 'ice') { for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); } }
    else if (k === 'bolt') { ctx.beginPath(); ctx.moveTo(cx + r * 0.3, cy - r); ctx.lineTo(cx - r * 0.4, cy + r * 0.1); ctx.lineTo(cx + r * 0.1, cy + r * 0.1); ctx.lineTo(cx - r * 0.3, cy + r); ctx.stroke(); }
    else if (k === 'light') { ctx.beginPath(); ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2); ctx.fill(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.65, cy + Math.sin(a) * r * 0.65); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); } }
    ctx.restore();
  };
  // 形の小さな図（3×3 の盤で、どこに当たるか）
  V.shapeIcon = function (ctx, k, cx, cy, r, col) {
    ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2;
    const s = r * 0.62;
    const cell = (i, j) => { ctx.fillRect(cx - r + i * s * 1.1, cy - r + j * s * 1.1, s, s); };
    if (k === 'point') cell(0, 1);
    else if (k === 'lance') { cell(0, 1); cell(1, 1); cell(2, 1); }
    else if (k === 'sweep') { cell(0, 0); cell(0, 1); cell(0, 2); }
    else if (k === 'burst') { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cell(i, j); }
    else if (k === 'storm') { ctx.beginPath(); ctx.arc(cx, cy, r, 0.3, Math.PI * 1.7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 1.2, Math.PI * 2.4); ctx.stroke(); }
    ctx.restore();
  };

  // ---------- 背景 ----------
  V.SKY = {
    watch: ['#f6c58a', '#f3a77a', '#7c6aa0'], river: ['#bfe3f0', '#8fc3de', '#5a6f9e'], forest: ['#b9d6a6', '#6f9a78', '#30455a'],
    hill: ['#f1e2b0', '#d7b07a', '#7a6390'], iron: ['#d9a58a', '#a86b5c', '#40304a'], citadel: ['#6f5a9a', '#3c2d63', '#120c22'],
    army: ['#5a3c7a', '#2c1c4a', '#0c0818'], practice: ['#f8e7c0', '#e9c993', '#9a7aa0'], camp: ['#f7d9a0', '#efb27e', '#8f78b0'],
  };
  V.GROUND = {
    watch: ['#8fae6a', '#6e8f50'], river: ['#86b07c', '#5f8a64'], forest: ['#5f7f4e', '#3e5a3c'], hill: ['#b1b06c', '#8a8a52'],
    iron: ['#8a7466', '#5e4d48'], citadel: ['#4d455c', '#2e2a3c'], army: ['#3e3550', '#221d30'], practice: ['#a8b878', '#8a9a5e'], camp: ['#9db86e', '#7d9a52'],
  };
  V.background = function (ctx, id, t, o) {
    o = o || {};
    const W = 1280, H = 720;
    const sky = V.SKY[id] || V.SKY.watch, gr = V.GROUND[id] || V.GROUND.watch;
    const lit = o.lit !== undefined ? o.lit : 1; // 1=晴れ 0=魔の雲
    let g = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    g.addColorStop(0, sky[2]); g.addColorStop(0.55, sky[1]); g.addColorStop(1, sky[0]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 太陽 or 月
    if (id === 'citadel' || id === 'army') {
      ctx.fillStyle = 'rgba(255,240,220,.85)'; ctx.beginPath(); ctx.arc(300, 70, 26, 0, Math.PI * 2); ctx.fill();
    } else {
      const sg = ctx.createRadialGradient(360, 80, 4, 360, 80, 120);
      sg.addColorStop(0, 'rgba(255,250,220,.95)'); sg.addColorStop(0.2, 'rgba(255,236,180,.5)'); sg.addColorStop(1, 'rgba(255,236,180,0)');
      ctx.fillStyle = sg; ctx.fillRect(220, 0, 300, 220);
    }
    // 遠い山
    ctx.fillStyle = shadeA(sky[2], 0.55);
    ctx.beginPath(); ctx.moveTo(0, 150);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 118 + 22 * Math.sin(x * 0.011 + (id.length)) + 12 * Math.sin(x * 0.031));
    ctx.lineTo(W, 160); ctx.lineTo(0, 160); ctx.fill();
    // 地面
    g = ctx.createLinearGradient(0, 120, 0, H);
    g.addColorStop(0, gr[0]); g.addColorStop(1, gr[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 128, W, H - 128);
    // 雲
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 311 + t * 6) % (W + 300)) - 150, cy = 40 + (i * 37) % 60;
      cloud(ctx, cx, cy, 40 + (i % 3) * 14);
    }
    scenery(ctx, id, t);
    // 魔の雲（砦側）
    if (lit < 1) {
      const a = (1 - lit);
      const dg = ctx.createLinearGradient(560, 0, W, 0);
      dg.addColorStop(0, 'rgba(30,10,50,0)'); dg.addColorStop(0.5, `rgba(40,14,64,${0.35 * a})`); dg.addColorStop(1, `rgba(28,8,44,${0.7 * a})`);
      ctx.fillStyle = dg; ctx.fillRect(560, 0, W - 560, H);
      ctx.fillStyle = `rgba(60,20,80,${0.55 * a})`;
      for (let i = 0; i < 6; i++) cloud(ctx, 760 + i * 95 + Math.sin(t * 0.6 + i) * 10, 40 + (i % 2) * 26, 46);
    }
  };
  // 砦ごとの遠景（地平線の上の小さな景色）
  function scenery(ctx, id, t) {
    ctx.save();
    if (id === 'river' || id === 'watch') {
      ctx.fillStyle = id === 'river' ? 'rgba(120,180,220,.55)' : 'rgba(150,170,140,.35)';
      ctx.beginPath(); ctx.moveTo(0, 136); ctx.quadraticCurveTo(400, 124, 800, 138); ctx.quadraticCurveTo(1050, 146, 1280, 132); ctx.lineTo(1280, 146); ctx.lineTo(0, 146); ctx.fill();
      if (id === 'river') { ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.5; for (let i = 0; i < 8; i++) { const x = (i * 170 + t * 12) % 1300 - 20; ctx.beginPath(); ctx.moveTo(x, 140); ctx.lineTo(x + 26, 140); ctx.stroke(); } }
    }
    if (id === 'forest') {
      ctx.fillStyle = 'rgba(30,50,36,.85)';
      for (let i = 0; i < 26; i++) { const x = i * 52 + (i % 3) * 9, h = 34 + (i % 4) * 10; ctx.beginPath(); ctx.moveTo(x - 16, 142); ctx.lineTo(x, 142 - h); ctx.lineTo(x + 16, 142); ctx.fill(); }
    }
    if (id === 'hill') {
      ctx.fillStyle = 'rgba(120,96,70,.6)';
      ctx.beginPath(); ctx.moveTo(0, 142); ctx.quadraticCurveTo(300, 96, 640, 132); ctx.quadraticCurveTo(900, 104, 1280, 140); ctx.lineTo(1280, 146); ctx.lineTo(0, 146); ctx.fill();
      for (const [x, y] of [[300, 106], [920, 112]]) {
        ctx.fillStyle = 'rgba(90,70,50,.9)'; ctx.fillRect(x - 4, y, 8, 26);
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.8 + x); ctx.strokeStyle = 'rgba(240,230,210,.85)'; ctx.lineWidth = 3;
        for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -18); ctx.stroke(); }
        ctx.restore();
      }
    }
    if (id === 'iron') {
      for (let i = 0; i < 5; i++) {
        const x = 140 + i * 240, h = 30 + (i % 2) * 14;
        ctx.fillStyle = 'rgba(60,40,36,.9)'; ctx.fillRect(x, 142 - h, 14, h);
        ctx.fillStyle = 'rgba(80,70,70,.35)';
        for (let k = 0; k < 4; k++) { const r = 8 + k * 5, yy = 142 - h - 8 - k * 14 - (t * 10 + i * 7) % 14; ctx.beginPath(); ctx.arc(x + 7 + k * 6, yy, r, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    if (id === 'citadel' || id === 'army') {
      ctx.fillStyle = 'rgba(16,10,26,.9)';
      for (const [x, w, h] of [[760, 26, 70], [800, 40, 54], [850, 22, 86], [890, 48, 60], [948, 26, 76], [1000, 60, 48]]) {
        ctx.fillRect(x, 142 - h, w, h);
        ctx.beginPath(); ctx.moveTo(x - 4, 142 - h); ctx.lineTo(x + w / 2, 142 - h - 22); ctx.lineTo(x + w + 4, 142 - h); ctx.fill();
      }
      ctx.fillStyle = `rgba(200,60,255,${0.5 + 0.3 * Math.sin(t * 2)})`;
      for (const x of [812, 858, 905, 960]) ctx.fillRect(x, 108, 4, 6);
    }
    ctx.restore();
  }
  function shadeA(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
  }
  function cloud(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.arc(x + r * 0.6, y + 4, r * 0.5, 0, Math.PI * 2); ctx.arc(x - r * 0.6, y + 6, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }

  // 戦場の三本の道
  V.lanes = function (ctx, F, id, t) {
    for (let l = 0; l < 3; l++) {
      const y = F.Y + l * F.RH;
      ctx.fillStyle = l % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)';
      ctx.fillRect(F.FX, y, F.FW, F.RH);
      // 道（踏み固められた土）
      const g = ctx.createLinearGradient(0, y + F.RH * 0.25, 0, y + F.RH * 0.9);
      g.addColorStop(0, 'rgba(120,90,60,.0)'); g.addColorStop(0.3, 'rgba(150,115,75,.32)'); g.addColorStop(0.9, 'rgba(120,90,60,.0)');
      ctx.fillStyle = g; ctx.fillRect(F.FX, y + F.RH * 0.25, F.FW, F.RH * 0.65);
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(F.FX, y + 0.5); ctx.lineTo(F.FX + F.FW, y + 0.5); ctx.stroke();
      for (let c = 1; c < 7; c++) {
        const x = F.FX + c * F.CW;
        ctx.strokeStyle = 'rgba(255,255,255,.06)';
        ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x, y + F.RH - 8); ctx.stroke();
      }
      // 草
      ctx.fillStyle = 'rgba(40,70,30,.25)';
      for (let i = 0; i < 9; i++) {
        const gx = F.FX + ((i * 73 + l * 41) % F.FW), gy = y + 14 + ((i * 29 + l * 13) % 20);
        ctx.fillRect(gx, gy, 2, 6); ctx.fillRect(gx + 3, gy + 2, 2, 4);
      }
    }
  };

  // ---------- 魔物 ----------
  // x,y は足元の中央。face=-1 で左向き（陣の方）。
  V.enemy = function (ctx, t, x, y, time, o) {
    o = o || {};
    const sc = o.scale || 1;
    const bob = Math.sin(time * 5 + x * 0.05) * 2 * (o.still ? 0 : 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    if (o.flash) ctx.filter = 'brightness(2.2)';
    // 影
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(0, 0, t === 'ogre' || t === 'knight' ? 30 : 22, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, bob);
    switch (t) {
      case 'gob': goblin(ctx); break;
      case 'wolf': wolf(ctx, time); break;
      case 'shield': shieldman(ctx); break;
      case 'archer': archer(ctx); break;
      case 'ogre': ogre(ctx); break;
      case 'knight': knight(ctx); break;
      case 'dummy': dummy(ctx); break;
    }
    if (o.frz) {
      ctx.fillStyle = 'rgba(160,225,255,.45)';
      rr(ctx, -26, -64, 52, 64, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(230,250,255,.9)'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  };
  function eyes(ctx, x, y, gap, col) {
    ctx.fillStyle = col || '#ffdf3a';
    ctx.beginPath(); ctx.arc(x - gap, y, 2.6, 0, Math.PI * 2); ctx.arc(x + gap, y, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  function goblin(ctx) {
    ctx.fillStyle = '#4f7a35';
    ctx.beginPath(); ctx.ellipse(0, -18, 14, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6da047';
    ctx.beginPath(); ctx.arc(0, -38, 13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10, -42); ctx.lineTo(-24, -50); ctx.lineTo(-8, -34); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10, -42); ctx.lineTo(24, -50); ctx.lineTo(8, -34); ctx.fill();
    eyes(ctx, -4, -39, 4.5, '#ff4a2a');
    ctx.fillStyle = '#7a4a22'; ctx.save(); ctx.translate(-14, -22); ctx.rotate(-0.6); ctx.fillRect(-3, -16, 6, 22); ctx.restore();
    ctx.fillStyle = '#2f3f22'; ctx.fillRect(-9, -4, 6, 4); ctx.fillRect(3, -4, 6, 4);
  }
  function wolf(ctx, time) {
    ctx.fillStyle = '#26232e';
    ctx.beginPath(); ctx.ellipse(4, -20, 22, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-18, -28, 11, 9, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-26, -30); ctx.lineTo(-36, -24); ctx.lineTo(-24, -22); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-16, -36); ctx.lineTo(-12, -46); ctx.lineTo(-9, -34); ctx.fill();
    ctx.beginPath(); ctx.moveTo(24, -24); ctx.quadraticCurveTo(36, -34, 32, -18); ctx.fill();
    const leg = Math.sin(time * 12) * 3;
    ctx.fillRect(-10 + leg, -12, 4, 12); ctx.fillRect(14 - leg, -12, 4, 12); ctx.fillRect(-2 - leg, -12, 4, 12); ctx.fillRect(20 + leg, -12, 4, 12);
    eyes(ctx, -22, -30, 0.1, '#ffe14a');
  }
  function shieldman(ctx) {
    ctx.fillStyle = '#5c5f6e';
    ctx.beginPath(); ctx.ellipse(4, -22, 13, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#787d8f'; ctx.beginPath(); ctx.arc(4, -46, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2c36'; ctx.fillRect(-4, -48, 15, 4);
    eyes(ctx, 1, -46, 3, '#ff5a3a');
    // 大盾
    ctx.fillStyle = '#8d6e3f'; rr(ctx, -22, -54, 20, 52, 5); ctx.fill();
    ctx.strokeStyle = '#d8c08a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#5a1f2a'; ctx.beginPath(); ctx.arc(-12, -30, 5, 0, Math.PI * 2); ctx.fill();
  }
  function archer(ctx) {
    ctx.fillStyle = '#365a3e';
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(8, -34); ctx.lineTo(-8, -34); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -40, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10, -42); ctx.lineTo(0, -58); ctx.lineTo(10, -42); ctx.fill();
    eyes(ctx, -3, -40, 3, '#ffd84a');
    ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(-6, -26, 20, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
    ctx.strokeStyle = '#e8d9b0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-12, -45); ctx.lineTo(-12, -7); ctx.stroke();
  }
  function ogre(ctx) {
    ctx.fillStyle = '#8a4a3a';
    ctx.beginPath(); ctx.ellipse(0, -30, 24, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a35c48'; ctx.beginPath(); ctx.arc(-2, -66, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath(); ctx.moveTo(-12, -76); ctx.lineTo(-18, -92); ctx.lineTo(-6, -78); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -76); ctx.lineTo(14, -92); ctx.lineTo(2, -78); ctx.fill();
    eyes(ctx, -6, -68, 5, '#ffdf3a');
    ctx.fillStyle = '#5a3a24'; ctx.save(); ctx.translate(-24, -36); ctx.rotate(-0.5); rr(ctx, -6, -34, 12, 44, 5); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#4a2a20'; ctx.fillRect(-16, -6, 10, 6); ctx.fillRect(6, -6, 10, 6);
  }
  function knight(ctx) {
    ctx.fillStyle = '#23202c';
    ctx.beginPath(); ctx.ellipse(4, -32, 20, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#34303f'; rr(ctx, -8, -82, 24, 24, 6); ctx.fill();
    ctx.fillStyle = '#ff3a4a'; ctx.fillRect(-6, -72, 20, 3);
    ctx.fillStyle = '#7a1f2a'; ctx.beginPath(); ctx.moveTo(4, -82); ctx.quadraticCurveTo(26, -96, 30, -76); ctx.lineTo(10, -80); ctx.fill();
    ctx.fillStyle = '#2b2733'; rr(ctx, -30, -70, 26, 66, 6); ctx.fill();
    ctx.strokeStyle = '#9b2a3a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#c9b06a'; ctx.beginPath(); ctx.moveTo(-17, -60); ctx.lineTo(-17, -14); ctx.moveTo(-26, -40); ctx.lineTo(-8, -40); ctx.stroke();
  }
  function dummy(ctx) {
    ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -50); ctx.moveTo(-18, -34); ctx.lineTo(18, -34); ctx.stroke();
    ctx.fillStyle = '#d8b867'; ctx.beginPath(); ctx.ellipse(0, -26, 11, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8d6a0'; ctx.beginPath(); ctx.arc(0, -50, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4, -51); ctx.lineTo(-1, -48); ctx.moveTo(4, -51); ctx.lineTo(1, -48); ctx.stroke();
  }

  // ---------- 砦 ----------
  // kind: 'tower' | 'gate' | 'wood' | 'banner' | 'lord'
  V.part = function (ctx, kind, x, y, w, h, hpRate, time, o) {
    o = o || {};
    ctx.save();
    if (o.shake) ctx.translate(Math.sin(time * 60) * o.shake, 0);
    const dead = hpRate <= 0;
    if (kind === 'wood') {
      ctx.fillStyle = '#8a6236'; ctx.fillRect(x + w / 2 - 4, y + h * 0.35, 8, h * 0.6);
      const cy = y + h * 0.4;
      [[34, '#f3e7c8'], [26, '#d44a3a'], [18, '#f3e7c8'], [10, '#d44a3a']].forEach(([r, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + w / 2, cy, r, 0, Math.PI * 2); ctx.fill(); });
      ctx.restore(); return;
    }
    if (dead) {
      // がれきと、王国の旗
      ctx.fillStyle = '#4a4552';
      for (let i = 0; i < 7; i++) { const bx = x + 10 + (i * 17) % (w - 30), by = y + h - 18 - (i % 3) * 10; rr(ctx, bx, by, 22, 14, 3); ctx.fill(); }
      ctx.fillStyle = '#6a6270'; rr(ctx, x + 18, y + h - 34, 40, 18, 4); ctx.fill();
      if (o.flag !== false) {
        ctx.strokeStyle = '#d8c08a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + w / 2, y + h - 30); ctx.lineTo(x + w / 2, y + 22); ctx.stroke();
        const wave = Math.sin(time * 4) * 4;
        ctx.fillStyle = '#2f6fd0';
        ctx.beginPath(); ctx.moveTo(x + w / 2, y + 24); ctx.quadraticCurveTo(x + w / 2 + 22, y + 22 + wave, x + w / 2 + 40, y + 30); ctx.lineTo(x + w / 2 + 40, y + 54); ctx.quadraticCurveTo(x + w / 2 + 22, y + 46 + wave, x + w / 2, y + 50); ctx.fill();
        ctx.fillStyle = '#ffd86a'; ctx.beginPath(); ctx.arc(x + w / 2 + 20, y + 38 + wave * 0.5, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore(); return;
    }
    if (kind === 'lord') { lordFigure(ctx, x, y, w, h, hpRate, time); ctx.restore(); return; }
    if (kind === 'banner') { warBanner(ctx, x, y, w, h, time); ctx.restore(); return; }
    const TH = { watch: ['#5a5048', '#3e3630'], river: ['#4a5260', '#323844'], forest: ['#5a4632', '#3a2c1e'], hill: ['#6a5c48', '#4a3e30'], iron: ['#5a3c34', '#3a2622'], citadel: ['#2e2638', '#1a1422'] };
    const th = TH[o.theme] || ['#3d3a48', '#2c2a36'];
    const stone = th[0], stone2 = th[1];
    if (kind === 'tower' || kind === 'banner') {
      const tx = x + 14, tw = w - 28;
      const g = ctx.createLinearGradient(tx, 0, tx + tw, 0);
      g.addColorStop(0, stone); g.addColorStop(1, stone2);
      ctx.fillStyle = g; ctx.fillRect(tx, y + 26, tw, h - 26);
      for (let i = 0; i < 4; i++) ctx.fillRect(tx - 4 + i * (tw / 3.4), y + 14, tw / 6, 14);
      ctx.fillStyle = '#1e1b26'; ctx.fillRect(tx - 6, y + 26, tw + 12, 6);
      ctx.fillStyle = '#5a5566';
      for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) ctx.fillRect(tx + 4 + i * (tw / 3) + (j % 2) * 8, y + 40 + j * 22, tw / 3 - 10, 2);
      // 窓
      ctx.fillStyle = `rgba(190,90,255,${0.6 + 0.3 * Math.sin(time * 3 + x)})`;
      rr(ctx, x + w / 2 - 7, y + 48, 14, 22, 7); ctx.fill();
      // 黒い旗
      ctx.strokeStyle = '#1a1820'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + w / 2, y + 14); ctx.lineTo(x + w / 2, y - 14); ctx.stroke();
      ctx.fillStyle = '#1b1422';
      const wv = Math.sin(time * 3 + x) * 3;
      ctx.beginPath(); ctx.moveTo(x + w / 2, y - 14); ctx.lineTo(x + w / 2 + 26, y - 9 + wv); ctx.lineTo(x + w / 2, y - 2); ctx.fill();
      ctx.fillStyle = '#d92a3a'; ctx.beginPath(); ctx.arc(x + w / 2 + 9, y - 8 + wv * 0.4, 2.5, 0, Math.PI * 2); ctx.fill();
    } else {
      // 門
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, stone); g.addColorStop(1, stone2);
      ctx.fillStyle = g; ctx.fillRect(x + 4, y + 10, w - 8, h - 10);
      for (let i = 0; i < 5; i++) ctx.fillRect(x + 2 + i * (w / 5), y, w / 9, 12);
      ctx.fillStyle = '#17141c';
      ctx.beginPath(); ctx.moveTo(x + 24, y + h); ctx.lineTo(x + 24, y + 52); ctx.arc(x + w / 2, y + 52, w / 2 - 24, Math.PI, 0); ctx.lineTo(x + w - 24, y + h); ctx.fill();
      ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const gx = x + 30 + i * ((w - 60) / 4); ctx.beginPath(); ctx.moveTo(gx, y + 40); ctx.lineTo(gx, y + h); ctx.stroke(); }
      for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(x + 26, y + 64 + j * 20); ctx.lineTo(x + w - 26, y + 64 + j * 20); ctx.stroke(); }
      if (kind === 'lord') {
        ctx.fillStyle = `rgba(255,60,90,${0.7 + 0.3 * Math.sin(time * 4)})`;
        ctx.beginPath(); ctx.arc(x + w / 2 - 9, y + 70, 4, 0, Math.PI * 2); ctx.arc(x + w / 2 + 9, y + 70, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    // ひび
    const dmg = 1 - hpRate;
    if (dmg > 0.05) {
      ctx.strokeStyle = 'rgba(255,190,120,.55)'; ctx.lineWidth = 1.6;
      const n = Math.ceil(dmg * 7);
      for (let i = 0; i < n; i++) {
        const sx = x + 20 + ((i * 37) % (w - 40)), sy = y + 30 + ((i * 53) % (h - 40));
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 8, sy + 10); ctx.lineTo(sx + 2, sy + 18); ctx.lineTo(sx + 10, sy + 28); ctx.stroke();
      }
    }
    ctx.restore();
  };

  // 魔王：角と赤い目の大きな影
  function lordFigure(ctx, x, y, w, h, rate, time) {
    const cx = x + w / 2, by = y + h;
    const sway = Math.sin(time * 1.5) * 3;
    ctx.save();
    ctx.translate(sway, 0);
    // マント
    const g = ctx.createLinearGradient(0, y - 20, 0, by);
    g.addColorStop(0, '#3a1a4a'); g.addColorStop(1, '#120818');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(cx - 52, by); ctx.quadraticCurveTo(cx - 40, y + 30, cx - 18, y + 10); ctx.lineTo(cx + 18, y + 10); ctx.quadraticCurveTo(cx + 40, y + 30, cx + 52, by); ctx.fill();
    // 頭と角
    ctx.fillStyle = '#1c1024'; ctx.beginPath(); ctx.arc(cx, y + 4, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8c8a8';
    ctx.beginPath(); ctx.moveTo(cx - 12, y - 6); ctx.quadraticCurveTo(cx - 34, y - 14, cx - 30, y - 36); ctx.quadraticCurveTo(cx - 24, y - 18, cx - 6, y - 12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 12, y - 6); ctx.quadraticCurveTo(cx + 34, y - 14, cx + 30, y - 36); ctx.quadraticCurveTo(cx + 24, y - 18, cx + 6, y - 12); ctx.fill();
    ctx.fillStyle = `rgba(255,50,70,${0.75 + 0.25 * Math.sin(time * 4)})`;
    ctx.beginPath(); ctx.arc(cx - 7, y + 4, 3.5, 0, Math.PI * 2); ctx.arc(cx + 7, y + 4, 3.5, 0, Math.PI * 2); ctx.fill();
    // 胸の宝玉（体力が減ると暗くなる）
    ctx.fillStyle = `rgba(190,60,255,${0.3 + 0.6 * rate})`;
    ctx.beginPath(); ctx.arc(cx, y + 46, 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function warBanner(ctx, x, y, w, h, time) {
    const px = x + w / 2 - 20;
    ctx.strokeStyle = '#2a2230'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(px, y + h); ctx.lineTo(px, y - 16); ctx.stroke();
    const wv = Math.sin(time * 2.5 + x) * 6;
    ctx.fillStyle = '#1e1226';
    ctx.beginPath(); ctx.moveTo(px, y - 12); ctx.quadraticCurveTo(px + 30, y - 8 + wv, px + 60, y - 4); ctx.lineTo(px + 56 + wv * 0.4, y + 72); ctx.quadraticCurveTo(px + 30, y + 64 + wv, px, y + 70); ctx.fill();
    ctx.strokeStyle = '#a02a3a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#d92a3a'; ctx.beginPath(); ctx.arc(px + 30, y + 28 + wv * 0.5, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd86a'; ctx.beginPath(); ctx.arc(px + 30, y + 28 + wv * 0.5, 3, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- 陣（柵と旗） ----------
  V.barricade = function (ctx, x, y, h, time, hit) {
    ctx.save();
    if (hit > 0) ctx.translate(Math.sin(time * 70) * hit * 4, 0);
    for (let i = 0; i < 9; i++) {
      const py = y + i * (h / 9) + 6;
      ctx.fillStyle = '#7a5530'; ctx.fillRect(x, py, 12, h / 9 - 4);
      ctx.fillStyle = '#9b7040';
      ctx.beginPath(); ctx.moveTo(x + 12, py); ctx.lineTo(x + 22, py + (h / 9 - 4) / 2); ctx.lineTo(x + 12, py + h / 9 - 4); ctx.fill();
    }
    ctx.restore();
  };

  // ---------- 人（主人公・仲間・救った人々） ----------
  V.person = function (ctx, x, y, kind, time, o) {
    o = o || {};
    const s = o.scale || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(o.flip ? -s : s, s);
    const bob = o.still ? 0 : Math.sin(time * 4 + x) * 1.5;
    ctx.translate(0, bob);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    const P = {
      mage: ['#3f5ec4', '#ffe0c0', '#6a3a1a', 'hat'], knight: ['#8a97a8', '#ffd8b8', '#c9c9c9', 'helm'], scholar: ['#6a4a8a', '#ffe0c0', '#2a2a2a', 'glasses'],
      smith: ['#8a4a2a', '#f0c8a0', '#3a2a1a', 'beard'], priest: ['#f0f0f0', '#ffe0c0', '#d8b060', 'hood'], clock: ['#2a7a6a', '#ffe0c0', '#c87a2a', 'goggle'],
      knights: ['#3a6ad0', '#ffd8b8', '#c9c9c9', 'helm'], queen: ['#c03a5a', '#ffe8d0', '#f0c040', 'crown'], villager: ['#a07a4a', '#ffe0c0', '#5a3a1a', ''],
      child: ['#e08a4a', '#ffe0c0', '#4a2a1a', ''], old: ['#7a7a6a', '#f0d0b0', '#e0e0e0', ''],
    }[kind] || ['#a07a4a', '#ffe0c0', '#5a3a1a', ''];
    const [body, skin, hair, acc] = P;
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(7, -24); ctx.lineTo(-7, -24); ctx.fill();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -31, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, -33, 8, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(-4, -31, 2, 2); ctx.fillRect(2, -31, 2, 2);
    if (acc === 'hat') { ctx.fillStyle = '#2a3a8a'; ctx.beginPath(); ctx.moveTo(-12, -36); ctx.lineTo(12, -36); ctx.lineTo(3, -58); ctx.fill(); ctx.fillStyle = '#ffd86a'; ctx.beginPath(); ctx.arc(2, -46, 2, 0, Math.PI * 2); ctx.fill(); }
    if (acc === 'helm') { ctx.fillStyle = '#b8c0c8'; ctx.beginPath(); ctx.arc(0, -34, 9, Math.PI, 0); ctx.fill(); ctx.fillRect(-9, -35, 18, 3); }
    if (acc === 'crown') { ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.moveTo(-6, -38); ctx.lineTo(-6, -46); ctx.lineTo(-2, -41); ctx.lineTo(0, -47); ctx.lineTo(2, -41); ctx.lineTo(6, -46); ctx.lineTo(6, -38); ctx.fill(); }
    if (acc === 'hood') { ctx.fillStyle = '#e8e8f0'; ctx.beginPath(); ctx.arc(0, -32, 10, Math.PI * 0.9, Math.PI * 2.1); ctx.fill(); }
    if (acc === 'beard') { ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.arc(0, -26, 6, 0, Math.PI); ctx.fill(); }
    if (acc === 'glasses') { ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1; ctx.strokeRect(-6, -33, 5, 4); ctx.strokeRect(1, -33, 5, 4); }
    if (acc === 'goggle') { ctx.fillStyle = '#c8a040'; ctx.fillRect(-8, -38, 16, 4); }
    if (o.staff) { ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(12, -44); ctx.stroke(); ctx.fillStyle = o.staffGlow || '#9fd8ff'; ctx.beginPath(); ctx.arc(12, -47, 5, 0, Math.PI * 2); ctx.fill(); }
    if (o.cheer) { ctx.strokeStyle = skin; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-7, -20); ctx.lineTo(-12, -34 - Math.abs(Math.sin(time * 8)) * 4); ctx.moveTo(7, -20); ctx.lineTo(12, -34 - Math.abs(Math.cos(time * 8)) * 4); ctx.stroke(); }
    ctx.restore();
  };

  // 小さなアイコン
  V.heart = function (ctx, x, y, r, on) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.moveTo(0, r * 0.9); ctx.bezierCurveTo(-r * 1.4, -r * 0.2, -r * 0.5, -r * 1.2, 0, -r * 0.4); ctx.bezierCurveTo(r * 0.5, -r * 1.2, r * 1.4, -r * 0.2, 0, r * 0.9);
    ctx.fillStyle = on ? '#ff5a6a' : 'rgba(0,0,0,.35)'; ctx.fill();
    ctx.strokeStyle = on ? '#ffd0d6' : 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  };
  V.shieldIcon = function (ctx, x, y, r, on) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.85, -r * 0.6); ctx.lineTo(r * 0.7, r * 0.4); ctx.lineTo(0, r); ctx.lineTo(-r * 0.7, r * 0.4); ctx.lineTo(-r * 0.85, -r * 0.6); ctx.closePath();
    ctx.fillStyle = on ? '#4f8fe0' : 'rgba(0,0,0,.35)'; ctx.fill();
    ctx.strokeStyle = on ? '#e6f0ff' : 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (on) { ctx.fillStyle = '#ffd86a'; ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.25, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  V.orb = function (ctx, x, y, r, on, time) {
    ctx.save();
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    if (on) { g.addColorStop(0, '#f4fbff'); g.addColorStop(0.5, '#7fc8ff'); g.addColorStop(1, '#2a5ac0'); }
    else { g.addColorStop(0, 'rgba(120,120,150,.5)'); g.addColorStop(1, 'rgba(40,40,60,.6)'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (on) { ctx.shadowColor = '#8fd0ff'; ctx.shadowBlur = 8 + 3 * Math.sin(time * 4); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.restore();
  };
  V.coin = function (ctx, x, y, r) {
    ctx.save();
    ctx.fillStyle = '#ffd04a'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a2741a'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff2b0'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  root.ZV = V;
})(typeof window !== 'undefined' ? window : this);
