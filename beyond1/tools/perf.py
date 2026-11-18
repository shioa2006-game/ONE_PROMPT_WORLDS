"""賽駆け 天下 — ブラウザでの処理時間の計測（Playwright, Edge headless）
   python tools/perf.py [seasons]
   序盤と、CPUだけで指定の季数を進めた後とで、地図の生成・1フレームの描画（全国図／拡大）・CPU 1季分の思考時間を測る。
   演出の待ち時間は含まない（思考と描画だけ）。"""
import sys
import os
import json
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'file:///' + os.path.join(os.path.dirname(HERE), 'index.html').replace(os.sep, '/')
SEASONS = int(sys.argv[1]) if len(sys.argv) > 1 else 80
JS = r'''(seasons) => {
  const SG = window.SG, E = SG.E, AI = SG.AI, R = SG.R;
  const t0 = performance.now(); SG.MAP.build(1.25); const build = performance.now() - t0;
  const s = E.newGame(null, 4242, { maxTurn: 9999 }); s.autoEnd = true;
  const mk = () => ({ owner: s.owner.slice(), gar: s.gar.slice(), kok: s.kok.slice(), kp: s.kp.slice(), fort: s.fort.slice(), fp: s.fp.slice(), armies: s.armies.map(a => Object.assign({}, a)), turn: s.turn, clans: s.clans, player: null });
  const drawMs = (z) => {
    R.flyTo(R.W * 0.55, R.H * 0.55, z, 0);
    const V = mk(), U = { fx: [], spread: {}, me: null };
    R.draw(V, U, 0);
    const ts = [];
    for (let i = 0; i < 40; i++) { const a = performance.now(); R.draw(V, U, i / 60); ts.push(performance.now() - a); }
    ts.sort((a, b) => a - b);
    return { med: +ts[20].toFixed(2), max: +ts[39].toFixed(2) };
  };
  const season = () => {
    const a = performance.now();
    const t = s.turn;
    let g = 0;
    while (s.turn === t && !s.over && g++ < 500) { E.beginClanTurn(s); AI.playTurn(s); E.advance(s); }
    return performance.now() - a;
  };
  const out = { build: +build.toFixed(0), early: { overview: drawMs(1), zoomed: drawMs(2.2) } };
  const early = []; for (let i = 0; i < 4; i++) early.push(season());
  out.early.season = early.map(x => +x.toFixed(0));
  while (s.turn < seasons && !s.over) season();
  const late = []; for (let i = 0; i < 4; i++) late.push(season());
  out.late = { turn: s.turn, alive: Object.values(s.clans).filter(c => c.alive).length, armies: s.armies.length, overview: drawMs(1), zoomed: drawMs(2.2), season: late.map(x => +x.toFixed(0)) };
  return out;
}'''
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge')
    pg = b.new_page(viewport={'width': 1600, 'height': 900})
    pg.goto(URL)
    pg.wait_for_function("window.SGT && document.getElementById('loading').classList.contains('hidden')", timeout=60000)
    r = pg.evaluate(JS, SEASONS)
    print(json.dumps(r, ensure_ascii=False, indent=1))
    b.close()
