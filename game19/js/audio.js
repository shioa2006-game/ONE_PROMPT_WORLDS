// せーの、星見の露台へ — 効果音と BGM（Web Audio で合成。外部素材なし）
(function (root) {
  'use strict';
  const A = { on: true, vol: 0.7, ctx: null, master: null, sfxBus: null, bgmBus: null, cur: null, timer: null };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    A.ctx = new AC();
    A.master = A.ctx.createGain(); A.master.gain.value = A.on ? A.vol : 0; A.master.connect(A.ctx.destination);
    A.sfxBus = A.ctx.createGain(); A.sfxBus.gain.value = 0.8; A.sfxBus.connect(A.master);
    A.bgmBus = A.ctx.createGain(); A.bgmBus.gain.value = 0.32; A.bgmBus.connect(A.master);
    // 洞窟のこだま
    A.verb = A.ctx.createConvolver();
    const len = A.ctx.sampleRate * 1.6, buf = A.ctx.createBuffer(2, len, A.ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    A.verb.buffer = buf;
    A.verbGain = A.ctx.createGain(); A.verbGain.gain.value = 0.22;
    A.verb.connect(A.verbGain); A.verbGain.connect(A.master);
    A.noiseBuf = A.ctx.createBuffer(1, A.ctx.sampleRate, A.ctx.sampleRate);
    const nd = A.noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    if (A.want) A.bgm(A.want);
  };
  A.setOn = function (v) { A.on = v; if (A.master) A.master.gain.setTargetAtTime(v ? A.vol : 0, A.ctx.currentTime, 0.05); };
  A.setVol = function (v) { A.vol = v; if (A.master && A.on) A.master.gain.setTargetAtTime(v, A.ctx.currentTime, 0.05); };

  function env(g, t, a, peak, d, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, end || 0.0001), t + a + d);
  }
  function tone(type, f0, f1, t, a, d, peak, bus, verb, detune) {
    const c = A.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    if (detune) o.detune.value = detune;
    env(g, t, a, peak, d);
    o.connect(g); g.connect(bus || A.sfxBus);
    if (verb) g.connect(A.verb);
    o.start(t); o.stop(t + a + d + 0.05);
  }
  function noise(t, d, peak, fType, f0, f1, q, verb) {
    const c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = A.noiseBuf;
    f.type = fType || 'lowpass'; f.frequency.setValueAtTime(f0 || 800, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + d);
    f.Q.value = q || 1;
    env(g, t, 0.005, peak, d);
    s.connect(f); f.connect(g); g.connect(A.sfxBus);
    if (verb) g.connect(A.verb);
    s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  }
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

  A.sfx = function (name, o) {
    if (!A.ctx || !A.on) return;
    o = o || {};
    const t = A.ctx.currentTime + 0.005;
    switch (name) {
      case 'step': noise(t, 0.05, 0.12, 'bandpass', 900 + Math.random() * 300, 500, 2); break;
      case 'select': tone('triangle', o.f || 660, (o.f || 660) * 1.5, t, 0.005, 0.08, 0.18); break;
      case 'click': tone('square', 880, 880, t, 0.002, 0.03, 0.06); break;
      case 'deny': tone('square', 180, 150, t, 0.005, 0.12, 0.1); tone('square', 140, 120, t + 0.06, 0.005, 0.1, 0.08); break;
      case 'push': noise(t, 0.28, 0.35, 'lowpass', 500, 160, 1); tone('sawtooth', 70, 50, t, 0.01, 0.25, 0.12); break;
      case 'grunt': tone('sawtooth', 160, 110, t, 0.01, 0.12, 0.12); noise(t, 0.08, 0.1, 'bandpass', 600, 300, 1); break;
      case 'thud': {
        const big = o.big || 1;
        tone('sine', 120, 40, t, 0.005, 0.3 + big * 0.1, 0.5 * Math.min(1.6, big), A.sfxBus, true);
        noise(t, 0.25 + big * 0.05, 0.35, 'lowpass', 900, 120, 1, true);
        break;
      }
      case 'crash': tone('sine', 90, 30, t, 0.005, 0.7, 0.7, A.sfxBus, true); noise(t, 0.8, 0.5, 'lowpass', 1500, 100, 1, true); noise(t + 0.12, 0.4, 0.3, 'bandpass', 2400, 600, 1, true); break;
      case 'splash': noise(t, 0.4, 0.35, 'bandpass', 1800, 400, 0.8, true); tone('sine', 300, 80, t, 0.01, 0.2, 0.12); break;
      case 'scrape': noise(t, o.d || 0.3, 0.2, 'bandpass', 1400, 700, 3); break;
      case 'bonk': tone('square', 140, 90, t, 0.003, 0.09, 0.16); noise(t, 0.06, 0.2, 'lowpass', 800, 300, 1); break;
      case 'draw': tone('triangle', 300, 420, t, 0.05, 0.12, 0.08); break;
      case 'arrow': noise(t, 0.18, 0.18, 'highpass', 2500, 5000, 1); tone('sine', 900, 500, t, 0.005, 0.15, 0.05); break;
      case 'thunk': tone('square', 220, 120, t, 0.002, 0.06, 0.16); noise(t, 0.05, 0.25, 'bandpass', 1200, 600, 2); break;
      case 'rope': noise(t, 0.3, 0.16, 'bandpass', 900, 2600, 2); tone('sine', 400, 900, t, 0.01, 0.25, 0.06); break;
      case 'zip': noise(t, 0.35, 0.18, 'bandpass', 2400, 900, 4); break;
      case 'charge': tone('sine', 880, 1320, t, 0.02, 0.18, 0.08, A.sfxBus, true); tone('sine', 1320, 1760, t + 0.05, 0.02, 0.15, 0.05, A.sfxBus, true); break;
      case 'frost': {
        const ns = [84, 88, 91, 96, 100];
        ns.forEach((n, k) => tone('sine', NOTE(n), NOTE(n), t + k * 0.035, 0.003, 0.35, 0.09, A.sfxBus, true));
        noise(t, 0.35, 0.12, 'highpass', 4000, 7000, 1, true);
        break;
      }
      case 'crack': noise(t, 0.12, 0.25, 'highpass', 2000, 5000, 1); tone('square', 1800, 900, t, 0.002, 0.04, 0.05); break;
      case 'hit': tone('square', 520, 200, t, 0.003, 0.1, 0.16); noise(t, 0.08, 0.2, 'bandpass', 1800, 700, 2); break;
      case 'hurt': tone('sawtooth', 300, 120, t, 0.003, 0.18, 0.18); noise(t, 0.12, 0.2, 'lowpass', 1200, 300, 1); break;
      case 'ko': tone('square', 600, 90, t, 0.005, 0.35, 0.16); noise(t + 0.05, 0.3, 0.18, 'bandpass', 900, 200, 1); break;
      case 'fallaway': tone('sine', 700, 120, t, 0.01, 0.7, 0.14, A.sfxBus, true); break;
      case 'bloom': {
        const base = o.base || 72;
        const ns = [0, 4, 7, 12, 16, 19];
        const n = Math.min(ns.length, 3 + (o.size || 0));
        for (let k = 0; k < n; k++) tone('triangle', NOTE(base + ns[k]), NOTE(base + ns[k]), t + k * 0.07, 0.005, 0.5, 0.1, A.sfxBus, true);
        break;
      }
      case 'chest': [76, 79, 83, 88].forEach((n, k) => tone('square', NOTE(n), NOTE(n), t + k * 0.06, 0.003, 0.18, 0.07)); break;
      case 'page': [64, 68, 71, 76].forEach((n, k) => tone('sine', NOTE(n), NOTE(n), t + k * 0.09, 0.02, 0.9, 0.09, A.sfxBus, true)); break;
      case 'combat': tone('sawtooth', 220, 220, t, 0.005, 0.12, 0.12); tone('sawtooth', 294, 294, t + 0.12, 0.005, 0.2, 0.12); noise(t, 0.15, 0.2, 'lowpass', 600, 200, 1); break;
      case 'turn': tone('triangle', 523, 523, t, 0.005, 0.1, 0.08); tone('triangle', 784, 784, t + 0.07, 0.005, 0.15, 0.08); break;
      case 'eturn': tone('triangle', 330, 330, t, 0.005, 0.1, 0.08); tone('triangle', 247, 247, t + 0.07, 0.005, 0.15, 0.08); break;
      case 'win': [67, 71, 74, 79, 83].forEach((n, k) => tone('square', NOTE(n), NOTE(n), t + k * 0.08, 0.005, 0.3, 0.07, A.sfxBus, true)); break;
      case 'lose': [62, 58, 55, 50].forEach((n, k) => tone('triangle', NOTE(n), NOTE(n), t + k * 0.16, 0.01, 0.4, 0.1)); break;
      case 'door': noise(t, 0.6, 0.25, 'lowpass', 400, 120, 1, true); tone('sawtooth', 60, 50, t, 0.05, 0.5, 0.08); break;
      case 'chain': for (let k = 0; k < 6; k++) noise(t + k * 0.07, 0.05, 0.2, 'bandpass', 2500 + k * 100, 1800, 5); noise(t + 0.45, 0.3, 0.35, 'lowpass', 700, 150, 1, true); break;
      case 'ding': tone('sine', 1568, 1568, t, 0.002, 0.6, 0.12, A.sfxBus, true); tone('sine', 2093, 2093, t + 0.02, 0.002, 0.4, 0.06, A.sfxBus, true); break;
      case 'light': [55, 62, 67, 71, 74, 79, 83, 86].forEach((n, k) => tone('triangle', NOTE(n), NOTE(n), t + k * 0.12, 0.02, 2.2, 0.08, A.sfxBus, true)); break;
      case 'say': tone('sine', o.f || 700, (o.f || 700) * 1.05, t, 0.003, 0.05, 0.04); break;
      case 'rumble': noise(t, 1.2, 0.3, 'lowpass', 200, 60, 1, true); break;
    }
  };

  // ---------- BGM ----------
  const SONGS = {
    explore: { bpm: 72, root: 50, scale: [0, 3, 5, 7, 10], pad: [[0, 7, 15], [-2, 5, 14], [-4, 3, 12], [-5, 2, 10]], lead: true, drum: false },
    combat: { bpm: 104, root: 45, scale: [0, 3, 5, 7, 8], pad: [[0, 7, 12], [-4, 3, 8], [-2, 5, 10], [-5, 2, 7]], lead: true, drum: true },
    finale: { bpm: 84, root: 47, scale: [0, 2, 3, 7, 9], pad: [[0, 7, 15], [-4, 3, 15], [-7, 5, 12], [-5, 2, 14]], lead: true, drum: true },
    ending: { bpm: 66, root: 52, scale: [0, 2, 4, 7, 9], pad: [[0, 7, 16], [-3, 4, 12], [-7, 5, 12], [-5, 2, 11]], lead: true, drum: false },
    title: { bpm: 60, root: 48, scale: [0, 2, 3, 7, 10], pad: [[0, 7, 15], [-4, 3, 12], [-2, 5, 14], [-5, 2, 10]], lead: true, drum: false },
  };
  A.bgm = function (name) {
    A.want = name;
    if (!A.ctx) return;
    if (A.cur === name) return;
    A.cur = name;
    if (A.timer) clearInterval(A.timer);
    if (!name || !SONGS[name]) return;
    const song = SONGS[name];
    const beat = 60 / song.bpm;
    let next = A.ctx.currentTime + 0.1, step = 0;
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    A.timer = setInterval(() => {
      if (!A.ctx) return;
      while (next < A.ctx.currentTime + 0.3) {
        const bar = Math.floor(step / 8) % song.pad.length;
        const s8 = step % 8;
        if (s8 === 0) {
          for (const iv of song.pad[bar]) {
            tone('sine', NOTE(song.root + iv), NOTE(song.root + iv), next, 0.6, beat * 4.2, 0.05, A.bgmBus, true, (rnd() - 0.5) * 8);
            tone('triangle', NOTE(song.root + iv + 12), NOTE(song.root + iv + 12), next, 0.8, beat * 3.8, 0.018, A.bgmBus, true);
          }
          tone('sine', NOTE(song.root + song.pad[bar][0] - 12), NOTE(song.root + song.pad[bar][0] - 12), next, 0.05, beat * 3.6, 0.09, A.bgmBus);
        }
        if (song.lead && (s8 % 2 === 1 || rnd() < 0.25) && rnd() < (name === 'combat' ? 0.7 : 0.45)) {
          const deg = song.scale[(rnd() * song.scale.length) | 0];
          const oct = rnd() < 0.3 ? 24 : 12;
          tone('triangle', NOTE(song.root + deg + oct + song.pad[bar][0] * 0), NOTE(song.root + deg + oct), next, 0.005, beat * 1.1, 0.035, A.bgmBus, true);
        }
        if (song.drum) {
          if (s8 % 4 === 0) { const c = A.ctx; const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(110, next); o.frequency.exponentialRampToValueAtTime(40, next + 0.15); env(g, next, 0.003, 0.14, 0.16); o.connect(g); g.connect(A.bgmBus); o.start(next); o.stop(next + 0.2); }
          if (s8 % 4 === 2 && name === 'combat') { const c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = A.noiseBuf; f.type = 'highpass'; f.frequency.value = 5000; env(g, next, 0.002, 0.05, 0.05); s.connect(f); f.connect(g); g.connect(A.bgmBus); s.start(next); s.stop(next + 0.08); }
        }
        // 水滴
        if (!song.drum && rnd() < 0.06) tone('sine', NOTE(88 + ((rnd() * 8) | 0)), NOTE(80), next + beat * 0.25, 0.002, 0.12, 0.03, A.bgmBus, true);
        next += beat / 2; step++;
      }
    }, 90);
  };

  root.A19 = A;
})(typeof window !== 'undefined' ? window : globalThis);
