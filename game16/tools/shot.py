"""くるり、呪いほどき — 画面の撮影（Playwright + Edge headless）
   python tools/shot.py out.png [steps.json]
   steps の書式（上から順に実行）:
     {"js": "..."}            ページで JS を評価して結果を表示
     {"btn": "id"}            KR16.buttons() のボタンを本物のマウスでクリック
     {"click": [x, y]}        ゲーム内座標（1280x720）をクリック
     {"rclick": [x, y]}       右クリック
     {"move": [x, y]}         マウスを動かす
     {"key": "Space"}         キーを押す
     {"wait": ms}             待つ
     {"idle": ms}             演出が終わるまで待つ（最大 ms）
     {"shot": "name.png"}     撮影（out と同じフォルダへ）
   VW / VH 環境変数で画面サイズを変えられる（既定 1280x720）"""
import sys
import json
import os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'file:///' + os.path.join(os.path.dirname(HERE), 'index.html').replace(os.sep, '/')
W = int(os.environ.get('VW', 1280))
H = int(os.environ.get('VH', 720))


def to_page(pg, x, y):
    r = pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
    return r[0] + x * r[2] / 1280, r[1] + y * r[3] / 720


def run(pg, steps, outdir, verbose=True):
    for st in steps:
        if 'js' in st:
            r = pg.evaluate(st['js'])
            if verbose:
                print('js->', json.dumps(r, ensure_ascii=False)[:1200])
        if 'btn' in st:
            bs = pg.evaluate('KR16.buttons()')
            b = next((b for b in bs if b['id'] == st['btn']), None)
            if not b:
                print('no button', st['btn'], [x['id'] for x in bs])
            else:
                px, py = to_page(pg, b['x'], b['y'])
                pg.mouse.move(px, py)
                pg.wait_for_timeout(60)
                pg.mouse.click(px, py)
        if 'click' in st:
            px, py = to_page(pg, *st['click'])
            pg.mouse.move(px, py)
            pg.wait_for_timeout(40)
            pg.mouse.click(px, py)
        if 'rclick' in st:
            px, py = to_page(pg, *st['rclick'])
            pg.mouse.click(px, py, button='right')
        if 'move' in st:
            px, py = to_page(pg, *st['move'])
            pg.mouse.move(px, py)
        if 'key' in st:
            pg.keyboard.press(st['key'])
        if 'wait' in st:
            pg.wait_for_timeout(st['wait'])
        if 'idle' in st:
            t = 0
            while t < st['idle']:
                pg.wait_for_timeout(100)
                t += 100
                if not pg.evaluate('KR16.busy()'):
                    break
        if 'shot' in st:
            pg.screenshot(path=os.path.join(outdir, st['shot']))


if __name__ == '__main__':
    out = sys.argv[1]
    steps = json.load(open(sys.argv[2], encoding='utf-8')) if len(sys.argv) > 2 else []
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge')
        pg = b.new_page(viewport={'width': W, 'height': H})
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        pg.goto(URL)
        pg.wait_for_timeout(800)
        run(pg, steps, os.path.dirname(os.path.abspath(out)))
        pg.screenshot(path=out)
        for line in logs:
            print(line)
        b.close()
