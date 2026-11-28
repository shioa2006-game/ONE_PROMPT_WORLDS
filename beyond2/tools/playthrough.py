# GUILDWARD — タイトルから第一章の結末まで、本物のマウスとキーで通す（Playwright + Edge ヘッドレス）
# 使い方: python tools/playthrough.py [--shots DIR] [--reload] [--fast] [--policy greedy|simple] [--order m1:GS,m2:GS,...]
#   ギルド：依頼板・依頼の札・「だれと行く？」の仲間の札・出発・帰還の場面を、画面のボタンを本物のクリックで押す
#   依頼の地図：tools/routes.js の手順を、画面の位置を聞いて本物のクリックに置きかえる
#   戦い：tools/bot.js（ページ内）の選んだ行動を、仲間の選択（数字キー）＋クリック＋Space に置きかえる
#   --reload: 依頼から帰るたびにページを読みなおし、タイトルの「つづきから」で再開できるかも確かめる
import json, os, sys, time, subprocess
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file:///' + os.path.join(ROOT, 'index.html').replace('\\', '/')
PARTY = {'GS': ['gard', 'sena'], 'GT': ['gard', 'tobi'], 'ST': ['sena', 'tobi']}
DEFAULT_ORDER = 'm1:GS,m2:GS,m3:GS,m4:ST,m5:GT,m6:GS'
BUY_AFTER = {'m3': ['bow'], 'm5': ['gauntlet']}


def load_routes():
    out = subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify(require('./tools/routes.js')))"], cwd=ROOT)
    return json.loads(out.decode('utf-8'))


def main():
    args = sys.argv[1:]
    shots = args[args.index('--shots') + 1] if '--shots' in args else None
    if shots:
        os.makedirs(shots, exist_ok=True)
    reload_each = '--reload' in args
    fast = '--fast' in args
    policy = args[args.index('--policy') + 1] if '--policy' in args else 'greedy'
    order = [x.split(':') for x in (args[args.index('--order') + 1] if '--order' in args else DEFAULT_ORDER).split(',')]
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

        def setup():
            pg.add_script_tag(path=os.path.join(ROOT, 'tools', 'bot.js'))
            if fast:
                pg.evaluate("G21.setOpt({fast: true})")
        setup()

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

        def idle(limit=30):
            t0 = time.time()
            pg.wait_for_timeout(120)
            while time.time() - t0 < limit and pg.evaluate('G21.busy()'):
                pg.wait_for_timeout(60)
            pg.wait_for_timeout(120)

        def btn(name, wait=150):
            pg.wait_for_timeout(wait)
            bs = pg.evaluate('G21.buttons()')
            hit = [b for b in bs if b['key'] == name and not b['off']]
            if not hit:
                raise RuntimeError('ボタンがない: ' + name + ' ' + str([b['key'] for b in bs]))
            click_at(hit[-1]['x'], hit[-1]['y'])

        def hub():
            return pg.evaluate('HUB21.debug()')

        def sig():
            return pg.evaluate("JSON.stringify([G21.state().units.map(u=>[u.x,u.y,u.hp,u.ko,u.acted,u.safe]), G21.state().objs.map(o=>[o.x,o.y,o.gone,o.open,o.hit,o.down,o.frozen,o.lit]), G21.state().t.join(''), G21.state().links.length, G21.state().mode])")

        def hero_key(hero):
            ids = pg.evaluate("G21.state().units.filter(u => u.team === 'h').map(u => u.id)")
            return str(ids.index(hero) + 1) if hero in ids else None

        def target_point(hero, intent):
            k = intent['k']
            ref = intent.get('ref')
            if k == 'move':
                return pg.evaluate(f"G21.cellScreen({intent['x']}, {intent['y']})")
            if k == 'blast':
                x, y = intent['x'], intent['y']
                u = pg.evaluate(f"(() => {{ const u = G21.S.unitAt(G21.state(), {x}, {y}); return u && u.team === 'e' ? u.id : null }})()")
                if u:
                    return pg.evaluate(f"G21.unitScreen('{u}')")
                o = pg.evaluate(f"(() => {{ const o = G21.state().objs.find(o => !o.gone && o.k === 'crack' && o.x === {x} && o.y === {y}); return o ? o.id : null }})()")
                if o:
                    return pg.evaluate(f"G21.objScreen('{o}')")
                return pg.evaluate(f"G21.cellScreen({x}, {y})")
            if k == 'freeze' and not ref:
                c = pg.evaluate(f"G21.cellScreen({intent['x']}, {intent['y']})")
                return {'x': c['x'], 'y': c['y'] - 6}
            if k == 'rope':
                return pg.evaluate(f"G21.objScreen('{intent['o']}')")
            if k == 'push':
                c = pg.evaluate(f"G21.entCenter({json.dumps(ref)})")
                off = pg.evaluate(f"G21.dirOffset({intent['dir']})")
                return {'x': c['x'] + off[0], 'y': c['y'] + off[1]}
            if ref and 'u' in ref:
                return pg.evaluate(f"G21.unitScreen('{ref['u']}')")
            if ref and 'o' in ref:
                return pg.evaluate(f"G21.objScreen('{ref['o']}')")
            return None

        def matches(h, hero, intent):
            if not h or not h.get('plan') or not h['plan'].get('ok'):
                return False
            a = h['plan']['intent']
            if a.get('k') != intent['k'] or h['plan'].get('hero') != hero:
                return False
            for f in ('x', 'y', 'o', 'dir'):
                if f in intent and a.get(f) != intent[f]:
                    return False
            if 'ref' in intent and a.get('ref') != intent['ref']:
                return False
            return True

        def aim(hero, intent):
            if pg.evaluate('!!(G21.G.camLook && G21.G.camLook.intro)'):
                key('Space'); pg.wait_for_timeout(900)
                stats['skip'] = stats.get('skip', 0) + 1
            pt = target_point(hero, intent)
            if not pt:
                return None
            if not (30 < pt['x'] < 1250 and 100 < pt['y'] < 590):
                dx, dy = (pt['x'] - 640) / 2, (pt['y'] - 330) / 2
                pg.evaluate(f"G21.G.camOff[0] += {dx}; G21.G.camOff[1] += {dy}")
                stats['pans'] = stats.get('pans', 0) + 1
                pg.wait_for_timeout(900)
                pt = target_point(hero, intent)
            for _ in range(6):
                br_ = pg.evaluate("(() => { const r = G21.G.bubbleRect; return r && G21.G.bubbles.length ? r : null; })()")
                if not br_ or not (br_['x'] - 20 <= pt['x'] <= br_['x'] + br_['w'] + 20 and br_['y'] - 20 <= pt['y'] <= br_['y'] + br_['h'] + 20):
                    break
                click_at(br_['x'] + br_['w'] / 2, br_['y'] + br_['h'] / 2)
                stats['bubble'] = stats.get('bubble', 0) + 1
                pg.wait_for_timeout(150)
                pt = target_point(hero, intent)
            offs = [(0, 0), (0, -6), (0, 6), (-6, 0), (6, 0), (0, -12), (-8, -8), (8, -8), (0, 12), (-12, 0), (12, 0), (-8, 8), (8, 8), (0, -18), (0, -24)]
            for k, (ox, oy) in enumerate(offs):
                px, py = to_px(pt['x'] + ox, pt['y'] + oy)
                pg.mouse.move(px, py)
                pg.wait_for_timeout(50)
                h = pg.evaluate('G21.hover()')
                if matches(h, hero, intent):
                    if k:
                        stats['adjust'] = stats.get('adjust', 0) + 1
                    return (pt['x'] + ox, pt['y'] + oy)
            return None

        def do(hero, intent, label=''):
            mode = pg.evaluate('G21.state().mode')
            cur = pg.evaluate('G21.G.sel')
            if cur != hero and (mode == 'combat' or intent['k'] in ('move', 'blast')):
                kk = hero_key(hero)
                if kk:
                    key(kk); pg.wait_for_timeout(80)
            before = sig()
            at = aim(hero, intent)
            if at:
                click_at(at[0], at[1])
                pg.wait_for_timeout(60)
            changed = sig() != before or pg.evaluate('G21.busy()')
            if not changed:
                h = pg.evaluate('JSON.stringify(G21.hover())')
                print('  ! クリックが効かない', hero, json.dumps(intent, ensure_ascii=False), label, h)
                stats['fallback'] += 1
                r = pg.evaluate(f"JSON.stringify(G21.act('{hero}', {json.dumps(intent)}))")
                if '"ok":false' in r:
                    print('  !! 口からも失敗', r)
            idle()

        def fight(tag):
            stats['fights'] += 1
            n = 0
            while pg.evaluate('G21.state().mode') == 'combat' and n < 40:
                if pg.evaluate('G21.G.loseMenu'):
                    print('  負けた → この手番の始めから')
                    btn('retryPhase'); idle(); continue
                plans = pg.evaluate(f"JSON.stringify(BOT21.planPhase(G21.state(), '{policy}'))")
                for pl in json.loads(plans):
                    if pg.evaluate('G21.state().mode') != 'combat':
                        break
                    do(pl['hero'], pl['intent'], 'combat')
                if pg.evaluate('G21.state().mode') != 'combat':
                    break
                if n == 0:
                    shot(tag + '_turn1_end')
                key('Space')
                stats['turns'] += 1
                idle(30)
                n += 1
            shot(tag + '_won')

        def hub_seq(tag):
            # 帰還の場面（報酬・話・ランク・加入・知らせ・結末）を、本物のクリックで送る
            for _ in range(60):
                d = hub()
                pn = d['panel']
                if pn in (None, 'board', 'menu'):
                    return
                if pn == 'result':
                    pg.wait_for_timeout(300)
                    if d['count'] < 1:
                        pg.wait_for_timeout(700)
                        continue
                    shot(tag + '_result'); btn('resnext'); continue
                if pn in ('rank', 'join', 'news'):
                    pg.wait_for_timeout(900)
                    shot(tag + '_' + pn)
                    btn({'rank': 'ranknext', 'join': 'joinnext', 'news': 'newsnext'}[pn]); continue
                if pn == 'talk':
                    pg.wait_for_timeout(350)
                    click_at(640, 560); continue
                if pn == 'ending':
                    e = d['ending']
                    pg.wait_for_timeout(700)
                    if e and e['final']:
                        pg.wait_for_timeout(800)
                        shot('90_chapter_end')
                        return
                    if e and e['k'] == 1:
                        shot('89_epilogue')
                    click_at(640, 400); continue
                pg.wait_for_timeout(300)

        # ---- タイトル → はじめから → 前口上 → ギルド ----
        shot('00_title')
        btn('new')
        pg.wait_for_timeout(400)
        shot('01_prologue')
        for _ in range(8):
            if pg.evaluate('G21.scene()') != 'story':
                break
            pg.wait_for_timeout(420)
            click_at(640, 400)
        pg.wait_for_timeout(600)
        shot('02_guild_first')
        hub_seq('02')
        first_board_by_world = True
        for idx, (mid, pk) in enumerate(order):
            party = PARTY[pk]
            t0 = time.time()
            # 依頼板をひらく（最初の一回は、広間の依頼板そのものを押す）
            if first_board_by_world:
                pt = pg.evaluate("(() => { const r = G21.R.objRects.find(q => q.id === 'board'); return r ? { x: (r.x + r.w / 2) * 2, y: (r.y + r.h / 2) * 2 } : null })()")
                click_at(pt['x'], pt['y'])
                idle()
                pg.wait_for_timeout(300)
                first_board_by_world = False
                if hub()['panel'] != 'board':
                    print('  ! 依頼板を押してもひらかない', hub())
                    btn('h_board')
            else:
                btn('h_board')
            pg.wait_for_timeout(300)
            btn('req_' + mid)
            pg.wait_for_timeout(200)
            shot(f'{10 + idx * 10}_{mid}_board')
            btn('take')
            pg.wait_for_timeout(300)
            for _ in range(4):
                pick = hub()['pick']
                if sorted(pick) == sorted(party):
                    break
                need = [x for x in party if x not in pick][0]
                btn('pick_' + need)
                pg.wait_for_timeout(150)
            shot(f'{10 + idx * 10}_{mid}_party')
            btn('depart')
            pg.wait_for_timeout(1800)
            idle()
            pg.wait_for_timeout(1500)
            shot(f'{11 + idx * 10}_{mid}_start')
            if pg.evaluate('G21.state().mode') == 'combat':
                fight(f'{11 + idx * 10}_{mid}_fight0')
            rt = routes[mid].get(pk) or routes[mid]['GS']
            for k, step in enumerate(rt):
                hero, intent = step[0], step[1]
                skip = step[2] if len(step) > 2 else None
                if skip and pg.evaluate(f"!!G21.state().flags['{skip}']"):
                    continue
                do(hero, intent)
                if pg.evaluate('G21.state().mode') == 'combat':
                    shot(f'{12 + idx * 10}_{mid}_fight{k}')
                    fight(f'{12 + idx * 10}_{mid}_fight{k}')
                    # 戦いの直後はカメラが探索の位置へ戻る途中。止まるのを待ってからねらう（v0.1 で追加）
                    idle()
                    pg.wait_for_timeout(1500)
            idle()
            pg.wait_for_timeout(1200)
            cleared = pg.evaluate('!!G21.state().flags.cleared')
            print(f'{mid} {pk}: {time.time() - t0:.1f}秒  達成 {cleared}  字幕「{pg.evaluate("G21.caption()")}」')
            shot(f'{13 + idx * 10}_{mid}_cleared')
            btn('goGuild')
            pg.wait_for_timeout(1800)
            hub_seq(f'{14 + idx * 10}_{mid}')
            shot(f'{15 + idx * 10}_{mid}_guild')
            for item in BUY_AFTER.get(mid, []):
                btn('h_shop'); pg.wait_for_timeout(300)
                if hub()['panel'] == 'talk':
                    click_at(640, 560); pg.wait_for_timeout(400)
                try:
                    btn('buy_' + item)
                    print('  鍛冶屋で', item, '銀貨', pg.evaluate('G21.prof().coins'))
                except RuntimeError as e:
                    print('  買えなかった', item, e)
                pg.wait_for_timeout(300)
                shot(f'{16 + idx * 10}_{mid}_shop')
                btn('closeshop')
            if pg.evaluate('!!G21.prof().chapterDone'):
                break
            if reload_each:
                pg.wait_for_timeout(300)
                pg.reload()
                pg.wait_for_timeout(700)
                setup()
                btn('cont')
                pg.wait_for_timeout(800)
                print('  読みなおし → つづきから:', pg.evaluate('G21.scene()'), pg.evaluate('G21.prof().coins'), '銀貨')
        # 結末のあと
        bs = [b['key'] for b in pg.evaluate('G21.buttons()')]
        print('結末の画面のボタン:', bs)
        if 'end_guild' in bs:
            btn('end_guild')
            pg.wait_for_timeout(1200)
            hub_seq('95')
            btn('h_board'); pg.wait_for_timeout(300)
            if any(b['key'] == 'req_ch2' for b in pg.evaluate('G21.buttons()')):
                btn('req_ch2'); pg.wait_for_timeout(200)
                shot('96_board_teaser')
                print('第二章の予告が依頼板にある')
            btn('closeboard')
        print('所要（ゲーム内）:', round(pg.evaluate('G21.prof().time')), '秒  銀貨', pg.evaluate('G21.prof().coins'), '  ランク', pg.evaluate('G21.C ? 0 : 0'))
        br.close()
    print(f"クリック {stats['clicks']}、キー {stats['keys']}、戦い {stats['fights']}、手番終了 {stats['turns']}、見わたし {stats.get('pans', 0)}、ねらい直し {stats.get('adjust', 0)}、見わたしを飛ばす {stats.get('skip', 0)}、吹き出し送り {stats.get('bubble', 0)}、口で代行 {stats['fallback']}、かかった時間 {time.time() - t_start:.0f}秒（ツール込み）")
    if errs:
        print('ERRORS:', *errs[:20], sep='\n  ')
    else:
        print('no page errors')


if __name__ == '__main__':
    main()
