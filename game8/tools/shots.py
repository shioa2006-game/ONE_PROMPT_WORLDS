# 画面確認用: ヘッドレスの Edge でゲームを開き、検証用の口 (__hitsuji) で場面を作って PNG を撮る。
#   python tools/shots.py <出力フォルダ>
import sys, pathlib
from playwright.sync_api import sync_playwright

out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'tools/results/shots')
out.mkdir(parents=True, exist_ok=True)
url = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()

H = "const h=__hitsuji; h.hold(true);"
STEPS = [
    ('01_title', H + "h.title(); h.mouse(560,470,false); h.step(150)"),
    ('02_l1_start', H + "h.goto(0); h.step(30)"),
    ('03_l1_walk', H + "h.mouse(480,410,false); h.step(150)"),
    ('04_l1_dash', H + "h.goto(0); h.mouse(900,400,true); h.step(75)"),
    ('05_l2', H + "h.goto(1); h.mouse(200,440,false); h.step(200)"),
    ('06_l3', H + "h.goto(2); h.mouse(520,400,false); h.step(260)"),
    ('07_l4', H + "h.goto(3); h.mouse(640,400,false); h.step(200)"),
    ('08_l5', H + "h.goto(4); h.mouse(200,200,false); h.step(200)"),
    ('09_l6', H + "h.goto(5); h.mouse(330,560,false); h.step(160)"),
    ('10_l7', H + "h.goto(6); h.mouse(760,380,false); h.step(260)"),
    ('10b_l8', H + "h.goto(7); h.mouse(420,300,false); h.step(200)"),
    ('11_l9', H + "h.goto(8); h.mouse(500,250,false); h.step(200)"),
    ('11b_l3_dash', H + "h.goto(2, 5); for(let i=0;i<150;i++) h.tick(520,395,0); for(let i=0;i<26;i++) h.tick(760,395,1); h.draw()"),
    ('11c_l7_walk', H + "h.goto(6, 5); for(let i=0;i<170;i++) h.tick(650,390,0); h.draw()"),
    ('11d_l7_after', H + "for(let i=0;i<200;i++) h.tick(430,390,0); h.draw()"),
    ('12_select', H + "h.select(); h.mouse(300,300,false); h.step(5)"),
    ('13_ending', H + "h.ending(9); h.step(5)"),
    ('14_ending_end', H + "h.ending(22); h.step(5)"),
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
        pg.evaluate("(()=>{" + js + "})()")
        pg.wait_for_timeout(80)
        pg.screenshot(path=str(out / (name + '.png')))
    print('errors:', errs)
    b.close()
