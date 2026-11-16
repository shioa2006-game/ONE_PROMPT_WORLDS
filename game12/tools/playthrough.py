"""
ころころ、ひらけ列島 ― 通しプレイ（検証用）

  python tools/playthrough.py <出力フォルダ> [--speed 3] [--policy smart] [--reload] [--keys]

ヘッドレスの Microsoft Edge（1280×720）で file:// から開き、
  タイトル →「はじめから」→ はじめの話 → 24ターン → 決算4回 → 結果 →「タイトルへ」
を、本物の マウス操作 で 通す。
  ・何を えらぶかは、ページの 中の ボット（KR12.AI.decide、CPU と 同じ考え方）が きめる。
    ボットが 知るのは 画面で わかる 情報と 同じ（地図・持ち物・目的地）。
  ・きめたことは、画面上の ボタン・光っている マスの 位置を 読んで、本物の クリックで 入力する。
  ・--speed は 演出の 早回し（ルールは かわらない）。
  ・--reload … 3ターン目の あなたの番で ページを 読みこみなおし、「つづきから」で 同じ 状態に もどるかを 確かめる。
  ・--keys … サイコロ・OK・おわる を スペースキーで おす（キーボード操作の 確認）。
画面写真と ログ（log.txt）を 出力フォルダに のこす。
"""
import json, sys, time, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri()


def main():
    args = sys.argv[1:]
    out = pathlib.Path(args[0]); out.mkdir(parents=True, exist_ok=True)
    speed = float(args[args.index('--speed') + 1]) if '--speed' in args else 3
    pol = args[args.index('--policy') + 1] if '--policy' in args else 'smart'
    do_reload = '--reload' in args
    use_keys = '--keys' in args
    logf = open(out / 'log.txt', 'w', encoding='utf-8')

    def log(*a):
        s = ' '.join(str(x) for x in a)
        print(s); logf.write(s + '\n'); logf.flush()

    errors = []
    shots = set()
    counts = {'click': 0, 'key': 0, 'decisions': 0}
    t0 = time.time()
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge', headless=True)
        ctx = b.new_context(viewport={'width': 1280, 'height': 720})
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)

        def shot(name, once=True):
            if once and name in shots:
                return
            shots.add(name)
            pg.screenshot(path=str(out / (name + '.png')))
            log('  [写真]', name)

        def buttons():
            return pg.evaluate('KR12.debug.buttons()')

        def click_xy(x, y):
            pg.mouse.move(x, y, steps=2)
            pg.mouse.down(); pg.wait_for_timeout(30); pg.mouse.up()
            counts['click'] += 1

        def btn(bid, tries=40):
            for _ in range(tries):
                for bt in buttons():
                    if bt['id'] == bid and bt['on']:
                        click_xy(bt['x'], bt['y'])
                        return True
                pg.wait_for_timeout(60)
            log('  !! ボタンが みつからない:', bid)
            return False

        def space():
            pg.keyboard.press(' ')
            counts['key'] += 1

        def load():
            pg.goto(URL)
            pg.wait_for_timeout(500)
            pg.evaluate('v => { KR12.debug.speed = v; }', speed)

        load()
        shot('01_title')
        btn('start')
        pg.wait_for_timeout(300)
        shot('02_intro')
        for _ in range(3):
            if use_keys: space()
            else: click_xy(640, 500)
            pg.wait_for_timeout(150)
        reloaded = False
        last_turn = -1
        stuck = 0
        last_sig = None
        seen_banner = set()
        nb = 0
        while True:
            if '--banners' in args:
                bn = pg.evaluate('() => { const b = KR12.U.banner; return b ? { title: b.title, t: b.t } : null; }')
                if bn and bn['t'] > 0.5 and bn['title'] not in seen_banner and nb < 40:
                    seen_banner.add(bn['title']); nb += 1
                    pg.screenshot(path=str(out / ('bn_%02d.png' % nb)))
                    log('  [見出し]', nb, bn['title'])
                mv = pg.evaluate('() => ({ s: KR12.D.stepsLeft, c: KR12.D.cur })')
                if mv['s'] > 1 and mv['c'] != 0:
                    shot('70_cpu_move')
            st = pg.evaluate('KR12.debug.state()')
            if st['screen'] == 'result':
                pg.wait_for_timeout(800)
                shot('99_result')
                res = pg.evaluate('''() => { const G = KR12.debug.G(); return { rank: G.rank, me: G.P[0].st, stamps: G.P[0].stamps.length, open: G.open.filter(o=>o).length, dests: G.destCount }; }''')
                log('結果', json.dumps(res, ensure_ascii=False))
                btn('rtitle')
                pg.wait_for_timeout(400)
                st2 = pg.evaluate('KR12.debug.state()')
                log('タイトルへ ->', st2['screen'])
                shot('100_title_after')
                break
            if st['turn'] != last_turn and st['turn'] >= 0:
                last_turn = st['turn']
                g = pg.evaluate('() => { const G = KR12.debug.G(); return { cash: G.P.map(p=>p.cash), dest: G.dest, open: G.open.filter(o=>o).length }; }')
                log('ターン', st['turn'], '所持金', g['cash'], '目的地', g['dest'], 'ひらいた地方', g['open'], '経過', round(time.time() - t0), '秒')
            sig = json.dumps(st)
            if sig == last_sig:
                stuck += 1
            else:
                stuck = 0; last_sig = sig
            if stuck > 600:
                log('!! 進まない', sig); shot('stuck', False); break
            h = st['human']
            if not h:
                pg.wait_for_timeout(60)
                continue
            # 再開の 確認
            if do_reload and not reloaded and h == 'action' and st['turn'] >= 2:
                before = pg.evaluate('() => { const G = KR12.debug.G(); return JSON.stringify({c: G.P.map(p=>p.cash), n: G.P.map(p=>p.node), own: G.own, open: G.open, t: G.turn, d: G.dest, cards: G.P.map(p=>p.cards)}); }')
                load()
                shot('50_title_with_save')
                btn('continue')
                pg.wait_for_timeout(600)
                after = pg.evaluate('() => { const G = KR12.debug.G(); return JSON.stringify({c: G.P.map(p=>p.cash), n: G.P.map(p=>p.node), own: G.own, open: G.open, t: G.turn, d: G.dest, cards: G.P.map(p=>p.cards)}); }')
                log('つづきから 一致:', before == after)
                reloaded = True
                continue
            d = pg.evaluate('pol => { const G = KR12.debug.G(); return G.need ? KR12.AI.decide(G, pol) : null; }', pol)
            counts['decisions'] += 1
            if h == 'action':
                shot('10_action')
                if d['type'] == 'roll':
                    if use_keys: space()
                    else: btn('roll')
                else:
                    btn('card:%d' % d['idx'])
                    pg.wait_for_timeout(120)
                    cid = pg.evaluate('i => KR12.debug.G().P[0].cards[i].id', d['idx'])
                    log('  きっぷ', cid, d)
                    if cid == 'kakueki':
                        shot('12_kakueki'); btn('num:%d' % d['value'])
                    elif cid == 'fumikiri':
                        btn('pick:%d' % d['target'])
                    elif cid in ('daruma', 'tobinori'):
                        btn('cfYes')
                    else:
                        shot('11_card_selected'); btn('roll')
            elif h == 'landing':
                pg.wait_for_timeout(250)
                cs = pg.evaluate('KR12.debug.cands()') or []
                tgt = next((c for c in cs if c['i'] == d['i']), None)
                if tgt and 20 < tgt['x'] < 1260 and 20 < tgt['y'] < 700:
                    pg.mouse.move(tgt['x'], tgt['y'], steps=3)
                    pg.wait_for_timeout(120)
                    shot('20_landing_hover')
                    click_xy(tgt['x'], tgt['y'])
                else:
                    # 画面の外なら キーボードで えらぶ
                    idx = next((k for k, c in enumerate(cs) if c['i'] == d['i']), 0)
                    for _ in range(idx + 1):
                        pg.keyboard.press('ArrowRight'); counts['key'] += 1
                    pg.keyboard.press('Enter'); counts['key'] += 1
                    log('  （画面の外の マスを キーボードで えらんだ）')
            elif h == 'buy':
                shot('30_station')
                if d['type'] == 'buy': btn('buy:%d' % d['prop'])
                elif d['type'] == 'takeover': shot('31_takeover'); btn('take:%d' % d['prop'])
                else:
                    if use_keys: space()
                    else: btn('done')
            elif h == 'event':
                shot('40_event')
                btn('ch:%d' % d['i'])
            elif h == 'evok':
                pg.wait_for_timeout(300)
                shot('41_event_result')
                if use_keys: space()
                else: btn('evok')
            elif h == 'open':
                shot('45_open')
                btn('open:%d' % d['r'])
            elif h == 'settle':
                pg.wait_for_timeout(int(2600 / speed) + 200)
                shot('60_settle')
                if use_keys: space()
                else: btn('settleOk')
            pg.wait_for_timeout(80)
        b.close()
    log('クリック', counts['click'], 'キー', counts['key'], '判断', counts['decisions'], '実時間', round(time.time() - t0), '秒（速さ', speed, '倍）')
    log('エラー', len(errors))
    for e in errors[:30]:
        log('  ', e)


if __name__ == '__main__':
    main()
