// GUILDWARD — ギルド「風見鶏」の広間（拠点）。依頼板・編成・鍛冶屋・記録・帰還の場面・第一章の結末
(function () {
  'use strict';
  const H = {
    st: null, panel: null, selReq: null, pick: [], talk: null, seq: [], pending: null, hoverId: null,
    res: null, count: 0, shopMsg: null, boardScroll: 0, ending: null, confetti: [], lastTalk: {},
  };
  const app = () => window.APP21;
  const HUB = {};

  // ---------- 広間をつくる ----------
  function buildWorld() {
    const { S, D, G } = app();
    const st = S.create(D.HUB, { party: ['riko'] });
    for (const p of D.PEOPLE) {
      if (!p.when(G.prof)) continue;
      st.units.push({ id: p.id, k: p.k, team: 'n', x: p.x, y: p.y, z: 1, hp: 9, mhp: 9, mv: 0, acted: true, frozen: 0, ko: false, face: p.face, name: p.name, rescue: false, found: true });
    }
    // 依頼を終えるごとに、広間がにぎやかになる
    const extra = [];
    if (G.prof.done.m5) extra.push({ k: 'deco', sub: 'flagdeco', x: 11, y: 1, h: 2, col: '#3a7a5a', id: 'flag_m5' });
    if (G.prof.chapterDone) extra.push({ k: 'deco', sub: 'flagdeco', x: 1, y: 1, h: 2, col: '#c84a3a', id: 'flag_end' });
    for (const o of extra) { o.z = 1; st.objs.push(o); }
    return st;
  }
  function refreshDeco() {
    const { R, C, G } = app();
    R.trophies = G.prof.trophies.slice();
    R.rankStar = C.rankInfo(G.prof).star;
    R.boardGlow = C.freshCount(G.prof) > 0;
    R.boardNotes = Math.max(2, Math.min(6, C.board(G.prof).filter(x => x.state === 'open').length + 2));
  }

  HUB.enter = function (res, first) {
    const a = app(); const { G, S, R, A, D } = a;
    G.scene = 'guild';
    G.menu = false; G.help = false; G.loseMenu = false;
    H.st = buildWorld();
    G.st = H.st; G.vs = S.clone(H.st); G.sec = D.HUB;
    G.disp = {}; G.odisp = {}; G.queue = []; G.cur = null; G.busy = false; G.fx = []; G.lines = []; G.pops = []; G.bubbles = []; G.narr = []; G.banner = null; G.caption = null; G.bloom = null; G.poi = [];
    G.sel = 'riko'; R.rot = 0; R.hubPick = true;
    a.resetBox();
    R.resetCache(H.st);
    refreshDeco();
    H.panel = null; H.talk = null; H.seq = []; H.pending = null;
    a.snapCam();
    A.bgm('guild');
    if (res) {
      H.seq.push({ k: 'result', res });
      for (const l of (D.RETURN_SAY[res.req.id] || [])) if (res.first) H.seq.push({ k: 'talk', who: l[0], lines: [l[1]] });
      if (res.rankUp) H.seq.push({ k: 'rank', res });
      for (const j of res.joined) H.seq.push({ k: 'join', who: j });
      if (res.chapter) H.seq.push({ k: 'ending' });
      else if (res.newReqs.length || res.shopNew.length) H.seq.push({ k: 'news', res });
    } else if (first) {
      H.seq.push({ k: 'talk', who: 'dora', lines: ['リコ、今日から正式な冒険者だね。おめでとう', '三人一組がうちの決まりさ。ガルドとセナが、ちょうど手が空いてる'] });
      H.seq.push({ k: 'talk', who: 'mimoza', lines: ['はじめての依頼は、うしろの依頼板に貼ってあるわ。押してみて！', '広間の人に話しかけると、いろいろ教えてもらえるわよ'] });
    }
    nextStep();
  };

  function nextStep() {
    const a = app(); const { G, A } = a;
    const s = H.seq.shift();
    if (!s) { H.panel = null; H.talk = null; a.save(); return; }
    if (s.k === 'talk') { H.panel = 'talk'; H.talk = { who: s.who, lines: s.lines, k: 0, t: 0, then: null }; return; }
    if (s.k === 'result') { H.panel = 'result'; H.res = s.res; H.count = 0; H.resT = 0; A.sfx('fanfare'); return; }
    if (s.k === 'rank') { H.panel = 'rank'; H.res = s.res; H.rankT = 0; A.sfx('rank'); refreshDeco(); return; }
    if (s.k === 'join') { H.panel = 'join'; H.joinWho = s.who; H.joinT = 0; A.sfx('win'); return; }
    if (s.k === 'news') { H.panel = 'news'; H.res = s.res; H.newsT = 0; A.sfx('page'); return; }
    if (s.k === 'ending') { H.panel = 'ending'; H.ending = { k: 0, t: 0, final: false }; A.bgm('ending'); for (let i = 0; i < 80; i++) H.confetti.push(confettiBit(true)); return; }
    void G;
  }
  function confettiBit(init) {
    const cols = ['#ffe080', '#ff8a6a', '#8fd45e', '#72cdff', '#c792ff', '#ef8a45'];
    return { x: Math.random() * 1280, y: init ? Math.random() * 720 - 720 : -20, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 80, r: Math.random() * 6, col: cols[(Math.random() * cols.length) | 0] };
  }

  HUB.busy = () => !!H.pending;
  HUB.debug = () => ({ panel: H.panel, pick: H.pick.slice(), selReq: H.selReq, count: H.count, ending: H.ending ? { k: H.ending.k, final: H.ending.final } : null, seq: H.seq.length });
  HUB.camTarget = function () {
    const { R, G } = app();
    const st = G.vs || H.st;
    const [a, b] = R.rawProj(st, 6, 5, 1);
    return [a + 40, b - 30];
  };

  // ---------- 入力 ----------
  HUB.hover = function () {
    const { G, R, S } = app();
    H.hoverId = null;
    if (H.panel || G.busy || H.pending) return;
    const [mx, my] = G.mouse;
    if (G.buttons.some(b => mx >= b.x && my >= b.y && mx < b.x + b.w && my < b.y + b.h)) return;
    const lxp = mx / 2, lyp = my / 2;
    for (let k = R.unitRects.length - 1; k >= 0; k--) {
      const r = R.unitRects[k];
      if (lxp >= r.x && lxp < r.x + r.w && lyp >= r.y && lyp < r.y + r.h) { const u = S.unitById(H.st, r.id); if (u && u.team === 'n') { H.hoverId = u.id; return; } }
    }
    for (let k = (R.objRects || []).length - 1; k >= 0; k--) {
      const r = R.objRects[k];
      if (lxp >= r.x && lxp < r.x + r.w && lyp >= r.y && lyp < r.y + r.h) { H.hoverId = r.id; return; }
    }
  };
  HUB.click = function (x, y) {
    const { G, S, R } = app();
    if (H.panel === 'talk') { talkNext(); return; }
    if (H.panel === 'ending') { endingNext(); return; }
    if (H.panel) return;
    if (G.busy || H.pending) return;
    HUB.hover();
    if (H.hoverId) { approach(H.hoverId); return; }
    const cell = R.pick(H.st, x / 2, y / 2);
    if (cell) {
      const p = S.plan(H.st, 'riko', { k: 'move', x: cell[0], y: cell[1] });
      if (p.ok) walk(p);
    }
  };
  HUB.back = function () {
    if (H.panel === 'party') { H.panel = 'board'; return; }
    if (H.panel && !['talk', 'result', 'rank', 'join', 'news', 'ending'].includes(H.panel)) H.panel = null;
  };
  HUB.key = function (k) {
    const { G, A } = app();
    if (k === 'm' || k === 'M') { G.opt.on = !G.opt.on; A.setOn(G.opt.on); app().saveOpt(); return; }
    if (H.panel === 'talk') { if (k === ' ' || k === 'Enter') talkNext(); return; }
    if (H.panel === 'ending') { if (k === ' ' || k === 'Enter') endingNext(); return; }
    if (['result', 'rank', 'join', 'news'].includes(H.panel)) { if (k === ' ' || k === 'Enter') { if (H.panel === 'result' && H.count < 1) H.count = 1; else nextStep(); } return; }
    if (k === 'Escape') { if (H.panel) HUB.back(); else H.panel = 'menu'; return; }
    if (!H.panel && (k === 'b' || k === 'B')) openBoard();
  };

  function walk(p, then) {
    const { G, S, queue } = app();
    const prev = S.clone(H.st);
    const evs = S.apply(H.st, p);
    G.vs = prev;
    H.pending = then || null;
    queue(evs);
    if (!evs.length) HUB.idle();
  }
  // 人や物のそばまで歩いてから、話す・ひらく
  function approach(id) {
    const { S } = app();
    const st = H.st;
    const u = S.unitById(st, id), o = u ? null : S.objById(st, id);
    const ent = u || o;
    if (!ent) return;
    const me = S.unitById(st, 'riko');
    const dist = S.reach(st, me, { ignoreUnits: true });
    let best = null, bc = 1e9;
    for (const [dx, dy] of S.DIRS) {
      const x = ent.x + dx, y = ent.y + dy;
      if (!S.inside(st, x, y)) continue;
      const i = S.idx(st, x, y);
      if (!dist.has(i) || !S.surface(st, x, y).stand || (S.unitAt(st, x, y) && !(x === me.x && y === me.y))) continue;
      if (dist.get(i).c < bc) { bc = dist.get(i).c; best = [x, y]; }
    }
    const then = () => interact(id);
    if (!best) { then(); return; }
    if (best[0] === me.x && best[1] === me.y) { me.face = S.faceTo(me.x, me.y, ent.x, ent.y, me.face); then(); return; }
    const p = S.plan(st, 'riko', { k: 'move', x: best[0], y: best[1] });
    if (p.ok) walk(p, () => { const m = S.unitById(H.st, 'riko'); m.face = S.faceTo(m.x, m.y, ent.x, ent.y, m.face); then(); });
    else then();
  }
  HUB.idle = function () {
    const { G, S } = app();
    G.vs = S.clone(H.st); G.disp = {}; G.odisp = {};
    const f = H.pending; H.pending = null;
    if (f) f();
  };
  function interact(id) {
    const { D, A } = app();
    A.sfx('select', { f: 700 });
    if (id === 'board' || id === 'counter1' || id === 'counter2') { if (id !== 'board') return talkTo('mimoza', () => openBoard()); return openBoard(); }
    if (id === 'shelf') { H.panel = 'records'; return; }
    if (id === 'anvil' || id === 'tonbo') return talkTo('tonbo', () => { H.panel = 'shop'; H.shopMsg = null; });
    if (id === 'desk') return talkTo('dora');
    if (id === 'hearth') return talkTo('narr', null, ['暖炉の火が、ぱちぱちとはぜている。棚の上の品が、火に照らされて光っている']);
    if (id === 'banner') return talkTo('narr', null, ['ギルドの旗。リコの札の星の数だけ、金の星が縫いつけてある']);
    if (id === 'barrel') return talkTo('narr', null, ['りんご酒の樽。冒険の前に飲むのは、ドーラに禁止されている']);
    if (id === 'mimoza') return talkTo('mimoza', () => openBoard());
    const P = D.PEOPLE.find(p => p.id === id);
    if (P) return talkTo(P.hero || P.id);
  }
  function talkTo(key, then, lines) {
    const { D, G } = app();
    if (!lines) {
      const list = D.TALK[key] || [];
      const ent = list.find(e => e.when(G.prof));
      lines = ent ? ent.text : ['……'];
    }
    const who = key;
    H.panel = 'talk';
    H.talk = { who, lines, k: 0, t: 0, then };
  }
  function talkNext() {
    const t = H.talk; if (!t) return;
    if (t.t < 0.25) return;
    if (t.k < t.lines.length - 1) { t.k++; t.t = 0; app().A.sfx('click'); return; }
    const then = t.then;
    H.talk = null; H.panel = null;
    if (H.seq.length) { nextStep(); return; }
    if (then) then();
  }
  function openBoard() {
    const { G, C } = app();
    H.panel = 'board';
    const list = C.board(G.prof);
    const fresh = list.find(x => x.fresh);
    H.selReq = (fresh || list.find(x => x.state === 'open') || list[0] || {}).r ? (fresh || list.find(x => x.state === 'open') || list[0]).r.id : null;
  }

  HUB.update = function (dt) {
    if (H.talk) H.talk.t += dt;
    if (H.panel === 'result') { H.resT += dt; if (H.resT > 0.4) { const before = H.count; H.count = Math.min(1, H.count + dt * 1.2); if (Math.floor(before * 10) !== Math.floor(H.count * 10) && H.count < 1) app().A.sfx('coin'); } }
    if (H.panel === 'rank') H.rankT += dt;
    if (H.panel === 'join') H.joinT += dt;
    if (H.panel === 'news') H.newsT += dt;
    if (H.ending) H.ending.t += dt;
    for (const c of H.confetti) { c.x += c.vx * dt; c.y += c.vy * dt; c.r += dt * 4; }
    H.confetti = H.confetti.filter(c => c.y < 760);
    if (H.panel === 'ending' && H.confetti.length < 60) H.confetti.push(confettiBit(false));
  };

  // ---------- 描く ----------
  HUB.draw = function () {
    const a = app(); const { G, ctx, txt, button, C, S } = a;
    if (!G.vs) return;
    const hi = {};
    if (H.hoverId) hi[H.hoverId] = '#ffffff';
    if (H.hoverId) { const u = S.unitById(G.vs, H.hoverId); if (u) { const d = G.disp[u.id] || (G.disp[u.id] = { x: u.x, y: u.y, z: u.z, tmp: true }); d.ring = '#ffffff'; } }
    a.drawWorld(G.vs, a.D.HUB, { hi, focus: null });
    for (const id in G.disp) { if (G.disp[id].tmp) delete G.disp[id]; else delete G.disp[id].ring; }
    // 人の名前（指しているとき）
    if (H.hoverId && !H.panel) {
      const u = S.unitById(G.vs, H.hoverId), o = u ? null : S.objById(G.vs, H.hoverId);
      const ent = u || o;
      if (ent) {
        const label = u ? (u.name + (personRole(u.id) ? '（' + personRole(u.id) + '）' : '')) : objLabel(o);
        const [sx, sy] = a.toScreen(ent.x, ent.y, (ent.z || 1) + (u ? 3.6 : 4.2));
        const w = label.length * 17 + 24;
        a.panel(sx - w / 2, sy - 34, w, 34, 0.9);
        txt(label, sx, sy - 11, 16, '#ffe9a0', 'center');
      }
    }
    // 依頼板の「！」
    if (C.freshCount(G.prof) > 0 && !H.panel) {
      const o = S.objById(G.vs, 'board');
      const [sx, sy] = a.toScreen(o.x, o.y, 6.2);
      txt('！', sx, sy - 14 + Math.sin(G.t * 6) * 5, 34, '#ffe680', 'center');
      txt('新しい依頼 ' + C.freshCount(G.prof), sx + 76, sy + 10, 15, '#ffe680', 'center');
    }
    drawTopBar();
    if (!H.panel || H.panel === 'menu') {
      const fresh = C.freshCount(G.prof);
      button('h_board', '依頼板 B', 1280 - 16 - 150, 76, 150, 46, openBoard, { pulse: fresh > 0, size: 18 });
      button('h_shop', '鍛冶屋', 1280 - 16 - 150, 130, 150, 46, () => talkTo('tonbo', () => { H.panel = 'shop'; H.shopMsg = null; }), { size: 18 });
      button('h_rec', '記録', 1280 - 16 - 150, 184, 150, 46, () => { H.panel = 'records'; }, { size: 18 });
      txt('人や依頼板を押すと、そばへ行って話す', 24, 700, 15, '#a8a0c8', 'left', 'normal');
    }
    if (H.panel === 'board') drawBoard();
    if (H.panel === 'party') drawParty();
    if (H.panel === 'shop') drawShop();
    if (H.panel === 'records') drawRecords();
    if (H.panel === 'talk') drawTalk();
    if (H.panel === 'result') drawResult();
    if (H.panel === 'rank') drawRank();
    if (H.panel === 'join') drawJoin();
    if (H.panel === 'news') drawNews();
    if (H.panel === 'menu') drawMenu();
    if (H.panel === 'ending') drawEnding();
    for (const c of H.confetti) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.col; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
  };
  function personRole(id) { const P = app().D.PEOPLE.find(p => p.id === id); return P && P.role; }
  function objLabel(o) { return { board: '依頼板', shelf: '飾り棚（記録）', counter: '受付', desk: 'ギルドマスターの机', hearth: '暖炉', anvil: '鍛冶場', banner: 'ギルドの旗', barrel: '樽', table: 'テーブル', flagdeco: '旗' }[o.sub] || ''; }

  function drawTopBar() {
    const a = app(); const { G, txt, C, ctx } = a;
    const p = G.prof;
    txt('風見鶏ギルド', 22, 38, 24, '#f4ecd8');
    const rk = C.rankInfo(p), nx = C.nextRank(p);
    txt('★'.repeat(rk.star) + '☆'.repeat(Math.max(0, 4 - rk.star)) + '　' + rk.name, 24, 66, 18, '#e8c860', 'left');
    if (nx) {
      const prev = rk.merit, frac = Math.min(1, (p.merit - prev) / (nx.merit - prev));
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(220, 54, 160, 12);
      ctx.fillStyle = '#e8c860'; ctx.fillRect(220, 54, 160 * frac, 12);
      txt('次の星まで 功績 ' + (nx.merit - p.merit), 390, 66, 14, '#c8c0e0', 'left', 'normal');
    }
    txt('銀貨 ' + p.coins, 24, 94, 18, '#ffe6a0', 'left');
    const mm = Math.floor(p.time / 60);
    txt('仲間 ' + (p.roster.length + 1) + '人　ここまで ' + mm + '分', 140, 94, 14, '#a8a0c8', 'left', 'normal');
    const bx = 1280 - 16;
    a.button('h_menu', '≡', bx - 44, 12, 44, 40, () => { H.panel = H.panel === 'menu' ? null : 'menu'; });
    a.button('h_sound', G.opt.on ? '♪' : '×', bx - 96, 12, 44, 40, () => { G.opt.on = !G.opt.on; a.A.setOn(G.opt.on); a.saveOpt(); });
  }

  // ---------- 依頼板 ----------
  function drawBoard() {
    const a = app(); const { G, txt, panel, button, wrap, C, D, ctx, S } = a;
    ctx.fillStyle = 'rgba(4,3,12,0.55)'; ctx.fillRect(0, 0, 1280, 720);
    panel(60, 60, 1160, 610, 0.95, '#b88a5a');
    txt('依頼板', 100, 104, 28, '#f4ecd8');
    txt('依頼を選んで「だれと行く？」で同行する二人を決める', 220, 102, 15, '#c8c0e0', 'left', 'normal');
    const list = C.board(G.prof);
    let y = 128;
    for (const it of list) {
      const r = it.r, sel = H.selReq === r.id;
      const x = 90, w = 420, h = 64;
      ctx.fillStyle = sel ? 'rgba(244,236,216,0.97)' : it.state === 'done' ? 'rgba(200,192,176,0.75)' : 'rgba(232,222,196,0.92)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = sel ? '#e8c860' : '#8a6a4a'; ctx.lineWidth = sel ? 3 : 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.fillStyle = '#c03a2a'; ctx.fillRect(x + w / 2 - 3, y - 3, 6, 6);
      ctx.font = 'bold 19px ' + a.FONT; ctx.textAlign = 'left'; ctx.fillStyle = '#2a2236'; ctx.fillText(r.title, x + 14, y + 26);
      ctx.font = '14px ' + a.FONT; ctx.fillStyle = '#5a4a3a'; ctx.fillText(r.kind + '　' + '★'.repeat(r.stars) + '　依頼人：' + r.client, x + 14, y + 50);
      if (it.fresh) { ctx.fillStyle = '#c03a2a'; ctx.fillRect(x + w - 64, y + 8, 54, 22); ctx.font = 'bold 14px ' + a.FONT; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('NEW', x + w - 37, y + 24); }
      if (it.state === 'done') { ctx.font = 'bold 16px ' + a.FONT; ctx.fillStyle = '#3a7a4a'; ctx.textAlign = 'right'; ctx.fillText('済', x + w - 14, y + 26); }
      G.buttons.push({ key: 'req_' + r.id, label: r.title, x, y, w, h, fn: () => { H.selReq = r.id; } });
      y += h + 10;
    }
    if (G.prof.chapterDone) {
      const T = D.TEASER, x = 90, w = 420, h = 64;
      ctx.fillStyle = 'rgba(120,110,140,0.6)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#a89cc8'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.setLineDash([]);
      ctx.font = 'bold 19px ' + a.FONT; ctx.textAlign = 'left'; ctx.fillStyle = '#e8e0f8'; ctx.fillText(T.title, x + 14, y + 26);
      ctx.font = '14px ' + a.FONT; ctx.fillStyle = '#d0c8e8'; ctx.fillText(T.kind + '　（準備中）', x + 14, y + 50);
      G.buttons.push({ key: 'req_ch2', label: T.title, x, y, w, h, fn: () => { H.selReq = 'ch2'; } });
    }
    // 詳しく
    const dx = 540, dw = 650;
    if (H.selReq === 'ch2') {
      const T = D.TEASER;
      txt(T.title, dx, 160, 26, '#e8e0f8');
      wrap(T.text, 34).forEach((l, k) => txt(l, dx, 204 + k * 26, 18, '#d8d0f0', 'left', 'normal'));
    } else if (H.selReq) {
      const r = D.req(H.selReq), state = C.reqState(G.prof, r);
      G.prof.seenReq[r.id] = true;
      txt(r.title, dx, 160, 26, '#f4ecd8');
      txt(r.kind + '　' + r.area + '　' + '★'.repeat(r.stars), dx, 188, 16, '#e8c860', 'left', 'normal');
      let yy = 222;
      wrap('「' + r.text + '」', 36).forEach((l, k) => { txt(l, dx, yy, 17, '#e8e0f8', 'left', 'normal'); yy += 24; });
      yy += 10;
      txt('目的', dx, yy, 16, '#ffe08a'); txt(r.goal, dx + 60, yy, 16, '#f4ecd8', 'left', 'normal'); yy += 28;
      txt('見どころ', dx, yy, 16, '#ffe08a'); txt(r.features.join('・'), dx + 80, yy, 16, '#f4ecd8', 'left', 'normal'); yy += 28;
      txt('手がかり', dx, yy, 16, '#ffe08a'); txt(r.need, dx + 80, yy, 16, '#bfe0ff', 'left', 'normal'); yy += 28;
      const rw = r.reward;
      txt('報酬', dx, yy, 16, '#ffe08a');
      txt(state === 'done' ? '銀貨 ' + Math.round(rw.coins / 4) + '（2回目からは少なめ。功績はなし）' : '銀貨 ' + rw.coins + (rw.perSack ? '（＋守った米俵ひと俵ごとに ' + rw.perSack + '）' : '') + '　功績 +' + rw.merit + (rw.item ? '　' + D.ITEM[rw.item] : ''), dx + 60, yy, 16, '#ffe6a0', 'left', 'normal'); yy += 32;
      // 編成の記録
      if (!r.fixed) {
        txt('攻略した編成', dx, yy, 16, '#ffe08a');
        const log = G.prof.partyLog[r.id] || [];
        const combos = [['gard', 'sena'], ['gard', 'tobi'], ['sena', 'tobi']].filter(c => c.every(id => G.prof.roster.includes(id)));
        let xx = dx + 120;
        for (const c of combos) {
          const key = c.slice().sort().join('+');
          const ok = log.includes(key);
          const lab = c.map(id => S.HERO[id].name).join('＋');
          txt((ok ? '✓ ' : '・ ') + lab, xx, yy, 15, ok ? '#a8ffb0' : '#8a84a8', 'left', ok ? 'bold' : 'normal');
          xx += lab.length * 16 + 40;
        }
        yy += 28;
      }
      const lab = state === 'done' ? 'もう一度受ける（だれと行く？）' : 'この依頼を受ける（だれと行く？）';
      button('take', lab, dx, 590, 400, 54, () => openParty(r.id), { pulse: state !== 'done', size: 19, bg: 'rgba(110,80,30,0.95)' });
    }
    button('closeboard', '閉じる', 1050, 590, 140, 54, () => { H.panel = null; });
  }

  // ---------- だれと行く？ ----------
  function openParty(reqId) {
    const { G, D } = app();
    const r = D.req(reqId);
    H.panel = 'party'; H.selReq = reqId;
    const roster = G.prof.roster;
    if (r.fixed || roster.length <= 2) H.pick = roster.slice(0, 2);
    else {
      const lp = G.prof.lastParty.filter(id => roster.includes(id));
      H.pick = lp.length === 2 ? lp.slice() : roster.slice(0, 2);
    }
  }
  function togglePick(id) {
    const { A } = app();
    const i = H.pick.indexOf(id);
    if (i >= 0) { H.pick.splice(i, 1); A.sfx('select', { f: 330 }); return; }
    if (H.pick.length >= 2) H.pick.shift();
    H.pick.push(id);
    A.sfx('select', { f: { gard: 440, sena: 880, tobi: 550 }[id] || 600 });
  }
  function drawParty() {
    const a = app(); const { G, txt, panel, button, wrap, D, S, SP, ctx } = a;
    const r = D.req(H.selReq);
    ctx.fillStyle = 'rgba(4,3,12,0.6)'; ctx.fillRect(0, 0, 1280, 720);
    panel(60, 50, 1160, 630, 0.95, '#8fd45e');
    txt('だれと行く？', 100, 100, 32, '#f6eed8');
    txt(r.title + '　―　' + r.goal, 330, 98, 17, '#e8c860', 'left', 'normal');
    // リコ（いつも行く）
    const card = (id, x, y, on, lock, fixed) => {
      const w = 250, h = 300;
      const col = S.HERO[id].color;
      ctx.fillStyle = on ? 'rgba(48,40,80,0.97)' : 'rgba(26,22,44,0.92)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = on ? col : 'rgba(170,160,210,0.35)'; ctx.lineWidth = on ? 4 : 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      if (on && !fixed) { ctx.strokeStyle = `rgba(255,233,160,${0.3 + 0.3 * Math.sin(G.t * 4)})`; ctx.lineWidth = 2; ctx.strokeRect(x - 3, y - 3, w + 6, h + 6); }
      const fr = SP.frame(id, 0, on ? 'act' : 'idle');
      ctx.imageSmoothingEnabled = false;
      if (fr) { ctx.globalAlpha = lock ? 0.35 : 1; ctx.drawImage(fr.c, x + w / 2 - fr.w * 2.5, y + 18 + (on ? Math.round(Math.sin(G.t * 5) * 2) : 0), fr.w * 5, fr.h * 5); ctx.globalAlpha = 1; }
      txt(S.HERO[id].name, x + w / 2, y + 152, 24, on ? '#fff' : '#cfc8e8', 'center');
      txt(S.HERO[id].role + '　「' + S.HERO[id].verbName + '」', x + w / 2, y + 178, 15, col, 'center');
      const hpb = a.C.rankIndex(G.prof.merit);
      txt('体力 ' + (S.HERO[id].hp + hpb) + '　移動 ' + S.HERO[id].mov, x + w / 2, y + 200, 14, '#c8c0e0', 'center', 'normal');
      const gear = D.SHOP.filter(s => s.who === id && G.prof.up[s.id]).map(s => s.name).concat(id === 'riko' && G.prof.up.rope2 ? ['長い鉤縄'] : []);
      if (gear.length) txt(gear.join('・'), x + w / 2, y + 220, 13, '#ffe6a0', 'center', 'normal');
      const say = id === 'riko' ? (fixed ? 'ぼくは、いつも行くよ！' : '') : (r.say && r.say[id]) || '';
      if (say && (on || id !== 'riko')) {
        const ls = wrap(say, 13);
        ls.slice(0, 3).forEach((l, k) => txt(l, x + 14, y + 246 + k * 19, 14, on ? '#f4ecd8' : '#a8a0c8', 'left', 'normal'));
      }
      if (fixed) txt('主人公・いつも行く', x + w / 2, y + h - 10, 13, '#8fd45e', 'center', 'normal');
    };
    card('riko', 90, 130, true, false, true);
    const all = ['gard', 'sena', 'tobi'];
    all.forEach((id, k) => {
      const x = 360 + k * 270, y = 130;
      const have = G.prof.roster.includes(id);
      if (!have) {
        ctx.fillStyle = 'rgba(20,18,34,0.85)'; ctx.fillRect(x, y, 250, 300);
        ctx.strokeStyle = 'rgba(170,160,210,0.25)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(x + 1, y + 1, 248, 298); ctx.setLineDash([]);
        txt('？', x + 125, y + 150, 60, '#4a4468', 'center');
        txt('まだ出会っていない', x + 125, y + 200, 15, '#6a6488', 'center', 'normal');
        return;
      }
      const on = H.pick.includes(id);
      card(id, x, y, on, false, false);
      if (!r.fixed && G.prof.roster.length > 2) G.buttons.push({ key: 'pick_' + id, label: S.HERO[id].name, x, y, w: 250, h: 300, fn: () => togglePick(id) });
    });
    // この編成でできること
    const v = a.C.verbsOf(H.pick);
    const names = { push: '押す', freeze: '凍らせる', blast: '発破', shoot: '射る', rope: '鉤縄' };
    const can = ['shoot', 'rope', 'push', 'freeze', 'blast'].filter(k => v.has(k)).map(k => names[k]);
    const cant = ['push', 'freeze', 'blast'].filter(k => !v.has(k)).map(k => names[k]);
    txt('この三人でできること：' + can.join('・'), 90, 470, 18, '#a8ffb0', 'left');
    if (cant.length && G.prof.roster.length > 2) txt('できないこと：' + cant.join('・'), 90, 498, 16, '#ffb0a0', 'left', 'normal');
    txt('手がかり：' + r.need, 90, 526, 16, '#bfe0ff', 'left', 'normal');
    if (r.fixed) txt('この依頼は、いまギルドで手の空いている二人が同行する（仲間が増えると、ここで選べるようになる）', 90, 554, 15, '#a8a0c8', 'left', 'normal');
    else if (G.prof.roster.length > 2) txt('札を押して、同行する二人を選ぶ（いま ' + H.pick.length + ' / 2 人）', 90, 554, 15, '#c8c0e0', 'left', 'normal');
    button('depart', '出発！', 840, 600, 220, 60, () => {
      if (H.pick.length !== 2) return;
      G.prof.lastParty = H.pick.slice();
      H.panel = null;
      a.startMission(H.selReq, H.pick.slice());
    }, { pulse: H.pick.length === 2, size: 24, bg: 'rgba(60,110,50,0.95)', off: H.pick.length !== 2 });
    button('backboard', 'もどる', 1080, 600, 120, 60, () => { H.panel = 'board'; });
  }

  // ---------- 鍛冶屋 ----------
  function drawShop() {
    const a = app(); const { G, txt, panel, button, wrap, C, S, SP, ctx, A } = a;
    ctx.fillStyle = 'rgba(4,3,12,0.55)'; ctx.fillRect(0, 0, 1280, 720);
    panel(140, 70, 1000, 580, 0.95, '#9aa6ba');
    txt('トンボの鍛冶場', 180, 116, 28, '#f4ecd8');
    txt('銀貨 ' + G.prof.coins, 1100, 116, 22, '#ffe6a0', 'right');
    const list = C.shop(G.prof);
    let y = 150;
    if (!list.length) txt('「まだ打てる品がないな。依頼をこなして、また来な」', 180, 200, 18, '#e8e0f8', 'left', 'normal');
    for (const it of list) {
      const s = it.s, x = 180, w = 920, h = 92;
      ctx.fillStyle = it.owned ? 'rgba(40,60,44,0.9)' : 'rgba(34,30,54,0.92)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = it.owned ? '#7ac88a' : 'rgba(170,160,210,0.4)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      const fr = SP.frame(s.who, 0, 'idle');
      if (fr) { ctx.imageSmoothingEnabled = false; ctx.drawImage(fr.c, x + 14, y + 10, fr.w * 3, Math.min(72, fr.h * 3)); }
      txt(s.name, x + 80, y + 32, 21, '#f4ecd8');
      txt(S.HERO[s.who].name + 'の道具', x + 80 + s.name.length * 22 + 14, y + 31, 15, S.HERO[s.who].color, 'left', 'normal');
      wrap(s.text, 40).slice(0, 2).forEach((l, k) => txt(l, x + 80, y + 58 + k * 21, 16, '#d8d0f0', 'left', 'normal'));
      if (it.owned) txt('鍛えずみ', x + w - 24, y + 52, 18, '#a8ffb0', 'right');
      else button('buy_' + s.id, '銀貨 ' + s.cost + ' で鍛える', x + w - 230, y + 22, 210, 48, () => {
        const r = C.buy(G.prof, s.id);
        if (r.ok) { A.sfx('rank'); H.shopMsg = { text: '「' + s.name + '、仕上がったぜ！ ' + S.HERO[s.who].name + 'に渡しておく」', t: G.t }; a.save(); }
        else { A.sfx('deny'); H.shopMsg = { text: r.why, t: G.t }; }
      }, { off: !it.afford, size: 17 });
      if (!it.member && !it.owned) txt('（まだ仲間にいない）', x + w - 240, y + 84, 13, '#a8a0c8', 'left', 'normal');
      y += h + 12;
    }
    if (H.shopMsg && G.t - H.shopMsg.t < 4) txt(H.shopMsg.text, 640, 600, 18, '#ffe9a0', 'center');
    else txt('鍛えた道具は、次の依頼からすぐ使える。銀貨は依頼の報酬と、地図の宝箱で手に入る', 640, 600, 15, '#a8a0c8', 'center', 'normal');
    button('closeshop', '閉じる', 980, 612, 140, 30, () => { H.panel = null; }, { size: 16 });
  }

  // ---------- 記録（飾り棚） ----------
  function drawRecords() {
    const a = app(); const { G, txt, panel, button, D, S, SP, ctx } = a;
    ctx.fillStyle = 'rgba(4,3,12,0.55)'; ctx.fillRect(0, 0, 1280, 720);
    panel(100, 50, 1080, 620, 0.95, '#e8c860');
    txt('リコの依頼帳', 140, 96, 28, '#f4ecd8');
    const p = G.prof;
    txt('達成した依頼 ' + Object.keys(p.done).length + ' / ' + D.REQUESTS.length + '　戦い ' + p.stats.fights + '回　連携 ' + p.stats.combos + '回', 140, 130, 16, '#d8d0f0', 'left', 'normal');
    // 飾り棚
    txt('飾り棚', 140, 170, 18, '#ffe08a');
    const tr = Object.keys(D.TROPHY);
    tr.forEach((id, k) => {
      const have = p.trophies.includes(id);
      const x = 140 + (k % 3) * 330, y = 196 + ((k / 3) | 0) * 34;
      txt((have ? '◆ ' : '◇ ') + (have ? D.TROPHY[id].name : '？？？'), x, y, 16, have ? '#ffe6a0' : '#6a6488', 'left', have ? 'bold' : 'normal');
      if (have) txt(D.TROPHY[id].from, x + 22, y + 17, 12, '#a8a0c8', 'left', 'normal');
    });
    // 仲間ごとの働き
    txt('仲間の働き', 140, 290, 18, '#ffe08a');
    ['riko'].concat(p.roster).forEach((id, k) => {
      const x = 140 + k * 250, y = 310;
      const fr = SP.frame(id, 0, 'idle');
      if (fr) { ctx.imageSmoothingEnabled = false; ctx.drawImage(fr.c, x, y, fr.w * 3, Math.min(66, fr.h * 3)); }
      txt(S.HERO[id].name, x + 54, y + 22, 18, S.HERO[id].color);
      txt(S.HERO[id].verbName + ' ' + (p.stats.acts[id] || 0) + '回', x + 54, y + 44, 14, '#ddd', 'left', 'normal');
      txt('倒した敵 ' + (p.stats.kills[id] || 0), x + 54, y + 64, 14, '#ddd', 'left', 'normal');
    });
    txt('名場面', 140, 420, 18, '#ffe08a');
    const ms = (p.moments || []).slice(0, 5);
    if (!ms.length) txt('（依頼をこなすと、ここに残る）', 160, 446, 15, '#8a84a8', 'left', 'normal');
    ms.forEach((m, k) => {
      const r = D.req(m.req);
      let xx = 160;
      for (const id of m.who) { ctx.fillStyle = (S.HERO[id] || { color: '#bbb' }).color; ctx.fillRect(xx, 436 + k * 40, 12, 12); xx += 16; }
      txt((r ? r.title : '') + '：' + m.who.map(w => (S.HERO[w] || {}).name || '').join('と') + (m.who.length > 1 ? 'の連携' : ''), xx + 6, 448 + k * 40, 15, '#e8e0f8', 'left', 'bold');
      txt('　' + m.text + (m.cells ? '（' + m.cells + 'マスの道）' : '') + (m.kills ? '（' + m.kills + '体）' : ''), 170, 467 + k * 40, 14, '#cfc8e8', 'left', 'normal');
    });
    button('closerec', '閉じる', 1020, 620, 140, 40, () => { H.panel = null; });
  }

  // ---------- 話す ----------
  function portraitKind(who) {
    const { D } = app();
    if (who === 'narr') return null;
    const P = D.PEOPLE.find(p => p.id === who || p.hero === who);
    return P ? P.k : who;
  }
  function drawTalk() {
    const a = app(); const { G, txt, panel, wrap, SP, ctx } = a;
    const t = H.talk;
    const who = t.who;
    const x = 160, y = 470, w = 960, h = 190;
    panel(x, y, w, h, 0.95, a.colorOf(who));
    const kind = portraitKind(who);
    const fr = kind && SP.frame(kind, 0, 'idle');
    if (fr) { ctx.imageSmoothingEnabled = false; ctx.drawImage(fr.c, x + 24, y + 24, fr.w * 6, Math.min(150, fr.h * 6)); }
    const tx = fr ? x + 140 : x + 40;
    if (who !== 'narr') txt(a.nameOf(who), tx, y + 44, 22, a.colorOf(who));
    const lines = wrap(t.lines[t.k], 36);
    const vis = Math.floor(Math.min(1, t.t * 3) * 999);
    let n = 0;
    lines.forEach((l, k) => { const s = l.slice(0, Math.max(0, vis - n)); n += l.length; txt(s, tx, y + 84 + k * 30, 20, '#f4ecd8', 'left', 'normal'); });
    txt((t.k + 1) + ' / ' + t.lines.length + '　クリックで次へ ▶', x + w - 20, y + h - 16, 14, '#a8a0c8', 'right', 'normal');
    void G;
  }

  // ---------- 帰還の場面 ----------
  function drawResult() {
    const a = app(); const { G, txt, panel, button, D, ctx, S } = a;
    const r = H.res;
    ctx.fillStyle = 'rgba(4,3,12,0.55)'; ctx.fillRect(0, 0, 1280, 720);
    panel(290, 90, 700, 520, 0.96, '#e8c860');
    txt(r.first ? '依頼達成！' : '依頼達成（2回目）', 640, 150, 38, '#ffe08a', 'center');
    txt(r.req.title + '　―　' + r.req.client, 640, 186, 18, '#e8e0f8', 'center', 'normal');
    const c = H.count;
    let y = 240;
    const row = (label, val, col) => { txt(label, 360, y, 20, '#e8e0f8', 'left', 'normal'); txt(val, 920, y, 22, col || '#ffe6a0', 'right'); y += 40; };
    row('報酬', '銀貨 ' + Math.round(r.coins * c));
    if (r.found) row('地図で見つけた銀貨', '銀貨 ' + Math.round(r.found * c));
    if (r.sackBonus) row('守った米俵のお礼', '銀貨 ' + Math.round(r.sackBonus * c));
    if (r.merit) row('功績', '+' + r.merit, '#e8c860');
    for (const it of r.items) row('手に入れた', D.ITEM[it] || it, '#bfe0ff');
    if (r.trophy) row('ギルドの飾り棚に', D.TROPHY[r.trophy].name, '#ffd0a0');
    ctx.fillStyle = 'rgba(232,200,96,0.4)'; ctx.fillRect(360, y - 22, 560, 1);
    txt('いまの銀貨', 360, y + 14, 18, '#c8c0e0', 'left', 'normal'); txt(String(G.prof.coins - Math.round((r.coins + r.found + r.sackBonus) * (1 - c))), 920, y + 14, 24, '#ffe6a0', 'right');
    const party = (G.prof.done[r.req.id] || {}).party || [];
    txt('同行：リコ・' + party.map(id => S.HERO[id].name).join('・'), 640, 560, 16, '#a8a0c8', 'center', 'normal');
    if (c >= 1) button('resnext', 'つぎへ', 560, 580, 160, 44, nextStep, { pulse: true });
  }
  function drawRank() {
    const a = app(); const { txt, panel, button, ctx } = a;
    const r = H.res.rankUp;
    ctx.fillStyle = 'rgba(4,3,12,0.6)'; ctx.fillRect(0, 0, 1280, 720);
    const p = Math.min(1, H.rankT * 2);
    panel(340, 170, 600, 360, 0.96, '#e8c860');
    txt('ランクが上がった！', 640, 230, 34, '#ffe08a', 'center');
    ctx.globalAlpha = p;
    txt('★'.repeat(r.to.star), 640, 310, 54 + Math.round(Math.sin(H.rankT * 6) * 2), '#e8c860', 'center');
    ctx.globalAlpha = 1;
    txt('「' + r.from.name + '」から「' + r.to.name + '」へ', 640, 368, 22, '#f4ecd8', 'center', 'normal');
    txt('仲間みんなの体力 +1。むずかしい依頼が届くようになる', 640, 410, 17, '#a8ffb0', 'center', 'normal');
    txt('ギルドの旗に、星がひとつ縫いつけられた', 640, 440, 16, '#c8c0e0', 'center', 'normal');
    if (H.rankT > 0.8) button('ranknext', 'つぎへ', 560, 470, 160, 44, nextStep, { pulse: true });
  }
  function drawJoin() {
    const a = app(); const { txt, panel, button, ctx, S, SP } = a;
    const id = H.joinWho;
    ctx.fillStyle = 'rgba(4,3,12,0.6)'; ctx.fillRect(0, 0, 1280, 720);
    panel(300, 120, 680, 470, 0.96, S.HERO[id].color);
    txt(S.HERO[id].name + 'が、ギルドの仲間になった！', 640, 176, 30, '#ffe08a', 'center');
    const fr = SP.frame(id, Math.floor(H.joinT * 1.2) % 2 ? 0 : 1, H.joinT % 1 < 0.5 ? 'idle' : 'act');
    if (fr) { ctx.imageSmoothingEnabled = false; ctx.drawImage(fr.c, 640 - fr.w * 3.5, 200, fr.w * 7, fr.h * 7); }
    txt(S.HERO[id].role + '　「' + S.HERO[id].verbName + '」', 640, 372, 20, S.HERO[id].color, 'center');
    const L = ['ひび割れた岩や封印石を、発破で砕く。がれきは足場になる', '敵や物のとなりで発破すると、上下左右のものが外へ吹き飛ぶ', '重くて押せない相手（岩人形など）も、爆風なら動かせる', 'これからは、依頼ごとに「だれと行く？」を選べる'];
    L.forEach((l, k) => txt('・' + l, 380, 410 + k * 28, 17, '#e8e0f8', 'left', 'normal'));
    if (H.joinT > 0.8) button('joinnext', 'つぎへ', 560, 530, 160, 44, nextStep, { pulse: true });
  }
  function drawNews() {
    const a = app(); const { txt, panel, button, ctx, D } = a;
    const r = H.res;
    ctx.fillStyle = 'rgba(4,3,12,0.5)'; ctx.fillRect(0, 0, 1280, 720);
    panel(340, 190, 600, 320, 0.96, '#b88a5a');
    txt('ギルドの知らせ', 640, 240, 28, '#f4ecd8', 'center');
    let y = 290;
    if (r.newReqs.length) { txt('依頼板に、新しい依頼が ' + r.newReqs.length + ' 件', 640, y, 22, '#ffe08a', 'center'); y += 34; for (const id of r.newReqs) { txt('・' + D.req(id).title + '（' + D.req(id).kind + '）', 640, y, 18, '#e8e0f8', 'center', 'normal'); y += 28; } }
    if (r.shopNew.length) { y += 6; txt('鍛冶屋に新しい品：' + r.shopNew.map(id => D.SHOP.find(s => s.id === id).name).join('・'), 640, y, 17, '#bfe0ff', 'center', 'normal'); y += 30; }
    if (H.newsT > 0.5) button('newsnext', 'わかった', 560, 450, 160, 44, nextStep, { pulse: true });
  }
  function drawMenu() {
    const a = app(); const { G, txt, panel, button, ctx, A } = a;
    ctx.fillStyle = 'rgba(4,3,12,0.6)'; ctx.fillRect(0, 0, 1280, 720);
    panel(440, 160, 400, 380);
    txt('メニュー', 640, 206, 26, '#f4ecd8', 'center');
    let y = 236;
    const b = (k, l, fn) => { button(k, l, 470, y, 340, 46, fn); y += 56; };
    b('hm_resume', '続ける', () => { H.panel = null; });
    b('hm_fast', '演出：' + (G.opt.fast ? 'はやい' : 'ふつう'), () => { G.opt.fast = !G.opt.fast; a.saveOpt(); });
    b('hm_vol', '音量：' + Math.round(G.opt.vol * 10) + '　（押すと変わる）', () => { G.opt.vol = G.opt.vol >= 1 ? 0.2 : Math.round((G.opt.vol + 0.2) * 10) / 10; A.setVol(G.opt.vol); A.sfx('select'); a.saveOpt(); });
    b('hm_help', 'ギルドでの遊びかた', () => talkTo('mimoza', null, ['依頼板で依頼を選んで、「だれと行く？」で同行する二人を決めて出発よ', '依頼を達成すると、銀貨と功績がもらえるわ。功績がたまると、ランクが上がるの', '銀貨は鍛冶屋のトンボさんへ。道具を鍛えると、次の依頼からすぐ使えるわ', '一度こなした依頼も、別の仲間と受けなおせるわよ。依頼板に「攻略した編成」が残るの']));
    b('hm_title', 'タイトルへ（保存ずみ）', () => { a.save(); H.panel = null; a.endingDone(); });
  }

  // ---------- 第一章の結末 ----------
  function endingNext() {
    const e = H.ending; if (!e || e.t < 0.6) return;
    const { D, A } = app();
    if (!e.final && e.k < D.EPILOGUE.length - 1) { e.k++; e.t = 0; A.sfx('click'); return; }
    if (!e.final) { e.final = true; e.t = 0; A.sfx('rank'); return; }
  }
  function drawEnding() {
    const a = app(); const { G, txt, button, wrap, ctx, D } = a;
    const e = H.ending;
    if (!e.final) {
      ctx.fillStyle = 'rgba(4,3,12,0.62)'; ctx.fillRect(0, 500, 1280, 180);
      ctx.globalAlpha = Math.min(1, e.t * 2);
      const lines = wrap(D.EPILOGUE[e.k], 34);
      lines.forEach((l, k) => txt(l, 640, 574 + k * 38 - (lines.length - 1) * 19, 26, '#f6eed8', 'center', 'normal'));
      ctx.globalAlpha = 1;
      txt('クリックで次へ', 1240, 668, 15, '#9a94b8', 'right', 'normal');
      return;
    }
    ctx.fillStyle = 'rgba(4,3,12,0.7)'; ctx.fillRect(0, 0, 1280, 720);
    const p = Math.min(1, e.t * 1.5);
    ctx.globalAlpha = p;
    txt('第一章　おわり', 640, 250, 52, '#ffe08a', 'center');
    txt('― 依頼帳は、まだつづく ―', 640, 310, 26, '#e8e0f8', 'center', 'normal');
    const t = G.prof;
    txt('ここまでの時間 ' + Math.floor(t.time / 60) + '分　達成した依頼 ' + Object.keys(t.done).length + '　連携 ' + t.stats.combos + '回', 640, 370, 18, '#c8c0e0', 'center', 'normal');
    txt('ギルドにもどると、ほかの仲間と依頼を受けなおしたり、第二章の予告を見たりできる', 640, 410, 16, '#a8a0c8', 'center', 'normal');
    ctx.globalAlpha = 1;
    if (e.t > 1) {
      button('end_guild', 'ギルドにもどる', 420, 460, 210, 54, () => { H.ending = null; H.panel = null; HUB.enter(null); }, { pulse: true, size: 19 });
      button('end_title', 'タイトルへ', 650, 460, 210, 54, () => { H.ending = null; H.panel = null; a.save(); a.endingDone(); }, { size: 19 });
    }
  }

  window.HUB21 = HUB;
})();
