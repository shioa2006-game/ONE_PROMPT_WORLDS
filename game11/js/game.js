/*
 * ひゅるり、凧びより ― 画面の きりかえ・入力・HUD・保存
 */
(function () {
  'use strict';
  const TJ = window.TJ;
  const TY = TJ.TYPES;
  const KITES = TJ.KITES;
  const FF = '"Hiragino Maru Gothic ProN","Yu Gothic UI","Meiryo","Noto Sans JP",sans-serif';
  const SAVE_KEY = 'tj11_save_v1', OPT_KEY = 'tj11_opt_v1';
  const NAV = '#2f3a52', CREAM = '#fbf5e8', RED = '#e2553b', GOLD = '#f0c24a';
  const PI = Math.PI, TAU = PI * 2;

  const cv = document.getElementById('game');
  const R = new TJ.Render(cv);
  const A = new TJ.Audio();
  const G = window.G11 = {
    state: 'title', sim: null, R, A, t: 0, st: 0,
    mouse: { x: 640, y: 360, in: false, down: false }, keys: {}, blastQ: false,
    buttons: [], hover: null, toasts: [], hint: null, hintQ: [], hintsSeen: {}, chapter: null, maxZone: 0,
    combo: { n: 0, show: 0 }, saveT: 0, clear: false, freePlay: false,
    debug: { hold: false, speed: 1 }
  };

  // ── 保存
  function store() { try { return window.localStorage; } catch (e) { return null; } }
  function loadOpt() { try { const s = store() && store().getItem(OPT_KEY); if (s) Object.assign(A.opt, JSON.parse(s)); } catch (e) { } }
  function saveOpt() { try { store() && store().setItem(OPT_KEY, JSON.stringify(A.opt)); } catch (e) { } }
  function readSave() { try { const s = store() && store().getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function writeSave() {
    if (!G.sim || G.state === 'title') return;
    try {
      const d = G.sim.save();
      d.hints = G.hintsSeen; d.maxZone = G.maxZone; d.clear = G.clear ? 1 : 0; d.free = G.freePlay ? 1 : 0;
      store() && store().setItem(SAVE_KEY, JSON.stringify(d));
    } catch (e) { }
  }
  G.hasSave = () => !!readSave();
  loadOpt();

  // ── 画面の大きさ
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    R.resize(window.innerWidth, window.innerHeight, dpr);
  }
  window.addEventListener('resize', resize);
  resize();
  const U = () => R.k;
  const LW = () => R.W / R.k, LH = () => R.H / R.k;

  // ── 入力
  function lpos(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left), (e.clientY - r.top)]; }
  cv.addEventListener('pointermove', (e) => { const [x, y] = lpos(e); G.mouse.x = x; G.mouse.y = y; G.mouse.in = true; G.mouse.touch = e.pointerType === 'touch'; });
  cv.addEventListener('pointerleave', () => { if (!G.mouse.touch) G.mouse.in = false; });
  cv.addEventListener('pointerdown', (e) => {
    const [x, y] = lpos(e);
    G.mouse.x = x; G.mouse.y = y; G.mouse.in = true; G.mouse.touch = e.pointerType === 'touch';
    A.init(); A.apply();
    if (e.button === 2) { e.preventDefault(); return; }
    const b = hitButton(x, y);
    if (b) { A.click(); b.fn(); return; }
    if (G.state === 'play') {
      if (G.mouse.touch) {
        // タッチ：ドンの ボタン以外は うごく先
        return;
      }
      G.blastQ = true;
    } else if (G.state === 'intro') nextIntro();
    else if (G.state === 'kite') { if (G.kiteScene && G.kiteScene.t > 1.0) G.kiteScene.t = Math.max(G.kiteScene.t, G.kiteScene.dur - 0.6); }
    else if (G.state === 'ending') endingClick();
  });
  cv.addEventListener('pointerup', (e) => { if (G.mouse.touch) G.mouse.in = false; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    A.init(); A.apply();
    const k = e.key;
    G.keys[k.toLowerCase()] = true;
    if (k === ' ' || k === 'z' || k === 'Z' || k === 'Enter') {
      if (G.state === 'play') G.blastQ = true;
      else if (G.state === 'title') { A.click(); if (G.hasSave()) cont(); else startNew(); }
      else if (G.state === 'intro') nextIntro();
      else if (G.state === 'kite' && G.kiteScene && G.kiteScene.t > 1.0) G.kiteScene.t = Math.max(G.kiteScene.t, G.kiteScene.dur - 0.6);
      else if (G.state === 'ending') endingClick();
      e.preventDefault();
    } else if (k === 'Escape') {
      if (G.state === 'play') openPause();
      else if (G.state === 'pause') closePause();
      else if (G.state === 'book' || G.state === 'howto') back();
    } else if (k === 'm' || k === 'M') { A.opt.mute = !A.opt.mute; A.apply(); saveOpt(); toast(A.opt.mute ? 'おとを けしました（M）' : 'おとを だしました（M）'); }
    else if ((k === 'b' || k === 'B') && G.state === 'play') { openBook('play'); }
    else if ((k === 'b' || k === 'B') && G.state === 'book') { back(); }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { G.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { G.keys = {}; if (G.state === 'play') openPause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { writeSave(); if (G.state === 'play') openPause(); } });
  window.addEventListener('beforeunload', writeSave);

  function hitButton(x, y) {
    const u = U();
    for (let i = G.buttons.length - 1; i >= 0; i--) {
      const b = G.buttons[i];
      if (x >= b.x * u && x <= (b.x + b.w) * u && y >= b.y * u && y <= (b.y + b.h) * u) return b;
    }
    return null;
  }

  // ── 文字と部品
  function font(size, w) { return (w || 800) + ' ' + Math.round(size) + 'px ' + FF; }
  function text(c, s, x, y, size, col, align, w, stroke, sw) {
    c.font = font(size, w); c.textAlign = align || 'left'; c.textBaseline = 'middle';
    if (stroke) { c.lineWidth = sw || Math.max(3, size * 0.2); c.strokeStyle = stroke; c.lineJoin = 'round'; c.strokeText(s, x, y); }
    c.fillStyle = col || NAV; c.fillText(s, x, y);
  }
  function panel(c, x, y, w, h, r, fill, stroke) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2.5; c.stroke(); }
  }
  function button(c, id, label, x, y, w, h, fn, opt) {
    opt = opt || {};
    const u = U();
    const hov = G.mouse.in && G.mouse.x >= x * u && G.mouse.x <= (x + w) * u && G.mouse.y >= y * u && G.mouse.y <= (y + h) * u;
    const main = opt.main;
    c.save();
    c.translate(0, hov ? -2 : 0);
    panel(c, x + 2, y + 4, w, h, h / 2, 'rgba(30,25,20,0.25)');
    panel(c, x, y, w, h, h / 2, main ? (hov ? '#f06a4f' : RED) : (hov ? '#fffaf0' : CREAM), main ? '#8e2f1f' : NAV);
    text(c, label, x + w / 2, y + h / 2 + 1, opt.size || Math.min(26, h * 0.46), main ? '#fff' : NAV, 'center', 800);
    c.restore();
    G.buttons.push({ id, x, y, w, h, label, fn });
    return hov;
  }

  // ── 案内（ヒント）とトースト
  function hint(id, msg, dur, prio) {
    if (G.hintsSeen[id]) return;
    G.hintsSeen[id] = 1;
    const h = { msg, dur: dur || 5, t: 0, prio };
    if (prio) {
      G.hintQ.unshift(h);
      if (G.hint && !G.hint.prio) G.hint.t = Math.max(G.hint.t, G.hint.dur - 0.3);
    } else G.hintQ.push(h);
  }
  function toast(msg, col, dur, kind) {
    if (kind === 'unlock') {
      const last = G.toasts[G.toasts.length - 1];
      if (last && last.kind === 'unlock' && last.t < 1.2) {
        last.names = last.names.concat(msg).filter((v, i, a) => a.indexOf(v) === i);
        last.msg = (last.names.length > 3 ? last.names.slice(0, 3).join('・') + ' など' : last.names.join('・')) + ' が まきこめる！';
        last.t = Math.min(last.t, 0.3);
        return;
      }
      const names = msg;
      msg = (names.length > 3 ? names.slice(0, 3).join('・') + ' など' : names.join('・')) + ' が まきこめる！';
      G.toasts.push({ msg, names, t: 0, dur: dur || 2.6, col: col || CREAM, kind });
    } else G.toasts.push({ msg, t: 0, dur: dur || 2.6, col: col || CREAM });
    while (G.toasts.length > 2) G.toasts.shift();
  }
  function chapter(z) {
    G.chapter = { z, t: 0, title: KITES[z - 1].title };
  }

  // ════ はじめる ════
  function newSim(save) {
    G.sim = new TJ.Sim(save);
    R.forest = null;
    R.parts.length = 0; R.texts.length = 0; R.rings.length = 0;
    R.cam.override = null;
    R.snapCamera(G.sim);
  }
  newSim(readSave());
  { const v0 = { x: 0, y: -40, z: Math.max(R.W / 760, R.H / 430) }; R.cam.x = v0.x; R.cam.y = v0.y; R.cam.z = v0.z; }

  function titleView() { return { x: 0, y: -40, z: Math.max(R.W / 760, R.H / 430) }; }
  function startNew() {
    try { store() && store().removeItem(SAVE_KEY); } catch (e) { }
    const keep = { x: R.cam.x, y: R.cam.y, z: R.cam.z };
    newSim(null);
    Object.assign(R.cam, keep);
    G.hintsSeen = {}; G.hintQ = []; G.hint = null; G.toasts = []; G.maxZone = 0; G.clear = false; G.freePlay = false;
    G.state = 'intro'; G.intro = { i: 0, t: 0 };
    A.setBgm(0); A.startBgm();
  }
  function cont() {
    const sv = readSave();
    if (!sv) { startNew(); return; }
    newSim(sv);
    G.hintsSeen = sv.hints || {}; G.maxZone = sv.maxZone || 0; G.clear = !!sv.clear; G.freePlay = !!sv.free;
    G.hintQ = []; G.hint = null; G.toasts = [];
    if (G.freePlay || G.sim.kiteIdx >= 5) { G.freePlay = true; G.sim.kiteIdx = 5; G.sim.boss.st = 'gone'; }
    G.state = 'play';
    A.setBgm(zoneBgm()); A.startBgm();
    toast('つづきから はじめます');
  }

  // ── はじめの話
  const INTRO = [
    'お正月の あさ。\n村は しずかで、かぜが ひとつも ふいていない。',
    '「たこ、あがらないねえ」\nえんがわで こはるが ためいきをついた。',
    'そのとき、にわの かれはが いちまい、\nくるりと まわった。'
  ];
  function nextIntro() {
    const it = G.intro;
    if (it.t < 0.4) return;
    it.i++; it.t = 0;
    if (it.i >= INTRO.length) {
      G.state = 'play';
      chapter(1); G.maxZone = 1;
      R.ring(G.sim.wind.x, G.sim.wind.y, 30, '#fff', 0.8, 5);
      R.burst(G.sim.wind.x, G.sim.wind.y, 14, { sp: 40, up: 30, g: 60, kind: 'star', col: '#fff', size: 7, life: 0.8 });
      A.grow();
      A.setBgm(1);
      hint('move', 'マウスの ほうへ すすむよ（キーボードの WASD・やじるしキー でも うごける）', 6);
      hint('goal', 'めあて：' + TJ.fmtSize(KITES[0].req) + ' まで そだって、こはるの やっこだこ を 空へ あげよう！', 6);
    }
  }

  // ── ポーズ
  function openPause() { G.prev = 'play'; G.state = 'pause'; writeSave(); }
  function closePause() { G.state = 'play'; }
  function openBook(from) { G.bookFrom = from; G.state = 'book'; G.bookPage = G.bookPage || 1; }
  function openHow(from) { G.howFrom = from; G.state = 'howto'; }
  function back() {
    if (G.state === 'book') G.state = G.bookFrom === 'title' ? 'title' : (G.bookFrom === 'play' ? 'play' : 'pause');
    else if (G.state === 'howto') G.state = G.howFrom === 'title' ? 'title' : 'pause';
  }
  function toTitle() { writeSave(); G.state = 'title'; A.setBgm(0); newSim(readSave()); const v = titleView(); R.cam.x = v.x; R.cam.y = v.y; R.cam.z = v.z; }

  // ── BGM のえらびかた
  function zoneBgm() {
    const s = G.sim;
    if (s.boss.st === 'fight' || s.boss.st === 'enter') return 9;
    return Math.max(1, Math.min(5, s.zoneAt(s.wind.x, s.wind.y)));
  }

  // ════ メインループ ════
  let last = performance.now();
  let acc = 0;
  const ft = [];
  G.debug.fps = () => { if (ft.length < 2) return 0; const a = ft.slice(-120); return Math.round(1000 * (a.length - 1) / (a[a.length - 1] - a[0])); };
  function frame(now) {
    requestAnimationFrame(frame);
    ft.push(now); if (ft.length > 240) ft.shift();
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (G.debug.hold) return;
    tick(dt * G.debug.speed);
  }
  function tick(dt) {
    G.t += dt;
    G.buttons = [];
    update(dt);
    drawAll(dt);
  }
  G.debug.run = function (n, dt) { for (let i = 0; i < (n || 1); i++) tick(dt || 1 / 60); };

  function playInput() {
    const k = G.keys;
    const inp = {};
    let kx = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
    let ky = (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0);
    if (kx || ky) { inp.kx = kx; inp.ky = ky; }
    else if (G.mouse.in) {
      const [wx, wy] = R.toWorld(G.mouse.x, G.mouse.y + G.sim.wind.S * R.cam.z * 0.0);
      inp.tx = wx; inp.ty = wy + G.sim.wind.S * 0.45; inp.pxPerCm = R.cam.z;
    }
    inp.blast = G.blastQ; G.blastQ = false;
    return inp;
  }

  let simAcc = 0;
  function update(dt) {
    const s = G.sim;
    G.st += dt;
    if (G.state === 'play' || G.state === 'bossIntro') {
      simAcc += dt;
      let n = 0;
      while (simAcc >= 1 / 60 && n < 6) {
        simAcc -= 1 / 60; n++;
        const inp = G.state === 'play' ? playInput() : {};
        s.step(1 / 60, inp);
        handleEvents(s.events);
        if (G.state !== 'play' && G.state !== 'bossIntro') { simAcc = 0; break; }
      }
      if (n === 6) simAcc = 0;
      R.updateCamera(s, dt);
      const sp = Math.hypot(s.wind.vx, s.wind.vy) / Math.max(1, s.wind.S * TJ.SIM_CONST.SPEED);
      A.wind(sp, s.wind.S, true);
      // 区間
      const z = s.zoneAt(s.wind.x, s.wind.y);
      if (z > G.maxZone && G.state === 'play') { G.maxZone = z; chapter(z); }
      A.setBgm(zoneBgm());
      G.saveT += dt;
      if (G.saveT > 10) { G.saveT = 0; writeSave(); }
      tutorial(dt);
      if (G.state === 'bossIntro') {
        const B = s.boss;
        R.cam.override = { x: TJ.lerp(s.wind.x, B.x, Math.min(1, G.bossIntroT * 1.5)), y: B.y - 1600, z: Math.min(R.baseD() / s.Sref, R.H / 11000) };
        G.bossIntroT += dt; if (G.bossIntroT > 3.4) { G.state = 'play'; R.cam.override = null; hint('boss', 'ゆきぐもの かげの なかで ドン！ ゆきに あたると、まきこんだものが こおって おちる。', 7); } }
    } else if (G.state === 'kite') {
      kiteUpdate(dt);
      A.wind(0.4, s.wind.S, true);
    } else if (G.state === 'ending') {
      endingUpdate(dt);
      A.wind(0.2, s.wind.S, true);
    } else {
      A.wind(0, s.wind.S, false);
      if (G.state === 'title') R.cam.override = titleView();
      else if (G.state === 'intro') R.cam.override = null;
      if (G.state === 'title' || G.state === 'intro') { s.wind.spin += dt * 6; R.updateCamera(s, dt); }
      if (G.state === 'intro') G.intro.t += dt;
    }
    // トースト・ヒント
    const live = G.state === 'play' || G.state === 'kite' || G.state === 'bossIntro';
    if (!live) dt = 0;
    for (let i = G.toasts.length - 1; i >= 0; i--) { G.toasts[i].t += dt; if (G.toasts[i].t > G.toasts[i].dur) G.toasts.splice(i, 1); }
    if (!G.hint && G.hintQ.length && G.state === 'play') G.hint = G.hintQ.shift();
    if (G.hint) { G.hint.t += dt; if (G.hint.t > G.hint.dur) G.hint = null; }
    if (G.chapter) { G.chapter.t += dt; if (G.chapter.t > 3.6) G.chapter = null; }
    if (G.combo.show > 0) G.combo.show -= dt;
  }

  // ── できごと → 音と演出
  function handleEvents(evs) {
    const s = G.sim, w = s.wind, S = w.S;
    const treNow = evs.some(e => e.type === 'pop' && e.tre);
    for (const e of evs) {
      switch (e.type) {
        case 'pop': {
          const big = e.rel > 0.55;
          A.pop(e.rel, e.combo, big);
          G.combo.n = e.combo; G.combo.show = 1.0;
          const a = Math.random() * TAU;
          R.burst(w.x + Math.cos(a) * S * 0.3, w.y + Math.sin(a) * S * 0.1, big ? 10 : 3, { z: S * 0.6, sp: S * (big ? 1.4 : 0.8), up: S * 0.6, g: S * 2.5, kind: 'star', col: big ? '#fff2a8' : '#ffffff', size: big ? 7 : 4, life: 0.5 });
          if (big) { R.kick(5); R.ring(w.x, w.y, S * 0.9, 'rgba(255,255,255,0.8)', 0.4, 4); if (!treNow) windFloat(TY[e.t].name + '！', { size: 26, col: '#fff2a8', life: 1.1 }); }
          if (e.tre) { A.treasure(); windFloat('おたから！ ' + TY[e.t].name, { size: 30, col: GOLD, life: 2.2, rise: 50 }); R.burst(w.x, w.y, 24, { z: S, sp: S * 2, up: S * 1.5, g: S * 3, kind: 'star', col: GOLD, size: 8, life: 1.0 }); toast('おたから「' + TY[e.t].name + '」を みつけた！', GOLD, 3.5); }
          else if (e.isNew) { A.newType(); if (!big && !treNow) windFloat('+ ' + TY[e.t].name, { size: 17, col: '#ffffff', life: 1.1, rise: 26 }); }
          if (!G.hintsSeen.suck) hint('suck', 'じぶんより ちいさいものは まきこめる。まきこむほど おおきくなる！', 5);
          break;
        }
        case 'grow': A.grow(); R.ring(w.x, w.y, S * 1.6, 'rgba(255,248,210,0.9)', 0.7, 6); windFloat('おおきくなった！', { size: 24, col: '#e9fbff', life: 1.3 }); break;
        case 'unlock': {
          const names = e.types.filter(t => TY[t].k !== 'tre').map(t => TY[t].name);
          if (names.length && G.st > 1) { A.unlock(); toast(names, '#e9fbff', 3, 'unlock'); }
          break;
        }
        case 'heavy': {
          const o = e.o;
          if (TY[o.t].k === 'break') {
            const can = S >= TY[o.t].min;
            R.float(can ? 'ドンで こわせる！' : TJ.fmtSize(TY[o.t].min) + 'から ドン', o.x, o.y - o.s * (o.solid ? 1.4 : 1.0), { size: 16, col: can ? '#fff2a8' : '#fff', life: 1.0, rise: 14, stroke: 'rgba(60,40,30,0.85)' });
            if (can) hint('don2', 'じぶんより おおきくても、入れもの や 門 は ドン（クリック）で こわせる！', 5);
            break;
          }
          R.float(TJ.fmtSize(o.s) + 'から', o.x, o.y - o.s * (TY[o.t].flat ? 0.4 : 1.0), { size: 15, col: '#fff', life: 0.9, rise: 14, stroke: 'rgba(60,40,30,0.8)' });
          hint('heavy', 'じぶんより おおきいものは、まだ まきこめない。でてくる 数字（○cmから）を こえたら まきこめる。', 6);
          break;
        }
        case 'blast': A.blast(S); R.kick(4 + Math.min(6, e.hits * 2)); R.burst(w.x, w.y, 10, { sp: S * 2.2, up: S * 0.3, g: S, kind: 'puff', col: 'rgba(255,255,255,0.9)', size: 10, life: 0.45 }); break;
        case 'blastEmpty': A.blastEmpty(); hint('empty', 'ドンには、まわりで まわっている もの が いる。なにか まきこもう。', 5); break;
        case 'hit': { const o = e.o; A.hit(e.dmg); R.burst(o.x, o.y, 6, { z: o.s * 0.4, sp: o.s * 0.8, up: o.s * 0.8, g: o.s * 3, col: '#e8dcc0', size: 5, life: 0.5 }); if (e.dmg) R.float('ドン！', o.x, o.y - o.s * 0.9, { size: 20, col: '#fff', life: 0.6, rise: 18 }); break; }
        case 'hard': { const o = e.o; A.hard(); R.float('かたい！ ' + TJ.fmtSize(e.need) + 'から', o.x, o.y - o.s * 0.9, { size: 18, col: '#ffd0c0', life: 1.2, rise: 20 }); break; }
        case 'break': {
          const o = e.o; A.crash(o.s > S * 0.6); R.kick(10);
          R.burst(o.x, o.y, 18, { z: o.s * 0.3, sp: o.s * 1.4, up: o.s * 1.4, g: o.s * 4, col: '#d9c4a0', size: 7, life: 0.7 });
          R.burst(o.x, o.y, 8, { z: o.s * 0.3, sp: o.s * 0.8, up: o.s * 0.3, g: 0, kind: 'puff', col: 'rgba(255,255,255,0.85)', size: 16, life: 0.6 });
          R.float('がしゃん！', o.x, o.y - o.s * 0.8, { size: 26, col: '#fff2a8', life: 0.9 });
          if (e.tre) toast('なにか ひかるものが でてきた…！', GOLD, 3);
          break;
        }
        case 'tree': A.rustle(); R.burst(e.tr.x, e.tr.y, 10, { z: e.tr.crown * 1.4, sp: e.tr.crown * 0.6, up: 0, g: e.tr.crown * 1.2, kind: 'confetti', col: e.tr.kind === 'ume' ? '#f6b7c8' : '#7a9a4a', size: 6, life: 1.2 }); break;
        case 'caw': A.caw(); if (e.drop) { R.float('カァ！', e.c.x, e.c.y - e.c.h, { size: 22, col: '#fff', life: 1 }); toast('からすが なにか おとした！', GOLD, 3); } break;
        case 'meow': A.meow(); R.float('にゃっ', e.c.x, e.c.y - 60, { size: 16, col: '#fff', life: 0.8 }); break;
        case 'cluck': A.cluck(); break;
        case 'hat': A.hat(); R.float('あっ、' + TY[e.t].name + 'が！', e.c.x, e.c.y - e.c.s * 1.2, { size: 16, col: '#fff', life: 1.1 }); hint('hat', 'ひとの もちものも まきこめる（あとで かえすから だいじょうぶ）。', 5); break;
        case 'bump': A.bump(); break;
        case 'wall': {
          const nm = { hedge: 'いけがき', fence: 'いたべい', ishigaki: 'いしがき', takegaki: 'たけがき', sugi: 'すぎばやし', trunk: '木', ido: 'いど', toriya: 'とりごや' }[e.draw] || 'かべ';
          R.float(nm + 'は ' + TJ.fmtSize(e.pass) + 'から こえられる', w.x, w.y - S * 1.5, { size: 16, col: '#fff', life: 1.4, rise: 16, stroke: 'rgba(60,40,30,0.85)' });
          break;
        }
        case 'kite': startKiteScene(e.i); break;
        case 'kiteSmall': { const k = KITES[e.k.i]; toast(k.owner + 'の ' + k.name + '：' + TJ.fmtSize(k.req) + 'に なったら あげられる（いま ' + TJ.fmtSize(S) + '）', CREAM, 3.2); break; }
        case 'kiteBlocked': toast('ゆきが つもって、おおだこが おもい……。ゆきぐもを ふきとばそう！', '#dbe8ff', 3.5); break;
        case 'bossEnter': G.state = 'bossIntro'; G.bossIntroT = 0; R.cam.override = { x: s.W.fest.cx, y: s.W.fest.cy - 6000, z: R.cam.z * 0.7 }; toast('ねぼすけの ゆきぐもが やってきた！', '#dbe8ff', 3.5); A.setBgm(9); break;
        case 'bossHit': A.bossHit(); R.kick(14); R.float('ぼふっ！', s.boss.x, s.boss.y - 3200, { size: 34, col: '#fff', life: 1 }); break;
        case 'bossDown': A.fanfare(); R.kick(20); R.float('ゆきぐもが ちぎれた！', s.boss.x, s.boss.y - 3000, { size: 34, col: GOLD, life: 2 }); break;
        case 'skyClear': toast('そらが はれた！ ちぎれた くもも まきこもう', GOLD, 4); A.setBgm(5); break;
        case 'freeze': A.freeze(); break;
        case 'regain': A.regain(); break;
        case 'comboEnd': if (e.n >= 10) windFloat(e.n + 'れんさ！', { size: 22 + Math.min(16, e.n * 0.3), col: '#ffe08a', life: 1.2 }); break;
        case 'ending': break;
      }
    }
  }

  // つむじの 上に 出す 文字（同時に 出ているものと 段を ずらす）
  function windFloat(msg, opt) {
    const s = G.sim, w = s.wind, S = w.S;
    const now = G.t;
    G.wfl = (G.wfl || []).filter(f => f.until > now);
    const slot = G.wfl.length;
    G.wfl.push({ until: now + Math.min(1.0, (opt.life || 1.1) * 0.8) });
    opt.rise = 22;
    R.float(msg, w.x, w.y - S * 1.45 - slot * 44 / R.cam.z, opt);
  }

  // ── 案内のタイミング
  function tutorial(dt) {
    const s = G.sim, S = s.wind.S;
    G.tutT = (G.tutT || 0) + dt;
    if (S >= 9 && !G.hintsSeen.don) hint('don', 'クリック（または スペース）で ドン！ まわりの ものを ぶつけて、かたいものを こわせる。うえきばち や きど を ためしてみよう。', 7);
    if (S >= 14 && !G.hintsSeen.kite1 && s.kiteIdx === 0) hint('kite1', 'こはるの やっこだこ は ' + TJ.fmtSize(KITES[0].req) + ' から。そだったら さわって あげよう！', 6);
    // かべを こえられる 大きさ に なった
    const PASS = [[36, 'いけがき'], [150, 'いしがき'], [500, 'たけがき'], [1200, 'すぎばやし']];
    if (G.lastS !== undefined) for (const [p, nm] of PASS) if (G.lastS < p && S >= p) { toast(nm + 'を こえられる おおきさに なった！', GOLD, 3.5); A.unlock(); }
    G.lastS = S;
    const z = s.zoneAt(s.wind.x, s.wind.y);
    if (z === 2 && S >= 40 && !G.hintsSeen.tree) hint('tree', 'かき や みかんの 木の そばで ドン！ ゆれて、みが おちてくる。', 6);
    if (z === 2 && !G.hintsSeen.crow) { for (const c of s.W.creatures) if (c.kind === 'crow' && c.item && c.x !== undefined && Math.hypot(c.x - s.wind.x, c.y - s.wind.y) < S * 6) { hint('crow', 'からすが なにか ひかるものを くわえている……。ちかくで ドン！', 6); break; } }
    for (const o of s.solidObjs) {
      if (o.st !== 0 || o.s <= S) continue;
      const d = Math.hypot(o.x - s.wind.x, o.y - s.wind.y);
      if (d < S * 4 + 100 && !G.hintsSeen['gate_' + o.t]) {
        if (S >= TY[o.t].min) hint('gate_' + o.t, TY[o.t].name + 'は ドンで こわせる。こわすと 先へ すすめる！', 6);
        else hint('gate_' + o.t, TY[o.t].name + 'は まだ かたい。' + TJ.fmtSize(TY[o.t].min) + 'に なったら ドンで こわせる。', 6);
      }
    }
    if (z === 3 && !G.hintsSeen.yatai) hint('yatai', 'やたい・ふくぶくろ・きばこ は ドンで あけられる。なかみが ちらばるぞ！', 6);
    if (s.kiteIdx >= 1 || G.tutT > 30) {
      // まわりに まきこめるものが ないとき、ちかくを おしえる
      G.lookT = (G.lookT || 0) + dt;
      if (G.lookT > 0.5) {
        G.lookT = 0;
        const v = R.view;
        let n = 0;
        for (const o of s.W.objs) { if (o.st === 0 && !o.pop && o.s <= S && o.s > S * 0.04 && o.x > v.x0 && o.x < v.x1 && o.y > v.y0 && o.y < v.y1) { n++; if (n > 2) break; } }
        if (n <= 2) G.emptyT = (G.emptyT || 0) + 0.5; else G.emptyT = 0;
        G.near = null;
        if (G.emptyT > 4) {
          const lift = s.nearestLiftable(40).filter(r => r.o.s > S * 0.04 && r.d < S * 40).slice(0, 3);
          G.near = lift;
          // ちかくに なにも ないときは、ドンで こわせる 入れもの を おしえる
          if (lift.length < 2) {
            const br = [];
            for (const o of s.W.objs) if (o.st === 0 && TY[o.t].k === 'break' && o.s > S && S >= TY[o.t].min) br.push({ o, d: Math.hypot(o.x - s.wind.x, o.y - s.wind.y), don: 1 });
            br.sort((a, b) => a.d - b.d);
            G.near = lift.concat(br.slice(0, 2));
            if (br.length) hint('stuck', 'まきこめるものが すくない……。「ドン」の 矢印の 先に、こわせる ものが あるよ。', 6);
          }
        }
      }
    }
  }

  // ════ 凧が あがる ════
  function startKiteScene(i) {
    const s = G.sim;
    const k = s.W.kites[i];
    G.state = 'kite';
    G.kiteScene = { i, t: 0, dur: i === 4 ? 5.2 : 4.2 };
    k.t = 0;
    A.kite();
    R.kick(8);
    for (let j = 0; j < 40; j++) {
      const a = Math.random() * TAU;
      R.parts.push({ x: k.x, y: k.y, z: 0, vx: Math.cos(a) * k.s * 1.2, vy: Math.sin(a) * k.s * 0.6, vz: k.s * (1 + Math.random() * 2), g: k.s * 1.5, life: 1.6 + Math.random(), t: 0, kind: 'confetti', size: 7, col: ['#e2553b', '#f0c24a', '#3d8fd6', '#5cb36a', '#fff'][j % 5], scale: 1 });
    }
  }
  function kiteUpdate(dt) {
    const s = G.sim, K = G.kiteScene;
    const k = s.W.kites[K.i];
    K.t += dt;
    k.t = K.t;
    s.wind.spin += dt * 10;
    s.updateOrbit(dt);
    const P = R.kiteSkyPos(k, R.cam.z);
    const hgt = TJ.SKY_H[K.i];
    const zt = Math.min(R.baseD() / s.Sref, R.H * 0.5 / (hgt + k.s * 2));
    // 凧が 画面の うえ 3分の1 に くるように
    R.kiteFocus = K.i;
    R.cam.override = { x: (P.x + s.wind.x) / 2, y: P.y - P.h * 0.62 + R.H * 0.12 / zt, z: zt };
    R.updateCamera(s, dt);
    if (K.t > K.dur) {
      R.cam.override = null; R.kiteFocus = -1;
      if (K.i === 4) { startEnding(); return; }
      G.state = 'play';
      writeSave();
      const nk = KITES[K.i + 1];
      if (nk) toast('つぎは ' + nk.owner + 'の ' + nk.name + '（' + TJ.fmtSize(nk.req) + '）', CREAM, 4);
      const EXIT = [
        'にわの そとへ：西の いたべいの「きど」を ドンで こわすか、36cm まで そだつと いけがきを こえられる。',
        'むらへ：みなみの「もん」を ドンで こわすか、1.5m まで そだつと いしがきを こえられる。',
        'かわらへ：ひがしの「たけの さく」を ドンで こわすか、5m まで そだつと たけがきを こえられる。',
        'おかへ：ひがしの「たおれた すぎ」を ドンで どかすか、12m まで そだつと すぎばやしを こえられる。'
      ];
      if (EXIT[K.i] && s.wind.S < [36, 150, 500, 1200][K.i]) { G.hintsSeen['exit' + K.i] = 0; hint('exit' + K.i, EXIT[K.i], 9, true); }
    }
  }

  // ════ むすび ════
  const ENDING = [
    'おおだこが、お正月の そらに あがった。',
    'むらじゅうの 凧が、そろって そらを およいでいる。',
    'つむじは、まきこんだ ものを ひとつずつ、そっと 村に かえしていった。',
    'ぼうしは あたまに。みかんは かごに。かきぞめは えんがわに。',
    '「また らいねんも きてね」'
  ];
  function startEnding() {
    const s = G.sim;
    G.state = 'ending';
    G.clear = true;
    G.end = { t: 0, line: 0, rain: [], done: false };
    const found = Array.from(s.found).filter(t => TY[t]);
    G.end.types = found.length ? found : ['kareha'];
    A.setBgm(10);
    A.fanfare();
    writeSave();
  }
  function endingUpdate(dt) {
    const s = G.sim, E = G.end;
    E.t += dt;
    // カメラ：ひいて 村ぜんぶ
    const W = s.W;
    const span = 520 * 100;
    const zt = Math.min(R.W, R.H * 1.6) / span;
    const f = TJ.smooth(Math.min(1, E.t / 6));
    R.cam.override = { x: TJ.lerp(s.wind.x, 280 * 100, f), y: TJ.lerp(s.wind.y - 5000, -40 * 100, f), z: Math.exp(TJ.lerp(Math.log(R.cam.z), Math.log(zt), Math.min(1, dt * 0.8))) };
    R.updateCamera(s, dt);
    for (const k of s.W.kites) k.t += dt;
    s.wind.spin += dt * 4;
    s.updateOrbit(dt);
    // ものが ふる
    if (E.t > 4 && E.t < 24 && Math.random() < dt * 7) {
      const t = E.types[Math.floor(Math.random() * E.types.length)];
      E.rain.push({ t, x: Math.random() * LW(), y: -40, vy: 40 + Math.random() * 50, sw: Math.random() * 6, size: 26 + Math.random() * 30, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 1.5 });
    }
    for (let i = E.rain.length - 1; i >= 0; i--) { const r = E.rain[i]; r.y += r.vy * dt; r.rot += r.vr * dt; if (r.y > LH() + 60) E.rain.splice(i, 1); }
    E.line = Math.min(ENDING.length, Math.floor((E.t - 3) / 3.4) + 1);
    if (E.t > 3 + ENDING.length * 3.4 + 1.5) E.done = true;
  }
  function endingClick() { const E = G.end; if (!E.done && E.t > 2) { E.t = Math.max(E.t, 3 + ENDING.length * 3.4 + 1.5); } }

  // ════ 描く ════
  function drawAll(dt) {
    const c = R.c;
    const s = G.sim;
    R.draw(s, dt);
    c.setTransform(R.dpr * U(), 0, 0, R.dpr * U(), 0, 0);
    if (G.state === 'title') drawTitle(c);
    else if (G.state === 'intro') drawIntro(c);
    else if (G.state === 'play' || G.state === 'bossIntro') { drawHUD(c); }
    else if (G.state === 'pause') { drawHUD(c, true); drawPause(c); }
    else if (G.state === 'kite') drawKiteText(c);
    else if (G.state === 'ending') drawEnding(c);
    else if (G.state === 'book') drawBook(c);
    else if (G.state === 'howto') drawHow(c);
    drawToasts(c);
  }

  function drawTitle(c) {
    const L = LW(), H = LH();
    c.fillStyle = 'rgba(30,40,60,0.25)'; c.fillRect(0, 0, L, H);
    const g = c.createLinearGradient(0, 0, 0, H * 0.6); g.addColorStop(0, 'rgba(255,248,230,0.85)'); g.addColorStop(1, 'rgba(255,248,230,0)');
    c.fillStyle = g; c.fillRect(0, 0, L, H * 0.6);
    const cx = L / 2;
    // 凧の かざり
    const sp = TJ.Art.sprite('k_yakko', 0, 120);
    c.save(); c.translate(cx + 330, 150 + Math.sin(G.t * 1.2) * 10); c.rotate(Math.sin(G.t * 0.9) * 0.12); c.drawImage(sp, -sp.width * 120 / sp.unit / 2, -sp.height * 120 / sp.unit / 2, sp.width * 120 / sp.unit, sp.height * 120 / sp.unit); c.restore();
    c.strokeStyle = 'rgba(80,60,40,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx + 330, 200); c.quadraticCurveTo(cx + 300, 400, cx + 200, 560); c.stroke();
    text(c, 'ひゅるり、凧びより', cx, 132, 72, '#fff', 'center', 900, NAV, 12);
    text(c, '― ちびつむじと お正月の村 ―', cx, 202, 26, NAV, 'center', 800, 'rgba(255,255,255,0.85)', 6);
    const has = G.hasSave();
    let y = 300;
    button(c, 'new', has ? 'はじめから' : 'はじめる', cx - 150, y, 300, 58, () => { if (has && !G.confirmNew) { G.confirmNew = G.t; return; } G.confirmNew = 0; startNew(); }, { main: !has });
    if (G.confirmNew && G.t - G.confirmNew < 4) text(c, 'もういちど おすと、さいしょから（きろくは きえます）', cx, y + 74, 16, '#fff', 'center', 700, NAV, 4);
    y += 92;
    if (has) { button(c, 'cont', 'つづきから', cx - 150, y, 300, 58, cont, { main: true }); y += 76; }
    button(c, 'how', 'あそびかた', cx - 150, y, 145, 48, () => openHow('title'), { size: 20 });
    button(c, 'book', 'まきこみ帳', cx + 5, y, 145, 48, () => { if (!G.sim) newSim(readSave()); openBook('title'); }, { size: 20 });
    y += 64;
    button(c, 'snd', A.opt.mute ? 'おと：なし' : 'おと：あり', cx - 70, y, 140, 40, () => { A.opt.mute = !A.opt.mute; A.apply(); saveOpt(); }, { size: 18 });
    text(c, 'マウス：うごく ／ クリック：ドン ／ Esc：ひとやすみ ／ Enter：' + (has ? 'つづきから' : 'はじめる'), cx, H - 40, 17, '#fff', 'center', 700, NAV, 4);
  }

  function drawIntro(c) {
    const L = LW(), H = LH(), it = G.intro;
    c.fillStyle = 'rgba(20,25,35,0.45)'; c.fillRect(0, 0, L, H);
    const lines = INTRO[it.i].split('\n');
    const a = Math.min(1, it.t * 2.5);
    c.globalAlpha = a;
    lines.forEach((ln, i) => text(c, ln, L / 2, H / 2 - 30 + i * 46 - (lines.length - 1) * 23, 30, '#fff', 'center', 800, 'rgba(20,20,30,0.7)', 6));
    c.globalAlpha = 1;
    if (it.t > 0.6) text(c, 'クリックで つぎへ ▶', L / 2, H - 70, 18, 'rgba(255,255,255,0.8)', 'center', 700);
    button(c, 'skip', 'とばす', L - 130, 20, 110, 40, () => { G.intro.i = INTRO.length - 1; G.intro.t = 1; nextIntro(); }, { size: 16 });
  }

  function drawHUD(c, dim) {
    const s = G.sim, w = s.wind, S = w.S;
    const L = LW(), H = LH();
    // 大きさ
    panel(c, 14, 12, 400, 104, 18, 'rgba(251,245,232,0.92)', NAV);
    text(c, 'つむじの おおきさ', 32, 32, 15, '#6a6050', 'left', 800);
    text(c, TJ.fmtSize(S), 32, 66, 40, NAV, 'left', 900);
    const ki = s.kiteIdx;
    if (ki < 5 && !G.freePlay) {
      const k = KITES[ki];
      const prev = ki ? KITES[ki - 1].req : 5;
      const f = TJ.clamp(Math.log(S / prev) / Math.log(k.req / prev), 0, 1);
      panel(c, 32, 92, 364, 12, 6, 'rgba(47,58,82,0.15)');
      if (f > 0) panel(c, 32, 92, Math.max(12, 364 * f), 12, 6, f >= 1 ? GOLD : '#7fb0dc');
      const sp = TJ.Art.sprite(['k_yakko', 'k_kaku', 'k_semi', 'k_ren', 'k_oodako'][ki], 0, 40);
      c.drawImage(sp, 350, 26, sp.width * 44 / sp.unit, sp.height * 44 / sp.unit);
      const blocked = ki === 4 && s.boss.st !== 'gone' && s.boss.st !== 'none';
      let msg;
      if (blocked) msg = 'ゆきぐもを ふきとばせ！';
      else if (S >= k.req) msg = k.name + 'を あげにいこう！';
      else msg = k.name + 'まで あと ' + TJ.fmtSize(Math.max(0.1, Math.ceil((k.req - S) * 10) / 10));
      const pulse = S >= k.req && !blocked ? 0.6 + 0.4 * Math.sin(G.t * 6) : 1;
      c.globalAlpha = pulse;
      text(c, msg, 170, 38, 15, S >= k.req && !blocked ? '#c0392b' : NAV, 'left', 800);
      c.globalAlpha = 1;
      text(c, k.owner, 170, 62, 13, '#6a6050', 'left', 700);
    } else {
      text(c, G.freePlay ? 'のこりを まきこもう' : '', 170, 50, 15, NAV, 'left', 800);
    }
    // みぎうえ
    panel(c, L - 236, 12, 222, 92, 16, 'rgba(251,245,232,0.88)', NAV);
    const total = Object.keys(TY).length;
    text(c, 'まきこんだ  ' + s.count, L - 220, 34, 16, NAV, 'left', 800);
    text(c, 'おたから  ' + s.tre.size + ' / 15', L - 220, 58, 16, NAV, 'left', 800);
    text(c, 'ずかん  ' + s.found.size + ' / ' + total, L - 220, 82, 16, NAV, 'left', 800);
    if (!dim) {
      button(c, 'pause', 'Ⅱ', L - 70, 118, 54, 44, openPause, { size: 20 });
      button(c, 'bookbtn', '帳', L - 132, 118, 54, 44, () => openBook('play'), { size: 20 });
    }
    // ドン
    const ready = s.blastCd <= 0 && s.orbitReady() > 0;
    const bx = 64, by = H - 70;
    c.fillStyle = ready ? 'rgba(226,85,59,0.92)' : 'rgba(120,120,120,0.6)';
    c.beginPath(); c.arc(bx, by, 42, 0, TAU); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
    if (s.blastCd > 0) { c.strokeStyle = GOLD; c.lineWidth = 5; c.beginPath(); c.arc(bx, by, 42, -PI / 2, -PI / 2 + TAU * (1 - s.blastCd / 0.8)); c.stroke(); }
    text(c, 'ドン', bx, by - 4, 24, '#fff', 'center', 900);
    text(c, G.mouse.touch ? 'タップ' : 'クリック', bx, by + 20, 12, '#fff', 'center', 800);
    if (G.mouse.touch) G.buttons.push({ id: 'don', x: bx - 42, y: by - 42, w: 84, h: 84, label: 'ドン', fn: () => { G.blastQ = true; } });
    // れんさ
    if (G.combo.n >= 3 && G.combo.show > 0) {
      const [wx, wy] = R.toScreen(w.x, w.y);
      const D = S * R.cam.z;
      const a = Math.min(1, G.combo.show * 2);
      c.globalAlpha = a;
      const sz = 20 + Math.min(18, G.combo.n * 0.6);
      text(c, G.combo.n + ' れんさ', (wx + D * 0.85) / U(), (wy - D * 0.55) / U(), sz, '#fff6c8', 'left', 900, 'rgba(60,40,30,0.85)', 5);
      c.globalAlpha = 1;
    }
    // 凧の やじるし
    if (s.boss.st === 'fight') drawBossArrow(c, s.boss);
    else if (ki < 5 && !G.freePlay) drawArrowTo(c, s.W.kites[ki], S >= KITES[ki].req);
    if (G.near) for (const r of G.near) drawSmallArrow(c, r.o, r.don);
    // 章
    if (G.chapter) {
      const ch = G.chapter;
      const a = ch.t < 0.5 ? ch.t / 0.5 : ch.t > 2.8 ? Math.max(0, (3.6 - ch.t) / 0.8) : 1;
      c.globalAlpha = a;
      panel(c, L / 2 - 250, H - 220, 500, 74, 37, 'rgba(47,58,82,0.78)');
      text(c, ch.title, L / 2, H - 183, 32, '#fff', 'center', 900);
      c.globalAlpha = 1;
    }
    // ヒント
    if (G.hint && !dim) {
      const h = G.hint;
      const a = h.t < 0.3 ? h.t / 0.3 : h.t > h.dur - 0.5 ? Math.max(0, (h.dur - h.t) / 0.5) : 1;
      c.globalAlpha = a;
      c.font = font(19, 800);
      const tw = Math.min(L - 260, c.measureText(h.msg).width + 50);
      panel(c, L / 2 - tw / 2, H - 92, tw, 50, 25, 'rgba(251,245,232,0.95)', NAV);
      text(c, h.msg, L / 2, H - 66, 19, NAV, 'center', 800);
      c.globalAlpha = 1;
    }
  }

  function edgePoint(sx, sy, m) {
    const L = LW() * U(), H = LH() * U();
    const cx = L / 2, cy = H / 2;
    const dx = sx - cx, dy = sy - cy;
    const mb = Math.max(m, 125 * U()), mt = Math.max(m, 185 * U());
    const k = Math.min((L / 2 - m) / Math.abs(dx || 1e-6), (dy > 0 ? (H / 2 - mb) : (H / 2 - mt)) / Math.abs(dy || 1e-6));
    return [cx + dx * k, cy + dy * k, Math.atan2(dy, dx)];
  }
  function drawArrowTo(c, k, ready) {
    const [sx, sy] = R.toScreen(k.x, k.y);
    const u = U();
    const m = 70 * u;
    if (sx > m && sx < R.W - m && sy > m * 1.6 && sy < R.H - m) return;
    const [ex, ey, a] = edgePoint(sx, sy, m);
    c.save(); c.translate(ex / u, ey / u);
    const pulse = ready ? 1 + 0.12 * Math.sin(G.t * 7) : 1;
    c.scale(pulse, pulse);
    c.fillStyle = ready ? GOLD : 'rgba(251,245,232,0.9)'; c.strokeStyle = NAV; c.lineWidth = 2.5;
    c.beginPath(); c.arc(0, 0, 26, 0, TAU); c.fill(); c.stroke();
    c.save(); c.rotate(a); c.beginPath(); c.moveTo(38, 0); c.lineTo(26, -10); c.lineTo(26, 10); c.closePath(); c.fillStyle = NAV; c.fill(); c.restore();
    const sp = TJ.Art.sprite(['k_yakko', 'k_kaku', 'k_semi', 'k_ren', 'k_oodako'][k.i], 0, 32);
    c.drawImage(sp, -sp.width * 30 / sp.unit / 2, -sp.height * 30 / sp.unit / 2, sp.width * 30 / sp.unit, sp.height * 30 / sp.unit);
    c.restore();
  }
  function drawBossArrow(c, B) {
    const [sx, sy0] = R.toScreen(B.x, B.y);
    const sy = sy0 - 1600 * R.cam.z;
    const u = U(), m = 70 * u;
    if (sx > m && sx < R.W - m && sy > m * 1.6 && sy < R.H - m) return;
    const [ex, ey, a] = edgePoint(sx, sy, m);
    c.save(); c.translate(ex / u, ey / u);
    c.scale(1 + 0.1 * Math.sin(G.t * 6), 1 + 0.1 * Math.sin(G.t * 6));
    c.fillStyle = '#dbe4ee'; c.strokeStyle = NAV; c.lineWidth = 2.5;
    c.beginPath(); c.arc(0, 0, 28, 0, TAU); c.fill(); c.stroke();
    c.save(); c.rotate(a); c.beginPath(); c.moveTo(40, 0); c.lineTo(28, -10); c.lineTo(28, 10); c.closePath(); c.fillStyle = NAV; c.fill(); c.restore();
    c.fillStyle = '#9aa6b4';
    for (const [x, y, r] of [[-9, 2, 9], [0, -4, 11], [10, 2, 9], [0, 5, 9]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    text(c, 'ゆきぐも', 0, 40, 13, '#fff', 'center', 900, NAV, 4);
    c.restore();
  }
  function drawSmallArrow(c, o, don) {
    const [sx, sy] = R.toScreen(o.x, o.y);
    const u = U(), m = 40 * u;
    if (sx > m && sx < R.W - m && sy > m && sy < R.H - m) {
      if (don) { c.globalAlpha = 0.6 + 0.4 * Math.sin(G.t * 5); text(c, 'ドン？', sx / u, sy / u - (o.s * R.cam.z / u) - 14, 17, '#fff', 'center', 900, RED, 5); c.globalAlpha = 1; }
      return;
    }
    const [ex, ey, a] = edgePoint(sx, sy, m);
    c.save(); c.translate(ex / u, ey / u);
    c.globalAlpha = 0.6 + 0.4 * Math.sin(G.t * 5);
    c.save(); c.rotate(a);
    c.fillStyle = don ? RED : '#fff'; c.strokeStyle = NAV; c.lineWidth = 2;
    c.beginPath(); c.moveTo(14, 0); c.lineTo(-8, -10); c.lineTo(-3, 0); c.lineTo(-8, 10); c.closePath(); c.fill(); c.stroke();
    c.restore();
    if (don) text(c, 'ドン', -Math.cos(a) * 26, -Math.sin(a) * 26, 14, '#fff', 'center', 900, RED, 4);
    c.restore(); c.globalAlpha = 1;
  }

  function drawToasts(c) {
    const L = LW();
    let y = 128;
    if (G.state !== 'play' && G.state !== 'bossIntro' && G.state !== 'kite') return;
    for (const t of G.toasts) {
      const a = t.t < 0.25 ? t.t / 0.25 : t.t > t.dur - 0.4 ? Math.max(0, (t.dur - t.t) / 0.4) : 1;
      c.globalAlpha = a;
      c.font = font(19, 800);
      const tw = Math.min(L - 120, c.measureText(t.msg).width + 44);
      panel(c, L / 2 - tw / 2, y - 21, tw, 42, 21, 'rgba(47,58,82,0.82)');
      text(c, t.msg, L / 2, y, 19, t.col, 'center', 800);
      y += 50;
    }
    c.globalAlpha = 1;
  }

  function drawPause(c) {
    const L = LW(), H = LH();
    c.fillStyle = 'rgba(20,25,35,0.55)'; c.fillRect(0, 0, L, H);
    panel(c, L / 2 - 240, H / 2 - 250, 480, 500, 26, CREAM, NAV);
    text(c, 'ひとやすみ', L / 2, H / 2 - 210, 34, NAV, 'center', 900);
    let y = H / 2 - 160;
    button(c, 'resume', 'つづける', L / 2 - 150, y, 300, 54, closePause, { main: true }); y += 68;
    button(c, 'how2', 'あそびかた', L / 2 - 150, y, 145, 46, () => openHow('pause'), { size: 19 });
    button(c, 'book2', 'まきこみ帳', L / 2 + 5, y, 145, 46, () => openBook('pause'), { size: 19 }); y += 70;
    // 音量
    const sl = (label, key, yy) => {
      text(c, label, L / 2 - 170, yy + 18, 19, NAV, 'left', 800);
      for (let i = 0; i <= 5; i++) {
        const on = Math.round(A.opt[key] * 5) >= i && i > 0;
        const x = L / 2 - 40 + i * 36;
        button(c, key + i, i === 0 ? '×' : '', x, yy, 30, 36, () => { A.opt[key] = i / 5; A.apply(); saveOpt(); A.click(); }, { size: 16, main: on });
      }
    };
    sl('BGM', 'bgm', y); y += 50;
    sl('こうかおん', 'se', y); y += 56;
    button(c, 'mute', A.opt.mute ? 'おと：なし（M）' : 'おと：あり（M）', L / 2 - 150, y, 300, 44, () => { A.opt.mute = !A.opt.mute; A.apply(); saveOpt(); }, { size: 18 }); y += 60;
    button(c, 'title', 'タイトルへ（きろくは のこります）', L / 2 - 190, y, 380, 46, toTitle, { size: 18 });
  }

  function drawKiteText(c) {
    const K = G.kiteScene, k = KITES[K.i];
    const L = LW(), H = LH();
    const a = Math.min(1, K.t * 2) * Math.min(1, Math.max(0, (K.dur - K.t) / 0.5));
    c.globalAlpha = a;
    panel(c, L / 2 - 330, H - 196, 660, 70, 35, 'rgba(47,58,82,0.85)');
    text(c, k.owner + 'の ' + k.name + 'が あがった！', L / 2, H - 160, 32, '#fff6c8', 'center', 900);
    if (k.thanks && K.t > 1.2) {
      c.font = font(22, 800);
      const tw = c.measureText('「' + k.thanks + '」').width + 50;
      panel(c, L / 2 - tw / 2, H - 112, tw, 56, 28, 'rgba(251,245,232,0.95)', NAV);
      text(c, '「' + k.thanks + '」', L / 2, H - 84, 22, NAV, 'center', 800);
    }
    c.globalAlpha = 1;
  }

  function drawEnding(c) {
    const E = G.end, s = G.sim;
    const L = LW(), H = LH();
    // ふってくる もの
    for (const r of E.rain) {
      const sp = TJ.Art.sprite(r.t, 0, r.size);
      const sc = r.size / sp.unit;
      c.save(); c.translate(r.x + Math.sin(G.t * 1.5 + r.sw) * 20, r.y); c.rotate(r.rot);
      c.drawImage(sp, -sp.width * sc / 2, -sp.height * sc / 2, sp.width * sc, sp.height * sc); c.restore();
    }
    if (!E.done) {
      if (E.line > 0) {
        const bh = 60 + E.line * 40;
        const g = c.createLinearGradient(0, H - 260 - 40, 0, H);
        g.addColorStop(0, 'rgba(20,25,35,0)'); g.addColorStop(0.25, 'rgba(20,25,35,0.55)'); g.addColorStop(1, 'rgba(20,25,35,0.65)');
        c.fillStyle = g; c.fillRect(0, H - 300, L, 300);
      }
      for (let i = 0; i < E.line; i++) {
        const age = E.t - 3 - i * 3.4;
        const a = Math.min(1, age * 2) * (i < E.line - 1 ? 0.55 : 1);
        c.globalAlpha = a;
        text(c, ENDING[i], L / 2, H - 230 + i * 40 - (E.line - 1) * 16, 25, '#fff', 'center', 800, 'rgba(20,20,30,0.75)', 6);
      }
      c.globalAlpha = 1;
      if (E.t > 2) text(c, 'クリックで とばす', L - 20, H - 24, 14, 'rgba(255,255,255,0.7)', 'right', 700);
      return;
    }
    // きろく
    c.fillStyle = 'rgba(20,25,35,0.35)'; c.fillRect(0, 0, L, H);
    panel(c, L / 2 - 290, H / 2 - 240, 580, 480, 28, CREAM, NAV);
    text(c, 'あけまして おめでとう', L / 2, H / 2 - 190, 38, RED, 'center', 900);
    const rows = [
      ['あそんだ じかん', TJ.fmtTime(s.time)],
      ['つむじの おおきさ', TJ.fmtSize(s.wind.S)],
      ['まきこんだ かず', s.count + ' こ'],
      ['まきこみ帳', s.found.size + ' / ' + Object.keys(TY).length],
      ['おたから', s.tre.size + ' / 15']
    ];
    rows.forEach((r, i) => { text(c, r[0], L / 2 - 220, H / 2 - 120 + i * 44, 21, '#6a6050', 'left', 800); text(c, r[1], L / 2 + 220, H / 2 - 120 + i * 44, 24, NAV, 'right', 900); });
    button(c, 'free', 'このまま あそぶ', L / 2 - 250, H / 2 + 130, 240, 54, () => { G.freePlay = true; s.ending = false; s.kiteIdx = 5; G.state = 'play'; R.cam.override = null; A.setBgm(zoneBgm()); writeSave(); toast('のこりの ものや おたからを さがそう', CREAM, 4); }, { size: 20 });
    button(c, 'totitle', 'タイトルへ', L / 2 + 10, H / 2 + 130, 240, 54, toTitle, { main: true, size: 20 });
  }

  // ── まきこみ帳
  const PAGES = [['その一', 1], ['その二', 2], ['その三', 3], ['その四', 4], ['その五', 5], ['おたから', 'tre']];
  function drawBook(c) {
    const s = G.sim, L = LW(), H = LH();
    c.fillStyle = 'rgba(20,25,35,0.6)'; c.fillRect(0, 0, L, H);
    panel(c, 40, 30, L - 80, H - 60, 24, CREAM, NAV);
    text(c, 'まきこみ帳', 76, 70, 32, NAV, 'left', 900);
    const total = Object.keys(TY).length;
    text(c, s.found.size + ' / ' + total, 270, 72, 20, '#6a6050', 'left', 800);
    PAGES.forEach((p, i) => button(c, 'pg' + i, p[0], 380 + i * 118, 48, 110, 42, () => { G.bookPage = p[1]; }, { size: 18, main: G.bookPage === p[1] }));
    button(c, 'close', 'とじる', L - 170, 48, 110, 42, back, { size: 18 });
    const keys = Object.keys(TY).filter(k => G.bookPage === 'tre' ? TY[k].k === 'tre' : (TY[k].z === G.bookPage && TY[k].k !== 'tre'));
    const cols = Math.floor((L - 140) / 96);
    let hov = null;
    keys.forEach((k, i) => {
      const x = 70 + (i % cols) * 96, y = 112 + Math.floor(i / cols) * 104;
      const has = s.found.has(k);
      panel(c, x, y, 88, 96, 12, has ? '#fff' : 'rgba(47,58,82,0.08)', 'rgba(47,58,82,0.35)');
      const sp = TJ.Art.sprite(k, 0, 64);
      const sc = 60 / sp.unit;
      c.save();
      if (!has) { c.globalAlpha = 0.12; }
      c.drawImage(sp, x + 44 - sp.width * sc / 2, y + 42 - sp.height * sc / 2, sp.width * sc, sp.height * sc);
      c.restore();
      text(c, has ? TY[k].name : (TY[k].hint ? 'ヒント' : '？'), x + 44, y + 84, has ? (TY[k].name.length > 6 ? 10 : 12) : (TY[k].hint ? 12 : 16), NAV, 'center', 800);
      const u = U();
      if (G.mouse.in && G.mouse.x >= x * u && G.mouse.x <= (x + 88) * u && G.mouse.y >= y * u && G.mouse.y <= (y + 96) * u) hov = k;
    });
    if (G.bookPage !== 'tre') {
      text(c, 'ページ：' + TJ.ZONE_NAMES[G.bookPage], 76, H - 104, 17, '#6a6050', 'left', 800);
    } else {
      text(c, 'まだの おたからに マウスを のせると ヒントが 見られる', 76, H - 104, 15, '#6a6050', 'left', 800);
    }
    // 凧
    text(c, 'あげた凧', L - 420, H - 104, 17, '#6a6050', 'left', 800);
    for (let i = 0; i < 5; i++) {
      const done = s.kiteIdx > i || (s.W.kites[i] && s.W.kites[i].st === 1);
      const sp = TJ.Art.sprite(['k_yakko', 'k_kaku', 'k_semi', 'k_ren', 'k_oodako'][i], 0, 44);
      c.save(); if (!done) c.globalAlpha = 0.15;
      c.drawImage(sp, L - 330 + i * 52, H - 128, sp.width * 44 / sp.unit, sp.height * 44 / sp.unit); c.restore();
    }
    if (hov) {
      const has = s.found.has(hov);
      panel(c, 70, H - 84, L - 140, 40, 20, 'rgba(47,58,82,0.9)');
      text(c, has ? TY[hov].name + '：' + TY[hov].desc + '（' + TJ.fmtSize(TY[hov].s) + '）' : (TY[hov].hint ? 'ヒント：' + TY[hov].hint : 'まだ みつけていない もの（' + TJ.fmtSize(TY[hov].s) + '）'), L / 2, H - 64, 17, '#fff', 'center', 700);
    }
  }

  function drawHow(c) {
    const L = LW(), H = LH();
    c.fillStyle = 'rgba(20,25,35,0.6)'; c.fillRect(0, 0, L, H);
    panel(c, L / 2 - 420, 40, 840, H - 80, 24, CREAM, NAV);
    text(c, 'あそびかた', L / 2, 84, 32, NAV, 'center', 900);
    const lines = [
      ['うごく', 'マウスの ほうへ すすむ（とおくを さすほど はやい）。WASD・やじるしキー でも うごける。'],
      ['まきこむ', 'じぶんより ちいさいものの そばを とおると、まきこんで おおきくなる。'],
      ['おおきさ', 'まだ おおきいものに さわると「○cmから」と でる。そだてば まきこめる。'],
      ['ドン', 'クリック（スペース）で、まわっている ものを ぶつける。'],
      ['', 'うえきばち・きど・やたい などを こわすと、なかみが でてくる。木は みが おちる。'],
      ['凧', 'こどもたちの 凧は、きまった おおきさ に なって さわると あがる。'],
      ['もくひょう', '五つの 凧を あげて、さいごに 村の おおだこを あげよう。'],
      ['そのほか', 'Esc：ひとやすみ ／ M：おと ／ B：まきこみ帳 ／ きろくは じどうで のこる。']
    ];
    lines.forEach((l, i) => {
      const y = 140 + i * 54;
      if (l[0]) { panel(c, L / 2 - 390, y - 18, 120, 36, 18, NAV); text(c, l[0], L / 2 - 330, y, 18, '#fff', 'center', 800); }
      text(c, l[1], L / 2 - 255, y, 18, NAV, 'left', 700);
    });
    button(c, 'hclose', 'もどる', L / 2 - 90, H - 110, 180, 50, back, { main: true });
  }

  // ════ 検証用の ちょっとした道具 ════
  G.debug.state = () => ({ state: G.state, S: G.sim.wind.S, kite: G.sim.kiteIdx, zone: G.sim.zoneAt(G.sim.wind.x, G.sim.wind.y), boss: G.sim.boss.st, time: G.sim.time, count: G.sim.count });
  G.debug.screenOf = (x, y) => { const [sx, sy] = R.toScreen(x, y); return [sx, sy]; };
  G.debug.start = () => { startNew(); G.intro.i = INTRO.length - 1; G.intro.t = 1; nextIntro(); };
  G.debug.cont = cont;
  G.debug.save = writeSave;
  G.debug.handle = handleEvents;
  G.debug.buttons = () => G.buttons.map(b => ({ id: b.id, label: b.label, x: (b.x + b.w / 2) * U(), y: (b.y + b.h / 2) * U() }));

  requestAnimationFrame(frame);
})();
