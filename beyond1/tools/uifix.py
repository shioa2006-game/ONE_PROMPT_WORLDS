"""賽駆け 天下 — 画面検証の共通部品（Playwright, Edge headless）
   tools/scenes.js が作った検証用の保存データを、使い捨てのブラウザの保存領域に入れ、
   タイトルの「つづきから」という通常の読み込み口から再開させる。利用者の保存データには触れない。"""
import os
import json
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
URL = 'file:///' + os.path.join(ROOT, 'index.html').replace(os.sep, '/')
SAVE_KEY = 'saigakeT_save'


def build_scenes(path):
    subprocess.run(['node', os.path.join(HERE, 'scenes.js'), path], check=True, capture_output=True)
    return json.load(open(path, encoding='utf-8'))


def open_page(browser, w, h):
    ctx = browser.new_context(viewport={'width': w, 'height': h})   # 毎回まっさらな保存領域
    pg = ctx.new_page()
    pg.errors = []
    pg.on('pageerror', lambda e: pg.errors.append(str(e)))
    pg.on('console', lambda m: pg.errors.append('console.error: ' + m.text) if m.type == 'error' else None)
    pg.goto(URL)
    pg.wait_for_function("window.SGT && document.getElementById('loading').classList.contains('hidden')", timeout=60000)
    return ctx, pg


def load_scene(browser, scene, w, h, tut=False):
    """シーンを「つづきから」で読み込んだページを返す"""
    ctx, pg = open_page(browser, w, h)
    pg.evaluate('''([k, s, tut]) => { localStorage.setItem(k, JSON.stringify(s)); localStorage.setItem(k + '_log', '[]'); if (!tut) localStorage.setItem('saigakeT_tut', 'done'); }''', [SAVE_KEY, scene, tut])
    pg.reload()
    pg.wait_for_function("window.SGT && document.getElementById('loading').classList.contains('hidden')", timeout=60000)
    pg.wait_for_timeout(200)
    b = pg.evaluate('SGT.debug.buttons()')
    pg.mouse.click(*b['b-cont'])
    pg.wait_for_timeout(700)
    return ctx, pg


def buttons(pg):
    return pg.evaluate('SGT.debug.buttons()')


def wait_idle(pg, timeout=20000):
    pg.wait_for_function('!SGT.debug.busy()', timeout=timeout)


def dice_report(pg):
    """賽ごとの矩形・見た目の中心で実際にクリックが届く要素・番号の読める位置"""
    return pg.evaluate('''() => {
      const out = [];
      const dice = [...document.querySelectorAll('#dice .die')];
      dice.forEach((d, i) => {
        const r = d.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        const num = d.querySelector('.num').getBoundingClientRect();
        const rr = d.querySelector('.rr');
        let rrHit = null;
        if (rr) { const q = rr.getBoundingClientRect(); const e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); rrHit = e === rr; }
        out.push({ i, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
          hitSelf: !!hit && d.contains(hit), numBottom: Math.round(num.bottom), rrHit });
      });
      // 矩形どうしの重なり
      let overlap = 0;
      for (let a = 0; a < out.length; a++) for (let b = a + 1; b < out.length; b++) {
        const A = out[a], B = out[b];
        if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) overlap++;
      }
      const tray = document.getElementById('tray').getBoundingClientRect();
      const btns = document.getElementById('tray-btns').getBoundingClientRect();
      const maxNum = Math.max(...out.map(o => o.numBottom));
      return { n: out.length, overlap, allHit: out.every(o => o.hitSelf), numAboveButtons: maxNum <= btns.top + 1,
        inside: out.every(o => o.x >= tray.left && o.x + o.w <= tray.right), tray: [Math.round(tray.left), Math.round(tray.top), Math.round(tray.width), Math.round(tray.height)], dice: out };
    }''')
