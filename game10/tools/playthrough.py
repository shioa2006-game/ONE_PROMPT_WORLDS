"""
ぐるり、夜まつり ― 表紙から むすびまでの 通しプレイ（実ブラウザ・本物のマウス）

  python tools/playthrough.py [画面写真の出力先] [--speed 3] [--route elite|rest|auto] [--reload]

・ヘッドレスの Microsoft Edge（1280×720）で file:// から開き、localStorage を 消してから はじめる。
・戦いの 手は ページ内の「ヒント」と 同じ 探しかた（G10.B.debug.best）で えらび、
  その マスの 中心を 本物の マウスで なぞって はなす（輪は はじめの マスに もどる）。
  ※ 手を えらぶ のは 機械なので、人の 上手・下手の 目安には ならない。
・ボタンは 画面に 出ている ボタンの 位置を 読んで、本物の クリックで おす。
・--speed は ゲーム内の 時間の 早回し（演出の 待ちを 短くするだけ。ルールは 変わらない）。
・--reload を つけると、その二の はじめで ページを 読みこみなおし、「つづきから」で 再開できるかも 確かめる。
記録は tools/results/playthrough-log.txt に 書く。
"""
import json, sys, time, pathlib, argparse
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri()
LOG = ROOT / 'tools' / 'results' / 'playthrough-log.txt'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out', nargs='?', default=None)
    ap.add_argument('--speed', type=float, default=3)
    ap.add_argument('--route', default='auto')
    ap.add_argument('--reload', action='store_true')
    ap.add_argument('--maxmin', type=float, default=40)
    a = ap.parse_args()
    out = pathlib.Path(a.out) if a.out else None
    if out:
        out.mkdir(parents=True, exist_ok=True)
    lines = []

    def log(*xs):
        s = ' '.join(str(x) for x in xs)
        print(s, flush=True)
        lines.append(s)

    errors = []
    t_start = time.time()
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge', headless=True)
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.goto(URL)
        pg.evaluate('localStorage.clear()')
        pg.reload()
        pg.wait_for_timeout(500)

        def setup_speed():
            pg.evaluate(f'G10.debug.speed = {a.speed}')
        setup_speed()
        box = pg.locator('canvas').bounding_box()
        sx, sy = box['width'] / 1280, box['height'] / 720

        def pt(x, y):
            return box['x'] + x * sx, box['y'] + y * sy

        def click(x, y):
            X, Y = pt(x, y)
            pg.mouse.move(X, Y, steps=3)
            pg.mouse.down(); pg.wait_for_timeout(30); pg.mouse.up()

        def buttons():
            return pg.evaluate("G10.buttons.map(b => ({label: b.label, x: b.x + b.w/2, y: b.y + b.h/2, dis: !!b.disabled}))")

        def press(label_part, exact=False):
            for bt in buttons():
                if (bt['label'] == label_part if exact else label_part in bt['label']) and not bt['dis']:
                    click(bt['x'], bt['y'])
                    return True
            return False

        def shot(name):
            if out:
                pg.screenshot(path=str(out / (name + '.png')))

        state = lambda: pg.evaluate("""(() => {
          const s = { scene: G10.scene, menu: !!G10.menu, fade: G10.fadeDir };
          if (G10.scene === 'battle' && G10.B) { s.phase = G10.B.phase; s.talk = !!G10.B.talk; s.bid = G10.B.bid; s.hp = G10.B.P.hp; s.coins = G10.B.P.coins; s.turn = G10.B.st.turn; }
          if (G10.scene === 'map') { s.intro = G10.scenes.map.intro; s.walk = !!G10.scenes.map.walk; s.targets = G10.scenes.map.targets; const r = G10.run(); if (r) { s.a = r.a; s.n = r.n; s.hp = r.P.hp; s.coins = r.P.coins; s.max = G10.S.stats(r.P).maxHp; } }
          if (G10.scene === 'ending') { s.done = G10.scenes.ending.done; }
          return s; })()""")

        battles = []
        cur = None
        shots_taken = set()
        reloaded = False
        last_scene = None
        stuck = 0
        while True:
            if time.time() - t_start > a.maxmin * 60:
                log('時間切れ'); break
            st = state()
            sc = st['scene']
            if st['fade']:
                pg.wait_for_timeout(60); continue
            if sc != last_scene:
                log('画面', sc, json.dumps({k: v for k, v in st.items() if k in ('a', 'n', 'hp', 'coins', 'bid')}, ensure_ascii=False))
                last_scene = sc
            if sc == 'title':
                if cur is None and not battles:
                    shot('p00_title')
                    press('はじめる')
                elif st.get('ended'):
                    break
                else:
                    break
                pg.wait_for_timeout(300); continue
            if sc == 'story':
                if 'p01_story' not in shots_taken:
                    shot('p01_story'); shots_taken.add('p01_story')
                click(640, 600); pg.wait_for_timeout(int(400 / a.speed) + 120); continue
            if sc == 'map':
                if st['intro']:
                    click(640, 400); pg.wait_for_timeout(int(400 / a.speed) + 120); continue
                if st['walk']:
                    pg.wait_for_timeout(100); continue
                if a.reload and not reloaded and st.get('a') == 1 and st.get('n') == 0:
                    log('ページを 読みこみなおす（その二の はじめ）')
                    pg.reload(); pg.wait_for_timeout(600); setup_speed()
                    s2 = state()
                    ok = press('つづきから')
                    log('つづきから ボタン', ok, '→', json.dumps(s2, ensure_ascii=False)[:120])
                    reloaded = True
                    pg.wait_for_timeout(900); continue
                tg = st['targets']
                pick = tg[0]
                if len(tg) > 1:
                    want_rest = a.route == 'rest' or (a.route == 'auto' and st['hp'] < st['max'] * 0.5)
                    pick = next((t for t in tg if (t['id'] == 'rest') == want_rest), tg[0])
                    log('わかれ道 →', pick['id'], f"(体力 {st['hp']}/{st['max']})")
                key = f"map{st['a']}_{st['n']}"
                if key not in shots_taken and st['n'] in (0, 2):
                    shot('p_' + key); shots_taken.add(key)
                click(pick['x'], pick['y'])
                pg.wait_for_timeout(int(900 / a.speed) + 150); continue
            if sc == 'rest':
                pg.wait_for_timeout(int(600 / a.speed) + 100)
                press('道に もどる'); pg.wait_for_timeout(300); continue
            if sc == 'shop':
                if 'shop' + str(st.get('a', '')) not in shots_taken:
                    shot('p_shop_' + str(len(battles))); shots_taken.add('shop' + str(st.get('a', '')))
                order = ['組みひも', '大玉花火', 'きつねのお面', 'りんご飴', '金魚すくい', 'わたあめ']
                bought = False
                labels = pg.evaluate("G10.scenes.shop && G10.D.SHOPS[G10.scenes.shop.id].map(k => G10.D.SHOP_ITEMS[k].name)")
                bts = [bt for bt in buttons() if 'で かう' in bt['label'] and not bt['dis']]
                for nm in order:
                    if nm in labels:
                        idx = labels.index(nm)
                        cand = [bt for bt in buttons() if 'で かう' in bt['label'] and not bt['dis'] and abs(bt['x'] - (110 + idx * 270 + 120)) < 5]
                        if cand:
                            click(cand[0]['x'], cand[0]['y']); log('かった', nm); bought = True; pg.wait_for_timeout(250); break
                if not bought:
                    press('道に もどる'); pg.wait_for_timeout(300)
                continue
            if sc == 'battle':
                ph = st.get('phase')
                if cur is None or cur['bid'] != st['bid'] or ph == 'intro' and cur.get('done'):
                    if cur is None or cur['bid'] != st['bid'] or cur.get('done'):
                        cur = {'bid': st['bid'], 'turns': 0, 'rings': 0, 'befriend': 0, 'attempts': 1, 'hp0': st['hp'], 'coins0': st['coins'], 'done': False}
                        battles.append(cur)
                if st['talk']:
                    click(640, 620); pg.wait_for_timeout(int(300 / a.speed) + 80); continue
                if ph == 'input':
                    mv = pg.evaluate('G10.B.debug.best()')
                    if not mv:
                        log('手が 見つからない'); stuck += 1; pg.wait_for_timeout(200)
                        if stuck > 20: break
                        continue
                    pts = mv['pts'] + ([mv['pts'][0]] if mv['closed'] else [])
                    X, Y = pt(pts[0]['x'], pts[0]['y'])
                    pg.mouse.move(X, Y, steps=2); pg.mouse.down()
                    for q in pts[1:]:
                        X, Y = pt(q['x'], q['y'])
                        pg.mouse.move(X, Y, steps=5); pg.wait_for_timeout(15)
                    chk = pg.evaluate('G10.B.chain ? {n: G10.B.chain.path.length, closed: G10.B.chain.closed} : null')
                    if not chk or chk['n'] != len(mv['path']) or chk['closed'] != mv['closed']:
                        log('なぞりが ずれた', json.dumps(chk), len(mv['path']), mv['closed'])
                    key = 'b_' + st['bid'] + '_' + str(cur['turns'])
                    if (mv['closed'] and mv['befriend'] and 'ring' + st['bid'] not in shots_taken):
                        shot('p_ring_' + st['bid']); shots_taken.add('ring' + st['bid'])
                    pg.mouse.up()
                    cur['turns'] += 1
                    if mv['closed']:
                        cur['rings'] += 1
                    cur['befriend'] += mv['befriend']
                    pg.wait_for_timeout(120)
                    continue
                if ph == 'result':
                    if not cur.get('done'):
                        cur['done'] = True
                        cur['hp1'] = st['hp']; cur['coins1'] = st['coins']
                        shot('p_result_' + st['bid'])
                        res = pg.evaluate('G10.B.result ? {coins: G10.B.result.coins, friends: G10.B.result.friends, newSp: G10.B.result.newSpecies} : null')
                        cur['res'] = res
                        log('かった', st['bid'], f"手数 {cur['turns']} 輪 {cur['rings']} 体力 {cur['hp0']}→{st['hp']}", json.dumps(res, ensure_ascii=False))
                    pg.wait_for_timeout(int(700 / a.speed) + 100)
                    press('つぎへ'); pg.wait_for_timeout(300); continue
                if ph == 'lost':
                    pg.wait_for_timeout(int(1000 / a.speed) + 200)
                    log('まけた', st['bid'], '手数', cur['turns'])
                    shot('p_lost_' + st['bid'] + '_' + str(cur['attempts']))
                    if press('もういちど'):
                        cur['attempts'] += 1
                    pg.wait_for_timeout(400); continue
                pg.wait_for_timeout(60); continue
            if sc == 'ending':
                if not st['done']:
                    if 'end0' not in shots_taken:
                        pg.wait_for_timeout(800); shot('p_end0'); shots_taken.add('end0')
                    click(640, 500); pg.wait_for_timeout(int(500 / a.speed) + 150); continue
                pg.wait_for_timeout(500)
                shot('p_end1')
                summ = pg.evaluate('JSON.stringify(G10.save.lastClear)')
                log('むすび', summ)
                press('タイトルへ'); pg.wait_for_timeout(900)
                t = pg.evaluate("G10.buttons.map(b => b.label + (b.sub ? '(' + b.sub + ')' : ''))")
                log('表紙の ボタン', json.dumps(t, ensure_ascii=False))
                shot('p_title_after')
                break
            pg.wait_for_timeout(100)
        b.close()
    log('---- 戦いの まとめ')
    for c in battles:
        log(f"{c['bid']:8} 手数{c['turns']:3} 輪{c['rings']:2} むすぶ{c['befriend']:2} 挑戦{c['attempts']} 体力 {c['hp0']}→{c.get('hp1')} 小判 {c['coins0']}→{c.get('coins1')}")
    log('ページエラー・コンソールの エラー/警告:', len(errors))
    for e in errors[:20]:
        log('  ', e)
    log(f'かかった 実時間 {time.time() - t_start:.0f}秒（早回し {a.speed}ばい）')
    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text('\n'.join(lines), encoding='utf-8')


if __name__ == '__main__':
    main()
