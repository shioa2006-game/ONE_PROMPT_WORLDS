# がらり、迷宮ひらき — タイトルから結末まで、本物のマウス操作で通す（Playwright + Edge ヘッドレス）
# 使い方: python tools/playthrough.py [--seed N] [--fast] [--reload] [--noshift] [--keys] [--until ROOM] [--shots DIR]
#   地図：決めておいた順路の部屋を、本物のクリックで押して歩く
#   戦い：ページ内のボット（GR18.suggest = 魔力の範囲でずらし方を全部ためす）の答えを、はみ出した札のクリックで入力する
#   組みかえ：GR18.planEditor の答えを、本物のクリックで入力する
#   --noshift：一度もずらさない   --keys：ずらしと放つをキーボードで入力する
#   --reload：第二層に着いたら再読み込みし、「つづきから」で再開する
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
UNTIL = opt('--until', None)
SHOTS = opt('--shots', None)
URL = 'file:///' + os.path.join(ROOT, 'index.html').replace('\\', '/') + f'?seed={SEED}'

ROUTE = ['s1_hall', 's1_bats', 's1_forge', 's1_thorn', 's1_cache', 's1_root', 's1_spring',
         's2_shore', 's2_cave', 's2_fall', 's2_shrine', 's2_ferry', 's2_isle', 's2_lift', 's2_vault',
         's3_in', 's3_hall', 's3_read', 's3_star', 's3_seal', 's3_tomb', 's3_deep', 's4_gate', 's4_blank']

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
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        pg.set_default_timeout(20000)
        pg.goto(URL)
        pg.wait_for_timeout(500)
        if FAST:
            pg.evaluate('GR18.cfg.fast = true')

        def px(x, y):
            r = pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width / 1280]; })()")
            return r[0] + x * r[2], r[1] + y * r[2]

        def click_btn(key, label=None):
            pg.wait_for_timeout(50)
            bs = pg.evaluate('GR18.buttons()')
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

        def click_room(rid):
            pg.evaluate(f"GR18.camTo('{rid}')")
            pg.wait_for_timeout(120)
            r = pg.evaluate(f"GR18.roomXY('{rid}')")
            x, y = px(r['x'], r['y'])
            pg.mouse.move(x, y)
            pg.mouse.down(); pg.mouse.up()

        def idle(limit=25):
            t0 = time.time()
            pg.wait_for_timeout(80)
            while time.time() - t0 < limit and pg.evaluate('GR18.busy()'):
                pg.wait_for_timeout(60)
            pg.wait_for_timeout(100)

        shot_n = [0]
        def shot(name):
            if SHOTS:
                shot_n[0] += 1
                pg.screenshot(path=os.path.join(SHOTS, f'{shot_n[0]:03d}_{name}.png'))

        shot('title')
        click_btn('new')
        pg.wait_for_timeout(400)
        for _ in range(12):
            if pg.evaluate('GR18.scene()') != 'story':
                break
            pg.mouse.click(*px(640, 360)); pg.wait_for_timeout(300)
            pg.mouse.click(*px(640, 360)); pg.wait_for_timeout(200)

        casts = 0; shifts = 0; quiet_tries = 0
        reloaded = False
        last_scene = None
        guard = 0
        stuck = {}
        shot_rooms = set()
        while guard < 6000:
            guard += 1
            sc = pg.evaluate('GR18.scene()')
            ov = pg.evaluate('GR18.overlay()')
            if sc != last_scene:
                say('scene ->', sc)
                last_scene = sc
            if sc == 'ending':
                pg.wait_for_timeout(800)
                shot('ending')
                say('ENDING reached')
                break
            if sc == 'story':
                pg.mouse.click(*px(640, 360)); pg.wait_for_timeout(260)
                pg.mouse.click(*px(640, 360)); pg.wait_for_timeout(160)
                continue
            if ov == 'items':
                pg.wait_for_timeout(300)
                shot('items')
                click_btn('take'); pg.wait_for_timeout(300)
                continue
            if ov == 'editor':
                for _ in range(80):
                    plan = pg.evaluate('GR18.planEditor()')
                    if not plan:
                        break
                    if plan['key'] == 'close':
                        shot('editor')
                        st = pg.evaluate("GR18.state().reels.map(r => r.strip.map(c => ({sword:'剣',fire:'炎',ice:'氷',bolt:'雷',light:'光',star:'星',gap:'・'})[c.k] + (c.lv > 1 ? c.lv : '')).join('')).join(' | ')")
                        say('reels:', st)
                        click_btn('close')
                        break
                    if not click_btn(plan['key']):
                        say('editor click failed', plan)
                        pg.keyboard.press('Escape')
                        break
                    pg.wait_for_timeout(60)
                pg.wait_for_timeout(200)
                continue
            if ov:
                pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
                continue
            if sc == 'map':
                if pg.evaluate('GR18.busy()'):
                    idle(); continue
                at = pg.evaluate('GR18.state().at')
                stn = pg.evaluate(f"GR18.G.room('{at}').st")
                if RELOAD and not reloaded and stn == 2:
                    reloaded = True
                    say('reload at', at)
                    pg.reload(); pg.wait_for_timeout(700)
                    if FAST:
                        pg.evaluate('GR18.cfg.fast = true')
                    click_btn('cont'); pg.wait_for_timeout(600)
                    continue
                need_edit = pg.evaluate("(() => { const s = GR18.state(); return s.bag.some(c => c.k !== 'sword') || s.forge > 0; })()")
                if need_edit:
                    click_btn('editor'); pg.wait_for_timeout(300)
                    continue
                if UNTIL and at == UNTIL:
                    shot('until_' + at)
                    say('stop at', at)
                    break
                # 次に行く部屋
                target = None
                for rid in ROUTE:
                    done = pg.evaluate(f"(() => {{ const s = GR18.state(), G = GR18.G; return G.visited(s, '{rid}') && G.roomDone(s, '{rid}'); }})()")
                    if done:
                        continue
                    path = pg.evaluate(f"GR18.path('{rid}')")
                    if path is None and rid != at:
                        continue
                    if rid == at:
                        # 壁が残っているだけなら、静かな詠唱は戦いのあとに試すので、ここでは先へ
                        walls = pg.evaluate(f"GR18.G.roomWalls(GR18.state(), '{rid}').length")
                        if walls and stuck.get(rid, 0) < 2:
                            stuck[rid] = stuck.get(rid, 0) + 1
                            target = rid
                            break
                        continue
                    target = rid
                    break
                if not target:
                    say('no target; at', at)
                    shot('stuck')
                    break
                if target != at:
                    say('walk ->', target)
                    click_room(target)
                else:
                    say('quiet at', target)
                    click_btn('quiet')
                pg.wait_for_timeout(300)
                idle()
                pg.wait_for_timeout(200)
                continue
            if sc == 'battle':
                info = pg.evaluate('(() => { const s = GR18.state(), b = s.b, bs = GR18.bs(); return { kind: b ? b.kind : null, phase: b ? b.phase : null, over: bs && bs.over ? bs.over.kind : null, overT: bs && bs.over ? bs.over.t : 0, room: b ? b.room : null, turn: b ? b.turn : 0, hp: b ? b.hp : 0 }; })()')
                if '-v' in args:
                    say('  battle', json.dumps(info, ensure_ascii=False))
                if pg.evaluate('GR18.busy()'):
                    idle(); continue
                if info['over']:
                    if info['overT'] < 1.0:
                        pg.wait_for_timeout(250); continue
                    shot(f'over_{info["room"]}_{info["over"]}')
                    say(f'battle end {info["room"]} {info["kind"]} {info["over"]} turn={info["turn"]} hp={info["hp"]}')
                    if info['over'] == 'win':
                        pk = pg.evaluate('(() => { const s = GR18.state(); return s.b && s.b.pick ? GR18.G.choosePick(s, s.b.pick) : -1; })()')
                        if pk >= 0:
                            click_btn('pick' + str(pk)); pg.wait_for_timeout(300)
                            say('  picked', pg.evaluate('JSON.stringify(GR18.bs().over.picked)'))
                        rem = pg.evaluate('GR18.bs().over.remain')
                        if rem and stuck.get(info['room'] + '_q', 0) < 1:
                            stuck[info['room'] + '_q'] = 1
                            click_btn('quiet') or click_btn('next')
                        else:
                            click_btn('next')
                    elif info['over'] == 'lose':
                        click_btn('retry')
                    else:
                        click_btn('next')
                    pg.wait_for_timeout(400)
                    quiet_tries = 0
                    continue
                if info['kind'] == 'quiet':
                    if quiet_tries >= 14:
                        say('quiet give up', info['room'])
                        click_btn('leave'); pg.wait_for_timeout(400); quiet_tries = 0
                        continue
                if info['phase'] == 'spin':
                    if info['room'] not in shot_rooms:
                        shot_rooms.add(info['room'])
                        shot(f'ready_{info["room"]}_{info["kind"]}')
                    if KEYS:
                        pg.keyboard.press('Space')
                    else:
                        click_btn('main')
                    idle()
                    continue
                if info['phase'] == 'aim':
                    if not NOSHIFT:
                        sug = pg.evaluate('GR18.suggest()') or []
                        for i, d in enumerate(sug):
                            d = int(d)
                            for _ in range(abs(d)):
                                if KEYS:
                                    pg.keyboard.press(('qwert' if d < 0 else 'asdfg')[i])
                                else:
                                    click_btn(('up' if d < 0 else 'dn') + str(i))
                                shifts += 1
                                pg.wait_for_timeout(40)
                    if info['turn'] == 1 and info['kind'] == 'battle':
                        shot(f'aim_{info["room"]}')
                    for _ in range(2):
                        if KEYS:
                            pg.keyboard.press('Space')
                        else:
                            click_btn('main')
                        pg.wait_for_timeout(100)
                        if pg.evaluate('GR18.busy()') or pg.evaluate('GR18.phase()') != 'aim':
                            break
                    casts += 1
                    if info['kind'] == 'quiet':
                        quiet_tries += 1
                    idle()
                    continue
                pg.wait_for_timeout(100)
                continue
            if sc == 'title':
                click_btn('cont'); pg.wait_for_timeout(400)
                continue
            pg.wait_for_timeout(150)
        st = pg.evaluate('(() => { const s = GR18.state(); return { at: s.at, stats: s.stats, reels: s.reels.length, mp: s.mpMax, hp: s.hpMax, walls: Object.keys(s.walls) }; })()')
        say('result', json.dumps(st, ensure_ascii=False), 'casts', casts, 'shifts', shifts)
        br.close()
    if errs:
        say('PAGE ERRORS:', *errs)
    else:
        say('page errors: 0')

if __name__ == '__main__':
    main()
