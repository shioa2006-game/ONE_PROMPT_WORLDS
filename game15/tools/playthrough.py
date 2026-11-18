"""賽駆け — 通し確認（実際のマウス・キー入力で、タイトルから結末まで）
   python tools/playthrough.py [clan] [--seed N] [--shots DIR] [--maxturn T] [--skip] [--reload]
   ・手の選び方は CPU と同じ思考（SG15.debug.suggest）を使い、その結果を「賽→軍勢→行き先」の実クリックに変換する。
   ・--skip で CPU の手番を「飛ばす」ボタンで省略（既定は早送り）。
   ・--reload で途中（3季目）にページを読み直し「つづきから」で再開できるか確かめる。
   これは操作と進行の確認であり、人間の遊び心地を確かめるものではない。"""
import sys
import os
import json
import time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = 'file:///' + os.path.join(os.path.dirname(HERE), 'index.html').replace(os.sep, '/')
args = sys.argv[1:]
clan = args[0] if args and not args[0].startswith('--') else 'oda'


def opt(name, default=None):
    if name in args:
        i = args.index(name)
        return args[i + 1] if i + 1 < len(args) else True
    return default


seed = opt('--seed', '12345')
shots = opt('--shots')
maxturn = int(opt('--maxturn', '999'))
skip = '--skip' in args
reload_test = '--reload' in args
W, H = int(os.environ.get('VW', 1600)), int(os.environ.get('VH', 900))
if shots:
    os.makedirs(shots, exist_ok=True)

log = []


def P(*a):
    s = ' '.join(str(x) for x in a)
    log.append(s)
    print(s, flush=True)


with sync_playwright() as p:
    br = p.chromium.launch(channel='msedge')
    pg = br.new_page(viewport={'width': W, 'height': H})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console.error: ' + m.text) if m.type == 'error' else None)
    pg.goto(BASE + '?seed=' + str(seed))
    pg.wait_for_timeout(1000)

    def js(code):
        return pg.evaluate(code)

    def btn(name):
        b = js('SG15.debug.buttons()')
        return b.get(name)

    def click(xy, mods=None):
        if mods:
            pg.keyboard.down(mods)
        pg.mouse.move(xy[0], xy[1])
        pg.wait_for_timeout(60)
        pg.mouse.click(xy[0], xy[1])
        if mods:
            pg.keyboard.up(mods)

    seen_def = [0]

    def wait_idle(timeout=180):
        t0 = time.time()
        while time.time() - t0 < timeout:
            if shots and seen_def[0] < 3 and js("!document.getElementById('battle').classList.contains('hidden')"):
                pg.wait_for_timeout(900)
                shot('30_cpu_battle_%d.png' % seen_def[0])
                seen_def[0] += 1
            st = js('(() => ({busy: SG15.debug.busy(), mode: SG15.debug.mode(), cur: SG15.S && SG15.S.cur, me: SG15.S && SG15.S.player, ph: SG15.S && SG15.S.phase, over: !!(SG15.S && SG15.S.over)}))()')
            if st['mode'] == 'result':
                return st
            if not st['busy'] and st['cur'] == st['me'] and st['ph'] in ('place', 'roll', 'move'):
                return st
            if skip and st['busy'] and st['cur'] != st['me']:
                b = btn('b-skip')
                if b:
                    click(b)
            pg.wait_for_timeout(150)
        raise RuntimeError('timeout waiting idle')

    def shot(name):
        if shots:
            pg.screenshot(path=os.path.join(shots, name))

    # タイトル → 大名選び → 出陣（実クリック）
    shot('00_title.png')
    click(btn('b-new'))
    pg.wait_for_timeout(300)
    click(btn('clan_' + clan))
    pg.wait_for_timeout(200)
    shot('01_select.png')
    click(btn('b-go'))
    pg.wait_for_timeout(500)
    if btn('b-intro-go'):
        shot('01b_intro.png')
        click(btn('b-intro-go'))
    pg.wait_for_timeout(1800)
    js('SG15.debug.skipTut()') if '--notut' in args else None
    fast_set = False
    turns = 0
    moves = 0
    battles_before = 0
    while True:
        st = wait_idle()
        if st['mode'] == 'result':
            break
        S = js('SG15.debug.state()')
        if S['turn'] >= maxturn:
            P('stop at maxturn', S['turn'])
            break
        if st['ph'] == 'place':
            sg = js('SG15.debug.suggest()')
            click(sg['at'])
            pg.wait_for_timeout(800)
            continue
        if st['ph'] == 'roll':
            if turns == 0:
                shot('02_turn0.png')
            pg.keyboard.press('Space')
            pg.wait_for_timeout(1200)
            turns += 1
            if reload_test and S['turn'] == 3:
                P('reload test at turn', S['turn'], 'dice', js('SG15.debug.state()')['dice'])
                pg.reload()
                pg.wait_for_timeout(1200)
                click(btn('b-cont'))
                pg.wait_for_timeout(800)
                st2 = js('SG15.debug.state()')
                P('after reload', st2['turn'], st2['phase'], 'mine', st2['mine'])
                pg.keyboard.press('Space')
                pg.wait_for_timeout(1200)
                P('dice after reload', js('SG15.debug.state()')['dice'])
            continue
        # move phase: CPU と同じ思考で一手ずつ
        for k in range(10):
            sg = js('SG15.debug.suggest()')
            if not sg or sg['kind'] in ('end', 'roll', 'place'):
                break
            dice = sg['dice']
            b = js('SG15.debug.buttons()')
            click(b['die%d' % dice[0]])
            if len(dice) > 1:
                click(b['die%d' % dice[1]], 'Shift')
            click(sg['armyAt'])
            pg.mouse.move(sg['targetAt'][0], sg['targetAt'][1])
            pg.wait_for_timeout(120)
            if sg['kind'] == 'attack' and shots and moves < 6:
                shot('10_forecast_%02d.png' % moves)
            click(sg['targetAt'])
            moves += 1
            if sg['kind'] == 'attack' and shots and moves < 8:
                pg.wait_for_timeout(1300)
                shot('11_battle_%02d.png' % moves)
            t0 = time.time()
            while js('SG15.debug.busy()') and time.time() - t0 < 20:
                pg.wait_for_timeout(100)
            if js('SG15.debug.mode()') == 'result':
                break
        if js('SG15.debug.mode()') == 'result':
            break
        S = js('SG15.debug.state()')
        if S['turn'] in (1, 8, 16, 24, 32):
            shot('20_turn%02d.png' % S['turn'])
        P('turn', S['turn'], 'provs', S['mine'], 'armies', len(S['armies']), 'dice', S['dice'])
        t_end = time.time()
        pg.keyboard.press('Enter')
        pg.wait_for_timeout(200)
        if js("SG15.S.cur === SG15.S.player && SG15.S.phase === 'move' && !SG15.debug.busy()"):
            pg.keyboard.press('Enter')   # 賽が残っているときは二度押し
        pg.wait_for_timeout(300)
        wait_idle()
        P('  cpu phase sec', round(time.time() - t_end, 1))
        if not fast_set and not skip and '--nofast' not in args:
            b = btn('b-fast')
            if b:
                click(b)
                fast_set = True
    pg.wait_for_timeout(1500)
    shot('90_result.png')
    res = js('(() => { const S = SG15.S; return { over: S.over, mine: S.owner.filter(o => o === S.player).length, turn: S.turn, stats: S.clans[S.player], errors: SG15.errors }; })()')
    P('RESULT', json.dumps(res, ensure_ascii=False))
    P('page errors', errs)
    # 再挑戦ボタン
    b = btn('b-again')
    if b:
        click(b)
        pg.wait_for_timeout(2200)
        st = js('SG15.debug.state()')
        P('retry ->', st['turn'], st['phase'], 'mine', st['mine'])
        shot('91_retry.png')
    br.close()
