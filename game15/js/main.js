/* 賽駆け — 進行・入力・画面 */
(function (root) {
  'use strict';
  const SG = root.SG, D = SG.DATA, E = SG.E, AI = SG.AI, R = SG.R, A = SG.A, MAP = SG.MAP;
  const $ = id => document.getElementById(id);
  const CL = {}; D.CLANS.forEach(c => { CL[c.id] = c; });
  const POS = MAP.POS;
  const SAVE_KEY = 'saigake15_save', TUT_KEY = 'saigake15_tut';
  const PN = p => D.PROV[p].n;

  let S = null, V = null, BG = null;
  const U = { fx: [], spread: {}, hop: {}, armyPos: {}, moved: {}, armyDie: {}, heal: {}, hide: {}, armyScale: {} };
  let mode = 'title', busy = false, lastClan = null, pickClan = null;
  const speed = { fast: false, skip: false, hurry: false, mul: 1 };
  const sel = { army: null, dice: [], combine: false };
  let undoStack = [], curReach = null, hoverInfo = null, logs = [];
  let tutOn = true;
  try { tutOn = localStorage.getItem(TUT_KEY) !== 'done'; } catch (e) { /* 無視 */ }

  const now = () => performance.now() / 1000;
  const cloneV = s => ({ owner: s.owner.slice(), gar: s.gar.slice(), armies: s.armies.map(a => Object.assign({}, a)), turn: s.turn, clans: JSON.parse(JSON.stringify(s.clans)), player: s.player, coal: s.coal });
  const snapOf = s => cloneV(s);
  const isMe = c => !!S && c === S.player;

  // ───────── 待ち・補間 ─────────
  function wait(ms) {
    if (speed.skip || speed.hurry) return Promise.resolve();
    return new Promise(r => setTimeout(r, ms / speed.mul));
  }
  function tween(ms, fn) {
    if (speed.skip || speed.hurry || ms <= 0) { fn(1); return Promise.resolve(); }
    const dur = ms / speed.mul / 1000;
    return new Promise(res => {
      const t0 = now();
      const step = () => {
        if (speed.skip || speed.hurry) { fn(1); res(); return; }
        const k = Math.min(1, (now() - t0) / dur);
        fn(k);
        if (k >= 1) res(); else requestAnimationFrame(step);
      };
      step();
    });
  }

  // ───────── 演出（地図上） ─────────
  function fxPuff(x, y, col, n, spread) {
    const ps = [];
    for (let i = 0; i < (n || 8); i++) { const a = Math.random() * Math.PI * 2, v = (spread || 18) * (0.5 + Math.random()); ps.push([Math.cos(a) * v, Math.sin(a) * v * 0.6 - 6, 3 + Math.random() * 4]); }
    const t0 = now();
    U.fx.push({ t0, dur: 0.7, draw(c, t) { const k = (t - t0) / 0.7; c.globalAlpha = Math.max(0, 0.7 * (1 - k)); c.fillStyle = col || 'rgba(120,100,70,1)'; for (const p of ps) { c.beginPath(); c.arc(x + p[0] * k, y + p[1] * k - k * 8, p[2] * (1 + k), 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1; } });
  }
  function fxSparks(x, y) {
    const ps = [];
    for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, v = 14 + Math.random() * 26; ps.push([Math.cos(a) * v, Math.sin(a) * v]); }
    const t0 = now();
    U.fx.push({ t0, dur: 0.45, draw(c, t) { const k = (t - t0) / 0.45; c.strokeStyle = 'rgba(255,200,90,' + (1 - k) + ')'; c.lineWidth = 2; for (const p of ps) { c.beginPath(); c.moveTo(x + p[0] * k * 0.6, y + p[1] * k * 0.6); c.lineTo(x + p[0] * k, y + p[1] * k); c.stroke(); } } });
  }
  function fxRing(x, y, col, r0, r1, dur) {
    const t0 = now(); dur = dur || 0.6;
    U.fx.push({ t0, dur, draw(c, t) { const k = (t - t0) / dur; c.beginPath(); c.arc(x, y, r0 + (r1 - r0) * k, 0, Math.PI * 2); c.strokeStyle = col; c.globalAlpha = 1 - k; c.lineWidth = 3; c.stroke(); c.globalAlpha = 1; } });
  }
  function fxText(x, y, txt, col, size, dur) {
    const t0 = now(); dur = dur || 1.2;
    U.fx.push({ t0, dur, draw(c, t) { const k = (t - t0) / dur; c.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25; R.label(c, txt, x, y - 22 * k, '800 ' + (size || 16) + 'px ' + R.FONT_M, col, 'rgba(250,244,226,0.95)'); c.globalAlpha = 1; } });
  }
  function fxStamp(x, y, txt, col, dur) {
    const t0 = now(); dur = dur || 1.6;
    U.fx.push({ t0, dur, draw(c, t) {
      const k = (t - t0) / dur;
      const sc = k < 0.12 ? 1.8 - (k / 0.12) * 0.8 : 1;
      c.save(); c.translate(x, y - 34); c.rotate(-0.12); c.scale(sc, sc);
      c.globalAlpha = k < 0.8 ? 0.95 : 0.95 * (1 - (k - 0.8) / 0.2);
      const w = txt.length * 20 + 14;
      c.fillStyle = 'rgba(250,240,220,0.85)'; R.roundRect(c, -w / 2, -17, w, 34, 4); c.fill();
      c.strokeStyle = col; c.lineWidth = 3; R.roundRect(c, -w / 2 + 3, -14, w - 6, 28, 3); c.stroke();
      c.fillStyle = col; c.font = '900 20px ' + R.FONT_M; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 0, 1);
      c.restore(); c.globalAlpha = 1;
    } });
  }
  function shake(power, dur) { U.shake = power; U.shakeUntil = now() + dur; }

  // ───────── 記録 ─────────
  function seasonTag(turn) { const d = E.dateLabel(turn); return d.season; }
  function addLog(txt, cls, clan) {
    logs.unshift({ txt, cls: cls || '', clan, when: V ? seasonTag(V.turn) : '' });
    logs = logs.slice(0, 7);
    renderLog();
  }

  // ───────── 表示用の状態の更新 ─────────
  const vArmy = id => V.armies.find(a => a.id === id);
  function involvesMe(e) {
    if (!S) return false;
    if (e.clan === S.player) return true;
    if (e.type === 'battle') return e.att.c === S.player || e.def.c === S.player;
    if (e.type === 'capture') return e.from === S.player || e.to === S.player;
    if (e.type === 'move') {
      const end = e.path[e.path.length - 1];
      for (const m of E.adj[end]) {
        const nd = E.nodes[m];
        if (nd.kind === 'c' && V.owner[nd.p] === S.player) return true;
        if (V.armies.some(a => a.n === m && a.c === S.player)) return true;
      }
    }
    return false;
  }

  async function animMove(e) {
    const a = vArmy(e.army); if (!a) return;
    const mine = isMe(e.clan), near = involvesMe(e);
    const stepMs = mine ? 170 : near ? 120 : 55;
    for (let i = 1; i < e.path.length; i++) {
      const p0 = POS[e.path[i - 1]], p1 = POS[e.path[i]];
      await tween(stepMs, k => {
        U.armyPos[a.id] = [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k];
        U.hop[a.id] = Math.sin(k * Math.PI) * (mine ? 7 : 4);
      });
      if (mine || near) { A.S.step(i); fxPuff(p1[0], p1[1] + 10, 'rgba(140,115,80,1)', 4, 10); }
    }
    a.n = e.path[e.path.length - 1];
    delete U.armyPos[a.id]; delete U.hop[a.id];
  }
  async function animStep(id, from, to, ms) {
    const a = vArmy(id); if (!a) return;
    const p0 = POS[from], p1 = POS[to];
    await tween(ms || 160, k => { U.armyPos[id] = [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k]; });
    a.n = to; delete U.armyPos[id];
  }

  function sideInfo(c, prov) {
    if (c) return { mon: CL[c].mon, col: CL[c].col, nm: CL[c].n + '軍' };
    return { mon: '国', col: '#7a705e', nm: (prov >= 0 ? PN(prov) + 'の' : '') + '国衆' };
  }
  function partsTxt(parts) {
    return parts.filter(p => p[0] !== '奇襲').map((p, i) => (i ? '＋' : '') + p[0] + p[1]).join(' ');
  }
  async function animBattle(e) {
    const p = POS[e.node];
    const mine = e.att.c === S.player || e.def.c === S.player;
    fxSparks(p[0], p[1]);
    if (!mine) {
      A.S.clash && (involvesMe(e) ? A.S.clash() : null);
      fxRing(p[0], p[1], 'rgba(255,120,80,0.9)', 8, 26, 0.4);
      await wait(e.castle ? 260 : 200);
      applyBattleNumbers(e);
      return;
    }
    const at = sideInfo(e.att.c, -1), df = sideInfo(e.def.c, e.prov);
    const place = e.castle ? PN(e.prov) + '・' + D.PROV[e.prov].c : (E.nodes[e.node].name || PN(E.nodes[e.node].a) + 'と' + PN(E.nodes[e.node].b) + 'の境');
    const B = $('battle');
    B.innerHTML = '<div class="ttl">' + (e.castle ? '城攻め' : '合戦') + '　' + place + '</div>' +
      '<div class="cols">' +
      '<div class="side"><span class="mon md" style="background:' + at.col + '">' + at.mon + '</span><div class="nm">' + at.nm + '</div><div class="parts">' + partsTxt(e.A) + (e.kishu ? '<div class="kishu">奇襲！</div>' : '') + '</div><div class="tot" id="bt-a">' + e.SA + '</div></div>' +
      '<div class="vs">対</div>' +
      '<div class="side"><span class="mon md" style="background:' + df.col + '">' + df.mon + '</span><div class="nm">' + df.nm + '</div><div class="parts">' + partsTxt(e.D) + '</div><div class="tot" id="bt-d">' + e.SDb + (e.kishu ? '' : '＋？') + '</div><div class="ddie" id="bt-die"></div></div>' +
      '</div><div class="res" id="bt-res"></div><div class="loss" id="bt-loss"></div>';
    B.classList.remove('hidden');
    A.S.drum(1);
    shake(4, 0.25);
    await wait(500);
    if (e.kishu) {
      A.S.ambush();
      if (e.att.c === S.player) fxStamp(p[0], p[1] - 10, '奇襲', '#b8860b', 1.5);
      $('bt-die').innerHTML = '<div class="kishu" style="align-self:center">奇襲：守りの賽は振れない</div>';
      await wait(650);
    } else {
      const d = makeDie(-1);
      $('bt-die').appendChild(d.el);
      setDie(d, Math.ceil(Math.random() * 6), false);
      await wait(30);
      A.S.roll(1);
      setDie(d, e.die, true);
      await wait(900);
      $('bt-d').textContent = e.SDb + '＋' + e.die + '＝' + (e.SDb + e.die);
      A.S.land();
      await wait(350);
    }
    const win = e.win;
    const meWon = (e.att.c === S.player) === win;
    const res = $('bt-res');
    res.className = 'res ' + (meWon ? 'win' : 'lose');
    res.textContent = win ? (e.att.c === S.player ? '勝利！' : '敗れた…') : (e.att.c === S.player ? '退けられた…' : '守りきった！');
    A.S.clash();
    if (meWon) A.S.win(); else A.S.lose();
    const ln = (c, n) => (c ? CL[c].n : '国衆') + ' −' + n;
    const lossTxt = [ln(e.att.c, e.lossA)];
    if (e.def.id || !e.castle) lossTxt.push(ln(e.def.c, e.lossD));
    else if (!win && e.lossD) lossTxt.push('守備兵 −' + e.lossD);
    $('bt-loss').textContent = '損害：' + lossTxt.join('　');
    applyBattleNumbers(e);
    await wait(1000);
    B.classList.add('hidden');
    if (e.att.c === S.player) addLog((win ? '勝利：' : '敗退：') + place + (e.kishu ? '（奇襲）' : ''), win ? 'me' : 'bad', S.player);
    else addLog((win ? '敗北：' : '防戦：') + place + ' ← ' + (e.att.c ? CL[e.att.c].n : ''), win ? 'bad' : 'me', e.att.c);
  }
  function applyBattleNumbers(e) {
    const a = vArmy(e.att.id);
    if (a) a.t = Math.max(0, e.att.t1);
    if (e.def.id) { const d = vArmy(e.def.id); if (d) d.t = Math.max(0, e.def.t1); }
    if (e.castle) V.gar[e.prov] = e.def.g1;
    const p = POS[e.node];
    if (e.lossA) fxText(POS[e.from][0], POS[e.from][1] - 14, '−' + e.lossA, '#b8281c', 15);
    if (e.lossD && (e.def.id || !e.win)) fxText(p[0] + 6, p[1] - 14, '−' + e.lossD, '#b8281c', 15);
  }
  async function animRout(e) {
    const a = vArmy(e.army); if (!a) return;
    const p = POS[a.n];
    fxPuff(p[0], p[1], 'rgba(70,60,50,1)', 12, 24);
    if (isMe(e.clan) || involvesMe(e)) fxText(p[0], p[1] - 20, e.trapped ? '包囲され壊滅' : '壊滅', '#7a1a10', 16);
    await tween(isMe(e.clan) ? 400 : 160, k => { U.armyScale[a.id] = 1 - k; });
    V.armies = V.armies.filter(x => x.id !== e.army);
    delete U.armyScale[e.army];
    if (isMe(e.clan)) addLog('軍勢が壊滅した', 'bad', e.clan);
  }
  async function animCapture(e) {
    const p = e.prov, q = POS[p];
    const mine = e.to === S.player, lost = e.from === S.player;
    const dur = mine || lost ? 0.85 : 0.4;
    U.spread[p] = { from: e.from, to: e.to, t0: now(), dur: speed.skip ? 0 : dur / speed.mul };
    V.owner[p] = e.to; V.gar[p] = E.R.capGar;
    if (mine) {
      A.S.fall(); setTimeout(() => A.S.big(), 120);
      shake(7, 0.35);
      fxPuff(q[0], q[1], 'rgba(90,80,70,1)', 16, 30);
      fxStamp(q[0], q[1], '落城', '#b8281c');
      fxText(q[0], q[1] - 46, PN(p) + ' を得た', '#7a1a10', 18, 1.6);
      addLog(PN(p) + 'を手に入れた', 'me', e.to);
    } else if (lost) {
      A.S.fall(); A.S.lose();
      shake(5, 0.3);
      fxPuff(q[0], q[1], 'rgba(90,80,70,1)', 14, 26);
      fxStamp(q[0], q[1], '落城', '#3a2a18');
      addLog(PN(p) + 'を' + CL[e.to].n + 'に奪われた', 'bad', e.to);
    } else {
      fxPuff(q[0], q[1], 'rgba(90,80,70,1)', 6, 16);
      addLog(CL[e.to].n + 'が' + PN(p) + 'を' + (e.from ? CL[e.from].n + 'から' : '') + '奪う', '', e.to);
    }
    hud();
    await wait(mine || lost ? 900 : 230);
  }
  async function animElim(e) {
    V.armies = V.armies.filter(a => a.c !== e.clan);
    if (V.clans[e.clan]) V.clans[e.clan].alive = false;
    addLog(CL[e.clan].n + '家 滅亡' + (e.by ? '（' + CL[e.by].n + 'により）' : ''), e.clan === S.player ? 'bad' : '', e.clan);
    await banner(CL[e.clan].n + '家 滅亡', e.by ? CL[e.by].who + 'に敗れる' : '', 1300, CL[e.clan].col);
    hud();
  }
  async function animHeal(e) {
    const mine = e.list.length && isMe((vArmy(e.list[0].id) || {}).c);
    for (const h of e.list) { const a = vArmy(h.id); if (a) { a.t += h.h; if (mine) U.heal[h.id] = h.h; } }
    if (mine) { A.S.heal(); await wait(700); U.heal = {}; }
  }
  async function banner(big, sub, ms, col) {
    const b = $('banner');
    b.innerHTML = '<div class="big"' + (col ? ' style="color:' + col + ';-webkit-text-stroke:1px #f1e6c8"' : '') + '>' + big + '</div>' + (sub ? '<div class="sub">' + sub + '</div>' : '');
    b.classList.remove('hidden'); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    await wait(ms || 1100);
    b.classList.add('hidden');
  }

  async function playEvent(e) {
    switch (e.type) {
      case 'turn':
        if (!isMe(e.clan)) setCpuChip(e.clan);
        break;
      case 'spawn': {
        V.armies.push(Object.assign({}, e.army));
        const q = POS[e.army.n];
        fxPuff(q[0], q[1], 'rgba(255,240,200,1)', 10, 20);
        fxRing(q[0], q[1], CL[e.army.c].col, 10, 34, 0.6);
        if (isMe(e.army.c)) { A.S.horn(); fxText(q[0], q[1] - 30, '出陣', '#7a1a10', 16); await wait(600); }
        else await wait(90);
        break;
      }
      case 'roll': if (!isMe(S.cur) && mode === 'play') showCpuDice(e.dice); break;
      case 'move': await animMove(e); break;
      case 'battle': await animBattle(e); break;
      case 'retreat': await animStep(e.army, e.from, e.to, involvesMe(e) ? 200 : 80); break;
      case 'rout': await animRout(e); break;
      case 'advance': await animStep(e.army, e.from, e.to, isMe((vArmy(e.army) || {}).c) ? 200 : 70); break;
      case 'capture': await animCapture(e); break;
      case 'eliminated': await animElim(e); break;
      case 'heal': await animHeal(e); break;
      case 'dice': if (isMe((vArmy(e.army) || {}).c)) { U.moved[e.army] = true; U.armyDie[e.army] = e.used.map(i => S.dice[i] ? S.dice[i].v : 0).reduce((a, b) => a + b, 0); } break;
      case 'coalition':
        addLog(CL[e.clan].n + '包囲網が結ばれた', e.clan === S.player ? 'bad' : '', e.clan);
        await banner(CL[e.clan].n + '包囲網', e.clan === S.player ? '諸大名がこぞってあなたを狙う' : '諸大名が' + CL[e.clan].n + 'を狙いはじめた', 1500);
        break;
      case 'coalition-end': addLog(CL[e.clan].n + '包囲網がほどけた', '', e.clan); break;
      case 'season': {
        V.turn = e.turn;
        const d = E.dateLabel(e.turn);
        A.S.horn();
        hud();
        await banner(d.era + '　' + d.season, d.season === '冬' ? '冬：峠を越えるのに3歩かかる' : d.season === '秋' ? '秋：収穫で休んだ軍勢の兵が多く戻る' : '', 1100);
        break;
      }
      case 'sync': {
        const keepTurn = V.turn;
        V = Object.assign(V, e.snap);
        if (e.keepTurn) V.turn = keepTurn;
        hud();
        break;
      }
      default: break;
    }
  }
  async function playEvents(list) {
    for (const e of list) {
      speed.hurry = false;
      await playEvent(e);
    }
    speed.hurry = false;
  }

  // ───────── 賽（3D） ─────────
  const FACE_ROT = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
  const PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  function makeDie(i) {
    const el = document.createElement('div'); el.className = 'die'; el.dataset.i = i;
    const cube = document.createElement('div'); cube.className = 'cube';
    for (let f = 1; f <= 6; f++) {
      const fc = document.createElement('div'); fc.className = 'face f' + f;
      for (let c = 1; c <= 9; c++) {
        const cell = document.createElement('span');
        if (PIPS[f].includes(c)) cell.className = 'pip';
        cell.style.gridArea = Math.ceil(c / 3) + '/' + (((c - 1) % 3) + 1);
        fc.appendChild(cell);
      }
      cube.appendChild(fc);
    }
    el.appendChild(cube);
    return { el, cube, rx: 0, ry: 0 };
  }
  function setDie(d, v, spin) {
    const [ax, ay] = FACE_ROT[v];
    if (spin) { d.rx += 720 + 360 * Math.floor(Math.random() * 2); d.ry += 360 + 360 * Math.floor(Math.random() * 2); }
    d.cube.style.transition = spin && !speed.skip ? '' : 'none';
    d.cube.style.transform = 'rotateX(-16deg) rotateY(20deg) rotateX(' + (ax + d.rx) + 'deg) rotateY(' + (ay + d.ry) + 'deg)';
  }
  let trayDice = [];
  function buildTray(spin) {
    const box = $('dice');
    box.innerHTML = '';
    trayDice = [];
    if (!S || !S.dice.length) {
      const n = S ? E.diceCount(S, S.player) : 3;
      box.innerHTML = '<span class="empty">賽 ' + n + ' 個</span>';
      return;
    }
    S.dice.forEach((dv, i) => {
      const d = makeDie(i);
      d.el.addEventListener('click', ev => { ev.stopPropagation(); onDieClick(i, ev.shiftKey); });
      d.el.addEventListener('contextmenu', ev => { ev.preventDefault(); clearSel(); });
      const num = document.createElement('div'); num.className = 'num'; num.innerHTML = '<small>キー</small>' + (i + 1); d.el.appendChild(num);
      box.appendChild(d.el);
      if (spin) { setDie(d, 1 + Math.floor(Math.random() * 6), false); }
      else setDie(d, dv.v, false);
      trayDice.push(d);
    });
    if (spin) requestAnimationFrame(() => requestAnimationFrame(() => trayDice.forEach((d, i) => setDie(d, S.dice[i].v, true))));
    refreshTray();
  }
  function refreshTray() {
    trayDice.forEach((d, i) => {
      const dv = S && S.dice[i];
      if (!dv) return;
      d.el.classList.toggle('used', !!dv.u);
      d.el.classList.toggle('sel', sel.dice.includes(i));
      const old = d.el.querySelector('.rr'); if (old) old.remove();
      if (E.canReroll(S) && !dv.u && !busy && S.cur === S.player) {
        const b = document.createElement('button'); b.className = 'rr'; b.textContent = '↻'; b.title = '天下布武：この賽を振り直す（毎季1度）';
        b.addEventListener('click', ev => { ev.stopPropagation(); doReroll(i); });
        d.el.appendChild(b);
      }
    });
  }
  function showCpuDice(vals) {
    $('cpu-dice').innerHTML = vals.map(v => '<span class="mini">' + miniPips(v) + '</span>').join('');
  }
  function miniPips(v) {
    const pos = { 1: [[9, 9]], 2: [[4, 4], [14, 14]], 3: [[4, 4], [9, 9], [14, 14]], 4: [[4, 4], [14, 4], [4, 14], [14, 14]], 5: [[4, 4], [14, 4], [9, 9], [4, 14], [14, 14]], 6: [[4, 3], [14, 3], [4, 9], [14, 9], [4, 15], [14, 15]] }[v];
    return pos.map(p => '<i style="left:' + p[0] + 'px;top:' + p[1] + 'px' + (v === 1 ? ';background:#c8281c;width:5px;height:5px' : '') + '"></i>').join('');
  }
  function setCpuChip(c) {
    const chip = $('cpuchip');
    chip.classList.remove('hidden');
    $('cpu-mon').textContent = CL[c].mon; $('cpu-mon').style.background = CL[c].col;
    $('cpu-name').textContent = CL[c].n + '家の手番';
    $('cpu-dice').innerHTML = '';
    $('b-fast').classList.toggle('on', speed.fast);
  }

  // ───────── HUD ─────────
  function hud() {
    if (!S || !V) return;
    const me = CL[S.player];
    const d = E.dateLabel(V.turn);
    $('era').textContent = d.era; $('season').textContent = d.season;
    $('left').textContent = '残り ' + (S.maxTurn - V.turn) + ' 季';
    $('me-mon').textContent = me.mon; $('me-mon').style.background = me.col;
    $('me-name').textContent = me.n + '家';
    $('me-who').textContent = me.who;
    $('me-trait').textContent = '【' + me.tn + '】' + me.td;
    const n = V.owner.filter(o => o === S.player).length;
    $('st-prov').textContent = n; $('st-goal').textContent = '/' + S.winProv + '国';
    const kyo = V.owner[E.KYO] === S.player;
    $('st-kyo').textContent = kyo ? '京：掌握' : '京：未';
    $('st-prov-box').classList.toggle('kyo', kyo);
    const myArmies = V.armies.filter(a => a.c === S.player).length;
    $('st-army').textContent = myArmies; $('st-slot').textContent = '/' + E.slots(V, S.player);
    $('st-dice').textContent = E.diceCount(V, S.player);
    $('goalfill').style.width = Math.min(100, n / S.winProv * 100) + '%';
    // 勢力図
    const cn = {}; D.CLANS.forEach(c => { cn[c.id] = 0; }); let neu = 0;
    V.owner.forEach(o => { if (o) cn[o]++; else neu++; });
    const order = D.CLANS.map(c => c.id).sort((a, b) => cn[b] - cn[a]);
    $('powerbar').innerHTML = order.filter(c => cn[c]).map(c => '<div title="' + CL[c].n + ' ' + cn[c] + '" style="flex-grow:' + cn[c] + ';background:' + CL[c].col + (c === S.player ? ';box-shadow:inset 0 0 0 2px #ffe9a8' : '') + '"></div>').join('') + '<div style="flex-grow:' + neu + ';background:#cfc3a3" title="中立 ' + neu + '"></div>';
    $('powerlist').innerHTML = order.map(c => {
      const dead = V.clans[c] && !V.clans[c].alive;
      return '<div class="row' + (dead ? ' dead' : '') + (c === S.player ? ' me' : '') + '"><span class="sw" style="background:' + CL[c].col + '"></span>' + CL[c].n + (V.owner[E.KYO] === c ? '<small style="color:#ff8b78">京</small>' : '') + '<span class="n">' + cn[c] + '</span></div>';
    }).join('');
    $('power-n').textContent = '中立 ' + neu;
    $('coal').textContent = V.coal ? '⚑ ' + CL[V.coal].n + '包囲網' + (V.coal === S.player ? '（あなたが狙われている）' : '') : '';
  }

  // ───────── 進行 ─────────
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); localStorage.setItem(SAVE_KEY + '_log', JSON.stringify(logs)); } catch (e) { /* 無視 */ }
  }
  function renderLog() {
    $('log').innerHTML = logs.map((l, i) => '<div class="e ' + l.cls + (i >= 4 ? ' old' : '') + '"><span class="when">' + l.when + '</span>' + (l.clan ? '<span class="sw" style="background:' + CL[l.clan].col + '"></span>' : '') + '<span>' + l.txt + '</span></div>').join('');
  }
  function hasSave() {
    try { const s = localStorage.getItem(SAVE_KEY); if (!s) return false; const o = JSON.parse(s); return o && !o.over; } catch (e) { return false; }
  }
  function show(id, on) { $(id).classList.toggle('hidden', !on); }
  function showPlayUI(on) { ['hud', 'power', 'menu-btns', 'log', 'tray'].forEach(id => show(id, on)); }

  const URLQ = new URLSearchParams(root.location.search);
  let introShown = false, introDone = null;
  function startGame(clan, seed) {
    lastClan = clan; lastGrow = null;
    if (seed == null && URLQ.get('seed')) seed = Number(URLQ.get('seed'));
    S = E.newGame(clan, seed == null ? (Math.random() * 1e9) >>> 0 : seed);
    V = cloneV(S);
    logs = []; $('log').innerHTML = '';
    U.spread = {}; U.fx = []; U.moved = {}; U.armyDie = {}; U.castleHL = null; U.armyHint = null;
    mode = 'play';
    ['title', 'select', 'result', 'menu', 'help'].forEach(id => show(id, false));
    showPlayUI(true);
    setPrompt(''); $('dice').innerHTML = '';
    hud(); setButtons();
    addLog(CL[clan].who + '、出陣', 'me', clan);
    (async () => {
      busy = true;
      if (tutOn && !introShown) {
        introShown = true;
        show('intro', true);
        await new Promise(res => { introDone = res; });
        show('intro', false);
      }
      const d = E.dateLabel(S.turn);
      A.S.horn();
      await banner(d.era + '　' + d.season, CL[clan].who + '　天下へ', 1300);
      busy = false;
      startPlayerTurn();
    })();
  }
  function loadGame() {
    try {
      const o = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!o || o.over) return false;
      S = o; V = cloneV(S); lastClan = S.player;
      logs = []; $('log').innerHTML = '';
      U.spread = {}; U.fx = []; U.moved = {}; U.armyDie = {}; U.castleHL = null; U.armyHint = null;
      mode = 'play';
      ['title', 'select', 'result', 'menu', 'help'].forEach(id => show(id, false));
      showPlayUI(true);
      try { logs = JSON.parse(localStorage.getItem(SAVE_KEY + '_log')) || []; } catch (e) { logs = []; }
      renderLog();
      addLog('つづきから再開', 'me', S.player);
      hud();
      resumePlayerTurn();
      return true;
    } catch (e) { return false; }
  }

  let lastGrow = null;
  function startPlayerTurn() {
    if (S.over) return finish();
    E.beginClanTurn(S);
    V = cloneV(S);
    U.moved = {}; U.armyDie = {}; undoStack = [];
    // 国が増えて軍勢の枠・賽が増えたら知らせる
    const g = { slot: E.slots(S, S.player), dice: E.diceCount(S, S.player) };
    if (lastGrow && (g.slot > lastGrow.slot || g.dice > lastGrow.dice)) {
      const msg = [];
      if (g.dice > lastGrow.dice) msg.push('賽が <em>' + g.dice + '個</em> に増えた');
      if (g.slot > lastGrow.slot) msg.push('軍勢を <em>' + g.slot + 'つ</em> まで持てる');
      toast('国が増え、' + msg.join('・') + '！');
      addLog(msg.join('・').replace(/<\/?em>/g, ''), 'me', S.player);
      A.S.capture();
    } else if (lastGrow && (g.slot < lastGrow.slot || g.dice < lastGrow.dice)) {
      toast('国が減り、' + (g.dice < lastGrow.dice ? '賽が' + g.dice + '個に' : '軍勢の枠が' + g.slot + 'つに') + '減った');
    }
    lastGrow = g;
    save();
    resumePlayerTurn();
  }
  let toastTimer = null;
  function toast(html, ms) {
    const t = $('toast');
    t.innerHTML = html; t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 3200);
  }
  function resumePlayerTurn() {
    $('cpuchip').classList.add('hidden');
    hud(); computeDanger();
    clearSel();
    if (S.phase === 'place') enterPlace();
    else if (S.phase === 'roll') enterRoll();
    else enterMove();
  }
  function setPrompt(html) { $('prompt').innerHTML = html; }
  function setHint(html) {
    if (!tutOn || !html) { $('hint').classList.add('hidden'); return; }
    $('hint').innerHTML = html; $('hint').classList.remove('hidden');
  }
  function enterPlace() {
    const opts = E.spawnOptions(S, S.player);
    U.castleHL = {};
    opts.forEach(p => { U.castleHL[p] = 'rgba(255,215,100,0.55)'; });
    setPrompt('国が増え、<em>新しい軍勢</em>が出陣できる。<br>出陣させる<em>光る城</em>を選べ。');
    buildTray(false);
    setButtons();
    setHint('新しい軍勢を置く城をクリック（前線の城がおすすめ）');
  }
  async function doSpawn(n) {
    busy = true;
    U.castleHL = null;
    const ev = E.spawn(S, n);
    ev.push({ type: 'sync', snap: snapOf(S) });
    await playEvents(ev);
    busy = false;
    save();
    enterRoll();
  }
  function enterRoll() {
    const n = E.diceCount(S, S.player);
    setPrompt('<em>賽を振れ</em>（Space）　賽は ' + n + ' 個。<br>出目を軍勢に配って進軍する。');
    buildTray(false);
    setButtons();
    if (V.turn === 0) setHint('まずは右下の<em>「賽を振る」</em>（Space）');
    else setHint(null);
  }
  async function doRoll() {
    if (busy || S.phase !== 'roll') return;
    busy = true; setButtons();
    E.roll(S);
    A.S.roll(S.dice.length);
    buildTray(true);
    await wait(950);
    busy = false;
    enterMove();
  }
  async function doReroll(i) {
    if (busy) return;
    const ev = E.reroll(S, i);
    if (!ev.length) return;
    busy = true;
    A.S.roll(1);
    sel.dice = sel.dice.filter(x => x !== i);
    const d = trayDice[i];
    setDie(d, S.dice[i].v, true);
    addLog('天下布武：' + ev[0].old + ' を振り直して ' + ev[0].v, 'me', S.player);
    await wait(900);
    busy = false;
    undoStack = [];
    refreshTray(); computeSel(); setButtons();
  }
  function freeDice() { return S.dice.map((d, i) => (d.u ? -1 : i)).filter(i => i >= 0); }
  function unmovedArmies() { return S.armies.filter(a => a.c === S.player && !a.mv); }
  function enterMove() {
    computeDanger();
    const fd = freeDice(), ua = unmovedArmies();
    if (!fd.length || !ua.length) {
      setPrompt(!fd.length ? '賽を使い切った。<em>手番を終える</em>（Enter）' : '動かせる軍勢がない。<em>手番を終える</em>（Enter）');
    } else if (!sel.dice.length && !sel.army) {
      setPrompt('<em>賽</em>を選び、<em>軍勢</em>を選んで、光るマスへ。<br><span class="k">動かさなかった軍勢は休んで兵が戻る。</span>');
    }
    U.canAct = {};
    if (fd.length) ua.forEach(a => { U.canAct[a.id] = true; });
    if (!sel.dice.length && !sel.army) overviewHints();
    buildTray(false);
    setButtons();
    if (V.turn === 0 && tutOn) {
      if (!U.moved || !Object.keys(U.moved).length) setHint('賽をクリック → 自分の軍勢をクリック → <em>光るマス</em>へ');
      else setHint('残りの賽も使おう。使わない軍勢は休んで兵が戻る。最後に<em>手番を終える</em>');
    } else if (V.turn === 1 && tutOn) setHint('<em>城攻めは城の隣から</em>。赤い点線の丸は、次の季に城を攻められる陣取りの場所');
    else if (V.turn === 2 && tutOn) setHint('<em>ぴったりの出目</em>で敵に着くと奇襲（守りの賽なし）。余った歩数は勢いになる');
    else if (V.turn === 3 && tutOn) setHint('敵の軍勢にマウスを乗せると、次に届く範囲が見える');
    else setHint(null);
    if (V.turn >= 4 && tutOn) { tutOn = false; try { localStorage.setItem(TUT_KEY, 'done'); } catch (e) { /* 無視 */ } setHint(null); }
  }
  function setButtons() {
    const play = mode === 'play' && S && S.cur === S.player && !S.over;
    const rollPh = play && S.phase === 'roll';
    const movePh = play && S.phase === 'move';
    $('b-roll').classList.toggle('hidden', !rollPh && !(play && S.phase === 'place'));
    $('b-roll').disabled = busy || !rollPh;
    $('b-roll').classList.toggle('glow', rollPh && !busy);
    $('b-combine').classList.toggle('hidden', !movePh);
    $('b-combine').classList.toggle('on', sel.combine);
    $('b-combine').disabled = busy || freeDice().length < 2;
    $('b-undo').classList.toggle('hidden', !movePh);
    $('b-undo').disabled = busy || !undoStack.length;
    $('b-end').classList.toggle('hidden', !movePh);
    $('b-end').disabled = busy;
    const done = movePh && (!freeDice().length || !unmovedArmies().length);
    $('b-end').classList.toggle('glow', done && !busy);
    $('b-end').classList.toggle('primary', done);
  }

  function clearSel() {
    sel.army = null; sel.dice = []; curReach = null; U.armyHint = null;
    U.reach = null; U.targets = null; U.stage = null; U.path = null; U.selArmy = null;
    $('forecast').classList.add('hidden');
    if (trayDice.length) refreshTray();
  }
  function onDieClick(i, shift) {
    if (busy || !S || S.phase !== 'move' || S.cur !== S.player) return;
    if (S.dice[i].u) { A.S.deny(); return; }
    const add = shift || sel.combine;
    if (sel.dice.includes(i)) sel.dice = sel.dice.filter(x => x !== i);
    else if (add && sel.dice.length === 1) sel.dice.push(i);
    else if (add && sel.dice.length >= 2) sel.dice = [sel.dice[1], i];
    else sel.dice = [i];
    A.S.click();
    refreshTray();
    computeSel();
  }
  function onArmyClick(id) {
    const a = E.armyById(S, id);
    if (!a || a.c !== S.player) return false;
    if (a.mv) { A.S.deny(); setPrompt('この軍勢は今季もう動いた。'); return true; }
    if (sel.army === id) { sel.army = null; computeSel(); return true; }
    sel.army = id;
    if (!sel.dice.length) {
      // 賽が選ばれていなければ、いちばん大きい目を仮に選ぶ
      const fd = freeDice();
      if (fd.length) sel.dice = [fd.reduce((b, i) => (S.dice[i].v > S.dice[b].v ? i : b), fd[0])];
    }
    A.S.select();
    refreshTray();
    computeSel();
    return true;
  }
  function budget() { return sel.dice.reduce((x, i) => x + S.dice[i].v, 0); }
  function computeSel() {
    U.reach = null; U.targets = null; U.stage = null; U.path = null; curReach = null;
    U.selArmy = sel.army;
    $('forecast').classList.add('hidden');
    U.armyHint = null;
    if (!sel.army) {
      if (sel.dice.length) {
        // その目で攻撃・奇襲できる軍勢に印をつける
        const b0 = budget();
        U.armyHint = {};
        let nk = 0, na = 0;
        for (const a of unmovedArmies()) {
          const r = E.reach(S, a, b0);
          let best = null;
          for (const at of r.attacks) {
            const pv = E.preview(S, a, at.t, at.left);
            if (pv.p <= 0) continue;
            if (pv.kishu && pv.p >= 1) { best = 'kishu'; break; }
            if (!best && pv.p >= 0.5) best = 'atk';
          }
          if (best) { U.armyHint[a.id] = best; if (best === 'kishu') nk++; else na++; }
        }
        setPrompt('出目 <em>' + b0 + '</em>：動かす<em>軍勢</em>をクリック。' + (sel.dice.length === 2 ? '（強行軍）' : '') +
          (nk ? '<br><span class="k">「奇」印の軍勢はこの目でぴったり奇襲できる。</span>' : na ? '<br><span class="k">「攻」印の軍勢はこの目で有利に攻められる。</span>' : ''));
      } else {
        enterMovePromptOnly();
        overviewHints();
      }
      setButtons();
      return;
    }
    const a = E.armyById(S, sel.army);
    if (!sel.dice.length) { setPrompt('使う<em>賽</em>をクリック。'); setButtons(); return; }
    const b = budget();
    const r = E.reach(S, a, b);
    curReach = r;
    U.reach = r.moves;
    U.targets = r.attacks.map(at => { const pv = E.preview(S, a, at.t, at.left); return { n: at.t, p: pv.p, kishu: pv.kishu, left: at.left, from: at.from }; });
    U.stage = r.moves.filter(n => stagingSpot(n, a.c));
    let msg = '出目 <em>' + b + '</em>' + (sel.dice.length === 2 ? '（強行軍）' : '') + '：光るマスへ進軍。';
    if (U.targets.length) msg += '<br><span class="k">×印をクリックで合戦（％は勝つ見込み）。</span>';
    else if (U.stage.length) msg += '<br><span class="k">赤い点線＝城の隣。次の季に城を攻められる。</span>';
    else if (!r.moves.length) msg += '<br><span class="k">この目では動ける場所がない。</span>';
    setPrompt(msg);
    setButtons();
  }
  // 何も選んでいないとき：各軍勢が「どの目なら奇襲／有利に攻められるか」
  function overviewHints() {
    U.armyHint = {};
    if (!S || S.phase !== 'move') return;
    const vals = [...new Set(freeDice().map(i => S.dice[i].v))];
    for (const a of unmovedArmies()) {
      let best = null;
      for (const v of vals) {
        const r = E.reach(S, a, v);
        for (const at of r.attacks) {
          const pv = E.preview(S, a, at.t, at.left);
          if (pv.kishu && pv.p >= 1) { if (!best || best.k !== 'kishu' || v < best.v) best = { k: 'kishu', v, p: 1 }; }
          else if (pv.p >= 0.5 && (!best || (best.k !== 'kishu' && pv.p > best.p))) best = { k: 'atk', v, p: pv.p };
        }
      }
      if (best) U.armyHint[a.id] = best.k + ':' + best.v;
    }
  }
  function enterMovePromptOnly() {
    const fd = freeDice(), ua = unmovedArmies();
    if (!fd.length || !ua.length) setPrompt(!fd.length ? '賽を使い切った。<em>手番を終える</em>（Enter）' : '動かせる軍勢がない。<em>手番を終える</em>（Enter）');
    else setPrompt('<em>賽</em>を選び、<em>軍勢</em>を選んで、光るマスへ。<br><span class="k">動かさなかった軍勢は休んで兵が戻る。</span>');
  }
  function stagingSpot(n, c) {
    const nd = E.nodes[n];
    if (nd.kind !== 'b') return false;
    return S.owner[nd.a] !== c || S.owner[nd.b] !== c;
  }
  function computeDanger() {
    U.danger = {};
    if (!S) return;
    for (let p = 0; p < E.P; p++) {
      if (V.owner[p] !== S.player) continue;
      for (const m of E.adj[p]) if (V.armies.some(a => a.n === m && a.c !== S.player)) { U.danger[p] = true; break; }
    }
  }

  async function doMove(target) {
    if (busy || !sel.army || !sel.dice.length) return;
    const before = JSON.stringify(S);
    const armyId = sel.army, dice = sel.dice.slice();
    const ev = E.move(S, armyId, dice, target);
    if (!ev) { A.S.deny(); return; }
    const isBattle = ev.some(e => e.type === 'battle');
    if (isBattle) undoStack = []; else undoStack.push({ s: before, moved: Object.assign({}, U.moved), die: Object.assign({}, U.armyDie) });
    // 使った賽の目を軍勢に記す
    U.moved[armyId] = true;
    U.armyDie[armyId] = dice.reduce((x, i) => x + S.dice[i].v, 0);
    ev.push({ type: 'sync', snap: snapOf(S) });
    clearSel();
    busy = true; setButtons(); refreshTray();
    await playEvents(ev);
    busy = false;
    hud();
    if (S.over) return finish();
    computeDanger();
    enterMove();
  }
  function doUndo() {
    if (busy || !undoStack.length) return;
    const u = undoStack.pop();
    S = JSON.parse(u.s); V = cloneV(S);
    U.moved = u.moved; U.armyDie = u.die;
    A.S.click();
    clearSel();
    enterMove();
  }
  let endArmed = 0;
  async function endTurn() {
    if (busy || !S || S.cur !== S.player || S.phase !== 'move') return;
    // 賽も動ける軍勢も残っているときは、もう一度押して確定
    if (freeDice().length && unmovedArmies().length && now() - endArmed > 2.5) {
      endArmed = now();
      A.S.click();
      $('b-end').textContent = 'もう一度で終える';
      setPrompt('賽がまだ <em>' + freeDice().length + '個</em> 残っている。<br>このまま終えるなら、もう一度「手番を終える」（動かない軍勢は休んで兵が戻る）。');
      setTimeout(() => { $('b-end').textContent = '手番を終える'; }, 2500);
      return;
    }
    endArmed = 0;
    $('b-end').textContent = '手番を終える';
    clearSel();
    busy = true; setButtons(); setHint(null);
    U.canAct = {};
    let ev = E.endClanTurn(S);
    ev.push({ type: 'sync', snap: snapOf(S) });
    await playEvents(ev);
    U.moved = {}; U.armyDie = {};
    ev = E.advance(S);
    ev.push({ type: 'sync', snap: snapOf(S) });
    await playEvents(ev);
    await cpuPhase();
  }
  async function cpuPhase() {
    busy = true;
    $('tip').classList.add('hidden'); U.enemyReach = null; U.path = null;
    speed.mul = speed.fast ? 3 : 1.3;
    setButtons();
    $('dice').innerHTML = '<span class="empty">諸大名が動いている…</span>';
    setPrompt('<em>CPUの手番</em>　画面上の「早送り」（F）「飛ばす」（S）で速くできる。');
    while (!S.over && S.cur !== S.player) {
      const c = S.cur;
      const ev = E.beginClanTurn(S).concat(AI.playTurn(S));
      ev.push({ type: 'sync', snap: snapOf(S) });
      await playEvents(ev);
      if (S.over) break;
      const ev2 = E.advance(S);
      ev2.push({ type: 'sync', snap: snapOf(S), keepTurn: true });
      // 季節の見出しは同期のあとで
      const season = ev2.filter(e => e.type === 'season');
      const rest = ev2.filter(e => e.type !== 'season');
      await playEvents(rest);
      speed.mul = 1;
      const skip = speed.skip; speed.skip = false;
      if (season.length && !S.over) await playEvents(season);
      speed.skip = skip;
      speed.mul = speed.fast ? 3 : 1.3;
      if (c && !S.clans[c]) break;
    }
    speed.skip = false; speed.mul = 1;
    $('cpuchip').classList.add('hidden');
    V = cloneV(S);
    busy = false;
    if (S.over) return finish();
    startPlayerTurn();
  }

  // ───────── 決着 ─────────
  function finish() {
    busy = false;
    V = cloneV(S);
    hud();
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 無視 */ }
    setTimeout(showResult, 900);
  }
  function showResult() {
    const o = S.over, me = CL[S.player];
    const head = $('res-head'), sub = $('res-sub');
    const n = S.owner.filter(x => x === S.player).length;
    let big, txt, cls;
    if (o.kind === 'win') { big = '天下布武'; cls = 'win'; txt = me.who + '、京を押さえ' + n + 'か国を従える。戦国の世はあなたの采配で一つにまとまった。'; A.S.big(); }
    else if (o.kind === 'top') { big = '天下第一の大名'; cls = 'win'; txt = '永禄の世が終わる。' + n + 'か国を治める' + me.n + '家が、諸大名の中で最も大きい。'; A.S.win(); }
    else if (o.reason === 'tenka') { big = '天下は' + CL[o.clan].n + 'へ'; cls = 'lose'; txt = CL[o.clan].who + 'が京を押さえ、' + S.winProv + 'か国を従えた。'; A.S.lose(); }
    else if (o.reason === 'fall') { big = me.n + '家 滅亡'; cls = 'lose'; txt = 'すべての城を失った。' + (o.by ? CL[o.by].who + 'の軍勢が最後の城に迫った。' : ''); A.S.lose(); }
    else { big = '群雄のひとり'; cls = 'lose'; txt = '永禄の世が終わる。' + me.n + '家は' + n + 'か国、' + o.place + '番目の勢力として残った。'; A.S.win(); }
    head.textContent = big; head.className = 'big ' + cls; sub.textContent = txt;
    const st = S.clans[S.player];
    $('res-stats').innerHTML = [['治めた国', n], ['最大版図', st.peak || n], ['落とした城', st.cap], ['合戦 勝/敗', st.won + '/' + st.lost], ['奇襲', st.kishu], ['決着', (d => d.era + d.season)(E.dateLabel(Math.min(o.turn, S.maxTurn - 1)))]].map(x => '<div><b>' + x[1] + '</b>' + x[0] + '</div>').join('');
    drawChart();
    show('result', true);
    mode = 'result';
    showPlayUI(false);
  }
  function drawChart() {
    const c = $('res-chart'), x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    const hist = S.hist, T = Math.max(hist.length - 1, 1);
    const maxN = Math.max(S.winProv, ...hist.map(h => Math.max(...Object.values(h))));
    const X = t => 40 + (c.width - 70) * t / T, Y = n => c.height - 30 - (c.height - 60) * n / maxN;
    x.strokeStyle = 'rgba(255,240,200,0.15)'; x.lineWidth = 1;
    for (let n = 0; n <= maxN; n += 5) { x.beginPath(); x.moveTo(40, Y(n)); x.lineTo(c.width - 30, Y(n)); x.stroke(); x.fillStyle = 'rgba(255,240,200,0.5)'; x.font = '20px sans-serif'; x.fillText(String(n), 8, Y(n) + 6); }
    x.setLineDash([8, 6]); x.strokeStyle = 'rgba(255,120,90,0.6)'; x.beginPath(); x.moveTo(40, Y(S.winProv)); x.lineTo(c.width - 30, Y(S.winProv)); x.stroke(); x.setLineDash([]);
    const ids = D.CLANS.map(cc => cc.id).sort((a, b) => (a === S.player) - (b === S.player));
    for (const id of ids) {
      x.beginPath();
      hist.forEach((h, t) => { const v = h[id] || 0; if (t) x.lineTo(X(t), Y(v)); else x.moveTo(X(t), Y(v)); });
      x.strokeStyle = CL[id].col; x.lineWidth = id === S.player ? 7 : 3; x.globalAlpha = id === S.player ? 1 : 0.65; x.stroke(); x.globalAlpha = 1;
    }
  }

  // ───────── 入力 ─────────
  const cv = $('map');
  function hitAt(ev) { return R.hitTest(ev.clientX, ev.clientY, V || BG); }
  cv.addEventListener('mousemove', ev => {
    if (mode === 'select') return;
    if (mode !== 'play' || !V) { $('tip').classList.add('hidden'); return; }
    const h = hitAt(ev);
    hoverInfo = h;
    updateHover(h, ev.clientX, ev.clientY);
  });
  cv.addEventListener('mouseleave', () => { $('tip').classList.add('hidden'); });
  function nodeOfHit(h) { if (!h) return null; if (h.kind === 'army' || h.kind === 'node') return h.n; return null; }
  function updateHover(h, mx, my) {
    const tip = $('tip');
    U.path = null; U.pathAttack = false; U.enemyReach = null;
    $('forecast').classList.add('hidden');
    const n = nodeOfHit(h);
    // 経路と見込み
    if (curReach && n != null && !busy) {
      const a = E.armyById(S, sel.army);
      const tg = U.targets && U.targets.find(x => x.n === n);
      if (tg && a) {
        const path = E.pathTo(curReach, a.n, tg.from).concat([tg.n]);
        U.path = path; U.pathAttack = true; U.pathCost = path.map(m => E.nodeCost(S, a.c, m));
        showForecast(a, tg, mx, my);
        tip.classList.add('hidden');
        return;
      }
      if (curReach.moves.includes(n) && a) {
        const path = E.pathTo(curReach, a.n, n);
        U.path = path; U.pathCost = path.map(m => E.nodeCost(S, a.c, m));
      }
    }
    // 敵の軍勢の届く範囲
    if (h && h.kind === 'army') {
      const a = V.armies.find(x => x.id === h.id);
      if (a && a.c !== (S && S.player) && !sel.army) {
        const r = E.reach(V, a, 6);
        const list = [];
        for (const m of r.moves) list.push([m, 1 - r.dist[m] / 7]);
        for (const at of r.attacks) list.push([at.t, 1]);
        U.enemyReach = list;
      }
    }
    const html = tipHtml(h);
    if (html) {
      tip.innerHTML = html; tip.classList.remove('hidden');
      const w = tip.offsetWidth, hh = tip.offsetHeight;
      tip.style.left = Math.min(innerWidth - w - 8, mx + 16) + 'px';
      tip.style.top = Math.min(innerHeight - hh - 8, my + 14) + 'px';
    } else tip.classList.add('hidden');
  }
  function tipHtml(h) {
    if (!h || !V) return '';
    if (h.kind === 'army') {
      const a = V.armies.find(x => x.id === h.id); if (!a) return '';
      const c = CL[a.c];
      let s = '<b>' + c.n + '家の軍勢</b>　兵 ' + a.t;
      if (a.c === S.player) s += (U.moved[a.id] ? '<br>今季は動いた' : '<br>動かさなければ休んで兵 +' + E.healAmount(S, E.armyById(S, a.id) || a)) ;
      else s += '<br><span style="color:#ffb08a">オレンジ＝次の季に届く範囲</span>';
      const nd = E.nodes[a.n];
      if (nd.kind === 'c') s += '<br>' + PN(nd.p) + '・' + D.PROV[nd.p].c + 'に籠もる';
      return s;
    }
    let p = null, n = null;
    if (h.kind === 'node') { n = h.n; if (E.nodes[n].kind === 'c') p = E.nodes[n].p; }
    if (h.kind === 'prov') p = h.p;
    if (p != null) {
      const o = V.owner[p], pr = D.PROV[p];
      let s = '<b>' + pr.n + '</b>　' + pr.c + (p === E.KYO ? '（京）' : '') + '<br>' + (o ? CL[o].n + '家' : '中立（国衆）') + '　石高 ' + '★'.repeat(pr.k);
      const ar = V.armies.find(a => a.n === p);
      s += '<br>' + (ar ? '籠もる軍勢 兵' + ar.t : '守備兵 ' + V.gar[p] + ' / ' + E.garMax(V, p, o)) + '　城の守り +' + E.castleDef(V, p, o) + (E.CAPITAL[p] ? '（本拠）' : '');
      if (o === S.player && U.danger && U.danger[p]) s += '<br><span style="color:#ff8b78">隣に敵が陣取っている！次の季に攻められる。</span><br><span style="color:#ffd96a">守り方：城に軍勢を入れる／城の隣に味方を置いて加勢／陣取った敵を先に攻める</span>';
      return s;
    }
    if (n != null) {
      const nd = E.nodes[n];
      const nm = nd.name || PN(nd.a) + '・' + PN(nd.b) + 'の国境';
      const typ = nd.t === 'P' ? '峠：入るのに2歩（冬は3歩）。守り手+1' : nd.t === 'S' ? '海路：渡るのに2歩（冬は3歩）' : '街道：1歩';
      return '<b>' + nm + '</b><br>' + typ;
    }
    return '';
  }
  function showForecast(a, tg, mx, my) {
    const pv = E.preview(S, a, tg.n, tg.left);
    const f = $('forecast');
    const nd = E.nodes[tg.n];
    const where = nd.kind === 'c' ? PN(nd.p) + '・' + D.PROV[nd.p].c : (nd.name || '国境');
    const dc = pv.D.clan;
    f.innerHTML = '<div class="hd">' + (nd.kind === 'c' ? '城攻め：' : '合戦：') + where + '</div>' +
      '<div class="row"><span class="side">味方</span><span>' + pv.A.parts.filter(p => p[0] !== '奇襲').map(p => p[0] + p[1]).join(' ＋ ') + '</span><span class="tot">' + pv.A.total + '</span></div>' +
      '<div class="row"><span class="side">' + (dc ? CL[dc].n : '国衆') + '</span><span>' + pv.D.parts.map(p => p[0] + p[1]).join(' ＋ ') + (pv.kishu ? '' : ' ＋ 賽') + '</span><span class="tot">' + pv.D.total + (pv.kishu ? '' : '＋?') + '</span></div>' +
      '<div class="p" style="color:' + (pv.p >= 0.67 ? '#ffd96a' : pv.p >= 0.34 ? '#ffc08a' : '#ff8b78') + '">勝つ見込み ' + Math.round(pv.p * 100) + '%</div>' +
      '<div class="note">' + (pv.kishu ? (pv.p > 0 ? '奇襲！ぴったり到着で守りの賽なし' : '奇襲でも力が足りない') : '余り ' + tg.left + ' 歩が勢いに' + (tg.left === 0 ? '' : '（ぴったりなら奇襲）')) + '</div>' +
      (pv.p < 0.67 && !pv.A.parts.some(p => p[0] === '加勢') ? '<div class="note" style="color:#ffc08a">攻め先の隣に味方を置くと加勢＋' + E.supVal(a.c) + '</div>' : '');
    f.classList.remove('hidden');
    const w = f.offsetWidth, hh = f.offsetHeight;
    f.style.left = Math.max(8, Math.min(innerWidth - w - 8, mx + 22)) + 'px';
    f.style.top = Math.max(8, Math.min(innerHeight - hh - 8, my - hh - 14)) + 'px';
  }

  // 地図の拡大（ホイール）と移動（ドラッグ）
  let drag = null, dragged = false;
  cv.addEventListener('wheel', ev => {
    if (mode !== 'play' && mode !== 'view') return;
    ev.preventDefault();
    R.zoomAt(ev.clientX, ev.clientY, ev.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });
  cv.addEventListener('mousedown', ev => { if (ev.button === 0 || ev.button === 1) { drag = { x: ev.clientX, y: ev.clientY, moved: false }; dragged = false; } });
  root.addEventListener('mousemove', ev => {
    if (!drag) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (R.view.z <= 1.001) return;   // 拡大していなければ動かさない
    drag.moved = true; dragged = true;
    R.panBy(dx, dy); drag.x = ev.clientX; drag.y = ev.clientY;
    cv.style.cursor = 'grabbing';
  });
  root.addEventListener('mouseup', () => { drag = null; cv.style.cursor = ''; });

  cv.addEventListener('click', ev => {
    A.ensure();
    if (dragged) { dragged = false; return; }
    if (mode !== 'play') return;
    if (busy) { speed.hurry = true; return; }
    if (!S || S.cur !== S.player) return;
    const h = hitAt(ev);
    if (S.phase === 'place') {
      const n = nodeOfHit(h) != null ? nodeOfHit(h) : (h && h.kind === 'prov' ? h.p : null);
      if (n != null && n < E.P && E.spawnOptions(S, S.player).includes(n)) doSpawn(n);
      else A.S.deny();
      return;
    }
    if (S.phase !== 'move') return;
    // 攻撃・移動（選択中は、届くマス・攻め先を少し広めに拾う）
    let n = nodeOfHit(h);
    if (curReach) {
      const cand = curReach.moves.concat((U.targets || []).map(t => t.n));
      const [wx, wy] = R.toWorld(ev.clientX, ev.clientY);
      let bn = null, bd = 24;
      for (const m of cand) { const d = Math.hypot(POS[m][0] - wx, POS[m][1] - wy); if (d < bd) { bd = d; bn = m; } }
      const ownArmyHit = h && h.kind === 'army' && (E.armyById(S, h.id) || {}).c === S.player;
      if (bn != null && !ownArmyHit) n = bn;
    }
    if (curReach && n != null) {
      if (U.targets && U.targets.some(t => t.n === n)) { doMove(n); return; }
      if (curReach.moves.includes(n) && !(h && h.kind === 'army' && h.n === n)) { doMove(n); return; }
    }
    if (h && h.kind === 'army') {
      if (onArmyClick(h.id)) return;
    }
    if (curReach && n != null && curReach.moves.includes(n)) { doMove(n); return; }
    // 届かない場所を押した
    if (curReach && n != null) {
      A.S.deny();
      const nd = E.nodes[n];
      const enemyCastle = nd.kind === 'c' && S.owner[nd.p] !== S.player;
      const sa = E.armyById(S, sel.army);
      setPrompt(enemyCastle && sa && !E.adj[n].includes(sa.n)
        ? 'そこは攻められない。<em>城攻めは、手番のはじめに城の隣にいる軍勢だけ</em>。まず隣（赤い「陣」）に進もう。'
        : 'その目では届かない。<em>光るマス</em>か<em>×印</em>を選ぶ。別の賽も試せる。');
      return;
    }
    // 何もないところ：選択を解く
    if (sel.army) { sel.army = null; computeSel(); }
  });
  cv.addEventListener('contextmenu', ev => { ev.preventDefault(); if (mode === 'play' && !busy) { clearSel(); enterMovePromptOnly(); setButtons(); } });

  root.addEventListener('keydown', ev => {
    if (mode !== 'play') {
      if (ev.key === 'Escape' && !$('help').classList.contains('hidden')) closeHelp();
      return;
    }
    A.ensure();
    const k = ev.key;
    if (k === 'f' || k === 'F') { toggleFast(); return; }
    if (k === '0') { R.resetView(); return; }
    if (k === 's' || k === 'S') { if (busy && S.cur !== S.player) speed.skip = true; return; }
    if (busy) { if (k === ' ' || k === 'Enter') speed.hurry = true; return; }
    if (k === ' ') { ev.preventDefault(); if (S.phase === 'roll') doRoll(); return; }
    if (k === 'Enter') { endTurn(); return; }
    if (k === 'Escape') { clearSel(); enterMovePromptOnly(); setButtons(); return; }
    if (k === 'z' || k === 'Z') { doUndo(); return; }
    if (/^[1-6]$/.test(k)) { const i = Number(k) - 1; if (S.dice[i]) onDieClick(i, ev.shiftKey); }
  });
  function toggleFast() { speed.fast = !speed.fast; speed.mul = busy && S && S.cur !== S.player ? (speed.fast ? 3 : 1.3) : speed.mul; $('b-fast').classList.toggle('on', speed.fast); }

  // ボタン
  $('b-roll').addEventListener('click', () => { A.ensure(); doRoll(); });
  $('b-end').addEventListener('click', () => { A.ensure(); endTurn(); });
  $('b-undo').addEventListener('click', () => doUndo());
  $('b-combine').addEventListener('click', () => {
    sel.combine = !sel.combine; A.S.click();
    if (!sel.combine && sel.dice.length > 1) sel.dice = sel.dice.slice(0, 1);
    setButtons(); refreshTray(); computeSel();
    setPrompt(sel.combine ? '<em>強行軍</em>：賽を2つ選ぶと、目を足して1つの軍勢を遠くまで動かせる。' : $('prompt').innerHTML);
  });
  $('b-fast').addEventListener('click', () => toggleFast());
  $('b-skip').addEventListener('click', () => { if (busy) speed.skip = true; });
  $('b-sound').addEventListener('click', () => { A.ensure(); A.setOn(!A.on); $('b-sound').classList.toggle('off', !A.on); });
  $('b-bgm').addEventListener('click', () => { A.ensure(); A.setBgm(!A.bgmOn); $('b-bgm').classList.toggle('off', !A.bgmOn); });
  $('b-help').addEventListener('click', () => openHelp());
  $('b-menu').addEventListener('click', () => { show('menu', true); });
  $('b-m-resume').addEventListener('click', () => show('menu', false));
  $('b-m-help').addEventListener('click', () => { show('menu', false); openHelp(); });
  $('b-m-restart').addEventListener('click', () => { show('menu', false); if (!busy) startGame(lastClan); });
  $('b-m-title').addEventListener('click', () => { show('menu', false); toTitle(); });
  $('b-help-close').addEventListener('click', () => closeHelp());
  $('b-intro-go').addEventListener('click', () => { A.ensure(); A.S.click(); if (introDone) { const f = introDone; introDone = null; f(); } });
  $('b-intro-help').addEventListener('click', () => openHelp());
  let helpFrom = null;
  function openHelp() { helpFrom = mode; show('help', true); }
  function closeHelp() { show('help', false); }

  // タイトル・大名選び
  function toTitle() {
    mode = 'title';
    showPlayUI(false);
    ['select', 'result', 'menu', 'help'].forEach(id => show(id, false));
    $('cpuchip').classList.add('hidden'); $('hint').classList.add('hidden'); $('battle').classList.add('hidden');
    show('title', true);
    $('b-cont').disabled = !hasSave();
    V = null; S = null;
  }
  $('b-new').addEventListener('click', () => { A.ensure(); A.S.click(); openSelect(); });
  $('b-cont').addEventListener('click', () => { A.ensure(); if (!loadGame()) $('b-cont').disabled = true; });
  $('b-howto').addEventListener('click', () => { A.ensure(); openHelp(); });
  $('b-back').addEventListener('click', () => { show('select', false); show('title', true); mode = 'title'; U.castleHL = null; });
  $('b-go').addEventListener('click', () => { if (pickClan) { A.ensure(); startGame(pickClan); } });
  $('b-again').addEventListener('click', () => { show('result', false); startGame(lastClan); });
  $('b-other').addEventListener('click', () => { show('result', false); openSelect(); });
  $('b-res-map').addEventListener('click', () => {
    show('result', false); mode = 'view'; showPlayUI(true); show('tray', false);
    $('hint').innerHTML = '地図を見ています。<em>クリックで結果に戻る</em>'; $('hint').classList.remove('hidden');
    const back = () => { cv.removeEventListener('click', back); $('hint').classList.add('hidden'); showResult(); };
    setTimeout(() => cv.addEventListener('click', back), 50);
  });

  function openSelect() {
    mode = 'select';
    show('title', false); show('select', true);
    const box = $('clans');
    box.innerHTML = D.CLANS.map(c => {
      const nA = c.armies.length, nP = c.start.length;
      return '<div class="clan" data-id="' + c.id + '"><span class="mon md" style="background:' + c.col + '">' + c.mon + '</span><div><div class="nm">' + c.n + '家</div><div class="who">' + c.who + '</div><div class="lv">' + '難易度 ' + ['', '易', '中', '難'][c.lvl] + '</div><div class="st">' + nP + 'か国・軍勢' + nA + '・' + c.tn + '</div></div></div>';
    }).join('');
    box.querySelectorAll('.clan').forEach(el => el.addEventListener('click', () => pick(el.dataset.id)));
    pick(pickClan || lastClan || 'uesugi');
  }
  function pick(id) {
    pickClan = id;
    const c = CL[id];
    $('clans').querySelectorAll('.clan').forEach(el => el.classList.toggle('sel', el.dataset.id === id));
    $('clan-detail').innerHTML = '<span class="mon" style="background:' + c.col + ';width:60px;height:60px;font-size:32px">' + c.mon + '</span><div class="txt"><b>' + c.n + '家　' + c.who + '</b><br><span style="color:#d9caa3">' + c.start.map(p => D.PROV[E.PI[p]].n).join('・') + '　難易度 ' + ['', '易', '中', '難'][c.lvl] + '</span><br>' + c.blurb + '<br><span class="trait">【' + c.tn + '】' + c.td + '</span></div>';
    U.castleHL = {};
    c.start.forEach(p => { U.castleHL[E.PI[p]] = 'rgba(255,230,140,0.7)'; });
    A.S.click();
  }

  // ───────── 描画ループ ─────────
  function frame() {
    const t = now();
    U.fx = U.fx.filter(f => t - f.t0 < f.dur);
    for (const k in U.spread) if (t - U.spread[k].t0 > U.spread[k].dur) delete U.spread[k];
    if (U.shakeUntil && t > U.shakeUntil) U.shake = 0;
    const st = V || BG;
    if (st) {
      U.winter = E.isWinter(st);
      const uu = (mode === 'play' || mode === 'view') ? U : { castleHL: mode === 'select' ? U.castleHL : null, fx: [], spread: {} };
      R.draw(st, uu, t);
    }
    requestAnimationFrame(frame);
  }

  // ───────── 起動 ─────────
  R.init(cv);
  BG = cloneV(E.newGame(null, 7));
  function uiScale() {
    const z = Math.max(0.78, Math.min(1.15, Math.min(innerWidth / 1600, innerHeight / 900) * 1.05));
    document.documentElement.style.setProperty('--uiz', z.toFixed(3));
  }
  uiScale();
  root.addEventListener('resize', () => { R.resize(); uiScale(); });
  $('b-cont').disabled = !hasSave();
  $('b-sound').classList.toggle('off', !A.on);
  $('b-bgm').classList.toggle('off', !A.bgmOn);
  requestAnimationFrame(frame);

  // ───────── 検証用フック ─────────
  const errors = [];
  root.addEventListener('error', e => errors.push(String(e.message || e)));
  root.SG15 = {
    errors,
    get S() { return S; }, get V() { return V; }, U, sel, speed,
    debug: {
      busy: () => busy, mode: () => mode,
      nodeScreen(n) { const p = POS[n]; return R.toScreen(p[0], p[1]); },
      buttons() {
        const out = {};
        document.querySelectorAll('button').forEach(b => {
          if (!b.id || b.disabled) return;
          const r = b.getBoundingClientRect();
          if (r.width && r.height && b.offsetParent !== null) out[b.id] = [r.left + r.width / 2, r.top + r.height / 2];
        });
        trayDice.forEach((d, i) => { const r = d.el.getBoundingClientRect(); out['die' + i] = [r.left + r.width / 2, r.top + r.height / 2]; });
        document.querySelectorAll('.clan').forEach(el => { const r = el.getBoundingClientRect(); out['clan_' + el.dataset.id] = [r.left + r.width / 2, r.top + r.height / 2]; });
        return out;
      },
      state() { return S ? { turn: S.turn, cur: S.cur, phase: S.phase, over: S.over, dice: S.dice.map(d => d.v + (d.u ? 'u' : '')), mine: S.owner.filter(o => o === S.player).length, armies: S.armies.filter(a => a.c === S.player).map(a => ({ id: a.id, n: a.n, t: a.t, mv: a.mv })) } : null; },
      // 自分の手番の次の一手をCPUの思考で選ぶ（クリック座標つき）
      suggest() {
        if (!S || S.cur !== S.player) return null;
        if (S.phase === 'place') { const n = AI.chooseSpawn(S, S.player); return { kind: 'place', n, at: this.nodeScreen(n) }; }
        if (S.phase !== 'move') return { kind: S.phase };
        const m = AI.nextMove(S, S.player);
        if (!m) return { kind: 'end' };
        const a = E.armyById(S, m.army);
        return { kind: m.kind, army: m.army, dice: m.idxs, target: m.target, armyAt: this.nodeScreen(a.n), targetAt: this.nodeScreen(m.target) };
      },
      setSpeed(v) { speed.mul = v; },
      resync() { V = cloneV(S); hud(); computeDanger(); clearSel(); if (S.phase === 'move') enterMove(); else if (S.phase === 'roll') enterRoll(); else if (S.phase === 'place') enterPlace(); },
      selectDie(i) { onDieClick(i, false); },
      skipTut() { tutOn = false; setHint(null); },
    },
  };
})(window);
