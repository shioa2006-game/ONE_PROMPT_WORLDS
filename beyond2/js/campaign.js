// GUILDWARD — ギルドでの進み具合（ランク・報酬・仲間・鍛冶屋・腕だめしの印・お守り・保存の移行）。描画に依存しない
(function (root) {
  'use strict';
  const D = root.D21;
  const SAVE_V = 2;

  function newProfile() {
    return fillProfile({
      v: SAVE_V, rank: 1, merit: 0, coins: 0,
      roster: ['gard', 'sena'], done: {}, items: [], up: {}, trophies: [],
      seenReq: {}, chapterDone: false, time: 0,
      stats: { fights: 0, combos: 0, turns: 0, kills: {}, acts: {}, runs: 0, retries: 0, hints: 0, undo: 0 },
      moments: [], lastParty: ['gard', 'sena'], talked: {}, partyLog: {},
    });
  }
  // v0.2 で足した記録（印・お守り・持たせ方・持ち帰った宝箱・初回の二人・腕だめし帳の受けとり・称号）
  function fillProfile(p) {
    const def = { stamps: {}, charms: [], equip: {}, chests: {}, firstParty: {}, ledger: {}, titles: [], partyLog: {}, talked: {}, moments: [], seenReq: {} };
    for (const k in def) if (p[k] === undefined || p[k] === null) p[k] = def[k];
    p.v = SAVE_V;
    p.rank = rankInfo(p).star;
    return p;
  }

  // 地図の宝箱の番号（sim.js の create と同じふり方）。依頼の目的の品（角笛・石板）は報酬ではないので数えない
  function chestIdsOf(def) {
    let seq = 1; const out = [];
    for (const o of def.objs || []) {
      const id = o.id || ('o' + (seq++));
      if (o.k === 'chest' && !(def.objective && o.item && def.objective.item === o.item)) out.push(id);
    }
    return out;
  }

  // ---------- 保存の移行（v0.1 → v0.2。09 5章） ----------
  // 依頼の途中の保存（play）は、地図の状態の形が変わるので捨てる（ギルドからの再開になる）
  function migrate(sv) {
    if (!sv || !sv.prof) return null;
    if (sv.v === SAVE_V) { fillProfile(sv.prof); return sv; }
    if (sv.v !== 1) return null;
    const p = sv.prof;
    fillProfile(p);
    for (const id in p.done) {
      const r = D.req(id); if (!r) continue;
      p.chests[id] = chestIdsOf(D.map(r.map));         // 達成ずみの依頼は、宝箱を全部持ち帰ったものとして埋める
      const log = p.partyLog[id] || [];
      p.firstParty[id] = log[0] || ((p.done[id].party || []).slice().sort().join('+'));
    }
    return { v: SAVE_V, prof: p, play: null, firstFight: sv.firstFight, migratedPlay: !!sv.play, migratedFrom: 1 };
  }

  function rankIndex(merit) {
    let r = 0;
    D.RANKS.forEach((k, i) => { if (merit >= k.merit) r = i; });
    return r;
  }
  function rankInfo(p) { return D.RANKS[rankIndex(p.merit)]; }
  function nextRank(p) { return D.RANKS[rankIndex(p.merit) + 1] || null; }

  function reqState(p, r) {
    if (p.done[r.id]) return 'done';
    return r.unlock(p) ? 'open' : 'locked';
  }
  function board(p) {
    return D.REQUESTS.map(r => ({ r, state: reqState(p, r), fresh: reqState(p, r) === 'open' && !p.seenReq[r.id] })).filter(x => x.state !== 'locked');
  }
  function freshCount(p) { return board(p).filter(x => x.fresh).length; }

  // ---------- 編成 ----------
  const pairKey = (party) => party.slice().sort().join('+');
  // 同行が決まっているのは、初回だけ（03 6.1）
  function fixedParty(p, r) { return !!r.fixed && !p.done[r.id]; }
  // この依頼で選べる仲間（m3 の受けなおしではトビを選べない）
  function pickable(p, r) { return p.roster.filter(id => !(r.noPick || []).includes(id)); }
  // いまの仲間で組める二人の組み合わせ全部
  function pairs(p, r) {
    const ids = pickable(p, r), out = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) out.push([ids[i], ids[j]]);
    return out;
  }

  // 出撃のときに地図へ持っていくもの
  function carry(p, party, reqId) {
    const charms = {};
    for (const id of ['riko'].concat(party)) { const c = p.equip && p.equip[id]; if (c && (p.charms || []).includes(c)) charms[id] = c; }
    return { party: ['riko'].concat(party), up: Object.assign({}, p.up), hpb: rankIndex(p.merit), charms, taken: reqId && p.chests ? (p.chests[reqId] || []).slice() : [] };
  }

  // ---------- 腕だめしの印 ----------
  function stampCount(p) { return Object.keys(p.stamps || {}).length; }
  function stampInfo(p, reqId, st) {
    const first = !p.done[reqId];
    return { first, pair: pairKey(st.party.slice(1)), firstPair: (p.firstParty || {})[reqId] || null };
  }
  // 地図の上で、いま満たしている（まだ持っていない）印。'end' のものは、依頼を達成してから
  function stampLive(p, reqId, st) {
    const list = D.STAMPS[reqId] || [];
    const info = stampInfo(p, reqId, st);
    const out = [];
    for (const s of list) {
      if (p.stamps[s.id]) continue;
      if (s.live === 'end' && !st.flags.cleared) continue;
      try { if (s.test(st, info)) out.push(s); } catch (e) { /* 判定できない */ }
    }
    return out;
  }
  // 「別の二人」が、いまの仲間では組めないか（m3 は v0.2 の仲間では、初回と同じ二人しか組めない）
  function pairImpossible(p, r) {
    const fp = (p.firstParty || {})[r.id];
    if (!p.done[r.id] || !fp) return false;
    return !pairs(p, r).some(c => pairKey(c) !== fp);
  }

  // ---------- ドーラの腕だめし帳 ----------
  function ledgerOpen(p) { return !!p.done.m3; }
  function ledger(p) {
    const n = stampCount(p);
    return D.LEDGER.map(t => ({ t, got: !!p.ledger[t.n], ready: n >= t.n && !p.ledger[t.n], left: Math.max(0, t.n - n) }));
  }
  function ledgerReady(p) { return ledger(p).filter(x => x.ready).length; }
  function claim(p, n) {
    const row = ledger(p).find(x => x.t.n === n);
    if (!row || !row.ready) return { ok: false };
    const t = row.t, got = [];
    if (t.charm && !p.charms.includes(t.charm)) { p.charms.push(t.charm); got.push({ k: 'charm', id: t.charm }); }
    if (t.coins) { p.coins += t.coins; got.push({ k: 'coins', n: t.coins }); }
    if (t.trophy && !p.trophies.includes(t.trophy)) { p.trophies.push(t.trophy); got.push({ k: 'trophy', id: t.trophy }); }
    if (t.title && !p.titles.includes(t.title)) { p.titles.push(t.title); got.push({ k: 'title', text: t.title }); }
    p.ledger[n] = true;
    return { ok: true, got };
  }
  function nextLedger(p) { return ledger(p).find(x => !x.got && !x.ready) || null; }

  // ---------- お守り ----------
  // hero に cid を持たせる（同じ物は二つとないので、ほかの人が持っていれば移す）。cid が null なら外す
  function equipCharm(p, hero, cid) {
    if (!cid) { delete p.equip[hero]; return; }
    if (!p.charms.includes(cid)) return;
    for (const h in p.equip) if (p.equip[h] === cid) delete p.equip[h];
    p.equip[hero] = cid;
  }
  function holder(p, cid) { for (const h in p.equip) if (p.equip[h] === cid) return h; return null; }

  // 依頼から帰ってきた。st は地図の最後の状態
  function complete(p, reqId, st) {
    const r = D.req(reqId);
    const first = !p.done[reqId];
    const out = { req: r, first, coins: 0, merit: 0, found: st.coins || 0, items: [], trophy: null, rankUp: null, joined: [], newReqs: [], shopNew: [], sackBonus: 0, chapter: false, stamps: [], ledgerNew: [], stampTotal: 0 };
    const before = board(p).filter(x => x.state === 'open').map(x => x.r.id);
    const shopBefore = D.SHOP.filter(s => s.when(p)).map(s => s.id);
    const rank0 = rankIndex(p.merit);
    // 腕だめしの印（帰ったときに判定する。初回の二人は、ここで決まる前の値で比べる）
    const info = stampInfo(p, reqId, st);
    const n0 = stampCount(p);
    for (const s of D.STAMPS[reqId] || []) {
      if (p.stamps[s.id]) continue;
      let okS = false; try { okS = !!s.test(st, info); } catch (e) { okS = false; }
      if (okS) { p.stamps[s.id] = true; out.stamps.push(s); }
    }
    out.stampTotal = stampCount(p);
    out.ledgerNew = D.LEDGER.filter(t => n0 < t.n && out.stampTotal >= t.n && !p.ledger[t.n]).map(t => t.n);
    out.coins = first ? r.reward.coins : Math.round(r.reward.coins / 4);
    if (r.reward.perSack && st.raid) out.sackBonus = r.reward.perSack * st.raid.sacks;
    if (first) out.merit = r.reward.merit;
    p.coins += out.coins + out.found + out.sackBonus;
    p.merit += out.merit;
    if (first && r.reward.item) { p.items.push(r.reward.item); p.up[r.reward.item] = true; out.items.push(r.reward.item); }
    for (const it of st.items || []) if (!p.items.includes(it)) { p.items.push(it); out.items.push(it); }
    if (first && r.trophy && !p.trophies.includes(r.trophy)) { p.trophies.push(r.trophy); out.trophy = r.trophy; }
    // 持ち帰った宝箱は、受けなおしでは空（一つにつき一度きり）
    const goalChests = chestIdsOf(D.map(r.map));
    p.chests[reqId] = p.chests[reqId] || [];
    for (const cid of st.found || []) if (goalChests.includes(cid) && !p.chests[reqId].includes(cid)) p.chests[reqId].push(cid);
    const rec = p.done[reqId] || { times: 0 };
    rec.times++;
    rec.party = st.party.slice(1);
    rec.turns = st.stats.turns + st.stats.fights;
    p.done[reqId] = rec;
    // 編成ごとの達成記録（別の仲間でも攻略してみたい、の手がかり）
    const key = pairKey(st.party.slice(1));
    if (first) p.firstParty[reqId] = key;
    p.partyLog[reqId] = p.partyLog[reqId] || [];
    if (!p.partyLog[reqId].includes(key)) p.partyLog[reqId].push(key);
    // 成績をまとめる
    const S = p.stats;
    S.fights += st.stats.fights; S.combos += st.stats.combos; S.turns += st.stats.turns; S.runs++;
    S.retries += st.stats.retries || 0; S.hints += st.stats.hints || 0; S.undo += st.stats.undo || 0;
    for (const k in st.stats.kills) S.kills[k] = (S.kills[k] || 0) + st.stats.kills[k];
    for (const k in st.stats.acts) S.acts[k] = (S.acts[k] || 0) + st.stats.acts[k];
    for (const m of st.moments || []) p.moments.push(Object.assign({ req: reqId }, m));
    p.moments.sort((a, b) => b.score - a.score);
    if (p.moments.length > 16) p.moments.length = 16;
    // 仲間の加入
    if (reqId === 'm3' && !p.roster.includes('tobi')) { p.roster.push('tobi'); out.joined.push('tobi'); }
    const rank1 = rankIndex(p.merit);
    p.rank = D.RANKS[rank1].star;
    if (rank1 > rank0) out.rankUp = { from: D.RANKS[rank0], to: D.RANKS[rank1] };
    out.newReqs = board(p).filter(x => x.state === 'open' && !before.includes(x.r.id)).map(x => x.r.id);
    out.shopNew = D.SHOP.filter(s => s.when(p) && !shopBefore.includes(s.id)).map(s => s.id);
    if (first && r.final) { p.chapterDone = true; out.chapter = true; }
    return out;
  }

  // ---------- 鍛冶屋（道具とお守り） ----------
  function owns(p, s) { return s.kind === 'charm' ? (p.charms || []).includes(s.id) : !!p.up[s.id]; }
  function shop(p) {
    return D.SHOP.filter(s => s.when(p)).map(s => ({
      s, owned: owns(p, s), afford: p.coins >= s.cost,
      member: s.kind === 'charm' || s.who === 'riko' || p.roster.includes(s.who),
      needFirst: s.needs && !p.up[s.needs] ? s.needs : null,   // 二段目は、一段目を持っていないと「先に○○を」
    }));
  }
  function buy(p, id) {
    const s = D.SHOP.find(q => q.id === id);
    if (!s || !s.when(p)) return { ok: false, why: 'まだ店にない' };
    if (owns(p, s)) return { ok: false, why: 'もう持っている' };
    if (s.needs && !p.up[s.needs]) { const pre = D.SHOP.find(q => q.id === s.needs); return { ok: false, why: '先に' + (pre ? pre.name : s.needs) + 'を' }; }
    if (p.coins < s.cost) return { ok: false, why: '銀貨が足りない（あと ' + (s.cost - p.coins) + '）' };
    p.coins -= s.cost;
    if (s.kind === 'charm') p.charms.push(id); else p.up[id] = true;
    return { ok: true, item: s };
  }

  // 依頼板の「おすすめ」：同行できる仲間の力で、どの装置・手だてが使えるか
  function verbsOf(party) {
    const v = new Set(['shoot', 'rope']);
    for (const id of party) for (const x of root.S21.HERO[id].verbs) v.add(x);
    return v;
  }

  root.C21 = {
    SAVE_V, newProfile, fillProfile, migrate, chestIdsOf, rankIndex, rankInfo, nextRank, reqState, board, freshCount,
    pairKey, fixedParty, pickable, pairs, carry, complete, shop, buy, verbsOf,
    stampCount, stampLive, stampInfo, pairImpossible, ledgerOpen, ledger, ledgerReady, claim, nextLedger, equipCharm, holder,
  };
})(typeof window !== 'undefined' ? window : globalThis);
