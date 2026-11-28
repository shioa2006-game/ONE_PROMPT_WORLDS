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
  },
  m5: { GS: [], GT: [], ST: [] },   // 入るとすぐ戦い（ボットが戦う）
  m6: { GS: [], GT: [], ST: [] },
};
