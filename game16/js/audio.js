// 呪いほどき — 効果音と BGM（すべて Web Audio で合成。外部素材なし）
(function (root) {
  'use strict';
  const A = { ctx: null, master: null, sfx: null, bgm: null, muted: false, vol: 0.8, bgmVol: 0.5, started: false, bgmOn: false, bgmTimer: null, mood: 'village' };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    A.ctx = new AC();
    A.master = A.ctx.createGain(); A.master.gain.value = A.muted ? 0 : A.vol; A.master.connect(A.ctx.destination);
    A.sfx = A.ctx.createGain(); A.sfx.gain.value = 0.9; A.sfx.connect(A.master);
    A.bgm = A.ctx.createGain(); A.bgm.gain.value = A.bgmVol * 0.35; A.bgm.connect(A.master);
    // 残響（簡易）
    A.rev = A.ctx.createConvolver();
    const len = A.ctx.sampleRate * 1.6, buf = A.ctx.createBuffer(2, len, A.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    A.rev.buffer = buf;
    A.revGain = A.ctx.createGain(); A.revGain.gain.value = 0.22; A.rev.connect(A.revGain); A.revGain.connect(A.master);
    A.started = true;
  };
  A.setMuted = function (m) { A.muted = m; if (A.master) A.master.gain.value = m ? 0 : A.vol; };
  A.setVol = function (v) { A.vol = v; if (A.master && !A.muted) A.master.gain.value = v; };
  A.setBgmVol = function (v) { A.bgmVol = v; if (A.bgm) A.bgm.gain.value = v * 0.35; };

  function tone(freq, t0, dur, opt) {
    if (!A.ctx) return;
    opt = opt || {};
    const c = A.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opt.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opt.slide), t0 + dur);
    const v = (opt.vol || 0.2);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (opt.att || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(opt.dest || A.sfx);
    if (opt.rev) g.connect(A.rev);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, opt) {
    if (!A.ctx) return;
    opt = opt || {};
    const c = A.ctx, len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = opt.ftype || 'bandpass'; f.frequency.value = opt.freq || 1200; f.Q.value = opt.q || 1;
    if (opt.fslide) f.frequency.exponentialRampToValueAtTime(opt.fslide, t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(opt.vol || 0.2, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(A.sfx);
    if (opt.rev) g.connect(A.rev);
    src.start(t0); src.stop(t0 + dur);
  }
  const now = () => (A.ctx ? A.ctx.currentTime : 0);
  // 五音音階（明るい・やさしい）
  const SCALE = [0, 2, 4, 7, 9];
  const note = (i, base) => (base || 392) * Math.pow(2, (SCALE[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5)) / 12);

  A.play = function (name, p) {
    if (!A.ctx || A.muted) return;
    const t = now();
    p = p || {};
    switch (name) {
      case 'click': tone(880, t, 0.06, { type: 'triangle', vol: 0.08 }); break;
      case 'hover': tone(1320, t, 0.03, { type: 'sine', vol: 0.03 }); break;
      case 'deny': tone(220, t, 0.12, { type: 'square', vol: 0.05 }); tone(180, t + 0.07, 0.12, { type: 'square', vol: 0.05 }); break;
      case 'spin': noise(t, 0.35, { freq: 2200, q: 0.6, vol: 0.05, fslide: 900 }); break;
      case 'tick': tone(1600 + (p.i || 0) * 60, t, 0.025, { type: 'square', vol: 0.025 }); break;
      case 'stop': tone(300 + (p.i || 0) * 40, t, 0.09, { type: 'triangle', vol: 0.16 }); noise(t, 0.05, { freq: 700, vol: 0.08 }); break;
      case 'shift': tone(660 + (p.d || 0) * 90, t, 0.07, { type: 'triangle', vol: 0.1 }); noise(t, 0.04, { freq: 3000, vol: 0.03 }); break;
      case 'link': { // つながりが増えた（大きさで音が上がる）
        const n = Math.min(14, p.n || 2);
        tone(note(n + 3, 330), t, 0.25, { type: 'sine', vol: 0.09, rev: true });
        tone(note(n + 5, 330), t + 0.04, 0.22, { type: 'sine', vol: 0.06, rev: true });
        break;
      }
      case 'hold': tone(520, t, 0.08, { type: 'square', vol: 0.05 }); tone(780, t + 0.05, 0.08, { type: 'square', vol: 0.04 }); break;
      case 'cast': noise(t, 0.5, { freq: 500, q: 0.7, vol: 0.12, fslide: 3000, rev: true }); tone(196, t, 0.5, { type: 'sawtooth', vol: 0.04, slide: 2 }); break;
      case 'pillar': { // つながりが光る
        const n = p.n || 1, el = p.el || 'light';
        const base = el === 'ice' ? 523 : el === 'bolt' ? 294 : 392;
        const k = Math.min(10, n);
        for (let i = 0; i < Math.min(4, 1 + Math.floor(k / 3)); i++) tone(note(k + i * 2, base), t + i * 0.035, 0.5 + k * 0.03, { type: el === 'bolt' ? 'sawtooth' : 'sine', vol: (el === 'bolt' ? 0.04 : 0.09) + k * 0.006, rev: true });
        if (el === 'ice') noise(t, 0.3, { freq: 6000, q: 2, vol: 0.06 });
        if (el === 'bolt') noise(t, 0.25, { freq: 1800, q: 0.5, vol: 0.12 });
        break;
      }
      case 'zap': noise(t, 0.12, { freq: 2500 + Math.random() * 1500, q: 1.5, vol: 0.08 }); tone(900 + Math.random() * 600, t, 0.08, { type: 'square', vol: 0.03, slide: 0.4 }); break;
      case 'hit': tone(240, t, 0.1, { type: 'triangle', vol: 0.12, slide: 0.6 }); break;
      case 'block': tone(1400, t, 0.12, { type: 'square', vol: 0.05 }); tone(1100, t + 0.02, 0.15, { type: 'triangle', vol: 0.06 }); break;
      case 'freeze': noise(t, 0.35, { freq: 7000, q: 3, vol: 0.07 }); tone(1760, t, 0.3, { type: 'sine', vol: 0.05 }); break;
      case 'free': { // 呪いがほどけた（i が大きいほど高く）
        const i = p.i || 0;
        tone(note(8 + i, 392), t, 0.5, { type: 'sine', vol: 0.12, rev: true });
        tone(note(10 + i, 392), t + 0.06, 0.45, { type: 'triangle', vol: 0.06, rev: true });
        noise(t, 0.25, { freq: 5000, q: 1, vol: 0.04, rev: true });
        break;
      }
      case 'boss': {
        [0, 2, 4, 5, 7, 9].forEach((k, i) => tone(note(5 + k, 262), t + i * 0.08, 1.2, { type: 'sine', vol: 0.12, rev: true }));
        tone(131, t, 1.6, { type: 'triangle', vol: 0.14 });
        break;
      }
      case 'big': { // 一度にたくさん救った
        [0, 1, 2, 3, 4, 5, 6].forEach((k, i) => tone(note(6 + k, 392), t + i * 0.05, 0.9, { type: 'sine', vol: 0.09, rev: true }));
        break;
      }
      case 'step': noise(t, 0.08, { freq: 300, q: 0.8, vol: 0.06 }); break;
      case 'ward': tone(120, t, 0.35, { type: 'sawtooth', vol: 0.12, slide: 0.5 }); noise(t, 0.3, { freq: 900, vol: 0.15 }); break;
      case 'appear': tone(110, t, 0.4, { type: 'sine', vol: 0.08, slide: 1.5 }); break;
      case 'coin': tone(1568, t, 0.08, { type: 'square', vol: 0.04 }); tone(2093, t + 0.06, 0.12, { type: 'square', vol: 0.04 }); break;
      case 'place': tone(523, t, 0.1, { type: 'triangle', vol: 0.12 }); tone(784, t + 0.05, 0.14, { type: 'sine', vol: 0.08, rev: true }); break;
      case 'take': tone(392, t, 0.08, { type: 'triangle', vol: 0.1 }); break;
      case 'forge': noise(t, 0.12, { freq: 3000, q: 4, vol: 0.12 }); tone(1046, t, 0.4, { type: 'triangle', vol: 0.08, rev: true }); noise(t + 0.18, 0.1, { freq: 3200, q: 4, vol: 0.1 }); break;
      case 'win': [0, 2, 4, 7, 9, 12].forEach((k, i) => tone(note(5 + i, 392), t + i * 0.11, 0.8, { type: 'triangle', vol: 0.1, rev: true })); break;
      case 'lose': [4, 2, 0, -3].forEach((k, i) => tone(note(5 + k, 262), t + i * 0.2, 0.7, { type: 'sine', vol: 0.1, rev: true })); break;
      case 'page': noise(t, 0.12, { freq: 2500, q: 0.5, vol: 0.04 }); break;
      case 'unlock': [0, 4, 7, 12].forEach((k, i) => tone(523 * Math.pow(2, k / 12), t + i * 0.09, 0.9, { type: 'sine', vol: 0.09, rev: true })); break;
    }
  };

  // ---------- BGM：短い五音のフレーズを、地方ごとの音色でゆっくり回す ----------
  const MOODS = {
    title: { base: 262, tempo: 0.42, pad: [0, 7], mel: [4, 3, 2, 3, 4, 6, 5, 3], type: 'sine' },
    village: { base: 294, tempo: 0.36, pad: [0, 7], mel: [0, 2, 4, 2, 5, 4, 2, 1], type: 'triangle' },
    forest: { base: 220, tempo: 0.4, pad: [0, 3, 7], mel: [0, 1, 3, 1, 4, 3, 1, 0], type: 'sine' },
    mine: { base: 196, tempo: 0.38, pad: [0, 7], mel: [0, 0, 2, 1, 3, 2, 1, 0], type: 'triangle' },
    lake: { base: 247, tempo: 0.44, pad: [0, 4, 7], mel: [2, 4, 5, 4, 7, 5, 4, 2], type: 'sine' },
    castle: { base: 262, tempo: 0.34, pad: [0, 7], mel: [0, 2, 3, 4, 3, 2, 4, 5], type: 'triangle' },
    tower: { base: 185, tempo: 0.36, pad: [0, 3, 6], mel: [0, 1, 0, 3, 2, 1, 4, 3], type: 'sine' },
    workshop: { base: 330, tempo: 0.4, pad: [0, 4, 7], mel: [2, 4, 2, 1, 2, 4, 5, 4], type: 'triangle' },
    ending: { base: 294, tempo: 0.46, pad: [0, 4, 7], mel: [4, 5, 7, 5, 4, 2, 4, 5], type: 'sine' },
  };
  A.music = function (mood) {
    A.mood = mood;
    if (!A.ctx) return;
    if (A.bgmTimer) return;
    let step = 0;
    const loop = () => {
      const m = MOODS[A.mood] || MOODS.village;
      if (!A.muted && A.ctx.state === 'running') {
        const t = A.ctx.currentTime + 0.05;
        const bar = step % 8;
        if (bar % 4 === 0) for (const k of m.pad) tone(m.base / 2 * Math.pow(2, k / 12), t, m.tempo * 4.2, { type: 'sine', vol: 0.05, att: 0.4, dest: A.bgm });
        const deg = m.mel[(step + Math.floor(step / 16) * 3) % m.mel.length];
        if (step % 2 === 0 || Math.random() < 0.35) tone(note(deg + 5, m.base), t, m.tempo * 1.8, { type: m.type, vol: 0.05, att: 0.02, dest: A.bgm });
      }
      step++;
      A.bgmTimer = setTimeout(loop, (MOODS[A.mood] || MOODS.village).tempo * 1000);
    };
    loop();
  };

  root.RA = A;
})(this);
