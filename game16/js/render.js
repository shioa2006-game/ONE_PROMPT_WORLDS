// 呪いほどき — 描画（紋・床・魔物・人・背景）。すべて Canvas 2D で描く。
(function (root) {
  'use strict';
  const V = {};
  V.FONT = '"Hiragino Maru Gothic ProN", "Yu Gothic UI", "Meiryo", "Noto Sans JP", sans-serif';
  V.SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", serif';

  V.EL = {
    light: { c: '#ffd45e', g: '#fff3b8', d: '#a8741a', name: '光' },
    ice: { c: '#78d6ff', g: '#dcf7ff', d: '#2b6f9e', name: '氷' },
    bolt: { c: '#b48aff', g: '#ecdfff', d: '#5b3aa8', name: '雷' },
    star: { c: '#ffffff', g: '#ffffff', d: '#9a8fb8', name: '星' },
    gem: { c: '#ff7fd4', g: '#ffe0f4', d: '#a1347d', name: '晶' },
  };

  // ---------- 基本 ----------
  V.rr = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  };
  V.text = function (ctx, s, x, y, o) {
    o = o || {};
    ctx.font = (o.weight || 'bold') + ' ' + (o.size || 18) + 'px ' + (o.serif ? V.SERIF : V.FONT);
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'middle';
    if (o.shadow !== false && (o.shadow || o.stroke)) {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = o.stroke || 'rgba(0,0,0,0.65)';
      ctx.lineWidth = o.sw || 4;
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(s, x, y);
  };
  // 折り返し付きの文章（日本語は1文字ずつ）
  V.wrap = function (ctx, s, maxW, size, serif) {
    ctx.font = 'bold ' + size + 'px ' + (serif ? V.SERIF : V.FONT);
    const lines = [];
    for (const para of String(s).split('\n')) {
      let cur = '';
      for (const ch of para) {
        if (ctx.measureText(cur + ch).width > maxW && cur) {
          // 句読点は行頭に来ないように
          if ('、。」）！？…ー'.indexOf(ch) >= 0) { cur += ch; continue; }
          lines.push(cur); cur = ch;
        } else cur += ch;
      }
      lines.push(cur);
    }
    return lines;
  };
  V.para = function (ctx, s, x, y, maxW, o) {
    o = o || {};
    const size = o.size || 18, lh = o.lh || size * 1.55;
    const lines = V.wrap(ctx, s, maxW, size, o.serif);
    lines.forEach((ln, i) => V.text(ctx, ln, x, y + i * lh, Object.assign({ base: 'top' }, o)));
    return lines.length * lh;
  };
  V.panel = function (ctx, x, y, w, h, o) {
    o = o || {};
    ctx.save();
    V.rr(ctx, x, y, w, h, o.r || 14);
    ctx.fillStyle = o.fill || 'rgba(20,16,36,0.86)';
    ctx.fill();
    ctx.lineWidth = o.lw || 2;
    ctx.strokeStyle = o.stroke || 'rgba(255,226,160,0.35)';
    ctx.stroke();
    ctx.restore();
  };
  V.button = function (ctx, b, t) {
    const hot = b.hot && b.enabled !== false;
    const dis = b.enabled === false;
    ctx.save();
    const lift = hot ? -2 : 0;
    V.rr(ctx, b.x, b.y + lift, b.w, b.h, b.r || 12);
    let fill = b.fill || '#3b2f63';
    if (b.primary) fill = dis ? '#4a4258' : hot ? '#f4c456' : '#e6ad3a';
    else if (dis) fill = 'rgba(60,54,74,0.85)';
    else if (hot) fill = b.hotFill || '#54458a';
    if (b.on) fill = b.onFill || '#7a5bd0';
    ctx.fillStyle = fill;
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = hot ? 12 : 6; ctx.shadowOffsetY = 3;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2;
    ctx.strokeStyle = b.primary ? (dis ? '#6b6378' : '#fff1c2') : hot ? 'rgba(255,236,190,0.8)' : 'rgba(255,236,190,0.35)';
    ctx.stroke();
    if (b.pulse && !dis) {
      const a = 0.35 + 0.35 * Math.sin(t * 5);
      V.rr(ctx, b.x - 4, b.y - 4 + lift, b.w + 8, b.h + 8, (b.r || 12) + 4);
      ctx.strokeStyle = 'rgba(255,230,140,' + a + ')'; ctx.lineWidth = 3; ctx.stroke();
    }
    const col = b.primary ? (dis ? '#9a92a8' : '#3a2408') : dis ? '#8e88a0' : '#fff6e0';
    if (b.label) V.text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + lift + (b.sub ? -9 : 0), { size: b.size || 18, align: 'center', color: col });
    if (b.sub) V.text(ctx, b.sub, b.x + b.w / 2, b.y + b.h / 2 + lift + 13, { size: 12, align: 'center', color: b.primary ? (dis ? '#8a8298' : '#5b3d12') : '#cfc4e8', weight: 'normal' });
    if (b.draw) b.draw(ctx, b, lift);
    ctx.restore();
  };

  // ---------- 紋 ----------
  V.glyph = function (ctx, t, x, y, s, alpha, lit) {
    const e = V.EL[t];
    if (!e) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha *= (alpha === undefined ? 1 : alpha);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = e.c; ctx.shadowBlur = lit ? s * 0.9 : s * 0.35;
    ctx.fillStyle = lit ? e.g : e.c;
    ctx.strokeStyle = lit ? e.g : e.c;
    const r = s * 0.5;
    if (t === 'light') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = s * 0.08;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const r1 = r * 0.6, r2 = r * (i % 2 ? 0.82 : 0.98);
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); ctx.stroke();
      }
    } else if (t === 'ice') {
      ctx.lineWidth = s * 0.075;
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3 + Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95); ctx.lineTo(-Math.cos(a) * r * 0.95, -Math.sin(a) * r * 0.95); ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + Math.PI / 2, bx = Math.cos(a) * r * 0.6, by = Math.sin(a) * r * 0.6;
        for (const sgn of [-1, 1]) {
          const a2 = a + sgn * 0.7;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a2) * r * 0.28, by + Math.sin(a2) * r * 0.28); ctx.stroke();
        }
      }
      ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2); ctx.fill();
    } else if (t === 'bolt') {
      ctx.beginPath();
      ctx.moveTo(r * 0.18, -r * 0.98); ctx.lineTo(-r * 0.5, r * 0.08); ctx.lineTo(-r * 0.02, r * 0.08);
      ctx.lineTo(-r * 0.22, r * 0.98); ctx.lineTo(r * 0.55, -r * 0.16); ctx.lineTo(r * 0.06, -r * 0.16); ctx.closePath();
      ctx.fill();
    } else if (t === 'star') {
      const cols = ['#ffd45e', '#78d6ff', '#b48aff', '#ff7fd4', '#9dffb0'];
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r * 0.98;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      const gr = ctx.createLinearGradient(-r, -r, r, r);
      cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), lit ? '#ffffff' : c));
      ctx.fillStyle = gr; ctx.shadowColor = '#fff'; ctx.fill();
    } else if (t === 'gem') {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.95); ctx.lineTo(r * 0.7, -r * 0.25); ctx.lineTo(0, r * 0.98); ctx.lineTo(-r * 0.7, -r * 0.25); ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = s * 0.03;
      ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.25); ctx.lineTo(r * 0.7, -r * 0.25); ctx.moveTo(-r * 0.25, -r * 0.25); ctx.lineTo(0, r * 0.98); ctx.lineTo(r * 0.25, -r * 0.25); ctx.stroke();
    }
    ctx.restore();
  };
  V.pips = function (ctx, lv, x, y, s, col) {
    if (!lv || lv < 2) return;
    ctx.save();
    ctx.fillStyle = col || '#fff';
    for (let i = 0; i < lv; i++) {
      ctx.beginPath(); ctx.arc(x + (i - (lv - 1) / 2) * s * 1.6, y, s * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  // 床のタイル（石）。cell = {t, lv}
  V.tile = function (ctx, cell, x, y, w, h, o) {
    o = o || {};
    ctx.save();
    const inset = 3;
    V.rr(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, 10);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    if (o.dark) { g.addColorStop(0, '#2b2738'); g.addColorStop(1, '#1d1a28'); }
    else { g.addColorStop(0, '#4b4560'); g.addColorStop(1, '#353048'); }
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = o.edge || 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2; ctx.stroke();
    // 刻み
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    V.rr(ctx, x + 9, y + 9, w - 18, h - 18, 7); ctx.stroke();
    if (cell && cell.t !== 'blank') {
      const e = V.EL[cell.t];
      // 下地の光
      const rg = ctx.createRadialGradient(x + w / 2, y + h / 2, 2, x + w / 2, y + h / 2, Math.min(w, h) * 0.55);
      rg.addColorStop(0, hexA(e.c, o.lit ? 0.55 : 0.22)); rg.addColorStop(1, hexA(e.c, 0));
      ctx.fillStyle = rg; ctx.fillRect(x, y, w, h);
      const gs = Math.min(w, h) * (o.gscale || 0.5);
      V.glyph(ctx, cell.t, x + w / 2, y + h / 2 - (cell.lv > 1 ? gs * 0.1 : 0), gs, o.alpha, o.lit);
      V.pips(ctx, cell.lv, x + w / 2, y + h - Math.max(8, h * 0.12), Math.max(2.2, gs * 0.07), e.g);
      if (o.fresh) {
        V.text(ctx, '新', x + w - 16, y + 16, { size: 13, align: 'center', color: '#fff6b0', stroke: '#6a3d00', sw: 3 });
      }
    }
    ctx.restore();
  };
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  V.hexA = hexA;

  // ---------- 魔物（呪われた姿） ----------
  // x,y：足元の中心。s：大きさ（マスの幅ほど）。t：時間
  V.monster = function (ctx, m, x, y, s, t, o) {
    o = o || {};
    ctx.save();
    ctx.translate(x, y);
    const bob = Math.sin(t * 3 + m.id) * s * 0.015;
    const k = m.k;
    const body = o.hurt ? '#5a2a50' : '#2a1838';
    const rim = o.frozen ? '#9fe6ff' : '#8a4fb8';
    const eye = k === 'wolf' ? '#ff5a5a' : k === 'wisp' ? '#9ff4ff' : k === 'golem' ? '#ffb347' : '#ffe066';
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.32 * (m.w || 1), s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    // 呪いのもや
    for (let i = 0; i < 5; i++) {
      const a = t * 1.3 + i * 1.7 + m.id;
      const px = Math.cos(a) * s * 0.28 * (m.w || 1), py = -s * 0.25 - Math.abs(Math.sin(a * 0.7)) * s * 0.4;
      ctx.fillStyle = 'rgba(150,80,200,' + (0.10 + 0.06 * Math.sin(a * 2)) + ')';
      ctx.beginPath(); ctx.arc(px, py, s * 0.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.translate(0, bob);
    ctx.fillStyle = body;
    ctx.strokeStyle = rim; ctx.lineWidth = Math.max(2, s * 0.02);
    ctx.shadowColor = o.frozen ? '#9fe6ff' : '#b26cff'; ctx.shadowBlur = s * 0.12;
    if (m.boss) drawBoss(ctx, m, s, t, eye);
    else if (k === 'imp') {
      ctx.beginPath();
      ctx.moveTo(-s * 0.22, 0); ctx.quadraticCurveTo(-s * 0.3, -s * 0.36, -s * 0.12, -s * 0.48);
      ctx.lineTo(-s * 0.16, -s * 0.62); ctx.lineTo(-s * 0.04, -s * 0.5); ctx.lineTo(s * 0.04, -s * 0.5); ctx.lineTo(s * 0.16, -s * 0.62);
      ctx.lineTo(s * 0.12, -s * 0.48); ctx.quadraticCurveTo(s * 0.3, -s * 0.36, s * 0.22, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      eyes(ctx, s, -s * 0.33, 0.07, eye, t, m.id);
    } else if (k === 'wisp') {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.bezierCurveTo(s * 0.22, -s * 0.42, s * 0.2, -s * 0.12, s * 0.12, -s * 0.04);
      ctx.quadraticCurveTo(s * 0.06, s * 0.02 + Math.sin(t * 6) * 3, 0, -s * 0.05);
      ctx.quadraticCurveTo(-s * 0.06, s * 0.02 + Math.cos(t * 6) * 3, -s * 0.12, -s * 0.04);
      ctx.bezierCurveTo(-s * 0.2, -s * 0.12, -s * 0.22, -s * 0.42, 0, -s * 0.5);
      ctx.fill(); ctx.stroke();
      eyes(ctx, s * 0.8, -s * 0.3, 0.07, eye, t, m.id);
    } else if (k === 'wolf') {
      ctx.beginPath();
      ctx.moveTo(-s * 0.32, -s * 0.05); ctx.lineTo(-s * 0.28, -s * 0.3); ctx.quadraticCurveTo(-s * 0.05, -s * 0.36, s * 0.12, -s * 0.32);
      ctx.lineTo(s * 0.16, -s * 0.52); ctx.lineTo(s * 0.22, -s * 0.38); ctx.lineTo(s * 0.3, -s * 0.5); ctx.lineTo(s * 0.32, -s * 0.34);
      ctx.lineTo(s * 0.4, -s * 0.26); ctx.lineTo(s * 0.3, -s * 0.18); ctx.lineTo(s * 0.2, -s * 0.2);
      ctx.lineTo(s * 0.2, 0); ctx.lineTo(s * 0.1, 0); ctx.lineTo(s * 0.06, -s * 0.12); ctx.lineTo(-s * 0.16, -s * 0.12); ctx.lineTo(-s * 0.2, 0); ctx.lineTo(-s * 0.3, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // しっぽ
      ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.24); ctx.quadraticCurveTo(-s * 0.46, -s * 0.34 + Math.sin(t * 8) * 4, -s * 0.44, -s * 0.12); ctx.stroke();
      ctx.shadowBlur = 8; ctx.fillStyle = eye;
      ctx.beginPath(); ctx.arc(s * 0.27, -s * 0.33, s * 0.03, 0, Math.PI * 2); ctx.fill();
    } else if (k === 'golem') {
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, 0); ctx.lineTo(-s * 0.34, -s * 0.3); ctx.lineTo(-s * 0.22, -s * 0.52); ctx.lineTo(s * 0.04, -s * 0.58);
      ctx.lineTo(s * 0.26, -s * 0.5); ctx.lineTo(s * 0.34, -s * 0.26); ctx.lineTo(s * 0.3, 0); ctx.closePath();
      ctx.fillStyle = '#3a3040'; ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.28); ctx.lineTo(s * 0.0, -s * 0.22); ctx.lineTo(s * 0.32, -s * 0.3); ctx.moveTo(s * 0.0, -s * 0.22); ctx.lineTo(s * 0.04, 0); ctx.stroke();
      eyes(ctx, s, -s * 0.4, 0.09, eye, t, m.id);
    } else if (k === 'knight') {
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, 0); ctx.lineTo(-s * 0.24, -s * 0.36); ctx.lineTo(-s * 0.14, -s * 0.46); ctx.lineTo(-s * 0.14, -s * 0.62);
      ctx.quadraticCurveTo(0, -s * 0.72, s * 0.14, -s * 0.62); ctx.lineTo(s * 0.14, -s * 0.46); ctx.lineTo(s * 0.24, -s * 0.36); ctx.lineTo(s * 0.2, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // 剣
      ctx.strokeStyle = '#a67fd6'; ctx.lineWidth = Math.max(2, s * 0.03);
      ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.05); ctx.lineTo(s * 0.3, -s * 0.6); ctx.moveTo(s * 0.22, -s * 0.18); ctx.lineTo(s * 0.38, -s * 0.18); ctx.stroke();
      // 兜のすき間
      ctx.shadowBlur = 8; ctx.fillStyle = eye;
      ctx.fillRect(-s * 0.09, -s * 0.57, s * 0.18, s * 0.03);
      // 羽根飾り
      ctx.fillStyle = '#5c2c7a'; ctx.beginPath(); ctx.moveTo(0, -s * 0.7); ctx.quadraticCurveTo(-s * 0.2, -s * 0.85, -s * 0.24, -s * 0.66); ctx.quadraticCurveTo(-s * 0.1, -s * 0.72, 0, -s * 0.7); ctx.fill();
    }
    ctx.restore();
  };
  function eyes(ctx, s, y, gap, col, t, id) {
    const blink = (Math.sin(t * 1.7 + id * 3) > 0.97) ? 0.2 : 1;
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.fillStyle = col;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * s * gap, y, s * 0.035, s * 0.045 * blink, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function drawBoss(ctx, m, s, t, eye) {
    const W = s * m.w, H = s * m.h;
    const who = m.who;
    ctx.save();
    if (who === 'witch') {
      // 灰の衣をまとった大きな影
      ctx.beginPath();
      ctx.moveTo(-W * 0.42, 0); ctx.quadraticCurveTo(-W * 0.5, -H * 0.5, -W * 0.18, -H * 0.78);
      ctx.lineTo(-W * 0.1, -H * 0.98); ctx.quadraticCurveTo(W * 0.15, -H * 0.88, W * 0.18, -H * 0.76);
      ctx.quadraticCurveTo(W * 0.5, -H * 0.5, W * 0.42, 0);
      for (let i = 6; i >= 0; i--) ctx.lineTo(-W * 0.42 + W * 0.84 * i / 6, -(i % 2) * s * 0.08 + Math.sin(t * 3 + i) * 3);
      ctx.closePath(); ctx.fillStyle = '#231629'; ctx.fill(); ctx.stroke();
      eyes(ctx, s * 1.4, -H * 0.66, 0.08, '#ff8af0', t, 7);
      // 灰のかけら
      ctx.fillStyle = 'rgba(200,190,210,0.5)';
      for (let i = 0; i < 8; i++) { const a = t * 0.8 + i; ctx.fillRect(Math.cos(a * 1.3) * W * 0.5, -H * 0.5 + Math.sin(a) * H * 0.4, 3, 3); }
    } else if (who === 'hunter') {
      ctx.beginPath();
      ctx.moveTo(-W * 0.4, 0); ctx.lineTo(-W * 0.36, -H * 0.4); ctx.quadraticCurveTo(-W * 0.1, -H * 0.5, W * 0.12, -H * 0.46);
      ctx.lineTo(W * 0.14, -H * 0.72); ctx.lineTo(W * 0.24, -H * 0.54); ctx.lineTo(W * 0.32, -H * 0.7); ctx.lineTo(W * 0.34, -H * 0.5);
      ctx.lineTo(W * 0.46, -H * 0.4); ctx.lineTo(W * 0.32, -H * 0.3); ctx.lineTo(W * 0.24, -H * 0.3);
      ctx.lineTo(W * 0.24, 0); ctx.lineTo(W * 0.12, 0); ctx.lineTo(W * 0.08, -H * 0.18); ctx.lineTo(-W * 0.2, -H * 0.18); ctx.lineTo(-W * 0.24, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff5a5a'; ctx.shadowColor = '#ff5a5a'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(W * 0.28, -H * 0.48, s * 0.05, 0, Math.PI * 2); ctx.fill();
    } else if (who === 'smith') {
      ctx.beginPath();
      ctx.moveTo(-W * 0.4, 0); ctx.lineTo(-W * 0.44, -H * 0.4); ctx.lineTo(-W * 0.3, -H * 0.7); ctx.lineTo(0, -H * 0.82);
      ctx.lineTo(W * 0.3, -H * 0.7); ctx.lineTo(W * 0.44, -H * 0.38); ctx.lineTo(W * 0.4, 0); ctx.closePath();
      ctx.fillStyle = '#382c3c'; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.moveTo(-W * 0.4, -H * 0.38); ctx.lineTo(0, -H * 0.3); ctx.lineTo(W * 0.42, -H * 0.42); ctx.moveTo(0, -H * 0.3); ctx.lineTo(W * 0.04, 0); ctx.stroke();
      // 槌
      ctx.fillStyle = '#5b4a66'; ctx.fillRect(W * 0.36, -H * 0.9, s * 0.08, H * 0.6); ctx.fillRect(W * 0.24, -H * 0.98, s * 0.32, s * 0.16);
      eyes(ctx, s * 1.4, -H * 0.58, 0.1, '#ffb347', t, 3);
    } else if (who === 'sage') {
      // 霧の大樹
      ctx.beginPath();
      ctx.moveTo(-W * 0.16, 0); ctx.lineTo(-W * 0.12, -H * 0.4);
      for (let i = 0; i <= 10; i++) { const a = Math.PI + i * Math.PI / 10; ctx.lineTo(Math.cos(a) * W * 0.46, -H * 0.56 + Math.sin(a) * H * 0.36 + Math.sin(t * 2 + i) * 3); }
      ctx.lineTo(W * 0.12, -H * 0.4); ctx.lineTo(W * 0.16, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      eyes(ctx, s * 1.4, -H * 0.56, 0.09, '#9ff4ff', t, 5);
    } else if (who === 'princess') {
      ctx.beginPath();
      ctx.moveTo(-W * 0.36, 0); ctx.lineTo(-W * 0.26, -H * 0.4); ctx.lineTo(-W * 0.16, -H * 0.5); ctx.lineTo(-W * 0.16, -H * 0.74);
      ctx.quadraticCurveTo(0, -H * 0.86, W * 0.16, -H * 0.74); ctx.lineTo(W * 0.16, -H * 0.5); ctx.lineTo(W * 0.26, -H * 0.4); ctx.lineTo(W * 0.36, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // 冠
      ctx.fillStyle = '#9a6fd0';
      ctx.beginPath(); ctx.moveTo(-W * 0.14, -H * 0.8); ctx.lineTo(-W * 0.1, -H * 0.92); ctx.lineTo(-W * 0.04, -H * 0.84); ctx.lineTo(0, -H * 0.96); ctx.lineTo(W * 0.04, -H * 0.84); ctx.lineTo(W * 0.1, -H * 0.92); ctx.lineTo(W * 0.14, -H * 0.8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a67fd6'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(W * 0.4, -H * 0.05); ctx.lineTo(W * 0.4, -H * 0.8); ctx.moveTo(W * 0.32, -H * 0.24); ctx.lineTo(W * 0.48, -H * 0.24); ctx.stroke();
      ctx.shadowBlur = 10; ctx.fillStyle = eye; ctx.fillRect(-W * 0.08, -H * 0.66, W * 0.16, s * 0.04);
    } else {
      // 村長：角の大鬼
      ctx.beginPath();
      ctx.moveTo(-W * 0.38, 0); ctx.quadraticCurveTo(-W * 0.48, -H * 0.5, -W * 0.22, -H * 0.66);
      ctx.lineTo(-W * 0.3, -H * 0.9); ctx.lineTo(-W * 0.1, -H * 0.7); ctx.lineTo(W * 0.1, -H * 0.7); ctx.lineTo(W * 0.3, -H * 0.9);
      ctx.lineTo(W * 0.22, -H * 0.66); ctx.quadraticCurveTo(W * 0.48, -H * 0.5, W * 0.38, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // ひげ
      ctx.fillStyle = '#4a2d5c';
      ctx.beginPath(); ctx.moveTo(-W * 0.14, -H * 0.4); ctx.quadraticCurveTo(0, -H * 0.12, W * 0.14, -H * 0.4); ctx.quadraticCurveTo(0, -H * 0.3, -W * 0.14, -H * 0.4); ctx.fill();
      eyes(ctx, s * 1.4, -H * 0.52, 0.1, eye, t, 1);
    }
    ctx.restore();
  }

  // ---------- 人（呪いがほどけた姿） ----------
  const PEOPLE = {
    villager: { skin: '#f3c9a0', hair: '#7a4b2a', cloth: '#c8783c', hat: 'straw' },
    child: { skin: '#f6d2b0', hair: '#4a2e1a', cloth: '#ff8fa8', small: true },
    dog: { dog: true },
    miner: { skin: '#e8b890', hair: '#3a2a20', cloth: '#7a6a5a', hat: 'helm' },
    soldier: { skin: '#f0c49c', hair: '#5a3a20', cloth: '#3f6fc4', hat: 'cap' },
    elder: { skin: '#f0c8a4', hair: '#e8e8e8', cloth: '#8a5a3a', beard: true },
    hunter: { skin: '#e8b48c', hair: '#6a3a1a', cloth: '#4f8a4a', hat: 'hood' },
    smith: { skin: '#e0a880', hair: '#2a1a10', cloth: '#5a4a44', apron: true, beard: true },
    sage: { skin: '#f0d0b0', hair: '#cfd8ff', cloth: '#5b6fc4', beard: true, hat: 'wiz' },
    princess: { skin: '#f8d8bc', hair: '#e8b84a', cloth: '#e86fa0', hat: 'tiara', dress: true },
    witch: { skin: '#f4d8c4', hair: '#b8b0c8', cloth: '#6a5a8a', hat: 'witch', dress: true },
    scarecrow: { skin: '#e8c070', hair: '#c89a40', cloth: '#a0784a', hat: 'straw' },
  };
  V.PEOPLE = PEOPLE;
  V.person = function (ctx, who, x, y, s, t, o) {
    o = o || {};
    const p = PEOPLE[who] || PEOPLE.villager;
    ctx.save();
    ctx.translate(x, y);
    if (o.flip) ctx.scale(-1, 1);
    const hop = o.run ? Math.abs(Math.sin(t * 12)) * s * 0.06 : o.wave ? Math.abs(Math.sin(t * 5)) * s * 0.02 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.16, s * 0.045, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, -hop);
    if (p.dog) {
      ctx.fillStyle = '#c89a5a';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.12, s * 0.17, s * 0.09, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.16, -s * 0.2, s * 0.08, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a5a2a'; ctx.beginPath(); ctx.ellipse(s * 0.12, -s * 0.27, s * 0.03, s * 0.05, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c89a5a';
      for (const lx of [-0.1, -0.02, 0.06, 0.12]) ctx.fillRect(lx * s, -s * 0.06, s * 0.03, s * 0.06);
      ctx.strokeStyle = '#c89a5a'; ctx.lineWidth = s * 0.03; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-s * 0.16, -s * 0.14); ctx.lineTo(-s * 0.24, -s * 0.24 + Math.sin(t * 14) * 3); ctx.stroke();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(s * 0.19, -s * 0.21, s * 0.012, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    const k = p.small ? 0.78 : 1;
    ctx.scale(k, k);
    // 足
    ctx.fillStyle = '#4a3a30';
    const leg = o.run ? Math.sin(t * 12) * s * 0.04 : 0;
    ctx.fillRect(-s * 0.07 + leg, -s * 0.12, s * 0.05, s * 0.12);
    ctx.fillRect(s * 0.02 - leg, -s * 0.12, s * 0.05, s * 0.12);
    // 体
    ctx.fillStyle = p.cloth;
    ctx.beginPath();
    if (p.dress) { ctx.moveTo(-s * 0.16, -s * 0.06); ctx.lineTo(-s * 0.08, -s * 0.36); ctx.lineTo(s * 0.08, -s * 0.36); ctx.lineTo(s * 0.16, -s * 0.06); }
    else { ctx.moveTo(-s * 0.12, -s * 0.1); ctx.lineTo(-s * 0.1, -s * 0.36); ctx.lineTo(s * 0.1, -s * 0.36); ctx.lineTo(s * 0.12, -s * 0.1); }
    ctx.closePath(); ctx.fill();
    if (p.apron) { ctx.fillStyle = '#8a6a4a'; ctx.fillRect(-s * 0.07, -s * 0.3, s * 0.14, s * 0.2); }
    // 腕（手を振る）
    ctx.strokeStyle = p.cloth; ctx.lineWidth = s * 0.045; ctx.lineCap = 'round';
    const wave = o.wave ? Math.sin(t * 9) * 0.5 : 0;
    ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.32); ctx.lineTo(-s * 0.17, -s * 0.18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.32);
    if (o.wave) ctx.lineTo(s * 0.2 + Math.cos(wave) * s * 0.02, -s * 0.46 + Math.sin(wave) * s * 0.03); else ctx.lineTo(s * 0.17, -s * 0.18);
    ctx.stroke();
    // 頭
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(0, -s * 0.46, s * 0.11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.hair;
    ctx.beginPath(); ctx.arc(0, -s * 0.49, s * 0.11, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    if (p.dress) { ctx.fillRect(-s * 0.11, -s * 0.5, s * 0.04, s * 0.14); ctx.fillRect(s * 0.07, -s * 0.5, s * 0.04, s * 0.14); }
    if (p.beard) { ctx.fillStyle = p.hair === '#2a1a10' ? '#3a2a20' : '#eeeeee'; ctx.beginPath(); ctx.moveTo(-s * 0.07, -s * 0.42); ctx.quadraticCurveTo(0, -s * 0.28, s * 0.07, -s * 0.42); ctx.fill(); }
    // 目
    ctx.fillStyle = '#2a1a1a';
    ctx.beginPath(); ctx.arc(-s * 0.035, -s * 0.46, s * 0.012, 0, Math.PI * 2); ctx.arc(s * 0.035, -s * 0.46, s * 0.012, 0, Math.PI * 2); ctx.fill();
    // ほお
    ctx.fillStyle = 'rgba(255,120,120,0.35)';
    ctx.beginPath(); ctx.arc(-s * 0.06, -s * 0.43, s * 0.018, 0, Math.PI * 2); ctx.arc(s * 0.06, -s * 0.43, s * 0.018, 0, Math.PI * 2); ctx.fill();
    // 帽子
    if (p.hat === 'straw') { ctx.fillStyle = '#e8cc6a'; ctx.beginPath(); ctx.ellipse(0, -s * 0.54, s * 0.17, s * 0.035, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(0, -s * 0.56, s * 0.08, Math.PI, 0); ctx.fill(); }
    if (p.hat === 'helm') { ctx.fillStyle = '#d8a440'; ctx.beginPath(); ctx.arc(0, -s * 0.52, s * 0.115, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff6a0'; ctx.beginPath(); ctx.arc(0, -s * 0.6, s * 0.025, 0, Math.PI * 2); ctx.fill(); }
    if (p.hat === 'cap') { ctx.fillStyle = '#9aa8c0'; ctx.beginPath(); ctx.arc(0, -s * 0.52, s * 0.115, Math.PI, 0); ctx.fill(); }
    if (p.hat === 'hood') { ctx.fillStyle = '#3f7a3a'; ctx.beginPath(); ctx.arc(0, -s * 0.5, s * 0.125, Math.PI * 0.95, Math.PI * 2.05); ctx.fill(); }
    if (p.hat === 'wiz') { ctx.fillStyle = '#4a5ab0'; ctx.beginPath(); ctx.moveTo(-s * 0.13, -s * 0.53); ctx.lineTo(s * 0.02, -s * 0.8); ctx.lineTo(s * 0.13, -s * 0.53); ctx.closePath(); ctx.fill(); }
    if (p.hat === 'tiara') { ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.moveTo(-s * 0.07, -s * 0.56); ctx.lineTo(-s * 0.04, -s * 0.63); ctx.lineTo(0, -s * 0.58); ctx.lineTo(s * 0.04, -s * 0.63); ctx.lineTo(s * 0.07, -s * 0.56); ctx.closePath(); ctx.fill(); }
    if (p.hat === 'witch') { ctx.fillStyle = '#4a3a6a'; ctx.beginPath(); ctx.ellipse(0, -s * 0.55, s * 0.18, s * 0.035, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-s * 0.09, -s * 0.56); ctx.lineTo(s * 0.06, -s * 0.84); ctx.lineTo(s * 0.09, -s * 0.56); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  };

  // ---------- 主人公（見習いの魔導士） ----------
  V.mage = function (ctx, x, y, s, t, pose) {
    ctx.save();
    ctx.translate(x, y);
    const cast = pose === 'cast' ? 1 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.22, s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
    const breathe = Math.sin(t * 2) * s * 0.008;
    // 衣
    const g = ctx.createLinearGradient(0, -s * 0.6, 0, 0);
    g.addColorStop(0, '#3b5bb8'); g.addColorStop(1, '#22306a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-s * 0.2, 0); ctx.lineTo(-s * 0.1, -s * 0.48 + breathe); ctx.lineTo(s * 0.1, -s * 0.48 + breathe); ctx.lineTo(s * 0.22, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd45e'; ctx.fillRect(-s * 0.12, -s * 0.2, s * 0.25, s * 0.03);
    // 頭
    ctx.fillStyle = '#f6d0ac'; ctx.beginPath(); ctx.arc(0, -s * 0.56 + breathe, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a3a2a'; ctx.beginPath(); ctx.arc(-s * 0.01, -s * 0.58 + breathe, s * 0.105, Math.PI * 0.9, Math.PI * 2.0); ctx.fill();
    ctx.fillStyle = '#2a1a1a'; ctx.beginPath(); ctx.arc(s * 0.04, -s * 0.56 + breathe, s * 0.012, 0, Math.PI * 2); ctx.fill();
    // 帽子
    ctx.fillStyle = '#2d3f8e';
    ctx.beginPath(); ctx.ellipse(0, -s * 0.64 + breathe, s * 0.2, s * 0.04, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-s * 0.11, -s * 0.66 + breathe); ctx.quadraticCurveTo(-s * 0.02, -s * 0.9, -s * 0.16, -s * 1.0 + Math.sin(t * 1.5) * 2); ctx.quadraticCurveTo(s * 0.06, -s * 0.9, s * 0.11, -s * 0.66 + breathe); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd45e'; ctx.beginPath(); ctx.arc(-s * 0.16, -s * 1.0 + Math.sin(t * 1.5) * 2, s * 0.025, 0, Math.PI * 2); ctx.fill();
    // 杖
    const ang = cast ? -0.9 : -0.15;
    ctx.save();
    ctx.translate(s * 0.14, -s * 0.32);
    ctx.rotate(ang);
    ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = s * 0.035; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, s * 0.28); ctx.lineTo(0, -s * 0.42); ctx.stroke();
    ctx.shadowColor = '#fff3b8'; ctx.shadowBlur = cast ? 30 : 14;
    ctx.fillStyle = cast ? '#ffffff' : '#ffe28a';
    ctx.beginPath(); ctx.arc(0, -s * 0.46, s * (cast ? 0.07 : 0.05), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 手
    ctx.fillStyle = '#f6d0ac'; ctx.beginPath(); ctx.arc(s * 0.14, -s * 0.32, s * 0.03, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  // ---------- 背景 ----------
  const SKY = {
    morning: ['#9cc8ee', '#f8d9a8'], dusk: ['#5b4a8a', '#f29a6a'], night: ['#151a3a', '#3b3266'],
    ash: ['#2a2230', '#5a4650'], dawn: ['#7aa8e0', '#ffd8a0'],
  };
  V.background = function (ctx, bg, time, t, W, H, curse, o) {
    o = o || {};
    const sky = SKY[time] || SKY.night;
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 星や太陽
    if (time === 'night' || time === 'ash') {
      for (let i = 0; i < 60; i++) {
        const x = (i * 211.7) % W, y = (i * 97.3) % (H * 0.45);
        ctx.fillStyle = 'rgba(255,255,240,' + (0.3 + 0.3 * Math.sin(t * 1.5 + i)) * (time === 'ash' ? 0.4 : 1) + ')';
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.fillStyle = time === 'ash' ? 'rgba(220,180,200,0.5)' : 'rgba(255,250,220,0.85)';
      ctx.beginPath(); ctx.arc(W * 0.82, H * 0.12, 26, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = time === 'dusk' ? 'rgba(255,190,120,0.9)' : 'rgba(255,250,220,0.9)';
      ctx.beginPath(); ctx.arc(W * 0.78, time === 'dusk' ? H * 0.46 : H * 0.14, 34, 0, Math.PI * 2); ctx.fill();
    }
    const hz = H * 0.4;
    // 遠景
    ctx.save();
    if (bg === 'village') {
      hills(ctx, W, hz, '#6a8a5a', '#4e6e48', t, 0.6);
      for (let i = 0; i < 6; i++) house(ctx, 640 + i * 110 + (i % 2) * 20, hz + 18 - (i % 3) * 6, 0.8 + (i % 3) * 0.15, i);
      windmill(ctx, 1170, hz - 10, t);
      fields(ctx, W, H, hz, '#c8a84a', '#a8883a');
      // 麦の畝
      ctx.strokeStyle = 'rgba(120,90,30,0.35)'; ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const y = hz + 34 + i * i * 2.2 + i * 6;
        if (y > H) break;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 4); ctx.stroke();
      }
    } else if (bg === 'forest') {
      hills(ctx, W, hz, '#24402e', '#1a3022', t, 0.5);
      for (let i = 0; i < 26; i++) tree(ctx, (i * 61) % W + 10, hz + 30 + (i % 3) * 10, 0.8 + (i % 4) * 0.2, '#1b3326');
      fields(ctx, W, H, hz, '#2d4a34', '#203a28');
    } else if (bg === 'mine') {
      ctx.fillStyle = '#3a3040';
      ctx.beginPath(); ctx.moveTo(0, hz + 40);
      for (let x = 0; x <= W; x += 40) ctx.lineTo(x, hz - 60 - Math.abs(Math.sin(x * 0.013)) * 120 - (x % 120 === 0 ? 30 : 0));
      ctx.lineTo(W, hz + 40); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(255,190,90,' + (0.5 + 0.3 * Math.sin(t * 3 + i)) + ')'; ctx.beginPath(); ctx.arc(680 + i * 130, hz - 20 + (i % 2) * 20, 5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#1e1824'; ctx.beginPath(); ctx.arc(1120, hz + 40, 60, Math.PI, 0); ctx.fill();
      fields(ctx, W, H, hz, '#4a4048', '#3a3238');
    } else if (bg === 'lake') {
      hills(ctx, W, hz - 20, '#3a4e6a', '#2e3e58', t, 0.4);
      ctx.fillStyle = '#4a6a90';
      ctx.fillRect(0, hz - 10, W, 60);
      for (let i = 0; i < 12; i++) { ctx.strokeStyle = 'rgba(200,230,255,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); const x = (i * 137 + t * 12) % W; ctx.moveTo(x, hz + 10 + (i % 4) * 10); ctx.lineTo(x + 40, hz + 10 + (i % 4) * 10); ctx.stroke(); }
      fields(ctx, W, H, hz + 40, '#3e5a5a', '#2e4848');
    } else if (bg === 'castle') {
      hills(ctx, W, hz, '#3a3a5a', '#2a2a48', t, 0.4);
      castle(ctx, 980, hz + 30, 1.2);
      fields(ctx, W, H, hz, '#4a4a5e', '#38384c');
    } else if (bg === 'tower') {
      ctx.fillStyle = '#2a2030';
      ctx.beginPath(); ctx.moveTo(1040, hz + 40); ctx.lineTo(1080, hz - 260); ctx.lineTo(1100, hz - 300); ctx.lineTo(1120, hz - 260); ctx.lineTo(1160, hz + 40); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,120,220,' + (0.5 + 0.3 * Math.sin(t * 2)) + ')'; ctx.beginPath(); ctx.arc(1100, hz - 250, 8, 0, Math.PI * 2); ctx.fill();
      hills(ctx, W, hz + 10, '#3a2e3a', '#2a222c', t, 0.3);
      fields(ctx, W, H, hz, '#4a3e44', '#3a3034');
    } else {
      hills(ctx, W, hz, '#5a7a8a', '#4a6a7a', t, 0.5);
      fields(ctx, W, H, hz, '#7a8a5a', '#6a7a4a');
    }
    ctx.restore();
    // 夜は地面も暗く
    if (time === 'night' || time === 'ash' || time === 'dusk') {
      ctx.fillStyle = time === 'dusk' ? 'rgba(40,20,50,0.25)' : 'rgba(12,10,36,0.45)';
      ctx.fillRect(0, hz + 20, W, H - hz);
    }
    // 呪いのもや（救うほど晴れる）
    if (curse > 0.01) {
      const cg = ctx.createLinearGradient(0, 0, 0, H);
      cg.addColorStop(0, 'rgba(70,30,100,' + 0.45 * curse + ')');
      cg.addColorStop(1, 'rgba(40,15,60,' + 0.55 * curse + ')');
      ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) {
        const x = ((i * 173 + t * 14 * (i % 2 ? 1 : -1)) % (W + 300)) - 150, y = H * 0.32 + (i % 4) * 50;
        const rg = ctx.createRadialGradient(x, y, 10, x, y, 180);
        rg.addColorStop(0, 'rgba(130,70,170,' + 0.18 * curse + ')'); rg.addColorStop(1, 'rgba(130,70,170,0)');
        ctx.fillStyle = rg; ctx.fillRect(x - 180, y - 180, 360, 360);
      }
    }
  };
  function hills(ctx, W, hz, c1, c2, t, amp) {
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.moveTo(0, hz + 30);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, hz - 30 - Math.sin(x * 0.004 + 1) * 40 * amp - Math.sin(x * 0.011) * 18);
    ctx.lineTo(W, hz + 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.moveTo(0, hz + 40);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, hz - 4 - Math.sin(x * 0.006 + 3) * 22 * amp);
    ctx.lineTo(W, hz + 40); ctx.closePath(); ctx.fill();
  }
  function fields(ctx, W, H, hz, c1, c2) {
    const g = ctx.createLinearGradient(0, hz, 0, H);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, hz + 20, W, H - hz);
  }
  function house(ctx, x, y, s, i) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = ['#d8c0a0', '#e0caa8', '#cdb090'][i % 3]; ctx.fillRect(-26, -34, 52, 34);
    ctx.fillStyle = ['#a04a3a', '#7a4a3a', '#8a5a3a'][i % 3];
    ctx.beginPath(); ctx.moveTo(-32, -32); ctx.lineTo(0, -58); ctx.lineTo(32, -32); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,120,0.8)'; ctx.fillRect(-14, -24, 10, 10);
    ctx.fillStyle = '#5a3a2a'; ctx.fillRect(6, -20, 12, 20);
    ctx.restore();
  }
  function windmill(ctx, x, y, t) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#e0d0b8'; ctx.beginPath(); ctx.moveTo(-16, 40); ctx.lineTo(-10, -30); ctx.lineTo(10, -30); ctx.lineTo(16, 40); ctx.closePath(); ctx.fill();
    ctx.translate(0, -30); ctx.rotate(t * 0.6);
    ctx.fillStyle = '#f4ead8';
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(-4, 0, 8, 46); }
    ctx.restore();
  }
  function tree(ctx, x, y, s, c) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#2a1e18'; ctx.fillRect(-4, -20, 8, 20);
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(-30, -16); ctx.lineTo(0, -110); ctx.lineTo(30, -16); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function castle(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#5a5470';
    ctx.fillRect(-180, -90, 360, 90);
    for (let i = -180; i < 180; i += 24) ctx.fillRect(i, -102, 14, 12);
    for (const tx of [-170, -60, 60, 170]) { ctx.fillRect(tx - 20, -170, 40, 170); ctx.beginPath(); ctx.moveTo(tx - 26, -170); ctx.lineTo(tx, -214); ctx.lineTo(tx + 26, -170); ctx.closePath(); ctx.fillStyle = '#4a3a6a'; ctx.fill(); ctx.fillStyle = '#5a5470'; }
    ctx.fillStyle = '#2a2438'; ctx.beginPath(); ctx.arc(0, 0, 34, Math.PI, 0); ctx.fill();
    ctx.restore();
  }

  // ---------- 地図 ----------
  // 羊皮紙の上の地形（海・川・山・森）
  V.mapTerrain = function (ctx, x0, y0, w, h, t) {
    ctx.save();
    // 海（右下）
    ctx.fillStyle = '#9cc4d8';
    ctx.beginPath(); ctx.moveTo(x0 + w * 0.55, y0 + h);
    ctx.bezierCurveTo(x0 + w * 0.62, y0 + h * 0.82, x0 + w * 0.8, y0 + h * 0.86, x0 + w * 0.86, y0 + h * 0.7);
    ctx.bezierCurveTo(x0 + w * 0.92, y0 + h * 0.58, x0 + w, y0 + h * 0.6, x0 + w, y0 + h * 0.5);
    ctx.lineTo(x0 + w, y0 + h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(70,110,140,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const wx = x0 + w * (0.7 + (i % 3) * 0.08), wy = y0 + h * (0.82 + Math.floor(i / 3) * 0.08); ctx.beginPath(); ctx.arc(wx, wy, 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    // 川（山から湖、海へ）
    ctx.strokeStyle = '#8ab8d0'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0 + w * 0.5, y0 + h * 0.05);
    ctx.bezierCurveTo(x0 + w * 0.55, y0 + h * 0.3, x0 + w * 0.6, y0 + h * 0.5, x0 + w * 0.63, y0 + h * 0.62);
    ctx.bezierCurveTo(x0 + w * 0.66, y0 + h * 0.75, x0 + w * 0.7, y0 + h * 0.85, x0 + w * 0.72, y0 + h * 0.95);
    ctx.stroke();
    // 山なみ（上の左）
    for (let i = 0; i < 9; i++) {
      const mx = x0 + w * (0.06 + i * 0.05), my = y0 + h * (0.22 + (i % 3) * 0.04), ms = 26 + (i % 4) * 6;
      ctx.fillStyle = '#b8a07a'; ctx.beginPath(); ctx.moveTo(mx - ms, my + ms * 0.6); ctx.lineTo(mx, my - ms * 0.6); ctx.lineTo(mx + ms, my + ms * 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f2ead8'; ctx.beginPath(); ctx.moveTo(mx - ms * 0.3, my - ms * 0.2); ctx.lineTo(mx, my - ms * 0.6); ctx.lineTo(mx + ms * 0.3, my - ms * 0.2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };
  // 地方の絵。freed なら明るく、そうでなければ呪いの紫に沈む
  V.mapIcon = function (ctx, kind, x, y, s, freed, t) {
    ctx.save();
    ctx.translate(x, y);
    const dim = freed ? 1 : 0.55;
    const col = (c) => freed ? c : '#6a5a7a';
    if (kind === 'village') {
      for (let i = 0; i < 3; i++) {
        const hx = (i - 1) * s * 0.5, hy = (i === 1 ? -s * 0.12 : 0);
        ctx.fillStyle = col('#e8d4b0'); ctx.fillRect(hx - s * 0.18, hy - s * 0.24, s * 0.36, s * 0.24);
        ctx.fillStyle = col('#b0503a'); ctx.beginPath(); ctx.moveTo(hx - s * 0.24, hy - s * 0.22); ctx.lineTo(hx, hy - s * 0.42); ctx.lineTo(hx + s * 0.24, hy - s * 0.22); ctx.closePath(); ctx.fill();
        if (freed) { ctx.fillStyle = 'rgba(255,220,120,0.9)'; ctx.fillRect(hx - s * 0.06, hy - s * 0.16, s * 0.08, s * 0.08); }
      }
      ctx.fillStyle = col('#d8b84a');
      for (let i = 0; i < 5; i++) ctx.fillRect(-s * 0.7 + i * s * 0.3, s * 0.12, s * 0.2, s * 0.06);
    } else if (kind === 'forest') {
      for (let i = 0; i < 6; i++) {
        const tx = (i % 3 - 1) * s * 0.36 + (i > 2 ? s * 0.18 : 0), ty = (i > 2 ? s * 0.1 : -s * 0.1);
        ctx.fillStyle = col('#3f7a46'); ctx.beginPath(); ctx.moveTo(tx - s * 0.18, ty); ctx.lineTo(tx, ty - s * 0.5); ctx.lineTo(tx + s * 0.18, ty); ctx.closePath(); ctx.fill();
      }
    } else if (kind === 'mine') {
      ctx.fillStyle = col('#8a7a6a'); ctx.beginPath(); ctx.moveTo(-s * 0.6, s * 0.1); ctx.lineTo(-s * 0.1, -s * 0.5); ctx.lineTo(s * 0.2, -s * 0.2); ctx.lineTo(s * 0.4, -s * 0.4); ctx.lineTo(s * 0.7, s * 0.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a2020'; ctx.beginPath(); ctx.arc(0, s * 0.1, s * 0.16, Math.PI, 0); ctx.fill();
      if (freed) { ctx.fillStyle = '#ffd070'; ctx.beginPath(); ctx.arc(s * 0.3, -s * 0.02, s * 0.05, 0, Math.PI * 2); ctx.fill(); }
    } else if (kind === 'lake') {
      ctx.fillStyle = freed ? '#7ab8e0' : '#6a6a8a'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = freed ? 'rgba(255,255,255,0.7)' : 'rgba(200,200,220,0.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.05); ctx.lineTo(-s * 0.1, -s * 0.05); ctx.moveTo(s * 0.1, s * 0.08); ctx.lineTo(s * 0.3, s * 0.08); ctx.stroke();
    } else if (kind === 'castle') {
      ctx.fillStyle = col('#c8c0d8');
      ctx.fillRect(-s * 0.5, -s * 0.3, s, s * 0.32);
      for (const tx of [-0.45, 0, 0.45]) { ctx.fillRect(tx * s - s * 0.1, -s * 0.6, s * 0.2, s * 0.62); ctx.fillStyle = col('#5a6ab8'); ctx.beginPath(); ctx.moveTo(tx * s - s * 0.13, -s * 0.6); ctx.lineTo(tx * s, -s * 0.82); ctx.lineTo(tx * s + s * 0.13, -s * 0.6); ctx.closePath(); ctx.fill(); ctx.fillStyle = col('#c8c0d8'); }
      if (freed) { ctx.fillStyle = '#e84a6a'; ctx.fillRect(0, -s * 1.0, s * 0.16, s * 0.1); ctx.fillStyle = '#5a4a3a'; ctx.fillRect(-s * 0.01, -s * 1.0, s * 0.02, s * 0.2); }
    } else if (kind === 'tower') {
      ctx.fillStyle = freed ? '#9a8ab0' : '#3a2a44';
      ctx.beginPath(); ctx.moveTo(-s * 0.22, s * 0.1); ctx.lineTo(-s * 0.1, -s * 0.8); ctx.lineTo(0, -s * 0.95); ctx.lineTo(s * 0.1, -s * 0.8); ctx.lineTo(s * 0.22, s * 0.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = freed ? '#fff3b8' : 'rgba(255,120,220,' + (0.6 + 0.3 * Math.sin(t * 3)) + ')';
      ctx.beginPath(); ctx.arc(0, -s * 0.7, s * 0.06, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = dim;
    ctx.restore();
  };

  root.RV = V;
})(this);
