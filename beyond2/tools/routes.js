// GUILDWARD — 依頼ごと・編成ごとの「解き方の一例」（ネタバレ。戦いはボットが戦う）
// [仲間, 行動]。物の番号 oN は、地図の objs の並び順（id のないもの）から 1 ずつふられる。
// 編成の名前は同行する二人の頭文字：GS＝ガルドとセナ、GT＝ガルドとトビ、ST＝セナとトビ
'use strict';
module.exports = {
  m1: {
    GS: [
      ['gard', { k: 'push', ref: { o: 'o1' }, dir: 3 }],   // 木箱を高い段のすぐ下へ
      ['gard', { k: 'move', x: 9, y: 5 }],
      ['riko', { k: 'rope', o: 'o2' }],                     // 谷の向こうの輪へ（戦い）
      ['sena', { k: 'freeze', x: 2, y: 2 }],                // （寄り道）池を凍らせる
      ['gard', { k: 'move', x: 2, y: 1 }],                  // 銀貨
    ],
    // v0.2：受けなおしは自由編成（03 6.1）
    GT: [
      ['gard', { k: 'push', ref: { o: 'o1' }, dir: 3 }],
      ['gard', { k: 'move', x: 9, y: 5 }],
      ['riko', { k: 'rope', o: 'o2' }],
    ],
    ST: [
      ['tobi', { k: 'blast', x: 9, y: 9 }],                 // 木箱の手前で発破 → 高い段のすぐ下へ
      ['tobi', { k: 'move', x: 9, y: 5 }],
      ['riko', { k: 'rope', o: 'o2' }],
      ['sena', { k: 'freeze', x: 2, y: 2 }],                // （寄り道）
      ['tobi', { k: 'move', x: 2, y: 1 }],
    ],
    // v0.3：ナギ入りの受けなおし
    GN: [['gard', { k: 'push', ref: { o: 'o1' }, dir: 3 }], ['gard', { k: 'move', x: 9, y: 5 }], ['riko', { k: 'rope', o: 'o2' }]],
    SN: [['riko', { k: 'rope', o: 'o2' }], ['sena', { k: 'freeze', x: 2, y: 2 }], ['nagi', { k: 'move', x: 2, y: 1 }]],   // 長い鉤縄なら、下の畑から輪へ届く
    TN: [['tobi', { k: 'blast', x: 9, y: 9 }], ['tobi', { k: 'move', x: 9, y: 5 }], ['riko', { k: 'rope', o: 'o2' }]],
  },
  m2: {
    GS: [
      ['sena', { k: 'freeze', x: 6, y: 9 }],                // 堀を凍らせる
      ['gard', { k: 'move', x: 6, y: 7 }],                  // 戦い
      ['riko', { k: 'rope', o: 'o2' }],                     // 塔の中段へ
      ['gard', { k: 'push', ref: { o: 'o1' }, dir: 2 }],    // 台の上の木箱を落として足場に
      ['gard', { k: 'move', x: 5, y: 1 }],                  // 角笛
      ['riko', { k: 'shoot', ref: { o: 'o4' } }],           // （寄り道）的 → 倉の扉
      ['gard', { k: 'move', x: 0, y: 1 }],
    ],
    // v0.2：受けなおし。セナとトビ（ガルドとトビは堀を渡れない。VERIFICATION_v0.2.md）
    ST: [
      ['sena', { k: 'move', x: 6, y: 11 }],                 // 堀の手前（敵に気づかれて戦い）
      ['sena', { k: 'freeze', x: 6, y: 9 }, 'ice:6,9'],     // 堀を凍らせる（戦いの中で凍っていれば、とばす）
      ['sena', { k: 'move', x: 6, y: 7 }],
      ['riko', { k: 'rope', o: 'o2' }],
      ['tobi', { k: 'blast', x: 9, y: 2 }],                 // 台の上の木箱の奥で発破 → てっぺんのすぐ下へ
      ['riko', { k: 'move', x: 5, y: 1 }],                  // 角笛
    ],
    // v0.3：大うちわがあれば、ナギがトビとリコを堀の向こうへ運べる（ナギ自身は残る）
    TN: [
      ['nagi', { k: 'waft', ref: { u: 'tobi' }, dir: 3 }],
      ['nagi', { k: 'waft', ref: { u: 'tobi' }, dir: 3 }, 'yle:tobi:7'],   // 歩く途中で敵が起きたら、戦いのあとで
      ['nagi', { k: 'waft', ref: { u: 'riko' }, dir: 3 }],
      ['riko', { k: 'rope', o: 'o2' }],
      ['tobi', { k: 'blast', x: 9, y: 2 }],
      ['riko', { k: 'move', x: 5, y: 1 }],
    ],
  },
  m3: {
    GS: [
      ['gard', { k: 'move', x: 7, y: 7 }],                  // コウモリと戦い
      ['gard', { k: 'push', ref: { o: 'o1' }, dir: 3 }],    // 木箱で台へ
      ['gard', { k: 'move', x: 7, y: 1 }],                  // 銀貨（台の上）
      ['riko', { k: 'rope', o: 'o2' }],                     // 岩棚へ。トビを見つける → 岩人形と戦い
      ['tb', { k: 'blast', x: 1, y: 6 }],                   // ひび割れた岩 → 鉱夫が帰れる
      ['sena', { k: 'freeze', ref: { o: 'o3' } }],          // 滝を凍らせる → トビが帰れる
    ],
    // v0.3：セナ＋ナギ（滝を凍らせて台へ。トビは発破、帰りは氷の段）。ガルド＋ナギは、トビが下りる道がない（VERIFICATION_v0.3.md）
    // ガルド＋ナギ：大うちわ（3升）があれば、木箱を岩棚の下まで運び、トビの発破で足場にできる（滝は凍らせられない）
    GN: [
      ['gard', { k: 'move', x: 7, y: 7 }],
      ['riko', { k: 'move', x: 5, y: 3 }],
      ['nagi', { k: 'waft', ref: { u: 'riko' }, dir: 3 }],
      ['riko', { k: 'rope', o: 'o2' }],
      ['gard', { k: 'push', ref: { o: 'o1' }, dir: 1 }],
      ['nagi', { k: 'waft', ref: { o: 'o1' }, dir: 2 }],
      ['nagi', { k: 'waft', ref: { o: 'o1' }, dir: 2 }],
      ['tb', { k: 'blast', x: 0, y: 6 }],
    ],
    // 滝を先に凍らせると、見つけたトビがすぐ帰ってしまい、ひび岩を砕けない（v0.1 からの落とし穴。VERIFICATION_v0.3.md）。台へはナギがリコを運ぶ
    SN: [
      ['sena', { k: 'move', x: 7, y: 7 }],
      ['riko', { k: 'move', x: 5, y: 3 }],
      ['nagi', { k: 'waft', ref: { u: 'riko' }, dir: 3 }],
      ['riko', { k: 'rope', o: 'o2' }],
      ['tb', { k: 'blast', x: 1, y: 6 }],
      ['sena', { k: 'freeze', ref: { o: 'o3' } }],
    ],
  },
  m4: {
    GS: [
      ['gard', { k: 'move', x: 7, y: 9 }],                  // 戦い
      ['riko', { k: 'shoot', ref: { o: 'o3' } }],           // 的
      ['sena', { k: 'freeze', ref: { o: 'o4' } }],          // 霜の水晶
      ['gard', { k: 'push', ref: { o: 'o5' }, dir: 2 }, 'r3'],    // 石のブロックを重さの床へ
      ['gard', { k: 'move', x: 7, y: 1 }],                  // 石板
    ],
    GT: [
      ['gard', { k: 'move', x: 7, y: 9 }],
      ['riko', { k: 'shoot', ref: { o: 'o3' } }],
      ['tobi', { k: 'blast', x: 2, y: 12 }, 'r4'],                // 封印石
      ['gard', { k: 'push', ref: { o: 'o5' }, dir: 2 }, 'r3'],
      ['gard', { k: 'move', x: 7, y: 1 }],
    ],
    ST: [
      ['sena', { k: 'move', x: 7, y: 9 }],
      ['sena', { k: 'freeze', ref: { o: 'o4' } }],          // 霜の水晶
      ['tobi', { k: 'blast', x: 2, y: 12 }, 'r4'],                // 封印石
      ['tobi', { k: 'blast', x: 12, y: 7 }, 'r3'],                // 石のブロックの奥で発破 → 重さの床へ
      ['riko', { k: 'move', x: 7, y: 1 }],
    ],
    // v0.3：トビ＋ナギ（的・封印石・重さの床）。ガルド＋ナギは装置が二つまで（VERIFICATION_v0.3.md）
    TN: [
      ['tobi', { k: 'move', x: 7, y: 9 }],
      ['riko', { k: 'shoot', ref: { o: 'o3' } }, 'r1'],
      ['tobi', { k: 'blast', x: 2, y: 12 }, 'r4'],
      ['tobi', { k: 'blast', x: 12, y: 7 }, 'r3'],
      ['riko', { k: 'move', x: 7, y: 1 }],
    ],
  },
  m5: { GS: [], GT: [], ST: [], GN: [], SN: [], TN: [] },   // 入るとすぐ戦い（ボットが戦う）
  m6: { GS: [], GT: [], ST: [], GN: [], SN: [], TN: [] },
  // ---------- 第二章（v0.3） ----------
  // m7 本線はリコの手だけ（つらら・鉤縄・引き鉤）。どの二人でも同じ手順（missions/chapter2/m7 の6章）
  m7: (() => {
    const main = [
      ['riko', { k: 'shoot', ref: { o: 'icA' } }],             // 小川の上のつらら → 氷の飛び石
      ['riko', { k: 'move', x: 6, y: 8 }],                     // 北の岸へ → 雪原の戦い（ボット）
      ['riko', { k: 'shoot', ref: { o: 'icB' } }, 'gone:icB'], // 崖の下のつらら → 氷のかたまり（戦いの中で落としていれば、とばす）
      ['riko', { k: 'rope', o: 'an' }],                        // 上の段から、高い棚の鉄の輪へ
      ['riko', { k: 'move', x: 0, y: 2 }],                     // 引き鉤
      ['riko', { k: 'pull', ref: { o: 'lv' } }],               // 谷の向こうのレバー → はね橋
      ['riko', { k: 'move', x: 10, y: 3 }],                    // 橋へ → 野営地の戦い（ボット）
      ['riko', { k: 'move', x: 12, y: 1 }],                    // 茶釜
      ['riko', { k: 'pull', ref: { o: 'c3' }, dir: 2 }],       // （寄り道）柱の上の木箱を引く → 足場
      ['riko', { k: 'move', x: 6, y: 0 }],                     // 銀貨60
    ];
    const tail = main.slice(3);
    return {
      GS: main, GT: main, ST: main, GN: main, SN: main, TN: main,   // ナギが加わったあとの受けなおしでも、本線はリコの手だけ
      // 別の手（6章の表）：小川と崖を、仲間の力で越える
      'GS:alt': [['sena', { k: 'freeze', x: 6, y: 10 }], ['gard', { k: 'move', x: 6, y: 8 }], ['gard', { k: 'push', ref: { o: 'c2' }, dir: 3 }, 'gone:c2'], ['gard', { k: 'push', ref: { o: 'c2' }, dir: 3 }, 'gone:c2'], ['gard', { k: 'move', x: 4, y: 5 }]].concat(tail),
      // 木箱 c1 のうしろ (9,12) は、岩の上の射手が起きる距離（5）の内。戦いのあとで押しなおす
      'GT:alt': [['gard', { k: 'push', ref: { o: 'c1' }, dir: 3 }], ['gard', { k: 'push', ref: { o: 'c1' }, dir: 3 }, 'gone:c1'], ['gard', { k: 'move', x: 9, y: 8 }], ['tobi', { k: 'blast', x: 8, y: 5 }], ['tobi', { k: 'move', x: 8, y: 4 }]].concat(tail),
      'ST:alt': [['tobi', { k: 'blast', x: 9, y: 12 }], ['tobi', { k: 'move', x: 9, y: 8 }], ['tobi', { k: 'blast', x: 8, y: 5 }, 'gone:ck'], ['tobi', { k: 'move', x: 8, y: 4 }]].concat(tail),
    };
  })(),
  // m8 風守りの里：ナギはゲスト（4人目）。三つの石の手順（missions/chapter2/m8 の6章）。雪狼・雪小鬼との戦いはボット
  m8: (() => {
    const main = [
      // A：リコを西の岸へ運び、鉤縄で戻って縄の道。ナギが縄を渡って石を鳴らす
      ['riko', { k: 'move', x: 3, y: 7 }],
      ['nagi', { k: 'waft', ref: { u: 'riko' }, dir: 2 }],
      ['riko', { k: 'rope', o: 'an' }],
      ['nagi', { k: 'waft', ref: { o: 'chA' } }],
      ['nagi', { k: 'move', x: 0, y: 5 }],                          // 銀貨50
      // B：木箱を、2段上の岩の上の重さの床へ → はね橋 → 雪小鬼（ボット）→ 石
      ['nagi', { k: 'waft', ref: { o: 'c1' }, dir: 3 }, 'down:br2'],
      ['nagi', { k: 'waft', ref: { o: 'c1' }, dir: 3 }, 'down:br2'],   // 西の岸から歩く途中で雪狼が起きたら、戦いのあとで
      ['nagi', { k: 'waft', ref: { o: 'c1' }, dir: 3 }, 'down:br2'],   // ついてくる仲間が橋のたもとで雪小鬼を起こしたら、もう一度
      ['nagi', { k: 'waft', ref: { o: 'chB' } }, 'c2'],
      ['nagi', { k: 'waft', ref: { o: 'chB' } }, 'c2'],             // 戦いのあとで、もう一度
      // C：坂の下で雪狼が起きる（ボット）→ 丘の上の石
      ['nagi', { k: 'move', x: 7, y: 6 }],
      ['nagi', { k: 'waft', ref: { o: 'chC' } }, 'c3'],
      ['nagi', { k: 'waft', ref: { o: 'chC' } }, 'c3'],
    ];
    return { GS: main, GT: main, ST: main };
  })(),
};
