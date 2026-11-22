// くるり、呪いほどき — 進行・入力・画面
(function () {
  'use strict';
  const W = 1280, H = 720;
  const RR = window.RR, D = window.RRD, G = window.RG, V = window.RV, A = window.RA;
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
  const SAVE = 'kururi16_save', CFG = 'kururi16_cfg', REC = 'kururi16_rec';
  function load(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できない環境では何もしない */ } }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) { /* 同上 */ } }
  const cfg = Object.assign({ mute: false, vol: 0.7, bgm: 0.5, fast: false }, load(CFG) || {});
  A.setMuted(cfg.mute);
  const saveCfg = () => store(CFG, cfg);
  function saveGame() { if (App.s && !App.s.b) store(SAVE, App.s); }

  // ---------- アプリ ----------
  const App = {
    scene: 'title', s: null, t: 0, btns: [], frame: [], mx: -1, my: -1, layer: 0,
    overlay: null, talk: null, toast: null, story: null, result: null, debugHold: false,
  };
  const S = () => App.s;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const inside = (x, y, b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

  function btn(o) {
    o.layer = o.layer !== undefined ? o.layer : App.drawLayer;
    if (o.layer < App.layer) o.hot = false;
    else o.hot = inside(App.mx, App.my, o);
    App.frame.push(o);
    V.button(ctx, o, App.t);
    return o;
  }
  function toast(text, dur) { App.toast = { text: text, t: 0, dur: dur || 2.2 }; }

  // ---------- 盤面の配置 ----------
  const F = { X: 178, Y: 138, CW: 120, CH: 120, PEEK: 40 };
  const cxOf = c => F.X + c * F.CW, cyOf = r => F.Y + r * F.CH;

  // ---------- 戦いの画面状態 ----------
  let BS = null;
  function newBS() {
    const s = S();
    return {
      vis: s.reels.map(r => r.pos), spin: null, anim: null, fx: [], pops: [], runners: [], crowd: [], bolts: [],
      mdisp: {}, ghosts: null, exiting: [], preview: null, lit: {}, shake: 0, banner: null,
      msg: '', msgKey: '', tut: null, hint: null, freshShown: 0, total: 0, drag: null, lastPos: null,
      castT: 0, bigText: null, flash: 0, wardHit: 0, practice: null, compare: null,
    };
  }
  function battle() { return S() && S().b; }

  function startBattle(opts) {
    opts = opts || {};
    const s = S();
    const def = D.STAGES[s.stage];
    saveGame();
    G.startStage(s);
    BS = newBS();
    BS.def = def;
    const b = s.b;
    BS.total = b.mons.length + b.sched.length;
    for (const m of b.mons) setDisp(m, true);
    BS.banner = { title: def.name, sub: def.sub, t: 0 };
    BS.tut = def.tutorial ? { kind: def.tutorial, step: 0 } : null;
    App.scene = 'battle';
    A.music(def.bg);
    onTurnStart();
  }

  function startPractice() {
    const s = S();
    const R = s.reels.length;
    // わら人形を、決まった形に並べる（地方が進むほど呪いが強い）
    const st = s.stage;
    const base = [2, 3, 4, 6, 7, 9, 11][Math.min(6, st)];
    const pattern = [[0, 1], [1, 0], [1, 2], [2, 1], [3, 0], [3, 2], [4, 1], [2, 0], [0, 2], [4, 0]];
    RR.startBattle(s, { id: 'practice', reels: R, hearts: 9, waves: [] }, { practice: true });
    const b = s.b;
    for (const [c, r] of pattern) {
      if (c >= R) continue;
      b.mons.push(RR.makeMon(b, { kind: 'dummy', r: r, hp: base + ((c + r) % 3), w: 1, h: 1, opt: {} }, c));
    }
    b.mpMax = s.mpMax; b.mp = s.mpMax;
    BS = newBS();
    // 前の試しの回転と記録を引きつぐ（工房で組み替えたあと、同じ回転で比べられる）
    const keep = App.lastPractice && App.lastPractice.R === R;
    BS.practice = { dummies: JSON.parse(JSON.stringify(b.mons)), spinPos: keep ? App.lastPractice.pos : null, results: keep ? App.lastPractice.results : [], lastRes: null };
    for (const m of b.mons) setDisp(m, true);
    BS.total = b.mons.length;
    App.scene = 'battle';
    BS.msg = '試し詠唱：わら人形を相手に、何度でも回してためせる。工房で組み替えたら、「同じ回転」で前と比べられる。';
    App.practiceBack = 'workshop';
  }

  function setDisp(m, instant) {
    const x = cxOf(m.c + m.w / 2), y = cyOf(m.r + m.h) - 10;
    const d = BS.mdisp[m.id];
    if (!d || instant) BS.mdisp[m.id] = { x: instant && m.c >= battle().R ? x + 40 : x, y: y, tx: x, ty: y, a: instant ? 0 : 1 };
    else { d.tx = x; d.ty = y; }
  }

  // ---------- チュートリアル ----------
  const TUT1 = {
    0: { spin: [3, 6, 1], before: '呪われた村人が、結界へ歩いてくる。まずは［回す］（スペース）で、床の魔法陣を回そう。', after: '小鬼の足元に「光の紋」が止まった。光の紋の上に立つ魔物は、詠唱で呪いがほどける。［詠唱］を押そう。', noShift: true },
    1: { spin: [1, 2, 1], before: '次の小鬼が来た。回そう。', after: '足元に紋がない……。3番目のリールの ▲ を押すと、床が一つ上へずれて、下の光の紋が足元に来る。ずらすと魔力（右上の玉）を1使う。', arrow: { c: 2, d: 1 } },
    2: { spin: [1, 3, 0], before: 'この小鬼は呪いが4。光の紋ひとつでは2しかほどけない。回そう。', after: '同じ紋が上下左右でとなり合うと「つながり」になり、力を合わせる。光は、つながった紋の数の2倍ほどく。2つなら4。' },
    3: { before: 'ここからは自由に。いい並びが出たら、回す前に［固定］を押すと、そのリールは回らずに残る（魔力1）。' },
  };

  function onTurnStart() {
    const b = battle();
    if (!b || BS.practice) return;
    BS.hint = null;
    if (b.finale) {
      const f = b.finale;
      setMsg(f.idx === 0 ? '王国じゅうに残った呪いが、最後の力で押し寄せてきた！ 床いっぱいの人々を、3回の大詠唱で救おう。魔力は満ちて、いつもより3多い。'
        : '大詠唱 ' + (f.idx + 1) + ' / ' + f.casts + '：次の人々が押し寄せた。呪いは前より強い。育てたリールの力を見せよう。');
      return;
    }
    if (BS.tut && BS.tut.kind === 1) {
      const st = TUT1[b.turn];
      if (st && st.before) setMsg(st.before);
      else if (b.turn === 4) setMsg('魔物は一手ごとに一歩進む。左の結界までたどり着かれると、結界がひとつ欠ける。赤い「！」の魔物は、次の一歩で結界にぶつかる。');
      else if (b.turn === 5) setMsg('魔物の左下の小さな丸は、その足元の紋。上下にはみ出した札は、▲▼でずらすと入ってくる紋。');
      else if (b.turn === 6) setMsg('ずらしは、戻せば魔力も戻る。いろいろ試して、緑の見こみを見てから詠唱しよう。迷ったら［ヒント］。');
      else setMsg('');
    } else if (BS.tut && BS.tut.kind === 2 && b.turn === 0) {
      setMsg('夕暮れの村。工房で置いた紋には「新」の印がついている。まずは回そう。');
    } else if (b.turn === 0) {
      setMsg(D.STAGES[S().stage].sub);
    } else setMsg('');
  }
  function onAim() {
    const b = battle();
    if (BS.practice) return;
    if (BS.tut && BS.tut.kind === 1) {
      const st = TUT1[b.turn];
      if (st && st.after) setMsg(st.after);
    } else if (BS.tut && BS.tut.kind === 2 && b.turn === 0) {
      if (BS.teach) setMsg('工房で置いた「新」の紋が見えている。光る ▲▼ で一つずらして、ほかの光とつなげてみよう。つながりが小鬼の足元までとどけば、まとめて力がかかる。');
      else setMsg('▲▼でずらして、紋のつながりを魔物の足元へ。');
    }
  }
  function setMsg(t) { BS.msg = t || ''; }

  // 二戦目のはじめ：工房で置いた紋が一つのずらしで効く回転を探す
  function findTeachSpin() {
    const s = S(), b = s.b, R = b.R;
    const reels = s.reels.slice(0, R);
    const fresh = [];
    reels.forEach((rl, c) => rl.strip.forEach((cell, k) => { if (cell.fresh && cell.t !== 'blank') fresh.push([c, k]); }));
    if (!fresh.length) return null;
    const n = reels.map(r => r.strip.length);
    const cands = [];
    const pos = new Array(R).fill(0);
    const total = n.reduce((a, v) => a * v, 1);
    for (let i = 0; i < total; i++) {
      let x = i;
      for (let c = 0; c < R; c++) { pos[c] = x % n[c]; x = Math.floor(x / n[c]); }
      const tr = reels.map((rl, c) => ({ strip: rl.strip, pos: pos[c] }));
      const res0 = RR.evaluate(b, tr, new Array(R).fill(0));
      const sc0 = RR.scoreResult(b, res0, 0);
      // 1つのずらしで、新しい紋が魔物を打つつながりに入るか
      let good = null;
      for (let c = 0; c < R && !good; c++) for (const d of [-1, 1]) {
        const offs = new Array(R).fill(0); offs[c] = d;
        const res = RR.evaluate(b, tr, offs);
        const sc = RR.scoreResult(b, res, 1);
        if (sc < sc0 + 6) continue;
        const ok = res.clusters.some(cl => cl.struck.length && cl.cells.some(([x2, y2]) => { const rl = tr[x2]; return rl.strip[RR.idxAt(rl, y2, offs[x2])].fresh; }) && cl.cells.length >= 2);
        if (ok) good = { c: c, d: d };
      }
      if (good) cands.push({ pos: pos.slice(), arrow: good });
    }
    if (!cands.length) return null;
    return cands[RR.randInt(s, cands.length)];
  }

  // ---------- 戦いの操作 ----------
  function busy() { return !!(BS && (BS.spin || BS.anim)); }

  function doSpin() {
    const s = S(), b = s.b;
    if (!b || b.phase !== 'spin' || busy()) return;
    A.init();
    let forced = null;
    BS.teach = null;
    if (BS.practice && BS.practice.sameNext && BS.practice.spinPos) forced = BS.practice.spinPos.slice();
    else if (BS.tut && BS.tut.kind === 1 && TUT1[b.turn] && TUT1[b.turn].spin) forced = TUT1[b.turn].spin.slice();
    else if (BS.tut && BS.tut.kind === 2 && b.turn === 0) {
      const t = findTeachSpin();
      if (t) { forced = t.pos; BS.teach = t; }
    }
    const held = b.holds.slice();
    const from = BS.vis.slice();
    const spun = RR.spin(s, forced);
    if (!spun) return;
    if (BS.practice) { BS.practice.wasSame = !!BS.practice.sameNext; BS.practice.spinPos = s.reels.slice(0, b.R).map(r => r.pos); BS.practice.sameNext = false; }
    const items = [];
    spun.forEach((c, i) => {
      const n = s.reels[c].strip.length, p = s.reels[c].pos;
      const f = from[c];
      const baseTo = p + n * Math.floor((f - p) / n);
      items.push({ c: c, from: f, to: baseTo - n * (2 + i), dur: 0.5 + i * 0.17, done: false });
    });
    BS.spin = { t: 0, items: items, ticks: 0 };
    if (held.some(Boolean)) A.play('hold');
    A.play('spin');
    BS.preview = null;
  }
  function stopSpinEarly() {
    if (!BS.spin) return;
    for (const it of BS.spin.items) it.dur = Math.min(it.dur, BS.spin.t + 0.08 + it.c * 0.04);
  }
  function spinDone() {
    BS.spin = null;
    const s = S();
    s.reels.slice(0, s.b.R).forEach((r, c) => { BS.vis[c] = r.pos; });
    refreshPreview(true);
    onAim();
  }
  function refreshPreview(sound) {
    const s = S();
    if (!s.b || s.b.phase !== 'aim') { BS.preview = null; return; }
    const prevBest = BS.preview ? Math.max(0, ...BS.preview.clusters.map(c => c.cells.length)) : 0;
    BS.preview = RR.preview(s);
    const best = Math.max(0, ...BS.preview.clusters.map(c => c.cells.length));
    if (sound && best >= 2 && best !== prevBest) A.play('link', { n: best });
  }
  function doShift(c, d) {
    const s = S(), b = s.b;
    if (!b || b.phase !== 'aim' || busy()) return false;
    if (!RR.shift(s, c, d)) { A.play('deny'); toast('魔力が足りない'); return false; }
    A.play('shift', { d: d });
    if (BS.hint && BS.hint.every((o, k) => o === (b.offs[k] || 0))) BS.hint = null;
    refreshPreview(true);
    if (BS.tut && BS.tut.kind === 1 && b.turn === 1) setMsg('光の紋が足元に来た。予測（緑の数字）で「ほどける」と出たら、［詠唱］！');
    return true;
  }
  function doReset() {
    const s = S(), b = s.b;
    if (!b || b.phase !== 'aim' || busy()) return;
    if (!b.offs.some(Boolean)) return;
    RR.resetShift(s);
    A.play('take');
    refreshPreview(false);
  }
  function doHold(c) {
    const s = S(), b = s.b;
    if (!b || b.phase !== 'spin' || busy()) return;
    if (BS.tut && BS.tut.kind === 1 && b.turn < 3) { toast('固定は、もう少しあとで'); return; }
    if (RR.toggleHold(s, c)) A.play('click');
    else { A.play('deny'); toast(b.holds.filter(Boolean).length + 1 >= b.R ? 'すべてのリールは固定できない' : '魔力が足りない'); }
  }
  function doHint() {
    const s = S(), b = s.b;
    if (!b || b.phase !== 'aim' || busy()) return;
    const best = RR.bestShift(s, { budget: RR.mpLeft(b) + RR.mpUsed(b) });
    if (!best) return;
    const same = best.offs.every((o, c) => o === (b.offs[c] || 0));
    BS.hint = same ? null : best.offs;
    toast('ヒント：' + (same ? 'いまの並びのまま詠唱するのがよさそう（' : '光る ▲▼ のぶんだけずらすと、') + describeResult(b, best.res) + (same ? '）' : ''), 4);
  }
  // 見こみを短い文にする（主をほどくと残りもほどける分も数える）
  function describeResult(b, res) {
    const inField = b.mons.filter(m => m.c < b.R);
    const n = res.bossDown ? inField.length : res.purified.length;
    const dmg = Object.values(res.total).reduce((a, v) => a + v, 0);
    const parts = [];
    if (n) parts.push(n + '人ほどける');
    const boss = inField.find(m => m.boss);
    if (boss && res.total[boss.id] && !res.bossDown) parts.push(boss.name + 'に ' + res.total[boss.id]);
    if (res.frozen.length) parts.push(res.frozen.length + '体凍る');
    if (!parts.length) parts.push(dmg ? '呪いを ' + dmg + ' ほどく' : '何も起きない');
    else if (dmg) parts.push('合計 ' + dmg);
    return parts.join('・');
  }

  // ---------- 詠唱と、魔物の歩み ----------
  function doCast() {
    const s = S(), b = s.b;
    if (!b || b.phase !== 'aim' || busy()) return;
    A.init();
    // 何もほどけない詠唱なら、ずらせば届いたかを調べておく（知らせは一戦に一度）
    BS.couldHave = false;
    if (!BS.missTip && !BS.practice) {
      const cur = RR.preview(s);
      if (!Object.keys(cur.total).length) { const bs = RR.bestShift(s, { budget: b.mp }); BS.couldHave = !!(bs && Object.keys(bs.res.total).length); }
    }
    // 演出のために、詠唱前の魔物を写しておく
    BS.ghosts = b.mons.map(m => Object.assign({}, m, { shown: m.hp }));
    const offs = b.offs.slice();
    const oldPos = s.reels.slice(0, b.R).map(r => r.pos);
    const res = RR.cast(s);
    if (!res) return;
    // 見た目の位置をつなげる（ずらした先の位置を、新しい pos として読み替える）
    s.reels.slice(0, b.R).forEach((r, c) => { BS.vis[c] = r.pos + (BS.vis[c] - (oldPos[c] + offs[c])); });
    BS.preview = null;
    BS.hint = null;
    BS.castT = 0;
    A.play('cast');
    const ev = [];
    const ncl = res.clusters.length;
    const per = ncl ? clamp(1.1 / ncl, 0.13, 0.32) : 0;
    let t = 0.28;
    res.clusters.forEach((cl, i) => { ev.push({ t: t, fn: () => fxCluster(cl, i, res) }); t += per + (i === ncl - 1 && cl.cells.length >= 5 ? 0.15 : 0); });
    t += 0.25;
    const freedNow = res.freed.filter(f => res.after.indexOf(f.id) < 0);
    freedNow.forEach((f, i) => ev.push({ t: t + i * 0.07, fn: () => fxFree(f, i, freedNow.length) }));
    t += freedNow.length * 0.07 + (freedNow.length ? 0.3 : 0);
    if (res.bossDown) {
      ev.push({ t: t, fn: () => { A.play('boss'); BS.flash = 1; BS.bigText = { text: '呪いの主がほどけた！', t: 0 }; BS.shake = 12; } });
      t += 0.6;
      const rest = res.freed.filter(f => res.after.indexOf(f.id) >= 0);
      rest.forEach((f, i) => ev.push({ t: t + i * 0.05, fn: () => fxFree(f, freedNow.length + i, res.freed.length) }));
      t += rest.length * 0.05 + 0.5;
    }
    const nFreed = res.freed.length;
    if (res.finaleCast) ev.push({ t: t - 0.2, fn: () => { A.play('big'); BS.bigText = { text: '大詠唱 ' + res.finaleCast + '：' + nFreed + '人の呪いがほどけた！', t: 0 }; if (nFreed >= 10) BS.shake = 14; } });
    else if (nFreed >= 4) ev.push({ t: t - 0.2, fn: () => { A.play('big'); BS.bigText = BS.bigText || { text: nFreed + '人の呪いが、いっぺんにほどけた！', t: 0 }; } });
    if (res.finaleStart) { ev.push({ t: t + 0.1, fn: () => { BS.bigText = { text: '最後の大詠唱！', t: 0 }; A.play('unlock'); } }); t += 1.2; }
    // 新しい紋が効いたか
    const freshHit = res.clusters.some(cl => cl.struck.length && cl.cells.some(([x, y]) => res.grid[x][y].fresh));
    if (freshHit && BS.freshShown < 2) {
      BS.freshShown++;
      ev.push({ t: 0.5, fn: () => toast('工房で置いた紋（新）が効いた！', 2.4) });
    }
    if (!BS.practice && !b.finale && !res.totalDmg && BS.missTip !== true && BS.couldHave) {
      BS.missTip = true;
      ev.push({ t: 0.4, fn: () => toast('ずらせば、紋を魔物の足元へ動かせた。迷ったら［ヒント］（H）', 3.2) });
    }
    BS.anim = { t: 0, ev: ev, end: t + 0.2, done: () => afterCast(res, offs) };
    if (BS.practice) BS.practice.lastRes = res;
    if (res.purified.length + res.after.length > (S().stats.bestCast || 0) && !BS.practice) S().stats.bestCast = res.purified.length + res.after.length;
    if (res.totalDmg > (S().stats.bestDmg || 0) && !BS.practice) S().stats.bestDmg = res.totalDmg;
  }

  function fxCluster(cl, i, res) {
    const big = cl.cells.length;
    A.play('pillar', { n: big, el: cl.el });
    for (const [c, r] of cl.cells) {
      BS.lit[c + ',' + r] = { t: 0, el: cl.el };
      const x = cxOf(c + 0.5), y = cyOf(r + 0.5);
      BS.fx.push({ kind: 'pillar', x: x, y: y, el: cl.el, t: 0, life: 0.55 + Math.min(0.4, big * 0.03), big: big });
      for (let k = 0; k < 4 + Math.min(8, big); k++) {
        const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 120;
        BS.fx.push({ kind: 'spark', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, el: cl.el, t: 0, life: 0.5 + Math.random() * 0.4 });
      }
    }
    for (const [gc, gr] of cl.gems) BS.lit[gc + ',' + gr] = { t: 0, el: 'gem' };
    if (big >= 5) BS.shake = Math.max(BS.shake, 4 + big * 0.6);
    // 魔物への当たり
    for (const g of BS.ghosts) {
      const hs = (res.hits[g.id] || []).filter(h => h.ci === i);
      for (const h of hs) {
        const d = BS.mdisp[g.id];
        if (!d) continue;
        if (h.blocked) { BS.pops.push({ text: '弾いた', x: d.x, y: d.y - 40, t: 0, col: '#c8c0d8', size: 18 }); A.play('block'); continue; }
        g.shown = Math.max(0, g.shown - h.dmg);
        g.hurt = 0.25;
        BS.pops.push({ text: '−' + h.dmg, x: d.x + (Math.random() - 0.5) * 20, y: d.y - 40 - (g.boss ? F.CH * (g.h - 1) * 0.5 : 0), t: 0, col: V.EL[cl.el].g, size: 22 + Math.min(18, h.dmg * 0.6) });
        if (h.chain) {
          const ch = res.chains.find(z => z.ci === i && z.to === g.id);
          if (ch) {
            const fd = BS.mdisp[ch.from];
            if (fd) BS.bolts.push({ x1: fd.x, y1: fd.y - 40, x2: d.x, y2: d.y - 40, t: 0, life: 0.4 });
            A.play('zap');
          }
        }
      }
      if (cl.el === 'ice' && res.frozen.indexOf(g.id) >= 0 && cl.struck.indexOf(g.id) >= 0) { g.frozenFx = 1; A.play('freeze'); }
    }
  }
  function fxFree(f, i, n) {
    const d = BS.mdisp[f.id];
    const g = BS.ghosts && BS.ghosts.find(x => x.id === f.id);
    if (g) g.gone = true;
    const x = d ? d.x : cxOf(f.c + 0.5), y = d ? d.y : cyOf(f.r + 1);
    A.play('free', { i: Math.min(12, i) });
    for (let k = 0; k < (f.boss ? 50 : 18); k++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * (f.boss ? 260 : 140);
      BS.fx.push({ kind: k % 3 ? 'smoke' : 'spark', x: x, y: y - 40, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, el: 'light', t: 0, life: 0.6 + Math.random() * 0.5 });
    }
    BS.fx.push({ kind: 'ring', x: x, y: y - 40, t: 0, life: 0.6, big: f.boss ? 3 : 1 });
    const people = f.boss ? 1 : 1;
    for (let k = 0; k < people; k++) BS.runners.push({ who: f.who, x: x, y: y, t: 0, delay: 0.35 + Math.random() * 0.2, boss: f.boss, name: f.name });
    if (!BS.practice) BS.freedCount = (BS.freedCount || 0) + 1;
  }

  function afterCast(res) {
    BS.anim = null;
    BS.ghosts = null;
    const s = S(), b = s.b;
    if (BS.practice) {
      // 試し：結果を記録して、わら人形を元にもどす
      const P = BS.practice;
      const freshUsed = res.clusters.some(cl => cl.struck.length && cl.cells.some(([x, y]) => res.grid[x][y].fresh));
      P.results.unshift({ n: res.purified.length, dmg: res.totalDmg, best: Math.max(0, ...res.clusters.map(c => c.dmg)), same: P.wasSame, fresh: freshUsed });
      P.results = P.results.slice(0, 4);
      b.mons = JSON.parse(JSON.stringify(P.dummies));
      b.mp = b.mpMax; b.phase = 'spin'; b.over = null; b.offs = new Array(b.R).fill(0);
      BS.mdisp = {};
      for (const m of b.mons) { setDisp(m, false); BS.mdisp[m.id].a = 0; }
      return;
    }
    if (b.over) { endBattle(); return; }
    // 魔物が進む
    BS.exiting = [];
    const before = {};
    for (const m of b.mons) before[m.id] = { c: m.c, r: m.r, w: m.w, h: m.h };
    const adv = RR.advance(s);
    for (const m of b.mons) setDisp(m, false);
    for (const id of adv.spawned) { const m = b.mons.find(x => x.id === id); if (m) setDisp(m, true); }
    if (adv.spawned.length) A.play('appear');
    if (adv.moves.some(mv => mv.to !== mv.from)) A.play('step');
    for (const ex of adv.exits) {
      const d = BS.mdisp[ex.id];
      BS.exiting.push({ id: ex.id, k: ex.k, who: ex.who, boss: ex.boss, x: d ? d.x : F.X, y: d ? d.y : cyOf(ex.r + 1), t: 0, w: ex.boss ? 2 : 1, h: ex.h || 1, r: ex.r });
    }
    const ev = [];
    if (adv.exits.length) ev.push({ t: 0.32, fn: () => { A.play('ward'); BS.wardHit = 1; BS.shake = 8; toast(adv.bossOut ? '呪いの主が結界を破った……' : '呪われた人が結界にぶつかり、森へ逃げてしまった', 2.2); } });
    BS.anim = { t: 0, ev: ev, end: adv.exits.length ? 0.75 : 0.42, done: () => { BS.anim = null; BS.exiting = []; if (b.over) endBattle(); else onTurnStart(); } };
  }

  function endBattle() {
    const s = S(), b = s.b;
    if (BS.ex) {
      // 腕だめしの大詠唱：記録だけを残す
      const rec = load(REC) || {};
      const n = b.finale ? b.finale.rescued : 0;
      const prev = rec.exBest || 0;
      if (n > prev) { rec.exBest = n; store(REC, rec); }
      App.result = { out: { ex: true, win: true, rescued: n, prev: prev, best: b.finale ? b.finale.best : 0 }, t: 0 };
      A.play('win');
      return;
    }
    const def = D.STAGES[s.stage];
    const win = b.over === 'win';
    const rescuedWho = b.rescuedWho.slice();
    const out = G.finishBattle(s);
    RR.clearFresh(s);
    out.def = def;
    out.who = rescuedWho;
    App.result = { out: out, t: 0 };
    A.play(win ? 'win' : 'lose');
    saveGame();
    if (win && s.phase === 'ending') {
      const old = load(REC) || {};
      store(REC, { done: true, rescued: Math.max(old.rescued || 0, s.rescued), best: Math.max(old.best || 0, s.stats.bestCast), dmg: s.stats.bestDmg || 0, date: Date.now(),
        reels: s.reels.map(r => ({ strip: r.strip.map(c => ({ t: c.t, lv: c.lv })) })), mpMax: s.mpMax, mpRegen: s.mpRegen, exBest: old.exBest || 0 });
    }
  }

  // ---------- 更新 ----------
  function update(dt) {
    App.t += dt;
    if (App.toast) { App.toast.t += dt; if (App.toast.t > App.toast.dur) App.toast = null; }
    if (App.result) App.result.t += dt;
    if (App.scene === 'battle' && BS) updateBattle(dt);
    if (App.scene === 'map' && MS) MS.t += dt;
    if (App.scene === 'workshop' && WS) WS.t += dt;
    if (App.story) App.story.t += dt;
    if (App.scene === 'ending' && ES) ES.t += dt;
  }
  function updateBattle(dt) {
    const s = S(), b = s.b;
    const sp = cfg.fast ? 1.8 : 1;
    const adt = dt * sp;
    if (BS.banner) { BS.banner.t += dt; if (BS.banner.t > 2.6) BS.banner = null; }
    if (BS.bigText) { BS.bigText.t += dt; if (BS.bigText.t > 1.8) BS.bigText = null; }
    BS.flash = Math.max(0, BS.flash - dt * 2);
    BS.wardHit = Math.max(0, BS.wardHit - dt * 1.5);
    BS.shake = Math.max(0, BS.shake - dt * 30);
    // 回転
    if (BS.spin) {
      BS.spin.t += adt;
      let all = true;
      for (const it of BS.spin.items) {
        const k = clamp(BS.spin.t / it.dur, 0, 1);
        const e = k < 1 ? easeOutBack(k) : 1;
        BS.vis[it.c] = it.from + (it.to - it.from) * e;
        if (k >= 1 && !it.done) { it.done = true; A.play('stop', { i: it.c }); BS.vis[it.c] = it.to; }
        if (!it.done) all = false;
      }
      BS.spin.ticks += adt;
      if (BS.spin.ticks > 0.06 && !all) { BS.spin.ticks = 0; A.play('tick', { i: Math.floor(Math.random() * 4) }); }
      if (all) spinDone();
    } else if (b) {
      for (let c = 0; c < b.R; c++) {
        const target = s.reels[c].pos + (b.offs[c] || 0);
        BS.vis[c] = lerp(BS.vis[c], target, clamp(dt * 16, 0, 1));
        if (Math.abs(BS.vis[c] - target) < 0.002) BS.vis[c] = target;
      }
    }
    // 自動で回す（設定）：手番のはじめ、固定を選んでいなければ少し待って回す
    if (cfg.autoSpin && b && b.phase === 'spin' && !BS.anim && !BS.spin && !BS.practice && !App.overlay && !App.result && !(BS.tut && BS.tut.kind === 1 && b.turn < 4) && !b.holds.some(Boolean)) {
      BS.autoT = (BS.autoT || 0) + dt;
      if (BS.autoT > 0.9) { BS.autoT = 0; doSpin(); }
    } else if (BS) BS.autoT = 0;
    // 演出の時間割
    if (BS.anim && !App.debugHold) {
      BS.anim.t += adt;
      for (const e of BS.anim.ev) if (!e.fired && BS.anim.t >= e.t) { e.fired = true; e.fn(); }
      if (BS.anim.t >= BS.anim.end) { const d = BS.anim.done; d(); }
    }
    // 魔物の位置
    for (const id in BS.mdisp) {
      const d = BS.mdisp[id];
      d.x = lerp(d.x, d.tx, clamp(adt * 9, 0, 1));
      d.y = lerp(d.y, d.ty, clamp(adt * 9, 0, 1));
      d.a = Math.min(1, (d.a || 0) + dt * 3);
    }
    for (const ex of BS.exiting) { ex.t += adt; ex.x = lerp(ex.x, F.X - 30, clamp(adt * 8, 0, 1)); }
    for (const k in BS.lit) { BS.lit[k].t += adt; if (BS.lit[k].t > 0.9) delete BS.lit[k]; }
    for (const f of BS.fx) { f.t += adt; if (f.vx !== undefined) { f.x += f.vx * adt; f.y += f.vy * adt; f.vy += 160 * adt; f.vx *= 0.97; } }
    BS.fx = BS.fx.filter(f => f.t < f.life);
    for (const p of BS.pops) p.t += adt;
    BS.pops = BS.pops.filter(p => p.t < 1.1);
    for (const z of BS.bolts) z.t += adt;
    BS.bolts = BS.bolts.filter(z => z.t < z.life);
    // 救われた人は結界の向こうへ走っていく
    for (const r of BS.runners) {
      r.t += adt;
      if (r.t < r.delay) continue;
      r.x -= adt * (r.boss ? 150 : 230);
      if (r.x < 140 && !r.joined) {
        r.joined = true;
        if (BS.crowd.length < 34 && !BS.practice) BS.crowd.push({ who: r.who, x: 16 + Math.random() * 130, y: 470 + Math.random() * 120, t: Math.random() * 3 });
        A.play('coin');
      }
    }
    BS.runners = BS.runners.filter(r => r.x > -40);
  }
  function easeOutBack(k) { const c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); }

  // ---------- 描画：戦い ----------
  function drawBattle() {
    const s = S(), b = s.b;
    const def = BS.def || D.STAGES[Math.min(s.stage, D.STAGES.length - 1)];
    const t = App.t;
    let fog = BS.practice ? 0.2 : clamp(1 - (b ? b.rescued : 0) / Math.max(1, BS.total), 0, 1) * 0.9 + 0.1;
    if (b && b.finale) fog = 0.5 * (1 - b.finale.idx / b.finale.casts);
    ctx.save();
    if (BS.shake > 0) ctx.translate((Math.random() - 0.5) * BS.shake, (Math.random() - 0.5) * BS.shake);
    V.background(ctx, def.bg, BS.practice ? 'morning' : def.time, t, W, H, fog);
    if (!b) { ctx.restore(); return; }
    const R = b.R;
    // 魔法陣の台座
    const fx0 = F.X - 10, fy0 = F.Y - F.PEEK - 6, fw = R * F.CW + 20, fh = 3 * F.CH + F.PEEK * 2 + 12;
    ctx.save();
    V.rr(ctx, fx0, fy0, fw, fh, 18);
    ctx.fillStyle = 'rgba(14,10,26,0.72)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,120,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    // 接近の列
    const ax = cxOf(R);
    ctx.save();
    const ag = ctx.createLinearGradient(ax, 0, ax + F.CW, 0);
    ag.addColorStop(0, 'rgba(40,10,60,0.55)'); ag.addColorStop(1, 'rgba(40,10,60,0)');
    ctx.fillStyle = ag; ctx.fillRect(ax, F.Y, F.CW, 3 * F.CH);
    if (!BS.practice && !b.finale) V.text(ctx, '接近', ax + F.CW / 2, F.Y - 14, { size: 14, align: 'center', color: '#d8b8ff', stroke: 'rgba(0,0,0,0.7)' });
    ctx.restore();
    // リール（床）
    const pv = BS.preview;
    const inCl = {};
    if (pv && !BS.anim) pv.clusters.forEach((cl, ci) => cl.cells.forEach(([c, r]) => { inCl[c + ',' + r] = cl; }));
    for (let c = 0; c < R; c++) drawReel(c, inCl);
    if (!BS.spin) for (let c = 0; c < R; c++) drawPeekChips(c);
    // つながりの線と力
    if (pv && !BS.anim && !BS.spin) drawClusters(pv);
    // 結界
    drawWard(b);
    // 主人公と、救った人々
    for (const p of BS.crowd) V.person(ctx, p.who, p.x, p.y, 70, t + p.t, { wave: true });
    V.mage(ctx, 92, F.Y + 2 * F.CH + 20, 140, t, BS.anim && BS.anim.t < 0.6 ? 'cast' : '');
    // 魔物
    const list = (BS.ghosts || b.mons).slice().sort((a, m) => a.r - m.r || a.c - m.c);
    for (const m of list) drawMon(m, pv);
    drawFootChips(list);
    if (pv && !BS.anim && !BS.spin) drawClusterLabels(pv);
    for (const ex of BS.exiting) {
      ctx.save(); ctx.globalAlpha = clamp(1 - ex.t * 1.6, 0, 1);
      V.monster(ctx, { id: ex.id, k: ex.k, w: ex.w, h: ex.h, who: ex.who, boss: ex.boss }, ex.x, ex.y, F.CW * 0.9, t);
      ctx.restore();
    }
    // 効果
    drawFx();
    for (const r of BS.runners) {
      if (r.t < r.delay) { // 光の中から人の姿が現れる
        ctx.save(); ctx.globalAlpha = clamp(r.t / r.delay, 0, 1);
        V.person(ctx, r.who, r.x, r.y, r.boss ? 110 : 80, t, { wave: true });
        ctx.restore();
        if (r.boss && r.name) V.text(ctx, r.name, r.x, r.y - 100, { size: 18, align: 'center', color: '#fff6d0', stroke: 'rgba(0,0,0,0.7)' });
      } else V.person(ctx, r.who, r.x, r.y, r.boss ? 110 : 80, t, { run: true, flip: true });
    }
    for (const p of BS.pops) {
      const k = p.t / 1.1;
      ctx.save(); ctx.globalAlpha = 1 - Math.pow(k, 3);
      V.text(ctx, p.text, p.x, p.y - k * 40, { size: p.size || 20, align: 'center', color: p.col || '#fff', stroke: 'rgba(30,10,40,0.85)', sw: 5 });
      ctx.restore();
    }
    ctx.restore();
    if (BS.flash > 0) { ctx.fillStyle = 'rgba(255,248,220,' + BS.flash * 0.6 + ')'; ctx.fillRect(0, 0, W, H); }
    drawBattleUI(b);
    if (BS.bigText) {
      const k = BS.bigText.t;
      ctx.save(); ctx.globalAlpha = clamp(Math.min(k * 4, (1.8 - k) * 3), 0, 1);
      const sc = 1 + Math.max(0, 0.2 - k) * 2;
      ctx.translate(W / 2 - 110, 300); ctx.scale(sc, sc);
      V.text(ctx, BS.bigText.text, 0, 0, { size: 40, align: 'center', color: '#fff3b8', stroke: 'rgba(60,20,80,0.9)', sw: 8, serif: true });
      ctx.restore();
    }
    if (BS.banner) {
      const k = BS.banner.t;
      const a = clamp(Math.min(k * 3, (2.6 - k) * 2), 0, 1);
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(10,6,20,0.7)'; ctx.fillRect(0, 250, W, 120);
      V.text(ctx, BS.banner.title, W / 2, 292, { size: 44, align: 'center', color: '#fff0c8', serif: true, stroke: 'rgba(0,0,0,0.6)', sw: 6 });
      V.text(ctx, BS.banner.sub, W / 2, 340, { size: 18, align: 'center', color: '#e6dcff', weight: 'normal' });
      ctx.restore();
    }
  }

  function drawReel(c, inCl) {
    const s = S(), b = s.b, rl = s.reels[c], n = rl.strip.length;
    const x = cxOf(c), top = F.Y - F.PEEK, hgt = 3 * F.CH + 2 * F.PEEK;
    const vis = BS.vis[c];
    ctx.save();
    ctx.beginPath(); ctx.rect(x, top, F.CW, hgt); ctx.clip();
    const base = Math.floor(vis), frac = vis - base;
    const spinning = BS.spin && BS.spin.items.some(it => it.c === c && !it.done);
    for (let k = -2; k <= 4; k++) {
      const idx = ((base + k) % n + n) % n;
      const y = F.Y + (k - frac) * F.CH;
      if (y > top + hgt || y + F.CH < top) continue;
      const cell = rl.strip[idx];
      const row = k; // 窓の段（frac が 0 のとき）
      const lit = !spinning && frac < 0.01 && row >= 0 && row < 3 && (inCl[c + ',' + row] || BS.lit[c + ',' + row]);
      if (spinning) {
        ctx.save(); ctx.globalAlpha = 0.85;
        V.tile(ctx, cell, x, y, F.CW, F.CH, { gscale: 0.46 });
        ctx.restore();
      } else V.tile(ctx, cell, x, y, F.CW, F.CH, { lit: !!lit, fresh: cell.fresh, gscale: 0.46 });
      const L = BS.lit[c + ',' + row];
      if (L && frac < 0.01) {
        const e = V.EL[L.el] || V.EL.light;
        ctx.save(); ctx.globalAlpha = clamp(1 - L.t / 0.9, 0, 1) * 0.6;
        V.rr(ctx, x + 4, y + 4, F.CW - 8, F.CH - 8, 10); ctx.fillStyle = e.g; ctx.fill();
        ctx.restore();
      }
    }
    // のぞき窓（上下の一コマ）を暗く
    const g1 = ctx.createLinearGradient(0, top, 0, F.Y);
    g1.addColorStop(0, 'rgba(10,6,20,0.85)'); g1.addColorStop(1, 'rgba(10,6,20,0.35)');
    ctx.fillStyle = g1; ctx.fillRect(x, top, F.CW, F.PEEK);
    const g2 = ctx.createLinearGradient(0, F.Y + 3 * F.CH, 0, top + hgt);
    g2.addColorStop(0, 'rgba(10,6,20,0.35)'); g2.addColorStop(1, 'rgba(10,6,20,0.85)');
    ctx.fillStyle = g2; ctx.fillRect(x, F.Y + 3 * F.CH, F.CW, F.PEEK);
    if (spinning) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x, top, F.CW, hgt); }
    ctx.restore();
    // 固定中
    if (b.holds[c]) {
      ctx.save();
      V.rr(ctx, x + 3, F.Y + 2, F.CW - 6, 3 * F.CH - 4, 10);
      ctx.strokeStyle = '#ffd45e'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.stroke();
      ctx.restore();
      V.text(ctx, '固定', x + F.CW / 2, F.Y + 3 * F.CH - 18, { size: 16, align: 'center', color: '#ffe8a0', stroke: 'rgba(0,0,0,0.8)' });
    }
    // ずらし量

  }

  // 窓の上下にはみ出した紋（ずらすと入ってくる紋）を小さな札で見せる
  function drawPeekChips(c) {
    const s = S(), b = s.b, rl = s.reels[c];
    const vis = BS.vis[c];
    if (Math.abs(vis - Math.round(vis)) > 0.05) return;
    const p = Math.round(vis);
    const up = rl.strip[((p - 1) % rl.strip.length + rl.strip.length) % rl.strip.length];
    const dn = rl.strip[((p + 3) % rl.strip.length + rl.strip.length) % rl.strip.length];
    const x = cxOf(c) + F.CW / 2;
    for (const [cell, y] of [[up, F.Y - F.PEEK / 2], [dn, F.Y + 3 * F.CH + F.PEEK / 2]]) {
      if (cell.t === 'blank') continue;
      const e = V.EL[cell.t];
      ctx.save();
      V.rr(ctx, x - 26, y - 15, 52, 30, 9);
      ctx.fillStyle = 'rgba(30,24,46,0.95)'; ctx.fill();
      ctx.strokeStyle = V.hexA(e.c, 0.8); ctx.lineWidth = 1.5; ctx.stroke();
      V.glyph(ctx, cell.t, x - (cell.lv > 1 ? 6 : 0), y, 22, 0.95, false);
      if (cell.lv > 1) V.text(ctx, String(cell.lv), x + 16, y + 1, { size: 12, align: 'center', color: e.g, shadow: false });
      ctx.restore();
    }
  }
  // 魔物の足元の紋を、マスの左下に小さく見せる
  function drawFootChips(list) {
    const s = S(), b = s.b;
    if (BS.spin) return;
    for (const m of list) {
      if (m.gone || m.c >= b.R) continue;
      for (let x = 0; x < m.w; x++) for (let y = 0; y < m.h; y++) {
        const c = m.c + x, r = m.r + y;
        if (c >= b.R) continue;
        const vis = BS.vis[c];
        if (Math.abs(vis - (s.reels[c].pos + (b.offs[c] || 0))) > 0.05 && !BS.anim) continue;
        const cell = RR.cellAt(s.reels[c], r, BS.anim ? 0 : (b.offs[c] || 0));
        if (cell.t === 'blank') continue;
        const e = V.EL[cell.t];
        const cx = cxOf(c) + 24, cy = cyOf(r + 1) - 22;
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20,14,34,0.92)'; ctx.fill();
        ctx.strokeStyle = e.c; ctx.lineWidth = 2; ctx.stroke();
        V.glyph(ctx, cell.t, cx, cy, 24, 1, true);
        ctx.restore();
        if (cell.lv > 1) V.text(ctx, String(cell.lv), cx + 16, cy + 12, { size: 12, align: 'center', color: e.g, stroke: 'rgba(0,0,0,0.8)', sw: 3 });
      }
    }
  }
  function drawClusters(pv) {
    ctx.save();
    for (const cl of pv.clusters) {
      const e = V.EL[cl.el];
      const set = {};
      cl.cells.forEach(([c, r]) => { set[c + ',' + r] = 1; });
      // 縁取り
      ctx.lineWidth = 3;
      ctx.strokeStyle = e.c;
      ctx.shadowColor = e.c; ctx.shadowBlur = 10;
      for (const [c, r] of cl.cells) {
        V.rr(ctx, cxOf(c) + 5, cyOf(r) + 5, F.CW - 10, F.CH - 10, 10);
        ctx.stroke();
      }
      // となりとのつなぎ
      ctx.fillStyle = e.g;
      for (const [c, r] of cl.cells) {
        if (set[(c + 1) + ',' + r]) { V.rr(ctx, cxOf(c + 1) - 16, cyOf(r + 0.5) - 6, 32, 12, 6); ctx.fill(); }
        if (set[c + ',' + (r + 1)]) { V.rr(ctx, cxOf(c + 0.5) - 6, cyOf(r + 1) - 16, 12, 32, 6); ctx.fill(); }
      }
      // 魔晶
      for (const [gc, gr] of cl.gems) {
        ctx.strokeStyle = V.EL.gem.c; ctx.setLineDash([6, 5]);
        V.rr(ctx, cxOf(gc) + 7, cyOf(gr) + 7, F.CW - 14, F.CH - 14, 10); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
  // つながりの力の札（魔物より手前に描く）
  function drawClusterLabels(pv) {
    ctx.save();
    for (const cl of pv.clusters) {
      const e = V.EL[cl.el];
      if (cl.cells.length >= 2 || cl.mult > 1) {
        // 札はつながりの右下のマスの、右下の角に（魔物の札や足元の紋と重ならない場所）
        let mc = -1, mr = -1;
        for (const [c, r] of cl.cells) if (c > mc || (c === mc && r > mr)) { mc = c; mr = r; }
        const label = e.name + cl.P + (cl.mult > 1 ? '×' + cl.mult : '');
        ctx.font = 'bold 15px ' + V.FONT;
        const tw = ctx.measureText(label).width + 14;
        const bx = cxOf(mc + 1) - 8 - tw, by = cyOf(mr + 1) - 30;
        V.rr(ctx, bx, by, tw, 22, 11); ctx.fillStyle = 'rgba(10,6,20,0.85)'; ctx.fill();
        ctx.strokeStyle = e.c; ctx.lineWidth = 1.5; ctx.stroke();
        V.text(ctx, label, bx + 7, by + 11, { size: 15, color: e.g, shadow: false });
      }
    }
    ctx.restore();
  }

  function drawWard(b) {
    const x = F.X - 16;
    ctx.save();
    const a = 0.5 + 0.2 * Math.sin(App.t * 2) + BS.wardHit * 0.5;
    const g = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
    g.addColorStop(0, 'rgba(160,220,255,0)'); g.addColorStop(0.5, BS.wardHit > 0 ? 'rgba(255,120,120,' + a + ')' : 'rgba(170,225,255,' + a + ')'); g.addColorStop(1, 'rgba(160,220,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 10, F.Y - 10, 20, 3 * F.CH + 20);
    ctx.restore();
  }

  function drawMon(m, pv) {
    const b = battle();
    const d = BS.mdisp[m.id];
    if (!d || m.gone) return;
    const s = F.CW * 0.92;
    const outside = m.c >= b.R;
    ctx.save();
    ctx.globalAlpha = (d.a === undefined ? 1 : d.a) * (outside ? 0.72 : 1);
    const frozen = m.frozen || m.frozenFx;
    if (m.k === 'dummy') {
      V.person(ctx, 'scarecrow', d.x, d.y, 100, 0, {});
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(d.x - 30, d.y - 32); ctx.lineTo(d.x + 30, d.y - 32); ctx.stroke();
    } else V.monster(ctx, m, d.x, d.y, s, App.t, { frozen: frozen, hurt: m.hurt > 0 });
    if (frozen) {
      ctx.save(); ctx.globalAlpha *= 0.45;
      V.rr(ctx, d.x - s * 0.3 * m.w, d.y - s * 0.62 * m.h, s * 0.6 * m.w, s * 0.62 * m.h, 12);
      ctx.fillStyle = '#bff0ff'; ctx.fill(); ctx.restore();
    }
    ctx.restore();
    // 呪いの札
    const hp = m.shown !== undefined ? m.shown : m.hp;
    const topY = d.y - (m.boss ? F.CH * m.h - 26 : F.CH - 30);
    const pred = pv && !BS.anim ? (pv.total[m.id] || 0) : 0;
    const willFree = pv && !BS.anim && (pv.purified.indexOf(m.id) >= 0 || (pv.bossDown && !outside));
    const hs = pv && !BS.anim ? (pv.hits[m.id] || []) : [];
    const blocked = hs.length && hs.every(h => h.blocked);
    ctx.save();
    ctx.globalAlpha = outside ? 0.85 : 1;
    // 札：[角][呪いの数][見こみ]。見こみは札の中に入れて、となりのマスにはみ出さない
    const label = String(hp);
    let extra = '', exCol = '#9ff0c0';
    const showPred = pv && !BS.anim && !outside;
    const freezeP = showPred && pv.frozen.indexOf(m.id) >= 0 && !willFree;
    if (showPred) {
      if (willFree) { extra = 'ほどける'; exCol = '#1f6a3a'; }
      else if (blocked) { extra = '弾く'; exCol = '#b8b0c8'; }
      else if (pred > 0) { extra = '−' + pred; exCol = '#9ff0c0'; }
      if (freezeP) extra += (extra ? ' ' : '') + '凍';
    }
    ctx.font = 'bold 17px ' + V.FONT;
    const lw = ctx.measureText(label).width;
    ctx.font = 'bold 14px ' + V.FONT;
    const ew = extra ? ctx.measureText(extra).width + 8 : 0;
    const bw = 30 + lw + ew, bx = d.x - bw / 2, by = topY - 14;
    V.rr(ctx, bx, by, bw, 26, 13);
    ctx.fillStyle = willFree && showPred ? '#fff0b0' : 'rgba(40,12,56,0.94)'; ctx.fill();
    ctx.strokeStyle = willFree && showPred ? '#ffffff' : '#b06cff'; ctx.lineWidth = 2; ctx.stroke();
    if (willFree && showPred) {
      ctx.save(); ctx.globalAlpha *= 0.5 + 0.5 * Math.sin(App.t * 6);
      V.rr(ctx, bx - 3, by - 3, bw + 6, 32, 15); ctx.strokeStyle = '#9ff0c0'; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    }
    // 呪いのしるし（小さな角）と数
    ctx.fillStyle = willFree && showPred ? '#a06a00' : '#c88cff';
    ctx.beginPath(); ctx.moveTo(bx + 9, by + 19); ctx.lineTo(bx + 13, by + 6); ctx.lineTo(bx + 17, by + 19); ctx.closePath(); ctx.fill();
    V.text(ctx, label, bx + 22, by + 13, { size: 17, color: willFree && showPred ? '#5a3200' : '#f2dcff', shadow: false });
    if (extra) V.text(ctx, extra, bx + 26 + lw + 4, by + 13, { size: 14, color: exCol, shadow: false });
    // 盾
    if (m.armor) {
      const sx = bx + bw + 4, sy = by - 1;
      ctx.fillStyle = blocked && showPred ? '#8a8098' : '#7a8aa8';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 26, sy); ctx.lineTo(sx + 26, sy + 14); ctx.quadraticCurveTo(sx + 13, sy + 30, sx, sy + 14); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#dfe8ff'; ctx.lineWidth = 1.5; ctx.stroke();
      V.text(ctx, String(m.armor), sx + 13, sy + 11, { size: 13, align: 'center', color: '#fff', shadow: false });
    }
    // 足の速さ・遅さ
    if (m.speed >= 2) V.text(ctx, '»', bx - 12, by + 12, { size: 20, align: 'center', color: '#ff9a8a', stroke: 'rgba(0,0,0,0.7)' });
    if (m.slow && m.k !== 'dummy' && !m.finale) {
      const waits = (m.tick || 0) % 2 === 0; // 次の歩みで止まるか
      V.text(ctx, waits ? '休' : '歩', bx - 12, by + 13, { size: 13, align: 'center', color: waits ? '#a8e0ff' : '#ffb0a0', stroke: 'rgba(0,0,0,0.7)' });
    }
    if (m.frozen) V.text(ctx, '凍', bx + bw + (m.armor ? 34 : 6), by + 13, { size: 14, color: '#bff0ff', stroke: 'rgba(0,0,0,0.7)' });
    // 次の歩みで結界にぶつかる魔物には、赤い「！」
    if (!outside && !m.finale && m.k !== 'dummy' && !m.frozen && !(willFree && showPred) && !(freezeP)) {
      const movesNext = !m.slow || (m.tick || 0) % 2 === 1;
      if (movesNext && m.c - m.speed < 0) {
        const ex = cxOf(m.c) + 15, ey = cyOf(m.r) + 58;
        ctx.save();
        ctx.globalAlpha *= 0.75 + 0.25 * Math.sin(App.t * 8);
        ctx.beginPath(); ctx.arc(ex, ey, 12, 0, Math.PI * 2); ctx.fillStyle = '#e0404a'; ctx.fill();
        ctx.strokeStyle = '#ffd0d0'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
        V.text(ctx, '！', ex, ey + 1, { size: 15, align: 'center', color: '#fff', shadow: false });
      }
    }
    if (m.boss && m.name) V.text(ctx, m.name, d.x, by + 40, { size: 14, align: 'center', color: '#e8d0ff', stroke: 'rgba(0,0,0,0.8)' });
    ctx.restore();
    if (m.hurt) m.hurt = Math.max(0, m.hurt - 0.03);
  }

  function drawFx() {
    ctx.save();
    for (const f of BS.fx) {
      const k = f.t / f.life;
      const e = V.EL[f.el] || V.EL.light;
      if (f.kind === 'pillar') {
        const h = 260 + f.big * 14;
        ctx.globalAlpha = (1 - k) * 0.8;
        const g = ctx.createLinearGradient(0, f.y - h, 0, f.y + 40);
        g.addColorStop(0, V.hexA(e.c, 0)); g.addColorStop(0.7, V.hexA(e.g, 0.9)); g.addColorStop(1, V.hexA(e.c, 0.2));
        ctx.fillStyle = g;
        const w = (F.CW * 0.55) * (1 - k * 0.5);
        ctx.fillRect(f.x - w / 2, f.y - h * Math.min(1, k * 4), w, h * Math.min(1, k * 4) + 40);
      } else if (f.kind === 'spark') {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = e.g;
        ctx.beginPath(); ctx.arc(f.x, f.y, 3 * (1 - k) + 1, 0, Math.PI * 2); ctx.fill();
      } else if (f.kind === 'smoke') {
        ctx.globalAlpha = (1 - k) * 0.5;
        ctx.fillStyle = '#7a4aa0';
        ctx.beginPath(); ctx.arc(f.x, f.y, 6 + k * 18, 0, Math.PI * 2); ctx.fill();
      } else if (f.kind === 'ring') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#fff6c8'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(f.x, f.y, 20 + k * 80 * f.big, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // 雷の跳び
    for (const z of BS.bolts) {
      ctx.globalAlpha = 1 - z.t / z.life;
      ctx.strokeStyle = '#efe2ff'; ctx.lineWidth = 3; ctx.shadowColor = '#b48aff'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(z.x1, z.y1);
      const n = 6;
      for (let i = 1; i < n; i++) {
        const k = i / n;
        ctx.lineTo(lerp(z.x1, z.x2, k) + (Math.random() - 0.5) * 22, lerp(z.y1, z.y2, k) + (Math.random() - 0.5) * 22);
      }
      ctx.lineTo(z.x2, z.y2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBattleUI(b) {
    const s = S();
    const def = BS.def || D.STAGES[Math.min(s.stage, D.STAGES.length - 1)];
    // 上の帯
    ctx.save();
    ctx.fillStyle = 'rgba(10,6,20,0.78)'; ctx.fillRect(0, 0, W, 50);
    ctx.restore();
    V.text(ctx, BS.practice ? '試し詠唱' : def.name, 20, 25, { size: 22, color: '#fff0c8', serif: true });
    if (b.finale) {
      V.text(ctx, '最後の大詠唱 ' + Math.min(b.finale.casts, b.finale.idx + 1) + ' / ' + b.finale.casts, 190, 26, { size: 17, color: '#ffe28a' });
      V.text(ctx, '大詠唱で救った人 ' + b.finale.rescued, 420, 26, { size: 17, color: '#fff3b8' });
      V.text(ctx, '一度の最多 ' + b.finale.best, 640, 26, { size: 15, color: '#d8c8f0', weight: 'normal' });
    } else if (!BS.practice) {
      V.text(ctx, '手番 ' + (b.turn + 1), 190, 26, { size: 15, color: '#cfc4e8', weight: 'normal' });
      // 結界
      V.text(ctx, '結界', 290, 26, { size: 15, color: '#cfe8ff' });
      for (let i = 0; i < b.heartsMax; i++) drawShard(340 + i * 26, 25, i < b.hearts);
      V.text(ctx, '救った人 ' + b.rescued + ' / ' + BS.total, 360 + b.heartsMax * 26, 26, { size: 16, color: '#fff3b8' });
      const left = b.sched.length + b.mons.length;
      V.text(ctx, 'のこり ' + left, 540 + b.heartsMax * 26, 26, { size: 14, color: '#d8c8f0', weight: 'normal' });
    }
    topButtons();
    // 右の札
    const px = 1030, pw = 238;
    V.panel(ctx, px, 58, pw, 140);
    V.text(ctx, '魔力', px + 14, 78, { size: 15, color: '#cfe8ff' });
    const used = b.phase === 'aim' ? RR.mpUsed(b) : b.holds.filter(Boolean).length;
    for (let i = 0; i < b.mpMax; i++) {
      const ox = px + 22 + (i % 6) * 36, oy = 108 + Math.floor(i / 6) * 34;
      const have = i < b.mp, use = have && i >= b.mp - used;
      ctx.save();
      ctx.beginPath(); ctx.arc(ox, oy, 12, 0, Math.PI * 2);
      if (have && !use) { ctx.fillStyle = '#8fd8ff'; ctx.shadowColor = '#8fd8ff'; ctx.shadowBlur = 10; ctx.fill(); }
      else if (use) { ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = 3; ctx.stroke(); }
      else { ctx.strokeStyle = 'rgba(160,190,220,0.35)'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.restore();
    }
    V.text(ctx, '一手ごとに +' + b.mpRegen + '（最大' + b.mpMax + '）', px + 14, 176, { size: 13, color: '#a8a0c0', weight: 'normal' });
    // 見こみ
    V.panel(ctx, px, 206, pw, 170);
    const pv = BS.preview;
    if (b.phase === 'aim' && pv && !BS.anim) {
      V.text(ctx, '詠唱の見こみ', px + 14, 226, { size: 15, color: '#fff0c8' });
      const nFree = pv.bossDown ? b.mons.filter(m => m.c < b.R).length : pv.purified.length;
      V.text(ctx, nFree ? nFree + '人の呪いがほどける' : 'ほどける人はいない', px + 14, 256, { size: 18, color: nFree ? '#9ff0c0' : '#c8c0d8' });
      const tot = Object.values(pv.total).reduce((a, v) => a + v, 0);
      V.text(ctx, '呪いを ' + tot + ' ほどく', px + 14, 284, { size: 15, color: '#e6dcff', weight: 'normal' });
      const fr = pv.frozen.length;
      if (fr) V.text(ctx, fr + '体を凍らせる', px + 14, 308, { size: 15, color: '#bff0ff', weight: 'normal' });
      const big = pv.clusters.reduce((m, c) => (c.dmg > (m ? m.dmg : -1) ? c : m), null);
      if (big) V.text(ctx, 'いちばん大きいつながり：' + V.EL[big.el].name + big.cells.length + '個', px + 14, 336, { size: 13, color: '#cfc4e8', weight: 'normal' });
      if (b.offs.some(Boolean)) V.text(ctx, 'Z：ずらしを戻す', px + 14, 360, { size: 12, color: '#a8a0c0', weight: 'normal' });
    } else if (b.phase === 'spin' && !busy()) {
      V.text(ctx, 'つぎの一手', px + 14, 226, { size: 15, color: '#fff0c8' });
      V.para(ctx, BS.practice ? '［回す］で試す。「同じ回転」なら、前と同じ止まり方になる。' : '［回す］で床が回る。回す前に［固定］したリールは回らない。', px + 14, 246, pw - 28, { size: 14, weight: 'normal', color: '#e6dcff', lh: 22 });
    }
    // 説明（マウスを重ねたもの）
    if (!BS.practice) {
      V.panel(ctx, px, 384, pw, 186);
      drawHoverInfo(px, 384, pw);
    }
    // 大きなボタン
    let label = '回す', sub = 'スペース', en = true, act = doSpin, pulse = false;
    if (BS.spin) { label = '止める'; sub = 'スペース'; act = stopSpinEarly; }
    else if (BS.anim) { label = '……'; sub = ''; en = false; act = null; }
    else if (b.phase === 'aim') { label = '詠唱'; sub = 'スペース'; act = doCast; pulse = !!(pv && pv.purified.length); }
    else if (b.phase === 'spin') { pulse = true; }
    else { en = false; }
    btn({ id: 'main', x: px, y: 612, w: pw, h: 92, label: label, sub: sub, size: 30, primary: true, enabled: en, pulse: pulse, act: act });
    // ずらし・固定のボタン
    const aim = b.phase === 'aim' && !busy();
    for (let c = 0; c < b.R; c++) {
      const x = cxOf(c);
      const tut = BS.tut && BS.tut.kind === 1 && TUT1[b.turn] && TUT1[b.turn].arrow;
      const teach = BS.teach && BS.teach.arrow;
      const hintD = BS.hint ? BS.hint[c] - (b.offs[c] || 0) : 0;
      const pulseUp = (tut && tut.c === c && tut.d > 0) || (teach && teach.c === c && teach.d > 0 && !b.offs.some(Boolean)) || hintD > 0;
      const pulseDn = (tut && tut.c === c && tut.d < 0) || (teach && teach.c === c && teach.d < 0 && !b.offs.some(Boolean)) || hintD < 0;
      const noShift = BS.tut && BS.tut.kind === 1 && TUT1[b.turn] && TUT1[b.turn].noShift;
      const off = b.offs[c] || 0;
      btn({ id: 'up' + c, x: x + 18, y: F.Y - F.PEEK - 36, w: F.CW - 36, h: 30, label: off > 0 ? '▲ ' + off : '▲', on: off > 0, onFill: '#2f7a5a', size: 16, enabled: aim && !noShift, pulse: pulseUp, act: () => doShift(c, 1) });
      btn({ id: 'dn' + c, x: x + 18, y: F.Y + 3 * F.CH + F.PEEK + 6, w: F.CW - 36, h: 30, label: off < 0 ? '▼ ' + (-off) : '▼', on: off < 0, onFill: '#2f7a5a', size: 16, enabled: aim && !noShift, pulse: pulseDn, act: () => doShift(c, -1) });
      if (!BS.practice && !b.finale) btn({ id: 'hold' + c, x: x + 14, y: F.Y + 3 * F.CH + F.PEEK + 42, w: F.CW - 28, h: 26, label: '固定（魔力1）', size: 12, on: b.holds[c], enabled: b.phase === 'spin' && !busy(), act: () => doHold(c) });
    }
    // 下の伝言
    const mx = 20, my = 632, mw = 990, mh = 80;
    if (BS.msg) {
      V.panel(ctx, mx, my, mw, mh, { fill: 'rgba(20,14,36,0.9)' });
      V.para(ctx, BS.msg, mx + 18, my + 12, mw - 36, { size: 17, weight: 'normal', color: '#fff6e0', lh: 26 });
    }
    if (BS.practice) drawPracticeUI(b);
    else if (b.phase === 'aim' && !busy()) {
      btn({ id: 'hint', x: px, y: 576, w: pw, h: 30, label: 'ヒント（H）', size: 14, act: doHint });
    }
    // 知らせ
    if (App.toast) {
      const k = App.toast.t;
      ctx.save(); ctx.globalAlpha = clamp(Math.min(k * 5, (App.toast.dur - k) * 3), 0, 1);
      ctx.font = 'bold 18px ' + V.FONT;
      const tw = ctx.measureText(App.toast.text).width + 40;
      V.panel(ctx, 520 - tw / 2, 66, tw, 40, { fill: 'rgba(40,20,60,0.95)', stroke: '#ffe28a' });
      V.text(ctx, App.toast.text, 520, 86, { size: 18, align: 'center', color: '#fff6d8' });
      ctx.restore();
    }
  }
  function drawShard(x, y, on) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 11); ctx.lineTo(x - 8, y); ctx.closePath();
    if (on) { ctx.fillStyle = '#a8e4ff'; ctx.shadowColor = '#a8e4ff'; ctx.shadowBlur = 10; ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(168,228,255,0.4)'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
  }

  function hoverTarget() {
    const b = battle();
    if (!b || App.overlay) return null;
    const x = App.mx, y = App.my;
    const c = Math.floor((x - F.X) / F.CW), r = Math.floor((y - F.Y) / F.CH);
    if (c < 0 || c > b.R || r < 0 || r > 2) return null;
    const list = BS.ghosts || b.mons;
    const m = list.find(mm => c >= mm.c && c < mm.c + mm.w && r >= mm.r && r < mm.r + mm.h);
    if (m && y < cyOf(r + 1) - 8) return { mon: m, c: c, r: r };
    if (c < b.R && !BS.spin) {
      const rl = S().reels[c];
      return { cell: RR.cellAt(rl, r, b.offs[c] || 0), c: c, r: r };
    }
    return null;
  }
  function drawHoverInfo(px, py, pw) {
    const h = hoverTarget();
    if (!h) {
      V.text(ctx, '説明', px + 14, py + 20, { size: 14, color: '#a8a0c0' });
      V.para(ctx, '紋や魔物にマウスを重ねると、ここに説明が出る。', px + 14, py + 40, pw - 28, { size: 14, weight: 'normal', color: '#cfc4e8', lh: 22 });
      return;
    }
    if (h.mon) {
      const m = h.mon, base = RR.MON[m.k];
      V.text(ctx, m.boss ? m.name + '（呪いの主）' : base.name, px + 14, py + 22, { size: 17, color: '#f2dcff' });
      let y = py + 46;
      V.text(ctx, '呪い ' + (m.shown !== undefined ? m.shown : m.hp) + ' / ' + m.max + (m.armor ? '　盾 ' + m.armor : ''), px + 14, y, { size: 14, color: '#e6dcff', weight: 'normal' });
      if (m.c < battle().R && !BS.spin) {
        const feet = [];
        for (let x = 0; x < m.w; x++) for (let yy = 0; yy < m.h; yy++) {
          const cc = m.c + x; if (cc >= battle().R) continue;
          const cell = RR.cellAt(S().reels[cc], m.r + yy, BS.anim ? 0 : (battle().offs[cc] || 0));
          if (cell.t !== 'blank') feet.push(RR.RUNE[cell.t].short);
        }
        y += 20;
        V.text(ctx, '足元の紋：' + (feet.length ? feet.join('・') : 'なし'), px + 14, y, { size: 13, color: '#9ff0c0', weight: 'normal' });
      }
      if (m.slow && !m.finale) { y += 20; V.text(ctx, '「休」は次は休む、「歩」は次に進む', px + 14, y, { size: 12, color: '#a8e0ff', weight: 'normal' }); }
      y += 22;
      V.para(ctx, base.desc + (m.c >= battle().R ? '（いまは接近中。まだ紋がとどかない）' : ''), px + 14, y, pw - 28, { size: 13, weight: 'normal', color: '#cfc4e8', lh: 20 });
    } else if (h.cell) {
      const cell = h.cell, info = RR.RUNE[cell.t];
      V.text(ctx, info.name + (cell.lv > 1 ? ' Lv' + cell.lv : ''), px + 14, py + 22, { size: 17, color: cell.t === 'blank' ? '#cfc4e8' : V.EL[cell.t].g });
      let y = py + 44;
      y += V.para(ctx, info.desc, px + 14, y, pw - 28, { size: 13, weight: 'normal', color: '#cfc4e8', lh: 20 });
      const pv = BS.preview;
      if (pv) {
        const cl = pv.clusters.find(k => k.cells.some(([c, r]) => c === h.c && r === h.r));
        if (cl) V.para(ctx, 'このつながり：' + cl.cells.length + '個、力' + cl.P + (cl.mult > 1 ? ' ×' + cl.mult : '') + ' → 一体に ' + cl.dmg + ' ほどく', px + 14, y + 6, pw - 28, { size: 13, color: '#9ff0c0', lh: 20 });
      }
    }
  }

  function drawPracticeUI(b) {
    const P = BS.practice;
    const x = 1030, y = 384, w = 238;
    V.panel(ctx, x, y, w, 222, { fill: 'rgb(30,20,50)' });
    V.text(ctx, '試しの記録', x + 14, y + 20, { size: 15, color: '#fff0c8' });
    if (!P.results.length) V.para(ctx, '回して詠唱すると、ここに結果が残る。', x + 14, y + 40, w - 28, { size: 13, weight: 'normal', color: '#cfc4e8', lh: 20 });
    P.results.forEach((r, i) => {
      V.text(ctx, (i === 0 ? '今回' : i + '回前') + (r.same ? '（同じ回転）' : ''), x + 14, y + 48 + i * 38, { size: 13, color: i === 0 ? '#fff6d0' : '#a8a0c0' });
      V.text(ctx, r.n + '体ほどけた・合計' + r.dmg + (r.fresh ? '（新の紋が効いた）' : ''), x + 14, y + 66 + i * 38, { size: 13, color: i === 0 ? '#9ff0c0' : '#cfc4e8', weight: 'normal' });
    });
    if (b.phase === 'spin' && !busy()) {
      btn({ id: 'same', x: 230, y: 632 - 44, w: 220, h: 36, label: '同じ回転で試す', size: 15, enabled: !!P.spinPos, act: () => { P.sameNext = true; doSpin(); } });
    }
    btn({ id: 'back', x: 470, y: 632 - 44, w: 200, h: 36, label: '工房へもどる', size: 15, enabled: !busy(), act: () => { exitPractice(); } });
  }
  function exitPractice() {
    const s = S();
    // 位置を記録しておき、もう一度試すときに同じ回転を使えるように
    App.lastPractice = { R: s.b.R, pos: BS.practice.spinPos, results: BS.practice.results };
    s.b = null;
    s.phase = 'workshop';
    BS = null;
    enterWorkshop(true);
  }

  // ---------- 上の小さなボタン ----------
  function topButtons() {
    btn({ id: 'help', x: W - 150, y: 8, w: 40, h: 34, label: '？', size: 18, act: () => { App.overlay = { kind: 'help', page: 0 }; } });
    btn({ id: 'mute', x: W - 102, y: 8, w: 40, h: 34, label: cfg.mute ? '×' : '♪', size: 18, act: toggleMute });
    btn({ id: 'menu', x: W - 54, y: 8, w: 44, h: 34, label: '≡', size: 20, act: () => { App.overlay = { kind: 'menu' }; } });
  }
  function toggleMute() { A.init(); cfg.mute = !cfg.mute; A.setMuted(cfg.mute); saveCfg(); }

  // ---------- 工房 ----------
  let WS = null;
  function enterWorkshop(fromPractice) {
    const s = S();
    if (!fromPractice || !WS) {
      WS = { t: 0, hand: null, smith: false, msg: '', guide: s.stage === 1 && !s.unlock.v1g };
      // お礼が一つだけなら、そのまま受け取る
      if (s.gifts && s.gifts.length === 1) { G.pickGift(s, 0); }
    } else WS.t = 0;
    App.scene = 'workshop';
    A.music('workshop');
    if (!fromPractice) saveGame();
  }
  const WK = { X: 56, Y: 142, CS: 54, GAP: 22 };
  const wkCell = (r, k) => ({ x: WK.X + r * (WK.CS + WK.GAP), y: WK.Y + k * WK.CS });

  function drawWorkshop() {
    const s = S(), t = App.t;
    // 背景：夜明けの町。救った人が広場に集まる
    V.background(ctx, D.REGIONS[Math.min(5, Math.max(0, (D.STAGES[s.stage - 1] || D.STAGES[0]).region))].bg, 'dawn', t, W, H, 0);
    ctx.fillStyle = 'rgba(12,8,24,0.55)'; ctx.fillRect(0, 0, W, H);
    drawPlaza(s, t);
    V.text(ctx, '工房', 24, 30, { size: 28, color: '#fff0c8', serif: true });
    V.text(ctx, '夜明け。救った人々が、広場に集まってくる。', 100, 32, { size: 15, color: '#e6dcff', weight: 'normal' });
    V.text(ctx, '感謝のしるし ' + s.coins, 640, 32, { size: 20, color: '#ffe28a' });
    V.text(ctx, '魔力 ' + s.mpMax + '（一手 +' + s.mpRegen + '）', 830, 32, { size: 16, color: '#bfe8ff' });
    topButtons();
    // リール
    V.panel(ctx, WK.X - 22, WK.Y - 44, s.reels.length * (WK.CS + WK.GAP) + 22, 8 * WK.CS + 92, { fill: 'rgba(16,10,30,0.88)' });
    V.text(ctx, '詠唱輪（リール）', WK.X - 6, WK.Y - 30, { size: 15, color: '#fff0c8' });
    s.reels.forEach((rl, r) => {
      const x0 = WK.X + r * (WK.CS + WK.GAP);
      V.text(ctx, String(r + 1), x0 + WK.CS / 2, WK.Y - 10, { size: 14, align: 'center', color: '#cfc4e8' });
      rl.strip.forEach((cell, k) => {
        const p = wkCell(r, k);
        const held = WS.hand && WS.hand.from === 'reel' && WS.hand.r === r && WS.hand.k === k;
        const hot = inside(App.mx, App.my, { x: p.x, y: p.y, w: WK.CS, h: WK.CS });
        ctx.save();
        if (held) ctx.globalAlpha = 0.35;
        V.tile(ctx, cell, p.x, p.y, WK.CS, WK.CS, { lit: hot, fresh: cell.fresh, gscale: 0.56 });
        ctx.restore();
        // 縦にとなり合う同じ紋
        const nx = rl.strip[(k + 1) % rl.strip.length];
        if (cell.t !== 'blank' && cell.t !== 'gem' && (nx.t === cell.t || nx.t === 'star' || cell.t === 'star') && nx.t !== 'blank' && nx.t !== 'gem' && k < rl.strip.length - 1) {
          ctx.fillStyle = V.EL[cell.t === 'star' ? nx.t : cell.t].g;
          V.rr(ctx, p.x + WK.CS / 2 - 4, p.y + WK.CS - 8, 8, 16, 4); ctx.fill();
        }
        if (hot && (WS.hand || cell.t !== 'blank')) { ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = 2; V.rr(ctx, p.x + 2, p.y + 2, WK.CS - 4, WK.CS - 4, 8); ctx.stroke(); }
        // 導き：はじめての工房では、光の紋のとなりの空きを光らせる
        if (WS.guide && cell.t === 'blank' && WS.hand) {
          const prev = rl.strip[(k + rl.strip.length - 1) % rl.strip.length], next = nx;
          if (prev.t === 'light' || next.t === 'light') {
            ctx.save(); ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 6);
            ctx.strokeStyle = '#9ff0c0'; ctx.lineWidth = 3; V.rr(ctx, p.x + 4, p.y + 4, WK.CS - 8, WK.CS - 8, 8); ctx.stroke();
            ctx.restore();
          }
        }
      });
      V.text(ctx, rl.isNew ? '新しい輪' : '↺', x0 + WK.CS / 2, WK.Y + 8 * WK.CS + 14, { size: rl.isNew ? 11 : 14, align: 'center', color: rl.isNew ? '#9ff0c0' : '#8a80a8', weight: 'normal' });
    });
    V.text(ctx, '↺ 下の端と上の端はつながっている', WK.X - 6, WK.Y + 8 * WK.CS + 34, { size: 12, color: '#8a80a8', weight: 'normal' });
    // 持ち物
    const ix = 520, iy = 102;
    V.panel(ctx, ix, iy, 330, 236, { fill: 'rgba(16,10,30,0.88)' });
    V.text(ctx, '持ち物の紋', ix + 14, iy + 20, { size: 15, color: '#fff0c8' });
    if (!s.inv.length) V.text(ctx, '（なし）', ix + 14, iy + 52, { size: 14, color: '#8a80a8', weight: 'normal' });
    s.inv.forEach((it, i) => {
      const x = ix + 14 + (i % 5) * 62, y = iy + 38 + Math.floor(i / 5) * 62;
      const held = WS.hand && WS.hand.from === 'inv' && WS.hand.i === i;
      const b = btn({ id: 'inv' + i, x: x, y: y, w: 56, h: 56, label: '', fill: held ? '#7a5bd0' : 'rgba(40,32,64,0.9)', act: () => clickInv(i) });
      V.tile(ctx, { t: it.t, lv: it.lv }, b.x, b.y, 56, 56, { lit: held || b.hot, gscale: 0.58 });
    });
    // 説明
    drawWorkshopInfo(ix, 346, 330);
    // 市・鍛冶場
    drawShop(s, 866, 102, 392);
    // 下のボタン
    btn({ id: 'practice', x: 866, y: 560, w: 190, h: 56, label: '試し詠唱', sub: 'わら人形でためす', size: 18, act: () => { WS.hand = null; startPractice(); } });
    btn({ id: 'go', x: 1068, y: 560, w: 190, h: 56, label: '出発', sub: (D.STAGES[s.stage] || {}).name || '', size: 22, primary: true, pulse: !s.inv.length, act: leaveWorkshop });
    // 手に持っているもの
    if (WS.hand) {
      const it = handItem();
      if (it) { ctx.save(); ctx.globalAlpha = 0.9; V.tile(ctx, it, App.mx - 30, App.my - 30, 60, 60, { lit: true, gscale: 0.58 }); ctx.restore(); }
    }
    // 伝言
    const msg = WS.msg || (WS.guide ? '助けた村人から「光の紋」をもらった。持ち物の紋を押してから、リールの石の床（空いたマス）を押すと置ける。光の紋のすぐ上か下に置くと、出たときに縦につながる。' : '持ち物の紋を押してリールのマスを押すと置ける。リールの紋を押して持ち上げれば入れ替え。右クリックで外す。');
    V.panel(ctx, 520, 632, 738, 80, { fill: 'rgba(20,14,36,0.92)' });
    V.para(ctx, msg, 538, 644, 700, { size: 15, weight: 'normal', color: '#fff6e0', lh: 23 });
    if (App.toast) {
      const k = App.toast.t;
      ctx.save(); ctx.globalAlpha = clamp(Math.min(k * 5, (App.toast.dur - k) * 3), 0, 1);
      ctx.font = 'bold 18px ' + V.FONT;
      const tw = ctx.measureText(App.toast.text).width + 40;
      V.panel(ctx, 760 - tw / 2, 60, tw, 36, { fill: 'rgba(40,20,60,0.95)', stroke: '#ffe28a' });
      V.text(ctx, App.toast.text, 760, 78, { size: 17, align: 'center', color: '#fff6d8' });
      ctx.restore();
    }
  }
  function drawPlaza(s, t) {
    // 左下の広場に、救った人々が集まる（最大40人ほど）
    ctx.save();
    const g = ctx.createLinearGradient(0, 630, 0, 720);
    g.addColorStop(0, 'rgba(120,96,70,0.0)'); g.addColorStop(0.25, 'rgba(150,120,86,0.85)'); g.addColorStop(1, 'rgba(110,86,60,0.95)');
    ctx.fillStyle = g; ctx.fillRect(0, 624, 510, 96);
    // 噴水
    ctx.fillStyle = '#8a8aa0'; ctx.beginPath(); ctx.ellipse(255, 690, 54, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7ab8e8'; ctx.beginPath(); ctx.ellipse(255, 688, 46, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9a9ab0'; ctx.fillRect(250, 652, 10, 34);
    for (let i = 0; i < 6; i++) { const a = t * 3 + i; ctx.fillStyle = 'rgba(200,235,255,0.8)'; ctx.fillRect(255 + Math.sin(a) * 16, 652 + ((t * 40 + i * 7) % 30), 3, 3); }
    ctx.restore();
    const who = [];
    for (const id in s.results) {
      const def = D.STAGES.find(d => d.id === id);
      if (!def) continue;
      const n = s.results[id].rescued;
      const kinds = def.waves.map(w => (w[4] && w[4].who) || (RR.MON[w[1]].who));
      for (let i = 0; i < n && i < kinds.length; i++) who.push(kinds[i]);
    }
    const n = Math.min(40, who.length);
    for (let i = 0; i < n; i++) {
      let x = 24 + ((i * 137) % 470);
      if (Math.abs(x - 255) < 50) x += 110;
      const y = 708 - (i % 3) * 12;
      V.person(ctx, who[i], x, y, 46, t + i, { wave: i % 4 === 0 });
    }
    V.text(ctx, '広場に戻った人 ' + s.rescued + '人', 14, 640, { size: 14, color: '#fff3c8', stroke: 'rgba(0,0,0,0.7)' });
  }
  function handItem() {
    const s = S();
    if (!WS.hand) return null;
    if (WS.hand.from === 'inv') return s.inv[WS.hand.i];
    return s.reels[WS.hand.r].strip[WS.hand.k];
  }
  function clickInv(i) {
    const s = S();
    if (WS.smith) { if (G.upgradeInv(s, i)) { A.play('forge'); toast('Lv' + s.inv[i].lv + ' に鍛えた'); } else { A.play('deny'); toast(RR.upgradeCost(s.inv[i].lv) === null ? 'これ以上は鍛えられない' : 'しるしが足りない'); } return; }
    if (WS.hand && WS.hand.from === 'inv' && WS.hand.i === i) { WS.hand = null; return; }
    WS.hand = { from: 'inv', i: i };
    A.play('click');
  }
  function clickReelCell(r, k, right) {
    const s = S();
    const cell = s.reels[r].strip[k];
    if (right) {
      if (WS.hand) { WS.hand = null; return; }
      if (RR.takeOut(s, r, k)) { A.play('take'); WS.msg = ''; }
      return;
    }
    if (WS.smith) {
      if (cell.t === 'blank') return;
      if (G.upgradeCell(s, r, k)) { A.play('forge'); toast(RR.RUNE[cell.t].name + 'を Lv' + cell.lv + ' に鍛えた'); }
      else { A.play('deny'); toast(RR.upgradeCost(cell.lv) === null ? 'これ以上は鍛えられない' : 'しるしが足りない'); }
      return;
    }
    if (!WS.hand) {
      if (cell.t === 'blank') return;
      WS.hand = { from: 'reel', r: r, k: k };
      A.play('click');
      return;
    }
    if (WS.hand.from === 'inv') {
      RR.place(s, WS.hand.i, r, k);
      A.play('place');
      WS.hand = null;
      if (WS.guide) { WS.guide = false; s.unlock.v1g = true; WS.msg = '置けた！ 「新」の印がついた紋は、次の戦いでも印が見える。「試し詠唱」で効き方をためしてから出発しよう。'; }
    } else {
      if (WS.hand.r === r && WS.hand.k === k) { WS.hand = null; return; }
      RR.swapCells(s, WS.hand.r, WS.hand.k, r, k);
      A.play('place');
      WS.hand = null;
    }
  }
  function drawWorkshopInfo(x, y, w) {
    V.panel(ctx, x, y, w, 270, { fill: 'rgba(16,10,30,0.88)' });
    const s = S();
    let cell = null;
    // マウスの下
    s.reels.forEach((rl, r) => rl.strip.forEach((c, k) => { const p = wkCell(r, k); if (inside(App.mx, App.my, { x: p.x, y: p.y, w: WK.CS, h: WK.CS })) cell = c; }));
    for (const b of App.btns) if (b.hot && b.info) cell = b.info;
    for (const b of App.btns) if (b.hot && /^inv\d+$/.test(b.id)) cell = s.inv[+b.id.slice(3)];
    if (WS.hand && !cell) cell = handItem();
    if (!cell) {
      V.text(ctx, '紋のしくみ', x + 14, y + 20, { size: 15, color: '#fff0c8' });
      V.para(ctx, '戦いでは、リールの連続した3マスが床に出る。リールの上で縦にとなり合う紋は、いっしょに出て縦につながる。横のつながりは、回したあとに ▲▼ でずらして作る。', x + 14, y + 40, w - 28, { size: 14, weight: 'normal', color: '#cfc4e8', lh: 22 });
      return;
    }
    const info = RR.RUNE[cell.t];
    V.text(ctx, info.name + (cell.lv > 1 ? ' Lv' + cell.lv : ''), x + 14, y + 22, { size: 18, color: cell.t === 'blank' ? '#cfc4e8' : V.EL[cell.t].g });
    let yy = y + 46;
    yy += V.para(ctx, info.desc, x + 14, yy, w - 28, { size: 14, weight: 'normal', color: '#e6dcff', lh: 22 });
    if (cell.t !== 'blank') {
      const pow = cell.t === 'gem' ? '倍率 ×' + (1 + cell.lv) : '力 ' + cell.lv + (cell.t === 'light' ? '（光は2倍ほどく）' : '');
      V.text(ctx, pow, x + 14, yy + 14, { size: 14, color: '#9ff0c0' });
      if (s.smith && cell.lv < 3) V.text(ctx, '鍛えると Lv' + (cell.lv + 1) + '（しるし ' + RR.upgradeCost(cell.lv) + '）', x + 14, yy + 38, { size: 13, color: '#ffe28a', weight: 'normal' });
    }
  }
  function drawShop(s, x, y, w) {
    V.panel(ctx, x, y, w, 446, { fill: 'rgba(16,10,30,0.88)' });
    if (s.gifts) {
      V.text(ctx, 'お礼：ひとつ選ぶ', x + 14, y + 22, { size: 17, color: '#fff0c8' });
      s.gifts.forEach((g, i) => {
        const b = btn({ id: 'gift' + i, x: x + 14 + i * 122, y: y + 44, w: 112, h: 150, label: '', info: g, pulse: true, act: () => { G.pickGift(s, i); A.play('unlock'); toast(RR.RUNE[g.t].name + (g.lv > 1 ? ' Lv' + g.lv : '') + 'を受け取った'); } });
        V.tile(ctx, g, b.x + 16, b.y + 12, 80, 80, { lit: b.hot, gscale: 0.6 });
        V.text(ctx, RR.RUNE[g.t].name, b.x + 56, b.y + 112, { size: 15, align: 'center', color: '#fff6e0' });
        if (g.lv > 1) V.text(ctx, 'Lv' + g.lv, b.x + 56, b.y + 134, { size: 13, align: 'center', color: '#9ff0c0' });
      });
      V.para(ctx, '救った人々が、お礼に紋を分けてくれる。', x + 14, y + 210, w - 28, { size: 14, weight: 'normal', color: '#cfc4e8' });
      return;
    }
    if (!s.shop.length) {
      V.text(ctx, '村の市', x + 14, y + 22, { size: 17, color: '#8a80a8' });
      V.para(ctx, '村長を救えば、市がひらく。', x + 14, y + 46, w - 28, { size: 14, weight: 'normal', color: '#8a80a8' });
      return;
    }
    V.text(ctx, '市', x + 14, y + 22, { size: 17, color: '#fff0c8' });
    V.text(ctx, '感謝のしるしで紋を分けてもらう', x + 48, y + 23, { size: 12, color: '#a8a0c0', weight: 'normal' });
    s.shop.forEach((t, i) => {
      const p = D.PRICE[t];
      const bx = x + 14 + (i % 3) * 122, by = y + 42 + Math.floor(i / 3) * 100;
      const b = btn({ id: 'buy_' + t, x: bx, y: by, w: 112, h: 92, label: '', info: { t: t, lv: 1 }, enabled: s.coins >= p, act: () => { if (G.buy(s, t)) { A.play('coin'); toast(RR.RUNE[t].name + 'を手に入れた'); } } });
      V.tile(ctx, { t: t, lv: 1 }, bx + 28, by + 6, 56, 56, { lit: b.hot, gscale: 0.6 });
      V.text(ctx, RR.RUNE[t].short + '　' + p, bx + 56, by + 76, { size: 15, align: 'center', color: s.coins >= p ? '#ffe28a' : '#7a7090' });
    });
    let yy = y + 42 + Math.ceil(s.shop.length / 3) * 100 + 4;
    const mp = G.mpPrice(s);
    btn({ id: 'buy_mp', x: x + 14, y: yy, w: 176, h: 50, label: '魔力の器 +1', sub: mp === null ? '売り切れ' : 'しるし ' + mp, size: 15, enabled: mp !== null && s.coins >= mp, act: () => { if (G.buyMp(s)) { A.play('unlock'); toast('魔力の最大が ' + s.mpMax + ' になった'); } } });
    if (s.smith) {
      const rp = G.regenPrice(s);
      btn({ id: 'buy_regen', x: x + 200, y: yy, w: 176, h: 50, label: '魔力の泉', sub: rp === null ? '済み' : '一手 +1 ・しるし ' + rp, size: 15, enabled: rp !== null && s.coins >= rp, act: () => { if (G.buyRegen(s)) { A.play('unlock'); toast('一手ごとの魔力が +' + s.mpRegen + ' になった'); } } });
      yy += 60;
      btn({ id: 'smith', x: x + 14, y: yy, w: 362, h: 44, label: WS.smith ? '鍛冶場：鍛える紋を押す（もう一度押すと終わる）' : '鍛冶場で紋を鍛える', size: 14, on: WS.smith, act: () => { WS.smith = !WS.smith; WS.hand = null; } });
    }
  }
  function leaveWorkshop() {
    const s = S();
    WS.hand = null; WS.smith = false;
    if (s.gifts) { toast('先に、お礼をひとつ選ぼう'); A.play('deny'); return; }
    if (s.stage === 1 && s.inv.length && WS.guide) { toast('もらった紋を、リールに置いてみよう'); A.play('deny'); return; }
    App.scene = 'map';
    MS = { t: 0, from: Math.max(0, D.STAGES[s.stage].region - 1), to: D.STAGES[s.stage].region };
    A.music('title');
    saveGame();
  }

  // ---------- 地図 ----------
  let MS = null;
  function drawMap() {
    const s = S();
    const def = D.STAGES[s.stage];
    const cur = def ? def.region : 6;
    drawMapBase(s, cur, 0);
    V.text(ctx, '救った人々 ' + s.rescued + '人', 110, 110, { size: 18, color: '#5a3a10', shadow: false });
    if (def) {
      V.panel(ctx, 260, H - 92, 760, 80, { fill: 'rgba(20,14,36,0.92)' });
      V.text(ctx, '次の地：' + def.name, 284, H - 66, { size: 20, color: '#fff0c8', serif: true });
      V.text(ctx, def.sub, 284, H - 36, { size: 15, color: '#e6dcff', weight: 'normal' });
      btn({ id: 'depart', x: W - 250, y: H - 92, w: 200, h: 80, label: 'この地へ', sub: 'リール ' + def.reels + '本', size: 24, primary: true, pulse: true, act: () => startBattle() });
      btn({ id: 'back_ws', x: 60, y: H - 92, w: 180, h: 80, label: '工房へもどる', size: 16, act: () => enterWorkshop(true) });
    }
    topButtons();
  }
  // cur：いま挑む地方（それより前は解放ずみ）。clear：0〜1（結末で、最後の地方の呪いが晴れていく）
  function drawMapBase(s, cur, dawn) {
    const t = App.t;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a2448'); g.addColorStop(1, '#1a1630');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 羊皮紙
    const px = 60, py = 70, pw = W - 120, ph = H - 170;
    ctx.save();
    V.rr(ctx, px, py, pw, ph, 24);
    const pg = ctx.createLinearGradient(0, py, 0, py + ph);
    pg.addColorStop(0, '#ecdcb4'); pg.addColorStop(1, '#d8c498');
    ctx.fillStyle = pg; ctx.fill();
    ctx.clip();
    V.mapTerrain(ctx, px, py, pw, ph, t);
    ctx.restore();
    ctx.save(); V.rr(ctx, px, py, pw, ph, 24); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    V.text(ctx, '王国ハルモア', W / 2, 40, { size: 28, align: 'center', color: '#fff0c8', serif: true });
    // 道（解放したところまでは明るく）
    ctx.save();
    ctx.lineWidth = 6; ctx.setLineDash([14, 10]); ctx.lineCap = 'round';
    for (let i = 1; i < D.REGIONS.length; i++) {
      const a = D.REGIONS[i - 1], b = D.REGIONS[i];
      ctx.strokeStyle = i <= cur ? '#a0783a' : 'rgba(110,90,120,0.6)';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();
    D.REGIONS.forEach((r, i) => {
      const freed = i < cur;
      const fade = freed && i === cur - 1 && dawn > 0 && dawn < 1 ? dawn : 1;
      ctx.save();
      if (freed) {
        const rg = ctx.createRadialGradient(r.x, r.y - 20, 10, r.x, r.y - 20, 110);
        rg.addColorStop(0, 'rgba(255,240,170,' + 0.7 * fade + ')'); rg.addColorStop(1, 'rgba(255,240,170,0)');
        ctx.fillStyle = rg; ctx.fillRect(r.x - 120, r.y - 140, 240, 240);
      }
      V.mapIcon(ctx, r.bg, r.x, r.y - 16, 70, freed, t);
      // 呪いのもや（まだのところ）
      if (!freed || fade < 1) {
        const a = freed ? 1 - fade : 1;
        for (let k = 0; k < 4; k++) {
          const ox = Math.cos(t * 0.6 + k * 1.7 + i) * 18, oy = Math.sin(t * 0.5 + k * 2.1) * 10 - 20;
          const rg = ctx.createRadialGradient(r.x + ox, r.y + oy, 6, r.x + ox, r.y + oy, 70);
          rg.addColorStop(0, 'rgba(70,25,100,' + 0.42 * a + ')'); rg.addColorStop(1, 'rgba(70,25,100,0)');
          ctx.fillStyle = rg; ctx.fillRect(r.x + ox - 80, r.y + oy - 80, 160, 160);
        }
      }
      if (i === cur) {
        ctx.strokeStyle = 'rgba(255,230,140,' + (0.6 + 0.4 * Math.sin(t * 4)) + ')'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(r.x, r.y - 16, 52 + Math.sin(t * 4) * 3, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      V.text(ctx, r.name, r.x, r.y + 40, { size: 18, align: 'center', color: freed ? '#5a3a10' : '#3a2a4a', shadow: false, serif: true });
      if (freed) {
        const res = s.results[D.STAGES.filter(d => d.region === i).slice(-1)[0].id];
        V.text(ctx, '解放' + (res ? '・' + D.STAGES.filter(d => d.region === i).reduce((a, d) => a + ((s.results[d.id] && s.results[d.id].rescued) || 0), 0) + '人' : ''), r.x, r.y + 62, { size: 13, align: 'center', color: '#8a6a2a', shadow: false });
      } else if (i === cur) V.text(ctx, 'つぎの地', r.x, r.y + 62, { size: 13, align: 'center', color: '#7a3aa0', shadow: false });
    });
    if (dawn > 0) { ctx.fillStyle = 'rgba(255,240,200,' + 0.18 * dawn + ')'; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- タイトル ----------
  function drawTitle() {
    const t = App.t;
    V.background(ctx, 'village', 'night', t, W, H, 0.7);
    // 回る魔法陣
    ctx.save();
    ctx.translate(W / 2, 330);
    ctx.rotate(t * 0.15);
    for (let ring = 0; ring < 3; ring++) {
      const rad = 120 + ring * 70;
      ctx.strokeStyle = 'rgba(255,214,120,' + (0.35 - ring * 0.08) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.stroke();
      const n = 8 + ring * 4;
      for (let i = 0; i < n; i++) {
        const a = i * Math.PI * 2 / n + (ring % 2 ? -t * 0.3 : 0);
        const tt = ['light', 'ice', 'bolt', 'star', 'gem'][(i + ring) % 5];
        V.glyph(ctx, tt, Math.cos(a) * rad, Math.sin(a) * rad, 22, 0.75, false);
      }
    }
    ctx.restore();
    V.text(ctx, 'くるり、呪いほどき', W / 2, 250, { size: 72, align: 'center', color: '#fff3c8', serif: true, stroke: 'rgba(40,10,60,0.9)', sw: 10 });
    V.text(ctx, '― 魔法陣リールと灰の王国 ―', W / 2, 322, { size: 26, align: 'center', color: '#e6dcff', serif: true, stroke: 'rgba(40,10,60,0.9)', sw: 6 });
    const has = !!load(SAVE);
    btn({ id: 'new', x: W / 2 - 150, y: 420, w: 300, h: 60, label: has ? 'はじめから' : 'はじめる', size: 24, primary: true, pulse: !has, act: () => { if (has) App.overlay = { kind: 'confirmNew' }; else newGame(); } });
    if (has) btn({ id: 'cont', x: W / 2 - 150, y: 494, w: 300, h: 56, label: 'つづきから', size: 22, pulse: true, act: continueGame });
    btn({ id: 'howto', x: W / 2 - 150, y: has ? 564 : 494, w: 300, h: 48, label: 'あそびかた', size: 18, act: () => { App.overlay = { kind: 'help', page: 0 }; } });
    const rec = load(REC);
    if (rec && rec.done) {
      V.text(ctx, '記録：王国を救った（' + rec.rescued + '人）・一手で救った最多 ' + rec.best + '人' + (rec.exBest ? '・腕だめし ' + rec.exBest + '人' : ''), W / 2, 650, { size: 15, align: 'center', color: '#ffe8a0' });
      if (rec.reels) btn({ id: 'exfinale', x: W - 290, y: 600, w: 260, h: 48, label: '大詠唱の腕だめし', sub: '完成したリールで、もう一度', size: 16, act: startExFinale });
    }
    V.text(ctx, 'マウスで遊べます（キーボードも使えます）・音が出ます', W / 2, 690, { size: 14, align: 'center', color: '#a8a0c0', weight: 'normal' });
    btn({ id: 'mute', x: W - 102, y: 8, w: 40, h: 34, label: cfg.mute ? '×' : '♪', size: 18, act: toggleMute });
  }
  // クリア後：完成したリールで、大詠唱だけをもう一度
  function startExFinale() {
    const rec = load(REC);
    if (!rec || !rec.reels) return;
    A.init();
    App.overlay = null;
    const s = G.newGame((Date.now() % 100000) + 3);
    s.reels = rec.reels.map(r => ({ strip: r.strip.map(c => ({ t: c.t, lv: c.lv })), pos: 0 }));
    s.mpMax = rec.mpMax || 5; s.mpRegen = rec.mpRegen || 1; s.stage = D.STAGES.length - 1;
    App.s = s;
    RR.startBattle(s, { id: 'ex', reels: s.reels.length, hearts: 3, waves: [], finale: { casts: 3, hp: [16, 30, 56], mpBonus: 3 } });
    const b = s.b;
    b.finale = { idx: 0, casts: 3, rescued: 0, best: 0 };
    RR.fillFinale(s);
    b.mp = b.mpMax + 3;
    BS = newBS();
    BS.def = Object.assign({}, D.STAGES[D.STAGES.length - 1], { name: '腕だめし' });
    BS.ex = true;
    BS.total = 45;
    for (const m of b.mons) setDisp(m, true);
    App.scene = 'battle';
    A.music('tower');
    onTurnStart();
  }
  function newGame() {
    A.init();
    const qs = /[?&]seed=(\d+)/.exec(location.search);
    App.s = G.newGame(qs ? +qs[1] : (Date.now() % 100000) + 7);
    App.overlay = null;
    App.story = { lines: D.STORY.prologue, i: 0, t: 0, done: () => { App.story = null; App.scene = 'map'; MS = { t: 0, from: 0, to: 0 }; saveGame(); } };
    A.music('title');
  }
  function continueGame() {
    A.init();
    const s = load(SAVE);
    if (!s) return;
    App.s = s;
    if (s.phase === 'ending') { startEnding(); return; }
    if (s.phase === 'workshop') enterWorkshop();
    else { App.scene = 'map'; MS = { t: 0 }; }
    A.music('title');
  }

  // ---------- 物語の紙芝居 ----------
  function drawStory() {
    const st = App.story;
    ctx.fillStyle = 'rgba(8,5,16,0.88)'; ctx.fillRect(0, 0, W, H);
    const line = st.lines[st.i];
    ctx.save();
    ctx.globalAlpha = clamp(st.t * 2.5, 0, 1);
    V.panel(ctx, 180, 200, 920, 260, { fill: 'rgba(30,22,50,0.95)', stroke: 'rgba(255,214,120,0.5)' });
    V.para(ctx, line, 230, 250, 820, { size: 24, serif: true, color: '#fff3e0', lh: 44, weight: 'normal' });
    ctx.restore();
    V.text(ctx, (st.i + 1) + ' / ' + st.lines.length, 1060, 440, { size: 14, align: 'right', color: '#a8a0c0', weight: 'normal' });
    btn({ id: 'story_next', x: W / 2 - 110, y: 500, w: 220, h: 54, label: st.i < st.lines.length - 1 ? 'つぎへ' : 'はじめる', size: 20, primary: true, layer: 1, act: nextStory });
    btn({ id: 'story_skip', x: W / 2 + 130, y: 508, w: 120, h: 40, label: 'とばす', size: 15, layer: 1, act: () => { const d = st.done; d(); } });
  }
  function nextStory() {
    const st = App.story;
    A.play('page');
    if (st.i < st.lines.length - 1) { st.i++; st.t = 0; } else { const d = st.done; d(); }
  }

  // ---------- 会話（救った人のことば） ----------
  function drawTalk() {
    const tk = App.talk;
    const line = tk.lines[tk.i];
    ctx.fillStyle = 'rgba(8,5,16,0.55)'; ctx.fillRect(0, 0, W, H);
    V.panel(ctx, 160, 420, 960, 200, { fill: 'rgba(30,22,50,0.96)', stroke: 'rgba(255,214,120,0.6)' });
    ctx.save();
    ctx.beginPath(); ctx.arc(270, 520, 70, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,240,200,0.12)'; ctx.fill();
    ctx.restore();
    V.person(ctx, line.who, 270, 590, 170, App.t, { wave: true });
    V.text(ctx, line.name, 370, 450, { size: 20, color: '#ffe28a' });
    V.para(ctx, line.text, 370, 476, 720, { size: 19, weight: 'normal', color: '#fff6e0', lh: 30 });
    btn({ id: 'talk_next', x: 960, y: 566, w: 140, h: 42, label: tk.i < tk.lines.length - 1 ? 'つぎへ' : 'とじる', size: 17, primary: true, layer: 1, act: nextTalk });
  }
  function nextTalk() {
    const tk = App.talk;
    A.play('page');
    if (tk.i < tk.lines.length - 1) tk.i++;
    else { App.talk = null; if (tk.done) tk.done(); }
  }

  // ---------- 戦いの結果 ----------
  function drawResult() {
    const R = App.result, out = R.out;
    const k = clamp(R.t * 2, 0, 1);
    ctx.fillStyle = 'rgba(8,5,16,' + 0.6 * k + ')'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = k;
    if (out.ex) {
      V.panel(ctx, 340, 170, 600, 330, { fill: 'rgba(30,22,50,0.97)', stroke: '#ffe28a' });
      V.text(ctx, '大詠唱の腕だめし', W / 2, 220, { size: 30, align: 'center', color: '#fff3c8', serif: true });
      V.text(ctx, '3回の大詠唱で救った人 ' + out.rescued + '人', W / 2, 286, { size: 24, align: 'center', color: '#9ff0c0' });
      V.text(ctx, '一度の最多 ' + out.best + '人', W / 2, 326, { size: 18, align: 'center', color: '#fff6e0' });
      V.text(ctx, out.rescued > out.prev ? '記録更新！（これまで ' + out.prev + '人）' : 'これまでの最多 ' + out.prev + '人', W / 2, 362, { size: 17, align: 'center', color: '#ffe28a' });
      btn({ id: 'ex_again', x: 400, y: 420, w: 220, h: 52, label: 'もう一度', size: 19, primary: true, layer: 1, act: () => { App.result = null; startExFinale(); } });
      btn({ id: 'ex_title', x: 660, y: 420, w: 220, h: 52, label: 'タイトルへ', size: 18, layer: 1, act: () => { App.result = null; BS = null; App.s = null; App.scene = 'title'; } });
      ctx.restore();
      return;
    }
    V.panel(ctx, 300, 130, 680, 430, { fill: 'rgba(30,22,50,0.97)', stroke: out.win ? '#ffe28a' : '#a88ac8' });
    if (out.win) {
      V.text(ctx, out.def.name + 'の呪いがほどけた', W / 2, 186, { size: 34, align: 'center', color: '#fff3c8', serif: true });
      V.text(ctx, '救った人 ' + out.rescued + '人' + (out.lost ? '（逃げてしまった人 ' + out.lost + '人）' : '（ひとりも逃さなかった！）'), W / 2, 240, { size: 20, align: 'center', color: '#9ff0c0' });
      if (S().phase !== 'ending') V.text(ctx, '感謝のしるし +' + out.coins, W / 2, 276, { size: 18, align: 'center', color: '#ffe28a' });
      // 救った人を並べる
      const who = out.who.slice(0, 24);
      who.forEach((w2, i) => V.person(ctx, w2, 360 + (i % 12) * 48, 360 + Math.floor(i / 12) * 64, 56, App.t + i, { wave: true }));
      if (out.unlock) V.para(ctx, out.unlock.text, 340, 440, 600, { size: 16, color: '#ffe8b0', weight: 'normal', lh: 24 });
      btn({ id: 'res_ok', x: W / 2 - 120, y: 494, w: 240, h: 52, label: S().phase === 'ending' ? 'つづきへ' : '工房へ', size: 20, primary: true, layer: 1, act: closeResult });
    } else {
      V.text(ctx, '結界が破れてしまった……', W / 2, 190, { size: 32, align: 'center', color: '#e6d0ff', serif: true });
      V.para(ctx, '救った人たちが差し入れをくれた（しるし +' + out.coins + '）。\n工房でリールを組み直すか、そのままもう一度挑もう。' + (S().fails[out.def.id] >= 1 ? '\n次の挑戦では、結界がひとつ増える。' : ''), 360, 240, 560, { size: 18, weight: 'normal', color: '#fff6e0', lh: 30 });
      V.para(ctx, 'ヒント：赤い「！」の魔物は、次の一歩で結界にぶつかる。先にほどくか、氷で止めよう。呪いの主を早くほどけば、残りもまとめてほどける。', 360, 370, 560, { size: 15, weight: 'normal', color: '#cfc4e8', lh: 24 });
      btn({ id: 'res_retry', x: 360, y: 470, w: 260, h: 56, label: 'もう一度挑む', size: 20, primary: true, layer: 1, act: () => { App.result = null; startBattle(); } });
      btn({ id: 'res_ws', x: 660, y: 470, w: 260, h: 56, label: '工房で組み直す', size: 18, layer: 1, act: () => { App.result = null; BS = null; enterWorkshop(); } });
    }
    ctx.restore();
  }
  function closeResult() {
    const s = S();
    const out = App.result.out;
    App.result = null;
    BS = null;
    if (!out.win) return;
    if (s.phase === 'ending') { startEnding(); return; }
    enterWorkshop();
    const after = D.STORY.after[out.def.id];
    if (after) App.talk = { lines: after, i: 0 };
  }
  function startEnding() { App.scene = 'ending'; ES = { t: 0 }; A.music('ending'); }

  // ---------- 結末 ----------
  let ES = null;
  const END_TALK = [
    { who: 'witch', name: '灰の魔女だった人', text: '……あたたかい。灰の冠をかぶってから、ずっと寒かったの。だれかがいなくなるのがこわくて、みんなを影にして、塔に閉じこめようとした。' },
    { who: 'witch', name: '灰の魔女だった人', text: 'あなたの輪が回るたびに、影が人にもどっていくのが見えた。……ごめんなさい。わたしにも、手伝わせて。' },
    { who: 'princess', name: '王女', text: 'あなたの詠唱輪が、王国じゅうの人をつれもどしてくれました。今夜は、国じゅうでお祭りです。' },
  ];
  function startEnding() {
    App.scene = 'ending';
    ES = { t: 0, step: 0 };
    A.music('ending');
  }
  function drawEnding() {
    const s = S(), t = App.t;
    if (ES.step === 0) {
      // 地図に光がもどる
      drawMapBase(s, 6, Math.min(1, ES.t / 2.5));
      ctx.save(); ctx.globalAlpha = clamp((ES.t - 0.8) * 1.5, 0, 1);
      V.text(ctx, '王国ハルモアに、朝が来た', W / 2, 640, { size: 40, align: 'center', color: '#fff3c8', serif: true, stroke: 'rgba(40,20,10,0.8)', sw: 8 });
      ctx.restore();
      if (ES.t > 1.5) btn({ id: 'end_next', x: W - 230, y: H - 74, w: 200, h: 54, label: 'つぎへ', size: 20, primary: true, pulse: true, act: () => { ES.step = 1; ES.t = 0; App.talk = { lines: END_TALK, i: 0, done: () => { ES.step = 2; ES.t = 0; A.play('win'); } }; } });
      return;
    }
    // 祭りの広場
    V.background(ctx, 'village', 'morning', t, W, H, 0);
    const who = ['villager', 'child', 'dog', 'miner', 'soldier', 'elder', 'hunter', 'smith', 'sage', 'princess', 'witch', 'villager', 'child', 'villager', 'dog', 'child', 'miner', 'soldier'];
    for (let i = 0; i < 46; i++) {
      const x = 40 + ((i * 173) % 1200), y = 610 + (i % 4) * 26 - (i % 7);
      V.person(ctx, who[i % who.length], x, y, 64 + (i % 3) * 6, t + i * 0.7, { wave: i % 3 === 0 });
    }
    // 紙吹雪
    for (let i = 0; i < 60; i++) {
      const x = (i * 97 + t * (30 + i % 5 * 10)) % W, y = (i * 53 + t * (60 + (i % 7) * 12)) % 560;
      ctx.fillStyle = ['#ffd45e', '#78d6ff', '#b48aff', '#ff7fd4', '#9dffb0'][i % 5];
      ctx.fillRect(x, y, 6, 4);
    }
    V.mage(ctx, 640, 600, 120, t, 'cast');
    if (ES.step === 2) drawEndStats(s);
  }
  function drawEndStats(s) {
    const k = clamp(ES.t * 2, 0, 1);
    ctx.save(); ctx.globalAlpha = k;
    V.panel(ctx, 250, 60, 780, 460, { fill: 'rgba(24,16,40,0.94)', stroke: '#ffe28a' });
    V.text(ctx, 'おしまい', W / 2, 100, { size: 34, align: 'center', color: '#fff3c8', serif: true });
    const tot = D.STAGES.reduce((a, d) => a + ((s.results[d.id] && s.results[d.id].total) || 0), 0);
    const fin = s.results.t && s.results.t.finale ? s.results.t.finale : { rescued: 0, best: 0 };
    V.text(ctx, '救った人々　' + s.rescued + '人（道中 ' + (s.rescued - fin.rescued) + ' / ' + (tot - fin.rescued) + '・大詠唱 ' + fin.rescued + '）', W / 2, 146, { size: 19, align: 'center', color: '#9ff0c0' });
    V.text(ctx, '一手で救った人数の最多（地方ごと）', 300, 186, { size: 16, color: '#fff0c8' });
    const rows = [];
    D.STAGES.forEach(d => {
      if (d.id === 'v1') return;
      const r = s.results[d.id];
      const best = r ? r.best : 0;
      rows.push({ name: d.id === 'v2' ? '麦畑の村' : d.name, best: best });
    });
    if (fin.best) rows.push({ name: '最後の大詠唱', best: fin.best, fin: true });
    const v1 = s.results.v1 ? s.results.v1.best : 0;
    if (rows.length && v1 > rows[0].best) rows[0].best = v1;
    const mx = Math.max(15, ...rows.map(r => r.best));
    rows.forEach((r, i) => {
      const y = 218 + i * 36;
      V.text(ctx, r.name, 300, y + 12, { size: 15, color: '#e6dcff', weight: 'normal' });
      const bw = 460 * r.best / mx;
      const g = ctx.createLinearGradient(440, 0, 440 + bw, 0);
      g.addColorStop(0, '#a8741a'); g.addColorStop(1, r.fin ? '#fff3b8' : '#ffd45e');
      ctx.fillStyle = g;
      V.rr(ctx, 440, y, Math.max(6, bw * clamp(ES.t * 1.2 - i * 0.12, 0, 1)), 24, 8); ctx.fill();
      V.text(ctx, r.best + '人', 450 + bw + 8, y + 12, { size: 15, color: '#fff6e0' });
    });
    V.text(ctx, 'いちばん大きい一撃：呪いを ' + (s.stats.bestDmg || 0) + ' ほどいた', W / 2, 482, { size: 15, align: 'center', color: '#cfc4e8', weight: 'normal' });
    ctx.restore();
    btn({ id: 'end_title', x: W / 2 - 130, y: 538, w: 260, h: 52, label: 'タイトルへ', size: 20, primary: true, act: () => { App.scene = 'title'; } });
  }

  // ---------- あそびかた・メニュー ----------
  const HELP = [
    { title: 'めざすこと', text: '灰の魔女の呪いで、王国の人々は影の魔物に変えられた。魔物は一手ごとに一歩ずつ、左の結界へ歩いてくる。\n\n床の魔法陣（詠唱輪のリール）を回し、紋の上に立つ魔物の呪いをほどいて、人にもどそう。結界に3回ぶつかられると負け。赤い「！」がついた魔物は、次の一歩で結界にぶつかる。各地の「呪いの主」をほどくと、その地の呪いがまとめてほどける。' },
    { title: '一手の流れ', text: '① ［回す］（スペース）：床のリールが回って止まる。\n② ▲▼（Q W E R T ／ A S D F G）：リールを一コマずつずらす。魔力を1使う。戻せば魔力も戻る。\n③ ［詠唱］（スペース）：紋の力で呪いをほどく。そのあと魔物が一歩進む。\n\n回す前に［固定］（1〜5キー）を押したリールは、回らずにそのまま残る（魔力1）。\n魔物の左下の小さな丸は足元の紋。「休」「歩」は二手に一歩の魔物が、次に休むか進むか。\nメニューで「自動で回す」にすると、手番のはじめに自動で回る。' },
    { title: 'つながり', text: '同じ紋が上下左右でとなり合うと「つながり」になり、力が合わさる。力＝つながった紋のレベルの合計。\nつながりの上に立つ魔物は、全員がその力でほどかれる。\n\n光：力の2倍ほどく。\n氷：力と同じだけほどき、凍らせて次の一歩を止める。\n雷：力と同じだけほどき、くっついて並ぶ魔物へ次々に跳ぶ。\n星：どの紋ともつながる。\n魔晶：となりのつながりの力を2倍（Lv2で3倍、Lv3で4倍）。' },
    { title: '工房', text: '戦いのあと、救った人々からお礼の紋をもらえる。感謝のしるしで、市から紋を分けてもらえる。\n\n持ち物の紋を押してから、リールのマスを押すと置ける。リールの上で縦にとなり合う紋は、戦いでいっしょに出るので、縦につながりやすい。\n「試し詠唱」では、わら人形を相手に何度でもためせる。「同じ回転で試す」で、組み替える前と同じ止まり方を見比べられる。' },
    { title: '操作', text: 'スペース／Enter：回す・止める・詠唱\nQ W E R T：リール1〜5を上へずらす\nA S D F G：リール1〜5を下へずらす（マウスホイールでも）\n1〜5：固定（回す前）\nZ：ずらしを全部戻す　H：ヒント\nM：音を消す　Esc：メニュー\n\n紋や魔物にマウスを重ねると、右に説明が出る。' },
  ];
  function drawOverlay() {
    const o = App.overlay;
    ctx.fillStyle = 'rgba(8,5,16,0.78)'; ctx.fillRect(0, 0, W, H);
    if (o.kind === 'help') {
      const p = HELP[o.page];
      V.panel(ctx, 220, 80, 840, 560, { fill: 'rgba(30,22,50,0.98)', stroke: 'rgba(255,214,120,0.6)' });
      V.text(ctx, 'あそびかた　' + p.title, 260, 124, { size: 26, color: '#fff0c8', serif: true });
      V.text(ctx, (o.page + 1) + ' / ' + HELP.length, 1020, 124, { size: 14, align: 'right', color: '#a8a0c0', weight: 'normal' });
      V.para(ctx, p.text, 260, 160, 760, { size: 18, weight: 'normal', color: '#fff6e0', lh: 30 });
      if (o.page === 2) {
        ['light', 'ice', 'bolt', 'star', 'gem'].forEach((tt, i) => { V.tile(ctx, { t: tt, lv: 1 }, 600 + i * 84, 480, 72, 72, { lit: true, gscale: 0.6 }); V.text(ctx, RR.RUNE[tt].name, 636 + i * 84, 566, { size: 13, align: 'center', color: '#e6dcff', weight: 'normal' }); });
      }
      btn({ id: 'h_prev', x: 260, y: 584, w: 120, h: 40, label: '← まえ', size: 16, layer: 1, enabled: o.page > 0, act: () => { o.page--; } });
      btn({ id: 'h_next', x: 400, y: 584, w: 120, h: 40, label: 'つぎ →', size: 16, layer: 1, enabled: o.page < HELP.length - 1, act: () => { o.page++; } });
      btn({ id: 'h_close', x: 900, y: 584, w: 140, h: 40, label: 'とじる', size: 16, primary: true, layer: 1, act: () => { App.overlay = null; } });
    } else if (o.kind === 'menu') {
      V.panel(ctx, 440, 150, 400, 420, { fill: 'rgba(30,22,50,0.98)', stroke: 'rgba(255,214,120,0.6)' });
      V.text(ctx, 'メニュー', W / 2, 190, { size: 26, align: 'center', color: '#fff0c8', serif: true });
      btn({ id: 'm_resume', x: 480, y: 220, w: 320, h: 46, label: 'つづける', size: 18, primary: true, layer: 1, act: () => { App.overlay = null; } });
      btn({ id: 'm_help', x: 480, y: 276, w: 320, h: 42, label: 'あそびかた', size: 16, layer: 1, act: () => { App.overlay = { kind: 'help', page: 0 }; } });
      btn({ id: 'm_mute', x: 480, y: 328, w: 320, h: 42, label: cfg.mute ? '音：なし' : '音：あり', size: 16, layer: 1, act: toggleMute });
      btn({ id: 'm_voldn', x: 480, y: 380, w: 60, h: 42, label: '−', size: 20, layer: 1, act: () => { cfg.vol = clamp(cfg.vol - 0.1, 0, 1); A.setVol(cfg.vol); saveCfg(); A.play('click'); } });
      V.text(ctx, '音量 ' + Math.round(cfg.vol * 10), W / 2, 401, { size: 17, align: 'center', color: '#fff6e0' });
      btn({ id: 'm_volup', x: 740, y: 380, w: 60, h: 42, label: '＋', size: 20, layer: 1, act: () => { cfg.vol = clamp(cfg.vol + 0.1, 0, 1); A.setVol(cfg.vol); saveCfg(); A.play('click'); } });
      btn({ id: 'm_fast', x: 480, y: 432, w: 156, h: 42, label: cfg.fast ? '演出：はやい' : '演出：ふつう', size: 15, layer: 1, act: () => { cfg.fast = !cfg.fast; saveCfg(); } });
      btn({ id: 'm_auto', x: 644, y: 432, w: 156, h: 42, label: cfg.autoSpin ? '自動で回す：する' : '自動で回す：しない', size: 13, layer: 1, act: () => { cfg.autoSpin = !cfg.autoSpin; saveCfg(); } });
      btn({ id: 'm_title', x: 480, y: 500, w: 320, h: 46, label: 'タイトルへ（ここまでを保存）', size: 15, layer: 1, act: () => { App.overlay = null; if (S() && S().b && !BS.practice) { /* 戦いの途中は、戦いのはじめからになる */ } App.scene = 'title'; BS = null; } });
    } else if (o.kind === 'confirmNew') {
      V.panel(ctx, 400, 240, 480, 220, { fill: 'rgba(30,22,50,0.98)', stroke: 'rgba(255,214,120,0.6)' });
      V.para(ctx, 'はじめから遊ぶと、いまの続きは消えます。よろしいですか？', 440, 276, 400, { size: 18, weight: 'normal', color: '#fff6e0', lh: 30 });
      btn({ id: 'c_yes', x: 440, y: 380, w: 180, h: 48, label: 'はじめから', size: 17, primary: true, layer: 1, act: () => { drop(SAVE); newGame(); } });
      btn({ id: 'c_no', x: 660, y: 380, w: 180, h: 48, label: 'やめる', size: 17, layer: 1, act: () => { App.overlay = null; } });
    }
  }

  // ---------- 描画のまとめ ----------
  function draw() {
    ctx.setTransform(SC * DPR, 0, 0, SC * DPR, 0, 0);
    App.frame = [];
    App.layer = (App.overlay || App.talk || App.story || App.result) ? 1 : 0;
    App.drawLayer = 0;
    ctx.clearRect(0, 0, W, H);
    if (App.scene === 'title') drawTitle();
    else if (App.scene === 'battle' && BS) drawBattle();
    else if (App.scene === 'workshop' && WS) drawWorkshop();
    else if (App.scene === 'map') drawMap();
    else if (App.scene === 'ending') drawEnding();
    App.drawLayer = 1;
    if (App.result) drawResult();
    if (App.story) drawStory();
    if (App.talk) drawTalk();
    if (App.overlay) drawOverlay();
    App.btns = App.frame;
  }

  // ---------- 入力 ----------
  function toLocal(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  cv.addEventListener('pointermove', e => {
    const p = toLocal(e); App.mx = p.x; App.my = p.y;
    if (BS && BS.drag) dragMove();
  });
  cv.addEventListener('mouseleave', () => { App.mx = -1; App.my = -1; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    A.init();
    const p = toLocal(e); App.mx = p.x; App.my = p.y;
    const right = e.button === 2;
    if (!right) {
      for (let i = App.btns.length - 1; i >= 0; i--) {
        const b = App.btns[i];
        if (b.layer < App.layer) continue;
        if (inside(p.x, p.y, b)) {
          if (b.enabled === false) { A.play('deny'); return; }
          A.play('click');
          if (b.act) b.act();
          return;
        }
      }
    }
    if (App.layer > 0) {
      if (right && App.overlay) App.overlay = null;
      return;
    }
    if (App.scene === 'workshop' && WS) {
      const s = S();
      for (let r = 0; r < s.reels.length; r++) for (let k = 0; k < s.reels[r].strip.length; k++) {
        const q = wkCell(r, k);
        if (inside(p.x, p.y, { x: q.x, y: q.y, w: WK.CS, h: WK.CS })) { clickReelCell(r, k, right); return; }
      }
      if (right) { WS.hand = null; WS.smith = false; }
      return;
    }
    if (App.scene === 'battle' && BS) {
      const b = battle();
      if (right) { doReset(); return; }
      if (b && b.phase === 'aim' && !busy()) {
        const c = Math.floor((p.x - F.X) / F.CW);
        if (c >= 0 && c < b.R && p.y > F.Y - F.PEEK && p.y < F.Y + 3 * F.CH + F.PEEK) BS.drag = { c: c, y0: p.y, moved: 0 };
      }
    }
  });
  window.addEventListener('pointerup', () => { if (BS) BS.drag = null; });
  function dragMove() {
    const d = BS.drag;
    const dy = App.my - d.y0;
    const step = F.CH * 0.55;
    if (dy <= -step) { if (doShift(d.c, 1)) d.y0 -= F.CH; else d.y0 = App.my; }
    else if (dy >= step) { if (doShift(d.c, -1)) d.y0 += F.CH; else d.y0 = App.my; }
  }
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    if (App.scene !== 'battle' || !BS || App.layer > 0) return;
    const b = battle();
    if (!b) return;
    const p = toLocal(e);
    const c = Math.floor((p.x - F.X) / F.CW);
    if (c < 0 || c >= b.R) return;
    if (BS.wheelT && App.t - BS.wheelT < 0.12) return;
    BS.wheelT = App.t;
    doShift(c, e.deltaY > 0 ? -1 : 1);
  }, { passive: false });

  const UPKEYS = ['q', 'w', 'e', 'r', 't'], DNKEYS = ['a', 's', 'd', 'f', 'g'];
  window.addEventListener('keydown', e => {
    A.init();
    const k = e.key.toLowerCase();
    if (k === 'm') { toggleMute(); return; }
    if (App.story) { if (k === ' ' || k === 'enter') { e.preventDefault(); nextStory(); } return; }
    if (App.talk) { if (k === ' ' || k === 'enter') { e.preventDefault(); nextTalk(); } return; }
    if (App.overlay) {
      if (k === 'escape') App.overlay = null;
      if (App.overlay && App.overlay.kind === 'help') { if (k === 'arrowright' && App.overlay.page < HELP.length - 1) App.overlay.page++; if (k === 'arrowleft' && App.overlay.page > 0) App.overlay.page--; }
      return;
    }
    if (App.result) {
      if (k === ' ' || k === 'enter') { e.preventDefault(); if (App.result.out.win && App.result.t > 0.6) closeResult(); }
      return;
    }
    if (k === 'escape') {
      if (App.scene === 'workshop' && WS && (WS.hand || WS.smith)) { WS.hand = null; WS.smith = false; return; }
      if (App.scene !== 'title') App.overlay = { kind: 'menu' };
      return;
    }
    if (App.scene === 'battle' && BS) {
      const b = battle();
      if (!b) return;
      if (k === ' ' || k === 'enter') {
        e.preventDefault();
        if (BS.spin) stopSpinEarly();
        else if (BS.anim) { BS.anim.t = Math.max(BS.anim.t, BS.anim.end - 0.05); for (const ev of BS.anim.ev) if (!ev.fired) { ev.fired = true; ev.fn(); } }
        else if (b.phase === 'spin') doSpin();
        else if (b.phase === 'aim') doCast();
        return;
      }
      const ui = UPKEYS.indexOf(k), di = DNKEYS.indexOf(k);
      if (ui >= 0 && ui < b.R) { doShift(ui, 1); return; }
      if (di >= 0 && di < b.R) { doShift(di, -1); return; }
      if (k >= '1' && k <= '5') { const c = +k - 1; if (c < b.R) doHold(c); return; }
      if (k === 'z' || k === 'backspace') { doReset(); return; }
      if (k === 'h') { doHint(); return; }
    }
    if (App.scene === 'map' && (k === ' ' || k === 'enter')) { e.preventDefault(); startBattle(); }
  });

  // ---------- ループ ----------
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.05);
    if (!App.debugHold) { update(dt); draw(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- 検証用のつなぎ口 ----------
  window.KR16 = {
    App: App, get BS() { return BS; }, get WS() { return WS; },
    buttons: () => App.btns.filter(b => b.layer >= App.layer).map(b => ({ id: b.id, x: b.x + b.w / 2, y: b.y + b.h / 2, en: b.enabled !== false, label: b.label })),
    state: () => App.s,
    hold: v => { App.debugHold = v; },
    step: (n, dt) => { for (let i = 0; i < (n || 1); i++) update(dt || 1 / 60); draw(); },
    cellPx: (c, r) => ({ x: cxOf(c + 0.5), y: cyOf(r + 0.5) }),
    wkCell: (r, k) => { const q = wkCell(r, k); return { x: q.x + WK.CS / 2, y: q.y + WK.CS / 2 }; },
    suggest: () => { const s = App.s; if (!s || !s.b || s.b.phase !== 'aim') return null; const b = RR.bestShift(s); return b && { offs: b.offs, n: b.res.purified.length }; },
    suggestPlace: seed => { const s = App.s; const p = G.suggestPlace(s, seed); return p && { ii: p.ii, r: p.r, k: p.k }; },
    suggestBuy: () => G.suggestBuy(App.s),
    scene: () => ({ scene: App.scene, overlay: App.overlay && App.overlay.kind, talk: !!App.talk, story: !!App.story, result: App.result && { win: App.result.out.win }, phase: App.s && App.s.b && App.s.b.phase, stage: App.s && App.s.stage, gifts: App.s && App.s.gifts && App.s.gifts.length, inv: App.s && App.s.inv.length, coins: App.s && App.s.coins }),
    busy: () => busy(),
    newGame: seed => { App.s = G.newGame(seed || 7); App.story = null; App.overlay = null; App.scene = 'map'; MS = { t: 0 }; },
    goto: (stage, seed) => { const s = G.newGame(seed || 7); s.stage = stage; App.s = s; App.story = null; App.overlay = null; App.result = null; App.talk = null; },
    startBattle: () => startBattle(),
    ending: () => startEnding(),
    workshop: () => enterWorkshop(),
    practice: () => startPractice(),
    cfg: cfg,
  };
})();
