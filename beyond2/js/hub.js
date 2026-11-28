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
      // 印の数が腕だめし帳のごほうびに届いたら、ドーラのひとこと（帳面は、石切り場のあとからひらく）
      const C = a.C;
      if (C.ledgerOpen(G.prof) && C.ledgerReady(G.prof) && (res.ledgerNew.length || (res.req.id === 'm3' && res.first))) {
        H.seq.push({ k: 'talk', who: 'dora', lines: ['腕だめしの印が ' + C.stampCount(G.prof) + ' つになったね。帳面にごほうびがあるよ。あとで、あたしの机までおいで'] });
      }
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
    if (s.k === 'result') { H.panel = 'result'; H.res = s.res; H.count = 0; H.resT = 0; for (let k = 0; k < 4; k++) H['stampSfx' + k] = false; A.sfx('fanfare'); return; }
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
    if (H.panel === 'party' && H.charmFor) { H.charmFor = null; return; }
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
    if (id === 'anvil' || id === 'tonbo') return talkTo('tonbo', openShop);
    if (id === 'desk' || id === 'dora') return talkDora();
    if (id === 'hearth') return talkTo('narr', null, ['暖炉の火が、ぱちぱちとはぜている。棚の上の品が、火に照らされて光っている']);
    if (id === 'banner') return talkTo('narr', null, ['ギルドの旗。リコの札の星の数だけ、金の星が縫いつけてある']);
    if (id === 'barrel') return talkTo('narr', null, ['りんご酒の樽。冒険の前に飲むのは、ドーラに禁止されている']);
    if (id === 'mimoza') return talkTo('mimoza', () => openBoard());
    const P = D.PEOPLE.find(p => p.id === id);
    if (P) return talkTo(P.hero || P.id);
  }
  // ドーラ：石切り場のあとからは、話すと腕だめし帳がひらく（受けとれる段があれば、そのことを先に言う）
  function talkDora() {
    const { C, G } = app();
    if (!C.ledgerOpen(G.prof)) return talkTo('dora');
    const n = C.ledgerReady(G.prof);
    if (n) return talkTo('dora', openLedger, ['腕だめし帳だね。印が ' + C.stampCount(G.prof) + ' つ。ごほうびを受けとっていきな']);
    return talkTo('dora', openLedger);
  }
  function openLedger() { H.panel = 'ledger'; H.ledgerMsg = null; }
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
      button('h_shop', '鍛冶屋', 1280 - 16 - 150, 130, 150, 46, () => talkTo('tonbo', openShop), { size: 18 });
      button('h_rec', '記録', 1280 - 16 - 150, 184, 150, 46, () => { H.panel = 'records'; }, { size: 18 });
      txt('人や依頼板を押すと、そばへ行って話す', 24, 700, 15, '#a8a0c8', 'left', 'normal');
    }
    if (H.panel === 'board') drawBoard();
    if (H.panel === 'party') drawParty();
    if (H.panel === 'shop') drawShop();
    if (H.panel === 'records') drawRecords();
    if (H.panel === 'ledger') drawLedger();
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
    const maxStar = a.D.RANKS[a.D.RANKS.length - 1].star;
    txt('★'.repeat(rk.star) + '☆'.repeat(Math.max(0, maxStar - rk.star)) + '　' + rk.name, 24, 66, 18, '#e8c860', 'left');
    if (nx) {
      const prev = rk.merit, frac = Math.min(1, (p.merit - prev) / (nx.merit - prev));
      const bx0 = 300;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx0, 54, 140, 12);
      ctx.fillStyle = '#e8c860'; ctx.fillRect(bx0, 54, 140 * frac, 12);
      txt('次の星まで 功績 ' + (nx.merit - p.merit), bx0 + 150, 66, 14, '#c8c0e0', 'left', 'normal');
    }
    txt('銀貨 ' + p.coins, 24, 94, 18, '#ffe6a0', 'left');
    const mm = Math.floor(p.time / 60);
    txt('仲間 ' + (p.roster.length + 1) + '人　腕だめしの印 ' + C.stampCount(p) + '　ここまで ' + mm + '分', 140, 94, 14, '#a8a0c8', 'left', 'normal');
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
    // 札が多くなったら（第二章）、一枚を低くして並べる（v0.3）
    const many = list.length > 6;
    let y = 128;
    list.forEach((it, n) => {
      const r = it.r, sel = H.selReq === r.id;
      const x = 90, w = 420, h = many ? 50 : 64;
      if (r.chapter === 2 && !(list[n - 1] && list[n - 1].r.chapter === 2)) { txt('― 第二章　北の峠の風 ―', x + w / 2, y + 12, 15, '#bfe0ff', 'center', 'normal'); y += 22; }
      ctx.fillStyle = sel ? 'rgba(244,236,216,0.97)' : it.state === 'done' ? 'rgba(200,192,176,0.75)' : 'rgba(232,222,196,0.92)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = sel ? '#e8c860' : '#8a6a4a'; ctx.lineWidth = sel ? 3 : 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.fillStyle = '#c03a2a'; ctx.fillRect(x + w / 2 - 3, y - 3, 6, 6);
      const ty1 = many ? 21 : 26, ty2 = many ? 41 : 50;
      ctx.font = 'bold ' + (many ? 17 : 19) + 'px ' + a.FONT; ctx.textAlign = 'left'; ctx.fillStyle = '#2a2236'; ctx.fillText(r.title, x + 14, y + ty1);
      ctx.font = (many ? 13 : 14) + 'px ' + a.FONT; ctx.fillStyle = '#5a4a3a'; ctx.fillText(r.kind + '　' + '★'.repeat(r.stars) + '　依頼人：' + r.client, x + 14, y + ty2);
      if (it.fresh) { ctx.fillStyle = '#c03a2a'; ctx.fillRect(x + w - 64, y + (many ? 5 : 8), 54, 22); ctx.font = 'bold 14px ' + a.FONT; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('NEW', x + w - 37, y + (many ? 21 : 24)); }
      if (it.state === 'done') { ctx.font = 'bold 16px ' + a.FONT; ctx.fillStyle = '#3a7a4a'; ctx.textAlign = 'right'; ctx.fillText('済', x + w - 14, y + ty1); }
      // 腕だめしの印 ◆（とれた）◇（まだ）
      const sts = D.STAMPS[r.id] || [];
      if (sts.length) {
        ctx.font = 'bold 17px ' + a.FONT; ctx.textAlign = 'right';
        sts.forEach((s, k) => { ctx.fillStyle = G.prof.stamps[s.id] ? '#c8901e' : '#8a7a6a'; ctx.fillText(G.prof.stamps[s.id] ? '◆' : '◇', x + w - 74 - (sts.length - 1 - k) * 18, y + ty1 + 1); });
      }
      G.buttons.push({ key: 'req_' + r.id, label: r.title, x, y, w, h, fn: () => { H.selReq = r.id; } });
      y += h + (many ? 6 : 10);
    });
    // 第二章の予告の札は、第二章の依頼が貼られるまで（v0.3 で m7 に置きかわる）。風守りの里のあとは、つづきの予告
    const teaser = G.prof.chapterDone && !list.some(x => x.r.chapter === 2) ? D.TEASER : G.prof.done.m8 && D.TEASER2 ? D.TEASER2 : null;
    if (teaser) {
      const T = teaser, x = 90, w = 420, h = many ? 50 : 64;
      ctx.fillStyle = 'rgba(120,110,140,0.6)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#a89cc8'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.setLineDash([]);
      ctx.font = 'bold ' + (many ? 17 : 19) + 'px ' + a.FONT; ctx.textAlign = 'left'; ctx.fillStyle = '#e8e0f8'; ctx.fillText(T.title, x + 14, y + (many ? 21 : 26));
      ctx.font = (many ? 13 : 14) + 'px ' + a.FONT; ctx.fillStyle = '#d0c8e8'; ctx.fillText(T.kind + '　（準備中）', x + 14, y + (many ? 41 : 50));
      G.buttons.push({ key: 'req_' + T.id, label: T.title, x, y, w, h, fn: () => { H.selReq = T.id; } });
    }
    // 詳しく
    const dx = 540, dw = 650;
    if (H.selReq === 'ch2' || H.selReq === 'ch2b') {
      const T = H.selReq === 'ch2b' ? D.TEASER2 : D.TEASER;
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
      txt('手がかり', dx, yy, 16, '#ffe08a');
      wrap(r.need, 34).forEach((l, k) => { txt(l, dx + 80, yy, 16, '#bfe0ff', 'left', 'normal'); if (k) void k; yy += 22; }); yy += 6;
      const rw = r.reward;
      txt('報酬', dx, yy, 16, '#ffe08a');
      txt(state === 'done' ? '銀貨 ' + Math.round(rw.coins / 4) + '（2回目からは少なめ。功績はなし。持ち帰った宝箱は空）' : '銀貨 ' + rw.coins + (rw.perSack ? '（＋守った米俵ひと俵ごとに ' + rw.perSack + '）' : '') + '　功績 +' + rw.merit + (rw.item ? '　' + D.ITEM[rw.item] : ''), dx + 60, yy, 16, '#ffe6a0', 'left', 'normal'); yy += 30;
      // 編成の記録（いまの仲間で組める二人を全部）
      if (state === 'done' || !r.fixed) {
        txt('攻略した編成', dx, yy, 16, '#ffe08a');
        const log = G.prof.partyLog[r.id] || [];
        let xx = dx + 120;
        for (const c of C.pairs(G.prof, r)) {
          const key = C.pairKey(c);
          const ok = log.includes(key);
          const lab = c.map(id => S.HERO[id].name).join('＋');
          txt((ok ? '✓ ' : '・ ') + lab, xx, yy, 15, ok ? '#a8ffb0' : '#8a84a8', 'left', ok ? 'bold' : 'normal');
          xx += lab.length * 16 + 40;
        }
        yy += 28;
      }
      // 腕だめしの印（条件は最初から見える）
      const sts = D.STAMPS[r.id] || [];
      if (sts.length) {
        txt('腕だめし', dx, yy, 16, '#ffe08a');
        sts.forEach((s, k) => {
          const got = !!G.prof.stamps[s.id];
          let t = (got ? '◆ ' : '◇ ') + D.STAMP_KIND[s.kind] + '：' + s.text;
          if (s.kind === 'pair' && !got && C.pairImpossible(G.prof, r)) t += '（いまの仲間では組めない）';
          txt(t, dx + 90, yy + k * 22, 15, got ? '#ffd860' : '#d8d0f0', 'left', got ? 'bold' : 'normal');
        });
        yy += sts.length * 22;
      }
      const lab = state === 'done' ? 'もう一度受ける（だれと行く？）' : 'この依頼を受ける（だれと行く？）';
      button('take', lab, dx, 600, 400, 50, () => openParty(r.id), { pulse: state !== 'done', size: 19, bg: 'rgba(110,80,30,0.95)' });
    }
    button('closeboard', '閉じる', 1050, 600, 140, 50, () => { H.panel = null; });
  }

  // ---------- だれと行く？ ----------
  function openParty(reqId) {
    const { G, D, C } = app();
    const r = D.req(reqId);
    H.panel = 'party'; H.selReq = reqId; H.charmFor = null;
    const ids = C.pickable(G.prof, r);
    // 同行が決まっているのは初回だけ。受けなおしは、だれとでも（m3 はトビを選べない）
    if (C.fixedParty(G.prof, r) || ids.length <= 2) H.pick = (C.fixedParty(G.prof, r) ? G.prof.roster : ids).slice(0, 2);
    else {
      const lp = G.prof.lastParty.filter(id => ids.includes(id));
      H.pick = lp.length === 2 ? lp.slice() : ids.slice(0, 2);
    }
  }
  function partyLocked() { const { G, D, C } = app(); const r = D.req(H.selReq); return C.fixedParty(G.prof, r) || C.pickable(G.prof, r).length <= 2; }
  function togglePick(id) {
    const { A } = app();
    H.charmFor = null;
    const i = H.pick.indexOf(id);
    if (i >= 0) { H.pick.splice(i, 1); A.sfx('select', { f: 330 }); return; }
    if (H.pick.length >= 2) H.pick.shift();
    H.pick.push(id);
    A.sfx('select', { f: { gard: 440, sena: 880, tobi: 550 }[id] || 600 });
  }
  function drawParty() {
    const a = app(); const { G, txt, panel, button, wrap, D, S, SP, ctx, C } = a;
    const r = D.req(H.selReq);
    const p = G.prof;
    const fixedNow = C.fixedParty(p, r);
    const locked = partyLocked();
    const showCharm = (p.charms || []).length > 0;   // お守りの枠は、はじめて一つ手に入れたときから出る
    ctx.fillStyle = 'rgba(4,3,12,0.6)'; ctx.fillRect(0, 0, 1280, 720);
    panel(60, 40, 1160, 650, 0.95, '#8fd45e');
    txt('だれと行く？', 100, 88, 32, '#f6eed8');
    txt(r.title + '　―　' + r.goal, 330, 86, 17, '#e8c860', 'left', 'normal');
    const CY = 108, CH = 296;
    // 仲間が4人になったら（第二章）、札を細くして5枚並べる（v0.3）
    const slots = S.COMPANIONS.length, CW = slots >= 4 ? 210 : 250, GAP = slots >= 4 ? 12 : 20;
    const wrapN = CW < 240 ? 11 : 13;
    const card = (id, x, y, on, lock, fixed, note) => {
      const w = CW, h = CH;
      const col = S.HERO[id].color;
      ctx.fillStyle = on ? 'rgba(48,40,80,0.97)' : 'rgba(26,22,44,0.92)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = on ? col : 'rgba(170,160,210,0.35)'; ctx.lineWidth = on ? 4 : 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      if (on && !fixed) { ctx.strokeStyle = `rgba(255,233,160,${0.3 + 0.3 * Math.sin(G.t * 4)})`; ctx.lineWidth = 2; ctx.strokeRect(x - 3, y - 3, w + 6, h + 6); }
      const fr = SP.frame(id, 0, on ? 'act' : 'idle');
      ctx.imageSmoothingEnabled = false;
      if (fr) { ctx.globalAlpha = lock ? 0.35 : 1; const sc = fr.h > 23 ? 4.5 : 5; ctx.drawImage(fr.c, x + w / 2 - fr.w * sc / 2, y + 14 + (on ? Math.round(Math.sin(G.t * 5) * 2) : 0), fr.w * sc, Math.min(fr.h * sc, 118)); ctx.globalAlpha = 1; }
      txt(S.HERO[id].name, x + w / 2, y + 148, 24, on ? '#fff' : '#cfc8e8', 'center');
      txt(S.HERO[id].role + '　「' + S.verbLabel(id, p.up) + '」', x + w / 2, y + 174, w < 240 && S.verbLabel(id, p.up).length > 6 ? 13 : 15, col, 'center');
      const hpb = C.rankIndex(p.merit);
      const fx = on && p.equip[id] && p.charms.includes(p.equip[id]) ? (S.CHARM_FX[p.equip[id]] || {}) : {};
      txt('体力 ' + (S.HERO[id].hp + hpb + (fx.hp || 0)) + (fx.hp ? '（＋' + fx.hp + '）' : '') + '　移動 ' + (S.HERO[id].mov + (fx.mov || 0)) + (fx.mov ? '（＋' + fx.mov + '）' : ''), x + w / 2, y + 196, 14, fx.hp || fx.mov ? '#ffe6a0' : '#c8c0e0', 'center', 'normal');
      const gear = D.SHOP.filter(s => s.who === id && p.up[s.id]).map(s => s.name).concat(id === 'riko' && p.up.rope2 ? ['長い鉤縄'] : []).concat(id === 'riko' && p.up.hook ? ['引き鉤'] : []);
      const gtxt = gear.length ? '道具：' + gear.join('・') : '道具：なし';
      txt(gtxt, x + w / 2, y + 216, gtxt.length > 14 && w < 240 ? 11 : 13, gear.length ? '#ffe6a0' : '#8a84a8', 'center', 'normal');
      const say = note || (id === 'riko' ? (fixed ? 'ぼくは、いつも行くよ！' : '') : (r.say && r.say[id]) || '');
      if (say && (on || id !== 'riko')) {
        const ls = wrap(say, wrapN);
        const warnNote = note && fixed !== 'guest';
        ls.slice(0, 3).forEach((l, k) => txt(l, x + 14, y + 240 + k * 19, 14, warnNote ? '#ffb0a0' : on ? '#f4ecd8' : '#a8a0c8', 'left', 'normal'));
      }
      if (fixed) txt(fixed === 'guest' ? '同行のゲスト・選ばない' : '主人公・いつも行く', x + w / 2, y + h - 8, 13, fixed === 'guest' ? col : '#8fd45e', 'center', 'normal');
    };
    // お守りの枠（同行する三人だけ）
    const charmSlot = (id, x) => {
      if (!showCharm) return;
      const cid = p.equip[id] && p.charms.includes(p.equip[id]) ? p.equip[id] : null;
      const y = CY + CH + 8, w = CW, h = 36;
      const open = H.charmFor === id;
      ctx.fillStyle = open ? 'rgba(90,70,30,0.95)' : cid ? 'rgba(60,48,24,0.92)' : 'rgba(30,26,46,0.9)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = cid ? '#e8c860' : 'rgba(170,160,210,0.4)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      txt('お守り', x + 12, y + 24, 14, '#ffe08a', 'left');
      txt(cid ? '◆ ' + D.CHARMS[cid].name : 'なし（押して選ぶ）', x + 66, y + 24, w < 240 ? 13 : 15, cid ? '#ffe6a0' : '#a8a0c8', 'left', cid ? 'bold' : 'normal');
      G.buttons.push({ key: 'charm_' + id, label: 'お守り', x, y, w, h, fn: () => { H.charmFor = H.charmFor === id ? null : id; } });
    };
    card('riko', 90, CY, true, false, true);
    charmSlot('riko', 90);
    const all = S.COMPANIONS;
    const allowed = C.pickable(p, r);
    all.forEach((id, k) => {
      const x = 90 + (k + 1) * (CW + GAP), y = CY;
      const have = p.roster.includes(id);
      // 同行のゲスト（m8 のナギ）：選ばない。いつも4人目として同行する（05 5.2）
      if (r.guest === id) {
        card(id, x, y, true, false, 'guest', have ? 'この依頼では、いつも同行する（選ばない）' : (r.say && r.say[id]) || '里の子。この依頼に同行する');
        charmSlot(id, x);
        return;
      }
      if (!have) {
        ctx.fillStyle = 'rgba(20,18,34,0.85)'; ctx.fillRect(x, y, CW, CH);
        ctx.strokeStyle = 'rgba(170,160,210,0.25)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(x + 1, y + 1, CW - 2, CH - 2); ctx.setLineDash([]);
        txt('？', x + CW / 2, y + 150, 60, '#4a4468', 'center');
        txt('まだ出会っていない', x + CW / 2, y + 200, 15, '#6a6488', 'center', 'normal');
        return;
      }
      const ok = allowed.includes(id);
      const on = H.pick.includes(id);
      card(id, x, y, on, !ok, false, ok ? null : 'この依頼では、岩棚で助けを待っている側（選べない）');
      if (on) charmSlot(id, x);
      if (!locked && ok) G.buttons.push({ key: 'pick_' + id, label: S.HERO[id].name, x, y, w: CW, h: CH, fn: () => togglePick(id) });
    });
    // この編成でできること
    const ty = showCharm ? CY + CH + 70 : CY + CH + 40;
    const goers = H.pick.concat(r.guest && !H.pick.includes(r.guest) ? [r.guest] : []);
    const v = C.verbsOf(goers, p.up);
    const names = { push: '押す', freeze: '凍らせる', blast: '発破', shoot: '射る', rope: '鉤縄', pull: '引く', waft: 'あおぐ' };
    const can = ['shoot', 'rope', 'pull', 'push', 'freeze', 'blast', 'waft'].filter(k => v.has(k)).map(k => names[k]);
    // できないこと：いまの仲間（と、この依頼のゲスト）が持つ力のうち、連れていかないもの
    const known = ['push', 'freeze', 'blast'].concat(p.roster.includes('nagi') || r.guest === 'nagi' ? ['waft'] : []);
    const cant = known.filter(k => !v.has(k)).map(k => names[k]);
    txt('この' + (goers.length >= 3 ? '四' : '三') + '人でできること：' + can.join('・'), 90, ty, 18, '#a8ffb0', 'left');
    if (cant.length && p.roster.length > 2) txt('できないこと：' + cant.join('・'), 90, ty + 26, 16, '#ffb0a0', 'left', 'normal');
    txt('手がかり：' + r.need, 90, ty + 52, 16, '#bfe0ff', 'left', 'normal');
    if (fixedNow) txt('はじめての依頼は、いまギルドで手の空いている二人が同行する（達成したあとは、だれとでも受けなおせる）', 90, ty + 78, 15, '#a8a0c8', 'left', 'normal');
    else if (locked && p.roster.length > 2) txt('この依頼で選べるのは、この二人だけ', 90, ty + 78, 15, '#a8a0c8', 'left', 'normal');
    else if (p.roster.length > 2) txt('札を押して、同行する二人を選ぶ（いま ' + H.pick.length + ' / 2 人）' + (showCharm ? '。お守りは、札の下の枠で一人に一つ' : ''), 90, ty + 78, 15, '#c8c0e0', 'left', 'normal');
    // この二人では目的を果たせない受けなおし（v0.2 の自由編成で生じた組み合わせ）は、出発の前に知らせる
    // 文か、持っている道具で変わる関数 (p) => 文（v0.3：大うちわ・氷晶の杖があれば渡れる、など）
    const w0 = !fixedNow && r.replayWarn && H.pick.length === 2 && r.replayWarn[C.pairKey(H.pick)];
    const warn = typeof w0 === 'function' ? w0(p) : w0;
    if (warn) txt('！ ' + warn, 90, ty + 106, 16, '#ff9a80', 'left');
    button('depart', '出発！', 840, 620, 220, 56, () => {
      if (H.pick.length !== 2) return;
      // 出発の並び（＝地図の開始位置・札の番号）は、選んだ順ではなく、いつも同じ順（ガルド・セナ・トビ）にする（v0.2。依頼の仕様の開始位置はこの順が前提）
      const party = S.COMPANIONS.filter(id => H.pick.includes(id));
      p.lastParty = party.slice();
      H.panel = null; H.charmFor = null;
      a.startMission(H.selReq, party);
    }, { pulse: H.pick.length === 2 && !H.charmFor, size: 24, bg: 'rgba(60,110,50,0.95)', off: H.pick.length !== 2 });
    button('backboard', 'もどる', 1080, 620, 120, 56, () => { H.panel = 'board'; H.charmFor = null; });
    if (H.charmFor) drawCharmPicker();
  }
  // お守りを選ぶ（持っているお守りの一覧。ほかの人が持っていれば、移しかえる）
  function drawCharmPicker() {
    const a = app(); const { G, txt, panel, button, D, S, C } = a;
    const p = G.prof, who = H.charmFor;
    const list = p.charms.slice();
    const w = 560, h = 120 + (list.length + 1) * 58, x = 640 - w / 2, y = Math.max(60, 330 - h / 2);
    panel(x, y, w, h, 0.97, '#e8c860');
    txt(S.HERO[who].name + 'に持たせるお守り', x + 24, y + 40, 22, '#f4ecd8');
    txt('一人に一つ。同じ物は二つとない', x + 24, y + 66, 14, '#c8c0e0', 'left', 'normal');
    let yy = y + 84;
    for (const cid of list) {
      const c = D.CHARMS[cid];
      const hold = C.holder(p, cid);
      const mine = hold === who;
      button('charmpick_' + cid, '', x + 20, yy, w - 40, 50, () => { C.equipCharm(p, who, cid); H.charmFor = null; a.A.sfx('select', { f: 760 }); a.save(); }, { bg: mine ? 'rgba(90,70,30,0.95)' : undefined });
      txt('◆ ' + c.name, x + 36, yy + 22, 17, '#ffe6a0', 'left');
      txt(c.text, x + 36, yy + 42, 13, '#d8d0f0', 'left', 'normal');
      if (hold) txt(mine ? '持たせている' : S.HERO[hold].name + 'が持っている（移す）', x + w - 32, yy + 22, 13, mine ? '#a8ffb0' : '#ffb0a0', 'right', 'normal');
      yy += 58;
    }
    button('charmpick_none', '持たせない', x + 20, yy, (w - 52) / 2, 46, () => { C.equipCharm(p, who, null); H.charmFor = null; a.save(); }, { size: 16 });
    button('charmclose', 'もどる', x + 32 + (w - 52) / 2, yy, (w - 52) / 2, 46, () => { H.charmFor = null; }, { size: 16 });
  }

  // ---------- 鍛冶屋 ----------
  // v0.3：品が増えても収まるように、左に品の一覧（道具／お守りのタブ。多ければスクロール）、右に選んだ品のくわしい説明と「鍛える」
  // （v0.2 までは一列に並べていたので、道具5・お守り2 で画面からはみ出した。二段目の道具・お守りが増えても、この形のまま並ぶ）
  const SHOP_ROWS = 7;
  function openShop() { H.panel = 'shop'; H.shopMsg = null; H.shopSel = null; H.shopScroll = 0; H.shopTab = null; }
  function shopLists() {
    const { G, C } = app();
    const list = C.shop(G.prof);
    // 鍛えられる品を先に、鍛えずみ（持っている）品をあとに。どちらも店に並んだ順
    const order = (l) => l.filter(it => !it.owned).concat(l.filter(it => it.owned));
    return { tool: order(list.filter(it => it.s.kind !== 'charm')), charm: order(list.filter(it => it.s.kind === 'charm')) };
  }
  function shopScrollBy(n) {
    const L = shopLists()[H.shopTab || 'tool'] || [];
    H.shopScroll = Math.max(0, Math.min(Math.max(0, L.length - SHOP_ROWS), (H.shopScroll || 0) + n));
  }
  HUB.wheel = function (dy) { if (H.panel === 'shop') shopScrollBy(dy > 0 ? 1 : -1); };
  function drawShop() {
    const a = app(); const { G, txt, panel, button, wrap, C, S, SP, ctx, A, D } = a;
    ctx.fillStyle = 'rgba(4,3,12,0.55)'; ctx.fillRect(0, 0, 1280, 720);
    panel(140, 40, 1000, 646, 0.95, '#9aa6ba');
    txt('トンボの鍛冶場', 180, 84, 28, '#f4ecd8');
    txt('銀貨 ' + G.prof.coins, 1100, 84, 22, '#ffe6a0', 'right');
    const close = () => button('closeshop', '閉じる', 970, 640, 140, 40, () => { H.panel = null; }, { size: 17 });
    const lists = shopLists();
    if (!lists.tool.length && !lists.charm.length) { txt('「まだ打てる品がないな。依頼をこなして、また来な」', 180, 160, 18, '#e8e0f8', 'left', 'normal'); close(); return; }
    if (!H.shopTab || !lists[H.shopTab].length) H.shopTab = lists.tool.length ? 'tool' : 'charm';
    const L = lists[H.shopTab];
    // トンボのひとこと（買ったとき・買えないときは、その返事）
    const msg = H.shopMsg && G.t - H.shopMsg.t < 5 ? H.shopMsg.text : null;
    txt(msg || 'トンボ「鍛えた道具は、次の依頼からすぐ使える。お守りは、出発のときに一人に一つ持たせな」', 180, 120, 15, msg ? '#ffe9a0' : '#a8a0c8', 'left', msg ? 'bold' : 'normal');
    // タブ（道具／お守り）
    const tab = (key, label, x) => {
      const on = H.shopTab === key;
      button('shoptab_' + key, label + '（' + lists[key].length + '）', x, 138, 170, 38, () => { H.shopTab = key; H.shopSel = null; H.shopScroll = 0; A.sfx('click'); },
        { size: 16, bg: on ? 'rgba(96,84,150,0.97)' : undefined, off: !lists[key].length });
    };
    tab('tool', '道具', 180); tab('charm', 'お守り', 360);
    // 選んでいる品（はじめは、いま鍛えられる品）
    if (!H.shopSel || !L.some(it => it.s.id === H.shopSel)) H.shopSel = (L.find(it => !it.owned && it.afford && !it.needFirst) || L.find(it => !it.owned) || L[0]).s.id;
    const maxScroll = Math.max(0, L.length - SHOP_ROWS);
    H.shopScroll = Math.max(0, Math.min(maxScroll, H.shopScroll || 0));
    // 左：品の一覧
    const LX = 180, LW = 380, RH = 58, LY = 188;
    L.slice(H.shopScroll, H.shopScroll + SHOP_ROWS).forEach((it, k) => {
      const s = it.s, y = LY + k * (RH + 6), sel = H.shopSel === s.id, charm = s.kind === 'charm';
      ctx.fillStyle = sel ? 'rgba(70,62,112,0.97)' : it.owned ? 'rgba(36,52,42,0.9)' : 'rgba(34,30,54,0.92)'; ctx.fillRect(LX, y, LW, RH);
      ctx.strokeStyle = sel ? '#e8c860' : it.owned ? 'rgba(122,200,138,0.6)' : 'rgba(170,160,210,0.4)'; ctx.lineWidth = sel ? 3 : 1.5; ctx.strokeRect(LX + 1, y + 1, LW - 2, RH - 2);
      if (charm) txt('◆', LX + 28, y + 40, 26, '#e8c860', 'center');
      else { const fr = SP.frame(s.who, 0, 'idle'); if (fr) { ctx.imageSmoothingEnabled = false; ctx.drawImage(fr.c, LX + 12, y + 5, fr.w * 2, Math.min(48, fr.h * 2)); } }
      txt(s.name, LX + 56, y + 25, 18, it.owned ? '#cfe8d4' : '#f4ecd8');
      txt(charm ? 'お守り' : S.HERO[s.who].name + 'の道具', LX + 56, y + 47, 13, charm ? '#e8c860' : S.HERO[s.who].color, 'left', 'normal');
      const st = it.owned ? (charm ? '持っている' : '鍛えずみ') : it.needFirst ? '先に一段目を' : '銀貨 ' + s.cost;
      txt(st, LX + LW - 14, y + 36, 15, it.owned ? '#a8ffb0' : it.needFirst ? '#ffb0a0' : it.afford ? '#ffe6a0' : '#8a84a8', 'right');
      G.buttons.push({ key: 'shopitem_' + s.id, label: s.name, x: LX, y, w: LW, h: RH, fn: () => { H.shopSel = s.id; A.sfx('select', { f: 620 }); } });
    });
    if (maxScroll > 0) {
      const bottom = LY + SHOP_ROWS * (RH + 6) - 6;
      button('shopup', '▲', LX + LW + 8, LY, 34, 40, () => shopScrollBy(-1), { off: H.shopScroll <= 0, size: 15 });
      button('shopdown', '▼', LX + LW + 8, bottom - 40, 34, 40, () => shopScrollBy(1), { off: H.shopScroll >= maxScroll, size: 15 });
      txt((H.shopScroll + 1) + '〜' + Math.min(L.length, H.shopScroll + SHOP_ROWS) + '　/ ' + L.length + '（ホイールでも送れる）', LX, bottom + 22, 13, '#a8a0c8', 'left', 'normal');
    }
    // 右：選んだ品のくわしい説明と「鍛える」
    const it = L.find(q => q.s.id === H.shopSel);
    const s = it.s, charm = s.kind === 'charm';
    const DX = 628, DY = 188, DW = 482, DH = 440;
    ctx.fillStyle = 'rgba(26,22,44,0.94)'; ctx.fillRect(DX, DY, DW, DH);
    ctx.strokeStyle = it.owned ? 'rgba(122,200,138,0.7)' : 'rgba(232,200,96,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(DX + 1, DY + 1, DW - 2, DH - 2);
    if (charm) txt('◆', DX + 70, DY + 104, 72, '#e8c860', 'center');
    else { const fr = SP.frame(s.who, 0, 'idle'); if (fr) { ctx.imageSmoothingEnabled = false; ctx.drawImage(fr.c, DX + 70 - fr.w * 2, DY + 18, fr.w * 4, Math.min(112, fr.h * 4)); } }
    txt(s.name, DX + 140, DY + 58, 26, '#f4ecd8');
    txt(charm ? 'お守り（一人に一つ持たせる）' : S.HERO[s.who].name + 'の道具', DX + 140, DY + 90, 15, charm ? '#e8c860' : S.HERO[s.who].color, 'left', 'normal');
    let yy = DY + 160;
    wrap(s.text, 27).forEach((l) => { txt(l, DX + 28, yy, 17, '#e8e0f8', 'left', 'normal'); yy += 27; });
    yy += 10;
    const note = charm ? '「だれと行く？」の札の下の枠で、一人に一つ持たせる。同じ物は二つとない' : '鍛えた道具は、はずせない。' + S.HERO[s.who].name + 'が出撃すると、いつも効く';
    wrap(note, 32).forEach((l) => { txt(l, DX + 28, yy, 14, '#a8a0c8', 'left', 'normal'); yy += 21; });
    if (charm && it.owned) { const hold = C.holder(G.prof, s.id); txt(hold ? 'いまは ' + S.HERO[hold].name + ' が持っている' : 'いまは、だれも持っていない', DX + 28, yy + 8, 14, '#ffe6a0', 'left', 'normal'); }
    if (!it.member && !it.owned) txt('（' + S.HERO[s.who].name + 'は、まだ仲間にいない）', DX + 28, DY + DH - 92, 14, '#ffb0a0', 'left', 'normal');
    const by = DY + DH - 72;
    if (it.owned) txt(charm ? '持っている' : '鍛えずみ', DX + DW / 2, by + 36, 24, '#a8ffb0', 'center');
    else if (it.needFirst) txt('先に「' + ((D.SHOP.find(q => q.id === it.needFirst) || {}).name || it.needFirst) + '」を鍛える', DX + DW / 2, by + 36, 18, '#ffb0a0', 'center');
    else {
      button('buy_' + s.id, '銀貨 ' + s.cost + (charm ? ' で買う' : ' で鍛える'), DX + 24, by, DW - 48, 54, () => {
        const r = C.buy(G.prof, s.id);
        if (r.ok) { A.sfx('rank'); H.shopMsg = { text: charm ? 'トンボ「' + s.name + '、仕上がったぜ！ だれに持たせるかは、出発のときに決めな」' : 'トンボ「' + s.name + '、仕上がったぜ！ ' + S.HERO[s.who].name + 'に渡しておく」', t: G.t }; a.save(); }
        else { A.sfx('deny'); H.shopMsg = { text: r.why, t: G.t }; }
      }, { off: !it.afford, size: 20, bg: it.afford ? 'rgba(110,80,30,0.95)' : undefined });
      if (!it.afford) txt('銀貨が足りない（あと ' + (s.cost - G.prof.coins) + '）', DX + DW / 2, by - 12, 14, '#ffb0a0', 'center', 'normal');
    }
    close();
  }

  // ---------- 記録（飾り棚） ----------
  function drawRecords() {
    const a = app(); const { G, txt, panel, button, D, S, SP, ctx } = a;
    ctx.fillStyle = 'rgba(4,3,12,0.55)'; ctx.fillRect(0, 0, 1280, 720);
    panel(80, 34, 1120, 652, 0.95, '#e8c860');
    const p = G.prof;
    txt('リコの依頼帳', 120, 78, 28, '#f4ecd8');
    if (p.titles && p.titles.length) txt('称号「' + p.titles[p.titles.length - 1] + '」', 330, 76, 18, '#ffd860', 'left');
    txt('達成した依頼 ' + Object.keys(p.done).length + ' / ' + D.REQUESTS.length + '　戦い ' + p.stats.fights + '回　連携 ' + p.stats.combos + '回', 120, 108, 16, '#d8d0f0', 'left', 'normal');
    // 腕だめしの印
    const C = a.C;
    const allStamps = Object.values(D.STAMPS).reduce((s, l) => s + l.length, 0);
    const nl = C.nextLedger(p);
    txt('腕だめしの印 ' + C.stampCount(p) + ' / ' + allStamps + (C.ledgerReady(p) ? '　ドーラの帳面に、受けとれるごほうびがある' : nl ? '　次のごほうびまで あと ' + nl.left : ''), 640, 108, 16, '#ffe08a', 'left', 'normal');
    // 飾り棚（左）
    txt('飾り棚', 120, 146, 18, '#ffe08a');
    const tr = Object.keys(D.TROPHY);
    tr.forEach((id, k) => {
      const have = p.trophies.includes(id);
      const x = 120 + (k % 3) * 176, y = 172 + ((k / 3) | 0) * 36;
      txt((have ? '◆ ' : '◇ ') + (have ? D.TROPHY[id].name : '？？？'), x, y, 14, have ? '#ffe6a0' : '#6a6488', 'left', have ? 'bold' : 'normal');
      txt(have ? D.TROPHY[id].from : '', x + 18, y + 16, 11, '#a8a0c8', 'left', 'normal');
    });
    // お守り（右）
    txt('お守り', 680, 146, 18, '#ffe08a');
    Object.keys(D.CHARMS).forEach((cid, k) => {
      const c = D.CHARMS[cid], have = (p.charms || []).includes(cid);
      const y = 172 + k * 36, hold = have ? C.holder(p, cid) : null;
      txt((have ? '◆ ' + c.name : '◇ ？？？'), 680, y, 15, have ? '#ffe6a0' : '#6a6488', 'left', have ? 'bold' : 'normal');
      txt(have ? c.text + (hold ? '（' + S.HERO[hold].name + 'に持たせている）' : '') : '手がかり：' + c.from, 700, y + 16, 12, have ? '#d8d0f0' : '#a8a0c8', 'left', 'normal');
    });
    // 仲間ごとの働きと道具
    txt('仲間の働きと道具', 120, 300, 18, '#ffe08a');
    ['riko'].concat(p.roster).forEach((id, k) => {
      const x = 120 + k * 262, y = 318;
      const fr = SP.frame(id, 0, 'idle');
      if (fr) { ctx.imageSmoothingEnabled = false; ctx.drawImage(fr.c, x, y, fr.w * 3, Math.min(66, fr.h * 3)); }
      txt(S.HERO[id].name, x + 54, y + 20, 18, S.HERO[id].color);
      txt(S.HERO[id].verbName + ' ' + (p.stats.acts[id] || 0) + '回　倒した敵 ' + (p.stats.kills[id] || 0), x + 54, y + 40, 13, '#ddd', 'left', 'normal');
      const gear = D.SHOP.filter(s => s.who === id && p.up[s.id]).map(s => s.name).concat(id === 'riko' && p.up.rope2 ? ['長い鉤縄'] : []).concat(id === 'riko' && p.up.hook ? ['引き鉤'] : []);
      txt('道具：' + (gear.length ? gear.join('・') : 'なし'), x + 54, y + 58, 12, gear.length ? '#ffe6a0' : '#8a84a8', 'left', 'normal');
    });
    txt('名場面', 120, 420, 18, '#ffe08a');
    const ms = (p.moments || []).slice(0, 5);
    if (!ms.length) txt('（依頼をこなすと、ここに残る）', 140, 446, 15, '#8a84a8', 'left', 'normal');
    ms.forEach((m, k) => {
      const r = D.req(m.req);
      let xx = 140;
      for (const id of m.who) { ctx.fillStyle = (S.HERO[id] || { color: '#bbb' }).color; ctx.fillRect(xx, 436 + k * 40, 12, 12); xx += 16; }
      txt((r ? r.title : '') + '：' + m.who.map(w => (S.HERO[w] || {}).name || '').join('と') + (m.who.length > 1 ? 'の連携' : ''), xx + 6, 448 + k * 40, 15, '#e8e0f8', 'left', 'bold');
      txt('　' + m.text + (m.cells ? '（' + m.cells + 'マスの道）' : '') + (m.kills ? '（' + m.kills + '体）' : ''), 150, 467 + k * 40, 14, '#cfc8e8', 'left', 'normal');
    });
    button('closerec', '閉じる', 1040, 636, 140, 40, () => { H.panel = null; });
  }

  // ---------- ドーラの腕だめし帳 ----------
  function drawLedger() {
    const a = app(); const { G, txt, panel, button, D, S, C, ctx, A } = a;
    const p = G.prof;
    ctx.fillStyle = 'rgba(4,3,12,0.6)'; ctx.fillRect(0, 0, 1280, 720);
    panel(70, 34, 1140, 652, 0.96, '#e8823a');
    txt('ドーラの腕だめし帳', 110, 80, 28, '#f4ecd8');
    txt('印 ' + C.stampCount(p), 1170, 80, 24, '#ffd860', 'right');
    txt('依頼ごとに三つ。別のやり方でこなすと、一つにつき一度だけ印がつく（受けなおしても、もらえる銀貨は少なめ）', 110, 108, 14, '#c8c0e0', 'left', 'normal');
    // ごほうびの段（左）
    txt('ごほうび', 110, 146, 18, '#ffe08a');
    let y = 160;
    for (const row of C.ledger(p)) {
      const t = row.t;
      const parts = [];
      if (t.charm) parts.push('お守り「' + D.CHARMS[t.charm].name + '」');
      if (t.coins) parts.push('銀貨 ' + t.coins);
      if (t.trophy) parts.push('飾り棚「' + D.TROPHY[t.trophy].name + '」');
      if (t.title) parts.push('称号「' + t.title + '」');
      ctx.fillStyle = row.got ? 'rgba(40,60,44,0.85)' : row.ready ? 'rgba(90,70,30,0.95)' : 'rgba(30,26,46,0.85)';
      ctx.fillRect(110, y, 520, 44);
      txt('印 ' + t.n, 124, y + 28, 17, row.got ? '#a8ffb0' : row.ready ? '#ffe08a' : '#a8a0c8', 'left');
      txt(parts.join('＋'), 196, y + 28, 15, row.got ? '#c8e8c8' : '#f4ecd8', 'left', 'normal');
      if (row.got) txt('受けとった', 618, y + 28, 14, '#a8ffb0', 'right', 'normal');
      else if (row.ready) button('ledger_' + t.n, '受けとる', 520, y + 5, 104, 34, () => {
        const r = C.claim(p, t.n);
        if (r.ok) {
          A.sfx('rank');
          const g = r.got.map(x => x.k === 'charm' ? 'お守り「' + D.CHARMS[x.id].name + '」' : x.k === 'coins' ? '銀貨 ' + x.n : x.k === 'trophy' ? '「' + D.TROPHY[x.id].name + '」' : '称号「' + x.text + '」').join('と');
          H.ledgerMsg = { text: '「' + g + '。持っていきな」' + (r.got.some(x => x.k === 'charm') ? '（お守りは「だれと行く？」で持たせる）' : ''), t: G.t };
          a.save();
        }
      }, { size: 15, pulse: true });
      else txt('あと ' + row.left, 618, y + 28, 14, '#8a84a8', 'right', 'normal');
      y += 50;
    }
    // 印の一覧（右）
    txt('印の一覧', 670, 146, 18, '#ffe08a');
    let yy = 172;
    for (const r of D.REQUESTS) {
      const sts = D.STAMPS[r.id] || [];
      if (!sts.length) continue;
      const open = C.reqState(p, r) !== 'locked';
      txt(open ? r.title : '？？？', 670, yy, 15, open ? '#e8e0f8' : '#6a6488', 'left');
      sts.forEach((s, k) => {
        const got = !!p.stamps[s.id];
        txt((got ? '◆ ' : '◇ ') + (open ? s.name : '？？？'), 690 + k * 168, yy + 20, 13, got ? '#ffd860' : '#a8a0c8', 'left', got ? 'bold' : 'normal');
      });
      yy += 50;
    }
    txt('条件は、依頼板の札の「腕だめし」に出ている', 670, yy + 4, 13, '#a8a0c8', 'left', 'normal');
    if (H.ledgerMsg && G.t - H.ledgerMsg.t < 5) txt(H.ledgerMsg.text, 640, 646, 16, '#ffe9a0', 'center');
    button('closeledger', '閉じる', 1050, 640, 140, 36, () => { H.panel = null; }, { size: 16 });
    void S;
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
    panel(290, 70, 700, 580, 0.96, '#e8c860');
    txt(r.first ? '依頼達成！' : '依頼達成（' + ((G.prof.done[r.req.id] || {}).times || 2) + '回目）', 640, 126, 38, '#ffe08a', 'center');
    txt(r.req.title + '　―　' + r.req.client, 640, 160, 18, '#e8e0f8', 'center', 'normal');
    const c = H.count;
    let y = 206;
    const row = (label, val, col) => { txt(label, 360, y, 19, '#e8e0f8', 'left', 'normal'); txt(val, 920, y, 21, col || '#ffe6a0', 'right'); y += 36; };
    row('報酬', '銀貨 ' + Math.round(r.coins * c));
    if (r.found) row('地図で見つけた銀貨', '銀貨 ' + Math.round(r.found * c));
    if (r.sackBonus) row('守った米俵のお礼', '銀貨 ' + Math.round(r.sackBonus * c));
    if (r.merit) row('功績', '+' + r.merit, '#e8c860');
    for (const it of r.items) row('手に入れた', D.ITEM[it] || it, '#bfe0ff');
    if (r.trophy) row('ギルドの飾り棚に', D.TROPHY[r.trophy].name, '#ffd0a0');
    // 腕だめしの印（とれた印の名を一つずつ）
    (r.stamps || []).forEach((s, k) => {
      const show = c >= 0.6 + k * 0.12;
      if (show && !H['stampSfx' + k]) { H['stampSfx' + k] = true; app().A.sfx('ding'); }
      txt(k === 0 ? '腕だめしの印' : '', 360, y, 19, '#e8e0f8', 'left', 'normal');
      if (show) txt('◆ ' + (s.kind === 'pair' ? s.name : a.D.STAMP_KIND[s.kind] + '：' + s.name), 920, y, 19, '#ffd860', 'right');
      y += 32;
    });
    ctx.fillStyle = 'rgba(232,200,96,0.4)'; ctx.fillRect(360, y - 20, 560, 1);
    txt('いまの銀貨', 360, y + 12, 18, '#c8c0e0', 'left', 'normal'); txt(String(G.prof.coins - Math.round((r.coins + r.found + r.sackBonus) * (1 - c))), 920, y + 12, 24, '#ffe6a0', 'right');
    if (r.stamps && r.stamps.length) txt('印はぜんぶで ' + r.stampTotal, 360, y + 40, 15, '#ffd860', 'left', 'normal');
    const party = (G.prof.done[r.req.id] || {}).party || [];
    txt('同行：リコ・' + party.map(id => S.HERO[id].name).join('・'), 640, 586, 16, '#a8a0c8', 'center', 'normal');
    if (c >= 1) button('resnext', 'つぎへ', 560, 598, 160, 42, nextStep, { pulse: true });
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
    const L = (app().D.JOIN || {})[id] || [];
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
    b('hm_help', 'ギルドでの遊びかた', () => talkTo('mimoza', null, ['依頼板で依頼を選んで、「だれと行く？」で同行する二人を決めて出発よ', '依頼を達成すると、銀貨と功績がもらえるわ。功績がたまると、ランクが上がるの', '銀貨は鍛冶屋のトンボさんへ。道具を鍛えると、次の依頼からすぐ使えるわ', '一度こなした依頼も、だれとでも受けなおせるわよ。依頼板に「攻略した編成」が残るの', '依頼板の札の ◇ は腕だめし。別のやり方でこなすと印がつくわ。印が集まったら、ドーラさんの帳面へ', 'お守りは「だれと行く？」で、一人に一つ持たせられるの。同じ物は二つとないわよ']));
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
