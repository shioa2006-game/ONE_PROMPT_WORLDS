// 実ブラウザでの通しプレイ用ドライバ（開発用）。
// ページ上で読みこむと window.__auto(opts) が使える。画面のボタン座標を実際に押して進める。
// opts: { nudge: true/false, maxFrames, stopAt: 'shop'|'ending'|null }
(function () {
  const LR = window.LR, D = window.__lr;
  function cellXY(c, i) { const n = D.S.reels.length, x0 = 280 - (n * 92 - 34) / 2; return [x0 + c * 92 + 29, 110 + i * 62 + 29]; }
  function offerXY(k, count) { const ox = 898 - (count * 172 - 12) / 2; return [ox + k * 172 + 80, 200]; }
  function bestNudge() {
    const S = D.S, n = S.reels.length;
    const val = (offs) => {
      const res = LR.compute(LR.windowOf(S, offs), S.src), hit = LR.hitLanes(S, res.exits, false);
      let v = hit.guided.length * 10;
      for (const sh of S.ships) { const urgent = sh.dist - LR.SHIP[sh.type].speed <= 0.01; if (urgent && hit.guided.indexOf(sh) < 0) v -= 30; }
      for (const l of hit.lanes) for (const h of l.hits) v += h.take * 0.4;
      return v;
    };
    let best = { v: val(new Array(n).fill(0)) + 3, c: -1 };
    for (let c = 0; c < n; c++) for (const o of [-2, -1, 1, 2]) {
      if (Math.abs(o) > S.tokens) continue;
      const offs = new Array(n).fill(0); offs[c] = o;
      const v = val(offs) - Math.abs(o) * 3;
      if (v > best.v) best = { v: v, c: c, o: o };
    }
    return best;
  }
  window.__auto = function (opts) {
    opts = opts || {};
    const log = [], max = opts.maxFrames || 60000;
    let lastScene = '', shopStep = 0, frames = 0, fails = 0;
    D.hold = true;
    for (; frames < max; frames++) {
      D.step(1, 1 / 30);
      const V = D.V, S = D.S;
      if (V.scene !== lastScene) { log.push(V.scene + '@' + frames + (S ? ' n' + S.night + ' c' + S.coins : '')); lastScene = V.scene; shopStep = 0; if (opts.stopAt && V.scene === opts.stopAt) break; }
      if (opts.until && V.scene === 'play' && !V.overlay && opts.until(V, S)) break;
      if (opts.untilAny && opts.untilAny(V, S)) break;
      if (V.scene === 'ending') break;
      if (V.scene === 'title') { D.click(850, 433); continue; }
      if (V.overlay) { if (V.overlay.kind === 'fail' && V.time - V.overlay.t0 > 1.1) fails++; if (frames % 10 === 0) D.primary(); continue; }
      if (V.scene === 'play') {
        if (V.phase === 'ready') D.primary();
        else if (V.phase === 'aim' && !V.reels.some(r => r.tw)) {
          if (opts.nudge !== false) { const b = bestNudge(); if (b.c >= 0) { for (let i = 0; i < Math.abs(b.o); i++) D.nudge(b.c, Math.sign(b.o)); D.step(6, 1 / 30); } }
          D.primary();
        }
        continue;
      }
      if (V.scene === 'shop') {
        if (frames % 4) continue;
        const sh = V.shop, offers = sh.mode === 'cargo' ? sh.offers : S.offers;
        if (sh.held && sh.held.kind === 'offer') {
          // 空いているコマ（なければ先頭）へ置く
          let tgt = null;
          const order = S.reels.map((_, c) => c).sort((a, b) => S.reels[a].strip.filter(x => x.t !== 'blank').length - S.reels[b].strip.filter(x => x.t !== 'blank').length);
          for (const c of order) { const i = S.reels[c].strip.findIndex(x => x.t === 'blank'); if (i >= 0) { tgt = [c, i]; break; } }
          if (!tgt) tgt = [0, 0];
          const xy = cellXY(tgt[0], tgt[1]); D.click(xy[0], xy[1]); D.step(1, 1 / 30); if (D.V.shop && D.V.shop.confirm) D.click(xy[0], xy[1]);
          continue;
        }
        const k = offers.findIndex(o => !o.sold && (sh.mode === 'cargo' || LR.PRICE[o.t] <= S.coins));
        if (k >= 0 && shopStep < 12) { shopStep++; const xy = offerXY(k, offers.length); D.click(xy[0], xy[1]); continue; }
        if (sh.mode !== 'cargo' && S.coins >= LR.wickPrice(S) && S.src < LR.MAX_SRC) { const ox = 898 - (4 * 172 - 12) / 2; D.click(ox + 80, 354); continue; }
        if (sh.mode !== 'cargo' && S.coins >= 8 && shopStep < 12) { const ox = 898 - (4 * 172 - 12) / 2; D.click(ox + 80, 420); shopStep++; continue; }
        D.click(1093, 646);
      }
    }
    const S = D.S;
    return { frames: frames, fails: fails, log: log, night: S.night, guided: S.guided, wrecks: S.wrecks, stars: S.stars, best: S.bestShot, retries: S.retries, scene: D.V.scene };
  };
})();
