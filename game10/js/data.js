/*
 * ぐるり、夜まつり ― データ（妖・道のり・屋台・ことば）
 * 描画やルールの処理は持たない。sim.js / game.js から読む。
 */
(function (root) {
  'use strict';

  // 玉の種類
  // H: 花火（となりの妖を おどかす） D: 団子（体力） K: 小判（お金） L: 提灯（どれとも つながる）
  const TILE = {
    H: { name: '花火', color: '#ff6a5a', verb: 'おどかす' },
    D: { name: '団子', color: '#8fd46b', verb: 'げんき' },
    K: { name: '小判', color: '#ffc94a', verb: 'こづかい' },
    L: { name: '提灯', color: '#ffe9c4', verb: 'なんでも' }
  };

  // おじゃま（つなげない。花火の となりで もえる／輪の中で きえる）
  const JUNK = {
    leaf: { name: '葉っぱ' },
    azuki: { name: '小豆' },
    bubble: { name: '泡' },
    rock: { name: '石' }
  };

  // 妖
  // act: hit=体力をへらす / steal=小判をとる / grow=のびる / hop=はねまわる / azuki=小豆をまく
  //      flee=にげる（めずらしい妖） / onibi=おいはらうと まわりに火がうつる / chochin=まわりを提灯にする
  const SPECIES = {
    mame: {
      name: '豆だぬき', area: 1, hp: 2, atk: 1, cd: 3, act: 'hit',
      desc: '田んぼの あぜで ころころ ころがる こだぬき。おなかを ぽんと たたいて おどかしてくる。',
      perk: 'koban1', perkText: '小判を つなぐと 小判 +1まい'
    },
    kooni: {
      name: '鬼の子', area: 1, hp: 4, atk: 2, cd: 3, act: 'hit',
      desc: 'まつりの たいこが すきな ちいさな鬼。にぎりこぶしが ちょっと いたい。',
      perk: 'bigfire', perkText: '花火を 6つ以上 つなぐと、あたる妖に +1'
    },
    zashiki: {
      name: '座敷わらし', area: 1, hp: 6, atk: 0, cd: 6, act: 'flee', rare: true,
      desc: 'いると しあわせが くるという、おかっぱの こども。人みしりで、すぐ どこかへ かえってしまう。',
      perk: 'luck3', perkText: '戦いに かつと 小判 +3'
    },
    kasa: {
      name: '唐傘おばけ', area: 2, hp: 4, atk: 1, cd: 2, act: 'hop',
      desc: 'ひとつ目 一本足の かさ。じっと していられず、ぴょんぴょん はねまわる。',
      perk: 'hp2', perkText: '体力の 上限 +2'
    },
    takenoko: {
      name: 'たけのこ坊主', area: 2, hp: 4, atk: 2, cd: 3, act: 'grow',
      desc: 'ほうっておくと ずんずん のびる。のびるたびに かたく なる。',
      perk: 'dango1', perkText: '団子を つなぐと 体力 さらに +1'
    },
    kamaitachi: {
      name: 'かまいたち', area: 2, hp: 7, atk: 0, cd: 6, act: 'flee', rare: true,
      desc: 'つむじ風に のって くる いたち。目に とまらぬ はやさで、すぐ 風に きえる。',
      perk: 'cord1', perkText: 'ひもが 1つぶん のびる'
    },
    kappa: {
      name: '河童', area: 3, hp: 6, atk: 2, cd: 3, act: 'steal',
      desc: '川べりの いたずらもの。小判が あれば 3まい もっていく。なければ つっぱりを くらわす。',
      perk: 'plate', perkText: '戦いの はじめに お皿の守り 1'
    },
    azuki: {
      name: '小豆洗い', area: 3, hp: 5, atk: 1, cd: 2, act: 'azuki',
      desc: 'しゃきしゃき 小豆を あらう音。まわりに 小豆を まきちらして、玉を うめてしまう。',
      perk: 'junkcoin', perkText: 'おじゃまが もえると 小判 +1'
    },
    ryu: {
      name: '竜の子', area: 3, hp: 8, atk: 0, cd: 6, act: 'flee', rare: true,
      desc: '川で うまれた ちいさな竜。月が のぼると 空へ かえっていく。',
      perk: 'hp4', perkText: '体力の 上限 +4'
    },
    onibi: {
      name: '鬼火', area: 4, hp: 4, atk: 1, cd: 2, act: 'onibi',
      desc: '石段に ゆらゆら うかぶ 青い火。おいはらうと、ぱっと はじけて まわりの妖にも 火が うつる。',
      perk: 'fire1', perkText: '花火が あたると +1'
    },
    chochin: {
      name: '提灯おばけ', area: 4, hp: 8, atk: 2, cd: 3, act: 'chochin',
      desc: 'べろを だした やぶれ提灯。なかまを ふやそうと、まわりの玉を 提灯に かえてしまう。',
      perk: 'lantern', perkText: '提灯が すこし でやすくなる'
    },
    kitsune: {
      name: '子ぎつね', area: 4, hp: 8, atk: 0, cd: 6, act: 'flee', rare: true,
      desc: 'お稲荷さんの おつかいの 見ならい。まつりの 灯りが 気になって、こっそり 見にきた。',
      perk: 'ringheal', perkText: 'むすぶたびに 体力 +2'
    },
    // ぬし（盤の上には いない。花火は 空へ あがって ぬしに とどく）
    danuki: {
      name: '大だぬき', area: 1, boss: true, hp: 40, atk: 2, cd: 3, act: 'b_danuki',
      desc: 'あぜ道の ぬし。ばけるのが とくいで、玉を 葉っぱに かえてしまう。ほんとうは さびしがりや。',
      perk: 'hp3', perkText: '体力の 上限 +3'
    },
    tengu: {
      name: '大天狗', area: 2, boss: true, hp: 60, atk: 3, cd: 3, act: 'b_tengu',
      desc: '竹林の ぬし。うちわの ひとあおぎで、玉の 列を 風で ずらしてしまう。',
      perk: 'cord1b', perkText: 'ひもが 1つぶん のびる'
    },
    gama: {
      name: '大がま', area: 3, boss: true, hp: 80, atk: 3, cd: 3, act: 'b_gama',
      desc: '川の ぬし。ぷうっと ふくらんで、泡で 玉を つつんでしまう。',
      perk: 'dango1b', perkText: '団子を つなぐと 体力 さらに +1'
    },
    oni: {
      name: '大鬼', area: 4, boss: true, hp: 110, atk: 4, cd: 4, act: 'b_oni',
      desc: '社の 大だいこを まもる鬼。だれも まつりに よんでくれないので、たいこを たたいて あばれている。',
      perk: 'none', perkText: 'まつりの たいこを たたいてくれる'
    }
  };

  const SPECIES_ORDER = ['mame', 'kooni', 'zashiki', 'danuki', 'kasa', 'takenoko', 'kamaitachi', 'tengu',
    'kappa', 'azuki', 'ryu', 'gama', 'onibi', 'chochin', 'kitsune', 'oni'];

  // 屋台の品
  const SHOP_ITEMS = {
    takoyaki: { name: 'たこ焼き', price: 12, text: '体力が ぜんぶ もどる' },
    ringoame: { name: 'りんご飴', price: 24, text: '体力の 上限 +3（そのぶん 回復）' },
    omen: { name: 'きつねのお面', price: 40, text: '戦いごとに 1回、こうげきを ふせぐ', once: true },
    hanabidama: { name: '大玉花火', price: 44, text: '花火が あたった妖に +1', once: true },
    himo: { name: '組みひも', price: 36, text: 'ひもが 1つぶん のびる（長い鎖・大きな輪）' },
    kingyo: { name: '金魚すくい', price: 20, text: '小判を つなぐと、もらえる 小判が 1まい ふえる' },
    wataame: { name: 'わたあめ', price: 20, text: '団子を つなぐと、体力が さらに +1' }
  };

  // ふつうの戦い：queue に入った妖が、max まで 盤に あらわれる
  // fixed: はじめの盤（7行×7文字。H D K L = 玉、a〜 = queue の順番の妖、. = ランダム）
  const BATTLES = {
    a1b1: {
      title: 'あぜ道の いりぐち', queue: ['mame', 'mame', 'mame'], max: 1, weights: { H: 34, D: 22, K: 32, L: 12 },
      fixed: [
        'KDKDHKD',
        'DKHKDDK',
        'KDHaDKH',
        'DKHDKHK',
        'HDKKDDK',
        'KHDHKKD',
        'DKKDHDK'
      ],
      guide: 'fire'
    },
    a1b2: {
      title: 'ほたるの 田んぼ', queue: ['mame', 'kooni', 'mame', 'mame', 'kooni'], max: 2, weights: { H: 33, D: 22, K: 33, L: 12 },
      fixed: [
        'DHDKHDK',
        'HDKKDHD',
        'DHKaKHK',
        'KDHKDDH',
        'HKDHKDH',
        'DHKDHKD',
        'KDHKDHK'
      ],
      guide: 'ring'
    },
    a1e: { title: 'わらべうたの 小道', rareFirst: true, queue: ['zashiki', 'mame', 'kooni', 'mame', 'kooni'], max: 3, weights: { H: 33, D: 22, K: 33, L: 12 } },
    a1boss: { title: 'あぜ道の ぬし', boss: 'danuki', queue: ['mame', 'mame'], summon: ['mame', 'kooni'], max: 2, weights: { H: 34, D: 23, K: 31, L: 12 } },

    a2b1: { title: '竹林の 入口', queue: ['kasa', 'mame', 'kasa', 'kooni', 'kasa', 'mame'], max: 3, weights: { H: 34, D: 22, K: 32, L: 12 } },
    a2b2: { title: '月の 竹林', queue: ['takenoko', 'kasa', 'takenoko', 'kooni', 'kasa'], max: 3, weights: { H: 34, D: 22, K: 32, L: 12 } },
    a2e: { title: 'つむじ風の 抜け道', rareFirst: true, queue: ['kamaitachi', 'takenoko', 'kasa', 'kasa', 'kooni', 'takenoko'], max: 3, weights: { H: 34, D: 22, K: 32, L: 12 } },
    a2boss: { title: '竹林の ぬし', boss: 'tengu', queue: ['kasa', 'takenoko'], summon: ['kasa', 'takenoko'], max: 2, weights: { H: 35, D: 23, K: 30, L: 12 } },

    a3b1: { title: '川べりの 土手', queue: ['kappa', 'azuki', 'kappa', 'kasa', 'azuki', 'kappa'], max: 3, weights: { H: 34, D: 22, K: 32, L: 12 } },
    a3b2: { title: '灯籠ながしの 浅瀬', queue: ['azuki', 'kappa', 'takenoko', 'azuki', 'kappa', 'kappa'], max: 3, weights: { H: 34, D: 22, K: 32, L: 12 } },
    a3e: { title: '竜の 淵', rareFirst: true, queue: ['ryu', 'kappa', 'azuki', 'kooni', 'kappa', 'azuki'], max: 3, weights: { H: 34, D: 22, K: 32, L: 12 } },
    a3boss: { title: '川の ぬし', boss: 'gama', queue: ['kappa', 'azuki'], summon: ['kappa', 'azuki'], max: 2, weights: { H: 35, D: 23, K: 30, L: 12 } },

    a4b1: { title: '鬼火の 石段', queue: ['onibi', 'chochin', 'onibi', 'onibi', 'kooni', 'chochin', 'onibi', 'kappa'], max: 4, weights: { H: 34, D: 23, K: 31, L: 12 } },
    a4e: { title: 'お稲荷さんの 小径', rareFirst: true, queue: ['kitsune', 'onibi', 'chochin', 'onibi', 'kappa', 'chochin'], max: 3, weights: { H: 34, D: 23, K: 31, L: 12 } },
    a4boss: { title: '社の 大だいこ', boss: 'oni', queue: ['onibi', 'kooni'], summon: ['onibi', 'kasa', 'kappa', 'chochin', 'takenoko', 'azuki'], max: 3, weights: { H: 35, D: 24, K: 29, L: 12 } }
  };

  // 道のり（4つの区間）。nodes は 順番に すすむ。配列の ところは わかれ道（どちらか ひとつ）
  const AREAS = [
    {
      id: 1, name: 'あぜ道', sub: '田んぼと ほたる', sky: ['#1b2550', '#5a4a7a', '#e58f6a'],
      nodes: ['a1b1', 'a1b2', ['a1e', 'rest'], 'shop1', 'a1boss'],
      intro: ['夏まつりの夜。ゆいは ひとりで 社（やしろ）へ いそいでいた。', 'ところが あぜ道は、妖（あやかし）たちで いっぱい。', '「ばあちゃんの 紅白の ひも、もってきて よかった。」']
    },
    {
      id: 2, name: '竹林', sub: '月と 竹の 道', sky: ['#0d1a33', '#1d3a52', '#3d6a6a'],
      nodes: ['a2b1', 'a2b2', ['a2e', 'rest'], 'shop2', 'a2boss'],
      intro: ['竹林に はいると、まつりばやしが すこし ちかくなった。', '「みんなも、まつりに いきたいの？」']
    },
    {
      id: 3, name: '川べり', sub: '灯籠の ながれる 川', sky: ['#0b1430', '#1a2c5a', '#2e4f7a'],
      nodes: ['a3b1', 'a3b2', ['a3e', 'rest'], 'shop3', 'a3boss'],
      intro: ['川には 灯籠が ながれていた。橋の むこうに、社の 石段が 見える。', 'うしろを ついてくる 妖たちが、すこし ずつ ふえていく。']
    },
    {
      id: 4, name: '社の 石段', sub: 'まつりの 灯り', sky: ['#120a24', '#3a1838', '#7a3040'],
      nodes: ['a4b1', ['a4e', 'rest'], 'shop4', 'a4boss'],
      intro: ['石段の 上から、ドドン、ドドン、と 大きな たいこの 音。', '「あれは、まつりの たいこじゃ ない……。」']
    }
  ];

  const SHOPS = {
    shop1: ['takoyaki', 'himo', 'kingyo', 'ringoame'],
    shop2: ['takoyaki', 'hanabidama', 'omen', 'wataame'],
    shop3: ['takoyaki', 'himo', 'ringoame', 'kingyo'],
    shop4: ['takoyaki', 'himo', 'omen', 'wataame']
  };

  // ぬしと はなす ことば
  const BOSS_TALK = {
    danuki: {
      before: ['「ここから さきは とおさんぞ！」', '「まつりなんぞ、人間だけで たのしめば よかろう！」'],
      after: ['「……わしらも、まつりに いって いいのか？」', '「ふん。しかたない、ついていって やろう。」']
    },
    tengu: {
      before: ['「人の子よ、その ひもで なにを する。」', '「この 竹林の 風、ぬけられるものなら ぬけてみよ。」'],
      after: ['「……むすばれるのも、わるくない。」', '「まつりの 花火は、天狗の 目にも うつくしかろう。」']
    },
    gama: {
      before: ['「げこ。川を わたりたいなら、ぜんぶ おいていけ。」', '「泡で つつんで、ぜんぶ しまっちゃうぞ。」'],
      after: ['「げこ……ぷしゅう。」', '「まつりの 金魚、見に いっても いいかな。」']
    },
    oni: {
      before: ['ドドン！ ドドン！', '「だれも よんで くれん まつりなど、たいこで ふきとばして くれる！」'],
      after: ['「……おまえ、わしを よびに きたのか。」', '「ならば、たたこう。まつりの たいこを！」']
    }
  };

  const OPENING = [
    '夏まつりの夜。',
    'ゆいは、社（やしろ）の まつりへ いそいでいた。',
    'ところが 参道には、まつりに 入れない 妖（あやかし）たちが あふれていた。',
    '「とおして！」と いっても、だれも どいて くれない。',
    'ゆいは ばあちゃんに もらった 紅白の ひもを にぎった。',
    '「ぐるっと むすべば、ともだち。だったよね。」'
  ];

  const ENDING = [
    '社の 境内に、まつりの 灯りが ともった。',
    '大鬼の たいこが、ドン、ドン、と まつりばやしを きざむ。',
    'ゆいの うしろには、むすんだ 妖たちの 行列。',
    '人も 妖も、いっしょに 夜店を のぞいて、花火を 見あげた。',
    'ことしの 夏まつりは、いつもより ずっと にぎやかだった。'
  ];

  const D = { TILE, JUNK, SPECIES, SPECIES_ORDER, SHOP_ITEMS, BATTLES, AREAS, SHOPS, BOSS_TALK, OPENING, ENDING };
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
  else root.G10Data = D;
})(typeof window !== 'undefined' ? window : globalThis);
