# ずらり、砦くずし — 「リールを一か所変える → ずらす → 結果に表れる」を本物のクリックで確かめる
# 使い方: python tools/compare.py OUT_DIR [--seed N]
#  1. 最初の砦をふつうに落とす（ずらしはページ内のボットの答えをクリック）
#  2. 工房で試し撃ち（回す→放つ）。組み替える前の結果を撮る
#  3. 試し撃ちで「空き」だった形のマスに、もらった「貫く」を刻む
#  4. 試し撃ちで「同じ回転で」→ 放つ。組み替えた後の結果を撮る
#  5. 二つ目の砦のはじめの回転で、光る ▲▼ を押して「貫く」を道に入れ、放つ
import json, os, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1]
SEED = int(sys.argv[sys.argv.index('--seed') + 1]) if '--seed' in sys.argv else 7
URL = 'file:///' + os.path.join(ROOT, 'index.html').replace('\\', '/') + f'?seed={SEED}'
os.makedirs(OUT, exist_ok=True)


def main():
    errs = []
    with sync_playwright() as p:
        br = p.chromium.launch(channel='msedge')
        pg = br.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL)
        pg.wait_for_timeout(400)

        def click_btn(key=None, label=None):
            pg.wait_for_timeout(80)
            bs = pg.evaluate('ZR17.buttons()')
            hit = [b for b in bs if key and b['key'] == key] or [b for b in bs if label and b['label'] == label]
            if not hit or hit[-1]['disabled']:
                print('  (no button)', key, label)
                return False
            b = hit[-1]
            pg.mouse.move(b['x'], b['y']); pg.mouse.down(); pg.mouse.up()
            return True

        def idle(limit=20):
            t0 = time.time()
            pg.wait_for_timeout(120)
            while time.time() - t0 < limit and pg.evaluate('ZR17.busy()'):
                pg.wait_for_timeout(60)
            pg.wait_for_timeout(250)

        def shot(name):
            pg.screenshot(path=os.path.join(OUT, name + '.png'))

        def js(x):
            return pg.evaluate(x)

        click_btn(label='はじめから'); pg.wait_for_timeout(300)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(2800)
        # 1. 最初の砦
        for _ in range(60):
            if js('ZR17.scene()') != 'battle':
                break
            if js('ZR17.busy()'):
                idle(); continue
            ov = js('ZR17.bs().over ? ZR17.bs().over.t : null')
            if ov is not None:
                if ov > 1.2:
                    click_btn('next')
                pg.wait_for_timeout(300); continue
            ph = js('ZR17.phase()')
            if ph == 'spin':
                click_btn('main'); idle(); continue
            if ph == 'aim':
                for i, d in enumerate(js('ZR17.suggest()') or []):
                    for _ in range(abs(d)):
                        click_btn(('up' if d > 0 else 'dn') + str(i))
                click_btn('main'); pg.wait_for_timeout(150)
                if js('ZR17.phase()') == 'aim':
                    click_btn('main')
                idle()
        pg.wait_for_timeout(1600)
        click_btn('next'); pg.wait_for_timeout(500)   # 地図 → 工房
        shot('01_gift')
        click_btn('gift1'); pg.wait_for_timeout(300)   # お礼は ×2
        shot('02_camp')
        # 2. 組み替える前の試し撃ち
        click_btn('practice'); pg.wait_for_timeout(400)
        click_btn('main'); idle()
        shot('03_practice_before_aim')
        before = js("(() => { const s = ZR17.state(); return { pos: s.reels.map(r => r.pos), rows: [0,1,2].map(r => window.ZR.rowSpell(s, r)) }; })()")
        click_btn('main'); idle()
        shot('04_practice_before_result')
        r_before = js('ZR17.bs().cmp.last')
        print('before', json.dumps(r_before, ensure_ascii=False))
        # 3. 窓に見えていた「空き」に「貫く」を刻む（なければ一番上の空き）
        shape_pos = before['pos'][1]
        slot = js(f"(() => {{ const st = ZR17.state().reels[1].strip; for (let r = 0; r < 3; r++) {{ const j = ({shape_pos} + r) % st.length; if (st[j].k === 'gap') return j; }} return st.findIndex(w => w.k === 'gap'); }})()")
        click_btn('back'); pg.wait_for_timeout(400)
        idx = js("ZR17.state().inv.findIndex(w => w.k === 'lance')")
        click_btn(f'inv{idx}'); pg.wait_for_timeout(150)
        shot('05_camp_holding')
        click_btn(f'slot1_{slot}'); pg.wait_for_timeout(200)
        shot('06_camp_placed')
        print('placed lance at shape slot', slot)
        # 4. 同じ回転で
        click_btn('practice'); pg.wait_for_timeout(400)
        click_btn('same'); idle()
        shot('07_practice_after_aim')
        click_btn('main'); idle()
        shot('08_practice_after_result')
        r_after = js('ZR17.bs().cmp.last')
        print('after ', json.dumps(r_after, ensure_ascii=False))
        print('practice message:', js('ZR17.bs().msg'))
        # 5. 二つ目の砦のはじめ
        click_btn('back'); pg.wait_for_timeout(300)
        click_btn('depart'); pg.wait_for_timeout(600)
        click_btn('next'); pg.wait_for_timeout(2800)
        click_btn('main'); idle()
        shot('09_teach_aim')
        cw = js('ZR17.bs().coachWant')
        pred0 = js('(() => { const p = ZR17.bs().pred; return p ? { kills: p.kills, part: p.partDmg, dmg: p.dmg } : null; })()')
        print('teach', cw, 'pred before shift', pred0, 'msg:', js('ZR17.bs().msg'))
        if cw:
            click_btn(('up' if cw['dir'] > 0 else 'dn') + str(cw['reel']))
            pg.wait_for_timeout(300)
        pred1 = js('(() => { const p = ZR17.bs().pred; return p ? { kills: p.kills, part: p.partDmg, dmg: p.dmg } : null; })()')
        print('pred after shift', pred1)
        shot('10_teach_shifted')
        click_btn('main'); pg.wait_for_timeout(700)
        shot('11_teach_casting')
        idle()
        shot('12_teach_result')
        br.close()
    print('page errors:', errs if errs else 0)


if __name__ == '__main__':
    main()
