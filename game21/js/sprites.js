// だれと行く？ — ドット絵（文字列で描き、外枠は自動でつける）
// 第19作のリコ・ガルド・セナ・敵の絵を引きつぎ、トビ・ギルドの人々・大亀を描きたした。
// 差しかえ口：SPR21.useImage(種類, 画像, {w, h, frames}) で、外部で作ったスプライト画像に置きかえられる（frame() の返す形は同じ）。
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
    // 第20作で足した色
    '1': '#9a5ad8', '2': '#5e2e96', // トビの紫のバンダナ
    '3': '#e0b040', '4': '#a8e4ff', // 真鍮のゴーグル・レンズ
    '5': '#2c2634', '6': '#ff9a2a', // 発破玉・火花
    '7': '#f4d860', '8': '#5a9a6a', '9': '#346a46', '0': '#f6f2e8', // 黄色い髪・緑の服・白い前掛け
    '#': '#6a4a8a', '$': '#c8a070', '%': '#b0b0b8', '&': '#8a6a3a', '@': '#d86a5a', // 濃い紫・麦わら・灰の髪・杖・頬
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

  // ---------- トビ（発破師） ----------
  const TOBI_F = [
    '.....1111.....',
    '....112211....',
    '...11111111...',
    '...34433443...',
    '...BssssssB...',
    '...seSsseSs...',
    '....ss@@ss....',
    '...1cssssc1...',
    '..11cccccc11..',
    '.111cccccc111.',
    '.s11565656c1s6',
    '.s.1cccccc1.55',
    '...1ccc$cc1.55',
    '...bbbbybbb...',
    '....cccccc....',
    '....cc..cc....',
    '....bb..bb....',
    '....bb..bb....',
    '....BB..BB....',
    '...BBB..BBB...',
  ];
  const TOBI_B = [
    '.....1111.....',
    '....111111....',
    '...11111111...',
    '...31111113...',
    '...BBBBBBBB...',
    '...BBBBBBBB...',
    '....BBBBBB....',
    '...11111111...',
    '..1111111111..',
    '.c1111111111c.',
    '6s5511111111s.',
    '.s5511111111..',
    '..55b1111111..',
    '...bbbbbbbb...',
    '....111111....',
    '....11..11....',
    '....bb..bb....',
    '....bb..bb....',
    '....BB..BB....',
    '...BBB..BBB...',
  ];
  // ---------- ギルドの人々（前向きだけ。うしろ向きは同じ絵） ----------
  const MIMOZA_F = [
    '.....7777.....',
    '....777777....',
    '...77777777...',
    '..777ssss777..',
    '..77m4mm4m77..',
    '..77ssssss77..',
    '...7s@ss@s7...',
    '....ssssss....',
    '...88800888...',
    '..8880000888..',
    '.s8800000088s.',
    '.s.800000008.s',
    '...800000008..',
    '...888888888..',
    '...899999998..',
    '...888888888..',
    '....88888888..',
    '.....BB..BB...',
    '....BBB..BBB..',
  ];
  const DORA_F = [
    '....hhhhhh....',
    '...hhhhhhhh...',
    '..hhHhhhhhHh..',
    '..hssssssssh..',
    '..h55sssesSh..',
    '..hssssssssh..',
    '...sss@@sss...',
    '..bbbsssssbbb.',
    '.bbccbbbbbccbb',
    'bbcccbbybbcccb',
    'ssbccbbbbbccbs',
    'ss.bbrrrrrbb.s',
    '...bbrrrrrbb..',
    '...BBBBBBBBB..',
    '...bbbbbbbbb..',
    '...bbb...bbb..',
    '...BBB...BBB..',
    '..BBBB...BBBB.',
  ];
  const TONBO_F = [
    '....ssssss....',
    '...ssssssss...',
    '...sesssses...',
    '...ssSssSss...',
    '..5555555555..',
    '..5555555555..',
    '.s.55555555.s.',
    'ss.cc5555cc.ss',
    'ss.cccc5ccc.ss',
    '.m.cccccccc.s.',
    'mm.cccccccc...',
    '.m.cccccccc...',
    '...BBBBBBBB...',
    '...bbb..bbb...',
    '...bbb..bbb...',
    '..BBBB..BBBB..',
  ];
  const HANS_F = [
    '..$$$$$$$$$$..',
    '.$$$$$$$$$$$$.',
    '...$$$$$$$$...',
    '....ssssss....',
    '....sesses....',
    '....ss@@ss....',
    '...gggsssggg..',
    '..ggvgggggvgg.',
    '.ssvvvvvvvvvss',
    '.s.vvvvvvvvv.s',
    '...vvvvvvvvv..',
    '...vvvv.vvvv..',
    '...vvv...vvv..',
    '...bbb...bbb..',
    '..BBBB...BBBB.',
  ];
  const MINER_F = [
    '.....u33u.....',
    '....uuuuuu....',
    '...uuuuuuuu...',
    '..mmmmmmmmmm..',
    '...ssssssss...',
    '...sesssses...',
    '...ssSSSSss...',
    '...%%%%%%%%...',
    '..%%%%%%%%%%..',
    '.s%%%%%%%%%%s&',
    '.s.%%%%%%%%.s&',
    '...bbbbbbbb..&',
    '...bbbb.bbbb.&',
    '...bbb...bbb..',
    '..BBBB...BBBB.',
  ];
  const KID_F = [
    '..............',
    '....rrrrrr....',
    '...rrrrrrrr...',
    '....hhhhhh....',
    '....sesses....',
    '....ss@@ss....',
    '....uuuuuu....',
    '...uuuuuuuu...',
    '...suuuuuus...',
    '....vvvvvv....',
    '....vv..vv....',
    '....BB..BB....',
  ];
  const ELDER_F = [
    '.....%%%%.....',
    '....%%%%%%....',
    '...%%ssss%%...',
    '...%sesses%...',
    '....ssSSss....',
    '...########...',
    '..##########..',
    '.s####00####s&',
    '.s.########..&',
    '...########..&',
    '...########..&',
    '...########..&',
    '....BB..BB....',
  ];
  // ---------- 大亀（強敵） ----------
  const TURTLE_F = [
    '........zzzzzz..........',
    '......zzZzzgzzzz........',
    '.....zzgzzzzzZzgz.......',
    '....zzzzzZzzzzzzzz......',
    '...zZzzzggzzzZzzzzz.....',
    '...zzzzgzzzzzzzzgzz.....',
    '..zzzZzzzzzZzzzzzzzzaaa.',
    '..ZZZZZZZZZZZZZZZZZZaada',
    '..ZzZzZzZzZzZzZzZzZaaaaa',
    '...aaa..........aaaaAAa.',
    '..aAaa.........aaa......',
    '..AAA..........AAA......',
  ];
  const TURTLE_B = [
    '..........zzzzzz........',
    '........zzzzgzzZzz......',
    '.......zgzZzzzzzgzz.....',
    '......zzzzzzzzzzZzzz....',
    '.....zzzzzZzzzggzzzZz...',
    '.....zzgzzzzzzzzgzzzz...',
    '.aaazzzzzzzzzzZzzzzZzz..',
    'aaaaZZZZZZZZZZZZZZZZZZ..',
    'aAaaZzZzZzZzZzZzZzZzZ...',
    '.aa.aaa..........aaa....',
    '....aaaA.........aAaa...',
    '.....AAA..........AAA...',
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
      raider: { F: GOBLIN_F, B: GOBLIN_B, legs: 2, pal: { a: '#b0a048', A: '#7a6a2a', b: '#5a4a6a', B: '#3a2e48' } },
      tobi: { F: TOBI_F, B: TOBI_B, legs: 4 },
      mimoza: { F: MIMOZA_F, B: MIMOZA_F, legs: 0 },
      dora: { F: DORA_F, B: DORA_F, legs: 3 },
      tonbo: { F: TONBO_F, B: TONBO_F, legs: 3 },
      hans: { F: HANS_F, B: HANS_F, legs: 3 },
      miner: { F: MINER_F, B: MINER_F, legs: 3 },
      kid: { F: KID_F, B: KID_F, legs: 2 },
      elder: { F: ELDER_F, B: ELDER_F, legs: 0 },
      turtle: { F: TURTLE_F, B: TURTLE_B, legs: 3, pal: { z: '#7a5a3a', Z: '#4a3422', g: '#6a9a3a', a: '#a8a060', A: '#6a6030', d: '#ff4a2a' } },
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
          const s = bake(frames[f], { pal: d.pal });
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
    if (EXT[kind]) return extFrame(kind, sdir, pose, white);
    const set = SP[kind];
    if (!set) return null;
    const side = (sdir === 0 || sdir === 1) ? 'F' : 'B';
    const mir = (sdir === 1 || sdir === 2);
    let key = side + '_' + pose + (mir ? '_m' : '');
    if (white) key = side + '_' + pose + (mir ? '_mw' : '_w');
    return set[key] || set[side + '_idle'];
  }

  // ---------- 外部画像への差しかえ口 ----------
  // layout: { w, h, frames: { 'F_idle': [列, 行], 'F_walk1': ..., 'B_idle': ... } }（画像を w×h のこまに区切った位置）
  const EXT = {};
  function useImage(kind, img, layout) {
    const set = {};
    const make = (key, col, row) => {
      const c = makeCanvas(layout.w, layout.h); if (!c) return;
      c.getContext('2d').drawImage(img, col * layout.w, row * layout.h, layout.w, layout.h, 0, 0, layout.w, layout.h);
      const s = { c, w: layout.w, h: layout.h };
      set[key] = s; set[key + '_m'] = flip(s); set[key + '_w'] = tint(s, '#ffffff', 1); set[key + '_mw'] = tint(set[key + '_m'], '#ffffff', 1);
    };
    for (const k in layout.frames) make(k, layout.frames[k][0], layout.frames[k][1]);
    EXT[kind] = set;
  }
  function extFrame(kind, sdir, pose, white) {
    const set = EXT[kind];
    const side = (sdir === 0 || sdir === 1) ? 'F' : 'B';
    const mir = (sdir === 1 || sdir === 2);
    const base = set[side + '_' + pose] ? side + '_' + pose : set[side + '_idle'] ? side + '_idle' : 'F_idle';
    return set[base + (white ? (mir ? '_mw' : '_w') : (mir ? '_m' : ''))] || set[base];
  }

  const api = { PAL, build, frame, bake, flip, tint, SP, useImage };
  root.SPR21 = api;
})(typeof window !== 'undefined' ? window : globalThis);
