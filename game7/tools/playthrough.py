# 機能検証: 実際のマウスクリックとキー入力だけで、表紙 → 全11鉢 → むすび → 表紙 まで通す。
# 手順は tools/results/solutions.json（node tools/analyze.js が書き出す最短手順）を使う。
#   python tools/playthrough.py [スクリーンショット出力フォルダ]
import sys, json, pathlib
from playwright.sync_api import sync_playwright

here = pathlib.Path(__file__).resolve().parent
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
if out: out.mkdir(parents=True, exist_ok=True)
sols = json.loads((here / 'results' / 'solutions.json').read_text(encoding='utf-8'))
url = (here.parent / 'index.html').as_uri()
log = []

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge')
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(url); pg.wait_for_timeout(500)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(500)
    assert pg.evaluate("__kiri.G.scene") == 'title'
    pg.mouse.click(1105, 559)                     # 「はじめる」
    pg.wait_for_timeout(500)
    for s in sols:
        i = s['level']
        assert pg.evaluate("__kiri.G.scene") == 'play' and pg.evaluate("__kiri.G.li") == i, ('鉢が違う', i)
        for step in s['path']:
            for (x, y) in step['cuts']:
                # 切る枝のまんなかを実際にクリックする
                xy = pg.evaluate("""([x,y])=>{const S=__kiri.G.S,id=__kiri.at(x,y),n=S.nodes[id],q=S.nodes[n.parent];
                    const a=__kiri.cellPx(n.x,n.y),b=__kiri.cellPx(q.x,q.y);return [(a[0]+b[0])/2,(a[1]+b[1])/2]}""", [x, y])
                before = pg.evaluate("Object.keys(__kiri.G.S.nodes).length")
                pg.mouse.move(xy[0], xy[1]); pg.wait_for_timeout(60); pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(120)
                assert pg.evaluate("Object.keys(__kiri.G.S.nodes).length") < before, ('切れていない', i, x, y)
            yr = pg.evaluate("__kiri.G.S.year")
            pg.keyboard.press('Space'); pg.wait_for_timeout(950)
            assert pg.evaluate("__kiri.G.S.year") == yr + 1, ('春が進まない', i)
        pg.wait_for_timeout(1900)
        res = pg.evaluate("__kiri.G.result")
        assert res, ('完成にならない', i)
        log.append((i + 1, res['years'], res['mei']))
        if out: pg.screenshot(path=str(out / ('clear_%02d.png' % (i + 1))))
        pg.keyboard.press('Space'); pg.wait_for_timeout(500)
    assert pg.evaluate("__kiri.G.scene") == 'ending'
    pg.wait_for_timeout(4800)
    if out: pg.screenshot(path=str(out / 'ending.png'))
    pg.mouse.click(1105, 572); pg.wait_for_timeout(400)   # 「棚へもどる」
    assert pg.evaluate("__kiri.G.scene") == 'title'
    if out: pg.screenshot(path=str(out / 'title_after.png'))
    # 再読込しても棚が残るか／自由鉢に入れるか／もどす・やりなおし
    pg.reload(); pg.wait_for_timeout(500)
    assert pg.evaluate("Object.keys(__kiri.save().cleared).length") == 11
    pg.mouse.click(100 + 11 * 73.5, 590); pg.wait_for_timeout(400)
    assert pg.evaluate("__kiri.G.li") == 11 and pg.evaluate("__kiri.G.scene") == 'play'
    for _ in range(3): pg.keyboard.press('Space'); pg.wait_for_timeout(900)
    assert pg.evaluate("__kiri.G.S.year") == 3
    pg.keyboard.press('z'); pg.wait_for_timeout(200); assert pg.evaluate("__kiri.G.S.year") == 2
    pg.keyboard.press('r'); pg.wait_for_timeout(200); assert pg.evaluate("__kiri.G.S.year") == 0
    pg.keyboard.press('z'); pg.wait_for_timeout(200); assert pg.evaluate("__kiri.G.S.year") == 2
    pg.keyboard.press('Space'); pg.wait_for_timeout(900)
    pg.mouse.click(1070, 392); pg.wait_for_timeout(400)   # 「棚にかざる」
    assert pg.evaluate("__kiri.G.scene") == 'title' and pg.evaluate("!!__kiri.save().cleared[11]")
    if out: pg.screenshot(path=str(out / 'title_free.png'))
    pg.keyboard.press('Escape')
    print('通しプレイ成功 (鉢, 春の回数, 名木):', log)
    print('errors:', errs)
    b.close()
