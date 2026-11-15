# 通しプレイ確認: ヘッドレスの Edge で実際のゲームを開き、表紙から結末まで進める。
#   python tools/playthrough.py <出力フォルダ>
# A) 1面は「本物のマウス操作」をリアルタイムに送って解く（表紙のボタン、R、Esc、牧場えらびも実入力）
# B) 2面以降は tools/results/replay.json（node tools/record.js で作る入力記録）を
#    ゲーム本体の1コマ送りに流し込み、ゲーム側でも同じくクリアになるかを確かめる
# C) 最後の面のあとは、実クリックで結末 → 牧場えらび → 再読み込みで記録が残るかを見る
import sys, json, math, pathlib, time
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else root / 'tools' / 'results' / 'play')
out.mkdir(parents=True, exist_ok=True)
url = (root / 'index.html').as_uri()
replay = json.loads((root / 'tools' / 'results' / 'replay.json').read_text(encoding='utf-8'))
log = []
def say(*a):
    line = ' '.join(str(x) for x in a); log.append(line); print(line)

STATE = """(() => { const h = __hitsuji, S = h.S; return {scene: h.scene, clearT: h.clearT,
  done: S ? S.done : null, settled: S ? S.settled : null, total: S ? S.total : null, clock: S ? S.clock : null,
  dog: S ? [S.dog.x, S.dog.y, S.dog.gait] : null,
  animals: S ? S.animals.map(a => [a.x, a.y, a.settled ? 1 : 0]) : [],
  level: S && S.level.name, stars: h.save.stars, best: h.save.best }; })()"""

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge')
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(url)
    pg.evaluate("localStorage.clear()")
    pg.reload()
    pg.wait_for_timeout(600)
    st = lambda: pg.evaluate(STATE)

    # ---- A) 実入力 ----
    s0 = st(); say('title scene:', s0['scene'], 'sheep on title:', s0['total'])
    d0 = s0['dog']
    pg.mouse.move(500, 450, steps=8); pg.wait_for_timeout(900)
    d1 = st()['dog']
    say('title: dog follows mouse:', round(math.hypot(d1[0] - d0[0], d1[1] - d0[1])) > 40)
    pg.mouse.move(480, 440); pg.mouse.down(); pg.mouse.move(820, 440, steps=4); pg.wait_for_timeout(500)
    say('title: dash gait while held:', st()['dog'][2] == 2)
    pg.mouse.up()
    pg.screenshot(path=str(out / 'A0_title.png'))
    pg.mouse.click(640, 639)            # はじめる
    pg.wait_for_timeout(900)
    s = st(); say('after start click:', s['scene'], s['level'])

    # 1面を本物のマウスで追い込む（いちばん遠い羊のうしろへ回る、を 80ms ごとに）
    gate = (1060, 385)
    t0 = time.time(); shot = False
    while time.time() - t0 < 70:
        s = st()
        if s['done']: break
        un = [a for a in s['animals'] if not a[2]]
        far = max(un, key=lambda a: math.hypot(a[0] - gate[0], a[1] - gate[1]))
        dx, dy = far[0] - gate[0], far[1] - gate[1]; dl = math.hypot(dx, dy) or 1
        pg.mouse.move(far[0] + dx / dl * 48, far[1] + dy / dl * 48)
        if not shot and s['settled'] >= 2: pg.screenshot(path=str(out / 'A1_l1_settling.png')); shot = True
        pg.wait_for_timeout(80)
    s = st(); say('L1 real-mouse clear:', s['done'], 'time', round(s['clock'], 1), 'stars', s['stars'])
    pg.wait_for_timeout(2400)
    pg.screenshot(path=str(out / 'A2_l1_clear_panel.png'))
    pg.keyboard.press('r'); pg.wait_for_timeout(300)
    s = st(); say('R restarts level:', s['scene'] == 'play' and s['settled'] == 0 and not s['done'])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(900)
    say('Esc -> select:', st()['scene'])
    pg.screenshot(path=str(out / 'A3_select.png'))
    pg.mouse.click(272, 365); pg.wait_for_timeout(900)      # 2番の牧場
    s = st(); say('select node 2 click ->', s['scene'], s['level'])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(900)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(900)
    say('Esc from select -> title:', st()['scene'])
    pg.screenshot(path=str(out / 'A4_title_continue.png'))

    # ---- B) 入力記録の流し込み ----
    for r in replay:
        i = r['level']
        res = pg.evaluate("""([i, seed, rec]) => { const h = __hitsuji; h.hold(true); h.goto(i, seed);
            let n = 0; for (const f of rec) { h.tick(f[0], f[1], f[2]); n++; if (h.S.done) break; }
            h.draw(); return {done: h.S.done, clock: h.S.clock, frames: n, stars: h.save.stars[i]}; }""", [i, r['seed'], r['rec']])
        say('replay L%d: done=%s game_time=%.1f bot_time=%.1f stars=%s' % (i + 1, res['done'], res['clock'], r['time'], res['stars']))
        pg.evaluate("(() => { const h = __hitsuji; for (let k = 0; k < 150; k++) h.tick(h.S.dog.x, h.S.dog.y, 0); h.step(1); })()")
        pg.screenshot(path=str(out / ('B_l%d_clear.png' % (i + 1))))

    # ---- C) 結末 ----
    pg.evaluate("__hitsuji.hold(false)")
    pg.wait_for_timeout(1200)
    s = st(); say('last level panel up: clearT>1.3:', s['clearT'] > 1.3, 'all stars:', s['stars'])
    pg.mouse.click(795, 474)                 # 夜空を 見あげる
    pg.wait_for_timeout(1200)
    say('-> ending:', st()['scene'])
    pg.wait_for_timeout(9000)
    pg.screenshot(path=str(out / 'C1_ending_count.png'))
    pg.mouse.click(300, 300); pg.wait_for_timeout(2200)       # とばす
    pg.screenshot(path=str(out / 'C2_ending_end.png'))
    pg.mouse.click(640, 674); pg.wait_for_timeout(900)        # 牧場えらびへ
    say('ending button -> select:', st()['scene'])
    pg.screenshot(path=str(out / 'C3_select_all.png'))
    pg.reload(); pg.wait_for_timeout(600)
    s = st(); say('after reload: stars kept:', s['stars'])
    pg.screenshot(path=str(out / 'C4_title_after.png'))
    say('page errors:', errs)
    b.close()
(out / 'playthrough-log.txt').write_text('\n'.join(log), encoding='utf-8')
