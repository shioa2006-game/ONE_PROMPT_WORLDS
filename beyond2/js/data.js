// GUILDWARD — 依頼の地図・ギルド・物語の文
// hmap: 高さ（0-9, a-z）。'.' は谷（足場なし）。tmap: 地面の種類
//   f 石 / g 草 / d 土 / p 板 / m 古い石畳 / x 立てない壁の上 / w 水 / r 流れの速い水 / i 氷 / k 暗い石 / s 砂
(function (root) {
  'use strict';
  const MAPS = {};
  const add = (m) => { MAPS[m.id] = m; };

  // ======================================================================
  // 依頼1　畑あらしの小鬼（退治・はじめての依頼）
  // ======================================================================
  add({
    id: 'm1', name: '畑あらしの小鬼', area: 'カザミの丘畑',
    W: 13, H: 12,
    hmap: [
      '777777.777777',
      '444444.444444',
      '444444.444444',
      '444444.444444',
      '444444.444444',
      '444444.444444',
      '444444.444444',
      '444444.222222',
      '111111.222222',
      '111111.222222',
      '111111.222222',
      '111111.222222',
    ],
    tmap: [
      'xxxxxx.xxxxxx',
      'ggdggg.gggggg',
      'wwwwww.ggdggg',
      'gggdgg.gggggg',
      'gdgggg.ggggdg',
      'ggggdg.gdgggg',
      'gggggg.gggggg',
      'ggdggg.dddddd',
      'dddddd.dddddd',
      'dddddd.dddddd',
      'dddddd.dddddd',
      'dddddd.dddddd',
    ],
    objs: [
      { k: 'crate', x: 9, y: 8 },
      { k: 'anchor', x: 3, y: 3 },
      { k: 'chest', x: 2, y: 1, coins: 30, say: [['riko', '小鬼がためこんでた銀貨だ！ …ハンスさんに半分返そうか']] },
      { k: 'wagon', x: 12, y: 11 },
      { k: 'deco', sub: 'tree', x: 12, y: 1, h: 3 },
      { k: 'deco', sub: 'tree', x: 0, y: 5, h: 3 },
      { k: 'deco', sub: 'pumpkin', x: 7, y: 10, h: 1 },
      { k: 'deco', sub: 'pumpkin', x: 8, y: 11, h: 1 },
      { k: 'deco', sub: 'pumpkin', x: 2, y: 9, h: 1 },
      { k: 'deco', sub: 'pumpkin', x: 4, y: 10, h: 1 },
      { k: 'deco', sub: 'fence', x: 7, y: 7, h: 1 },
    ],
    start: [[10, 10, 3], [11, 9, 3], [9, 10, 3]],
    enemies: [
      { k: 'goblin', x: 2, y: 7, wake: 2 },
      { k: 'goblin', x: 4, y: 6, wake: 2 },
      { k: 'goblin', x: 1, y: 4, wake: 2 },
    ],
    objective: { k: 'kill' },
    goalText: (st, o) => o.done ? '小鬼を追いはらった！' : '段々畑の上の小鬼をたおす（のこり ' + o.left + '）',
    enterSay: [
      ['riko', 'ここがハンスさんの段々畑…。小鬼は、上のほうだって'],
      ['gard', 'まずは、あの木箱だな。高い段のすぐ下へ押せば、足場になる'],
    ],
    trig: [
      { id: 'onB', r: [7, 1, 12, 6], say: [['riko', '谷の向こうに鉄の輪！ ぼくの鉤縄なら届くよ']] },
      { id: 'pond', r: [0, 3, 5, 7], flag: 'won1', need: ['freeze'], say: [['sena', '奥の池の向こうに、箱が…。凍らせれば渡れます']] },
    ],
    fightSay: { 1: [['riko', 'いた、小鬼だ！'], ['gard', '崖っぷちへ追いこめ。わしが押し落とす'], ['sena', '凍らせれば、押したときにすべって止まりません']] },
    winSay: { 1: [['riko', 'やった！ はじめての依頼、達成だね！']] },
    hints: [
      { done: [9, 5], need: 'push', o: 'o1', mark: [9, 7], text: '高い段のすぐ下（光る升）へ木箱を押せば、足場になる',
        wrong: '木箱は Z で戻せる。高い段のすぐ下、光る升へ押せば足場になる',
        alt: { need: 'blast', mark: [9, 9], text: '木箱の手前（光る升）で発破すれば、高い段のすぐ下へ吹き飛んで足場になるっす' } },   // 受けなおし（ガルドがいない編成）用（v0.2）
      { done: [3, 4], need: 'rope', mark: 'o2', text: '谷の向こうの鉄の輪に、ぼくの鉤縄をかければ渡れるよ' },
      { done: [2, 1], need: 'freeze', mark: [2, 2], text: '（寄り道）池を凍らせれば、奥の箱まで歩いて渡れます' },
    ],
    combatHint: [['gard', '小鬼を崖っぷちから下の畑へ押し落とせば、一押しだ'], ['sena', '凍らせてから押すと、止まらずにすべっていきます'], ['riko', '赤い線は「手番を終えたら、敵がどう動くか」。だれが何点受けるかも出るよ']],
    bg: { top: '#1c2a4a', mid: '#2a3a5c', bot: '#14182c', ridge: '#1a2238', sky: true },
    music: 'field',
  });

  // ======================================================================
  // 依頼2　見張り塔の角笛（宝物回収）
  // ======================================================================
  add({
    id: 'm2', name: '見張り塔の角笛', area: 'カザミ東の見張り塔',
    W: 14, H: 13,
    hmap: [
      '99999999999999',
      '33537775553333',
      '33537775653333',
      '53535555553333',
      '33335555553333',
      '33335555553333',
      '33333333333333',
      '33333333333333',
      '42222222222224',
      '42222222222224',
      '22222222222222',
      '22222222222222',
      '22222222222222',
    ],
    tmap: [
      'xxxxxxxxxxxxxx',
      'ggxgmmmmmmgggg',
      'ggxgmmmmmmgdgg',
      'xpxgmmmmmmgggg',
      'ggggmmmmmmggdg',
      'gdggmmmmmmgggg',
      'ggggggdgggggdg',
      'gggdgggggggggg',
      'xwwwwwwwwwwwwx',
      'xwwwwwwwwwwwwx',
      'gggdggggggggdg',
      'ggggggggdggggg',
      'gggggggggggggg',
    ],
    objs: [
      { k: 'crate', x: 8, y: 2 },
      { k: 'anchor', x: 6, y: 5 },
      { k: 'chest', x: 5, y: 1, item: 'horn', say: [['riko', 'あった、見張りの角笛！'], ['gard', '…重いな。昔はこれで、町じゅうに知らせたものだ']] },
      { k: 'door', id: 'dr', x: 1, y: 3 },
      { k: 'target', x: 4, y: 4, on: 'open:dr', label: '的を射ぬいた。古い倉の扉がひらいた' },
      { k: 'chest', x: 0, y: 1, coins: 40, say: [['sena', '見張りの人たちの、へそくりでしょうか…']] },
      { k: 'wagon', x: 12, y: 12 },
      { k: 'torch', x: 4, y: 1, fz: 3 },
      { k: 'torch', x: 9, y: 1, fz: 3 },
      { k: 'deco', sub: 'tree', x: 13, y: 6, h: 3 },
      { k: 'deco', sub: 'tree', x: 0, y: 11, h: 3 },
      { k: 'deco', sub: 'rock', x: 12, y: 3, h: 1 },
    ],
    start: [[11, 11, 3], [12, 10, 3], [10, 11, 3]],
    enemies: [
      { k: 'archer', x: 7, y: 4, wake: 6 },
      { k: 'archer', x: 5, y: 3, wake: 6 },
      { k: 'goblin', x: 2, y: 6, wake: 5 },
      { k: 'goblin', x: 11, y: 5, wake: 5 },
      { k: 'goblin', x: 9, y: 7, wake: 5 },
    ],
    objective: { k: 'item', item: 'horn' },
    goalText: (st, o) => o.done ? '角笛を手に入れた！' : '塔のてっぺんの角笛を手に入れる',
    enterSay: [
      ['riko', 'あれが見張り塔…。てっぺんに角笛があるんだって'],
      ['sena', '手前は堀ですね。凍らせれば渡れます'],
    ],
    trig: [
      { id: 'tower', r: [0, 6, 13, 7], flag: 'won1', say: [['riko', '塔の中段に鉄の輪！ 縄でのぼれるよ']] },
      { id: 'mid', r: [4, 3, 9, 5], say: [['gard', 'てっぺんまで、あと2段か…。あの台の上の木箱を落とせば、足場になるぞ']] },
    ],
    fightSay: { 1: [['riko', '塔の上に骨の射手！'], ['gard', '高い所から射られると痛いぞ。まずは手前の小鬼だ']] },
    winSay: { 1: [['sena', '…ふう。高い所を取られると、こうも手こずるんですね']] },
    hints: [
      { done: [6, 7], need: 'freeze', mark: [6, 9], text: '堀の水を凍らせれば、氷の上を歩いて渡れます' },
      { done: [6, 4], need: 'rope', mark: 'o2', text: '塔の中段の鉄の輪に、鉤縄をかけよう' },
      { done: [5, 2], need: 'push', o: 'o1', mark: [7, 2], text: '台の上の木箱を、てっぺんの段のすぐ下（光る升）へ落とせば、足場になる',
        wrong: '木箱は Z で戻せる。てっぺんのすぐ下の光る升へ落とそう',
        alt: { need: 'blast', mark: [9, 2], text: '台の上の木箱の奥（光る升）で発破すれば、てっぺんの段のすぐ下へ落とせるっす' } },   // 受けなおし（ガルドがいない編成）用（v0.2）
      { done: [0, 1], need: 'shoot', mark: 'o4', text: '（寄り道）塔の壁の的を射れば、左の古い倉がひらくかも' },
    ],
    combatHint: [['riko', '中段の射手には、縄でのぼって近くから射るといいよ'], ['gard', '堀のそばの敵は、押せば水に沈む']],
    bg: { top: '#28305a', mid: '#3a4470', bot: '#141a30', ridge: '#1e2644', sky: true },
    music: 'field',
  });

  // ======================================================================
  // 依頼3　石切り場の落盤（救助・トビと出会う）
  // ======================================================================
  add({
    id: 'm3', name: '石切り場の落盤', area: 'カザミ北の石切り場',
    W: 15, H: 14,
    hmap: [
      '999999999999999',
      '6666.5556666666',
      '6666.5556666666',
      '6666.3336666666',
      '3333333333222222'.slice(0, 15),
      '333333333322222',
      '633333333322222',
      '336333333322222',
      '336333333322222',
      '661111111111111',
      '111111111111111',
      '111111111111111',
      '111111111111111',
      '111111111111111',
    ],
    tmap: [
      'xxxxxxxxxxxxxxx',
      'kkkk.fffxxxxxxx',
      'kkkk.fffxxxxxxx',
      'kkkk.fffxxxxxxx',
      'fwwwffffffddddd',
      'ffffffdfffddddd',
      'xfffffffffddddd',
      'ffxfffdfffddddd',
      'ffxfffffffddddd',
      'xxsssssssssssss',
      'sssssssdssssdss',
      'ssdsssssssssss'.padEnd(15, 's'),
      'sssssssssdsssss',
      'sssssssssssssss',
    ],
    objs: [
      { k: 'crate', x: 6, y: 4 },
      { k: 'anchor', x: 3, y: 2 },
      { k: 'fall', x: 2, y: 3, bx: 2, by: 4, label: '滝が凍って、岩棚へのぼれる氷の段になった' },
      { k: 'crack', x: 1, y: 6, h: 2, on: 'flag:freedMiners', label: '岩が砕けた！ 鉱夫たちの道がひらいた' },
      { k: 'chest', x: 7, y: 1, coins: 40, say: [['riko', '石切りの人の忘れ物かな？']] },
      { k: 'wagon', x: 13, y: 12 },
      { k: 'deco', sub: 'rock', x: 9, y: 11, h: 1 },
      { k: 'deco', sub: 'rock', x: 4, y: 12, h: 1 },
      { k: 'deco', sub: 'cart', x: 11, y: 9, h: 1 },
      { k: 'torch', x: 6, y: 1, fz: 2 },
      { k: 'torch', x: 9, y: 4, fz: 2 },
    ],
    npcs: [
      { id: 'tb', k: 'tobi', guest: 'tobi', x: 2, y: 2, face: 0,
        foundSay: [['self', 'おーい！ こっちっす！ …た、助かったぁ'], ['self', '足をくじいちまって。でも、発破なら投げられるっす！']],
        safeSay: [['self', 'みんな、ありがとうっす…！']], onFound: 'wake:2' },
      { id: 'm1', k: 'miner', x: 0, y: 7, found: true, face: 0, name: '鉱夫ボロ', safeSay: [['self', '出られた…！ 恩に着るよ']] },
      { id: 'm2', k: 'miner', x: 1, y: 8, found: true, face: 3, name: '鉱夫ダン', safeSay: [['self', '荷馬車だ！ 助かった！']] },
    ],
    start: [[12, 11, 3], [11, 12, 3], [13, 10, 3]],
    enemies: [
      { k: 'bat', x: 6, y: 6, wake: 4 },
      { k: 'bat', x: 8, y: 5, wake: 4 },
      { k: 'bat', x: 4, y: 7, wake: 4 },
      { k: 'golem', x: 3, y: 5, wake: 0, grp: 2 },
    ],
    objective: { k: 'rescue', to: [[12, 12], [13, 11], [12, 13], [12, 11], [14, 12], [14, 11], [13, 13], [11, 12], [11, 11]] },
    goalText: (st, o) => o.done ? '三人とも助けだした！' : '取り残された人を、荷馬車まで送りとどける（' + o.n + ' / 3人）',
    enterSay: [
      ['riko', 'ひどい…岩がくずれてる。だれか、いませんかー！'],
      ['narr', '「おーい…」岩棚の上と、くずれた岩の奥から声がする'],
    ],
    trig: [
      { id: 'mid', r: [3, 4, 9, 8], say: [['sena', '岩棚の上にひとり…。それと、左の岩の奥にも'], ['gard', '岩棚へは、あの台からなら縄が届きそうだ。台へは木箱で上がれるな']] },
    ],
    fightSay: {
      1: [['riko', 'コウモリだ！ 落盤でさわいでる'], ['sena', '凍らせれば落ちます']],
      2: [['narr', 'ずしん。岩の影が、起きあがった'], ['tb', 'い、岩人形っす！ 重くて押せない相手でも、発破なら吹っ飛ぶっす！']],
    },
    winSay: {
      1: [['gard', '…よし。岩棚の人を、先に見つけよう']],
      2: [['tb', 'へへ…おいらの発破、役に立ったっすか？'], ['riko', '立った立った！ すごいよ！']],
    },
    hints: [
      { done: [6, 2], need: 'push', o: 'o1', mark: [6, 3], text: '木箱を台のすぐ下（光る升）へ押せば、台に上がれる', wrong: '木箱は Z で戻せる。台のすぐ下（光る升）へ押せば、台に上がれる',
        // v0.3：別の手は、いる仲間の順に（ナギがいれば、リコを台へ運ぶ。滝を先に凍らせると、見つけたトビがすぐ帰ってしまい、ひび岩を砕けない）
        alt: [{ need: 'waft', text: '台の上へは、うちがリコを運べるんよ。台のすぐ下から、あおぐ', mark: [5, 3] }, { need: 'freeze', text: '岩棚の滝を凍らせても、のぼれる氷の段になります', mark: 'o3' }] },
      { found: 'tb', need: 'rope', mark: 'o2', text: '台から岩棚の鉄の輪へ、鉤縄をかけよう' },
      { flag: 'freedMiners', need: 'blast', mark: 'o4', text: 'あのひび割れた岩なら、おいらの発破で砕けるっす！（トビを選んで、岩を押す）' },
      { safe: 'tb', need: 'freeze', mark: 'o3', text: 'トビさんは縄を渡れません。滝を凍らせれば、氷の段で下りられます' },
    ],
    combatHint: [['tb', '岩人形のとなりで発破すれば、池へ吹っ飛ばせるっす'], ['sena', '岩人形も、凍らせれば押すとすべります'], ['riko', 'コウモリは矢でも、凍らせて落としても']],
    bg: { top: '#2a2438', mid: '#3a3048', bot: '#141018', ridge: '#221c2c' },
    music: 'cave',
  });

  // ======================================================================
  // 依頼4　風見の遺跡（調査：四つの装置のうち三つを動かす）
  // ======================================================================
  add({
    id: 'm4', name: '風見の遺跡', area: '北の丘の古い遺跡',
    W: 15, H: 15,
    hmap: [
      '999999999999999',
      '777733333337777',
      '777733333337777',
      '777777377777777',
      '777733333335555',
      '333333333335555',
      '333333333335555',
      '333333333335555',
      '333333333335555',
      '333333333334333',
      '333333333333333',
      '333332222233333',
      '333332222233333',
      '333332222233333',
      '333332222233333',
    ],
    tmap: [
      'xxxxxxxxxxxxxxx',
      'xxxxmmmmmmmxxxx',
      'xxxxmmmmmmmxxxx',
      'xxxxxxmxxxxxxxx',
      'xxxxmmmmmmmmmmm',
      'mwwwmmmmmmmmmmm',
      'mwwwmmkmmkmmmmm',
      'mwwwmmmmmmmmmmm',
      'mwwwmmkmmkmmmmm',
      'mwwwmmmmmmmmmmm',
      'mmmmmmmmmmmmmmm',
      'gggggggggggggggg'.slice(0, 15),
      'gmmggggggggggmg',
      'ggggggggggggggg',
      'ggggggggggggggg',
    ],
    objs: [
      { k: 'door', id: 'gate', x: 6, y: 3, h: 4, lamps: ['r1', 'r2', 'r3', 'r4'] },
      { k: 'chest', x: 7, y: 1, item: 'tablet', say: [['sena', '風見の石板…！ 本当にあったんですね'], ['riko', '文字がびっしり。セナ、読める？', { ifHero: 'sena' }], ['sena', '…少しだけ。「大亀が目ざめるとき、谷に風が止む」']] },
      { k: 'chest', x: 9, y: 2, coins: 50, say: [['riko', '古いお金だ！ 鍛冶屋のトンボさんに見せよう']] },
      { k: 'target', x: 13, y: 1, on: 'rune:r1', label: '的を射ぬいた。門の一つめの灯がともった' },
      { k: 'crystal', x: 0, y: 7, on: 'rune:r2', label: '水晶が凍りついて、門の灯がひとつともった' },
      { k: 'block', x: 11, y: 7 },
      { k: 'plate', x: 10, y: 7, on: 'rune:r3', label: '石のブロックが重さの床にのって、門の灯がひとつともった' },
      { k: 'crack', x: 2, y: 12, h: 2, rubble: false, on: 'rune:r4', label: '封印石を砕いた。門の灯がひとつともった' },
      { k: 'wagon', x: 7, y: 14 },
      { k: 'statue', x: 6, y: 6, h: 2 },
      { k: 'statue', x: 9, y: 6, h: 2 },
      { k: 'torch', x: 4, y: 4, fz: 2 },
      { k: 'torch', x: 10, y: 4, fz: 2 },
      { k: 'deco', sub: 'rock', x: 13, y: 12, h: 1 },
      { k: 'deco', sub: 'tree', x: 0, y: 13, h: 3 },
      { k: 'deco', sub: 'tree', x: 14, y: 14, h: 3 },
      { k: 'block', x: 11, y: 5 },
    ],
    start: [[7, 13, 3], [6, 12, 3], [8, 12, 3]],
    enemies: [
      { k: 'golem', x: 5, y: 7, wake: 5 },
      { k: 'golem', x: 9, y: 8, wake: 5 },
      { k: 'archer', x: 12, y: 5, wake: 6 },
      { k: 'archer', x: 3, y: 4, wake: 6, z: 7 },
    ],
    objective: { k: 'runes', need: 3, flags: ['r1', 'r2', 'r3', 'r4'], on: 'open:gate', item: 'tablet' },
    goalText: (st, o) => o.done ? '風見の石板を手に入れた！' : st.flags.runesDone ? '門がひらいた。奥の石板を手に入れる' : '四つの装置のうち三つを動かし、門をひらく（' + o.n + ' / 3）',
    enterSay: [
      ['sena', 'ここが風見の遺跡…。奥の門に、灯の消えた四つの石'],
      ['riko', '的、水晶、重さの床、ひび割れた石…。どれも装置なのかな'],
    ],
    trig: [
      { id: 'yard', r: [4, 4, 10, 10], flag: 'won1', say: [['sena', '門の灯は四つ。三つともせば、ひらくはずです']] },
    ],
    fightSay: { 1: [['riko', '岩人形が動いた！'], ['gard', '重い相手だ。地形を使え']] },
    winSay: { 1: [['riko', 'さあ、装置を動かそう！ 三つでいいんだよね']] },
    hints: [
      { flag: 'r1', need: 'shoot', mark: 'o3', text: '右奥の高い壁に的がある。ぼくが射れば、灯がともるかも' },
      { flag: 'r3', need: 'push', o: 'o5', mark: 'o5', text: '右の段の上の石のブロックを、下の重さの床へ押し落とそう（段の奥から押す）', wrong: 'ブロックがずれたら、段の上のもう一つのブロックでもいい。重さの床（光る升）のとなりの段のふちへ寄せて、奥から押し落とそう' },
      { flag: 'r3', need: 'blast', o: 'o5', mark: [12, 7], text: '石のブロックの奥で発破すれば、下の重さの床へ吹き落とせるっす', wrong: 'ブロックがずれたら、もう一つのブロックで。床のとなりの段のふちへ寄せて、奥で発破っす' },
      { flag: 'r2', need: 'freeze', mark: 'o4', text: '左の池の島に、霜の水晶。わたしが凍らせれば、灯がともるはずです' },
      { flag: 'r4', need: 'blast', mark: 'o7', text: '手前左のひび割れた封印石。おいらの発破で砕けるっす' },
      { flag: 'runesDone', mark: [6, 3], text: '三つ灯れば、門がひらくはず。動かせる装置を探そう' },
      { item: 'tablet', mark: 'o1', text: '門がひらいた！ 奥の石板を取りに行こう' },
    ],
    combatHint: [['gard', '岩人形は平らな所では押せん。段のふちや池のそばなら、押し落とせる'], ['tb', '岩人形も、爆風なら吹っ飛ぶっす。池のそばへ！'], ['sena', '岩人形は池に落とせば沈みます']],
    bg: { top: '#24304a', mid: '#34405e', bot: '#121626', ridge: '#1c2438', sky: true },
    music: 'ruins',
  });

  // ======================================================================
  // 依頼5　川辺の村の米倉（防衛）
  // ======================================================================
  add({
    id: 'm5', name: '川辺の村の米倉', area: 'カザミ川の村',
    W: 15, H: 15,
    hmap: [
      '444444444444444',
      '444444444444444',
      '444444444444444',
      '333333333333333',
      '333333333333333',
      '222232222222222',
      '222232222222222',
      '553333333333555',
      '553333333333555',
      '553333333333555',
      '553333333333555',
      '333333333333433',   // (12,11) は高さ4：南の岸から右の丘へ上がる段（v0.2）
      '333333333333333',
      '333333333333333',
      '333333333333333',
    ],
    tmap: [
      'ggdgggggggdgggg',
      'ggggggdgggggggg',
      'gdggggggggggdgg',
      'ggggdggggggggdg',
      'gggggggggdggggg',
      'rrrrprrrrrrfrrr',
      'rrrrprrrrrrfrrr',
      'ffggpgggggggfff',
      'ffggggdgggggfff',
      'ffgggggggggdfff',
      'ffgdggggggggfff',
      'ggggggggdgggggg',
      'gggggggggggdggg',
      'ggdgggggggggggg',
      'ggggggggggggggg',
    ],
    objs: [
      { k: 'deco', sub: 'granary', x: 7, y: 12, h: 3 },
      { k: 'boulder', x: 4, y: 8 },     // 橋の列の手前（v0.2。北へ押すと橋をぬけて北の岸 (4,3) で止まる）
      { k: 'boulder', x: 11, y: 8 },    // 飛び石の列の手前（v0.2。北へ押すと飛び石 (11,5) の上で止まり、渡り口をふさぐ）
      { k: 'deco', sub: 'house', x: 2, y: 13, h: 3 },
      { k: 'deco', sub: 'house', x: 12, y: 13, h: 3 },
      { k: 'deco', sub: 'tree', x: 0, y: 0, h: 3 },
      { k: 'deco', sub: 'tree', x: 14, y: 1, h: 3 },
      { k: 'deco', sub: 'tree', x: 6, y: 0, h: 3 },
      { k: 'deco', sub: 'fence', x: 5, y: 12, h: 1 },
      { k: 'deco', sub: 'fence', x: 9, y: 12, h: 1 },
      { k: 'wagon', x: 14, y: 14 },
      // 左の崖の上は、だれも上がれないまま。木と岩だけの景色（v0.2）
      { k: 'deco', sub: 'tree', x: 0, y: 8, h: 3 },
      { k: 'deco', sub: 'rock', x: 1, y: 7, h: 1 },
      { k: 'deco', sub: 'rock', x: 0, y: 10, h: 1 },
    ],
    start: [[7, 9, 3], [6, 9, 3], [8, 9, 3]],
    enemies: [
      { k: 'raider', x: 3, y: 1, wake: 99 },
      { k: 'raider', x: 5, y: 2, wake: 99 },
      { k: 'raider', x: 11, y: 1, wake: 99 },
      { k: 'raider', x: 13, y: 2, wake: 99 },
    ],
    waves: [
      { turn: 3, text: '第二波！', units: [{ k: 'raider', x: 2, y: 0 }, { k: 'raider', x: 12, y: 0 }, { k: 'raider', x: 6, y: 1 }, { k: 'archer', x: 8, y: 2 }], say: [['riko', 'また来た！ 川の向こう！']] },
      { turn: 5, text: '最後の波！', units: [{ k: 'raider', x: 4, y: 0 }, { k: 'raider', x: 10, y: 0 }, { k: 'raider', x: 7, y: 1 }, { k: 'raider', x: 13, y: 1 }, { k: 'goblin', x: 1, y: 2 }], say: [['gard', 'これで最後だ。ふんばれ！']] },
    ],
    raid: { cells: [[6, 12], [8, 12], [7, 11], [7, 13]], sacks: 3 },
    objective: { k: 'defend' },
    startFight: 1,
    goalText: (st, o) => { if (o.done) return '米倉を守りきった！'; const w = st.waves.filter(q => !q.done).length; return '米倉の米俵を守る（のこり ' + o.sacks + ' 俵）' + (w ? '　つぎの波まで ' + Math.max(0, (st.waves.filter(q => !q.done)[0].turn - st.turn)) + ' 手番' : '　最後の波'); },
    enterSay: [
      ['riko', '川の向こうから、盗っ人小鬼が来る…！'],
      ['narr', '盗っ人小鬼は、米倉へ一直線。じゃまする者だけをたたく'],
    ],
    fightSay: { 1: [['gard|tobi', { gard: '橋の手前と、飛び石の手前に大岩だ。橋に並んだら、転がすぞ', tobi: '橋の手前と、飛び石の手前に大岩っす。橋に並んだら、転がすっす！' }], ['riko', '赤い線の先が、小鬼の行き先だよ。並ぶのを待とう']] },
    winSay: { 1: [['riko', '守りきったー！'], ['narr', '村の人たちが、米倉のかげから出てきた']] },
    hints: [],
    combatHint: [['riko', '橋の手前の大岩を北へ転がすと、橋の上の列をなぎ倒すよ'], ['gard', '飛び石の手前の大岩は、北へ押せば飛び石の上で止まる。右はふさがるぞ'], ['riko', '右の丘へは、南から上がれる。上からの矢は強いよ'],
      ['gard', '橋の上の小鬼は、押せば川へ落ちる。わしが橋に立てば、ふさげるぞ'], ['tb', '橋の上で発破すれば、まとめて川へ吹っ飛ばせるっす'], ['sena', '橋の上で凍らせれば、うしろの小鬼も通れません']],
    capAt: { '11,5': '大岩が飛び石をふさいだ。盗っ人は橋へ回る' },
    rollSay: [['riko', 'やったー！ まとめて！']],
    bg: { top: '#2a3c5c', mid: '#3e5478', bot: '#16202e', ridge: '#1e2c44', sky: true, sunset: true },
    music: 'battle2',
  });

  // ======================================================================
  // 依頼6　岩喰い大亀（強敵討伐・第一章のしめくくり）
  // ======================================================================
  add({
    id: 'm6', name: '岩喰い大亀', area: '風見の谷の円舞台',
    W: 15, H: 15,
    hmap: [
      '999999999999999',
      '666666666666666',
      '666666666666666',
      '666666666666666',
      '444444454444444',
      '444444444444444',
      '444444444444444',
      '444444444444444',
      '322222222222223',
      '222222222222222',
      '222200000002222',
      '222200000002222',
      '222200000002222',
      '222222212222222',
      '222222222222222',
    ],
    tmap: [
      'xxxxxxxxxxxxxxx',
      'kkkkkkkkkkkkkkk',
      'kkgkkkkkkkkkgkk',
      'kkkkkkkkkkkkkkk',
      'gggggggfggggggg',
      'gggdggiiiggdggg',
      'ggggggiiigggggg',
      'gdggggggggggdgg',
      'fmmmmmmmmmmmmmf',
      'mmmmmmmmmmmmmmm',
      'mmmmsssssssmmmm',
      'mmmmsssssssmmmm',
      'mmmmsssssssmmmm',
      'mmmmmmmfmmmmmmm',
      'mmmmmmmmmmmmmmm',
    ],
    objs: [
      { k: 'boulder', x: 1, y: 6 },     // 中段の西の端（v0.2）。列 y=6 を東へ転がる
      { k: 'boulder', x: 13, y: 6 },    // 中段の東の端（v0.2）。列 y=6 を西へ転がる
      { k: 'pillar', x: 2, y: 9 },      // 下の段（v0.2）。大岩の列をふさがない。東へ倒すと (3,9)〜(5,9)
      { k: 'pillar', x: 12, y: 9 },     // 下の段（v0.2）。西へ倒すと (11,9)〜(9,9)
      { k: 'wagon', x: 13, y: 14 },
      { k: 'torch', x: 1, y: 1, fz: 2 },
      { k: 'torch', x: 13, y: 1, fz: 2 },
      { k: 'torch', x: 3, y: 9, fz: 2 },
      { k: 'torch', x: 11, y: 9, fz: 2 },
    ],
    start: [[7, 7, 3], [5, 7, 3], [9, 7, 3]],
    enemies: [
      { k: 'turtle', x: 7, y: 2, boss: true, wake: 99 },
      { k: 'goblin', x: 2, y: 5, wake: 99 },
      { k: 'goblin', x: 12, y: 5, wake: 99 },
    ],
    waves: [
      { turn: 4, text: '取りまきが来た！', units: [{ k: 'bat', x: 2, y: 2, z: 8 }, { k: 'bat', x: 12, y: 2, z: 8 }, { k: 'goblin', x: 7, y: 1 }] },
    ],
    objective: { k: 'boss' },
    startFight: 1,
    goalText: (st, o) => o.done ? '岩喰い大亀を倒した！' : '岩喰い大亀を倒す（体力 ' + o.hp + '）　ひっくり返すと、次の手番の終わりまでお腹が出る',
    enterSay: [
      ['narr', '谷のまんなかの円舞台に、岩のような甲羅が、のそりと動いた'],
      ['sena', '石板のとおり…。甲羅は矢も爆風もはじきます。でも、ひっくり返せば'],
    ],
    fightSay: { 1: [['riko', '赤い線…あいつ、ぼくのとなりへ来るつもりだ。ここに立ってれば、あの大岩の通り道だよ！']] },
    winSay: { 1: [['riko', 'やった…！ 大亀、倒したよ！'], ['gard', '…見事だ。三人とも']] },
    hints: [],
    combatHint: [['gard', '大亀は、ねらった相手のとなりで止まる。大岩の通り道に立ってさそえ'], ['riko', 'ひっくり返すと、次の手番の終わりまでお腹が出るよ。そこで全員で！'], ['sena', '凍らせれば、押すとすべって段から落ちます'], ['tb', 'ふちの手前で発破すれば、落ちるっす'], ['gard', '下の段の石柱は、鋼の籠手があれば倒せる']],
    flipSay: [['gard|tobi|sena', { gard: 'いまだ、たたみかけろ！', tobi: 'いまっす！ たたみかけるっす！', sena: 'いまです、たたみかけましょう！' }]],
    bg: { top: '#3a2a4a', mid: '#4a3858', bot: '#18121e', ridge: '#2a1e34', sky: true, sunset: true },
    music: 'boss',
  });

  // ======================================================================
  // 第二章「北の峠の風」（v0.3）。地図の座標は design/data/maps_draft.js のとおり
  // 依頼7　峠の茶屋の荷（荷の回収・第二章の入口）
  // ======================================================================
  add({
    id: 'm7', name: '峠の茶屋の荷', area: '北の峠・ふもとの茶屋道',
    W: 14, H: 13,
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
      { id: 'icA', k: 'icicle', x: 6, y: 10, say: [['riko', '落ちた！ 氷の飛び石だ。これなら渡れるね']] },   // 小川の上。落ちると氷の飛び石
      { id: 'icB', k: 'icicle', x: 2, y: 6 },                        // 崖の下。落ちると氷のかたまり（足場）
      { id: 'icC', k: 'icicle', x: 11, y: 7 },                       // 岩の上の射手の頭上
      { id: 'c1', k: 'crate', x: 9, y: 11 },
      { id: 'c2', k: 'crate', x: 4, y: 8 },
      { id: 'c3', k: 'crate', x: 9, y: 1 },                          // 石の柱（高さ6）の上
      { id: 'ck', k: 'crack', x: 8, y: 5, h: 2, label: 'ひび岩を砕いた。がれきが崖の切れこみの足場になる' },
      { id: 'an', k: 'anchor', x: 0, y: 3 },
      { id: 'chHook', k: 'chest', x: 0, y: 2, item: 'hook', up: 'hook', say: [['riko', 'これ、ツルさんの言ってた山仕事の鉤だ！'], ['narr', '引き鉤：一直線に並んだ軽い物や敵を、手もとへ引きよせる。レバーも引ける']] },
      { id: 'chCoin', k: 'chest', x: 6, y: 0, coins: 60 },
      { id: 'lv', k: 'lever', x: 11, y: 2, on: 'lower:br', label: 'レバーを引いた。はね橋が下りる', say: [['narr', 'はね橋が、きしみながら下りた']] },
      { id: 'br', k: 'bridge', cells: [[10, 3]], z: 4, down: false, hinge: [11, 3] },
      { id: 'chKettle', k: 'chest', x: 12, y: 1, item: 'kettle', say: [['riko', 'あった、茶釜！ …思ったより重い'], ['gard', '貸せ。こういうのは、わしの仕事だ']] },
      { k: 'wagon', x: 12, y: 12 },
      { k: 'deco', sub: 'snowtree', x: 0, y: 12, h: 3 }, { k: 'deco', sub: 'snowtree', x: 13, y: 9, h: 3 }, { k: 'deco', sub: 'rock', x: 1, y: 8, h: 1 },
    ],
    start: [[6, 12, 3], [7, 11, 3], [5, 12, 3]],
    enemies: [
      { k: 'snowgob', x: 4, y: 7, wake: 3 }, { k: 'snowgob', x: 8, y: 7, wake: 3 }, { k: 'snowgob', x: 2, y: 8, wake: 3 },
      { k: 'archer', x: 11, y: 7, wake: 5 },
      { k: 'snowgob', x: 12, y: 3, wake: 3, grp: 2 }, { k: 'snowgob', x: 13, y: 2, wake: 3, grp: 2 }, { k: 'archer', x: 13, y: 4, wake: 3, grp: 2 },
    ],
    objective: { k: 'item', item: 'kettle' },
    goalText: (st, o) => o.done ? '茶釜を取り返した！' : '雪小鬼の野営地から、茶釜を取り返す',
    enterSay: [
      ['riko', 'さむっ…！ ここが北の峠の入口かあ'],
      ['narr', '小川の上に、太いつららがぶら下がっている'],
      ['riko', 'あのつらら…射ったら、落ちるかな？'],
    ],
    trig: [
      { id: 'lever', r: [6, 1, 9, 4], up: 'hook', notDown: 'br', say: [['riko', '谷の向こうにレバー。…引き鉤なら、届くよね？']] },
    ],
    fightSay: {
      1: [['riko', '雪小鬼だ！ 雪の上なのに、足が速い…！'], ['gard', '土の見えている道を歩け。雪の中は、こっちが遅れる'], ['sena', 'あの射手の頭の上にも、つららがあります', { ifObj: 'icC' }]],
      2: [['riko', '野営地の小鬼が気づいた！ 橋を渡ってくる', { ifDown: 'br' }], ['riko', '野営地の小鬼に気づかれた！ …橋が上がってるから、向こうからは渡ってこられないね', { ifUp: 'br' }],
        ['gard', '橋の上は狭い。落とすには、いい場所だ', { ifDown: 'br' }], ['tobi', '橋の上で発破っすね！', { ifDown: 'br' }], ['sena', '橋の上で凍らせれば、うしろは通れません', { ifDown: 'br' }]],
    },
    winSay: { 1: [['riko', '崖は2段…。あ、崖の下にも、つらら', { ifObj: 'icB', ifNotReach: [2, 4] }]] },
    hints: [
      { done: [6, 9], need: 'shoot', mark: [6, 10], text: '小川の上のつらら、ぼくが射れば落ちるかも', also: [{ need: 'freeze', text: '小川は、凍らせれば渡れます', mark: [6, 10] }] },
      { done: [2, 4], need: 'shoot', o: 'icB', mark: [2, 6], text: '崖の下にも、つらら。落ちたら足場になりそうだよ', wrong: '崖の下の氷のかたまりにのれば、上の段へ上がれるよ（動かしてしまったら Z で戻せる）',
        also: [{ need: 'push', text: '木箱を崖の下へ押せば、足場になる', mark: [4, 6] }, { need: 'blast', text: '崖の切れこみのひび岩、砕けるっす', mark: 'ck' }] },
      { item: 'hook', need: 'rope', mark: 'an', text: '西の高い棚に鉄の輪。上に何かあるよ' },
      { done: [11, 3], need: 'pull', mark: [8, 2], text: '谷の向こうのレバーを、引き鉤で引こう。まっすぐ並ぶ所から' },
      { item: 'kettle', need: 'shoot', mark: 'chKettle', text: '橋を渡って、茶釜を取りに行こう' },
      { done: [6, 0], need: 'pull', o: 'c3', mark: 'c3', text: '（寄り道）柱の上の木箱、引き鉤で引いたら落ちてくるかな', wrong: '（寄り道）木箱を北の棚の下まで引けば、足場になるよ。うまくいかなければ Z で戻せる' },
    ],
    combatHint: [['riko', 'つららは、敵の上に落とせば効くよ'], ['gard', '雪の中は足が重い。土の道か、凍った所を歩け'], ['riko', '橋の上の敵は、落とせば谷だね']],
    bg: { top: '#3a4a6c', mid: '#5c6c8e', bot: '#1a2232', ridge: '#2c3a54', sky: true, snow: true },
    music: 'snow',
  });

  // ======================================================================
  // 依頼8　風守りの里（装置・ナギと出会う。ナギは同行のゲスト＝4人目）
  // ======================================================================
  const rikoWest = (st) => st.units.some(u => u.id === 'riko' && !u.ko && u.x <= 1 && u.y >= 5 && u.y <= 9);
  const ropeWest = (st) => st.links.some(L => L.k === 'rope' && [L.a, L.b].some(c => c[0] <= 1 && c[1] >= 5 && c[1] <= 9));
  add({
    id: 'm8', name: '風守りの里', area: '北の峠・風守りの里', guest: 'nagi',
    W: 15, H: 13,
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
      { id: 'an', k: 'anchor', x: 3, y: 5 },                         // 東の岸の鉄の輪（西の岸から縄をかけて戻る）
      { id: 'chCoin', k: 'chest', x: 0, y: 5, coins: 50 },
      { id: 'pl', k: 'plate', x: 10, y: 3, on: 'lower:br2', label: '木箱が、ふわりと岩の上の重さの床へ。はね橋が下りた' },   // 2段上の岩の上
      { id: 'br2', k: 'bridge', cells: [[12, 2]], z: 3, down: false, hinge: [13, 2] },
      { id: 'c1', k: 'crate', x: 10, y: 5 },
      { id: 'c2', k: 'crate', x: 8, y: 8 },
      { k: 'wagon', x: 13, y: 12 },
      { k: 'deco', sub: 'house', x: 3, y: 11, h: 3 }, { k: 'deco', sub: 'house', x: 11, y: 10, h: 3 }, { id: 'mill', k: 'deco', sub: 'windmill', x: 9, y: 7, h: 3 },
    ],
    start: [[7, 11, 3], [6, 11, 3], [8, 11, 3], [7, 12, 3]],
    enemies: [
      { k: 'wolf', x: 5, y: 2, wake: 3 }, { k: 'wolf', x: 6, y: 1, wake: 3 }, { k: 'wolf', x: 6, y: 3, wake: 3 },
      { k: 'snowgob', x: 9, y: 1, wake: 3, grp: 2 }, { k: 'snowgob', x: 11, y: 1, wake: 3, grp: 2 },
    ],
    objective: { k: 'runes', need: 3, flags: ['c1', 'c2', 'c3'], doneLabel: '里に風が戻った！',
      doneSay: [['narr', '三つめの石が鳴った。里の風車が、ごとん、と回りだす'], ['nagi', '回った…！ ……でも、峠の上の風は、まだ止まったままや']] },
    runeName: '風鳴り石',
    runeSay: { 1: [['narr', '風鳴り石が、ひゅうと鳴った。里の風車の羽根が、少しだけ動く（{n}／3）']], 2: [['narr', '風鳴り石が、ひゅうと鳴った。里の風車の羽根が、少しだけ動く（{n}／3）']] },
    goalText: (st, o) => o.done ? '三つの風鳴り石が鳴った！' : '風鳴り石を三つとも鳴らす（' + o.n + ' / 3）　ナギが同行している',
    enterSay: [
      ['nagi', 'うちがナギ。風鳴り石くらい、うち一人で鳴らせるんよ。…ついてくるんは勝手やけど'],
      ['riko', 'よろしくね、ナギ！ ぼくはリコ'],
      ['narr', '風車は止まったまま。石は三つ。西の岸、東の台、北西の丘'],
    ],
    trig: [
      { id: 'westv', r: [3, 5, 5, 9], flagNot: 'c1', say: [['nagi', '石はあの岸や。…うちのうちわ、人も物も2升先へ運べる。けど、うち自身は運べへん'], ['riko', 'じゃあ、ぼくを運んでよ。向こうで何か考える！']] },
      { id: 'west', r: [0, 5, 1, 9], who: 'riko', say: [['riko', 'わっ、飛んだ…！ ふわっとして、こわくないね'], ['riko', 'こっちに輪はない…。あ、そっちの岸に鉄の輪！ 縄をかけて戻れば、道になるよ']] },
      { id: 'rope', link: [0, 5, 1, 9], say: [['nagi', '……借りは返すわ']] },
      { id: 'rock', r: [9, 4, 11, 7], flagNot: 'c2', say: [['nagi', '岩の上に重さの床。あそこに何かのせたら、橋が下りるんや'], ['gard', '2段上か。押しても上がらんぞ'], ['nagi', '上げるんは、うちの仕事や']] },
    ],
    fightSay: {
      1: [['nagi', '雪狼や！ あいつら、段なんか気にせんと、のぼってくる'], ['riko', '赤い線が、段をこえてる…！'], ['nagi', '上がってきたら、うちが谷へ飛ばしたる']],
      2: [['riko', '雪小鬼！ 橋のたもとに二匹']],
    },
    waftSay: [['nagi', 'どうや！'], ['tobi', 'ひええ、やっぱり飛ばされたくないっす']],
    hints: [
      { flag: 'c1', need: 'waft', show: (st) => !rikoWest(st) && !ropeWest(st), mark: [3, 7], text: '西の岸へは歩いて行けへん。だれかを運んだら、何かできるかもしれん' },
      { flag: 'c1', need: 'rope', show: (st) => rikoWest(st) && !ropeWest(st), mark: 'an', text: '東の岸の鉄の輪に、こっちから鉤縄をかけるよ' },
      { flag: 'c1', need: 'waft', show: (st) => ropeWest(st), mark: 'chA', text: '縄を渡って、石のとなりへ行く' },
      { flag: 'c2', need: 'waft', show: (st) => !(st.objs.find(o => o.id === 'br2') || {}).down, o: 'c1', mark: 'c1', text: '木箱を、岩の上の重さの床へ。うちが南から、あおぐ', wrong: '木箱を、岩の2升手前へ戻して（Z で戻せる）' },
      { flag: 'c2', need: 'waft', mark: 'chB', text: 'はね橋を渡って、石のとなりから、あおぐんよ' },
      { flag: 'c3', need: 'waft', show: (st) => !st.flags.won1, mark: [7, 4], text: '丘へは、東の坂から上がるんよ' },
      { flag: 'c3', need: 'waft', mark: 'chC', text: '丘へは、東の坂から上がるんよ' },
    ],
    combatHint: [['nagi', '狼は軽い。2升先が谷なら、うちが落とせる'], ['gard', '狼は段をのぼってくる。背中を谷に向けて立つな'], ['sena', '凍らせてから落とすと、砕けやすくなります'], ['riko', '群れると、かみつく力が上がるみたい。ばらけさせよう']],
    bg: { top: '#3a4a6c', mid: '#6a7898', bot: '#1c2434', ridge: '#2e3c56', sky: true, snow: true },
    music: 'village',
  });

  // ======================================================================
  // ギルドの広間（拠点）
  // ======================================================================
  const HUB = {
    id: 'hub', name: '風見鶏ギルド', W: 12, H: 10,
    hmap: [
      '666666666666',
      '611111111111',
      '611111111111',
      '611111111111',
      '611111111111',
      '611111111111',
      '611111111111',
      '611111111111',
      '611111111111',
      '611111111111',
    ],
    tmap: [
      'xxxxxxxxxxxx',
      'xppppppppppp',
      'xppppppppppp',
      'xppppppppppp',
      'xppppppppppp',
      'xppppppppppp',
      'xppppppppppp',
      'xppppppppppp',
      'xppppppppppp',
      'xppppppppppp',
    ],
    objs: [
      { id: 'board', k: 'deco', sub: 'board', x: 3, y: 1, h: 3 },
      { id: 'shelf', k: 'deco', sub: 'shelf', x: 6, y: 1, h: 3 },
      { id: 'counter1', k: 'deco', sub: 'counter', x: 9, y: 2, h: 1 },
      { id: 'counter2', k: 'deco', sub: 'counter', x: 10, y: 2, h: 1 },
      { id: 'hearth', k: 'deco', sub: 'hearth', x: 1, y: 4, h: 3 },
      { id: 'desk', k: 'deco', sub: 'desk', x: 2, y: 8, h: 1 },
      { id: 'table1', k: 'deco', sub: 'table', x: 5, y: 5, h: 1 },
      { id: 'table2', k: 'deco', sub: 'table', x: 8, y: 7, h: 1 },
      { id: 'anvil', k: 'deco', sub: 'anvil', x: 10, y: 6, h: 1 },
      { id: 'banner', k: 'deco', sub: 'banner', x: 9, y: 1, h: 3 },
      { id: 'barrel', k: 'deco', sub: 'barrel', x: 11, y: 5, h: 1 },
    ],
    start: [[6, 8, 3]],
    bg: { top: '#1a1424', mid: '#221a2c', bot: '#0e0a14', ridge: '#140e1c', indoor: true },
  };

  // ギルドにいる人（出てくる条件つき）。pos は広間の升
  const PEOPLE = [
    { id: 'mimoza', k: 'mimoza', name: 'ミモザ', role: '受付', x: 9, y: 1, face: 1, when: () => true },
    { id: 'dora', k: 'dora', name: 'ドーラ', role: 'ギルドマスター', x: 1, y: 8, face: 0, when: () => true },
    { id: 'tonbo', k: 'tonbo', name: 'トンボ', role: '鍛冶屋', x: 11, y: 6, face: 2, when: () => true },
    { id: 'p_gard', k: 'gard', name: 'ガルド', x: 4, y: 5, face: 0, when: () => true, hero: 'gard' },
    { id: 'p_sena', k: 'sena', name: 'セナ', x: 2, y: 3, face: 0, when: () => true, hero: 'sena' },
    { id: 'p_tobi', k: 'tobi', name: 'トビ', x: 7, y: 7, face: 0, when: (p) => p.roster.includes('tobi'), hero: 'tobi' },
    { id: 'hans', k: 'hans', name: 'ハンス', role: '畑の人', x: 6, y: 5, face: 2, when: (p) => !!p.done.m1 },
    { id: 'kid', k: 'kid', name: 'ペック', role: '町の子', x: 4, y: 2, face: 3, when: (p) => !!p.done.m2 },
    { id: 'bolo', k: 'miner', name: 'ボロ', role: '鉱夫', x: 8, y: 8, face: 3, when: (p) => !!p.done.m3 },
    { id: 'dan', k: 'miner', name: 'ダン', role: '鉱夫', x: 9, y: 7, face: 2, when: (p) => !!p.done.m3 },
    { id: 'elder', k: 'elder', name: 'ヨシノ', role: '川辺の村の長', x: 7, y: 4, face: 1, when: (p) => !!p.done.m5 },
    // 第二章（v0.3）
    { id: 'turu', k: 'turu', name: 'ツル', role: '峠の茶屋のおかみ', x: 2, y: 5, face: 3, when: (p) => !!p.done.m7 },
    { id: 'p_nagi', k: 'nagi', name: 'ナギ', x: 10, y: 4, face: 2, when: (p) => p.roster.includes('nagi'), hero: 'nagi' },
    { id: 'hiba', k: 'hiba', name: 'ヒバ', role: '風守りの里の長', x: 3, y: 7, face: 2, when: (p) => !!p.done.m8 },
  ];

  // 会話（新しい順に条件を見る。first は一度だけの話）
  const TALK = {
    mimoza: [
      { when: (p) => p.done.m7, text: ['ツルさんのお茶、飲んだ？ 峠を越えてきた人みんなが、ほっとする味なんだって'] },
      { when: (p) => p.chapterDone && !p.done.m7, text: ['北の峠のふもとの茶屋から、依頼が届いてるわ。雪の土地よ。あったかくしていってね'] },
      { when: (p) => p.chapterDone, text: ['ふふ、第一章おしまい…なんてね。リコくんの依頼帳は、まだまだ白紙のページがいっぱいよ'] },
      { when: (p) => p.done.m4 && p.done.m5 && !p.done.m6, text: ['大亀の件、ギルドじゅうの注目の的よ。気をつけてね'] },
      { when: (p) => p.roster.includes('tobi'), text: ['トビくんの登録、すませておいたわ。依頼板に新しいのが三つも！ だれと行くか、迷っちゃうわね'] },
      { when: (p) => p.done.m2, text: ['ほかの三人組は、みんな遠くの依頼に出てるの。北の峠へ行った「灰色の狼」組からは、まだ便りがないわ', '町の近くの依頼は、しばらくリコくんたちが頼りよ'] },
      { when: (p) => p.done.m1, text: ['依頼板、見た？ 依頼をこなすと、新しいのが届くのよ'] },
      { when: () => true, text: ['ようこそ、風見鶏ギルドへ！ …って、リコくんはもう知ってるか。依頼は、うしろの依頼板からね'] },
    ],
    dora: [
      { when: (p) => p.done.m7, text: ['峠の茶屋のツルとは、古いなじみでね。あの人の茶で、何度も生きかえったもんさ', '灰色の狼も、あの茶屋を通ったはずだ。…峠の調べ、たのんだよ'] },
      // 第一章の結末のあと（v0.3 で第二章へつなぐ。v0.2 の「続きは、また明日だ」の翌日）
      { when: (p) => p.chapterDone, text: ['北の峠のむこうから、手紙が届いた。「風が止んだ谷が、ほかにもある」とな', '灰色の狼の頭はロウといってね。ガルドとあたしの、昔の仲間さ', '峠のふもとの茶屋から、依頼が来ているよ。峠の調べと、灰色の狼の行方。あんたたちに任せたよ'] },
      { when: (p) => p.rank >= 3, text: ['腕ききか。ガルド、あんたと組んでた頃を思いだすよ', '大亀の噂、聞いてるね。準備ができたら行っといで'] },
      { when: (p) => p.roster.includes('tobi'), text: ['トビは鉱山町の発破師だ。荒っぽく見えて、仕事は丁寧さ', '三人で行くのは変わらない。だれを連れていくかは、あんたが決めな'] },
      { when: (p) => p.rank >= 2, text: ['一人前の札、似合ってるじゃないか。依頼の格も上がるよ'] },
      { when: () => true, text: ['リコ、今日から正式な冒険者だね。三人一組がうちの決まりさ', 'ガルドとセナは、ちょうど手が空いてる。仲よくやりな'] },
    ],
    tonbo: [
      { when: () => true, text: ['よう、リコ。依頼でかせいだ銀貨で、仲間の道具を鍛えてやるぜ'] },
    ],
    gard: [
      { when: (p) => p.chapterDone, text: ['いい依頼ばかりだった', '…ロウのやつ、便りもよこさんで。北の峠か'] },
      { when: (p) => p.roster.includes('nagi'), text: ['わしは飛ばせんのか。…そうか、重いか'] },
      { when: (p) => p.done.m6, text: ['大亀か。わしが若いころは、あんなのに出くわさなかったぞ'] },
      { when: (p) => p.up.gauntlet, text: ['この籠手なら、岩人形だろうが押しかえせる。トンボのやつ、いい仕事をする'] },
      { when: (p) => p.roster.includes('tobi'), text: ['トビの発破か。わしの「押す」と似ているようで、ちがう。一度に何もかも吹っ飛ばす'] },
      { when: (p) => p.done.m1, text: ['ドーラとは昔、組んでいた。あいつに「腰に気をつけな」と言われる歳になったわい'] },
      { when: () => true, text: ['わしはガルド。重いものを動かすのが仕事だ。よろしくな、リコ'] },
    ],
    sena: [
      { when: (p) => p.chapterDone, text: ['石板には、まだ読めない文字がたくさん。…続きを、いっしょに読みに行きませんか'] },
      { when: (p) => p.done.m4, text: ['風見の石板…。この町の風見鶏も、昔の人の装置だったのかもしれません'] },
      { when: (p) => p.up.staff, text: ['氷晶の杖なら、乾いた床にも氷をつくれます。足場にも、壁にもなります'] },
      { when: (p) => p.roster.includes('tobi'), text: ['トビさんの爆風、計算してみたんです。上下左右に一マスずつ。…きれいな形です'] },
      { when: () => true, text: ['セナです。学院で、古い遺跡のことを調べています。…冒険は、まだ二回目です'] },
    ],
    tobi: [
      { when: (p) => p.chapterDone, text: ['ギルドって、毎日がお祭りっすね！ 次の依頼も、呼んでくださいっす'] },
      { when: (p) => p.roster.includes('nagi'), text: ['ナギさんのうちわで飛ぶって、こわくないんすか…？ おいらは遠慮したいっす'] },
      { when: (p) => p.up.bigbomb, text: ['大玉の発破、二マスまで吹っ飛ぶっす。…自分で言うのもなんすけど、すごいっす'] },
      { when: () => true, text: ['トビっす！ 石切り場で助けてもらった恩、発破で返すっす', '…高いところは、ちょっとだけ苦手っす'] },
    ],
    turu: [
      { when: (p) => p.done.m8, text: ['ほら、あったかいの飲んでいきな', 'ナギちゃん、ギルドに入ったんだって？ あの子の風、きっと峠にも届くさ'] },
      { when: () => true, text: ['ほら、あったかいの飲んでいきな', '峠の上は、まだ風が止まったままだってさ。里の子が、ひとりでがんばってるらしいよ'] },
    ],
    nagi: [
      { when: (p) => p.up.fan, text: ['大うちわ、ええ風が出るわ。3升先までいけるんよ', '…トンボのおっちゃんに、礼言うといてな'] },
      { when: () => true, text: ['うちのうちわは、軽い物も、敵も、仲間も、2升先へ運べる。2段上へも、谷の向こうへも', 'でも、重いもんと、うち自身は運べへん。…せやから、借りができてしまうんや'] },
    ],
    hiba: [{ when: () => true, text: ['風は、呼ぶものじゃ。待つものではない', 'ナギを、よろしくお頼み申します'] }],
    hans: [{ when: () => true, text: ['畑はすっかり元どおりさ。お礼に、いちばんでっかいかぼちゃを持ってきたよ。棚に飾ってくれ'] }],
    kid: [
      { when: (p) => p.roster.includes('tobi'), text: ['トビ兄ちゃんの発破、見たい！ ドーンってやつ！'] },
      { when: () => true, text: ['ぼくペック！ 大きくなったら、リコ兄ちゃんみたいな冒険者になるんだ'] },
    ],
    bolo: [{ when: () => true, text: ['あんたらがいなけりゃ、今ごろ岩の中だ。石切り場の連中みんなで、乾杯しに来たぜ'] }],
    dan: [{ when: () => true, text: ['トビのやつ、ギルドに入ったんだってな。あいつの発破は、町いちばんだ'] }],
    elder: [{ when: () => true, text: ['米倉を守ってくれて、ありがとう。村から、感謝の旗を持ってきました'] }],
  };

  // ---------- 依頼板 ----------
  // need: どの力があると進めやすいか（画面に出す事前情報）。say: 仲間のひとこと（だれと行くかの手がかり）
  const REQUESTS = [
    {
      id: 'm1', map: 'm1', title: '畑あらしの小鬼', kind: '退治', client: '畑のハンス', area: 'カザミの丘畑', stars: 1,
      text: 'うちの段々畑に、小鬼が三匹居ついちまった。かぼちゃをかじるわ、柵をこわすわ…。追いはらってくれ！',
      goal: '段々畑の上の小鬼を3体たおす', reward: { coins: 80, merit: 1 }, trophy: 'pumpkin',
      features: ['高い段差', '谷', '池'], need: '押す・鉤縄・凍らせる、みんな出番あり',
      unlock: () => true, fixed: true,
      say: { gard: 'はじめての依頼か。肩の力をぬいていけ', sena: 'よろしくお願いします、リコさん', tobi: '木箱なら、発破でも動かせるっす！', nagi: '段の上へなら、うちがだれかを運べるんよ' },
    },
    {
      id: 'm2', map: 'm2', title: '見張り塔の角笛', kind: '宝物回収', client: '町の顔役', area: 'カザミ東の見張り塔', stars: 1,
      text: '東の古い見張り塔に、町の角笛が置き去りのままだ。骨の射手がうろついている。角笛を持ち帰ってほしい。',
      goal: '塔のてっぺんの角笛を手に入れる', reward: { coins: 120, merit: 1, item: 'rope2' }, trophy: 'flag',
      features: ['堀', '高い塔', '骨の射手'], need: '堀を渡る・塔をのぼる',
      unlock: (p) => !!p.done.m1, fixed: true,
      // v0.2：受けなおしは自由編成。ガルドとトビでは堀を渡る手がない（設計の見直し待ち。VERIFICATION_v0.2.md）
      // v0.3：ナギ入りの組も調べた（tools/replay_pairs.js）。ガルドとナギは渡れない。トビとナギは大うちわ（3升）があれば渡れる
      replayWarn: { 'gard+tobi': 'この二人では、堀を渡る手がない（凍らせられる仲間がいれば渡れる）', 'gard+nagi': 'この二人では、堀を渡る手がない（凍らせられる仲間がいれば渡れる）',
        'nagi+tobi': (p) => p.up.fan ? null : 'ナギのうちわでは、堀の向こうへ届かない（大うちわがあれば、トビとリコを向こうへ運べる）' },
      say: { gard: '塔か。高い所の射手は手ごわいぞ', sena: '堀は、わたしが凍らせます', tobi: '塔の上の木箱なら、発破で落とせるっす', nagi: '堀は幅が2升…。向こうへ運ぶには、大きいうちわがほしいなあ' },
    },
    {
      id: 'm3', map: 'm3', title: '石切り場の落盤', kind: '救助・急ぎ', client: '石切り場の親方', area: 'カザミ北の石切り場', stars: 2,
      text: '【急ぎ】石切り場で落盤だ！ 鉱夫が二人と、発破師の若いのがひとり取り残された。だれか、たのむ！',
      goal: '取り残された3人を、荷馬車まで送りとどける', reward: { coins: 150, merit: 2 }, trophy: 'stone',
      features: ['ひび割れた岩', '岩棚', '凍る滝'], need: '見つけるだけでなく、帰り道をつくる',
      unlock: (p) => !!p.done.m2, fixed: true, noPick: ['tobi'],   // 受けなおしでも、トビは岩棚にいる側なので選べない
      // v0.3：ガルドとナギは滝を凍らせられない。大うちわ（3升）があれば、木箱を岩棚の下まで運んで、トビの帰り道にできる（VERIFICATION_v0.3.md）
      replayWarn: { 'gard+nagi': (p) => p.up.fan ? null : 'この二人では、岩棚のトビが下りる道をつくれない（滝を凍らせられる仲間か、ナギの大うちわがあれば帰れる）' },
      say: { gard: '急ぐぞ。けが人は、縄では運べん。歩ける道をつくってやらねば', sena: '帰り道…。氷の段なら、歩いて下りられます', nagi: '台の上へなら、うちが運べる。…けど、けが人は運べへんよ' },
    },
    {
      id: 'm4', map: 'm4', title: '風見の遺跡', kind: '遺跡調査', client: '学院（セナの師）', area: '北の丘の古い遺跡', stars: 2,
      text: '北の丘の遺跡で、門の奥に「風見の石板」があるらしい。門は四つの装置でひらくと伝わる。調べてきてほしい。',
      goal: '四つの装置のうち三つを動かし、奥の石板を手に入れる', reward: { coins: 150, merit: 2 }, trophy: 'tablet',
      features: ['的', '霜の水晶', '重さの床', '封印石', '岩人形'], need: '装置ごとに、合う力がちがう（三つでよい）',
      unlock: (p) => !!p.done.m3,
      // v0.3：ガルドとナギは装置が二つまで。セナとナギは、氷晶の杖の氷のかたまりをナギが重さの床へ運べば三つ（VERIFICATION_v0.3.md）
      replayWarn: { 'gard+nagi': 'この二人では、門の装置を三つ動かせない（凍らせる仲間か、発破の仲間がいれば動かせる）',
        'nagi+sena': (p) => p.up.staff ? null : '氷晶の杖がないと、門の装置を三つ動かせない（杖でつくった氷のかたまりなら、ナギが重さの床へ運べる）' },
      say: { gard: '重さの床なら、石を押して乗せてやれる', sena: '霜の水晶…。わたしなら、凍らせて灯をともせます', tobi: '封印石なら砕けるっす。石のブロックも吹っ飛ばせるっす', nagi: '石のブロックは重すぎて、うちには運べへん。軽い物があればええんやけど' },
    },
    {
      id: 'm5', map: 'm5', title: '川辺の村の米倉', kind: '防衛', client: '川辺の村の長ヨシノ', area: 'カザミ川の村', stars: 2,
      text: '盗っ人小鬼の群れが、毎晩のように米倉をねらってきます。今夜が山。どうか米俵を守ってください。',
      goal: '三つの波をしのぎ、米俵を守る（ひと俵でも残れば成功）', reward: { coins: 150, merit: 2, perSack: 20 }, trophy: 'banner',
      features: ['橋', '飛び石', '流れの速い川', '渡り口の大岩'], need: '渡り口で止める・並んだ所へ大岩を転がす',
      unlock: (p) => !!p.done.m3,
      say: { gard: '橋の手前に大岩がある。並んだ所へ転がせば、まとめてだ', sena: '橋の出口で凍らせれば、通せんぼになります。うしろの小鬼は、橋を通れません', tobi: '大岩のうしろで発破すれば、橋をぬけて転がるっす！', nagi: '橋の上の小鬼なら、うちが川へ飛ばしたる' },   // v0.3：「うしろが橋の上に並びます」は、ほかの渡り口へ回る・その場で待つため、言いまわしを直した（設計の意図は同じ）
    },
    {
      id: 'm6', map: 'm6', title: '岩喰い大亀', kind: '強敵討伐・急ぎ', client: 'ギルドマスター・ドーラ', area: '風見の谷の円舞台', stars: 3,
      text: '【急ぎ】風見の谷に、岩を喰う大亀があらわれた。谷の風が止まり、町の風見鶏も回らない。腕ききの三人で、止めてきな。',
      goal: '岩喰い大亀を倒す', reward: { coins: 200, merit: 3 }, trophy: 'shell', final: true,
      features: ['三段の円舞台', '中段の左右の大岩', '甲羅（ひっくり返すと効く）'], need: '大亀は、ねらった仲間のとなりで止まる。大岩の列へさそう・段から落とす',
      unlock: (p) => !!p.done.m4 && !!p.done.m5,
      say: { gard: '中段の端に大岩がある。あれの通り道で大亀を止めてくれ。わしが転がす', sena: '凍らせれば、押したときにすべります。ひっくり返っている間は、霜もお腹に通ります', tobi: '大岩のうしろで発破すれば、端から端まで転がるっす。大亀も、ふちなら爆風で落ちるっす', nagi: '大亀は重すぎて、うちのうちわでは動かへん。まわりの小鬼なら、まかしとき' },
    },
    // ---------- 第二章「北の峠の風」（v0.3） ----------
    {
      id: 'm7', map: 'm7', title: '峠の茶屋の荷', kind: '荷の回収', client: '峠の茶屋のツル', area: '北の峠・ふもとの茶屋道', stars: 2, chapter: 2,
      text: '峠のふもとで茶屋をやってるツルだよ。雪小鬼に、冬ごしの荷と、うちの茶釜を持っていかれた。荷はいい。茶釜だけは取り返しておくれ。あれがないと、峠を越える人にお茶が出せないんだよ',
      goal: '雪小鬼の野営地から、茶釜を取り返す', reward: { coins: 140, merit: 2 }, trophy: 'teacup',
      features: ['深い雪', 'つらら', '小川', 'はね橋'], need: '雪の中は足が重い（土の道を歩く）。つららは、射れば落ちる',
      unlock: (p) => !!p.chapterDone,
      say: { gard: '雪か。わしの足は、ますます遅くなるな。道を選んで歩くぞ', sena: '小川は、わたしが凍らせます。…つららも、気になりますね', tobi: '崖のひび岩は、おいらに任せるっす。雪も爆風で飛ぶっすよ', nagi: '雪の峠は、うちの庭みたいなもんや。…茶屋のツルさん、元気にしとるかな' },
    },
    {
      id: 'm8', map: 'm8', title: '風守りの里', kind: '装置', client: '風守りの里の長ヒバ', area: '北の峠・風守りの里', stars: 2, chapter: 2,
      text: '風守りの里の長、ヒバと申します。峠の風が止んで、里の風車が回りませぬ。風鳴り石を三つ鳴らせば、里には風を呼べるはず。孫のナギが行くと言ってきかぬのですが、近ごろは雪狼も出ます。どうか、あの子と一緒に',
      goal: '里のまわりの風鳴り石を、三つとも鳴らす（ナギが同行する）', reward: { coins: 160, merit: 2 }, trophy: 'windmill',
      features: ['風鳴り石', '谷の向こうの岸', 'はね橋', '雪狼（段をのぼる）'], need: 'ナギの「あおぐ」は、軽い物や仲間を2升先へ運ぶ。ナギ自身は運べない',
      unlock: (p) => !!p.done.m7,
      guest: 'nagi', noPick: ['nagi'],   // 里の子ナギが、同行のゲスト（4人目）。受けなおしでも同行（選ぶ側には出ない）
      say: { gard: '段をのぼる狼か。高い所にいても、気をぬくなよ', sena: '風鳴り石…。風見の遺跡の装置と、同じ作りでしょうか', tobi: 'う、うちわで人を飛ばすって…おいらは遠慮したいっす' },
    },
  ];
  // 第二章のつづき（v0.3 の時点では準備中。m8 のあとに、予告の札を出す）
  const TEASER2 = { id: 'ch2b', title: '峠の三つの依頼', kind: '第二章のつづき', client: '？？？', text: '湖・関所・風穴――峠のあちこちから、助けを求める便りが届きはじめた。灰色の狼の行方も、まだ分からない。（この依頼は、まだ準備中）' };

  // 第二章の予告（まだ受けられない）
  const TEASER = { id: 'ch2', title: '北の峠の風', kind: '第二章', client: '？？？', text: '「風が止んだ谷が、ほかにもある」――北の峠から届いた手紙。北の峠へ向かった「灰色の狼」も、まだ戻らない。（この依頼は、まだ準備中）' };

  // ---------- 腕だめしの印（依頼ごとに三つ：①発見 ②腕前 ③別の二人。一つにつき一度きり） ----------
  // test(st, info)：依頼を達成してギルドへ帰ったときの地図の状態で判定する。info = { first, pair, firstPair }
  // live: 'now' は条件を満たしたその場で地図に知らせる／'end' は依頼を達成したときに知らせる
  const koCount = (st, kinds, hows) => (st.stats.foeKo || []).filter(e => (!kinds || kinds.includes(e.k)) && hows.includes(e.how)).length;
  const pairStamp = (id) => ({ id, kind: 'pair', name: '別の二人', text: '初回と違う二人で達成する', live: 'end', test: (st, i) => !i.first && !!i.firstPair && i.pair !== i.firstPair });
  const STAMPS = {
    m1: [
      { id: 'm1a', kind: 'find', name: '崖から押し落とす', text: '小鬼を崖から押し落として倒す', live: 'now', test: (st) => koCount(st, ['goblin'], ['fall', 'void']) >= 1 },
      { id: 'm1b', kind: 'skill', name: '3手番で片づける', text: '戦いを3手番以内に終える', live: 'now', test: (st) => !!st.stats.fightLen && st.stats.fightLen[1] !== undefined && st.stats.fightLen[1] <= 3 },
      pairStamp('m1c'),
    ],
    m2: [
      { id: 'm2a', kind: 'find', name: '堀に沈める', text: '敵を堀の水に沈める', live: 'now', test: (st) => koCount(st, null, ['drown']) >= 1 },
      { id: 'm2b', kind: 'skill', name: 'だれも倒れない', text: 'だれも倒れずに達成', live: 'end', test: (st) => !(st.stats.downs > 0) },
      pairStamp('m2c'),
    ],
    m3: [
      { id: 'm3a', kind: 'find', name: '岩人形を池へ', text: '岩人形を池に沈める', live: 'now', test: (st) => koCount(st, ['golem'], ['drown']) >= 1 },
      { id: 'm3b', kind: 'skill', name: 'ヒントなしで救出', text: 'ヒントを使わずに三人を助ける', live: 'end', test: (st) => !(st.stats.hints > 0) },
      pairStamp('m3c'),
    ],
    m4: [
      { id: 'm4a', kind: 'find', name: '灯を四つとも', text: '門の灯を四つともともす', live: 'now', test: (st) => ['r1', 'r2', 'r3', 'r4'].every(f => st.flags[f]) },
      { id: 'm4b', kind: 'skill', name: '岩人形を二体とも落とす', text: '岩人形を二体とも、谷か池へ落とす', live: 'now', test: (st) => koCount(st, ['golem'], ['void', 'drown']) >= 2 },
      pairStamp('m4c'),
    ],
    m5: [
      { id: 'm5a', kind: 'find', name: '大岩で3体', text: '大岩ひとつで3体以上をなぎ倒す', live: 'now', test: (st) => (st.stats.bestRoll || 0) >= 3 },
      { id: 'm5b', kind: 'skill', name: '米俵を三つとも', text: '米俵を三つとも守る', live: 'end', test: (st) => !!st.raid && st.raid.sacks >= 3 },
      pairStamp('m5c'),
    ],
    m6: [
      { id: 'm6a', kind: 'find', name: '大岩で大亀を返す', text: '大岩を当てて、大亀をひっくり返す', live: 'now', test: (st) => (st.stats.boulderFlip || 0) >= 1 },
      { id: 'm6b', kind: 'skill', name: '8手番で討伐', text: '8手番以内に倒す', live: 'now', test: (st) => st.stats.bossTurn > 0 && st.stats.bossTurn <= 8 },
      pairStamp('m6c'),
    ],
    // 第二章（v0.3）
    m7: [
      { id: 'm7a', kind: 'find', name: 'つららで倒す', text: 'つららを落として敵を倒す', live: 'now', test: (st) => (st.stats.icicleKo || 0) >= 1 },
      { id: 'm7b', kind: 'skill', name: 'だれも倒れない', text: 'だれも倒れずに達成', live: 'end', test: (st) => !(st.stats.downs > 0) },
      pairStamp('m7c'),
    ],
    m8: [
      { id: 'm8a', kind: 'find', name: '雪狼を谷へ', text: '雪狼を、あおいで谷へ落とす', live: 'now', test: (st) => (st.stats.waftKo || []).some(e => e.k === 'wolf' && e.how === 'void') },
      { id: 'm8b', kind: 'skill', name: '4手番で雪狼を', text: '雪狼との戦いを4手番以内に終える', live: 'now', test: (st) => !!st.stats.fightLen && st.stats.fightLen[1] !== undefined && st.stats.fightLen[1] <= 4 },
      pairStamp('m8c'),
    ],
  };
  const STAMP_KIND = { find: '発見', skill: '腕前', pair: '別の二人' };

  // ---------- ドーラの腕だめし帳（印の数のごほうび。届いた段は、ドーラに話して受けとる） ----------
  const LEDGER = [
    { n: 3, charm: 'c_tag' },
    { n: 6, coins: 100 },
    { n: 9, charm: 'c_tabi' },
    { n: 12, coins: 100 },
    { n: 16, trophy: 'oldbook', coins: 150 },
    { n: 20, coins: 150 },
    { n: 24, title: '腕だめしの達人', trophy: 'vane_s' },
    { n: 30, trophy: 'vane_g' },
    { n: 42, title: '風見鶏の誇り' },
  ];

  // ---------- お守り（一人に一つ。同じ物は二つとない。効果は sim.js の CHARM_FX） ----------
  const CHARMS = {
    c_plate: { name: 'かたい胸当て', text: '持たせた人の体力 +2', from: 'トンボの鍛冶場（石切り場の依頼のあと）' },
    c_tag: { name: '身がわりの木札', text: '倒れる傷を、依頼ごとに一度だけ体力1でこらえる', from: 'ドーラの腕だめし帳（印3つ）' },
    c_tabi: { name: '韋駄天の足袋', text: '移動 +1', from: 'ドーラの腕だめし帳（印9つ）' },
    c_hawk: { name: '鷹の目の羽かざり', text: '射る・凍らせる・発破の届く距離 +1', from: 'トンボの鍛冶場（風守りの里のあと）' },
  };

  // ---------- 鍛冶屋の品 ----------
  const SHOP = [
    { id: 'bow', who: 'riko', name: '狩人の長弓', cost: 120, text: '矢の傷 +1、届く距離 +1', when: (p) => !!p.done.m1 },
    { id: 'staff', who: 'sena', name: '氷晶の杖', cost: 160, text: '届く距離 +1。乾いた床に氷のかたまりをつくれる（足場・壁・すべる石になる）', when: (p) => !!p.done.m2 },
    { id: 'gauntlet', who: 'gard', name: '鋼の籠手', cost: 180, text: '重い相手（岩人形・大亀）を、平らな所でも押せる。石柱を倒して橋にできる', when: (p) => !!p.done.m2 },
    { id: 'bigbomb', who: 'tobi', name: '大玉の発破', cost: 160, text: '爆心の傷 +1。爆風で2マス吹き飛ばす', when: (p) => p.roster.includes('tobi') },
    // お守り（「だれと行く？」で一人に一つ持たせる）
    { id: 'c_plate', kind: 'charm', name: 'かたい胸当て', cost: 150, text: '持たせた人の体力 +2', when: (p) => !!p.done.m3 },
    // 第二章（v0.3）
    { id: 'fan', who: 'nagi', name: '大うちわ', cost: 220, text: 'あおぐ距離 2→3。幅2の谷を越えられる。3升先の水へ木箱を置ける', when: (p) => !!p.done.m8 },
    { id: 'c_hawk', kind: 'charm', name: '鷹の目の羽かざり', cost: 200, text: '射る・凍らせる・発破の届く距離 +1', when: (p) => !!p.done.m8 },
  ];

  // ギルドに飾るもの
  const TROPHY = {
    pumpkin: { name: '大かぼちゃ', from: 'ハンスの畑' },
    flag: { name: '見張り塔の古い旗', from: '見張り塔' },
    stone: { name: '石切り場の記念石', from: '石切り場' },
    tablet: { name: '風見の石板（写し）', from: '風見の遺跡' },
    banner: { name: '川辺の村の感謝の旗', from: '川辺の村' },
    shell: { name: '大亀の甲羅のかけら', from: '風見の谷' },
    oldbook: { name: 'ドーラの古い依頼帳', from: '腕だめし帳（印16）' },
    vane_s: { name: '風見鶏の小さな像', from: '腕だめし帳（印24）' },
    vane_g: { name: '金の風見鶏', from: '腕だめし帳（印30）' },
    teacup: { name: '茶屋の湯のみ', from: '峠の茶屋' },
    windmill: { name: '里の小さな風車', from: '風守りの里' },
  };
  const ITEM = { rope2: '長い鉤縄', horn: '見張りの角笛', tablet: '風見の石板', hook: '引き鉤', kettle: '茶釜' };

  const RANKS = [
    { star: 1, name: '見習い', merit: 0 },
    { star: 2, name: '一人前', merit: 2 },
    { star: 3, name: '腕きき', merit: 6 },
    { star: 4, name: '風見の星', merit: 11 },
    { star: 5, name: '峠の案内人', merit: 15 },
    { star: 6, name: '風呼びの星', merit: 24 },
    { star: 7, name: '峠越えの星', merit: 32 },
  ];

  const TEXT = { title: 'GUILDWARD' };

  const PROLOGUE = [
    '丘の町カザミの、いちばん高い屋根の上。風見鶏がくるりと回る建物が、冒険者ギルド「風見鶏」だ。',
    '依頼人が困りごとを持ちこみ、受付が依頼板に貼りだし、冒険者が三人一組で出かけていく。',
    '使い走りをして三年。斥候のリコは、今日はじめて、正式な冒険者の札をもらった。',
    '「三人一組がうちの決まりさ。だれと行くかは――まあ、最初はこっちで決めてやるよ」',
  ];
  const EPILOGUE = [
    '大亀がしずまると、谷にふたたび風が吹きこんだ。遠く、町の屋根の上で、風見鶏がくるりと回った。',
    'その夜の風見鶏ギルドは、町じゅうの人であふれた。かぼちゃも、旗も、甲羅のかけらも、みんな棚の上で光っていた。',
    '「腕ききどころか、風見の星だよ」ドーラが、リコの札に新しい星を打った。',
    'けれど、セナの石板には、まだ読めない文字が残っている。北の峠からは、見知らぬ手紙が届いた。',
    'リコの依頼帳は、まだ一冊目の、ほんのはじめ。――第一章　おわり。',
  ];

  // 帰還したときの、ギルドでの小さな場面（依頼ごと）
  const RETURN_SAY = {
    m1: [['mimoza', 'おかえり！ はじめての依頼、達成ね。ハンスさんが、お礼を言いに来てるわよ'], ['hans', 'ありがとよ！ うちのかぼちゃ、棚に飾っとくれ'], ['mimoza', '依頼板の札の ◇ は腕だめし。別のやり方でこなすと、印がつくの']],
    m2: [['dora', '角笛が鳴るのは何年ぶりかね。リコ、今日から一人前だ'], ['mimoza', '顔役さんから、昔の見張りが使っていた長い鉤縄をもらったわ。遠くの輪まで届くそうよ']],
    m3: [['bolo', 'トビを、仲間を助けてくれて…ありがとな'], ['tobi', 'あの…おいら、このギルドに入れてもらえないっすか？ 恩は、発破で返すっす！'], ['dora', 'いい度胸だ。今日から、うちの冒険者だよ'], ['dora', '済んだ依頼も、だれとでも受けなおせるよ。腕だめし帳、つけておくからね']],
    m4: [['sena', '石板の文字…「大亀が目ざめるとき、谷に風が止む」。いやな予感がします']],
    m5: [['elder', '米俵を守ってくれた、と村じゅうが大さわぎです。どうぞ、この旗を']],
    m6: [['dora', 'よくやった。今夜は、ギルドじゅうでお祝いだ']],
    m7: [['turu', 'おお、茶釜！ 無事だったかい'], ['turu', 'その鉤は、うちの人のだよ。…あんたが持っておいき。道具は、使ってくれる人の手にあるのがいちばんさ'],
      ['turu', '上の風守りの里じゃ、風車が止まって粉がひけないそうだよ。里の子がひとりで、なんとかしようとしてるって'], ['mimoza', '里からの依頼、依頼板に貼っておいたわ']],
    // 設計のミモザの「依頼が三つも届いてるわ」は、m9〜m11（v0.4）を貼るときに足す（VERIFICATION_v0.3.md）
    m8: [['hiba', '風車が回りました。里の者みな、礼を申しております'], ['hiba', 'ナギ。峠の上の風は、おまえが呼んでおいで。…このかたがたと一緒にな'],
      ['nagi', '……うちも、ギルドに入れてもらえる？ 借り、まだ返してへんし'], ['dora', '風守りか。うちに足りなかった力だよ。今日から、うちの冒険者だ']],
  };

  // 加入の画面（トビは v0.1 の文、ナギは 04 3.5 の三行）
  const JOIN = {
    tobi: ['ひび割れた岩や封印石を、発破で砕く。がれきは足場になる', '敵や物のとなりで発破すると、上下左右のものが外へ吹き飛ぶ', '重くて押せない相手（岩人形など）も、爆風なら動かせる', 'これからは、依頼ごとに「だれと行く？」を選べる'],
    nagi: ['軽い物・敵・仲間を、2升先へ運ぶ', '2段上へも、谷の向こうへも', '重い物と、自分は運べない', 'これからは「だれと行く？」で、ナギも選べる'],
  };
  root.D21 = { MAPS, HUB, PEOPLE, TALK, REQUESTS, TEASER, TEASER2, JOIN, SHOP, TROPHY, ITEM, RANKS, TEXT, PROLOGUE, EPILOGUE, RETURN_SAY, STAMPS, STAMP_KIND, LEDGER, CHARMS,
    map: (id) => MAPS[id], req: (id) => REQUESTS.find(r => r.id === id), stamp: (id) => { for (const k in STAMPS) { const s = STAMPS[k].find(q => q.id === id); if (s) return Object.assign({ req: k }, s); } return null; } };
})(typeof window !== 'undefined' ? window : globalThis);
