// GUILDWARD — 画面・入力・演出・保存（依頼の地図の上での遊び。ギルドの画面は hub.js）
// 第19作「せーの、星見の露台へ」の main.js をもとに、編成式・新しい働きかけ・目的・帰還を足した
(function () {
  'use strict';
  const S = window.S21, R = window.R21, D = window.D21, SP = window.SPR21, A = window.A21, C = window.C21;
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const low = document.createElement('canvas'); low.width = R.LW; low.height = R.LH;
  const lx = low.getContext('2d');
  lx.imageSmoothingEnabled = false; ctx.imageSmoothingEnabled = false;
  const FONT = '"BIZ UDPGothic","Yu Gothic UI","Meiryo","Hiragino Sans",sans-serif';
  const HC = { riko: S.HERO.riko.color, gard: S.HERO.gard.color, sena: S.HERO.sena.color, tobi: S.HERO.tobi.color, tb: S.HERO.tobi.color, nagi: S.HERO.nagi.color, hiba: '#e8c060',
    mimoza: '#e8c84a', dora: '#e8823a', tonbo: '#9aa6ba', turu: '#d8a878', hans: '#c8a070', kid: '#d86a5a', elder: '#b0b0b8', bolo: '#b0b0b8', dan: '#b0b0b8', m1: '#b0b0b8', m2: '#b0b0b8', narr: '#c8c0e0' };
  const SAVE_KEY = 'beyond2_guildward_save';
  const OPT_KEY = 'beyond2_guildward_opt';
  const QS = new URLSearchParams(location.search);
  const VERBNAME = { move: '歩く', push: '押す', shoot: '射る', rope: '鉤縄をかけて渡る', freeze: '凍らせる', blast: '発破', light: '灯す', pull: '引き鉤で引く', waft: 'あおぐ' };

  function fit() {
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    cv.style.width = Math.floor(1280 * s) + 'px';
    cv.style.height = Math.floor(720 * s) + 'px';
  }
  window.addEventListener('resize', fit); fit();

  // ---------- 状態 ----------
  const G = {
    scene: 'title', t: 0, st: null, vs: null, sec: null, prof: null, req: null,
    disp: {}, odisp: {}, queue: [], cur: null, busy: false,
    sel: 'riko', hover: null, hv: null, undo: [], entry: null, combatEntry: null, phaseStart: null,
    fx: [], lines: [], pops: [], bubbles: [], narr: [], caption: null, banner: null, bloom: null, poi: [],
    shake: 0, camOff: [0, 0], camLook: null, buttons: [], mouse: [0, 0], drag: null,
    intents: [], reachTint: null, menu: false, help: false, loseMenu: false, trans: null,
    opt: { fast: false, vol: 0.7, on: true }, story: null, firstFight: true, hintIdx: 0, cleared: false,
  };
  try { Object.assign(G.opt, JSON.parse(localStorage.getItem(OPT_KEY) || '{}')); } catch (e) { /* 保存なし */ }
  A.on = G.opt.on; A.vol = G.opt.vol;
  function saveOpt() { try { localStorage.setItem(OPT_KEY, JSON.stringify(G.opt)); } catch (e) { /* 無視 */ } }

  SP.build();

  // ---------- 保存 ----------
  function save() {
    if (!G.prof) return;
    try {
      const play = G.scene === 'play' && G.st && !G.trans ? { req: G.req, st: G.st, entry: G.entry, rot: R.rot, sel: G.sel, cleared: G.cleared, stampSeen: G.stampSeen || [] } : null;
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: C.SAVE_V, prof: G.prof, play, firstFight: G.firstFight }));
    } catch (e) { /* 容量など */ }
  }
  // v0.1 の保存は、読みこむときに v0.2 の形へ移す（依頼の途中の保存だけ、ギルドからの再開になる）
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!s || !s.prof) return null;
      return C.migrate(s);
    } catch (e) { return null; }
  }

  // ---------- 名前・話し手 ----------
  function nameOf(who) {
    if (S.HERO[who]) return S.HERO[who].name;
    const P = D.PEOPLE.find(p => p.id === who || p.k === who);
    if (P) return P.name;
    if (G.st) { const u = S.unitById(G.st, who); if (u) return u.name || (S.info(u) || {}).name || ''; }
    return '';
  }
  function colorOf(who) {
    if (HC[who]) return HC[who];
    if (G.st) { const u = S.unitById(G.st, who); if (u && HC[u.k]) return HC[u.k]; }
    return '#c8c0e0';
  }
  function partyIds(st) { st = st || G.st; return st ? st.units.filter(u => u.team === 'h').map(u => u.id) : []; }

  // ---------- 依頼を始める ----------
  function startMission(reqId, party) {
    const r = D.req(reqId);
    const def = D.map(r.map);
    G.req = reqId; G.sec = def;
    G.st = S.create(def, C.carry(G.prof, party, reqId));
    G.entry = S.clone(G.st);
    G.cleared = false;
    G.stampSeen = [];
    G.sel = 'riko'; R.rot = 0;
    enterPlay();
    G.banner = { text: r.kind + '　' + r.title, sub: '目的：' + r.goal, t: 0, life: 2.8, big: true };
    const looks = def.looks || [(() => {
      const o = G.st.objs.find(q => q.k === 'chest' && q.item) || G.st.units.find(u => u.team === 'n') || G.st.objs.find(q => q.k === 'door') || G.st.units.find(u => u.boss);
      return o ? [o.x, o.y] : null;
    })()];
    G.camLooks = looks.filter(Boolean).map(p => ({ x: p[0], y: p[1], z: S.surface(G.st, p[0], p[1]).void ? 0 : S.surface(G.st, p[0], p[1]).z, t: 0, life: 2.2, intro: true }));
    G.camLook = G.camLooks.shift() || null;
    if (def.enterSay) for (const s of def.enterSay) say(s[0], s[1]);
    A.bgm(def.music || 'field');
    if (def.startFight) {
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
    R.hubPick = false;
    G.vs = S.clone(G.st);
    G.disp = {}; G.odisp = {}; G.queue = []; G.cur = null; G.busy = false;
    G.undo = []; G.fx = []; G.lines = []; G.pops = []; G.bloom = null; G.poi = []; G.caption = null; G.bubbles = []; G.narr = [];
    G.loseMenu = false; G.menu = false; G.camOff = [0, 0]; G.hintMark = null; G.bannerQ = []; G.stampNotes = [];
    R.resetCache(G.st);
    R.goalLit = 0; R.starsLit = 0;
    const u = S.unitById(G.st, G.sel);
    if (!u || u.ko || u.team !== 'h') G.sel = 'riko';
    boxCache = null;
    snapCam();
    refresh();
  }
  function resumePlay(sv) {
    const p = sv.play;
    G.req = p.req; G.sec = D.map(D.req(p.req).map);
    G.st = p.st; G.entry = p.entry || S.clone(p.st); R.rot = p.rot || 0; G.sel = p.sel || 'riko'; G.cleared = !!p.cleared;
    G.stampSeen = (p.stampSeen || []).slice();
    enterPlay();
    const r = D.req(G.req);
    G.banner = { text: r.kind + '　' + r.title, sub: '目的：' + r.goal, t: 0, life: 2.0, big: true };
    A.bgm(G.st.mode === 'combat' ? 'combat' : (G.sec.music || 'field'));
    if (G.st.mode === 'combat') { G.phaseStart = S.clone(G.st); G.combatEntry = G.combatEntry || S.clone(G.st); }
  }
  // 依頼を終えて（またはあきらめて）ギルドへ
  function goGuild(done) {
    G.trans = { t: 0, guild: true, done: !!done };
    A.sfx('select', { f: 520 });
  }

  // ---------- 吹き出し・字幕 ----------
  function say(who, text) {
    if (who === 'narr') { if (!G.narr.some(n => n.text === text)) G.narr.push({ text, t: 0, life: 2.6 + text.length * 0.06 }); return; }
    if (G.scene === 'play') { const u = S.unitById(G.st, who); if (!u) return; }
    if (G.bubbles.some(b => b.text === text)) return;
    G.bubbles.push({ who, text, t: 0, life: 2.2 + text.length * 0.065 });
    if (G.bubbles.length > 5) G.bubbles.splice(1, 1);
  }
  // 大きな見出しが出ている間に次の見出しが来たら、順番に出す
  function setBanner(b) {
    G.bannerQ = G.bannerQ || [];
    const cur = G.banner;
    if (cur && !cur.small && !b.small && cur.t < cur.life - 0.5 && cur.prio) { G.bannerQ.push(b); return; }
    G.banner = b;
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
      case 'walk': if (!e._s) e._s = segs(e.path, e.slow ? 0.16 : e.enemy ? STEP_EN : (G.st && G.st.mode === 'combat' ? STEP_CB : STEP_EX)); return e._s.total;
      case 'group': prepGroup(e); return Math.max(0, ...e.evs.map(s => (s._delay || 0) + evDur(s)));
      case 'slide': if (!e._s) e._s = segs(e.path, (e.roll || e.slip) ? 0.075 : 0.13); return e._s.total + 0.05;
      case 'act': return 0.17;
      case 'arrow': return 0.2;
      case 'rope': return 0.24;
      case 'zip': return 0.34;
      case 'frost': return 0.22;
      case 'freezeCells': return 0.36;
      case 'freezeUnit': return 0.14;
      case 'freezeFall': return 0.6;
      case 'bomb': return 0.42;
      case 'boom': return 0.3;
      case 'shatter': return 0.32;
      case 'fall': return 0.16 + Math.min(0.3, (e.drop || 1) * 0.03);
      case 'bump': return 0.14;
      case 'dmg': return 0.1;
      case 'clang': return 0.22;
      case 'flip': return 0.5;
      case 'ko': return 0.3;
      case 'sink': return 0.36;
      case 'break': return 0.22;
      case 'topple': return 0.6;
      case 'target': return 0.18;
      case 'crystal': return 0.4;
      case 'rune': return 0.45;
      case 'runesDone': return 0.8;
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
      case 'frozenSkip': case 'flipSkip': return 0.28;
      case 'flipUp': return 0.4;
      case 'endure': return 0.5;
      case 'win': return 1.05;
      case 'lose': return 0.9;
      case 'found': return 0.35;
      case 'guest': return 0.6;
      case 'safe': return 0.5;
      case 'spawn': return 0.7;
      case 'steal': return 0.5;
      case 'flee': return 0.35;
      case 'cleared': return 1.2;
      case 'drain': case 'linkShow': return 0.7;
      // v0.3：引き鉤・レバー・つらら・雪
      case 'hook': return 0.3;
      case 'lever': return 0.35;
      case 'icicle': return 0.18 + Math.min(0.3, Math.max(1, (e.z0 - e.z1)) * 0.035);
      case 'iceShatter': return 0.2;
      case 'snowClear': return 0.25;
      // v0.3：あおぐ（弧を描いて、ふわりと下りる）・風鳴り石
      case 'gust': return 0.16;
      case 'waft': return 0.5 + Math.min(0.2, (e.arc || 1) * 0.05);
      case 'chime': return 0.6;
      default: return 0;
    }
  }
  // 転がる大岩の group：当てた傷（atCell つき）は、大岩がその升に来たときに見せる
  function prepGroup(e) {
    if (e._prep) return;
    e._prep = true;
    const sl = e.evs.find(s => s.k === 'slide');
    if (!sl) return;
    evDur(sl);
    const n = {};
    for (const s of e.evs) {
      if (s.atCell === undefined) continue;
      const j = s.atCell, L = sl._s.list;
      const base = j >= sl.path.length || !L[j - 1] ? sl._s.total : L[j - 1].t0 + L[j - 1].d * 0.55;
      n[j] = (n[j] || 0) + 1;
      s._delay = base + (n[j] - 1) * 0.06;
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
      case 'group': if (e.roll) G.rollCount = 0; for (const s of e.evs) { s._c = { t: 0, dur: evDur(s) }; if (!s._delay) { s._started = true; onStart(s, s._c); } } break;
      case 'act': {
        const d = dispOf(e.id); const u = U(e.id);
        d.pose = 'act'; if (u) d.sd = R.sdir(S.faceTo(u.x, u.y, e.tx, e.ty, u.face));
        if (e.verb === 'push') A.sfx('grunt');
        if (e.verb === 'shoot') A.sfx('draw');
        if (e.verb === 'rope') A.sfx('rope');
        if (e.verb === 'freeze') A.sfx('charge');
        if (e.verb === 'blast') A.sfx('fuse');
        if (e.verb === 'pull') A.sfx('draw');
        if (e.verb === 'waft') A.sfx('waft');
        G.camFocusOverride = [e.tx, e.ty, e.tz];
        break;
      }
      case 'arrow': A.sfx('arrow'); G.lines.push({ k: 'arrow', from: e.from, to: e.to, t: 0, dur: c.dur }); break;
      case 'bomb': G.lines.push({ k: 'bomb', from: e.from, to: e.to, t: 0, dur: c.dur }); break;
      case 'boom': {
        A.sfx('boom', { big: e.big ? 1.4 : 1 });
        G.shake = Math.max(G.shake, e.big ? 0.6 : 0.45);
        G.fx.push({ k: 'ring', x: e.x, y: e.y, z: e.z + 0.3, t: 0, life: 0.45, big: e.big });
        burst(e.x, e.y, e.z + 0.6, 22, '#ffd070', 3.2); burst(e.x, e.y, e.z + 0.4, 14, '#ff7a2a', 2.4); burst(e.x, e.y, e.z + 0.3, 18, '#8a8090', 1.6, true);
        break;
      }
      case 'shatter': A.sfx('crash'); burst(e.x, e.y, e.z + (e.h || 2) * 0.5, 26, '#9a8e80', 2.6); G.shake = Math.max(G.shake, 0.35); break;
      case 'rope': G.lines.push({ k: 'ropeThrow', from: e.from, to: e.to, t: 0, dur: c.dur }); break;
      case 'zip': A.sfx('zip'); break;
      case 'frost': for (let k = 0; k < 14; k++) G.fx.push({ k: 'frost', from: e.from, to: e.to, t: -k * 0.012, life: c.dur, x: 0, y: 0, z: 0 }); break;
      case 'freezeCells': A.sfx('frost'); e._done = {}; break;
      case 'freezeUnit': { A.sfx('crack'); const u = U(e.id); if (u) { u.frozen = 2; burst(u.x, u.y, u.z + 1, 10, '#c8f4ff', 1.5); } break; }
      case 'freezeFall': A.sfx('frost'); setTimeout(() => A.sfx('crack'), 150); break;
      case 'crystal': { A.sfx('frost'); setTimeout(() => A.sfx('ding'), 200); const o = O(e.o); if (o) burst(o.x, o.y, o.z + 2, 20, '#dff8ff', 2); break; }
      case 'rune': A.sfx('rune', { n: e.n }); G.banner = { text: (G.sec.runeName || '門の灯') + '　' + e.n + ' / ' + ((G.st.obj && G.st.obj.need) || 3), t: 0, life: 1.4, col: '#a8e8ff', small: true }; break;
      case 'runesDone': A.sfx('door'); A.sfx('bloom', { size: 3 }); setBanner({ text: e.label || '門がひらいた！', sub: e.label ? '' : '奥へ進める', t: 0, life: 2.0, col: '#bfefff', prio: true }); G.shake = Math.max(G.shake, 0.3); break;
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
      case 'clang': { if (G.queue.some(q => q.k === 'flip' && q.id === e.id)) break; const u = U(e.id); if (u) { const d = G.disp[e.id] || u; popup(d.x, d.y, d.z + 3, 'カキン！', '#d8d8e8'); } A.sfx('clang'); break; }
      case 'flip': {
        const u = U(e.id); if (u) { u.flipped = e.left || 2; const d = G.disp[e.id] || u; popup(d.x, d.y, d.z + 5.4, 'ひっくり返った！', '#ffe680', true); burst(d.x, d.y, d.z + 1, 24, '#d8d0a0', 2.4, true); burst(d.x, d.y, d.z + 2, 14, '#fff4c0', 3.2); }
        A.sfx('flip'); G.shake = Math.max(G.shake, 0.6);
        // はじめてのすきは、設計の字幕「ひっくり返った！ 次の手番の終わりまで、お腹が出ている」を大きく出す
        if (G.st && G.st.mode === 'combat') setBanner(e.first
          ? { text: 'ひっくり返った！', sub: '次の手番の終わりまで、お腹が出ている（どの攻撃も +1）', t: 0, life: 2.6, col: '#ffe680', prio: true }
          : { text: 'すき！', sub: '次の手番の終わりまで、お腹に攻撃が通る', t: 0, life: 1.6, col: '#ffe680' });
        break;
      }
      case 'flipUp': { const u = U(e.id); if (u) { u.flipped = 0; const d = G.disp[e.id] || u; popup(d.x, d.y, d.z + 3, '起きあがった', '#e8d8a0'); burst(d.x, d.y, d.z + 0.5, 12, '#a89c8c', 1.4, true); } A.sfx('thud', { big: 2 }); break; }
      case 'endure': { const u = U(e.id); if (u) { const d = G.disp[e.id] || u; popup(d.x, d.y, d.z + 3.2, 'こらえた！（身がわりの木札）', '#ffe9a0', true); burst(d.x, d.y, d.z + 1.2, 16, '#f4d890', 2); } A.sfx('ding'); break; }
      case 'ko': {
        const u = U(e.id); if (!u) break;
        const d = G.disp[e.id] || u;
        if (e.atCell !== undefined && u.team === 'e') { G.rollCount = (G.rollCount || 0) + 1; popup(d.x, d.y, d.z + 5.2, G.rollCount + '体！', '#ffe680', G.rollCount >= 3); }
        if (['hp', 'enemy', 'push', 'arrow', 'arrowHigh', 'frost', 'bump', 'fall', 'crush', 'rock', 'blast', 'drop'].includes(e.how)) { burst(d.x, d.y, d.z + 1, 16, u.team === 'h' ? '#ffffff' : '#e8e0ff', 2.2); A.sfx('ko'); }
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
        if (e.empty) { A.sfx('click'); popup(e.x, e.y, (e.z || 0) + 3, '空っぽ（もう持ち帰った）', '#c8c0e0'); break; }
        A.sfx(e.item ? 'chest' : 'coin');
        burst(e.x, e.y, (e.z || 0) + 1, 18, '#fff0a0', 2);
        popup(e.x, e.y, (e.z || 0) + 3, e.item ? (D.ITEM[e.item] || e.item) : '銀貨 +' + e.coins, '#ffe6a0', true);
        break;
      }
      case 'iceblock': A.sfx(e.made ? 'frost' : 'crack'); break;
      case 'say': say(e.who, e.text); break;
      case 'caption':
        G.caption = { who: e.who, text: e.text, combo: e.combo, t: 0 };
        if (e.combo) A.sfx('select', { f: 990 });
        if (e.kills >= 2) { G.caption2 = { text: '×' + e.kills + '　まとめて倒した！', t: 0 }; A.sfx('win'); G.shake = Math.max(G.shake, 0.3); }
        break;
      case 'bloom': startBloom(e); break;
      case 'found': { const u = U(e.id); if (u) { popup(u.x, u.y, u.z + 3, '見つけた！', '#ffe9a0', true); u.found = true; } A.sfx('page'); break; }
      case 'guest': {
        const u = U(e.id); if (u) { u.team = 'h'; u.k = 'tobi'; u.fixed = true; }
        setBanner({ text: 'トビが手を貸してくれる', sub: '足をくじいて歩けない。その場から、発破を投げられる（札の「4」）', t: 0, life: 3.0, col: HC.tobi, prio: true });
        A.sfx('win');
        break;
      }
      case 'safe': { const u = U(e.id); if (u) popup(u.x, u.y, u.z + 3, (e.name || '') + ' 救出！', '#a8ffb0', true); A.sfx('bloom', { size: 2 }); break; }
      case 'spawn': {
        for (const u of e.units) { G.vs.units.push(S.clone(u)); burst(u.x, u.y, u.z + 1, 10, '#a89cc8', 1.6, true); }
        if (e.text) G.banner = { text: e.text, t: 0, life: 1.4, col: '#ff9a7a', small: true };
        A.sfx('combat');
        break;
      }
      case 'steal': { popup(e.x, e.y, e.z + 3, '米俵を盗られた！ のこり ' + e.left, '#ff9a80', true); A.sfx('lose'); G.shake = Math.max(G.shake, 0.25); break; }
      case 'flee': { const u = U(e.id); if (u) popup(u.x, u.y, u.z + 3, '逃げていった', '#c8c0e0'); break; }
      case 'combat': {
        A.sfx('combat'); A.bgm(G.sec.bossMusic || (G.sec.music === 'boss' ? 'boss' : 'combat'));
        const cn = e.cancel;
        setBanner({ text: '戦い', sub: G.firstFight ? '赤い線は「手番を終えたときの敵の動き」。手番を終えるまでは Z で何度でも戻せる' : cn ? '歩く途中で、敵に気づかれた' : '地形を使って切りぬけよう', t: 0, life: G.firstFight ? 3.4 : cn ? 2.2 : 1.4, col: '#ff8a6a', prio: G.firstFight });
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
        else A.sfx(e.slam ? 'thud' : 'grunt', { big: 2 });
        if (e.slam) G.shake = Math.max(G.shake, 0.35);
        break;
      }
      case 'frozenSkip': { const u = U(e.id); if (u) popup(u.x, u.y, u.z + 2.4, e.resist ? '凍って動けない（次は氷を振りはらう）' : '凍って動けない', '#bfefff'); break; }
      case 'flipSkip': { const u = U(e.id); if (u) popup(u.x, u.y, u.z + 2.6, 'もがいている（次の手番も、お腹が出たまま）', '#ffe680'); break; }
      case 'win': A.sfx('win'); A.bgm(G.sec.music || 'field'); G.banner = { text: '切りぬけた！', sub: 'みんな、体勢を立てなおした', t: 0, life: 1.6, col: '#ffe08a' }; break;
      case 'lose': A.sfx('lose'); A.bgm(null); G.banner = { text: e.why === 'raid' ? '米俵を、ぜんぶ盗られた…' : 'みんな倒れた…', sub: '', t: 0, life: 99, col: '#ff8a6a' }; break;
      case 'cleared': {
        A.sfx('fanfare');
        const r = D.req(G.req);
        setBanner({ text: '依頼達成！', sub: 'いつでも右上の「ギルドへ帰る」で帰れる。寄り道してもいい', t: 0, life: 3.2, col: '#ffe08a', prio: true });
        G.cleared = true;
        void r;
        break;
      }
      case 'drain': A.sfx('rumble'); A.sfx('splash'); break;
      case 'linkShow': A.sfx('chain'); break;
      case 'hook': A.sfx('hook'); G.lines.push({ k: 'hook', from: e.from, to: e.to, t: 0, dur: c.dur }); break;
      case 'lever': A.sfx('lever'); break;
      case 'icicle': A.sfx('crack'); break;
      case 'iceShatter': A.sfx('icefall'); burst(e.x, e.y, e.z, 16, '#dff8ff', 2.2); break;
      case 'gust': {
        // 風の筋（ナギから、運ぶ向きへ）
        const [dx, dy] = S.DIRS[e.dir || 0];
        for (let k = 0; k < 16; k++) G.fx.push({ k: 'p', x: e.from[0] + dx * 0.3, y: e.from[1] + dy * 0.3, z: e.from[2] + 0.8 + Math.random() * 0.8, vx: dx * (2.5 + Math.random() * 2) + (Math.random() - 0.5) * 0.6, vy: dy * (2.5 + Math.random() * 2) + (Math.random() - 0.5) * 0.6, vz: Math.random() * 0.8, g: 0, t: 0, life: 0.4 + Math.random() * 0.25, col: k % 3 ? '#f4f8ff' : '#f2e0a0', sz: 1 });
        break;
      }
      case 'waft': A.sfx('whoosh'); break;
      case 'chime': A.sfx('chime'); burst(e.x, e.y, e.z + 2.4, 20, '#ffe9a0', 1.8); G.fx.push({ k: 'ring', x: e.x, y: e.y, z: e.z + 2, t: 0, life: 0.6 }); break;
      case 'snowClear': A.sfx('scrape', { d: 0.2 }); for (const [x, y] of e.cells) burst(x, y, (G.vs.h[S.idx(G.vs, x, y)] || 0) + 0.3, 8, '#f4f8ff', 1.6, true); break;
    }
  }

  function onUpdate(e, p, t) {
    switch (e.k) {
      case 'group': for (const s of e.evs) {
        const d = s._delay || 0;
        if (!s._started) { if (t < d) continue; s._started = true; onStart(s, s._c); }
        const lt = t - d;
        const sp = Math.min(1, s._c.dur > 0 ? lt / s._c.dur : 1); onUpdate(s, sp, Math.min(lt, s._c.dur));
      } break;
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
        let ix = S2.list.length - 1;
        for (let k = 0; k < S2.list.length; k++) { const s = S2.list[k]; if (tt < s.t0 + s.d) { sg = s; ix = k; break; } }
        if (!sg) break;
        const q = Math.max(0, Math.min(1, (tt - sg.t0) / sg.d));
        const [ax, ay, az] = sg.a, [bx, by, bz] = sg.b;
        if (ax === bx && ay === by) { d.x = bx; d.y = by; d.z = lerp(az, bz, q * q); if (bz < az - 6) d.alpha = 1 - q; }
        else if (bz < az) {
          const qh = Math.min(1, q / 0.4);
          d.x = lerp(ax, bx, qh); d.y = lerp(ay, by, qh);
          d.z = q < 0.4 ? az : lerp(az, bz, ((q - 0.4) / 0.6) ** 2);
        } else { d.x = lerp(ax, bx, q); d.y = lerp(ay, by, q); d.z = az; }
        if (e.roll) d.roll = (d.roll || 0) + 0.25;
        // 大岩が橋板の上を転がると、板が鳴る
        if (e.roll && sg !== e._lastSeg) { e._lastSeg = sg; if (S.inside(G.vs, bx, by) && G.vs.t[S.idx(G.vs, bx, by)] === 'p') A.sfx('thunk'); }
        for (let k = 0; k < ix; k++) {
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
        if (['hp', 'push', 'arrow', 'arrowHigh', 'frost', 'bump', 'fall', 'crush', 'rock', 'blast', 'drop', 'away'].includes(e.how)) {
          const u = U(e.id); if (u && u.team === 'e') { const d = dispOf(e.id); d.alpha = 1 - p; d.flash = 1 - p; }
        }
        if (e.how === 'drown') { const d = dispOf(e.id); d.z = (d.z0 === undefined ? (d.z0 = d.z) : d.z0) - p * 1.2; d.alpha = 1 - p; }
        break;
      }
      case 'flee': case 'steal': { const d = dispOf(e.id); d.alpha = 1 - p; d.z = (d.z0 === undefined ? (d.z0 = d.z) : d.z0) + p * 0.8; break; }
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
      case 'shatter': { const d = G.odisp[e.o] || (G.odisp[e.o] = Object.assign({}, O(e.o))); d.hide = p > 0.15; break; }
      case 'lower': R.bridgeProg = R.bridgeProg || {}; R.bridgeProg[e.o] = ease(p); { const o = O(e.o); if (o) o.down = true; } break;
      case 'open': { const d = G.odisp[e.o] || (G.odisp[e.o] = Object.assign({}, O(e.o))); d.lift = 22 * ease(p); break; }
      case 'freezeCells': {
        const st = G.vs;
        for (const [x, y] of e.cells) {
          const k = x + ',' + y;
          const dd = Math.hypot(x - (e.cx === undefined ? x : e.cx), y - (e.cy === undefined ? y : e.cy));
          if (!e._done[k] && p >= dd * 0.28) {
            e._done[k] = 1;
            const i = S.idx(st, x, y); st.t[i] = 'i'; st.by[i] = e.by || 'sena';
            burst(x, y, st.h[i] + 0.2, 5, '#dff8ff', 1.2);
            if (Object.keys(e._done).length % 2) A.sfx('crack');
          }
        }
        break;
      }
      case 'freezeFall': { const o = O(e.o); if (o && p > 0.3 && !o.frozen) { o.frozen = true; burst(o.bx, o.by, o.bz + 2, 20, '#dff8ff', 2.2); } break; }
      case 'crystal': { const o = O(e.o); if (o && p > 0.4) o.lit = true; break; }
      case 'icicle': { const d = G.odisp[e.o] || (G.odisp[e.o] = Object.assign({}, O(e.o))); d.x = e.x; d.y = e.y; d.z = lerp(e.z0, e.z1, p * p) - (S.ICICLE_Z || 3); break; }
      case 'waft': {
        // 弧を描いて、ふわりと下りる（押す・発破の重い手ごたえとの対比。m8 の9章）
        const key = e.ref.u || e.ref.o;
        const d = e.ref.u ? dispOf(key) : (G.odisp[key] || (G.odisp[key] = Object.assign({}, O(key))));
        const q = p < 0.85 ? p / 0.85 : 1;
        const qq = q * q * (3 - 2 * q);
        d.x = lerp(e.from[0], e.to[0], qq); d.y = lerp(e.from[1], e.to[1], qq);
        const low = Math.max(e.to[2], -14);
        d.z = lerp(e.from[2], low, q) + Math.sin(Math.min(1, q) * Math.PI) * (e.arc || 1.4);
        if (e.ref.u) d.pose = 'walk1';
        if (Math.random() < 0.5) G.fx.push({ k: 'p', x: d.x, y: d.y, z: d.z + 0.4, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, vz: -0.3, g: 0, t: 0, life: 0.35, col: '#f4f8ff', sz: 1 });
        break;
      }
      case 'lever': { const d = G.odisp[e.o] || (G.odisp[e.o] = Object.assign({}, O(e.o))); d.leverOn = p > 0.5; break; }
      case 'eatk': {
        if (!e.ranged) {
          const d = dispOf(e.id);
          const k = Math.sin(Math.min(1, p * 1.4) * Math.PI) * 0.35;
          d.x = e.from[0] + (e.to[0] - e.from[0]) * k; d.y = e.from[1] + (e.to[1] - e.from[1]) * k; d.z = e.from[2] + (e.slam ? Math.sin(p * Math.PI) * 0.8 : 0);
          d.pose = 'act'; d.sd = R.sdir(S.faceTo(e.from[0], e.from[1], e.to[0], e.to[1], 0));
        }
        break;
      }
    }
  }

  function onFinish(e) {
    switch (e.k) {
      case 'group': for (const s of e.evs) { if (!s._started) { s._started = true; onStart(s, s._c || { t: 0, dur: evDur(s) }); } onFinish(s); } break;
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
        if (e.ref.u) delete G.disp[key]; else delete G.odisp[key];
        if (last[2] < -20 || (e.path.length >= 2 && last[2] < e.path[e.path.length - 2][2] - 6)) { if (ent) ent.gone = true; }
        break;
      }
      case 'fall': { const key = e.ref.u || e.ref.o; const ent = e.ref.u ? U(key) : O(key); if (ent) ent.z = e.to[2]; land(e.to[0], e.to[1], e.to[2], e.drop || 1); if (e.ref.u) delete G.disp[key]; else delete G.odisp[key]; break; }
      case 'bump': { const key = e.ref.u || e.ref.o; if (e.ref.u) delete G.disp[key]; else delete G.odisp[key]; break; }
      case 'dmg': { const u = U(e.id); if (u) u.hp = e.hp; const d = G.disp[e.id]; if (d) d.flash = 0; break; }
      case 'ko': { const u = U(e.id); if (u) { u.ko = true; if (u.team === 'e' || e.how === 'void' || e.how === 'drown') u.gone = true; } delete G.disp[e.id]; break; }
      case 'flee': case 'steal': { const u = U(e.id); if (u) { u.ko = true; u.gone = true; } delete G.disp[e.id]; break; }
      case 'sink': { const o = O(e.ref.o); if (o) o.gone = true; const i = S.idx(G.vs, e.x, e.y); G.vs.t[i] = e.t; delete G.odisp[e.ref.o]; break; }
      case 'lost': { const key = e.ref.u || e.ref.o; const ent = e.ref.u ? U(key) : O(key); if (ent) ent.gone = true; break; }
      case 'break': { const o = O(e.ref.o); if (o) o.gone = true; delete G.odisp[e.ref.o]; break; }
      case 'shatter': { const o = O(e.o); if (o) o.gone = true; delete G.odisp[e.o]; if (e.rb) G.vs.objs.push(S.clone(e.rb)); break; }
      case 'topple': {
        const o = O(e.o); if (o) o.gone = true; delete G.odisp[e.o];
        for (const b of e.beams) G.vs.objs.push(S.clone(b));
        for (const b of e.beams) burst(b.x, b.y, b.z + 0.5, 8, '#b6b2c4', 2);
        G.shake = Math.max(G.shake, 0.4); G.topple = null;
        break;
      }
      case 'iceblock': G.vs.objs.push(S.clone(e.o)); break;
      case 'freezeCells': { for (const [x, y] of e.cells) { const i = S.idx(G.vs, x, y); G.vs.t[i] = 'i'; G.vs.by[i] = e.by || 'sena'; } break; }
      case 'waft': {
        const key = e.ref.u || e.ref.o;
        const ent = e.ref.u ? U(key) : O(key);
        if (ent && e.to[2] > -10) { ent.x = e.to[0]; ent.y = e.to[1]; ent.z = e.to[2]; }
        if (e.to[2] > -10 && e.land !== 'sink' && e.land !== 'drown' && e.land !== 'hit') { burst(e.to[0], e.to[1], e.to[2] + 0.1, 8, '#e8f0ff', 1.2, true); A.sfx('thud', { big: 1 }); }
        if (e.ref.u) delete G.disp[key]; else if (!['lost', 'sink', 'hit'].includes(e.land)) delete G.odisp[key];
        break;
      }
      case 'chime': { const o = O(e.o); if (o) o.rung = true; break; }
      case 'icicle': { const o = O(e.o); if (o) o.gone = true; delete G.odisp[e.o]; A.sfx('icefall'); burst(e.x, e.y, e.z1 + 0.2, 18, '#dff8ff', 2.4); G.shake = Math.max(G.shake, 0.22); break; }
      case 'lever': { const o = O(e.o); if (o) o.done = true; delete G.odisp[e.o]; break; }
      case 'snowClear': for (const [x, y] of e.cells) G.vs.t[S.idx(G.vs, x, y)] = 'd'; break;
      case 'freezeFall': { const o = O(e.o); if (o) o.frozen = true; G.vs.links.push(e.link); for (const [x, y] of e.cells) { const i = S.idx(G.vs, x, y); G.vs.t[i] = 'i'; } break; }
      case 'crystal': { const o = O(e.o); if (o) o.lit = true; break; }
      case 'target': { const o = O(e.o); if (o) o.hit = true; break; }
      case 'lower': { const o = O(e.o); if (o) o.down = true; if (R.bridgeProg) delete R.bridgeProg[e.o]; G.shake = Math.max(G.shake, 0.2); for (const c of (o ? o.cells : [])) burst(c[0], c[1], o.z, 4, '#a07850', 1.2); A.sfx('thud', { big: 1 }); break; }
      case 'open': { const o = O(e.o); if (o) o.open = true; delete G.odisp[e.o]; break; }
      case 'plate': { const o = O(e.o); if (o) o.done = true; break; }
      case 'collect': { const o = O(e.o); if (o) o.open = true; break; }
      case 'flip': { const u = U(e.id); if (u) u.flipped = e.left || 2; break; }
      case 'flipUp': { const u = U(e.id); if (u) u.flipped = 0; break; }
      case 'safe': { const u = U(e.id); if (u) u.safe = true; break; }
      case 'combat': G.vs.mode = 'combat'; break;
      case 'win': G.vs.mode = 'explore'; break;
      case 'lose': G.loseMenu = true; break;
      case 'drain': for (const [x, y, z] of e.cells) { const i = S.idx(G.vs, x, y); G.vs.t[i] = 'd'; G.vs.h[i] = z; } break;
      case 'linkShow': { const L = G.vs.links.find(l => l.id === e.id); if (L) L.hidden = false; break; }
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
    const far = e.poi.map(id => S.objById(st, id)).filter(o => o && (o.k === 'chest' || o.k === 'anchor' || o.k === 'crystal'))[0];
    if (far) G.camLook = { x: far.x, y: far.y, z: (S.surface(st, far.x, far.y).z || 0), t: 0, life: 1.3 };
  }

  function onIdle() {
    if (G.scene === 'guild') { if (window.HUB21) window.HUB21.idle(); return; }
    G.vs = S.clone(G.st);
    G.disp = {}; G.odisp = {}; G.camFocusOverride = null; G.ff = false;
    if (R.bridgeProg) R.bridgeProg = {};
    const st = G.st;
    if (st.mode === 'combat') {
      if (!G.combatEntry || G.combatStarted !== G.st.stats.fights) { G.combatEntry = S.clone(G.entryBeforeFight || st); G.combatStarted = G.st.stats.fights; }
      const u = S.unitById(st, G.sel);
      if (!u || u.ko || u.acted || u.team !== 'h') {
        const nx = S.heroes(st).find(h => !h.ko && !h.acted);
        if (nx) G.sel = nx.id;
      }
      if (!G.phaseStart || G.phaseStart.turn !== st.turn) { G.phaseStart = S.clone(st); G.undo = []; }
    } else {
      G.phaseStart = null;
      const u = S.unitById(st, G.sel); if (!u || u.team !== 'h') G.sel = 'riko';
    }
    refresh();
    checkStamps();
    save();
  }
  // 腕だめしの印：条件を満たしたら、地図の上で小さく知らせる（判定そのものは、ギルドへ帰ったとき）
  function checkStamps() {
    if (G.scene !== 'play' || !G.prof || !G.req) return;
    G.stampSeen = G.stampSeen || [];
    for (const s of C.stampLive(G.prof, G.req, G.st)) {
      if (G.stampSeen.includes(s.id)) continue;
      G.stampSeen.push(s.id);
      G.stampNotes = G.stampNotes || [];
      G.stampNotes.push({ text: '◆ 腕だめし：' + s.name, sub: '依頼を達成して帰ると、印がつく', t: 0 });
      A.sfx('ding');
    }
  }

  // 選択や状態がかわったら、表示用の情報をつくりなおす
  function refresh() {
    const st = G.st;
    if (G.scene !== 'play') return;
    G.intents = st.mode === 'combat' ? S.intents(st) : [];
    G.reachTint = null;
    const u = S.unitById(st, G.sel);
    if (st.mode === 'combat' && u && !u.ko && !u.acted && u.mv > 0) {
      const m = S.reach(st, u, { max: u.mv, linkCost: 2 });
      G.reachTint = {};
      for (const [i] of m) { const x = i % st.W, y = (i / st.W) | 0; if (!S.unitAt(st, x, y, u)) G.reachTint[i] = 1; }
    }
    // トビを選んでいるとき、発破の効く升
    G.blastTint = null;
    if (u && S.can(st, u.id, 'blast') && !(st.mode === 'combat' && u.acted)) {
      G.blastTint = {};
      // 立てる升を一度だけ求め、そこから届く升を調べる（升ごとに道を探さない）
      const combat = st.mode === 'combat';
      const dist = S.reach(st, u, { max: u.fixed ? 0 : combat ? u.mv : 999, ignoreUnits: !combat, linkCost: combat ? 2 : 1 });
      const stands = [];
      for (const i of dist.keys()) {
        const x = i % st.W, y = (i / st.W) | 0;
        if (combat && S.unitAt(st, x, y, u)) continue;
        if (!S.surface(st, x, y).stand) continue;
        stands.push([x, y]);
      }
      for (let y = 0; y < st.H; y++) for (let x = 0; x < st.W; x++) {
        if (!blastClickable(st, x, y)) continue;
        if (stands.some(([sx, sy]) => S.inRange(sx, sy, x, y, S.RANGE.blast + (u.rangeUp || 0)) && (Math.abs(sx - x) > 1 || Math.abs(sy - y) > 1))) G.blastTint[S.idx(st, x, y)] = 1;
      }
    }
    G.hv = null;
    computeHover();
  }
  // 床の升を押したとき、歩くかわりに発破にする升（敵や仕掛けのとなり）
  function blastClickable(st, x, y) {
    const b = S.blastSet(st, x, y);
    if (!b.any) return false;
    if (st.mode === 'combat') return true;
    return b.cracks.length > 0 || b.push.some(q => q.ref.o);
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
    if (G.scene === 'guild' && window.HUB21) window.HUB21.hover();
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
    if (k === ' ' || k === 'Tab') ev.preventDefault();
    if (G.scene === 'title') { if (k === 'Enter' || k === ' ') { const b = G.buttons.find(b => b.key === 'cont') || G.buttons.find(b => b.key === 'new'); if (b) b.fn(); } return; }
    if (G.scene === 'story') { if (k === 'Enter' || k === ' ' || k === 'Escape') storyNext(k === 'Escape'); return; }
    if (G.scene === 'guild') { if (window.HUB21) window.HUB21.key(k, ev); return; }
    if (G.scene !== 'play') return;
    if (G.help) { if (k === 'Escape' || k === 'Enter' || k === ' ' || k === '?') G.help = false; return; }
    if (G.menu) { if (k === 'Escape') G.menu = false; return; }
    if (k === 'Escape') { G.menu = true; return; }
    if (k === 'm' || k === 'M') { toggleSound(); return; }
    if (G.loseMenu || G.trans) return;
    if ((k === ' ' || k === 'Enter') && G.camLook && G.camLook.intro) { G.camLook = null; G.camLooks = []; return; }
    const ids = partyIds();
    const num = '1234'.indexOf(k);
    if (G.busy) {
      if (k === ' ' || k === 'Enter') G.ff = true;
      else if (num >= 0 && ids[num]) G.sel = ids[num];
      return;
    }
    if (num >= 0 && ids[num]) selectHero(ids[num]);
    else if (k === 'Tab') cycleHero();
    else if (k === 'z' || k === 'Z' || k === 'Backspace') undo();
    else if (k === 'q' || k === 'Q') rotate(-1);
    else if (k === 'e' || k === 'E') rotate(1);
    else if (k === 'h' || k === 'H') hint();
    else if (k === '?') G.help = true;
    else if (k === ' ' || k === 'Enter') { if (G.st.mode === 'combat' && G.t - (G.introEndT || -9) > 0.6) endTurn(); }
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
    if (G.scene === 'guild') { if (window.HUB21) window.HUB21.click(x, y); return; }
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
  function overBubble(x, y) {
    const br = G.bubbleRect;
    return !!(br && G.bubbles.length && G.bubbles[0].t > 0.35 && x >= br.x && y >= br.y && x < br.x + br.w && y < br.y + br.h);
  }
  function rightClick() {
    if (G.scene === 'guild') { if (window.HUB21) window.HUB21.back(); return; }
    if (G.scene !== 'play') return;
    if (G.menu) { G.menu = false; return; }
    if (G.help) { G.help = false; return; }
    if (G.busy) return;
    undo();
  }
  function selectHero(id) {
    const u = S.unitById(G.st, id);
    if (!u || u.team !== 'h') return;
    if (G.sel !== id) { G.sel = id; A.sfx('select', { f: { riko: 660, gard: 440, sena: 880, tobi: 550 }[u.k] || 600 }); }
    G.camOff = [0, 0];
    refresh();
  }
  function cycleHero() {
    const ids = partyIds().filter(id => { const u = S.unitById(G.st, id); return u && !u.ko && !(G.st.mode === 'combat' && u.acted); });
    if (!ids.length) return;
    const k = ids.indexOf(G.sel);
    selectHero(ids[(k + 1) % ids.length]);
  }
  function rotate(d) {
    R.rot = (R.rot + d + 4) % 4;
    A.sfx('click');
    G.rotT = 0.25;
    boxCache = null;
    snapCam();
    refresh();
  }
  function toggleSound() { G.opt.on = !G.opt.on; A.setOn(G.opt.on); saveOpt(); }

  function pushUndo() {
    G.undo.push(S.clone(G.st));
    if (G.undo.length > 60) G.undo.shift();
  }
  // 戻す・やり直しても、ヒント・戻す・やり直しの回数は減らない（成績と「ヒントを使わずに」の印のため）
  function keepMeta(from, to) {
    if (!from || !to) return to;
    for (const k of ['hints', 'undo', 'retries']) to.stats[k] = Math.max(to.stats[k] || 0, from.stats[k] || 0);
    return to;
  }
  function undo() {
    if (G.busy || !G.undo.length) { A.sfx('deny'); return; }
    G.st = keepMeta(G.st, G.undo.pop());
    G.st.stats.undo++;
    G.vs = S.clone(G.st);
    G.disp = {}; G.odisp = {}; G.bloom = null; G.poi = [];
    G.cleared = !!G.st.flags.cleared;
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
    G.st = keepMeta(G.st, S.clone(G.combatEntry));
    G.st.stats.retries++;
    G.loseMenu = false; G.banner = null;
    enterPlay();
    A.bgm(G.st.mode === 'combat' ? 'combat' : (G.sec.music || 'field'));
    if (G.st.mode === 'combat') { G.phaseStart = S.clone(G.st); }
    save();
  }
  function retryPhase() {
    if (!G.phaseStart) return retryFight();
    G.st = keepMeta(G.st, S.clone(G.phaseStart));
    G.st.stats.retries++;
    G.loseMenu = false; G.banner = null;
    enterPlay();
    A.bgm(G.sec.music === 'boss' ? 'boss' : 'combat');
    save();
  }
  function restartMission() {
    const party = G.st.party.slice(1);
    G.menu = false; G.loseMenu = false;
    startMission(G.req, party);
  }
  function hint() {
    const st = G.st;
    const def = G.sec;
    st.stats.hints++;
    if (st.mode === 'combat') {
      // トビは、石切り場ではゲスト（tb）、仲間になってからは tobi。どちらで書いたヒントも、いるほうが話す（v0.1 では、仲間のトビのヒントが出なかった）
      const whoOf = (w) => (w === 'tb' || w === 'tobi') ? (S.unitById(st, 'tobi') ? 'tobi' : S.unitById(st, 'tb') ? 'tb' : null) : (S.unitById(st, w) ? w : null);
      const ch = (def.combatHint || [['gard', '敵を崖や水のそばへ押しだせば、一押しで片がつく。赤い線の先にいる仲間を守ろう']]).filter(h => whoOf(h[0]));
      if (!ch.length) { say('riko', '赤い線は敵の次の動き。崖や水のそばの敵は、押しだせば一撃だよ'); return; }
      const k = (G.hintIdx++) % ch.length;
      say(whoOf(ch[k][0]), ch[k][1]);
      return;
    }
    const pr = S.partyReach(st);
    const O = S.objective(st);
    for (const h0 of def.hints || []) {
      let h = h0;
      // その力を持つ仲間がいなければ、別の手（alt）か、次のヒントへ
      let who = h.need ? S.heroWith(st, h.need) : 'riko';
      if (h.need && !who && h.alt) {
        // 別の手は一つか、いる仲間の順に並べた配列（v0.3）
        const alts = Array.isArray(h0.alt) ? h0.alt : [h0.alt];
        const a = alts.find(q => S.heroWith(st, q.need)) || alts[alts.length - 1];
        h = Object.assign({}, h0, a); who = S.heroWith(st, h.need);
      }
      if (h.show && !h.show(st)) continue;
      if (h.need && !who) continue;
      if (h.flag && st.flags[h.flag]) continue;
      if (h.item && st.items.includes(h.item)) continue;
      if (h.found) { const n = S.unitById(st, h.found); if (n && n.found) continue; }
      if (h.safe) { const n = S.unitById(st, h.safe); if (n && n.safe) continue; }
      if (h.done) { const i = S.idx(st, h.done[0], h.done[1]); if (pr.has(i)) continue; }
      let text = h.text;
      if (h.o) {
        const o = S.objById(st, h.o), o0 = G.entry && S.objById(G.entry, h.o);
        if (o && o0 && (o.gone || o.x !== o0.x || o.y !== o0.y || o.z !== o0.z)) text = h.wrong || (h.text + '（うまくいかなければ Z で戻せる）');
      }
      G.bubbles = G.bubbles.filter(b => b.text !== text);
      say(who, text);
      // 別の手（v0.3）：その力を持つ仲間がいれば、ひとことずつ添える
      for (const a of h.also || []) { const w2 = S.heroWith(st, a.need); if (w2 && w2 !== who) { G.bubbles = G.bubbles.filter(b => b.text !== a.text); say(w2, a.text); } }
      if (S.unitById(st, who) && S.unitById(st, who).team === 'h') selectHero(who);
      hintMark(h.mark || h.o || h.done);
      return;
    }
    if (O.done) { say('riko', '依頼は達成！ 右上の「ギルドへ帰る」で帰れるよ'); return; }
    if (st.obj.k === 'rescue') {
      const n = S.rescuees(st).find(u => !u.safe);
      if (n) { say('riko', n.found ? (n.name || '') + 'さんが荷馬車まで歩ける道をつくろう。縄は渡れないんだって' : 'まだ見つけていない人がいる。声のするほうへ！'); hintMark([n.x, n.y]); return; }
    }
    say('riko', 'もう少し、まわりを見てみよう。だれかの力で、道がひらけるかも');
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
    if (G.scene !== 'play' || !G.st || G.busy || G.menu || G.help || G.loseMenu || G.trans) return;
    const [mx, my] = G.mouse;
    if (hitButton(mx, my) || inUI(mx, my)) return;
    if (overBubble(mx, my)) return;
    if (G.camLook && G.camLook.intro) return;
    const lxp = mx / 2, lyp = my / 2;
    const st = G.st;
    const hv = { cell: null, unit: null, obj: null };
    hv.cell = R.pick(st, lxp, lyp);
    for (let k = (R.objRects || []).length - 1; k >= 0; k--) {
      const r = R.objRects[k];
      if (lxp >= r.x && lxp < r.x + r.w && lyp >= r.y && lyp < r.y + r.h) { const o = S.objById(st, r.id); if (o && !o.gone) { hv.objPick = o; break; } }
    }
    for (let k = R.unitRects.length - 1; k >= 0; k--) {
      const r = R.unitRects[k];
      if (!(lxp >= r.x && lxp < r.x + r.w && lyp >= r.y && lyp < r.y + r.h)) continue;
      const u = S.unitById(st, r.id);
      if (!u || u.ko || u.gone) continue;
      // ナギを選んでいるときは、ほかの仲間の絵を指せば、その仲間（あおぐ相手）を先に選ぶ（v0.3）
      const waftee = u.team === 'h' && u.id !== G.sel && S.can(st, G.sel, 'waft');
      if (u.team !== 'e' && !u.fixed && u.team !== 'n' && hv.cell && !(hv.cell[0] === u.x && hv.cell[1] === u.y) && !waftee) {
        const sf = S.surface(st, hv.cell[0], hv.cell[1]);
        const behindUseful = sf.stand || sf.water || st.objs.some(o => !o.gone && o.x === hv.cell[0] && o.y === hv.cell[1]);
        if (behindUseful) continue;
      }
      hv.unit = u; break;
    }
    for (const o of st.objs) {
      if (o.k !== 'fall' || o.gone) continue;
      const [x0, y0] = R.proj(st, o.x, o.y, st.h[S.idx(st, o.x, o.y)]);
      const [x1, y1] = R.proj(st, o.bx, o.by, o.bz);
      const mxx = (x0 + x1) / 2;
      if (Math.abs(lxp - mxx) < 12 && lyp > Math.min(y0, y1) - 4 && lyp < y1 + 6 && !hv.unit) { hv.obj = o; }
    }
    if (hv.objPick && (!(hv.unit && hv.unit.team === 'e') || hv.objPick.k === 'icicle')) { hv.obj = hv.objPick; hv.unit = null; }
    if (!hv.unit && !hv.obj && hv.cell) {
      const [x, y] = hv.cell;
      const objs = st.objs.filter(o => !o.gone && o.x === x && o.y === y && ['crate', 'block', 'iceblock', 'boulder', 'pillar', 'anchor', 'target', 'chest', 'crack', 'crystal', 'lever', 'chime'].includes(o.k));
      if (objs.length) objs.sort((a, b) => (b.z || 0) - (a.z || 0)), hv.obj = objs[0];
      const u = S.unitAt(st, x, y);
      if (u && !hv.obj) hv.unit = u;
    }
    deriveIntent(hv);
    // トビ：甲羅ではじかれるだけの敵の絵が別の升にかかっていたら、その升での発破にする（大亀の奥の升をねらえるように）
    if (hv.unit && hv.unit.team === 'e' && hv.cell && (hv.cell[0] !== hv.unit.x || hv.cell[1] !== hv.unit.y) && G.blastTint && G.blastTint[S.idx(st, hv.cell[0], hv.cell[1])] && hv.pv && hv.pv.evs.some(e => e.k === 'clang') && !hv.pv.flips.length) {
      const hv2 = { cell: hv.cell, unit: null, obj: null };
      deriveIntent(hv2);
      if (hv2.plan && hv2.plan.ok) { G.hv = hv2; return; }
    }
    // 働きかけられない物・敵の絵が、下の升にかかっているときは、その升を押したことにする
    const ent = hv.obj || (hv.unit && hv.unit.team === 'e' ? hv.unit : null);
    if (ent && hv.cell && (hv.cell[0] !== ent.x || hv.cell[1] !== ent.y) && !(hv.plan && hv.plan.ok) && !(hv.intent && hv.intent.k === 'select')) {
      const hv2 = { cell: hv.cell, unit: null, obj: null };
      const u2 = S.unitAt(st, hv.cell[0], hv.cell[1]);
      if (!u2) {
        deriveIntent(hv2);
        if (hv2.plan && hv2.plan.ok) { hv2.behind = ent; G.hv = hv2; return; }
      }
    }
    G.hv = hv;
  }
  function inUI(x, y) {
    const n = partyIds().length;
    if (y > 616 && x < (n >= 4 ? 676 : 640)) return true;
    if (y > 566 && y < 612 && x < 270 && G.st && ((G.st.up.staff && S.can(G.st, G.sel, 'freeze')) || (G.st.mode === 'combat' && S.can(G.st, G.sel, 'pull')))) return true;
    if (y < 64 && x > 700) return true;
    if (G.st && G.st.mode === 'combat' && x > 1040 && y > 600) return true;
    return false;
  }
  function quadDir(st, ent, lxp, lyp) {
    const [sx, sy] = R.proj(st, ent.x, ent.y, ent.z || 0);
    const mid = ent.k === 'pillar' ? 14 : (ent.k === 'turtle' ? 10 : 6); // 背の高い物は、中ほどを中心に
    const dx = lxp - sx, dy = lyp - (sy - mid);
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
  // 物の、マウスを寄せた側の升で発破する計画（吹き飛ぶ向き＝寄せた側の反対）。届かなければ、ほかの側をためす
  function blastPushPlan(st, actor, ent, hv) {
    const want = quadDir(st, ent, G.mouse[0] / 2, G.mouse[1] / 2);
    const tryDir = (d) => { const [dx, dy] = S.DIRS[d]; const x = ent.x - dx, y = ent.y - dy; if (!S.inside(st, x, y)) return null; const b = S.blastSet(st, x, y); if (!b.push.some(q => q.ref.o === ent.id)) return null; const p = S.plan(st, actor, { k: 'blast', x, y }); return p.ok ? p : null; };
    const valid = [];
    for (let d = 0; d < 4; d++) if (tryDir(d)) valid.push(d);
    hv.pushValid = valid;
    if (!valid.length) return null;
    for (const d of [want, (want + 1) % 4, (want + 3) % 4, (want + 2) % 4]) if (valid.includes(d)) return tryDir(d);
    return null;
  }
  // 引き鉤：マウスを寄せた側（寄ってくる向き）を選ぶ。その向きで引けなければ、ほかの向きをためす（押すと同じ選び方）
  function pullPlan(st, actor, ref, ent, hv) {
    const want = quadDir(st, ent, G.mouse[0] / 2, G.mouse[1] / 2);
    const valid = [];
    for (let d = 0; d < 4; d++) { const q = S.plan(st, actor, { k: 'pull', ref, dir: d }); if (q.ok) valid.push(q); }
    hv.pushValid = valid.map(q => q.intent.dir);
    let p = valid.find(v => v.intent.dir === want);
    if (!p) for (const d of [(want + 1) % 4, (want + 3) % 4, (want + 2) % 4]) { p = valid.find(v => v.intent.dir === d); if (p) break; }
    return p || S.plan(st, actor, { k: 'pull', ref, dir: want });
  }
  // あおぐ：マウスを寄せた側（運ぶ向き）を選ぶ。その向きであおげなければ、ほかの向きをためす（押すと同じ選び方）
  function waftPlan(st, actor, ref, ent, hv) {
    const want = quadDir(st, ent, G.mouse[0] / 2, G.mouse[1] / 2);
    const valid = [];
    for (let d = 0; d < 4; d++) { const q = S.plan(st, actor, { k: 'waft', ref, dir: d }); if (q.ok) valid.push(q); }
    hv.pushValid = valid.map(q => q.intent.dir);
    let p = valid.find(v => v.intent.dir === want);
    if (!p) for (const d of [(want + 1) % 4, (want + 3) % 4, (want + 2) % 4]) { p = valid.find(v => v.intent.dir === d); if (p) break; }
    return p || S.plan(st, actor, { k: 'waft', ref, dir: want });
  }
  function NM(id) { return nameOf(id); }
  function deriveIntent(hv) {
    const st = G.st, combat = st.mode === 'combat';
    const selU = S.unitById(st, G.sel);
    let actor = G.sel;
    if (hv.unit && hv.unit.team === 'h') {
      // ナギを選んで、ほかの仲間を指したら「あおぐ」（運べるときだけ。選ぶときは札か Tab。v0.3）
      const tgt = hv.unit;
      if (tgt.id !== G.sel && selU && !selU.ko && S.can(st, G.sel, 'waft') && !(combat && selU.acted)) {
        const wp = waftPlan(st, G.sel, { u: tgt.id }, tgt, hv);
        if (wp && wp.ok) { hv.plan = wp; hv.actor = G.sel; hv.target = tgt; hv.waftAlly = true; finishPlan(hv); return; }
      }
      hv.intent = { k: 'select', id: hv.unit.id }; return;
    }
    if (hv.unit && hv.unit.team === 'n') {
      const n = hv.unit;
      hv.target = n;
      hv.why = (n.name || '') + (n.safe ? '：荷馬車に着いた' : !n.found ? '：まだ声をかけていない（となりへ行く）' : '：荷馬車まで歩ける道を待っている（縄は渡れない）');
      if (!n.found && !combat) { const p = S.plan(st, actor, { k: 'move', x: n.x, y: n.y }); void p; }
      return;
    }
    if (hv.unit && hv.unit.team === 'e') {
      const e = hv.unit;
      if (!combat) { hv.why = S.ENEMY[e.k].name + '（まだ気づいていない）'; hv.target = e; return; }
      if (!selU || selU.ko) return;
      if (selU.acted) { hv.why = NM(G.sel) + 'は行動ずみ（Tab で次の仲間）'; hv.target = e; return; }
      if (S.can(st, actor, 'push')) hv.plan = pushPlan(st, actor, { u: e.id }, e, hv);
      // リコ：ふだんは射る。「引く：入」（Shift）なら引き鉤で引く（05 2.2）
      else if (S.can(st, actor, 'pull') && (G.pullMode || G.keyShift)) hv.plan = pullPlan(st, actor, { u: e.id }, e, hv);
      else if (S.can(st, actor, 'waft')) hv.plan = waftPlan(st, actor, { u: e.id }, e, hv);
      else if (S.can(st, actor, 'shoot')) hv.plan = S.plan(st, actor, { k: 'shoot', ref: { u: e.id } });
      else if (S.can(st, actor, 'freeze')) hv.plan = S.plan(st, actor, { k: 'freeze', ref: { u: e.id } });
      else if (S.can(st, actor, 'blast')) hv.plan = S.plan(st, actor, { k: 'blast', x: e.x, y: e.y });
      hv.target = e;
      finishPlan(hv);
      return;
    }
    if (hv.obj && hv.obj.k === 'bridge') { hv.target = hv.obj; hv.why = '上がっている。下りれば、谷を渡れる'; return; }
    if (hv.obj) {
      const o = hv.obj;
      let need = null;
      if (['crate', 'block', 'iceblock', 'boulder', 'pillar'].includes(o.k)) need = 'push';
      else if (o.k === 'anchor') need = 'rope';
      else if (o.k === 'target' || o.k === 'icicle') need = 'shoot';
      else if (o.k === 'lever') need = 'pull';
      else if (o.k === 'chime') need = 'waft';
      else if (o.k === 'fall' || o.k === 'crystal') need = 'freeze';
      else if (o.k === 'crack') need = 'blast';
      // 引き鉤を持つリコを選んで、軽い物を指したら「引く」（探索中は切りかえなし。05 2.2）。引けなければ、押せる仲間へ
      if (S.PULLABLE.includes(o.k) && selU && !selU.ko && S.can(st, G.sel, 'pull') && !(combat && selU.acted)) {
        const pp = pullPlan(st, G.sel, { o: o.id }, o, hv);
        if (pp && pp.ok) { hv.plan = pp; hv.actor = G.sel; hv.target = o; finishPlan(hv); return; }
        // 押せる仲間もいなければ、引けない理由を出す
        if (!S.heroWith(st, 'push') && !S.can(st, G.sel, 'blast')) { hv.plan = pp; hv.actor = G.sel; hv.target = o; finishPlan(hv); return; }
      }
      // ナギを選んで、軽い物を指したら「あおぐ」。運べなければ、押せる仲間へ
      if (S.WAFTABLE.includes(o.k) && selU && !selU.ko && S.can(st, G.sel, 'waft') && !(combat && selU.acted)) {
        const wp = waftPlan(st, G.sel, { o: o.id }, o, hv);
        if (wp && wp.ok) { hv.plan = wp; hv.actor = G.sel; hv.target = o; finishPlan(hv); return; }
        // 押せる仲間もいなければ、あおげない理由を出す（「ガルドがいれば」ではなく）
        if (!S.heroWith(st, 'push')) { hv.plan = wp; hv.actor = G.sel; hv.target = o; finishPlan(hv); return; }
      }
      if (o.k === 'lever' && !S.heroWith(st, 'pull')) { hv.target = o; hv.why = o.done ? 'もう引いた' : '引き鉤があれば、引ける（いまは持っていない）'; return; }
      // 戦いの中でトビを選んで押せる物を指したら、マウスを寄せた側の升で発破して、反対へ吹き飛ばす（v0.2。押す向きの選び方と同じ）
      if (need === 'push' && combat && S.can(st, actor, 'blast') && o.k !== 'pillar' && selU && !selU.acted) {
        const bp = blastPushPlan(st, actor, o, hv);
        if (bp) { hv.plan = bp; hv.actor = actor; hv.target = o; hv.blastCell = [bp.intent.x, bp.intent.y]; finishPlan(hv); return; }
      }
      // 選んでいるのがトビで、押せる物を指しているなら「その場で発破」はしない（ふつうはガルド）
      if (need === 'push' && S.can(st, actor, 'blast') && !S.heroWith(st, 'push')) {
        hv.target = o; hv.why = '押せる仲間がいない。となりの升で発破すれば、吹き飛ばせる'; return;
      }
      if (need && !S.can(st, actor, need)) {
        const who = S.heroWith(st, need);
        if (!who) { hv.target = o; hv.why = needWho(need) + 'がいれば、働きかけられる（いまの編成にはいない）'; return; }
        if (combat) { const nu = S.unitById(st, who); if (nu && !nu.ko && !nu.acted) { hv.intent = { k: 'select', id: who }; hv.why = NM(who) + 'なら、これに働きかけられる（押すと選ぶ）'; } else hv.why = NM(who) + 'なら働きかけられる'; hv.target = o; return; }
        actor = who;
      }
      if (need === 'push') hv.plan = pushPlan(st, actor, { o: o.id }, o, hv);
      else if (o.k === 'anchor') hv.plan = S.plan(st, actor, { k: 'rope', o: o.id });
      else if (o.k === 'target') hv.plan = o.hit ? { ok: false, why: 'もう射ぬいた' } : S.plan(st, actor, { k: 'shoot', ref: { o: o.id } });
      else if (o.k === 'icicle') hv.plan = S.plan(st, actor, { k: 'shoot', ref: { o: o.id } });
      else if (o.k === 'lever') hv.plan = S.plan(st, actor, { k: 'pull', ref: { o: o.id } });
      else if (o.k === 'chime') hv.plan = o.rung ? { ok: false, why: 'もう鳴った' } : S.plan(st, actor, { k: 'waft', ref: { o: o.id } });
      else if (o.k === 'fall' || o.k === 'crystal') hv.plan = S.plan(st, actor, { k: 'freeze', ref: { o: o.id } });
      else if (o.k === 'crack') hv.plan = S.plan(st, actor, { k: 'blast', x: o.x, y: o.y });
      else if (o.k === 'chest') hv.plan = S.plan(st, actor, { k: 'move', x: o.x, y: o.y });
      hv.actor = actor; hv.target = o;
      finishPlan(hv);
      return;
    }
    if (hv.cell) {
      const [x, y] = hv.cell;
      const i = S.idx(st, x, y);
      // トビ：敵や仕掛けのとなりの升は、発破
      if (G.blastTint && G.blastTint[i] && S.can(st, actor, 'blast')) {
        hv.plan = S.plan(st, actor, { k: 'blast', x, y });
        hv.actor = actor; hv.blastCell = [x, y];
        finishPlan(hv);
        return;
      }
      if (st.t[i] === 'r') { hv.why = '流れの速い水。凍らせられない（重い物を沈めれば飛び石になる）'; return; }
      if (st.t[i] === 'w') {
        const sena = S.heroWith(st, 'freeze');
        if (!sena) { hv.why = '深い水。凍らせられる仲間がいない'; return; }
        if (combat && !S.can(st, actor, 'freeze')) { hv.why = '深い水。' + NM(sena) + 'なら凍らせられる'; const su = S.unitById(st, sena); if (su && !su.acted && !su.ko) hv.intent = { k: 'select', id: sena }; return; }
        actor = sena;
        hv.plan = S.plan(st, actor, { k: 'freeze', x, y });
        hv.freeze = S.freezeCells(st, x, y);
        hv.actor = actor;
        finishPlan(hv);
        return;
      }
      // 氷晶の杖：セナを選んで乾いた床 → 氷のかたまり
      if (S.can(st, actor, 'freeze') && st.up.staff && selU && !(combat && selU.acted)) {
        const sf = S.surface(st, x, y);
        if (sf.stand && !S.unitAt(st, x, y) && (G.keyShift || G.iceMode)) { hv.plan = S.plan(st, actor, { k: 'freeze', x, y }); hv.actor = actor; finishPlan(hv); return; }
      }
      if (combat && selU && selU.acted) { hv.why = NM(G.sel) + 'は行動ずみ（Tab で次の仲間）'; return; }
      hv.plan = S.plan(st, actor, { k: 'move', x, y });
      hv.actor = actor;
      if (!hv.plan.ok) hv.why = hv.plan.why;
      else if (combat) finishPlan(hv);
      else if (st.obj.k === 'rescue' || st.waves) finishPlan(hv);
    }
  }
  function needWho(v) { return { push: '押せる仲間（ガルド）', freeze: '凍らせられる仲間（セナ）', blast: '発破できる仲間（トビ）', rope: 'リコ', shoot: 'リコ', pull: '引き鉤を持つリコ', waft: 'あおげる仲間（ナギ）' }[v]; }
  const FUT = [['落ちていった', '落ちていく'], ['すべっていった', 'すべっていく'], ['沈んだ', '沈む'], ['倒れた', '倒れる'], ['ぶつかった', 'ぶつかる'], ['ぶつけた', 'ぶつける'],
    ['押しつぶした', '押しつぶす'], ['なぎ倒した', 'なぎ倒す'], ['押した', '押す'], ['射ぬいた', '射ぬく'], ['射た', '射る'], ['渡った', '渡る'], ['凍らせた', '凍らせる'],
    ['閉じこめた', '閉じこめる'], ['なった', 'なる'], ['凍った', '凍る'], ['落ちた', '落ちる'], ['のった', 'のる'], ['入れた', '入れる'], ['動いた', '動く'],
    ['開いた', '開く'], ['ひらいた', 'ひらく'], ['下りた', '下りる'], ['止まった', '止まる'], ['崩れた', '崩れる'], ['ひらけた', 'ひらける'], ['かかった', 'かかる'], ['ともった', 'ともる'],
    ['砕いた', '砕く'], ['吹き飛ばした', '吹き飛ばす'], ['倒した', '倒す'], ['ひっくり返った', 'ひっくり返る'], ['はじかれた', 'はじかれる'], ['刺さった', '刺さる'], ['命中した', '命中する'], ['つくった', 'つくる'], ['発破した', '発破する'], ['光った', '光る'],
    ['当たった', '当たる'], ['通った', '通る'], ['ふさいだ', 'ふさぐ'], ['引きよせた', '引きよせる'], ['残った', '残る'], ['砕けた', '砕ける'], ['引いた', '引く'], ['出た', '出る'],
    ['運んだ', '運ぶ'], ['飛ばした', '飛ばす'], ['越えた', '越える'], ['落とした', '落とす'], ['沈めた', '沈める'], ['鳴った', '鳴る'], ['流された', '流される'], ['飛び去った', '飛び去る'], ['すべりだした', 'すべりだす']];
  function fut(s) {
    let o = s.replace('（Z で戻せる）', '');
    for (const [a, b] of FUT) o = o.split(a + '。').join(b + '。').split(a + '（').join(b + '（').split(a + '、').join(b + '、').split(a + '！').join(b + '！').split(a + '）').join(b + '）');
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
    const introNow = !!(G.camLook && G.camLook.intro);
    if (G.introWas && !introNow) G.introEndT = G.t;
    G.introWas = introNow;
    G.t += dt;
    if (G.prof && (G.scene === 'play' || G.scene === 'guild') && !G.menu && !G.help) G.prof.time += dt;
    if (G.scene === 'play' || G.scene === 'guild') {
      stepAnim(dt);
      updateFx(dt);
      updateCam(dt);
      if (G.trans) {
        G.trans.t += dt;
        if (G.trans.t > 0.7 && !G.trans.loaded) {
          G.trans.loaded = true;
          if (G.trans.guild) {
            const res = G.trans.done ? C.complete(G.prof, G.req, G.st) : null;
            G.st = null; G.req = null;
            window.HUB21.enter(res);
            save();
          } else if (G.trans.mission) {
            startMission(G.trans.mission, G.trans.party);
          }
        }
        if (G.trans.t > 1.4) G.trans = null;
      }
    }
    if (G.scene === 'guild' && window.HUB21) window.HUB21.update(dt);
    if (G.scene === 'story' && G.story) G.story.t += dt;
    if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.life) G.banner = G.bannerQ && G.bannerQ.length ? G.bannerQ.shift() : null; }
    else if (G.bannerQ && G.bannerQ.length) G.banner = G.bannerQ.shift();
    if (G.bubbles.length && !G.narr.length && !(G.banner && !G.banner.small && G.banner.t < G.banner.life - 0.3)) {
      G.bubbles[0].t += dt;
      if (G.bubbles[0].t >= G.bubbles[0].life) G.bubbles.shift();
    }
    if (G.narr.length && !(G.banner && !G.banner.small && G.banner.t < G.banner.life - 0.3)) { G.narr[0].t += dt; if (G.narr[0].t >= G.narr[0].life) G.narr.shift(); }
    if (G.caption) G.caption.t += dt;
    if (G.caption2) { G.caption2.t += dt; if (G.caption2.t > 3) G.caption2 = null; }
    if (G.stampNotes && G.stampNotes.length) { G.stampNotes[0].t += dt; if (G.stampNotes[0].t > 3.4) G.stampNotes.shift(); }
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
    if (G.scene === 'guild' && window.HUB21) return window.HUB21.camTarget();
    const f = focusPoint();
    const [a, b] = R.rawProj(G.vs, f[0], f[1], f[2]);
    let cx = a + G.camOff[0], cy = b + G.camOff[1] - (G.camLook ? 10 : 8);
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
    if (!G.vs) return;
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
    if (G.scene === 'sheet') return drawSheet();
    if (G.scene === 'guild') { if (window.HUB21) window.HUB21.draw(); drawTrans(); return; }
    drawPlay();
  }
  function drawTrans() {
    if (G.trans) {
      const p = G.trans.t < 0.7 ? G.trans.t / 0.7 : Math.max(0, 1 - (G.trans.t - 0.7) / 0.7);
      ctx.fillStyle = `rgba(4,3,10,${p})`; ctx.fillRect(0, 0, 1280, 720);
    }
  }

  function buildTint() {
    const st = G.vs;
    const tint = {};
    if (G.reachTint && !G.busy) for (const i in G.reachTint) tint[i] = { c: '#7ab8ff', a: 0.22 };
    if (G.sel && S.can(G.st, G.sel, 'freeze') && !G.busy) for (let i = 0; i < st.t.length; i++) if (st.t[i] === 'w') tint[i] = { c: '#9af0ff', a: 0.16 + 0.08 * Math.sin(G.t * 3) };
    if (G.blastTint && !G.busy) for (const i in G.blastTint) tint[i] = { c: '#e0a0ff', a: 0.12 + 0.07 * Math.sin(G.t * 4) };
    if (G.hv && G.hv.freeze && G.hv.plan && G.hv.plan.ok) for (const [x, y] of G.hv.freeze) tint[S.idx(st, x, y)] = { c: '#dff8ff', a: 0.6 };
    if (G.hv && G.hv.plan && G.hv.plan.ok && G.hv.plan.intent.k === 'blast' && !G.busy) {
      const I = G.hv.plan.intent;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = I.x + dx, y = I.y + dy; if (S.inside(st, x, y)) tint[S.idx(st, x, y)] = { c: dx || dy ? '#ffb070' : '#ffe080', a: 0.5 }; }
    }
    if (G.st && G.st.raid && !G.busy) for (const c of G.st.raid.cells) tint[S.idx(st, c[0], c[1])] = { c: '#ffd070', a: 0.18 + 0.08 * Math.sin(G.t * 3) };
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
    const col = colorOf(G.sel);
    for (const o of st.objs) {
      if (o.gone) continue;
      if (S.can(st, G.sel, 'push') && ['crate', 'block', 'iceblock', 'boulder'].includes(o.k)) hi[o.id] = col;
      if (S.can(st, G.sel, 'push') && o.k === 'pillar' && st.up.gauntlet) hi[o.id] = col;
      if (S.can(st, G.sel, 'rope') && (o.k === 'anchor' || (o.k === 'target' && !o.hit))) hi[o.id] = col;
      if (S.can(st, G.sel, 'freeze') && o.k === 'crystal' && !o.lit) hi[o.id] = col;
      if (S.can(st, G.sel, 'blast') && o.k === 'crack') hi[o.id] = col;
    }
    if (G.hv && G.hv.target && G.hv.target.id && !G.hv.target.team) hi[G.hv.target.id] = '#ffffff';
    return hi;
  }

  function drawWorld(st, sec, extraView) {
    R.hi.objs = G.scene === 'play' ? highlights() : (extraView && extraView.hi) || {};
    const view = Object.assign({
      st, sec, disp: G.disp, odisp: G.odisp, tint: G.scene === 'play' ? buildTint() : {},
      focus: (() => { const u = S.unitById(st, G.sel); if (!u) return null; const d = G.disp[u.id] || u; return [d.x, d.y, d.z]; })(),
    }, extraView || {});
    const su = S.unitById(st, G.sel);
    if (su && !su.ko && G.scene === 'play') { const d = G.disp[su.id] || (G.disp[su.id] = { x: su.x, y: su.y, z: su.z, temp: true }); d.ring = colorOf(G.sel); }
    const shk = G.shake > 0 ? [Math.round((Math.random() - 0.5) * G.shake * 8), Math.round((Math.random() - 0.5) * G.shake * 6)] : [0, 0];
    R.cam.x += shk[0]; R.cam.y += shk[1];
    lx.save();
    R.draw(lx, view, G.t);
    if (su && G.disp[su.id] && G.disp[su.id].temp) delete G.disp[su.id]; else if (su && G.disp[su.id]) delete G.disp[su.id].ring;
    drawRopes(lx, st);
    if (G.topple) drawTopple(lx, st, G.topple.o, G.topple.p);
    if (G.scene === 'play') drawOverlay(lx, st);
    drawFxLow(lx, st);
    lightsOn(lx, st, G.disp, sec);
    if (R.drawWeather && G.scene === 'play') R.drawWeather(lx, sec, G.t);
    lx.restore();
    R.cam.x -= shk[0]; R.cam.y -= shk[1];
    ctx.drawImage(low, 0, 0, 1280, 720);
  }
  function drawPlay() {
    const st = G.vs;
    if (titleDirty) { R.resetCache(st); titleDirty = false; boxCache = null; }
    drawWorld(st, G.sec);
    drawUI(st);
    drawTrans();
    if (G.rotT) { ctx.fillStyle = `rgba(4,3,10,${G.rotT * 2})`; ctx.fillRect(0, 0, 1280, 720); }
  }

  function ropeZ(st, x, y) { const s = S.surface(st, x, y); return s.void ? 0 : s.z; }
  function drawRopes(c, st) {
    for (const L of st.links) {
      if (L.hidden || L.k !== 'rope') continue;
      const za = ropeZ(st, L.a[0], L.a[1]), zb = ropeZ(st, L.b[0], L.b[1]);
      const [x0, y0] = R.projF(st, L.a[0], L.a[1], za + 0.4);
      const [x1, y1] = R.projF(st, L.b[0], L.b[1], zb + 2.3);
      c.strokeStyle = '#d8b878'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x0, y0);
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + 8;
      c.quadraticCurveTo(mx, my, x1, y1); c.stroke();
      c.strokeStyle = 'rgba(80,50,20,0.6)';
      c.beginPath(); c.moveTo(x0, y0 + 1); c.quadraticCurveTo(mx, my + 1, x1, y1 + 1); c.stroke();
    }
  }
  function drawTopple(c, st, e, p) {
    const [dx, dy] = S.DIRS[e.dir];
    const hw = 0.33, H = 3;
    const a = p * Math.PI / 2;
    const pivot = [e.x + dx * hw, e.y + dy * hw, e.z];
    const corners = [];
    for (const ox of [-hw, hw]) for (const oy of [-hw, hw]) for (const oz of [0, H]) {
      let px = e.x + ox, py = e.y + oy, pz = e.z + oz;
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
    if (G.st.mode === 'combat' && !G.busy && !G.loseMenu) {
      for (const it of G.intents) {
        const e = S.unitById(G.st, it.id);
        if (!e || e.ko) continue;
        if (it.frozen || it.flipped) continue;
        const to = it.to || [e.x, e.y];
        if (it.to && (it.to[0] !== e.x || it.to[1] !== e.y)) {
          const [x0, y0] = R.projF(st, e.x, e.y, e.z + 0.3);
          const [x1, y1] = R.projF(st, to[0], to[1], S.surface(st, to[0], to[1]).z + 0.3);
          dashed(c, x0, y0, x1, y1, it.steal || it.raid ? 'rgba(255,200,90,0.7)' : 'rgba(255,120,100,0.55)', 2, 2);
          R.diamondLine(c, Math.round(x1), Math.round(y1), 8, it.steal ? 'rgba(255,210,90,0.95)' : 'rgba(255,120,100,0.7)');
        }
        const tgts = it.target ? [{ id: it.target }].concat(it.also || []) : [];
        for (const tg of tgts) {
          const h = S.unitById(G.st, tg.id);
          if (!h) continue;
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
    const col = colorOf(p.hero);
    if (p.path && p.path.length > 1) {
      for (let k = 1; k < p.path.length; k++) {
        const i = p.path[k], x = i % st.W, y = (i / st.W) | 0;
        const z = S.surface(st, x, y).z;
        const [sx, sy] = R.proj(st, x, y, z);
        c.fillStyle = col; c.fillRect(sx - 1, sy - 1, 3, 3);
        c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(sx - 1, sy + 2, 3, 1);
      }
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
    if ((I.k === 'push' || I.k === 'blast' || I.k === 'pull' || I.k === 'waft') && pv) {
      if (I.k === 'waft') {
        const wv = pv.evs.find(e => e.k === 'waft');
        const ent = I.ref.u ? S.unitById(st, I.ref.u) : S.objById(st, I.ref.o);
        if (ent && wv) {
          const [x0, y0] = R.projF(st, wv.from[0], wv.from[1], wv.from[2] + 0.6);
          const [x1, y1] = R.projF(st, wv.to[0], wv.to[1], Math.max(wv.to[2], -4) + 0.3);
          const [xm, ym] = R.projF(st, (wv.from[0] + wv.to[0]) / 2, (wv.from[1] + wv.to[1]) / 2, Math.max(wv.from[2], wv.to[2]) + (wv.arc || 1.4) * 1.6 + 0.6);
          c.strokeStyle = 'rgba(255,240,170,0.9)'; c.lineWidth = 1; c.setLineDash([2, 2]);
          c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(xm, ym, x1, y1); c.stroke(); c.setLineDash([]);
          for (const d of hv.pushValid || []) {
            if (d === I.dir) continue;
            const [ddx, ddy] = S.DIRS[d];
            const [a0, b0] = R.projF(st, ent.x + ddx * 0.4, ent.y + ddy * 0.4, (ent.z || 0) + 0.6);
            const [a1, b1] = R.projF(st, ent.x + ddx * 1.0, ent.y + ddy * 1.0, (ent.z || 0) + 0.6);
            c.globalAlpha = 0.8; arrow(c, a0, b0, a1, b1, '#f0ecff'); c.globalAlpha = 1;
          }
        }
      } else if (I.k === 'pull') {
        // 引き鉤：リコから相手への縄の線と、寄ってくる向き（v0.3）
        const ent = I.ref.u ? S.unitById(st, I.ref.u) : S.objById(st, I.ref.o);
        if (ent) {
          const [x0, y0] = R.projF(st, p.stand[0], p.stand[1], standZ + 1.5);
          const [x1, y1] = R.projF(st, ent.x, ent.y, (ent.z || 0) + (I.ref.u ? 1 : 0.8));
          dashed(c, x0, y0, x1, y1, col, 2, 2);
          c.fillStyle = col; c.fillRect(Math.round(x1) - 1, Math.round(y1) - 1, 3, 3);
          if (!p.lever) {
            for (const d of hv.pushValid || []) {
              if (d === p.pullDir) continue;
              const [ddx, ddy] = S.DIRS[d];
              const [a0, b0] = R.projF(st, ent.x + ddx * 0.4, ent.y + ddy * 0.4, (ent.z || 0) + 0.6);
              const [a1, b1] = R.projF(st, ent.x + ddx * 1.0, ent.y + ddy * 1.0, (ent.z || 0) + 0.6);
              c.globalAlpha = 0.8; arrow(c, a0, b0, a1, b1, '#f0ecff'); c.globalAlpha = 1;
            }
            const [ddx, ddy] = S.DIRS[p.pullDir];
            const pl = 0.08 * Math.sin(t * 6);
            const [a0, b0] = R.projF(st, ent.x + ddx * 0.2, ent.y + ddy * 0.2, (ent.z || 0) + 0.6);
            const [a1, b1] = R.projF(st, ent.x + ddx * (1.35 + pl), ent.y + ddy * (1.35 + pl), (ent.z || 0) + 0.6);
            arrow(c, a0, b0, a1, b1, col, true);
          }
        }
      } else if (I.k === 'push') {
        const ent = I.ref.u ? S.unitById(st, I.ref.u) : S.objById(st, I.ref.o);
        if (ent) {
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
          const [a1, b1] = R.projF(st, ent.x + ddx * (1.55 + pl), ent.y + ddy * (1.55 + pl), (ent.z || 0) + 0.6);
          arrow(c, a0, b0, a1, b1, col, true);
        }
      } else {
        // 発破：投げる弧と、爆風の向き
        const [x0, y0] = R.projF(st, p.stand[0], p.stand[1], standZ + 1.6);
        const [x1, y1] = R.projF(st, I.x, I.y, (p.tz || 0) + 0.4);
        c.strokeStyle = col; c.lineWidth = 1; c.setLineDash([3, 2]);
        c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 22, x1, y1); c.stroke(); c.setLineDash([]);
        for (let d = 0; d < 4; d++) {
          const [ddx, ddy] = S.DIRS[d];
          const nx = I.x + ddx, ny = I.y + ddy;
          if (!S.inside(st, nx, ny)) continue;
          const z = S.surface(st, nx, ny).z;
          const [a0, b0] = R.projF(st, nx - ddx * 0.2, ny - ddy * 0.2, z + 0.5);
          const [a1, b1] = R.projF(st, nx + ddx * 0.45, ny + ddy * 0.45, z + 0.5);
          c.globalAlpha = 0.55; arrow(c, a0, b0, a1, b1, '#ffb070'); c.globalAlpha = 1;
        }
      }
      // 動く物・敵のたどる道と、行き先の半透明の姿
      for (const key in pv.moves) {
        if (key === p.hero) continue;
        const sl = pv.evs.filter(e => e.k === 'slide' && (e.ref.u || e.ref.o) === key).pop();
        if (sl && sl.path.length > 2) {
          for (let k = 1; k < sl.path.length; k++) {
            const q = sl.path[k];
            if (q[2] < -6) continue;
            const [px, py] = R.proj(st, q[0], q[1], q[2] + 0.2);
            c.fillStyle = 'rgba(255,240,160,0.85)'; c.fillRect(px - 1, py - 1, 2, 2);
          }
        }
        const mv = pv.moves[key];
        const u = S.unitById(st, key), o = u ? null : S.objById(st, key);
        const ent = u || o;
        if (!ent || !mv || (mv[0] === ent.x && mv[1] === ent.y && mv[2] === ent.z)) continue;
        const [sx, sy] = R.proj(st, mv[0], mv[1], Math.max(mv[2], -6));
        c.globalAlpha = 0.5 + 0.2 * Math.sin(t * 6);
        if (o && mv[2] > -6) R.drawObj(c, st, o, t, Object.assign({}, o, { x: mv[0], y: mv[1], z: mv[2] }), true);
        else if (u && mv[2] > -6 && !pv.ko.includes(key)) R.drawUnit(c, st, u, { x: mv[0], y: mv[1], z: mv[2], alpha: 0.6 }, t);
        c.globalAlpha = 1;
        R.diamondLine(c, sx, sy, 14, 'rgba(255,240,160,0.9)');
      }
      for (const id of pv.ko) {
        const e = S.unitById(st, id);
        if (!e || e.team !== 'e') continue;
        const [ex, ey] = R.proj(st, e.x, e.y, e.z + 1.4);
        c.strokeStyle = '#ff5a4a'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(ex - 4, ey - 4); c.lineTo(ex + 4, ey + 4); c.moveTo(ex + 4, ey - 4); c.lineTo(ex - 4, ey + 4); c.stroke();
      }
    }
    if (I.k === 'shoot') {
      const tgt = I.ref.u ? S.unitById(st, I.ref.u) : S.objById(st, I.ref.o);
      if (tgt) {
        const ic = !I.ref.u && tgt.k === 'icicle';
        const [x0, y0] = R.projF(st, p.stand[0], p.stand[1], standZ + 1.6);
        const [x1, y1] = R.projF(st, tgt.x, tgt.y, (tgt.z || 0) + (I.ref.u ? 1 : ic ? (S.ICICLE_Z || 3) : 1.8));
        dashed(c, x0, y0, x1, y1, col, 3, 2);
        // つらら：落ちる升と、残る物（氷のかたまり・飛び石）を半透明で（v0.3）
        if (ic && pv) {
          const [sx, sy] = R.proj(st, tgt.x, tgt.y, S.surface(st, tgt.x, tgt.y).void ? 0 : (st.t[S.idx(st, tgt.x, tgt.y)] === 'w' ? st.h[S.idx(st, tgt.x, tgt.y)] : S.surface(st, tgt.x, tgt.y).z));
          const ib = pv.evs.find(e => e.k === 'iceblock');
          c.globalAlpha = 0.5 + 0.2 * Math.sin(t * 6);
          if (ib) R.drawObj(c, st, ib.o, t, ib.o, true);
          else if (pv.evs.some(e => e.k === 'freezeCells')) R.diamond(c, sx, sy + 2, 16, '#bfefff');
          c.globalAlpha = 1;
          R.diamondLine(c, sx, sy, 14, 'rgba(255,240,160,0.9)');
        }
      }
    }
    if (I.k === 'rope') {
      const a = S.objById(st, I.o);
      const [x0, y0] = R.projF(st, p.stand[0], p.stand[1], standZ + 1.5);
      const [x1, y1] = R.projF(st, a.x, a.y, S.surface(st, a.x, a.y).z + 2.4);
      c.strokeStyle = col; c.lineWidth = 1; c.setLineDash([3, 2]);
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 14, x1, y1); c.stroke(); c.setLineDash([]);
    }
    if (I.k === 'freeze' && (I.ref || p.make)) {
      let tx, ty, tz;
      if (p.make) { tx = I.x; ty = I.y; tz = standZ; }
      else { const tgt = I.ref.u ? S.unitById(st, I.ref.u) : null; const o = I.ref.o ? S.objById(st, I.ref.o) : null; tx = tgt ? tgt.x : o.k === 'crystal' ? o.x : o.bx; ty = tgt ? tgt.y : o.k === 'crystal' ? o.y : o.by; tz = tgt ? tgt.z + 1 : o.k === 'crystal' ? o.z + 1.5 : o.bz + 1; }
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
        const q = Math.max(0, p - 0.12);
        const [px, py] = R.projF(st, lerp(l.from[0], l.to[0], q), lerp(l.from[1], l.to[1], q), lerp(l.from[2] + 1.4, l.to[2] + 1, q) + Math.sin(q * Math.PI) * 1.2);
        c.strokeStyle = l.k === 'earrow' ? '#e8d8c0' : '#fff6d0'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(px, py); c.lineTo(sx, sy); c.stroke();
      }
      if (l.k === 'bomb') {
        // 火花を散らしながら弧を描く発破玉
        const x = lerp(l.from[0], l.to[0], p), y = lerp(l.from[1], l.to[1], p);
        const z = lerp(l.from[2] + 1.6, l.to[2] + 0.4, p) + Math.sin(p * Math.PI) * 2.6;
        const [sx, sy] = R.projF(st, x, y, z);
        c.fillStyle = '#2c2634'; c.beginPath(); c.arc(sx, sy, 2.5, 0, 6.3); c.fill();
        c.fillStyle = Math.sin(G.t * 40) > 0 ? '#ffd070' : '#ff7a2a'; c.fillRect((sx + 1) | 0, (sy - 4) | 0, 2, 2);
        if (Math.random() < 0.6) G.fx.push({ k: 'p', x, y, z: z + 0.3, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, vz: 0.5, g: 2, t: 0, life: 0.25, col: '#ffb050', sz: 1 });
      }
      if (l.k === 'hook') {
        // 引き鉤：鉤が飛んでいき、かかったら手もとへ（v0.3）
        const [x0, y0] = R.projF(st, l.from[0], l.from[1], l.from[2] + 1.5);
        const [x1, y1] = R.projF(st, l.to[0], l.to[1], l.to[2] + 0.4);
        const q = p < 0.6 ? p / 0.6 : 1;
        const ex = lerp(x0, x1, q), ey = lerp(y0, y1, q) - Math.sin(q * Math.PI) * 6;
        c.strokeStyle = '#c8b090'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(ex, ey); c.stroke();
        c.fillStyle = '#e8ecf4'; c.fillRect(ex - 2, ey - 1, 4, 3); c.fillStyle = '#8a8ea0'; c.fillRect(ex - 2, ey + 1, 1, 2); c.fillRect(ex + 1, ey + 1, 1, 2);
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
      if (f.k === 'ring') {
        const p = f.t / f.life;
        const [sx, sy] = R.projF(st, f.x, f.y, f.z);
        const r = (f.big ? 34 : 26) * ease(Math.min(1, p * 1.3));
        c.globalAlpha = Math.max(0, 1 - p);
        c.strokeStyle = '#fff0b0'; c.lineWidth = 2;
        c.beginPath(); c.ellipse(sx, sy, r, r / 2, 0, 0, 6.3); c.stroke();
        c.fillStyle = `rgba(255,220,140,${0.5 * (1 - p)})`; c.beginPath(); c.ellipse(sx, sy - 4, r * 0.6, r * 0.45, 0, 0, 6.3); c.fill();
        c.globalAlpha = 1; c.lineWidth = 1;
        continue;
      }
      const [sx, sy] = R.projF(st, f.x, f.y, f.z);
      c.globalAlpha = Math.max(0, 1 - f.t / f.life);
      c.fillStyle = f.col; c.fillRect(sx | 0, sy | 0, f.sz, f.sz);
      c.globalAlpha = 1;
    }
  }

  function lightsOn(c, st, disp, sec) {
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
      if (o.k === 'deco' && o.sub === 'hearth') { const [sx, sy] = R.projF(st, o.x, o.y, o.z + 1); const f = 0.9 + Math.sin(t * 9) * 0.08; glow(sx, sy - 6, 90 * f, '255,140,60', 0.3); glow(sx, sy - 6, 20, '255,220,150', 0.4); }
      if (o.k === 'crystal' && o.lit) { const [sx, sy] = R.projF(st, o.x, o.y, o.z + 2); glow(sx, sy - 6, 36, '140,220,255', 0.3 + 0.08 * Math.sin(t * 4)); }
      if (o.k === 'chest' && !o.open && o.item) { const [sx, sy] = R.projF(st, o.x, o.y, o.z + 1.5); glow(sx, sy, 18, '255,230,160', 0.22); }
      if (o.k === 'wagon') { const [sx, sy] = R.projF(st, o.x, o.y, o.z + 2); glow(sx, sy - 6, 22, '255,220,160', 0.12); }
    }
    const s = st.units.find(u => u.k === 'sena' && !u.gone);
    if (s) { const d = (disp && disp[s.id]) || s; const [sx, sy] = R.projF(st, d.x, d.y, d.z + 2.4); glow(sx + 5, sy - 2, 14, '120,220,255', 0.22 + 0.06 * Math.sin(t * 4)); }
    c.restore();
    const indoor = sec && sec.bg && sec.bg.indoor;
    const v = c.createRadialGradient(R.LW / 2, R.LH / 2, R.LH * (indoor ? 0.45 : 0.35), R.LW / 2, R.LH / 2, R.LW * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(2,1,8,${indoor ? 0.45 : 0.5})`);
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
  const NOSTART = '、。」』）】！？…ーっゃゅょぁぃぅぇぉッャュョァィゥェォ・：）';
  function wrap(s, max) {
    const out = []; let line = '';
    const chars = Array.from(s);
    for (let k = 0; k < chars.length; k++) {
      const ch = chars[k];
      if (ch === '\n') { out.push(line); line = ''; continue; }
      line += ch;
      const next = chars[k + 1];
      if (line.length >= max && next !== undefined && next !== '\n' && !NOSTART.includes(next)) { out.push(line); line = ''; }
    }
    if (line) out.push(line);
    return out;
  }
  function toScreen(x, y, z) { const [a, b] = R.projF(G.vs, x, y, z); return [a * 2, b * 2]; }
  function darker(hexc) { if (!hexc) return '#444'; const [r, g, b] = [1, 3, 5].map(k => parseInt(hexc.slice(k, k + 2), 16)); return `rgb(${r * 0.55 | 0},${g * 0.55 | 0},${b * 0.55 | 0})`; }
  function pips(cx, cy, hp, mhp, col, small, lose) {
    const w = small ? 4 : 7, gap = 2, hh = small ? 4 : 6, tot = mhp * (w + gap) - gap;
    let x = Math.round(cx - tot / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - 2, cy - 2, tot + 4, hh + 4);
    const blink = Math.sin(G.t * 8) > 0;
    for (let k = 0; k < mhp; k++) {
      const lost = lose && k < hp && k >= hp - lose;
      ctx.fillStyle = k < hp ? (lost ? (blink ? '#ff5040' : col) : col) : 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + k * (w + gap), cy, w, hh);
    }
  }

  function drawBubbles(st, wrapW) {
    G.bubbleRect = null;
    for (const b of G.bubbles.slice(0, 1)) {
      if (G.narr.length) break;
      if (G.banner && !G.banner.small && G.banner.t < G.banner.life - 0.3) break;
      const u = S.unitById(st, b.who);
      if (!u) continue;
      const d = G.disp[u.id] || u;
      const [sx, sy] = toScreen(d.x, d.y, d.z + 3.6);
      const lines = wrap(b.text, wrapW || 20);
      const w = Math.max(...lines.map(l => l.length)) * 19 + 28, h = lines.length * 24 + 34;
      const a = Math.min(1, b.t * 6, (b.life - b.t) * 3);
      const bx = Math.max(10, Math.min(1270 - w, sx - w / 2)), by = Math.max(70, sy - h - 10);
      G.bubbleRect = { x: bx, y: by, w, h };
      const over = b.t > 0.35 && G.mouse[0] >= bx && G.mouse[1] >= by && G.mouse[0] < bx + w && G.mouse[1] < by + h;
      const col = colorOf(b.who);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(250,246,236,0.96)'; ctx.fillRect(bx, by, w, h);
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(bx + 1.5, by + 1.5, w - 3, h - 3);
      ctx.fillStyle = 'rgba(250,246,236,0.96)';
      const tx = Math.max(bx + 12, Math.min(bx + w - 12, sx));
      ctx.beginPath(); ctx.moveTo(tx - 8, by + h); ctx.lineTo(tx, by + h + 10); ctx.lineTo(tx + 8, by + h); ctx.fill();
      ctx.font = 'bold 15px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = darker(col);
      ctx.fillText(nameOf(b.who), bx + 12, by + 20);
      ctx.font = '18px ' + FONT; ctx.fillStyle = '#2a2236';
      lines.forEach((l, k) => ctx.fillText(l, bx + 14, by + 44 + k * 24));
      if (over) { ctx.font = 'bold 13px ' + FONT; ctx.textAlign = 'right'; ctx.fillStyle = darker(col); ctx.fillText('クリックで次へ ▶', bx + w - 10, by + 20); }
      ctx.globalAlpha = 1;
    }
    // 語り
    if (G.narr.length) {
      const n = G.narr[0];
      const a = Math.min(1, n.t * 4, (n.life - n.t) * 3);
      ctx.globalAlpha = a;
      const lines = wrap(n.text, 36);
      const h = lines.length * 26 + 20;
      ctx.fillStyle = 'rgba(8,6,20,0.78)'; ctx.fillRect(240, 266, 800, h);
      lines.forEach((l, k) => txt(l, 640, 292 + k * 26, 18, '#e8e0f8', 'center', 'normal'));
      ctx.globalAlpha = 1;
    }
  }

  function drawUI(st) {
    drawBubbles(st);
    if (G.hintMark && G.hintMark.t < 7) {
      const m = G.hintMark;
      const [sx, sy] = toScreen(m.x, m.y, m.z + 2.6);
      ctx.globalAlpha = Math.min(1, 7 - m.t);
      txt('▼', sx, sy + Math.sin(G.t * 7) * 6, 28, '#ffe680', 'center');
      ctx.globalAlpha = 1;
    }
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
    // 助けを待つ人の頭上の印
    for (const u of st.units) {
      if (u.ko || u.gone || !(u.team === 'n' || u.guest) || !u.rescue || G.st.obj.k !== 'rescue') continue;
      const d = G.disp[u.id] || u;
      const [sx, sy] = toScreen(d.x, d.y, d.z + 3.2);
      const lu = S.unitById(G.st, u.id);
      if (lu && lu.safe) txt('✓', sx, sy, 20, '#a8ffb0', 'center');
      else txt(lu && lu.found ? '…' : '！', sx, sy + Math.sin(G.t * 5) * 3, 22, lu && lu.found ? '#ffe9a0' : '#ffb070', 'center');
    }
    for (const p of G.pops) {
      const [sx, sy] = toScreen(p.x, p.y, p.z + p.t * 0.9);
      ctx.globalAlpha = Math.min(1, (p.life - p.t) * 3);
      txt(p.text, sx, sy, p.big ? 30 : 22, p.col, 'center');
      ctx.globalAlpha = 1;
    }
    if (st.mode === 'combat' || G.st.mode === 'combat') {
      for (const u of st.units) {
        if (u.ko || u.gone || u.team !== 'e') continue;
        if (!u.active) continue;
        const d = G.disp[u.id] || u;
        const top = u.k === 'golem' ? 4.2 : u.k === 'turtle' ? 3.4 : u.k === 'slime' ? 2.2 : u.k === 'bat' ? 3.4 : 3.1;
        const [sx, sy] = toScreen(d.x, d.y, d.z + top);
        pips(sx, sy, u.hp, u.mhp, u.boss ? '#ffb040' : '#ff7a6a', true);
        if (u.frozen > 0) txt('凍', sx + u.mhp * 3 + 6, sy + 6, 13, '#bfefff', 'left');
        // すき（05 1.1）：いつまでお腹が出ているか（敵の手番に休むか・起きあがるかも、同じ札に）
        if (u.flipped > 0) {
          const lab = u.flipped >= 2 ? 'すき：次の手番の終わりまで' : 'すき：この手番の終わりまで（敵の手番で起きあがる）';
          ctx.font = 'bold 15px ' + FONT;
          const w = ctx.measureText(lab).width + 16;
          ctx.fillStyle = 'rgba(24,18,8,0.78)'; ctx.fillRect(sx - w / 2, sy - 27, w, 22);
          ctx.globalAlpha = 0.8 + 0.2 * Math.sin(G.t * 6);
          txt(lab, sx, sy - 10, 15, '#ffe680', 'center');
          ctx.globalAlpha = 1;
        }
      }
      if (!G.busy && !G.loseMenu) {
        const sum = {};
        for (const it of G.intents) { if (it.target) sum[it.target] = (sum[it.target] || 0) + it.dmg; for (const a of it.also || []) sum[a.id] = (sum[a.id] || 0) + a.dmg; }
        const res = G.intents.heroes || {};
        for (const id in sum) {
          const h = S.unitById(G.st, id); if (!h) continue;
          const [sx, sy] = toScreen(h.x, h.y, h.z + 3.3);
          const r = res[id] || {};
          const lethal = r.ko !== undefined ? r.ko : sum[id] >= h.hp;
          txt((lethal ? '倒される ' : r.endure ? 'こらえる ' : '') + '−' + sum[id], sx, sy - 14, 18, lethal ? '#ff5040' : r.endure ? '#ffe9a0' : '#ff9a80', 'center');
        }
        for (const it of G.intents) if (it.steal) { const e = S.unitById(G.st, it.id); if (e) { const [sx, sy] = toScreen(it.to[0], it.to[1], S.surface(G.st, it.to[0], it.to[1]).z + 3); txt('米俵 −1', sx, sy, 18, '#ffd070', 'center'); } }
        // 敵の次の手番：逃げていく（すきの「休む・起きあがる」は、すきの札にまとめて出す）
        for (const it of G.intents) {
          const e = S.unitById(G.st, it.id); if (!e || e.ko || e.flipped > 0) continue;
          const lab = it.rest ? '休む（すきのまま）' : it.rise ? '起きあがる' : it.stuck ? '逃げていく' : (it.idle && S.ENEMY[e.k].raid ? '行き場がなく、待つ' : '');
          if (!lab) continue;
          const [sx, sy] = toScreen(e.x, e.y, e.z + (e.k === 'turtle' ? 4.4 : 3.8));
          txt(lab, sx, sy - 6, 15, it.rest ? '#ffe680' : it.rise ? '#ff9a80' : '#c8c0e0', 'center');
        }
      }
    }
    // 上の帯
    const r = D.req(G.req);
    txt(r.kind + '　' + r.title, 22, 36, 22, '#f4ecd8');
    const O = S.objective(G.st);
    const gt = G.sec.goalText ? G.sec.goalText(G.st, O) : r.goal;
    txt('目的：' + gt, 24, 62, 16, O.done ? '#ffe08a' : '#c8c0e0', 'left', 'normal');
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
    if (G.cleared && G.st.mode !== 'combat') button('goGuild', 'ギルドへ帰る ▶', 1280 - 16 - 230, 62, 230, 46, () => goGuild(true), { pulse: true, bg: 'rgba(110,80,30,0.95)', size: 19, off: G.busy });
    const ids = partyIds();
    const selU = S.unitById(G.st, G.sel);
    if (selU && S.can(G.st, G.sel, 'pull') && G.st.mode === 'combat') button('pullMode', '⛓ 引く：' + (G.pullMode || G.keyShift ? '入' : '切') + '（Shift）', 14, 572, 250, 36, () => { G.pullMode = !G.pullMode; refresh(); }, { size: 15, bg: G.pullMode ? 'rgba(60,100,40,0.95)' : undefined });
    if (selU && S.can(G.st, G.sel, 'freeze') && G.st.up.staff) button('iceMode', '❄ 氷をつくる：' + (G.iceMode || G.keyShift ? '入' : '切') + '（Shift）', 14, 572, 250, 36, () => { G.iceMode = !G.iceMode; refresh(); }, { size: 15, bg: G.iceMode ? 'rgba(40,90,130,0.95)' : undefined });
    const cw = ids.length >= 4 ? 158 : 198, step = cw + 8;
    ids.forEach((id, k) => heroCard(st, id, 14 + k * step, 622, cw, k));
    drawCaption(ids.length >= 4 ? 690 : 640);
    if (G.st.mode === 'combat' && !G.loseMenu) {
      const all = S.heroes(G.st).every(h => h.ko || h.acted);
      txt('第' + G.st.turn + '手番', 1170, 612, 18, '#ffb8a0', 'center');
      button('end', '手番を終える', 1060, 624, 210, 56, endTurn, { off: G.busy, pulse: all && !G.busy, size: 20, bg: 'rgba(110,40,40,0.92)' });
      txt('Space', 1165, 698, 13, '#bba', 'center', 'normal');
      if (G.st.waves && G.st.waves.length) { const nw = S.nextWave(G.st); txt(nw === null ? '最後の波' : 'つぎの波まで ' + Math.max(0, nw) + ' 手番', 1170, 590, 15, '#ffcfa0', 'center', 'normal'); }
    }
    if (G.camLook && G.camLook.intro) txt('クリック・Space で先へ ▶', 24, 90, 15, 'rgba(230,224,250,0.9)', 'left', 'normal');
    else if (G.busy && !G.trans) txt('クリック・Space で早送り', 24, 90, 13, 'rgba(200,194,224,0.6)', 'left', 'normal');
    drawTooltip();
    if (G.caption2) {
      const a = Math.min(1, G.caption2.t * 4, (3 - G.caption2.t) * 2);
      ctx.globalAlpha = a;
      txt(G.caption2.text, 640, 118, 24, '#ffe9a0', 'center');
      ctx.globalAlpha = 1;
    }
    drawStampNote();
    if (G.banner) drawBanner();
    if (G.loseMenu) {
      panel(390, 260, 500, 200);
      txt(G.st.raid && G.st.raid.sacks <= 0 ? '米俵を、ぜんぶ盗られてしまった' : 'みんな倒れてしまった', 640, 310, 26, '#ffb0a0', 'center');
      button('retryPhase', 'この手番の始めから', 420, 340, 440, 48, retryPhase);
      button('retryFight', '戦いの前にもどる', 420, 396, 440, 48, retryFight);
    }
    if (G.menu) drawMenu();
    if (G.help) drawHelp();
  }
  function drawStampNote() {
    const n = G.stampNotes && G.stampNotes[0];
    if (!n) return;
    if (G.banner && !G.banner.small && G.banner.t < G.banner.life) { n.t = Math.min(n.t, 0.01); return; }   // 大きな見出しのあとで出す
    const a = Math.min(1, n.t * 5, (3.4 - n.t) * 3);
    const slide = Math.max(0, 1 - n.t * 6) * 40;
    ctx.globalAlpha = Math.max(0, a);
    const w = Math.max(n.text.length * 18, n.sub.length * 13) + 34, x = 1266 - w + slide, y = 118;
    panel(x, y, w, 56, 0.92, '#e8c860');
    txt(n.text, x + 16, y + 26, 18, '#ffe08a', 'left');
    txt(n.sub, x + 16, y + 46, 13, '#d8d0f0', 'left', 'normal');
    ctx.globalAlpha = 1;
  }
  function heroCard(st, id, x, y, w, k) {
    const u = S.unitById(G.st, id);
    if (!u) return;
    const sel = G.sel === id;
    const h = 88;
    const combat = G.st.mode === 'combat';
    const done = combat && (u.acted || u.ko);
    const col = colorOf(id);
    ctx.globalAlpha = done && !sel ? 0.6 : 1;
    panel(x, y - (sel ? 6 : 0), w, h, 0.9, sel ? col : 'rgba(170,160,210,0.35)');
    const fr = SP.frame(u.k, 0, 'idle');
    ctx.imageSmoothingEnabled = false;
    const yy = y - (sel ? 6 : 0);
    if (fr) ctx.drawImage(fr.c, x + 6, y + 8 - (sel ? 6 : 0) + (sel ? Math.round(Math.sin(G.t * 4)) : 0), fr.w * 3, Math.min(72, fr.h * 3));
    const tx = x + (w < 180 ? 52 : 62);
    txt((k + 1) + ' ' + S.HERO[u.k].name, tx, yy + 26, w < 180 ? 18 : 20, sel ? '#fff' : '#ddd');
    txt(u.fixed ? '発破（その場から）' : S.verbLabel(u.k, G.st.up), tx, yy + 48, w < 180 ? 13 : 15, col, 'left');
    let inc = 0;
    if (combat && !G.busy) for (const it of G.intents) { if (it.target === id) inc += it.dmg; for (const a of it.also || []) if (a.id === id) inc += a.dmg; }
    const pw = Math.min(u.mhp * 9, w - (tx - x) - 62);
    pips(tx + pw / 2, yy + 60, u.hp, u.mhp, col, u.mhp > 9 || w < 180, inc);
    txt(u.hp + '/' + u.mhp, x + w - 8, yy + 69, 14, u.hp < u.mhp ? '#ffd0c0' : '#e8e4f4', 'right');
    // 持たせたお守りの小さな印（木札を使ったあとは灰色）
    const ch = u.charm && D.CHARMS[u.charm];
    if (ch) txt('◆', x + 46, yy + 22, 15, u.tagUsed ? '#8a84a8' : '#ffd860', 'center');
    if (combat) {
      txt(u.ko ? '倒れている' : u.acted ? '行動ずみ' : (u.fixed ? '歩けない　行動 ○' : '移動 ' + u.mv + '　行動 ○'), tx, yy + 84, 13, u.acted || u.ko ? '#998' : '#cfe', 'left', 'normal');
      const r = (G.intents.heroes || {})[id] || {};
      const lethal = r.ko !== undefined ? r.ko : inc >= u.hp;
      if (inc) { txt('見こみ', x + w - 8, yy + 14, 12, '#ffb8a8', 'right', 'normal'); txt((lethal ? '倒される ' : r.endure ? 'こらえる ' : '') + '−' + inc, x + w - 8, yy + 32, 16, lethal ? '#ff5040' : r.endure ? '#ffe9a0' : '#ff9a80', 'right'); }
    } else txt(u.fixed ? 'ゲスト' : u.guestHero ? 'ゲスト（同行）' : ch ? '◆' + ch.name : sel ? '先頭で歩く' : '', tx, yy + 84, 13, ch ? '#ffe6a0' : '#aaa', 'left', 'normal');
    ctx.globalAlpha = 1;
    G.buttons.push({ key: 'hero_' + id, label: S.HERO[u.k].name, x, y: y - 6, w, h: h + 6, fn: () => selectHero(id) });
  }
  function drawCaption(x0) {
    const c = G.caption;
    if (!c) return;
    const a = Math.min(1, c.t * 5, Math.max(0, (6 - c.t)));
    if (a <= 0) return;
    ctx.globalAlpha = a;
    const x = x0 || 640, y = 628, w = G.st.mode === 'combat' ? 1040 - x - 12 : 1266 - x;
    panel(x, y, w, 76, 0.88, c.combo ? '#ffe08a' : 'rgba(170,160,210,0.35)');
    let xx = x + 14;
    if (c.combo) { txt('連携！', xx, y + 30, 18, '#ffe08a'); xx += 66; }
    for (const id of c.who || []) { const nm = nameOf(id); ctx.fillStyle = colorOf(id); ctx.fillRect(xx, y + 16, 14, 14); txt(nm, xx + 18, y + 30, 16, colorOf(id)); xx += 26 + nm.length * 16; }
    const lines = wrap(c.text, Math.floor((w - 28) / 17.5));
    lines.slice(0, 2).forEach((l, k) => txt(l, x + 14, y + 54 + k * 20, 17, '#f4ecd8', 'left', 'normal'));
    ctx.globalAlpha = 1;
  }
  function drawTooltip() {
    const hv = G.hv;
    if (!hv || G.busy) return;
    const lines = [];
    const p = hv.plan;
    const st = G.st;
    if (hv.intent && hv.intent.k === 'select') {
      const u = S.unitById(st, hv.intent.id);
      lines.push([hv.why || (nameOf(hv.intent.id) + 'を選ぶ'), '#fff']);
      if (!hv.why && u) lines.push([S.HERO[u.k].role + '：' + (u.fixed ? '発破（歩けない）' : S.verbLabel(u.k, st.up)), colorOf(u.id)]);
      if (u && u.guest && !u.safe) lines.push(['足をいためて歩けない（背負えない・縄も渡れない）。荷馬車まで歩いて下りられる道ができたら、自分で帰る', '#ffe9a0']);
      else if (u && u.guest && u.safe) lines.push(['荷馬車に着いた', '#a8ffb0']);
    } else if (p && p.ok) {
      const who = p.hero;
      const I = p.intent;
      const verb = I.k === 'move' ? (st.mode === 'explore' ? 'ここへ歩く' : 'ここへ動く') : (p.make ? '氷のかたまりをつくる' : VERBNAME[I.k]);
      lines.push([nameOf(who) + '：' + verb, colorOf(who)]);
      if (hv.pv && hv.pv.cap) lines.push(['▶ ' + fut(hv.pv.cap.text), '#ffe9a0']);
      if (hv.pv && st.mode === 'explore' && hv.pv.evs.some(e => e.k === 'combat') && I.k === 'move') lines.push(['！近くの敵に気づかれ、戦いになる', '#ff9a80']);
      else if (hv.pv && st.mode === 'explore' && hv.pv.evs.some(e => e.k === 'combat')) lines.push(['！途中で敵に気づかれ、戦いになる（' + verb + 'のは取りやめ）', '#ff9a80']);
      if (I.k === 'push' && (hv.pushValid || []).length > 1) lines.push(['押す向きは太い矢印。物の別の側へマウスを寄せると変わる', '#bfe0ff']);
      if ((I.k === 'push' || I.k === 'blast') && hv.pv && G.hintMark && G.hintMark.t < 30) {
        const m = G.hintMark;
        const hit = Object.values(hv.pv.moves).some(mv => mv && mv[0] === m.x && mv[1] === m.y);
        if (hit) lines.push(['◎ ヒントの光る升に入る！', '#a8ffb0']);
        else if (Object.keys(hv.pv.moves).length) lines.push(['（ヒントの光る升には入らない）', '#c8c0e0']);
      }
      if (I.k === 'blast') lines.push(['爆心と上下左右の4マス。となりの物・敵は外へ' + (st.up.bigbomb ? '2' : '1') + 'マス吹き飛ぶ（仲間には効かない）', '#ffd0a0']);
      if (hv.pv) {
        const ds = [];
        for (const id in hv.pv.dmg) { const u = S.unitById(st, id); if (u && u.team === 'e') ds.push(S.ENEMY[u.k].name + ' −' + hv.pv.dmg[id] + (hv.pv.ko.includes(id) ? '（倒れる）' : '')); }
        if (ds.length) lines.push([ds.join('　'), '#ffd0a0']);
        if (hv.pv.flips.length) lines.push(['ひっくり返る！（次の手番の終わりまで、お腹に攻撃が通る）', '#ffe680']);
        if (hv.pv.evs.some(e => e.k === 'clang') && !hv.pv.flips.length) lines.push(['甲羅ではじかれる（ひっくり返そう。2段上からの矢なら、すきまに傷1）', '#c8c8d8']);
        if (hv.pv.evs.some(e => e.k === 'endure')) lines.push(['身がわりの木札で、体力1でこらえる', '#ffe9a0']);
        if (hv.pv.bloom) lines.push(['道がひらける！（' + hv.pv.bloom + 'マス）', '#a8ffb0']);
        if (hv.pv.safe.length) lines.push([hv.pv.safe.map(id => (S.unitById(st, id) || {}).name || '').join('・') + 'が、荷馬車まで帰れるようになる！', '#a8ffb0']);
        const rn = hv.pv.evs.find(e => e.k === 'rune'); if (rn) lines.push(['門の灯がともる（' + rn.n + ' / ' + (st.obj.need || 3) + '）', '#a8e8ff']);
        if (st.mode === 'combat' && hv.pv.state) {
          const after = S.intents(hv.pv.state);
          let tot = 0; for (const it of after) { if (it.target) tot += it.dmg; for (const a of it.also || []) tot += a.dmg; }
          let now = 0; for (const it of G.intents) { if (it.target) now += it.dmg; for (const a of it.also || []) now += a.dmg; }
          if (I.k !== 'move' || tot !== now) lines.push(['このあと敵から受ける見こみ：' + tot + (tot < now ? '（' + (now - tot) + '減る）' : tot > now ? '（' + (tot - now) + '増える）' : ''), tot < now ? '#a8ffb0' : tot > now ? '#ffb0a0' : '#ccc']);
          if (st.raid) { const st2 = after.filter(it => it.steal).length, st1 = G.intents.filter(it => it.steal).length; if (st2 || st1) lines.push(['米俵を盗られる見こみ：' + st2 + (st2 < st1 ? '（減る）' : ''), st2 < st1 ? '#a8ffb0' : '#ffd070']); }
        }
      }
      if (I.k === 'move') { const sf = S.surface(st, p.stand[0], p.stand[1]); lines.push(['高さ ' + sf.z + (st.mode === 'combat' ? '　（' + p.cost + '歩）' : '') + (st.t[S.idx(st, p.stand[0], p.stand[1])] === 'n' && !sf.top ? '　深い雪（戦いでは2歩ぶん）' : ''), '#ccc']); }
      if (I.k === 'pull' && !p.lever && (hv.pushValid || []).length > 1) lines.push(['寄ってくる向きは太い矢印。物の別の側へマウスを寄せると変わる', '#bfe0ff']);
      const me = S.unitById(st, who);
      if (p.stand && me && (p.stand[0] !== me.x || p.stand[1] !== me.y) && I.k !== 'move') lines.push(['（半透明の場所まで歩いてから）', '#aaa']);
    } else if (hv.why) {
      lines.push([hv.why, '#ffb0a0']);
      if (hv.plan && hv.plan.whyAt) lines.push(['赤い × の所でさえぎられている', '#ff9a80']);
      if (hv.cell) { const sf = S.surface(st, hv.cell[0], hv.cell[1]); if (!sf.void) lines.push(['高さ ' + (st.t[S.idx(st, hv.cell[0], hv.cell[1])] === 'w' ? st.h[S.idx(st, hv.cell[0], hv.cell[1])] : sf.z) + (st.t[S.idx(st, hv.cell[0], hv.cell[1])] === 'n' && !sf.top ? '　深い雪（戦いでは2歩ぶん）' : ''), '#ccc']); }
    }
    if (hv.target && hv.target.k && !hv.target.team) {
      const o = hv.target;
      const nm = { bridge: '跳ね橋', crate: '木箱（押せる）', block: '石のブロック（押せる・吹き飛ばせる）', iceblock: '氷のかたまり（押すとすべる）', boulder: '大岩（押すと転がっていく）', pillar: st.up.gauntlet ? '石柱（鋼の籠手で倒せる）' : '石柱（重くて動かない）', anchor: '鉄の輪（リコの鉤縄をかけられる）', target: '的（リコが射ると仕掛けが動く）', fall: '滝（セナが凍らせられる）', chest: o.item ? '大事な品' : '宝箱', crack: o.on ? '封印石（発破で砕ける）' : 'ひび割れた岩（発破で砕ける）', crystal: o.lit ? '霜の水晶（灯っている）' : '霜の水晶（セナが凍らせると灯る）',
        icicle: 'つらら（射ると落ちる。水なら飛び石、床なら氷のかたまり、敵には傷3）', lever: o.done ? 'レバー（もう引いた）' : 'レバー（リコの引き鉤で引ける）',
        chime: o.rung ? '風鳴り石（鳴った）' : '風鳴り石（ナギがとなりからあおぐと鳴る）' }[o.k];
      if (nm) lines.unshift([nm, '#c8c0e0']);
    }
    if (hv.waftAlly && hv.target) lines.push(['（' + nameOf(hv.target.id) + 'を選ぶときは、札か Tab）', '#a8a0c8']);
    if (hv.target && hv.target.team === 'e') {
      const e = hv.target;
      const E = S.ENEMY[e.k];
      if (E.armor && e.flipped > 0) lines.unshift(['すき：' + (e.flipped >= 2 ? '次の手番の終わりまで' : 'この手番の終わりまで') + '、お腹が出ている（どの攻撃も +1）', '#ffe680']);
      lines.unshift([E.name + '　体力 ' + e.hp + '/' + e.mhp + (E.fly ? '　飛ぶ' : '') + (E.heavy ? '　重い' : '') + (E.ranged ? '　弓 ' + E.range : '') + (E.raid ? '　米倉へ一直線' : '') + (E.armor ? '　甲羅（ひっくり返すと攻撃が通る）' : '') + (E.climb ? '　段を2段のぼる・群れ' : E.snow ? '　雪でも遅くならない' : ''), '#ffb8a0']);
    }
    if (!lines.length) return;
    const w = Math.max(...lines.map(l => l[0].length)) * 17 + 26, h = lines.length * 24 + 14;
    let x = G.mouse[0] + 22, y = G.mouse[1] + 18;
    if (x + w > 1270) x = G.mouse[0] - w - 16;
    if (y + h > 610) y = G.mouse[1] - h - 14;
    x = Math.max(6, x); y = Math.max(6, y);
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
      txt(b.text, 640, 196, 34, b.col || '#f4ecd8', 'center');
      if (b.sub) txt(b.sub, 640, 234, 18, '#d8d0f0', 'center', 'normal');
    }
    ctx.globalAlpha = 1;
  }
  function drawMenu() {
    ctx.fillStyle = 'rgba(4,3,12,0.6)'; ctx.fillRect(0, 0, 1280, 720);
    panel(420, 110, 440, 500);
    txt('メニュー', 640, 158, 26, '#f4ecd8', 'center');
    let y = 186;
    const b = (k, l, fn) => { button(k, l, 460, y, 360, 46, fn); y += 56; };
    b('resume', '続ける', () => { G.menu = false; });
    b('helpm', 'あそびかた', () => { G.menu = false; G.help = true; });
    b('restart', 'この依頼をはじめからやり直す', restartMission);
    b('fast', '演出：' + (G.opt.fast ? 'はやい' : 'ふつう'), () => { G.opt.fast = !G.opt.fast; saveOpt(); });
    b('vol', '音量：' + Math.round(G.opt.vol * 10) + '　（押すと変わる）', () => { G.opt.vol = G.opt.vol >= 1 ? 0.2 : Math.round((G.opt.vol + 0.2) * 10) / 10; A.setVol(G.opt.vol); saveOpt(); A.sfx('select'); });
    if (G.cleared) b('back', 'ギルドへ帰る（報酬を受けとる）', () => { G.menu = false; goGuild(true); });
    else b('giveup', '依頼をあきらめて、ギルドへもどる', () => { G.menu = false; goGuild(false); });
    b('totitle', 'タイトルへ（進み具合は保存ずみ）', () => { save(); G.menu = false; G.scene = 'title'; A.bgm('title'); });
  }
  function drawHelp() {
    ctx.fillStyle = 'rgba(4,3,12,0.7)'; ctx.fillRect(0, 0, 1280, 720);
    panel(120, 40, 1040, 640);
    txt('あそびかた', 640, 86, 28, '#f4ecd8', 'center');
    const L = [
      ['歩く', '床を押すと、選んだ仲間が先頭で歩き、ほかの仲間がついてくる。のぼれる段差は1段、飛びおりられるのは2段まで'],
      ['仲間を選ぶ', '下の札・本人を押す、または 1・2・3 キー。選ぶと、その仲間が働きかけられる物が光る'],
      ['リコ「射る・鉤縄」', '的を射ると仕掛けが動く。鉄の輪に鉤縄をかけて渡ると、縄はみんなの道になる（下から届くのは2段上まで）'],
      ['ガルド「押す」', '木箱・岩・敵を一升押す。向きは矢印で、物のどちら側にマウスを寄せるかで変わる。段から落ちた物は足場に、水に沈んだ物は飛び石に'],
      ['セナ「凍らせる」', '水を凍らせて氷の床に。滝は氷の段に。霜の水晶は凍らせると灯る。敵を凍らせると次の手番うごけず、押すとすべる'],
      ['トビ「発破」', 'ひび割れた岩を砕く（がれきは足場）。敵や物のとなりの升を押すと、そこで発破：上下左右の物・敵が外へ吹き飛ぶ。重い相手も動く'],
      ['働きかける', '物や敵を指すと、だれが・どこに立って・どうなるかが先に見える。押すとその場所まで歩いて行う'],
      ['戦い', '敵に気づかれると手番制。みんなそれぞれ「動いて、一つ行動」。赤い線は手番を終えたときの敵の動き'],
      ['地形で倒す', '崖・谷・水のそばへ押しだすと一押しで倒せる。高い所から射ると強い'],
      ['戻す・回す', 'Z（右クリック）で一つ前に戻す（戦いは手番の中だけ）。Q・E で見る向きを回す。ホイール・右ドラッグで見わたす'],
      ['依頼を終える', '目的を果たすと「依頼達成」。右上の「ギルドへ帰る」で帰還。寄り道してから帰ってもいい'],
      ['あおぐ（ナギ）', 'ナギを選んで、となりの軽い物・軽い敵・仲間を指すと、反対側へ2升運ぶ（2段上まで・谷も越える）。重い物とナギ自身は運べない。仲間を選ぶときは、札か Tab'],
      ['引き鉤（第二章）', '手に入れると、リコは一直線に並んだ軽い物・軽い敵を手もとへ引ける（距離4まで・2段上まで）。レバーも引ける。戦いの中で敵を引くときは、札の上の「引く」を入れる（または Shift）'],
      ['困ったら', 'H でヒント（場所に光る印が出る）。やり直しはメニュー（Esc）。氷晶の杖を持つセナは、札の上の「氷をつくる」を入れる（または Shift を押しながら）と、床を押して氷をつくれる'],
    ];
    L.forEach((l, k) => { txt(l[0], 150, 134 + k * 44, 17, '#ffe08a'); const ws = wrap(l[1], 46); ws.forEach((w, j) => txt(w, 350, 134 + k * 44 + j * 19, 15, '#e8e0f8', 'left', 'normal')); });
    button('closehelp', '閉じる', 560, 628, 160, 40, () => { G.help = false; });
  }

  // ---------- タイトル ----------
  let titleSt = null;
  function drawTitle() {
    if (!titleSt) {
      titleSt = S.create({ id: 'title', W: 9, H: 7, hmap: ['..5555...', '.555555..', '45555554.', '4444444..', '.44444...', '..333....', '.........'],
        tmap: ['..pppp...', '.gppppg..', 'ggggdgg..', 'gggdggg..', '.ggggd...', '..ggg....', '.........'],
        objs: [{ k: 'torch', x: 2, y: 1, fz: 2 }, { k: 'deco', sub: 'tree', x: 6, y: 1, h: 3 }, { k: 'deco', sub: 'flagdeco', x: 1, y: 2, h: 2, col: '#3a6ac8' }, { k: 'wagon', x: 5, y: 3 }],
        enemies: [], start: [[3, 2, 0], [2, 3, 0], [4, 3, 0]], party: ['riko', 'gard', 'sena'] }, { party: ['riko', 'gard', 'sena'] });
    }
    const keepRot = R.rot;
    R.rot = 0;
    R.resetCache(titleSt);
    R.goalLit = 0; R.starsLit = 0; R.hubPick = false;
    const [ax, ay] = R.rawProj(titleSt, 3.5, 2.5, 4);
    R.cam.x = ax - (215 - R.LW / 2); R.cam.y = ay - (262 - R.LH / 2);
    R.hi.objs = {};
    R.draw(lx, { st: titleSt, sec: { bg: { sky: true, sunset: true } }, disp: {}, odisp: {}, tint: {} }, G.t);
    lightsOn(lx, titleSt, {}, {});
    R.rot = keepRot;
    titleDirty = true;
    ctx.drawImage(low, 0, 0, 1280, 720);
    // 風見鶏
    const wx = 1000, wy = 150, ang = Math.sin(G.t * 0.7) * 0.6;
    ctx.save(); ctx.translate(wx, wy); ctx.fillStyle = '#2a2030'; ctx.fillRect(-2, 0, 4, 60);
    ctx.rotate(ang * 0.3); ctx.fillStyle = '#e8c860';
    ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-10, -18); ctx.lineTo(4, -30); ctx.lineTo(14, -18); ctx.lineTo(30, -26); ctx.lineTo(24, -6); ctx.lineTo(34, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c84a3a'; ctx.fillRect(2, -34, 6, 5);
    ctx.restore();
    // 英字の題字。字間を少し広げ、下に金の細線を引く（原型の題字と同じ左上の位置）
    ctx.save();
    if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
    txt('GUILDWARD', 104, 196, 84, '#f6eed8');
    const tw = Math.round(ctx.measureText('GUILDWARD').width) - 6;
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(110, 220, tw, 3);
    ctx.fillStyle = '#e8c860'; ctx.fillRect(108, 218, tw, 3);
    const sv = loadSave();
    let y = 320;
    const bx = 760;
    if (sv) {
      const lab = sv.play ? '依頼のつづきから（' + D.req(sv.play.req).title + '）' : 'つづきから（ギルド・' + C.rankInfo(sv.prof).name + '）';
      button('cont', lab, bx, y, 420, 54, () => { A.init(); resumeSave(sv); }, { size: 19 }); y += 66;
    }
    button('new', 'はじめから', bx, y, 420, 54, () => { A.init(); if (sv && !G.confirmNew) { G.confirmNew = G.t; return; } newGame(); }, { size: 20 });
    if (sv && G.confirmNew && G.t - G.confirmNew < 4) txt('もう一度押すと、いまの記録を消して始める', bx + 210, y + 78, 15, '#ffb0a0', 'center', 'normal');
    else if (sv && sv.migratedPlay) txt('前の版の「依頼のつづき」は、ギルドからの再開になります', bx + 210, y + 78, 15, '#ffe0a0', 'center', 'normal');
    y += 96;
    button('sound', '音：' + (G.opt.on ? 'あり' : 'なし'), bx, y, 180, 44, toggleSound);
    txt('マウスで遊ぶ。キーボードも使える（遊んでいる間に ？ で操作の一覧）', 114, 690, 15, '#a8a0c8', 'left', 'normal');
    txt('BEYOND ONE PROMPT 02　v0.3', 1260, 700, 14, '#8a84a8', 'right', 'normal');
  }
  let titleDirty = false;
  function resumeSave(sv) {
    G.prof = sv.prof; G.firstFight = sv.firstFight !== undefined ? sv.firstFight : true;
    G.confirmNew = 0;
    if (sv.play) resumePlay(sv);
    else window.HUB21.enter(null);
  }
  function newGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 無視 */ }
    G.prof = C.newProfile(); G.firstFight = true; R.rot = 0; G.sel = 'riko'; G.confirmNew = 0;
    startStory(D.PROLOGUE, () => { window.HUB21.enter(null, true); save(); });
  }

  // ---------- 物語の頁 ----------
  function startStory(pages, done, bg) {
    G.scene = 'story';
    G.story = { pages, k: 0, t: 0, done, bg };
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
    R.drawBackdrop(lx, { bg: s.bg || { sky: true, sunset: true } }, G.t);
    ctx.drawImage(low, 0, 0, 1280, 720);
    ctx.fillStyle = 'rgba(4,3,12,0.5)'; ctx.fillRect(0, 0, 1280, 720);
    const pg = s.pages[s.k];
    const a = Math.min(1, s.t * 2.5);
    ctx.globalAlpha = a;
    const lines = wrap(pg, 30);
    lines.forEach((l, k) => txt(l, 640, 300 + k * 40 - lines.length * 20, 26, '#f4ecd8', 'center', 'normal'));
    ctx.globalAlpha = 1;
    txt((s.k + 1) + ' / ' + s.pages.length + '　クリックで次へ', 640, 640, 16, '#9a94b8', 'center', 'normal');
    button('skip', 'とばす', 1120, 20, 140, 40, () => storyNext(true));
  }

  // ---------- 絵の一覧（確認用） ----------
  function drawSheet() {
    ctx.fillStyle = '#2a2638'; ctx.fillRect(0, 0, 1280, 720);
    // v0.3：第二章の絵（ナギ・ツル・ヒバ・雪小鬼・雪狼）を足した
    const kinds = ['riko', 'gard', 'sena', 'tobi', 'nagi', 'mimoza', 'dora', 'tonbo', 'hans', 'miner', 'kid', 'elder', 'turu', 'hiba', 'goblin', 'raider', 'snowgob', 'archer', 'slime', 'bat', 'golem', 'wisp', 'wolf', 'turtle'];
    kinds.forEach((k, r) => {
      const col = r % 2, row = (r / 2) | 0;
      for (let sd = 0; sd < 2; sd++) ['idle', 'walk1', 'walk2', 'act'].forEach((p, j) => {
        const fr = SP.frame(k, sd * 3, p);
        if (fr) ctx.drawImage(fr.c, 20 + col * 640 + (sd * 4 + j) * 70, 4 + row * 59, fr.w * 2, Math.min(56, fr.h * 2));
      });
    });
  }

  // ---------- ギルドの画面（hub.js）に渡す口 ----------
  window.APP21 = {
    G, S, R, D, SP, A, C, ctx, lx, low, FONT, HC,
    txt, panel, button, wrap, say, popup, queue, save, saveOpt, burst, darker, pips, nameOf, colorOf, drawBubbles, drawBanner, drawWorld, drawFxLow, lightsOn,
    startMission: (req, party) => { G.trans = { t: 0, mission: req, party }; A.sfx('select', { f: 660 }); },
    startStory, snapCam, toScreen, wrap2: wrap,
    resetBox: () => { boxCache = null; },
    endingDone: () => { G.scene = 'title'; A.bgm('title'); },
  };

  // ---------- 確認用の口 ----------
  window.G21 = {
    G, S, R, C, D,
    loadSave,
    stampNotes: () => (G.stampNotes || []).map(n => n.text),
    stampSeen: () => (G.stampSeen || []).slice(),
    state: () => G.st,
    prof: () => G.prof,
    scene: () => G.scene,
    busy: () => G.busy || !!G.trans || !!(window.HUB21 && window.HUB21.busy()),
    buttons: () => G.buttons.map(b => ({ key: b.key, label: b.label, x: b.x + b.w / 2, y: b.y + b.h / 2, off: b.off })),
    cellScreen: (x, y) => { const st = G.st; const sf = S.surface(st, x, y); const z = sf.void ? 0 : ('wr'.includes(st.t[S.idx(st, x, y)]) ? st.h[S.idx(st, x, y)] : sf.z); const [a, b] = R.projF(st, x, y, z); return { x: a * 2, y: b * 2 }; },
    unitScreen: (id) => { const r = R.unitRects.find(q => q.id === id); return r ? { x: (r.x + r.w / 2) * 2, y: (r.y + r.h / 2) * 2 } : null; },
    objScreen: (id) => {
      const o = S.objById(G.st, id); if (!o) return null;
      if (o.k === 'fall') { const st = G.st; const [x0, y0] = R.projF(st, o.x, o.y, st.h[S.idx(st, o.x, o.y)]); const [x1, y1] = R.projF(st, o.bx, o.by, o.bz); return { x: (x0 + x1), y: (Math.min(y0, y1) + y1) }; }
      const rr = (R.objRects || []).find(q => q.id === id);
      if (rr) return { x: (rr.x + rr.w / 2) * 2, y: (rr.y + rr.h / 2) * 2 };
      const [a, b] = R.projF(G.st, o.x, o.y, (o.z || 0) + 0.6); return { x: a * 2, y: b * 2 };
    },
    dirOffset: (dir) => { const sd = R.sdir(dir); return [[16, 12], [-16, 12], [-16, -16], [16, -16]][sd]; },
    entCenter: (ref) => { const st = G.st; const e = ref.u ? S.unitById(st, ref.u) : S.objById(st, ref.o); const [a, b] = R.projF(st, e.x, e.y, (e.z || 0)); return { x: a * 2, y: (b - 6) * 2 }; },
    newProfile: () => { G.prof = C.newProfile(); return G.prof; },
    mission: (req, party, fn) => { if (!G.prof) G.prof = C.newProfile(); startMission(req, party || ['gard', 'sena']); if (fn) { fn(G.st, G.prof); G.entry = S.clone(G.st); enterPlay(); } },
    guild: () => { if (!G.prof) G.prof = C.newProfile(); window.HUB21.enter(null); },
    hold: (v) => { G.hold = v; },
    step: (n, dt) => { for (let k = 0; k < (n || 1); k++) { G.holdStep = dt || 1 / 60; update(G.holdStep); } draw(); },
    act: (heroId, intent) => { const p = S.plan(G.st, heroId, intent); if (p.ok) doAction(p); return p; },
    endTurn, undo, select: selectHero, rotate, hint,
    hover: () => G.hv ? { why: G.hv.why, target: G.hv.target && (G.hv.target.k || G.hv.target.id), pushValid: G.hv.pushValid, plan: G.hv.plan && { ok: G.hv.plan.ok, why: G.hv.plan.why, hero: G.hv.plan.hero, intent: G.hv.plan.intent, stand: G.hv.plan.stand }, cap: G.hv.pv && G.hv.pv.cap && G.hv.pv.cap.text, bloom: G.hv.pv && G.hv.pv.bloom } : null,
    bubbles: () => G.bubbles.map(b => b.who + ':' + b.text),
    caption: () => G.caption && G.caption.text,
    setOpt: (o) => Object.assign(G.opt, o),
    lookAt: (x, y) => { const st = G.st; const u = S.unitById(st, G.sel); const [a, b] = R.rawProj(st, x, y, S.surface(st, x, y).void ? 0 : S.surface(st, x, y).z); const [c, d] = R.rawProj(st, u.x, u.y, u.z); G.camOff = [a - c, b - d + 20]; G.camLook = null; },
    goGuild,
  };
  window.addEventListener('keydown', (ev) => { if (ev.key === 'Shift') { G.keyShift = true; if (G.scene === 'play') computeHover(); } });
  window.addEventListener('keyup', (ev) => { if (ev.key === 'Shift') { G.keyShift = false; if (G.scene === 'play') computeHover(); } });

  if (QS.has('sheet')) G.scene = 'sheet';
  A.bgm('title');
  requestAnimationFrame(frame);
})();
