// STAIRWARD — 効果音と BGM（Web Audio で合成。外部素材なし）
(function (root) {
  'use strict';
  const A = { on: true, vol: 0.7, ctx: null, master: null, bgm: null, bgmName: null };
  function ctx() {
    if (A.ctx) return A.ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    A.ctx = new AC();
    A.master = A.ctx.createGain();
    A.master.gain.value = A.on ? A.vol : 0;
    A.master.connect(A.ctx.destination);
    A.sfxBus = A.ctx.createGain(); A.sfxBus.gain.value = 0.9; A.sfxBus.connect(A.master);
    A.musBus = A.ctx.createGain(); A.musBus.gain.value = 0.32; A.musBus.connect(A.master);
    return A.ctx;
  }
  A.unlock = function () { const c = ctx(); if (c && c.state === 'suspended') c.resume(); };
  A.setOn = function (v) { A.on = v; if (A.master) A.master.gain.value = v ? A.vol : 0; };
  A.setVol = function (v) { A.vol = v; if (A.master && A.on) A.master.gain.value = v; };

  let noiseBuf = null;
  function noise() {
    const c = ctx();
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 1.0, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let s = 1;
      for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    }
    return noiseBuf;
  }
  function tone(type, f0, f1, dur, vol, when, bus) {
    const c = ctx(); if (!c) return;
    const t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || A.sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function burst(dur, vol, fType, f0, f1, when, q) {
    const c = ctx(); if (!c) return;
    const t = c.currentTime + (when || 0);
    const s = c.createBufferSource(); s.buffer = noise();
    const f = c.createBiquadFilter(); f.type = fType || 'lowpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  const last = {};
  function gate(name, gap) {
    const c = ctx(); if (!c || !A.on) return false;
    const now = c.currentTime;
    if (last[name] && now - last[name] < gap) return false;
    last[name] = now; return true;
  }
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

  A.play = function (name, arg) {
    if (!A.on) return;
    const c = ctx(); if (!c) return;
    switch (name) {
      case 'click': if (gate(name, 0.03)) { tone('triangle', 660, 520, 0.06, 0.12); } break;
      case 'place': if (gate(name, 0.05)) { burst(0.08, 0.35, 'bandpass', 900, 400, 0, 2); tone('sine', 180, 120, 0.12, 0.25); } break;
      case 'lift': if (gate(name, 0.05)) { tone('triangle', 520, 780, 0.07, 0.1); } break;
      case 'horn': tone('sawtooth', NOTE(50), NOTE(50), 0.9, 0.09); tone('sawtooth', NOTE(57), NOTE(57), 0.9, 0.06, 0.05); tone('sine', NOTE(38), NOTE(38), 1.0, 0.18); break;
      case 'block': if (gate(name, 0.06)) { tone('square', 1400, 900, 0.05, 0.06); tone('triangle', 2400, 1800, 0.12, 0.08); burst(0.06, 0.2, 'highpass', 3000, 2000); } break;
      case 'slash': if (gate(name, 0.05)) { burst(0.07, 0.12, 'bandpass', 2400, 1200, 0, 3); } break;
      case 'thrust': if (gate(name, 0.05)) { burst(0.09, 0.16, 'bandpass', 1600, 700, 0, 4); tone('triangle', 300, 200, 0.08, 0.08); } break;
      case 'bow': if (gate(name, 0.04)) { tone('triangle', 900, 300, 0.09, 0.06); burst(0.05, 0.06, 'highpass', 4000, 3000); } break;
      case 'cast': if (gate(name, 0.1)) { tone('sine', 300, 900, 0.5, 0.06); tone('triangle', 450, 1350, 0.5, 0.03); } break;
      case 'boom': {
        const n = Math.min(6, arg || 1);
        burst(0.45 + n * 0.05, 0.4 + n * 0.05, 'lowpass', 1800, 120);
        tone('sine', 120, 45, 0.4, 0.3);
        if (n >= 2) {
          const ch = [0, 4, 7, 12, 16, 19];
          for (let i = 0; i < Math.min(n, 6); i++) tone('triangle', NOTE(67 + ch[i]), null, 0.5, 0.05, 0.04 * i);
        }
        break;
      }
      case 'kill': if (gate(name, 0.04)) { tone('square', 300, 90, 0.12, 0.04); } break;
      case 'hurt': if (gate(name, 0.08)) { tone('square', 220, 140, 0.08, 0.05); } break;
      case 'heal': if (gate(name, 0.12)) { tone('sine', NOTE(79), null, 0.35, 0.05); tone('sine', NOTE(83), null, 0.35, 0.04, 0.06); tone('sine', NOTE(86), null, 0.4, 0.04, 0.12); } break;
      case 'barrier': tone('sine', NOTE(72), NOTE(84), 0.5, 0.07); break;
      case 'assist': if (gate(name, 0.15)) { tone('triangle', NOTE(84), null, 0.18, 0.05); tone('triangle', NOTE(91), null, 0.22, 0.04, 0.06); } break;
      case 'alert': if (gate(name, 0.2)) { tone('triangle', NOTE(76), NOTE(81), 0.1, 0.05); } break;
      case 'gatehit': if (gate(name, 0.15)) { burst(0.12, 0.25, 'lowpass', 500, 150); tone('sine', 90, 60, 0.15, 0.15); } break;
      case 'gatebreak': burst(0.8, 0.6, 'lowpass', 1200, 100); tone('sawtooth', 110, 40, 0.6, 0.1); break;
      case 'leak': tone('sine', NOTE(45), NOTE(44), 1.0, 0.25); tone('triangle', NOTE(64), NOTE(52), 0.6, 0.06); break;
      case 'down': tone('sawtooth', NOTE(57), NOTE(45), 0.7, 0.08); tone('sine', NOTE(45), NOTE(33), 0.8, 0.15); break;
      case 'combo': {
        const base = 72;
        [0, 4, 7, 12].forEach((d, i) => tone('triangle', NOTE(base + d), null, 0.35, 0.07, i * 0.07));
        tone('sine', NOTE(base - 12), null, 0.6, 0.1);
        break;
      }
      case 'newcombo': {
        [0, 4, 7, 11, 14, 19].forEach((d, i) => tone('triangle', NOTE(74 + d), null, 0.45, 0.07, i * 0.08));
        break;
      }
      case 'win': {
        const seq = [67, 71, 74, 79, 78, 79];
        seq.forEach((n, i) => tone('triangle', NOTE(n), null, 0.32, 0.08, i * 0.13));
        tone('sine', NOTE(43), null, 1.2, 0.15);
        break;
      }
      case 'lose': [64, 62, 59, 55].forEach((n, i) => tone('triangle', NOTE(n), null, 0.4, 0.07, i * 0.2)); break;
      case 'page': if (gate(name, 0.05)) { burst(0.05, 0.08, 'highpass', 2500, 1800); } break;
      case 'dawn': [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone('sine', NOTE(n), null, 1.2, 0.05, i * 0.18)); break;
    }
  };

  // ---- BGM（短い繰り返し。作戦の間は静か、迎撃中は太鼓） ----
  const SONGS = {
    plan: { bpm: 72, bars: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], drum: false },
    fight: { bpm: 112, bars: [[45, 52, 57], [41, 48, 53], [43, 50, 55], [40, 47, 52]], drum: true },
    dawn: { bpm: 80, bars: [[60, 64, 67], [65, 69, 72], [62, 65, 69], [67, 71, 74]], drum: false },
  };
  A.music = function (name) {
    if (A.bgmName === name) return;
    A.bgmName = name;
    if (A.bgm) { clearInterval(A.bgm.iv); A.bgm = null; }
    if (!name) return;
    const c = ctx(); if (!c) return;
    const song = SONGS[name];
    const beat = 60 / song.bpm;
    let next = c.currentTime + 0.1, step = 0;
    const iv = setInterval(() => {
      if (!A.on) { next = c.currentTime + 0.1; return; }
      while (next < c.currentTime + 0.4) {
        const bar = song.bars[Math.floor(step / 8) % song.bars.length];
        const s = step % 8;
        const when = next - c.currentTime;
        if (s === 0) tone('sine', NOTE(bar[0] - 12), null, beat * 3.6, 0.16, when, A.musBus);
        const arp = [0, 1, 2, 1, 2, 0, 1, 2];
        if (name !== 'fight' || s % 2 === 0) tone('triangle', NOTE(bar[arp[s]] + (name === 'fight' ? 0 : 12)), null, beat * 0.9, name === 'fight' ? 0.05 : 0.045, when, A.musBus);
        if (song.drum) {
          if (s % 4 === 0) { const t2 = c.currentTime + when; const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(110, t2); o.frequency.exponentialRampToValueAtTime(45, t2 + 0.18); g.gain.setValueAtTime(0.25, t2); g.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.2); o.connect(g); g.connect(A.musBus); o.start(t2); o.stop(t2 + 0.22); }
          if (s % 4 === 2) { const t2 = c.currentTime + when; const sN = c.createBufferSource(); sN.buffer = noise(); const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000; const g = c.createGain(); g.gain.setValueAtTime(0.06, t2); g.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.06); sN.connect(f); f.connect(g); g.connect(A.musBus); sN.start(t2, Math.random() * 0.5); sN.stop(t2 + 0.08); }
        }
        next += beat / 2;
        step++;
      }
    }, 100);
    A.bgm = { iv };
  };
  root.K20A = A;
})(window);
