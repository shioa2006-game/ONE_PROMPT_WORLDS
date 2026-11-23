# がらり、迷宮ひらき — 「リールを一か所組み替えて、同じ局面で比べる」を本物のクリックで確かめる
# 使い方: python tools/compare.py OUT_DIR [--seed N]
# 1. 炎の紋を2つ刻み、1つを持ち物に残した状態で「茨の間」へ（状態の用意だけ JavaScript で行う）
# 2. 戦いの前に「詠唱輪を組む」→「試す」（この部屋の様子で試し詠唱）→ 回す → ヒントのとおりずらして放つ
# 3. 「組みかえる」→ 持ち物の炎を3本目のリールのマスに刻む → 「試す」→「同じ回転で」→ ヒントのとおりずらして放つ
# 4. 画面の文（見こみ・比べた結果）と撮影で、何が変わったかを確かめる
import json, os, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
OUT = args[0] if args and not args[0].startswith('--') else 'compare_out'
SEED = int(args[args.index('--seed') + 1]) if '--seed' in args else 5
URL = 'file:///' + os.path.join(ROOT, 'index.html').replace('\\', '/') + f'?seed={SEED}'

SETUP = """GR18.goto('s1_forge', s => {
  const G = GR18.G;
  ['s1_hall', 's1_bats'].forEach(id => { G.enterRoom(s, id); G.rs(s, id).c = 1; });
  G.enterRoom(s, 's1_forge'); G.rs(s, 's1_forge').t = 1;
  s.reels[0].strip[4] = G.cell('fire'); s.reels[1].strip[1] = G.cell('fire');
  s.bag.push(Object.assign(G.cell('fire'), { nw: 1 }));
  s.flags.tw_w_thorn = 1;
})"""

# いまの止まり方で、3本目のリールのどのマスに炎を刻むと、ヒントの見こみがいちばん良くなるか（考える人の代わり）
PICK = """(() => {
  const G = GR18.G, s = GR18.state(), b = s.b;
  const pos = b.lastSpin.slice();
  let best = null;
  const base = (() => { const s2 = G.clone(s); s2.b.en = G.clone(b.init); s2.b.walls = G.clone(b.initWalls); s2.b.phase = 'aim'; s2.reels.forEach((R, i) => { R.pos = pos[i]; }); return G.bestShift(s2).v; })();
  for (let ci = 0; ci < 8; ci++) {
    if (s.reels[2].strip[ci].k === 'fire') continue;
    const s2 = G.clone(s);
    s2.b.en = G.clone(b.init); s2.b.walls = G.clone(b.initWalls); s2.b.phase = 'aim';
    s2.reels.forEach((R, i) => { R.pos = pos[i]; });
    s2.reels[2].strip[ci] = G.cell('fire');
    const r = G.bestShift(s2);
    if (!best || r.v > best.v) best = { ci: ci, v: r.v, walls: r.res.walls.length };
  }
  return { base: base, best: best };
})()"""


def main():
    os.makedirs(OUT, exist_ok=True)
    errs = []
    with sync_playwright() as p:
        br = p.chromium.launch(channel='msedge')
        pg = br.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        pg.set_default_timeout(20000)
        pg.goto(URL)
        pg.wait_for_timeout(400)

        def px(x, y):
            r = pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width / 1280]; })()")
            return r[0] + x * r[2], r[1] + y * r[2]

        def click(key):
            pg.wait_for_timeout(120)
            bs = pg.evaluate('GR18.buttons()')
            hit = [b for b in bs if b['key'] == key]
            if not hit or hit[-1]['disabled']:
                print('  (no/disabled button)', key)
                return False
            x, y = px(hit[-1]['x'], hit[-1]['y'])
            pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.up()
            return True

        def idle():
            t0 = time.time()
            pg.wait_for_timeout(120)
            while time.time() - t0 < 20 and pg.evaluate('GR18.busy()'):
                pg.wait_for_timeout(60)
            pg.wait_for_timeout(200)

        def msg():
            return pg.evaluate("(() => { const bs = GR18.bs(); return bs ? (bs.coach && bs.coach.text) || bs.msg : null; })()")

        def follow_hint():
            click('hint'); pg.wait_for_timeout(200)
            sug = pg.evaluate('GR18.suggest()') or []
            for i, d in enumerate(sug):
                d = int(d)
                for _ in range(abs(d)):
                    click(('up' if d < 0 else 'dn') + str(i))
            pg.wait_for_timeout(300)

        def pred():
            return pg.evaluate("(() => { const s = GR18.state(), G = GR18.G; const r = G.predict(s); return { kills: r.kills, dmg: r.dmg, walls: r.walls, lines: r.evs.map(e => e.line.el + '×' + e.line.n + '=' + e.line.power + (e.wall ? ' 壁:' + e.wall.power + '/' + e.wall.th + (e.wall.ok ? ' 崩れる' : '') : '')) }; })()")

        # 0. 比べがいのある止まり方になる乱数の種を探す（ここだけは検証の準備。本番の操作ではない）
        seed = SEED
        if '--search' in args:
            for cand in range(1, 40):
                pg.goto(URL.split('?')[0] + f'?seed={cand}')
                pg.wait_for_timeout(250)
                pg.evaluate(SETUP)
                pg.evaluate("(() => { GR18.battle('s1_thorn'); })()")
                pg.wait_for_timeout(100)
                pg.evaluate("(() => { GR18.editor(); })()")
                pg.evaluate("(() => { GR18.App.overlay = null; })()")
                pg.evaluate("(() => { const G = GR18.G; })()")
                ok = pg.evaluate("""(() => { const s = GR18.state(); GR18.App.overlay = null; return true; })()""")
                pg.evaluate("GR18.practiceRoom('s1_thorn')")
                pg.evaluate("GR18.spinAt()")
                pg.wait_for_timeout(50)
                pk = pg.evaluate(PICK)
                if pk['best'] and pk['best']['walls'] > 0 and pk['best']['v'] > pk['base'] + 20:
                    seed = cand
                    print('scenario seed', cand, pk)
                    break
            pg.goto(URL.split('?')[0] + f'?seed={seed}')
            pg.wait_for_timeout(400)
        pg.evaluate(SETUP)
        pg.wait_for_timeout(500)
        pg.evaluate("GR18.camTo('s1_thorn')"); pg.wait_for_timeout(150)
        r = pg.evaluate("GR18.roomXY('s1_thorn')")
        pg.mouse.click(*px(r['x'], r['y']))
        pg.wait_for_timeout(2600)
        pg.screenshot(path=os.path.join(OUT, 'c1_ready.png'))
        click('editor'); pg.wait_for_timeout(400)
        click('practice'); pg.wait_for_timeout(500)
        click('main'); idle()
        pg.screenshot(path=os.path.join(OUT, 'c2_before_spin.png'))
        follow_hint()
        print('before change, after hint shifts:', json.dumps(pred(), ensure_ascii=False))
        pg.screenshot(path=os.path.join(OUT, 'c3_before_aim.png'))
        click('main'); idle()
        print('msg:', msg())
        pg.screenshot(path=os.path.join(OUT, 'c4_before_cast.png'))
        pick = pg.evaluate(PICK)
        print('pick:', pick)
        # 組みかえる → 持ち物の炎を、3本目のリールのマスへ
        click('edit'); pg.wait_for_timeout(500)
        click('bag0'); pg.wait_for_timeout(150)
        click(f"cell2_{pick['best']['ci']}"); pg.wait_for_timeout(200)
        pg.screenshot(path=os.path.join(OUT, 'c5_editor.png'))
        click('practice'); pg.wait_for_timeout(500)
        click('same'); idle()
        pg.screenshot(path=os.path.join(OUT, 'c6_after_spin.png'))
        follow_hint()
        print('after change, after hint shifts:', json.dumps(pred(), ensure_ascii=False))
        pg.screenshot(path=os.path.join(OUT, 'c7_after_aim.png'))
        click('main'); pg.wait_for_timeout(1500)
        pg.screenshot(path=os.path.join(OUT, 'c8_after_casting.png'))
        idle()
        print('msg:', msg())
        pg.screenshot(path=os.path.join(OUT, 'c9_after_cast.png'))
        br.close()
    print('page errors:', errs if errs else 0)


if __name__ == '__main__':
    main()
