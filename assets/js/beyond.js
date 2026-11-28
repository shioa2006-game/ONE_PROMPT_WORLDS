/*
 * ONE PROMPT WORLDS — BEYOND ONE PROMPT の作品リスト（改修版）
 *
 * WORLDS（games.js）の原型は、1回の指示文で出力されたまま残します。
 * 改修したくなったら、原型のフォルダ（例: game3/）を beyondN/ にコピーし、そちらを直していきます。
 *
 * 作品を増やすときは、この配列の末尾にオブジェクトを1つ追加するだけです。
 *   - フォルダ名は beyond1/ beyond2/ … の着手順の連番にします（原型の番号とはそろえない）。
 *     カードの「BEYOND 01」などの番号は、フォルダ名の数字から自動で付きます。
 *   - status が 'released' の作品は「完成」、それ以外は「開発中」の欄に並びます。
 *   - basedOn に原型のフォルダ名を書くと、WORLDS 側の原型カードに案内バッジが付きます。
 *   - パスはすべて beyond.html からの相対パスで書きます（先頭に / を付けない）。
 *   - サムネイルは 16:9 の実際のゲーム画面。1280×720 と 640×360 の2枚を用意します。
 *
 * 項目
 *   title          作品名（必須）
 *   subtitle       副題（任意）
 *   genre          ジャンル
 *   description    1〜2行の紹介文（ネタバレは書かない）
 *   path           ゲームの起動ページ（例: 'beyond1/index.html'）
 *   basedOn        原型のフォルダ名の配列（例: ['game3']。複数の原型をまとめた場合は複数書く）
 *   status         'dev'（開発中）または 'released'（完成）
 *   version        バージョン（例: '0.1'。完成で '1.0'）
 *   updatedDate    最終更新日（YYYY-MM-DD 形式）
 *   changelog      更新履歴のURL（任意。例: GitHub 上の beyond1/CHANGELOG.md）
 *   thumbnail      サムネイル 1280×720
 *   thumbnailSmall サムネイル 640×360（任意。なければ thumbnail を使う）
 *   thumbnailAlt   画像の代替テキスト（任意）
 *   controls       主な操作（例: 'マウス'）
 *   ai             制作AI
 *   accent         カードのアクセント色
 *
 * 例
 *   {
 *     title: '作品名',
 *     genre: 'ジャンル',
 *     description: '1〜2行の紹介文（ネタバレは書かない）',
 *     path: 'beyond1/index.html',
 *     basedOn: ['game3'],
 *     status: 'dev',
 *     version: '0.1',
 *     updatedDate: '2026-11-20',
 *     changelog: 'https://github.com/shioa2006-game/ONE_PROMPT_WORLDS/blob/main/beyond1/CHANGELOG.md',
 *     thumbnail: 'assets/thumbs/beyond1.webp',
 *     thumbnailSmall: 'assets/thumbs/beyond1-640.webp',
 *     controls: 'マウス',
 *     ai: 'Claude Opus 5.5',
 *     accent: '#ffb85c'
 *   }
 */
window.OPW_BEYOND = [
  {
    title: '賽駆け 天下',
    subtitle: '戦国すごろく全国版',
    genre: 'サイコロ行軍・全国国盗り',
    description: '永禄三年、奥羽から九州までの 八十五か国に 五十九の大名家が ひしめく。賽の目を 軍勢に配り、進軍させるか、城で 徴兵・開墾・築城を 命じるか。十年ごとの区切りを 延長しながら、天下統一を めざす。',
    path: 'beyond1/index.html',
    basedOn: ['game15'],
    status: 'dev',
    version: '0.5',
    updatedDate: '2026-11-22',
    changelog: 'https://github.com/shioa2006-game/ONE_PROMPT_WORLDS/blob/main/beyond1/CHANGELOG.md',
    thumbnail: 'assets/thumbs/beyond1.webp',
    thumbnailSmall: 'assets/thumbs/beyond1-640.webp',
    thumbnailAlt: '瀬戸内海を挟んで中国・四国の城と軍勢が並ぶ。毛利家が安芸の軍勢に二つの賽を割り当て、進軍できるマスが水色に光っている。',
    controls: 'マウス',
    ai: 'Claude Opus 5.5',
    accent: '#e3b955'
  },
  {
    title: 'GUILDWARD',
    genre: 'ギルドRPG・クォータービュー攻略',
    description: '丘の町カザミの 冒険者ギルド「風見鶏」。正式な冒険者に なったばかりの 少年斥候リコが、依頼板から 依頼を選び、同行する 仲間を 二人 選んで 出かける。押す、凍らせる、吹き飛ばす。連れていく 仲間しだいで、攻略の 道すじが 変わる。腕だめしの 印を 集め、仲間に お守りを 持たせ、こなした 依頼にも 別の 二人で 挑める。第一章を 終えたら、雪の 峠を こえる 第二章へ。',
    path: 'beyond2/index.html',
    basedOn: ['game21'],
    status: 'dev',
    version: '0.3.1',
    updatedDate: '2026-11-29',
    changelog: 'https://github.com/shioa2006-game/ONE_PROMPT_WORLDS/blob/main/beyond2/CHANGELOG.md',
    thumbnail: 'assets/thumbs/beyond2.webp',
    thumbnailSmall: 'assets/thumbs/beyond2-640.webp',
    thumbnailAlt: '「GUILDWARD」のタイトル画面。夕焼けの丘に浮かぶ小さな高台に、斥候リコ・重戦士ガルド・氷の術師セナと荷馬車が並び、右上で金色の風見鶏が回っている。',
    controls: 'マウス',
    ai: 'Claude Opus 5.5',
    accent: '#e8c860'
  }
];
