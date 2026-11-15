/*
 * ひゅるり、凧びより ― データ（もの・凧・おたから・ことば）
 * 大きさの単位はすべて cm。
 *   s     … 大きさ（つむじの大きさが これ以上なら まきこめる）
 *   flat  … 地面に ねている形（上から見た絵。向きが ばらばら）
 *   w     … おもさの係数（まきこんだときの 育ちかた。ふつう 1）
 *   z     … まきこみ帳の ページ（1〜5）
 *   k     … 'item' ふつうのもの / 'break' ドンで こわせる入れもの / 'tre' おたから
 */
(function (root) {
  'use strict';
  const TJ = root.TJ = root.TJ || {};

  const T = {
    // ── その一　えんがわの にわ ───────────────────────
    kareha: { name: 'かれは', s: 4, flat: 1, z: 1, v: 3, w: 0.8, desc: 'かさかさ。いちばん さいしょに まきこまれる。' },
    matsuba: { name: 'まつば', s: 4, flat: 1, z: 1, w: 0.7, desc: 'ふたまたの はっぱ。ちくっとする。' },
    koishi: { name: 'こいし', s: 3, flat: 1, z: 1, v: 3, w: 1.3, desc: 'にわの すみに ころがっている。ちょっと おもい。' },
    donguri: { name: 'どんぐり', s: 2.5, z: 1, desc: 'ぼうしを かぶったまま。' },
    mikankawa: { name: 'みかんの かわ', s: 5, flat: 1, z: 1, w: 0.7, desc: 'こたつで むいたのを、だれかが にわに すてた。' },
    ohajiki: { name: 'おはじき', s: 2.5, flat: 1, z: 1, v: 4, desc: 'えんがわの したに ちらばっていた。' },
    biidama: { name: 'ビーだま', s: 2, z: 1, v: 3, w: 1.3, desc: 'ころころ にげるので、まきこむのに コツがいる。' },
    umehana: { name: 'うめの はな', s: 3, flat: 1, z: 1, w: 0.6, desc: 'お正月に さく、はやおきの はな。' },
    tsuchi: { name: 'つちくれ', s: 4, flat: 1, z: 1, desc: 'うえきばちの なかみ。' },
    hachikake: { name: 'はちの かけら', s: 7, flat: 1, z: 1, desc: 'すやきの かけら。' },
    hane: { name: 'はね', s: 7, z: 1, desc: 'はねつきの はね。おちたら すみで かおに ばってん。' },
    menko: { name: 'めんこ', s: 6, flat: 1, z: 1, v: 3, desc: 'こはるの いちばんの つよい めんこ。' },
    koma: { name: 'こま', s: 6, z: 1, v: 2, desc: 'まわしたまま まきこむと、目が まわる。' },
    sentaku: { name: 'せんたくばさみ', s: 6, flat: 1, z: 1, v: 3, desc: 'ものほしから にげてきた。' },
    mikan: { name: 'みかん', s: 7.5, z: 1, desc: 'こたつの おとも。まわすと あまくなる（気がする）。' },
    tebukuro: { name: 'てぶくろ', s: 13, flat: 1, z: 1, v: 2, desc: 'かたほうだけ。もうかたほうは どこ？' },
    keito: { name: 'けいとだま', s: 10, z: 1, v: 2, desc: 'たまが ほどけて にわじゅうに いとが……。' },
    kendama: { name: 'けんだま', s: 16, z: 1, desc: 'もしかめ 百回が もくひょう。' },
    daruma_s: { name: 'こだるま', s: 12, z: 1, v: 2, desc: 'ころんでも おきる。まきこまれても おきる。' },
    geta: { name: 'げた', s: 22, z: 1, desc: 'カランコロン。かたほうだけ はいて どこへ？' },
    kagami: { name: 'かがみもち', s: 20, z: 1, desc: 'てっぺんの みかんが おちないように まわす。' },
    kakizome: { name: 'かきぞめ', s: 28, flat: 1, z: 1, v: 3, w: 0.7, desc: 'こはるの かきぞめ。「たこ」と かいてある。' },
    hagoita: { name: 'はごいた', s: 30, z: 1, v: 2, desc: 'はねを うつ いた。うらに 役者の え。' },
    zaru: { name: 'ざる', s: 28, flat: 1, z: 1, desc: 'ほしがきを ほしていた ざる。' },
    jouro: { name: 'じょうろ', s: 28, z: 1, desc: 'ふゆの にわは みずやりも すくない。' },
    baketsu: { name: 'バケツ', s: 27, z: 1, desc: 'からっぽ。かぜが はいると ボォーと なる。' },
    ita: { name: 'いたきれ', s: 24, flat: 1, z: 1, desc: 'きどの いた。' },
    // ── その二　のうかと はたけ ───────────────────────
    tourou: { name: 'いしどうろう', s: 80, z: 2, w: 1.3, desc: 'にわの すみで 百年 たっていた。' },
    daruma_m: { name: 'だるま', s: 35, z: 2, v: 2, desc: 'かたほうだけ 目が はいっている。' },
    wara: { name: 'わらたば', s: 35, z: 2, w: 0.7, desc: 'しめかざりの ざいりょう。' },
    daikon: { name: 'だいこん', s: 45, z: 2, desc: 'ぬいても ぬいても まだ ある。' },
    hakusai: { name: 'はくさい', s: 35, z: 2, desc: 'ふゆの はたけの おおもの。' },
    negi: { name: 'ねぎ', s: 50, z: 2, w: 0.8, desc: 'かぜに ゆれる。くびに まくと かぜに きく。' },
    kaki: { name: 'かき', s: 9, z: 2, desc: 'からすの ぶんを のこしておいた かき。' },
    kago: { name: 'しょいかご', s: 45, z: 2, desc: 'はたけしごとの あいぼう。' },
    nagagutsu: { name: 'ながぐつ', s: 32, z: 2, desc: 'なかに どんぐりが はいっていた。' },
    shichirin: { name: 'しちりん', s: 30, z: 2, w: 1.2, desc: 'おもちを やく ちいさな こんろ。' },
    yakan: { name: 'やかん', s: 25, z: 2, desc: 'しゅんしゅん いっていた。' },
    zabuton: { name: 'ざぶとん', s: 55, flat: 1, z: 2, v: 2, w: 0.7, desc: 'ほされていた。ふかふか。' },
    kine: { name: 'きね', s: 85, z: 2, desc: 'もちつきの きね。ぺったん。' },
    usu: { name: 'うす', s: 65, z: 2, w: 1.4, desc: 'もちつきの うす。おもい。とても おもい。' },
    ichirinsha: { name: 'いちりんしゃ', s: 110, z: 2, desc: 'ねこぐるま とも いう。' },
    sukoppu: { name: 'スコップ', s: 95, z: 2, desc: 'はたけに ささっていた。' },
    kuwa: { name: 'くわ', s: 115, z: 2, desc: 'たがやす どうぐ。' },
    shatsu: { name: 'シャツ', s: 60, flat: 1, z: 2, v: 3, w: 0.6, desc: 'せんたくもの。まだ ちょっと しめっている。' },
    taoru: { name: 'てぬぐい', s: 45, flat: 1, z: 2, v: 2, w: 0.5, desc: 'えびと たいの もよう。おめでたい。' },
    kutsushita: { name: 'くつした', s: 18, flat: 1, z: 2, v: 2, w: 0.6, desc: 'かたほうだけ……また かたほう？' },
    mugiwara: { name: 'むぎわらぼうし', s: 45, z: 2, w: 0.6, desc: 'かかしの ぼうし。なつの においが する。' },
    kimono: { name: 'かかしの きもの', s: 90, flat: 1, z: 2, w: 0.6, desc: 'つぎはぎだらけ。' },
    take: { name: 'たけ', s: 150, flat: 1, z: 2, w: 0.7, desc: 'まっすぐな たけ。かどまつにも なる。' },
    tawara: { name: 'こめだわら', s: 70, z: 2, w: 1.3, desc: 'ことしの おこめ。' },
    kadomatsu: { name: 'かどまつ', s: 150, z: 2, desc: 'お正月の かみさまの めじるし。' },
    monita: { name: 'もんの いた', s: 100, flat: 1, z: 2, desc: 'のうかの もんの とびら。' },
    hoshigaki: { name: 'ほしがき', s: 60, z: 2, w: 0.7, desc: 'のきしたで あまくなるのを まっていた。' },
    mushiro: { name: 'むしろ', s: 120, flat: 1, z: 2, w: 0.6, desc: 'わらで あんだ しきもの。' },
    // ── その三　むらの とおり ─────────────────────────
    jitensha: { name: 'じてんしゃ', s: 160, z: 3, v: 3, desc: 'ベルを ならしながら とんでいく。' },
    riyakaa: { name: 'リヤカー', s: 210, z: 3, desc: 'みかんばこを はこぶ くるま。' },
    tanuki_s: { name: 'こだぬき', s: 70, z: 3, w: 1.2, desc: 'やきものの たぬき。おみせの まえに いる。' },
    tanuki_m: { name: 'たぬき', s: 130, z: 3, w: 1.2, desc: 'かさを かぶった たぬき。' },
    tanuki_l: { name: 'おおだぬき', s: 250, z: 3, w: 1.2, desc: 'むらいちばんの たぬき。おみせより めだつ。' },
    nobori: { name: 'のぼり', s: 220, z: 3, v: 3, w: 0.5, desc: '「初売り」「福」「大安売」。' },
    chouchin: { name: 'ちょうちん', s: 50, z: 3, w: 0.5, desc: 'あかい ちょうちん。ひるまは ねている。' },
    kanban: { name: 'たてかんばん', s: 140, z: 3, v: 2, desc: '「本日 だんご あります」' },
    sakadaru: { name: 'さかだる', s: 85, z: 3, w: 1.2, desc: 'おとそ の たる。からっぽ。' },
    kibako: { name: 'きばこ', s: 70, z: 3, desc: 'りんごばこ。ドンで あく。' },
    ringo: { name: 'りんご', s: 9, z: 3, desc: 'きばこから ころがりでた。' },
    fukubukuro: { name: 'ふくぶくろ', s: 55, z: 3, v: 2, desc: 'なにが はいっているかは、あけてからの おたのしみ。' },
    omen: { name: 'おめん', s: 25, z: 3, v: 3, desc: 'きつね・ひょっとこ・おかめ。' },
    kazaguruma: { name: 'かざぐるま', s: 40, z: 3, v: 2, desc: 'つむじの そばだと ずっと まわる。' },
    wataame: { name: 'わたあめ', s: 35, z: 3, w: 0.3, desc: 'くもと まちがえて まきこんだ。' },
    taiyaki: { name: 'たいやき', s: 15, flat: 1, z: 3, desc: 'しっぽまで あんこ。' },
    ringoame: { name: 'りんごあめ', s: 22, z: 3, desc: 'つやつや。' },
    yane: { name: 'やたいの やね', s: 250, flat: 1, z: 3, v: 2, w: 0.6, desc: 'あかと しろの しましま。' },
    hashira: { name: 'やたいの はしら', s: 200, flat: 1, z: 3, w: 0.6, desc: 'たけの はしら。' },
    benchi: { name: 'ベンチ', s: 180, z: 3, desc: 'バスていの ベンチ。バスは 一日 三本。' },
    posuto: { name: 'ポスト', s: 130, z: 3, w: 1.4, desc: 'ねんがじょうで おなかいっぱい。' },
    keitora: { name: 'けいトラ', s: 340, z: 3, v: 2, w: 0.9, desc: 'にだいに みかんを つんだまま。' },
    daruma_l: { name: 'おおだるま', s: 120, z: 3, desc: 'おみせの かんばん だるま。' },
    niito: { name: 'けいとの ぼうし', s: 25, z: 3, v: 3, w: 0.5, desc: 'むらの ひとの ぼうし。あとで かえします。' },
    boushi: { name: 'なかおれぼう', s: 30, z: 3, w: 0.5, desc: 'しんしの ぼうし。あとで かえします。' },
    kasa: { name: 'かさ', s: 90, z: 3, v: 2, w: 0.5, desc: 'ひがさ。ひらいたまま とんでいく。' },
    kamibukuro: { name: 'かみぶくろ', s: 40, z: 3, w: 0.6, desc: 'はつうりの かいもの。なかみは ひみつ。' },
    furoshiki: { name: 'ふろしきづつみ', s: 45, z: 3, w: 0.8, desc: 'おせちの おすそわけ。' },
    bonsai: { name: 'ぼんさい', s: 75, z: 3, desc: 'のきさきの たなに ならんでいた。' },
    yukidaruma: { name: 'ゆきだるま', s: 140, z: 3, w: 0.8, desc: 'ひかげで ねばっていた。はなは にんじん。' },
    // ── その四　かわらと ふなつきば ───────────────────
    kobune: { name: 'こぶね', s: 650, z: 4, w: 1.1, desc: 'かわを わたる ちいさな ふね。' },
    maruta: { name: 'まるた', s: 550, flat: 1, z: 4, w: 1.1, desc: 'かわらに つんであった。' },
    ami: { name: 'あみ', s: 400, flat: 1, z: 4, w: 0.6, desc: 'りょうしの あみ。ほしてあった。' },
    iwa: { name: 'いわ', s: 450, z: 4, v: 2, w: 1.4, desc: 'むかし かわが はこんできた いわ。' },
    susuki: { name: 'かれすすき', s: 260, z: 4, w: 0.5, desc: 'ふゆの かわらの かれた すすき。' },
    zaimoku: { name: 'ざいもく', s: 260, flat: 1, z: 4, desc: 'こやの はしらや いた。' },
    tsurizao: { name: 'つりざお', s: 320, flat: 1, z: 4, w: 0.4, desc: 'こいを つる ながい さお。' },
    shimekazari: { name: 'しめかざり', s: 80, z: 4, w: 0.6, desc: 'どんどやきで もやす しめかざり。' },
    oke: { name: 'おおおけ', s: 220, z: 4, desc: 'つけものを つける おけ。' },
    yakatabune: { name: 'やかたぶね', s: 1200, z: 4, w: 1.1, desc: 'やねの ある ふね。なかで おもちを たべる。' },
    hashigo: { name: 'はしご', s: 420, flat: 1, z: 4, w: 0.6, desc: 'こやの やねに かけてあった。' },
    kame: { name: 'おおがめ', s: 190, z: 4, w: 1.2, desc: 'みずを ためておく かめ。' },
    yoshizu: { name: 'よしず', s: 360, flat: 1, z: 4, w: 0.5, desc: 'あしで あんだ すだれ。' },
    // ── その五　おかの たこあげひろば ─────────────────
    tento: { name: 'テント', s: 700, z: 5, v: 2, w: 0.7, desc: 'たこあげまつりの テント。' },
    taiko: { name: 'おおだいこ', s: 300, z: 5, w: 1.2, desc: 'ドーン。まつりの あいず。' },
    torakku: { name: 'トラック', s: 850, z: 5, v: 2, w: 1.2, desc: 'たこを はこんできた トラック。' },
    monooki: { name: 'ものおき', s: 500, z: 5, w: 1.1, desc: 'たこの ほねぐみが しまってあった。' },
    roll: { name: 'ほしくさロール', s: 280, z: 5, desc: 'まきずしみたいな ほしくさ。' },
    daruma_xl: { name: 'ジャンボだるま', s: 450, z: 5, desc: 'まつりの ための だるま。りょうめが はいるのは いつ？' },
    yuki: { name: 'ゆきの かたまり', s: 260, z: 5, w: 0.8, desc: 'かまくらの かべ。' },
    kiri: { name: 'あさもや', s: 1100, z: 5, v: 2, w: 0.9, desc: 'おかに ひっかかっていた くも。ひんやり。' },
    basu: { name: 'むらの バス', s: 1100, z: 5, w: 1.1, desc: 'けんぶつきゃくを のせてきた。いまは からっぽ。' },
    oonobori: { name: 'おおのぼり', s: 900, z: 5, v: 3, w: 0.5, desc: '「凧揚祭」。ひろばを かこむ のぼり。' },
    kumo: { name: 'ゆきぐもの かけら', s: 900, z: 5, w: 1, desc: 'ねぼすけ ゆきぐもの ちぎれた ところ。' },

    // ── ドンで こわせる入れもの（こわすと なかみが でる。じぶんより ちいさければ まるごと まきこめる）
    ueki: { name: 'うえきばち', s: 26, z: 1, k: 'break', hp: 2, min: 9, w: 1.2, drops: [['tsuchi', 4], ['hachikake', 3]], desc: 'ドンで わると、なかから……。' },
    fusezaru: { name: 'ふせた ざる', s: 28, z: 1, k: 'break', hp: 1, min: 8, drops: [['zaru', 1]], desc: 'なにかに かぶせてある。' },
    kido: { name: 'きど', s: 90, z: 1, k: 'break', hp: 4, min: 14, solid: 1, drops: [['ita', 4]], desc: 'にわの でぐち。ドン ドン ドン ドン。' },
    monohoshi: { name: 'ものほし', s: 300, z: 2, k: 'break', hp: 2, min: 40, drops: [['shatsu', 2], ['taoru', 3], ['kutsushita', 4], ['take', 1]], desc: 'せんたくものが いっぱい。' },
    kakashi: { name: 'かかし', s: 150, z: 2, k: 'break', hp: 3, min: 60, drops: [['mugiwara', 1], ['kimono', 1], ['take', 1]], desc: 'からすを みはっている……つもり。' },
    warani: { name: 'わらにお', s: 200, z: 2, k: 'break', hp: 4, min: 70, w: 0.8, drops: [['wara', 8]], desc: 'わらを つんだ ちいさな やま。' },
    mon: { name: 'のうかの もん', s: 300, z: 2, k: 'break', hp: 5, min: 60, solid: 1, drops: [['monita', 4]], desc: 'むらへ でる もん。かんぬきが かかっている。' },
    yatai: { name: 'やたい', s: 300, z: 3, k: 'break', hp: 4, min: 150, w: 0.8, drops: [['omen', 2], ['kazaguruma', 2], ['wataame', 1], ['taiyaki', 3], ['ringoame', 2], ['yane', 1], ['hashira', 2]], desc: 'はつうりの やたい。' },
    saku: { name: 'たけの さく', s: 400, z: 3, k: 'break', hp: 4, min: 250, solid: 1, drops: [['take', 4]], desc: 'かわらへ でる さく。' },
    koya: { name: 'りょうしごや', s: 600, z: 4, k: 'break', hp: 4, min: 450, drops: [['zaimoku', 5], ['tsurizao', 2], ['ami', 1]], desc: 'あみや さおが しまってある。' },
    dondo: { name: 'どんどやきの やぐら', s: 1000, z: 4, k: 'break', hp: 6, min: 600, w: 0.8, drops: [['take', 8], ['shimekazari', 6], ['daruma_m', 4], ['kadomatsu', 2]], desc: 'しめかざりを あつめた たけの やぐら。' },
    taoreki: { name: 'たおれた すぎ', s: 1400, z: 4, k: 'break', hp: 5, min: 700, solid: 1, drops: [['maruta', 4]], desc: 'おかへの みちを ふさいでいる。' },
    kamakura: { name: 'かまくら', s: 500, z: 5, k: 'break', hp: 3, min: 800, drops: [['yuki', 5]], desc: 'ゆきの おうち。なかに なにか いる？' },
    yagura: { name: 'やぐら', s: 1200, z: 5, k: 'break', hp: 5, min: 1000, drops: [['zaimoku', 6], ['chouchin', 8], ['taiko', 1]], desc: 'まつりの やぐら。てっぺんに なにか ひかる。' },

    // ── おたから（ひとつずつしか ない）
    t_biidama: { name: 'あおい ビーだま', s: 2.5, z: 1, k: 'tre', hint: 'えんがわの みぎはしの うえきばち', desc: 'こはるの たからもの。のぞくと そらが うつる。' },
    t_donguri: { name: 'きんの どんぐり', s: 3, z: 1, k: 'tre', hint: 'にわの うめの木を ドンで ゆらすと……', desc: 'うめの きの うえに ひっかかっていた。だれが おいたの？' },
    t_otoshidama: { name: 'おとしだま ぶくろ', s: 9, z: 1, k: 'tre', hint: 'にわの なにかに かぶせてある ざる', desc: 'こはるの お年玉。ざるの したに かくしてあった。' },
    t_suzu: { name: 'きんの すず', s: 5, z: 2, k: 'tre', hint: 'かきの木の まわりを とぶ からす（わの 上で まって ドン）', desc: 'からすが くわえていた。チリン。' },
    t_koban: { name: 'ふるい こばん', s: 8, z: 2, k: 'tre', hint: 'いどの にしの わらの やま', desc: 'わらにおの おくに。ご先祖さまの へそくり？' },
    t_megane: { name: 'おじいちゃんの めがね', s: 14, z: 2, k: 'tre', hint: 'はたけの かかしの かお を よく見て', desc: 'かかしが かけていた。どうりで みつからないわけだ。' },
    t_maneki: { name: 'まねきねこ', s: 30, z: 3, k: 'tre', hint: 'ひろばの ふくぶくろ。きんいろ は とくべつ', desc: 'きんいろの ふくぶくろの おおあたり。' },
    t_fuurin: { name: 'ガラスの ふうりん', s: 20, z: 3, k: 'tre', hint: 'ひろばの うえを まわる からす', desc: 'からすが くわえていた。ふゆに なると ちょっと さむい。' },
    t_itomaki: { name: 'めいじんの いとまき', s: 40, z: 3, k: 'tre', hint: 'むらの ひがしの はし、さくの そばの きばこ', desc: 'げんじいの たこいと。どこまでも のびる。' },
    t_negai: { name: 'ねがいの だるま', s: 60, z: 4, k: 'tre', hint: 'かわらの おおきな どんどやき', desc: 'りょうめが はいった だるま。ねがいは かなった。' },
    t_kappa: { name: 'かっぱの おさら', s: 40, z: 4, k: 'tre', hint: 'かわしもの りょうしごや', desc: 'こやの すみに。かわかすと よわるらしい。' },
    t_koi: { name: 'きんの こい', s: 120, z: 4, k: 'tre', hint: 'かわの うえを ゆっくり まう とんび', desc: 'からすには おもすぎた。' },
    t_usagi: { name: 'ゆきうさぎ', s: 150, z: 5, k: 'tre', hint: 'ゆきの つもった ところの かまくら', desc: 'かまくらの なかで ねていた。目は なんてんの み。' },
    t_uchiwa: { name: 'てんぐの うちわ', s: 200, z: 5, k: 'tre', hint: 'まつりの やぐら', desc: 'ひとあおぎで つむじかぜが おきるという。' },
    t_hoshi: { name: 'ほしの かけら', s: 300, z: 5, k: 'tre', hint: 'ねぼすけの ゆきぐもの なか', desc: 'ゆきぐもの おくで ひかっていた。' }
  };
  for (const key in T) {
    const t = T[key];
    t.key = key;
    t.k = t.k || 'item';
    t.w = t.w || 1;
    t.v = t.v || 1;
  }
  TJ.TYPES = T;

  // 凧（節目）。req の大きさになって さわると あがる。
  TJ.KITES = [
    { key: 'yakko', name: 'やっこだこ', owner: 'こはる', s: 45, req: 30, zone: 1,
      thanks: 'あがった！ つむじ、ありがとう！', title: 'その一　えんがわの にわ' },
    { key: 'kaku', name: 'かくだこ', owner: 'けんた', s: 160, req: 140, zone: 2,
      thanks: 'すげえ！ おれの かくだこが いちばん たかいぞ！', title: 'その二　のうかと はたけ' },
    { key: 'semi', name: 'せみだこ', owner: 'ふみばあちゃん', s: 500, req: 450, zone: 3,
      thanks: 'まあまあ。五十年ぶりに、せみだこが ないとるよ。', title: 'その三　むらの とおり' },
    { key: 'ren', name: 'れんだこ', owner: 'げんじい', s: 1500, req: 1100, zone: 4,
      thanks: 'れんだこが ぜんぶ あがりおった！ こりゃあ ほんものの 風じゃ。', title: 'その四　かわらと ふなつきば' },
    { key: 'oodako', name: 'おおだこ', owner: 'むらの みんな', s: 1500, req: 2200, zone: 5,
      thanks: '', title: 'その五　おかの たこあげひろば' }
  ];

  TJ.ZONE_NAMES = ['', 'えんがわの にわ', 'のうかと はたけ', 'むらの とおり', 'かわらと ふなつきば', 'おかの たこあげひろば'];

  // 成長の係数：まきこむと S² += GROW * ZONE_MUL[z] * w * s²
  // （あとの ページの ものほど 1こずつの 育ちは 小さく、たくさん まきこんで 育つ）
  TJ.GROW = 0.1;
  TJ.ZONE_MUL = [1, 1, 0.65, 0.5, 0.38, 0.5];
})(typeof window !== 'undefined' ? window : globalThis);
