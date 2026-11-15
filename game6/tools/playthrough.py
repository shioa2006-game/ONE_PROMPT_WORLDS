# 実ブラウザ（ヘッドレス Edge）で、実際のキー入力だけを使って最初から結末まで通す。
#   python tools/playthrough.py [出力フォルダ]
# 手順は tools/solve.js の「まが玉あり最短」。途中で つかまる→Zで戻す、Rでやり直し も確かめる。
import sys, json, subprocess, pathlib
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')

root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
if out: out.mkdir(parents=True, exist_ok=True)
js = ("const R=require('./js/rules.js'),LV=require('./js/levels.js'),{solve}=require('./tools/solve.js');"
      "console.log(JSON.stringify(LV.map(d=>solve(R.parse(d),{needGem:true}).path)))")
paths = json.loads(subprocess.check_output(['node', '-e', js], cwd=root))
KEY = {'F': 'w', 'B': 's', 'L': 'a', 'R': 'd', 'W': 'Space'}
ok = True
def check(cond, msg):
    global ok
    print(('OK  ' if cond else 'NG  ') + msg)
    ok = ok and cond

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto(root.joinpath('index.html').as_uri())
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(500)
    mode = lambda: pg.evaluate("__hb.G.mode")
    shot = lambda n: out and pg.screenshot(path=str(out / (n + '.png')))
    check(mode() == 'title', 'タイトルで始まる'); shot('00_title')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(600)
    check(mode() == 'play' and pg.evaluate("__hb.G.floor") == 0, 'Enter で1階が始まる')
    # つかまる → Z で戻す → R でやり直す
    for k in ['d', 'Space', 'Space']: pg.keyboard.press(k); pg.wait_for_timeout(260)
    pg.wait_for_timeout(700)
    check(mode() == 'caught', '見ずに待つと つかまる'); shot('01_caught')
    pg.keyboard.press('z'); pg.wait_for_timeout(300)
    check(mode() == 'play' and pg.evaluate("__hb.G.s.steps") == 2, 'Z で一手もどる')
    pg.keyboard.press('r'); pg.wait_for_timeout(300)
    check(pg.evaluate("__hb.G.s.steps") == 0, 'R で階をやり直す')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    check(mode() == 'pause', 'Esc でメニュー'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.keyboard.press('m'); pg.wait_for_timeout(200); shot('02_bigmap'); pg.keyboard.press('m')
    # 壁に向かって進んでも手数は増えない
    pg.keyboard.press('s'); pg.wait_for_timeout(260)
    check(pg.evaluate("__hb.G.s.steps") == 0, '壁にぶつかっても手数は増えない')
    frames = []
    for i, path in enumerate(paths):
        check(pg.evaluate("__hb.G.floor") == i and mode() == 'play', f'{i+1}階 開始')
        pg.wait_for_timeout(300); shot(f'{i+1:02d}a_start')
        for n, a in enumerate(path):
            pg.keyboard.press(KEY[a]); pg.wait_for_timeout(230)
            if n == len(path) // 2: shot(f'{i+1:02d}b_mid')
        pg.wait_for_timeout(700)
        st = pg.evaluate("({m:__hb.G.mode, s:__hb.G.s.steps, g:__hb.G.s.gem, info:__hb.G.clearInfo})")
        check(st['m'] == 'clear' and st['s'] == len(path) and st['g'], f"{i+1}階 クリア（{st['s']}歩・まが玉 {st['g']}・★{st['info'] and st['info']['stars']}）")
        shot(f'{i+1:02d}c_clear')
        pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    check(pg.evaluate("__hb.G.ending") is True, '最後の階のあと 結末の間へ'); shot('20_ending')
    fps = pg.evaluate("new Promise(r=>{let n=0,t=performance.now();(function f(){n++;if(performance.now()-t<1000)requestAnimationFrame(f);else r(n)})()})")
    print('    描画の速さ（結末の間・1秒あたり）:', fps)
    for a in 'wwwwwww': pg.keyboard.press(a); pg.wait_for_timeout(230)
    pg.wait_for_timeout(3000)
    check(mode() == 'result', '光の中へ出ると 結果画面'); shot('21_result')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    check(mode() == 'select', '記録・階えらびへ'); shot('22_select')
    sv = pg.evaluate("__hb.save()")
    check(sv['cleared'] == len(paths) and len(sv['gems']) == len(paths) and sv.get('finished'), '保存：全階クリア・まが玉・結末')
    pg.reload(); pg.wait_for_timeout(500)
    check(pg.evaluate("__hb.save().cleared") == len(paths), '読み込み直しても記録が残る'); shot('23_title_after')
    pg.keyboard.press('ArrowDown'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    check(mode() == 'select', 'タイトルから階えらびに入れる')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check(mode() == 'play', '階えらびから遊び直せる')
    check(not errs, 'コンソールにエラーなし ' + ' / '.join(errs[:3]))
    b.close()
print('結果:', '全部OK' if ok else '失敗あり')
sys.exit(0 if ok else 1)
