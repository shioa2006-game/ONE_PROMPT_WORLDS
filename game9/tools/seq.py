# 連続コマの撮影：準備の JS を流したあと、n コマ（1コマ = k ステップ）ごとに撮って 1枚の一覧にする
#   python tools/seq.py <出力png> <部屋番号> <準備JS> <コマ数> <1コマのステップ数> [入力JS]
# 入力JS は 1ステップごとの入力（例："({tx: 320})"）。省略時は ボット（shots.py の __bot）で動かす。
import sys, pathlib
from playwright.sync_api import sync_playwright
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from shots import BOT  # noqa: E402  （shots.py の SCENES は撮らない：__name__ ガードなし のため import 時に撮影しないよう分けてある）

root = pathlib.Path(__file__).resolve().parent.parent
out, idx, setup, n, k = sys.argv[1], int(sys.argv[2]), sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
inpjs = sys.argv[6] if len(sys.argv) > 6 else None
url = (root / 'index.html').as_uri()
frames = []
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge')
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.evaluate("localStorage.clear()"); pg.goto(url); pg.wait_for_timeout(200)
    pg.evaluate(BOT)
    pg.evaluate(f"(() => {{ __sks.goto({idx}, 5); __sks.hold(); {setup} }})()")
    tmp = pathlib.Path(out).with_suffix('')
    for f in range(n):
        if inpjs:
            pg.evaluate(f"(() => {{ for (let q = 0; q < {k}; q++) {{ __sks.tick({inpjs}); __sks.frame(1/120); }} }})()")
        else:
            pg.evaluate(f"__bot({k})")
        pg.evaluate("__sks.draw()")
        path = f"{tmp}_{f:02d}.png"
        pg.screenshot(path=path, clip={'x': 320, 'y': 0, 'width': 640, 'height': 720})
        frames.append(path)
    b.close()
cols = min(6, n)
w, h = 320, 360
rows = (n + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, h * rows))
for i, fp in enumerate(frames):
    im = Image.open(fp).convert('RGB').resize((w, h))
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out)
print(out, 'errors', errs[:5])
