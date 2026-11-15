"""
ひゅるり、凧びより ― さいしょの 1分を 実時間で 見る（検証用）

  python tools/firstminute.py <出力フォルダ>
タイトル →「はじめる」→ はじめの話を クリックで すすめ、そのあと 60秒間、
マウスを 画面中心から 220px はなれた 円の 上で ゆっくり 回す（人が「とりあえず ぐるぐる まわる」操作の 代わり）。
6秒ごとに 画面を 撮り、ゲームの 状態（大きさ・まきこんだ数）を 記録する。ドンは 20秒ごとに 1回 クリック。
"""
import sys, math, json, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri()


def main():
    out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    errs = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge', headless=True)
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(800)
        bs = pg.evaluate('G11.debug.buttons()')
        bt = [x for x in bs if x['id'] == 'new'][0]
        pg.mouse.click(bt['x'], bt['y'])
        for i in range(3):
            pg.wait_for_timeout(900); pg.mouse.click(640, 420)
        t = 0.0
        log = []
        for k in range(600):
            a = t * 0.35
            x, y = 640 + math.cos(a) * 220, 400 + math.sin(a) * 160
            pg.mouse.move(x, y)
            if k % 200 == 199:
                pg.mouse.down(); pg.wait_for_timeout(20); pg.mouse.up()
            pg.wait_for_timeout(100)
            t += 0.1
            if k % 60 == 59:
                st = pg.evaluate('G11.debug.state()')
                log.append(st)
                pg.screenshot(path=str(out / ('fm_%02d.png' % (k // 60))))
        b.close()
    for s in log:
        print(json.dumps({k: (round(v, 1) if isinstance(v, float) else v) for k, v in s.items()}, ensure_ascii=False))
    print('errors', len(errs), errs[:3])


if __name__ == '__main__':
    main()
