# 画面撮影：ヘッドレスの Edge でゲームを開き、検証用のつまみ（window.__sks）で状態を作って撮る
#   python tools/shots.py <出力フォルダ> [撮るもの,...]
# 撮るもの：title intro start0 start2 aim0 play0 rise guardian1 ... （下の SCENES を参照）
import sys, pathlib, json
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
url = (root / 'index.html').as_uri()

# ボット（tools/bot.js と同じ考え方）をページの中で動かす：落ちてくる玉の着地点を読み、ねらい線が いちばん得になる位置へ
BOT = r"""
window.__bot = function (n, opt) {
  opt = opt || {};
  const h = __sks, S = h.S;
  for (let k = 0; k < n; k++) {
    const w = h.G.w; if (!w || h.G.scene !== 'play') return 'scene:' + h.G.scene;
    const b = w.balls[0], f = w.frog;
    let inp = { tx: f.x, btn: false };
    const score = (tr) => {
      if (!tr) return -1; if (tr.exit) return opt.exit ? 9999 : -50; if (tr.i === undefined) return 0;
      let s = 1; const t = tr.type;
      if (t === S.T.LID) s += 60; if (t === S.T.ANCHOR) s += 40; if (t === S.T.TREAS) s += 25; if (t === S.T.BLAST) s += 30;
      const dmg = w.dmg(b); const br = t === S.T.LID ? w.lidHp <= dmg : w.hp[tr.i] <= dmg;
      if (br && t !== S.T.LID) { const fs = w.fallingIf(tr.i); s += fs.length * 6; }
      return s;
    };
    if (b.state === 'held') {
      const m = w.mouth(); let best = -1e9, ba = -Math.PI / 2;
      for (let d = -165; d <= -15; d += 3) { const a = d * Math.PI / 180; const s = score(w.trace(m.x, m.y, Math.cos(a), Math.sin(a), 1500, false)); if (s > best) { best = s; ba = a; } }
      inp = { tx: f.x, btn: false, ax: m.x + Math.cos(ba) * 200, ay: m.y + Math.sin(ba) * 200, spit: b.holdT > 0.1 && !opt.noSpit };
    } else if (b.state === 'free' && b.vy > 0) {
      const sp = Math.hypot(b.vx, b.vy); const tr = w.trace(b.x, b.y, b.vx / sp, b.vy / sp, 1600, true);
      if (tr.land !== undefined) {
        let best = -1e9, bu = 0;
        for (let u = -0.95; u <= 0.951; u += 0.05) { const a = u * 62 * Math.PI / 180; const s = score(w.trace(tr.land, S.PAD_Y - S.BALL_R, Math.sin(a), -Math.cos(a), 1500, false)) - Math.abs(u) * 0.5; if (s > best) { best = s; bu = u; } }
        inp.tx = tr.land - bu * S.FROG_HALF;
      } else inp.tx = b.x;
    } else if (b.state === 'free') inp.tx = b.x;
    h.tick(inp);
    h.frame(1 / 120);
    if (opt.until && opt.until(w)) return 'until';
  }
  return 'n';
};
"""

SCENES = {
  'title': "",
  'intro': "__sks.G.scene='intro'; __sks.G.introStep=1; __sks.G.introT=2;",
  'start0': "__sks.goto(0, 5); __sks.step(30);",
  'aim0': "__sks.goto(0, 5); __sks.inp.mx = 320+320; __sks.inp.my = 200; __sks.step(30);",
  'collapse0': "__sks.goto(0, 5); __sks.hold(); __sks.inp.mx=640; __sks.inp.my=200; __sks.tick({tx:320,ax:320,ay:200,spit:false}); for(let k=0;k<20;k++){__sks.tick({tx:320,ax:320,ay:200});} __sks.tick({tx:320,ax:320,ay:200,spit:true}); for(let k=0;k<70;k++){__sks.tick({tx:320}); __sks.frame(1/120);} ",
  'play0': "__sks.goto(0, 5); __sks.hold(); __bot(1400);",
  'start1': "__sks.goto(1, 5); __sks.step(30);",
  'play1': "__sks.goto(1, 5); __sks.hold(); __bot(2200);",
  'start2': "__sks.goto(2, 5); __sks.step(30);",
  'play2': "__sks.goto(2, 5); __sks.hold(); __bot(3000);",
  'start3': "__sks.goto(3, 5); __sks.step(30);",
  'start4': "__sks.goto(4, 5); __sks.step(30);",
  'start5': "__sks.goto(5, 5); __sks.step(30);",
  'play5': "__sks.goto(5, 5); __sks.hold(); __bot(2400);",
  'start6': "__sks.goto(6, 5); __sks.step(30);",
  'start7': "__sks.goto(7, 5); __sks.step(30);",
  'start8': "__sks.goto(8, 5); __sks.step(30);",
  'play8': "__sks.goto(8, 5); __sks.hold(); __bot(2600);",
  'start9': "__sks.goto(9, 5); __sks.step(30);",
  'start10': "__sks.goto(10, 5); __sks.step(30);",
  'start11': "__sks.goto(11, 5); __sks.step(30);",
  'play11': "__sks.goto(11, 5); __sks.hold(); __bot(2600);",
  'start12': "__sks.goto(12, 5); __sks.step(30);",
  'start13': "__sks.goto(13, 5); __sks.step(30);",
  'start14': "__sks.goto(14, 5); __sks.step(30);",
  'play14': "__sks.goto(14, 5); __sks.hold(); __bot(2600);",
  'rise': "__sks.goto(0, 5); __sks.hold(); __bot(20000, {exit:true, until: (w)=>w.done}); for(let k=0;k<90;k++) __sks.frame(1/60);",
  'lidopen': "__sks.goto(0, 5); __sks.hold(); const w=__sks.G.w; for(let r=1;r<=3;r++) for(let c=8;c<=11;c++) w.destroyCell(r*20+c,'t'); w.collapse(); w.openLid('t'); for(let k=0;k<30;k++){__sks.tick({tx:320}); __sks.frame(1/60);} for(let k=0;k<200;k++) __sks.frame(1/60);",
  'toast': "__sks.goto(1, 5); __sks.hold(); __sks.G.w.releaseItem(1, 200, 300); __sks.tick({tx:320}); for(let k=0;k<40;k++) __sks.frame(1/60);",
  'stun': "__sks.goto(2, 5); __sks.hold(); __sks.G.w.balls[0].state='free'; __sks.G.w.balls[0].vy=-300; __sks.G.w.stunFrog(1,'t'); __sks.tick({tx:320}); for(let k=0;k<20;k++){ __sks.tick({tx:320}); __sks.frame(1/60);} ",
  'pause': "__sks.goto(3, 5); __sks.step(10); window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'})); __sks.step(1);",
  'select': "__sks.save.reached = 8; __sks.save.found.push(0,2,4,5); __sks.G.scene='select'; __sks.step(2);",
  'ending': "__sks.G.scene='ending'; __sks.G.endT=6.5; __sks.step(1);",
  'ending2': "__sks.save.found.push(0,1,2,3,5,8,12,18,19); __sks.G.scene='ending'; __sks.G.endT=16; __sks.step(1);",
}

def main():
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else root / 'tools' / 'results' / 'shots')
    out.mkdir(parents=True, exist_ok=True)
    want = sys.argv[2].split(',') if len(sys.argv) > 2 else None
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge')
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        errs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        pg.goto(url)
        pg.evaluate("localStorage.clear()")
        for name, js in SCENES.items():
            if want and name not in want:
                continue
            pg.goto(url)
            pg.wait_for_timeout(250)
            pg.evaluate(BOT)
            try:
                r = pg.evaluate("(() => { " + js + " ; return __sks.G.scene; })()")
            except Exception as e:
                errs.append(name + ': ' + str(e)); r = 'ERR'
            pg.wait_for_timeout(60)
            pg.screenshot(path=str(out / (name + '.png')))
            print(name, r)
        print('errors:', len(errs))
        for e in errs[:20]:
            print('  ', e)
        b.close()


if __name__ == '__main__':
    main()
