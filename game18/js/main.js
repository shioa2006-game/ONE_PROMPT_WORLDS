// がらり、迷宮ひらき — 進行・入力・画面・演出
(function () {
  'use strict';
  const W = 1280, H = 720;
  const G = window.GR, V = window.GV, A = window.GA, D = window.GD;
  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  let SC = 1, DPR = 1;
  function fit() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    SC = Math.min(window.innerWidth / W, window.innerHeight / H);
    cv.style.width = Math.floor(W * SC) + 'px';
    cv.style.height = Math.floor(H * SC) + 'px';
    cv.width = Math.floor(W * SC * DPR);
    cv.height = Math.floor(H * SC * DPR);
  }
  window.addEventListener('resize', fit);
  fit();

  // ---------- 保存 ----------
  const SAVE = 'garari18_save', CFG = 'garari18_cfg', REC = 'garari18_rec';
  function load(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できない環境では何もしない */ } }
  const cfg = Object.assign({ mute: false, vol: 0.7, bgm: 0.45, fast: false, auto: false }, load(CFG) || {});
  A.setMuted(cfg.mute); A.setVol(cfg.vol); A.setBgmVol(cfg.bgm);
  const saveCfg = () => store(CFG, cfg);
  const rec = Object.assign({ cleared: 0 }, load(REC) || {});
  const saveRec = () => store(REC, rec);
  function saveGame() { if (App.s) store(SAVE, G.save(App.s)); }
  const URLSEED = (() => { const m = /[?&]seed=(\d+)/.exec(location.search); return m ? +m[1] : 0; })();

  // ---------- アプリ ----------
  const App = { scene: 'title', s: null, t: 0, frame: [], btns: [], tips: [], mx: -1, my: -1, overlay: null, toast: null, drawLayer: 0, debugHold: false, speed: 1, story: null, map: null, ed: null };
  const S = () => App.s;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const inside = (x, y, b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  const mod = G.mod;
  const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  const SPD = () => (cfg.fast ? 2 : 1) * App.speed * (BS && BS.rush ? 3 : 1);

  function btn(o) {
    o.layer = o.layer !== undefined ? o.layer : App.drawLayer;
    const top = App.overlay ? 1 : 0;
    o.hot = o.layer >= top && inside(App.mx, App.my, o);
    App.frame.push(o);
    if (!o.invisible) V.button(ctx, o, App.t);
    return o;
  }
  function tip(x, y, w, h, title, text) { App.tips.push({ x, y, w, h, title, text, layer: App.drawLayer }); }
  function toast(text, dur) { App.toast = { text: text, t: 0, dur: dur || 2.4 }; }

  // ======================================================================
  // 戦場の配置
  // ======================================================================
  const L = { RW: 76, RG: 6, RX1: 432, Y: 160, RH: 110, PK: 32, PX: 440, PW: 70, FX0: 520, FX1: 1272, HX: 556, COL0: 632, CW: 84, WX: 1098, WW: 174 };
  const nReels = () => S().reels.length;
  const reelX = i => L.RX1 - (nReels() - i) * (L.RW + L.RG) + L.RG;
  const rowY = r => L.Y + r * L.RH;
  const rowCY = r => L.Y + r * L.RH + L.RH / 2;
  const footY = l => L.Y + l * L.RH + L.RH - 14;
  const hitY = l => footY(l) - 30;
  const colX = c => L.COL0 + c * L.CW;
  const F = { Y: L.Y, RH: L.RH, X0: L.FX0, X1: L.FX1 };

  // ---------- 戦いの画面状態 ----------
  let BS = null;
  function newBS() {
    const s = S();
    return {
      vis: s.reels.map(r => r.pos), spin: null, tl: null, fx: [], pops: [], dm: {}, wv: [0, 1, 2].map(() => ({ broken: false, t: 9, shake: 0, spin: 0 })),
      pred: null, predKey: '', msg: '', coach: null, hint: null, shake: 0, flash: 0, big: null, over: null, rush: false,
      cast: 0, hurt: 0, lit: [[], [], []], plate: [0, 0, 0], drag: null, autoT: -1, teach: null, ready: true, banner: null,
      missNote: false, opened: [], cmp: App.cmp || { last: null, prev: null }, stopFlash: [],
    };
  }
  function syncDM(fresh) {
    const b = S().b;
    const dm = BS.dm;
    const alive = new Set();
    for (const e of b.en) {
      if (e.hp <= 0) continue;
      alive.add(e.id);
      let d = dm[e.id];
      if (!d) {
        d = dm[e.id] = { id: e.id, t: e.t, x: colX(e.col), y: footY(e.lane), tx: colX(e.col), ty: footY(e.lane), hp: e.hp, max: e.max, alpha: fresh ? 1 : 0, flash: 0, dying: 0, frz: 0 };
        if (!fresh) d.x = colX(e.col) + 70;
      }
      d.tx = colX(e.col); d.ty = footY(e.lane); d.hp = e.hp; d.max = e.max; d.frz = e.frozen; d.lane = e.lane; d.col = e.col; d.shell = e.shell;
    }
    for (const id in dm) if (!alive.has(+id) && !dm[id].dying && !dm[id].flee) delete dm[id];
  }
  function syncWalls() {
    const b = S().b;
    b.walls.forEach((w, l) => { const v = BS.wv[l]; if (w.broken && !v.broken) { v.broken = true; v.t = 9; } });
  }
  function glimpseOf(wid) {
    const e = D.EDGES.find(x => x.gate === wid);
    if (!e) return 'glow';
    if (e.shaft) return 'deep';
    const r = D.ROOMS[e.b];
    return r && r.items ? 'chest' : 'glow';
  }

  // ======================================================================
  // 戦いを始める
  // ======================================================================
  function startBattle(room, kind) {
    const s = S();
    const R = G.room(room);
    kind = kind || 'battle';
    G.startBattle(s, R.battle, kind, room);
    BS = newBS();
    syncDM(true); syncWalls();
    App.scene = 'battle';
    App.overlay = null;
    const bt = D.BATTLES[R.battle];
    A.music(bt.boss ? 'boss' : 'battle');
    const walls = s.b.walls.filter(w => w.id && !w.broken);
    if (kind === 'quiet') {
      BS.ready = false;
      BS.banner = { text: R.name + '（静か）', sub: '魔物はいない。壁を狙って、何度でも詠唱できる', t: 0 };
    } else {
      BS.banner = { text: R.name, sub: walls.length ? walls.map(w => G.WALL[w.kind].name + '（' + (w.need === 'any' ? 'どの紋でも' : V.EL_NAME[w.need] + 'の行で') + ' ' + w.th + '以上）').join('・') : '魔物 ' + s.b.en.length + '体', t: 0 };
    }
    BS.msg = readyMsg();
  }
  function readyMsg() {
    const s = S(), b = s.b;
    if (b.kind === 'quiet') {
      const w = b.walls.find(x => x.id && !x.broken);
      let m = '魔物のいない部屋。壁に届く行をそろえて「放つ」。何度でもためせる（静かな部屋は魔力+2）。';
      if (w && w.accum) m += `
${G.WALL[w.kind].name}：どの紋でも、届いた力が積み重なり、合わせて ${w.th} で崩れる（いま ${w.dmg || 0}）。一撃で届かせれば、いちばん気持ちいい。`;
      else if (w) m += `
${G.WALL[w.kind].name}：${w.need === 'any' ? 'どの紋でも' : V.EL_NAME[w.need] + 'の行で'}、一撃 ${w.th} 以上。`;
      if (s.forge > 0 || s.bag.some(c => c.k !== 'sword')) m += '　「組む」で紋を刻んだり鍛えたりできる。';
      return m + wallAdvice(w);
    }
    if (b.kind === 'practice') return practiceMsg() || '試し詠唱：回して、ずらして、放つ。的は回すたびに元にもどる。「同じ回転で」で、組み替える前と同じ止まり方にできる。';
    const walls = b.walls.filter(w => w.id && !w.broken);
    let m = '「回す」で詠唱輪が回る。';
    if (walls.length) {
      const w = walls[0];
      m += `段の奥に${G.WALL[w.kind].name}。${w.need === 'any' ? 'どの紋でも' : V.EL_NAME[w.need] + 'の行で'}、魔物を貫いて余った力が ${w.th} 以上届けば崩れる。`;
      if (w.nest) m += '崩すまで、奥から魔物が出てくる。';
      m += wallAdvice(w);
    }
    if (s.bag.length) m += '（持ち物の紋は「詠唱輪を組む」で刻める）';
    return m;
  }
  // 壁に届かない組み方のとき、理由を示す
  function wallAdvice(w) {
    const s = S();
    if (!w || w.accum) return '';
    const NM = k => `「${V.EL_NAME[k]}」`;
    if (w.need !== 'any') {
      if (!s.reels[0].strip.some(c => c.k === w.need || c.k === 'star')) return `\n※1本目のリールに${NM(w.need)}がないので、${NM(w.need)}の行ができない。「詠唱輪を組む」で1本目にも刻もう。`;
      const mx = G.maxLine(s, w.need);
      if (mx.power < w.th) return `\n※いまの組み方では、${NM(w.need)}の行は最大でも ${mx.power}（${w.th} 要る）。左のリールから順に${NM(w.need)}を刻むか、鍛えると届く。`;
      return '';
    }
    let best = 0;
    for (const el of ['sword', 'fire', 'ice', 'bolt', 'light']) best = Math.max(best, G.maxLine(s, el).power);
    if (best < w.th) return `\n※いまの組み方では、どの紋の行も最大 ${best}（${w.th} 要る）。リールがふえたり、紋を鍛えたりすると届くようになる。`;
    return '';
  }
  function startPractice(fromRoom) {
    const s = S();
    App.practiceBack = { b: s.b, BS: BS, scene: App.scene, map: App.scene === 'map' };
    const R = fromRoom ? G.room(fromRoom) : null;
    if (R && R.battle) { G.startBattle(s, R.battle, 'practice-room', fromRoom); s.b.walls.forEach(w => { w.nest = null; }); }
    else G.startBattle(s, null, 'practice', s.at);
    s.b.init = G.clone(s.b.en);
    s.b.initWalls = G.clone(s.b.walls);
    BS = newBS();
    BS.ready = false;
    syncDM(true); syncWalls();
    App.scene = 'battle';
    App.overlay = null;
    BS.banner = { text: '試し詠唱', sub: R ? 'この部屋の様子で試す（本番ではない）' : 'わら人形を的に試す', t: 0 };
    BS.msg = readyMsg();
  }
  function endPractice() {
    const s = S();
    const back = App.practiceBack;
    App.practiceBack = null;
    s.b = back ? back.b : null;
    BS = back ? back.BS : null;
    if (back && !back.map && BS) { App.scene = 'battle'; s.reels.forEach((r, i) => { BS.vis[i] = r.pos; }); BS.predKey = ''; BS.msg = readyMsg(); }
    else openMap();
    openEditor();
  }

  // ======================================================================
  // 回す
  // ======================================================================
  function runLen(s, r, upto) {
    let el = null, n = 0;
    for (let i = 0; i < upto; i++) {
      const c = G.winCell(s, i, r);
      if (c.k === 'gap') break;
      if (c.k === 'star') { n++; continue; }
      if (el === null || c.k === el) { el = c.k; n++; continue; }
      break;
    }
    return n;
  }
  function doSpin(pos) {
    const s = S(), b = s.b;
    if (!b || b.phase !== 'spin' || BS.spin || BS.tl || BS.over) return;
    A.init();
    BS.ready = false;
    BS.hint = null; BS.coach = null; BS.teach = null;
    BS.banner = null;
    if (b.kind === 'practice') {
      b.en = G.clone(b.init); b.walls = G.clone(b.initWalls);
      BS.dm = {}; syncDM(true); BS.wv.forEach(v => { v.broken = false; });
      syncWalls();
    }
    let target = pos || scriptPos() || teachPos();
    G.spin(s, target);
    BS.lit = [[], [], []];
    const n = s.reels.length;
    const stops = [];
    for (let i = 0; i < n; i++) stops.push(0.36 + i * 0.15);
    BS.spin = { t: 0, stops: stops, done: new Array(n).fill(false), reach: -1 };
    // あと一本でそろう行があれば、最後のリールを少し長く回す
    if (n >= 3) for (let r = 0; r < 3; r++) if (runLen(s, r, n - 1) === n - 1) { BS.spin.reach = r; BS.spin.stops[n - 1] += 0.5; break; }
    A.play('click');
  }
  function scriptPos() {
    const s = S(), b = s.b;
    const bt = D.BATTLES[b.bid];
    if (b.kind !== 'battle' || !bt || bt.script !== 'tutorial' || s.flags.tutDone) return null;
    if (b.turn === 1) {
      BS.teach = { reel: 2, dir: 1, kind: 'tut1' };
      return [0, 1, 7];
    }
    if (b.turn === 2) {
      const f = G.findTeachSpin(s, (r0, r1) => r0.kills === 0 && r1.kills >= 1);
      if (f) { BS.teach = { reel: f.reel, dir: f.dir, kind: 'tut2', r1: f.r1 }; return f.pos; }
    }
    return null;
  }
  function teachPos() {
    const s = S(), b = s.b;
    if (b.kind !== 'battle' || b.turn !== 1) return null;
    for (const w of b.walls) {
      if (!w.id || w.broken || s.flags['tw_' + w.id]) continue;
      const id = w.id;
      const f = G.findTeachSpin(s, (r0, r1) => r0.walls.indexOf(id) < 0 && r1.walls.indexOf(id) >= 0);
      if (f) { s.flags['tw_' + id] = 1; BS.teach = { reel: f.reel, dir: f.dir, kind: 'wall', wall: w, r1: f.r1 }; return f.pos; }
    }
    if (s.reels.some(R => R.strip.some(c => c.nw))) {
      const f = G.findTeachSpin(s, (r0, r1) => !r0.newUsed && r1.newUsed && G.score(s, r1) > G.score(s, r0) + 4);
      if (f) { BS.teach = { reel: f.reel, dir: f.dir, kind: 'new', r1: f.r1 }; return f.pos; }
    }
    return null;
  }
  function stopSpinNow() { if (BS.spin) BS.spin.t = 99; }
  function finishSpin() {
    const s = S();
    BS.spin = null;
    s.reels.forEach((r, i) => { BS.vis[i] = nearest(BS.vis[i], r.pos, r.strip.length); });
    BS.predKey = '';
    const lines = G.lines(s);
    if (BS.teach) {
      const t = BS.teach, i = t.reel;
      const c = G.winCell(s, i, t.dir < 0 ? -1 : 3);
      const where = `${i + 1}本目のリールの${t.dir < 0 ? '上' : '下'}にはみ出した「${V.EL_NAME[c.k] || '空き'}」`;
      if (t.kind === 'tut1') BS.coach = { text: '横の行は、左から読む。同じ紋が2つ以上つづくと呪文になり、その段へ飛ぶ。\nいま中の行は「剣・剣」。' + where + 'を押すと窓に入って「剣×3」になり、力が2から6に伸びる。', reel: i, dir: t.dir };
      // 一コマずらすと、どの紋がどの行に入るか
      const R = s.reels[i];
      const ROWN = ['上', '中', '下'];
      const into = row => { const k = R.strip[mod(R.pos + t.dir + row, R.strip.length)].k; return `「${V.EL_NAME[k] || '空き'}」が${ROWN[row]}の行に入り`; };
      const press = `${i + 1}本目のリールの${t.dir < 0 ? '上' : '下'}の札を押すと、リールが一コマ${t.dir < 0 ? '下' : '上'}にずれて`;
      const keyRow = (r1, pred) => { const ev = r1 && r1.evs.find(pred); return ev ? ev.line.row : 1; };
      if (t.kind === 'tut2') BS.coach = { text: press + into(keyRow(t.r1, e => e.hits.some(h => h.kill))) + '、行がそろって魔物に届く。\n（はみ出した札を押すと、その紋が窓に入る。魔力を1使う。毎手番もどる）', reel: i, dir: t.dir };
      else if (t.kind === 'wall') BS.coach = { text: press + into(keyRow(t.r1, e => e.wall && e.wall.ok)) + '、行がそろう。魔物を貫いて、' + G.WALL[t.wall.kind].name + 'まで届く！', reel: i, dir: t.dir };
      else if (t.kind === 'new') BS.coach = { text: '刻んだ紋（新）を使える並び。' + press + into(keyRow(t.r1, e => e.line.cells.some(ci => { const RR = s.reels[ci]; const off = ci === i ? t.dir : 0; return RR.strip[mod(RR.pos + off + e.line.row, RR.strip.length)].nw; }))) + '、' + (t.r1.kills ? t.r1.kills + '体倒せる' : '力が伸びる') + '。', reel: i, dir: t.dir };
    }
    if (lines.length) A.play('line', { n: Math.max.apply(null, lines.map(l => l.n)) });
  }
  function nearest(cur, target, n) { const k = Math.round((cur - target) / n); return target + k * n; }

  // ---------- 見こみ ----------
  function predKey() { const s = S(); return s.reels.map(r => r.pos).join(',') + '|' + s.b.offs.join(',') + '|' + s.b.turn; }
  function ensurePred() {
    const s = S(), b = s.b;
    if (!b || b.phase !== 'aim' || BS.spin || BS.tl) { BS.pred = null; return null; }
    const k = predKey();
    if (k !== BS.predKey) { BS.pred = G.predict(s); BS.predKey = k; }
    return BS.pred;
  }
  function shiftReel(i, dir) {
    const s = S(), b = s.b;
    if (!BS || BS.spin || BS.tl || BS.over || !b || b.phase !== 'aim' || App.overlay) return;
    const before = G.lines(s).length;
    if (G.shift(s, i, dir)) {
      A.play('nudge', { dir: dir });
      BS.predKey = '';
      if (BS.coach && !(BS.coach.reel === i && BS.coach.dir === dir)) BS.coach = null;
      else if (BS.coach) BS.coach = { text: BS.coach.reel === i ? '見こみが変わった。魔物の上の「倒す」「−数字」、段の奥の壁の札を見て、「放つ」（スペース）。' : '', done: true };
      BS.hint = null;
      const ls = G.lines(s);
      if (ls.length > before || ls.some(l => l.n >= 3)) A.play('line', { n: Math.max(2, Math.max.apply(null, ls.map(l => l.n).concat([2]))) });
    } else {
      A.play('deny');
      toast('魔力が足りない（ずらしは魔力1につき一コマ。右クリックで全部もどせる）', 2.2);
    }
  }
  function resetShift() {
    const s = S();
    if (!BS || BS.spin || BS.tl || !s.b || s.b.phase !== 'aim') return;
    G.resetShift(s); BS.predKey = ''; A.play('click');
  }
  function showHint() {
    const s = S(), b = s.b;
    if (!b || b.phase !== 'aim' || BS.spin || BS.tl) return;
    const best = G.bestShift(s);
    if (!best) return;
    BS.hint = { offs: best.offs, res: best.res, t: 0 };
    const cur = b.offs;
    const parts = [];
    best.offs.forEach((o, i) => { const d = o - cur[i]; if (d) parts.push(`${i + 1}本目を${d < 0 ? '上' : '下'}の札で${Math.abs(d)}回`); });
    const r = best.res;
    BS.coach = { text: 'ヒント：' + (parts.length ? parts.join('、') : 'このまま放つのがいちばん') + ' → ' + resText(r) };
    A.play('chime', { i: 7 });
  }
  function resText(r) {
    const a = [];
    if (r.kills) a.push(r.kills + '体倒す');
    else if (r.dmg) a.push('合計 ' + r.dmg + ' の傷');
    for (const ev of r.evs) if (ev.wall) a.push(ev.wall.ok ? G.WALL[ev.wall.kind].name + 'が崩れる！' : (ev.wall.fits ? G.WALL[ev.wall.kind].name + 'に ' + ev.wall.power + '（' + ev.wall.th + '要る）' : ''));
    if (r.bossDead) a.push('主を倒す！');
    if (!r.evs.length) return '行がそろわない';
    return a.filter(x => x).join('・') || '当たらない';
  }

  // ======================================================================
  // 放つ
  // ======================================================================
  function doCast() {
    const s = S(), b = s.b;
    if (!b || b.phase !== 'aim' || BS.spin || BS.tl || BS.over) return;
    A.init();
    // ずらせばもっと効いたのに、何もせず放つとき（第一層だけ、一度だけ）
    if (b.kind === 'battle' && !BS.missNote && b.offs.every(o => !o) && (G.room(b.room).st || 1) === 1) {
      const cur = G.predict(s);
      const best = G.bestShift(s);
      if (best && best.v > G.score(s, cur) + 12) {
        BS.missNote = true;
        BS.coach = { text: 'このままでも放てるが、ずらすともっと効く並びがある（ヒント：H）。もう一度「放つ」でそのまま詠唱。' };
        A.play('deny');
        return;
      }
    }
    syncDM();
    const lines = G.lines(s);
    const res = G.cast(s);
    if (!res) return;
    BS.lastRes = res;
    BS.hint = null; BS.pred = null; BS.predKey = ''; BS.coach = null;
    if (b.kind === 'battle' && D.BATTLES[b.bid].script === 'tutorial' && b.turn >= 2) s.flags.tutDone = 1;
    BS.castLines = lines;
    playCast(res);
  }
  function TL() { return { t: 0, ev: [], end: 0, done: null }; }
  function at(tl, time, fn) { tl.ev.push({ at: time, fn: fn }); tl.ev.sort((a, c) => a.at - c.at); if (time > tl.end) tl.end = time; }
  function runTL(dt) {
    const tl = BS.tl;
    if (!tl) return;
    tl.t += dt;
    while (tl.ev.length && tl.ev[0].at <= tl.t) tl.ev.shift().fn();
    if (!tl.ev.length && tl.t >= tl.end) { BS.tl = null; BS.rush = false; if (tl.done) tl.done(); }
  }
  function playCast(res) {
    const tl = TL();
    let t0 = 0.06;
    let ki = 0, hi = 0;
    BS.lit = [[], [], []];
    if (!res.evs.length) {
      at(tl, 0.05, () => { A.play('deny'); BS.pops.push({ x: L.PX + 30, y: rowCY(1), text: '行がそろわなかった', col: '#d8c8b0', t: 0 }); });
      tl.end = 0.5;
    }
    for (const ev of res.evs) {
      const r = ev.line.row, el = ev.line.el, col = V.EL_COL[el];
      const ncell = ev.line.cells.length;
      ev.line.cells.forEach((ci, k) => at(tl, t0 + k * 0.04, () => { BS.lit[r][ci] = 1; A.play('chime', { i: 3 + k }); }));
      const ts = t0 + ncell * 0.04 + 0.03;
      const big = ev.line.power >= 20;
      const sx = L.PX + L.PW - 4, sy = hitY(r);
      at(tl, ts, () => { A.play('cast', { el: el, big: big }); BS.cast = 1; BS.plate[r] = 1; if (big) { BS.flash = Math.max(BS.flash, 0.35); BS.shake = Math.max(BS.shake, 0.25); } });
      const spd = el === 'bolt' ? 5200 : 2600;
      let endX = sx + 60;
      ev.hits.forEach(h => {
        const d = BS.dm[h.id];
        const hx = d ? d.x : 900;
        const tt = ts + Math.max(0.03, (hx - sx) / spd);
        endX = Math.max(endX, hx);
        at(tl, tt, () => applyHit(h, ev, h.kill ? ki++ : hi++));
      });
      if (ev.rem > 0) endX = L.WX + 50;
      if (!ev.hits.length && ev.rem <= 0) endX = L.WX + 50;
      const dur = Math.max(0.12, (endX - sx) / spd);
      at(tl, ts, () => BS.fx.push({ k: el === 'bolt' ? 'zap' : 'beam', el: el, col: col, sx: sx, sy: sy, ex: endX, t: 0, d: dur + 0.28, power: ev.line.power, n: ev.line.n, lane: r }));
      if (ev.wall) at(tl, ts + dur, () => wallHit(ev));
      else if (ev.out > 0) at(tl, ts + dur, () => { BS.fx.push({ k: 'dust', x: L.WX + 40, y: hitY(r), t: 0, d: 0.6, col: col }); A.play('block'); });
      if (ev.froze) at(tl, ts + dur + 0.02, () => A.play('freeze'));
      t0 = ts + dur + (big ? 0.24 : 0.1) + (ev.wall && ev.wall.ok ? (ev.wall.kind === 'final' ? 2.6 : 0.7) : 0);
    }
    if (res.fled && res.fled.length) at(tl, t0 + 0.05, () => {
      for (const id of res.fled) { const d = BS.dm[id]; if (d) d.flee = 1; }
      BS.big = { text: '主が倒れた！', sub: '取り巻きの魔物が逃げていく', t: 0, col: '#ffe9b0' };
      A.play('big'); BS.flash = 0.6;
    });
    const total = res.kills;
    at(tl, t0 + 0.1, () => {
      if (!res.walls.length && !(res.fled && res.fled.length)) {
        if (total >= 6) { BS.big = { text: `ごっそり ${total}体！`, sub: '一手で ' + res.dmg, t: 0, col: '#ffe27a' }; A.play('big'); BS.flash = 0.5; }
        else if (total >= 4) { BS.big = { text: `${total}体まとめて！`, sub: '', t: 0, col: '#ffe9b0', small: true }; A.play('big'); }
      }
    });
    tl.end = Math.max(tl.end, t0 + (res.walls.length ? 1.4 : (total >= 4 ? 0.55 : 0.15)));
    tl.done = () => afterCast(res);
    BS.tl = tl;
  }
  function applyHit(h, ev, idx) {
    const el = ev.line.el, col = V.EL_COL[el];
    const d = BS.dm[h.id];
    const x = d ? d.x : 900, y = d ? d.y - 34 : hitY(ev.line.row);
    if (d) {
      d.hp = Math.max(0, d.hp - h.dmg);
      d.flash = 0.16;
      if (h.kill) d.dying = 1;
    }
    BS.pops.push({ x: x, y: y - 20, text: h.dmg ? '−' + h.dmg : 'はじかれた', col: h.kill ? '#fff' : '#ffd6c0', t: 0, big: h.dmg >= 20 });
    if (h.m > 1) BS.pops.push({ x: x + 26, y: y - 44, text: '弱点！', col: col, t: -0.05, small: true });
    else if (h.m < 1) BS.pops.push({ x: x + 26, y: y - 44, text: '半分', col: '#c8c0b8', t: -0.05, small: true });
    if (h.kill) {
      A.play('kill', { i: idx });
      for (let i = 0; i < 9; i++) BS.fx.push({ k: 'spark', col: col, x: x, y: y, vx: (Math.random() - 0.5) * 280, vy: -Math.random() * 240, t: 0, d: 0.5 + Math.random() * 0.3 });
    } else if (h.dmg) A.play('hit', { i: idx });
    else A.play('block');
    BS.fx.push({ k: 'burst', col: col, x: x, y: y, t: 0, d: 0.25, r: 24 });
    if (d && ev.froze && !h.kill) d.frz = 1;
  }
  function wallHit(ev) {
    const w = ev.wall, l = w.lane;
    const v = BS.wv[l];
    const x = L.WX + L.WW * 0.55, y = rowCY(l);
    if (w.ok) {
      v.broken = true; v.t = 0;
      A.play('crumble');
      BS.shake = Math.max(BS.shake, 0.8); BS.flash = Math.max(BS.flash, 0.7);
      for (let i = 0; i < 26; i++) BS.fx.push({ k: 'rock', x: x + (Math.random() - 0.5) * 100, y: y + (Math.random() - 0.5) * 80, vx: -Math.random() * 260 + 40, vy: -Math.random() * 200, t: 0, d: 0.9 + Math.random() * 0.5, col: V.BG[D.BATTLES[S().b.bid] ? D.BATTLES[S().b.bid].bg : 'mine'].ledge });
      BS.fx.push({ k: 'rays', x: x, y: y, t: 0, d: 1.6 });
      const name = G.WALL[w.kind].name;
      const verb = { thorn: 'が燃え落ちた！', lake: 'が凍りついた！', gear: 'が動き出した！', seal: 'がとけた！', crack: 'が崩れた！', final: 'が崩れた！' }[w.kind] || 'が崩れた！';
      BS.big = { text: name + verb, sub: '奥に、新しい道が見えた', t: 0, col: '#ffe9b0', wall: true };
      if (w.kind === 'final') {
        // 最後の壁：空白の向こうの光
        BS.big = { text: '最後の壁が崩れた！', sub: '空白の向こうから、光があふれてくる', t: 0, col: '#fff2c0', wall: true, final: true };
        BS.whiteout = 0.01;
        setTimeout(() => A.play('reveal'), 500);
        setTimeout(() => A.play('big'), 1100);
        for (let i = 0; i < 60; i++) BS.fx.push({ k: 'spark', col: ['#fff2c0', '#b8d0ff', '#ffd8a0'][i % 3], x: x, y: y, vx: (Math.random() - 0.7) * 700, vy: (Math.random() - 0.5) * 500, t: 0, d: 1.2 + Math.random() * 0.8 });
        BS.fx.push({ k: 'rays', x: x, y: y, t: 0, d: 3.2 });
      }
      BS.opened.push(w.id);
      v.glimpse = glimpseOf(w.id);
      v.lightCol = { thorn: '255,200,120', lake: '170,230,255', gear: '255,226,120', seal: '255,246,190', crack: '255,226,150', final: '230,220,255' }[w.kind];
    } else if (w.fits) {
      v.shake = 0.4;
      A.play('clang');
      BS.pops.push({ x: x - 20, y: y - 50, text: w.kind === 'final' ? `ひびが広がった　あと ${w.th - (w.acc || 0) - w.power}` : `${w.power}　あと ${w.th - w.power}`, col: '#ffe0a0', t: 0 });
      BS.fx.push({ k: 'dust', x: x - 30, y: y, t: 0, d: 0.6, col: V.EL_COL[ev.line.el] });
    } else {
      v.shake = 0.25;
      A.play('block');
      const need = G.WALL[w.kind].need;
      BS.pops.push({ x: x - 20, y: y - 50, text: `はじかれた（${V.EL_NAME[need]}が要る）`, col: '#d8d0c8', t: 0 });
    }
  }
  function afterCast(res) {
    const s = S(), b = s.b;
    syncDM(); syncWalls();
    BS.lit = [[], [], []];
    if (b.kind === 'practice') {
      const c = BS.cmp;
      c.prev = c.last;
      c.last = { kills: res.kills, dmg: res.dmg, walls: res.walls.length, spin: b.lastSpin.slice(), reels: s.reels.map(r => r.strip.map(w => w.k + w.lv).join(',')).join('|'), cells: s.reels.map(r => r.strip.map(w => w.k + w.lv)) };
      App.cmp = c;
      G.nextTurn(s);
      BS.msg = practiceMsg();
      return;
    }
    if (b.kind === 'quiet') {
      G.nextTurn(s);
      if (res.walls.length) saveGame();
      if (!G.roomWalls(s, b.room).length) { BS.over = { kind: 'opened', t: 0 }; A.play('win'); }
      else BS.msg = readyMsg();
      return;
    }
    if (res.end === 'win') { victory(); return; }
    playEnemy();
  }
  // 前の試し詠唱から、組み替えたマス
  function changedCells() {
    const s = S(), c = BS && BS.cmp && BS.cmp.last;
    if (!c || !c.cells) return [];
    const out = [];
    s.reels.forEach((R, ri) => R.strip.forEach((w, ci) => { const o = c.cells[ri] && c.cells[ri][ci]; if (o !== w.k + w.lv && w.k !== 'gap') out.push({ ri: ri, ci: ci }); }));
    return out;
  }
  function changedSpin(ch) {
    const s = S();
    const base = BS.cmp.last.spin.slice();
    while (base.length < s.reels.length) base.push(0);
    base[ch.ri] = mod(ch.ci - 1, s.reels[ch.ri].strip.length);
    return base;
  }
  function practiceMsg() {
    const c = BS && BS.cmp;
    if (!c || !c.last) return '';
    const sum = x => `倒した ${x.kills}体・傷の合計 ${x.dmg}${x.walls ? '・壁が崩れた' : ''}`;
    let m = '今回：' + sum(c.last);
    if (c.prev && c.prev.spin.join() === c.last.spin.join()) {
      const changed = c.prev.reels !== c.last.reels;
      m = `同じ止まり方で比べると：${changed ? '組み替え前' : '前回'}　${sum(c.prev)}\n　　　　　　　　　　→ ${changed ? '組み替え後' : '今回'}　${sum(c.last)}`;
      if (changed) {
        const a = c.prev.kills * 100 + c.prev.dmg + c.prev.walls * 1000, z = c.last.kills * 100 + c.last.dmg + c.last.walls * 1000;
        m += z > a ? '　強くなった！' : (z < a ? '　前のほうが強かった' : '　変わらない（変えたマスが窓に入っていないかも）');
      }
    }
    return m;
  }

  // ---------- 魔物の手番 ----------
  function playEnemy() {
    const s = S(), b = s.b;
    const ev = G.enemyPhase(s);
    const tl = TL();
    let hits = 0;
    for (const e of ev) {
      const d = BS.dm[e.id];
      if (e.k === 'move') { if (d) { d.tx = colX(e.to); } }
      else if (e.k === 'atk') {
        const k = hits++;
        const tt = 0.06 + k * 0.12;
        if (e.ranged) {
          at(tl, tt, () => { if (d) BS.fx.push({ k: 'arrow', sx: d.x - 10, sy: d.y - 36, ex: L.HX + 10, ey: footY(1) - 40, t: 0, d: 0.25 }); A.play('arrow'); });
          at(tl, tt + 0.25, () => ouch(e.dmg));
        } else {
          at(tl, tt, () => { if (d) { d.lunge = 0.3; } });
          at(tl, tt + 0.14, () => ouch(e.dmg, e.big));
        }
      } else if (e.k === 'thaw') { if (d) d.frz = 0; }
      else if (e.k === 'rest') { if (d) BS.pops.push({ x: d.x, y: d.y - 86, text: 'ひと休み', col: '#c8c0b0', t: 0, small: true }); }
    }
    at(tl, 0.04, () => A.play('step'));
    const sp = ev.filter(e => e.k === 'spawn');
    if (sp.length) at(tl, 0.3 + hits * 0.16, () => { A.play('spawn'); if (sp.some(e => e.nest)) BS.pops.push({ x: L.WX + 40, y: L.Y - 8, text: '奥から魔物が出てきた', col: '#ffb0a0', t: 0, small: true }); });
    tl.end = 0.32 + hits * 0.12;
    tl.done = () => {
      syncDM();
      for (const e of sp) { const d = BS.dm[e.id]; if (d) { d.x = e.nest ? L.WX + 30 : colX(6); d.alpha = 0; } }
      if (b.phase === 'lose') { defeat(); return; }
      startTurn();
    };
    BS.tl = tl;
  }
  function ouch(dmg, big) {
    BS.hurt = 0.5; BS.shake = Math.max(BS.shake, big ? 0.7 : 0.35);
    A.play('ouch');
    BS.pops.push({ x: L.HX, y: footY(1) - 96, text: '−' + dmg, col: '#ff8a8a', t: 0, big: true });
  }
  function startTurn() {
    BS.pred = null; BS.predKey = '';
    BS.msg = '';
    if (cfg.auto) BS.autoT = 0.5;
  }

  // ---------- 勝ち・負け ----------
  function victory() {
    const s = S(), b = s.b;
    const got = G.winBattle(s);
    s.at = b.room;
    b.hp = s.hpMax;
    // ほうびでリールがふえたら、画面の状態もそろえる
    while (BS.vis.length < s.reels.length) BS.vis.push(s.reels[BS.vis.length].pos);
    while (b.offs.length < s.reels.length) b.offs.push(0);
    const R = G.room(b.room);
    BS.over = { kind: 'win', t: 0, got: got, kills: b.kills, best: b.best, turns: b.turn, remain: G.roomWalls(s, b.room).length, opened: BS.opened.slice() };
    A.play('win');
    BS.flash = 0.6;
    if (R.st === 4 && D.BATTLES[b.bid].final) BS.over.final = true;
    saveGame();
  }
  function defeat() {
    BS.over = { kind: 'lose', t: 0 };
    A.play('lose');
    saveGame();
  }
  function leaveBattle(focus) {
    const s = S();
    const opened = BS ? BS.opened.slice() : [];
    s.b = null;
    BS = null;
    saveGame();
    openMap({ opened: opened });
  }

  // ======================================================================
  // 地図
  // ======================================================================
  const MAPW = 900;
  function stOf(id) { return (G.room(id) && G.room(id).st) || 1; }
  function initMapSeen() {
    const s = S();
    App.seenK = new Set(); App.seenV = new Set();
    for (const id in D.ROOMS) { if (G.known(s, id)) App.seenK.add(id); if (G.visited(s, id)) App.seenV.add(id); }
  }
  function openMap(opt) {
    opt = opt || {};
    const s = S();
    App.scene = 'map';
    App.overlay = null;
    if (!App.map) {
      const y = clamp(G.room(s.at).y - 330, 0, D.MAP_H - H);
      App.map = { cam: y, tgt: y, walk: null, anim: {}, hover: null, shell: null, t: 0, follow: true };
    }
    const M = App.map;
    M.walk = null;
    if (!App.seenK) initMapSeen();
    // 新しく見えた部屋（壁の向こう）へカメラを向ける
    const fresh = [];
    for (const id in D.ROOMS) if (G.known(s, id) && !App.seenK.has(id)) fresh.push(id);
    if (fresh.length) {
      M.focus = { ids: fresh, t: 0 };
      const ys = fresh.map(id => G.room(id).y);
      M.tgt = clamp((Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2 - 330, 0, D.MAP_H - H);
      fresh.forEach((id, i) => { M.anim[id] = { k: 'sketch', t: -0.5 - i * 0.25 }; App.seenK.add(id); });
      setTimeout(() => A.play('sketch'), 400);
      M.shell = { text: fresh.some(id => G.room(id).hidden) ? '壁の向こうに、地図にない部屋だ！ 描きこんでおけよ。' : '道がひらけたな。', t: 0 };
    } else M.tgt = clamp(G.room(s.at).y - 330, 0, D.MAP_H - H);
    A.music('map' + stOf(s.at));
  }
  function roomAt(x, y) {
    const s = S(), M = App.map;
    if (x > MAPW) return null;
    const wy = y + M.cam;
    let best = null;
    for (const id in D.ROOMS) {
      if (!G.known(s, id)) continue;
      const r = D.ROOMS[id];
      const dx = (x - r.x) / (r.rx + 6), dy = (wy - r.y) / (r.ry + 6);
      if (dx * dx + dy * dy <= 1) best = id;
    }
    return best;
  }
  // 道さがし（たたかっていない部屋は通りぬけられない）
  const findPath = (from, to) => G.path(S(), from, to);
  function clickRoom(id) {
    const s = S(), M = App.map;
    if (M.walk || App.overlay) return;
    if (id === s.at) {
      roomAction(id);
      return;
    }
    const p = findPath(s.at, id);
    if (!p) {
      const why = blockedWhy(id);
      toast(why, 2.6); A.play('deny');
      return;
    }
    A.init();
    M.walk = { path: p, i: 0, t: 0 };
    M.follow = true;
  }
  function blockedWhy(id) {
    const s = S();
    for (const e of G.edges(id)) {
      const o = G.other(e, id);
      if (e.gate && !G.edgeOpen(s, e) && G.visited(s, o)) {
        const wd = Object.values(D.BATTLES).map(b => (b.walls || []).find(w => w && w.id === e.gate)).find(x => x);
        if (wd) return `${G.WALL[wd.kind].name}にさえぎられて行けない（${G.room(o).name}の戦場の奥。${wd.kind === 'crack' || wd.kind === 'final' ? 'どの紋でも' : V.EL_NAME[G.WALL[wd.kind].need] + 'の行で'} ${wd.th} 以上）`;
      }
    }
    return 'まだそこへの道が見つかっていない';
  }
  function roomAction(id) {
    const s = S();
    const R = G.room(id), st = G.rs(s, id);
    if (R.battle && !st.c) { startBattle(id); return; }
    if (R.items && !st.t) { openItems(id); return; }
    if (G.roomWalls(s, id).length) { startBattle(id, 'quiet'); return; }
  }
  function arrive(id) {
    const s = S(), M = App.map;
    const prev = s.at;
    const info = G.enterRoom(s, id);
    const R = G.room(id);
    if (info.first) {
      M.anim[id] = { k: 'bloom', t: 0 };
      App.seenV.add(id); App.seenK.add(id);
      A.play('reveal');
      info.revealed.forEach((o, i) => { if (!App.seenK.has(o)) { M.anim[o] = { k: 'sketch', t: -0.6 - i * 0.2 }; App.seenK.add(o); } });
      if (info.revealed.length) setTimeout(() => A.play('sketch'), 600);
      if (D.SHELL[id]) { M.shell = { text: D.SHELL[id], t: 0 }; setTimeout(() => A.play('shell'), 300); }
    }
    A.music('map' + stOf(id));
    if (R.battle && !G.rs(s, id).c) {
      s.at = prev;
      M.pending = { id: id, t: info.first ? 0.9 : 0.25 };
      saveGame();
      return;
    }
    saveGame();
    if (R.items && !G.rs(s, id).t) { M.pending = { id: id, t: info.first ? 0.7 : 0.1, items: true }; return; }
    if (R.kind === 'end') { M.pending = { id: id, t: 0.8, end: true }; return; }
  }
  function openItems(id) {
    App.overlay = { kind: 'items', room: id, t: 0 };
    A.play('pickup');
  }
  function takeItems() {
    const s = S(), o = App.overlay;
    const R = G.room(o.room);
    const got = [];
    for (const it of R.items) { G.gain(s, it); got.push(it); }
    G.rs(s, o.room).t = 1;
    saveGame();
    App.overlay = null;
    const runes = got.some(it => it.rune) || got.some(it => it.reel);
    if (runes) openEditor({ after: got });
    else if (got.some(it => it.forge)) toast('鍛え石を手に入れた。「詠唱輪を組む」で紋を鍛えられる', 3);
  }

  // ======================================================================
  // 詠唱輪を組む（重ねる画面）
  // ======================================================================
  function openEditor(opt) {
    App.overlay = { kind: 'editor', t: 0, held: null, forge: false, msg: '', after: opt && opt.after };
    A.play('page');
    const s = S();
    if (opt && opt.after && opt.after.some(it => it.rune)) {
      const k = opt.after.find(it => it.rune).rune;
      const has0 = s.reels[0].strip.some(c => c.k === k || c.k === 'star');
      App.overlay.msg = has0 ? `「${V.EL_NAME[k]}」をリールに刻もう。` : `「${V.EL_NAME[k]}」の行を作るには、1本目のリールにも「${V.EL_NAME[k]}」が要る（行は左から読む）。空きのマスに置こう。`;
    }
  }
  function closeEditor() {
    App.overlay = null;
    saveGame();
    if (BS && S().b) { BS.predKey = ''; S().reels.forEach((r, i) => { BS.vis[i] = r.pos + (S().b.offs[i] || 0); }); }
  }
  const ED = { X: 70, Y: 120, CW: 74, CH: 56, GAP: 16 };
  function edCellRect(ri, ci) { return { x: ED.X + ri * (ED.CW + ED.GAP), y: ED.Y + ci * (ED.CH + 2), w: ED.CW, h: ED.CH }; }
  function edBagRect(i) { const c = i % 7, r = Math.floor(i / 7); return { x: 548 + c * 70, y: 152 + r * 66, w: 64, h: 60 }; }
  function edClickCell(ri, ci) {
    const s = S(), o = App.overlay;
    const c = s.reels[ri].strip[ci];
    if (o.forge) {
      if (G.forgeUp(s, c)) { A.play('forge'); o.msg = `「${V.EL_NAME[c.k]}」を鍛えた（Lv${c.lv}）。行の力は、そろった紋の Lv の合計で決まる。`; if (!s.forge) o.forge = false; }
      else { A.play('deny'); o.msg = s.forge ? 'このマスは鍛えられない（空き・星・Lv3 は不可）' : '鍛え石がない'; }
      return;
    }
    if (o.held && o.held.from === 'bag') {
      const k = s.bag[o.held.i].k;
      G.place(s, o.held.i, ri, ci);
      A.play('place');
      o.held = null;
      o.msg = `${ri + 1}本目のリールに「${V.EL_NAME[k]}」を刻んだ。`;
      if (ri > 0 && !s.reels[0].strip.some(x => x.k === k || x.k === 'star')) o.msg += `　※1本目にも「${V.EL_NAME[k]}」がないと、この紋の行はできない。`;
      return;
    }
    if (o.held && o.held.from === 'reel') {
      if (o.held.ri === ri && o.held.ci === ci) { o.held = null; return; }
      G.swap(s, o.held.ri, o.held.ci, ri, ci);
      A.play('place');
      o.held = null;
      o.msg = '入れかえた。';
      return;
    }
    if (c.k === 'gap') { o.msg = '空きのマス。持ち物の紋を押してから、ここを押すと刻める。'; return; }
    o.held = { from: 'reel', ri: ri, ci: ci };
    A.play('click');
    o.msg = `「${V.EL_NAME[c.k]}」を持ち上げた。ほかのマスを押すと入れかわる。持ち物の欄を押すと外せる。`;
  }

  // ======================================================================
  // 物語・新しく始める
  // ======================================================================
  function startStory(lines, then, kind) { App.scene = 'story'; App.story = { lines: lines, i: 0, t: 0, then: then, kind: kind || 'intro' }; A.play('page'); }
  function storyNext() {
    const st = App.story;
    if (st.t < 0.25) return;
    st.i++; st.t = 0; A.play('page');
    if (st.i >= st.lines.length) { App.story = null; st.then(); }
  }
  function newGame(seed) {
    App.s = G.newGame(seed || URLSEED || ((Date.now() % 100000) + 1));
    App.map = null; App.seenK = null; App.cmp = null;
    store(SAVE, null);
    startStory(D.INTRO, () => { openMap(); App.map.shell = { text: D.SHELL.s1_in, t: 0 }; saveGame(); });
  }
  function continueGame() {
    const sv = load(SAVE);
    if (!sv) return;
    App.s = sv; App.s.b = null;
    App.map = null; App.seenK = null;
    openMap();
  }
  function confirmNew() {
    if (load(SAVE)) App.overlay = { kind: 'confirm', t: 0 };
    else { A.init(); newGame(); }
  }
  function startEnding() {
    rec.cleared = 1; saveRec();
    const s = S();
    s.flags.cleared = 1;
    saveGame();
    App.scene = 'story';
    startStory(D.ENDING, () => { App.scene = 'ending'; App.endT = 0; A.music('ending'); }, 'ending');
    A.music('ending');
  }

  // ======================================================================
  // 描画
  // ======================================================================
  function draw() {
    ctx.setTransform(SC * DPR, 0, 0, SC * DPR, 0, 0);
    App.frame = [];
    App.tips = [];
    App.drawLayer = 0;
    ctx.clearRect(0, 0, W, H);
    if (App.scene === 'title') drawTitle();
    else if (App.scene === 'story') drawStory();
    else if (App.scene === 'map') drawMap();
    else if (App.scene === 'battle') drawBattle();
    else if (App.scene === 'ending') drawEnding();
    if (App.overlay) { App.drawLayer = 1; drawOverlay(); }
    drawToast();
    drawTips();
    App.btns = App.frame;
  }
  function drawToast() {
    const t = App.toast;
    if (!t) return;
    const a = Math.min(1, t.t * 6, (t.dur - t.t) * 3);
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
    ctx.font = V.font(16, 600);
    const w = Math.min(1100, ctx.measureText(t.text).width + 40);
    V.panel(ctx, W / 2 - w / 2, 64, w, 40, { dark: true, r: 10 });
    V.text(ctx, t.text, W / 2, 84, { align: 'center', size: 16, color: '#ffeccc' });
    ctx.restore();
  }
  function drawTips() {
    const top = App.overlay ? 1 : 0;
    let hit = null;
    for (const t of App.tips) if (t.layer >= top && inside(App.mx, App.my, t)) hit = t;
    // 少しとどまってから出す。押したあとは、別のものに乗るまで出さない（盤面を隠さないように）
    const key = hit ? hit.title + '|' + Math.round(hit.x) + '|' + Math.round(hit.y) : null;
    if (key !== App.tipKey) { App.tipKey = key; App.tipStart = App.t; App.tipBlock = null; }
    if (!hit || App.tipBlock === key || App.t - App.tipStart < 0.5) return;
    ctx.font = V.font(14, 500);
    const lines = V.wrap(ctx, hit.text, 300);
    const w = 330, h = 40 + lines.length * 21;
    let x = App.mx + 18, y = App.my + 16;
    if (x + w > W - 6) x = App.mx - w - 12;
    if (y + h > H - 6) y = H - h - 6;
    V.panel(ctx, x, y, w, h, { dark: true, r: 8 });
    V.text(ctx, hit.title, x + 14, y + 20, { size: 15, weight: 700, color: '#ffe2a0' });
    lines.forEach((l, i) => V.text(ctx, l, x + 14, y + 44 + i * 21, { size: 14, color: '#f2e6d0' }));
  }
  function sysButtons(y) {
    y = y || 10;
    btn({ x: W - 150, y: y, w: 40, h: 34, label: '？', kind: 'ghost', size: 17, key: 'help', on: () => { App.overlay = { kind: 'help', page: 0, t: 0 }; A.play('page'); } });
    btn({ x: W - 104, y: y, w: 40, h: 34, label: cfg.mute ? '♪×' : '♪', kind: 'ghost', size: 16, key: 'mute', on: toggleMute });
    btn({ x: W - 58, y: y, w: 46, h: 34, label: '≡', kind: 'ghost', size: 20, key: 'menu', on: () => { App.overlay = { kind: 'menu', t: 0 }; A.play('click'); } });
  }
  function toggleMute() { cfg.mute = !cfg.mute; A.setMuted(cfg.mute); saveCfg(); if (!cfg.mute) { A.init(); A.play('click'); } }

  // ---------- タイトル ----------
  function drawTitle() {
    const t = App.t;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a3a5a'); g.addColorStop(0.35, '#1e1a16'); g.addColorStop(1, '#080606');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 地上と縦穴
    ctx.fillStyle = '#3a4a2a'; ctx.fillRect(0, 280, W, 14);
    ctx.fillStyle = '#2a2018';
    ctx.beginPath(); ctx.moveTo(0, 294); ctx.lineTo(560, 294); ctx.lineTo(590, 720); ctx.lineTo(0, 720); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, 294); ctx.lineTo(720, 294); ctx.lineTo(690, 720); ctx.lineTo(W, 720); ctx.fill();
    // 断面の部屋（遠くの灯り）
    const rooms = [[180, 360, 90, 34, '#7a8a4a'], [1040, 330, 80, 30, '#7a8a4a'], [260, 520, 110, 40, '#4a8ab0'], [990, 560, 100, 36, '#4a8ab0'], [150, 660, 80, 30, '#8a6ab0'], [1100, 680, 90, 30, '#8a6ab0']];
    for (const [x, y, rx, ry, c] of rooms) {
      ctx.fillStyle = '#100c0a'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
      const lg = ctx.createRadialGradient(x, y, 2, x, y, rx);
      lg.addColorStop(0, c + 'aa'); lg.addColorStop(1, c + '00');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
    }
    // 縦穴の奥の光
    const dg = ctx.createRadialGradient(640, 760, 10, 640, 760, 300);
    dg.addColorStop(0, `rgba(200,210,255,${0.35 + 0.1 * Math.sin(t)})`); dg.addColorStop(1, 'rgba(120,140,255,0)');
    ctx.fillStyle = dg; ctx.fillRect(400, 300, 480, 420);
    for (let i = 0; i < 30; i++) { const x = 600 + V.hash(i) * 80, y = 300 + ((V.hash(i + 3) * 420 + t * 20 * (0.5 + V.hash(i + 7))) % 420); ctx.fillStyle = 'rgba(220,230,255,.5)'; ctx.beginPath(); ctx.arc(x, y, 1.3, 0, 7); ctx.fill(); }
    // 縄ばしごとミオ
    ctx.strokeStyle = '#a07a40'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(628, 280); ctx.lineTo(628, 450); ctx.moveTo(652, 280); ctx.lineTo(652, 450); ctx.stroke();
    for (let y = 294; y < 450; y += 18) { ctx.beginPath(); ctx.moveTo(628, y); ctx.lineTo(652, y); ctx.stroke(); }
    V.mio(ctx, 596, 281, t, { s: 1.1 });
    V.text(ctx, 'がらり、迷宮ひらき', W / 2, 108, { align: 'center', size: 66, weight: 800, serif: true, color: '#ffe9b8', stroke: '#2a1a0a', sw: 8 });
    V.text(ctx, '― 詠唱輪と地図の空白 ―', W / 2, 168, { align: 'center', size: 24, weight: 600, serif: true, color: '#e8d6b0', stroke: '#1a1008', sw: 5 });
    const has = !!load(SAVE);
    const bx = W / 2 - 130;
    btn({ x: bx, y: 470, w: 260, h: 56, label: 'はじめから', kind: 'main', size: 22, key: 'new', on: () => { A.init(); confirmNew(); } });
    btn({ x: bx, y: 538, w: 260, h: 48, label: 'つづきから', disabled: !has, key: 'cont', on: () => { A.init(); continueGame(); } });
    btn({ x: bx, y: 598, w: 260, h: 42, label: 'あそびかた', kind: 'ghost', key: 'help', on: () => { A.init(); App.overlay = { kind: 'help', page: 0, t: 0 }; } });
    if (rec.cleared) V.text(ctx, '★ 底まで描いた', bx + 130, 660, { align: 'center', size: 15, color: '#ffe27a' });
    V.text(ctx, 'マウスで遊べる（キーボードも使える）・音が出ます（M で消音）', W / 2, 700, { align: 'center', size: 14, color: 'rgba(232,214,176,.7)' });
    sysButtons();
  }
  // ---------- 物語 ----------
  function drawStory() {
    const st = App.story, t = App.t;
    const ln = st.lines[st.i];
    if (st.kind === 'ending') drawSky(t);
    else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#3a2a1e'); g.addColorStop(1, '#120c08');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // 机と地図
      ctx.save(); ctx.translate(640, 300); ctx.rotate(-0.03);
      ctx.drawImage(V.paper(MAPW, H), 0, 0, 600, 480, -300, -170, 600, 300);
      ctx.strokeStyle = 'rgba(90,70,50,.6)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(-200 + (i % 3) * 200 + V.hash(i) * 40, -110 + Math.floor(i / 3) * 80, 50, 20, 0, 0, 7); ctx.stroke(); }
      ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.rect(-120, 92, 240, 34); ctx.stroke(); ctx.setLineDash([]);
      V.text(ctx, '？', 0, 108, { align: 'center', size: 22, serif: true, color: 'rgba(90,70,50,.7)' });
      ctx.restore();
      V.oldman(ctx, 300, 520, t, 1.6);
      V.mio(ctx, 980, 520, t, { s: 1.6, flip: true });
    }
    V.panel(ctx, 140, 548, 1000, 150, { dark: true });
    if (ln.who) V.text(ctx, ln.who, 170, 576, { size: 18, weight: 700, color: '#ffd98a', serif: true });
    const k = Math.min(ln.text.length, Math.floor(st.t * 40));
    V.para(ctx, ln.text.slice(0, k), 170, ln.who ? 600 : 584, 940, { size: 21, color: '#f6ead2', serif: true, lh: 34 });
    V.text(ctx, 'クリック／スペースで次へ　（Esc でとばす）', 1120, 684, { align: 'right', size: 13, color: 'rgba(255,236,200,.5)' });
    btn({ x: 0, y: 0, w: W, h: H, invisible: true, key: 'story', on: storyNext });
  }
  function drawSky(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1440'); g.addColorStop(0.6, '#1a2a6a'); g.addColorStop(1, '#2a3a5a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
      const x = V.hash(i * 3.3) * W, y = V.hash(i * 1.7) * 430;
      const a = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.5 + V.hash(i)) + i));
      ctx.fillStyle = `rgba(${200 + V.hash(i + 1) * 55},${220},255,${a})`;
      ctx.beginPath(); ctx.arc(x, y, 0.8 + V.hash(i + 2) * 2, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(150,220,255,.5)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-20, 470); ctx.bezierCurveTo(300, 420, 600, 520, 1300, 450); ctx.stroke();
    ctx.fillStyle = '#0a0a14';
    ctx.beginPath(); ctx.moveTo(0, 720); ctx.lineTo(0, 500); ctx.quadraticCurveTo(300, 470, 520, 520); ctx.quadraticCurveTo(820, 560, 1280, 490); ctx.lineTo(1280, 720); ctx.fill();
    V.mio(ctx, 640, 528, t, { s: 1.3 });
  }

  // ---------- 地図 ----------
  function drawMap() {
    const s = S(), M = App.map, t = App.t;
    ctx.drawImage(V.paper(MAPW, H), 0, 0);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, MAPW, H); ctx.clip();
    ctx.translate(0, -M.cam);
    // 層の帯
    for (const st of D.STRATA) {
      ctx.fillStyle = st.col + '14'; ctx.fillRect(0, st.y0, MAPW, st.y1 - st.y0);
      ctx.strokeStyle = 'rgba(110,90,60,.25)'; ctx.setLineDash([2, 6]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(10, st.y0); ctx.lineTo(MAPW - 10, st.y0); ctx.stroke(); ctx.setLineDash([]);
      V.text(ctx, st.name, 18, st.y0 + 20, { size: 15, weight: 700, serif: true, color: 'rgba(90,64,36,.55)' });
    }
    // 地上
    ctx.fillStyle = 'rgba(90,110,60,.35)'; ctx.fillRect(0, 0, MAPW, 60);
    V.text(ctx, '地上（師匠の家）', 452, 30, { align: 'center', size: 14, serif: true, color: 'rgba(70,60,40,.7)' });
    ctx.strokeStyle = 'rgba(90,70,40,.6)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(440, 60); ctx.lineTo(440, 112); ctx.stroke(); ctx.setLineDash([]);
    // 空白
    drawBlank(t);
    // 道
    for (const e of D.EDGES) drawEdge(e, t);
    // 部屋
    for (const id in D.ROOMS) drawRoom(id, t);
    // ミオ
    const spot = r => ({ x: r.x + r.rx * 0.74, y: r.y + r.ry * 0.7 });
    let p0 = spot(G.room(s.at));
    let mx = p0.x, my = p0.y;
    if (M.walk) {
      const p = M.walk.path, a = spot(G.room(p[M.walk.i])), b = spot(G.room(p[Math.min(p.length - 1, M.walk.i + 1)]));
      const k = ease(M.walk.t / 0.34);
      mx = a.x + (b.x - a.x) * k; my = a.y + (b.y - a.y) * k;
    } else if (M.pending) { const q = spot(G.room(M.pending.id)); mx = q.x; my = q.y; }
    V.mio(ctx, mx, my, t, { s: 0.6 });
    // 新しく見えた部屋に印
    if (M.focus && M.focus.t < 4.5) {
      for (const id of M.focus.ids) {
        const r = G.room(id);
        const k = clamp(M.focus.t - 0.5, 0, 4);
        if (k <= 0) continue;
        const a = clamp(Math.min(k * 2, (4 - k) * 1.5), 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        const pulse = 1 + 0.08 * Math.sin(t * 6);
        ctx.strokeStyle = '#e8a020'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, (r.rx + 14) * pulse, (r.ry + 12) * pulse, 0, 0, 7); ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const ang = t * 1.2 + i * Math.PI / 3;
          const sx = r.x + Math.cos(ang) * (r.rx + 22), sy = r.y + Math.sin(ang) * (r.ry + 18);
          ctx.fillStyle = '#f0b030';
          ctx.beginPath(); for (let q = 0; q < 8; q++) { const aa = q * Math.PI / 4, rad = q % 2 ? 2 : 6; ctx.lineTo(sx + Math.cos(aa) * rad, sy + Math.sin(aa) * rad); } ctx.closePath(); ctx.fill();
        }
        V.text(ctx, '新しく見えた！', r.x, r.y - r.ry - 22, { align: 'center', size: 17, weight: 800, serif: true, color: '#8a4a10', stroke: 'rgba(250,240,210,.9)', sw: 4 });
        ctx.restore();
      }
    }
    // 鉛筆で描きこまれていく先
    for (const id in M.anim) {
      const an = M.anim[id];
      if (an.k !== 'sketch' || an.t < 0 || an.t > 0.7) continue;
      const r = G.room(id), k = an.t / 0.6;
      const ang = -Math.PI / 2 + k * Math.PI * 2;
      const px = r.x + Math.cos(ang) * r.rx, py = r.y + Math.sin(ang) * r.ry;
      ctx.save(); ctx.translate(px, py); ctx.rotate(-0.6);
      ctx.fillStyle = '#c89a3a'; ctx.fillRect(-3, -22, 6, 18);
      ctx.fillStyle = '#3a2a18'; ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(3, -4); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // 上の帯
    const st = D.STRATA[stOf(s.at) - 1];
    ctx.fillStyle = 'rgba(240,226,196,.0)';
    V.text(ctx, '部屋を押すと歩く・ホイールやドラッグで地図を上下に動かせる', 14, H - 16, { size: 13, color: 'rgba(80,60,40,.75)' });
    drawMapPanel(st);
    // 部屋の説明
    const hv = App.overlay ? null : roomAt(App.mx, App.my);
    M.hover = hv;
    if (hv) {
      const r = G.room(hv);
      tip(r.x - r.rx, r.y - r.ry - M.cam, r.rx * 2, r.ry * 2, roomTitle(hv), roomDesc(hv));
    }
  }
  function roomTitle(id) { const s = S(); return G.visited(s, id) || G.room(id).pre ? G.room(id).name : '？（まだ見ていない部屋）'; }
  function roomDesc(id) {
    const s = S(), R = G.room(id), st = G.rs(s, id);
    const a = [];
    if (!G.visited(s, id)) {
      if (R.note && R.pre) a.push('師匠のメモ：「' + R.note + '」');
      if (R.lookText) a.push('気配：' + R.lookText);
      if (R.battle) a.push('魔物の気配がする');
      if (R.items && !R.pre) a.push('何かありそうだ');
    } else {
      if (R.battle && !st.c) a.push('魔物がいる。押すと戦いに挑む');
      if (R.battle && st.c) a.push('魔物は追いはらった');
      if (R.items && !st.t) a.push('まだ調べていない宝がある');
      const ws = G.roomWalls(s, id);
      for (const w of ws) a.push(`崩していない壁：${G.WALL[w.kind].name}（${w.kind === 'crack' || w.kind === 'final' ? 'どの紋でも' : V.EL_NAME[G.WALL[w.kind].need] + 'の行で'} ${w.th} 以上）`);
      if (ws.length && st.c) a.push('いまいる部屋なら、押すと静かに壁を狙える');
    }
    const p = findPath(s.at, id);
    if (!p && id !== s.at) a.push('（いまは行けない）');
    return a.join('\n') || '何もない部屋';
  }
  function drawBlank(t) {
    const s = S();
    const r = G.room('s4_blank');
    if (G.visited(s, 's4_blank')) return;
    ctx.save();
    ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(90,70,50,.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.rx, r.ry, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    V.text(ctx, '空 白', r.x, r.y - 6, { align: 'center', size: 34, serif: true, weight: 700, color: 'rgba(90,70,50,.35)' });
    V.text(ctx, '師匠のメモ：「底は、見たやつが描け」', r.x, r.y + 34, { align: 'center', size: 14, serif: true, color: 'rgba(90,70,50,.6)' });
    ctx.restore();
  }
  function edgePts(e) {
    const a = G.room(e.a), b = G.room(e.b);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const pa = { x: a.x + Math.cos(ang) * a.rx * 0.85, y: a.y + Math.sin(ang) * a.ry * 0.85 };
    const pb = { x: b.x - Math.cos(ang) * b.rx * 0.85, y: b.y - Math.sin(ang) * b.ry * 0.85 };
    return [pa, pb];
  }
  function drawEdge(e, t) {
    const s = S(), M = App.map;
    const ka = G.known(s, e.a), kb = G.known(s, e.b);
    const va = G.visited(s, e.a), vb = G.visited(s, e.b);
    const pre = G.room(e.a).pre && G.room(e.b).pre && !G.room(e.a).hidden && !G.room(e.b).hidden;
    const open = G.edgeOpen(s, e);
    const [pa, pb] = edgePts(e);
    // 門の向こうがまだ地図にないとき：壁の手前まで短い線
    if (e.gate && !(ka && kb)) {
      const near = va ? pa : (vb ? pb : null), far = va ? pb : pa;
      if (!near) return;
      const roomWithWall = va ? e.a : e.b;
      if (!G.rs(s, roomWithWall).c && !G.room(roomWithWall).battle) return;
      const mx = near.x + (far.x - near.x) * 0.4, my = near.y + (far.y - near.y) * 0.4;
      ctx.strokeStyle = 'rgba(90,70,50,.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(near.x, near.y); ctx.lineTo(mx, my); ctx.stroke(); ctx.setLineDash([]);
      const wk = gateKind(e.gate);
      V.gateMark(ctx, wk, mx, my, t, false);
      return;
    }
    if (!(ka && kb) && !pre) return;
    if (!ka && !kb) return;
    const ink = va && vb && open;
    const an = (M.anim[e.a] && M.anim[e.a].k === 'sketch') ? M.anim[e.a] : (M.anim[e.b] && M.anim[e.b].k === 'sketch' ? M.anim[e.b] : null);
    const k = an ? clamp(an.t / 0.6, 0, 1) : 1;
    if (k <= 0) return;
    const ex = pa.x + (pb.x - pa.x) * k, ey = pa.y + (pb.y - pa.y) * k;
    if (e.shaft) {
      ctx.strokeStyle = ink ? '#6a4626' : 'rgba(90,80,70,.5)'; ctx.lineWidth = ink ? 2.2 : 1.3;
      if (!ink) ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(pa.x - 6, pa.y); ctx.lineTo(ex - 6, ey); ctx.moveTo(pa.x + 6, pa.y); ctx.lineTo(ex + 6, ey); ctx.stroke();
      ctx.setLineDash([]);
      const len = Math.hypot(ex - pa.x, ey - pa.y);
      for (let d = 10; d < len; d += 16) { const q = d / Math.max(1, Math.hypot(pb.x - pa.x, pb.y - pa.y)); const x = pa.x + (pb.x - pa.x) * q, y = pa.y + (pb.y - pa.y) * q; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.stroke(); }
    } else if (ink) {
      ctx.strokeStyle = 'rgba(70,46,24,.85)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = 'rgba(232,212,170,.95)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.lineCap = 'butt';
    } else {
      ctx.strokeStyle = 'rgba(90,80,70,.55)'; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
    }
    if (e.gate) {
      const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
      if (e.ice && open) { ctx.strokeStyle = 'rgba(120,200,240,.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke(); }
      V.gateMark(ctx, gateKind(e.gate), mx, my, t, open);
    }
  }
  function gateKind(wid) {
    for (const k in D.BATTLES) { const w = (D.BATTLES[k].walls || []).find(x => x && x.id === wid); if (w) return w.kind; }
    return 'crack';
  }
  function drawRoom(id, t) {
    const s = S(), M = App.map;
    const r = G.room(id);
    if (id === 's4_blank' && !G.visited(s, id)) return;
    if (!G.known(s, id)) return;
    const vis = G.visited(s, id);
    const an = M.anim[id];
    let k = 1, bloom = 1;
    if (an && an.k === 'sketch') k = clamp(an.t / 0.6, 0, 1);
    if (an && an.k === 'bloom') bloom = clamp(an.t / 1.1, 0, 1);
    if (k <= 0) return;
    const stc = D.STRATA[r.st - 1];
    const hot = M.hover === id;
    ctx.save();
    if (vis) {
      // 水彩でにじむ
      const kb = ease(bloom);
      V.blobPath(ctx, r, 0.4 + 0.6 * kb);
      const g = ctx.createRadialGradient(r.x - r.rx * 0.2, r.y - r.ry * 0.3, 2, r.x, r.y, r.rx * 1.1);
      g.addColorStop(0, stc.col + 'aa'); g.addColorStop(1, stc.col + '55');
      ctx.globalAlpha = kb;
      ctx.fillStyle = g; ctx.fill();
      ctx.globalAlpha = 1;
      V.blobPath(ctx, r, 1);
      ctx.strokeStyle = stc.ink; ctx.lineWidth = hot ? 3.4 : 2.4;
      if (bloom < 1) { ctx.setLineDash([r.rx * 7 * bloom, 999]); }
      ctx.stroke(); ctx.setLineDash([]);
      if (bloom < 1 && an.t < 1.4) {
        ctx.globalAlpha = 1 - bloom;
        ctx.strokeStyle = 'rgba(255,240,200,.9)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, r.rx * (1 + bloom * 0.4), r.ry * (1 + bloom * 0.4), 0, 0, 7); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      V.text(ctx, r.name, r.x, r.y - r.ry * 0.2, { align: 'center', size: 16, weight: 700, serif: true, color: '#2e2012', stroke: 'rgba(240,226,196,.8)', sw: 3 });
      const st = G.rs(s, id);
      const icons = [];
      if (r.battle && !st.c) icons.push(D.BATTLES[r.battle].boss ? 'boss' : 'foe');
      if (r.items && !st.t) icons.push('chest');
      if (G.roomDone(s, id) && (r.battle || r.items)) icons.push('done');
      icons.forEach((ic, i) => V.roomIcon(ctx, ic, r.x + (i - (icons.length - 1) / 2) * 30, r.y + r.ry * 0.36, t));
      if (G.roomWalls(s, id).length && st.c) {
        V.text(ctx, '壁が残っている', r.x, r.y + r.ry + 12, { align: 'center', size: 12, color: 'rgba(120,60,30,.85)' });
      }
    } else if (r.pre) {
      ctx.globalAlpha = k;
      V.blobPath(ctx, r, 1);
      ctx.strokeStyle = hot ? 'rgba(80,60,40,.9)' : 'rgba(90,80,70,.6)'; ctx.lineWidth = hot ? 2 : 1.3; ctx.stroke();
      V.text(ctx, r.name, r.x, r.y - 6, { align: 'center', size: 15, weight: 600, serif: true, color: 'rgba(70,60,50,.75)' });
      if (r.note) {
        ctx.font = V.font(12, 500, true);
        const lines = V.wrap(ctx, r.note, r.rx * 2 + 70);
        lines.slice(0, 3).forEach((l, i) => V.text(ctx, l, r.x, r.y + 14 + i * 15, { align: 'center', size: 12, serif: true, color: 'rgba(80,74,66,.8)' }));
      }
      if (r.battle) V.roomIcon(ctx, D.BATTLES[r.battle].boss ? 'boss' : 'foe', r.x + r.rx - 16, r.y - r.ry + 10, t);
    } else {
      ctx.globalAlpha = k;
      V.blobPath(ctx, r, 1);
      ctx.fillStyle = 'rgba(110,90,60,.08)'; ctx.fill();
      ctx.strokeStyle = hot ? 'rgba(80,60,40,.9)' : 'rgba(90,80,70,.55)'; ctx.lineWidth = hot ? 2 : 1.3; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
      V.lookIcon(ctx, r.look || (r.battle ? 'foe' : '?'), r.x, r.y - 8, t);
      if (r.battle && !r.look) V.roomIcon(ctx, 'foe', r.x, r.y - 8, t);
      if (r.lookText) V.text(ctx, r.lookText, r.x, r.y + 16, { align: 'center', size: 12, serif: true, color: 'rgba(80,64,44,.8)' });
    }
    ctx.restore();
  }
  function drawMapPanel(st) {
    const s = S(), M = App.map, t = App.t;
    const X = MAPW, PW = W - MAPW;
    const g = ctx.createLinearGradient(X, 0, W, 0);
    g.addColorStop(0, '#2a2018'); g.addColorStop(1, '#1a140f');
    ctx.fillStyle = g; ctx.fillRect(X, 0, PW, H);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(X, 0, 6, H);
    V.text(ctx, st.name, X + 22, 70, { size: 21, weight: 800, serif: true, color: '#ffe2a8' });
    let nv = 0, nh = 0, nhv = 0;
    const ids = Object.keys(D.ROOMS);
    for (const id of ids) { if (G.visited(s, id)) nv++; if (D.ROOMS[id].hidden) { nh++; if (G.visited(s, id)) nhv++; } }
    V.text(ctx, `描いた部屋 ${nv} / ${ids.length}　　隠し部屋 ${nhv} / ${nh}`, X + 22, 102, { size: 14, color: '#d8c8a8' });
    // 伝声貝
    V.panel(ctx, X + 14, 120, PW - 28, 120, { r: 10 });
    V.shell(ctx, X + 40, 146, 14);
    V.text(ctx, '師匠（伝声貝）', X + 62, 146, { size: 13, weight: 700, color: '#6a4a2a' });
    if (M.shell) {
      const k = Math.min(M.shell.text.length, Math.floor(M.shell.t * 36));
      V.para(ctx, M.shell.text.slice(0, k), X + 30, 164, PW - 60, { size: 15, color: '#3a2a18', serif: true, lh: 22 });
    } else V.text(ctx, '……', X + 30, 176, { size: 15, color: '#8a7a60' });
    // いる部屋
    const R = G.room(s.at), rs = G.rs(s, s.at);
    V.text(ctx, 'いる部屋：' + R.name, X + 22, 266, { size: 16, weight: 700, color: '#f0e0c0' });
    const ws = G.roomWalls(s, s.at);
    let by = 286;
    if (ws.length && rs.c) {
      const w = ws[0];
      V.text(ctx, `${G.WALL[w.kind].name}が残っている（${w.kind === 'crack' || w.kind === 'final' ? 'どの紋でも' : V.EL_NAME[G.WALL[w.kind].need] + 'の行で'} ${w.th} 以上）`, X + 22, by + 8, { size: 13, color: '#e8c890' });
      btn({ x: X + 22, y: by + 22, w: PW - 44, h: 38, label: '壁を狙って詠唱する', kind: 'blue', size: 16, key: 'quiet', on: () => startBattle(s.at, 'quiet') });
      by += 68;
    }
    // 詠唱輪
    const top = by + 10;
    V.text(ctx, '詠唱輪', X + 22, top + 8, { size: 15, weight: 700, color: '#ffe2a8' });
    V.text(ctx, `魔力 ${s.mpMax}・心 ${s.hpMax}・鍛え石 ${s.forge}`, X + PW - 22, top + 8, { align: 'right', size: 13, color: '#d8c8a8' });
    const n = s.reels.length, cw = 36, ch = 25;
    const gx = X + (PW - n * (cw + 6)) / 2;
    s.reels.forEach((R2, i) => {
      R2.strip.forEach((c, j) => V.rune(ctx, c, gx + i * (cw + 6), top + 22 + j * (ch + 1), cw, ch, t, { label: false, name: false, newMark: false }));
    });
    tip(gx, top + 22, n * (cw + 6), 8 * (ch + 1), '詠唱輪', 'リールの紋の並び（上から下へ、くるりと一周）。戦いでは、このうち3つずつが窓に出る。');
    const bagN = s.bag.length;
    const newIn = s.bag.some(c => c.nw);
    btn({ x: X + 22, y: 610, w: PW - 44, h: 46, label: '詠唱輪を組む', sub: bagN ? `持ち物の紋 ${bagN}` : '', kind: newIn ? 'main' : undefined, glow: newIn, size: 18, key: 'editor', on: () => openEditor() });
    btn({ x: X + 22, y: 664, w: (PW - 52) / 2, h: 36, label: 'あそびかた', kind: 'ghost', size: 14, key: 'help', on: () => { App.overlay = { kind: 'help', page: 0, t: 0 }; } });
    btn({ x: X + 30 + (PW - 52) / 2, y: 664, w: (PW - 52) / 2, h: 36, label: 'メニュー', kind: 'ghost', size: 14, key: 'menu', on: () => { App.overlay = { kind: 'menu', t: 0 }; } });
    btn({ x: W - 96, y: 14, w: 40, h: 32, label: cfg.mute ? '♪×' : '♪', kind: 'ghost', size: 15, key: 'mute', on: toggleMute });
    btn({ x: W - 50, y: 14, w: 40, h: 32, label: '≡', kind: 'ghost', size: 18, key: 'menu2', on: () => { App.overlay = { kind: 'menu', t: 0 }; } });
    // 地図の部屋のボタン（押せる場所）
    for (const id in D.ROOMS) {
      if (!G.known(s, id)) continue;
      const r = D.ROOMS[id];
      const y = r.y - M.cam;
      if (y < -r.ry || y > H + r.ry) continue;
      App.frame.push({ x: r.x - r.rx, y: y - r.ry, w: r.rx * 2, h: r.ry * 2, invisible: true, key: 'room_' + id, layer: 0, room: id, on: () => clickRoom(id), ell: true });
    }
  }

  // ---------- 戦い ----------
  function drawBattle() {
    const s = S(), b = s.b, t = App.t;
    const bt = D.BATTLES[b.bid] || { bg: 'mine' };
    ctx.save();
    if (BS.shake > 0) ctx.translate((Math.random() - 0.5) * 14 * BS.shake, (Math.random() - 0.5) * 10 * BS.shake);
    V.battleBg(ctx, bt.bg || D.STRATA[stOf(b.room) - 1].bg, F, t);
    if (bt.final) {
      const heart = b.en.find(e => e.t === 'heart');
      const alive = b.kind === 'battle' && heart && heart.hp > 0;
      BS.gAlpha = BS.gAlpha === undefined ? 1 : BS.gAlpha + ((alive ? 1 : 0) - BS.gAlpha) * 0.04;
      V.guardian(ctx, 1010, 330, t, BS.gAlpha);
    }
    const pred = ensurePred();
    drawWalls(pred);
    drawPreview(pred);
    drawEnemies(pred);
    V.mio(ctx, L.HX, footY(1), t, { s: 1.15, cast: BS.cast, hurt: BS.hurt > 0 });
    drawFx();
    drawReels(pred);
    drawPlates(pred);
    drawPops();
    ctx.restore();
    if (BS.flash > 0) { ctx.fillStyle = `rgba(255,246,220,${BS.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
    if (BS.whiteout) {
      const k = clamp(BS.whiteout, 0, 1);
      const rg = ctx.createRadialGradient(L.WX + 90, rowCY(1), 10, L.WX + 90, rowCY(1), 200 + k * 1200);
      rg.addColorStop(0, `rgba(255,250,235,${0.95 * k})`); rg.addColorStop(0.5, `rgba(220,230,255,${0.6 * k})`); rg.addColorStop(1, 'rgba(200,210,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }
    drawTop();
    drawBottom(pred);
    drawBanner();
    drawBig();
    if (BS.over) drawOver();
  }
  function drawTop() {
    const s = S(), b = s.b;
    const g = ctx.createLinearGradient(0, 0, 0, 56);
    g.addColorStop(0, 'rgba(10,8,6,.85)'); g.addColorStop(1, 'rgba(10,8,6,.4)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 56);
    const R = G.room(b.room);
    const title = b.kind === 'practice' ? '試し詠唱' : (R ? R.name : '');
    V.text(ctx, title, 24, 28, { size: 22, weight: 800, serif: true, color: '#ffe2a8' });
    if (b.kind === 'battle') V.text(ctx, `${b.turn}手番`, 24 + ctx.measureText(title).width + 22, 30, { size: 15, color: '#d8c8a8' });
    // 心と魔力
    if (b.kind === 'battle') {
      for (let i = 0; i < s.hpMax; i++) V.heart(ctx, 360 + i * 26, 28, 9, i < b.hp);
    }
    const mx = 360 + (b.kind === 'battle' ? s.hpMax * 26 + 30 : 0);
    V.text(ctx, '魔力', mx, 28, { size: 14, color: '#bcd8ff' });
    const mpAll = G.mpOf(s);
    for (let i = 0; i < mpAll; i++) V.orb(ctx, mx + 44 + i * 22, 28, 8, i < b.mp, App.t);
    if (b.mpBonus) V.text(ctx, '静かな部屋 +' + b.mpBonus, mx + 52 + mpAll * 22, 28, { size: 12, color: '#bcd8ff' });
    V.text(ctx, 'そろう数：2つ×1・3つ×2・4つ×4・5つ×8', 1118, 28, { align: 'right', size: 13, color: 'rgba(232,214,176,.75)' });
    tip(mx, 14, 44 + mpAll * 22, 28, '魔力', 'はみ出した札を押して一コマずらすたびに1使う。毎手番、満タンにもどる。');
    if (b.kind === 'battle') tip(350, 14, s.hpMax * 26 + 10, 28, '心', 'ミオの体力。魔物がミオの前まで来ると減る。なくなると逃げ帰る（地図にもどり、また挑める）。');
    sysButtons(11);
  }
  function drawReels(pred) {
    const s = S(), b = s.b, t = App.t;
    const n = s.reels.length;
    const x0 = reelX(0) - 10, x1 = L.RX1 + 4;
    // 枠
    ctx.save();
    V.rr(ctx, x0, L.Y - L.PK - 14, x1 - x0, L.RH * 3 + L.PK * 2 + 28, 14);
    ctx.fillStyle = 'rgba(30,20,14,.88)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#8a6a3c'; ctx.stroke();
    ctx.restore();
    const aiming = b.phase === 'aim' && !BS.spin && !BS.tl && !BS.over;
    const litPred = [[], [], []];
    if (pred) for (const ev of pred.evs) for (const ci of ev.line.cells) litPred[ev.line.row][ci] = 1;
    for (let i = 0; i < n; i++) {
      const R = s.reels[i];
      const x = reelX(i);
      const Ln = R.strip.length;
      // 窓
      ctx.save();
      ctx.beginPath(); ctx.rect(x, L.Y, L.RW, L.RH * 3); ctx.clip();
      ctx.fillStyle = '#16100c'; ctx.fillRect(x, L.Y, L.RW, L.RH * 3);
      const v = BS.vis[i] !== undefined && isFinite(BS.vis[i]) ? BS.vis[i] : R.pos;
      const base = Math.floor(v), fr = v - base;
      const spinning = BS.spin && !BS.spin.done[i];
      for (let k = -1; k <= 3; k++) {
        const c = R.strip[mod(base + k, Ln)];
        const y = L.Y + (k - fr) * L.RH;
        const row = Math.round(k - fr);
        const lit = !spinning && row >= 0 && row < 3 && ((BS.lit[row] && BS.lit[row][i]) || (aiming && litPred[row][i]));
        V.rune(ctx, c, x, y, L.RW, L.RH, t, { lit: lit, alpha: spinning ? 0.75 : 1 });
      }
      if (spinning) {
        const sg = ctx.createLinearGradient(0, L.Y, 0, L.Y + L.RH * 3);
        sg.addColorStop(0, 'rgba(20,14,10,.8)'); sg.addColorStop(0.2, 'rgba(20,14,10,0)'); sg.addColorStop(0.8, 'rgba(20,14,10,0)'); sg.addColorStop(1, 'rgba(20,14,10,.8)');
        ctx.fillStyle = sg; ctx.fillRect(x, L.Y, L.RW, L.RH * 3);
        if (BS.spin.reach >= 0 && i === n - 1 && BS.spin.done[n - 2]) { ctx.fillStyle = `rgba(255,220,120,${0.15 + 0.12 * Math.sin(t * 20)})`; ctx.fillRect(x, L.Y, L.RW, L.RH * 3); }
      }
      ctx.restore();
      if (BS.stopFlash[i] > 0) { ctx.fillStyle = `rgba(255,240,200,${BS.stopFlash[i] * 0.4})`; ctx.fillRect(x, L.Y, L.RW, L.RH * 3); }
      ctx.strokeStyle = 'rgba(200,160,100,.4)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, L.Y + 0.5, L.RW - 1, L.RH * 3 - 1);
      if (R.nw) V.text(ctx, '新', x + L.RW / 2, L.Y - L.PK - 24, { align: 'center', size: 13, weight: 800, color: '#ff8a6a' });
      // はみ出した札（押すと入る）
      if (!BS.spin) {
        const off = b.offs[i] || 0;
        const up = R.strip[mod(R.pos + off - 1, Ln)], dn = R.strip[mod(R.pos + off + 3, Ln)];
        peek(i, -1, up, x, L.Y - L.PK - 4, aiming);
        peek(i, 1, dn, x, L.Y + L.RH * 3 + 4, aiming);
      }
      if (b.offs[i]) V.text(ctx, (b.offs[i] > 0 ? '▲' : '▼') + Math.abs(b.offs[i]), x + L.RW / 2, L.Y + L.RH * 3 + L.PK + 18, { align: 'center', size: 13, weight: 700, color: '#bcd8ff' });
      // 窓のマスの説明
      for (let r = 0; r < 3; r++) {
        const c = G.winCell(s, i, r);
        tip(x, rowY(r), L.RW, L.RH, (V.EL_NAME[c.k] || '空き') + (c.lv > 1 ? ' Lv' + c.lv : ''), G.R[c.k].desc);
      }
    }
    // 行の横の線
    for (let r = 0; r < 3; r++) {
      ctx.strokeStyle = 'rgba(255,220,150,.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(reelX(0), rowY(r) + 0.5); ctx.lineTo(L.RX1, rowY(r) + 0.5); ctx.stroke();
    }
  }
  function peek(i, dir, c, x, y, aiming) {
    const b = S().b;
    const coach = BS.coach && BS.coach.reel === i && BS.coach.dir === dir;
    const hint = BS.hint && (BS.hint.offs[i] - b.offs[i]) * dir > 0;
    const o = btn({ x: x, y: y, w: L.RW, h: L.PK, invisible: true, key: (dir < 0 ? 'up' : 'dn') + i, disabled: !aiming, on: () => shiftReel(i, dir) });
    ctx.save();
    const hot = o.hot && aiming;
    ctx.globalAlpha = aiming ? 1 : 0.55;
    V.rr(ctx, x + 2, y, L.RW - 4, L.PK, 8);
    ctx.fillStyle = hot ? '#5a4632' : '#2e2218'; ctx.fill();
    ctx.lineWidth = (coach || hint) ? 3 : 1.5;
    ctx.strokeStyle = (coach || hint) ? `rgba(255,230,140,${0.6 + 0.4 * Math.sin(App.t * 7)})` : (hot ? '#ffdc8a' : 'rgba(200,160,100,.6)');
    if (coach || hint) { ctx.shadowColor = '#ffe27a'; ctx.shadowBlur = 14; }
    ctx.stroke(); ctx.shadowBlur = 0;
    if (c.k !== 'gap') V.elIcon(ctx, c.k, x + 20, y + L.PK / 2, 9, V.EL_COL[c.k]);
    V.text(ctx, (dir < 0 ? '▼' : '▲') + ' ' + (V.EL_NAME[c.k] || '空き'), x + (c.k !== 'gap' ? 50 : L.RW / 2), y + L.PK / 2 + 1, { align: 'center', size: 13, weight: 700, color: c.k === 'gap' ? 'rgba(220,190,140,.5)' : '#f6e6c8' });
    ctx.restore();
    if (coach && aiming && !(BS.coach && BS.coach.done)) {
      const bob = Math.sin(App.t * 6) * 4;
      const ay = dir < 0 ? y - 8 - bob : y + L.PK + 8 + bob;
      ctx.save();
      ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = '#3a1d05'; ctx.lineWidth = 2;
      ctx.beginPath();
      if (dir < 0) { ctx.moveTo(x + L.RW / 2, ay); ctx.lineTo(x + L.RW / 2 - 12, ay - 14); ctx.lineTo(x + L.RW / 2 + 12, ay - 14); }
      else { ctx.moveTo(x + L.RW / 2, ay); ctx.lineTo(x + L.RW / 2 - 12, ay + 14); ctx.lineTo(x + L.RW / 2 + 12, ay + 14); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      V.text(ctx, 'ここを押す', x + L.RW / 2, dir < 0 ? ay - 26 : ay + 26, { align: 'center', size: 13, weight: 800, color: '#ffe27a', stroke: 'rgba(0,0,0,.8)', sw: 4 });
      ctx.restore();
    }
    tip(x, y, L.RW, L.PK, (dir < 0 ? '上' : '下') + 'にはみ出した札', `押すと「${V.EL_NAME[c.k] || '空き'}」が窓の${dir < 0 ? '上の行' : '下の行'}に入る（リールが一コマ${dir < 0 ? '下' : '上'}へ）。魔力を1使う。`);
  }
  function drawPlates(pred) {
    const s = S(), b = s.b;
    for (let r = 0; r < 3; r++) {
      const ln = pred ? pred.evs.find(e => e.line.row === r) : null;
      const x = L.PX, y = rowCY(r) - 30, w = L.PW, h = 60;
      const flash = BS.plate[r];
      ctx.save();
      V.rr(ctx, x, y, w, h, 10);
      ctx.fillStyle = ln ? 'rgba(40,28,18,.92)' : 'rgba(30,22,16,.6)'; ctx.fill();
      ctx.lineWidth = ln ? 2 : 1; ctx.strokeStyle = ln ? V.EL_COL[ln.line.el] : 'rgba(200,160,100,.3)';
      if (flash > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 20 * flash; }
      ctx.stroke(); ctx.shadowBlur = 0;
      if (ln) {
        V.elIcon(ctx, ln.line.el, x + 18, y + 20, 10, V.EL_COL[ln.line.el]);
        V.text(ctx, '×' + ln.line.n, x + 48, y + 20, { align: 'center', size: 14, weight: 700, color: '#e8d8b8' });
        V.text(ctx, String(ln.line.power), x + w / 2, y + 44, { align: 'center', size: ln.line.power >= 100 ? 20 : 23, weight: 800, color: '#fff3d0' });
      } else if (b.phase === 'aim' && !BS.spin && !BS.tl) {
        V.text(ctx, '―', x + w / 2, y + h / 2, { align: 'center', size: 18, color: 'rgba(220,190,140,.4)' });
      }
      ctx.restore();
      if (ln) tip(x, y, w, h, `${V.EL_NAME[ln.line.el]}の行 ×${ln.line.n}`, `そろった紋の Lv の合計 ${ln.line.lv} × そろった数の倍率 ${ln.line.mult}${ln.line.stars ? ' × 星 2' : ''} = 力 ${ln.line.power}。手前の魔物から順に貫き、余った力が奥の壁に届く。`);
    }
  }
  function drawPreview(pred) {
    if (!pred) return;
    for (const ev of pred.evs) {
      const r = ev.line.row, col = V.EL_COL[ev.line.el];
      let ex = L.PX + L.PW + 40;
      for (const h of ev.hits) { const d = BS.dm[h.id]; if (d) ex = Math.max(ex, d.x); }
      if (ev.rem > 0) ex = L.WX + 30;
      const y = hitY(r);
      ctx.save();
      ctx.strokeStyle = col; ctx.globalAlpha = 0.28 + 0.12 * Math.sin(App.t * 5); ctx.lineWidth = 3 + Math.min(8, ev.line.power / 8);
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -App.t * 40;
      ctx.beginPath(); ctx.moveTo(L.PX + L.PW, y); ctx.lineTo(ex, y); ctx.stroke();
      ctx.restore();
    }
  }
  function drawEnemies(pred) {
    const s = S(), b = s.b, t = App.t;
    const hits = {};
    if (pred) for (const ev of pred.evs) for (const h of ev.hits) { const o = hits[h.id] || (hits[h.id] = { dmg: 0, kill: false, frz: false, m: h.m }); o.dmg += h.dmg; o.kill = o.kill || h.kill; if (ev.froze && !h.kill) o.frz = true; }
    if (pred && pred.fled) for (const id of pred.fled) hits[id] = hits[id] || { flee: true };
    const list = Object.values(BS.dm).sort((a, c) => a.y - c.y);
    for (const d of list) {
      const T = G.EN[d.t];
      let x = d.x;
      if (d.lunge > 0) x -= Math.sin((0.3 - d.lunge) / 0.3 * Math.PI) * 40;
      const alpha = d.dying > 0 ? d.dying : (d.flee ? Math.max(0, 1 - (d.fleeT || 0)) : d.alpha);
      if (d.flash > 0) { ctx.save(); ctx.filter = 'brightness(2.2)'; }
      V.enemy(ctx, d.t, x, d.y, t, { alpha: alpha, frozen: d.frz, shell: d.shell, s: d.dying > 0 ? 1 + (1 - d.dying) * 0.3 : 1 });
      if (d.flash > 0) ctx.restore();
      if (d.dying > 0 || d.flee) continue;
      const sc = V.ENEMY_SCALE[d.t] || 1;
      // 体力
      const bw = 44 * Math.min(1.6, sc), by = d.y + 8;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - bw / 2, by, bw, 7);
      ctx.fillStyle = T.boss ? '#ffb04a' : '#e85a4a'; ctx.fillRect(x - bw / 2 + 1, by + 1, (bw - 2) * clamp(d.hp / d.max, 0, 1), 5);
      V.text(ctx, String(d.hp), x + bw / 2 + 4, by + 4, { size: 12, weight: 700, color: '#ffe8d8', stroke: 'rgba(0,0,0,.7)', sw: 3 });
      if (T.every) {
        const e = b.en.find(q => q.id === d.id);
        if (e) V.text(ctx, e.cd <= 1 ? '次に振りおろす！' : `あと ${e.cd} 手番で一撃`, x, by + 22, { align: 'center', size: 12, weight: 700, color: e.cd <= 1 ? '#ff8a6a' : '#d8c8b8', stroke: 'rgba(0,0,0,.7)', sw: 3 });
      }
      // 見こみ
      const p = hits[d.id];
      if (p && !BS.tl) {
        const yy = Math.max(d.y - 76 * sc, rowY(d.lane) + 14);
        if (p.flee) badge(x, yy, '逃げる', '#8ad0ff', true);
        else if (p.kill) badge(x, yy, '倒す', '#7ae06a', true);
        else if (p.dmg) badge(x, yy, '−' + p.dmg, '#ffb04a', false);
        else badge(x, yy, 'はじく', '#b8b0a8', false);
        if (p.frz && !p.kill) badge(x, yy - 24, '凍る', '#8fe2ff', false);
      }
      const e = b.en.find(q => q.id === d.id);
      const wk = (T.weak || []).map(k => V.EL_NAME[k]).join('・'), rs = (T.resist || []).map(k => V.EL_NAME[k]).join('・');
      tip(x - 30 * sc, d.y - 74 * sc, 60 * sc, 80 * sc, `${T.name}　体力 ${d.hp}/${d.max}`, T.desc + (wk ? `\n弱点：${wk}（2倍）` : '') + (rs ? `\n半分：${rs}` : '') + (T.atk ? `\nミオの前まで来ると、心を ${T.atk} 減らす。` : '') + (e && e.frozen ? '\n凍っていて、次の一歩を止めている。' : ''));
    }
  }
  function badge(x, y, text, col, strong) {
    ctx.font = V.font(15, 800);
    const w = ctx.measureText(text).width + 16;
    ctx.save();
    V.rr(ctx, x - w / 2, y - 12, w, 24, 12);
    ctx.fillStyle = strong ? col : 'rgba(20,14,10,.85)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
    V.text(ctx, text, x, y + 1, { align: 'center', size: 15, weight: 800, color: strong ? '#1a1008' : col });
    ctx.restore();
  }
  function drawWalls(pred) {
    const s = S(), b = s.b, t = App.t;
    for (let l = 0; l < 3; l++) {
      const w = b.walls[l], v = BS.wv[l];
      const y = rowY(l) + 6, h = L.RH - 8;
      const sx = v.shake > 0 ? Math.sin(t * 70) * 5 * v.shake : 0;
      if (w.kind === 'gear' && v.broken) v.spin += 0.05;
      V.wall(ctx, w.kind, L.WX + sx, y, L.WW, h, t, { broken: v.broken, t: v.t, glimpse: v.glimpse, lightCol: v.lightCol, spin: v.spin });
      if (w.id) {
        const name = G.WALL[w.kind].name;
        const need = w.need === 'any' ? 'どの紋でも' : V.EL_NAME[w.need] + 'の行で';
        if (!v.broken) {
          const chip = w.accum && w.dmg ? `${need} ${w.dmg}/${w.th}` : `${need} ${w.th}`;
          ctx.font = V.font(13, 700);
          const cw = ctx.measureText(chip).width + 30;
          V.rr(ctx, L.WX + L.WW - cw - 8, y + h - 26, cw, 22, 8);
          ctx.fillStyle = 'rgba(20,14,10,.85)'; ctx.fill(); ctx.strokeStyle = w.need === 'any' ? '#e8c890' : V.EL_COL[w.need]; ctx.lineWidth = 1.5; ctx.stroke();
          V.elIcon(ctx, w.need, L.WX + L.WW - cw + 6, y + h - 15, 7, w.need === 'any' ? '#e8c890' : V.EL_COL[w.need]);
          V.text(ctx, chip, L.WX + L.WW - cw + 18, y + h - 14, { size: 13, weight: 700, color: '#f6e6c8' });
          if (w.nest) V.text(ctx, `奥から魔物（あと${w.nest.left}）`, L.WX + L.WW - 10, y + h - 38, { align: 'right', size: 12, color: '#ffb0a0', stroke: 'rgba(0,0,0,.6)', sw: 3 });
          // 見こみ
          const ev = pred && pred.evs.find(e => e.wall && e.wall.lane === l);
          if (ev && !BS.tl) {
            if (ev.wall.ok) badge(L.WX + L.WW / 2, y + 26, { thorn: '燃える！', lake: '凍る！', gear: '動き出す！', seal: 'とける！' }[w.kind] || '崩れる！', '#ffe27a', true);
            else if (ev.wall.fits) badge(L.WX + L.WW / 2, y + 26, `届く ${ev.wall.power}（あと${ev.wall.th - (ev.wall.acc || 0) - ev.wall.power}）`, '#ffd08a', false);
            else badge(L.WX + L.WW / 2, y + 26, `${V.EL_NAME[w.need]}でないと…`, '#b8b0a8', false);
          }
        } else if (v.t < 99) {
          V.text(ctx, '新しい道', L.WX + L.WW / 2, y + h - 12, { align: 'center', size: 15, weight: 800, color: '#ffe9b0', stroke: 'rgba(0,0,0,.7)', sw: 4 });
        }
        tip(L.WX, y, L.WW, h, name, (G.WALL[w.kind].desc || '') + (v.broken ? '\n崩れた。地図に新しい道が描かれる。' : `\n${need}、魔物を貫いて余った力が一撃で ${w.th} 以上届けば崩れる。`) + (w.nest && !v.broken ? '\n崩すまで、奥から魔物が出てくる。' : ''));
      } else if (w.kind === 'exit') tip(L.WX, y, L.WW, h, '抜け道', 'となりの部屋へ続く道。余った力は抜けていく。');
    }
  }
  function drawBottom(pred) {
    const s = S(), b = s.b;
    V.panel(ctx, 20, 556, 990, 150, { dark: true, r: 12 });
    let text = BS.msg;
    const busy = BS.spin || BS.tl;
    if (BS.coach && BS.coach.text) text = BS.coach.text;
    else if (b.phase === 'aim' && !busy && pred) {
      if (!pred.evs.length) text = '行がそろっていない。窓の上下にはみ出した札を押すと、その紋が窓に入る（魔力1）。';
      else text = '見こみ：' + resText(pred) + '。　よければ「放つ」（スペース）。ずらすと見こみが変わる。';
      if (b.kind === 'practice') text = (practiceMsg() ? practiceMsg() + '\n' : '') + text;
    } else if (busy && BS.tl) text = '詠唱中…（スペース・「早送り」で速くできる）';
    else if (busy) text = '回っている…';
    else if (b.phase === 'spin' && !text) text = b.kind === 'battle' ? '「回す」（スペース）で次の手番。' : '「回す」（スペース）で回す。';
    V.para(ctx, text || '', 42, 576, 950, { size: 16, color: '#f2e6d0', lh: 26 });
    // ボタン
    const x = 1028, w = 228;
    let label = '回す', on = () => doSpin(), dis = false;
    if (BS.tl) { label = '早送り'; on = () => { BS.rush = true; }; }
    else if (BS.spin) { label = '止める'; on = stopSpinNow; }
    else if (b.phase === 'aim') { label = '放つ'; on = doCast; }
    if (BS.over) dis = true;
    btn({ x: x, y: 560, w: w, h: 74, label: label, kind: 'main', size: 28, key: 'main', disabled: dis, glow: !dis && !busy && (b.phase === 'spin' || (BS.coach && BS.coach.done)), on: on });
    const sw = (w - 8) / 2;
    if (BS.ready && b.kind === 'battle') {
      btn({ x: x, y: 642, w: w, h: 40, label: '詠唱輪を組む', size: 16, key: 'editor', glow: s.bag.some(c => c.nw), on: () => openEditor() });
      V.text(ctx, '戦いの前なら組み替えられる', x + w / 2, 696, { align: 'center', size: 12, color: '#bba888' });
    } else if (b.kind === 'practice') {
      const ch = changedCells();
      btn({ x: x, y: 642, w: sw, h: 30, label: '同じ回転で', size: 14, key: 'same', disabled: !(BS.cmp && BS.cmp.last) || b.phase !== 'spin' || !!busy, on: () => doSpin(BS.cmp.last.spin) });
      btn({ x: x + sw + 8, y: 642, w: sw, h: 30, label: '変えた紋で', size: 14, key: 'changed', disabled: !ch.length || b.phase !== 'spin' || !!busy, on: () => doSpin(changedSpin(ch[0])) });
      tip(x + sw + 8, 642, sw, 30, '変えた紋で', '組み替えたマスが窓の中の行に来るように回す（ほかのリールは前の回転のまま）。');
      const tw = (w - 16) / 3;
      btn({ x: x, y: 678, w: tw, h: 28, label: 'ヒント', size: 13, key: 'hint', disabled: b.phase !== 'aim' || !!busy, on: showHint });
      btn({ x: x + tw + 8, y: 678, w: tw, h: 28, label: '組みかえる', size: 13, key: 'edit', disabled: !!busy, on: () => { endPractice(); } });
      btn({ x: x + (tw + 8) * 2, y: 678, w: tw, h: 28, label: '終わる', kind: 'ghost', size: 13, key: 'endpr', disabled: !!busy, on: () => { endPractice(); App.overlay = null; } });
    } else if (b.kind === 'quiet') {
      const tw = (w - 16) / 3;
      btn({ x: x, y: 642, w: tw, h: 40, label: '戻す', size: 14, key: 'reset', disabled: b.phase !== 'aim' || !!busy, on: resetShift });
      btn({ x: x + tw + 8, y: 642, w: tw, h: 40, label: '組む', size: 14, key: 'editor', glow: s.bag.some(c => c.nw) || s.forge > 0, disabled: !!busy, on: () => openEditor() });
      btn({ x: x + (tw + 8) * 2, y: 642, w: tw, h: 40, label: '地図へ', size: 14, key: 'leave', disabled: !!busy, on: () => leaveBattle() });
    } else {
      btn({ x: x, y: 642, w: sw, h: 40, label: '戻す', size: 15, key: 'reset', disabled: b.phase !== 'aim' || !!busy || !b.offs.some(o => o), on: resetShift });
      btn({ x: x + sw + 8, y: 642, w: sw, h: 40, label: 'ヒント', size: 15, key: 'hint', disabled: b.phase !== 'aim' || !!busy, on: showHint });
    }
  }
  function drawBanner() {
    const bn = BS.banner;
    if (!bn) return;
    bn.t += 0;
    const a = clamp(Math.min(bn.t * 4, (2.4 - bn.t) * 3), 0, 1);
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    const y = 98;
    ctx.fillStyle = 'rgba(10,8,6,.7)'; ctx.fillRect(520, y - 30, 752, 74);
    V.text(ctx, bn.text, 896, y - 4, { align: 'center', size: 28, weight: 800, serif: true, color: '#ffe2a8', stroke: 'rgba(0,0,0,.6)', sw: 5 });
    V.text(ctx, bn.sub, 896, y + 28, { align: 'center', size: 15, color: '#f0e0c0' });
    ctx.restore();
  }
  function drawBig() {
    const bg = BS.big;
    if (!bg) return;
    const d = bg.wall ? 2.2 : 1.6;
    if (bg.t > d) { BS.big = null; return; }
    const k = ease(bg.t / 0.25);
    const a = clamp((d - bg.t) * 3, 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    ctx.translate(880, bg.wall ? 120 : 130);
    ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k);
    V.text(ctx, bg.text, 0, 0, { align: 'center', size: bg.small ? 36 : 44, weight: 900, serif: true, color: bg.col, stroke: 'rgba(30,14,4,.85)', sw: 8 });
    if (bg.sub) V.text(ctx, bg.sub, 0, 42, { align: 'center', size: 20, weight: 700, color: '#fff2d8', stroke: 'rgba(0,0,0,.7)', sw: 5 });
    ctx.restore();
  }
  function itemText(it) {
    if (it.rune) return `${V.EL_NAME[it.rune]}の紋石${it.lv > 1 ? ' Lv' + it.lv : ''} ×${it.n || 1}`;
    if (it.reel) return '古い輪（リールが1本ふえる）';
    if (it.mp) return `魔力の指輪（魔力 +${it.mp}）`;
    if (it.hp) return `命の泉（心 +${it.hp}）`;
    if (it.forge) return `鍛え石 ×${it.forge}`;
    if (it.lore) return D.LORE[it.lore].name;
    return '';
  }
  function drawOver() {
    const o = BS.over, s = S();
    const a = clamp(o.t * 3, 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    if (o.kind === 'lose') {
      ctx.fillStyle = 'rgba(8,6,4,.55)'; ctx.fillRect(0, 0, W, H);
      const x = 330, y = 150, w = 620, h = 380;
      V.panel(ctx, x, y, w, h);
      V.text(ctx, 'ミオは逃げ帰った…', x + w / 2, y + 56, { align: 'center', size: 30, weight: 800, serif: true, color: '#3a2410' });
      V.para(ctx, '魔物にミオの前まで来られると、心が減る。崩した壁と手に入れたものは、そのまま残っている。' + (s.b && s.b.scarred ? '\n主に与えた傷も残っている。次の挑戦は、その傷から始まる。' : '') + '\n組み替えるなら、新しい紋を1本目のリールにも刻むと、その紋の行がそろいやすい。', x + 40, y + 104, w - 80, { size: 16, color: '#4a3420', lh: 26 });
      btn({ x: x + 30, y: y + h - 80, w: 180, h: 54, label: 'もう一度挑む', kind: 'main', size: 18, key: 'retry', on: () => { const id = s.b.room; startBattle(id); } });
      btn({ x: x + 220, y: y + h - 80, w: 180, h: 54, label: '組み直す', size: 18, key: 'editor', on: () => openEditor() });
      btn({ x: x + 410, y: y + h - 80, w: 180, h: 54, label: '地図へもどる', size: 18, key: 'leave', on: () => leaveBattle() });
      ctx.restore();
      return;
    }
    // 勝ったとき：戦場（崩れた壁の向こう）が見えるよう、下の帯に出す
    const x = 20, y = 548, w = 1240, h = 162;
    V.panel(ctx, x, y, w, h);
    let title = '部屋が静かになった！';
    if (o.kind === 'opened') title = BS.opened.indexOf('w_final') >= 0 ? '最後の壁が崩れた！' : '壁が崩れた！';
    if (o.final) title = '番人が崩れ落ちた！';
    V.text(ctx, title, x + 30, y + 36, { size: 28, weight: 800, serif: true, color: '#3a2410' });
    if (o.kind === 'win') V.text(ctx, `倒した魔物 ${o.kills}体・いちばん強い一行 ${o.best}・${o.turns}手番`, x + 32, y + 72, { size: 15, color: '#5a4026' });
    let yy = y + 102;
    const opened = o.kind === 'opened' || (o.opened && o.opened.length);
    const pick = s.b && s.b.pick;
    const tw = pick ? 470 : 760;
    if (opened) { V.para(ctx, '崩れた壁の向こうに、新しい道が見える。地図に描きこもう！', x + 32, yy - 10, tw, { size: 16, weight: 700, color: '#8a3a10', lh: 22 }); yy += 30; }
    if (o.got && o.got.length) V.para(ctx, '手に入れたもの：' + o.got.map(itemText).join('、'), x + 32, yy - 10, tw, { size: 16, weight: 700, color: '#2a1a0a', lh: 22 });
    else if (o.remain && !opened) V.para(ctx, '崩していない壁がまだある。いまなら魔物なしで、静かに狙える（魔力+2）。', x + 32, yy - 10, tw, { size: 15, color: '#6a4a2a', lh: 22 });
    // 持ち帰る紋をえらぶ
    if (pick) {
      const px = x + 540;
      V.text(ctx, '持ち帰る紋を、ひとつ選ぶ', px, y + 20, { size: 15, weight: 700, color: '#6a4a2a' });
      pick.forEach((it, i) => {
        const cx = px + i * 222, cy = y + 36, cw = 210, chh = 116;
        const b = btn({ x: cx, y: cy, w: cw, h: chh, kind: 'light', key: 'pick' + i, label: '', glow: o.t > 0.6, on: () => { const got = G.takePick(s, i); if (got) { A.play('pickup'); o.picked = got; toast(itemText(got) + 'を持ち帰った。地図の「詠唱輪を組む」で刻める', 3); saveGame(); } } });
        V.rune(ctx, G.cell(it.rune, it.lv), cx + 10, cy + 12, 64, 60, App.t, { name: false });
        V.text(ctx, itemText(it), cx + 82, cy + 26, { size: 15, weight: 800, color: '#2a1a0a' });
        V.para(ctx, G.R[it.rune].desc, cx + 82, cy + 40, cw - 90, { size: 11, color: '#5a4026', lh: 15 });
        V.text(ctx, (i + 1) + ' キー', cx + cw - 10, cy + chh - 12, { align: 'right', size: 11, color: '#8a6a3c' });
        if (b.hot) tip(cx, cy, cw, chh, V.EL_NAME[it.rune] + (it.lv > 1 ? ' Lv' + it.lv : ''), G.R[it.rune].desc);
      });
    } else if (o.picked) V.text(ctx, '持ち帰った：' + itemText(o.picked), x + 560, y + 80, { size: 17, weight: 700, color: '#2a1a0a' });
    const bx = x + w - 260;
    if (o.final) {
      V.para(ctx, '番人の心核は、鍛え石3つ分の力を持っていた。「組む」で紋を鍛えてから、最後の壁を狙おう。', x + 540, y + 40, 420, { size: 16, color: '#3a2410', lh: 24 });
      btn({ x: bx, y: y + 50, w: 240, h: 64, label: '最後の壁を狙う', kind: 'main', size: 20, key: 'next', on: () => { s.b = null; startBattle(s.at, 'quiet'); } });
    } else if (o.kind === 'opened' && BS.opened.indexOf('w_final') >= 0) {
      btn({ x: bx, y: y + 40, w: 240, h: 70, label: '空白へ', kind: 'main', size: 26, key: 'next', on: () => { leaveBattle(); App.map.auto = { id: 's4_blank', t: 1.6 }; } });
    } else {
      btn({ x: bx, y: y + 24, w: 240, h: 58, label: '地図へ', kind: 'main', size: 22, key: 'next', disabled: !!pick, on: () => leaveBattle() });
      if (pick) V.text(ctx, '先に紋を選ぶ', bx + 120, y + 96, { align: 'center', size: 13, color: '#8a6a3c' });
      if (o.remain) btn({ x: bx, y: y + 106, w: 240, h: 44, label: '壁を狙う（静かに）', kind: 'blue', size: 16, key: 'quiet', disabled: !!pick, on: () => { const id = s.b.room; s.b = null; startBattle(id, 'quiet'); } });
    }
    ctx.restore();
  }

  // ---------- 演出 ----------
  function drawFx() {
    for (const f of BS.fx) {
      const k = f.t / f.d;
      ctx.save();
      if (f.k === 'beam') {
        const head = Math.min(1, f.t / Math.max(0.05, f.d - 0.28));
        const x2 = f.sx + (f.ex - f.sx) * head;
        const a = 1 - clamp((f.t - (f.d - 0.28)) / 0.28, 0, 1);
        const wdt = 6 + Math.min(26, f.power * 0.5);
        ctx.globalAlpha = a;
        const g = ctx.createLinearGradient(f.sx, 0, x2, 0);
        g.addColorStop(0, f.col + '00'); g.addColorStop(0.6, f.col + 'cc'); g.addColorStop(1, '#ffffff');
        ctx.strokeStyle = g; ctx.lineWidth = wdt; ctx.lineCap = 'round';
        ctx.shadowColor = f.col; ctx.shadowBlur = 24;
        ctx.beginPath(); ctx.moveTo(f.sx, f.sy); ctx.lineTo(x2, f.sy); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x2, f.sy, wdt * 0.7, 0, 7); ctx.fill();
        if (f.el === 'fire') for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(255,${150 + i * 20},60,${0.6 * a})`; ctx.beginPath(); ctx.arc(x2 - i * 14 - Math.random() * 8, f.sy + (Math.random() - 0.5) * wdt, wdt * 0.4, 0, 7); ctx.fill(); }
        if (f.el === 'ice') for (let i = 0; i < 4; i++) V.elIcon(ctx, 'ice', x2 - 20 - i * 30, f.sy + Math.sin(i * 2 + f.t * 9) * 8, 6, 'rgba(230,250,255,.9)');
      } else if (f.k === 'zap') {
        const a = 1 - k;
        ctx.globalAlpha = a; ctx.strokeStyle = '#fff6b0'; ctx.lineWidth = 4 + Math.min(10, f.power * 0.2);
        ctx.shadowColor = '#ffd84a'; ctx.shadowBlur = 26;
        ctx.beginPath(); ctx.moveTo(f.sx, f.sy);
        const n = 14;
        for (let i = 1; i <= n; i++) ctx.lineTo(f.sx + (f.ex - f.sx) * i / n, f.sy + (i === n ? 0 : (Math.random() - 0.5) * 34));
        ctx.stroke();
      } else if (f.k === 'burst') {
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.col; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + k), 0, 7); ctx.stroke();
      } else if (f.k === 'spark') {
        const x = f.x + f.vx * f.t, y = f.y + f.vy * f.t + 320 * f.t * f.t;
        ctx.globalAlpha = 1 - k; ctx.fillStyle = f.col;
        ctx.beginPath(); ctx.arc(x, y, 3.5 * (1 - k) + 1, 0, 7); ctx.fill();
      } else if (f.k === 'rock') {
        const x = f.x + f.vx * f.t, y = f.y + f.vy * f.t + 520 * f.t * f.t;
        ctx.globalAlpha = 1 - k; ctx.fillStyle = f.col || '#5a4a32';
        ctx.save(); ctx.translate(x, y); ctx.rotate(f.t * 6); ctx.fillRect(-6, -5, 12, 10); ctx.restore();
      } else if (f.k === 'dust') {
        ctx.globalAlpha = (1 - k) * 0.6; ctx.fillStyle = f.col || '#c8b898';
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(f.x + (i - 2) * 14 * (1 + k), f.y - k * 20 + Math.sin(i) * 6, 10 + k * 18, 0, 7); ctx.fill(); }
      } else if (f.k === 'rays') {
        ctx.globalAlpha = (1 - k) * 0.85;
        ctx.translate(f.x, f.y);
        for (let i = 0; i < 12; i++) {
          ctx.rotate(Math.PI / 6);
          const g = ctx.createLinearGradient(0, 0, 0, -400);
          g.addColorStop(0, 'rgba(255,240,190,.9)'); g.addColorStop(1, 'rgba(255,240,190,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(40, -400); ctx.lineTo(-40, -400); ctx.closePath(); ctx.fill();
        }
      } else if (f.k === 'arrow') {
        const x = f.sx + (f.ex - f.sx) * k, y = f.sy + (f.ey - f.sy) * k;
        ctx.strokeStyle = '#e8d8b8'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + 18, y); ctx.lineTo(x, y); ctx.stroke();
      }
      ctx.restore();
    }
  }
  function drawPops() {
    for (const p of BS.pops) {
      if (p.t < 0) continue;
      const k = p.t / 1.1;
      ctx.save(); ctx.globalAlpha = clamp(1 - k * k, 0, 1);
      const sz = p.big ? 30 : (p.small ? 15 : 22);
      V.text(ctx, p.text, p.x, p.y - k * 30, { align: 'center', size: sz, weight: 900, color: p.col, stroke: 'rgba(0,0,0,.75)', sw: 5 });
      ctx.restore();
    }
  }

  // ---------- 結末 ----------
  function drawEnding() {
    const s = S(), t = App.t;
    drawSky(t);
    ctx.fillStyle = 'rgba(8,8,20,.55)'; ctx.fillRect(0, 0, W, H);
    // 完成した地図（縮小）
    const sc = (H - 40) / D.MAP_H, ox = 30, oy = 20;
    const mw = MAPW * sc;
    ctx.save(); ctx.translate(ox, oy);
    ctx.drawImage(V.paper(MAPW, H), 0, 0, MAPW, H, -10, -6, mw + 20, D.MAP_H * sc + 12);
    ctx.strokeStyle = '#8c6a3c'; ctx.lineWidth = 2; ctx.strokeRect(-10, -6, mw + 20, D.MAP_H * sc + 12);
    ctx.scale(sc, sc);
    for (const e of D.EDGES) {
      if (!(G.visited(s, e.a) && G.visited(s, e.b))) continue;
      const [pa, pb] = edgePts(e);
      ctx.strokeStyle = 'rgba(70,46,24,.85)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    }
    for (const id in D.ROOMS) {
      const r = D.ROOMS[id];
      if (!G.visited(s, id)) continue;
      V.blobPath(ctx, r, 1);
      ctx.fillStyle = D.STRATA[r.st - 1].col + 'bb'; ctx.fill();
      ctx.strokeStyle = D.STRATA[r.st - 1].ink; ctx.lineWidth = 6; ctx.stroke();
      if (id === 's4_blank') for (let i = 0; i < 16; i++) { ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 2 + i)})`; ctx.beginPath(); ctx.arc(r.x - r.rx * 0.7 + V.hash(i) * r.rx * 1.4, r.y - r.ry * 0.5 + V.hash(i + 3) * r.ry, 6, 0, 7); ctx.fill(); }
    }
    ctx.restore();
    const X = 300;
    V.panel(ctx, X, 40, 940, 640);
    V.text(ctx, '底なし洞の地図', X + 470, 90, { align: 'center', size: 34, weight: 800, serif: true, color: '#3a2410' });
    let nv = 0, nh = 0, nhv = 0; const ids = Object.keys(D.ROOMS);
    for (const id of ids) { if (G.visited(s, id)) nv++; if (D.ROOMS[id].hidden) { nh++; if (G.visited(s, id)) nhv++; } }
    const st = s.stats;
    V.text(ctx, `描いた部屋 ${nv} / ${ids.length}　・　隠し部屋 ${nhv} / ${nh}　・　崩した壁 ${st.walls}`, X + 470, 136, { align: 'center', size: 18, color: '#4a3420' });
    V.text(ctx, `倒した魔物 ${st.kills}体　・　${st.turns}手番　・　逃げ帰った回数 ${st.losses}`, X + 470, 166, { align: 'center', size: 16, color: '#5a4026' });
    // 層ごとの、いちばん強い一行
    V.text(ctx, '層ごとの「いちばん強い一行」', X + 470, 214, { align: 'center', size: 17, weight: 700, color: '#6a4a2a' });
    const by = st.bestBy || {};
    const vals = [1, 2, 3, 4].map(k => by[k] || 0);
    const mx = Math.max(1, Math.max.apply(null, vals));
    vals.forEach((v, i) => {
      const bx = X + 190 + i * 150, bh = 220 * Math.sqrt(v / mx);
      ctx.fillStyle = D.STRATA[i].col; ctx.fillRect(bx, 470 - bh, 80, bh);
      ctx.strokeStyle = D.STRATA[i].ink; ctx.lineWidth = 2; ctx.strokeRect(bx, 470 - bh, 80, bh);
      V.text(ctx, String(v), bx + 40, 456 - bh, { align: 'center', size: 20, weight: 800, color: '#2a1a0a' });
      V.text(ctx, D.STRATA[i].name.split('　')[1] || '', bx + 40, 492, { align: 'center', size: 14, serif: true, color: '#4a3420' });
    });
    if (vals[0] && vals[3]) V.text(ctx, `最後の一行は、第一層の ${Math.round(vals[3] / vals[0])} 倍`, X + 470, 532, { align: 'center', size: 18, weight: 700, color: '#8a3a10' });
    const missing = nh - nhv;
    V.text(ctx, missing ? `まだ描いていない隠し部屋が ${missing} つある。地図にもどって探せる。` : '隠し部屋も、すべて描きあげた！', X + 470, 570, { align: 'center', size: 16, color: '#5a4026' });
    btn({ x: X + 220, y: 604, w: 240, h: 52, label: '地図にもどる', size: 18, key: 'tomap', on: () => { App.map = null; App.seenK = null; openMap(); } });
    btn({ x: X + 480, y: 604, w: 240, h: 52, label: 'タイトルへ', kind: 'main', size: 18, key: 'title', on: () => { App.scene = 'title'; A.music('title'); } });
  }

  // ---------- 重ねる画面 ----------
  function drawOverlay() {
    const o = App.overlay;
    ctx.fillStyle = 'rgba(6,4,2,.6)'; ctx.fillRect(0, 0, W, H);
    if (o.kind === 'help') {
      const pg = D.HELP[o.page];
      V.panel(ctx, 190, 100, 900, 500);
      V.text(ctx, `あそびかた　${o.page + 1} / ${D.HELP.length}`, 640, 140, { align: 'center', size: 15, color: '#6a4a2a' });
      V.text(ctx, pg.title, 640, 184, { align: 'center', size: 28, weight: 800, serif: true, color: '#3a2410' });
      V.para(ctx, pg.text, 250, 222, 780, { size: 17, color: '#2a1a0a', lh: 29 });
      drawHelpArt(o.page, 640, 430);
      btn({ x: 250, y: 520, w: 150, h: 46, label: '← まえ', disabled: o.page === 0, key: 'prev', on: () => { o.page--; A.play('page'); } });
      btn({ x: 880, y: 520, w: 150, h: 46, label: o.page < D.HELP.length - 1 ? 'つぎ →' : 'とじる', kind: 'main', key: 'nextp', on: () => { if (o.page < D.HELP.length - 1) { o.page++; A.play('page'); } else App.overlay = null; } });
      btn({ x: 565, y: 520, w: 150, h: 46, label: 'とじる', kind: 'light', key: 'close', on: () => { App.overlay = null; } });
    } else if (o.kind === 'menu') {
      V.panel(ctx, 440, 130, 400, 460);
      V.text(ctx, 'メニュー', 640, 170, { align: 'center', size: 26, weight: 800, serif: true, color: '#3a2410' });
      const row = (y, label, val, on, key) => { V.text(ctx, label, 480, y + 20, { size: 17, color: '#3a2410' }); btn({ x: 650, y: y, w: 150, h: 40, label: val, kind: 'light', size: 16, key: key, on: on }); };
      row(200, '音', cfg.mute ? 'なし' : 'あり', toggleMute, 'm_mute');
      row(250, '音量', Math.round(cfg.vol * 10) + ' / 10', () => { cfg.vol = cfg.vol >= 1 ? 0.2 : Math.round((cfg.vol + 0.1) * 10) / 10; A.setVol(cfg.vol); saveCfg(); A.play('click'); }, 'm_vol');
      row(300, '演出', cfg.fast ? 'はやい' : 'ふつう', () => { cfg.fast = !cfg.fast; saveCfg(); }, 'm_fast');
      row(350, '自動で回す', cfg.auto ? 'する' : 'しない', () => { cfg.auto = !cfg.auto; saveCfg(); }, 'm_auto');
      btn({ x: 480, y: 410, w: 320, h: 44, label: 'あそびかた', kind: 'light', key: 'm_help', on: () => { App.overlay = { kind: 'help', page: 0, t: 0 }; } });
      if (App.scene !== 'title') btn({ x: 480, y: 462, w: 320, h: 44, label: 'タイトルへもどる', kind: 'light', key: 'm_title', on: () => { if (App.s) { if (App.s.b && App.practiceBack) { App.s.b = null; App.practiceBack = null; } App.s.b = null; saveGame(); } BS = null; App.overlay = null; App.scene = 'title'; A.music('title'); } });
      btn({ x: 540, y: 524, w: 200, h: 44, label: 'とじる', kind: 'main', key: 'm_close', on: () => { App.overlay = null; } });
    } else if (o.kind === 'confirm') {
      V.panel(ctx, 400, 240, 480, 220);
      V.para(ctx, '前の冒険の記録は消える。\nはじめから描きなおしますか？', 440, 280, 400, { size: 19, color: '#3a2410', lh: 32 });
      btn({ x: 440, y: 380, w: 190, h: 50, label: 'はじめから', kind: 'main', key: 'yes', on: () => { App.overlay = null; newGame(); } });
      btn({ x: 650, y: 380, w: 190, h: 50, label: 'やめる', key: 'no', on: () => { App.overlay = null; } });
    } else if (o.kind === 'items') {
      const R = G.room(o.room);
      V.panel(ctx, 340, 150, 600, 400);
      V.text(ctx, R.name, 640, 194, { align: 'center', size: 26, weight: 800, serif: true, color: '#3a2410' });
      V.text(ctx, '見つけたもの', 640, 232, { align: 'center', size: 15, color: '#6a4a2a' });
      let y = 272;
      for (const it of R.items) {
        if (it.rune) V.rune(ctx, G.cell(it.rune), 430, y - 24, 56, 50, App.t, { name: false });
        else V.roomIcon(ctx, 'chest', 458, y, App.t);
        V.text(ctx, itemText(it), 504, y, { size: 20, weight: 700, color: '#2a1a0a' });
        if (it.lore) V.para(ctx, D.LORE[it.lore].text, 504, y + 16, 380, { size: 14, color: '#5a4026', lh: 20 });
        if (it.rune) V.text(ctx, G.R[it.rune].desc, 504, y + 24, { size: 13, color: '#5a4026' });
        y += it.lore ? 92 : 64;
      }
      btn({ x: 520, y: 480, w: 240, h: 52, label: '受け取る', kind: 'main', size: 20, key: 'take', on: takeItems });
    } else if (o.kind === 'editor') drawEditor(o);
  }
  // あそびかたの小さな図
  function drawHelpArt(page, cx, cy) {
    const t = App.t;
    const arrow = (x1, y1, x2, y2, col) => {
      ctx.save(); ctx.strokeStyle = col || '#8a4a10'; ctx.fillStyle = col || '#8a4a10'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const a = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - Math.cos(a - 0.5) * 12, y2 - Math.sin(a - 0.5) * 12); ctx.lineTo(x2 - Math.cos(a + 0.5) * 12, y2 - Math.sin(a + 0.5) * 12); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    ctx.save();
    if (page === 0) {
      const rooms = [{ x: cx - 220, y: cy - 30, rx: 70, ry: 30, st: 1, name: '広間', ink: true }, { x: cx, y: cy + 20, rx: 66, ry: 28, st: 1, name: '茨の間', pre: true }, { x: cx + 220, y: cy - 20, rx: 60, ry: 26, st: 1, look: true }];
      ctx.strokeStyle = 'rgba(70,46,24,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 150, cy - 20); ctx.lineTo(cx - 66, cy + 14); ctx.stroke();
      ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(cx + 66, cy + 14); ctx.lineTo(cx + 160, cy - 14); ctx.stroke(); ctx.setLineDash([]);
      for (const r of rooms) {
        V.blobPath(ctx, r, 1);
        if (r.ink) { ctx.fillStyle = '#7a8a4a99'; ctx.fill(); ctx.strokeStyle = '#4c5a2a'; ctx.lineWidth = 2.5; ctx.stroke(); V.text(ctx, r.name, r.x, r.y, { align: 'center', size: 15, weight: 700, serif: true, color: '#2e2012' }); }
        else if (r.pre) { ctx.strokeStyle = 'rgba(90,80,70,.7)'; ctx.lineWidth = 1.3; ctx.stroke(); V.text(ctx, r.name, r.x, r.y - 6, { align: 'center', size: 14, serif: true, color: 'rgba(70,60,50,.8)' }); V.text(ctx, '茨の奥に光…', r.x, r.y + 12, { align: 'center', size: 11, serif: true, color: 'rgba(80,74,66,.8)' }); }
        else { ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(90,80,70,.6)'; ctx.lineWidth = 1.3; ctx.stroke(); ctx.setLineDash([]); V.lookIcon(ctx, 'glint', r.x, r.y - 4, t); }
      }
      V.mio(ctx, cx - 190, cy, t, { s: 0.5 });
      V.text(ctx, '描いた部屋', cx - 220, cy + 30, { align: 'center', size: 12, color: '#6a4a2a' });
      V.text(ctx, '師匠の下書き', cx, cy + 66, { align: 'center', size: 12, color: '#6a4a2a' });
      V.text(ctx, 'まだ見ていない部屋の気配', cx + 220, cy + 30, { align: 'center', size: 12, color: '#6a4a2a' });
    } else if (page === 1) {
      const x0 = cx - 250;
      ['sword', 'sword', 'sword'].forEach((k, i) => V.rune(ctx, G.cell(k), x0 + i * 74, cy - 34, 70, 68, t, { lit: true, name: false }));
      V.rune(ctx, G.cell('fire'), x0 + 3 * 74, cy - 34, 70, 68, t, { name: false });
      V.text(ctx, '剣・剣・剣 → 3つそろって ×2', x0 + 150, cy + 52, { align: 'center', size: 14, weight: 700, color: '#3a2410' });
      arrow(x0 + 300, cy, cx + 120, cy);
      V.enemy(ctx, 'goblin', cx + 180, cy + 30, t);
      V.text(ctx, '力 6 がその段へ', cx + 180, cy + 52, { align: 'center', size: 14, weight: 700, color: '#3a2410' });
    } else if (page === 2) {
      const x = cx - 160, y = cy - 70;
      V.rr(ctx, x - 8, y - 46, 92, 196, 10); ctx.fillStyle = 'rgba(30,20,14,.9)'; ctx.fill();
      V.rr(ctx, x, y - 40, 76, 32, 8); ctx.fillStyle = '#2e2218'; ctx.fill(); ctx.strokeStyle = `rgba(255,230,140,${0.6 + 0.4 * Math.sin(t * 6)})`; ctx.lineWidth = 3; ctx.stroke();
      V.elIcon(ctx, 'fire', x + 18, y - 24, 9, V.EL_COL.fire); V.text(ctx, '▼ 炎', x + 50, y - 23, { align: 'center', size: 13, weight: 700, color: '#f6e6c8' });
      ['sword', 'gap', 'sword'].forEach((k, i) => V.rune(ctx, G.cell(k), x, y + i * 46, 76, 46, t, { name: false, label: false }));
      arrow(x + 120, y - 24, x + 200, y - 24);
      V.text(ctx, 'はみ出した札を押すと', x + 300, y - 34, { align: 'center', size: 14, color: '#3a2410' });
      V.text(ctx, 'その紋が窓に入る（魔力1）', x + 300, y - 12, { align: 'center', size: 14, color: '#3a2410' });
      V.text(ctx, '魔物の上の「倒す」「−数字」が', x + 300, y + 40, { align: 'center', size: 14, color: '#3a2410' });
      V.text(ctx, 'その場で変わる', x + 300, y + 62, { align: 'center', size: 14, color: '#3a2410' });
    } else if (page === 3) {
      const y = cy;
      ctx.strokeStyle = V.EL_COL.fire; ctx.lineWidth = 8; ctx.shadowColor = V.EL_COL.fire; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(cx - 300, y - 26); ctx.lineTo(cx + 150, y - 26); ctx.stroke(); ctx.shadowBlur = 0;
      V.text(ctx, '炎 6', cx - 300, y - 50, { size: 16, weight: 800, color: '#8a3a10' });
      V.enemy(ctx, 'thornling', cx - 120, y + 10, t);
      V.text(ctx, '−2（弱点）', cx - 120, y + 30, { align: 'center', size: 13, color: '#3a2410' });
      V.enemy(ctx, 'goblin', cx, y + 10, t);
      V.text(ctx, '−2', cx, y + 30, { align: 'center', size: 13, color: '#3a2410' });
      V.wall(ctx, 'thorn', cx + 120, y - 70, 160, 90, t, {});
      V.text(ctx, '残り2 → 茨が燃える', cx + 200, y + 34, { align: 'center', size: 14, weight: 700, color: '#8a3a10' });
    } else if (page === 4) {
      V.text(ctx, '持ち物', cx - 230, cy - 50, { align: 'center', size: 13, color: '#6a4a2a' });
      V.rune(ctx, G.cell('fire'), cx - 265, cy - 36, 70, 64, t, { lit: true, name: false });
      arrow(cx - 180, cy - 4, cx - 40, cy - 4);
      ['sword', 'gap', 'sword'].forEach((k, i) => V.rune(ctx, G.cell(k), cx - 20 + i * 76, cy - 36, 72, 64, t, { name: false }));
      ctx.strokeStyle = `rgba(255,190,90,${0.6 + 0.4 * Math.sin(t * 6)})`; ctx.lineWidth = 3; V.rr(ctx, cx + 58, cy - 34, 68, 60, 9); ctx.stroke();
      V.text(ctx, '1本目のリールにも刻むと、その紋の行ができる', cx, cy + 50, { align: 'center', size: 14, weight: 700, color: '#3a2410' });
    }
    ctx.restore();
  }
  function drawEditor(o) {
    const s = S(), t = App.t;
    V.panel(ctx, 30, 30, 1220, 660, { dark: true });
    V.text(ctx, '詠唱輪を組む', 60, 66, { size: 26, weight: 800, serif: true, color: '#ffe2a8' });
    V.text(ctx, 'リール（上から下へ、くるりと一周する並び）', ED.X, 104, { size: 14, color: '#d8c8a8' });
    const held = o.held;
    s.reels.forEach((R, ri) => {
      V.text(ctx, `${ri + 1}本目`, ED.X + ri * (ED.CW + ED.GAP) + ED.CW / 2, ED.Y + 8 * (ED.CH + 2) + 16, { align: 'center', size: 13, color: '#d8c8a8' });
      R.strip.forEach((c, ci) => {
        const r = edCellRect(ri, ci);
        const isHeld = held && held.from === 'reel' && held.ri === ri && held.ci === ci;
        const canTarget = (held && !isHeld) || (o.forge && G.canForge(s, c));
        const b = btn({ x: r.x, y: r.y, w: r.w, h: r.h, invisible: true, key: `cell${ri}_${ci}`, on: () => edClickCell(ri, ci), onRight: () => { if (G.unplace(s, ri, ci)) { A.play('click'); o.msg = '外して持ち物にもどした。'; } } });
        V.rune(ctx, c, r.x, r.y, r.w, r.h, t, { lit: isHeld, name: false });
        if (canTarget) { ctx.strokeStyle = `rgba(255,226,140,${0.5 + 0.4 * Math.sin(t * 6)})`; ctx.lineWidth = 2; V.rr(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 9); ctx.stroke(); }
        if (b.hot) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; V.rr(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 10); ctx.stroke(); }
        tip(r.x, r.y, r.w, r.h, (V.EL_NAME[c.k] || '空き') + (c.lv > 1 ? ' Lv' + c.lv : ''), G.R[c.k].desc + '\n押すと持ち上げる／右クリックで外す');
      });
    });
    // 持ち物
    V.text(ctx, '持ち物の紋（押して持ち、リールのマスを押すと刻める）', 548, 128, { size: 14, color: '#d8c8a8' });
    const bagArea = { x: 540, y: 140, w: 500, h: 210 };
    btn({ x: bagArea.x, y: bagArea.y, w: bagArea.w, h: bagArea.h, invisible: true, key: 'bag', on: () => { if (o.held && o.held.from === 'reel') { if (G.unplace(s, o.held.ri, o.held.ci)) { A.play('click'); o.msg = '外して持ち物にもどした。'; } o.held = null; } } });
    ctx.strokeStyle = 'rgba(200,160,100,.3)'; ctx.lineWidth = 1; V.rr(ctx, bagArea.x, bagArea.y, bagArea.w, bagArea.h, 10); ctx.stroke();
    if (!s.bag.length) V.text(ctx, '（なし）', bagArea.x + bagArea.w / 2, bagArea.y + bagArea.h / 2, { align: 'center', size: 16, color: 'rgba(220,190,140,.5)' });
    s.bag.slice(0, 21).forEach((c, i) => {
      const r = edBagRect(i);
      const isHeld = held && held.from === 'bag' && held.i === i;
      btn({ x: r.x, y: r.y, w: r.w, h: r.h, invisible: true, key: 'bag' + i, on: () => { if (o.forge) { if (G.forgeUp(s, c)) { A.play('forge'); o.msg = `「${V.EL_NAME[c.k]}」を鍛えた（Lv${c.lv}）。`; if (!s.forge) o.forge = false; } else A.play('deny'); return; } if (o.held && o.held.from === 'reel') { G.unplace(s, o.held.ri, o.held.ci); o.held = null; A.play('click'); return; } o.held = isHeld ? null : { from: 'bag', i: i }; A.play('click'); o.msg = o.held ? `「${V.EL_NAME[c.k]}」を持った。リールのマスを押すと刻める（前の紋は持ち物にもどる）。` : ''; } });
      V.rune(ctx, c, r.x, r.y, r.w, r.h, t, { lit: isHeld, name: false });
      tip(r.x, r.y, r.w, r.h, V.EL_NAME[c.k] + (c.lv > 1 ? ' Lv' + c.lv : ''), G.R[c.k].desc);
    });
    // 説明と鍛える
    const ix = 548;
    V.text(ctx, `鍛え石 ${s.forge}`, ix, 382, { size: 16, weight: 700, color: '#ffe2a8' });
    btn({ x: ix + 110, y: 364, w: 150, h: 38, label: o.forge ? '鍛えるのをやめる' : '鍛える', kind: o.forge ? 'main' : undefined, disabled: !s.forge && !o.forge, size: 15, key: 'forge', on: () => { o.forge = !o.forge; o.held = null; o.msg = o.forge ? '鍛える紋を押す（Lv が1上がり、行の力が増える）。' : ''; } });
    V.para(ctx, '・行は左から読む。1本目のリールにない紋の行はできない。\n・リールは1本ずつ別々に止まり、8マスのうち となり合う3マスが窓に出る。刻む高さはそろえなくてよい（そろえるのは、戦いでずらして）。\n・同じ紋を同じリールにいくつも刻むと、その紋が窓に出やすくなる。\n・行の力 ＝ そろった紋の Lv（札の左上の点の数）の合計 × そろった数の倍率（2つ×1、3つ×2、4つ×4、5つ×8）。\n・星はどの紋の代わりにもなり、星が入った行は力が2倍。', ix, 410, 680, { size: 14, color: '#e8dcc4', lh: 21 });
    if (o.msg) { V.panel(ctx, ix - 8, 534, 690, 58, { r: 8 }); V.para(ctx, o.msg, ix + 8, 544, 660, { size: 14, color: '#3a2410', lh: 20 }); }
    const inBattle = App.scene === 'battle' && BS && S().b && S().b.kind === 'battle';
    btn({ x: ix, y: 604, w: 250, h: 56, label: '試す（試し詠唱）', size: 18, key: 'practice', on: () => { App.overlay = null; saveGame(); startPractice(inBattle ? S().b.room : null); } });
    btn({ x: ix + 430, y: 604, w: 240, h: 56, label: 'とじる', kind: 'main', size: 20, key: 'close', on: closeEditor });
  }

  // ======================================================================
  // 更新
  // ======================================================================
  function update(dt) {
    App.t += dt;
    if (App.toast) { App.toast.t += dt; if (App.toast.t > App.toast.dur) App.toast = null; }
    if (App.story) App.story.t += dt;
    if (App.overlay) App.overlay.t = (App.overlay.t || 0) + dt;
    if (App.scene === 'ending') App.endT = (App.endT || 0) + dt;
    if (App.scene === 'map' && App.map) updateMap(dt);
    if (App.scene !== 'battle' || !BS) return;
    const s = S(), b = s.b;
    if (!b) return;
    const sdt = dt * SPD();
    if (BS.banner) { BS.banner.t += dt; if (BS.banner.t > 2.4) BS.banner = null; }
    if (BS.big) BS.big.t += dt;
    if (BS.over) BS.over.t += dt;
    BS.shake = Math.max(0, BS.shake - dt * 1.8);
    BS.flash = Math.max(0, BS.flash - dt * 1.6);
    if (BS.whiteout) BS.whiteout = Math.min(0.85, BS.whiteout + dt * 0.45);
    BS.hurt = Math.max(0, BS.hurt - dt);
    BS.cast = Math.max(0, BS.cast - dt * 2.5);
    for (let r = 0; r < 3; r++) BS.plate[r] = Math.max(0, BS.plate[r] - dt * 2);
    BS.wv.forEach(v => { v.t += dt; v.shake = Math.max(0, v.shake - dt * 1.5); });
    for (let i = 0; i < BS.stopFlash.length; i++) BS.stopFlash[i] = Math.max(0, (BS.stopFlash[i] || 0) - dt * 4);
    if (BS.spin) {
      const sp = BS.spin;
      sp.t += sdt;
      const n = s.reels.length;
      s.reels.forEach((R, i) => {
        if (sp.done[i]) return;
        if (sp.t >= sp.stops[i]) {
          sp.done[i] = true;
          BS.vis[i] = nearest(BS.vis[i], R.pos, R.strip.length) - 0.3;
          BS.stopFlash[i] = 1;
          A.play('stop', { i: i, last: i === n - 1 });
          // この止まりで行が伸びたら、チャイム
          let mx = 0;
          for (let r = 0; r < 3; r++) {
            const k = runLen(s, r, i + 1);
            if (k === i + 1 && k >= 2) { mx = Math.max(mx, k); for (let q = 0; q <= i; q++) BS.lit[r][q] = 1; }
          }
          if (mx >= 2) { A.play('chime', { i: 2 + mx }); BS.stopFlash[i] = 1.6; }
          if (sp.reach >= 0 && i === n - 2) A.play('reach');
        } else {
          const prev = BS.vis[i];
          BS.vis[i] += sdt * 15;
          if (Math.floor(BS.vis[i]) !== Math.floor(prev)) A.play('tick', { i: i });
        }
      });
      if (sp.done.every(x => x)) {
        // 行きすぎから戻るまで少し待つ
        sp.settle = (sp.settle || 0) + sdt;
        if (sp.settle > 0.12) finishSpin();
      }
    }
    if (!BS.spin || BS.spin.done.some(x => x)) {
      s.reels.forEach((R, i) => {
        if (BS.spin && !BS.spin.done[i]) return;
        const target = nearest(BS.vis[i], R.pos + (b.offs[i] || 0), R.strip.length);
        BS.vis[i] += (target - BS.vis[i]) * Math.min(1, dt * 18);
        if (Math.abs(target - BS.vis[i]) < 0.002) BS.vis[i] = target;
      });
    }
    runTL(sdt);
    for (const f of BS.fx) f.t += sdt;
    BS.fx = BS.fx.filter(f => f.t < f.d);
    for (const p of BS.pops) p.t += sdt;
    BS.pops = BS.pops.filter(p => p.t < 1.1);
    for (const id in BS.dm) {
      const d = BS.dm[id];
      const k = Math.min(1, sdt * 8);
      if (d.flee) { d.x += sdt * 300; d.fleeT = (d.fleeT || 0) + sdt * 1.2; if (d.fleeT >= 1) delete BS.dm[id]; continue; }
      d.x += (d.tx - d.x) * k; d.y += (d.ty - d.y) * k;
      if (d.alpha < 1) d.alpha = Math.min(1, d.alpha + sdt * 3);
      if (d.flash > 0) d.flash -= sdt;
      if (d.lunge > 0) d.lunge = Math.max(0, d.lunge - sdt);
      if (d.dying > 0) { d.dying -= sdt * 2.4; if (d.dying <= 0) delete BS.dm[id]; }
    }
    // 検証用：戦いを自動で進める（GR18.autoplay）
    if (App.autoplay && !BS.tl && !BS.spin && !App.overlay && !BS.over) {
      if (b.phase === 'spin') doSpin();
      else if (b.phase === 'aim') { const best = G.bestShift(s); if (best) { b.offs = best.offs.slice(); b.mp = G.mpOf(s) - G.offTotal(b); } BS.missNote = true; doCast(); }
    }
    if (BS.autoT > 0 && b.phase === 'spin' && !BS.tl && !App.overlay && !BS.over) {
      BS.autoT -= dt;
      if (BS.autoT <= 0) doSpin();
    }
  }
  function updateMap(dt) {
    const s = S(), M = App.map;
    M.t += dt;
    if (M.shell) M.shell.t += dt;
    if (M.focus) { M.focus.t += dt; if (M.focus.t > 5) M.focus = null; }
    if (M.auto && !M.walk && !App.overlay) { M.auto.t -= dt; if (M.auto.t <= 0) { const id = M.auto.id; M.auto = null; clickRoom(id); } }
    for (const id in M.anim) { M.anim[id].t += dt; if (M.anim[id].t > 2) delete M.anim[id]; }
    if (M.walk) {
      const w = M.walk;
      w.t += dt * App.speed * (cfg.fast ? 1.6 : 1);
      if (w.t >= 0.34) {
        w.t = 0; w.i++;
        A.play('walk');
        if (w.i >= w.path.length - 1) {
          const id = w.path[w.path.length - 1];
          M.walk = null;
          arrive(id);
        } else {
          // 途中の部屋も「いる」ことにする
          s.at = w.path[w.i];
        }
      }
      const cur = M.walk ? G.room(M.walk.path[M.walk.i]) : G.room(s.at);
      M.tgt = clamp(cur.y - 330, 0, D.MAP_H - H);
    }
    if (M.pending && !App.overlay) {
      M.pending.t -= dt;
      if (M.pending.t <= 0) {
        const p = M.pending; M.pending = null;
        if (p.items) openItems(p.id);
        else if (p.end) startEnding();
        else startBattle(p.id);
      }
    }
    if (M.drag == null) M.cam += (M.tgt - M.cam) * Math.min(1, dt * 6);
  }

  // ======================================================================
  // 入力
  // ======================================================================
  function toGame(ev) {
    const r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / SC, y: (ev.clientY - r.top) / SC };
  }
  function hitBtn(x, y) {
    const top = App.overlay ? 1 : 0;
    for (let i = App.btns.length - 1; i >= 0; i--) {
      const b = App.btns[i];
      if (b.layer < top) continue;
      if (b.ell) {
        const r = D.ROOMS[b.room];
        const dx = (x - r.x) / (r.rx + 6), dy = (y + App.map.cam - r.y) / (r.ry + 6);
        if (dx * dx + dy * dy <= 1) return b;
        continue;
      }
      if (inside(x, y, b)) return b;
    }
    return null;
  }
  cv.addEventListener('pointermove', ev => {
    const p = toGame(ev); App.mx = p.x; App.my = p.y;
    if (BS && BS.drag && App.scene === 'battle') {
      const d = BS.drag;
      const dy = p.y - d.y;
      if (Math.abs(dy) > 44) { shiftReel(d.i, dy < 0 ? 1 : -1); d.y = p.y; d.moved = true; }
    }
    if (App.scene === 'map' && App.map && App.map.drag != null) {
      const M = App.map;
      const dy = p.y - M.drag;
      if (Math.abs(dy) > 3) M.dragMoved = true;
      M.cam = clamp(M.cam - dy, 0, D.MAP_H - H); M.tgt = M.cam; M.drag = p.y;
    }
  });
  cv.addEventListener('pointerdown', ev => {
    A.init();
    const p = toGame(ev); App.mx = p.x; App.my = p.y;
    App.tipBlock = App.tipKey;
    if (ev.button === 2) { rightClick(); return; }
    const b = hitBtn(p.x, p.y);
    if (App.scene === 'map' && App.map && !App.overlay && p.x < MAPW && (!b || b.ell)) {
      App.map.drag = p.y; App.map.dragMoved = false; App.map.downBtn = b;
      return;
    }
    if (b) { if (!b.disabled && b.on) b.on(); return; }
    if (App.scene === 'battle' && BS && !App.overlay) {
      for (let i = 0; i < S().reels.length; i++) {
        const x = reelX(i);
        if (p.x >= x && p.x <= x + L.RW && p.y >= L.Y && p.y <= L.Y + L.RH * 3) { BS.drag = { i: i, y: p.y }; return; }
      }
    }
  });
  window.addEventListener('pointerup', () => {
    if (BS) BS.drag = null;
    if (App.scene === 'map' && App.map && App.map.drag != null) {
      const M = App.map;
      const b = M.downBtn;
      M.drag = null;
      if (!M.dragMoved && b && b.on) b.on();
      M.downBtn = null;
    }
  });
  cv.addEventListener('contextmenu', ev => ev.preventDefault());
  function rightClick() {
    const o = App.overlay;
    if (o) {
      if (o.kind === 'editor') {
        if (o.held) { o.held = null; return; }
        if (o.forge) { o.forge = false; return; }
        const b = hitBtn(App.mx, App.my);
        if (b && b.onRight) b.onRight();
        return;
      }
      if (o.kind !== 'items') App.overlay = null;
      return;
    }
    if (App.scene === 'battle') resetShift();
  }
  cv.addEventListener('wheel', ev => {
    const p = toGame(ev);
    if (App.scene === 'map' && App.map && !App.overlay && p.x < MAPW) {
      ev.preventDefault();
      const M = App.map;
      M.tgt = clamp(M.tgt + ev.deltaY * 0.8, 0, D.MAP_H - H);
      return;
    }
    if (App.scene !== 'battle' || !BS || App.overlay) return;
    for (let i = 0; i < S().reels.length; i++) {
      const x = reelX(i);
      if (p.x >= x && p.x <= x + L.RW && p.y >= L.Y - L.PK && p.y <= L.Y + L.RH * 3 + L.PK) { ev.preventDefault(); shiftReel(i, ev.deltaY > 0 ? 1 : -1); return; }
    }
  }, { passive: false });
  window.addEventListener('keydown', ev => {
    A.init();
    const k = ev.key;
    if (k === 'm' || k === 'M') { toggleMute(); return; }
    const o = App.overlay;
    if (o) {
      if (k === 'Escape') { if (o.kind === 'editor') closeEditor(); else if (o.kind !== 'items') App.overlay = null; }
      else if (o.kind === 'help' && (k === 'ArrowRight' || k === ' ')) { if (o.page < D.HELP.length - 1) o.page++; else App.overlay = null; }
      else if (o.kind === 'help' && k === 'ArrowLeft') { if (o.page > 0) o.page--; }
      else if (o.kind === 'items' && (k === ' ' || k === 'Enter')) takeItems();
      ev.preventDefault();
      return;
    }
    if (App.scene === 'story') { if (k === ' ' || k === 'Enter') { storyNext(); ev.preventDefault(); } if (k === 'Escape') { const f = App.story.then; App.story = null; f(); } return; }
    if (App.scene === 'map') {
      if (k === 'Escape') { App.overlay = { kind: 'menu', t: 0 }; return; }
      if (k === 'ArrowUp' || k === 'ArrowDown') { const M = App.map; M.tgt = clamp(M.tgt + (k === 'ArrowUp' ? -120 : 120), 0, D.MAP_H - H); ev.preventDefault(); }
      return;
    }
    if (App.scene !== 'battle' || !BS) return;
    if (k === 'Escape') { App.overlay = { kind: 'menu', t: 0 }; return; }
    if (BS.over) {
      if ((k === '1' || k === '2') && S().b && S().b.pick) { const b = App.btns.find(x => x.key === 'pick' + (+k - 1)); if (b) b.on(); return; }
      if ((k === ' ' || k === 'Enter') && BS.over.t > 0.8) { const b = App.btns.find(x => x.key === 'next' || x.key === 'retry'); if (b && !b.disabled) b.on(); ev.preventDefault(); }
      return;
    }
    if (k === ' ' || k === 'Enter') {
      ev.preventDefault();
      const b = S().b;
      if (BS.tl) BS.rush = true;
      else if (BS.spin) stopSpinNow();
      else if (b.phase === 'spin') doSpin();
      else if (b.phase === 'aim') doCast();
      return;
    }
    const up = 'qwert'.indexOf(k.toLowerCase()), dn = 'asdfg'.indexOf(k.toLowerCase());
    if (up >= 0) { shiftReel(up, -1); return; }
    if (dn >= 0) { shiftReel(dn, 1); return; }
    if (k === 'z' || k === 'Z') { resetShift(); return; }
    if (k === 'h' || k === 'H') { showHint(); return; }
  });

  // ======================================================================
  // ループ
  // ======================================================================
  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    dt = clamp(dt, 0, 0.05);
    try {
      if (!App.debugHold) { update(dt); draw(); }
    } catch (e) {
      if (!App.errOnce) { App.errOnce = true; console.error(e); }
    }
    requestAnimationFrame(loop);
  }
  A.music('title');
  requestAnimationFrame(loop);

  // ======================================================================
  // 検証用の窓口（ツールから使う）
  // ======================================================================
  window.GR18 = {
    App: App, cfg: cfg,
    scene: () => App.scene,
    state: () => S(),
    bs: () => BS,
    overlay: () => (App.overlay ? App.overlay.kind : null),
    buttons: () => App.btns.filter(b => !b.invisible || b.key).map(b => ({ key: b.key || null, label: b.label, x: b.ell ? D.ROOMS[b.room].x : b.x + b.w / 2, y: b.ell ? D.ROOMS[b.room].y - App.map.cam : b.y + b.h / 2, disabled: !!b.disabled })),
    busy: () => !!((BS && (BS.tl || BS.spin)) || (App.map && App.scene === 'map' && (App.map.walk || App.map.pending))),
    phase: () => (S() && S().b ? S().b.phase : null),
    suggest: () => { const s = S(); if (!s || !s.b || s.b.phase !== 'aim') return null; const best = G.bestShift(s); return best ? best.offs.map((o, i) => o - s.b.offs[i]) : null; },
    roomXY: id => { const r = D.ROOMS[id]; return { x: r.x, y: r.y - App.map.cam }; },
    camTo: id => { const M = App.map; M.tgt = M.cam = clamp(D.ROOMS[id].y - 330, 0, D.MAP_H - H); },
    path: id => findPath(S().at, id),
    newGame: seed => { newGame(seed); App.story = null; openMap(); },
    goto: (id, fn) => { if (!App.s) App.s = G.newGame(URLSEED || 1); if (fn) fn(App.s); App.map = null; App.seenK = null; App.s.at = id; G.enterRoom(App.s, id); openMap(); },
    battle: (id, kind) => startBattle(id, kind),
    editor: () => openEditor(),
    hold: v => { App.debugHold = v; },
    step: n => { for (let i = 0; i < (n || 1); i++) update(1 / 60); draw(); },
    draw: () => draw(),
    spinAt: pos => doSpin(pos),
    setSpeed: v => { App.speed = v; },
    autoplay: v => { App.autoplay = v; },
    practiceRoom: id => startPractice(id),
    G: G,
    // 組みかえの次の一手（ボット用）：本物のクリック先の key を返す
    planEditor: () => {
      const s = S(), o = App.overlay;
      if (!o || o.kind !== 'editor') return null;
      const pl = G.planEdit(s);
      if (pl.forge) return o.forge ? { key: `cell${pl.ri}_${pl.ci}` } : { key: 'forge' };
      if (o.forge) return { key: 'forge' };
      if (!pl.place) return { key: 'close' };
      if (!o.held || o.held.from !== 'bag' || o.held.i !== pl.bi) return { key: 'bag' + pl.bi };
      return { key: `cell${pl.ri}_${pl.ci}` };
    },
  };
})();
