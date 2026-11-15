"""
ひゅるり、凧びより ― ページを撮影する小さな道具（検証用）

  python tools/snap.py <ページ(game11からの相対パス)> <出力PNG> [幅] [高さ] [待ちミリ秒] [JS...]
ヘッドレスの Microsoft Edge で file:// から開き、全体を撮る。ページエラーとコンソールのエラーも表示する。
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main():
    page = sys.argv[1]
    out = sys.argv[2]
    w = int(sys.argv[3]) if len(sys.argv) > 3 else 1280
    h = int(sys.argv[4]) if len(sys.argv) > 4 else 720
    wait = int(sys.argv[5]) if len(sys.argv) > 5 else 500
    scripts = sys.argv[6:]
    url = (ROOT / page.split('?')[0]).as_uri() + ('?' + page.split('?')[1] if '?' in page else '')
    errs = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge', headless=True)
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console.' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.goto(url)
        pg.wait_for_timeout(wait)
        for s in scripts:
            r = pg.evaluate(s)
            if r is not None:
                print('js ->', str(r)[:600])
            pg.wait_for_timeout(150)
        pg.screenshot(path=out, full_page=True)
        b.close()
    for e in errs:
        print(e)


if __name__ == '__main__':
    main()
