/*
 * ころころ、ひらけ列島 ― 画面の 部品（ボタン・上の帯・会社の札・手札・駅の画面・できごと・決算・メニュー）
 * 描くたびに ボタンを 登録し、クリックは game.js が 受けとる。
 */
(function (root) {
  'use strict';
  const KR = root.KR;
  const M = KR.MAP, A = KR.ART, R = KR.R, E = KR.E;
  const U = KR.UI = {
    btns: [], mouse: { x: -1, y: -1, down: false }, panel: null, sub: null, banner: null,
    toasts: [], speech: [], hint: null, mode: null, selCard: -1, hoverCard: -1, screen: 'title',
    flash: {}, kbSel: -1,
  };
  const C = () => R.c;
  const yen = KR.yen, yenS = KR.yenShort;

  // ------------------------------------------------------------ 箱と ボタン
  U.box = function (x, y, w, h, opt) {
    opt = opt || {};
    const c = C();
    c.fillStyle = 'rgba(50,30,10,0.25)'; A.rr(c, x + 3, y + 5, w, h, opt.r || 14); c.fill();
    c.fillStyle = opt.fill || A.PAPER; A.rr(c, x, y, w, h, opt.r || 14); c.fill();
    c.strokeStyle = opt.line || '#6b4a2b'; c.lineWidth = opt.lw || 2.5; A.rr(c, x, y, w, h, opt.r || 14); c.stroke();
    if (!opt.plain) { c.strokeStyle = 'rgba(107,74,43,0.28)'; c.lineWidth = 1; c.setLineDash([4, 4]); A.rr(c, x + 6, y + 6, w - 12, h - 12, (opt.r || 14) - 5); c.stroke(); c.setLineDash([]); }
  };
  U.inRect = (x, y, b) => x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h;
  U.btn = function (id, x, y, w, h, label, opt) {
    opt = opt || {};
    const c = C();
    const hov = !opt.disabled && U.inRect(U.mouse.x, U.mouse.y, { x, y, w, h });
    const kind = opt.kind || 'paper';
    const press = hov && U.mouse.down;
    const dy = press ? 2 : hov ? -2 : 0;
    let fill = '#fffaf0', ink = A.INK, line = '#6b4a2b';
    if (kind === 'primary') { fill = hov ? '#f0643f' : '#e4502f'; ink = '#fff'; line = '#9c2d14'; }
    else if (kind === 'gold') { fill = hov ? '#ffd45a' : '#f3c13a'; ink = '#4a2d0a'; line = '#a77712'; }
    else if (kind === 'ghost') { fill = hov ? 'rgba(255,250,240,0.95)' : 'rgba(255,250,240,0.82)'; }
    else if (kind === 'color') { fill = opt.col; ink = '#fff'; line = opt.dark || '#333'; }
    if (hov && kind === 'paper') fill = '#fff3d6';
    if (opt.disabled) { fill = '#e3dccd'; ink = '#9d9282'; line = '#b3a690'; }
    if (opt.sel) { line = '#e4502f'; }
    c.fillStyle = 'rgba(50,30,10,0.28)'; A.rr(c, x + 2, y + 4, w, h, opt.r || 12); c.fill();
    c.fillStyle = fill; A.rr(c, x, y + dy, w, h, opt.r || 12); c.fill();
    c.strokeStyle = line; c.lineWidth = opt.sel ? 3.5 : 2.2; A.rr(c, x, y + dy, w, h, opt.r || 12); c.stroke();
    if (label != null) {
      const size = opt.size || Math.min(20, h * 0.42);
      if (opt.sub) {
        A.text(c, label, x + w / 2, y + dy + h * 0.38, size, ink, 'center', 800);
        A.text(c, opt.sub, x + w / 2, y + dy + h * 0.72, size * 0.66, opt.disabled ? ink : kind === 'primary' || kind === 'color' ? 'rgba(255,255,255,0.9)' : '#7a5a3a', 'center', 700);
      } else A.text(c, label, x + w / 2, y + dy + h / 2 + 1, size, ink, 'center', 800);
    }
    // キーの しるし（小さな ボタンには 出さない。キーは どれでも つかえる）
    if (opt.key && !opt.disabled && (w >= 150 || opt.keyTop)) {
      c.font = KR.FONT(10, 700);
      const kw = c.measureText(opt.key).width + 10;
      const ky = opt.keyTop ? y + dy + 5 : y + dy + h - 17;
      c.fillStyle = 'rgba(255,255,255,0.85)'; A.rr(c, x + w - kw - 5, ky, kw, 14, 4); c.fill();
      A.text(c, opt.key, x + w - kw / 2 - 5, ky + 7, 10, '#7a5a3a', 'center', 700);
    }
    if (!opt.disabled || opt.tip) U.btns.push({ id, x, y, w, h, label: label || id, on: opt.disabled ? null : opt.on, tip: opt.tip, key: opt.disabled ? null : opt.key });
    return hov;
  };

  // ------------------------------------------------------------ 上の帯（日付・目的地）
  U.drawDate = function (G) {
    const c = C();
    U.box(12, 10, 254, 80, { r: 14 });
    const t = Math.min(G.turn, KR.TURNS - 1);
    const s = KR.seasonOf(t);
    A.text(c, KR.turnLabel(t), 28, 36, 26, A.INK, 'left', 900);
    c.font = KR.FONT(26, 900);
    A.seasonBadge(c, s, 36 + c.measureText(KR.turnLabel(t)).width, 37, 24);
    A.text(c, 'のこり', 254, 26, 11, '#7a5a3a', 'right', 700);
    A.text(c, (KR.TURNS - t) + 'ターン', 254, 44, 15, '#7a5a3a', 'right', 900);
    // 1年の すすみ
    const x0 = 26, w = 226, y = 66;
    for (let i = 0; i < KR.TURNS; i++) {
      const x = x0 + (i / (KR.TURNS - 1)) * w;
      const ss = KR.seasonOf(i);
      c.fillStyle = i < t ? KR.SEASONS[ss].color : i === t ? '#e4502f' : 'rgba(120,90,60,0.22)';
      A.circle(c, x, y, i === t ? 5.5 : 3.6); c.fill();
      if (i % 6 === 5) { c.strokeStyle = '#6b4a2b'; c.lineWidth = 1.5; A.circle(c, x, y, 7); c.stroke(); }
    }
    A.text(c, '◎ = 季節の 決算', 254, 80, 10, '#9a7a5a', 'right', 700);
  };
  U.drawDest = function (G) {
    const c = C();
    if (G.dest < 0) return;
    const w = 380, x = R.W / 2 - w / 2 - 70, y = 10, h = 70;
    U.box(x, y, w, h, { r: 14, fill: '#fff6e6' });
    // 旗
    c.save(); c.translate(x + 34, y + 58); c.scale(0.62, 0.62);
    c.strokeStyle = '#4a3626'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -70); c.stroke();
    c.fillStyle = '#e4402f'; c.beginPath(); c.moveTo(1, -68); c.lineTo(44, -58); c.lineTo(1, -46); c.closePath(); c.fill();
    c.restore();
    A.text(c, '目的地', x + 60, y + 20, 12, '#a0522d', 'left', 800);
    const st = KR.STATIONS[G.dest];
    A.text(c, st.name, x + 60, y + 46, 28, A.INK, 'left', 900);
    c.font = KR.FONT(28, 900);
    const nw = c.measureText(st.name).width;
    const reg = KR.REGIONS.find((r) => r.id === st.r);
    A.text(c, reg.name, x + 66 + nw, y + 50, 12, reg.ink, 'left', 800);
    const d = E.destDist(G, G.P[0].node);
    A.text(c, 'あなたから', x + w - 16, y + 20, 11, '#7a5a3a', 'right', 700);
    A.text(c, 'あと ' + d + ' マス', x + w - 16, y + 41, 20, '#c0392b', 'right', 900);
    const prize = Math.round((1000 + 120 * G.destDist) * KR.inflation(G.turn) / 10) * 10;
    A.text(c, '一番乗り ' + yen(prize), x + w - 16, y + 60, 11, '#7a5a3a', 'right', 700);
  };

  // ------------------------------------------------------------ 会社の 札
  U.cardRect = (i) => ({ x: R.W - 262, y: 10 + i * 94, w: 250, h: 86 });
  U.drawCompanies = function (G, cur, pickable) {
    const c = C();
    G.P.forEach((P, i) => {
      const co = KR.COMPANIES[i];
      const b = U.cardRect(i);
      const isCur = i === cur;
      const pk = pickable && pickable.indexOf(i) >= 0;
      if (isCur) { c.fillStyle = co.color; c.globalAlpha = 0.3 + 0.15 * Math.sin(R.time * 4); A.rr(c, b.x - 5, b.y - 5, b.w + 10, b.h + 10, 18); c.fill(); c.globalAlpha = 1; }
      U.box(b.x, b.y, b.w, b.h, { r: 14, line: isCur ? co.dark : '#6b4a2b', lw: isCur ? 3.5 : 2.5, fill: pk ? '#fff0d0' : A.PAPER });
      c.fillStyle = co.color; A.rr(c, b.x + 4, b.y + 4, 8, b.h - 8, 4); c.fill();
      A.portrait(c, i, b.x + 46, b.y + 43, 29, isCur ? 'happy' : null);
      A.text(c, co.name, b.x + 84, b.y + 18, 14, co.dark, 'left', 900);
      A.text(c, i === 0 ? 'あなた' : co.boss, b.x + b.w - 12, b.y + 18, 11, '#7a5a3a', 'right', 700);
      // お金（数字は なめらかに 増減し、増えたら 緑・減ったら 赤に 光る）
      U.dispCash = U.dispCash || [];
      if (U.dispCash[i] == null || U.snapCash) U.dispCash[i] = P.cash;
      const diff = P.cash - U.dispCash[i];
      if (Math.abs(diff) > 0.5) {
        U.dispCash[i] += diff * Math.min(1, 0.12 + 6 / Math.max(60, Math.abs(diff)));
        if (Math.abs(P.cash - U.dispCash[i]) < 1) U.dispCash[i] = P.cash;
        c.fillStyle = diff > 0 ? 'rgba(80,200,110,0.22)' : 'rgba(230,80,60,0.22)';
        A.rr(c, b.x + 80, b.y + 30, b.w - 132, 28, 8); c.fill();
      }
      const shownCash = Math.round(U.dispCash[i] / 10) * 10;
      const cashS = yen(Math.abs(P.cash - shownCash) < 10 ? P.cash : shownCash);
      let fs = 19; c.font = KR.FONT(fs, 900);
      while (fs > 13 && c.measureText(cashS).width > b.w - 84 - 52) { fs--; c.font = KR.FONT(fs, 900); }
      A.text(c, cashS, b.x + 84, b.y + 44, fs, P.cash < 0 ? '#c0392b' : diff > 0.5 ? '#1f7a3a' : diff < -0.5 ? '#b0301e' : A.INK, 'left', 900);
      A.text(c, '資産 ' + yenS(E.assets(G, i)), b.x + 84, b.y + 70, 11, '#7a5a3a', 'left', 700);
      // きっぷの 数
      const tx = b.x + b.w - 46, ty = b.y + 34;
      c.fillStyle = '#fffaf0'; A.rr(c, tx, ty, 36, 20, 4); c.fill(); c.strokeStyle = '#7a5a3a'; c.lineWidth = 1.4; A.rr(c, tx, ty, 36, 20, 4); c.stroke();
      c.fillStyle = '#47ad6a'; c.fillRect(tx + 1, ty + 1, 9, 18);
      A.text(c, '×' + P.cards.length, tx + 23, ty + 10.5, 11, A.INK, 'center', 800);
      const dd = E.destDist(G, P.node);
      A.text(c, '目的地まで ' + (dd >= 99 ? '−' : dd), b.x + b.w - 12, b.y + 70, 11, '#a0522d', 'right', 800);
      if (P.slow) A.textOutline(c, 'ふみきり', b.x + 46, b.y + 80, 11, '#2b2018', '#f3cf3b', 4);
      if (pk) U.btns.push({ id: 'pick:' + i, x: b.x, y: b.y, w: b.w, h: b.h, label: co.name, on: () => U.onPick && U.onPick(i) });
    });
    U.snapCash = false;
  };

  // ------------------------------------------------------------ しらせ・せりふ・こむぎ・見出し
  U.toast = function (text, col, life) {
    U.toasts.push({ text, col: col || '#4a3626', t: 0, life: life || 3.2 });
    if (U.toasts.length > 4) U.toasts.shift();
  };
  U.say = function (p, text, life) {
    U.speech = U.speech.filter((s) => s.p !== p);
    U.speech.push({ p, text, t: 0, life: life || 2.2 });
  };
  U.setBanner = function (title, opt) {
    opt = opt || {};
    U.banner = { title, sub: opt.sub || '', col: opt.col || '#e4502f', t: 0, life: opt.life || 1.6, big: !!opt.big, stamp: opt.stamp || null, p: opt.p, money: opt.money, icon: opt.icon };
  };
  U.update = function (dt) {
    for (const t of U.toasts) t.t += dt;
    U.toasts = U.toasts.filter((t) => t.t < t.life);
    for (const s of U.speech) s.t += dt;
    U.speech = U.speech.filter((s) => s.t < s.life);
    if (U.banner) { U.banner.t += dt; if (U.banner.t > U.banner.life) U.banner = null; }
    for (const k in U.flash) { U.flash[k] -= dt; if (U.flash[k] <= 0) delete U.flash[k]; }
  };
  U.drawToasts = function () {
    const c = C();
    let y = 92;
    for (const t of U.toasts) {
      const a = Math.min(1, t.t * 6, (t.life - t.t) * 3);
      c.globalAlpha = a;
      c.font = KR.FONT(14, 800);
      const w = Math.min(560, c.measureText(t.text).width + 30);
      const x = R.W / 2 - 70 - w / 2;
      c.fillStyle = 'rgba(255,250,238,0.95)'; A.rr(c, x, y, w, 28, 14); c.fill();
      c.strokeStyle = t.col; c.lineWidth = 2; A.rr(c, x, y, w, 28, 14); c.stroke();
      A.text(c, t.text, x + w / 2, y + 15, 14, t.col, 'center', 800);
      c.globalAlpha = 1;
      y += 33;
    }
  };
  U.drawSpeech = function () {
    const c = C();
    for (const s of U.speech) {
      const b = U.cardRect(s.p);
      const a = Math.min(1, s.t * 6, (s.life - s.t) * 3);
      c.globalAlpha = a;
      c.font = KR.FONT(14, 800);
      const w = c.measureText(s.text).width + 28;
      const x = b.x - w - 14, y = b.y + 22;
      c.fillStyle = '#fff'; A.rr(c, x, y, w, 34, 16); c.fill();
      c.beginPath(); c.moveTo(x + w - 2, y + 10); c.lineTo(x + w + 12, y + 17); c.lineTo(x + w - 2, y + 24); c.closePath(); c.fill();
      c.strokeStyle = KR.COMPANIES[s.p].color; c.lineWidth = 2.4; A.rr(c, x, y, w, 34, 16); c.stroke();
      A.text(c, s.text, x + w / 2, y + 18, 14, A.INK, 'center', 800);
      c.globalAlpha = 1;
    }
  };
  U.drawHint = function (under) {
    if (!U.hint) return;
    const c = C();
    if (under) {
      // パネルの 下に 細長く
      const w = under.w, lines = A.wrap(c, U.hint.text, w - 110, 14, 700);
      const h = 18 + lines.length * 20, x = under.x, y = Math.min(R.H - h - 6, under.y + under.h + 8);
      c.fillStyle = '#fffdf6'; A.rr(c, x, y, w, h, 12); c.fill();
      c.strokeStyle = '#e4502f'; c.lineWidth = 2.2; A.rr(c, x, y, w, h, 12); c.stroke();
      A.portrait(c, 0, x + 30, y + h / 2, 20, 'happy');
      lines.forEach((l, i) => A.text(c, l, x + 60, y + 19 + i * 20, 14, A.INK, 'left', 700));
      return;
    }
    const lines = A.wrap(c, U.hint.text, 330, 15, 700);
    const h = 30 + lines.length * 22;
    const x = 14, y = 142;
    A.portrait(c, 0, x + 40, y + 34, 34, 'happy');
    const bx = x + 84, bw = 360;
    c.fillStyle = '#fffdf6'; A.rr(c, bx, y, bw, h, 16); c.fill();
    c.beginPath(); c.moveTo(bx + 2, y + 22); c.lineTo(bx - 12, y + 32); c.lineTo(bx + 2, y + 40); c.closePath(); c.fill();
    c.strokeStyle = '#e4502f'; c.lineWidth = 2.4; A.rr(c, bx, y, bw, h, 16); c.stroke();
    A.text(c, 'こむぎ', bx + 14, y + 14, 11, '#e4502f', 'left', 900);
    lines.forEach((l, i) => A.text(c, l, bx + 14, y + 34 + i * 22, 15, A.INK, 'left', 700));
    U.btn('hintClose', bx + bw - 30, y + 6, 24, 22, '×', { kind: 'ghost', size: 14, r: 8, on: () => { U.hint = null; } });
  };
  U.drawBanner = function () {
    const b = U.banner;
    if (!b) return;
    const c = C();
    const t = b.t, life = b.life;
    const a = Math.min(1, t * 5, (life - t) * 4);
    const pop = t < 0.25 ? KR.easeOutBack(t / 0.25) : 1;
    c.save(); c.globalAlpha = Math.max(0, a);
    const cy = b.big ? R.H * 0.42 : R.H * 0.3;
    const h = b.big ? 150 : 84;
    c.fillStyle = 'rgba(30,20,10,0.35)'; c.fillRect(0, cy - h / 2 + 6, R.W, h);
    c.fillStyle = b.col; c.fillRect(0, cy - h / 2, R.W, h);
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(0, cy - h / 2 + 6, R.W, 3); c.fillRect(0, cy + h / 2 - 9, R.W, 3);
    c.translate(R.W / 2, cy); c.scale(pop, pop);
    if (b.p != null) A.portrait(c, b.p, -R.W * 0.26, 0, b.big ? 52 : 32, 'happy');
    A.textOutline(c, b.title, 0, b.sub || b.money != null ? (b.big ? -26 : -12) : 0, b.big ? 52 : 34, '#fff', 'rgba(40,20,10,0.6)', 8, 'center', 900);
    if (b.sub) A.text(c, b.sub, 0, b.big ? 28 : 22, b.big ? 20 : 16, '#fff', 'center', 800);
    if (b.money != null) {
      const shown = Math.round(b.money * KR.easeOut(Math.min(1, t / 0.9)) / 10) * 10;
      A.textOutline(c, '+' + yen(shown).replace('+', ''), 0, b.big ? (b.sub ? 62 : 34) : 26, b.big ? 30 : 20, '#fff6b0', 'rgba(40,20,10,0.6)', 6, 'center', 900);
    }
    if (b.stamp && t > 0.5) {
      const st = Math.min(1, (t - 0.5) / 0.15);
      c.save(); c.translate(R.W * 0.25, -10); c.rotate(-0.18); c.scale(2 - st, 2 - st); c.globalAlpha = st * a;
      c.strokeStyle = '#fff6b0'; c.lineWidth = 5; A.rr(c, -86, -30, 172, 60, 10); c.stroke();
      A.text(c, b.stamp, 0, 2, 30, '#fff6b0', 'center', 900);
      c.restore();
    }
    c.restore();
  };

  // ------------------------------------------------------------ 手札と サイコロ（あなたの番）
  U.handLayout = function (G) {
    const P = G.P[0];
    const n = P.cards.length;
    const cw = 80, ch = 108, gap = 10;
    const diceW = 170;
    const total = n * cw + Math.max(0, n - 1) * gap + (n ? 26 : 0) + diceW;
    const x0 = R.W / 2 - 70 - total / 2;
    const y = R.H - ch - 16;
    const cards = P.cards.map((cd, i) => ({ x: x0 + i * (cw + gap), y, w: cw, h: ch, i }));
    const dice = { x: x0 + total - diceW, y: R.H - 128, w: diceW, h: 112 };
    return { cards, dice };
  };
  U.drawAction = function (G, h) {
    const c = C();
    const P = G.P[0];
    const L = U.handLayout(G);
    // 手札
    L.cards.forEach((r) => {
      const cd = P.cards[r.i];
      const can = E.canUseCard(G, P, r.i) || cd.id === 'baishu';
      const usable = E.canUseCard(G, P, r.i);
      const hov = U.inRect(U.mouse.x, U.mouse.y, r);
      if (hov) U.hoverCard = r.i;
      const sel = U.selCard === r.i;
      A.ticket(c, cd.id, r.x, r.y, r.w, r.h, { lift: sel ? 16 : hov ? 8 : 0, sel, dim: !can, n: cd.n });
      if (usable) U.btns.push({ id: 'card:' + r.i, x: r.x, y: r.y - (sel ? 16 : 0), w: r.w, h: r.h, label: KR.CARDS[cd.id].name, on: () => h.onCard(r.i) });
      else U.btns.push({ id: 'cardx:' + r.i, x: r.x, y: r.y, w: r.w, h: r.h, label: KR.CARDS[cd.id].name, on: null });
    });
    // 説明（のせた きっぷ）
    const tipI = U.hoverCard >= 0 ? U.hoverCard : U.selCard;
    if (tipI >= 0 && P.cards[tipI]) {
      const cd = KR.CARDS[P.cards[tipI].id];
      const r = L.cards[tipI];
      const lines = A.wrap(c, cd.desc, 250, 13, 700);
      const w = 274, hh = 36 + lines.length * 18;
      const x = KR.clamp(r.x + r.w / 2 - w / 2, 10, R.W - w - 10), y = r.y - hh - 26;
      U.box(x, y, w, hh, { r: 10, plain: true, fill: '#fffdf6' });
      A.text(c, cd.name, x + 12, y + 16, 14, A.INK, 'left', 900);
      lines.forEach((l, i) => A.text(c, l, x + 12, y + 36 + i * 18, 13, '#5a4632', 'left', 700));
      if (P.used) A.text(c, '（きっぷは 1ターンに 1まい）', x + w - 10, y + 16, 10, '#c0392b', 'right', 700);
      else if (P.slow) A.text(c, '（ふみきり中は つかえない）', x + w - 10, y + 16, 10, '#c0392b', 'right', 700);
    }
    // サイコロ
    const d = L.dice;
    let mode = 'サイコロ 1こ', n = 1;
    const sc = U.selCard >= 0 ? P.cards[U.selCard] : null;
    if (P.slow) { mode = 'ふみきり：出目 1〜3'; }
    else if (P.diceN > 1) { n = P.diceN; mode = 'サイコロ ' + n + 'こ'; }
    else if (sc && (sc.id === 'kaisoku' || sc.id === 'kaisuu')) { n = 2; mode = KR.CARDS[sc.id].short + '：サイコロ 2こ'; }
    else if (sc && sc.id === 'tokkyu') { n = 3; mode = '特急：サイコロ 3こ'; }
    const hov = U.btn('roll', d.x, d.y, d.w, d.h, null, { kind: 'primary', r: 18, key: 'スペース', keyTop: true, on: h.onRoll });
    const yy = d.y + (hov ? -2 : 0);
    for (let i = 0; i < n; i++) {
      const dx = d.x + d.w / 2 + (i - (n - 1) / 2) * 40;
      if (P.slow) A.dieSlow(c, dx, yy + 44, 38, -1, Math.sin(R.time * 3 + i) * 0.12);
      else A.die(c, dx, yy + 44, 38, hov ? 1 + Math.floor((R.time * 12 + i * 3) % 6) : -1, Math.sin(R.time * 3 + i) * 0.12);
    }
    A.text(c, 'サイコロを ふる', d.x + d.w / 2, yy + 84, 17, '#fff', 'center', 900);
    A.text(c, mode, d.x + d.w / 2, yy + 102, 11, 'rgba(255,255,255,0.9)', 'center', 700);
  };

  // 各停きっぷの 数字えらび
  U.drawKakueki = function (G, h) {
    const c = C();
    const w = 470, hh = 150, x = R.W / 2 - 70 - w / 2, y = R.H - 300;
    U.box(x, y, w, hh, { fill: '#fffdf6' });
    A.text(c, '各停きっぷ：すすむ 数を えらぶ', x + w / 2, y + 24, 16, A.INK, 'center', 900);
    const P = G.P[0];
    const dd = E.destDist(G, P.node);
    for (let v = 1; v <= 6; v++) {
      const bx = x + 20 + (v - 1) * 72, by = y + 44;
      const ex = v === dd;
      const hov = U.btn('num:' + v, bx, by, 62, 62, null, { kind: ex ? 'gold' : 'paper', r: 12, on: () => h.onNum(v) });
      if (hov) h.onHoverNum(v);
      A.die(c, bx + 31, by + 31 + (hov ? -2 : 0), 40, v, 0);
      if (ex) A.text(c, 'ぴったり', bx + 31, by + 74, 11, '#c0392b', 'center', 900);
    }
    U.btn('numCancel', x + w - 92, y + hh - 34, 80, 26, 'やめる', { size: 13, on: h.onCancel });
  };
  // ふみきりの 相手えらび
  U.drawTarget = function (G, h) {
    const c = C();
    const w = 420, hh = 76, x = R.W / 2 - 70 - w / 2, y = R.H - 230;
    U.box(x, y, w, hh, { fill: '#fffdf6' });
    A.text(c, 'ふみきり：止める 会社を えらぶ（右の 札を クリック）', x + w / 2, y + 26, 14, A.INK, 'center', 900);
    U.btn('tgtCancel', x + w / 2 - 50, y + 42, 100, 26, 'やめる', { size: 13, on: h.onCancel });
  };

  // ------------------------------------------------------------ 行き先えらびの 説明
  U.candInfo = function (G, cd) {
    const o = cd.opt, n = M.nodes[o.node];
    const lines = [];
    let title, col = '#4a3626';
    const F = KR.inflation(G.turn);
    if (o.dest) {
      title = '目的地 ' + KR.STATIONS[o.node].name + ' に とうちゃく！';
      col = '#c45a12';
      const pr = Math.round((1000 + 120 * G.destDist) * F * (o.exact ? 1.5 : 1) / 10) * 10;
      lines.push('賞金 ' + yen(pr) + (o.exact ? '（ぴったり賞 1.5倍！）' : ''));
    } else if (n.t === 'st') {
      const s = KR.STATIONS[o.node];
      title = s.name + '駅';
      const P = G.P[G.cur];
      const free = s.pi.filter((i) => G.own[i] < 0);
      const can = free.filter((i) => M.props[i].price <= P.cash);
      lines.push('名物 ' + s.pi.length + '件（あいている ' + free.length + '件・いま 買える ' + can.length + '件）');
      const mono = E.monoOwner(G, o.node);
      if (mono >= 0) lines.push(KR.COMPANIES[mono].name + ' が 独占中');
    } else {
      const S = A.SQ[n.t];
      title = S.name; lines.push(S.desc);
      if (n.t === 'gate') { const g = M.gates[n.gate]; title = g.name + '（関所）'; }
    }
    if (!o.dest) lines.push('目的地まで あと ' + o.dd + ' マス');
    if (o.tolls) lines.push('通行料 ' + yen(Math.round(E.TOLL * F / 10) * 10 * o.tolls) + ' を はらう');
    if (o.stamps) lines.push('はじめての駅を 通る：スタンプ ' + o.stamps + 'こ');
    return { title, lines, col };
  };
  U.drawLanding = function (G, total) {
    const c = C();
    const h = R.cands && R.cands[R.candHover];
    const w = 460, x = R.W / 2 - 70 - w / 2;
    if (h) {
      const info = U.candInfo(G, h);
      const hh = 44 + info.lines.length * 20;
      const y = R.H - hh - 16;
      U.box(x, y, w, hh, { fill: '#fffdf6' });
      A.text(c, info.title, x + 18, y + 22, 18, info.col, 'left', 900);
      info.lines.forEach((l, i) => A.text(c, l, x + 18, y + 46 + i * 20, 14, '#5a4632', 'left', 700));
      A.text(c, 'クリックで けってい', x + w - 14, y + 22, 11, '#9a7a5a', 'right', 700);
    } else {
      const y = R.H - 64;
      U.box(x, y, w, 48, { fill: '#fffdf6' });
      A.text(c, '出目 ' + total + '：とまる マスを えらぶ（光っている ところ）', x + w / 2, y + 25, 15, A.INK, 'center', 900);
    }
  };

  // ------------------------------------------------------------ 駅の 画面（名物を 買う）
  U.drawStation = function (G, pnl, h) {
    const c = C();
    const st = pnl.st, s = KR.STATIONS[st];
    const reg = KR.REGIONS.find((r) => r.id === s.r);
    const P = G.P[0];
    const rowH = 62;
    const w = 600, hh = 150 + s.pi.length * rowH + 64;
    const x = Math.max(16, R.W / 2 - 70 - w / 2 - 40), y = Math.max(96, R.H / 2 - hh / 2 + 10);
    U.box(x, y, w, hh, { fill: '#fffaf0' });
    c.fillStyle = reg.ink; A.rr(c, x + 10, y + 10, w - 20, 8, 4); c.fill();
    A.text(c, s.name + '駅', x + 26, y + 46, 32, A.INK, 'left', 900);
    c.font = KR.FONT(32, 900); const nw = c.measureText(s.name + '駅').width;
    A.text(c, reg.name, x + 34 + nw, y + 52, 13, reg.ink, 'left', 800);
    A.text(c, s.tag, x + 26, y + 80, 14, '#7a5a3a', 'left', 700);
    // スタンプ
    A.stamp(c, st, x + w - 62, y + 58, 40, { alpha: P.stamps.indexOf(st) >= 0 ? 0.9 : 0.25 });
    const season = KR.seasonOf(G.turn);
    const mono = E.monoOwner(G, st);
    const hasBaishu = P.cards.some((cd) => cd.id === 'baishu');
    let ry = y + 104;
    A.text(c, '名物', x + 26, ry, 12, '#9a7a5a', 'left', 800);
    A.text(c, '値段', x + 330, ry, 12, '#9a7a5a', 'right', 800);
    A.text(c, '季節ごとの 収益', x + 430, ry, 12, '#9a7a5a', 'right', 800);
    ry += 12;
    s.pi.forEach((pi) => {
      const pr = M.props[pi];
      const o = G.own[pi];
      const fl = U.flash['prop' + pi];
      if (fl) { c.fillStyle = 'rgba(255,220,120,' + Math.min(1, fl) * 0.6 + ')'; A.rr(c, x + 14, ry + 2, w - 28, rowH - 6, 10); c.fill(); }
      c.strokeStyle = 'rgba(107,74,43,0.2)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 20, ry + rowH - 2); c.lineTo(x + w - 20, ry + rowH - 2); c.stroke();
      const cy = ry + rowH / 2;
      const scol = pr.season < 0 ? '#b8ad9c' : KR.SEASONS[pr.season].color;
      c.fillStyle = scol; A.circle(c, x + 44, cy, 20); c.fill();
      A.catIcon(c, pr.cat, x + 44, cy, 13, '#fff');
      A.text(c, pr.name, x + 74, cy - 9, 17, A.INK, 'left', 900);
      const shun = pr.season === season;
      const bw = A.seasonBadge(c, pr.season, x + 74, cy + 13, 17, shun);
      if (shun) A.text(c, 'いまが旬！', x + 82 + bw, cy + 14, 11, '#e8402a', 'left', 900);
      else A.text(c, A.CAT_NAME[pr.cat], x + 82 + bw, cy + 14, 11, '#9a7a5a', 'left', 700);
      A.text(c, yen(pr.price), x + 330, cy, 15, A.INK, 'right', 800);
      const base = pr.price * E.RATE;
      const inc = Math.round(base * (shun ? E.SHUN : 1) * (mono >= 0 && mono === o ? E.MONO : 1));
      A.text(c, '+' + inc + '万', x + 430, cy - 6, 15, '#2f7a3a', 'right', 900);
      A.text(c, pr.season < 0 ? '毎季おなじ' : KR.SEASONS[pr.season].name + 'は 3倍', x + 430, cy + 13, 10, '#7a8a6a', 'right', 700);
      const bx = x + w - 150, bwid = 128;
      if (o < 0) {
        const can = P.cash >= pr.price && h.canAct;
        U.btn('buy:' + pi, bx, cy - 20, bwid, 40, '買う', { kind: can ? 'primary' : 'paper', disabled: !can, size: 17, on: () => h.onBuy(pi) });
      } else if (o === 0) {
        c.fillStyle = KR.COMPANIES[0].color; A.rr(c, bx, cy - 17, bwid, 34, 17); c.fill();
        A.text(c, 'あなたの名物', bx + bwid / 2, cy + 1, 14, '#fff', 'center', 900);
      } else {
        const co = KR.COMPANIES[o];
        if (hasBaishu && h.canAct) {
          const tp = E.takeoverPrice(pr);
          U.btn('take:' + pi, bx, cy - 20, bwid, 40, '買収する', { kind: 'color', col: '#6f5bb5', dark: '#3f2f7a', size: 14, sub: yen(tp), disabled: P.cash < tp, on: () => h.onTake(pi) });
        } else {
          c.fillStyle = co.light; A.rr(c, bx, cy - 17, bwid, 34, 17); c.fill();
          c.strokeStyle = co.color; c.lineWidth = 2; A.rr(c, bx, cy - 17, bwid, 34, 17); c.stroke();
          A.text(c, co.short + 'の名物', bx + bwid / 2, cy + 1, 13, co.dark, 'center', 900);
        }
      }
      ry += rowH;
    });
    // 下
    const fy = y + hh - 48;
    A.text(c, '所持金 ' + yen(P.cash), x + 26, fy + 10, 17, A.INK, 'left', 900);
    let note;
    if (mono === 0) note = '独占中！ この駅の 収益は 2倍';
    else if (mono > 0) note = KR.COMPANIES[mono].name + ' の 独占駅';
    else {
      const others = s.pi.some((i) => G.own[i] > 0);
      note = others ? 'ほかの会社の 名物が あるので 独占は できない' : 'ぜんぶ 買うと 独占：収益 2倍';
      if (others && hasBaishu) note = '買収きっぷで ほかの会社の 名物も 買える';
    }
    A.text(c, note, x + 26, fy + 32, 12, '#9a5a2a', 'left', 800);
    if (h.canAct) U.btn('done', x + w - 170, fy - 6, 150, 46, 'おわる', { kind: 'gold', size: 19, key: 'スペース', on: h.onDone });
    pnl.rect = { x, y, w, h: hh };
  };

  // ------------------------------------------------------------ できごとの 画面
  U.evText = (G, def, inst) => def.text.replace('{rival}', KR.COMPANIES[inst.rival].boss + '（' + KR.COMPANIES[inst.rival].short + '）');
  U.drawEvent = function (G, pnl, h) {
    const c = C();
    const def = E.eventDef(pnl.inst.id);
    const w = 580, hh = 340;
    const x = R.W / 2 - 70 - w / 2, y = R.H / 2 - hh / 2 + 20;
    U.box(x, y, w, hh, { fill: '#fffaf0', line: '#6c3f8e' });
    c.fillStyle = '#a46acb'; A.rr(c, x + 10, y + 10, w - 20, 8, 4); c.fill();
    A.eventIcon(c, def.icon, x + 70, y + 84, 44);
    A.text(c, 'できごと', x + 128, y + 46, 13, '#a46acb', 'left', 900);
    A.text(c, def.title, x + 128, y + 76, 26, A.INK, 'left', 900);
    if (pnl.p !== 0) { A.portrait(c, pnl.p, x + w - 46, y + 56, 26); A.text(c, KR.COMPANIES[pnl.p].short, x + w - 46, y + 94, 11, KR.COMPANIES[pnl.p].dark, 'center', 900); }
    const lines = A.wrap(c, U.evText(G, def, pnl.inst), w - 160, 16, 700);
    lines.forEach((l, i) => A.text(c, l, x + 128, y + 108 + i * 24, 16, '#4a3626', 'left', 700));
    const F = KR.inflation(G.turn);
    if (pnl.phase === 'choose') {
      def.ch.forEach((ch, i) => {
        const bw = (w - 60) / 2, bx = x + 20 + i * (bw + 20), by = y + hh - 132;
        const cost = ch.eff.cost ? Math.round(ch.eff.cost * F / 10) * 10 : 0;
        const dis = !h.canAct || (cost && G.P[pnl.p].cash < cost);
        const kind = pnl.cpuPick === i ? 'gold' : i === 0 ? 'primary' : 'paper';
        const hov = U.btn('ch:' + i, bx, by, bw, 104, null, { kind, disabled: dis && pnl.cpuPick !== i, key: h.canAct ? String(i + 1) : null, on: () => h.onChoice(i) });
        const yy = by + (hov ? -2 : 0);
        const light = kind === 'primary';
        const ink = dis && pnl.cpuPick !== i ? '#9d9282' : light ? '#fff' : A.INK;
        const sub = dis && pnl.cpuPick !== i ? '#9d9282' : light ? 'rgba(255,255,255,0.92)' : '#7a5a3a';
        A.text(c, ch.label, bx + bw / 2, yy + 26, 20, ink, 'center', 900);
        // 先に わかること：はらうお金・サイコロの 表・もらえるもの
        const s = U.effSummary(G, ch.eff, pnl);
        A.text(c, s.head, bx + bw / 2, yy + 54, 13, sub, 'center', 800);
        s.lines.forEach((l, k) => A.text(c, l, bx + bw / 2, yy + 74 + k * 17, 12, sub, 'center', 700));
      });
    } else {
      const res = pnl.res;
      const by = y + hh - 160;
      const ch = def.ch[pnl.choice];
      A.text(c, '「' + ch.label + '」', x + w / 2, by, 15, '#7a5a3a', 'center', 800);
      // サイコロ
      const dt = pnl.t;
      if (res.duel) {
        const roll = dt < 0.8;
        const va = roll ? 1 + Math.floor((dt * 20) % 6) : res.duel.a, vb = roll ? 1 + Math.floor((dt * 17 + 3) % 6) : res.duel.b;
        A.portrait(c, pnl.p, x + w / 2 - 150, by + 46, 22); A.die(c, x + w / 2 - 90, by + 46, 46, va, roll ? dt * 9 : 0);
        A.text(c, 'VS', x + w / 2, by + 46, 20, '#7a5a3a', 'center', 900);
        A.die(c, x + w / 2 + 90, by + 46, 46, vb, roll ? -dt * 9 : 0); A.portrait(c, pnl.inst.rival, x + w / 2 + 150, by + 46, 22);
      } else if (res.dice) {
        const roll = dt < 0.8;
        A.die(c, x + w / 2, by + 46, 52, roll ? 1 + Math.floor((dt * 20) % 6) : res.dice, roll ? dt * 9 : 0);
      }
      const show = !(res.dice || res.duel) || dt >= 0.8;
      if (show) {
        const ty = res.dice || res.duel ? by + 98 : by + 40;
        A.text(c, res.say || '', x + w / 2, ty, 18, A.INK, 'center', 900);
        let extra = '';
        if (res.money) extra = (res.money > 0 ? '+' : '') + yen(res.money);
        if (res.cards && res.cards.length) extra += (extra ? '　' : '') + KR.CARDS[res.cards[0]].name + ' を もらった';
        if (extra) A.textOutline(c, extra, x + w / 2, ty + 28, 18, res.money < 0 ? '#c0392b' : '#2f7a3a', '#fffaf0', 4, 'center', 900);
      }
      if (h.canAct && show) U.btn('evok', x + w / 2 - 70, y + hh - 18 - 40 + 6, 140, 40, 'OK', { kind: 'gold', size: 18, key: 'スペース', on: h.onOk });
    }
  };

  // できごとの えらびの 中身を みじかい 文に
  U.effSummary = function (G, eff, pnl) {
    const F = KR.inflation(G.turn);
    const m = (v) => Math.round(v * F / 10) * 10;
    const out = (e) => {
      const p = [];
      if (e.money) p.push((e.money > 0 ? '+' : '−') + Math.abs(m(e.money)) + '万');
      if (e.card) p.push(e.card === 'random' ? 'きっぷ' : KR.CARDS[e.card].short);
      return p.length ? p.join('・') : 'なし';
    };
    let head = '', lines = [];
    if (eff.cost) head = yen(m(eff.cost)) + ' はらう';
    if (eff.dice) {
      head += (head ? '・' : '') + 'サイコロしだい';
      const rows = eff.dice.map((r) => (r[0] === r[1] ? r[0] : r[0] + '〜' + r[1]) + '：' + out(r[2]));
      lines = rows.length > 2 ? [rows.slice(0, 2).join('　'), rows[2]] : [rows.join('　')];
    } else if (eff.duel) {
      head = 'サイコロ勝負（' + yen(m(eff.duel)) + '）';
      lines = ['勝てば もらう・負ければ はらう'];
    } else {
      const p = [];
      if (eff.money) p.push('+' + m(eff.money) + '万');
      if (eff.card) p.push(eff.card === 'random' ? 'きっぷ 1まい' : KR.CARDS[eff.card].name);
      if (eff.fromRival) p.push('+' + m(eff.fromRival) + '万（相手から）');
      if (eff.perProp) { const n = E.propsOf(G, pnl.p).length; p.push('名物1件ごと +' + m(eff.perProp) + '万（いま ' + n + '件）'); }
      if (!head) head = p.length ? 'かならず' : '';
      lines = [p.length ? p.join('・') : 'なにも おきない'];
    }
    return { head, lines };
  };

  // ------------------------------------------------------------ 地方を ひらく
  U.drawOpen = function (G, pnl, h) {
    const c = C();
    const n = pnl.options.length;
    const cw = 250, gap = 18;
    const w = Math.max(520, n * cw + (n - 1) * gap + 60), hh = 360;
    const x = R.W / 2 - 70 - w / 2, y = R.H / 2 - hh / 2 + 10;
    U.box(x, y, w, hh, { fill: '#fffaf0' });
    A.text(c, 'つぎに ひらく 地方を えらぶ', x + w / 2, y + 40, 26, A.INK, 'center', 900);
    A.text(c, 'えらんだ 地方に つぎの目的地が 出る。地方への 関所は あなたの もの（ほかの会社が 通るたびに 通行料）', x + w / 2, y + 72, 12, '#7a5a3a', 'center', 700);
    pnl.options.forEach((r, i) => {
      const reg = KR.REGIONS[r];
      const bx = x + 30 + i * (cw + gap), by = y + 96;
      const hov = U.btn('open:' + r, bx, by, cw, 228, null, { kind: 'paper', r: 14, on: () => h.onOpen(r), key: String(i + 1) });
      const yy = by + (hov ? -2 : 0);
      c.fillStyle = reg.ink; A.rr(c, bx + 8, yy + 8, cw - 16, 46, 10); c.fill();
      A.text(c, reg.name, bx + cw / 2, yy + 32, 24, '#fff', 'center', 900);
      A.text(c, '名物：' + reg.teaser, bx + cw / 2, yy + 74, 12, '#5a4632', 'center', 700);
      const gates = M.gates.filter((g) => (g.ra === r && G.open[g.rb]) || (g.rb === r && G.open[g.ra]));
      A.text(c, '関所', bx + 20, yy + 104, 11, '#9a7a5a', 'left', 800);
      gates.forEach((g, k) => A.text(c, '・' + g.name, bx + 20, yy + 126 + k * 20, 14, A.INK, 'left', 800));
      const d = pnl.dist[i];
      A.text(c, 'あなたから いちばん近い駅まで', bx + cw / 2, yy + 182, 11, '#9a7a5a', 'center', 700);
      A.text(c, '約 ' + d + ' マス', bx + cw / 2, yy + 204, 18, '#c0392b', 'center', 900);
    });
  };

  // ------------------------------------------------------------ 決算
  U.drawSettle = function (G, pnl, h) {
    const c = C();
    const t = pnl.t;
    c.fillStyle = 'rgba(30,20,10,0.55)'; c.fillRect(0, 0, R.W, R.H);
    const w = Math.min(1100, R.W - 40), hh = 560;
    const x = R.W / 2 - w / 2, y = R.H / 2 - hh / 2;
    U.box(x, y, w, hh, { fill: '#fffaf0' });
    const sea = KR.SEASONS[pnl.s];
    c.fillStyle = sea.color; A.rr(c, x + 10, y + 10, w - 20, 64, 10); c.fill();
    A.textOutline(c, sea.name + 'の 決算（' + sea.months + '）', x + w / 2, y + 42, 30, '#fff', 'rgba(40,20,10,0.5)', 6, 'center', 900);
    A.text(c, '名物の 収益：値段の 5%。旬は 3倍、独占の 駅は 2倍', x + w / 2, y + 92, 13, '#7a5a3a', 'center', 700);
    const colW = (w - 60) / 3;
    const maxInc = Math.max(1, ...pnl.rows.map((r) => r.income));
    pnl.rows.forEach((row, i) => {
      const co = KR.COMPANIES[row.p];
      const cx = x + 30 + i * colW, cy = y + 112;
      c.fillStyle = co.light; A.rr(c, cx + 6, cy, colW - 12, 330, 12); c.fill();
      c.strokeStyle = co.color; c.lineWidth = 2.4; A.rr(c, cx + 6, cy, colW - 12, 330, 12); c.stroke();
      A.portrait(c, row.p, cx + 46, cy + 40, 28, 'happy');
      A.text(c, co.name, cx + 84, cy + 30, 16, co.dark, 'left', 900);
      A.text(c, row.p === 0 ? 'あなた' : co.boss, cx + 84, cy + 52, 12, '#7a5a3a', 'left', 700);
      const k = KR.clamp((t - 0.3 - i * 0.25) / 1.4, 0, 1);
      const shown = Math.round(row.income * KR.easeOut(k));
      A.textOutline(c, '+' + yen(shown).replace('+', ''), cx + colW / 2, cy + 104, 30, '#2f7a3a', '#fff', 6, 'center', 900);
      // 棒
      c.fillStyle = 'rgba(0,0,0,0.08)'; A.rr(c, cx + 24, cy + 128, colW - 48, 12, 6); c.fill();
      c.fillStyle = co.color; A.rr(c, cx + 24, cy + 128, (colW - 48) * (row.income / maxInc) * KR.easeOut(k), 12, 6); c.fill();
      if (!row.items.length) A.text(c, '名物を まだ 持っていない', cx + colW / 2, cy + 176, 13, '#9a7a5a', 'center', 700);
      row.items.forEach((it, j) => {
        const pr = M.props[it.prop];
        const iy = cy + 164 + j * 34;
        c.globalAlpha = KR.clamp((k - j * 0.15) * 3, 0, 1);
        A.catIcon(c, pr.cat, cx + 30, iy, 9, pr.season < 0 ? '#9a8e7e' : KR.SEASONS[pr.season].color);
        A.text(c, pr.name, cx + 46, iy, 13, A.INK, 'left', 800);
        let tag = '';
        if (it.shun) tag += '旬';
        if (it.mono) tag += (tag ? '・' : '') + '独占';
        if (tag) A.text(c, tag, cx + 46, iy + 15, 10, '#e8402a', 'left', 900);
        A.text(c, '+' + it.v + '万', cx + colW - 26, iy, 13, '#2f7a3a', 'right', 900);
        c.globalAlpha = 1;
      });
      if (row.count > row.items.length) A.text(c, 'ほか ' + (row.count - row.items.length) + '件', cx + colW / 2, cy + 306, 11, '#9a7a5a', 'center', 700);
    });
    // 順位
    if (t > 2.2) {
      const rank = G.P.map((P, i) => ({ i, a: E.assets(G, i) })).sort((a, b) => b.a - a.a);
      const ry = y + hh - 70;
      A.text(c, '総資産の 順位', x + 40, ry + 4, 13, '#7a5a3a', 'left', 800);
      rank.forEach((r, k) => {
        const rx = x + 160 + k * 250;
        A.text(c, (k + 1) + '位', rx, ry + 4, 20, k === 0 ? '#c0392b' : A.INK, 'left', 900);
        A.text(c, KR.COMPANIES[r.i].short + '　' + yenS(r.a), rx + 46, ry + 4, 16, KR.COMPANIES[r.i].dark, 'left', 900);
      });
      U.btn('settleOk', x + w - 190, y + hh - 54, 160, 42, pnl.final ? '結果を見る' : 'つづける', { kind: 'gold', size: 18, key: 'スペース', on: h.onOk });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
