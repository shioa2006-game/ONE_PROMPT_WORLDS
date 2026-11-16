/*
 * ころころ、ひらけ列島 ― 絵（すべて Canvas で描く）
 * 社長の顔・列車のコマ・マスの印・名物の種類・きっぷ・サイコロ・駅スタンプ
 */
(function (root) {
  'use strict';
  const KR = root.KR;
  const A = KR.ART = {};
  const TAU = Math.PI * 2;
  KR.FONT = (size, w) => (w || 700) + ' ' + Math.round(size) + 'px "Hiragino Maru Gothic ProN","BIZ UDPGothic","Yu Gothic UI","Meiryo",sans-serif';
  A.INK = '#3a2a1c';
  A.PAPER = '#fbf3e2';

  A.rr = function (c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  };
  A.circle = function (c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); };
  A.text = function (c, s, x, y, size, col, align, w, base) {
    c.font = KR.FONT(size, w); c.fillStyle = col || A.INK; c.textAlign = align || 'center'; c.textBaseline = base || 'middle';
    c.fillText(s, x, y);
  };
  A.textOutline = function (c, s, x, y, size, col, out, lw, align, w) {
    c.font = KR.FONT(size, w); c.textAlign = align || 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round'; c.strokeStyle = out; c.lineWidth = lw; c.strokeText(s, x, y);
    c.fillStyle = col; c.fillText(s, x, y);
  };
  // 文字の折りかえし（幅で）
  A.wrap = function (c, s, maxW, size, w) {
    c.font = KR.FONT(size, w);
    const out = []; let line = '';
    for (const ch of s) {
      if (ch === '\n') { out.push(line); line = ''; continue; }
      const t = line + ch;
      if (c.measureText(t).width > maxW && line) {
        // 句読点・小さい文字は 行頭に こないように
        if ('、。」）！？ゃゅょっぁぃぅぇぉャュョッー'.indexOf(ch) >= 0) { out.push(t); line = ''; continue; }
        out.push(line); line = ch;
      } else line = t;
    }
    if (line) out.push(line);
    return out;
  };

  // ------------------------------------------------------------ 社長の顔
  A.face = function (c, kind, x, y, r, mood) {
    c.save(); c.translate(x, y); c.scale(r / 40, r / 40);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const OUT = '#3b2615';
    c.strokeStyle = OUT; c.lineWidth = 2.6;
    if (kind === 'shiba') {
      // 耳
      c.fillStyle = '#d98a3d';
      c.beginPath(); c.moveTo(-30, -14); c.lineTo(-26, -40); c.lineTo(-8, -28); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(30, -14); c.lineTo(26, -40); c.lineTo(8, -28); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#f6d7b0';
      c.beginPath(); c.moveTo(-26, -18); c.lineTo(-24, -33); c.lineTo(-14, -26); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(26, -18); c.lineTo(24, -33); c.lineTo(14, -26); c.closePath(); c.fill();
      // 顔
      c.fillStyle = '#e09a4c'; A.circle(c, 0, 2, 32); c.fill(); c.stroke();
      c.fillStyle = '#fff4e4';
      c.beginPath(); c.ellipse(0, 14, 22, 17, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(-14, -4, 6, 4, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(14, -4, 6, 4, 0, 0, TAU); c.fill();
      // 目・鼻・口
      c.fillStyle = OUT;
      if (mood === 'happy') { c.lineWidth = 3; c.beginPath(); c.arc(-12, 2, 5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.beginPath(); c.arc(12, 2, 5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
      else { A.circle(c, -12, 1, 4); c.fill(); A.circle(c, 12, 1, 4); c.fill(); c.fillStyle = '#fff'; A.circle(c, -11, 0, 1.4); c.fill(); A.circle(c, 13, 0, 1.4); c.fill(); }
      c.fillStyle = OUT; c.beginPath(); c.ellipse(0, 10, 5, 3.6, 0, 0, TAU); c.fill();
      c.lineWidth = 2.4; c.beginPath(); c.moveTo(0, 13); c.quadraticCurveTo(-5, 21, -9, 17); c.moveTo(0, 13); c.quadraticCurveTo(5, 21, 9, 17); c.stroke();
      c.fillStyle = '#f39c9c'; c.globalAlpha = 0.5; A.circle(c, -20, 10, 5); c.fill(); A.circle(c, 20, 10, 5); c.fill(); c.globalAlpha = 1;
      // 車掌さんの帽子
      c.fillStyle = '#d6452b'; c.strokeStyle = OUT; c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(-20, -22); c.quadraticCurveTo(0, -40, 20, -22); c.lineTo(22, -18); c.lineTo(-22, -18); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#2b2b3a'; c.beginPath(); c.ellipse(0, -17, 24, 4.5, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#f4cf4b'; A.circle(c, 0, -26, 3.6); c.fill(); c.stroke();
    } else if (kind === 'fox') {
      c.fillStyle = '#e6913a';
      c.beginPath(); c.moveTo(-30, -6); c.lineTo(-28, -42); c.lineTo(-6, -26); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(30, -6); c.lineTo(28, -42); c.lineTo(6, -26); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#4a2a1a';
      c.beginPath(); c.moveTo(-28, -42); c.lineTo(-26, -30); c.lineTo(-19, -33); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(28, -42); c.lineTo(26, -30); c.lineTo(19, -33); c.closePath(); c.fill();
      c.fillStyle = '#eda04a';
      c.beginPath(); c.moveTo(-32, -6); c.quadraticCurveTo(-30, -30, 0, -30); c.quadraticCurveTo(30, -30, 32, -6); c.quadraticCurveTo(26, 22, 0, 32); c.quadraticCurveTo(-26, 22, -32, -6); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#fff6ea';
      c.beginPath(); c.moveTo(-30, 0); c.quadraticCurveTo(-14, 6, 0, 6); c.quadraticCurveTo(14, 6, 30, 0); c.quadraticCurveTo(22, 24, 0, 31); c.quadraticCurveTo(-22, 24, -30, 0); c.closePath(); c.fill();
      c.strokeStyle = OUT; c.lineWidth = 3;
      if (mood === 'happy') { c.beginPath(); c.arc(-12, -4, 5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.beginPath(); c.arc(12, -4, 5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
      else { c.beginPath(); c.moveTo(-18, -6); c.quadraticCurveTo(-12, -10, -6, -5); c.stroke(); c.beginPath(); c.moveTo(18, -6); c.quadraticCurveTo(12, -10, 6, -5); c.stroke(); }
      c.fillStyle = OUT; c.beginPath(); c.ellipse(0, 12, 4.5, 3.4, 0, 0, TAU); c.fill();
      c.lineWidth = 2.4; c.beginPath(); c.moveTo(-7, 19); c.quadraticCurveTo(0, 23, 8, 17); c.stroke();
      // ゆうぐれ色の スカーフ
      c.fillStyle = '#8a55cf'; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(-20, 27); c.quadraticCurveTo(0, 36, 20, 27); c.lineTo(18, 36); c.quadraticCurveTo(0, 44, -18, 36); c.closePath(); c.fill(); c.stroke();
    } else {
      // たぬき
      c.fillStyle = '#8a6a4c';
      A.circle(c, -22, -24, 10); c.fill(); c.stroke(); A.circle(c, 22, -24, 10); c.fill(); c.stroke();
      c.fillStyle = '#3e2c20'; A.circle(c, -22, -24, 5); c.fill(); A.circle(c, 22, -24, 5); c.fill();
      c.fillStyle = '#9b7a58'; c.beginPath(); c.ellipse(0, 3, 34, 30, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#f2e6d4'; c.beginPath(); c.ellipse(0, 14, 18, 14, 0, 0, TAU); c.fill();
      c.fillStyle = '#4a3528';
      c.beginPath(); c.ellipse(-13, 0, 11, 8, -0.35, 0, TAU); c.fill(); c.beginPath(); c.ellipse(13, 0, 11, 8, 0.35, 0, TAU); c.fill();
      c.fillStyle = '#fff';
      if (mood === 'happy') { c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(-12, 2, 4, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.beginPath(); c.arc(12, 2, 4, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.strokeStyle = OUT; }
      else { A.circle(c, -12, 0, 3.6); c.fill(); A.circle(c, 12, 0, 3.6); c.fill(); c.fillStyle = OUT; A.circle(c, -11.5, 0.5, 2); c.fill(); A.circle(c, 12.5, 0.5, 2); c.fill(); }
      c.fillStyle = OUT; c.beginPath(); c.ellipse(0, 10, 5, 3.6, 0, 0, TAU); c.fill();
      c.lineWidth = 2.4; c.beginPath(); c.arc(0, 15, 5, 0.2, Math.PI - 0.2); c.stroke();
      // つきよ色の 帽子
      c.fillStyle = '#2f7fd2'; c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(-14, -26); c.quadraticCurveTo(0, -42, 14, -26); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#f2d44a'; c.beginPath(); c.arc(4, -32, 4, 0.6, Math.PI * 1.6); c.arc(6, -33, 3, Math.PI * 1.6, 0.6, true); c.fill();
    }
    c.restore();
  };
  // 丸い枠つきの 顔
  A.portrait = function (c, pi, x, y, r, mood) {
    const co = KR.COMPANIES[pi];
    c.save();
    c.fillStyle = co.light; A.circle(c, x, y, r); c.fill();
    c.save(); A.circle(c, x, y, r - 1); c.clip();
    A.face(c, co.animal, x, y + r * 0.08, r * 0.92, mood);
    c.restore();
    c.lineWidth = Math.max(2, r * 0.1); c.strokeStyle = co.color; A.circle(c, x, y, r); c.stroke();
    c.restore();
  };

  // ------------------------------------------------------------ 列車のコマ（右向き。dir<0 で左向き）
  A.train = function (c, pi, x, y, s, dir, bob, glow) {
    const co = KR.COMPANIES[pi];
    c.save(); c.translate(x, y + (bob || 0)); c.scale(s * (dir < 0 ? -1 : 1), s);
    c.lineJoin = 'round';
    if (glow) { c.fillStyle = 'rgba(255,240,170,0.55)'; c.beginPath(); c.ellipse(0, 4, 36, 22, 0, 0, TAU); c.fill(); }
    // 影
    c.fillStyle = 'rgba(40,30,20,0.25)'; c.beginPath(); c.ellipse(0, 15, 26, 5, 0, 0, TAU); c.fill();
    const OUT = '#2e2117';
    c.strokeStyle = OUT; c.lineWidth = 2.4;
    // 運転室
    c.fillStyle = co.color; A.rr(c, -24, -18, 20, 28, 4); c.fill(); c.stroke();
    c.fillStyle = co.dark; A.rr(c, -26, -22, 24, 6, 3); c.fill(); c.stroke();
    // 窓と 顔
    c.fillStyle = '#fff9e8'; A.rr(c, -21, -12, 14, 12, 3); c.fill(); c.stroke();
    c.save(); A.rr(c, -21, -12, 14, 12, 3); c.clip();
    A.face(c, co.animal, -14, -4, 8, 'happy');
    c.restore();
    // ボイラー
    c.fillStyle = co.color; A.rr(c, -5, -6, 26, 16, 7); c.fill(); c.stroke();
    c.fillStyle = co.light; c.fillRect(0, -6, 3, 16); c.fillRect(9, -6, 3, 16);
    // えんとつ
    c.fillStyle = '#3a3236'; A.rr(c, 10, -16, 7, 11, 2); c.fill(); c.stroke();
    // 前の灯り
    c.fillStyle = '#ffe27a'; A.circle(c, 22, 1, 3.2); c.fill(); c.stroke();
    // 車輪
    c.fillStyle = '#2d2b30';
    for (const wx of [-16, -2, 12]) { A.circle(c, wx, 12, 5); c.fill(); }
    c.fillStyle = '#9aa0aa'; for (const wx of [-16, -2, 12]) { A.circle(c, wx, 12, 1.6); c.fill(); }
    // 排障器
    c.fillStyle = '#5a5258'; c.beginPath(); c.moveTo(19, 8); c.lineTo(27, 15); c.lineTo(19, 15); c.closePath(); c.fill();
    c.restore();
  };

  // ------------------------------------------------------------ マスの印
  A.SQ = {
    plus: { col: '#f3b23a', ring: '#c47d12', name: '晴れマス', desc: 'お金が もらえる' },
    minus: { col: '#5b8fd8', ring: '#2f5c9e', name: '雨マス', desc: 'お金を はらう' },
    card: { col: '#47ad6a', ring: '#24753f', name: 'きっぷマス', desc: 'きっぷが 1まい もらえる' },
    event: { col: '#a46acb', ring: '#6c3f8e', name: 'できごとマス', desc: 'その土地の できごと。どうするか えらぶ' },
    gate: { col: '#efe3c8', ring: '#7a5a32', name: '関所', desc: 'お金が もらえる。持ち主でない会社は 通るたびに 通行料' },
  };
  A.sqIcon = function (c, t, x, y, r) {
    c.save(); c.translate(x, y); const k = r / 12; c.scale(k, k);
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (t === 'plus') {
      c.fillStyle = '#fff6c9'; A.circle(c, 0, 0, 4.6); c.fill();
      c.strokeStyle = '#fff6c9'; c.lineWidth = 2;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 6.6, Math.sin(a) * 6.6); c.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); c.stroke(); }
    } else if (t === 'minus') {
      c.fillStyle = '#eaf3ff';
      c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(7, 2, 5, 5); c.arc(0, 4, 5, 0.1, Math.PI - 0.1); c.quadraticCurveTo(-7, 2, 0, -8); c.fill();
    } else if (t === 'card') {
      c.fillStyle = '#f2fff4'; A.rr(c, -8, -5.5, 16, 11, 2); c.fill();
      c.fillStyle = '#47ad6a'; A.circle(c, -8, 0, 2.4); c.fill(); A.circle(c, 8, 0, 2.4); c.fill();
      c.fillStyle = '#47ad6a'; c.fillRect(-4, -2.5, 8, 1.6); c.fillRect(-4, 1, 6, 1.6);
    } else if (t === 'event') {
      c.fillStyle = '#fff1d6';
      A.rr(c, -5.5, -7, 11, 13, 4); c.fill();
      c.fillStyle = '#d9483b'; c.fillRect(-6.5, -8.5, 13, 2.2); c.fillRect(-6.5, 5.6, 13, 2.2);
      c.fillStyle = '#7a3d2a'; c.font = KR.FONT(9, 900); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 0, 0);
    } else if (t === 'gate') {
      c.strokeStyle = '#7a5a32'; c.lineWidth = 2.2; c.fillStyle = '#7a5a32';
      c.beginPath(); c.moveTo(-8, 7); c.lineTo(-8, -3); c.arc(0, -3, 8, Math.PI, 0); c.lineTo(8, 7); c.stroke();
      c.fillRect(-10, 6, 20, 2.4);
    }
    c.restore();
  };

  // ------------------------------------------------------------ 名物の 種類の 印
  A.CAT_NAME = { food: '食べもの', farm: '畑・果樹', sea: '海の幸', inn: '宿・温泉', sight: '見物', craft: '工房', fest: 'まつり', snow: '雪あそび' };
  A.catIcon = function (c, cat, x, y, r, col) {
    c.save(); c.translate(x, y); const k = r / 12; c.scale(k, k);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 1.8;
    const ink = col || '#5a3b22';
    c.strokeStyle = ink; c.fillStyle = ink;
    if (cat === 'food') {
      c.beginPath(); c.moveTo(-9, -1); c.lineTo(9, -1); c.quadraticCurveTo(8, 9, 0, 9); c.quadraticCurveTo(-8, 9, -9, -1); c.fill();
      c.beginPath(); c.moveTo(-2, -2); c.lineTo(6, -10); c.moveTo(1, -2); c.lineTo(9, -9); c.stroke();
      c.fillStyle = '#fff'; c.globalAlpha = 0.5; c.fillRect(-7, 1, 14, 1.4); c.globalAlpha = 1;
    } else if (cat === 'farm') {
      A.circle(c, 0, 2, 7.5); c.fill();
      c.beginPath(); c.moveTo(0, -5); c.quadraticCurveTo(1, -9, 3, -10); c.stroke();
      c.beginPath(); c.ellipse(4, -7, 3.5, 1.8, -0.5, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.globalAlpha = 0.45; A.circle(c, -3, -1, 2); c.fill(); c.globalAlpha = 1;
    } else if (cat === 'sea') {
      c.beginPath(); c.moveTo(-9, 0); c.quadraticCurveTo(-2, -8, 6, 0); c.quadraticCurveTo(-2, 8, -9, 0); c.fill();
      c.beginPath(); c.moveTo(5, 0); c.lineTo(10, -5); c.lineTo(10, 5); c.closePath(); c.fill();
      c.fillStyle = '#fff'; A.circle(c, -4, -1, 1.3); c.fill();
    } else if (cat === 'inn') {
      c.beginPath(); c.ellipse(0, 5, 9, 4, 0, 0, TAU); c.stroke();
      for (const dx of [-4, 0, 4]) { c.beginPath(); c.moveTo(dx, 1); c.bezierCurveTo(dx - 3, -2, dx + 3, -5, dx, -9); c.stroke(); }
    } else if (cat === 'sight') {
      c.beginPath(); c.moveTo(-10, 7); c.lineTo(-3, -6); c.lineTo(1, 0); c.lineTo(4, -3); c.lineTo(10, 7); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-3, -6); c.lineTo(-5.4, -1.6); c.lineTo(-0.8, -2); c.closePath(); c.fill();
    } else if (cat === 'craft') {
      c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(-7, 8); c.lineTo(4, -3); c.stroke();
      c.save(); c.translate(5, -4); c.rotate(-0.78); c.fillRect(-6, -2.8, 12, 5.6); c.restore();
    } else if (cat === 'fest') {
      A.rr(c, -6, -7, 12, 14, 5); c.fill();
      c.fillRect(-4, -9.5, 8, 2.2); c.fillRect(-4, 7.3, 8, 2.2);
      c.strokeStyle = '#fff'; c.globalAlpha = 0.5; c.lineWidth = 1; c.beginPath(); c.moveTo(-6, -2); c.lineTo(6, -2); c.moveTo(-6, 2); c.lineTo(6, 2); c.stroke(); c.globalAlpha = 1;
    } else if (cat === 'snow') {
      c.lineWidth = 2;
      for (let i = 0; i < 3; i++) { c.save(); c.rotate((i * Math.PI) / 3); c.beginPath(); c.moveTo(0, -9); c.lineTo(0, 9); c.moveTo(-3, -6); c.lineTo(0, -3.5); c.lineTo(3, -6); c.moveTo(-3, 6); c.lineTo(0, 3.5); c.lineTo(3, 6); c.stroke(); c.restore(); }
    }
    c.restore();
  };
  // 季節の しるし（春・夏・秋・冬・通年）
  A.seasonBadge = function (c, s, x, y, h, shun) {
    const name = s < 0 ? '通年' : KR.SEASONS[s].name;
    const col = s < 0 ? '#9b8e7e' : KR.SEASONS[s].color;
    c.font = KR.FONT(h * 0.62, 800);
    const w = c.measureText(name).width + h * 0.7;
    c.fillStyle = col; A.rr(c, x, y - h / 2, w, h, h / 2); c.fill();
    if (shun) { c.strokeStyle = '#e8402a'; c.lineWidth = 2.2; A.rr(c, x - 1.5, y - h / 2 - 1.5, w + 3, h + 3, h / 2 + 1); c.stroke(); }
    c.fillStyle = s === 3 ? '#1f3d5e' : '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(name, x + w / 2, y + 1);
    return w;
  };

  // ------------------------------------------------------------ きっぷ（手札）
  A.ticket = function (c, id, x, y, w, h, opt) {
    opt = opt || {};
    const cd = KR.CARDS[id];
    c.save();
    if (opt.lift) c.translate(0, -opt.lift);
    c.fillStyle = 'rgba(40,25,10,0.22)'; A.rr(c, x + 2, y + 4, w, h, 7); c.fill();
    c.fillStyle = opt.dim ? '#e4ddcf' : '#fffaf0'; A.rr(c, x, y, w, h, 7); c.fill();
    c.fillStyle = opt.dim ? '#b7ab98' : cd.col; A.rr(c, x, y, w, h * 0.34, 7); c.fill(); c.fillRect(x, y + h * 0.2, w, h * 0.14);
    // 切りこみ
    c.fillStyle = '#2a2018'; c.globalAlpha = 0.18;
    A.circle(c, x, y + h * 0.62, 5); c.fill(); A.circle(c, x + w, y + h * 0.62, 5); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = opt.sel ? '#e4502f' : '#7a5a3a'; c.lineWidth = opt.sel ? 3 : 1.5; A.rr(c, x, y, w, h, 7); c.stroke();
    A.text(c, cd.short, x + w / 2, y + h * 0.18, Math.min(15, h * 0.2), '#fff', 'center', 800);
    // 絵
    const cx = x + w / 2, cy = y + h * 0.66;
    A.cardPict(c, id, cx, cy, h * 0.22, opt.dim);
    if (opt.n) A.text(c, 'のこり' + opt.n, x + w / 2, y + h - 9, 10, '#7a5a3a', 'center', 700);
    c.restore();
  };
  A.cardPict = function (c, id, x, y, r, dim) {
    c.save(); c.translate(x, y); const k = r / 12; c.scale(k, k); c.lineJoin = 'round'; c.lineCap = 'round';
    const ink = dim ? '#a89c88' : '#4a3626';
    if (id === 'kaisoku' || id === 'tokkyu' || id === 'kaisuu') {
      const n = id === 'tokkyu' ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const dx = (i - (n - 1) / 2) * 13;
        c.fillStyle = '#fff'; c.strokeStyle = ink; c.lineWidth = 1.6; A.rr(c, dx - 6, -6, 12, 12, 3); c.fill(); c.stroke();
        c.fillStyle = ink; A.circle(c, dx - 2.5, -2.5, 1.4); c.fill(); A.circle(c, dx + 2.5, 2.5, 1.4); c.fill();
      }
      if (id === 'kaisuu') { c.fillStyle = ink; c.font = KR.FONT(8, 800); c.textAlign = 'center'; c.fillText('×3', 0, 12); }
    } else if (id === 'kakueki') {
      // 1〜6 から えらべる
      c.fillStyle = '#fff'; c.strokeStyle = ink; c.lineWidth = 1.4;
      for (let i = 0; i < 6; i++) {
        const dx = (i % 3 - 1) * 8.5, dy = (Math.floor(i / 3) - 0.5) * 9;
        A.rr(c, dx - 3.6, dy - 3.6, 7.2, 7.2, 1.6); c.fill(); c.stroke();
        c.fillStyle = ink; c.font = KR.FONT(6, 900); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i + 1), dx, dy + 0.3); c.fillStyle = '#fff';
      }
    } else if (id === 'daruma') {
      c.fillStyle = dim ? '#cdb6b0' : '#d63c34'; c.beginPath(); c.ellipse(0, 1, 9, 10, 0, 0, TAU); c.fill();
      c.fillStyle = '#fff3e6'; c.beginPath(); c.ellipse(0, -1, 5.5, 4.5, 0, 0, TAU); c.fill();
      c.fillStyle = ink; A.circle(c, -2, -1.5, 1); c.fill(); A.circle(c, 2, -1.5, 1); c.fill();
      c.fillStyle = '#f2c94c'; c.fillRect(-4, 5, 8, 2);
    } else if (id === 'baishu') {
      c.fillStyle = '#fff'; c.strokeStyle = ink; c.lineWidth = 1.6;
      A.rr(c, -9, -7, 18, 14, 2); c.fill(); c.stroke();
      c.fillStyle = dim ? '#bbb' : '#d33'; A.circle(c, 4, 2, 4.2); c.fill();
      c.fillStyle = '#fff'; c.font = KR.FONT(5, 900); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('印', 4, 2.3);
      c.strokeStyle = ink; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-6, -3); c.lineTo(2, -3); c.moveTo(-6, 0); c.lineTo(-1, 0); c.stroke();
    } else if (id === 'fumikiri') {
      c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -9); c.lineTo(0, 10); c.stroke();
      c.save(); c.rotate(0.6); c.fillStyle = '#f3cf3b'; c.fillRect(-10, -2, 20, 4); c.fillStyle = '#222'; c.fillRect(-6, -2, 3, 4); c.fillRect(2, -2, 3, 4); c.restore();
      c.save(); c.rotate(-0.6); c.fillStyle = '#f3cf3b'; c.fillRect(-10, -2, 20, 4); c.fillStyle = '#222'; c.fillRect(-6, -2, 3, 4); c.fillRect(2, -2, 3, 4); c.restore();
      c.fillStyle = '#e53'; A.circle(c, -4, -9, 2.4); c.fill(); A.circle(c, 4, -9, 2.4); c.fill();
    } else if (id === 'tobinori') {
      c.strokeStyle = ink; c.lineWidth = 1.8; c.setLineDash([2.5, 2.5]);
      c.beginPath(); c.moveTo(-10, 6); c.quadraticCurveTo(0, -14, 10, 4); c.stroke(); c.setLineDash([]);
      c.fillStyle = ink; c.beginPath(); c.moveTo(10, 4); c.lineTo(5, 3); c.lineTo(9, -1); c.closePath(); c.fill();
      c.fillStyle = dim ? '#bbb' : '#2f8fc9'; A.circle(c, -10, 6, 2.6); c.fill();
    }
    c.restore();
  };

  // ------------------------------------------------------------ サイコロ
  const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  A.die = function (c, x, y, s, v, rot, col) {
    c.save(); c.translate(x, y); c.rotate(rot || 0);
    c.fillStyle = 'rgba(30,20,10,0.25)'; A.rr(c, -s / 2 + 3, -s / 2 + 5, s, s, s * 0.22); c.fill();
    c.fillStyle = col || '#fffdf7'; A.rr(c, -s / 2, -s / 2, s, s, s * 0.22); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.07)'; A.rr(c, -s / 2, s * 0.12, s, s * 0.38, s * 0.22); c.fill();
    c.strokeStyle = '#5a4532'; c.lineWidth = Math.max(1.5, s * 0.05); A.rr(c, -s / 2, -s / 2, s, s, s * 0.22); c.stroke();
    if (v > 0) {
      const p = PIPS[Math.min(6, v)] || [];
      for (const q of p) {
        c.fillStyle = v === 1 ? '#d8352a' : '#2b2018';
        A.circle(c, q[0] * s * 0.26, q[1] * s * 0.26, v === 1 ? s * 0.13 : s * 0.085); c.fill();
      }
    } else if (v === -1) {
      A.text(c, '?', 0, 1, s * 0.6, '#4a3626', 'center', 900);
    }
    c.restore();
  };
  A.dieSlow = function (c, x, y, s, v, rot) { A.die(c, x, y, s, v, rot, '#ffe9a6'); };

  // ------------------------------------------------------------ 駅スタンプ
  A.stamp = function (c, st, x, y, r, opt) {
    opt = opt || {};
    const s = KR.STATIONS[st];
    const reg = KR.REGIONS.find((q) => q.id === s.r);
    const ink = opt.gray ? '#b9ad9a' : reg.ink;
    const rnd = KR.rng(st * 131 + 7);
    c.save(); c.translate(x, y); c.rotate((rnd() - 0.5) * 0.3 + (opt.rot || 0));
    c.globalAlpha = opt.alpha == null ? 0.92 : opt.alpha;
    c.strokeStyle = ink; c.fillStyle = ink;
    c.lineWidth = r * 0.08; A.circle(c, 0, 0, r); c.stroke();
    c.lineWidth = r * 0.03; A.circle(c, 0, 0, r * 0.84); c.stroke();
    if (!opt.gray) {
      const mainCat = s.props[s.props.length - 1][3];
      A.catIcon(c, mainCat, 0, -r * 0.44, r * 0.24, ink);
      c.font = KR.FONT(r * (s.name.length >= 3 ? 0.36 : 0.44), 900); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(s.name, 0, r * 0.06);
      c.font = KR.FONT(r * 0.15, 700); c.fillText(reg.name + ' ・ 駅', 0, r * 0.52);
      // かすれ
      c.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 26; i++) { c.globalAlpha = 0.5 + rnd() * 0.5; A.circle(c, (rnd() - 0.5) * r * 1.9, (rnd() - 0.5) * r * 1.9, r * (0.02 + rnd() * 0.05)); c.fill(); }
    } else {
      c.font = KR.FONT(r * 0.5, 900); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 2);
    }
    c.restore();
  };

  // ------------------------------------------------------------ できごとの 絵（ちいさな 丸い 絵）
  A.eventIcon = function (c, icon, x, y, r) {
    c.save(); c.translate(x, y);
    c.fillStyle = '#fff2d8'; A.circle(c, 0, 0, r); c.fill();
    c.strokeStyle = '#a46acb'; c.lineWidth = r * 0.08; A.circle(c, 0, 0, r); c.stroke();
    const k = r / 30; c.scale(k, k); c.lineJoin = 'round'; c.lineCap = 'round';
    const ink = '#5a3b22';
    c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = 2.4;
    switch (icon) {
      case 'lottery': c.fillStyle = '#d9483b'; c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.lineTo(Math.cos(a) * 14, Math.sin(a) * 14 - 2); } c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#f3cf3b'; A.circle(c, 0, -2, 4); c.fill(); c.beginPath(); c.moveTo(12, -2); c.lineTo(20, 8); c.stroke(); break;
      case 'dog': A.face(c, 'shiba', 0, 2, 18, 'happy'); break;
      case 'sakura': for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - Math.PI / 2; c.fillStyle = '#f6a9c0'; c.beginPath(); c.ellipse(Math.cos(a) * 9, Math.sin(a) * 9, 7, 5, a, 0, TAU); c.fill(); } c.fillStyle = '#e46b8b'; A.circle(c, 0, 0, 4); c.fill(); break;
      case 'lantern': c.fillStyle = '#e8573d'; A.rr(c, -11, -14, 22, 26, 10); c.fill(); c.stroke(); c.fillStyle = '#2b2018'; c.fillRect(-7, -18, 14, 4); c.fillRect(-7, 12, 14, 4); c.strokeStyle = '#f7c9a0'; c.lineWidth = 1.4; for (let yy = -8; yy <= 6; yy += 5) { c.beginPath(); c.moveTo(-10, yy); c.lineTo(10, yy); c.stroke(); } break;
      case 'typhoon': c.lineWidth = 3; c.strokeStyle = '#4a74b8'; c.beginPath(); for (let a = 0; a < 12; a += 0.2) { const rr = 2 + a * 1.3; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.stroke(); break;
      case 'snow': A.catIcon(c, 'snow', 0, 0, 16, '#4a74b8'); break;
      case 'momiji': c.fillStyle = '#e0602f'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2; const rr = i % 2 ? 6 : 15; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); c.beginPath(); c.moveTo(0, 4); c.lineTo(0, 16); c.stroke(); break;
      case 'onsen': A.catIcon(c, 'inn', 0, 0, 16, '#d9483b'); break;
      case 'bento': c.fillStyle = '#c9472e'; A.rr(c, -16, -10, 32, 22, 4); c.fill(); c.stroke(); c.fillStyle = '#fff'; A.rr(c, -13, -7, 13, 16, 2); c.fill(); c.fillStyle = '#f4a3a0'; A.rr(c, 2, -7, 11, 7, 2); c.fill(); c.fillStyle = '#7bbf5a'; A.rr(c, 2, 2, 11, 7, 2); c.fill(); c.fillStyle = '#d33'; A.circle(c, -6.5, 1, 2.4); c.fill(); break;
      case 'oldman': c.fillStyle = '#f2d1ae'; A.circle(c, 0, 2, 14); c.fill(); c.stroke(); c.fillStyle = '#2b3a5a'; c.beginPath(); c.moveTo(-15, -6); c.quadraticCurveTo(0, -22, 15, -6); c.closePath(); c.fill(); c.fillStyle = '#ddd'; c.beginPath(); c.ellipse(0, 12, 9, 4, 0, 0, TAU); c.fill(); c.fillStyle = ink; A.circle(c, -5, 1, 1.6); c.fill(); A.circle(c, 5, 1, 1.6); c.fill(); break;
      case 'fox': A.face(c, 'fox', 0, 2, 18); break;
      case 'duel': A.die(c, -8, 0, 15, 5, -0.25); A.die(c, 9, 2, 15, 3, 0.2); break;
      case 'firework': c.strokeStyle = '#e8573d'; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 4, Math.sin(a) * 4); c.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); c.stroke(); } c.fillStyle = '#f3cf3b'; A.circle(c, 0, 0, 3); c.fill(); break;
      case 'pilgrim': c.fillStyle = '#f7f1e3'; c.beginPath(); c.moveTo(-12, 16); c.lineTo(-8, -2); c.lineTo(8, -2); c.lineTo(12, 16); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#d9b36a'; c.beginPath(); c.moveTo(-15, -6); c.lineTo(0, -16); c.lineTo(15, -6); c.closePath(); c.fill(); c.stroke(); break;
      case 'ice': c.fillStyle = '#e9f4ff'; c.beginPath(); c.moveTo(-16, 8); c.lineTo(-8, -6); c.lineTo(2, -2); c.lineTo(10, -10); c.lineTo(16, 8); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = '#6fa2d8'; c.beginPath(); c.moveTo(-18, 12); c.quadraticCurveTo(0, 6, 18, 12); c.stroke(); break;
      case 'wallet': c.fillStyle = '#8b5a33'; A.rr(c, -14, -9, 28, 19, 4); c.fill(); c.stroke(); c.fillStyle = '#f3cf3b'; A.circle(c, 8, 0, 3.5); c.fill(); break;
      case 'box': c.fillStyle = '#d7aa6d'; A.rr(c, -14, -10, 28, 22, 2); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-14, -2); c.lineTo(14, -2); c.moveTo(0, -10); c.lineTo(0, -2); c.stroke(); break;
      case 'camera': c.fillStyle = '#4a4a55'; A.rr(c, -15, -8, 30, 20, 4); c.fill(); c.fillStyle = '#9ad'; A.circle(c, 0, 2, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; A.circle(c, 0, 2, 7); c.stroke(); c.fillStyle = '#4a4a55'; c.fillRect(-8, -12, 9, 5); break;
      case 'moon': c.fillStyle = '#f6dd7a'; A.circle(c, 0, -2, 13); c.fill(); c.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { A.circle(c, -8 + i * 8, 13, 4); c.fill(); } break;
      case 'fruit': c.fillStyle = '#d8344a'; A.circle(c, -6, 6, 6); c.fill(); A.circle(c, 7, 7, 6); c.fill(); c.strokeStyle = '#4a7a2a'; c.beginPath(); c.moveTo(-6, 0); c.quadraticCurveTo(0, -14, 7, 1); c.stroke(); break;
      case 'gate': c.strokeStyle = ink; c.lineWidth = 3; c.beginPath(); c.moveTo(-12, 14); c.lineTo(-12, -6); c.moveTo(12, 14); c.lineTo(12, -6); c.stroke(); c.fillStyle = '#5a9a6a'; c.fillRect(-15, -12, 30, 6); c.fillStyle = '#d9483b'; c.fillRect(-4, -2, 8, 10); break;
      default: A.text(c, '!', 0, 0, 24, ink, 'center', 900);
    }
    c.restore();
  };
})(typeof window !== 'undefined' ? window : globalThis);
