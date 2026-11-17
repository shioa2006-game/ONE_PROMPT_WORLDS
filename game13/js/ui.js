// からり、国盗り ― 画面と操作
(function (root) {
  'use strict';
  var D = root.KD, E = root.KE, AI = root.KAI, GX = root.KG, A = root.KA, M = root.KM;
  var CW = 1280, CH = 720, PX = 700, PW = 580;
  var FONT = GX.FONT, GOTH = GX.GOTH;
  var INK = '#2a2018', RED = '#b8362c', BLUE = '#2f4f7f', GOLD = '#b8891e';
  var SAVE = 'karari13.save', REC = 'karari13.rec', OPT = 'karari13.opt';
  var RATE = ['', 'やさしい', 'やや易しい', 'ふつう', 'むずかしい', '至難'];
  var NOTE = ['能登七尾の堅城。隣は一向一揆と神保。', '越後の龍。兵は精強で、隣国は少ない。', '小田原の雄。堅い守りと豊かな国力。',
    '加賀の一向一揆。兵は多いが四方に敵。', '越中の小勢力。上杉の影がせまる。', '越前一乗谷。豊かだが四方を囲まれる。',
    '若狭の小国。都への道をにぎる。', '飛騨の山国。貧しいが攻めにくい。', '義元亡きあとの大国。武田と徳川が狙う。',
    '独立したばかりの三河。まわりは強敵ばかり。', '美濃の要。七つの国と境を接する。', '大和の小勢力。隣には三好がいる。',
    '北近江の若き当主。小谷の堅城が頼り。', '南近江の名門。畿内の要をおさえる。', '忍びの里。貧しいが落としにくい。',
    '伊勢の国司。五つの国に囲まれる。', '都の将軍家。権威はあるが兵がない。', '畿内の覇者。国は豊かで、隣は弱い。',
    '甲斐の虎。最強の兵と堅い守り、六方に敵。', '桶狭間の勝者。国は豊か、兵はこれから。'];

  var cv, c, geo;
  var st = {
    screen: 'title', G: null, V: null, phase: '', selDie: -1, selProv: -1, mode: '', atk: null, hover: -1,
    pick: 19, help: false, menu: false, time: 0, speed: 1, fast: false,
    ticker: [], fx: [], Q: [], afterQ: null, battle: null, banner: null, rollAnim: null, res: null, hint: 0,
    dieUse: [], mouse: { x: 0, y: 0 }, confirmEnd: false, raids: []
  };
  var buttons = [];
  var rec = load(REC) || {}, opt = load(OPT) || { sound: true, bgm: true, seen: false };

  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できなくても遊べる */ } }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) { /* 同上 */ } }

  // ================= 進行 =================
  function syncView() {
    var G = st.G;
    st.V = G.prov.map(function (P) { return { owner: P.owner, eco: P.eco, cas: P.cas, troops: P.troops, guard: P.guard, truce: !!P.truce }; });
    repaint();
  }
  function repaint() { GX.paint(st.V.map(function (p) { return p.owner; }), st.G ? st.G.player : -1); }
  function applyPatch(ev, noPaint) {
    if (!ev || !ev.patch) return false;
    var ch = false;
    Object.keys(ev.patch).forEach(function (k) { if (st.V[k].owner !== ev.patch[k].owner) ch = true; st.V[k] = ev.patch[k]; });
    if (ch && !noPaint) repaint();
    return ch;
  }

  function newGame(clan) {
    st.G = E.create({ player: clan });
    st.selDie = -1; st.selProv = -1; st.mode = ''; st.atk = null; st.ticker = []; st.fx = []; st.Q = []; st.battle = null; st.res = null;
    st.dieUse = []; st.fast = false; st.confirmEnd = false;
    syncView();
    st.screen = 'play'; st.phase = 'cpu';
    A.play('start');
    seasonBanner();
    E.startSeason(st.G);
    st.afterQ = advance;
  }
  function resume() {
    var G = load(SAVE);
    if (!G || !G.prov) return false;
    st.G = G; st.selDie = -1; st.selProv = -1; st.mode = ''; st.atk = null; st.ticker = []; st.fx = []; st.Q = []; st.res = null; st.dieUse = [];
    syncView();
    st.screen = 'play'; st.phase = 'cpu';
    seasonBanner();
    st.afterQ = advance;
    return true;
  }
  function seasonBanner() {
    var d = E.dateOf(st.G.turn);
    st.Q.push({ dur: 1.1, start: function () { A.play('season'); st.banner = { text: d.year + '年　' + d.season, sub: '永禄' + kan(d.eiroku) + '年', u: 0 }; },
      update: function (u) { st.banner.u = u; }, end: function () { st.banner = null; } });
  }
  function kan(n) { var k = '〇一二三四五六七八九'; return n < 10 ? k[n] : n === 10 ? '十' : '十' + k[n - 10]; }

  // 順番に大名の番を進める。プレイヤーの番で止まる
  function advance() {
    var G = st.G;
    if (st.Q.length) { st.afterQ = advance; return; }
    if (G.over) return finish();
    if (G.player >= 0 && !G.clan[G.player].alive) return finish('dead');
    while (G.oi < G.order.length) {
      var cl = G.order[G.oi];
      if (!G.clan[cl].alive) { G.oi++; continue; }
      if (cl === G.player) {
        store(SAVE, G);
        st.phase = 'roll'; st.selDie = -1; st.selProv = -1; st.mode = ''; st.dieUse = []; st.confirmEnd = false;
        return;
      }
      st.phase = 'cpu';
      var evs = AI.takeTurn(G, cl, {});
      G.oi++;
      var any = false;
      evs.forEach(function (ev) {
        if (ev.type === 'battle') { any = true; pushBattle(ev); }
        else if (ev.patch) st.Q.push({ dur: 0, start: function () { applyPatch(ev); } });
      });
      if (any || G.over) { st.afterQ = advance; return; }
      // 合戦のない番は即座に反映
      while (st.Q.length) { var it = st.Q.shift(); it.start && it.start(); }
    }
    E.endSeason(G);
    if (G.over) return finish();
    E.startSeason(G);
    st.fast = false;
    seasonBanner();
    st.afterQ = advance;
  }

  function finish(kind) {
    var G = st.G, pl = G.player;
    var rk = E.ranking(G), myRank = E.rankOf(G, pl), n = E.countOf(G, pl);
    var type = (kind === 'dead' || !G.clan[pl].alive) ? 'dead' : G.over.type;
    st.res = { type: type, rank: myRank, n: n, rk: rk, t: 0, after: false };
    var r = rec[pl] || { best: 99, n: 0, unify: false, plays: 0 };
    r.plays++;
    if (type !== 'dead') { if (myRank < r.best) r.best = myRank; if (n > r.n) r.n = n; if (type === 'unify' && G.over.winner === pl) r.unify = true; }
    rec[pl] = r; store(REC, rec);
    drop(SAVE);
    st.screen = 'result'; st.phase = '';
    A.play(type === 'dead' ? 'fall' : myRank === 1 ? 'bigwin' : myRank <= 3 ? 'win' : 'season');
  }
  // 滅亡後：残りの季節を一気に進めて結末を見る
  function watchRest() {
    var G = st.G;
    while (!G.over) {
      for (; G.oi < G.order.length && !G.over; G.oi++) { var cl = G.order[G.oi]; if (G.clan[cl].alive) AI.takeTurn(G, cl, {}); }
      if (!G.over) { E.endSeason(G); if (!G.over) E.startSeason(G); }
    }
    syncView();
    st.res.rk = E.ranking(G); st.res.after = true; st.res.t = 0;
  }

  // ---- プレイヤーの番 ----
  function doRoll() {
    var G = st.G;
    if (st.phase !== 'roll') return;
    var evs = E.beginTurn(G, G.player);
    applyPatch(evs[0]);
    var ip = evs[0];
    if (ip.n > 0) { floatAt(PX + 330, 130, '金 +' + ip.n + (ip.harvest ? '（秋の年貢）' : ''), GOLD); A.play('coin'); }
    st.phase = 'rolling';
    st.rollAnim = { t: 0, dur: 0.75, faces: G.dice.map(function () { return 1; }) };
    A.play('dice', G.dice.length);
    st.dieUse = G.dice.map(function () { return ''; });
  }
  function firstFree() { var G = st.G; for (var i = 0; i < G.dice.length; i++) if (!G.dice[i].used) return i; return -1; }
  function freeCount() { var n = 0; st.G.dice.forEach(function (d) { if (!d.used) n++; }); return n; }
  function afterAction() {
    st.mode = ''; st.atk = null; st.confirmEnd = false;
    if (st.selDie < 0 || !st.G.dice[st.selDie] || st.G.dice[st.selDie].used) st.selDie = firstFree();
  }
  function act(kind) {
    var G = st.G, di = st.selDie, p = st.selProv, ev = null, cs = geo.castle[p];
    if (st.phase !== 'act' || di < 0 || p < 0) return;
    if (kind === 'develop') { ev = E.develop(G, di, p); if (ev) { A.play('develop'); floatAt(cs.x, cs.y - 30, '経済 ' + (ev.to - 1) + ' → ' + ev.to, BLUE); glow(p, [120, 200, 255]); } }
    if (kind === 'fortify') { ev = E.fortify(G, di, p); if (ev) { A.play('fortify'); floatAt(cs.x, cs.y - 30, '城 ' + (ev.to - 1) + ' → ' + ev.to, BLUE); glow(p, [255, 255, 255]); } }
    if (kind === 'recruit') { ev = E.recruit(G, di, p); if (ev) { A.play('recruit'); floatAt(cs.x, cs.y - 30, '兵 +' + ev.n, BLUE); glow(p, [255, 230, 150]); } }
    if (kind === 'guard') { ev = E.guard(G, di, p); if (ev) { A.play('guard'); floatAt(cs.x, cs.y - 30, '備え +' + ev.n, RED); glow(p, [255, 200, 120]); } }
    if (!ev) { A.play('deny'); return; }
    st.dieUse[di] = { develop: '開', fortify: '築', recruit: '徴', guard: '備' }[kind];
    applyPatch(ev);
    afterAction();
  }
  function startTarget() {
    if (st.selDie < 0 || st.selProv < 0) return;
    st.mode = 'target'; A.play('click');
  }
  function openAttack(from, to) {
    var G = st.G;
    if (G.prov[to].owner === G.player) {
      var mx = E.moveMax(G, from, to);
      if (mx <= 0) { A.play('deny'); return; }
      st.mode = 'move'; st.atk = { from: from, to: to, n: mx, max: mx, d2: -1 };
    } else {
      if (!E.canAttack(G, from, to) || G.turn < E.R.PEACE) { A.play('deny'); return; }
      var mxA = G.prov[from].troops - 1, sure = E.defBase(G.prov[to]) + 7 - (st.selDie >= 0 ? G.dice[st.selDie].v : 0);
      st.mode = 'attack'; st.atk = { from: from, to: to, n: sure >= 1 && sure <= mxA ? sure : mxA, max: mxA, d2: -1 };
    }
    st.selProv = from; A.play('pick');
  }
  function atkValue() {
    var G = st.G, a = st.atk, vs = [G.dice[st.selDie].v];
    if (a.d2 >= 0) vs.push(G.dice[a.d2].v);
    return E.attackValue(vs);
  }
  function commitAttack() {
    var G = st.G, a = st.atk, di = st.selDie;
    if (st.mode === 'move') {
      var ev = E.move(G, di, a.from, a.to, a.n);
      if (!ev) { A.play('deny'); return; }
      st.dieUse[di] = '移'; A.play('march');
      var f = geo.castle[a.from], t = geo.castle[a.to];
      st.Q.push({ dur: 0.35, update: function (u) { st.battle = { arrow: [f, t, u], small: true, col: '#3a6ea8' }; }, end: function () { st.battle = null; applyPatch(ev); floatAt(t.x, t.y - 30, '兵 +' + ev.n, BLUE); } });
      afterAction(); st.selProv = a.to;
      return;
    }
    var dis = [di]; if (a.d2 >= 0) dis.push(a.d2);
    var ev2 = E.attack(G, dis, a.from, a.to, a.n);
    if (!ev2) { A.play('deny'); return; }
    dis.forEach(function (k) { st.dieUse[k] = '攻'; });
    pushBattle(ev2);
    afterAction();
    st.afterQ = function () {
      if (G.over) return finish();
      if (ev2.win) st.selProv = a.to;
    };
  }
  function doReroll() {
    var G = st.G;
    if (st.phase !== 'act' || G.rerolled || freeCount() === 0) { A.play('deny'); return; }
    E.reroll(G);
    st.phase = 'rolling'; st.rollAnim = { t: 0, dur: 0.6, faces: G.dice.map(function (d) { return d.v; }), re: true };
    A.play('dice', freeCount()); st.mode = ''; st.atk = null;
  }
  function doFlip() {
    var G = st.G;
    if (st.phase !== 'act' || st.selDie < 0 || !E.canFlip(G, st.selDie)) { A.play('deny'); return; }
    var cost = E.flipCost(G);
    E.flip(G, st.selDie); A.play('flip');
    st.flipAnim = { di: st.selDie, t: 0 };
    floatAt(PX + 330, 130, '金 −' + cost, RED);
    if (st.atk) st.atk.d2 = -1;
  }
  function doBuy() {
    var G = st.G;
    if (st.phase !== 'act' || !E.canBuy(G)) { A.play('deny'); return; }
    var cost = E.buyCost(G);
    E.buyDie(G); st.dieUse.push('');
    st.newDie = { di: G.dice.length - 1, t: 0 };
    A.play('coin'); A.play('dice', 1);
    floatAt(PX + 330, 130, '金 −' + cost, RED);
    st.selDie = G.dice.length - 1; st.confirmEnd = false;
  }
  function endTurn() {
    var G = st.G;
    if (st.phase !== 'act' || st.Q.length) return;
    st.raids = [];
    var ev = E.endTurn(G);
    if (ev.n > 0) { floatAt(PX + 330, 130, '余った賽 → 金 +' + ev.n, GOLD); A.play('coin'); } else A.play('click');
    G.oi++;
    st.phase = 'cpu'; st.selDie = -1; st.mode = ''; st.atk = null; st.selProv = -1;
    advance();
  }

  // ---- 合戦の演出 ----
  function pushBattle(ev) {
    var G = st.G, mineA = ev.clan === G.player, mineD = ev.def === G.player, big = mineA || mineD;
    var f = geo.castle[ev.from], t = geo.castle[ev.to];
    var applied = false, thr = big ? 0.55 : 0.45, oldOwner = ev.def;
    var Pa = D.PROV[ev.clan], Pd = D.PROV[ev.def], name = D.PROV[ev.to].name;
    if (mineD) st.raids.push(ev);
    st.Q.push({
      slow: mineD, dur: mineD ? 2.6 : big ? 2.0 : 0.55,
      start: function () { A.play(big ? 'march' : 'far'); },
      update: function (u) {
        st.battle = { ev: ev, u: u, big: big, arrow: [f, t, Math.min(1, u / (big ? 0.22 : 0.4))], col: Pa.color, thr: thr, applied: applied };
        if (!applied && u >= thr) {
          applied = true;
          applyPatch(ev, true);
          if (ev.win) {
            st.battle.applied = true;
            if (big) A.play(mineA ? (ev.fell ? 'bigwin' : 'win') : 'lose');
            sparks(t.x, t.y, Pa.color, big ? 26 : 10);
            say((mineA ? '★ ' : mineD ? '▼ ' : '') + Pa.house + '、' + name + 'を奪う' + (mineD ? '' : '（' + Pd.house + '）'), mineA ? 'good' : mineD ? 'bad' : '');
            if (mineA) { floatAt(t.x, t.y - 44, '金 +' + ev.loot, GOLD); if (ev.fell) say('　' + Pd.house + '家の蓄えも手に入れた（金 +' + ev.loot + '）', 'good'); }
            if (mineD && ev.retreatN > 0) say('　敗れた兵 ' + ev.retreatN + ' が ' + D.PROV[ev.retreatTo].name + ' へ退いた', '');
          } else {
            if (big) A.play(mineA ? 'lose' : 'held'); else A.play('clash');
            if (big) say(mineA ? name + 'を攻めたが、退けられた' : '◎ ' + Pa.house + 'の攻めを' + name + 'で退けた', mineA ? 'bad' : 'good');
            shake(ev.to);
          }
        }
        if (applied && ev.win) GX.wipe(ev.to, oldOwner, ev.clan, f.x, f.y, Math.min(1, (u - thr) / (big ? 0.3 : 0.5)));
      },
      end: function () { st.battle = null; repaint(); }
    });
    if (ev.fell) {
      st.Q.push({ dur: mineD ? 1.6 : 1.0, start: function () { A.play('fall'); st.banner = { text: Pd.house + '家　滅亡', sub: Pa.lord + 'に敗れる', u: 0, dark: true }; say('✕ ' + Pd.house + '家、滅亡', 'bad'); },
        update: function (u) { st.banner.u = u; }, end: function () { st.banner = null; } });
    }
  }
  function say(text, kind) { st.ticker.unshift({ text: text, kind: kind || '', t: 0 }); if (st.ticker.length > 5) st.ticker.pop(); }
  function floatAt(x, y, text, col) { st.fx.push({ k: 'float', x: x, y: y, text: text, col: col, t: 0, dur: 1.5 }); }
  function glow(p, rgb) { st.fx.push({ k: 'glow', p: p, rgb: rgb, t: 0, dur: 0.7 }); }
  function shake(p) { st.fx.push({ k: 'shake', p: p, t: 0, dur: 0.4 }); }
  function sparks(x, y, col, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28, s = 40 + Math.random() * 120;
      st.fx.push({ k: 'spark', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, col: i % 3 ? col : '#ffe9a0', t: 0, dur: 0.5 + Math.random() * 0.5 });
    }
  }

  // ================= 描画 =================
  function text(s, x, y, size, col, align, font, weight) {
    c.font = (weight || 600) + ' ' + size + 'px ' + (font || FONT);
    c.fillStyle = col || INK; c.textAlign = align || 'left';
    c.fillText(s, x, y);
  }
  function btn(id, x, y, w, h, label, o) {
    o = o || {};
    var hot = !o.off && st.mouse.x >= x && st.mouse.x < x + w && st.mouse.y >= y && st.mouse.y < y + h;
    buttons.push({ id: id, x: x, y: y, w: w, h: h, on: o.off ? null : o.on, label: label, off: !!o.off });
    c.save();
    if (o.off) c.globalAlpha = 0.42;
    c.fillStyle = 'rgba(0,0,0,0.25)'; GX.rr(c, x + 1, y + 3, w, h, 8); c.fill();
    var base = o.col || '#5a4a38';
    var g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, hot ? lighten(base, 40) : lighten(base, 18)); g.addColorStop(1, base);
    c.fillStyle = g; GX.rr(c, x, y + (hot ? -1 : 0), w, h, 8); c.fill();
    c.strokeStyle = o.ring || 'rgba(255,240,200,0.55)'; c.lineWidth = o.ring ? 2.5 : 1.2; c.stroke();
    var fs = o.size || 18, ty = y + h / 2 + fs * 0.36 + (hot ? -1 : 0);
    if (o.sub) {
      text(label, x + w / 2, y + h / 2 - 1, fs, '#fff8e6', 'center', FONT, 700);
      text(o.sub, x + w / 2, y + h / 2 + fs * 0.85, o.subSize || 12, 'rgba(255,245,220,0.88)', 'center', GOTH, 500);
    } else text(label, x + w / 2, ty, fs, '#fff8e6', 'center', FONT, 700);
    c.restore();
  }
  function lighten(col, d) { var r = GX.hex(col); return 'rgb(' + Math.min(255, r[0] + d) + ',' + Math.min(255, r[1] + d) + ',' + Math.min(255, r[2] + d) + ')'; }

  function drawMap(dim) {
    var G = st.G, V = st.V, i;
    c.drawImage(GX.map(), 0, 0, PX, CH);
    c.drawImage(GX.deco(), 0, 0, PX, CH);
    GX.cloud(c, -30, -8, 190, 46, 0.85); GX.cloud(c, 40, 28, 120, 30, 0.7);
    GX.cloud(c, 560, 668, 170, 44, 0.85); GX.cloud(c, 500, 642, 110, 28, 0.6);
    seasonParticles();
    if (!V) return;
    var pulse = 0.5 + 0.5 * Math.sin(st.time * 5);
    // 強調
    if (st.screen === 'play' && st.phase === 'act' && G) {
      if (st.mode === 'target' && st.selProv >= 0) {
        D.ADJ[st.selProv].forEach(function (q) {
          var own = V[q].owner === G.player;
          if (!own && (G.prov[q].truce || G.turn < E.R.PEACE)) return;
          hi(q, own ? [80, 150, 255] : [255, 70, 50], 0.22 + 0.2 * pulse);
        });
      } else if (st.mode === 'attack' || st.mode === 'move') {
        hi(st.atk.to, st.mode === 'move' ? [80, 150, 255] : [255, 70, 50], 0.3 + 0.2 * pulse);
      } else if (st.selDie >= 0 && st.selProv < 0) {
        for (i = 0; i < 20; i++) if (V[i].owner === G.player) hi(i, [255, 245, 190], 0.12 + 0.14 * pulse);
      }
      if (st.selProv >= 0) hi(st.selProv, [255, 240, 170], 0.25 + 0.12 * pulse);
    }
    if (st.screen === 'select') hi(st.pick, [255, 245, 190], 0.3 + 0.2 * pulse);
    if (st.hover >= 0 && !st.Q.length) hi(st.hover, [255, 255, 255], 0.16);
    st.fx.forEach(function (f) { if (f.k === 'glow') hi(f.p, f.rgb, 0.7 * (1 - f.t / f.dur)); });
    // 札
    for (i = 0; i < 20; i++) plaque(i);
    // 勝率の札
    if (st.screen === 'play' && st.phase === 'act' && st.mode === 'target' && st.selDie >= 0) {
      D.ADJ[st.selProv].forEach(function (q) {
        if (V[q].owner === G.player || !E.canAttack(G, st.selProv, q) || G.turn < E.R.PEACE) return;
        var pw = E.winProb(G, q, G.prov[st.selProv].troops - 1, G.dice[st.selDie].v), cs = geo.castle[q];
        badge(cs.x, cs.y - 34, '勝ち目 ' + Math.round(pw * 100) + '%', pw >= 0.83 ? '#2f7f4f' : pw >= 0.5 ? '#b8891e' : '#8a3a30');
      });
    }
    if (st.battle && st.battle.arrow) arrow(st.battle.arrow[0], st.battle.arrow[1], st.battle.arrow[2], st.battle.col);
    st.fx.forEach(function (f) {
      var u = f.t / f.dur;
      if (f.k === 'float') {
        c.globalAlpha = u < 0.75 ? 1 : (1 - u) * 4;
        c.font = '700 20px ' + FONT; c.textAlign = 'center';
        c.lineWidth = 4; c.strokeStyle = 'rgba(255,250,235,0.95)'; c.strokeText(f.text, f.x, f.y - u * 26);
        c.fillStyle = f.col; c.fillText(f.text, f.x, f.y - u * 26);
        c.globalAlpha = 1;
      } else if (f.k === 'spark') {
        c.globalAlpha = 1 - u; c.fillStyle = f.col;
        c.fillRect(f.x + f.vx * f.t - 2, f.y + f.vy * f.t + 120 * f.t * f.t - 2, 4, 4);
        c.globalAlpha = 1;
      }
    });
    if (dim) { c.fillStyle = 'rgba(20,14,8,' + dim + ')'; c.fillRect(0, 0, PX, CH); }
  }
  function hi(i, rgb, a) {
    var mk = GX.mask(i, [rgb[0], rgb[1], rgb[2], 255]);
    c.globalAlpha = Math.max(0, Math.min(1, a)); c.drawImage(mk.c, mk.x, mk.y, mk.w, mk.h); c.globalAlpha = 1;
  }
  function badge(x, y, s, col) {
    c.font = '700 13px ' + GOTH; var w = c.measureText(s).width + 14;
    c.fillStyle = col; GX.rr(c, x - w / 2, y - 11, w, 20, 6); c.fill();
    c.strokeStyle = '#fff5d8'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(s, x, y + 4);
  }
  function plaque(i) {
    var V = st.V[i], cs = geo.castle[i], G = st.G, mine = G && st.screen !== 'select' && V.owner === G.player;
    var x = cs.x, y = cs.y, sx = 0;
    st.fx.forEach(function (f) { if (f.k === 'shake' && f.p === i) sx = Math.sin(f.t * 60) * 4 * (1 - f.t / f.dur); });
    x += sx;
    var w = 60, h = 38, l = x - w / 2, t = y - h / 2;
    c.fillStyle = 'rgba(0,0,0,0.3)'; GX.rr(c, l + 1, t + 3, w, h, 6); c.fill();
    c.fillStyle = mine ? '#fff7e0' : 'rgba(246,238,220,0.94)'; GX.rr(c, l, t, w, h, 6); c.fill();
    c.strokeStyle = mine ? '#d9a520' : 'rgba(50,36,22,0.8)'; c.lineWidth = mine ? 2.6 : 1.2; c.stroke();
    GX.flag(c, l + 5, t + 4, 18, V.owner, mine);
    c.font = '800 20px ' + GOTH; c.textAlign = 'right'; c.fillStyle = INK;
    c.fillText(V.troops, l + w - 6, t + 20);
    c.font = '600 9px ' + GOTH; c.fillStyle = '#6b5a48'; c.textAlign = 'left'; c.fillText('兵', l + 23, t + 20);
    // 城と経済
    c.font = '700 12px ' + GOTH; c.textAlign = 'left';
    c.fillStyle = '#4a4038'; c.fillText('城' + V.cas, l + 5, t + 34);
    c.fillStyle = '#7a5a08'; c.fillText('経' + V.eco, l + 33, t + 34);
    // 国名
    c.font = '700 12px ' + FONT; c.textAlign = 'center';
    c.lineWidth = 3; c.strokeStyle = 'rgba(250,244,228,0.85)'; c.strokeText(D.PROV[i].name, x, t - 4);
    c.fillStyle = '#2a2018'; c.fillText(D.PROV[i].name, x, t - 4);
    if (V.guard > 0) {
      c.fillStyle = '#b8362c'; c.beginPath(); c.moveTo(l + w - 3, t - 9); c.lineTo(l + w + 11, t - 9); c.lineTo(l + w + 11, t + 3); c.lineTo(l + w + 4, t + 10); c.lineTo(l + w - 3, t + 3); c.closePath(); c.fill();
      c.strokeStyle = '#fff2c8'; c.lineWidth = 1.2; c.stroke();
      c.font = '800 11px ' + GOTH; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(V.guard, l + w + 4, t + 3);
    }
    if (V.truce) {
      c.fillStyle = '#2f7f6c'; GX.rr(c, l - 6, t - 22, 30, 15, 4); c.fill();
      c.font = '700 10px ' + GOTH; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText('平定', l + 9, t - 11);
    }
  }
  function arrow(a, b, u, col) {
    var x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u, ang = Math.atan2(b.y - a.y, b.x - a.x);
    c.save(); c.lineCap = 'round';
    c.strokeStyle = 'rgba(20,10,5,0.75)'; c.lineWidth = 11; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(x, y); c.stroke();
    c.strokeStyle = col; c.lineWidth = 7; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(x, y); c.stroke();
    c.translate(x, y); c.rotate(ang);
    c.fillStyle = col; c.strokeStyle = 'rgba(20,10,5,0.8)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(14, 0); c.lineTo(-6, -11); c.lineTo(-6, 11); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }
  var parts = [];
  function seasonParticles() {
    var G = st.G; if (!G || st.screen === 'select' || st.screen === 'title') return;
    var s = G.turn % 4;
    if (!parts.length) for (var i = 0; i < 26; i++) parts.push({ x: Math.random() * PX, y: Math.random() * CH, p: Math.random() * 6.28, s: 0.6 + Math.random() * 0.8 });
    parts.forEach(function (p) {
      var x = (p.x + st.time * 14 * p.s + Math.sin(st.time * 1.3 + p.p) * 12) % PX, y = (p.y + st.time * (s === 3 ? 6 : 22) * p.s) % CH;
      c.save(); c.translate(x, y); c.rotate(st.time * p.s + p.p);
      if (s === 0) { c.fillStyle = p.p > 3 ? 'rgba(214,92,40,0.75)' : 'rgba(226,160,40,0.75)'; c.beginPath(); c.ellipse(0, 0, 5, 2.6, 0, 0, 6.3); c.fill(); }
      else if (s === 1) { c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(0, 0, 1.6 + p.s, 0, 6.3); c.fill(); }
      else if (s === 2) { c.fillStyle = 'rgba(255,196,214,0.85)'; c.beginPath(); c.ellipse(0, 0, 4, 2.4, 0, 0, 6.3); c.fill(); }
      else { c.fillStyle = 'rgba(210,255,170,' + (0.35 + 0.35 * Math.sin(st.time * 3 + p.p)) + ')'; c.beginPath(); c.arc(0, 0, 2, 0, 6.3); c.fill(); }
      c.restore();
    });
  }

  function panelBase() {
    c.fillStyle = GX.paper(c); c.fillRect(PX, 0, PW, CH);
    var g = c.createLinearGradient(PX, 0, PX + 26, 0); g.addColorStop(0, 'rgba(40,26,12,0.5)'); g.addColorStop(1, 'rgba(40,26,12,0)');
    c.fillStyle = g; c.fillRect(PX, 0, 26, CH);
    c.fillStyle = '#3a2a1c'; c.fillRect(PX - 2, 0, 4, CH);
    c.fillStyle = '#c9a24a'; c.fillRect(PX - 1, 0, 1.5, CH);
  }
  function smallBtns() {
    btn('help', CW - 132, 12, 36, 32, '？', { on: function () { st.help = true; A.play('click'); }, size: 17 });
    btn('snd', CW - 90, 12, 36, 32, A.isOn() ? '♪' : '×', { on: function () { A.setOn(!A.isOn()); opt.sound = A.isOn(); store(OPT, opt); }, size: 17 });
    if (st.screen === 'play') btn('menu', CW - 48, 12, 36, 32, '≡', { on: function () { st.menu = true; A.play('click'); }, size: 17 });
  }
  function divider(y) { c.strokeStyle = 'rgba(70,50,30,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(PX + 22, y); c.lineTo(CW - 18, y); c.stroke(); }
  function stat(label, v, max, x, y, col) {
    text(label, x, y, 14, '#5a4a3a', 'left', GOTH, 600);
    for (var i = 0; i < max; i++) {
      c.fillStyle = i < v ? col : 'rgba(90,70,50,0.18)';
      GX.rr(c, x + 52 + i * 19, y - 12, 15, 13, 3); c.fill();
    }
    text(String(v), x + 52 + max * 19 + 6, y, 15, INK, 'left', GOTH, 700);
  }

  // ---- 本編のパネル ----
  function drawPlayPanel() {
    var G = st.G, pl = G.player, P = D.PROV[pl], d = E.dateOf(G.turn), x0 = PX + 24;
    panelBase();
    // 日付
    text(d.year + '年', x0, 42, 30, INK, 'left', FONT, 700);
    var sc = ['#b65a1e', '#5a7896', '#c0607c', '#3f7f4a'][G.turn % 4];
    c.fillStyle = sc; c.beginPath(); c.arc(x0 + 128, 31, 19, 0, 6.3); c.fill();
    text(d.season, x0 + 128, 40, 24, '#fff', 'center', FONT, 700);
    text('永禄' + kan(d.eiroku) + '年', x0 + 156, 30, 13, '#6b5a48', 'left', FONT, 600);
    text('あと ' + (E.R.TURNS - G.turn) + ' 季', x0 + 156, 48, 15, RED, 'left', GOTH, 700);
    for (var i = 0; i < E.R.TURNS; i++) {
      c.fillStyle = i < G.turn ? 'rgba(70,50,30,0.25)' : i === G.turn ? RED : ['#d9a066', '#9fb4c8', '#e3a6b8', '#93bf8f'][i % 4];
      c.fillRect(x0 + i * 13, 60, 11, i === G.turn ? 9 : 6);
    }
    smallBtns();
    divider(78);
    // 自分の家
    var pw = E.power(G, pl), ip = E.incomeParts(G, pl), rank = E.rankOf(G, pl);
    GX.flag(c, x0 + 2, 88, 40, pl, true);
    text(P.lord, x0 + 46, 112, 24, INK, 'left', FONT, 700);
    text('天下 ' + rank + ' 位', x0 + 46, 132, 14, rank === 1 ? RED : '#5a4a3a', 'left', GOTH, 700);
    chip(x0 + 220, 92, '国', pw.n, '#3a2a1c');
    chip(x0 + 310, 92, '金', pw.gold, GOLD, '+' + ip.gross + '/季' + (ip.harvest ? '' : ''));
    chip(x0 + 430, 92, '賽', E.diceCount(Math.max(1, pw.n)), '#5a4a38', nextDice(pw.n));
    divider(146);
    // 形勢
    text('天下の形勢', x0, 166, 13, '#6b5a48', 'left', GOTH, 700);
    var rk = E.ranking(G), rows = rk.slice(0, 5);
    if (rank > 5) rows[4] = rk[rank - 1];
    rows.forEach(function (r, k) {
      var y = 178 + k * 19, me = r.clan === pl;
      if (me) { c.fillStyle = 'rgba(217,165,32,0.22)'; c.fillRect(x0 - 4, y - 2, PW - 40, 18); }
      text((rk.indexOf(r) + 1) + '', x0 + 8, y + 12, 12, '#6b5a48', 'center', GOTH, 700);
      c.fillStyle = D.PROV[r.clan].color; c.fillRect(x0 + 20, y + 2, 12, 12); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1; c.strokeRect(x0 + 20, y + 2, 12, 12);
      text(D.PROV[r.clan].house, x0 + 38, y + 13, 13, INK, 'left', GOTH, me ? 800 : 600);
      c.fillStyle = 'rgba(90,70,50,0.15)'; c.fillRect(x0 + 120, y + 4, 300, 9);
      c.fillStyle = D.PROV[r.clan].color; c.fillRect(x0 + 120, y + 4, 300 * r.n / 20, 9);
      text(r.n + '国', x0 + 430, y + 13, 13, INK, 'left', GOTH, 700);
      text('兵' + r.troops, x0 + 480, y + 13, 12, '#6b5a48', 'left', GOTH, 600);
    });
    divider(278);
    contextArea(x0, 290);
    diceArea(x0);
  }
  function nextDice(n) {
    if (E.diceCount(n) >= E.R.MAXDICE) return '最大';
    var need = n; while (E.diceCount(need) === E.diceCount(n)) need++;
    return need + '国で+1';
  }
  function chip(x, y, label, v, col, sub) {
    c.fillStyle = col; c.beginPath(); c.arc(x + 14, y + 16, 14, 0, 6.3); c.fill();
    text(label, x + 14, y + 22, 15, '#fff', 'center', FONT, 700);
    text(String(v), x + 34, y + 24, 24, INK, 'left', GOTH, 800);
    if (sub) text(sub, x + 34, y + 42, 12, '#6b5a48', 'left', GOTH, 600);
  }

  function provCard(p, x, y) {
    var G = st.G, V = G.prov[p], P = D.PROV[p], own = D.PROV[V.owner];
    GX.flag(c, x + 2, y, 30, V.owner, V.owner === G.player);
    text(P.name, x + 36, y + 20, 22, INK, 'left', FONT, 700);
    text(own.lord + (V.owner === G.player ? '（自国）' : ''), x + 36 + c.measureText(P.name).width + 12, y + 20, 14, '#5a4a3a', 'left', GOTH, 600);
    var base = E.defBase(V);
    text('兵 ' + V.troops + (V.owner === G.player ? ' / ' + E.cap(V) : ''), x + 36, y + 42, 15, INK, 'left', GOTH, 700);
    text('城 ' + V.cas, x + 150, y + 42, 15, '#4a4038', 'left', GOTH, 700);
    text('経済 ' + V.eco, x + 210, y + 42, 15, '#8a6a10', 'left', GOTH, 700);
    text('守りの強さ ' + base + ' ＋賽', x + 290, y + 42, 14, RED, 'left', GOTH, 700);
    text('（兵' + V.troops + '＋城' + V.cas + '×2' + (V.guard ? '＋備え' + V.guard : '') + '）', x + 290, y + 58, 11, '#6b5a48', 'left', GOTH, 500);
  }
  function contextArea(x0, y0) {
    var G = st.G, pl = G.player, w = PW - 48;
    if (st.phase === 'roll') {
      var ip = E.incomeParts(G, pl), n = E.diceCount(E.countOf(G, pl));
      text('あなたの番', x0, y0 + 26, 22, INK, 'left', FONT, 700);
      text('収入 金' + ip.net + (ip.harvest ? '（秋は年貢が2倍）' : '') + '　／　サイコロ ' + n + ' 個', x0, y0 + 54, 15, '#5a4a3a', 'left', GOTH, 600);
      if (G.turn < E.R.PEACE) text('最初の季節は様子見。出陣はできないので、国を整えよう。', x0, y0 + 80, 14, RED, 'left', GOTH, 700);
      btn('roll', x0 + 90, y0 + 110, w - 180, 76, '賽を振る', { on: doRoll, col: '#9c2f26', size: 30, ring: pulseRing() });
      text('スペースキーでも振れます', x0 + w / 2, y0 + 202, 12, '#6b5a48', 'center', GOTH, 500);
      st.raids.slice(-2).forEach(function (ev, k) {
        var s1 = D.PROV[ev.clan].house + ' が ' + D.PROV[ev.to].name + ' を攻めた：攻め ' + ev.atk + '（兵' + ev.sent + '＋賽' + ev.V + '）対 守り ' + ev.dfs + '（兵' + ev.defTroops + '＋城' + ev.cas * 2 + (ev.guard ? '＋備' + ev.guard : '') + '＋賽' + ev.roll + '）→ ' + (ev.win ? '奪われた' : '守り切った');
        text(s1, x0, y0 + 222 + k * 17, 12, ev.win ? RED : '#2f6f4f', 'left', GOTH, 700);
      });
      return;
    }
    if (st.phase === 'cpu' || st.phase === 'rolling' && false) {
      text('諸国が動いている…', x0, y0 + 26, 20, INK, 'left', FONT, 700);
      st.ticker.slice(0, 5).forEach(function (t, k) {
        text(t.text, x0, y0 + 58 + k * 24, 15, t.kind === 'good' ? '#2f6f4f' : t.kind === 'bad' ? RED : '#4a3c2e', 'left', GOTH, 600);
      });
      btn('fast', x0 + w - 150, y0 + 190, 150, 38, st.fast ? '早送り中 ▶▶' : '早送り ▶▶', { on: function () { st.fast = !st.fast; }, size: 15 });
      return;
    }
    if (st.phase !== 'act' && st.phase !== 'rolling') return;
    var di = st.selDie, d = di >= 0 ? G.dice[di] : null;
    if (st.mode === 'attack' || st.mode === 'move') return attackCard(x0, y0, w);
    var p = st.selProv >= 0 ? st.selProv : st.hover;
    if (p < 0) {
      text(freeCount() ? 'サイコロを選んで、国をクリック' : '采配はすべて終わった', x0, y0 + 26, 20, INK, 'left', FONT, 700);
      legend(x0, y0 + 44, w);
      if (G.turn < E.R.PEACE && freeCount()) text('はじめの一手：裏の大きい賽で徴兵、表の大きい賽で備え。', x0, y0 + 214, 14, RED, 'left', GOTH, 700);
      else if (G.turn === E.R.PEACE && freeCount()) text('出陣できるようになった。賽を選び、隣の敵国をクリックすると勝ち目が分かる。', x0, y0 + 214, 13.5, RED, 'left', GOTH, 700);
      return;
    }
    provCard(p, x0, y0);
    var mine = G.prov[p].owner === pl, sel = st.selProv === p;
    if (!sel) { text(mine ? 'クリックで采配する' : 'クリックで選ぶ', x0, y0 + 88, 14, '#6b5a48', 'left', GOTH, 600); return; }
    if (st.mode === 'target') {
      text('出陣先をクリック', x0, y0 + 92, 19, RED, 'left', FONT, 700);
      text('赤＝敵の国へ攻めこむ　青＝味方の国へ兵を移す', x0, y0 + 116, 14, '#5a4a3a', 'left', GOTH, 600);
      btn('cancel', x0, y0 + 136, 120, 38, 'やめる', { on: function () { st.mode = ''; A.play('click'); }, size: 16 });
      return;
    }
    if (!mine) {
      var info = attackInfo(p);
      text(info, x0, y0 + 88, 14, '#5a4a3a', 'left', GOTH, 600);
      return;
    }
    if (!d || d.used) { text(freeCount() ? '下のサイコロを選ぼう' : '使えるサイコロがない', x0, y0 + 92, 16, '#6b5a48', 'left', GOTH, 600); return; }
    // 采配ボタン
    var V = G.prov[p], v = d.v, u = 7 - v, bw = (w - 16) / 3, by = y0 + 72, gold = G.clan[pl].gold;
    text('表 ' + v + ' の采配', x0, by + 4, 13, RED, 'left', GOTH, 800);
    var canGo = V.troops >= 2 && G.turn >= E.R.PEACE;
    btn('a_attack', x0, by + 10, bw, 58, '出陣', { on: startTarget, off: !canGo, col: '#9c2f26', size: 20,
      sub: G.turn < E.R.PEACE ? '最初の季節は不可' : V.troops < 2 ? '兵が足りない' : '攻め＝兵＋' + v + '（移動も）' });
    btn('a_guard', x0 + bw + 8, by + 10, bw, 58, '備え', { on: function () { act('guard'); }, off: !E.canGuard(G, di, p), col: '#9c2f26', size: 20,
      sub: E.canGuard(G, di, p) ? '次の番まで守り +' + v : 'すでに備え ' + V.guard });
    text('裏 ' + u + ' の采配', x0, by + 88, 13, BLUE, 'left', GOTH, 800);
    var dc = E.buildCost(V.eco), fc = E.fortCost(V.cas), rn = E.recruitN(G, di, p);
    btn('a_develop', x0, by + 94, bw, 58, '開発', { on: function () { act('develop'); }, off: !E.canDevelop(G, di, p), col: '#2c4a78', size: 20,
      sub: V.eco >= E.R.MAXLV ? '経済は最大' : u < V.eco ? '裏 ' + V.eco + ' 以上が必要' : gold < dc ? '金 ' + dc + ' が必要' : '経済 ' + V.eco + '→' + (V.eco + 1) + '（金' + dc + '）' });
    btn('a_fortify', x0 + bw + 8, by + 94, bw, 58, '築城', { on: function () { act('fortify'); }, off: !E.canFortify(G, di, p), col: '#2c4a78', size: 20,
      sub: V.cas >= E.R.MAXLV ? '城は最大' : u < V.cas ? '裏 ' + V.cas + ' 以上が必要' : gold < fc ? '金 ' + fc + ' が必要' : '城 ' + V.cas + '→' + (V.cas + 1) + '（金' + fc + '）' });
    btn('a_recruit', x0 + (bw + 8) * 2, by + 94, bw, 58, '徴兵', { on: function () { act('recruit'); }, off: rn <= 0, col: '#2c4a78', size: 20,
      sub: rn > 0 ? '兵 +' + rn + '（金' + rn * E.R.TROOP + '）' : V.troops >= E.cap(V) ? '兵は上限（6＋経済）' : '金 ' + E.R.TROOP + ' が必要' });
  }
  function pulseRing() { return 'rgba(255,230,150,' + (0.5 + 0.5 * Math.sin(st.time * 5)) + ')'; }
  function legend(x, y, w) {
    var rows = [[RED, '表の目', '大きいほど強い', '出陣（攻める・兵を移す）／備え（守りを固める）'], [BLUE, '裏の目', '7 − 表の目', '開発（経済）／築城（城）／徴兵（兵）']];
    rows.forEach(function (r, k) {
      var yy = y + k * 62;
      c.fillStyle = r[0]; GX.rr(c, x, yy + 6, 78, 44, 8); c.fill();
      text(r[1], x + 39, yy + 34, 18, '#fff', 'center', FONT, 700);
      text(r[2], x + 92, yy + 24, 15, r[0], 'left', GOTH, 800);
      text(r[3], x + 92, yy + 46, 14, '#4a3c2e', 'left', GOTH, 600);
    });
    text('攻めの強さ（兵＋賽）が 守りの強さ（兵＋城×2＋備え＋賽）を上回れば、国を奪える。', x, y + 146, 12.5, '#5a4a3a', 'left', GOTH, 600);
  }
  function attackInfo(p) {
    var G = st.G, pl = G.player, V = G.prov[p];
    if (V.truce) return '平定中：持ち主の次の番まで攻められない。';
    var best = -1;
    D.ADJ[p].forEach(function (q) { if (G.prov[q].owner === pl && (best < 0 || G.prov[q].troops > G.prov[best].troops)) best = q; });
    if (best < 0) return 'ここへは、まだ道がつながっていない。';
    var base = E.defBase(V), have = G.prov[best].troops - 1;
    return D.PROV[best].name + 'から攻められる（兵' + have + '）。賽の合計 ' + Math.max(1, base + 7 - have) + ' 以上なら確実、' + Math.max(1, base + 2 - have) + ' で勝ち目が出る。';
  }
  function attackCard(x0, y0, w) {
    var G = st.G, a = st.atk, mv = st.mode === 'move', di = st.selDie, d = G.dice[di];
    var F = D.PROV[a.from], T = D.PROV[a.to], Vt = G.prov[a.to];
    text(F.name + ' → ' + T.name, x0, y0 + 24, 22, INK, 'left', FONT, 700);
    text(mv ? '兵を移す' : D.PROV[Vt.owner].lord + ' を攻める', x0 + c.measureText(F.name + ' → ' + T.name).width + 14, y0 + 24, 15, mv ? BLUE : RED, 'left', GOTH, 700);
    // 兵数
    text('送る兵', x0, y0 + 62, 14, '#5a4a3a', 'left', GOTH, 700);
    btn('n-', x0 + 60, y0 + 40, 36, 34, '−', { on: function () { a.n = Math.max(1, a.n - 1); A.play('click'); }, size: 20 });
    text(String(a.n), x0 + 124, y0 + 66, 26, INK, 'center', GOTH, 800);
    btn('n+', x0 + 152, y0 + 40, 36, 34, '＋', { on: function () { a.n = Math.min(a.max, a.n + 1); A.play('click'); }, size: 18 });
    var stay = G.prov[a.from].troops - a.n, foe = 0;
    D.ADJ[a.from].forEach(function (q) { if (q !== a.to && G.prov[q].owner !== G.player && G.prov[q].troops > foe) foe = G.prov[q].troops; });
    var thin = !mv && foe > 0 && stay + G.prov[a.from].cas * 2 + 3 < foe + 6;
    text('残す兵 ' + stay, x0 + 200, y0 + 56, 13, thin ? RED : '#6b5a48', 'left', GOTH, 700);
    if (thin) text('留守が手薄（隣に兵' + foe + '）', x0 + 200, y0 + 72, 11, RED, 'left', GOTH, 700);
    if (mv) {
      btn('go', x0, y0 + 150, w - 140, 54, '兵を移す', { on: commitAttack, col: '#2c4a78', size: 22, ring: pulseRing() });
      btn('cancel', x0 + w - 130, y0 + 150, 130, 54, 'やめる', { on: function () { st.mode = ''; st.atk = null; A.play('click'); }, size: 16 });
      return;
    }
    // 重ねる賽
    text('賽を重ねる', x0 + 352, y0 + 52, 13, '#5a4a3a', 'left', GOTH, 700);
    text('押して1個', x0 + 352, y0 + 68, 11, '#6b5a48', 'left', GOTH, 600);
    var k = 0;
    G.dice.forEach(function (dd, i) {
      if (dd.used || i === di) return;
      var bx = x0 + 446 + k * 40, on = a.d2 === i;
      if (k > 2) return;
      buttons.push({ id: 'stack' + i, x: bx - 19, y: y0 + 36, w: 38, h: 42, on: function () { a.d2 = on ? -1 : i; A.play('pick'); } });
      c.fillStyle = on ? 'rgba(217,165,32,0.95)' : 'rgba(90,70,50,0.16)'; GX.rr(c, bx - 19, y0 + 36, 38, 42, 7); c.fill();
      GX.die(c, bx, y0 + 57, 30, dd.v, 'omote');
      k++;
    });
    if (!k) text('（なし）', x0 + 446, y0 + 62, 12, '#8a7a68', 'left', GOTH, 500);
    // 見込み
    var V = atkValue(), atk = a.n + V, base = E.defBase(Vt), pw = E.winProb(G, a.to, a.n, V);
    var pair = a.d2 >= 0 && G.dice[a.d2].v === d.v;
    var ly = y0 + 104;
    c.fillStyle = 'rgba(184,54,44,0.1)'; GX.rr(c, x0, ly - 18, w / 2 - 6, 50, 8); c.fill();
    c.fillStyle = 'rgba(60,60,70,0.1)'; GX.rr(c, x0 + w / 2 + 6, ly - 18, w / 2 - 6, 50, 8); c.fill();
    text('攻め', x0 + 10, ly, 13, RED, 'left', GOTH, 800);
    text('兵' + a.n + ' ＋ 賽' + V + (pair ? '（ゾロ目+3）' : ''), x0 + 10, ly + 22, 14, INK, 'left', GOTH, 700);
    text(String(atk), x0 + w / 2 - 18, ly + 18, 30, RED, 'right', GOTH, 800);
    text('守り', x0 + w / 2 + 16, ly, 13, '#4a4a55', 'left', GOTH, 800);
    text('兵' + Vt.troops + '＋城' + Vt.cas * 2 + (Vt.guard ? '＋備' + Vt.guard : '') + '＋賽', x0 + w / 2 + 16, ly + 22, 14, INK, 'left', GOTH, 700);
    text((base + 1) + '〜' + (base + 6), x0 + w - 10, ly + 18, 26, '#4a4a55', 'right', GOTH, 800);
    var col = pw >= 0.83 ? '#2f7f4f' : pw >= 0.5 ? GOLD : RED;
    text('勝ち目', x0, y0 + 166, 14, '#5a4a3a', 'left', GOTH, 700);
    text(Math.round(pw * 100) + '%', x0 + 56, y0 + 172, 32, col, 'left', GOTH, 800);
    text(pw >= 1 ? '必ず勝てる' : pw <= 0 ? '勝ち目なし' : '守りの賽が ' + Math.round(pw * 6) + ' 以下なら勝ち', x0 + 150, y0 + 166, 13, '#5a4a3a', 'left', GOTH, 600);
    btn('go', x0, y0 + 182, w - 140, 50, 'かかれ！', { on: commitAttack, col: '#9c2f26', size: 24, ring: pulseRing() });
    btn('cancel', x0 + w - 130, y0 + 182, 130, 50, 'やめる', { on: function () { st.mode = ''; st.atk = null; A.play('click'); }, size: 16 });
  }

  function diceArea(x0) {
    var G = st.G, w = PW - 48, y = 548;
    divider(y - 14);
    if (st.phase !== 'act' && st.phase !== 'rolling') return;
    var n = G.dice.length, sz = n > 8 ? 46 : n > 6 ? 50 : 62, gap = n > 8 ? 10 : n > 6 ? 12 : 16, tot = n * sz + (n - 1) * gap, sx = x0 + (w - tot) / 2 + sz / 2;
    var ra = st.rollAnim;
    G.dice.forEach(function (d, i) {
      var cx = sx + i * (sz + gap), cy = y + 40, sel = st.selDie === i && st.phase === 'act', v = d.v, rot = 0, oy = 0;
      if (ra && !(ra.re && d.used)) {
        var land = (ra.dur - 0.25) * (i + 1) / n + 0.2;
        if (ra.t < land) { v = 1 + Math.floor(Math.random() * 6); rot = (ra.t * 14 + i) % 6.28; oy = -Math.abs(Math.sin(ra.t * 16 + i)) * 16; }
        else if (!ra.done || ra.done <= i) { ra.done = i + 1; A.play('land', i); }
      }
      if (st.newDie && st.newDie.di === i && st.newDie.t < 0.4) { v = 1 + Math.floor(Math.random() * 6); rot = st.newDie.t * 20; oy = -Math.abs(Math.sin(st.newDie.t * 16)) * 16; }
      var fa = st.flipAnim && st.flipAnim.di === i ? st.flipAnim.t / 0.3 : 1;
      c.save();
      if (d.used) c.globalAlpha = 0.3;
      if (sel) { c.fillStyle = 'rgba(217,165,32,0.95)'; GX.rr(c, cx - sz / 2 - 6, cy - sz / 2 - 12, sz + 12, sz + 44, 10); c.fill(); oy -= 6; }
      c.save(); c.translate(cx, cy + oy); c.scale(Math.abs(Math.cos(Math.min(1, fa) * Math.PI)) * 0.92 + 0.08, 1);
      GX.die(c, 0, 0, sz, v, 'omote', rot); c.restore();
      if (!ra || ra.t >= ra.dur) {
        text('表' + v, cx - 3, cy + sz / 2 + 21, sz > 55 ? 14 : 12, sel ? '#7a1c14' : RED, 'right', GOTH, 800);
        text('裏' + (7 - v), cx + 3, cy + sz / 2 + 21, sz > 55 ? 14 : 12, sel ? '#1c2c48' : BLUE, 'left', GOTH, 800);
      }
      c.restore();
      if (d.used && st.dieUse[i]) { c.fillStyle = 'rgba(60,44,28,0.85)'; c.beginPath(); c.arc(cx, cy, 17, 0, 6.3); c.fill(); text(st.dieUse[i], cx, cy + 7, 19, '#fff3d6', 'center', FONT, 700); }
      if (!d.used && st.phase === 'act') buttons.push({ id: 'die' + i, x: cx - sz / 2 - 6, y: cy - sz / 2 - 12, w: sz + 12, h: sz + 44, on: function () { st.selDie = i; if (st.mode === 'attack' && st.atk.d2 === i) st.atk.d2 = -1; A.play('pick'); } });
    });
    if (st.phase !== 'act') return;
    var by = 664, fc = freeCount(), flipOk = st.selDie >= 0 && E.canFlip(G, st.selDie);
    btn('reroll', x0, by, 112, 44, '振り直し', { on: doReroll, off: G.rerolled || fc === 0, size: 16, sub: G.rerolled ? '（使った）' : '残りを1回', subSize: 11 });
    btn('flip', x0 + 120, by, 112, 44, '裏返す', { on: doFlip, off: !flipOk, size: 16, sub: '金' + E.flipCost(G) + 'で表↔裏', subSize: 11 });
    btn('buy', x0 + 240, by, 112, 44, '賽を買う', { on: doBuy, off: !E.canBuy(G), size: 16, sub: (G.bought || 0) >= E.R.BUYMAX ? '（1季に3個まで）' : '金' + E.buyCost(G) + 'で1個', subSize: 11 });
    var endLabel = '季節を進める';
    btn('end', x0 + 360, by, w - 360, 44, endLabel, { on: function () { if (fc > 0 && !st.confirmEnd && canDoSomething()) { st.confirmEnd = true; A.play('click'); } else endTurn(); },
      col: fc === 0 ? '#2f6a4a' : '#5a4a38', size: 16, ring: fc === 0 ? pulseRing() : null,
      sub: fc > 0 ? (st.confirmEnd ? 'もう一度で進む（金+' + fc + '）' : '余った賽は金1に') : '番を終える ▶', subSize: 11 });
  }
  function canDoSomething() { return !!AI.choose(st.G, st.G.player, { noReroll: true, noFlip: true }); }

  // ---- 合戦の札 ----
  function drawBattle() {
    var b = st.battle;
    if (!b || !b.big || !b.ev) return;
    var ev = b.ev, u = b.u, x = 70, w = 560, h = 150, y = (geo.castle[ev.to].y < 280 && geo.castle[ev.from].y < 330) ? 548 : 20;
    var appear = Math.min(1, u / 0.1);
    c.save(); c.globalAlpha = appear;
    c.fillStyle = 'rgba(0,0,0,0.35)'; GX.rr(c, x + 3, y + 5, w, h, 12); c.fill();
    c.fillStyle = GX.paper(c); GX.rr(c, x, y, w, h, 12); c.fill();
    c.strokeStyle = '#3a2a1c'; c.lineWidth = 3; c.stroke();
    var Pa = D.PROV[ev.clan], Pd = D.PROV[ev.def];
    GX.flag(c, x + 16, y + 14, 34, ev.clan, ev.clan === st.G.player);
    text(Pa.house, x + 52, y + 38, 20, INK, 'left', FONT, 700);
    text('攻め', x + 52, y + 56, 12, RED, 'left', GOTH, 800);
    GX.flag(c, x + w - 46, y + 14, 34, ev.def, ev.def === st.G.player);
    text(Pd.house, x + w - 54, y + 38, 20, INK, 'right', FONT, 700);
    text(D.PROV[ev.to].name + 'の守り', x + w - 54, y + 56, 12, '#4a4a55', 'right', GOTH, 800);
    // 攻め側
    text('兵' + ev.sent, x + 20, y + 100, 18, INK, 'left', GOTH, 800);
    ev.dice.forEach(function (v, i) { GX.die(c, x + 96 + i * 42, y + 92, 34, v, 'omote'); });
    if (ev.dice.length === 2 && ev.dice[0] === ev.dice[1]) text('ゾロ目+3', x + 180, y + 98, 13, RED, 'left', GOTH, 800);
    text(String(ev.atk), x + 232, y + 132, 40, RED, 'right', GOTH, 800);
    // 守り側
    var landed = u >= b.thr;
    text('兵' + ev.defTroops + '＋城' + ev.cas * 2 + (ev.guard ? '＋備' + ev.guard : ''), x + w - 20, y + 100, 16, INK, 'right', GOTH, 800);
    GX.die(c, x + w - 210, y + 92, 34, landed ? ev.roll : 1 + Math.floor(Math.random() * 6), 'omote', landed ? 0 : u * 40);
    text(landed ? String(ev.dfs) : '？', x + w - 232, y + 132, 40, '#4a4a55', 'left', GOTH, 800);
    text('対', x + w / 2, y + 126, 22, '#6b5a48', 'center', FONT, 700);
    if (landed) {
      var k = Math.min(1, (u - b.thr) / 0.12), mineA = ev.clan === st.G.player, good = mineA ? ev.win : !ev.win;
      var s = mineA ? (ev.win ? '国盗り！' : '敗退…') : (ev.win ? '奪われた…' : '守り切った！');
      c.save(); c.translate(x + w / 2, y + 40); c.rotate(-0.06); c.scale(2.2 - 1.2 * k, 2.2 - 1.2 * k); c.globalAlpha = k;
      c.font = '800 34px ' + FONT; c.textAlign = 'center'; c.lineWidth = 8; c.strokeStyle = '#fff8e6'; c.strokeText(s, 0, 12);
      c.fillStyle = good ? '#c4302b' : '#4a4a55'; c.fillText(s, 0, 12);
      c.restore();
    }
    c.restore();
  }
  function drawBanner() {
    var b = st.banner; if (!b) return;
    var a = b.u < 0.15 ? b.u / 0.15 : b.u > 0.8 ? (1 - b.u) / 0.2 : 1, y = 300;
    c.save(); c.globalAlpha = a;
    c.fillStyle = b.dark ? 'rgba(30,16,12,0.86)' : 'rgba(250,244,226,0.92)'; c.fillRect(0, y, PX, 96);
    c.fillStyle = '#c9a24a'; c.fillRect(0, y, PX, 3); c.fillRect(0, y + 93, PX, 3);
    text(b.text, PX / 2 - 30 + 60 * (1 - a), y + 58, 40, b.dark ? '#f3e2c0' : INK, 'center', FONT, 700);
    text(b.sub, PX / 2, y + 82, 15, b.dark ? '#c9a890' : '#6b5a48', 'center', FONT, 600);
    c.restore();
  }
  function drawTicker() {
    if (st.phase === 'cpu') return;
    var shown = st.ticker.filter(function (t) { return t.t < 7; }).slice(0, 3);
    shown.forEach(function (t, k) {
      var a = t.t > 6 ? 7 - t.t : 1, y = CH - 16 - k * 26;
      c.globalAlpha = a * 0.9; c.font = '600 14px ' + GOTH; var w = c.measureText(t.text).width + 20;
      c.fillStyle = 'rgba(30,20,12,0.78)'; GX.rr(c, 10, y - 17, w, 23, 6); c.fill();
      c.fillStyle = t.kind === 'good' ? '#bff0c8' : t.kind === 'bad' ? '#ffc4b8' : '#f3ead6'; c.textAlign = 'left'; c.fillText(t.text, 20, y);
      c.globalAlpha = 1;
    });
  }
  function drawTip() {
    var p = st.hover, G = st.G;
    if (p < 0 || st.Q.length || st.screen !== 'play') return;
    var V = G.prov[p], s = D.PROV[p].name + '（' + D.PROV[V.owner].house + '）　守り ' + E.defBase(V) + '＋賽' + (V.guard ? '（赤い札＝備え+' + V.guard + '）' : '') + (V.truce ? '　平定中' : '');
    c.font = '600 13px ' + GOTH; var w = c.measureText(s).width + 16, x = Math.min(PX - w - 6, Math.max(6, st.mouse.x + 14)), y = Math.max(24, st.mouse.y - 14);
    c.fillStyle = 'rgba(30,20,12,0.85)'; GX.rr(c, x, y - 17, w, 24, 6); c.fill();
    c.fillStyle = '#f6ecd6'; c.textAlign = 'left'; c.fillText(s, x + 8, y);
  }

  // ---- 題字 ----
  function drawTitle() {
    drawMap(0.42);
    panelBase();
    var x = PX + PW / 2;
    c.save(); c.translate(PX + 60, 96);
    GX.die(c, 0, 0, 56, 6, 'omote', -0.2); GX.die(c, 52, 22, 44, 1, 'ura', 0.25);
    c.restore();
    text('からり、', PX + 150, 104, 54, INK, 'left', FONT, 800);
    text('国盗り', PX + 196, 186, 86, RED, 'left', FONT, 800);
    text('賽の目 戦国絵巻', x, 236, 20, '#5a4a3a', 'center', FONT, 700);
    c.fillStyle = '#c9a24a'; c.fillRect(PX + 110, 252, PW - 220, 2);
    text('永禄三年（1560）秋。桶狭間で今川義元が倒れ、', x, 290, 16, INK, 'center', FONT, 600);
    text('二十の国が、それぞれの天下を夢みはじめた。', x, 314, 16, INK, 'center', FONT, 600);
    text('表の目で攻め、裏の目で治める。', x, 352, 18, RED, 'center', FONT, 700);
    var has = !!load(SAVE);
    btn('start', PX + 140, 390, PW - 280, 64, 'はじめる', { on: function () { A.play('click'); st.screen = 'select'; }, col: '#9c2f26', size: 28, ring: pulseRing() });
    btn('cont', PX + 140, 468, PW - 280, 50, 'つづきから', { on: function () { A.play('click'); if (!resume()) A.play('deny'); }, off: !has, size: 20 });
    btn('how', PX + 140, 530, PW - 280, 50, '遊び方', { on: function () { st.help = true; A.play('click'); }, size: 20 });
    var done = 0, top = 0; Object.keys(rec).forEach(function (k) { if (rec[k].plays) done++; if (rec[k].best === 1) top++; });
    text('大名帳　遊んだ大名 ' + done + ' / 20　天下人 ' + top + ' / 20', x, 622, 15, '#5a4a3a', 'center', GOTH, 700);
    text('PCブラウザ用・マウスで操作　／　音が出ます（右上の ♪ で消音）', x, 690, 12, '#6b5a48', 'center', GOTH, 500);
    smallBtns();
  }

  // ---- 大名選び ----
  function drawSelect() {
    drawMap(0);
    panelBase();
    var x0 = PX + 24, p = st.pick, P = D.PROV[p], w = PW - 48;
    text('大名を選ぶ', x0, 44, 28, INK, 'left', FONT, 800);
    text('地図か、下の旗をクリック', x0 + 170, 42, 14, '#6b5a48', 'left', GOTH, 600);
    smallBtns();
    divider(60);
    GX.flag(c, x0 + 4, 76, 62, p, true);
    text(P.lord, x0 + 70, 108, 34, INK, 'left', FONT, 800);
    text(P.name, x0 + 72, 134, 17, '#5a4a3a', 'left', FONT, 700);
    text(NOTE[p], x0, 170, 16, INK, 'left', FONT, 600);
    stat('経済力', P.eco, 5, x0, 204, '#c9972a');
    stat('軍事力', P.mil, 5, x0, 230, '#b8362c');
    stat('守備力', P.def, 5, x0, 256, '#4a5a6a');
    var bx = x0 + 250;
    text('はじめの兵 ' + (3 + 2 * P.mil) + '　城 ' + P.def + '　経済 ' + P.eco, bx, 204, 14, INK, 'left', GOTH, 700);
    text('隣国 ' + D.ADJ[p].length + '：' + D.ADJ[p].map(function (q) { return D.PROV[q].house; }).join('・'), bx, 228, 12.5, '#5a4a3a', 'left', GOTH, 600);
    var r = D.RATING[p];
    text('難しさ', bx, 256, 14, '#5a4a3a', 'left', GOTH, 700);
    for (var i = 0; i < 5; i++) text(i < r ? '★' : '☆', bx + 54 + i * 18, 257, 17, i < r ? RED : '#a89880', 'left', GOTH, 700);
    text(RATE[r], bx + 152, 256, 14, RED, 'left', GOTH, 800);
    var rc = rec[p];
    text(rc && rc.plays ? '大名帳：' + (rc.unify ? '天下統一！' : rc.best < 99 ? '最高 ' + rc.best + ' 位（' + rc.n + '国）' : '滅亡のみ') + '　' + rc.plays + '回' : '大名帳：まだ遊んでいない', x0, 286, 13, '#6b5a48', 'left', GOTH, 600);
    divider(298);
    // 旗の一覧
    for (var k = 0; k < 20; k++) {
      var gx = x0 + 6 + (k % 10) * 53, gy = 312 + Math.floor(k / 10) * 92, sel = k === p;
      if (sel) { c.fillStyle = 'rgba(217,165,32,0.4)'; GX.rr(c, gx - 6, gy - 5, 50, 86, 6); c.fill(); }
      GX.flag(c, gx + 4, gy, 44, k, sel);
      text(D.PROV[k].house.length > 3 ? D.PROV[k].house.slice(0, 3) : D.PROV[k].house, gx + 20, gy + 66, 12, INK, 'center', GOTH, 700);
      var rr2 = rec[k];
      if (rr2 && rr2.best === 1) text('天', gx + 20, gy + 79, 11, RED, 'center', GOTH, 800);
      else if (rr2 && rr2.plays) text(rr2.best < 99 ? rr2.best + '位' : '・', gx + 20, gy + 79, 10, '#6b5a48', 'center', GOTH, 700);
      (function (kk) { buttons.push({ id: 'clan' + kk, x: gx - 6, y: gy - 5, w: 50, h: 86, on: function () { st.pick = kk; A.play('pick'); } }); })(k);
    }
    divider(504);
    text('20季（1565年夏）が終わったとき、いちばん国の多い大名が天下人。', x0, 532, 14.5, INK, 'left', GOTH, 700);
    text('表の目で攻め・備え、裏の目（7−表）で開発・築城・徴兵。くわしくは右上の「？」', x0, 556, 13, '#5a4a3a', 'left', GOTH, 600);
    btn('begin', x0 + 60, 590, w - 120, 68, P.lord + ' で始める', { on: function () { newGame(st.pick); }, col: '#9c2f26', size: 26, ring: pulseRing() });
    btn('back', x0, 672, 130, 36, '← 題字へ', { on: function () { st.screen = 'title'; A.play('click'); }, size: 14 });
  }

  // ---- 結末 ----
  function drawResult() {
    var G = st.G, R = st.res, pl = G.player, P = D.PROV[pl], x0 = PX + 24, w = PW - 48;
    drawMap(0);
    panelBase();
    var d = E.dateOf(Math.min(G.turn, E.R.TURNS));
    var head, sub, col = INK;
    if (R.type === 'dead') { head = P.house + '家　滅亡'; sub = (1560 + Math.floor((G.clan[pl].fell + 2) / 4)) + '年' + D.SEASONS[G.clan[pl].fell % 4] + '、' + D.PROV[G.clan[pl].by].lord + 'に敗れた。'; col = '#4a4a55'; }
    else if (R.type === 'unify' && G.over.winner === pl) { head = '天下統一！'; sub = P.lord + '、二十の国をすべて治める。'; col = RED; }
    else if (R.rank === 1) { head = '天下人'; sub = P.lord + '、' + R.n + '国を治め、天下第一の大名となる。'; col = RED; }
    else { head = '天下 第' + R.rank + '位'; sub = R.n + '国。天下人は ' + D.PROV[R.rk[0].clan].lord + '（' + R.rk[0].n + '国）。'; }
    if (R.after) { head = 'その後の天下'; sub = '天下人は ' + D.PROV[R.rk[0].clan].lord + '（' + R.rk[0].n + '国）。'; }
    var k = Math.min(1, R.t / 0.5);
    c.save(); c.translate(x0 + w / 2, 58); c.scale(1.6 - 0.6 * k, 1.6 - 0.6 * k); c.globalAlpha = k;
    text(head, 0, 14, 46, col, 'center', FONT, 800); c.restore();
    text(sub, x0 + w / 2, 104, 16, INK, 'center', FONT, 700);
    text('合戦 ' + (G.stat.win + G.stat.lose) + '（勝ち' + G.stat.win + '）　守り切った ' + G.stat.held + '　奪われた ' + G.stat.lost + '　／　滅んだ家 ' + R.rk.filter(function (r) { return !r.alive; }).length, x0 + w / 2, 128, 13, '#5a4a3a', 'center', GOTH, 600);
    divider(140);
    // 順位
    var rows = R.rk.slice(0, 7);
    if (R.rank > 7) rows[6] = R.rk[R.rank - 1];
    rows.forEach(function (r, i) {
      var y = 150 + i * 23, me = r.clan === pl, pos = R.rk.indexOf(r) + 1;
      if (me) { c.fillStyle = 'rgba(217,165,32,0.25)'; c.fillRect(x0 - 4, y - 1, w + 8, 22); }
      text(pos + '', x0 + 10, y + 16, 14, '#5a4a3a', 'center', GOTH, 800);
      c.fillStyle = D.PROV[r.clan].color; c.fillRect(x0 + 26, y + 3, 15, 15); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.strokeRect(x0 + 26, y + 3, 15, 15);
      text(D.PROV[r.clan].lord, x0 + 50, y + 16, 15, r.alive ? INK : '#8a7a68', 'left', FONT, 700);
      if (r.alive) {
        c.fillStyle = D.PROV[r.clan].color; c.fillRect(x0 + 180, y + 6, 190 * r.n / 20, 10);
        text(r.n + '国', x0 + 384, y + 16, 14, INK, 'left', GOTH, 800);
        text('経済' + r.eco + '　兵' + r.troops, x0 + 430, y + 16, 12, '#5a4a3a', 'left', GOTH, 600);
      } else text('滅亡', x0 + 384, y + 16, 13, '#8a7a68', 'left', GOTH, 700);
    });
    divider(316);
    // 勢力の移り変わり
    text('勢力の移り変わり', x0, 334, 13, '#6b5a48', 'left', GOTH, 700);
    var gx = x0 + 6, gy = 344, gw = w - 12, gh = 120, H = G.history, T = Math.max(1, H.length - 1), mx = 4;
    H.forEach(function (row) { row.forEach(function (v) { if (v > mx) mx = v; }); });
    c.fillStyle = 'rgba(255,252,240,0.5)'; c.fillRect(gx, gy, gw, gh);
    c.strokeStyle = 'rgba(70,50,30,0.2)'; c.lineWidth = 1;
    for (var g = 0; g <= mx; g += Math.max(1, Math.ceil(mx / 5))) { var yy = gy + gh - gh * g / mx; c.beginPath(); c.moveTo(gx, yy); c.lineTo(gx + gw, yy); c.stroke(); text(g + '', gx - 3, yy + 4, 10, '#6b5a48', 'right', GOTH, 600); }
    var show = R.rk.slice(0, 6).map(function (r) { return r.clan; }); if (show.indexOf(pl) < 0) show.push(pl);
    var prog = Math.min(1, R.t / 1.6);
    show.slice().reverse().forEach(function (cl) {
      c.strokeStyle = D.PROV[cl].color; c.lineWidth = cl === pl ? 4.5 : 2.2; c.lineJoin = 'round'; c.beginPath();
      var nmax = Math.max(1, Math.floor(T * prog));
      for (var t = 0; t <= nmax; t++) { var px = gx + gw * t / T, py = gy + gh - gh * H[t][cl] / mx - (cl === pl ? 0 : (cl % 3) - 1); if (t === 0) c.moveTo(px, py); else c.lineTo(px, py); }
      if (cl === pl) { c.save(); c.strokeStyle = '#2a2018'; c.lineWidth = 6.5; c.stroke(); c.restore(); }
      c.stroke();
    });
    // 年表
    text('この世界の戦国史', x0, 486, 13, '#6b5a48', 'left', GOTH, 700);
    var falls = G.chron.filter(function (e) { return e.k === 'fall' || e.a === pl || e.d === pl; }).slice(-6);
    falls.forEach(function (e, i) {
      var dd = E.dateOf(e.t);
      var s = dd.year + dd.season + '　' + D.PROV[e.a].house + '、' + D.PROV[e.p].name + 'を奪う' + (e.k === 'fall' ? '。' + D.PROV[e.d].house + '家 滅亡' : '（' + D.PROV[e.d].house + '）');
      text(s, x0 + 4, 506 + i * 19, 13, e.a === pl ? '#2f6f4f' : e.d === pl ? RED : INK, 'left', GOTH, 600);
    });
    if (!falls.length) text('大きな国替えのない、静かな五年だった。', x0 + 4, 506, 13, INK, 'left', GOTH, 600);
    var by = 632;
    if (R.type === 'dead' && !R.after) btn('watch', x0, by - 4, w, 34, 'この後の天下を見届ける', { on: function () { watchRest(); A.play('season'); }, size: 15 });
    btn('again', x0, by + 36, w / 2 - 6, 46, 'もう一度 ' + P.house + ' で', { on: function () { newGame(pl); }, col: '#9c2f26', size: 18 });
    btn('other', x0 + w / 2 + 6, by + 36, w / 2 - 6, 46, '大名を選びなおす', { on: function () { st.screen = 'select'; A.play('click'); syncTitleMap(); }, size: 18 });
    text(d.year + '年' + (G.turn >= E.R.TURNS ? '夏' : d.season) + 'まで', CW - 24, 30, 12, '#6b5a48', 'right', GOTH, 600);
  }
  function syncTitleMap() {
    st.G = null;
    st.V = D.PROV.map(function (p, i) { return { owner: i, eco: p.eco, cas: p.def, troops: 3 + 2 * p.mil, guard: 0, truce: false }; });
    GX.paint(st.V.map(function (p) { return p.owner; }), -1);
  }

  // ---- 遊び方 ----
  function drawHelp() {
    c.fillStyle = 'rgba(20,14,8,0.72)'; c.fillRect(0, 0, CW, CH);
    var x = 130, y = 24, w = 1020, h = 672;
    c.fillStyle = GX.paper(c); GX.rr(c, x, y, w, h, 16); c.fill(); c.strokeStyle = '#3a2a1c'; c.lineWidth = 4; c.stroke();
    text('遊び方', x + 40, y + 58, 34, INK, 'left', FONT, 800);
    text('20季のあいだに、いちばん多くの国を治めた大名が天下人。', x + 180, y + 54, 17, '#5a4a3a', 'left', FONT, 700);
    var yy = y + 96;
    // 表と裏
    GX.die(c, x + 86, yy + 44, 72, 5, 'omote'); GX.die(c, x + 150, yy + 74, 40, 2, 'ura');
    text('サイコロには 表 と 裏 がある', x + 200, yy + 30, 22, INK, 'left', FONT, 800);
    text('毎季、サイコロを振る。1個につき采配を1回。表と裏の目は、足すと必ず 7。', x + 200, yy + 58, 15, INK, 'left', GOTH, 600);
    text('大きい目は攻めに強く、小さい目は裏が大きいので内政に強い。まん中の 3・4 は振り直しの候補。', x + 200, yy + 82, 15, INK, 'left', GOTH, 600);
    yy += 122;
    var cw = (w - 100) / 2;
    c.fillStyle = 'rgba(184,54,44,0.12)'; GX.rr(c, x + 40, yy, cw, 150, 10); c.fill();
    c.fillStyle = 'rgba(47,79,127,0.12)'; GX.rr(c, x + 60 + cw, yy, cw, 150, 10); c.fill();
    text('表の目で（大きいほど強い）', x + 56, yy + 30, 18, RED, 'left', FONT, 800);
    text('出陣　隣の敵国へ攻めこむ。味方の国へ兵を移すこともできる。', x + 56, yy + 60, 14, INK, 'left', GOTH, 600);
    text('　　　攻めには賽を2つまで重ねられ、ゾロ目なら +3。', x + 56, yy + 82, 14, INK, 'left', GOTH, 600);
    text('備え　次の自分の番まで、その国の守りに目の数を足す。', x + 56, yy + 112, 14, INK, 'left', GOTH, 600);
    text('裏の目で（7 − 表）', x + 76 + cw, yy + 30, 18, BLUE, 'left', FONT, 800);
    text('開発　裏の目が今の経済以上なら 経済+1（収入と兵の上限が増える）', x + 76 + cw, yy + 60, 13.5, INK, 'left', GOTH, 600);
    text('築城　裏の目が今の城以上なら 城+1（守りが2ずつ堅くなる）', x + 76 + cw, yy + 86, 13.5, INK, 'left', GOTH, 600);
    text('徴兵　裏の目の数まで兵を雇う（兵1につき金2。上限は 6＋経済）', x + 76 + cw, yy + 112, 13.5, INK, 'left', GOTH, 600);
    yy += 166;
    text('合戦', x + 40, yy + 22, 20, INK, 'left', FONT, 800);
    text('攻めの強さ ＝ 送る兵 ＋ 賽　　　守りの強さ ＝ 兵 ＋ 城×2 ＋ 備え ＋ 守り手が振る賽（1〜6）', x + 110, yy + 22, 16, RED, 'left', GOTH, 800);
    text('攻めが上回れば国を奪える。奪った国は経済と城が1ずつ下がり、次の自分の番まで「平定」で攻められない。', x + 110, yy + 48, 14, INK, 'left', GOTH, 600);
    text('攻めきれなければ送った兵の半分を失う。ただし守り切った側も兵が減り、城が1段くずれる。', x + 110, yy + 70, 14, INK, 'left', GOTH, 600);
    yy += 92;
    text('知恵', x + 40, yy + 22, 20, INK, 'left', FONT, 800);
    text('振り直し：まだ使っていない賽を、季節に1回だけ振り直せる。', x + 110, yy + 22, 14, INK, 'left', GOTH, 600);
    text('裏返す：金で賽の表と裏を入れ替える。　賽を買う：金でこの季だけ賽を1個増やす（3個まで）。', x + 110, yy + 44, 14, INK, 'left', GOTH, 600);
    text('国が2つ増えるごとに賽が1個増える（最大6個）。余った賽は金1になる。秋は年貢が2倍。', x + 110, yy + 66, 14, INK, 'left', GOTH, 600);
    text('最初の季節（1560年秋）は、どの大名も出陣できない。', x + 110, yy + 88, 14, INK, 'left', GOTH, 600);
    text('キー：1〜9 賽を選ぶ／スペース 決定／R 振り直し／F 裏返す／B 賽を買う／Esc やめる', x + 40, y + h - 30, 13, '#5a4a3a', 'left', GOTH, 600);
    btn('helpok', x + w - 210, y + h - 62, 180, 46, 'わかった', { on: function () { st.help = false; opt.seen = true; store(OPT, opt); A.play('click'); }, col: '#9c2f26', size: 20 });
  }
  function drawMenu() {
    c.fillStyle = 'rgba(20,14,8,0.6)'; c.fillRect(0, 0, CW, CH);
    var x = 440, y = 220, w = 400, h = 280;
    c.fillStyle = GX.paper(c); GX.rr(c, x, y, w, h, 14); c.fill(); c.strokeStyle = '#3a2a1c'; c.lineWidth = 3; c.stroke();
    text('ひと休み', x + w / 2, y + 48, 26, INK, 'center', FONT, 800);
    btn('m1', x + 50, y + 74, w - 100, 46, 'つづける', { on: function () { st.menu = false; }, col: '#9c2f26', size: 19 });
    btn('m2', x + 50, y + 130, w - 100, 46, 'BGM ' + (A.isBgm() ? 'あり' : 'なし'), { on: function () { A.setBgm(!A.isBgm()); opt.bgm = A.isBgm(); store(OPT, opt); }, size: 17 });
    btn('m3', x + 50, y + 186, w - 100, 46, '題字へ戻る（番の初めから再開できる）', { on: function () { st.menu = false; st.screen = 'title'; st.Q = []; st.battle = null; st.banner = null; syncTitleMap(); }, size: 14 });
  }

  // ================= ループと入力 =================
  var lastT = 0;
  function frame(now) {
    var dt = Math.max(0, Math.min(0.05, (now - lastT) / 1000)); lastT = now;
    step(dt); draw();
    requestAnimationFrame(frame);
  }
  function step(dt) {
    st.time += dt;
    var sp = st.speed * (st.fast ? 4 : 1);
    if (st.res) st.res.t += dt;
    st.ticker.forEach(function (t) { t.t += dt; });
    st.fx = st.fx.filter(function (f) { f.t += dt; return f.t < f.dur; });
    if (st.flipAnim) { st.flipAnim.t += dt; if (st.flipAnim.t > 0.3) st.flipAnim = null; }
    if (st.newDie) { st.newDie.t += dt * st.speed; if (st.newDie.t > 0.45) st.newDie = null; }
    if (st.rollAnim) {
      st.rollAnim.t += dt * st.speed;
      if (st.rollAnim.t >= st.rollAnim.dur + 0.05) { st.rollAnim = null; st.phase = 'act'; st.selDie = firstFree(); }
    }
    var budget = dt * sp, guard = 0;
    while (st.Q.length && guard++ < 50) {
      var it = st.Q[0];
      if (it.t == null) { it.t = 0; it.start && it.start(); }
      if (it.dur <= 0) { st.Q.shift(); it.end && it.end(); continue; }
      it.t += it.slow ? dt * st.speed : budget; budget = 0;
      var u = Math.min(1, it.t / it.dur);
      it.update && it.update(u);
      if (u >= 1) { st.Q.shift(); it.end && it.end(); } else break;
    }
    if (!st.Q.length && st.afterQ) { var f = st.afterQ; st.afterQ = null; f(); }
  }
  function draw() {
    buttons = [];
    c.setTransform(cv.width / CW, 0, 0, cv.height / CH, 0, 0);
    c.clearRect(0, 0, CW, CH);
    if (st.screen === 'title') drawTitle();
    else if (st.screen === 'select') drawSelect();
    else if (st.screen === 'result') drawResult();
    else { drawMap(0); drawTicker(); drawBattle(); drawBanner(); drawTip(); drawPlayPanel(); }
    if (st.menu) { var keep = buttons; buttons = []; drawMenu(); keep = null; }
    if (st.help) { buttons = []; drawHelp(); }
  }

  function pos(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * CW / r.width, y: (e.clientY - r.top) * CH / r.height }; }
  function onMove(e) {
    var p = pos(e); st.mouse = p;
    st.hover = (p.x < PX && !st.help && !st.menu) ? GX.provinceAt(p.x, p.y) : -1;
    var hot = st.hover >= 0;
    for (var i = buttons.length - 1; i >= 0 && !hot; i--) { var b = buttons[i]; if (b.on && p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h) hot = true; }
    cv.style.cursor = hot ? 'pointer' : 'default';
  }
  function onDown(e) {
    A.unlock();
    var p = pos(e); st.mouse = p;
    for (var i = buttons.length - 1; i >= 0; i--) {
      var b = buttons[i];
      if (p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h) { if (b.on) b.on(); else if (b.off) A.play('deny'); return; }
    }
    if (st.help || st.menu) return;
    if (p.x >= PX) return;
    var pr = GX.provinceAt(p.x, p.y);
    if (st.screen === 'select') { if (pr >= 0) { st.pick = pr; A.play('pick'); } return; }
    if (st.screen !== 'play') return;
    if (st.Q.length) { if (st.phase === 'cpu') st.fast = true; return; }
    if (st.phase !== 'act') return;
    mapClick(pr);
  }
  function mapClick(pr) {
    var G = st.G, pl = G.player;
    if (pr < 0) { st.selProv = -1; st.mode = ''; st.atk = null; return; }
    var mine = G.prov[pr].owner === pl;
    if (st.mode === 'target' || st.mode === 'attack' || st.mode === 'move') {
      var from = st.mode === 'target' ? st.selProv : st.atk.from;
      if (pr !== from && E.adjacent(from, pr) && st.selDie >= 0) { openAttack(from, pr); return; }
      st.mode = ''; st.atk = null;
    }
    if (mine) { st.selProv = pr; A.play('pick'); return; }
    // 敵国：選んでいる自国の隣なら、そのまま出陣の支度へ
    if (st.selDie >= 0 && st.selProv >= 0 && G.prov[st.selProv].owner === pl && E.adjacent(st.selProv, pr) && E.canAttack(G, st.selProv, pr) && G.turn >= E.R.PEACE) { openAttack(st.selProv, pr); return; }
    if (st.selDie >= 0 && G.turn >= E.R.PEACE) {
      var best = -1;
      D.ADJ[pr].forEach(function (q) { if (G.prov[q].owner === pl && E.canAttack(G, q, pr) && (best < 0 || G.prov[q].troops > G.prov[best].troops)) best = q; });
      if (best >= 0) { openAttack(best, pr); return; }
    }
    st.selProv = pr; A.play('click');
  }
  function onKey(e) {
    var k = e.key;
    if (st.help) { if (k === 'Escape' || k === 'Enter' || k === ' ') { st.help = false; opt.seen = true; store(OPT, opt); } e.preventDefault(); return; }
    if (st.menu) { if (k === 'Escape') st.menu = false; return; }
    if (k === 'm' || k === 'M') { A.setOn(!A.isOn()); return; }
    if (k === 'h' || k === 'H' || k === '?') { st.help = true; return; }
    if (st.screen === 'title') { if (k === 'Enter' || k === ' ') { st.screen = 'select'; e.preventDefault(); } return; }
    if (st.screen !== 'play') return;
    if (k === ' ' || k === 'Enter') {
      e.preventDefault(); A.unlock();
      if (st.phase === 'roll') doRoll();
      else if (st.phase === 'act' && (st.mode === 'attack' || st.mode === 'move')) commitAttack();
      else if (st.phase === 'act' && freeCount() === 0 && !st.Q.length) endTurn();
      else if (st.phase === 'cpu') st.fast = true;
      return;
    }
    if (st.phase !== 'act') return;
    if (k >= '1' && k <= '9') { var i = +k - 1; if (st.G.dice[i] && !st.G.dice[i].used) { st.selDie = i; A.play('pick'); } }
    else if (k === 'r' || k === 'R') doReroll();
    else if (k === 'f' || k === 'F') doFlip();
    else if (k === 'b' || k === 'B') doBuy();
    else if (k === 'Escape') { if (st.mode) { st.mode = ''; st.atk = null; } else st.selProv = -1; }
  }
  function resize() {
    var ww = root.innerWidth, wh = root.innerHeight, k = Math.min(ww / CW, wh / CH);
    var w = Math.floor(CW * k), h = Math.floor(CH * k), dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }

  function boot() {
    cv = document.getElementById('cv'); c = cv.getContext('2d');
    GX.init(); geo = GX.geo();
    A.setOn(opt.sound !== false); A.setBgm(opt.bgm !== false);
    syncTitleMap();
    resize(); root.addEventListener('resize', resize);
    cv.addEventListener('mousemove', onMove); cv.addEventListener('mousedown', onDown);
    cv.addEventListener('mouseleave', function () { st.hover = -1; });
    root.addEventListener('keydown', onKey);
    var ld = document.getElementById('loading'); if (ld) ld.style.display = 'none';
    requestAnimationFrame(function (t) { lastT = t; frame(t); });
  }

  // 検証用の窓口
  root.K13 = {
    st: st, E: E, AI: AI,
    debug: {
      buttons: function () { var r = cv.getBoundingClientRect(), k = r.width / CW; return buttons.filter(function (b) { return b.on; }).map(function (b) { return { id: b.id, label: b.label || '', x: r.left + (b.x + b.w / 2) * k, y: r.top + (b.y + b.h / 2) * k }; }); },
      prov: function (i) {
        var r = cv.getBoundingClientRect(), k = r.width / CW, cs = geo.castle[i], best = null;
        [[0, 26], [0, -30], [36, 0], [-36, 0], [0, 34], [30, 26], [-30, 26], [0, 0]].some(function (o) { if (GX.provinceAt(cs.x + o[0], cs.y + o[1]) === i) { best = o; return true; } return false; });
        best = best || [0, 0];
        return { x: r.left + (cs.x + best[0]) * k, y: r.top + (cs.y + best[1]) * k };
      },
      state: function () { var G = st.G; return { screen: st.screen, phase: st.phase, mode: st.mode, selDie: st.selDie, selProv: st.selProv, q: st.Q.length, turn: G ? G.turn : -1, dice: G ? G.dice : [], gold: G && G.player >= 0 ? G.clan[G.player].gold : 0, n: G && G.player >= 0 ? E.countOf(G, G.player) : 0, over: G ? G.over : null, res: st.res ? { type: st.res.type, rank: st.res.rank, n: st.res.n } : null }; },
      step: function (dt, n) { for (var i = 0; i < (n || 1); i++) step(dt); draw(); }
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
