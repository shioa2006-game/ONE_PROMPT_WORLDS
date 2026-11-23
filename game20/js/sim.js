// STAIRWARD — 迎撃の規則（描画に依存しない。node でも動く）
// 乱数は使わない。同じ陣・同じ持ち場なら、毎回同じ結果になる。
(function (root) {
  'use strict';
  const D = root.K20D;
  const S = {};
  S.DT = 1 / 60;
  const ENG = 1.15;      // 受け止める距離（升）。道のとなりの升に立てば、通る敵と出会う
  const ENG_DZ = 1.1;    // 受け止められる高さの差
  const CAST_FLIGHT = 0.22;

  // ---------------- 地形 ----------------
  const kind = [], hz = [];
  for (let y = 0; y < D.H; y++) {
    kind.push(D.MAP_K[y].split(''));
    hz.push(D.MAP_Z[y].split('').map((c) => parseInt(c, 10)));
  }
  function tile(x, y) {
    if (x < 0 || y < 0 || x >= D.W || y >= D.H) return null;
    return { k: kind[y][x], h: hz[y][x] };
  }
  function zAt(wx, wy) {
    const x = Math.floor(wx), y = Math.floor(wy);
    if (x < 0 || y < 0 || x >= D.W || y >= D.H) return 0;
    const k = kind[y][x], h = hz[y][x];
    if (k === 'A') return h - (wy - y);
    if (k === 'B' || k === 'R') return h - (wx - x);
    if (k === 'v') return -2;
    return h;
  }
  S.tile = tile; S.zAt = zAt;

  // ---------------- 道 ----------------
  function buildRoute(id, R) {
    const pts = R.pts.map((p) => ({ x: p[0], y: p[1] }));
    const segs = [];
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      segs.push({ a, b, l, d0: len, dx: (b.x - a.x) / l, dy: (b.y - a.y) / l });
      len += l;
    }
    const route = { id, def: R, name: R.name, color: R.color, segs, len, fly: R.fly || null, lane: R.lane || 0 };
    route.at = function (d) {
      if (d < 0) d = 0;
      if (d > len) d = len;
      let s = segs[segs.length - 1];
      for (let i = 0; i < segs.length; i++) { if (d <= segs[i].d0 + segs[i].l) { s = segs[i]; break; } }
      const u = d - s.d0;
      let x = s.a.x + s.dx * u, y = s.a.y + s.dy * u;
      // 合流した道で重ならないよう、少し横にずらす（最後の1升は扉へ寄せる）
      const lane = route.lane * Math.min(1, Math.max(0, (len - d) / 1.0));
      x += -s.dy * lane; y += s.dx * lane;
      let z;
      if (route.fly) z = route.fly.z0 + (route.fly.z1 - route.fly.z0) * (d / len);
      else z = zAt(x, y);
      return { x, y, z, dx: s.dx, dy: s.dy };
    };
    if (R.gate) {
      // 門の外側の面までの距離
      let gd = 0;
      for (const s of segs) {
        if (s.dx !== 0 && (R.gate.x - s.a.x) / s.dx >= 0 && (R.gate.x - s.a.x) / s.dx <= s.l) { gd = s.d0 + (R.gate.x - s.a.x) / s.dx; break; }
      }
      route.gateD = gd;
    }
    return route;
  }
  S.routes = {};
  for (const id in D.ROUTES) S.routes[id] = buildRoute(id, D.ROUTES[id]);

  S.slots = {};
  for (const sl of D.SLOTS) {
    const x = sl.x + 0.5, y = sl.y + 0.5;
    S.slots[sl.id] = Object.assign({}, sl, { wx: x, wy: y, wz: zAt(x, y) });
  }

  // ---------------- 能力（強化を反映） ----------------
  function allyStats(id, up) {
    const d = D.ALLIES[id];
    const s = Object.assign({}, d);
    up = up || {};
    if (id === 'ilza' && up.ilza_hp) s.hp += 12;
    if (id === 'ilza' && up.ilza_regen) { s.regen *= 2; s.regenFight = true; }
    if (id === 'kai' && up.kai_range) s.range += 1;
    if (id === 'ruu' && up.ruu_radius) s.radius *= 1.25;
    if (id === 'dugan' && up.dugan_cap) s.cap = 3;
    if (id === 'mel' && up.mel_heal) s.heal *= 1.4;
    return s;
  }
  S.allyStats = allyStats;
  function heightBonus(az, ez) { return Math.max(0, Math.min(2, (az - ez) * 0.5)); }
  S.heightBonus = heightBonus;
  // 仲間 a（位置と能力）から、点 p に届くか
  function reachOf(kindName, st, az, pz, fly) {
    if (kindName === 'archer') return st.range + (fly ? 0 : heightBonus(az, pz));
    if (kindName === 'mage') return st.range + (fly ? 0 : heightBonus(az, pz));
    if (kindName === 'spear') return fly ? 0 : st.reach;
    if (kindName === 'guard') return fly ? 0 : st.reach;
    return 0;
  }
  S.reachOf = reachOf;

  // ---------------- 陣の用意 ----------------
  S.create = function (opts) {
    const wave = opts.wave;
    const up = opts.upgrades || {};
    const st = {
      t: 0, wave, up, enemies: [], allies: [], projs: [], events: [], over: false, result: null,
      lampsMax: 5 + (up.lamp ? 1 : 0), lamps: 0, uid: 1, spawn: [], si: 0, keepEvents: opts.keepEvents !== false, routeList: {},
      gate: { hp: D.GATE.hp * (up.gate_hp ? 2 : 1), max: D.GATE.hp * (up.gate_hp ? 2 : 1), broken: false, hitT: 0, x: D.GATE.x, y: D.GATE.y },
      stats: { allies: {}, slotHeld: {}, leaks: {}, leakLog: [], downLog: [], combos: {}, comboLog: [], best: null, gateT: null, killed: 0, total: 0, pairs: {}, torches: 0, torchLog: [] },
    };
    st.lamps = st.lampsMax;
    const active = activeRoutes(wave);
    for (const id of wave.allies) {
      const slotId = opts.placement && opts.placement[id];
      if (!slotId) continue;
      const sl = S.slots[slotId];
      const s = allyStats(id, up);
      const a = {
        id, def: s, base: D.ALLIES[id], slot: sl, x: sl.wx, y: sl.wy, z: sl.wz, hp: s.hp, maxhp: s.hp, cap: s.cap,
        eng: [], cd: 0.6, cast: null, down: false, barrier: 0, bcd: 0, alert: 0, alerted: false, quiet: 0,
        atkT: 0, hurtT: 0, healT: 0, face: [0, 1], said: {},
      };
      a.face = defaultFace(sl, active);
      st.allies.push(a);
      st.stats.allies[id] = { slot: slotId, held: 0, kills: 0, dmg: 0, assists: 0, downs: 0, heal: 0, burnBest: 0, holdT: 0 };
    }
    let order = 0;
    for (const g of wave.groups) for (let i = 0; i < g.n; i++) st.spawn.push({ t: g.t + i * g.gap, r: g.r, e: g.e, order: order++ });
    st.spawn.sort((a, b) => a.t - b.t || a.order - b.order);
    st.stats.total = st.spawn.length;
    for (const r of active) st.stats.leaks[r] = 0;
    return st;
  };
  function activeRoutes(wave) {
    const s = [];
    for (const g of wave.groups) if (s.indexOf(g.r) < 0) s.push(g.r);
    return s;
  }
  S.activeRoutes = activeRoutes;
  function defaultFace(sl, active) {
    // いちばん近い道の点へ向く（敵が来る側をやや優先）
    let best = null, bd = 1e9;
    for (const r of active) {
      const R = S.routes[r];
      if (R.fly) continue;
      for (let d = 0; d <= R.len; d += 0.25) {
        const p = R.at(d);
        const dist = Math.hypot(p.x - sl.wx, p.y - sl.wy) + d * 0.02;
        if (dist < bd && dist > 0.3) { bd = dist; best = p; }
      }
    }
    if (!best) return [1, 1];
    const fx = best.x - sl.wx, fy = best.y - sl.wy, l = Math.hypot(fx, fy) || 1;
    return [fx / l, fy / l];
  }

  // ---------------- 進行 ----------------
  function ev(st, type, o) { if (st.keepEvents) { o = o || {}; o.type = type; o.t = st.t; st.events.push(o); } }
  function place(e) {
    const p = e.R.at(e.d);
    e.x = p.x; e.y = p.y; e.z = p.z;
    if (e.mode === 'walk') e.face = [p.dx, p.dy];
  }
  function faceTo(u, x, y) {
    const fx = x - u.x, fy = y - u.y, l = Math.hypot(fx, fy);
    if (l > 1e-3) u.face = [fx / l, fy / l];
  }
  function alive(e) { return !e.dead && !e.out; }
  function load(a) { let w = 0; for (const e of a.eng) w += e.def.w; return w; }
  S.load = load;

  function spawnEnemy(st, sp) {
    const def = D.ENEMIES[sp.e];
    const e = {
      uid: st.uid++, type: sp.e, def, r: sp.r, R: S.routes[sp.r], d: 0, x: 0, y: 0, z: 0, hp: def.hp, maxhp: def.hp,
      eng: null, cd: 0.3, stun: 0, mode: 'walk', face: [0, -1], dead: false, out: false, shootAt: null, slip: {},
      hitT: 0, atkT: 0, born: st.t, deadT: 0, slipAt: null, engT: 0,
    };
    place(e);
    st.enemies.push(e);
    const rl = st.routeList[sp.r] || (st.routeList[sp.r] = []);
    e.ri = rl.length; rl.push(e);
    ev(st, 'spawn', { e });
  }

  // 同じ道で、すぐ前を行く敵（同じ道では追いこさないので、出てきた順に並ぶ）
  function aheadOf(st, e) {
    const rl = st.routeList[e.r];
    for (let i = e.ri - 1; i >= 0; i--) { const f = rl[i]; if (alive(f) && f.d > e.d) return f; if (alive(f)) return f.d > e.d ? f : null; }
    return null;
  }
  S.aheadOf = aheadOf;
  function spacing(a, b) { return (a.def.big ? 0.5 : 0.275) + (b.def.big ? 0.5 : 0.275); }

  function tryEngage(st, e) {
    if (e.eng || e.def.fly) return;
    let best = null, bd = 1e9;
    for (const a of st.allies) {
      if (a.down || a.slot.safe) continue;
      const dist = Math.hypot(a.x - e.x, a.y - e.y);
      if (dist > ENG || Math.abs(a.z - e.z) > ENG_DZ) continue;
      if (load(a) + e.def.w > a.cap) {
        if (!e.slip[a.id]) {
          e.slip[a.id] = true;
          e.slipAt = { x: e.x, y: e.y, z: e.z, ally: a.id };
          ev(st, 'slip', { e, a });
          if (e.def.big) hitAlly(st, a, 3, e);
        }
        continue;
      }
      if (dist < bd) { bd = dist; best = a; }
    }
    if (best) {
      e.eng = best; e.engT = st.t;
      best.eng.push(e);
      e.stun = Math.max(e.stun, 0.35);
      faceTo(e, best.x, best.y);
      faceTo(best, e.x, e.y);
      const sa = st.stats.allies[best.id];
      sa.held++;
      st.stats.slotHeld[best.slot.id] = (st.stats.slotHeld[best.slot.id] || 0) + 1;
      ev(st, 'block', { e, a: best, first: sa.held === 1 });
    }
  }

  function stepEnemy(st, e, dt) {
    if (e.hitT > 0) e.hitT -= dt;
    if (e.atkT > 0) e.atkT -= dt;
    if (e.cd > 0) e.cd -= dt;
    if (e.stun > 0) { e.stun -= dt; if (!e.eng) e.mode = 'stun'; return; }
    const R = e.R;
    if (e.def.fly) {
      e.d += e.def.spd * dt; e.mode = 'walk'; place(e);
      if (e.d >= R.len - 0.01) leak(st, e);
      return;
    }
    if (e.eng) {
      const a = e.eng;
      if (a.down || a.eng.indexOf(e) < 0) { e.eng = null; }
      else {
        e.mode = 'fight'; faceTo(e, a.x, a.y);
        if (e.cd <= 0) { e.cd = e.def.cd; e.atkT = 0.22; hitAlly(st, a, e.def.atk, e); }
        return;
      }
    }
    if (e.def.ranged && (e.adv || 0) <= 0) {
      const tgt = pickShootTarget(st, e);
      if (tgt) {
        // 同じ場所で長く射ち続けたら、一歩前へ出る
        e.shootT = (e.shootT || 0) + dt;
        if (e.shootT > 6) { e.shootT = 0; e.adv = 1.3; }
        e.mode = 'shoot';
        if (e.shootAt !== tgt) ev(st, 'aim', { e, a: tgt });
        e.shootAt = tgt; faceTo(e, tgt.x, tgt.y);
        if (e.cd <= 0) {
          e.cd = e.def.cd; e.atkT = 0.25;
          const dist = Math.hypot(tgt.x - e.x, tgt.y - e.y);
          st.projs.push({ kind: 'earrow', owner: e, target: tgt, x0: e.x, y0: e.y, z0: e.z + 0.9, t: 0, T: 0.15 + dist / 11, dmg: e.def.atk });
          ev(st, 'eshoot', { e, a: tgt });
        }
        tryEngage(st, e);
        return;
      }
      e.shootAt = null;
    }
    let maxD = e.d + e.def.spd * dt;
    if (e.adv > 0) e.adv -= e.def.spd * dt;
    let gateStop = false;
    if (R.gateD && !st.gate.broken && e.d < R.gateD) {
      const stopD = R.gateD - 0.32;
      if (maxD >= stopD) { maxD = Math.max(e.d, stopD); gateStop = true; }
    }
    const ahead = aheadOf(st, e);
    if (ahead) {
      const lim = ahead.d - spacing(e, ahead);
      if (maxD > lim) maxD = Math.max(e.d, lim);
    }
    const moved = maxD - e.d;
    e.d = maxD;
    e.mode = moved > 1e-5 ? 'walk' : 'wait';
    place(e);
    // 列の二番手は、前の仲間の肩ごしに打ちかかる（押し寄せ）
    if (e.mode === 'wait' && ahead && ahead.eng && !e.def.ranged) {
      const a = ahead.eng;
      if (!a.down && Math.hypot(a.x - e.x, a.y - e.y) <= 1.75 && Math.abs(a.z - e.z) <= 1.6) {
        e.mode = 'press'; e.pressOn = a; faceTo(e, a.x, a.y);
        if (e.cd <= 0) { e.cd = e.def.cd * 1.5; e.atkT = 0.22; hitAlly(st, a, e.def.atk, e); }
      }
    }
    // 門の前に詰まった敵は、みんなで門を叩く
    if (R.gateD && !st.gate.broken && e.mode === 'wait' && e.d >= R.gateD - 1.6 && e.d < R.gateD) gateStop = true;
    if (gateStop && e.d >= R.gateD - 1.6) {
      e.mode = 'gate'; e.face = [-1, 0];
      if (e.cd <= 0) {
        e.cd = e.def.cd || 1; e.atkT = 0.22;
        const g = st.gate;
        g.hp -= e.def.gate; g.hitT = 0.15;
        ev(st, 'gatehit', { e });
        if (g.hp <= 0 && !g.broken) {
          g.hp = 0; g.broken = true; st.stats.gateT = st.t;
          ev(st, 'gatebreak', {});
        }
      }
    }
    tryEngage(st, e);
    if (e.d >= R.len - 0.01) leak(st, e);
  }

  // 城壁の内側に長くいる敵は、本丸へ松明を投げこむ（灯がひとつ消える）
  function inside(x, y) { const t = tile(Math.floor(x), Math.floor(y)); return !!t && D.INSIDE.kinds.indexOf(t.k) >= 0; }
  S.inside = inside;
  function stepTorch(st, e, dt) {
    if (e.def.fly || e.torched || !inside(e.x, e.y)) return;
    e.zoneT = (e.zoneT || 0) + dt;
    if (e.zoneT < D.INSIDE.t) return;
    e.torched = true;
    st.lamps -= 1;
    st.stats.torches = (st.stats.torches || 0) + 1;
    st.stats.torchLog.push({ r: e.r, type: e.type, t: st.t, x: e.x, y: e.y, held: e.eng ? e.eng.id : null });
    ev(st, 'torch', { e });
    if (st.lamps <= 0) { st.lamps = 0; finish(st, false); }
  }

  function pickShootTarget(st, e) {
    // 届く仲間のうち、後衛（受け止め役でない者）を先に、近い順
    let best = null, bs = -1e9;
    for (const a of st.allies) {
      if (a.down) continue;
      const dist = Math.hypot(a.x - e.x, a.y - e.y);
      if (dist > e.def.ranged) continue;
      const back = (a.def.kind === 'mage' || a.def.kind === 'archer' || a.def.kind === 'healer') ? 10 : 0;
      const sc = back - dist;
      if (sc > bs) { bs = sc; best = a; }
    }
    return best;
  }

  function leak(st, e) {
    if (e.out) return;
    e.out = true; e.deadT = st.t;
    if (e.eng) { const i = e.eng.eng.indexOf(e); if (i >= 0) e.eng.eng.splice(i, 1); e.eng = null; }
    // 一体の敵が消す灯は、扉に着くか松明を投げるかの、どちらか一回まで（大鬼は扉に着くと5つ）
    st.lamps -= e.torched ? Math.max(0, e.def.leak - 1) : e.def.leak;
    st.stats.leaks[e.r] = (st.stats.leaks[e.r] || 0) + 1;
    st.stats.leakLog.push({ r: e.r, type: e.type, t: st.t, slip: e.slipAt, gate: e.r === 'G' ? st.gate.broken : null });
    ev(st, 'leak', { e });
    if (st.lamps <= 0) { st.lamps = 0; finish(st, false); }
  }

  function hitAlly(st, a, dmg, src) {
    if (a.down) return;
    const before = a.hp;
    if (a.barrier > 0) {
      const ab = Math.min(a.barrier, dmg);
      a.barrier -= ab; dmg -= ab;
      if (ab > 0 && before - (dmg + ab) <= 0 && before - dmg > 0) {
        combo(st, 'barrier', { by: 'mel', to: a.id, x: a.x, y: a.y, z: a.z });
      }
    }
    if (dmg <= 0) { ev(st, 'shielded', { a }); return; }
    a.hp -= dmg; a.hurtT = 0.12;
    ev(st, 'hurt', { a, dmg, src });
    if (a.hp <= 0) {
      a.hp = 0; a.down = true; a.cast = null;
      for (const e of a.eng) e.eng = null;
      a.eng = [];
      st.stats.allies[a.id].downs++;
      st.stats.downLog.push({ ally: a.id, t: st.t, by: src ? src.type : null });
      ev(st, 'down', { a, by: src ? src.type : null });
    }
  }

  function damage(st, a, e, dmg, how) {
    if (!alive(e)) return 0;
    let m = 1;
    if (how === 'arrow' && e.def.armor) m = e.def.armor;
    if (how === 'arrow' && e.def.fly) m = 2;
    if (how === 'spear' && e.def.beast && a.def.wolf) m = a.def.wolf;
    const v = dmg * m;
    a.lastAct = st.t;
    const fullHp = e.hp >= e.maxhp - 1e-6;
    e.hp -= v; e.hitT = 0.14;
    st.stats.allies[a.id].dmg += v;
    ev(st, 'hit', { e, a, dmg: v, how });
    if (e.hp <= 0) kill(st, e, a, how, fullHp);
    return v;
  }

  function kill(st, e, a, how, oneShot) {
    e.dead = true; e.deadT = st.t; e.hp = 0;
    const held = e.eng, aiming = e.shootAt;
    if (e.eng) { const i = e.eng.eng.indexOf(e); if (i >= 0) e.eng.eng.splice(i, 1); e.eng = null; }
    st.stats.allies[a.id].kills++;
    st.stats.killed++;
    ev(st, 'kill', { e, a, how });
    // 援護：ほかの仲間と戦っていた敵、ほかの仲間をねらっていた敵を倒した
    const helped = (held && held !== a) ? held : ((aiming && aiming !== a && !aiming.down) ? aiming : null);
    if (helped) {
      assist(st, a, helped, how);
      if (a.id === 'kai') {
        if (aiming && aiming.id === 'ruu' && e.def.ranged) combo(st, 'cover_ruu', { by: 'kai', to: 'ruu', x: e.x, y: e.y, z: e.z });
        else combo(st, 'cover', { by: 'kai', to: helped.id, x: e.x, y: e.y, z: e.z });
      }
    }
    if (a.id === 'dugan' && e.def.beast && oneShot && how === 'spear') combo(st, 'wolf_spear', { by: 'dugan', x: e.x, y: e.y, z: e.z });
    if (a.id === 'kai' && e.def.fly) combo(st, 'crow', { by: 'kai', x: e.x, y: e.y, z: e.z });
  }

  function assist(st, from, to, how) {
    if (how !== 'heal') st.stats.allies[from.id].assists++;
    const k = from.id + '>' + to.id;
    st.stats.pairs[k] = (st.stats.pairs[k] || 0) + 1;
    ev(st, 'assist', { a: from, b: to, how });
  }

  function combo(st, id, o) {
    st.stats.combos[id] = (st.stats.combos[id] || 0) + 1;
    st.stats.comboLog.push({ id, t: st.t, by: o.by, to: o.to || null });
    o.id = id;
    ev(st, 'combo', o);
  }

  // ---------------- 仲間 ----------------
  function enemiesNear(st, a, r, dzMax, allowFly) {
    const out = [];
    for (const e of st.enemies) {
      if (!alive(e)) continue;
      if (e.def.fly && !allowFly) continue;
      if (Math.abs(e.z - a.z) > dzMax && !e.def.fly) continue;
      const dist = Math.hypot(e.x - a.x, e.y - a.y);
      if (dist <= r) out.push(e);
    }
    return out;
  }
  function progress(e) { return e.R.len - e.d; } // 小さいほど扉に近い

  function stepAlly(st, a, dt) {
    if (a.cd > 0) a.cd -= dt;
    if (a.bcd > 0) a.bcd -= dt;
    if (a.atkT > 0) a.atkT -= dt;
    if (a.hurtT > 0) a.hurtT -= dt;
    if (a.healT > 0) a.healT -= dt;
    a.eng = a.eng.filter((e) => alive(e) && e.eng === a);
    const def = a.def;
    // 息をつく：受け止めていない間だけ（気付け薬があれば戦いながらも）
    if (def.regen && (a.eng.length === 0 || def.regenFight)) a.hp = Math.min(a.maxhp, a.hp + def.regen * (a.eng.length ? 0.5 : 1) * dt);
    // 構える：敵が近づいた
    let near = false;
    for (const e of st.enemies) {
      if (!alive(e)) continue;
      if (Math.hypot(e.x - a.x, e.y - a.y) < 3.2 && (e.def.fly || Math.abs(e.z - a.z) < 3)) { near = true; break; }
    }
    if (near) {
      a.quiet = 0;
      if (!a.alerted) { a.alerted = true; a.alert = 0.7; ev(st, 'alert', { a }); }
    } else {
      a.quiet += dt;
      if (a.quiet > 3) a.alerted = false;
    }
    if (a.alert > 0) a.alert -= dt;
    // 受け止めている時間（大鬼）
    for (const e of a.eng) if (e.def.big) {
      st.stats.allies[a.id].holdT += dt;
      if (a.id === 'ilza' && !a.said.ogre && st.t - e.engT > 8) { a.said.ogre = true; combo(st, 'ogre_hold', { by: 'ilza', x: a.x, y: a.y, z: a.z }); }
    }
    if (def.kind === 'guard') stepGuard(st, a);
    else if (def.kind === 'spear') stepSpear(st, a);
    else if (def.kind === 'archer') stepArcher(st, a);
    else if (def.kind === 'mage') stepMage(st, a, dt);
    else if (def.kind === 'healer') stepHealer(st, a);
  }

  function pickMelee(st, a, reach) {
    let t = null;
    for (const e of a.eng) if (!t || e.hp < t.hp) t = e;
    if (t) return t;
    const c = enemiesNear(st, a, reach, ENG_DZ + 0.3, false);
    for (const e of c) if (!t || progress(e) < progress(t)) t = e;
    return t;
  }

  function stepGuard(st, a) {
    const t = pickMelee(st, a, a.def.reach);
    if (!t) return;
    faceTo(a, t.x, t.y);
    if (a.cd <= 0) { a.cd = a.def.cd; a.atkT = 0.2; damage(st, a, t, a.def.atk, 'slash'); }
  }

  function stepSpear(st, a) {
    let t = null;
    for (const e of a.eng) if (!t || e.hp < t.hp) t = e;
    if (!t) {
      const c = enemiesNear(st, a, a.def.reach, 1.6, false);
      for (const e of c) {
        // 狼を先に。つぎに、ほかの仲間が受け止めている敵。つぎに扉に近い敵
        const sc = (e.def.beast ? 100 : 0) + (e.eng ? 50 : 0) - progress(e);
        const tc = t ? (t.def.beast ? 100 : 0) + (t.eng ? 50 : 0) - progress(t) : -1e9;
        if (sc > tc) t = e;
      }
    }
    if (!t) return;
    faceTo(a, t.x, t.y);
    if (a.cd > 0) return;
    a.cd = a.def.cd; a.atkT = 0.22;
    // 突きの線上、すぐ後ろの一体も貫く
    const dx = t.x - a.x, dy = t.y - a.y, l = Math.hypot(dx, dy) || 1;
    const ux = dx / l, uy = dy / l;
    let back = null, bp = 1e9;
    for (const e of st.enemies) {
      if (e === t || !alive(e) || e.def.fly) continue;
      const px = e.x - a.x, py = e.y - a.y;
      const proj = px * ux + py * uy;
      const perp = Math.abs(px * uy - py * ux);
      if (proj > l && proj - l <= 1.15 && perp < 0.5 && Math.abs(e.z - t.z) < 1.2 && proj < bp) { bp = proj; back = e; }
    }
    const heldBy = t.eng && t.eng !== a ? t.eng : null;
    ev(st, 'thrust', { a, e: t, back });
    damage(st, a, t, a.def.atk, 'spear');
    if (back) damage(st, a, back, a.def.atk, 'spear');
    if (heldBy) {
      if (heldBy.id === 'ilza') combo(st, 'spear_ilza', { by: 'dugan', to: 'ilza', x: t.x, y: t.y, z: t.z });
      assist(st, a, heldBy, 'spear');
    }
  }

  function stepArcher(st, a) {
    if (a.cd > 0) return;
    let t = null, ts = -1e9;
    for (const e of st.enemies) {
      if (!alive(e)) continue;
      if (!e.def.fly && Math.abs(e.z - a.z) > 4.5) continue;
      const r = reachOf('archer', a.def, a.z, e.z, e.def.fly);
      const dist = Math.hypot(e.x - a.x, e.y - a.y);
      if (dist > r) continue;
      const sc = (e.def.fly ? 2000 : 0) + (e.def.ranged ? 1000 : 0) + (e.shootAt ? 200 : 0) - progress(e) * 10 - (e.def.armor ? 30 : 0);
      if (sc > ts) { ts = sc; t = e; }
    }
    if (!t) return;
    faceTo(a, t.x, t.y);
    a.cd = a.def.cd * (a.eng.length ? 1.6 : 1);
    a.atkT = 0.22;
    const dist = Math.hypot(t.x - a.x, t.y - a.y);
    st.projs.push({ kind: 'arrow', owner: a, target: t, x0: a.x, y0: a.y, z0: a.z + 1.0, t: 0, T: 0.1 + dist / 13, dmg: a.def.atk });
    ev(st, 'shoot', { a, e: t });
  }

  function clusterAt(st, c, radius) {
    const list = [];
    for (const o of st.enemies) {
      if (!alive(o)) continue;
      if (!!o.def.fly !== !!c.def.fly) continue;
      if (Math.hypot(o.x - c.x, o.y - c.y) <= radius && Math.abs(o.z - c.z) <= 1.5) list.push(o);
    }
    return list;
  }

  function stepMage(st, a, dt) {
    if (a.eng.length) {
      // 近寄られると詠唱できない。杖で叩くだけ
      if (a.cast) { a.cast = null; ev(st, 'interrupt', { a }); }
      const t = a.eng[0];
      faceTo(a, t.x, t.y);
      if (a.cd <= 0) { a.cd = 1.2; a.atkT = 0.2; damage(st, a, t, 1, 'staff'); }
      return;
    }
    if (a.cast) {
      const c = a.cast;
      c.t -= dt;
      if (alive(c.target)) { c.x = c.target.x; c.y = c.target.y; c.z = c.target.z; }
      faceTo(a, c.x, c.y);
      if (c.t <= 0) {
        a.cast = null; a.cd = a.def.cd; a.atkT = 0.3;
        st.projs.push({ kind: 'fire', owner: a, target: c.target, tx: c.x, ty: c.y, tz: c.z, x0: a.x, y0: a.y, z0: a.z + 1.2, t: 0, T: CAST_FLIGHT, dmg: a.def.atk, radius: a.def.radius });
        ev(st, 'fireball', { a });
      }
      return;
    }
    if (a.cd > 0) return;
    a.wait = (a.wait || 0) + S.DT;
    if (a.scan > 0) { a.scan -= S.DT; return; }
    let best = null, bs = -1e9, bn = 0, urgent = false;
    for (const e of st.enemies) {
      if (!alive(e)) continue;
      if (!e.def.fly && Math.abs(e.z - a.z) > 4.5) continue;
      const r = reachOf('mage', a.def, a.z, e.z, e.def.fly);
      if (Math.hypot(e.x - a.x, e.y - a.y) > r) continue;
      const n = clusterAt(st, e, a.def.radius).length;
      const sc = n * 100 - progress(e) - (e.def.fly ? 30 : 0);
      if (progress(e) < 4.5 || e.def.fly) urgent = true;
      if (sc > bs) { bs = sc; best = e; bn = n; }
    }
    if (!best) { a.wait = 0; a.aim = null; a.scan = 0.1; return; }
    // かたまるのを待つ（扉に近い敵や空の敵がいれば、待たない）
    const need = urgent ? 1 : (a.wait < 0.9 ? 4 : (a.wait < 1.8 ? 3 : (a.wait < 3.0 ? 2 : 1)));
    if (bn < need) { a.aim = best; a.scan = 0.1; return; }
    a.wait = 0; a.aim = null;
    a.cast = { target: best, t: a.def.cast, T: a.def.cast, x: best.x, y: best.y, z: best.z };
    faceTo(a, best.x, best.y);
    ev(st, 'cast', { a, e: best });
  }

  function stepHealer(st, a) {
    // 守りの光（危ない仲間に）
    if (a.bcd <= 0) {
      let t = null;
      for (const b of st.allies) {
        if (b.down || b.barrier > 0) continue;
        if (Math.hypot(b.x - a.x, b.y - a.y) > a.def.range) continue;
        if (b.hp / b.maxhp < 0.4 && (!t || b.hp / b.maxhp < t.hp / t.maxhp)) t = b;
      }
      if (t) {
        t.barrier = a.def.barrier; a.bcd = a.def.bcd; a.atkT = 0.3;
        faceTo(a, t.x, t.y);
        ev(st, 'barrier', { a, b: t });
        if (t !== a) assist(st, a, t, 'barrier');
      }
    }
    if (a.cd > 0) return;
    let t = null;
    for (const b of st.allies) {
      if (b.down || b === a) continue;  // 自分は癒やせない
      if (Math.hypot(b.x - a.x, b.y - a.y) > a.def.range) continue;
      if (b.maxhp - b.hp < 2) continue;
      if (!t || b.hp / b.maxhp < t.hp / t.maxhp) t = b;
    }
    if (t) {
      const v = Math.min(a.def.heal, t.maxhp - t.hp);
      t.hp += v; t.healT = 0.5; a.cd = a.def.cd; a.atkT = 0.25; a.lastAct = st.t;
      faceTo(a, t.x, t.y);
      st.stats.allies[a.id].heal += v;
      ev(st, 'heal', { a, b: t, v });
      if (t !== a) {
        assist(st, a, t, 'heal');
        let big = false;
        for (const e of t.eng) if (e.def.big) big = true;
        a.hh = a.hh || {};
        if ((load(t) >= 2 || big) && (!a.hh[t.id] || st.t - a.hh[t.id] > 5)) { a.hh[t.id] = st.t; combo(st, 'heal_hold', { by: 'mel', to: t.id, x: t.x, y: t.y, z: t.z }); }
      }
      return;
    }
    // だれも傷ついていなければ、杖で叩く
    if (a.eng.length) {
      const e = a.eng[0];
      faceTo(a, e.x, e.y);
      a.cd = 1.4; a.atkT = 0.2;
      damage(st, a, e, 1, 'staff');
    }
  }

  // ---------------- 飛び道具 ----------------
  function stepProjs(st, dt) {
    const keep = [];
    for (const p of st.projs) {
      p.t += dt;
      if (p.t < p.T) { keep.push(p); continue; }
      if (p.kind === 'arrow') {
        if (alive(p.target)) damage(st, p.owner, p.target, p.dmg, 'arrow');
      } else if (p.kind === 'earrow') {
        if (!p.target.down) hitAlly(st, p.target, p.dmg, p.owner);
      } else if (p.kind === 'fire') {
        explode(st, p);
      }
    }
    st.projs = keep;
  }

  function explode(st, p) {
    const a = p.owner;
    let cx = p.tx, cy = p.ty, cz = p.tz;
    if (alive(p.target)) { cx = p.target.x; cy = p.target.y; cz = p.target.z; }
    const fly = p.target && p.target.def.fly;
    const hits = [];
    for (const e of st.enemies) {
      if (!alive(e)) continue;
      if (!!e.def.fly !== !!fly) continue;
      if (Math.hypot(e.x - cx, e.y - cy) <= p.radius && Math.abs(e.z - cz) <= 1.5) hits.push(e);
    }
    // 連携の判定（当たる前の状態で）
    const holders = {};
    let atGate = 0;
    for (const h of hits) {
      const hb = holderOf(st, h);
      if (hb) holders[hb.id] = hb;
      if (h.mode === 'gate' || (h.r === 'G' && !st.gate.broken && h.d < (h.R.gateD || 0) && (h.mode === 'wait' || h.mode === 'gate'))) atGate++;
    }
    const relieved = {};
    for (const h of hits) if (h.eng && h.eng !== a) relieved[h.eng.id] = h.eng;
    let kills = 0;
    for (const h of hits) { const was = alive(h); damage(st, a, h, p.dmg, 'fire'); if (was && !alive(h)) kills++; }
    const n = hits.length;
    const sa = st.stats.allies[a.id];
    if (n > sa.burnBest) sa.burnBest = n;
    if (!st.stats.best || n > st.stats.best.n) st.stats.best = { n, t: st.t, ally: a.id, holder: Object.keys(holders)[0] || null, gate: atGate >= 3 };
    ev(st, 'explode', { a, x: cx, y: cy, z: cz, n, kills, radius: p.radius, fly });
    for (const id in relieved) assist(st, a, relieved[id], 'fire');
    if (n >= 3) {
      if (holders.ilza) combo(st, 'burn_ilza', { by: 'ruu', to: 'ilza', x: cx, y: cy, z: cz, n });
      if (holders.dugan) combo(st, 'burn_dugan', { by: 'ruu', to: 'dugan', x: cx, y: cy, z: cz, n });
      if (atGate >= 3) combo(st, 'gate_burn', { by: 'ruu', to: 'gate', x: cx, y: cy, z: cz, n });
    }
    if (n >= 5) combo(st, 'big_burn', { by: 'ruu', x: cx, y: cy, z: cz, n });
  }

  // その敵の列の先頭を受け止めている仲間
  function holderOf(st, e) {
    let f = e, guard = 0;
    while (f && guard++ < 40) {
      if (f.eng) return f.eng;
      if (f.mode !== 'wait' && f.mode !== 'stun' && f !== e) return null;
      if (f.mode === 'walk' && f !== e) return null;
      f = aheadOf(st, f);
      if (f && f.d - e.d > 6) return null;
    }
    return null;
  }

  // ---------------- 1歩 ----------------
  S.step = function (st) {
    if (st.over) return;
    const dt = S.DT;
    st.t += dt;
    if (st.gate.hitT > 0) st.gate.hitT -= dt;
    while (st.si < st.spawn.length && st.spawn[st.si].t <= st.t) { spawnEnemy(st, st.spawn[st.si]); st.si++; }
    for (const e of st.enemies) if (alive(e)) { stepEnemy(st, e, dt); if (alive(e)) stepTorch(st, e, dt); }
    if (st.over) return;
    for (const a of st.allies) if (!a.down) stepAlly(st, a, dt);
    stepProjs(st, dt);
    if (st.over) return;
    if (st.si >= st.spawn.length) {
      let left = 0;
      for (const e of st.enemies) if (alive(e)) left++;
      if (left === 0) finish(st, st.lamps > 0);
      else if (st.t > st.spawn[st.spawn.length - 1].t + 90) {
        // 長くにらみ合ったら、残った敵は退いていく（にらみ合いで終わらなくならないように）
        for (const e of st.enemies) if (alive(e)) { e.out = true; e.fled = true; e.deadT = st.t; if (e.eng) { const i = e.eng.eng.indexOf(e); if (i >= 0) e.eng.eng.splice(i, 1); e.eng = null; } }
        st.stats.fled = left;
        ev(st, 'flee', { n: left });
        finish(st, st.lamps > 0);
      }
    }
    if (st.t > 400) finish(st, st.lamps > 0);
  };

  function finish(st, win) {
    if (st.over) return;
    st.over = true;
    st.result = { win, lamps: st.lamps, lampsMax: st.lampsMax, t: st.t };
    ev(st, 'end', { win });
  }

  S.run = function (st, maxT) {
    maxT = maxT || 400;
    while (!st.over && st.t < maxT) { S.step(st); if (st.events.length > 2000) st.events.length = 0; }
    return st;
  };
  S.left = function (st) {
    let n = st.spawn.length - st.si;
    for (const e of st.enemies) if (alive(e)) n++;
    return n;
  };
  S.alive = alive;

  // ---------------- 作戦の読み（配置の前に見えるもの） ----------------
  // placement: {allyId: slotId}
  S.analyze = function (wave, placement, up) {
    const out = { routes: {}, links: [] };
    const placed = [];
    for (const id of wave.allies) {
      const sid = placement[id];
      if (!sid) continue;
      const sl = S.slots[sid];
      placed.push({ id, sl, st: allyStats(id, up), x: sl.wx, y: sl.wy, z: sl.wz });
    }
    const act = activeRoutes(wave);
    for (const r of act) {
      const R = S.routes[r];
      const info = { r, block: null, cover: {}, gateD: R.gateD || null, len: R.len, fly: !!R.fly };
      for (let d = 0; d <= R.len + 1e-6; d += 0.1) {
        const p = R.at(d);
        for (const a of placed) {
          if (!R.fly && !info.block && !a.sl.safe) {
            if (Math.hypot(a.x - p.x, a.y - p.y) <= ENG && Math.abs(a.z - p.z) <= ENG_DZ) {
              info.block = { ally: a.id, d, x: p.x, y: p.y, z: p.z };
            }
          }
          const k = a.st.kind;
          if (k === 'archer' || k === 'mage' || k === 'spear') {
            if (!R.fly && Math.abs(p.z - a.z) > (k === 'spear' ? 1.6 : 4.5)) continue;
            const rr = reachOf(k, a.st, a.z, p.z, !!R.fly);
            if (rr > 0 && Math.hypot(a.x - p.x, a.y - p.y) <= rr) {
              const c = info.cover[a.id] || (info.cover[a.id] = []);
              const last = c[c.length - 1];
              if (last && d - last[1] <= 0.11) last[1] = d; else c.push([d, d]);
            }
          }
        }
      }
      out.routes[r] = info;
    }
    // 持ち場ごとに、どの道のそばにあるか（受け止められる位置か）
    out.near = {};
    for (const a of placed) {
      if (a.sl.safe) continue;
      for (const r of act) {
        const R = S.routes[r];
        if (R.fly) continue;
        for (let d = 0; d <= R.len; d += 0.1) {
          const p = R.at(d);
          if (Math.hypot(a.x - p.x, a.y - p.y) <= ENG && Math.abs(a.z - p.z) <= ENG_DZ) { (out.near[a.id] = out.near[a.id] || []).push(r); break; }
        }
      }
    }
    // 連携の予感
    const has = (id) => placed.find((a) => a.id === id);
    const covers = (aid, r, d0, d1) => {
      const c = out.routes[r] && out.routes[r].cover[aid];
      if (!c) return false;
      for (const s of c) if (s[1] >= d0 && s[0] <= d1) return true;
      return false;
    };
    const link = (a, b, kindName, label) => {
      if (out.links.find((l) => l.a === a && l.b === b && l.kind === kindName)) return;
      out.links.push({ a, b, kind: kindName, label });
    };
    for (const r of act) {
      const info = out.routes[r];
      if (info.block) {
        const X = info.block.ally;
        if (X !== 'ruu' && has('ruu') && covers('ruu', r, info.block.d - 2.0, info.block.d)) link('ruu', X, 'burn', '受けて、焼く');
        if (X !== 'dugan' && has('dugan')) {
          const D2 = has('dugan');
          if (Math.hypot(D2.x - info.block.x, D2.y - info.block.y) <= D2.st.reach + 0.3 && Math.abs(D2.z - info.block.z) < 1.6) link('dugan', X, 'spear', '盾と槍');
        }
        if (X !== 'mel' && has('mel')) {
          const M = has('mel'), b = has(X);
          if (Math.hypot(M.x - b.x, M.y - b.y) <= M.st.range) link('mel', X, 'heal', '支える手');
        }
      }
      if (info.gateD && has('ruu') && covers('ruu', r, info.gateD - 2.0, info.gateD)) link('ruu', 'gate', 'gate', '門前の火');
    }
    if (has('kai') && has('ruu') && wave.groups.some((g) => g.e === 'archer')) {
      const R0 = has('ruu');
      let ok = false;
      for (const r of act) {
        const R = S.routes[r];
        if (R.fly) continue;
        for (let d = 0; d <= R.len && !ok; d += 0.25) {
          const p = R.at(d);
          const dist = Math.hypot(p.x - R0.x, p.y - R0.y);
          if (dist <= D.ENEMIES.archer.ranged && dist >= D.ENEMIES.archer.ranged - 1.2 && covers('kai', r, d - 0.3, d + 0.3)) ok = true;
        }
      }
      if (ok) link('kai', 'ruu', 'cover', '先に射抜く');
    }
    return out;
  };

  S.D = D;
  root.K20S = S;
})(typeof window !== 'undefined' ? window : globalThis);
