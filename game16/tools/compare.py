"""くるり、呪いほどき — 「組み替え前後を同じ回転で比べる」確認（Playwright + Edge headless、実際のクリック）
   python tools/compare.py OUTDIR [seed]
   1) 村の二戦目の前（工房）から試し詠唱へ入り、回して詠唱する（組み替え前）。
   2) 工房へもどり、もらった光の紋を1つ置く。置き場所は「さっきの回転で、いちばん結果が良くなるマス」を
      ページ内で計算して選ぶ（盤面を見て置き場所を考えるプレイヤーの代わり）。置く操作は実際のクリック。
   3) もう一度試し詠唱へ入り、「同じ回転で試す」を押して詠唱する（組み替え後）。
   各段階の画面を OUTDIR に保存し、結果の数字を表示する。"""
import sys
import os
import json
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shot import URL, to_page, run  # noqa: E402

out = sys.argv[1]
seed = int(sys.argv[2]) if len(sys.argv) > 2 else 11
os.makedirs(out, exist_ok=True)

PICK = """(() => {
  const s = KR16.state(), P = KR16.BS.practice, b = s.b;
  // 組み替え前の回転（P.spinPos）で、光の紋を各空きマスに置いたときの結果を比べる
  const base = P.results[0];
  let best = null;
  for (let r = 0; r < s.reels.length; r++) for (let k = 0; k < 8; k++) {
    const old = s.reels[r].strip[k];
    if (old.t !== 'blank') continue;
    s.reels[r].strip[k] = { t: 'light', lv: 1 };
    const reels = s.reels.map((rl, c) => ({ strip: rl.strip, pos: P.spinPos[c] }));
    const res = RR.evaluate(b, reels, new Array(b.R).fill(0));
    s.reels[r].strip[k] = old;
    const sc = res.purified.length * 100 + Object.values(res.total).reduce((a, v) => a + v, 0);
    if (!best || sc > best.sc) best = { r: r, k: k, sc: sc, n: res.purified.length };
  }
  return best;
})()"""

with sync_playwright() as p:
    br = p.chromium.launch(channel='msedge')
    pg = br.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_timeout(600)
    pg.evaluate("localStorage.clear(); KR16.goto(1, %d); KR16.state().gifts = [{t:'light', lv:1}]; KR16.workshop();" % seed)
    pg.wait_for_timeout(300)
    run(pg, [{'shot': '01_workshop_before.png'}, {'btn': 'practice'}, {'wait': 300}, {'key': 'Space'}, {'idle': 3000}, {'wait': 300},
             {'shot': '02_before_spin.png'}, {'key': 'Space'}, {'wait': 400}, {'shot': '03_before_casting.png'}, {'idle': 4000}, {'wait': 200}], out, False)
    before = pg.evaluate('KR16.BS.practice.results[0]')
    pick = pg.evaluate(PICK)
    print('組み替え前:', before)
    print('置く場所（リール, 段）:', pick)
    run(pg, [{'shot': '04_before_result.png'}, {'btn': 'back'}, {'wait': 300}], out, False)
    run(pg, [{'btn': 'inv0'}], out, False)
    q = pg.evaluate('KR16.wkCell(%d,%d)' % (pick['r'], pick['k']))
    run(pg, [{'click': [q['x'], q['y']]}, {'wait': 300}, {'shot': '05_workshop_after.png'}, {'btn': 'practice'}, {'wait': 300},
             {'btn': 'same'}, {'idle': 3000}, {'wait': 300}, {'shot': '06_after_spin.png'}, {'key': 'Space'}, {'wait': 400},
             {'shot': '07_after_casting.png'}, {'idle': 4000}, {'wait': 200}, {'shot': '08_after_result.png'}], out, False)
    after = pg.evaluate('KR16.BS.practice.results[0]')
    print('組み替え後（同じ回転）:', after)
    print('errors:', errs)
    br.close()
