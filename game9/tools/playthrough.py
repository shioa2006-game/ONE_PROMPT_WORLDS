# 通しプレイ確認：ヘッドレスの Edge で 実際のゲームを開き、表紙から結末まで進める。
#   python tools/playthrough.py [出力フォルダ]
# A) 表紙の「はじめる」・はじめの文・1-1 は「本物のマウス操作」をリアルタイムに送って解く
#    （ページ内の作戦関数 __plan が 玉の着地点と ねらい線を読み、Python が その位置へ 本物のマウスを動かし、本物のクリックで はく）
# B) 1-2 以降は tools/results/replay.json（node tools/record.js が作る入力記録）を
#    ゲーム本体の1ステップ送りに流し込み、ブラウザでも node と同じ結果（ぬけた・時間・きらら・おとしもの）になるかを確かめる
# C) 最後の部屋のあと：結末 → 本物のクリックで「タイトルへ」→ 再読み込みで「つづきから」と おとしものが残るか
# D) 本物のキー操作：Esc でメニュー、↓↓ Enter で「へやを えらぶ」、Esc で表紙へ
import sys, json, pathlib, time
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else root / 'tools' / 'results' / 'play')
out.mkdir(parents=True, exist_ok=True)
url = (root / 'index.html').as_uri()
replay = json.loads((root / 'tools' / 'results' / 'replay.json').read_text(encoding='utf-8'))
log = []
def say(*a):
    line = ' '.join(str(x) for x in a); log.append(line); print(line)

PLAN = r"""
window.__plan = function () {
  const h = __sks, S = h.S, G = h.G, w = G.w;
  if (!w || G.scene !== 'play') return { scene: G.scene };
  const b = w.balls[0], f = w.frog;
  const score = (tr) => {
    if (!tr) return -1; if (tr.exit) return w.lidOpen ? 9999 : -50; if (tr.i === undefined) return 0;
    let s = 1; const t = tr.type;
    if (t === S.T.LID) s += 60; if (t === S.T.ANCHOR) s += 40; if (t === S.T.TREAS) s += 25; if (t === S.T.BLAST) s += 30;
    const dmg = w.dmg(b); const br = t === S.T.LID ? w.lidHp <= dmg : w.hp[tr.i] <= dmg;
    if (br && t !== S.T.LID) s += w.fallingIf(tr.i).length * 6;
    if (tr.pts && tr.pts.length) s += Math.max(0, 600 - tr.pts[tr.pts.length - 1][1]) * 0.02;
    return s;
  };
  const res = { scene: G.scene, state: b.state, done: w.done, lid: w.lidOpen, t: w.t, frogX: f.x };
  if (b.state === 'held') {
    const m = w.mouth(); let best = -1e9, ba = -Math.PI / 2;
    for (let d = -160; d <= -20; d += 2) { const a = d * Math.PI / 180; const s = score(w.trace(m.x, m.y, Math.cos(a), Math.sin(a), 1500, false)); if (s > best) { best = s; ba = a; } }
    res.aimX = 320 + m.x + Math.cos(ba) * 220; res.aimY = m.y + Math.sin(ba) * 220;
  } else if (b.state === 'free' && b.vy > 0) {
    const sp = Math.hypot(b.vx, b.vy); const tr = w.trace(b.x, b.y, b.vx / sp, b.vy / sp, 1600, true);
    if (tr.land !== undefined) {
      let best = -1e9, bu = 0;
      for (let u = -0.9; u <= 0.91; u += 0.1) { const a = u * 62 * Math.PI / 180; const s = score(w.trace(tr.land, S.PAD_Y - S.BALL_R, Math.sin(a), -Math.cos(a), 1500, false)) - Math.abs(u) * 0.5; if (s > best) { best = s; bu = u; } }
      res.tx = 320 + tr.land - bu * S.FROG_HALF;
    } else res.tx = 320 + b.x;
  } else if (b.state === 'free') res.tx = 320 + b.x;
  return res;
};
"""

STATE = "(() => { const h = __sks, G = h.G, w = G.w; return { scene: G.scene, idx: G.idx, paused: G.paused, done: w ? w.done : null, gems: w ? w.gems : null, found: h.save.found.slice(), reached: h.save.reached, cur: h.save.cur, cleared: Object.keys(h.save.cleared).length, endT: G.endT }; })()"

with sync_playwright() as p:
    br = p.chromium.launch(channel='msedge')
    pg = br.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    pg.goto(url)
    pg.evaluate("localStorage.clear()")
    pg.reload()
    pg.wait_for_timeout(500)
    st = lambda: pg.evaluate(STATE)

    # ---- A) 本物の入力 ----
    say('A: title scene =', st()['scene'])
    pg.screenshot(path=str(out / 'A0_title.png'))
    pg.mouse.click(640, 380)          # はじめる
    pg.wait_for_timeout(300)
    say('A: after start click:', st()['scene'])
    for k in range(3):
        pg.wait_for_timeout(500)
        pg.mouse.click(640, 400)
    pg.wait_for_timeout(300)
    s = st(); say('A: after 3 intro clicks:', s['scene'], 'room', s['idx'])
    pg.evaluate(PLAN)
    t0 = time.time(); spits = 0; moves = 0; shot = False
    while time.time() - t0 < 120:
        pl = pg.evaluate("__plan()")
        if pl['scene'] != 'play': break
        if pl.get('done'): time.sleep(0.05); continue
        if pl['state'] == 'held' and 'aimX' in pl:
            pg.mouse.move(pl['aimX'], max(5, pl['aimY']), steps=3)
            pg.wait_for_timeout(120)
            pg.mouse.down(); pg.wait_for_timeout(60); pg.mouse.up()
            spits += 1
            if spits == 1 and not shot:
                pg.wait_for_timeout(700); pg.screenshot(path=str(out / 'A1_first_shot.png')); shot = True
        elif 'tx' in pl:
            pg.mouse.move(pl['tx'], 560); moves += 1
        time.sleep(0.03)
    s = st()
    say('A: 1-1 by real mouse: scene', s['scene'], 'room', s['idx'], 'spits', spits, 'moves', moves, 'time %.1fs' % (time.time() - t0), 'found', s['found'])
    pg.wait_for_timeout(600)
    pg.screenshot(path=str(out / 'A2_rise.png'))
    pg.wait_for_timeout(2500)
    s = st(); say('A: after rise:', s['scene'], 'room', s['idx'], 'reached', s['reached'])

    # ---- B) 記録の流し込み ----
    pg.evaluate("__sks.hold(true)")
    ok_all = True
    for rec in replay[1:]:
        i = rec['i']
        pg.evaluate(f"__sks.goto({i}, {rec['seed']})")
        res = pg.evaluate("""(inputs) => { const h = __sks; let n = 0;
            outer: for (const a of inputs) { const inp = { tx: a[1], btn: !!a[2] }; if (a[3] !== null) { inp.ax = a[3]; inp.ay = a[4]; } if (a[5]) inp.spit = true;
              for (let q = 0; q < a[0]; q++) { h.tick(inp); n++; if (h.G.w.done) break outer; } }
            const w = h.G.w; return { n, done: w.done, t: +w.t.toFixed(3), gems: w.gems, found: w.found.slice() }; }""", rec['inputs'])
        same = res['done'] == rec['done'] and abs(res['t'] - rec['t']) < 1e-6 and res['gems'] == rec['gems'] and res['found'] == rec['found']
        ok_all = ok_all and same
        say('B:', rec['id'], 'done', res['done'], 't', res['t'], 'gems', res['gems'], 'found', res['found'], 'same as node:', same)
        # ぬけたあとの進行（上へ のぼる／最後は結末）を ゲームの更新で進める
        pg.evaluate("for (let k = 0; k < 40; k++) __sks.frame(1/60);")
        sc = pg.evaluate("__sks.G.scene")
        if i == 4:
            pg.screenshot(path=str(out / 'B_mid_rise.png'))
        if i < len(replay) - 1 and sc != 'rise':
            say('  !! expected rise, got', sc); ok_all = False
        pg.evaluate("for (let k = 0; k < 200; k++) __sks.frame(1/60);")
    say('B: all replays matched node:', ok_all)
    s = st(); say('B: after last room: scene', s['scene'], 'found', len(s['found']), 'cleared', s['cleared'])

    # ---- C) 結末 ----
    pg.evaluate("__sks.hold(false)")
    pg.wait_for_timeout(2500)
    pg.screenshot(path=str(out / 'C0_ending_sky.png'))
    pg.wait_for_timeout(4500)
    pg.screenshot(path=str(out / 'C1_ending_words.png'))
    pg.mouse.click(640, 300)            # はやおくり
    t1 = time.time()
    while time.time() - t1 < 15 and st()['endT'] < 16:
        pg.wait_for_timeout(300)
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(out / 'C2_ending_summary.png'))
    pg.mouse.click(640 + 20 + 115, 548 + 24)   # タイトルへ
    pg.wait_for_timeout(500)
    say('C: after ending click:', st()['scene'])
    pg.reload(); pg.wait_for_timeout(600)
    s = st(); say('C: after reload: scene', s['scene'], 'found', len(s['found']), 'cleared', s['cleared'], 'cur', s['cur'])
    pg.screenshot(path=str(out / 'C3_title_after.png'))

    # ---- D) キーでメニュー ----
    pg.mouse.click(640, 352 + 26)      # つづきから
    pg.wait_for_timeout(500)
    s = st(); say('D: continue ->', s['scene'], 'room', s['idx'])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    say('D: Esc -> paused', st()['paused'])
    pg.keyboard.press('ArrowDown'); pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(100)
    pg.screenshot(path=str(out / 'D0_pause_keys.png'))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    say('D: down,down,Enter ->', st()['scene'])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    say('D: Esc ->', st()['scene'])
    pg.keyboard.press('m'); pg.wait_for_timeout(100)
    say('D: M -> muted', pg.evaluate("__sks.save.muted"))

    # ---- E) キーボードだけで あそぶ ----
    K = "(() => { const w = __sks.G.w; const b = w.balls[0]; return { scene: __sks.G.scene, frog: Math.round(w.frog.x), st: b.state, vx: Math.round(b.vx), bx: Math.round(b.x), aim: +w.aim.toFixed(2) }; })()"
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(400)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    s0 = pg.evaluate(K)
    pg.keyboard.down('ArrowRight'); pg.wait_for_timeout(350); pg.keyboard.up('ArrowRight')
    s1 = pg.evaluate(K)
    say('E: Enter(title) Esc(intro) ->', s0['scene'], s0['st'], '| hold -> aim', s0['aim'], '->', s1['aim'])
    pg.keyboard.press(' '); pg.wait_for_timeout(150)          # すばやい おしはなし
    s2 = pg.evaluate(K); say('E: quick Space tap -> ball', s2['st'], 'vx', s2['vx'])
    pg.keyboard.down('ArrowLeft'); pg.wait_for_timeout(300); pg.keyboard.up('ArrowLeft')
    s3 = pg.evaluate(K); say('E: ArrowLeft 0.3s -> frog', s2['frog'], '->', s3['frog'])
    pg.keyboard.down(' '); t0 = time.time(); got = False
    while time.time() - t0 < 10:
        s = pg.evaluate(K)
        if s['st'] == 'held': got = True; break
        key = 'ArrowLeft' if s['bx'] < s['frog'] - 20 else 'ArrowRight' if s['bx'] > s['frog'] + 20 else None
        if key: pg.keyboard.down(key); pg.wait_for_timeout(50); pg.keyboard.up(key)
        else: pg.wait_for_timeout(40)
    say('E: hold Space until the ball comes down -> caught', got)
    pg.keyboard.down('ArrowLeft'); pg.wait_for_timeout(250); pg.keyboard.up('ArrowLeft')
    pg.keyboard.up(' '); pg.wait_for_timeout(100)
    s4 = pg.evaluate(K); say('E: aim left and release Space -> ball', s4['st'], 'vx', s4['vx'])

    say('page errors / console errors:', len(errs))
    for e in errs[:10]: say('  ', e)
    br.close()
# 画面写真は 出力フォルダへ、記録だけ results へ
(root / 'tools' / 'results' / 'playthrough-log.txt').write_text('\n'.join(log), encoding='utf-8')
