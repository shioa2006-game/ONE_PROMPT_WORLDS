// GUILDWARD — ギルドでの進み具合（ランク・報酬・仲間・鍛冶屋）。描画に依存しない
(function (root) {
  'use strict';
  const D = root.D21;

  function newProfile() {
    return {
      v: 1, rank: 1, merit: 0, coins: 0,
      roster: ['gard', 'sena'], done: {}, items: [], up: {}, trophies: [],
      seenReq: {}, chapterDone: false, time: 0,
      stats: { fights: 0, combos: 0, turns: 0, kills: {}, acts: {}, runs: 0, retries: 0, hints: 0, undo: 0 },
      moments: [], lastParty: ['gard', 'sena'], talked: {}, partyLog: {},
    };
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

  // 出撃のときに地図へ持っていくもの
  function carry(p, party) {
    return { party: ['riko'].concat(party), up: Object.assign({}, p.up), hpb: rankIndex(p.merit) };
  }

  // 依頼から帰ってきた。st は地図の最後の状態
  function complete(p, reqId, st) {
    const r = D.req(reqId);
    const first = !p.done[reqId];
    const out = { req: r, first, coins: 0, merit: 0, found: st.coins || 0, items: [], trophy: null, rankUp: null, joined: [], newReqs: [], shopNew: [], sackBonus: 0, chapter: false };
    const before = board(p).filter(x => x.state === 'open').map(x => x.r.id);
    const shopBefore = D.SHOP.filter(s => s.when(p)).map(s => s.id);
    const rank0 = rankIndex(p.merit);
    out.coins = first ? r.reward.coins : Math.round(r.reward.coins / 4);
    if (r.reward.perSack && st.raid) out.sackBonus = r.reward.perSack * st.raid.sacks;
    if (first) out.merit = r.reward.merit;
    p.coins += out.coins + out.found + out.sackBonus;
    p.merit += out.merit;
    if (first && r.reward.item) { p.items.push(r.reward.item); p.up[r.reward.item] = true; out.items.push(r.reward.item); }
    for (const it of st.items || []) if (!p.items.includes(it)) { p.items.push(it); out.items.push(it); }
    if (first && r.trophy && !p.trophies.includes(r.trophy)) { p.trophies.push(r.trophy); out.trophy = r.trophy; }
    const rec = p.done[reqId] || { times: 0 };
    rec.times++;
    rec.party = st.party.slice(1);
    rec.turns = st.stats.turns + st.stats.fights;
    p.done[reqId] = rec;
    // 編成ごとの達成記録（別の仲間でも攻略してみたい、の手がかり）
    const key = st.party.slice(1).sort().join('+');
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
    if (rank1 > rank0) out.rankUp = { from: D.RANKS[rank0], to: D.RANKS[rank1] };
    out.newReqs = board(p).filter(x => x.state === 'open' && !before.includes(x.r.id)).map(x => x.r.id);
    out.shopNew = D.SHOP.filter(s => s.when(p) && !shopBefore.includes(s.id)).map(s => s.id);
    if (first && r.final) { p.chapterDone = true; out.chapter = true; }
    return out;
  }

  function shop(p) { return D.SHOP.filter(s => s.when(p)).map(s => ({ s, owned: !!p.up[s.id], afford: p.coins >= s.cost, member: s.who === 'riko' || p.roster.includes(s.who) })); }
  function buy(p, id) {
    const s = D.SHOP.find(q => q.id === id);
    if (!s || !s.when(p)) return { ok: false, why: 'まだ店にない' };
    if (p.up[id]) return { ok: false, why: 'もう持っている' };
    if (p.coins < s.cost) return { ok: false, why: '銀貨が足りない（あと ' + (s.cost - p.coins) + '）' };
    p.coins -= s.cost; p.up[id] = true;
    return { ok: true, item: s };
  }

  // 依頼板の「おすすめ」：同行できる仲間の力で、どの装置・手だてが使えるか
  function verbsOf(party) {
    const v = new Set(['shoot', 'rope']);
    for (const id of party) for (const x of root.S21.HERO[id].verbs) v.add(x);
    return v;
  }

  root.C21 = { newProfile, rankIndex, rankInfo, nextRank, reqState, board, freshCount, carry, complete, shop, buy, verbsOf };
})(typeof window !== 'undefined' ? window : globalThis);
