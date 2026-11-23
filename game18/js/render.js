// がらり、迷宮ひらき — 絵（Canvas 2D だけで描く。外部素材なし）
(function (root) {
  'use strict';
  const V = {};
  V.SERIF = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","BIZ UDPMincho","MS PMincho",serif';
  V.SANS = '"Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo","BIZ UDPGothic",sans-serif';
  V.font = (px, w, serif) => `${w || 600} ${px}px ${serif ? V.SERIF : V.SANS}`;

  V.EL_COL = { sword: '#dfe6ef', fire: '#ff7a36', ice: '#8fe2ff', bolt: '#ffd84a', light: '#fff2a6', star: '#f6a8ff' };
  V.EL_DARK = { sword: '#4e5d72', fire: '#8a2a10', ice: '#1b5a82', bolt: '#7a5a08', light: '#8a7420', star: '#6a2a7a' };
  V.EL_NAME = { sword: '剣', fire: '炎', ice: '氷', bolt: '雷', light: '光', star: '星', any: 'どの紋でも' };

  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
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
  V.wrap = function (ctx, s, maxW) {
    const out = [];
    for (const para of String(s).split('\n')) {
      let line = '';
      for (const ch of para) {
        if (ctx.measureText(line + ch).width > maxW && line) {
          if ('、。」）！？…'.indexOf(ch) >= 0) { line += ch; continue; }
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
  function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  V.hash = hash;

  // ---------- 枠・ボタン ----------
  V.panel = function (ctx, x, y, w, h, o) {
    o = o || {};
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    rr(ctx, x, y, w, h, o.r || 12);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (o.dark) { g.addColorStop(0, 'rgba(34,28,24,.95)'); g.addColorStop(1, 'rgba(22,18,16,.97)'); }
    else { g.addColorStop(0, '#f4e6c8'); g.addColorStop(1, '#e6d0a6'); }
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, o.r || 12);
    ctx.lineWidth = 2; ctx.strokeStyle = o.dark ? 'rgba(220,180,110,.55)' : '#8c6a3c'; ctx.stroke();
    if (!o.dark) { rr(ctx, x + 5, y + 5, w - 10, h - 10, (o.r || 12) - 4); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(140,106,60,.4)'; ctx.stroke(); }
  };
  V.button = function (ctx, b, t) {
    const hot = b.hot && !b.disabled;
    const x = b.x, y = b.y, w = b.w, h = b.h;
    ctx.save();
    const press = hot ? -1 : 0;
    rr(ctx, x, y + press, w, h, b.r || 10);
    let c1 = '#5a4632', c2 = '#3a2c20', edge = '#d9b26b', fg = '#fff3dc';
    if (b.kind === 'main') { c1 = '#ffcf6a'; c2 = '#e0862a'; edge = '#fff1c0'; fg = '#3a1d05'; }
    if (b.kind === 'light') { c1 = '#fbf1d8'; c2 = '#e6d0a4'; edge = '#8c6a3c'; fg = '#3b2a14'; }
    if (b.kind === 'ghost') { c1 = 'rgba(40,32,26,.78)'; c2 = 'rgba(26,20,16,.84)'; edge = 'rgba(217,178,107,.6)'; }
    if (b.kind === 'blue') { c1 = '#5a8ac0'; c2 = '#2c4e7a'; edge = '#cfe6ff'; }
    if (b.disabled) { c1 = '#4a443e'; c2 = '#36302a'; edge = '#6b625a'; fg = '#9e958b'; }
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    if (hot) { ctx.shadowColor = b.kind === 'main' ? 'rgba(255,200,90,.8)' : 'rgba(255,230,160,.45)'; ctx.shadowBlur = 16; }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = b.glow ? 3 : 1.6;
    ctx.strokeStyle = b.glow ? `rgba(255,236,150,${0.6 + 0.4 * Math.sin(t * 6)})` : edge;
    ctx.stroke();
    if (b.glow) { ctx.shadowColor = '#ffe27a'; ctx.shadowBlur = 14 + 8 * Math.sin(t * 6); ctx.stroke(); ctx.shadowBlur = 0; }
    if (b.draw) b.draw(ctx, x, y + press, w, h, fg);
    else {
      V.text(ctx, b.label, x + w / 2, y + h / 2 + press + (b.sub ? -7 : 1), { align: 'center', size: b.size || 18, weight: 700, color: fg, serif: b.serif });
      if (b.sub) V.text(ctx, b.sub, x + w / 2, y + h - 13 + press, { align: 'center', size: 12, weight: 500, color: fg });
    }
    ctx.restore();
  };

  // ---------- 紋の絵 ----------
  V.elIcon = function (ctx, el, cx, cy, r, col, o) {
    o = o || {};
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = col; ctx.strokeStyle = col;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (el === 'sword') {
      ctx.rotate(-Math.PI / 4);
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.2, -r * 0.72); ctx.lineTo(r * 0.2, r * 0.38); ctx.lineTo(-r * 0.2, r * 0.38); ctx.lineTo(-r * 0.2, -r * 0.72); ctx.closePath(); ctx.fill();
      ctx.fillRect(-r * 0.52, r * 0.36, r * 1.04, r * 0.16);
      ctx.fillRect(-r * 0.11, r * 0.5, r * 0.22, r * 0.4);
      ctx.beginPath(); ctx.arc(0, r * 0.95, r * 0.13, 0, 7); ctx.fill();
    } else if (el === 'fire') {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.55, -r * 0.35, r * 0.95, r * 0.05, r * 0.6, r * 0.6);
      ctx.bezierCurveTo(r * 0.35, r * 0.95, -r * 0.35, r * 0.95, -r * 0.6, r * 0.6);
      ctx.bezierCurveTo(-r * 0.9, r * 0.1, -r * 0.4, -r * 0.2, -r * 0.2, -r * 0.55);
      ctx.bezierCurveTo(-r * 0.05, -r * 0.2, r * 0.1, -r * 0.55, 0, -r);
      ctx.fill();
      ctx.fillStyle = o.inner || 'rgba(255,240,180,.85)';
      ctx.beginPath(); ctx.ellipse(0, r * 0.45, r * 0.28, r * 0.36, 0, 0, 7); ctx.fill();
    } else if (el === 'ice') {
      ctx.lineWidth = Math.max(2, r * 0.18);
      for (let k = 0; k < 3; k++) {
        ctx.save(); ctx.rotate(k * Math.PI / 3);
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(0, s * r * 0.55); ctx.lineTo(r * 0.3, s * r * 0.8); ctx.moveTo(0, s * r * 0.55); ctx.lineTo(-r * 0.3, s * r * 0.8); ctx.stroke();
        }
        ctx.restore();
      }
    } else if (el === 'bolt') {
      ctx.beginPath();
      ctx.moveTo(r * 0.25, -r); ctx.lineTo(-r * 0.55, r * 0.12); ctx.lineTo(-r * 0.02, r * 0.12);
      ctx.lineTo(-r * 0.3, r); ctx.lineTo(r * 0.6, -r * 0.2); ctx.lineTo(r * 0.06, -r * 0.2); ctx.lineTo(r * 0.45, -r);
      ctx.closePath(); ctx.fill();
    } else if (el === 'light') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, 7); ctx.fill();
      ctx.lineWidth = Math.max(2, r * 0.14);
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); ctx.lineTo(Math.cos(a) * r * (k % 2 ? 0.82 : 1), Math.sin(a) * r * (k % 2 ? 0.82 : 1)); ctx.stroke();
      }
    } else if (el === 'star') {
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 5, rad = k % 2 ? r * 0.42 : r;
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath(); ctx.fill();
    } else if (el === 'any') {
      ctx.lineWidth = Math.max(2, r * 0.18);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 0.1); ctx.lineTo(-r * 0.1, r * 0.3); ctx.lineTo(r * 0.5, -r * 0.4); ctx.stroke();
    }
    ctx.restore();
  };
  // 紋のコマ
  V.rune = function (ctx, c, x, y, w, h, t, o) {
    o = o || {};
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (c.k === 'gap') {
      rr(ctx, x + 3, y + 3, w - 6, h - 6, 10);
      ctx.fillStyle = 'rgba(20,14,10,.55)'; ctx.fill();
      ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(200,170,120,.35)'; ctx.stroke(); ctx.setLineDash([]);
      if (o.label !== false && h > 40) V.text(ctx, '空き', x + w / 2, y + h / 2, { align: 'center', size: Math.min(14, h * 0.2), color: 'rgba(210,180,130,.45)' });
      ctx.restore();
      return;
    }
    const col = V.EL_COL[c.k], dk = V.EL_DARK[c.k];
    rr(ctx, x + 3, y + 3, w - 6, h - 6, 10);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.lit ? '#fff8e0' : '#4a3a2c'); g.addColorStop(1, o.lit ? '#e9cf98' : '#2c2219');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = o.lit ? 3 : 2;
    ctx.strokeStyle = o.lit ? col : 'rgba(220,180,120,.55)';
    if (o.lit) { ctx.shadowColor = col; ctx.shadowBlur = 16; }
    ctx.stroke(); ctx.shadowBlur = 0;
    const small = h < 40;
    const r = Math.min(w, h) * (small ? 0.36 : 0.28);
    // 紋の後光
    const rg = ctx.createRadialGradient(x + w / 2, y + h / 2, 1, x + w / 2, y + h / 2, r * 1.7);
    rg.addColorStop(0, o.lit ? 'rgba(255,255,255,.0)' : col + '44'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(x, y, w, h);
    V.elIcon(ctx, c.k, x + w / 2, y + h / 2 - (h > 60 ? 4 : 0), r, o.lit ? dk : col);
    // Lv の点
    if (c.k !== 'star' && small && c.lv > 1) V.text(ctx, String(c.lv), x + w - 7, y + h - 8, { align: 'center', size: 10, weight: 800, color: '#ffe39a', stroke: 'rgba(0,0,0,.7)', sw: 2 });
    if (c.k !== 'star' && !small) {
      for (let i = 0; i < c.lv; i++) {
        ctx.beginPath(); ctx.arc(x + 12 + i * 9, y + 13, 3.2, 0, 7);
        ctx.fillStyle = o.lit ? dk : '#ffe39a'; ctx.fill();
      }
    }
    if (h > 60 && o.name !== false) V.text(ctx, V.EL_NAME[c.k] + (c.lv > 1 ? c.lv : ''), x + w / 2, y + h - 14, { align: 'center', size: 13, weight: 700, color: o.lit ? dk : 'rgba(255,236,200,.75)' });
    if (c.nw && o.newMark !== false) {
      ctx.fillStyle = '#e8402a';
      rr(ctx, x + w - 26, y + 5, 21, 17, 5); ctx.fill();
      V.text(ctx, '新', x + w - 15.5, y + 14, { align: 'center', size: 12, weight: 800, color: '#fff' });
    }
    ctx.restore();
  };

  // ---------- ミオ ----------
  V.mio = function (ctx, x, y, t, o) {
    o = o || {};
    const s = o.s || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(o.flip ? -s : s, s);
    const bob = Math.sin(t * 2.4) * 1.5;
    // 影
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 5, 0, 0, 7); ctx.fill();
    if (o.hurt) { ctx.translate(Math.sin(t * 60) * 3, 0); }
    // マント
    ctx.fillStyle = '#3c5a8a';
    ctx.beginPath(); ctx.moveTo(-13, -46 + bob); ctx.quadraticCurveTo(-22, -16, -17, -2); ctx.lineTo(15, -2); ctx.quadraticCurveTo(19, -20, 11, -46 + bob); ctx.closePath(); ctx.fill();
    // 体
    ctx.fillStyle = '#c98a4a';
    ctx.beginPath(); ctx.moveTo(-10, -44 + bob); ctx.lineTo(10, -44 + bob); ctx.lineTo(13, -8); ctx.lineTo(-13, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-12, -24 + bob, 24, 4);
    // 足
    ctx.fillStyle = '#4a3020'; ctx.fillRect(-9, -8, 7, 8); ctx.fillRect(2, -8, 7, 8);
    // 地図の筒（背中）
    ctx.fillStyle = '#e8d4a6'; ctx.save(); ctx.translate(-12, -40 + bob); ctx.rotate(-0.5); ctx.fillRect(-4, -14, 8, 26); ctx.fillStyle = '#a06a3a'; ctx.fillRect(-5, -16, 10, 4); ctx.restore();
    // 頭
    ctx.fillStyle = '#f2d2b0';
    ctx.beginPath(); ctx.arc(0, -55 + bob, 11, 0, 7); ctx.fill();
    // 髪
    ctx.fillStyle = '#5a3420';
    ctx.beginPath(); ctx.arc(0, -58 + bob, 12, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    ctx.beginPath(); ctx.moveTo(9, -60 + bob); ctx.quadraticCurveTo(18, -52 + bob, 13, -40 + bob); ctx.quadraticCurveTo(10, -50 + bob, 7, -54 + bob); ctx.fill();
    // 帽子
    ctx.fillStyle = '#2e4a72';
    ctx.beginPath(); ctx.ellipse(0, -64 + bob, 17, 4.5, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-9, -65 + bob); ctx.quadraticCurveTo(-2, -86 + bob, 12, -80 + bob); ctx.quadraticCurveTo(4, -76 + bob, 9, -65 + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.arc(11, -80 + bob, 2.6, 0, 7); ctx.fill();
    // 目
    ctx.fillStyle = '#2a1a10';
    ctx.beginPath(); ctx.arc(3.5, -55 + bob, 1.6, 0, 7); ctx.arc(-3, -55 + bob, 1.6, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(230,120,110,.5)'; ctx.beginPath(); ctx.arc(6, -51 + bob, 2.2, 0, 7); ctx.arc(-6, -51 + bob, 2.2, 0, 7); ctx.fill();
    // 杖と灯り
    if (!o.noStaff) {
      const cast = o.cast || 0;
      ctx.save(); ctx.translate(14, -30 + bob); ctx.rotate(-0.25 - cast * 0.5);
      ctx.strokeStyle = '#7a5030'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, -34); ctx.stroke();
      const lg = ctx.createRadialGradient(0, -38, 1, 0, -38, 20 + cast * 14);
      lg.addColorStop(0, 'rgba(255,240,170,.95)'); lg.addColorStop(0.4, 'rgba(255,200,90,.45)'); lg.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(0, -38, 22 + cast * 14, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff2b0'; ctx.beginPath(); ctx.arc(0, -38, 4.5, 0, 7); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };
  V.oldman = function (ctx, x, y, t, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#6a5a4a';
    ctx.beginPath(); ctx.moveTo(-16, -50); ctx.quadraticCurveTo(-22, -10, -18, 0); ctx.lineTo(18, 0); ctx.quadraticCurveTo(22, -10, 16, -50); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f0d4b4'; ctx.beginPath(); ctx.arc(0, -60, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath(); ctx.moveTo(-10, -56); ctx.quadraticCurveTo(0, -28, 10, -56); ctx.quadraticCurveTo(0, -50, -10, -56); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -66, 11, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(-6, -62, 4, 1.6); ctx.fillRect(2, -62, 4, 1.6);
    ctx.strokeStyle = '#a07a40'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-4, -61, 4, 0, 7); ctx.arc(4, -61, 4, 0, 7); ctx.stroke();
    ctx.restore();
  };

  // ---------- 魔物 ----------
  function eyes(ctx, x, y, gap, r, col) {
    ctx.fillStyle = col || '#ffdf5a';
    ctx.beginPath(); ctx.arc(x - gap, y, r, 0, 7); ctx.arc(x + gap, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a0a05';
    ctx.beginPath(); ctx.arc(x - gap - r * 0.3, y, r * 0.45, 0, 7); ctx.arc(x + gap - r * 0.3, y, r * 0.45, 0, 7); ctx.fill();
  }
  V.ENEMY_SCALE = { chief: 1.3, golem: 1.4, book: 1.25, arm: 1.35, heart: 1.45 };
  V.enemy = function (ctx, t, x, y, time, o) {
    o = o || {};
    const s = (V.ENEMY_SCALE[t] || 1) * (o.s || 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    // 影
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    if (t !== 'bat' && t !== 'ghost') { ctx.beginPath(); ctx.ellipse(0, 0, 24 * s, 6 * s, 0, 0, 7); ctx.fill(); }
    ctx.scale(-s, s);
    const bob = Math.sin(time * 3 + x * 0.05) * 2;
    if (o.frozen) ctx.filter = 'none';
    switch (t) {
      case 'goblin': case 'archer': case 'chief': {
        const skin = t === 'chief' ? '#6a8a3a' : '#7aa64a';
        ctx.fillStyle = t === 'archer' ? '#5a3a6a' : '#6a4a2a';
        ctx.beginPath(); ctx.moveTo(-14, -30 + bob); ctx.lineTo(14, -30 + bob); ctx.lineTo(16, -6); ctx.lineTo(-16, -6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = skin;
        ctx.fillRect(-10, -6, 7, 6); ctx.fillRect(3, -6, 7, 6);
        ctx.beginPath(); ctx.arc(0, -40 + bob, 15, 0, 7); ctx.fill();
        // 耳
        ctx.beginPath(); ctx.moveTo(-12, -44 + bob); ctx.lineTo(-30, -52 + bob); ctx.lineTo(-12, -36 + bob); ctx.fill();
        ctx.beginPath(); ctx.moveTo(12, -44 + bob); ctx.lineTo(30, -52 + bob); ctx.lineTo(12, -36 + bob); ctx.fill();
        eyes(ctx, 0, -42 + bob, 6, 3.6, t === 'chief' ? '#ff5a3a' : '#ffdf5a');
        ctx.fillStyle = '#2a1a0a'; ctx.fillRect(-5, -33 + bob, 10, 2.5);
        ctx.fillStyle = '#fff'; ctx.fillRect(-4, -33 + bob, 2, 3); ctx.fillRect(2, -33 + bob, 2, 3);
        if (t === 'archer') {
          ctx.fillStyle = '#4a2a5a'; ctx.beginPath(); ctx.arc(0, -46 + bob, 16, Math.PI, 0); ctx.fill();
          ctx.strokeStyle = '#a07a40'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(16, -24 + bob, 16, -1.2, 1.2); ctx.stroke();
          ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(22, -39 + bob); ctx.lineTo(22, -9 + bob); ctx.stroke();
        } else {
          ctx.save(); ctx.translate(16, -22 + bob); ctx.rotate(0.5 + Math.sin(time * 3) * 0.1);
          ctx.fillStyle = '#8a5a30'; ctx.fillRect(-3, -22, 7, 26);
          ctx.beginPath(); ctx.ellipse(0.5, -24, 7, 9, 0, 0, 7); ctx.fill();
          ctx.restore();
        }
        if (t === 'chief') {
          ctx.fillStyle = '#e8b830';
          ctx.beginPath(); ctx.moveTo(-12, -52 + bob); ctx.lineTo(-12, -62 + bob); ctx.lineTo(-6, -56 + bob); ctx.lineTo(0, -66 + bob); ctx.lineTo(6, -56 + bob); ctx.lineTo(12, -62 + bob); ctx.lineTo(12, -52 + bob); ctx.closePath(); ctx.fill();
        }
        break;
      }
      case 'bat': {
        const f = Math.sin(time * 14 + x) * 0.6;
        const yy = -46 + Math.sin(time * 4 + x) * 5;
        ctx.fillStyle = '#4a3058';
        for (const sd of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(0, yy); ctx.quadraticCurveTo(sd * 18, yy - 18 - f * 12, sd * 32, yy - 6 - f * 14);
          ctx.quadraticCurveTo(sd * 22, yy + 2, sd * 26, yy + 8); ctx.quadraticCurveTo(sd * 14, yy + 2, 0, yy + 6); ctx.fill();
        }
        ctx.fillStyle = '#5a3a6a'; ctx.beginPath(); ctx.ellipse(0, yy, 9, 11, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-6, yy - 8); ctx.lineTo(-8, yy - 16); ctx.lineTo(-2, yy - 9); ctx.moveTo(6, yy - 8); ctx.lineTo(8, yy - 16); ctx.lineTo(2, yy - 9); ctx.fill();
        eyes(ctx, 0, yy - 2, 4, 2.6, '#ff6a5a');
        break;
      }
      case 'thornling': {
        ctx.fillStyle = '#5a6a2a';
        ctx.beginPath(); ctx.arc(0, -22 + bob, 18, 0, 7); ctx.fill();
        ctx.strokeStyle = '#3a4a1a'; ctx.lineWidth = 3;
        for (let k = 0; k < 9; k++) { const a = k * 0.7 + 0.2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 14, -22 + bob + Math.sin(a) * 14); ctx.lineTo(Math.cos(a) * 26, -22 + bob + Math.sin(a) * 26); ctx.stroke(); }
        ctx.fillStyle = '#c84a6a'; ctx.beginPath(); ctx.arc(-8, -36 + bob, 4, 0, 7); ctx.fill();
        eyes(ctx, 0, -24 + bob, 6, 3.4, '#ffe06a');
        break;
      }
      case 'crab': {
        ctx.fillStyle = '#c86a5a';
        ctx.beginPath(); ctx.ellipse(0, -16 + bob * 0.4, 24, 13, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#a04a3a'; ctx.lineWidth = 3;
        for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(sd * 12, -10); ctx.lineTo(sd * (22 + k * 5), -2 + k); ctx.stroke(); }
        ctx.fillStyle = '#d87a6a';
        ctx.beginPath(); ctx.ellipse(24, -28 + bob, 9, 7, -0.4, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-24, -26 + bob, 8, 6, 0.4, 0, 7); ctx.fill();
        // 背の水晶
        ctx.fillStyle = 'rgba(150,230,255,.9)';
        for (const [cx, h] of [[-10, 18], [0, 24], [10, 16]]) { ctx.beginPath(); ctx.moveTo(cx - 5, -24); ctx.lineTo(cx, -24 - h); ctx.lineTo(cx + 5, -24); ctx.closePath(); ctx.fill(); }
        eyes(ctx, 0, -24 + bob * 0.4, 6, 3, '#111');
        break;
      }
      case 'slime': {
        const w = 22 + Math.sin(time * 4 + x) * 2;
        const g = ctx.createRadialGradient(-4, -24, 2, 0, -16, 28);
        g.addColorStop(0, 'rgba(220,250,255,.95)'); g.addColorStop(1, 'rgba(90,170,230,.85)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(-w, 0); ctx.quadraticCurveTo(-w, -36, 0, -38); ctx.quadraticCurveTo(w, -36, w, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.beginPath(); ctx.moveTo(-6, -36); ctx.lineTo(-2, -48); ctx.lineTo(2, -37); ctx.fill();
        eyes(ctx, 0, -18, 7, 3.4, '#1a3a5a');
        break;
      }
      case 'fish': {
        ctx.fillStyle = '#3a8a8a';
        ctx.beginPath(); ctx.moveTo(-13, -34 + bob); ctx.lineTo(13, -34 + bob); ctx.lineTo(15, -6); ctx.lineTo(-15, -6); ctx.closePath(); ctx.fill();
        ctx.fillRect(-10, -6, 7, 6); ctx.fillRect(3, -6, 7, 6);
        ctx.fillStyle = '#4aa0a0'; ctx.beginPath(); ctx.ellipse(0, -44 + bob, 14, 13, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#2a6a7a'; ctx.beginPath(); ctx.moveTo(-6, -56 + bob); ctx.lineTo(0, -68 + bob); ctx.lineTo(8, -55 + bob); ctx.fill();
        eyes(ctx, 2, -46 + bob, 6, 3.6, '#e8ff9a');
        ctx.strokeStyle = '#c8c8c8'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(20, -2); ctx.lineTo(20, -60 + bob); ctx.stroke();
        ctx.fillStyle = '#c8c8c8'; ctx.beginPath(); ctx.moveTo(16, -58 + bob); ctx.lineTo(20, -70 + bob); ctx.lineTo(24, -58 + bob); ctx.fill();
        break;
      }
      case 'golem': {
        ctx.fillStyle = '#5a6a8a';
        ctx.beginPath(); ctx.moveTo(-22, -10); ctx.lineTo(-26, -46 + bob); ctx.lineTo(-12, -60 + bob); ctx.lineTo(12, -60 + bob); ctx.lineTo(26, -46 + bob); ctx.lineTo(22, -10); ctx.closePath(); ctx.fill();
        ctx.fillRect(-18, -10, 12, 10); ctx.fillRect(6, -10, 12, 10);
        ctx.fillStyle = '#4a5878'; ctx.fillRect(-36, -50 + bob, 12, 32); ctx.fillRect(24, -50 + bob, 12, 32);
        ctx.fillStyle = 'rgba(150,230,255,.95)';
        for (const [cx, cy, h] of [[-14, -60, 16], [0, -62, 22], [14, -60, 14], [-30, -50, 12], [30, -50, 12]]) { ctx.beginPath(); ctx.moveTo(cx - 5, cy + bob); ctx.lineTo(cx, cy - h + bob); ctx.lineTo(cx + 5, cy + bob); ctx.closePath(); ctx.fill(); }
        const cg = ctx.createRadialGradient(0, -34 + bob, 1, 0, -34 + bob, 12);
        cg.addColorStop(0, '#fff'); cg.addColorStop(1, 'rgba(120,220,255,0)');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, -34 + bob, 12, 0, 7); ctx.fill();
        eyes(ctx, 0, -50 + bob, 8, 3, '#bff');
        break;
      }
      case 'skel': {
        ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, -38 + bob); ctx.lineTo(0, -12); ctx.stroke();
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-9, -32 + k * 6 + bob); ctx.lineTo(9, -32 + k * 6 + bob); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-7, 0); ctx.moveTo(0, -12); ctx.lineTo(7, 0); ctx.stroke();
        ctx.fillStyle = '#ece6d4'; ctx.beginPath(); ctx.arc(0, -46 + bob, 11, 0, 7); ctx.fill();
        ctx.fillStyle = '#2a1a2a'; ctx.beginPath(); ctx.arc(-4, -47 + bob, 3, 0, 7); ctx.arc(4, -47 + bob, 3, 0, 7); ctx.fill();
        ctx.fillStyle = '#8a5ad0'; ctx.beginPath(); ctx.arc(-4, -47 + bob, 1.2, 0, 7); ctx.arc(4, -47 + bob, 1.2, 0, 7); ctx.fill();
        ctx.fillStyle = '#7a6a5a'; ctx.beginPath(); ctx.ellipse(16, -26 + bob, 9, 13, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#b8a888'; ctx.lineWidth = 2; ctx.stroke();
        break;
      }
      case 'ghost': {
        const yy = -40 + Math.sin(time * 2.5 + x) * 5;
        const g = ctx.createLinearGradient(0, yy - 22, 0, yy + 30);
        g.addColorStop(0, 'rgba(230,235,255,.92)'); g.addColorStop(1, 'rgba(180,190,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, yy, 18, Math.PI, 0);
        for (let k = 0; k <= 4; k++) ctx.lineTo(18 - k * 9, yy + 28 + Math.sin(time * 6 + k) * 4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a2050'; ctx.beginPath(); ctx.ellipse(-6, yy - 2, 3.5, 5, 0, 0, 7); ctx.ellipse(6, yy - 2, 3.5, 5, 0, 0, 7); ctx.fill();
        break;
      }
      case 'book': {
        ctx.fillStyle = '#7a7268';
        ctx.beginPath(); ctx.moveTo(-18, -8); ctx.lineTo(-20, -48 + bob); ctx.lineTo(20, -48 + bob); ctx.lineTo(18, -8); ctx.closePath(); ctx.fill();
        ctx.fillRect(-16, -8, 12, 8); ctx.fillRect(4, -8, 12, 8);
        ctx.beginPath(); ctx.arc(0, -58 + bob, 13, 0, 7); ctx.fill();
        ctx.fillStyle = '#5a3a7a'; ctx.fillRect(4, -40 + bob, 24, 18);
        ctx.fillStyle = '#e8dcc0'; ctx.fillRect(6, -38 + bob, 20, 14);
        ctx.strokeStyle = '#5a3a7a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(16, -38 + bob); ctx.lineTo(16, -24 + bob); ctx.stroke();
        eyes(ctx, 0, -60 + bob, 5, 2.6, '#c89aff');
        break;
      }
      case 'dummy': {
        ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -50); ctx.moveTo(-18, -36); ctx.lineTo(18, -36); ctx.stroke();
        ctx.fillStyle = '#d8b870'; ctx.beginPath(); ctx.ellipse(0, -30, 13, 16, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -52, 10, 0, 7); ctx.fill();
        ctx.strokeStyle = '#a07a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4, -54); ctx.lineTo(-1, -51); ctx.moveTo(-1, -54); ctx.lineTo(-4, -51); ctx.moveTo(1, -54); ctx.lineTo(4, -51); ctx.moveTo(4, -54); ctx.lineTo(1, -51); ctx.stroke();
        break;
      }
      case 'arm': {
        ctx.fillStyle = '#4a4458';
        ctx.beginPath(); ctx.moveTo(-34, -6); ctx.lineTo(-30, -40 + bob); ctx.lineTo(-8, -54 + bob); ctx.lineTo(20, -50 + bob); ctx.lineTo(34, -26); ctx.lineTo(30, -4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a546a';
        for (let k = 0; k < 4; k++) { rr(ctx, -26 + k * 13, -58 + bob, 11, 16, 4); ctx.fill(); }
        ctx.strokeStyle = 'rgba(160,140,255,.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-20, -30); ctx.lineTo(-4, -22); ctx.lineTo(10, -34); ctx.stroke();
        break;
      }
      case 'heart': {
        ctx.fillStyle = '#3e3850';
        ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-38, -44); ctx.lineTo(-20, -66); ctx.lineTo(20, -66); ctx.lineTo(38, -44); ctx.lineTo(34, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#6a6088'; ctx.lineWidth = 2; ctx.stroke();
        const pulse = 0.6 + 0.4 * Math.sin(time * 3);
        const cg = ctx.createRadialGradient(0, -34, 2, 0, -34, 22);
        cg.addColorStop(0, `rgba(255,240,180,${pulse})`); cg.addColorStop(1, 'rgba(255,180,90,0)');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, -34, 22, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(8, -34); ctx.lineTo(0, -22); ctx.lineTo(-8, -34); ctx.closePath(); ctx.fill();
        eyes(ctx, 0, -56, 12, 3, '#ffb06a');
        if (o.shell) {
          ctx.strokeStyle = 'rgba(180,170,220,.85)'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(0, -34, 26, 0, 7); ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
    if (o.frozen) {
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(160,230,255,.35)'; ctx.strokeStyle = 'rgba(220,250,255,.9)'; ctx.lineWidth = 2;
      const hh = 60 * s, ww = 26 * s;
      ctx.beginPath(); ctx.moveTo(-ww, 0); ctx.lineTo(-ww - 4, -hh * 0.7); ctx.lineTo(-ww * 0.3, -hh); ctx.lineTo(ww * 0.6, -hh * 0.92); ctx.lineTo(ww + 3, -hh * 0.5); ctx.lineTo(ww, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  };

  // ---------- 部屋の奥の壁 ----------
  // st: {broken, t（崩れてからの時間）, glimpse: 'chest'|'glow'|'deep'|...}
  V.wall = function (ctx, kind, x, y, w, h, time, st) {
    st = st || {};
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    // 岩の地
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(30,24,20,0)'); g.addColorStop(0.25, '#2e2620'); g.addColorStop(1, '#201a16');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    for (let i = 0; i < 9; i++) {
      const hx = x + 30 + hash(i * 3 + x) * (w - 30), hy = y + hash(i * 7 + y) * h;
      ctx.fillStyle = `rgba(${70 + i * 3},${58 + i * 2},${48},.55)`;
      ctx.beginPath(); ctx.ellipse(hx, hy, 14 + hash(i) * 14, 9 + hash(i + 9) * 8, hash(i + 4), 0, 7); ctx.fill();
    }
    const cx = x + w * 0.58, cy = y + h * 0.5;
    if (st.broken && kind === 'lake') {
      // 凍った湖：氷の道が向こう岸へ
      const k = Math.min(1, (st.t || 9) / 0.8);
      ctx.fillStyle = '#123048'; ctx.fillRect(x + 10, cy - 4, w, h);
      const ig = ctx.createLinearGradient(0, cy - 4, 0, y + h);
      ig.addColorStop(0, 'rgba(230,250,255,.95)'); ig.addColorStop(1, 'rgba(150,210,240,.9)');
      ctx.fillStyle = ig; ctx.fillRect(x + 10, cy - 4, (w - 10) * k, h);
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { const xx = x + 20 + i * 26; if (xx > x + 10 + (w - 10) * k) break; ctx.beginPath(); ctx.moveTo(xx, cy); ctx.lineTo(xx + 12, cy + 20); ctx.lineTo(xx + 4, cy + 40); ctx.stroke(); }
      for (let i = 0; i < 8; i++) { const a = time * 2 + i; ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(a)})`; ctx.beginPath(); ctx.arc(x + 20 + V.hash(i) * (w - 30) * k, cy + 6 + V.hash(i + 4) * 30, 1.8, 0, 7); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,230,150,.8)'; ctx.beginPath(); ctx.arc(x + w - 24, cy - 22, 5 + Math.sin(time * 3), 0, 7); ctx.fill();
      ctx.restore();
      return;
    }
    if (st.broken && kind === 'gear') {
      // 動き出した歯車と、開いた昇降機の扉
      ctx.fillStyle = '#0e0a08'; ctx.fillRect(cx - 30, cy - 40, 60, 90);
      const lg = ctx.createLinearGradient(0, cy - 40, 0, cy + 50);
      lg.addColorStop(0, 'rgba(255,226,140,.0)'); lg.addColorStop(1, 'rgba(255,226,140,.7)');
      ctx.fillStyle = lg; ctx.fillRect(cx - 30, cy - 40, 60, 90);
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.strokeRect(cx - 30, cy - 40, 60, 90);
      for (const [gx, gy, r, sp] of [[cx + 46, cy - 30, 22, 1], [cx - 46, cy + 30, 18, -1.2]]) {
        ctx.save(); ctx.translate(gx, gy); ctx.rotate(time * sp * 1.5);
        ctx.fillStyle = '#a07a40'; ctx.beginPath();
        const n = Math.round(r / 3.5);
        for (let q = 0; q < n * 2; q++) { const a = q * Math.PI / n, rad = q % 2 ? r : r * 0.8; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a2a18'; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, 7); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      return;
    }
    if (st.broken) {
      const k = Math.min(1, (st.t || 9) / 0.6);
      // 穴と、向こうの光
      const lg = ctx.createRadialGradient(cx, cy, 4, cx, cy, h * 0.8);
      const lc = st.lightCol || '255,226,150';
      lg.addColorStop(0, `rgba(${lc},${0.95 * k})`); lg.addColorStop(0.5, `rgba(${lc},${0.35 * k})`); lg.addColorStop(1, `rgba(${lc},0)`);
      ctx.fillStyle = '#0e0a08';
      ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.32 * k + 4, h * 0.4 * k + 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = lg; ctx.fillRect(x, y, w, h);
      // 向こうに見えるもの
      if (st.glimpse === 'chest') {
        ctx.globalAlpha = k;
        ctx.fillStyle = '#8a5a2a'; ctx.fillRect(cx - 14, cy + 4, 28, 18);
        ctx.fillStyle = '#e8b830'; ctx.fillRect(cx - 14, cy + 2, 28, 5); ctx.fillRect(cx - 3, cy + 6, 6, 8);
        for (let i = 0; i < 5; i++) { const a = time * 2 + i * 1.3; ctx.fillStyle = 'rgba(255,240,170,.9)'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 22, cy - 6 + Math.sin(a * 1.3) * 10, 1.8, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
      } else if (st.glimpse === 'deep') {
        ctx.globalAlpha = k;
        ctx.fillStyle = 'rgba(120,200,255,.8)';
        for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(cx - 20 + hash(i) * 40, cy + 10 + hash(i + 3) * 18, 1.5 + hash(i + 5) * 2, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      return;
    }
    switch (kind) {
      case 'exit': {
        ctx.fillStyle = '#0c0907';
        ctx.beginPath(); ctx.ellipse(cx + 10, cy + 8, w * 0.24, h * 0.36, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(120,90,60,.6)'; ctx.lineWidth = 3; ctx.stroke();
        break;
      }
      case 'thorn': {
        ctx.fillStyle = '#0c0907'; ctx.beginPath(); ctx.ellipse(cx, cy + 6, w * 0.3, h * 0.38, 0, 0, 7); ctx.fill();
        // 奥の金の光
        const gl = 0.35 + 0.25 * Math.sin(time * 2.2);
        const gg = ctx.createRadialGradient(cx + 6, cy, 1, cx + 6, cy, 26);
        gg.addColorStop(0, `rgba(255,220,120,${gl})`); gg.addColorStop(1, 'rgba(255,200,90,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx + 6, cy, 26, 0, 7); ctx.fill();
        ctx.strokeStyle = '#4a5a22'; ctx.lineWidth = 5;
        for (let i = 0; i < 10; i++) {
          const a0 = hash(i * 5) * 6.28, r0 = 10 + hash(i * 2) * 30;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0 * 1.2);
          ctx.bezierCurveTo(cx + 40 * Math.cos(a0 + 1), cy + 30 * Math.sin(a0 + 2), cx - 30 * Math.cos(a0 + 2), cy - 40 * Math.sin(a0 + 1), cx + Math.cos(a0 + 3) * r0, cy + Math.sin(a0 + 3) * r0);
          ctx.stroke();
        }
        ctx.fillStyle = '#7a8a3a';
        for (let i = 0; i < 26; i++) {
          const tx = cx - 40 + hash(i * 11) * 80, ty = cy - 46 + hash(i * 13) * 92;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + 5, ty + 2); ctx.lineTo(tx + 1, ty + 7); ctx.fill();
        }
        break;
      }
      case 'crack': case 'final': {
        const fin = kind === 'final';
        ctx.fillStyle = fin ? '#2a2638' : '#3a3028';
        ctx.fillRect(x + 20, y, w - 20, h);
        ctx.strokeStyle = fin ? 'rgba(200,170,255,.85)' : 'rgba(255,214,140,.75)';
        ctx.shadowColor = fin ? '#b8a0ff' : '#ffd08a'; ctx.shadowBlur = 8 + 4 * Math.sin(time * 2);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - 6, y + 8); ctx.lineTo(cx + 6, cy - 22); ctx.lineTo(cx - 8, cy - 4); ctx.lineTo(cx + 10, cy + 12); ctx.lineTo(cx - 2, y + h - 8);
        ctx.moveTo(cx + 6, cy - 22); ctx.lineTo(cx + 30, cy - 30); ctx.moveTo(cx - 8, cy - 4); ctx.lineTo(cx - 30, cy + 4); ctx.moveTo(cx + 10, cy + 12); ctx.lineTo(cx + 34, cy + 24);
        ctx.stroke();
        ctx.shadowBlur = 0;
        if (fin) {
          for (const [el, k] of [['fire', 0], ['ice', 1], ['bolt', 2], ['light', 3]]) V.elIcon(ctx, el, x + 40 + k * 28, y + 18, 8, V.EL_COL[el] + '99');
        }
        break;
      }
      case 'lake': {
        ctx.fillStyle = '#123048'; ctx.fillRect(x + 10, cy - 4, w, h);
        const wg = ctx.createLinearGradient(0, cy - 4, 0, y + h);
        wg.addColorStop(0, 'rgba(90,180,230,.7)'); wg.addColorStop(1, 'rgba(20,60,100,.9)');
        ctx.fillStyle = wg; ctx.fillRect(x + 10, cy - 4, w, h);
        ctx.strokeStyle = 'rgba(200,240,255,.6)'; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) { const yy = cy + 4 + i * 12; ctx.beginPath(); for (let k = 0; k <= 10; k++) { const xx = x + 10 + k * (w / 10); ctx.lineTo(xx, yy + Math.sin(time * 2 + k + i) * 2.5); } ctx.stroke(); }
        // 向こう岸の光
        ctx.fillStyle = 'rgba(255,230,150,.7)'; ctx.beginPath(); ctx.arc(x + w - 24, cy - 22, 4 + Math.sin(time * 3), 0, 7); ctx.fill();
        break;
      }
      case 'gear': {
        for (const [gx, gy, r, sp] of [[cx, cy, 34, 1], [cx + 36, cy - 30, 18, -1.9], [cx - 30, cy + 34, 16, -2.1]]) {
          ctx.save(); ctx.translate(gx, gy); ctx.rotate((st.spin || 0) * sp);
          ctx.fillStyle = '#8a6a3a'; ctx.strokeStyle = '#4a3a20'; ctx.lineWidth = 2;
          ctx.beginPath();
          const n = Math.round(r / 3.5);
          for (let k = 0; k < n * 2; k++) { const a = k * Math.PI / n, rad = k % 2 ? r : r * 0.8; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#3a2a18'; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, 7); ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = 'rgba(255,216,74,.5)'; V.elIcon(ctx, 'bolt', x + 34, y + 20, 9, 'rgba(255,216,74,.6)');
        break;
      }
      case 'seal': {
        ctx.fillStyle = '#4a4058'; rr(ctx, cx - 40, cy - 48, 80, 100, 10); ctx.fill();
        ctx.strokeStyle = '#8a7aa8'; ctx.lineWidth = 3; ctx.stroke();
        const gl = 0.5 + 0.3 * Math.sin(time * 2.4);
        ctx.strokeStyle = `rgba(255,240,170,${gl})`; ctx.shadowColor = '#fff0a0'; ctx.shadowBlur = 10; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 24, 0, 7); ctx.stroke();
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + time * 0.3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24); ctx.lineTo(cx + Math.cos(a + 2.1) * 24, cy + Math.sin(a + 2.1) * 24); ctx.stroke(); }
        ctx.shadowBlur = 0;
        break;
      }
      default: break;
    }
    ctx.restore();
  };

  // ---------- 戦場の背景（部屋の中） ----------
  const BG = {
    mine: { top: '#2a2418', bot: '#120e0a', rock: '#3a3020', ledge: '#5a4a32', ledge2: '#3e3222', acc: '#8aa04a' },
    lake: { top: '#14283a', bot: '#081018', rock: '#203448', ledge: '#3e5a70', ledge2: '#26394a', acc: '#8fe2ff' },
    library: { top: '#241a34', bot: '#0e0a16', rock: '#30264a', ledge: '#5a4a6e', ledge2: '#3a2e4a', acc: '#d8b8ff' },
    abyss: { top: '#0e1230', bot: '#04060e', rock: '#1a1e3a', ledge: '#3a3e62', ledge2: '#24284a', acc: '#a8b8ff' },
  };
  V.BG = BG;
  V.battleBg = function (ctx, bg, F, t) {
    const P = BG[bg] || BG.mine;
    const g = ctx.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, P.top); g.addColorStop(1, P.bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
    // 奥の岩肌
    ctx.fillStyle = P.rock;
    for (let i = 0; i < 18; i++) {
      const x = 440 + hash(i * 4.1) * 860, y = 70 + hash(i * 2.7) * 520;
      ctx.globalAlpha = 0.35 + hash(i) * 0.3;
      ctx.beginPath(); ctx.ellipse(x, y, 40 + hash(i * 9) * 70, 22 + hash(i * 5) * 30, hash(i * 3) * 3, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 飾り
    if (bg === 'mine') {
      ctx.strokeStyle = '#4a3a22'; ctx.lineWidth = 3;
      for (let i = 0; i < 9; i++) { const x = 500 + i * 90 + hash(i) * 30; ctx.beginPath(); ctx.moveTo(x, 50); ctx.bezierCurveTo(x + 10, 80, x - 10, 100, x + 4 * Math.sin(t + i), 120 + hash(i + 2) * 40); ctx.stroke(); }
      ctx.fillStyle = '#5a3e22'; ctx.fillRect(470, 60, 14, 520); ctx.fillRect(470, 56, 800, 10);
    } else if (bg === 'lake') {
      for (let i = 0; i < 14; i++) {
        const x = 480 + hash(i * 6.3) * 780, y = 60 + hash(i * 1.9) * 90;
        ctx.fillStyle = `rgba(140,220,255,${0.3 + 0.2 * Math.sin(t * 1.5 + i)})`;
        ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x, y + 24 + hash(i) * 20); ctx.lineTo(x + 6, y); ctx.closePath(); ctx.fill();
      }
    } else if (bg === 'library') {
      ctx.fillStyle = 'rgba(80,60,110,.45)';
      for (let i = 0; i < 6; i++) ctx.fillRect(520 + i * 130, 60, 22, 540);
      ctx.fillStyle = 'rgba(120,90,60,.3)';
      for (let i = 0; i < 5; i++) for (let k = 0; k < 7; k++) ctx.fillRect(548 + i * 130, 80 + k * 22, 96, 14);
    } else if (bg === 'abyss') {
      for (let i = 0; i < 40; i++) {
        const x = 440 + hash(i * 3.3) * 840, y = 50 + hash(i * 7.1) * 560;
        ctx.fillStyle = `rgba(180,200,255,${0.2 + 0.3 * Math.abs(Math.sin(t + i))})`;
        ctx.beginPath(); ctx.arc(x, y, 1 + hash(i) * 1.5, 0, 7); ctx.fill();
      }
    }
    // 三つの段
    for (let l = 0; l < 3; l++) {
      const y = F.Y + l * F.RH + F.RH - 14;
      const lg = ctx.createLinearGradient(0, y, 0, y + 22);
      lg.addColorStop(0, P.ledge); lg.addColorStop(1, P.ledge2);
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(F.X0 - 20, y + 4); ctx.lineTo(F.X1, y); ctx.lineTo(F.X1, y + 20); ctx.lineTo(F.X0 - 20, y + 22); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(F.X0 - 20, y + 4); ctx.lineTo(F.X1, y); ctx.stroke();
      // 段の下の暗がり
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(F.X0 - 20, y + 20, F.X1 - F.X0 + 20, 14);
    }
  };

  // 最後の番人の影（三つの段にまたがる巨体）
  V.guardian = function (ctx, x, y, t, a) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a * 0.85;
    ctx.translate(x, y);
    const g = ctx.createLinearGradient(0, -280, 0, 260);
    g.addColorStop(0, '#2a2640'); g.addColorStop(1, '#14121e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-60, -270); ctx.lineTo(60, -270); ctx.lineTo(90, -200); ctx.lineTo(230, -170); ctx.lineTo(270, 260); ctx.lineTo(-230, 260); ctx.lineTo(-200, -160); ctx.lineTo(-90, -200);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(160,140,230,.25)'; ctx.lineWidth = 3; ctx.stroke();
    // ひび
    ctx.strokeStyle = `rgba(190,170,255,${0.25 + 0.15 * Math.sin(t * 1.7)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-120, -120); ctx.lineTo(-80, -60); ctx.lineTo(-110, 10); ctx.moveTo(140, -100); ctx.lineTo(100, -20); ctx.lineTo(150, 60); ctx.stroke();
    // 目
    const eg = 0.6 + 0.4 * Math.sin(t * 2.2);
    for (const sx of [-30, 30]) {
      const rg = ctx.createRadialGradient(sx, -225, 1, sx, -225, 22);
      rg.addColorStop(0, `rgba(255,190,110,${eg})`); rg.addColorStop(1, 'rgba(255,150,80,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(sx, -225, 22, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(255,220,160,${eg})`; ctx.beginPath(); ctx.ellipse(sx, -225, 8, 4, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
  };

  // ---------- 地図 ----------
  // 羊皮紙（一度だけ描いておく）
  let paperCache = null;
  V.paper = function (w, h) {
    if (paperCache && paperCache.width === w && paperCache.height === h) return paperCache;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#efe0bf'); g.addColorStop(0.5, '#e8d6b0'); g.addColorStop(1, '#dcc59a');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      x.fillStyle = `rgba(${120 + hash(i) * 60},${90 + hash(i + 1) * 40},${50},${0.03 + hash(i + 2) * 0.05})`;
      x.beginPath(); x.arc(hash(i * 3) * w, hash(i * 5) * h, 1 + hash(i * 7) * 8, 0, 7); x.fill();
    }
    for (let i = 0; i < 60; i++) {
      x.strokeStyle = `rgba(140,100,60,${0.04 + hash(i) * 0.05})`;
      x.lineWidth = 1;
      const yy = hash(i * 9) * h;
      x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(w * 0.3, yy + 10, w * 0.6, yy - 10, w, yy + 4); x.stroke();
    }
    paperCache = c;
    return c;
  };
  // 部屋の形（ゆがんだ楕円）
  V.blobPath = function (ctx, r, k) {
    const n = 36;
    const s1 = hash(r.x * 0.13 + r.y * 0.07) * 6.28, s2 = hash(r.x * 0.31 + r.y * 0.11) * 6.28, s3 = hash(r.x * 0.07 + r.y * 0.29) * 6.28;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2;
      const wob = 1 + Math.sin(a * 2 + s1) * 0.07 + Math.sin(a * 3 + s2) * 0.05 + Math.sin(a * 5 + s3) * 0.03;
      const px = r.x + Math.cos(a) * r.rx * wob * k, py = r.y + Math.sin(a) * r.ry * wob * k;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  // 部屋の中に描く小さな絵
  V.roomIcon = function (ctx, kind, x, y, t, col) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = col || '#3a2a18'; ctx.fillStyle = col || '#3a2a18'; ctx.lineWidth = 2;
    if (kind === 'chest') {
      ctx.fillStyle = '#a06a30'; ctx.fillRect(-11, -6, 22, 13); ctx.strokeRect(-11, -6, 22, 13);
      ctx.fillStyle = '#e8b830'; ctx.fillRect(-11, -9, 22, 5); ctx.fillRect(-2, -3, 4, 6);
    } else if (kind === 'open') {
      ctx.strokeRect(-11, -4, 22, 11);
      ctx.beginPath(); ctx.moveTo(-11, -4); ctx.lineTo(-8, -13); ctx.lineTo(13, -13); ctx.lineTo(11, -4); ctx.stroke();
    } else if (kind === 'foe') {
      ctx.fillStyle = 'rgba(150,40,30,.85)';
      ctx.beginPath(); ctx.arc(-6, 0, 3, 0, 7); ctx.arc(6, 0, 3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(-2, -3); ctx.moveTo(12, -6); ctx.lineTo(2, -3); ctx.stroke();
    } else if (kind === 'boss') {
      ctx.fillStyle = 'rgba(150,40,30,.9)';
      ctx.beginPath(); ctx.moveTo(-12, 4); ctx.lineTo(-12, -6); ctx.lineTo(-6, -1); ctx.lineTo(0, -10); ctx.lineTo(6, -1); ctx.lineTo(12, -6); ctx.lineTo(12, 4); ctx.closePath(); ctx.fill();
    } else if (kind === 'done') {
      ctx.strokeStyle = 'rgba(60,110,60,.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-2, 6); ctx.lineTo(10, -7); ctx.stroke();
    }
    ctx.restore();
  };
  V.lookIcon = function (ctx, look, x, y, t) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(70,56,40,.75)'; ctx.fillStyle = 'rgba(70,56,40,.75)'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    if (look === 'glint') {
      const k = 0.7 + 0.3 * Math.sin(t * 3);
      ctx.fillStyle = `rgba(230,160,40,${k})`;
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rad = i % 2 ? 3 : 10; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } ctx.closePath(); ctx.fill();
    } else if (look === 'cold') {
      V.elIcon(ctx, 'ice', 0, 0, 9, 'rgba(60,120,170,.8)');
    } else if (look === 'gear') {
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.stroke();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + t; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); ctx.stroke(); }
    } else if (look === 'bones' || look === 'steps') {
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-10 + i * 10, (i % 2) * 5 - 2, 3, 4.5, 0.3, 0, 7); ctx.fill(); }
    } else if (look === 'ghost') {
      ctx.beginPath(); ctx.arc(0, -2, 7, Math.PI, 0); ctx.lineTo(7, 7); ctx.lineTo(3, 4); ctx.lineTo(0, 7); ctx.lineTo(-3, 4); ctx.lineTo(-7, 7); ctx.closePath(); ctx.stroke();
    } else {
      ctx.font = V.font(18, 700, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('？', 0, 1);
    }
    ctx.restore();
  };
  // 門（地図の道の上に描く）
  V.gateMark = function (ctx, kind, x, y, t, open) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = open ? 'rgba(240,230,200,.9)' : '#f3e6c6';
    ctx.strokeStyle = open ? 'rgba(90,140,80,.9)' : '#6a4a2a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill(); ctx.stroke();
    const el = { thorn: 'fire', lake: 'ice', gear: 'bolt', seal: 'light', crack: 'any', final: 'any' }[kind];
    if (open) { ctx.strokeStyle = 'rgba(60,120,60,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-1, 5); ctx.lineTo(7, -5); ctx.stroke(); }
    else V.elIcon(ctx, el, 0, 0, 8, el === 'any' ? '#6a4a2a' : V.EL_DARK[el]);
    ctx.restore();
  };

  // ---------- 小物 ----------
  V.heart = function (ctx, x, y, r, on) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9); ctx.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.6, -r * 1.2, 0, -r * 0.4);
    ctx.bezierCurveTo(r * 0.6, -r * 1.2, r * 1.4, -r * 0.1, 0, r * 0.9);
    ctx.fillStyle = on ? '#ff5a5a' : 'rgba(255,255,255,.12)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = on ? '#ffd0c8' : 'rgba(255,255,255,.3)'; ctx.stroke();
    ctx.restore();
  };
  V.orb = function (ctx, x, y, r, on, t) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    if (on) { g.addColorStop(0, '#e8f6ff'); g.addColorStop(1, '#4a8ae0'); } else { g.addColorStop(0, 'rgba(255,255,255,.15)'); g.addColorStop(1, 'rgba(255,255,255,.05)'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = on ? '#cfe6ff' : 'rgba(255,255,255,.25)'; ctx.stroke();
  };
  V.shell = function (ctx, x, y, r) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#f0d8c0'; ctx.strokeStyle = '#a07a5a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-r, r * 0.4); ctx.quadraticCurveTo(-r * 0.9, -r, 0, -r); ctx.quadraticCurveTo(r * 0.9, -r, r, r * 0.4); ctx.quadraticCurveTo(0, r * 0.8, -r, r * 0.4); ctx.fill(); ctx.stroke();
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.15, r * 0.5); ctx.lineTo(i * r * 0.4, -r * 0.8); ctx.stroke(); }
    ctx.restore();
  };

  root.GV = V;
})(typeof window !== 'undefined' ? window : this);
