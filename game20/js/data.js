// STAIRWARD — データ（地形・持ち場・仲間・敵・陣・物語）
// 座標は (x, y)。x は画面の右下へ、y は左下へ増える。高さ1段 = 8 画素。
(function (root) {
  'use strict';
  const D = {};

  D.W = 15; D.H = 15;
  // 地形の種類
  //  K 本丸（建物） p 石畳 r 岩 f 中庭 w 城壁の上 t 物見櫓 g 草地 d 土の道 v 谷
  //  G 門  A 石段（奥＝−y へ上る） B 石段（奥＝−x へ上る） R 坂道（−x へ上る）
  D.MAP_K = [
    'KKKpprrrrrrrrrr', // y0
    'KKKppppffffwggg', // y1
    'KKKppppffffwggg', // y2
    'pppppppffffwggg', // y3
    'pppppBBffffwggg', // y4
    'rrdvvffffffGRRR', // y5
    'rrAvvffffffwggg', // y6
    'rrdvvffffffwggg', // y7
    'rrAvvffffffwggg', // y8
    'rrdvvffffffwggg', // y9
    'rrArrwwwAwwtggg', // y10
    'rrAggggpppggggg', // y11
    'ggAgggggAgggggg', // y12
    'ggggggggAgggggg', // y13
    'ggggggggggggggg', // y14
  ];
  // 高さ（石段・坂は上側の高さ）
  D.MAP_Z = [
    '555556666666543',
    '555555533334210',
    '555555533334210',
    '555555533334210',
    '555555433334210',
    '665003333333321',
    '665003333334210',
    '664003333334210',
    '554003333334210',
    '553003333334210',
    '443224443446110',
    '332111122211100',
    '221111112110000',
    '110000001000000',
    '000000000000000',
  ];

  // 本丸の扉（敵がここに着くと、灯がひとつ消える）
  D.DOOR = { x: 3.5, y: 1.5 };

  // 敵の通り道（世界座標、升の中心は +0.5）
  D.ROUTES = {
    S: { name: '正面の石段', short: '石段', color: '#ff8a5c', pts: [[8.5, 16.6], [8.5, 4.5], [4.5, 4.5], [4.5, 1.5], [3.5, 1.5]], lane: -0.13 },
    G: { name: '門の坂道', short: '門', color: '#ffd04a', pts: [[16.6, 5.5], [8.5, 5.5], [8.5, 4.5], [4.5, 4.5], [4.5, 1.5], [3.5, 1.5]], lane: 0.13, gate: { x: 12.0 } },
    C: { name: '西の崖道', short: '崖道', color: '#c88cff', pts: [[2.5, 16.6], [2.5, 3.5], [3.5, 3.5], [3.5, 1.5]], lane: 0 },
    F: { name: '夜空', short: '空', color: '#7fd8ff', pts: [[16.2, 0.6], [3.5, 1.5]], lane: 0, fly: { z0: 9.5, z1: 6.6 } },
  };
  D.GATE = { x: 11.5, y: 5.5, hp: 30 };
  // 城壁の内側（中庭・本丸の石畳・本丸の石段）。ここに入った敵は、しばらくすると本丸へ松明を投げこむ
  D.INSIDE = { kinds: 'fpBK', t: 9.0 };

  // 持ち場（旗）。safe = 高所で、地上の敵に近寄られない
  D.SLOTS = [
    { id: 's_foot', name: '石段の下', x: 8, y: 14, note: '砦の外。敵と最初に出会う' },
    { id: 's_land', name: '踊り場', x: 8, y: 11, note: '石段の途中。一列でのぼってくる敵を止められる' },
    { id: 's_top', name: '石段の上', x: 8, y: 8, note: '石段をのぼりきった中庭の口' },
    { id: 'w_sw', name: '南壁・西', x: 7, y: 10, safe: true, note: '城壁の上。石段を見下ろす' },
    { id: 'w_se', name: '南壁・東', x: 9, y: 10, safe: true, note: '城壁の上。石段を見下ろす' },
    { id: 'tower', name: '物見櫓', x: 11, y: 10, safe: true, note: 'いちばん高い。石段と門の外が見える' },
    { id: 'g_n', name: '門の上・北', x: 11, y: 4, safe: true, note: '門の上の城壁' },
    { id: 'g_s', name: '門の上・南', x: 11, y: 6, safe: true, note: '門の上の城壁' },
    { id: 'g_in', name: '門の内', x: 10, y: 6, note: '門のすぐ内側。破られたら、ここで受ける' },
    { id: 'g_out', name: '門前の坂', x: 13, y: 6, note: '門の外。坂をのぼる敵の横に立つ' },
    { id: 'c_mid', name: '中庭の辻', x: 8, y: 5, note: '石段と門からの道が合わさる' },
    { id: 'k_stair', name: '本丸の石段', x: 5, y: 4, note: '本丸へのぼる最後の石段' },
    { id: 'k_front', name: '本丸の前', x: 3, y: 3, note: '扉の前。どの道の敵も最後はここへ' },
    { id: 'k_corner', name: '本丸の張り出し', x: 6, y: 2, safe: true, note: '中庭と夜空を見わたす' },
    { id: 'c_bend', name: '崖道の曲がり角', x: 2, y: 7, note: '細い崖道の途中' },
    { id: 'c_ledge', name: '西の岩棚', x: 1, y: 8, safe: true, note: '崖道を見下ろす岩の上' },
  ];

  // 仲間
  // cap = 同時に受け止められる数（重さ）。range = 射程（升）。高い所からは届く距離がのびる
  D.ALLIES = {
    ilza: {
      name: 'イルザ', role: '盾の騎士', color: '#7fb2ff', hp: 46, cap: 3, kind: 'guard',
      atk: 2, cd: 1.0, reach: 1.35, regen: 0.5,
      good: '敵を受け止める（3体まで）。大鬼を止められるのは彼女だけ', weak: '倒すのは遅い',
      lines: { first: 'ここは通さない！', hold: '来い！', down: 'くっ……ここまで、か', win: '持ちこたえた' },
    },
    ruu: {
      name: 'ルゥ', role: '炎の術師', color: '#ff7a5a', hp: 14, cap: 1, kind: 'mage',
      atk: 7, cd: 3.6, cast: 0.55, range: 3.0, radius: 1.15,
      good: 'かたまった敵を、火球でまとめて焼く', weak: '体が弱い。近寄られると詠唱できない',
      lines: { first: 'まとめて燃えちゃえ！', big: 'ぜんぶ、燃えろーっ！', down: 'ごめん……', win: 'やった、やったよ！' },
    },
    kai: {
      name: 'カイ', role: '弓の猟師', color: '#8fdc6a', hp: 18, cap: 1, kind: 'archer',
      atk: 3, cd: 0.9, range: 4.0,
      good: '遠くから射る。空の敵と、弓小鬼を先に狙う', weak: '盾持ちには矢が通りにくい',
      lines: { first: '見えてる。', cover: '先に射抜いた！', down: 'しくじった……', win: '朝が近いな' },
    },
    dugan: {
      name: 'ドゥーガン', role: '槍の鍛冶', color: '#e0a05a', hp: 30, cap: 2, kind: 'spear',
      atk: 4, cd: 1.3, reach: 2.3, wolf: 2.5,
      good: '二升先まで突く。後ろの一体ごと貫く。狼を一突きで倒す', weak: '受け止められるのは2体まで',
      lines: { first: '槍は二間先まで届くぞ', hold: 'どっせい！', down: 'まだ、まだ……', win: 'いい鉄の音だった' },
    },
    mel: {
      name: 'メル', role: '癒しの薬師', color: '#ffe48a', hp: 16, cap: 1, kind: 'healer',
      heal: 5, cd: 1.8, range: 3.5, barrier: 8, bcd: 10,
      good: '近くの仲間の傷を癒やす。危ない仲間に守りの光', weak: '自分では戦えない',
      lines: { first: '倒れさせないから', save: 'いまっ！', down: 'みんな……', win: 'だれも欠けなかった' },
    },
  };
  D.ALLY_ORDER = ['ilza', 'ruu', 'kai', 'dugan', 'mel'];

  // 敵
  D.ENEMIES = {
    goblin: { name: '小鬼', hp: 6, spd: 1.1, atk: 1, cd: 1.0, w: 1, leak: 1, gate: 1, note: 'ふつうの雑兵' },
    wolf: { name: '狼', hp: 5, spd: 2.3, atk: 2, cd: 0.8, w: 1, leak: 1, gate: 2, beast: true, note: '足が速い。門をすぐ破る。槍に弱い' },
    shield: { name: '盾持ち', hp: 16, spd: 0.7, atk: 1, cd: 1.2, w: 1, leak: 1, gate: 2, armor: 0.34, note: '大盾で矢を防ぐ。遅い' },
    archer: { name: '弓小鬼', hp: 5, spd: 1.0, atk: 2, cd: 1.6, w: 1, leak: 1, gate: 1, ranged: 3.5, note: '立ち止まって仲間を射る。後衛を先に狙う' },
    crow: { name: '夜鴉', hp: 3, spd: 1.5, w: 1, leak: 1, fly: true, note: '空を飛んで本丸の灯をねらう。地上の仲間は届かない' },
    ogre: { name: '大鬼', hp: 90, spd: 0.5, atk: 5, cd: 1.8, w: 3, leak: 5, gate: 6, big: true, note: '重い。3体ぶんの重さで、イルザしか止められない' },
  };

  // 陣（襲撃）。groups: r 道 / e 敵 / n 数 / t 最初の到着(秒) / gap 間隔
  D.NIGHTS = [
    {
      n: 1, title: '第一夜　はじめの灯',
      intro: ['本丸の扉の上には、逃げてきた家族の数だけ灯がともっている。群れが扉にたどり着くたびに、灯がひとつ消える。', '日が落ちた。黒い森のほうから、松明の列が下りてくる。', '「石段は一人ずつしか通れない。そこを使おう」とイルザが言った。'],
      waves: [
        {
          id: '1-1', title: '石段の松明', allies: ['ilza', 'ruu'],
          groups: [{ r: 'S', e: 'goblin', n: 5, t: 2, gap: 1.3 }, { r: 'S', e: 'goblin', n: 7, t: 13, gap: 1.2 }],
          tip: '石段は一列でしかのぼれない。先頭を止めれば、後ろが詰まる。詰まった所へ、ルゥの火が届くように。城壁の内側（赤い所）に入った敵は、9秒たつと本丸へ松明を投げこむ。',
        },
        {
          id: '1-2', title: '門を叩く音', allies: ['ilza', 'ruu', 'kai'],
          join: 'kai',
          groups: [
            { r: 'S', e: 'goblin', n: 8, t: 2, gap: 1.2 },
            { r: 'G', e: 'goblin', n: 9, t: 5, gap: 0.9 },
            { r: 'S', e: 'shield', n: 3, t: 13, gap: 1.6 },
            { r: 'S', e: 'goblin', n: 5, t: 18, gap: 1.0 },
          ],
          tip: '門は、しばらく敵を足止めしてくれる。門の前で詰まった敵は、上からねらい放題。',
        },
      ],
    },
    {
      n: 2, title: '第二夜　狼と弓',
      intro: ['二日目の夜。遠吠えが峠にこだまする。', '「狼は足が速い。門なんか、すぐ破っちまう」とカイ。'],
      waves: [
        {
          id: '2-1', title: '遠吠え', allies: ['ilza', 'ruu', 'kai'],
          groups: [
            { r: 'G', e: 'wolf', n: 4, t: 3, gap: 0.6 },
            { r: 'S', e: 'goblin', n: 9, t: 4, gap: 1.1 },
            { r: 'G', e: 'goblin', n: 6, t: 12, gap: 1.0 },
            { r: 'S', e: 'shield', n: 3, t: 15, gap: 1.8 },
          ],
          tip: '狼は門をすぐ破る。門の前に詰まっているうちに減らすか、破られたあと内側で素早く片づけるか。',
        },
        {
          id: '2-2', title: '弓の列', allies: ['ilza', 'ruu', 'kai'],
          groups: [
            { r: 'S', e: 'goblin', n: 6, t: 2, gap: 1.1 },
            { r: 'S', e: 'archer', n: 4, t: 8, gap: 1.3 },
            { r: 'S', e: 'goblin', n: 7, t: 13, gap: 1.0 },
            { r: 'G', e: 'shield', n: 4, t: 5, gap: 1.6 },
            { r: 'G', e: 'goblin', n: 6, t: 13, gap: 0.9 },
          ],
          tip: '弓小鬼は立ち止まって、ルゥやカイを先にねらう。だれが、だれを守るか。',
        },
      ],
    },
    {
      n: 3, title: '第三夜　崖道',
      intro: ['三日目の夜。崩れていた西の崖道を、獣の足音がのぼってくる。', '「わしも槍を持とう。鉄を打つ腕は、まだなまっとらん」とドゥーガン。'],
      waves: [
        {
          id: '3-1', title: '崖をのぼる影', allies: ['ilza', 'ruu', 'kai', 'dugan'],
          join: 'dugan',
          groups: [
            { r: 'C', e: 'wolf', n: 6, t: 4, gap: 0.8 },
            { r: 'S', e: 'goblin', n: 10, t: 2, gap: 1.0 },
            { r: 'G', e: 'goblin', n: 8, t: 8, gap: 0.9 },
            { r: 'G', e: 'shield', n: 3, t: 15, gap: 1.6 },
            { r: 'C', e: 'goblin', n: 4, t: 18, gap: 1.0 },
          ],
          tip: '崖道は本丸の裏へ続いている。狼には、ドゥーガンの槍がよく効く。',
        },
        {
          id: '3-2', title: '三方から', allies: ['ilza', 'ruu', 'kai', 'dugan'],
          groups: [
            { r: 'S', e: 'shield', n: 4, t: 2, gap: 1.5 },
            { r: 'S', e: 'goblin', n: 10, t: 9, gap: 0.8 },
            { r: 'S', e: 'archer', n: 3, t: 15, gap: 1.2 },
            { r: 'G', e: 'wolf', n: 8, t: 5, gap: 0.6 },
            { r: 'G', e: 'archer', n: 2, t: 13, gap: 1.3 },
            { r: 'C', e: 'goblin', n: 8, t: 9, gap: 0.8 },
            { r: 'C', e: 'shield', n: 2, t: 18, gap: 1.5 },
          ],
          tip: '三つの道を、四人で守る。止める所と、焼く所を決めよう。',
        },
      ],
    },
    {
      n: 4, title: '第四夜　夜鴉',
      intro: ['四日目の夜。月が黒い羽で隠れた。', '「鴉は空から灯をねらう。地面の上では止められない」とメル。'],
      waves: [
        {
          id: '4-1', title: '黒い羽', allies: ['ilza', 'ruu', 'kai', 'dugan', 'mel'],
          join: 'mel',
          groups: [
            { r: 'F', e: 'crow', n: 8, t: 8, gap: 1.4 },
            { r: 'S', e: 'goblin', n: 12, t: 2, gap: 0.9 },
            { r: 'S', e: 'shield', n: 3, t: 14, gap: 1.6 },
            { r: 'G', e: 'shield', n: 4, t: 5, gap: 1.6 },
            { r: 'G', e: 'goblin', n: 6, t: 12, gap: 0.9 },
            { r: 'C', e: 'wolf', n: 4, t: 16, gap: 0.8 },
          ],
          tip: '夜鴉は空を通って本丸へ。届くのはカイの矢とルゥの火だけ。',
        },
        {
          id: '4-2', title: '月のない夜', allies: ['ilza', 'ruu', 'kai', 'dugan', 'mel'],
          groups: [
            { r: 'S', e: 'goblin', n: 8, t: 2, gap: 0.9 },
            { r: 'S', e: 'archer', n: 5, t: 9, gap: 1.2 },
            { r: 'S', e: 'goblin', n: 8, t: 15, gap: 0.9 },
            { r: 'G', e: 'wolf', n: 7, t: 5, gap: 0.6 },
            { r: 'C', e: 'shield', n: 3, t: 8, gap: 1.6 },
            { r: 'C', e: 'goblin', n: 8, t: 13, gap: 0.9 },
            { r: 'F', e: 'crow', n: 6, t: 18, gap: 1.3 },
          ],
          tip: 'どの道も手薄にはできない。一人ひとりの得意な場所へ。',
        },
      ],
    },
    {
      n: 5, title: '第五夜　夜明けまで',
      intro: ['五日目の夜。峠の雪は、もうゆるみはじめている。', '黒い森の奥から、地響きのような足音。大鬼だ。'],
      waves: [
        {
          id: '5-1', title: '大鬼', allies: ['ilza', 'ruu', 'kai', 'dugan', 'mel'],
          groups: [
            { r: 'S', e: 'goblin', n: 8, t: 2, gap: 0.9 },
            { r: 'S', e: 'ogre', n: 1, t: 10, gap: 1 },
            { r: 'S', e: 'goblin', n: 10, t: 13, gap: 0.8 },
            { r: 'S', e: 'archer', n: 4, t: 21, gap: 1.2 },
            { r: 'G', e: 'shield', n: 5, t: 5, gap: 1.6 },
            { r: 'G', e: 'wolf', n: 5, t: 16, gap: 0.6 },
            { r: 'C', e: 'goblin', n: 6, t: 10, gap: 1.0 },
          ],
          tip: '大鬼は重い。止められるのはイルザだけ。だれが彼女を支える？',
        },
        {
          id: '5-2', title: '夜明け前', allies: ['ilza', 'ruu', 'kai', 'dugan', 'mel'],
          groups: [
            { r: 'C', e: 'wolf', n: 6, t: 3, gap: 0.7 },
            { r: 'C', e: 'ogre', n: 1, t: 7, gap: 1 },
            { r: 'C', e: 'goblin', n: 4, t: 14, gap: 0.9 },
            { r: 'S', e: 'goblin', n: 10, t: 2, gap: 0.9 },
            { r: 'S', e: 'shield', n: 4, t: 12, gap: 1.6 },
            { r: 'S', e: 'archer', n: 4, t: 19, gap: 1.2 },
            { r: 'G', e: 'goblin', n: 8, t: 6, gap: 0.8 },
            { r: 'G', e: 'wolf', n: 5, t: 15, gap: 0.6 },
            { r: 'F', e: 'crow', n: 7, t: 10, gap: 1.3 },
          ],
          tip: '最後の夜明け前。こんどの大鬼は、崖道から来る。',
        },
      ],
    },
  ];

  // 夜が明けたあとの贈りもの（二つから一つ）
  D.GIFTS = [
    {
      after: 1,
      options: [
        { id: 'ilza_hp', title: 'イルザの盾を打ち直す', text: '鍛冶のドゥーガンが一晩で。イルザの体力 46→58', who: 'ilza' },
        { id: 'gate_hp', title: '門に鉄の帯を巻く', text: '村の男たちが総出で。門の固さ ×2', who: null },
      ],
    },
    {
      after: 2,
      options: [
        { id: 'kai_range', title: 'カイの長弓', text: '弦を張りかえる。カイの射程 4→5升', who: 'kai' },
        { id: 'ruu_radius', title: 'ルゥの火の輪', text: 'ばあさまの杖をゆずられる。火球の当たる広さ ×1.25', who: 'ruu' },
      ],
    },
    {
      after: 3,
      options: [
        { id: 'dugan_cap', title: 'ドゥーガンの鉄の籠手', text: '自分で打った。受け止められる数 2→3', who: 'dugan' },
        { id: 'ilza_regen', title: 'イルザの気付け薬', text: 'メルの調合。イルザが戦いながら傷を癒やす力 ×2', who: 'ilza' },
      ],
    },
    {
      after: 4,
      options: [
        { id: 'lamp', title: '子どもたちの灯', text: '子どもたちが小さな灯をつくった。灯 +1', who: null },
        { id: 'mel_heal', title: 'メルの香草', text: '雪の下で見つけた。メルの癒やす力 5→7', who: 'mel' },
      ],
    },
  ];

  // 仲間が加わるとき
  D.JOIN = {
    kai: ['門のほうから、弓の音。峠の猟師カイが、獲物の代わりに村の人たちを追ってきた。', 'カイ「門の上から射るのが得意だ。……おれも数に入れてくれ」'],
    dugan: ['鍛冶のドゥーガンが、打ちあがったばかりの槍をかついで出てきた。', 'ドゥーガン「狼なら、槍の先で止めてみせる。二体までなら受けてやろう」'],
    mel: ['薬師のメルが、灯りと薬草の袋を下げて出てきた。', 'メル「近くにいれば、傷はわたしが癒やします。だれも倒れさせない」'],
  };

  // 連携（二人の働きが重なったとき）
  D.COMBOS = [
    { id: 'burn_ilza', name: '受けて、焼く', who: ['ilza', 'ruu'], text: 'イルザが止めた列を、ルゥの火球がまとめて焼く（3体以上）' },
    { id: 'gate_burn', name: '門前の火', who: ['gate', 'ruu'], text: '門の前で詰まった敵を、ルゥがまとめて焼く（3体以上）' },
    { id: 'cover_ruu', name: '先に射抜く', who: ['kai', 'ruu'], text: 'ルゥをねらう弓小鬼を、カイが先に射抜く' },
    { id: 'cover', name: '援護射撃', who: ['kai', '*'], text: '仲間と戦っている敵を、カイが射抜く' },
    { id: 'spear_ilza', name: '盾と槍', who: ['ilza', 'dugan'], text: 'イルザが受け止めた敵を、ドゥーガンが肩ごしに突く' },
    { id: 'burn_dugan', name: '槍と炎', who: ['dugan', 'ruu'], text: 'ドゥーガンが止めた列を、ルゥの火球がまとめて焼く（3体以上）' },
    { id: 'wolf_spear', name: '槍ぶすま', who: ['dugan'], text: '走ってきた狼を、ドゥーガンが一突きで倒す' },
    { id: 'crow', name: '夜鴉落とし', who: ['kai'], text: '空を行く夜鴉を、カイが射落とす' },
    { id: 'heal_hold', name: '支える手', who: ['mel', '*'], text: '二体以上（または大鬼）を受け止めている仲間を、メルが癒やす' },
    { id: 'barrier', name: '間一髪', who: ['mel', '*'], text: '倒れるはずの一撃を、メルの守りの光が受け止める' },
    { id: 'big_burn', name: '大火球', who: ['ruu'], text: 'ルゥの火球が、5体以上をまとめて焼く' },
    { id: 'ogre_hold', name: '鬼受け', who: ['ilza'], text: 'イルザが大鬼を8秒以上受け止める' },
  ];

  // 物語
  D.STORY = {
    prologue: [
      '山あいの村ハルニレは、黒い森からあふれた「夜の群れ」に焼かれた。',
      '村の人々は、峠の古い砦──きざはし砦に逃げこんだ。峠の雪がゆるむまで、あと五日。',
      '砦の守り手は、わずかしかいない。だれをどこに立たせるか。持ち場を決めるのは、あなただ。',
    ],
    // 夜明けの砦の中の様子（夜ごとに増えていく）
    mornings: [
      {
        after: 1,
        lines: [
          '夜が明けた。本丸の扉がそっと開き、村の人たちが中庭へ出てくる。',
          '羊飼いのじいが峠を見上げた。「雪はまだ固い。あと四つ」',
          '{mvpLine}',
        ],
      },
      {
        after: 2,
        lines: [
          '二度目の朝。中庭に大鍋がすえられ、宿のおかみが麦の粥を炊く。',
          '{kidLine}',
          '鍛冶のドゥーガンが、焼け残った鉄で槍の穂先を打ちはじめた。',
        ],
      },
      {
        after: 3,
        lines: [
          '三度目の朝。洗濯ものが城壁にひるがえる。',
          '薬師のメルが包帯を巻きながら言った。「わたしも、今夜は外に出ます」',
          '{kidLine}',
        ],
      },
      {
        after: 4,
        lines: [
          '四度目の朝。峠の雪が、陽にとけて光っている。',
          'じいが言った。「明日の朝には、峠を越えられる」',
          '{kidLine}',
        ],
      },
    ],
    ending: [
      '五度目の朝。峠の雪がゆるんだ。',
      '村の人たちは荷を背負い、ひとりずつ、きざはし砦の石段を見下ろしてから峠へ向かった。',
    ],
  };

  root.K20D = D;
})(typeof window !== 'undefined' ? window : globalThis);
