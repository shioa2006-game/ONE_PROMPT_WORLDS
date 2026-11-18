# CLAUDE.md

## 言語

- ユーザーとのやりとりは、すべて日本語で行うこと（返答、質問、進捗の報告、作業の要約など）。
- コミットメッセージ・README・コード内のコメントなど、リポジトリに残す文章も原則として日本語で書く。

## このリポジトリについて

- ONE PROMPT WORLDS：Claude が基本的に1プロンプトで自律制作したブラウザゲームのギャラリー。GitHub Pages（`main` ブランチの `/ (root)`）で公開している。
  - 公開URL：https://shioa2006-game.github.io/ONE_PROMPT_WORLDS/
- トップページは `index.html` と `assets/`。作品の追加は `assets/js/games.js` に1件足す（手順は README.md）。
- ギャラリーは2タブ構成。
  - WORLDS（`index.html`、`gameN/`、`assets/js/games.js`）：1回の指示文で出力されたゲーム（原型）だけを置く。
  - BEYOND ONE PROMPT（`beyond.html`、`beyondN/`、`assets/js/beyond.js`）：原型をコピーして改修し、完成品をめざす作品を置く。開発中のものも並べる。
- 静的ファイルのみで動かす。パスはすべて相対パス（先頭に `/` を付けない）。

## 守ること

- `game/`・`game2/`・`game3/` など既存のゲーム本体は、指示がない限り変更しない。
- 原型（`gameN/`）は1回の指示文で出力されたまま残す（例外は致命的なバグの修正だけ）。改修するときは原型を `beyondN/`（着手順の連番）にコピーし、そちらを直す。
- 改修版の更新履歴（`beyondN/CHANGELOG.md`）と `beyond.js` の紹介文にネタバレを書かない。
- 攻略・ネタバレ資料（`NOTES_*.md`、`NETABARE*.md`、`VERIFICATION_*.md`、`tools/`）の内容をトップページや README に載せない。
- push や GitHub の設定変更は、ユーザーに頼まれたときだけ行う。
