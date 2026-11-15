# ONE PROMPT WORLDS

**ひとつのプロンプトから、ひとつの遊べる世界へ。**

「ついやってしまうゲーム」の面白さとは何か。
その仕組みを言語化したゲームデザイン資料をもとに、Claude がゲームの企画・実装・テスト・改善までを自律的に行っています。
人間からの指示は、基本的に最初の1プロンプトだけです。

このリポジトリは、そうして作られたブラウザゲームと、それらをまとめて遊べるギャラリーサイトです。

### ▶ [ギャラリーで遊ぶ](https://shioa2006-game.github.io/ONE_PROMPT_WORLDS/)

## 作品

| # | タイトル | ジャンル | 主な操作 | 制作AI |
| --- | --- | --- | --- | --- |
| 01 | [ぽん、と森は灯る](https://shioa2006-game.github.io/ONE_PROMPT_WORLDS/game/index.html) | 物理ショット・探索 | マウス | Claude Fable 5.2 |
| 02 | [ひとつぶ庭園](https://shioa2006-game.github.io/ONE_PROMPT_WORLDS/game2/index.html) | 粒の箱庭パズル | マウス | Claude Fable 5.2 |
| 03 | [EMBERDEEP ― 燈守りの坑道](https://shioa2006-game.github.io/ONE_PROMPT_WORLDS/game3/index.html) | トップダウン・アクションRPG | キーボード＋マウス | Claude Fable 5.2 |
| 04 | [LUMEN REEL ― まわる灯台と三つの海路](https://shioa2006-game.github.io/ONE_PROMPT_WORLDS/game4/index.html) | リール構築パズル | キーボード＋マウス | Claude Fable 5.2 |
| 05 | [REEL DELVE ― まわる迷宮と三人の旅](https://shioa2006-game.github.io/ONE_PROMPT_WORLDS/game5/index.html) | 目押しダンジョン探索 | キーボード＋マウス | Claude Fable 5.2 |
| 06 | [うしろのハニワ](https://shioa2006-game.github.io/ONE_PROMPT_WORLDS/game6/index.html) | 視線の一人称ダンジョン | キーボード | Claude Fable 5.2 |
| 07 | [切りもどし](https://shioa2006-game.github.io/ONE_PROMPT_WORLDS/game7/index.html) | 剪定パズル | マウス＋キーボード | Claude Fable 5.2 |

- **ぽん、と森は灯る**：胞子をとばすと、落ちた場所にキノコが生えます。生えたキノコを次の発射台にして、くらい森を灯しながら奥の大樹をめざします。
- **ひとつぶ庭園**：砂・水・種・火種の四つの粒をびんに注ぎ、粒どうしの反応だけで、小さな夜の庭を咲かせます。
- **EMBERDEEP**：ランタンひとつで闇の坑道へ潜ります。火鉢を灯してカゲと戦い、区画ごと闇を払いながら最深部をめざします。
- **LUMEN REEL**：灯台のリールを回して海路に光を送り、迷った舟を港へ帰します。夜明けの工房でリールを組み替えながら、五つの夜を越えます。
- **REEL DELVE**：止めたリールの3段が、そのまま三人の冒険者の通り道になります。回して下見し、目押しで狙った並びに止めて、地下12階の底をめざします。
- **うしろのハニワ**：見ているあいだは動かず、背を向けると寄ってくるハニワ。古墳の石室を一人称視点で歩き、視線だけで台座まで連れていきます。
- **切りもどし**：枝を切ると切り口から二つの芽が吹き、春を呼ぶと伸びる盆栽の剪定パズル。鋏ひとつで木の形を決めて、ひだまりに花を咲かせます。

各作品は PC のブラウザ（Chrome / Edge 推奨）で遊ぶことを想定しています。音が出ます。
操作やあそびかたの詳細は、各フォルダの README（[game](game/README.md) / [game2](game2/README.md) / [game3](game3/README.md) / [game4](game4/README.md) / [game5](game5/README.md) / [game6](game6/README.md) / [game7](game7/README.md)）にあります。

> [!WARNING]
> 各フォルダには、攻略・ネタバレを含む資料（`NOTES_ネタバレ注意.md`、`NETABARE*.md`、`VERIFICATION_検証記録.md`）や検証用の `tools/` も入っています。初めて遊ぶ前には開かないことをおすすめします。

## ローカルで動かす

外部ライブラリやビルドは不要で、静的ファイルだけで動きます。リポジトリ直下で次を実行し、<http://127.0.0.1:8000/> を開いてください。

```bash
python -m http.server 8000 --bind 127.0.0.1
```

`index.html` をブラウザで直接開いても動きます。

## フォルダ構成

```
index.html                  ギャラリーのトップページ
assets/
  css/style.css             スタイル
  js/games.js               作品リスト（ここを編集すると作品が増える）
  js/main.js                カードの組み立てと背景の演出
  thumbs/                   サムネイル（実際のゲーム画面、16:9）
game/  game2/  game3/  game4/  game5/  game6/  game7/   各作品（それぞれ index.html から起動）
Fable52_Autonomous_Game_Design_Prompt.md   制作に使った基本指示書
.nojekyll                   GitHub Pages でファイルをそのまま配信するための空ファイル
```

## 作品を追加する

1. 新しいゲームを `game4/` のようなフォルダに置きます（`game4/index.html` で起動する形）。
2. ゲーム画面のスクリーンショットを 16:9 で撮り、1280×720 と 640×360 の WebP にして `assets/thumbs/` に置きます。
3. `assets/js/games.js` の配列の末尾に、作品の情報を1件追加します。

```js
{
  title: '作品名',
  genre: 'ジャンル',
  description: '1〜2行の紹介文（ネタバレは書かない）',
  path: 'game4/index.html',
  thumbnail: 'assets/thumbs/game4.webp',
  thumbnailSmall: 'assets/thumbs/game4-640.webp',
  controls: 'マウス',
  ai: 'Claude Fable 5.2',
  accent: '#8ecbff'
}
```

並び順がそのまま表示順になり、「WORLD 04」の番号と作品数は自動で更新されます。
パスはすべて相対パスで書いてください（先頭に `/` を付けない）。GitHub Pages のプロジェクトサイトでもそのまま動きます。

## 公開

GitHub Pages で、`main` ブランチの `/ (root)` を公開しています。
`main` に push すると、数分でサイトに反映されます。
