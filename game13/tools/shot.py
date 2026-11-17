# 画面の確認用：手順（JSON）を実行してスクリーンショットを残す
#   python tools/shot.py 出力フォルダ 手順.json
# 手順は [{"js": "..."}, {"click": "ボタンid"}, {"prov": 国番号}, {"key": "Space"}, {"wait": 秒}, {"shot": "名前"}] の並び
import sys, json, os, time
from playwright.sync_api import sync_playwright

out = sys.argv[1]
steps = json.load(open(sys.argv[2], encoding='utf-8'))
os.makedirs(out, exist_ok=True)
url = 'file:///' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html')).replace('\\', '/')

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(url)
    pg.wait_for_function('window.K13 && K13.st')
    for s in steps:
        if 'js' in s:
            r = pg.evaluate(s['js'])
            if s.get('print'): print(json.dumps(r, ensure_ascii=False))
        elif 'click' in s:
            bs = pg.evaluate('K13.debug.buttons()')
            hit = [x for x in bs if x['id'] == s['click']]
            if not hit: print('ボタンなし:', s['click'], [x['id'] for x in bs])
            else: pg.mouse.click(hit[0]['x'], hit[0]['y'])
        elif 'prov' in s:
            q = pg.evaluate('K13.debug.prov(%d)' % s['prov'])
            pg.mouse.click(q['x'], q['y'])
        elif 'hover' in s:
            q = pg.evaluate('K13.debug.prov(%d)' % s['hover'])
            pg.mouse.move(q['x'], q['y'])
        elif 'key' in s: pg.keyboard.press(s['key'])
        elif 'wait' in s: time.sleep(s['wait'])
        elif 'shot' in s: pg.screenshot(path=os.path.join(out, s['shot'] + '.png'))
        time.sleep(s.get('after', 0.12))
    if errs: print('ERRORS:', errs[:10])
    b.close()
