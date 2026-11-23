# 持ち場の旗を本物のマウスで指したとき、狙った持ち場が選ばれるか（高低差・城壁の重なりのずれの確認）
# 使い方: python tools/pickcheck.py
#   各持ち場について、旗の根もと・足もと・人物の胴のあたり・左右に少しずらした点を指し、
#   ゲームが「いま指している持ち場」と判断したものを記録する。座標は 1280×720 の画面で。
import os
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file:///' + os.path.join(ROOT, 'index.html').replace('\\', '/')

with sync_playwright() as p:
    br = p.chromium.launch(channel='msedge')
    pg = br.new_page(viewport={'width': 1280, 'height': 720})
    pg.goto(URL)
    pg.wait_for_timeout(400)
    pg.evaluate('localStorage.clear(); K20.goto(4, 1)')
    pg.wait_for_timeout(300)
    ids = pg.evaluate('K20.D.SLOTS.map(s => s.id)')
    bad = []
    total = 0
    for sid in ids:
        r = pg.evaluate(f"K20.slotScreen('{sid}')")
        for (dx, dy, tag) in ((0, 0, 'flag'), (0, 8, 'foot'), (0, -16, 'body'), (-8, 4, 'left'), (8, 4, 'right')):
            pg.mouse.move(r['x'] + dx, r['y'] + dy)
            pg.wait_for_timeout(40)
            got = pg.evaluate('K20.G.hoverSlot')
            total += 1
            if got != sid:
                bad.append((sid, tag, got))
    print('points', total, 'mismatch', len(bad))
    for b in bad:
        print('  ', b)
    br.close()
