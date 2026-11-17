/*
 * ONE PROMPT WORLDS — 作品リスト
 *
 * ゲームを増やすときは、この配列の末尾にオブジェクトを1つ追加するだけです。
 *   - 並び順がそのまま表示順になり、「WORLD 01」などの番号も自動で振られます。
 *   - パスはすべて index.html からの相対パスで書きます（先頭に / を付けない）。
 *     GitHub Pages のプロジェクトサイト（/<リポジトリ名>/）でもそのまま動きます。
 *   - サムネイルは 16:9 の実際のゲーム画面。1280×720 と 640×360 の2枚を用意します。
 *
 * 項目
 *   title          作品名（必須）
 *   subtitle       副題（任意）
 *   genre          ジャンル
 *   description    1〜2行の紹介文（ネタバレは書かない）
 *   path           ゲームの起動ページ（例: 'game4/index.html'）
 *   thumbnail      サムネイル 1280×720
 *   thumbnailSmall サムネイル 640×360（任意。なければ thumbnail を使う）
 *   thumbnailAlt   画像の代替テキスト（任意）
 *   controls       主な操作（例: 'マウス'）
 *   ai             制作AI
 *   createdDate    作成日（任意。YYYY-MM-DD 形式）
 *   accent         カードのアクセント色
 */
window.OPW_GAMES = [
  {
    title: 'ぽん、と森は灯る',
    genre: '物理ショット・探索',
    description: '胞子をとばすと、落ちた場所にキノコが生える。生えたキノコを次の発射台にして、くらい森を灯しながら奥の大樹をめざす。',
    path: 'game/index.html',
    thumbnail: 'assets/thumbs/pon-forest.webp',
    thumbnailSmall: 'assets/thumbs/pon-forest-640.webp',
    thumbnailAlt: '「ぽん、と森は灯る」のプレイ画面。夜の森でキノコを引っぱると、胞子の軌道が点線で表示される。',
    controls: 'マウス',
    ai: 'Claude Fable 5.2',
    createdDate: '2026-11-14',
    accent: '#86e8c0'
  },
  {
    title: 'ひとつぶ庭園',
    genre: '粒の箱庭パズル',
    description: '砂・水・種・火種。四つの粒をびんの口から注ぎ、粒どうしの反応だけで、びんの中に小さな夜の庭を咲かせる。',
    path: 'game2/index.html',
    thumbnail: 'assets/thumbs/hitotsubu-teien.webp',
    thumbnailSmall: 'assets/thumbs/hitotsubu-teien-640.webp',
    thumbnailAlt: '「ひとつぶ庭園」のプレイ画面。月夜のびんに水を注ぎ、くぼみの花がひらいている。',
    controls: 'マウス',
    ai: 'Claude Fable 5.2',
    createdDate: '2026-11-14',
    accent: '#ffa8d4'
  },
  {
    title: 'EMBERDEEP',
    subtitle: '燈守りの坑道',
    genre: 'トップダウン・アクションRPG',
    description: 'ランタンひとつで闇の坑道へ。火鉢を灯してカゲと戦い、区画ごと闇を払いながら、最深部の炉心をめざす。',
    path: 'game3/index.html',
    thumbnail: 'assets/thumbs/emberdeep.webp',
    thumbnailSmall: 'assets/thumbs/emberdeep-640.webp',
    thumbnailAlt: '「EMBERDEEP ― 燈守りの坑道」のプレイ画面。坑道の灯りのそばで、主人公が剣を振る。',
    controls: 'キーボード＋マウス',
    ai: 'Claude Fable 5.2',
    createdDate: '2026-11-14',
    accent: '#ffb85c'
  },
  {
    title: 'LUMEN REEL',
    subtitle: 'まわる灯台と三つの海路',
    genre: 'リール構築パズル',
    description: '灯台のリールを回し、部品を並べて三つの海路に光を送る。迷った舟を港へ帰し、夜明けの工房でリールを組み替えながら五つの夜を越える。',
    path: 'game4/index.html',
    thumbnail: 'assets/thumbs/lumen-reel.webp',
    thumbnailSmall: 'assets/thumbs/lumen-reel-640.webp',
    thumbnailAlt: '「LUMEN REEL」のプレイ画面。灯台のリールから月夜の三つの海路へ光を放つ。',
    controls: 'キーボード＋マウス',
    ai: 'Claude Fable 5.2',
    createdDate: '2026-11-15',
    accent: '#ffd166'
  },
  {
    title: 'REEL DELVE',
    subtitle: 'まわる迷宮と三人の旅',
    genre: '目押しダンジョン探索',
    description: '止めたリールの3段が、そのまま三人の冒険者の通り道になる。回して下見し、目押しで狙った並びに止めて、地下12階の底をめざす。',
    path: 'game5/index.html',
    thumbnail: 'assets/thumbs/reel-delve.webp',
    thumbnailSmall: 'assets/thumbs/reel-delve-640.webp',
    thumbnailAlt: '「REEL DELVE」のプレイ画面。五本のリールの窓に並んだ3段を、剣士・盗賊・魔導士が歩いて金貨を拾う。',
    controls: 'キーボード＋マウス',
    ai: 'Claude Fable 5.2',
    createdDate: '2026-11-15',
    accent: '#e2b657'
  },
  {
    title: 'うしろのハニワ',
    genre: '視線の一人称ダンジョン',
    description: '見ているあいだは動かず、背を向けると「ゴト」と寄ってくる。古墳の石室を一人称視点で歩き、目をさましたハニワを視線だけで台座まで連れていく。',
    path: 'game6/index.html',
    thumbnail: 'assets/thumbs/ushiro-haniwa.webp',
    thumbnailSmall: 'assets/thumbs/ushiro-haniwa-640.webp',
    thumbnailAlt: '「うしろのハニワ」のプレイ画面。朱の文様が描かれた石の通路の先に、片腕を上げた赤いハニワが立っている。',
    controls: 'キーボード',
    ai: 'Claude Fable 5.2',
    createdDate: '2026-11-15',
    accent: '#e0764a'
  },
  {
    title: '切りもどし',
    subtitle: '鋏と春の小さな鉢',
    genre: '剪定パズル',
    description: '枝を切ると、切り口から二つの芽が吹く。春を呼ぶと、芽がのびる。鋏ひとつで木の形を決めて、ひだまりに花を咲かせる。',
    path: 'game7/index.html',
    thumbnail: 'assets/thumbs/kirimodoshi.webp',
    thumbnailSmall: 'assets/thumbs/kirimodoshi-640.webp',
    thumbnailAlt: '「切りもどし」のプレイ画面。和紙の上の鉢植えに鋏を当てると、切り落とす枝が朱色で示される。',
    controls: 'マウス＋キーボード',
    ai: 'Claude Fable 5.2',
    createdDate: '2026-11-15',
    accent: '#c8452f'
  },
  {
    title: 'ひつじが いっぴき',
    subtitle: '牧羊犬コロの一日',
    genre: '群れ追いアクション',
    description: 'マウスの先へ走る牧羊犬になって、ひつじの群れを小屋まで送りとどける。歩けば群れは まとまって進み、走れば おどろいて散る。朝から夜まで、九つの牧場をまわる。',
    path: 'game8/index.html',
    thumbnail: 'assets/thumbs/hitsuji-ga-ippiki.webp',
    thumbnailSmall: 'assets/thumbs/hitsuji-ga-ippiki-640.webp',
    thumbnailAlt: '「ひつじが いっぴき」のプレイ画面。朝の牧場で、白黒の牧羊犬が ひつじの群れを柵の切れ目へ押していく。',
    controls: 'マウス',
    ai: 'Claude Fable 5.2',
    createdDate: '2026-11-15',
    accent: '#a8d283'
  },
  {
    title: 'そこから、そら',
    subtitle: '井戸のカエルと 五つの層',
    genre: '縦穴ブロックくずし',
    description: '井戸の底のカエルになって、玉をはね返し、頭の上の岩をくずして空をめざす。ささえを失った岩は かたまりごと がらがらっと落ちる。五つの層に、むかしの だれかの おとしものが眠っている。',
    path: 'game9/index.html',
    thumbnail: 'assets/thumbs/sokokara-sora.webp',
    thumbnailSmall: 'assets/thumbs/sokokara-sora-640.webp',
    thumbnailAlt: '「そこから、そら」のプレイ画面。井戸の中で、石の橋が はぜ石の爆発で まるごと崩れ落ち、「がらがらっ ×30」と表示される。下では カエルが 玉を はね返している。',
    controls: 'マウス',
    ai: 'Claude Opus 5.5',
    createdDate: '2026-11-15',
    accent: '#8cc8f0'
  },
  {
    title: 'ぐるり、夜まつり',
    subtitle: 'ゆいと 妖の 参道',
    genre: 'なぞりパズル・バトル',
    description: '同じ玉を なぞって つなぎ、なぞりはじめに もどれば「輪」。紅白のひもで 妖（あやかし）を ぐるっと囲むと、ともだちになって 行列に ついてくる。夏まつりの夜、妖で いっぱいの参道をぬけて 社をめざす。',
    path: 'game10/index.html',
    thumbnail: 'assets/thumbs/gururi-yomatsuri.webp',
    thumbnailSmall: 'assets/thumbs/gururi-yomatsuri-640.webp',
    thumbnailAlt: '「ぐるり、夜まつり」のプレイ画面。鳥居の下の盤で、小判の玉を 紅白のひもで なぞって輪にし、中の鬼火を 囲んでいる。左には 浴衣の女の子と、ともだちになった妖の行列。',
    controls: 'マウス',
    ai: 'Claude Opus 5.5',
    createdDate: '2026-11-16',
    accent: '#ff7b8f'
  },
  {
    title: 'ひゅるり、凧びより',
    subtitle: 'ちびつむじと お正月の村',
    genre: 'まきこみ成長アクション',
    description: 'ちいさな つむじ風になって、じぶんより ちいさなものを まきこみ、おおきくなる。まわるものを「ドン」と ぶつければ、やたいも 門も こわせる。にわから 村、かわら、おかへと ひろがる お正月の村で、子どもたちの 凧を 空へ あげる。',
    path: 'game11/index.html',
    thumbnail: 'assets/thumbs/hyururi-takobiyori.webp',
    thumbnailSmall: 'assets/thumbs/hyururi-takobiyori-640.webp',
    thumbnailAlt: '「ひゅるり、凧びより」のプレイ画面。のぼりや 屋台が ならぶ お正月の 村の通りを、ちいさな つむじ風が かどまつや 自転車を まきこみながら すすむ。そばには みかんを つんだ 軽トラと たぬきの 置物。',
    controls: 'マウス',
    ai: 'Claude Opus 5.5',
    createdDate: '2026-11-16',
    accent: '#7fc4e8'
  },
  {
    title: 'ころころ、ひらけ列島',
    subtitle: '三つの鉄道と にっぽん開通すごろく',
    genre: '鉄道すごろく',
    description: 'サイコロで 日本の 線路を 走り、目的地に 一番乗りすると、雲の 向こうの 地方を ひとつ ひらける。ひらいた 地方への 関所は 自分のもの。駅で 名物を 集め、季節の 決算で ふやしながら、きつねと たぬきの 鉄道会社と 1年を 競う。',
    path: 'game12/index.html',
    thumbnail: 'assets/thumbs/korokoro-hirake.webp',
    thumbnailSmall: 'assets/thumbs/korokoro-hirake-640.webp',
    thumbnailAlt: '「ころころ、ひらけ列島」のプレイ画面。紅葉した 中国地方と 九州の 鉄道地図を、柴犬・きつね・たぬきの 三つの 列車が 走る。となりの 四国は「未開通」の 雲に おおわれ、うどん・渦潮・いで湯 の 名物だけが 見えている。',
    controls: 'マウス',
    ai: 'Claude Opus 5.5',
    createdDate: '2026-11-16',
    accent: '#ff9a6b'
  },
  {
    title: 'からり、国盗り',
    subtitle: '賽の目 戦国絵巻',
    genre: 'サイコロ国盗り戦略',
    description: '1560年秋、桶狭間のあと。二十の大名から ひとりを選び、サイコロを振って 国を治め、隣国へ攻めこむ。表の目で攻め、裏の目で治める ―― 大きい目は いくさに、小さい目は 内政に強い。出た目を どの国の 何に使うか。20季のうちに 天下人をめざす。',
    path: 'game13/index.html',
    thumbnail: 'assets/thumbs/karari-kunitori.webp',
    thumbnailSmall: 'assets/thumbs/karari-kunitori-640.webp',
    thumbnailAlt: '「からり、国盗り」のプレイ画面。左に 勢力ごとに 色分けされた 中部・近畿20国の地図、右に 織田信長の 采配パネル。尾張・美濃・三河・遠江駿河が 金色に ふちどられ、下には 振ったサイコロが ならぶ。',
    controls: 'マウス',
    ai: 'Claude Fable 5.2',
    createdDate: '2026-11-17',
    accent: '#e0a23a'
  }
];
