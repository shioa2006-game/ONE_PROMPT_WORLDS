/*
 * ぐるり、夜まつり ― 戦いの画面
 * なぞる → はなす → 玉が はじける → 落ちる → 妖の番 → また なぞる
 */
(function (root) {
  'use strict';
  const G = root.G10, D = G.D, S = G.S, R = G.R, A = G.A;
  const W = 1280, H = 720, C = 68, BX = 402, BY = 226, BN = 7;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  function cpos(i) { return { x: BX + (S.cx(i) + 0.5) * C, y: BY + (S.cy(i) + 0.5) * C }; }
  function gpos(x, y) { return { x: BX + (x + 0.5) * C, y: BY + (y + 0.5) * C }; }
  function cellAt(x, y, rad) {
    const fx = (x - BX) / C, fy = (y - BY) / C;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    if (ix < 0 || iy < 0 || ix >= BN || iy >= BN) return -1;
    if (rad != null) { const dx = fx - (ix + 0.5), dy = fy - (iy + 0.5); if (dx * dx + dy * dy > rad * rad) return -1; }
    return S.idx(ix, iy);
  }
  const YUI = { x: 196, y: 262, s: 200 };
  const HUD = { hp: { x: 70, y: 392 }, coin: { x: 64, y: 444 }, cord: { x: 196, y: 444 }, mask: { x: 300, y: 444 } };
  const BOSS = { x: 640, y: 118, s: 250 };

  const B = { st: null };
  G.B = B;

  // ================================================================ 用意
  function areaIdOf(bid) { return +bid[1]; }
  function enter(arg) {
    const run = G.run();
    G.overlay = null;
    B.bid = arg.bid;
    B.cfg = D.BATTLES[B.bid];
    B.area = areaIdOf(B.bid);
    B.attempt = (arg.attempt || 0) + 1;
    B.snapP = arg.snapP || JSON.parse(JSON.stringify(run.P));
    B.P = arg.P || JSON.parse(JSON.stringify(run.P));
    B.bookBefore = Object.assign({}, G.save.book);
    B.friendsBefore = Object.assign({}, B.snapP.friends);
    const seed = ((run.started || 1) % 100000) * 31 + run.a * 977 + run.n * 131 + B.attempt * 7919;
    B.st = S.newBattle(B.bid, B.P, seed);
    B.vis = new Map(); B.fx = []; B.sky = []; B.timers = []; B.texts = [];
    B.chain = null; B.hover = -1; B.hint = null; B.tip = null; B.shake = 0;
    B.yuiMood = null; B.yuiMoodT = 0; B.cheer = 0;
    B.disp = { hp: B.P.hp, coins: B.P.coins, blocks: B.st.blocks, bossHp: B.st.boss ? B.st.boss.hp : 0 };
    B.hpShown = B.P.hp; B.bossShown = B.disp.bossHp;
    B.bossAnim = null;
    B.result = null; B.talk = null; B.ringIds = new Set();
    B.newSpecies = []; B.bossCalm = null; B.hurtFlash = 0; B.closeFlash = 0; B.lostT = 0;
    B.turnStart = G.t; B.idleHinted = false; B.lastFull = -1;
    B.startT = G.t;
    syncVis({ defKind: 'none' });
    for (const vp of B.vis.values()) vp.appear = { t: G.t + 0.15 + (vp.y * 0.04 + vp.x * 0.015), kind: 'pop' };
    A.startBgm(B.st.boss ? 'boss' : 'a' + B.area);
    B.phase = 'intro';
    B.introT = G.t;
    const sp0 = B.st.boss ? B.st.boss.sp : null;
    B.at(G.t + 0.9, () => {
      if (sp0 && B.attempt === 1) startTalk(D.BOSS_TALK[sp0].before, () => startInput());
      else startInput();
    });
  }

  // ================================================================ 見た目の駒（id ごと）
  function vpFrom(p, i) {
    return { id: p.id, k: p.k, t: p.t, sp: p.sp, x: S.cx(i), y: S.cy(i), mv: null, appear: null, gone: null,
      hp: p.hp, mhp: p.mhp, cd: p.cd, cdMax: p.cdMax, seed: Math.random() * 10, flash: 0, act: -9, hitT: -9 };
  }
  function ease(kind, u) {
    if (kind === 'fall') return u < 1 ? 1 - Math.pow(1 - u, 2.2) : 1;
    if (kind === 'hop') return u;
    if (kind === 'slide') return u * u * (3 - 2 * u);
    return 1 - Math.pow(1 - u, 3);
  }
  function curPos(vp) {
    const m = vp.mv;
    if (!m) return [vp.x, vp.y, 0];
    const u = clamp((G.t - m.t0) / m.dur, 0, 1);
    if (u >= 1 && G.t >= m.t0) { vp.mv = null; return [vp.x, vp.y, 0]; }
    if (m.wrap) return u < 0.5 ? [m.x0 + Math.sign(m.x1 - m.x0) * -u * 0.8, m.y0, u * 2] : [m.x1 + Math.sign(m.x1 - m.x0) * -(1 - u) * 0.8, m.y1, (1 - u) * 2];
    const e = ease(m.ease, u);
    let x = lerp(m.x0, m.x1, e), y = lerp(m.y0, m.y1, e);
    if (m.ease === 'hop') y -= Math.sin(u * Math.PI) * 0.35;
    if (m.ease === 'fall' && u >= 1) y = m.y1;
    return [x, y, 0];
  }
  // sim の 盤と 見た目を あわせる。sch で 出かた・消えかた・動きの 時間を 決める
  function syncVis(sch) {
    sch = sch || {};
    const appear = sch.appear || {}, gone = sch.gone || {}, move = sch.move || {};
    const seen = new Set();
    const st = B.st;
    for (let i = 0; i < S.N; i++) {
      const p = st.cells[i];
      if (!p) continue;
      seen.add(p.id);
      let vp = B.vis.get(p.id);
      const tx = S.cx(i), ty = S.cy(i);
      if (!vp) {
        vp = vpFrom(p, i);
        const ap = appear[p.id];
        vp.appear = { t: ap ? ap.t : (sch.defT || G.t), kind: ap ? ap.kind : (sch.defKind || 'fade') };
        if (ap && ap.from) vp.mv = { x0: ap.from[0], y0: ap.from[1], x1: tx, y1: ty, t0: ap.t, dur: ap.dur || 0.3, ease: 'fall' };
        B.vis.set(p.id, vp);
        continue;
      }
      if (p.k === 'y') { vp.mhp = p.mhp; }
      if (vp.x !== tx || vp.y !== ty) {
        const [px, py] = curPos(vp);
        const mv = move[p.id] || {};
        vp.mv = { x0: px, y0: py, x1: tx, y1: ty, t0: mv.t != null ? mv.t : G.t, dur: mv.dur || 0.22, ease: mv.ease || 'fall', wrap: mv.wrap };
        vp.x = tx; vp.y = ty;
      }
    }
    for (const [id, vp] of B.vis) {
      if (seen.has(id) || vp.gone) continue;
      const g = gone[id];
      vp.gone = { t: g ? g.t : (sch.defGoneT || G.t), kind: g ? g.kind : 'fade', dur: (g && g.dur) || 0.3 };
    }
  }

  // ================================================================ 時間で 動かす
  B.at = function (t, fn) { B.timers.push({ t, fn }); };
  function runTimers() {
    if (!B.timers.length) return;
    B.timers.sort((a, b) => a.t - b.t);
    while (B.timers.length && B.timers[0].t <= G.t) { const tm = B.timers.shift(); tm.fn(); }
  }

  // ================================================================ 演出の部品
  function addText(x, y, text, o) {
    o = o || {};
    B.fx.push({ k: 'text', x, y, text, t0: G.t + (o.delay || 0), dur: o.dur || 1.0, col: o.col || '#fff', size: o.size || 22, rise: o.rise == null ? 36 : o.rise, stroke: o.stroke || 'rgba(30,10,20,0.85)', pop: o.pop });
  }
  function sparks(x, y, col, n, spd, o) {
    o = o || {};
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, v = spd * (0.4 + Math.random() * 0.8);
      B.fx.push({ k: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0), g: o.g == null ? 260 : o.g, t0: G.t + (o.delay || 0), dur: (o.life || 0.6) * (0.6 + Math.random() * 0.6), col, r: (o.r || 3) * (0.6 + Math.random() * 0.8) });
    }
  }
  function ringWave(x, y, col, r1, dur, delay) { B.fx.push({ k: 'wave', x, y, col, r1, t0: G.t + (delay || 0), dur: dur || 0.5 }); }
  const FW_COLS = ['#ff6a5a', '#ffd34a', '#7ad8ff', '#ff8ad8', '#a8ff7a', '#ffffff', '#ffa040'];
  function rocket(x, y, k, size) {
    const tx = clamp(x + (Math.random() - 0.5) * 260, 120, 1160);
    const ty = 40 + Math.random() * 140 - (size > 6 ? 10 : 0);
    const col = FW_COLS[(k + ((Math.random() * 3) | 0)) % FW_COLS.length];
    B.fx.push({ k: 'rocket', x0: x, y0: y, x1: tx, y1: ty, t0: G.t, dur: 0.5 + Math.random() * 0.15, col, size, done: false });
  }
  function skyBurst(x, y, col, size) {
    const n = 26 + Math.min(40, size * 5);
    const r = 70 + Math.min(110, size * 14);
    const col2 = FW_COLS[(Math.random() * FW_COLS.length) | 0];
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU + Math.random() * 0.1, v = r * (0.9 + Math.random() * 0.25) * 1.6;
      B.sky.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: G.t, dur: 1.1 + Math.random() * 0.5, col: k % 3 ? col : col2, r: 2.2 + Math.random() * 1.2 });
    }
    B.sky.push({ flash: true, x, y, t0: G.t, dur: 0.25, r: r * 0.6, col });
    if (B.sky.length > 900) B.sky.splice(0, B.sky.length - 900);
  }
  function fly(icon, x0, y0, x1, y1, delay, dur, onArrive) {
    B.fx.push({ k: 'fly', icon, x0, y0, x1, y1, t0: G.t + (delay || 0), dur: dur || 0.55, cb: onArrive, done: false, bend: (Math.random() - 0.5) * 120 });
  }
  function doron(x, y, delay) {
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * TAU;
      B.fx.push({ k: 'smoke', x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 6, vx: Math.cos(a) * 40, vy: Math.sin(a) * 24 - 20, t0: G.t + (delay || 0), dur: 0.55, r: 14 + Math.random() * 8 });
    }
  }
  function yuiMood(m, dur) { B.yuiMood = m; B.yuiMoodT = G.t + (dur || 0.6); }

  // ================================================================ 入力の番
  function startInput() {
    B.phase = 'input';
    B.turnStart = G.t;
    B.idleHinted = false;
    B.hint = null;
    const rg = S.ringables(B.st);
    B.ringIds = new Set(rg.map(r => r.id));
    B.ringList = rg;
    showTips();
  }
  function showTips() {
    const cfg = B.cfg, st = B.st;
    if (cfg.guide === 'fire' && st.turn === 0) {
      B.tip = { text: '光っている 花火を なぞって つなごう（同じ玉を 3つ以上）。花火は となりの妖を おどかす！', t0: G.t, guide: [S.idx(2, 1), S.idx(2, 2), S.idx(2, 3)] };
      return;
    }
    if (cfg.guide === 'ring' && st.turn === 0) {
      B.tip = { text: '小判で 妖を ぐるっと かこもう。なぞりはじめの 玉に もどると 輪になって、中の妖が ともだちに！', t0: G.t, guide: [S.idx(3, 1), S.idx(4, 2), S.idx(3, 3), S.idx(2, 2)], ring: true };
      return;
    }
    const ys = S.yokaiList(st).map(i => st.cells[i]);
    const rare = ys.find(y => D.SPECIES[y.sp].rare);
    if (rare && !G.seen('tipRare')) { B.tip = { text: 'めずらしい妖！ 青い 数字が 0に なると にげてしまう。にげる前に 輪で むすぼう（花火で おいはらうと ともだちに できない）。', t0: G.t }; G.markSeen('tipRare'); return; }
    if (st.boss && !G.seen('tipBoss')) { B.tip = { text: 'ぬしには 花火が 空から とどく（つないだ数だけ）。輪で むすんだ ともだちも、ぬしを くすぐって 手つだってくれる。', t0: G.t }; G.markSeen('tipBoss'); return; }
    const hasJunk = st.cells.some(c => c && c.k === 'j');
    if (hasJunk && !G.seen('tipJunk')) { B.tip = { text: 'おじゃまは つなげない。花火の となりで もえる。輪の 中に 入れても きえる。', t0: G.t }; G.markSeen('tipJunk'); return; }
    if (B.ringIds.size && !G.seen('tipSpark')) { B.tip = { text: '紅白に 光る妖は、いま 輪で かこめる しるし。どの玉で かこめるか さがしてみよう。', t0: G.t }; G.markSeen('tipSpark'); return; }
    if (st.turn >= 1 && B.tip && !B.tip.keep) B.tip = null;
  }

  function startChain(i) {
    if (!S.canStart(B.st, i)) return;
    B.chain = { path: [i], closed: false, info: null, lastCell: i, full: false };
    const t = B.st.cells[i].t;
    A.play('link', { n: 0, t });
    B.hint = null;
    updatePreview();
  }
  function updatePreview() { B.chain.info = S.preview(B.st, B.chain.path, B.chain.closed); }
  function chainMove(x, y) {
    const ch = B.chain;
    if (!ch) return;
    // はやく うごかしても 間の マスを ひろう
    const lx = ch.px == null ? x : ch.px, ly = ch.py == null ? y : ch.py;
    const dist = Math.hypot(x - lx, y - ly), steps = Math.max(1, Math.ceil(dist / 8));
    for (let s = 1; s <= steps; s++) {
      const sx = lx + (x - lx) * s / steps, sy = ly + (y - ly) * s / steps;
      const i = cellAt(sx, sy, 0.4);
      if (i < 0 || i === ch.lastCell) continue;
      ch.lastCell = i;
      const r = S.tryStep(B.st, ch.path, ch.closed, i);
      const t = (S.chainType(B.st, ch.path) || 'L');
      if (r === 'add') { ch.path.push(i); A.play('link', { n: ch.path.length - 1, t: B.st.cells[i].t === 'L' ? 'L' : t }); ch.full = false; }
      else if (r === 'back') { ch.path.pop(); A.play('unlink', { n: ch.path.length }); ch.full = false; }
      else if (r === 'close') { ch.closed = true; A.play('close'); B.closeFlash = G.t; }
      else if (r === 'open') { ch.closed = false; A.play('open'); }
      else if (r === 'full') { if (B.lastFull !== i) { A.play('full'); B.lastFull = i; ch.full = G.t; } }
      if (r) updatePreview();
    }
    ch.px = x; ch.py = y;
  }
  function endChain() {
    const ch = B.chain;
    B.chain = null;
    B.lastFull = -1;
    if (!ch) return;
    const info = S.preview(B.st, ch.path, ch.closed);
    if (!info.valid) {
      A.play('cancel');
      if (ch.path.length === 2) addText(cpos(ch.path[1]).x, cpos(ch.path[1]).y - 30, '3つ以上 つなごう', { col: '#ffe0b0', size: 17 });
      else if (ch.path.length >= 1 && !S.chainType(B.st, ch.path) && ch.path.length >= 3) addText(cpos(ch.path[0]).x, cpos(ch.path[0]).y - 30, '提灯だけでは つなげない', { col: '#ffe0b0', size: 17 });
      return;
    }
    commit(ch.path, ch.closed);
  }

  // ================================================================ はなした あと
  function commit(path, closed) {
    const st = B.st;
    B.phase = 'anim';
    B.tip = (B.tip && B.tip.keep) ? B.tip : null;
    const before = new Map();
    for (let i = 0; i < S.N; i++) if (st.cells[i]) before.set(st.cells[i].id, i);
    const ids = path.map(i => st.cells[i].id);
    const info = S.preview(st, path, closed);
    const interIds = info.interior.map(i => st.cells[i] && st.cells[i].id).filter(Boolean);
    const res = S.resolve(st, path, closed);
    const ev = res.ev;
    const run = G.run();
    run.stats.best = Math.max(run.stats.best || 0, info.count);
    if (closed) { run.stats.rings = (run.stats.rings || 0) + 1; run.stats.bigRing = Math.max(run.stats.bigRing || 0, info.count); }
    const type = info.type, n = path.length;
    const dt = n <= 6 ? 0.068 : Math.max(0.042, 0.45 / n);
    const t0 = G.t + 0.02;
    const sch = { appear: {}, gone: {}, move: {} };
    const popT = {};
    path.forEach((i, k) => {
      const tt = t0 + k * dt;
      popT[i] = tt;
      sch.gone[ids[k]] = { t: tt, kind: 'pop', dur: 0.22 };
      B.at(tt, () => {
        const p = cpos(i);
        A.play('pop', { n: k });
        sparks(p.x, p.y, R.TCOL[type].rim, 7, 160, { life: 0.45 });
        if (type === 'H') { rocket(p.x, p.y, k, n); if (k % 2 === 0) A.play('rocket'); }
      });
    });
    let tEnd = t0 + n * dt;
    // 輪
    let ringT = tEnd;
    if (closed) {
      ringT = tEnd + 0.08;
      const pts = path.map(i => cpos(i));
      B.at(ringT, () => {
        B.fx.push({ k: 'ring', pts, t0: G.t, dur: 0.75 });
        const cxm = pts.reduce((a, p) => a + p.x, 0) / pts.length, cym = pts.reduce((a, p) => a + p.y, 0) / pts.length;
        ringWave(cxm, cym, '#ffe08a', 140, 0.6);
        const nb = info.befriend.length;
        addText(cxm, cym - 10, nb >= 2 ? nb + '体 いっしょに むすんだ！' : (nb ? 'むすんだ！' : 'ぐるり！'), { size: nb >= 2 ? 30 : 34, col: '#fff2c0', dur: 1.3, pop: true });
        A.play('close');
        B.shake = Math.max(B.shake, 4 + nb * 2);
        // 大きな 輪・たくさん むすんだ ときは 空にも 花火
        const big = nb * 2 + Math.floor(info.count / 6);
        for (let q = 0; q < big; q++) B.at(G.t + 0.25 + q * 0.18, () => { skyBurst(180 + Math.random() * 920, 60 + Math.random() * 120, FW_COLS[q % FW_COLS.length], 6 + nb * 2); if (q % 2 === 0) A.play('burst', { size: 5 }); });
      });
      for (const id of interIds) {
        const vp = B.vis.get(id);
        if (!vp) continue;
        if (vp.k === 'y') continue;
        sch.gone[id] = { t: ringT + 0.18, kind: 'harvest', dur: 0.3 };
      }
      tEnd = ringT + 0.3;
    }
    // 出来事ごとに 時間を わりあてる
    let hitT = tEnd + 0.05, stage = 0, lastHit = {};
    const friendsNew = [];
    for (const e of ev) {
      if (e.e === 'befriend') {
        const tt = ringT + 0.32;
        sch.gone[e.id] = { t: tt, kind: 'befriend', dur: 0.1 };
        const p = cpos(e.idx);
        friendsNew.push(e.sp);
        B.at(tt, () => befriendFx(e.sp, p.x, p.y));
        tEnd = Math.max(tEnd, tt + 0.6);
      } else if (e.e === 'burn') {
        const tt = interIds.includes(e.id) ? ringT + 0.18 : tEnd;
        sch.gone[e.id] = { t: tt, kind: 'burn', dur: 0.35 };
        B.at(tt, () => { const p = cpos(e.idx); sparks(p.x, p.y, '#ffa040', 10, 140, { life: 0.5 }); });
      } else if (e.e === 'onibiBurst') {
        stage++;
        const tt = hitT + stage * 0.32 - 0.12;
        const p = cpos(e.idx);
        B.at(tt, () => { ringWave(p.x, p.y, '#7ad8ff', 90, 0.45); sparks(p.x, p.y, '#9ae8ff', 18, 260, { life: 0.5 }); A.play('burst', { size: 2 }); });
      } else if (e.e === 'hit') {
        const tt = hitT + stage * 0.32;
        lastHit[e.id] = tt;
        const vp = B.vis.get(e.id);
        B.at(tt, () => {
          const p = cpos(e.idx);
          if (vp) { vp.hitT = G.t; vp.hp = e.hp; }
          A.play('hit');
          addText(p.x, p.y - 30, '-' + e.dmg, { col: '#ff8a7a', size: 26, pop: true });
          sparks(p.x, p.y, '#ffd0a0', 8, 150, { life: 0.4 });
        });
        tEnd = Math.max(tEnd, tt + 0.2);
      } else if (e.e === 'defeat') {
        const tt = (lastHit[e.id] || hitT) + 0.16;
        sch.gone[e.id] = { t: tt, kind: 'defeat', dur: 0.45 };
        sch.appear[e.drop] = { t: tt + 0.15, kind: 'pop' };
        B.at(tt, () => { const p = cpos(e.idx); A.play('defeat'); doron(p.x, p.y); addText(p.x, p.y - 8, 'おいはらった', { col: '#ffe8b0', size: 16, delay: 0.1 }); });
        tEnd = Math.max(tEnd, tt + 0.4);
      } else if (e.e === 'bossHit') {
        const tt = t0 + n * dt + 0.55;
        B.at(tt, () => {
          B.disp.bossHp = e.hp;
          B.bossAnim = { t: G.t, kind: 'hit' };
          A.play('bossHit');
          addText(BOSS.x + 90, BOSS.y + 30, '-' + e.dmg, { col: '#ffb0a0', size: 30, pop: true });
          if (e.byFriends) addText(BOSS.x - 110, BOSS.y + 40, 'ともだちが くすぐった！', { col: '#ffd0ec', size: 17 });
          B.shake = Math.max(B.shake, 5);
        });
        tEnd = Math.max(tEnd, tt + 0.3);
      } else if (e.e === 'heal') {
        const tt = tEnd + 0.02;
        const last = cpos(path[path.length - 1]);
        const nIcons = Math.min(6, Math.max(1, Math.ceil(e.raw / 2)));
        for (let q = 0; q < nIcons; q++) fly('heart', last.x, last.y, HUD.hp.x, HUD.hp.y, tt - G.t + q * 0.05, 0.5);
        B.at(tt + 0.5, () => {
          B.disp.hp = B.P.hp; A.play('heal'); yuiMood('happy', 0.8);
          addText(HUD.hp.x + 120, HUD.hp.y - 26, e.n > 0 ? '+' + e.n : 'まんぷく', { col: '#a8ff9a', size: 22 });
        });
      } else if (e.e === 'coins') {
        const tt = tEnd + 0.04;
        const last = cpos(path[path.length - 1]);
        const nIcons = Math.min(8, Math.max(1, Math.ceil(e.n / 2)));
        for (let q = 0; q < nIcons; q++) fly('coin', last.x, last.y, HUD.coin.x, HUD.coin.y, tt - G.t + q * 0.04, 0.55);
        B.at(tt + 0.55, () => { B.disp.coins = B.P.coins; A.play('coin', { n: e.n }); addText(HUD.coin.x + 60, HUD.coin.y - 24, '+' + e.n, { col: '#ffe08a', size: 20 }); });
      }
    }
    if (type === 'H' && info.sparks) {
      for (const [p, j] of info.sparks) {
        const tt = popT[p] + 0.02, a = cpos(p), b = cpos(j);
        B.at(tt, () => B.fx.push({ k: 'beam', x0: a.x, y0: a.y, x1: b.x, y1: b.y, t0: G.t, dur: 0.22 }));
      }
    }
    syncVis(sch);
    const won = st.outcome === 'win';
    const endT = Math.max(tEnd, t0 + n * dt + 0.25) + 0.12;
    if (won) { B.at(endT, () => refillOnly()); B.at(endT + 0.35, startWin); }
    else B.at(endT, doSettle);
  }

  function befriendFx(sp, x, y) {
    A.play('befriend');
    yuiMood('happy', 1.2);
    B.cheer = G.t;
    for (let k = 0; k < 6; k++) B.fx.push({ k: 'heart', x: x + (Math.random() - 0.5) * 30, y, vy: -60 - Math.random() * 50, vx: (Math.random() - 0.5) * 60, t0: G.t + k * 0.05, dur: 0.9 });
    B.fx.push({ k: 'friend', sp, x0: x, y0: y, x1: 60 + (Object.keys(B.P.friends).length % 9) * 36, y1: 668, t0: G.t, dur: 0.9 });
    const first = !B.bookBefore[sp] && !(B.newSpecies || []).includes(sp);
    G.addBook(sp);
    if (first) { (B.newSpecies = B.newSpecies || []).push(sp); B.at(G.t + 0.5, () => { A.play('newFriend'); addText(x, y - 50, 'はじめての ともだち！', { col: '#ffd0ec', size: 18, dur: 1.4 }); }); }
  }

  function doSettle() {
    const st = B.st;
    const ev = S.settle(st);
    const sch = { appear: {}, gone: {}, move: {} };
    let fallEnd = G.t;
    let spawnT = null;
    for (const e of ev) {
      if (e.e === 'fall') {
        for (const m of e.moves) { const dur = 0.13 + 0.05 * Math.sqrt(m.to - m.from) * 2; sch.move[m.id] = { t: G.t, dur, ease: 'fall' }; fallEnd = Math.max(fallEnd, G.t + dur); }
        for (const nw of e.news) { const dur = 0.13 + 0.05 * Math.sqrt(nw.to - nw.from) * 2; sch.appear[nw.id] = { t: G.t, kind: 'none', from: [nw.x, nw.from], dur }; fallEnd = Math.max(fallEnd, G.t + dur); }
      }
    }
    for (const e of ev) {
      if (e.e === 'spawn') {
        const tt = (spawnT = fallEnd + 0.08);
        sch.appear[e.id] = { t: tt, kind: 'doron' };
        if (e.replaced) sch.gone[e.replaced] = { t: tt, kind: 'doron', dur: 0.2 };
        const p = cpos(e.idx);
        B.at(tt, () => { A.play('doron'); doron(p.x, p.y); });
        for (const L of e.lanterns || []) {
          sch.appear[L.id] = { t: tt + 0.35, kind: 'morph' };
          if (L.old) sch.gone[L.old] = { t: tt + 0.35, kind: 'morph', dur: 0.15 };
          B.at(tt + 0.35, () => A.play('lantern'));
        }
        if (D.SPECIES[e.sp].rare) B.at(tt + 0.1, () => addText(p.x, p.y - 44, 'めずらしい妖！', { col: '#fff0a0', size: 20, dur: 1.4, pop: true }));
      } else if (e.e === 'shuffle') {
        const tt = fallEnd + 0.1;
        for (const id of e.olds || []) sch.gone[id] = { t: tt, kind: 'fade', dur: 0.25 };
        sch.defT = tt + 0.25; sch.defKind = 'pop';
        B.at(tt, () => { A.play('shuffle'); B.tip = { text: 'つなげる玉が なくなったので、まぜなおした。', t0: G.t }; });
        fallEnd = tt + 0.4;
      }
    }
    syncVis(sch);
    const next = spawnT ? spawnT + 0.45 : fallEnd + 0.05;
    B.at(next, doEnemies);
  }

  // 勝ったあとも 盤は うめておく（見た目だけ）
  function refillOnly() {
    const ev = S.settle(B.st);
    const sch = { appear: {}, gone: {}, move: {} };
    for (const e of ev) if (e.e === 'fall') {
      for (const m of e.moves) sch.move[m.id] = { t: G.t, dur: 0.13 + 0.1 * Math.sqrt(m.to - m.from), ease: 'fall' };
      for (const nw of e.news) sch.appear[nw.id] = { t: G.t, kind: 'none', from: [nw.x, nw.from], dur: 0.13 + 0.1 * Math.sqrt(nw.to - nw.from) };
    }
    syncVis(sch);
  }
  function doEnemies() {
    const st = B.st;
    const pre = new Map();
    for (const i of S.yokaiList(st)) pre.set(st.cells[i].id, { cd: st.cells[i].cd, fresh: st.cells[i].fresh });
    const ev = S.enemies(st);
    const sch = { appear: {}, gone: {}, move: {} };
    let tc = G.t + 0.08, impact = tc;
    const acted = new Set(ev.filter(e => e.e === 'act' || e.e === 'flee').map(e => e.id));
    // 数字を へらす（うごく妖は 0 を 見せてから もどす）
    for (const [id, p] of pre) {
      const vp = B.vis.get(id);
      if (!vp) continue;
      if (p.fresh) continue;
      const i = S.findPiece(st, id);
      const now = i >= 0 ? st.cells[i].cd : 0;
      if (acted.has(id)) { vp.cd = 0; vp.pendingCd = now; } else vp.cd = now;
      vp.tick = G.t;
    }
    for (const e of ev) {
      if (e.e === 'hop') {
        sch.move[e.id] = { t: tc, dur: 0.3, ease: 'hop' };
        sch.move[e.swap] = { t: tc, dur: 0.3, ease: 'slide' };
        B.at(tc, () => A.play('step'));
        tc += 0.12;
      } else if (e.e === 'act') {
        const vp = B.vis.get(e.id);
        const p = cpos(e.idx);
        const at = tc;
        impact = tc + 0.26;
        B.at(at, () => { if (vp) { vp.act = G.t; vp.cd = vp.pendingCd != null ? 0 : vp.cd; } A.play('act'); });
        if (e.kind === 'hit') B.at(at + 0.05, () => B.fx.push({ k: 'shot', x0: p.x, y0: p.y, x1: YUI.x, y1: YUI.y - 30, t0: G.t, dur: 0.2, sp: D.SPECIES[B.vis.get(e.id) ? B.vis.get(e.id).sp : 'mame'] }));
        if (e.kind === 'steal') {
          B.at(impact, () => { A.play('steal'); for (let q = 0; q < 3; q++) fly('coin', HUD.coin.x, HUD.coin.y, p.x, p.y, q * 0.06, 0.45); });
        }
        if (e.kind === 'grow') B.at(impact, () => { A.play('grow'); if (vp) { vp.hp = e.hp; vp.grow = G.t; } addText(p.x, p.y - 36, 'のびた！', { col: '#c8f0a0', size: 16 }); });
        if (e.kind === 'azuki' || e.kind === 'chochin') {
          for (const q of e.put) {
            sch.appear[q.id] = { t: impact, kind: 'morph' };
            if (q.old) sch.gone[q.old] = { t: impact, kind: 'morph', dur: 0.15 };
          }
          B.at(impact, () => A.play(e.kind === 'chochin' ? 'lantern' : 'junk'));
        }
        B.at(impact + 0.15, () => { if (vp && vp.pendingCd != null) { vp.cd = vp.pendingCd; vp.pendingCd = null; } });
        tc += 0.4;
      } else if (e.e === 'hurt') {
        const tt = impact;
        B.at(tt, () => {
          B.disp.hp = e.hp; A.play('hurt'); yuiMood('hurt', 0.55); B.shake = Math.max(B.shake, 7); B.hurtFlash = G.t;
          addText(YUI.x + 50, YUI.y - 90, '-' + e.n, { col: '#ff6a6a', size: 30, pop: true });
        });
      } else if (e.e === 'blocked') {
        B.at(impact, () => { B.disp.blocks = e.left; A.play('blocked'); addText(YUI.x + 40, YUI.y - 90, 'ふせいだ！', { col: '#e8f0ff', size: 22, pop: true }); ringWave(YUI.x, YUI.y - 20, '#ffffff', 80, 0.4); });
      } else if (e.e === 'stolen') {
        B.at(impact + 0.3, () => { B.disp.coins = e.coins; addText(HUD.coin.x + 60, HUD.coin.y - 24, '-' + e.n, { col: '#ffb070', size: 20 }); });
      } else if (e.e === 'flee') {
        const p = cpos(e.idx);
        sch.gone[e.id] = { t: tc, kind: 'flee', dur: 0.7 };
        sch.appear[e.newTile] = { t: tc + 0.35, kind: 'pop' };
        B.at(tc, () => { A.play('flee'); addText(p.x, p.y - 40, 'にげてしまった…', { col: '#d8e0ff', size: 18, dur: 1.4 }); });
        tc += 0.7;
      } else if (e.e === 'bossAct') {
        const at = tc;
        impact = tc + 0.38;
        B.at(at, () => { B.bossAnim = { t: G.t, kind: 'act' }; A.play('boss'); B.shake = Math.max(B.shake, 6); });
        B.at(at + 0.12, () => B.fx.push({ k: 'shot', x0: BOSS.x, y0: BOSS.y + 40, x1: YUI.x, y1: YUI.y - 30, t0: G.t, dur: 0.26, big: true }));
        tc += 0.62;
      } else if (e.e === 'junk') {
        for (const q of e.put) { sch.appear[q.id] = { t: tc, kind: 'morph' }; if (q.old) sch.gone[q.old] = { t: tc, kind: 'morph', dur: 0.15 }; }
        const name = { leaf: '葉っぱに ばけた！', bubble: '泡で つつんだ！', rock: '石に なった！' }[e.t] || '';
        B.at(tc, () => { A.play('junk'); addText(BOSS.x - 250, BOSS.y + 30, name, { col: '#e0f0c0', size: 20, rise: 20 }); for (const q of e.put) { const p = cpos(q.idx); sparks(p.x, p.y, '#c0e0a0', 6, 100); } });
        tc += 0.4;
      } else if (e.e === 'gust') {
        for (const m of e.moves) {
          const wrap = Math.abs(S.cx(m.from) - S.cx(m.to)) > 1;
          sch.move[m.id] = { t: tc, dur: 0.38, ease: 'slide', wrap };
        }
        B.at(tc, () => { A.play('gust'); B.fx.push({ k: 'wind', y: BY + (e.row + 0.5) * C, dir: e.dir, t0: G.t, dur: 0.6 }); addText(BOSS.x - 250, BOSS.y + 30, 'うちわの 風！', { col: '#d0f0ff', size: 20, rise: 20 }); });
        tc += 0.55;
      } else if (e.e === 'summon') {
        B.at(tc, () => addText(BOSS.x - 250, BOSS.y - 10, D.SPECIES[e.sp].name + 'を よんだ！', { col: '#ffe0c0', size: 18, rise: 20 }));
        tc += 0.25;
      } else if (e.e === 'bossPhase') {
        B.at(tc, () => { A.play('boss'); B.tip = { text: '大鬼が 本気に なった！ たいこが はやくなり、玉を 石に かえてくる。', t0: G.t }; });
        tc += 0.5;
      }
    }
    syncVis(sch);
    B.at(tc + 0.12, () => {
      if (st.outcome === 'lose') startLose();
      else startInput();
    });
  }

  // ================================================================ 勝ち・負け
  function startWin() {
    B.phase = 'won';
    const st = B.st;
    A.play('win');
    yuiMood('happy', 3);
    for (let k = 0; k < 6; k++) B.at(G.t + k * 0.22, () => { skyBurst(200 + Math.random() * 880, 70 + Math.random() * 120, FW_COLS[k % FW_COLS.length], 8); A.play('burst', { size: 6 }); });
    B.fx.push({ k: 'banner', text: st.boss ? 'ぬしが おとなしく なった' : 'おさまった！', t0: G.t, dur: 1.8 });
    if (st.boss) {
      // ぬしの まわりの妖も ついてくる
      for (const vp of B.vis.values()) if (vp.k === 'y' && !vp.gone) { vp.gone = { t: G.t + 0.3, kind: 'befriend', dur: 0.1 }; const p = gpos(vp.x, vp.y); B.at(G.t + 0.3, () => befriendFx(vp.sp, p.x, p.y)); }
      B.at(G.t + 0.5, () => { A.play('calm'); befriendBossFx(); });
      B.at(G.t + 2.0, () => startTalk(D.BOSS_TALK[st.boss.sp].after, showResult, true));
    } else B.at(G.t + 1.5, showResult);
  }
  function befriendBossFx() {
    const sp = B.st.boss.sp;
    const first = !B.bookBefore[sp];
    G.addBook(sp);
    if (first) (B.newSpecies = B.newSpecies || []).push(sp);
    B.bossCalm = G.t;
    for (let k = 0; k < 16; k++) B.fx.push({ k: 'heart', x: BOSS.x + (Math.random() - 0.5) * 200, y: BOSS.y + 40, vy: -40 - Math.random() * 60, vx: (Math.random() - 0.5) * 80, t0: G.t + k * 0.06, dur: 1.2 });
  }
  function showResult() {
    const st = B.st;
    const fr = {};
    for (const sp of st.gained.friends) fr[sp] = (fr[sp] || 0) + 1;
    const newPerk = Object.keys(fr).filter(sp => !(B.friendsBefore[sp] > 0) && D.SPECIES[sp].perk !== 'none');
    B.result = { coins: st.gained.coins, friends: fr, newSpecies: (B.newSpecies || []).slice(), newPerk, turns: st.turn, t: G.t };
    B.phase = 'result';
    G.store();
  }
  function finishBattle() {
    const run = G.run();
    run.P = B.P;
    run.stats.friendsMade = (run.stats.friendsMade || 0) + B.st.gained.friends.length;
    run.time = (run.time || 0) + (G.t - B.startT);
    const last = B.bid === 'a4boss';
    G.advance();
    G.store();
    if (last) G.go('ending');
    else G.go('map');
  }
  function startLose() {
    B.phase = 'lost';
    A.play('lose');
    yuiMood('hurt', 99);
    B.lostT = G.t;
  }
  function retry() {
    const P = JSON.parse(JSON.stringify(B.snapP));
    P.friends = Object.assign({}, B.P.friends);
    const mx = S.stats(P).maxHp;
    P.hp = Math.max(B.snapP.hp, Math.ceil(mx * 0.6));
    G.run().time = (G.run().time || 0) + (G.t - B.startT);
    G.store();
    G.go('battle', { bid: B.bid, attempt: B.attempt, snapP: B.snapP, P });
  }
  B.retry = retry;

  function startTalk(lines, cb, after) {
    B.phase = 'talk';
    B.talk = { lines, i: 0, cb, t0: G.t, after };
  }
  function talkNext() {
    const tk = B.talk;
    if (!tk) return;
    if (G.t - tk.t0 < 0.25) return;
    A.play('ui');
    tk.i++; tk.t0 = G.t;
    if (tk.i >= tk.lines.length) { B.talk = null; tk.cb(); }
  }

  // ================================================================ ヒント
  function scoreHint(info, st) {
    let s = 0;
    for (const id of info.befriend) { const i = S.findPiece(st, id); s += D.SPECIES[st.cells[i].sp].rare ? 90 : 45; }
    if (info.type === 'H') {
      for (const tg of info.targets) {
        const y = st.cells[tg.idx], sp = D.SPECIES[y.sp];
        if (sp.rare) { s -= tg.kill ? 60 : 8; continue; }
        const danger = (y.cd <= 1 ? 2 : 1) * Math.max(1, sp.atk);
        s += tg.kill ? 12 + danger * 4 + y.hp * 2 : Math.min(tg.dmg, y.hp) * 3 + danger;
      }
      s += info.bossDmg * 1.2;
    }
    if (info.healRaw) s += info.heal * (st.P.hp <= st.S.maxHp * 0.45 ? 3.2 : 1);
    s += info.coins * (st.P.coins < 50 ? 0.45 : 0.15) + info.burn.length * 1.5 + info.count * 0.12;
    return s;
  }
  function showHint() {
    if (B.phase !== 'input') return;
    const best = S.searchChains(B.st, scoreHint, { budget: 12000 });
    if (best) { B.hint = { path: best.path, closed: best.closed, t0: G.t }; A.play('ui'); }
  }
  B.showHint = showHint;

  // ================================================================ 毎フレーム
  function update(dt) {
    runTimers();
    B.shake = Math.max(0, B.shake - dt * 30);
    if (B.phase === 'input' && !B.chain) {
      const idle = G.t - B.turnStart;
      if (!B.idleHinted && B.area === 1 && idle > 14) { B.idleHinted = true; showHint(); }
    }
    // 演出の 掃除
    B.fx = B.fx.filter(f => G.t < f.t0 + f.dur + 0.05 || (f.k === 'rocket' && !f.done));
    B.sky = B.sky.filter(p => G.t < p.t0 + p.dur);
    for (const [id, vp] of B.vis) if (vp.gone && G.t > vp.gone.t + vp.gone.dur + 0.05) B.vis.delete(id);
    // 数字の なめらかな 表示
    B.hpShown += (B.disp.hp - B.hpShown) * Math.min(1, dt * 8);
    B.bossShown += (B.disp.bossHp - B.bossShown) * Math.min(1, dt * 6);
  }

  // ================================================================ 描く
  function draw(c) {
    const st = B.st;
    const sx = B.shake ? (Math.random() - 0.5) * B.shake : 0, sy = B.shake ? (Math.random() - 0.5) * B.shake : 0;
    c.save(); c.translate(sx, sy);
    const bg = R.background(B.area);
    c.drawImage(bg.cv, 0, 0, W, H);
    R.bgAnim(c, B.area, G.t);
    drawSky(c);
    if (st.boss) drawBoss(c);
    drawBoard(c);
    drawPieces(c);
    drawChain(c);
    drawHintPath(c);
    drawFx(c, false);
    c.restore();
    drawLeft(c);
    drawRight(c);
    drawFx(c, true);
    if (B.tip && B.phase !== 'result') drawTip(c);
    if (B.phase === 'intro') drawIntro(c);
    if (B.talk) drawTalk(c);
    if (B.phase === 'result') drawResult(c);
    if (B.phase === 'lost') drawLost(c);
    if (B.hurtFlash && G.t - B.hurtFlash < 0.25) { c.fillStyle = 'rgba(255,40,40,' + (0.18 * (1 - (G.t - B.hurtFlash) / 0.25)) + ')'; c.fillRect(0, 0, W, H); }
  }

  function drawSky(c) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const p of B.sky) {
      const u = (G.t - p.t0) / p.dur;
      if (u < 0) continue;
      if (p.flash) {
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(255,255,255,' + (0.5 * (1 - u)) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
        continue;
      }
      const tt = G.t - p.t0;
      const dr = 1 - Math.exp(-tt * 3.2);
      const x = p.x + p.vx * dr * 0.32, y = p.y + p.vy * dr * 0.32 + tt * tt * 26;
      const a = (1 - u) * (u > 0.7 ? (0.5 + 0.5 * Math.sin(tt * 40)) : 1);
      c.fillStyle = p.col; c.globalAlpha = Math.max(0, a);
      c.beginPath(); c.arc(x, y, p.r * (1 - u * 0.5), 0, TAU); c.fill();
      // 尾
      c.globalAlpha = Math.max(0, a * 0.35);
      c.beginPath(); c.arc(x - p.vx * 0.012, y - p.vy * 0.012, p.r * 0.7, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    c.restore();
  }

  function drawBoss(c) {
    const b = B.st.boss;
    const an = B.bossAnim;
    let dy = 0, sxx = 1, syy = 1, flash = 0;
    if (an) {
      const u = (G.t - an.t);
      if (an.kind === 'act' && u < 0.5) { dy = -Math.sin(u / 0.5 * Math.PI) * 18; sxx = 1 + Math.sin(u / 0.5 * Math.PI) * 0.06; }
      if (an.kind === 'hit' && u < 0.3) { flash = 1 - u / 0.3; dy = Math.sin(u * 60) * 3; }
    }
    const calm = B.bossCalm != null;
    c.save();
    const glow = c.createRadialGradient(BOSS.x, BOSS.y + 20, 20, BOSS.x, BOSS.y + 20, 200);
    glow.addColorStop(0, calm ? 'rgba(255,220,160,0.25)' : 'rgba(255,80,80,0.18)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow; c.fillRect(BOSS.x - 220, BOSS.y - 180, 440, 400);
    R.drawYokai(c, b.sp, BOSS.x, BOSS.y + 10, BOSS.s, G.t, { dy, sx: sxx, sy: syy, flash, shadow: false, calm, happy: calm, seed: 3 });
    c.restore();
    // 体力
    const bw = 300, bx = BOSS.x - bw / 2, by = BY - 26;
    R.rr(c, bx - 4, by - 4, bw + 8, 22, 11); c.fillStyle = 'rgba(10,6,16,0.85)'; c.fill();
    const frac = clamp(B.bossShown / b.mhp, 0, 1);
    R.rr(c, bx, by, bw * frac, 14, 7);
    const g = c.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#ff7a5a'); g.addColorStop(1, '#ffc04a');
    c.fillStyle = g; c.fill();
    if (B.chain && B.chain.info && B.chain.info.bossDmg) {
      const f2 = clamp((B.disp.bossHp - B.chain.info.bossDmg) / b.mhp, 0, 1);
      R.rr(c, bx + bw * f2, by, bw * (frac - f2), 14, 7); c.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.3 * Math.sin(G.t * 10)) + ')'; c.fill();
    }
    R.text(c, D.SPECIES[b.sp].name + '　' + Math.ceil(B.disp.bossHp) + ' / ' + b.mhp, BOSS.x, by - 14, { size: 15, stroke: 'rgba(0,0,0,0.8)', sw: 4 });
    // ぬしの 数字
    const cdx = BOSS.x + 150, cdy = BOSS.y - 10;
    drawCountdown(c, cdx, cdy, b.cd, b.cdMax, false, 1.3);
  }

  function drawBoard(c) {
    const x = BX - 12, y = BY - 12, w = C * BN + 24, h = C * BN + 24;
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 24; c.shadowOffsetY = 8;
    R.rr(c, x, y, w, h, 18); c.fillStyle = 'rgba(14,8,18,0.78)'; c.fill();
    c.restore();
    R.rr(c, x, y, w, h, 18); c.lineWidth = 3; c.strokeStyle = 'rgba(200,60,50,0.8)'; c.stroke();
    R.rr(c, x + 5, y + 5, w - 10, h - 10, 14); c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,214,150,0.35)'; c.stroke();
    // マス
    for (let yy = 0; yy < BN; yy++) for (let xx = 0; xx < BN; xx++) {
      R.rr(c, BX + xx * C + 3, BY + yy * C + 3, C - 6, C - 6, 10);
      c.fillStyle = (xx + yy) % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.045)'; c.fill();
    }
    // なぞれる場所の ほのかな 光（なぞっている型と 同じ玉）
    if (B.chain) {
      const ch = B.chain;
      const last = ch.path[ch.path.length - 1];
      if (!ch.closed) for (const j of S.neighbors8(last)) {
        const r = S.tryStep(B.st, ch.path, false, j);
        if (r === 'add' || r === 'close') {
          const p = cpos(j);
          R.rr(c, p.x - C / 2 + 4, p.y - C / 2 + 4, C - 8, C - 8, 10);
          c.fillStyle = r === 'close' ? 'rgba(255,224,130,0.22)' : 'rgba(255,255,255,0.08)'; c.fill();
        }
      }
    } else if (B.phase === 'input' && B.hover >= 0 && S.canStart(B.st, B.hover)) {
      const p = cpos(B.hover);
      R.rr(c, p.x - C / 2 + 3, p.y - C / 2 + 3, C - 6, C - 6, 10); c.lineWidth = 2; c.strokeStyle = 'rgba(255,240,200,0.5)'; c.stroke();
    }
  }

  function drawPieces(c) {
    const st = B.st;
    c.save();
    R.rr(c, BX - 4, BY - 4, C * BN + 8, C * BN + 8, 12); c.clip();
    const inChain = new Set(B.chain ? B.chain.path : []);
    const interior = new Set(B.chain && B.chain.info ? B.chain.info.interior : []);
    // 玉・おじゃま
    const yokai = [];
    for (const vp of B.vis.values()) {
      if (vp.k === 'y') { yokai.push(vp); continue; }
      drawTileVp(c, vp, inChain, interior);
    }
    c.restore();
    // 妖は 盤の 上に（はみだして よい）
    yokai.sort((a, b) => a.y - b.y);
    for (const vp of yokai) drawYokaiVp(c, vp, interior);
  }

  function appearScale(vp) {
    const ap = vp.appear;
    if (!ap) return 1;
    const u = (G.t - ap.t);
    if (u < 0) return ap.kind === 'none' ? 1 : 0;
    if (ap.kind === 'none') return 1;
    if (ap.kind === 'fade') return 1;
    const d = ap.kind === 'doron' ? 0.35 : 0.25;
    if (u >= d) return 1;
    const x = u / d;
    return 1 + Math.sin(x * Math.PI) * 0.18 - (1 - x) * (1 - x) * 1;
  }
  function drawTileVp(c, vp, inChain, interior) {
    const [x, y, wrapA] = curPos(vp);
    const p = gpos(x, y);
    let sc = appearScale(vp), al = 1;
    if (vp.appear && vp.appear.kind === 'fade') al = clamp((G.t - vp.appear.t) / 0.2, 0, 1);
    if (vp.appear && G.t < vp.appear.t && vp.appear.kind !== 'none') return;
    if (wrapA) al *= 1 - wrapA;
    if (vp.gone && G.t >= vp.gone.t) {
      const u = clamp((G.t - vp.gone.t) / vp.gone.dur, 0, 1);
      const k = vp.gone.kind;
      if (k === 'pop') { sc *= 1 + u * 0.35; al *= 1 - u; }
      else if (k === 'harvest') { sc *= 1 - u * 0.8; al *= 1 - u * 0.6; }
      else if (k === 'burn') { sc *= 1 - u * 0.6; al *= 1 - u; }
      else if (k === 'morph') { sc *= 1 - u; }
      else if (k === 'doron') { sc *= 1 - u; al *= 1 - u; }
      else al *= 1 - u;
      if (al <= 0.01 || sc <= 0.02) return;
    }
    const idx = S.idx(Math.round(x), Math.round(y));
    let lift = 0;
    const id = vp.id;
    const cellNow = B.st.cells[idx];
    const isChain = cellNow && cellNow.id === id && inChain.has(idx);
    if (isChain) { sc *= 1.08 + 0.03 * Math.sin(G.t * 12 + idx); lift = -3; }
    if (vp.k === 't') {
      // 輪の中は 輪の色に 光る
      if (cellNow && cellNow.id === id && interior.has(idx)) {
        const tc = R.TCOL[B.chain.info.type || 'L'];
        c.save(); c.globalAlpha = 0.45 + 0.25 * Math.sin(G.t * 8); R.rr(c, p.x - C / 2 + 2, p.y - C / 2 + 2, C - 4, C - 4, 12); c.fillStyle = tc.rim; c.fill(); c.restore();
      }
      R.drawTile(c, vp.t, p.x, p.y + lift, C, sc, al);
      if (B.chain && !isChain && cellNow && cellNow.id === id && !interior.has(idx)) {
        const ty = S.chainType(B.st, B.chain.path);
        if (ty && vp.t !== ty && vp.t !== 'L') { R.rr(c, p.x - C / 2 + 4, p.y - C / 2 + 4, C - 8, C - 8, 10); c.fillStyle = 'rgba(8,4,14,0.45)'; c.fill(); }
      }
    } else R.drawJunk(c, vp.t, p.x, p.y, C, sc, al);
  }

  function drawCountdown(c, x, y, cd, cdMax, rare, scale) {
    scale = scale || 1;
    const r = 13 * scale;
    const warn = cd <= 1;
    c.save();
    if (warn && !rare) { c.shadowColor = 'rgba(255,60,60,0.9)'; c.shadowBlur = 10 + 6 * Math.sin(G.t * 10); }
    c.beginPath(); c.arc(x, y, r, 0, TAU);
    c.fillStyle = rare ? '#3a6ad8' : (warn ? '#e0302a' : '#2a1a22'); c.fill();
    c.lineWidth = 2; c.strokeStyle = rare ? '#d0e0ff' : (warn ? '#ffd0c0' : '#ffb070'); c.stroke();
    c.restore();
    R.text(c, String(Math.max(0, cd)), x, y + 1, { size: Math.round(16 * scale), color: '#fff' });
  }

  function drawYokaiVp(c, vp, interior) {
    const [x, y] = curPos(vp);
    const p = gpos(x, y);
    const sp = D.SPECIES[vp.sp];
    let sc = appearScale(vp), al = 1, dy = 0, rot = 0, flash = 0;
    if (vp.appear && G.t < vp.appear.t) return;
    if (vp.gone && G.t >= vp.gone.t) {
      const u = clamp((G.t - vp.gone.t) / vp.gone.dur, 0, 1);
      const k = vp.gone.kind;
      if (k === 'befriend') return;
      if (k === 'defeat') { sc *= 1 - u; rot = u * 4; al = 1 - u; }
      else if (k === 'flee') { dy = -u * 70; al = 1 - u; }
      else { al = 1 - u; }
      if (al <= 0.01) return;
    }
    const hitU = G.t - vp.hitT;
    if (hitU < 0.25) { flash = 1 - hitU / 0.25; p.x += Math.sin(hitU * 80) * 4; }
    const actU = G.t - vp.act;
    if (actU < 0.4) { dy -= Math.sin(actU / 0.4 * Math.PI) * 16; }
    const idx = S.idx(Math.round(x), Math.round(y));
    const cellNow = B.st.cells[idx];
    const live = cellNow && cellNow.id === vp.id && !vp.gone;
    const inRing = live && interior.has(idx);
    // かこめる しるし（紅白の 光）
    if (live && B.phase === 'input' && B.ringIds.has(vp.id) && !B.chain) {
      c.save();
      c.lineWidth = 3; c.setLineDash([7, 7]); c.lineDashOffset = -G.t * 30;
      c.strokeStyle = 'rgba(255,90,90,0.8)'; c.beginPath(); c.arc(p.x, p.y + 2, C * 0.46, 0, TAU); c.stroke();
      c.lineDashOffset = -G.t * 30 + 7; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(p.x, p.y + 2, C * 0.46, 0, TAU); c.stroke();
      c.restore();
    }
    if (sp.rare && live) {
      const g = c.createRadialGradient(p.x, p.y, 4, p.x, p.y, C * 0.7);
      g.addColorStop(0, 'rgba(255,240,170,0.35)'); g.addColorStop(1, 'rgba(255,240,170,0)');
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, C * 0.7, 0, TAU); c.fill();
      for (let k = 0; k < 3; k++) { const a = G.t * 1.5 + k * 2.1; c.fillStyle = 'rgba(255,250,200,0.9)'; c.beginPath(); c.arc(p.x + Math.cos(a) * C * 0.42, p.y + Math.sin(a) * C * 0.3, 2, 0, TAU); c.fill(); }
    }
    c.save(); c.globalAlpha = al;
    const grow = vp.sp === 'takenoko' ? 0.85 + 0.15 * clamp((vp.mhp - 4) / 4, 0, 1) : 1;
    R.drawYokai(c, vp.sp, p.x, p.y + 2, C * 1.05 * grow, G.t, { sx: sc, sy: sc, dy, rot, flash, seed: vp.seed, happy: inRing });
    c.restore();
    if (!live) return;
    // 体力の 玉
    const hp = Math.max(0, vp.hp), mhp = vp.mhp || hp;
    const pipW = Math.min(11, 54 / Math.max(1, mhp));
    const tw = pipW * mhp;
    for (let k = 0; k < mhp; k++) {
      const xx = p.x - tw / 2 + k * pipW + pipW / 2, yy = p.y + C * 0.42;
      c.beginPath(); c.arc(xx, yy, Math.min(4.6, pipW * 0.44), 0, TAU);
      c.fillStyle = k < hp ? '#ff6a6a' : 'rgba(255,255,255,0.22)'; c.fill();
      c.lineWidth = 1; c.strokeStyle = 'rgba(40,0,10,0.8)'; c.stroke();
    }
    // こうげき（にげる）までの 数字
    drawCountdown(c, p.x + C * 0.36, p.y - C * 0.32, vp.cd, vp.cdMax, sp.rare);
    // 予告
    const info = B.chain && B.chain.info;
    if (info && info.valid) {
      const tg = info.targets.find(tq => tq.id === vp.id);
      if (tg) {
        c.save();
        const bob = Math.sin(G.t * 10) * 2;
        R.rr(c, p.x - 26, p.y - C * 0.62 + bob, 52, 24, 12); c.fillStyle = tg.kill ? '#e0302a' : 'rgba(40,10,20,0.9)'; c.fill();
        c.lineWidth = 2; c.strokeStyle = '#ffb0a0'; c.stroke();
        R.text(c, '-' + tg.dmg, p.x, p.y - C * 0.62 + 12 + bob, { size: 17, color: '#fff' });
        if (tg.kill) R.text(c, sp.rare ? 'にげちゃう' : 'おいはらう', p.x, p.y - C * 0.62 - 12 + bob, { size: 13, color: '#ffe0d0', stroke: 'rgba(0,0,0,0.8)', sw: 3 });
        c.restore();
      }
      if (inRing) {
        const bob = Math.sin(G.t * 8) * 3;
        R.heart(c, p.x, p.y - C * 0.6 + bob, 26, '#ff8ab8');
        R.text(c, 'ともだち', p.x, p.y - C * 0.6 - 20 + bob, { size: 14, color: '#ffe0f0', stroke: 'rgba(60,0,30,0.85)', sw: 3 });
      }
    }
  }

  // 紅白の ひも
  function cordPath(c, pts, closed, width, glow) {
    if (pts.length < 2 && !closed) return;
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    pts.forEach((p, k) => k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
    if (closed) c.closePath();
    if (glow) { c.shadowColor = glow; c.shadowBlur = 18; }
    c.lineWidth = width + 4; c.strokeStyle = 'rgba(40,0,10,0.6)'; c.stroke();
    c.shadowBlur = 0;
    c.lineWidth = width; c.strokeStyle = '#e0323a'; c.stroke();
    c.setLineDash([width * 0.9, width * 0.9]); c.lineDashOffset = -G.t * 20;
    c.strokeStyle = '#fff6ee'; c.stroke();
    c.restore();
  }
  function drawChain(c) {
    const ch = B.chain;
    if (!ch) return;
    const pts = ch.path.map(i => cpos(i));
    const info = ch.info;
    if (ch.closed) {
      c.save();
      c.beginPath(); pts.forEach((p, k) => k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath();
      c.fillStyle = 'rgba(255,220,120,' + (0.12 + 0.06 * Math.sin(G.t * 8)) + ')'; c.fill();
      c.restore();
    }
    // 指が つなげない マスの 上に あるときは、ひもを のばさず ✕ を 出す
    let blocked = -1;
    if (!ch.closed) {
      const hc = cellAt(G.mouse.x, G.mouse.y, 0.45);
      const last = ch.path[ch.path.length - 1];
      if (hc >= 0 && hc !== last && !ch.path.includes(hc)) {
        const r = S.tryStep(B.st, ch.path, false, hc);
        if (!r || r === 'full') blocked = hc;
      }
    }
    if (blocked >= 0) {
      cordPath(c, pts, false, 9, 'rgba(255,120,120,0.5)');
      const lp = pts[pts.length - 1];
      c.save(); c.setLineDash([4, 6]); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.beginPath(); c.moveTo(lp.x, lp.y); c.lineTo(G.mouse.x, G.mouse.y); c.stroke(); c.restore();
      const bp = cpos(blocked);
      c.save(); c.lineWidth = 5; c.lineCap = 'round'; c.strokeStyle = 'rgba(255,90,90,0.85)';
      c.beginPath(); c.moveTo(bp.x - 12, bp.y - 12); c.lineTo(bp.x + 12, bp.y + 12); c.moveTo(bp.x + 12, bp.y - 12); c.lineTo(bp.x - 12, bp.y + 12); c.stroke(); c.restore();
    } else {
      const tail = ch.closed ? pts : pts.concat([{ x: G.mouse.x, y: G.mouse.y }]);
      cordPath(c, tail, ch.closed, 9, ch.closed ? 'rgba(255,220,120,0.9)' : 'rgba(255,120,120,0.5)');
    }
    for (const p of pts) { c.beginPath(); c.arc(p.x, p.y, 7, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#e0323a'; c.stroke(); }
    // 数の ふきだし
    const last = pts[pts.length - 1];
    const cord = B.st.S.cord;
    const tc = info && info.type ? R.TCOL[info.type].rim : '#ffe7bd';
    const bx = G.mouse.x + 22, by = G.mouse.y - 44;
    let label = ch.path.length + ' / ' + cord;
    if (ch.closed) label = '輪 ×' + info.count;
    R.rr(c, bx - 6, by - 16, 92, 32, 16); c.fillStyle = ch.closed ? 'rgba(120,70,0,0.92)' : 'rgba(30,14,24,0.92)'; c.fill();
    c.lineWidth = 2; c.strokeStyle = tc; c.stroke();
    R.cord(c, bx + 12, by, 20);
    R.text(c, label, bx + 52, by + 1, { size: 17, color: '#fff' });
    if (ch.full && G.t - ch.full < 0.9) R.text(c, 'ひもが たりない', bx + 40, by - 30, { size: 15, color: '#ffd0a0', stroke: 'rgba(0,0,0,0.8)', sw: 3 });
    else if (!ch.closed && ch.path.length >= 3 && S.adj8(ch.path[0], ch.path[ch.path.length - 1]) && S.tryStep(B.st, ch.path, false, ch.path[0]) === 'close' && G.t % 1 < 0.7) {
      const p0 = pts[0];
      R.text(c, 'もどると 輪！', p0.x, p0.y - 40, { size: 15, color: '#fff0b0', stroke: 'rgba(60,30,0,0.9)', sw: 3 });
    }
  }
  function drawHintPath(c) {
    const h = B.hint || (B.tip && B.tip.guide && B.phase === 'input' && !B.chain ? { path: B.tip.guide, closed: !!B.tip.ring, t0: B.tip.t0, guide: true } : null);
    if (!h || B.chain || B.phase !== 'input') return;
    const u = G.t - h.t0;
    if (!h.guide && u > 4) { B.hint = null; return; }
    const pts = h.path.map(i => cpos(i));
    c.save();
    c.globalAlpha = 0.55 + 0.25 * Math.sin(G.t * 5);
    c.setLineDash([10, 10]); c.lineDashOffset = -G.t * 40;
    c.lineWidth = 6; c.strokeStyle = '#fff3c0'; c.lineCap = 'round';
    c.beginPath(); pts.forEach((p, k) => k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); if (h.closed) c.closePath(); c.stroke();
    c.setLineDash([]);
    for (const p of pts) { c.beginPath(); c.arc(p.x, p.y, C * 0.42, 0, TAU); c.lineWidth = 2; c.stroke(); }
    c.restore();
    // ゆびの 動き
    const loop = h.closed ? pts.concat([pts[0]]) : pts;
    const per = 0.45, tt = (u % (loop.length * per + 0.8)) / per;
    const k = Math.min(loop.length - 1, Math.floor(tt)), f = Math.min(1, tt - k);
    const a = loop[k], b = loop[Math.min(loop.length - 1, k + 1)];
    const fx = lerp(a.x, b.x, f), fy = lerp(a.y, b.y, f);
    c.save(); c.translate(fx + 10, fy + 14);
    c.fillStyle = '#ffe8d4'; c.strokeStyle = '#3a2418'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, 0, 9, 13, -0.3, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(-6, -14, 4, 9, -0.3, 0, TAU); c.fill(); c.stroke();
    c.restore();
  }

  function drawFx(c, top) {
    for (const f of B.fx) {
      const u = (G.t - f.t0) / f.dur;
      if (u < 0) continue;
      const isTop = f.k === 'fly' || f.k === 'friend' || f.k === 'banner';
      if (isTop !== top) continue;
      switch (f.k) {
        case 'p': {
          if (u > 1) break;
          const tt = G.t - f.t0;
          const x = f.x + f.vx * tt, y = f.y + f.vy * tt + 0.5 * f.g * tt * tt;
          c.globalAlpha = 1 - u; c.fillStyle = f.col;
          c.beginPath(); c.arc(x, y, f.r * (1 - u * 0.5), 0, TAU); c.fill(); c.globalAlpha = 1;
          break;
        }
        case 'text': {
          if (u > 1) break;
          const pop = f.pop ? (u < 0.15 ? 0.6 + u / 0.15 * 0.6 : (u < 0.25 ? 1.2 - (u - 0.15) * 2 : 1)) : 1;
          c.globalAlpha = Math.min(1, (1 - u) * 3);
          c.save(); c.translate(f.x, f.y - f.rise * Math.min(1, u * 1.5)); c.scale(pop, pop);
          R.text(c, f.text, 0, 0, { size: f.size, color: f.col, stroke: f.stroke, sw: 5 });
          c.restore(); c.globalAlpha = 1;
          break;
        }
        case 'wave': {
          if (u > 1) break;
          c.globalAlpha = (1 - u) * 0.8; c.lineWidth = 4 * (1 - u) + 1; c.strokeStyle = f.col;
          c.beginPath(); c.arc(f.x, f.y, f.r1 * (0.2 + 0.8 * Math.sqrt(u)), 0, TAU); c.stroke(); c.globalAlpha = 1;
          break;
        }
        case 'rocket': {
          if (u >= 1) { if (!f.done) { f.done = true; skyBurst(f.x1, f.y1, f.col, f.size); if (Math.random() < 0.5) A.play('burst', { size: f.size }); } break; }
          const e = 1 - Math.pow(1 - u, 2);
          const x = lerp(f.x0, f.x1, e), y = lerp(f.y0, f.y1, e);
          c.save(); c.globalCompositeOperation = 'lighter';
          c.strokeStyle = 'rgba(255,220,160,0.6)'; c.lineWidth = 2;
          const e2 = Math.max(0, e - 0.12);
          c.beginPath(); c.moveTo(lerp(f.x0, f.x1, e2), lerp(f.y0, f.y1, e2)); c.lineTo(x, y); c.stroke();
          c.fillStyle = '#fff4d0'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
          c.restore();
          break;
        }
        case 'beam': {
          if (u > 1) break;
          c.save(); c.globalCompositeOperation = 'lighter';
          c.strokeStyle = 'rgba(255,200,120,' + (1 - u) + ')'; c.lineWidth = 4 * (1 - u) + 1;
          c.beginPath(); c.moveTo(f.x0, f.y0); c.lineTo(lerp(f.x0, f.x1, Math.min(1, u * 2.5)), lerp(f.y0, f.y1, Math.min(1, u * 2.5))); c.stroke();
          const hx = lerp(f.x0, f.x1, Math.min(1, u * 2.5)), hy = lerp(f.y0, f.y1, Math.min(1, u * 2.5));
          c.fillStyle = '#ffe8a0'; c.beginPath(); c.arc(hx, hy, 5 * (1 - u) + 2, 0, TAU); c.fill();
          c.restore();
          break;
        }
        case 'ring': {
          if (u > 1) break;
          c.save();
          c.globalAlpha = 1 - u;
          c.beginPath(); f.pts.forEach((p, k) => k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath();
          c.fillStyle = 'rgba(255,230,140,0.35)'; c.fill();
          c.shadowColor = '#ffe08a'; c.shadowBlur = 30; c.lineWidth = 10 + 10 * u; c.strokeStyle = '#ffe9a8'; c.lineJoin = 'round'; c.stroke();
          c.restore();
          break;
        }
        case 'smoke': {
          if (u > 1) break;
          const tt = G.t - f.t0;
          c.globalAlpha = (1 - u) * 0.7; c.fillStyle = '#e8e0f0';
          c.beginPath(); c.arc(f.x + f.vx * tt, f.y + f.vy * tt, f.r * (0.6 + u), 0, TAU); c.fill(); c.globalAlpha = 1;
          break;
        }
        case 'heart': {
          if (u > 1) break;
          const tt = G.t - f.t0;
          c.globalAlpha = 1 - u;
          R.heart(c, f.x + f.vx * tt, f.y + f.vy * tt, 18, '#ff8ab8');
          c.globalAlpha = 1;
          break;
        }
        case 'shot': {
          if (u > 1) break;
          const x = lerp(f.x0, f.x1, u), y = lerp(f.y0, f.y1, u) - Math.sin(u * Math.PI) * 60;
          c.save(); c.globalCompositeOperation = 'lighter';
          c.fillStyle = f.big ? 'rgba(255,90,60,0.9)' : 'rgba(255,140,120,0.85)';
          c.beginPath(); c.arc(x, y, f.big ? 14 : 8, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,200,180,0.5)'; c.beginPath(); c.arc(x, y, f.big ? 24 : 14, 0, TAU); c.fill();
          c.restore();
          break;
        }
        case 'wind': {
          if (u > 1) break;
          c.save(); c.globalAlpha = (1 - u) * 0.7; c.strokeStyle = '#e0f4ff'; c.lineWidth = 3;
          for (let k = 0; k < 6; k++) {
            const xx = BX + ((u * 1.4 + k / 6) % 1) * C * BN * (f.dir > 0 ? 1 : -1) + (f.dir > 0 ? 0 : C * BN);
            c.beginPath(); c.moveTo(xx, f.y - 20 + k * 7); c.lineTo(xx - 60 * f.dir, f.y - 20 + k * 7); c.stroke();
          }
          c.restore();
          break;
        }
        case 'fly': {
          if (u >= 1) { if (!f.done) { f.done = true; if (f.cb) f.cb(); } break; }
          const e = u * u * (3 - 2 * u);
          const x = lerp(f.x0, f.x1, e) + Math.sin(e * Math.PI) * f.bend, y = lerp(f.y0, f.y1, e) - Math.sin(e * Math.PI) * 70;
          if (f.icon === 'coin') R.drawIcon(c, 'K', x, y, 34);
          else R.heart(c, x, y, 20);
          break;
        }
        case 'friend': {
          if (u > 1) break;
          const e = u * u * (3 - 2 * u);
          const x = lerp(f.x0, f.x1, e), y = lerp(f.y0, f.y1, e) - Math.sin(e * Math.PI) * 140;
          c.save();
          R.drawYokai(c, f.sp, x, y, C * (1.05 - 0.5 * e), G.t, { happy: true, shadow: false, rot: Math.sin(u * 20) * 0.2 });
          // リボン
          c.fillStyle = '#e0323a'; c.beginPath(); c.ellipse(x - 8, y - 18 * (1 - 0.5 * e), 7, 4, -0.4, 0, TAU); c.ellipse(x + 8, y - 18 * (1 - 0.5 * e), 7, 4, 0.4, 0, TAU); c.fill();
          c.restore();
          break;
        }
        case 'banner': {
          if (u > 1) break;
          const a = Math.min(1, u * 5, (1 - u) * 4);
          c.globalAlpha = a;
          const yy = BY + C * 3.5;
          c.fillStyle = 'rgba(20,6,16,0.75)'; c.fillRect(0, yy - 46, W, 92);
          R.text(c, f.text, W / 2, yy, { size: 48, font: R.FONT_TITLE, color: '#ffe8b8', stroke: 'rgba(120,20,20,0.9)', sw: 6 });
          c.globalAlpha = 1;
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------- 左：ゆい と じぶんの ようす
  function drawLeft(c) {
    const P = B.P, St = B.st.S;
    const mood = G.t < B.yuiMoodT ? B.yuiMood : (B.phase === 'lost' ? 'hurt' : null);
    // ともだちの 行列（この周回で むすんだ 種類）
    const fr = Object.keys(P.friends).filter(k => P.friends[k] > 0);
    const cheer = G.t - B.cheer < 1.2;
    fr.forEach((sp, k) => {
      const x = 60 + (k % 9) * 36, y = 668 - Math.floor(k / 9) * 0;
      const jump = cheer ? Math.abs(Math.sin((G.t - B.cheer) * 8 + k)) * 8 : 0;
      R.drawYokai(c, sp, x, y - jump, D.SPECIES[sp].boss ? 34 : 38, G.t, { seed: k, happy: cheer, shadow: false });
    });
    if (fr.length) R.text(c, 'ともだち', 30, 628, { size: 13, align: 'left', color: 'rgba(255,220,240,0.7)', weight: 'normal' });
    R.drawYui(c, YUI.x, YUI.y, YUI.s * 0.95, G.t, mood);
    // 体力
    const hx = 40, hy = HUD.hp.y;
    R.heart(c, hx + 6, hy, 30);
    const bw = 230, frac = clamp(B.hpShown / St.maxHp, 0, 1);
    R.rr(c, hx + 30, hy - 11, bw, 22, 11); c.fillStyle = 'rgba(10,6,16,0.85)'; c.fill();
    R.rr(c, hx + 30, hy - 11, Math.max(0, bw * frac), 22, 11);
    c.fillStyle = frac < 0.3 ? '#ff4a5a' : '#ff7a8a'; c.fill();
    const info = B.chain && B.chain.info;
    if (info && info.valid && info.heal > 0) {
      const f2 = clamp((B.disp.hp + info.heal) / St.maxHp, 0, 1);
      R.rr(c, hx + 30 + bw * frac, hy - 11, bw * (f2 - frac), 22, 6); c.fillStyle = 'rgba(160,255,150,' + (0.5 + 0.3 * Math.sin(G.t * 10)) + ')'; c.fill();
    }
    R.text(c, Math.round(B.disp.hp) + ' / ' + St.maxHp, hx + 30 + bw / 2, hy + 1, { size: 16, stroke: 'rgba(0,0,0,0.7)', sw: 3 });
    // 小判・ひも・お面
    R.drawIcon(c, 'K', HUD.coin.x - 10, HUD.coin.y, 40);
    R.text(c, String(B.disp.coins), HUD.coin.x + 12, HUD.coin.y + 1, { size: 21, align: 'left', color: '#ffe08a', stroke: 'rgba(0,0,0,0.6)', sw: 3 });
    R.cord(c, HUD.cord.x - 14, HUD.cord.y, 30);
    R.text(c, 'ひも ' + St.cord, HUD.cord.x + 6, HUD.cord.y + 1, { size: 18, align: 'left', stroke: 'rgba(0,0,0,0.6)', sw: 3 });
    for (let k = 0; k < B.disp.blocks; k++) R.mask(c, HUD.mask.x + k * 30, HUD.mask.y, 26);
    // 鎖の 予告 または 玉の 説明
    drawPreviewCard(c, 24, 478, 350, 132);
  }

  function drawPreviewCard(c, x, y, w, h) {
    R.panel(c, x, y, w, h, { r: 12 });
    const info = B.chain && B.chain.info;
    const St = B.st.S;
    if (info && info.type) {
      const t = info.type;
      R.drawIcon(c, t, x + 40, y + 40, 52);
      const nm = D.TILE[t].name;
      const head = info.closed ? nm + 'の 輪　×' + info.count : nm + '　×' + (info.valid ? info.count : B.chain.path.length);
      R.text(c, head, x + 76, y + 34, { size: 22, align: 'left', color: R.TCOL[t].rim });
      const lines = [];
      if (!info.valid) lines.push('あと ' + (3 - B.chain.path.length) + 'つ つなごう');
      else {
        if (t === 'H') {
          if (info.targets.length) lines.push('となりの 妖 ' + info.targets.length + '体に あたる（妖の 上の 数字）');
          else if (!B.st.boss) lines.push('となりに 妖が いない（空に あがるだけ）');
          if (B.st.boss) lines.push('ぬしに ' + info.bossDmg + ' とどく');
        }
        if (t === 'D') lines.push('体力 +' + info.heal + (info.healRaw > info.heal ? '（おなか いっぱい）' : ''));
        if (info.coins) lines.push('小判 +' + info.coins);
        if (info.befriend.length) lines.push('妖 ' + info.befriend.length + '体と ともだちに なる！');
        if (info.closed && info.count > info.nChain && !info.befriend.length) lines.push('輪の 中の 玉も ' + D.TILE[t].name + 'として かぞえる');
        if (info.burn.length) lines.push('おじゃまを ' + info.burn.length + 'つ けす');
      }
      lines.slice(0, 3).forEach((ln, k) => R.text(c, ln, x + 22, y + 72 + k * 22, { size: 16, align: 'left', color: '#fff0dc', weight: 'normal' }));
    } else {
      const items = [['H', '花火', 'となりの 妖に あたる'], ['D', '団子', '体力が もどる'], ['K', '小判', '夜店で つかう'], ['L', '提灯', 'どの玉とも つながる']];
      items.forEach(([t, nm, ds], k) => {
        const yy = y + 22 + k * 29;
        R.drawTile(c, t, x + 28, yy + 2, 30);
        R.text(c, nm, x + 52, yy + 2, { size: 16, align: 'left', color: R.TCOL[t].rim });
        R.text(c, ds, x + 100, yy + 2, { size: 15, align: 'left', color: '#f0e0d0', weight: 'normal' });
      });
      R.text(c, 'ひも ' + St.cord + ' つぶんまで', x + w - 14, y + h - 14, { size: 12, align: 'right', color: 'rgba(255,230,200,0.6)', weight: 'normal' });
    }
  }

  // ---------------------------------------------------------------- 右：戦いの ようす
  function drawRight(c) {
    const st = B.st;
    const x = 900, w = 360;
    const area = D.AREAS[B.area - 1];
    R.text(c, area.name + '　―　' + B.cfg.title, x + w / 2, 40, { size: 20, font: R.FONT_TITLE, color: '#ffe2b0', stroke: 'rgba(0,0,0,0.7)', sw: 4 });
    // 妖の 一覧
    const ys = S.yokaiList(st).map(i => st.cells[i]);
    R.panel(c, x, 70, w, 128, { r: 12 });
    R.text(c, st.boss ? 'ぬしの なかま' : 'のこりの 妖', x + 18, 92, { size: 15, align: 'left', color: '#ffd8a8' });
    const all = ys.map(y => ({ sp: y.sp, on: true })).concat(st.queue.map(sp => ({ sp, on: false })));
    all.slice(0, 7).forEach((it, k) => {
      const xx = x + 40 + k * 46, yy = 150;
      R.drawYokai(c, it.sp, xx, yy, 44, G.t, { seed: k, silhouette: it.on ? null : 'rgba(30,20,40,0.85)', shadow: false });
      if (!it.on) R.text(c, '?', xx, yy, { size: 15, color: 'rgba(255,255,255,0.45)' });
    });
    if (all.length > 7) R.text(c, '+' + (all.length - 7), x + w - 24, 150, { size: 16, color: '#ffd8a8' });
    if (!all.length) R.text(c, st.boss ? '（いまは いない）' : 'もう いない', x + w / 2, 150, { size: 15, color: 'rgba(255,230,200,0.6)', weight: 'normal' });
    // 指している妖の 説明
    let target = null;
    if (B.hover >= 0 && st.cells[B.hover] && st.cells[B.hover].k === 'y') target = st.cells[B.hover];
    if (!target && ys.length) target = ys.slice().sort((a, b) => a.cd - b.cd)[0];
    R.panel(c, x, 212, w, 250, { r: 12 });
    if (target) {
      const sp = D.SPECIES[target.sp];
      R.drawYokai(c, target.sp, x + 60, 282, 78, G.t, { seed: 1 });
      R.text(c, sp.name, x + 112, 250, { size: 22, align: 'left', color: '#fff0dc' });
      R.text(c, '体力 ' + Math.max(0, target.hp) + ' / ' + target.mhp, x + 112, 280, { size: 16, align: 'left', color: '#ffb0b0' });
      const cdText = sp.rare ? 'あと ' + target.cd + ' で にげる' : (sp.act === 'hop' ? 'まいかい はねる・あと ' + target.cd + ' で こうげき' : 'あと ' + target.cd + ' で ' + actName(sp));
      R.text(c, cdText, x + 112, 306, { size: 15, align: 'left', color: sp.rare ? '#b0d0ff' : '#ffd0a0', weight: 'normal' });
      const lines = G.wrap(c, abilityText(target.sp), w - 40, 'normal 15px ' + R.FONT);
      lines.slice(0, 5).forEach((ln, k) => R.text(c, ln, x + 20, 346 + k * 22, { size: 15, align: 'left', color: '#f0e2d0', weight: 'normal' }));
      if (B.ringIds.has(target.id) && B.phase === 'input') R.text(c, '★ いま 輪で かこめる！', x + 20, 446, { size: 15, align: 'left', color: '#fff0a0' });
    } else if (st.boss) {
      const lines = G.wrap(c, abilityText(st.boss.sp), w - 40, 'normal 15px ' + R.FONT);
      R.text(c, D.SPECIES[st.boss.sp].name, x + 20, 246, { size: 22, align: 'left', color: '#fff0dc' });
      lines.slice(0, 6).forEach((ln, k) => R.text(c, ln, x + 20, 286 + k * 24, { size: 15, align: 'left', color: '#f0e2d0', weight: 'normal' }));
    }
    // ボタン
    G.button({ x: x + 10, y: 600, w: 160, h: 46, label: 'ヒント（H）', on: showHint, disabled: B.phase !== 'input', size: 18 });
    G.button({ x: x + 190, y: 600, w: 160, h: 46, label: 'ひとやすみ', on: openPause, size: 18 });
    R.text(c, 'なぞって はなす／右クリック：とりけし／Esc：ひとやすみ', x + w / 2, 670, { size: 14, color: 'rgba(255,236,210,0.85)', weight: 'normal', stroke: 'rgba(0,0,0,0.6)', sw: 3 });
    if (B.attempt > 1) R.text(c, B.attempt + 'かいめ', x + w / 2, 690, { size: 12, color: 'rgba(255,230,200,0.45)', weight: 'normal' });
  }
  function actName(sp) {
    return { hit: 'こうげき', steal: '小判を とる', grow: 'のびて こうげき', azuki: '小豆を まく', onibi: 'こうげき', chochin: 'まわりを 提灯に', hop: 'こうげき' }[sp.act] || 'こうげき';
  }
  function abilityText(sp) {
    const s = D.SPECIES[sp];
    const t = {
      mame: '数字が 0に なると 体力を 1 へらす。',
      kooni: '数字が 0に なると 体力を 2 へらす。',
      zashiki: 'めずらしい妖。こうげき しないが、数字が 0に なると かえってしまう。輪で むすぼう。',
      kasa: 'まいかい となりの マスへ はねる。数字が 0に なると 体力を 1 へらす。',
      takenoko: '数字が 0に なると のびて（体力 +1）、体力を 2 へらす。はやめに。',
      kamaitachi: 'めずらしい妖。数字が 0に なると 風に きえる。輪で むすぼう。',
      kappa: '数字が 0に なると 小判を 3まい とる（なければ 体力を 2 へらす）。',
      azuki: '数字が 0に なると まわりに 小豆（おじゃま）を まき、体力を 1 へらす。',
      ryu: 'めずらしい妖。数字が 0に なると 空へ かえる。輪で むすぼう。',
      onibi: '花火で おいはらうと はじけて、まわりの妖にも 3 あたる。',
      chochin: '数字が 0に なると まわりの玉を 提灯に かえ、体力を 2 へらす。かこむ チャンス。',
      kitsune: 'めずらしい妖。数字が 0に なると 帰ってしまう。輪で むすぼう。',
      danuki: '玉を 葉っぱ（おじゃま）に かえ、豆だぬきを よぶ。花火を つなぐほど 空から とどく。',
      tengu: 'ときどき うちわの 風で 玉の 列を ずらす。唐傘や たけのこを よぶ。',
      gama: '玉を 泡（おじゃま）で つつむ。河童や 小豆洗いを よぶ。',
      oni: 'たいこで 大きく こうげきし、なかまを よぶ。体力が 半分を きると 本気に なる。'
    }[sp];
    return t || s.desc;
  }

  function drawTip(c) {
    const tp = B.tip;
    const a = clamp((G.t - tp.t0) * 4, 0, 1);
    c.globalAlpha = a;
    if (B.st.boss) {
      // ぬしの 戦いでは 右の 空いている ところに
      const lines = G.wrap(c, tp.text, 330, 'bold 15px ' + R.FONT);
      const h = 20 + lines.length * 21, y = 470 + Math.max(0, (122 - h) / 2);
      R.panel(c, 900, y, 360, h, { r: 12, fill: 'rgba(60,20,30,0.92)', border: 'rgba(255,200,140,0.8)' });
      lines.forEach((ln, k) => R.text(c, ln, 1080, y + 20 + k * 21, { size: 15, color: '#fff2dc' }));
      c.globalAlpha = 1;
      return;
    }
    const lines = G.wrap(c, tp.text, 540, 'bold 17px ' + R.FONT);
    const h = 24 + lines.length * 24;
    const y = BY - h - 16;
    R.panel(c, W / 2 - 290, y, 580, h, { r: 12, fill: 'rgba(60,20,30,0.92)', border: 'rgba(255,200,140,0.8)' });
    lines.forEach((ln, k) => R.text(c, ln, W / 2, y + 24 + k * 24, { size: 17, color: '#fff2dc' }));
    c.globalAlpha = 1;
  }
  function drawIntro(c) {
    const u = G.t - B.introT;
    const a = Math.min(1, u * 4, (0.9 - u) * 4);
    if (a <= 0) return;
    c.globalAlpha = a;
    R.text(c, B.cfg.title, W / 2, BY + C * 3.5, { size: 42, font: R.FONT_TITLE, color: '#ffe8c0', stroke: 'rgba(40,0,10,0.9)', sw: 6 });
    c.globalAlpha = 1;
  }
  function drawTalk(c) {
    const tk = B.talk;
    const sp = B.st.boss ? B.st.boss.sp : 'mame';
    const y = 560, h = 130;
    R.panel(c, 240, y, 800, h, { fill: 'rgba(24,10,22,0.95)' });
    R.text(c, D.SPECIES[sp].name, 270, y + 26, { size: 18, align: 'left', color: '#ffb080' });
    const lines = G.wrap(c, tk.lines[tk.i], 740, 'bold 22px ' + R.FONT_SOFT);
    lines.forEach((ln, k) => R.text(c, ln, 270, y + 64 + k * 30, { size: 22, align: 'left', font: R.FONT_SOFT, color: '#fff4e6' }));
    if (G.t % 1 < 0.6) R.text(c, '▼ クリック', 1010, y + h - 18, { size: 13, align: 'right', color: 'rgba(255,220,200,0.6)', weight: 'normal' });
  }
  function drawResult(c) {
    const r = B.result;
    const u = G.t - r.t;
    c.fillStyle = 'rgba(8,4,16,' + Math.min(0.55, u * 2) + ')'; c.fillRect(0, 0, W, H);
    const w = 640, h = 420, x = (W - w) / 2, y = (H - h) / 2 - 10;
    R.panel(c, x, y, w, h);
    R.text(c, B.st.boss ? 'ぬしと ともだちに なった' : 'おさまった！', W / 2, y + 48, { size: 32, font: R.FONT_TITLE, color: '#ffe2b0' });
    R.drawIcon(c, 'K', x + 70, y + 106, 44);
    R.text(c, '小判 +' + r.coins + '（ぜんぶで ' + B.P.coins + '）', x + 100, y + 106, { size: 20, align: 'left', color: '#ffe08a' });
    const fr = Object.keys(r.friends);
    R.text(c, fr.length ? 'むすんだ ともだち' : 'こんどは だれとも むすべなかった', x + 40, y + 154, { size: 18, align: 'left', color: '#ffd0ec' });
    fr.slice(0, 6).forEach((sp, k) => {
      const xx = x + 80 + k * 96, yy = y + 214;
      R.drawYokai(c, sp, xx, yy, D.SPECIES[sp].boss ? 58 : 64, G.t, { seed: k, happy: true });
      R.text(c, D.SPECIES[sp].name + (r.friends[sp] > 1 ? ' ×' + r.friends[sp] : ''), xx, yy + 46, { size: 13, color: '#fff0e0' });
      if (r.newSpecies.includes(sp)) R.text(c, 'はじめて！', xx, yy - 44, { size: 13, color: '#ffe060', stroke: 'rgba(0,0,0,0.7)', sw: 3 });
    });
    let yy = y + 300;
    for (const sp of r.newPerk.slice(0, 3)) {
      R.text(c, '＋ ' + D.SPECIES[sp].name + '：' + D.SPECIES[sp].perkText, x + 40, yy, { size: 16, align: 'left', color: '#c8f0b0' });
      yy += 26;
    }
    if (u > 0.6) G.button({ x: W / 2 - 110, y: y + h - 70, w: 220, h: 50, label: 'つぎへ', style: 'main', def: true, on: finishBattle });
  }
  function drawLost(c) {
    const u = G.t - B.lostT;
    if (u < 0.8) return;
    c.fillStyle = 'rgba(8,4,16,' + Math.min(0.6, (u - 0.8) * 2) + ')'; c.fillRect(0, 0, W, H);
    const w = 560, h = 300, x = (W - w) / 2, y = (H - h) / 2;
    R.panel(c, x, y, w, h);
    R.text(c, 'ゆいは へとへと…', W / 2, y + 52, { size: 30, font: R.FONT_TITLE, color: '#ffd0c0' });
    const mx = S.stats(B.snapP).maxHp;
    const hp = Math.max(B.snapP.hp, Math.ceil(mx * 0.6));
    R.text(c, 'この 戦いを はじめから やりなおせます（体力 ' + hp + ' で）。', W / 2, y + 108, { size: 17, color: '#f0e0d0', weight: 'normal' });
    R.text(c, 'むすんだ ともだちは そのまま。', W / 2, y + 136, { size: 17, color: '#f0e0d0', weight: 'normal' });
    G.button({ x: x + 60, y: y + 190, w: 200, h: 52, label: 'もういちど', style: 'main', def: true, on: retry });
    G.button({ x: x + 300, y: y + 190, w: 200, h: 52, label: 'タイトルへ', on: () => { G.store(); G.go('title'); } });
  }

  function openPause() {
    if (B.phase === 'result' || B.phase === 'lost') return;
    if (B.chain) { B.chain = null; }
    G.openMenu([
      { label: 'つづける', on: () => { G.menu = null; } },
      { label: 'この戦いを やりなおす', on: () => { G.menu = null; retryFromMenu(); } },
      { label: '遊びかた', on: () => { G.menu = null; G.overlay = 'howto'; } },
      { label: 'タイトルへ（この戦いは はじめから）', on: () => { G.menu = null; G.store(); G.go('title'); } }
    ]);
  }
  function retryFromMenu() {
    const P = JSON.parse(JSON.stringify(B.snapP));
    P.friends = Object.assign({}, B.P.friends);
    G.go('battle', { bid: B.bid, attempt: B.attempt, snapP: B.snapP, P });
  }

  // ================================================================ 入力
  function down(x, y) {
    if (G.overlay) return;
    if (B.talk) { talkNext(); return; }
    if (B.phase !== 'input') return;
    const i = cellAt(x, y, 0.55);
    if (i >= 0) { startChain(i); if (B.chain) { B.chain.px = x; B.chain.py = y; } }
  }
  function move(x, y) {
    B.hover = cellAt(x, y);
    if (B.chain) chainMove(x, y);
  }
  function up() {
    if (B.chain) endChain();
  }
  function key(k) {
    if (G.overlay) { if (k === 'Escape' || k === 'Enter' || k === ' ') { G.overlay = null; } return true; }
    if (B.talk && (k === 'Enter' || k === ' ' || k === 'Escape')) { if (k === 'Escape') { const tk = B.talk; B.talk = null; tk.cb(); } else talkNext(); return true; }
    if (k === 'Escape') { if (B.chain) { B.chain = null; A.play('cancel'); return true; } openPause(); return true; }
    if (k === 'h' || k === 'H') { showHint(); return true; }
    return false;
  }
  function rightClick() { if (B.chain) { B.chain = null; A.play('cancel'); } }

  G.scenes.battle = {
    enter, update, draw: (c) => { draw(c); if (G.overlay === 'howto') G.scenes.howto.drawOverlay(c, () => { G.overlay = null; }); },
    down, move, up, key, rightClick,
    exit() { B.chain = null; }
  };
  // 検証用（人の遊びには 使わない）
  B.debug = {
    commit, cpos, cellAt, startInput, get phase() { return B.phase; },
    // いまの 盤で いちばん よい 手（ヒントと 同じ 探しかた）を 返す。cells は マスの 番号
    best() { const m = S.searchChains(B.st, scoreHint, { budget: 12000 }); return m ? { path: m.path, closed: m.closed, pts: m.path.map(i => cpos(i)), type: m.info.type, count: m.info.count, befriend: m.info.befriend.length } : null; },
    auto() { if (B.phase !== 'input') return false; const m = S.searchChains(B.st, scoreHint, { budget: 12000 }); if (!m) return false; commit(m.path, m.closed); return true; }
  };
})(window);
