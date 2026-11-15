/*
 * そこから、そら ― 音（Web Audio で その場で合成する。外部の音源ファイルは使わない）
 */
(function (root) {
  'use strict';
  const A = {
    ctx: null, master: null, sfx: null, bgm: null, verb: null, vol: 0.8, muted: false, noiseBuf: null,
    bgmOn: false, bgmLayer: 0, nextNote: 0, step: 0, lastHitT: 0, hitsThisFrame: 0,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.vol;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
      this.bgm = c.createGain(); this.bgm.gain.value = 0.32; this.bgm.connect(this.master);
      // 井戸の中の ひびき
      this.verb = c.createConvolver();
      const len = c.sampleRate * 2.2, ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < 400 ? i / 400 : 1);
      }
      this.verb.buffer = ir;
      const vg = c.createGain(); vg.gain.value = 0.32;
      this.verb.connect(vg); vg.connect(this.master);
      const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.noiseBuf = nb;
    },
    setVol(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.03); },
    setMuted(m) { this.muted = m; this.setVol(this.vol); },
    now() { return this.ctx ? this.ctx.currentTime : 0; },

    tone(o) {
      if (!this.ctx) return;
      const c = this.ctx, t = (o.at || c.currentTime) + (o.delay || 0);
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.slide || o.dur));
      const a = o.a || 0.005, d = o.dur || 0.2, v = o.v || 0.2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(g);
      let out = g;
      if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
      out.connect(o.bus || this.sfx);
      if (o.verb !== false) { const s = c.createGain(); s.gain.value = o.verb || 0.35; out.connect(s); s.connect(this.verb); }
      osc.start(t); osc.stop(t + d + 0.05);
    },
    noise(o) {
      if (!this.ctx) return;
      const c = this.ctx, t = (o.at || c.currentTime) + (o.delay || 0);
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = o.ft || 'lowpass'; f.frequency.setValueAtTime(o.f || 800, t);
      if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.dur || 0.2));
      f.Q.value = o.q || 0.7;
      const g = c.createGain(), d = o.dur || 0.2, v = o.v || 0.2;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(f); f.connect(g); g.connect(this.sfx);
      if (o.verb !== false) { const s = c.createGain(); s.gain.value = o.verb || 0.3; g.connect(s); s.connect(this.verb); }
      src.start(t, Math.random() * 0.5); src.stop(t + d + 0.05);
    },

    // 五音（ペンタトニック）で、こわすたびに少しずつ高くなる
    scale(n) { const s = [0, 2, 4, 7, 9]; const o = Math.floor(n / 5); return 392 * Math.pow(2, (s[((n % 5) + 5) % 5] + o * 12) / 12); },

    play(name, p) {
      if (!this.ctx || this.muted) return;
      p = p || {};
      const c = this.ctx;
      switch (name) {
        case 'pad': {
          const lv = p.lv || 0;
          this.tone({ f: 240 + lv * 40, f2: 420 + lv * 80, dur: 0.16, v: 0.22, type: 'sine', slide: 0.08 });
          this.tone({ f: 120, f2: 90, dur: 0.1, v: 0.12, type: 'triangle' });
          break;
        }
        case 'hit': {
          if (this.hitsThisFrame++ > 3) return;
          const n = Math.min(p.flight || 0, 14);
          const f = this.scale(n);
          const m = p.mat;
          if (m === 3 || m === 9 || m === 13) { // つち
            this.noise({ f: 900, f2: 300, dur: 0.12, v: 0.22 });
            this.tone({ f: f * 0.5, dur: 0.18, v: 0.14, type: 'triangle' });
          } else if (m === 6) { // きらら石
            this.tone({ f: f * 2, dur: 0.5, v: 0.13, type: 'sine', verb: 0.6 });
            this.tone({ f: f * 3, dur: 0.35, v: 0.06, type: 'sine', delay: 0.02 });
            this.noise({ f: 2400, ft: 'bandpass', dur: 0.08, v: 0.12 });
          } else {
            this.noise({ f: 1800, f2: 600, ft: 'bandpass', q: 1.5, dur: 0.09, v: 0.25 });
            this.tone({ f: f, dur: 0.22, v: 0.15, type: 'triangle' });
          }
          break;
        }
        case 'chip': this.noise({ f: 2600, ft: 'bandpass', q: 3, dur: 0.06, v: 0.2 }); this.tone({ f: 700 + (p.flight || 0) * 30, dur: 0.07, v: 0.08, type: 'square', lp: 1800 }); break;
        case 'clink': this.tone({ f: 1300, f2: 1100, dur: 0.08, v: 0.07, type: 'triangle' }); break;
        case 'sealed': this.tone({ f: 200, dur: 0.15, v: 0.15, type: 'square', lp: 600 }); this.tone({ f: 150, dur: 0.18, v: 0.12, type: 'square', lp: 500, delay: 0.06 }); break;
        case 'collapse': {
          const n = p.n || 1, k = Math.min(1, n / 25);
          this.noise({ f: 500 + k * 300, f2: 120, dur: 0.5 + k * 0.6, v: 0.25 + k * 0.25, verb: 0.5 });
          this.tone({ f: 90, f2: 45, dur: 0.6 + k * 0.5, v: 0.25 + k * 0.2, type: 'sine' });
          for (let q = 0; q < Math.min(8, 2 + n / 3); q++) this.noise({ f: 1500 + Math.random() * 1500, ft: 'bandpass', q: 2, dur: 0.05, v: 0.12, delay: 0.04 + q * 0.05 + Math.random() * 0.04 });
          break;
        }
        case 'splash': {
          const n = p.n || 1, k = Math.min(1, n / 25);
          this.noise({ f: 3000, f2: 500, ft: 'lowpass', dur: 0.5 + k * 0.6, v: 0.25 + k * 0.25, verb: 0.6 });
          this.tone({ f: 160, f2: 60, dur: 0.4, v: 0.18 + k * 0.15, type: 'sine' });
          // きららが じゃらっと 入る
          const m = Math.min(10, 2 + Math.round(n / 3));
          for (let q = 0; q < m; q++) this.tone({ f: this.scale(5 + q), dur: 0.25, v: 0.07, type: 'sine', delay: 0.15 + q * 0.055, verb: 0.5 });
          break;
        }
        case 'boom':
          this.noise({ f: 1200, f2: 80, dur: 0.6, v: 0.45, verb: 0.5 });
          this.tone({ f: 80, f2: 35, dur: 0.5, v: 0.35, type: 'sine' });
          break;
        case 'catch': this.tone({ f: 900, f2: 300, dur: 0.1, v: 0.16, type: 'sine', slide: 0.08 }); this.tone({ f: 500, dur: 0.06, v: 0.1, type: 'triangle', delay: 0.08 }); break;
        case 'spit': this.noise({ f: 1200, f2: 400, dur: 0.08, v: 0.2 }); this.tone({ f: 300, f2: 700, dur: 0.1, v: 0.14, slide: 0.06 }); break;
        case 'miss':
          this.tone({ f: 600, f2: 160, dur: 0.25, v: 0.18, type: 'sine', slide: 0.2 });
          this.noise({ f: 1800, f2: 400, dur: 0.3, v: 0.15 });
          break;
        case 'resurface': this.tone({ f: 300, f2: 600, dur: 0.15, v: 0.1, slide: 0.12 }); break;
        case 'lid':
          this.noise({ f: 700, f2: 150, dur: 0.9, v: 0.35, verb: 0.6 });
          [0, 4, 7, 12].forEach((s, q) => this.tone({ f: 523 * Math.pow(2, s / 12), dur: 1.2, v: 0.1, type: 'sine', delay: 0.25 + q * 0.09, verb: 0.7 }));
          break;
        case 'exit':
          this.tone({ f: 300, f2: 1400, dur: 0.6, v: 0.18, type: 'sine', slide: 0.5, verb: 0.6 });
          this.noise({ f: 400, f2: 3000, ft: 'bandpass', dur: 1.2, v: 0.12, verb: 0.6 });
          break;
        case 'rise':
          for (let q = 0; q < 6; q++) this.tone({ f: this.scale(q * 2 + 2), dur: 0.5, v: 0.08, type: 'sine', delay: q * 0.12, verb: 0.7 });
          break;
        case 'item':
          [0, 2, 4, 7, 12].forEach((s, q) => this.tone({ f: 659 * Math.pow(2, s / 12), dur: 0.5, v: 0.12, type: 'triangle', delay: q * 0.08, verb: 0.6 }));
          break;
        case 'kill': this.tone({ f: 1100, f2: 300, dur: 0.15, v: 0.14, type: 'square', lp: 2000, slide: 0.12 }); this.noise({ f: 2500, ft: 'bandpass', dur: 0.08, v: 0.12 }); break;
        case 'screech': this.tone({ f: 2400, f2: 3200, dur: 0.18, v: 0.06, type: 'sawtooth', lp: 4000 }); this.tone({ f: 2600, f2: 3400, dur: 0.15, v: 0.05, type: 'sawtooth', lp: 4000, delay: 0.2 }); break;
        case 'stun': this.tone({ f: 500, f2: 250, dur: 0.4, v: 0.15, type: 'triangle' }); this.tone({ f: 520, f2: 260, dur: 0.4, v: 0.1, type: 'triangle', delay: 0.05 }); break;
        case 'bump': this.tone({ f: 880, f2: 1320, dur: 0.15, v: 0.15, type: 'sine', slide: 0.05 }); this.tone({ f: 1760, dur: 0.2, v: 0.06, delay: 0.03 }); break;
        case 'rumble': this.noise({ f: 200, dur: 0.9, v: 0.3, verb: 0.4 }); break;
        case 'plip': this.tone({ f: 900 + Math.random() * 300, f2: 400, dur: 0.12, v: 0.06 }); break;
        case 'mud': this.noise({ f: 500, f2: 200, dur: 0.18, v: 0.2 }); this.tone({ f: 200, f2: 120, dur: 0.15, v: 0.1, type: 'triangle' }); break;
        case 'regrow': this.tone({ f: 300, f2: 600, dur: 0.3, v: 0.08, type: 'sawtooth', lp: 900 }); break;
        case 'ghit': this.tone({ f: 140, f2: 90, dur: 0.2, v: 0.2, type: 'square', lp: 500 }); break;
        case 'gtele': this.tone({ f: 110, f2: 70, dur: 0.7, v: 0.2, type: 'sawtooth', lp: 400 }); break;
        case 'gdown':
          this.noise({ f: 800, f2: 60, dur: 2.2, v: 0.5, verb: 0.7 });
          this.tone({ f: 70, f2: 30, dur: 2, v: 0.35, type: 'sine' });
          break;
        case 'marbles': for (let q = 0; q < 5; q++) this.tone({ f: 1400 + Math.random() * 800, dur: 0.08, v: 0.08, type: 'sine', delay: q * 0.04 }); break;
        case 'thud': this.noise({ f: 300, dur: 0.2, v: 0.25 }); this.tone({ f: 90, f2: 60, dur: 0.2, v: 0.2 }); break;
        case 'clonk': this.tone({ f: 330, dur: 0.18, v: 0.16, type: 'triangle' }); this.noise({ f: 900, ft: 'bandpass', dur: 0.06, v: 0.15 }); break;
        case 'pop': this.tone({ f: 700, f2: 1200, dur: 0.08, v: 0.12 }); break;
        case 'momup': {
          const lv = p.lv || 1;
          [0, 4, 7].forEach((s, q) => this.tone({ f: (lv >= 2 ? 784 : 587) * Math.pow(2, s / 12), dur: 0.25, v: 0.09, type: 'triangle', delay: q * 0.05 }));
          break;
        }
        case 'ui': this.tone({ f: 660, dur: 0.08, v: 0.1, type: 'triangle' }); break;
        case 'uiok': this.tone({ f: 660, dur: 0.1, v: 0.1, type: 'triangle' }); this.tone({ f: 990, dur: 0.15, v: 0.1, type: 'triangle', delay: 0.07 }); break;
      }
    },

    // BGM：層ごとに 音階と はやさを かえた、ゆっくりの くりかえし（毎回すこし ちがう）
    startBgm(layer) { this.bgmOn = true; this.bgmLayer = layer; if (this.ctx) this.nextNote = Math.max(this.nextNote, this.ctx.currentTime + 0.1); },
    stopBgm() { this.bgmOn = false; },
    tick() {
      this.hitsThisFrame = 0;
      if (!this.ctx || !this.bgmOn || this.muted) return;
      const c = this.ctx;
      const L = this.bgmLayer;
      const bpm = [62, 68, 64, 74, 70, 60][L] || 64;
      const beat = 60 / bpm / 2;
      const roots = [196, 174.6, 207.6, 220, 233.1, 261.6];
      const base = roots[L] || 196;
      const modes = [[0, 3, 5, 7, 10], [0, 2, 5, 7, 9], [0, 2, 3, 7, 8], [0, 2, 4, 7, 9], [0, 2, 4, 7, 9], [0, 4, 7, 9, 11]];
      const md = modes[L] || modes[0];
      while (this.nextNote < c.currentTime + 0.25) {
        const s = this.step++;
        const t = this.nextNote;
        if (s % 16 === 0) {
          // ゆったりした 低い音
          const r = [0, 0, 5, 3][Math.floor(s / 16) % 4];
          this.tone({ at: t, f: base / 2 * Math.pow(2, md[r % 5] / 12), dur: beat * 14, a: 0.4, v: 0.08, type: 'sine', bus: this.bgm, verb: 0.5 });
        }
        // 水のしずくのような 木琴
        const pat = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0];
        if (pat[s % 16] && Math.random() < 0.85) {
          const deg = Math.floor(Math.random() * 7);
          const oct = deg >= 5 ? 1 : 0;
          const f = base * Math.pow(2, (md[deg % 5] + oct * 12) / 12) * (Math.random() < 0.2 ? 2 : 1);
          this.tone({ at: t, f, dur: 0.9, a: 0.004, v: 0.05, type: 'triangle', bus: this.bgm, verb: 0.8 });
        }
        if (s % 32 === 20 && Math.random() < 0.6) this.tone({ at: t, f: 1800 + Math.random() * 600, f2: 900, dur: 0.12, v: 0.02, bus: this.bgm, verb: 0.9 });
        this.nextNote += beat;
      }
    }
  };
  root.SKA = A;
})(window);
