# 画面確認用: ヘッドレスの Edge でゲームを開き、検証用の口 (__kiri) で場面を作って PNG を撮る。
#   python tools/shots.py <出力フォルダ>
import sys, pathlib
from playwright.sync_api import sync_playwright

out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'tools/results/shots')
out.mkdir(parents=True, exist_ok=True)
url = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()

STEPS = [
    ('01_title', "0"),
    ('02_l1_start', "__kiri.goto(0); __kiri.adv(0.5)"),
    ('03_l1_grow', "__kiri.spring(); __kiri.adv(0.2)"),
    ('04_l2_fork', "__kiri.goto(1); __kiri.adv(.3); for(let i=0;i<3;i++){__kiri.spring(); __kiri.adv(1);} __kiri.cut(2,3); __kiri.adv(0.25)"),
    ('05_l2_clear', "__kiri.spring(); __kiri.adv(3)"),
    ('06_l5_sleep', "__kiri.goto(4); __kiri.adv(.3); __kiri.spring(); __kiri.adv(1); __kiri.spring(); __kiri.adv(1); __kiri.cut(3,2); __kiri.adv(1)"),
    ('07_l6_stone', "__kiri.goto(5); __kiri.adv(.3); __kiri.spring(); __kiri.adv(1); __kiri.spring(); __kiri.adv(1); __kiri.cut(3,2); __kiri.adv(1)"),
    ('08_l7_dew', "__kiri.goto(6); __kiri.adv(1)"),
    ('09_l9_cliff', "__kiri.goto(8); __kiri.adv(.3); for(let i=0;i<3;i++){__kiri.spring(); __kiri.adv(1);}"),
    ('10_l11', "__kiri.goto(10); __kiri.adv(.3); for(let i=0;i<2;i++){__kiri.spring(); __kiri.adv(1);} __kiri.cut(3,1); for(let i=0;i<3;i++){__kiri.spring(); __kiri.adv(1);}"),
    ('11_free', "__kiri.goto(11); __kiri.adv(.3); for(let i=0;i<3;i++){__kiri.spring(); __kiri.adv(1);}"),
]

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge')
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(url)
    pg.wait_for_timeout(400)
    for name, js in STEPS:
        pg.evaluate(js)
        pg.wait_for_timeout(120)
        pg.screenshot(path=str(out / (name + '.png')))
    # カーソルを枝に重ねた予告表示
    pg.evaluate("__kiri.goto(2); __kiri.adv(.3); for(let i=0;i<3;i++){__kiri.spring(); __kiri.adv(1);}")
    xy = pg.evaluate("(()=>{const a=__kiri.cellPx(3,1), b=__kiri.cellPx(3,0); return [(a[0]+b[0])/2,(a[1]+b[1])/2]})()")
    pg.mouse.move(xy[0], xy[1])
    pg.wait_for_timeout(200)
    pg.screenshot(path=str(out / '12_hover_preview.png'))
    print('errors:', errs)
    b.close()
