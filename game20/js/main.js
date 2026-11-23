// STAIRWARD（峠の砦と五つの夜） — 画面・入力・進行・保存
(function () {
  'use strict';
  const D = K20D, S = K20S, R = K20R, SP = K20SP, A = K20A;
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const W = 1280, H = 720, SC = 2;
  const wcv = document.createElement('canvas'); wcv.width = R.LW; wcv.height = R.LH;
  const wg = wcv.getContext('2d');
  const FONT = '"Yu Gothic UI","Yu Gothic","Hiragino Kaku Gothic ProN","Hiragino Sans","Meiryo",sans-serif';
  const SAVE_KEY = 'k20_kizahashi_v1';
  const RCOL = { S: '#ff8a5c', G: '#ffd04a', C: '#c88cff', F: '#7fd8ff' };

  // ---------------- 保存 ----------------
  function defaultSave() {
    return { v: 1, night: 0, wave: 0, up: {}, gifts: {}, combos: {}, comboFirst: {}, waveStats: {}, placements: {}, last: {}, tries: {}, started: false, finished: false, opt: { on: true, vol: 0.7, speed: 1 } };
  }
  let save = defaultSave();
  function storeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 保存できなくても遊べる */ } }
  function loadSave() {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      if (!s) return null;
      const o = JSON.parse(s);
      if (!o || o.v !== 1) return null;
      return Object.assign(defaultSave(), o);
    } catch (e) { return null; }
  }
  const saved = loadSave();
  if (saved) { save.opt = saved.opt || save.opt; }
  A.setOn(save.opt.on); A.setVol(save.opt.vol);

  // ---------------- 状態 ----------------
  const G = {
    scene: 'title', time: 0, buttons: [], mouse: { x: -1, y: -1, down: false }, hover: null,
    wave: null, waveIdx: [0, 0], pl: {}, sel: null, drag: null, an: null,
    st: null, speed: 1, paused: false, acc: 0, fx: [], texts: [], bubbles: [], ticker: [], shake: 0, doorFlash: 0,
    story: null, overlay: null, result: null, showLast: true, hold: false, fast: 0, assistGate: {}, said: {},
    pendingAfterStory: null, banner: null, morning: null,
  };
  window.K20G = G;

  // ---------------- 便利 ----------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function waveAt(n, w) { return D.NIGHTS[n] && D.NIGHTS[n].waves[w]; }
  function waveLabel(n, w) { return D.NIGHTS[n].title.split('　')[0] + '・' + ['一', '二', '三'][w] + '陣'; }
  function allyName(id) { return id === 'gate' ? '門' : (D.ALLIES[id] ? D.ALLIES[id].name : id); }
  function toScreen(wx, wy, wz) { const p = R.iso(wx, wy, wz); return { x: p.x * SC, y: p.y * SC }; }

  function font(sz, bold) { return (bold ? 'bold ' : '') + sz + 'px ' + FONT; }
  function text(s, x, y, o) {
    o = o || {};
    ctx.font = font(o.size || 18, o.bold);
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    if (o.shadow !== false) {
      ctx.fillStyle = o.shadowColor || 'rgba(0,0,0,0.75)';
      ctx.fillText(s, x + (o.sh || 2), y + (o.sh || 2));
    }
    ctx.fillStyle = o.color || '#f4eee0';
    ctx.fillText(s, x, y);
  }
  function wrap(s, maxW, size, bold) {
    ctx.font = font(size, bold);
    const lines = [];
    for (const para of String(s).split('\n')) {
      let cur = '';
      for (const ch of para) {
        if (ctx.measureText(cur + ch).width > maxW && cur) {
          // 句読点は行頭に置かない
          if ('、。」）！？'.indexOf(ch) >= 0) { cur += ch; continue; }
          lines.push(cur); cur = ch;
        } else cur += ch;
      }
      lines.push(cur);
    }
    return lines;
  }
  function panel(x, y, w, h, o) {
    o = o || {};
    ctx.fillStyle = o.fill || 'rgba(14,12,28,0.84)';
    roundRect(x, y, w, h, o.r == null ? 10 : o.r); ctx.fill();
    if (o.stroke !== false) { ctx.strokeStyle = o.stroke || 'rgba(255,230,180,0.28)'; ctx.lineWidth = o.lw || 1.5; roundRect(x + 0.5, y + 0.5, w - 1, h - 1, o.r == null ? 10 : o.r); ctx.stroke(); }
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function sprite(name, x, y, scale, o) {
    o = o || {};
    const c = SP.get(name, o.view || 'f', o.frame || 'idle', !!o.mirror, o.mode);
    ctx.imageSmoothingEnabled = false;
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.drawImage(c, Math.round(x - c.width * scale / 2), Math.round(y - c.height * scale), c.width * scale, c.height * scale);
    ctx.globalAlpha = 1;
  }
  // ボタン（その場で描いて登録する）
  function button(key, x, y, w, h, label, onClick, o) {
    o = o || {};
    const hov = G.mouse.x >= x && G.mouse.x < x + w && G.mouse.y >= y && G.mouse.y < y + h;
    const en = o.enabled !== false;
    const prim = !!o.primary;
    ctx.fillStyle = !en ? 'rgba(40,36,50,0.8)' : (prim ? (hov ? '#e8a23a' : '#c9862a') : (hov ? 'rgba(80,70,110,0.95)' : 'rgba(46,40,70,0.92)'));
    if (o.active) ctx.fillStyle = hov ? '#5a8a5a' : '#467246';
    roundRect(x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = prim ? '#ffe0a0' : 'rgba(255,230,180,0.35)'; ctx.lineWidth = 1.5;
    roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 8); ctx.stroke();
    text(label, x + w / 2, y + h / 2 + 1, { align: 'center', base: 'middle', size: o.size || 18, bold: true, color: en ? (prim ? '#1e140a' : '#f4eee0') : '#8a8494', shadow: !prim });
    G.buttons.push({ key, x, y, w, h, label, onClick: en ? onClick : null, hov });
    return hov;
  }

  // ---------------- 進行 ----------------
  function newGame() {
    const opt = save.opt;
    save = defaultSave(); save.opt = opt; save.started = true;
    storeSave();
    showStory(D.STORY.prologue, 'night', () => startNight(0));
  }
  function continueGame() {
    const s = loadSave();
    if (!s) return newGame();
    save = s;
    if (save.finished) { G.chron = chronicle(); G.scene = 'ending'; A.music('dawn'); return; }
    gotoPlan(save.night, save.wave, true);
  }
  function startNight(n) {
    save.night = n; save.wave = 0; storeSave();
    const N = D.NIGHTS[n];
    G.melt = n;
    showStory([N.title].concat(N.intro), 'night', () => gotoPlan(n, 0), { title: true });
  }
  function gotoPlan(n, w, resumed) {
    const wave = waveAt(n, w);
    save.night = n; save.wave = w; storeSave();
    G.waveIdx = [n, w]; G.wave = wave; G.melt = n;
    if (wave.join && !resumed && !G.joinShown) {
      G.joinShown = wave.id;
      showStory(D.JOIN[wave.join], 'night', () => { gotoPlan(n, w, true); });
      return;
    }
    G.joinShown = null;
    // 前の陣の持ち場を引きつぐ
    let pl = save.placements[wave.id];
    if (!pl) {
      pl = {};
      const prev = prevWaveId(n, w);
      const pp = prev && save.placements[prev];
      if (pp) for (const a of wave.allies) if (pp[a]) pl[a] = pp[a];
    }
    G.pl = Object.assign({}, pl);
    for (const k of Object.keys(G.pl)) if (wave.allies.indexOf(k) < 0) delete G.pl[k];
    G.sel = wave.allies.find((a) => !G.pl[a]) || null;
    G.scene = 'plan'; G.st = null; G.result = null; G.fx = []; G.texts = []; G.bubbles = []; G.ticker = [];
    G.showLast = !!save.last[wave.id];
    G.newEnemy = newEnemiesIn(n, w);
    reanalyze();
    A.music('plan');
  }
  function prevWaveId(n, w) {
    if (w > 0) return waveAt(n, w - 1).id;
    if (n > 0) { const N = D.NIGHTS[n - 1]; return N.waves[N.waves.length - 1].id; }
    return null;
  }
  function newEnemiesIn(n, w) {
    const seen = {};
    for (let i = 0; i <= n; i++) for (let j = 0; j < D.NIGHTS[i].waves.length; j++) {
      if (i === n && j === w) break;
      for (const g of D.NIGHTS[i].waves[j].groups) seen[g.e] = true;
    }
    const out = [];
    for (const g of waveAt(n, w).groups) if (!seen[g.e] && out.indexOf(g.e) < 0) out.push(g.e);
    return out;
  }
  function reanalyze() { G.an = S.analyze(G.wave, G.pl, save.up); }

  function startBattle() {
    const wave = G.wave;
    save.placements[wave.id] = Object.assign({}, G.pl);
    save.tries[wave.id] = (save.tries[wave.id] || 0) + 1;
    storeSave();
    G.st = S.create({ wave, placement: G.pl, upgrades: save.up });
    G.scene = 'battle'; G.paused = false; G.acc = 0; G.fx = []; G.texts = []; G.bubbles = []; G.ticker = [];
    G.speed = save.opt.speed || 1; G.assistGate = {}; G.said = {}; G.doorFlash = 0; G.shake = 0;
    G.sel = null; G.result = null;
    G.firstCombo = {}; G.comboCount = {}; G.lastBanner = 0;
    A.play('horn'); A.music('fight');
    addTicker(waveLabel(G.waveIdx[0], G.waveIdx[1]) + '「' + wave.title + '」　迎え撃て！', '#ffe0a0');
  }

  function endBattle() {
    const st = G.st, wave = G.wave;
    const win = st.result.win;
    const sum = summarize(st);
    save.last[wave.id] = sum;
    const newCombos = [];
    for (const id in st.stats.combos) {
      if (!save.combos[id]) newCombos.push(id);
      save.combos[id] = (save.combos[id] || 0) + st.stats.combos[id];
    }
    if (win) {
      const prev = save.waveStats[wave.id];
      if (!prev || sum.lamps >= prev.lamps) save.waveStats[wave.id] = sum;
    }
    storeSave();
    G.result = { win, sum, newCombos, t: 0 };
    G.banner = null; G.texts = []; G.bubbles = [];
    G.scene = 'result';
    A.music(null);
    A.play(win ? 'win' : 'lose');
  }
  function summarize(st) {
    const sum = { win: st.result.win, lamps: st.result.lamps, lampsMax: st.result.lampsMax, t: st.result.t, placement: Object.assign({}, G.pl), allies: {}, combos: Object.assign({}, st.stats.combos), comboLog: st.stats.comboLog.slice(0, 40), best: st.stats.best, leaks: Object.assign({}, st.stats.leaks), leakLog: st.stats.leakLog.map((l) => ({ r: l.r, type: l.type, t: +l.t.toFixed(1), slip: l.slip ? { x: +l.slip.x.toFixed(2), y: +l.slip.y.toFixed(2), z: +l.slip.z.toFixed(2), ally: l.slip.ally } : null, gate: l.gate })), downLog: st.stats.downLog.map((d) => ({ ally: d.ally, t: +d.t.toFixed(1), by: d.by })), slotHeld: Object.assign({}, st.stats.slotHeld), gateT: st.stats.gateT, killed: st.stats.killed, total: st.stats.total, torches: st.stats.torches || 0, torchBy: st.stats.torchLog.reduce((o, l) => { o[l.r] = (o[l.r] || 0) + 1; return o; }, {}), torchLog: st.stats.torchLog.map((l) => ({ r: l.r, x: +l.x.toFixed(2), y: +l.y.toFixed(2) })) };
    for (const a of st.allies) {
      const s = st.stats.allies[a.id];
      sum.allies[a.id] = { slot: a.slot.id, held: s.held, kills: s.kills, assists: s.assists, downs: s.downs, heal: Math.round(s.heal), burnBest: s.burnBest, dmg: Math.round(s.dmg), hp: Math.round(a.hp), maxhp: a.maxhp, holdT: +s.holdT.toFixed(1) };
    }
    return sum;
  }
  function nextAfterWin() {
    const [n, w] = G.waveIdx;
    if (G.replayMode) { G.replayMode = false; G.chron = chronicle(); G.scene = 'ending'; A.music('dawn'); return; }
    const N = D.NIGHTS[n];
    if (w + 1 < N.waves.length) { gotoPlan(n, w + 1); return; }
    // 夜明け
    if (n + 1 < D.NIGHTS.length) { save.night = n + 1; save.wave = 0; storeSave(); showMorning(n); }
    else { save.finished = true; storeSave(); showEnding(); }
  }
  function retryWave() { gotoPlan(G.waveIdx[0], G.waveIdx[1], true); }

  // ---------------- 物語の頁 ----------------
  function showStory(lines, pal, done, o) {
    G.story = { lines: lines.filter(Boolean), i: 0, pal, done, o: o || {}, t: 0 };
    G.scene = 'story';
    A.music(pal === 'dawn' ? 'dawn' : 'plan');
  }
  function advanceStory() {
    const s = G.story;
    if (!s) return;
    if (s.t < 0.25) return;
    A.play('page');
    s.i++; s.t = 0;
    if (s.i >= s.lines.length) { const d = s.done; G.story = null; if (d) d(); }
  }

  // ---------------- 夜明け（砦の中の様子） ----------------
  function nightMvp(n) {
    const N = D.NIGHTS[n];
    const score = {}, slotOf = {};
    for (const w of N.waves) {
      const s = save.waveStats[w.id];
      if (!s) continue;
      for (const id in s.allies) {
        const a = s.allies[id];
        const v = a.held * 1.2 + a.kills + a.assists * 0.7 + a.heal * 0.15;
        score[id] = (score[id] || 0) + v;
        slotOf[id] = slotOf[id] || {};
        slotOf[id][a.slot] = (slotOf[id][a.slot] || 0) + v + 0.01;
      }
    }
    let best = null;
    for (const id in score) if (!best || score[id] > score[best]) best = id;
    if (!best) best = 'ilza';
    const so = slotOf[best] || {};
    let slot = null;
    for (const s in so) if (!slot || so[s] > so[slot]) slot = s;
    return { id: best, slot: slot || 's_land' };
  }
  function slotName(id) { const s = D.SLOTS.find((x) => x.id === id); return s ? s.name : ''; }
  function showMorning(n) {
    const mvp = nightMvp(n);
    const a = D.ALLIES[mvp.id];
    const kidPose = { ilza: '「ここは通さない！」と、鍋のふたを盾にして', ruu: '「燃えちゃえー！」と、枝を杖にしてふりまわしながら', kai: '小枝の弓で「見えてる」と、片目をつぶって', dugan: '物干しの竿を槍にして「どっせい！」と', mel: 'ぬいぐるみに包帯を巻きながら「倒れさせないから」と' }[mvp.id];
    const lines = D.STORY.mornings.find((m) => m.after === n + 1).lines.map((l) => l
      .replace('{mvpLine}', 'ゆうべの' + slotName(mvp.slot) + 'は、' + a.name + 'が守った。村の子ノノが、その場所を見上げている。')
      .replace('{kidLine}', '村の子ノノが、' + slotName(mvp.slot) + 'で、' + kidPose + '遊んでいる。ゆうべの' + a.name + 'のまねだ。'));
    G.morning = { n, mvp };
    showStory(lines, 'dawn', () => showGift(n), { morning: true });
  }
  function showGift(n) {
    const gift = D.GIFTS.find((g) => g.after === n + 1);
    if (!gift) { startNight(n + 1); return; }
    G.scene = 'gift'; G.giftDef = gift; G.giftHover = null;
  }
  function chooseGift(opt) {
    save.up[opt.id] = true;
    save.gifts[G.giftDef.after] = opt.id;
    storeSave();
    A.play('combo');
    G.morning = null;
    startNight(G.giftDef.after);
  }

  // ---------------- 結末 ----------------
  function chronicle() {
    const per = {}, slotTotal = {};
    let bestBurn = null, ogre = null;
    for (const N of D.NIGHTS) for (const w of N.waves) {
      const s = save.waveStats[w.id];
      if (!s) continue;
      for (const id in s.allies) {
        const a = s.allies[id];
        const p = per[id] || (per[id] = { held: 0, kills: 0, assists: 0, heal: 0, downs: 0, slots: {}, waves: 0 });
        p.held += a.held; p.kills += a.kills; p.assists += a.assists; p.heal += a.heal; p.downs += a.downs; p.waves++;
        p.slots[a.slot] = (p.slots[a.slot] || 0) + a.held + a.kills * 0.5 + 0.1;
        slotTotal[a.slot] = slotTotal[a.slot] || {};
        slotTotal[a.slot][id] = (slotTotal[a.slot][id] || 0) + a.held;
        if (id === 'ilza' && a.holdT > 0 && (!ogre || a.holdT > ogre.t)) ogre = { t: a.holdT, slot: a.slot, wave: w.id };
      }
      if (s.best && (!bestBurn || s.best.n > bestBurn.n)) bestBurn = Object.assign({ wave: w.id }, s.best);
    }
    // いちばん多く受け止めた持ち場と、そこを守った人
    let hero = null;
    for (const sl in slotTotal) for (const id in slotTotal[sl]) {
      if (!hero || slotTotal[sl][id] > hero.n) hero = { slot: sl, id, n: slotTotal[sl][id] };
    }
    for (const id in per) {
      let s = null;
      for (const k in per[id].slots) if (!s || per[id].slots[k] > per[id].slots[s]) s = k;
      per[id].main = s;
    }
    return { per, hero, bestBurn, ogre };
  }
  function showEnding() {
    G.chron = chronicle();
    const h = G.chron.hero || { slot: 's_land', id: 'ilza', n: 0 };
    const lines = D.STORY.ending.concat([
      'ノノは最後にふりかえって、' + slotName(h.slot) + 'を指さした。「あそこは、' + allyName(h.id) + 'が守ってくれたんだよ」',
    ]);
    G.melt = 5;
    showStory(lines, 'dawn', () => { G.scene = 'ending'; G.endT = 0; A.music('dawn'); }, { morning: true, ending: true });
  }

  // ---------------- 演出（迎撃中の出来事） ----------------
  function addTicker(s, col) { G.ticker.unshift({ s, col: col || '#f4eee0', t: 0 }); if (G.ticker.length > 5) G.ticker.length = 5; }
  function addText(wx, wy, wz, s, o) {
    o = o || {};
    G.texts.push({ wx, wy, wz, s, t: 0, life: o.life || 1.1, col: o.col || '#ffffff', size: o.size || 16, rise: o.rise == null ? 18 : o.rise, bold: o.bold !== false, big: o.big });
  }
  function bubble(a, s, life) {
    if (!a) return;
    const k = a.id;
    if (G.said[k] && G.time - G.said[k] < 5) return;
    G.said[k] = G.time;
    G.bubbles = G.bubbles.filter((b) => b.a !== a);
    G.bubbles.push({ a, s, t: 0, life: life || 2.2 });
  }
  function fx(o) { o.t = 0; G.fx.push(o); }

  function onEvent(e) {
    const st = G.st;
    switch (e.type) {
      case 'block': {
        const a = e.a, en = e.e;
        fx({ kind: 'clash', x: (a.x + en.x) / 2, y: (a.y + en.y) / 2, z: Math.max(a.z, en.z) + 0.9, life: 0.35, col: D.ALLIES[a.id].color });
        A.play('block');
        if (e.first) { addText(a.x, a.y, a.z + 2.6, '受け止め！', { col: D.ALLIES[a.id].color, size: 17 }); bubble(a, a.base.lines.first || a.base.lines.hold); }
        if (en.def.big) { addText(a.x, a.y, a.z + 3.0, '大鬼を止めた！', { col: '#ffe080', size: 20, life: 1.6 }); addTicker(a.base.name + 'が大鬼を受け止めた', '#ffe080'); G.shake = 0.6; }
        break;
      }
      case 'slip': {
        addText(e.e.x, e.e.y, e.e.z + 2.2, 'すり抜けた', { col: '#ff8a7a', size: 14 });
        break;
      }
      case 'alert': {
        G.alerts = G.alerts || [];
        fx({ kind: 'alert', a: e.a, life: 0.7 });
        A.play('alert');
        break;
      }
      case 'cast': A.play('cast'); break;
      case 'fireball': break;
      case 'explode': {
        fx({ kind: 'boom', x: e.x, y: e.y, z: e.z, r: e.radius, life: 0.6, n: e.n });
        for (let i = 0; i < 10 + e.n * 3; i++) {
          const ang = (i / (10 + e.n * 3)) * Math.PI * 2 + Math.random() * 0.3;
          const sp = 0.6 + Math.random() * 1.6;
          fx({ kind: 'spark', x: e.x, y: e.y, z: e.z + 0.3, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, vz: 1.5 + Math.random() * 2, life: 0.5 + Math.random() * 0.4, col: Math.random() < 0.5 ? '#ffb040' : '#ff6030' });
        }
        A.play('boom', e.n);
        if (e.n >= 2) addText(e.x, e.y, e.z + 2.2, '×' + e.n, { col: e.n >= 4 ? '#ffe070' : '#ffb070', size: 18 + Math.min(4, e.n) * 4, life: 1.3, big: true });
        if (e.n >= 3) G.shake = Math.max(G.shake, 0.25 + e.n * 0.08);
        if (e.n >= 4) bubble(e.a, e.a.base.lines.big);
        break;
      }
      case 'shoot': A.play('bow'); fx({ kind: 'tracer', a: e.a, e: e.e, life: 0.22, col: D.ALLIES[e.a.id].color }); break;
      case 'thrust': fx({ kind: 'thrust', a: e.a, e: e.e, back: e.back, life: 0.25 }); A.play('thrust'); break;
      case 'hit': {
        if (e.how === 'slash') A.play('slash');
        break;
      }
      case 'kill': {
        A.play('kill');
        fx({ kind: 'puff', x: e.e.x, y: e.e.y, z: e.e.z, life: 0.5 });
        break;
      }
      case 'hurt': {
        A.play('hurt');
        addText(e.a.x, e.a.y, e.a.z + 2.2, '-' + Math.round(e.dmg), { col: '#ff6a5a', size: 15, life: 0.8, rise: 12 });
        break;
      }
      case 'eshoot': break;
      case 'aim': {
        if (!G.said['aim' + e.a.id] || G.time - G.said['aim' + e.a.id] > 6) {
          G.said['aim' + e.a.id] = G.time;
          addText(e.e.x, e.e.y, e.e.z + 2.2, allyName(e.a.id) + 'をねらう', { col: '#ff9a8a', size: 14, life: 1.2 });
        }
        break;
      }
      case 'heal': {
        A.play('heal');
        addText(e.b.x, e.b.y, e.b.z + 2.2, '+' + Math.round(e.v), { col: '#9aff9a', size: 15, life: 0.9, rise: 14 });
        fx({ kind: 'healfx', b: e.b, life: 0.6 });
        break;
      }
      case 'barrier': A.play('barrier'); fx({ kind: 'shieldfx', b: e.b, life: 0.9 }); addText(e.b.x, e.b.y, e.b.z + 2.6, '守りの光', { col: '#ffe890', size: 15 }); break;
      case 'assist': {
        const k = e.a.id + '>' + e.b.id;
        if (G.assistGate[k] && G.time - G.assistGate[k] < 2.2) break;
        G.assistGate[k] = G.time;
        fx({ kind: 'arc', a: e.a, b: e.b, life: 0.9, col: D.ALLIES[e.a.id].color });
        addText(e.b.x, e.b.y, e.b.z + 3.0, '援護', { col: D.ALLIES[e.a.id].color, size: 14, life: 0.9, rise: 10 });
        A.play('assist');
        break;
      }
      case 'combo': {
        const C = D.COMBOS.find((c) => c.id === e.id);
        if (!C) break;
        const first = !save.combos[e.id] && !G.firstCombo[e.id];
        G.firstCombo[e.id] = true;
        const cnt = (G.comboCount[e.id] = (G.comboCount[e.id] || 0) + 1);
        const pair = C.who.filter((w) => w !== '*').map(allyName).join('×');
        const toName = e.to && C.who.indexOf('*') >= 0 ? '×' + allyName(e.to) : '';
        const big = ['burn_ilza', 'burn_dugan', 'gate_burn', 'big_burn', 'ogre_hold', 'barrier', 'cover_ruu'].indexOf(e.id) >= 0;
        // 見出しは、その陣で初めての連携と大きな連携だけ（何度も出ると邪魔になる）
        if (first || cnt === 1 || (big && G.time - (G.lastBanner || 0) > 4)) {
          G.banner = { s: C.name, sub: (first ? '新しい連携！　' : '') + pair + toName, t: 0, life: 2.0, first, x: e.x, y: e.y, z: e.z };
          G.lastBanner = G.time;
          addTicker('連携「' + C.name + '」' + pair + toName, '#ffe070');
          A.play(first ? 'newcombo' : 'combo');
        } else {
          addText(e.x, e.y, e.z + 3.2, C.name, { col: '#ffe070', size: 14, life: 1.0, rise: 10 });
        }
        if (e.id === 'cover_ruu') { const k = st.allies.find((a) => a.id === 'kai'); bubble(k, D.ALLIES.kai.lines.cover); }
        if (e.id === 'barrier') { const m = st.allies.find((a) => a.id === 'mel'); bubble(m, D.ALLIES.mel.lines.save); }
        break;
      }
      case 'gatehit': A.play('gatehit'); break;
      case 'gatebreak': {
        A.play('gatebreak'); G.shake = 0.8;
        addText(D.GATE.x + 0.6, D.GATE.y, 4.6, '門が破られた！', { col: '#ffb040', size: 22, life: 2.0, big: true });
        addTicker('門が破られた！', '#ffb040');
        for (let i = 0; i < 14; i++) fx({ kind: 'spark', x: 12.0, y: 5.5 + (Math.random() - 0.5), z: 3.5 + Math.random(), vx: 1 + Math.random() * 1.5, vy: (Math.random() - 0.5) * 2, vz: 1 + Math.random() * 2, life: 0.7, col: '#8a6040' });
        break;
      }
      case 'leak': {
        A.play('leak'); G.doorFlash = 1; G.shake = Math.max(G.shake, 0.4);
        const lt = G.texts.find((t) => t.leak && t.t < 1.0);
        if (lt) { lt.leak += e.e.def.leak; lt.s = '灯が' + lt.leak + 'つ消えた'; lt.t = 0; }
        else { addText(D.DOOR.x, D.DOOR.y, 7.5, '灯が消えた', { col: '#ff7060', size: 18, life: 1.6 }); G.texts[G.texts.length - 1].leak = e.e.def.leak; }
        addTicker(D.ROUTES[e.e.r].name + 'から' + e.e.def.name + 'が本丸に！', '#ff8070');
        break;
      }
      case 'down': {
        A.play('down'); G.shake = Math.max(G.shake, 0.5);
        addTicker(e.a.base.name + 'が倒れた' + (e.by ? '（' + D.ENEMIES[e.by].name + '）' : ''), '#ff8070');
        G.said[e.a.id] = 0;
        bubble(e.a, e.a.base.lines.down, 2.6);
        break;
      }
      case 'interrupt': addText(e.a.x, e.a.y, e.a.z + 2.4, '詠唱できない！', { col: '#ff9a8a', size: 14 }); break;
      case 'torch': {
        A.play('leak'); G.doorFlash = 1; G.shake = Math.max(G.shake, 0.3);
        fx({ kind: 'torch', x: e.e.x, y: e.e.y, z: e.e.z, life: 0.7 });
        addText(e.e.x, e.e.y, e.e.z + 2.6, '松明！', { col: '#ff9a40', size: 17, life: 1.2 });
        addTicker('城壁の内側の' + e.e.def.name + 'が、本丸へ松明を投げこんだ', '#ff9a60');
        break;
      }
      case 'flee': addTicker('残った' + e.n + '体は、退いていった', '#c8c0d8'); break;
      case 'end': break;
    }
  }

  // ---------------- 描画：世界 ----------------
  function unitsFromSim(st) {
    const us = [];
    for (const a of st.allies) {
      us.push({ sprite: a.id, x: a.x, y: a.y, z: a.z, face: a.face, atk: a.atkT, white: a.hurtT, down: a.down, ring: D.ALLIES[a.id].color, ringAlpha: 0.9, phase: a.id.length * 0.7, ally: a });
    }
    for (const e of st.enemies) {
      let alpha = null;
      if (e.dead) { const k = (st.t - e.deadT) / 0.35; if (k > 1) continue; alpha = 1 - k; }
      if (e.out) { const k = (st.t - e.deadT) / 0.3; if (k > 1) continue; alpha = 1 - k; }
      us.push({ sprite: e.type, x: e.x, y: e.y, z: e.z, face: e.face, walking: e.mode === 'walk', atk: e.atkT, white: e.hitT, alpha, phase: e.uid * 0.37, fly: !!e.def.fly, en: e, noShadow: !!e.def.fly, ring: e.def.fly ? null : '#ff4a3a', ringAlpha: 0.5, lift: e.def.fly ? Math.round(Math.sin(G.time * 5 + e.uid) * 1.5) : 0 });
    }
    return us;
  }
  function unitsFromPlan() {
    const us = [];
    for (const id of G.wave.allies) {
      const sid = G.pl[id];
      if (!sid) continue;
      const s = S.slots[sid];
      const face = faceForSlot(sid);
      const lifted = G.drag && G.drag.ally === id && G.drag.moved;
      us.push({ sprite: id, x: s.wx, y: s.wy, z: s.wz, face, ring: D.ALLIES[id].color, ringAlpha: G.sel === id ? 1 : 0.7, phase: id.length, alpha: lifted ? 0.35 : null, lift: G.sel === id ? Math.round(1 + Math.sin(G.time * 6)) : 0 });
    }
    // 置こうとしている仲間の半透明の姿
    if (G.hoverSlot && (G.sel || (G.drag && G.drag.moved))) {
      const id = G.drag && G.drag.moved ? G.drag.ally : G.sel;
      if (G.pl[id] !== G.hoverSlot) {
        const s = S.slots[G.hoverSlot];
        us.push({ sprite: id, x: s.wx, y: s.wy, z: s.wz, face: faceForSlot(G.hoverSlot), alpha: 0.55, ring: D.ALLIES[id].color, phase: 0 });
      }
    }
    return us;
  }
  const faceCache = {};
  function faceForSlot(sid) {
    const key = G.wave.id + sid;
    if (faceCache[key]) return faceCache[key];
    const st = S.create({ wave: G.wave, placement: { [G.wave.allies[0]]: sid }, keepEvents: false });
    faceCache[key] = st.allies[0] ? st.allies[0].face : [1, 1];
    return faceCache[key];
  }

  function drawWorldLayer() {
    const pal = (G.scene === 'story' && G.story && G.story.pal === 'dawn') || G.scene === 'gift' || G.scene === 'ending' ? 'dawn' : 'night';
    let units = [];
    let lamps = 5, lampsMax = 5, gate = null;
    if (G.st && (G.scene === 'battle' || G.scene === 'result')) {
      units = unitsFromSim(G.st);
      lamps = G.st.lamps; lampsMax = G.st.lampsMax; gate = G.st.gate;
    } else if (G.scene === 'plan') {
      units = unitsFromPlan();
      lampsMax = 5 + (save.up.lamp ? 1 : 0); lamps = lampsMax;
      gate = { hp: 1, max: 1, broken: false };
    } else if (pal === 'dawn') {
      units = morningUnits();
      lampsMax = 5 + (save.up.lamp ? 1 : 0); lamps = lampsMax;
    }
    const M = {
      pal, time: G.time, units, gate, lamps, lampsMax, melt: G.melt || 0, shake: G.shake, doorFlash: G.doorFlash,
      morning: pal === 'dawn', night: (G.morning ? G.morning.n + 1 : 0), doorOpen: pal === 'dawn',
      fxWorld: drawFxWorld, overlay: G.scene === 'plan' ? drawPlanOverlay : (G.scene === 'battle' || G.scene === 'result' ? drawBattleOverlay : null),
    };
    R.drawWorld(wg, M);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(wcv, 0, 0, W, H);
  }

  function morningUnits() {
    const us = [];
    const n = G.morning ? G.morning.n + 1 : 5;
    const ending = G.scene === 'ending' || (G.story && G.story.o.ending);
    // 村の人たち（夜ごとに増える）
    const ppl = [
      ['elder', 9.2, 3.4, [1, 1]], ['woman', 9.9, 2.9, [0, 1]], ['woman', 7.6, 6.2, [1, 0]],
      ['elder', 4.2, 3.6, [1, 0]], ['woman', 8.6, 2.2, [1, 1]], ['woman', 10.2, 7.6, [-1, 0]], ['elder', 7.4, 8.2, [0, -1]],
    ];
    const count = ending ? ppl.length : Math.min(ppl.length, 2 + n);
    for (let i = 0; i < count; i++) {
      const p = ppl[i];
      us.push({ sprite: p[0], x: p[1], y: p[2], z: S.zAt(p[1], p[2]), face: p[3], phase: i, walking: false });
    }
    // ノノ：ゆうべいちばん働いた仲間の持ち場で、まねをしている
    if (G.morning && !ending) {
      const s = S.slots[G.morning.mvp.slot];
      const hop = Math.abs(Math.sin(G.time * 4)) * 2;
      us.push({ sprite: 'kid', x: s.wx, y: s.wy, z: s.wz, face: faceForSlotSafe(G.morning.mvp.slot), lift: Math.round(hop), atk: (G.time % 1.2) < 0.22 ? (G.time % 1.2) : 0, phase: 0 });
    } else {
      us.push({ sprite: 'kid', x: 4.4, y: 2.4, z: 5, face: [1, 1], phase: 0, lift: Math.round(Math.abs(Math.sin(G.time * 5)) * 2) });
    }
    // 仲間は本丸の前で休む
    const rest = [['ilza', 4.5, 3.5], ['ruu', 5.4, 2.6], ['kai', 6.2, 3.3], ['dugan', 3.6, 4.4], ['mel', 5.0, 1.6]];
    const have = ending ? 5 : (n >= 3 ? 5 : (n >= 2 ? 4 : 3));
    const order = ['ilza', 'ruu', 'kai', 'dugan', 'mel'];
    for (const r of rest) {
      if (order.indexOf(r[0]) >= have) continue;
      us.push({ sprite: r[0], x: r[1], y: r[2], z: 5, face: [1, 1], phase: r[1], ring: null });
    }
    return us;
  }
  function faceForSlotSafe(sid) {
    const s = S.slots[sid];
    const p = { x: 8.5, y: 6 };
    const fx2 = p.x - s.wx, fy2 = p.y - s.wy, l = Math.hypot(fx2, fy2) || 1;
    return [fx2 / l, fy2 / l];
  }

  // 世界の上の演出（640×360 の座標）
  function drawFxWorld(g) {
    const st = G.st;
    // 詠唱の輪・ねらい
    if (st && (G.scene === 'battle' || G.scene === 'result')) {
      for (const a of st.allies) {
        if (a.down) continue;
        if (a.cast) {
          const p = R.iso(a.x, a.y, a.z);
          const k = 1 - a.cast.t / a.cast.T;
          g.strokeStyle = 'rgba(255,140,60,0.9)'; g.lineWidth = 1;
          g.beginPath(); g.ellipse(p.x, p.y + 1, 9, 4.5, 0, G.time * 6, G.time * 6 + Math.PI * 1.6); g.stroke();
          const q = R.iso(a.cast.x, a.cast.y, a.cast.z);
          const rr = a.def.radius * 16;
          g.strokeStyle = 'rgba(255,90,40,0.95)';
          g.beginPath(); g.ellipse(q.x, q.y, rr, rr / 2, 0, 0, Math.PI * 2); g.stroke();
          g.fillStyle = 'rgba(255,90,40,' + (0.12 + 0.25 * k).toFixed(2) + ')';
          g.beginPath(); g.ellipse(q.x, q.y, rr * k, rr * k / 2, 0, 0, Math.PI * 2); g.fill();
        } else if (a.aim && S.alive(a.aim) && a.def.kind === 'mage') {
          const q = R.iso(a.aim.x, a.aim.y, a.aim.z);
          const rr = a.def.radius * 16;
          g.setLineDash([2, 3]); g.strokeStyle = 'rgba(255,150,90,0.55)';
          g.beginPath(); g.ellipse(q.x, q.y, rr, rr / 2, 0, 0, Math.PI * 2); g.stroke();
          g.setLineDash([]);
        }
      }
      // 飛び道具
      for (const p of st.projs) {
        const k = Math.min(1, p.t / p.T);
        let tx, ty, tz;
        if (p.kind === 'fire') { tx = S.alive(p.target) ? p.target.x : p.tx; ty = S.alive(p.target) ? p.target.y : p.ty; tz = (S.alive(p.target) ? p.target.z : p.tz) + 0.5; }
        else { tx = p.target.x; ty = p.target.y; tz = p.target.z + 0.9; }
        const x = p.x0 + (tx - p.x0) * k, y = p.y0 + (ty - p.y0) * k, z = p.z0 + (tz - p.z0) * k + Math.sin(k * Math.PI) * (p.kind === 'fire' ? 1.2 : 0.6);
        const s = R.iso(x, y, z);
        if (p.kind === 'fire') {
          g.fillStyle = 'rgba(255,120,40,0.5)'; g.beginPath(); g.arc(s.x, s.y, 4, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#ffe080'; g.beginPath(); g.arc(s.x, s.y, 2, 0, Math.PI * 2); g.fill();
        } else {
          const k2 = Math.max(0, k - 0.22);
          const x2 = p.x0 + (tx - p.x0) * k2, y2 = p.y0 + (ty - p.y0) * k2, z2 = p.z0 + (tz - p.z0) * k2 + Math.sin(k2 * Math.PI) * 0.6;
          const s2 = R.iso(x2, y2, z2);
          g.strokeStyle = p.kind === 'arrow' ? '#f8f4d0' : '#ff7060'; g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(s2.x, s2.y); g.lineTo(s.x, s.y); g.stroke();
          g.fillStyle = '#ffffff'; g.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 2, 2);
        }
      }
    }
    for (const f of G.fx) {
      const k = f.t / f.life;
      if (f.kind === 'boom') {
        const p = R.iso(f.x, f.y, f.z);
        const rr = f.r * 16 * (0.5 + k * 0.7);
        g.save(); g.globalCompositeOperation = 'lighter';
        const gl = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 1.6);
        gl.addColorStop(0, 'rgba(255,200,100,' + (0.8 * (1 - k)).toFixed(2) + ')'); gl.addColorStop(1, 'rgba(255,80,20,0)');
        g.fillStyle = gl; g.beginPath(); g.ellipse(p.x, p.y - 2, rr * 1.6, rr * 1.0, 0, 0, Math.PI * 2); g.fill();
        g.restore();
        g.strokeStyle = 'rgba(255,220,140,' + (1 - k).toFixed(2) + ')'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(p.x, p.y, rr, rr / 2, 0, 0, Math.PI * 2); g.stroke();
      } else if (f.kind === 'spark') {
        const tt = f.t;
        const p = R.iso(f.x + f.vx * tt, f.y + f.vy * tt, f.z + f.vz * tt - 6 * tt * tt);
        g.fillStyle = f.col; g.globalAlpha = 1 - k; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); g.globalAlpha = 1;
      } else if (f.kind === 'puff') {
        const p = R.iso(f.x, f.y, f.z + 0.6 + k);
        g.fillStyle = 'rgba(180,170,200,' + (0.5 * (1 - k)).toFixed(2) + ')';
        g.beginPath(); g.arc(p.x, p.y, 3 + k * 5, 0, Math.PI * 2); g.fill();
      } else if (f.kind === 'clash') {
        const p = R.iso(f.x, f.y, f.z);
        g.strokeStyle = 'rgba(255,255,220,' + (1 - k).toFixed(2) + ')'; g.lineWidth = 1;
        const r = 2 + k * 6;
        for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + 0.6; g.beginPath(); g.moveTo(p.x + Math.cos(an) * r * 0.4, p.y + Math.sin(an) * r * 0.4); g.lineTo(p.x + Math.cos(an) * r, p.y + Math.sin(an) * r); g.stroke(); }
      } else if (f.kind === 'torch') {
        const q = Math.min(1, k * 1.2);
        const x = f.x + (D.DOOR.x - f.x) * q, y = f.y + (D.DOOR.y - f.y) * q, z = f.z + 1 + (6.5 - f.z - 1) * q + Math.sin(q * Math.PI) * 3;
        const p = R.iso(x, y, z);
        g.fillStyle = '#ffb040'; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
        g.fillStyle = 'rgba(255,120,40,0.5)'; g.beginPath(); g.arc(p.x, p.y, 4, 0, Math.PI * 2); g.fill();
      } else if (f.kind === 'tracer') {
        if (!f.a || !f.e) continue;
        const p0 = R.iso(f.a.x, f.a.y, f.a.z + 1.1), p1 = R.iso(f.e.x, f.e.y, f.e.z + 0.8);
        g.strokeStyle = f.col; g.globalAlpha = 0.55 * (1 - k); g.lineWidth = 1;
        g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
        g.globalAlpha = 1;
      } else if (f.kind === 'thrust') {
        if (!f.a) continue;
        const p0 = R.iso(f.a.x, f.a.y, f.a.z + 0.9);
        const tgt = f.back || f.e;
        const p1 = R.iso(tgt.x, tgt.y, tgt.z + 0.9);
        g.strokeStyle = 'rgba(240,240,255,' + (1 - k).toFixed(2) + ')'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
      } else if (f.kind === 'arc') {
        const p0 = R.iso(f.a.x, f.a.y, f.a.z + 1.6), p1 = R.iso(f.b.x, f.b.y, f.b.z + 1.6);
        const mx = (p0.x + p1.x) / 2, my = Math.min(p0.y, p1.y) - 18;
        g.strokeStyle = f.col; g.globalAlpha = 0.9 * (1 - k); g.lineWidth = 1.5;
        g.setLineDash([3, 2]);
        g.beginPath(); g.moveTo(p0.x, p0.y); g.quadraticCurveTo(mx, my, p1.x, p1.y); g.stroke();
        g.setLineDash([]); g.globalAlpha = 1;
        const q = Math.min(1, k * 1.6);
        const bx = (1 - q) * (1 - q) * p0.x + 2 * (1 - q) * q * mx + q * q * p1.x, by = (1 - q) * (1 - q) * p0.y + 2 * (1 - q) * q * my + q * q * p1.y;
        g.fillStyle = '#ffffff'; g.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 3);
      } else if (f.kind === 'healfx') {
        const p = R.iso(f.b.x, f.b.y, f.b.z + 0.5 + k * 1.5);
        g.fillStyle = 'rgba(150,255,150,' + (1 - k).toFixed(2) + ')';
        g.fillRect(Math.round(p.x) - 4, Math.round(p.y), 1, 2); g.fillRect(Math.round(p.x) + 3, Math.round(p.y) - 3, 1, 2); g.fillRect(Math.round(p.x), Math.round(p.y) - 6, 1, 2);
      } else if (f.kind === 'shieldfx') {
        const p = R.iso(f.b.x, f.b.y, f.b.z + 1);
        g.strokeStyle = 'rgba(255,240,150,' + (1 - k).toFixed(2) + ')';
        g.beginPath(); g.arc(p.x, p.y, 10 + k * 3, 0, Math.PI * 2); g.stroke();
      }
    }
    // 守りの光（続いている間）
    if (st) for (const a of st.allies) if (a.barrier > 0 && !a.down) {
      const p = R.iso(a.x, a.y, a.z + 1);
      g.strokeStyle = 'rgba(255,240,150,0.6)'; g.beginPath(); g.arc(p.x, p.y, 10, 0, Math.PI * 2); g.stroke();
    }
  }

  // 迎撃中の重ね描き（体力と受け止めの印）
  function drawBattleOverlay(g) {
    const st = G.st;
    for (const a of st.allies) {
      const p = R.iso(a.x, a.y, a.z);
      const top = p.y - 25;
      if (a.down) continue;
      // 体力
      const w = 14, r = a.hp / a.maxhp;
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(Math.round(p.x - w / 2) - 1, top - 1, w + 2, 4);
      g.fillStyle = r > 0.5 ? '#7adc6a' : (r > 0.25 ? '#e8c040' : '#ff5a4a');
      g.fillRect(Math.round(p.x - w / 2), top, Math.max(1, Math.round(w * r)), 2);
      // 受け止めの枠（埋まった数）
      const cap = a.cap, ld = S.load(a);
      if (a.def.kind === 'guard' || a.def.kind === 'spear' || ld > 0) {
        for (let i = 0; i < cap; i++) {
          g.fillStyle = i < ld ? '#ffd860' : 'rgba(255,255,255,0.25)';
          g.fillRect(Math.round(p.x - cap * 2 + i * 4), top - 4, 3, 2);
        }
      }
      // 色の印
      g.fillStyle = D.ALLIES[a.id].color;
      g.fillRect(Math.round(p.x) - 1, top - 8, 3, 3);
    }
    for (const e of st.enemies) {
      if (!S.alive(e) || e.torched || !e.zoneT || e.def.fly || !S.inside(e.x, e.y)) continue;
      const p = R.iso(e.x, e.y, e.z);
      const sz = SP.size(e.type);
      const k = Math.min(1, e.zoneT / D.INSIDE.t);
      const top = p.y - sz.h - 5;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(Math.round(p.x) + 5, top - 1, 3, 8);
      g.fillStyle = k > 0.75 ? '#ff5030' : '#ff9a40';
      const hh = Math.max(1, Math.round(6 * k));
      g.fillRect(Math.round(p.x) + 6, top + 6 - hh, 1, hh);
      if (k > 0.75 && Math.floor(G.time * 8) % 2) { g.fillStyle = '#ffe080'; g.fillRect(Math.round(p.x) + 6, top - 2, 1, 1); }
    }
    for (const e of st.enemies) {
      if (!S.alive(e) || e.hp >= e.maxhp) continue;
      const p = R.iso(e.x, e.y, e.z);
      const sz = SP.size(e.type);
      const top = p.y - sz.h - 1 + (e.def.fly ? 0 : 2);
      const w = e.def.big ? 18 : 10;
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(Math.round(p.x - w / 2) - 1, top - 1, w + 2, 3);
      g.fillStyle = '#ff7a5a'; g.fillRect(Math.round(p.x - w / 2), top, Math.max(1, Math.round(w * e.hp / e.maxhp)), 1);
    }
  }

  // 作戦の重ね描き：道・止める所・届く所・連携の線・持ち場の旗
  function drawPlanOverlay(g) {
    const an = G.an;
    const wave = G.wave;
    const focus = G.drag && G.drag.moved ? G.drag.ally : G.sel;
    // 届く範囲（選んだ仲間、またはマウスの下の仲間）
    const showId = focus || (G.hoverSlot && allyAtSlot(G.hoverSlot));
    const showSlot = focus ? (G.hoverSlot || G.pl[focus]) : (showId ? G.pl[showId] : null);
    drawInside(g);
    if (showId && showSlot) drawReach(g, showId, showSlot);
    // 道
    for (const r in an.routes) {
      const R0 = S.routes[r], info = an.routes[r];
      const col = RCOL[r];
      // 予兆の足跡
      const step = 0.55;
      const off = (G.time * 1.6) % step;
      for (let d = off; d < R0.len - 0.3; d += step) {
        const p = R0.at(d);
        const s = R.iso(p.x, p.y, p.z + (R0.fly ? 0 : 0.05));
        const covered = coveredBy(info, d);
        g.fillStyle = col;
        g.globalAlpha = (d < (info.block ? info.block.d : 1e9) || R0.fly) ? 0.95 : 0.35;
        const q = R.iso(p.x + p.dx * 0.18, p.y + p.dy * 0.18, p.z);
        const q2 = R.iso(p.x - p.dy * 0.12, p.y + p.dx * 0.12, p.z);
        g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(s.x + (s.x - q2.x), s.y + (s.y - q2.y)); g.lineTo(q2.x, q2.y); g.closePath(); g.fill();
        if (covered.length) {
          for (let i = 0; i < covered.length; i++) {
            g.fillStyle = D.ALLIES[covered[i]].color;
            g.fillRect(Math.round(s.x) - 4 + i * 3, Math.round(s.y) + 3, 2, 2);
          }
        }
        g.globalAlpha = 1;
      }
      // 止める所
      if (info.block) {
        const b = info.block;
        const s = R.iso(b.x, b.y, b.z);
        drawShieldIcon(g, s.x, s.y - 4, D.ALLIES[b.ally].color);
      } else if (!R0.fly) {
        // 門が足止めするだけの道
        const end = R.iso(D.DOOR.x + 0.4, D.DOOR.y + 0.3, 5);
        g.fillStyle = '#ff5a4a';
        g.font = 'bold 10px ' + FONT;
      }
      if (info.gateD) {
        const p = R0.at(info.gateD - 0.2);
        const s = R.iso(p.x, p.y, p.z);
        drawGateIcon(g, s.x + 4, s.y - 6);
      }
    }
    // 前回の記録
    if (G.showLast && save.last[wave.id]) drawLastMarks(g, save.last[wave.id]);
    // 連携の予感
    for (const l of an.links) {
      const pa = posOfAlly(l.a), pb = l.b === 'gate' ? { x: 12.2, y: 5.5, z: 3 } : posOfAlly(l.b);
      if (!pa || !pb) continue;
      const p0 = R.iso(pa.x, pa.y, pa.z + 1.2), p1 = R.iso(pb.x, pb.y, pb.z + 1.2);
      g.strokeStyle = 'rgba(255,230,140,0.85)'; g.lineWidth = 1;
      g.setLineDash([2, 2]); g.lineDashOffset = -G.time * 8;
      g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
      g.setLineDash([]);
    }
    // 持ち場の旗
    for (const sl of D.SLOTS) {
      const s = S.slots[sl.id];
      if (allyAtSlot(sl.id)) continue;
      const p = R.iso(s.wx, s.wy, s.wz);
      const hov = G.hoverSlot === sl.id;
      const active = !!focus;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(p.x, p.y + 1, 5, 2.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = hov ? '#ffffff' : (active ? 'rgba(255,240,200,0.95)' : 'rgba(255,240,200,0.55)');
      g.lineWidth = 1;
      g.beginPath(); g.ellipse(p.x + 0.5, p.y + 0.5, 7, 3.5, 0, 0, Math.PI * 2); g.stroke();
      // 旗竿と旗
      g.fillStyle = '#d8d0c0'; g.fillRect(Math.round(p.x), Math.round(p.y) - 13, 1, 13);
      const wave2 = Math.sin(G.time * 4 + s.wx) > 0 ? 1 : 0;
      g.fillStyle = hov ? '#ffffff' : (sl.safe ? '#8ab8ff' : '#f0e0b0');
      g.fillRect(Math.round(p.x) + 1, Math.round(p.y) - 13, 5, 3 + wave2);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(Math.round(p.x) + 1, Math.round(p.y) - 11 + wave2, 5, 1);
    }
  }
  function drawInside(g) {
    g.fillStyle = 'rgba(255,70,40,0.10)';
    for (let y = 0; y < D.H; y++) for (let x = 0; x < D.W; x++) {
      if (!S.inside(x + 0.5, y + 0.5)) continue;
      const t = S.tile(x, y);
      const c = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map((q) => R.iso(q[0], q[1], S.zAt(Math.min(q[0], x + 0.999), Math.min(q[1], y + 0.999))));
      g.beginPath(); g.moveTo(c[0].x, c[0].y); for (let i = 1; i < 4; i++) g.lineTo(c[i].x, c[i].y); g.closePath(); g.fill();
    }
  }
  function drawShieldIcon(g, x, y, col) {
    x = Math.round(x); y = Math.round(y);
    g.fillStyle = '#15101c'; g.fillRect(x - 4, y - 5, 9, 9); g.fillRect(x - 3, y + 4, 7, 1); g.fillRect(x - 1, y + 5, 3, 1);
    g.fillStyle = col; g.fillRect(x - 3, y - 4, 7, 7); g.fillRect(x - 2, y + 3, 5, 1); g.fillRect(x, y + 4, 1, 1);
    g.fillStyle = '#ffffff'; g.fillRect(x, y - 3, 1, 5); g.fillRect(x - 2, y - 1, 5, 1);
  }
  function drawGateIcon(g, x, y) {
    x = Math.round(x); y = Math.round(y);
    g.fillStyle = '#15101c'; g.fillRect(x - 4, y - 5, 9, 9);
    g.fillStyle = '#c89050'; g.fillRect(x - 3, y - 4, 7, 7);
    g.fillStyle = '#5a3a20'; g.fillRect(x, y - 4, 1, 7);
  }
  function drawLastMarks(g, last) {
    for (const l of last.leakLog) {
      let p;
      if (l.slip) p = R.iso(l.slip.x, l.slip.y, l.slip.z);
      else continue;
      const x = Math.round(p.x), y = Math.round(p.y) - 3;
      g.strokeStyle = '#ff4a3a'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x - 3, y - 3); g.lineTo(x + 3, y + 3); g.moveTo(x + 3, y - 3); g.lineTo(x - 3, y + 3); g.stroke();
    }
    for (const l of (last.torchLog || [])) {
      const p = R.iso(l.x, l.y, S.zAt(l.x, l.y));
      g.fillStyle = 'rgba(255,140,40,0.9)';
      g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 6, 3, 4);
      g.fillStyle = '#ffe080'; g.fillRect(Math.round(p.x), Math.round(p.y) - 8, 1, 2);
    }
    for (const d of last.downLog) {
      const sid = last.placement[d.ally];
      if (!sid) continue;
      const s = S.slots[sid];
      const p = R.iso(s.wx, s.wy, s.wz);
      g.fillStyle = 'rgba(255,80,60,0.8)';
      g.fillRect(Math.round(p.x) + 6, Math.round(p.y) - 18, 2, 6);
      g.fillRect(Math.round(p.x) + 4, Math.round(p.y) - 16, 6, 2);
    }
  }
  function posOfAlly(id) { const sid = G.pl[id]; if (!sid) return null; const s = S.slots[sid]; return { x: s.wx, y: s.wy, z: s.wz }; }
  function allyAtSlot(sid) { for (const id in G.pl) if (G.pl[id] === sid) return id; return null; }
  function coveredBy(info, d) {
    const out = [];
    for (const id in info.cover) for (const s of info.cover[id]) if (d >= s[0] - 0.05 && d <= s[1] + 0.05) { out.push(id); break; }
    return out;
  }
  function drawReach(g, id, sid) {
    const st = S.allyStats(id, save.up);
    const s = S.slots[sid];
    const k = st.kind;
    g.fillStyle = D.ALLIES[id].color;
    for (let y = 0; y < D.H; y++) for (let x = 0; x < D.W; x++) {
      const t = S.tile(x, y);
      if (!t || t.k === 'v' || t.k === 'K') continue;
      const cx = x + 0.5, cy = y + 0.5, cz = S.zAt(cx, cy);
      const dist = Math.hypot(cx - s.wx, cy - s.wy);
      let ok = false;
      if (k === 'archer' || k === 'mage') ok = dist <= S.reachOf(k, st, s.wz, cz, false) && Math.abs(cz - s.wz) <= 4.5;
      else if (k === 'spear') ok = dist <= st.reach && Math.abs(cz - s.wz) <= 1.6;
      else if (k === 'guard') ok = !s.safe && dist <= 1.15 && Math.abs(cz - s.wz) <= 1.1;
      else if (k === 'healer') ok = dist <= st.range;
      if (!ok) continue;
      const p = R.iso(cx, cy, cz);
      g.globalAlpha = 0.5;
      g.beginPath(); g.moveTo(p.x, p.y - 3); g.lineTo(p.x + 6, p.y); g.lineTo(p.x, p.y + 3); g.lineTo(p.x - 6, p.y); g.closePath(); g.fill();
      g.globalAlpha = 1;
    }
  }

  // ---------------- 描画：画面の文字 ----------------
  function drawWorldTexts() {
    for (const t of G.texts) {
      const k = t.t / t.life;
      const p = toScreen(t.wx, t.wy, t.wz);
      const y = p.y - k * t.rise * 2;
      ctx.globalAlpha = k < 0.75 ? 1 : (1 - k) / 0.25;
      const sz = t.big ? t.size * (k < 0.12 ? 0.7 + k * 2.5 : 1) : t.size;
      text(t.s, p.x, y, { align: 'center', size: Math.round(sz), bold: t.bold, color: t.col, sh: 2 });
      ctx.globalAlpha = 1;
    }
    // 構え（！）
    for (const f of G.fx) {
      if (f.kind !== 'alert' || !f.a || f.a.down) continue;
      const p = toScreen(f.a.x, f.a.y, f.a.z);
      const k = f.t / f.life;
      text('！', p.x + 14, p.y - 52 - Math.sin(k * Math.PI) * 6, { align: 'center', size: 22, bold: true, color: '#ffe070' });
    }
    // 吹き出し
    for (const b of G.bubbles) {
      if (!b.a || (b.a.down && b.t > 0.5 && b.s !== b.a.base.lines.down)) continue;
      // 吹き出しは頭の横に出す（上下に並んだ仲間を隠さないように）
      const p = toScreen(b.a.x, b.a.y, b.a.z);
      ctx.font = font(15, true);
      const w = ctx.measureText(b.s).width + 18;
      const right = p.x < W / 2 + 40;
      const hx = p.x + (right ? 14 : -14), hy = p.y - 44;
      const x = clamp(right ? hx + 10 : hx - 10 - w, 6, W - w - 6), y = hy - 14;
      ctx.globalAlpha = b.t > b.life - 0.3 ? (b.life - b.t) / 0.3 : 1;
      panel(x, y, w, 28, { fill: 'rgba(250,246,236,0.95)', stroke: D.ALLIES[b.a.id].color, lw: 2, r: 8 });
      ctx.fillStyle = 'rgba(250,246,236,0.95)';
      const ex = right ? x + 1 : x + w - 1;
      ctx.beginPath(); ctx.moveTo(ex, y + 9); ctx.lineTo(ex, y + 19); ctx.lineTo(hx, hy + 4); ctx.closePath(); ctx.fill();
      text(b.s, x + w / 2, y + 19, { align: 'center', size: 15, bold: true, color: '#2a2030', shadow: false });
      ctx.globalAlpha = 1;
    }
    // 連携の見出し
    if (G.banner) {
      const b = G.banner;
      const k = b.t / b.life;
      // 見出しは画面の上のまんなかに固定（戦いの場面を隠さない）
      const y = 132 - k * 10;
      const x = W / 2 + 270;
      ctx.globalAlpha = k < 0.8 ? 1 : (1 - k) / 0.2;
      const sc = k < 0.1 ? 0.6 + k * 4 : 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      panel(-190, -34, 380, 62, { fill: 'rgba(30,18,10,0.86)', stroke: '#ffd860', lw: 2, r: 12 });
      text(b.s, 0, 2, { align: 'center', size: 30, bold: true, color: '#ffe070' });
      text(b.sub, 0, 22, { align: 'center', size: 14, bold: true, color: b.first ? '#ffffff' : '#e8d8b0' });
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // ---------------- 画面ごとの描画 ----------------
  function drawTitle() {
    G.melt = 0;
    drawWorldLayer();
    ctx.fillStyle = 'rgba(8,6,20,0.45)'; ctx.fillRect(0, 0, W, H);
    // 題名（英字）と副題
    ctx.save();
    ctx.font = 'bold 92px "Palatino Linotype", "Book Antiqua", Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const sp = 10;
    if ('letterSpacing' in ctx) ctx.letterSpacing = sp + 'px';
    const tx = W / 2 + ('letterSpacing' in ctx ? sp / 2 : 0);
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText('STAIRWARD', tx + 4, 244 + 4);
    const gr = ctx.createLinearGradient(0, 176, 0, 246);
    gr.addColorStop(0, '#fff2cc'); gr.addColorStop(1, '#eaa850');
    ctx.fillStyle = gr; ctx.fillText('STAIRWARD', tx, 244);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,224,160,0.55)';
    ctx.fillRect(W / 2 - 230, 262, 170, 1); ctx.fillRect(W / 2 + 60, 262, 170, 1);
    ctx.fillRect(W / 2 - 4, 258, 8, 8);
    text('峠の砦と五つの夜', W / 2, 300, { size: 28, bold: true, color: '#f4e8c8', align: 'center' });
    text('仲間に持ち場をまかせて、村の灯を守りぬく', W / 2, 336, { size: 19, color: '#e8dcc0', align: 'center' });
    const has = !!loadSave() && loadSave().started;
    let y = 380;
    if (has) { button('continue', W / 2 - 130, y, 260, 52, 'つづきから', () => { A.unlock(); continueGame(); }, { primary: true, size: 22 }); y += 66; }
    button('new', W / 2 - 130, y, 260, 52, has ? 'はじめから' : 'はじめる', () => { A.unlock(); if (has) { G.overlay = 'confirmNew'; } else newGame(); }, { primary: !has, size: 22 });
    y += 66;
    button('help', W / 2 - 130, y, 260, 44, 'あそびかた', () => { G.overlay = 'help'; });
    text('ONE PROMPT WORLDS 第20作　/　マウスで遊べます（音が出ます）', W / 2, H - 22, { size: 14, color: '#b8b0c8', align: 'center' });
  }

  function drawStory() {
    drawWorldLayer();
    const s = G.story;
    if (!s) return;
    s.t += 0;
    const line = s.lines[s.i] || '';
    const isTitle = s.o.title && s.i === 0;
    if (isTitle) {
      ctx.fillStyle = 'rgba(8,6,20,0.5)'; ctx.fillRect(0, 0, W, H);
      text(line, W / 2, H / 2 - 10, { size: 46, bold: true, align: 'center', color: '#ffe0a0', sh: 3 });
    } else {
      const lines = wrap(line, 820, 22, false);
      const h = 40 + lines.length * 34;
      panel(W / 2 - 450, H - 60 - h - 20, 900, h, { fill: 'rgba(12,10,26,0.88)' });
      lines.forEach((l, i) => text(l, W / 2 - 420, H - 60 - h + 18 + i * 34, { size: 22, color: '#f4eee0' }));
    }
    const blink = Math.floor(G.time * 2) % 2;
    text(blink ? '▼ クリック / Space' : '　 クリック / Space', W / 2 + 330, H - 34, { size: 14, color: '#b8b0c8' });
    button('skipstory', W - 130, 16, 112, 36, 'とばす', () => { const d = s.done; G.story = null; if (d) d(); }, { size: 15 });
  }

  function drawTopLeft() {
    const wave = G.wave;
    const [n, w] = G.waveIdx;
    panel(12, 10, 560, 74);
    text(waveLabel(n, w) + '「' + wave.title + '」', 28, 40, { size: 23, bold: true, color: '#ffe0a0' });
    const N = D.NIGHTS[n];
    text(N.title.split('　')[1] + '　陣 ' + (w + 1) + '/' + N.waves.length + '　　挑戦 ' + ((save.tries[wave.id] || 0) + (G.scene === 'plan' ? 1 : 0)) + '回目', 28, 68, { size: 15, color: '#c8c0d8' });
  }

  function drawTopRight() {
    const x = W - 252;
    button('sound', x, 14, 72, 34, A.on ? '音 ON' : '音 OFF', () => { A.unlock(); A.setOn(!A.on); save.opt.on = A.on; storeSave(); }, { size: 14 });
    button('book', x + 78, 14, 84, 34, '連携帳', () => { G.overlay = 'book'; }, { size: 14 });
    button('menu', x + 168, 14, 72, 34, 'メニュー', () => { G.overlay = 'menu'; if (G.scene === 'battle') G.paused = true; }, { size: 14 });
  }

  function drawPlan() {
    drawWorldLayer();
    drawWorldTexts();
    drawTopLeft();
    drawTopRight();
    drawTip();
    drawForecast();
    drawLinkLabels();
    drawLastLeakBadges();
    drawSlotInfo();
    drawCards('plan');
    const all = G.wave.allies.every((a) => G.pl[a]);
    const any = G.wave.allies.some((a) => G.pl[a]);
    button('start', W - 212, 652, 198, 60, '迎え撃つ！', () => { startBattle(); }, { primary: true, size: 24, enabled: any });
    if (!all && any) text('置いていない仲間は、本丸で待つ', W - 113, 646, { size: 13, align: 'center', color: '#e8c8a0' });
    if (save.last[G.wave.id]) {
      button('last', 584, 14, 132, 34, G.showLast ? '前回の印 ON' : '前回の印 OFF', () => { G.showLast = !G.showLast; }, { size: 14, active: G.showLast });
    }
  }

  const LEAK_AT = { S: [8.5, 10.6], G: [11.6, 5.5], C: [2.5, 7.6], F: [6.5, 1.5] };
  function drawLastLeakBadges() {
    const last = save.last[G.wave.id];
    if (!G.showLast || !last) return;
    const cnt = {};
    for (const l of last.leakLog) if (!l.slip) cnt[l.r] = (cnt[l.r] || 0) + 1;
    for (const r in cnt) {
      const q = LEAK_AT[r];
      const p = toScreen(q[0], q[1], r === 'F' ? 8 : S.zAt(q[0], q[1]) + 2.2);
      const s2 = '前回 ここを' + cnt[r] + '体素通り';
      ctx.font = font(13, true);
      const w = ctx.measureText(s2).width + 14;
      panel(p.x - w / 2, p.y - 12, w, 24, { fill: 'rgba(80,16,12,0.9)', stroke: '#ff6a5a', r: 6, lw: 1.5 });
      text(s2, p.x, p.y + 5, { size: 13, bold: true, align: 'center', color: '#ffd0c8', shadow: false });
    }
  }

  function drawLinkLabels() {
    const placed = [];
    for (const l of G.an.links) {
      const pa = posOfAlly(l.a), pb = l.b === 'gate' ? { x: 12.2, y: 5.5, z: 3 } : posOfAlly(l.b);
      if (!pa || !pb) continue;
      const p0 = toScreen(pa.x, pa.y, pa.z + 1.2), p1 = toScreen(pb.x, pb.y, pb.z + 1.2);
      let mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
      ctx.font = font(13, true);
      const w = ctx.measureText(l.label).width + 14;
      // 札どうしが重ならないように少しずらす
      for (let k = 0; k < 6; k++) {
        const hit = placed.find((q) => Math.abs(q.x - mx) < (q.w + w) / 2 + 4 && Math.abs(q.y - my) < 25);
        if (!hit) break;
        my = hit.y + 26;
      }
      placed.push({ x: mx, y: my, w });
      panel(mx - w / 2, my - 11, w, 22, { fill: 'rgba(40,28,10,0.88)', stroke: '#ffd860', r: 6, lw: 1 });
      text(l.label, mx, my + 5, { size: 13, bold: true, align: 'center', color: '#ffe070', shadow: false });
    }
  }

  function drawTip() {
    const wave = G.wave;
    const lines = wrap(wave.tip, 520, 16, false);
    let y = 92;
    const last = save.last[wave.id];
    const extra = [];
    if (last) {
      extra.push((last.win ? '前回：守りきった（灯 ' + last.lamps + '/' + last.lampsMax + '）' : '前回：灯が消えた'));
      const parts = [];
      for (const r in last.leaks) if (last.leaks[r]) parts.push(D.ROUTES[r].name + 'から' + last.leaks[r] + '体');
      if (parts.length) extra.push('通した：' + parts.join('、'));
      if (last.torches) extra.push('松明を投げこまれた：' + last.torches + 'つ');
      for (const d of last.downLog) extra.push(allyName(d.ally) + 'が倒れた（' + Math.round(d.t) + '秒、' + (d.by ? D.ENEMIES[d.by].name : '?') + '）');
    }
    const h = 16 + lines.length * 22 + (extra.length ? 10 + extra.length * 21 : 0);
    panel(12, y, 560, h, { fill: 'rgba(14,12,28,0.72)' });
    lines.forEach((l, i) => text(l, 28, y + 26 + i * 22, { size: 16, color: '#e8e0f0' }));
    let yy = y + 26 + lines.length * 22 + 8;
    for (const e of extra) { text(e, 28, yy, { size: 15, color: e.indexOf('守りきった') >= 0 ? '#a8e8a0' : '#ffa890' }); yy += 21; }
  }

  function enemyIcon(type, x, y, scale) {
    const big = type === 'ogre';
    sprite(type, x, y, big ? 1.4 : scale || 2, { view: 'f' });
  }

  function drawForecast() {
    const x = 952, y = 60, w = 316;
    const wave = G.wave;
    // 道ごとにまとめる
    const byR = {};
    for (const g of wave.groups) (byR[g.r] = byR[g.r] || []).push(g);
    const rows = Object.keys(byR);
    let h = 46;
    for (const r of rows) h += 30 + Math.ceil(byR[r].length / 2) * 44;
    h += G.newEnemy.length ? 8 + G.newEnemy.length * 44 : 0;
    panel(x, y, w, h, { fill: 'rgba(14,12,28,0.82)' });
    text('予兆　―　敵の来る道', x + 16, y + 30, { size: 18, bold: true, color: '#ffe0a0' });
    let yy = y + 50;
    for (const r of ['S', 'G', 'C', 'F']) {
      if (!byR[r]) continue;
      const info = G.an.routes[r];
      ctx.fillStyle = RCOL[r]; ctx.fillRect(x + 16, yy + 2, 12, 12);
      text(D.ROUTES[r].name, x + 36, yy + 14, { size: 16, bold: true, color: RCOL[r] });
      // 作戦の読み
      let note, col;
      if (D.ROUTES[r].fly) { const cv2 = Object.keys(info.cover); note = cv2.length ? cv2.map(allyName).join('・') + 'が届く' : '届く者なし'; col = cv2.length ? '#a8e8a0' : '#ff8a7a'; }
      else if (info.block) { note = allyName(info.block.ally) + 'が止める'; col = '#a8e8a0'; }
      else if (!info.gateD && Object.keys(info.cover).length) { note = '止める者なし（' + Object.keys(info.cover).map(allyName).join('・') + 'が届く）'; col = '#ffc070'; }
      else if (info.gateD) {
        const gc = Object.keys(info.cover).filter((id) => info.cover[id].some((sg) => sg[1] >= info.gateD - 2 && sg[0] <= info.gateD));
        if (gc.length) { note = '門が足止め・' + gc.map(allyName).join('と') + 'が届く'; col = '#e8d080'; }
        else { note = '門が足止め（だれも届かない）'; col = '#ff9a6a'; }
      }
      else { note = '止める者なし'; col = '#ff8a7a'; }
      text(note, x + w - 14, yy + 14, { size: 14, bold: true, color: col, align: 'right' });
      yy += 24;
      byR[r].sort((a, b) => a.t - b.t);
      byR[r].forEach((g, i) => {
        const cx = x + 18 + (i % 2) * 150, cy = yy + Math.floor(i / 2) * 44;
        enemyIcon(g.e, cx + 16, cy + 36, 2);
        text('×' + g.n, cx + 38, cy + 24, { size: 17, bold: true });
        text(g.t <= 3 ? 'すぐ' : g.t + '秒後', cx + 38, cy + 40, { size: 12, color: '#b8b0c8' });
      });
      yy += Math.ceil(byR[r].length / 2) * 44 + 6;
    }
    if (G.newEnemy.length) {
      ctx.fillStyle = 'rgba(255,230,160,0.2)'; ctx.fillRect(x + 12, yy, w - 24, 1);
      yy += 8;
      for (const e of G.newEnemy) {
        enemyIcon(e, x + 34, yy + 38, 2);
        text('はじめて：' + D.ENEMIES[e].name, x + 62, yy + 18, { size: 14, bold: true, color: '#ffe0a0' });
        const ls = wrap(D.ENEMIES[e].note, w - 80, 12);
        ls.slice(0, 2).forEach((l, i) => text(l, x + 62, yy + 34 + i * 14, { size: 12, color: '#d8d0e0' }));
        yy += 44;
      }
    }
  }

  function drawSlotInfo() {
    const sid = G.hoverSlot;
    const focus = G.drag && G.drag.moved ? G.drag.ally : G.sel;
    const x = 12, y = 470, w = 380;
    if (!sid && !focus) {
      panel(x, y + 96, w, 66, { fill: 'rgba(14,12,28,0.7)' });
      text('① 下の札で仲間を選ぶ　② 旗を押して置く', x + 16, y + 124, { size: 15, color: '#e8e0f0' });
      text('置いた仲間をもう一度押すと持ち上がる。右クリックで外す', x + 16, y + 148, { size: 13, color: '#b8b0c8' });
      return;
    }
    if (!sid) {
      const a = D.ALLIES[focus];
      panel(x, y + 66, w, 96, { fill: 'rgba(14,12,28,0.8)' });
      text(a.name + '（' + a.role + '）を置く場所を選ぶ', x + 16, y + 92, { size: 16, bold: true, color: a.color });
      wrap('得意：' + a.good, w - 30, 13).slice(0, 2).forEach((l, i) => text(l, x + 16, y + 114 + i * 17, { size: 13, color: '#d8f0d0' }));
      text('苦手：' + a.weak, x + 16, y + 150, { size: 13, color: '#f0c8c0' });
      return;
    }
    const sl = S.slots[sid];
    const who = (focus && G.pl[focus] !== sid) ? focus : allyAtSlot(sid);
    panel(x, y, w, 162, { fill: 'rgba(14,12,28,0.84)' });
    text(sl.name, x + 16, y + 28, { size: 19, bold: true, color: '#ffe0a0' });
    text(sl.safe ? '高所：敵に近寄られない' : '地上：ここで敵を受け止める', x + w - 14, y + 27, { size: 13, align: 'right', color: sl.safe ? '#8ab8ff' : '#f0e0b0' });
    text(sl.note, x + 16, y + 52, { size: 14, color: '#d8d0e0' });
    if (S.inside(sl.wx, sl.wy) && !sl.safe) text('内側：ここで止めても9秒で松明', x + w - 14, y + 52, { size: 12, align: 'right', color: '#ff9a70' });
    if (who) {
      const pl2 = Object.assign({}, G.pl);
      // その場所に置いたらどうなるか
      if (focus && G.pl[focus] !== sid) {
        const other = allyAtSlot(sid);
        if (other) { if (G.pl[focus]) pl2[other] = G.pl[focus]; else delete pl2[other]; }
        pl2[focus] = sid;
      }
      const an = S.analyze(G.wave, pl2, save.up);
      const a = D.ALLIES[who];
      const stops = [], reach = [];
      for (const r in an.routes) {
        const info = an.routes[r];
        if (info.block && info.block.ally === who) stops.push(D.ROUTES[r].short);
        const cv2 = info.cover[who];
        if (cv2) {
          const near = (d0, d1) => cv2.some((sg) => sg[1] >= d0 && sg[0] <= d1);
          // 敵が止まって列になる所に届くか（届く道の「どこ」なのか）
          let where = '';
          if (info.fly) where = '';
          else if (info.block && info.block.ally !== who) where = near(info.block.d - 2, info.block.d) ? '（列に届く）' : '（列には届かない）';
          else if (info.block && info.block.ally === who) where = '';
          else if (info.gateD) where = near(info.gateD - 2, info.gateD) ? '（門前に届く）' : '（門前に届かない）';
          else where = '（通る敵に）';
          reach.push(D.ROUTES[r].short + where);
        }
      }
      text(a.name + 'なら：', x + 16, y + 80, { size: 15, bold: true, color: a.color });
      const nearR = (an.near && an.near[who]) || [];
      const behind = nearR.filter((r) => an.routes[r].block && an.routes[r].block.ally !== who).map((r) => allyName(an.routes[r].block.ally));
      const l1 = stops.length ? '止める：' + stops.join('・') : (sl.safe ? '止める：なし（高所）' : (behind.length ? '止める：なし（手前で' + behind[0] + 'が止める）' : '止める：なし（来る道から遠い）'));
      text(l1, x + 30, y + 102, { size: 14, color: stops.length ? '#a8e8a0' : '#c8c0d0' });
      if (a.kind !== 'guard' && a.kind !== 'healer') text('届く：' + (reach.length ? reach.join('・') : 'なし'), x + 30, y + 122, { size: 14, color: reach.length ? '#a8e8a0' : '#ff9a8a' });
      if (a.kind === 'healer') text('癒やす：近くの仲間（' + a.range + '升）', x + 30, y + 122, { size: 14, color: '#ffe890' });
      if (a.kind === 'guard') text('受け止める数：' + S.allyStats(who, save.up).cap + '体', x + 30, y + 122, { size: 14, color: '#c8c0d0' });
      if (!sl.safe && a.kind !== 'guard') text('受け：' + S.allyStats(who, save.up).cap + '体', x + w - 14, y + 80, { size: 13, align: 'right', color: '#c8c0d0' });
      const lk = an.links.filter((l) => l.a === who || l.b === who);
      const lkNames = [];
      for (const l of lk) if (lkNames.indexOf(l.label) < 0) lkNames.push(l.label);
      if (lk.length) text('連携：' + lkNames.join('・'), x + 30, y + 144, { size: 14, bold: true, color: '#ffe070' });
      else if (sl.safe && a.kind === 'guard') text('高所では、だれも受け止められない', x + 30, y + 144, { size: 13, color: '#ff9a8a' });
    } else {
      text('仲間を選んでから押すと、ここに置ける', x + 16, y + 90, { size: 14, color: '#b8b0c8' });
    }
  }

  function drawCards(mode) {
    const ids = G.wave.allies;
    const x0 = 12, y = 652, cw = 186, ch = 60, gap = 8;
    const st = G.st;
    ids.forEach((id, i) => {
      const x = x0 + i * (cw + gap);
      const a = D.ALLIES[id];
      const sel = G.sel === id;
      const hov = G.mouse.x >= x && G.mouse.x < x + cw && G.mouse.y >= y && G.mouse.y < y + ch;
      let sa = st ? st.allies.find((u) => u.id === id) : null;
      panel(x, y, cw, ch, { fill: sel ? 'rgba(60,50,90,0.96)' : (hov ? 'rgba(40,34,64,0.95)' : 'rgba(20,16,36,0.92)'), stroke: sel ? a.color : 'rgba(255,230,180,0.3)', lw: sel ? 3 : 1.5 });
      ctx.save(); roundRect(x, y, cw, ch, 10); ctx.clip();
      sprite(id, x + 30, y + ch + 6, 2.6, { alpha: sa && sa.down ? 0.4 : 1 });
      ctx.restore();
      text((i + 1) + '　' + a.name, x + 60, y + 24, { size: 17, bold: true, color: a.color });
      if (mode === 'plan') {
        const sid = G.pl[id];
        text(sid ? slotName(sid) : '（まだ置いていない）', x + 60, y + 46, { size: 14, color: sid ? '#f4eee0' : '#a8a0b8' });
      } else if (sa) {
        const r = sa.hp / sa.maxhp;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + 60, y + 32, 110, 7);
        ctx.fillStyle = r > 0.5 ? '#7adc6a' : (r > 0.25 ? '#e8c040' : '#ff5a4a'); ctx.fillRect(x + 60, y + 32, Math.round(110 * r), 7);
        let s = '';
        if (sa.down) s = '倒れた';
        else if (sa.cast) s = '詠唱中';
        else if (sa.eng.length) s = '受け止め中 ×' + sa.eng.length;
        else if (sa.aim) s = 'かたまるのを待つ';
        else if (sa.atkT > 0 || (sa.lastAct && G.st.t - sa.lastAct < 1.2)) s = { archer: '射ている', guard: '打ちあう', spear: '突いている', mage: '焼いた', healer: '癒やしている' }[sa.def.kind] || '戦っている';
        else if (sa.alerted) s = '構えている';
        const kills = G.st.stats.allies[id] ? G.st.stats.allies[id].kills : 0;
        if (!sa.down && kills) text('倒した ' + kills, x + cw - 10, y + 24, { size: 12, align: 'right', color: '#e8d8b0' });
        else s = '持ち場で待つ';
        text(s, x + 60, y + 54, { size: 13, color: sa.down ? '#ff8a7a' : '#d8d0e0' });
      } else {
        text('本丸で待つ', x + 60, y + 46, { size: 14, color: '#a8a0b8' });
      }
      if (mode === 'plan') G.buttons.push({ key: 'card_' + id, x, y, w: cw, h: ch, label: a.name, onClick: () => { selectAlly(id); }, hov, card: id });
    });
  }

  function drawBattle() {
    drawWorldLayer();
    drawWorldTexts();
    drawTopLeft();
    drawTopRight();
    const st = G.st;
    // 残り
    panel(12, 92, 250, 40, { fill: 'rgba(14,12,28,0.7)' });
    text('残りの敵 ' + S.left(st) + ' / ' + st.stats.total + '　　灯 ' + st.lamps + '/' + st.lampsMax, 26, 118, { size: 16, bold: true, color: st.lamps < st.lampsMax ? '#ffb0a0' : '#f4eee0' });
    // 出来事
    let y = 150;
    for (const t of G.ticker) {
      const al = clamp(1 - (t.t - 6) / 2, 0, 1);
      if (al <= 0) continue;
      ctx.globalAlpha = al;
      text(t.s, 22, y, { size: 15, bold: true, color: t.col });
      ctx.globalAlpha = 1;
      y += 24;
    }
    drawCards('battle');
    // 速さ
    const bx = W - 300;
    [1, 2, 3].forEach((sp, i) => button('speed' + sp, bx + i * 62, 662, 56, 44, '×' + sp, () => { G.speed = sp; G.paused = false; save.opt.speed = sp; storeSave(); }, { active: G.speed === sp && !G.paused, size: 18 }));
    button('pause', bx + 190, 662, 96, 44, G.paused ? '再開' : '一時停止', () => { G.paused = !G.paused; }, { size: 16, active: G.paused });
    if (G.paused && !G.overlay) {
      text('一時停止中（Space で再開）', W / 2, 120, { size: 22, bold: true, align: 'center', color: '#ffe0a0' });
      button('retry_mid', W / 2 - 120, 140, 240, 44, '持ち場を変えてやり直す', () => { retryWave(); }, { size: 16 });
    }
  }

  function drawResult() {
    drawWorldLayer();
    drawWorldTexts();
    drawTopLeft();
    const r = G.result;
    r.t += 0;
    const sum = r.sum;
    const x = W / 2 - 330, y = 110, w = 660;
    const hl = highlights(sum);
    const h = 194 + hl.length * 28 + (r.newCombos.length ? 40 : 0) + 84;
    panel(x, y, w, h, { fill: 'rgba(14,12,28,0.93)', stroke: r.win ? '#ffd860' : '#ff8a7a', lw: 2 });
    const head = !r.win ? '灯が、すべて消えた……' : (sum.lamps === sum.lampsMax ? '「' + G.wave.title + '」を守りきった！' : (sum.lamps >= 3 ? '「' + G.wave.title + '」をしのいだ' : 'ぎりぎり、しのいだ……'));
    text(head, W / 2, y + 48, { size: 30, bold: true, align: 'center', color: r.win ? '#ffe070' : '#ff9a8a' });
    // 灯
    for (let i = 0; i < sum.lampsMax; i++) {
      const on = i < sum.lamps;
      const lx = W / 2 - (sum.lampsMax * 30) / 2 + i * 30 + 15;
      ctx.fillStyle = on ? '#ffd070' : '#3a3036'; ctx.fillRect(lx - 6, y + 66, 12, 16);
      if (on) { ctx.fillStyle = 'rgba(255,200,100,0.3)'; ctx.beginPath(); ctx.arc(lx, y + 74, 13, 0, Math.PI * 2); ctx.fill(); }
    }
    text(r.win ? (sum.lamps === sum.lampsMax ? 'ひとつの灯も消させなかった' : '灯 ' + sum.lamps + '/' + sum.lampsMax + ' を守った（灯と傷は、次の陣までに元にもどる）') : '本丸に入られた', W / 2, y + 106, { size: 16, align: 'center', color: '#d8d0e0' });
    let yy = y + 140;
    text(r.win ? 'この陣の見せ場' : 'どこを通されたか', x + 30, yy, { size: 17, bold: true, color: '#ffe0a0' });
    yy += 28;
    for (const l of hl) { text('・' + l.s, x + 36, yy, { size: 16, color: l.col || '#f4eee0' }); yy += 28; }
    if (r.newCombos.length) {
      text('新しい連携：' + r.newCombos.map((id) => '「' + D.COMBOS.find((c) => c.id === id).name + '」').join(''), x + 30, yy + 8, { size: 16, bold: true, color: '#ffe070' });
      yy += 40;
    }
    // だれが何体倒したか
    const ks = Object.keys(sum.allies).map((id) => allyName(id) + ' ' + sum.allies[id].kills).join('　');
    text('倒した数：' + ks, x + 30, yy + 2, { size: 14, color: '#c8c0d8' });
    yy += 24;
    const hint = nextHint(sum);
    if (hint) { text('次に試すなら：' + hint, x + 30, yy + 6, { size: 15, color: '#c8e0ff' }); }
    const by = y + h - 66;
    if (r.win) {
      button('next', W / 2 + 10, by, 300, 50, G.replayMode ? '記録へもどる' : '次へ', () => { nextAfterWin(); }, { primary: true, size: 22 });
      button('again', W / 2 - 310, by, 300, 50, '持ち場を変えてもう一度', () => { retryWave(); }, { size: 17 });
    } else {
      button('retry', W / 2 + 10, by, 300, 50, '持ち場を見直す', () => { retryWave(); }, { primary: true, size: 22 });
      button('replay', W / 2 - 310, by, 300, 50, 'そのままもう一度', () => { startBattle(); }, { size: 17 });
    }
  }

  function highlights(sum) {
    const out = [];
    if (!sum.win || sum.lamps < sum.lampsMax) {
      for (const r in sum.leaks) {
        if (!sum.leaks[r] && !(sum.torchBy && sum.torchBy[r])) continue;
        if (!sum.leaks[r]) continue;
        const ls = sum.leakLog.filter((l) => l.r === r);
        const slipped = ls.filter((l) => l.slip);
        let why;
        if (slipped.length) why = allyName(slipped[0].slip.ally) + 'の横をすり抜けた（受け止めきれない）';
        else if (r === 'F') why = '空から';
        else if (r === 'G' && ls.some((l) => l.gate)) why = '門が破られたあと、だれにも止められず';
        else why = 'だれにも止められず';
        if (sum.leaks[r]) out.push({ s: D.ROUTES[r].name + 'から' + sum.leaks[r] + '体が本丸へ　' + why, col: '#ffa890' });
      }
      if (sum.torches) out.push({ s: '城壁の内側に入った敵に、松明を' + sum.torches + 'つ投げこまれた', col: '#ffb080' });
      for (const d of sum.downLog) out.push({ s: allyName(d.ally) + 'が' + Math.round(d.t) + '秒で倒れた（' + (d.by ? D.ENEMIES[d.by].name : '?') + '）', col: '#ffa890' });
    }
    for (const id in sum.allies) if (sum.allies[id].holdT >= 3) out.push({ s: allyName(id) + 'が' + slotName(sum.allies[id].slot) + 'で、大鬼を' + Math.round(sum.allies[id].holdT) + '秒受け止めた', col: '#ffe080' });
    if (sum.best && sum.best.n >= 2) {
      const who = sum.best.holder ? allyName(sum.best.holder) + 'が止めた列を、' : (sum.best.gate ? '門の前の列を、' : '');
      out.push({ s: who + 'ルゥの火球が' + sum.best.n + '体をまとめて焼いた', col: '#ffd080' });
    }
    let held = null;
    for (const id in sum.allies) if (sum.allies[id].held && (!held || sum.allies[id].held > sum.allies[held].held)) held = id;
    if (held) out.push({ s: allyName(held) + 'が' + slotName(sum.allies[held].slot) + 'で' + sum.allies[held].held + '体を受け止めた', col: D.ALLIES[held].color });
    let as = null;
    for (const id in sum.allies) if (sum.allies[id].assists && (!as || sum.allies[id].assists > sum.allies[as].assists)) as = id;
    if (as && as !== held) out.push({ s: allyName(as) + 'の援護 ' + sum.allies[as].assists + '回', col: D.ALLIES[as].color });
    if (sum.allies.mel && sum.allies.mel.heal) out.push({ s: 'メルが癒やした傷 ' + sum.allies.mel.heal, col: D.ALLIES.mel.color });
    return out.slice(0, 6);
  }
  function nextHint(sum) {
    for (const d of sum.downLog) {
      if (d.by === 'archer') return allyName(d.ally) + 'は弓小鬼にねらわれた。先に射抜ける者を近くに置くか、届かない場所へ。';
      if (d.ally === 'ruu' || d.ally === 'kai' || d.ally === 'mel') return allyName(d.ally) + 'は近寄られると弱い。前にだれかを立たせよう。';
      return allyName(d.ally) + 'が倒れた。ひとりで受ける数を減らすか、支える仲間を近くに。';
    }
    if (sum.torches && sum.torches >= Object.values(sum.leaks).reduce((a, b) => a + b, 0)) {
      let wr = null;
      for (const r in sum.torchBy || {}) if (!wr || sum.torchBy[r] > sum.torchBy[wr]) wr = r;
      return '城壁の内側に入られると松明を投げこまれる。' + (wr ? D.ROUTES[wr].name + 'の敵を、' : '敵を、') + '城壁の外で止めるか、減らしておこう。';
    }
    for (const r in sum.leaks) {
      if (!sum.leaks[r]) continue;
      if (r === 'F') return '夜鴉は空を通る。本丸に近い高い所に、カイかルゥを。';
      const ls = sum.leakLog.filter((l) => l.r === r);
      if (ls.some((l) => l.slip)) return D.ROUTES[r].name + 'で受け止めきれなかった。止める人を増やすか、前で数を減らそう。';
      return D.ROUTES[r].name + 'に、止める人がいなかった。一人だけ、そちらへ回してみては？';
    }
    if (sum.best && sum.best.n < 3 && sum.allies.ruu) return 'ルゥの火は、敵が詰まる所で強い。止める人のすぐ後ろが見える場所へ。';
    return null;
  }

  function drawGift() {
    drawWorldLayer();
    const gd = G.giftDef;
    panel(W / 2 - 420, 120, 840, 360, { fill: 'rgba(14,12,28,0.9)', stroke: '#ffd860' });
    text('夜明けの贈りもの　―　ひとつ選ぶ', W / 2, 168, { size: 26, bold: true, align: 'center', color: '#ffe0a0' });
    gd.options.forEach((o, i) => {
      const x = W / 2 - 400 + i * 410, y = 200, w = 390, h = 230;
      const hov = G.mouse.x >= x && G.mouse.x < x + w && G.mouse.y >= y && G.mouse.y < y + h;
      panel(x, y, w, h, { fill: hov ? 'rgba(70,56,40,0.96)' : 'rgba(40,32,28,0.92)', stroke: hov ? '#ffd860' : 'rgba(255,220,160,0.4)', lw: hov ? 3 : 1.5 });
      if (o.who) sprite(o.who, x + 60, y + 150, 4);
      else sprite('woman', x + 60, y + 150, 4);
      text(o.title, x + 120, y + 60, { size: 21, bold: true, color: '#ffe0a0' });
      wrap(o.text, w - 140, 16).forEach((l, j) => text(l, x + 120, y + 96 + j * 24, { size: 16, color: '#f4eee0' }));
      text('これにする', x + w / 2, y + h - 22, { size: 16, bold: true, align: 'center', color: hov ? '#ffe070' : '#b8b0c8' });
      G.buttons.push({ key: 'gift' + i, x, y, w, h, label: o.title, onClick: () => chooseGift(o), hov });
    });
  }

  function drawEnding() {
    drawWorldLayer();
    G.endT = (G.endT || 0);
    const c = G.chron;
    panel(W / 2 - 520, 40, 1040, 600, { fill: 'rgba(14,12,28,0.9)', stroke: '#ffd860', lw: 2 });
    text('きざはし砦　五つの夜の記録', W / 2, 88, { size: 30, bold: true, align: 'center', color: '#ffe0a0' });
    if (c.hero) text(slotName(c.hero.slot) + 'を、' + allyName(c.hero.id) + 'が守ってくれた。（受け止めた敵 ' + c.hero.n + '体）', W / 2, 124, { size: 19, bold: true, align: 'center', color: D.ALLIES[c.hero.id] ? D.ALLIES[c.hero.id].color : '#fff' });
    const ids = D.ALLY_ORDER;
    ids.forEach((id, i) => {
      const p = c.per[id];
      const x = W / 2 - 500 + i * 200, y = 150;
      panel(x, y, 190, 300, { fill: 'rgba(30,24,44,0.9)', stroke: D.ALLIES[id].color });
      sprite(id, x + 95, y + 110, 4);
      text(D.ALLIES[id].name, x + 95, y + 140, { size: 19, bold: true, align: 'center', color: D.ALLIES[id].color });
      text(D.ALLIES[id].role, x + 95, y + 162, { size: 13, align: 'center', color: '#c8c0d8' });
      if (p) {
        text('主な持ち場', x + 95, y + 190, { size: 12, align: 'center', color: '#a8a0b8' });
        text(slotName(p.main), x + 95, y + 210, { size: 16, bold: true, align: 'center' });
        text('受け止め ' + p.held + '　倒した ' + p.kills, x + 95, y + 238, { size: 13, align: 'center' });
        text('援護 ' + p.assists + (p.heal ? '　癒やし ' + p.heal : ''), x + 95, y + 258, { size: 13, align: 'center' });
        text('倒れた ' + p.downs + '回', x + 95, y + 278, { size: 12, align: 'center', color: '#a8a0b8' });
      }
    });
    let yy = 482;
    const got = D.COMBOS.filter((cb) => save.combos[cb.id]);
    text('決めた連携　' + got.length + ' / ' + D.COMBOS.length, W / 2 - 480, yy, { size: 17, bold: true, color: '#ffe070' });
    yy += 26;
    const names = got.map((cb) => '「' + cb.name + '」×' + save.combos[cb.id]);
    wrap(names.join('　'), 960, 15).slice(0, 3).forEach((l) => { text(l, W / 2 - 480, yy, { size: 15 }); yy += 22; });
    if (c.bestBurn) text('いちばん大きな火球：' + c.bestBurn.n + '体（' + waveName(c.bestBurn.wave) + '）', W / 2 - 480, 596, { size: 15, color: '#ffd080' });
    if (c.ogre) text('大鬼を受け止めた時間：' + c.ogre.t + '秒（' + slotName(c.ogre.slot) + '）', W / 2 + 40, 596, { size: 15, color: '#9ac0ff' });
    button('toTitle', W / 2 - 310, 656, 300, 50, 'タイトルへ', () => { G.scene = 'title'; A.music('plan'); }, { size: 18 });
    button('replayAll', W / 2 + 10, 656, 300, 50, '好きな陣をもう一度', () => { G.overlay = 'select'; }, { size: 18, primary: true });
  }
  // ドット絵の一覧（URL に ?sheet）
  function drawSheet() {
    ctx.fillStyle = '#2a2838'; ctx.fillRect(0, 0, W, H);
    let x = 60, y = 150;
    for (const n of SP.names) {
      for (const v of ['f', 'b']) for (const fr of ['idle', 'step']) {
        sprite(n, x, y, 4, { view: v, frame: fr });
        x += 80;
        if (x > W - 60) { x = 60; y += 130; }
      }
      text(n, x - 160, y + 20, { size: 12 });
    }
  }
  function waveName(id) {
    for (let n = 0; n < D.NIGHTS.length; n++) for (let w = 0; w < D.NIGHTS[n].waves.length; w++) if (D.NIGHTS[n].waves[w].id === id) return waveLabel(n, w);
    return id;
  }

  // ---------------- 重ねる画面 ----------------
  function drawOverlay() {
    const o = G.overlay;
    if (!o) return;
    ctx.fillStyle = 'rgba(6,4,14,0.6)'; ctx.fillRect(0, 0, W, H);
    if (o === 'menu') {
      panel(W / 2 - 200, 140, 400, 420, { fill: 'rgba(14,12,28,0.96)' });
      text('メニュー', W / 2, 186, { size: 26, bold: true, align: 'center', color: '#ffe0a0' });
      let y = 214;
      button('m_close', W / 2 - 160, y, 320, 46, 'もどる', () => { G.overlay = null; }, { primary: true }); y += 58;
      if (G.scene === 'battle' || G.scene === 'result') { button('m_retry', W / 2 - 160, y, 320, 46, 'この陣を持ち場からやり直す', () => { G.overlay = null; retryWave(); }); y += 58; }
      button('m_help', W / 2 - 160, y, 320, 46, 'あそびかた', () => { G.overlay = 'help'; }); y += 58;
      button('m_vol', W / 2 - 160, y, 320, 46, '音量：' + Math.round(A.vol * 10) + '（押すと変わる）', () => { const v = A.vol >= 0.95 ? 0.2 : Math.round((A.vol + 0.2) * 10) / 10; A.setVol(v); save.opt.vol = v; storeSave(); A.play('click'); }); y += 58;
      button('m_title', W / 2 - 160, y, 320, 46, 'タイトルへ（進み具合は保存済み）', () => { G.overlay = null; G.scene = 'title'; G.st = null; G.replayMode = false; A.music('plan'); }); y += 58;
    } else if (o === 'help') {
      panel(W / 2 - 470, 60, 940, 600, { fill: 'rgba(14,12,28,0.97)' });
      text('あそびかた', W / 2, 104, { size: 26, bold: true, align: 'center', color: '#ffe0a0' });
      const L = [
        ['目的', '五つの夜、本丸の「灯」を守る。敵が本丸の扉にたどり着くと灯がひとつ消え、すべて消えるとその陣はやり直し。'],
        ['作戦', '右上の「予兆」で、どの道から何が来るかを見る。下の札で仲間を選び、砦の旗（持ち場）を押して置く。'],
        ['読み', '道の上の盾の印＝その道で最初に敵を止める仲間。足跡の下の色の点＝その仲間の攻撃が届く所。点線＝連携できそうな二人。'],
        ['迎撃', '「迎え撃つ」を押すと、仲間は自分で戦う。見守るだけでよい。×1〜×3 で速さ、Space で一時停止。'],
        ['受け止め', '地上の仲間は、来た敵をその場で止める（イルザ3体、ドゥーガン2体、ほかは1体）。止めきれない敵はすり抜ける。高所（青い旗）には敵が近寄れない。'],
        ['高さ', '高い所からは弓と火が遠くまで届く。石段は一列でしかのぼれないので、先頭を止めると後ろが詰まる。'],
        ['内側', '城壁の内側（中庭・本丸の石畳。作戦画面でうすく赤い所）に入った敵は、9秒たつと本丸へ松明を投げこみ、灯がひとつ消える。外の石段・門・崖道で止めるほど安全。'],
        ['やり直し', '負けても、その陣の作戦からすぐにやり直せる。前回どこを通されたか（赤い×）、だれが倒れたかが残る。'],
        ['操作', 'マウス：選ぶ・置く（ドラッグでも）、右クリック：外す。キー：1〜5 仲間を選ぶ、Enter 迎え撃つ、Space 一時停止、Esc メニュー、M 音。'],
      ];
      let y = 140;
      for (const l of L) {
        text(l[0], W / 2 - 440, y + 4, { size: 17, bold: true, color: '#ffd080' });
        const ls = wrap(l[1], 760, 16);
        ls.forEach((s, i) => text(s, W / 2 - 330, y + 4 + i * 22, { size: 16 }));
        y += Math.max(1, ls.length) * 22 + 16;
      }
      button('h_close', W / 2 - 100, 600, 200, 44, 'とじる', () => { G.overlay = G.scene === 'title' ? null : (G.prevOverlay || null); G.prevOverlay = null; }, { primary: true });
    } else if (o === 'book') {
      panel(W / 2 - 470, 60, 940, 600, { fill: 'rgba(14,12,28,0.97)' });
      text('連携帳　―　二人の働きが重なったとき', W / 2, 104, { size: 24, bold: true, align: 'center', color: '#ffe0a0' });
      let y = 140;
      D.COMBOS.forEach((cb, i) => {
        const got = save.combos[cb.id];
        const x = W / 2 - 440 + (i % 2) * 450, yy = y + Math.floor(i / 2) * 72;
        panel(x, yy, 430, 64, { fill: got ? 'rgba(50,40,24,0.9)' : 'rgba(30,26,40,0.8)', stroke: got ? '#ffd860' : 'rgba(255,230,180,0.2)' });
        text(got ? cb.name : '？？？', x + 14, yy + 26, { size: 18, bold: true, color: got ? '#ffe070' : '#8a8494' });
        if (got) text('×' + got, x + 416, yy + 26, { size: 15, align: 'right', color: '#ffe0a0' });
        const who = cb.who.map((w) => w === '*' ? 'だれか' : allyName(w)).join('×');
        text(who + '　' + (got ? cb.text : cb.text.replace(/[^、（）]+(?=[、（]|$)/g, (m, off) => off === 0 ? m : '…')), x + 14, yy + 50, { size: 13, color: got ? '#e8e0d0' : '#8a8494' });
      });
      button('b_close', W / 2 - 100, 610, 200, 40, 'とじる', () => { G.overlay = null; }, { primary: true });
    } else if (o === 'confirmNew') {
      panel(W / 2 - 260, 250, 520, 200, { fill: 'rgba(14,12,28,0.97)' });
      text('はじめから遊びますか？', W / 2, 300, { size: 22, bold: true, align: 'center' });
      text('いまの進み具合と連携帳は消えます', W / 2, 334, { size: 15, align: 'center', color: '#ffb0a0' });
      button('c_yes', W / 2 - 230, 370, 220, 48, 'はじめから', () => { G.overlay = null; newGame(); }, { primary: true });
      button('c_no', W / 2 + 10, 370, 220, 48, 'やめる', () => { G.overlay = null; });
    } else if (o === 'select') {
      panel(W / 2 - 330, 90, 660, 540, { fill: 'rgba(14,12,28,0.97)' });
      text('もう一度遊ぶ陣を選ぶ', W / 2, 134, { size: 22, bold: true, align: 'center', color: '#ffe0a0' });
      let y = 160;
      D.NIGHTS.forEach((N, n) => {
        text(N.title, W / 2 - 300, y + 26, { size: 16, bold: true, color: '#e8d8b0' });
        N.waves.forEach((wv, w) => {
          const s = save.waveStats[wv.id];
          button('sel_' + wv.id, W / 2 - 60 + w * 190, y, 180, 40, wv.title + (s ? '　灯' + s.lamps : ''), () => { G.overlay = null; G.replayMode = true; gotoPlan(n, w, true); }, { size: 14 });
        });
        y += 52;
      });
      button('s_close', W / 2 - 100, 570, 200, 42, 'とじる', () => { G.overlay = null; }, { primary: true });
    }
  }

  // ---------------- 入力 ----------------
  function toLocal(ev) {
    const r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height };
  }
  function hitButton(x, y) {
    for (let i = G.buttons.length - 1; i >= 0; i--) {
      const b = G.buttons[i];
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
    }
    return null;
  }
  function slotUnderMouse() {
    if (G.scene !== 'plan' || G.overlay) return null;
    if (G.mouse.y >= 648) return null;
    return R.slotAt(G.mouse.x / SC, G.mouse.y / SC);
  }
  function selectAlly(id) {
    if (!G.wave || G.wave.allies.indexOf(id) < 0) return;
    G.sel = id;
    A.play('lift');
  }
  function placeAt(id, sid) {
    const other = allyAtSlot(sid);
    if (other === id) return;
    if (other) { if (G.pl[id]) G.pl[other] = G.pl[id]; else delete G.pl[other]; }
    G.pl[id] = sid;
    A.play('place');
    fx({ kind: 'puff', x: S.slots[sid].wx, y: S.slots[sid].wy, z: S.slots[sid].wz - 0.6, life: 0.35 });
    reanalyze();
    // 次の、まだ置いていない仲間を選んでおく
    const next = G.wave.allies.find((a) => !G.pl[a]);
    G.sel = other && !G.pl[other] ? other : (next || null);
  }
  cv.addEventListener('mousemove', (ev) => {
    const p = toLocal(ev);
    G.mouse.x = p.x; G.mouse.y = p.y;
    if (G.drag && Math.hypot(p.x - G.drag.x0, p.y - G.drag.y0) > 8) G.drag.moved = true;
  });
  cv.addEventListener('mouseleave', () => { G.mouse.x = -1; G.mouse.y = -1; });
  cv.addEventListener('contextmenu', (ev) => ev.preventDefault());
  cv.addEventListener('mousedown', (ev) => {
    A.unlock();
    const p = toLocal(ev);
    G.mouse.x = p.x; G.mouse.y = p.y;
    if (ev.button === 2) {
      if (G.scene === 'plan' && !G.overlay) {
        const sid = slotUnderMouse();
        const who = sid && allyAtSlot(sid);
        if (who) { delete G.pl[who]; G.sel = who; A.play('lift'); reanalyze(); }
        else G.sel = null;
      }
      return;
    }
    const b = hitButton(p.x, p.y);
    if (b) {
      if (b.card && G.scene === 'plan' && !G.overlay) { G.drag = { ally: b.card, x0: p.x, y0: p.y, moved: false, fromCard: true }; }
      if (b.onClick && !b.card) { A.play('click'); b.onClick(); }
      else if (b.card) { /* 離したときに決める */ }
      return;
    }
    if (G.overlay) return;
    if (G.scene === 'story') { advanceStory(); return; }
    if (G.scene === 'plan') {
      const sid = slotUnderMouse();
      if (!sid) { return; }
      const who = allyAtSlot(sid);
      if (G.sel && G.pl[G.sel] !== sid) { placeAt(G.sel, sid); return; }
      if (who) { G.drag = { ally: who, x0: p.x, y0: p.y, moved: false, fromSlot: sid }; return; }
    }
  });
  window.addEventListener('mouseup', (ev) => {
    if (!G.drag) return;
    const d = G.drag;
    G.drag = null;
    if (G.scene !== 'plan') return;
    const p = toLocal(ev);
    G.mouse.x = p.x; G.mouse.y = p.y;
    if (d.moved) {
      const sid = slotUnderMouse();
      if (sid) { placeAt(d.ally, sid); }
      else if (p.y >= 648 && G.pl[d.ally]) { delete G.pl[d.ally]; reanalyze(); A.play('lift'); }
      return;
    }
    // ただのクリック
    if (d.fromCard) { selectAlly(d.ally); return; }
    if (d.fromSlot) { G.sel = G.sel === d.ally ? null : d.ally; A.play('lift'); }
  });
  cv.addEventListener('wheel', (ev) => { ev.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', (ev) => {
    A.unlock();
    const k = ev.key;
    if (k === 'm' || k === 'M') { A.setOn(!A.on); save.opt.on = A.on; storeSave(); return; }
    if (k === 'Escape') {
      if (G.overlay) { G.overlay = null; return; }
      if (G.scene === 'plan' || G.scene === 'battle') { G.overlay = 'menu'; if (G.scene === 'battle') G.paused = true; }
      return;
    }
    if (G.overlay) { if (k === 'Enter' || k === ' ') { if (G.overlay === 'help' || G.overlay === 'book') G.overlay = null; } return; }
    if (k === '?' || k === 'h' || k === 'H') { G.overlay = 'help'; return; }
    if (G.scene === 'story' && (k === ' ' || k === 'Enter')) { ev.preventDefault(); advanceStory(); return; }
    if (G.scene === 'plan') {
      if (k >= '1' && k <= '5') { const id = G.wave.allies[+k - 1]; if (id) selectAlly(id); }
      if (k === 'Enter' && G.wave.allies.some((a) => G.pl[a])) { ev.preventDefault(); startBattle(); }
      return;
    }
    if (G.scene === 'battle') {
      if (k === ' ') { ev.preventDefault(); G.paused = !G.paused; }
      if (k === '1' || k === '2' || k === '3') { G.speed = +k; G.paused = false; save.opt.speed = G.speed; }
      return;
    }
    if (G.scene === 'result') {
      if (k === 'Enter') { if (G.result.win) nextAfterWin(); else retryWave(); }
      return;
    }
    if (G.scene === 'title' && k === 'Enter') { const s = loadSave(); if (s && s.started) continueGame(); else newGame(); }
  });

  // ---------------- 毎フレーム ----------------
  function update(dt) {
    G.time += dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 2);
    if (G.doorFlash > 0) G.doorFlash = Math.max(0, G.doorFlash - dt * 1.5);
    if (G.story) G.story.t += dt;
    G.hoverSlot = slotUnderMouse();
    // 迎撃を進める
    if (G.scene === 'battle' && !G.paused && !G.overlay && !G.hold) {
      const sp = G.fast || G.speed;
      G.acc += dt * sp;
      let n = 0;
      while (G.acc >= S.DT && n < (G.fast ? 400 : 12)) {
        S.step(G.st);
        for (const e of G.st.events) onEvent(e);
        G.st.events.length = 0;
        G.acc -= S.DT; n++;
        if (G.st.over) break;
      }
      if (n >= 12 && !G.fast) G.acc = 0;
      if (G.st.over) { G.endWait = (G.endWait || 0); }
    }
    if (G.scene === 'battle' && G.st && G.st.over) {
      G.endWait = (G.endWait || 0) + dt;
      if (G.endWait > (G.fast ? 0.05 : 1.2)) { G.endWait = 0; endBattle(); }
    }
    const fdt = (G.scene === 'battle' && (G.paused || G.overlay)) ? 0 : dt * (G.scene === 'battle' ? Math.min(G.speed, 2) : 1);
    for (const f of G.fx) f.t += fdt;
    G.fx = G.fx.filter((f) => f.t < f.life);
    for (const t of G.texts) t.t += fdt;
    G.texts = G.texts.filter((t) => t.t < t.life);
    for (const b of G.bubbles) b.t += fdt;
    G.bubbles = G.bubbles.filter((b) => b.t < b.life);
    for (const t of G.ticker) t.t += dt;
    if (G.banner) { G.banner.t += fdt; if (G.banner.t >= G.banner.life) G.banner = null; }
  }

  function draw() {
    G.buttons = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    switch (G.scene) {
      case 'sheet': drawSheet(); break;
      case 'title': drawTitle(); break;
      case 'story': drawStory(); break;
      case 'plan': drawPlan(); break;
      case 'battle': drawBattle(); break;
      case 'result': drawResult(); break;
      case 'gift': drawGift(); break;
      case 'ending': drawEnding(); break;
    }
    if (G.overlay) { const keep = G.buttons; G.buttons = []; drawOverlay(); if (!G.buttons.length) G.buttons = keep; }
    // カーソル
    const hb = hitButton(G.mouse.x, G.mouse.y);
    cv.style.cursor = (hb && hb.onClick) || (G.scene === 'plan' && G.hoverSlot) || G.scene === 'story' ? 'pointer' : 'default';
  }

  let lastTs = 0;
  function frame(ts) {
    const dt = lastTs ? clamp((ts - lastTs) / 1000, 0, 0.1) : 0;
    lastTs = ts;
    try { update(dt); draw(); } catch (err) { console.error(err); G.lastError = String(err && err.stack || err); }
    requestAnimationFrame(frame);
  }

  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    cv.style.width = Math.floor(W * s) + 'px';
    cv.style.height = Math.floor(H * s) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();
  R.init();
  if (location.search.indexOf('sheet') >= 0) G.scene = 'sheet';
  A.music(null);
  requestAnimationFrame(frame);

  // ---------------- 検証用の窓口 ----------------
  window.K20 = {
    G, S, D,
    save: () => save,
    buttons: () => G.buttons.map((b) => ({ key: b.key, label: b.label, x: b.x + b.w / 2, y: b.y + b.h / 2, w: b.w, h: b.h, enabled: !!b.onClick })),
    slotScreen: (id) => { const s = S.slots[id]; const p = R.iso(s.wx, s.wy, s.wz); return { x: p.x * SC, y: p.y * SC - 6 }; },
    state: () => ({ scene: G.scene, overlay: G.overlay, night: G.waveIdx[0], wave: G.waveIdx[1], waveId: G.wave && G.wave.id, pl: Object.assign({}, G.pl), sel: G.sel, t: G.st ? +G.st.t.toFixed(2) : null, lamps: G.st ? G.st.lamps : null, over: G.st ? G.st.over : null, result: G.result ? { win: G.result.win, lamps: G.result.sum.lamps } : null, story: G.story ? G.story.i + '/' + G.story.lines.length : null, err: G.lastError || null }),
    goto: (n, w) => { gotoPlan(n, w, true); },
    setPl: (pl) => { G.pl = Object.assign({}, pl); reanalyze(); },
    fast: (v) => { G.fast = v || 0; },
    hold: (v) => { G.hold = !!v; },
    step: (n) => { for (let i = 0; i < (n || 1); i++) { if (!G.st || G.st.over) break; S.step(G.st); for (const e of G.st.events) onEvent(e); G.st.events.length = 0; } },
    tick: (sec) => { update(sec || 1 / 60); draw(); },
    morning: (n) => { showMorning(n); },
    ending: () => { save.finished = true; showEnding(); },
    reset: () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ } save = defaultSave(); },
  };
})();
