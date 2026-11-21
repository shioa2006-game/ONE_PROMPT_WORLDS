/* 賽駆け 天下 — 進行・入力・画面 */
(function (root) {
  'use strict';
  const SG = root.SG, D = SG.DATA, E = SG.E, AI = SG.AI, R = SG.R, A = SG.A, MAP = SG.MAP;
  const $ = id => document.getElementById(id);
  const CL = {}; D.CLANS.forEach(c => { CL[c.id] = c; });
  const POS = MAP.POS;
  const SAVE_KEY = 'saigakeT_save', SLOT_KEY = 'saigakeT_slot', TUT_KEY = 'saigakeT_tut';
  const PN = p => D.PROV[p].n;
  const GOV = { recruit: '徴兵', develop: '開墾', fortify: '築城', prepare: '攻城準備' };

  let S = null, V = null, BG = null;
  const U = { fx: [], spread: {}, hop: {}, armyPos: {}, moved: {}, armyDie: {}, armyDom: {}, heal: {}, hide: {}, armyScale: {}, me: null };
  let mode = 'title', busy = false, lastClan = null, pickClan = null;
  const speed = { fast: false, skip: false, hurry: false, mul: 1 };
  const sel = { army: null, dice: [], combine: false };
  let undoStack = [], curReach = null, logs = [], news = [], pendingDie = null;
  let tutOn = true;
  try { tutOn = localStorage.getItem(TUT_KEY) !== 'done'; } catch (e) { /* 無視 */ }

  const now = () => performance.now() / 1000;
  const cloneV = s => ({ owner: s.owner.slice(), gar: s.gar.slice(), kok: s.kok.slice(), kp: s.kp.slice(), fort: s.fort.slice(), fp: s.fp.slice(), armies: s.armies.map(a => Object.assign({}, a)), turn: s.turn, clans: JSON.parse(JSON.stringify(s.clans)), player: s.player, coal: s.coal, maxTurn: s.maxTurn });
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

  // ───────── 演出（地図上。世界座標で置き、画面座標で描く） ─────────
  const scr = (x, y) => R.toScreen(x, y);
  function fxPuff(x, y, col, n, spread) {
    const ps = [];
    for (let i = 0; i < (n || 8); i++) { const a = Math.random() * Math.PI * 2, v = (spread || 18) * (0.5 + Math.random()); ps.push([Math.cos(a) * v, Math.sin(a) * v * 0.6 - 6, 3 + Math.random() * 4]); }
    const t0 = now();
    U.fx.push({ t0, dur: 0.7, draw(c, t, g) { const k = (t - t0) / 0.7; const [sx, sy] = scr(x, y); c.globalAlpha = Math.max(0, 0.7 * (1 - k)); c.fillStyle = col || 'rgba(120,100,70,1)'; for (const p of ps) { c.beginPath(); c.arc(sx + p[0] * k * g, sy + (p[1] * k - k * 8) * g, p[2] * (1 + k) * g, 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1; } });
  }
  function fxSparks(x, y) {
    const ps = [];
    for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, v = 14 + Math.random() * 26; ps.push([Math.cos(a) * v, Math.sin(a) * v]); }
    const t0 = now();
    U.fx.push({ t0, dur: 0.45, draw(c, t, g) { const k = (t - t0) / 0.45; const [sx, sy] = scr(x, y); c.strokeStyle = 'rgba(255,200,90,' + (1 - k) + ')'; c.lineWidth = 2; for (const p of ps) { c.beginPath(); c.moveTo(sx + p[0] * k * 0.6 * g, sy + p[1] * k * 0.6 * g); c.lineTo(sx + p[0] * k * g, sy + p[1] * k * g); c.stroke(); } } });
  }
  function fxRing(x, y, col, r0, r1, dur) {
    const t0 = now(); dur = dur || 0.6;
    U.fx.push({ t0, dur, draw(c, t, g) { const k = (t - t0) / dur; const [sx, sy] = scr(x, y); c.beginPath(); c.arc(sx, sy, (r0 + (r1 - r0) * k) * g, 0, Math.PI * 2); c.strokeStyle = col; c.globalAlpha = 1 - k; c.lineWidth = 3; c.stroke(); c.globalAlpha = 1; } });
  }
  function fxText(x, y, txt, col, size, dur) {
    const t0 = now(); dur = dur || 1.2;
    U.fx.push({ t0, dur, draw(c, t, g) { const k = (t - t0) / dur; const [sx, sy] = scr(x, y); const gg = Math.max(0.8, g); c.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25; R.label(c, txt, sx, sy - 22 * k * gg, '800 ' + Math.round((size || 16) * gg) + 'px ' + R.FONT_M, col, 'rgba(250,244,226,0.95)'); c.globalAlpha = 1; } });
  }
  function fxStamp(x, y, txt, col, dur) {
    const t0 = now(); dur = dur || 1.6;
    U.fx.push({ t0, dur, draw(c, t, g) {
      const k = (t - t0) / dur;
      const gg = Math.max(0.8, g);
      const sc = (k < 0.12 ? 1.8 - (k / 0.12) * 0.8 : 1) * gg;
      const [sx, sy] = scr(x, y);
      c.save(); c.translate(sx, sy - 34 * gg); c.rotate(-0.12); c.scale(sc, sc);
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
    logs = logs.slice(0, 60);
    renderLog();
  }
  function renderLog() {
    $('log').innerHTML = logs.slice(0, 7).map((l, i) => '<div class="e ' + l.cls + (i >= 4 ? ' old' : '') + '"><span class="when">' + l.when + '</span>' + (l.clan && CL[l.clan] ? '<span class="sw" style="background:' + CL[l.clan].col + '"></span>' : '') + '<span>' + l.txt + '</span></div>').join('');
  }
  function noteNews(txt, clan, weight) { news.push({ txt, clan, w: weight || 1 }); }

  // ───────── 表示用の状態の更新 ─────────
  const vArmy = id => V.armies.find(a => a.id === id);
  function nearMe(n) {
    if (!S || !V) return false;
    const nd = E.nodes[n];
    if (nd.kind === 'c' && V.owner[nd.p] === S.player) return true;
    for (const m of E.adj[n]) {
      const q = E.nodes[m];
      if (q.kind === 'c' && V.owner[q.p] === S.player) return true;
      if (V.armies.some(a => a.n === m && a.c === S.player)) return true;
    }
    return false;
  }
  function involvesMe(e) {
    if (!S) return false;
    if (e.clan === S.player) return true;
    if (e.type === 'battle') return e.att.c === S.player || e.def.c === S.player;
    if (e.type === 'capture') return e.from === S.player || e.to === S.player;
    if (e.type === 'submit') return e.to === S.player;
    if (e.type === 'move') return nearMe(e.path[e.path.length - 1]);
    if (e.type === 'retreat' || e.type === 'advance') return nearMe(e.to);
    return false;
  }
  const visibleNode = n => R.onScreen(POS[n][0], POS[n][1], -20);
  // 自分に関わる出来事が画面の外なら、カメラを寄せる
  async function ensureVisible(n) {
    if (speed.skip || visibleNode(n)) return;
    const z = Math.max(R.zoom.z, 0.95 / Math.min(innerWidth / R.W, innerHeight / R.H));
    R.flyTo(POS[n][0], POS[n][1], z, 380);
    await wait(400);
  }

  async function animMove(e) {
    const a = vArmy(e.army); if (!a) return;
    const mine = isMe(e.clan), near = involvesMe(e);
    const end = e.path[e.path.length - 1];
    const seen = visibleNode(e.path[0]) || visibleNode(end);
    // 画面の外の動きは見せない（自分に関わる合戦は animBattle がカメラを寄せる）
    if (!mine && (!seen || (!near && speed.fast))) { a.n = end; return; }
    const stepMs = mine ? 170 : near ? 120 : 45;
    for (let i = 1; i < e.path.length; i++) {
      const p0 = POS[e.path[i - 1]], p1 = POS[e.path[i]];
      await tween(stepMs, k => {
        U.armyPos[a.id] = [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k];
        U.hop[a.id] = Math.sin(k * Math.PI) * (mine ? 7 : 4);
      });
      if (mine || near) { A.S.step(i); fxPuff(p1[0], p1[1] + 10, 'rgba(140,115,80,1)', 4, 10); }
    }
    a.n = end;
    delete U.armyPos[a.id]; delete U.hop[a.id];
  }
  async function animStep(id, from, to, ms) {
    const a = vArmy(id); if (!a) return;
    if (!ms) { a.n = to; return; }
    const p0 = POS[from], p1 = POS[to];
    await tween(ms, k => { U.armyPos[id] = [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k]; });
    a.n = to; delete U.armyPos[id];
  }

  function sideInfo(c, prov) {
    if (c) return { mon: CL[c].mon, col: CL[c].col, nm: CL[c].n + '軍' };
    return { mon: '国', col: '#7a705e', nm: (prov >= 0 ? PN(prov) + 'の' : '') + '国衆' };
  }
  function partsTxt(parts) {
    return parts.filter(p => p[0] !== '奇襲').map((p, i) => (i ? '＋' : '') + p[0] + p[1]).join(' ');
  }
  function placeName(e) {
    return e.castle ? PN(e.prov) + '・' + D.PROV[e.prov].c : (E.nodes[e.node].name || PN(E.nodes[e.node].a) + 'と' + PN(E.nodes[e.node].b) + 'の境');
  }
  async function animBattle(e) {
    const p = POS[e.node];
    const mine = e.att.c === S.player || e.def.c === S.player;
    if (!mine) {
      if (visibleNode(e.node) && !speed.fast) {
        fxSparks(p[0], p[1]);
        fxRing(p[0], p[1], 'rgba(255,120,80,0.9)', 8, 26, 0.4);
        await wait(e.castle ? 200 : 150);
      }
      applyBattleNumbers(e, visibleNode(e.node));
      return;
    }
    await ensureVisible(e.node);
    fxSparks(p[0], p[1]);
    const at = sideInfo(e.att.c, -1), df = sideInfo(e.def.c, e.prov);
    const place = placeName(e);
    const B = $('battle');
    B.innerHTML = '<div class="ttl">' + (e.castle ? '城攻め' : '合戦') + '　' + place + '</div>' +
      '<div class="cols">' +
      '<div class="side"><span class="mon md" style="background:' + at.col + '">' + at.mon + '</span><div class="nm">' + at.nm + '</div><div class="parts">' + partsTxt(e.A) + (e.kishu ? '<div class="kishu">奇襲！</div>' : '') + '</div><div class="tot" id="bt-a">' + e.SA + '</div></div>' +
      '<div class="vs">対</div>' +
      '<div class="side"><span class="mon md" style="background:' + df.col + '">' + df.mon + '</span><div class="nm">' + df.nm + '</div><div class="parts">' + partsTxt(e.D) + '</div><div class="tot" id="bt-d">' + e.SDb + (e.kishu ? '' : '＋？') + '</div><div class="ddie" id="bt-die"></div></div>' +
      '</div><div class="res" id="bt-res"></div><div class="loss" id="bt-loss"></div><div class="skipnote">地図をクリック／Space で早送り</div>';
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
    applyBattleNumbers(e, true);
    await wait(1000);
    B.classList.add('hidden');
    if (e.att.c === S.player) addLog((win ? '勝利：' : '敗退：') + place + (e.kishu ? '（奇襲）' : ''), win ? 'me' : 'bad', S.player);
    else addLog((win ? '敗北：' : '防戦：') + place + ' ← ' + (e.att.c ? CL[e.att.c].n : ''), win ? 'bad' : 'me', e.att.c);
  }
  function applyBattleNumbers(e, show) {
    const a = vArmy(e.att.id);
    if (a) a.t = Math.max(0, e.att.t1);
    if (e.def.id) { const d = vArmy(e.def.id); if (d) d.t = Math.max(0, e.def.t1); }
    if (e.castle) V.gar[e.prov] = e.def.g1;
    if (!show) return;
    const p = POS[e.node];
    if (e.lossA) fxText(POS[e.from][0], POS[e.from][1] - 14, '−' + e.lossA, '#b8281c', 15);
    if (e.lossD && (e.def.id || !e.win)) fxText(p[0] + 6, p[1] - 14, '−' + e.lossD, '#b8281c', 15);
  }
  async function animRout(e) {
    const a = vArmy(e.army); if (!a) return;
    const p = POS[a.n];
    const near = isMe(e.clan) || involvesMe(e);
    if (!near && (!visibleNode(a.n) || speed.fast)) { V.armies = V.armies.filter(x => x.id !== e.army); return; }
    fxPuff(p[0], p[1], 'rgba(70,60,50,1)', 12, 24);
    if (near) fxText(p[0], p[1] - 20, e.trapped ? '包囲され壊滅' : '壊滅', '#7a1a10', 16);
    await tween(isMe(e.clan) ? 400 : 160, k => { U.armyScale[a.id] = 1 - k; });
    V.armies = V.armies.filter(x => x.id !== e.army);
    delete U.armyScale[e.army];
    if (isMe(e.clan)) addLog('軍勢が壊滅した', 'bad', e.clan);
  }
  const notable = c => !!c && (CL[c].major || isMe(c));
  async function animCapture(e) {
    const p = e.prov, q = POS[p];
    const mine = e.to === S.player, lost = e.from === S.player;
    const seen = visibleNode(p);
    const dur = mine || lost ? 0.85 : seen ? 0.45 : 0.25;
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
      if (seen) fxPuff(q[0], q[1], 'rgba(90,80,70,1)', 6, 16);
      if (notable(e.to) || notable(e.from) || E.CAPITAL[p] || p === E.KYO) {
        addLog(CL[e.to].n + 'が' + PN(p) + 'を' + (e.from ? CL[e.from].n + 'から' : '') + '奪う', '', e.to);
        if (p === E.KYO) noteNews(CL[e.to].n + 'が京を押さえた', e.to, 5);
        else if ((CL[e.to].major && e.from && CL[e.from].major) || E.CAPITAL[p]) noteNews(CL[e.to].n + 'が' + (e.from ? CL[e.from].n + 'の' : '') + PN(p) + 'を奪う', e.to, 2);
      }
    }
    hud();
    if (mine || lost) await wait(900);
    else if (seen && !speed.fast) await wait(200);
  }
  async function animElim(e) {
    V.armies = V.armies.filter(a => a.c !== e.clan);
    if (V.clans[e.clan]) V.clans[e.clan].alive = false;
    const big = isMe(e.clan) || isMe(e.by) || CL[e.clan].major;
    addLog(CL[e.clan].n + '家 滅亡' + (e.by ? '（' + CL[e.by].n + 'により）' : ''), e.clan === S.player ? 'bad' : '', e.clan);
    noteNews(CL[e.clan].n + '家 滅亡' + (e.by ? '（' + CL[e.by].n + '）' : ''), e.by || e.clan, CL[e.clan].major ? 4 : 2);
    if (big) await banner(CL[e.clan].n + '家 滅亡', e.by ? CL[e.by].who + 'に敗れる' : '', isMe(e.by) ? 1300 : 1000, CL[e.clan].col);
    hud();
  }
  async function animSubmit(e) {
    const mine = e.to === S.player;
    for (const p of e.provs) { U.spread[p] = { from: e.clan, to: e.to, t0: now(), dur: speed.skip ? 0 : (mine ? 0.9 : 0.4) / speed.mul }; V.owner[p] = e.to; }
    for (const id of e.armies) { const a = vArmy(id); if (a) a.c = e.to; }
    if (V.clans[e.clan]) V.clans[e.clan].alive = false;
    addLog(CL[e.clan].n + '家が' + CL[e.to].n + '家に臣従', mine ? 'me' : '', e.to);
    noteNews(CL[e.clan].n + '家が' + CL[e.to].n + '家に臣従', e.to, CL[e.clan].major ? 4 : 2);
    if (mine) {
      await ensureVisible(e.provs[0]);
      A.S.submit();
      const q = POS[e.provs[0]];
      fxStamp(q[0], q[1], '臣従', '#2f6b3a');
      await banner(CL[e.clan].n + '家　臣従', CL[e.clan].who + 'が' + CL[e.to].who + 'の傘下に入る', 1300, CL[e.to].col);
    } else if (CL[e.clan].major || CL[e.to].major && visibleNode(e.provs[0]) && !speed.fast) await wait(250);
    hud();
  }
  async function animHeal(e) {
    const mine = e.list.length && isMe((vArmy(e.list[0].id) || {}).c);
    for (const h of e.list) { const a = vArmy(h.id); if (a) { a.t += h.h; if (mine) U.heal[h.id] = h.h; } }
    if (mine) { A.S.heal(); await wait(700); U.heal = {}; }
  }
  async function animGovern(e) {
    const a = vArmy(e.army);
    const q = POS[e.prov];
    const mine = isMe(e.clan);
    if (a && e.kind === 'recruit') a.t = e.o.to;
    if (e.kind === 'develop') { V.kok[e.prov] = e.o.kok1; V.kp[e.prov] = e.o.kp1; }
    if (e.kind === 'fortify') { V.fort[e.prov] = e.o.fort1; V.fp[e.prov] = e.o.fp1; V.gar[e.prov] = Math.max(V.gar[e.prov], e.o.gar1); }
    if (!mine) return;
    if (e.kind === 'recruit') { A.S.recruit(); fxText(q[0], q[1] - 30, '徴兵　兵+' + e.o.gain, '#7a1a10', 16); }
    if (e.kind === 'develop') {
      A.S.develop(e.o.up > 0);
      if (e.o.up) { fxStamp(q[0], q[1], '石高+' + e.o.up, '#2f6b3a'); addLog(PN(e.prov) + 'の石高が' + e.o.kok1 + 'に', 'me', e.clan); }
      else fxText(q[0], q[1] - 30, '開墾 ' + e.o.kp1 + '/' + E.devNeed(S, e.prov), '#2f6b3a', 15);
    }
    if (e.kind === 'fortify') {
      A.S.fortify(e.o.up > 0);
      if (e.o.up) { fxStamp(q[0], q[1], '普請 成る', '#5a3a1a'); addLog(PN(e.prov) + 'の城の普請が進んだ（守備兵の上限+1）', 'me', e.clan); }
      else fxText(q[0], q[1] - 30, '普請 ' + e.o.fp1 + '/' + E.fortNeed(S, e.prov) + '　守備兵' + e.o.gar1, '#5a3a1a', 15);
    }
    await wait(350);
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
        if (isMe(e.army.c)) { fxPuff(q[0], q[1], 'rgba(255,240,200,1)', 10, 20); fxRing(q[0], q[1], CL[e.army.c].col, 10, 34, 0.6); A.S.horn(); fxText(q[0], q[1] - 30, '出陣', '#7a1a10', 16); await wait(600); }
        else if (visibleNode(e.army.n) && !speed.fast) { fxRing(q[0], q[1], CL[e.army.c].col, 10, 30, 0.5); await wait(60); }
        break;
      }
      case 'roll': if (!isMe(S.cur) && mode === 'play') showCpuDice(e.dice); break;
      case 'move': await animMove(e); break;
      case 'battle': await animBattle(e); break;
      case 'retreat': await animStep(e.army, e.from, e.to, involvesMe(e) ? 200 : visibleNode(e.to) && !speed.fast ? 70 : 0); break;
      case 'rout': await animRout(e); break;
      case 'advance': await animStep(e.army, e.from, e.to, isMe((vArmy(e.army) || {}).c) ? 200 : visibleNode(e.to) && !speed.fast ? 60 : 0); break;
      case 'capture': await animCapture(e); break;
      case 'eliminated': await animElim(e); break;
      case 'submit': await animSubmit(e); break;
      case 'heal': await animHeal(e); break;
      case 'govern': await animGovern(e); break;
      case 'prepare': {
        if (isMe(e.clan) || isMe(V.owner[e.target])) {
          const msg = CL[e.clan].n + '軍、' + PN(e.target) + 'の攻城準備 ' + e.before + ' → ' + e.after;
          addLog(msg, isMe(e.clan) ? 'me' : 'bad', e.clan);
          if (!isMe(e.clan)) noteNews(msg, e.clan, 4);
        }
        break;
      }
      case 'disrupt': {
        const army = vArmy(e.army);
        if (army && (isMe(army.c) || isMe(S.cur))) addLog(CL[army.c].n + '軍の攻城準備 ' + e.before + ' → ' + e.after, '', army.c);
        break;
      }
      case 'dice': if (isMe((vArmy(e.army) || {}).c)) { U.moved[e.army] = true; U.armyDie[e.army] = e.used.map(i => S.dice[i] ? S.dice[i].v : 0).reduce((a, b) => a + b, 0); } break;
      case 'coalition':
        addLog(CL[e.clan].n + '包囲網が結ばれた', e.clan === S.player ? 'bad' : '', e.clan);
        noteNews(CL[e.clan].n + '包囲網が結ばれた', e.clan, 5);
        await banner(CL[e.clan].n + '包囲網', e.clan === S.player ? '諸大名がこぞってあなたを狙う' : '諸大名が' + CL[e.clan].n + 'を狙いはじめた', 1500);
        break;
      case 'coalition-end': addLog(CL[e.clan].n + '包囲網がほどけた', '', e.clan); break;
      case 'extend': {
        const d = E.dateLabel(e.maxTurn - 1);
        addLog('期間を延長（' + d.era + 'の冬まで）', 'me', S.player);
        break;
      }
      case 'season': {
        V.turn = e.turn;
        const d = E.dateLabel(e.turn);
        A.S.horn();
        hud();
        const left = S.maxTurn - e.turn;
        const sub = left === 4 ? '区切りまで、あと1年' : d.season === '冬' ? '冬：峠は3歩、雪国の街道は2歩。内政の季節' : d.season === '秋' ? '秋：収穫。休む軍勢の兵が多く戻り、徴兵の兵も増える' : '';
        await banner(d.era + '　' + d.season, sub, 1100);
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
      box.classList.remove('rows2'); box.style.maxWidth = '';
      box.innerHTML = '<span class="empty">賽 ' + n + ' 個</span>';
      return;
    }
    // 7個以上は2段に分ける（1段は最大5個。賽の大きさと奥行きは変えない）
    const n = S.dice.length;
    box.classList.toggle('rows2', n >= 7);
    box.style.maxWidth = n >= 7 ? (Math.ceil(n / 2) * 54 + (Math.ceil(n / 2) - 1) * 14) + 'px' : '';
    S.dice.forEach((dv, i) => {
      const d = makeDie(i);
      d.el.addEventListener('click', ev => { ev.stopPropagation(); onDieClick(i, ev.shiftKey); });
      d.el.addEventListener('contextmenu', ev => { ev.preventDefault(); clearSel(); });
      const num = document.createElement('div'); num.className = 'num'; num.innerHTML = (i < 9 ? '<small>キー</small>' + (i + 1) : '');
      d.el.appendChild(num);
      box.appendChild(d.el);
      if (spin) setDie(d, 1 + Math.floor(Math.random() * 6), false);
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
  function rankOf(c) {
    const k = E.kokAll(V);
    const list = Object.keys(k).filter(x => k[x] > 0).sort((a, b) => k[b] - k[a]);
    return { rank: list.indexOf(c) + 1, k, list };
  }
  function hud() {
    if (!S || !V) return;
    const me = CL[S.player];
    const d = E.dateLabel(V.turn);
    $('era').textContent = d.era; $('season').textContent = d.season;
    const left = S.maxTurn - V.turn;
    $('left').textContent = left > 0 ? '区切りまで ' + left + ' 季' : '区切り';
    $('me-mon').textContent = me.mon; $('me-mon').style.background = me.col;
    $('me-name').textContent = me.n + '家';
    $('me-who').textContent = me.who;
    $('me-trait').textContent = '【' + me.tn + '】' + me.td;
    const n = V.owner.filter(o => o === S.player).length;
    const rk = rankOf(S.player);
    $('st-prov').textContent = n;
    $('st-kok').textContent = rk.k[S.player] || 0;
    $('st-rank').textContent = rk.rank > 0 ? rk.rank + '位' : '';
    const kyo = V.owner[E.KYO] === S.player;
    $('st-prov-box').classList.toggle('kyo', kyo);
    $('st-kyo').textContent = kyo ? '京を掌握' : '国';
    const myArmies = V.armies.filter(a => a.c === S.player).length;
    const slotN = E.slots(V, S.player);
    $('st-army').textContent = myArmies; $('st-slot').textContent = '/' + slotN;
    $('st-slot').classList.toggle('over', myArmies > slotN);
    $('st-army-box').title = myArmies > slotN ? '軍勢の枠（石高で決まる）より多い。いまの軍勢はそのまま残るが、枠に空きができるまで新しい軍勢は出陣しない' : '軍勢の数／軍勢の枠（石高で決まる）';
    $('st-army-l').textContent = myArmies > slotN ? '軍勢・枠超え' : '軍勢';
    // 今季に振った賽の数と、石高から決まる次の季の数がちがうときは両方を出す
    const nextDice = E.diceCount(V, S.player);
    const nowDice = S.cur === S.player && S.dice && S.dice.length ? S.dice.length : nextDice;
    $('st-dice').textContent = nowDice;
    $('st-dice-l').textContent = nowDice !== nextDice ? '賽・次季' + nextDice : '賽';
    $('st-dice-l').classList.toggle('next', nowDice !== nextDice);
    $('st-dice-box').title = nowDice !== nextDice ? '今季は' + nowDice + '個。石高が変わったので、次の季から' + nextDice + '個' : '賽の数（石高で決まる。京を持つと+1）';
    const total = Object.values(rk.k).reduce((a, b) => a + b, 0) || 1;
    $('goalfill').style.width = Math.min(100, (rk.k[S.player] || 0) / total * 100) + '%';
    $('goaltxt').innerHTML = '全国の石高のうち <b>' + Math.round((rk.k[S.player] || 0) / total * 100) + '%</b>　' + E.P + 'か国すべてで天下統一';
    // 勢力図（石高の上位）
    const cn = E.counts(V);
    const order = rk.list;
    $('powerbar').innerHTML = order.map(c => '<div title="' + CL[c].n + ' 石高' + rk.k[c] + '" style="flex-grow:' + rk.k[c] + ';background:' + CL[c].col + (c === S.player ? ';box-shadow:inset 0 0 0 2px #ffe9a8' : '') + '"></div>').join('');
    const top = order.slice(0, 8);
    if (!top.includes(S.player) && rk.rank > 0) top.push(S.player);
    $('powerlist').innerHTML = top.map(c => '<div class="row' + (c === S.player ? ' me' : '') + (CL[c].major ? '' : ' minor') + '" data-c="' + c + '"><span class="rk">' + (order.indexOf(c) + 1) + '</span><span class="sw" style="background:' + CL[c].col + '"></span>' + CL[c].n + (V.owner[E.KYO] === c ? '<small style="color:#ff8b78">京</small>' : '') + '<span class="n">' + rk.k[c] + '<small>石</small> ' + cn[c] + '<small>国</small></span></div>').join('');
    $('power-n').textContent = '残る大名 ' + order.length + '家';
    $('powerlist').querySelectorAll('.row').forEach(el => el.addEventListener('click', () => flashClan(el.dataset.c)));
    $('coal').textContent = V.coal ? '⚑ ' + CL[V.coal].n + '包囲網' + (V.coal === S.player ? '（あなたが狙われている）' : '') : '';
    renderArmyList();
  }
  let flashTimer = null;
  function flashClan(c) {
    if (!V) return;
    U.flash = c;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { U.flash = null; }, 2200);
    const ps = E.provsOf(V, c);
    if (ps.length) fitProvs(ps, 500, 1.1);
    A.S.click();
  }
  function fitProvs(ps, ms, maxS, minS) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of ps) { const q = POS[p]; x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    R.fitBox(x0 - 60, y0 - 60, x1 + 60, y1 + 60, ms, { padL: 330, padR: 250, padT: 30, padB: 170, maxS: maxS || 1.15, minS: minS || 0.7 });
  }
  function homeView(ms) {
    if (!S) return;
    const ps = E.provsOf(S, S.player);
    const ring = new Set(ps);
    for (const p of ps) for (const q of E.padj[p]) ring.add(q);
    for (const a of S.armies) if (a.c === S.player && E.nodes[a.n].kind === 'c') ring.add(a.n);
    fitProvs([...ring], ms == null ? 500 : ms, 1.15, 0.95);
  }

  // 軍勢の一覧
  function armyPlace(a) {
    const nd = E.nodes[a.n];
    if (nd.kind === 'c') return PN(nd.p) + (V.owner[nd.p] === a.c ? '（城）' : '');
    return nd.name || PN(nd.a) + '・' + PN(nd.b);
  }
  function layoutArmies() {
    const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--uiz')) || 1;
    const hr = $('hud').getBoundingClientRect(), lr = $('log').getBoundingClientRect();
    if (!hr.height) return;
    $('armies').style.top = (hr.bottom / z + 8) + 'px';
    $('armies').style.maxHeight = Math.max(90, (lr.top - hr.bottom - 18) / z) + 'px';
  }
  function renderArmyList() {
    const box = $('armies');
    if (!S || !V || mode !== 'play') return;
    layoutArmies();
    siegeSummary();
    const list = V.armies.filter(a => a.c === S.player);
    const myTurn = S.cur === S.player && S.phase === 'move';
    const sl = E.slots(V, S.player);
    $('armies-h').textContent = '軍勢 ' + list.length + '/' + sl + (list.length > sl ? '（枠超え：新しい出陣なし）' : '');
    $('armies-list').innerHTML = list.map(a => {
      const sa = E.armyById(S, a.id) || a;
      const dom = U.armyDom[a.id] || (myTurn && (sa.dom || (sa.mv && sa.siegePlan && 'prepare')));
      const done = U.moved[a.id] || dom || (myTurn && sa.mv);
      const st = dom ? GOV[dom] : done ? '済' : sa.dg ? '委任' : myTurn && !sa.mv ? '未' : '';
      const cls = (sel.army === a.id ? ' sel' : '') + (done ? ' done' : '');
      const atCastle = E.nodes[a.n].kind === 'c' && V.owner[E.nodes[a.n].p] === S.player;
      return '<div class="arow' + cls + '" data-id="' + a.id + '"><span class="t' + (a.t <= 3 ? ' low' : '') + '">' + a.t + '</span><span class="pl">' + armyPlace(a) + (atCastle ? '<i title="内政ができる">内</i>' : '') + '</span><span class="st">' + st + '</span><button class="dg' + (sa.dg ? ' on' : '') + '" data-id="' + a.id + '" title="委任：手番の終わりに、残った賽でこの軍勢をCPUの考えで動かす">委</button></div>';
    }).join('');
    $('armies-list').querySelectorAll('.arow').forEach(el => el.addEventListener('click', ev => {
      if (ev.target.classList.contains('dg')) return;
      const id = Number(el.dataset.id);
      const a = V.armies.find(x => x.id === id);
      if (a && !R.onScreen(POS[a.n][0], POS[a.n][1], -140)) R.flyTo(POS[a.n][0], POS[a.n][1], Math.max(R.zoom.z, 0.95 / Math.min(innerWidth / R.W, innerHeight / R.H)), 350);
      if (S.cur === S.player && S.phase === 'move' && !busy) onArmyClick(id);
    }));
    $('armies-list').querySelectorAll('.dg').forEach(el => el.addEventListener('click', ev => {
      ev.stopPropagation();
      const id = Number(el.dataset.id);
      const a = E.armyById(S, id);
      if (!a) return;
      E.setDelegate(S, id, !a.dg);
      const va = vArmy(id); if (va) { if (a.dg) va.dg = true; else delete va.dg; }
      A.S.click();
      renderArmyList();
      if (a.dg) setPrompt('この軍勢を<em>委任</em>した。手番を終えるとき、残った賽でCPUの考えにしたがって動く。<br><span class="k">自分で動かしてもよい。「委」をもう一度押すと解除。</span>');
    }));
  }

  // ───────── 保存 ─────────
  function save(key) {
    try { localStorage.setItem(key || SAVE_KEY, JSON.stringify(S)); localStorage.setItem((key || SAVE_KEY) + '_log', JSON.stringify(logs.slice(0, 20))); } catch (e) { /* 無視 */ }
  }
  function readSave(key) {
    try { const s = localStorage.getItem(key); if (!s) return null; const o = JSON.parse(s); return o && o.v === 2 && !o.over ? o : null; } catch (e) { return null; }
  }
  const hasSave = () => !!readSave(SAVE_KEY);
  function slotInfo(i) {
    const o = readSave(SLOT_KEY + i);
    if (!o) return null;
    const d = E.dateLabel(o.turn);
    const k = E.kokOf(o, o.player);
    return { txt: CL[o.player].n + '家　' + d.era + d.season + '　石高' + k + '　' + E.provCount(o, o.player) + 'か国', when: o.savedAt || '' };
  }
  function openSlots(forSave) {
    const box = $('slot-list');
    box.innerHTML = [1, 2, 3].map(i => {
      const inf = slotInfo(i);
      return '<button class="slot" data-i="' + i + '"' + (!forSave && !inf ? ' disabled' : '') + '><b>記録' + i + '</b>' + (inf ? inf.txt + '<small>' + inf.when + '</small>' : '（空き）') + '</button>';
    }).join('');
    $('slots-h').textContent = forSave ? '記録する（いまの状態を残す）' : '記録から始める';
    box.querySelectorAll('.slot').forEach(el => el.addEventListener('click', () => {
      const i = Number(el.dataset.i);
      if (forSave) {
        const base = readSave(SAVE_KEY);
        if (!base) return;
        const d = new Date();
        base.savedAt = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
        try { localStorage.setItem(SLOT_KEY + i, JSON.stringify(base)); localStorage.setItem(SLOT_KEY + i + '_log', localStorage.getItem(SAVE_KEY + '_log') || '[]'); } catch (e) { /* 無視 */ }
        A.S.select();
        show('slots', false);
        toast('記録' + i + 'に残した');
      } else {
        show('slots', false);
        loadGame(SLOT_KEY + i);
      }
    }));
    show('slots', true);
  }

  function show(id, on) { $(id).classList.toggle('hidden', !on); }
  function showPlayUI(on) { ['hud', 'power', 'menu-btns', 'log', 'tray', 'armies', 'navi'].forEach(id => show(id, on)); }

  const URLQ = new URLSearchParams(root.location.search);
  let introShown = false, introDone = null;
  function resetUI() {
    undoStack = []; pendingDie = null; clearSel();
    logs = []; $('log').innerHTML = '';
    U.spread = {}; U.fx = []; U.moved = {}; U.armyDie = {}; U.armyDom = {}; U.nodeHL = null; U.armyHint = null; U.flash = null;
    U.me = S ? S.player : null;
  }
  function startGame(clan, seed) {
    lastClan = clan; lastGrow = null;
    if (seed == null && URLQ.get('seed')) seed = Number(URLQ.get('seed'));
    S = E.newGame(clan, seed == null ? (Math.random() * 1e9) >>> 0 : seed);
    V = cloneV(S);
    resetUI();
    mode = 'play';
    ['title', 'select', 'result', 'menu', 'help', 'slots'].forEach(id => show(id, false));
    showPlayUI(true);
    setPrompt(''); $('dice').innerHTML = '';
    hud(); setButtons();
    addLog(CL[clan].who + '、出陣', 'me', clan);
    homeView(700);
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
  function loadGame(key) {
    try {
      const o = readSave(key || SAVE_KEY);
      if (!o) return false;
      S = o; V = cloneV(S); lastClan = S.player;
      resetUI();
      mode = 'play';
      ['title', 'select', 'result', 'menu', 'help', 'slots'].forEach(id => show(id, false));
      showPlayUI(true);
      try { logs = JSON.parse(localStorage.getItem((key || SAVE_KEY) + '_log')) || []; } catch (e) { logs = []; }
      renderLog();
      addLog('つづきから再開', 'me', S.player);
      if (key && key !== SAVE_KEY) save();
      lastGrow = { slot: E.slots(S, S.player), dice: E.diceCount(S, S.player) };
      hud();
      homeView(0);
      if (S.phase === 'decide') { askDecide(); return true; }
      if (S.offers && S.offers.length && S.cur === S.player) { handleOffers().then(() => resumePlayerTurn()); return true; }
      resumePlayerTurn();
      return true;
    } catch (e) { console.error(e); return false; }
  }

  let lastGrow = null;
  async function startPlayerTurn() {
    if (S.over) return finish();
    E.beginClanTurn(S);
    V = cloneV(S);
    U.moved = {}; U.armyDie = {}; U.armyDom = {}; undoStack = [];
    const g = { slot: E.slots(S, S.player), dice: E.diceCount(S, S.player) };
    if (lastGrow && (g.slot > lastGrow.slot || g.dice > lastGrow.dice)) {
      const msg = [];
      if (g.dice > lastGrow.dice) msg.push('賽が <em>' + g.dice + '個</em> に増えた');
      if (g.slot > lastGrow.slot) msg.push('軍勢を <em>' + g.slot + 'つ</em> まで持てる');
      toast('石高が増え、' + msg.join('・') + '！');
      addLog(msg.join('・').replace(/<\/?em>/g, ''), 'me', S.player);
      A.S.capture();
    } else if (lastGrow && (g.slot < lastGrow.slot || g.dice < lastGrow.dice)) {
      toast('石高が減り、' + (g.dice < lastGrow.dice ? '賽が' + g.dice + '個に' : '軍勢の枠が' + g.slot + 'つに') + '減った');
    }
    lastGrow = g;
    // 画面に自分の領地が見えていなければ寄せる
    const ps = E.provsOf(S, S.player);
    if (!ps.some(p => visibleNode(p)) && !S.armies.some(a => a.c === S.player && visibleNode(a.n))) homeView(500);
    save();
    showNews();
    await handleOffers();
    resumePlayerTurn();
  }
  // 臣従の申し出
  async function handleOffers() {
    while (S.offers && S.offers.length) {
      const o = S.offers[0];
      if (!S.clans[o.c] || !S.clans[o.c].alive) { S.offers.shift(); continue; }
      busy = true;
      const c = CL[o.c];
      const ps = E.provsOf(S, o.c);
      fitProvs(ps.concat(E.provsOf(S, S.player).filter(p => ps.some(q => E.padj[p].includes(q)))), 450, 1.1);
      U.flash = o.c;
      const k = E.kokOf(S, o.c);
      const na = S.armies.filter(a => a.c === o.c).length;
      $('offer-body').innerHTML = '<span class="mon" style="background:' + c.col + ';width:56px;height:56px;font-size:30px">' + c.mon + '</span><div class="txt"><b>' + c.n + '家（' + c.who + '）が臣従を申し出ている</b><br>' +
        ps.map(PN).join('・') + '（石高' + k + '）と軍勢' + na + 'がそのまま手に入る。<br><span class="k">断ると、しばらく申し出はない。</span></div>';
      show('offer', true);
      A.S.horn();
      const yes = await new Promise(res => { offerAnswer = res; });
      show('offer', false);
      U.flash = null;
      if (yes) {
        const ev = E.acceptOffer(S, o.c);
        ev.push({ type: 'sync', snap: snapOf(S) });
        await playEvents(ev);
        if (S.over) { busy = false; return finish(); }
      } else {
        E.declineOffer(S, o.c);
        addLog(c.n + '家の臣従を断った', '', o.c);
      }
      save();
      busy = false;
    }
  }
  let offerAnswer = null;

  let toastTimer = null;
  function toast(html, ms) {
    const t = $('toast');
    t.innerHTML = html; t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 3200);
  }
  // 季節の「諸国の動き」
  let newsTimer = null;
  function showNews() {
    const n = $('news');
    if (!news.length) { n.classList.add('hidden'); return; }
    const list = news.slice().sort((a, b) => b.w - a.w).slice(0, 6);
    n.innerHTML = '<div class="hd">諸国の動き<small>（クリックで閉じる）</small></div>' + list.map(x => '<div class="it"><span class="sw" style="background:' + (x.clan && CL[x.clan] ? CL[x.clan].col : '#888') + '"></span>' + x.txt + '</div>').join('') + (news.length > 6 ? '<div class="more">ほか ' + (news.length - 6) + ' 件</div>' : '');
    n.classList.remove('hidden');
    news = [];
    clearTimeout(newsTimer);
    newsTimer = setTimeout(() => n.classList.add('hidden'), 8000);
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
    U.nodeHL = {};
    opts.forEach(n => { U.nodeHL[n] = 'rgba(255,215,100,0.55)'; });
    const outside = opts.some(n => n >= E.P);
    setPrompt('石高に見合う<em>新しい軍勢</em>が出陣できる。出陣させる<em>光る' + (outside ? '城のそば' : '城') + '</em>をクリック。<br><span class="k">選ぶと賽を振れる。出さないなら「出陣しない」。</span>');
    buildTray(false);
    setButtons();
    setHint('新しい軍勢を置く場所をクリック（前線の近くがおすすめ）');
  }
  async function doSpawn(n) {
    busy = true;
    U.nodeHL = null;
    const ev = E.spawn(S, n);
    ev.push({ type: 'sync', snap: snapOf(S) });
    await playEvents(ev);
    busy = false;
    save();
    enterRoll();
  }
  function enterRoll() {
    const n = E.diceCount(S, S.player);
    setPrompt('<em>賽を振れ</em>（Space）　賽は ' + n + ' 個。<br>出目を軍勢に配り、<em>進軍</em>か<em>内政</em>を命じる。');
    buildTray(false);
    setButtons();
    renderArmyList();
    if (V.turn === 0) setHint('まずは右下の<em>「賽を振る」</em>（Space）');
    else setHint(null);
  }
  async function doRoll() {
    if (busy || S.phase !== 'roll') return;
    busy = true; setButtons();
    $('news').classList.add('hidden');
    E.roll(S);
    save();
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
    setDie(trayDice[i], S.dice[i].v, true);
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
      const dg = ua.some(a => a.dg) && fd.length;
      setPrompt(!fd.length ? '賽を使い切った。<em>手番を終える</em>（Enter）' : dg ? '残りの賽は<em>委任</em>した軍勢が使う。<em>手番を終える</em>（Enter）' : '動かせる軍勢がない。<em>手番を終える</em>（Enter）');
    } else if (!sel.dice.length && !sel.army) {
      enterMovePromptOnly();
    }
    U.canAct = {};
    if (fd.length) ua.forEach(a => { U.canAct[a.id] = true; });
    if (!sel.dice.length && !sel.army) { overviewHints(); if (fd.length && ua.length) enterMovePromptOnly(); }
    buildTray(false);
    setButtons();
    renderArmyList();
    if (pendingDie != null) { const i = pendingDie; pendingDie = null; if (S.dice[i] && !S.dice[i].u) onDieClick(i, false); }
    if (V.turn === 0 && tutOn) {
      if (!Object.keys(U.moved).length) setHint('賽をクリック → 自分の軍勢をクリック → <em>光るマス</em>へ進軍。城にいる軍勢なら<em>内政</em>も選べる');
      else setHint('残りの賽も使おう。使わない軍勢は休む（城なら兵+1）。最後に<em>手番を終える</em>');
    } else if (V.turn === 1 && tutOn) setHint('<em>城攻めは城の隣から</em>。赤い「陣」の旗は、次の季に城を攻められる陣取りの場所');
    else if (V.turn === 2 && tutOn) setHint('城にいる軍勢に賽を配ると<em>内政</em>：徴兵（兵を戻す）・開墾（石高）・築城（守備兵）');
    else if (V.turn === 3 && tutOn) setHint('軍勢が増えたら、左の一覧の<em>「委」</em>で委任できる。残った賽で自動に動く');
    else setHint(null);
    if (V.turn >= 4 && tutOn) { tutOn = false; try { localStorage.setItem(TUT_KEY, 'done'); } catch (e) { /* 無視 */ } setHint(null); }
  }
  function setButtons() {
    const play = mode === 'play' && S && S.cur === S.player && !S.over;
    const rollPh = play && S.phase === 'roll';
    const movePh = play && S.phase === 'move';
    const placePh = play && S.phase === 'place';
    $('b-roll').classList.toggle('hidden', !rollPh && !placePh);
    $('b-roll').disabled = busy || !rollPh;
    $('b-roll').textContent = placePh ? '先に出陣先を選ぶ' : '賽を振る';
    $('b-nospawn').classList.toggle('hidden', !placePh);
    $('b-nospawn').disabled = busy;
    $('b-roll').classList.toggle('glow', rollPh && !busy);
    ['b-combine', 'b-undo', 'b-end', 'b-auto'].forEach(id => $(id).classList.toggle('hidden', !movePh));
    $('b-combine').classList.toggle('on', sel.combine);
    $('b-combine').textContent = sel.combine ? '強行軍：入' : '強行軍';
    $('b-combine').disabled = busy || freeDice().length < 2;
    $('b-undo').disabled = busy || !undoStack.length;
    $('b-auto').disabled = busy || !freeDice().length || !unmovedArmies().length;
    $('b-end').disabled = busy;
    const done = movePh && (!freeDice().length || !unmovedArmies().length);
    $('b-end').classList.toggle('glow', done && !busy);
    $('b-end').classList.toggle('primary', done);
  }

  function clearSel() {
    sel.army = null; sel.dice = []; curReach = null; U.armyHint = null;
    sel.combine = false;
    U.reach = null; U.targets = null; U.stage = null; U.path = null; U.selArmy = null;
    $('forecast').classList.add('hidden');
    hideGov();
    if (trayDice.length) refreshTray();
  }
  function onDieClick(i, shift) {
    if (busy || !S || S.phase !== 'move' || S.cur !== S.player) return;
    disarmEnd(false);
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
    disarmEnd(false);
    const a = E.armyById(S, id);
    if (!a || a.c !== S.player) return false;
    if (a.mv) { A.S.deny(); setPrompt('この軍勢は今季もう命令を受けた。'); return true; }
    if (sel.army === id) { sel.army = null; computeSel(); renderArmyList(); return true; }
    sel.army = id;
    if (!sel.dice.length) {
      const fd = freeDice();
      if (fd.length) sel.dice = [fd.reduce((b, i) => (S.dice[i].v > S.dice[b].v ? i : b), fd[0])];
    }
    A.S.select();
    refreshTray();
    computeSel();
    renderArmyList();
    return true;
  }
  function budget() { return sel.dice.reduce((x, i) => x + S.dice[i].v, 0); }
  function computeSel() {
    U.reach = null; U.targets = null; U.stage = null; U.path = null; curReach = null;
    U.selArmy = sel.army;
    $('forecast').classList.add('hidden');
    hideGov();
    U.armyHint = null;
    if (!sel.army) {
      if (sel.dice.length) {
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
        setPrompt('出目 <em>' + b0 + '</em>：命令する<em>軍勢</em>をクリック。' + (sel.dice.length === 2 ? '（強行軍）' : '') +
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
    const nd = E.nodes[a.n];
    const home = nd.kind === 'c' && S.owner[nd.p] === S.player;
    let msg = '出目 <em>' + b + '</em>' + (sel.dice.length === 2 ? '（強行軍）' : '') + '：光るマスへ進軍。';
    if (home && sel.dice.length === 1) msg += '<br><span class="k">城にいるので、右の<em>内政</em>も選べる（その季は動かない）。</span>';
    else if (U.targets.length) msg += '<br><span class="k">×印をクリックで合戦（％は勝つ見込み）。</span>';
    else if (U.stage.length) msg += '<br><span class="k">赤い「陣」＝城の隣。次の季に城を攻められる。</span>';
    else if (!r.moves.length) msg += '<br><span class="k">この目では動ける場所がない。</span>';
    setPrompt(msg);
    if (home && sel.dice.length === 1) showGov(a, S.dice[sel.dice[0]].v);
    else showSiege(a);
    setButtons();
  }
  // 軍勢・賽を選んだときの攻城準備。点数と実行可否はエンジンに問い合わせる。
  function showSiege(a) {
    if (E.nodes[a.n].kind !== 'b') return;
    const targets = E.adj[a.n].filter(p => S.owner[p] && S.owner[p] !== a.c);
    if (!targets.length) return;
    const one = sel.dice.length === 1;
    const choices = one ? E.siegeOptions(S, a, sel.dice[0]) : [];
    const box = $('gov');
    govArmy = a.id;
    const heading = document.createElement('div');
    heading.className = 'hd';
    heading.textContent = '攻城準備　この季は国境に留まる';
    box.replaceChildren(heading);
    for (const p of targets) {
      const option = choices.find(o => o.target === p);
      const points = E.siegePoints(S, a, p);
      const button = document.createElement('button');
      button.className = 'gv';
      button.dataset.target = p;
      button.disabled = !option;
      const effect = option ? points + ' → ' + option.after + ' / 6' :
        points === E.R.siegeMax ? '準備完了　＋6' : a.t < E.R.siegeMinArmy ? '準備には兵8以上が必要' : '賽を1個選ぶ';
      button.textContent = PN(p) + '・' + D.PROV[p].c + '　' + effect;
      button.addEventListener('click', ev => { ev.stopPropagation(); doStationaryOrder('prepare', p); });
      box.append(button);
    }
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = '今攻めるなら地図の×印を選択。準備は次にこの城を攻めるときに使う。移動や目標変更で失う。';
    box.append(note);
    box.classList.remove('hidden');
    $('tip').classList.add('hidden');
    placeGov();
  }

  function siegeSummary() {
    const lines = [];
    for (const a of V.armies) {
      const p = a.siegePlan?.target;
      if (p == null || (a.c !== S.player && V.owner[p] !== S.player)) continue;
      const points = E.siegePoints(V, a, p);
      if (points) lines.push(CL[a.c].n + '軍 → ' + PN(p) + '　準備 +' + points);
    }
    $('siege-summary').textContent = lines.join('\n');
  }

  // 内政の窓
  let govArmy = null;
  function govText(kind, o) {
    if (kind === 'recruit') return o.ok ? '兵 ' + o.from + '→<b>' + o.to + '</b>' : o.why;
    if (kind === 'develop') {
      if (!o.ok) return '石高 ' + o.kok + '（' + o.why + '）';
      if (o.up) return '石高 ' + o.kok + '→<b>' + o.kok1 + '</b>！';
      return '開墾 ' + o.cur + '→<b>' + o.kp1 + '</b>/' + o.need + '　（石高' + o.kok + '）';
    }
    if (kind === 'fortify') {
      if (!o.ok) return o.why;
      const gtxt = '守備兵 ' + o.gar + '→' + o.gar1;
      if (o.up) return '普請 成る！守備兵の上限+' + o.up + '　' + gtxt;
      if (o.fort >= E.R.fortMax) return gtxt;
      return '普請 ' + o.cur + '→<b>' + o.fp1 + '</b>/' + o.need + '　' + gtxt;
    }
    return '';
  }
  function showGov(a, v) {
    govArmy = a.id;
    const box = $('gov');
    const p = E.nodes[a.n].p;
    const rows = ['recruit', 'develop', 'fortify'].map((k, i) => {
      const o = E.governPreview(S, a, k, v);
      return '<button class="gv" data-k="' + k + '"' + (o.ok ? '' : ' disabled') + '><span class="nm">' + GOV[k] + '<small>' + 'QWE'[i] + '</small></span><span class="ef">' + govText(k, o) + '</span></button>';
    }).join('');
    box.innerHTML = '<div class="hd">内政　' + PN(p) + '・' + D.PROV[p].c + '　<small>出目 ' + v + '</small></div>' + rows +
      '<div class="note">徴兵はどの目でも同じ。開墾と築城は大きい目ほど進む。</div>';
    box.querySelectorAll('.gv').forEach(el => el.addEventListener('click', ev => { ev.stopPropagation(); doStationaryOrder(el.dataset.k); }));
    box.classList.remove('hidden');
    $('tip').classList.add('hidden');
    placeGov();
  }
  function placeGov() {
    const box = $('gov');
    if (box.classList.contains('hidden') || govArmy == null || !V) return;
    const a = V.armies.find(x => x.id === govArmy);
    if (!a) return;
    const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--uiz')) || 1;
    const tr = $('tray').getBoundingClientRect();
    box.style.right = '12px';
    box.style.left = 'auto';
    box.style.top = 'auto';
    box.style.bottom = ((innerHeight - tr.top) / z + 8) + 'px';
  }
  function hideGov() { $('gov').classList.add('hidden'); govArmy = null; }
  async function doStationaryOrder(kind, target) {
    if (busy || !sel.army || sel.dice.length !== 1) return;
    const before = JSON.stringify(S);
    const id = sel.army, di = sel.dice[0], v = S.dice[di].v;
    const ev = kind === 'prepare' ? E.prepareSiege(S, id, di, target) : E.govern(S, id, di, kind);
    if (!ev) { A.S.deny(); return; }
    undoStack.push({ s: before, moved: Object.assign({}, U.moved), die: Object.assign({}, U.armyDie), dom: Object.assign({}, U.armyDom) });
    U.moved[id] = true; U.armyDie[id] = v; U.armyDom[id] = kind;
    ev.push({ type: 'sync', snap: snapOf(S) });
    clearSel();
    busy = true; setButtons(); refreshTray();
    await playEvents(ev);
    busy = false;
    hud();
    save();
    enterMove();
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
    else if (U.armyHint && Object.keys(U.armyHint).length) setPrompt('<em>賽</em>を選び、<em>軍勢</em>を選ぶ。光るマスへ<em>進軍</em>、城にいれば<em>内政</em>。<br><span class="k">軍勢の上の「奇1」＝出目1でぴったり着いて奇襲できる。「攻5」＝出目5で有利に攻められる。</span>');
    else setPrompt('<em>賽</em>を選び、<em>軍勢</em>を選ぶ。光るマスへ<em>進軍</em>、城にいれば<em>内政</em>。<br><span class="k">命令しなかった軍勢は休む（自分の城なら兵+1）。</span>');
  }
  function stagingSpot(n, c) {
    const nd = E.nodes[n];
    if (nd.kind !== 'b') return false;
    return S.owner[nd.a] !== c || S.owner[nd.b] !== c;
  }
  function computeDanger() {
    U.danger = {};
    if (!S || !V) return;
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
    if (isBattle) undoStack = []; else undoStack.push({ s: before, moved: Object.assign({}, U.moved), die: Object.assign({}, U.armyDie), dom: Object.assign({}, U.armyDom) });
    U.moved[armyId] = true;
    U.armyDie[armyId] = dice.reduce((x, i) => x + S.dice[i].v, 0);
    ev.push({ type: 'sync', snap: snapOf(S) });
    clearSel();
    busy = true; setButtons(); refreshTray();
    await playEvents(ev);
    busy = false;
    hud();
    if (S.over) return finish();
    save();
    computeDanger();
    enterMove();
  }
  function doUndo() {
    if (busy || !undoStack.length) return;
    const u = undoStack.pop();
    S = JSON.parse(u.s); V = cloneV(S);
    U.moved = u.moved; U.armyDie = u.die; U.armyDom = u.dom || {};
    save();
    A.S.click();
    clearSel();
    hud();
    enterMove();
  }
  // おまかせ：残りの賽で、まだ命令していない軍勢をCPUの考えで動かす
  async function doAuto() {
    if (busy || !S || S.cur !== S.player || S.phase !== 'move') return;
    clearSel();
    busy = true; setButtons();
    const ev = AI.playFor(S, a => !a.mv);
    if (!ev.length) toast('おまかせ：よい手が見つからなかった。休ませるのがよさそうだ。');
    markOrders(ev);
    ev.push({ type: 'sync', snap: snapOf(S) });
    undoStack = [];
    await playEvents(ev);
    busy = false;
    hud();
    if (S.over) return finish();
    save();
    enterMove();
  }
  function markOrders(ev) {
    for (const e of ev) {
      if (e.type === 'dice') U.moved[e.army] = true;
      if (e.type === 'govern') U.armyDom[e.army] = e.kind;
      if (e.type === 'prepare') U.armyDom[e.army] = 'prepare';
    }
  }
  // 賽が残っているときの「もう一度で終える」。期限が切れたら、ボタンと案内文を両方もとに戻す
  let endArmed = false, endTimer = null;
  const END_CONFIRM_MS = 3000;
  function disarmEnd(restore) {
    if (!endArmed) return;
    endArmed = false;
    clearTimeout(endTimer);
    $('b-end').textContent = '手番を終える';
    $('b-end').classList.remove('armed');
    if (restore && !busy && S && S.cur === S.player && S.phase === 'move') { if (sel.army || sel.dice.length) computeSel(); else enterMovePromptOnly(); }
  }
  async function endTurn() {
    if (busy || !S || S.cur !== S.player || S.phase !== 'move') return;
    const fd = freeDice(), ua = unmovedArmies();
    const dgLeft = ua.filter(a => a.dg).length;
    if (fd.length && ua.length > dgLeft && !endArmed) {
      endArmed = true;
      A.S.click();
      $('b-end').textContent = 'もう一度で終える';
      $('b-end').classList.add('armed');
      setPrompt('賽がまだ <em>' + fd.length + '個</em> 残っている。<br>このまま終えるなら、3秒以内にもう一度「手番を終える」（命令しない軍勢は休む）。' + (dgLeft ? '<br><span class="k">委任した軍勢は残りの賽で動く。</span>' : ''));
      endTimer = setTimeout(() => disarmEnd(true), END_CONFIRM_MS);
      return;
    }
    disarmEnd(false);
    clearSel();
    busy = true; setButtons(); setHint(null);
    U.canAct = {};
    // 委任した軍勢が残りの賽を使う
    if (fd.length && dgLeft) {
      const dev = AI.playFor(S, a => a.dg && !a.mv);
      if (dev.length) {
        markOrders(dev);
        dev.push({ type: 'sync', snap: snapOf(S) });
        await playEvents(dev);
        if (S.over) return finish();
        await wait(250);
      }
    }
    let ev = E.endClanTurn(S);
    ev.push({ type: 'sync', snap: snapOf(S) });
    await playEvents(ev);
    U.moved = {}; U.armyDie = {}; U.armyDom = {};
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
    setPrompt('<em>CPUの手番</em>　「早送り」（F）「飛ばす」（S）で速くできる。<br><span class="k">遠くの大名の動きは、色の変化と記録だけで伝える。</span>');
    renderArmyList();
    let guard = 0;
    while (!S.over && S.phase !== 'decide' && S.cur !== S.player && guard++ < 500) {
      const c = S.cur;
      const ev = E.beginClanTurn(S).concat(AI.playTurn(S));
      ev.push({ type: 'sync', snap: snapOf(S) });
      await playEvents(ev);
      if (S.over) break;
      const ev2 = E.advance(S);
      ev2.push({ type: 'sync', snap: snapOf(S), keepTurn: true });
      const season = ev2.filter(e => e.type === 'season');
      const rest = ev2.filter(e => e.type !== 'season');
      await playEvents(rest);
      if (S.over || S.phase === 'decide') break;
      speed.mul = 1;
      const skip = speed.skip; speed.skip = false;
      if (season.length) await playEvents(season);
      speed.skip = skip;
      speed.mul = speed.fast ? 3 : 1.3;
      if (c && !S.clans[c]) break;
    }
    speed.skip = false; speed.mul = 1;
    $('cpuchip').classList.add('hidden');
    V = cloneV(S);
    busy = false;
    if (S.over) return finish();
    if (S.phase === 'decide') return askDecide();
    startPlayerTurn();
  }

  // ───────── 期間の区切り：決着か延長か ─────────
  function rankTable(limit) {
    const rk = E.rankList(S);
    const pi = rk.findIndex(r => r.c === S.player);
    const rows = rk.slice(0, limit).map((r, i) => ({ r, i }));
    if (pi >= limit) rows.push({ r: rk[pi], i: pi });
    return '<table class="rank">' + rows.map(({ r, i }) => '<tr class="' + (r.c === S.player ? 'me' : '') + '"><td>' + (i + 1) + '</td><td><span class="sw" style="background:' + CL[r.c].col + '"></span>' + CL[r.c].n + '</td><td>石高 ' + r.k + '</td><td>' + r.n + 'か国</td></tr>').join('') + '</table>';
  }
  function askDecide() {
    mode = 'play';
    busy = true;
    save();
    const d = E.dateLabel(S.turn - 1);
    const rk = E.rankList(S);
    const pi = rk.findIndex(r => r.c === S.player);
    $('decide-head').textContent = d.era + 'の冬が終わった';
    $('decide-sub').innerHTML = 'いまの順位は <b>第' + (pi + 1) + '位</b>。ここで決着をつけるか、5年延長して天下を目指すか。' + (S.ext ? '（延長 ' + S.ext + ' 回目のあと）' : '');
    $('decide-rank').innerHTML = rankTable(6);
    show('decide', true);
    A.S.horn();
  }
  async function doExtend() {
    show('decide', false);
    const ev = E.extend(S);
    busy = true;
    await playEvents(ev);
    busy = false;
    startPlayerTurn();
  }
  function doConclude() {
    show('decide', false);
    E.conclude(S);
    finish();
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
    $('news').classList.add('hidden'); hideGov(); $('tip').classList.add('hidden'); $('hint').classList.add('hidden');
    const o = S.over, me = CL[S.player];
    const head = $('res-head'), sub = $('res-sub');
    const n = S.owner.filter(x => x === S.player).length;
    const k = E.kokOf(S, S.player);
    const end = E.dateLabel(Math.max(0, o.turn - 1));
    let big, txt, cls;
    if (o.reason === 'unify' && o.kind === 'win') { big = '天下統一'; cls = 'win'; txt = me.who + '、日本六十余州をことごとく従える。' + end.era + '、戦国の世はあなたの采配で終わった。'; A.S.big(); }
    else if (o.reason === 'unify') { big = '天下は' + CL[o.clan].n + 'へ'; cls = 'lose'; txt = CL[o.clan].who + 'が全国を平らげた。'; A.S.lose(); }
    else if (o.kind === 'top') { big = '天下第一の大名'; cls = 'win'; txt = end.era + '、' + me.n + '家は石高' + k + '・' + n + 'か国。諸大名の中で最も大きい。'; A.S.win(); }
    else if (o.reason === 'fall') { big = me.n + '家 滅亡'; cls = 'lose'; txt = 'すべての城を失った。' + (o.by ? CL[o.by].who + 'の軍勢が最後の城に迫った。' : ''); A.S.lose(); }
    else { big = '群雄のひとり'; cls = 'lose'; txt = end.era + '、' + me.n + '家は石高' + k + '・' + n + 'か国、' + o.place + '番目の勢力として残った。'; A.S.win(); }
    head.textContent = big; head.className = 'big ' + cls; sub.textContent = txt;
    const st = S.clans[S.player];
    const dm = st.dom || {};
    $('res-stats').innerHTML = [['石高', k], ['治めた国', n], ['最大版図', (st.peak || n) + '国'], ['落とした城', st.cap], ['臣従させた家', st.sub || 0], ['合戦 勝/敗', st.won + '/' + st.lost], ['奇襲', st.kishu], ['内政 徴/開/築', (dm.recruit || 0) + '/' + (dm.develop || 0) + '/' + (dm.fortify || 0)]].map(x => '<div><b>' + x[1] + '</b>' + x[0] + '</div>').join('');
    drawChart();
    show('result', true);
    mode = 'result';
    showPlayUI(false);
  }
  function drawChart() {
    const c = $('res-chart'), x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    const hist = S.hist, T = Math.max(hist.length - 1, 1);
    const maxN = Math.max(20, ...hist.map(h => Math.max(...Object.values(h))));
    const X = t => 50 + (c.width - 80) * t / T, Y = n => c.height - 30 - (c.height - 60) * n / maxN;
    x.strokeStyle = 'rgba(255,240,200,0.15)'; x.lineWidth = 1;
    const stp = maxN > 150 ? 50 : maxN > 60 ? 20 : 10;
    for (let n = 0; n <= maxN; n += stp) { x.beginPath(); x.moveTo(50, Y(n)); x.lineTo(c.width - 30, Y(n)); x.stroke(); x.fillStyle = 'rgba(255,240,200,0.5)'; x.font = '20px sans-serif'; x.fillText(String(n), 6, Y(n) + 6); }
    // 期間の区切り
    for (let t = 40; t < T; t += E.R.extTurns) { x.setLineDash([6, 6]); x.strokeStyle = 'rgba(255,200,120,0.35)'; x.beginPath(); x.moveTo(X(t), 20); x.lineTo(X(t), c.height - 30); x.stroke(); x.setLineDash([]); }
    // 最大石高の上位6家＋自分
    const peak = {};
    hist.forEach(h => { for (const k in h) peak[k] = Math.max(peak[k] || 0, h[k]); });
    const ids = Object.keys(peak).sort((a, b) => peak[b] - peak[a]).slice(0, 6);
    if (!ids.includes(S.player)) ids.push(S.player);
    ids.sort((a, b) => (a === S.player) - (b === S.player));
    for (const id of ids) {
      x.beginPath();
      hist.forEach((h, t) => { const v = h[id] || 0; if (t) x.lineTo(X(t), Y(v)); else x.moveTo(X(t), Y(v)); });
      x.strokeStyle = CL[id].col; x.lineWidth = id === S.player ? 6 : 3;
      x.globalAlpha = id === S.player ? 1 : 0.75; x.stroke(); x.globalAlpha = 1;
      let lt = 0; hist.forEach((h, t) => { if (h[id]) lt = t; });
      x.fillStyle = CL[id].col; x.font = '700 22px sans-serif'; x.fillText(CL[id].n, Math.min(c.width - 90, X(lt) + 6), Y(hist[lt][id] || 0) - 6);
    }
    x.fillStyle = 'rgba(255,240,200,0.55)'; x.font = '18px sans-serif'; x.fillText('石高の移り変わり', 56, 22);
  }

  // ───────── 入力 ─────────
  const cv = $('map');
  function hitAt(ev, extra) { return R.hitTest(ev.clientX, ev.clientY, V || BG, { extra }); }
  function hlSet() {
    const s = new Set();
    if (curReach) { curReach.moves.forEach(n => s.add(n)); (U.targets || []).forEach(t => s.add(t.n)); }
    if (U.nodeHL) Object.keys(U.nodeHL).forEach(k => s.add(+k));
    return s;
  }
  cv.addEventListener('mousemove', ev => {
    if (mode !== 'play' || !V) { $('tip').classList.add('hidden'); return; }
    if (drag && drag.moved) return;
    const h = hitAt(ev, hlSet());
    updateHover(h, ev.clientX, ev.clientY);
  });
  cv.addEventListener('mouseleave', () => { $('tip').classList.add('hidden'); });
  function nodeOfHit(h) { if (!h) return null; if (h.kind === 'army' || h.kind === 'node') return h.n; return null; }
  function updateHover(h, mx, my) {
    const tip = $('tip');
    U.path = null; U.pathAttack = false; U.enemyReach = null;
    $('forecast').classList.add('hidden');
    const n = nodeOfHit(h);
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
    const html = !$('gov').classList.contains('hidden') && h && h.kind === 'army' && h.id === govArmy ? '' : tipHtml(h);
    if (html) {
      tip.innerHTML = html; tip.classList.remove('hidden');
      const w = tip.offsetWidth, hh = tip.offsetHeight;
      tip.style.left = Math.min(innerWidth - w - 8, mx + 16) + 'px';
      tip.style.top = Math.min(innerHeight - hh - 8, my + 14) + 'px';
    } else tip.classList.add('hidden');
  }
  function provTip(p) {
    const o = V.owner[p], pr = D.PROV[p];
    let s = '<b>' + pr.n + '</b>　' + pr.c + (p === E.KYO ? '（京）' : '') + '<br>' + (o ? '<span class="sw" style="background:' + CL[o].col + '"></span>' + CL[o].n + '家' + (CL[o].major ? '' : '<small>（その他の大名）</small>') : '持ち主なし');
    const cap = E.devCap(p);
    s += '<br>石高 <b>' + V.kok[p] + '</b><small>（' + V.kok[p] * 10 + '万石・開墾で' + cap + 'まで）</small>';
    if (o === S.player && V.kok[p] < cap) s += '　開墾 ' + V.kp[p] + '/' + E.devNeed(V, p);
    const ar = V.armies.find(a => a.n === p);
    s += '<br>' + (ar ? '籠もる軍勢 兵' + ar.t : '守備兵 ' + V.gar[p] + ' / ' + E.garMax(V, p, o)) + '　城の守り +' + E.castleDef(V, p, o) + (E.CAPITAL[p] && o && CL[o].major ? '（本拠）' : '');
    if (V.fort[p]) s += '<br>普請 ' + '■'.repeat(V.fort[p]) + '□'.repeat(E.R.fortMax - V.fort[p]) + '（守備兵の上限+' + V.fort[p] + '）';
    if (o === S.player && V.fort[p] < E.R.fortMax && V.fp[p]) s += '<br>普請 ' + V.fp[p] + '/' + E.fortNeed(V, p);
    if (o === S.player && U.danger && U.danger[p]) s += '<br><span style="color:#ff8b78">隣に敵が陣取っている！次の季に攻められる。</span><br><span style="color:#ffd96a">守り方：城に軍勢を入れる／隣に味方を置いて加勢／築城で守備兵を満たす／陣取った敵を先に攻める</span>';
    return s;
  }
  function tipHtml(h) {
    if (!h || !V || !S) return '';
    if (h.kind === 'army') {
      const a = V.armies.find(x => x.id === h.id); if (!a) return '';
      const c = CL[a.c];
      let s = '<b>' + c.n + '家の軍勢</b>　兵 ' + a.t;
      if (a.c === S.player) {
        const sa = E.armyById(S, a.id) || a;
        s += U.armyDom[a.id] ? '<br>今季は' + GOV[U.armyDom[a.id]] + 'をした' : U.moved[a.id] ? '<br>今季は動いた' : '<br>命令しなければ休んで兵 +' + E.healAmount(S, sa);
        if (sa.dg) s += '<br><span style="color:#c9b8ff">委任中：手番の終わりに残りの賽で動く</span>';
      } else s += '<br><span style="color:#ffb08a">オレンジ＝次の季に届く範囲</span>';
      const hv = U.armyHint && U.armyHint[a.id];
      if (hv) s += '<br><span style="color:#ffd96a">' + (hv.startsWith('kishu') ? '「奇' + hv.split(':')[1] + '」：出目' + hv.split(':')[1] + 'でぴったり着いて奇襲できる' : '「攻' + hv.split(':')[1] + '」：出目' + hv.split(':')[1] + 'で有利に攻められる') + '</span>';
      const nd = E.nodes[a.n];
      if (nd.kind === 'c') s += '<br>' + PN(nd.p) + '・' + D.PROV[nd.p].c + 'に籠もる';
      return s;
    }
    let p = null, n = null;
    if (h.kind === 'node') { n = h.n; if (E.nodes[n].kind === 'c') p = E.nodes[n].p; }
    if (h.kind === 'prov') p = h.p;
    if (p != null) return provTip(p);
    if (n != null) {
      const nd = E.nodes[n];
      const nm = nd.name || PN(nd.a) + '・' + PN(nd.b) + 'の国境';
      const typ = nd.t === 'P' ? '峠：入るのに2歩（冬は3歩）。守り手+1' : nd.t === 'S' ? '海路：渡るのに2歩（冬は3歩）' : '街道：1歩' + (nd.snowy ? '（雪国：冬は2歩）' : '');
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
    if (mode !== 'play' && mode !== 'view' && mode !== 'select') return;
    ev.preventDefault();
    R.zoomAt(ev.clientX, ev.clientY, ev.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });
  cv.addEventListener('mousedown', ev => { if (ev.button === 0 || ev.button === 1) { drag = { x: ev.clientX, y: ev.clientY, moved: false }; dragged = false; } });
  root.addEventListener('mousemove', ev => {
    if (!drag) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
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
    // カメラの移動中に押されたら、移動を終わらせるだけにする（動いている地図の上で誤って命令しない）
    if (R.camMoving()) { R.finishCam(); return; }
    const h = hitAt(ev, hlSet());
    if (S.phase === 'place') {
      const opts = E.spawnOptions(S, S.player);
      let n = nodeOfHit(h);
      if (n == null && h && h.kind === 'prov') n = h.p;
      if (n != null && opts.includes(n)) doSpawn(n);
      else A.S.deny();
      return;
    }
    if (S.phase !== 'move') return;
    let n = nodeOfHit(h);
    if (curReach) {
      const cand = curReach.moves.concat((U.targets || []).map(t => t.n));
      let bn = null, bd = Math.max(14, 24 * R.glyphScale());
      for (const m of cand) { const q = R.toScreen(POS[m][0], POS[m][1]); const d = Math.hypot(q[0] - ev.clientX, q[1] - ev.clientY); if (d < bd) { bd = d; bn = m; } }
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
    if (sel.army) { sel.army = null; computeSel(); renderArmyList(); }
  });
  cv.addEventListener('contextmenu', ev => { ev.preventDefault(); if (mode === 'play' && !busy) { clearSel(); enterMovePromptOnly(); setButtons(); renderArmyList(); } });

  root.addEventListener('keydown', ev => {
    if (!$('offer').classList.contains('hidden')) {
      if (ev.key === 'Enter' || ev.key === 'y') answerOffer(true);
      else if (ev.key === 'Escape' || ev.key === 'n') answerOffer(false);
      return;
    }
    if (ev.key === 'Escape' && !$('help').classList.contains('hidden')) { closeHelp(); return; }
    if (ev.key === 'Escape' && !$('menu').classList.contains('hidden')) { show('menu', false); return; }
    if (ev.key === 'Escape' && !$('slots').classList.contains('hidden')) { show('slots', false); return; }
    if (mode !== 'play') return;
    if (modalOpen()) return;
    A.ensure();
    const k = ev.key;
    if (k === 'f' || k === 'F') { toggleFast(); return; }
    if (k === '0') { R.resetView(); return; }
    if (k === 'h' || k === 'H') { homeView(); return; }
    if (k === 's' || k === 'S') { if (busy && S.cur !== S.player) speed.skip = true; return; }
    if (busy) {
      if (k === ' ' || k === 'Enter') speed.hurry = true;
      if (/^[1-9]$/.test(k) && S && S.cur === S.player && S.phase === 'move') pendingDie = Number(k) - 1;
      return;
    }
    if (k === ' ') { ev.preventDefault(); if (S.phase === 'roll') doRoll(); else if (S.phase === 'place') { A.S.deny(); toast('先に、新しい軍勢の<em>出陣先</em>（光る城）をクリック。出さないなら「出陣しない」'); } return; }
    if (k === 'Enter') { endTurn(); return; }
    if (k === 'Escape') { clearSel(); enterMovePromptOnly(); setButtons(); renderArmyList(); return; }
    if (k === 'z' || k === 'Z') { doUndo(); return; }
    if (k === 'a' || k === 'A') { doAuto(); return; }
    if (/^[qweQWE]$/.test(k) && !$('gov').classList.contains('hidden') && $('gov').querySelector('[data-k]')) { doStationaryOrder({ q: 'recruit', w: 'develop', e: 'fortify' }[k.toLowerCase()]); return; }
    if (/^[1-9]$/.test(k)) { const i = Number(k) - 1; if (S.dice[i]) onDieClick(i, ev.shiftKey); }
  });
  // 遊ぶ画面の上に重なる窓（この間は背後のゲームを操作させない）
  const MODALS = ['offer', 'decide', 'slots', 'menu', 'help', 'intro'];
  function modalOpen() { return MODALS.some(id => !$(id).classList.contains('hidden')); }
  function toggleFast() { speed.fast = !speed.fast; speed.mul = busy && S && S.cur !== S.player ? (speed.fast ? 3 : 1.3) : speed.mul; $('b-fast').classList.toggle('on', speed.fast); }
  function answerOffer(v) { if (offerAnswer) { const f = offerAnswer; offerAnswer = null; A.S.click(); f(v); } }

  // ボタン
  $('b-roll').addEventListener('click', () => { A.ensure(); doRoll(); });
  $('b-nospawn').addEventListener('click', () => { if (!busy && S && S.phase === 'place') { A.S.click(); doSpawn(null); } });
  $('b-end').addEventListener('click', () => { A.ensure(); endTurn(); });
  $('b-undo').addEventListener('click', () => doUndo());
  $('b-auto').addEventListener('click', () => { A.ensure(); doAuto(); });
  $('b-combine').addEventListener('click', () => {
    sel.combine = !sel.combine; A.S.click();
    if (!sel.combine && sel.dice.length > 1) sel.dice = sel.dice.slice(0, 1);
    setButtons(); refreshTray(); computeSel();
    if (sel.combine) setPrompt('<em>強行軍</em>：賽を2つ選ぶと、目を足して1つの軍勢を遠くまで動かせる。');
  });
  $('b-fast').addEventListener('click', () => toggleFast());
  $('b-skip').addEventListener('click', () => { if (busy) speed.skip = true; });
  $('b-sound').addEventListener('click', () => { A.ensure(); A.setOn(!A.on); $('b-sound').classList.toggle('off', !A.on); });
  $('b-bgm').addEventListener('click', () => { A.ensure(); A.setBgm(!A.bgmOn); $('b-bgm').classList.toggle('off', !A.bgmOn); });
  $('b-help').addEventListener('click', () => openHelp());
  $('b-menu').addEventListener('click', () => { show('menu', true); });
  $('b-m-resume').addEventListener('click', () => show('menu', false));
  $('b-m-help').addEventListener('click', () => { show('menu', false); openHelp(); });
  $('b-m-save').addEventListener('click', () => { show('menu', false); openSlots(true); });
  $('b-m-end').addEventListener('click', () => {
    if (busy || !S || S.cur !== S.player) { toast('自分の手番のときに決着できる'); return; }
    show('menu', false);
    $('decide-head').textContent = 'ここで決着をつけるか';
    $('decide-sub').innerHTML = 'いまの石高の順位で決着する。';
    $('decide-rank').innerHTML = rankTable(6);
    $('b-extend').textContent = 'まだ続ける';
    $('b-extend').dataset.mode = 'cancel';
    show('decide', true);
  });
  $('b-m-restart').addEventListener('click', () => { show('menu', false); if (!busy) startGame(lastClan); });
  $('b-m-title').addEventListener('click', () => { show('menu', false); toTitle(); });
  $('b-help-close').addEventListener('click', () => closeHelp());
  $('b-intro-go').addEventListener('click', () => { A.ensure(); A.S.click(); if (introDone) { const f = introDone; introDone = null; f(); } });
  $('b-intro-help').addEventListener('click', () => openHelp());
  $('b-offer-yes').addEventListener('click', () => answerOffer(true));
  $('b-offer-no').addEventListener('click', () => answerOffer(false));
  $('b-extend').addEventListener('click', () => {
    A.ensure(); A.S.click();
    if ($('b-extend').dataset.mode === 'cancel') { $('b-extend').dataset.mode = ''; $('b-extend').textContent = '5年延長して続ける'; show('decide', false); return; }
    doExtend();
  });
  $('b-conclude').addEventListener('click', () => { A.ensure(); A.S.click(); $('b-extend').dataset.mode = ''; $('b-extend').textContent = '5年延長して続ける'; doConclude(); });
  $('b-slots-close').addEventListener('click', () => show('slots', false));
  $('news').addEventListener('click', () => $('news').classList.add('hidden'));
  function openHelp() { show('help', true); }
  function closeHelp() { show('help', false); }

  // 地方へ移動
  $('navi').innerHTML = '<button data-r="all" title="全国（0）">全国</button><button data-r="home" title="自分の領地へ（H）">自領</button>' + D.REGIONS.map(r => '<button data-r="' + r.id + '">' + r.n.replace('・甲信', '') + '</button>').join('') + '<canvas id="minimap" width="210" height="207"></canvas>';
  $('navi').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const r = b.dataset.r;
    A.ensure(); A.S.click();
    if (r === 'all') R.resetView();
    else if (r === 'home') homeView();
    else fitProvs(D.PROV.map((p, i) => (p.r === r ? i : -1)).filter(i => i >= 0), 500, 1.3);
  }));
  const mm = $('minimap');
  const mmJump = ev => {
    const rc = mm.getBoundingClientRect();
    const [wx, wy] = R.miniToWorld(mm, (ev.clientX - rc.left) * mm.width / rc.width, (ev.clientY - rc.top) * mm.height / rc.height);
    R.flyTo(wx, wy, Math.max(R.zoom.z, 1.6), 300);
  };
  mm.addEventListener('click', mmJump);

  // タイトル・大名選び
  function toTitle() {
    mode = 'title';
    showPlayUI(false);
    ['select', 'result', 'menu', 'help', 'decide', 'offer', 'slots'].forEach(id => show(id, false));
    $('cpuchip').classList.add('hidden'); $('hint').classList.add('hidden'); $('battle').classList.add('hidden'); $('news').classList.add('hidden'); hideGov();
    show('title', true);
    $('b-cont').disabled = !hasSave();
    $('b-load').disabled = ![1, 2, 3].some(i => slotInfo(i));
    V = null; S = null; U.me = null; U.flash = null;
    R.resetView(400);
  }
  $('b-new').addEventListener('click', () => { A.ensure(); A.S.click(); openSelect(); });
  $('b-cont').addEventListener('click', () => { A.ensure(); if (!loadGame()) $('b-cont').disabled = true; });
  $('b-load').addEventListener('click', () => { A.ensure(); openSlots(false); });
  $('b-howto').addEventListener('click', () => { A.ensure(); openHelp(); });
  $('b-back').addEventListener('click', () => { show('select', false); show('title', true); mode = 'title'; U.flash = null; R.resetView(400); });
  $('b-go').addEventListener('click', () => { if (pickClan) { A.ensure(); startGame(pickClan); } });
  $('b-again').addEventListener('click', () => { show('result', false); startGame(lastClan); });
  $('b-other').addEventListener('click', () => { show('result', false); openSelect(); });
  $('b-res-map').addEventListener('click', () => {
    show('result', false); mode = 'view'; showPlayUI(true); show('tray', false); show('armies', false);
    R.resetView(400);
    $('hint').innerHTML = '地図を見ています。<em>クリックで結果に戻る</em>'; $('hint').classList.remove('hidden');
    const back = () => { if (dragged) { dragged = false; return; } cv.removeEventListener('click', back); $('hint').classList.add('hidden'); showResult(); };
    setTimeout(() => cv.addEventListener('click', back), 50);
  });

  function openSelect() {
    mode = 'select';
    show('title', false); show('select', true);
    const box = $('clans');
    const lv = ['', '易', '中', '難'];
    const majors = D.CLANS.filter(c => c.major).sort((a, b) => a.lvl - b.lvl);
    box.innerHTML = majors.map(c => {
      const nA = c.armies.length, nP = c.start.length;
      const k = c.start.reduce((x, p) => x + D.PROV[E.PI[p]].k, 0);
      return '<div class="clan" data-id="' + c.id + '"><span class="mon md" style="background:' + c.col + '">' + c.mon + '</span><div><div class="nm">' + c.n + '家<span class="lv lv' + c.lvl + '">' + lv[c.lvl] + '</span></div><div class="who">' + c.who + '</div><div class="st">' + nP + 'か国・石高' + k + '・軍勢' + nA + '</div></div></div>';
    }).join('');
    box.querySelectorAll('.clan').forEach(el => el.addEventListener('click', () => pick(el.dataset.id)));
    pick(pickClan || lastClan || 'oda');
  }
  function pick(id) {
    pickClan = id;
    const c = CL[id];
    $('clans').querySelectorAll('.clan').forEach(el => el.classList.toggle('sel', el.dataset.id === id));
    $('clan-detail').innerHTML = '<span class="mon" style="background:' + c.col + ';width:60px;height:60px;font-size:32px">' + c.mon + '</span><div class="txt"><b>' + c.n + '家　' + c.who + '</b><br><span style="color:#d9caa3">' + c.start.map(p => D.PROV[E.PI[p]].n).join('・') + '　難易度 ' + ['', '易', '中', '難'][c.lvl] + '</span><br>' + c.blurb + '<br><span class="trait">【' + c.tn + '】' + c.td + '</span></div>';
    U.flash = id;
    const ps = c.start.map(p => E.PI[p]);
    const ring = new Set(ps); ps.forEach(p => E.padj[p].forEach(q => ring.add(q)));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of ring) { const q = POS[p]; x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    R.fitBox(x0 - 80, y0 - 80, x1 + 80, y1 + 80, 500, { padL: 470, padR: 20, padT: 20, padB: 190, maxS: 1.0, minS: 0.62 });
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
      const uu = (mode === 'play' || mode === 'view') ? U : { flash: mode === 'select' ? U.flash : null, fx: [], spread: {}, me: null };
      R.draw(st, uu, t);
      if (mode === 'play' || mode === 'view') R.drawMini(mm, st, S ? S.player : null);
    }
    placeGov();
    requestAnimationFrame(frame);
  }

  // ───────── 起動（「地図を描いています」を一度表示してから重い処理） ─────────
  function boot() {
    R.init(cv);
    BG = cloneV(E.newGame(null, 7));
    R.resetView(0);
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }
  function uiScale() {
    const z = Math.max(0.74, Math.min(1.12, Math.min(innerWidth / 1600, innerHeight / 900) * 1.05));
    document.documentElement.style.setProperty('--uiz', z.toFixed(3));
  }
  uiScale();
  root.addEventListener('resize', () => { R.resize(); uiScale(); });
  $('b-cont').disabled = !hasSave();
  $('b-load').disabled = ![1, 2, 3].some(i => slotInfo(i));
  $('b-sound').classList.toggle('off', !A.on);
  $('b-bgm').classList.toggle('off', !A.bgmOn);
  requestAnimationFrame(() => setTimeout(boot, 30));

  // ───────── 検証用フック ─────────
  const errors = [];
  root.addEventListener('error', e => errors.push(String(e.message || e)));
  root.SGT = {
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
        document.querySelectorAll('#gov .gv').forEach(el => {
          if (el.disabled) return;
          const r = el.getBoundingClientRect();
          const key = el.dataset.k ? 'gov_' + el.dataset.k : 'prepare_' + el.dataset.target;
          out[key] = [r.left + r.width / 2, r.top + r.height / 2];
        });
        return out;
      },
      state() { return S ? { turn: S.turn, cur: S.cur, phase: S.phase, over: S.over, maxTurn: S.maxTurn, offers: S.offers, dice: S.dice.map(d => d.v + (d.u ? 'u' : '')), mine: S.owner.filter(o => o === S.player).length, kok: E.kokOf(S, S.player), armies: S.armies.filter(a => a.c === S.player).map(a => ({ id: a.id, n: a.n, t: a.t, mv: a.mv, dg: !!a.dg })) } : null; },
      // 自分の手番の次の一手をCPUの思考で選ぶ（クリック座標つき）
      suggest() {
        if (!S || S.cur !== S.player) return null;
        if (S.phase === 'place') { const n = AI.chooseSpawn(S, S.player); return { kind: 'place', n, at: this.nodeScreen(n) }; }
        if (S.phase !== 'move') return { kind: S.phase };
        const m = AI.nextMove(S, S.player);
        if (!m) return { kind: 'end' };
        const a = E.armyById(S, m.army);
        return { kind: m.kind, gov: m.gov, army: m.army, dice: m.idxs, target: m.target, armyAt: this.nodeScreen(a.n), targetAt: m.target != null ? this.nodeScreen(m.target) : null };
      },
      view(cx, cy, z) { R.flyTo(cx, cy, z, 0); },
      home() { homeView(0); },
      resync() { V = cloneV(S); hud(); computeDanger(); clearSel(); if (S.phase === 'move') enterMove(); else if (S.phase === 'roll') enterRoll(); else if (S.phase === 'place') enterPlace(); },
      selectDie(i) { onDieClick(i, false); },
      skipTut() { tutOn = false; setHint(null); },
      answerOffer, isDecide: () => !$('decide').classList.contains('hidden'), isOffer: () => !$('offer').classList.contains('hidden'),
      // 検証用：結末の画面・臣従の申し出をその場で出す
      finish() { finish(); },
      offers() { return handleOffers().then(() => resumePlayerTurn()); },
    },
  };
})(window);
