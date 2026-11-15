/*
 * ぐるり、夜まつり ― 土台（画面の切りかえ・入力・保存・共通の部品）
 * 戦いの画面は battle.js、そのほかの画面は scenes.js
 */
(function (root) {
  'use strict';
  const D = root.G10Data, S = root.G10Sim, R = root.G10Render, A = root.G10Audio;
  const W = 1280, H = 720;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const SAVE_KEY = 'g10_gururi_yomatsuri_v1';

  const G = {
    W, H, canvas, ctx, D, S, R, A,
    t: 0, dt: 0, scene: null, scenes: {},
    buttons: [], hoverBtn: -1, pressBtn: -1,
    mouse: { x: 640, y: 360, down: false, inside: false },
    save: null, menu: null, toast: null, fade: 0, fadeDir: 0, fadeCb: null,
    debug: { hold: false, speed: 1 }
  };
  root.G10 = G;

  // ---------------------------------------------------------------- 保存
  function defaultSave() {
    return {
      run: null, // { P, a, n, time, stats }
      book: {}, // sp → むすんだ数（周回をこえて のこる）
      cleared: 0,
      settings: { vol: 0.75, bgm: 0.5, muted: false },
      seen: {}
    };
  }
  G.load = function () {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { s = null; }
    G.save = Object.assign(defaultSave(), s || {});
    G.save.settings = Object.assign(defaultSave().settings, G.save.settings || {});
    G.save.seen = G.save.seen || {};
    G.save.book = G.save.book || {};
  };
  G.store = function () {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) { /* 保存できない環境でも 遊べる */ }
  };
  G.addBook = function (sp, n) {
    G.save.book[sp] = (G.save.book[sp] || 0) + (n || 1);
  };
  G.seen = function (k) { return !!G.save.seen[k]; };
  G.markSeen = function (k) { G.save.seen[k] = 1; G.store(); };

  // ---------------------------------------------------------------- 画面の大きさ
  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    const cw = Math.floor(W * s), ch = Math.floor(H * s);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    const dpr = window.devicePixelRatio || 1;
    let k = Math.min(2, Math.max(1, Math.round(s * dpr * 4) / 4));
    if (canvas.width !== Math.round(W * k)) {
      canvas.width = Math.round(W * k); canvas.height = Math.round(H * k);
    }
    R.setScale(k);
    G.k = k;
  }
  window.addEventListener('resize', fit);
  fit();
  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }

  // ---------------------------------------------------------------- ボタン
  // 毎フレーム 描くときに 登録する。{x,y,w,h,label,on,key,sub,disabled,style}
  G.button = function (b) {
    G.buttons.push(b);
    const i = G.buttons.length - 1;
    const hov = i === G.hoverBtn && !b.disabled;
    const c = ctx;
    const st = b.style || 'normal';
    c.save();
    const lift = hov ? -2 : 0;
    R.rr(c, b.x, b.y + lift, b.w, b.h, b.r || 12);
    let fill = 'rgba(40,24,40,0.92)', border = 'rgba(255,214,150,0.55)', col = '#fff3dc';
    if (st === 'main') { fill = hov ? '#e0423a' : '#c8302c'; border = '#ffd08a'; col = '#fff'; }
    else if (st === 'ghost') { fill = hov ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.25)'; border = 'rgba(255,255,255,0.35)'; }
    else if (hov) fill = 'rgba(70,40,60,0.95)';
    if (b.disabled) { fill = 'rgba(40,36,44,0.8)'; border = 'rgba(255,255,255,0.15)'; col = 'rgba(255,255,255,0.35)'; }
    c.shadowColor = 'rgba(0,0,0,0.4)'; c.shadowBlur = hov ? 14 : 8; c.shadowOffsetY = 3;
    c.fillStyle = fill; c.fill();
    c.shadowColor = 'transparent';
    c.lineWidth = hov ? 2.5 : 1.5; c.strokeStyle = border; c.stroke();
    const fs = b.size || 20;
    if (b.sub) {
      R.text(c, b.label, b.x + b.w / 2, b.y + b.h / 2 - fs * 0.38 + lift, { size: fs, color: col });
      R.text(c, b.sub, b.x + b.w / 2, b.y + b.h / 2 + fs * 0.62 + lift, { size: Math.round(fs * 0.62), color: b.disabled ? col : 'rgba(255,235,200,0.8)', weight: 'normal' });
    } else R.text(c, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1 + lift, { size: fs, color: col });
    if (b.keyHint) R.text(c, b.keyHint, b.x + b.w - 14, b.y + b.h / 2 + lift, { size: 12, color: 'rgba(255,230,200,0.5)', align: 'right', weight: 'normal' });
    c.restore();
    return b;
  };
  function hitButton(x, y) {
    for (let i = G.buttons.length - 1; i >= 0; i--) {
      const b = G.buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i;
    }
    return -1;
  }

  // ---------------------------------------------------------------- 画面の切りかえ
  G.go = function (name, arg, opt) {
    opt = opt || {};
    const doit = () => {
      const prev = G.scene;
      if (prev && G.scenes[prev] && G.scenes[prev].exit) G.scenes[prev].exit();
      G.scene = name;
      G.sceneT = 0;
      G.menu = null;
      const sc = G.scenes[name];
      if (sc && sc.enter) sc.enter(arg);
    };
    if (opt.instant || !G.scene) { doit(); return; }
    G.fadeDir = 1; G.fade = 0; G.fadeCb = doit;
  };

  G.toastMsg = function (text, dur) { G.toast = { text, t: 0, dur: dur || 2.2 }; };

  // ---------------------------------------------------------------- 入力
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    A.init(); applySettings();
    const p = toCanvas(e);
    G.mouse.x = p.x; G.mouse.y = p.y; G.mouse.down = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* なくても よい */ }
    if (e.button === 2) { const sc = G.scenes[G.scene]; if (sc && sc.rightClick) sc.rightClick(p.x, p.y); return; }
    G.hoverBtn = hitButton(p.x, p.y);
    if (G.hoverBtn >= 0) { G.pressBtn = G.hoverBtn; return; }
    if (G.menu) return;
    const sc = G.scenes[G.scene];
    if (sc && sc.down) sc.down(p.x, p.y, e);
  });
  canvas.addEventListener('pointermove', e => {
    const p = toCanvas(e);
    G.mouse.x = p.x; G.mouse.y = p.y; G.mouse.inside = true;
    G.hoverBtn = hitButton(p.x, p.y);
    const sc = G.scenes[G.scene];
    if (!G.menu && sc && sc.move) sc.move(p.x, p.y, e);
  });
  canvas.addEventListener('pointerup', e => {
    const p = toCanvas(e);
    G.mouse.down = false;
    if (e.button === 2) return;
    if (G.pressBtn >= 0) {
      const i = hitButton(p.x, p.y);
      const b = G.buttons[G.pressBtn];
      G.pressBtn = -1;
      if (i >= 0 && G.buttons[i] === b && !b.disabled && b.on) { A.play('ui'); b.on(); }
      return;
    }
    const sc = G.scenes[G.scene];
    if (!G.menu && sc && sc.up) sc.up(p.x, p.y, e);
  });
  canvas.addEventListener('pointerleave', () => { G.mouse.inside = false; });
  window.addEventListener('keydown', e => {
    A.init(); applySettings();
    const k = e.key;
    if (k === 'm' || k === 'M') { G.save.settings.muted = !G.save.settings.muted; applySettings(); G.store(); G.toastMsg(G.save.settings.muted ? '音を けしました（M）' : '音を だします（M）', 1.4); return; }
    if (G.menu) {
      if (k === 'Escape') { G.menu = null; A.play('ui'); }
      return;
    }
    const sc = G.scenes[G.scene];
    if (sc && sc.key && sc.key(k, e) === true) { e.preventDefault(); return; }
    if (k === 'Enter' || k === ' ') {
      const b = G.buttons.find(b2 => b2.def && !b2.disabled);
      if (b) { A.play('ui'); b.on(); e.preventDefault(); }
    }
  });
  function applySettings() {
    const s = G.save.settings;
    A.setVol(s.vol); A.setBgmVol(s.bgm); A.setMuted(s.muted);
  }
  G.applySettings = applySettings;

  // ---------------------------------------------------------------- メニュー（Esc）
  G.openMenu = function (items) { G.menu = { items, t: 0 }; A.play('ui'); };
  function drawMenu() {
    const m = G.menu;
    m.t += G.dt;
    ctx.fillStyle = 'rgba(8,4,16,0.6)'; ctx.fillRect(0, 0, W, H);
    const w = 420, h = 110 + m.items.length * 62 + 120;
    const x = (W - w) / 2, y = (H - h) / 2;
    R.panel(ctx, x, y, w, h);
    R.text(ctx, 'ひとやすみ', W / 2, y + 44, { size: 28, font: R.FONT_TITLE, color: '#ffe2b0' });
    m.items.forEach((it, i) => {
      G.button({ x: x + 50, y: y + 84 + i * 62, w: w - 100, h: 50, label: it.label, on: it.on, style: i === 0 ? 'main' : 'normal', def: i === 0 });
    });
    // 音量
    const sy = y + 94 + m.items.length * 62;
    const s = G.save.settings;
    const vols = [['効果音', 'vol'], ['BGM', 'bgm']];
    vols.forEach(([lb, key], j) => {
      const yy = sy + j * 40;
      R.text(ctx, lb, x + 60, yy + 16, { size: 16, align: 'left', color: '#ffe2b0' });
      for (let q = 0; q <= 4; q++) {
        const v = q / 4;
        const on = Math.round(s[key] * 4) === q;
        G.button({ x: x + 150 + q * 46, y: yy, w: 40, h: 32, label: q === 0 ? '切' : String(q), size: 15, style: on ? 'main' : 'ghost', on: () => { s[key] = v; applySettings(); G.store(); if (key === 'vol') A.play('link', { n: 3, t: 'K' }); } });
      }
    });
    R.text(ctx, 'M キーで 音の あり・なし　／　Esc で とじる', W / 2, y + h - 22, { size: 13, color: 'rgba(255,230,200,0.6)', weight: 'normal' });
  }

  // ---------------------------------------------------------------- 毎フレーム
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    G.realDt = dt;
    last = now;
    if (!G.debug.hold) step(dt * (G.debug.speed || 1));
    requestAnimationFrame(frame);
  }
  function step(dt) {
    G.dt = dt; G.t += dt; G.sceneT = (G.sceneT || 0) + dt;
    A.tick();
    const sc = G.scenes[G.scene];
    if (sc && sc.update && !G.menu) sc.update(dt);
    draw();
  }
  G.step = step;
  function draw() {
    G.buttons = [];
    ctx.setTransform(G.k, 0, 0, G.k, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sc = G.scenes[G.scene];
    if (sc && sc.draw) sc.draw(ctx);
    if (G.menu) drawMenu();
    if (G.toast) {
      G.toast.t += G.dt;
      const a = Math.min(1, G.toast.t * 5, (G.toast.dur - G.toast.t) * 3);
      if (a <= 0) G.toast = null;
      else {
        ctx.globalAlpha = a;
        ctx.font = 'bold 18px ' + R.FONT;
        const w = ctx.measureText(G.toast.text).width + 44;
        R.panel(ctx, (W - w) / 2, 18, w, 44, { r: 22, inner: false });
        R.text(ctx, G.toast.text, W / 2, 41, { size: 18, color: '#ffe8c8' });
        ctx.globalAlpha = 1;
      }
    }
    if (G.fadeDir) {
      G.fade += G.dt * 4 * G.fadeDir;
      if (G.fadeDir > 0 && G.fade >= 1) { G.fade = 1; G.fadeDir = -1; const cb = G.fadeCb; G.fadeCb = null; if (cb) cb(); }
      else if (G.fadeDir < 0 && G.fade <= 0) { G.fade = 0; G.fadeDir = 0; }
      ctx.fillStyle = 'rgba(6,3,12,' + Math.max(0, Math.min(1, G.fade)) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    // ボタンの上では 指の形
    canvas.style.cursor = (G.hoverBtn >= 0 && G.buttons[G.hoverBtn] && !G.buttons[G.hoverBtn].disabled) ? 'pointer' : (G.cursor || 'default');
  }

  // ---------------------------------------------------------------- 共通の 表示
  // 体力・小判・ひも などの 小さな 表示（地図・屋台で つかう）
  G.drawStatusBar = function (c, P, x, y) {
    const St = S.stats(P);
    R.panel(c, x, y, 520, 52, { r: 26, inner: false });
    R.heart(c, x + 30, y + 27, 26);
    R.text(c, P.hp + ' / ' + St.maxHp, x + 52, y + 27, { size: 19, align: 'left' });
    R.drawIcon(c, 'K', x + 168, y + 26, 36);
    R.text(c, String(P.coins), x + 186, y + 27, { size: 19, align: 'left', color: '#ffe08a' });
    R.cord(c, x + 268, y + 26, 30);
    R.text(c, 'ひも ' + St.cord, x + 290, y + 27, { size: 17, align: 'left' });
    const nf = Object.keys(P.friends).filter(k => P.friends[k] > 0).length;
    R.heart(c, x + 395, y + 27, 20, '#ffb0d0');
    R.text(c, 'ともだち ' + nf, x + 412, y + 27, { size: 17, align: 'left', color: '#ffd8ec' });
  };

  // 文字を 幅で おりかえす
  G.wrap = function (c, text, maxW, font) {
    c.font = font;
    const out = [];
    let line = '';
    for (const ch of text) {
      if (ch === '\n') { out.push(line); line = ''; continue; }
      const t2 = line + ch;
      if (c.measureText(t2).width > maxW && line) {
        // 句読点は 行頭に こさせない
        if ('、。」）！？'.includes(ch)) { out.push(t2); line = ''; continue; }
        // わかち書きの 空白で 折りかえす（ことばの 途中で 切らない）
        const sp = Math.max(line.lastIndexOf(' '), line.lastIndexOf('　'));
        if (ch !== ' ' && ch !== '　' && sp > line.length * 0.45) { out.push(line.slice(0, sp)); line = line.slice(sp + 1) + ch; continue; }
        // 「（」「「」は 行の おわりに のこさない
        if (/[（「(]$/.test(line)) { out.push(line.slice(0, -1)); line = line.slice(-1) + ch; continue; }
        out.push(line); line = (ch === ' ' || ch === '　') ? '' : ch;
      } else line = t2;
    }
    if (line) out.push(line);
    return out;
  };

  // 新しい周回
  G.newRun = function () {
    G.save.run = { P: S.newPlayer(), a: 0, n: 0, time: 0, stats: { rings: 0, best: 0, bigRing: 0, friendsMade: 0 }, started: Date.now() };
    G.store();
  };
  G.run = () => G.save.run;
  // いまの ノード（わかれ道は 配列）
  G.curNode = function () {
    const r = G.save.run;
    if (!r) return null;
    const area = D.AREAS[r.a];
    if (!area) return null;
    return area.nodes[r.n];
  };
  G.advance = function () {
    const r = G.save.run;
    r.n++;
    if (r.n >= D.AREAS[r.a].nodes.length) { r.a++; r.n = 0; r.areaIntroDone = false; }
    G.store();
  };

  G.boot = function () {
    G.load();
    applySettings();
    G.go('title', null, { instant: true });
    requestAnimationFrame(frame);
  };
})(window);
