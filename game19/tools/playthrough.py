# せーの、星見の露台へ — タイトルから結末まで、本物のマウスとキーで通す（Playwright + Edge ヘッドレス）
# 使い方: python tools/playthrough.py [--shots DIR] [--reload] [--fast] [--policy greedy|simple] [--until s3]
#   探索: tools/routes.js の手順を、画面の位置を聞いて本物のクリックに置きかえる
#   戦い: tools/bot.js（ページ内）の選んだ行動を、仲間の選択（1・2・3キー）＋クリック＋Space に置きかえる
#   --reload: 区画ごとにページを読みなおし、タイトルの「つづきから」で再開できるかも確かめる
import json, os, re, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file:///' + os.path.join(ROOT, 'index.html').replace('\\', '/')
KEY = {'gard': '1', 'riko': '2', 'sena': '3'}


def load_routes():
    # routes.js を node なしで読む（JSON に近い形なので、少し直して eval する代わりに node で出力）
    import subprocess
    out = subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify(require('./tools/routes.js')))"], cwd=ROOT)
    return json.loads(out.decode('utf-8'))


def main():
    args = sys.argv[1:]
    shots = None
    if '--shots' in args:
        shots = args[args.index('--shots') + 1]
        os.makedirs(shots, exist_ok=True)
    reload_each = '--reload' in args
    fast = '--fast' in args
    policy = args[args.index('--policy') + 1] if '--policy' in args else 'greedy'
    until = args[args.index('--until') + 1] if '--until' in args else None
    routes = load_routes()
    errs = []
    stats = {'clicks': 0, 'keys': 0, 'fallback': 0, 'turns': 0, 'fights': 0}
    t_start = time.time()
    with sync_playwright() as p:
        br = p.chromium.launch(channel='msedge')
        pg = br.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        pg.goto(URL)
        pg.wait_for_timeout(500)
        pg.add_script_tag(path=os.path.join(ROOT, 'tools', 'bot.js'))
        if fast:
            pg.evaluate("G19.setOpt({fast: true})")

        def shot(name):
            if shots:
                pg.screenshot(path=os.path.join(shots, name + '.png'))

        def to_px(x, y):
            r = pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width / 1280]; })()")
            return r[0] + x * r[2], r[1] + y * r[2]

        def click_at(x, y):
            px, py = to_px(x, y)
            pg.mouse.move(px, py)
            pg.wait_for_timeout(70)
            pg.mouse.down(); pg.mouse.up()
            stats['clicks'] += 1

        def key(k):
            pg.keyboard.press(k)
            stats['keys'] += 1

        def idle(limit=20):
            t0 = time.time()
            pg.wait_for_timeout(120)
            while time.time() - t0 < limit and pg.evaluate('G19.busy()'):
                pg.wait_for_timeout(60)
            pg.wait_for_timeout(120)

        def btn(name):
            pg.wait_for_timeout(150)
            bs = pg.evaluate('G19.buttons()')
            hit = [b for b in bs if b['key'] == name]
            if not hit:
                raise RuntimeError('ボタンがない: ' + name + ' ' + str([b['key'] for b in bs]))
            click_at(hit[-1]['x'], hit[-1]['y'])

        def sig():
            return pg.evaluate("JSON.stringify([G19.state().units.map(u=>[u.x,u.y,u.hp,u.ko,u.acted]), G19.state().objs.map(o=>[o.x,o.y,o.gone,o.open,o.hit,o.down,o.frozen,o.lit]), G19.state().t.join(''), G19.state().links.length, G19.state().mode, G19.state().sec])")

        def target_point(hero, intent):
            k = intent['k']
            ref = intent.get('ref')
            if k == 'move':
                return pg.evaluate(f"G19.cellScreen({intent['x']}, {intent['y']})")
            if k == 'freeze' and not ref:
                c = pg.evaluate(f"G19.cellScreen({intent['x']}, {intent['y']})")
                return {'x': c['x'], 'y': c['y'] - 6}
            if k == 'rope':
                return pg.evaluate(f"G19.objScreen('{intent['o']}')")
            if k == 'light':
                o = pg.evaluate("G19.state().objs.find(o => o.k === 'lantern').id")
                return pg.evaluate(f"G19.objScreen('{o}')")
            if k == 'push':
                c = pg.evaluate(f"G19.entCenter({json.dumps(ref)})")
                off = pg.evaluate(f"G19.dirOffset({intent['dir']})")
                return {'x': c['x'] + off[0], 'y': c['y'] + off[1]}
            if ref and 'u' in ref:
                return pg.evaluate(f"G19.unitScreen('{ref['u']}')")
            if ref and 'o' in ref:
                return pg.evaluate(f"G19.objScreen('{ref['o']}')")
            return None

        def matches(h, hero, intent):
            if not h or not h.get('plan') or not h['plan'].get('ok'):
                return False
            a = h['plan']['intent']
            if a.get('k') != intent['k']:
                return False
            if h['plan'].get('hero') != hero and intent['k'] not in ('light',):
                return False
            for f in ('x', 'y', 'o', 'dir'):
                if f in intent and a.get(f) != intent[f]:
                    return False
            if 'ref' in intent and a.get('ref') != intent['ref']:
                return False
            return True

        def aim(hero, intent):
            # 人と同じように：見えていなければ見わたし、指してみて、ずれていれば少し動かす
            # 区画に入ったときの見わたしの最中なら、まず Space で飛ばす
            if pg.evaluate('!!(G19.G.camLook && G19.G.camLook.intro)'):
                key('Space'); pg.wait_for_timeout(900)
                stats['skip'] = stats.get('skip', 0) + 1
            pt = target_point(hero, intent)
            if not pt:
                return None
            if not (30 < pt['x'] < 1250 and 90 < pt['y'] < 590):
                dx, dy = (pt['x'] - 640) / 2, (pt['y'] - 330) / 2
                pg.evaluate(f"G19.G.camOff[0] += {dx}; G19.G.camOff[1] += {dy}")
                stats['pans'] = stats.get('pans', 0) + 1
                pg.wait_for_timeout(900)
                pt = target_point(hero, intent)
            # 吹き出しがねらう所にかぶっていたら、人と同じように吹き出しを押して送る
            for _ in range(5):
                br = pg.evaluate("(() => { const r = G19.G.bubbleRect; return r && G19.G.bubbles.length ? r : null; })()")
                if not br or not (br['x'] - 20 <= pt['x'] <= br['x'] + br['w'] + 20 and br['y'] - 20 <= pt['y'] <= br['y'] + br['h'] + 20):
                    break
                click_at(br['x'] + br['w'] / 2, br['y'] + br['h'] / 2)
                stats['bubble'] = stats.get('bubble', 0) + 1
                pg.wait_for_timeout(120)
                pt = target_point(hero, intent)
            offs = [(0, 0), (0, -6), (0, 6), (-6, 0), (6, 0), (0, -12), (-8, -8), (8, -8), (0, 12), (-12, 0), (12, 0), (-8, 8), (8, 8), (0, -18)]
            for k, (ox, oy) in enumerate(offs):
                px, py = to_px(pt['x'] + ox, pt['y'] + oy)
                pg.mouse.move(px, py)
                pg.wait_for_timeout(50)
                h = pg.evaluate('G19.hover()')
                if matches(h, hero, intent):
                    if k:
                        stats['adjust'] = stats.get('adjust', 0) + 1
                    return (pt['x'] + ox, pt['y'] + oy)
            return None

        def do(hero, intent, label=''):
            # 仲間を選んでから、その場所を押す。押したあと状態が変わらなければ、口から直接行う（記録する）
            mode = pg.evaluate('G19.state().mode')
            if mode == 'combat' or intent['k'] == 'move':
                cur = pg.evaluate('G19.G.sel')
                if cur != hero:
                    key(KEY[hero]); pg.wait_for_timeout(80)
            before = sig()
            at = aim(hero, intent)
            if at:
                click_at(at[0], at[1])
                pg.wait_for_timeout(60)
            changed = sig() != before or pg.evaluate('G19.busy()')
            if not changed:
                h = pg.evaluate('JSON.stringify(G19.hover())')
                print('  ! クリックが効かない', hero, json.dumps(intent, ensure_ascii=False), label, h)
                stats['fallback'] += 1
                r = pg.evaluate(f"JSON.stringify(G19.act('{hero}', {json.dumps(intent)}))")
                if '"ok":false' in r:
                    print('  !! 口からも失敗', r)
            idle()

        def fight(tag):
            stats['fights'] += 1
            n = 0
            while pg.evaluate('G19.state().mode') == 'combat' and n < 30:
                if pg.evaluate('G19.G.loseMenu'):
                    print('  負けた → この手番の始めから')
                    btn('retryPhase'); idle(); continue
                plans = pg.evaluate(f"JSON.stringify(BOT19.planPhase(G19.state(), '{policy}'))")
                for pl in json.loads(plans):
                    if pg.evaluate('G19.state().mode') != 'combat':
                        break
                    do(pl['hero'], pl['intent'], 'combat')
                if pg.evaluate('G19.state().mode') != 'combat':
                    break
                if n == 0:
                    shot(tag + '_turn1_end')
                key('Space')
                stats['turns'] += 1
                idle(30)
                n += 1
            shot(tag + '_won')

        # タイトル → はじめから → 前口上
        shot('00_title')
        btn('new')
        pg.wait_for_timeout(400)
        shot('01_prologue')
        for _ in range(8):
            if pg.evaluate('G19.scene()') != 'story':
                break
            pg.wait_for_timeout(420)
            click_at(640, 400)
        pg.wait_for_timeout(600)
        sections = ['s1', 's2', 's3', 's4', 's5', 's6', 's7']
        for si, sec in enumerate(sections):
            idle()
            cur = pg.evaluate('G19.state().sec')
            if cur != sec:
                print('区画がちがう', cur, sec)
            t0 = time.time()
            pg.wait_for_timeout(2600)
            shot(f'{si + 2:02d}_{sec}_start')
            if pg.evaluate('G19.state().mode') == 'combat':
                fight(f'{si + 2:02d}_{sec}_fight0')
            for k, (hero, intent) in enumerate(routes[sec]):
                if pg.evaluate('G19.scene()') != 'play':
                    break
                if pg.evaluate('G19.state().sec') != sec:
                    break
                do(hero, intent)
                if pg.evaluate("G19.G.bloom") and k < 6:
                    pass
                if pg.evaluate('G19.state().mode') == 'combat':
                    shot(f'{si + 2:02d}_{sec}_fight{k}')
                    fight(f'{si + 2:02d}_{sec}_fight{k}')
            idle()
            pg.wait_for_timeout(1600)
            caps = pg.evaluate('G19.caption()')
            print(f'{sec}: {time.time() - t0:.1f}秒  字幕「{caps}」')
            if until and sec == until:
                break
            if reload_each and sec != 's7':
                pg.wait_for_timeout(300)
                pg.reload()
                pg.wait_for_timeout(600)
                pg.add_script_tag(path=os.path.join(ROOT, 'tools', 'bot.js'))
                if fast:
                    pg.evaluate("G19.setOpt({fast: true})")
                btn('cont')
                pg.wait_for_timeout(500)
                print('  読みなおし → つづきから:', pg.evaluate('G19.state().sec'))
        # 結末
        pg.wait_for_timeout(1500)
        print('scene:', pg.evaluate('G19.scene()'))
        shot('90_ending_text')
        for k in range(6):
            if pg.evaluate('G19.scene()') != 'ending':
                break
            pg.wait_for_timeout(700)
            click_at(640, 360)
        pg.wait_for_timeout(600)
        shot('91_record')
        has_again = any(b['key'] == 'again' for b in pg.evaluate('G19.buttons()'))
        print('記録画面のボタン:', [b['key'] for b in pg.evaluate('G19.buttons()')])
        if has_again:
            btn('again')
            pg.wait_for_timeout(600)
            print('もう一度 → scene:', pg.evaluate('G19.scene()'))
            shot('92_again')
        br.close()
    print(f"クリック {stats['clicks']}、キー {stats['keys']}、戦い {stats['fights']}、手番終了 {stats['turns']}、見わたし {stats.get('pans', 0)}、ねらい直し {stats.get('adjust', 0)}、見わたしを飛ばす {stats.get('skip', 0)}、吹き出し送り {stats.get('bubble', 0)}、口で代行 {stats['fallback']}、かかった時間 {time.time() - t_start:.0f}秒（ツール込み）")
    if errs:
        print('ERRORS:', *errs[:20], sep='\n  ')
    else:
        print('no page errors')


if __name__ == '__main__':
    main()
