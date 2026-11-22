"""くるり、呪いほどき — タイトルから結末まで、本物のマウス・キー入力で通す（Playwright + Edge headless）
   python tools/playthrough.py [--shots DIR] [--fast] [--noshift] [--reload] [--seed N] [--maxturns N]
   手の選び方：ずらしはページ内のボットの提案（KR16.suggest：魔力の範囲で全組み合わせを試す）を使い、
   ▲▼ボタンを実際にクリックして入力する。工房では KR16.suggestBuy / suggestPlace の提案を、実際のクリックで行う。
   --noshift ではずらさずに詠唱だけする（単純な方針）。"""
import sys
import os
import json
import time
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shot import URL, to_page  # noqa: E402

args = sys.argv[1:]
SHOTS = args[args.index('--shots') + 1] if '--shots' in args else None
FAST = '--fast' in args
NOSHIFT = '--noshift' in args
RELOAD = '--reload' in args
SEED = int(args[args.index('--seed') + 1]) if '--seed' in args else 7
MAXSTEPS = int(args[args.index('--maxsteps') + 1]) if '--maxsteps' in args else 6000
if SHOTS:
    os.makedirs(SHOTS, exist_ok=True)

log = []
shot_n = [0]


def shot(pg, name):
    if not SHOTS:
        return
    shot_n[0] += 1
    pg.screenshot(path=os.path.join(SHOTS, '%03d_%s.png' % (shot_n[0], name)))


def click_btn(pg, bid, wait=120):
    bs = pg.evaluate('KR16.buttons()')
    b = next((b for b in bs if b['id'] == bid), None)
    if not b:
        raise RuntimeError('no button ' + bid + ' ' + str([x['id'] for x in bs]))
    if not b['en']:
        raise RuntimeError('disabled button ' + bid)
    x, y = to_page(pg, b['x'], b['y'])
    pg.mouse.move(x, y)
    pg.wait_for_timeout(30)
    pg.mouse.click(x, y)
    pg.wait_for_timeout(wait)


def click_xy(pg, x, y, wait=120, button='left'):
    px, py = to_page(pg, x, y)
    pg.mouse.move(px, py)
    pg.wait_for_timeout(30)
    pg.mouse.click(px, py, button=button)
    pg.wait_for_timeout(wait)


def idle(pg, limit=8000):
    t = 0
    while t < limit:
        pg.wait_for_timeout(80)
        t += 80
        if not pg.evaluate('KR16.busy()'):
            return
    raise RuntimeError('busy timeout')


def main():
    with sync_playwright() as p:
        br = p.chromium.launch(channel='msedge')
        pg = br.new_page(viewport={'width': 1280, 'height': 720})
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
        pg.goto(URL)
        pg.wait_for_timeout(600)
        pg.evaluate('localStorage.clear()')
        pg.reload()
        pg.wait_for_timeout(600)
        if FAST:
            pg.evaluate('KR16.cfg.fast = true')
        steps = 0
        turns = 0
        seen = set()
        reloaded = False
        t0 = time.time()
        last_stage = -1
        while steps < MAXSTEPS:
            steps += 1
            sc = pg.evaluate('KR16.scene()')
            if errors:
                print('ERRORS', errors)
                break
            if sc['story']:
                if 'story' not in seen:
                    seen.add('story')
                    shot(pg, 'story')
                click_btn(pg, 'story_next', 200)
                continue
            if sc['talk']:
                shot(pg, 'talk_s%d' % sc['stage'])
                click_btn(pg, 'talk_next', 200)
                continue
            if sc['result']:
                pg.wait_for_timeout(700)
                shot(pg, 'result_s%d_%s' % (sc['stage'], 'win' if sc['result']['win'] else 'lose'))
                st = pg.evaluate('KR16.state()')
                log.append({'event': 'result', 'win': sc['result']['win'], 'stage_after': sc['stage'], 'rescued_total': st['rescued'], 'coins': st['coins']})
                print('result', sc['result'], 'stage->', sc['stage'], 'rescued', st['rescued'], 'turns', turns, 'elapsed %.0fs' % (time.time() - t0))
                click_btn(pg, 'res_ok' if sc['result']['win'] else 'res_retry', 400)
                continue
            if sc['overlay']:
                pg.keyboard.press('Escape')
                pg.wait_for_timeout(100)
                continue
            scene = sc['scene']
            if scene == 'title':
                bs = [b['id'] for b in pg.evaluate('KR16.buttons()')]
                click_btn(pg, 'cont' if 'cont' in bs and reloaded else 'new', 300)
                continue
            if scene == 'map':
                if sc['stage'] != last_stage:
                    shot(pg, 'map_s%d' % sc['stage'])
                click_btn(pg, 'depart', 300)
                continue
            if scene == 'workshop':
                if 'ws%d' % sc['stage'] not in seen:
                    seen.add('ws%d' % sc['stage'])
                    pg.wait_for_timeout(200)
                    shot(pg, 'workshop_s%d' % sc['stage'])
                    if RELOAD and not reloaded and sc['stage'] == 2:
                        reloaded = True
                        print('reload at workshop stage 2')
                        pg.reload()
                        pg.wait_for_timeout(800)
                        if FAST:
                            pg.evaluate('KR16.cfg.fast = true')
                        continue
                if sc['gifts']:
                    click_btn(pg, 'gift0', 200)
                    continue
                act = pg.evaluate('KR16.suggestBuy()')
                if act:
                    k = act['kind']
                    if k == 'mp':
                        click_btn(pg, 'buy_mp')
                    elif k == 'regen':
                        click_btn(pg, 'buy_regen')
                    elif k == 'buy':
                        click_btn(pg, 'buy_' + act['t'])
                    elif k == 'up':
                        click_btn(pg, 'smith')
                        q = pg.evaluate('KR16.wkCell(%d,%d)' % (act['r'], act['k']))
                        click_xy(pg, q['x'], q['y'])
                        click_btn(pg, 'smith')
                    continue
                if sc['inv']:
                    pl = pg.evaluate('KR16.suggestPlace(%d)' % (SEED + steps))
                    if pl:
                        click_btn(pg, 'inv%d' % pl['ii'])
                        q = pg.evaluate('KR16.wkCell(%d,%d)' % (pl['r'], pl['k']))
                        click_xy(pg, q['x'], q['y'], 150)
                        continue
                shot(pg, 'workshop_done_s%d' % sc['stage'])
                click_btn(pg, 'go', 300)
                continue
            if scene == 'battle':
                if sc['stage'] != last_stage:
                    last_stage = sc['stage']
                    pg.wait_for_timeout(2700)
                if pg.evaluate('KR16.busy()'):
                    idle(pg)
                    continue
                ph = sc['phase']
                if ph == 'spin':
                    pg.keyboard.press('Space')
                    idle(pg)
                    turns += 1
                    continue
                if ph == 'aim':
                    if not NOSHIFT:
                        sug = pg.evaluate('KR16.suggest()')
                        if sug:
                            for c, o in enumerate(sug['offs']):
                                for _ in range(abs(o)):
                                    click_btn(pg, ('up%d' if o > 0 else 'dn%d') % c, 90)
                    key = 'aim_s%d' % sc['stage']
                    if key not in seen or turns % 9 == 0:
                        seen.add(key)
                        pg.wait_for_timeout(250)
                        shot(pg, 'aim_s%d_t%d' % (sc['stage'], turns))
                    pg.keyboard.press('Space')
                    pg.wait_for_timeout(150)
                    idle(pg)
                    continue
                pg.wait_for_timeout(100)
                continue
            if scene == 'ending':
                pg.wait_for_timeout(1500)
                shot(pg, 'ending')
                print('ENDING reached. turns', turns, 'elapsed %.0fs' % (time.time() - t0))
                st = pg.evaluate('KR16.state()')
                print('rescued', st['rescued'], 'stats', json.dumps(st['stats']))
                bs = [b['id'] for b in pg.evaluate('KR16.buttons()')]
                print('ending buttons', bs)
                break
            pg.wait_for_timeout(100)
        if errors:
            print('ERRORS:', errors)
        else:
            print('no page errors')
        br.close()


main()
