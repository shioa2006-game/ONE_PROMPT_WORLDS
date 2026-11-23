// せーの、星見の露台へ — 区画ごとの「探索の解き方の一例」（ネタバレ。戦いはボットが戦う）
// [仲間, 行動]。物の番号 oN は、区画の objs の並び順（id のないもの）から 1 ずつふられる。
'use strict';
module.exports = {
  s1: [
    ['gard', { k: 'push', ref: { o: 'o1' }, dir: 3 }],   // 木箱を段の下へ落として足場に
    ['gard', { k: 'move', x: 9, y: 6 }],
    ['riko', { k: 'rope', o: 'o2' }],                     // 谷の向こうの鉄の輪へ
    ['gard', { k: 'move', x: 3, y: 7 }],                  // ここで戦い
    ['sena', { k: 'freeze', x: 3, y: 4 }],                // 池を凍らせる
    ['sena', { k: 'freeze', ref: { o: 'o3' } }],          // （寄り道）小さな滝を凍らせる
    ['gard', { k: 'move', x: 0, y: 2 }],                  // 覚え書き1
    ['gard', { k: 'move', x: 3, y: 1 }],                  // 門
  ],
  s2: [
    ['gard', { k: 'move', x: 3, y: 6 }],                  // 近づくと戦い
    ['gard', { k: 'push', ref: { o: 'o3' }, dir: 0 }],    // （寄り道）木箱を池に沈めて飛び石に
    ['gard', { k: 'move', x: 13, y: 11 }],                // 覚え書き2
    ['riko', { k: 'shoot', ref: { o: 'o1' } }],           // 的を射ると跳ね橋が下りる
    ['gard', { k: 'move', x: 6, y: 0 }],
  ],
  s3: [
    ['sena', { k: 'freeze', x: 2, y: 8 }],                // 手前の水路を凍らせる
    ['gard', { k: 'move', x: 2, y: 6 }],                  // 戦い（粘体）
    ['sena', { k: 'freeze', x: 5, y: 5 }],                // 石の通り道を凍らせる
    ['sena', { k: 'freeze', x: 8, y: 5 }],
    ['gard', { k: 'push', ref: { o: 'o1' }, dir: 0 }],    // 石が氷をすべって、速い流れに沈み飛び石に
    ['gard', { k: 'move', x: 11, y: 5 }],
    ['sena', { k: 'freeze', ref: { o: 'o2' } }],          // 滝を凍らせて氷の段
    ['gard', { k: 'move', x: 12, y: 0 }],                 // 長い鉤縄
    ['riko', { k: 'rope', o: 'o4' }],                     // 遠い輪へ
    ['gard', { k: 'move', x: 1, y: 0 }],
  ],
};
module.exports.s4 = [
  ['riko', { k: 'rope', o: 'o1' }],                     // 長い鉤縄で柱Aへ（コウモリと戦い）
  ['gard', { k: 'move', x: 8, y: 7 }],
  ['riko', { k: 'rope', o: 'o4' }],                     // （寄り道）木箱の上から高い柱へ
  ['gard', { k: 'move', x: 9, y: 8 }],
  ['riko', { k: 'rope', o: 'o2' }],                     // 柱Bへ
  ['gard', { k: 'move', x: 12, y: 3 }],
  ['riko', { k: 'rope', o: 'o3' }],                     // 奥の棚へ（射手と戦い）
  ['gard', { k: 'move', x: 13, y: 1 }],
  ['gard', { k: 'move', x: 15, y: 0 }],
];
module.exports.s5 = [
  ['gard', { k: 'move', x: 7, y: 9 }],                  // 戦い（岩人形）
  ['gard', { k: 'move', x: 2, y: 1 }],                  // 巨人の籠手
  ['gard', { k: 'push', ref: { o: 'o2' }, dir: 3 }],    // （寄り道）石柱を倒して足場に
  ['gard', { k: 'move', x: 13, y: 7 }],                 // 覚え書き4
  ['gard', { k: 'push', ref: { o: 'o1' }, dir: 0 }],    // 石柱を倒して谷に橋
  ['gard', { k: 'move', x: 13, y: 1 }],
];
module.exports.s6 = [
  ['gard', { k: 'move', x: 6, y: 11 }],                 // 下の群れ
  ['gard', { k: 'move', x: 6, y: 15 }],
  ['gard', { k: 'move', x: 6, y: 15 }],
];
module.exports.s7 = [
  ['gard', { k: 'move', x: 6, y: 10 }],                 // 戦い
  ['riko', { k: 'shoot', ref: { o: 'o2' } }],           // 左の水門
  ['riko', { k: 'rope', o: 'o5' }],                     // 右の棚へ
  ['gard', { k: 'move', x: 13, y: 1 }],
  ['gard', { k: 'push', ref: { o: 'o3' }, dir: 2 }],    // 大岩で右の水路をせき止める
  ['gard', { k: 'move', x: 8, y: 7 }],
  ['sena', { k: 'freeze', x: 8, y: 5 }],
  ['sena', { k: 'freeze', ref: { o: 'o1' } }],          // 凍らぬ滝を凍らせる
  ['gard', { k: 'move', x: 7, y: 1 }],
  ['gard', { k: 'light' }],
];
