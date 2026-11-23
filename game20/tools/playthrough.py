# STAIRWARD — タイトルから結末まで、本物のクリックとキーで通す（Playwright + Edge ヘッドレス）
# 使い方: python tools/playthrough.py [--fast N] [--reload] [--keys] [--fail-first] [--shots DIR]
#   持ち場は tools/solutions.json（陣ID → {仲間: 持ち場}）を使う。札を押し、旗を押して置く。
#   --fast N   : 迎撃だけ N 倍速で進める（K20.fast。人の操作の代わりではない。記録に明記）
#   --reload   : 第三夜の途中でページを読みなおし、「つづきから」で再開できるか確かめる
#   --keys     : 札の選択に 1〜5 キー、迎え撃つに Enter を使う
#   --fail-first: 最初の陣で、わざと悪い配置で負けてから、配置を直して勝つ
import json, os, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file:///' + os.path.join(ROOT, 'index.html').replace('\\', '/')
SOL = json.load(open(os.path.join(ROOT, 'tools', 'solutions.json'), encoding='utf-8'))


def main():
    args = sys.argv[1:]
    fast = 0
    shots = None
    if '--fast' in args:
        fast = int(args[args.index('--fast') + 1])
    if '--shots' in args:
        shots = args[args.index('--shots') + 1]
        os.makedirs(shots, exist_ok=True)
    reload_mid = '--reload' in args
    use_keys = '--keys' in args
    fail_first = '--fail-first' in args
    errs = []
    log = []
    t_start = time.time()
    with sync_playwright() as p:
        br = p.chromium.launch(channel='msedge')
        pg = br.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        pg.goto(URL)
        pg.wait_for_timeout(500)
        pg.evaluate('localStorage.clear()')
        pg.reload()
        pg.wait_for_timeout(500)

        def to_px(x, y):
            r = pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width / 1280]; })()")
            return r[0] + x * r[2], r[1] + y * r[2]

        def click(x, y, button='left'):
            px, py = to_px(x, y)
            pg.mouse.move(px, py)
            pg.wait_for_timeout(60)
            pg.mouse.down(button=button)
            pg.wait_for_timeout(30)
            pg.mouse.up(button=button)
            pg.wait_for_timeout(80)

        def btn(key, must=True):
            for _ in range(30):
                bs = pg.evaluate('K20.buttons()')
                hit = [b for b in bs if b['key'] == key and b['enabled']]
                if hit:
                    click(hit[-1]['x'], hit[-1]['y'])
                    return True
                pg.wait_for_timeout(100)
            if must:
                raise RuntimeError('no button ' + key + ' ' + str([b['key'] for b in pg.evaluate('K20.buttons()')]))
            return False

        def state():
            return pg.evaluate('K20.state()')

        def shot(name):
            if shots:
                pg.screenshot(path=os.path.join(shots, name + '.png'))

        def place(pl, allies):
            # いったん全員を外す（右クリック）
            cur = state()['pl']
            for a, sid in cur.items():
                r = pg.evaluate(f"K20.slotScreen('{sid}')")
                click(r['x'], r['y'], 'right')
            for i, a in enumerate(allies):
                if a not in pl:
                    continue
                if use_keys:
                    pg.keyboard.press(str(i + 1))
                    pg.wait_for_timeout(60)
                else:
                    btn('card_' + a)
                r = pg.evaluate(f"K20.slotScreen('{pl[a]}')")
                click(r['x'], r['y'])
            got = state()['pl']
            if got != pl:
                raise RuntimeError('placement mismatch want=%s got=%s' % (pl, got))

        def battle():
            if fast:
                pg.evaluate(f'K20.fast({fast})')
            if use_keys:
                pg.keyboard.press('Enter')
            else:
                btn('start')
            t0 = time.time()
            while state()['scene'] != 'result':
                pg.wait_for_timeout(150)
                if time.time() - t0 > 400:
                    raise RuntimeError('battle timeout')
            pg.evaluate('K20.fast(0)')
            pg.wait_for_timeout(300)
            return state()['result']

        # タイトル → はじめる
        shot('00_title')
        btn('new')
        did_reload = False
        first = True
        guard = 0
        while guard < 400:
            guard += 1
            s = state()
            if s['err']:
                raise RuntimeError('game error: ' + s['err'])
            sc = s['scene']
            if sc == 'story':
                if use_keys:
                    pg.keyboard.press('Space')
                    pg.wait_for_timeout(320)
                else:
                    click(640, 360)
                    pg.wait_for_timeout(320)
                continue
            if sc == 'plan':
                wid = s['waveId']
                allies = pg.evaluate('K20.G.wave.allies')
                if reload_mid and not did_reload and wid == '3-2':
                    did_reload = True
                    pg.reload(); pg.wait_for_timeout(600)
                    btn('continue')
                    pg.wait_for_timeout(400)
                    s2 = state()
                    log.append('reload -> continue: scene=%s wave=%s' % (s2['scene'], s2['waveId']))
                    assert s2['waveId'] == '3-2', s2
                    continue
                if fail_first and first:
                    bad = {'ilza': 'g_n', 'ruu': 's_land'}
                    place(bad, allies)
                    shot('01_plan_bad')
                    r = battle()
                    log.append('%s bad placement -> %s' % (wid, r))
                    shot('02_result_bad')
                    btn('retry')
                    pg.wait_for_timeout(300)
                    shot('03_plan_after_fail')
                    first = False
                    continue
                first = False
                pl = SOL[wid]
                place(pl, allies)
                shot('w%s_plan' % wid)
                r = battle()
                log.append('%s %s -> %s' % (wid, pl, r))
                shot('w%s_result' % wid)
                if not r['win']:
                    raise RuntimeError('lost wave ' + wid)
                btn('next')
                pg.wait_for_timeout(300)
                continue
            if sc == 'gift':
                shot('gift_%d' % guard)
                bs = pg.evaluate('K20.buttons()')
                g = [b for b in bs if b['key'] == 'gift0'][0]
                click(g['x'], g['y'])
                pg.wait_for_timeout(300)
                continue
            if sc == 'ending':
                pg.wait_for_timeout(500)
                shot('99_ending')
                log.append('ending reached')
                btn('toTitle')
                pg.wait_for_timeout(300)
                log.append('back to title: ' + state()['scene'])
                break
            pg.wait_for_timeout(200)
        br.close()
    for l in log:
        print(l)
    print('elapsed %.1fs' % (time.time() - t_start))
    for e in errs:
        print('ERR', e)
    if errs:
        sys.exit(1)


if __name__ == '__main__':
    main()
