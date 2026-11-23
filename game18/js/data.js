// がらり、迷宮ひらき — 地図・部屋・戦い・物語の文
(function (root) {
  'use strict';
  const D = {};
  D.START = 's1_in';

  // 層（地図の帯）
  D.STRATA = [
    { id: 1, name: '第一層　根の坑道', y0: 90, y1: 760, col: '#7a8a4a', ink: '#4c5a2a', bg: 'mine' },
    { id: 2, name: '第二層　水晶の地底湖', y0: 760, y1: 1460, col: '#4a8ab0', ink: '#24506e', bg: 'lake' },
    { id: 3, name: '第三層　沈んだ書庫', y0: 1460, y1: 2160, col: '#8a6ab0', ink: '#4a3470', bg: 'library' },
    { id: 4, name: '底　地図の空白', y0: 2160, y1: 2700, col: '#3a4a8a', ink: '#1a2450', bg: 'abyss' },
  ];
  D.MAP_H = 2700;

  // 部屋。pre: 師匠の下書きに最初から載っている／hidden: 壁を崩すまで地図に出ない
  // look: 先の部屋の気配（となりまで来ると見える）
  D.ROOMS = {
    s1_in: { st: 1, name: '縦穴の底', x: 440, y: 150, rx: 74, ry: 38, pre: 1, kind: 'start',
      note: 'ここから入る' },
    s1_hall: { st: 1, name: '坑道の広間', x: 440, y: 292, rx: 100, ry: 48, pre: 1, battle: 'b_hall',
      note: '小鬼のたまり場' },
    s1_bats: { st: 1, name: 'コウモリの巣', x: 176, y: 360, rx: 84, ry: 44, pre: 1, battle: 'b_bats',
      note: 'コウモリだらけ。奥は見ていない' },
    s1_forge: { st: 1, name: '鍛冶の跡', x: 128, y: 512, rx: 72, ry: 40, items: [{ rune: 'fire', n: 3 }],
      look: 'glint', lookText: '赤い光がちらちらしている' },
    s1_thorn: { st: 1, name: '茨の間', x: 696, y: 352, rx: 88, ry: 46, pre: 1, battle: 'b_thorn',
      note: '茨の奥で、金色の光を見た。炎があれば…' },
    s1_cache: { st: 1, name: '茨の奥の小部屋', x: 790, y: 500, rx: 62, ry: 36, hidden: 1,
      items: [{ rune: 'star', n: 1 }, { lore: 'scrap' }] },
    s1_root: { st: 1, name: '根の大広間', x: 452, y: 560, rx: 116, ry: 54, pre: 1, battle: 'b_chief',
      note: '小鬼の親分が居すわっている。ここで二度、引き返した' },
    s1_spring: { st: 1, name: '根の下の泉', x: 214, y: 676, rx: 66, ry: 34, hidden: 1,
      items: [{ hp: 2 }, { forge: 1 }] },

    s2_shore: { st: 2, name: '湖のほとり', x: 452, y: 846, rx: 92, ry: 42, pre: 1, kind: 'rest',
      note: '地底湖。水晶が光って、きれいだ' },
    s2_cave: { st: 2, name: '水晶の洞', x: 176, y: 920, rx: 92, ry: 46, pre: 1, battle: 'b_crab',
      note: 'カニの殻はかたい。剣は半分しか通らない' },
    s2_vault: { st: 2, name: '水晶の宝庫', x: 94, y: 1064, rx: 64, ry: 36, hidden: 1,
      items: [{ forge: 2 }, { lore: 'crystal' }] },
    s2_fall: { st: 2, name: '氷の滝', x: 250, y: 1140, rx: 88, ry: 44, battle: 'b_slime',
      look: 'cold', lookText: '冷たい風が吹いてくる' },
    s2_shrine: { st: 2, name: '凍った祠', x: 150, y: 1296, rx: 70, ry: 38, items: [{ rune: 'ice', n: 3 }],
      look: 'glint', lookText: '青白い光が見える' },
    s2_ferry: { st: 2, name: '湖の渡し', x: 600, y: 990, rx: 96, ry: 46, pre: 1, battle: 'b_fish',
      note: '中島に何か光る。舟はない' },
    s2_isle: { st: 2, name: '湖の中島', x: 744, y: 1150, rx: 72, ry: 40, pre: 1,
      items: [{ rune: 'bolt', n: 3 }, { mp: 1 }], note: '中島（渡れない）' },
    s2_lift: { st: 2, name: '古い昇降機', x: 560, y: 1340, rx: 104, ry: 50, battle: 'b_golem',
      look: 'gear', lookText: 'ごうん…と大きな歯車の音' },

    s3_in: { st: 3, name: '書庫の入口', x: 560, y: 1548, rx: 86, ry: 40, pre: 1, kind: 'rest',
      note: 'ここで灯りが尽きた。この先は知らん' },
    s3_hall: { st: 3, name: '骸骨の回廊', x: 280, y: 1640, rx: 100, ry: 46, battle: 'b_skel',
      look: 'bones', lookText: 'からから…と骨の鳴る音' },
    s3_tomb: { st: 3, name: '先人の墓所', x: 96, y: 1790, rx: 66, ry: 36, hidden: 1,
      items: [{ rune: 'star', n: 1 }, { forge: 1 }, { lore: 'tomb' }] },
    s3_read: { st: 3, name: '崩れた閲覧室', x: 300, y: 1860, rx: 96, ry: 46, battle: 'b_book',
      look: 'steps', lookText: 'ずしん、ずしん…と重い足音' },
    s3_star: { st: 3, name: '星図の間', x: 180, y: 2040, rx: 80, ry: 40, items: [{ rune: 'light', n: 3 }, { forge: 1 }, { lore: 'chart' }],
      look: 'glint', lookText: '金色の光がもれている' },
    s3_seal: { st: 3, name: '封印の扉', x: 764, y: 1700, rx: 86, ry: 44, battle: 'b_ghost',
      look: 'ghost', lookText: 'ひやりとした気配' },
    s3_deep: { st: 3, name: '番人の大回廊', x: 660, y: 1990, rx: 120, ry: 52, hidden: 1, battle: 'b_horde' },

    s4_gate: { st: 4, name: '空白の前', x: 452, y: 2300, rx: 140, ry: 60, battle: 'b_final' },
    s4_blank: { st: 4, name: '地図の空白', x: 452, y: 2540, rx: 170, ry: 80, hidden: 1, kind: 'end' },
  };

  // 道。gate: その壁を崩すと通れる（壁はどこかの部屋の戦場の奥にある）
  D.EDGES = [
    { a: 's1_in', b: 's1_hall' },
    { a: 's1_hall', b: 's1_bats' },
    { a: 's1_hall', b: 's1_thorn' },
    { a: 's1_bats', b: 's1_forge' },
    { a: 's1_thorn', b: 's1_cache', gate: 'w_thorn' },
    { a: 's1_hall', b: 's1_root' },
    { a: 's1_root', b: 's1_spring', gate: 'w_crack1' },
    { a: 's1_root', b: 's2_shore', shaft: 1 },

    { a: 's2_shore', b: 's2_cave' },
    { a: 's2_cave', b: 's2_vault', gate: 'w_crack2' },
    { a: 's2_cave', b: 's2_fall' },
    { a: 's2_fall', b: 's2_shrine' },
    { a: 's2_shore', b: 's2_ferry' },
    { a: 's2_ferry', b: 's2_isle', gate: 'w_lake', ice: 1 },
    { a: 's2_isle', b: 's2_lift' },
    { a: 's2_lift', b: 's3_in', gate: 'w_gear', shaft: 1 },

    { a: 's3_in', b: 's3_hall' },
    { a: 's3_hall', b: 's3_tomb', gate: 'w_crack3' },
    { a: 's3_hall', b: 's3_read' },
    { a: 's3_read', b: 's3_star' },
    { a: 's3_in', b: 's3_seal' },
    { a: 's3_seal', b: 's3_deep', gate: 'w_seal' },
    { a: 's3_deep', b: 's4_gate', shaft: 1 },
    { a: 's4_gate', b: 's4_blank', gate: 'w_final' },
  ];

  // 戦い。lane 0/1/2 = 上・中・下の段（リールの上・中・下の行がそのまま届く）。col 0 がミオのすぐ前、5 が奥
  // walls[lane]: 部屋の奥の壁。id があるものは崩せる（th: 一撃で届けばよい力）。nest: 崩すまで魔物が出てくる
  D.BATTLES = {
    b_hall: {
      bg: 'mine',
      enemies: [{ t: 'goblin', lane: 1, col: 2 }, { t: 'goblin', lane: 1, col: 4 }, { t: 'goblin', lane: 0, col: 4 }],
      spawns: [{ after: 1, t: 'goblin', lane: 2 }, { after: 2, t: 'goblin', lane: 0 }, { after: 3, t: 'goblin', lane: 1 }],
      walls: [{ kind: 'rock' }, { kind: 'exit' }, { kind: 'rock' }],
      script: 'tutorial',
      pick: [{ rune: 'sword', lv: 2 }, { rune: 'sword', n: 2 }],
    },
    b_bats: {
      bg: 'mine',
      enemies: [{ t: 'bat', lane: 0, col: 5 }, { t: 'bat', lane: 1, col: 4 }, { t: 'bat', lane: 1, col: 5 }, { t: 'bat', lane: 2, col: 5 }],
      spawns: [{ after: 1, t: 'bat', lane: 0 }, { after: 1, t: 'bat', lane: 2 }, { after: 2, t: 'goblin', lane: 1 }, { after: 2, t: 'bat', lane: 1, col: 5 }, { after: 3, t: 'bat', lane: 0 }, { after: 3, t: 'bat', lane: 2 }],
      walls: [{ kind: 'rock' }, { kind: 'rock' }, { kind: 'exit' }],
      pick: [{ rune: 'sword', lv: 2 }, { rune: 'sword', n: 2 }],
    },
    b_thorn: {
      bg: 'mine',
      enemies: [{ t: 'thornling', lane: 1, col: 3 }, { t: 'goblin', lane: 0, col: 3 }, { t: 'goblin', lane: 2, col: 4 }],
      spawns: [{ after: 2, t: 'goblin', lane: 0 }, { after: 3, t: 'goblin', lane: 2 }],
      walls: [{ kind: 'rock' }, { id: 'w_thorn', kind: 'thorn', th: 2, nest: { t: 'thornling', every: 2, n: 3 } }, { kind: 'rock' }],
      pick: [{ rune: 'fire' }, { rune: 'sword', lv: 2 }],
    },
    b_chief: {
      bg: 'mine', boss: 1,
      enemies: [{ t: 'chief', lane: 1, col: 4 }, { t: 'goblin', lane: 0, col: 3 }, { t: 'goblin', lane: 2, col: 3 }, { t: 'archer', lane: 0, col: 5 }, { t: 'goblin', lane: 1, col: 2 }],
      spawns: [{ after: 1, t: 'goblin', lane: 2 }, { after: 1, t: 'archer', lane: 2 }, { after: 2, t: 'goblin', lane: 0 }, { after: 3, t: 'goblin', lane: 2 }, { after: 3, t: 'goblin', lane: 1 }, { after: 4, t: 'archer', lane: 0 }, { after: 5, t: 'goblin', lane: 2 }, { after: 6, t: 'goblin', lane: 0 }],
      walls: [{ kind: 'rock' }, { kind: 'exit' }, { id: 'w_crack1', kind: 'crack', th: 12 }],
      reward: [{ reel: 1 }],
      pick: [{ rune: 'fire' }, { rune: 'sword', lv: 2 }],
    },

    b_crab: {
      bg: 'lake',
      enemies: [{ t: 'crab', lane: 0, col: 3 }, { t: 'crab', lane: 1, col: 4 }, { t: 'slime', lane: 2, col: 3 }, { t: 'slime', lane: 1, col: 2 }, { t: 'crab', lane: 2, col: 5 }],
      spawns: [{ after: 1, t: 'crab', lane: 2 }, { after: 1, t: 'slime', lane: 0 }, { after: 2, t: 'crab', lane: 1 }, { after: 3, t: 'slime', lane: 0 }, { after: 3, t: 'crab', lane: 2 }, { after: 4, t: 'crab', lane: 1 }],
      walls: [{ id: 'w_crack2', kind: 'crack', th: 30 }, { kind: 'rock' }, { kind: 'exit' }],
      reward: [{ forge: 1 }],
      pick: [{ rune: 'fire' }, { rune: 'fire', lv: 2 }],
    },
    b_slime: {
      bg: 'lake',
      enemies: [{ t: 'slime', lane: 0, col: 3 }, { t: 'slime', lane: 1, col: 2 }, { t: 'slime', lane: 1, col: 4 }, { t: 'slime', lane: 2, col: 3 }, { t: 'slime', lane: 0, col: 5 }],
      spawns: [{ after: 1, t: 'slime', lane: 0 }, { after: 1, t: 'slime', lane: 2 }, { after: 2, t: 'crab', lane: 1 }, { after: 2, t: 'slime', lane: 2 }, { after: 3, t: 'slime', lane: 0 }, { after: 3, t: 'slime', lane: 2 }, { after: 4, t: 'crab', lane: 1 }, { after: 4, t: 'slime', lane: 0 }],
      walls: [{ kind: 'rock' }, { kind: 'rock' }, { kind: 'exit' }],
      pick: [{ rune: 'fire', lv: 2 }, { rune: 'sword', lv: 2, n: 2 }],
    },
    b_fish: {
      bg: 'lake',
      enemies: [{ t: 'fish', lane: 2, col: 3 }, { t: 'crab', lane: 0, col: 4 }, { t: 'fish', lane: 1, col: 3 }, { t: 'slime', lane: 0, col: 2 }],
      spawns: [{ after: 1, t: 'crab', lane: 1 }, { after: 2, t: 'slime', lane: 0 }, { after: 3, t: 'crab', lane: 1 }, { after: 4, t: 'slime', lane: 0 }],
      walls: [{ kind: 'rock' }, { kind: 'rock' }, { id: 'w_lake', kind: 'lake', th: 4, nest: { t: 'fish', every: 1, n: 5 } }],
      pick: [{ rune: 'ice' }, { rune: 'fire', lv: 2 }],
    },
    b_golem: {
      bg: 'lake', boss: 1,
      enemies: [{ t: 'golem', lane: 1, col: 5 }, { t: 'crab', lane: 0, col: 3 }, { t: 'crab', lane: 2, col: 3 }, { t: 'fish', lane: 2, col: 5 }, { t: 'fish', lane: 1, col: 2 }],
      spawns: [{ after: 1, t: 'fish', lane: 0 }, { after: 1, t: 'crab', lane: 2 }, { after: 2, t: 'crab', lane: 2 }, { after: 2, t: 'fish', lane: 0 }, { after: 3, t: 'fish', lane: 0 }, { after: 3, t: 'crab', lane: 2 }, { after: 4, t: 'crab', lane: 2 }, { after: 4, t: 'fish', lane: 0 }, { after: 5, t: 'fish', lane: 0 }, { after: 5, t: 'crab', lane: 2 }, { after: 6, t: 'crab', lane: 0 }, { after: 6, t: 'fish', lane: 2 }],
      walls: [{ kind: 'rock' }, { id: 'w_gear', kind: 'gear', th: 6 }, { kind: 'rock' }],
      reward: [{ reel: 1 }, { hp: 2 }],
      pick: [{ rune: 'bolt' }, { rune: 'fire', lv: 2 }],
    },

    b_skel: {
      bg: 'library',
      enemies: [{ t: 'skel', lane: 0, col: 3 }, { t: 'skel', lane: 1, col: 4 }, { t: 'archer', lane: 1, col: 5 }, { t: 'skel', lane: 2, col: 3 }, { t: 'skel', lane: 0, col: 5 }],
      spawns: [{ after: 1, t: 'skel', lane: 0 }, { after: 1, t: 'skel', lane: 2 }, { after: 2, t: 'skel', lane: 2 }, { after: 2, t: 'archer', lane: 1 }, { after: 3, t: 'archer', lane: 0 }, { after: 3, t: 'skel', lane: 1 }, { after: 4, t: 'skel', lane: 2 }, { after: 4, t: 'skel', lane: 0 }],
      walls: [{ kind: 'rock' }, { kind: 'exit' }, { id: 'w_crack3', kind: 'crack', th: 60 }],
      reward: [{ forge: 1 }],
      pick: [{ rune: 'bolt', lv: 2 }, { rune: 'fire', lv: 2 }],
    },
    b_ghost: {
      bg: 'library',
      enemies: [{ t: 'ghost', lane: 0, col: 3 }, { t: 'ghost', lane: 1, col: 4 }, { t: 'ghost', lane: 2, col: 3 }, { t: 'skel', lane: 0, col: 5 }],
      spawns: [{ after: 1, t: 'skel', lane: 2 }, { after: 2, t: 'skel', lane: 0 }, { after: 3, t: 'skel', lane: 2 }, { after: 4, t: 'ghost', lane: 0 }],
      walls: [{ kind: 'rock' }, { id: 'w_seal', kind: 'seal', th: 6, nest: { t: 'ghost', every: 1, n: 4 } }, { kind: 'rock' }],
      pick: [{ rune: 'bolt' }, { rune: 'ice', lv: 2 }],
    },
    b_book: {
      bg: 'library',
      enemies: [{ t: 'book', lane: 1, col: 4 }, { t: 'skel', lane: 0, col: 3 }, { t: 'book', lane: 2, col: 5 }, { t: 'ghost', lane: 0, col: 5 }, { t: 'skel', lane: 2, col: 2 }],
      spawns: [{ after: 1, t: 'skel', lane: 2 }, { after: 1, t: 'ghost', lane: 1 }, { after: 2, t: 'ghost', lane: 1 }, { after: 2, t: 'skel', lane: 0 }, { after: 3, t: 'book', lane: 0 }, { after: 4, t: 'skel', lane: 2 }, { after: 4, t: 'ghost', lane: 1 }],
      walls: [{ kind: 'rock' }, { kind: 'rock' }, { kind: 'exit' }],
      reward: [{ mp: 1 }],
      pick: [{ rune: 'bolt', lv: 2 }, { rune: 'star' }],
    },
    b_horde: {
      bg: 'library', horde: 1,
      enemies: [
        { t: 'chief', lane: 0, col: 2, minion: 1 }, { t: 'goblin', lane: 0, col: 3 }, { t: 'goblin', lane: 0, col: 4 }, { t: 'chief', lane: 0, col: 5, minion: 1 },
        { t: 'crab', lane: 1, col: 2 }, { t: 'golem', lane: 1, col: 3, minion: 1, hp: 40 }, { t: 'crab', lane: 1, col: 4 }, { t: 'book', lane: 1, col: 5 },
        { t: 'skel', lane: 2, col: 2 }, { t: 'ghost', lane: 2, col: 3 }, { t: 'skel', lane: 2, col: 4 }, { t: 'chief', lane: 2, col: 5, minion: 1 },
      ],
      spawns: [
        { after: 1, t: 'chief', lane: 0, minion: 1 }, { after: 1, t: 'golem', lane: 1, minion: 1, hp: 40 }, { after: 1, t: 'chief', lane: 2, minion: 1 },
      ],
      walls: [{ kind: 'rock' }, { kind: 'exit' }, { kind: 'rock' }],
      pick: [{ rune: 'light', lv: 2 }, { rune: 'star' }],
    },
    b_final: {
      bg: 'abyss', boss: 1, final: 1,
      enemies: [{ t: 'arm', lane: 0, col: 5, cd: 2 }, { t: 'heart', lane: 1, col: 5 }, { t: 'arm', lane: 2, col: 5, cd: 3 }, { t: 'skel', lane: 1, col: 3 }, { t: 'ghost', lane: 0, col: 3 }, { t: 'skel', lane: 2, col: 3 }],
      spawns: [{ after: 1, t: 'skel', lane: 0, col: 4 }, { after: 2, t: 'ghost', lane: 2, col: 4 }, { after: 3, t: 'skel', lane: 1, col: 4 }, { after: 4, t: 'ghost', lane: 0, col: 4 }, { after: 5, t: 'skel', lane: 2, col: 4 }, { after: 6, t: 'ghost', lane: 1, col: 4 }, { after: 7, t: 'skel', lane: 0, col: 4 }, { after: 8, t: 'ghost', lane: 2, col: 4 }],
      walls: [{ kind: 'rock' }, { id: 'w_final', kind: 'final', th: 150 }, { kind: 'rock' }],
      reward: [{ forge: 3 }],
    },
  };

  // 師匠の声（伝声貝）。部屋に初めて入ったときなど
  D.SHELL = {
    s1_in: 'おう、聞こえるか。そこが縦穴の底だ。まずは目の前の広間からだな',
    s1_bats: 'コウモリの巣の奥か。わしは行かなかった。何があった？',
    s1_forge: '鍛冶の跡だと？ わしの地図にない部屋だ。ちゃんと描いておけよ',
    s1_cache: 'ほう、茨の奥に部屋か。四十年、気づかなかったわい',
    s1_root: '親分を追いはらったか！ そこの縦穴を降りれば、地底湖だ',
    s1_spring: '根の下に泉……。わしの地図は、穴だらけだったんだな',
    s2_shore: '地底湖だ。わしはここから、中島の光を眺めるしかなかった',
    s2_isle: 'ついに中島か！ 湖の向こう岸に、古い昇降機があるはずだ',
    s2_lift: '昇降機の先はわしも知らん。気をつけて行け',
    s3_in: 'そこが、わしの灯りが尽きた場所だ。ここから先は、お前の地図だ',
    s3_star: '星図……？ 昔の地図描きの部屋か。読めるか？',
    s3_deep: 'なんだ、その音は。大丈夫か、ミオ！',
    s4_gate: '……底か。そこが、空白か',
  };

  D.LORE = {
    scrap: { name: '地図の切れ端', text: '誰かの古い地図の切れ端。「根の大広間の下の段、壁のひびの向こうに水の音」と書いてある。' },
    crystal: { name: '水晶の手帳', text: '「湖の中島に雷の紋。向こう岸の昇降機は、雷で動く」――昔の鉱夫の走り書き。' },
    tomb: { name: '先人の手記', text: '「わたしもまた、底を描きに来た。空白の前の番人は、腕を崩せば胸の殻がはがれる」' },
    chart: { name: '星図', text: '天井に描かれた星図。地の底に、もう一つの空があると書いてある。' },
  };

  // 物語
  D.INTRO = [
    { who: '', text: '底なし洞（そこなしぼら）。だれも底を見たことがない、大きな縦穴。' },
    { who: '師匠オルド', text: '四十年かけて、この穴の地図を描いた。だがな、ミオ。いちばん下は、空白のままだ。' },
    { who: 'ミオ', text: 'その空白、わたしが描いてきます！　底に何があるのか、自分の目で見たいんです。' },
    { who: '師匠オルド', text: '……ほれ、わしの詠唱輪だ。三本しかないが、見つけた紋を刻めば育つ。伝声貝も持っていけ。声だけは届けてやる。' },
    { who: '', text: '師匠の下書きの地図を手に、ミオは縦穴を降りていった。' },
  ];
  D.ENDING = [
    { who: '', text: '最後の壁が崩れ、その向こうから、光があふれ出した。' },
    { who: 'ミオ', text: '……空だ。地面の下に、空がある。' },
    { who: '', text: '天井いっぱいの水晶が、星のようにまたたいている。遠くで、光る川が流れていく。' },
    { who: '師匠オルド', text: 'ミオ、何が見える。教えてくれ。' },
    { who: 'ミオ', text: 'いま描いています。師匠の地図の、いちばん下に。' },
    { who: '', text: '空白だったところに、ミオの線が引かれていく。底なし洞の地図は、こうして底を得た。' },
  ];

  D.HELP = [
    { title: '地図を描きながら、底をめざす', text: '地図の部屋を押すと、そこへ歩く。初めての部屋は色がついて地図に描きこまれる。\n鉛筆の線と文字は、師匠の下書き。灰色の「？」は、まだ見ていない部屋の気配（足音・光・風）。' },
    { title: '回して、行をそろえる', text: '詠唱輪を回すと、リールが止まる。横の行は左から読み、同じ紋が2つ以上つづけば呪文になる。\n上の行は上の段へ、中の行は中の段へ、下の行は下の段へ飛ぶ。そろう数が多いほど、力は大きく伸びる（2つ×1、3つ×2、4つ×4、5つ×8）。' },
    { title: '一コマずらす', text: '窓の上下にはみ出した札を押すと、その紋が窓に入る（上の札は下へ、下の札は上へ）。魔力を1使う。毎手番、魔力は満タンにもどる。\nずらすと、魔物の上の見こみ（倒す・−数字）がその場で変わる。右クリックか「戻す」で、ずらしを全部もどせる。' },
    { title: '撃ちぬいた先が、道になる', text: '呪文は手前の魔物から順に貫き、余った力は段の奥の壁に届く。\n茨は炎、地底湖は氷、歯車は雷、封印は光。ひびの入った壁は、どの紋でも一撃で決まった力以上で崩れる。崩れた壁の向こうは、地図に新しく描かれる。' },
    { title: '見つけた紋を刻む', text: '宝や戦いで手に入れた紋は、地図の右の「詠唱輪を組む」で、リールのマスに刻める。持ち物の紋を押して、置きたいマスを押す。\n行は左から読むので、1本目のリールにもその紋がないと、その紋の行はできない。「試す」で、組み替える前と後を同じ止まり方で比べられる。' },
  ];

  root.GD = D;
  if (typeof module !== 'undefined') module.exports = D;
  if (root.GR) root.GR.setData(D);
})(typeof window !== 'undefined' ? window : this);
