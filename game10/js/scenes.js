/*
 * ぐるり、夜まつり ― 戦い いがいの 画面
 * 表紙・はじめの話・道のり（地図）・夜店・休み処・ともだち帳・遊びかた・むすび
 */
(function (root) {
  'use strict';
  const G = root.G10, D = G.D, S = G.S, R = G.R, A = G.A;
  const W = 1280, H = 720, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;

  // ================================================================ 表紙
  const title = {
    enter() { A.startBgm('title'); this.confirm = false; },
    update() {},
    draw(c) {
      const bg = R.background(0);
      c.drawImage(bg.cv, 0, 0, W, H);
      R.bgAnim(c, 0, G.t);
      // ときどき 花火
      const k = Math.floor(G.t / 1.6);
      if (k !== this.lastFw && G.t > 0.5) { this.lastFw = k; this.fw = this.fw || []; this.fw.push({ x: 200 + R.hash(k) * 880, y: 90 + R.hash(k + 9) * 120, t0: G.t, col: ['#ff7a5a', '#ffd34a', '#7ad8ff', '#ff8ad8'][k % 4] }); }
      drawFireworks(c, this.fw || []);
      // ともだちの かげ
      const book = G.save.book;
      const known = D.SPECIES_ORDER.filter(sp => book[sp] > 0 && !D.SPECIES[sp].boss);
      known.slice(0, 10).forEach((sp, i) => R.drawYokai(c, sp, 560 + i * 62, 640, 60, G.t, { seed: i, happy: true }));
      R.drawYui(c, 330, 580, 230, G.t, null);
      // 題
      const ty = 200;
      c.save();
      c.shadowColor = 'rgba(255,120,80,0.8)'; c.shadowBlur = 30;
      R.text(c, 'ぐるり、夜まつり', W / 2, ty, { size: 86, font: R.FONT_TITLE, color: '#fff0d6', stroke: 'rgba(120,20,20,0.9)', sw: 8 });
      c.restore();
      R.text(c, '― ゆいと 妖（あやかし）の 参道 ―', W / 2, ty + 70, { size: 24, font: R.FONT_TITLE, color: '#ffd8b0', stroke: 'rgba(0,0,0,0.6)', sw: 4 });
      // 紅白の ひもの 輪
      c.save(); c.translate(W / 2, ty + 112);
      c.lineWidth = 6; c.strokeStyle = '#e0323a'; c.beginPath(); c.ellipse(0, 0, 150, 10, 0, 0, TAU); c.stroke();
      c.setLineDash([10, 10]); c.lineDashOffset = -G.t * 20; c.strokeStyle = '#fff'; c.stroke(); c.restore();
      const run = G.save.run;
      const bx = W / 2 - 150;
      let y = 360;
      if (run) {
        const area = D.AREAS[run.a];
        G.button({ x: bx, y, w: 300, h: 60, label: 'つづきから', sub: area ? area.name + '（' + (run.n + 1) + 'ばんめ）' : '', style: 'main', def: true, on: () => { A.init(); G.go('map'); } });
        y += 74;
        G.button({ x: bx, y, w: 300, h: 50, label: 'はじめから', on: () => { this.confirm = true; } });
      } else {
        G.button({ x: bx, y, w: 300, h: 60, label: G.save.cleared ? 'もういちど あそぶ' : 'はじめる', style: 'main', def: true, on: startNew });
      }
      y += run ? 62 : 74;
      const nb = D.SPECIES_ORDER.filter(sp => G.save.book[sp] > 0).length;
      G.button({ x: bx, y, w: 145, h: 46, label: 'ともだち帳', sub: nb + ' / 16', size: 17, on: () => G.go('book', { back: 'title' }) });
      G.button({ x: bx + 155, y, w: 145, h: 46, label: '遊びかた', size: 17, on: () => G.go('howto', { back: 'title' }) });
      R.text(c, 'マウスで あそびます（なぞって はなす）　M：音の あり・なし　Esc：ひとやすみ', 1250, 704, { size: 14, align: 'right', color: 'rgba(255,230,200,0.6)', weight: 'normal' });
      if (G.save.cleared) R.text(c, '夜まつりに たどりついた 回数：' + G.save.cleared, 1250, 24, { size: 13, align: 'right', color: 'rgba(255,230,200,0.6)', weight: 'normal' });
      if (this.confirm) {
        c.fillStyle = 'rgba(8,4,16,0.7)'; c.fillRect(0, 0, W, H);
        R.panel(c, W / 2 - 280, 250, 560, 220);
        R.text(c, 'はじめから やりなおしますか？', W / 2, 300, { size: 24, color: '#ffe2b0' });
        R.text(c, 'いまの 道のりは きえます（ともだち帳は のこります）。', W / 2, 344, { size: 16, color: '#f0e0d0', weight: 'normal' });
        G.button({ x: W / 2 - 230, y: 390, w: 210, h: 52, label: 'やりなおす', style: 'main', on: startNew });
        G.button({ x: W / 2 + 20, y: 390, w: 210, h: 52, label: 'やめる', def: true, on: () => { this.confirm = false; } });
      }
    },
    key(k) { if (k === 'Escape' && this.confirm) { this.confirm = false; return true; } return false; }
  };
  function startNew() {
    title.confirm = false;
    A.init();
    G.newRun();
    G.go('story', { lines: D.OPENING, next: () => G.go('map'), bg: 0 });
  }
  function drawFireworks(c, list) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i], u = (G.t - f.t0) / 1.6;
      if (u > 1) { list.splice(i, 1); continue; }
      const n = 30;
      for (let k = 0; k < n; k++) {
        const a = k / n * TAU, r = 90 * (1 - Math.exp(-u * 5));
        const x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r + u * u * 40;
        c.globalAlpha = (1 - u) * (u > 0.6 ? 0.5 + 0.5 * Math.sin(G.t * 30 + k) : 1);
        c.fillStyle = k % 3 ? f.col : '#fff';
        c.beginPath(); c.arc(x, y, 2.4 * (1 - u * 0.4), 0, TAU); c.fill();
      }
    }
    c.globalAlpha = 1; c.restore();
  }
  G.drawFireworks = drawFireworks;

  // ================================================================ おはなし（文を 1つずつ）
  const story = {
    enter(arg) { this.lines = arg.lines; this.next = arg.next; this.bg = arg.bg || 0; this.i = 0; this.t0 = G.t; this.area = arg.area; A.startBgm(arg.bgm || 'title'); },
    update() {},
    advance() {
      if (G.t - this.t0 < 0.3) return;
      A.play('ui');
      this.i++; this.t0 = G.t;
      if (this.i >= this.lines.length) { const n = this.next; this.next = null; if (n) n(); }
    },
    draw(c) {
      const bg = R.background(this.bg);
      c.drawImage(bg.cv, 0, 0, W, H);
      R.bgAnim(c, this.bg, G.t);
      c.fillStyle = 'rgba(6,3,12,0.45)'; c.fillRect(0, 0, W, H);
      if (this.area) R.text(c, this.area, W / 2, 130, { size: 40, font: R.FONT_TITLE, color: '#ffe2b0', stroke: 'rgba(0,0,0,0.6)', sw: 6 });
      R.drawYui(c, 250, 560, 220, G.t, this.i === this.lines.length - 1 ? 'happy' : null);
      const ln = this.lines[Math.min(this.i, this.lines.length - 1)] || '';
      const a = clamp((G.t - this.t0) * 3, 0, 1);
      R.panel(c, 380, 470, 820, 150, { fill: 'rgba(20,10,22,0.92)' });
      c.globalAlpha = a;
      const lines = G.wrap(c, ln, 760, 'bold 26px ' + R.FONT_SOFT);
      lines.forEach((l, k) => R.text(c, l, 410, 525 + k * 38, { size: 26, align: 'left', font: R.FONT_SOFT, color: '#fff4e6' }));
      c.globalAlpha = 1;
      R.text(c, (this.i + 1) + ' / ' + this.lines.length + '　クリックで つぎへ', 1180, 600, { size: 13, align: 'right', color: 'rgba(255,220,200,0.6)', weight: 'normal' });
      G.button({ x: 1120, y: 24, w: 130, h: 40, label: 'とばす', size: 16, style: 'ghost', on: () => { const n = this.next; this.next = null; if (n) n(); } });
    },
    down() { this.advance(); },
    key(k) { if (k === 'Enter' || k === ' ') { this.advance(); return true; } if (k === 'Escape') { const n = this.next; this.next = null; if (n) n(); return true; } return false; }
  };

  // ================================================================ 道のり（地図）
  const NODE_INFO = {
    battle: (bid) => { const b = D.BATTLES[bid]; const sps = [...new Set(b.queue)]; return { name: b.title, kind: 'battle', sub: '妖 ' + b.queue.length + '体', sps }; },
    rest: () => ({ name: '休み処', kind: 'rest', sub: '体力が ぜんぶ もどる・小判 +4' }),
    shop: (id) => ({ name: '夜店', kind: 'shop', sub: '買いものが できる' })
  };
  function nodeInfo(id) {
    if (id === 'rest') return NODE_INFO.rest();
    if (id.startsWith('shop')) return NODE_INFO.shop(id);
    const b = D.BATTLES[id];
    const inf = NODE_INFO.battle(id);
    if (b.boss) { inf.kind = 'boss'; inf.sub = 'ぬし：' + (G.save.book[b.boss] ? D.SPECIES[b.boss].name : '？？？'); }
    else if (b.rareFirst) { inf.kind = 'elite'; inf.sub = 'めずらしい妖が いるらしい（にげる前に むすぼう）'; }
    return inf;
  }
  function nodeLayout(area) {
    const n = area.nodes.length;
    const out = [];
    area.nodes.forEach((nd, k) => {
      const x = 170 + k * (940 / (n - 1));
      if (Array.isArray(nd)) out.push(nd.map((id, j) => ({ id, x, y: 420 + (j ? 85 : -85), k, j })));
      else out.push([{ id: nd, x, y: 420, k, j: 0 }]);
    });
    return out;
  }
  const map = {
    enter() {
      const run = G.run();
      if (!run) { G.go('title', null, { instant: true }); return; }
      if (run.a >= D.AREAS.length) { G.go('ending', null, { instant: true }); return; }
      A.startBgm('map');
      this.walk = null; this.hover = null;
      this.intro = !run.areaIntroDone;
      this.introI = 0; this.t0 = G.t;
    },
    update() {
      const w = this.walk;
      if (w && G.t >= w.t0 + w.dur) {
        this.walk = null;
        enterNode(w.id);
      } else if (w) {
        const k = Math.floor((G.t - w.t0) / 0.18);
        if (k !== w.k) { w.k = k; A.play('step'); }
      }
    },
    draw(c) {
      const run = G.run();
      if (!run) return;
      const area = D.AREAS[run.a];
      const bg = R.background(area.id);
      c.drawImage(bg.cv, 0, 0, W, H);
      R.bgAnim(c, area.id, G.t);
      c.fillStyle = 'rgba(6,3,12,0.35)'; c.fillRect(0, 0, W, H);
      const kanji = ['一', '二', '三', '四'][run.a];
      R.text(c, 'その' + kanji + '　' + area.name, 40, 52, { size: 36, align: 'left', font: R.FONT_TITLE, color: '#ffe2b0', stroke: 'rgba(0,0,0,0.6)', sw: 6 });
      R.text(c, area.sub, 44, 92, { size: 18, align: 'left', color: '#f0d8c0', stroke: 'rgba(0,0,0,0.6)', sw: 4, weight: 'normal' });
      // 社の 灯り（すすむほど ちかく）
      const prog = (run.a + run.n / area.nodes.length) / D.AREAS.length;
      const gx = 1180, gy = 90;
      const glow = c.createRadialGradient(gx, gy, 4, gx, gy, 60 + prog * 120);
      glow.addColorStop(0, 'rgba(255,200,120,' + (0.35 + prog * 0.4) + ')'); glow.addColorStop(1, 'rgba(255,150,80,0)');
      c.fillStyle = glow; c.beginPath(); c.arc(gx, gy, 60 + prog * 120, 0, TAU); c.fill();
      R.text(c, '社まで あと ' + Math.round((1 - prog) * 100) + '%', gx, gy + 6, { size: 14, color: '#fff0d6', stroke: 'rgba(60,20,0,0.8)', sw: 3 });
      const lay = nodeLayout(area);
      // 道
      c.save();
      c.lineCap = 'round';
      for (let k = 0; k < lay.length; k++) {
        const from = k === 0 ? [{ x: 60, y: 420 }] : lay[k - 1];
        for (const a of from) for (const b of lay[k]) {
          const chs = run.choices || {};
          const okA = k === 0 || lay[k - 1].length < 2 || chs[k - 1] == null || chs[k - 1] === a.j;
          const okB = lay[k].length < 2 || chs[k] == null || chs[k] === b.j;
          const done = k <= run.n - 1 && okA && okB;
          c.lineWidth = 16; c.strokeStyle = 'rgba(30,20,20,0.7)';
          c.beginPath(); c.moveTo(a.x, a.y); c.bezierCurveTo((a.x + b.x) / 2, a.y, (a.x + b.x) / 2, b.y, b.x, b.y); c.stroke();
          c.lineWidth = 10; c.strokeStyle = done ? 'rgba(255,210,150,0.55)' : 'rgba(200,170,140,0.35)';
          c.setLineDash([2, 14]); c.stroke(); c.setLineDash([]);
        }
      }
      c.restore();
      // ノード
      this.hover = null;
      this.targets = (lay[run.n] || []).map(nd => ({ id: nd.id, x: nd.x, y: nd.y, k: nd.k, j: nd.j }));
      const ch = run.choices || {};
      for (const col of lay) for (const nd of col) {
        let state = nd.k < run.n ? 'done' : (nd.k === run.n ? 'next' : 'later');
        if (state === 'done' && col.length > 1 && ch[nd.k] != null && ch[nd.k] !== nd.j) state = 'skipped';
        const hov = state === 'next' && !this.walk && !this.intro && Math.hypot(G.mouse.x - nd.x, G.mouse.y - nd.y) < 52;
        if (hov) this.hover = nd;
        drawNode(c, nd, state, hov);
      }
      // ゆいと 行列
      let yx, yy;
      if (this.walk) {
        const u = clamp((G.t - this.walk.t0) / this.walk.dur, 0, 1);
        yx = lerp(this.walk.x0, this.walk.x1, u); yy = lerp(this.walk.y0, this.walk.y1, u) - Math.abs(Math.sin(u * 14)) * 4;
      } else {
        if (run.n === 0) { yx = 60; yy = 420; }
        else { const prev = lay[run.n - 1]; const p = prev[run.lastJ || 0] || prev[0]; yx = p.x; yy = p.y; }
      }
      const fr = Object.keys(run.P.friends).filter(k => run.P.friends[k] > 0);
      fr.forEach((sp, k) => {
        const lag = (k + 1) * 34;
        R.drawYokai(c, sp, yx - lag - 10, yy + 24 + Math.sin(G.t * 3 + k) * 2, D.SPECIES[sp].boss ? 40 : 44, G.t, { seed: k });
      });
      R.drawYui(c, yx + 10, yy - 10, 110, G.t, this.walk ? 'happy' : null);
      // 説明
      if (this.hover) drawNodeTip(c, this.hover);
      else if (!this.walk && !this.intro) {
        const cur = area.nodes[run.n];
        R.text(c, Array.isArray(cur) ? 'わかれ道。どちらへ 行く？（光っている ところを クリック）' : '光っている ところを クリックして すすもう', W / 2, 640, { size: 18, color: '#fff0dc', stroke: 'rgba(0,0,0,0.7)', sw: 4 });
      }
      G.drawStatusBar(c, run.P, 30, 660 - 4);
      G.button({ x: 900, y: 656, w: 170, h: 48, label: 'ともだち帳', size: 17, on: () => G.go('book', { back: 'map' }) });
      G.button({ x: 1084, y: 656, w: 170, h: 48, label: 'ひとやすみ', size: 17, on: openMapMenu });
      if (this.intro) drawAreaIntro(c, area);
    },
    down(x, y) {
      if (this.intro) { this.nextIntro(); return; }
      if (this.walk) return;
      const nd = (this.targets || []).find(t => Math.hypot(x - t.x, y - t.y) < 56);
      if (nd) startWalk(nd);
    },
    nextIntro() {
      if (G.t - this.t0 < 0.4) return;
      A.play('ui');
      this.intro = false; G.run().areaIntroDone = true; G.store();
    },
    key(k) {
      if (this.intro && (k === 'Enter' || k === ' ' || k === 'Escape')) { if (k === 'Escape') { this.intro = false; G.run().areaIntroDone = true; G.store(); } else this.nextIntro(); return true; }
      if (k === 'Escape') { openMapMenu(); return true; }
      return false;
    }
  };
  function openMapMenu() {
    G.openMenu([
      { label: 'つづける', on: () => { G.menu = null; } },
      { label: '遊びかた', on: () => { G.menu = null; G.go('howto', { back: 'map' }); } },
      { label: 'タイトルへ（ここまで 保存）', on: () => { G.menu = null; G.store(); G.go('title'); } }
    ]);
  }
  function drawAreaIntro(c, area) {
    c.fillStyle = 'rgba(6,3,12,0.55)'; c.fillRect(0, 0, W, H);
    const lines = [];
    for (const ln of area.intro) for (const l of G.wrap(c, ln, 720, 'bold 22px ' + R.FONT_SOFT)) lines.push(l);
    const h = 120 + lines.length * 34;
    const y = (H - h) / 2 - 20;
    R.panel(c, 240, y, 800, h, { fill: 'rgba(20,10,22,0.94)' });
    const kanji = ['一', '二', '三', '四'][area.id - 1];
    R.text(c, 'その' + kanji + '　' + area.name, W / 2, y + 44, { size: 26, font: R.FONT_TITLE, color: '#ffd8a8' });
    lines.forEach((l, k) => {
      c.globalAlpha = clamp((G.t - map.t0) * 3 - k * 0.6, 0, 1);
      R.text(c, l, W / 2, y + 96 + k * 34, { size: 22, font: R.FONT_SOFT, color: '#fff4e6' });
    });
    c.globalAlpha = 1;
    R.text(c, 'クリックで すすむ', W / 2, y + h - 20, { size: 13, color: 'rgba(255,220,200,0.6)', weight: 'normal' });
  }
  function nodeColor(kind) { return { battle: '#c84a3a', elite: '#d8a020', rest: '#4a9a6a', shop: '#c8508a', boss: '#8a2a8a' }[kind] || '#888'; }
  function drawNode(c, nd, state, hov) {
    const inf = nodeInfo(nd.id);
    const r = inf.kind === 'boss' ? 54 : 44;
    if (state === 'skipped') {
      c.save(); c.globalAlpha = 0.35;
      c.beginPath(); c.arc(nd.x, nd.y, r, 0, TAU); c.fillStyle = 'rgba(30,24,34,0.8)'; c.fill();
      c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.3)'; c.setLineDash([4, 6]); c.stroke(); c.setLineDash([]);
      c.restore();
      R.text(c, inf.name + '（とおらなかった）', nd.x, nd.y + r + 20, { size: 13, color: 'rgba(255,240,220,0.45)', stroke: 'rgba(0,0,0,0.6)', sw: 3, weight: 'normal' });
      return;
    }
    c.save();
    if (state === 'next') {
      const pul = 0.5 + 0.5 * Math.sin(G.t * 4);
      c.shadowColor = '#ffe08a'; c.shadowBlur = 18 + pul * 14;
    }
    c.beginPath(); c.arc(nd.x, nd.y, r + (hov ? 4 : 0), 0, TAU);
    c.fillStyle = state === 'done' ? 'rgba(40,30,40,0.85)' : 'rgba(24,12,24,0.92)'; c.fill();
    c.lineWidth = state === 'next' ? 4 : 2.5; c.strokeStyle = state === 'done' ? 'rgba(255,255,255,0.25)' : nodeColor(inf.kind); c.stroke();
    c.restore();
    c.save();
    if (state === 'done') c.globalAlpha = 0.45;
    if (inf.kind === 'battle') {
      const sp = inf.sps[0];
      R.drawYokai(c, sp, nd.x, nd.y + 4, 62, G.t, { seed: nd.k, silhouette: G.save.book[sp] ? null : 'rgba(20,10,30,0.92)', shadow: false });
    } else if (inf.kind === 'elite') {
      const sp = D.BATTLES[nd.id].queue[0];
      R.drawYokai(c, sp, nd.x, nd.y + 4, 62, G.t, { seed: 2, silhouette: G.save.book[sp] ? null : 'rgba(40,30,10,0.92)', shadow: false });
      R.text(c, '★', nd.x + 30, nd.y - 30, { size: 22, color: '#ffe060', stroke: 'rgba(0,0,0,0.6)', sw: 3 });
    } else if (inf.kind === 'boss') {
      const sp = D.BATTLES[nd.id].boss;
      R.drawYokai(c, sp, nd.x, nd.y + 12, 92, G.t, { seed: 4, silhouette: G.save.book[sp] ? null : 'rgba(30,10,30,0.95)', shadow: false });
    } else if (inf.kind === 'rest') {
      // お地蔵さま
      c.fillStyle = '#a8a8b0'; c.beginPath(); c.ellipse(nd.x, nd.y + 10, 16, 20, 0, 0, TAU); c.fill();
      c.beginPath(); c.arc(nd.x, nd.y - 16, 12, 0, TAU); c.fill();
      c.fillStyle = '#d8302a'; c.beginPath(); c.moveTo(nd.x - 15, nd.y - 6); c.lineTo(nd.x + 15, nd.y - 6); c.lineTo(nd.x, nd.y + 12); c.fill();
      c.strokeStyle = '#3a3a44'; c.lineWidth = 1.5; c.beginPath(); c.arc(nd.x - 4, nd.y - 16, 3, 0.2, Math.PI - 0.2); c.stroke(); c.beginPath(); c.arc(nd.x + 4, nd.y - 16, 3, 0.2, Math.PI - 0.2); c.stroke();
    } else if (inf.kind === 'shop') {
      c.fillStyle = '#3a1820'; c.fillRect(nd.x - 22, nd.y - 6, 44, 30);
      for (let k = 0; k < 5; k++) { c.fillStyle = k % 2 ? '#fff' : '#d8302a'; c.beginPath(); c.moveTo(nd.x - 28 + k * 11.2, nd.y - 6); c.lineTo(nd.x - 28 + (k + 1) * 11.2, nd.y - 6); c.lineTo(nd.x - 24 + (k + 1) * 9.6, nd.y - 24); c.lineTo(nd.x - 24 + k * 9.6, nd.y - 24); c.fill(); }
      R.drawIcon(c, 'L', nd.x, nd.y + 9, 30);
    }
    c.restore();
    if (state === 'done') R.text(c, '✓', nd.x + r * 0.7, nd.y + r * 0.7, { size: 22, color: '#a8f0a0', stroke: 'rgba(0,0,0,0.7)', sw: 3 });
    R.text(c, inf.name, nd.x, nd.y + r + 20, { size: 15, color: state === 'later' ? 'rgba(255,240,220,0.6)' : '#fff0dc', stroke: 'rgba(0,0,0,0.8)', sw: 4 });
  }
  function drawNodeTip(c, nd) {
    const inf = nodeInfo(nd.id);
    const lines = [inf.sub];
    if (inf.kind === 'battle' || inf.kind === 'elite') {
      const names = inf.sps.map(sp => G.save.book[sp] ? D.SPECIES[sp].name : '？？？');
      lines.push('出る妖：' + names.join('・'));
    }
    if (inf.kind === 'boss') lines.push('花火を つなぐほど 空から とどく');
    const w = 420, h = 50 + lines.length * 26;
    const x = clamp(nd.x - w / 2, 20, W - w - 20), y = nd.y < 400 ? nd.y + 74 : nd.y - h - 74;
    R.panel(c, x, y, w, h, { r: 12 });
    R.text(c, inf.name, x + 20, y + 26, { size: 19, align: 'left', color: '#ffe2b0' });
    lines.forEach((l, k) => R.text(c, l, x + 20, y + 54 + k * 26, { size: 15, align: 'left', color: '#f0e0d0', weight: 'normal' }));
  }
  function startWalk(nd) {
    const run = G.run();
    const area = D.AREAS[run.a];
    const lay = nodeLayout(area);
    let x0 = 60, y0 = 420;
    if (run.n > 0) { const p = lay[run.n - 1][run.lastJ || 0] || lay[run.n - 1][0]; x0 = p.x; y0 = p.y; }
    run.lastJ = nd.j;
    run.choices = run.choices || {};
    run.choices[run.n] = nd.j;
    A.play('uiok');
    map.walk = { id: nd.id, x0, y0, x1: nd.x, y1: nd.y, t0: G.t, dur: 0.85, k: -1 };
  }
  function enterNode(id) {
    if (id === 'rest') G.go('rest');
    else if (id.startsWith('shop')) G.go('shop', { id });
    else G.go('battle', { bid: id });
  }

  // ================================================================ 休み処
  const rest = {
    enter() {
      const run = G.run();
      this.before = run.P.hp;
      run.P.hp = S.stats(run.P).maxHp;
      run.P.coins += 4;
      this.t0 = G.t;
      A.play('heal');
      G.advance();
      G.store();
    },
    update() {},
    draw(c) {
      const run = G.run();
      const aid = D.AREAS[Math.min(run.a, 3)].id;
      const bg = R.background(aid);
      c.drawImage(bg.cv, 0, 0, W, H);
      R.bgAnim(c, aid, G.t);
      c.fillStyle = 'rgba(6,3,12,0.4)'; c.fillRect(0, 0, W, H);
      // ござ と お地蔵さま
      c.fillStyle = '#7a5a30'; c.fillRect(380, 470, 520, 90);
      c.fillStyle = '#d8302a'; c.fillRect(380, 470, 520, 10);
      c.fillStyle = '#a8a8b0'; c.beginPath(); c.ellipse(980, 430, 40, 55, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(980, 360, 30, 0, TAU); c.fill();
      c.fillStyle = '#d8302a'; c.beginPath(); c.moveTo(944, 385); c.lineTo(1016, 385); c.lineTo(980, 430); c.fill();
      R.drawYui(c, 560, 440, 170, G.t, 'happy');
      const fr = Object.keys(run.P.friends).filter(k => run.P.friends[k] > 0);
      fr.forEach((sp, k) => R.drawYokai(c, sp, 440 + (k % 8) * 60, 560 + Math.floor(k / 8) * 50, 56, G.t, { seed: k, happy: true }));
      R.panel(c, 290, 90, 700, 150);
      R.text(c, 'お地蔵さまの 休み処', W / 2, 132, { size: 28, font: R.FONT_TITLE, color: '#ffe2b0' });
      R.text(c, 'みんなで ひとやすみ。体力が ぜんぶ もどった（' + this.before + ' → ' + run.P.hp + '）。', W / 2, 178, { size: 18, color: '#f0e0d0', weight: 'normal' });
      R.text(c, 'おそなえの おさがりで 小判 +4。', W / 2, 206, { size: 18, color: '#ffe08a', weight: 'normal' });
      G.drawStatusBar(c, run.P, 30, 656);
      if (G.t - this.t0 > 0.5) G.button({ x: W / 2 - 120, y: 600, w: 240, h: 52, label: '道に もどる', style: 'main', def: true, on: () => G.go('map') });
    }
  };

  // ================================================================ 夜店
  const SHOPKEEP = { shop1: 'mame', shop2: 'kasa', shop3: 'kappa', shop4: 'chochin' };
  function drawItemIcon(c, k, x, y, s) {
    c.save(); c.translate(x, y);
    if (k === 'takoyaki') {
      c.fillStyle = '#e8d8a8'; c.beginPath(); c.ellipse(0, s * 0.18, s * 0.42, s * 0.14, 0, 0, TAU); c.fill();
      for (const [dx, dy] of [[-0.2, 0], [0.2, 0], [0, -0.14]]) {
        c.fillStyle = '#c87a3a'; c.beginPath(); c.arc(dx * s, dy * s, s * 0.17, 0, TAU); c.fill();
        c.fillStyle = '#5a2a10'; c.beginPath(); c.arc(dx * s, dy * s - s * 0.04, s * 0.12, Math.PI * 1.1, Math.PI * 1.9); c.fill();
        c.fillStyle = '#7ac05a'; c.fillRect(dx * s - 2, dy * s - s * 0.12, 3, 3);
      }
    } else if (k === 'ringoame') {
      c.strokeStyle = '#e8d8b0'; c.lineWidth = s * 0.05; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, s * 0.45); c.stroke();
      const g = c.createRadialGradient(-s * 0.08, -s * 0.12, 2, 0, -s * 0.05, s * 0.25); g.addColorStop(0, '#ff9a9a'); g.addColorStop(1, '#c0101a');
      c.fillStyle = g; c.beginPath(); c.arc(0, -s * 0.05, s * 0.24, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.ellipse(-s * 0.09, -s * 0.13, s * 0.06, s * 0.04, -0.6, 0, TAU); c.fill();
    } else if (k === 'omen') R.mask(c, 0, 0, s * 0.9);
    else if (k === 'hanabidama') R.drawIcon(c, 'H', 0, 0, s * 1.1);
    else if (k === 'himo') R.cord(c, 0, 0, s * 0.8);
    else if (k === 'kingyo') {
      c.fillStyle = 'rgba(180,220,255,0.35)'; c.beginPath(); c.moveTo(-s * 0.25, -s * 0.2); c.quadraticCurveTo(-s * 0.35, s * 0.35, 0, s * 0.38); c.quadraticCurveTo(s * 0.35, s * 0.35, s * 0.25, -s * 0.2); c.closePath(); c.fill();
      c.strokeStyle = '#d8302a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-s * 0.2, -s * 0.24); c.lineTo(s * 0.2, -s * 0.24); c.stroke();
      c.fillStyle = '#ff6a3a'; c.beginPath(); c.ellipse(0, s * 0.12, s * 0.12, s * 0.07, 0.2, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(s * 0.1, s * 0.12); c.lineTo(s * 0.2, s * 0.04); c.lineTo(s * 0.2, s * 0.2); c.fill();
    } else if (k === 'wataame') {
      c.strokeStyle = '#e8d8b0'; c.lineWidth = s * 0.05; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, s * 0.45); c.stroke();
      c.fillStyle = '#ffc8e0';
      for (let q = 0; q < 7; q++) { c.beginPath(); c.arc(Math.cos(q) * s * 0.15, -s * 0.12 + Math.sin(q * 2) * s * 0.1, s * 0.15, 0, TAU); c.fill(); }
    }
    c.restore();
  }
  const shop = {
    enter(arg) {
      const run = G.run();
      run.shopBought = run.shopBought || {};
      this.id = arg.id; this.bought = run.shopBought[arg.id] = run.shopBought[arg.id] || {};
      this.t0 = G.t; this.msg = null; A.startBgm('map');
    },
    update() {},
    buy(k) {
      const run = G.run(), P = run.P, it = D.SHOP_ITEMS[k];
      if (P.coins < it.price) { A.play('nope'); this.msg = { text: '小判が たりない…', t: G.t }; return; }
      P.coins -= it.price;
      this.bought[k] = true;
      if (k === 'takoyaki') P.hp = S.stats(P).maxHp;
      else { P.items[k] = (P.items[k] || 0) + 1; if (k === 'ringoame') P.hp += 3; }
      A.play('buy');
      this.msg = { text: it.name + ' を かった！', t: G.t };
      G.store();
    },
    draw(c) {
      const run = G.run(), P = run.P;
      const aid = D.AREAS[Math.min(run.a, 3)].id;
      const bg = R.background(aid);
      c.drawImage(bg.cv, 0, 0, W, H);
      R.bgAnim(c, aid, G.t);
      c.fillStyle = 'rgba(6,3,12,0.45)'; c.fillRect(0, 0, W, H);
      // やたいの のれん
      for (let k = 0; k < 16; k++) { c.fillStyle = k % 2 ? '#fff4ea' : '#d8302a'; c.beginPath(); c.moveTo(k * 80, 0); c.lineTo(k * 80 + 80, 0); c.lineTo(k * 80 + 80, 60); c.quadraticCurveTo(k * 80 + 40, 80, k * 80, 60); c.fill(); }
      R.text(c, '夜店', W / 2, 118, { size: 36, font: R.FONT_TITLE, color: '#ffe2b0', stroke: 'rgba(0,0,0,0.6)', sw: 6 });
      const kp = SHOPKEEP[this.id] || 'mame';
      R.drawYokai(c, kp, 170, 220, 110, G.t, { seed: 1, happy: true });
      R.panel(c, 240, 160, 380, 70, { r: 14 });
      R.text(c, G.save.book[kp] ? '「' + D.SPECIES[kp].name + 'の 店だよ。見てって！」' : '「いらっしゃい。妖の 店だよ。」', 430, 196, { size: 17, color: '#fff0dc', font: R.FONT_SOFT });
      const items = D.SHOPS[this.id];
      items.forEach((k, i) => {
        const it = D.SHOP_ITEMS[k];
        const x = 110 + i * 270, y = 270, w = 240, h = 300;
        const owned = it.once && P.items[k];
        R.panel(c, x, y, w, h, { r: 14 });
        drawItemIcon(c, k, x + w / 2, y + 74, 90);
        R.text(c, it.name, x + w / 2, y + 150, { size: 22, color: '#ffe2b0' });
        const lines = G.wrap(c, it.text, w - 30, 'normal 16px ' + R.FONT);
        lines.forEach((l, q) => R.text(c, l, x + w / 2, y + 186 + q * 22, { size: 16, color: '#f0e0d0', weight: 'normal' }));
        if (k === 'takoyaki') R.text(c, 'いまの 体力 ' + P.hp + ' / ' + S.stats(P).maxHp, x + w / 2, y + 220, { size: 13, color: 'rgba(255,220,200,0.6)', weight: 'normal' });
        const sold = this.bought[k] || owned;
        const full = k === 'takoyaki' && P.hp >= S.stats(P).maxHp;
        G.button({ x: x + 30, y: y + h - 62, w: w - 60, h: 46, label: sold ? (owned ? 'もっている' : 'うりきれ') : (full ? '体力は まんたん' : '小判 ' + it.price + ' で かう'), size: 17,
          disabled: sold || full || P.coins < it.price, style: 'main', on: () => this.buy(k) });
      });
      if (this.msg && G.t - this.msg.t < 1.6) R.text(c, this.msg.text, W / 2, 600, { size: 20, color: '#fff0a0', stroke: 'rgba(0,0,0,0.7)', sw: 4 });
      G.drawStatusBar(c, P, 30, 656);
      G.button({ x: 1000, y: 650, w: 250, h: 54, label: '道に もどる', def: true, on: () => { G.advance(); G.store(); G.go('map'); } });
    },
    key(k) { if (k === 'Escape') { G.openMenu([{ label: 'つづける', on: () => { G.menu = null; } }, { label: 'タイトルへ（ここまで 保存）', on: () => { G.menu = null; G.store(); G.go('title'); } }]); return true; } return false; }
  };

  // ================================================================ ともだち帳
  const book = {
    enter(arg) { this.back = (arg && arg.back) || 'title'; this.sel = null; },
    update() {},
    draw(c) {
      const bg = R.background(0);
      c.drawImage(bg.cv, 0, 0, W, H);
      c.fillStyle = 'rgba(6,3,12,0.55)'; c.fillRect(0, 0, W, H);
      const bk = G.save.book;
      const n = D.SPECIES_ORDER.filter(sp => bk[sp] > 0).length;
      R.text(c, 'ともだち帳', 60, 52, { size: 34, align: 'left', font: R.FONT_TITLE, color: '#ffe2b0' });
      R.text(c, n + ' / ' + D.SPECIES_ORDER.length + ' しゅるい', 290, 56, { size: 18, align: 'left', color: '#ffd0ec' });
      const cw = 150, ch = 132;
      let hov = null;
      D.SPECIES_ORDER.forEach((sp, i) => {
        const col = i % 4, row = (i / 4) | 0;
        const x = 50 + col * (cw + 12), y = 86 + row * (ch + 10);
        const known = bk[sp] > 0;
        const s = D.SPECIES[sp];
        const isHov = G.mouse.x >= x && G.mouse.x <= x + cw && G.mouse.y >= y && G.mouse.y <= y + ch;
        if (isHov) hov = sp;
        const sel = this.sel === sp;
        R.panel(c, x, y, cw, ch, { r: 12, border: sel ? '#ffe08a' : (s.rare ? 'rgba(255,224,120,0.6)' : (s.boss ? 'rgba(220,120,220,0.6)' : 'rgba(255,214,150,0.35)')), fill: isHov ? 'rgba(50,30,50,0.92)' : 'rgba(20,14,30,0.86)' });
        R.drawYokai(c, sp, x + cw / 2, y + 58, s.boss ? 70 : 80, G.t, { seed: i, silhouette: known ? null : 'rgba(10,6,16,0.95)', still: !known, shadow: false });
        R.text(c, known ? s.name : '？？？', x + cw / 2, y + ch - 18, { size: 15, color: known ? '#fff0dc' : 'rgba(255,255,255,0.4)' });
        if (s.rare) R.text(c, '★', x + 16, y + 18, { size: 16, color: '#ffe060' });
        if (s.boss) R.text(c, 'ぬし', x + 22, y + 18, { size: 12, color: '#f0b0f0' });
      });
      this.hov = hov;
      const sp = this.sel || hov;
      const x = 690, y = 92, w = 550, h = 590;
      R.panel(c, x, y, w, h);
      if (sp) {
        const s = D.SPECIES[sp], known = bk[sp] > 0;
        R.drawYokai(c, sp, x + 140, y + 160, s.boss ? 190 : 200, G.t, { seed: 3, silhouette: known ? null : 'rgba(10,6,16,0.95)', happy: known });
        R.text(c, known ? s.name : '？？？', x + 270, y + 70, { size: 30, align: 'left', font: R.FONT_TITLE, color: '#ffe2b0' });
        R.text(c, D.AREAS[s.area - 1].name + (s.rare ? '・めずらしい' : '') + (s.boss ? '・ぬし' : ''), x + 272, y + 110, { size: 16, align: 'left', color: '#f0c8a0', weight: 'normal' });
        if (known) {
          R.text(c, 'むすんだ数　' + bk[sp], x + 272, y + 140, { size: 16, align: 'left', color: '#ffd0ec', weight: 'normal' });
          const lines = G.wrap(c, s.desc, w - 60, 'normal 18px ' + R.FONT_SOFT);
          lines.forEach((l, k) => R.text(c, l, x + 30, y + 300 + k * 30, { size: 18, align: 'left', font: R.FONT_SOFT, color: '#fff4e6', weight: 'normal' }));
          R.text(c, 'ともだちの ちから', x + 30, y + 470, { size: 16, align: 'left', color: '#c8f0b0' });
          R.text(c, s.perkText + '（その 周回で むすぶと）', x + 30, y + 500, { size: 17, align: 'left', color: '#e8ffe0', weight: 'normal' });
        } else {
          const hint = s.boss ? D.AREAS[s.area - 1].name + 'の さいごに いる ぬし。' : (s.rare ? D.AREAS[s.area - 1].name + 'の ★の 道に あらわれるらしい。すぐ にげるので、輪で むすぼう。' : D.AREAS[s.area - 1].name + 'で 見かけるらしい。輪で かこむと ともだちに なる。');
          const lines = G.wrap(c, hint, w - 60, 'normal 18px ' + R.FONT_SOFT);
          lines.forEach((l, k) => R.text(c, l, x + 30, y + 300 + k * 30, { size: 18, align: 'left', font: R.FONT_SOFT, color: 'rgba(255,240,220,0.75)', weight: 'normal' }));
        }
      } else {
        R.text(c, '妖に マウスを のせると くわしく 見られます', x + w / 2, y + h / 2, { size: 17, color: 'rgba(255,230,200,0.7)', weight: 'normal' });
      }
      G.button({ x: 50, y: 662, w: 220, h: 46, label: 'もどる', def: true, size: 18, on: () => G.go(this.back) });
      R.text(c, 'クリックで えらぶ ／ Esc で もどる', 290, 686, { size: 13, align: 'left', color: 'rgba(255,230,200,0.55)', weight: 'normal' });
    },
    down(x, y) {
      const cw = 150, ch = 132;
      const i = D.SPECIES_ORDER.findIndex((sp, k) => { const bx = 50 + (k % 4) * (cw + 12), by = 86 + ((k / 4) | 0) * (ch + 10); return x >= bx && x <= bx + cw && y >= by && y <= by + ch; });
      if (i < 0) return;
      const sp = D.SPECIES_ORDER[i];
      this.sel = this.sel === sp ? null : sp; A.play('ui');
    },
    key(k) { if (k === 'Escape') { G.go(this.back); return true; } return false; }
  };

  // ================================================================ 遊びかた
  function drawHowto(c, onClose) {
    c.fillStyle = 'rgba(6,3,12,0.75)'; c.fillRect(0, 0, W, H);
    R.panel(c, 50, 30, 1180, 660);
    R.text(c, '遊びかた', W / 2, 70, { size: 30, font: R.FONT_TITLE, color: '#ffe2b0' });
    const secs = [
      { t: '① なぞって つなぐ', d: '同じ 玉を、たて・よこ・ななめに 3つ以上 なぞって はなす。提灯は どの玉とも つながる。ひもの 長さ（はじめは 6）まで つなげる。', pic: 'chain' },
      { t: '② 花火で おどかす', d: 'つないだ 花火は 1つずつ はじけて、となり（ななめも）の 妖に 1ずつ あたる。妖の まわりを 多く 通るほど 大きく へる。体力が なくなると おいはらう（小判を おとす）。', pic: 'fire' },
      { t: '③ ぐるっと むすぶ', d: 'なぞりはじめの 玉に もどると「輪」。輪の 中の 妖は ともだちに なり、中の 玉も ぜんぶ 輪の 色として もらえる。', pic: 'ring' },
      { t: '④ 妖の 数字', d: '1手ごとに へって、0で こうげき。赤い 数字は つぎに くる。青い 数字の めずらしい妖は、0で にげる。', pic: 'cd' }
    ];
    secs.forEach((s, i) => {
      const x = 80 + (i % 2) * 570, y = 110 + ((i / 2) | 0) * 250;
      R.text(c, s.t, x, y + 12, { size: 22, align: 'left', color: '#ffd8a8' });
      drawHowPic(c, s.pic, x + 90, y + 120);
      const lines = G.wrap(c, s.d, 330, 'normal 17px ' + R.FONT);
      lines.forEach((l, k) => R.text(c, l, x + 200, y + 60 + k * 26, { size: 17, align: 'left', color: '#fff0dc', weight: 'normal' }));
    });
    R.text(c, '団子で 体力が もどり、小判は 夜店で つかえる。ともだちに なった 妖は、その 周回の あいだ 力を かしてくれる。', W / 2, 620, { size: 16, color: '#f0d8c0', weight: 'normal' });
    G.button({ x: W / 2 - 110, y: 636, w: 220, h: 46, label: 'とじる', def: true, size: 18, on: onClose });
  }
  function drawHowPic(c, kind, x, y) {
    const s = 44;
    const P = (gx, gy) => ({ x: x + (gx - 1) * s, y: y + (gy - 1) * s });
    const cordLine = (pts, closed) => {
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); pts.forEach((p, k) => k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); if (closed) c.closePath();
      c.lineWidth = 7; c.strokeStyle = '#e0323a'; c.stroke(); c.setLineDash([6, 6]); c.lineDashOffset = -G.t * 16; c.strokeStyle = '#fff'; c.stroke(); c.restore();
    };
    if (kind === 'chain') {
      const g = [['K', 'D', 'K'], ['D', 'K', 'L'], ['D', 'D', 'K']];
      g.forEach((row, yy) => row.forEach((t, xx) => R.drawTile(c, t, P(xx, yy).x, P(xx, yy).y, s)));
      cordLine([P(0, 0), P(1, 1), P(2, 2)].concat([]), false);
      cordLine([P(2, 2), P(2, 1)], false);
    } else if (kind === 'fire') {
      const g = [['D', 'H', 'K'], ['H', null, 'K'], ['H', 'D', 'D']];
      g.forEach((row, yy) => row.forEach((t, xx) => t && R.drawTile(c, t, P(xx, yy).x, P(xx, yy).y, s)));
      R.drawYokai(c, 'mame', P(1, 1).x, P(1, 1).y, s, G.t, {});
      cordLine([P(1, 0), P(0, 1), P(0, 2)], false);
      R.text(c, '-3', P(1, 1).x + 26, P(1, 1).y - 26, { size: 18, color: '#ff8a7a', stroke: 'rgba(0,0,0,0.8)', sw: 4 });
    } else if (kind === 'ring') {
      const g = [['K', 'D', 'K'], ['D', null, 'D'], ['H', 'D', 'K']];
      g.forEach((row, yy) => row.forEach((t, xx) => t && R.drawTile(c, t, P(xx, yy).x, P(xx, yy).y, s)));
      R.drawYokai(c, 'mame', P(1, 1).x, P(1, 1).y, s, G.t, { happy: true });
      cordLine([P(1, 0), P(2, 1), P(1, 2), P(0, 1)], true);
      R.heart(c, P(1, 1).x, P(1, 1).y - 30, 20, '#ff8ab8');
    } else if (kind === 'cd') {
      R.drawYokai(c, 'kooni', x - 30, y, 70, G.t, {});
      c.beginPath(); c.arc(x - 4, y - 24, 13, 0, TAU); c.fillStyle = '#e0302a'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#ffd0c0'; c.stroke();
      R.text(c, '1', x - 4, y - 23, { size: 16 });
      R.drawYokai(c, 'zashiki', x + 50, y, 70, G.t, {});
      c.beginPath(); c.arc(x + 76, y - 24, 13, 0, TAU); c.fillStyle = '#3a6ad8'; c.fill(); c.strokeStyle = '#d0e0ff'; c.stroke();
      R.text(c, '4', x + 76, y - 23, { size: 16 });
    }
  }
  const howto = {
    enter(arg) { this.back = (arg && arg.back) || 'title'; },
    update() {},
    draw(c) {
      const bg = R.background(0);
      c.drawImage(bg.cv, 0, 0, W, H);
      drawHowto(c, () => G.go(this.back));
    },
    drawOverlay(c, onClose) { drawHowto(c, onClose); },
    key(k) { if (k === 'Escape') { G.go(this.back); return true; } return false; }
  };

  // ================================================================ むすび（結末）
  const ending = {
    enter() {
      A.startBgm('end');
      const run = G.run();
      this.run = run ? JSON.parse(JSON.stringify(run)) : null;
      this.i = 0; this.t0 = G.t; this.fw = []; this.done = false;
      if (run) {
        G.save.cleared = (G.save.cleared || 0) + 1;
        G.save.lastClear = { friends: Object.keys(run.P.friends).filter(k => run.P.friends[k] > 0).length, time: run.time, stats: run.stats };
        G.save.run = null;
        G.store();
      }
    },
    update() {
      if (Math.random() < G.dt * 2.2) { this.fw.push({ x: 120 + Math.random() * 1040, y: 60 + Math.random() * 200, t0: G.t, col: ['#ff7a5a', '#ffd34a', '#7ad8ff', '#ff8ad8', '#a8ff7a'][(Math.random() * 5) | 0] }); if (Math.random() < 0.5) A.play('burst', { size: 4 }); }
    },
    draw(c) {
      const bg = R.background(5);
      c.drawImage(bg.cv, 0, 0, W, H);
      R.bgAnim(c, 5, G.t);
      drawFireworks(c, this.fw);
      R.drawYokai(c, 'oni', 640, 300, 210, G.t, { calm: true, happy: true, seed: 2 });
      const run = this.run;
      const fr = run ? Object.keys(run.P.friends).filter(k => run.P.friends[k] > 0 && k !== 'oni') : [];
      // 行列
      const n = fr.length + 1;
      const span = Math.max(1280 + 200, n * 80 + 200);
      for (let k = 0; k < n; k++) {
        const x = ((G.t * 60 + k * 80) % span) - 100;
        const y = 640 + Math.sin(G.t * 5 + k) * 3;
        if (k === 0) R.drawYui(c, 1280 - x, y - 40, 110, G.t, 'happy');
        else R.drawYokai(c, fr[k - 1], 1280 - x + 0, y - 10, D.SPECIES[fr[k - 1]].boss ? 70 : 64, G.t, { seed: k, happy: true });
      }
      if (!this.done) {
        const ln = D.ENDING[Math.min(this.i, D.ENDING.length - 1)];
        const a = clamp((G.t - this.t0) * 2.5, 0, 1);
        c.fillStyle = 'rgba(10,4,16,0.6)'; c.fillRect(0, 470, W, 90);
        c.globalAlpha = a;
        R.text(c, ln, W / 2, 515, { size: 26, font: R.FONT_SOFT, color: '#fff4e6', stroke: 'rgba(0,0,0,0.6)', sw: 4 });
        c.globalAlpha = 1;
        R.text(c, 'クリックで つぎへ', W / 2, 548, { size: 13, color: 'rgba(255,220,200,0.6)', weight: 'normal' });
      } else {
        R.panel(c, 330, 70, 620, 330, { fill: 'rgba(20,10,22,0.9)' });
        R.text(c, 'ぐるり、夜まつり', W / 2, 118, { size: 36, font: R.FONT_TITLE, color: '#ffe2b0' });
        R.text(c, 'おしまい', W / 2, 158, { size: 20, font: R.FONT_TITLE, color: '#f0c8a0' });
        if (run) {
          const total = D.SPECIES_ORDER.length;
          const nb = D.SPECIES_ORDER.filter(sp => G.save.book[sp] > 0).length;
          const mm = Math.floor((run.time || 0) / 60), ss = Math.floor((run.time || 0) % 60);
          const rows = [
            ['この夜に むすんだ 妖', (fr.length + 1) + ' しゅるい'],
            ['ともだち帳', nb + ' / ' + total],
            ['輪を つくった 回数', String(run.stats.rings || 0)],
            ['いちばん 大きな 輪', (run.stats.bigRing || 0) + ' 玉'],
            ['戦いの 時間（めやす）', mm + '分' + String(ss).padStart(2, '0') + '秒']
          ];
          rows.forEach(([a2, b2], k) => {
            R.text(c, a2, 400, 204 + k * 34, { size: 18, align: 'left', color: '#f0e0d0', weight: 'normal' });
            R.text(c, b2, 880, 204 + k * 34, { size: 19, align: 'right', color: '#ffe08a' });
          });
        }
        G.button({ x: 380, y: 420, w: 240, h: 52, label: 'ともだち帳を 見る', size: 18, on: () => G.go('book', { back: 'title' }) });
        G.button({ x: 660, y: 420, w: 240, h: 52, label: 'タイトルへ', style: 'main', def: true, size: 18, on: () => G.go('title') });
      }
    },
    advance() {
      if (this.done || G.t - this.t0 < 0.4) return;
      A.play('ui');
      this.i++; this.t0 = G.t;
      if (this.i >= D.ENDING.length) { this.done = true; A.play('win'); }
    },
    down() { this.advance(); },
    key(k) { if (k === 'Enter' || k === ' ') { if (!this.done) { this.advance(); return true; } } if (k === 'Escape' && !this.done) { this.done = true; return true; } return false; }
  };

  Object.assign(G.scenes, { title, story, map, rest, shop, book, howto, ending });
})(window);
