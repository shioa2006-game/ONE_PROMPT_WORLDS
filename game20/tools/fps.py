# 迎撃中のフレーム数を測る（いちばん敵の多い 5-2 で、×1 と ×3）
# 使い方: python tools/fps.py
import json, os
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file:///' + os.path.join(ROOT, 'index.html').replace('\\', '/')
SOL = json.load(open(os.path.join(ROOT, 'tools', 'solutions.json'), encoding='utf-8'))

with sync_playwright() as p:
    br = p.chromium.launch(channel='msedge')
    pg = br.new_page(viewport={'width': 1280, 'height': 720})
    pg.goto(URL)
    pg.wait_for_timeout(400)
    pg.evaluate('localStorage.clear(); K20.goto(4, 1)')
    pg.evaluate('K20.setPl(%s)' % json.dumps(SOL['5-2']))
    pg.wait_for_timeout(200)
    bs = pg.evaluate('K20.buttons()')
    b = [x for x in bs if x['key'] == 'start'][0]
    pg.mouse.click(b['x'], b['y'])
    for sp in (1, 3):
        pg.evaluate(f'K20.G.speed = {sp}')
        pg.wait_for_timeout(8000 if sp == 1 else 3000)
        r = pg.evaluate("""() => new Promise(res => { let n = 0; const t0 = performance.now();
            function f() { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res({ fps: n / 3, t: K20.G.st ? K20.G.st.t : null, enemies: K20.G.st ? K20.G.st.enemies.filter(e => K20.S.alive(e)).length : 0 }); }
            requestAnimationFrame(f); })""")
        print('speed', sp, r)
    br.close()
