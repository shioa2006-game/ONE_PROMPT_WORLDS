"""賽駆け — 画面の撮影（Playwright, Edge headless）
   python tools/shot.py out.png [steps.json]
   steps: [{"js": "..."}, {"click": [x, y]}, {"key": "Space"}, {"wait": ms}, {"shot": "name.png"}, {"move": [x, y]}]
   VW / VH 環境変数で画面サイズを変えられる（既定 1600x900）"""
import sys
import json
import os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'file:///' + os.path.join(os.path.dirname(HERE), 'index.html').replace(os.sep, '/')
out = sys.argv[1]
steps = json.load(open(sys.argv[2], encoding='utf-8')) if len(sys.argv) > 2 else []
W = int(os.environ.get('VW', 1600))
H = int(os.environ.get('VH', 900))
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge')
    pg = b.new_page(viewport={'width': W, 'height': H})
    logs = []
    pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
    pg.goto(URL)
    pg.wait_for_timeout(1200)
    outdir = os.path.dirname(out)
    for st in steps:
        if 'js' in st:
            r = pg.evaluate(st['js'])
            print('js->', json.dumps(r, ensure_ascii=False)[:800])
        if 'click' in st:
            pg.mouse.click(*st['click'])
        if 'clickjs' in st:
            xy = pg.evaluate(st['clickjs'])
            print('clickjs ->', xy)
            if xy:
                pg.mouse.move(xy[0], xy[1])
                pg.wait_for_timeout(80)
                pg.mouse.click(xy[0], xy[1])
        if 'move' in st:
            pg.mouse.move(*st['move'])
        if 'key' in st:
            pg.keyboard.press(st['key'])
        if 'wait' in st:
            pg.wait_for_timeout(st['wait'])
        if 'shot' in st:
            pg.screenshot(path=os.path.join(outdir, st['shot']))
    pg.screenshot(path=out)
    for line in logs:
        print(line)
    b.close()
