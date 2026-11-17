/* fx.js — canvas particles (season ambience, bursts) + decorative gold clouds for 天下賽配. */
(function () {
  'use strict';
  const FX = {
    cv: null, g: null, parts: [], season: -1, running: false, scale: 1, ox: 0, oy: 0, last: 0, enabled: true,
    init(canvas, cloudsEl) {
      this.cv = canvas; this.g = canvas.getContext('2d');
      this.drawClouds(cloudsEl);
      this.loop = this.loop.bind(this);
      if (!this.running) { this.running = true; requestAnimationFrame(this.loop); }
    },
    // map viewBox -> canvas px (the svg is letterboxed inside #mapwrap)
    setTransform(scale, ox, oy) { this.scale = scale; this.ox = ox; this.oy = oy; },
    toPx(x, y) { return [this.ox + x * this.scale, this.oy + y * this.scale]; },
    setSeason(s) {
      this.season = s;
      this.parts = this.parts.filter(p => p.kind !== 'amb');
      const n = s === 3 ? 70 : s === 0 ? 34 : s === 2 ? 26 : 14;
      for (let i = 0; i < n; i++) this.parts.push(this.ambient(true));
    },
    ambient(init) {
      const s = this.season, W = this.cv.width, H = this.cv.height;
      const p = { kind: 'amb', x: Math.random() * W, y: init ? Math.random() * H : -20, life: 1e9, rot: Math.random() * 6.28, vr: (Math.random() - .5) * 0.04 };
      if (s === 3) { p.vx = -0.15 + Math.random() * 0.3; p.vy = 0.35 + Math.random() * 0.55; p.r = 1 + Math.random() * 2.2; p.type = 'snow'; }
      else if (s === 0) { p.vx = 0.25 + Math.random() * 0.4; p.vy = 0.3 + Math.random() * 0.35; p.r = 3 + Math.random() * 2.5; p.type = 'sakura'; }
      else if (s === 2) { p.vx = 0.15 + Math.random() * 0.35; p.vy = 0.35 + Math.random() * 0.4; p.r = 4 + Math.random() * 3; p.type = 'momiji'; p.hue = Math.random(); }
      else { p.vx = (Math.random() - .5) * 0.2; p.vy = (Math.random() - .5) * 0.2; p.r = 1.5 + Math.random() * 1.5; p.type = 'firefly'; p.ph = Math.random() * 6.28; }
      return p;
    },
    burst(x, y, color, n, kind) {
      if (!this.enabled) return;
      const [px, py] = this.toPx(x, y);
      for (let i = 0; i < (n || 36); i++) {
        const a = Math.random() * 6.28, sp = 1.2 + Math.random() * 3.6;
        this.parts.push({ kind: 'burst', type: kind || 'spark', x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2, r: 1.5 + Math.random() * 2.5,
          life: 50 + Math.random() * 40, max: 90, color: Math.random() < 0.55 ? color : '#ffe08a', rot: Math.random() * 6.28, vr: (Math.random() - .5) * 0.2 });
      }
    },
    ring(x, y, color) {
      if (!this.enabled) return;
      const [px, py] = this.toPx(x, y);
      this.parts.push({ kind: 'ring', x: px, y: py, r: 6, life: 40, max: 40, color });
    },
    loop(t) {
      const g = this.g, W = this.cv.width, H = this.cv.height;
      g.clearRect(0, 0, W, H);
      if (this.enabled) {
        const keep = [];
        for (const p of this.parts) {
          if (p.kind === 'amb') {
            p.x += p.vx; p.y += p.vy; p.rot += p.vr;
            if (p.type === 'firefly') { p.ph += 0.03; p.x += Math.sin(p.ph) * 0.3; }
            if (p.y > H + 20 || p.x > W + 20 || p.x < -20 || (p.type === 'firefly' && (p.y < -20))) Object.assign(p, this.ambient(false));
            this.drawAmb(g, p);
            keep.push(p);
          } else if (p.kind === 'burst') {
            p.life--; if (p.life <= 0) continue;
            p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.985; p.rot += p.vr;
            g.globalAlpha = Math.min(1, p.life / 30);
            g.fillStyle = p.color;
            if (p.type === 'petal') { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath(); g.ellipse(0, 0, p.r * 1.8, p.r, 0, 0, 6.28); g.fill(); g.restore(); }
            else { g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill(); }
            g.globalAlpha = 1;
            keep.push(p);
          } else if (p.kind === 'ring') {
            p.life--; if (p.life <= 0) continue;
            p.r += 3.2;
            g.globalAlpha = p.life / p.max * 0.8; g.strokeStyle = p.color; g.lineWidth = 3;
            g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.stroke(); g.globalAlpha = 1;
            keep.push(p);
          }
        }
        this.parts = keep;
      }
      requestAnimationFrame(this.loop);
    },
    drawAmb(g, p) {
      if (p.type === 'snow') { g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill(); }
      else if (p.type === 'sakura') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = 'rgba(255,190,210,.85)';
        g.beginPath(); g.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, 6.28); g.fill(); g.restore();
      } else if (p.type === 'momiji') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        g.fillStyle = p.hue < 0.5 ? 'rgba(214,72,32,.85)' : 'rgba(232,150,40,.85)';
        g.beginPath();
        for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 1.2566; g.lineTo(Math.cos(a) * p.r, Math.sin(a) * p.r); g.lineTo(Math.cos(a + 0.63) * p.r * 0.42, Math.sin(a + 0.63) * p.r * 0.42); }
        g.closePath(); g.fill(); g.restore();
      } else {
        const a = 0.35 + 0.35 * Math.sin(p.ph * 2);
        g.fillStyle = `rgba(220,255,140,${a.toFixed(2)})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill();
      }
    },
    drawClouds(host) {
      if (!host) return;
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 1060 900'); svg.setAttribute('preserveAspectRatio', 'none'); svg.style.width = '100%'; svg.style.height = '100%';
      svg.innerHTML = `<defs>
        <linearGradient id="kumoG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe7a2"/><stop offset=".55" stop-color="#d9ad48"/><stop offset="1" stop-color="#a87a22"/></linearGradient>
        <pattern id="sunago" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".9" fill="#fff6c8" opacity=".7"/><circle cx="6.5" cy="7" r=".6" fill="#8a5a10" opacity=".35"/></pattern>
        <filter id="kumoSh"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#2a1404" flood-opacity=".45"/></filter></defs>`;
      // suyari-gasumi: horizontal bands with rounded ends
      const bands = [
        [700, 22, 300, 30], [770, 58, 250, 26], // top right (over the northern sea)
        [-40, 840, 300, 30], [60, 872, 330, 26], // bottom left
        [760, 845, 340, 30], [660, 878, 260, 24], // bottom right
        [-60, 380, 150, 24], // left edge
      ];
      bands.forEach(([x, y, w, h]) => {
        const g = document.createElementNS(NS, 'g'); g.setAttribute('filter', 'url(#kumoSh)'); g.setAttribute('opacity', '0.93');
        const r = h / 2;
        const d = `M${x + r} ${y}H${x + w - r}a${r} ${r} 0 0 1 0 ${h}H${x + r}a${r} ${r} 0 0 1 0 ${-h}Z`;
        g.innerHTML = `<path d="${d}" fill="url(#kumoG)" stroke="#7a5214" stroke-width="1.2"/><path d="${d}" fill="url(#sunago)"/>`;
        svg.appendChild(g);
      });
      host.appendChild(svg);
    },
  };
  window.FX = FX;
})();
