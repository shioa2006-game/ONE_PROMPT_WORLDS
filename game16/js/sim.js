// 呪いほどき — ルール本体（描画や音に依存しない純粋なシミュレーション）
// ブラウザでは window.RR、node では module.exports として使う。
// 状態はすべて素の JSON なので、そのまま保存・復帰できる。
(function (root) {
  'use strict';
  const RR = {};

  // ---------- 乱数（状態に種を持たせ、保存・再現できるようにする） ----------
  RR.rand = function (s) {
    s.rs = (s.rs + 0x6D2B79F5) | 0;
    let t = s.rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  RR.randInt = (s, n) => Math.floor(RR.rand(s) * n);
  RR.pick = (s, arr) => arr[RR.randInt(s, arr.length)];
  RR.shuffle = function (s, arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = RR.randInt(s, i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  };

  // ---------- 紋（リールのコマ） ----------
  // el：つながる属性。star はどの属性ともつながる。gem はつながらず、となりの力を増やす。
  RR.RUNE = {
    blank: { name: '石の床', short: '石', desc: '何も起きない。工房で紋を置ける。' },
    light: { name: '光の紋', short: '光', el: 'light', desc: 'つながった紋の上に立つ魔物の呪いを、力の2倍ほどく。いちばん強い。' },
    ice: { name: '氷の紋', short: '氷', el: 'ice', desc: 'つながった紋の上に立つ魔物を凍らせ、次の一歩を止める。ほどく力は等倍。' },
    bolt: { name: '雷の紋', short: '雷', el: 'bolt', desc: 'つながった紋の上に立つ魔物を打ち、その魔物にくっついて並ぶ魔物へも、同じ力で次々に跳ぶ。' },
    star: { name: '星の紋', short: '星', el: '*', desc: 'どの紋ともつながる。星だけのつながりは光として働く。' },
    gem: { name: '魔晶', short: '晶', desc: 'となりにあるつながりの力を2倍にする（Lv2で3倍、Lv3で4倍）。魔晶どうしは重なってかかる。' },
  };
  RR.ELEMENTS = ['light', 'ice', 'bolt'];
  RR.ROWS = 3;
  RR.STRIP = 8;
  RR.MAXLV = 3;

  RR.cell = (t, lv) => ({ t: t, lv: t === 'blank' ? 0 : (lv || 1) });
  // 'L_I_B*G' の文字列からリールを作る（小文字は Lv2）
  RR.strip = function (str) {
    const map = { _: 'blank', L: 'light', I: 'ice', B: 'bolt', S: 'star', G: 'gem' };
    return str.split('').map(ch => {
      const up = ch.toUpperCase();
      const lv = ch !== up ? 2 : 1;
      return RR.cell(map[up] || 'blank', lv);
    });
  };

  // ---------- 魔物（呪われた人々） ----------
  RR.MON = {
    imp: { name: '小鬼', speed: 1, coin: 1, who: 'villager', desc: '呪われた村人。一歩ずつ結界へ近づく。' },
    wisp: { name: '霧の子', speed: 1, coin: 1, who: 'child', desc: '呪われた子ども。呪いは弱いが、かたまって来る。' },
    wolf: { name: '影狼', speed: 2, coin: 2, who: 'dog', desc: '呪われた犬。一度に二歩進む。凍らせると止まる。' },
    golem: { name: '岩鬼', speed: 1, coin: 2, who: 'miner', desc: '呪われた鉱夫。盾の数より弱い一撃は弾いてしまう。' },
    knight: { name: '影の騎士', speed: 1, slow: true, coin: 2, who: 'soldier', desc: '呪われた兵士。二手に一歩しか進まないが、呪いが強い。' },
    boss: { name: '主', speed: 1, slow: true, coin: 8, boss: true, desc: 'この地の呪いの主。二手に一歩進む。ほどけば、残りの呪いもいっしょにほどける。結界に着かれたら負け。' },
    dummy: { name: 'わら人形', speed: 0, coin: 0, who: 'scarecrow', desc: '試し詠唱の的。動かない。' },
  };

  // ---------- 新しいゲーム ----------
  RR.newGame = function (seed) {
    return {
      v: 1, rs: (seed | 0) || 1, seed: seed | 0,
      stage: 0, phase: 'map',
      reels: [], mpMax: 3, mpRegen: 1,
      inv: [], coins: 0,
      rescued: 0, lost: 0, best: 0, bestBoard: 0,
      unlock: {}, results: {},
      b: null,
    };
  };

  // ---------- リール ----------
  RR.cellAt = function (reel, row, off) {
    const n = reel.strip.length;
    return reel.strip[(((reel.pos + (off || 0) + row) % n) + n) % n];
  };
  RR.idxAt = function (reel, row, off) {
    const n = reel.strip.length;
    return (((reel.pos + (off || 0) + row) % n) + n) % n;
  };
  // grid[c][r]：いま床に見えている紋。offs は各リールのずらし量。
  RR.gridOf = function (reels, offs) {
    return reels.map((rl, c) => [0, 1, 2].map(r => RR.cellAt(rl, r, offs ? offs[c] : 0)));
  };

  // ---------- つながり（クラスタ）の計算 ----------
  // 返り値：[{ el, cells:[[c,r]...], P, mult, gems:[[c,r]...] }]
  RR.clusters = function (grid) {
    const C = grid.length, out = [];
    const key = (c, r) => c * 8 + r;
    const nb = (c, r) => [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]].filter(([x, y]) => x >= 0 && x < C && y >= 0 && y < RR.ROWS);
    const starUsedAsLight = {};
    for (const el of RR.ELEMENTS) {
      const seen = {};
      for (let c = 0; c < C; c++) for (let r = 0; r < RR.ROWS; r++) {
        const t = grid[c][r].t;
        if (t !== el || seen[key(c, r)]) continue;
        // 幅優先でつながりを集める
        const cells = [], q = [[c, r]];
        seen[key(c, r)] = 1;
        while (q.length) {
          const [x, y] = q.shift();
          cells.push([x, y]);
          for (const [nx, ny] of nb(x, y)) {
            const nt = grid[nx][ny].t;
            if ((nt === el || nt === 'star') && !seen[key(nx, ny)]) { seen[key(nx, ny)] = 1; q.push([nx, ny]); }
          }
        }
        if (el === 'light') for (const [x, y] of cells) if (grid[x][y].t === 'star') starUsedAsLight[key(x, y)] = 1;
        out.push({ el: el, cells: cells });
      }
    }
    // 星だけのつながりは光として働く
    const seenS = {};
    for (let c = 0; c < C; c++) for (let r = 0; r < RR.ROWS; r++) {
      if (grid[c][r].t !== 'star' || starUsedAsLight[key(c, r)] || seenS[key(c, r)]) continue;
      const cells = [], q = [[c, r]];
      seenS[key(c, r)] = 1;
      while (q.length) {
        const [x, y] = q.shift();
        cells.push([x, y]);
        for (const [nx, ny] of nb(x, y)) if (grid[nx][ny].t === 'star' && !seenS[key(nx, ny)]) { seenS[key(nx, ny)] = 1; q.push([nx, ny]); }
      }
      out.push({ el: 'light', cells: cells, starOnly: true });
    }
    // 力と魔晶の倍率
    for (const cl of out) {
      cl.P = cl.cells.reduce((a, [x, y]) => a + grid[x][y].lv, 0);
      const inCl = {};
      for (const [x, y] of cl.cells) inCl[key(x, y)] = 1;
      const gems = {}, gl = [];
      for (const [x, y] of cl.cells) for (const [nx, ny] of nb(x, y)) {
        if (grid[nx][ny].t === 'gem' && !gems[key(nx, ny)]) { gems[key(nx, ny)] = 1; gl.push([nx, ny]); }
      }
      cl.gems = gl;
      cl.mult = gl.reduce((m, [x, y]) => m * (1 + grid[x][y].lv), 1);
      cl.power = cl.P * cl.mult;
      cl.dmg = cl.el === 'light' ? cl.power * 2 : cl.power;
    }
    // 大きいつながりほど後に（演出で最後に大きく見せる）
    out.sort((a, b) => a.dmg - b.dmg);
    return out;
  };

  // ---------- 盤面の魔物 ----------
  RR.monAt = function (b, c, r) {
    for (const m of b.mons) if (c >= m.c && c < m.c + m.w && r >= m.r && r < m.r + m.h) return m;
    return null;
  };
  RR.monCells = m => {
    const out = [];
    for (let x = 0; x < m.w; x++) for (let y = 0; y < m.h; y++) out.push([m.c + x, m.r + y]);
    return out;
  };
  RR.adjacentMons = function (b, m) {
    const set = new Set();
    for (const [x, y] of RR.monCells(m)) {
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (ny < 0 || ny >= RR.ROWS) continue;
        const o = RR.monAt(b, nx, ny);
        if (o && o !== m && o.c < b.R) set.add(o);
      }
    }
    return Array.from(set);
  };

  // ---------- 詠唱の結果を計算する（mutate しない） ----------
  // 返り値：{ clusters, hits:{id:[{ci,dmg,blocked,chain}]}, total:{id:dmg}, purified:[id], frozen:[id], chains:[{ci,from,to}] }
  RR.evaluate = function (b, reels, offs) {
    const grid = RR.gridOf(reels, offs);
    const cls = RR.clusters(grid);
    const hits = {}, total = {}, frozen = {}, chains = [];
    const addHit = (m, ci, dmg, chain) => {
      const blocked = m.armor && dmg < m.armor;
      (hits[m.id] || (hits[m.id] = [])).push({ ci: ci, dmg: dmg, blocked: !!blocked, chain: !!chain });
      if (!blocked) total[m.id] = (total[m.id] || 0) + dmg;
    };
    cls.forEach((cl, ci) => {
      const struck = new Set();
      for (const [x, y] of cl.cells) {
        const m = RR.monAt(b, x, y);
        if (m && !struck.has(m)) { struck.add(m); addHit(m, ci, cl.dmg, false); }
      }
      cl.struck = Array.from(struck).map(m => m.id);
      if (cl.el === 'ice') for (const m of struck) if (!(m.armor && cl.dmg < m.armor)) frozen[m.id] = 1;
      if (cl.el === 'bolt' && struck.size) {
        // くっついて並ぶ魔物へ跳ぶ
        const seen = new Set(struck), q = Array.from(struck);
        while (q.length) {
          const m = q.shift();
          for (const o of RR.adjacentMons(b, m)) {
            if (seen.has(o)) continue;
            seen.add(o); q.push(o);
            chains.push({ ci: ci, from: m.id, to: o.id });
            addHit(o, ci, cl.dmg, true);
          }
        }
      }
    });
    const purified = [];
    let bossDown = false;
    for (const m of b.mons) {
      if (m.c >= b.R) continue;
      if ((total[m.id] || 0) >= m.hp) { purified.push(m.id); if (m.boss) bossDown = true; }
    }
    return { grid: grid, clusters: cls, hits: hits, total: total, purified: purified, frozen: Object.keys(frozen).map(Number), chains: chains, bossDown: bossDown };
  };

  // ---------- 戦い ----------
  // def：{ reels(使う本数), waves:[[turn, kind, row, hp, opt]], boss:{...}, hearts }
  RR.startBattle = function (s, def, opts) {
    opts = opts || {};
    const R = Math.min(def.reels || s.reels.length, s.reels.length);
    const b = {
      def: def.id, R: R, turn: 0, hearts: def.hearts || 3, heartsMax: def.hearts || 3,
      mp: s.mpMax, mpMax: s.mpMax, mpRegen: s.mpRegen,
      mons: [], sched: [], nextId: 1, offs: new Array(R).fill(0), holds: new Array(R).fill(false),
      phase: 'spin', rescued: 0, lost: 0, rescuedWho: [], bestCast: 0, casts: 0, practice: !!opts.practice,
      over: null, log: [], finaleDef: def.finale || null, finale: null,
    };
    // 出現の予定。row が 'r' なら、同じ手番で重ならないように選ぶ
    const used = {};
    const waves = def.waves.slice().sort((a, b2) => a[0] - b2[0]);
    for (const w of waves) {
      const [turn, kind, row, hp, opt] = w;
      const base = RR.MON[kind];
      const h = (opt && opt.h) || (base.boss ? 2 : 1), wd = (opt && opt.w) || (base.boss ? 2 : 1);
      let r = row;
      const u = used[turn] || (used[turn] = []);
      if (r === 'r' || r === undefined) {
        const free = [];
        for (let y = 0; y + h <= RR.ROWS; y++) {
          let ok = true;
          for (let k = 0; k < h; k++) if (u.indexOf(y + k) >= 0) ok = false;
          if (ok) free.push(y);
        }
        r = free.length ? RR.pick(s, free) : RR.randInt(s, RR.ROWS - h + 1);
      }
      for (let k = 0; k < h; k++) u.push(r + k);
      b.sched.push({ turn: turn, kind: kind, r: r, hp: Math.round(hp * (def.hpMul || 1)), w: wd, h: h, opt: opt || {} });
    }
    s.b = b;
    // 出現：手番 T の魔物は、手番 T のはじめに床の右端へ入る。その一手前から「接近の列」に見えている。
    // 手番0の魔物は、はじめから床の右端に立っている
    RR.spawn(s, 0, true);
    RR.spawn(s, 1, false);
    return b;
  };

  RR.makeMon = function (b, e, col) {
    const base = RR.MON[e.kind];
    const m = {
      id: b.nextId++, k: e.kind, c: col, r: e.r, w: e.w, h: e.h,
      hp: e.hp, max: e.hp, armor: e.opt.armor || 0, frozen: 0, tick: 0,
      boss: !!base.boss, who: e.opt.who || base.who, name: e.opt.name || base.name,
      speed: e.opt.speed || base.speed, slow: e.opt.slow !== undefined ? e.opt.slow : !!base.slow,
    };
    return m;
  };

  // turn の予定を出す。inField なら床の右端、そうでなければ接近の列（R）に置く
  RR.spawn = function (s, turn, inField) {
    const b = s.b, out = [];
    const keep = [];
    for (const e of b.sched) {
      if (e.turn > turn) { keep.push(e); continue; }
      const col = inField ? b.R - e.w : b.R;
      let free = true;
      for (let x = 0; x < e.w; x++) for (let y = 0; y < e.h; y++) if (RR.monAt(b, col + x, e.r + y)) free = false;
      if (!free) { keep.push(e); continue; } // 空くまで待つ（次の呼び出しでもう一度）
      const m = RR.makeMon(b, e, col);
      b.mons.push(m); out.push(m);
    }
    b.sched = keep;
    return out;
  };

  RR.mpUsed = b => b.offs.reduce((a, o) => a + Math.abs(o), 0);
  RR.mpLeft = b => b.mp - RR.mpUsed(b);

  // 固定の切り替え（回す前だけ）。固定は回すときに魔力を1使う
  RR.toggleHold = function (s, c) {
    const b = s.b;
    if (b.phase !== 'spin' || c >= b.R) return false;
    if (!b.holds[c]) {
      const n = b.holds.filter(Boolean).length;
      if (n + 1 >= b.R) return false; // 全部は固定できない
      if (b.mp - n < 1) return false;
    }
    b.holds[c] = !b.holds[c];
    return true;
  };

  RR.spin = function (s, forced) {
    const b = s.b;
    if (b.phase !== 'spin') return null;
    const spun = [];
    for (let c = 0; c < b.R; c++) {
      if (b.holds[c]) { b.mp--; continue; }
      const rl = s.reels[c];
      rl.pos = forced && forced[c] !== undefined && forced[c] !== null ? forced[c] : RR.randInt(s, rl.strip.length);
      spun.push(c);
    }
    b.holds = new Array(b.R).fill(false);
    b.offs = new Array(b.R).fill(0);
    b.phase = 'aim';
    return spun;
  };

  // ずらし：d = +1 で床が上へ（下にあった紋が見えてくる）、-1 で下へ
  RR.shift = function (s, c, d) {
    const b = s.b;
    if (b.phase !== 'aim' || c >= b.R) return false;
    const cur = b.offs[c], nxt = cur + d;
    const cost = Math.abs(nxt) - Math.abs(cur);
    if (cost > 0 && RR.mpLeft(b) < cost) return false;
    b.offs[c] = nxt;
    return true;
  };
  RR.resetShift = function (s) { s.b.offs = new Array(s.b.R).fill(0); };

  RR.preview = function (s) {
    const b = s.b;
    return RR.evaluate(b, s.reels.slice(0, b.R), b.offs);
  };

  // 詠唱：ずらしを確定し、呪いをほどく。演出用の結果を返す
  RR.cast = function (s) {
    const b = s.b;
    if (b.phase !== 'aim') return null;
    const res = RR.evaluate(b, s.reels.slice(0, b.R), b.offs);
    b.mp -= RR.mpUsed(b);
    for (let c = 0; c < b.R; c++) {
      const rl = s.reels[c], n = rl.strip.length;
      rl.pos = (((rl.pos + b.offs[c]) % n) + n) % n;
    }
    res.usedMp = RR.mpUsed(b);
    b.offs = new Array(b.R).fill(0);
    // 呪いを減らす
    for (const m of b.mons) {
      const d = res.total[m.id] || 0;
      if (d > 0) m.hp = Math.max(0, m.hp - d);
    }
    for (const id of res.frozen) { const m = b.mons.find(x => x.id === id); if (m && m.hp > 0) m.frozen = 1; }
    let freed = b.mons.filter(m => res.purified.indexOf(m.id) >= 0);
    res.after = [];
    if (res.bossDown) {
      // 主の呪いがほどけると、残りの呪いもほどける
      const rest = b.mons.filter(m => freed.indexOf(m) < 0);
      res.after = rest.map(m => m.id);
      freed = freed.concat(rest);
      b.sched = [];
      if (b.finaleDef && !b.finale) { b.finale = { idx: 0, casts: b.finaleDef.casts, rescued: 0, best: 0 }; res.finaleStart = true; }
    } else if (b.finale) {
      b.finale.rescued += freed.length;
      if (freed.length > b.finale.best) b.finale.best = freed.length;
      b.finale.idx++;
      res.finaleCast = b.finale.idx;
    }
    const freedWho = freed.map(m => ({ id: m.id, who: m.who, k: m.k, boss: m.boss, c: m.c, r: m.r, w: m.w, h: m.h, name: m.name }));
    b.mons = b.mons.filter(m => freed.indexOf(m) < 0);
    let coins = 0;
    for (const m of freed) coins += RR.MON[m.k].coin;
    b.rescued += freed.length;
    b.rescuedWho = b.rescuedWho.concat(freedWho.map(f => f.who));
    b.coins = (b.coins || 0) + coins;
    b.casts++;
    const n = freedWho.length;
    if (n > b.bestCast) b.bestCast = n;
    res.freed = freedWho; res.coins = coins;
    res.totalDmg = Object.values(res.total).reduce((a, v) => a + v, 0);
    b.phase = 'advance';
    if (b.finale) {
      if (b.finale.idx >= b.finale.casts) { b.over = 'win'; b.phase = 'over'; }
    } else if (!b.mons.length && !b.sched.length) { b.over = 'win'; b.phase = 'over'; }
    return res;
  };

  // 最後の大詠唱：床のすべてのマスに、呪われた人々が押し寄せる（動かない）
  RR.FINALE_KINDS = ['imp', 'wisp', 'knight', 'imp', 'wisp', 'golem'];
  RR.fillFinale = function (s) {
    const b = s.b, out = [];
    const hp = b.finaleDef.hp[Math.min(b.finale.idx, b.finaleDef.hp.length - 1)];
    let i = 0;
    for (let c = 0; c < b.R; c++) for (let r = 0; r < RR.ROWS; r++) {
      if (RR.monAt(b, c, r)) continue;
      const kind = RR.FINALE_KINDS[(c * 3 + r + b.finale.idx * 2) % RR.FINALE_KINDS.length];
      const m = RR.makeMon(b, { kind: kind, r: r, hp: hp + ((c + r) % 3) * 2, w: 1, h: 1, opt: { speed: 0, slow: false } }, c);
      m.finale = true;
      b.mons.push(m); out.push(m); i++;
    }
    return out;
  };

  // 魔物が進み、新しい魔物が現れる
  RR.advance = function (s) {
    const b = s.b;
    if (b.phase !== 'advance') return null;
    if (b.finale) {
      // 大詠唱のあいだは、魔物は動かず、空いたマスに次の人々が押し寄せる
      b.turn++;
      const spawnedF = RR.fillFinale(s);
      b.mp = b.mpMax + (b.finaleDef.mpBonus || 0);
      b.phase = 'spin';
      return { moves: [], exits: [], spawned: spawnedF.map(m => m.id), bossOut: false, thawed: [], finale: true };
    }
    const moves = [], exits = [], thawed = [];
    const order = b.mons.slice().sort((a, b2) => a.c - b2.c);
    for (const m of order) {
      if (m.frozen > 0) { m.frozen--; thawed.push(m.id); continue; }
      if (m.slow) { m.tick = (m.tick || 0) + 1; if (m.tick % 2 === 1) { moves.push({ id: m.id, from: m.c, to: m.c, wait: true }); continue; } }
      const from = m.c;
      for (let st = 0; st < m.speed; st++) {
        const nc = m.c - 1;
        if (nc < 0) { exits.push(m); break; }
        let free = true;
        for (let y = 0; y < m.h; y++) { const o = RR.monAt(b, nc, m.r + y); if (o && o !== m) free = false; }
        if (!free) break;
        m.c = nc;
      }
      moves.push({ id: m.id, from: from, to: m.c, exit: exits.indexOf(m) >= 0 });
    }
    let bossOut = false;
    for (const m of exits) {
      if (m.boss) { bossOut = true; b.hearts = 0; } else b.hearts = Math.max(0, b.hearts - 1);
      b.lost++;
    }
    const exitInfo = exits.map(m => ({ id: m.id, r: m.r, h: m.h, boss: m.boss, who: m.who, k: m.k }));
    b.mons = b.mons.filter(m => exits.indexOf(m) < 0);
    b.turn++;
    const spawned = b.practice ? [] : RR.spawn(s, b.turn + 1, false);
    b.mp = Math.min(b.mpMax, b.mp + b.mpRegen);
    b.phase = 'spin';
    if (b.hearts <= 0 && !b.practice) { b.over = 'lose'; b.phase = 'over'; }
    else if (!b.mons.length && !b.sched.length) { b.over = 'win'; b.phase = 'over'; }
    return { moves: moves, exits: exitInfo, spawned: spawned.map(m => m.id), bossOut: bossOut, thawed: thawed };
  };

  // ---------- ずらしの探索（ボット・ヒント・教え用） ----------
  // 魔物の危険度：床の左端に近いほど、足が速いほど高い
  RR.threat = function (b, m) {
    if (m.c >= b.R) return 0;
    const steps = m.frozen ? 99 : Math.ceil((m.c + 1) / (m.speed * (m.slow ? 0.5 : 1)));
    return steps;
  };
  RR.scoreResult = function (b, res, mpUsed) {
    let sc = 0;
    for (const m of b.mons) {
      if (m.c >= b.R) continue;
      const d = Math.min(res.total[m.id] || 0, m.hp);
      const steps = RR.threat(b, m);
      const urgent = steps <= 1 ? 3 : steps <= 2 ? 1.6 : 1;
      if (res.purified.indexOf(m.id) >= 0) sc += (m.boss ? 400 : 30) * urgent;
      else {
        sc += d * (m.boss ? 1.6 : 1) * urgent;
        if (res.frozen.indexOf(m.id) >= 0 && !m.frozen) sc += (steps <= 1 ? 45 : steps <= 2 ? 10 : 3) * (m.boss ? 3 : 1);
      }
    }
    if (res.bossDown) sc += 300;
    return sc - mpUsed * 2.5;
  };
  // すべてのずらしの組み合わせ（魔力の範囲）から最善を探す
  RR.bestShift = function (s, opt) {
    opt = opt || {};
    const b = s.b, R = b.R, budget = opt.budget !== undefined ? opt.budget : b.mp;
    const maxOff = Math.min(budget, opt.maxOff || 3);
    let best = null;
    const offs = new Array(R).fill(0);
    const reels = s.reels.slice(0, R);
    const rec = (c, left) => {
      if (c === R) {
        const res = RR.evaluate(b, reels, offs);
        const used = offs.reduce((a, o) => a + Math.abs(o), 0);
        const sc = (opt.score || RR.scoreResult)(b, res, used);
        if (!best || sc > best.score + 1e-9) best = { score: sc, offs: offs.slice(), res: res, used: used };
        return;
      }
      for (let o = -maxOff; o <= maxOff; o++) {
        if (Math.abs(o) > left) continue;
        offs[c] = o;
        rec(c + 1, left - Math.abs(o));
      }
      offs[c] = 0;
    };
    rec(0, budget);
    return best;
  };

  // ---------- 工房 ----------
  RR.place = function (s, invIdx, reel, idx) {
    const it = s.inv[invIdx];
    if (!it || !s.reels[reel]) return false;
    const old = s.reels[reel].strip[idx];
    s.reels[reel].strip[idx] = { t: it.t, lv: it.lv, fresh: true };
    s.inv.splice(invIdx, 1);
    if (old.t !== 'blank') s.inv.push({ t: old.t, lv: old.lv });
    return true;
  };
  RR.takeOut = function (s, reel, idx) {
    const old = s.reels[reel].strip[idx];
    if (!old || old.t === 'blank') return false;
    s.inv.push({ t: old.t, lv: old.lv });
    s.reels[reel].strip[idx] = RR.cell('blank');
    return true;
  };
  RR.swapCells = function (s, r1, i1, r2, i2) {
    const a = s.reels[r1].strip[i1], b2 = s.reels[r2].strip[i2];
    s.reels[r1].strip[i1] = b2; s.reels[r2].strip[i2] = a;
    if (a.t !== 'blank') a.fresh = true;
    if (b2.t !== 'blank') b2.fresh = true;
    return true;
  };
  RR.clearFresh = function (s) { for (const r of s.reels) for (const c of r.strip) delete c.fresh; };
  RR.upgradeCost = lv => lv === 1 ? 6 : lv === 2 ? 12 : null;

  if (typeof module !== 'undefined' && module.exports) module.exports = RR;
  else root.RR = RR;
})(this);
