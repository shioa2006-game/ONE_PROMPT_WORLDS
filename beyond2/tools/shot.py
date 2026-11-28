# GUILDWARD — 画面の撮影（Playwright + Edge ヘッドレス）
# 使い方: python tools/shot.py OUT_DIR steps.json
# steps: [{"js": "..."}, {"script": "tools/plans_lib.js"}, {"btn": "new"}, {"wheel": 120}, {"cell": [x, y]}, {"hovercell": [x, y]}, {"unit": "gard"}, {"obj": "o3"},
#         {"click": [x, y]}, {"move": [x, y]}, {"key": "Space"}, {"wait": 500}, {"idle": 3}, {"shot": "name"}]
#   cell/unit/obj: 升・人・物の画面位置を G19 から聞いて、本物のマウスで押す
#   idle: 演出が終わるまで待つ（最大 N 秒）
import json, os, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file:///' + os.path.join(ROOT, 'index.html').replace('\\', '/')


def run(out, steps, vw=1280, vh=720, query=''):
    os.makedirs(out, exist_ok=True)
    errs = []
    logs = []
    with sync_playwright() as p:
        br = p.chromium.launch(channel='msedge')
        pg = br.new_page(viewport={'width': vw, 'height': vh})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else logs.append(m.text))
        pg.goto(URL + query)
        pg.wait_for_timeout(400)

        def to_px(x, y):
            r = pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width / 1280]; })()")
            return r[0] + x * r[2], r[1] + y * r[2]

        def press_at(x, y, button='left', hover_only=False):
            px, py = to_px(x, y)
            pg.mouse.move(px, py)
            pg.wait_for_timeout(60)
            if not hover_only:
                pg.mouse.down(button=button)
                pg.mouse.up(button=button)

        for st in steps:
            if 'js' in st:
                v = pg.evaluate(st['js'])
                if st.get('print'):
                    print(json.dumps(v, ensure_ascii=False))
            elif 'btn' in st:
                name = st['btn']
                pg.wait_for_timeout(120)
                bs = pg.evaluate('G21.buttons()')
                hit = [b for b in bs if b['key'] == name] or [b for b in bs if b['label'] == name]
                if not hit:
                    print('no button', name, [b['key'] for b in bs][:60])
                    continue
                b = hit[-1]
                press_at(b['x'], b['y'])
            elif 'cell' in st or 'hovercell' in st:
                c = st.get('cell') or st.get('hovercell')
                r = pg.evaluate(f"G21.cellScreen({c[0]}, {c[1]})")
                press_at(r['x'], r['y'] + st.get('dy', 0), hover_only='hovercell' in st)
            elif 'unit' in st or 'hoverunit' in st:
                u = st.get('unit') or st.get('hoverunit')
                r = pg.evaluate(f"G21.unitScreen('{u}')")
                if not r:
                    print('no unit', u)
                    continue
                press_at(r['x'] + st.get('dx', 0), r['y'] + st.get('dy', 0), hover_only='hoverunit' in st)
            elif 'obj' in st or 'hoverobj' in st:
                o = st.get('obj') or st.get('hoverobj')
                r = pg.evaluate(f"G21.objScreen('{o}')")
                if not r:
                    print('no obj', o)
                    continue
                press_at(r['x'] + st.get('dx', 0), r['y'] + st.get('dy', 0), hover_only='hoverobj' in st)
            elif 'clickjs' in st or 'hoverjs' in st:
                r = pg.evaluate(st.get('clickjs') or st.get('hoverjs'))
                if not r:
                    print('no point', st)
                    continue
                press_at(r['x'], r['y'], hover_only='hoverjs' in st)
            elif 'click' in st:
                press_at(*st['click'], button=st.get('button', 'left'))
            elif 'move' in st:
                press_at(*st['move'], hover_only=True)
            elif 'wheel' in st:
                # ホイール（v0.3：鍛冶屋の一覧を送る確認）。マウスの位置は、その前の move／hover のまま
                pg.mouse.wheel(0, st['wheel'])
            elif 'key' in st:
                pg.keyboard.press(st['key'])
            elif 'wait' in st:
                pg.wait_for_timeout(st['wait'])
            elif 'idle' in st:
                t0 = time.time()
                pg.wait_for_timeout(150)
                while time.time() - t0 < st['idle'] and pg.evaluate('G21.busy()'):
                    pg.wait_for_timeout(80)
                pg.wait_for_timeout(st.get('after', 200))
            elif 'script' in st:
                # 検証用のスクリプトをページに読みこむ（例: tools/bot.js・tools/plans_lib.js）
                pg.add_script_tag(path=os.path.join(ROOT, st['script']))
            elif 'shot' in st:
                pg.screenshot(path=os.path.join(out, st['shot'] + '.png'))
        br.close()
    if errs:
        print('ERRORS:', *errs[:20], sep='\n  ')
    else:
        print('no page errors')


if __name__ == '__main__':
    out = sys.argv[1]
    steps = json.load(open(sys.argv[2], encoding='utf-8'))
    q = sys.argv[3] if len(sys.argv) > 3 else ''
    vw = int(os.environ.get('VW', '1280'))
    vh = int(os.environ.get('VH', '720'))
    run(out, steps, vw, vh, q)
