/*
 * ひゅるり、凧びより ― 音（Web Audio で その場で つくる）
 *   風の音は ずっと鳴り、つむじの はやさと 大きさで 音色が かわる。
 *   まきこむ音は 連続するほど 音階を のぼる（陽音階）。
 */
(function (root) {
  'use strict';
  const TJ = root.TJ = root.TJ || {};
  const YO = [0, 2, 5, 7, 9];          // 陽音階
  const MIYAKO = [0, 1, 5, 7, 8];      // 都節（ゆきぐも）
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const deg = (scale, d, base) => base + scale[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);

  class Audio {
    constructor() {
      this.ctx = null;
      this.opt = { master: 0.8, bgm: 0.5, se: 0.8, mute: false };
      this.bgmOn = false;
      this.bgmMode = 1;
      this.nextNote = 0;
      this.step = 0;
      this.lastPop = 0;
    }
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.connect(ctx.destination);
      this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
      this.comp.connect(this.master);
      this.se = ctx.createGain(); this.se.connect(this.comp);
      this.bgm = ctx.createGain(); this.bgm.connect(this.comp);
      // ノイズ
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      // 風
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 600; this.windF.Q.value = 0.9;
      this.windG = ctx.createGain(); this.windG.gain.value = 0;
      src.connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.se);
      const src2 = ctx.createBufferSource(); src2.buffer = buf; src2.loop = true; src2.playbackRate.value = 0.7;
      this.windL = ctx.createBiquadFilter(); this.windL.type = 'lowpass'; this.windL.frequency.value = 220;
      this.windG2 = ctx.createGain(); this.windG2.gain.value = 0;
      src2.connect(this.windL); this.windL.connect(this.windG2); this.windG2.connect(this.se);
      src.start(); src2.start();
      this.apply();
      this.timer = setInterval(() => this.schedule(), 60);
    }
    apply() {
      if (!this.ctx) return;
      const o = this.opt;
      const t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(o.mute ? 0 : o.master, t, 0.05);
      this.se.gain.setTargetAtTime(o.se, t, 0.05);
      this.bgm.gain.setTargetAtTime(o.bgm * 0.55, t, 0.05);
    }
    now() { return this.ctx ? this.ctx.currentTime : 0; }

    // ── 風の音
    wind(speed, S, active) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const big = TJ.clamp(Math.log(S / 5) / Math.log(400), 0, 1);
      const g = active ? (0.05 + 0.12 * TJ.clamp(speed, 0, 1)) : 0.0;
      this.windG.gain.setTargetAtTime(g * (1 - big * 0.5), t, 0.15);
      this.windG2.gain.setTargetAtTime(active ? (0.04 + 0.2 * big) * (0.5 + 0.5 * TJ.clamp(speed, 0, 1)) : 0, t, 0.2);
      this.windF.frequency.setTargetAtTime(1300 - big * 900 + speed * 500 + Math.sin(t * 1.7) * 120, t, 0.15);
    }

    // ── 音のもと
    tone(freq, dur, opt) {
      if (!this.ctx) return;
      opt = opt || {};
      const ctx = this.ctx, t = (opt.at || ctx.currentTime);
      const o = ctx.createOscillator(); o.type = opt.type || 'triangle';
      o.frequency.setValueAtTime(freq, t);
      if (opt.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opt.slide), t + dur);
      const g = ctx.createGain();
      const v = (opt.vol || 0.2);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + (opt.atk || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = o;
      if (opt.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opt.lp; o.connect(f); node = f; }
      node.connect(g); g.connect(opt.bus || this.se);
      if (opt.vib) { const l = ctx.createOscillator(); l.frequency.value = opt.vib; const lg = ctx.createGain(); lg.gain.value = freq * 0.012; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
      o.start(t); o.stop(t + dur + 0.02);
    }
    hiss(dur, opt) {
      if (!this.ctx) return;
      opt = opt || {};
      const ctx = this.ctx, t = (opt.at || ctx.currentTime);
      const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = opt.rate || 1;
      const f = ctx.createBiquadFilter(); f.type = opt.ft || 'bandpass'; f.frequency.setValueAtTime(opt.f || 1000, t); f.Q.value = opt.q || 1;
      if (opt.f2) f.frequency.exponentialRampToValueAtTime(opt.f2, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(opt.vol || 0.2, t + (opt.atk || 0.01));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(opt.bus || this.se);
      s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    }

    // ── 効果音
    pop(rel, combo, big) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      if (t - this.lastPop < 0.025 && !big) return;
      this.lastPop = t;
      const base = rel > 0.5 ? 60 : rel > 0.2 ? 67 : 74;
      const d = Math.min(combo - 1, 14);
      const f = midi(deg(YO, d, base));
      this.tone(f, 0.14, { type: 'triangle', vol: 0.13 + Math.min(0.08, rel * 0.15) });
      this.tone(f * 2, 0.08, { type: 'sine', vol: 0.05 });
      this.hiss(0.05, { f: 3000, q: 2, vol: 0.05 });
      if (big) {
        this.tone(midi(base - 12), 0.35, { type: 'sine', vol: 0.25, slide: 0.5 });
        this.hiss(0.3, { f: 900, f2: 200, q: 0.7, vol: 0.18 });
      }
    }
    treasure() { const t = this.now(); [0, 2, 4, 5, 7].forEach((d, i) => this.tone(midi(deg(YO, d, 79)), 0.4, { type: 'sine', vol: 0.14, at: t + i * 0.07 })); }
    newType() { const t = this.now(); this.tone(midi(88), 0.18, { type: 'sine', vol: 0.06, at: t + 0.04 }); }
    grow() { const t = this.now(); [0, 2, 3, 5].forEach((d, i) => { this.tone(midi(deg(YO, d, 72)), 0.6, { type: 'sine', vol: 0.12, at: t + i * 0.09 }); this.tone(midi(deg(YO, d, 84)), 0.4, { type: 'triangle', vol: 0.04, at: t + i * 0.09 }); }); this.hiss(0.6, { f: 500, f2: 2500, q: 0.5, vol: 0.12 }); }
    unlock() { const t = this.now(); this.tone(midi(81), 0.25, { type: 'sine', vol: 0.09, at: t }); this.tone(midi(86), 0.35, { type: 'sine', vol: 0.09, at: t + 0.1 }); }
    blast(S) {
      const low = TJ.clamp(Math.log(S / 5) / Math.log(400), 0, 1);
      this.hiss(0.4, { f: 2400 - low * 1200, f2: 250, q: 0.6, vol: 0.32, atk: 0.005 });
      this.tone(110 - low * 50, 0.3, { type: 'sine', vol: 0.32, slide: 0.45 });
    }
    blastEmpty() { this.hiss(0.18, { f: 1500, f2: 600, q: 0.8, vol: 0.08 }); }
    hit(dmg) { this.tone(dmg ? 240 : 170, 0.12, { type: 'square', vol: 0.06, lp: 900, slide: 0.6 }); this.hiss(0.1, { f: 800, q: 1.5, vol: 0.18 }); }
    hard() { this.tone(140, 0.2, { type: 'square', vol: 0.06, lp: 600, slide: 0.7 }); this.hiss(0.08, { f: 400, q: 2, vol: 0.12 }); }
    crash(big) {
      const t = this.now();
      this.hiss(0.5, { f: 1200, f2: 300, q: 0.6, vol: 0.35 });
      this.tone(90, 0.4, { type: 'sine', vol: 0.3, slide: 0.5 });
      for (let i = 0; i < (big ? 6 : 4); i++) this.tone(midi(deg(YO, i * 2, 74)), 0.12, { type: 'triangle', vol: 0.06, at: t + 0.12 + i * 0.05 });
    }
    rustle() { this.hiss(0.35, { ft: 'highpass', f: 2500, q: 0.5, vol: 0.12, atk: 0.05 }); }
    bump() { this.tone(160, 0.12, { type: 'sine', vol: 0.12, slide: 0.6 }); this.hiss(0.08, { f: 600, vol: 0.06 }); }
    caw() { const t = this.now(); for (let i = 0; i < 2; i++) { this.tone(520, 0.16, { type: 'sawtooth', vol: 0.05, lp: 1400, slide: 0.7, at: t + i * 0.22 }); } }
    meow() { this.tone(700, 0.3, { type: 'sine', vol: 0.06, slide: 1.4, vib: 6 }); }
    cluck() { const t = this.now(); for (let i = 0; i < 3; i++) this.tone(900 - i * 80, 0.06, { type: 'square', vol: 0.03, lp: 1800, at: t + i * 0.08 }); }
    hat() { this.tone(midi(84), 0.18, { type: 'sine', vol: 0.08, slide: 1.5 }); }
    freeze() { const t = this.now(); this.tone(midi(96), 0.3, { type: 'sine', vol: 0.06, at: t }); this.tone(midi(91), 0.3, { type: 'sine', vol: 0.05, at: t + 0.05 }); }
    regain() { this.tone(midi(79), 0.1, { type: 'triangle', vol: 0.06 }); }
    click() { this.tone(midi(84), 0.06, { type: 'triangle', vol: 0.08 }); }
    taiko(at, v) { this.tone(80, 0.45, { type: 'sine', vol: (v || 0.4), slide: 0.55, at }); this.hiss(0.15, { f: 300, q: 0.8, vol: (v || 0.4) * 0.4, at }); }
    kite() {
      const t = this.now();
      const mel = [0, 2, 3, 4, 5, 4, 7];
      mel.forEach((d, i) => this.tone(midi(deg(YO, d, 74)), 0.42, { type: 'sine', vol: 0.12, at: t + i * 0.16, vib: 5, atk: 0.04 }));
      mel.forEach((d, i) => this.tone(midi(deg(YO, d, 62)), 0.3, { type: 'triangle', vol: 0.05, at: t + i * 0.16 }));
      this.taiko(t, 0.45); this.taiko(t + 0.32, 0.3); this.taiko(t + 0.96, 0.45);
      this.hiss(1.2, { f: 400, f2: 3000, q: 0.4, vol: 0.12 });
    }
    bossHit() { this.hiss(0.6, { f: 300, f2: 120, q: 0.5, vol: 0.3, atk: 0.02 }); this.tone(60, 0.5, { type: 'sine', vol: 0.3, slide: 0.6 }); }
    fanfare() { const t = this.now(); [0, 2, 4, 5, 7, 9, 10].forEach((d, i) => this.tone(midi(deg(YO, d, 67)), 0.6, { type: 'sine', vol: 0.12, at: t + i * 0.13, vib: 5 })); for (let i = 0; i < 6; i++) this.taiko(t + i * 0.26, 0.35); }

    // ── BGM（区間ごとの 小さな くり返し）
    setBgm(mode) { if (this.bgmMode !== mode) { this.bgmMode = mode; this.step = 0; } }
    startBgm() { this.bgmOn = true; if (this.ctx) this.nextNote = this.ctx.currentTime + 0.1; }
    stopBgm() { this.bgmOn = false; }
    schedule() {
      if (!this.ctx || !this.bgmOn) return;
      const ctx = this.ctx;
      const mode = this.bgmMode;
      const tempo = mode === 9 ? 132 : mode === 10 ? 120 : mode === 0 ? 84 : 92 + mode * 3;
      const st = 60 / tempo / 2;
      if (this.nextNote < ctx.currentTime - 0.3) this.nextNote = ctx.currentTime + 0.05;
      while (this.nextNote < ctx.currentTime + 0.25) {
        this.playStep(this.step, this.nextNote, mode, st);
        this.step++;
        this.nextNote += st;
      }
    }
    playStep(i, at, mode, st) {
      const scale = mode === 9 ? MIYAKO : YO;
      const bar = Math.floor(i / 16) % 8, s = i % 16;
      const base = [0, 62, 64, 62, 60, 65, 64][mode] || (mode === 9 ? 62 : 67);
      const R = TJ.rng(mode * 1000 + (bar % 4) * 31 + (bar >= 4 ? 7 : 0) + s * 3);
      const bus = this.bgm;
      // こと（メロディ）
      const dense = mode === 0 ? 0.35 : mode === 9 ? 0.55 : 0.5;
      const phrase = (bar % 2 === 1 && s >= 12);
      if (!phrase && (s % 2 === 0 ? R() < dense + 0.2 : R() < dense * 0.4)) {
        const d = Math.floor(R() * 8) - (s === 0 ? 2 : 0);
        const f = midi(deg(scale, d, base + 12));
        this.tone(f, st * (R() < 0.3 ? 3 : 1.6), { type: 'triangle', vol: 0.07, at, bus, slide: 0.995 });
        this.tone(f * 2, st * 0.8, { type: 'sine', vol: 0.015, at, bus });
      }
      // ひくい音
      if (s === 0 || s === 8) {
        const d = [0, 0, 3, 4, 0, 3, 2, 4][bar] + (s === 8 ? 2 : 0);
        this.tone(midi(deg(scale, d, base - 12)), st * 6, { type: 'sine', vol: 0.07, at, bus, atk: 0.02 });
      }
      // すず・たいこ
      if (mode === 9) { if (s % 4 === 0) this.taiko(at, s === 0 ? 0.22 : 0.12); }
      else if (mode === 10) { if (s % 4 === 0 || s === 14) this.taiko(at, 0.16); if (s % 2 === 1) this.hiss(0.04, { f: 6000, q: 3, vol: 0.03, at, bus }); }
      else {
        if (s === 0 && bar % 2 === 0) this.tone(midi(96), 0.6, { type: 'sine', vol: 0.025, at, bus });
        if (s === 4 || s === 12) this.hiss(0.03, { f: 2200, q: 6, vol: 0.035, at, bus });
      }
    }
  }
  TJ.Audio = Audio;
})(typeof window !== 'undefined' ? window : globalThis);
