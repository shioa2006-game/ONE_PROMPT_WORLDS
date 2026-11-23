# STAIRWARD — 同じ陣を、持ち場を一人だけ変えて二度迎え撃ち、同じ時刻の画面と出来事を比べる
# 使い方: python tools/compare.py OUT_DIR 陣ID "ilza=s_land,ruu=w_sw" "ilza=s_land,ruu=w_se" [時刻 秒,...]
# 配置は本物のクリック（札 → 旗）で行い、「迎え撃つ」も本物のクリックで押す。
# 迎撃が始まったら K20.hold で止め、決まった時刻まで1歩ずつ進めて撮る（両方の回で同じ時刻をそろえるため）。
import json, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file:///' + os.path.join(ROOT, 'index.html').replace('\\', '/')


def parse(s):
    return dict(kv.split('=') for kv in s.split(',') if kv)


def main():
    out, wid, a, b = sys.argv[1:5]
    times = [float(x) for x in sys.argv[5].split(',')] if len(sys.argv) > 5 else [6, 12, 18, 24]
    os.makedirs(out, exist_ok=True)
    errs = []
    with sync_playwright() as p:
        br = p.chromium.launch(channel='msedge')
        pg = br.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL)
        pg.wait_for_timeout(400)
        pg.evaluate('localStorage.clear()')

        def to_px(x, y):
            r = pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width / 1280]; })()")
            return r[0] + x * r[2], r[1] + y * r[2]

        def click(x, y, button='left'):
            px, py = to_px(x, y)
            pg.mouse.move(px, py)
            pg.wait_for_timeout(60)
            pg.mouse.down(button=button)
            pg.mouse.up(button=button)
            pg.wait_for_timeout(80)

        def btn(key):
            for _ in range(20):
                bs = pg.evaluate('K20.buttons()')
                hit = [x for x in bs if x['key'] == key and x['enabled']]
                if hit:
                    click(hit[-1]['x'], hit[-1]['y'])
                    return
                pg.wait_for_timeout(100)
            raise RuntimeError('no button ' + key)

        # 陣の作戦画面へ
        n, w = pg.evaluate(f"(() => {{ for (let i = 0; i < K20.D.NIGHTS.length; i++) for (let j = 0; j < K20.D.NIGHTS[i].waves.length; j++) if (K20.D.NIGHTS[i].waves[j].id === '{wid}') return [i, j]; }})()")
        pg.evaluate(f'K20.goto({n}, {w})')
        pg.wait_for_timeout(300)
        report = {}
        for tag, pls in (('A', a), ('B', b)):
            pl = parse(pls)
            # いまの配置を右クリックで外して、置きなおす
            for ally, sid in pg.evaluate('K20.state().pl').items():
                r = pg.evaluate(f"K20.slotScreen('{sid}')")
                click(r['x'], r['y'], 'right')
            allies = pg.evaluate('K20.G.wave.allies')
            for ally in allies:
                if ally not in pl:
                    continue
                btn('card_' + ally)
                r = pg.evaluate(f"K20.slotScreen('{pl[ally]}')")
                click(r['x'], r['y'])
            got = pg.evaluate('K20.state().pl')
            assert got == pl, (got, pl)
            pg.mouse.move(*to_px(700, 330))
            pg.wait_for_timeout(250)
            pg.screenshot(path=os.path.join(out, f'{wid}_{tag}_plan.png'))
            btn('start')
            pg.evaluate('K20.hold(true)')
            log = []
            for t in times:
                pg.evaluate(f"""(() => {{ const st = K20.G.st; const evs = [];
                    while (!st.over && st.t < {t}) {{ K20.S.step(st); for (const e of st.events) {{
                        if (['block','leak','down','combo','gatebreak','slip','assist','torch'].includes(e.type)) evs.push(e); }}
                        K20.G.st.events.forEach(e => {{}}); st.events.length = 0; }}
                    window.__evs = (window.__evs || []).concat(evs.map(e => ({{ t: +e.t.toFixed(1), type: e.type, a: e.a ? e.a.id : null, b: e.b ? e.b.id : null, e: e.e ? e.e.type : null, r: e.e ? e.e.r : null, id: e.id || null, ex: e.e ? +e.e.x.toFixed(1) : null, ey: e.e ? +e.e.y.toFixed(1) : null }})));
                }})()""")
                pg.evaluate('K20.tick(1/60)')
                pg.wait_for_timeout(120)
                pg.screenshot(path=os.path.join(out, f'{wid}_{tag}_t{int(t):02d}.png'))
            # 最後まで
            pg.evaluate("""(() => { const st = K20.G.st; const evs = [];
                while (!st.over && st.t < 400) { K20.S.step(st); for (const e of st.events) {
                    if (['block','leak','down','combo','gatebreak','slip','assist','torch'].includes(e.type)) evs.push(e); } st.events.length = 0; }
                window.__evs = (window.__evs || []).concat(evs.map(e => ({ t: +e.t.toFixed(1), type: e.type, a: e.a ? e.a.id : null, b: e.b ? e.b.id : null, e: e.e ? e.e.type : null, r: e.e ? e.e.r : null, id: e.id || null, ex: e.e ? +e.e.x.toFixed(1) : null, ey: e.e ? +e.e.y.toFixed(1) : null })));
            })()""")
            evs = pg.evaluate('window.__evs')
            pg.evaluate('window.__evs = []')
            st = pg.evaluate("""(() => { const st = K20.G.st; return { result: st.result, leaks: st.stats.leaks, gateT: st.stats.gateT, allies: Object.fromEntries(st.allies.map(a => [a.id, { slot: a.slot.name, hp: Math.round(a.hp), held: st.stats.allies[a.id].held, kills: st.stats.allies[a.id].kills, assists: st.stats.allies[a.id].assists, downs: st.stats.allies[a.id].downs, burnBest: st.stats.allies[a.id].burnBest }])), combos: st.stats.combos }; })()""")
            pg.evaluate('K20.hold(false)')
            pg.wait_for_timeout(1600)
            pg.screenshot(path=os.path.join(out, f'{wid}_{tag}_result.png'))
            report[tag] = {'placement': pl, 'summary': st, 'events': evs}
            # 結果画面から「持ち場を変えてもう一度」／「持ち場を見直す」で作戦に戻る
            keys = [x['key'] for x in pg.evaluate('K20.buttons()')]
            btn('again' if 'again' in keys else 'retry')
            pg.wait_for_timeout(300)
            pg.screenshot(path=os.path.join(out, f'{wid}_{tag}_replan.png'))
        json.dump(report, open(os.path.join(out, f'{wid}_compare.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        br.close()
    for tag in ('A', 'B'):
        s = report[tag]['summary']
        print(tag, report[tag]['placement'], 'win' if s['result']['win'] else 'LOSE', 'lamps', s['result']['lamps'], 'leaks', s['leaks'], 'gate', s['gateT'])
        for k, v in s['allies'].items():
            print('   ', k, v)
        print('    combos', s['combos'])
        firsts = {}
        for e in report[tag]['events']:
            if e['type'] == 'block' and e['a'] not in firsts:
                firsts[e['a']] = e
        for k, e in firsts.items():
            print('    first block', k, 't=%s' % e['t'], e['r'], (e['ex'], e['ey']))
        for e in report[tag]['events']:
            if e['type'] in ('leak', 'down', 'gatebreak', 'torch'):
                print('    ', e)
    for e in errs:
        print('ERR', e)


if __name__ == '__main__':
    main()
