# がらり、迷宮ひらき — 画面の撮影（Playwright + Edge ヘッドレス）
# 使い方: python tools/shot.py OUT_DIR steps.json
# steps: [{"js": "..."}, {"btn": "main"}, {"room": "s1_hall"}, {"click": [x, y]}, {"key": "Space"}, {"wait": 500}, {"idle": 3}, {"shot": "name"}]
#   btn: GR18.buttons() の key か label を探して、その中心を本物のマウスで押す
#   room: 地図の部屋を本物のマウスで押す（カメラをその部屋へ向けてから）
#   idle: 演出が終わるまで待つ（最大 N 秒）
import json, os, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file:///' + os.path.join(ROOT, 'index.html').replace('\\', '/')


def run(out, steps, vw=1280, vh=720, query=''):
    os.makedirs(out, exist_ok=True)
    errs = []
    with sync_playwright() as p:
        br = p.chromium.launch(channel='msedge')
        pg = br.new_page(viewport={'width': vw, 'height': vh})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        pg.goto(URL + query)
        pg.wait_for_timeout(400)

        def to_px(x, y):
            r = pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width / 1280]; })()")
            return r[0] + x * r[2], r[1] + y * r[2]

        for st in steps:
            if 'js' in st:
                v = pg.evaluate(st['js'])
                if st.get('print'):
                    print(json.dumps(v, ensure_ascii=False))
            elif 'btn' in st:
                name = st['btn']
                pg.wait_for_timeout(120)
                bs = pg.evaluate('GR18.buttons()')
                hit = [b for b in bs if b['key'] == name] or [b for b in bs if b['label'] == name]
                if not hit:
                    print('no button', name, [b['key'] or b['label'] for b in bs][:60])
                    continue
                b = hit[-1]
                x, y = to_px(b['x'], b['y'])
                pg.mouse.move(x, y)
                pg.mouse.down(); pg.mouse.up()
            elif 'room' in st:
                pg.evaluate(f"GR18.camTo('{st['room']}')")
                pg.wait_for_timeout(150)
                r = pg.evaluate(f"GR18.roomXY('{st['room']}')")
                x, y = to_px(r['x'], r['y'])
                pg.mouse.move(x, y)
                pg.mouse.down(); pg.mouse.up()
            elif 'click' in st:
                x, y = to_px(*st['click'])
                pg.mouse.move(x, y)
                pg.mouse.down(button=st.get('button', 'left')); pg.mouse.up(button=st.get('button', 'left'))
            elif 'move' in st:
                x, y = to_px(*st['move'])
                pg.mouse.move(x, y)
            elif 'key' in st:
                pg.keyboard.press(st['key'])
            elif 'wait' in st:
                pg.wait_for_timeout(st['wait'])
            elif 'idle' in st:
                t0 = time.time()
                pg.wait_for_timeout(150)
                while time.time() - t0 < st['idle'] and pg.evaluate('GR18.busy()'):
                    pg.wait_for_timeout(80)
                pg.wait_for_timeout(st.get('after', 200))
            elif 'shot' in st:
                pg.screenshot(path=os.path.join(out, st['shot'] + '.png'))
        br.close()
    if errs:
        print('ERRORS:', *errs, sep='\n  ')
    else:
        print('no page errors')


if __name__ == '__main__':
    out = sys.argv[1]
    steps = json.load(open(sys.argv[2], encoding='utf-8'))
    vw = int(os.environ.get('VW', 1280)); vh = int(os.environ.get('VH', 720))
    run(out, steps, vw, vh, os.environ.get('Q', ''))
