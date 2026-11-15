/*
 * ひゅるり、凧びより ― ルールの核（描画なし。node からも動く）
 *   つむじ（S = 大きさ cm）が うごき、じぶん以下の大きさのものを まきこんで 育つ。
 *   まきこんだものは まわりを まわり、ドンで なげると かたいものを こわせる。
 */
(function (root) {
  'use strict';
  const TJ = root.TJ = root.TJ || {};
  const TY = TJ.TYPES;
  const SPEED = 3.3;          // 1秒に S の何倍 すすめるか
  const PULL = 0.72;          // まきこむ はんい（S に対する 半径）
  const BLAST_R = 2.1;        // ドンの とどく はんい（S に対する 半径）
  const MAX_ORBIT = 64;
  // ちいさいうちは すいこみを すこし ひろく（60cm までに ふつうに もどる）
  const pullK = (S) => PULL + 0.15 * TJ.clamp((60 - S) / 55, 0, 1);

  class Sim {
    constructor(save) {
      this.W = TJ.buildWorld();
      const W = this.W;
      this.byId = new Map();
      for (const o of W.objs) this.byId.set(o.id, o);
      this.wind = { x: 0, y: 0.55 * 100, vx: 0, vy: 0, S: 5, face: 0, bump: 0, spin: 0, snow: 0, inSolid: false };
      this.Sref = 5;
      this.orbit = [];
      this.flying = [];
      this.dissolving = [];
      this.dropped = [];
      this.pending = [];
      this.blastCd = 0;
      this.blastT = 9;
      this.combo = { n: 0, t: 0 };
      this.events = [];
      this.kiteIdx = 0;
      this.time = 0;
      this.absorbed = new Set();
      this.broken = new Set();
      this.found = new Set();
      this.tre = new Set();
      this.unlocked = new Set();
      this.remain = {};
      this.count = 0;
      this.boss = { st: 'none', x: 0, y: 0, r: 2600, hp: 7, maxhp: 7, t: 0, tx: 0, ty: 0, hitT: 0, shed: 0 };
      this.ending = false;
      this.hardT = 0;
      this.heavyT = 0;
      this.nextOrbitSeed = 1;
      this.ORng = TJ.rng(777);
      for (const o of W.objs) this.remain[o.t] = (this.remain[o.t] || 0) + 1;
      this.solidObjs = W.objs.filter(o => o.solid);
      // villager の 立ち位置を みちの上に ちらす
      const R = TJ.rng(99);
      for (const c of W.creatures) {
        if (c.kind === 'villager') {
          const a = c.path[c.seg], b = c.path[(c.seg + 1) % c.path.length];
          const f = R.range(0.05, 0.95);
          c.x = a[0] + (b[0] - a[0]) * f; c.y = a[1] + (b[1] - a[1]) * f;
        }
      }
      for (const t in W.typeMin) if (W.typeMin[t] <= this.wind.S) this.unlocked.add(t);
      if (save) this.load(save);
    }

    emit(type, data) { this.events.push(Object.assign({ type }, data || {})); }

    // ── ゾーン（いる場所）
    zoneAt(x, y) {
      const Yd = this.W.yard;
      if (x > Yd.x0 && x < Yd.x1 && y > Yd.y0 && y < Yd.y1) return 1;
      for (const z of this.W.zones) if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z.z;
      return 2;
    }

    canLift(o) { return o.s <= this.wind.S; }

    inAny(x, y) {
      for (const z of this.W.zones) if (x > z.x0 && x < z.x1 && y > z.y0 && y < z.y1) return true;
      return false;
    }
    // 円（中心と上下左右）が あそべる範囲の 和の中に あるか（となりあう四角の さかいめでも とおれる）
    inPlay(x, y, pad) {
      return this.inAny(x, y) && this.inAny(x - pad, y) && this.inAny(x + pad, y) && this.inAny(x, y - pad) && this.inAny(x, y + pad);
    }

    // ── 1ステップ
    step(dt, inp) {
      inp = inp || {};
      this.events.length = 0;
      if (this.ending) { this.updateKites(dt); return; }
      this.time += dt;
      const w = this.wind;
      const S = w.S;
      // うごき
      let dx = 0, dy = 0, f = 0;
      if (inp.kx || inp.ky) {
        const l = Math.hypot(inp.kx, inp.ky);
        dx = inp.kx / l; dy = inp.ky / l; f = 1;
      } else if (inp.tx !== undefined && inp.tx !== null) {
        const ddx = inp.tx - w.x, ddy = inp.ty - w.y;
        const d = Math.hypot(ddx, ddy);
        const px = d * (inp.pxPerCm || (76 / S));
        if (d > 0.0001) { dx = ddx / d; dy = ddy / d; }
        f = TJ.clamp((px - 6) / 150, 0, 1);
      }
      const slow = w.snow > 0 ? 0.62 : 1;
      const heavy = S > 100 ? Math.pow(S / 100, -0.06) : 1; // 大きいほど どっしり
      const vmax = SPEED * S * slow * heavy;
      const tvx = dx * vmax * f, tvy = dy * vmax * f;
      const k = Math.min(1, dt * 7);
      w.vx += (tvx - w.vx) * k; w.vy += (tvy - w.vy) * k;
      this.moveWind(dt);
      w.spin += dt * (6 + Math.hypot(w.vx, w.vy) / Math.max(1, S) * 0.8);
      if (w.bump > 0) w.bump -= dt;
      if (w.face > 0) w.face -= dt;

      this.updateObjs(dt);
      this.updateFlying(dt);
      this.updateOrbit(dt);
      this.updateDropped(dt);
      this.updateTrees(dt);
      this.updateCreatures(dt);
      this.updateKites(dt);
      this.updateBoss(dt);

      // ドン
      if (this.blastCd > 0) this.blastCd -= dt;
      this.blastT += dt;
      if (inp.blast) this.blast();
      this.updatePending(dt);

      if (this.combo.t > 0) { this.combo.t -= dt; if (this.combo.t <= 0) { if (this.combo.n >= 8) this.emit('comboEnd', { n: this.combo.n }); this.combo.n = 0; } }
      if (this.hardT > 0) this.hardT -= dt;
      if (this.heavyT > 0) this.heavyT -= dt;
    }

    moveWind(dt) {
      const w = this.wind;
      const S = w.S;
      const rc = S * 0.3;
      let nx = w.x + w.vx * dt, ny = w.y + w.vy * dt;
      // あそべる範囲
      if (!this.inPlay(nx, ny, rc)) {
        if (this.inPlay(nx, w.y, rc)) { ny = w.y; w.vy *= 0.3; }
        else if (this.inPlay(w.x, ny, rc)) { nx = w.x; w.vx *= 0.3; }
        else { nx = w.x; ny = w.y; w.vx *= 0.3; w.vy *= 0.3; }
      }
      // かたいもの
      let pushed = 0, pusher = null, pmax = 0;
      const solidList = this.activeSolids();
      for (let it = 0; it < 2; it++) {
        for (const s of solidList) {
          if (s.shape === 'rect') {
            const cx = TJ.clamp(nx, s.x0, s.x1), cy = TJ.clamp(ny, s.y0, s.y1);
            const ddx = nx - cx, ddy = ny - cy;
            const d2 = ddx * ddx + ddy * ddy;
            if (d2 < rc * rc) {
              if (d2 > 0.0001) {
                const d = Math.sqrt(d2);
                nx = cx + ddx / d * rc; ny = cy + ddy / d * rc;
                pushed += rc - d;
                if (rc - d > pmax) { pmax = rc - d; pusher = s; }
              } else {
                // 中に入りこんだ：いちばん近い辺へ
                const l = nx - s.x0, r = s.x1 - nx, t = ny - s.y0, b = s.y1 - ny;
                const m = Math.min(l, r, t, b);
                if (m === l) nx = s.x0 - rc; else if (m === r) nx = s.x1 + rc; else if (m === t) ny = s.y0 - rc; else ny = s.y1 + rc;
                pushed += rc;
              }
            }
          } else {
            const ddx = nx - s.x, ddy = ny - s.y;
            const d = Math.hypot(ddx, ddy);
            const rr = s.r + rc;
            if (d < rr) {
              if (d > 0.0001) { nx = s.x + ddx / d * rr; ny = s.y + ddy / d * rr; }
              else nx = s.x + rr;
              pushed += rr - d;
              if (rr - d > pmax) { pmax = rr - d; pusher = s; }
            }
          }
        }
      }
      if (!this.inPlay(nx, ny, rc * 0.5)) { nx = w.x; ny = w.y; }
      if (pushed > rc * 0.08) {
        const sp = Math.hypot(w.vx, w.vy);
        if (sp > S * 1.2 && w.bump <= 0) { w.bump = 0.45; this.emit('bump', {}); }
      }
      if (this.wallT > 0) this.wallT -= dt;
      if (pusher && pmax > rc * 0.05 && isFinite(pusher.pass) && !(this.wallT > 0)) { this.wallT = 2.2; this.emit('wall', { pass: pusher.pass, draw: pusher.draw }); }
      w.vx = (nx - w.x) / dt * 0.999 || 0; w.vy = (ny - w.y) / dt * 0.999 || 0;
      // 速度が ずれすぎないように（押しもどされた分だけ 落とす）
      w.x = nx; w.y = ny;
    }

    activeSolids() {
      const S = this.wind.S;
      const out = [];
      const w = this.wind;
      const near = S * 4 + 2000;
      for (const s of this.W.solids) {
        if (s.pass <= S) continue;
        if (s.shape === 'rect') { if (w.x < s.x0 - near || w.x > s.x1 + near || w.y < s.y0 - near || w.y > s.y1 + near) continue; }
        else if (Math.abs(w.x - s.x) > near + s.r || Math.abs(w.y - s.y) > near + s.r) continue;
        out.push(s);
      }
      for (const o of this.solidObjs) {
        if (o.st === 0 && o.s > S) out.push(o.solidRect || (o.solidRect = Object.assign({ shape: 'rect' }, o.solid)));
      }
      return out;
    }

    // ── 地面のもの
    updateObjs(dt) {
      const w = this.wind, S = w.S;
      const pull = S * pullK(S);
      const near = pull * 1.6 + S;
      for (const o of this.W.objs) {
        if (o.st !== 0) continue;
        if (o.drift) {
          o.x += o.drift.vx * dt; o.y += o.drift.vy * dt;
          const kb = this.W.kiriBox;
          if (o.x < kb.x0) o.drift.vx = Math.abs(o.drift.vx);
          if (o.x > kb.x1) o.drift.vx = -Math.abs(o.drift.vx);
          if (o.y < kb.y0) o.drift.vy = Math.abs(o.drift.vy);
          if (o.y > kb.y1) o.drift.vy = -Math.abs(o.drift.vy);
        }
        if (o.pop) {
          o.pop.t += dt;
          const p = o.pop;
          const u = Math.min(1, p.t / p.dur);
          o.x = p.x0 + (p.x1 - p.x0) * TJ.easeOut(u);
          o.y = p.y0 + (p.y1 - p.y0) * TJ.easeOut(u);
          o.z = p.h0 * (1 - u) + Math.sin(u * Math.PI) * p.arc;
          if (u >= 1) { o.pop = null; o.z = 0; o.land = 0.12; }
          continue;
        }
        if (o.land > 0) { o.land -= dt; continue; }
        if (o.wob > 0) o.wob -= dt;
        const dx = o.x - w.x, dy = o.y - w.y;
        const lim = near + o.s;
        if (dx > lim || dx < -lim || dy > lim || dy < -lim) continue;
        const d = Math.hypot(dx, dy);
        if (o.s <= S) {
          if (d < pull + o.s * 0.25) this.startFly(o, d);
          else if (d < pull * 1.55 + o.s * 0.3) {
            // すいよせられる（まだ 届かない）
            const sp = S * 0.55 * dt * (1 - (d - pull) / (pull * 0.55 + o.s * 0.3));
            if (d > 0.001) { o.x -= dx / d * sp; o.y -= dy / d * sp; }
            o.wob = Math.max(o.wob || 0, 0.08);
          }
        } else if (d < S * 0.55 + o.s * 0.45) {
          if (!(o.wob > 0.05)) {
            if (this.heavyT <= 0) { this.heavyT = 0.9; this.emit('heavy', { o }); }
          }
          o.wob = 0.3;
        }
      }
    }

    startFly(o, d) {
      const w = this.wind;
      o.st = 1;
      const a0 = Math.atan2(o.y - w.y, o.x - w.x);
      this.flying.push({ o, t: 0, dur: 0.2 + 0.16 * Math.min(1, o.s / w.S), a0, d0: d, z0: o.z || 0 });
    }

    updateFlying(dt) {
      const w = this.wind;
      for (let i = this.flying.length - 1; i >= 0; i--) {
        const f = this.flying[i];
        f.t += dt;
        if (f.t >= f.dur) {
          this.flying.splice(i, 1);
          this.absorb(f.o, f.a0 + 3.2);
        }
      }
    }

    absorb(o, ang) {
      const w = this.wind;
      const ty = TY[o.t];
      if (o.st !== 2) { o.st = 2; this.remain[o.t] = (this.remain[o.t] || 1) - 1; }
      this.absorbed.add(o.id);
      const before = w.S;
      const gain = TJ.GROW * TJ.ZONE_MUL[ty.z] * ty.w * o.s * o.s;
      w.S = Math.sqrt(w.S * w.S + gain);
      this.count++;
      this.combo.n++; this.combo.t = 0.75;
      const rel = o.s / before;
      const isNew = !this.found.has(o.t);
      this.found.add(o.t);
      if (ty.k === 'tre') this.tre.add(o.t);
      this.addOrbit(o.t, o.v, o.s, ang, rel);
      this.emit('pop', { t: o.t, s: o.s, rel, combo: this.combo.n, isNew, tre: ty.k === 'tre', x: o.x, y: o.y });
      w.face = Math.max(w.face, rel > 0.55 ? 0.6 : 0.25);
      // まるごと まきこんだ入れものの なかみ
      if (o.content && !this.absorbed.has(TJ.pieceId(o.id, 31))) {
        const c = { id: TJ.pieceId(o.id, 31), t: o.content, x: o.x, y: o.y, s: TY[o.content].s, v: 0, st: 2 };
        this.absorbed.add(c.id);
        this.byId.set(c.id, c);
        this.found.add(c.t); this.tre.add(c.t);
        this.addOrbit(c.t, 0, c.s, ang + 1, c.s / w.S);
        this.emit('pop', { t: c.t, s: c.s, rel: c.s / w.S, combo: this.combo.n, isNew: true, tre: true, x: o.x, y: o.y });
      }
      this.checkGrow();
    }

    checkGrow() {
      const S = this.wind.S;
      if (S >= this.Sref * 1.3) {
        this.Sref = S;
        this.emit('grow', { S });
      }
      const fresh = [];
      for (const t in this.W.typeMin) {
        if (this.unlocked.has(t)) continue;
        if (this.W.typeMin[t] <= S) {
          this.unlocked.add(t);
          if ((this.remain[t] || 0) > 0 && TY[t].k !== 'tre') fresh.push(t);
        }
      }
      if (fresh.length) this.emit('unlock', { types: fresh });
    }

    addOrbit(t, v, s, ang, rel) {
      const R = this.ORng;
      const it = {
        t, v, s,
        a: ang !== undefined ? ang : R() * 6.283,
        rr: 0.2 + R() * 0.32 + Math.min(0.12, rel * 0.1),
        hh: 0.12 + R() * 0.95,
        w: (2.3 + R() * 1.4) * (rel > 0.5 ? 0.75 : 1),
        spin: R() * 6.28, sp: (R() - 0.5) * 9,
        born: 0, out: null
      };
      this.orbit.push(it);
      if (this.orbit.length > MAX_ORBIT) {
        // いちばん ちいさいものを ほどく（絵の上だけ。育ちは そのまま）
        let mi = -1, ms = Infinity;
        for (let i = 0; i < this.orbit.length - 1; i++) { const o = this.orbit[i]; if (!o.out && o.s < ms) { ms = o.s; mi = i; } }
        if (mi >= 0) this.dissolving.push(Object.assign(this.orbit.splice(mi, 1)[0], { fade: 0 }));
      }
    }

    updateOrbit(dt) {
      const S = this.wind.S;
      for (let i = this.orbit.length - 1; i >= 0; i--) {
        const it = this.orbit[i];
        it.a += it.w * dt;
        it.spin += it.sp * dt;
        it.born += dt;
        if (it.out) {
          it.out.t += dt;
          if (it.out.t >= it.out.dur) it.out = null;
        } else if (it.s < S * 0.035 && this.orbit.length > 14 && i === 0) {
          this.dissolving.push(Object.assign(this.orbit.splice(i, 1)[0], { fade: 0 }));
        }
      }
      for (let i = this.dissolving.length - 1; i >= 0; i--) {
        const d = this.dissolving[i];
        d.fade += dt * 2.2; d.a += d.w * dt;
        if (d.fade >= 1) this.dissolving.splice(i, 1);
      }
    }

    orbitReady() { let n = 0; for (const it of this.orbit) if (!it.out) n++; return n; }

    // ── ドン
    blast() {
      if (this.blastCd > 0) return;
      const w = this.wind, S = w.S;
      const ready = this.orbitReady();
      if (ready === 0) { this.blastCd = 0.35; this.emit('blastEmpty', {}); return; }
      this.blastCd = 0.8;
      this.blastT = 0;
      const R = S * BLAST_R;
      for (const it of this.orbit) {
        if (it.out) continue;
        it.out = { t: 0, dur: 0.72, dist: R * (0.75 + this.ORng() * 0.35) };
      }
      let hits = 0;
      for (const o of this.W.objs) {
        if (o.st !== 0 || o.pop) continue;
        const ty = TY[o.t];
        if (ty.k !== 'break') continue;
        const ext = o.solid ? Math.max(o.solid.x1 - o.solid.x0, o.solid.y1 - o.solid.y0) * 0.5 : o.s * 0.45;
        const d = Math.hypot(o.x - w.x, o.y - w.y);
        if (d < R + ext) {
          this.pending.push({ at: 0.06 + 0.14 * Math.min(1, d / R), kind: 'hit', o });
          hits++;
        }
      }
      for (const tr of this.W.trees) {
        if (!tr.fruit) continue;
        const d = Math.hypot(tr.x - w.x, tr.y - w.y);
        if (d < R + tr.crown * 0.6) { this.pending.push({ at: 0.1, kind: 'tree', tr }); hits++; }
      }
      for (const c of this.W.creatures) {
        const cx = c.x, cy = c.y;
        if (cx === undefined) continue;
        const d = Math.hypot(cx - w.x, cy - w.y);
        if ((c.kind === 'crow' || c.kind === 'tobi') && c.item && c.st === 'circle') {
          if (d < R + c.s + (c.h || 0) * 0.3) { this.pending.push({ at: 0.12, kind: 'bird', c }); hits++; }
        } else if (d < R + c.s) {
          c.startle = 1;
        }
      }
      const B = this.boss;
      if (B.st === 'fight') {
        const d = Math.hypot(B.x - w.x, B.y - w.y);
        if (d < R + B.r * 0.55) { this.pending.push({ at: 0.15, kind: 'boss' }); hits++; }
      }
      this.emit('blast', { S, hits, R });
    }

    updatePending(dt) {
      for (let i = this.pending.length - 1; i >= 0; i--) {
        const p = this.pending[i];
        p.at -= dt;
        if (p.at > 0) continue;
        this.pending.splice(i, 1);
        if (p.kind === 'hit') this.hitObj(p.o);
        else if (p.kind === 'tree') this.shakeTree(p.tr);
        else if (p.kind === 'bird') this.hitBird(p.c);
        else if (p.kind === 'boss') this.hitBoss();
      }
    }

    hitObj(o) {
      if (o.st !== 0) return;
      const ty = TY[o.t];
      const S = this.wind.S;
      if (S < ty.min) {
        o.wob = 0.35;
        if (this.hardT <= 0) { this.hardT = 1.2; this.emit('hard', { o, need: ty.min }); }
        else this.emit('hit', { o, dmg: 0 });
        return;
      }
      const dmg = Math.max(1, Math.floor(S / ty.min));
      o.hp -= dmg;
      o.wob = 0.4;
      o.crackT = 0.3;
      if (o.hp <= 0) this.breakObj(o);
      else this.emit('hit', { o, dmg });
    }

    breakObj(o) {
      const ty = TY[o.t];
      o.st = 3;
      this.remain[o.t] = (this.remain[o.t] || 1) - 1;
      this.broken.add(o.id);
      this.found.add(o.t);
      const pieces = this.spawnPieces(o, false);
      this.emit('break', { o, n: pieces.length, tre: !!o.content });
    }

    spawnPieces(o, landed) {
      const ty = TY[o.t];
      const R = TJ.rng(o.id * 7919 + 13);
      const list = [];
      let k = 0;
      const spread = Math.max(o.s * 0.75, (o.solid ? (o.solid.x1 - o.solid.x0) : 0));
      const add = (t, isTre) => {
        const id = isTre ? TJ.pieceId(o.id, 31) : TJ.pieceId(o.id, k++);
        const a = R.range(0, Math.PI * 2);
        const dd = R.range(0.25, 1) * spread * (isTre ? 0.5 : 1) + TY[t].s * 0.3;
        let x1 = o.x + Math.cos(a) * dd, y1 = o.y + Math.sin(a) * dd * 0.8;
        if (o.solid) {
          // もんや さくの こわれた板は 内がわ と 外がわに ちる
          if (o.solid.x1 - o.solid.x0 < o.solid.y1 - o.solid.y0) { x1 = o.x + (R() < 0.5 ? -1 : 1) * R.range(0.5, 1.4) * spread * 0.4; }
          else { y1 = o.y + (R() < 0.5 ? -1 : 1) * R.range(0.5, 1.4) * spread * 0.4; }
        }
        if (!this.inPlay(x1, y1, TY[t].s * 0.3)) { x1 = o.x; y1 = o.y; }
        const p = {
          id, t, x: o.x, y: o.y, s: TY[t].s * R.range(0.9, 1.1), rot: R.range(0, 6.28), v: R.int(0, TY[t].v - 1), st: 0,
          pop: landed ? null : { t: 0, dur: R.range(0.45, 0.7), x0: o.x, y0: o.y, x1, y1, h0: o.s * 0.3, arc: o.s * R.range(0.4, 0.8) }
        };
        if (landed) { p.x = x1; p.y = y1; }
        this.addSpawned(p);
        list.push(p);
      };
      for (const [t, n] of ty.drops) for (let i = 0; i < n; i++) add(t, false);
      if (o.content) add(o.content, true);
      return list;
    }

    addSpawned(p) {
      if (this.absorbed.has(p.id)) { p.st = 2; this.byId.set(p.id, p); return; }
      this.W.objs.push(p);
      this.byId.set(p.id, p);
      this.remain[p.t] = (this.remain[p.t] || 0) + 1;
      if (this.W.typeMin[p.t] === undefined || p.s < this.W.typeMin[p.t]) this.W.typeMin[p.t] = p.s;
    }

    // ── 木
    shakeTree(tr, quiet) {
      tr.shake = 0.6;
      const R = TJ.rng(tr.id * 131 + tr.dropped * 17 + 5);
      const n = Math.min(3, tr.fruitN - tr.dropped);
      const out = [];
      const S = this.wind.S;
      const fall = (t, id) => {
        const a = R.range(0, Math.PI * 2), d = R.range(0.2, 0.9) * tr.crown;
        const x1 = tr.x + Math.cos(a) * d, y1 = tr.y + Math.sin(a) * d * 0.7 + tr.crown * 0.1;
        const p = { id, t, x: x1, y: y1 - tr.crown * 1.2, s: TY[t].s * R.range(0.9, 1.1), rot: R.range(0, 6.28), v: 0, st: 0,
          pop: { t: 0, dur: R.range(0.5, 0.8), x0: x1, y0: y1, x1, y1, h0: tr.crown * 1.3, arc: 0 } };
        this.addSpawned(p);
        out.push(p);
      };
      for (let i = 0; i < n; i++) { fall(tr.fruit, TJ.fruitId(tr.id, tr.dropped)); tr.dropped++; }
      if (tr.tre && !tr.treDone) { tr.treDone = true; fall(tr.tre, TJ.fruitId(tr.id, 31)); }
      if (!quiet) this.emit('tree', { tr, n: out.length });
      return out;
    }
    updateTrees(dt) { for (const tr of this.W.trees) if (tr.shake > 0) tr.shake -= dt; }

    // ── とり
    hitBird(c) {
      if (!c.item) return;
      const t = c.item;
      c.item = null;
      c.st = 'flee'; c.t = 0;
      const id = TJ.birdItemId(this.W.creatures.indexOf(c));
      const p = { id, t, x: c.x, y: c.y, s: TY[t].s, rot: 0, v: 0, st: 0, pop: { t: 0, dur: 0.8, x0: c.x, y0: c.y, x1: c.x, y1: c.y, h0: c.h, arc: 0 } };
      this.addSpawned(p);
      this.emit('caw', { c, drop: true });
    }

    updateCreatures(dt) {
      const w = this.wind, S = w.S;
      for (let ci = 0; ci < this.W.creatures.length; ci++) {
        const c = this.W.creatures[ci];
        const startle = c.startle; c.startle = 0;
        if (c.kind === 'cat') {
          c.t += dt;
          const d = Math.hypot(c.x - w.x, c.y - w.y);
          if (c.st === 'sleep') {
            if (S < 300 && (d < S * 0.9 + 45 || startle)) {
              let best = c.spots[0], bd = -1;
              for (const p of c.spots) { const dd = Math.hypot(p[0] - w.x, p[1] - w.y); if (dd > bd) { bd = dd; best = p; } }
              c.st = 'run'; c.tx = best[0]; c.ty = best[1]; c.t = 0;
              this.emit('meow', { c });
            }
          } else {
            const dx = c.tx - c.x, dy = c.ty - c.y, dd = Math.hypot(dx, dy);
            const sp = 160 * dt;
            c.face = dx < 0 ? -1 : 1;
            if (dd < sp) { c.x = c.tx; c.y = c.ty; c.st = 'sleep'; c.t = 0; }
            else { c.x += dx / dd * sp; c.y += dy / dd * sp; }
          }
        } else if (c.kind === 'chicken' || c.kind === 'duck') {
          c.t -= dt;
          const d = Math.hypot(c.x - w.x, c.y - w.y);
          const scare = S < 600 && d < S * 1.3 + 40;
          if (scare || startle) {
            const a = Math.atan2(c.y - w.y, c.x - w.x);
            c.dir = a; c.run = 0.6;
            if (!c.flap || c.flap <= 0) { c.flap = 0.8; if (c.kind === 'chicken' && d < S * 2 + 200) this.emit('cluck', { c }); }
          }
          if (c.flap > 0) c.flap -= dt;
          if (c.run > 0) c.run -= dt;
          if (c.t <= 0) { c.t = 1 + Math.random() * 2; if (!(c.run > 0)) c.dir += (Math.random() - 0.5) * 2.4; c.idle = Math.random() < 0.35; }
          const sp = (c.run > 0 ? 220 : (c.idle ? 0 : 40)) * dt;
          let nx = c.x + Math.cos(c.dir) * sp, ny = c.y + Math.sin(c.dir) * sp;
          const box = c.kind === 'chicken' ? c.home : { x0: this.W.river.x0 + 200, y0: this.W.river.y0 + 500, x1: this.W.river.x1 - 200, y1: this.W.river.y1 - 500 };
          if (nx < box.x0 || nx > box.x1) { c.dir = Math.PI - c.dir; nx = TJ.clamp(nx, box.x0, box.x1); }
          if (ny < box.y0 || ny > box.y1) { c.dir = -c.dir; ny = TJ.clamp(ny, box.y0, box.y1); }
          c.face = Math.cos(c.dir) < 0 ? -1 : 1;
          c.x = nx; c.y = ny;
        } else if (c.kind === 'crow' || c.kind === 'tobi') {
          if (c.st === 'circle') {
            c.ang += c.spd * dt;
            c.x = c.cx + Math.cos(c.ang) * c.rad;
            c.y = c.cy + Math.sin(c.ang) * c.rad * 0.75;
            c.face = -Math.sin(c.ang) * Math.sign(c.spd) < 0 ? -1 : 1;
          } else {
            c.t += dt;
            const fx = c.cx + (c.rad * 6), fy = c.cy - c.rad * 4;
            if (c.t < 5) { c.x += (fx - c.x) * dt * 0.7; c.y += (fy - c.y) * dt * 0.7; c.face = 1; }
            else {
              const tx = c.cx + Math.cos(c.ang) * c.rad, ty = c.cy + Math.sin(c.ang) * c.rad * 0.75;
              c.x += (tx - c.x) * dt * 1.2; c.y += (ty - c.y) * dt * 1.2; c.face = -1;
              if (Math.hypot(tx - c.x, ty - c.y) < c.rad * 0.1) c.st = 'circle';
            }
          }
        } else if (c.kind === 'villager') {
          if (c.react > 0) { c.react -= dt; continue; }
          const b = c.path[(c.seg + 1) % c.path.length];
          const dx = b[0] - c.x, dy = b[1] - c.y, dd = Math.hypot(dx, dy);
          const sp = c.spd * dt;
          if (dd < sp) { c.seg = (c.seg + 1) % c.path.length; }
          else { c.x += dx / dd * sp; c.y += dy / dd * sp; c.face = dx < 0 ? -1 : 1; }
          c.t += dt;
          if (c.item && TY[c.item].s <= S) {
            const d = Math.hypot(c.x - w.x, c.y - w.y);
            if (d < S * PULL + 60) {
              const id = TJ.hatId(ci);
              const it = { id, t: c.item, x: c.x, y: c.y, s: TY[c.item].s, v: c.iv, st: 1, z: c.s };
              c.item = null; c.react = 1.6;
              this.byId.set(id, it);
              this.remain[it.t] = (this.remain[it.t] || 0) + 1;
              this.startFly(it, d);
              this.emit('hat', { c, t: it.t });
            }
          }
        }
      }
    }

    // ── 凧
    updateKites(dt) {
      const w = this.wind;
      for (const k of this.W.kites) {
        if (k.st === 1) k.t += dt;
      }
      if (this.ending) return;
      const k = this.W.kites[this.kiteIdx];
      if (!k || k.st !== 0) return;
      const d = Math.hypot(k.x - w.x, k.y - w.y);
      if (d < w.S * 0.65 + k.s * 0.35) {
        if (w.S >= k.req) {
          if (this.kiteIdx === 4 && this.boss.st !== 'gone') { if (!this.kiteBlockT || this.kiteBlockT < this.time) { this.kiteBlockT = this.time + 3; this.emit('kiteBlocked', {}); } return; }
          k.st = 1; k.t = 0;
          this.kiteIdx++;
          this.emit('kite', { k, i: k.i });
          if (k.i === 4) { this.ending = true; this.emit('ending', {}); }
        } else if (!this.kiteNearT || this.kiteNearT < this.time) {
          this.kiteNearT = this.time + 4;
          this.emit('kiteSmall', { k });
        }
      }
    }

    // ── ねぼすけ ゆきぐも
    updateBoss(dt) {
      const B = this.boss, w = this.wind;
      if (B.st === 'none') {
        const F = this.W.fest;
        if (this.kiteIdx >= 4 && w.x > F.trigX) {
          B.st = 'enter'; B.t = 0; B.x = F.cx; B.y = F.spawnY;
          this.emit('bossEnter', {});
        }
        w.snow = 0;
        return;
      }
      if (B.st === 'gone') { w.snow = 0; return; }
      B.t += dt;
      if (B.hitT > 0) B.hitT -= dt;
      if (B.st === 'enter') {
        B.y += (this.W.fest.enterY - B.y) * dt * 0.8;
        if (B.t > 3.2) { B.st = 'fight'; B.t = 0; this.pickBossTarget(); }
      } else if (B.st === 'fight') {
        const dx = B.tx - B.x, dy = B.ty - B.y, d = Math.hypot(dx, dy);
        const sp = 650 * dt * (B.hitT > 0 ? 0.2 : 1);
        if (d < sp || B.t > 7) { this.pickBossTarget(); B.t = 0; }
        else { B.x += dx / d * sp; B.y += dy / d * sp; }
      } else if (B.st === 'down') {
        if (B.t > 1.2) { B.st = 'gone'; this.emit('skyClear', {}); }
      }
      // ゆき
      const din = Math.hypot(w.x - B.x, w.y - B.y);
      if (B.st === 'fight' && din < B.r) {
        w.snow += dt;
        B.freezeT = (B.freezeT || 0) + dt;
        if (B.freezeT > 0.45) { B.freezeT = 0; this.freezeOne(); }
      } else { w.snow = 0; B.freezeT = 0; }
    }
    pickBossTarget() {
      const B = this.boss, w = this.wind;
      const R = this.ORng;
      // ひろばの中を ゆっくり。ときどき つむじの ほうへ 寄ってくる
      const F = this.W.fest;
      if (R() < 0.45) { B.tx = TJ.clamp(w.x, F.x0, F.x1); B.ty = TJ.clamp(w.y, F.y0, F.y1); }
      else { B.tx = R.range(F.x0, F.x1); B.ty = R.range(F.y0, F.y1); }
    }
    freezeOne() {
      let idx = -1;
      for (let i = this.orbit.length - 1; i >= 0; i--) if (!this.orbit[i].out) { idx = i; break; }
      if (idx < 0) return;
      const it = this.orbit.splice(idx, 1)[0];
      const w = this.wind;
      const a = it.a;
      const x = w.x + Math.cos(a) * w.S * it.rr * 1.3, y = w.y + Math.sin(a) * w.S * it.rr;
      this.dropped.push({ t: it.t, v: it.v, s: it.s, x, y, z: w.S * it.hh, vz: 0, frozen: 2.2, rot: it.spin });
      this.emit('freeze', {});
    }
    updateDropped(dt) {
      const w = this.wind, S = w.S;
      for (let i = this.dropped.length - 1; i >= 0; i--) {
        const d = this.dropped[i];
        if (d.z > 0) { d.vz -= 2000 * dt * Math.max(1, S / 400); d.z = Math.max(0, d.z + d.vz * dt); }
        if (d.frozen > 0) { d.frozen -= dt; continue; }
        if (Math.hypot(d.x - w.x, d.y - w.y) < S * pullK(S) + d.s * 0.3 && w.snow <= 0) {
          this.dropped.splice(i, 1);
          this.addOrbit(d.t, d.v, d.s, Math.atan2(d.y - w.y, d.x - w.x), d.s / S);
          this.emit('regain', {});
        }
      }
    }
    hitBoss() {
      const B = this.boss;
      if (B.st !== 'fight') return;
      B.hp--; B.hitT = 0.9;
      const shed = B.hp <= 0 ? 12 : 2;
      const R = TJ.rng(4242 + B.shed * 31);
      for (let i = 0; i < shed; i++) {
        const id = TJ.cloudId(B.shed++);
        const a = R.range(0, 6.283), d = R.range(0.3, 1) * B.r;
        const kb = this.W.kiriBox;
        const x1 = TJ.clamp(B.x + Math.cos(a) * d, kb.x0, kb.x1), y1 = TJ.clamp(B.y + Math.sin(a) * d * 0.8, kb.y0, kb.y1);
        this.addSpawned({ id, t: 'kumo', x: B.x, y: B.y, s: TY.kumo.s * R.range(0.75, 1.2), rot: 0, v: 0, st: 0, pop: { t: 0, dur: 0.9, x0: B.x, y0: B.y, x1, y1, h0: 1800, arc: 600 } });
      }
      if (B.hp <= 0) {
        B.st = 'down'; B.t = 0;
        this.addSpawned({ id: TJ.cloudId(99), t: 't_hoshi', x: B.x, y: B.y, s: TY.t_hoshi.s, rot: 0, v: 0, st: 0, pop: { t: 0, dur: 1.1, x0: B.x, y0: B.y, x1: B.x, y1: B.y + 600, h0: 2000, arc: 400 } });
        this.emit('bossDown', {});
      } else this.emit('bossHit', { hp: B.hp });
    }

    // ── たすけ：近くの まきこめるもの
    nearestLiftable(maxN) {
      const w = this.wind, S = w.S;
      const res = [];
      for (const o of this.W.objs) {
        if (o.st !== 0 || o.pop || o.s > S) continue;
        if (o.s < S * 0.02) continue;
        const d = Math.hypot(o.x - w.x, o.y - w.y);
        res.push({ o, d });
      }
      res.sort((a, b) => a.d - b.d);
      return res.slice(0, maxN || 3);
    }

    // ── 保存
    save() {
      const w = this.wind;
      return {
        v: 1,
        S: w.S, x: w.x, y: w.y, Sref: this.Sref,
        kite: this.kiteIdx, time: this.time, count: this.count,
        absorbed: Array.from(this.absorbed),
        broken: Array.from(this.broken),
        trees: this.W.trees.map(t => [t.dropped, t.treDone ? 1 : 0]),
        birds: this.W.creatures.map(c => (c.kind === 'crow' || c.kind === 'tobi') ? (c.item ? 1 : 0) : (c.kind === 'villager' ? (c.item ? 1 : 0) : -1)),
        boss: { st: this.boss.st === 'gone' || this.boss.st === 'down' ? 'gone' : 'none', shed: this.boss.shed },
        found: Array.from(this.found), tre: Array.from(this.tre),
        orbit: this.orbit.slice(-40).map(o => [o.t, o.v, Math.round(o.s * 10) / 10]),
        ending: this.ending ? 1 : 0
      };
    }

    load(sv) {
      const w = this.wind;
      w.S = sv.S; w.x = sv.x; w.y = sv.y; this.Sref = sv.Sref || sv.S;
      this.time = sv.time || 0; this.count = sv.count || 0;
      this.absorbed = new Set(sv.absorbed || []);
      for (const o of this.W.objs) if (this.absorbed.has(o.id)) { o.st = 2; this.remain[o.t]--; }
      for (const id of (sv.broken || [])) {
        const o = this.byId.get(id);
        if (!o) continue;
        if (o.st === 0) this.remain[o.t]--;
        o.st = 3; this.broken.add(id);
        this.spawnPieces(o, true);
      }
      (sv.trees || []).forEach((v, i) => {
        const tr = this.W.trees[i];
        if (!tr) return;
        const want = v[0], treDone = v[1];
        for (let k = 0; k < want; k++) {
          const R = TJ.rng(tr.id * 131 + k * 17 + 5);
          const a = R.range(0, Math.PI * 2), d = R.range(0.2, 0.9) * tr.crown;
          this.addSpawned({ id: TJ.fruitId(tr.id, k), t: tr.fruit, x: tr.x + Math.cos(a) * d, y: tr.y + Math.sin(a) * d * 0.7 + tr.crown * 0.1, s: TY[tr.fruit].s, rot: R.range(0, 6.28), v: 0, st: 0 });
        }
        tr.dropped = want;
        if (treDone) { tr.treDone = true; this.addSpawned({ id: TJ.fruitId(tr.id, 31), t: tr.tre, x: tr.x + tr.crown * 0.3, y: tr.y + tr.crown * 0.2, s: TY[tr.tre].s, rot: 0, v: 0, st: 0 }); }
      });
      (sv.birds || []).forEach((v, i) => {
        const c = this.W.creatures[i];
        if (!c || v !== 0) return;
        if (c.kind === 'crow' || c.kind === 'tobi') {
          const t = c.item; c.item = null;
          if (t) this.addSpawned({ id: TJ.birdItemId(i), t, x: c.cx, y: c.cy, s: TY[t].s, rot: 0, v: 0, st: 0 });
        } else if (c.kind === 'villager') c.item = null;
      });
      if (sv.boss) this.boss.shed = sv.boss.shed || 0;
      if (sv.boss && sv.boss.st === 'gone') {
        this.boss.st = 'gone';
        const B = this.boss;
        const n = sv.boss.shed || 0;
        for (let k = 0; k < n; k++) {
          const R = TJ.rng(9100 + k);
          const F = this.W.fest;
          this.addSpawned({ id: TJ.cloudId(k), t: 'kumo', x: R.range(F.x0, F.x1), y: R.range(F.y0, F.y1), s: TY.kumo.s, rot: 0, v: 0, st: 0 });
        }
        this.addSpawned({ id: TJ.cloudId(99), t: 't_hoshi', x: this.W.fest.cx, y: this.W.fest.cy - 2000, s: TY.t_hoshi.s, rot: 0, v: 0, st: 0 });
      }
      this.kiteIdx = sv.kite || 0;
      for (let i = 0; i < this.kiteIdx; i++) { this.W.kites[i].st = 1; this.W.kites[i].t = 30; }
      this.found = new Set(sv.found || []);
      this.tre = new Set(sv.tre || []);
      this.unlocked = new Set();
      for (const t in this.W.typeMin) if (this.W.typeMin[t] <= w.S) this.unlocked.add(t);
      for (const o of (sv.orbit || [])) this.addOrbit(o[0], o[1], o[2], undefined, o[2] / w.S);
    }
  }

  TJ.Sim = Sim;
  TJ.SIM_CONST = { SPEED, PULL, BLAST_R };
})(typeof window !== 'undefined' ? window : globalThis);
