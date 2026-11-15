"""
ぐるり、夜まつり ― 画面の撮影（検証用）

使い方：
  python tools/shot.py <出力フォルダ> <手順ファイル.json>
手順ファイルは [{"js": "...", "wait": ミリ秒, "shot": "名前"}, ...] の配列。
  js    … ページ内で実行する JavaScript（G10 などが使える）
  click … [x, y]（1280×720 の座標）で 本物の クリック
  drag  … [[x,y], [x,y], ...] を 本物の マウスで なぞる
  up    … true で マウスの ボタンを はなす（drag の norelease と くみあわせる）
  key   … キー名（例 "Escape"）
  wait  … 待つ時間（ミリ秒）
  shot  … 画面を PNG で 保存する名前
ヘッドレスの Microsoft Edge（1280×720）で file:// から開く。localStorage は 毎回 まっさら。
"""
import json, sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri()


def run(out_dir, steps, log=print):
    out = pathlib.Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge', headless=True)
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.goto(URL)
        pg.wait_for_timeout(400)
        box = pg.locator('canvas').bounding_box()
        sx, sy = box['width'] / 1280, box['height'] / 720

        def pt(x, y):
            return box['x'] + x * sx, box['y'] + y * sy
        for st in steps:
            if 'js' in st:
                r = pg.evaluate(st['js'])
                if r is not None:
                    log('js ->', json.dumps(r, ensure_ascii=False)[:400])
            if 'click' in st:
                x, y = pt(*st['click'])
                pg.mouse.move(x, y)
                pg.mouse.down(); pg.wait_for_timeout(40); pg.mouse.up()
            if 'drag' in st:
                pts = st['drag']
                x, y = pt(*pts[0])
                pg.mouse.move(x, y); pg.mouse.down()
                for q in pts[1:]:
                    x, y = pt(*q)
                    pg.mouse.move(x, y, steps=st.get('steps', 6))
                    pg.wait_for_timeout(st.get('dwell', 40))
                if st.get('hold'):
                    pg.wait_for_timeout(st['hold'])
                if not st.get('norelease'):
                    pg.mouse.up()
            if st.get('up'):
                pg.mouse.up()
            if 'move' in st:
                x, y = pt(*st['move'])
                pg.mouse.move(x, y, steps=4)
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
    errs = run(sys.argv[1], steps)
    print('errors:', len(errs))
