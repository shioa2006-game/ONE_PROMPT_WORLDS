/*
 * ひゅるり、凧びより ― 共通の小道具（乱数・数学）
 * ブラウザでも node でも読みこめるように、globalThis.TJ にまとめる。
 */
(function (root) {
  'use strict';
  const TJ = root.TJ = root.TJ || {};

  // 決まった種から同じ並びを返す乱数（世界の配置をいつも同じにするため）
  TJ.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    const f = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (lo, hi) => lo + (hi - lo) * f();
    f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.chance = (p) => f() < p;
    return f;
  };

  TJ.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  TJ.lerp = (a, b, t) => a + (b - a) * t;
  TJ.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  TJ.smooth = (t) => t * t * (3 - 2 * t);
  TJ.easeOut = (t) => 1 - (1 - t) * (1 - t);
  TJ.easeOutBack = (t) => { const c = 1.70158; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
  TJ.angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

  // 大きさ（cm）を読みやすい文字に
  TJ.fmtSize = function (cm) {
    if (cm < 100) return (cm < 10 ? cm.toFixed(1) : Math.floor(cm)) + 'cm';
    const m = cm / 100;
    return (m < 10 ? m.toFixed(2) : m < 100 ? m.toFixed(1) : Math.floor(m)) + 'm';
  };
  TJ.fmtTime = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + '分' + (s < 10 ? '0' : '') + s + '秒';
  };
})(typeof window !== 'undefined' ? window : globalThis);
