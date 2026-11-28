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
  },
  {
    title: '天下賽配',
    subtitle: '戦国サイコロ国盗り',
    genre: '采配ダイス国盗り戦略',
    description: '永禄三年秋、中部・近畿の二十国。振った賽を 一つずつ 国に置いて、その場で 命令を下す。表の目は 攻めの力、裏の目（7−出目）は 政（まつりごと）の力 ―― 6は いくさに、1は 内政と調略に強い。奇襲、備え、包囲網。十九家の大名と 競いながら、二十季のうちに 最大の勢力を築く。',
    path: 'game14/index.html',
    thumbnail: 'assets/thumbs/tenka-saihai.webp',
    thumbnailSmall: 'assets/thumbs/tenka-saihai-640.webp',
    thumbnailAlt: '「天下賽配」のプレイ画面。左に 勢力ごとに 色分けされた 中部・近畿20国の地図、右に 上杉謙信の 采配パネル。越後が 金色に ふちどられ、上には 振った4つのサイコロと それぞれの 攻めと政の値が ならぶ。',
    controls: 'マウス',
    ai: 'Claude Opus 5.5',
    createdDate: '2026-11-18',
    accent: '#c9a24a'
  },
  {
    title: '賽駆け',
    subtitle: '戦国・賽振り行軍記',
    genre: 'サイコロ行軍・領土争奪',
    description: '永禄三年、中国から関東までの四十九か国。賽を振り、出た目を 自分の軍勢に 一つずつ配って 日本地図の上を 進軍させる。敵の城の隣に 陣取り、味方で囲んで 加勢し、ぴったりの目で 奇襲する。八家の大名と 競いながら、京を含む十八か国の 天下布武をめざす。',
    path: 'game15/index.html',
    thumbnail: 'assets/thumbs/saigake.webp',
    thumbnailSmall: 'assets/thumbs/saigake-640.webp',
    thumbnailAlt: '「賽駆け」のプレイ画面。勢力ごとに 色分けされた 中国から関東までの 日本地図で、上杉家の軍勢が 進める マスが 水色に光り、北条の城への 城攻めの 勝つ見込み 83% が 表示されている。右下には 振った4つの サイコロ。',
    controls: 'マウス',
    ai: 'Claude Opus 5.5',
    createdDate: '2026-11-18',
    accent: '#d0503a'
  },
  {
    title: 'くるり、呪いほどき',
    subtitle: '魔法陣リールと灰の王国',
    genre: 'リール構築バトル',
    description: '灰の魔女に 呪われた王国。床の魔法陣が まるごと リールになっていて、止まった紋の上に立つ魔物は、詠唱で 人にもどる。同じ紋が となり合えば つながりになり、上に立つ魔物を まとめて救える。▲▼で 一コマずらして つながりを狙い、救った人々に もらった紋で 自分のリールを 組んで育てる。',
    path: 'game16/index.html',
    thumbnail: 'assets/thumbs/kururi-noroihodoki.webp',
    thumbnailSmall: 'assets/thumbs/kururi-noroihodoki-640.webp',
    thumbnailAlt: '「くるり、呪いほどき」のプレイ画面。夜の王都で、5本のリールが ならぶ 床の魔法陣。▲で 2本のリールを ずらすと 光の紋が 8個 つながり、その上に立つ 魔物3体に「ほどける」の 見こみが 出ている。左には 杖を持った 魔法使いと、人に もどった 村人たち。',
    controls: 'マウス',
    ai: 'Claude Opus 5.5',
    createdDate: '2026-11-22',
    accent: '#b48cff'
  },
  {
    title: 'ずらり、砦くずし',
    subtitle: '詠唱盤と黒鉄の街道',
    genre: 'リール詠唱・砦攻め',
    description: '魔王軍が 街道に 黒鉄の砦を 建てた。言葉を刻んだ リールを回すと、止まった横一行が そのまま 呪文になり、三本の道へ 飛んでいく。▲▼で 一コマずらせば 言葉が 隣の行へ 移り、呪文の形と 行き先が 変わる。救った人々に もらった言葉で 自分の詠唱盤を 組んで育て、砦を まとめて 崩していく。',
    path: 'game17/index.html',
    thumbnail: 'assets/thumbs/zurari-toridekuzushi.webp',
    thumbnailSmall: 'assets/thumbs/zurari-toridekuzushi-640.webp',
    thumbnailAlt: '「ずらり、砦くずし」のプレイ画面。風の丘で、源・形・力の リールが ならぶ 詠唱盤。▼で 2本のリールを ずらすと、上の道へ「炎・貫く・二倍・二度」の 呪文が 向かい、その先の 砦に「崩れる！」の 見こみが 出ている。下の道は 砦が 崩れて 青い旗が 立ち、村人が 歩いている。',
    controls: 'マウス',
    ai: 'Claude Opus 5.5',
    createdDate: '2026-11-23',
    accent: '#f0a848'
  },
  {
    title: 'がらり、迷宮ひらき',
    subtitle: '詠唱輪と地図の空白',
    genre: 'リール詠唱・迷宮探索',
    description: 'だれも底を見たことがない 大穴。地図描きの 見習いミオは、師匠の地図の いちばん下の「空白」を 描きに 降りていく。リールの横の行に 同じ紋を そろえると、呪文が 魔物を 手前から 貫き、余った力が 奥の壁に 届く。茨は炎、湖は氷。撃ちぬいた先が、地図の 新しい道になる。',
    path: 'game18/index.html',
    thumbnail: 'assets/thumbs/garari-meikyuhiraki.webp',
    thumbnailSmall: 'assets/thumbs/garari-meikyuhiraki-640.webp',
    thumbnailAlt: '「がらり、迷宮ひらき」のプレイ画面。根の坑道の 茨の間で、3本のリールの 中の行に 炎が 三つ そろい「炎×3 6」。三つの段の 小鬼と 茨っこの 上に「倒す」、中の段の 奥の 茨の壁に「燃える！」の 見こみが 出ている。',
    controls: 'マウス',
    ai: 'Claude Opus 5.5',
    createdDate: '2026-11-23',
    accent: '#8ec8a0'
  },
  {
    title: 'せーの、星見の露台へ',
    subtitle: '三人で行く、大洞の遠征',
    genre: 'クォータービュー探索・戦術',
    description: '町はずれの 大穴「大洞」の底に、火を入れれば 町からも見える 大灯籠が ある。盾の戦士ガルド、斥候リコ、氷の術師セナの 三人で、段差と 谷と 水を 読みながら 降りていく。ガルドが 押し、リコが 縄をかけ、セナが 凍らせる。道が ひらけると、新しく 行ける床に 光の波が 走る。',
    path: 'game19/index.html',
    thumbnail: 'assets/thumbs/seeno-hoshiminorodai.webp',
    thumbnailSmall: 'assets/thumbs/seeno-hoshiminorodai-640.webp',
    thumbnailAlt: '「せーの、星見の露台へ」のプレイ画面。斜め上から見た 大洞の入口で、ガルドが 押した 木箱が 高い段の 下に落ちて 足場になり、上の段の 草地に 光の波が 走っている。「道がひらけた！ 新しく 24 マスに行ける」の 文字と、下に 三人の札と「木箱が段の下へ落ちて、足場になった」の 字幕。',
    controls: 'マウス',
    ai: 'Claude Opus 5.5',
    createdDate: '2026-11-23',
    accent: '#9db4ff'
  },
  {
    title: 'STAIRWARD',
    subtitle: '峠の砦と五つの夜',
    genre: 'クォータービュー防衛・配置',
    description: '峠の 古い砦に、焼け出された 村の人たちが 逃げこんだ。雪が ゆるむまで あと五日。石段・門・崖道から 迫る 夜の群れを 予兆で読み、盾のイルザや 火のルゥたち 仲間の 持ち場を 決めたら、あとは 見届けるだけ。先頭を 受け止め、詰まった列を まとめて焼く。守れなかったら、一人だけ 持ち場を 変えて すぐ やり直せる。',
    path: 'game20/index.html',
    thumbnail: 'assets/thumbs/stairward.webp',
    thumbnailSmall: 'assets/thumbs/stairward-640.webp',
    thumbnailAlt: '「STAIRWARD」のプレイ画面。斜め上から見た 夜の砦。石段の 踊り場で 盾のイルザが 小鬼の列の 先頭を 受け止め、すぐ上の 城壁から ルゥの 火球が 列に落ちて「×4」。ルゥの「ぜんぶ、燃えろーっ！」の 吹き出しと、右上に「受けて、焼く　新しい連携！ イルザ×ルゥ」の 見出し。門の上では 弓のカイが、坂道を のぼる 小鬼を 狙っている。',
    controls: 'マウス',
    ai: 'Claude Opus 5.5',
    createdDate: '2026-11-23',
    accent: '#ffc46a'
  },
  {
    title: 'だれと行く？',
    subtitle: '風見鶏ギルドの依頼帳',
    genre: 'ギルドRPG・クォータービュー攻略',
    description: '丘の町カザミの 冒険者ギルド「風見鶏」。今日 はじめて 冒険者の札を もらった 斥候リコが、依頼板から 依頼を選び、同行する 仲間を 二人 選んで 出かける。押す、凍らせる、吹き飛ばす。連れていく 仲間しだいで、使える手と 攻略の 道すじが 変わる。帰るたびに 報酬と 新しい依頼が 届き、ギルドの広間が にぎやかに なっていく。',
    path: 'game21/index.html',
    thumbnail: 'assets/thumbs/dareto-iku.webp',
    thumbnailSmall: 'assets/thumbs/dareto-iku-640.webp',
    thumbnailAlt: '「だれと行く？」のプレイ画面。斜め上から見た 夕暮れの 川辺の村。左の崖の上で トビが 発破すると、大岩が 転がって 橋を わたってきた 盗っ人小鬼を なぎ倒し、「×2 まとめて倒した！」の 文字。下に リコ・ガルド・トビの 札と、「爆風で大岩が転がり、2体をなぎ倒した」の 字幕。',
    controls: 'マウス',
    ai: 'Claude Opus 5.5',
    createdDate: '2026-11-28',
    accent: '#e8c860'
  }
];
