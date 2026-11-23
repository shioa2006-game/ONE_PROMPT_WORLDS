// がらり、迷宮ひらき — 効果音と BGM（すべて Web Audio で合成。外部素材なし）
(function (root) {
  'use strict';
  const A = { ctx: null, muted: false, vol: 0.7, bgmVol: 0.45, mood: null, timer: null, step: 0 };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = A.ctx = new AC();
    A.master = c.createGain(); A.master.gain.value = A.muted ? 0 : A.vol; A.master.connect(c.destination);
    A.sfx = c.createGain(); A.sfx.gain.value = 0.9; A.sfx.connect(A.master);
    A.bgm = c.createGain(); A.bgm.gain.value = A.bgmVol * 0.3; A.bgm.connect(A.master);
    A.rev = c.createConvolver();
    const len = c.sampleRate * 1.6, buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    A.rev.buffer = buf;
    const rg = c.createGain(); rg.gain.value = 0.28; A.rev.connect(rg); rg.connect(A.master);
    if (A.mood) A.music(A.mood, true);
  };
  A.setMuted = function (m) { A.muted = m; if (A.master) A.master.gain.value = m ? 0 : A.vol; };
  A.setVol = function (v) { A.vol = v; if (A.master && !A.muted) A.master.gain.value = v; };
  A.setBgmVol = function (v) { A.bgmVol = v; if (A.bgm) A.bgm.gain.value = v * 0.3; };
  const now = () => (A.ctx ? A.ctx.currentTime : 0);

  function tone(f, t0, dur, o) {
    if (!A.ctx) return;
    o = o || {};
    const c = A.ctx, os = c.createOscillator(), g = c.createGain();
    os.type = o.type || 'sine';
    os.frequency.setValueAtTime(f, t0);
    if (o.slide) os.frequency.exponentialRampToValueAtTime(Math.max(20, f * o.slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t0 + (o.att || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    os.connect(g); g.connect(o.dest || A.sfx);
    if (o.rev) g.connect(A.rev);
    os.start(t0); os.stop(t0 + dur + 0.03);
  }
  function noise(t0, dur, o) {
    if (!A.ctx) return;
    o = o || {};
    const c = A.ctx, n = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = o.ftype || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1000, t0); f.Q.value = o.q || 1;
    if (o.fslide) f.frequency.exponentialRampToValueAtTime(o.fslide, t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(o.vol || 0.2, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || A.sfx);
    if (o.rev) g.connect(A.rev);
    src.start(t0); src.stop(t0 + dur);
  }
  const SC = [0, 2, 4, 7, 9];
  const note = (i, base) => (base || 330) * Math.pow(2, (SC[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5)) / 12);
  A.note = note;

  A.play = function (name, p) {
    if (!A.ctx || A.muted) return;
    p = p || {};
    const t = now();
    switch (name) {
      case 'click': tone(880, t, 0.06, { type: 'triangle', vol: 0.08 }); break;
      case 'tick': tone(1500 + (p.i || 0) * 70, t, 0.022, { type: 'square', vol: 0.02 }); break;
      case 'stop': {
        // リールが止まる「がちん」。最後のリールは重く
        const i = p.i || 0;
        tone(180 + i * 36, t, p.last ? 0.22 : 0.13, { type: 'triangle', vol: p.last ? 0.24 : 0.17 });
        noise(t, 0.05, { freq: 2200, vol: p.last ? 0.12 : 0.07 });
        if (p.last) tone(90, t, 0.25, { type: 'sine', vol: 0.18, slide: 0.7 });
        break;
      }
      case 'reach': noise(t, 0.7, { freq: 500, fslide: 2600, vol: 0.06, ftype: 'bandpass', q: 3 }); tone(440, t, 0.7, { type: 'sine', vol: 0.04, slide: 1.5 }); break;
      case 'line': {
        // 行がそろった。長いほど高く、和音が厚く
        const n = p.n || 2;
        for (let k = 0; k < n; k++) tone(note(3 + k * 2, 330), t + k * 0.045, 0.32, { type: 'sine', vol: 0.09, rev: true });
        break;
      }
      case 'nudge': tone(560 + (p.dir > 0 ? 90 : 0), t, 0.06, { type: 'triangle', vol: 0.11 }); noise(t, 0.035, { freq: 3200, vol: 0.05 }); break;
      case 'deny': tone(180, t, 0.12, { type: 'square', vol: 0.05 }); break;
      case 'chime': tone(note(p.i || 5, 440), t, 0.16, { type: 'sine', vol: 0.08, rev: true }); break;
      case 'cast': {
        const s = p.el || 'sword';
        if (s === 'fire') { noise(t, 0.4, { freq: 500, fslide: 2400, vol: 0.2, ftype: 'lowpass' }); tone(150, t, 0.32, { type: 'sawtooth', vol: 0.05, slide: 2 }); }
        else if (s === 'ice') { tone(1700, t, 0.32, { type: 'sine', vol: 0.08, slide: 0.6, rev: true }); noise(t, 0.22, { freq: 5000, vol: 0.06 }); }
        else if (s === 'bolt') { noise(t, 0.2, { freq: 3000, vol: 0.22, q: 0.5 }); tone(80, t, 0.28, { type: 'square', vol: 0.07 }); noise(t + 0.08, 0.15, { freq: 1500, vol: 0.12 }); }
        else if (s === 'light') { tone(880, t, 0.55, { type: 'sine', vol: 0.1, rev: true }); tone(1320, t + 0.05, 0.55, { type: 'sine', vol: 0.07, rev: true }); }
        else if (s === 'star') { [0, 2, 4, 7].forEach((k, i) => tone(note(k + 5, 440), t + i * 0.04, 0.4, { type: 'sine', vol: 0.07, rev: true })); }
        else { noise(t, 0.14, { freq: 2400, fslide: 700, vol: 0.16 }); tone(320, t, 0.1, { type: 'triangle', vol: 0.06, slide: 0.5 }); }
        if (p.big) { tone(65, t, 0.6, { type: 'sine', vol: 0.22, slide: 0.6 }); noise(t, 0.6, { freq: 300, fslide: 1400, vol: 0.12, ftype: 'lowpass', rev: true }); }
        break;
      }
      case 'hit': { const i = Math.min(p.i || 0, 14); tone(note(i, 262), t, 0.15, { type: 'triangle', vol: 0.11 }); noise(t, 0.05, { freq: 900 + i * 120, vol: 0.08 }); break; }
      case 'kill': { const i = Math.min(p.i || 0, 18); tone(note(i + 3, 330), t, 0.22, { type: 'sine', vol: 0.13, rev: true }); tone(note(i + 5, 330), t + 0.03, 0.18, { type: 'triangle', vol: 0.06 }); break; }
      case 'block': tone(1100, t, 0.08, { type: 'square', vol: 0.05 }); noise(t, 0.08, { freq: 4000, vol: 0.06 }); break;
      case 'clang': tone(420, t, 0.3, { type: 'square', vol: 0.05, slide: 0.8 }); noise(t, 0.12, { freq: 1800, vol: 0.1 }); break;
      case 'freeze': tone(2100, t, 0.26, { type: 'sine', vol: 0.06, slide: 0.7, rev: true }); break;
      case 'crumble': {
        noise(t, 1.2, { freq: 240, fslide: 70, vol: 0.34, ftype: 'lowpass' });
        tone(52, t, 0.9, { type: 'sine', vol: 0.32, slide: 0.6 });
        for (let i = 0; i < 7; i++) noise(t + 0.1 * i, 0.12, { freq: 500 + i * 110, vol: 0.08 });
        [0, 2, 4, 7, 9].forEach((k, i) => tone(note(k + 5, 294), t + 0.45 + i * 0.08, 0.6, { type: 'triangle', vol: 0.09, rev: true }));
        break;
      }
      case 'reveal': [0, 4, 7, 9, 12].forEach((k, i) => tone(note(k, 392), t + i * 0.07, 0.7, { type: 'sine', vol: 0.06, rev: true })); noise(t, 0.5, { freq: 6000, vol: 0.02, rev: true }); break;
      case 'sketch': for (let i = 0; i < 4; i++) noise(t + i * 0.06, 0.05, { freq: 3500 + i * 300, vol: 0.025 }); break;
      case 'walk': noise(t, 0.05, { freq: 420, vol: 0.06, ftype: 'lowpass' }); break;
      case 'pickup': [0, 2, 4, 7].forEach((k, i) => tone(note(k + 3, 392), t + i * 0.07, 0.4, { type: 'triangle', vol: 0.1, rev: true })); break;
      case 'big': [0, 2, 4, 5, 7, 9].forEach((k, i) => tone(note(k + 3, 330), t + i * 0.06, 0.45, { type: 'sine', vol: 0.1, rev: true })); break;
      case 'ouch': noise(t, 0.2, { freq: 300, vol: 0.25, ftype: 'lowpass' }); tone(140, t, 0.2, { type: 'square', vol: 0.07, slide: 0.5 }); break;
      case 'arrow': noise(t, 0.2, { freq: 3500, fslide: 1200, vol: 0.08 }); break;
      case 'spawn': tone(130, t, 0.2, { type: 'sawtooth', vol: 0.03 }); break;
      case 'step': noise(t, 0.05, { freq: 300, vol: 0.04, ftype: 'lowpass' }); break;
      case 'win': [0, 2, 4, 5, 7, 9, 10].forEach((k, i) => tone(note(k, 392), t + i * 0.09, 0.6, { type: 'triangle', vol: 0.11, rev: true })); break;
      case 'lose': [4, 2, 0, -2].forEach((k, i) => tone(note(k, 262), t + i * 0.18, 0.5, { type: 'sine', vol: 0.1 })); break;
      case 'place': tone(660, t, 0.08, { type: 'triangle', vol: 0.1 }); tone(990, t + 0.05, 0.12, { type: 'sine', vol: 0.07, rev: true }); break;
      case 'forge': noise(t, 0.08, { freq: 4000, vol: 0.12 }); tone(1320, t, 0.4, { type: 'triangle', vol: 0.08, rev: true }); tone(1760, t + 0.1, 0.4, { type: 'sine', vol: 0.06, rev: true }); break;
      case 'page': noise(t, 0.12, { freq: 2500, vol: 0.05 }); break;
      case 'shell': tone(523, t, 0.18, { type: 'sine', vol: 0.06, rev: true }); tone(784, t + 0.08, 0.22, { type: 'sine', vol: 0.05, rev: true }); break;
    }
  };

  // ---------- BGM ----------
  const MOODS = {
    title: { base: 196, bpm: 72, prog: [0, 3, 4, 2], lead: true },
    map1: { base: 220, bpm: 80, prog: [0, 4, 3, 4], lead: true },
    map2: { base: 247, bpm: 76, prog: [0, 3, 1, 4], lead: true },
    map3: { base: 196, bpm: 70, prog: [0, 2, 3, 1], lead: true },
    map4: { base: 175, bpm: 64, prog: [0, 3, 4, 3], lead: true },
    battle: { base: 165, bpm: 104, prog: [0, 0, 3, 4], lead: false, drum: true },
    boss: { base: 147, bpm: 112, prog: [0, 3, 1, 4], lead: false, drum: true },
    ending: { base: 220, bpm: 68, prog: [0, 3, 4, 0], lead: true },
  };
  A.music = function (mood, force) {
    if (A.mood === mood && !force) return;
    A.mood = mood;
    if (A.timer) { clearInterval(A.timer); A.timer = null; }
    if (!A.ctx || !mood) return;
    const m = MOODS[mood];
    const spb = 60 / m.bpm / 2;
    A.step = 0;
    let next = now() + 0.1;
    A.timer = setInterval(() => {
      if (!A.ctx) return;
      while (next < now() + 0.25) {
        const i = A.step;
        const bar = Math.floor(i / 8) % m.prog.length;
        const rt = m.prog[bar];
        if (i % 8 === 0) [0, 2, 4].forEach(k => tone(note(rt + k, m.base / 2), next, spb * 7.5, { type: 'sine', vol: 0.05, dest: A.bgm, att: 0.2 }));
        if (i % 2 === 0) tone(note(rt + [0, 2, 4, 2][(i / 2) % 4], m.base), next, spb * 1.6, { type: 'triangle', vol: 0.032, dest: A.bgm });
        if (m.lead && i % 8 === 4) tone(note(rt + 7 + (bar % 2) * 2, m.base), next, spb * 3, { type: 'sine', vol: 0.028, dest: A.bgm });
        if (m.drum) {
          if (i % 4 === 0) tone(60, next, 0.18, { type: 'sine', vol: 0.09, dest: A.bgm, slide: 0.5 });
          if (i % 4 === 2) noise(next, 0.05, { freq: 6000, vol: 0.02, dest: A.bgm });
        }
        A.step++;
        next += spb;
      }
    }, 90);
  };

  root.GA = A;
})(typeof window !== 'undefined' ? window : this);
