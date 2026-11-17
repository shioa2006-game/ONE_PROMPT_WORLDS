# 題字から結末まで、実際のマウスクリックだけで通しで遊ぶ
#   python tools/playthrough.py [大名番号=19] [--shots 出力フォルダ] [--reload] [--speed 4] [--policy bold]
# 何をするかは CPU と同じ思考（K13.AI.choose）に決めさせ、その一手を画面のボタンと地図のクリックに置きかえる。
# 内部状態を書きかえる操作は使わない（速度の倍率だけ変える）。
import sys, json, os, time
from playwright.sync_api import sync_playwright

args = sys.argv[1:]
clan = int(args[0]) if args and not args[0].startswith('--') else 19
def opt(name, default=None):
    return args[args.index(name) + 1] if name in args else default
shots = opt('--shots'); speed = float(opt('--speed', '4')); policy = opt('--policy', 'smart')
POL = {'smart': '{}', 'bold': '{aggr:0.9}', 'turtle': '{noAttack:true}'}[policy]
url = 'file:///' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html')).replace('\\', '/')
if shots: os.makedirs(shots, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(url); pg.wait_for_function('window.K13 && K13.st')

    def state(): return pg.evaluate('K13.debug.state()')
    def click(bid):
        bs = pg.evaluate('K13.debug.buttons()')
        hit = [x for x in bs if x['id'] == bid]
        if not hit: raise Exception('ボタンがない: %s / %s / %s' % (bid, [x['id'] for x in bs], state()))
        pg.mouse.click(hit[0]['x'], hit[0]['y']); time.sleep(0.03)
    def prov(i):
        q = pg.evaluate('K13.debug.prov(%d)' % i); pg.mouse.click(q['x'], q['y']); time.sleep(0.03)
    def shot(name):
        if shots: pg.screenshot(path=os.path.join(shots, name + '.png'))
    def wait_idle(limit=30):
        t0 = time.time()
        while time.time() - t0 < limit:
            s = state()
            if s['screen'] != 'play' or (s['q'] == 0 and s['phase'] in ('roll', 'act')): return s
            time.sleep(0.05)
        raise Exception('待ち切れ: %s' % state())

    click('start'); time.sleep(0.2); shot('select')
    click('clan%d' % clan); click('begin')
    pg.evaluate('K13.st.speed = %f' % speed)
    turns = 0; acts = 0; reloaded = False; log = []
    while True:
        s = wait_idle()
        if s['screen'] == 'result': break
        if s['phase'] == 'roll':
            if '--reload' in args and s['turn'] == 6 and not reloaded:
                reloaded = True
                pg.reload(); pg.wait_for_function('window.K13 && K13.st'); time.sleep(0.3)
                click('cont'); pg.evaluate('K13.st.speed = %f' % speed)
                s2 = wait_idle(); print('つづきから: turn', s2['turn'], 'phase', s2['phase'])
                assert s2['turn'] == 6 and s2['phase'] == 'roll'
            click('roll'); turns += 1
            if s['turn'] in (0, 1, 5, 10, 15, 19): time.sleep(0.5); shot('t%02d_a' % s['turn'])
            continue
        # 采配
        a = pg.evaluate('(function(){var G=K13.st.G; return K13.AI.choose(G, G.player, %s);})()' % POL)
        if not a:
            if s['turn'] in (1, 5, 10, 15, 19): shot('t%02d_b' % s['turn'])
            click('end')
            bs = [x['id'] for x in pg.evaluate('K13.debug.buttons()')]
            if state()['phase'] == 'act': click('end')   # 確認の2度押し
            time.sleep(0.05); continue
        acts += 1
        k = a['k']
        if k == 'reroll': click('reroll'); continue
        if k == 'buy': click('buy'); time.sleep(0.5 / speed + 0.1); continue
        if k == 'flip': click('die%d' % a['di']); click('flip'); time.sleep(0.4 / speed + 0.1); continue
        if k in ('develop', 'fortify', 'recruit', 'guard'):
            click('die%d' % a['di']); prov(a['p']); click('a_' + k); continue
        if k == 'move':
            click('die%d' % a['di']); prov(a['from']); click('a_attack'); prov(a['to'])
            assert state()['mode'] == 'move', state()
            click('go'); continue
        if k == 'attack':
            click('die%d' % a['dis'][0]); prov(a['from']); click('a_attack'); prov(a['to'])
            st = state(); assert st['mode'] == 'attack', st
            cur = pg.evaluate('K13.st.atk.n')
            for _ in range(cur - a['n']): click('n-')
            if len(a['dis']) > 1: click('stack%d' % a['dis'][1])
            if acts % 7 == 0: shot('atk_t%02d' % s['turn'])
            click('go')
            if acts % 7 == 0: time.sleep(1.2 / speed); shot('atk_t%02d_clash' % s['turn'])
            continue
        raise Exception('知らない手 %s' % a)
    time.sleep(1.0); shot('result')
    s = state()
    print('結末:', json.dumps(s['res'], ensure_ascii=False), 'over', s['over'], '番数', turns, '采配', acts)
    if s['res']['type'] == 'dead':
        click('watch'); time.sleep(0.5); shot('result_after'); print('その後:', state()['over'])
    click('again'); time.sleep(0.3)
    s = wait_idle(); print('再挑戦:', s['screen'], s['phase'], 'turn', s['turn'])
    assert s['screen'] == 'play' and s['turn'] == 0
    print('ERRORS:' if errs else 'エラーなし', errs[:10])
    b.close()
