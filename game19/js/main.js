// せーの、星見の露台へ — 画面・入力・演出・保存
(function () {
  'use strict';
  const S = window.S19, R = window.R19, D = window.D19, SP = window.SPR19, A = window.A19;
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const low = document.createElement('canvas'); low.width = R.LW; low.height = R.LH;
  const lx = low.getContext('2d');
  lx.imageSmoothingEnabled = false; ctx.imageSmoothingEnabled = false;
  const FONT = '"BIZ UDPGothic","Yu Gothic UI","Meiryo","Hiragino Sans",sans-serif';
  const HC = { gard: S.HERO.gard.color, riko: S.HERO.riko.color, sena: S.HERO.sena.color };
  const NAME = { gard: 'ガルド', riko: 'リコ', sena: 'セナ', narr: '' };
  const SAVE_KEY = 'g19_seeno_save';
  const OPT_KEY = 'g19_seeno_opt';
  const QS = new URLSearchParams(location.search);

  function fit() {
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    cv.style.width = Math.floor(1280 * s) + 'px';
    cv.style.height = Math.floor(720 * s) + 'px';
  }
  window.addEventListener('resize', fit); fit();

  // ---------- 状態 ----------
  const G = {
    scene: 'title', t: 0, st: null, vs: null, sec: null, secIdx: 0,
    disp: {}, odisp: {}, queue: [], cur: null, busy: false,
    sel: 'gard', hover: null, hv: null, undo: [], entry: null, combatEntry: null, phaseStart: null,
    fx: [], lines: [], pops: [], bubbles: [], caption: null, banner: null, bloom: null, poi: [],
    shake: 0, camOff: [0, 0], camLook: null, buttons: [], mouse: [0, 0], mdown: false, drag: null,
    intents: [], reachTint: null, menu: false, help: false, loseMenu: false, trans: null,
    opt: { fast: false, vol: 0.7, on: true, rot: 0 }, playTime: 0, story: null, ending: null, firstFight: true, hintIdx: 0,
  };
  try { Object.assign(G.opt, JSON.parse(localStorage.getItem(OPT_KEY) || '{}')); } catch (e) { /* 保存なし */ }
  A.on = G.opt.on; A.vol = G.opt.vol;
  function saveOpt() { try { localStorage.setItem(OPT_KEY, JSON.stringify(G.opt)); } catch (e) { /* 無視 */ } }

  SP.build();

  // ---------- 保存 ----------
  function save() {
    if (!G.st || G.scene !== 'play') return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, sec: G.st.sec, st: G.st, entry: G.entry, time: G.playTime, rot: R.rot, sel: G.sel, firstFight: G.firstFight }));
    } catch (e) { /* 容量など */ }
  }
  function loadSave() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && s.v === 1 ? s : null; } catch (e) { return null; }
  }

  // ---------- 区画 ----------
  function secDef(id) { return D.byId(id); }
  function startSection(id, carry) {
    const def = secDef(id);
    G.sec = def; G.secIdx = D.SECTIONS.indexOf(def);
    G.st = S.create(def, carry);
    G.entry = S.clone(G.st);
    enterPlay();
    G.banner = { text: def.sub + '　' + def.name, sub: '目的：' + def.goal, t: 0, life: 2.6, big: true };
    // はじめに、遠くの目的地を見わたす
    const looks = def.looks || [def.look || (() => { const o = G.st.objs.find(q => q.k === 'exit' || q.k === 'lantern'); return o ? [o.x, o.y] : null; })()];
    G.camLooks = looks.filter(Boolean).map((p, k) => ({ x: p[0], y: p[1], z: S.surface(G.st, p[0], p[1]).void ? S.standZ(G.st, p[0], p[1]) : S.surface(G.st, p[0], p[1]).z, t: 0, life: looks.length > 1 ? 1.5 : 2.3, intro: true }));
    G.camLook = G.camLooks.shift() || null;
    if (def.enterSay) for (const s of def.enterSay) say(s[0], s[1]);
    A.bgm(def.music || 'explore');
    if (def.startFight) {
      // 入ったとたんに戦い
      const prev = S.clone(G.st);
      const evs = [];
      G.combatEntry = S.clone(G.st);
      S.startCombat(G.st, def.startFight, evs);
      G.combatStarted = G.st.stats.fights;
      G.vs = prev;
      queue(evs);
    }
    save();
  }
  function enterPlay() {
    G.scene = 'play';
    titleDirty = false;
    G.vs = S.clone(G.st);
    G.disp = {}; G.odisp = {}; G.queue = []; G.cur = null; G.busy = false;
    G.undo = []; G.fx = []; G.lines = []; G.pops = []; G.bloom = null; G.poi = []; G.caption = null;
    G.loseMenu = false; G.menu = false; G.camOff = [0, 0]; G.hintMark = null;
    R.resetCache(G.st);
    R.goalLit = 0; R.starsLit = 0;
    const u = S.unitById(G.st, G.sel);
    if (!u || u.ko) G.sel = 'gard';
    snapCam();
    refresh();
  }
  function resume(sv) {
    G.sec = secDef(sv.sec); G.secIdx = D.SECTIONS.indexOf(G.sec);
    G.st = sv.st; G.entry = sv.entry || S.clone(sv.st); G.playTime = sv.time || 0; R.rot = sv.rot || 0; G.sel = sv.sel || 'gard';
    G.firstFight = sv.firstFight !== undefined ? sv.firstFight : true;
    enterPlay();
    G.banner = { text: G.sec.sub + '　' + G.sec.name, sub: '目的：' + G.sec.goal, t: 0, life: 2.0, big: true };
    A.bgm(G.st.mode === 'combat' ? 'combat' : (G.sec.music || 'explore'));
    if (G.st.mode === 'combat') { G.phaseStart = S.clone(G.st); G.combatEntry = G.combatEntry || S.clone(G.st); }
  }
  function carryOf(st) { return { up: st.up, items: st.items, stats: st.stats, moments: st.moments }; }

  // ---------- 吹き出し・字幕 ----------
  function say(who, text) {
    if (G.bubbles.some(b => b.text === text)) return;
    G.bubbles.push({ who, text, t: 0, life: 2.2 + text.length * 0.065 });
    if (G.bubbles.length > 4) G.bubbles.splice(1, 1);
  }
  function popup(x, y, z, text, col, big) { G.pops.push({ x, y, z, text, col: col || '#fff', t: 0, life: big ? 1.6 : 1.1, big }); }

  // ---------- 演出の再生 ----------
  const STEP_EX = 0.1, STEP_CB = 0.12, STEP_EN = 0.075;
  function speed() { return (G.opt.fast ? 1.8 : 1) * (G.ff ? 2.6 : 1); }
  function queue(evs) { for (const e of evs) G.queue.push(e); G.busy = true; }
  function segs(path, stepT) {
    const out = []; let tot = 0;
    for (let k = 1; k < path.length; k++) {
      const a = path[k - 1], b = path[k];
      const man = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
      let d = stepT;
      if (man > 1) d = stepT * 1.6 + man * 0.05;
      else if (man === 0) d = 0.16 + Math.abs(a[2] - b[2]) * 0.025;
      else if (b[2] < a[2]) d += Math.min(0.12, (a[2] - b[2]) * 0.03);
      out.push({ a, b, d, t0: tot, link: man > 1, drop: a[2] - b[2] }); tot += d;
    }
    return { list: out, total: tot };
  }
  function evDur(e) {
    switch (e.k) {
      case 'walk': if (!e._s) e._s = segs(e.path, e.enemy ? STEP_EN : (G.st.mode === 'combat' ? STEP_CB : STEP_EX)); return e._s.total;
      case 'group': return Math.max(0, ...e.evs.map(evDur));
      case 'slide': if (!e._s) e._s = segs(e.path, (e.roll || e.slip) ? 0.075 : 0.13); return e._s.total + 0.05;
      case 'act': return 0.17;
      case 'arrow': return 0.2;
      case 'rope': return 0.24;
      case 'zip': return 0.34;
      case 'frost': return 0.22;
      case 'freezeCells': return 0.36;
      case 'freezeUnit': return 0.14;
      case 'freezeFall': return 0.6;
      case 'fall': return 0.16 + Math.min(0.3, (e.drop || 1) * 0.03);
      case 'bump': return 0.14;
      case 'dmg': return 0.1;
      case 'ko': return 0.3;
      case 'sink': return 0.36;
      case 'break': return 0.22;
      case 'topple': return 0.6;
      case 'target': return 0.18;
      case 'lower': return 0.6;
      case 'open': return 0.55;
      case 'plate': return 0.18;
      case 'collect': return 0.45;
      case 'iceblock': return 0.2;
      case 'caption': return 0.1;
      case 'bloom': return 0.45;
      case 'combat': return 0.95;
      case 'phase': return 0.32;
      case 'eatk': return 0.28;
      case 'frozenSkip': return 0.28;
      case 'win': return 1.05;
      case 'lose': return 0.9;
      case 'light': return 3.2;
      case 'drain': case 'calm': case 'linkShow': return 0.7;
      default: return 0;
    }
  }
  function startEv(e) {
    const c = { e, t: 0, dur: evDur(e) };
    G.cur = c;
    onStart(e, c);
  }
  function stepAnim(dt) {
    let guard = 0;
    while (guard++ < 200) {
      if (!G.cur) {
        if (!G.queue.length) { if (G.busy) { G.busy = false; onIdle(); } return; }
        startEv(G.queue.shift());
      }
      const c = G.cur;
      c.t += dt * speed();
      dt = 0;
      onUpdate(c.e, Math.min(1, c.dur > 0 ? c.t / c.dur : 1), c.t);
      if (c.t >= c.dur) { onFinish(c.e); G.cur = null; continue; }
      return;
    }
  }
  function U(id) { return S.unitById(G.vs, id); }
  function O(id) { return S.objById(G.vs, id); }
  function dispOf(id) { if (!G.disp[id]) { const u = U(id); G.disp[id] = u ? { x: u.x, y: u.y, z: u.z } : { x: 0, y: 0, z: 0 }; } return G.disp[id]; }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function ease(p) { return p * p * (3 - 2 * p); }

  function onStart(e, c) {
    switch (e.k) {
      case 'group': for (const s of e.evs) { s._c = { t: 0, dur: evDur(s) }; onStart(s, s._c); } break;
      case 'act': {
        const d = dispOf(e.id); const u = U(e.id);
        d.pose = 'act'; d.sd = R.sdir(S.faceTo(u.x, u.y, e.tx, e.ty, u.face));
        if (e.verb === 'push') A.sfx('grunt');
        if (e.verb === 'shoot') A.sfx('draw');
        if (e.verb === 'rope') A.sfx('rope');
        if (e.verb === 'freeze') A.sfx('charge');
        G.camFocusOverride = [e.tx, e.ty, e.tz];
        break;
      }
      case 'arrow': A.sfx('arrow'); G.lines.push({ k: 'arrow', from: e.from, to: e.to, t: 0, dur: c.dur }); break;
      case 'rope': G.lines.push({ k: 'ropeThrow', from: e.from, to: e.to, t: 0, dur: c.dur }); break;
      case 'zip': A.sfx('zip'); break;
      case 'frost': for (let k = 0; k < 14; k++) G.fx.push({ k: 'frost', from: e.from, to: e.to, t: -k * 0.012, life: c.dur, x: 0, y: 0, z: 0 }); break;
      case 'freezeCells': A.sfx('frost'); e._done = {}; break;
      case 'freezeUnit': { A.sfx('crack'); const u = U(e.id); if (u) { u.frozen = 2; burst(u.x, u.y, u.z + 1, 10, '#c8f4ff', 1.5); } break; }
      case 'freezeFall':
        A.sfx('frost'); setTimeout(() => A.sfx('crack'), 150);
        if (e.final) { setTimeout(() => A.sfx('light'), 350); G.banner = { text: '凍らぬ滝が、凍った', sub: '二十年前に引き返した道が、つながった', t: 0, life: 2.8, col: '#bfefff' }; G.shake = Math.max(G.shake, 0.3); }
        break;
      case 'slide': A.sfx(e.roll ? 'rumble' : (e.slip ? 'scrape' : 'push'), { d: c.dur }); e._landed = {}; break;
      case 'bump': A.sfx('bonk'); break;
      case 'dmg': {
        const u = U(e.id); if (!u) break;
        const d = dispOf(e.id); d.flash = 1;
        A.sfx(u.team === 'h' ? 'hurt' : 'hit');
        const dd = G.disp[e.id] || u;
        popup(dd.x, dd.y, dd.z + 2.6, '−' + e.n, u.team === 'h' ? '#ff6a5a' : '#fff2a0', e.n >= 3);
        if (u.team === 'h') G.shake = Math.max(G.shake, 0.18);
        break;
      }
      case 'ko': {
        const u = U(e.id); if (!u) break;
        const d = G.disp[e.id] || u;
        if (e.how === 'hp' || e.how === 'enemy' || e.how === 'push' || e.how === 'arrow' || e.how === 'frost' || e.how === 'bump' || e.how === 'fall' || e.how === 'crush' || e.how === 'rock') { burst(d.x, d.y, d.z + 1, 16, u.team === 'h' ? '#ffffff' : '#e8e0ff', 2.2); A.sfx('ko'); }
        if (e.how === 'void') A.sfx('fallaway');
        if (e.how === 'drown') { A.sfx('splash'); splash(d.x, d.y, d.z); }
        if (e.how === 'ice') { A.sfx('crack'); burst(d.x, d.y, d.z + 0.5, 12, '#c8f4ff', 1.6); }
        break;
      }
      case 'sink': A.sfx('splash'); splash(e.x, e.y, e.z); break;
      case 'break': A.sfx('crash'); burst(e.x, e.y, e.z, 16, '#b98a52', 2.5); break;
      case 'topple': A.sfx('grunt'); setTimeout(() => A.sfx('crash'), 380); break;
      case 'target': A.sfx('ding'); break;
      case 'lower': A.sfx('chain'); break;
      case 'open': A.sfx('door'); break;
      case 'plate': A.sfx('click'); A.sfx('ding'); break;
      case 'collect': {
        const isPage = e.item && e.item.indexOf('page') === 0;
        A.sfx(isPage ? 'page' : 'chest');
        burst(e.x, e.y, (e.z || 0) + 1, 18, '#fff0a0', 2);
        popup(e.x, e.y, (e.z || 0) + 3, itemName(e.item), '#ffe6a0', true);
        break;
      }
      case 'iceblock': A.sfx('crack'); break;
      case 'say': say(e.who, e.text); break;
      case 'caption': G.caption = { who: e.who, text: e.text, combo: e.combo, t: 0 }; if (e.combo) A.sfx('select', { f: 990 }); break;
      case 'bloom': startBloom(e); break;
      case 'combat': {
        A.sfx('combat'); A.bgm('combat');
        const cn = e.cancel;
        G.banner = { text: '戦い', sub: G.firstFight ? '赤い線は「手番を終えたときの敵の動き」。手番を終えるまでは Z で何度でも戻せる' : cn ? '歩く途中で、敵に気づかれた' : '地形を使って切りぬけよう', t: 0, life: G.firstFight ? 3.4 : cn ? 2.2 : 1.4, col: '#ff8a6a' };
        G.firstFight = false;
        if (cn) G.caption = { who: [cn.who], text: '「' + cn.verb + '」は取りやめ。歩く途中で敵に気づかれた（戦いの中で、もう一度ねらえる）', t: 0 };
        break;
      }
      case 'phase': {
        if (e.side === 'enemy') { A.sfx('eturn'); G.banner = { text: '敵の手番', t: 0, life: 0.7, col: '#ff8a6a', small: true }; }
        else { A.sfx('turn'); G.banner = { text: '第' + e.turn + '手番', t: 0, life: 0.8, col: '#a8e0ff', small: true }; }
        break;
      }
      case 'eatk': {
        if (e.ranged) { A.sfx('arrow'); G.lines.push({ k: 'earrow', from: e.from, to: e.to, t: 0, dur: c.dur * 0.7 }); }
        else A.sfx('grunt');
        break;
      }
      case 'frozenSkip': { const u = U(e.id); if (u) popup(u.x, u.y, u.z + 2.4, '凍って動けない', '#bfefff'); break; }
      case 'win': A.sfx('win'); A.bgm(G.sec.music || 'explore'); G.banner = { text: '切りぬけた！', sub: '三人とも、体勢を立てなおした', t: 0, life: 1.6, col: '#ffe08a' }; break;
      case 'lose': A.sfx('lose'); A.bgm(null); G.banner = { text: '三人とも倒れた…', sub: '', t: 0, life: 99, col: '#ff8a6a' }; break;
      case 'light': {
        A.sfx('light'); A.bgm('ending');
        G.banner = { text: 'せーの！', t: 0, life: 1.6, col: '#ffe9a0' };
        for (const id of S.HERO_IDS) { const d = dispOf(id); d.pose = 'act'; }
        const L = O(e.o); if (L) burst(L.x, L.y, L.z + 2.5, 40, '#fff0b0', 3);
        break;
      }
      case 'drain': A.sfx('rumble'); A.sfx('splash'); break;
      case 'calm': A.sfx('rumble'); break;
      case 'linkShow': A.sfx('chain'); break;
      case 'exit': break;
    }
  }

  function onUpdate(e, p, t) {
    switch (e.k) {
      case 'group': for (const s of e.evs) { const sp = Math.min(1, s._c.dur > 0 ? t / s._c.dur : 1); onUpdate(s, sp, Math.min(t, s._c.dur)); } break;
      case 'walk': {
        const d = dispOf(e.id); const S2 = e._s;
        const tt = Math.min(t, S2.total);
        let sg = S2.list[S2.list.length - 1];
        for (const s of S2.list) { if (tt < s.t0 + s.d) { sg = s; break; } }
        if (!sg) break;
        const q = Math.max(0, Math.min(1, (tt - sg.t0) / sg.d));
        const [ax, ay, az] = sg.a, [bx, by, bz] = sg.b;
        if (sg.link) {
          d.x = lerp(ax, bx, q); d.y = lerp(ay, by, q); d.z = lerp(az, bz, q) - Math.sin(q * Math.PI) * 0.5;
          d.pose = 'act';
        } else {
          const qq = sg.drop > 0 ? Math.min(1, q * 1.5) : q;
          d.x = lerp(ax, bx, qq); d.y = lerp(ay, by, qq);
          if (bz > az) d.z = az + (bz - az) * Math.min(1, q * 2.2) + Math.sin(q * Math.PI) * 0.35;
          else if (bz < az) d.z = q < 0.45 ? az + Math.sin(q / 0.45 * Math.PI / 2) * 0.3 : lerp(az + 0.3, bz, (q - 0.45) / 0.55);
          else d.z = az + Math.sin(q * Math.PI) * 0.18;
          d.pose = ((sg.t0 / (S2.list[0].d || 0.1)) | 0) % 2 ? 'walk1' : 'walk2';
        }
        const dir = S.faceTo(ax, ay, bx, by, 0);
        if (ax !== bx || ay !== by) d.sd = R.sdir(dir);
        if (sg !== e._lastSeg) { e._lastSeg = sg; if (!e.follow) A.sfx('step'); }
        break;
      }
      case 'act': break;
      case 'zip': {
        const d = dispOf(e.id);
        const q = ease(p);
        d.x = lerp(e.from[0], e.to[0], q); d.y = lerp(e.from[1], e.to[1], q);
        d.z = lerp(e.from[2], e.to[2], q) + Math.sin(q * Math.PI) * 0.8;
        d.pose = 'act';
        break;
      }
      case 'slide': {
        const key = e.ref.u || e.ref.o;
        const isU = !!e.ref.u;
        const d = isU ? dispOf(key) : (G.odisp[key] || (G.odisp[key] = Object.assign({}, O(key))));
        const S2 = e._s;
        const tt = Math.min(t, S2.total);
        let sg = S2.list[S2.list.length - 1];
        let idx = S2.list.length - 1;
        for (let k = 0; k < S2.list.length; k++) { const s = S2.list[k]; if (tt < s.t0 + s.d) { sg = s; idx = k; break; } }
        if (!sg) break;
        const q = Math.max(0, Math.min(1, (tt - sg.t0) / sg.d));
        const [ax, ay, az] = sg.a, [bx, by, bz] = sg.b;
        if (ax === bx && ay === by) {
          // まっすぐ落ちる（谷底）
          d.x = bx; d.y = by; d.z = lerp(az, bz, q * q);
          if (bz < az - 6) d.alpha = 1 - q;
        } else if (bz < az) {
          const qh = Math.min(1, q / 0.4);
          d.x = lerp(ax, bx, qh); d.y = lerp(ay, by, qh);
          d.z = q < 0.4 ? az : lerp(az, bz, ((q - 0.4) / 0.6) ** 2);
        } else { d.x = lerp(ax, bx, q); d.y = lerp(ay, by, q); d.z = az; }
        if (e.roll) d.roll = (d.roll || 0) + 0.25;
        // 一つ前の区切りで着地していたら音
        for (let k = 0; k < idx; k++) {
          const s = S2.list[k];
          if (!e._landed[k] && s.drop > 0 && !(s.a[0] === s.b[0] && s.a[1] === s.b[1])) { e._landed[k] = 1; land(s.b[0], s.b[1], s.b[2], s.drop); }
        }
        break;
      }
      case 'fall': {
        const key = e.ref.u || e.ref.o;
        const d = e.ref.u ? dispOf(key) : (G.odisp[key] || (G.odisp[key] = Object.assign({}, O(key))));
        d.x = e.to[0]; d.y = e.to[1]; d.z = lerp(e.from[2], e.to[2], p * p);
        break;
      }
      case 'bump': {
        const key = e.ref.u || e.ref.o;
        const d = e.ref.u ? dispOf(key) : (G.odisp[key] || (G.odisp[key] = Object.assign({}, O(key))));
        const [dx, dy] = S.DIRS[e.dir];
        const k = Math.sin(p * Math.PI) * 0.18;
        d.x = e.x + dx * k; d.y = e.y + dy * k; d.z = e.z;
        break;
      }
      case 'dmg': { const d = G.disp[e.id]; if (d) d.flash = 1 - p; break; }
      case 'ko': {
        if (e.how === 'hp' || e.how === 'push' || e.how === 'arrow' || e.how === 'frost' || e.how === 'bump' || e.how === 'fall' || e.how === 'crush' || e.how === 'rock') {
          const u = U(e.id); if (u && u.team === 'e') { const d = dispOf(e.id); d.alpha = 1 - p; d.flash = 1 - p; }
        }
        if (e.how === 'drown') { const d = dispOf(e.id); d.z = (d.z0 === undefined ? (d.z0 = d.z) : d.z0) - p * 1.2; d.alpha = 1 - p; }
        break;
      }
      case 'sink': {
        const d = G.odisp[e.ref.o] || (G.odisp[e.ref.o] = Object.assign({}, O(e.ref.o)));
        d.x = e.x; d.y = e.y; d.z = lerp(e.z, e.z - 1, p);
        if (p > 0.95) d.hide = true;
        break;
      }
      case 'topple': {
        const d = G.odisp[e.o] || (G.odisp[e.o] = Object.assign({}, O(e.o)));
        d.hide = true; G.topple = { o: e, p: p * p };
        if (p >= 1) G.topple = null;
        break;
      }
      case 'lower': R.bridgeProg = R.bridgeProg || {}; R.bridgeProg[e.o] = ease(p); { const o = O(e.o); if (o) o.down = true; } break;
      case 'open': { const d = G.odisp[e.o] || (G.odisp[e.o] = Object.assign({}, O(e.o))); d.lift = 22 * ease(p); break; }
      case 'freezeCells': {
        const st = G.vs;
        for (const [x, y] of e.cells) {
          const k = x + ',' + y;
          const dd = Math.hypot(x - (e.cx === undefined ? x : e.cx), y - (e.cy === undefined ? y : e.cy));
          if (!e._done[k] && p >= dd * 0.28) {
            e._done[k] = 1;
            const i = S.idx(st, x, y); st.t[i] = 'i'; st.by[i] = 'sena';
            burst(x, y, st.h[i] + 0.2, 5, '#dff8ff', 1.2);
            if (Object.keys(e._done).length % 2) A.sfx('crack');
          }
        }
        break;
      }
      case 'freezeFall': { const o = O(e.o); if (o && p > 0.3 && !o.frozen) { o.frozen = true; burst(o.bx, o.by, o.bz + 2, 20, '#dff8ff', 2.2); } break; }
      case 'eatk': {
        if (!e.ranged) {
          const d = dispOf(e.id);
          const k = Math.sin(Math.min(1, p * 1.4) * Math.PI) * 0.35;
          d.x = e.from[0] + (e.to[0] - e.from[0]) * k; d.y = e.from[1] + (e.to[1] - e.from[1]) * k; d.z = e.from[2];
          d.pose = 'act'; d.sd = R.sdir(S.faceTo(e.from[0], e.from[1], e.to[0], e.to[1], 0));
        }
        break;
      }
      case 'light': {
        R.goalLit = Math.min(1, p * 1.6);
        R.starsLit = Math.max(0, (p - 0.35) / 0.65);
        if (p > 0.05) { const o = O(e.o); if (o) o.lit = true; }
        break;
      }
    }
  }

  function onFinish(e) {
    switch (e.k) {
      case 'group': for (const s of e.evs) onFinish(s); break;
      case 'walk': {
        const u = U(e.id); const last = e.path[e.path.length - 1];
        if (u) { u.x = last[0]; u.y = last[1]; u.z = last[2]; if (e.path.length > 1) { const a = e.path[e.path.length - 2]; u.face = S.faceTo(a[0], a[1], last[0], last[1], u.face); } }
        delete G.disp[e.id];
        break;
      }
      case 'act': { const d = G.disp[e.id]; if (d) d.pose = 'act'; break; }
      case 'zip': { const u = U(e.id); if (u) { u.x = e.to[0]; u.y = e.to[1]; u.z = e.to[2]; } delete G.disp[e.id]; land(e.to[0], e.to[1], e.to[2], 1); break; }
      case 'rope': { const L = e.link; G.vs.links = G.vs.links.filter(l => l.o !== L.o); G.vs.links.push(L); A.sfx('thunk'); break; }
      case 'arrow': if (e.target) { const o = O(e.target); if (o) o.hit = true; } A.sfx('thunk'); break;
      case 'slide': {
        const key = e.ref.u || e.ref.o; const last = e.path[e.path.length - 1];
        const ent = e.ref.u ? U(key) : O(key);
        if (ent) { ent.x = last[0]; ent.y = last[1]; ent.z = last[2]; }
        const S2 = e._s;
        S2.list.forEach((s, k) => { if (!e._landed[k] && s.drop > 0 && !(s.a[0] === s.b[0] && s.a[1] === s.b[1])) land(s.b[0], s.b[1], s.b[2], s.drop); });
        if (e.ref.u) { delete G.disp[key]; } else delete G.odisp[key];
        if (last[2] < -20 || (e.path.length >= 2 && last[2] < e.path[e.path.length - 2][2] - 6)) { if (ent) ent.gone = true; }
        break;
      }
      case 'fall': { const key = e.ref.u || e.ref.o; const ent = e.ref.u ? U(key) : O(key); if (ent) { ent.z = e.to[2]; } land(e.to[0], e.to[1], e.to[2], e.drop || 1); if (e.ref.u) delete G.disp[key]; else delete G.odisp[key]; break; }
      case 'bump': { const key = e.ref.u || e.ref.o; if (e.ref.u) delete G.disp[key]; else delete G.odisp[key]; break; }
      case 'dmg': { const u = U(e.id); if (u) u.hp = e.hp; const d = G.disp[e.id]; if (d) d.flash = 0; break; }
      case 'ko': { const u = U(e.id); if (u) { u.ko = true; if (u.team === 'e' || e.how === 'void' || e.how === 'drown') u.gone = true; } delete G.disp[e.id]; break; }
      case 'sink': { const o = O(e.ref.o); if (o) o.gone = true; const i = S.idx(G.vs, e.x, e.y); G.vs.t[i] = e.t; delete G.odisp[e.ref.o]; break; }
      case 'lost': { const key = e.ref.u || e.ref.o; const ent = e.ref.u ? U(key) : O(key); if (ent) ent.gone = true; break; }
      case 'break': { const o = O(e.ref.o); if (o) o.gone = true; delete G.odisp[e.ref.o]; break; }
      case 'topple': {
        const o = O(e.o); if (o) o.gone = true; delete G.odisp[e.o];
        for (const b of e.beams) G.vs.objs.push(S.clone(b));
        for (const b of e.beams) burst(b.x, b.y, b.z + 0.5, 8, '#b6b2c4', 2);
        G.shake = Math.max(G.shake, 0.4); G.topple = null;
        break;
      }
      case 'iceblock': G.vs.objs.push(S.clone(e.o)); break;
      case 'freezeCells': { for (const [x, y] of e.cells) { const i = S.idx(G.vs, x, y); G.vs.t[i] = 'i'; G.vs.by[i] = 'sena'; } break; }
      case 'freezeFall': { const o = O(e.o); if (o) o.frozen = true; G.vs.links.push(e.link); for (const [x, y] of e.cells) { const i = S.idx(G.vs, x, y); G.vs.t[i] = 'i'; } break; }
      case 'target': { const o = O(e.o); if (o) o.hit = true; break; }
      case 'lower': { const o = O(e.o); if (o) o.down = true; if (R.bridgeProg) delete R.bridgeProg[e.o]; G.shake = Math.max(G.shake, 0.2); const st = G.vs; for (const c of (o ? o.cells : [])) burst(c[0], c[1], o.z, 4, '#a07850', 1.2); A.sfx('thud', { big: 1 }); break; }
      case 'open': { const o = O(e.o); if (o) o.open = true; delete G.odisp[e.o]; break; }
      case 'plate': { const o = O(e.o); if (o) o.done = true; break; }
      case 'collect': { const o = O(e.o); if (o) o.open = true; break; }
      case 'combat': G.vs.mode = 'combat'; break;
      case 'win': G.vs.mode = 'explore'; break;
      case 'lose': G.loseMenu = true; break;
      case 'drain': for (const [x, y, z] of e.cells) { const i = S.idx(G.vs, x, y); G.vs.t[i] = 'd'; G.vs.h[i] = z; } break;
      case 'calm': { const o = O(e.o); if (o) o.strong = e.left || false; break; }
      case 'linkShow': { const L = G.vs.links.find(l => l.id === e.id); if (L) L.hidden = false; break; }
      case 'exit': G.pendingExit = e.to; break;
      case 'light': G.pendingEnding = true; break;
    }
  }

  function land(x, y, z, drop) {
    A.sfx('thud', { big: Math.min(3, drop) });
    burst(x, y, z + 0.1, 6 + drop * 3, '#a89c8c', 1 + drop * 0.3, true);
    G.shake = Math.max(G.shake, Math.min(0.45, 0.08 + drop * 0.08));
  }
  function burst(x, y, z, n, col, spd, dust) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random()) * (spd || 1);
      G.fx.push({ k: 'p', x, y, z, vx: Math.cos(a) * s * 0.9, vy: Math.sin(a) * s * 0.9, vz: dust ? Math.random() * 1.5 : 1 + Math.random() * 3, g: dust ? 2 : 9, t: 0, life: 0.35 + Math.random() * 0.4, col, sz: Math.random() < 0.3 ? 2 : 1 });
    }
  }
  function splash(x, y, z) {
    for (let k = 0; k < 18; k++) { const a = Math.random() * 6.28; G.fx.push({ k: 'p', x, y, z, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2, vz: 2 + Math.random() * 4, g: 12, t: 0, life: 0.5, col: '#bfe6ff', sz: 1 }); }
  }
  function startBloom(e) {
    if (!e.cells.length) return;
    // 波のはじまり：行動した者のまわり
    const st = G.st;
    let ox = e.cells[0][0], oy = e.cells[0][1];
    const lead = S.unitById(st, (e.who && e.who[0]) || G.sel);
    if (lead) { ox = lead.x; oy = lead.y; }
    const cells = e.cells.map(c => [c[0], c[1], c[2], Math.hypot(c[0] - ox, c[1] - oy)]);
    const maxd = Math.max(...cells.map(c => c[3]), 1);
    G.bloom = { cells, t: 0, maxd, dur: 0.5 + maxd * 0.07 };
    A.sfx('bloom', { size: Math.min(3, Math.floor(e.cells.length / 6)) });
    G.poi = e.poi.map(id => ({ id, t: 0 }));
    if (e.cells.length >= 3) G.caption2 = { text: '道がひらけた！ 新しく ' + e.cells.length + ' マスに行ける', t: 0 };
    // 遠い見どころがあれば、少しそちらを見る
    const far = e.poi.map(id => S.objById(st, id)).filter(o => o && (o.k === 'exit' || o.k === 'chest' || o.k === 'anchor'))[0];
    if (far) G.camLook = { x: far.x, y: far.y, z: (S.surface(st, far.x, far.y).z || 0), t: 0, life: 1.3 };
  }

  function onIdle() {
    G.vs = S.clone(G.st);
    G.disp = {}; G.odisp = {}; G.camFocusOverride = null; G.ff = false;
    if (R.bridgeProg) R.bridgeProg = {};
    if (G.pendingEnding) { G.pendingEnding = false; beginEnding(); return; }
    if (G.pendingExit) { const to = G.pendingExit; G.pendingExit = null; G.trans = { t: 0, to }; return; }
    const st = G.st;
    if (st.mode === 'combat') {
      if (!G.combatEntry || G.combatEntry.turn === undefined || G.combatStarted !== G.st.stats.fights) { G.combatEntry = S.clone(G.entryBeforeFight || st); G.combatStarted = G.st.stats.fights; }
      const u = S.unitById(st, G.sel);
      if (!u || u.ko || u.acted) {
        const nx = S.heroes(st).find(h => !h.ko && !h.acted);
        if (nx) G.sel = nx.id;
      }
      if (!G.phaseStart || G.phaseStart.turn !== st.turn) { G.phaseStart = S.clone(st); G.undo = []; }
    } else {
      G.phaseStart = null;
    }
    refresh();
    save();
  }

  // 選択や状態がかわったら、表示用の情報をつくりなおす
  function refresh() {
    const st = G.st;
    G.intents = st.mode === 'combat' ? S.intents(st) : [];
    G.reachTint = null;
    const u = S.unitById(st, G.sel);
    if (st.mode === 'combat' && u && !u.ko && !u.acted && u.mv > 0) {
      const m = S.reach(st, u, { max: u.mv, linkCost: 2 });
      G.reachTint = {};
      for (const [i] of m) { const x = i % st.W, y = (i / st.W) | 0; if (!S.unitAt(st, x, y, u)) G.reachTint[i] = 1; }
    }
    G.hv = null;
    computeHover();
  }

  // ---------- 入力 ----------
  function toCanvas(ev) {
    const r = cv.getBoundingClientRect();
    return [(ev.clientX - r.left) * 1280 / r.width, (ev.clientY - r.top) * 720 / r.height];
  }
  cv.addEventListener('mousemove', (ev) => {
    G.mouse = toCanvas(ev);
    if (G.drag) {
      const dx = (G.mouse[0] - G.drag.x) / 2, dy = (G.mouse[1] - G.drag.y) / 2;
      if (Math.abs(dx) + Math.abs(dy) > 3) G.drag.moved = true;
      if (G.drag.moved) { G.camOff[0] = G.drag.ox - dx; G.camOff[1] = G.drag.oy - dy; }
    }
    if (G.scene === 'play') computeHover();
  });
  cv.addEventListener('mousedown', (ev) => {
    A.init();
    G.mouse = toCanvas(ev);
    if (ev.button === 2 || ev.button === 1) { G.drag = { x: G.mouse[0], y: G.mouse[1], ox: G.camOff[0], oy: G.camOff[1], moved: false, btn: ev.button }; return; }
    click(G.mouse[0], G.mouse[1]);
  });
  cv.addEventListener('mouseup', (ev) => {
    if (G.drag && (ev.button === 2 || ev.button === 1)) {
      const moved = G.drag.moved; G.drag = null;
      if (!moved && ev.button === 2) rightClick();
    }
  });
  cv.addEventListener('contextmenu', (ev) => ev.preventDefault());
  cv.addEventListener('wheel', (ev) => { if (G.scene === 'play') { G.camOff[1] += ev.deltaY * 0.15; } ev.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', (ev) => {
    A.init();
    const k = ev.key;
    if (G.scene === 'title') { if (k === 'Enter' || k === ' ') { const b = G.buttons.find(b => b.key === 'cont') || G.buttons.find(b => b.key === 'new'); if (b) b.fn(); } return; }
    if (G.scene === 'story') { if (k === 'Enter' || k === ' ' || k === 'Escape') storyNext(k === 'Escape'); return; }
    if (G.scene === 'ending') { if (k === 'Enter' || k === ' ') endingNext(); return; }
    if (G.scene !== 'play') return;
    if (G.help) { if (k === 'Escape' || k === 'Enter' || k === ' ' || k === '?') G.help = false; return; }
    if (G.menu) { if (k === 'Escape') G.menu = false; return; }
    if (k === 'Escape') { G.menu = true; return; }
    if (k === 'm' || k === 'M') { toggleSound(); return; }
    if (G.loseMenu) return;
    if ((k === ' ' || k === 'Enter') && G.camLook && G.camLook.intro) { ev.preventDefault(); G.camLook = null; G.camLooks = []; return; }
    if (G.busy) {
      if (k === ' ' || k === 'Enter') G.ff = true;
      else if (k === '1' || k === '2' || k === '3') G.sel = { 1: 'gard', 2: 'riko', 3: 'sena' }[k];
      else if (k === 'Tab') ev.preventDefault();
      return;
    }
    if (k === '1') selectHero('gard');
    else if (k === '2') selectHero('riko');
    else if (k === '3') selectHero('sena');
    else if (k === 'Tab') { ev.preventDefault(); cycleHero(); }
    else if (k === 'z' || k === 'Z' || k === 'Backspace') undo();
    else if (k === 'q' || k === 'Q') rotate(-1);
    else if (k === 'e' || k === 'E') rotate(1);
    else if (k === 'h' || k === 'H') hint();
    else if (k === '?') G.help = true;
    else if (k === ' ' || k === 'Enter') { ev.preventDefault(); if (G.st.mode === 'combat' && G.t - (G.introEndT || -9) > 0.6) endTurn(); }
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') G.camOff[0] -= 24;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') G.camOff[0] += 24;
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') G.camOff[1] -= 20;
    else if (k === 'ArrowDown' || k === 's' || k === 'S') G.camOff[1] += 20;
  });
  window.addEventListener('keyup', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') G.ff = false; });

  function hitButton(x, y) {
    for (let k = G.buttons.length - 1; k >= 0; k--) { const b = G.buttons[k]; if (x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h && !b.off) return b; }
    return null;
  }
  function click(x, y) {
    const b = hitButton(x, y);
    if (b) { A.sfx('click'); b.fn(); return; }
    if (G.scene === 'story') { storyNext(false); return; }
    if (G.scene === 'ending') { endingNext(); return; }
    if (G.scene !== 'play') return;
    if (G.menu || G.help || G.loseMenu || G.trans) return;
    if (G.camLook && G.camLook.intro) { G.camLook = null; G.camLooks = []; return; }
    if (overBubble(x, y)) { G.bubbles.shift(); G.bubbleRect = null; A.sfx('click'); return; }
    if (G.busy) { G.ff = true; return; }
    computeHover();
    const hv = G.hv;
    if (!hv) return;
    if (hv.intent && hv.intent.k === 'select') { selectHero(hv.intent.id); return; }
    if (hv.plan && hv.plan.ok) { doAction(hv.plan); return; }
    if (hv.why) { A.sfx('deny'); G.denyT = 0.6; }
  }
  // 吹き出しの上か（出た直後の吹き出しは、押そうとしていたクリックを奪わないよう数えない）
  function overBubble(x, y) {
    const br = G.bubbleRect;
    return !!(br && G.bubbles.length && G.bubbles[0].t > 0.35 && x >= br.x && y >= br.y && x < br.x + br.w && y < br.y + br.h);
  }
  function rightClick() {
    if (G.scene !== 'play') return;
    if (G.menu) { G.menu = false; return; }
    if (G.help) { G.help = false; return; }
    if (G.busy) return;
    undo();
  }
  function selectHero(id) {
    const u = S.unitById(G.st, id);
    if (!u) return;
    if (G.sel !== id) { G.sel = id; A.sfx('select', { f: id === 'gard' ? 440 : id === 'riko' ? 660 : 880 }); }
    G.camOff = [0, 0];
    refresh();
  }
  function cycleHero() {
    const ids = S.HERO_IDS.filter(id => { const u = S.unitById(G.st, id); return u && !u.ko && !(G.st.mode === 'combat' && u.acted); });
    if (!ids.length) return;
    const k = ids.indexOf(G.sel);
    selectHero(ids[(k + 1) % ids.length]);
  }
  function rotate(d) {
    R.rot = (R.rot + d + 4) % 4;
    A.sfx('click');
    G.rotT = 0.25;
    snapCam();
    refresh();
  }
  function toggleSound() { G.opt.on = !G.opt.on; A.setOn(G.opt.on); saveOpt(); }

  function pushUndo() {
    G.undo.push(S.clone(G.st));
    if (G.undo.length > 60) G.undo.shift();
  }
  function undo() {
    if (G.busy || !G.undo.length) { A.sfx('deny'); return; }
    G.st = G.undo.pop();
    G.st.stats.undo++;
    G.vs = S.clone(G.st);
    G.disp = {}; G.odisp = {}; G.bloom = null; G.poi = [];
    A.sfx('select', { f: 330 });
    G.caption = { who: [], text: 'ひとつ前にもどした', t: 0 };
    refresh(); save();
  }
  function doAction(p) {
    pushUndo();
    if (G.st.mode === 'explore') G.entryBeforeFight = S.clone(G.st);
    const prev = S.clone(G.st);
    const evs = S.apply(G.st, p);
    G.vs = prev;
    G.hv = null;
    G.camOff = [G.camOff[0] * 0.3, G.camOff[1] * 0.3];
    if (G.st.mode === 'combat' && prev.mode === 'explore') { G.combatEntry = S.clone(prev); G.combatStarted = G.st.stats.fights; G.undo = []; }
    queue(evs);
  }
  function endTurn() {
    if (G.busy || G.st.mode !== 'combat' || G.loseMenu) return;
    const prev = S.clone(G.st);
    const evs = S.endPlayerPhase(G.st);
    G.undo = [];
    G.vs = prev;
    queue(evs);
  }
  function retryFight() {
    if (!G.combatEntry) return;
    G.st = S.clone(G.combatEntry);
    G.st.stats.retries++;
    G.loseMenu = false; G.banner = null;
    enterPlay();
    A.bgm(G.sec.music || 'explore');
    save();
  }
  function retryPhase() {
    if (!G.phaseStart) return retryFight();
    G.st = S.clone(G.phaseStart);
    G.st.stats.retries++;
    G.loseMenu = false; G.banner = null;
    enterPlay();
    A.bgm('combat');
    save();
  }
  function restartSection() {
    const carry = carryOf(G.entry);
    G.st = S.clone(G.entry);
    G.st.stats = G.st.stats;
    G.menu = false;
    enterPlay();
    A.bgm(G.sec.music || 'explore');
    if (G.sec.enterSay) for (const s of G.sec.enterSay) say(s[0], s[1]);
    save();
  }
  function hint() {
    const st = G.st;
    const def = G.sec;
    st.stats.hints++;
    if (st.mode === 'combat') {
      const ch = def.combatHint || [['gard', '敵を崖や水のそばへ押しだせば、一押しで片がつく。赤い線の先にいる仲間を守ろう']];
      const k = (G.hintIdx++) % ch.length;
      say(ch[k][0], ch[k][1]);
      return;
    }
    const pr = S.partyReach(st);
    for (const h of def.hints || []) {
      if (h.flag) { if (st.flags[h.flag]) continue; }
      else {
        const i = S.idx(st, h.done[0], h.done[1]);
        if (h.item && st.items.includes(h.item)) continue;
        if (!h.item && pr.has(i)) continue;
      }
      let text = h.text;
      if (h.o) {
        // 頼りにする物が動いたのに、まだ道がないなら「戻せる」と伝える
        const o = S.objById(st, h.o), o0 = G.entry && S.objById(G.entry, h.o);
        if (o && o0 && (o.gone || o.x !== o0.x || o.y !== o0.y || o.z !== o0.z)) text = h.wrong || (h.text + '（うまくいかなければ Z で戻せる）');
      }
      G.bubbles = G.bubbles.filter(b => b.text !== text);
      say(h.who, text);
      selectHero(h.who);
      hintMark(h.mark || h.o || h.done);
      return;
    }
    const ex = st.objs.find(o => o.k === 'exit');
    say('riko', ex ? '門まで行けるよ！ みんなで行こう' : 'もう少し、まわりを見てみよう');
  }

  function hintMark(m) {
    const st = G.st;
    let x, y, z;
    if (typeof m === 'string') {
      const o = S.objById(st, m);
      if (!o || o.gone) return;
      if (o.k === 'fall') { x = o.bx; y = o.by; z = o.bz; } else { x = o.x; y = o.y; z = (o.z || 0); }
    } else if (m) {
      [x, y] = m;
      const sf = S.surface(st, x, y);
      z = st.t[S.idx(st, x, y)] === 'w' ? st.h[S.idx(st, x, y)] : sf.void ? 0 : sf.z;
    } else return;
    G.hintMark = { x, y, z, t: 0 };
    G.camLook = { x, y, z, t: 0, life: 1.6 };
  }

  // ---------- なにを指しているか ----------
  function computeHover() {
    G.hv = null;
    if (G.scene !== 'play' || !G.st || G.busy || G.menu || G.help || G.loseMenu) return;
    const [mx, my] = G.mouse;
    // UI の上なら何もしない
    if (hitButton(mx, my) || inUI(mx, my)) return;
    // 吹き出しの上（クリックは吹き出しを送る）
    if (overBubble(mx, my)) return;
    // 区画に入ったときの見わたしの間は、クリックは「先へ」だけ
    if (G.camLook && G.camLook.intro) return;
    const lxp = mx / 2, lyp = my / 2;
    const st = G.st;
    const hv = { cell: null, unit: null, obj: null };
    hv.cell = R.pick(st, lxp, lyp);
    // 物の絵（鉄の輪・的・木箱など）を指していれば、その物
    for (let k = (R.objRects || []).length - 1; k >= 0; k--) {
      const r = R.objRects[k];
      if (lxp >= r.x && lxp < r.x + r.w && lyp >= r.y && lyp < r.y + r.h) { const o = S.objById(st, r.id); if (o && !o.gone) { hv.objPick = o; break; } }
    }
    // 人の絵：敵は絵の上ならどこでも。仲間は、その升を指しているか、後ろが立てない所のときだけ
    for (let k = R.unitRects.length - 1; k >= 0; k--) {
      const r = R.unitRects[k];
      if (!(lxp >= r.x && lxp < r.x + r.w && lyp >= r.y && lyp < r.y + r.h)) continue;
      const u = S.unitById(st, r.id);
      if (!u || u.ko || u.gone) continue;
      if (u.team === 'h' && hv.cell && !(hv.cell[0] === u.x && hv.cell[1] === u.y)) {
        const sf = S.surface(st, hv.cell[0], hv.cell[1]);
        const behindUseful = sf.stand || sf.water || st.objs.some(o => !o.gone && o.x === hv.cell[0] && o.y === hv.cell[1]);
        if (behindUseful) continue;
      }
      hv.unit = u; break;
    }
    // 滝
    for (const o of st.objs) {
      if (o.k !== 'fall' || o.gone) continue;
      const [x0, y0] = R.proj(st, o.x, o.y, st.h[S.idx(st, o.x, o.y)]);
      const [x1, y1] = R.proj(st, o.bx, o.by, o.bz);
      const mxx = (x0 + x1) / 2;
      if (Math.abs(lxp - mxx) < 12 && lyp > Math.min(y0, y1) - 4 && lyp < y1 + 6 && !hv.unit) { hv.obj = o; }
    }
    // 敵の絵が手前にあれば敵、そうでなければ物の絵を優先
    if (hv.objPick && !(hv.unit && hv.unit.team === 'e')) { hv.obj = hv.objPick; hv.unit = null; }
    if (!hv.unit && !hv.obj && hv.cell) {
      const [x, y] = hv.cell;
      const objs = st.objs.filter(o => !o.gone && o.x === x && o.y === y && ['crate', 'block', 'iceblock', 'boulder', 'pillar', 'anchor', 'target', 'lantern', 'chest', 'exit'].includes(o.k));
      if (objs.length) objs.sort((a, b) => (b.z || 0) - (a.z || 0)), hv.obj = objs[0];
      const u = S.unitAt(st, x, y);
      if (u && !hv.obj) hv.unit = u;
    }
    deriveIntent(hv);
    G.hv = hv;
  }
  function inUI(x, y) {
    if (y > 616 && x < 640) return true; // 仲間の札
    if (y < 64 && x > 820) return true;
    if (G.st && G.st.mode === 'combat' && x > 1040 && y > 600) return true;
    return false;
  }
  function quadDir(st, ent, lxp, lyp) {
    const [sx, sy] = R.proj(st, ent.x, ent.y, ent.z || 0);
    const dx = lxp - sx, dy = lyp - (sy - 6);
    let sd;
    if (dx >= 0 && dy >= 0) sd = 0; else if (dx < 0 && dy >= 0) sd = 1; else if (dx < 0) sd = 2; else sd = 3;
    return R.wdirOf(sd);
  }
  function pushPlan(st, actor, ref, ent, hv) {
    const want = quadDir(st, ent, G.mouse[0] / 2, G.mouse[1] / 2);
    let p = S.plan(st, actor, { k: 'push', ref, dir: want });
    const valid = [];
    for (let d = 0; d < 4; d++) { const q = S.plan(st, actor, { k: 'push', ref, dir: d }); if (q.ok) valid.push(q); }
    hv.pushValid = valid.map(q => q.intent.dir);
    if (!p.ok && valid.length) {
      for (const d of [(want + 1) % 4, (want + 3) % 4, (want + 2) % 4]) { const q = valid.find(v => v.intent.dir === d); if (q) { p = q; break; } }
    }
    return p;
  }
  function deriveIntent(hv) {
    const st = G.st, combat = st.mode === 'combat';
    const selU = S.unitById(st, G.sel);
    let actor = G.sel, intent = null;
    if (hv.unit && hv.unit.team === 'h') { hv.intent = { k: 'select', id: hv.unit.id }; return; }
    if (hv.unit && hv.unit.team === 'e') {
      const e = hv.unit;
      if (!combat) { hv.why = ENEMYNAME(e) + '（まだ気づいていない）'; return; }
      if (!selU || selU.ko) return;
      if (selU.acted) { hv.why = NAME[G.sel] + 'は行動ずみ（Tab で次の仲間）'; return; }
      if (actor === 'gard') { hv.plan = pushPlan(st, actor, { u: e.id }, e, hv); }
      else if (actor === 'riko') hv.plan = S.plan(st, actor, { k: 'shoot', ref: { u: e.id } });
      else hv.plan = S.plan(st, actor, { k: 'freeze', ref: { u: e.id } });
      hv.target = e;
      finishPlan(hv);
      return;
    }
    if (hv.obj && hv.obj.k === 'bridge') { hv.target = hv.obj; hv.why = '上がっている。下りれば、谷を渡れる'; return; }
    if (hv.obj) {
      const o = hv.obj;
      let need = null;
      if (['crate', 'block', 'iceblock', 'boulder', 'pillar'].includes(o.k)) need = 'gard';
      else if (o.k === 'anchor' || o.k === 'target') need = 'riko';
      else if (o.k === 'fall') need = 'sena';
      if (need && actor !== need) {
        if (combat) { const nu = S.unitById(st, need); if (nu && !nu.ko && !nu.acted) { hv.intent = { k: 'select', id: need }; hv.why = NAME[need] + 'なら、これに働きかけられる（押すと選ぶ）'; } else hv.why = NAME[need] + 'なら働きかけられる'; hv.target = o; return; }
        actor = need;
      }
      if (need === 'gard') hv.plan = pushPlan(st, actor, { o: o.id }, o, hv);
      else if (o.k === 'anchor') { const a = S.plan(st, actor, { k: 'rope', o: o.id }); hv.plan = a; }
      else if (o.k === 'target') hv.plan = o.hit ? { ok: false, why: 'もう射ぬいた' } : S.plan(st, actor, { k: 'shoot', ref: { o: o.id } });
      else if (o.k === 'fall') hv.plan = S.plan(st, actor, { k: 'freeze', ref: { o: o.id } });
      else if (o.k === 'lantern') hv.plan = S.plan(st, actor, { k: 'light' });
      else if (o.k === 'chest' || o.k === 'exit') hv.plan = S.plan(st, actor, { k: 'move', x: o.x, y: o.y });
      hv.actor = actor; hv.target = o;
      finishPlan(hv);
      return;
    }
    if (hv.cell) {
      const [x, y] = hv.cell;
      const i = S.idx(st, x, y);
      if (st.t[i] === 'r') { hv.why = '流れの速い水。凍らせられない（重い物を沈めれば飛び石になる）'; return; }
      if (st.t[i] === 'w') {
        if (combat && actor !== 'sena') { hv.why = '深い水。セナなら凍らせられる'; const su = S.unitById(st, 'sena'); if (su && !su.acted && !su.ko) hv.intent = { k: 'select', id: 'sena' }; return; }
        actor = 'sena';
        hv.plan = S.plan(st, actor, { k: 'freeze', x, y });
        hv.freeze = S.freezeCells(st, x, y);
        hv.actor = actor;
        finishPlan(hv);
        return;
      }
      if (combat && selU && selU.acted) { hv.why = NAME[G.sel] + 'は行動ずみ（Tab で次の仲間）'; return; }
      hv.plan = S.plan(st, actor, { k: 'move', x, y });
      hv.actor = actor;
      if (!hv.plan.ok) hv.why = hv.plan.why;
      else if (combat) finishPlan(hv);
    }
  }
  function ENEMYNAME(e) { return S.ENEMY[e.k].name; }
  // 字幕（過去形）を、見こみ（これから）の言い方にする
  const FUT = [['落ちていった', '落ちていく'], ['すべっていった', 'すべっていく'], ['沈んだ', '沈む'], ['倒れた', '倒れる'], ['ぶつかった', 'ぶつかる'], ['ぶつけた', 'ぶつける'],
    ['押しつぶした', '押しつぶす'], ['なぎ倒した', 'なぎ倒す'], ['押した', '押す'], ['射ぬいた', '射ぬく'], ['射た', '射る'], ['渡った', '渡る'], ['凍らせた', '凍らせる'],
    ['閉じこめた', '閉じこめる'], ['なった', 'なる'], ['凍った', '凍る'], ['落ちた', '落ちる'], ['のった', 'のる'], ['入れた', '入れる'], ['動いた', '動く'],
    ['開いた', '開く'], ['下りた', '下りる'], ['止まった', '止まる'], ['崩れた', '崩れる'], ['ひらけた', 'ひらける'], ['かかった', 'かかる'], ['せきとめた', 'せきとめる'], ['弱まった', '弱まる']];
  function fut(s) {
    let o = s.replace('（Z で戻せる）', '');
    for (const [a, b] of FUT) o = o.split(a + '。').join(b + '。').split(a + '（').join(b + '（').split(a + '、').join(b + '、').split(a + '！').join(b + '！');
    for (const [a, b] of FUT) if (o.endsWith(a)) { o = o.slice(0, -a.length) + b; break; }
    return o;
  }
  function finishPlan(hv) {
    const p = hv.plan;
    if (!p) return;
    if (!p.ok) { hv.why = p.why; return; }
    try { hv.pv = S.preview(G.st, p); } catch (err) { console.error(err); }
  }

  // ---------- 一コマ ----------
  let last = performance.now();
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000);
    if (dt < 0) dt = 0;
    last = now;
    try { update(dt); draw(); } catch (err) { console.error(err); }
    requestAnimationFrame(frame);
  }
  function update(dt) {
    if (G.hold) dt = G.holdStep || 0;
    G.holdStep = 0;
    // 区画に入ったときの見わたしが終わった時刻（直後の Space を「手番を終える」にしない）
    const introNow = !!(G.camLook && G.camLook.intro);
    if (G.introWas && !introNow) G.introEndT = G.t;
    G.introWas = introNow;
    G.t += dt;
    if (G.scene === 'play') {
      if (!G.menu && !G.help) G.playTime += dt;
      stepAnim(dt);
      updateFx(dt);
      updateCam(dt);
      if (G.trans) {
        G.trans.t += dt;
        if (G.trans.t > 0.7 && !G.trans.loaded) {
          G.trans.loaded = true;
          const to = G.trans.to;
          if (to === 'end' || !secDef(to)) beginEnding(); else startSection(to, carryOf(G.st));
        }
        if (G.trans.t > 1.4) G.trans = null;
      }
    }
    if (G.scene === 'ending' && G.ending) G.ending.t += dt;
    if (G.scene === 'story' && G.story) G.story.t += dt;
    if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.life) G.banner = null; }
    // 吹き出しは一つずつ（大きな見出しの間は待つ）
    if (G.bubbles.length && !(G.banner && !G.banner.small && G.banner.t < G.banner.life - 0.3)) {
      G.bubbles[0].t += dt;
      if (G.bubbles[0].t >= G.bubbles[0].life) G.bubbles.shift();
    }
    if (G.caption) G.caption.t += dt;
    if (G.caption2) { G.caption2.t += dt; if (G.caption2.t > 3) G.caption2 = null; }
    if (G.denyT) G.denyT = Math.max(0, G.denyT - dt);
  }
  function updateFx(dt) {
    for (const p of G.fx) {
      p.t += dt;
      if (p.k === 'p') { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.g * dt; }
    }
    G.fx = G.fx.filter(p => p.t < p.life);
    for (const l of G.lines) l.t += dt * speed();
    G.lines = G.lines.filter(l => l.t < l.dur + 0.05);
    for (const p of G.pops) p.t += dt;
    G.pops = G.pops.filter(p => p.t < p.life);
    if (G.bloom) { G.bloom.t += dt; if (G.bloom.t > G.bloom.dur + 0.8) G.bloom = null; }
    for (const p of G.poi) p.t += dt;
    G.poi = G.poi.filter(p => p.t < 4);
    G.shake = Math.max(0, G.shake - dt * 1.6);
    if (G.camLook) { G.camLook.t += dt; if (G.camLook.t > G.camLook.life) G.camLook = (G.camLook.intro && G.camLooks && G.camLooks.length) ? G.camLooks.shift() : null; }
    if (G.rotT) G.rotT = Math.max(0, G.rotT - dt);
    if (G.hintMark) G.hintMark.t += dt;
  }
  function focusPoint() {
    const st = G.vs;
    if (G.camLook) return [G.camLook.x, G.camLook.y, G.camLook.z];
    if (G.busy && G.camFocusOverride) {
      const u = S.unitById(st, G.sel);
      const a = G.camFocusOverride;
      if (u) { const d = G.disp[u.id] || u; return [(d.x + a[0]) / 2, (d.y + a[1]) / 2, (d.z + a[2]) / 2]; }
      return a;
    }
    // 動いている者を追う
    if (G.busy) {
      for (const id in G.disp) { const d = G.disp[id]; const u = S.unitById(st, id); if (u && u.team === 'h' && id === G.sel) return [d.x, d.y, d.z]; }
      const ids = Object.keys(G.disp);
      if (ids.length) { const d = G.disp[ids[0]]; return [d.x, d.y, d.z]; }
    }
    const u = S.unitById(st, G.sel);
    if (u) { const d = G.disp[u.id] || u; return [d.x, d.y, d.z]; }
    return [st.W / 2, st.H / 2, 2];
  }
  let boxCache = null;
  function mapBox() {
    const st = G.vs;
    const key = st.sec + '|' + R.rot;
    if (boxCache && boxCache.key === key) return boxCache;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let y = 0; y < st.H; y++) for (let x = 0; x < st.W; x++) {
      const i = S.idx(st, x, y);
      if (st.t[i] === 'v') continue;
      const [a, b] = R.rawProj(st, x, y, st.h[i]);
      const [, b2] = R.rawProj(st, x, y, -1);
      x0 = Math.min(x0, a - 16); x1 = Math.max(x1, a + 16); y0 = Math.min(y0, b - 8); y1 = Math.max(y1, b2 + 8);
    }
    boxCache = { key, x0, x1, y0, y1 };
    return boxCache;
  }
  function camTarget() {
    const f = focusPoint();
    const [a, b] = R.rawProj(G.vs, f[0], f[1], f[2]);
    let cx = a + G.camOff[0], cy = b + G.camOff[1] - (G.camLook ? 10 : 26);
    // 区画がなるべく画面におさまるように
    const bx = mapBox();
    const m = 24;
    const loX = bx.x0 + R.LW / 2 - m, hiX = bx.x1 - R.LW / 2 + m;
    const loY = bx.y0 + R.LH / 2 - 44 - m, hiY = bx.y1 - R.LH / 2 + 58 + m;
    cx = loX > hiX ? (loX + hiX) / 2 + G.camOff[0] * 0.5 : Math.max(loX, Math.min(hiX, cx));
    cy = loY > hiY ? (loY + hiY) / 2 + G.camOff[1] * 0.5 : Math.max(loY, Math.min(hiY, cy));
    return [cx, cy];
  }
  function snapCam() { const [a, b] = camTarget(); R.cam.x = a; R.cam.y = b; }
  function updateCam(dt) {
    const [a, b] = camTarget();
    const k = 1 - Math.exp(-dt * 5);
    R.cam.x += (a - R.cam.x) * k; R.cam.y += (b - R.cam.y) * k;
  }

  // ---------- 描く ----------
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    G.buttons = [];
    if (G.scene === 'title') return drawTitle();
    if (G.scene === 'story') return drawStory();
    if (G.scene === 'ending') return drawEnding();
    if (G.scene === 'sheet') return drawSheet();
    drawPlay();
  }

  function buildTint() {
    const st = G.vs;
    const tint = {};
    if (G.reachTint && !G.busy) for (const i in G.reachTint) tint[i] = { c: '#7ab8ff', a: 0.22 };
    const selU = S.unitById(G.st, G.sel);
    // セナを選ぶと、凍らせられる水が光る
    if (G.sel === 'sena' && !G.busy) for (let i = 0; i < st.t.length; i++) if (st.t[i] === 'w') tint[i] = { c: '#9af0ff', a: 0.16 + 0.08 * Math.sin(G.t * 3) };
    if (G.hv && G.hv.freeze && G.hv.plan && G.hv.plan.ok) for (const [x, y] of G.hv.freeze) tint[S.idx(st, x, y)] = { c: '#dff8ff', a: 0.6 };
    if (G.bloom) {
      const b = G.bloom;
      for (const c of b.cells) {
        const tt = b.t - c[3] * 0.07;
        if (tt < 0) continue;
        const a = tt < 0.25 ? tt / 0.25 : Math.max(0, 1 - (tt - 0.25) / (b.dur + 0.4));
        if (a > 0) tint[S.idx(st, c[0], c[1])] = { c: '#ffe9a0', a: 0.55 * a };
      }
    }
    return tint;
  }
  function highlights() {
    const hi = {};
    if (G.busy || !G.st) return hi;
    const st = G.st;
    const col = HC[G.sel];
    for (const o of st.objs) {
      if (o.gone) continue;
      if (G.sel === 'gard' && ['crate', 'block', 'iceblock', 'boulder'].includes(o.k)) hi[o.id] = col;
      if (G.sel === 'gard' && o.k === 'pillar' && st.up.gauntlet) hi[o.id] = col;
      if (G.sel === 'riko' && (o.k === 'anchor' || (o.k === 'target' && !o.hit))) hi[o.id] = col;
    }
    if (G.hv && G.hv.target && G.hv.target.id && !G.hv.target.team) hi[G.hv.target.id] = '#ffffff';
    return hi;
  }

  function drawPlay() {
    const st = G.vs;
    if (titleDirty) { R.resetCache(st); titleDirty = false; boxCache = null; }
    R.hi.objs = highlights();
    const view = {
      st, sec: G.sec, disp: G.disp, odisp: G.odisp, tint: buildTint(),
      focus: (() => { const u = S.unitById(st, G.sel); if (!u) return null; const d = G.disp[u.id] || u; return [d.x, d.y, d.z]; })(),
    };
    // 選択の輪
    const su = S.unitById(st, G.sel);
    if (su && !su.ko) { const d = G.disp[su.id] || (G.disp[su.id] = { x: su.x, y: su.y, z: su.z, temp: true }); d.ring = HC[G.sel]; }
    const shk = G.shake > 0 ? [Math.round((Math.random() - 0.5) * G.shake * 8), Math.round((Math.random() - 0.5) * G.shake * 6)] : [0, 0];
    R.cam.x += shk[0]; R.cam.y += shk[1];
    lx.save();
    R.draw(lx, view, G.t);
    if (su && G.disp[su.id] && G.disp[su.id].temp) delete G.disp[su.id]; else if (su && G.disp[su.id]) delete G.disp[su.id].ring;
    drawRopes(lx, st);
    if (G.topple) drawTopple(lx, st, G.topple.o, G.topple.p);
    drawOverlay(lx, st);
    drawFxLow(lx, st);
    drawLights(lx, st);
    lx.restore();
    R.cam.x -= shk[0]; R.cam.y -= shk[1];
    ctx.drawImage(low, 0, 0, 1280, 720);
    drawUI(st);
    if (G.trans) {
      const p = G.trans.t < 0.7 ? G.trans.t / 0.7 : Math.max(0, 1 - (G.trans.t - 0.7) / 0.7);
      ctx.fillStyle = `rgba(4,3,10,${p})`; ctx.fillRect(0, 0, 1280, 720);
    }
    if (G.rotT) { ctx.fillStyle = `rgba(4,3,10,${G.rotT * 2})`; ctx.fillRect(0, 0, 1280, 720); }
  }

  function ropeZ(st, x, y) { const s = S.surface(st, x, y); return s.void ? 0 : s.z; }
  function drawRopes(c, st) {
    for (const L of st.links) {
      if (L.hidden) continue;
      const za = ropeZ(st, L.a[0], L.a[1]), zb = ropeZ(st, L.b[0], L.b[1]);
      if (L.k === 'rope') {
        const [x0, y0] = R.projF(st, L.a[0], L.a[1], za + 0.4);
        const [x1, y1] = R.projF(st, L.b[0], L.b[1], zb + 2.3);
        c.strokeStyle = '#d8b878'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x0, y0);
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + 8;
        c.quadraticCurveTo(mx, my, x1, y1); c.stroke();
        c.strokeStyle = 'rgba(80,50,20,0.6)';
        c.beginPath(); c.moveTo(x0, y0 + 1); c.quadraticCurveTo(mx, my + 1, x1, y1 + 1); c.stroke();
      } else if (L.k === 'ladder') {
        const [x0, y0] = R.projF(st, L.a[0], L.a[1], za);
        const [x1, y1] = R.projF(st, L.b[0], L.b[1], zb);
        c.strokeStyle = '#a07a4a'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x0 - 3, y0); c.lineTo(x1 - 3, y1); c.moveTo(x0 + 3, y0); c.lineTo(x1 + 3, y1); c.stroke();
        const n = Math.max(2, Math.abs(y1 - y0) / 4 | 0);
        for (let k = 1; k < n; k++) { const q = k / n; c.beginPath(); c.moveTo(lerp(x0, x1, q) - 3, lerp(y0, y1, q)); c.lineTo(lerp(x0, x1, q) + 3, lerp(y0, y1, q)); c.stroke(); }
      }
    }
  }

  function drawTopple(c, st, e, p) {
    // 3次元の箱を、底のふちを軸に倒す
    const [dx, dy] = S.DIRS[e.dir];
    const hw = 0.33, H = 3;
    const a = p * Math.PI / 2;
    const pivot = [e.x + dx * hw, e.y + dy * hw, e.z];
    const corners = [];
    for (const ox of [-hw, hw]) for (const oy of [-hw, hw]) for (const oz of [0, H]) {
      let px = e.x + ox, py = e.y + oy, pz = e.z + oz;
      // 回転：押す向きの軸と高さの面で
      const along = (px - pivot[0]) * dx + (py - pivot[1]) * dy;
      const up = pz - pivot[2];
      const nAlong = along * Math.cos(a) + up * Math.sin(a);
      const nUp = -along * Math.sin(a) + up * Math.cos(a);
      const side = dx !== 0 ? py : px;
      if (dx !== 0) { px = pivot[0] + nAlong * dx; py = side; } else { py = pivot[1] + nAlong * dy; px = side; }
      pz = pivot[2] + nUp;
      corners.push([px, py, pz]);
    }
    const faces = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];
    const cols = ['#8a869c', '#8a869c', '#b6b2c4', '#66627a', '#9a96ac', '#76728a'];
    const list = faces.map((f, k) => {
      const pts = f.map(i => corners[i]);
      const depth = pts.reduce((s, q) => { const [u, v] = R.rotXY(st, q[0], q[1]); return s + u + v + q[2] * 0.01; }, 0) / 4;
      return { pts, depth, col: cols[k] };
    }).sort((A1, B1) => A1.depth - B1.depth);
    for (const f of list) {
      c.fillStyle = f.col;
      c.beginPath();
      f.pts.forEach((q, k) => { const [sx, sy] = R.projF(st, q[0], q[1], q[2]); if (k) c.lineTo(sx, sy); else c.moveTo(sx, sy); });
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(30,26,40,0.6)'; c.stroke();
    }
  }

  function drawOverlay(c, st) {
    const t = G.t;
    // 敵の予告
    if (G.st.mode === 'combat' && !G.busy && !G.loseMenu) {
      for (const it of G.intents) {
        const e = S.unitById(G.st, it.id);
        if (!e || e.ko) continue;
        if (it.frozen) continue;
        const to = it.to || [e.x, e.y];
        if (it.to && (it.to[0] !== e.x || it.to[1] !== e.y)) {
          const [x0, y0] = R.projF(st, e.x, e.y, e.z + 0.3);
          const [x1, y1] = R.projF(st, to[0], to[1], S.surface(st, to[0], to[1]).z + 0.3);
          dashed(c, x0, y0, x1, y1, 'rgba(255,120,100,0.55)', 2, 2);
          R.diamondLine(c, Math.round(x1), Math.round(y1), 8, 'rgba(255,120,100,0.7)');
        }
        if (it.target) {
          const h = S.unitById(G.st, it.target);
          const [x0, y0] = R.projF(st, to[0], to[1], S.surface(st, to[0], to[1]).z + 1.4);
          const [x1, y1] = R.projF(st, h.x, h.y, h.z + 1.4);
          const a = 0.6 + 0.3 * Math.sin(t * 6);
          c.strokeStyle = `rgba(255,70,60,${a})`; c.lineWidth = 1;
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
          c.fillStyle = `rgba(255,70,60,${a})`; c.fillRect(x1 - 1, y1 - 1, 3, 3);
        }
      }
    }
    if (G.hintMark) {
      const m = G.hintMark;
      if (m.t > 7) G.hintMark = null;
      else {
        const [sx, sy] = R.proj(st, m.x, m.y, m.z);
        const a = Math.min(1, (7 - m.t)) * (0.6 + 0.4 * Math.sin(t * 7));
        c.globalAlpha = a;
        R.diamondLine(c, sx, sy, 16 + Math.round(Math.sin(t * 7) * 2), '#ffe680');
        R.diamondLine(c, sx, sy, 10, '#ffe680');
        c.globalAlpha = 1;
      }
    }
    const hv = G.hv;
    if (!hv || G.busy) return;
    if (hv.plan && !hv.plan.ok && hv.plan.whyAt) {
      const [ax, ay, az, nx, ny] = hv.plan.whyAt;
      const [sx, sy] = R.projF(st, nx, ny, az);
      const [px, py] = R.projF(st, ax, ay, az);
      const a = 0.65 + 0.35 * Math.sin(t * 8);
      c.strokeStyle = `rgba(255,90,70,${a})`; c.lineWidth = 2;
      c.beginPath(); c.moveTo(sx - 5, sy - 4); c.lineTo(sx + 5, sy + 4); c.moveTo(sx + 5, sy - 4); c.lineTo(sx - 5, sy + 4); c.stroke();
      c.lineWidth = 1;
      R.diamondLine(c, Math.round(px), Math.round(py), 12, `rgba(255,140,120,${a * 0.8})`);
    }
    // 指している升
    if (hv.cell) {
      const [x, y] = hv.cell;
      const sf = S.surface(st, x, y);
      const z = sf.void ? 0 : (st.t[S.idx(st, x, y)] === 'w' ? st.h[S.idx(st, x, y)] : sf.z);
      const [sx, sy] = R.proj(st, x, y, z);
      const bad = !!hv.why && !(hv.plan && hv.plan.ok);
      R.diamondLine(c, sx, sy, 16, bad ? 'rgba(255,110,100,0.9)' : 'rgba(255,255,255,0.85)');
    }
    const p = hv.plan;
    if (!p || !p.ok) return;
    const actor = S.unitById(st, p.hero);
    const col = HC[p.hero];
    // 歩く道
    if (p.path && p.path.length > 1) {
      for (let k = 1; k < p.path.length; k++) {
        const i = p.path[k], x = i % st.W, y = (i / st.W) | 0;
        const z = S.surface(st, x, y).z;
        const [sx, sy] = R.proj(st, x, y, z);
        c.fillStyle = col; c.fillRect(sx - 1, sy - 1, 3, 3);
        c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(sx - 1, sy + 2, 3, 1);
      }
      // 立つ場所に半透明の姿
      const [gx, gy] = p.stand;
      if (actor && (gx !== actor.x || gy !== actor.y) && p.intent.k !== 'move') {
        R.drawUnit(c, st, actor, { x: gx, y: gy, z: S.surface(st, gx, gy).z, alpha: 0.5, sd: actor ? R.sdir(actor.face) : 0 }, t);
      }
      if (p.intent.k === 'move') {
        const [sx, sy] = R.proj(st, gx, gy, S.surface(st, gx, gy).z);
        R.diamondLine(c, sx, sy, 12, col);
      }
    }
    const I = p.intent;
    const pv = hv.pv;
    const standZ = S.surface(st, p.stand[0], p.stand[1]).z;
    if (I.k === 'push' && pv) {
      const ent = I.ref.u ? S.unitById(st, I.ref.u) : S.objById(st, I.ref.o);
      if (ent) {
        // ほかに押せる向き（うすい矢印）。マウスをそちらへ寄せると選べる
        for (const d of hv.pushValid || []) {
          if (d === I.dir) continue;
          const [ddx, ddy] = S.DIRS[d];
          const [a0, b0] = R.projF(st, ent.x + ddx * 0.4, ent.y + ddy * 0.4, (ent.z || 0) + 0.6);
          const [a1, b1] = R.projF(st, ent.x + ddx * 1.0, ent.y + ddy * 1.0, (ent.z || 0) + 0.6);
          c.globalAlpha = 0.8; arrow(c, a0, b0, a1, b1, '#f0ecff'); c.globalAlpha = 1;
        }
        const [ddx, ddy] = S.DIRS[I.dir];
        const pl = 0.08 * Math.sin(t * 6);
        const [a0, b0] = R.projF(st, ent.x + ddx * 0.2, ent.y + ddy * 0.2, (ent.z || 0) + 0.6);
        const [a1, b1] = R.projF(st, ent.x + ddx * (1.25 + pl), ent.y + ddy * (1.25 + pl), (ent.z || 0) + 0.6);
        arrow(c, a0, b0, a1, b1, col, true);
        const key = I.ref.u || I.ref.o;
        // 物がたどる道すじ（転がる・すべる・落ちる）
        const sl = pv.evs.find(e => e.k === 'slide' && (e.ref.u || e.ref.o) === key);
        if (sl && sl.path.length > 2) {
          for (let k = 1; k < sl.path.length; k++) {
            const q = sl.path[k];
            if (q[2] < -6) continue;
            const [px, py] = R.proj(st, q[0], q[1], q[2] + 0.2);
            c.fillStyle = 'rgba(255,240,160,0.85)'; c.fillRect(px - 1, py - 1, 2, 2);
          }
        }
        // 巻きこまれて倒れる敵に印
        for (const id of pv.ko) {
          const e = S.unitById(st, id);
          if (!e || e.team !== 'e' || id === key) continue;
          const [ex, ey] = R.proj(st, e.x, e.y, e.z + 1.4);
          c.strokeStyle = '#ff5a4a'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(ex - 4, ey - 4); c.lineTo(ex + 4, ey + 4); c.moveTo(ex + 4, ey - 4); c.lineTo(ex - 4, ey + 4); c.stroke();
        }
        const mv = pv.moves[key];
        if (mv && (mv[0] !== ent.x || mv[1] !== ent.y || mv[2] !== ent.z)) {
          const [sx, sy] = R.proj(st, mv[0], mv[1], Math.max(mv[2], -6));
          c.globalAlpha = 0.5 + 0.2 * Math.sin(t * 6);
          if (I.ref.o) { const o = S.objById(st, I.ref.o); if (o && mv[2] > -6) R.drawObj(c, st, o, t, Object.assign({}, o, { x: mv[0], y: mv[1], z: mv[2] })); }
          else if (mv[2] > -6) R.drawUnit(c, st, ent, { x: mv[0], y: mv[1], z: mv[2], alpha: 0.6 }, t);
          c.globalAlpha = 1;
          R.diamondLine(c, sx, sy, 14, 'rgba(255,240,160,0.9)');
        }
      }
    }
    if (I.k === 'shoot') {
      const tgt = I.ref.u ? S.unitById(st, I.ref.u) : S.objById(st, I.ref.o);
      if (tgt) {
        const [x0, y0] = R.projF(st, p.stand[0], p.stand[1], standZ + 1.6);
        const [x1, y1] = R.projF(st, tgt.x, tgt.y, (tgt.z || 0) + (I.ref.u ? 1 : 1.8));
        dashed(c, x0, y0, x1, y1, col, 3, 2);
      }
    }
    if (I.k === 'rope') {
      const a = S.objById(st, I.o);
      const [x0, y0] = R.projF(st, p.stand[0], p.stand[1], standZ + 1.5);
      const [x1, y1] = R.projF(st, a.x, a.y, S.surface(st, a.x, a.y).z + 2.4);
      c.strokeStyle = col; c.lineWidth = 1; c.setLineDash([3, 2]);
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 14, x1, y1); c.stroke(); c.setLineDash([]);
    }
    if (I.k === 'freeze' && (I.ref)) {
      const tgt = I.ref.u ? S.unitById(st, I.ref.u) : null;
      const o = I.ref.o ? S.objById(st, I.ref.o) : null;
      const tx = tgt ? tgt.x : o.bx, ty = tgt ? tgt.y : o.by, tz = tgt ? tgt.z + 1 : o.bz + 1;
      const [x0, y0] = R.projF(st, p.stand[0], p.stand[1], standZ + 1.8);
      const [x1, y1] = R.projF(st, tx, ty, tz);
      dashed(c, x0, y0, x1, y1, col, 2, 2);
    }
  }
  function dashed(c, x0, y0, x1, y1, col, on, off) {
    c.strokeStyle = col; c.lineWidth = 1; c.setLineDash([on, off]);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.setLineDash([]);
  }
  function arrow(c, x0, y0, x1, y1, col, thick) {
    const hw = thick ? 7 : 5;
    const a = Math.atan2(y1 - y0, x1 - x0);
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = thick ? 4 : 3;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.beginPath(); c.moveTo(x1 + Math.cos(a) * (hw - 1), y1 + Math.sin(a) * (hw - 1)); c.lineTo(x1 + Math.cos(a + 2.4) * (hw + 1.5), y1 + Math.sin(a + 2.4) * (hw + 1.5)); c.lineTo(x1 + Math.cos(a - 2.4) * (hw + 1.5), y1 + Math.sin(a - 2.4) * (hw + 1.5)); c.closePath(); c.fill();
    c.strokeStyle = col; c.lineWidth = thick ? 2 : 1;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.fillStyle = col;
    c.beginPath(); c.moveTo(x1 + Math.cos(a) * (hw - 2), y1 + Math.sin(a) * (hw - 2)); c.lineTo(x1 + Math.cos(a + 2.4) * hw, y1 + Math.sin(a + 2.4) * hw); c.lineTo(x1 + Math.cos(a - 2.4) * hw, y1 + Math.sin(a - 2.4) * hw); c.closePath(); c.fill();
  }

  function drawFxLow(c, st) {
    for (const l of G.lines) {
      const p = Math.min(1, l.t / l.dur);
      if (l.k === 'arrow' || l.k === 'earrow') {
        const x = lerp(l.from[0], l.to[0], p), y = lerp(l.from[1], l.to[1], p);
        const z = lerp(l.from[2] + 1.4, l.to[2] + 1, p) + Math.sin(p * Math.PI) * 1.2;
        const [sx, sy] = R.projF(st, x, y, z);
        const [px, py] = R.projF(st, lerp(l.from[0], l.to[0], Math.max(0, p - 0.12)), lerp(l.from[1], l.to[1], Math.max(0, p - 0.12)), lerp(l.from[2] + 1.4, l.to[2] + 1, Math.max(0, p - 0.12)) + Math.sin(Math.max(0, p - 0.12) * Math.PI) * 1.2);
        c.strokeStyle = l.k === 'earrow' ? '#e8d8c0' : '#fff6d0'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(px, py); c.lineTo(sx, sy); c.stroke();
      }
      if (l.k === 'ropeThrow') {
        const [x0, y0] = R.projF(st, l.from[0], l.from[1], l.from[2] + 1.5);
        const [x1, y1] = R.projF(st, l.to[0], l.to[1], l.to[2] + 2.4);
        const ex = lerp(x0, x1, p), ey = lerp(y0, y1, p) - Math.sin(p * Math.PI) * 12;
        c.strokeStyle = '#d8b878'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + ex) / 2, Math.min(y0, ey) - 6, ex, ey); c.stroke();
        c.fillStyle = '#e0e4f0'; c.fillRect(ex - 1, ey - 1, 3, 3);
      }
    }
    for (const f of G.fx) {
      if (f.k === 'frost') {
        const p = Math.max(0, Math.min(1, f.t / f.life));
        if (f.t < 0) continue;
        const x = lerp(f.from[0], f.to[0], p), y = lerp(f.from[1], f.to[1], p), z = lerp(f.from[2] + 1.8, f.to[2] + 0.6, p) + Math.sin(p * Math.PI + f.life) * 0.4;
        const [sx, sy] = R.projF(st, x, y, z);
        c.fillStyle = p > 0.8 ? '#ffffff' : '#9af0ff';
        c.fillRect(sx | 0, sy | 0, 2, 2);
        continue;
      }
      const [sx, sy] = R.projF(st, f.x, f.y, f.z);
      c.globalAlpha = Math.max(0, 1 - f.t / f.life);
      c.fillStyle = f.col; c.fillRect(sx | 0, sy | 0, f.sz, f.sz);
      c.globalAlpha = 1;
    }
  }

  function drawLights(c, st) { lightsOn(c, st, G.disp); }
  function lightsOn(c, st, disp) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const t = G.t;
    const glow = (x, y, r, col, a) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (const o of st.objs) {
      if (o.gone) continue;
      if (o.k === 'torch') {
        const [sx, sy] = R.projF(st, o.x, o.y, o.z + (o.fz || 2));
        const f = 0.85 + Math.sin(t * 11 + o.x) * 0.08 + Math.sin(t * 5.3 + o.y) * 0.07;
        glow(sx, sy - 3, 46 * f, '255,150,70', 0.22);
        glow(sx, sy - 3, 12, '255,220,150', 0.35);
      }
      if (o.k === 'exit') { const [sx, sy] = R.projF(st, o.x, o.y, o.z + 1); glow(sx, sy - 6, 30, '255,210,140', 0.14); }
      if (o.k === 'lantern' && o.lit) { const [sx, sy] = R.projF(st, o.x, o.y, o.z + 2); glow(sx, sy - 8, 140 * (R.goalLit || 1), '255,200,110', 0.35); glow(sx, sy - 8, 30, '255,250,220', 0.6); }
      if (o.k === 'chest' && !o.open && o.item && o.item.indexOf('page') === 0) { const [sx, sy] = R.projF(st, o.x, o.y, o.z + 1.5); glow(sx, sy, 16, '255,230,160', 0.2); }
    }
    const s = S.unitById(st, 'sena');
    if (s && !s.gone) { const d = (disp && disp.sena) || s; const [sx, sy] = R.projF(st, d.x, d.y, d.z + 2.4); glow(sx + 5, sy - 2, 14, '120,220,255', 0.22 + 0.06 * Math.sin(t * 4)); }
    // 天井の水晶が灯りを映す
    if (R.starsLit > 0) {
      for (let k = 0; k < 140; k++) {
        const x = (R.hash(k, 7, 3, 1) * 680 - 20) | 0, y = (R.hash(k, 2, 9, 4) * 210) | 0;
        const appear = Math.min(1, Math.max(0, R.starsLit * 1.6 - R.hash(k, 1, 1, 8)));
        if (appear <= 0) continue;
        const tw = 0.5 + 0.5 * Math.sin(t * (1 + R.hash(k, 3, 3, 3) * 2) + k);
        c.fillStyle = `rgba(255,${200 + (k % 3) * 20},${140 + (k % 5) * 20},${appear * (0.35 + tw * 0.65)})`;
        c.fillRect(x, y, 1, 1);
        if (k % 4 === 0) { c.fillRect(x - 1, y, 3, 1); c.fillRect(x, y - 1, 1, 3); }
      }
    }
    c.restore();
    // 周辺を暗く
    const v = c.createRadialGradient(R.LW / 2, R.LH / 2, R.LH * 0.35, R.LW / 2, R.LH / 2, R.LW * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(2,1,8,0.55)');
    c.fillStyle = v; c.fillRect(0, 0, R.LW, R.LH);
  }

  // ---------- 文字の UI ----------
  function txt(s, x, y, size, col, align, weight) {
    ctx.font = (weight || 'bold') + ' ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(s, x + 2, y + 2);
    ctx.fillStyle = col || '#fff'; ctx.fillText(s, x, y);
  }
  function panel(x, y, w, h, a, border) {
    ctx.fillStyle = `rgba(14,12,28,${a === undefined ? 0.86 : a})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = border || 'rgba(170,160,210,0.45)'; ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
  function button(key, label, x, y, w, h, fn, opt) {
    opt = opt || {};
    const hov = G.mouse[0] >= x && G.mouse[1] >= y && G.mouse[0] < x + w && G.mouse[1] < y + h && !opt.off;
    ctx.fillStyle = opt.off ? 'rgba(40,36,56,0.7)' : hov ? 'rgba(90,80,140,0.95)' : (opt.bg || 'rgba(40,34,70,0.92)');
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = opt.border || (hov ? '#ffe9a0' : 'rgba(190,180,230,0.6)'); ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    if (opt.pulse) { ctx.strokeStyle = `rgba(255,233,160,${0.4 + 0.4 * Math.sin(G.t * 5)})`; ctx.lineWidth = 3; ctx.strokeRect(x - 2, y - 2, w + 4, h + 4); }
    txt(label, x + w / 2, y + h / 2 + (opt.size || 18) * 0.36, opt.size || 18, opt.off ? '#777' : (opt.col || '#fff'), 'center');
    G.buttons.push({ key, label, x, y, w, h, fn, off: !!opt.off });
  }
  function wrap(s, max) {
    const out = []; let line = '';
    for (const ch of s) {
      if (ch === '\n') { out.push(line); line = ''; continue; }
      line += ch;
      if (line.length >= max && !'、。」）！？…'.includes(ch)) { out.push(line); line = ''; }
    }
    if (line) out.push(line);
    return out;
  }
  function toScreen(x, y, z) { const [a, b] = R.projF(G.vs, x, y, z); return [a * 2, b * 2]; }

  function drawUI(st) {
    // 吹き出し
    G.bubbleRect = null;
    for (const b of G.bubbles.slice(0, 1)) {
      if (G.banner && !G.banner.small && G.banner.t < G.banner.life - 0.3) break;
      const u = S.unitById(st, b.who);
      if (!u) continue;
      const d = G.disp[u.id] || u;
      let [sx, sy] = toScreen(d.x, d.y, d.z + 3.6);
      const lines = wrap(b.text, 20);
      const w = Math.max(...lines.map(l => l.length)) * 19 + 28, h = lines.length * 24 + 34;
      const a = Math.min(1, b.t * 6, (b.life - b.t) * 3);
      const bx = Math.max(10, Math.min(1270 - w, sx - w / 2)), by = Math.max(70, sy - h - 10);
      G.bubbleRect = { x: bx, y: by, w, h };
      const over = b.t > 0.35 && G.mouse[0] >= bx && G.mouse[1] >= by && G.mouse[0] < bx + w && G.mouse[1] < by + h;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(250,246,236,0.96)'; ctx.fillRect(bx, by, w, h);
      ctx.strokeStyle = HC[b.who] || '#888'; ctx.lineWidth = 3; ctx.strokeRect(bx + 1.5, by + 1.5, w - 3, h - 3);
      ctx.fillStyle = 'rgba(250,246,236,0.96)';
      ctx.beginPath(); ctx.moveTo(Math.max(bx + 12, Math.min(bx + w - 12, sx)) - 8, by + h); ctx.lineTo(Math.max(bx + 12, Math.min(bx + w - 12, sx)), by + h + 10); ctx.lineTo(Math.max(bx + 12, Math.min(bx + w - 12, sx)) + 8, by + h); ctx.fill();
      ctx.font = 'bold 15px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = HC[b.who] || '#555';
      ctx.fillStyle = darker(HC[b.who]);
      ctx.fillText(NAME[b.who], bx + 12, by + 20);
      ctx.font = '18px ' + FONT; ctx.fillStyle = '#2a2236';
      lines.forEach((l, k) => ctx.fillText(l, bx + 14, by + 44 + k * 24));
      // 吹き出しの上では、クリックは「次へ」
      if (over) { ctx.font = 'bold 13px ' + FONT; ctx.textAlign = 'right'; ctx.fillStyle = darker(HC[b.who]); ctx.fillText('クリックで次へ ▶', bx + w - 10, by + 20); }
      ctx.globalAlpha = 1;
    }
    // ヒントの印（人や物に隠れても見えるよう、上に矢じるし）
    if (G.hintMark && G.hintMark.t < 7) {
      const m = G.hintMark;
      const [sx, sy] = toScreen(m.x, m.y, m.z + 2.6);
      ctx.globalAlpha = Math.min(1, 7 - m.t);
      txt('▼', sx, sy + Math.sin(G.t * 7) * 6, 28, '#ffe680', 'center');
      ctx.globalAlpha = 1;
    }
    // 見どころの印
    for (const p of G.poi) {
      const o = S.objById(st, p.id);
      if (!o) continue;
      const z = (o.z || S.surface(st, o.x, o.y).z || 0) + 3.2;
      const [sx, sy] = toScreen(o.k === 'fall' ? o.bx : o.x, o.k === 'fall' ? o.by : o.y, z);
      const a = Math.min(1, (4 - p.t) * 1.5);
      ctx.globalAlpha = a;
      txt('！', sx, sy - 10 + Math.sin(G.t * 8) * 5, 30, '#ffe680', 'center');
      ctx.globalAlpha = 1;
    }
    // 数字
    for (const p of G.pops) {
      const [sx, sy] = toScreen(p.x, p.y, p.z + p.t * 0.9);
      ctx.globalAlpha = Math.min(1, (p.life - p.t) * 3);
      txt(p.text, sx, sy, p.big ? 30 : 22, p.col, 'center');
      ctx.globalAlpha = 1;
    }
    // 戦いの体力
    if (st.mode === 'combat' || G.st.mode === 'combat') {
      for (const u of st.units) {
        if (u.ko || u.gone || u.team === 'h') continue;
        if (!u.active) continue;
        const d = G.disp[u.id] || u;
        const top = u.k === 'golem' ? 4.2 : u.k === 'slime' ? 2.2 : u.k === 'bat' ? 3.4 : 3.1;
        const [sx, sy] = toScreen(d.x, d.y, d.z + top);
        pips(sx, sy, u.hp, u.mhp, '#ff7a6a', true);
        if (u.frozen > 0) txt('凍' + u.frozen, sx + u.mhp * 3 + 6, sy + 6, 13, '#bfefff', 'left');
      }
      // 予告のダメージ
      if (!G.busy && !G.loseMenu) {
        const sum = {};
        for (const it of G.intents) if (it.target) sum[it.target] = (sum[it.target] || 0) + it.dmg;
        for (const id in sum) {
          const h = S.unitById(G.st, id); if (!h) continue;
          const [sx, sy] = toScreen(h.x, h.y, h.z + 3.3);
          const lethal = sum[id] >= h.hp;
          txt((lethal ? '倒される ' : '') + '−' + sum[id], sx, sy - 14, 18, lethal ? '#ff5040' : '#ff9a80', 'center');
        }
      }
    }
    // 上の帯
    txt(G.sec.sub + '　' + G.sec.name, 22, 36, 22, '#f4ecd8');
    txt('目的：' + (G.sec.goalFn ? G.sec.goalFn(G.st) : G.sec.goal), 24, 62, 16, '#c8c0e0', 'left', 'normal');
    const bx = 1280 - 16;
    let x = bx;
    const top = (key, label, w, fn, o) => { x -= w + 8; button(key, label, x, 12, w, 40, fn, o); };
    top('menu', '≡', 44, () => { G.menu = true; });
    top('sound', G.opt.on ? '♪' : '×', 44, toggleSound);
    top('help', '？', 44, () => { G.help = true; });
    top('hint', 'ヒント H', 100, hint, { off: G.busy });
    top('undo', '戻す Z', 92, undo, { off: G.busy || !G.undo.length });
    top('rotR', '回す E', 88, () => rotate(1), { off: G.busy });
    top('rotL', '回す Q', 88, () => rotate(-1), { off: G.busy });
    // 仲間の札
    S.HERO_IDS.forEach((id, k) => heroCard(st, id, 14 + k * 206, 622));
    // 字幕
    drawCaption();
    // 戦いの操作
    if (G.st.mode === 'combat' && !G.loseMenu) {
      const all = S.heroes(G.st).every(h => h.ko || h.acted);
      txt('第' + G.st.turn + '手番', 1170, 612, 18, '#ffb8a0', 'center');
      button('end', '手番を終える', 1060, 624, 210, 56, endTurn, { off: G.busy, pulse: all && !G.busy, size: 20, bg: 'rgba(110,40,40,0.92)' });
      txt('Space', 1165, 698, 13, '#bba', 'center', 'normal');
    }
    if (G.camLook && G.camLook.intro) txt('クリック・Space で先へ ▶', 24, 90, 15, 'rgba(230,224,250,0.9)', 'left', 'normal');
    else if (G.busy && !G.trans) txt('クリック・Space で早送り', 24, 90, 13, 'rgba(200,194,224,0.6)', 'left', 'normal');
    // 説明（指している物）
    drawTooltip();
    if (G.caption2) {
      const a = Math.min(1, G.caption2.t * 4, (3 - G.caption2.t) * 2);
      ctx.globalAlpha = a;
      txt(G.caption2.text, 640, 118, 24, '#ffe9a0', 'center');
      ctx.globalAlpha = 1;
    }
    if (G.banner) drawBanner();
    if (G.loseMenu) {
      panel(390, 260, 500, 200);
      txt('三人とも倒れてしまった', 640, 310, 26, '#ffb0a0', 'center');
      button('retryPhase', 'この手番の始めから', 420, 340, 440, 48, retryPhase);
      button('retryFight', '戦いの前にもどる', 420, 396, 440, 48, retryFight);
    }
    if (G.menu) drawMenu();
    if (G.help) drawHelp();
  }
  function darker(hexc) { if (!hexc) return '#444'; const [r, g, b] = [1, 3, 5].map(k => parseInt(hexc.slice(k, k + 2), 16)); return `rgb(${r * 0.55 | 0},${g * 0.55 | 0},${b * 0.55 | 0})`; }
  function pips(cx, cy, hp, mhp, col, small, lose) {
    const w = small ? 4 : 7, gap = small ? 2 : 2, hh = small ? 4 : 6, tot = mhp * (w + gap) - gap;
    let x = Math.round(cx - tot / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - 2, cy - 2, tot + 4, hh + 4);
    const blink = Math.sin(G.t * 8) > 0;
    for (let k = 0; k < mhp; k++) {
      const lost = lose && k < hp && k >= hp - lose;
      ctx.fillStyle = k < hp ? (lost ? (blink ? '#ff5040' : col) : col) : 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + k * (w + gap), cy, w, hh);
    }
  }
  function heroCard(st, id, x, y) {
    const u = S.unitById(G.st, id);
    if (!u) return;
    const sel = G.sel === id;
    const w = 198, h = 88;
    const combat = G.st.mode === 'combat';
    const done = combat && (u.acted || u.ko);
    ctx.globalAlpha = done && !sel ? 0.6 : 1;
    panel(x, y - (sel ? 6 : 0), w, h, 0.9, sel ? HC[id] : 'rgba(170,160,210,0.35)');
    const fr = SP.frame(id, 0, 'idle');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fr.c, x + 8, y + 8 - (sel ? 6 : 0) + (sel ? Math.round(Math.sin(G.t * 4)) : 0), fr.w * 3, fr.h * 3 > 72 ? 72 : fr.h * 3);
    const yy = y - (sel ? 6 : 0);
    txt((S.HERO_IDS.indexOf(id) + 1) + ' ' + NAME[id], x + 62, yy + 26, 20, sel ? '#fff' : '#ddd');
    txt(S.HERO[id].verbName, x + 62, yy + 48, 15, HC[id], 'left');
    let inc = 0;
    if (combat && !G.busy) for (const it of G.intents) if (it.target === id) inc += it.dmg;
    pips(x + 62 + u.mhp * 4.5, yy + 60, u.hp, u.mhp, HC[id], false, inc);
    txt(u.hp + '/' + u.mhp, x + w - 8, yy + 69, 14, u.hp < u.mhp ? '#ffd0c0' : '#e8e4f4', 'right');
    if (combat) {
      txt(u.ko ? '倒れている' : u.acted ? '行動ずみ' : '移動 ' + u.mv + '　行動 ○', x + 62, yy + 84, 14, u.acted || u.ko ? '#998' : '#cfe', 'left', 'normal');
      if (inc) { txt('見こみ', x + w - 8, yy + 14, 12, '#ffb8a8', 'right', 'normal'); txt((inc >= u.hp ? '倒される ' : '') + '−' + inc, x + w - 8, yy + 32, 16, inc >= u.hp ? '#ff5040' : '#ff9a80', 'right'); }
    }
    else txt(sel ? '先頭で歩く' : '', x + 62, yy + 84, 13, '#aaa', 'left', 'normal');
    ctx.globalAlpha = 1;
    G.buttons.push({ key: 'hero_' + id, label: NAME[id], x, y: y - 6, w, h: h + 6, fn: () => selectHero(id) });
  }
  function drawCaption() {
    const c = G.caption;
    if (!c) return;
    const a = Math.min(1, c.t * 5, Math.max(0, (6 - c.t)));
    if (a <= 0) return;
    ctx.globalAlpha = a;
    const x = 640, y = 628, w = G.st.mode === 'combat' ? 404 : 626;
    panel(x, y, w, 76, 0.88, c.combo ? '#ffe08a' : 'rgba(170,160,210,0.35)');
    let xx = x + 14;
    if (c.combo) { txt('連携！', xx, y + 30, 18, '#ffe08a'); xx += 66; }
    for (const id of c.who || []) { ctx.fillStyle = HC[id]; ctx.fillRect(xx, y + 16, 14, 14); txt(NAME[id], xx + 18, y + 30, 16, HC[id]); xx += 26 + NAME[id].length * 16; }
    const lines = wrap(c.text, G.st.mode === 'combat' ? 21 : 33);
    lines.slice(0, 2).forEach((l, k) => txt(l, x + 14, y + 54 + k * 20, 17, '#f4ecd8', 'left', 'normal'));
    ctx.globalAlpha = 1;
  }
  function drawTooltip() {
    const hv = G.hv;
    if (!hv || G.busy) return;
    const lines = [];
    let col = '#fff';
    const p = hv.plan;
    const st = G.st;
    if (hv.intent && hv.intent.k === 'select') {
      lines.push([hv.why || (NAME[hv.intent.id] + 'を選ぶ'), '#fff']);
      if (!hv.why) lines.push([S.HERO[hv.intent.id].role + '：' + S.HERO[hv.intent.id].verbName, HC[hv.intent.id]]);
    } else if (p && p.ok) {
      const who = p.hero;
      const I = p.intent;
      const verb = I.k === 'move' ? (st.mode === 'explore' ? 'ここへ歩く' : 'ここへ動く') : I.k === 'push' ? '押す' : I.k === 'shoot' ? '射る' : I.k === 'rope' ? '鉤縄をかけて渡る' : I.k === 'freeze' ? '凍らせる' : I.k === 'light' ? '灯す' : '';
      lines.push([NAME[who] + '：' + verb, HC[who]]);
      if (hv.pv && hv.pv.cap) lines.push(['▶ ' + fut(hv.pv.cap.text), '#ffe9a0']);
      if (hv.pv && st.mode === 'explore' && hv.pv.evs.some(e => e.k === 'combat')) lines.push([I.k === 'move' ? '！途中で敵に気づかれ、戦いになる' : '！途中で敵に気づかれ、戦いになる（' + verb + 'のは取りやめ）', '#ff9a80']);
      if (I.k === 'push' && (hv.pushValid || []).length > 1) lines.push(['押す向きは矢印。物の別の側へマウスを寄せると変わる', '#bfe0ff']);
      if (hv.pv) {
        const ds = [];
        for (const id in hv.pv.dmg) { const u = S.unitById(st, id); if (u && u.team === 'e') ds.push(S.ENEMY[u.k].name + ' −' + hv.pv.dmg[id] + (hv.pv.ko.includes(id) ? '（倒れる）' : '')); }
        if (ds.length) lines.push([ds.join('　'), '#ffd0a0']);
        if (hv.pv.bloom) lines.push(['道がひらける！（' + hv.pv.bloom + 'マス）', '#a8ffb0']);
        if (st.mode === 'combat' && hv.pv.state) {
          const after = S.intents(hv.pv.state);
          let tot = 0; for (const it of after) if (it.target) tot += it.dmg;
          let now = 0; for (const it of G.intents) if (it.target) now += it.dmg;
          if (I.k !== 'move' || tot !== now) lines.push(['このあと敵から受ける見こみ：' + tot + (tot < now ? '（' + (now - tot) + '減る）' : tot > now ? '（' + (tot - now) + '増える）' : ''), tot < now ? '#a8ffb0' : tot > now ? '#ffb0a0' : '#ccc']);
        }
      }
      if (I.k === 'move') { const sf = S.surface(st, p.stand[0], p.stand[1]); lines.push(['高さ ' + sf.z + (st.mode === 'combat' ? '　（' + p.cost + '歩）' : ''), '#ccc']); }
      if (p.stand && (p.stand[0] !== S.unitById(st, who).x || p.stand[1] !== S.unitById(st, who).y) && I.k !== 'move') lines.push(['（半透明の場所まで歩いてから）', '#aaa']);
    } else if (hv.why) {
      lines.push([hv.why, '#ffb0a0']);
      if (hv.plan && hv.plan.whyAt) lines.push(['赤い × の所でさえぎられている', '#ff9a80']);
      if (hv.cell) { const sf = S.surface(st, hv.cell[0], hv.cell[1]); if (!sf.void) lines.push(['高さ ' + (st.t[S.idx(st, hv.cell[0], hv.cell[1])] === 'w' ? st.h[S.idx(st, hv.cell[0], hv.cell[1])] : sf.z), '#ccc']); }
    }
    if (hv.target && hv.target.k && !hv.target.team) {
      const o = hv.target;
      const nm = { bridge: '跳ね橋', crate: '木箱（ガルドが押せる）', block: '石のブロック（ガルドが押せる）', iceblock: '氷のかたまり（押すとすべる）', boulder: '大岩（押すと転がっていく）', pillar: st.up.gauntlet ? '石柱（ガルドが倒せる）' : '石柱（重くて動かない）', anchor: '鉄の輪（リコの鉤縄をかけられる）', target: '的（リコが射ると仕掛けが動く）', fall: '滝（セナが凍らせられる）', lantern: '大灯籠', chest: o.item && o.item.indexOf('page') === 0 ? '紙きれ' : '宝箱', exit: '門（次の区画へ）' }[o.k];
      if (nm) lines.unshift([nm, '#c8c0e0']);
    }
    if (hv.target && hv.target.team === 'e') {
      const e = hv.target;
      lines.unshift([S.ENEMY[e.k].name + '　体力 ' + e.hp + '/' + e.mhp + (S.ENEMY[e.k].fly ? '　飛ぶ' : '') + (S.ENEMY[e.k].heavy ? '　重い' : '') + (S.ENEMY[e.k].ranged ? '　弓 ' + S.ENEMY[e.k].range : ''), '#ffb8a0']);
    }
    if (!lines.length) return;
    const w = Math.max(...lines.map(l => l[0].length)) * 17 + 26, h = lines.length * 24 + 14;
    let x = G.mouse[0] + 22, y = G.mouse[1] + 18;
    if (x + w > 1270) x = G.mouse[0] - w - 16;
    if (y + h > 610) y = G.mouse[1] - h - 14;
    panel(x, y, w, h, 0.9);
    lines.forEach((l, k) => txt(l[0], x + 13, y + 28 + k * 24, 16, l[1], 'left', k === 0 ? 'bold' : 'normal'));
  }
  function drawBanner() {
    const b = G.banner;
    const a = Math.min(1, b.t * 5, (b.life - b.t) * 3);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    if (b.small) {
      txt(b.text, 640, 170, 30, b.col || '#fff', 'center');
    } else {
      const h = b.sub ? 104 : 72;
      ctx.fillStyle = 'rgba(8,6,20,0.72)'; ctx.fillRect(0, 150, 1280, h);
      txt(b.text, 640, 196, b.big ? 34 : 34, b.col || '#f4ecd8', 'center');
      if (b.sub) txt(b.sub, 640, 234, 18, '#d8d0f0', 'center', 'normal');
    }
    ctx.globalAlpha = 1;
  }
  function drawMenu() {
    ctx.fillStyle = 'rgba(4,3,12,0.6)'; ctx.fillRect(0, 0, 1280, 720);
    panel(420, 120, 440, 470);
    txt('メニュー', 640, 168, 26, '#f4ecd8', 'center');
    let y = 196;
    const b = (k, l, fn) => { button(k, l, 460, y, 360, 46, fn); y += 56; };
    b('resume', '続ける', () => { G.menu = false; });
    b('helpm', 'あそびかた', () => { G.menu = false; G.help = true; });
    b('restart', 'この区画をはじめからやり直す', restartSection);
    b('fast', '演出：' + (G.opt.fast ? 'はやい' : 'ふつう'), () => { G.opt.fast = !G.opt.fast; saveOpt(); });
    b('vol', '音量：' + Math.round(G.opt.vol * 10) + '　（押すと変わる）', () => { G.opt.vol = G.opt.vol >= 1 ? 0.2 : Math.round((G.opt.vol + 0.2) * 10) / 10; A.setVol(G.opt.vol); saveOpt(); A.sfx('select'); });
    b('totitle', 'タイトルへ（進み具合は保存ずみ）', () => { save(); G.menu = false; G.scene = 'title'; A.bgm('title'); });
  }
  function drawHelp() {
    ctx.fillStyle = 'rgba(4,3,12,0.7)'; ctx.fillRect(0, 0, 1280, 720);
    panel(140, 60, 1000, 600);
    txt('あそびかた', 640, 108, 28, '#f4ecd8', 'center');
    const L = [
      ['歩く', '床を押すと、選んだ仲間が先頭で歩き、二人がついてくる。のぼれる段差は1段、飛びおりられるのは2段まで'],
      ['仲間を選ぶ', '下の札・本人を押す、または 1・2・3 キー。選ぶと、その仲間が働きかけられる物が光る'],
      ['ガルド「押す」', '木箱・岩・敵を一升押す。向きは矢印で、物のどちら側にマウスを寄せるかで変わる。段から落ちた物は足場に、水に沈んだ物は飛び石に'],
      ['リコ「射る・鉤縄」', '的を射ると仕掛けが動く。鉄の輪に鉤縄をかけて渡ると、縄はみんなの道になる（下から届くのは2段上まで）'],
      ['セナ「凍らせる」', '水を凍らせて氷の床に。滝を凍らせると、のぼれる氷の段に。敵を凍らせると次の手番うごけず、押すとすべる'],
      ['働きかける', '物や敵を指すと、だれが・どこに立って・どうなるかが先に見える。押すとその場所まで歩いて行う'],
      ['戦い', '敵に気づかれると手番制。三人それぞれ「動いて、一つ行動」。赤い線は手番を終えたときの敵の動き'],
      ['地形で倒す', '崖・谷・水のそばへ押しだすと一押しで倒せる。高い所から射ると強い'],
      ['戻す・回す', 'Z（右クリック）で一つ前に戻す（戦いは手番の中だけ）。Q・E で見る向きを回す。ホイール・右ドラッグで見わたす'],
      ['困ったら', 'H でヒント（場所に光る印が出る）。吹き出しはクリックで送れる。演出はクリック・Space で早送り。やり直しはメニュー（Esc）'],
    ];
    L.forEach((l, k) => { txt(l[0], 180, 160 + k * 46, 18, '#ffe08a'); const ws = wrap(l[1], 44); ws.forEach((w, j) => txt(w, 380, 160 + k * 46 + j * 20, 16, '#e8e0f8', 'left', 'normal')); });
    button('closehelp', '閉じる', 560, 600, 160, 44, () => { G.help = false; });
  }

  // ---------- タイトル ----------
  let titleSt = null;
  function drawTitle() {
    if (!titleSt) {
      titleSt = S.create({ id: 'title', W: 8, H: 6, hmap: ['..555...', '.55555..', '4555554.', '4444444.', '.44444..', '..333...'], tmap: ['..ggd...', '.gddgg..', 'ggdggdg.', 'gggdggg.', '.ggggd..', '..ggg...'], objs: [{ k: 'torch', x: 2, y: 1, fz: 2 }], enemies: [], start: { gard: [3, 1, 3], riko: [4, 1, 3], sena: [5, 2, 3] } }, {});
    }
    const keepRot = R.rot;
    R.rot = 0;
    R.resetCache(titleSt);
    R.goalLit = 0; R.starsLit = 0;
    const [ax, ay] = R.rawProj(titleSt, 3.5, 2.5, 4);
    R.cam.x = ax - (215 - R.LW / 2); R.cam.y = ay - (262 - R.LH / 2);
    R.hi.objs = {};
    R.draw(lx, { st: titleSt, sec: { bg: { goal: [470, 120] } }, disp: {}, odisp: {}, tint: {} }, G.t);
    lightsOn(lx, titleSt, {});
    R.rot = keepRot;
    titleDirty = true;
    ctx.drawImage(low, 0, 0, 1280, 720);
    txt('せーの、', 110, 130, 40, '#c8c0e0');
    txt('星見の露台へ', 110, 200, 64, '#f6eed8');
    txt('三人で行く、大洞（おおうろ）の遠征', 114, 246, 20, '#b8b0d8', 'left', 'normal');
    const sv = loadSave();
    let y = 300;
    const bx = 760;
    if (sv) { button('cont', 'つづきから（' + (secDef(sv.sec) ? secDef(sv.sec).sub : '') + '）', bx, y, 380, 54, () => { A.init(); resume(sv); }, { size: 20 }); y += 66; }
    button('new', 'はじめから', bx, y, 380, 54, () => { A.init(); newGame(); }, { size: 20 }); y += 66;
    button('sound', '音：' + (G.opt.on ? 'あり' : 'なし'), bx, y, 180, 44, toggleSound);
    txt('マウスで遊ぶ。キーボードも使える（？で操作の一覧）', 114, 690, 15, '#8a84a8', 'left', 'normal');
    txt('ONE PROMPT WORLDS #19', 1260, 700, 14, '#6a6488', 'right', 'normal');
  }
  let titleDirty = false;
  function newGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 無視 */ }
    G.playTime = 0; G.firstFight = true; R.rot = 0; G.sel = 'gard';
    startStory(D.PROLOGUE, () => startSection(D.SECTIONS[0].id, {}));
  }

  // ---------- 物語の頁 ----------
  function startStory(pages, done) {
    G.scene = 'story';
    G.story = { pages, k: 0, t: 0, done };
    A.bgm('title');
  }
  function storyNext(skip) {
    const s = G.story; if (!s) return;
    if (s.t < 0.35 && !skip) return;
    if (skip || s.k >= s.pages.length - 1) { G.story = null; s.done(); return; }
    s.k++; s.t = 0; A.sfx('click');
  }
  function drawStory() {
    const s = G.story;
    R.cam.x = 0; R.cam.y = 0;
    R.drawBackdrop(lx, { bg: { goal: [320, 200] } }, G.t);
    ctx.drawImage(low, 0, 0, 1280, 720);
    ctx.fillStyle = 'rgba(4,3,12,0.45)'; ctx.fillRect(0, 0, 1280, 720);
    const pg = s.pages[s.k];
    const a = Math.min(1, s.t * 2.5);
    ctx.globalAlpha = a;
    const lines = wrap(pg, 30);
    lines.forEach((l, k) => txt(l, 640, 300 + k * 40 - lines.length * 20, 26, '#f4ecd8', 'center', 'normal'));
    ctx.globalAlpha = 1;
    txt((s.k + 1) + ' / ' + s.pages.length + '　クリックで次へ', 640, 640, 16, '#9a94b8', 'center', 'normal');
    button('skip', 'とばす', 1120, 20, 140, 40, () => storyNext(true));
  }

  // ---------- 結末 ----------
  function beginEnding() {
    G.scene = 'ending';
    const st = G.st;
    G.ending = { k: 0, t: 0, st: G.vs || st, time: G.playTime, t0: G.t };
    if (G.ending.st && G.ending.st.W) R.resetCache(G.ending.st);
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 無視 */ }
    A.bgm('ending');
  }
  function endingNext() {
    const e = G.ending; if (!e) return;
    if (e.t < 0.6) return;
    if (e.k < D.EPILOGUE.length) { e.k++; e.t = 0; A.sfx('click'); }
  }
  function drawEnding() {
    const e = G.ending;
    const st = e.st;
    R.goalLit = 1; R.starsLit = Math.min(1, 0.4 + e.t * 0.2 + e.k * 0.3);
    const L = st.objs && st.objs.find(o => o.k === 'lantern');
    if (L && st.W) {
      // 大灯籠のまわりを、ゆっくり見わたす
      const [ax, ay] = R.rawProj(st, L.x + 0.5, L.y + 1.5, L.z + 1);
      const sway = Math.sin((G.t - (e.t0 || 0)) * 0.15) * 30;
      R.cam.x = ax + sway; R.cam.y = ay + 30;
      R.hi.objs = {};
      R.draw(lx, { st, sec: { bg: { top: '#14123a', mid: '#1c1840' } }, disp: {}, odisp: {}, tint: {} }, G.t);
      lightsOn(lx, st, {});
    } else R.drawBackdrop(lx, { bg: { goal: [320, 170], top: '#14123a', mid: '#1c1840' } }, G.t);
    ctx.drawImage(low, 0, 0, 1280, 720);
    if (e.k < D.EPILOGUE.length) {
      const a = Math.min(1, e.t * 2);
      ctx.fillStyle = 'rgba(4,3,12,0.62)'; ctx.fillRect(0, 520, 1280, 160);
      ctx.globalAlpha = a;
      const lines = wrap(D.EPILOGUE[e.k], 34);
      lines.forEach((l, k) => txt(l, 640, 584 + k * 38 - (lines.length - 1) * 19, 26, '#f6eed8', 'center', 'normal'));
      ctx.globalAlpha = 1;
      txt('クリックで次へ', 1240, 668, 15, '#9a94b8', 'right', 'normal');
      return;
    }
    ctx.fillStyle = 'rgba(4,3,12,0.45)'; ctx.fillRect(0, 0, 1280, 720);
    // 記録
    panel(150, 50, 980, 620);
    txt('遠征の記録', 640, 100, 30, '#ffe9a0', 'center');
    const s = st.stats;
    const mm = Math.floor(e.time / 60), ss = Math.floor(e.time % 60);
    txt('かかった時間　' + mm + '分' + String(ss).padStart(2, '0') + '秒', 200, 150, 18, '#e8e0f8', 'left', 'normal');
    txt('戦い ' + s.fights + '回　手番 ' + (s.turns + s.fights) + '　連携 ' + s.combos + '回　戻した回数 ' + s.undo + '　ヒント ' + s.hints, 200, 178, 18, '#e8e0f8', 'left', 'normal');
    const pages = st.items.filter(i => i.indexOf('page') === 0).length;
    txt('ハレの覚え書き　' + pages + ' / ' + D.PAGE_TOTAL + ' 枚', 200, 206, 18, pages >= D.PAGE_TOTAL ? '#ffe08a' : '#e8e0f8', 'left', 'normal');
    const rows = [['gard', '押した', s.push], ['riko', '射た・渡った', s.shoot + s.rope], ['sena', '凍らせた', s.freeze]];
    rows.forEach((r, k) => {
      const fr = SP.frame(r[0], 0, 'idle');
      ctx.drawImage(fr.c, 210 + k * 300, 232, fr.w * 3, fr.h * 3);
      txt(NAME[r[0]], 270 + k * 300, 262, 20, HC[r[0]]);
      txt(r[1] + ' ' + r[2] + '回', 270 + k * 300, 288, 16, '#ddd', 'left', 'normal');
      txt('倒した敵 ' + (s.kills[r[0]] || 0), 270 + k * 300, 312, 16, '#ddd', 'left', 'normal');
    });
    txt('この遠征の名場面', 200, 370, 20, '#ffe9a0');
    const ms = (st.moments || []).slice(0, 4);
    ms.forEach((m, k) => {
      const def = secDef(m.sec);
      let xx = 210;
      for (const id of m.who) { ctx.fillStyle = HC[id]; ctx.fillRect(xx, 392 + k * 46, 12, 12); xx += 16; }
      txt((def ? def.name : '') + '：' + m.who.map(w => NAME[w]).join('と') + (m.who.length > 1 ? 'の連携' : ''), xx + 6, 404 + k * 46, 16, '#e8e0f8', 'left', 'bold');
      txt('　' + m.text + (m.cells ? '（' + m.cells + 'マスの道）' : '') + (m.kills ? '（' + m.kills + '体）' : ''), 220, 426 + k * 46, 15, '#cfc8e8', 'left', 'normal');
    });
    button('again', 'もう一度はじめから', 380, 600, 250, 50, () => { newGame(); });
    button('title', 'タイトルへ', 650, 600, 250, 50, () => { G.scene = 'title'; A.bgm('title'); });
  }

  // ---------- 絵の一覧（確認用） ----------
  function drawSheet() {
    ctx.fillStyle = '#2a2638'; ctx.fillRect(0, 0, 1280, 720);
    const kinds = ['gard', 'riko', 'sena', 'goblin', 'archer', 'slime', 'bat', 'golem', 'wisp'];
    const poses = ['idle', 'walk1', 'walk2', 'act'];
    kinds.forEach((k, r) => {
      for (let sd = 0; sd < 4; sd++) poses.forEach((p, j) => {
        const fr = SP.frame(k, sd, p);
        if (fr) ctx.drawImage(fr.c, 20 + (sd * 4 + j) * 76, 10 + r * 78, fr.w * 3, fr.h * 3);
      });
    });
  }

  function itemName(it) {
    if (!it) return '';
    if (it.indexOf('page') === 0) return 'ハレの覚え書き';
    return { rope2: '長い鉤縄', gauntlet: '巨人の籠手', ring: '霜の指輪' }[it] || it;
  }

  // ---------- 確認用の口 ----------
  window.G19 = {
    G, S, R,
    state: () => G.st,
    scene: () => G.scene,
    busy: () => G.busy || !!G.trans,
    buttons: () => G.buttons.map(b => ({ key: b.key, label: b.label, x: b.x + b.w / 2, y: b.y + b.h / 2, off: b.off })),
    cellScreen: (x, y) => { const st = G.st; const sf = S.surface(st, x, y); const z = sf.void ? 0 : ('wr'.includes(st.t[S.idx(st, x, y)]) ? st.h[S.idx(st, x, y)] : sf.z); const [a, b] = R.projF(st, x, y, z); return { x: a * 2, y: b * 2 }; },
    unitScreen: (id) => { const r = R.unitRects.find(q => q.id === id); return r ? { x: (r.x + r.w / 2) * 2, y: (r.y + r.h / 2) * 2 } : null; },
    objScreen: (id) => {
      const o = S.objById(G.st, id); if (!o) return null;
      if (o.k === 'bridge') { const rr = (R.objRects || []).find(q => q.id === id); return rr ? { x: (rr.x + rr.w / 2) * 2, y: (rr.y + rr.h / 2) * 2 } : null; }
      if (o.k === 'fall') { const st = G.st; const [x0, y0] = R.projF(st, o.x, o.y, st.h[S.idx(st, o.x, o.y)]); const [x1, y1] = R.projF(st, o.bx, o.by, o.bz); return { x: (x0 + x1), y: (Math.min(y0, y1) + y1) }; }
      const dz = o.k === 'anchor' ? 1.4 : o.k === 'target' ? 1.8 : o.k === 'pillar' ? 1.5 : o.k === 'lantern' ? 1.6 : 0.6;
      const ox = o.k === 'anchor' ? -7 : 0;
      const [a, b] = R.projF(G.st, o.x, o.y, (o.z || 0) + dz); return { x: (a + ox) * 2, y: b * 2 };
    },
    dirOffset: (dir) => { const sd = R.sdir(dir); return [[16, 12], [-16, 12], [-16, -16], [16, -16]][sd]; },
    entCenter: (ref) => { const st = G.st; const e = ref.u ? S.unitById(st, ref.u) : S.objById(st, ref.o); const [a, b] = R.projF(st, e.x, e.y, (e.z || 0)); return { x: a * 2, y: (b - 6) * 2 }; },
    start: (id) => { A.init(); G.playTime = 0; startSection(id || D.SECTIONS[0].id, {}); },
    goto: (id, fn) => { const st = S.create(secDef(id), {}); if (fn) fn(st); G.sec = secDef(id); G.st = st; G.entry = S.clone(st); enterPlay(); },
    hold: (v) => { G.hold = v; },
    step: (n, dt) => { for (let k = 0; k < (n || 1); k++) { G.holdStep = dt || 1 / 60; update(G.holdStep); } draw(); },
    act: (heroId, intent) => { const p = S.plan(G.st, heroId, intent); if (p.ok) doAction(p); return p; },
    endTurn, undo, select: selectHero, rotate, hint,
    hover: () => G.hv ? { why: G.hv.why, target: G.hv.target && (G.hv.target.k || G.hv.target.id), pushValid: G.hv.pushValid, plan: G.hv.plan && { ok: G.hv.plan.ok, why: G.hv.plan.why, whyAt: G.hv.plan.whyAt, hero: G.hv.plan.hero, intent: G.hv.plan.intent, stand: G.hv.plan.stand }, cap: G.hv.pv && G.hv.pv.cap && G.hv.pv.cap.text, bloom: G.hv.pv && G.hv.pv.bloom } : null,
    bubbles: () => G.bubbles.map(b => b.who + ':' + b.text),
    caption: () => G.caption && G.caption.text,
    setOpt: (o) => Object.assign(G.opt, o),
    ending: () => beginEnding(),
    lookAt: (x, y) => { const st = G.st; const u = S.unitById(st, G.sel); const [a, b] = R.rawProj(st, x, y, S.surface(st, x, y).void ? 0 : S.surface(st, x, y).z); const [c, d] = R.rawProj(st, u.x, u.y, u.z); G.camOff = [a - c, b - d + 20]; G.camLook = null; },
    startFight: (grp) => { const prev = S.clone(G.st); const evs = []; G.combatEntry = S.clone(G.st); S.startCombat(G.st, grp || 1, evs); G.combatStarted = G.st.stats.fights; G.vs = prev; queue(evs); },
  };

  if (QS.has('sheet')) G.scene = 'sheet';
  A.bgm('title');
  requestAnimationFrame(frame);
})();
