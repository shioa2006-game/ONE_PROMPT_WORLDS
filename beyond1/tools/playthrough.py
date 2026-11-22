"""賽駆け 天下 — 通し確認（実際のマウス・キー入力で、タイトルから結末まで）
   python tools/playthrough.py [clan] [--seed N] [--shots DIR] [--maxturn T] [--skip] [--reload] [--extend N] [--slot] [--delegate]
   ・手の選び方は CPU と同じ思考（SGT.debug.suggest）を使い、「賽→軍勢→行き先／内政のボタン」の実クリックに変換する。
   ・臣従の申し出は受ける。期間の区切りでは --extend 回まで「延長」、その後「決着」。
   ・--skip で CPU の手番を「飛ばす」ボタンで省略（既定は早送り）。
   ・--reload で途中（3季目）にページを読み直し「つづきから」で再開できるか確かめる。
   ・--slot で 5季目に「記録する」→ 読み直し →「記録から」で再開できるか確かめる。
   ・--delegate で軍勢が4つ以上になったら半分を委任し、残りの賽を委任軍に使わせる。
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
maxturn = int(opt('--maxturn', '9999'))
extend_n = int(opt('--extend', '0'))
skip = '--skip' in args
reload_test = '--reload' in args
slot_test = '--slot' in args
delegate = '--delegate' in args
W, H = int(os.environ.get('VW', 1600)), int(os.environ.get('VH', 900))
if shots:
    os.makedirs(shots, exist_ok=True)


def P(*a):
    print(' '.join(str(x) for x in a), flush=True)


with sync_playwright() as p:
    br = p.chromium.launch(channel='msedge')
    pg = br.new_page(viewport={'width': W, 'height': H})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console.error: ' + m.text) if m.type == 'error' else None)

    def load(url):
        pg.goto(url)
        pg.wait_for_function("window.SGT && document.getElementById('loading').classList.contains('hidden')", timeout=60000)
        pg.wait_for_timeout(300)

    load(BASE + '?seed=' + str(seed))

    def js(code):
        return pg.evaluate(code)

    def btn(name):
        return js('SGT.debug.buttons()').get(name)

    def click(xy, mods=None):
        if mods:
            pg.keyboard.down(mods)
        pg.mouse.move(xy[0], xy[1])
        pg.wait_for_timeout(50)
        pg.mouse.click(xy[0], xy[1])
        if mods:
            pg.keyboard.up(mods)

    def shot(name):
        if shots:
            pg.screenshot(path=os.path.join(shots, name))

    extended = [0]
    decides = [0]
    offers = [0]

    def handle_modals():
        if js('SGT.debug.isOffer()'):
            offers[0] += 1
            if offers[0] <= 2:
                shot('40_offer_%d.png' % offers[0])
            click(btn('b-offer-yes'))
            pg.wait_for_timeout(400)
            return True
        if js('SGT.debug.isDecide()'):
            decides[0] += 1
            shot('50_decide_%d.png' % decides[0])
            if extended[0] < extend_n:
                extended[0] += 1
                P('decide -> extend', extended[0])
                click(btn('b-extend'))
            else:
                P('decide -> conclude')
                click(btn('b-conclude'))
            pg.wait_for_timeout(600)
            return True
        return False

    def wait_idle(timeout=300):
        t0 = time.time()
        while time.time() - t0 < timeout:
            if handle_modals():
                continue
            st = js('(() => ({busy: SGT.debug.busy(), mode: SGT.debug.mode(), cur: SGT.S && SGT.S.cur, me: SGT.S && SGT.S.player, ph: SGT.S && SGT.S.phase}))()')
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

    shot('00_title.png')
    click(btn('b-new'))
    pg.wait_for_timeout(400)
    click(btn('clan_' + clan))
    pg.wait_for_timeout(600)
    shot('01_select.png')
    click(btn('b-go'))
    pg.wait_for_timeout(600)
    if btn('b-intro-go'):
        shot('01b_intro.png')
        click(btn('b-intro-go'))
    pg.wait_for_timeout(1800)
    fast_set = False
    turns = 0
    moves = 0
    govs = {'recruit': 0, 'develop': 0, 'fortify': 0}
    cpu_secs = []
    while True:
        st = wait_idle()
        if st['mode'] == 'result':
            break
        S = js('SGT.debug.state()')
        if S['turn'] >= maxturn:
            P('stop at maxturn', S['turn'])
            break
        if st['ph'] == 'place':
            sg = js('SGT.debug.suggest()')
            click(sg['at'])
            pg.wait_for_timeout(800)
            continue
        if st['ph'] == 'roll':
            if turns == 0:
                shot('02_turn0.png')
            if slot_test and S['turn'] == 5 and not js('window.__slotDone'):
                click(btn('b-menu')); pg.wait_for_timeout(200)
                click(btn('b-m-save')); pg.wait_for_timeout(300)
                shot('60_slots_save.png')
                pg.mouse.click(*js("(() => { const r = document.querySelector('#slot-list .slot[data-i=\"2\"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()"))
                pg.wait_for_timeout(400)
                before = js('SGT.debug.state()')
                load(BASE)
                click(btn('b-load')); pg.wait_for_timeout(300)
                shot('61_slots_load.png')
                pg.mouse.click(*js("(() => { const r = document.querySelector('#slot-list .slot[data-i=\"2\"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()"))
                pg.wait_for_timeout(800)
                after = js('SGT.debug.state()')
                P('slot test', before['turn'], before['kok'], '->', after['turn'], after['kok'], after['phase'])
                js('window.__slotDone = true')
                fast_set = False
                continue
            pg.keyboard.press('Space')
            pg.wait_for_timeout(1200)
            turns += 1
            if reload_test and S['turn'] == 3 and not js('window.__reloadDone'):
                d0 = js('SGT.debug.state()')['dice']
                P('reload test at turn', S['turn'], 'dice', d0)
                load(BASE)
                click(btn('b-cont'))
                pg.wait_for_timeout(900)
                st2 = js('SGT.debug.state()')
                P('after reload', st2['turn'], st2['phase'], 'mine', st2['mine'])
                pg.keyboard.press('Space')
                pg.wait_for_timeout(1200)
                P('dice after reload', js('SGT.debug.state()')['dice'])
                js('window.__reloadDone = true')
                fast_set = False
            continue
        # 委任：軍勢が4つ以上なら後ろ半分を委任
        if delegate:
            arm = js('SGT.debug.state()')['armies']
            if len(arm) >= 4:
                for a in arm[len(arm) // 2:]:
                    if not a['dg']:
                        xy = js("(() => { const el = document.querySelector('.arow .dg[data-id=\"%d\"]'); if (!el) return null; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()" % a['id'])
                        if xy:
                            click(xy)
                            pg.wait_for_timeout(100)
        # 一手ずつ
        for k in range(14):
            if handle_modals():
                continue
            sg = js('SGT.debug.suggest()')
            if not sg or sg['kind'] in ('end', 'roll', 'place'):
                break
            if delegate:
                dg = js('(() => { const a = SGT.S.armies.find(x => x.id === %d); return !!(a && a.dg); })()' % sg['army'])
                if dg:
                    break   # 委任した軍勢は手番の終わりに任せる
            dice = sg['dice']
            b = js('SGT.debug.buttons()')
            click(b['die%d' % dice[0]])
            if len(dice) > 1:
                click(b['die%d' % dice[1]], 'Shift')
            # 画面外の軍勢は、一覧から選ぶ（カメラも寄る）
            vis = js('(() => { const p = SGT.debug.nodeScreen(SGT.S.armies.find(x => x.id === %d).n); return p[0] > 40 && p[1] > 40 && p[0] < innerWidth - 40 && p[1] < innerHeight - 40; })()' % sg['army'])
            if not vis:
                xy = js("(() => { const el = document.querySelector('.arow[data-id=\"%d\"] .pl'); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()" % sg['army'])
                click(xy)
                pg.wait_for_timeout(450)
            else:
                click(js('SGT.debug.nodeScreen(SGT.S.armies.find(x => x.id === %d).n)' % sg['army']))
            pg.wait_for_timeout(80)
            if sg['kind'] == 'prepare':
                pg.locator('#gov .gv[data-target="%d"]' % sg['target']).click()
            elif sg['kind'] == 'govern':
                gb = btn('gov_' + sg['gov'])
                if not gb:
                    P('  ! gov button missing', sg)
                    break
                if shots and sum(govs.values()) < 3:
                    shot('12_gov_%d.png' % sum(govs.values()))
                click(gb)
                govs[sg['gov']] += 1
            else:
                tgt = js('SGT.debug.nodeScreen(%d)' % sg['target'])
                pg.mouse.move(tgt[0], tgt[1])
                pg.wait_for_timeout(100)
                if sg['kind'] == 'attack' and shots and moves < 4:
                    shot('10_forecast_%02d.png' % moves)
                click(tgt)
                if sg['kind'] == 'attack' and shots and moves < 6:
                    pg.wait_for_timeout(1300)
                    shot('11_battle_%02d.png' % moves)
            moves += 1
            t0 = time.time()
            while js('SGT.debug.busy()') and time.time() - t0 < 20:
                pg.wait_for_timeout(100)
            if js('SGT.debug.mode()') == 'result':
                break
        if js('SGT.debug.mode()') == 'result':
            break
        S = js('SGT.debug.state()')
        if S['turn'] in (1, 8, 20, 39, 40, 60) and shots:
            shot('20_turn%02d.png' % S['turn'])
        P('turn', S['turn'], 'kok', S['kok'], 'provs', S['mine'], 'armies', len(S['armies']), 'dice', S['dice'])
        t_end = time.time()
        pg.keyboard.press('Enter')
        pg.wait_for_timeout(200)
        if js("SGT.S.cur === SGT.S.player && SGT.S.phase === 'move' && !SGT.debug.busy()"):
            pg.keyboard.press('Enter')
        pg.wait_for_timeout(300)
        st = wait_idle()
        cpu_secs.append(time.time() - t_end)
        if len(cpu_secs) <= 3 or len(cpu_secs) % 10 == 0:
            P('  cpu phase sec', round(cpu_secs[-1], 1))
        if not fast_set and not skip and '--nofast' not in args:
            b = btn('b-fast')
            if b:
                click(b)
                fast_set = True
        if st['mode'] == 'result':
            break
    pg.wait_for_timeout(1500)
    shot('90_result.png')
    res = js('(() => { const S = SGT.S; return { over: S.over && { kind: S.over.kind, reason: S.over.reason, place: S.over.place, turn: S.over.turn }, mine: S.owner.filter(o => o === S.player).length, turn: S.turn, ext: S.ext, stats: S.clans[S.player], errors: SGT.errors }; })()')
    P('RESULT', json.dumps(res, ensure_ascii=False))
    P('moves', moves, 'govern', govs, 'offers', offers[0], 'cpu sec avg', round(sum(cpu_secs) / max(1, len(cpu_secs)), 1), 'max', round(max(cpu_secs or [0]), 1))
    P('page errors', errs)
    b = btn('b-again')
    if b:
        click(b)
        pg.wait_for_timeout(2500)
        st = js('SGT.debug.state()')
        P('retry ->', st['turn'], st['phase'], 'mine', st['mine'])
        shot('91_retry.png')
    br.close()
