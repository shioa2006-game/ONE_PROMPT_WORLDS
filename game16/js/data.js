// 呪いほどき — 地方・戦い・品ぞろえのデータ
// waves の書式：[出現する手番, 魔物の種類, 段(0上〜2下 / 'r'は空いた段), 呪いの強さ, {追加}]
// 出現する手番に「接近の列」（床の右の外）に現れ、次の手番に床へ入る。手番0の魔物は、はじめから床の右端にいる。
(function (root) {
  'use strict';
  const D = {};

  D.START_REELS = ['L___L___', '_L___L__', '__L___L_'];
  D.NEW_REEL = ['___L____', '____L___'];

  // 縦一列（3段）にそろって来る群れ
  const C3 = (t, k, hp, o) => [[t, k, 0, hp, o], [t, k, 1, hp, o], [t, k, 2, hp, o]];
  const flat = arr => [].concat.apply([], arr.map(x => (Array.isArray(x[0]) ? x : [x])));

  D.STAGES = [
    {
      id: 'v1', region: 0, name: '麦畑の村（朝）', sub: '朝。呪われた村人たちが、結界へ歩いてくる。', bg: 'village', time: 'morning',
      reels: 3, hearts: 3, tutorial: 1,
      waves: [
        [0, 'imp', 1, 2], [1, 'imp', 0, 2], [2, 'imp', 2, 4], [3, 'imp', 'r', 2],
        [4, 'imp', 'r', 3], [4, 'imp', 'r', 2], [6, 'imp', 'r', 3], [6, 'imp', 'r', 3],
      ],
    },
    {
      id: 'v2', region: 0, name: '麦畑の村（夕）', sub: '夕。村長の家から、大きな影が出てきた。', bg: 'village', time: 'dusk',
      reels: 3, hearts: 3, tutorial: 2,
      waves: [
        [0, 'imp', 'r', 3], [0, 'imp', 'r', 2], [1, 'imp', 'r', 3], [2, 'imp', 'r', 3],
        [3, 'boss', 0, 16, { name: '村長', who: 'elder' }], [4, 'imp', 2, 3], [6, 'imp', 2, 3], [7, 'imp', 'r', 4],
      ],
    },
    {
      id: 'f', region: 1, name: '影の森', sub: '足の速い影狼が、木々のあいだを駆けてくる。凍らせれば止まる。', bg: 'forest', time: 'night',
      reels: 3, hearts: 3,
      waves: flat([
        [0, 'imp', 'r', 4], [0, 'wolf', 'r', 3], [1, 'imp', 'r', 4], [2, 'wolf', 'r', 4], [2, 'imp', 'r', 4],
        [3, 'imp', 'r', 5], [4, 'wolf', 'r', 4], [4, 'wolf', 'r', 4], [5, 'imp', 'r', 5], [5, 'imp', 'r', 5],
        [6, 'boss', 'r', 28, { name: '狩人', who: 'hunter' }], [7, 'wolf', 'r', 5], [8, 'imp', 'r', 5], [8, 'wolf', 'r', 5], [10, 'imp', 'r', 6],
      ]),
    },
    {
      id: 'm', region: 2, name: '鉱山の町', sub: '岩の殻をまとった岩鬼。盾の数より弱い一撃は弾かれる。', bg: 'mine', time: 'night',
      reels: 4, hearts: 3,
      waves: flat([
        [0, 'golem', 'r', 6, { armor: 4 }], [0, 'imp', 'r', 5], [1, 'imp', 'r', 5], [1, 'imp', 'r', 5],
        [2, 'golem', 'r', 8, { armor: 4 }], [2, 'wolf', 'r', 5], [3, 'imp', 'r', 6], [3, 'imp', 'r', 6],
        [4, 'golem', 'r', 8, { armor: 5 }], [4, 'golem', 'r', 8, { armor: 4 }], [5, 'wolf', 'r', 6], [5, 'imp', 'r', 6],
        [6, 'boss', 'r', 48, { name: '鍛冶屋', who: 'smith', armor: 6 }], [6, 'imp', 'r', 6], [7, 'golem', 'r', 10, { armor: 5 }],
        [8, 'imp', 'r', 7], [8, 'wolf', 'r', 6], [9, 'golem', 'r', 10, { armor: 5 }], [10, 'imp', 'r', 7], [10, 'imp', 'r', 7],
      ]),
    },
    {
      id: 'l', region: 3, name: '霧の湖', sub: '霧の子どもたちが、手をつないでやってくる。', bg: 'lake', time: 'night',
      reels: 4, hearts: 3, hpMul: 1.3,
      waves: flat([
        C3(0, 'wisp', 3), [1, 'imp', 'r', 6], C3(2, 'wisp', 4), [3, 'golem', 'r', 10, { armor: 5 }], [3, 'wolf', 'r', 6],
        C3(4, 'wisp', 4), [5, 'imp', 'r', 7], [5, 'imp', 'r', 7], [6, 'boss', 'r', 60, { name: '湖の賢者', who: 'sage' }],
        C3(7, 'wisp', 5), [8, 'wolf', 'r', 7], C3(9, 'wisp', 5), [10, 'golem', 'r', 12, { armor: 5 }], C3(11, 'wisp', 6),
      ]),
    },
    {
      id: 'c', region: 4, name: '王都', sub: '城門の前に、影の騎士たちが列をなす。', bg: 'castle', time: 'night',
      reels: 5, hearts: 3, hpMul: 1.25,
      waves: flat([
        [0, 'knight', 'r', 14], [0, 'imp', 'r', 7], [0, 'imp', 'r', 7], C3(1, 'wisp', 5),
        [2, 'golem', 'r', 12, { armor: 6 }], [2, 'wolf', 'r', 8], [3, 'knight', 'r', 16], [3, 'imp', 'r', 8], C3(4, 'wisp', 6),
        [5, 'golem', 'r', 14, { armor: 6 }], [5, 'wolf', 'r', 8], [6, 'knight', 'r', 18], [6, 'imp', 'r', 9], [6, 'imp', 'r', 9],
        [7, 'boss', 'r', 110, { name: '王女', who: 'princess', armor: 8 }], C3(8, 'wisp', 6), [9, 'knight', 'r', 18], [9, 'wolf', 'r', 9],
        [10, 'golem', 'r', 16, { armor: 7 }], [10, 'imp', 'r', 10], C3(11, 'wisp', 7), [12, 'knight', 'r', 20],
      ]),
    },
    {
      id: 't', region: 5, name: '灰の塔', sub: '王国じゅうの呪いが、この塔から流れ出している。', bg: 'tower', time: 'ash',
      reels: 5, hearts: 3, hpMul: 1.1, final: true,
      finale: { casts: 3, hp: [12, 22, 40], mpBonus: 3 },
      waves: flat([
        C3(0, 'imp', 8), C3(1, 'wisp', 6), [2, 'knight', 'r', 20], [2, 'golem', 'r', 14, { armor: 7 }], [2, 'wolf', 'r', 10],
        C3(3, 'wisp', 7), [4, 'knight', 'r', 22], [4, 'imp', 'r', 10], [4, 'imp', 'r', 10],
        [5, 'boss', 0, 240, { name: '灰の魔女', who: 'witch', w: 2, h: 3, armor: 10 }],
        C3(6, 'wisp', 8), [7, 'golem', 'r', 16, { armor: 8 }], [7, 'wolf', 'r', 12], C3(8, 'imp', 12), [9, 'knight', 'r', 24], [9, 'wolf', 'r', 12],
        C3(10, 'wisp', 9), [11, 'golem', 'r', 18, { armor: 8 }], [11, 'knight', 'r', 24], C3(12, 'imp', 14),
      ]),
    },
  ];

  // 地方ごとの「お礼」（3つから1つ選ぶ）と、市の品ぞろえ
  D.GIFTS = {
    v1: [['light', 1]],
    v2: [['light', 1], ['ice', 1], ['light', 1]],
    f: [['ice', 1], ['light', 1], ['gem', 1]],
    m: [['bolt', 1], ['light', 2], ['gem', 1]],
    l: [['star', 1], ['bolt', 1], ['light', 2]],
    c: [['star', 1], ['gem', 2], ['bolt', 2]],
  };
  // 解放：その地の主を救うと、次から使えるもの
  D.UNLOCK = {
    v2: { shop: ['light', 'ice'], text: '村長が村の市をひらいてくれた。' },
    f: { reel: 4, shop: ['light', 'ice', 'gem'], text: '狩人が森で見つけた「四つ目の輪」を返してくれた。魔晶も市に並ぶ。' },
    m: { smith: true, shop: ['light', 'ice', 'gem', 'bolt'], text: '鍛冶屋が紋を鍛えてくれる。坑道の雷石から、雷の紋も作れるようになった。' },
    l: { reel: 5, shop: ['light', 'ice', 'gem', 'bolt', 'star'], text: '湖の賢者が「五つ目の輪」と、星の紋の作り方を教えてくれた。' },
    c: { mp: 1, text: '王女が王家の泉をひらき、魔力の器がひとつ大きくなった。' },
  };
  // 地図の上の地方（x,y は地図の上の位置）
  D.REGIONS = [
    { name: '麦畑の村', x: 170, y: 520, bg: 'village' },
    { name: '影の森', x: 380, y: 420, bg: 'forest' },
    { name: '鉱山の町', x: 560, y: 520, bg: 'mine' },
    { name: '霧の湖', x: 760, y: 400, bg: 'lake' },
    { name: '王都', x: 930, y: 280, bg: 'castle' },
    { name: '灰の塔', x: 1110, y: 170, bg: 'tower' },
  ];

  D.STORY = {
    prologue: [
      '王国ハルモアに、灰の魔女の呪いが降った。\n人々は影の魔物に変えられ、町から灯が消えた。',
      '呪いをまぬがれた見習い魔導士のあなたは、師匠ののこした「詠唱輪」を受けついだ。\n床に描く魔法陣を、リールのように回す道具だ。',
      '紋の上に立った魔物は、詠唱で呪いがほどけ、人にもどる。\n結界をまもり、王国の人々を取りもどそう。',
    ],
    after: {
      v1: [{ who: 'villager', name: '村の人', text: 'たすかったよ！ これ、畑で光っていた石なんだ。あんたの輪に使えないかい？' }],
      v2: [{ who: 'elder', name: '村長', text: 'わしとしたことが、村を襲う側になるとは……。礼に村の市をひらこう。集めておいた紋を、感謝のしるしと引きかえに分けてやれる。' },
        { who: 'elder', name: '村長', text: '森へ行くなら、氷の紋を持っていきなさい。影狼の足を止められる。' }],
      f: [{ who: 'hunter', name: '狩人', text: '森の奥で、光る輪を拾ってな。あんたの詠唱輪の一部だろう？ 返すよ。' },
        { who: 'hunter', name: '狩人', text: '魔晶も見つけた。となりの紋の力を何倍にもする石だ。市に並べておく。' }],
      m: [{ who: 'smith', name: '鍛冶屋', text: 'ふう、岩の殻が重かった。礼に紋を鍛えてやる。鍛えた紋は、ひとつで二つ分、三つ分の力になる。' },
        { who: 'smith', name: '鍛冶屋', text: '坑道の雷石で、雷の紋も打てる。くっついて並んだ魔物に、次々と跳ぶぞ。' }],
      l: [{ who: 'sage', name: '湖の賢者', text: '霧が晴れた……。そなたの師が湖にあずけていた、最後の輪じゃ。' },
        { who: 'sage', name: '湖の賢者', text: 'それから星の紋。どの紋ともつながる。ばらばらの紋を、ひとつにまとめる紋じゃ。' }],
      c: [{ who: 'princess', name: '王女', text: 'ありがとう。……魔女は灰の塔にいます。王家の泉の水で、あなたの魔力を満たしましょう。' },
        { who: 'princess', name: '王女', text: 'あの塔から、王国じゅうの呪いが流れ出しています。どうか、あの人を止めて。' }],
    },
  };

  D.PRICE = { light: 5, ice: 4, gem: 8, bolt: 6, star: 9 };
  D.MP_PRICE = [8, 14, 22];
  D.REGEN_PRICE = 18;

  if (typeof module !== 'undefined' && module.exports) module.exports = D;
  else root.RRD = D;
})(this);
