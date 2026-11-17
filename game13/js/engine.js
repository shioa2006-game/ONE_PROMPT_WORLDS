// からり、国盗り ― ルールの核
// 状態 G は素の JSON。乱数も G.rng に持つので、保存して続きから同じ展開になる
(function (root) {
  'use strict';
  var D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.KD;

  var R = {
    TURNS: 20,        // 1560年秋〜1565年夏
    CASTLE: 2,        // 城1段あたりの守り
    MAXLV: 6,         // 経済・城の上限
    MAXDICE: 6,
    HARVEST: 2,       // 秋の収入倍率
    PAIR: 3,          // ゾロ目で攻めたときの勢い
    PEACE: 1,         // 最初の1季は出陣できない
    TROOP: 2, MERC: 0, // 兵1あたりの金（MERC は上限超えの雇い値。試したが膠着するので 0＝なし）
    BUILD: 1, FORT: 3,   // 開発の金＝上がった後の経済×BUILD、築城の金＝上がった後の城×FORT
    FLIP: 4,          // サイコロを裏返す金（1季のうちに重ねるほど ×2, ×3…）
    BUY: 10, BUYMAX: 3, // 賽の買い足し：金10、20、30（1季に3個まで）         // 開発・築城の金＝上がった後の値×これ
    SIEGE: 1,         // 攻められるたびに城が傷む段数（守り切っても）
    UPKEEP: 0,
    CAPBASE: 6, CAPECO: 1,   // 兵の上限＝6＋経済（徴兵の上限。移動や進軍では超えられる）
    DSTEP: 2,         // 何国ごとにサイコロが1つ増えるか
    WINLOSS: 3, RAZE: 1      // 勝った側の損害＝守兵÷これ / 奪った国の経済と城が下がる段数
  };

  // ---- 乱数（mulberry32）----
  function rnd(G) {
    var t = (G.rng = (G.rng + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function d6(G) { return 1 + Math.floor(rnd(G) * 6); }

  function cap(P) { return R.CAPBASE + R.CAPECO * P.eco; }
  function diceCount(n) { return Math.min(R.MAXDICE, 3 + Math.floor((n - 1) / R.DSTEP)); }

  function create(opts) {
    opts = opts || {};
    var G = {
      v: 1,
      rng: (opts.seed == null ? Math.floor(Math.random() * 0x7fffffff) : opts.seed) | 0,
      seed: 0,
      turn: 0,
      player: opts.player == null ? -1 : opts.player,
      prov: [], clan: [],
      order: [], oi: 0, cur: -1,
      dice: [], rerolled: false,
      over: null,
      history: [], chron: [],
      stat: { win: 0, lose: 0, held: 0, lost: 0, taken: 0 }
    };
    G.seed = G.rng;
    for (var i = 0; i < D.PROV.length; i++) {
      var p = D.PROV[i];
      G.prov.push({ owner: i, eco: p.eco, cas: p.def, troops: 3 + 2 * p.mil, guard: 0, truce: false });
      var t = D.TEMPER[i];
      // 気性は毎回すこし揺らぐ。これで同じ大名でも違う戦国になる
      var jit = opts.noJitter ? 0 : (rnd(G) - 0.5) * 0.5;
      G.clan.push({ alive: true, gold: p.eco, aggr: Math.max(0.05, Math.min(0.98, t.aggr + jit)), civ: t.civ, fell: -1, by: -1 });
    }
    record(G);
    return G;
  }

  function provsOf(G, c) {
    var a = [];
    for (var i = 0; i < G.prov.length; i++) if (G.prov[i].owner === c) a.push(i);
    return a;
  }
  function countOf(G, c) {
    var n = 0;
    for (var i = 0; i < G.prov.length; i++) if (G.prov[i].owner === c) n++;
    return n;
  }
  function incomeParts(G, c) {
    var s = 0, tr = 0;
    for (var i = 0; i < G.prov.length; i++) if (G.prov[i].owner === c) { s += G.prov[i].eco; tr += G.prov[i].troops; }
    var gross = (G.turn % 4 === 0) ? s * R.HARVEST : s;
    var up = R.UPKEEP ? Math.floor(tr / R.UPKEEP) : 0;
    return { gross: gross, upkeep: up, net: Math.max(0, gross - up), harvest: G.turn % 4 === 0 };
  }
  function income(G, c) { return incomeParts(G, c).net; }
  function snap(G, list) {
    var o = {};
    list.forEach(function (i) { var P = G.prov[i]; o[i] = { owner: P.owner, eco: P.eco, cas: P.cas, troops: P.troops, guard: P.guard, truce: !!P.truce }; });
    return o;
  }
  function record(G) {
    var row = [];
    for (var c = 0; c < G.clan.length; c++) row.push(countOf(G, c));
    G.history.push(row);
  }

  // ---- 季節の進行 ----
  function startSeason(G) {
    var others = [];
    for (var c = 0; c < G.clan.length; c++) if (c !== G.player && G.clan[c].alive) others.push(c);
    for (var i = others.length - 1; i > 0; i--) {
      var j = Math.floor(rnd(G) * (i + 1)); var t = others[i]; others[i] = others[j]; others[j] = t;
    }
    G.order = (G.player >= 0 && G.clan[G.player].alive) ? [G.player].concat(others) : others;
    G.oi = 0;
  }
  function endSeason(G) {
    record(G);
    G.turn++;
    checkOver(G);
  }
  function checkOver(G) {
    if (G.over) return G.over;
    var first = G.prov[0].owner, all = true;
    for (var i = 1; i < G.prov.length; i++) if (G.prov[i].owner !== first) { all = false; break; }
    if (all) G.over = { type: 'unify', winner: first };
    else if (G.turn >= R.TURNS) G.over = { type: 'time', winner: ranking(G)[0].clan };
    return G.over;
  }

  function beginTurn(G, c) {
    G.cur = c;
    var ps = provsOf(G, c), ev = [];
    ps.forEach(function (i) { G.prov[i].guard = 0; G.prov[i].truce = false; });
    var inc = income(G, c);
    G.clan[c].gold += inc;
    ev.push({ type: 'income', clan: c, n: inc, harvest: G.turn % 4 === 0, patch: snap(G, ps) });
    var n = diceCount(ps.length);
    G.dice = [];
    for (var k = 0; k < n; k++) G.dice.push({ v: d6(G), used: false });
    G.rerolled = false; G.flips = 0; G.bought = 0;
    ev.push({ type: 'roll', clan: c, dice: G.dice.map(function (d) { return d.v; }) });
    return ev;
  }
  function reroll(G) {
    if (G.rerolled) return null;
    var any = false;
    G.dice.forEach(function (d) { if (!d.used) { d.v = d6(G); d.f = false; any = true; } });
    if (!any) return null;
    G.rerolled = true;
    return { type: 'reroll', clan: G.cur, dice: G.dice.map(function (d) { return d.v; }) };
  }
  // 裏返し：金を払ってサイコロをひっくり返す（表と裏が入れ替わる）
  function flipCost(G) { return R.FLIP * ((G.flips || 0) + 1); }
  function canFlip(G, di) {
    var d = G.dice[di];
    return !!d && !d.used && !d.f && G.cur >= 0 && G.clan[G.cur].gold >= flipCost(G);
  }
  function flip(G, di) {
    if (!canFlip(G, di)) return null;
    G.clan[G.cur].gold -= flipCost(G); G.flips = (G.flips || 0) + 1; G.dice[di].v = 7 - G.dice[di].v; G.dice[di].f = true;
    return { type: 'flip', clan: G.cur, di: di, v: G.dice[di].v };
  }
  // 賽の買い足し：金を払って、この季だけサイコロを1つ増やす（1季に BUYMAX 個まで）
  function buyCost(G) { return R.BUY * ((G.bought || 0) + 1); }
  function canBuy(G) { return G.cur >= 0 && (G.bought || 0) < R.BUYMAX && G.clan[G.cur].gold >= buyCost(G); }
  function buyDie(G) {
    if (!canBuy(G)) return null;
    G.clan[G.cur].gold -= buyCost(G); G.bought = (G.bought || 0) + 1;
    var v = d6(G); G.dice.push({ v: v, used: false });
    return { type: 'buy', clan: G.cur, v: v };
  }
  function endTurn(G) {
    var c = G.cur, left = 0;
    G.dice.forEach(function (d) { if (!d.used) { left++; d.used = true; } });
    if (left) G.clan[c].gold += left;
    G.cur = -1;
    return { type: 'leftover', clan: c, n: left };
  }

  // ---- 采配 ----
  function die(G, di) {
    var d = G.dice[di];
    return (d && !d.used) ? d : null;
  }
  function mine(G, p) { return G.prov[p] && G.prov[p].owner === G.cur; }

  function buildCost(lv) { return (lv + 1) * R.BUILD; }
  function fortCost(lv) { return (lv + 1) * R.FORT; }
  // 開発：裏の目が今の経済以上なら 経済+1
  function canDevelop(G, di, p) {
    var d = die(G, di); if (!d || !mine(G, p)) return false;
    var P = G.prov[p];
    return P.eco < R.MAXLV && (7 - d.v) >= P.eco && G.clan[G.cur].gold >= buildCost(P.eco);
  }
  function develop(G, di, p) {
    if (!canDevelop(G, di, p)) return null;
    G.dice[di].used = true; G.clan[G.cur].gold -= buildCost(G.prov[p].eco); G.prov[p].eco++;
    return { type: 'develop', clan: G.cur, p: p, to: G.prov[p].eco, patch: snap(G, [p]) };
  }
  // 築城：裏の目が今の城以上なら 城+1
  function canFortify(G, di, p) {
    var d = die(G, di); if (!d || !mine(G, p)) return false;
    var P = G.prov[p];
    return P.cas < R.MAXLV && (7 - d.v) >= P.cas && G.clan[G.cur].gold >= fortCost(P.cas);
  }
  function fortify(G, di, p) {
    if (!canFortify(G, di, p)) return null;
    G.dice[di].used = true; G.clan[G.cur].gold -= fortCost(G.prov[p].cas); G.prov[p].cas++;
    return { type: 'fortify', clan: G.cur, p: p, to: G.prov[p].cas, patch: snap(G, [p]) };
  }
  // 徴兵：裏の目の数まで、金1で兵1
  // 徴兵：裏の目の数まで、兵1につき金 TROOP。国の兵は上限（6＋経済）まで
  function recruitPlan(G, di, p) {
    var d = die(G, di); if (!d || !mine(G, p)) return { n: 0, cost: 0 };
    var P = G.prov[p], gold = G.clan[G.cur].gold, n = 0, cost = 0, c = cap(P);
    while (n < 7 - d.v) {
      var pr = (P.troops + n < c) ? R.TROOP : R.MERC;
      if (!pr || cost + pr > gold) break;
      cost += pr; n++;
    }
    return { n: n, cost: cost };
  }
  function recruitN(G, di, p) { return recruitPlan(G, di, p).n; }
  function recruit(G, di, p) {
    var pl = recruitPlan(G, di, p); if (pl.n <= 0) return null;
    G.dice[di].used = true; G.prov[p].troops += pl.n; G.clan[G.cur].gold -= pl.cost;
    return { type: 'recruit', clan: G.cur, p: p, n: pl.n, cost: pl.cost, patch: snap(G, [p]) };
  }
  // 備え：次の自分の番まで、守りに表の目を足す
  function canGuard(G, di, p) {
    var d = die(G, di); if (!d || !mine(G, p)) return false;
    return d.v > G.prov[p].guard;
  }
  function guard(G, di, p) {
    if (!canGuard(G, di, p)) return null;
    G.dice[di].used = true; G.prov[p].guard = G.dice[di].v;
    return { type: 'guard', clan: G.cur, p: p, n: G.dice[di].v, patch: snap(G, [p]) };
  }
  function adjacent(a, b) { return D.ADJ[a].indexOf(b) >= 0; }
  // 移動：隣の自国へ兵を移す（どの目でもよい）
  function moveMax(G, from, to) {
    if (!mine(G, from) || !mine(G, to) || !adjacent(from, to)) return 0;
    return Math.max(0, G.prov[from].troops - 1);
  }
  function move(G, di, from, to, n) {
    if (!die(G, di)) return null;
    var m = moveMax(G, from, to);
    n = Math.min(n, m); if (n <= 0) return null;
    G.dice[di].used = true; G.prov[from].troops -= n; G.prov[to].troops += n;
    return { type: 'move', clan: G.cur, from: from, to: to, n: n, patch: snap(G, [from, to]) };
  }

  // 攻めの強さ＝兵＋表の目の合計。守りの強さ＝兵＋城×2＋備え＋守り手のサイコロ
  function defBase(P) { return P.troops + P.cas * R.CASTLE + P.guard; }
  function winProb(G, to, n, V) {
    var k = n + V - defBase(G.prov[to]) - 1;
    return Math.max(0, Math.min(6, k)) / 6;
  }
  function canAttack(G, from, to) {
    return mine(G, from) && !mine(G, to) && adjacent(from, to) && G.prov[from].troops >= 2 && !G.prov[to].truce;
  }
  // 攻めにはサイコロを2つまで重ねられる。同じ目（ゾロ目）なら勢い +3
  function attackValue(vs) {
    var V = 0; vs.forEach(function (v) { V += v; });
    if (vs.length === 2 && vs[0] === vs[1]) V += R.PAIR;
    return V;
  }
  function attack(G, dis, from, to, n) {
    if (!canAttack(G, from, to) || dis.length < 1 || dis.length > 2 || G.turn < R.PEACE) return null;
    if (dis.length === 2 && dis[0] === dis[1]) return null;
    var vs = [], i;
    for (i = 0; i < dis.length; i++) { if (!die(G, dis[i])) return null; vs.push(G.dice[dis[i]].v); }
    var V = attackValue(vs);
    var A = G.prov[from], T = G.prov[to];
    n = Math.max(1, Math.min(n, A.troops - 1));
    dis.forEach(function (k) { G.dice[k].used = true; });
    var att = G.cur, def = T.owner;
    var roll = d6(G), defT = T.troops;
    var atk = n + V, dfs = defBase(T) + roll;
    var ev = { type: 'battle', clan: att, def: def, from: from, to: to, sent: n, dice: vs, V: V, atk: atk,
      defTroops: defT, cas: T.cas, guard: T.guard, roll: roll, dfs: dfs, win: atk > dfs,
      attLoss: 0, defLoss: 0, retreatTo: -1, retreatN: 0, loot: 0, fell: false };
    var touched = [from, to];
    if (ev.win) {
      ev.attLoss = Math.min(n - 1, Math.ceil(defT / R.WINLOSS));
      var r = Math.floor(defT / 2), best = -1, room = 0;
      D.ADJ[to].forEach(function (q) {
        if (G.prov[q].owner === def) { var rm = Math.max(1, cap(G.prov[q]) - G.prov[q].troops); if (rm > room) { room = rm; best = q; } }
      });
      if (best >= 0 && r > 0) { ev.retreatTo = best; ev.retreatN = r; G.prov[best].troops += ev.retreatN; touched.push(best); }
      ev.defLoss = defT - ev.retreatN;
      A.troops -= n;
      T.owner = att; T.troops = n - ev.attLoss; T.guard = 0; T.truce = true; // 平定：奪った国は、次の自分の番まで攻められない
      T.cas = Math.max(1, T.cas - R.RAZE); T.eco = Math.max(1, T.eco - R.RAZE);
      ev.loot = 2 + T.eco;
      G.clan[att].gold += ev.loot;
      if (countOf(G, def) === 0) {
        ev.fell = true;
        ev.loot += G.clan[def].gold; G.clan[att].gold += G.clan[def].gold; G.clan[def].gold = 0;
        G.clan[def].alive = false; G.clan[def].fell = G.turn; G.clan[def].by = att;
      }
      G.chron.push({ t: G.turn, k: ev.fell ? 'fall' : 'take', a: att, d: def, p: to });
      if (att === G.player) { G.stat.win++; G.stat.taken++; }
      if (def === G.player) G.stat.lost++;
    } else {
      ev.attLoss = Math.ceil(n / 2);
      ev.defLoss = Math.max(0, Math.min(defT - 1, Math.ceil(n / 4)));
      A.troops -= ev.attLoss; T.troops -= ev.defLoss;
      T.cas = Math.max(1, T.cas - R.SIEGE);
      if (att === G.player) G.stat.lose++;
      if (def === G.player) G.stat.held++;
    }
    ev.patch = snap(G, touched);
    checkUnify(G);
    return ev;
  }
  function checkUnify(G) {
    var first = G.prov[0].owner;
    for (var i = 1; i < G.prov.length; i++) if (G.prov[i].owner !== first) return;
    G.over = { type: 'unify', winner: first };
  }

  // ---- 順位 ----
  function power(G, c) {
    var n = 0, eco = 0, tr = 0, cas = 0;
    for (var i = 0; i < G.prov.length; i++) if (G.prov[i].owner === c) { n++; eco += G.prov[i].eco; tr += G.prov[i].troops; cas += G.prov[i].cas; }
    return { clan: c, n: n, eco: eco, troops: tr, cas: cas, gold: G.clan[c].gold, alive: G.clan[c].alive, fell: G.clan[c].fell, by: G.clan[c].by };
  }
  function ranking(G) {
    var a = [];
    for (var c = 0; c < G.clan.length; c++) a.push(power(G, c));
    a.sort(function (x, y) {
      if (x.alive !== y.alive) return x.alive ? -1 : 1;
      if (!x.alive) return y.fell - x.fell || x.clan - y.clan;
      return y.n - x.n || y.eco - x.eco || y.troops - x.troops || x.clan - y.clan;
    });
    return a;
  }
  function rankOf(G, c) {
    var r = ranking(G);
    for (var i = 0; i < r.length; i++) if (r[i].clan === c) return i + 1;
    return r.length;
  }
  function dateOf(turn) {
    var year = 1560 + Math.floor((turn + 2) / 4);
    return { year: year, season: D.SEASONS[turn % 4], eiroku: year - 1557 };
  }

  var E = { R: R, rnd: rnd, d6: d6, cap: cap, buildCost: buildCost, fortCost: fortCost, diceCount: diceCount, create: create, provsOf: provsOf, countOf: countOf,
    income: income, incomeParts: incomeParts, startSeason: startSeason, endSeason: endSeason, checkOver: checkOver, beginTurn: beginTurn,
    reroll: reroll, canFlip: canFlip, buyCost: buyCost, canBuy: canBuy, buyDie: buyDie, flipCost: flipCost, flip: flip, endTurn: endTurn, canDevelop: canDevelop, develop: develop, canFortify: canFortify,
    fortify: fortify, recruitN: recruitN, recruitPlan: recruitPlan, recruit: recruit, canGuard: canGuard, guard: guard, moveMax: moveMax,
    move: move, defBase: defBase, winProb: winProb, attackValue: attackValue, canAttack: canAttack, attack: attack, power: power,
    ranking: ranking, rankOf: rankOf, dateOf: dateOf, adjacent: adjacent, snap: snap };

  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  else root.KE = E;
})(typeof window !== 'undefined' ? window : globalThis);
