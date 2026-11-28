# だれと行く？ — ページの中で、解き方の例（routes.js）とボットを使って依頼を通し、要所を撮る（演出・表示のエラー探し用）
# 使い方: python tools/jsrun.py OUT_DIR [m1,m2,...] [--party GS]
# 本物のクリックではない（G21.act でルールを直接動かす）。本物の操作での通しは tools/playthrough.py
import json, os, sys, time, subprocess
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file:///' + os.path.join(ROOT, 'index.html').replace('\\', '/')
PARTY = {'GS': ['gard', 'sena'], 'GT': ['gard', 'tobi'], 'ST': ['sena', 'tobi']}


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    only = sys.argv[2].split(',') if len(sys.argv) > 2 and not sys.argv[2].startswith('--') else None
    pk = sys.argv[sys.argv.index('--party') + 1] if '--party' in sys.argv else 'GS'
    routes = json.loads(subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify(require('./tools/routes.js')))"], cwd=ROOT).decode('utf-8'))
    errs = []
    with sync_playwright() as p:
        br = p.chromium.launch(channel='msedge')
        pg = br.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        pg.goto(URL)
        pg.wait_for_timeout(400)
        pg.add_script_tag(path=os.path.join(ROOT, 'tools', 'bot.js'))
        pg.evaluate("G21.setOpt({fast: true}); G21.newProfile(); G21.prof().roster.push('tobi'); G21.prof().up.rope2 = true")

        def idle(limit=30):
            t0 = time.time()
            pg.wait_for_timeout(100)
            while time.time() - t0 < limit and pg.evaluate('G21.busy()'):
                pg.wait_for_timeout(60)
            pg.wait_for_timeout(100)

        def shot(name):
            pg.screenshot(path=os.path.join(out, name + '.png'))

        def fight(tag):
            n = 0
            while pg.evaluate("G21.state().mode") == 'combat' and n < 40:
                if n == 0:
                    shot(tag + '_fight')
                plan = pg.evaluate("BOT21.planPhase(G21.state(), 'greedy')")
                for a in plan:
                    pg.evaluate(f"G21.select('{a['hero']}')")
                    r = pg.evaluate(f"(() => {{ const p = G21.act('{a['hero']}', {json.dumps(a['intent'])}); return p.ok }})()")
                    idle()
                    if not r:
                        print('  act NG', a)
                if pg.evaluate("G21.state().mode") != 'combat' or pg.evaluate("G21.state().lost"):
                    break
                pg.keyboard.press('Space')
                idle()
                n += 1
                if n == 2:
                    shot(tag + '_fight2')
            if pg.evaluate("!!G21.state().lost"):
                print('  負けた', tag)

        mids = only or list(routes.keys())
        for mid in mids:
            party = PARTY[pk] if pk in routes[mid] else PARTY['GS']
            key = pk if pk in routes[mid] else 'GS'
            pg.evaluate(f"G21.mission('{mid}', {json.dumps(party)})")
            pg.wait_for_timeout(300)
            pg.keyboard.press('Space')
            idle()
            shot(mid + '_' + key + '_00')
            for i, step in enumerate(routes[mid][key]):
                fight(mid + '_' + str(i))
                hero, intent = step[0], step[1]
                skip = step[2] if len(step) > 2 else None
                if skip and pg.evaluate(f"!!G21.state().flags['{skip}']"):
                    continue
                pg.evaluate(f"G21.select('{hero}')")
                ok = pg.evaluate(f"(() => {{ const p = G21.act('{hero}', {json.dumps(intent)}); return p.ok ? 'ok' : p.why }})()")
                if ok != 'ok':
                    print('  NG', mid, hero, intent, ok)
                idle()
                shot(mid + '_' + key + '_%02d' % (i + 1))
            fight(mid + '_end')
            cl = pg.evaluate("!!G21.state().flags.cleared")
            print(mid, key, 'cleared' if cl else 'NOT CLEARED', pg.evaluate("G21.caption()"))
            shot(mid + '_' + key + '_zz')
            if cl:
                pg.evaluate("G21.goGuild(true)")
                pg.wait_for_timeout(1600)
                shot(mid + '_guild_result')
                for _ in range(12):
                    bs = pg.evaluate('G21.buttons()')
                    nxt = [b for b in bs if b['key'] in ('resnext', 'ranknext', 'joinnext', 'newsnext')]
                    if nxt:
                        pg.mouse.click(nxt[0]['x'], nxt[0]['y'])
                        pg.wait_for_timeout(1200)
                        shot(mid + '_guild_%s' % nxt[0]['key'])
                        continue
                    pg.mouse.click(640, 560)
                    pg.wait_for_timeout(500)
                shot(mid + '_guild_after')
        br.close()
    print('ERRORS:', *errs[:20], sep='\n  ') if errs else print('no page errors')


if __name__ == '__main__':
    main()
