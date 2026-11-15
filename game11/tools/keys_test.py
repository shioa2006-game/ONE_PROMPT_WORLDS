"""
ひゅるり、凧びより ― キーボード操作の確認（検証用）

  python tools/keys_test.py
本物の キー入力で、WASD / やじるし で うごく・スペースで ドン・Esc で ひとやすみ の 開け閉め・
M で 音・B で まきこみ帳 を たしかめる（状態の 読みとりに G11.debug を つかう）。
"""
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri()


def main():
    res = []
    errs = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge', headless=True)
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(700)
        bt = [x for x in pg.evaluate('G11.debug.buttons()') if x['id'] == 'new'][0]
        pg.mouse.click(bt['x'], bt['y'])
        pg.mouse.move(640, 700); pg.mouse.move(1279, 719)
        pg.evaluate('G11.mouse.in = false')
        for i in range(3):
            pg.wait_for_timeout(700); pg.keyboard.press('Space')
        pg.wait_for_timeout(300)
        res.append(('はじめの話を スペースで すすめる', pg.evaluate('G11.state') == 'play'))

        def pos():
            return pg.evaluate('[G11.sim.wind.x, G11.sim.wind.y]')
        for key, dx, dy in [('d', 1, 0), ('a', -1, 0), ('s', 0, 1), ('w', 0, -1), ('ArrowRight', 1, 0), ('ArrowUp', 0, -1)]:
            x0, y0 = pos()
            pg.keyboard.down(key); pg.wait_for_timeout(600); pg.keyboard.up(key); pg.wait_for_timeout(150)
            x1, y1 = pos()
            okm = (x1 - x0) * dx > 3 or (y1 - y0) * dy > 3
            res.append(('%s で うごく（%.0f, %.0f）' % (key, x1 - x0, y1 - y0), okm))
        pg.evaluate('G11.sim.addOrbit("kareha",0,4,0,0.5); G11.sim.blastCd = 0')
        pg.keyboard.press('Space'); pg.wait_for_timeout(120)
        res.append(('スペースで ドン', pg.evaluate('G11.sim.blastT < 1')))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        res.append(('Esc で ひとやすみ', pg.evaluate('G11.state') == 'pause'))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        res.append(('Esc で もどる', pg.evaluate('G11.state') == 'play'))
        m0 = pg.evaluate('G11.A.opt.mute')
        pg.keyboard.press('m'); pg.wait_for_timeout(100)
        res.append(('M で 音の あり/なし が かわる', pg.evaluate('G11.A.opt.mute') != m0))
        pg.keyboard.press('m')
        pg.keyboard.press('b'); pg.wait_for_timeout(200)
        res.append(('B で まきこみ帳', pg.evaluate('G11.state') == 'book'))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        res.append(('Esc で 帳から もどる', pg.evaluate('G11.state') == 'play'))
        b.close()
    for name, okv in res:
        print('  ok  ' if okv else '  NG  ', name)
    print('ページエラー', len(errs), errs[:3])


if __name__ == '__main__':
    main()
