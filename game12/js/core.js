/*
 * ころころ、ひらけ列島 ― 共通の小道具（乱数・数学・お金の表示）
 * ブラウザでも node でも読みこめるように、globalThis.KR にまとめる。
 */
(function (root) {
  'use strict';
  const KR = root.KR = root.KR || {};

  // 状態を数値ひとつで持てる乱数（保存・再開しても同じ並びになる）
  KR.rngNext = function (s) {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return [s, ((t ^ (t >>> 14)) >>> 0) / 4294967296];
  };
  // 使い捨ての乱数（演出・地図の飾りなど、勝負に関係しないところ用）
  KR.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    const f = function () { const r = KR.rngNext(a); a = r[0]; return r[1]; };
    f.range = (lo, hi) => lo + (hi - lo) * f();
    f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    return f;
  };

  KR.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  KR.lerp = (a, b, t) => a + (b - a) * t;
  KR.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  KR.smooth = (t) => t * t * (3 - 2 * t);
  KR.easeOut = (t) => 1 - (1 - t) * (1 - t);
  KR.easeOutBack = (t) => { const c = 1.70158; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
  KR.easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // お金（単位：万円）を読みやすく。12345 → 「1億2345万円」
  KR.yen = function (man, sign) {
    const neg = man < 0; let v = Math.round(Math.abs(man));
    let s;
    if (v >= 10000) {
      const oku = Math.floor(v / 10000), rest = v % 10000;
      s = oku + '億' + (rest ? rest + '万' : '') + '円';
    } else s = v + '万円';
    if (neg) return '−' + s;
    return (sign && v > 0 ? '+' : '') + s;
  };
  // みじかい表記（HUD 用）。12345 → 「1.23億」
  KR.yenShort = function (man) {
    const neg = man < 0; const v = Math.abs(man);
    let s;
    if (v >= 10000) s = (v / 10000).toFixed(v >= 100000 ? 1 : 2).replace(/\.?0+$/, '') + '億';
    else s = Math.round(v) + '万';
    return (neg ? '−' : '') + s;
  };
})(typeof window !== 'undefined' ? window : globalThis);
