/*
 * そこから、そら ― 画面・操作・進行
 */
(function () {
  'use strict';
  const S = window.SKS, D = window.SKS_DATA, R = window.SKR, A = window.SKA;
  const { PAD_Y, WATER_Y, CELL, COLS } = S;
  const FX = R.FX, FX0 = R.FX0, FONT = R.FONT, FONT_SOFT = R.FONT_SOFT;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const W = 1280, H = 720;
  const SAVE_KEY = 'sokokara-sora-v1';
  const CH = D.CHAMBERS, ITEMS = D.ITEMS, LAYERS = D.LAYERS;
  const LAYER_NUM = ['第一層', '第二層', '第三層', '第四層', '第五層'];

  // ---------------------------------------------------------------- 保存
  function defSave() { return { reached: 0, cur: 0, found: [], best: {}, cleared: {}, vol: 0.7, muted: false, ended: 0, seen: {} }; }
  function loadSave() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && typeof s === 'object') return Object.assign(defSave(), s); } catch (e) { /* 保存できない環境 */ }
    return defSave();
  }
  let save = loadSave();
  function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 無視 */ } }
  A.vol = save.vol; A.muted = save.muted;

  // ---------------------------------------------------------------- 状態
  const G = {
    scene: 'title', t: 0, idx: 0, w: null, prevW: null, riseT: 0, riseDur: 2.3, result: null,
    hitstop: 0, paused: false, menuSel: 0, layerCard: 0, toast: null, toastQ: [], hint: '', hintT: 0, ctxHint: null,
    frogFx: { squash: 0, blink: 0, happy: 0, nextBlink: 2 }, shownGems: 0, chamberGems0: 0,
    introStep: 0, introT: 0, endT: 0, missStreak: 0, firstMissHint: false, sealedT: -9, hold: false,
    buttons: [], hover: -1, momFlash: 0, enterT: 0
  };
  const inp = { mx: 640, my: 420, down: false, mode: 'mouse', kL: false, kR: false, kU: false, kD: false, kBtn: false, kx: 320, aimA: -Math.PI / 2 };

  // ---------------------------------------------------------------- 画面の大きさ
  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = Math.floor(W * s) + 'px';
    canvas.style.height = Math.floor(H * s) + 'px';
  }
  window.addEventListener('resize', fit); fit();
  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }

  // ---------------------------------------------------------------- 入力
  canvas.addEventListener('mousemove', (e) => { const p = toCanvas(e); if (Math.abs(p.x - inp.mx) + Math.abs(p.y - inp.my) > 2) G.menuKeyHL = false; inp.mx = p.x; inp.my = p.y; if (inp.mode !== 'mouse') inp.mode = 'mouse'; });
  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    A.init();
    const p = toCanvas(e); inp.mx = p.x; inp.my = p.y; inp.mode = 'mouse';
    if (clickButton(p.x, p.y)) return;
    if (G.scene === 'play' && !G.paused) { inp.down = true; inp.latch = true; }
    else if (G.scene === 'intro') advanceIntro();
    else if (G.scene === 'ending' && G.endT > 1) G.endSkip = true;
  });
  window.addEventListener('mouseup', () => { inp.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); A.init(); const p = toCanvas(e.touches[0]); inp.mx = p.x; inp.my = p.y; inp.mode = 'mouse'; if (clickButton(p.x, p.y)) return; if (G.scene === 'play' && !G.paused) { inp.down = true; inp.latch = true; } else if (G.scene === 'intro') advanceIntro(); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); const p = toCanvas(e.touches[0]); inp.mx = p.x; inp.my = p.y; }, { passive: false });
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); inp.down = false; }, { passive: false });

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar'].indexOf(k) >= 0) e.preventDefault();
    if (e.repeat && (k === 'Escape' || k === 'm' || k === 'M' || k === 'Enter')) return;
    A.init();
    if (k === 'm' || k === 'M') { toggleMute(); return; }
    if (k === 'Escape') { onEscape(); return; }
    if (G.scene === 'play' && !G.paused) {
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { inp.kL = true; toKeys(); }
      if (k === 'ArrowRight' || k === 'd' || k === 'D') { inp.kR = true; toKeys(); }
      if (k === ' ' || k === 'Spacebar') { if (!e.repeat) inp.latch = true; inp.kBtn = true; toKeys(); }
      return;
    }
    if (G.scene === 'intro' && (k === 'Enter' || k === ' ')) { advanceIntro(); return; }
    if (G.scene === 'ending' && (k === 'Enter' || k === ' ') && G.endT > 1) { G.endSkip = true; }
    // メニューのキー操作
    const bs = G.buttons.filter((b) => !b.disabled);
    if (!bs.length) return;
    if (k === 'ArrowDown' || k === 'ArrowRight') { if (G.menuKeyHL) G.menuSel = (G.menuSel + 1) % bs.length; G.menuKeyHL = true; A.play('ui'); }
    if (k === 'ArrowUp' || k === 'ArrowLeft') { if (G.menuKeyHL) G.menuSel = (G.menuSel + bs.length - 1) % bs.length; G.menuKeyHL = true; A.play('ui'); }
    if (k === 'Enter' || k === ' ') { const b = bs[G.menuSel % bs.length]; if (b) { A.play('uiok'); G.menuKeyHL = true; b.act(); } }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') inp.kL = false;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') inp.kR = false;
    if (k === ' ' || k === 'Spacebar') inp.kBtn = false;
  });
  window.addEventListener('blur', () => { inp.down = false; inp.kL = inp.kR = inp.kBtn = false; if (G.scene === 'play' && !G.paused) openPause(); });

  function toKeys() { if (inp.mode !== 'keys') { inp.mode = 'keys'; if (G.w) inp.kx = G.w.frog.x; } }
  function toggleMute() { save.muted = !save.muted; A.setMuted(save.muted); writeSave(); if (!save.muted) A.play('ui'); }
  function onEscape() {
    if (G.scene === 'play') { if (G.paused) closePause(); else openPause(); }
    else if (G.scene === 'select') goTitle();
    else if (G.scene === 'intro') startChamber(0, true);
  }
  function openPause() { G.paused = true; G.menuSel = 0; G.menuKeyHL = true; inp.down = false; }
  function closePause() { G.paused = false; inp.down = false; }

  function clickButton(x, y) {
    for (const b of G.buttons) {
      if (b.disabled) continue;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { A.play('uiok'); b.act(); return true; }
    }
    return false;
  }

  function simInput() {
    const w = G.w;
    const m = w.mouth();
    // すばやい クリック・キーの おしはなしが 1コマの中で終わっても、かならず1ステップは「おした」として見せる
    const latch = !!inp.latch;
    if (inp.mode === 'mouse') return { tx: inp.mx - FX0, btn: inp.down || latch, ax: inp.mx - FX0, ay: inp.my };
    return { tx: inp.kx, btn: inp.kBtn || latch, ax: m.x + Math.cos(inp.aimA) * 200, ay: m.y + Math.sin(inp.aimA) * 200 };
  }

  function updateKeys(dt) {
    if (inp.mode !== 'keys' || !G.w) return;
    const b = G.w.balls[0];
    const holding = b.state === 'held' || b.state === 'tongue';
    const dir = (inp.kR ? 1 : 0) - (inp.kL ? 1 : 0);
    if (holding) {
      inp.aimA = S.clamp(inp.aimA + dir * 1.7 * dt, -Math.PI + 0.26, -0.26);
      inp.kx = G.w.frog.x;
    } else {
      inp.kx = S.clamp(inp.kx + dir * 760 * dt, S.XL + 44, S.XR - 44);
    }
  }

  // ---------------------------------------------------------------- 進行
  function startChamber(i, fresh) {
    G.idx = i;
    save.cur = i; writeSave();
    const ch = CH[i];
    G.w = new S.World(ch, { seed: 1000 + i * 17 + Math.floor(Math.random() * 1000) });
    G.w.bumpT = {};
    G.prevW = null;
    G.scene = 'play'; G.paused = false;
    G.chamberGems0 = 0; G.shownGems = 0;
    G.missStreak = 0;
    G.ctxHint = null; G.hint = ch.hint;
    inp.down = false; inp.kx = G.w.frog.x; inp.aimA = -Math.PI / 2;
    FX.clear();
    G.enterT = 0;
    const firstOfLayer = i === 0 || CH[i - 1].layer !== ch.layer;
    if (firstOfLayer || fresh) G.layerCard = 2.8;
    A.startBgm(ch.layer);
  }

  function finishChamber() {
    const w = G.w, ch = CH[G.idx];
    const got = (ch.items || []).concat(ch.bossItem !== undefined ? [ch.bossItem] : []);
    G.result = { id: ch.id, name: ch.name, gems: w.gems, got: got.filter((id) => w.found.indexOf(id) >= 0).length, total: got.length };
    save.cleared[ch.id] = true;
    save.best[ch.id] = Math.max(save.best[ch.id] || 0, w.gems);
    const next = G.idx + 1;
    save.reached = Math.max(save.reached, Math.min(next, CH.length - 1));
    if (next >= CH.length) { save.ended = (save.ended || 0) + 1; writeSave(); startEnding(); return; }
    save.cur = next; writeSave();
    // 上の へやへ のぼる
    G.prevW = w;
    G.prevLayer = ch.layer;
    G.idx = next;
    const nch = CH[next];
    G.w = new S.World(nch, { seed: 1000 + next * 17 + Math.floor(Math.random() * 1000) });
    G.w.bumpT = {};
    G.scene = 'rise'; G.riseT = 0;
    inp.down = false;
    A.play('rise');
    FX.clear();
    for (let k = 0; k < 40; k++) FX.add({ k: 'drop', x: 40 + Math.random() * 560, y: WATER_Y + Math.random() * 40, vx: 0, vy: -200 - Math.random() * 400, g: 0, life: 1.6, t: 0, s: 1.5 + Math.random() * 3, c: 'rgba(200,250,255,0.7)' });
  }

  function goTitle() { G.scene = 'title'; G.paused = false; G.menuSel = 0; G.menuKeyHL = true; A.startBgm(0); FX.clear(); G.titleT = 0; }
  function goSelect() { G.scene = 'select'; G.paused = false; G.menuSel = 0; G.menuKeyHL = true; FX.clear(); }

  const INTRO = [
    'いどの そこの、そのまた そこ。\nカエルの アオは、ここで うまれた。',
    'むかしは あたまの うえに、\nまるい そらが 見えたそうだ。\nいまは 石と つちで、すっかり ふさがっている。',
    '「そらって、どんな いろ？」\nアオは まるい石を くわえて、上を 見あげた。'
  ];
  function startIntro() { G.scene = 'intro'; G.introStep = 0; G.introT = 0; A.startBgm(0); }
  function advanceIntro() {
    if (G.introT < 0.4) return;
    G.introStep++; G.introT = 0; A.play('ui');
    if (G.introStep >= INTRO.length) startChamber(0, true);
  }

  function startEnding() { G.scene = 'ending'; G.endT = 0; G.endSkip = false; FX.clear(); A.startBgm(5); A.play('lid'); }

  // ---------------------------------------------------------------- できごと → 音と 見た目
  function matColor(layer, t) {
    const P = R.PAL[layer];
    if (t === S.T.SOIL || t === S.T.MUD) return P.soil;
    if (t === S.T.STONE || t === S.T.TREAS) return P.stone;
    if (t === S.T.HARD) return P.hard;
    if (t === S.T.ORE) return P.ore;
    if (t === S.T.BLAST) return '#ff8a3c';
    if (t === S.T.ROOT) return P.root;
    if (t === S.T.ANCHOR) return '#e8d8a0';
    if (t === S.T.LID) return '#8a8478';
    return P.stone;
  }

  function flyGems(x, y, n) {
    const tx = 1000 - FX0, ty = 372;
    for (let k = 0; k < Math.min(n, 14); k++) {
      FX.add({ k: 'fly', x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 300, vy: -100 - Math.random() * 200, g: 0, tx, ty, life: 3, t: 0, s: 3, c: R.PAL[CH[G.idx].layer].ore });
    }
  }

  function handleEvents(w) {
    const layer = CH[G.idx].layer;
    for (const e of w.events) {
      switch (e.type) {
        case 'pad': {
          A.play('pad', { lv: e.lv });
          G.frogFx.squash = 1;
          if (e.mom === S.MOM_LV1 || e.mom === S.MOM_LV2) momUp(e.mom === S.MOM_LV2 ? 2 : 1);
          G.missStreak = 0;
          break;
        }
        case 'catch': {
          A.play('catch');
          if (w.mom === S.MOM_LV1 || w.mom === S.MOM_LV2) momUp(w.mom === S.MOM_LV2 ? 2 : 1);
          G.missStreak = 0;
          break;
        }
        case 'spit': A.play('spit'); FX.sparkle(e.x, e.y - 6, 4, '#fff', 60); break;
        case 'break': {
          A.play('hit', { mat: e.mat, flight: e.flight });
          const col = matColor(layer, e.mat);
          FX.debris(e.x, e.y, col, e.cause === 'boom' ? 4 : 7, 1);
          FX.dust(e.x, e.y, 2);
          if (e.mat === S.T.ORE) { FX.sparkle(e.x, e.y, 10, R.PAL[layer].ore, 160); flyGems(e.x, e.y, 5); FX.text(e.x, e.y - 8, '+' + e.val, { color: R.PAL[layer].ore, size: 16, life: 0.8 }); }
          if (e.flight >= 4 && e.cause === 'ball') FX.text(e.x, e.y + 6, e.flight + 'れんぞく', { size: 13 + Math.min(8, e.flight), color: '#fff6c8', life: 0.6 });
          break;
        }
        case 'chip': A.play('chip', { flight: e.flight }); FX.debris(e.x, e.y, matColor(layer, e.mat), 3, 0.6); break;
        case 'clink': A.play('clink'); FX.sparkle(e.x, e.y, 2, '#ddd', 40); break;
        case 'sealed':
          A.play('sealed');
          if (w.t - G.sealedT > 2.5) { G.sealedT = w.t; FX.text(e.x, e.y + 40, 'ぬしが ふたを おさえている', { size: 16, color: '#ffd6a0', life: 1.6 }); }
          setCtxHint('ふたは ぬしが おさえている。ひかる くさびを ぜんぶ こわそう。', 5);
          break;
        case 'collapse': {
          A.play('collapse', { n: e.n });
          FX.shake = Math.max(FX.shake, Math.min(14, 2 + e.n * 0.4));
          FX.dust(e.x, e.y, Math.min(16, 3 + e.n / 2));
          if (e.n >= 4) FX.text(e.x, e.y, 'がらがらっ ×' + e.n, { size: Math.min(34, 18 + e.n * 0.5), color: '#fff2b0', life: 1.3 });
          if (e.n >= 10) G.hitstop = Math.max(G.hitstop, 0.07);
          break;
        }
        case 'splash': {
          A.play('splash', { n: e.n });
          FX.splash(e.x, Math.min(40, 6 + e.n), null, Math.min(2.2, 0.6 + e.n / 14));
          FX.shake = Math.max(FX.shake, Math.min(10, e.n * 0.25));
          flyGems(e.x, WATER_Y - 20, Math.min(14, 3 + e.n));
          FX.text(e.x, WATER_Y - 50, '+' + e.gain, { size: Math.min(32, 16 + e.n * 0.5), color: R.PAL[layer].ore, life: 1.2 });
          break;
        }
        case 'boom':
          A.play('boom');
          FX.shake = Math.max(FX.shake, 8); FX.flash = 0.35; FX.flashColor = '#ffb070';
          FX.debris(e.x, e.y, '#ff9a3c', 10, 1.6); FX.sparkle(e.x, e.y, 12, '#ffd080', 220); FX.dust(e.x, e.y, 6, 'rgba(120,80,60,');
          FX.add({ k: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, life: 0.35, t: 0, s: 8, grow: 50, c: '#ffcf80' });
          G.hitstop = Math.max(G.hitstop, 0.03);
          break;
        case 'lid':
          A.play('lid');
          w.lidX = e.x; w.lidOpenT = 0;
          FX.shake = Math.max(FX.shake, 6); FX.flash = 0.5; FX.flashColor = R.PAL[layer].glow;
          FX.debris(e.x, e.y + 10, '#8a8478', 18, 1.4); FX.sparkle(e.x, e.y + 20, 20, R.PAL[layer].glow, 200);
          FX.text(e.x, 90, 'ふたが あいた！', { size: 30, color: R.PAL[layer].glow, life: 2 });
          if (itemsLeft(w)) setCtxHint('ふたが あいた！ あなへ 玉を とおすと 上の へやへ。\nでも この へやには、まだ おとしものが ' + itemsLeft(w) + 'こ のこっている。', 9);
          G.hitstop = Math.max(G.hitstop, 0.08);
          break;
        case 'item': onItem(e); break;
        case 'miss':
          A.play('miss'); FX.splash(e.x, 10, null, 0.7);
          G.missStreak++;
          if (e.lost >= S.MOM_LV1) FX.text(e.x, WATER_Y - 40, 'はずみ リセット', { size: 15, color: '#ffc0b0', life: 1.1 });
          if (!G.firstMissHint || G.missStreak >= 2) { G.firstMissHint = true; setCtxHint('ボタンを おしたまま まつと、おちてきた 玉を 舌で くわえる。はなすと はきだす。', 9); }
          break;
        case 'resurface': A.play('resurface'); FX.ripple(e.x, 0.6); break;
        case 'exit':
          A.play('exit');
          FX.sparkle(e.x, 10, 20, '#fff', 200);
          G.exitPending = 0.35;
          break;
        case 'kill':
          A.play('kill'); FX.sparkle(e.x, e.y, 12, '#fff', 160); FX.dust(e.x, e.y, 4, 'rgba(160,140,180,');
          FX.text(e.x, e.y - 10, '+10', { size: 15, color: '#ffe8a0', life: 0.8 }); flyGems(e.x, e.y, 3);
          break;
        case 'screech': A.play('screech'); onceHint('bat', 'こうもりの 目が あかく ひかったら、とびかかってくる。玉を あてれば たおせる。', 7); break;
        case 'stun':
          A.play('stun'); FX.shake = Math.max(FX.shake, 4);
          FX.text(S.clamp(e.x, 90, 550), PAD_Y - 52, 'くらくら…', { size: 17, color: '#ffe36a', life: 1 });
          onceHint('stun', 'ぶつかると、すこしのあいだ 目が回って うごけない（舌も だせない）。', 7);
          break;
        case 'bonk': FX.debris(e.x, e.y, '#7d7468', 5, 0.8); break;
        case 'plip': A.play('plip'); FX.ripple(e.x, 0.4); break;
        case 'drip': onceHint('drip', 'しずくぐもの しずくに あたると 目が回る。玉を あてれば たおせる。', 7); break;
        case 'mud': onceHint('mud', 'どろむしが すきまを どろで ふさいだ。玉を あてれば たおせる。', 7); A.play('mud'); FX.debris(e.x, e.y, R.PAL[layer].mud, 5, 0.5); FX.text(e.x, e.y, 'どろっ', { size: 13, color: '#e0c0a0', life: 0.7 }); break;
        case 'regrow': A.play('regrow'); FX.sparkle(e.x, e.y, 8, '#fff', 80); FX.text(e.x, e.y - 12, 'はりなおした！', { size: 14, color: '#ffd0c0', life: 1 }); break;
        case 'rootgrow': A.play('mud'); FX.debris(e.x, e.y, R.PAL[layer].root, 3, 0.4); break;
        case 'ghit': A.play('ghit'); FX.sparkle(e.x, e.y, 4, '#fff', 60); break;
        case 'gtele': A.play('gtele'); break;
        case 'gdown':
          A.play('gdown');
          FX.shake = 16; FX.flash = 0.6; FX.flashColor = '#ffffff';
          G.hitstop = Math.max(G.hitstop, 0.14);
          FX.text(320, 260, 'やった！', { size: 44, color: '#fff6c8', life: 2.2, vy: -20 });
          setCtxHint('あいた ふたの あなへ 玉を とおそう。', 8);
          break;
        case 'marbles': A.play('marbles'); FX.sparkle(e.x, e.y, 8, '#bfefff', 120); break;
        case 'thud': A.play('thud'); FX.shake = Math.max(FX.shake, 4); FX.splash(e.x, 6, null, 0.6); break;
        case 'clonk': A.play('clonk'); break;
        case 'pop': A.play('pop'); FX.sparkle(e.x, e.y, 6, '#fff', 90); break;
        case 'rumble': A.play('rumble'); FX.shake = Math.max(FX.shake, 3); onceHint('rumble', 'ゆれると 天井から 石が おちてくる。水面の あかい しるしの 上から はなれよう。', 7); break;
        case 'bucket': A.play('gtele'); break;
        case 'spit_web': case 'pop_cork': A.play('pop'); break;
        case 'webbed': A.play('stun'); onceHint('web', 'くもの糸に からまると、しばらく ゆっくりしか うごけない。糸の玉は 玉で われる。', 7); break;
        case 'fade': FX.sparkle(e.x, e.y, 5, '#bfefff', 50); break;
        case 'bump': {
          A.play('bump');
          const i = Math.floor(e.y / CELL) * COLS + Math.floor(e.x / CELL);
          w.bumpT[i] = w.t;
          FX.sparkle(e.x, e.y, 6, '#ffd0f0', 120);
          break;
        }
        case 'wake': break;
      }
    }
    w.events.length = 0;
  }

  function momUp(lv) {
    A.play('momup', { lv });
    G.momFlash = 1;
    const f = G.w.frog;
    FX.text(S.clamp(f.x, 120, 520), PAD_Y - 60, lv >= 2 ? 'はずみ MAX！ つらぬく' : 'はずみ！ ちから 2ばい', { size: lv >= 2 ? 20 : 17, color: lv >= 2 ? '#ffb070' : '#ffe680', life: 1.3 });
  }

  function setCtxHint(text, sec) { G.ctxHint = { text, t: sec }; }
  // はじめて出会ったときだけ ヒントを出す（つぎからは出さない）
  function onceHint(key, text, sec) {
    if (!save.seen) save.seen = {};
    if (save.seen[key]) return;
    save.seen[key] = true; writeSave();
    setCtxHint(text, sec);
  }

  function onItem(e) {
    A.play('item');
    G.frogFx.happy = 1.4;
    FX.sparkle(e.x, e.y, 24, '#fff6c8', 200);
    FX.add({ k: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, life: 0.6, t: 0, s: 10, grow: 60, c: '#fff6c8' });
    // 右の たなへ 飛んでいく
    FX.add({ k: 'fly', x: e.x, y: e.y, vx: 0, vy: 200, g: 0, tx: 1050 - FX0, ty: 200, life: 3, t: 0, s: 7, c: '#fff6c8' });
    if (save.found.indexOf(e.id) < 0) { save.found.push(e.id); writeSave(); }
    const it = ITEMS[e.id];
    G.toastQ.push({ id: e.id, t: 0, dur: it.letter ? 7 : 3.6 });
  }

  // ---------------------------------------------------------------- 毎フレームの更新
  function update(dt) {
    G.t += dt;
    A.tick();
    updateKeys(dt);
    const ff = G.frogFx;
    ff.squash = Math.max(0, ff.squash - dt * 7);
    ff.happy = Math.max(0, ff.happy - dt);
    ff.nextBlink -= dt; if (ff.nextBlink < 0) { ff.blink = 0.12; ff.nextBlink = 2 + Math.random() * 3; }
    ff.blink = Math.max(0, ff.blink - dt);
    G.momFlash = Math.max(0, G.momFlash - dt * 2);
    if (G.layerCard > 0) G.layerCard -= dt;
    if (G.ctxHint) { G.ctxHint.t -= dt; if (G.ctxHint.t <= 0) G.ctxHint = null; }
    if (!G.toast && G.toastQ.length) G.toast = G.toastQ.shift();
    if (G.toast) { G.toast.t += dt; if (G.toast.t > G.toast.dur) G.toast = null; }

    if (G.scene === 'play' && !G.paused) {
      G.enterT += dt;
      const w = G.w;
      if (G.hitstop > 0) G.hitstop -= dt;
      else if (!G.hold) {            // 検証で手送りしているあいだは、ここでは進めない（tick で1ステップずつ）
        G.acc = (G.acc || 0) + dt;
        let n = 0;
        while (G.acc >= S.DT && n < 12) { stepSim(); G.acc -= S.DT; n++; if (G.scene !== 'play') break; }
        if (n >= 12) G.acc = 0;
      }
      if (w.lidOpen) w.lidOpenT = (w.lidOpenT || 0) + dt;
      for (const b of w.balls) {
        if (b.state === 'free') { b.trail.push([b.x, b.y]); if (b.trail.length > 8) b.trail.shift(); } else b.trail.length = 0;
      }
      const before = Math.round(G.shownGems);
      G.shownGems += (w.gems - G.shownGems) * Math.min(1, dt * 8);
      if (Math.round(G.shownGems) > before) G.gemPop = 1;
      G.gemPop = Math.max(0, (G.gemPop || 0) - dt * 5);
      if (G.exitPending !== undefined && G.exitPending !== null) {
        G.exitPending -= dt;
        if (G.exitPending <= 0) { G.exitPending = null; finishChamber(); }
      }
    } else if (G.scene === 'rise') {
      G.riseT += dt;
      if (G.riseT >= G.riseDur) {
        const nch = CH[G.idx];
        G.scene = 'play'; G.prevW = null; G.enterT = 0;
        G.shownGems = 0; G.ctxHint = null; G.hint = nch.hint; G.missStreak = 0;
        inp.kx = G.w.frog.x;
        if (nch.layer !== G.prevLayer) { G.layerCard = 2.8; A.startBgm(nch.layer); }
      }
    } else if (G.scene === 'intro') {
      G.introT += dt;
    } else if (G.scene === 'ending') {
      G.endT += dt * (G.endSkip && G.endT < 14 ? 6 : 1);
      if (G.endSkip && G.endT >= 14) G.endSkip = false;
    }
    FX.update(dt);
  }

  function stepSim() {
    const w = G.w;
    w.step(simInput());
    inp.latch = false;
    handleEvents(w);
  }

  // ---------------------------------------------------------------- 描画のこまかい部品
  function text(s, x, y, size, color, align, font, base) {
    ctx.font = size + 'px ' + (font || FONT);
    ctx.fillStyle = color || '#fff';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = base || 'alphabetic';
    ctx.fillText(s, x, y);
  }
  function textOutline(s, x, y, size, color, align, font, lw) {
    ctx.font = size + 'px ' + (font || FONT);
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = lw || 5; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineJoin = 'round';
    ctx.strokeText(s, x, y);
    ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y);
  }

  function button(label, x, y, w, h, act, opt) {
    opt = opt || {};
    const b = { x, y, w, h, act, disabled: !!opt.disabled };
    G.buttons.push(b);
    const idx = G.buttons.filter((q) => !q.disabled).indexOf(b);
    // キーで えらんでいるときは えらんだもの、マウスを動かしたら マウスの下のもの を ひからせる
    const hover = !b.disabled && (G.menuKeyHL ? idx === G.menuSel : (inp.mx >= x && inp.mx <= x + w && inp.my >= y && inp.my <= y + h));
    ctx.fillStyle = b.disabled ? 'rgba(255,255,255,0.05)' : hover ? 'rgba(255,246,200,0.95)' : 'rgba(20,30,40,0.72)';
    R.rr(ctx, x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = b.disabled ? 'rgba(255,255,255,0.12)' : hover ? '#fff' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2; ctx.stroke();
    text(label, x + w / 2, y + h / 2 + 1, opt.size || 20, b.disabled ? 'rgba(255,255,255,0.3)' : hover ? '#2a2a2a' : '#fff', 'center', FONT_SOFT, 'middle');
    if (opt.sub) text(opt.sub, x + w / 2, y + h - 9, 12, hover ? '#555' : 'rgba(255,255,255,0.6)', 'center', FONT, 'middle');
    return b;
  }

  // ---------------------------------------------------------------- 左右の パネル
  function drawPanels(layer) {
    const P = R.PAL[layer];
    // 地面の断面（左右）
    for (const [x0, x1] of [[0, FX0], [FX0 + 640, W]]) {
      ctx.fillStyle = P.panel; ctx.fillRect(x0, 0, x1 - x0, H);
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      for (let k = 0; k < 14; k++) ctx.fillRect(x0, 40 + k * 52 + (k % 3) * 7, x1 - x0, 3);
    }
    // 井戸の かべの ふち
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(FX0 - 6, 0, 6, H); ctx.fillRect(FX0 + 640, 0, 6, H);
    drawGauge(layer);
    drawShelf(layer);
  }

  function chamberY(k) { return 640 - (k + 0.5) * (520 / CH.length); }

  function drawGauge(layer) {
    const P = R.PAL[layer];
    const cx = 160, top = 120, bot = 640;
    // そら
    const sky = ctx.createLinearGradient(0, 0, 0, top);
    sky.addColorStop(0, '#3d7cc9'); sky.addColorStop(1, '#a8d8f0');
    ctx.fillStyle = sky; R.rr(ctx, 24, 18, 272, top - 18, 10); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(70, 50, 22, 8, 0, 0, 7); ctx.ellipse(88, 46, 14, 9, 0, 0, 7); ctx.ellipse(240, 70, 18, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5a9a4a'; ctx.fillRect(24, top - 8, 272, 8);
    textOutline('そこから、そら', cx, 54, 24, '#ffffff', 'center', FONT_SOFT, 5);
    // 地層
    const h = (bot - top) / CH.length;
    for (let L = 0; L < 5; L++) {
      const y1 = bot - L * 3 * h, y0 = y1 - 3 * h;
      const known = save.reached >= L * 3 || G.idx >= L * 3;
      ctx.fillStyle = known ? R.shade(R.PAL[L].soil, -0.35) : '#141414';
      ctx.fillRect(24, y0, 272, y1 - y0);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(24, y0, 272, 2);
      text(known ? LAYERS[L].name : '？？？', 34, (y0 + y1) / 2 + 5, 14, known ? R.PAL[L].ink : 'rgba(255,255,255,0.35)', 'left', FONT_SOFT);
      text(LAYER_NUM[L], 286, (y0 + y1) / 2 + 5, 12, 'rgba(255,255,255,0.45)', 'right');
    }
    // 井戸
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(cx - 16, top, 32, bot - top);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 16, top, 32, bot - top);
    for (let k = 0; k < CH.length; k++) {
      const y = chamberY(k);
      const done = !!save.cleared[CH[k].id];
      ctx.fillStyle = done ? 'rgba(255,240,170,0.85)' : k <= save.reached ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(cx, y, CH[k].guardian ? 5 : 3, 0, 7); ctx.fill();
    }
    // アオの いち
    let fy = chamberY(G.idx);
    if (G.scene === 'rise') fy = chamberY(G.idx - 1) + (chamberY(G.idx) - chamberY(G.idx - 1)) * easeInOut(Math.min(1, G.riseT / G.riseDur));
    ctx.fillStyle = '#7fd05a'; ctx.beginPath(); ctx.ellipse(cx, fy, 12, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - 5, fy - 5, 4, 0, 7); ctx.arc(cx + 5, fy - 5, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx - 5, fy - 6, 2, 0, 7); ctx.arc(cx + 5, fy - 6, 2, 0, 7); ctx.fill();
    // はずみ
    const w = G.w;
    if (w) {
      const mom = w.mom, lv = w.momLevel();
      const y = 668;
      text('はずみ', 34, y + 6, 15, P.ink, 'left', FONT_SOFT);
      for (let k = 0; k < S.MOM_LV2; k++) {
        const on = k < mom;
        ctx.fillStyle = on ? (k >= S.MOM_LV1 ? '#ff9a4a' : '#ffe06a') : 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.arc(100 + k * 22, y, 7 + (on && G.momFlash > 0 ? G.momFlash * 3 : 0), 0, 7); ctx.fill();
      }
      const lbl = lv >= 2 ? 'つらぬく' : lv >= 1 ? 'ちから 2ばい' : '';
      if (lbl) text(lbl, 286, y + 6, 14, lv >= 2 ? '#ffb070' : '#ffe680', 'right', FONT_SOFT);
      text('はねかえす・くわえるで たまる。おとすと 0', 34, y + 32, 12, 'rgba(255,255,255,0.45)');
    }
  }

  function drawShelf(layer) {
    const P = R.PAL[layer];
    const x0 = FX0 + 640 + 22, wd = W - x0 - 22;
    const ch = CH[G.idx];
    text(LAYER_NUM[ch.layer] + '　' + LAYERS[ch.layer].name, x0, 40, 20, P.accent, 'left', FONT_SOFT);
    text(ch.id + '　' + ch.name, x0, 72, 18, P.ink, 'left', FONT_SOFT);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x0, 88, wd, 2);
    // おとしもの
    const ids = ITEMS.map((it, i) => i).filter((i) => ITEMS[i].layer === ch.layer);
    const got = ids.filter((i) => save.found.indexOf(i) >= 0).length;
    text('おとしもの', x0, 116, 16, P.ink, 'left', FONT_SOFT);
    text(got + ' / ' + ids.length, x0 + wd, 116, 15, 'rgba(255,255,255,0.6)', 'right');
    ids.forEach((id, k) => {
      const cx = x0 + (k % 2) * (wd / 2), cy = 128 + Math.floor(k / 2) * 98;
      const has = save.found.indexOf(id) >= 0;
      const flash = G.toast && G.toast.id === id ? Math.max(0, 1 - G.toast.t) : 0;
      ctx.fillStyle = has ? 'rgba(255,255,255,' + (0.07 + flash * 0.4) + ')' : 'rgba(0,0,0,0.25)';
      R.rr(ctx, cx + 3, cy, wd / 2 - 6, 90, 10); ctx.fill();
      if (has) {
        R.drawItem(ctx, id, cx + wd / 4, cy + 32, 42, G.t);
        ctx.font = '12px ' + FONT_SOFT; ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        R.wrapText(ctx, ITEMS[id].name, cx + wd / 4, cy + 68, wd / 2 - 14, 14);
      } else {
        R.itemSilhouette(ctx, cx + wd / 4, cy + 36, 48);
      }
    });
    // きらら
    const w = G.w;
    const gy = 340;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; R.rr(ctx, x0, gy, wd, 62, 10); ctx.fill();
    ctx.save(); ctx.translate(x0 + 24, gy + 31); ctx.fillStyle = P.ore;
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(9, 0); ctx.lineTo(0, 14); ctx.lineTo(-9, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(4, -2); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.restore();
    text('きらら（この へやの とくてん）', x0 + 44, gy + 24, 13, 'rgba(255,255,255,0.6)', 'left', FONT_SOFT);
    const gp = 1 + (G.gemPop || 0) * 0.18;
    ctx.save(); ctx.translate(x0 + 44, gy + 52); ctx.scale(gp, gp);
    text(String(Math.round(G.shownGems)), 0, 0, 24, G.gemPop > 0.3 ? '#fff6c8' : '#fff', 'left');
    ctx.restore();
    const best = save.best[ch.id];
    if (best) text('これまでの さいこう ' + best, x0 + wd - 10, gy + 50, 13, 'rgba(255,255,255,0.5)', 'right');
    // ヒント
    const hy = 418;
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; R.rr(ctx, x0, hy, wd, 170, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; ctx.stroke();
    text('ヒント', x0 + 14, hy + 26, 14, P.accent, 'left', FONT_SOFT);
    ctx.font = '15px ' + FONT_SOFT; ctx.fillStyle = P.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    R.wrapText(ctx, currentHint(), x0 + 14, hy + 54, wd - 28, 23);
    // 操作
    const cy = 612;
    const lines = inp.mode === 'keys'
      ? ['← → … うごく。くわえたら ねらう', 'スペース 長押し … くわえる、はなすと はく', 'Esc … メニュー　M … 音']
      : ['マウス … うごく。くわえたら ねらうだけ', 'ボタン長押し … くわえる、はなすと はく', 'Esc … メニュー　M … 音'];
    lines.forEach((l, k) => text(l, x0, cy + k * 21, 13, 'rgba(255,255,255,0.55)', 'left'));
    if (save.muted) text('音：なし（M）', x0 + wd, 40, 13, '#ffb0a0', 'right');
  }

  function itemsLeft(w) { return (CH[G.idx].items || []).filter((id) => w.found.indexOf(id) < 0).length; }

  function currentHint() {
    const w = G.w;
    if (!w) return '';
    if (G.ctxHint) return G.ctxHint.text;
    const b = w.balls[0];
    if (w.lidOpen) {
      const ch = CH[G.idx];
      const left = (ch.items || []).filter((id) => w.found.indexOf(id) < 0).length;
      return 'ふたが あいた！ あなへ 玉を とおすと、上の へやへ のぼれる。' + (left ? '\nこの へやには、まだ おとしものが ' + left + 'こ ある。' : '');
    }
    if (b.state === 'held' && G.idx === 0 && G.enterT < 30) return inp.mode === 'keys' ? '← → で ねらって、\nスペースで はきだす。\nひかる かたまりは、まるごと おちる。' : 'マウスで ねらって、\nクリックで はきだす。\nひかる かたまりは、まるごと おちる。';
    return CH[G.idx].hint;
  }

  // ---------------------------------------------------------------- プレイ画面
  function easeInOut(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  function drawPlay() {
    const ch = CH[G.idx];
    const layer = ch.layer;
    const t = G.t;
    let drawLayer = layer;
    if (G.scene === 'rise') drawLayer = G.riseT < G.riseDur * 0.5 ? G.prevLayer : layer;
    drawPanels(drawLayer);
    // ゆれ
    const sx = (Math.random() - 0.5) * FX.shake, sy = (Math.random() - 0.5) * FX.shake;
    ctx.save();
    ctx.translate(sx, sy);
    if (G.scene === 'rise') {
      const p = easeInOut(Math.min(1, G.riseT / G.riseDur));
      R.drawWorld(ctx, G.prevW, G.prevLayer, p * 720, t);
      R.drawWorld(ctx, G.w, layer, (p - 1) * 720, t);
      ctx.save(); ctx.beginPath(); ctx.rect(FX0, 0, 640, 720); ctx.clip();
      // 水が いきおいよく あがる
      ctx.fillStyle = 'rgba(180,240,255,' + (0.15 * Math.sin(p * Math.PI)) + ')'; ctx.fillRect(FX0, 0, 640, 720);
      FX.draw(ctx, FX0, 0);
      R.drawWater(ctx, p < 0.5 ? G.prevLayer : layer, t, FX0);
      R.drawFrog(ctx, G.w.frog, FX0 + G.w.frog.x, PAD_Y, t, { lookY: -1, happy: true });
      ctx.restore();
      // 結果
      drawResultCard(Math.min(1, G.riseT * 3) * Math.min(1, (G.riseDur - G.riseT) * 3));
    } else {
      const w = G.w;
      R.drawWorld(ctx, w, layer, 0, t);
      ctx.save(); ctx.beginPath(); ctx.rect(FX0, 0, 640, 720); ctx.clip();
      // ねらい線
      if (!G.paused && G.exitPending == null) {
        const ai = w.aimInfo();
        const b = w.balls[0];
        if (ai && (b.state === 'held' || b.state === 'tongue')) R.drawAim(ctx, w, ai, t, FX0, 0, layer);
        else if (ai) { ctx.globalAlpha = 0.7; R.drawAim(ctx, w, ai, t, FX0, 0, layer); ctx.globalAlpha = 1; }
      }
      drawBallsAndFrog(w, layer, t);
      if (w.lidOpen && G.exitPending == null) drawHoleSign(w, layer, t);
      FX.draw(ctx, FX0, 0);
      FX.drawTexts(ctx, FX0, 0);
      ctx.restore();
    }
    ctx.restore();
    if (FX.flash > 0) { ctx.fillStyle = R.rgba(FX.flashColor.length === 7 ? FX.flashColor : '#ffffff', FX.flash * 0.5); ctx.fillRect(FX0, 0, 640, 720); }
    if (G.layerCard > 0 && G.scene === 'play' && !G.paused) drawLayerCard();
    if (G.toast) drawToast();
    if (G.paused) drawPause();
  }

  function drawBallsAndFrog(w, layer, t) {
    const f = w.frog;
    const b = w.balls[0];
    const fx = FX0 + f.x;
    const ff = G.frogFx;
    // 沈んだ玉
    if (b.state === 'sunk') {
      const k = b.t / 0.7;
      ctx.globalAlpha = 0.6; R.drawBall(ctx, b, FX0 + b.x, WATER_Y + 14 + Math.sin(k * Math.PI) * 14, 0, t, true); ctx.globalAlpha = 1;
      if (Math.random() < 0.3) FX.add({ k: 'drop', x: b.x + (Math.random() - 0.5) * 10, y: WATER_Y + 20, vx: 0, vy: -60, g: 0, life: 0.4, t: 0, s: 2, c: 'rgba(220,250,255,0.8)' });
    }
    R.drawWater(ctx, layer, t, FX0);
    // カエル
    const look = b.state === 'free' ? { x: S.clamp((b.x - f.x) / 200, -1, 1), y: S.clamp((b.y - PAD_Y) / 300, -1, 1) } : { x: 0, y: -1 };
    const holding = b.state === 'held' || b.state === 'tongue';
    const hop = ff.happy > 0 ? Math.abs(Math.sin(ff.happy * 9)) * 8 * Math.min(1, ff.happy) : 0;
    R.drawFrog(ctx, f, fx, PAD_Y - hop, t, { squash: ff.squash, blink: ff.blink > 0, lookX: look.x, lookY: look.y, holding: b.state === 'held', stun: f.stun, slow: f.slow, happy: ff.happy > 0 });
    // 舌
    if (b.state === 'tongue') {
      const m = w.mouth();
      R.drawTongue(ctx, FX0 + m.x, m.y, FX0 + b.x, b.y, 1);
    } else if (f.tongue > 0 && b.state !== 'held') {
      const m = w.mouth(), k = f.tongue / 0.16;
      R.drawTongue(ctx, FX0 + m.x, m.y, FX0 + m.x, m.y - 60 * k, 1);
    }
    // 玉
    for (const q of w.balls) {
      if (q.state === 'free' || q.state === 'tongue') R.drawBall(ctx, q, FX0 + q.x, q.y, q.main ? w.momLevel() : 0, t, q.main);
    }
    if (b.state === 'held') {
      const m = w.mouth();
      R.drawBall(ctx, b, FX0 + m.x, m.y - 2, w.momLevel(), t, true);
      // ねらいの矢じるし
      const a = w.aim;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
      const ax = FX0 + m.x + Math.cos(a) * 46, ay = m.y + Math.sin(a) * 46;
      ctx.beginPath(); ctx.moveTo(FX0 + m.x + Math.cos(a) * 20, m.y + Math.sin(a) * 20); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath();
      ctx.moveTo(ax + Math.cos(a) * 8, ay + Math.sin(a) * 8); ctx.lineTo(ax + Math.cos(a + 2.4) * 8, ay + Math.sin(a + 2.4) * 8); ctx.lineTo(ax + Math.cos(a - 2.4) * 8, ay + Math.sin(a - 2.4) * 8); ctx.closePath(); ctx.fill();
      if (G.enterT > 0.5 && G.enterT < 60 && G.idx <= 1) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 4);
        textOutline(inp.mode === 'keys' ? 'スペースで はきだす' : 'クリックで はきだす', fx, PAD_Y - 70, 16, 'rgba(255,255,255,' + pulse + ')', 'center', FONT_SOFT, 4);
      }
    }
  }

  // あいた ふたの穴の 下に出す しるし（のぼれる／まだ おとしものが ある）
  function drawHoleSign(w, layer, t) {
    const left = itemsLeft(w);
    const k = Math.min(1, (w.lidOpenT || 0) * 2);
    const x = FX0 + S.clamp(w.lidX || 320, 110, 530), y = 58 + Math.sin(t * 3) * 2;
    const label = left ? 'おとしもの まだ ' + left + 'こ' : '↑ ここから のぼれる';
    ctx.globalAlpha = k;
    ctx.font = '15px ' + FONT_SOFT;
    const tw = ctx.measureText(label).width + 24;
    ctx.fillStyle = left ? 'rgba(90,50,20,0.85)' : 'rgba(10,40,50,0.8)';
    R.rr(ctx, x - tw / 2, y - 14, tw, 28, 14); ctx.fill();
    ctx.strokeStyle = left ? '#ffd38a' : R.PAL[layer].glow; ctx.lineWidth = 1.5; ctx.stroke();
    text(label, x, y + 1, 15, left ? '#ffe7b8' : '#ffffff', 'center', FONT_SOFT, 'middle');
    ctx.globalAlpha = 1;
  }

  function drawResultCard(a) {
    if (!G.result || a <= 0) return;
    ctx.globalAlpha = a;
    const left = G.result.total - G.result.got;
    const x = FX0 + 120, y = 250, wd = 400, h = left ? 182 : 150;
    ctx.fillStyle = 'rgba(10,20,30,0.82)'; R.rr(ctx, x, y, wd, h, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    text(G.result.id + '　' + G.result.name, x + wd / 2, y + 40, 22, '#fff', 'center', FONT_SOFT);
    text('きらら　' + G.result.gems, x + wd / 2, y + 82, 20, R.PAL[G.prevLayer || 0].ore, 'center', FONT_SOFT);
    if (G.result.total) text('おとしもの　' + G.result.got + ' / ' + G.result.total, x + wd / 2, y + 118, 18, G.result.got === G.result.total ? '#fff2b0' : '#ddd', 'center', FONT_SOFT);
    if (left) text('のこりは「へやを えらぶ」から さがしに こられる', x + wd / 2, y + 154, 14, 'rgba(255,255,255,0.75)', 'center', FONT_SOFT);
    ctx.globalAlpha = 1;
  }

  function drawLayerCard() {
    const ch = CH[G.idx];
    const k = G.layerCard;
    const a = Math.min(1, (2.8 - k) * 3) * Math.min(1, k * 2);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(FX0, 200, 640, 150);
    textOutline(LAYER_NUM[ch.layer], FX0 + 320, 236, 22, R.PAL[ch.layer].accent, 'center', FONT_SOFT, 4);
    textOutline(LAYERS[ch.layer].name, FX0 + 320, 280, 40, '#fff', 'center', FONT_SOFT, 6);
    textOutline(LAYERS[ch.layer].sub, FX0 + 320, 322, 17, 'rgba(255,255,255,0.85)', 'center', FONT_SOFT, 4);
    ctx.globalAlpha = 1;
  }

  function drawToast() {
    const T0 = G.toast, it = ITEMS[T0.id];
    const a = Math.min(1, T0.t * 9) * Math.min(1, (T0.dur - T0.t) * 5);
    ctx.globalAlpha = Math.max(0, a);
    const x = FX0 + 640 + 14, wd = W - x - 14;
    const h = it.letter ? 300 : 230;
    const y = 96;
    ctx.fillStyle = '#faf4e2'; R.rr(ctx, x, y, wd, h, 14); ctx.fill();
    ctx.strokeStyle = '#c8a860'; ctx.lineWidth = 3; ctx.stroke();
    text('みつけた！', x + 16, y + 28, 15, '#b07a2a', 'left', FONT_SOFT);
    const pop = T0.t < 0.25 ? 0.6 + T0.t / 0.25 * 0.4 : 1;
    R.drawItem(ctx, T0.id, x + 52, y + 78, 64 * pop, G.t);
    ctx.font = '19px ' + FONT_SOFT; ctx.fillStyle = '#2a2418'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    R.wrapText(ctx, it.name, x + 96, y + 70, wd - 106, 22);
    text('ほんとうは：' + it.real, x + 96, y + 118, 13, '#7a6a4a', 'left');
    ctx.font = '15px ' + FONT_SOFT; ctx.fillStyle = '#3a3226';
    if (it.letter) {
      ctx.fillStyle = '#fffdf6'; R.rr(ctx, x + 14, y + 134, wd - 28, 150, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(160,140,100,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      it.letter.forEach((l, k) => text(l, x + 28, y + 168 + k * 34, 17, '#3a3060', 'left', FONT_SOFT));
    } else {
      ctx.textAlign = 'left';
      R.wrapText(ctx, it.note, x + 16, y + 158, wd - 32, 22);
    }
    ctx.globalAlpha = 1;
  }

  function drawPause() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    textOutline('ひとやすみ', W / 2, 150, 40, '#fff', 'center', FONT_SOFT, 6);
    const bx = W / 2 - 150;
    button('つづける', bx, 200, 300, 54, () => closePause());
    button('この へやを やりなおす', bx, 266, 300, 54, () => startChamber(G.idx));
    button('へやを えらぶ', bx, 332, 300, 54, () => goSelect());
    button('タイトルへ', bx, 398, 300, 54, () => goTitle());
    drawVolume(W / 2 - 150, 480);
    text('Esc でも もどれます', W / 2, 600, 14, 'rgba(255,255,255,0.6)', 'center');
  }

  function drawVolume(x, y) {
    text('音の 大きさ', x, y + 22, 17, '#fff', 'left', FONT_SOFT);
    button('−', x + 120, y, 44, 36, () => { save.vol = Math.max(0, Math.round((save.vol - 0.1) * 10) / 10); A.setVol(save.vol); writeSave(); A.play('ui'); }, { size: 22 });
    const pct = save.muted ? 'なし' : Math.round(save.vol * 100) + '%';
    text(pct, x + 200, y + 24, 17, '#fff', 'center');
    button('＋', x + 236, y, 44, 36, () => { save.vol = Math.min(1, Math.round((save.vol + 0.1) * 10) / 10); if (save.muted) { save.muted = false; A.setMuted(false); } A.setVol(save.vol); writeSave(); A.play('ui'); }, { size: 22 });
    button(save.muted ? '音を だす（M）' : '音を けす（M）', x + 120, y + 46, 160, 34, () => toggleMute(), { size: 14 });
  }

  // ---------------------------------------------------------------- タイトル
  function drawWellScene(layer, t, opt) {
    // 井戸の底：タイトルと はじめの文で使う
    opt = opt || {};
    ctx.fillStyle = '#05080c'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(R.background(layer), FX0, 0);
    // 遠くに 小さな 空の 丸
    const sx = FX0 + 320, sy = 70;
    const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, 130);
    glow.addColorStop(0, 'rgba(170,220,255,0.55)'); glow.addColorStop(1, 'rgba(170,220,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(FX0, 0, 640, 300);
    ctx.fillStyle = '#9fd4ff'; ctx.beginPath(); ctx.ellipse(sx, sy, 22, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(sx - 6, sy - 2, 7, 2.5, 0, 0, 7); ctx.fill();
    // 井戸の かべ
    for (let r = 0; r < 23; r++) {
      for (const c of [0, 19]) ctx.drawImage(R.tile(layer, S.T.BED, (r + c) % 3), FX0 + c * 32, r * 32);
    }
    // ふさいでいる 岩（シルエット）
    ctx.fillStyle = 'rgba(30,40,55,0.85)';
    ctx.beginPath(); ctx.moveTo(FX0 + 32, 150);
    for (let x = 32; x <= 608; x += 32) ctx.lineTo(FX0 + x, 150 + Math.sin(x * 0.05) * 18 + ((x / 32) % 3) * 10);
    ctx.lineTo(FX0 + 608, 110); ctx.lineTo(FX0 + 32, 110); ctx.closePath(); ctx.fill();
    ctx.fillRect(FX0 + 32, 100, 576, 12);
    // 光のすじ
    ctx.fillStyle = 'rgba(170,220,255,0.06)';
    ctx.beginPath(); ctx.moveTo(sx - 4, 90); ctx.lineTo(sx + 4, 90); ctx.lineTo(sx + 80, 720); ctx.lineTo(sx - 80, 720); ctx.closePath(); ctx.fill();
    // 両側の 断面
    for (const [x0, x1] of [[0, FX0], [FX0 + 640, W]]) {
      ctx.fillStyle = '#0a0f15'; ctx.fillRect(x0, 0, x1 - x0, H);
      for (let L = 0; L < 5; L++) {
        ctx.fillStyle = R.shade(R.PAL[L].soil, -0.6);
        ctx.fillRect(x0, 640 - (L + 1) * 112, x1 - x0, 108);
      }
      ctx.fillStyle = '#3d6e3a'; ctx.fillRect(x0, 0, x1 - x0, 76);
      const sky2 = ctx.createLinearGradient(0, 0, 0, 70); sky2.addColorStop(0, '#5a9ad8'); sky2.addColorStop(1, '#b8e0f4');
      ctx.fillStyle = sky2; ctx.fillRect(x0, 0, x1 - x0, 68);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(FX0 - 6, 0, 6, H); ctx.fillRect(FX0 + 640, 0, 6, H);
    // ちり
    for (let k = 0; k < 24; k++) {
      const x = FX0 + 40 + ((k * 97 + t * 8 * (1 + k % 3)) % 560), y = (k * 53 + t * 14 * (1 + (k % 2))) % 640;
      ctx.fillStyle = 'rgba(220,235,255,' + (0.15 + (k % 4) * 0.05) + ')'; ctx.fillRect(x, y, 2, 2);
    }
    R.drawWater(ctx, layer, t, FX0);
    if (!opt.noFrog) R.drawFrog(ctx, { x: 320 }, FX0 + 320, PAD_Y, t, { lookY: -1, lookX: Math.sin(t * 0.4) * 0.2, blink: G.frogFx.blink > 0 });
  }

  function drawTitle() {
    const t = G.t;
    drawWellScene(0, t);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(FX0, 0, 640, H);
    textOutline('そこから、そら', W / 2, 250, 64, '#ffffff', 'center', FONT_SOFT, 8);
    textOutline('井戸のカエルと 五つの層', W / 2, 306, 22, '#cfe8ff', 'center', FONT_SOFT, 5);
    const has = save.reached > 0 || Object.keys(save.cleared).length > 0;
    const bx = W / 2 - 140;
    let y = 352;
    if (has) {
      button('つづきから', bx, y, 280, 52, () => startChamber(Math.min(save.cur, CH.length - 1), true), { sub: CH[Math.min(save.cur, CH.length - 1)].id + '　' + CH[Math.min(save.cur, CH.length - 1)].name });
      y += 62;
      button('はじめから', bx, y, 280, 46, () => startIntro());
      y += 56;
      button('へやを えらぶ', bx, y, 280, 46, () => goSelect());
      y += 56;
    } else {
      button('はじめる', bx, y, 280, 56, () => startIntro(), { size: 24 });
      y += 70;
    }
    drawVolume(W / 2 - 150, y + 6);
    text('マウス（または ← → と スペース）で あそびます。音が でます。', W / 2, 690, 14, 'rgba(255,255,255,0.7)', 'center');
    // 左右の 説明
    ctx.font = '15px ' + FONT_SOFT; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    R.wrapText(ctx, '玉を はねかえして、頭の上の 岩を くずそう。\n\nささえを なくした 岩は、かたまりごと おちる。', 30, 130, 260, 24);
    R.wrapText(ctx, '石の なかには、むかしの だれかの おとしもの。\n\nいちばん 上の ふたを あければ、そらが 見える… はず。', FX0 + 662, 130, 260, 24);
    if (save.ended) text('そらを 見た回数：' + save.ended, W - 30, 40, 14, '#fff6c8', 'right', FONT_SOFT);
  }

  function drawIntro() {
    const t = G.t;
    drawWellScene(0, t);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
    const s = INTRO[Math.min(G.introStep, INTRO.length - 1)];
    const a = Math.min(1, G.introT * 2.5);
    ctx.globalAlpha = a;
    ctx.font = '25px ' + FONT_SOFT; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    s.split('\n').forEach((l, k) => { ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(l, W / 2, 290 + k * 44); ctx.fillText(l, W / 2, 290 + k * 44); });
    ctx.globalAlpha = 1;
    text('クリックで つぎへ（Esc で とばす）', W / 2, 560, 15, 'rgba(255,255,255,' + (0.4 + 0.3 * Math.sin(t * 3)) + ')', 'center');
    for (let k = 0; k < INTRO.length; k++) { ctx.fillStyle = k <= G.introStep ? '#fff' : 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(W / 2 - 20 + k * 20, 590, 4, 0, 7); ctx.fill(); }
  }

  // ---------------------------------------------------------------- へやえらび
  function drawSelect() {
    const t = G.t;
    ctx.fillStyle = '#0b1118'; ctx.fillRect(0, 0, W, H);
    textOutline('へやを えらぶ', W / 2, 44, 30, '#fff', 'center', FONT_SOFT, 5);
    const total = save.found.length;
    text('みつけた おとしもの　' + total + ' / ' + ITEMS.length, W / 2, 84, 16, '#fff6c8', 'center', FONT_SOFT);
    for (let L = 4; L >= 0; L--) {
      const y = 104 + (4 - L) * 112;
      const known = save.reached >= L * 3;
      ctx.fillStyle = known ? R.shade(R.PAL[L].soil, -0.45) : '#151515';
      R.rr(ctx, 40, y, W - 80, 104, 12); ctx.fill();
      text(LAYER_NUM[L], 60, y + 34, 14, 'rgba(255,255,255,0.6)', 'left', FONT_SOFT);
      text(known ? LAYERS[L].name : '？？？', 60, y + 64, 22, known ? '#fff' : 'rgba(255,255,255,0.4)', 'left', FONT_SOFT);
      for (let k = 0; k < 3; k++) {
        const i = L * 3 + k, ch = CH[i];
        const open = i <= save.reached;
        const bx = 250 + k * 236;
        const lbl = open ? ch.id + '　' + ch.name : ch.id + '　？？？';
        const sub = open ? (save.cleared[ch.id] ? 'きらら さいこう ' + (save.best[ch.id] || 0) : 'まだ ぬけていない') : '';
        button(lbl, bx, y + 14, 222, 76, () => startChamber(i, true), { disabled: !open, size: 17, sub });
      }
      // この層の おとしもの
      const ids = ITEMS.map((it, i) => i).filter((i) => ITEMS[i].layer === L);
      ids.forEach((id, k) => {
        const ix = 980 + k * 54, iy = y + 52;
        if (save.found.indexOf(id) >= 0) R.drawItem(ctx, id, ix, iy, 38, t);
        else R.itemSilhouette(ctx, ix, iy, 40);
      });
    }
    button('もどる（Esc）', W / 2 - 110, 670, 220, 40, () => goTitle(), { size: 16 });
  }

  // ---------------------------------------------------------------- 結末
  function drawEnding() {
    const t = G.t, e = G.endT;
    // はじめは 空を 見あげている → ゆっくり 地上へ 目を おろす
    const pan = 300 * (1 - easeInOut(Math.min(1, Math.max(0, (e - 0.8) / 3.6))));
    const sky = ctx.createLinearGradient(0, -300, 0, H);
    sky.addColorStop(0, '#1f5fb8'); sky.addColorStop(0.5, '#6fb6ec'); sky.addColorStop(1, '#d6f0fb');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(0, pan);
    // お日さま
    const sun = ctx.createRadialGradient(1060, 40, 10, 1060, 40, 260);
    sun.addColorStop(0, 'rgba(255,250,220,0.95)'); sun.addColorStop(0.15, 'rgba(255,244,200,0.55)'); sun.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = sun; ctx.fillRect(700, -300, 580, 700);
    // 雲
    for (let q = 0; q < 7; q++) {
      const cx = ((q * 230 + t * (5 + q * 2)) % (W + 300)) - 150, cy = -200 + (q % 4) * 95;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.7 + (q % 3) * 0.1) + ')';
      ctx.beginPath(); ctx.ellipse(cx, cy, 74, 20, 0, 0, 7); ctx.ellipse(cx + 40, cy - 13, 42, 19, 0, 0, 7); ctx.ellipse(cx - 42, cy - 6, 34, 15, 0, 0, 7); ctx.fill();
    }
    // 鳥
    ctx.strokeStyle = 'rgba(40,50,70,0.7)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let q = 0; q < 5; q++) {
      const bx = ((q * 170 + t * (40 + q * 6)) % (W + 200)) - 100, by = -120 + q * 34 + Math.sin(t * 1.5 + q) * 10;
      const fl = Math.sin(t * 8 + q * 2) * 5;
      ctx.beginPath(); ctx.moveTo(bx - 9, by - fl); ctx.quadraticCurveTo(bx - 4, by - 3, bx, by); ctx.quadraticCurveTo(bx + 4, by - 3, bx + 9, by - fl); ctx.stroke();
    }
    // とおくの 海
    ctx.fillStyle = '#3f86c8'; ctx.fillRect(0, 428, W, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (let q = 0; q < 22; q++) { const a = 0.5 + 0.5 * Math.sin(t * 3 + q * 1.7); ctx.globalAlpha = a; ctx.fillRect((q * 61 + t * 8) % W, 434 + (q % 4) * 6, 14 + (q % 3) * 6, 2); }
    ctx.globalAlpha = 1;
    // 丘と 花
    ctx.fillStyle = '#7cbc58'; ctx.beginPath(); ctx.moveTo(0, 470); ctx.quadraticCurveTo(W / 2, 404, W, 470); ctx.lineTo(W, H + 300); ctx.lineTo(0, H + 300); ctx.fill();
    ctx.fillStyle = '#62a346'; ctx.beginPath(); ctx.moveTo(0, 566); ctx.quadraticCurveTo(W / 2, 506, W, 566); ctx.lineTo(W, H + 300); ctx.lineTo(0, H + 300); ctx.fill();
    const fcol = ['#fff6a8', '#ffb8d0', '#ffffff', '#c8b8ff'];
    for (let q = 0; q < 46; q++) {
      const fx = (q * 97.3) % W, fy = 470 + ((q * 53.1) % 220);
      if (fy < 440 + Math.abs(fx - W / 2) * 0.1) continue;
      ctx.fillStyle = fcol[q % 4]; ctx.beginPath(); ctx.arc(fx, fy + Math.sin(t * 2 + q) * 1, 3, 0, 7); ctx.fill();
    }
    // 大きな木（ねっこの ぬし）
    ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.moveTo(896, 470); ctx.lineTo(904, 270); ctx.lineTo(936, 270); ctx.lineTo(948, 470); ctx.closePath(); ctx.fill();
    const sway = Math.sin(t * 0.8) * 4;
    ctx.fillStyle = '#4e8e3a';
    for (const [x, y, r] of [[920, 240, 92], [858, 272, 62], [986, 276, 64], [922, 176, 62]]) { ctx.beginPath(); ctx.arc(x + sway * (y < 200 ? 1.5 : 1), y, r, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#5fa34a';
    for (const [x, y, r] of [[900, 214, 40], [960, 250, 34], [880, 290, 28]]) { ctx.beginPath(); ctx.arc(x + sway, y, r, 0, 7); ctx.fill(); }
    // 井戸（石の わく）と、とんだ 木のふた
    const wx = W / 2 - 60, wy = 520;
    ctx.fillStyle = '#8a8478'; R.rr(ctx, wx - 80, wy - 30, 160, 70, 10); ctx.fill();
    ctx.strokeStyle = '#5a564e'; ctx.lineWidth = 2;
    for (let q = -60; q <= 60; q += 30) { ctx.beginPath(); ctx.moveTo(wx + q, wy - 18); ctx.lineTo(wx + q, wy + 38); ctx.stroke(); }
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.ellipse(wx, wy - 26, 66, 14, 0, 0, 7); ctx.fill();
    const lidK = Math.min(1, e / 1.0);
    const lx = wx + 150 * lidK, ly = wy - 26 - Math.sin(lidK * Math.PI) * 140 + lidK * 60;
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(lidK * 2.8);
    ctx.fillStyle = '#7a5532'; R.rr(ctx, -50, -8, 100, 16, 4); ctx.fill(); ctx.fillStyle = '#5b5e62'; ctx.fillRect(-46, -2, 92, 4);
    ctx.restore();
    // アオ：井戸から とびだして わくに すわる
    const jk = Math.min(1, Math.max(0, (e - 0.5) / 1.1));
    const fy = (wy - 10) - Math.sin(jk * Math.PI) * 160 - jk * 18;
    const look = e > 8.6 ? { x: -0.8, y: -0.2 } : { x: Math.sin(t * 0.5) * 0.3, y: -1 };
    if (jk > 0) R.drawFrog(ctx, { x: 0 }, wx, fy - 46, t, { lookY: look.y, lookX: look.x, happy: e > 1.7, blink: G.frogFx.blink > 0, squash: jk >= 1 && e < 1.9 ? (1.9 - e) * 3 : 0 });
    // ちょうちょ
    for (let q = 0; q < 2; q++) {
      const bx = 300 + q * 520 + Math.sin(t * 0.7 + q * 3) * 80, by = 560 + Math.sin(t * 1.3 + q) * 30;
      const fl = Math.abs(Math.sin(t * 12 + q)) * 6 + 2;
      ctx.fillStyle = q ? '#ffd86a' : '#ffffff';
      ctx.beginPath(); ctx.ellipse(bx - fl / 2, by, fl, 5, 0, 0, 7); ctx.ellipse(bx + fl / 2, by, fl, 5, 0, 0, 7); ctx.fill();
    }
    // どんぐりの 芽
    if (save.found.indexOf(19) >= 0 && e > 9) {
      const g = Math.min(1, (e - 9) / 2);
      ctx.strokeStyle = '#4e9a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(wx + 130, wy + 30); ctx.lineTo(wx + 130, wy + 30 - 26 * g); ctx.stroke();
      ctx.fillStyle = '#7fd05a'; ctx.beginPath(); ctx.ellipse(wx + 122, wy + 30 - 26 * g, 8 * g, 4 * g, -0.5, 0, 7); ctx.ellipse(wx + 138, wy + 28 - 26 * g, 8 * g, 4 * g, 0.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#a8662e'; ctx.beginPath(); ctx.ellipse(wx + 130, wy + 34, 6, 4, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
    // ことば
    const lines = [
      [2.0, 'そらは、あおかった。'],
      [4.2, 'ひろくて、ひろくて、どこまでも あおかった。'],
      [6.4, save.found.indexOf(18) >= 0 ? 'てがみに かいてあった とおりだ。' : 'こんなに ひろいなんて、しらなかった。'],
      [8.6, 'とおくに、そらより こい あおが 見える。あれは なんだろう。']
    ];
    // いちばん新しい1行を表示（入れかわる）
    let cur = null;
    for (const [at, s] of lines) if (e >= at) cur = [at, s];
    if (cur) {
      const a = Math.min(1, (e - cur[0]) * 1.5) * (e > 13 ? Math.max(0, 1 - (e - 13)) : 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 586, W, 50);
      textOutline(cur[1], W / 2, 611, 24, '#fff', 'center', FONT_SOFT, 6);
      ctx.globalAlpha = 1;
    }
    // まとめ
    if (e > 14) {
      const a = Math.min(1, (e - 14) * 1.5);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(10,20,35,0.78)'; R.rr(ctx, 120, 60, W - 240, 470, 18); ctx.fill();
      textOutline('おしまい', W / 2, 100, 34, '#fff6c8', 'center', FONT_SOFT, 6);
      text('いどの なかで みつけた もの　' + save.found.length + ' / ' + ITEMS.length, W / 2, 142, 18, '#fff', 'center', FONT_SOFT);
      ITEMS.forEach((it, i) => {
        const cx = 200 + (i % 10) * 98, cy = 210 + Math.floor(i / 10) * 140;
        const has = save.found.indexOf(i) >= 0;
        if (has) {
          R.drawItem(ctx, i, cx, cy, 52, t);
          ctx.font = '12px ' + FONT; ctx.fillStyle = '#ddd'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          R.wrapText(ctx, it.real, cx, cy + 46, 92, 14);
        } else R.itemSilhouette(ctx, cx, cy, 56);
      });
      const gemSum = CH.reduce((acc, c) => acc + (save.best[c.id] || 0), 0);
      text('きらら（各へやの さいこうの 合計）　' + gemSum, W / 2, 446, 15, 'rgba(255,240,190,0.85)', 'center', FONT_SOFT);
      text(save.found.length >= ITEMS.length ? 'ぜんぶ みつけた！ ありがとう。' : 'のこりの おとしものは「へやを えらぶ」から さがせます。', W / 2, 482, 16, 'rgba(255,255,255,0.8)', 'center', FONT_SOFT);
      ctx.globalAlpha = 1;
      if (e > 15) {
        button('へやを えらぶ', W / 2 - 250, 548, 230, 48, () => goSelect());
        button('タイトルへ', W / 2 + 20, 548, 230, 48, () => goTitle());
      }
    } else if (e > 2) {
      text('クリックで はやおくり', W - 20, H - 16, 13, 'rgba(0,0,0,0.4)', 'right');
    }
    if (e < 1.2) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - e / 1.2) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  // ---------------------------------------------------------------- ループ
  function render() {
    G.buttons = [];
    if (G.scene === 'title') drawTitle();
    else if (G.scene === 'intro') drawIntro();
    else if (G.scene === 'select') drawSelect();
    else if (G.scene === 'ending') drawEnding();
    else drawPlay();
    // カーソル（くわえているとき）
    if (G.scene === 'play' && !G.paused && inp.mode === 'mouse' && G.w && G.w.balls[0].state === 'held') {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(inp.mx, inp.my, 9, 0, 7); ctx.moveTo(inp.mx - 14, inp.my); ctx.lineTo(inp.mx - 4, inp.my); ctx.moveTo(inp.mx + 4, inp.my); ctx.lineTo(inp.mx + 14, inp.my); ctx.stroke();
    }
  }

  // 層の背景と マスの絵は、はじめて使う瞬間に作ると 一瞬かくつくので、読みこみ直後に まとめて作っておく
  setTimeout(() => {
    for (let L = 0; L < 5; L++) {
      R.background(L);
      for (const ty of [S.T.BED, S.T.SOIL, S.T.STONE, S.T.HARD, S.T.ORE, S.T.BLAST, S.T.MUD, S.T.ROOT]) for (let v = 0; v < 3; v++) R.tile(L, ty, v);
    }
  }, 30);

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!G.hold) update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------------------------------------------------------------- 検証用のつまみ（遊ぶときは使わない）
  window.__sks = {
    G, inp, CH, S,
    get save() { return save; },
    hold(v) { G.hold = v !== false; },
    goto(i, seed) { startChamber(i, true); if (seed !== undefined) { G.w = new S.World(CH[i], { seed }); G.w.bumpT = {}; } G.layerCard = 0; },
    tick(input) { if (G.scene !== 'play') return false; const w = G.w; w.step(Object.assign({ tx: w.frog.x }, input || {})); handleEvents(w); return true; },
    frame(dt) { update(dt || 1 / 60); render(); },
    step(n, dt) { for (let k = 0; k < (n || 1); k++) update(dt || 1 / 60); render(); },
    draw() { render(); },
    resetSave() { save = defSave(); writeSave(); },
    finish() { if (G.scene === 'play') finishChamber(); }
  };
})();
