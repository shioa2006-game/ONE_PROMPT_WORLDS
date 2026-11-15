/*
 * ひゅるり、凧びより ― 世界の描画
 *   ななめ上から見た絵（地面は上から、ものは 正面から）。y が 大きいほど 手前。
 *   カメラは つむじを 追い、大きくなると 一段ずつ ひいていく。
 */
(function (root) {
  'use strict';
  const TJ = root.TJ = root.TJ || {};
  const TY = TJ.TYPES;
  const Art = TJ.Art;
  const H = Art.h;
  const OUT = H.OUT;
  const PI = Math.PI, TAU = PI * 2;

  const GROUND = {
    grass: '#b9c27e', grass3: '#b6bf7b', grass4: '#aebb76', hill: '#a9bd78', dirt: '#d6c196', yard: '#d4bd90', path: '#e2d2ae',
    road: '#ddd0b2', plaza: '#e5d7b6', lot: '#cfc2a0', field: '#9b7650', field4: '#b29468', paddy: '#c8b27a', gravel: '#d3ccbd',
    river: '#6fa8cf', bridge: '#b98a55', meadow: '#bccd88', snow: '#eef4f8'
  };
  const SKY_H = [1200, 2600, 4800, 9000, 14000];

  class Render {
    constructor(canvas) {
      this.cv = canvas;
      this.c = canvas.getContext('2d');
      this.cam = { x: 0, y: 55, z: 16, shake: 0, sx: 0, sy: 0, override: null };
      this.parts = [];
      this.texts = [];
      this.rings = [];
      this.t = 0;
      this.W = 1280; this.H = 720; this.k = 1;
      this.forest = null;
      this.segs = null;
      this.blink = 0;
      this.tint = 0; this.tintT = 0;
      this.clouds = [];
      const R = TJ.rng(321);
      for (let i = 0; i < 14; i++) this.clouds.push({ x: R.range(-110, 680) * 100, y: R.range(-430, 250) * 100, r: R.range(20, 60) * 100, sp: R.range(150, 300) });
    }
    resize(w, h, dpr) {
      this.dpr = dpr;
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
      this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
      this.W = w; this.H = h; this.k = Math.min(w / 1280, h / 720);
    }
    baseD() { return 72 * this.k; }

    // ── 座標
    toScreen(x, y) { const cm = this.cam; return [(x - cm.x) * cm.z + this.W / 2 + cm.sx, (y - cm.y) * cm.z + this.H / 2 + cm.sy]; }
    toWorld(sx, sy) { const cm = this.cam; return [(sx - this.W / 2 - cm.sx) / cm.z + cm.x, (sy - this.H / 2 - cm.sy) / cm.z + cm.y]; }

    snapCamera(sim) {
      const w = sim.wind;
      this.cam.x = w.x; this.cam.y = w.y - w.S * 0.4; this.cam.z = this.baseD() / sim.Sref;
    }
    updateCamera(sim, dt) {
      const cm = this.cam, w = sim.wind;
      let tx, ty, tz;
      if (cm.override) { tx = cm.override.x; ty = cm.override.y; tz = cm.override.z; }
      else {
        tx = w.x + w.vx * 0.22; ty = w.y - w.S * 0.45 + w.vy * 0.22;
        tz = this.baseD() / sim.Sref;
      }
      const kz = 1 - Math.exp(-dt * (cm.override && cm.override.fast ? 3 : 2.0));
      cm.z = Math.exp(Math.log(cm.z) + (Math.log(tz) - Math.log(cm.z)) * kz);
      const kp = 1 - Math.exp(-dt * (cm.override ? 2.5 : 6));
      cm.x += (tx - cm.x) * kp; cm.y += (ty - cm.y) * kp;
      if (cm.shake > 0) {
        cm.shake = Math.max(0, cm.shake - dt * 30);
        cm.sx = (Math.random() - 0.5) * cm.shake; cm.sy = (Math.random() - 0.5) * cm.shake;
      } else { cm.sx = cm.sy = 0; }
    }
    kick(px) { this.cam.shake = Math.max(this.cam.shake, px * this.k); }

    // ── 準備（森の ふち・ながい へいの 分割）
    prepare(sim) {
      const W = sim.W;
      const f = [];
      const R = TJ.rng(55);
      const radFor = (z) => [0, 0, 160, 420, 800, 1500][z];
      const inside = (x, y) => sim.inAny(x, y);
      for (const z of W.zones) {
        const r = radFor(z.z);
        const step = r * 1.15;
        const edges = [[z.x0, z.y0, z.x1, z.y0, 0, -1], [z.x0, z.y1, z.x1, z.y1, 0, 1], [z.x0, z.y0, z.x0, z.y1, -1, 0], [z.x1, z.y0, z.x1, z.y1, 1, 0]];
        for (const [x0, y0, x1, y1, nx, ny] of edges) {
          const L = Math.hypot(x1 - x0, y1 - y0);
          for (let d = 0; d <= L; d += step) {
            for (let row = 0; row < 3; row++) {
              const rr = r * R.range(0.8, 1.25) * (1 + row * 0.25);
              const off = r * (0.5 + row * 1.25);
              const x = x0 + (x1 - x0) * d / L + nx * off + R.range(-0.3, 0.3) * r, y = y0 + (y1 - y0) * d / L + ny * off + R.range(-0.3, 0.3) * r;
              if (inside(x, y)) continue;
              f.push({ x, y, r: rr, z: z.z, v: R.int(0, 2) });
            }
          }
        }
      }
      f.sort((a, b) => a.y - b.y);
      this.forest = f;
      // ながい へいを 分割（ならびかえを 正しくするため）
      const segs = [];
      for (const s of W.solids) {
        if (s.shape !== 'rect' || s.draw === 'trunk') continue;
        const w = s.x1 - s.x0, h = s.y1 - s.y0;
        if (h > w * 2.5 && h > 150) {
          const L = Math.max(w * 1.5, 60);
          for (let y = s.y0; y < s.y1 - 1; y += L) segs.push({ s, x0: s.x0, x1: s.x1, y0: y, y1: Math.min(s.y1, y + L), seg: 1 });
        } else segs.push({ s, x0: s.x0, x1: s.x1, y0: s.y0, y1: s.y1 });
      }
      this.segs = segs;
    }

    // ── こまかい演出
    burst(x, y, n, opt) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, sp = (opt.sp || 1) * (0.4 + Math.random());
        this.parts.push({ x, y, z: opt.z || 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: (opt.up || 0.6) * (0.5 + Math.random()), g: opt.g === undefined ? 1.8 : opt.g,
          life: (opt.life || 0.6) * (0.6 + Math.random() * 0.6), t: 0, kind: opt.kind || 'dust', size: (opt.size || 6) * (0.6 + Math.random() * 0.8), col: opt.col || '#fff', scale: opt.scale || 1 });
      }
    }
    ring(x, y, r, col, life, w) { this.rings.push({ x, y, r, col, life, t: 0, w: w || 4 }); }
    float(text, x, y, opt) { this.texts.push(Object.assign({ text, x, y, t: 0, life: 1.2, size: 18, col: '#fff', rise: 40 }, opt || {})); }

    // ════ 描画 ════
    draw(sim, dt, opts) {
      opts = opts || {};
      this.t += dt;
      if (!this.forest) this.prepare(sim);
      const c = this.c, cm = this.cam, W = this.W, H = this.H;
      const z = cm.z;
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      c.fillStyle = '#4f6e47'; c.fillRect(0, 0, W, H);
      // ワールド座標へ
      const ox = W / 2 + cm.sx - cm.x * z, oy = H / 2 + cm.sy - cm.y * z;
      const setW = () => c.setTransform(this.dpr * z, 0, 0, this.dpr * z, this.dpr * ox, this.dpr * oy);
      const vx0 = cm.x - (W / 2 + 40) / z, vx1 = cm.x + (W / 2 + 40) / z, vy0 = cm.y - (H / 2 + 40) / z, vy1 = cm.y + (H / 2 + 40) / z;
      this.view = { x0: vx0, x1: vx1, y0: vy0, y1: vy1 };
      setW();
      this.simRef = sim;
      this.drawGround(sim, z);
      // 森（ふち）
      this.drawForest(z, vx0, vx1, vy0, vy1);
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.drawDecos(sim, z, vx0, vx1, vy0, vy1);
      // 雲の かげ
      this.drawCloudShadows(sim, dt, z);
      // ならべて描く
      const list = [];
      const S = sim.wind.S;
      const pad = 2;
      for (const o of sim.W.objs) {
        if (o.st !== 0) continue;
        const ext = o.s * 1.2 + (o.z || 0);
        if (o.x + ext < vx0 || o.x - ext > vx1 || o.y + ext * 0.5 < vy0 || o.y - ext * 1.5 > vy1) continue;
        list.push({ y: o.y, k: 0, o });
      }
      for (const sg of this.segs) {
        const s = sg.s;
        if (s.pass <= S && (s.draw === 'hedge' || s.draw === 'fence') && false) continue;
        if (sg.x1 < vx0 - 2000 || sg.x0 > vx1 + 2000 || sg.y1 < vy0 - 200 || sg.y0 > vy1 + 3000) continue;
        list.push({ y: sg.y1, k: 1, sg });
      }
      for (const tr of sim.W.trees) {
        if (tr.x + tr.crown * 1.3 < vx0 || tr.x - tr.crown * 1.3 > vx1 || tr.y + tr.r < vy0 || tr.y - tr.crown * 3 > vy1) continue;
        list.push({ y: tr.y, k: 2, tr });
      }
      for (const cr of sim.W.creatures) {
        if (cr.x === undefined || cr.kind === 'crow' || cr.kind === 'tobi') continue;
        if (cr.x < vx0 - 300 || cr.x > vx1 + 300 || cr.y < vy0 - 100 || cr.y > vy1 + 400) continue;
        list.push({ y: cr.y, k: 3, cr });
      }
      for (const p of sim.W.people) {
        if (p.x < vx0 - 300 || p.x > vx1 + 300 || p.y < vy0 - 100 || p.y > vy1 + 400) continue;
        list.push({ y: p.y, k: 4, p });
      }
      for (const k of sim.W.kites) if (k.st === 0) list.push({ y: k.y, k: 5, kt: k });
      list.push({ y: sim.wind.y, k: 6 });
      list.sort((a, b) => a.y - b.y);
      for (const e of list) {
        if (e.k === 0) this.drawObj(e.o, z, sim);
        else if (e.k === 1) { setW(); this.drawStruct(e.sg, sim, z); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }
        else if (e.k === 2) this.drawTree(e.tr, z, sim);
        else if (e.k === 3) this.drawCreature(e.cr, z, sim);
        else if (e.k === 4) this.drawPeople(e.p, z, sim);
        else if (e.k === 5) this.drawKiteGround(e.kt, z, sim);
        else this.drawWind(sim, z, opts);
      }
      // ゆきに おとしたもの
      for (const d of sim.dropped) this.drawLoose(d, z);
      // そらの もの
      this.drawBirds(sim, z);
      this.drawKitesSky(sim, z);
      this.drawBoss(sim, z, dt);
      this.drawParts(dt, z);
      this.drawRings(dt, z);
      this.drawTexts(dt);
      // いろあい
      this.drawTint(sim, dt);
    }

    drawGround(sim, z) {
      const c = this.c;
      for (const g of sim.W.ground) {
        c.fillStyle = GROUND[g.kind] || '#f0f';
        if (g.ell) { c.beginPath(); c.ellipse(g.x, g.y, g.rx, g.ry, 0, 0, TAU); c.fill(); continue; }
        c.fillRect(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0);
        const w = g.x1 - g.x0, h = g.y1 - g.y0;
        if (g.kind === 'field' || g.kind === 'field4') {
          const sp = g.kind === 'field' ? 110 : 600;
          if (sp * z > 4) {
            c.fillStyle = 'rgba(70,45,25,0.28)';
            for (let y = g.y0 + sp * 0.5; y < g.y1; y += sp) c.fillRect(g.x0 + 20, y - sp * 0.18, w - 40, sp * 0.36);
          }
        } else if (g.kind === 'paddy') {
          const sp = 1200;
          c.strokeStyle = 'rgba(120,95,55,0.5)'; c.lineWidth = 60;
          c.beginPath();
          for (let x = g.x0; x <= g.x1; x += sp) { c.moveTo(x, g.y0); c.lineTo(x, g.y1); }
          for (let y = g.y0; y <= g.y1; y += sp * 0.8) { c.moveTo(g.x0, y); c.lineTo(g.x1, y); }
          c.stroke();
          if (80 * z > 2.5) {
            c.fillStyle = 'rgba(150,120,60,0.45)';
            const st = 160;
            const vx0 = Math.max(g.x0, this.view.x0), vx1 = Math.min(g.x1, this.view.x1), vy0 = Math.max(g.y0, this.view.y0), vy1 = Math.min(g.y1, this.view.y1);
            if ((vx1 - vx0) / st * (vy1 - vy0) / st < 6000) for (let x = Math.ceil(vx0 / st) * st; x < vx1; x += st) for (let y = Math.ceil(vy0 / st) * st; y < vy1; y += st) c.fillRect(x + ((y / st) % 2) * 50, y, 22, 40);
          }
        } else if (g.kind === 'road') {
          c.fillStyle = 'rgba(120,100,70,0.18)';
          if (w > h) { c.fillRect(g.x0, g.y0, w, Math.min(40, h * 0.06)); c.fillRect(g.x0, g.y1 - Math.min(40, h * 0.06), w, Math.min(40, h * 0.06)); }
          else { c.fillRect(g.x0, g.y0, Math.min(40, w * 0.06), h); c.fillRect(g.x1 - Math.min(40, w * 0.06), g.y0, Math.min(40, w * 0.06), h); }
        } else if (g.kind === 'river') {
          const gr = c.createLinearGradient(g.x0, 0, g.x1, 0);
          gr.addColorStop(0, '#8fbfdc'); gr.addColorStop(0.15, '#6fa8cf'); gr.addColorStop(0.5, '#5f9bc5'); gr.addColorStop(0.85, '#6fa8cf'); gr.addColorStop(1, '#8fbfdc');
          c.fillStyle = gr; c.fillRect(g.x0, g.y0, w, h);
        } else if (g.kind === 'bridge') {
          c.fillStyle = '#9c7044'; c.fillRect(g.x0, g.y0, w, h);
          c.fillStyle = 'rgba(60,40,20,0.35)';
          if (60 * z > 2) for (let x = g.x0; x < g.x1; x += 120) c.fillRect(x, g.y0, 14, h);
          c.fillStyle = '#7a5532'; c.fillRect(g.x0, g.y0 - 30, w, 60); c.fillRect(g.x0, g.y1 - 30, w, 60);
        }
      }
    }

    drawForest(z, vx0, vx1, vy0, vy1) {
      const c = this.c;
      const cols = [['#3f6b3e', '#55804a'], ['#456f40', '#5e8a50'], ['#3a6038', '#4f7b45']];
      for (const f of this.forest) {
        if (f.x + f.r < vx0 || f.x - f.r > vx1 || f.y + f.r < vy0 || f.y - f.r * 2 > vy1) continue;
        if (f.r * z < 1.5) continue;
        const col = cols[f.v];
        if (f.z === 2) {
          // たけやぶ
          c.fillStyle = col[0]; c.beginPath(); c.ellipse(f.x, f.y - f.r * 0.6, f.r * 0.8, f.r * 1.3, 0, 0, TAU); c.fill();
          c.fillStyle = '#6e9a4a'; c.beginPath(); c.ellipse(f.x - f.r * 0.2, f.y - f.r * 0.9, f.r * 0.45, f.r * 0.8, 0.2, 0, TAU); c.fill();
          if (f.r * z > 8) { c.strokeStyle = '#8fb05f'; c.lineWidth = f.r * 0.08; c.beginPath(); c.moveTo(f.x + f.r * 0.3, f.y); c.lineTo(f.x + f.r * 0.35, f.y - f.r * 1.8); c.stroke(); }
        } else {
          c.fillStyle = col[0]; c.beginPath(); c.arc(f.x, f.y - f.r * 0.5, f.r, 0, TAU); c.fill();
          c.fillStyle = col[1]; c.beginPath(); c.arc(f.x - f.r * 0.25, f.y - f.r * 0.75, f.r * 0.6, 0, TAU); c.fill();
        }
      }
    }

    drawDecos(sim, z, vx0, vx1, vy0, vy1) {
      const c = this.c;
      for (const d of sim.W.decos) {
        const px = d.s * z;
        if (px < 1.6 || px > 900) continue;
        if (d.x < vx0 - d.s || d.x > vx1 + d.s || d.y < vy0 - d.s || d.y > vy1 + d.s) continue;
        const [sx, sy] = this.toScreen(d.x, d.y);
        if (d.kind === 'tobiishi') { c.fillStyle = '#b3aa98'; c.beginPath(); c.ellipse(sx, sy, px * 0.5, px * 0.32, d.r * 0.2, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.15)'; c.beginPath(); c.ellipse(sx - px * 0.1, sy - px * 0.08, px * 0.3, px * 0.15, 0, 0, TAU); c.fill(); }
        else if (d.kind === 'koke') { c.fillStyle = 'rgba(120,150,80,0.45)'; c.beginPath(); c.ellipse(sx, sy, px * 0.5, px * 0.3, d.r, 0, TAU); c.fill(); }
        else if (d.kind === 'tsubu') { c.fillStyle = 'rgba(120,100,75,0.55)'; c.fillRect(sx, sy, Math.max(1, px), Math.max(1, px * 0.7)); }
        else if (d.kind === 'kusa') {
          c.strokeStyle = sim.zoneAt(d.x, d.y) >= 4 ? 'rgba(110,130,70,0.7)' : 'rgba(120,140,70,0.75)'; c.lineWidth = Math.max(1, px * 0.08);
          c.beginPath(); for (let i = -1; i <= 1; i++) { c.moveTo(sx + i * px * 0.15, sy); c.quadraticCurveTo(sx + i * px * 0.2, sy - px * 0.5, sx + i * px * 0.4, sy - px * 0.8); } c.stroke();
        } else if (d.kind === 'nami') {
          const ph = (this.t * 0.25 + d.r) % 1;
          c.strokeStyle = 'rgba(255,255,255,' + (0.5 * Math.sin(ph * PI)).toFixed(3) + ')'; c.lineWidth = Math.max(1, px * 0.06);
          c.beginPath(); c.moveTo(sx - px * 0.5, sy + ph * px * 0.6); c.quadraticCurveTo(sx, sy - px * 0.12 + ph * px * 0.6, sx + px * 0.5, sy + ph * px * 0.6); c.stroke();
        }
      }
    }

    drawCloudShadows(sim, dt, z) {
      const c = this.c;
      c.fillStyle = 'rgba(40,60,50,0.07)';
      for (const cl of this.clouds) {
        cl.x += cl.sp * dt;
        if (cl.x > 700 * 100) cl.x = -130 * 100;
        if (cl.r * z < 30) continue;
        const [sx, sy] = this.toScreen(cl.x, cl.y);
        const r = cl.r * z;
        if (sx + r < 0 || sx - r > this.W || sy + r < 0 || sy - r > this.H) continue;
        c.beginPath(); c.ellipse(sx, sy, r, r * 0.6, 0, 0, TAU); c.fill();
      }
    }

    // ── もの
    drawObj(o, z, sim) {
      const c = this.c;
      const ty = TY[o.t];
      const px = o.s * z;
      if (px < 1.1 && ty.k !== 'tre') return;
      let [sx, sy] = this.toScreen(o.x, o.y);
      const lift = (o.z || 0) * z;
      if (o.solid && (o.t === 'kido' || o.t === 'mon' || o.t === 'saku' || o.t === 'taoreki')) { this.drawGate(o, z); return; }
      if (px < 3.5) {
        const dc = Art.dotColor[o.t];
        c.fillStyle = Array.isArray(dc) ? dc[o.v % dc.length] : (dc || '#8a7a60');
        c.fillRect(sx - px / 2, sy - px - lift, Math.max(1.2, px), Math.max(1.2, px));
        if (ty.k === 'tre') this.glint(sx, sy - lift - 3, 6);
        return;
      }
      let wob = 0;
      if (o.wob > 0) wob = Math.sin(this.t * 38 + o.id) * Math.min(1, o.wob / 0.3);
      if (o.drift) sy += Math.sin(this.t * 0.6 + o.id) * px * 0.03;
      // かげ
      if (!o.drift) {
        c.fillStyle = 'rgba(40,30,20,' + (ty.flat ? 0.12 : 0.2) + ')';
        c.beginPath(); c.ellipse(sx, sy + (ty.flat ? px * 0.05 : 0), px * (ty.flat ? 0.42 : 0.36), px * (ty.flat ? 0.2 : 0.1), 0, 0, TAU); c.fill();
      } else {
        c.fillStyle = 'rgba(60,80,90,0.08)'; c.beginPath(); c.ellipse(sx, sy + px * 0.3, px * 0.45, px * 0.12, 0, 0, TAU); c.fill();
      }
      const key = (o.t === 'kakashi' && o.content === 't_megane') ? 'kakashi_m' : o.t;
      const sp = Art.sprite(key, o.v, px);
      const sc = px / sp.unit;
      c.save();
      c.translate(sx + wob * px * 0.05, sy - lift - (ty.flat ? 0 : px * 0.45));
      if (ty.flat) c.rotate(o.rot + wob * 0.08);
      else c.rotate(o.rot * 0.6 + wob * 0.1);
      if (o.water) c.translate(0, Math.sin(this.t * 1.5 + o.id) * px * 0.02);
      c.drawImage(sp, -sp.width * sc / 2, -sp.height * sc / 2, sp.width * sc, sp.height * sc);
      // ひび
      if (ty.k === 'break' && o.hp < o.maxhp) {
        const dmg = 1 - o.hp / o.maxhp;
        c.strokeStyle = 'rgba(40,25,15,0.85)'; c.lineWidth = Math.max(1.2, px * 0.02);
        const R = TJ.rng(o.id + 3);
        c.beginPath();
        const n = Math.ceil(dmg * 4);
        for (let i = 0; i < n; i++) {
          let x = R.range(-0.25, 0.25) * px, y = R.range(-0.3, 0.2) * px;
          c.moveTo(x, y);
          for (let k = 0; k < 3; k++) { x += R.range(-0.12, 0.12) * px; y += R.range(0.04, 0.12) * px; c.lineTo(x, y); }
        }
        c.stroke();
      }
      c.restore();
      if (o.crackT > 0) o.crackT -= 1 / 60;
      if (ty.k === 'tre') this.glint(sx + px * 0.25, sy - lift - px * (ty.flat ? 0.2 : 0.7), Math.max(8, px * 0.5));
    }

    glint(x, y, s) {
      const c = this.c;
      const ph = (this.t * 1.3 + x * 0.01) % 1.6;
      if (ph > 1) return;
      const a = Math.sin(ph * PI);
      c.save(); c.translate(x, y); c.rotate(ph * 2); c.globalAlpha = a;
      c.fillStyle = '#fff6c0';
      c.beginPath();
      for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.15 : s * 0.5 * a; const an = i / 8 * TAU; c.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
      c.closePath(); c.fill(); c.restore();
    }

    drawLoose(d, z) {
      const c = this.c;
      const px = d.s * z;
      if (px < 2) return;
      const [sx, sy] = this.toScreen(d.x, d.y);
      const sp = Art.sprite(d.t, d.v, px);
      const sc = px / sp.unit;
      c.save(); c.translate(sx, sy - d.z * z - px * 0.3); c.rotate(d.rot);
      c.drawImage(sp, -sp.width * sc / 2, -sp.height * sc / 2, sp.width * sc, sp.height * sc);
      c.restore();
      if (d.frozen > 0) { c.fillStyle = 'rgba(220,240,255,0.55)'; c.beginPath(); c.arc(sx, sy - d.z * z - px * 0.3, px * 0.55, 0, TAU); c.fill(); }
    }

    // こわせる門・さく（へいの 一部）
    drawGate(o, z) {
      const c = this.c;
      const r = o.solid;
      const [x0, y0] = this.toScreen(r.x0, r.y0), [x1, y1] = this.toScreen(r.x1, r.y1);
      const w = x1 - x0, h = y1 - y0;
      let wob = o.wob > 0 ? Math.sin(this.t * 40) * 2 * this.k : 0;
      const dmg = 1 - o.hp / o.maxhp;
      c.save(); c.translate(wob, 0);
      // つむじが うしろに いるときは すかす
      const wd = this.simRef && this.simRef.wind;
      if (wd && wd.y < r.y1 && wd.y > r.y0 - 400 - wd.S && wd.x > r.x0 - wd.S && wd.x < r.x1 + wd.S) c.globalAlpha = 0.45;
      if (o.t === 'kido') {
        const ht = 110 * z;
        c.fillStyle = '#8a5f37'; c.fillRect(x0, y0 - ht, w, h + ht * 0.2);
        c.fillStyle = '#9b6c3c'; c.fillRect(x0 - w * 0.6, y0 - ht, w * 1.6, h);
        c.strokeStyle = OUT; c.lineWidth = Math.max(1, 3 * z); c.strokeRect(x0 - w * 0.6, y0 - ht, w * 1.6, h);
        c.strokeStyle = 'rgba(50,30,15,0.5)'; c.lineWidth = Math.max(1, 2 * z);
        c.beginPath(); for (let i = 1; i < 6; i++) { c.moveTo(x0 - w * 0.6, y0 - ht + h * i / 6); c.lineTo(x0 + w, y0 - ht + h * i / 6); } c.stroke();
      } else if (o.t === 'mon') {
        const ht = 210 * z;
        c.fillStyle = '#6f4a2c'; c.fillRect(x0 - 12 * z, y1 - ht - 30 * z, 24 * z, ht + 30 * z); c.fillRect(x1 - 12 * z, y1 - ht - 30 * z, 24 * z, ht + 30 * z);
        c.fillStyle = '#8a5a35'; c.fillRect(x0, y1 - ht, w, ht);
        c.strokeStyle = 'rgba(40,25,10,0.5)'; c.lineWidth = Math.max(1, 2 * z);
        c.beginPath(); for (let i = 1; i < 8; i++) { c.moveTo(x0 + w * i / 8, y1 - ht); c.lineTo(x0 + w * i / 8, y1); } c.stroke();
        c.strokeStyle = OUT; c.lineWidth = Math.max(1, 4 * z); c.strokeRect(x0, y1 - ht, w, ht); c.beginPath(); c.moveTo((x0 + x1) / 2, y1 - ht); c.lineTo((x0 + x1) / 2, y1); c.stroke();
        c.fillStyle = '#4a3b32'; c.fillRect(x0 + w * 0.3, y1 - ht * 0.55, w * 0.4, 12 * z);
        c.fillStyle = '#4a4a52'; c.beginPath(); c.moveTo(x0 - 40 * z, y1 - ht - 20 * z); c.lineTo(x0 + 20 * z, y1 - ht - 70 * z); c.lineTo(x1 - 20 * z, y1 - ht - 70 * z); c.lineTo(x1 + 40 * z, y1 - ht - 20 * z); c.closePath(); c.fill(); c.stroke();
      } else if (o.t === 'saku') {
        const ht = 240 * z;
        for (let i = 0; i < 10; i++) { const yy = y0 + h * i / 10; c.fillStyle = i % 2 ? '#8fb05f' : '#7fa04f'; c.fillRect(x0 - w * 0.3, yy - ht, w * 1.6, h / 10 + 1); }
        c.strokeStyle = '#6f4a2c'; c.lineWidth = Math.max(1, 8 * z); c.beginPath(); c.moveTo(x0 + w / 2, y0 - ht * 0.6); c.lineTo(x0 + w / 2, y1 - ht * 0.6); c.moveTo(x0 + w / 2, y0 - ht * 0.2); c.lineTo(x0 + w / 2, y1 - ht * 0.2); c.stroke();
        c.strokeStyle = OUT; c.lineWidth = Math.max(1, 3 * z); c.strokeRect(x0 - w * 0.3, y0 - ht, w * 1.6, h);
      } else if (o.t === 'taoreki') {
        const ht = 120 * z;
        c.fillStyle = '#6f4a2c'; c.fillRect(x0 + w * 0.2, y0 - ht, w * 0.6, h);
        c.strokeStyle = OUT; c.lineWidth = Math.max(1, 6 * z); c.strokeRect(x0 + w * 0.2, y0 - ht, w * 0.6, h);
        c.fillStyle = '#2f5a35';
        for (let i = 0; i < 8; i++) { c.beginPath(); c.ellipse(x0 + (i % 2 ? w : 0), y0 - ht + h * (i + 0.5) / 8, w * 0.5, h * 0.06, 0, 0, TAU); c.fill(); }
        c.fillStyle = '#d9b47d'; c.beginPath(); c.ellipse(x0 + w / 2, y1 - ht, w * 0.3, w * 0.12, 0, 0, TAU); c.fill();
      }
      if (dmg > 0) {
        c.strokeStyle = 'rgba(30,20,10,0.9)'; c.lineWidth = Math.max(1.5, 3 * this.k);
        const R = TJ.rng(o.id + 9);
        c.beginPath();
        for (let i = 0; i < Math.ceil(dmg * 5); i++) { let x = x0 + R() * w, y = y0 + R() * h - 60 * z; c.moveTo(x, y); for (let k = 0; k < 3; k++) { x += R.range(-1, 1) * 15 * z + 3; y += R.range(10, 30) * z; c.lineTo(x, y); } }
        c.stroke();
      }
      c.restore();
    }

    // ── 建物・へい
    drawStruct(sg, sim, z) {
      const c = this.c;
      const s = sg.s;
      const lw = (n) => Math.max(1 / z, n);
      const x0 = sg.x0, x1 = sg.x1, y0 = sg.y0, y1 = sg.y1, w = x1 - x0, h = y1 - y0;
      c.lineJoin = 'round';
      // つむじが うしろ（北がわ）に かくれるときは すかす
      const HT = { hedge: 80, fence: 125, ishigaki: 140, takegaki: 270, sugi: 3200, house: 600, naya: 500, minka: 450, shop: 520, toriya: 200 }[s.draw];
      const wd = sim.wind;
      let fade = false;
      if (HT && wd.y < y1 && wd.y > y0 - HT && wd.x > x0 - wd.S * 0.7 && wd.x < x1 + wd.S * 0.7 && wd.S * 1.2 < HT + (y1 - wd.y) + wd.S) { fade = true; c.globalAlpha = 0.45; }
      this.drawStruct2(sg, s, x0, x1, y0, y1, w, h, lw, z);
      if (fade) c.globalAlpha = 1;
    }
    drawStruct2(sg, s, x0, x1, y0, y1, w, h, lw, z) {
      const c = this.c;
      switch (s.draw) {
        case 'hedge': {
          const ht = 75;
          c.fillStyle = '#4f7f42';
          if (sg.seg || h > w) {
            for (let y = y0; y < y1; y += 14) { c.beginPath(); c.arc(x0 + w / 2 + ((y / 14) % 2) * 6 - 3, y + 7 - ht, 20, 0, TAU); c.fill(); }
            c.fillStyle = '#5f9450'; for (let y = y0; y < y1; y += 14) { c.beginPath(); c.arc(x0 + w / 2 - 7, y + 3 - ht, 9, 0, TAU); c.fill(); }
          } else {
            c.fillRect(x0, y1 - ht, w, ht);
            for (let x = x0; x < x1; x += 12) { c.beginPath(); c.arc(x + 6, y1 - ht + ((x / 12) % 2) * 4, 10, 0, TAU); c.fill(); }
            c.fillStyle = '#5f9450'; for (let x = x0; x < x1; x += 12) { c.beginPath(); c.arc(x + 4, y1 - ht - 4, 5.5, 0, TAU); c.fill(); }
            c.fillStyle = '#3f6e36'; for (let x = x0; x < x1; x += 18) { c.beginPath(); c.arc(x + 9, y1 - ht * 0.45, 4, 0, TAU); c.fill(); }
            c.fillStyle = 'rgba(30,50,20,0.25)'; c.fillRect(x0, y1 - 12, w, 12);
          }
          if (z > 0.6) { c.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < w * h / 900 && i < 60; i++) { const R = TJ.rng(i + (x0 | 0)); c.fillRect(x0 + R() * w, y0 - ht + R() * (h + ht * 0.5), 3, 2); } }
          break;
        }
        case 'fence': {
          const ht = 120;
          c.fillStyle = '#6f4a2c'; c.fillRect(x0 - 8, y0 - ht, w + 16, h + 4);
          c.strokeStyle = 'rgba(40,25,10,0.5)'; c.lineWidth = lw(2);
          c.beginPath(); for (let y = y0; y < y1; y += 18) { c.moveTo(x0 - 8, y - ht); c.lineTo(x1 + 8, y - ht); } c.stroke();
          c.fillStyle = '#4a3020'; c.fillRect(x0 - 12, y0 - ht - 8, w + 24, 10);
          c.strokeStyle = OUT; c.lineWidth = lw(2.5); c.strokeRect(x0 - 8, y0 - ht, w + 16, h + 4);
          break;
        }
        case 'ishigaki': case 'takegaki': {
          const ht = s.draw === 'ishigaki' ? 130 : 260;
          const col = s.draw === 'ishigaki' ? '#a8a295' : '#9fbd6a';
          if (h > w * 1.5) {
            c.fillStyle = col; c.fillRect(x0 - w * 0.3, y0 - ht, w * 1.6, h);
            c.strokeStyle = s.draw === 'ishigaki' ? 'rgba(60,55,45,0.4)' : 'rgba(60,90,30,0.5)'; c.lineWidth = lw(3);
            c.beginPath(); for (let y = y0; y < y1; y += (s.draw === 'ishigaki' ? 40 : 30)) { c.moveTo(x0 - w * 0.3, y - ht); c.lineTo(x1 + w * 0.3, y - ht); } c.stroke();
            c.strokeStyle = OUT; c.lineWidth = lw(3); c.strokeRect(x0 - w * 0.3, y0 - ht, w * 1.6, h);
          } else {
            c.fillStyle = col; c.fillRect(x0, y1 - ht, w, ht);
            c.fillStyle = s.draw === 'ishigaki' ? '#bdb7a9' : '#b3cf7e'; c.fillRect(x0, y1 - ht - h * 0.6, w, h * 0.6);
            c.strokeStyle = s.draw === 'ishigaki' ? 'rgba(60,55,45,0.35)' : 'rgba(60,90,30,0.45)'; c.lineWidth = lw(3);
            c.beginPath();
            if (s.draw === 'ishigaki') {
              for (let yy = y1 - ht; yy < y1; yy += 32) { const off = ((yy / 32) | 0) % 2 ? 0 : 30; for (let x = x0 + off; x < x1; x += 60) { c.moveTo(x, yy); c.lineTo(x, yy + 32); } c.moveTo(x0, yy); c.lineTo(x1, yy); }
            } else { for (let x = x0; x < x1; x += 12) { c.moveTo(x, y1 - ht); c.lineTo(x, y1); } c.moveTo(x0, y1 - ht * 0.6); c.lineTo(x1, y1 - ht * 0.6); }
            c.stroke();
            c.strokeStyle = OUT; c.lineWidth = lw(3); c.strokeRect(x0, y1 - ht - h * 0.6, w, ht + h * 0.6);
          }
          break;
        }
        case 'sugi': {
          const R = TJ.rng((y0 | 0) + 7);
          for (let i = 0; i < 3; i++) {
            const x = x0 + R() * w, hh = R.range(2200, 3200), r = R.range(380, 520);
            const yb = y0 + R() * h;
            c.fillStyle = '#5a3e2a'; c.fillRect(x - 40, yb - hh * 0.3, 80, hh * 0.3);
            c.fillStyle = i % 2 ? '#2f5a35' : '#3a6a3e';
            c.beginPath(); c.moveTo(x, yb - hh); c.lineTo(x + r, yb - hh * 0.25); c.lineTo(x - r, yb - hh * 0.25); c.closePath(); c.fill();
            c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.moveTo(x, yb - hh); c.lineTo(x - r * 0.2, yb - hh * 0.4); c.lineTo(x - r * 0.7, yb - hh * 0.3); c.closePath(); c.fill();
          }
          break;
        }
        case 'house': this.drawHouse(sg, z, 'farm'); break;
        case 'naya': this.drawHouse(sg, z, 'kura'); break;
        case 'minka': this.drawHouse(sg, z, 'minka', s.v); break;
        case 'shop': this.drawHouse(sg, z, 'shop', s.v); break;
        case 'toriya': {
          c.fillStyle = '#9b7348'; c.fillRect(x0, y1 - 180, w, 180);
          c.fillStyle = 'rgba(255,255,255,0.35)'; for (let x = x0 + 20; x < x1 - 20; x += 22) c.fillRect(x, y1 - 150, 2, 110);
          c.fillStyle = '#6b5a4a'; c.beginPath(); c.moveTo(x0 - 20, y1 - 175); c.lineTo(x0 + 30, y1 - 175 - h * 0.7); c.lineTo(x1 - 30, y1 - 175 - h * 0.7); c.lineTo(x1 + 20, y1 - 175); c.closePath(); c.fill();
          c.strokeStyle = OUT; c.lineWidth = lw(3); c.stroke(); c.strokeRect(x0, y1 - 180, w, 180);
          break;
        }
      }
    }

    drawHouse(sg, z, kind, v) {
      const c = this.c;
      const x0 = sg.x0, x1 = sg.x1, y0 = sg.y0, y1 = sg.y1, w = x1 - x0, h = y1 - y0;
      const lw = (n) => Math.max(1 / z, n);
      c.strokeStyle = OUT; c.lineJoin = 'round';
      if (kind === 'farm') {
        // えんがわ
        c.fillStyle = '#5a3b26'; c.fillRect(x0, y1 - 45, w, 45);
        c.fillStyle = '#4a3020'; for (let x = x0 + 60; x < x1; x += 300) c.fillRect(x, y1 - 45, 14, 45);
        c.fillStyle = '#c99a62'; c.fillRect(x0, y1 - 95, w, 50);
        c.strokeStyle = 'rgba(90,60,30,0.4)'; c.lineWidth = lw(1.5); c.beginPath(); for (let yy = y1 - 95; yy < y1 - 45; yy += 12) { c.moveTo(x0, yy); c.lineTo(x1, yy); } c.stroke();
        c.strokeStyle = OUT; c.lineWidth = lw(2); c.strokeRect(x0, y1 - 95, w, 95);
        // くつぬぎ石
        c.fillStyle = '#a8a295'; c.beginPath(); c.ellipse(80, y1 + 2, 45, 14, 0, 0, TAU); c.fill(); c.stroke();
        // しょうじ
        const wt = y1 - 95, wh = 220;
        c.fillStyle = '#f6f0e0'; c.fillRect(x0, wt - wh, w, wh);
        c.strokeStyle = '#8a6a48'; c.lineWidth = lw(3);
        c.beginPath(); for (let x = x0; x <= x1; x += 90) { c.moveTo(x, wt - wh); c.lineTo(x, wt); } c.stroke();
        c.strokeStyle = 'rgba(138,106,72,0.6)'; c.lineWidth = lw(1);
        c.beginPath(); for (let x = x0; x < x1; x += 22.5) { c.moveTo(x, wt - wh); c.lineTo(x, wt); } for (let yy = wt - wh; yy < wt; yy += 30) { c.moveTo(x0, yy); c.lineTo(x1, yy); } c.stroke();
        c.fillStyle = '#6f4a2c'; for (let x = x0; x <= x1; x += 360) c.fillRect(x - 8, wt - wh - 10, 16, wh + 10);
        // かやぶき やね
        const eave = wt - wh + 30;
        c.fillStyle = '#b39360';
        c.beginPath(); c.moveTo(x0 - 120, eave); c.lineTo(x0 + 200, y0 + 80); c.lineTo(x1 - 200, y0 + 80); c.lineTo(x1 + 120, eave); c.closePath(); c.fill();
        c.fillStyle = 'rgba(90,70,40,0.25)';
        for (let i = 0; i < 9; i++) { const yy = eave - (eave - y0 - 80) * i / 9; c.fillRect(x0 - 120 + 320 * i / 9, yy - 8, w + 240 - 640 * i / 9, 6); }
        c.fillStyle = '#8a6c42'; c.fillRect(x0 - 120, eave - 25, w + 240, 25);
        c.fillStyle = '#4a3b32'; c.fillRect(x0 + 200, y0 + 40, w - 400, 50);
        c.lineWidth = lw(3); c.strokeStyle = OUT;
        c.beginPath(); c.moveTo(x0 - 120, eave); c.lineTo(x0 + 200, y0 + 80); c.lineTo(x1 - 200, y0 + 80); c.lineTo(x1 + 120, eave); c.closePath(); c.stroke();
        // しめかざり（げんかん）
        c.strokeStyle = '#d4b06a'; c.lineWidth = lw(10); c.beginPath(); c.moveTo(-160, wt - wh + 6); c.quadraticCurveTo(-60, wt - wh + 40, 40, wt - wh + 6); c.stroke();
        return;
      }
      const wallH = kind === 'kura' ? 380 : 300;
      const wallCol = kind === 'kura' ? '#f3efe4' : (kind === 'shop' ? '#e8dcc2' : ['#ece2cc', '#e3d6bb', '#efe6d2'][(v || 0) % 3]);
      const roofCol = kind === 'kura' ? '#3f4650' : ['#4a5560', '#5a4e48', '#46586a', '#6a5040'][(v || 0) % 4];
      // かべ
      c.fillStyle = wallCol; c.fillRect(x0, y1 - wallH, w, wallH);
      if (kind === 'kura') { c.fillStyle = '#3b3f46'; c.fillRect(x0, y1 - 110, w, 110); c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = lw(2); c.beginPath(); for (let x = x0; x < x1; x += 40) { c.moveTo(x, y1 - 110); c.lineTo(x + 40, y1); c.moveTo(x + 40, y1 - 110); c.lineTo(x, y1); } c.stroke(); c.fillStyle = '#2a2422'; c.fillRect(x0 + w * 0.4, y1 - wallH * 0.75, w * 0.2, wallH * 0.75); }
      else {
        c.fillStyle = '#6f4a2c'; for (let x = x0; x <= x1; x += Math.max(150, w / 5)) c.fillRect(x - 10, y1 - wallH, 20, wallH);
        c.fillStyle = '#7a5532'; c.fillRect(x0, y1 - 40, w, 40);
        if (kind === 'shop') {
          // のれん と かんばん
          const nx = x0 + w * 0.25, nw = w * 0.5;
          c.fillStyle = '#2f4b7a'; c.fillRect(nx, y1 - wallH + 40, nw, 110);
          c.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 1; i < 4; i++) c.fillRect(nx + nw * i / 4 - 2, y1 - wallH + 70, 4, 80);
          c.fillStyle = '#6f4a2c'; c.fillRect(x0 + w * 0.2, y1 - wallH - 70, w * 0.6, 70);
          if (z * 60 > 6) H.txt.call(null, c, (v === 6 ? 'だるま屋' : v === 5 ? '酒・みそ' : 'よろず屋'), x0 + w / 2, y1 - wallH - 35, 50, '#f6e7c2');
        } else {
          c.fillStyle = '#d9c9a4'; c.fillRect(x0 + w * 0.15, y1 - wallH + 60, w * 0.25, 120); c.fillRect(x0 + w * 0.6, y1 - wallH + 60, w * 0.25, 120);
          c.strokeStyle = 'rgba(110,80,50,0.6)'; c.lineWidth = lw(2);
          c.beginPath(); for (const xx of [x0 + w * 0.15, x0 + w * 0.6]) { for (let i = 1; i < 4; i++) { c.moveTo(xx + w * 0.25 * i / 4, y1 - wallH + 60); c.lineTo(xx + w * 0.25 * i / 4, y1 - wallH + 180); } } c.stroke();
        }
      }
      c.strokeStyle = OUT; c.lineWidth = lw(3); c.strokeRect(x0, y1 - wallH, w, wallH);
      // やね（かわら）
      const eave = y1 - wallH + 20;
      c.fillStyle = roofCol;
      c.beginPath(); c.moveTo(x0 - 80, eave); c.lineTo(x0 + 40, y0 + 60); c.lineTo(x1 - 40, y0 + 60); c.lineTo(x1 + 80, eave); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = lw(6);
      c.beginPath(); for (let x = x0 - 40; x < x1 + 40; x += 70) { c.moveTo(x, eave); c.lineTo(x0 + 40 + (x - x0 + 40) * (w - 80) / (w + 80), y0 + 60); } c.stroke();
      c.strokeStyle = OUT; c.lineWidth = lw(3);
      c.beginPath(); c.moveTo(x0 - 80, eave); c.lineTo(x0 + 40, y0 + 60); c.lineTo(x1 - 40, y0 + 60); c.lineTo(x1 + 80, eave); c.closePath(); c.stroke();
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x0 + 40, y0 + 40, w - 80, 30);
    }

    // ── 木
    drawTree(tr, z, sim) {
      const c = this.c;
      const [sx, sy] = this.toScreen(tr.x, tr.y);
      const cr = tr.crown * z, rt = Math.max(1.5, tr.r * z);
      if (cr < 2) return;
      const sh = tr.shake > 0 ? Math.sin(this.t * 32) * tr.shake * cr * 0.06 : 0;
      c.fillStyle = 'rgba(30,40,25,0.18)'; c.beginPath(); c.ellipse(sx, sy, cr * 0.8, cr * 0.25, 0, 0, TAU); c.fill();
      const cx = sx + sh, cy = sy - cr * 1.15;
      // うしろに つむじが いたら すこし すかす
      const [wx, wy] = this.toScreen(sim.wind.x, sim.wind.y);
      const D = sim.wind.S * z;
      const behind = sim.wind.y < tr.y && Math.abs(wx - cx) < cr + D * 0.3 && wy - D * 0.6 > cy - cr * 1.2 && wy - D < cy + cr;
      c.save();
      if (behind) c.globalAlpha = 0.45;
      if (cr > this.H * 0.45) c.globalAlpha = Math.min(c.globalAlpha, 0.3);
      c.fillStyle = '#5a3e2a'; c.strokeStyle = OUT; c.lineWidth = Math.max(1, rt * 0.25);
      c.beginPath(); c.moveTo(sx - rt, sy); c.lineTo(sx - rt * 0.6 + sh * 0.5, cy + cr * 0.3); c.lineTo(sx + rt * 0.6 + sh * 0.5, cy + cr * 0.3); c.lineTo(sx + rt, sy); c.closePath(); c.fill(); c.stroke();
      const k = tr.kind;
      if (k === 'ume' || k === 'kaki') {
        c.strokeStyle = '#5a3e2a'; c.lineWidth = Math.max(1, rt * 0.6);
        const R = TJ.rng(tr.id * 13);
        const tips = [];
        c.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = -PI / 2 + R.range(-1.2, 1.2), l = cr * R.range(0.6, 1.05);
          const bx = cx + Math.cos(a) * l, by = cy + cr * 0.25 + Math.sin(a) * l * 0.8;
          c.moveTo(sx + sh * 0.5, cy + cr * 0.35); c.quadraticCurveTo(sx + (bx - sx) * 0.4, by + cr * 0.2, bx, by);
          tips.push([bx, by]);
        }
        c.stroke();
        if (k === 'ume') {
          for (let i = 0; i < 40; i++) { const tp = tips[i % tips.length]; const a = R() * TAU, d = R() * cr * 0.35; c.fillStyle = i % 3 ? '#f6b7c8' : '#fdf0f3'; c.beginPath(); c.arc(tp[0] + Math.cos(a) * d - (tp[0] - cx) * R() * 0.5, tp[1] + Math.sin(a) * d - (tp[1] - cy) * R() * 0.5, Math.min(6 * this.k, Math.max(1, cr * 0.05)), 0, TAU); c.fill(); }
        } else {
          const left = tr.fruitN - tr.dropped;
          for (let i = 0; i < left; i++) { const tp = tips[i % tips.length]; const f = 0.3 + (i * 0.37) % 0.6; c.fillStyle = '#ee7a22'; c.beginPath(); c.arc(cx + (tp[0] - cx) * f, cy + (tp[1] - cy) * f, Math.max(1.2, cr * 0.07), 0, TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = Math.max(0.6, cr * 0.012); c.stroke(); }
        }
      } else if (k === 'mikan' || k === 'kusu' || k === 'matsu') {
        const cols = k === 'mikan' ? ['#2f6a35', '#3f7f42'] : k === 'kusu' ? ['#3b6e3c', '#4f8a4a'] : ['#2d5a38', '#3c6e45'];
        const blobs = k === 'matsu' ? [[0, 0.1, 0.75, 0.32], [-0.35, -0.25, 0.55, 0.25], [0.4, -0.3, 0.5, 0.22], [0, -0.55, 0.45, 0.2]] : [[0, 0, 0.95, 0.85], [-0.4, -0.2, 0.55, 0.5], [0.4, -0.25, 0.55, 0.5], [0, -0.45, 0.6, 0.5]];
        for (let i = 0; i < blobs.length; i++) { const b = blobs[i]; c.fillStyle = cols[i % 2]; c.beginPath(); c.ellipse(cx + b[0] * cr, cy + b[1] * cr, b[2] * cr, b[3] * cr * (k === 'matsu' ? 1 : 0.9), 0, 0, TAU); c.fill(); }
        c.strokeStyle = 'rgba(20,40,20,0.5)'; c.lineWidth = Math.max(1, cr * 0.02);
        c.beginPath(); c.ellipse(cx, cy, cr * 0.95, cr * (k === 'matsu' ? 0.32 : 0.77), 0, 0, TAU); if (k !== 'matsu') c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.1)'; c.beginPath(); c.ellipse(cx - cr * 0.3, cy - cr * 0.35, cr * 0.35, cr * 0.2, -0.3, 0, TAU); c.fill();
        if (k === 'mikan') { const left = tr.fruitN - tr.dropped; for (let i = 0; i < left; i++) { const a = i * 2.4, d = 0.3 + (i * 0.23) % 0.55; c.fillStyle = '#f39223'; c.beginPath(); c.arc(cx + Math.cos(a) * d * cr * 0.8, cy + Math.sin(a) * d * cr * 0.6, Math.max(1.2, cr * 0.07), 0, TAU); c.fill(); } }
      } else if (k === 'yanagi') {
        c.strokeStyle = '#a8b86a'; c.lineWidth = Math.max(1, cr * 0.03);
        c.beginPath();
        for (let i = 0; i < 14; i++) { const x = cx - cr * 0.9 + i * cr * 0.14; const sw = Math.sin(this.t * 1.2 + i) * cr * 0.05; c.moveTo(cx + (x - cx) * 0.3, cy - cr * 0.5); c.quadraticCurveTo(x, cy - cr * 0.6, x + sw, cy + cr * 0.6); }
        c.stroke();
        c.fillStyle = 'rgba(150,170,90,0.5)'; c.beginPath(); c.ellipse(cx, cy - cr * 0.4, cr * 0.7, cr * 0.3, 0, 0, TAU); c.fill();
      }
      c.restore();
    }

    // ── いきもの
    drawCreature(cr, z, sim) {
      const c = this.c;
      const [sx, sy] = this.toScreen(cr.x, cr.y);
      if (cr.kind === 'villager') { this.drawPerson(sx, sy, Math.max(14, cr.s * z), cr.look, cr, sim); return; }
      const px = Math.max(cr.kind === 'duck' ? 8 : 10, cr.s * z);
      if (px < 4) return;
      c.save(); c.translate(sx, sy);
      c.fillStyle = 'rgba(40,30,20,0.2)'; c.beginPath(); c.ellipse(0, 0, px * 0.4, px * 0.1, 0, 0, TAU); c.fill();
      c.scale((cr.face || 1) * px / 100, px / 100);
      c.lineWidth = 4; c.strokeStyle = OUT; c.lineJoin = 'round';
      if (cr.kind === 'cat') {
        if (cr.st === 'sleep') {
          H.ell(c, 0, -22, 48, 26, 0, '#fbf6ea', OUT, 4);
          H.ell(c, -18, -30, 18, 12, 0.3, '#e08a3a', false); H.ell(c, 20, -18, 16, 10, 0, '#3a3030', false);
          H.circ(c, 34, -28, 18, '#fbf6ea', OUT, 4);
          H.poly(c, [24, -42, 28, -58, 38, -44], '#fbf6ea', OUT, 4); H.poly(c, [38, -44, 46, -56, 48, -38], '#e08a3a', OUT, 4);
          H.arcS(c, 30, -28, 4, 0.2, PI - 0.2, OUT, 3); H.arcS(c, 40, -28, 4, 0.2, PI - 0.2, OUT, 3);
          c.scale(1 / (cr.face || 1), 1);
          const zz = (this.t * 0.8) % 1;
          c.globalAlpha = 1 - zz; c.fillStyle = '#3b4a6a'; c.font = '700 22px sans-serif'; c.fillText('z', 40 + zz * 20, -60 - zz * 30); c.globalAlpha = 1;
        } else {
          const b = Math.sin(this.t * 25) * 4;
          H.ell(c, 0, -26 + b, 44, 18, 0, '#fbf6ea', OUT, 4);
          H.ell(c, -10, -32 + b, 14, 9, 0, '#e08a3a', false);
          H.circ(c, 40, -40 + b, 16, '#fbf6ea', OUT, 4);
          H.poly(c, [32, -52 + b, 34, -66 + b, 44, -54 + b], '#3a3030', OUT, 3);
          H.ln(c, -40, -30 + b, -64, -52 + b, OUT, 6);
          for (const lx of [-28, -14, 16, 28]) H.ln(c, lx, -12 + b, lx + (Math.sin(this.t * 25 + lx) * 8), 0, OUT, 5);
          H.circ(c, 44, -42 + b, 3, OUT, false);
        }
      } else if (cr.kind === 'chicken') {
        const b = cr.run > 0 ? Math.sin(this.t * 30) * 4 : 0;
        if (cr.flap > 0) { H.ell(c, -10, -50, 28, 12, -0.6 + Math.sin(this.t * 40) * 0.5, '#fff', OUT, 3); }
        H.ln(c, -6, -14, -10, 0, '#e8a33a', 4); H.ln(c, 8, -14, 12, 0, '#e8a33a', 4);
        H.ell(c, 0, -34 + b, 30, 22, 0, '#fbfaf5', OUT, 4);
        H.poly(c, [-28, -40 + b, -44, -60 + b, -36, -36 + b], '#fbfaf5', OUT, 3);
        H.circ(c, 22, -56 + b, 13, '#fbfaf5', OUT, 4);
        H.poly(c, [16, -68 + b, 20, -78 + b, 26, -70 + b, 30, -76 + b, 30, -66 + b], '#e2453a', OUT, 2);
        H.poly(c, [33, -58 + b, 44, -54 + b, 33, -51 + b], '#f2b544', OUT, 2);
        H.circ(c, 25, -58 + b, 2.5, OUT, false);
      } else if (cr.kind === 'duck') {
        const b = Math.sin(this.t * 2 + cr.y) * 3;
        H.ell(c, 0, -10 + b, 34, 14, 0, '#8a6a48', OUT, 4);
        H.ell(c, -4, -16 + b, 18, 8, 0, '#b8a080', false);
        H.circ(c, 24, -30 + b, 12, '#2f7a4a', OUT, 4);
        H.poly(c, [34, -30 + b, 48, -27 + b, 34, -24 + b], '#f2b544', OUT, 2);
        c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, -2, 44, 8, 0, 0.2, PI - 0.2); c.stroke();
      }
      c.restore();
    }

    drawBirds(sim, z) {
      const c = this.c;
      for (const cr of sim.W.creatures) {
        if ((cr.kind !== 'crow' && cr.kind !== 'tobi') || cr.x === undefined) continue;
        const [sx, sy] = this.toScreen(cr.x, cr.y);
        const hy = sy - cr.h * z;
        if (sx < -100 || sx > this.W + 100 || hy < -100 || sy > this.H + 200) continue;
        const px = Math.max(cr.kind === 'tobi' ? 30 : 22, cr.s * z) * this.k;
        c.fillStyle = 'rgba(30,30,30,0.12)'; c.beginPath(); c.ellipse(sx, sy, px * 0.4, px * 0.1, 0, 0, TAU); c.fill();
        c.save(); c.translate(sx, hy); c.scale((cr.face || 1) * px / 100, px / 100);
        const flap = Math.sin(this.t * (cr.kind === 'tobi' ? 4 : 10) + cr.cx) * (cr.kind === 'tobi' ? 0.3 : 1);
        const col = cr.kind === 'tobi' ? '#6b4a32' : '#23232b';
        c.strokeStyle = OUT; c.lineWidth = 3;
        H.poly(c, [-10, -4, -60, -30 - flap * 30, -40, 0], col, OUT, 3);
        H.poly(c, [10, -4, 60, -30 - flap * 30, 40, 0], col, OUT, 3);
        H.ell(c, 0, 0, 30, 14, 0, col, OUT, 3);
        H.circ(c, 26, -6, 11, col, OUT, 3);
        H.poly(c, [34, -8, 50, -4, 34, -1], cr.kind === 'tobi' ? '#e8b84a' : '#3a3a40', OUT, 2);
        H.poly(c, [-28, -2, -46, -10, -46, 8], col, OUT, 3);
        H.circ(c, 29, -9, 2.5, '#fff', false);
        if (cr.item) {
          c.scale(1 / (cr.face || 1), 1);
          const sp = Art.sprite(cr.item, 0, 40);
          const sc = 34 / sp.unit;
          c.drawImage(sp, 40 * (cr.face || 1) - sp.width * sc / 2, 14 - sp.height * sc / 2, sp.width * sc, sp.height * sc);
        }
        c.restore();
        if (cr.item) this.glint(sx + px * 0.4 * (cr.face || 1), hy + px * 0.1, px * 0.55);
      }
    }

    drawPerson(sx, sy, ph, look, cr, sim) {
      const c = this.c;
      const coats = ['#3f5f9a', '#8a4a3a', '#4f7a4a', '#7a5a8a', '#5a6a72', '#a0703f'];
      c.save(); c.translate(sx, sy);
      c.fillStyle = 'rgba(40,30,20,0.2)'; c.beginPath(); c.ellipse(0, 0, ph * 0.18, ph * 0.05, 0, 0, TAU); c.fill();
      const s = ph / 160;
      c.scale(s * ((cr && cr.face) || 1), s);
      c.lineWidth = 4; c.strokeStyle = OUT;
      const walk = cr && cr.react <= 0 ? Math.sin((cr.t || 0) * 9) * 8 : 0;
      H.ln(c, -10, -50, -12 + walk, 0, '#3a3530', 9); H.ln(c, 10, -50, 12 - walk, 0, '#3a3530', 9);
      H.rr(c, -26, -120, 52, 74, 12, coats[look % coats.length]);
      const react = cr && cr.react > 0;
      if (react) { H.ln(c, -20, -110, -30, -150, coats[look % coats.length], 10); H.ln(c, 20, -110, 30, -150, coats[look % coats.length], 10); }
      H.circ(c, 0, -138, 22, '#f6dcc0');
      H.circ(c, -7, -140, 2.5, OUT, false); H.circ(c, 7, -140, 2.5, OUT, false);
      if (react) H.circ(c, 0, -128, 5, OUT, false); else H.arcS(c, 0, -132, 6, 0.3, PI - 0.3, OUT, 2.5);
      if (cr && cr.item) {
        const sp = Art.sprite(cr.item, cr.iv || 0, 60);
        const sz = TY[cr.item].s * 0.9;
        const sc = sz / sp.unit;
        c.drawImage(sp, -sp.width * sc / 2, -150 - sz * 0.3 - sp.height * sc / 2, sp.width * sc, sp.height * sc);
      } else { c.fillStyle = '#3a3030'; c.beginPath(); c.arc(0, -146, 22, PI, TAU); c.fill(); }
      c.restore();
      if (react) { c.fillStyle = '#fff'; c.strokeStyle = OUT; c.lineWidth = 2; const bx = sx + ph * 0.2, by = sy - ph * 1.2; c.beginPath(); c.arc(bx, by, ph * 0.12 + 4, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#d63a3a'; c.font = '900 ' + Math.round(ph * 0.16 + 6) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', bx, by + 1); }
    }

    drawPeople(p, z, sim) {
      const c = this.c;
      const [sx, sy] = this.toScreen(p.x, p.y);
      const ph = Math.max(p.crowd ? 6 : 16, p.s * z);
      if (ph < 5) return;
      c.save(); c.translate(sx, sy);
      c.fillStyle = 'rgba(40,30,20,0.2)'; c.beginPath(); c.ellipse(0, 0, ph * 0.18, ph * 0.05, 0, 0, TAU); c.fill();
      const s = ph / 160; c.scale(s, s);
      c.lineWidth = 4; c.strokeStyle = OUT;
      const k = sim.W.kites[p.kite];
      const lifted = k && k.st === 1;
      const cheer = lifted && k.t < 4 ? Math.abs(Math.sin(this.t * 8)) * 18 : (p.crowd && sim.ending ? Math.abs(Math.sin(this.t * 7 + p.x)) * 14 : 0);
      c.translate(0, -cheer);
      const who = p.who;
      const coat = ['#e2453a', '#3d7cc4', '#8a5a8a', '#4f6a7a'][who] || ['#3f5f9a', '#8a4a3a', '#4f7a4a', '#7a5a8a', '#5a6a72', '#a0703f'][who % 6];
      const small = who === 0 || who === 1;
      const body = small ? 0.8 : 1;
      c.scale(body, body);
      H.ln(c, -10, -50, -12, 0, '#3a3530', 9); H.ln(c, 10, -50, 12, 0, '#3a3530', 9);
      H.rr(c, -26, -120, 52, 74, 12, coat);
      if (who === 2) { H.rr(c, -20, -110, 40, 60, 6, '#f2efe4'); }
      // うで（凧糸を もつ）
      const up = lifted || (p.crowd && sim.ending);
      H.ln(c, 18, -105, up ? 40 : 30, up ? -150 : -80, coat, 10);
      H.ln(c, -18, -105, up && cheer ? -40 : -30, up && cheer ? -150 : -80, coat, 10);
      H.circ(c, 0, -138, 22, '#f6dcc0');
      H.circ(c, -7, -140, 2.5, OUT, false); H.circ(c, 7, -140, 2.5, OUT, false);
      H.arcS(c, 0, -132, 6, 0.3, PI - 0.3, OUT, 2.5);
      if (who === 0) { c.fillStyle = '#2a2422'; c.beginPath(); c.arc(0, -146, 22, PI * 0.9, TAU + 0.1); c.fill(); H.circ(c, -24, -136, 8, '#2a2422', false); H.circ(c, 24, -136, 8, '#2a2422', false); H.circ(c, -24, -136, 3, '#e2453a', false); }
      else if (who === 1) { H.ell(c, 0, -156, 26, 10, 0, '#3d7cc4'); H.rr(c, -22, -170, 44, 16, 6, '#3d7cc4'); }
      else if (who === 2) { c.fillStyle = '#d8d8d8'; c.beginPath(); c.arc(0, -150, 22, PI, TAU); c.fill(); H.circ(c, 0, -170, 10, '#d8d8d8', false); }
      else if (who === 3) { c.fillStyle = '#e8e2d2'; c.beginPath(); c.arc(0, -150, 22, PI, TAU); c.fill(); H.rr(c, -24, -156, 48, 8, 3, '#fbf6ea'); H.ln(c, -8, -128, 8, -128, '#e8e2d2', 4); }
      else { c.fillStyle = ['#3a3030', '#5a4030', '#2a2a32'][who % 3]; c.beginPath(); c.arc(0, -146, 22, PI, TAU); c.fill(); }
      c.restore();
    }

    // ── 凧
    drawKiteGround(k, z, sim) {
      const c = this.c;
      const [sx, sy] = this.toScreen(k.x, k.y);
      const px = Math.max(16, k.s * z);
      const key = ['k_yakko', 'k_kaku', 'k_semi', 'k_ren', 'k_oodako'][k.i];
      c.fillStyle = 'rgba(40,30,20,0.18)'; c.beginPath(); c.ellipse(sx, sy, px * 0.5, px * 0.18, 0, 0, TAU); c.fill();
      const active = sim.kiteIdx === k.i;
      const ready = active && sim.wind.S >= k.req && !(k.i === 4 && sim.boss.st !== 'gone');
      if (k.i === 3) {
        for (let i = 0; i < 8; i++) { const sp = Art.sprite('k_ren', 0, px * 0.25); const sc = px * 0.22 / sp.unit; c.save(); c.translate(sx - px * 0.45 + i * px * 0.13, sy - px * 0.06 + Math.sin(i) * px * 0.03); c.scale(1, 0.55); c.drawImage(sp, -sp.width * sc / 2, -sp.height * sc / 2, sp.width * sc, sp.height * sc); c.restore(); }
      } else {
        const sp = Art.sprite(key, 0, px);
        const sc = px / sp.unit;
        c.save(); c.translate(sx, sy - px * 0.08); c.scale(1, 0.62); c.rotate(-0.12);
        if (ready) { c.translate(0, -Math.abs(Math.sin(this.t * 5)) * px * 0.08); }
        c.drawImage(sp, -sp.width * sc / 2, -sp.height * sc / 2, sp.width * sc, sp.height * sc);
        c.restore();
      }
      if (active) {
        // めじるし
        const a = 0.5 + 0.5 * Math.sin(this.t * 4);
        c.strokeStyle = ready ? 'rgba(255,230,120,' + (0.5 + a * 0.5) + ')' : 'rgba(255,255,255,' + (0.25 + a * 0.3) + ')';
        c.lineWidth = Math.max(2, 3 * this.k);
        c.beginPath(); c.ellipse(sx, sy, px * 0.62, px * 0.24, 0, 0, TAU); c.stroke();
      }
    }

    kiteSkyPos(k, z) {
      const hgt = SKY_H[k.i];
      const lift = k.st === 1 ? TJ.easeOut(Math.min(1, k.t / 2.6)) : 0;
      const sw = Math.sin(this.t * 0.7 + k.i * 2) * hgt * 0.06;
      const x = k.x + sw + hgt * 0.15 * lift, y = k.y - hgt * 0.18 * lift;
      return { x, y, h: hgt * lift + k.s * 0.3, lift };
    }
    drawKitesSky(sim, z) {
      const c = this.c;
      for (const k of sim.W.kites) {
        if (k.st !== 1) continue;
        const P = this.kiteSkyPos(k, z);
        const [gx, gy] = this.toScreen(P.x, P.y);
        const kx = gx, ky = gy - P.h * z;
        const own = k.i < 4 ? this.toScreen(k.ox, k.oy) : this.toScreen(k.x - 1000, k.y + 2000);
        const handY = own[1] - (k.i < 4 ? [110, 135, 145, 160][k.i] * 0.8 * z : 0);
        if (Math.max(own[0], kx) < -200 || Math.min(own[0], kx) > this.W + 200 || Math.max(handY, ky) < -200 || Math.min(handY, ky) > this.H + 200) continue;
        const focus = this.kiteFocus === k.i;
        const px = Math.max((focus ? 64 : 30) * this.k, k.s * z) * (k.i === 4 ? 1.2 : 1);
        c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = Math.max(1, 1.2 * this.k);
        c.beginPath(); c.moveTo(own[0], handY); c.quadraticCurveTo((own[0] + kx) / 2 + 20, (handY + ky) / 2 + Math.abs(handY - ky) * 0.25, kx, ky + px * 0.3); c.stroke();
        if (k.i === 3) {
          for (let i = 0; i < 14; i++) {
            const f = i / 13;
            const x = kx - f * px * 1.3 + Math.sin(this.t * 2 + i * 0.6) * px * 0.06, y = ky + f * px * 0.8 + Math.sin(this.t * 1.5 + i) * px * 0.05;
            const sp = Art.sprite('k_ren', 0, px * 0.18); const sc = px * 0.16 / sp.unit;
            c.drawImage(sp, x - sp.width * sc / 2, y - sp.height * sc / 2, sp.width * sc, sp.height * sc);
          }
          continue;
        }
        const key = ['k_yakko', 'k_kaku', 'k_semi', 'k_ren', 'k_oodako'][k.i];
        // しっぽ
        if (k.i === 1 || k.i === 4) {
          c.strokeStyle = k.i === 4 ? '#d63a3a' : '#3d7cc4'; c.lineWidth = Math.max(2, px * 0.04);
          for (const off of [-0.25, 0.25]) { c.beginPath(); c.moveTo(kx + off * px, ky + px * 0.45); for (let i = 1; i <= 8; i++) c.lineTo(kx + off * px + Math.sin(this.t * 4 + i * 0.8 + off) * px * 0.08, ky + px * 0.45 + i * px * 0.14); c.stroke(); }
        }
        const sp = Art.sprite(key, 0, px);
        const sc = px / sp.unit;
        c.save(); c.translate(kx, ky); c.rotate(Math.sin(this.t * 1.3 + k.i) * 0.12);
        c.drawImage(sp, -sp.width * sc / 2, -sp.height * sc / 2, sp.width * sc, sp.height * sc);
        c.restore();
      }
    }

    // ── ゆきぐも
    drawBoss(sim, z, dt) {
      const B = sim.boss;
      if (B.st === 'none' || B.st === 'gone') return;
      const c = this.c;
      const [sx, sy] = this.toScreen(B.x, B.y);
      const r = B.r * z;
      const down = B.st === 'down' ? Math.min(1, B.t / 1.2) : 0;
      // かげ と ゆき
      c.fillStyle = 'rgba(70,90,120,' + (0.22 * (1 - down)) + ')';
      c.beginPath(); c.ellipse(sx, sy, r, r * 0.62, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,' + (0.35 * (1 - down)) + ')'; c.lineWidth = 2 * this.k; c.setLineDash([8 * this.k, 8 * this.k]);
      c.beginPath(); c.ellipse(sx, sy, r, r * 0.62, 0, 0, TAU); c.stroke(); c.setLineDash([]);
      if (B.st === 'fight') {
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * TAU, d = Math.sqrt(Math.random());
          this.parts.push({ x: B.x + Math.cos(a) * d * B.r, y: B.y + Math.sin(a) * d * B.r * 0.62, z: 2600, vx: (Math.random() - 0.3) * 0.2, vy: 0, vz: -0.4, g: 0, life: 1.6, t: 0, kind: 'snow', size: 4 + Math.random() * 4, col: '#fff', scale: 1, snowFall: 1 });
        }
      }
      const cy = sy - 3200 * z + Math.sin(this.t * 0.8) * r * 0.03 - down * r * 0.8;
      const hit = B.hitT > 0 ? Math.sin(this.t * 50) * r * 0.03 : 0;
      // つむじが 真下に いるときは すかして 見やすく
      const under = Math.hypot(sim.wind.x - B.x, sim.wind.y - B.y) < B.r;
      c.save(); c.globalAlpha = (1 - down) * (under ? 0.72 : 1);
      c.translate(sx + hit, cy);
      const puffs = [[0, 0, 0.62], [-0.55, 0.1, 0.42], [0.55, 0.08, 0.45], [-0.25, -0.3, 0.42], [0.28, -0.28, 0.4], [-0.85, 0.2, 0.28], [0.85, 0.22, 0.3]];
      c.fillStyle = '#8e9aa8';
      for (const p of puffs) { c.beginPath(); c.arc(p[0] * r, p[1] * r + r * 0.08, p[2] * r, 0, TAU); c.fill(); }
      c.fillStyle = B.hitT > 0 ? '#e8eef4' : '#c3ccd6';
      for (const p of puffs) { c.beginPath(); c.arc(p[0] * r, p[1] * r, p[2] * r * 0.94, 0, TAU); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(-0.2 * r, -0.35 * r, 0.3 * r, 0.12 * r, -0.2, 0, TAU); c.fill();
      // ねぼけがお
      c.strokeStyle = '#4a5260'; c.lineWidth = Math.max(2, r * 0.03); c.lineCap = 'round';
      if (B.hitT > 0) { c.beginPath(); c.moveTo(-0.28 * r, -0.02 * r); c.lineTo(-0.16 * r, 0.04 * r); c.lineTo(-0.28 * r, 0.1 * r); c.moveTo(0.28 * r, -0.02 * r); c.lineTo(0.16 * r, 0.04 * r); c.lineTo(0.28 * r, 0.1 * r); c.stroke(); }
      else { c.beginPath(); c.arc(-0.22 * r, 0.02 * r, 0.07 * r, 0.1, PI - 0.1); c.moveTo(0.29 * r, 0.02 * r); c.arc(0.22 * r, 0.02 * r, 0.07 * r, 0.1, PI - 0.1); c.stroke(); }
      c.fillStyle = '#4a5260'; c.beginPath(); c.ellipse(0, 0.2 * r, 0.06 * r, 0.04 * r + Math.abs(Math.sin(this.t * 1.5)) * 0.03 * r, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(240,160,170,0.5)'; c.beginPath(); c.ellipse(-0.36 * r, 0.14 * r, 0.07 * r, 0.04 * r, 0, 0, TAU); c.ellipse(0.36 * r, 0.14 * r, 0.07 * r, 0.04 * r, 0, 0, TAU); c.fill();
      // HP（ほつれ）
      c.restore();
      if (B.st === 'fight') {
        const n = B.maxhp;
        for (let i = 0; i < n; i++) {
          const x = sx - (n - 1) * 9 * this.k + i * 18 * this.k, y = cy - r * 0.9;
          c.fillStyle = i < B.hp ? '#c3ccd6' : 'rgba(255,255,255,0.25)'; c.strokeStyle = '#4a5260'; c.lineWidth = 1.5 * this.k;
          c.beginPath(); c.arc(x, y, 6 * this.k, 0, TAU); c.fill(); c.stroke();
        }
      }
    }

    // ── つむじ
    drawWind(sim, z, opts) {
      const c = this.c;
      const w = sim.wind;
      const [sx, sy] = this.toScreen(w.x, w.y);
      const D = w.S * z;
      const Hh = D * 1.2;
      const t = this.t;
      const sp = Math.hypot(w.vx, w.vy) / Math.max(1, w.S);
      const lean = TJ.clamp(w.vx / Math.max(1, w.S) * 0.06, -0.25, 0.25);
      // ふりまわすもの（手前と おく）
      const items = [];
      for (const it of sim.orbit) items.push(this.orbitPos(it, sx, sy, D, z, w));
      for (const it of sim.dissolving) { const p = this.orbitPos(it, sx, sy, D, z, w); p.fade = it.fade; items.push(p); }
      for (const f of sim.flying) items.push(this.flyPos(f, sx, sy, D, z, w));
      // つちけむり
      c.fillStyle = 'rgba(255,250,235,0.16)'; c.beginPath(); c.ellipse(sx, sy, D * 0.62, D * 0.2, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = Math.max(1, D * 0.02);
      for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; c.beginPath(); c.ellipse(sx, sy, D * (0.45 + i * 0.07), D * (0.14 + i * 0.02), 0, a, a + 1.6); c.stroke(); }
      // 目立つもの（大きい・新しい）だけ 絵で、ほかは ちりの 点に（本体を かくさない）
      const shown = items.filter(p => p.fly || p.fade !== undefined);
      const rest = items.filter(p => !(p.fly || p.fade !== undefined));
      rest.sort((a, b) => (b.it.s * (1 + Math.max(0, 2 - b.ageS))) - (a.it.s * (1 + Math.max(0, 2 - a.ageS))));
      const N = 14;
      for (let i = 0; i < rest.length; i++) { if (i < N) shown.push(rest[i]); else rest[i].dust = 1; }
      for (const p of rest) if (p.dust) { c.fillStyle = 'rgba(255,250,235,0.7)'; c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
      for (const p of shown) if (p.back) this.drawOrbitItem(p, D);
      // からだ
      const bodyPts = 10;
      c.save();
      c.translate(sx, sy);
      const grd = c.createLinearGradient(0, -Hh, 0, 0);
      grd.addColorStop(0, 'rgba(235,248,255,0.78)'); grd.addColorStop(1, 'rgba(255,255,255,0.42)');
      c.fillStyle = grd;
      c.beginPath();
      for (let i = 0; i <= bodyPts; i++) { const f = i / bodyPts; const hy = -f * Hh; const r = D * (0.08 + 0.42 * Math.pow(f, 0.85)); const xo = lean * f * Hh + Math.sin(t * 3 + f * 4) * D * 0.025; if (i === 0) c.moveTo(xo - r, hy); else c.lineTo(xo - r, hy); }
      for (let i = bodyPts; i >= 0; i--) { const f = i / bodyPts; const hy = -f * Hh; const r = D * (0.08 + 0.42 * Math.pow(f, 0.85)); const xo = lean * f * Hh + Math.sin(t * 3 + f * 4) * D * 0.025; c.lineTo(xo + r, hy); }
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(80,130,170,0.55)'; c.lineWidth = Math.max(1.2, D * 0.018); c.stroke();
      // うずの すじ
      for (let i = 0; i < 9; i++) {
        const f = ((i / 9) + t * 0.35) % 1;
        const hy = -f * Hh; const r = D * (0.08 + 0.42 * Math.pow(f, 0.85)); const xo = lean * f * Hh + Math.sin(t * 3 + f * 4) * D * 0.025;
        const a0 = w.spin * 1.4 + i * 1.9;
        c.strokeStyle = 'rgba(255,255,255,' + (0.35 + 0.4 * Math.sin(f * PI)).toFixed(3) + ')';
        c.lineWidth = Math.max(1.2, D * 0.028);
        c.beginPath(); c.ellipse(xo, hy, r, r * 0.3, 0, a0, a0 + 2.2); c.stroke();
      }
      c.strokeStyle = 'rgba(160,200,230,0.5)'; c.lineWidth = Math.max(1, D * 0.015);
      c.beginPath(); c.ellipse(lean * Hh, -Hh, D * 0.5, D * 0.15, 0, 0, TAU); c.stroke();
      // かお
      const fx = lean * Hh * 0.55 + TJ.clamp(w.vx / Math.max(1, w.S) * 0.02, -0.08, 0.08) * D;
      const fy = -Hh * 0.55;
      this.blink -= 1 / 60;
      if (this.blink < -0.12) this.blink = 2 + Math.random() * 3;
      const blink = this.blink < 0;
      const happy = w.face > 0.05 || sim.combo.n >= 5;
      const ouch = w.bump > 0.15;
      const shiver = w.snow > 0 ? Math.sin(t * 60) * D * 0.01 : 0;
      c.translate(shiver, 0);
      c.fillStyle = 'rgba(255,170,190,0.55)';
      c.beginPath(); c.ellipse(fx - D * 0.17, fy + D * 0.07, D * 0.05, D * 0.03, 0, 0, TAU); c.ellipse(fx + D * 0.17, fy + D * 0.07, D * 0.05, D * 0.03, 0, 0, TAU); c.fill();
      c.strokeStyle = '#2f3a52'; c.fillStyle = '#2f3a52'; c.lineWidth = Math.max(1.5, D * 0.03); c.lineCap = 'round';
      for (const s of [-1, 1]) {
        const ex = fx + s * D * 0.1, ey = fy;
        if (ouch) { c.beginPath(); c.moveTo(ex - s * D * 0.04, ey - D * 0.035); c.lineTo(ex + s * D * 0.02, ey); c.lineTo(ex - s * D * 0.04, ey + D * 0.035); c.stroke(); }
        else if (happy) { c.beginPath(); c.arc(ex, ey + D * 0.02, D * 0.04, PI * 1.15, PI * 1.85); c.stroke(); }
        else if (blink) { c.beginPath(); c.moveTo(ex - D * 0.035, ey); c.lineTo(ex + D * 0.035, ey); c.stroke(); }
        else { c.beginPath(); c.ellipse(ex, ey, D * 0.032, D * 0.048, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(ex - D * 0.01, ey - D * 0.018, D * 0.012, 0, TAU); c.fill(); c.fillStyle = '#2f3a52'; }
      }
      if (sim.flying.length || sim.combo.t > 0.5) { c.beginPath(); c.ellipse(fx, fy + D * 0.09, D * 0.028, D * 0.035, 0, 0, TAU); c.fill(); }
      else { c.beginPath(); c.arc(fx - D * 0.022, fy + D * 0.07, D * 0.022, 0.2, PI - 0.2); c.arc(fx + D * 0.022, fy + D * 0.07, D * 0.022, 0.2, PI - 0.2); c.stroke(); }
      // てっぺんの つむじ
      const tx = lean * Hh, ty = -Hh - D * 0.05;
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = Math.max(1.5, D * 0.03);
      c.beginPath(); for (let i = 0; i <= 20; i++) { const a = w.spin * 2 + i * 0.5, r = D * 0.005 * i; const px = tx + Math.cos(a) * r, py = ty + Math.sin(a) * r * 0.5 - i * D * 0.004; if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); } c.stroke();
      c.restore();
      const faceY = sy - Hh * 0.55;
      for (const p of shown) if (!p.back) { p.faceA = Math.hypot(p.x - (sx + lean * Hh * 0.55), (p.y - faceY) * 1.4) < D * 0.3 ? 0.45 : 1; this.drawOrbitItem(p, D); }
      // ドンの わ
      if (sim.blastT < 0.35) {
        const u = sim.blastT / 0.35;
        const R = sim.wind.S * TJ.SIM_CONST.BLAST_R * z * TJ.easeOut(u);
        c.strokeStyle = 'rgba(255,255,255,' + (0.95 * (1 - u)) + ')'; c.lineWidth = Math.max(3, D * 0.08 * (1 - u));
        c.beginPath(); c.ellipse(sx, sy, R, R * 0.4, 0, 0, TAU); c.stroke();
        c.fillStyle = 'rgba(255,255,255,' + (0.12 * (1 - u)) + ')'; c.fill();
      }
    }

    orbitPos(it, sx, sy, D, z, w) {
      const a = it.a;
      // 体の 外がわを まわる（顔を かくさない）
      const f = Math.min(1, it.hh * 1.05 / 1.2);
      const body = D * (0.08 + 0.42 * Math.pow(f, 0.85));
      let rr = body + D * (0.1 + (it.rr - 0.2) * 0.75);
      let h = it.hh * D * 1.05;
      if (it.out) {
        const u = it.out.t / it.out.dur;
        const f = Math.sin(Math.min(1, u * 1.15) * PI);
        rr += it.out.dist * z * f;
        h *= (1 - 0.7 * f);
      }
      const born = Math.min(1, it.born / 0.25);
      return { x: sx + Math.cos(a) * rr, y: sy - h + Math.sin(a) * rr * 0.32, back: Math.sin(a) < 0, it, px: Math.min(it.s * z, D * 0.4), spin: it.spin, born, ageS: it.born };
    }
    flyPos(f, sx, sy, D, z, w) {
      const u = TJ.smooth(Math.min(1, f.t / f.dur));
      const a = f.a0 + 3.2 * u;
      const d = (f.d0 * (1 - u) + w.S * 0.5 * u) * z;
      const h = ((f.z0 || 0) * (1 - u) + w.S * 0.55 * u) * z;
      const o = f.o;
      return { x: sx + Math.cos(a) * d, y: sy - h + Math.sin(a) * d * (0.32 + 0.68 * (1 - u)), back: Math.sin(a) < 0 && u > 0.5, it: { t: o.t, v: o.v, s: o.s }, px: Math.min(o.s * z, D * (0.95 - 0.5 * u)), spin: u * 4 + (o.rot || 0), born: 1, fly: 1 };
    }
    drawOrbitItem(p, D) {
      const px = p.px * (p.fade !== undefined ? (1 - p.fade) : 1) * (0.6 + 0.4 * p.born);
      if (px < 1) return;
      const c = this.c;
      if (px < 3) { const dc = Art.dotColor[p.it.t]; c.fillStyle = Array.isArray(dc) ? dc[0] : (dc || '#d8c8a8'); c.fillRect(p.x - 1, p.y - 1, 2, 2); return; }
      const sp = Art.sprite(p.it.t, p.it.v, px);
      const sc = px / sp.unit;
      c.save(); c.translate(p.x, p.y); c.rotate(p.spin);
      if (p.fade !== undefined) c.globalAlpha = 1 - p.fade;
      else if (p.faceA) c.globalAlpha = p.faceA;
      c.drawImage(sp, -sp.width * sc / 2, -sp.height * sc / 2, sp.width * sc, sp.height * sc);
      c.restore();
    }

    // ── つぶ・わ・もじ
    drawParts(dt, z) {
      const c = this.c;
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.t += dt;
        if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
        const u = p.t / p.life;
        if (p.snowFall) { p.z += p.vz * dt * 1800; p.x += p.vx * dt * 300; if (p.z < 0) p.t = p.life; }
        else {
          // ワールド速度は「1秒に すすむ量（スケールつき）」
          p.x += p.vx * p.scale * dt; p.y += p.vy * p.scale * dt;
          p.z = Math.max(0, p.z + p.vz * p.scale * dt); p.vz -= p.g * p.scale * dt;
          p.vx *= 0.97; p.vy *= 0.97;
        }
        const [sx, sy] = this.toScreen(p.x, p.y);
        const y = sy - p.z * z;
        if (sx < -50 || sx > this.W + 50 || y < -50 || y > this.H + 50) continue;
        const a = 1 - u;
        const s = p.size * this.k * (p.kind === 'puff' ? (0.6 + u) : 1);
        if (p.kind === 'star') {
          c.save(); c.translate(sx, y); c.rotate(p.t * 6); c.globalAlpha = a; c.fillStyle = p.col;
          c.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? s * 0.3 : s; const an = k / 8 * TAU; c.lineTo(Math.cos(an) * r, Math.sin(an) * r); } c.closePath(); c.fill(); c.restore();
        } else if (p.kind === 'confetti') {
          c.save(); c.translate(sx, y); c.rotate(p.t * 8 + p.x); c.globalAlpha = Math.min(1, a * 2); c.fillStyle = p.col; c.fillRect(-s / 2, -s / 4, s, s / 2); c.restore();
        } else if (p.kind === 'snow') {
          c.globalAlpha = Math.min(1, a * 2); c.fillStyle = '#fff'; c.beginPath(); c.arc(sx, y, s * 0.5, 0, TAU); c.fill(); c.globalAlpha = 1;
        } else {
          c.globalAlpha = a * (p.kind === 'puff' ? 0.6 : 0.9); c.fillStyle = p.col;
          c.beginPath(); c.arc(sx, y, s, 0, TAU); c.fill(); c.globalAlpha = 1;
        }
      }
      c.globalAlpha = 1;
    }
    drawRings(dt, z) {
      const c = this.c;
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.t += dt;
        if (r.t >= r.life) { this.rings.splice(i, 1); continue; }
        const u = r.t / r.life;
        const [sx, sy] = this.toScreen(r.x, r.y);
        const R = r.r * z * TJ.easeOut(u);
        c.strokeStyle = r.col; c.globalAlpha = 1 - u; c.lineWidth = r.w * this.k * (1 - u * 0.7);
        c.beginPath(); c.ellipse(sx, sy - (r.h || 0) * z, R, R * (r.flat === false ? 1 : 0.4), 0, 0, TAU); c.stroke();
        c.globalAlpha = 1;
      }
    }
    drawTexts(dt) {
      const c = this.c;
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const tx = this.texts[i];
        tx.t += dt;
        if (tx.t >= tx.life) { this.texts.splice(i, 1); continue; }
        const u = tx.t / tx.life;
        let sx, sy;
        if (tx.screen) { sx = tx.x; sy = tx.y; } else { [sx, sy] = this.toScreen(tx.x, tx.y); }
        sy -= tx.rise * this.k * TJ.easeOut(u);
        const pop = u < 0.12 ? TJ.easeOutBack(u / 0.12) : 1;
        const size = tx.size * this.k * pop;
        c.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
        c.font = '900 ' + Math.round(size) + 'px "Hiragino Maru Gothic ProN","Yu Gothic UI","Meiryo",sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = Math.max(3, size * 0.22); c.strokeStyle = tx.stroke || 'rgba(40,30,25,0.85)'; c.lineJoin = 'round';
        c.strokeText(tx.text, sx, sy); c.fillStyle = tx.col; c.fillText(tx.text, sx, sy);
        c.globalAlpha = 1;
      }
    }
    drawTint(sim, dt) {
      const c = this.c;
      const B = sim.boss;
      let want = 0;
      if (B.st === 'fight' || B.st === 'enter') want = 1;
      this.tint += (want - this.tint) * Math.min(1, dt * 1.5);
      if (this.tint > 0.01) { c.fillStyle = 'rgba(90,110,150,' + (0.22 * this.tint) + ')'; c.fillRect(0, 0, this.W, this.H); }
      // ふちの かげ
      const g = c.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.45, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,30,20,0.22)');
      c.fillStyle = g; c.fillRect(0, 0, this.W, this.H);
    }
  }
  TJ.Render = Render;
  TJ.SKY_H = SKY_H;
})(typeof window !== 'undefined' ? window : globalThis);
