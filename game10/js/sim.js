/*
 * ぐるり、夜まつり ― ルールの核
 * 盤（7×7）、鎖と輪、妖の動き、ぬし。描画なしで node からも使える。
 *
 * 鎖：同じ玉を たて・よこ・ななめに 3つ以上 なぞる。提灯（L）は どの玉とも つながる。
 * 輪：なぞりはじめの玉に もどると 輪になる。輪の中の玉は ぜんぶ 輪の色として かぞえ、
 *     中の妖は「ともだち」になる。
 * 花火の鎖は、鎖に となりあう妖（ななめも）を おどかす（鎖の玉の数ぶん）。
 * 妖は 宙に うかんでいて 落ちない。玉は 妖の うしろを すりぬけて 落ちる。
 */
(function (root) {
  'use strict';
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.G10Data;
  const W = 7, H = 7, N = W * H;
  const TYPES = ['H', 'D', 'K'];

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const idx = (x, y) => y * W + x;
  const cx = i => i % W, cy = i => (i / W) | 0;
  const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
  const inner = (x, y) => x >= 1 && x <= W - 2 && y >= 1 && y <= H - 2;
  const adj8 = (a, b) => a !== b && Math.abs(cx(a) - cx(b)) <= 1 && Math.abs(cy(a) - cy(b)) <= 1;
  function neighbors8(i) {
    const x = cx(i), y = cy(i), out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (inside(x + dx, y + dy)) out.push(idx(x + dx, y + dy));
    }
    return out;
  }

  // ---------------------------------------------------------------- 主人公の能力
  function newPlayer() {
    return {
      hp: 12, coins: 0,
      items: { ringoame: 0, omen: 0, hanabidama: 0, kingyo: 0, wataame: 0, himo: 0 },
      friends: {} // sp → むすんだ数
    };
  }
  function has(P, sp) { return (P.friends[sp] || 0) > 0; }
  function stats(P) {
    const it = P.items;
    return {
      maxHp: 12 + 3 * it.ringoame + (has(P, 'kasa') ? 2 : 0) + (has(P, 'ryu') ? 4 : 0) + (has(P, 'danuki') ? 3 : 0),
      cord: 6 + it.himo + (has(P, 'kamaitachi') ? 1 : 0) + (has(P, 'tengu') ? 1 : 0),
      fire: it.hanabidama + (has(P, 'onibi') ? 1 : 0),
      bigfire: has(P, 'kooni'),
      koban: it.kingyo + (has(P, 'mame') ? 1 : 0),
      dango: it.wataame + (has(P, 'takenoko') ? 1 : 0) + (has(P, 'gama') ? 1 : 0),
      blocks: it.omen + (has(P, 'kappa') ? 1 : 0),
      luck3: has(P, 'zashiki'),
      junkcoin: has(P, 'azuki'),
      lantern: has(P, 'chochin'),
      ringheal: has(P, 'kitsune')
    };
  }

  // ---------------------------------------------------------------- 戦いの用意
  function newBattle(battleId, P, seed) {
    const cfg = D.BATTLES[battleId];
    const st = {
      id: battleId, cfg, cells: new Array(N).fill(null), rnd: mulberry(seed || 1), seed: seed || 1, nid: 1,
      P, S: stats(P), queue: cfg.queue.slice(), max: cfg.max, boss: null,
      turn: 0, weights: Object.assign({}, cfg.weights), outcome: null, blocks: 0,
      gained: { coins: 0, friends: [], defeated: 0, fled: 0, rings: 0, bestChain: 0 },
      startHp: P.hp, startCoins: P.coins
    };
    if (st.S.lantern) st.weights.L += 5;
    st.blocks = st.S.blocks;
    if (P.hp > st.S.maxHp) P.hp = st.S.maxHp;
    if (cfg.fixed) {
      const placed = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const ch = cfg.fixed[y][x];
        if ('HDKL'.includes(ch)) st.cells[idx(x, y)] = mkTile(st, ch);
        else if (ch >= 'a' && ch <= 'z') { const qi = ch.charCodeAt(0) - 97; st.cells[idx(x, y)] = mkYokai(st, st.queue[qi], true); placed.push(qi); }
        else st.cells[idx(x, y)] = mkTile(st, randType(st));
      }
      st.queue = st.queue.filter((_, i) => !placed.includes(i));
      for (const c of st.cells) if (c && c.k === 'y') c.fresh = false;
    } else {
      for (let i = 0; i < N; i++) st.cells[i] = mkTile(st, randType(st));
      const first = Math.min(st.max, st.queue.length);
      for (let k = 0; k < first; k++) spawnOne(st, k === 0 && cfg.rareFirst);
      for (const c of st.cells) if (c && c.k === 'y') c.fresh = false;
    }
    if (cfg.boss) {
      const sp = D.SPECIES[cfg.boss];
      st.boss = { sp: cfg.boss, hp: sp.hp, mhp: sp.hp, cd: sp.cd, cdMax: sp.cd, acts: 0, gust: 2, phase: 1 };
    }
    ensureMove(st);
    return st;
  }

  function mkTile(st, t) { return { id: st.nid++, k: 't', t }; }
  function mkJunk(st, t) { return { id: st.nid++, k: 'j', t }; }
  function mkYokai(st, sp, fresh) {
    const s = D.SPECIES[sp];
    return { id: st.nid++, k: 'y', sp, hp: s.hp, mhp: s.hp, atk: s.atk, cd: s.cd, cdMax: s.cd, fresh: !!fresh };
  }
  function randType(st) {
    const w = st.weights, tot = w.H + w.D + w.K + w.L;
    let r = st.rnd() * tot;
    for (const t of ['H', 'D', 'K', 'L']) { r -= w[t]; if (r < 0) return t; }
    return 'K';
  }
  // 玉を おぎなうときは、盤に 多すぎる 種類を 出にくく、少ない 種類を 出やすくする
  // （同じ 種類ばかりで うまって、手が つまるのを ふせぐ）
  function refillType(st) {
    const w = st.weights, cnt = { H: 0, D: 0, K: 0 };
    let n = 0;
    for (const c of st.cells) if (c && c.k === 't' && c.t !== 'L') { cnt[c.t]++; n++; }
    const base = w.H + w.D + w.K;
    const ew = { L: w.L };
    for (const t of TYPES) {
      const target = w[t] / base, share = n ? cnt[t] / n : target;
      ew[t] = w[t] * Math.max(0.4, Math.min(1.6, 1 + 1.8 * (target - share)));
    }
    const tot = ew.H + ew.D + ew.K + ew.L;
    let r = st.rnd() * tot;
    for (const t of ['H', 'D', 'K', 'L']) { r -= ew[t]; if (r < 0) return t; }
    return 'K';
  }
  function yokaiList(st) {
    const out = [];
    for (let i = 0; i < N; i++) { const c = st.cells[i]; if (c && c.k === 'y') out.push(i); }
    return out;
  }
  function findPiece(st, id) {
    for (let i = 0; i < N; i++) if (st.cells[i] && st.cells[i].id === id) return i;
    return -1;
  }

  // あたらしい妖を 盤の内側（ふちでない所）の 玉と いれかえて あらわす
  function spawnOne(st, rare) {
    if (!st.queue.length) return null;
    const ys = yokaiList(st);
    const cand = [], good = [];
    for (let y = 1; y <= H - 2; y++) for (let x = 1; x <= W - 2; x++) {
      const i = idx(x, y), c = st.cells[i];
      if (!c || c.k !== 't') continue;
      if (rare && (x < 2 || x > 4 || y < 2 || y > 4)) continue;
      cand.push(i);
      if (!ys.some(j => adj8(i, j) || i === j)) good.push(i);
    }
    const pool = good.length ? good : cand;
    if (!pool.length) return null;
    const i = pool[(st.rnd() * pool.length) | 0];
    const sp = st.queue.shift();
    const old = st.cells[i].id;
    st.cells[i] = mkYokai(st, sp, true);
    const ev = { e: 'spawn', idx: i, id: st.cells[i].id, sp, lanterns: [], replaced: old };
    // めずらしい妖は 提灯を ふたつ もって あらわれる（かこむ 手がかり）
    if (D.SPECIES[sp].rare) {
      const orth = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => idx(cx(i) + dx, cy(i) + dy))
        .filter(j => st.cells[j] && st.cells[j].k === 't' && st.cells[j].t !== 'L');
      for (let k = 0; k < 2 && orth.length; k++) {
        const j = orth.splice((st.rnd() * orth.length) | 0, 1)[0];
        const o2 = st.cells[j].id;
        st.cells[j] = mkTile(st, 'L');
        ev.lanterns.push({ idx: j, id: st.cells[j].id, old: o2 });
      }
    }
    return ev;
  }

  // ---------------------------------------------------------------- 鎖と輪
  function chainType(st, path) {
    for (const i of path) { const c = st.cells[i]; if (c && c.k === 't' && c.t !== 'L') return c.t; }
    return null;
  }
  function crosses(path, closed, a, b) {
    const ax = cx(a), ay = cy(a), bx = cx(b), by = cy(b);
    if (ax === bx || ay === by) return false;
    const p = idx(bx, ay), q = idx(ax, by);
    const n = path.length;
    for (let k = 0; k < n - 1; k++) {
      const u = path[k], v = path[k + 1];
      if ((u === p && v === q) || (u === q && v === p)) return true;
    }
    if (closed && n > 2) {
      const u = path[n - 1], v = path[0];
      if ((u === p && v === q) || (u === q && v === p)) return true;
    }
    return false;
  }
  // 多角形（マスの中心をむすぶ）の内側にある マス
  function interiorOf(path) {
    const n = path.length, out = [];
    if (n < 3) return out;
    const px = path.map(i => cx(i)), py = path.map(i => cy(i));
    let minx = 99, maxx = -1, miny = 99, maxy = -1;
    for (let k = 0; k < n; k++) { minx = Math.min(minx, px[k]); maxx = Math.max(maxx, px[k]); miny = Math.min(miny, py[k]); maxy = Math.max(maxy, py[k]); }
    const onPath = new Set(path);
    for (let y = miny + 1; y < maxy; y++) for (let x = minx + 1; x < maxx; x++) {
      const i = idx(x, y);
      if (onPath.has(i)) continue;
      let c = false;
      for (let a = 0, b = n - 1; a < n; b = a++) {
        if ((py[a] > y) !== (py[b] > y)) {
          const xi = px[a] + (y - py[a]) * (px[b] - px[a]) / (py[b] - py[a]);
          if (x < xi) c = !c;
        }
      }
      if (c) out.push(i);
    }
    return out;
  }
  function tileFits(st, path, i) {
    const c = st.cells[i];
    if (!c || c.k !== 't') return false;
    if (c.t === 'L') return true;
    const t = chainType(st, path);
    return !t || t === c.t;
  }
  // なぞっている途中に マス i へ 指が うごいた
  // 返り値：'add' / 'back' / 'close' / 'open'（輪をほどく）/ null
  // 'full'：ひもが たりない（つなげそうだが 長さの上限）
  function tryStep(st, path, closed, i) {
    const n = path.length;
    if (!n) return null;
    if (closed) return (i === path[n - 1]) ? 'open' : null;
    if (n >= 2 && i === path[n - 2]) return 'back';
    const last = path[n - 1];
    if (!adj8(last, i)) return null;
    if (i === path[0]) {
      if (n < 3) return null;
      if (crosses(path, false, last, i)) return null;
      if (!interiorOf(path).length) return null;
      return 'close';
    }
    if (path.includes(i)) return null;
    if (!tileFits(st, path, i)) return null;
    if (crosses(path, false, last, i)) return null;
    if (n >= st.S.cord) return 'full';
    return 'add';
  }
  function canStart(st, i) { const c = st.cells[i]; return !!(c && c.k === 't'); }

  // 鎖を はなしたときに おこること（予告にも 本番にも つかう）
  function preview(st, path, closed) {
    const S = st.S;
    const type = chainType(st, path);
    const inter = closed ? interiorOf(path) : [];
    const info = { type, closed, path: path.slice(), interior: inter, valid: false, count: 0, nChain: path.length,
      targets: [], befriend: [], burn: [], heal: 0, healRaw: 0, coins: 0, dmg: 0, bossDmg: 0 };
    if (!type) return info;
    if (!closed && path.length < 3) return info;
    info.valid = true;
    let inTiles = 0;
    for (const i of inter) {
      const c = st.cells[i];
      if (!c) continue;
      if (c.k === 't') inTiles++;
      else if (c.k === 'y') info.befriend.push(c.id);
      else if (c.k === 'j') info.burn.push(i);
    }
    const count = path.length + inTiles;
    info.count = count;
    const interSet = new Set(inter), pathSet = new Set(path);
    if (type === 'H') {
      // 花火は ひとつずつ はじけて、となり（ななめも）の妖に 1ずつ あたる
      const hits = new Map(), sparks = [];
      for (const p of path) for (const j of neighbors8(p)) {
        if (pathSet.has(j) || interSet.has(j)) continue;
        const c = st.cells[j];
        if (!c) continue;
        if (c.k === 'y') { hits.set(j, (hits.get(j) || 0) + 1); sparks.push([p, j]); }
        if (c.k === 'j' && !info.burn.includes(j)) info.burn.push(j);
      }
      for (const [j, n] of hits) {
        const c = st.cells[j], dmg = n + S.fire + (S.bigfire && path.length >= 6 ? 1 : 0);
        info.targets.push({ id: c.id, idx: j, n, dmg, kill: c.hp <= dmg });
        info.dmg = Math.max(info.dmg, dmg);
      }
      info.sparks = sparks;
      if (st.boss) info.bossDmg += count + S.fire;
    } else if (type === 'D') {
      info.healRaw = count + S.dango;
    } else if (type === 'K') {
      info.coins = count + S.koban;
    }
    if (info.befriend.length) {
      info.coins += 2 * info.befriend.length;
      if (S.ringheal) info.healRaw += 2 * info.befriend.length;
      if (st.boss) info.bossDmg += 5 * info.befriend.length;
    }
    info.heal = Math.max(0, Math.min(info.healRaw, S.maxHp - st.P.hp));
    if (S.junkcoin) info.coins += info.burn.length;
    return info;
  }

  // ---------------------------------------------------------------- 1手の処理
  // resolve → settle → enemies の順に よぶ（演出のため 分けてある）
  function resolve(st, path, closed) {
    const info = preview(st, path, closed);
    const ev = [];
    if (!info.valid) return { info, ev };
    st.turn++;
    st.gained.bestChain = Math.max(st.gained.bestChain, info.count);
    ev.push({ e: 'chain', type: info.type, path: path.slice(), closed, count: info.count, interior: info.interior.slice() });
    // 輪の中：妖は ともだちに、玉と おじゃまは 回収
    for (const i of info.interior) {
      const c = st.cells[i];
      if (!c) continue;
      if (c.k === 'y') {
        ev.push({ e: 'befriend', id: c.id, sp: c.sp, idx: i });
        st.gained.friends.push(c.sp);
        st.P.friends[c.sp] = (st.P.friends[c.sp] || 0) + 1;
      } else if (c.k === 'j') ev.push({ e: 'burn', id: c.id, idx: i, t: c.t });
      st.cells[i] = null;
    }
    if (closed) st.gained.rings++;
    for (const i of path) st.cells[i] = null;
    // 花火：となりの妖を おどかす／おじゃまを もやす
    if (info.type === 'H') {
      for (const tg of info.targets) {
        const i = findPiece(st, tg.id);
        if (i < 0) continue;
        hitYokai(st, i, tg.dmg, ev, 'fire');
      }
      for (const j of info.burn) {
        const c = st.cells[j];
        if (c && c.k === 'j') { ev.push({ e: 'burn', id: c.id, idx: j, t: c.t }); st.cells[j] = null; }
      }
    }
    if (st.boss && info.bossDmg > 0) {
      st.boss.hp = Math.max(0, st.boss.hp - info.bossDmg);
      ev.push({ e: 'bossHit', dmg: info.bossDmg, hp: st.boss.hp, byFriends: 5 * info.befriend.length });
    }
    if (info.healRaw > 0) { st.P.hp = Math.min(st.S.maxHp, st.P.hp + info.heal); ev.push({ e: 'heal', n: info.heal, raw: info.healRaw }); }
    if (info.coins > 0) { st.P.coins += info.coins; st.gained.coins += info.coins; ev.push({ e: 'coins', n: info.coins }); }
    checkEnd(st, ev);
    return { info, ev };
  }

  function hitYokai(st, i, dmg, ev, why) {
    const c = st.cells[i];
    if (!c || c.k !== 'y') return;
    c.hp -= dmg;
    ev.push({ e: 'hit', id: c.id, idx: i, dmg, hp: Math.max(0, c.hp), why });
    if (c.hp <= 0) {
      st.cells[i] = mkTile(st, 'K');
      st.gained.defeated++;
      ev.push({ e: 'defeat', id: c.id, idx: i, sp: c.sp, drop: st.cells[i].id });
      if (c.sp === 'onibi') {
        ev.push({ e: 'onibiBurst', idx: i });
        for (const j of neighbors8(i)) {
          const d = st.cells[j];
          if (d && d.k === 'y') hitYokai(st, j, 3, ev, 'onibi');
          else if (d && d.k === 'j') { ev.push({ e: 'burn', id: d.id, idx: j, t: d.t }); st.cells[j] = null; }
        }
      }
    }
  }

  // 玉を落として、あいた所を うめ、妖を よぶ
  function settle(st) {
    const ev = [];
    const moves = [], news = [];
    for (let x = 0; x < W; x++) {
      const lane = [];
      for (let y = 0; y < H; y++) { const c = st.cells[idx(x, y)]; if (!c || c.k !== 'y') lane.push(y); }
      const pieces = [];
      for (const y of lane) { const c = st.cells[idx(x, y)]; if (c) pieces.push({ c, y }); }
      const need = lane.length - pieces.length;
      for (const y of lane) st.cells[idx(x, y)] = null;
      for (let k = 0; k < pieces.length; k++) {
        const ty = lane[need + k];
        st.cells[idx(x, ty)] = pieces[k].c;
        if (ty !== pieces[k].y) moves.push({ id: pieces[k].c.id, x, from: pieces[k].y, to: ty });
      }
      for (let k = 0; k < need; k++) {
        const ty = lane[k];
        const t = mkTile(st, refillType(st));
        st.cells[idx(x, ty)] = t;
        news.push({ id: t.id, x, to: ty, from: k - need - 0.6 });
      }
    }
    ev.push({ e: 'fall', moves, news });
    if (st.outcome) return ev;
    // 妖を よぶ（いちどに 2まで）
    let on = yokaiList(st).length, k = 0;
    while (on < st.max && st.queue.length && k < 2) {
      const s = spawnOne(st, false);
      if (!s) break;
      ev.push(s); on++; k++;
    }
    const sh = ensureMove(st);
    if (sh) ev.push(sh);
    return ev;
  }

  // 妖たちの番
  function enemies(st) {
    const ev = [];
    if (st.outcome) return ev;
    const order = yokaiList(st).map(i => st.cells[i].id);
    for (const id of order) {
      if (st.outcome) break;
      const i = findPiece(st, id);
      if (i < 0) continue;
      const y = st.cells[i];
      if (y.fresh) { y.fresh = false; continue; }
      const s = D.SPECIES[y.sp];
      if (s.act === 'hop') hop(st, i, ev);
      const j = findPiece(st, id);
      y.cd--;
      if (y.cd > 0) continue;
      y.cd = y.cdMax;
      act(st, j, ev);
    }
    if (st.boss && !st.outcome && st.boss.hp > 0) bossTurn(st, ev);
    checkEnd(st, ev);
    return ev;
  }

  function hurt(st, n, ev, src) {
    if (st.blocks > 0) { st.blocks--; ev.push({ e: 'blocked', src, left: st.blocks }); return; }
    st.P.hp = Math.max(0, st.P.hp - n);
    ev.push({ e: 'hurt', n, hp: st.P.hp, src });
    if (st.P.hp <= 0) st.outcome = 'lose';
  }

  function act(st, i, ev) {
    const y = st.cells[i], s = D.SPECIES[y.sp];
    switch (s.act) {
      case 'flee':
        st.cells[i] = mkTile(st, randType(st));
        st.gained.fled++;
        ev.push({ e: 'flee', id: y.id, idx: i, sp: y.sp, newTile: st.cells[i].id, t: st.cells[i].t });
        return;
      case 'steal':
        if (st.P.coins >= 3) { st.P.coins -= 3; ev.push({ e: 'act', id: y.id, idx: i, kind: 'steal', n: 3 }); ev.push({ e: 'stolen', n: 3, coins: st.P.coins }); }
        else { ev.push({ e: 'act', id: y.id, idx: i, kind: 'hit' }); hurt(st, y.atk, ev, y.id); }
        return;
      case 'grow':
        y.mhp = Math.min(7, y.mhp + 1); y.hp = Math.min(y.mhp, y.hp + 1);
        ev.push({ e: 'act', id: y.id, idx: i, kind: 'grow', hp: y.hp });
        hurt(st, y.atk, ev, y.id);
        return;
      case 'azuki': {
        const cand = neighbors8(i).filter(j => st.cells[j] && st.cells[j].k === 't');
        const put = [];
        for (let k = 0; k < 2 && cand.length; k++) {
          const j = cand.splice((st.rnd() * cand.length) | 0, 1)[0];
          const o2 = st.cells[j].id; st.cells[j] = mkJunk(st, 'azuki'); put.push({ idx: j, id: st.cells[j].id, old: o2 });
        }
        ev.push({ e: 'act', id: y.id, idx: i, kind: 'azuki', put });
        hurt(st, y.atk, ev, y.id);
        return;
      }
      case 'chochin': {
        const cand = neighbors8(i).filter(j => st.cells[j] && st.cells[j].k === 't' && st.cells[j].t !== 'L');
        const put = [];
        for (let k = 0; k < 2 && cand.length; k++) {
          const j = cand.splice((st.rnd() * cand.length) | 0, 1)[0];
          const o2 = st.cells[j].id; st.cells[j] = mkTile(st, 'L'); put.push({ idx: j, id: st.cells[j].id, old: o2 });
        }
        ev.push({ e: 'act', id: y.id, idx: i, kind: 'chochin', put });
        hurt(st, y.atk, ev, y.id);
        return;
      }
      default:
        ev.push({ e: 'act', id: y.id, idx: i, kind: 'hit' });
        hurt(st, y.atk, ev, y.id);
    }
  }

  // 唐傘：毎ターン となりの 玉と 入れかわる（盤の内側だけ）
  function hop(st, i, ev) {
    const cand = neighbors8(i).filter(j => inner(cx(j), cy(j)) && st.cells[j] && st.cells[j].k === 't');
    if (!cand.length) return;
    const j = cand[(st.rnd() * cand.length) | 0];
    const t = st.cells[j];
    st.cells[j] = st.cells[i]; st.cells[i] = t;
    ev.push({ e: 'hop', id: st.cells[j].id, from: i, to: j, swap: t.id });
  }

  function bossTurn(st, ev) {
    const b = st.boss, s = D.SPECIES[b.sp];
    // 大天狗：2ターンごとに 風で 列を ずらす
    if (b.sp === 'tengu') {
      b.gust--;
      if (b.gust <= 0) { b.gust = 2; gust(st, ev); }
    }
    b.cd--;
    if (b.cd > 0) return;
    b.acts++;
    if (b.sp === 'oni' && b.phase === 1 && b.hp <= b.mhp / 2) { b.phase = 2; b.cdMax = 3; ev.push({ e: 'bossPhase', phase: 2 }); }
    b.cd = b.cdMax;
    const atk = (b.sp === 'oni' && b.phase === 2) ? 3 : s.atk;
    ev.push({ e: 'bossAct', sp: b.sp, kind: 'hit' });
    hurt(st, atk, ev, 'boss');
    if (st.outcome) return;
    const junkKind = { danuki: 'leaf', gama: 'bubble', oni: 'rock' }[b.sp];
    const nJunk = { danuki: 3, gama: 3, oni: b.phase === 2 ? 2 : 0 }[b.sp] || 0;
    if (junkKind && nJunk) {
      const cand = [];
      for (let i = 0; i < N; i++) if (st.cells[i] && st.cells[i].k === 't') cand.push(i);
      const put = [];
      for (let k = 0; k < nJunk && cand.length; k++) {
        const j = cand.splice((st.rnd() * cand.length) | 0, 1)[0];
        const o2 = st.cells[j].id; st.cells[j] = mkJunk(st, junkKind); put.push({ idx: j, id: st.cells[j].id, t: junkKind, old: o2 });
      }
      ev.push({ e: 'junk', put, t: junkKind });
    }
    // なかまを よぶ
    const summonEvery = (b.sp === 'oni' && b.phase === 1) ? 1 : 2;
    if (b.acts % summonEvery === 0 && st.cfg.summon) {
      const sp = st.cfg.summon[(st.rnd() * st.cfg.summon.length) | 0];
      if (st.queue.length < 2) { st.queue.push(sp); ev.push({ e: 'summon', sp }); }
    }
  }

  function gust(st, ev) {
    const rows = [];
    for (let y = 1; y <= H - 2; y++) rows.push(y);
    const y = rows[(st.rnd() * rows.length) | 0];
    const dir = st.rnd() < 0.5 ? 1 : -1;
    const lane = [];
    for (let x = 0; x < W; x++) { const c = st.cells[idx(x, y)]; if (!c || c.k !== 'y') lane.push(x); }
    if (lane.length < 2) return;
    const pcs = lane.map(x => st.cells[idx(x, y)]);
    const moves = [];
    for (let k = 0; k < lane.length; k++) {
      const nk = (k + dir + lane.length) % lane.length;
      st.cells[idx(lane[nk], y)] = pcs[k];
      if (pcs[k]) moves.push({ id: pcs[k].id, from: idx(lane[k], y), to: idx(lane[nk], y) });
    }
    ev.push({ e: 'gust', row: y, dir, moves });
  }

  function checkEnd(st, ev) {
    if (st.outcome) {
      if (st.outcome === 'lose' && !ev.some(e => e.e === 'lose')) ev.push({ e: 'lose' });
      return;
    }
    const ys = yokaiList(st);
    if (st.boss) {
      if (st.boss.hp <= 0) {
        // ぬしが おとなしくなると、のこった妖も いっしょに ついてくる
        for (const i of ys) {
          const c = st.cells[i];
          ev.push({ e: 'befriend', id: c.id, sp: c.sp, idx: i, late: true });
          st.gained.friends.push(c.sp);
          st.P.friends[c.sp] = (st.P.friends[c.sp] || 0) + 1;
          st.cells[i] = mkTile(st, randType(st));
        }
        st.P.friends[st.boss.sp] = (st.P.friends[st.boss.sp] || 0) + 1;
        st.gained.friends.push(st.boss.sp);
        st.outcome = 'win';
        st.queue = [];
        ev.push({ e: 'bossCalm', sp: st.boss.sp });
        winBonus(st, ev);
      }
      return;
    }
    if (!ys.length && !st.queue.length) { st.outcome = 'win'; winBonus(st, ev); }
  }
  function winBonus(st, ev) {
    const bonus = 2 + (st.S.luck3 ? 3 : 0);
    st.P.coins += bonus; st.gained.coins += bonus;
    ev.push({ e: 'win', bonus });
  }

  // ---------------------------------------------------------------- 手づまり
  function hasMove(st) {
    for (let i = 0; i < N; i++) {
      if (!canStart(st, i)) continue;
      for (const j of neighbors8(i)) {
        if (!canStart(st, j) || tryStep(st, [i], false, j) !== 'add') continue;
        for (const k of neighbors8(j)) if (k !== i && tryStep(st, [i, j], false, k) === 'add') return true;
      }
    }
    return false;
  }
  function ensureMove(st) {
    let tries = 0;
    if (hasMove(st)) return null;
    const olds = st.cells.map(c => c && c.k === 't' ? c.id : 0);
    while (!hasMove(st) && tries < 30) {
      for (let i = 0; i < N; i++) if (st.cells[i] && st.cells[i].k === 't') st.cells[i] = mkTile(st, randType(st));
      tries++;
    }
    return { e: 'shuffle', olds: olds.filter(Boolean) };
  }

  // ---------------------------------------------------------------- 輪で かこめる妖（光らせる／ヒント／ボット用）
  // 型 T の玉（と提灯）を 壁とみなし、妖から たて・よこ に ぬりひろげて ふちに とどかなければ かこめる
  function enclosableBy(st, i, T) {
    const wall = j => { const c = st.cells[j]; return c && c.k === 't' && (c.t === T || c.t === 'L'); };
    const seen = new Uint8Array(N), stack = [i];
    seen[i] = 1;
    const region = [];
    while (stack.length) {
      const j = stack.pop();
      region.push(j);
      const x = cx(j), y = cy(j);
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) return null;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = idx(x + dx, y + dy);
        if (seen[k] || wall(k)) continue;
        seen[k] = 1; stack.push(k);
      }
    }
    return region;
  }
  function ringables(st) {
    const out = [];
    for (const i of yokaiList(st)) {
      for (const T of TYPES) {
        const r = enclosableBy(st, i, T);
        if (!r) continue;
        const ring = findRing(st, r, T, i);
        if (ring) { out.push({ id: st.cells[i].id, idx: i, type: T, region: r, ring }); break; }
      }
    }
    return out;
  }
  // 実際に なぞれる輪を さがす（かこむ領域の まわりの玉だけで 閉じた道を 探索）
  function findRing(st, region, T, target) {
    const regSet = new Set(region);
    const B = [];
    const bset = new Set();
    for (const j of region) for (const k of neighbors8(j)) {
      if (regSet.has(k) || bset.has(k)) continue;
      const c = st.cells[k];
      if (c && c.k === 't' && (c.t === T || c.t === 'L')) { bset.add(k); B.push(k); }
    }
    let best = null, budget = 40000;
    const start = B.slice().sort((a, b) => a - b);
    for (const s0 of start) {
      const path = [s0];
      const used = new Set([s0]);
      const dfs = () => {
        if (--budget < 0 || best) return;
        const last = path[path.length - 1];
        if (path.length >= 3 && adj8(last, s0) && !crosses(path, false, last, s0)) {
          const inter = interiorOf(path);
          if (inter.includes(target) && chainType(st, path)) { best = path.slice(); return; }
        }
        if (path.length >= st.S.cord) return;
        for (const k of neighbors8(last)) {
          if (!bset.has(k) || used.has(k)) continue;
          if (crosses(path, false, last, k)) continue;
          if (!tileFits(st, path, k)) continue;
          path.push(k); used.add(k);
          dfs();
          path.pop(); used.delete(k);
          if (best) return;
        }
      };
      dfs();
      if (best) break;
    }
    return best;
  }

  // ---------------------------------------------------------------- 手の さがしかた（ヒント・ボット）
  // 各マスから 深さ優先で 鎖を のばし、score(info) が 高いものを 返す
  function searchChains(st, score, opt) {
    opt = opt || {};
    const maxLen = opt.maxLen || 12, budget0 = opt.budget || 25000;
    let budget = budget0;
    let best = null, bestScore = -Infinity;
    const consider = (path, closed) => {
      const info = preview(st, path, closed);
      if (!info.valid) return;
      const s = score(info, st);
      if (s > bestScore) { bestScore = s; best = { path: path.slice(), closed, info, score: s }; }
    };
    const starts = [];
    for (let i = 0; i < N; i++) if (canStart(st, i)) starts.push(i);
    // 始点を まぜて かたよりを へらす
    for (let k = starts.length - 1; k > 0; k--) { const r = (st.rnd ? ((k * 7919 + st.turn * 31) % (k + 1)) : 0); [starts[k], starts[r]] = [starts[r], starts[k]]; }
    const per = Math.max(200, (budget0 / Math.max(1, starts.length)) | 0);
    for (const s0 of starts) {
      let local = per;
      const path = [s0];
      const dfs = () => {
        if (--budget < 0 || --local < 0) return;
        if (path.length >= 3) consider(path, false);
        if (path.length >= maxLen) return;
        const last = path[path.length - 1];
        for (const k of neighbors8(last)) {
          const r = tryStep(st, path, false, k);
          if (r === 'close') { consider(path, true); continue; }
          if (r !== 'add') continue;
          path.push(k);
          dfs();
          path.pop();
        }
      };
      dfs();
      if (budget < 0) break;
    }
    // 輪は 探索で 見のがしやすいので、かこめる妖ごとに 直接 さがして 足す
    if (!opt.noRing) for (const r of ringables(st)) consider(r.ring, true);
    return best;
  }

  function cloneState(st) {
    const P = JSON.parse(JSON.stringify(st.P));
    const c = Object.assign({}, st, {
      cells: st.cells.map(x => x && Object.assign({}, x)), P, S: Object.assign({}, st.S), queue: st.queue.slice(),
      boss: st.boss && Object.assign({}, st.boss), gained: JSON.parse(JSON.stringify(st.gained)), weights: Object.assign({}, st.weights)
    });
    return c;
  }

  // 1手を まるごと（ボット用）
  function fullTurn(st, path, closed) {
    const r = resolve(st, path, closed);
    let ev = r.ev;
    if (!r.info.valid) return { info: r.info, ev };
    if (!st.outcome) ev = ev.concat(settle(st));
    if (!st.outcome) ev = ev.concat(enemies(st));
    return { info: r.info, ev };
  }

  const Sim = {
    W, H, N, idx, cx, cy, inner, adj8, neighbors8, mulberry, TYPES,
    newPlayer, stats, newBattle, yokaiList, findPiece, chainType, tryStep, canStart, interiorOf, crosses,
    preview, resolve, settle, enemies, fullTurn, ringables, findRing, enclosableBy, searchChains, hasMove, cloneState
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
  else root.G10Sim = Sim;
})(typeof window !== 'undefined' ? window : globalThis);
