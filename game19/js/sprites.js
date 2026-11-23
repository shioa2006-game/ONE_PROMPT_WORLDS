// せーの、星見の露台へ — ドット絵（文字列で描き、外枠は自動でつける）
// 向き: F = 手前向き（画面の右下を向く）、B = 奥向き（画面の右上を向く）。左向きは左右反転。
(function (root) {
  'use strict';

  const PAL = {
    k: '#140f1c', // 外枠
    // 肌・髪
    s: '#f0c49a', S: '#c08866', e: '#241018', E: '#ffffff',
    w: '#ece6da', W: '#aaa293', // 白い髭・髪
    h: '#e8823a', H: '#a84e22', // 橙の髪
    l: '#dfe8f4', L: '#9fb0c8', // 銀の髪
    // 金属
    m: '#9aa6ba', M: '#dce4f0', n: '#5c667c',
    // 赤
    r: '#b8442f', R: '#7a2822',
    // 革
    b: '#80583a', B: '#4c3424', c: '#a8794c',
    // 青銅の盾
    o: '#d49a3c', O: '#8c5c24', y: '#f8d67c',
    // 緑
    g: '#5aa04a', G: '#2f6a32', j: '#9ad466',
    // 黄の襟巻
    u: '#f2c84a', U: '#b8862c',
    // 青い衣
    v: '#3a5cc0', V: '#243a84', i: '#6a8cf0',
    // 水晶
    q: '#9af0ff', Q: '#3cb8e8',
    // 敵
    a: '#88b048', A: '#557a2a', // 小鬼の肌
    t: '#e8e2cc', T: '#a8a08a', // 骨
    p: '#5ad0b8', P: '#2e8e86', // 粘体
    x: '#8a5ab8', X: '#4e2e78', // 蝙蝠
    z: '#8a8a96', Z: '#5a5a68', f: '#ffa040', F: '#ff6020', // 岩人形
    d: '#c41c2c', // 赤い目
  };

  // ---------- 主人公 ----------
  const GARD_F = [
    '....nmmmmn....',
    '...nmMMmmmn...',
    '...mMmmmmmmn..',
    '..nnnnnnnnnn..',
    '...seSsseSs...',
    '...ssssssSS...',
    '...wwsSssww...',
    '..RwwwwwwwwR..',
    '.RRrwwwwwWrRo.',
    '.RrmMwwwWmrOoo',
    'RrmMmmmmmnOyyo',
    'RsMmmmmmmnOyyo',
    'RSbbbbybbbOyoo',
    'RmrmmmmmmnOooo',
    'Mr.mmmmmmn.Oo.',
    'M..nnnnnnn....',
    '...bbb.bbb....',
    '...bbb.bbb....',
    '...mmm.mmm....',
    '...BBB.BBB....',
    '..BBBB.BBBB...',
  ];
  const GARD_B = [
    '....nmmmmn....',
    '...nmMMmmmn...',
    '..nmMmmmmmmn..',
    '..nnnnnnnnnn..',
    '...nmmmmmmn...',
    '...wwwwwwww...',
    '..RRwwwwwwRR..',
    '.RRrrrrrrrrRR.',
    'oRrrrrrrrrrrR.',
    'ooRrrrrrrrrrR.',
    'oyRrrrrrrrrRRM',
    'oyRrrrrrrrrRRM',
    'ooRRrrrrrrRRbM',
    'oOBRRrrrrRRBb.',
    '.O.RRRRRRRRb..',
    '...bbbbbbbb...',
    '...bbb.bbb....',
    '...bbb.bbb....',
    '...mmm.mmm....',
    '...BBB.BBB....',
    '..BBBB.BBBB...',
  ];
  const RIKO_F = [
    '.....GGG......',
    '....GgggG.....',
    '...GgjggggG...',
    '..GgggggggG...',
    '..GghhhhhgG...',
    '..GhseshesG...',
    '...hsssssS....',
    '..uuusssSuu...',
    '.uUuuuuuuuuc..',
    'uU.ccbbbbcccb.',
    'U..cbbbbbbbcb.',
    '...sbbbbbbbsb.',
    '...cbbybbbbcb.',
    '....bbbbbbb.b.',
    '....GggggGG...',
    '....GgggggG...',
    '.....bb.bb....',
    '.....bb.bb....',
    '.....BB.BB....',
    '....BBB.BBB...',
  ];
  const RIKO_B = [
    '......GGG.....',
    '.....GgggG....',
    '...GggjgggG...',
    '...GgggggggG..',
    '...GgggggggG..',
    '...GGgggggGG..',
    '....hhGGGhh...',
    '...uuuuuuuuu..',
    '..cbuuuuuuubcU',
    '.cbcbbbbbbbcbU',
    '.cbcbbbbbbbbc.',
    'cb.sbbbbbbbs..',
    'cb.cbbbbbbbc..',
    'c...bbbbbbb...',
    '....GgggggG...',
    '....GgggggG...',
    '.....bb.bb....',
    '.....bb.bb....',
    '.....BB.BB....',
    '....BBB.BBB...',
  ];
  const SENA_F = [
    '.......VV.....',
    '......Vvv.....',
    '.....Vvvi.....',
    '.....Vvvv.....',
    '....Vvvvvv....',
    '..MMMMMMMMMM..',
    '.VVVVVVVVVVVV.',
    '...llssssll...',
    '...leseesl.q..',
    '...lsssssl.Q..',
    '..llwwwwwll.m.',
    '..lvvwwwvvlsm.',
    '...vvvvvvvvVm.',
    '...vvviivvvVm.',
    '...vvvvvvvVVm.',
    '...vvvvvvvVVm.',
    '..vvvvvvvvvVm.',
    '..vvvvvvvvvVV.',
    '..vvvvvvvvvVV.',
    '..VVwwwwwwwVV.',
    '...BB....BB...',
  ];
  const SENA_B = [
    '.....VV.......',
    '.....vvV......',
    '.....ivvV.....',
    '.....vvvV.....',
    '....vvvvvV....',
    '..MMMMMMMMMM..',
    '.VVVVVVVVVVVV.',
    '...llllllll...',
    '...llllllll.q.',
    '...llllllll.Q.',
    '..lllllllllm..',
    '..vlllllllvm..',
    '...vvlllvvvm..',
    '...vvvvvvvvm..',
    '...vvvvvvvVm..',
    '...vvvvvvvVm..',
    '..vvvvvvvvvVm.',
    '..vvvvvvvvvVV.',
    '..vvvvvvvvvVV.',
    '..VVVVVVVVVVV.',
    '...BB....BB...',
  ];

  // ---------- 敵 ----------
  const GOBLIN_F = [
    '..............',
    'A....aaaa....A',
    'aA..aaaaaa..Aa',
    '.aaaaaaaaaaaa.',
    '...adaaada....',
    '...aaaAaaa....',
    '....aaeea.....',
    '...bbbbbbb.m..',
    '..abbbbbbba.m.',
    '..a.BBBBB.am..',
    '....bbbbb.c...',
    '....aa.aa.....',
    '...AAA.AAA....',
  ];
  const GOBLIN_B = [
    '..............',
    'A....aaaa....A',
    'aA..aaaaaa..Aa',
    '.aaaaaaaaaaaa.',
    '...aaaaaaa....',
    '...aAaaaAa....',
    '....aaaaa.....',
    '...bbbbbbb....',
    '..abbbbbbba...',
    '..a.BBBBB.a...',
    '....bbbbb.....',
    '....aa.aa.....',
    '...AAA.AAA....',
  ];
  const ARCHER_F = [
    '....tttt......',
    '...ttttttT....',
    '...tektekT....',
    '...ttttttT....',
    '....tTtTt.....',
    '.....tt.......',
    '...ttttttt..b.',
    '..t.tTtTt.t..b',
    '..t.ttttt.t..b',
    '..T..tTt..t..b',
    '.....ttt....b.',
    '....tTtTt..b..',
    '....t...t.....',
    '....t...t.....',
    '....T...T.....',
    '...TT...TT....',
  ];
  const ARCHER_B = [
    '....tttt......',
    '...ttttttT....',
    '...ttttttT....',
    '...ttttttT....',
    '....tTtTt.....',
    '.....tt.......',
    '.b.ttttttt....',
    'b.t.ttttt.t...',
    'b.t.tTtTt.t...',
    'b.T..ttt..t...',
    '.b...ttt......',
    '..b.tTtTt.....',
    '....t...t.....',
    '....t...t.....',
    '....T...T.....',
    '...TT...TT....',
  ];
  const SLIME_F = [
    '..............',
    '.....pppp.....',
    '...pppEEppp...',
    '..ppppEpppppP.',
    '.pppppppppppP.',
    '.ppeppppeppPP.',
    'ppppppppppppPP',
    'ppppppppppppPP',
    '.PpppppppppPP.',
    '..PPPPPPPPPP..',
  ];
  const BAT_A = [
    'X............X',
    'xX....xx....Xx',
    'xxX..xxxx..Xxx',
    '.xxXxdxxdxXxx.',
    '..xxxxxxxxxx..',
    '...X.xxxx.X...',
    '......xx......',
  ];
  const BAT_B = [
    '..............',
    '......xx......',
    '.....xxxx.....',
    '..XXxdxxdxXX..',
    '.xxxxxxxxxxxx.',
    'xxX..xxxx..Xxx',
    'X.....xx.....X',
  ];
  const GOLEM_F = [
    '......zzzzzz........',
    '.....zzZzzzzZ.......',
    '.....zfzzzfzZ.......',
    '.....zzzzzzzZ.......',
    '..zzzZZzzzzZZzzz....',
    '.zzzzzzzzzzzzzzzZ...',
    'zzzZzzzzfzzzzZzzzZ..',
    'zzzZzzzfFfzzzZzzzZ..',
    'zzZ.zzzzfzzzz.ZzzZ..',
    'zzZ.zzzzzzzzz.ZzzZ..',
    'ZZ..zzzzZzzzz..ZZZ..',
    'fz..zzzZzZzzz..zfz..',
    '....zzzz.zzzz.......',
    '....zzzZ.zzzZ.......',
    '...ZZZZZ.ZZZZZ......',
  ];
  const GOLEM_B = [
    '......zzzzzz........',
    '.....zzZzzzzZ.......',
    '.....zzzzzzzZ.......',
    '.....zzzzzzzZ.......',
    '..zzzZZzzzzZZzzz....',
    '.zzzzzzzzzzzzzzzZ...',
    'zzzZzzzzzzzzzZzzzZ..',
    'zzzZzzzZzZzzzZzzzZ..',
    'zzZ.zzzzzzzzz.ZzzZ..',
    'zzZ.zzzfFfzzz.ZzzZ..',
    'ZZ..zzzzfzzzz..ZZZ..',
    'zz..zzzZzZzzz..zzz..',
    '....zzzz.zzzz.......',
    '....zzzZ.zzzZ.......',
    '...ZZZZZ.ZZZZZ......',
  ];
  const WISP_F = [
    '.....q......',
    '....qQq.....',
    '...qQqQq....',
    '..qQqqqQq...',
    '..QqEqEqQ...',
    '..qqqqqqq...',
    '...QqqqQ....',
    '..qQqQqQq...',
    '.QqQ.qQ.Qq..',
    '.Q..Q..Q..Q.',
  ];

  // ---------- 生成 ----------
  function makeCanvas(w, h) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function parse(rows) { return rows.map(r => r.split('')); }
  // 外枠つきの canvas を作る。tf は各画素の変換（脚の入れかえなど）
  function bake(rows, opt) {
    opt = opt || {};
    const g = parse(rows);
    const h0 = g.length, w0 = Math.max(...g.map(r => r.length));
    const W = w0 + 2, H = h0 + 2;
    const grid = [];
    for (let y = 0; y < H; y++) { grid.push(new Array(W).fill('.')); }
    for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) { const ch = g[y][x] || '.'; grid[y + 1][x + 1] = ch; }
    // 外枠
    const out = grid.map(r => r.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (grid[y][x] !== '.') continue;
      let edge = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && grid[ny][nx] !== '.' && grid[ny][nx] !== 'k') edge = true;
      }
      if (edge) out[y][x] = 'k';
    }
    const c = makeCanvas(W, H);
    if (!c) return { w: W, h: H, grid: out };
    const ctx = c.getContext('2d');
    const pal = Object.assign({}, PAL, opt.pal || {});
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = out[y][x];
      if (ch === '.') continue;
      ctx.fillStyle = pal[ch] || '#ff00ff';
      ctx.fillRect(x, y, 1, 1);
    }
    return { c, w: W, h: H };
  }
  function flip(s) {
    const c = makeCanvas(s.w, s.h);
    if (!c) return s;
    const ctx = c.getContext('2d');
    ctx.translate(s.w, 0); ctx.scale(-1, 1); ctx.drawImage(s.c, 0, 0);
    return { c, w: s.w, h: s.h };
  }
  // 白一色（被弾の点滅・透かし用）
  function tint(s, color, alpha) {
    const c = makeCanvas(s.w, s.h);
    if (!c) return s;
    const ctx = c.getContext('2d');
    ctx.drawImage(s.c, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color; ctx.fillRect(0, 0, s.w, s.h);
    return { c, w: s.w, h: s.h };
  }

  // 歩きの脚：下から何行かを左右の足で入れかえる
  function legs(rows, n, phase) {
    const out = rows.slice();
    const L = out.length;
    for (let k = L - n; k < L; k++) {
      const r = out[k].split('');
      const half = Math.floor(r.length / 2);
      // 片足を1画素上げる
      const left = r.slice(0, half), right = r.slice(half);
      if (phase === 1) {
        // 左足を前（下へ）、右足を後ろ（上へ）
        out[k] = left.join('') + right.join('');
      }
      out[k] = r.join('');
    }
    if (phase === 0) return out;
    // 片方の足の列を一段上へずらす
    const res = out.map(r => r.split(''));
    const w = res[0].length;
    const mid = Math.floor(w / 2);
    for (let k = L - n; k < L - 1; k++) {
      for (let x = 0; x < w; x++) {
        const isLeft = x < mid;
        if ((phase === 1 && isLeft) || (phase === 2 && !isLeft)) res[k][x] = res[k + 1][x];
      }
    }
    for (let x = 0; x < w; x++) {
      const isLeft = x < mid;
      if ((phase === 1 && isLeft) || (phase === 2 && !isLeft)) res[L - 1][x] = '.';
    }
    return res.map(r => r.join(''));
  }

  // 上半身を少し前へ（押す・攻める）
  function lean(rows, upto, dx) {
    return rows.map((r, y) => {
      if (y >= upto) return r;
      if (dx > 0) return ('.'.repeat(dx) + r).slice(0, r.length + dx).padEnd(r.length + dx, '.');
      return r.slice(-dx) + '.'.repeat(-dx);
    }).map(r => r.length > rows[0].length ? r : r.padEnd(rows[0].length + Math.max(0, dx), '.'));
  }
  function pad(rows, w) { return rows.map(r => r.padEnd(w, '.')); }

  const SP = {};
  function build() {
    const defs = {
      gard: { F: GARD_F, B: GARD_B, legs: 5 },
      riko: { F: RIKO_F, B: RIKO_B, legs: 4 },
      sena: { F: SENA_F, B: SENA_B, legs: 2 },
      goblin: { F: GOBLIN_F, B: GOBLIN_B, legs: 2 },
      archer: { F: ARCHER_F, B: ARCHER_B, legs: 4 },
      slime: { F: SLIME_F, B: SLIME_F, legs: 0 },
      bat: { F: BAT_A, B: BAT_A, legs: 0, alt: BAT_B },
      golem: { F: GOLEM_F, B: GOLEM_B, legs: 3 },
      wisp: { F: WISP_F, B: WISP_F, legs: 0 },
    };
    for (const k in defs) {
      const d = defs[k];
      const w = Math.max(...d.F.map(r => r.length), ...d.B.map(r => r.length)) + 2;
      const set = {};
      for (const side of ['F', 'B']) {
        const base = pad(d[side], w - 2);
        const frames = {
          idle: base,
          walk1: d.legs ? legs(base, d.legs, 1) : base,
          walk2: d.legs ? legs(base, d.legs, 2) : (d.alt ? pad(d.alt, w - 2) : base),
          act: pad(lean(base, base.length - (d.legs || 3), 1), w - 1),
        };
        if (k === 'bat') { frames.idle = base; frames.walk1 = base; frames.walk2 = pad(d.alt, w - 2); frames.act = pad(d.alt, w - 2); }
        for (const f in frames) {
          const s = bake(frames[f]);
          set[side + '_' + f] = s;
          set[side + '_' + f + '_m'] = flip(s);
          set[side + '_' + f + '_w'] = tint(s, '#ffffff', 1);
          set[side + '_' + f + '_mw'] = tint(set[side + '_' + f + '_m'], '#ffffff', 1);
        }
      }
      SP[k] = set;
    }
  }

  // 向き(0..3 は画面上の向き: 0=右下 1=左下 2=左上 3=右上)と姿勢から絵を選ぶ
  function frame(kind, sdir, pose, white) {
    const set = SP[kind];
    if (!set) return null;
    const side = (sdir === 0 || sdir === 1) ? 'F' : 'B';
    const mir = (sdir === 1 || sdir === 2);
    let key = side + '_' + pose + (mir ? '_m' : '');
    if (white) key = side + '_' + pose + (mir ? '_mw' : '_w');
    return set[key] || set[side + '_idle'];
  }

  const api = { PAL, build, frame, bake, flip, tint, SP };
  root.SPR19 = api;
})(typeof window !== 'undefined' ? window : globalThis);
