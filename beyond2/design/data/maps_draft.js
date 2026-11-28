// GUILDWARD 設計資料 — 地図の下書き（第一章の改良 m5・m6 と、第二章 m7〜m14）
// ・ゲーム本体からは読みこまれない。js/data.js の MAPS と同じ書き方にしてあり、実装のときの下書きに使う。
// ・hmap: 高さ（0-9）。'.' は谷。tmap: f 石 / g 草 / d 土 / p 板 / m 古い石畳 / x 立てない壁の上 / w 水 / r 速い水 / i 氷 / k 暗い石 / s 砂 / n 深い雪（新）
// ・座標 (x, y) は、x が列（左から 0）、y が行（上から 0）。data.js と同じ。
// ・新しい物の種類（icicle, snowball, lever, chime, icepillar, bridge の使い方など）は 05_COMBAT_TERRAIN_AND_ENEMIES.md を見る。
// ・会話・ヒント・依頼板の文は、各依頼の仕様書（missions/）にある。ここは配置だけ。
// ・node design/data/check_maps.js で、寸法・配置・主な道すじを現行の js/sim.js に照らして確かめられる。
'use strict';
const MAPS = {};

// ---------------------------------------------------------------- 第一章の改良
// m5 川辺の村の米倉：大岩を「橋の列」と「飛び石の列」の手前に下ろす。右の丘へ上がる段を足す。
MAPS.m5 = {
  id: 'm5', base: 'm5', note: 'js/data.js の m5 との差分だけを書く',
  hmapPatch: [[12, 11, '4']],                 // (12,11) を高さ 3 → 4（右の丘へ上がる段）
  objsRemove: [{ k: 'boulder', x: 1, y: 7 }, { k: 'boulder', x: 12, y: 8 }],
  objsAdd: [{ k: 'boulder', x: 4, y: 8 }, { k: 'boulder', x: 11, y: 8 }],
};
// m6 岩喰い大亀：大岩を中段の左右の端へ。石柱は下の段へ。
MAPS.m6 = {
  id: 'm6', base: 'm6', note: 'js/data.js の m6 との差分だけを書く',
  objsRemove: [{ k: 'boulder', x: 4, y: 3 }, { k: 'boulder', x: 10, y: 3 }, { k: 'pillar', x: 2, y: 6 }, { k: 'pillar', x: 12, y: 6 }],
  objsAdd: [{ k: 'boulder', x: 1, y: 6 }, { k: 'boulder', x: 13, y: 6 }, { k: 'pillar', x: 2, y: 9 }, { k: 'pillar', x: 12, y: 9 }],
};

// ---------------------------------------------------------------- 第二章
// m7 峠の茶屋の荷（荷の回収・第二章の入口）
MAPS.m7 = {
  id: 'm7', name: '峠の茶屋の荷', area: '北の峠・ふもとの茶屋道', W: 14, H: 13,
  hmap: [
    '99999666699999',
    '4444444446.444',
    '6444444444.444',
    '6444444444.444',
    '4444444444.444',
    '4444444424.999',
    '22222222222222',
    '22222222222442',
    '22222222222222',
    '22222222222222',
    '11111111111111',
    '22222222222222',
    '22222222222222',
  ],
  tmap: [
    'xxxxxkkkkxxxxx',
    'ffffffffff.ggd',
    'kfffffffff.dgg',
    'kffffffffp.pgg',
    'ffffffffff.ggg',
    'ffffffffff.xxx',
    'nnnnnnddnnnnnn',
    'nnnnnnddnnnffn',
    'nnnnnnddnnnnnn',
    'nnnnnnddnnnnnn',
    'wwwwwwwwwwwwww',
    'nnnnnnddnnnnnn',
    'nnndnnddnnnnnn',
  ],
  objs: [
    { id: 'icA', k: 'icicle', x: 6, y: 10 },                       // 小川の上。落ちると氷の飛び石
    { id: 'icB', k: 'icicle', x: 2, y: 6 },                        // 崖の下。落ちると氷のかたまり（足場）
    { id: 'icC', k: 'icicle', x: 11, y: 7 },                       // 岩の上の射手の頭上
    { id: 'c1', k: 'crate', x: 9, y: 11 },
    { id: 'c2', k: 'crate', x: 4, y: 8 },
    { id: 'c3', k: 'crate', x: 9, y: 1 },                          // 石の柱（高さ6）の上
    { id: 'ck', k: 'crack', x: 8, y: 5, h: 2 },                    // 崖の切れこみをふさぐ岩
    { id: 'an', k: 'anchor', x: 0, y: 3 },
    { id: 'chHook', k: 'chest', x: 0, y: 2, item: 'hook', up: 'hook' },
    { id: 'chCoin', k: 'chest', x: 6, y: 0, coins: 60 },
    { id: 'lv', k: 'lever', x: 11, y: 2, on: 'lower:br' },
    { id: 'br', k: 'bridge', cells: [[10, 3]], z: 4, down: false },
    { id: 'chKettle', k: 'chest', x: 12, y: 1, item: 'kettle' },
    { k: 'wagon', x: 12, y: 12 },
    { k: 'deco', sub: 'tree', x: 0, y: 12, h: 3 }, { k: 'deco', sub: 'tree', x: 13, y: 9, h: 3 }, { k: 'deco', sub: 'rock', x: 1, y: 8, h: 1 },
  ],
  start: [[6, 12, 3], [7, 11, 3], [5, 12, 3]],
  enemies: [
    { k: 'snowgob', x: 4, y: 7, wake: 3 }, { k: 'snowgob', x: 8, y: 7, wake: 3 }, { k: 'snowgob', x: 2, y: 8, wake: 3 },
    { k: 'archer', x: 11, y: 7, wake: 5 },
    { k: 'snowgob', x: 12, y: 3, wake: 3, grp: 2 }, { k: 'snowgob', x: 13, y: 2, wake: 3, grp: 2 }, { k: 'archer', x: 13, y: 4, wake: 3, grp: 2 },
  ],
  objective: { k: 'item', item: 'kettle' },
};

// m8 風守りの里（装置・ナギと出会う。ナギは同行のゲスト＝4人目）
MAPS.m8 = {
  id: 'm8', name: '風守りの里', area: '北の峠・風守りの里', W: 15, H: 13, guest: 'nagi',
  hmap: [
    '99.......333.99',
    '99..55553333.33',
    '99..55553333.33',
    '99..55553353.33',
    '99.333343333.99',
    '33.333333333333',
    '33.333333333333',
    '33.333333333333',
    '33.333333333333',
    '33.333333333333',
    '993333333333333',
    '333333333333333',
    '333333333333333',
  ],
  tmap: [
    'xx.......nnn.xx',
    'xx..gggdnnnn.ff',
    'xx..gdggndnp.pf',
    'xx..ggggnnfn.ff',
    'xx.nnnndnnnn.xx',
    'nn.nnndddnnnnnn',
    'nn.nndddddnnnnn',
    'nd.ndddddddnnnn',
    'nn.nndddddnnnnn',
    'nn.nnndddnnnnnn',
    'xxnnnndddnnnnnn',
    'nnnnnndddnnnnnn',
    'nnnnnndddnnnnnn',
  ],
  objs: [
    { id: 'chA', k: 'chime', x: 0, y: 7, on: 'rune:c1' },          // 西の岸（谷の向こう）
    { id: 'chB', k: 'chime', x: 14, y: 2, on: 'rune:c2' },         // 東の台（はね橋の先）
    { id: 'chC', k: 'chime', x: 4, y: 1, on: 'rune:c3' },          // 北西の丘（雪狼のねぐら）
    { id: 'an', k: 'anchor', x: 3, y: 5 },
    { id: 'chCoin', k: 'chest', x: 0, y: 5, coins: 50 },
    { id: 'pl', k: 'plate', x: 10, y: 3, on: 'lower:br2' },        // 2段上の岩の上の、重さの床
    { id: 'br2', k: 'bridge', cells: [[12, 2]], z: 3, down: false },
    { id: 'c1', k: 'crate', x: 10, y: 5 },
    { id: 'c2', k: 'crate', x: 8, y: 8 },
    { k: 'wagon', x: 13, y: 12 },
    { k: 'deco', sub: 'house', x: 3, y: 11, h: 3 }, { k: 'deco', sub: 'house', x: 11, y: 10, h: 3 }, { k: 'deco', sub: 'windmill', x: 9, y: 7, h: 3 },
  ],
  start: [[7, 11, 3], [6, 11, 3], [8, 11, 3], [7, 12, 3]],
  enemies: [
    { k: 'wolf', x: 5, y: 2, wake: 3 }, { k: 'wolf', x: 6, y: 1, wake: 3 }, { k: 'wolf', x: 6, y: 3, wake: 3 },
    { k: 'snowgob', x: 9, y: 1, wake: 3, grp: 2 }, { k: 'snowgob', x: 11, y: 1, wake: 3, grp: 2 },
  ],
  objective: { k: 'runes', need: 3, flags: ['c1', 'c2', 'c3'] },
};

// m9 氷の湖の漁師小屋（救助・探索が中心。氷の上をすべらせて、飛び石をつくる）
MAPS.m9 = {
  id: 'm9', name: '氷の湖の漁師小屋', area: '北の峠・鏡の湖', W: 15, H: 13,
  hmap: [
    '999999999999999',
    '111111111111199',
    '111111111122133',
    '111111111122133',
    '112211111111133',
    '112211111111133',
    '111111122111133',
    '111111111111133',
    '111111111111133',
    '111111111111133',
    '222222222222222',
    '222222222222222',
    '222222222222222',
  ],
  tmap: [
    'xxxxxxxxxxxxxxx',
    'wwwwwwwwwwwwwxx',
    'wwwwwwwwwwggwff',
    'wwwwwwwwwwggwff',
    'wwggwwwwwwwiiff',
    'wwggwwwwwwiwwff',
    'wwwwwwwggiwiiff',
    'wwwiwwwiwwwwwff',
    'wwwwwwwwwwwwwff',
    'wwwiwwwiwwwwwff',
    'nnndnnndnnnnnnn',
    'nnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnn',
  ],
  objs: [
    { id: 'c1', k: 'crate', x: 3, y: 11 },
    { id: 'c2', k: 'crate', x: 5, y: 11 },
    { id: 'c3', k: 'crate', x: 7, y: 11 },
    { id: 'c4', k: 'crate', x: 1, y: 11 },                          // 予備（岸の西の端）
    { id: 'sb1', k: 'snowball', x: 13, y: 4 },
    { id: 'sb2', k: 'snowball', x: 13, y: 6 },
    { id: 'chCoin', k: 'chest', x: 2, y: 4, coins: 60 },
    { id: 'chCharm', k: 'chest', x: 10, y: 2, item: 'scarf' },      // お守り「毛皮の襟巻」
    { k: 'wagon', x: 12, y: 12 },
    { k: 'deco', sub: 'hut', x: 2, y: 5, h: 2 }, { k: 'deco', sub: 'tree', x: 0, y: 12, h: 3 },
  ],
  npcs: [
    { id: 'fa', k: 'fisher', name: '漁師ゴヘイ', x: 3, y: 4, face: 1 },
    { id: 'fb', k: 'fisher', name: '漁師の子ミツ', x: 11, y: 2, face: 1 },
  ],
  start: [[9, 12, 3], [10, 12, 3], [9, 11, 3]],
  enemies: [
    { k: 'wisp', x: 5, y: 7, wake: 3 }, { k: 'wisp', x: 11, y: 8, wake: 3 }, { k: 'wisp', x: 6, y: 3, wake: 3 },
    { k: 'slime', x: 10, y: 3, wake: 2, grp: 2 }, { k: 'slime', x: 11, y: 3, wake: 2, grp: 2 },
  ],
  objective: { k: 'rescue', to: [[11, 12], [11, 11], [12, 11], [10, 11], [11, 10], [12, 10], [13, 11]] },
};

// m10 雪の坂の迎え撃ち（退治・三つの波。坂の上から雪玉と大岩を転がす）
// 坂の上の三段（y=5〜7）は、幅1の谷すじが五本（x=2,5,7,9,12）。どの谷すじの真上にも、転がす物が一つある。
MAPS.m10 = {
  id: 'm10', name: '雪の坂の迎え撃ち', area: '北の峠・関所の坂', W: 15, H: 15, startFight: 1,
  hmap: [
    '999999999999999',
    '966666666666669',
    '966666666666669',
    '966666666666669',
    '966666666666669',
    '995995959599599',
    '995995959599599',
    '994994949499499',
    '944444444444449',
    '933393333393339',
    '933393333393339',
    '922222222222229',
    '922222222222229',
    '922222222222229',
    '922222222222229',
  ],
  tmap: [
    'xxxxxxxxxxxxxxx',
    'xfffffffffffffx',
    'xffdfffffffdffx',
    'xfffffffffffffx',
    'xfffffffffffffx',
    'xxnxxnxnxnxxnxx',
    'xxnxxnxnxnxxnxx',
    'xxnxxnxnxnxxnxx',
    'xnnnnnnnnnnnnnx',
    'xnnnxnnnnnxnnnx',
    'xnnnxnnnnnxnnnx',
    'xnnnnnndnnnnnnx',
    'xnnnnndddnnnnnx',
    'xnnnnnndnnnnnnx',
    'xnnnnnnnnnnnnnx',
  ],
  objs: [
    { id: 'sbL', k: 'snowball', x: 2, y: 3 },
    { id: 'sbC', k: 'snowball', x: 7, y: 3 },
    { id: 'sbR', k: 'snowball', x: 12, y: 3 },
    { id: 'bdL', k: 'boulder', x: 5, y: 3 },
    { id: 'bdR', k: 'boulder', x: 9, y: 3 },
    { id: 'c1', k: 'crate', x: 4, y: 2 },
    { id: 'c2', k: 'crate', x: 10, y: 2 },
    { k: 'deco', sub: 'hut', x: 7, y: 1, h: 3 },
  ],
  start: [[7, 2, 1], [6, 2, 1], [8, 2, 1]],
  enemies: [
    { k: 'snowgob', x: 2, y: 13, wake: 99 }, { k: 'snowgob', x: 6, y: 13, wake: 99 }, { k: 'snowgob', x: 8, y: 12, wake: 99 }, { k: 'snowgob', x: 12, y: 13, wake: 99 },
  ],
  waves: [
    { turn: 3, text: '第二波！', units: [{ k: 'wolf', x: 2, y: 14 }, { k: 'wolf', x: 7, y: 14 }, { k: 'wolf', x: 12, y: 14 }, { k: 'snowgob', x: 5, y: 13 }, { k: 'snowgob', x: 9, y: 13 }] },
    { turn: 5, text: '最後の波！', units: [{ k: 'icegolem', x: 7, y: 14 }, { k: 'snowgob', x: 1, y: 13 }, { k: 'snowgob', x: 3, y: 13 }, { k: 'snowgob', x: 11, y: 13 }, { k: 'snowgob', x: 13, y: 13 }, { k: 'archer', x: 6, y: 14 }, { k: 'archer', x: 8, y: 14 }] },
  ],
  objective: { k: 'kill' },
};

// m11 風穴の氷室（遺跡調査：六つの装置のうち四つ。リコの装置が二つ、仲間ひとりにつき一つ）
MAPS.m11 = {
  id: 'm11', name: '風穴の氷室', area: '北の峠・風穴', W: 15, H: 15,
  hmap: [
    '999999999999999',
    '999993333399999',
    '999993333399999',
    '999999939999999',
    '933553333333.99',
    '933553333333.33',
    '333333333333.33',
    '333333333333.33',
    '333333333333.33',
    '933333333333.99',
    '933333333334999',
    '933333333555999',
    '933333333555999',
    '933333333555999',
    '933333333999999',
  ],
  tmap: [
    'xxxxxxxxxxxxxxx',
    'xxxxxmmmmmxxxxx',
    'xxxxxmmmmmxxxxx',
    'xxxxxxxmxxxxxxx',
    'xkkmmkkkkkkk.xx',
    'xkkmmkkkkkkk.kk',
    'mwwkkkiiiiii.kk',
    'mwwkkkiiiiii.kk',
    'mwwkkkiiiiii.kk',
    'xkkkkkkkkkkk.xx',
    'xkkkkkkkkkkkxxx',
    'xkkkkkkkkmmmxxx',
    'xkkkkkkkkmmmxxx',
    'xkkkkkkkkmmmxxx',
    'xkkkkkkkkxxxxxx',
  ],
  objs: [
    { id: 'gate', k: 'door', x: 7, y: 3, h: 4, lamps: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'] },
    { id: 'chTab', k: 'chest', x: 7, y: 1, item: 'tablet2' },
    { id: 'chCoin', k: 'chest', x: 9, y: 2, coins: 70 },
    { id: 'tg', k: 'target', x: 11, y: 2, on: 'rune:r1' },          // リコ：的（壁の高い所）
    { id: 'lv', k: 'lever', x: 13, y: 6, on: 'rune:r2' },           // リコ：レバー（谷の向こう。引き鉤で引く）
    { id: 'cr', k: 'crystal', x: 0, y: 7, on: 'rune:r3' },          // セナ：霜の水晶
    { id: 'sl', k: 'crack', x: 2, y: 12, h: 2, rubble: false, on: 'rune:r4' },  // トビ：封印石
    { id: 'cm', k: 'chime', x: 3, y: 4, on: 'rune:r5' },            // ナギ：風鳴り石（2段上の壇の上）
    { id: 'pl', k: 'plate', x: 8, y: 12, need: 'block', on: 'rune:r6' },        // ガルド（押す）／トビ（発破）：重さの床
    { id: 'bk', k: 'block', x: 9, y: 12 },
    { id: 'c1', k: 'crate', x: 5, y: 7 },                           // 壇の足場にする木箱
    { id: 'c2', k: 'crate', x: 2, y: 10 },
    { id: 'an', k: 'anchor', x: 13, y: 5 },
    { id: 'chCoin2', k: 'chest', x: 14, y: 8, coins: 60 },
    { id: 'ic1', k: 'icicle', x: 8, y: 9 },
    { id: 'ic2', k: 'icicle', x: 4, y: 6 },
    { k: 'wagon', x: 4, y: 14 },
    { k: 'torch', x: 6, y: 4, fz: 2 }, { k: 'torch', x: 8, y: 4, fz: 2 },
  ],
  start: [[7, 13, 3], [6, 13, 3], [8, 13, 3]],
  enemies: [
    { k: 'icegolem', x: 4, y: 9, wake: 4 }, { k: 'icegolem', x: 9, y: 5, wake: 4 },
    { k: 'bat', x: 6, y: 5, wake: 4 }, { k: 'bat', x: 10, y: 9, wake: 4 }, { k: 'bat', x: 2, y: 10, wake: 4 },
    { k: 'archer', x: 14, y: 7, wake: 6 },
  ],
  objective: { k: 'runes', need: 4, flags: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'], on: 'open:gate', item: 'tablet2' },
};

// m12 灰色の狼の足あと（護衛：見つけたあと、けが人が荷馬車まで歩くのを守る。帰り道は先につくれる）
MAPS.m12 = {
  id: 'm12', name: '灰色の狼の足あと', area: '北の峠・三段の岩場', W: 15, H: 13,
  hmap: [
    '999999999999999',
    '977777777777779',
    '977777777777779',
    '564444444444444',
    '444444444444444',
    '444444444444444',
    '444444444444444',
    '311111111111111',
    '211111111111111',
    '111111111111111',
    '111111111111111',
    '111111111111111',
    '...............',
  ],
  tmap: [
    'xxxxxxxxxxxxxxx',
    'xnnnnnnnnnnkkkx',
    'xnnnnnnddddddnx',
    'ffnnnnnnnnnnnnn',
    'nnddddddddddddn',
    'nnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnn',
    'fnnnnnnnnnnndnn',
    'fnnnnnnnnnnndnn',
    'nnnnnnnnnnnndnn',
    'nnnnnnnnnddddnn',
    'nnnnnnnnnnnnnnn',
    '...............',
  ],
  objs: [
    { id: 'fA', k: 'fall', x: 10, y: 2, bx: 10, by: 3 },              // 上の段 → 中の段（セナ）
    { id: 'ckA', k: 'crack', x: 9, y: 3, h: 3, rh: 2 },             // 同（トビ。がれきは2段ぶん）
    { id: 'cA', k: 'crate', x: 11, y: 5 },                          // 同（(11,3) へ運ぶと下り段になる）
    { id: 'fB', k: 'fall', x: 10, y: 6, bx: 10, by: 7 },              // 中の段 → 下の段（セナ）
    { id: 'ckB', k: 'crack', x: 9, y: 7, h: 2 },                    // 同（トビ）
    { id: 'cB', k: 'crate', x: 11, y: 9 },                          // 同（(11,7) へ）
    { id: 'bd', k: 'boulder', x: 13, y: 4 },                        // 中の段の道（y=4）を西へ転がる
    { id: 'sb', k: 'snowball', x: 8, y: 2 },                       // 上の段（y=2）を西へ転がる
    { id: 'chCoin', k: 'chest', x: 1, y: 1, coins: 80 },
    { k: 'wagon', x: 13, y: 10 },
  ],
  npcs: [
    { id: 'rou', k: 'rou', name: 'ロウ', x: 12, y: 1, face: 1, escort: true, onFound: 'wake:2' },
    { id: 'kinu', k: 'kinu', name: 'キヌ', x: 13, y: 1, face: 1, escort: true },
  ],
  start: [[10, 10, 3], [9, 10, 3], [10, 11, 3]],
  enemies: [
    { k: 'wolf', x: 3, y: 5, wake: 3 }, { k: 'wolf', x: 4, y: 4, wake: 3 },
    { k: 'wolf', x: 5, y: 9, wake: 0, grp: 2 }, { k: 'wolf', x: 6, y: 10, wake: 0, grp: 2 }, { k: 'wolf', x: 3, y: 8, wake: 0, grp: 2 },
    { k: 'wolf', x: 1, y: 10, wake: 0, grp: 2 }, { k: 'wolf', x: 2, y: 9, wake: 0, grp: 2 },
    { k: 'icegolem', x: 5, y: 11, wake: 0, grp: 2 },
  ],
  objective: { k: 'escort', to: [[12, 9], [13, 9], [14, 9], [14, 10], [12, 11], [13, 11], [14, 11], [12, 10]] },
};

// m13 氷瀑の上の巣（任意・高難度。凍らない重い敵を、段と氷で落とす）
MAPS.m13 = {
  id: 'm13', name: '氷瀑の上の巣', area: '北の峠・氷瀑', W: 13, H: 14,
  hmap: [
    '9999999999999',
    '9777777777779',
    '9777777777779',
    '9777777777779',
    '9777777777779',
    '9444444444469',
    '9444444444459',
    '9444444444449',
    '9444444444449',
    '9444444444449',
    '9321111111119',
    '9111111111119',
    '9111111111119',
    '9...........9',
  ],
  tmap: [
    'xxxxxxxxxxxxx',
    'xkkkkkkkkkkkx',
    'xkkkkkkkkkkkx',
    'xkkkkkkkkkkkx',
    'xkkkiiiiikkkx',
    'xnnnnnnnnnffx',
    'xnnnnnnnnnnfx',
    'xnnnnnnnnnnnx',
    'xnnnnnnnnnnnx',
    'xnnniiiiinnnx',
    'xffnnnnnnnnnx',
    'xnnnnnnnnnnnx',
    'xnniiiiiiinnx',
    'x...........x',
  ],
  objs: [
    { id: 'bd', k: 'boulder', x: 6, y: 2 },                         // 列 x=6 を、三つの段をつらぬいて転がる
    { id: 'c1', k: 'crate', x: 5, y: 11 }, { id: 'c2', k: 'crate', x: 8, y: 11 },
    { id: 'c3', k: 'crate', x: 2, y: 7 }, { id: 'c4', k: 'crate', x: 9, y: 8 },
    { id: 'ic1', k: 'icicle', x: 6, y: 5 }, { id: 'ic2', k: 'icicle', x: 3, y: 5 }, { id: 'ic3', k: 'icicle', x: 9, y: 5 },
    { id: 'chCharm', k: 'chest', x: 11, y: 1, item: 'feather' },    // お守り「風切り羽」
    { id: 'chCoin', k: 'chest', x: 1, y: 5, coins: 80 },
    { k: 'wagon', x: 11, y: 12 },
  ],
  start: [[9, 12, 3], [8, 12, 3], [10, 11, 3]],
  enemies: [
    { k: 'wolf', x: 5, y: 7, wake: 4 }, { k: 'wolf', x: 7, y: 8, wake: 4 }, { k: 'wolf', x: 3, y: 6, wake: 4 },
    { k: 'icegolem', x: 9, y: 7, wake: 4 }, { k: 'archer', x: 6, y: 4, wake: 6 },
    { k: 'icegolem', x: 4, y: 2, wake: 4, grp: 2 }, { k: 'icegolem', x: 8, y: 2, wake: 4, grp: 2 },
    { k: 'wolf', x: 6, y: 1, wake: 4, grp: 2 }, { k: 'wolf', x: 10, y: 2, wake: 4, grp: 2 }, { k: 'archer', x: 2, y: 1, wake: 4, grp: 2 },
  ],
  objective: { k: 'kill' },
};

// m14 雪喰い大猪（強敵討伐・第二章のしめくくり）
MAPS.m14 = {
  id: 'm14', name: '雪喰い大猪', area: '北の峠・頂の風の祠', W: 15, H: 15, startFight: 1,
  hmap: [
    '999999999999999',
    '933333333333339',
    '933333333333339',
    '933333333333339',
    '955333333333339',
    '955333333331119',
    '955333333331119',
    '955333333331119',
    '955333333331119',
    '955333333331119',
    '955333333333239',
    '943333333333339',
    '933333333333339',
    '933333333333339',
    '999999999999999',
  ],
  tmap: [
    'xxxxxxxxxxxxxxx',
    'xkkkkkkkkkkkkkx',
    'xkkkkkkkkkkkkkx',
    'xkkkkkkkkkkkkkx',
    'xffkkkkkkkkkkkx',
    'xffnnnnnnnnsssx',
    'xffkkkkkkkisssx',
    'xffkkkkkkkksssx',
    'xffkkkkkkkisssx',
    'xffnnnnnnnnsssx',
    'xffkkkkkkkkkskx',
    'xfkkkkkkkkkkkkx',
    'xkkkkkkkkkkkkkx',
    'xkkkkkkkkkkkkkx',
    'xxxxxxxxxxxxxxx',
  ],
  objs: [
    { id: 'ip1', k: 'icepillar', x: 5, y: 3 }, { id: 'ip2', k: 'icepillar', x: 9, y: 3 },
    { id: 'ip3', k: 'icepillar', x: 5, y: 11 }, { id: 'ip4', k: 'icepillar', x: 9, y: 11 },
    { id: 'ws', k: 'statue', sub: 'windstone', x: 7, y: 7, h: 2 },  // 眠っている風の石（かたい。大猪は止まるだけ）
    { id: 'cm1', k: 'chime', x: 2, y: 2, on: 'rune:w1' }, { id: 'cm2', k: 'chime', x: 12, y: 2, on: 'rune:w2' }, { id: 'cm3', k: 'chime', x: 7, y: 10, on: 'rune:w3' },
    { id: 'ic1', k: 'icicle', x: 4, y: 1 }, { id: 'ic2', k: 'icicle', x: 7, y: 1 }, { id: 'ic3', k: 'icicle', x: 10, y: 1 },
    { id: 'sb1', k: 'snowball', x: 2, y: 5 }, { id: 'sb2', k: 'snowball', x: 2, y: 9 },
    { id: 'c1', k: 'crate', x: 4, y: 12 }, { id: 'c2', k: 'crate', x: 10, y: 12 },
  ],
  start: [[7, 13, 3], [6, 13, 3], [8, 13, 3]],
  enemies: [
    { k: 'boar', x: 7, y: 3, boss: true, wake: 99 },
  ],
  waves: [
    { turn: 4, text: '雪狼が来た！', units: [{ k: 'wolf', x: 1, y: 1 }, { k: 'wolf', x: 13, y: 1 }] },
    { turn: 7, text: '雪小鬼が来た！', units: [{ k: 'snowgob', x: 1, y: 13 }, { k: 'snowgob', x: 13, y: 13 }, { k: 'snowgob', x: 7, y: 1 }] },
  ],
  objective: { k: 'boss' },
};

module.exports = MAPS;
