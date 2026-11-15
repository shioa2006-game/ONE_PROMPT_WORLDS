/*
 * そこから、そら ― 層と へや と おとしもの
 *
 * 地図の記号（1行20文字・19行。左右の端は岩盤の壁）
 *   #  岩盤（こわれない・支え）      =  ふた石（こわすと上の へやへの穴があく）
 *   d  つち（1回）   s  いし（2回）   S  かたいし（4回）   o  きらら石（2回・きららが多い）
 *   x  はぜ石（こわれると まわりを まきこんで はぜる）   t  おとしもの入りの石
 *   A  くさび（守り主をつなぎとめている）   G  守り主の体   O  ビー玉のバンパー
 *   r  ねっこ（1回）   p  ビー玉ぶくろ   b こうもり   m どろむし   w しずくぐも
 */
(function (root) {
  'use strict';

  // アオ（井戸のカエル）が見つける おとしもの。name はアオの よびかた、real は ほんとうの名前
  const ITEMS = [
    { layer: 0, name: 'うずまきの いし', real: 'アンモナイトの化石', note: 'ぐるぐるの おくに、だれか すんでいたのかな。' },
    { layer: 0, name: 'ほねの さかな', real: '魚の化石', note: '石の なかで、ずっと およいでいる。' },
    { layer: 0, name: 'こおった ひかり', real: '水晶', note: 'つめたくない。ふしぎ。' },
    { layer: 0, name: 'まるい いしの ぼう', real: '要石（かなめいし）', note: 'おおなまずの あたまを おさえていた石。もう ゆれませんように。' },
    { layer: 1, name: 'なわもようの いし', real: '縄文土器のかけら', note: 'だれかが ゆびで\nもようを つけたみたい。' },
    { layer: 1, name: 'まがった みどり', real: '勾玉', note: 'オタマジャクシだった ころの ぼくに にている。' },
    { layer: 1, name: 'とがった くろい ガラス', real: '黒曜石のやじり', note: 'さわると あぶない。でも きれい。' },
    { layer: 1, name: 'めの おおきな つちの ひと', real: '土偶', note: 'めが ぼくと にている。なかまかな？' },
    { layer: 2, name: 'あなの あいた まる', real: '寛永通宝（むかしの おかね）', note: 'あなに ゆびを とおすと ぴったり。' },
    { layer: 2, name: 'はなの ついた ぼう', real: 'かんざし', note: 'あたまに さしたら、すこし えらくなった きがする。' },
    { layer: 2, name: 'ころころ なる まる', real: '鈴', note: 'ふると、いどの なかに\nおとが ひろがる。' },
    { layer: 2, name: 'ぬのの ちいさな ふくろ', real: '水神さまの お守り', note: '「水」と かいてある。いどを まもっていたのかも。' },
    { layer: 3, name: 'そらの たまご', real: 'ビー玉', note: 'なかに あおい すじ。そらって こういう いろ？' },
    { layer: 3, name: 'えの かいた まるい かみ', real: 'めんこ', note: 'うらに ゆうしゃが かいてある。\nつよそう。' },
    { layer: 3, name: 'たまを とじこめた みずいれ', real: 'ラムネのびん', note: 'たまを だしてあげたい。\nでも でられない。' },
    { layer: 3, name: 'まわる かぎ', real: 'ゼンマイの かぎ', note: 'まわすと、なにかが うごきだしそう。' },
    { layer: 4, name: 'ちゃいろの まるい ひかり', real: '十円玉', note: 'たてものの えが ほってある。うえには こんな いえが あるの？' },
    { layer: 4, name: 'なにかを あける ほね', real: 'じてんしゃの カギ', note: 'あけるものが みつからない。' },
    { layer: 4, name: 'たたまれた かみ', real: 'てがみ', note: '', letter: ['いどの カエルさんへ', 'そらは とっても ひろいよ。', 'いつか 見に きてね。'] },
    { layer: 4, name: 'ぼうしを かぶった たね', real: 'どんぐり', note: 'ねっこの ぬしの こども。うえで うめてあげよう。' }
  ];

  const LAYERS = [
    { name: 'ねむりの層', sub: 'いきものの かたちをした 石が ねむっている', speed: 400 },
    { name: 'つちの層', sub: 'なわの もようの かけらが まじっている', speed: 415 },
    { name: 'むかしの層', sub: '石の かべ。だれかが つんだ あとが ある', speed: 430 },
    { name: 'ちょっとむかしの層', sub: 'ガラスの たまが あちこちで ひかっている', speed: 445 },
    { name: 'ねっこの層', sub: 'つちの においが あまい。そらは もう ちかい', speed: 460 }
  ];

  const E = '#..................#';
  function fill(rows) { while (rows.length < 19) rows.push(E); return rows; }

  const CHAMBERS = [
    // ---------------- 第一層 ----------------
    {
      id: '1-1', layer: 0, name: 'ねむりの そこ', items: [0],
      hint: 'マウスで ねらって クリック。\nひかる かたまりは、まるごと おちる。',
      map: fill([
        '########====########',
        '#dddddddddddddddddd#',
        '#dddddddddddddddddd#',
        '#dddddddddddddddddd#',
        '#ddd.....dd.....ddd#',
        '#dd......dd......dd#',
        '#...dddddddddddd...#',
        '#...ddtdd..ddddd...#',
        '#....dddd..dddd....#',
        '#.....dd....dd.....#'
      ])
    },
    {
      id: '1-2', layer: 0, name: 'きらら石', items: [1, 2],
      hint: 'ボタンを おしたまま まつと、おちてきた たまを 舌で くわえる。はなすと はきだす。',
      map: fill([
        '#####====###########',
        '#ssssssssssssssssss#',
        '#sssddddssssssoooss#',
        '#s.b........s.SSSSS#',
        '#s..........s.SStSS#',
        '#s...ssssssss.SSSSS#',
        '#....sostsos.......#',
        '#....ssoosss.......#',
        '#.....sssss........#',
        '#.......b..........#'
      ])
    },
    {
      id: '1-3', layer: 0, name: 'おおなまず', guardian: 'namazu', bossItem: 3, items: [],
      hint: 'おおなまずは 左右の しめなわで つるされている。なわの どこかを きれば…',
      map: fill([
        '########====########',
        '#ddd..A......A..ddd#',
        '#ddd..A......A..ddd#',
        '#ss...AGGGGGGA...ss#',
        '#ss....GGGGGG....ss#',
        '#so....GGGGGG....os#',
        '#s................s#'
      ])
    },
    // ---------------- 第二層 ----------------
    {
      id: '2-1', layer: 1, name: 'はぜ石', items: [4],
      hint: 'あかい はぜ石は、まわりを まきこんで つぎつぎ はぜる。',
      map: fill([
        '########====########',
        '#ssssssssssssssssss#',
        '#sddddddxddddddddss#',
        '#sdddddxdddddddddss#',
        '#sddddxddd......dss#',
        '#sdddxdd..ssssssdss#',
        '#sddxd....sotsos..s#',
        '#s.xd.....ssssss...#',
        '#s.m......sssss....#',
        '#s.................#'
      ])
    },
    {
      id: '2-2', layer: 1, name: 'たなの へや', items: [5, 6],
      hint: 'どろむしは すきまを どろで ふさぎ、岩を つなげてしまう。',
      map: fill([
        '###########====#####',
        '#ssssssssssssssssss#',
        '#dddddddddddddddddd#',
        '#ddd...............#',
        '#....ssssssssssssss#',
        '#....sssstsssssss..#',
        '#..................#',
        '#sssssssssssss.....#',
        '#.sssssosssssm.....#',
        '#..................#',
        '#......ssssssssssss#',
        '#......ssstsssssss.#',
        '#..........m.......#'
      ])
    },
    {
      id: '2-3', layer: 1, name: 'つちぐも', guardian: 'tsuchigumo', bossItem: 7, items: [],
      hint: 'つちぐもは きれた いとを はりなおす。いそいで ぜんぶ きろう。',
      map: fill([
        '########====########',
        '#sss....A..A....sss#',
        '#sss....A..A....sss#',
        '#ssss...GGGG...ssss#',
        '#ssssAAAGGGGAAAssss#',
        '#sss....GGGG....sss#',
        '#ss..............ss#',
        '#s................s#'
      ])
    },
    // ---------------- 第三層 ----------------
    {
      id: '3-1', layer: 2, name: 'つるされた はこ', items: [8],
      hint: 'かたいしは かたい。はずみを つけて うつと 2ばいの ちから。',
      map: fill([
        '########====########',
        '#SSSSSSSddddSSSSSSS#',
        '#SSSSSSSddddSSSSSSS#',
        '#S.w..d.dddd.d..w.S#',
        '#S....d..dd..d....S#',
        '#.SSSSd......dSSSS.#',
        '#.StdS........SdoS.#',
        '#.SddS........SddS.#',
        '#.SSSS........SSSS.#'
      ])
    },
    {
      id: '3-2', layer: 2, name: 'いしの はし', items: [10, 9],
      hint: 'おおきな いしの はしは、どこで ささえられている？',
      map: fill([
        '####====############',
        '#ssssssssssssssssss#',
        '#sddddddddddddddsss#',
        '#sdddd.ddddd.dddtss#',
        '#sdd............Sss#',
        '#s................s#',
        '#xSSSSSSStSSSSSSS..#',
        '#.SSSSSSSSSSSSSSS..#',
        '#.....w.....w......#'
      ])
    },
    {
      id: '3-3', layer: 2, name: 'つるべおとし', guardian: 'tsurube', bossItem: 11, items: [],
      hint: 'おけが おちてくる。かげを 見て よけよう。',
      map: fill([
        '########====########',
        '#SSSS...A..A...SSSS#',
        '#SSSS...A..A...SSSS#',
        '#SSd...GGGGGG...dSS#',
        '#SSSddAGGGGGGAddSSS#',
        '#SS....GGGGGG....SS#',
        '#S................S#'
      ])
    },
    // ---------------- 第四層 ----------------
    {
      id: '4-1', layer: 3, name: 'ビー玉の へや', items: [12, 13],
      hint: 'ビー玉ぶくろを わると、ビー玉が とびだして いっしょに あばれる。',
      map: fill([
        '########====########',
        '#dddddddddddddddddd#',
        '#dddpdddddddddpdddd#',
        '#ddddddddtddddddddd#',
        '#ddd..........d.ddd#',
        '#dd...ssssssssd..dd#',
        '#d....ssptpsss....d#',
        '#.....ssssssss.....#',
        '#......ssssss......#',
        '#..................#',
        '#...O..........O...#',
        '#........O.........#'
      ])
    },
    {
      id: '4-2', layer: 3, name: 'がらくたの やま', items: [14],
      hint: 'こうもりは めが あかく ひかると とびかかってくる。',
      map: fill([
        '#############====###',
        '#ssssssssssssssssss#',
        '#ddddddddddddddddss#',
        '#dddd.b....d.....ss#',
        '#dd..SSSSSSx......s#',
        '#d...SoSSpS........#',
        '#....StoopS........#',
        '#....SSSSSS........#',
        '#..................#',
        '#............O.....#',
        '#..O...............#'
      ])
    },
    {
      id: '4-3', layer: 3, name: 'からくり', guardian: 'karakuri', bossItem: 15, items: [],
      hint: 'からくりの 体に あてると、ビー玉を こぼす。',
      map: fill([
        '########====########',
        '#SSSS..A....A..SSSS#',
        '#SSSS..GGGGGG..SSSS#',
        '#SSS...GGGGGG...SSS#',
        '#SSSSSAGGGGGGASSSSS#',
        '#SS....GGGGGG....SS#',
        '#S................S#',
        '#...O..........O...#',
        '#..................#',
        '#........O.........#'
      ])
    },
    // ---------------- 第五層 ----------------
    {
      id: '5-1', layer: 4, name: 'ねっこの つち', items: [16],
      hint: 'ねっこは よわい。ほそい ところを きれば、かたまりごと おちる。',
      map: fill([
        '##====##############',
        '#ssssssssssssssssss#',
        '#dddddddddddddddddd#',
        '#dddd..r.....r.dddd#',
        '#d.....r.....r.m.dd#',
        '#.dddddr.....r....d#',
        '#.ddddd..ssssr....d#',
        '#.ddodd..sots.....d#',
        '#..ddd...ssss......#',
        '#...d.....ss.......#'
      ])
    },
    {
      id: '5-2', layer: 4, name: 'つちの なかの てがみ', items: [17, 18],
      hint: 'まんなかの かたまりは、左右の ねっこで つるされている。',
      map: fill([
        '####====############',
        '#ssssssssssssssssss#',
        '#ddddddddddddddSStS#',
        '#dd.b...........SSS#',
        '#d...............SS#',
        '#d................d#',
        '#drrrrrddddddrrrrrd#',
        '#d.....dddtdd.....d#',
        '#......dsssod......#',
        '#.......dddd.......#',
        '#........w.........#'
      ])
    },
    {
      id: '5-3', layer: 4, name: 'ねっこの ぬし', guardian: 'nekko', bossItem: 19, items: [],
      hint: 'ねっこは のびて、きれた ところも つなぎなおす。',
      map: fill([
        '########====########',
        '#dddd..A....A..dddd#',
        '#dddd..GGGGGG..dddd#',
        '#ddddAAGGGGGGAAdddd#',
        '#ddd...GGGGGG...ddd#',
        '#dd..............dd#',
        '#d................d#'
      ])
    }
  ];

  for (const ch of CHAMBERS) ch.speed = LAYERS[ch.layer].speed + (ch.guardian ? 0 : 0);

  const API = { ITEMS, LAYERS, CHAMBERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.SKS_DATA = API;
})(typeof window !== 'undefined' ? window : this);
