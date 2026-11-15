/*
 * そこから、そら ― ルールの核（描画なし。node からも読み込める）
 *
 * 座標は「井戸の断面」基準：x 0..640（左右の端1マスずつが岩盤の壁）、y 0..720（下ほど大きい）。
 * 1/120 秒きざみの固定ステップで動く。入力は { tx, btn, ax, ay } だけ。
 *   tx      … カエルが向かう x
 *   btn     … ボタン（押しているあいだ、近づいた玉を舌でくわえる。くわえているときは はなすと吐き出す）
 *   ax, ay  … くわえているあいだの ねらいの点
 */
(function (root) {
  'use strict';

  const CELL = 32, COLS = 20, ROWS = 19;
  const W = COLS * CELL;              // 640
  const PAD_Y = 620;                  // カエルの頭のてっぺん（はね返す面）の高さ
  const WATER_Y = 660;                // 水面
  const BALL_R = 8;
  const DT = 1 / 120;
  const FROG_HALF = 54;               // はね返せる半幅
  const MOUTH_DY = -18;               // 口は頭のてっぺんより下
  const XL = CELL, XR = W - CELL;     // 内がわの壁
  const GRAV = 1500;

  const T = { EMPTY: 0, BED: 1, LID: 2, SOIL: 3, STONE: 4, HARD: 5, ORE: 6, BLAST: 7, TREAS: 8, MUD: 9, ANCHOR: 10, BODY: 11, BUMP: 12, ROOT: 13, POUCH: 14 };
  // hp: 耐久 / val: きらら（得点） / fixed: 動かない支え（岩盤など）
  const MAT = [];
  MAT[T.EMPTY] = { hp: 0, val: 0 };
  MAT[T.BED] = { hp: Infinity, val: 0, fixed: true };
  MAT[T.LID] = { hp: 3, val: 10, fixed: true };
  MAT[T.SOIL] = { hp: 1, val: 1 };
  MAT[T.STONE] = { hp: 2, val: 2 };
  MAT[T.HARD] = { hp: 4, val: 4 };
  MAT[T.ORE] = { hp: 2, val: 8 };
  MAT[T.BLAST] = { hp: 1, val: 3 };
  MAT[T.TREAS] = { hp: 2, val: 5 };
  MAT[T.MUD] = { hp: 1, val: 0 };
  MAT[T.ANCHOR] = { hp: 3, val: 6 };
  MAT[T.BODY] = { hp: Infinity, val: 0 };
  MAT[T.BUMP] = { hp: Infinity, val: 0, fixed: true };
  MAT[T.ROOT] = { hp: 1, val: 1 };
  MAT[T.POUCH] = { hp: 1, val: 4 };

  const CHAR = {
    '#': T.BED, '=': T.LID, '.': T.EMPTY, 'd': T.SOIL, 's': T.STONE, 'S': T.HARD, 'o': T.ORE,
    'x': T.BLAST, 't': T.TREAS, 'A': T.ANCHOR, 'G': T.BODY, 'O': T.BUMP, 'r': T.ROOT, 'p': T.POUCH,
    'b': T.EMPTY, 'm': T.EMPTY, 'w': T.EMPTY
  };

  // はずみ（続けてはね返した回数）の段階
  const MOM_LV1 = 3, MOM_LV2 = 6;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const breakable = (t) => t !== T.EMPTY && MAT[t].hp !== Infinity;

  // ------------------------------------------------------------------
  function World(level, opt) {
    opt = opt || {};
    this.level = level;
    this.rng = mulberry32(opt.seed || 20261115);
    this.t = 0;
    this.events = [];
    this.gems = 0;
    this.N = COLS * ROWS;
    this.g = new Uint8Array(this.N);
    this.hp = new Float32Array(this.N);
    this.item = new Int16Array(this.N).fill(-1);
    this.ver = 0;
    this.dirty = false;
    this.monsters = [];
    this.chunks = [];
    this.hazards = [];
    this.booms = [];
    this.found = [];
    this.lidHp = MAT[T.LID].hp;
    this.lidOpen = false;
    this.done = false;
    this.speed = level.speed || 440;
    this.mom = 0;          // はずみ
    this.flight = 0;       // 前にはね返してから こわした数（音の高さに使う）
    this.prevBtn = false;
    this.aim = -Math.PI / 2;
    this.idle = 0;         // 玉が何にも当たらずに飛んでいる時間
    this.stats = { pads: 0, misses: 0, catches: 0, broken: 0, collapses: 0, maxCollapse: 0, kills: 0, stuns: 0 };
    this.frog = { x: W / 2, stun: 0, slow: 0, tongue: 0 };
    this.guardian = null;
    this.fallingCache = { key: '', set: null };
    this.parse(level);
    this.balls = [this.newBall(true)];
    this.balls[0].state = 'held';
  }

  World.prototype.newBall = function (main) {
    return { x: this.frog.x, y: PAD_Y - MOUTH_DY - 8, vx: 0, vy: 0, state: 'free', t: 0, main: main, lastHit: -1, lastHitT: -1, boost: 0, life: main ? Infinity : 14, holdT: 0, trail: [] };
  };

  World.prototype.parse = function (level) {
    const map = level.map;
    if (map.length !== ROWS) throw new Error(level.id + ': rows ' + map.length);
    const items = (level.items || []).slice();
    const bodyCells = [], anchorCells = [];
    for (let r = 0; r < ROWS; r++) {
      const line = map[r];
      if (line.length !== COLS) throw new Error(level.id + ': row ' + r + ' has ' + line.length + ' cols');
      for (let c = 0; c < COLS; c++) {
        const ch = line[c];
        const t = CHAR[ch];
        if (t === undefined) throw new Error(level.id + ': bad char ' + ch);
        const i = r * COLS + c;
        this.g[i] = t;
        this.hp[i] = MAT[t].hp;
        if (t === T.TREAS) this.item[i] = items.length ? items.shift() : -1;
        if (t === T.BODY) bodyCells.push(i);
        if (t === T.ANCHOR) anchorCells.push(i);
        if (ch === 'b') this.addMonster('bat', c, r);
        if (ch === 'm') this.addMonster('grub', c, r);
        if (ch === 'w') this.addMonster('drip', c, r);
      }
    }
    if (level.guardian) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const i of bodyCells) {
        const c = i % COLS, r = (i / COLS) | 0;
        x0 = Math.min(x0, c * CELL); x1 = Math.max(x1, c * CELL + CELL);
        y0 = Math.min(y0, r * CELL); y1 = Math.max(y1, r * CELL + CELL);
      }
      this.guardian = {
        kind: level.guardian, body: bodyCells, anchors0: anchorCells.slice(), total: anchorCells.length,
        x0, y0, x1, y1, t: 0, atk: 3.5, regrow: 0, grow: 0, state: 'idle', st: 0, down: false, hitCD: 0, flinch: 0, regrown: 0
      };
    }
  };

  World.prototype.addMonster = function (kind, c, r) {
    const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
    const m = { kind, c, r, x, y, t: this.rng() * 2, state: 'sleep', dead: false, vx: 0, vy: 0, tx: x, ty: y, atk: 4 + this.rng() * 3, len: 40, face: 1 };
    if (kind === 'bat') { m.y = r * CELL + 12; m.state = 'sleep'; }
    if (kind === 'grub') { m.state = 'crawl'; m.atk = 3 + this.rng() * 2; m.move = 0.5; }
    if (kind === 'drip') { m.state = 'hang'; m.ay = r * CELL; m.len = 50 + this.rng() * 30; m.atk = 2 + this.rng() * 2; }
    this.monsters.push(m);
  };

  World.prototype.emit = function (e) { this.events.push(e); };
  World.prototype.idx = function (c, r) { return r * COLS + c; };
  World.prototype.cellAt = function (c, r) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
    return this.g[r * COLS + c];
  };
  World.prototype.solidAt = function (c, r) {
    if (c < 0 || c >= COLS) return true;
    if (r < 0) return false;
    if (r >= ROWS) return c === 0 || c === COLS - 1;
    return this.g[r * COLS + c] !== 0;
  };

  // 玉（円）と岩の重なり。いちばん深く めりこんだマスを返す
  World.prototype.contact = function (x, y, rad) {
    const c0 = Math.floor((x - rad) / CELL), c1 = Math.floor((x + rad) / CELL);
    const r0 = Math.floor((y - rad) / CELL), r1 = Math.floor((y + rad) / CELL);
    let best = null;
    for (let rr = r0; rr <= r1; rr++) {
      for (let cc = c0; cc <= c1; cc++) {
        if (!this.solidAt(cc, rr)) continue;
        const lx = cc * CELL, ly = rr * CELL;
        const px = clamp(x, lx, lx + CELL), py = clamp(y, ly, ly + CELL);
        const dx = x - px, dy = y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rad * rad) continue;
        let d = Math.sqrt(d2), nx, ny;
        if (d < 1e-6) {
          const ol = x - lx, or = lx + CELL - x, ot = y - ly, ob = ly + CELL - y;
          const m = Math.min(ol, or, ot, ob);
          if (m === ol) { nx = -1; ny = 0; } else if (m === or) { nx = 1; ny = 0; } else if (m === ot) { nx = 0; ny = -1; } else { nx = 0; ny = 1; }
          d = -m;
        } else {
          nx = dx / d; ny = dy / d;
          if (dx !== 0 && dy !== 0) {
            // となりも岩なら、角ではなく面として当たる
            const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
            const nbX = this.solidAt(cc + sx, rr), nbY = this.solidAt(cc, rr + sy);
            if (nbX && !nbY) { nx = 0; ny = sy; } else if (nbY && !nbX) { nx = sx; ny = 0; }
          }
        }
        const pen = rad - d;
        if (!best || pen > best.pen) best = { c: cc, r: rr, nx, ny, pen };
      }
    }
    return best;
  };

  World.prototype.typeOfHit = function (h) {
    if (h.c < 0 || h.c >= COLS || h.r < 0 || h.r >= ROWS) return T.BED;
    return this.g[h.r * COLS + h.c];
  };

  // はずみの段階
  World.prototype.momLevel = function () { return this.mom >= MOM_LV2 ? 2 : this.mom >= MOM_LV1 ? 1 : 0; };
  World.prototype.dmg = function (b) { return b.main && this.momLevel() >= 1 ? 2 : 1; };
  World.prototype.ballSpeed = function (b) {
    const lv = b.main ? Math.min(this.mom, 12) : 0;
    return this.speed * (1 + lv * 0.018) * (1 + b.boost * 0.35);
  };
  World.prototype.mouth = function () { return { x: this.frog.x, y: PAD_Y - MOUTH_DY }; };

  // ------------------------------------------------------------------
  World.prototype.step = function (inp) {
    inp = inp || {};
    const dt = DT;
    this.t += dt;
    this.updateFrog(inp, dt);
    for (const b of this.balls) this.updateBall(b, inp, dt);
    this.balls = this.balls.filter((b) => b.main || (b.state !== 'gone'));
    this.updateBooms(dt);
    if (this.dirty) { this.dirty = false; this.collapse(); }
    this.updateChunks(dt);
    this.updateMonsters(dt);
    this.updateHazards(dt);
    if (this.guardian) this.updateGuardian(dt);
    this.prevBtn = !!inp.btn;
  };

  World.prototype.updateFrog = function (inp, dt) {
    const f = this.frog;
    if (f.stun > 0) f.stun -= dt;
    if (f.slow > 0) f.slow -= dt;
    if (f.tongue > 0) f.tongue -= dt;
    const b = this.balls[0];
    const holding = b.state === 'held' || b.state === 'tongue';
    if (!holding && f.stun <= 0 && inp.tx !== undefined) {
      const tx = clamp(inp.tx, XL + 44, XR - 44);
      const maxV = (f.slow > 0 ? 520 : 2600) * dt;
      f.x += clamp(tx - f.x, -maxV, maxV);
    }
  };

  World.prototype.setAim = function (inp) {
    const m = this.mouth();
    if (inp.ax === undefined) return;
    let a = Math.atan2(inp.ay - m.y, inp.ax - m.x);
    const lo = -Math.PI + 0.26, hi = -0.26;     // 水平から15°以上 上むき
    if (a > 0) a = a > Math.PI / 2 ? lo : hi;
    this.aim = clamp(a, lo, hi);
  };

  World.prototype.updateBall = function (b, inp, dt) {
    const f = this.frog;
    if (b.boost > 0) b.boost = Math.max(0, b.boost - dt * 2);
    if (b.state === 'held') {
      const m = this.mouth();
      b.x = m.x; b.y = m.y; b.holdT += dt;
      this.setAim(inp);
      const release = (this.prevBtn && !inp.btn) || inp.spit;
      if (release && b.holdT > 0.06) this.spit(b);
      return;
    }
    if (b.state === 'tongue') {
      b.t += dt;
      const m = this.mouth();
      const k = Math.min(1, b.t / 0.09);
      b.x = b.sx + (m.x - b.sx) * k; b.y = b.sy + (m.y - b.sy) * k;
      this.setAim(inp);
      if (k >= 1) { b.state = 'held'; b.holdT = 0.07; if (!inp.btn) this.spit(b); }
      return;
    }
    if (b.state === 'sunk') {
      b.t += dt;
      if (b.t > 0.7) { b.state = 'held'; b.holdT = 0; this.emit({ type: 'resurface', x: f.x }); }
      return;
    }
    if (b.state !== 'free') return;
    if (!b.main) { b.life -= dt; if (b.life <= 0) { b.state = 'gone'; this.emit({ type: 'fade', x: b.x, y: b.y }); return; } }

    // 舌でくわえる
    if (b.main && inp.btn && f.stun <= 0 && b.vy > 0 && b.y > PAD_Y - 200 && b.y < PAD_Y + 2 && Math.abs(b.x - f.x) < 140) {
      b.state = 'tongue'; b.t = 0; b.sx = b.x; b.sy = b.y; f.tongue = 0.16;
      this.stats.catches++;
      this.mom++;                 // うけとめても はずみは つづく
      this.flight = 0;
      this.emit({ type: 'catch', x: b.x, y: b.y });
      return;
    }
    this.moveBall(b, dt);
    if (b.main) {
      this.idle += dt;
      if (this.idle > 6) {   // 岩盤のあいだで行ったり来たりしつづけないよう、すこしずつ下へ向ける
        this.idle = 4.5;
        const a = Math.atan2(b.vy, b.vx) + (b.vx > 0 ? 0.35 : -0.35);
        const sp = this.ballSpeed(b);
        b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
        this.fixAngle(b);
      }
    }
  };

  World.prototype.spit = function (b) {
    const m = this.mouth();
    const sp = this.ballSpeed(b);
    b.state = 'free'; b.x = m.x; b.y = m.y;
    b.vx = Math.cos(this.aim) * sp; b.vy = Math.sin(this.aim) * sp;
    b.holdT = 0; this.flight = 0; this.idle = 0;
    this.emit({ type: 'spit', x: m.x, y: m.y, a: this.aim });
  };

  World.prototype.fixAngle = function (b) {
    const sp = this.ballSpeed(b);
    let vx = b.vx, vy = b.vy;
    const l = Math.hypot(vx, vy) || 1;
    vx /= l; vy /= l;
    const minY = 0.28;
    if (Math.abs(vy) < minY) {
      vy = (vy >= 0 ? 1 : -1) * minY;
      vx = (vx >= 0 ? 1 : -1) * Math.sqrt(1 - minY * minY);
    }
    b.vx = vx * sp; b.vy = vy * sp;
  };

  World.prototype.moveBall = function (b, dt) {
    const sp = Math.hypot(b.vx, b.vy);
    const n = Math.max(1, Math.ceil(sp * dt / 3));
    const h = dt / n;
    for (let s = 0; s < n; s++) {
      b.x += b.vx * h; b.y += b.vy * h;
      const hit = this.contact(b.x, b.y, BALL_R);
      if (hit) this.ballHitCell(b, hit);
      if (b.state !== 'free') return;
      this.ballVsMonsters(b);
      this.ballVsHazards(b);
      // ハスの葉
      if (b.vy > 0 && b.y + BALL_R >= PAD_Y && b.y - BALL_R < PAD_Y + 8) {
        const off = b.x - this.frog.x;
        if (Math.abs(off) <= FROG_HALF + BALL_R * 0.5) { this.padBounce(b, off); continue; }
      }
      if (b.y < -BALL_R - 2) {
        if (b.main) { b.state = 'exit'; this.done = true; this.emit({ type: 'exit', x: b.x }); }
        else { b.state = 'gone'; }
        return;
      }
      if (b.y > WATER_Y + 6) {
        if (b.main) {
          b.state = 'sunk'; b.t = 0;
          const lost = this.mom;
          this.mom = 0; this.flight = 0; this.stats.misses++;
          this.emit({ type: 'miss', x: b.x, lost });
        } else {
          b.state = 'gone';
          this.emit({ type: 'plop', x: b.x });
        }
        return;
      }
    }
  };

  World.prototype.padBounce = function (b, off) {
    const u = clamp(off / FROG_HALF, -1, 1);
    const a = u * 62 * Math.PI / 180;
    if (b.main) { this.mom++; this.stats.pads++; this.flight = 0; this.idle = 0; }
    const sp = this.ballSpeed(b);
    b.vx = Math.sin(a) * sp; b.vy = -Math.cos(a) * sp;
    b.y = PAD_Y - BALL_R;
    this.emit({ type: 'pad', x: b.x, u, mom: b.main ? this.mom : -1, lv: this.momLevel() });
  };

  World.prototype.ballHitCell = function (b, hit) {
    const inGrid = hit.c >= 0 && hit.c < COLS && hit.r >= 0 && hit.r < ROWS;
    const i = inGrid ? hit.r * COLS + hit.c : -1;
    const type = inGrid ? this.g[i] : T.BED;
    const dmg = this.dmg(b);
    const canBreak = breakable(type);
    const fresh = b.lastHit !== i || this.t - b.lastHitT > 0.08;
    // はずみ最大のときは、ひと当てで こわれるものを つきぬける
    if (canBreak && b.main && this.momLevel() >= 2 && type !== T.LID && this.hp[i] <= dmg) {
      this.idle = 0;
      this.damage(i, dmg, 'ball', b);
      return;
    }
    const dot = b.vx * hit.nx + b.vy * hit.ny;
    if (dot < 0) { b.vx -= 2 * dot * hit.nx; b.vy -= 2 * dot * hit.ny; }
    b.x += hit.nx * hit.pen; b.y += hit.ny * hit.pen;
    if (type === T.BUMP) {
      b.boost = 1;
      this.gems += 1;
      this.emit({ type: 'bump', x: (hit.c + 0.5) * CELL, y: (hit.r + 0.5) * CELL });
    }
    if (canBreak && fresh) {
      this.idle = 0;
      if (type === T.BODY) { /* 守り主の体 */ }
      this.damage(i, dmg, 'ball', b);
    } else if (!canBreak && fresh) {
      if (type === T.BODY) this.guardianHit(b, hit);
      else if (type !== T.BUMP) this.emit({ type: 'clink', x: b.x - hit.nx * BALL_R, y: b.y - hit.ny * BALL_R, mat: type });
    }
    b.lastHit = i; b.lastHitT = this.t;
    this.fixAngle(b);
  };

  // ------------------------------------------------------------------
  // 岩をけずる・こわす
  World.prototype.damage = function (i, dmg, cause, b) {
    const type = this.g[i];
    if (!breakable(type)) return;
    const c = i % COLS, r = (i / COLS) | 0;
    const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
    if (type === T.LID) {
      if (this.guardianAlive()) {   // 守り主が ふたを おさえている
        this.emit({ type: 'sealed', x, y });
        return;
      }
      this.lidHp -= dmg;
      if (this.lidHp > 0) { this.emit({ type: 'chip', mat: type, x, y, i, hp: this.lidHp, max: MAT[T.LID].hp, flight: this.flight }); return; }
      this.openLid(cause);
      return;
    }
    this.hp[i] -= dmg;
    if (this.hp[i] > 0) {
      this.emit({ type: 'chip', mat: type, x, y, i, hp: this.hp[i], max: MAT[type].hp, flight: this.flight });
      return;
    }
    this.destroyCell(i, cause);
  };

  World.prototype.destroyCell = function (i, cause) {
    const type = this.g[i];
    const c = i % COLS, r = (i / COLS) | 0;
    const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
    this.g[i] = 0; this.hp[i] = 0; this.ver++; this.dirty = true;
    const val = MAT[type].val;
    this.gems += val;
    this.stats.broken++;
    if (cause === 'ball') this.flight++;
    this.emit({ type: 'break', mat: type, x, y, i, val, flight: this.flight, cause });
    if (type === T.BLAST) this.booms.push({ i, t: 0.11 });
    if (type === T.POUCH) this.spillMarbles(x, y, 2);
    if (this.item[i] >= 0) { this.releaseItem(this.item[i], x, y); this.item[i] = -1; }
  };

  World.prototype.openLid = function (cause) {
    if (this.lidOpen) return;
    this.lidOpen = true;
    let sx = 0, n = 0;
    for (let i = 0; i < this.N; i++) {
      if (this.g[i] === T.LID) { this.g[i] = 0; sx += (i % COLS) * CELL + CELL / 2; n++; }
    }
    this.ver++; this.dirty = true;
    this.gems += MAT[T.LID].val;
    this.emit({ type: 'lid', x: n ? sx / n : W / 2, y: CELL / 2, cause });
  };

  World.prototype.releaseItem = function (id, x, y) {
    if (id < 0 || this.found.indexOf(id) >= 0) return;
    this.found.push(id);
    this.emit({ type: 'item', id, x, y });
  };

  World.prototype.spillMarbles = function (x, y, n) {
    for (let k = 0; k < n; k++) {
      if (this.balls.length >= 5) break;
      const b = this.newBall(false);
      b.x = x; b.y = y;
      const a = Math.PI / 2 + (k - (n - 1) / 2) * 0.5 + (this.rng() - 0.5) * 0.2;
      const sp = this.speed * 0.9;
      b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
      b.state = 'free';
      this.balls.push(b);
    }
    this.emit({ type: 'marbles', x, y, n });
  };

  // 落ちた袋から、ビー玉が はね上がる
  World.prototype.spillUp = function (x) {
    for (let k = 0; k < 2; k++) {
      if (this.balls.length >= 5) break;
      const b = this.newBall(false);
      b.x = clamp(x + (k ? 14 : -14), XL + 12, XR - 12); b.y = PAD_Y - 30;
      const a = -Math.PI / 2 + (k ? 0.45 : -0.45);
      b.vx = Math.cos(a) * this.speed; b.vy = Math.sin(a) * this.speed;
      b.state = 'free';
      this.balls.push(b);
    }
    this.emit({ type: 'marbles', x, y: PAD_Y - 30, n: 2 });
  };

  World.prototype.updateBooms = function (dt) {
    if (!this.booms.length) return;
    const pending = this.booms;
    this.booms = [];               // 爆発で こわれた はぜ石は、ここへ新しく積まれる
    for (const bm of pending) {
      bm.t -= dt;
      if (bm.t > 0) { this.booms.push(bm); continue; }
      const c = bm.i % COLS, r = (bm.i / COLS) | 0;
      this.emit({ type: 'boom', x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || cc >= COLS || rr < 0 || rr >= ROWS) continue;
        const j = rr * COLS + cc;
        if (breakable(this.g[j])) this.damage(j, 3, 'boom');
      }
      // まきこまれた生きもの
      for (const m of this.monsters) {
        if (!m.dead && Math.abs(m.x - (c * CELL + 16)) < 56 && Math.abs(m.y - (r * CELL + 16)) < 56) this.kill(m, 'boom');
      }
    }
  };

  // 支え（岩盤・ふた石）から つながっていない かたまりを 落とす
  World.prototype.findFalling = function (g) {
    const N = this.N, seen = new Uint8Array(N), q = new Int32Array(N);
    let qh = 0, qt = 0;
    for (let i = 0; i < N; i++) {
      const t = g[i];
      if (t && MAT[t].fixed) { seen[i] = 1; q[qt++] = i; }
    }
    while (qh < qt) {
      const i = q[qh++], c = i % COLS, r = (i / COLS) | 0;
      if (c > 0 && !seen[i - 1] && g[i - 1]) { seen[i - 1] = 1; q[qt++] = i - 1; }
      if (c < COLS - 1 && !seen[i + 1] && g[i + 1]) { seen[i + 1] = 1; q[qt++] = i + 1; }
      if (r > 0 && !seen[i - COLS] && g[i - COLS]) { seen[i - COLS] = 1; q[qt++] = i - COLS; }
      if (r < ROWS - 1 && !seen[i + COLS] && g[i + COLS]) { seen[i + COLS] = 1; q[qt++] = i + COLS; }
    }
    const out = [];
    for (let i = 0; i < N; i++) if (g[i] && !seen[i]) out.push(i);
    return { out, seen };
  };

  World.prototype.collapse = function () {
    const { out } = this.findFalling(this.g);
    if (!out.length) return;
    // つながった かたまりごとに分ける
    const inSet = new Uint8Array(this.N);
    for (const i of out) inSet[i] = 1;
    for (const start of out) {
      if (inSet[start] !== 1) continue;
      const comp = [];
      const stack = [start]; inSet[start] = 2;
      while (stack.length) {
        const i = stack.pop(); comp.push(i);
        const c = i % COLS, r = (i / COLS) | 0;
        const nb = [];
        if (c > 0) nb.push(i - 1);
        if (c < COLS - 1) nb.push(i + 1);
        if (r > 0) nb.push(i - COLS);
        if (r < ROWS - 1) nb.push(i + COLS);
        for (const j of nb) if (inSet[j] === 1) { inSet[j] = 2; stack.push(j); }
      }
      this.makeChunk(comp);
    }
    this.ver++;
  };

  World.prototype.makeChunk = function (comp) {
    let sx = 0, sy = 0, maxY = 0, body = false, val = 0;
    const cells = [];
    for (const i of comp) {
      const c = i % COLS, r = (i / COLS) | 0, t = this.g[i];
      cells.push({ c, r, t, item: this.item[i], hp: this.hp[i] });
      sx += c * CELL + 16; sy += r * CELL + 16; maxY = Math.max(maxY, r * CELL + CELL);
      if (t === T.BODY) body = true;
      val += MAT[t].val;
      this.g[i] = 0; this.hp[i] = 0; this.item[i] = -1;
    }
    const n = comp.length;
    const ch = { cells, n, cx: sx / n, cy: sy / n, maxY, oy: 0, vy: 0, rot: 0, vr: (this.rng() - 0.5) * (body ? 0.25 : 1.4) / Math.sqrt(n), body, val, t: 0 };
    this.chunks.push(ch);
    this.stats.collapses++;
    this.stats.maxCollapse = Math.max(this.stats.maxCollapse, n);
    this.emit({ type: 'collapse', n, x: ch.cx, y: ch.cy, body });
    // かたまりに くっついていた生きものも いっしょに落ちる
    for (const m of this.monsters) {
      if (m.dead) continue;
      if (m.kind === 'bat' && m.state === 'sleep' && comp.indexOf(this.idx(m.c, m.r - 1)) >= 0) this.kill(m, 'fall');
      if (m.kind === 'drip' && comp.indexOf(this.idx(m.c, m.r - 1)) >= 0) this.kill(m, 'fall');
    }
    if (body && this.guardian) this.guardianDown(ch);
  };

  World.prototype.updateChunks = function (dt) {
    if (!this.chunks.length) return;
    const keep = [];
    for (const ch of this.chunks) {
      ch.t += dt;
      ch.vy = Math.min(ch.vy + GRAV * dt * (ch.body ? 0.6 : 1), 1200);
      ch.oy += ch.vy * dt;
      ch.rot += ch.vr * dt;
      // 落ちてくる岩は、飛んでいる生きものも まきこむ
      for (const m of this.monsters) {
        if (m.dead || m.state === 'sleep' || m.kind === 'grub') continue;
        for (const cl of ch.cells) {
          const x = cl.c * CELL + 16, y = cl.r * CELL + 16 + ch.oy;
          if (Math.abs(m.x - x) < 26 && Math.abs(m.y - y) < 26) { this.kill(m, 'crush'); break; }
        }
      }
      if (ch.maxY + ch.oy > WATER_Y + 18) {
        const n = ch.n;
        const bonus = n >= 3 ? Math.round(n * n * 0.35) : 0;
        const gain = Math.round(ch.val * 1.5) + bonus;
        this.gems += gain;
        this.emit({ type: 'splash', n, x: ch.cx, gain, body: ch.body });
        for (const cl of ch.cells) {
          if (cl.item >= 0) this.releaseItem(cl.item, cl.c * CELL + 16, WATER_Y - 10);
          if (cl.t === T.POUCH) this.spillUp(cl.c * CELL + 16);
        }
        continue;
      }
      keep.push(ch);
    }
    this.chunks = keep;
  };

  // ------------------------------------------------------------------
  // 生きもの
  World.prototype.kill = function (m, cause) {
    if (m.dead) return;
    m.dead = true; m.deadT = 0;
    this.stats.kills++;
    this.gems += 10;
    this.emit({ type: 'kill', kind: m.kind, x: m.x, y: m.y, cause });
  };

  World.prototype.stunFrog = function (sec, cause) {
    const f = this.frog;
    if (f.stun > 0) return;
    f.stun = sec;
    this.stats.stuns++;
    this.emit({ type: 'stun', x: f.x, cause });
  };

  World.prototype.lowestRockY = function () {
    for (let r = ROWS - 1; r >= 0; r--) {
      for (let c = 1; c < COLS - 1; c++) if (this.g[r * COLS + c]) return r * CELL + CELL;
    }
    return CELL;
  };

  World.prototype.ballVsMonsters = function (b) {
    for (const m of this.monsters) {
      if (m.dead) continue;
      const rad = m.kind === 'bat' ? 15 : 12;
      if (Math.abs(b.x - m.x) < rad + BALL_R && Math.abs(b.y - m.y) < rad + BALL_R) {
        if (Math.hypot(b.x - m.x, b.y - m.y) < rad + BALL_R) { this.idle = 0; this.kill(m, 'ball'); }
      }
    }
  };

  World.prototype.updateMonsters = function (dt) {
    const f = this.frog;
    for (const m of this.monsters) {
      if (m.dead) { m.deadT += dt; continue; }
      m.t += dt;
      if (m.kind === 'bat') this.updateBat(m, dt, f);
      else if (m.kind === 'grub') this.updateGrub(m, dt);
      else if (m.kind === 'drip') this.updateDrip(m, dt, f);
    }
  };

  World.prototype.updateBat = function (m, dt, f) {
    if (m.state === 'sleep') {
      // ぶら下がっている岩がなくなる／玉が近くを通ると 目をさます
      const above = this.cellAt(m.c, m.r - 1);
      let wake = above === 0 || above === -1;
      for (const b of this.balls) if (b.state === 'free' && Math.hypot(b.x - m.x, b.y - m.y) < 70) wake = true;
      if (wake) { m.state = 'fly'; m.t = 0; m.atk = 3 + this.rng() * 2.5; this.pickBatTarget(m); this.emit({ type: 'wake', x: m.x, y: m.y }); }
      return;
    }
    const top = this.lowestRockY() + 30, bottom = PAD_Y - 150;
    if (m.state === 'fly') {
      m.atk -= dt;
      const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
      if (d < 8) this.pickBatTarget(m);
      else { m.x += dx / d * 110 * dt; m.y += dy / d * 110 * dt + Math.sin(m.t * 9) * 0.6; }
      m.face = dx >= 0 ? 1 : -1;
      if (m.atk <= 0 && f.stun <= 0) { m.state = 'tele'; m.st = 0.75; this.emit({ type: 'screech', x: m.x, y: m.y }); }
    } else if (m.state === 'tele') {
      m.st -= dt;
      if (m.st <= 0) {
        m.state = 'dive';
        const dx = f.x - m.x, dy = (PAD_Y - 14) - m.y, d = Math.hypot(dx, dy) || 1;
        m.vx = dx / d * 340; m.vy = dy / d * 340;
      }
    } else if (m.state === 'dive') {
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (Math.abs(m.x - f.x) < 40 && Math.abs(m.y - (PAD_Y - 14)) < 26) { this.stunFrog(0.8, 'bat'); m.state = 'rise'; }
      if (m.y > PAD_Y - 6) m.state = 'rise';
    } else if (m.state === 'rise') {
      m.y -= 200 * dt;
      m.x += Math.sin(m.t * 4) * 40 * dt;
      if (m.y < Math.max(top, bottom - 100)) { m.state = 'fly'; m.atk = 5 + this.rng() * 3; this.pickBatTarget(m); }
    }
    m.x = clamp(m.x, XL + 16, XR - 16);
  };

  World.prototype.pickBatTarget = function (m) {
    const top = Math.min(this.lowestRockY() + 36, PAD_Y - 200), bottom = PAD_Y - 150;
    for (let k = 0; k < 8; k++) {
      const tx = XL + 30 + this.rng() * (XR - XL - 60);
      const ty = top + this.rng() * Math.max(10, bottom - top);
      const c = Math.floor(tx / CELL), r = Math.floor(ty / CELL);
      if (!this.solidAt(c, r)) { m.tx = tx; m.ty = ty; return; }
    }
    m.tx = W / 2; m.ty = bottom;
  };

  // どろむし：岩の表面をはい、ときどき すぐ下のすきまを どろで ふさぐ
  World.prototype.surfaceCell = function (c, r) {
    if (c < 1 || c >= COLS - 1 || r < 1 || r >= ROWS) return false;
    if (this.g[r * COLS + c]) return false;
    return this.solidAt(c, r - 1) || this.solidAt(c - 1, r) || this.solidAt(c + 1, r);
  };

  World.prototype.updateGrub = function (m, dt) {
    if (!this.surfaceCell(m.c, m.r)) {
      // 足場がなくなった
      if (!this.solidAt(m.c, m.r - 1) && !this.solidAt(m.c - 1, m.r) && !this.solidAt(m.c + 1, m.r)) { this.kill(m, 'fall'); return; }
    }
    const tx = m.c * CELL + 16, ty = m.r * CELL + 16;
    m.x += (tx - m.x) * Math.min(1, dt * 6); m.y += (ty - m.y) * Math.min(1, dt * 6);
    if (m.state === 'crawl') {
      m.move -= dt; m.atk -= dt;
      if (m.move <= 0) {
        m.move = 0.65;
        const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => [m.c + dc, m.r + dr]).filter(([c, r]) => this.surfaceCell(c, r) && !(c === m.pc && r === m.pr));
        if (opts.length) { const o = opts[(this.rng() * opts.length) | 0]; m.pc = m.c; m.pr = m.r; m.face = o[0] >= m.c ? 1 : -1; m.c = o[0]; m.r = o[1]; }
      }
      if (m.atk <= 0) { m.state = 'build'; m.st = 0.7; }
    } else if (m.state === 'build') {
      m.st -= dt;
      if (m.st <= 0) {
        m.state = 'crawl'; m.atk = 4.2 + this.rng() * 1.6;
        // 下か横の すきまを どろでふさぐ（下の4段は ふさがない）
        const cand = [[0, 1], [1, 0], [-1, 0], [1, 1], [-1, 1]].map(([dc, dr]) => [m.c + dc, m.r + dr])
          .filter(([c, r]) => c > 0 && c < COLS - 1 && r < ROWS - 4 && this.g[r * COLS + c] === 0 && !this.ballNear(c, r));
        if (cand.length) {
          const [c, r] = cand[0];
          const i = r * COLS + c;
          this.g[i] = T.MUD; this.hp[i] = MAT[T.MUD].hp; this.ver++;
          this.emit({ type: 'mud', x: c * CELL + 16, y: r * CELL + 16, i });
          // ふさいだ どろの上へ移る
          if (this.surfaceCell(c, r + 1)) { m.c = c; m.r = r + 1; }
        }
      }
    }
  };

  World.prototype.ballNear = function (c, r) {
    for (const b of this.balls) if (b.state === 'free' && Math.abs(b.x - (c * CELL + 16)) < 40 && Math.abs(b.y - (r * CELL + 16)) < 40) return true;
    return false;
  };

  // しずくぐも：岩からぶら下がり、しずくを落とす
  World.prototype.updateDrip = function (m, dt, f) {
    if (!this.solidAt(m.c, m.r - 1)) { this.kill(m, 'fall'); return; }
    m.len = 54 + Math.sin(m.t * 1.3) * 16;
    m.x = m.c * CELL + 16; m.y = m.ay + m.len;
    if (m.state === 'hang') {
      m.atk -= dt;
      if (m.atk <= 0) { m.state = 'tele'; m.st = 0.7; }
    } else if (m.state === 'tele') {
      m.st -= dt;
      if (m.st <= 0) {
        m.state = 'hang'; m.atk = 2.6 + this.rng() * 1.4;
        this.hazards.push({ kind: 'drop', x: m.x, y: m.y + 10, vy: 60, tele: 0 });
        this.emit({ type: 'drip', x: m.x, y: m.y });
      }
    }
  };

  // ------------------------------------------------------------------
  // あぶないもの（石つぶて・しずく・つるべ・コルク・くもの糸）
  World.prototype.updateHazards = function (dt) {
    if (!this.hazards.length) return;
    const f = this.frog;
    const keep = [];
    for (const h of this.hazards) {
      if (h.tele > 0) { h.tele -= dt; keep.push(h); continue; }
      if (h.kind === 'pebble' || h.kind === 'drop') {
        h.vy = Math.min(h.vy + 1100 * dt, 700);
        h.y += h.vy * dt;
        if (Math.abs(h.x - f.x) < 30 && h.y > PAD_Y - 26 && h.y < PAD_Y + 6) {
          this.stunFrog(h.kind === 'pebble' ? 0.75 : 0.55, h.kind);
          this.emit({ type: 'bonk', x: h.x, y: h.y, kind: h.kind });
          continue;
        }
        if (h.y > WATER_Y) { this.emit({ type: 'plip', x: h.x, kind: h.kind }); continue; }
      } else if (h.kind === 'cork' || h.kind === 'web') {
        if (h.kind === 'cork') h.vy += 700 * dt;
        h.x += h.vx * dt; h.y += h.vy * dt;
        if (Math.abs(h.x - f.x) < 34 && h.y > PAD_Y - 30 && h.y < PAD_Y + 6) {
          if (h.kind === 'web') { f.slow = 2.2; this.emit({ type: 'webbed', x: f.x }); }
          else { this.stunFrog(0.6, 'cork'); this.emit({ type: 'bonk', x: h.x, y: h.y, kind: 'cork' }); }
          continue;
        }
        if (h.y > WATER_Y || h.x < XL || h.x > XR) { this.emit({ type: 'plip', x: h.x, kind: h.kind }); continue; }
      } else if (h.kind === 'bucket') {
        h.t += dt;
        if (h.state === 'drop') {
          h.y += 980 * dt;
          if (h.y >= PAD_Y - 36) { h.y = PAD_Y - 36; h.state = 'stay'; h.t = 0; this.emit({ type: 'thud', x: h.x }); }
          if (Math.abs(h.x - f.x) < 44 && h.y > PAD_Y - 64) { this.stunFrog(0.85, 'bucket'); }
        } else if (h.state === 'stay') {
          if (h.t > 0.5) { h.state = 'up'; }
        } else if (h.state === 'up') {
          h.y -= 520 * dt;
          if (h.y <= h.y0) continue;
        }
      }
      keep.push(h);
    }
    this.hazards = keep;
  };

  World.prototype.ballVsHazards = function (b) {
    for (const h of this.hazards) {
      if (h.tele > 0 || h.dead) continue;
      if (h.kind === 'bucket') {
        if (Math.abs(b.x - h.x) < 22 + BALL_R && Math.abs(b.y - h.y) < 18 + BALL_R) {
          // おけは かたい：はね返る
          const dx = b.x - h.x, dy = b.y - h.y;
          if (Math.abs(dx) / 22 > Math.abs(dy) / 18) { b.vx = Math.abs(b.vx) * Math.sign(dx || 1); }
          else { b.vy = Math.abs(b.vy) * Math.sign(dy || 1); }
          if (this.t - (h.hitT || -1) > 0.15) { h.hitT = this.t; this.gems += 3; this.emit({ type: 'clonk', x: h.x, y: h.y }); }
          this.fixAngle(b);
        }
      } else if (h.kind === 'cork' || h.kind === 'web') {
        if (Math.hypot(b.x - h.x, b.y - h.y) < 12 + BALL_R) { h.dead = true; this.gems += 2; this.emit({ type: 'pop', x: h.x, y: h.y, kind: h.kind }); }
      }
    }
    if (this.hazards.some((h) => h.dead)) this.hazards = this.hazards.filter((h) => !h.dead);
  };

  World.prototype.dropPebbles = function (n, tele) {
    const f = this.frog;
    const xs = [];
    for (let k = 0; k < n; k++) {
      let x = 0;
      for (let tries = 0; tries < 10; tries++) {
        x = XL + 24 + this.rng() * (XR - XL - 48);
        if (xs.every((o) => Math.abs(o - x) > 60)) break;
      }
      xs.push(x);
    }
    // ひとつは かならず カエルの近くへ（よけることを教える）
    if (n >= 2) xs[0] = clamp(f.x + (this.rng() - 0.5) * 40, XL + 20, XR - 20);
    for (const x of xs) {
      const c = Math.floor(x / CELL);
      let y = CELL;
      for (let r = ROWS - 1; r >= 0; r--) if (this.solidAt(c, r)) { y = r * CELL + CELL; break; }
      this.hazards.push({ kind: 'pebble', x, y, vy: 0, tele: tele });
    }
    this.emit({ type: 'rumble', n });
  };

  // ------------------------------------------------------------------
  // 守り主
  World.prototype.guardianAlive = function () { return this.guardian && !this.guardian.down; };

  World.prototype.anchorsLeft = function () {
    let n = 0;
    for (let i = 0; i < this.N; i++) if (this.g[i] === T.ANCHOR) n++;
    return n;
  };

  World.prototype.guardianHit = function (b, hit) {
    const G = this.guardian;
    if (!G || G.down) return;
    G.flinch = 0.35;
    this.emit({ type: 'ghit', x: b.x, y: b.y, kind: G.kind });
    if (G.kind === 'karakuri' && G.hitCD <= 0) {
      G.hitCD = 5;
      this.spillMarbles((G.x0 + G.x1) / 2, G.y1 + 6, 2);
    }
  };

  World.prototype.updateGuardian = function (dt) {
    const G = this.guardian;
    if (G.down) return;
    G.t += dt;
    if (G.flinch > 0) G.flinch -= dt;
    if (G.hitCD > 0) G.hitCD -= dt;
    const left = this.anchorsLeft();
    G.anger = 1 - left / Math.max(1, G.total);
    const f = this.frog;
    const cx = (G.x0 + G.x1) / 2, by = G.y1;
    const pace = 1 - 0.35 * G.anger;
    G.atk -= dt;
    if (G.state === 'idle' && G.atk <= 0) {
      G.state = 'tele'; G.st = 0.9;
      G.tx = clamp(f.x, XL + 30, XR - 30);     // つるべは ここへ落ちる（予告の かげを出す）
      this.emit({ type: 'gtele', kind: G.kind });
    }
    if (G.state === 'tele') {
      G.st -= dt;
      if (G.st <= 0) {
        G.state = 'idle';
        if (G.kind === 'namazu') { this.dropPebbles(3, 0.85); G.atk = 6.2 * pace; }
        else if (G.kind === 'tsuchigumo') {
          const dx = f.x - cx, dy = PAD_Y - 20 - by, d = Math.hypot(dx, dy);
          this.hazards.push({ kind: 'web', x: cx, y: by, vx: dx / d * 260, vy: dy / d * 260, tele: 0 });
          this.emit({ type: 'spit_web', x: cx, y: by });
          G.atk = 5.4 * pace;
        } else if (G.kind === 'tsurube') {
          const x = G.tx;
          this.hazards.push({ kind: 'bucket', x, y: by + 10, y0: by + 10, state: 'drop', t: 0, tele: 0 });
          this.emit({ type: 'bucket', x });
          G.atk = 4.6 * pace;
        } else if (G.kind === 'karakuri') {
          for (let k = 0; k < 2; k++) {
            const tx = clamp(f.x + (k ? 70 : -10) * (this.rng() < 0.5 ? 1 : -1), XL + 20, XR - 20);
            const T0 = 1.1;
            const vx = (tx - cx) / T0, vy = ((PAD_Y - 20) - by - 0.5 * 700 * T0 * T0) / T0;
            this.hazards.push({ kind: 'cork', x: cx, y: by, vx, vy, tele: k * 0.35 });
          }
          this.emit({ type: 'pop_cork', x: cx, y: by });
          G.atk = 4.8 * pace;
        } else if (G.kind === 'nekko') {
          this.dropPebbles(3, 0.85); G.atk = 7.2 * pace;
        }
      }
    }
    // 引きちぎった支えを 張りなおす（土ぐも・根っこ）
    if (G.kind === 'tsuchigumo' || G.kind === 'nekko') {
      G.regrow += dt;
      const every = G.kind === 'tsuchigumo' ? 8.5 : 10.5;
      if (G.regrow >= every && G.regrown < (G.kind === 'tsuchigumo' ? 4 : 5)) {
        G.regrow = 0;
        for (const i of G.anchors0) {
          if (this.g[i] !== 0) continue;
          const c = i % COLS, r = (i / COLS) | 0;
          // 体か 岩盤のどちらかに まだ つながっている場所だけ
          const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => { const t = this.cellAt(c + dc, r + dr); return t === T.BODY || t === T.ANCHOR; });
          if (!nb || this.ballNear(c, r)) continue;
          this.g[i] = T.ANCHOR; this.hp[i] = MAT[T.ANCHOR].hp; this.ver++;
          G.regrown++;
          this.emit({ type: 'regrow', x: c * CELL + 16, y: r * CELL + 16, kind: G.kind });
          break;
        }
      }
    }
    // 根っこは のびて すきまを せばめる
    if (G.kind === 'nekko') {
      G.grow += dt;
      if (G.grow >= 3.6) {
        G.grow = 0;
        const cand = [];
        for (let i = 0; i < this.N; i++) {
          const t = this.g[i];
          if (t !== T.ROOT && t !== T.BODY) continue;
          const c = i % COLS, r = (i / COLS) | 0;
          for (const [dc, dr] of [[0, 1], [1, 0], [-1, 0]]) {
            const cc = c + dc, rr = r + dr;
            if (cc < 1 || cc >= COLS - 1 || rr >= ROWS - 6 || rr < 0) continue;
            const j = rr * COLS + cc;
            if (this.g[j] === 0 && !this.ballNear(cc, rr)) cand.push(j);
          }
        }
        if (cand.length) {
          const j = cand[(this.rng() * cand.length) | 0];
          this.g[j] = T.ROOT; this.hp[j] = 1; this.ver++;
          this.emit({ type: 'rootgrow', x: (j % COLS) * CELL + 16, y: ((j / COLS) | 0) * CELL + 16 });
        }
      }
    }
  };

  World.prototype.guardianDown = function (ch) {
    const G = this.guardian;
    G.down = true;
    G.chunk = ch;
    this.hazards = this.hazards.filter((h) => h.kind === 'bucket' ? false : true);
    this.emit({ type: 'gdown', kind: G.kind, x: ch.cx, y: ch.cy });
    if (!this.lidOpen) this.openLid('guardian');
    if (this.level.bossItem !== undefined) this.releaseItem(this.level.bossItem, ch.cx, ch.cy);
  };

  // ------------------------------------------------------------------
  // ねらい線：ゴーストの玉を走らせる（こわせる岩に当たったら止める）
  World.prototype.trace = function (x, y, dx, dy, maxLen, stopDown) {
    const pts = [[x, y]];
    let len = 0, refl = 0;
    const step = 4;
    let vx = dx, vy = dy;
    for (let guard = 0; guard < 2000 && len < maxLen; guard++) {
      x += vx * step; y += vy * step; len += step;
      if (y < -BALL_R - 2) { pts.push([x, y]); return { pts, exit: true }; }
      if (stopDown && vy > 0 && y + BALL_R >= PAD_Y) { pts.push([x, y]); return { pts, land: x }; }
      if (!stopDown && y > PAD_Y - 20 && vy > 0) { pts.push([x, y]); return { pts }; }
      const h = this.contact(x, y, BALL_R);
      if (h) {
        const type = this.typeOfHit(h);
        if (breakable(type)) { pts.push([x, y]); return { pts, hit: h, i: h.r * COLS + h.c, type }; }
        const d = vx * h.nx + vy * h.ny;
        if (d < 0) { vx -= 2 * d * h.nx; vy -= 2 * d * h.ny; }
        x += h.nx * h.pen; y += h.ny * h.pen;
        if (Math.abs(vy) < 0.28) { vy = (vy >= 0 ? 1 : -1) * 0.28; vx = (vx >= 0 ? 1 : -1) * Math.sqrt(1 - 0.0784); }
        pts.push([x, y]);
        if (++refl > 3) return { pts, bounce: type };
      }
    }
    pts.push([x, y]);
    return { pts };
  };

  // 今の状態での ねらい：くわえている → ねらいの向き／落ちてくる → 着地点と、はね返る向き
  World.prototype.aimInfo = function () {
    const b = this.balls[0];
    const f = this.frog;
    let origin = null, dir = null, land = null, onPad = false;
    if (b.state === 'held' || b.state === 'tongue') {
      origin = this.mouth(); dir = [Math.cos(this.aim), Math.sin(this.aim)];
    } else if (b.state === 'free' && b.vy > 0) {
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const tr = this.trace(b.x, b.y, b.vx / sp, b.vy / sp, 1600, true);
      if (tr.land === undefined) return { land: null };
      land = tr.land;
      const off = land - f.x;
      if (Math.abs(off) <= FROG_HALF + BALL_R * 0.5) {
        onPad = true;
        const u = clamp(off / FROG_HALF, -1, 1), a = u * 62 * Math.PI / 180;
        origin = { x: land, y: PAD_Y - BALL_R }; dir = [Math.sin(a), -Math.cos(a)];
      }
    } else return null;
    const out = { land, onPad, origin, dir };
    if (!origin) return out;
    const tr = this.trace(origin.x, origin.y, dir[0], dir[1], 1500, false);
    out.pts = tr.pts; out.exit = !!tr.exit;
    if (tr.hit) {
      out.i = tr.i; out.type = tr.type;
      const dmg = this.dmg(b);
      const breaks = tr.type === T.LID ? this.lidHp <= dmg : this.hp[tr.i] <= dmg;
      out.breaks = breaks;
      out.falling = breaks && tr.type !== T.LID ? this.fallingIf(tr.i) : [];
    }
    return out;
  };

  World.prototype.fallingIf = function (i) {
    const key = i + ':' + this.ver;
    if (this.fallingCache.key === key) return this.fallingCache.set;
    const g2 = this.g.slice();
    g2[i] = 0;
    if (g2[i] === 0 && this.g[i] === T.BLAST) { /* 爆発の分は ふくめない */ }
    const { out } = this.findFalling(g2);
    this.fallingCache = { key, set: out };
    return out;
  };

  // ------------------------------------------------------------------
  const API = { World, T, MAT, CELL, COLS, ROWS, W, PAD_Y, WATER_Y, BALL_R, DT, FROG_HALF, XL, XR, MOM_LV1, MOM_LV2, clamp, mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.SKS = API;
})(typeof window !== 'undefined' ? window : this);
