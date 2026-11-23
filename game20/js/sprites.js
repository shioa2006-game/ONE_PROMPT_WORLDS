// STAIRWARD — ドット絵（文字で描き、外枠は自動でつける）
// 向き：f = 手前向き（右下を向く）、b = 奥向き（右上を向く）。左向きは左右反転。
// 姿：idle / idle2（息）/ step（歩き）/ white（被弾）/ ghost（壁ごしの輪郭）
(function (root) {
  'use strict';
  const OUT = '#15101c';
  const SP = {};

  const DEF = {
    ilza: {
      pal: { p: '#4a86ff', h: '#d2dae6', H: '#8a96aa', s: '#f0c8a0', S: '#c89878', e: '#2a2030', a: '#bcc8d8', A: '#7c889e', y: '#f0d060', q: '#3a64cc', Q: '#26449a', w: '#eef4ff', c: '#3a64cc', C: '#24408c', l: '#6a7488', b: '#4a3a30', t: '#8a6030' },
      f: [
        '......pp......',
        '.....ppp......',
        '....hhhhh.....',
        '...hhhhhhh....',
        '...hHHHHHh....',
        '...hsesesh....',
        '...hsssssh....',
        '....hSSSh.....',
        '..AaaaaaaaA...',
        '.wAaaayaaaAqqq',
        '.waaaaaaaaqqyq',
        '.wsAaaaaAsqyyq',
        '.t.ccccccc.qqq',
        '...cccCccc..q.',
        '...ccCCCcc....',
        '....ll.ll.....',
        '....ll.ll.....',
        '....ll.ll.....',
        '...bbb.bbb....',
      ],
      b: [
        '......pp......',
        '.....ppp......',
        '....hhhhh.....',
        '...hhhhhhh....',
        '...hhhhhhh....',
        '...hHhhhHh....',
        '...hhhhhhh....',
        '....hHHHh.....',
        '..AaaaaaaaA...',
        'qqqAaaaaaaAw..',
        'qyqaaaaaaaaw..',
        'qqqAaaaaaAsw..',
        '.q.ccccccc.t..',
        '...cccCccc....',
        '...ccCCCcc....',
        '....ll.ll.....',
        '....ll.ll.....',
        '....ll.ll.....',
        '...bbb.bbb....',
      ],
    },
    ruu: {
      pal: { r: '#e0443a', R: '#a02a2a', y: '#f0c040', h: '#ff9a4a', s: '#f4d0a8', S: '#d0a080', e: '#2a2030', a: '#d85a2a', A: '#a03a20', f: '#ffe070', F: '#ff8a30', t: '#7a5030', l: '#5a3a3a', b: '#3a2a2a' },
      f: [
        '.......rr.....',
        '......rrR.....',
        '.....rrrR.....',
        '....rrrrR.....',
        '...yyyyyyy....',
        '.rrrrrrrrrrr..',
        '...hssssh.....',
        '...hseses.....',
        '...hssssh.....',
        '.f..SssS......',
        'fFf.aaaa......',
        '.t.aaaaaa.....',
        '.tsaAaaAas....',
        '.t.aaaaaa.....',
        '.t.aAaaAa.....',
        '.taaaaaaaa....',
        '.t..l..l......',
        '.t..b..b......',
      ],
      b: [
        '.......rr.....',
        '......rrR.....',
        '.....rrrR.....',
        '....rrrrR.....',
        '...yyyyyyy....',
        '.rrrrrrrrrrr..',
        '...hhhhhh.....',
        '...hhhhhh.....',
        '...hhhhhh.....',
        '....hhhh...f..',
        '....aaaa..fFf.',
        '...aaaaaa..t..',
        '..saAaaAas.t..',
        '...aaaaaa..t..',
        '...aAaaAa..t..',
        '..aaaaaaaa.t..',
        '....l..l...t..',
        '....b..b...t..',
      ],
    },
    kai: {
      pal: { g: '#4e9a40', G: '#2e6a2a', s: '#e8c098', S: '#c09070', e: '#20301a', c: '#6a5a3a', C: '#4a3e28', y: '#e8d070', w: '#a8783a', W: '#d8c8a0', l: '#4a4a3a', b: '#3a2c20' },
      f: [
        '....gggg......',
        '...ggggggg....',
        '..gggGGggg....',
        '..ggsssssg....',
        '..gsesesss..w.',
        '..ggsssssg.wW.',
        '...gSSSSg..wW.',
        '..GcccccccGwW.',
        '.sGcccyccGcwW.',
        '.sGcccccccGwW.',
        '..GcccccccGwW.',
        '..ccccCccc.wW.',
        '...cccCcc...w.',
        '...cc...cc....',
        '...ll...ll....',
        '...ll...ll....',
        '..bbb...bbb...',
      ],
      b: [
        '....gggg......',
        '...ggggggg....',
        '..ggggGggg....',
        '..gggggggg....',
        '.w.gggggggg...',
        '.Wwgggggggg...',
        '.Ww.gGGGGg....',
        '.WwGgggggggG..',
        '.WwgggGgggGs..',
        '.WwGgggggggGs.',
        '.WwGgggggggG..',
        '.Ww.gggGggg...',
        '.w...ggGgg....',
        '...cc...cc....',
        '...ll...ll....',
        '...ll...ll....',
        '..bbb...bbb...',
      ],
    },
    dugan: {
      pal: { w: '#e4eaf2', W: '#9aa4b4', t: '#8a6438', s: '#e0a880', S: '#b88060', e: '#2a1a14', B: '#8a5030', a: '#b0a088', A: '#8a7a64', c: '#6a4a2e', C: '#4a321e', l: '#4a4038', b: '#2e241c' },
      f: [
        '.w............',
        'wWw...........',
        '.w............',
        '.t..ssss......',
        '.t.sssssS.....',
        '.t.sesess.....',
        '.t.ssssss.....',
        '.t.BBBBBB.....',
        '.tsBBBBBBs....',
        'aatAccccAaa...',
        'aatccccccaa...',
        '.stccccccs....',
        '..tccCCccc....',
        '..tccccccc....',
        '..t.ll.ll.....',
        '..t.ll.ll.....',
        '....ll.ll.....',
        '...bbb.bbb....',
      ],
      b: [
        '..........w...',
        '.........wWw..',
        '..........w...',
        '....ssss..t...',
        '...Sssssss.t..',
        '...sssssss.t..',
        '...sSsssSs.t..',
        '....ssssss.t..',
        '...ssSSSSs.t..',
        '..aaaAaaaAaat.',
        '..aaaaaaaaaat.',
        '...saaaaaaast.',
        '...ccaaaaac.t.',
        '...ccccccc..t.',
        '....ll.ll...t.',
        '....ll.ll.....',
        '....ll.ll.....',
        '...bbb.bbb....',
      ],
    },
    mel: {
      pal: { x: '#f4f0e8', X: '#c8c0b4', s: '#f2d2b0', S: '#cca888', e: '#3a2a3a', a: '#f0e6c8', A: '#c8b890', y: '#e8b040', t: '#8a6a3a', f: '#ffe880', F: '#ffb040', b: '#6a5040' },
      f: [
        '....xxxx......',
        '...xxxxxx.....',
        '..xxXXXXxx....',
        '..xxsssssx....',
        '..xsesesss....',
        '..xxsssssx....',
        '...xSSSSx.....',
        '..aaaaaaaa....',
        '.saaayaaaas...',
        '.saaaaaaaa.t..',
        '..aaaaaaaa.t..',
        '..aaaaAaaa.ff.',
        '..aaaAAaaa.fF.',
        '..aaAAAAaa....',
        '..aaaaaaaa....',
        '...b....b.....',
      ],
      b: [
        '....xxxx......',
        '...xxxxxx.....',
        '..xxxxxxxx....',
        '..xxxxxxxx....',
        '..xxxxXxxx....',
        '..xxxxXxxx....',
        '...xxXXxx.....',
        '..aaaxxaaa....',
        't.aaaaaaaas...',
        't.aaaaaaaas...',
        't.aaaaaaaa....',
        'ff.aaaAaaa....',
        'fF.aaAAaaa....',
        '..aaAAAAaa....',
        '..aaaaaaaa....',
        '...b....b.....',
      ],
    },
    goblin: {
      pal: { g: '#7a9a52', G: '#55703a', n: '#7a9a52', e: '#ff4030', m: '#2a1a14', c: '#7a5038', C: '#523426', t: '#9a7048', k: '#2a2020' },
      f: [
        '.n.gggg.n...',
        '.nggggggn...',
        '..gegggeg...',
        '..gggmggg...',
        '...gGGGg..t.',
        '..ccccccc.t.',
        '.gcccccccgt.',
        '..ccCCccc...',
        '..ccccccc...',
        '...g...g....',
        '...g...g....',
        '..kk...kk...',
      ],
    },
    shield: {
      pal: { g: '#7a9a52', G: '#55703a', n: '#7a9a52', e: '#ff4030', m: '#2a1a14', c: '#5a4a5a', C: '#3a2e3a', w: '#8a6a40', W: '#5e4628', y: '#b8b0a0', k: '#2a2020' },
      f: [
        '.n.gggg.n.....',
        '.nggggggn.....',
        '..gegggeg.....',
        '..gggmggg.....',
        '..cgGGGgwwww..',
        '.cccccccwWWw..',
        '.gcccccwwyWw..',
        '..ccCCcwWyyw..',
        '..ccccwwWWWw..',
        '..ccccwwwwww..',
        '...g...g......',
        '...g...g......',
        '..kk...kk.....',
      ],
    },
    archer: {
      pal: { g: '#7a9a52', G: '#55703a', h: '#4a3a5a', H: '#30263c', e: '#ff4030', m: '#2a1a14', c: '#4a3a5a', C: '#30263c', w: '#9a7048', W: '#d8c8a0', k: '#2a2020' },
      f: [
        '...hhhh.....',
        '..hhhhhh....',
        '..hgeggeh.w.',
        '..hgggmgh.wW',
        '...gGGGg..wW',
        '..cccccccgwW',
        '.gcccccccgwW',
        '..ccCCccc.wW',
        '..ccccccc.w.',
        '...g...g....',
        '...g...g....',
        '..kk...kk...',
      ],
    },
    wolf: {
      pal: { g: '#62627a', G: '#40404e', n: '#50505e', e: '#ffd040', m: '#e8e0d0' },
      f: [
        '..............nn..',
        '.............nggn.',
        'g...........gggegm',
        'gg.gggggggggggggg.',
        '.gggggggggggGggg..',
        '..gggggGGGGGgg....',
        '..gGgg.....gGg....',
        '..g.g......g.g....',
        '.g...g....g...g...',
      ],
      f2: [
        '..............nn..',
        '.............nggn.',
        '............gggegm',
        'ggggggggggggggggg.',
        '.gggggggggggGggg..',
        '..gggggGGGGGgg....',
        '...gGg....gGg.....',
        '...gg......gg.....',
        '...g.g....g.g.....',
      ],
    },
    crow: {
      pal: { k: '#5a4c78', K: '#8a7cae', e: '#ff4a3a', b: '#e8b040' },
      f: [
        'K.........K.',
        'kK.......Kk.',
        '.kkK...Kkk..',
        '..kkkkkkek..',
        '...kkkkkkkb.',
        '....kkkk....',
      ],
      f2: [
        '............',
        '............',
        '...kkkkkkek.',
        '.Kkkkkkkkkkb',
        'Kkk.kkkk.kK.',
        'K.........K.',
      ],
    },
    ogre: {
      pal: { h: '#ece0c4', g: '#9a6a82', G: '#6e4a5e', e: '#ffde40', m: '#3a1a20', T: '#f4ecdc', c: '#6a3a2a', C: '#4a2618', l: '#86607a', t: '#7a5634', k: '#2a1c20' },
      f: [
        '.....h........h.....',
        '.....hh.gggg.hh.....',
        '.....hgggggggggh....',
        '....gggggggggggg....',
        '....ggeggggggegg....',
        '....gggggmmmggggg...',
        '....ggTmTmTmTggg....',
        '.....gggggggggg.....',
        '...ggGgggggggGgg....',
        '..ggggggggggggggg...',
        '.gggGgccccccGgggg.t.',
        '.gg.gccccccccg.ggtt.',
        '.gg.ccccCCcccc.ggtt.',
        '.gg.ccccccccccc.gtt.',
        '.g..cccccccccc..ttt.',
        '....llllllllll...t..',
        '....lll....lll......',
        '....lll....lll......',
        '....lll....lll......',
        '...kkkk....kkkk.....',
      ],
    },
    // 村の人たち（夜明けの場面）
    kid: {
      pal: { h: '#8a5030', s: '#f2d0a8', e: '#2a2030', a: '#e07a8a', A: '#b05a6a', l: '#5a4a5a', b: '#4a3028' },
      f: [
        '...hhhh...',
        '..hhhhhh..',
        '..hsesss..',
        '..hssssh..',
        '...ssss...',
        '..aaaaaa..',
        '.saaaaaas.',
        '..aAaaAa..',
        '..aaaaaa..',
        '...l..l...',
        '...b..b...',
      ],
    },
    woman: {
      pal: { h: '#5a3a2a', x: '#d8c8a8', s: '#ecc8a0', e: '#2a2030', a: '#7a8ab0', A: '#5a6890', c: '#e8dcc0', b: '#4a3028' },
      f: [
        '...xxxx....',
        '..xxxxxx...',
        '..xsesss...',
        '..xssssx...',
        '...ssss....',
        '..aaaaaa...',
        '.saaccaas..',
        '..aaccaa...',
        '..aaccaa...',
        '..aAAAAa...',
        '..aaaaaa...',
        '...b..b....',
      ],
    },
    elder: {
      pal: { h: '#e0e0e0', s: '#e0b890', e: '#2a2030', a: '#7a6a4a', A: '#5a4a32', t: '#9a7a4a', b: '#3a2a20' },
      f: [
        '...hhhh....',
        '..hhhhhh...',
        '..hsesss...',
        '..hhhhhh...',
        '...hhhh....',
        '..aaaaaa.t.',
        '.saaaaaast.',
        '..aAaaAa.t.',
        '..aaaaaa.t.',
        '..aaaaaa.t.',
        '...b..b..t.',
      ],
    },
  };

  function pad(rows) {
    const w = Math.max.apply(null, rows.map((r) => r.length));
    return rows.map((r) => (r + '.'.repeat(w)).slice(0, w));
  }

  // 文字の絵 → 外枠つきの canvas
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function paint(rows, pal, mode) {
    rows = pad(rows);
    const h = rows.length, w = rows[0].length;
    const c = makeCanvas(w + 2, h + 2);
    const g = c.getContext('2d');
    const solid = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] !== '.';
    // 外枠
    g.fillStyle = mode === 'white' ? '#ffffff' : (mode === 'ghost' ? '#ffffff' : OUT);
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) g.fillRect(x + 1, y + 1, 1, 1);
    }
    if (mode === 'ghost') return c;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      g.fillStyle = mode === 'white' ? '#ffffff' : (pal[ch] || '#ff00ff');
      g.fillRect(x + 1, y + 1, 1, 1);
    }
    return c;
  }
  function flip(c) {
    const o = makeCanvas(c.width, c.height);
    const g = o.getContext('2d');
    g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0);
    return o;
  }
  // 歩き：脚の段を左右に開く
  function stride(rows) {
    rows = pad(rows);
    const h = rows.length, w = rows[0].length;
    const legStart = Math.max(0, h - 4);
    const out = rows.slice();
    for (let y = legStart; y < h; y++) {
      const r = rows[y].split('');
      const mid = Math.floor(w / 2);
      const nr = r.map(() => '.');
      for (let x = 0; x < w; x++) {
        if (r[x] === '.') continue;
        const nx = x < mid - 1 ? x - 1 : (x > mid ? x + 1 : x);
        if (nx >= 0 && nx < w) nr[nx] = r[x];
      }
      out[y] = nr.join('');
    }
    return out;
  }
  // 息：上半身を1画素下げる
  function breathe(rows) {
    rows = pad(rows);
    const h = rows.length;
    const cut = Math.max(1, h - 5);
    const out = rows.slice();
    for (let y = cut - 1; y >= 1; y--) out[y] = rows[y - 1];
    out[0] = '.'.repeat(rows[0].length);
    return out;
  }

  const cache = {};
  SP.get = function (name, view, frame, mirror, mode) {
    const key = name + '|' + view + '|' + frame + '|' + (mirror ? 1 : 0) + '|' + (mode || '');
    if (cache[key]) return cache[key];
    const d = DEF[name];
    let rows = (view === 'b' && d.b) ? d.b : d.f;
    if (frame === 'step') rows = d.f2 ? (view === 'b' && d.b2 ? d.b2 : d.f2) : stride(rows);
    else if (frame === 'idle2') rows = d.f2 && !d.noBreath ? rows : breathe(rows);
    let c = paint(rows, d.pal, mode);
    if (mirror) c = flip(c);
    cache[key] = c;
    return c;
  };
  SP.has = (name) => !!DEF[name];
  SP.size = function (name) {
    const r = pad(DEF[name].f);
    return { w: r[0].length + 2, h: r.length + 2 };
  };
  SP.names = Object.keys(DEF);
  SP.OUT = OUT;
  root.K20SP = SP;
})(window);
