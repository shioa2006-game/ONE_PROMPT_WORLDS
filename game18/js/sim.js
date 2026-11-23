// がらり、迷宮ひらき — ルール本体（描画に依存しない。node でも動く）
(function (root) {
  'use strict';
  const G = {};
  const mod = (a, n) => ((a % n) + n) % n;
  G.mod = mod;

  // ---------- 乱数（状態を JSON に保存できる形） ----------
  G.rand = function (st) {
    let t = (st.a = (st.a + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  G.randInt = (st, n) => Math.floor(G.rand(st) * n);
  G.clone = o => JSON.parse(JSON.stringify(o));

  // ---------- 紋（リールのコマ） ----------
  G.R = {
    sword: { name: '剣', el: true, desc: 'ふつうの一撃。手前の魔物から順に貫き、余った力は奥へ進む。' },
    fire: { name: '炎', el: true, desc: '茨を焼く。草木と氷の魔物に2倍。' },
    ice: { name: '氷', el: true, desc: '当たった列で生き残った魔物を凍らせ、次の一歩を止める。水を凍らせて道にする。炎の魔物に2倍。' },
    bolt: { name: '雷', el: true, desc: '列の魔物すべてに、同じ力でいっぺんに当たる。古い歯車を動かす。水と石の魔物に2倍。' },
    light: { name: '光', el: true, desc: '封印をとく。骸骨と亡霊に2倍。' },
    star: { name: '星', wild: true, desc: 'どの紋の代わりにもなる。星が入った行は力が2倍。' },
    gap: { name: '空き', blank: true, desc: '何も刻まれていないマス。ここで行が途切れる。' },
  };
  G.EL_ORDER = ['sword', 'fire', 'ice', 'bolt', 'light', 'star'];
  G.cell = (k, lv) => ({ k: k, lv: k === 'gap' ? 0 : (lv || 1) });
  G.STRIP = 8;
  // 同じ紋がいくつ続いたか → 倍率
  G.LEN_MULT = [0, 0, 1, 2, 4, 8];

  // ---------- 魔物 ----------
  G.EN = {
    goblin: { name: '小鬼', hp: 2, atk: 1, spd: 1, desc: 'まっすぐ歩いてくる。' },
    bat: { name: 'コウモリ', hp: 1, atk: 1, spd: 2, desc: '一度に二歩すすむ。' },
    archer: { name: '弓小鬼', hp: 2, atk: 1, spd: 1, range: 3, desc: '三歩の距離まで来ると、そこから矢を射る。' },
    chief: { name: '小鬼の親分', hp: 16, atk: 2, spd: 1, slow: true, boss: true, desc: '一手おきに歩く。倒すと子分は逃げ出す。' },
    thornling: { name: '茨っこ', hp: 3, atk: 1, spd: 1, weak: ['fire'], desc: '茨から生まれた小さな魔物。炎に弱い。' },
    crab: { name: '水晶ガニ', hp: 6, atk: 1, spd: 1, resist: ['sword'], weak: ['bolt'], desc: 'かたい殻で剣は半分。雷に弱い。' },
    slime: { name: '氷スライム', hp: 5, atk: 1, spd: 1, weak: ['fire'], resist: ['ice'], desc: '炎に弱く、氷は半分。' },
    fish: { name: '半魚人', hp: 5, atk: 1, spd: 1, weak: ['bolt'], desc: '湖から上がってくる。雷に弱い。' },
    golem: { name: '水晶ゴーレム', hp: 48, atk: 3, spd: 1, slow: true, boss: true, resist: ['sword'], weak: ['bolt'], desc: '一手おきに歩く。剣は半分、雷に弱い。倒すと取り巻きも崩れる。' },
    skel: { name: '骸骨兵', hp: 10, atk: 1, spd: 1, weak: ['light'], desc: '光に弱い。' },
    ghost: { name: '亡霊', hp: 9, atk: 1, spd: 1, weak: ['light'], resist: ['sword', 'fire'], desc: '剣と炎は半分。光に弱い。' },
    book: { name: '石の司書', hp: 22, atk: 2, spd: 1, slow: true, resist: ['sword', 'fire'], weak: ['bolt'], desc: '一手おきに歩く。剣と炎は半分、雷に弱い。' },
    dummy: { name: 'わら人形', hp: 3, atk: 0, spd: 0, dummy: true, desc: '試し詠唱の的。' },
    arm: { name: '番人の腕', hp: 100, atk: 1, spd: 0, every: 3, nofreeze: true, resist: ['sword'], desc: '動かない。数手ごとに大きく振り下ろす。剣は半分。' },
    heart: { name: '番人の胸', hp: 180, atk: 2, spd: 0, every: 5, nofreeze: true, boss: true, weak: ['light'], desc: '番人の心臓。光に弱い。腕が残っていると、石の殻で力が半分になる。' },
  };
  G.mult = function (el, e) {
    const T = G.EN[e.t];
    let m = 1;
    if (el !== 'star') {
      if (T.weak && T.weak.indexOf(el) >= 0) m = 2;
      if (T.resist && T.resist.indexOf(el) >= 0) m = 0.5;
    }
    if (e.shell) m *= 0.5;
    return m;
  };

  // ---------- 壁 ----------
  G.WALL = {
    rock: { name: '岩壁', need: null },
    exit: { name: '抜け道', need: null },
    thorn: { name: '茨の壁', need: 'fire', desc: '炎の行で焼ける。' },
    crack: { name: 'ひびの入った壁', need: 'any', desc: 'どの紋でも、一撃で決まった力以上が届けば崩れる。' },
    lake: { name: '地底湖', need: 'ice', desc: '氷の行で凍らせれば、渡れる。' },
    gear: { name: '止まった歯車', need: 'bolt', desc: '雷の行で動き出す。' },
    seal: { name: '封印の扉', need: 'light', desc: '光の行でとける。' },
    final: { name: '最後の壁', need: 'any', desc: 'どの紋でも、届いた力が積み重なり、決まった力に達すると崩れる。' },
  };
  G.wallFits = (w, el) => w.need === 'any' || w.need === el || el === 'star';

  // ---------- データ（data.js が入れる） ----------
  G.D = null;
  G.setData = d => { G.D = d; };

  // ---------- 新しい冒険 ----------
  G.newGame = function (seed) {
    seed = (seed >>> 0) || 1;
    const S = (a) => a.map(k => G.cell(k));
    const s = {
      v: 1, seed: seed, rs: { a: seed },
      reels: [
        { strip: S(['sword', 'sword', 'gap', 'sword', 'gap', 'sword', 'sword', 'gap']), pos: 0 },
        { strip: S(['sword', 'gap', 'sword', 'sword', 'gap', 'sword', 'gap', 'sword']), pos: 0 },
        { strip: S(['gap', 'sword', 'sword', 'gap', 'sword', 'sword', 'gap', 'sword']), pos: 0 },
      ],
      bag: [], forge: 0, mpMax: 2, hpMax: 6,
      at: G.D ? G.D.START : 's1_in',
      rooms: {}, walls: {}, items: {}, flags: {},
      stats: { kills: 0, best: 0, bestEl: null, walls: 0, turns: 0, losses: 0, battles: 0, bestBy: {} },
      b: null,
    };
    if (G.D) G.enterRoom(s, s.at, true);
    return s;
  };

  // ---------- 地図 ----------
  const RM = id => G.D.ROOMS[id];
  G.room = RM;
  G.rs = (s, id) => (s.rooms[id] || (s.rooms[id] = { k: 0, v: 0, c: 0, t: 0 }));
  G.edges = function (id) { return G.D.EDGES.filter(e => e.a === id || e.b === id); };
  G.edgeOpen = (s, e) => !e.gate || !!s.walls[e.gate];
  G.other = (e, id) => (e.a === id ? e.b : e.a);
  // 部屋が「見えている」か（師匠の下書き・訪れた部屋のとなり）
  G.known = (s, id) => !!(G.rs(s, id).k || G.rs(s, id).v || (RM(id).pre && !RM(id).hidden));
  G.visited = (s, id) => !!G.rs(s, id).v;
  G.enterRoom = function (s, id, quiet) {
    const st = G.rs(s, id);
    const first = !st.v;
    st.v = 1; st.k = 1;
    s.at = id;
    const revealed = [];
    for (const e of G.edges(id)) {
      const o = G.other(e, id);
      const os = G.rs(s, o);
      // 門の向こうは、門が開くまで隠れたまま（隠し部屋）。隠しでない部屋は門ごしに見える
      if (!G.edgeOpen(s, e) && RM(o).hidden) continue;
      if (!os.k) { os.k = 1; revealed.push(o); }
    }
    return { first: first, revealed: revealed };
  };
  // 壁が崩れたら、その先の部屋を地図に出す
  G.openWall = function (s, wid) {
    if (s.walls[wid]) return [];
    s.walls[wid] = 1;
    s.stats.walls++;
    const out = [];
    for (const e of G.D.EDGES) {
      if (e.gate !== wid) continue;
      for (const id of [e.a, e.b]) {
        const st = G.rs(s, id);
        if (!st.k) { st.k = 1; out.push(id); }
      }
    }
    return out;
  };
  // いまの部屋から行ける部屋への道（訪れた部屋だけを通る）
  G.path = function (s, from, to) {
    if (from === to) return [from];
    const prev = {}; prev[from] = null;
    const q = [from];
    while (q.length) {
      const c = q.shift();
      for (const e of G.edges(c)) {
        if (!G.edgeOpen(s, e)) continue;
        const o = G.other(e, c);
        if (o in prev) continue;
        if (!G.known(s, o)) continue;
        prev[o] = c;
        if (o === to) {
          const p = [o];
          let k = c;
          while (k !== null) { p.unshift(k); k = prev[k]; }
          return p;
        }
        if (G.passable(s, o)) q.push(o);
      }
    }
    return null;
  };
  // 通りぬけられる部屋（魔物を追いはらった部屋だけ）
  G.passable = (s, id) => G.visited(s, id) && !(RM(id).battle && !G.rs(s, id).c);
  // 部屋に残っている「まだ崩していない壁」
  G.roomWalls = function (s, id) {
    const r = RM(id);
    if (!r.battle) return [];
    const bt = G.D.BATTLES[r.battle];
    return (bt.walls || []).filter(w => w && w.id && !s.walls[w.id]);
  };
  G.roomDone = function (s, id) {
    const r = RM(id), st = G.rs(s, id);
    if (r.battle && !st.c) return false;
    if (r.items && !st.t) return false;
    return G.roomWalls(s, id).length === 0;
  };

  // ---------- 持ち物 ----------
  G.gain = function (s, it) {
    const out = [];
    if (it.rune) { for (let i = 0; i < (it.n || 1); i++) { const c = G.cell(it.rune, it.lv || 1); c.nw = 1; s.bag.push(c); } out.push(it); }
    if (it.forge) s.forge += it.forge;
    if (it.mp) s.mpMax += it.mp;
    if (it.hp) s.hpMax += it.hp;
    if (it.reel) {
      for (let i = 0; i < it.reel; i++) {
        s.reels.push({ strip: ['sword', 'gap', 'sword', 'gap', 'sword', 'sword', 'gap', 'gap'].map(k => G.cell(k)), pos: 0, nw: 1 });
      }
    }
    if (it.lore) s.items[it.lore] = 1;
    return out;
  };

  // ---------- 詠唱輪の組みかえ ----------
  G.place = function (s, bi, ri, ci) {
    const c = s.bag[bi];
    if (!c) return false;
    const old = s.reels[ri].strip[ci];
    s.reels[ri].strip[ci] = Object.assign({}, c, { nw: 1 });
    s.bag.splice(bi, 1);
    if (old.k !== 'gap') { const o = Object.assign({}, old); delete o.nw; s.bag.push(o); }
    return true;
  };
  G.swap = function (s, r1, c1, r2, c2) {
    const a = s.reels[r1].strip[c1], b = s.reels[r2].strip[c2];
    s.reels[r1].strip[c1] = b; s.reels[r2].strip[c2] = a;
    if (a.k !== 'gap') a.nw = 1;
    if (b.k !== 'gap') b.nw = 1;
    return true;
  };
  G.unplace = function (s, ri, ci) {
    const c = s.reels[ri].strip[ci];
    if (c.k === 'gap') return false;
    const o = Object.assign({}, c); delete o.nw;
    s.bag.push(o);
    s.reels[ri].strip[ci] = G.cell('gap');
    return true;
  };
  G.canForge = (s, c) => s.forge > 0 && c && c.k !== 'gap' && c.k !== 'star' && c.lv < 3;
  G.forgeUp = function (s, c) {
    if (!G.canForge(s, c)) return false;
    c.lv++; s.forge--; c.nw = 1;
    return true;
  };
  G.clearNew = function (s) {
    s.reels.forEach(r => { r.strip.forEach(c => { delete c.nw; }); delete r.nw; });
  };

  // ---------- 戦い ----------
  G.LANES = 3;
  G.QUIET_MP = 2; // 静かな部屋では、落ち着いてずらせる
  G.mpOf = s => s.mpMax + ((s.b && s.b.mpBonus) || 0);
  G.COLS = 6;
  // kind: battle / quiet（敵のいない部屋で壁を狙う）/ practice（試し詠唱）
  G.startBattle = function (s, bid, kind, room) {
    const bt = bid ? G.D.BATTLES[bid] : { enemies: [], walls: [null, null, null] };
    kind = kind || 'battle';
    const b = {
      bid: bid, room: room || s.at, kind: kind, turn: 1, phase: 'spin',
      hp: s.hpMax, mp: s.mpMax + (kind === 'quiet' ? G.QUIET_MP : 0), offs: s.reels.map(() => 0), mpBonus: kind === 'quiet' ? G.QUIET_MP : 0,
      en: [], walls: [], spawns: [], nid: 1, boss: null, spun: false,
      kills: 0, best: 0, lastSpin: null, flags: {},
    };
    s.b = b;
    for (let l = 0; l < G.LANES; l++) {
      const w = bt.walls && bt.walls[l];
      if (w && w.id) {
        b.walls.push({ id: w.id, kind: w.kind, need: G.WALL[w.kind].need, th: w.th, broken: !!s.walls[w.id], accum: w.kind === 'final', dmg: (s.wallDmg && s.wallDmg[w.id]) || 0,
          nest: w.nest && !s.walls[w.id] && kind === 'battle' ? { t: w.nest.t, every: w.nest.every, left: w.nest.n, cd: w.nest.first || w.nest.every } : null });
      } else b.walls.push(w ? { kind: w.kind || 'rock', deco: true } : { kind: 'rock', deco: true });
    }
    if (kind === 'battle' || kind === 'practice-room') {
      const scar = s.flags['scar_' + bid] || {};
      (bt.enemies || []).forEach((e, i) => {
        const en = G.addEnemy(b, e.t, e.lane, e.col, e);
        en.orig = i;
        if (scar[i] !== undefined && kind === 'battle') { en.hp = Math.min(en.hp, scar[i]); b.scarred = true; }
      });
      b.spawns = G.clone(bt.spawns || []);
    }
    if (kind === 'practice') {
      for (let l = 0; l < 3; l++) for (const c of [1, 2, 3]) G.addEnemy(b, 'dummy', l, c);
    }
    if (kind === 'practice-room') b.kind = 'practice';
    G.updateShell(b);
    return b;
  };
  G.addEnemy = function (b, t, lane, col, o) {
    const T = G.EN[t];
    const e = { id: b.nid++, t: t, lane: lane, col: col, hp: (o && o.hp) || T.hp, max: (o && o.hp) || T.hp, frozen: 0, rest: (o && o.rest) ? 1 : 0, cd: T.every ? ((o && o.cd) || T.every) : 0 };
    if (T.boss && !(o && o.minion)) b.boss = e.id;
    if (o && o.minion) e.minion = 1;
    b.en.push(e);
    return e;
  };
  G.alive = b => b.en.filter(e => e.hp > 0);
  G.laneEn = (b, l) => b.en.filter(e => e.hp > 0 && e.lane === l).sort((a, c) => a.col - c.col);

  // 窓のマス（r = 0,1,2 が上・中・下。-1 と 3 は窓の外にはみ出した札）
  G.winCell = function (s, i, r) {
    const R = s.reels[i];
    const off = s.b ? (s.b.offs[i] || 0) : 0;
    return R.strip[mod(R.pos + off + r, R.strip.length)];
  };
  G.winIdx = function (s, i, r) {
    const R = s.reels[i];
    const off = s.b ? (s.b.offs[i] || 0) : 0;
    return mod(R.pos + off + r, R.strip.length);
  };
  // 一行を左から読む
  G.lineOf = function (s, r) {
    const n = s.reels.length;
    let el = null, cnt = 0, stars = 0, lv = 0;
    const cells = [];
    for (let i = 0; i < n; i++) {
      const c = G.winCell(s, i, r);
      if (c.k === 'gap') break;
      if (c.k === 'star') { cnt++; stars++; lv += c.lv; cells.push(i); continue; }
      if (el === null || c.k === el) { el = c.k; cnt++; lv += c.lv; cells.push(i); continue; }
      break;
    }
    if (cnt < 2) return null;
    if (el === null) el = 'star';
    const mult = G.LEN_MULT[Math.min(cnt, 5)];
    return { row: r, el: el, n: cnt, stars: stars, cells: cells, lv: lv, mult: mult, power: lv * mult * (stars ? 2 : 1) };
  };
  G.lines = s => [0, 1, 2].map(r => G.lineOf(s, r)).filter(x => x);

  // 放つ：上の行から順に。s.b を書きかえ、何が起きたかを返す
  G.resolve = function (s) {
    const b = s.b;
    const res = { evs: [], kills: 0, dmg: 0, walls: [], best: 0, bossDead: false, newUsed: false };
    for (let r = 0; r < G.LANES; r++) {
      const ln = G.lineOf(s, r);
      if (!ln) continue;
      if (ln.power > res.best) res.best = ln.power;
      for (const i of ln.cells) if (G.winCell(s, i, r).nw) res.newUsed = true;
      const ev = { line: ln, hits: [], wall: null, out: 0 };
      const list = G.laneEn(b, r);
      let rem = ln.power;
      if (ln.el === 'bolt') {
        for (const e of list) {
          const m = G.mult('bolt', e);
          const d = Math.floor(ln.power * m);
          const k = d >= e.hp;
          ev.hits.push({ id: e.id, dmg: Math.min(d, e.hp), kill: k, m: m });
          res.dmg += Math.min(d, e.hp);
          e.hp = Math.max(0, e.hp - d);
        }
        rem = list.every(e => e.hp <= 0) ? ln.power : 0;
      } else {
        for (const e of list) {
          if (rem <= 0) break;
          const m = G.mult(ln.el, e);
          const d = Math.floor(rem * m);
          if (d >= e.hp) {
            const used = Math.ceil(e.hp / m - 1e-9);
            ev.hits.push({ id: e.id, dmg: e.hp, kill: true, m: m });
            res.dmg += e.hp;
            e.hp = 0;
            rem -= used;
          } else {
            ev.hits.push({ id: e.id, dmg: d, kill: false, m: m });
            res.dmg += d;
            e.hp -= d;
            rem = 0;
          }
        }
        if (ln.el === 'ice') {
          for (const e of list) if (e.hp > 0 && !G.EN[e.t].nofreeze) { e.frozen = 1; ev.froze = (ev.froze || 0) + 1; }
        }
      }
      for (const h of ev.hits) if (h.kill) { res.kills++; if (h.id === b.boss) res.bossDead = true; }
      // 列の魔物をみな倒し、まだ力が余っていれば、部屋の奥の壁に届く
      if (rem > 0) {
        const w = b.walls[r];
        if (w && w.id && !w.broken) {
          const fits = G.wallFits(w, ln.el);
          // 最後の壁だけは、届いた力が積み重なる（一撃で届かなくても、いつかは崩れる）
          const acc = w.accum ? (w.dmg || 0) : 0;
          const ok = fits && rem + acc >= w.th;
          ev.wall = { lane: r, id: w.id, kind: w.kind, power: rem, th: w.th, fits: fits, ok: ok, acc: acc };
          if (fits && w.accum && !ok) w.dmg = acc + rem;
          if (ok) { w.broken = true; w.nest = null; res.walls.push(w.id); }
        } else ev.out = rem;
      }
      ev.rem = rem;
      res.evs.push(ev);
    }
    // 番人の胸：腕が残っていると殻が固い
    G.updateShell(b);
    if (res.bossDead) {
      // 主を倒すと、取り巻きは逃げる
      res.fled = [];
      for (const e of b.en) if (e.hp > 0) { res.fled.push(e.id); e.hp = 0; e.fled = 1; }
      b.spawns = [];
      b.walls.forEach(w => { if (w.nest) w.nest = null; });
    }
    if (res.best > b.best) b.best = res.best;
    b.kills += res.kills;
    return res;
  };
  G.updateShell = function (b) {
    const arms = b.en.filter(e => e.t === 'arm' && e.hp > 0).length;
    for (const e of b.en) if (e.t === 'heart') e.shell = arms > 0 ? 1 : 0;
  };
  // 見こみ（状態を変えない）
  G.cloneB = b => G.clone(b);
  G.predict = function (s) {
    const save = s.b;
    s.b = G.cloneB(save);
    const res = G.resolve(s);
    res.after = s.b;
    s.b = save;
    return res;
  };
  G.offTotal = b => b.offs.reduce((a, o) => a + Math.abs(o), 0);
  G.shift = function (s, i, dir) {
    const b = s.b;
    if (!b || b.phase !== 'aim' || i < 0 || i >= s.reels.length) return false;
    const o = b.offs[i] + dir;
    const used = G.offTotal(b) - Math.abs(b.offs[i]) + Math.abs(o);
    if (used > G.mpOf(s)) return false;
    b.offs[i] = o;
    b.mp = G.mpOf(s) - used;
    return true;
  };
  G.resetShift = function (s) { const b = s.b; b.offs = s.reels.map(() => 0); b.mp = G.mpOf(s); };

  // 回す（pos を渡すとその止まり方にする）
  G.spin = function (s, pos) {
    const b = s.b;
    s.reels.forEach((R, i) => { R.pos = pos ? mod(pos[i] !== undefined ? pos[i] : R.pos, R.strip.length) : G.randInt(s.rs, R.strip.length); });
    b.offs = s.reels.map(() => 0);
    b.mp = G.mpOf(s);
    b.lastSpin = s.reels.map(R => R.pos);
    b.phase = 'aim';
    b.spun = true;
    return b.lastSpin;
  };
  G.cast = function (s) {
    const b = s.b;
    if (b.phase !== 'aim') return null;
    const res = G.resolve(s);
    s.reels.forEach((R, i) => { R.pos = mod(R.pos + b.offs[i], R.strip.length); });
    b.offs = s.reels.map(() => 0);
    // 試し詠唱は記録にも地図にも残さない
    if (b.kind !== 'practice') {
      if (res.newUsed) G.clearNewUsed(s);
      s.stats.kills += res.kills;
      if (res.best > s.stats.best) { s.stats.best = res.best; }
      for (const w of res.walls) G.openWall(s, w);
      for (const w of b.walls) if (w.accum && w.dmg) { s.wallDmg = s.wallDmg || {}; s.wallDmg[w.id] = w.dmg; }
      s.stats.turns++;
      const st = (G.D && RM(b.room) && RM(b.room).st) || 1, by = s.stats.bestBy;
      if (!by[st] || res.best > by[st]) by[st] = res.best;
    }
    b.phase = 'enemy';
    res.end = G.checkWin(s);
    if (res.end) b.phase = res.end;
    return res;
  };
  G.clearNewUsed = function (s) { G.clearNew(s); };
  G.pendingSpawns = b => b.spawns.length > 0 || b.walls.some(w => w.nest && w.nest.left > 0 && !w.broken);
  G.checkWin = function (s) {
    const b = s.b;
    if (b.kind !== 'battle') return null;
    if (G.alive(b).length === 0 && !G.pendingSpawns(b)) return 'win';
    return null;
  };

  // 魔物の手番
  G.enemyPhase = function (s) {
    const b = s.b;
    const evs = [];
    if (b.kind !== 'battle') { G.nextTurn(s); return evs; }
    const list = G.alive(b).sort((a, c) => a.col - c.col || a.lane - c.lane);
    for (const e of list) {
      const T = G.EN[e.t];
      if (e.frozen) { e.frozen = 0; evs.push({ k: 'thaw', id: e.id }); continue; }
      if (T.every) {
        e.cd--;
        if (e.cd <= 0) { e.cd = T.every; b.hp -= T.atk; evs.push({ k: 'atk', id: e.id, dmg: T.atk, big: true }); }
        continue;
      }
      if (T.spd === 0) continue;
      if (T.slow) { e.rest = e.rest ? 0 : 1; if (e.rest) { evs.push({ k: 'rest', id: e.id }); continue; } }
      if (e.col === 0 || (T.range && e.col <= T.range)) {
        b.hp -= T.atk;
        evs.push({ k: 'atk', id: e.id, dmg: T.atk, ranged: e.col > 0 });
        continue;
      }
      let to = Math.max(0, e.col - T.spd);
      for (const o of G.alive(b)) if (o !== e && o.lane === e.lane && o.col < e.col && o.col >= to) to = o.col + 1;
      if (T.range) to = Math.max(to, Math.min(e.col, T.range));
      if (to < e.col) { evs.push({ k: 'move', id: e.id, from: e.col, to: to }); e.col = to; }
    }
    if (b.hp <= 0) {
      b.hp = 0; b.phase = 'lose'; s.stats.losses++;
      // 主の傷は残る（次の挑戦は、その傷から）
      if (b.kind === 'battle' && b.bid) {
        const sc = s.flags['scar_' + b.bid] || (s.flags['scar_' + b.bid] = {});
        b.en.forEach((e, i) => { if (G.EN[e.t].hp >= 16 && e.orig !== undefined && !e.minion) sc[e.orig] = Math.max(Math.ceil(e.max * 0.25), e.hp); });
        b.scarred = Object.keys(sc).length > 0;
      }
      return evs;
    }
    // 増援と巣
    G.doSpawns(s, evs);
    G.updateShell(b);
    G.nextTurn(s);
    return evs;
  };
  G.freeCol = function (b, lane) {
    for (let c = G.COLS - 1; c >= 3; c--) if (!b.en.some(e => e.hp > 0 && e.lane === lane && e.col === c)) return c;
    return -1;
  };
  G.doSpawns = function (s, evs) {
    const b = s.b;
    const t = b.turn;
    const empty = G.alive(b).length === 0;
    // 決まった増援（場が空なら、いちばん早い組を前倒しで呼ぶ）
    let due = b.spawns.filter(sp => sp.after <= t);
    if (!due.length && empty && b.spawns.length) {
      const first = Math.min.apply(null, b.spawns.map(sp => sp.after));
      due = b.spawns.filter(sp => sp.after === first);
    }
    for (const sp of due) {
      const c = G.freeCol(b, sp.lane);
      if (c < 0) continue;
      const e = G.addEnemy(b, sp.t, sp.lane, sp.col !== undefined ? Math.min(sp.col, c) : c, sp);
      evs.push({ k: 'spawn', id: e.id });
      b.spawns.splice(b.spawns.indexOf(sp), 1);
    }
    // 巣（崩すまで、何手かごとに魔物が出てくる）
    b.walls.forEach((w, l) => {
      if (!w.nest || w.broken || w.nest.left <= 0) return;
      w.nest.cd--;
      if (w.nest.cd <= 0 || (empty && !due.length)) {
        const c = G.freeCol(b, l);
        if (c < 0) { w.nest.cd = 1; return; }
        const e = G.addEnemy(b, w.nest.t, l, c);
        e.fromNest = 1;
        evs.push({ k: 'spawn', id: e.id, nest: true });
        w.nest.left--;
        w.nest.cd = w.nest.every;
      }
    });
  };
  G.nextTurn = function (s) {
    const b = s.b;
    b.turn++;
    b.mp = G.mpOf(s);
    b.offs = s.reels.map(() => 0);
    b.phase = 'spin';
  };
  // 勝ったあと：部屋を片づけ、ほうびを渡す
  G.winBattle = function (s) {
    const b = s.b;
    const st = G.rs(s, b.room);
    const first = !st.c;
    st.c = 1;
    s.stats.battles++;
    const bt = G.D.BATTLES[b.bid];
    const got = [];
    if (first && bt.reward) for (const it of bt.reward) { G.gain(s, it); got.push(it); }
    b.pick = first && bt.pick ? G.clone(bt.pick) : null;
    return got;
  };

  // 戦いのあと、紋を一つ選んで持ち帰る
  G.takePick = function (s, i) {
    const b = s.b;
    if (!b || !b.pick || !b.pick[i]) return null;
    const it = b.pick[i];
    G.gain(s, it);
    b.pick = null;
    return it;
  };

  // いまの組み方で、その紋の行がいちばん強くそろったときの力（並び方は考えない上限）
  G.maxLine = function (s, el) {
    let n = 0, lv = 0, star = false;
    for (const R of s.reels) {
      let best = null;
      for (const c of R.strip) {
        if (c.k === el || (el === 'any' && c.k !== 'gap') || c.k === 'star') { const v = c.k === 'star' ? 1.5 : c.lv; if (!best || v > best.v) best = { v: v, c: c }; }
      }
      if (!best) break;
      n++; lv += best.c.lv; if (best.c.k === 'star') star = true;
    }
    if (n < 2) return { n: n, power: 0 };
    return { n: n, power: lv * G.LEN_MULT[Math.min(5, n)] * (star ? 2 : 1) };
  };

  // ---------- ヒント：魔力の範囲で、ずらし方を全部ためす ----------
  G.score = function (s, res) {
    const b = s.b;
    let v = 0;
    for (const ev of res.evs) {
      for (const h of ev.hits) {
        const e = b.en.find(x => x.id === h.id);
        const T = G.EN[e.t];
        if (h.kill) v += 10 + (G.COLS - e.col) * 3 + (T.boss ? 60 : 0) + (T.hp > 10 ? 10 : 0);
        v += h.dmg * (T.boss ? 1.5 : 1);
      }
      if (ev.wall && ev.wall.ok) v += 45;
      else if (ev.wall && ev.wall.fits) v += 2 + ev.wall.power / Math.max(1, ev.wall.th) * 4;
    }
    return v;
  };
  G.offCombos = function (n, mp) {
    const out = [];
    const cur = new Array(n).fill(0);
    (function rec(i, left) {
      if (i === n) { out.push(cur.slice()); return; }
      for (let o = -left; o <= left; o++) { cur[i] = o; rec(i + 1, left - Math.abs(o)); }
      cur[i] = 0;
    })(0, mp);
    return out;
  };
  G.bestShift = function (s, opt) {
    const b = s.b;
    const save = b.offs.slice();
    let best = null;
    const mp = (opt && opt.mp !== undefined) ? opt.mp : G.mpOf(s);
    for (const offs of G.offCombos(s.reels.length, mp)) {
      b.offs = offs;
      const res = G.predict(s);
      const used = offs.reduce((a, o) => a + Math.abs(o), 0);
      const v = G.score(s, res) - used * 0.3;
      if (!best || v > best.v + 1e-9) best = { v: v, offs: offs.slice(), res: res, used: used };
    }
    b.offs = save;
    b.mp = G.mpOf(s) - G.offTotal(b);
    return best;
  };

  // ---------- 教える回転：一つずらせば効く止まり方を探す ----------
  // want(res0, res1, i, dir) が true になる止まり方を返す。見つからなければ null
  G.findTeachSpin = function (s, want, tries) {
    const b = s.b;
    const st = { a: (s.seed * 7 + 13 + (b.turn || 0) * 101) >>> 0 };
    const n = s.reels.length;
    const saveOffs = b.offs.slice(), savePos = s.reels.map(R => R.pos), saveMp = b.mp;
    let found = null;
    for (let t = 0; t < (tries || 600) && !found; t++) {
      const pos = s.reels.map(R => G.randInt(st, R.strip.length));
      s.reels.forEach((R, i) => { R.pos = pos[i]; });
      b.offs = new Array(n).fill(0);
      const r0 = G.predict(s);
      for (let i = 0; i < n && !found; i++) {
        for (const dir of [1, -1]) {
          b.offs = new Array(n).fill(0);
          b.offs[i] = dir;
          const r1 = G.predict(s);
          if (want(r0, r1, i, dir)) { found = { pos: pos, reel: i, dir: dir, r0: r0, r1: r1 }; break; }
        }
      }
    }
    s.reels.forEach((R, i) => { R.pos = savePos[i]; });
    b.offs = saveOffs; b.mp = saveMp;
    return found;
  };

  // ---------- ボット用：組みかえの次の一手 ----------
  // {forge, ri, ci} 鍛える／{place, bi, ri, ci} 持ち物を刻む／{} 終わり
  G.planEdit = function (s, mode) {
    const count = (R, k) => R.strip.filter(c => c.k === k).length;
    const tally = {};
    s.reels.forEach(R => R.strip.forEach(c => { if (c.k !== 'gap' && c.k !== 'sword' && c.k !== 'star') tally[c.k] = (tally[c.k] || 0) + 1; }));
    const main = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || 'sword';
    if (s.forge > 0) {
      let best = null;
      s.reels.forEach((R, ri) => R.strip.forEach((c, ci) => {
        if (!G.canForge(s, c)) return;
        const v = (mode === 'random' ? Math.random() * 10 : (c.k === main ? 10 : (c.k === 'sword' ? 1 : 4)) - c.lv * 3 - ri * 0.1);
        if (!best || v > best.v) best = { v: v, ri: ri, ci: ci };
      }));
      if (best) return { forge: 1, ri: best.ri, ci: best.ci };
    }
    const bi = s.bag.findIndex(c => c.k !== 'sword');
    if (bi < 0) return {};
    const k = s.bag[bi].k;
    if (mode === 'random') {
      const ri = Math.floor(Math.random() * s.reels.length), ci = Math.floor(Math.random() * G.STRIP);
      return { place: 1, bi: bi, ri: ri, ci: ci };
    }
    let ri = 0, mn = 99;
    s.reels.forEach((R, i) => { const c = count(R, k); if (c < mn) { mn = c; ri = i; } });
    const R = s.reels[ri];
    let ci = R.strip.findIndex(c => c.k === 'gap');
    if (ci < 0) ci = R.strip.findIndex(c => c.k === 'sword' && c.lv === 1);
    if (ci < 0) ci = R.strip.findIndex(c => c.k !== k && c.k !== 'star' && c.k !== main);
    if (ci < 0) ci = 0;
    return { place: 1, bi: bi, ri: ri, ci: ci };
  };
  // ボット用：持ち帰る紋をえらぶ
  G.choosePick = function (s, opts, mode) {
    if (mode === 'random') return Math.floor(Math.random() * opts.length);
    const tally = {};
    s.reels.forEach(R => R.strip.forEach(c => { if (c.k !== 'gap' && c.k !== 'sword' && c.k !== 'star') tally[c.k] = (tally[c.k] || 0) + 1; }));
    const main = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || 'sword';
    let bi = 0, bv = -1;
    opts.forEach((it, i) => {
      let v = 1;
      if (it.rune === 'star') v = 9;
      else if (it.rune === main) v = 6;
      else if (it.rune && it.rune !== 'sword') v = 4;
      else if (it.rune === 'sword') v = 3;
      v += ((it.lv || 1) - 1) * 1.5 + ((it.n || 1) - 1) * 0.8;
      if (v > bv) { bv = v; bi = i; }
    });
    return bi;
  };
  G.autoEdit = function (s, mode) {
    for (let g = 0; g < 60; g++) {
      const p = G.planEdit(s, mode);
      if (p.forge) { G.forgeUp(s, s.reels[p.ri].strip[p.ci]); continue; }
      if (p.place) { G.place(s, p.bi, p.ri, p.ci); continue; }
      break;
    }
  };

  // ---------- 保存 ----------
  G.save = function (s) { const c = G.clone(s); c.b = null; return c; };

  root.GR = G;
  if (typeof module !== 'undefined') module.exports = G;
})(typeof window !== 'undefined' ? window : this);
