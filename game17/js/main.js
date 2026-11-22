// ずらり、砦くずし — 進行・入力・画面・演出
(function () {
  'use strict';
  const W = 1280, H = 720;
  const Z = window.ZR, V = window.ZV, A = window.ZA, D = window.ZD;
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
  const SAVE = 'zurari17_save', CFG = 'zurari17_cfg', REC = 'zurari17_rec';
  function load(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できない環境では何もしない */ } }
  const cfg = Object.assign({ mute: false, vol: 0.7, bgm: 0.45, fast: false, auto: false }, load(CFG) || {});
  A.setMuted(cfg.mute); A.setVol(cfg.vol); A.setBgmVol(cfg.bgm);
  const saveCfg = () => store(CFG, cfg);
  const rec = Object.assign({ cleared: false, trial: 0, trialKills: 0 }, load(REC) || {});
  const saveRec = () => store(REC, rec);
  function saveGame(where) {
    const s = App.s;
    if (!s) return;
    const copy = Z.clone(s);
    copy.b = null;
    copy.where = where || 'camp';
    store(SAVE, copy);
  }

  // ---------- アプリ ----------
  const App = { scene: 'title', s: null, t: 0, frame: [], btns: [], tips: [], mx: -1, my: -1, overlay: null, toast: null, held: null, drawLayer: 0, debugHold: false, speed: 1 };
  const S = () => App.s;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const inside = (x, y, b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  const mod = (a, n) => ((a % n) + n) % n;
  const SPD = () => (cfg.fast ? 2.2 : 1) * App.speed * (BS && BS.rush ? 3 : 1);

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

  // ---------- 戦場の配置 ----------
  const L = {
    RX: 24, RW: 80, RG: 8, Y: 150, RH: 128,
    SX: 470, SW: 92, BX: 566, FX: 592, CW: 80, PX: 1152, PW: 120,
  };
  const reelX = i => L.RX + i * (L.RW + L.RG);
  const rowY = r => L.Y + r * L.RH;
  const rowCY = r => L.Y + r * L.RH + L.RH / 2;
  const footY = l => L.Y + l * L.RH + L.RH * 0.8;
  const cellCX = c => (c >= Z.PART_COL ? L.PX + L.PW / 2 : L.FX + c * L.CW + L.CW / 2);
  const F = { Y: L.Y, RH: L.RH, FX: L.FX, FW: L.CW * 7, CW: L.CW };

  // ---------- 戦いの画面状態 ----------
  let BS = null;
  function newBS(kind) {
    const s = S();
    return {
      kind: kind, vis: s.reels.map(r => r.pos), spin: null, tl: null, fx: [], pops: [], dm: { en: {}, parts: [] },
      pred: null, predKey: '', msg: '', coach: null, hint: null, shake: 0, flash: 0, big: null, plate: [0, 0, 0],
      guardHit: 0, banner: null, drag: null, runners: [], over: null, lit: 0, prevRes: null, autoT: -1, stepT: 0,
      scriptTurn: 0, cmp: null, missNote: false, lastRes: null,
    };
  }
  function syncDM(keepPos) {
    const b = S().b, dm = BS.dm;
    const keep = dm.en;
    dm.en = {};
    for (const e of b.en) {
      const old = keep[e.id];
      const tx = cellCX(e.col), ty = footY(e.lane);
      dm.en[e.id] = {
        id: e.id, t: e.t, lane: e.lane, col: e.col, hp: e.hp, max: e.max, frz: e.frz, rest: e.rest, cd: e.cd,
        x: old && keepPos !== false ? old.x : tx, y: old && keepPos !== false ? old.y : ty, tx: tx, ty: ty,
        alpha: old ? old.alpha : 1, flash: 0, dying: 0, flee: 0,
      };
    }
    // 消えかけのもの（倒れた・逃げた）は残して演出を続ける
    for (const id in keep) if (!dm.en[id] && (keep[id].dying > 0 || keep[id].flee > 0 || keep[id].strike > 0)) dm.en[id] = keep[id];
    dm.parts = b.parts.map((p, i) => {
      const o = BS.dm.parts[i] || {};
      return { hp: p.hp, max: p.max, dead: p.dead, wood: p.wood, n: p.n, shake: o.shake || 0, fall: o.fall || 0, frz: p.frz };
    });
    BS.lit = b.parts.length ? b.parts.filter(p => p.dead).length / b.parts.length : 1;
  }

  function stageId() {
    const b = S().b;
    if (!b) return 'camp';
    if (b.practice) return 'practice';
    return Z.STAGES[b.stage].id;
  }
  function partKind(lane) {
    const b = S().b;
    if (b.practice) return 'wood';
    if (b.army) return lane === 1 ? 'lord' : 'banner';
    return lane === 1 ? 'gate' : 'tower';
  }

  // ---------- 戦いを始める ----------
  function startBattle(idx) {
    const s = S();
    saveGame('battle');
    Z.startBattle(s, idx);
    BS = newBS('battle');
    syncDM(false);
    const def = Z.STAGES[idx];
    BS.banner = { title: def.name, sub: def.sub, t: 0 };
    App.scene = 'battle';
    A.music(idx >= 5 ? 'final' : 'battle');
    BS.msg = idx === 0 ? '「回す」（スペース）で詠唱盤を回そう。' : def.sub;
    if (S().b.scarred) BS.msg = '前の攻めで崩した傷は、そのまま残っている。' + (S().b.reinforce ? `援軍が駆けつけ、陣の守りが ${S().b.reinforce} 増えた。` : '') + def.sub;
    startTurn(true);
  }
  function startPractice() {
    const s = S();
    const keepCmp = BS && BS.kind === 'practice' ? BS.cmp : (App.practiceCmp || null);
    Z.startPractice(s);
    BS = newBS('practice');
    BS.cmp = keepCmp || { last: null, prev: null };
    syncDM(false);
    App.scene = 'battle';
    BS.msg = '試し撃ち：わら人形と木の的で、いまのリールを試せる。「同じ回転で」を押すと、前と同じ止まり方になる。';
    A.music('camp');
  }

  function startTurn(first) {
    const b = S().b;
    BS.pred = null; BS.predKey = ''; BS.hint = null; BS.coach = null;
    if (!first && !b.practice) BS.msg = '';
    if (cfg.auto && !b.practice && !b.over && !(b.script && b.turn <= 3)) BS.autoT = 0.8;
  }

  // ---------- 回す ----------
  const SCRIPT = {
    // 最初の砦：はじめの手番だけ止まり方を決めておく
    watch: [
      { pos: [0, 0, 0], msg: '横一行が、ひとつの呪文。1行目「剣・一点」は上の道の小鬼へ、2行目「炎・一点」は真ん中へ、3行目「剣・一点・×2」は下の道へ飛ぶ。右下の「放つ」で詠唱！' },
      { pos: [2, 1, 1], msg: '3行目の「形」が空き（点線）なので、この行は呪文にならない。「形」のリールの ▼ を押して一つずらすと、空きが下へ消え、三行とも呪文になる。', want: [0, -1, 0] },
      { pos: [0, 0, 2], msg: '「力」の ×2 は1行目にある。▼ で一つずらすと ×2 が2行目へ下がり、「炎・一点・×2」＝12 で砦門を一撃で崩せる。リールの上下の小さな札は、ずらすと入ってくる言葉。', want: [0, 0, -1] },
    ],
  };
  function doSpin(pos) {
    const s = S(), b = s.b;
    if (b.phase !== 'spin' || BS.spin || BS.tl) return;
    A.init();
    let script = null;
    if (!pos && b.script === 'watch' && BS.scriptTurn < SCRIPT.watch.length) { script = SCRIPT.watch[BS.scriptTurn]; pos = script.pos; BS.scriptTurn++; }
    // 戦いのはじめは、工房で新しく刻んだ言葉が「一つずらせば効く」止まり方を探す
    if (!pos && b.turn === 1 && !b.practice && !BS.teachTried && (b.army ? b.castsLeft === Z.STAGES[Z.FINAL].casts : true) && b.stage >= 1 && s.reels.some(r => r.strip.some(w => w.nw))) {
      BS.teachTried = true;
      const tsp = Z.findTeachSpin(s, b.script !== 'teach');
      if (tsp) { pos = tsp.pos; BS.teach = tsp; }
    }
    if (pos && pos.length < s.reels.length) pos = pos.concat(s.reels.slice(pos.length).map(() => 0));
    if (b.practice) { Z.resetDummies(s); syncDM(false); }
    Z.spin(s, pos);
    BS.banner = null;
    BS.script = script;
    BS.spin = { t: 0, stops: s.reels.map((r, i) => 0.28 + i * 0.17), done: s.reels.map(() => false) };
    BS.autoT = -1;
    BS.msg = '';
    A.play('click');
  }
  function stopSpinNow() { if (BS.spin) BS.spin.t = 99; }
  function finishSpin() {
    BS.spin = null;
    const s = S(), b = s.b;
    BS.pred = null; BS.predKey = '';
    if (BS.script) BS.msg = BS.script.msg;
    else if (BS.teach && BS.teach.used !== true) {
      const r = BS.teach;
      r.used = true;
      const nm = Z.ROLE[s.reels[r.reel].role].name;
      const st = s.reels[r.reel].strip, pos = s.reels[r.reel].pos, n = st.length;
      // 一つずらして窓に入ってくる言葉（▲なら下の札、▼なら上の札）
      const w = r.dir > 0 ? st[mod(pos + 3, n)] : st[mod(pos - 1, n)];
      r.row = r.dir > 0 ? 2 : 0;
      const tail = b.script === 'teach' ? '魔物を貫いて砦まで届く' : '見こみが大きく伸びる';
      BS.hintMsg = true; // ずらしたら見こみの文に切りかえる
      if (w) BS.msg = `工房で刻んだ「${Z.W[w.k].name}」（「新」の札）が、いま窓の${r.dir > 0 ? '下' : '上'}にはみ出している。${nm}のリールを ${r.dir > 0 ? '▲' : '▼'} で一つずらすと${r.row + 1}行目に入り、${tail}。`;
      BS.coachWant = { reel: r.reel, dir: r.dir, cast: b.casts };
    } else if (b.practice) BS.msg = '▲▼ でずらして、見こみを見てから「放つ」。';
    else if (b.stage === 0 && b.turn <= 5) BS.msg = '数字は見こみのダメージ。▲▼でずらして、いちばん効く並びを探そう。迷ったら「ヒント」。';
  }

  // ---------- 見こみ ----------
  function predKey() { const s = S(); return s.reels.map(r => r.pos).join(',') + '|' + s.b.offs.join(','); }
  function ensurePred() {
    const s = S(), b = s.b;
    if (!b || b.phase !== 'aim' || BS.spin || BS.tl) return null;
    const k = predKey();
    if (k !== BS.predKey) {
      BS.predKey = k;
      BS.pred = Z.predict(s);
    }
    return BS.pred;
  }

  function shiftReel(i, dir) {
    const s = S(), b = s.b;
    if (!b || BS.spin || BS.tl) return;
    if (b.phase !== 'aim') { if (b.phase === 'spin') toast('先に「回す」'); return; }
    if (i >= s.reels.length) return;
    if (!Z.shift(s, i, dir)) {
      A.play('deny');
      if (Z.manaLeft(s) <= 0 && Math.abs(b.offs[i] + dir) > Math.abs(b.offs[i])) toast('魔力が足りない（戻すと魔力ももどる）');
      return;
    }
    A.play('shift', { dir: dir });
    BS.hint = null;
    if (BS.hintMsg) { BS.msg = ''; BS.hintMsg = false; }
    const before = BS.pred;
    BS.predKey = '';
    const p = ensurePred();
    if (before && p && p.dmg > before.dmg) A.play('align', { i: Math.min(9, Math.floor(p.dmg / 4)) });
  }
  function resetShift() {
    const s = S();
    if (!s.b || s.b.phase !== 'aim' || BS.tl) return;
    if (s.b.offs.some(o => o)) { Z.resetShift(s); A.play('shift', { dir: -1 }); BS.predKey = ''; }
  }

  // ヒント：魔力の範囲でいちばん効くずらし方
  function showHint() {
    const s = S(), b = s.b;
    if (!b || b.phase !== 'aim' || BS.tl) { toast('回してから使える'); return; }
    const save = b.offs.slice();
    const best = Z.bestShift(s);
    b.offs = save;
    if (!best) return;
    const same = best.offs.every((o, i) => o === b.offs[i]);
    const stage = BS.hint && BS.hint.key === predKey() ? 2 : 1;
    BS.hint = { offs: best.offs, t: 0, stage: stage, key: predKey() };
    BS.hintMsg = true;
    if (same) { BS.msg = 'ヒント：いまの並びが、いちばん効く。このまま「放つ」。'; return; }
    const r0 = best.res;
    if (stage === 1) {
      const names = [];
      best.offs.forEach((o, i) => { if (o !== b.offs[i]) names.push(`${Z.ROLE[s.reels[i].role].name}${i >= 2 && i <= 3 && s.reels.length > 3 ? (i - 1) : ''}`); });
      BS.msg = `手がかり：光っている「${names.join('」「')}」のリールをずらすと、もっと効く並びになる（最善なら 倒す${r0.kills + r0.fled}体・砦に${r0.partDmg}）。もう一度「ヒント」で答え。`;
      return;
    }
    const parts = [];
    best.offs.forEach((o, i) => { const d = o - b.offs[i]; if (d) parts.push(`${Z.ROLE[s.reels[i].role].name}${i >= 2 && i <= 3 ? (i - 1) : ''}を${d > 0 ? '▲' : '▼'}${Math.abs(d)}`); });
    const r = best.res;
    const bits = [];
    if (r.kills + r.fled) bits.push(`${r.kills + r.fled}体を倒す`);
    if (r.partDmg) bits.push(`砦に${r.partDmg}`);
    if (r.downs) bits.push(`${r.downs}か所崩れる`);
    if (r.guardLoss) bits.push(`陣への被害${r.guardLoss}`); else bits.push('陣への被害なし');
    BS.msg = `ヒント：${parts.join('・')} → ${bits.join('・')}（光っているボタン）`;
  }

  // ---------- 放つ ----------
  function doCast() {
    const s = S(), b = s.b;
    if (b.phase !== 'aim' || BS.spin || BS.tl) return;
    A.init();
    const before = Z.predict(s);
    // ずらせば届いたのに何もせず放つとき、一度だけ知らせる
    if (!b.practice && !BS.missNote && b.offs.every(o => !o) && b.stage <= 2) {
      const best = Z.bestShift(s);
      if (best && best.score > Z.score(s, before) + 6) {
        BS.missNote = true;
        BS.msg = 'いまの並びでもよいが、ずらすともっと効く並びがある（ヒント：H）。もう一度「放つ」でそのまま詠唱。';
        A.play('deny');
        return;
      }
    }
    syncDM();
    const res = Z.cast(s);
    BS.lastRes = res;
    BS.hint = null; BS.pred = null; BS.predKey = '';
    BS.msg = '';
    playCast(res);
  }

  // 演出の時間割
  function TL() { return { t: 0, ev: [], end: 0, done: null }; }
  function at(tl, time, fn) { tl.ev.push({ at: time, fn: fn }); tl.ev.sort((a, c) => a.at - c.at); if (time > tl.end) tl.end = time; }
  function runTL(dt) {
    const tl = BS.tl;
    if (!tl) return;
    tl.t += dt;
    while (tl.ev.length && tl.ev[0].at <= tl.t) tl.ev.shift().fn();
    if (!tl.ev.length && tl.t >= tl.end) { BS.tl = null; BS.rush = false; if (tl.done) tl.done(); }
  }

  function targetXY(h) {
    if (typeof h.id === 'string') return { x: L.PX + L.PW / 2, y: rowCY(h.lane) + 10 };
    const e = BS.dm.en[h.id];
    if (e) return { x: e.x, y: e.y - 30 };
    return { x: cellCX(h.col), y: footY(h.lane) - 30 };
  }

  function playCast(res) {
    const tl = TL();
    let t0 = 0.12;
    let ki = 0, hi = 0;
    const total = res.kills + res.fled;
    for (const f of res.fires) {
      const start = t0;
      const sx = L.SX + L.SW - 6, sy = rowCY(f.lane);
      const col = V.SRC_COL[f.src];
      let dur = 0.35;
      const hitAt = [];
      if (f.shape === 'point') {
        const h = f.hits[0];
        if (h) { const p = targetXY(h); const tt = start + 0.06 + Math.abs(p.x - sx) / 1700; hitAt.push([h, tt]); dur = tt - start + 0.12; }
        at(tl, start, () => BS.fx.push({ k: 'orb', col: col, sx: sx, sy: rowCY(f.row), tx: h ? targetXY(h).x : 1150, ty: h ? targetXY(h).y : sy, t: 0, d: Math.max(0.08, dur - 0.12), lane: f.lane }));
      } else if (f.shape === 'lance') {
        let endX = L.PX + L.PW / 2;
        f.hits.forEach(h => { const p = targetXY(h); hitAt.push([h, start + 0.04 + Math.abs(p.x - sx) / 2000]); });
        if (f.hits.length && f.left === 0) endX = targetXY(f.hits[f.hits.length - 1]).x;
        if (!f.hits.length) endX = 1150;
        dur = 0.05 + Math.abs(endX - sx) / 2000 + 0.18;
        at(tl, start, () => BS.fx.push({ k: 'lance', col: col, sx: sx, sy: sy, ex: endX, t: 0, d: dur - 0.1, lane: f.lane, power: f.power }));
      } else if (f.shape === 'sweep') {
        f.hits.forEach(h => { const p = targetXY(h); hitAt.push([h, start + 0.05 + Math.abs(p.x - L.BX) / 1500]); });
        dur = 0.5;
        at(tl, start, () => BS.fx.push({ k: 'sweep', col: col, t: 0, d: 0.55, hits: f.hits.map(h => targetXY(h)) }));
      } else if (f.shape === 'burst') {
        const c = f.at ? { x: cellCX(f.at.col), y: footY(f.at.lane) - 30 } : { x: 900, y: sy };
        const tt = start + 0.06 + Math.abs(c.x - sx) / 1700;
        f.hits.forEach(h => hitAt.push([h, tt + 0.03]));
        dur = tt - start + 0.3;
        at(tl, start, () => BS.fx.push({ k: 'orb', col: col, sx: sx, sy: rowCY(f.row), tx: c.x, ty: c.y, t: 0, d: tt - start, lane: f.lane }));
        if (f.at) at(tl, tt, () => { BS.fx.push({ k: 'ring', col: col, x: c.x, y: c.y, t: 0, d: 0.45, r: L.CW * 1.7 }); BS.shake = Math.max(BS.shake, 0.25); });
      } else if (f.shape === 'storm') {
        f.hits.forEach((h, i) => hitAt.push([h, start + 0.2 + i * 0.035]));
        dur = 0.3 + f.hits.length * 0.035 + 0.2;
        at(tl, start, () => BS.fx.push({ k: 'storm', col: col, t: 0, d: dur }));
      }
      at(tl, start, () => { A.play('cast', { src: f.src, shape: f.shape }); BS.plate[f.row] = 1; });
      for (const [h, tt] of hitAt) {
        at(tl, tt, () => applyHit(h, f, h.kill ? ki++ : hi++));
        if (f.shape === 'storm') at(tl, tt - 0.02, () => { const p = targetXY(h); BS.fx.push({ k: 'zap', col: col, x: p.x, y: p.y, t: 0, d: 0.25 }); });
      }
      // 砦が崩れたら、その道の魔物は逃げ出す
      if (f.downs.length) {
        const tDown = (hitAt.find(([h]) => typeof h.id === 'string' && h.kill) || [null, start + dur])[1];
        for (const lane of f.downs) at(tl, tDown + 0.01, () => partCollapse(lane, f));
        if (f.flee.length) at(tl, tDown + 0.35, () => { for (const id of f.flee) { const e = BS.dm.en[id]; if (e) e.flee = 1; } A.play('cheer'); });
      }
      t0 = start + Math.max(0.26, dur * 0.72) / Math.max(1, Math.min(2.2, res.fires.length / 5));
    }
    if (res.flee && res.flee.length) at(tl, t0 + 0.3, () => { for (const id of res.flee) { const e = BS.dm.en[id]; if (e) e.flee = 1; } });
    at(tl, t0 + 0.5, () => {
      if (total >= 5) { BS.big = { text: `ごっそり ${total}体！`, sub: res.partDmg ? `砦に ${res.partDmg}` : '', t: 0, col: '#ffe27a' }; A.play('big'); BS.flash = 0.5; }
      else if (res.partDmg >= 20) { BS.big = { text: `砦に ${res.partDmg}！`, sub: '', t: 0, col: '#ffd0a0' }; A.play('big'); }
    });
    tl.done = () => afterCast(res);
    BS.tl = tl;
  }

  function applyHit(h, f, idx) {
    const col = V.SRC_COL[f.src];
    const p = targetXY(h);
    if (typeof h.id === 'string') {
      const dp = BS.dm.parts[h.lane];
      if (dp) { dp.hp = Math.max(0, dp.hp - h.dmg); dp.shake = 0.35; }
      A.play('part');
      BS.pops.push({ x: p.x, y: p.y - 40, text: h.block ? '止まる' : '−' + h.dmg, col: '#ffcf8a', t: 0, big: h.dmg >= 20 });
      BS.shake = Math.max(BS.shake, Math.min(0.6, 0.12 + h.dmg / 120));
    } else {
      const e = BS.dm.en[h.id];
      if (e) {
        e.hp = Math.max(0, e.hp - h.dmg);
        e.flash = 0.15;
        if (h.frz) { e.frz = 1; A.play('freeze'); }
        if (h.kill) { e.dying = 1; }
      }
      if (h.block) { A.play('block'); BS.pops.push({ x: p.x, y: p.y - 26, text: '盾！', col: '#d8e0ff', t: 0 }); }
      else BS.pops.push({ x: p.x, y: p.y - 26, text: '−' + h.dmg, col: h.kill ? '#fff' : '#ffd6c0', t: 0 });
      if (h.kill) {
        A.play('kill', { i: idx });
        for (let i = 0; i < 8; i++) BS.fx.push({ k: 'spark', col: col, x: p.x, y: p.y, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 220, t: 0, d: 0.5 + Math.random() * 0.3 });
        BS.fx.push({ k: 'coin', x: p.x, y: p.y, t: 0, d: 0.7 });
      } else if (!h.block) A.play('hit', { i: idx });
    }
    BS.fx.push({ k: 'burst', col: col, x: p.x, y: p.y, t: 0, d: 0.25, r: 22 });
  }

  function partCollapse(lane, f) {
    const dp = BS.dm.parts[lane];
    if (!dp) return;
    dp.dead = true; dp.fall = 1;
    A.play('crumble');
    BS.shake = Math.max(BS.shake, 0.7);
    const x = L.PX + L.PW / 2, y = rowCY(lane);
    for (let i = 0; i < 22; i++) BS.fx.push({ k: 'rock', x: x + (Math.random() - 0.5) * 90, y: y - 50 + Math.random() * 40, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 160, t: 0, d: 0.9 + Math.random() * 0.4 });
    BS.fx.push({ k: 'dust', x: x, y: y + 30, t: 0, d: 1.2 });
    const b = S().b;
    if (b.army) {
      BS.big = f.lord ? { text: '魔王が崩れ落ちた！', sub: '軍勢がいっせいに逃げていく', t: 0, col: '#ffe27a' } : { text: `${b.parts[lane].n}が倒れた！`, sub: 'その道の軍勢が逃げていく', t: 0, col: '#ffe9b0' };
      if (f.lord) { BS.flash = 1; BS.shake = 1; }
    }
    if (!b.practice && !b.army) {
      const n = (f.inside || 0);
      const p = b.parts[lane];
      BS.big = { text: `${p.n}が崩れた！`, sub: n ? `中の守備兵 ${n}人も逃げ出した` : (f.flee.length ? `道の魔物 ${f.flee.length}体が逃げ出した` : ''), t: 0, col: '#ffe9b0' };
      // とらわれていた人々が出てくる
      const kinds = ['villager', 'child', 'old', 'villager'];
      for (let i = 0; i < 3; i++) BS.runners.push({ x: L.PX + 20 + i * 14, y: footY(lane) - 6 + i * 3, kind: kinds[(lane + i) % 4], t: -i * 0.25, vx: -120 - i * 15 });
    }
  }

  function afterCast(res) {
    const s = S(), b = s.b;
    syncDM();
    if (b.practice) {
      BS.cmp.prev = BS.cmp.last;
      BS.cmp.last = { kills: res.kills, dmg: res.dmg, partDmg: res.partDmg, spin: b.lastSpin.slice(), reels: s.reels.map(r => r.strip.map(w => w.k + w.lv).join(',')), fires: res.fires.length };
      App.practiceCmp = BS.cmp;
      BS.msg = practiceMsg();
      return;
    }
    if (b.army) {
      if (b.over === 'win') { armyEnd(res); return; }
      const had = new Set(b.en.map(e => e.id));
      Z.enemyPhase(s);
      syncDM(false);
      for (const id in BS.dm.en) if (!had.has(+id)) { BS.dm.en[id].x = cellCX(8); BS.dm.en[id].alpha = 0; }
      startTurn();
      BS.msg = `残りの詠唱 ${b.castsLeft} 回。軍勢がまた押し寄せた！ 魔王（真ん中の道の奥）まで届かせよう。`;
      return;
    }
    if (b.casts === 1) for (const r of s.reels) for (const w of r.strip) delete w.nw;
    if (b.over === 'win') { victory(res); return; }
    playEnemy();
  }

  // 新しく刻んだ言葉が真ん中の行に来る止まり方（ほかのリールは前の回転のまま）
  function newWordSpin() {
    const s = S();
    for (let i = 0; i < s.reels.length; i++) {
      const j = s.reels[i].strip.findIndex(w => w.nw);
      if (j >= 0) {
        const base = BS.cmp && BS.cmp.last ? BS.cmp.last.spin.slice() : s.reels.map(r => r.pos);
        while (base.length < s.reels.length) base.push(0);
        base[i] = mod(j - 1, s.reels[i].strip.length);
        return base;
      }
    }
    return null;
  }
  function practiceMsg() {
    const c = BS.cmp;
    if (!c.last) return '';
    let m = `今回：倒した ${c.last.kills}体・ダメージの合計 ${c.last.dmg}`;
    if (c.prev && c.prev.spin.join() === c.last.spin.join()) {
      const changed = c.prev.reels.join('|') !== c.last.reels.join('|');
      m = `同じ回転で比べると：${changed ? '組み替え前' : '前回'} ${c.prev.kills}体・合計${c.prev.dmg} → ${changed ? '組み替え後' : '今回'} ${c.last.kills}体・合計${c.last.dmg}`;
      if (changed) m += (c.last.dmg > c.prev.dmg ? '　強くなった！' : (c.last.dmg < c.prev.dmg ? '　前のほうが強かった' : '　変わらない（変えたマスが窓に入っていないかも）'));
    }
    return m;
  }

  // ---------- 魔王軍の手番 ----------
  function playEnemy() {
    const s = S(), b = s.b;
    const ev = Z.enemyPhase(s);
    const tl = TL();
    const dm = BS.dm;
    let strikes = 0;
    for (const e of ev) {
      if (e.k === 'move') {
        const d = dm.en[e.id];
        if (d) { d.tx = cellCX(e.to); d.col = e.to; }
      } else if (e.k === 'strike') {
        const d = dm.en[e.id];
        strikes++;
        at(tl, 0.05, () => { if (d) { d.tx = L.BX + 20; d.strike = 1; } });
        at(tl, 0.28, () => { BS.guardHit = 0.5; BS.shake = 0.5; A.play('strike'); BS.pops.push({ x: L.BX + 10, y: rowCY(e.lane) - 30, text: '守り −' + e.dmg, col: '#ff8a8a', t: 0, big: true }); if (d) d.dying = 1; });
      } else if (e.k === 'shoot') {
        at(tl, 0.1, () => { BS.fx.push({ k: 'arrow', sx: cellCX(e.col), sy: rowCY(e.lane) - 10, ex: L.BX + 14, t: 0, d: 0.3 }); A.play('arrow'); });
        at(tl, 0.4, () => { BS.guardHit = 0.4; A.play('strike'); BS.pops.push({ x: L.BX + 10, y: rowCY(e.lane) - 30, text: '守り −' + e.dmg, col: '#ff8a8a', t: 0 }); });
      } else if (e.k === 'ballista') {
        at(tl, 0.15, () => { BS.fx.push({ k: 'bigarrow', sx: L.PX + 10, sy: rowCY(e.lane) - 20, ex: L.BX + 16, t: 0, d: 0.35 }); A.play('arrow'); });
        at(tl, 0.5, () => { BS.guardHit = 0.6; BS.shake = 0.45; A.play('strike'); BS.pops.push({ x: L.BX + 14, y: rowCY(e.lane) - 40, text: '大矢 守り −' + e.dmg, col: '#ff8a8a', t: 0, big: true }); });
      } else if (e.k === 'thaw') {
        const d = dm.en[e.id]; if (d) d.frz = 0;
      } else if (e.k === 'spawn') {
        at(tl, 0.3, () => { A.play('spawn'); });
      }
    }
    at(tl, 0.05, () => A.play('step'));
    at(tl, 0.55, () => {});
    tl.done = () => {
      syncDM();
      for (const e of ev) if (e.k === 'spawn') { const d = BS.dm.en[e.id]; if (d) { d.x = L.PX + 20; d.alpha = 0; } }
      if (b.over === 'lose') { defeat(); return; }
      startTurn();
    };
    BS.tl = tl;
  }

  // ---------- 勝ち・負け ----------
  function victory(res) {
    const s = S(), b = s.b;
    A.play('win');
    BS.flash = 0.8;
    BS.over = { kind: 'win', t: 0, kills: b.kills, best: b.bestKills, bestDmg: b.bestDmg, turns: b.turn, gold: b.gold };
    for (let i = 0; i < 6; i++) BS.runners.push({ x: L.PX + 10 + i * 10, y: footY(i % 3) - 4, kind: ['villager', 'child', 'old'][i % 3], t: -0.2 * i, vx: -140 - i * 10 });
  }
  function defeat() {
    A.play('lose');
    const b = S().b;
    BS.over = { kind: 'lose', t: 0, turns: b.turn };
  }
  function leaveBattle() {
    const s = S(), b = s.b;
    const idx = b.stage;
    const win = b.over === 'win';
    const out = Z.finishBattle(s);
    App.lastOut = out;
    saveGame('camp');
    if (win) {
      openMap(idx);
    } else {
      openCamp();
    }
  }

  function armyEnd(res) {
    const s = S(), b = s.b;
    A.play('win');
    BS.flash = 1;
    const trial = !!App.trial;
    BS.over = { kind: trial ? 'trial' : 'army', t: 0, kills: b.kills, bestKills: b.bestKills, bestDmg: b.bestDmg, lord: !!b.lordDown, used: Z.STAGES[Z.FINAL].casts - b.castsLeft };
    if (trial) {
      if (b.kills > rec.trialKills) rec.trialKills = b.kills;
      saveRec();
    }
  }

  // ---------- 物語 ----------
  function startStory(lines, then) {
    App.story = { lines: lines, i: 0, t: 0, then: then };
    App.scene = 'story';
  }
  function storyNext() {
    const st = App.story;
    if (!st) return;
    if (st.t < 0.25) { st.t = 1; return; }
    A.play('page');
    st.i++; st.t = 0;
    if (st.i >= st.lines.length) { const f = st.then; App.story = null; f(); }
  }

  // ---------- 地図 ----------
  function openMap(freedIdx) {
    App.scene = 'map';
    App.map = { t: 0, freed: freedIdx, talk: freedIdx !== undefined && freedIdx !== null ? D.FREED[freedIdx] : null };
    A.music('camp');
    if (App.map.talk) A.play('cheer');
  }

  // ---------- 工房 ----------
  function openCamp() {
    App.scene = 'camp';
    App.held = null;
    App.campMode = 'place';
    A.music('camp');
    const s = S();
    if (s.gift) App.overlay = { kind: 'gift', t: 0 };
    saveGame('camp');
  }

  // ---------- 新しく始める・続き ----------
  function newGame(seed) {
    A.init();
    const qs = /[?&]seed=(\d+)/.exec(location.search);
    const sd = seed !== undefined ? seed : (qs ? +qs[1] : (Date.now() & 0x7fffffff));
    App.s = Z.newGame(sd);
    App.trial = false;
    App.practiceCmp = null;
    startStory(D.INTRO, () => startBattle(0));
  }
  function continueGame() {
    A.init();
    const sv = load(SAVE);
    if (!sv) return;
    App.s = sv;
    App.trial = false;
    if (sv.where === 'battle') startBattle(sv.stage);
    else openCamp();
  }
  function startTrial() {
    A.init();
    const sv = load(SAVE);
    if (!sv || !sv.cleared) return;
    App.s = sv;
    App.trial = true;
    Z.startBattle(App.s, Z.FINAL);
    BS = newBS('battle');
    syncDM(false);
    BS.banner = { title: '大詠唱の腕だめし', sub: '完成した詠唱盤で、軍勢をどれだけ倒せるか。詠唱は三度。', t: 0 };
    App.scene = 'battle';
    A.music('final');
    startTurn(true);
  }

  // ======================================================================
  // 描画
  // ======================================================================
  function draw() {
    App.frame = [];
    App.tips = [];
    App.drawLayer = 0;
    ctx.setTransform(SC * DPR, 0, 0, SC * DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    switch (App.scene) {
      case 'title': drawTitle(); break;
      case 'story': drawStory(); break;
      case 'battle': drawBattle(); break;
      case 'map': drawMap(); break;
      case 'camp': drawCamp(); break;
      case 'ending': drawEnding(); break;
    }
    App.drawLayer = 1;
    if (App.overlay) drawOverlay();
    drawTips();
    if (App.toast) {
      const tt = App.toast;
      const a = Math.min(1, (tt.dur - tt.t) * 3, tt.t * 6);
      ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
      ctx.font = V.font(18, 700);
      const w = ctx.measureText(tt.text).width + 40;
      const ty = App.scene === 'camp' ? 666 : 84, tx = App.scene === 'camp' ? 820 : W / 2;
      V.rr(ctx, tx - w / 2, ty, w, 40, 12); ctx.fillStyle = 'rgba(20,16,30,.92)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,150,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      V.text(ctx, tt.text, tx, ty + 20, { align: 'center', size: 18, weight: 700, color: '#ffe9b0' });
      ctx.restore();
    }
    App.btns = App.frame;
  }

  function drawTips() {
    const top = App.overlay ? 1 : 0;
    let tp = null;
    for (const t of App.tips) if (t.layer >= top && inside(App.mx, App.my, t)) tp = t;
    if (!tp || App.held) return;
    ctx.font = V.font(14, 500);
    const lines = V.wrap(ctx, tp.text, 300);
    const w = 324, h = 40 + lines.length * 21;
    let x = App.mx + 16, y = App.my + 16;
    if (x + w > W - 8) x = App.mx - w - 12;
    if (y + h > H - 8) y = H - h - 8;
    V.panel(ctx, x, y, w, h, { dark: true, r: 10 });
    V.text(ctx, tp.title, x + 12, y + 18, { size: 15, weight: 800, color: '#ffe2a0' });
    lines.forEach((l, i) => V.text(ctx, l, x + 12, y + 40 + i * 21, { size: 14, weight: 500, color: '#f2ead8' }));
  }

  // ---------- 上の帯 ----------
  function topBar(title, sub) {
    const g = ctx.createLinearGradient(0, 0, 0, 66);
    g.addColorStop(0, 'rgba(20,15,32,.85)'); g.addColorStop(1, 'rgba(20,15,32,.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 66);
    V.text(ctx, title, 24, 24, { size: 22, weight: 800, serif: true, color: '#ffe9b8' });
    if (sub) V.text(ctx, sub, 24, 50, { size: 13, weight: 500, color: '#e6dcc4' });
    sysButtons();
  }
  function sysButtons() {
    btn({ x: W - 150, y: 14, w: 40, h: 38, label: '？', kind: 'ghost', size: 18, on: () => { App.overlay = { kind: 'help', page: 0, t: 0 }; } });
    btn({ x: W - 104, y: 14, w: 40, h: 38, label: cfg.mute ? '×' : '♪', kind: 'ghost', size: 18, on: toggleMute });
    btn({ x: W - 58, y: 14, w: 40, h: 38, label: '≡', kind: 'ghost', size: 20, on: () => { App.overlay = { kind: 'menu', t: 0 }; } });
  }
  function toggleMute() { cfg.mute = !cfg.mute; A.setMuted(cfg.mute); saveCfg(); if (!cfg.mute) { A.init(); A.play('click'); } }

  // ---------- タイトル ----------
  function drawTitle() {
    V.background(ctx, 'watch', App.t, { lit: 0.55 });
    // 遠くの砦
    V.part(ctx, 'tower', 930, 230, 110, 150, 1, App.t);
    V.part(ctx, 'gate', 1030, 250, 130, 130, 1, App.t);
    V.part(ctx, 'tower', 1150, 230, 110, 150, 1, App.t);
    V.person(ctx, 250, 600, 'mage', App.t, { scale: 2.2, staff: true, staffGlow: '#ffd86a' });
    V.person(ctx, 160, 610, 'knight', App.t, { scale: 2.1 });
    // 詠唱盤の飾り
    const words = [['fire', 'lance', 'x3'], ['bolt', 'burst', 'x2'], ['light', 'storm', 'twice']];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) V.word(ctx, Z.W, Z.wd(words[r][c], r === 0 && c === 0 ? 3 : 1), 420 + c * 76, 340 + r * 76, 72, 72, { small: true });
    ctx.save();
    V.text(ctx, D.TITLE, W / 2, 150, { align: 'center', size: 76, weight: 800, serif: true, color: '#fff3d6', stroke: 'rgba(40,20,60,.85)', sw: 10 });
    V.text(ctx, '― ' + D.SUB + ' ―', W / 2, 222, { align: 'center', size: 26, weight: 700, serif: true, color: '#ffe0a0', stroke: 'rgba(40,20,60,.8)', sw: 6 });
    ctx.restore();
    const sv = load(SAVE);
    let y = 360;
    btn({ x: 720, y: y, w: 260, h: 56, label: 'はじめから', kind: 'main', size: 22, serif: true, on: () => { if (sv && !confirmNew()) return; newGame(); } });
    y += 68;
    btn({ x: 720, y: y, w: 260, h: 50, label: 'つづきから', size: 20, serif: true, disabled: !sv, on: continueGame });
    y += 62;
    if (sv && sv.cleared) { btn({ x: 720, y: y, w: 260, h: 50, label: '大詠唱の腕だめし', size: 18, serif: true, on: startTrial }); y += 62; }
    btn({ x: 720, y: y, w: 125, h: 44, label: 'あそびかた', kind: 'ghost', size: 15, on: () => { App.overlay = { kind: 'help', page: 0, t: 0 }; } });
    btn({ x: 855, y: y, w: 125, h: 44, label: cfg.mute ? '音：なし' : '音：あり', kind: 'ghost', size: 15, on: toggleMute });
    V.text(ctx, 'マウスだけで遊べます（キーボードも可）。音が出ます。', W / 2, 690, { align: 'center', size: 14, color: '#fff6e0', stroke: 'rgba(0,0,0,.5)', sw: 3 });
    if (rec.trialKills) V.text(ctx, `腕だめしの記録：${rec.trialKills}体`, 850, y + 70, { align: 'center', size: 14, color: '#ffe0a0', stroke: 'rgba(0,0,0,.5)', sw: 3 });
  }
  let confirmArmed = 0;
  function confirmNew() {
    if (App.t - confirmArmed < 3) return true;
    confirmArmed = App.t;
    toast('前の記録が消えます。もう一度押すと、はじめから。');
    return false;
  }

  // ---------- 物語 ----------
  function drawStory() {
    const st = App.story;
    st.t += 0;
    V.background(ctx, 'watch', App.t, { lit: 0.4 });
    const l = st.lines[st.i];
    V.person(ctx, 260, 560, 'mage', App.t, { scale: 2.4, staff: true });
    V.person(ctx, 160, 570, 'knight', App.t, { scale: 2.3 });
    if (l.who && ['scholar', 'smith', 'priest', 'clock', 'knights', 'queen'].indexOf(l.who) >= 0) V.person(ctx, 1000, 560, l.who, App.t, { scale: 2.4, flip: true });
    V.panel(ctx, 120, 470, 1040, 200, { dark: true });
    if (l.name) V.text(ctx, l.name, 150, 500, { size: 20, weight: 800, serif: true, color: '#ffd98a' });
    V.para(ctx, l.text, 150, l.name ? 528 : 505, 980, { size: 21, weight: 600, color: '#fbf3e0', serif: true, lh: 34 });
    V.text(ctx, 'クリック／スペースで次へ', 1130, 650, { align: 'right', size: 13, color: '#c8bca4' });
    btn({ x: 0, y: 0, w: W, h: H, invisible: true, on: storyNext });
    btn({ x: W - 130, y: 14, w: 110, h: 38, label: 'とばす', kind: 'ghost', size: 15, on: () => { const f = st.then; App.story = null; f(); } });
  }

  // ---------- 戦い ----------
  function drawBattle() {
    const s = S(), b = s.b;
    const id = stageId();
    V.background(ctx, id, App.t, { lit: b.practice ? 1 : 0.15 + BS.lit * 0.85 });
    ctx.save();
    if (BS.shake > 0) ctx.translate((Math.random() - 0.5) * BS.shake * 18, (Math.random() - 0.5) * BS.shake * 10);
    V.lanes(ctx, F, id, App.t);
    const pred = ensurePred();
    drawParts(pred);
    drawEnemies(pred);
    drawRunners();
    V.barricade(ctx, L.BX, L.Y - 4, L.RH * 3 + 8, App.t, BS.guardHit);
    drawFx();
    ctx.restore();
    drawReelPanel(pred);
    drawPlates(pred);
    drawPops();
    drawHud(pred);
    drawBottom(pred);
    if (BS.banner) drawBanner();
    if (BS.big) drawBig();
    if (BS.flash > 0) { ctx.fillStyle = `rgba(255,248,220,${BS.flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
    if (BS.over) drawOver();
  }

  function drawHud(pred) {
    const s = S(), b = s.b;
    const g = ctx.createLinearGradient(0, 0, 0, 70);
    g.addColorStop(0, 'rgba(20,15,32,.88)'); g.addColorStop(1, 'rgba(20,15,32,.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 68);
    let title = b.practice ? '試し撃ち' : (App.trial ? '大詠唱の腕だめし' : Z.STAGES[b.stage].name);
    V.text(ctx, title, 24, 22, { size: 21, weight: 800, serif: true, color: '#ffe9b8' });
    const sub = b.practice ? 'わら人形と木の的' : (b.army ? `残りの詠唱 ${b.castsLeft} 回` : `第${b.turn}手番`);
    V.text(ctx, sub, 24, 48, { size: 14, weight: 600, color: '#e6dcc4' });
    // 魔力
    const mx = 330;
    V.text(ctx, '魔力', mx, 34, { size: 14, weight: 700, color: '#bfe0ff', align: 'right' });
    const left = b.phase === 'aim' ? Z.manaLeft(s) : b.mana;
    for (let i = 0; i < b.mana; i++) V.orb(ctx, mx + 20 + i * 28, 34, 10, i < left, App.t);
    tip(mx - 40, 16, 60 + b.mana * 28, 36, '魔力', 'リールを一コマずらすたびに1使う。戻せばもどる。毎手番、満タンになる。');
    // 守り
    if (!b.practice && !b.army) {
      const gx = 560;
      V.text(ctx, '陣の守り', gx, 34, { size: 14, weight: 700, color: '#ffd0d0', align: 'right' });
      const loss = pred && pred.guardLoss ? pred.guardLoss : 0;
      for (let i = 0; i < b.guardMax; i++) {
        const on = i < b.guard;
        const warn = on && i >= b.guard - loss;
        V.shieldIcon(ctx, gx + 20 + i * 26, 34, 11, on && !(warn && Math.sin(App.t * 10) > 0));
      }
      tip(gx - 70, 16, 90 + b.guardMax * 26, 36, '陣の守り', '魔物が左の柵に着くと減る（大鬼・黒騎士は3）。弓兵の矢でも減る。0になると退却。点滅しているのは、このまま放ったときに次の手番で減る見こみ。');
    }
    // 金貨
    V.coin(ctx, 830, 34, 11);
    V.text(ctx, String(s.gold + b.gold), 848, 35, { size: 18, weight: 800, color: '#ffe08a' });
    tip(816, 16, 80, 36, '金貨', '魔物を倒したり砦を崩したりすると手に入る。工房の市で言葉を買える。');
    // 一手の記録
    if (!b.practice) V.text(ctx, `一手で倒した最多 ${b.bestKills}`, 920, 35, { size: 13, weight: 600, color: '#d8ccb4' });
    sysButtons();
  }

  // 砦
  function drawParts(pred) {
    const b = S().b;
    for (let l = 0; l < 3; l++) {
      const dp = BS.dm.parts[l];
      if (!dp) continue;
      const x = L.PX, y = rowY(l) + 6, w = L.PW, h = L.RH - 12;
      const kind = partKind(l);
      const rate = dp.dead ? 0 : dp.hp / dp.max;
      V.part(ctx, kind, x, y, w, h, rate, App.t, { shake: dp.shake * 8, theme: stageId() });
      if (dp.frz && !dp.dead) { ctx.fillStyle = 'rgba(170,230,255,.35)'; ctx.fillRect(x + 6, y + 4, w - 12, h - 8); }
      if (!dp.dead && !dp.wood) {
        // 体力
        const bx = x + 10, by = y + h - 16, bw = w - 20;
        ctx.fillStyle = 'rgba(0,0,0,.6)'; V.rr(ctx, bx, by, bw, 12, 5); ctx.fill();
        ctx.fillStyle = '#e8584a'; V.rr(ctx, bx + 1, by + 1, (bw - 2) * rate, 10, 4); ctx.fill();
        const pp = pred && pred.per['p' + l];
        if (pp && pp.dmg > 0 && b.phase === 'aim') {
          const after = Math.max(0, dp.hp - pp.dmg) / dp.max;
          ctx.fillStyle = `rgba(255,240,160,${0.55 + 0.35 * Math.sin(App.t * 8)})`;
          V.rr(ctx, bx + 1 + (bw - 2) * after, by + 1, (bw - 2) * (rate - after), 10, 3); ctx.fill();
          const kill = pp.kill;
          badge(x + w / 2 + 6, y + h / 2 - 4, kill ? '崩れる！' : '−' + pp.dmg, kill ? '#ffe27a' : '#ffd0a0', kill);
        }
        V.text(ctx, `${dp.hp}`, x + w / 2, by + 6, { align: 'center', size: 11, weight: 800, color: '#fff' });
        const bp = b.parts[l];
        if (bp && bp.shot && !bp.dead && !b.practice && !b.army) {
          const will = pred && pred.after && b.phase === 'aim' ? pred.after.some(e => e.k === 'ballista' && e.lane === l) : false;
          const tx = x + 4, ty = y + 2;
          V.rr(ctx, tx, ty, 62, 22, 7);
          ctx.fillStyle = will ? 'rgba(200,30,40,.95)' : 'rgba(30,20,40,.85)'; ctx.fill();
          ctx.strokeStyle = will ? '#ffd0d0' : 'rgba(255,200,160,.6)'; ctx.lineWidth = 1.2; ctx.stroke();
          V.text(ctx, will ? '大矢！' : `大矢 ${bp.cd}`, tx + 31, ty + 11.5, { align: 'center', size: 13, weight: 800, color: will ? '#fff' : '#ffd8b0' });
          tip(tx, ty, 62, 22, '砦の大矢', `${bp.shot[0]}手番ごとに陣を撃ち、守りを${bp.shot[1]}削る。数字は、撃つまでの手番。赤いときは、このまま放つと次の手番に撃ってくる。凍らせると一手番止まり、崩せば撃たなくなる。`);
        }
        // 中の守備兵
        if (!b.practice && !b.army) {
          const g = Z.garrisonLeft(b, l);
          if (g.length) {
            V.text(ctx, `守備兵 ${g.length}`, x + w / 2, y + h - 30, { align: 'center', size: 12, weight: 700, color: '#f0d8ff', stroke: 'rgba(0,0,0,.7)', sw: 3 });
          }
          const nxt = pred && pred.after ? pred.after.find(e => e.k === 'spawn' && e.lane === l) : null;
          if (nxt && b.phase === 'aim') {
            V.text(ctx, `次：${Z.EN[nxt.t].name}`, x - 4, y + 24, { align: 'right', size: 12, weight: 700, color: '#ffcfe0', stroke: 'rgba(0,0,0,.7)', sw: 3 });
          }
        }
        tip(x, y, w, h, dp.n, dp.wood ? '試し撃ちの的。何度でも撃てる。' : `体力 ${dp.hp}/${dp.max}。崩すと、この道の魔物と、中に残った守備兵が逃げ出す。${b.army ? '' : '残りの守備兵：' + Z.garrisonLeft(b, l).map(t => Z.EN[t].name).join('・')}`);
      }
      if (dp.shake > 0) dp.shake = Math.max(0, dp.shake - 1 / 60);
    }
  }
  function badge(x, y, text, col, strong) {
    ctx.font = V.font(strong ? 16 : 14, 800);
    const w = ctx.measureText(text).width + 14;
    V.rr(ctx, x - w / 2, y - 12, w, 24, 8);
    ctx.fillStyle = strong ? 'rgba(80,40,10,.92)' : 'rgba(40,20,20,.85)'; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
    V.text(ctx, text, x, y + 1, { align: 'center', size: strong ? 16 : 14, weight: 800, color: col });
  }

  function drawEnemies(pred) {
    const b = S().b;
    const aim = b.phase === 'aim' && !BS.tl && !BS.spin;
    const threat = {};
    if (aim && pred && pred.after) for (const e of pred.after) if (e.k === 'strike' || e.k === 'shoot') threat[e.id] = e.k;
    const list = Object.values(BS.dm.en).sort((a, c) => a.lane - c.lane || c.col - a.col);
    for (const e of list) {
      ctx.save();
      ctx.globalAlpha = clamp(e.alpha, 0, 1) * (e.dying > 0 ? e.dying : 1);
      const scale = e.t === 'ogre' || e.t === 'knight' ? 0.95 : 1;
      V.enemy(ctx, e.t, e.x + (e.flee > 0 ? 0 : 0), e.y, App.t, { scale: scale, frz: e.frz, flash: e.flash > 0, flip: e.flee > 0 });
      ctx.restore();
      if (e.dying > 0 || e.flee > 0 || e.strike) continue;
      // 体力
      const bw = 40, bx = e.x - bw / 2, by = e.y + 6;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; V.rr(ctx, bx, by, bw, 8, 3); ctx.fill();
      ctx.fillStyle = e.t === 'dummy' ? '#d8b867' : '#ff6a5a'; V.rr(ctx, bx + 1, by + 1, (bw - 2) * (e.hp / e.max), 6, 2); ctx.fill();
      V.text(ctx, String(e.hp), bx + bw + 10, by + 4, { align: 'center', size: 11, weight: 800, color: '#fff', stroke: 'rgba(0,0,0,.7)', sw: 3 });
      const pp = aim && pred ? pred.per[e.id] : null;
      if (pp && (pp.dmg > 0 || pp.block || pp.flee)) {
        if (pp.kill || pp.flee) {
          ctx.strokeStyle = `rgba(255,236,140,${0.7 + 0.3 * Math.sin(App.t * 8)})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(e.x, e.y - 28, 30, 0, Math.PI * 2); ctx.stroke();
          badge(e.x, e.y - 76, pp.flee && !pp.kill ? '逃げる' : '倒す', '#ffe27a', true);
        } else {
          badge(e.x, e.y - 76, pp.block && !pp.dmg ? '盾' : '−' + pp.dmg + (pp.frz ? ' 凍' : ''), pp.frz ? '#bfeaff' : '#ffd0a0', false);
        }
      }
      if (threat[e.id] && !(pp && (pp.kill || pp.frz || pp.flee))) {
        const tx = e.x + 22, ty = e.y - 66;
        ctx.fillStyle = '#e8303a'; ctx.beginPath(); ctx.arc(tx, ty, 11, 0, Math.PI * 2); ctx.fill();
        V.text(ctx, '！', tx, ty + 1, { align: 'center', size: 15, weight: 900, color: '#fff' });
      }
      if (e.rest && aim && Z.EN[e.t].slow && !e.frz) V.text(ctx, '休', e.x - 24, e.y - 60, { align: 'center', size: 12, weight: 800, color: '#e0e0ff', stroke: 'rgba(0,0,0,.7)', sw: 3 });
      if (e.frz) V.text(ctx, '凍', e.x - 24, e.y - 60, { align: 'center', size: 12, weight: 800, color: '#bfeaff', stroke: 'rgba(0,0,0,.7)', sw: 3 });
      const d = Z.EN[e.t];
      tip(e.x - 30, e.y - 70, 60, 80, d.name, `${d.desc} 体力 ${e.hp}/${e.max}。${threat[e.id] ? '次の手番に陣を攻める！' : ''}${e.frz ? '凍っていて、次の手番は動かない。' : ''}`);
    }
  }
  function drawRunners() {
    for (const r of BS.runners) {
      if (r.t < 0) continue;
      V.person(ctx, r.x, r.y, r.kind, App.t, { scale: 0.9, cheer: r.x < L.FX + 40 });
    }
  }

  // 詠唱盤
  function drawReelPanel(pred) {
    const s = S(), b = s.b;
    // 台座
    V.rr(ctx, 12, 70, 450, 528, 16);
    const g = ctx.createLinearGradient(0, 70, 0, 600);
    g.addColorStop(0, 'rgba(48,36,70,.92)'); g.addColorStop(1, 'rgba(26,20,40,.94)');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(217,185,107,.6)'; ctx.lineWidth = 2; ctx.stroke();
    const aim = b.phase === 'aim' && !BS.tl && !BS.spin;
    const hint = BS.hint;
    const want = BS.script && BS.script.want ? BS.script.want : null;
    for (let i = 0; i < 5; i++) {
      const x = reelX(i);
      const role = Z.REEL_ROLES[i];
      if (i >= s.reels.length) {
        V.rr(ctx, x, L.Y, L.RW, L.RH * 3, 10); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
        ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(217,185,107,.35)'; ctx.stroke(); ctx.setLineDash([]);
        V.text(ctx, '封', x + L.RW / 2, L.Y + L.RH * 1.5 - 14, { align: 'center', size: 30, weight: 800, serif: true, color: 'rgba(230,210,170,.35)' });
        V.text(ctx, Z.ROLE[role].name, x + L.RW / 2, L.Y + L.RH * 1.5 + 22, { align: 'center', size: 14, weight: 700, color: 'rgba(230,210,170,.4)' });
        V.text(ctx, Z.ROLE[role].name, x + L.RW / 2, 84, { align: 'center', size: 14, weight: 800, color: 'rgba(230,210,170,.35)' });
        tip(x, L.Y, L.RW, L.RH * 3, 'まだ使えないリール', i === 3 ? '二つ目の砦を落とすと、鍛冶屋がもう一本「力」のリールを据えてくれる。' : '四つ目の砦を落とすと、五本目のリール「響」がつく。');
        continue;
      }
      V.text(ctx, Z.ROLE[role].name + (i === 2 || i === 3 ? (s.reels.length > 3 ? (i - 1) : '') : ''), x + L.RW / 2, 84, { align: 'center', size: 15, weight: 800, serif: true, color: V.ROLE_COL[role] });
      // ▲
      const off = b.offs[i] || 0;
      const hUp = hint && hint.stage === 2 && hint.offs[i] > off, hDn = hint && hint.stage === 2 && hint.offs[i] < off;
      const cw = BS.coachWant && b.casts === BS.coachWant.cast && BS.coachWant.reel === i && off === 0;
      const wUp = (want && want[i] > off) || (cw && BS.coachWant.dir > 0);
      const wDn = (want && want[i] < off) || (cw && BS.coachWant.dir < 0);
      const bu = btn({ x: x + 4, y: 98, w: L.RW - 8, h: 28, label: '▲', size: 15, kind: 'ghost', disabled: !aim, glow: aim && (hUp || wUp), on: () => shiftReel(i, 1), key: 'up' + i,
        draw: (c, bx, by, bw, bh, fg) => { V.text(c, off > 0 ? '▲' + off : '▲', bx + bw / 2, by + bh / 2 + 1, { align: 'center', size: 15, weight: 800, color: off > 0 ? '#ffe27a' : fg }); } });
      const bd = btn({ x: x + 4, y: 562, w: L.RW - 8, h: 28, label: '▼', size: 15, kind: 'ghost', disabled: !aim, glow: aim && (hDn || wDn), on: () => shiftReel(i, -1), key: 'dn' + i,
        draw: (c, bx, by, bw, bh, fg) => { V.text(c, off < 0 ? '▼' + (-off) : '▼', bx + bw / 2, by + bh / 2 + 1, { align: 'center', size: 15, weight: 800, color: off < 0 ? '#ffe27a' : fg }); } });
      drawReel(i, x, aim && bu.hot, aim && bd.hot);
      if (aim) {
        // 小札を押しても、その言葉を窓へ入れる向きにずれる
        btn({ x: x + 10, y: 128, w: L.RW - 20, h: 22, invisible: true, on: () => shiftReel(i, -1), key: 'pk_dn' + i });
        btn({ x: x + 10, y: 536, w: L.RW - 20, h: 22, invisible: true, on: () => shiftReel(i, 1), key: 'pk_up' + i });
      }
      if (hint && hint.stage === 1 && hint.offs[i] !== off) {
        V.rr(ctx, x - 2, L.Y - 2, L.RW + 4, L.RH * 3 + 4, 12);
        ctx.strokeStyle = `rgba(255,230,140,${0.55 + 0.4 * Math.sin(App.t * 6)})`; ctx.lineWidth = 3; ctx.stroke();
      }
      tip(x, L.Y, L.RW, L.RH * 3, `${Z.ROLE[role].name}のリール（${Z.ROLE[role].sub}）`, reelTipText(i));
    }
    // 行の区切り
    for (let r = 1; r < 3; r++) { ctx.fillStyle = 'rgba(217,185,107,.25)'; ctx.fillRect(18, rowY(r) - 1, 446, 2); }
  }
  function reelTipText(i) {
    const s = S(), b = s.b;
    const rows = [0, 1, 2].map(r => Z.W[Z.wordAt(s, i, r).k].name).join('・');
    const strip = s.reels[i].strip.map(w => Z.W[w.k].blank ? (w.k === 'gap' ? '空' : '・') : Z.W[w.k].glyph).join(' ');
    return `いまの3行：${rows}。リール全体の並び：${strip}（下へ順に続き、最後の次は最初にもどる）。▲▼・ホイール・上下ドラッグでずらす。`;
  }
  function drawReel(i, x, hotUp, hotDn) {
    const s = S(), r = s.reels[i], n = r.strip.length;
    const v = BS.vis[i];
    const base = Math.floor(v), frac = v - base;
    ctx.save();
    V.rr(ctx, x, L.Y, L.RW, L.RH * 3, 10);
    ctx.fillStyle = 'rgba(10,6,18,.55)'; ctx.fill();
    ctx.clip();
    const spinning = BS.spin && !BS.spin.done[i];
    for (let k = -1; k <= 3; k++) {
      const idx = base + k;
      const y = L.Y + (k - frac) * L.RH;
      if (y > L.Y + L.RH * 3 || y + L.RH < L.Y) continue;
      const w = r.strip[mod(idx, n)];
      V.word(ctx, Z.W, w, x + 2, y + 4, L.RW - 4, L.RH - 8, { alpha: spinning ? 0.75 : 1 });
    }
    if (spinning) { ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x, L.Y, L.RW, L.RH * 3); }
    ctx.restore();
    // はみ出した次の言葉（小さな札）
    if (!BS.spin) {
      const p = Math.round(v);
      const up = r.strip[mod(p - 1, n)], dn = r.strip[mod(p + 3, n)];
      peekTag(x, 128, up, '▼', hotDn);
      peekTag(x, 536, dn, '▲', hotUp);
    }
  }
  // 窓の外の言葉。mark は、その言葉を窓へ入れるボタン
  function peekTag(x, y, w, mark, hot) {
    const d = Z.W[w.k];
    V.rr(ctx, x + 6, y, L.RW - 12, 22, 6);
    ctx.fillStyle = hot ? 'rgba(120,90,20,.85)' : 'rgba(0,0,0,.45)'; ctx.fill();
    ctx.strokeStyle = hot ? '#ffe27a' : 'rgba(230,210,170,.3)'; ctx.lineWidth = hot ? 2 : 1; ctx.stroke();
    const col = d.role === 'src' ? V.SRC_COL[w.k] : V.ROLE_COL[d.role];
    V.text(ctx, mark, x + 16, y + 12, { align: 'center', size: 10, weight: 800, color: hot ? '#ffe27a' : 'rgba(230,210,170,.6)' });
    V.text(ctx, d.blank ? (w.k === 'gap' ? '空き' : '・') : d.glyph, x + L.RW / 2 + 6, y + 12, { align: 'center', size: 13, weight: 800, color: d.blank ? 'rgba(230,210,170,.5)' : col });
    if (hot) {
      // 入ってくる向きの矢印
      const ay = mark === '▼' ? y + 30 : y - 8;
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      if (mark === '▼') { ctx.moveTo(x + L.RW / 2 - 7, ay - 5); ctx.lineTo(x + L.RW / 2 + 7, ay - 5); ctx.lineTo(x + L.RW / 2, ay + 4); }
      else { ctx.moveTo(x + L.RW / 2 - 7, ay + 5); ctx.lineTo(x + L.RW / 2 + 7, ay + 5); ctx.lineTo(x + L.RW / 2, ay - 4); }
      ctx.fill();
    }
  }

  // 行ごとの呪文の札
  function drawPlates(pred) {
    const s = S(), b = s.b;
    const show = b.phase === 'aim' || BS.tl;
    for (let r = 0; r < 3; r++) {
      const x = L.SX, y = rowY(r) + 10, w = L.SW, h = L.RH - 20;
      const sp = Z.rowSpell(s, r);
      const fl = BS.plate[r];
      ctx.save();
      V.rr(ctx, x, y, w, h, 10);
      ctx.fillStyle = sp.dead || !show ? 'rgba(20,14,30,.7)' : 'rgba(40,26,60,.9)'; ctx.fill();
      ctx.lineWidth = fl > 0 ? 3 : 1.5;
      ctx.strokeStyle = fl > 0 ? '#fff2b0' : (sp.dead || !show ? 'rgba(200,180,150,.3)' : V.SRC_COL[sp.src]);
      ctx.stroke();
      if (show && !BS.spin) {
        if (sp.dead) {
          V.text(ctx, '空き', x + w / 2, y + h / 2 - 8, { align: 'center', size: 16, weight: 700, color: 'rgba(230,210,170,.5)' });
          V.text(ctx, '呪文にならない', x + w / 2, y + h / 2 + 14, { align: 'center', size: 11, weight: 500, color: 'rgba(230,210,170,.45)' });
        } else {
          V.text(ctx, Z.W[sp.shape].name, x + w / 2, y + 18, { align: 'center', size: 14, weight: 800, color: '#dfe4ff' });
          const pw = sp.shape === 'point' ? sp.power * 2 : sp.shape === 'storm' ? Math.max(1, Math.floor(sp.power / 2)) : sp.power;
          V.text(ctx, String(pw), x + w / 2, y + h / 2 + 4, { align: 'center', size: pw >= 100 ? 30 : 36, weight: 900, color: V.SRC_COL[sp.src], stroke: 'rgba(0,0,0,.6)', sw: 4 });
          const tags = [];
          if (sp.casts > 1) tags.push(`${sp.casts}回`);
          if (sp.lanes.length > 1) tags.push(sp.lanes.length === 3 ? '三道' : (sp.lanes[1] < r ? '上へも' : '下へも'));
          if (Z.W[sp.src].freeze) tags.push('凍らす');
          if (Z.W[sp.src].noShield) tags.push('盾無視');
          if (Z.W[sp.src].siege) tags.push('砦2倍');
          V.text(ctx, tags.join('・'), x + w / 2, y + h - 14, { align: 'center', size: 11, weight: 700, color: '#ffe8b0' });
          // 道への矢印
          ctx.fillStyle = V.SRC_COL[sp.src];
          ctx.beginPath(); ctx.moveTo(x + w + 2, y + h / 2 - 8); ctx.lineTo(x + w + 12, y + h / 2); ctx.lineTo(x + w + 2, y + h / 2 + 8); ctx.fill();
        }
        tip(x, y, w, h, `${r + 1}行目の呪文`, spellText(sp));
      }
      ctx.restore();
      if (fl > 0) BS.plate[r] = Math.max(0, fl - 1 / 30);
    }
  }
  function spellText(sp) {
    if (sp.dead) return '「形」が空きなので、この行は呪文にならない。形のリールをずらして、空きでない言葉を入れよう。';
    const parts = [`源：${Z.W[sp.src].name}（力${sp.base}）`];
    for (const p of sp.pows) if (!Z.W[p.k].blank) parts.push(Z.W[p.k].name);
    let t = `${parts.join(' × ')} → 力 ${sp.power}。形「${Z.W[sp.shape].name}」：${Z.W[sp.shape].desc}`;
    if (sp.casts > 1) t += ` これを${sp.casts}回放つ。`;
    if (sp.lanes.length > 1) t += ` 響きで、ほかの道（${sp.lanes.slice(1).map(l => l + 1 + '本目').join('・')}）でも放つ。`;
    return t;
  }

  // 下の帯
  function drawBottom(pred) {
    const s = S(), b = s.b;
    V.person(ctx, 56, 700, 'mage', App.t, { scale: 1.7, staff: true, staffGlow: BS.tl ? '#ffe27a' : '#9fd8ff' });
    V.panel(ctx, 100, 606, 800, 104, { dark: true });
    let msg = BS.msg;
    if (!msg && b.phase === 'aim' && pred) msg = predSummary(pred);
    if (!msg && b.phase === 'spin' && !BS.tl) msg = '「回す」で詠唱盤を回す。';
    if (!msg && BS.tl) msg = BS.rush ? '早送り中…' : '詠唱中…（スペース・「早送り」で速くできる）';
    V.para(ctx, msg || '', 122, 620, 760, { size: 16, weight: 600, color: '#fbf3e0', lh: 25 });
    // ボタン
    const busy = !!BS.over;
    let main = { label: '回す', on: () => doSpin(), sub: 'スペース' };
    if (BS.tl) main = { label: BS.rush ? '早送り中' : '早送り', on: () => { BS.rush = true; }, sub: 'スペース' };
    else if (BS.spin) main = { label: '止める', on: stopSpinNow, sub: 'スペース' };
    else if (b.phase === 'aim') main = { label: '放つ', on: doCast, sub: 'スペース' };
    btn({ x: 1064, y: 610, w: 196, h: 96, label: main.label, sub: main.sub, kind: 'main', size: 30, serif: true, disabled: busy, on: main.on, key: 'main', glow: b.phase === 'aim' && BS.script && !BS.script.want });
    if (b.practice) {
      const canSpin = !busy && b.phase !== 'aim' && !BS.spin;
      btn({ x: 914, y: 610, w: 140, h: 44, label: '同じ回転で', size: 15, disabled: !canSpin || !BS.cmp || !BS.cmp.last, on: () => doSpin(BS.cmp.last.spin), key: 'same' });
      btn({ x: 914, y: 662, w: 140, h: 44, label: '新しい言葉で', size: 14, disabled: !canSpin || !newWordSpin(), on: () => doSpin(newWordSpin()), key: 'newspin' });
      btn({ x: 1064, y: 560, w: 196, h: 40, label: '工房へもどる', size: 15, kind: 'light', disabled: !!BS.tl || !!BS.spin, on: () => { S().b = null; openCamp(); }, key: 'back' });
    } else {
      btn({ x: 914, y: 610, w: 140, h: 44, label: 'ヒント', sub: '', size: 16, disabled: busy || b.phase !== 'aim', on: showHint, key: 'hint' });
      btn({ x: 914, y: 662, w: 140, h: 44, label: 'ずらしを戻す', size: 14, kind: 'ghost', disabled: busy || b.phase !== 'aim' || !b.offs.some(o => o), on: resetShift, key: 'reset' });
    }
  }
  function predSummary(p) {
    const bits = [];
    const k = p.kills + p.fled;
    bits.push(k ? `倒す ${k}体` : '倒せる魔物なし');
    if (p.partDmg) bits.push(`砦に ${p.partDmg}`);
    if (p.downs) bits.push(`${p.downs}か所崩れる`);
    if (p.win) bits.push('砦が落ちる！');
    else if (!S().b.practice && !S().b.army) bits.push(p.guardLoss ? `このあと陣の守り −${p.guardLoss}` : '陣への被害なし');
    return `見こみ：${bits.join('・')}　（▲▼でずらすと変わる）`;
  }

  function drawBanner() {
    const bn = BS.banner;
    const a = Math.min(1, bn.t * 3, (2.0 - bn.t) * 2.5);
    if (a <= 0) { BS.banner = null; return; }
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(20,12,34,.78)'; ctx.fillRect(0, 250, W, 150);
    V.text(ctx, bn.title, W / 2, 305, { align: 'center', size: 48, weight: 800, serif: true, color: '#fff0cc', stroke: 'rgba(0,0,0,.6)', sw: 6 });
    V.text(ctx, bn.sub, W / 2, 360, { align: 'center', size: 20, weight: 600, color: '#ffe0a0' });
    ctx.restore();
  }
  function drawBig() {
    const g = BS.big;
    const a = Math.min(1, g.t * 5, (1.9 - g.t) * 2.5);
    if (a <= 0) { BS.big = null; return; }
    const sc = 1 + Math.max(0, 0.25 - g.t) * 1.6;
    ctx.save(); ctx.globalAlpha = a;
    ctx.translate(870, 120); ctx.scale(sc, sc);
    V.text(ctx, g.text, 0, 0, { align: 'center', size: 40, weight: 900, serif: true, color: g.col, stroke: 'rgba(40,10,40,.85)', sw: 8 });
    if (g.sub) V.text(ctx, g.sub, 0, 40, { align: 'center', size: 20, weight: 700, color: '#fff', stroke: 'rgba(40,10,40,.8)', sw: 5 });
    ctx.restore();
  }

  function drawOver() {
    const o = BS.over;
    const a = Math.min(1, o.t * 3);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10,6,20,.55)'; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    if (o.t < 0.9) return;
    App.drawLayer = 0;
    const x = 340, y = 150, w = 600, h = 380;
    V.panel(ctx, x, y, w, h);
    if (o.kind === 'win') {
      const b = S().b;
      V.text(ctx, `${Z.STAGES[b.stage].name}を落とした！`, W / 2, y + 50, { align: 'center', size: 30, weight: 800, serif: true, color: '#5a2a0a' });
      const lines = [`手番 ${o.turns}`, `倒した・逃げた魔物 ${o.kills}体`, `一手で倒した最多 ${o.best}体`, `一手のダメージ最大 ${o.bestDmg}`, `金貨 +${o.gold}（お礼 +${(Z.REWARD[b.stage] || {}).gold || 0}）`];
      lines.forEach((l, i) => V.text(ctx, l, W / 2, y + 110 + i * 36, { align: 'center', size: 20, weight: 700, color: '#3b2a14' }));
      const prevBest = S().best[b.stage - 1];
      if (prevBest && o.best > prevBest.kills) V.text(ctx, `前の砦の最多（${prevBest.kills}体）を超えた！`, W / 2, y + 296, { align: 'center', size: 16, weight: 700, color: '#a0401a' });
      btn({ x: W / 2 - 120, y: y + h - 70, w: 240, h: 52, label: '町へ', kind: 'main', size: 22, serif: true, on: leaveBattle, key: 'next' });
    } else if (o.kind === 'lose') {
      V.text(ctx, '陣の守りが尽きた……', W / 2, y + 50, { align: 'center', size: 30, weight: 800, serif: true, color: '#5a1a1a' });
      V.para(ctx, 'いったん退却する。町の人々から差し入れ（金貨+2）が届いた。\n砦に与えた傷は残る（守備兵は入れかわる）。次の挑戦では援軍が来て、陣の守りが増える。工房でリールを組み直すか、そのまま挑み直そう。\nヒント：赤い「大矢！」「！」は、次の手番に陣を撃つ相手。先に崩す・凍らせるのも手。', x + 40, y + 100, w - 80, { size: 17, weight: 600, color: '#3b2a14', lh: 30 });
      btn({ x: x + 50, y: y + h - 76, w: 230, h: 54, label: 'もう一度挑む', kind: 'main', size: 20, serif: true, on: () => { const idx = S().b.stage; Z.finishBattle(S()); saveGame('camp'); startBattle(idx); }, key: 'retry' });
      btn({ x: x + w - 280, y: y + h - 76, w: 230, h: 54, label: '工房で組み直す', size: 20, serif: true, on: leaveBattle, key: 'camp' });
    } else if (o.kind === 'army' || o.kind === 'trial') {
      V.text(ctx, o.lord ? '魔王を討った！' : (o.kind === 'army' ? '魔王の軍勢は退いていった' : '腕だめしの結果'), W / 2, y + 50, { align: 'center', size: 30, weight: 800, serif: true, color: '#5a2a0a' });
      const lines = [`${o.used}度の詠唱で倒した・退けた魔物 ${o.kills}体`, `一手で倒した最多 ${o.bestKills}体`, `一手のダメージ最大 ${o.bestDmg}`];
      if (o.lord) lines.push(o.used < 3 ? `魔王まで届いた！（${o.used}度目の詠唱で）` : '三度目の詠唱で、魔王まで届いた！');
      else lines.push('魔王にはあと一歩届かなかった。それでも軍勢は逃げていく。');
      if (o.kind === 'trial') lines.push(`これまでの記録 ${rec.trialKills}体`);
      lines.forEach((l, i) => V.text(ctx, l, W / 2, y + 120 + i * 40, { align: 'center', size: 21, weight: 700, color: '#3b2a14' }));
      if (o.kind === 'army') btn({ x: W / 2 - 120, y: y + h - 70, w: 240, h: 52, label: '結末へ', kind: 'main', size: 22, serif: true, on: () => { const b = S().b; const rr = S().best; rr[Z.FINAL] = { kills: b.bestKills, dmg: b.bestDmg, total: b.kills, lord: !!b.lordDown }; Z.finishBattle(S()); rec.cleared = true; if (b.kills > rec.trialKills) rec.trialKills = b.kills; saveRec(); saveGame('camp'); startStory(D.ENDING, () => { App.scene = 'ending'; App.end = { t: 0 }; A.music('ending'); }); }, key: 'next' });
      else {
        btn({ x: x + 50, y: y + h - 76, w: 230, h: 54, label: 'もう一度', kind: 'main', size: 20, on: startTrial, key: 'retry' });
        btn({ x: x + w - 280, y: y + h - 76, w: 230, h: 54, label: 'タイトルへ', size: 20, on: () => { App.trial = false; App.scene = 'title'; A.music('title'); }, key: 'title' });
      }
    }
  }

  // ---------- 演出の描画 ----------
  function drawFx() {
    for (const f of BS.fx) {
      const k = f.t / f.d;
      ctx.save();
      switch (f.k) {
        case 'orb': {
          const e = Math.min(1, k);
          const x = f.sx + (f.tx - f.sx) * e, y = f.sy + (f.ty - f.sy) * e - Math.sin(e * Math.PI) * 30;
          glow(x, y, 16, f.col);
          break;
        }
        case 'lance': {
          const e = Math.min(1, k * 1.25);
          const hx = f.sx + (f.ex - f.sx) * e;
          const a = k > 0.8 ? (1 - k) * 5 : 1;
          ctx.globalAlpha = clamp(a, 0, 1);
          const wdt = 10 + Math.min(16, f.power / 6);
          const g = ctx.createLinearGradient(f.sx, 0, hx, 0);
          g.addColorStop(0, 'rgba(255,255,255,.2)'); g.addColorStop(1, f.col);
          ctx.fillStyle = g;
          ctx.shadowColor = f.col; ctx.shadowBlur = 18;
          V.rr(ctx, f.sx, f.sy - wdt / 2, Math.max(4, hx - f.sx), wdt, wdt / 2); ctx.fill();
          ctx.fillStyle = '#fff'; V.rr(ctx, f.sx, f.sy - 2, Math.max(4, hx - f.sx), 4, 2); ctx.fill();
          glow(hx, f.sy, wdt + 6, f.col);
          break;
        }
        case 'sweep': {
          const x = L.BX + (k * 1.2) * 620;
          ctx.globalAlpha = clamp(1 - k, 0, 1);
          ctx.strokeStyle = f.col; ctx.lineWidth = 14; ctx.shadowColor = f.col; ctx.shadowBlur = 20;
          ctx.beginPath(); ctx.arc(x - 160, L.Y + L.RH * 1.5, 220, -0.9, 0.9); ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(x - 160, L.Y + L.RH * 1.5, 220, -0.8, 0.8); ctx.stroke();
          break;
        }
        case 'ring': {
          ctx.globalAlpha = clamp(1 - k, 0, 1);
          ctx.strokeStyle = f.col; ctx.lineWidth = 10 * (1 - k) + 2; ctx.shadowColor = f.col; ctx.shadowBlur = 24;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r * Math.min(1, k * 1.6), 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = f.col; ctx.globalAlpha = clamp((1 - k) * 0.35, 0, 1);
          ctx.fillRect(f.x - L.CW * 1.5, f.y - L.RH * 1.5 + 30, L.CW * 3, L.RH * 3);
          break;
        }
        case 'storm': {
          ctx.globalAlpha = clamp(Math.min(k * 4, (1 - k) * 3), 0, 0.55);
          ctx.fillStyle = f.col; ctx.fillRect(L.FX, L.Y, L.CW * 7 + L.PW, L.RH * 3);
          ctx.globalAlpha = clamp((1 - k) * 2, 0, 1);
          ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3;
          for (let i = 0; i < 6; i++) { const cx = L.FX + 80 + i * 100, cy = L.Y + 60 + (i % 3) * 120; ctx.beginPath(); ctx.arc(cx, cy, 30 + k * 40, App.t * 4 + i, App.t * 4 + i + 4); ctx.stroke(); }
          break;
        }
        case 'zap': {
          ctx.globalAlpha = clamp(1 - k, 0, 1);
          ctx.strokeStyle = f.col; ctx.lineWidth = 4; ctx.shadowColor = f.col; ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.moveTo(f.x + 10, f.y - 120); ctx.lineTo(f.x - 8, f.y - 60); ctx.lineTo(f.x + 6, f.y - 50); ctx.lineTo(f.x - 4, f.y); ctx.stroke();
          break;
        }
        case 'burst': {
          ctx.globalAlpha = clamp(1 - k, 0, 1);
          glow(f.x, f.y, f.r * (0.6 + k), f.col);
          break;
        }
        case 'spark': {
          ctx.globalAlpha = clamp(1 - k, 0, 1);
          ctx.fillStyle = f.col;
          const x = f.x + f.vx * f.t, y = f.y + f.vy * f.t + 300 * f.t * f.t;
          ctx.fillRect(x - 2, y - 2, 4, 4);
          break;
        }
        case 'coin': {
          const e = Math.min(1, k);
          const x = f.x + (848 - f.x) * e * e, y = f.y + (34 - f.y) * e - Math.sin(e * Math.PI) * 60;
          V.coin(ctx, x, y, 7);
          if (k >= 1 && !f.done) { f.done = true; A.play('coin'); }
          break;
        }
        case 'rock': {
          ctx.globalAlpha = clamp(1 - k, 0, 1);
          const x = f.x + f.vx * f.t, y = f.y + f.vy * f.t + 500 * f.t * f.t;
          ctx.fillStyle = '#4a4552'; ctx.fillRect(x - 5, Math.min(y, footY(2) + 30) - 5, 10, 9);
          break;
        }
        case 'dust': {
          ctx.globalAlpha = clamp((1 - k) * 0.7, 0, 1);
          ctx.fillStyle = '#c9b9a0';
          for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(f.x - 50 + i * 20, f.y - k * 40 - (i % 2) * 10, 20 + k * 30, 0, Math.PI * 2); ctx.fill(); }
          break;
        }
        case 'bigarrow': {
          const x = f.sx + (f.ex - f.sx) * Math.min(1, k);
          const y = f.sy - Math.sin(Math.min(1, k) * Math.PI) * 60;
          ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 46, y - 6); ctx.stroke();
          ctx.fillStyle = '#c8c0b0'; ctx.beginPath(); ctx.moveTo(x - 10, y + 1); ctx.lineTo(x + 4, y - 6); ctx.lineTo(x + 4, y + 6); ctx.fill();
          break;
        }
        case 'arrow': {
          const x = f.sx + (f.ex - f.sx) * Math.min(1, k);
          ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, f.sy); ctx.lineTo(x + 18, f.sy - 2); ctx.stroke();
          break;
        }
      }
      ctx.restore();
    }
  }
  function glow(x, y, r, col) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, r * 1.8);
    g.addColorStop(0, '#fff'); g.addColorStop(0.3, col); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, Math.PI * 2); ctx.fill();
  }
  function drawPops() {
    for (const p of BS.pops) {
      const k = p.t / 1.1;
      ctx.save(); ctx.globalAlpha = clamp(1.4 - k * 1.4, 0, 1);
      V.text(ctx, p.text, p.x, p.y - k * 36, { align: 'center', size: p.big ? 26 : 20, weight: 900, color: p.col, stroke: 'rgba(30,10,20,.85)', sw: 5 });
      ctx.restore();
    }
  }

  // ---------- 地図 ----------
  function drawMap() {
    const m = App.map, s = S();
    m.t += 0;
    // 羊皮紙
    ctx.fillStyle = '#2a2236'; ctx.fillRect(0, 0, W, H);
    V.panel(ctx, 30, 76, 1220, 520, { r: 18 });
    // 海と山
    ctx.fillStyle = 'rgba(80,130,170,.25)';
    ctx.beginPath(); ctx.moveTo(40, 86); ctx.quadraticCurveTo(240, 140, 220, 300); ctx.quadraticCurveTo(160, 360, 40, 330); ctx.fill();
    ctx.fillStyle = 'rgba(120,100,70,.35)';
    for (let i = 0; i < 12; i++) { const x = 380 + i * 70, y = 180 + (i % 3) * 30; ctx.beginPath(); ctx.moveTo(x, y + 30); ctx.lineTo(x + 26, y - 10); ctx.lineTo(x + 52, y + 30); ctx.fill(); }
    ctx.strokeStyle = 'rgba(70,120,170,.5)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(250, 590); ctx.quadraticCurveTo(300, 440, 420, 420); ctx.quadraticCurveTo(560, 400, 600, 300); ctx.stroke();
    // 街道
    ctx.strokeStyle = 'rgba(120,80,40,.75)'; ctx.lineWidth = 6; ctx.setLineDash([12, 8]);
    ctx.beginPath(); D.MAP.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.setLineDash([]);
    const freedNow = m.freed;
    D.MAP.forEach((p, i) => {
      const done = i < s.stage;
      const justFreed = i === freedNow;
      const k = justFreed ? clamp((m.t - 0.6) / 1.2, 0, 1) : (done ? 1 : 0);
      // 魔の雲
      if (k < 1) {
        const g = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 110);
        g.addColorStop(0, `rgba(60,20,80,${0.75 * (1 - k)})`); g.addColorStop(1, 'rgba(60,20,80,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 110, 0, Math.PI * 2); ctx.fill();
      }
      if (k > 0) {
        const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 90 * k);
        g.addColorStop(0, `rgba(255,236,160,${0.65 * k})`); g.addColorStop(1, 'rgba(255,236,160,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 90, 0, Math.PI * 2); ctx.fill();
        // 町の家
        for (let j = 0; j < 4; j++) {
          const hx = p.x - 40 + j * 22, hy = p.y + 26 + (j % 2) * 6;
          ctx.fillStyle = '#b08458'; ctx.fillRect(hx, hy, 16, 12);
          ctx.fillStyle = '#8a3a2a'; ctx.beginPath(); ctx.moveTo(hx - 2, hy); ctx.lineTo(hx + 8, hy - 8); ctx.lineTo(hx + 18, hy); ctx.fill();
          ctx.fillStyle = `rgba(255,220,120,${k})`; ctx.fillRect(hx + 6, hy + 4, 4, 4);
        }
        V.part(ctx, 'tower', p.x - 30, p.y - 60, 60, 70, 0, App.t, { flag: true });
        for (let j = 0; j < 3; j++) V.person(ctx, p.x + 30 + j * 12, p.y + 48, ['villager', 'child', 'old'][j], App.t, { scale: 0.7, cheer: justFreed });
      } else {
        V.part(ctx, i === 5 ? 'lord' : 'tower', p.x - 30, p.y - 60, 60, 74, 1, App.t);
      }
      V.text(ctx, i < Z.STAGES.length - 1 ? Z.STAGES[i].name : '', p.x, p.y + 76, { align: 'center', size: 14, weight: 800, color: done ? '#3b4a1a' : '#4a2a3a', serif: true });
      V.text(ctx, p.town, p.x, p.y + 94, { align: 'center', size: 12, weight: 600, color: '#5a4a3a' });
      if (i === s.stage && !justFreed) {
        ctx.strokeStyle = `rgba(255,120,60,${0.6 + 0.4 * Math.sin(App.t * 5)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y - 20, 54, 0, Math.PI * 2); ctx.stroke();
        V.text(ctx, '次の砦', p.x, p.y - 86, { align: 'center', size: 15, weight: 800, color: '#a03a1a' });
      }
    });
    topBar('王の街道', `取りもどした町 ${Math.min(s.stage, 6)} / 6`);
    if (m.talk && m.t > 1.2) {
      V.panel(ctx, 120, 604, 1040, 108, { dark: true });
      V.person(ctx, 180, 700, m.talk.who, App.t, { scale: 1.6 });
      V.text(ctx, `${m.talk.name}（${m.talk.town}）`, 230, 626, { size: 17, weight: 800, color: '#ffd98a', serif: true });
      V.para(ctx, m.talk.text, 230, 642, 720, { size: 15, weight: 600, color: '#fbf3e0', lh: 22 });
      btn({ x: 980, y: 624, w: 160, h: 66, label: '工房へ', kind: 'main', size: 22, serif: true, on: openCamp, key: 'next' });
    } else if (!m.talk) {
      btn({ x: 980, y: 620, w: 200, h: 70, label: s.stage === Z.FINAL ? '決戦へ' : '出陣', kind: 'main', size: 26, serif: true, on: () => { if (S().stage === Z.FINAL) startStory(D.BEFORE_FINAL, () => startBattle(Z.FINAL)); else startBattle(S().stage); }, key: 'next' });
      btn({ x: 760, y: 630, w: 200, h: 54, label: '工房へもどる', size: 18, on: openCamp, key: 'back' });
    }
  }

  // ---------- 工房 ----------
  const C = { RX: 30, RW: 86, RG: 10, Y: 118, SH: 58 };
  const cReelX = i => C.RX + i * (C.RW + C.RG);
  function drawCamp() {
    const s = S();
    V.background(ctx, 'camp', App.t, { lit: 1 });
    // 町の人々
    const ppl = ['scholar', 'smith', 'priest', 'clock', 'knights', 'queen'];
    s.people.forEach((p, i) => V.person(ctx, 560 + i * 70, 706, p, App.t, { scale: 1.3 }));
    V.person(ctx, 1150, 706, 'knight', App.t, { scale: 1.4, flip: true });
    V.person(ctx, 1210, 706, 'mage', App.t, { scale: 1.45, flip: true, staff: true });
    topBar(`工房 ― ${s.stage <= Z.FINAL ? '次は「' + Z.STAGES[s.stage].name + '」' : ''}`, '持ち物の言葉を押してから、同じ役割のリールのマスを押すと刻める。マスを押すと持ち上げて入れ替え、右クリックで外す。');
    V.coin(ctx, 860, 34, 12);
    V.text(ctx, String(s.gold), 880, 35, { size: 22, weight: 800, color: '#ffe08a' });
    // リール
    V.panel(ctx, 14, 76, 488, 534, { dark: true });
    const held = App.held;
    for (let i = 0; i < 5; i++) {
      const x = cReelX(i), role = Z.REEL_ROLES[i];
      V.text(ctx, Z.ROLE[role].name, x + C.RW / 2, 98, { align: 'center', size: 16, weight: 800, serif: true, color: V.ROLE_COL[role] });
      if (i >= s.reels.length) {
        V.rr(ctx, x, C.Y, C.RW, C.SH * 8, 10); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fill();
        V.text(ctx, '封', x + C.RW / 2, C.Y + C.SH * 4, { align: 'center', size: 30, weight: 800, serif: true, color: 'rgba(230,210,170,.3)' });
        continue;
      }
      const r = s.reels[i];
      for (let j = 0; j < 8; j++) {
        const y = C.Y + j * C.SH;
        const w = r.strip[j];
        let ok = false;
        if (held && held.from === 'inv') ok = Z.canPlace(s, s.inv[held.idx], i);
        if (held && held.from === 'reel') ok = held.ri === i;
        const isHeld = held && held.from === 'reel' && held.ri === i && held.slot === j;
        const upc = App.campMode === 'up' ? Z.upCost(s, w) : null;
        const b = btn({ x: x, y: y, w: C.RW, h: C.SH, invisible: true, on: () => clickSlot(i, j), onRight: () => { if (Z.unplace(s, i, j)) { A.play('click'); saveGame('camp'); } }, key: `slot${i}_${j}` });
        V.word(ctx, Z.W, w, x, y, C.RW, C.SH, { small: true, hot: b.hot || isHeld, alpha: isHeld ? 0.4 : 1 });
        if (ok && !isHeld) { V.rr(ctx, x + 2, y + 2, C.RW - 4, C.SH - 4, 9); ctx.strokeStyle = `rgba(255,230,140,${0.5 + 0.4 * Math.sin(App.t * 6)})`; ctx.lineWidth = 2.5; ctx.stroke(); }
        if (App.campMode === 'up' && upc !== null) {
          badge(x + C.RW / 2, y + C.SH - 8, `鍛 ${upc}`, s.gold >= upc ? '#ffe08a' : '#a09080', false);
        }
        tip(x, y, C.RW, C.SH, `${Z.W[w.k].name}${Z.W[w.k].role === 'src' ? ' Lv' + w.lv + '（力' + Z.W[w.k].base[w.lv - 1] + '）' : ''}`, Z.W[w.k].desc + (w.nw ? '（新しく刻んだ言葉）' : ''));
      }
    }
    // 右側：持ち物
    const px = 520;
    V.panel(ctx, px, 76, 740, 226, { dark: true });
    V.text(ctx, '持ち物', px + 20, 98, { size: 17, weight: 800, serif: true, color: '#ffe2a0' });
    if (!s.inv.length) V.text(ctx, '（お礼や市でもらった言葉がここに入る）', px + 100, 99, { size: 13, color: '#bfb39a' });
    s.inv.forEach((w, k) => {
      const x = px + 20 + (k % 10) * 71, y = 116 + Math.floor(k / 10) * 66;
      if (y > 260) return;
      const isHeld = held && held.from === 'inv' && held.idx === k;
      const b = btn({ x: x, y: y, w: 66, h: 60, invisible: true, on: () => { App.held = isHeld ? null : { from: 'inv', idx: k }; A.play('click'); }, key: `inv${k}` });
      V.word(ctx, Z.W, w, x, y, 66, 60, { small: true, hot: b.hot || isHeld });
      tip(x, y, 66, 60, Z.W[w.k].name + `（${Z.ROLE[Z.W[w.k].role].name}）`, Z.W[w.k].desc + ' 押してから、光るマスを押すと刻める。');
    });
    // 市
    V.panel(ctx, px, 310, 740, 214, { dark: true });
    V.text(ctx, '市（一つずつ）', px + 20, 332, { size: 17, weight: 800, serif: true, color: '#ffe2a0' });
    const items = Z.shopList(s);
    if (!items.length) V.text(ctx, '（砦を落とすと、救った人が店をひらく）', px + 150, 333, { size: 13, color: '#bfb39a' });
    items.forEach((it, k) => {
      const x = px + 20 + (k % 8) * 88, y = 350 + Math.floor(k / 8) * 86;
      const can = !it.sold && s.gold >= it.cost;
      const b = btn({ x: x, y: y, w: 80, h: 80, invisible: true, disabled: !can, on: () => { if (Z.buy(s, it.k)) { A.play('buy'); toast(`「${Z.W[it.k].name}」を買った（持ち物へ）`); saveGame('camp'); } }, key: `buy_${it.k}` });
      V.word(ctx, Z.W, Z.wd(it.k), x + 7, y, 66, 58, { small: true, hot: b.hot && can, alpha: it.sold ? 0.3 : (can ? 1 : 0.55) });
      V.coin(ctx, x + 24, y + 70, 7);
      V.text(ctx, it.sold ? '売り切れ' : String(it.cost), x + 36, y + 70, { size: 13, weight: 800, color: it.sold ? '#9a8f80' : (can ? '#ffe08a' : '#c08070') });
      tip(x, y, 80, 80, `${Z.W[it.k].name}（${Z.ROLE[Z.W[it.k].role].name}）・金貨${it.cost}`, Z.W[it.k].desc);
    });
    // 下のボタン
    const hasUp = s.shop.indexOf('up1') >= 0;
    btn({ x: px, y: 532, w: 180, h: 70, label: '試し撃ち', sub: '同じ回転で比べる', size: 20, serif: true, on: () => { App.held = null; startPractice(); }, key: 'practice' });
    btn({ x: px + 190, y: 532, w: 170, h: 70, label: App.campMode === 'up' ? '鍛えるのをやめる' : '鍛える', sub: hasUp ? '源の言葉を強く' : '鍛冶屋を救うと', size: App.campMode === 'up' ? 15 : 20, serif: true, disabled: !hasUp, on: () => { App.campMode = App.campMode === 'up' ? 'place' : 'up'; App.held = null; }, key: 'upmode' });
    btn({ x: px + 560, y: 532, w: 180, h: 70, label: s.stage === Z.FINAL ? '決戦へ' : '出陣', kind: 'main', size: 28, serif: true, disabled: s.stage > Z.FINAL, on: () => { App.held = null; openMap(null); }, key: 'depart' });
    if (held) {
      const w = held.from === 'inv' ? s.inv[held.idx] : s.reels[held.ri].strip[held.slot];
      if (w) {
        V.word(ctx, Z.W, w, App.mx + 14, App.my + 14, 40, 38, { small: true, alpha: 0.8, noNew: true });
        const nm = `「${Z.W[w.k].name}」（${Z.ROLE[Z.W[w.k].role].name}）`;
        V.text(ctx, held.from === 'inv' ? `持っている：${nm}` : `持ち上げた：${nm}`, px + 370, 552, { size: 14, weight: 800, color: '#ffe9b0' });
        V.text(ctx, held.from === 'inv' ? '光るマスへ（Esc・右クリックでやめる）' : '同じリールの別のマスで入れ替え', px + 370, 576, { size: 11, weight: 600, color: '#fff2d0' });
      }
    }
    if (App.campMode === 'up') V.text(ctx, '源のリールの言葉を押すと、金貨で一段強くなる（Lv3まで）', px + 370, 590, { size: 13, weight: 600, color: '#ffe0a0' });
    // 最初の工房の案内
    if (s.stage === 1 && s.inv.some(w => w.k === 'lance') && !App.overlay) {
      V.panel(ctx, 520, 612, 600, 50, { dark: true });
      V.text(ctx, '持ち物の「貫く」を押して、形のリールの「空き」（点線のマス）を押してみよう。', 540, 637, { size: 15, weight: 700, color: '#ffe9b0' });
    }
  }
  function clickSlot(i, j) {
    const s = S();
    const held = App.held;
    if (App.campMode === 'up') {
      if (Z.upgrade(s, i, j)) { A.play('buy'); toast('鍛えた！'); saveGame('camp'); } else A.play('deny');
      return;
    }
    if (held && held.from === 'inv') {
      const old = s.reels[i].strip[j];
      const plainSword = old && old.k === 'sword' && old.lv === 1;
      if (Z.place(s, held.idx, i, j)) { A.play('place'); App.held = null; saveGame('camp'); if (plainSword) toast('ふつうの「剣」（Lv1）は、置きかえると持ち物にはもどらない'); }
      else { A.play('deny'); toast('この言葉は、ちがう役割のリールに刻む'); }
      return;
    }
    if (held && held.from === 'reel') {
      if (held.ri === i) { if (held.slot !== j) { Z.swapSlots(s, i, held.slot, j); A.play('place'); saveGame('camp'); } App.held = null; }
      else { App.held = { from: 'reel', ri: i, slot: j }; }
      return;
    }
    App.held = { from: 'reel', ri: i, slot: j };
    A.play('click');
  }

  // ---------- 結末 ----------
  function drawEnding() {
    const s = S();
    V.background(ctx, 'camp', App.t, { lit: 1 });
    for (let i = 0; i < 14; i++) V.person(ctx, 120 + i * 80, 690 - (i % 2) * 8, ['villager', 'child', 'old', 'scholar', 'smith', 'priest', 'clock', 'knights', 'queen', 'villager', 'child', 'old', 'knight', 'mage'][i], App.t, { scale: 1.3, cheer: true, staff: i === 13 });
    V.panel(ctx, 170, 80, 940, 520);
    V.text(ctx, '王の街道に、明かりがもどった', W / 2, 126, { align: 'center', size: 32, weight: 800, serif: true, color: '#5a2a0a' });
    V.text(ctx, '一手の呪文で与えたダメージの最大（砦ごと）', W / 2, 172, { align: 'center', size: 17, weight: 700, color: '#3b2a14' });
    const best = s.best;
    // 序盤の小さな値も見えるよう、高さは平方根で
    const maxD = Math.max(1, ...best.map(b => (b ? b.dmg : 0)));
    for (let i = 0; i <= Z.FINAL; i++) {
      const b = best[i] || { kills: 0, dmg: 0 };
      const x = 250 + i * 116, base = 470, hh = Math.max(4, 240 * Math.sqrt(b.dmg / maxD));
      ctx.fillStyle = i === Z.FINAL ? '#e0902a' : '#a0603a';
      V.rr(ctx, x, base - hh, 70, hh, 6); ctx.fill();
      V.text(ctx, String(b.dmg), x + 35, base - hh - 14, { align: 'center', size: 17, weight: 800, color: '#3b2a14' });
      V.text(ctx, `一手で${b.kills}体`, x + 35, base + 16, { align: 'center', size: 12, weight: 700, color: '#5a4a3a' });
      V.text(ctx, ['見張り砦', '渡し場', '黒い森', '風の丘', '鉄の谷', '黒鉄の城', '大軍勢'][i], x + 35, base + 36, { align: 'center', size: 13, weight: 800, color: '#3b2a14' });
      if (i === Z.FINAL && b.lord) V.text(ctx, '魔王を討った', x + 35, base - hh - 34, { align: 'center', size: 12, weight: 800, color: '#a0401a' });
    }
    if (best[0] && best[Z.FINAL] && best[0].dmg) V.text(ctx, `最後の一手は、最初の砦の ${Math.round(best[Z.FINAL].dmg / best[0].dmg)}倍`, 250, 214, { align: 'left', size: 16, weight: 800, color: '#a0401a' });
    V.text(ctx, `退却 ${s.losses}回 ・ タイトルから「大詠唱の腕だめし」で、この詠唱盤をもう一度ためせる`, W / 2, 548, { align: 'center', size: 15, weight: 600, color: '#3b2a14' });
    btn({ x: W / 2 - 110, y: 560, w: 220, h: 34, label: 'タイトルへ', kind: 'light', size: 16, on: () => { App.scene = 'title'; A.music('title'); }, key: 'title' });
  }

  // ---------- 重ねる画面 ----------
  function drawOverlay() {
    const o = App.overlay;
    ctx.fillStyle = 'rgba(10,6,20,.6)'; ctx.fillRect(0, 0, W, H);
    if (o.kind === 'help') {
      const pg = D.HELP[o.page];
      V.panel(ctx, 240, 110, 800, 480);
      V.text(ctx, `あそびかた　${o.page + 1}/${D.HELP.length}　${pg.title}`, 270, 150, { size: 24, weight: 800, serif: true, color: '#5a2a0a' });
      let y = 190;
      for (const l of pg.lines) { y += V.para(ctx, '・' + l, 270, y, 740, { size: 17, weight: 600, color: '#3b2a14', lh: 28 }) + 10; }
      btn({ x: 270, y: 520, w: 140, h: 48, label: '前へ', kind: 'light', disabled: o.page === 0, on: () => { o.page--; A.play('page'); } });
      btn({ x: 420, y: 520, w: 140, h: 48, label: '次へ', kind: 'light', disabled: o.page >= D.HELP.length - 1, on: () => { o.page++; A.play('page'); } });
      btn({ x: 870, y: 520, w: 140, h: 48, label: '閉じる', kind: 'main', on: () => { App.overlay = null; }, key: 'close' });
    } else if (o.kind === 'menu') {
      V.panel(ctx, 420, 140, 440, 440);
      V.text(ctx, 'メニュー', W / 2, 180, { align: 'center', size: 26, weight: 800, serif: true, color: '#5a2a0a' });
      let y = 214;
      const row = (label, on) => { btn({ x: 470, y: y, w: 340, h: 46, label: label, kind: 'light', size: 17, on: on }); y += 56; };
      row(`音：${cfg.mute ? 'なし' : 'あり'}（M）`, toggleMute);
      row(`音量：${Math.round(cfg.vol * 10)}`, () => { cfg.vol = cfg.vol >= 1 ? 0.2 : Math.round((cfg.vol + 0.2) * 10) / 10; A.setVol(cfg.vol); saveCfg(); A.play('click'); });
      row(`演出：${cfg.fast ? 'はやい' : 'ふつう'}`, () => { cfg.fast = !cfg.fast; saveCfg(); });
      row(`自動で回す：${cfg.auto ? 'する' : 'しない'}`, () => { cfg.auto = !cfg.auto; saveCfg(); });
      row('タイトルへもどる', () => { App.overlay = null; if (S() && S().b && !S().b.practice && !App.trial) saveGame('battle'); App.scene = 'title'; A.music('title'); });
      btn({ x: 540, y: 514, w: 200, h: 46, label: '閉じる', kind: 'main', on: () => { App.overlay = null; }, key: 'close' });
    } else if (o.kind === 'gift') {
      const s = S();
      const out = App.lastOut || {};
      V.panel(ctx, 260, 120, 760, 470);
      const who = D.FREED[s.stage - 1];
      V.text(ctx, `${who ? who.name : ''}からのお礼`, W / 2, 160, { align: 'center', size: 26, weight: 800, serif: true, color: '#5a2a0a' });
      let y = 196;
      const notes = [];
      if (out.fixed && out.fixed.length) notes.push(`「${out.fixed.map(w => Z.W[w.k].name).join('」「')}」をもらった（持ち物へ）。`);
      if (out.reel) notes.push(`詠唱盤に${out.reel === 'pow' ? '二本目の「力」' : '五本目の「響」'}のリールがついた！`);
      const rw = Z.REWARD[s.stage - 1] || {};
      if (rw.mana) notes.push(`魔力の器が大きくなった（一度に${s.maxMana}コマまでずらせる）。`);
      if (rw.guard) notes.push(`陣の守りが ${s.guardMax} になった。`);
      if (rw.shop && rw.shop.length) notes.push('市に新しい言葉がならんだ。' + (rw.shop.indexOf('up1') >= 0 ? '「鍛える」も使えるようになった。' : ''));
      for (const n of notes) { V.text(ctx, n, W / 2, y, { align: 'center', size: 17, weight: 700, color: '#3b2a14' }); y += 30; }
      V.text(ctx, 'さらに、ひとつ選んでください', W / 2, y + 14, { align: 'center', size: 18, weight: 800, color: '#7a3a10' });
      s.gift.opts.forEach((g, i) => {
        const x = 330 + i * 216, yy = y + 40;
        const w = g[0];
        const b = btn({ x: x, y: yy, w: 190, h: 220, kind: 'light', label: '', on: () => { Z.takeGift(s, i); App.overlay = null; A.play('buy'); saveGame('camp'); }, key: `gift${i}` });
        V.word(ctx, Z.W, w, x + 45, yy + 12, 100, 96, {});
        V.text(ctx, `${Z.W[w.k].name}（${Z.ROLE[Z.W[w.k].role].name}）`, x + 95, yy + 126, { align: 'center', size: 16, weight: 800, color: '#3b2a14' });
        V.para(ctx, Z.W[w.k].desc, x + 14, yy + 144, 162, { size: 13, weight: 600, color: '#4a3a24', lh: 19 });
        if (b.hot) { V.rr(ctx, x, yy, 190, 220, 10); ctx.strokeStyle = '#e08a2a'; ctx.lineWidth = 3; ctx.stroke(); }
      });
    }
  }

  // ======================================================================
  // 更新
  // ======================================================================
  function update(dt) {
    App.t += dt;
    if (App.toast) { App.toast.t += dt; if (App.toast.t > App.toast.dur) App.toast = null; }
    if (App.story) App.story.t += dt;
    if (App.map) App.map.t += dt;
    if (App.scene !== 'battle' || !BS) return;
    const s = S(), b = s.b;
    if (!b) return;
    const sdt = dt * SPD();
    if (BS.banner) BS.banner.t += dt;
    if (BS.big) BS.big.t += dt;
    if (BS.over) BS.over.t += dt;
    if (BS.shake > 0) BS.shake = Math.max(0, BS.shake - dt * 1.6);
    if (BS.flash > 0) BS.flash = Math.max(0, BS.flash - dt * 1.5);
    if (BS.guardHit > 0) BS.guardHit = Math.max(0, BS.guardHit - dt * 1.5);
    if (BS.hint) BS.hint.t += dt;
    // 回転
    if (BS.spin) {
      const sp = BS.spin;
      sp.t += sdt;
      s.reels.forEach((r, i) => {
        if (sp.done[i]) return;
        if (sp.t >= sp.stops[i]) {
          sp.done[i] = true;
          // 止まる位置へ（少し行きすぎてから戻る）
          BS.vis[i] = nearest(BS.vis[i], r.pos, r.strip.length) - 0.35;
          A.play('stop', { i: i });
        } else {
          BS.vis[i] += sdt * 14;
          if (Math.floor(BS.vis[i] * 1) !== Math.floor((BS.vis[i] - sdt * 14))) A.play('tick', { i: i });
        }
      });
      if (sp.done.every(x => x)) finishSpin();
    } else {
      s.reels.forEach((r, i) => {
        const target = nearest(BS.vis[i], r.pos + (b.offs[i] || 0), r.strip.length);
        BS.vis[i] += (target - BS.vis[i]) * Math.min(1, dt * 14);
        if (Math.abs(target - BS.vis[i]) < 0.002) BS.vis[i] = target;
      });
    }
    runTL(sdt);
    // 演出
    for (const f of BS.fx) f.t += sdt;
    BS.fx = BS.fx.filter(f => f.t < f.d);
    for (const p of BS.pops) p.t += sdt;
    BS.pops = BS.pops.filter(p => p.t < 1.1);
    for (const r of BS.runners) { r.t += sdt; if (r.t > 0) r.x += r.vx * sdt; }
    BS.runners = BS.runners.filter(r => r.x > L.FX - 40);
    for (const id in BS.dm.en) {
      const e = BS.dm.en[id];
      const k = Math.min(1, sdt * (e.strike ? 9 : 7));
      if (e.flee > 0) { e.x += sdt * 260; e.flee = Math.max(0, e.flee - sdt * 0.8); e.alpha = e.flee; if (e.flee <= 0) delete BS.dm.en[id]; continue; }
      e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k;
      if (e.alpha < 1) e.alpha = Math.min(1, e.alpha + sdt * 3);
      if (e.flash > 0) e.flash -= sdt;
      if (e.dying > 0) { e.dying -= sdt * 2.2; if (e.dying <= 0) delete BS.dm.en[id]; }
    }
    // 自動で回す
    if (BS.autoT > 0 && b.phase === 'spin' && !BS.tl && !App.overlay && !BS.over) {
      BS.autoT -= dt;
      if (BS.autoT <= 0) doSpin();
    }
  }
  function nearest(cur, target, n) {
    const k = Math.round((cur - target) / n);
    return target + k * n;
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
      if (inside(x, y, b)) return b;
    }
    return null;
  }
  cv.addEventListener('pointermove', ev => {
    const p = toGame(ev); App.mx = p.x; App.my = p.y;
    if (BS && BS.drag && App.scene === 'battle') {
      const d = BS.drag;
      const dy = p.y - d.y;
      if (Math.abs(dy) > 46) { shiftReel(d.i, dy < 0 ? 1 : -1); d.y = p.y; d.moved = true; }
    }
  });
  cv.addEventListener('pointerdown', ev => {
    A.init();
    const p = toGame(ev); App.mx = p.x; App.my = p.y;
    if (ev.button === 2) { rightClick(); return; }
    const b = hitBtn(p.x, p.y);
    if (b) { if (!b.disabled && b.on) b.on(); return; }
    // 詠唱盤のリールを上下にドラッグ
    if (App.scene === 'battle' && BS && !App.overlay) {
      for (let i = 0; i < S().reels.length; i++) {
        const x = reelX(i);
        if (p.x >= x && p.x <= x + L.RW && p.y >= L.Y && p.y <= L.Y + L.RH * 3) { BS.drag = { i: i, y: p.y }; return; }
      }
    }
  });
  window.addEventListener('pointerup', () => { if (BS) BS.drag = null; });
  cv.addEventListener('contextmenu', ev => ev.preventDefault());
  function rightClick() {
    if (App.overlay) { if (App.overlay.kind !== 'gift') App.overlay = null; return; }
    if (App.scene === 'camp') {
      if (App.held) { App.held = null; return; }
      const b = hitBtn(App.mx, App.my);
      if (b && b.onRight) b.onRight();
      return;
    }
    if (App.scene === 'battle') resetShift();
  }
  cv.addEventListener('wheel', ev => {
    if (App.scene !== 'battle' || !BS) return;
    const p = toGame(ev);
    for (let i = 0; i < S().reels.length; i++) {
      const x = reelX(i);
      if (p.x >= x && p.x <= x + L.RW && p.y >= 96 && p.y <= 592) { ev.preventDefault(); shiftReel(i, ev.deltaY > 0 ? -1 : 1); return; }
    }
  }, { passive: false });
  window.addEventListener('keydown', ev => {
    A.init();
    const k = ev.key;
    if (k === 'm' || k === 'M') { toggleMute(); return; }
    if (App.overlay) {
      if (k === 'Escape') { if (App.overlay.kind !== 'gift') App.overlay = null; }
      else if (App.overlay.kind === 'help' && (k === 'ArrowRight' || k === ' ')) { if (App.overlay.page < D.HELP.length - 1) App.overlay.page++; else App.overlay = null; }
      else if (App.overlay.kind === 'help' && k === 'ArrowLeft') { if (App.overlay.page > 0) App.overlay.page--; }
      ev.preventDefault();
      return;
    }
    if (App.scene === 'story') { if (k === ' ' || k === 'Enter') { storyNext(); ev.preventDefault(); } if (k === 'Escape') { const f = App.story.then; App.story = null; f(); } return; }
    if (App.scene === 'camp') { if (k === 'Escape') App.held = null; return; }
    if (App.scene === 'map') { if (k === ' ' || k === 'Enter') { const b = App.btns.find(x => x.key === 'next'); if (b && !b.disabled) b.on(); ev.preventDefault(); } return; }
    if (App.scene !== 'battle' || !BS) return;
    if (k === 'Escape') { App.overlay = { kind: 'menu', t: 0 }; return; }
    if (BS.over) {
      if (k === ' ' || k === 'Enter') { const b = App.btns.find(x => x.key === 'next' || x.key === 'retry'); if (b && !b.disabled && BS.over.t > 1) b.on(); ev.preventDefault(); }
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
    if (up >= 0) { shiftReel(up, 1); return; }
    if (dn >= 0) { shiftReel(dn, -1); return; }
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
    if (!App.debugHold) { update(dt); draw(); }
    requestAnimationFrame(loop);
  }
  A.music('title');
  requestAnimationFrame(loop);

  // ======================================================================
  // 検証用の窓口（ツールから使う）
  // ======================================================================
  window.ZR17 = {
    App: App, cfg: cfg,
    scene: () => App.scene,
    state: () => S(),
    bs: () => BS,
    buttons: () => App.btns.filter(b => !b.invisible || b.key).map(b => ({ key: b.key || null, label: b.label, x: b.x + b.w / 2, y: b.y + b.h / 2, disabled: !!b.disabled })),
    busy: () => !!(BS && (BS.tl || BS.spin)),
    phase: () => (S() && S().b ? S().b.phase : null),
    suggest: () => { const s = S(); if (!s || !s.b || s.b.phase !== 'aim') return null; const save = s.b.offs.slice(); const best = Z.bestShift(s); s.b.offs = save; return best ? best.offs.map((o, i) => o - save[i]) : null; },
    shiftBtn: (i, dir) => { const b = App.btns.find(x => x.key === (dir > 0 ? 'up' : 'dn') + i); return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : null; },
    newGame: seed => newGame(seed),
    goto: (stage, seed, reels, extra) => {
      App.s = Z.newGame(seed || 1); App.s.stage = stage;
      if (reels) App.s.reels = reels.map((keys, i) => ({ role: Z.REEL_ROLES[i], strip: keys.map(k => (Array.isArray(k) ? Z.wd(k[0], k[1]) : Z.wd(k))), pos: 0 }));
      if (extra) Object.assign(App.s, extra);
      startBattle(stage);
    },
    camp: () => openCamp(),
    practice: () => startPractice(),
    hold: v => { App.debugHold = v; },
    step: n => { for (let i = 0; i < (n || 1); i++) update(1 / 60); draw(); },
    draw: () => draw(),
    spinAt: pos => doSpin(pos),
    setSpeed: v => { App.speed = v; },
    // 工房での次の一手（ボット用）：贈り物→買い物→置く の順に、実際のクリック先を返す
    planCamp: () => {
      const s = S();
      if (App.overlay && App.overlay.kind === 'gift') {
        const PR = ['all', 'x3', 'lance', 'fire', 'storm', 'x2', 'twice', 'burst', 'bolt', 'light', 'sweep', 'ice'];
        let bi = 0, bp = 99;
        s.gift.opts.forEach((g, i) => { const p = PR.indexOf(g[0].k); if (p >= 0 && p < bp) { bp = p; bi = i; } });
        return { act: 'gift', key: 'gift' + bi };
      }
      if (App.campMode === 'up') return { act: 'btn', key: 'upmode' };
      const PRB = ['all', 'x3', 'lance', 'fire', 'storm', 'x2', 'twice', 'burst', 'bolt', 'light', 'sweep'];
      for (const k of PRB) { const it = Z.shopList(s).find(x => x.k === k && !x.sold && x.cost <= s.gold); if (it && s.inv.length < 6) return { act: 'btn', key: 'buy_' + k }; }
      if (s.inv.length) {
        if (!App.held || App.held.from !== 'inv') return { act: 'btn', key: 'inv0' };
        const w = s.inv[App.held.idx];
        let best = null;
        const RANK = { sword: 0, ice: 1, bolt: 2, light: 2, fire: 3, gap: -1, point: 1, sweep: 2, lance: 3, burst: 3, storm: 4, p1: -1, x2: 2, twice: 2, x3: 3, e0: -1, up: 1, down: 1, all: 3 };
        const rk = x => (RANK[x.k] || 0) + (x.lv - 1) * 2;
        for (let ri = 0; ri < s.reels.length; ri++) {
          if (!Z.canPlace(s, w, ri)) continue;
          s.reels[ri].strip.forEach((x, j) => {
            if (rk(x) >= rk(w)) return;
            const n = s.reels[ri].strip.length;
            let v = 10 - rk(x);
            // となりに同じ言葉があれば少し加点（縦にそろう）
            if (s.reels[ri].strip[(j + 1) % n].k === w.k || s.reels[ri].strip[(j + n - 1) % n].k === w.k) v += 0.5;
            v -= j * 0.01;
            if (!best || v > best.v) best = { v: v, key: `slot${ri}_${j}` };
          });
        }
        if (best && best.v > 0) return { act: 'btn', key: best.key };
        return { act: 'drop' };
      }
      return { act: 'btn', key: 'depart' };
    },
  };
})();
