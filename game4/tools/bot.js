// バランス確認用ボット： node tools/bot.js [回数] [hard]
// 方針の違う遊び方（工夫する／何もしない）を比べ、夜ごとの失敗率や光量を出す。
const LR = require('../js/sim.js');
const N = +process.argv[2] || 200;
const HARD = process.argv[3] === 'hard';

const CAP = [8, 12, 18, 30, 50, 50];

function metric(s, cap) {
  // 全ての停止位置を列挙して、海路ごとの光（上限つき）の期待値を出す
  const lens = s.reels.map(r => r.strip.length);
  let tot = 0, cnt = 0;
  const saved = s.reels.map(r => r.pos);
  const rec = (c) => {
    if (c === s.reels.length) {
      const e = LR.compute(LR.windowOf(s), s.src).exits;
      tot += Math.min(e[0], cap) + Math.min(e[1], cap) + Math.min(e[2], cap) + 0.03 * (e[0] + e[1] + e[2]);
      cnt++; return;
    }
    for (let p = 0; p < lens[c]; p++) { s.reels[c].pos = p; rec(c + 1); }
  };
  rec(0);
  s.reels.forEach((r, i) => r.pos = saved[i]);
  return tot / cnt;
}

function bestPlacement(s, t, cap, base) {
  let best = null;
  s.reels.forEach((r, c) => r.strip.forEach((cell, i) => {
    const kind = LR.placeResult(cell, t);
    if (!kind) return;
    const old = JSON.stringify(cell);
    LR.place(s, c, i, t);
    const g = metric(s, cap) - base;
    r.strip[i] = JSON.parse(old);
    if (!best || g > best.g) best = { c, i, g };
  }));
  return best;
}

function smartShop(s) {
  const cap = CAP[s.night - 1];
  for (let guard = 0; guard < 20; guard++) {
    const base = metric(s, cap);
    let best = null;
    for (const o of s.offers) {
      if (o.sold || LR.PRICE[o.t] > s.coins) continue;
      const b = bestPlacement(s, o.t, cap, base);
      if (b && b.g > 0.01 && (!best || b.g / LR.PRICE[o.t] > best.v)) best = { v: b.g / LR.PRICE[o.t], o, b };
    }
    if (s.src < LR.MAX_SRC && LR.wickPrice(s) <= s.coins) {
      s.src++; const g = metric(s, cap) - base; s.src--;
      if (!best || g / LR.wickPrice(s) > best.v) best = { v: g / LR.wickPrice(s), wick: true };
    }
    if (!best) {
      if (s.coins >= LR.REROLL_PRICE + 3 && guard < 6) { s.coins -= LR.REROLL_PRICE; LR.rollOffers(s); continue; }
      break;
    }
    if (best.wick) { s.coins -= LR.wickPrice(s); s.src++; s.wickLv++; }
    else { s.coins -= LR.PRICE[best.o.t]; LR.place(s, best.b.c, best.b.i, best.o.t); best.o.sold = true; }
  }
}
function midShop(s) {
  // ふつうの方針：並んだ順に買い、適当に選んだ3か所のうち一番よさそうな所へ置く。余ったら品ぞろえを替えてもう少し買う。
  const cap = CAP[s.night - 1];
  for (let round = 0; round < 4; round++) {
    for (const o of s.offers) {
      if (o.sold || LR.PRICE[o.t] > s.coins) continue;
      const base = metric(s, cap); let best = null;
      for (let k = 0; k < 3; k++) {
        const c = LR.randInt(s, s.reels.length), i = LR.randInt(s, s.reels[c].strip.length);
        const cell = s.reels[c].strip[i];
        if (!LR.placeResult(cell, o.t)) continue;
        const old = JSON.stringify(cell); LR.place(s, c, i, o.t);
        const g = metric(s, cap) - base; s.reels[c].strip[i] = JSON.parse(old);
        if (!best || g > best.g) best = { c, i, g };
      }
      if (best && best.g > 0) { s.coins -= LR.PRICE[o.t]; LR.place(s, best.c, best.i, o.t); o.sold = true; }
    }
    if (s.src < LR.MAX_SRC && s.coins >= LR.wickPrice(s) + 4) { s.coins -= LR.wickPrice(s); s.src++; s.wickLv++; }
    if (s.coins < 6 + round) break;
    s.coins -= 1 + round; LR.rollOffers(s);
  }
}
function midNudge(s) {
  // 難破しそうな舟がいるときだけ、ゼンマイ1つぶんずらす
  if (!s.ships.some(sh => sh.dist - LR.SHIP[sh.type].speed <= 0.01) || s.tokens < 1) return null;
  const n = s.reels.length; let best = { v: valueOf(s, new Array(n).fill(0)), offs: null };
  for (let c = 0; c < n; c++) for (const o of [-1, 1]) {
    const offs = new Array(n).fill(0); offs[c] = o;
    const v = valueOf(s, offs) - 4; if (v > best.v) best = { v, offs };
  }
  return best.offs;
}
function allInShop(s) {
  // 置き場所は考えず、買えるだけ買って空きに置く（配置の工夫がどれだけ効くかを見るための比較用）
  for (let guard = 0; guard < 12; guard++) {
    let bought = false;
    for (const o of s.offers) {
      if (o.sold || LR.PRICE[o.t] > s.coins) continue;
      const blanks = [];
      s.reels.forEach((r, c) => r.strip.forEach((cell, i) => { if (cell.t === 'blank') blanks.push([c, i]); }));
      if (!blanks.length) return;
      const [c, i] = LR.pick(s, blanks);
      s.coins -= LR.PRICE[o.t]; LR.place(s, c, i, o.t); o.sold = true; bought = true;
    }
    if (s.coins >= 4) { s.coins -= 1; LR.rollOffers(s); } else if (!bought) break;
  }
}
function naiveShop(s) {
  for (const o of s.offers) {
    if (LR.PRICE[o.t] > s.coins) continue;
    const blanks = [];
    s.reels.forEach((r, c) => r.strip.forEach((cell, i) => { if (cell.t === 'blank') blanks.push([c, i]); }));
    if (!blanks.length) break;
    const [c, i] = LR.pick(s, blanks);
    s.coins -= LR.PRICE[o.t]; LR.place(s, c, i, o.t);
  }
}
function cargoPick(s, smart) {
  const save = s.offers;
  const offers = LR.rollOffers(s, 3).map(o => o.t);
  s.offers = save;
  if (!smart) {
    const blanks = [];
    s.reels.forEach((r, c) => r.strip.forEach((cell, i) => { if (cell.t === 'blank') blanks.push([c, i]); }));
    if (blanks.length) { const [c, i] = LR.pick(s, blanks); LR.place(s, c, i, offers[0]); }
    return;
  }
  const cap = CAP[s.night - 1], base = metric(s, cap);
  let best = null;
  for (const t of offers) { const b = bestPlacement(s, t, cap, base); if (b && (!best || b.g > best.b.g)) best = { t, b }; }
  if (best) LR.place(s, best.b.c, best.b.i, best.t);
}

function valueOf(s, offs) {
  const res = LR.compute(LR.windowOf(s, offs), s.src);
  const hit = LR.hitLanes(s, res.exits, false);
  let v = 0;
  const guided = new Set(hit.guided.map(x => x.id));
  for (const sh of s.ships) {
    const urgent = sh.dist - LR.SHIP[sh.type].speed <= 0.01;
    if (guided.has(sh.id)) v += 10 + (urgent ? 30 : 0);
    else if (urgent) v -= 30;
  }
  for (const l of hit.lanes) for (const h of l.hits) {
    const sh = s.ships.find(x => x.id === h.id);
    v += h.take * (sh.type === 'fog' ? 0 : 1.2 / Math.max(1, sh.dist));
  }
  v += res.grow.length * 2 + res.zoro.length * 3;
  return v;
}
function smartNudge(s) {
  const n = s.reels.length, cur = new Array(n).fill(0);
  let best = { v: valueOf(s, cur), offs: cur.slice(), cost: 0 };
  const rec = (c, cost) => {
    if (c === n) {
      if (!cost) return;
      const v = valueOf(s, cur) - cost * 4;
      if (v > best.v) best = { v, offs: cur.slice(), cost };
      return;
    }
    for (let o = -2; o <= 2; o++) {
      if (cost + Math.abs(o) > s.tokens) continue;
      cur[c] = o; rec(c + 1, cost + Math.abs(o));
    }
    cur[c] = 0;
  };
  rec(0, 0);
  return best.offs;
}

function play(seed, mode) {
  const smart = mode === 2;
  const shop = [naiveShop, midShop, smartShop, allInShop][mode];
  const nudge = [() => null, midNudge, smartNudge, smartNudge][mode];
  const s = LR.newGame(seed, HARD);
  const log = [];
  while (s.night <= LR.NIGHTS.length) {
    let attempts = 0, snap = JSON.stringify(s), stat;
    for (;;) {
      attempts++;
      LR.startNight(s);
      let light = 0, turns = 0, w0 = s.wrecks, failed = false;
      for (;;) {
        LR.spin(s);
        const ev = LR.fire(s, nudge(s));
        light += ev.total; turns++;
        for (let i = 0; i < ev.cargo; i++) cargoPick(s, smart);
        const adv = LR.advance(s);
        if (adv.failed) { failed = true; break; }
        if (adv.over) break;
        if (turns > 60) { failed = true; break; }
      }
      stat = { night: s.night, attempts, avg: light / turns, wrecks: s.wrecks - w0, turns };
      if (!failed) break;
      if (attempts >= 6) { stat.stuck = true; break; }
      // やり直し：夜の頭に戻り、差し入れをもらって工房へ
      const keepRs = s.rs;
      Object.assign(s, JSON.parse(snap)); s.rs = keepRs + attempts;
      s.coins += LR.RETRY_GIFT; s.retries++;
      LR.rollOffers(s); shop(s);
      snap = JSON.stringify(s);
    }
    stat.coinsBefore = s.coins;
    log.push(stat);
    if (stat.stuck) break;
    s.coins += LR.nightBonus(s);
    stat.coins = s.coins;
    if (s.night === LR.NIGHTS.length) break;
    LR.rollOffers(s); shop(s);
    s.night++;
  }
  return { log, s };
}

for (const mode of (process.argv[4] ? [+process.argv[4]] : [1, 0, 2])) {
  const smart = mode;
  const agg = LR.NIGHTS.map(() => ({ n: 0, first: 0, att: 0, avg: 0, wrecks: 0, coins: 0, turns: 0, stuck: 0 }));
  let stars = 0, best = 0, cleared = 0;
  for (let i = 0; i < N; i++) {
    const { log, s } = play(1000 + i * 7919, mode);
    log.forEach((st, k) => {
      const a = agg[k]; a.n++; if (st.attempts === 1) a.first++; a.att += st.attempts; a.avg += st.avg; a.wrecks += st.wrecks; a.coins += st.coins || 0; a.turns += st.turns; if (st.stuck) a.stuck++;
    });
    stars += s.stars; best += s.bestShot; if (s.linerDone) cleared++;
  }
  console.log(`\n== ${['何もしない方針（ずらさない・空きに適当に置く）', 'ふつうの方針（危ない時だけずらす・そこそこの配置）', '工夫する方針（ずらし＋配置を考える）', 'ずらしは上手いが配置は考えない方針'][mode]} ${HARD ? '[荒海]' : ''} x${N}`);
  agg.forEach((a, k) => {
    if (!a.n) return;
    console.log(`第${k + 1}夜: 到達${a.n} 一発成功${(100 * a.first / a.n).toFixed(0)}% 平均挑戦${(a.att / a.n).toFixed(2)} 詰み${a.stuck} 光/ターン${(a.avg / a.n).toFixed(1)} 難破${(a.wrecks / a.n).toFixed(2)} 夜明けの貨幣${(a.coins / a.n).toFixed(1)} ターン${(a.turns / a.n).toFixed(1)}`);
  });
  console.log(`クリア${cleared}/${N} 平均星明かり${(stars / N).toFixed(0)} 平均最大照射${(best / N).toFixed(0)}`);
}
