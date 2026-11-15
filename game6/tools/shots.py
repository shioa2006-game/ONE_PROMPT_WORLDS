# 画面確認用：ヘッドレスの Edge でゲームを開き、検証用の入口(__hb)を操作して PNG を保存する。
#   python tools/shots.py 出力フォルダ "名前=JS式" "名前=JS式" ...
# JS式は順に評価され、そのたびに1枚保存する。コンソールのエラーも表示する。
import sys, os, pathlib
from playwright.sync_api import sync_playwright

out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
steps = [a.split('=', 1) for a in sys.argv[2:]]
url = pathlib.Path(__file__).resolve().parent.parent.joinpath('index.html').as_uri()
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto(url)
    pg.wait_for_timeout(400)
    for name, js in steps:
        r = pg.evaluate(js)
        pg.wait_for_timeout(350)
        pg.screenshot(path=str(out / (name + '.png')))
        print(name, '->', r)
    for e in errs: print('CONSOLE:', e)
    b.close()
