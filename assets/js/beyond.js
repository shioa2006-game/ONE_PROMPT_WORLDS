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
    version: '0.1',
    updatedDate: '2026-11-19',
    changelog: 'https://github.com/shioa2006-game/ONE_PROMPT_WORLDS/blob/main/beyond1/CHANGELOG.md',
    thumbnail: 'assets/thumbs/beyond1.webp',
    thumbnailSmall: 'assets/thumbs/beyond1-640.webp',
    thumbnailAlt: '「賽駆け 天下」のプレイ画面。大名ごとに 色分けされた 四国から奥羽までの 日本地図で、北条家の軍勢が 進める マスが 水色に光り、武田軍との 合戦の 勝つ見込み 83% と、駿府城での 内政（徴兵・開墾・築城）の 小窓が 表示されている。右下には 振った4つの サイコロ。',
    controls: 'マウス',
    ai: 'Claude Opus 5.5',
    accent: '#e3b955'
  }
];
