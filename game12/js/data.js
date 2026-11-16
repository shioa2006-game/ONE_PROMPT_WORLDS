/*
 * ころころ、ひらけ列島 ― データ（地方・駅・名物・路線・関所・きっぷ・できごと）
 * 地名と名物は 一般的な ものを 使い、名物の 名前は すべて この作品のための 創作。
 * 金額の単位は 万円。季節は 0=春 1=夏 2=秋 3=冬、-1=通年。
 */
(function (root) {
  'use strict';
  const KR = root.KR = root.KR || {};

  KR.SEASONS = [
    { name: '春', months: '4〜6月', color: '#f3a7bd' },
    { name: '夏', months: '7〜9月', color: '#3fae6a' },
    { name: '秋', months: '10〜12月', color: '#e07a32' },
    { name: '冬', months: '1〜3月', color: '#8fb6e0' },
  ];
  // 1年 = 24 ターン（各月の 上旬・下旬）。4月上旬から 3月下旬まで。
  KR.TURNS = 24;
  KR.turnLabel = function (t) {
    const m = ((Math.floor(t / 2) + 3) % 12) + 1;
    return m + '月' + (t % 2 ? '下旬' : '上旬');
  };
  KR.seasonOf = (t) => Math.floor(t / 6);
  KR.inflation = (t) => 1 + 0.06 * t;

  // ---------------------------------------------------------------- 会社
  KR.COMPANIES = [
    { key: 'you', name: 'あかつき鉄道', short: 'あかつき', boss: 'あなた', animal: 'shiba', color: '#e4502f', light: '#ffd7c8', dark: '#9c2d14' },
    { key: 'kon', name: 'ゆうぐれ急行', short: 'ゆうぐれ', boss: 'コン社長', animal: 'fox', color: '#8a55cf', light: '#e6d8fa', dark: '#563087' },
    { key: 'pon', name: 'つきよ交通', short: 'つきよ', boss: 'ポン社長', animal: 'tanuki', color: '#2f7fd2', light: '#d3e6fb', dark: '#1d4f8a' },
  ];

  // ---------------------------------------------------------------- 地方
  KR.REGIONS = [
    { id: 'kanto', name: '関東', ink: '#c4473a', open: true, teaser: '' },
    { id: 'tokai', name: '東海・甲斐', ink: '#d27d24', open: true, teaser: '' },
    { id: 'hokuriku', name: '北陸・信州', ink: '#3c7db8', teaser: 'そば・スキー場・かに' },
    { id: 'kinki', name: '近畿', ink: '#9a4bb0', teaser: 'たこ焼き・紅葉の寺・真珠' },
    { id: 'chugoku', name: '中国', ink: '#bf9420', teaser: '白桃・かき・砂丘' },
    { id: 'shikoku', name: '四国', ink: '#2f9f78', teaser: 'うどん・渦潮・いで湯' },
    { id: 'kyushu', name: '九州', ink: '#cf4f2c', teaser: '屋台・カステラ・砂むし温泉' },
    { id: 'tohoku', name: '東北', ink: '#4a8c36', teaser: '牛たん・りんご・ねぶた' },
    { id: 'hokkaido', name: '北海道', ink: '#2f73c9', teaser: '雪像・ラベンダー・丹頂' },
  ];

  // ---------------------------------------------------------------- 駅と名物
  // [名前, 値段, 季節, 種類]  種類：food 食べもの / farm 畑・果樹 / sea 海の幸 / inn 宿・温泉 / sight 景色・見物 / craft 工房 / fest まつり / snow 雪あそび
  KR.STATIONS = [
    // 関東（はじめから ひらいている）
    { id: 'tokyo', name: '東京', r: 'kanto', lon: 139.77, lat: 35.68, lab: 'e', tag: '線路が 四方へ のびる、にっぽんの まんなか',
      props: [['もんじゃ焼き屋', 600, -1, 'food'], ['下町の銭湯', 400, 3, 'inn'], ['隅田川の屋形船', 1800, 1, 'sight'], ['老舗百貨店', 5000, -1, 'craft']] },
    { id: 'yokohama', name: '横浜', r: 'kanto', lon: 139.55, lat: 35.40, lab: 's', tag: '港の汽笛と、中華街の湯気',
      props: [['中華まん屋', 500, 3, 'food'], ['港の観覧車', 2600, 1, 'sight'], ['赤れんが倉庫', 4200, -1, 'craft']] },
    { id: 'chiba', name: '千葉', r: 'kanto', lon: 140.17, lat: 35.58, lab: 'e', tag: '菜の花と海、房総への入り口',
      props: [['落花生畑', 400, 2, 'farm'], ['漁港の朝市', 900, -1, 'sea'], ['房総の海水浴場', 1500, 1, 'sight']] },
    { id: 'mito', name: '水戸', r: 'kanto', lon: 140.47, lat: 36.37, lab: 'e', tag: '梅の香りと、ねばりづよい町',
      props: [['納豆工房', 300, -1, 'food'], ['あんこう鍋屋', 800, 3, 'sea'], ['梅林の茶屋', 1200, 0, 'farm']] },
    { id: 'utsunomiya', name: '宇都宮', r: 'kanto', lon: 139.88, lat: 36.56, lab: 'w', tag: '餃子のけむりと、日光へのみち',
      props: [['餃子屋', 500, -1, 'food'], ['いちご農園', 900, 0, 'farm'], ['日光の紅葉宿', 3500, 2, 'inn']] },
    { id: 'takasaki', name: '高崎', r: 'kanto', lon: 139.00, lat: 36.32, lab: 'n', tag: 'だるまの町。山へ向かう分かれ道',
      props: [['こんにゃく畑', 400, -1, 'farm'], ['だるま工房', 700, 3, 'craft'], ['草津の湯宿', 3200, 3, 'inn']] },
    // 東海・甲斐（はじめから ひらいている）
    { id: 'atami', name: '熱海', r: 'tokai', lon: 139.07, lat: 35.10, lab: 's', tag: '湯けむりの坂と、海の花火',
      props: [['干物屋', 400, -1, 'sea'], ['海の花火桟敷', 1400, 1, 'fest'], ['海辺の温泉宿', 2800, 3, 'inn']] },
    { id: 'shizuoka', name: '静岡', r: 'tokai', lon: 138.38, lat: 34.97, lab: 's', tag: '茶畑の向こうに、大きな山',
      props: [['おでん横丁', 400, 3, 'food'], ['茶畑', 1000, 0, 'farm'], ['富士見の展望台', 2400, -1, 'sight']] },
    { id: 'hamamatsu', name: '浜松', r: 'tokai', lon: 137.73, lat: 34.70, lab: 's', tag: 'うなぎと楽器と、湖の風',
      props: [['浜名湖の釣り舟', 700, 2, 'sea'], ['うなぎ屋', 1500, 1, 'food'], ['楽器工房', 3400, -1, 'craft']] },
    { id: 'nagoya', name: '名古屋', r: 'tokai', lon: 136.88, lat: 35.17, lab: 'n', tag: '金のしゃちが見下ろす、大きな駅',
      props: [['味噌カツ屋', 700, -1, 'food'], ['天守の土産店', 1100, -1, 'craft'], ['ひつまぶし屋', 1700, 1, 'food'], ['自動車工場', 7000, -1, 'craft']] },
    { id: 'kofu', name: '甲府', r: 'tokai', lon: 138.57, lat: 35.66, lab: 'n', tag: 'ぶどう畑と、山にかこまれた盆地',
      props: [['ほうとう屋', 500, 3, 'food'], ['桃畑', 1000, 1, 'farm'], ['ぶどう園', 1200, 2, 'farm']] },
    // 北陸・信州
    { id: 'nagano', name: '長野', r: 'hokuriku', lon: 138.19, lat: 36.65, lab: 'e', tag: 'おそばと、りんごと、雪の山',
      props: [['そば屋', 500, -1, 'food'], ['りんご園', 1100, 2, 'farm'], ['白馬のスキー場', 4000, 3, 'snow']] },
    { id: 'matsumoto', name: '松本', r: 'hokuriku', lon: 137.97, lat: 36.23, lab: 'w', tag: '黒いお城と、北アルプス',
      props: [['城下の民芸店', 700, -1, 'craft'], ['わさび田', 900, -1, 'farm'], ['上高地の山小屋', 1600, 1, 'inn']] },
    { id: 'niigata', name: '新潟', r: 'hokuriku', lon: 139.04, lat: 37.91, lab: 'w', tag: '田んぼの海と、おいしいお米',
      props: [['笹団子屋', 400, 0, 'food'], ['米どころの酒蔵', 2400, 3, 'craft'], ['越後の雪宿', 2900, 3, 'snow']] },
    { id: 'toyama', name: '富山', r: 'hokuriku', lon: 137.21, lat: 36.70, lab: 'n', tag: '立山を背に、ひかるいかの浜',
      props: [['ます寿司屋', 800, -1, 'food'], ['ほたるいか漁', 1200, 0, 'sea'], ['立山の山荘', 2500, 1, 'inn']] },
    { id: 'kanazawa', name: '金沢', r: 'hokuriku', lon: 136.65, lat: 36.58, lab: 'w', tag: '金色の工芸と、冬のかに',
      props: [['茶屋街の甘味処', 900, 0, 'food'], ['金箔工房', 2000, -1, 'craft'], ['近江町のかに市場', 2200, 3, 'sea']] },
    { id: 'fukui', name: '福井', r: 'hokuriku', lon: 136.22, lat: 36.06, lab: 'w', tag: '恐竜と、めがねと、越前の海',
      props: [['眼鏡工房', 1200, -1, 'craft'], ['越前がに漁', 1800, 3, 'sea'], ['恐竜の博物館', 3000, 1, 'sight']] },
    // 近畿
    { id: 'kyoto', name: '京都', r: 'kinki', lon: 135.76, lat: 35.02, lab: 'n', tag: '千年の都。季節ごとに色がかわる',
      props: [['湯豆腐屋', 700, 3, 'food'], ['紅葉の寺の茶屋', 2400, 2, 'sight'], ['花見の料亭', 2800, 0, 'food'], ['西陣の織物工房', 3500, -1, 'craft']] },
    { id: 'osaka', name: '大阪', r: 'kinki', lon: 135.50, lat: 34.70, lab: 'sw', tag: '食い倒れの町、いつでもにぎやか',
      props: [['たこ焼き屋', 400, -1, 'food'], ['お好み焼き屋', 600, -1, 'food'], ['食い倒れ横丁', 3200, -1, 'fest'], ['港の大水族館', 5500, 1, 'sight']] },
    { id: 'kobe', name: '神戸', r: 'kinki', lon: 135.17, lat: 34.72, lab: 'nw', tag: '坂の上から、港と夜景',
      props: [['洋菓子店', 1100, -1, 'food'], ['夜景のロープウェイ', 1900, 2, 'sight'], ['牛ステーキ屋', 2700, -1, 'food']] },
    { id: 'nara', name: '奈良', r: 'kinki', lon: 135.86, lat: 34.66, lab: 'e', tag: '鹿がのんびり歩く、古い都',
      props: [['鹿せんべい屋', 300, -1, 'food'], ['柿の葉寿司屋', 800, 2, 'food'], ['古都の宿', 2400, 0, 'inn']] },
    { id: 'wakayama', name: '和歌山', r: 'kinki', lon: 135.17, lat: 34.23, lab: 'w', tag: 'みかんの山と、南の海',
      props: [['梅干し蔵', 700, 1, 'food'], ['みかん畑', 900, 3, 'farm'], ['白浜の海水浴場', 2200, 1, 'sight']] },
    { id: 'ise', name: '伊勢', r: 'kinki', lon: 136.72, lat: 34.49, lab: 'e', tag: '森の奥のお宮と、真珠の海',
      props: [['あんころ餅屋', 500, -1, 'food'], ['伊勢えび漁', 1800, 2, 'sea'], ['真珠いかだ', 3000, -1, 'craft']] },
    // 中国
    { id: 'himeji', name: '姫路', r: 'chugoku', lon: 134.69, lat: 34.83, lab: 'n', tag: '白い城が、空にうかぶ',
      props: [['姫路おでん屋', 400, 3, 'food'], ['皮革工房', 1000, -1, 'craft'], ['白い城の茶屋', 1500, 0, 'sight']] },
    { id: 'okayama', name: '岡山', r: 'chugoku', lon: 133.92, lat: 34.66, lab: 'n', tag: '白桃と、晴れの国',
      props: [['きびだんご屋', 500, -1, 'food'], ['白桃畑', 1200, 1, 'farm'], ['デニム工房', 2000, -1, 'craft']] },
    { id: 'hiroshima', name: '広島', r: 'chugoku', lon: 132.46, lat: 34.40, lab: 'n', tag: 'かきのいかだと、海の鳥居',
      props: [['お好み焼き屋台', 600, -1, 'food'], ['もみじ饅頭屋', 900, 2, 'food'], ['かき筏', 1500, 3, 'sea'], ['宮島の宿', 3400, 0, 'inn']] },
    { id: 'shimonoseki', name: '下関', r: 'chugoku', lon: 130.94, lat: 33.96, lab: 'n', tag: 'ふぐと海峡。九州はすぐそこ',
      props: [['うに瓶詰め屋', 800, 0, 'sea'], ['海峡の市場', 1000, -1, 'sea'], ['ふぐ料理屋', 2500, 3, 'food']] },
    { id: 'tottori', name: '鳥取', r: 'chugoku', lon: 134.24, lat: 35.50, lab: 'n', tag: '砂丘の風と、梨の実り',
      props: [['二十世紀梨園', 900, 2, 'farm'], ['砂丘のらくだ乗り', 1200, 1, 'sight'], ['松葉がに漁', 2000, 3, 'sea']] },
    { id: 'matsue', name: '松江', r: 'chugoku', lon: 133.05, lat: 35.47, lab: 'n', tag: '夕日の湖と、縁むすび',
      props: [['しじみ漁', 500, -1, 'sea'], ['宍道湖の遊覧船', 1200, 1, 'sight'], ['縁むすびの宿', 2500, 2, 'inn']] },
    // 四国
    { id: 'takamatsu', name: '高松', r: 'shikoku', lon: 134.05, lat: 34.34, lab: 'n', tag: '一杯のうどんから、はじまる旅',
      props: [['うどん屋', 400, -1, 'food'], ['オリーブ畑', 1200, 2, 'farm'], ['庭園の茶屋', 1500, 0, 'sight']] },
    { id: 'tokushima', name: '徳島', r: 'shikoku', lon: 134.55, lat: 34.07, lab: 'e', tag: '渦潮と、夏の踊り',
      props: [['すだち畑', 600, 2, 'farm'], ['渦潮の観潮船', 1800, 0, 'sight'], ['踊りの桟敷', 2000, 1, 'fest']] },
    { id: 'kochi', name: '高知', r: 'shikoku', lon: 133.53, lat: 33.56, lab: 's', tag: 'かつおと清流、南の太陽',
      props: [['日曜市の店', 500, -1, 'food'], ['かつおのたたき屋', 1000, 1, 'sea'], ['清流の川下り', 1500, 1, 'sight']] },
    { id: 'matsuyama', name: '松山', r: 'shikoku', lon: 132.77, lat: 33.84, lab: 'nw', tag: 'いで湯の町と、路面電車',
      props: [['三色団子屋', 500, -1, 'food'], ['段々のみかん畑', 900, 3, 'farm'], ['道後の湯', 3300, 3, 'inn']] },
    // 九州
    { id: 'hakata', name: '博多', r: 'kyushu', lon: 130.42, lat: 33.59, lab: 'nw', tag: '屋台のあかりと、祭りの掛け声',
      props: [['ラーメン屋台', 600, 3, 'food'], ['明太子屋', 1200, -1, 'sea'], ['山笠の祭り桟敷', 1500, 1, 'fest'], ['屋台横丁', 2500, -1, 'fest']] },
    { id: 'nagasaki', name: '長崎', r: 'kyushu', lon: 129.87, lat: 32.75, lab: 'w', tag: '坂と教会と、港の夜景',
      props: [['ちゃんぽん屋', 600, -1, 'food'], ['カステラ屋', 1000, -1, 'food'], ['夜景の展望台', 2400, 2, 'sight']] },
    { id: 'kumamoto', name: '熊本', r: 'kyushu', lon: 130.71, lat: 32.79, lab: 'e', tag: '火の山のふもと、大きな城下町',
      props: [['いきなり団子屋', 400, -1, 'food'], ['馬刺し屋', 1200, -1, 'food'], ['火の山の牧場', 2000, 1, 'farm']] },
    { id: 'kagoshima', name: '鹿児島', r: 'kyushu', lon: 130.56, lat: 31.58, lab: 'w', tag: 'けむりをはく島を見上げて',
      props: [['黒豚しゃぶ屋', 1400, 3, 'food'], ['焼酎蔵', 1900, 2, 'craft'], ['砂むし温泉', 2500, 3, 'inn']] },
    { id: 'oita', name: '大分', r: 'kyushu', lon: 131.61, lat: 33.24, lab: 'e', tag: '湯けむりが、あちこちから',
      props: [['とり天屋', 500, -1, 'food'], ['かぼす畑', 600, 2, 'farm'], ['地獄めぐりの湯', 3000, 3, 'inn']] },
    { id: 'miyazaki', name: '宮崎', r: 'kyushu', lon: 131.42, lat: 31.91, lab: 'e', tag: '南国の光と、大きな夕日',
      props: [['地鶏の炭火焼屋', 800, -1, 'food'], ['マンゴー農園', 1800, 1, 'farm'], ['南国の海辺宿', 2500, 1, 'inn']] },
    // 東北
    { id: 'fukushima', name: '福島', r: 'tohoku', lon: 140.47, lat: 37.75, lab: 'w', tag: 'くだものの実る盆地',
      props: [['喜多方ラーメン屋', 600, -1, 'food'], ['桃畑', 1000, 1, 'farm'], ['会津の漆器工房', 1500, -1, 'craft']] },
    { id: 'sendai', name: '仙台', r: 'tohoku', lon: 140.88, lat: 38.26, lab: 'e', tag: '七夕の吹き流しと、杜の町',
      props: [['ずんだ餅屋', 500, 1, 'food'], ['七夕飾りの店', 1200, 1, 'fest'], ['牛たん屋', 1500, -1, 'food'], ['松島の遊覧船', 2500, 0, 'sight']] },
    { id: 'yamagata', name: '山形', r: 'tohoku', lon: 140.36, lat: 38.24, lab: 'w', tag: 'さくらんぼと、樹氷の山',
      props: [['芋煮会の河原', 400, 2, 'fest'], ['さくらんぼ園', 1200, 0, 'farm'], ['蔵王の樹氷スキー場', 3500, 3, 'snow']] },
    { id: 'morioka', name: '盛岡', r: 'tohoku', lon: 141.15, lat: 39.70, lab: 'e', tag: 'わんこそばと、鉄の器',
      props: [['わんこそば屋', 600, -1, 'food'], ['冷麺屋', 700, 1, 'food'], ['南部鉄器工房', 1800, -1, 'craft']] },
    { id: 'akita', name: '秋田', r: 'tohoku', lon: 140.10, lat: 39.72, lab: 'w', tag: '竿燈のあかりと、雪国の鍋',
      props: [['きりたんぽ屋', 500, 3, 'food'], ['竿燈まつりの桟敷', 1500, 1, 'fest'], ['角館の桜茶屋', 2000, 0, 'sight']] },
    { id: 'aomori', name: '青森', r: 'tohoku', lon: 140.74, lat: 40.82, lab: 'e', tag: 'りんごと、ねぶたの夏',
      props: [['ほたて漁', 1000, 3, 'sea'], ['りんご園', 1200, 2, 'farm'], ['ねぶた小屋', 2000, 1, 'fest']] },
    // 北海道
    { id: 'hakodate', name: '函館', r: 'hokkaido', lon: 140.73, lat: 41.77, lab: 'w', tag: '朝市と坂と、港の夜景',
      props: [['いか釣り船', 800, 1, 'sea'], ['朝市の海鮮丼屋', 1000, -1, 'sea'], ['函館山のロープウェイ', 2500, 3, 'sight']] },
    { id: 'sapporo', name: '札幌', r: 'hokkaido', lon: 141.35, lat: 43.06, lab: 'e', tag: '雪のまつりと、大通り',
      props: [['味噌ラーメン屋', 600, 3, 'food'], ['時計台の土産店', 1000, -1, 'craft'], ['雪まつりの雪像', 3000, 3, 'fest'], ['ビール園', 4000, 1, 'food']] },
    { id: 'otaru', name: '小樽', r: 'hokkaido', lon: 140.99, lat: 43.19, lab: 'w', tag: '運河の灯りと、ガラスの町',
      props: [['運河の灯り', 1000, 3, 'sight'], ['ガラス工房', 1500, -1, 'craft'], ['寿司屋通り', 2000, -1, 'sea']] },
    { id: 'asahikawa', name: '旭川', r: 'hokkaido', lon: 142.36, lat: 43.77, lab: 'n', tag: '北の動物たちと、花の丘',
      props: [['旭川ラーメン村', 700, 3, 'food'], ['富良野のラベンダー畑', 2000, 1, 'farm'], ['北の動物園', 3400, 1, 'sight']] },
    { id: 'obihiro', name: '帯広', r: 'hokkaido', lon: 143.20, lat: 42.92, lab: 'n', tag: 'どこまでもつづく、十勝の畑',
      props: [['豚丼屋', 600, -1, 'food'], ['十勝の小豆畑', 900, 2, 'farm'], ['牧場のチーズ工房', 1800, -1, 'craft']] },
    { id: 'kushiro', name: '釧路', r: 'hokkaido', lon: 144.38, lat: 42.98, lab: 's', tag: '霧の港と、湿原の鶴',
      props: [['炉端焼き屋', 800, -1, 'sea'], ['霧の港の市場', 1200, 2, 'sea'], ['湿原の丹頂ツアー', 2000, 3, 'sight']] },
  ];

  // ---------------------------------------------------------------- 路線
  // [駅A, 駅B, 途中の点（経度・緯度）, 関所（地方と地方のつなぎ目）]
  KR.LINES = [
    // 関東
    ['tokyo', 'yokohama', []],
    ['tokyo', 'chiba', []],
    ['chiba', 'mito', [[140.42, 35.95]]],
    ['tokyo', 'utsunomiya', [[139.78, 36.12]]],
    ['utsunomiya', 'mito', []],
    ['tokyo', 'takasaki', [[139.45, 36.0]]],
    ['takasaki', 'utsunomiya', [[139.45, 36.42]]],
    // 東海・甲斐
    ['yokohama', 'atami', [[139.32, 35.32], [139.15, 35.24]]],
    ['atami', 'shizuoka', [[138.86, 35.13], [138.62, 35.13]]],
    ['shizuoka', 'hamamatsu', [[138.02, 34.76]]],
    ['hamamatsu', 'nagoya', [[137.38, 34.8], [137.12, 34.98]]],
    ['tokyo', 'kofu', [[139.3, 35.66], [138.92, 35.62]]],
    ['kofu', 'shizuoka', [[138.47, 35.32]]],
    // 北陸・信州
    ['nagano', 'matsumoto', []],
    ['nagano', 'niigata', [[138.38, 37.12], [138.75, 37.52]]],
    ['nagano', 'toyama', [[138.12, 36.98], [137.82, 37.0], [137.5, 36.84]]],
    ['toyama', 'kanazawa', []],
    ['kanazawa', 'fukui', [[136.42, 36.34]]],
    // 近畿
    ['kyoto', 'osaka', []],
    ['osaka', 'kobe', []],
    ['osaka', 'nara', []],
    ['kyoto', 'nara', []],
    ['osaka', 'wakayama', [[135.34, 34.46]]],
    ['nara', 'ise', [[136.1, 34.56], [136.42, 34.5]]],
    // 中国
    ['himeji', 'okayama', [[134.3, 34.76]]],
    ['okayama', 'hiroshima', [[133.42, 34.52], [132.92, 34.44]]],
    ['hiroshima', 'shimonoseki', [[132.02, 34.08], [131.5, 34.04]]],
    ['himeji', 'tottori', [[134.5, 35.16]]],
    ['tottori', 'matsue', [[133.62, 35.47]]],
    ['matsue', 'okayama', [[133.42, 35.15], [133.72, 34.92]]],
    ['matsue', 'shimonoseki', [[132.42, 35.1], [131.82, 34.68], [131.3, 34.36]]],
    // 四国
    ['takamatsu', 'tokushima', [[134.35, 34.2]]],
    ['takamatsu', 'kochi', [[133.8, 34.0], [133.62, 33.78]]],
    ['takamatsu', 'matsuyama', [[133.6, 34.14], [133.2, 34.0], [132.96, 33.95]]],
    ['kochi', 'matsuyama', [[133.12, 33.56], [132.92, 33.66]]],
    // 九州
    ['hakata', 'nagasaki', [[130.2, 33.3], [130.0, 33.0]]],
    ['hakata', 'kumamoto', [[130.55, 33.25], [130.62, 33.0]]],
    ['kumamoto', 'kagoshima', [[130.55, 32.4], [130.42, 32.0]]],
    ['hakata', 'oita', [[130.82, 33.42], [131.2, 33.28]]],
    ['oita', 'miyazaki', [[131.76, 32.9], [131.62, 32.4]]],
    ['miyazaki', 'kagoshima', [[131.12, 31.78], [130.82, 31.7]]],
    ['kumamoto', 'oita', [[131.05, 32.96], [131.35, 33.1]]],
    // 東北
    ['fukushima', 'sendai', [[140.72, 38.0]]],
    ['fukushima', 'yamagata', [[140.3, 38.0]]],
    ['yamagata', 'sendai', []],
    ['sendai', 'morioka', [[141.12, 38.75], [141.16, 39.25]]],
    ['morioka', 'akita', [[140.62, 39.76]]],
    ['morioka', 'aomori', [[141.3, 40.2], [141.02, 40.6]]],
    ['yamagata', 'akita', [[140.3, 38.75], [140.18, 39.25]]],
    ['akita', 'aomori', [[140.3, 40.2], [140.56, 40.6]]],
    // 北海道
    ['hakodate', 'sapporo', [[140.62, 42.1], [140.4, 42.46], [140.96, 42.36], [141.5, 42.66], [141.5, 42.92]]],
    ['sapporo', 'otaru', []],
    ['sapporo', 'asahikawa', [[141.8, 43.36], [142.1, 43.6]]],
    ['sapporo', 'obihiro', [[141.82, 42.96], [142.4, 43.02], [142.8, 42.96]]],
    ['obihiro', 'kushiro', [[143.8, 42.92]]],
    ['asahikawa', 'obihiro', [[142.42, 43.36], [142.78, 43.1]]],
    // 関所（地方と地方のつなぎ目）。ひらいた会社のものになり、ほかの会社が通ると通行料が入る。
    ['takasaki', 'nagano', [[138.62, 36.4]], { id: 'usui', name: '碓氷峠', kind: 'tunnel' }],
    ['kofu', 'matsumoto', [[138.22, 35.9]], { id: 'shiojiri', name: '塩尻峠', kind: 'tunnel' }],
    ['nagoya', 'kyoto', [[136.55, 35.36], [136.2, 35.26]], { id: 'sekigahara', name: '関ケ原', kind: 'rail' }],
    ['nagoya', 'ise', [[136.62, 34.96], [136.58, 34.7]], { id: 'iseji', name: '伊勢路の鉄橋', kind: 'bridge' }],
    ['fukui', 'kyoto', [[136.07, 35.65], [135.92, 35.32]], { id: 'tsuruga', name: '敦賀のトンネル', kind: 'tunnel' }],
    ['kobe', 'himeji', [[134.98, 34.7]], { id: 'akashi', name: '明石の浜', kind: 'rail' }],
    ['okayama', 'takamatsu', [[133.82, 34.5], [133.86, 34.33]], { id: 'seto', name: '瀬戸の大橋', kind: 'bridge' }],
    ['kobe', 'tokushima', [[135.0, 34.58], [134.86, 34.36], [134.66, 34.22]], { id: 'naruto', name: '鳴門の大橋', kind: 'bridge' }],
    ['shimonoseki', 'hakata', [[130.86, 33.88], [130.62, 33.76]], { id: 'kanmon', name: '関門トンネル', kind: 'tunnel' }],
    ['matsuyama', 'oita', [[132.3, 33.52], [131.95, 33.36]], { id: 'hoyo', name: '豊予の連絡船', kind: 'ship' }],
    ['utsunomiya', 'fukushima', [[140.08, 37.0], [140.3, 37.36]], { id: 'shirakawa', name: '白河の関', kind: 'rail' }],
    ['niigata', 'akita', [[139.45, 38.2], [139.8, 38.85], [139.96, 39.35]], { id: 'uetsu', name: '羽越の海辺', kind: 'rail' }],
    ['aomori', 'hakodate', [[140.58, 41.05], [140.48, 41.3], [140.56, 41.6]], { id: 'seikan', name: '青函トンネル', kind: 'tunnel' }],
  ];

  // ---------------------------------------------------------------- きっぷ
  KR.CARDS = {
    kaisoku: { name: '快速きっぷ', short: '快速', w: 10, desc: 'このターン、サイコロが 2こに なる。', col: '#e9a23b' },
    tokkyu: { name: '特急きっぷ', short: '特急', w: 5, desc: 'このターン、サイコロが 3こに なる。', col: '#d8463b' },
    kakueki: { name: '各停きっぷ', short: '各停', w: 8, desc: '1〜6 のうち、すきな数だけ すすめる。ぴったり到着を ねらえる。', col: '#4a9e5c' },
    kaisuu: { name: '快速の回数券', short: '回数券', w: 3, desc: 'サイコロ 2こ。3回まで つかえる。', col: '#c9853a', uses: 3 },
    daruma: { name: '福だるま', short: '福だるま', w: 6, desc: 'すぐに お金が もらえる（季節が すすむほど 多い）。', col: '#d23c3c' },
    baishu: { name: '買収きっぷ', short: '買収', w: 4, desc: 'とまった駅で、ほかの会社の名物を 1.5倍の値段で 買いとれる（駅の画面で つかう）。', col: '#6f5bb5' },
    fumikiri: { name: 'ふみきり', short: 'ふみきり', w: 4, desc: 'えらんだ会社は つぎの番、きっぷが つかえず、出目が 1〜3 に なる。', col: '#e0b52f' },
    tobinori: { name: 'とびのりきっぷ', short: 'とびのり', w: 2, desc: 'サイコロを ふらずに、目的地と おなじ地方の どこかの駅へ とぶ。', col: '#2f8fc9' },
  };
  KR.HAND_MAX = 5;

  // ---------------------------------------------------------------- できごと
  // 効果：money（＋もらう / −はらう、季節で増える）, cost（先にはらう）, dice（サイコロの表 [[下,上,効果],...]）,
  //       card（きっぷの種類 / 'random'）, duel（ちかくの会社とサイコロ勝負）, fromRival（ちかくの会社から）, perProp（名物1けんごとに）
  KR.EVENTS = [
    { id: 'fukubiki', title: '駅前の福引き', icon: 'lottery', text: '駅前の商店街で、ガラガラの福引きをやっている。',
      ch: [{ label: '1回まわす', sub: '100万円', eff: { cost: 100, dice: [[6, 6, { money: 1500, say: '大当たり！' }], [4, 5, { money: 400, say: '当たり！' }], [1, 3, { say: 'ポケットティッシュだった。' }]] } },
        { label: 'やめておく', eff: { say: 'また こんど。' } }] },
    { id: 'koinu', title: '迷子の子犬', icon: 'dog', text: 'ホームの すみで、首輪をつけた子犬が ふるえている。',
      ch: [{ label: '飼い主をさがす', eff: { card: 'random', say: '飼い主が見つかった！ お礼に きっぷを もらった。' } },
        { label: '駅員さんにたのむ', eff: { money: 150, say: '駅員さんが 感心して、お茶代を くれた。' } }] },
    { id: 'hanami', title: 'お花見のにぎわい', icon: 'sakura', season: [0], text: '桜が満開。花見客で 駅が ごったがえしている。',
      ch: [{ label: '臨時列車を出す', eff: { money: 500, say: '満員御礼！' } },
        { label: '花見弁当を売る', sub: '200万円', eff: { cost: 200, dice: [[3, 6, { money: 900, say: '飛ぶように 売れた！' }], [1, 2, { money: 100, say: '雨がぱらついて、少しだけ 売れた。' }]] } }] },
    { id: 'natsumatsuri', title: '夏まつりの屋台', icon: 'lantern', season: [1], text: '駅前が 夏まつりで にぎわっている。屋台を出さないかと さそわれた。',
      ch: [{ label: '屋台を出す', sub: '300万円', eff: { cost: 300, dice: [[3, 6, { money: 1100, say: 'かき氷が 大人気！' }], [1, 2, { money: 150, say: '夕立で 早じまい…' }]] } },
        { label: '見物する', eff: { card: 'kaisoku', say: 'くじ引きで 快速きっぷが 当たった。' } }] },
    { id: 'taifu', title: '台風が近づいている', icon: 'typhoon', season: [1, 2], text: '大きな台風が 近づいている。どうする？',
      ch: [{ label: '線路を見まわる', sub: '200万円', eff: { cost: 200, say: '念入りに点検。ぶじに やりすごした。' } },
        { label: 'そのまま走る', eff: { dice: [[4, 6, { say: 'なんとか ぶじだった。' }], [1, 3, { money: -700, say: '倒木で 線路の修理代が…' }]] } }] },
    { id: 'ooyuki', title: 'ひと晩で大雪', icon: 'snow', season: [3], text: 'ひと晩で 線路が 雪にうもれた。',
      ch: [{ label: '雪かきをする', sub: '250万円', eff: { cost: 250, say: '朝までに 雪かき完了。' } },
        { label: '雪見列車を走らせる', eff: { dice: [[4, 6, { money: 900, say: '真っ白な景色に お客さん大よろこび！' }], [1, 3, { money: -400, say: '立ち往生して おわびの お弁当代が…' }]] } }] },
    { id: 'momiji', title: '紅葉狩りの団体さん', icon: 'momiji', season: [2], text: '紅葉を見にきた 団体さんが ホームに あふれている。',
      ch: [{ label: '増便する', eff: { money: 600, say: 'ありがとうの声が いっぱい。' } },
        { label: '観光案内をつける', eff: { card: 'tokkyu', say: 'お礼に 特急きっぷを もらった。' } }] },
    { id: 'onsen', title: '湯けむりの誘い', icon: 'onsen', season: [3, 2], text: '駅の となりに 足湯がある。ひと休みしたくなってきた。',
      ch: [{ label: 'ゆっくりつかる', eff: { card: 'kakueki', say: 'のんびりして、よく考えた。各停きっぷを もらった。' } },
        { label: '足湯の店を手伝う', eff: { money: 350, say: 'いい汗をかいた。' } }] },
    { id: 'ekiben', title: '駅弁コンテスト', icon: 'bento', text: 'この駅で、駅弁の コンテストが ひらかれる。',
      ch: [{ label: '出品する', sub: '200万円', eff: { cost: 200, dice: [[5, 6, { money: 1600, say: '優勝！ 予約が 殺到した！' }], [3, 4, { money: 500, say: '入賞！' }], [1, 2, { say: '惜しくも 選外…' }]] } },
        { label: '審査員になる', eff: { money: 200, say: 'おいしかった。お礼も もらった。' } }] },
    { id: 'kikanshi', title: 'むかしの機関士さん', icon: 'oldman', text: 'むかし この線を走っていた 機関士さんが 乗ってきた。',
      ch: [{ label: '話を聞く', eff: { card: 'kakueki', say: '「急がば回れ、じゃよ」 各停きっぷを くれた。' } },
        { label: '運転席を見せる', eff: { money: 300, say: 'なつかしいと 大よろこび。' } }] },
    { id: 'toushi', title: 'あやしい もうけ話', icon: 'fox', text: '「ぜったい もうかる話が あるんだがね…」',
      ch: [{ label: 'のってみる', sub: '500万円', eff: { cost: 500, dice: [[6, 6, { money: 3500, say: '本当に もうかった！' }], [1, 5, { say: 'やっぱり あやしい話だった…' }]] } },
        { label: 'ことわる', eff: { say: 'かしこい判断！' } }] },
    { id: 'aiseki', title: 'ライバルと相席', icon: 'duel', text: '食堂車で、{rival}と 相席になった。',
      ch: [{ label: 'サイコロ勝負', sub: '500万円をかけて', eff: { duel: 500 } },
        { label: '名刺を交換する', eff: { money: 200, say: 'なごやかに 情報交換。' } }] },
    { id: 'hanabi', title: '花火大会のスポンサー', icon: 'firework', season: [1], text: '川べりの花火大会で、スポンサーを さがしている。',
      ch: [{ label: 'スポンサーになる', sub: '400万円', eff: { cost: 400, dice: [[3, 6, { money: 1500, say: '会社の名前入りの 花火が 夜空に！' }], [1, 2, { money: 200, say: '雨で 半分しか あがらなかった。' }]] } },
        { label: '見物する', eff: { money: 100, say: 'きれいだった。' } }] },
    { id: 'takarakuji', title: '年末の宝くじ', icon: 'lottery', season: [2, 3], text: '駅前で 年末の宝くじを 売っている。',
      ch: [{ label: '1枚買う', sub: '100万円', eff: { cost: 100, dice: [[6, 6, { money: 2500, say: '大当たり！！' }], [5, 5, { money: 500, say: '当たった！' }], [1, 4, { say: 'はずれ…' }]] } },
        { label: '買わない', eff: { say: '夢は 線路で かなえる。' } }] },
    { id: 'ohenro', title: 'お遍路さん', icon: 'pilgrim', region: ['shikoku'], text: '白い装束の お遍路さんが ホームで 休んでいる。',
      ch: [{ label: 'お接待をする', sub: '100万円', eff: { cost: 100, card: 'random', say: 'お礼に きっぷを もらった。' } },
        { label: '見送る', eff: { money: 100, say: 'よい旅を。' } }] },
    { id: 'ryuhyo', title: '流氷がやってきた', icon: 'ice', region: ['hokkaido'], season: [3], text: '沖が 真っ白な流氷で うまっている。',
      ch: [{ label: '観光船を出す', sub: '300万円', eff: { cost: 300, dice: [[3, 6, { money: 1400, say: '流氷の上の あざらしに 歓声！' }], [1, 2, { money: 100, say: '霧で なにも 見えなかった。' }]] } },
        { label: '港で見る', eff: { money: 150, say: 'さむい！ でも きれい。' } }] },
    { id: 'ochimono', title: 'ライバルの落とし物', icon: 'wallet', text: '{rival}の 社長の 財布を ひろった。',
      ch: [{ label: '本人にとどける', eff: { fromRival: 300, say: '「たすかった！」 お礼を もらった。' } },
        { label: '駅の落とし物係へ', eff: { money: 100, say: '駅員さんに ほめられた。' } }] },
    { id: 'chumon', title: '名物の大口注文', icon: 'box', text: '遠くの町から「あなたの会社の名物を まとめて送って」と 注文が来た。',
      ch: [{ label: '引き受ける', eff: { perProp: 120, say: '持っている名物ごとに 売れた！' } },
        { label: 'ことわる', eff: { say: 'また こんど。' } }] },
    { id: 'fan', title: '鉄道ファンの集い', icon: 'camera', text: '鉄道ファンが 集まって、撮影会を ひらきたいと言っている。',
      ch: [{ label: '撮影会をひらく', eff: { money: 500, say: 'シャッター音が なりやまない。' } },
        { label: 'グッズを売る', eff: { dice: [[4, 6, { money: 1200, say: '完売！' }], [1, 3, { money: 200, say: 'ぼちぼち 売れた。' }]] } }] },
    { id: 'tsukimi', title: 'お月見列車', icon: 'moon', season: [2], text: 'まんまるの お月さま。お月見列車を 走らせよう。',
      ch: [{ label: 'お団子を配る', eff: { money: 500, say: '車内に 月の光が さしこむ。' } },
        { label: 'ゆっくり走らせる', eff: { card: 'kakueki', say: 'のんびり走って、各停きっぷを 手に入れた。' } }] },
    { id: 'sakuranbo', title: '実りの季節', icon: 'fruit', season: [0, 1], text: '沿線の くだもの畑が 実りの 季節。収穫を 手伝わないかと 声が かかった。',
      ch: [{ label: '手伝う', eff: { money: 400, say: 'おみやげも いっぱい。' } },
        { label: '直売所を出す', sub: '200万円', eff: { cost: 200, dice: [[3, 6, { money: 900, say: '行列が できた！' }], [1, 2, { money: 100, say: 'あまり 売れなかった。' }]] } }] },
    { id: 'kaisatsu', title: '新しい改札', icon: 'gate', text: '古い改札の 取りかえ時期。',
      ch: [{ label: 'ぴかぴかに新調', sub: '300万円', eff: { cost: 300, card: 'kaisuu', say: '記念に 回数券を つくった！' } },
        { label: 'まだ使う', eff: { say: 'ていねいに 手入れした。' } }] },
  ];

  // ---------------------------------------------------------------- ことば（こむぎの ひとこと・社長の せりふ）
  KR.LINES_TALK = {
    kon: {
      buy: ['この名物は いただきだ。', 'ふふん、先に いただくよ。', 'これは よい買いもの。'],
      arrive: ['一番乗りは ゆうぐれ急行！', 'まっすぐ来れば このとおり。'],
      mono: ['この駅は まるごと ゆうぐれ色。'],
      toll: ['通行料、まいど！'],
      card: ['ここで きっぷを 切らせてもらう。'],
      fumikiri: ['ちょっと 止まってもらおうか。'],
    },
    pon: {
      buy: ['ぽんと 買っちゃおう。', 'これも これも ほしいなあ。', 'いい名物だねえ。'],
      arrive: ['のんびり来たら 一番だった！', 'つきよ交通、とうちゃくー。'],
      mono: ['ぜんぶ そろうと うれしいねえ。'],
      toll: ['通行料、ありがたいねえ。'],
      card: ['とっておきを つかうよ。'],
      fumikiri: ['ごめんねえ、ちょっと 待っててね。'],
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
