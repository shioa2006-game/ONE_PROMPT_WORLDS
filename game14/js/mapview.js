/* mapview.js — SVG map renderer for 天下賽. Depends on window.MAPDATA and window.GAME_DATA. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  let uid = 0;

  function shade(hex, f) { // f<0 darker, f>0 lighter
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function lum(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }

  function makeWashi(size) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    let s = 1234567;
    const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
    for (let i = 0; i < size * size; i++) {
      const v = 200 + rnd() * 55;
      img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.97; img.data[i * 4 + 2] = v * 0.9; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // fibres
    g.globalAlpha = 0.18; g.strokeStyle = '#8a7a5a'; g.lineWidth = 0.6;
    for (let k = 0; k < 160; k++) {
      const x = rnd() * size, y = rnd() * size, a = rnd() * Math.PI * 2, l = 6 + rnd() * 22;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    g.globalAlpha = 1;
    return c.toDataURL();
  }

  const MapView = {
    svg: null, md: null, layers: {}, prov: [], handlers: {},
    init(svg, md) {
      this.svg = svg; this.md = md;
      svg.setAttribute('viewBox', `0 0 ${md.w} ${md.h}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const defs = el('defs', null, svg);
      this.defs = defs;
      // clip to land
      const clip = el('clipPath', { id: 'clipLand' }, defs);
      el('path', { d: md.coast.join('') }, clip);
      // washi pattern
      const pat = el('pattern', { id: 'washi', width: 256, height: 256, patternUnits: 'userSpaceOnUse' }, defs);
      el('image', { href: makeWashi(256), width: 256, height: 256 }, pat);
      // ink roughen filter for borders (cheap)
      const flt = el('filter', { id: 'inkRough', x: '-5%', y: '-5%', width: '110%', height: '110%' }, defs);
      el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '1', seed: '3', result: 'n' }, flt);
      el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '1.6' }, flt);
      // land glow / shadow
      const sh = el('filter', { id: 'landShadow', x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
      el('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: '6', result: 'b' }, sh);
      el('feOffset', { in: 'b', dx: '3', dy: '5', result: 'o' }, sh);
      el('feFlood', { 'flood-color': '#0b1a2a', 'flood-opacity': '0.55' }, sh);
      el('feComposite', { in2: 'o', operator: 'in', result: 's' }, sh);
      const mg = el('feMerge', null, sh); el('feMergeNode', { in: 's' }, mg); el('feMergeNode', { in: 'SourceGraphic' }, mg);
      // glow for highlights
      const gl = el('filter', { id: 'glow', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
      el('feGaussianBlur', { stdDeviation: '3', result: 'b' }, gl);
      const mg2 = el('feMerge', null, gl); el('feMergeNode', { in: 'b' }, mg2); el('feMergeNode', { in: 'SourceGraphic' }, mg2);
      // lake water gradient
      const lg = el('linearGradient', { id: 'lakeGrad', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      el('stop', { offset: '0', 'stop-color': '#2f5f86' }, lg); el('stop', { offset: '1', 'stop-color': '#1f4466' }, lg);
      // seigaiha (wave) pattern for lakes
      const wp = el('pattern', { id: 'lakeWave', width: 16, height: 8, patternUnits: 'userSpaceOnUse' }, defs);
      el('path', { d: 'M0 8a8 8 0 0 1 16 0M4 8a4 4 0 0 1 8 0', fill: 'none', stroke: '#9cc3dd', 'stroke-width': '0.6', opacity: '0.45' }, wp);
      // snow pattern
      const sp = el('pattern', { id: 'snowPat', width: 22, height: 22, patternUnits: 'userSpaceOnUse' }, defs);
      el('circle', { cx: 5, cy: 6, r: 1.6, fill: '#fff' }, sp); el('circle', { cx: 16, cy: 15, r: 1.2, fill: '#fff' }, sp); el('circle', { cx: 13, cy: 4, r: 0.8, fill: '#fff' }, sp);

      const L = this.layers;
      L.land = el('g', { class: 'm-land' }, svg);
      L.neutral = el('g', { class: 'm-neutral', 'clip-path': 'url(#clipLand)' }, svg);
      L.fill = el('g', { class: 'm-fill', 'clip-path': 'url(#clipLand)' }, svg);
      L.season = el('g', { class: 'm-season', 'clip-path': 'url(#clipLand)', 'pointer-events': 'none' }, svg);
      L.tex = el('g', { class: 'm-tex', 'clip-path': 'url(#clipLand)', 'pointer-events': 'none' }, svg);
      L.mount = el('g', { class: 'm-mount', 'pointer-events': 'none' }, svg);
      L.lake = el('g', { class: 'm-lake', 'pointer-events': 'none' }, svg);
      L.border = el('g', { class: 'm-border', 'clip-path': 'url(#clipLand)', 'pointer-events': 'none' }, svg);
      L.coast = el('g', { class: 'm-coast', 'pointer-events': 'none' }, svg);
      L.road = el('g', { class: 'm-road', 'pointer-events': 'none' }, svg);
      L.hi = el('g', { class: 'm-hi', 'pointer-events': 'none' }, svg);
      L.fx0 = el('g', { class: 'm-fx0', 'pointer-events': 'none' }, svg);
      L.label = el('g', { class: 'm-label' }, svg);
      L.fx = el('g', { class: 'm-fx', 'pointer-events': 'none' }, svg);

      // land base
      el('path', { d: md.coast.join(''), fill: '#e9dcc0', filter: 'url(#landShadow)' }, L.land);
      // neutral lands
      md.neutral.forEach(n => {
        el('path', { d: n.d, fill: '#d8ccb0', 'fill-rule': 'evenodd' }, L.neutral);
      });
      // washi texture over land
      el('rect', { x: 0, y: 0, width: md.w, height: md.h, fill: 'url(#washi)', opacity: '0.42', style: 'mix-blend-mode:multiply' }, L.tex);
      // mountains (ink strokes)
      md.mountains.forEach(([x, y, s]) => {
        const g = el('g', { transform: `translate(${x} ${y})` }, L.mount);
        el('path', { d: `M${-s} ${s * 0.42}Q${-s * 0.35} ${-s * 0.2} 0 ${-s * 0.62}Q${s * 0.3} ${-s * 0.15} ${s} ${s * 0.42}`, fill: 'rgba(40,30,20,0.10)', stroke: 'rgba(30,22,14,0.55)', 'stroke-width': 1.1, 'stroke-linecap': 'round' }, g);
        el('path', { d: `M${-s * 0.15} ${-s * 0.35}Q${s * 0.05} ${s * 0.05} ${-s * 0.05} ${s * 0.4}`, fill: 'none', stroke: 'rgba(30,22,14,0.30)', 'stroke-width': 0.8 }, g);
      });
      // Mt Fuji
      {
        const [x, y] = md.fuji; const g = el('g', { transform: `translate(${x} ${y + 4})` }, L.mount);
        el('path', { d: 'M-22 9L-6 -13Q0 -17 6 -13L22 9Z', fill: '#6f7c8a', stroke: '#2a2a2a', 'stroke-width': 1 }, g);
        el('path', { d: 'M-9 -9L-6 -13Q0 -17 6 -13L9 -9L5 -6L2 -9L-1 -5L-4 -8Z', fill: '#f8f8f4' }, g);
      }
      // lakes
      ['biwa', 'hamana'].forEach(k => {
        el('path', { d: md.lakes[k], fill: 'url(#lakeGrad)', stroke: '#1d1a16', 'stroke-width': 1.2 }, L.lake);
        el('path', { d: md.lakes[k], fill: 'url(#lakeWave)' }, L.lake);
      });
      // borders
      md.borders.forEach(b => {
        if (b.kind === 'faint') el('path', { d: b.d, fill: 'none', stroke: 'rgba(60,45,30,0.35)', 'stroke-width': 0.8, 'stroke-dasharray': '3 3' }, L.border);
        else if (b.kind === 'edge') el('path', { d: b.d, fill: 'none', stroke: 'rgba(30,22,14,0.75)', 'stroke-width': 1.3 }, L.border);
        else if (b.kind === 'ridge') {
          el('path', { d: b.d, fill: 'none', stroke: 'rgba(40,28,16,0.9)', 'stroke-width': 7, 'stroke-dasharray': '1.4 3.2' }, L.border);
          el('path', { d: b.d, fill: 'none', stroke: 'rgba(20,14,8,0.95)', 'stroke-width': 1.6 }, L.border);
        } else el('path', { d: b.d, fill: 'none', stroke: 'rgba(20,14,8,0.92)', 'stroke-width': 1.7, 'stroke-linejoin': 'round' }, L.border);
      });
      // coast ink line
      el('path', { d: md.coast.join(''), fill: 'none', stroke: '#1b140c', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, L.coast);
      el('path', { d: md.coast.join(''), fill: 'none', stroke: 'rgba(255,248,230,0.35)', 'stroke-width': 4, transform: 'translate(0 0)', style: 'mix-blend-mode:screen' }, L.coast);
      // roads
      this.roads = md.routes.map(r => {
        const p = el('path', { d: r.d, class: 'road', fill: 'none' }, L.road);
        return { a: r.a, b: r.b, el: p, len: r.len };
      });
      // neutral labels
      md.neutral.forEach(n => {
        if (!n.anchor) return;
        const t = el('text', { x: n.anchor[0], y: n.anchor[1], class: 'm-neutral-label' }, L.label);
        t.textContent = n.name;
      });
      // provinces
      this.prov = md.provinces.map((p, i) => {
        const path = el('path', { d: p.d, 'fill-rule': 'evenodd', class: 'prov', 'data-pid': i }, L.fill);
        const snow = el('path', { d: p.d, 'fill-rule': 'evenodd', fill: 'url(#snowPat)', opacity: 0, class: 'snow' }, L.season);
        const [ax, ay] = p.anchor;
        const g = el('g', { class: 'plabel', 'data-pid': i, transform: `translate(${ax} ${ay})` }, L.label);
        // banner (旗指物)
        const ban = el('g', { class: 'banner', transform: 'translate(-26 -14)' }, g);
        el('line', { x1: 0, y1: -18, x2: 0, y2: 16, stroke: '#2a1a0a', 'stroke-width': 1.6 }, ban);
        const flag = el('rect', { x: 0.8, y: -17, width: 14, height: 24, rx: 1, class: 'flag' }, ban);
        const mon = el('text', { x: 7.8, y: -5, class: 'mon' }, ban);
        // troop token
        const tok = el('g', { class: 'token' }, g);
        el('circle', { r: 13.5, class: 'tok-bg' }, tok);
        el('circle', { r: 11, class: 'tok-ring' }, tok);
        const num = el('text', { y: 0.5, class: 'tok-num' }, tok);
        // threat badge (own provinces in danger)
        const thr = el('g', { class: 'threat', transform: 'translate(18 -16)' }, g);
        el('rect', { x: -15, y: -8, width: 30, height: 16, rx: 4 }, thr);
        const thrT = el('text', { y: 0.5 }, thr);
        // raid mark (surprise attack possible)
        const rm = el('g', { class: 'rmark', transform: 'translate(-20 12)' }, g);
        el('circle', { r: 8.5 }, rm);
        const rmT = el('text', { y: 0.5 }, rm); rmT.textContent = '奇';
        // name
        const name = el('text', { y: 28, class: 'pname' }, g);
        name.textContent = p.name;
        const self = this;
        [path, g].forEach(n => {
          n.addEventListener('click', e => { e.stopPropagation(); self.emit('click', i, e); });
          n.addEventListener('mouseenter', e => self.emit('hover', i, e));
          n.addEventListener('mouseleave', e => self.emit('leave', i, e));
          n.addEventListener('contextmenu', e => { e.preventDefault(); self.emit('rclick', i, e); });
        });
        return { path, snow, g, flag, mon, num, tok, name, thr, thrT, rm, anchor: [ax, ay], color: null };
      });
      svg.addEventListener('click', e => this.emit('bg', -1, e));
      svg.addEventListener('contextmenu', e => { e.preventDefault(); this.emit('rclick', -1, e); });
    },
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); },
    emit(ev, ...a) { (this.handlers[ev] || []).forEach(f => f(...a)); },

    setOwner(pid, color, mon) {
      const p = this.prov[pid];
      p.color = color;
      p.path.setAttribute('fill', color);
      p.flag.setAttribute('fill', color);
      p.flag.setAttribute('stroke', shade(color, -0.45));
      p.mon.textContent = mon;
      p.mon.setAttribute('fill', lum(color) > 0.62 ? '#2a1a0a' : '#fffaf0');
    },
    setTroops(pid, n) { this.prov[pid].num.textContent = n; },
    setPlayerProvinces(set) {
      this.prov.forEach((p, i) => p.g.classList.toggle('mine', set.has(i)));
      this.prov.forEach((p, i) => p.path.classList.toggle('mine', set.has(i)));
    },
    setThreat(pid, pct) {
      const p = this.prov[pid];
      if (pct == null) { p.thr.classList.remove('on'); return; }
      p.thrT.textContent = '危' + pct + '%';
      p.thr.classList.add('on');
    },
    clearThreats() { this.prov.forEach(p => p.thr.classList.remove('on')); this.clearThreatArrows(); },
    threatArrow(from, to) {
      const r = this.roadEl(from, to); if (!r) return;
      const reverse = !(r.a === from);
      const pth = el('path', { d: r.el.getAttribute('d'), class: 'threat-arrow' + (reverse ? ' rev' : '') }, this.layers.road);
      if (reverse) pth.style.animationDirection = 'normal';
      (this.tArrows = this.tArrows || []).push(pth);
    },
    clearThreatArrows() { (this.tArrows || []).forEach(a => a.remove()); this.tArrows = []; },
    setRaidMark(pid, on) { this.prov[pid].rm.classList.toggle('on', !!on); },
    roadEl(a, b) { return this.roads.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a)); },
    clearMarks() {
      this.prov.forEach(p => { p.path.classList.remove('sel', 'target', 'target-bad', 'target-own', 'dim', 'hover'); p.g.classList.remove('sel', 'target', 'dim'); });
      this.roads.forEach(r => r.el.classList.remove('active', 'active-own'));
      while (this.layers.hi.firstChild) this.layers.hi.removeChild(this.layers.hi.firstChild);
      this.prov.forEach(p => p.rm.classList.remove('on'));
    },
    markSelected(pid) {
      const p = this.prov[pid];
      p.path.classList.add('sel'); p.g.classList.add('sel');
      el('path', { d: this.md.provinces[pid].d, class: 'hi-sel', 'fill-rule': 'evenodd' }, this.layers.hi);
    },
    markTarget(pid, from, kind) { // kind: 'enemy' | 'own' | 'bad' | 'raid'
      const p = this.prov[pid];
      p.path.classList.add(kind === 'own' ? 'target-own' : kind === 'bad' ? 'target-bad' : 'target');
      p.g.classList.add('target');
      el('path', { d: this.md.provinces[pid].d, class: 'hi-' + (kind || 'enemy'), 'fill-rule': 'evenodd' }, this.layers.hi);
      if (from != null) { const r = this.roadEl(from, pid); if (r) r.el.classList.add(kind === 'own' ? 'active-own' : 'active'); }
    },
    dimExcept(set) { this.prov.forEach((p, i) => { if (!set.has(i)) { p.path.classList.add('dim'); p.g.classList.add('dim'); } }); },
    hover(pid, on) { const p = this.prov[pid]; if (p) p.path.classList.toggle('hover', on); },

    setSeason(season, snowProvinces) {
      this.prov.forEach((p, i) => {
        const on = season === 3 && snowProvinces.has(i);
        p.snow.style.transition = 'opacity 1.2s';
        p.snow.setAttribute('opacity', on ? 0.55 : 0);
      });
      this.svg.dataset.season = season;
    },

    // ---------------- effects
    pt(pid) { return this.prov[pid].anchor; },
    entryPoint(from, to) {
      const r = this.md.routes.find(q => (q.a === from && q.b === to) || (q.a === to && q.b === from));
      return r && r.m ? r.m : this.pt(to);
    },
    inkSpread(pid, color, from, dur) {
      // animate new owner colour spreading from the border with `from`
      return new Promise(res => {
        const p = this.prov[pid];
        const id = 'm' + (++uid);
        const mask = el('mask', { id, maskUnits: 'userSpaceOnUse' }, this.defs);
        const [cx, cy] = from != null ? this.entryPoint(from, pid) : this.pt(pid);
        const circ = el('circle', { cx, cy, r: 0, fill: '#fff', filter: 'url(#inkRough)' }, mask);
        const clone = el('path', { d: this.md.provinces[pid].d, 'fill-rule': 'evenodd', fill: color, mask: `url(#${id})`, 'clip-path': 'url(#clipLand)' }, this.layers.fx0);
        // max radius: farthest bbox corner
        const bb = p.path.getBBox();
        const R = Math.max(...[[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]].map(([x, y]) => Math.hypot(x - cx, y - cy))) + 10;
        const t0 = performance.now();
        const step = t => {
          const k = Math.max(0, Math.min(1, (t - t0) / dur));
          const e = 1 - Math.pow(1 - k, 3);
          circ.setAttribute('r', (R * e).toFixed(1));
          if (k < 1) requestAnimationFrame(step);
          else { clone.remove(); mask.remove(); res(); }
        };
        requestAnimationFrame(step);
      });
    },
    stamp(pid, mon, color, big, crush) {
      const [x, y] = this.pt(pid);
      const g = el('g', { class: 'stamp' + (big ? ' big' : '') + (crush ? ' crush' : ''), transform: `translate(${x} ${y - 6})` }, this.layers.fx);
      const inner = el('g', { class: 'stamp-in' }, g);
      el('rect', { x: -21, y: -21, width: 42, height: 42, rx: 4, class: 'stamp-bg' }, inner);
      el('rect', { x: -17, y: -17, width: 34, height: 34, rx: 2, class: 'stamp-line' }, inner);
      const t = el('text', { y: 1, class: 'stamp-ch' }, inner); t.textContent = mon;
      setTimeout(() => g.classList.add('out'), 1300);
      setTimeout(() => g.remove(), 2100);
    },
    floatText(pid, text, cls, dy) {
      const [x, y] = this.pt(pid);
      const t = el('text', { x, y: y - 22 + (dy || 0), class: 'float ' + (cls || '') }, this.layers.fx);
      t.textContent = text;
      setTimeout(() => t.remove(), 1500);
    },
    pulse(pid, cls) {
      const p = el('path', { d: this.md.provinces[pid].d, class: 'pulse ' + (cls || ''), 'fill-rule': 'evenodd' }, this.layers.fx0);
      setTimeout(() => p.remove(), 900);
    },
    battleMark(from, to) {
      const r = this.roadEl(from, to);
      const [x, y] = this.entryPoint(from, to);
      const g = el('g', { class: 'battle', transform: `translate(${x} ${y})` }, this.layers.fx);
      el('circle', { r: 16, class: 'battle-bg' }, g);
      const t = el('text', { y: 1, class: 'battle-ch' }, g); t.textContent = '⚔';
      let arrow = null;
      if (r) {
        arrow = el('path', { d: r.el.getAttribute('d'), class: 'march-arrow' }, this.layers.fx0);
        const len = r.el.getTotalLength();
        const reverse = !(r.a === from);
        arrow.style.strokeDasharray = `${len}`;
        arrow.style.strokeDashoffset = reverse ? `${-len}` : `${len}`;
        arrow.getBoundingClientRect();
        arrow.style.transition = 'stroke-dashoffset .45s ease-out';
        arrow.style.strokeDashoffset = '0';
      }
      return () => { g.classList.add('out'); if (arrow) arrow.classList.add('out'); setTimeout(() => { g.remove(); if (arrow) arrow.remove(); }, 400); };
    },
    marchLine(from, to, cls) {
      const r = this.roadEl(from, to); if (!r) return;
      const arrow = el('path', { d: r.el.getAttribute('d'), class: 'march-arrow ' + (cls || '') }, this.layers.fx0);
      const len = r.el.getTotalLength();
      const reverse = !(r.a === from);
      arrow.style.strokeDasharray = `${len}`;
      arrow.style.strokeDashoffset = reverse ? `${-len}` : `${len}`;
      arrow.getBoundingClientRect();
      arrow.style.transition = 'stroke-dashoffset .5s ease-out';
      arrow.style.strokeDashoffset = '0';
      setTimeout(() => { arrow.classList.add('out'); }, 700);
      setTimeout(() => arrow.remove(), 1100);
    },
    shade, lum,
  };
  window.MapView = MapView;
})();
