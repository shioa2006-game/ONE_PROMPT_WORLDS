"""賽駆け 天下 — シーン別の画面検証（Playwright, Edge headless）
   python tools/ui_check.py [--res 1600x900,...] [--only S03,UI01,...] [--out DIR]
   tools/scenes.js の検証用の状態を「つづきから」で読み込み、表示（画面撮影）と操作（実クリック・キー入力・DOM の当たり判定）を確かめる。
   画面撮影は既定で tools/ui_shots/<解像度>/ に保存する（リポジトリには入れない）。
   結果は最後に PASS/FAIL の一覧で出す。見た目だけでなく、クリックが届くかも判定する。"""
import os
import sys
import json
import time
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from uifix import build_scenes, load_scene, buttons, wait_idle, dice_report, HERE  # noqa: E402

args = sys.argv[1:]


def opt(name, default=None):
    return args[args.index(name) + 1] if name in args else default


RES = [tuple(int(v) for v in r.split('x')) for r in opt('--res', '1920x1080,1600x900,1280x720,1180x757').split(',')]
ONLY = set(opt('--only', '').split(',')) - {''}
OUT = opt('--out', os.path.join(HERE, 'ui_shots'))
os.makedirs(OUT, exist_ok=True)
gi = os.path.join(OUT, '.gitignore')
if not os.path.exists(gi):
    open(gi, 'w').write('*\n')
SCENES = build_scenes(os.path.join(OUT, 'scenes.json'))
results = []


def check(res, name, ok, detail=''):
    results.append((res, name, bool(ok), detail))
    print(('PASS' if ok else 'FAIL'), res, name, detail, flush=True)


def want(tag):
    return not ONLY or tag in ONLY


def shot(pg, res, name):
    d = os.path.join(OUT, res)
    os.makedirs(d, exist_ok=True)
    pg.screenshot(path=os.path.join(d, name + '.png'))


def click(pg, xy):
    pg.mouse.move(xy[0], xy[1]); pg.wait_for_timeout(40); pg.mouse.click(xy[0], xy[1])


def state(pg):
    return pg.evaluate('SGT.debug.state()')


def node_xy(pg, n):
    return pg.evaluate('SGT.debug.nodeScreen(%d)' % n)


def hit_is_canvas(pg, xy):
    return pg.evaluate('([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id || e.className || e.tagName) : null; }', xy)


def dice_scene(br, sid, w, h):
    res = '%dx%d' % (w, h)
    ctx, pg = load_scene(br, SCENES[sid], w, h)
    n_expect = {'S01': 6, 'S02': 7, 'S03': 8, 'S04': 9}[sid]
    shot(pg, res, sid + '_1_before')
    pg.keyboard.press('Space')
    pg.wait_for_timeout(250)
    shot(pg, res, sid + '_2_rolling')
    pg.wait_for_timeout(1200)
    shot(pg, res, sid + '_3_stopped')
    r = dice_report(pg)
    check(res, sid + ' dice count', r['n'] == n_expect, 'n=%d' % r['n'])
    uiz = pg.evaluate("parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--uiz')) || 1")
    check(res, sid + ' dice not squeezed (54px x panel scale %.2f)' % uiz, all(d['w'] >= 54 * uiz - 2 for d in r['dice']), str(sorted(set(d['w'] for d in r['dice']))))
    check(res, sid + ' dice rects do not overlap', r['overlap'] == 0)
    check(res, sid + ' every die center is clickable', r['allHit'])
    check(res, sid + ' key numbers above buttons', r['numAboveButtons'])
    check(res, sid + ' dice inside tray', r['inside'])
    check(res, sid + ' reroll buttons clickable', all(d['rrHit'] for d in r['dice']), str([d['rrHit'] for d in r['dice']]))
    # 番号の札が下の段の賽に重ならない
    rows = sorted(set(d['y'] for d in r['dice']))
    if len(rows) > 1:
        check(res, sid + ' key labels clear of next row', max(d['numBottom'] for d in r['dice'] if d['y'] == rows[0]) <= rows[1] - 2)
    # 実クリックで賽を選ぶ（最後の賽）
    last = r['dice'][-1]
    click(pg, (last['x'] + last['w'] / 2, last['y'] + last['h'] / 2))
    pg.wait_for_timeout(200)
    selok = pg.evaluate('SGT.sel.dice.slice()')
    check(res, sid + ' click selects last die', selok == [n_expect - 1], str(selok))
    shot(pg, res, sid + '_4_selected')
    # 強行軍（2つ）
    click(pg, buttons(pg)['b-combine'])
    pg.wait_for_timeout(100)
    first = r['dice'][0]
    click(pg, (first['x'] + first['w'] / 2, first['y'] + first['h'] / 2))
    pg.wait_for_timeout(200)
    sel2 = pg.evaluate('SGT.sel.dice.slice()')
    check(res, sid + ' combine selects two dice', len(sel2) == 2, str(sel2))
    shot(pg, res, sid + '_5_combine')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    # 内政の小窓：自分の城にいる軍勢＋賽1つ
    a = pg.evaluate('''() => { const S = SGT.S, E = SG.E; const a = S.armies.find(x => x.c === S.player && !x.mv && E.nodes[x.n].kind === 'c' && S.owner[E.nodes[x.n].p] === S.player); return a ? a.id : null; }''')
    if a is not None:
        pg.keyboard.press('1'); pg.wait_for_timeout(100)
        pg.evaluate('(id) => { const a = SGT.S.armies.find(x => x.id === id); SGT.debug.view(SG.MAP.POS[a.n][0], SG.MAP.POS[a.n][1], 2.2); }', a)
        pg.wait_for_timeout(150)
        click(pg, pg.evaluate('(id) => SGT.debug.nodeScreen(SGT.S.armies.find(x => x.id === id).n)', a))
        pg.wait_for_timeout(300)
        g = pg.evaluate('''() => { const g = document.getElementById('gov'); if (g.classList.contains('hidden')) return null; const r = g.getBoundingClientRect(), t = document.getElementById('dice').getBoundingClientRect(), tr = document.getElementById('tray').getBoundingClientRect(); return { bottom: r.bottom, trayTop: tr.top, top: r.top, diceTop: t.top }; }''')
        check(res, sid + ' gov panel shown above tray', g and g['bottom'] <= g['trayTop'] + 1 and g['top'] >= 0, str(g))
        shot(pg, res, sid + '_6_gov')
        # 内政で賽を使う（使用済みの表示）
        gb = buttons(pg).get('gov_develop') or buttons(pg).get('gov_fortify') or buttons(pg).get('gov_recruit')
        if gb:
            click(pg, gb); wait_idle(pg); pg.wait_for_timeout(200)
            used = pg.evaluate("document.querySelector('#dice .die.used') !== null")
            check(res, sid + ' used die shown', used)
            shot(pg, res, sid + '_7_used')
    # 振り直し（織田）
    rb = pg.evaluate('''() => { const b = document.querySelector('#dice .die:not(.used) .rr'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, +b.parentElement.dataset.i]; }''')
    if rb:
        before = pg.evaluate('SGT.S.rer')
        click(pg, rb[:2]); wait_idle(pg); pg.wait_for_timeout(300)
        check(res, sid + ' reroll works', pg.evaluate('SGT.S.rer') and not before)
        shot(pg, res, sid + '_8_reroll')
    check(res, sid + ' no page errors', not pg.errors, str(pg.errors[:2]))
    ctx.close()


def modal_checks(br, w, h):
    res = '%dx%d' % (w, h)
    ctx, pg = load_scene(br, SCENES['S03'], w, h)
    pg.keyboard.press('Space'); pg.wait_for_timeout(1400)
    base = pg.evaluate('JSON.stringify({d: SGT.S.dice, a: SGT.S.armies.map(a => [a.n, a.mv]), sel: SGT.sel.dice, fast: SGT.speed.fast, z: SG.R.zoom})')
    for name, opener in (('slots', ['b-menu', 'b-m-save']), ('menu', ['b-menu']), ('help', ['b-help'])):
        for b in opener:
            click(pg, buttons(pg)[b]); pg.wait_for_timeout(250)
        for k in ['1', '2', 'a', 'A', 'z', ' ', 'Enter', 'f', '0', 'h', 'q', 'Shift+1']:
            pg.keyboard.press(k); pg.wait_for_timeout(60)
        # 窓の外側（地図があるはずの場所）をクリック
        hit = hit_is_canvas(pg, (w * 0.5, h * 0.12))
        pg.mouse.click(w * 0.5, h * 0.12); pg.wait_for_timeout(150)
        after = pg.evaluate('JSON.stringify({d: SGT.S.dice, a: SGT.S.armies.map(a => [a.n, a.mv]), sel: SGT.sel.dice, fast: SGT.speed.fast, z: SG.R.zoom})')
        check(res, 'UI-01 %s: keys/mouse do not reach game' % name, after == base and hit != 'map', 'hit=%s' % hit)
        if name == 'slots':
            shot(pg, res, 'UI01_slots_open')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        if name == 'menu' and pg.evaluate("!document.getElementById('menu').classList.contains('hidden')"):
            pg.keyboard.press('Escape')
        closed = pg.evaluate("['slots','menu','help'].every(id => document.getElementById(id).classList.contains('hidden'))")
        check(res, 'UI-01 %s: Esc closes' % name, closed)
    # 閉じたあとは操作が戻る
    pg.keyboard.press('1'); pg.wait_for_timeout(150)
    check(res, 'UI-01 keys work again after closing', pg.evaluate('SGT.sel.dice.slice()') == [0])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    # UI-02：手番終了の確認の期限
    click(pg, buttons(pg)['b-end']); pg.wait_for_timeout(200)
    t1 = pg.evaluate("[document.getElementById('b-end').textContent, document.getElementById('prompt').textContent]")
    check(res, 'UI-02 confirm shown', 'もう一度' in t1[0] and 'もう一度' in t1[1])
    pg.wait_for_timeout(3300)
    t2 = pg.evaluate("[document.getElementById('b-end').textContent, document.getElementById('prompt').textContent]")
    check(res, 'UI-02 after timeout both reset', 'もう一度' not in t2[0] and 'もう一度' not in t2[1], str(t2))
    shot(pg, res, 'UI02_after_timeout')
    # 期限内の二度押しは終える
    click(pg, buttons(pg)['b-end']); pg.wait_for_timeout(300); click(pg, buttons(pg)['b-end']); pg.wait_for_timeout(600)
    check(res, 'UI-02 double press ends turn', pg.evaluate('SGT.S.cur !== SGT.S.player || SGT.debug.busy()'))
    check(res, 'modal checks no page errors', not pg.errors, str(pg.errors[:2]))
    ctx.close()
    # 臣従の申し出と区切りの窓
    ctx, pg = load_scene(br, SCENES['S11'], w, h)
    pg.wait_for_timeout(800)
    check(res, 'S11 offer modal shown on load', pg.evaluate('SGT.debug.isOffer()'))
    shot(pg, res, 'S11_offer')
    for k in ['1', 'a', ' ', 'z']:
        pg.keyboard.press(k); pg.wait_for_timeout(50)
    check(res, 'S11 keys behind offer ignored', pg.evaluate('SGT.debug.isOffer() && SGT.S.phase === "roll" && !SGT.sel.dice.length'))
    click(pg, buttons(pg)['b-offer-yes']); wait_idle(pg, 30000); pg.wait_for_timeout(500)
    check(res, 'S11 accept: satomi joins', pg.evaluate("!SGT.S.clans.satomi.alive && SGT.S.owner[SG.E.PI.kazusa] === SGT.S.player"))
    shot(pg, res, 'S11_after')
    ctx.close()
    ctx, pg = load_scene(br, SCENES['S12'], w, h)
    check(res, 'S12 decide modal shown on load', pg.evaluate('SGT.debug.isDecide()'))
    shot(pg, res, 'S12_decide')
    for k in ['1', 'a', 'Enter', ' ', 'Escape']:
        pg.keyboard.press(k); pg.wait_for_timeout(50)
    check(res, 'S12 keys behind decide ignored', pg.evaluate('SGT.debug.isDecide() && SGT.S.phase === "decide"'))
    click(pg, buttons(pg)['b-extend']); wait_idle(pg, 30000); pg.wait_for_timeout(600)
    check(res, 'S12 extend continues', pg.evaluate('SGT.S.maxTurn === 60 && SGT.S.cur === SGT.S.player && !SGT.debug.isDecide()'))
    ctx.close()


def top_edge_clicks(br, w, h):
    """UI-03：画面のいろいろな位置に置いた進軍先を、実クリックで選べるか"""
    res = '%dx%d' % (w, h)
    spots = {'top-left(HUD)': (0.27, 0.06), 'menu-btns': (0.34, 0.10), 'top-center': (0.5, 0.05), 'power(right)': (0.70, 0.08), 'minimap-side': (0.72, 0.4)}
    for name, (fx, fy) in spots.items():
        ctx, pg = load_scene(br, SCENES['S15'], w, h)
        tgt = pg.evaluate("SG.E.nodeOf('iyo-bungo')")
        sx, sy = w * fx, h * fy
        pg.evaluate('''([n, sx, sy]) => { const R = SG.R, P = SG.MAP.POS[n]; const z = 2.2; const s = Math.min(innerWidth / R.W, innerHeight / R.H) * z;
          SGT.debug.view(P[0] - (sx - innerWidth / 2) / s, P[1] - (sy - innerHeight / 2) / s, z); }''', [tgt, sx, sy])
        pg.wait_for_timeout(150)
        # 強行軍 4+4 → 日向の軍勢 → 豊予海峡
        pg.keyboard.press('1'); pg.keyboard.press('Shift+2'); pg.wait_for_timeout(100)
        army = pg.evaluate("SGT.S.armies.find(a => a.c === SGT.S.player && a.n === SG.E.PI.hyuga).id")
        ok_sel = pg.evaluate('(id) => { const a = SGT.S.armies.find(x => x.id === id); const p = SGT.debug.nodeScreen(a.n); return p; }', army)
        if 0 < ok_sel[0] < w and 0 < ok_sel[1] < h and hit_is_canvas(pg, ok_sel) == 'map':
            click(pg, ok_sel)
        else:
            row = pg.evaluate("(id) => { const r = document.querySelector('.arow[data-id=\"' + id + '\"] .pl').getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; }", army)
            click(pg, row)
        pg.wait_for_timeout(500)
        xy = node_xy(pg, tgt)
        reach = pg.evaluate('(n) => !!(SGT.U.reach && SGT.U.reach.includes(n)) || !!(SGT.U.targets && SGT.U.targets.some(t => t.n === n))', tgt)
        hit = hit_is_canvas(pg, xy)
        click(pg, xy); wait_idle(pg); pg.wait_for_timeout(300)
        moved = pg.evaluate('(id) => SGT.S.armies.find(x => x.id === id).n', army) == tgt
        shot(pg, res, 'UI03_' + name.replace('(', '_').replace(')', ''))
        check(res, 'UI-03 %s at (%d,%d): reachable=%s hit=%s moved' % (name, xy[0], xy[1], reach, hit), reach and hit == 'map' and moved)
        ctx.close()


def big_scenes(br, w, h):
    res = '%dx%d' % (w, h)
    for sid in ('S05', 'S06', 'S07', 'S08', 'S09', 'S10'):
        ctx, pg = load_scene(br, SCENES[sid], w, h)
        pg.keyboard.press('Space'); pg.wait_for_timeout(1400)
        shot(pg, res, sid + '_home')
        info = pg.evaluate('''() => { const a = document.getElementById('armies').getBoundingClientRect(), l = document.getElementById('log').getBoundingClientRect(), h = document.getElementById('hud').getBoundingClientRect();
          const list = document.getElementById('armies-list'); return { overlapLog: a.bottom > l.top + 1, overlapHud: a.top < h.bottom - 1, scroll: list.parentElement.scrollHeight > list.parentElement.clientHeight, rows: list.children.length }; }''')
        check(res, sid + ' army list fits between HUD and log', not info['overlapLog'] and not info['overlapHud'], str(info))
        pg.keyboard.press('0'); pg.wait_for_timeout(700)
        shot(pg, res, sid + '_overview')
        check(res, sid + ' no page errors', not pg.errors, str(pg.errors[:2]))
        if sid == 'S05':
            # カメラ移動中のクリック：移動を終わらせるだけで、命令にはならない
            pg.keyboard.press('h'); pg.wait_for_timeout(700)
            far = pg.evaluate('''() => { const S = SGT.S; const a = S.armies.filter(x => x.c === S.player).find(x => { const p = SGT.debug.nodeScreen(x.n); return p[0] < -200 || p[0] > innerWidth + 200 || p[1] < -200 || p[1] > innerHeight + 200; }); return a ? a.id : null; }''')
            if far is None:
                pg.evaluate("SGT.debug.view(100, 100, 3)"); pg.wait_for_timeout(200)
                far = pg.evaluate('''() => { const S = SGT.S; const a = S.armies.filter(x => x.c === S.player).find(x => { const p = SGT.debug.nodeScreen(x.n); return p[0] < -200 || p[0] > innerWidth + 200 || p[1] < -200 || p[1] > innerHeight + 200; }); return a ? a.id : null; }''')
            if far is not None:
                pg.keyboard.press('1'); pg.wait_for_timeout(80)
                row = pg.evaluate("(id) => { const r = document.querySelector('.arow[data-id=\"' + id + '\"] .pl').getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; }", far)
                click(pg, row)
                pg.wait_for_timeout(60)
                moving = pg.evaluate('SG.R.camMoving()')
                before = state(pg)
                pg.mouse.click(w * 0.5, h * 0.5)
                pg.wait_for_timeout(100)
                after = state(pg)
                check(res, 'P1 camera: click during glide only finishes glide', moving and not pg.evaluate('SG.R.camMoving()') and before['armies'] == after['armies'] and before['dice'] == after['dice'], 'moving=%s' % moving)
        ctx.close()


def unify(br, w, h):
    res = '%dx%d' % (w, h)
    ctx, pg = load_scene(br, SCENES['S13'], w, h)
    pg.keyboard.press('1'); pg.wait_for_timeout(100)
    army = pg.evaluate("SGT.S.armies.find(a => a.c === SGT.S.player && a.n === SG.E.nodeOf('mino-owari')).id")
    pg.evaluate("(id) => { const a = SGT.S.armies.find(x => x.id === id); SGT.debug.view(SG.MAP.POS[a.n][0], SG.MAP.POS[a.n][1], 2.4); }", army)
    pg.wait_for_timeout(200)
    click(pg, pg.evaluate('(id) => SGT.debug.nodeScreen(SGT.S.armies.find(x => x.id === id).n)', army)); pg.wait_for_timeout(200)
    click(pg, node_xy(pg, pg.evaluate('SG.E.PI.mino')))
    pg.wait_for_timeout(9000)
    r = pg.evaluate("[SGT.debug.mode(), document.getElementById('res-head').textContent, SGT.S.over && SGT.S.over.reason]")
    check(res, 'S13 unify by real click -> result', r[0] == 'result' and r[2] == 'unify', str(r))
    shot(pg, res, 'S13_unify')
    ctx.close()


with sync_playwright() as p:
    br = p.chromium.launch(channel='msedge')
    t0 = time.time()
    for (w, h) in RES:
        for sid in ('S01', 'S02', 'S03', 'S04'):
            if want(sid) or want('dice'):
                dice_scene(br, sid, w, h)
        if want('UI01') or want('modal'):
            modal_checks(br, w, h)
        if want('UI03'):
            top_edge_clicks(br, w, h)
        if want('big'):
            big_scenes(br, w, h)
        if want('S13'):
            unify(br, w, h)
    br.close()
n_fail = sum(1 for r in results if not r[2])
print('\n%d checks, %d failed, %.0fs' % (len(results), n_fail, time.time() - t0))
for r in results:
    if not r[2]:
        print('FAIL', r[0], r[1], r[3])
json.dump(results, open(os.path.join(OUT, 'results.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
