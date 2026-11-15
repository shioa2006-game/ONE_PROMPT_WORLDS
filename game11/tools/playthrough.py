"""
ひゅるり、凧びより ― 通しプレイ（検証用）

  python tools/playthrough.py <出力フォルダ> [--speed 2] [--policy greedy] [--reload]

ヘッドレスの Microsoft Edge（1280×720）で file:// から開き、
  タイトル →「はじめる」→ はじめの話（3回クリック）→ 遊ぶ → 五つの凧 → ゆきぐも → むすび
まで、本物の マウス操作 で 通す。
  ・どこへ行くか / いつ ドン するか は tools/bot.js（ページに さしこむ）が きめる。
    ボットは 世界の ぜんぶの ものの 位置を 知っている（人より ずっと 有利）。
  ・きめた 目標の 位置へ 本物の マウスを うごかし、ドンは 本物の クリック。
    （つむじは マウスの ほうへ すすむ。ゲームの 入力と 同じ）
  ・--speed はゲーム内の 時計の 早回し（ルールは かわらない）。
  ・--reload … その二に 入ったら ページを 読みこみなおし、「つづきから」で 同じ 状態に もどるか を たしかめる。
画面写真と ログ（log.txt）を 出力フォルダに のこす。
"""
import json, sys, time, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri()
BOT = (ROOT / 'tools' / 'bot.js').read_text(encoding='utf-8')

STEP_JS = """(pol) => {
  const s = G11.sim, st = G11.state;
  const r = { state: st, S: s.wind.S, kite: s.kiteIdx, zone: s.zoneAt(s.wind.x, s.wind.y), boss: s.boss.st, hp: s.boss.hp, time: s.time, count: s.count, found: s.found.size, tre: s.tre.size };
  if (st === 'play') {
    const now = performance.now(); const dt = window.__lastStep ? Math.min(0.5, (now - window.__lastStep) / 1000 * G11.debug.speed) : 0.1; window.__lastStep = now;
    const t = TJBot.next(s, pol, dt);
    const tx = t ? t.x : s.wind.x, ty = t ? t.y : s.wind.y;
    let [sx, sy] = G11.debug.screenOf(tx, ty);
    const W = G11.R.W, H = G11.R.H;
    sx = Math.max(24, Math.min(W - 24, sx)); sy = Math.max(24, Math.min(H - 24, sy));
    // HUD の ボタンの 上では クリックしない
    if (sx > W - 270 && sy < 175) sy = 180;
    if (sx < 430 && sy < 125) sy = 130;
    r.sx = sx; r.sy = sy;
    r.blast = s.blastCd <= 0 && s.orbitReady() > 0 && TJBot.wantBlast(s, pol);
  }
  return r;
}"""


def main():
    args = sys.argv[1:]
    out = pathlib.Path(args[0])
    out.mkdir(parents=True, exist_ok=True)
    speed = float(args[args.index('--speed') + 1]) if '--speed' in args else 2
    pol = args[args.index('--policy') + 1] if '--policy' in args else 'greedy'
    do_reload = '--reload' in args
    logf = open(out / 'log.txt', 'w', encoding='utf-8')

    def log(*a):
        s = ' '.join(str(x) for x in a)
        print(s); logf.write(s + '\n'); logf.flush()

    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge', headless=True)
        ctx = b.new_context(viewport={'width': 1280, 'height': 720})
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)

        def shot(name):
            pg.screenshot(path=str(out / (name + '.png')))
            log('  [写真]', name)

        def button(bid):
            for _ in range(20):
                bs = pg.evaluate('G11.debug.buttons()')
                for bt in bs:
                    if bt['id'] == bid:
                        pg.mouse.move(bt['x'], bt['y'], steps=4)
                        pg.mouse.down(); pg.wait_for_timeout(40); pg.mouse.up()
                        return bt
                pg.wait_for_timeout(100)
            raise RuntimeError('ボタンが みつからない: ' + bid)

        def prepare():
            pg.add_script_tag(content=BOT)
            pg.evaluate('s => { G11.debug.speed = s; }', speed)

        pg.goto(URL)
        pg.wait_for_timeout(800)
        shot('01_title')
        t0 = time.time()
        bt = button('new')
        log('タイトル:「' + bt['label'] + '」を クリック')
        for i in range(3):
            pg.wait_for_timeout(800)
            st = pg.evaluate('G11.state')
            shot('02_intro_%d' % i)
            pg.mouse.move(640, 400); pg.mouse.down(); pg.wait_for_timeout(40); pg.mouse.up()
        pg.wait_for_timeout(300)
        log('はじめの話のあと:', pg.evaluate('G11.state'))
        prepare()
        last_log = -10
        kite_shot = set()
        boss_shot = False
        reloaded = False
        zone_seen = set()
        clicks = 0
        while True:
            r = pg.evaluate(STEP_JS, pol)
            st = r['state']
            if r['zone'] not in zone_seen:
                zone_seen.add(r['zone'])
                if st == 'play':
                    pg.wait_for_timeout(int(900 / speed))
                    shot('10_zone%d' % r['zone'])
            if st == 'play':
                pg.mouse.move(r['sx'], r['sy'])
                if r.get('blast'):
                    pg.mouse.down(); pg.wait_for_timeout(16); pg.mouse.up(); clicks += 1
                if do_reload and not reloaded and r['zone'] == 2 and r['kite'] >= 1 and r['S'] > 45:
                    reloaded = True
                    before = r
                    pg.evaluate('G11.debug.save()')
                    log('読みこみなおし前:', json.dumps({k: before[k] for k in ('S', 'kite', 'zone', 'count', 'found', 'tre')}, ensure_ascii=False))
                    pg.reload(); pg.wait_for_timeout(900)
                    shot('20_title_after_reload')
                    button('cont')
                    pg.wait_for_timeout(400)
                    after = pg.evaluate(STEP_JS, pol) if pg.evaluate('typeof TJBot') != 'undefined' else None
                    prepare()
                    after = pg.evaluate(STEP_JS, pol)
                    log('読みこみなおし後（つづきから）:', json.dumps({k: after[k] for k in ('state', 'S', 'kite', 'zone', 'count', 'found', 'tre')}, ensure_ascii=False))
                    shot('21_continue')
            elif st == 'kite':
                if r['kite'] not in kite_shot:
                    kite_shot.add(r['kite'])
                    pg.wait_for_timeout(int(1800 / speed))
                    shot('30_kite%d' % r['kite'])
            elif st == 'bossIntro':
                if not boss_shot:
                    boss_shot = True
                    pg.wait_for_timeout(int(1500 / speed))
                    shot('40_boss_intro')
            elif st == 'ending':
                log('むすびへ: ゲーム内 %.1f 秒 / 実時間 %.0f 秒' % (r['time'], time.time() - t0))
                pg.wait_for_timeout(int(4000 / speed)); shot('50_ending_a')
                pg.wait_for_timeout(int(9000 / speed)); shot('51_ending_b')
                for _ in range(80):
                    if pg.evaluate('G11.end && G11.end.done'):
                        break
                    pg.wait_for_timeout(500)
                pg.wait_for_timeout(600)
                shot('52_result')
                break
            elif st == 'pause':
                log('ひとやすみ画面に なった（Esc で もどす）')
                pg.keyboard.press('Escape')
            if r['time'] - last_log >= 20:
                last_log = r['time']
                log('t=%5.1f S=%8.1f 凧=%d 区間=%d ボス=%s/%d まきこみ=%d ずかん=%d おたから=%d ドン=%d' % (r['time'], r['S'], r['kite'], r['zone'], r['boss'], r['hp'], r['count'], r['found'], r['tre'], clicks))
                if r['boss'] == 'fight' and not boss_shot:
                    pass
            if r['boss'] == 'fight' and 'boss_fight' not in kite_shot:
                kite_shot.add('boss_fight')
                pg.wait_for_timeout(int(3000 / speed)); shot('41_boss_fight')
            if time.time() - t0 > 1500:
                log('時間切れ'); break
            pg.wait_for_timeout(40)
        # むすびの あと：タイトルへ → つづきから
        try:
            button('totitle')
            pg.wait_for_timeout(700)
            shot('60_title_after_clear')
            log('むすびの あと タイトル:', pg.evaluate('G11.state'), 'ボタン:', [x['label'] for x in pg.evaluate('G11.debug.buttons()')])
        except Exception as e:
            log('タイトルへ もどれない:', e)
        b.close()
    log('ページエラー・コンソールのエラー/警告:', len(errors))
    for e in errors:
        log('  ', e)
    logf.close()


if __name__ == '__main__':
    main()
