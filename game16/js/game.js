// 呪いほどき — 進行（地方の順番、お礼、市、解放）。描画に依存しない。
(function (root) {
  'use strict';
  const RR = root.RR || (typeof require !== 'undefined' ? require('./sim.js') : null);
  const D = root.RRD || (typeof require !== 'undefined' ? require('./data.js') : null);
  const G = {};

  G.newGame = function (seed) {
    const s = RR.newGame(seed);
    s.reels = D.START_REELS.map(str => ({ strip: RR.strip(str), pos: 0 }));
    s.shop = [];
    s.smith = false;
    s.fails = {};
    s.gifts = null;
    s.mpBought = 0; s.regenBought = 0;
    s.log = [];
    s.stats = { casts: 0, bestCast: 0, bestDmg: 0, retries: 0 };
    return s;
  };

  G.stageDef = s => D.STAGES[s.stage];

  G.startStage = function (s, opts) {
    const def = D.STAGES[s.stage];
    const extra = Math.min(2, s.fails[def.id] || 0);
    const d2 = Object.assign({}, def, { hearts: (def.hearts || 3) + extra });
    RR.startBattle(s, d2, opts);
    s.phase = 'battle';
    return s.b;
  };

  // 戦いが終わったあとの処理。勝ちならお礼と解放、負けなら差し入れ
  G.finishBattle = function (s) {
    const b = s.b, def = D.STAGES[s.stage];
    const out = { win: b.over === 'win', rescued: b.rescued, lost: b.lost, coins: 0, unlock: null, gift: null };
    s.stats.casts += b.casts;
    if (b.bestCast > s.stats.bestCast) s.stats.bestCast = b.bestCast;
    if (out.win) {
      out.coins = b.coins || 0;
      s.coins += out.coins;
      s.rescued += b.rescued;
      s.lost += b.lost;
      const prev = s.results[def.id];
      s.results[def.id] = { rescued: b.rescued, lost: b.lost, best: b.bestCast, total: b.rescued + b.lost };
      if (b.finale) s.results[def.id].finale = { rescued: b.finale.rescued, best: b.finale.best };
      if (prev) s.rescued -= prev.rescued; // 再戦では二重に数えない
      const un = D.UNLOCK[def.id];
      if (un && !s.unlock[def.id]) {
        s.unlock[def.id] = true;
        out.unlock = un;
        if (un.shop) s.shop = un.shop.slice();
        if (un.smith) s.smith = true;
        if (un.reel && s.reels.length < un.reel) s.reels.push({ strip: RR.strip(D.NEW_REEL[s.reels.length - 3] || '________'), pos: 0, isNew: true });
        if (un.mp) s.mpMax += un.mp;
      }
      const g = D.GIFTS[def.id];
      if (g) s.gifts = g.map(([t, lv]) => ({ t: t, lv: lv }));
      s.stage++;
      s.phase = s.stage >= D.STAGES.length ? 'ending' : 'workshop';
    } else {
      s.fails[def.id] = (s.fails[def.id] || 0) + 1;
      s.stats.retries++;
      out.coins = 3;
      s.coins += 3;
      s.phase = 'workshop';
      s.gifts = null;
    }
    s.b = null;
    return out;
  };

  G.pickGift = function (s, i) {
    if (!s.gifts || !s.gifts[i]) return false;
    s.inv.push(s.gifts[i]);
    s.gifts = null;
    return true;
  };
  G.price = (s, t) => D.PRICE[t];
  G.buy = function (s, t) {
    if (s.shop.indexOf(t) < 0) return false;
    const p = D.PRICE[t];
    if (s.coins < p) return false;
    s.coins -= p;
    s.inv.push({ t: t, lv: 1 });
    return true;
  };
  G.mpPrice = s => s.mpBought < D.MP_PRICE.length ? D.MP_PRICE[s.mpBought] : null;
  G.buyMp = function (s) {
    const p = G.mpPrice(s);
    if (p === null || s.coins < p || !s.shop.length) return false;
    s.coins -= p; s.mpBought++; s.mpMax++;
    return true;
  };
  G.regenPrice = s => (s.regenBought ? null : D.REGEN_PRICE);
  G.buyRegen = function (s) {
    const p = G.regenPrice(s);
    if (p === null || s.coins < p || !s.smith) return false;
    s.coins -= p; s.regenBought++; s.mpRegen++;
    return true;
  };
  G.upgradeCell = function (s, reel, idx) {
    if (!s.smith) return false;
    const c = s.reels[reel].strip[idx];
    if (!c || c.t === 'blank') return false;
    const cost = RR.upgradeCost(c.lv);
    if (cost === null || s.coins < cost) return false;
    s.coins -= cost; c.lv++; c.fresh = true;
    return true;
  };
  G.upgradeInv = function (s, i) {
    if (!s.smith) return false;
    const c = s.inv[i];
    if (!c) return false;
    const cost = RR.upgradeCost(c.lv);
    if (cost === null || s.coins < cost) return false;
    s.coins -= cost; c.lv++;
    return true;
  };

  // ---------- 自動で組む（ボットと通し確認用） ----------
  // ランダムな回転を何度もためし、つながりがどれだけ大きく出るかを測る
  G.boardMetric = function (s, samples) {
    let sum = 0;
    for (const pos of samples) {
      const reels = s.reels.map((rl, c) => ({ strip: rl.strip, pos: pos[c] % rl.strip.length }));
      const cls = RR.clusters(RR.gridOf(reels));
      for (const cl of cls) {
        const w = cl.el === 'bolt' ? 1.3 : cl.el === 'ice' ? 0.9 : 1;
        sum += cl.dmg * cl.cells.length * w;
      }
    }
    return sum / samples.length;
  };
  G.samples = function (s, n, seed) {
    let x = (seed | 0) || 12345;
    const rnd = () => { x = (Math.imul(x, 1103515245) + 12345) & 0x7fffffff; return x; };
    const out = [];
    for (let i = 0; i < n; i++) out.push(s.reels.map(() => rnd() % 64));
    return out;
  };
  // 持ち物のどれを、どこへ置くと一番よいか（空いた床だけを見る）
  G.suggestPlace = function (s, seed) {
    if (!s.inv.length) return null;
    const samples = G.samples(s, 120, seed);
    let best = null;
    for (let ii = 0; ii < s.inv.length; ii++) {
      for (let r = 0; r < s.reels.length; r++) for (let k = 0; k < s.reels[r].strip.length; k++) {
        const old = s.reels[r].strip[k];
        if (old.t !== 'blank') continue;
        s.reels[r].strip[k] = { t: s.inv[ii].t, lv: s.inv[ii].lv };
        const m = G.boardMetric(s, samples);
        s.reels[r].strip[k] = old;
        if (!best || m > best.m) best = { m: m, ii: ii, r: r, k: k };
      }
    }
    return best;
  };
  // 次に何を買う・鍛えるか（単純な好み順）
  G.suggestBuy = function (s, rnd) {
    rnd = rnd || Math.random;
    const blanks = s.reels.reduce((a, rl) => a + rl.strip.filter(c => c.t === 'blank').length, 0);
    const mp = G.mpPrice(s);
    if (mp !== null && s.mpMax < 5 && s.coins >= mp && s.shop.length) return { kind: 'mp' };
    if (s.smith && G.regenPrice(s) !== null && s.coins >= G.regenPrice(s)) return { kind: 'regen' };
    if (s.smith) {
      let up = null;
      s.reels.forEach((rl, r) => rl.strip.forEach((c, k) => {
        if (c.t === 'blank' || c.lv >= 3) return;
        const cost = RR.upgradeCost(c.lv);
        const pri = (c.t === 'light' ? 3 : c.t === 'bolt' ? 2.5 : c.t === 'star' ? 2 : 1) - c.lv;
        if (s.coins >= cost && (!up || pri > up.pri)) up = { r: r, k: k, pri: pri };
      }));
      if (up && (blanks <= s.inv.length || rnd() < 0.4)) return { kind: 'up', r: up.r, k: up.k };
    }
    if (blanks <= s.inv.length) return null;
    const can = s.shop.filter(t => s.coins >= D.PRICE[t]);
    if (!can.length) return null;
    const pref = ['light', 'bolt', 'star', 'gem', 'ice'];
    const t = pref.find(x => can.indexOf(x) >= 0 && rnd() < 0.7) || can[0];
    return { kind: 'buy', t: t };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.RG = G;
})(this);
