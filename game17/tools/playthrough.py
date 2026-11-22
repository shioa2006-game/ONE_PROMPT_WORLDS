# ずらり、砦くずし — タイトルから結末まで、本物のマウス操作で通す（Playwright + Edge ヘッドレス）
# 使い方: python tools/playthrough.py [--seed N] [--fast] [--reload] [--noshift] [--shots DIR] [--keys]
#   ずらし：ページ内のボット（ZR17.suggest = 魔力の範囲で全部ためす）の答えを、▲▼ボタンのクリックで入力する
#   --noshift：一度もずらさない   --keys：ずらしと放つをキーボードで入力する
#   --reload：三つ目の砦の前の工房で再読み込みし、「つづきから」で再開する
import json, os, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name)
        return args[i + 1] if i + 1 < len(args) and not args[i + 1].startswith('--') else True
    return default
SEED = int(opt('--seed', 7))
FAST = bool(opt('--fast', False))
RELOAD = bool(opt('--reload', False))
NOSHIFT = bool(opt('--noshift', False))
KEYS = bool(opt('--keys', False))
SHOTS = opt('--shots', None)
URL = 'file:///' + os.path.join(ROOT, 'index.html').replace('\\', '/') + f'?seed={SEED}'

log = []
T0 = time.time()
def say(*a):
    s = f'[{time.time() - T0:6.1f}s] ' + ' '.join(str(x) for x in a)
    log.append(s)
    print(s, flush=True)

def main():
    errs = []
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        br = p.chromium.launch(channel='msedge')
        pg = br.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL)
        pg.wait_for_timeout(500)
        if FAST:
            pg.evaluate('ZR17.cfg.fast = true')

        def px(x, y):
            r = pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width / 1280]; })()")
            return r[0] + x * r[2], r[1] + y * r[2]

        def click_btn(key, label=None):
            pg.wait_for_timeout(60)
            bs = pg.evaluate('ZR17.buttons()')
            hit = [b for b in bs if b['key'] == key] if key else []
            if not hit and label:
                hit = [b for b in bs if b['label'] == label]
            if not hit:
                return False
            b = hit[-1]
            if b['disabled']:
                return False
            x, y = px(b['x'], b['y'])
            pg.mouse.move(x, y)
            pg.mouse.down(); pg.mouse.up()
            return True

        def idle(limit=20):
            t0 = time.time()
            pg.wait_for_timeout(100)
            while time.time() - t0 < limit and pg.evaluate('ZR17.busy()'):
                pg.wait_for_timeout(60)
            pg.wait_for_timeout(120)

        shot_n = [0]
        def shot(name):
            if SHOTS:
                shot_n[0] += 1
                pg.screenshot(path=os.path.join(SHOTS, f'{shot_n[0]:03d}_{name}.png'))

        # タイトル
        shot('title')
        click_btn(None, 'はじめから')
        pg.wait_for_timeout(300)
        # 物語は一枚ずつクリックで送る
        for _ in range(12):
            if pg.evaluate('ZR17.scene()') != 'story':
                break
            pg.mouse.click(*px(640, 360))
            pg.wait_for_timeout(260)
            pg.mouse.click(*px(640, 360))
            pg.wait_for_timeout(200)

        turns = 0
        shifts = 0
        reloaded = False
        last_scene = None
        stage_shot = set()
        guard = 0
        while guard < 4000:
            guard += 1
            sc = pg.evaluate('ZR17.scene()')
            if sc != last_scene:
                say('scene ->', sc)
                last_scene = sc
            if sc == 'ending':
                shot('ending')
                say('ENDING reached')
                break
            if sc == 'story':
                pg.mouse.click(*px(640, 360)); pg.wait_for_timeout(250)
                pg.mouse.click(*px(640, 360)); pg.wait_for_timeout(150)
                continue
            if sc == 'map':
                pg.wait_for_timeout(1500)
                shot('map')
                if not click_btn('next'):
                    pg.wait_for_timeout(400)
                pg.wait_for_timeout(300)
                continue
            if sc == 'camp':
                st = pg.evaluate('(() => { const s = ZR17.state(); return { stage: s.stage, gold: s.gold, inv: s.inv.length }; })()')
                if RELOAD and not reloaded and st['stage'] == 2:
                    reloaded = True
                    say('reload at camp before stage', st['stage'])
                    pg.reload(); pg.wait_for_timeout(600)
                    if FAST:
                        pg.evaluate('ZR17.cfg.fast = true')
                    click_btn(None, 'つづきから')
                    pg.wait_for_timeout(500)
                    continue
                for _ in range(40):
                    plan = pg.evaluate('ZR17.planCamp()')
                    if '-v' in args:
                        say('  plan', plan)
                    if plan['act'] == 'drop':
                        pg.keyboard.press('Escape')
                        pg.evaluate('ZR17.state().inv.shift()')  # 置き場がない言葉は持ち物のまま（ボットは使わない）
                        continue
                    if plan['act'] in ('gift', 'btn'):
                        if plan['key'] == 'depart':
                            shot(f'camp_{st["stage"]}')
                            say(f'camp stage={st["stage"]} gold={pg.evaluate("ZR17.state().gold")} reels=' + pg.evaluate("ZR17.state().reels.map(r => r.strip.map(w => window.ZR.W[w.k].glyph || '_').join('')).join(' | ')"))
                        ok = click_btn(plan['key'])
                        pg.wait_for_timeout(120)
                        if plan['key'] == 'depart':
                            break
                        if not ok:
                            say('camp click failed', plan)
                            break
                continue
            if sc == 'battle':
                info = pg.evaluate('(() => { const s = ZR17.state(), b = s.b, bs = ZR17.bs(); return { phase: b ? b.phase : null, over: bs && bs.over ? bs.over.kind : null, overT: bs && bs.over ? bs.over.t : 0, stage: b ? b.stage : null, turn: b ? b.turn : 0, guard: b ? b.guard : 0 }; })()')
                if ZBUSY(pg):
                    idle(); continue
                if info['over']:
                    if info['overT'] < 1.2:
                        pg.wait_for_timeout(300); continue
                    shot(f'over_{info["stage"]}_{info["over"]}')
                    say(f'battle end stage={info["stage"]} {info["over"]} turn={info["turn"]} guard={info["guard"]}')
                    if not click_btn('next'):
                        click_btn('retry')
                    pg.wait_for_timeout(400)
                    continue
                if info['phase'] == 'spin':
                    if KEYS:
                        pg.keyboard.press('Space')
                    else:
                        click_btn('main')
                    idle()
                    continue
                if info['phase'] == 'aim':
                    if info['stage'] not in stage_shot:
                        stage_shot.add(info['stage'])
                        shot(f'battle_{info["stage"]}_aim')
                    if not NOSHIFT:
                        sug = pg.evaluate('ZR17.suggest()') or []
                        for i, d in enumerate(sug):
                            for _ in range(abs(d)):
                                if KEYS:
                                    pg.keyboard.press(('qwert' if d > 0 else 'asdfg')[i])
                                else:
                                    click_btn(('up' if d > 0 else 'dn') + str(i))
                                shifts += 1
                                pg.wait_for_timeout(40)
                    # 2回押す必要がある場合（「ずらすともっと効く」の知らせ）に備えて
                    for _ in range(2):
                        if KEYS:
                            pg.keyboard.press('Space')
                        else:
                            click_btn('main')
                        pg.wait_for_timeout(120)
                        if pg.evaluate('ZR17.busy()') or pg.evaluate('ZR17.phase()') != 'aim':
                            break
                    turns += 1
                    idle()
                    continue
                pg.wait_for_timeout(100)
                continue
            if sc == 'title':
                click_btn(None, 'つづきから')
                pg.wait_for_timeout(400)
                continue
            pg.wait_for_timeout(200)
        s = pg.evaluate('(() => { const s = ZR17.state(); return { stage: s.stage, best: s.best, losses: s.losses, turns: s.turns, cleared: s.cleared }; })()')
        say('result', json.dumps(s, ensure_ascii=False), 'shifts', shifts, 'casts', turns)
        br.close()
    if errs:
        say('PAGE ERRORS:', *errs)
    else:
        say('page errors: 0')

def ZBUSY(pg):
    return pg.evaluate('ZR17.busy()')

if __name__ == '__main__':
    main()
