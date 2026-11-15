"""
ひゅるり、凧びより ― 画面の撮影（検証用）

  python tools/shot.py <出力フォルダ> <手順ファイル.json>
手順は [{"js": "...", "wait": ミリ秒, "shot": "名前", "click": [x,y], "move": [x,y], "key": "Escape", "frames": n}, ...]
  js     … ページ内で実行（G11 が使える）。戻り値は表示する
  frames … G11.debug.hold 中に n フレームだけ すすめる（1/60秒きざみ）
ヘッドレスの Microsoft Edge（1280×720）で file:// から開く。localStorage は毎回まっさら。
"""
import json, sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri()


def run(out_dir, steps, log=print, w=1280, h=720):
    out = pathlib.Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge', headless=True)
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.goto(URL)
        pg.wait_for_timeout(500)
        for st in steps:
            if 'js' in st:
                r = pg.evaluate(st['js'])
                if r is not None:
                    log('js ->', json.dumps(r, ensure_ascii=False)[:500])
            if 'frames' in st:
                pg.evaluate('n => G11.debug.run(n)', st['frames'])
            if 'click' in st:
                pg.mouse.move(*st['click']); pg.mouse.down(); pg.wait_for_timeout(30); pg.mouse.up()
            if 'move' in st:
                pg.mouse.move(*st['move'], steps=3)
            if 'key' in st:
                pg.keyboard.press(st['key'])
            if 'wait' in st:
                pg.wait_for_timeout(st['wait'])
            if 'shot' in st:
                pg.screenshot(path=str(out / (st['shot'] + '.png')))
                log('shot', st['shot'])
        b.close()
    for e in errors:
        log(e)
    return errors


if __name__ == '__main__':
    steps = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding='utf-8'))
    run(sys.argv[1], steps)
