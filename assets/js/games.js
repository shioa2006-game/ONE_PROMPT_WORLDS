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
  }
];
