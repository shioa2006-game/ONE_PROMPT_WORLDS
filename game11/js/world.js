/*
 * ひゅるり、凧びより ― 世界のくみたて
 * いつも同じ種から作るので、保存は「まきこんだ もの の番号」だけで足りる。
 * 配置の座標は m で書き、内部では cm にする。
 */
(function (root) {
  'use strict';
  const TJ = root.TJ = root.TJ || {};
  const M = 100;

  TJ.buildWorld = function () {
    const R = TJ.rng(20260116);
    const TY = TJ.TYPES;
    const W = {
      zones: [], solids: [], objs: [], trees: [], creatures: [], kites: [], decos: [], ground: [],
      bounds: { x0: -110 * M, y0: -430 * M, x1: 680 * M, y1: 250 * M }
    };
    const rect = (x0, y0, x1, y1) => ({ x0: x0 * M, y0: y0 * M, x1: x1 * M, y1: y1 * M });

    // ── あそべる範囲（この四角の和の中だけを つむじは うごける）
    W.zones = [
      Object.assign(rect(-16, -14, 16, 16), { z: 2 }),
      Object.assign(rect(-70, 16, 75, 85), { z: 3 }),
      Object.assign(rect(75, -170, 255, 200), { z: 4 }),
      Object.assign(rect(255, -380, 620, 200), { z: 5 })
    ];
    W.yard = rect(-3, -2, 3, 2.2);
    // おかの まつり（ゆきぐもの うごく範囲 など）
    W.fest = { cx: 440 * M, cy: -90 * M, x0: 350 * M, x1: 530 * M, y0: -200 * M, y1: 20 * M, spawnY: -390 * M, enterY: -160 * M, trigX: 268 * M };
    W.kiriBox = rect(262, -375, 615, 195);
    W.river = rect(150, -170, 182, 200);

    // ── 地面のぬりわけ（えがく順）
    const G = (kind, r, extra) => W.ground.push(Object.assign({ kind }, r, extra || {}));
    G('grass', rect(-16, -14, 16, 16));
    G('dirt', rect(-7.5, 2.5, 7.5, 7.5));
    G('dirt', rect(-15, -2, 15, 2.8));
    G('field', rect(-14, 8, 14, 14.6));
    G('path', rect(-1.5, 7.5, 1.5, 16));
    G('yard', rect(-3, -2, 3, 2.2));
    G('grass3', rect(-70, 16, 75, 85));
    G('paddy', rect(-68, 50, 8, 83));
    G('road', rect(-70, 29.5, 75, 36.5));
    G('road', rect(-3, 16, 3, 30));
    G('plaza', rect(17, 37, 55, 63));
    G('lot', rect(56, 50, 74, 84));
    G('grass4', rect(75, -170, 255, 200));
    G('field4', rect(80, -160, 125, -60));
    G('gravel', rect(128, -170, 205, 200));
    G('river', rect(150, -170, 182, 200));
    G('road', rect(75, 30, 150, 36));
    G('road', rect(182, 30, 255, 36));
    G('bridge', rect(147, 30.5, 185, 35.5));
    G('hill', rect(255, -380, 620, 200));
    G('meadow', { x: 440 * M, y: -90 * M, rx: 140 * M, ry: 95 * M, ell: 1 });
    G('snow', { x: 570 * M, y: -310 * M, rx: 58 * M, ry: 46 * M, ell: 1 });
    G('road', rect(255, 0, 330, 8));
    G('lot', rect(275, 50, 355, 160));

    let nextId = 0;
    const solids = W.solids;
    const big = []; // ある程度 大きいものの 占有（かさならないように）

    function addSolid(o) { o.id = 'S' + solids.length; solids.push(o); return o; }
    function solidRect(x0, y0, x1, y1, pass, draw, extra) {
      return addSolid(Object.assign({ shape: 'rect', x0: x0 * M, y0: y0 * M, x1: x1 * M, y1: y1 * M, pass, draw }, extra || {}));
    }
    function solidCircle(x, y, r, pass, draw, extra) {
      return addSolid(Object.assign({ shape: 'circle', x: x * M, y: y * M, r: r * M, pass, draw }, extra || {}));
    }
    function inSolid(x, y, pad) {
      for (const s of solids) {
        if (s.shape === 'rect') {
          if (x > s.x0 - pad && x < s.x1 + pad && y > s.y0 - pad && y < s.y1 + pad) return true;
        } else if (Math.hypot(x - s.x, y - s.y) < s.r + pad) return true;
      }
      return false;
    }
    function inAny(x, y) {
      for (const z of W.zones) if (x > z.x0 && x < z.x1 && y > z.y0 && y < z.y1) return true;
      return false;
    }
    function inPlay(x, y, pad) {
      return inAny(x, y) && inAny(x - pad, y) && inAny(x + pad, y) && inAny(x, y - pad) && inAny(x, y + pad);
    }
    function bigFree(x, y, s) {
      for (const b of big) {
        if (Math.abs(x - b.x) > (s + b.s) || Math.abs(y - b.y) > (s + b.s)) continue;
        if (Math.hypot(x - b.x, y - b.y) < (s + b.s) * 0.42) return false;
      }
      return true;
    }

    function addObj(t, x, y, opt) {
      opt = opt || {};
      const ty = TY[t];
      const s = opt.s || ty.s * (opt.fixed ? 1 : R.range(opt.lo || 0.88, opt.hi || 1.12));
      const o = {
        id: nextId++, t, x, y, s,
        rot: opt.rot !== undefined ? opt.rot : (ty.flat ? R.range(0, Math.PI * 2) : R.range(-0.12, 0.12)),
        v: opt.v !== undefined ? opt.v : R.int(0, ty.v - 1),
        st: 0
      };
      if (ty.k === 'break') { o.hp = ty.hp; o.maxhp = ty.hp; }
      if (opt.content) o.content = opt.content;
      if (opt.solid) o.solid = opt.solid;
      if (opt.drift) o.drift = opt.drift;
      if (opt.water) o.water = 1;
      W.objs.push(o);
      if (s >= 20 || opt.reserve) big.push({ x, y, s });
      return o;
    }

    // 範囲 area にばらまく。area は {x0,y0,x1,y1}(m) か {cx,cy,r}(m)
    function scatter(t, n, area, opt) {
      opt = opt || {};
      const ty = TY[t];
      let placed = 0, tries = 0;
      while (placed < n && tries < n * 80) {
        tries++;
        let x, y;
        if (area.r !== undefined) {
          const a = R.range(0, Math.PI * 2), d = Math.sqrt(R()) * area.r;
          x = (area.cx + Math.cos(a) * d) * M; y = (area.cy + Math.sin(a) * d * (area.sy || 1)) * M;
        } else {
          x = R.range(area.x0, area.x1) * M; y = R.range(area.y0, area.y1) * M;
        }
        const s = ty.s * (opt.hi || 1);
        const pad = s * 0.45;
        if (!inPlay(x, y, pad * 0.5)) continue;
        if (inSolid(x, y, pad)) continue;
        if (opt.avoid && opt.avoid(x, y)) continue;
        if (!opt.water && x > W.river.x0 - s * 0.3 && x < W.river.x1 + s * 0.3 && y > W.river.y0 && y < W.river.y1) continue;
        if (s >= 20 && !bigFree(x, y, s)) continue;
        addObj(t, x, y, opt);
        placed++;
      }
      return placed;
    }
    function rowOf(t, x0, x1, y, step, jitter) {
      for (let x = x0; x <= x1; x += step) {
        const px = (x + R.range(-jitter, jitter)) * M, py = (y + R.range(-jitter, jitter)) * M;
        if (inSolid(px, py, TY[t].s * 0.4)) continue;
        addObj(t, px, py);
      }
    }
    function tree(kind, x, y, trunk, crown, pass, fruit, fruitN, tre) {
      const tr = { id: W.trees.length, kind, x: x * M, y: y * M, r: trunk * M, crown: crown * M, pass, fruit, fruitN: fruitN || 0, dropped: 0, tre, shake: 0 };
      W.trees.push(tr);
      solidCircle(x, y, trunk, pass, 'trunk', { tree: tr.id });
      return tr;
    }
    function deco(kind, x, y, s, extra) {
      W.decos.push(Object.assign({ kind, x: x * M, y: y * M, s: s * M, r: R.range(0, Math.PI * 2), v: R.int(0, 3) }, extra || {}));
    }

    // ════ 建物・へい・木（かたいもの） ════
    solidRect(-7, -11, 7, -2, Infinity, 'house');
    solidRect(9, -10, 15, -3.5, Infinity, 'naya');
    solidRect(11, 1.2, 14.5, 3, 300, 'toriya');
    solidCircle(-9, 4.5, 0.7, 150, 'ido');
    // にわの いけがき・いたべい
    solidRect(-3, 2.2, 3.5, 2.7, 36, 'hedge');
    solidRect(3, -2, 3.5, 2.7, 36, 'hedge');
    solidRect(-3.3, -2, -3, -0.4, 36, 'fence');
    solidRect(-3.3, 0.6, -3, 2.7, 36, 'fence');
    // のうかの いしがき（みなみ）
    solidRect(-16, 15.6, -1.5, 16.4, 150, 'ishigaki');
    solidRect(1.5, 15.6, 16, 16.4, 150, 'ishigaki');
    // むらの いえ
    const housesN = [[-66, -56], [-50, -40], [-34, -24], [-20, -9], [9, 20], [26, 36], [42, 52], [58, 70]];
    housesN.forEach(([a, b], i) => solidRect(a, 19, b, 28, Infinity, i === 5 || i === 6 ? 'shop' : 'minka', { v: i }));
    const housesS = [[-66, -55], [-50, -38], [-32, -22], [-16, -6], [2, 12], [58, 70]];
    housesS.forEach(([a, b], i) => solidRect(a, 38, b, 47, Infinity, i === 4 ? 'shop' : 'minka', { v: i + 3 }));
    // むらと かわらの さかい（たけがき）
    solidRect(74.6, 16, 75.4, 30, 500, 'takegaki');
    solidRect(74.6, 36, 75.4, 85, 500, 'takegaki');
    // かわらと おかの さかい（すぎばやし）
    solidRect(250, -170, 256, -10, 1200, 'sugi');
    solidRect(250, 10, 256, 200, 1200, 'sugi');

    // 木（みきは かたい。ドンで ゆらすと みが おちる）
    tree('ume', 2.1, -1.0, 0.12, 1.3, 300, 'umehana', 12, 't_donguri');
    tree('kaki', -11, -8, 0.3, 3.2, 600, 'kaki', 12, null);
    tree('mikan', 7, 1, 0.2, 1.9, 400, 'mikan', 10, null);
    tree('matsu', -5.5, 6, 0.25, 2.4, 500, null, 0, null);
    [[-45, 50], [33, 66], [-28, 58], [12, 58], [66, 44], [-60, 49]].forEach(([x, y]) => tree('matsu', x, y, 0.5, 4, 1500, null, 0, null));
    [[136, -150], [136, -80], [136, -10], [136, 70], [136, 140], [196, -120], [196, -40], [196, 100], [196, 170]].forEach(([x, y]) => tree('yanagi', x, y, 0.6, 6, 2000, null, 0, null));
    tree('kusu', 360, -20, 2, 18, 4000, null, 0, null);
    tree('kusu', 560, 80, 1.6, 15, 4000, null, 0, null);
    tree('kusu', 330, -265, 1.8, 16, 4000, null, 0, null);
    tree('kusu', 595, -130, 1.6, 14, 4000, null, 0, null);

    // ════ その一　えんがわの にわ ════
    const Y = { x0: -2.9, y0: -1.9, x1: 2.9, y1: 2.1 };
    addObj('ueki', 2.6 * M, -1.7 * M, { content: 't_biidama', fixed: 1 });
    addObj('ueki', -2.6 * M, 0.1 * M, { fixed: 1 });
    addObj('fusezaru', -1.9 * M, 1.3 * M, { content: 't_otoshidama', fixed: 1 });
    addObj('tourou', -2.45 * M, -1.55 * M, { fixed: 1 });
    addObj('kagami', -1.6 * M, -1.75 * M);
    addObj('kido', -3.15 * M, 0.1 * M, { fixed: 1, rot: 0, solid: rect(-3.3, -0.4, -3, 0.6) });
    addObj('jouro', 2.5 * M, 1.75 * M);
    addObj('baketsu', -2.5 * M, 1.8 * M);
    // 出発地点の ふきだまり（さいしょの 数秒で たくさん まきこめるように）
    scatter('kareha', 34, { cx: 0.15, cy: 0.55, r: 0.55 });
    scatter('matsuba', 16, { cx: 0.15, cy: 0.55, r: 0.6 });
    scatter('koishi', 10, { cx: 0.1, cy: 0.6, r: 0.6 });
    scatter('donguri', 10, { cx: 0.3, cy: 0.4, r: 0.5 });
    scatter('kareha', 60, { cx: 2.1, cy: -0.9, r: 1.6 });
    scatter('kareha', 110, Y);
    scatter('matsuba', 70, Y);
    scatter('koishi', 75, Y);
    scatter('donguri', 20, Y);
    scatter('koishi', 12, { x0: -2.6, y0: -0.2, x1: 0, y1: 0.5 });
    scatter('donguri', 25, { cx: -2.1, cy: 1.5, r: 0.8 });
    scatter('mikankawa', 10, { x0: -2.5, y0: -1.9, x1: 2.5, y1: -1.2 });
    scatter('ohajiki', 14, { cx: -0.6, cy: -1.45, r: 0.5 });
    scatter('biidama', 10, { cx: -0.5, cy: -1.3, r: 0.75 });
    scatter('hane', 6, Y);
    scatter('menko', 10, { cx: 0.9, cy: -1.3, r: 0.6 });
    scatter('koma', 5, { x0: -2, y0: -1.8, x1: 2, y1: -0.6 });
    scatter('sentaku', 8, { cx: -2.3, cy: -0.9, r: 0.55 });
    scatter('mikan', 6, { cx: 1.6, cy: 1.45, r: 0.55 });
    scatter('tebukuro', 3, Y);
    scatter('keito', 3, { x0: -2.5, y0: -1.8, x1: 2.5, y1: -0.8 });
    scatter('kendama', 2, Y);
    scatter('daruma_s', 3, Y);
    scatter('geta', 2, { cx: 0.3, cy: -1.55, r: 0.45 });
    scatter('kakizome', 3, { x0: -2.4, y0: -1.75, x1: 2.4, y1: -1.0 });
    scatter('hagoita', 2, Y);
    [[0.2, -1.4], [-0.4, -0.9], [-1.1, -0.5], [-1.8, -0.1], [-2.5, 0.1], [0.9, -0.7], [1.4, 0.2]].forEach(([x, y]) => deco('tobiishi', x, y, 0.55));
    for (let i = 0; i < 26; i++) deco('koke', R.range(-2.9, 2.9), R.range(-1.9, 2.1), R.range(0.15, 0.45));
    for (let i = 0; i < 260; i++) deco('tsubu', R.range(-2.95, 2.95), R.range(-1.95, 2.15), R.range(0.006, 0.014));
    for (let i = 0; i < 90; i++) deco('kusa', R.range(-2.95, 2.95), R.pick([R.range(1.85, 2.15), R.range(-1.95, 2.15)]), R.range(0.05, 0.1));

    // ════ その二　のうかと はたけ ════
    const outYard = (x, y) => x > -3.6 * M && x < 3.8 * M && y > -2.2 * M && y < 3.0 * M;
    addObj('monohoshi', -10 * M, -1 * M, { fixed: 1, rot: 0 });
    addObj('kakashi', -7 * M, 13.6 * M, { content: 't_megane', fixed: 1 });
    addObj('warani', -12.5 * M, 6 * M, { content: 't_koban', fixed: 1 });
    addObj('warani', 12.5 * M, 13 * M, { fixed: 1 });
    addObj('mon', 0, 16 * M, { fixed: 1, rot: 0, solid: rect(-1.5, 15.6, 1.5, 16.4) });
    addObj('kadomatsu', -2.2 * M, 15 * M, { fixed: 1 });
    addObj('kadomatsu', 2.2 * M, 15 * M, { fixed: 1 });
    addObj('usu', -3 * M, 4.6 * M, { fixed: 1 });
    addObj('kine', -2 * M, 4.2 * M, { fixed: 1, rot: 0.5 });
    const FY = { x0: -7, y0: 2.9, x1: 7, y1: 7.2 };
    scatter('shichirin', 2, FY); scatter('yakan', 2, FY); scatter('kago', 3, FY); scatter('nagagutsu', 4, FY);
    scatter('zabuton', 4, { x0: -14, y0: -1.8, x1: -4, y1: 2.6 }, { avoid: outYard });
    scatter('daruma_m', 3, { x0: -15, y0: -13, x1: 15, y1: 7 }, { avoid: outYard });
    scatter('tawara', 4, { x0: 4, y0: -3, x1: 15, y1: 0.5 });
    scatter('tawara', 3, { x0: -15, y0: -13, x1: -8, y1: -4 });
    scatter('wara', 8, { x0: 4, y0: -3, x1: 15, y1: 0.8 });
    scatter('wara', 6, { x0: -15, y0: 3, x1: -9, y1: 7.5 });
    scatter('ichirinsha', 2, { x0: 5, y0: -3, x1: 15, y1: 0.5 });
    scatter('sukoppu', 2, { x0: -14, y0: 7.5, x1: 14, y1: 8.2 });
    scatter('kuwa', 2, { x0: -14, y0: 7.4, x1: 14, y1: 8.2 });
    scatter('take', 3, { x0: -15, y0: -13.5, x1: 15, y1: -11.5 });
    scatter('mikan', 8, { cx: 7, cy: 2.2, r: 2.2 }, { avoid: outYard });
    scatter('zaru', 3, { x0: -7, y0: 2.9, x1: 7, y1: 7.2 });
    scatter('baketsu', 2, { x0: -12, y0: 3, x1: -6, y1: 7 });
    scatter('jouro', 1, { x0: -12, y0: 3, x1: -6, y1: 7 });
    scatter('geta', 2, { x0: -7, y0: 2.9, x1: 7, y1: 4 });
    scatter('hagoita', 2, { x0: -7, y0: 2.9, x1: 7, y1: 7 });
    scatter('kakizome', 2, { x0: -14, y0: -2, x1: -4, y1: 2.5 }, { avoid: outYard });
    scatter('kareha', 40, { cx: -11, cy: -8, r: 3.5 });
    scatter('kaki', 4, { cx: -11, cy: -8, r: 3 });
    scatter('daruma_s', 4, { x0: -15, y0: -13, x1: 15, y1: 7 }, { avoid: outYard });
    scatter('tebukuro', 3, { x0: -15, y0: -13, x1: 15, y1: 7 }, { avoid: outYard });
    scatter('hoshigaki', 5, { x0: -15, y0: -13.6, x1: 15, y1: -11.4 });
    scatter('mushiro', 4, { x0: -15, y0: -13.5, x1: 8, y1: -11.5 });
    scatter('mushiro', 2, { x0: -14, y0: 3, x1: -8, y1: 7.5 });
    scatter('kago', 3, { x0: -15, y0: -13.5, x1: 15, y1: -11.5 });
    scatter('nagagutsu', 3, { x0: 4, y0: -3, x1: 15, y1: 0.5 });
    scatter('shichirin', 2, { x0: -15, y0: -13.5, x1: 8, y1: -11.5 });
    scatter('zaru', 3, { x0: -15, y0: -13.5, x1: 8, y1: -11.5 });
    // はたけ
    rowOf('daikon', -13, -1.5, 8.6, 1.05, 0.12);
    rowOf('daikon', -13, -1.5, 9.7, 1.05, 0.12);
    rowOf('daikon', -13, -1.5, 10.8, 1.05, 0.12);
    rowOf('hakusai', -13, -1.5, 11.9, 0.95, 0.1);
    rowOf('hakusai', -13, -1.5, 13.0, 0.95, 0.1);
    rowOf('negi', 1.5, 13, 8.6, 0.85, 0.08);
    rowOf('negi', 1.5, 13, 9.6, 0.85, 0.08);
    rowOf('negi', 1.5, 13, 10.6, 0.85, 0.08);
    scatter('wara', 8, { x0: 1.5, y0: 11.4, x1: 13.5, y1: 14.4 }, { avoid: (x, y) => Math.hypot(x - 7 * M, y - 12.6 * M) < 1.6 * M });
    scatter('tawara', 3, { x0: -14, y0: 14, x1: 14, y1: 15.2 });
    for (let i = 0; i < 260; i++) deco('kusa', R.range(-16, 16), R.range(-14, 16), R.range(0.15, 0.3));
    for (let i = 0; i < 40; i++) deco('koke', R.range(-15, 15), R.range(-13, 7), R.range(0.6, 1.4));

    // ════ その三　むらの とおり ════
    const shopFront = (y) => ({ x0: -68, y0: y - 0.8, x1: 73, y1: y + 0.8 });
    scatter('nobori', 16, shopFront(29), { rot: 0 });
    scatter('chouchin', 30, shopFront(29.2));
    scatter('kanban', 10, shopFront(36.8));
    scatter('jitensha', 16, { x0: -68, y0: 29.6, x1: 73, y1: 36.4 });
    scatter('tanuki_s', 12, shopFront(36.8));
    scatter('tanuki_m', 6, { x0: -68, y0: 28.2, x1: 73, y1: 37.6 });
    scatter('bonsai', 14, shopFront(28.6));
    addObj('tanuki_l', 15 * M, 40 * M, { fixed: 1 });
    addObj('posuto', -5 * M, 29 * M, { fixed: 1 });
    addObj('posuto', 54 * M, 37.5 * M, { fixed: 1 });
    addObj('benchi', 62 * M, 37.8 * M, { fixed: 1, rot: 0 });
    addObj('benchi', 66 * M, 37.8 * M, { fixed: 1, rot: 0 });
    addObj('benchi', -40 * M, 37.8 * M, { fixed: 1, rot: 0 });
    scatter('sakadaru', 10, { x0: 25, y0: 28.4, x1: 37, y1: 29.6 });
    addObj('daruma_l', 43.5 * M, 29 * M, { fixed: 1 });
    addObj('daruma_l', 50.5 * M, 29 * M, { fixed: 1 });
    addObj('daruma_l', 7 * M, 37.6 * M, { fixed: 1 });
    addObj('daruma_l', 47 * M, 28.8 * M, { fixed: 1 });
    housesN.forEach(([a, b]) => { addObj('kadomatsu', (a + 1.6) * M, 29 * M); });
    housesS.forEach(([a, b]) => { addObj('kadomatsu', (b - 1.6) * M, 37.4 * M); });
    addObj('keitora', -30 * M, 33 * M, { fixed: 1, rot: 0 });
    addObj('keitora', 65 * M, 60 * M, { fixed: 1, rot: 0 });
    addObj('keitora', 30 * M, 33.5 * M, { fixed: 1, rot: 0, v: 1 });
    addObj('keitora', -52 * M, 52 * M, { fixed: 1, rot: 0, v: 1 });
    // ひろば（はつうり）
    [[22, 41.5], [29, 41.5], [36, 41.5], [43, 41.5], [50, 41.5], [22, 48.5], [29, 48.5], [43, 48.5], [50, 48.5], [22, 55]].forEach(([x, y]) => addObj('yatai', x * M, y * M, { fixed: 1, rot: 0 }));
    for (let i = 0; i < 11; i++) addObj('fukubukuro', (19 + i * 1.25) * M, (58.5 + (i % 2) * 1.2) * M, { v: 0 });
    addObj('fukubukuro', 33.2 * M, 61.5 * M, { v: 1, content: 't_maneki', fixed: 1 });
    [[50, 56], [52, 58], [50.5, 59.5], [70, 34], [53, 61], [48, 61]].forEach(([x, y]) => addObj('kibako', x * M, y * M));
    addObj('kibako', 72 * M, 38.5 * M, { content: 't_itomaki', fixed: 1 });
    addObj('kibako', 71 * M, 40.5 * M);
    addObj('kibako', 69.5 * M, 39.3 * M);
    scatter('riyakaa', 3, { x0: 18, y0: 53, x1: 54, y1: 62 });
    scatter('omen', 8, { x0: 18, y0: 38, x1: 54, y1: 62 });
    scatter('kazaguruma', 8, { x0: 18, y0: 38, x1: 54, y1: 62 });
    scatter('ringo', 12, { x0: 46, y0: 52, x1: 54, y1: 62 });
    scatter('taiyaki', 8, { x0: 18, y0: 38, x1: 54, y1: 62 });
    // たんぼ
    scatter('warani', 8, { x0: -66, y0: 52, x1: 6, y1: 81 });
    scatter('kakashi', 4, { x0: -66, y0: 52, x1: 6, y1: 81 });
    scatter('wara', 40, { x0: -66, y0: 52, x1: 6, y1: 81 });
    scatter('tawara', 16, { x0: -66, y0: 52, x1: 6, y1: 81 });
    scatter('mushiro', 8, { x0: -66, y0: 52, x1: 6, y1: 81 });
    scatter('yukidaruma', 5, { x0: -66, y0: 48, x1: 54, y1: 84 });
    // あきち
    scatter('sakadaru', 4, { x0: 56, y0: 50, x1: 74, y1: 84 });
    scatter('oke', 3, { x0: 56, y0: 50, x1: 74, y1: 84 });
    scatter('take', 10, { x0: 56, y0: 50, x1: 74, y1: 84 });
    scatter('riyakaa', 2, { x0: 56, y0: 50, x1: 74, y1: 84 });
    scatter('jitensha', 4, { x0: 56, y0: 50, x1: 74, y1: 84 });
    scatter('tanuki_m', 2, { x0: 8, y0: 48, x1: 16, y1: 84 });
    scatter('kanban', 3, { x0: -68, y0: 47.5, x1: 73, y1: 50 });
    scatter('chouchin', 8, { x0: 18, y0: 37.5, x1: 54, y1: 38.5 });
    scatter('kadomatsu', 6, { x0: -68, y0: 17, x1: 73, y1: 18.6 });
    addObj('saku', 75 * M, 33 * M, { fixed: 1, rot: 0, solid: rect(74.6, 30, 75.4, 36) });
    for (let i = 0; i < 220; i++) deco('kusa', R.range(-70, 75), R.range(16, 85), R.range(0.8, 1.6));

    // ════ その四　かわらと ふなつきば ════
    const notRiver = (x) => x > 146 * M && x < 186 * M;
    addObj('dondo', 112 * M, -30 * M, { content: 't_negai', fixed: 1 });
    addObj('dondo', 225 * M, -125 * M, { fixed: 1, s: 820 });
    addObj('koya', 115 * M, 112 * M, { content: 't_kappa', fixed: 1 });
    addObj('koya', 222 * M, -62 * M, { fixed: 1 });
    addObj('koya', 118 * M, -118 * M, { fixed: 1 });
    addObj('koya', 230 * M, 152 * M, { fixed: 1 });
    addObj('koya', 100 * M, 62 * M, { fixed: 1 });
    [[154, 22], [157, 40], [155, 48], [160, 56], [176, -40], [174, -55], [168, 120], [170, 150], [156, 80], [178, -100], [158, -130], [176, 10]].forEach(([x, y], i) => addObj('kobune', x * M, y * M, { rot: i % 2 ? 0.2 : -0.15, water: 1 }));
    addObj('yakatabune', 166 * M, -150 * M, { fixed: 1, rot: 0, water: 1 });
    addObj('yakatabune', 166 * M, 178 * M, { fixed: 1, rot: 0, water: 1 });
    addObj('yakatabune', 168 * M, 95 * M, { fixed: 1, rot: 0, water: 1 });
    for (let i = 0; i < 5; i++) addObj('maruta', (212 + i * 0.5) * M, (82 + i * 9) * M, { rot: 0.05 });
    for (let i = 0; i < 5; i++) addObj('maruta', (118 + (i % 2) * 3) * M, (0 + i * 7) * M, { rot: -0.03 });
    for (let i = 0; i < 4; i++) addObj('maruta', (96 + (i % 2) * 3) * M, (-100 + i * 8) * M, { rot: 0.02 });
    scatter('maruta', 4, { x0: 80, y0: -165, x1: 248, y1: 195 });
    scatter('iwa', 18, { x0: 129, y0: -168, x1: 148, y1: 198 }, { lo: 0.4, hi: 1.6 });
    scatter('iwa', 18, { x0: 184, y0: -168, x1: 204, y1: 198 }, { lo: 0.4, hi: 1.6 });
    scatter('iwa', 5, { x0: 152, y0: -165, x1: 180, y1: 195 }, { water: 1, lo: 0.5, hi: 1.2 });
    scatter('susuki', 30, { x0: 76, y0: -168, x1: 127, y1: 198 }, { lo: 0.6, hi: 1.3 });
    scatter('susuki', 30, { x0: 206, y0: -168, x1: 249, y1: 198 }, { lo: 0.6, hi: 1.3 });
    scatter('ami', 5, { x0: 82, y0: -150, x1: 248, y1: 190 });
    scatter('oke', 12, { x0: 80, y0: -165, x1: 248, y1: 195 });
    scatter('kame', 10, { x0: 80, y0: -165, x1: 248, y1: 195 });
    scatter('zaimoku', 16, { x0: 80, y0: -165, x1: 248, y1: 195 });
    scatter('hashigo', 6, { x0: 80, y0: -165, x1: 248, y1: 195 });
    scatter('yoshizu', 8, { x0: 80, y0: -165, x1: 248, y1: 195 });
    scatter('shimekazari', 10, { cx: 112, cy: -20, r: 9 });
    scatter('tsurizao', 6, { x0: 129, y0: -160, x1: 148, y1: 190 });
    scatter('kadomatsu', 6, { x0: 128, y0: 26, x1: 148, y1: 40 });
    scatter('take', 20, { x0: 80, y0: -60, x1: 127, y1: 10 });
    scatter('tawara', 14, { x0: 80, y0: -160, x1: 125, y1: -60 });
    scatter('warani', 5, { x0: 80, y0: -160, x1: 125, y1: -60 });
    scatter('kakashi', 3, { x0: 80, y0: -160, x1: 125, y1: -60 });
    scatter('riyakaa', 4, { x0: 76, y0: 20, x1: 128, y1: 50 });
    scatter('sakadaru', 6, { x0: 76, y0: 20, x1: 128, y1: 50 });
    scatter('jitensha', 5, { x0: 76, y0: 20, x1: 128, y1: 50 });
    addObj('taoreki', 253 * M, 0, { fixed: 1, rot: 0, solid: rect(250, -10, 256, 10) });
    for (let i = 0; i < 220; i++) {
      const x = R.range(75, 255), y = R.range(-170, 200);
      if (notRiver(x * M)) continue;
      deco('kusa', x, y, R.range(3, 5));
    }
    for (let i = 0; i < 70; i++) deco('nami', R.range(151, 181), R.range(-168, 198), R.range(4, 9));

    // ════ その五　おかの たこあげひろば ════
    const F = { cx: 440, cy: -90 };
    addObj('yagura', 440 * M, -215 * M, { content: 't_uchiwa', fixed: 1 });
    addObj('kamakura', 575 * M, -322 * M, { content: 't_usagi', fixed: 1 });
    [[548, -296], [598, -292], [556, -340], [596, -340]].forEach(([x, y]) => addObj('kamakura', x * M, y * M, { fixed: 1 }));
    for (let i = 0; i < 18; i++) {
      const a = -Math.PI * 0.95 + (i / 17) * Math.PI * 1.9 + Math.PI / 2;
      addObj('tento', (F.cx + Math.cos(a) * 172) * M, (F.cy + Math.sin(a) * 116) * M, { rot: 0 });
    }
    scatter('tento', 8, { x0: 262, y0: -20, x1: 330, y1: 40 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      addObj('oonobori', (F.cx + Math.cos(a) * 125) * M, (F.cy + Math.sin(a) * 84) * M, { rot: 0 });
    }
    [[428, -192], [452, -192], [418, -198], [462, -198], [440, -186], [408, -205], [472, -205], [440, -240]].forEach(([x, y]) => addObj('taiko', x * M, y * M, { rot: 0 }));
    for (let i = 0; i < 12; i++) addObj('torakku', (285 + (i % 4) * 17) * M, (62 + Math.floor(i / 4) * 30) * M, { rot: 0 });
    addObj('basu', 345 * M, 70 * M, { fixed: 1, rot: 0 });
    addObj('basu', 345 * M, 110 * M, { fixed: 1, rot: 0 });
    for (let i = 0; i < 14; i++) addObj('monooki', (280 + (i % 5) * 14) * M, (-362 + Math.floor(i / 5) * 18) * M, { rot: 0 });
    scatter('roll', 22, { x0: 265, y0: -255, x1: 340, y1: -150 }, { lo: 0.7, hi: 1.4 });
    scatter('roll', 22, { x0: 380, y0: 50, x1: 610, y1: 190 }, { lo: 0.7, hi: 1.4 });
    scatter('roll', 16, { x0: 560, y0: -80, x1: 615, y1: 50 }, { lo: 0.7, hi: 1.4 });
    [[270, -100], [600, -40], [380, 40], [520, 45], [360, -230], [520, -235], [300, -60], [585, 10]].forEach(([x, y]) => addObj('daruma_xl', x * M, y * M));
    scatter('yuki', 14, { cx: 570, cy: -310, r: 50, sy: 0.8 });
    scatter('susuki', 70, { x0: 262, y0: -375, x1: 615, y1: 195 }, { lo: 1.0, hi: 1.6 });
    scatter('kame', 18, { x0: 262, y0: -375, x1: 615, y1: 195 }, { lo: 1.4, hi: 2 });
    scatter('oke', 18, { x0: 262, y0: -375, x1: 615, y1: 195 }, { lo: 1.4, hi: 2 });
    scatter('iwa', 24, { x0: 262, y0: -375, x1: 615, y1: 195 }, { lo: 0.6, hi: 1.3 });
    scatter('maruta', 14, { x0: 262, y0: -375, x1: 615, y1: 195 }, { lo: 0.9, hi: 1.3 });
    scatter('kobune', 6, { x0: 262, y0: -375, x1: 615, y1: 195 }, { lo: 1, hi: 1.2 });
    for (let i = 0; i < 30; i++) {
      const x = R.range(268, 610), y = R.range(-370, 190);
      addObj('kiri', x * M, y * M, { drift: { vx: R.range(-1, 1) * 90, vy: R.range(-0.4, 0.4) * 90 }, lo: 0.75, hi: 1.25 });
    }
    for (let i = 0; i < 200; i++) deco('kusa', R.range(255, 620), R.range(-380, 200), R.range(7, 12));

    // ════ にわを 出たところ（30〜45cm の つなぎ）════
    // 初見確認で「にわを 出た直後に 育ちが にぶる」と わかったので、出口の まわりに 中くらいの ものを 置く
    const exits = [{ x0: -7, y0: -1.8, x1: -3.7, y1: 2.6 }, { x0: -3.5, y0: 2.95, x1: 4.5, y1: 5.8 }, { x0: 3.8, y0: -1.8, x1: 8, y1: 2.8 }];
    for (const a of exits) {
      scatter('geta', 1, a); scatter('zaru', 1, a); scatter('yakan', 1, a); scatter('nagagutsu', 1, a);
      scatter('kutsushita', 2, a); scatter('tebukuro', 1, a); scatter('mikan', 3, a); scatter('wara', 2, a);
      scatter('hagoita', 1, a); scatter('shichirin', 1, a); scatter('daruma_m', 1, a); scatter('baketsu', 1, a);
      scatter('kakizome', 1, a); scatter('kendama', 1, a); scatter('keito', 1, a);
    }

    // ════ 凧 ════
    const kpos = [[1.0, 1.0, 0.25, -1.65], [7, 12.6, 5.6, 13.4], [40, 55, 36.5, 56.5], [225, 15, 220, 22], [F.cx, F.cy, F.cx - 10, F.cy + 20]];
    TJ.KITES.forEach((k, i) => {
      const p = kpos[i];
      W.kites.push({ i, key: k.key, x: p[0] * M, y: p[1] * M, ox: p[2] * M, oy: p[3] * M, s: k.s, req: k.req, st: 0, t: 0 });
    });

    // ════ いきもの ════
    const C = W.creatures;
    C.push({ kind: 'cat', x: -1.2 * M, y: -1.6 * M, s: 30, spots: [[-1.2, -1.6], [2.3, 1.5], [-2.0, 1.7], [0.6, -0.4]].map(p => [p[0] * M, p[1] * M]), st: 'sleep', t: 0 });
    for (let i = 0; i < 5; i++) C.push({ kind: 'chicken', x: R.range(8.5, 14.5) * M, y: R.range(3.6, 7) * M, s: 38, home: { x0: 7.5 * M, y0: 3.4 * M, x1: 15 * M, y1: 7.4 * M }, st: 'walk', t: R.range(0, 2), dir: R.range(0, 6.28) });
    C.push({ kind: 'crow', cx: -11 * M, cy: -8 * M, rad: 3.6 * M, h: 380, s: 45, item: 't_suzu', ang: 0, spd: 0.42, st: 'circle' });
    C.push({ kind: 'crow', cx: 6 * M, cy: 11 * M, rad: 5 * M, h: 420, s: 45, item: null, ang: 2, spd: -0.4, st: 'circle' });
    C.push({ kind: 'crow', cx: 36 * M, cy: 50 * M, rad: 9 * M, h: 900, s: 45, item: 't_fuurin', ang: 1, spd: 0.32, st: 'circle' });
    C.push({ kind: 'tobi', cx: 166 * M, cy: -60 * M, rad: 30 * M, h: 2600, s: 130, item: 't_koi', ang: 0, spd: 0.22, st: 'circle' });
    const hats = ['niito', 'boushi', 'niito', 'kasa', 'kamibukuro', 'niito', 'boushi', 'furoshiki', 'kasa', 'niito', 'kamibukuro', 'niito'];
    hats.forEach((h, i) => {
      const lane = i % 3 === 2 ? [[20, 45], [52, 45], [52, 60], [20, 60]] : [[-66, 31.5 + (i % 2) * 3], [72, 31.5 + (i % 2) * 3]];
      C.push({ kind: 'villager', path: lane.map(p => [p[0] * M, p[1] * M]), seg: i % lane.length, x: 0, y: 0, s: 160, item: h, iv: R.int(0, TY[h].v - 1), spd: R.range(90, 130), st: 'walk', t: 0, look: i });
    });
    for (let i = 0; i < 8; i++) C.push({ kind: 'duck', x: R.range(153, 179) * M, y: R.range(-160, 190) * M, s: 45, st: 'swim', t: R.range(0, 3), dir: R.range(0, 6.28) });

    // ════ ひとびと（凧の もちぬし と おかの けんぶつ）は 絵だけ ════
    W.people = [];
    W.kites.forEach((k, i) => { if (i < 4) W.people.push({ kite: i, x: k.ox, y: k.oy, s: [110, 135, 145, 160][i], who: i }); });
    for (let i = 0; i < 40; i++) {
      const a = R.range(0, Math.PI * 2);
      W.people.push({ crowd: 1, x: (F.cx + Math.cos(a) * R.range(34, 48)) * M, y: (F.cy + Math.sin(a) * R.range(24, 33)) * M, s: 160, who: 10 + (i % 6) });
    }

    W.nextId = nextId;
    W.typeMin = {};
    for (const o of W.objs) {
      const cur = W.typeMin[o.t];
      if (cur === undefined || o.s < cur) W.typeMin[o.t] = o.s;
    }
    return W;
  };

  // こわれたときの なかみ（親の番号から いつも同じに作る）
  TJ.pieceId = (parentId, k) => 100000 + parentId * 32 + k;
  TJ.fruitId = (treeId, k) => 200000 + treeId * 32 + k;
  TJ.birdItemId = (idx) => 300000 + idx;
  TJ.hatId = (idx) => 400000 + idx;
  TJ.cloudId = (k) => 500000 + k;
})(typeof window !== 'undefined' ? window : globalThis);
