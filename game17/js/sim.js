// ずらり、砦くずし — ルール本体（描画や音に依存しない。ブラウザでは window.ZR、node では module.exports）
(function (root) {
  'use strict';
  const Z = {};
  Z.LANES = 3;
  Z.COLS = 7;        // 0 が陣のすぐ前、6 が砦のすぐ前
  Z.PART_COL = 7;    // 砦の各部は、道のいちばん奥（列7）にいるものとして扱う
  Z.STRIP = 8;       // リール1本のコマ数

  // ---------- 乱数（状態に種を持たせ、保存・再現できるようにする） ----------
  Z.rand = function (s) {
    s.rs = (s.rs + 0x6D2B79F5) | 0;
    let t = s.rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Z.ri = (s, n) => Math.floor(Z.rand(s) * n);
  const clone = o => JSON.parse(JSON.stringify(o));
  Z.clone = clone;
  // 見こみ用の写し：リールの並び（strip）は共有し、位置だけ写す
  const shadow = s => ({ reels: s.reels.map(r => ({ role: r.role, strip: r.strip, pos: r.pos })), b: clone(s.b), rs: 0 });
  Z.shadow = shadow;

  // ---------- 詠唱盤の役割 ----------
  // リールは左から「源（なにで）」「形（どう撃つ）」「力（何倍）」「力」「響（どこへ）」。
  // 横一行がそのまま一つの呪文になり、その行の道へ放たれる。
  Z.ROLE = {
    src: { name: '源', sub: 'なにで' },
    shape: { name: '形', sub: 'どう撃つ' },
    pow: { name: '力', sub: '何倍' },
    echo: { name: '響', sub: 'どこへも' },
  };
  Z.REEL_ROLES = ['src', 'shape', 'pow', 'pow', 'echo'];

  Z.W = {
    // 源：呪文の素の力
    sword: { role: 'src', name: '剣', glyph: '剣', base: [2, 4, 6], desc: '鋼の力。素直で、どこにでも効く。' },
    fire: { role: 'src', name: '炎', glyph: '炎', base: [3, 5, 8], desc: 'いちばん強い力。' },
    ice: { role: 'src', name: '氷', glyph: '氷', base: [2, 3, 5], freeze: true, desc: '当てた魔物を凍らせる（次の手番は動かない）。凍った砦は、次の手番に魔物を出さない。' },
    bolt: { role: 'src', name: '雷', glyph: '雷', base: [2, 4, 6], noShield: true, desc: '盾をすり抜ける（盾兵にも半分にされない）。' },
    light: { role: 'src', name: '光', glyph: '光', base: [2, 3, 5], siege: 2, desc: '砦に2倍の力。' },
    // 形：放ち方
    gap: { role: 'shape', name: '空き', glyph: '', blank: true, desc: '形がないので、この行は呪文にならない。' },
    point: { role: 'shape', name: '一点', glyph: '点', desc: 'いちばん手前の一体に、力の2倍。' },
    lance: { role: 'shape', name: '貫く', glyph: '貫', desc: '道をまっすぐ貫く。倒した相手の体力ぶん力が減り、残りは奥へ。砦まで届く。' },
    sweep: { role: 'shape', name: 'なぎ払い', glyph: '薙', desc: '三本の道それぞれの、いちばん手前に力そのまま。' },
    burst: { role: 'shape', name: 'はじける', glyph: '爆', desc: '手前の一体と、そのまわり八方（となりの道も）に力そのまま。' },
    storm: { role: 'shape', name: 'あらし', glyph: '嵐', desc: '戦場のすべて（砦も）に、力の半分。' },
    // 力：倍率と回数
    p1: { role: 'pow', name: 'なし', glyph: '・', mul: 1, blank: true, desc: '何もしない。' },
    x2: { role: 'pow', name: '二倍', glyph: '×2', mul: 2, desc: '力を2倍にする。' },
    x3: { role: 'pow', name: '三倍', glyph: '×3', mul: 3, desc: '力を3倍にする。' },
    twice: { role: 'pow', name: '二度', glyph: '再', mul: 1, casts: 1, desc: '同じ呪文をもう一度放つ。' },
    // 響：ほかの道へも
    e0: { role: 'echo', name: 'なし', glyph: '・', dirs: [], blank: true, desc: '何もしない。' },
    up: { role: 'echo', name: '上へ', glyph: '↑', dirs: [-1], desc: 'この行の呪文を、ひとつ上の道でも放つ。' },
    down: { role: 'echo', name: '下へ', glyph: '↓', dirs: [1], desc: 'この行の呪文を、ひとつ下の道でも放つ。' },
    all: { role: 'echo', name: '三道', glyph: '三', dirs: [-2, -1, 1, 2], desc: 'この行の呪文を、ほかの二本の道でも放つ。' },
  };
  Z.wd = (k, lv) => ({ k: k, lv: lv || 1 });
  Z.isUpgradable = w => Z.W[w.k].role === 'src' && w.lv < 3;

  // ---------- 魔王軍 ----------
  Z.EN = {
    gob: { name: '小鬼', hp: 1, spd: 1, dmg: 1, gold: 1, desc: '一歩ずつ陣へ歩いてくる。' },
    wolf: { name: '黒狼', hp: 2, spd: 2, dmg: 1, gold: 1, desc: '一度に二歩進む。凍らせると止まる。' },
    shield: { name: '盾兵', hp: 4, spd: 1, dmg: 1, gold: 2, shield: true, desc: '大盾で「一点」「貫く」を半分に受ける。上やわきからの攻撃（なぎ払い・はじける・あらし）と雷には効かない。' },
    archer: { name: '弓兵', hp: 2, spd: 1, dmg: 1, gold: 2, archer: 4, every: 2, desc: '道の中ほどで止まり、二手番ごとに陣へ矢を射る。' },
    ogre: { name: '大鬼', hp: 12, spd: 1, dmg: 3, gold: 3, slow: true, desc: '体力が多い。二手番に一歩だけ進む。陣に着くと守りを3削る。' },
    knight: { name: '黒騎士', hp: 18, spd: 1, dmg: 3, gold: 3, slow: true, shield: true, desc: '魔王の近衛。大盾を持ち、体力も多い。二手番に一歩。' },
    dummy: { name: 'わら人形', hp: 1, spd: 0, dmg: 0, gold: 0, dummy: true, desc: '試し撃ちの的。' },
  };

  // ---------- 戦いの定義 ----------
  // parts: 道ごとの砦の一部。spawn: { every, off, list } off手番目の終わりから every手番ごとに、list の守備兵を順に出す。
  // 守備兵は数が決まっていて、砦が崩れると残りは逃げ出す（そのぶんの金貨も手に入る）。
  // 守備兵の並びは一文字ずつ：g=小鬼 w=黒狼 s=盾兵 a=弓兵 o=大鬼 k=黒騎士
  const GL = { g: 'gob', w: 'wolf', s: 'shield', a: 'archer', o: 'ogre', k: 'knight' };
  const gar = (every, off, str) => ({ every: every, off: off, list: str.split('').map(c => GL[c]) });
  const st = str => str.split(' ').map(x => [+x[0], +x[1], GL[x[2]]]);
  Z.STAGES = [
    {
      id: 'watch', name: '国境の見張り砦', sub: 'はじめての砦。一行がひとつの呪文になり、その道へ飛ぶ。',
      parts: [{ n: '北の物見', hp: 10 }, { n: '砦門', hp: 12 }, { n: '南の物見', hp: 10 }],
      start: st('04g 13g 25g'),
      spawn: [gar(3, 2, 'gg'), gar(2, 1, 'ggg'), gar(3, 3, 'gg')],
      script: 'watch',
    },
    {
      id: 'river', name: '渡し場の砦', sub: '櫓の大矢が、数手番ごとに陣を撃つ。大盾の兵は正面からの「一点」「貫く」を半分に受ける。',
      parts: [{ n: '北の櫓', hp: 14, shot: [5, 1] }, { n: '水門', hp: 20 }, { n: '南の櫓', hp: 14, shot: [5, 1] }],
      start: st('02g 04g 13s 23g 25g'),
      spawn: [gar(2, 1, 'ggsg'), gar(2, 2, 'sggs'), gar(2, 1, 'gsgg')],
      script: 'teach',
    },
    {
      id: 'forest', hpMul: 1.3, name: '黒い森の砦', sub: '黒狼は一度に二歩。凍らせれば止まる。',
      parts: [{ n: '北の見張り台', hp: 24, shot: [4, 1] }, { n: '丸太の門', hp: 34, shot: [5, 1] }, { n: '南の見張り台', hp: 24, shot: [4, 1] }],
      start: st('03w 05g 14g 16s 22g 24w'),
      spawn: [gar(2, 1, 'wgwggwg'), gar(1, 1, 'gsgwgsgg'), gar(2, 2, 'gwgwggw')],
    },
    {
      id: 'hill', hpMul: 1.8, name: '風の丘の砦', sub: '弓兵は道の中ほどで止まり、矢を射てくる。奥まで届く呪文で。',
      parts: [{ n: '北の弓塔', hp: 54, shot: [4, 1] }, { n: '石の門', hp: 72, shot: [5, 1] }, { n: '南の弓塔', hp: 54, shot: [4, 1] }],
      start: st('03g 05a 12s 14g 16a 23w 25g'),
      spawn: [gar(1, 1, 'aggwgagg'), gar(1, 1, 'sgagsgag'), gar(1, 2, 'wagggwag')],
    },
    {
      id: 'iron', hpMul: 2.5, name: '鉄の谷の砦', sub: '大鬼が来る。体力が多く、陣に着くと守りを3削る。',
      parts: [{ n: '北の鉄塔', hp: 140, shot: [4, 1] }, { n: '鉄の門', hp: 180, shot: [4, 2] }, { n: '南の鉄塔', hp: 140, shot: [4, 1] }],
      start: st('02g 03g 04o 13s 15g 16a 23g 25o'),
      spawn: [gar(1, 1, 'gwoggwgogg'), gar(1, 1, 'sagogsgaog'), gar(1, 2, 'wgoggwgogw')],
    },
    {
      id: 'citadel', hpMul: 3.5, name: '黒鉄の城', sub: '魔王の城。黒騎士が守る。',
      parts: [{ n: '北の大塔', hp: 300, shot: [3, 1] }, { n: '黒鉄の大門', hp: 420, shot: [4, 2] }, { n: '南の大塔', hp: 300, shot: [3, 1] }],
      start: st('02g 03g 05k 12s 14o 16a 22w 24g 25k'),
      spawn: [gar(1, 1, 'gwkgagwgkgga'), gar(1, 1, 'sgoakgsgogkgga'), gar(1, 2, 'wgkgogwgkggw')],
    },
    {
      id: 'army', name: '魔王の大軍勢', sub: '城が落ち、魔王が残りの軍勢を呼び集めた。詠唱は三度。',
      army: true, casts: 3,
      parts: [{ n: '北の軍旗', hp: 200 }, { n: '魔王', hp: 640 }, { n: '南の軍旗', hp: 200 }],
    },
  ];
  Z.FINAL = Z.STAGES.length - 1;

  // 勝ったあとにもらえるもの
  Z.REWARD = [
    { gold: 4, person: 'scholar', fixed: [{ k: 'lance' }], gifts: [['fire'], ['x2'], ['ice']], shop: ['fire', 'ice', 'x2', 'lance', 'sweep'] },
    { gold: 5, person: 'smith', reel: true, gifts: [['bolt'], ['x2'], ['sweep']], shop: ['bolt', 'up1'] },
    { gold: 6, person: 'priest', mana: 1, gifts: [['light'], ['burst'], ['x3']], shop: ['light', 'burst', 'x3', 'up2'] },
    { gold: 6, person: 'clock', reel: true, gifts: [['all'], ['x3'], ['storm']], shop: ['twice', 'up', 'down', 'storm'] },
    { gold: 8, person: 'knights', guard: 1, mana: 1, gifts: [['all'], ['x3'], ['burst']], shop: [] },
    { gold: 0, person: 'queen' },
  ];
  Z.PRICE = { fire: 6, ice: 5, bolt: 6, light: 6, lance: 7, sweep: 6, burst: 9, storm: 14, x2: 7, x3: 12, twice: 10, up: 8, down: 8, all: 18, up1: 6, up2: 10 };

  // ---------- ゲーム開始 ----------
  const strip = keys => keys.map(k => Z.wd(k));
  Z.newGame = function (seed) {
    return {
      v: 1, rs: seed | 0, seed: seed | 0, stage: 0, gold: 0, maxMana: 2, guardMax: 5,
      reels: [
        { role: 'src', strip: strip(['sword', 'fire', 'sword', 'sword', 'fire', 'sword', 'sword', 'fire']), pos: 0 },
        { role: 'shape', strip: strip(['point', 'point', 'point', 'gap', 'point', 'gap', 'point', 'gap']), pos: 0 },
        { role: 'pow', strip: strip(['p1', 'p1', 'x2', 'p1', 'p1', 'p1', 'x2', 'p1']), pos: 0 },
      ],
      inv: [], shop: [], bought: {}, people: [], gift: null,
      best: [], turns: 0, losses: 0, cleared: false, b: null,
    };
  };

  // ---------- リール ----------
  const mod = (a, n) => ((a % n) + n) % n;
  Z.offOf = (s, i) => (s.b && s.b.offs[i]) || 0;
  Z.wordAt = function (s, i, row) {
    const r = s.reels[i];
    return r.strip[mod(r.pos + Z.offOf(s, i) + row, r.strip.length)];
  };
  Z.slotAt = (s, i, row) => mod(s.reels[i].pos + Z.offOf(s, i) + row, s.reels[i].strip.length);
  Z.manaUsed = s => s.b.offs.reduce((a, o) => a + Math.abs(o), 0);
  Z.manaLeft = s => s.b.mana - Z.manaUsed(s);

  // ---------- 戦い ----------
  function mkEnemy(b, lane, col, t, hpMul) {
    const d = Z.EN[t];
    const hp = Math.max(1, Math.round(d.hp * (hpMul || 1)));
    const e = { id: b.nextId++, t: t, lane: lane, col: col, hp: hp, max: hp, frz: 0, rest: false, cd: d.archer ? 1 : 0 };
    b.en.push(e);
    return e;
  }
  Z.mkEnemy = mkEnemy;

  Z.startBattle = function (s, idx) {
    const def = Z.STAGES[idx];
    const b = {
      stage: idx, turn: 1, mana: s.maxMana, guard: s.guardMax, guardMax: s.guardMax,
      en: [], parts: [], nextId: 1, offs: s.reels.map(() => 0), phase: 'spin',
      kills: 0, gold: 0, bestKills: 0, bestDmg: 0, casts: 0, lastSpin: null, over: null,
      army: !!def.army, castsLeft: def.casts || 0, scriptStep: 0, script: def.script || null,
    };
    s.b = b;
    def.parts.forEach((p, lane) => {
      b.parts.push({ lane: lane, n: p.n, hp: p.hp, max: p.hp, frz: 0, dead: false, queue: [], made: 0, shot: p.shot ? p.shot.slice() : null, cd: p.shot ? p.shot[0] : 0 });
    });
    // 前に退却したときの砦の傷は残る
    if (s.siege && s.siege.stage === idx) {
      b.parts.forEach((p, i) => { p.hp = Math.min(p.max, s.siege.hp[i]); if (p.hp <= 0) { p.hp = 0; p.dead = true; } });
      b.scarred = true;
      // 退却するたびに援軍が来て、陣の守りが増える（その砦のあいだ、最大+3）
      b.reinforce = Math.min(3, s.siege.tries || 0);
      b.guard += b.reinforce; b.guardMax += b.reinforce;
    }
    if (def.army) Z.fillArmy(s);
    else for (const [lane, col, t] of def.start) mkEnemy(b, lane, col, t, def.hpMul);
    return b;
  };

  // 大軍勢：空いたマスを、奥から順に埋める（毎回の詠唱のあと、次々と押し寄せる）
  const ARMY_MIX = ['gob', 'gob', 'wolf', 'shield', 'gob', 'archer', 'ogre', 'gob', 'wolf', 'knight', 'shield', 'gob'];
  Z.fillArmy = function (s) {
    const b = s.b;
    let k = b.armyK || 0;
    for (let col = 0; col < Z.COLS; col++) {
      for (let lane = 0; lane < Z.LANES; lane++) {
        if (b.parts[lane] && b.parts[lane].dead) continue;
        if (enemyAt(b, lane, col)) continue;
        const t = ARMY_MIX[(k * 7 + lane * 3 + col) % ARMY_MIX.length];
        mkEnemy(b, lane, col, t, 2);
        k++;
      }
    }
    b.armyK = k;
  };

  // 試し撃ち：わら人形と木の的
  Z.startPractice = function (s) {
    const b = {
      stage: -1, practice: true, turn: 1, mana: s.maxMana, guard: 9, guardMax: 9,
      en: [], parts: [], nextId: 1, offs: s.reels.map(() => 0), phase: 'spin',
      kills: 0, gold: 0, bestKills: 0, bestDmg: 0, casts: 0, lastSpin: null, over: null,
    };
    s.b = b;
    for (let lane = 0; lane < 3; lane++) b.parts.push({ lane: lane, n: '木の的', hp: 999, max: 999, frz: 0, dead: false, queue: [], made: 0, wood: true });
    Z.resetDummies(s);
    return b;
  };
  Z.DUMMY_POS = [[0, 1], [0, 2], [0, 4], [1, 2], [1, 3], [1, 4], [1, 6], [2, 1], [2, 3], [2, 5]];
  Z.resetDummies = function (s) {
    const b = s.b;
    b.en = [];
    for (const [lane, col] of Z.DUMMY_POS) mkEnemy(b, lane, col, 'dummy');
    for (const p of b.parts) { p.hp = p.max; p.dead = false; p.frz = 0; }
  };

  function enemyAt(b, lane, col) {
    for (const e of b.en) if (e.lane === lane && e.col === col && e.hp > 0) return e;
    return null;
  }
  Z.enemyAt = enemyAt;

  // 回す：pos を指定しなければ乱数で止める
  Z.spin = function (s, pos) {
    const b = s.b;
    if (b.phase !== 'spin' || b.over) return false;
    s.reels.forEach((r, i) => {
      r.pos = pos ? mod(pos[i], r.strip.length) : Z.ri(s, r.strip.length);
    });
    b.offs = s.reels.map(() => 0);
    b.lastSpin = s.reels.map(r => r.pos);
    b.phase = 'aim';
    return true;
  };

  // ずらす：dir=+1 で ▲（リールが上へ動き、下から次のコマが入る）、-1 で ▼
  Z.canShift = function (s, i, dir) {
    const b = s.b;
    if (!b || b.phase !== 'aim' || b.over || i >= s.reels.length) return false;
    const o = b.offs[i] + dir;
    if (Math.abs(o) > 3) return false;
    const used = Z.manaUsed(s) - Math.abs(b.offs[i]) + Math.abs(o);
    return used <= b.mana;
  };
  Z.shift = function (s, i, dir) {
    if (!Z.canShift(s, i, dir)) return false;
    s.b.offs[i] += dir;
    return true;
  };
  Z.resetShift = function (s) { if (s.b) s.b.offs = s.reels.map(() => 0); };

  // ---------- 行の呪文 ----------
  Z.rowSpell = function (s, row) {
    const n = s.reels.length;
    const src = Z.wordAt(s, 0, row), shape = Z.wordAt(s, 1, row);
    const sw = Z.W[src.k];
    let mul = 1, casts = 1;
    const pows = [];
    for (let i = 2; i < Math.min(n, 4); i++) {
      const w = Z.wordAt(s, i, row);
      pows.push(w);
      mul *= Z.W[w.k].mul;
      casts += Z.W[w.k].casts || 0;
    }
    const echo = n >= 5 ? Z.wordAt(s, 4, row) : null;
    const dirs = echo ? Z.W[echo.k].dirs : [];
    const base = sw.base[src.lv - 1];
    const lanes = [row];
    for (const d of dirs) { const l = row + d; if (l >= 0 && l < Z.LANES) lanes.push(l); }
    const dead = shape.k === 'gap';
    return { row: row, src: src.k, lv: src.lv, shape: shape.k, base: base, mul: mul, power: dead ? 0 : base * mul, casts: casts, lanes: dead ? [] : lanes, pows: pows, echo: echo ? echo.k : null, dead: dead };
  };

  // ---------- 呪文を放つ ----------
  function targetsInLane(b, lane) {
    const list = b.en.filter(e => e.lane === lane && e.hp > 0).sort((a, c) => a.col - c.col);
    const p = b.parts[lane];
    if (p && !p.dead) list.push(p);
    return list;
  }
  Z.targetsInLane = targetsInLane;
  const isPart = t => t.n !== undefined;
  const tid = t => (isPart(t) ? 'p' + t.lane : t.id);
  const tcol = t => (isPart(t) ? Z.PART_COL : t.col);

  // 一つの相手に力を当てる。front は正面からの攻撃（盾が効く）
  function hit(b, t, amount, sp, front, fire, ctx) {
    const sw = Z.W[sp.src];
    let d = amount;
    if (isPart(t) && sw.siege) d *= sw.siege;
    if (!isPart(t) && front && Z.EN[t.t].shield && !sw.noShield) d = Math.floor(d / 2);
    if (d <= 0) { fire.hits.push({ id: tid(t), lane: t.lane, col: tcol(t), dmg: 0, kill: false, block: true }); return 0; }
    const dealt = Math.min(d, t.hp);
    t.hp -= dealt;
    const h = { id: tid(t), lane: t.lane, col: tcol(t), dmg: dealt, kill: t.hp <= 0 };
    if (sw.freeze && t.hp > 0) { t.frz = 1; h.frz = true; }
    fire.hits.push(h);
    if (isPart(t)) {
      ctx.partDmg += dealt;
      if (t.hp <= 0) partDown(b, t, fire, ctx);
    } else if (t.hp <= 0) {
      ctx.kills++;
      ctx.gold += Z.EN[t.t].gold;
    }
    return dealt;
  }

  function partDown(b, p, fire, ctx) {
    const inside = b.practice || b.army ? [] : Z.garrisonLeft(b, p.lane);
    p.dead = true; p.hp = 0;
    fire.downs.push(p.lane);
    ctx.downs++;
    ctx.gold += b.army || b.practice ? 0 : 3;
    // その道の魔物と、砦の中に残っていた守備兵は逃げ出す（大軍勢では、魔王が倒れると全軍が退く）
    if (b.practice) return;
    const fl = [];
    const lord = b.army && p.lane === 1;
    if (lord) { b.lordDown = true; fire.lord = true; }
    for (const e of b.en) {
      if ((lord || e.lane === p.lane) && e.hp > 0) { fl.push(e.id); ctx.gold += Z.EN[e.t].gold; ctx.fled++; e.hp = 0; e.fled = true; }
    }
    if (lord) for (const q of b.parts) if (!q.dead) { q.dead = true; q.hp = 0; fire.downs.push(q.lane); }
    if (fl.length) fire.flee.push(...fl);
    for (const t of inside) { ctx.gold += Z.EN[t].gold; ctx.fled++; }
    fire.inside = (fire.inside || 0) + inside.length;
    p.queue = []; p.made = 1e9;
  }
  // 砦の中に残っている守備兵（まだ出ていない者）
  Z.garrisonLeft = function (b, lane) {
    const p = b.parts[lane];
    const def = Z.STAGES[b.stage];
    if (!p || p.dead || !def || !def.spawn) return p && !p.dead ? p.queue.slice() : [];
    const sp = def.spawn[lane];
    return p.queue.concat(sp.list.slice(Math.min(p.made, sp.list.length)));
  };

  function castShape(b, sp, lane, ctx) {
    const fire = { row: sp.row, lane: lane, shape: sp.shape, src: sp.src, lv: sp.lv, power: sp.power, hits: [], downs: [], flee: [], echo: lane !== sp.row };
    const P0 = sp.power;
    switch (sp.shape) {
      case 'point': {
        const t = targetsInLane(b, lane)[0];
        if (t) hit(b, t, P0 * 2, sp, true, fire, ctx);
        break;
      }
      case 'lance': {
        let P = P0;
        const sw = Z.W[sp.src];
        for (const t of targetsInLane(b, lane)) {
          if (P <= 0) break;
          let m = 1;
          if (isPart(t) && sw.siege) m = sw.siege;
          if (!isPart(t) && Z.EN[t.t].shield && !sw.noShield) m = 0.5;
          const eff = Math.floor(P * m);
          if (eff <= 0) { fire.hits.push({ id: tid(t), lane: t.lane, col: tcol(t), dmg: 0, kill: false, block: true }); P = 0; break; }
          const hp0 = t.hp;
          // hit() と同じ補正をかけるので、ここでは素の P を渡す
          const dealt = hit(b, t, P, sp, true, fire, ctx);
          if (dealt < hp0) { P = 0; break; }
          P -= Math.ceil(dealt / m);
          if (dealt >= eff) P = 0;
        }
        fire.left = P;
        break;
      }
      case 'sweep': {
        for (let l = 0; l < Z.LANES; l++) {
          const t = targetsInLane(b, l)[0];
          if (t) hit(b, t, P0, sp, false, fire, ctx);
        }
        break;
      }
      case 'burst': {
        const t0 = targetsInLane(b, lane)[0];
        if (!t0) break;
        const c0 = tcol(t0);
        fire.at = { lane: lane, col: c0 };
        const list = [];
        for (let l = lane - 1; l <= lane + 1; l++) {
          if (l < 0 || l >= Z.LANES) continue;
          for (const t of targetsInLane(b, l)) if (Math.abs(tcol(t) - c0) <= 1) list.push(t);
        }
        for (const t of list) if (t.hp > 0 && !(isPart(t) && t.dead)) hit(b, t, P0, sp, false, fire, ctx);
        break;
      }
      case 'storm': {
        const half = Math.max(1, Math.floor(P0 / 2));
        const list = [];
        for (let l = 0; l < Z.LANES; l++) list.push(...targetsInLane(b, l));
        for (const t of list) if (t.hp > 0 && !(isPart(t) && t.dead)) hit(b, t, half, sp, false, fire, ctx);
        break;
      }
    }
    return fire;
  }

  // 全行の呪文を、上の行から順に放つ。b を書き換え、演出用の記録を返す。
  Z.cast = function (s) {
    const b = s.b;
    if (b.phase !== 'aim' || b.over) return null;
    const ctx = { kills: 0, gold: 0, partDmg: 0, downs: 0, fled: 0 };
    const fires = [];
    const spells = [0, 1, 2].map(r => Z.rowSpell(s, r));
    const manaSpent = Z.manaUsed(s);
    for (const sp of spells) {
      for (const lane of sp.lanes) {
        for (let c = 0; c < sp.casts; c++) {
          const f = castShape(b, sp, lane, ctx);
          f.cast = c;
          fires.push(f);
        }
      }
    }
    // ずらしを確定させる
    s.reels.forEach((r, i) => { r.pos = mod(r.pos + b.offs[i], r.strip.length); });
    b.offs = s.reels.map(() => 0);
    b.en = b.en.filter(e => e.hp > 0);
    b.kills += ctx.kills + ctx.fled;
    b.gold += ctx.gold;
    b.casts++;
    const turnKills = ctx.kills + ctx.fled;
    if (turnKills > b.bestKills) b.bestKills = turnKills;
    const turnDmg = fires.reduce((a, f) => a + f.hits.reduce((x, h) => x + h.dmg, 0), 0);
    if (turnDmg > b.bestDmg) b.bestDmg = turnDmg;
    const res = { fires: fires, spells: spells, kills: ctx.kills, fled: ctx.fled, gold: ctx.gold, partDmg: ctx.partDmg, downs: ctx.downs, dmg: turnDmg, mana: manaSpent, win: false };
    if (b.army) {
      b.castsLeft--;
      if (b.castsLeft <= 0 || b.lordDown) { b.over = 'win'; res.win = true; }
      b.phase = 'spin';
    } else if (b.practice) {
      b.phase = 'spin';
    } else if (b.parts.every(p => p.dead)) {
      b.over = 'win'; res.win = true;
      const fl = b.en.map(e => e.id);
      for (const e of b.en) b.gold += Z.EN[e.t].gold;
      b.en = [];
      res.flee = fl;
    } else {
      b.phase = 'enemy';
    }
    return res;
  };

  // ---------- 魔王軍の手番 ----------
  Z.enemyPhase = function (s) {
    const b = s.b;
    const ev = [];
    if (b.over) return ev;
    if (b.army) {
      Z.fillArmy(s);
      b.turn++; b.phase = 'spin';
      return ev;
    }
    const list = b.en.slice().sort((a, c) => a.col - c.col || a.lane - c.lane);
    for (const e of list) {
      if (e.hp <= 0) continue;
      const d = Z.EN[e.t];
      if (e.frz) { e.frz = 0; ev.push({ k: 'thaw', id: e.id }); continue; }
      if (d.slow) { const rest = e.rest; e.rest = !e.rest; if (rest) { ev.push({ k: 'rest', id: e.id }); continue; } }
      if (d.archer && e.col <= d.archer) {
        if (e.cd > 0) { e.cd--; ev.push({ k: 'aim', id: e.id }); }
        else { e.cd = d.every - 1; b.guard -= d.dmg; ev.push({ k: 'shoot', id: e.id, lane: e.lane, col: e.col, dmg: d.dmg }); }
        continue;
      }
      const from = e.col;
      for (let st = 0; st < d.spd; st++) {
        const nc = e.col - 1;
        if (nc < 0) {
          b.guard -= d.dmg;
          ev.push({ k: 'strike', id: e.id, lane: e.lane, dmg: d.dmg, from: from });
          e.hp = 0; e.gone = true;
          break;
        }
        if (enemyAt(b, e.lane, nc)) break;
        e.col = nc;
      }
      if (e.hp > 0 && e.col !== from) ev.push({ k: 'move', id: e.id, from: from, to: e.col });
    }
    b.en = b.en.filter(e => e.hp > 0);
    // 砦から次の魔物が出る
    const def = Z.STAGES[b.stage];
    if (def && def.spawn) {
      b.parts.forEach((p, lane) => {
        if (p.dead) return;
        const sp = def.spawn[lane];
        if (sp && p.made < sp.list.length && b.turn >= sp.off && (b.turn - sp.off) % sp.every === 0) {
          p.queue.push(sp.list[p.made]);
          p.made++;
        }
        if (p.frz) { p.frz = 0; ev.push({ k: 'thawPart', lane: lane }); return; }
        if (p.shot) {
          p.cd--;
          if (p.cd <= 0) { p.cd = p.shot[0]; b.guard -= p.shot[1]; ev.push({ k: 'ballista', lane: lane, dmg: p.shot[1] }); }
        }
        if (p.queue.length && !enemyAt(b, lane, Z.COLS - 1)) {
          const t = p.queue.shift();
          const e = mkEnemy(b, lane, Z.COLS - 1, t, def.hpMul);
          ev.push({ k: 'spawn', id: e.id, lane: lane, t: t });
        }
      });
    }
    b.turn++;
    if (b.guard <= 0) { b.guard = 0; b.over = 'lose'; }
    else b.phase = 'spin';
    return ev;
  };

  // 次の魔王軍の手番に何が起きるか（画面の予告用）
  Z.foresee = function (s) {
    const c = shadow(s);
    c.b.phase = 'enemy';
    const ev = Z.enemyPhase(c);
    const by = {};
    for (const e of ev) if (e.id !== undefined) by[e.id] = e;
    return { ev: ev, by: by, guardLoss: s.b.guard - Math.max(0, c.b.guard), spawns: ev.filter(e => e.k === 'spawn') };
  };

  // 放つ前の見こみ（盤面を写して実際に放ってみる）
  Z.predict = function (s) {
    const c = shadow(s);
    const res = Z.cast(c);
    if (!res) return null;
    const per = {};
    for (const f of res.fires) {
      for (const h of f.hits) {
        const o = per[h.id] || (per[h.id] = { dmg: 0, kill: false, frz: false, block: false });
        o.dmg += h.dmg; if (h.kill) o.kill = true; if (h.frz) o.frz = true; if (h.block) o.block = true;
      }
      for (const id of f.flee) { const o = per[id] || (per[id] = { dmg: 0, kill: false, frz: false }); o.flee = true; }
    }
    if (res.flee) for (const id of res.flee) { const o = per[id] || (per[id] = { dmg: 0, kill: false, frz: false }); o.flee = true; }
    let guardLoss = 0;
    if (!c.b.over && !c.b.army && !c.b.practice) {
      const after = Z.enemyPhase(c);
      guardLoss = s.b.guard - Math.max(0, c.b.guard);
      res.after = after;
    }
    res.per = per;
    res.guardLoss = guardLoss;
    res.state = c.b;
    return res;
  };

  // ボットとヒント：魔力の範囲でずらし方を全部ためして、いちばんよいものを選ぶ
  Z.score = function (s, res) {
    const b = s.b;
    if (!res) return -1e9;
    let sc = res.partDmg * 1.0 + res.kills * 2 + res.fled * 1 + res.downs * 12;
    if (res.win) sc += 1000;
    sc -= res.guardLoss * 14;
    if (b.army || b.practice) sc = res.dmg + res.kills * 3 + res.partDmg * 0.5;
    if (b.army && res.state && res.state.lordDown) sc += 2000;
    // 凍らせた相手（次に動かない）も少し評価
    for (const f of res.fires) for (const h of f.hits) if (h.frz) sc += 0.5;
    return sc - res.mana * 0.05;
  };
  Z.bestShift = function (s, opts) {
    opts = opts || {};
    const b = s.b;
    const n = s.reels.length;
    const maxM = opts.maxMana !== undefined ? Math.min(opts.maxMana, b.mana) : b.mana;
    const lim = Math.min(3, maxM);
    let best = null;
    const offs = new Array(n).fill(0);
    const save = b.offs.slice();
    function rec(i, used) {
      if (i === n) {
        b.offs = offs.slice();
        const res = Z.predict(s);
        const sc = Z.score(s, res);
        if (!best || sc > best.score + 1e-9) best = { offs: offs.slice(), score: sc, res: res };
        return;
      }
      for (let o = -lim; o <= lim; o++) {
        if (used + Math.abs(o) > maxM) continue;
        offs[i] = o;
        rec(i + 1, used + Math.abs(o));
      }
      offs[i] = 0;
    }
    rec(0, 0);
    b.offs = save;
    return best;
  };

  // ---------- 勝ったあと ----------
  Z.finishBattle = function (s) {
    const b = s.b;
    const idx = b.stage;
    s.turns += b.turn;
    const rec = s.best[idx] || { kills: 0, dmg: 0 };
    rec.kills = Math.max(rec.kills, b.bestKills);
    rec.dmg = Math.max(rec.dmg, b.bestDmg);
    s.best[idx] = rec;
    s.gold += b.gold;
    const out = { gold: b.gold, stage: idx };
    if (b.over === 'win') {
      const rw = Z.REWARD[idx] || {};
      s.gold += rw.gold || 0;
      out.bonus = rw.gold || 0;
      if (rw.person) s.people.push(rw.person);
      for (const k of rw.shop || []) if (s.shop.indexOf(k) < 0) s.shop.push(k);
      if (rw.mana) s.maxMana += rw.mana;
      if (rw.guard) s.guardMax += rw.guard;
      out.fixed = [];
      for (const f of rw.fixed || []) { const w = Z.wd(f.k); s.inv.push(w); out.fixed.push(w); }
      if (rw.reel) {
        const n = s.reels.length;
        const role = Z.REEL_ROLES[n];
        const base = role === 'pow' ? ['p1', 'p1', 'p1', 'x2', 'p1', 'p1', 'p1', 'p1'] : ['e0', 'e0', 'e0', 'e0', 'up', 'e0', 'e0', 'down'];
        s.reels.push({ role: role, strip: strip(base), pos: 0 });
        out.reel = role;
      }
      s.gift = rw.gifts ? { opts: rw.gifts.map(g => g.map(k => Z.wd(k))) } : null;
      // 置いたばかりの印は、次の戦いを終えたら消す
      for (const r of s.reels) for (const w of r.strip) delete w.nw;
      s.stage = idx + 1;
      s.bought = {};
      s.siege = null;
      if (idx === Z.FINAL) s.cleared = true;
    } else {
      s.losses++;
      s.gold += 2;
      out.consolation = 2;
      if (!b.army && !b.practice) {
        const tries = s.siege && s.siege.stage === idx ? (s.siege.tries || 0) + 1 : 1;
        s.siege = { stage: idx, hp: b.parts.map(p => (p.dead ? 0 : p.hp)), tries: tries };
      }
    }
    s.b = null;
    return out;
  };
  Z.takeGift = function (s, i) {
    if (!s.gift || !s.gift.opts[i]) return false;
    for (const w of s.gift.opts[i]) s.inv.push(Z.wd(w.k, w.lv));
    s.gift = null;
    return true;
  };

  // ---------- 工房 ----------
  Z.shopList = function (s) {
    const out = [];
    for (const k of s.shop) {
      if (k === 'up1' || k === 'up2') continue;
      out.push({ id: k, kind: 'word', k: k, cost: Z.PRICE[k], sold: !!(s.bought || {})[k] });
    }
    return out;
  };
  Z.upCost = function (s, w) {
    if (!Z.isUpgradable(w)) return null;
    if (w.lv === 1 && s.shop.indexOf('up1') >= 0) return Z.PRICE.up1;
    if (w.lv === 2 && s.shop.indexOf('up2') >= 0) return Z.PRICE.up2;
    return null;
  };
  Z.buy = function (s, k) {
    const c = Z.PRICE[k];
    if (s.shop.indexOf(k) < 0 || c === undefined || s.gold < c || (s.bought || {})[k]) return false;
    s.gold -= c;
    (s.bought = s.bought || {})[k] = 1;
    s.inv.push(Z.wd(k));
    return true;
  };
  // 持ち物の言葉をリールのマスに置く。前に置いてあった言葉は持ち物にもどる
  Z.canPlace = (s, w, ri) => !!s.reels[ri] && Z.W[w.k].role === s.reels[ri].role;
  Z.place = function (s, invIdx, ri, slot) {
    const w = s.inv[invIdx];
    if (!w || !Z.canPlace(s, w, ri)) return false;
    const r = s.reels[ri];
    const old = r.strip[slot];
    const nw = { k: w.k, lv: w.lv, nw: true };
    r.strip[slot] = nw;
    s.inv.splice(invIdx, 1);
    // 空き・なし・ふつうの剣（Lv1）は、外しても持ち物にはもどらない
    if (old && !Z.W[old.k].blank && !(old.k === 'sword' && old.lv === 1)) s.inv.push({ k: old.k, lv: old.lv });
    return true;
  };
  // リールのマスから外す（空きの言葉にもどす）
  Z.unplace = function (s, ri, slot) {
    const r = s.reels[ri];
    const old = r.strip[slot];
    if (!old) return false;
    const blank = { src: 'sword', shape: 'gap', pow: 'p1', echo: 'e0' }[r.role];
    if (old.k === blank && old.lv === 1) return false;
    if (Z.W[old.k].blank) return false;
    r.strip[slot] = Z.wd(blank);
    if (!(old.k === blank && old.lv === 1)) s.inv.push({ k: old.k, lv: old.lv });
    return true;
  };
  // リールの上の 2 マスを入れ替える
  Z.swapSlots = function (s, ri, a, c) {
    const r = s.reels[ri];
    if (!r || a === c) return false;
    const t = r.strip[a]; r.strip[a] = r.strip[c]; r.strip[c] = t;
    return true;
  };
  Z.upgrade = function (s, ri, slot) {
    const w = s.reels[ri] && s.reels[ri].strip[slot];
    if (!w) return false;
    const c = Z.upCost(s, w);
    if (c === null || s.gold < c) return false;
    s.gold -= c;
    w.lv++;
    w.nw = true;
    return true;
  };

  // 戦いのはじめ：工房で置いた言葉を、一つずらせば道へ入れられる止まり方を探す
  // loose=false（二戦目）：2体以上倒して砦まで届くこと。loose=true（それ以降）：見こみが大きく伸びること
  Z.findTeachSpin = function (s, loose) {
    const b = s.b;
    const n = s.reels.length;
    const rs0 = s.rs;
    let best = null;
    for (let tries = 0; tries < 400; tries++) {
      const pos = s.reels.map(r => Z.ri(s, r.strip.length));
      s.reels.forEach((r, i) => { r.pos = pos[i]; });
      b.phase = 'aim'; b.offs = new Array(n).fill(0);
      // ずらさないとき
      const res0 = Z.predict(s);
      const sc0 = Z.score(s, res0);
      // 新しく置いた言葉のあるリールを1コマだけずらしたとき
      for (let i = 0; i < n; i++) {
        const strip = s.reels[i].strip;
        if (!strip.some(w => w.nw)) continue;
        for (const dir of [1, -1]) {
          b.offs = new Array(n).fill(0); b.offs[i] = dir;
          // ずらしたあと、新しい言葉が道に入っているか
          let row = -1;
          for (let r = 0; r < 3; r++) if (Z.wordAt(s, i, r).nw) row = r;
          if (row < 0) continue;
          b.offs[i] = 0;
          let rowBefore = -1;
          for (let r = 0; r < 3; r++) if (Z.wordAt(s, i, r).nw) rowBefore = r;
          b.offs[i] = dir;
          if (rowBefore >= 0) continue; // ずらす前から見えているものは選ばない
          const res = Z.predict(s);
          const f = res.fires.filter(x => x.row === row);
          const kills = f.reduce((a, x) => a + x.hits.filter(h => h.kill).length, 0);
          const toPart = f.some(x => x.hits.some(h => typeof h.id === 'string' && h.dmg > 0));
          const gain = Z.score(s, res) - sc0;
          const okStrict = kills >= 2 && toPart && gain > 2;
          const okLoose = gain > Math.max(6, Math.abs(sc0) * 0.25);
          if (loose ? okLoose : okStrict) {
            const v = gain + kills;
            if (!best || v > best.v) best = { v: v, pos: pos.slice(), reel: i, dir: dir, row: row, gain: gain };
          }
        }
      }
      if (best && tries > 60) break;
    }
    s.rs = rs0;
    b.phase = 'spin'; b.offs = new Array(n).fill(0);
    return best;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Z;
  else root.ZR = Z;
})(typeof window !== 'undefined' ? window : this);
