// REEL DELVE 自動プレイ検証（node tools/bot.js [回数]）
// 方針の違いで結果が変わるかを確かめる。描画は使わず rules.js だけで回す。
'use strict';
const R = require('../js/rules.js');
const RUNS = parseInt(process.argv[2] || '200', 10);
const PERMS = [['K', 'T', 'M'], ['K', 'M', 'T'], ['T', 'K', 'M'], ['T', 'M', 'K'], ['M', 'K', 'T'], ['M', 'T', 'K']];
const STREAK = { coin: 1, kill: 1, open: 1, disarm: 1, crystal: 1, potion: 1 };

// 列ごとの深さ優先探索で、全停止位置（9^5）を評価する
function search(run, orders, score) {
  let best = null;
  const pos = [0, 0, 0, 0, 0];
  function rec(c, ord, sk, sn, acc) {
    if (c === R.REELS) {
      const v = score(acc);
      if (!best || v > best.v) best = { v, pos: pos.slice(), order: acc.start, acc: Object.assign({}, acc) };
      return;
    }
    for (let p = 0; p < R.L; p++) {
      pos[c] = p;
      const o = ord.slice(), k = sk.slice(), n = sn.slice();
      const a = Object.assign({}, acc);
      for (let lane = 0; lane < 3; lane++) {
        const h = 'KTM'.indexOf(o[lane]);
        const tile = run.reels[c][(p + lane) % R.L];
        const kind = R.stepKind(o[lane], tile);
        if (STREAK[kind]) {
          if (k[h] === kind) n[h]++; else { k[h] = kind; n[h] = 1; }
          if (kind === 'coin') { a.gold += n[h]; a.coins++; }
          else if (kind === 'kill') a.gold += (2 + run.up.sword) * n[h];
          else if (kind === 'open') a.gold += (4 + 2 * run.up.key) * n[h];
          else if (kind === 'disarm') a.gold += n[h];
          else if (kind === 'crystal') a.mana += (1 + run.up.staff) * n[h];
          else if (kind === 'potion') { if (a.hp < run.maxHp) { a.hp++; a.heal++; } }
          if (n[h] > a.max) a.max = n[h];
        } else if (kind !== 'stairs') {
          k[h] = null; n[h] = 0;
          if (kind === 'hurt') { a.hp--; a.dmg++; }
        }
      }
      const before = o.slice(), moved = {};
      for (let ln = 0; ln < 3; ln++) {
        const tl = run.reels[c][(p + ln) % R.L];
        if (tl !== 'u' && tl !== 'd') continue;
        const who = before[ln], to = tl === 'u' ? ln - 1 : ln + 1;
        if (to < 0 || to > 2) continue;
        const partner = o[to];
        if (moved[who] || moved[partner] || o.indexOf(who) !== ln) continue;
        o[to] = who; o[ln] = partner; moved[who] = moved[partner] = true;
      }
      if (a.hp <= 0) { a.dead = true; const v = score(a); if (!best || v > best.v) best = { v, pos: pos.slice().map((x, i) => i > c ? 0 : x), order: a.start, acc: a }; continue; }
      rec(c + 1, o, k, n, a);
    }
  }
  for (const ord of orders) {
    const cost = R.swapCost(run.order, ord);
    if (cost > run.mana) continue;
    rec(0, ord, [null, null, null], [0, 0, 0], { gold: 0, mana: 0, dmg: 0, heal: 0, max: 0, coins: 0, hp: run.hp, cost, start: ord, dead: false });
  }
  return best;
}

function baseScore(run, a, opts) {
  if (a.dead) return -1000;
  const manaRoom = Math.max(0, run.maxMana - (run.mana - a.cost));
  let v = a.gold + Math.min(a.mana, manaRoom) * 1.5 - a.dmg * 8 + a.heal * 4 - a.cost * 1.5;
  const need = R.gateNeed(run.floor);
  if (need && opts.aimGate) v += a.max >= need ? 100 : a.max * 3;
  if (opts.saveCoins && !need) {
    const g = R.nextGate(run.floor);
    if (g && g.floor - run.floor <= 2) v -= a.coins * 2.2;
  }
  return v;
}

// 金貨の線を作れる見込み（各リールに金貨が残っているか）
function coinReels(run) { return run.reels.map(r => r.indexOf('c') >= 0); }

function camp(run, offers, opts) {
  const tryBuy = (id, reel, idx) => R.buy(run, id, reel, idx);
  if (run.hp <= run.maxHp - 2 || run.hp <= 2) while (run.hp < run.maxHp && run.gold >= R.priceOf(run,'rest') && run.hp <= 3) if (!tryBuy('rest')) break;
  if (opts.plan) {
    const g = R.nextGate(run.floor);
    if (g && g.floor - run.floor <= 1 && offers.indexOf('plant_c') >= 0) {
      const cr = coinReels(run);
      for (let c = 0; c < 5; c++) if (!cr[c]) {
        const idx = run.reels[c].indexOf('.');
        if (idx >= 0) tryBuy('plant_c', c, idx);
      }
    }
  }
  if (opts.buyUps) for (const id of offers) if (id.indexOf('up_') === 0 && id !== 'up_brake') tryBuy(id);
  if (opts.plan && opts.buyUps) {
    // 余った金で、危険なマスを宝箱や水晶で上書きする
    for (const id of offers) {
      if (id !== 'plant_x' && id !== 'plant_y') continue;
      if (run.gold < R.priceOf(run, id) + 6) continue;
      let worst = -1, wc = -1, wi = -1;
      for (let c = 0; c < 5; c++) {
        const hz = run.reels[c].filter(t => t === 'm' || t === 't').length;
        if (hz > worst) { const i = run.reels[c].findIndex(t => t === 't'); const j = i >= 0 ? i : run.reels[c].indexOf('m'); if (j >= 0) { worst = hz; wc = c; wi = j; } }
      }
      if (wc >= 0) tryBuy(id, wc, wi);
    }
  }
}

function play(seed, pol) {
  const run = R.newRun(seed);
  const log = { gateTries: {}, safe: [] };
  let guard = 0;
  while (!run.dead && !run.won && guard++ < 60) {
    let pos, order;
    if (pol.random) {
      pos = [0, 0, 0, 0, 0].map(() => Math.floor(R.rnd(run) * R.L));
      order = run.order.slice();
    } else {
      const orders = pol.swaps ? PERMS : [run.order.slice()];
      const b = search(run, orders, a => baseScore(run, a, pol));
      pos = b.pos; order = b.order;
      const cost0 = R.swapCost(run.order, order);
      // 目押しの失敗：確率 err で1コマ流れる。魔力が残っていれば直す。
      let manaLeft = run.mana - cost0;
      for (let c = 0; c < 5; c++) if (R.rnd(run) < (pol.err || 0)) {
        if (manaLeft > 0 && pol.fix) manaLeft--; else pos[c] = R.mod(pos[c] - 1);
      }
      run.mana = manaLeft;
    }
    if (R.gateNeed(run.floor)) log.gateTries[run.floor] = (log.gateTries[run.floor] || 0) + 1;
    const res = R.resolve(run, pos, order);
    const out = R.applyWalk(run, pos, res);
    if (run.dead || run.won) break;
    R.regrow(run, out.gateFail);
    const offers = R.genOffers(run);
    camp(run, offers, pol);
  }
  return { run, log };
}

const POLICIES = {
  'でたらめ停止': { random: true },
  '目先だけ・正確': { aimGate: true, buyUps: true },
  '目先だけ・門も狙わない': { buyUps: true },
  '計画的・正確': { aimGate: true, saveCoins: true, swaps: true, plan: true, buyUps: true },
  '計画的・目押し2割ミス(魔力で修正)': { aimGate: true, saveCoins: true, swaps: true, plan: true, buyUps: true, err: 0.2, fix: true },
  '目先だけ・目押し2割ミス(修正なし)': { aimGate: true, buyUps: true, err: 0.2 },
  '計画的・強化を買わない': { aimGate: true, saveCoins: true, swaps: true, plan: true }
};

console.log('各方針 ' + RUNS + ' 回');
for (const name of Object.keys(POLICIES)) {
  const pol = POLICIES[name];
  let win = 0, gold = 0, dmg = 0, fails = 0, floorSum = 0, best = 0, jp = 0, spins = 0;
  const golds = [];
  const n = RUNS; const gt = {4:0,8:0,12:0};
  for (let i = 0; i < n; i++) {
    const { run, log } = play(1000 + i * 7919, pol); for (const f in log.gateTries) gt[f] += log.gateTries[f] - (run.dead && run.floor == f ? 0 : 1);
    if (run.won) { win++; gold += run.gold; golds.push(run.gold + totalSpent(run)); }
    dmg += run.stats.dmg; fails += run.stats.gateFails; floorSum += run.floor; best += run.stats.best; jp += run.stats.jackpots; spins += run.stats.spins;
  }
  golds.sort((a, b) => a - b);
  console.log(
    name.padEnd(22, '　') + ' 踏破 ' + (100 * win / n).toFixed(0).padStart(3) + '%' +
    '  到達階 ' + (floorSum / n).toFixed(1) +
    '  被害 ' + (dmg / n).toFixed(1) +
    '  門失敗 ' + (fails / n).toFixed(2) +
    '  踏破時の所持金 ' + (win ? (gold / win).toFixed(0) : '-') +
    '  総獲得(中央) ' + (golds.length ? golds[golds.length >> 1] : '-') +
    '  回転数 ' + (spins / n).toFixed(1) + '  門別失敗 ' + [4,8,12].map(f => (gt[f]/n).toFixed(2)).join('/')
  );
}
function totalSpent(run) { return run.stats.earned - run.gold; }
