# STAIRWARD — 画面の撮影（Playwright + Edge ヘッドレス、1280×720）
# 使い方: python tools/shot.py OUT_DIR steps.json
# steps: [{"js": "..."}, {"btn": "start"}, {"slot": "s_land"}, {"hoverslot": "w_sw"}, {"card": "ilza"},
#         {"drag": ["ilza", "s_land"]}, {"rclick_slot": "s_land"}, {"click": [x, y]}, {"move": [x, y]},
#         {"key": "Enter"}, {"wait": 500}, {"until": "K20.state().scene === 'result'", "max": 60}, {"shot": "name"}]
#   btn: K20.buttons() の key（または label）で、本物のマウスで押す
#   slot: 持ち場の画面位置を K20 から聞いて、本物のマウスで押す
import json, os, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file:///' + os.path.join(ROOT, 'index.html').replace('\\', '/')


def run(out, steps, vw=1280, vh=720, query='', keep_save=False):
    os.makedirs(out, exist_ok=True)
    errs = []
    logs = []
    with sync_playwright() as p:
        br = p.chromium.launch(channel='msedge')
        pg = br.new_page(viewport={'width': vw, 'height': vh})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else logs.append(m.text))
        pg.goto(URL + query)
        pg.wait_for_timeout(500)

        def to_px(x, y):
            r = pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width / 1280]; })()")
            return r[0] + x * r[2], r[1] + y * r[2]

        def press_at(x, y, button='left', hover_only=False):
            px, py = to_px(x, y)
            pg.mouse.move(px, py)
            pg.wait_for_timeout(70)
            if not hover_only:
                pg.mouse.down(button=button)
                pg.wait_for_timeout(30)
                pg.mouse.up(button=button)
                pg.wait_for_timeout(50)

        def find_btn(name):
            bs = pg.evaluate('K20.buttons()')
            hit = [b for b in bs if b['key'] == name] or [b for b in bs if b['label'] == name]
            return hit[-1] if hit else None, bs

        for st in steps:
            if 'js' in st:
                v = pg.evaluate(st['js'])
                if st.get('print'):
                    print(json.dumps(v, ensure_ascii=False))
            elif 'btn' in st:
                pg.wait_for_timeout(120)
                b, bs = find_btn(st['btn'])
                if not b:
                    print('no button', st['btn'], [x['key'] for x in bs][:60])
                    continue
                press_at(b['x'], b['y'])
            elif 'card' in st:
                b, bs = find_btn('card_' + st['card'])
                if b:
                    press_at(b['x'], b['y'])
                else:
                    print('no card', st['card'])
            elif 'slot' in st or 'hoverslot' in st or 'rclick_slot' in st:
                sid = st.get('slot') or st.get('hoverslot') or st.get('rclick_slot')
                r = pg.evaluate(f"K20.slotScreen('{sid}')")
                press_at(r['x'], r['y'], button='right' if 'rclick_slot' in st else 'left', hover_only='hoverslot' in st)
            elif 'drag' in st:
                ally, sid = st['drag']
                b, bs = find_btn('card_' + ally)
                r = pg.evaluate(f"K20.slotScreen('{sid}')")
                x0, y0 = to_px(b['x'], b['y'])
                x1, y1 = to_px(r['x'], r['y'])
                pg.mouse.move(x0, y0); pg.mouse.down()
                for i in range(1, 11):
                    pg.mouse.move(x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10)
                    pg.wait_for_timeout(16)
                pg.mouse.up()
                pg.wait_for_timeout(60)
            elif 'click' in st:
                press_at(st['click'][0], st['click'][1])
            elif 'move' in st:
                press_at(st['move'][0], st['move'][1], hover_only=True)
            elif 'key' in st:
                pg.keyboard.press(st['key'])
                pg.wait_for_timeout(60)
            elif 'wait' in st:
                pg.wait_for_timeout(st['wait'])
            elif 'until' in st:
                t0 = time.time()
                while time.time() - t0 < st.get('max', 60):
                    if pg.evaluate(st['until']):
                        break
                    pg.wait_for_timeout(100)
                else:
                    print('timeout until', st['until'])
            elif 'shot' in st:
                path = os.path.join(out, st['shot'] + '.png')
                pg.screenshot(path=path)
                print('shot', path)
        st = pg.evaluate('K20.state()')
        print('state', json.dumps(st, ensure_ascii=False))
        br.close()
    for e in errs:
        print('ERR', e)
    return errs


if __name__ == '__main__':
    out = sys.argv[1]
    steps = json.load(open(sys.argv[2], encoding='utf-8'))
    vw = int(os.environ.get('VW', 1280))
    vh = int(os.environ.get('VH', 720))
    q = os.environ.get('Q', '')
    run(out, steps, vw, vh, q)
