# CLAUDE.md

## 言語

- ユーザーとのやりとりは、すべて日本語で行うこと（返答、質問、進捗の報告、作業の要約など）。
- コミットメッセージ・README・コード内のコメントなど、リポジトリに残す文章も原則として日本語で書く。

## このリポジトリについて

- ONE PROMPT WORLDS：Claude が基本的に1プロンプトで自律制作したブラウザゲームのギャラリー。GitHub Pages（`main` ブランチの `/ (root)`）で公開している。
  - 公開URL：https://shioa2006-game.github.io/ONE_PROMPT_WORLDS/
- トップページは `index.html` と `assets/`。作品の追加は `assets/js/games.js` に1件足す（手順は README.md）。
- 静的ファイルのみで動かす。パスはすべて相対パス（先頭に `/` を付けない）。

## 守ること

- `game/`・`game2/`・`game3/` など既存のゲーム本体は、指示がない限り変更しない。
- 攻略・ネタバレ資料（`NOTES_*.md`、`NETABARE*.md`、`VERIFICATION_*.md`、`tools/`）の内容をトップページや README に載せない。
- push や GitHub の設定変更は、ユーザーに頼まれたときだけ行う。
