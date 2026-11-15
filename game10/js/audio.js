/*
 * ぐるり、夜まつり ― 音（Web Audio で その場で合成する。外部の音源ファイルは使わない）
 * なぞる音は 陽音階（ヨナ抜き）で 1つごとに 高くなる。BGM は 小さな まつりばやし。
 */
(function (root) {
  'use strict';
  const A = {
    ctx: null, master: null, sfx: null, bgm: null, verb: null, noiseBuf: null,
    vol: 0.7, bgmVol: 0.6, muted: false,
    bgmOn: false, bgmMode: 'title', nextNote: 0, step: 0, popsThisFrame: 0,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.vol;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
      this.bgm = c.createGain(); this.bgm.gain.value = 0.34 * this.bgmVol; this.bgm.connect(this.master);
      this.verb = c.createConvolver();
      const len = c.sampleRate * 1.8, ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) * (i < 300 ? i / 300 : 1);
      }
      this.verb.buffer = ir;
      const vg = c.createGain(); vg.gain.value = 0.28;
      this.verb.connect(vg); vg.connect(this.master);
      const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.noiseBuf = nb;
      this.nextNote = c.currentTime + 0.1;
    },
    setVol(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.03); },
    setBgmVol(v) { this.bgmVol = v; if (this.bgm) this.bgm.gain.setTargetAtTime(0.34 * v, this.ctx.currentTime, 0.05); },
    setMuted(m) { this.muted = m; this.setVol(this.vol); },

    tone(o) {
      if (!this.ctx) return;
      const c = this.ctx, t = Math.max(c.currentTime, (o.at || c.currentTime) + (o.delay || 0));
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.slide || o.dur));
      if (o.vib) {
        const lfo = c.createOscillator(), lg = c.createGain();
        lfo.frequency.value = o.vib; lg.gain.value = o.f * 0.012;
        lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + o.dur + 0.1);
      }
      const a = o.a || 0.005, d = o.dur || 0.2, v = o.v || 0.2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + a);
      if (o.hold) g.gain.setValueAtTime(v, t + a + o.hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(g);
      let out = g;
      if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
      out.connect(o.bus || this.sfx);
      if (o.verb !== false) { const s = c.createGain(); s.gain.value = o.verb == null ? 0.3 : o.verb; out.connect(s); s.connect(this.verb); }
      osc.start(t); osc.stop(t + d + 0.05);
    },
    noise(o) {
      if (!this.ctx) return;
      const c = this.ctx, t = Math.max(c.currentTime, (o.at || c.currentTime) + (o.delay || 0));
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = o.ft || 'lowpass'; f.frequency.setValueAtTime(o.f || 800, t);
      if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.dur || 0.2));
      f.Q.value = o.q || 0.7;
      const g = c.createGain(), d = o.dur || 0.2, v = o.v || 0.2;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(f); f.connect(g); g.connect(o.bus || this.sfx);
      if (o.verb !== false) { const s = c.createGain(); s.gain.value = o.verb == null ? 0.25 : o.verb; g.connect(s); s.connect(this.verb); }
      src.start(t, Math.random() * 0.5); src.stop(t + d + 0.05);
    },
    // 陽音階（レ ミ ソ ラ シ）
    yo(n, base) { const s = [0, 2, 5, 7, 9]; const o = Math.floor(n / 5); return (base || 293.7) * Math.pow(2, (s[((n % 5) + 5) % 5] + o * 12) / 12); },

    play(name, p) {
      if (!this.ctx || this.muted) return;
      p = p || {};
      switch (name) {
        case 'link': {
          const n = p.n || 0, f = this.yo(n + 2);
          if (p.t === 'H') { this.tone({ f, dur: 0.16, v: 0.13, type: 'triangle' }); this.tone({ f: f * 2, dur: 0.08, v: 0.04, type: 'square', lp: 2500 }); }
          else if (p.t === 'D') { this.tone({ f: f * 0.5, dur: 0.22, v: 0.16, type: 'sine' }); this.tone({ f, dur: 0.12, v: 0.06, type: 'triangle' }); }
          else if (p.t === 'K') { this.tone({ f: f * 2, dur: 0.3, v: 0.08, type: 'sine', verb: 0.5 }); this.tone({ f: f * 3, dur: 0.18, v: 0.04, type: 'sine' }); }
          else { this.tone({ f: f * 1.5, dur: 0.3, v: 0.08, type: 'sine', verb: 0.6 }); this.tone({ f: f * 2.25, dur: 0.25, v: 0.04, delay: 0.03 }); }
          break;
        }
        case 'unlink': this.tone({ f: this.yo((p.n || 0) + 1), f2: this.yo(p.n || 0) * 0.8, dur: 0.08, v: 0.07, type: 'triangle' }); break;
        case 'full': this.tone({ f: 220, f2: 180, dur: 0.09, v: 0.1, type: 'square', lp: 700 }); break;
        case 'close':
          this.tone({ f: 1400, f2: 2000, dur: 0.12, v: 0.1, slide: 0.08 });
          [0, 4, 7, 12].forEach((s, q) => this.tone({ f: 587 * Math.pow(2, s / 12), dur: 0.5, v: 0.07, type: 'sine', delay: 0.02 + q * 0.04, verb: 0.6 }));
          break;
        case 'open': this.tone({ f: 900, f2: 600, dur: 0.1, v: 0.08 }); break;
        case 'cancel': this.tone({ f: 330, f2: 220, dur: 0.14, v: 0.08, type: 'triangle' }); break;
        case 'pop': {
          if (this.popsThisFrame++ > 2) return;
          const n = p.n || 0, f = this.yo(n + 4);
          this.tone({ f, f2: f * 1.5, dur: 0.1, v: 0.12, type: 'sine', slide: 0.05 });
          this.noise({ f: 2400, ft: 'bandpass', q: 2, dur: 0.05, v: 0.08, verb: false });
          break;
        }
        case 'rocket': this.tone({ f: 800 + Math.random() * 300, f2: 2400, dur: 0.35, v: 0.035, type: 'sine', slide: 0.33, verb: 0.2 }); break;
        case 'burst': {
          const k = Math.min(1, (p.size || 1) / 8);
          this.noise({ f: 1800, f2: 120, dur: 0.45 + k * 0.6, v: 0.16 + k * 0.2, verb: 0.6 });
          this.tone({ f: 90, f2: 40, dur: 0.35 + k * 0.4, v: 0.18 + k * 0.18, type: 'sine', verb: 0.3 });
          for (let q = 0; q < 4 + k * 8; q++) this.noise({ f: 3000 + Math.random() * 3000, ft: 'bandpass', q: 3, dur: 0.03, v: 0.05, delay: 0.25 + q * 0.04 + Math.random() * 0.06, verb: 0.4 });
          break;
        }
        case 'hit': this.tone({ f: 260, f2: 140, dur: 0.12, v: 0.18, type: 'triangle' }); this.noise({ f: 1200, f2: 300, dur: 0.06, v: 0.12 }); break;
        case 'defeat':
          this.tone({ f: 520, f2: 1040, dur: 0.12, v: 0.14, type: 'sine', slide: 0.08 });
          this.noise({ f: 900, f2: 200, dur: 0.3, v: 0.12 });
          this.tone({ f: 1568, dur: 0.25, v: 0.06, type: 'sine', delay: 0.12, verb: 0.5 });
          break;
        case 'befriend':
          [0, 2, 4, 5, 7].forEach((n, q) => this.tone({ f: this.yo(n + 5), dur: 0.5, v: 0.1, type: 'triangle', delay: q * 0.07, verb: 0.6 }));
          this.tone({ f: 400, f2: 900, dur: 0.18, v: 0.1, delay: 0.38, slide: 0.12 });
          break;
        case 'heal': [0, 4, 7].forEach((s, q) => this.tone({ f: 392 * Math.pow(2, s / 12), dur: 0.5, v: 0.07, type: 'sine', delay: q * 0.05, verb: 0.5 })); break;
        case 'coin': {
          const n = Math.min(8, p.n || 3);
          for (let q = 0; q < n; q++) this.tone({ f: 1800 + (q % 3) * 260, dur: 0.12, v: 0.05, type: 'sine', delay: q * 0.045, verb: 0.3 });
          break;
        }
        case 'hurt':
          this.tone({ f: 110, f2: 55, dur: 0.3, v: 0.32, type: 'sine' });
          this.noise({ f: 700, f2: 150, dur: 0.18, v: 0.22 });
          break;
        case 'blocked': this.tone({ f: 900, dur: 0.12, v: 0.12, type: 'triangle' }); this.noise({ f: 2500, ft: 'bandpass', q: 4, dur: 0.06, v: 0.15 }); break;
        case 'act': this.noise({ f: 600, f2: 2400, ft: 'bandpass', q: 1.2, dur: 0.14, v: 0.12 }); break;
        case 'steal': for (let q = 0; q < 3; q++) this.tone({ f: 1900 - q * 300, dur: 0.1, v: 0.05, delay: q * 0.06 }); break;
        case 'boss':
          this.tone({ f: 80, f2: 45, dur: 0.45, v: 0.38, type: 'sine' }); this.noise({ f: 400, f2: 90, dur: 0.3, v: 0.25 });
          this.tone({ f: 80, f2: 45, dur: 0.45, v: 0.32, type: 'sine', delay: 0.18 }); this.noise({ f: 400, f2: 90, dur: 0.3, v: 0.2, delay: 0.18 });
          break;
        case 'bossHit': this.tone({ f: 180, f2: 90, dur: 0.25, v: 0.2, type: 'triangle' }); this.noise({ f: 1500, f2: 200, dur: 0.15, v: 0.15 }); break;
        case 'doron': this.noise({ f: 1600, f2: 200, dur: 0.35, v: 0.14 }); this.tone({ f: 180, f2: 90, dur: 0.25, v: 0.12, type: 'sine' }); break;
        case 'flee': this.tone({ f: 500, f2: 1500, dur: 0.4, v: 0.08, slide: 0.35 }); this.noise({ f: 800, f2: 3000, ft: 'bandpass', dur: 0.4, v: 0.08 }); break;
        case 'junk': this.tone({ f: 300, f2: 180, dur: 0.1, v: 0.1, type: 'triangle' }); break;
        case 'gust': this.noise({ f: 400, f2: 2000, ft: 'bandpass', q: 0.8, dur: 0.7, v: 0.18, verb: 0.4 }); break;
        case 'lantern': this.tone({ f: 1320, dur: 0.4, v: 0.06, verb: 0.6 }); this.tone({ f: 1980, dur: 0.3, v: 0.04, delay: 0.05, verb: 0.6 }); break;
        case 'grow': this.tone({ f: 200, f2: 420, dur: 0.25, v: 0.1, type: 'square', lp: 800 }); break;
        case 'shuffle': this.noise({ f: 1500, f2: 600, dur: 0.4, v: 0.12 }); break;
        case 'win':
          [0, 2, 4, 7, 9].forEach((n, q) => this.tone({ f: this.yo(n + 5), dur: 0.35, v: 0.1, type: 'triangle', delay: q * 0.08, verb: 0.5 }));
          this.tone({ f: this.yo(15), dur: 0.9, v: 0.09, type: 'sine', delay: 0.45, vib: 5, verb: 0.6 });
          break;
        case 'lose': [7, 5, 2, 0].forEach((n, q) => this.tone({ f: this.yo(n), dur: 0.45, v: 0.09, type: 'triangle', delay: q * 0.16 })); break;
        case 'newFriend':
          [0, 4, 7, 12, 16].forEach((s, q) => this.tone({ f: 523 * Math.pow(2, s / 12), dur: 0.7, v: 0.08, type: 'sine', delay: q * 0.06, verb: 0.7 }));
          break;
        case 'step': this.tone({ f: 500 + Math.random() * 60, dur: 0.05, v: 0.05, type: 'triangle' }); break;
        case 'ui': this.tone({ f: 880, dur: 0.06, v: 0.07, type: 'triangle' }); this.noise({ f: 3000, ft: 'bandpass', q: 5, dur: 0.03, v: 0.06, verb: false }); break;
        case 'uiok': this.tone({ f: 660, dur: 0.1, v: 0.09, type: 'triangle' }); this.tone({ f: 990, dur: 0.15, v: 0.09, type: 'triangle', delay: 0.07 }); break;
        case 'buy': this.play('coin', { n: 4 }); this.tone({ f: 784, dur: 0.3, v: 0.09, type: 'triangle', delay: 0.15 }); break;
        case 'nope': this.tone({ f: 200, dur: 0.12, v: 0.09, type: 'square', lp: 600 }); break;
        case 'calm':
          [0, 2, 4, 7, 9, 12].forEach((n, q) => this.tone({ f: this.yo(n + 2), dur: 0.8, v: 0.08, type: 'sine', delay: q * 0.1, verb: 0.7 }));
          break;
      }
    },

    // ---------------------------------------------------------------- BGM（小さな まつりばやし）
    // mode: title / a1〜a4 / boss / map / end
    startBgm(mode) { this.bgmOn = true; if (this.bgmMode !== mode) { this.bgmMode = mode; this.step = 0; } if (this.ctx) this.nextNote = Math.max(this.nextNote, this.ctx.currentTime + 0.1); },
    stopBgm() { this.bgmOn = false; },
    tick() {
      this.popsThisFrame = 0;
      if (!this.ctx || !this.bgmOn || this.muted) return;
      const c = this.ctx, m = this.bgmMode;
      const cfg = {
        title: { bpm: 84, base: 293.7, drum: 0, flute: 0.8, bell: 0.4 },
        map: { bpm: 92, base: 293.7, drum: 0.5, flute: 0.6, bell: 0.5 },
        a1: { bpm: 96, base: 293.7, drum: 0.6, flute: 0.55, bell: 0.4 },
        a2: { bpm: 90, base: 261.6, drum: 0.5, flute: 0.6, bell: 0.3, minor: true },
        a3: { bpm: 94, base: 329.6, drum: 0.6, flute: 0.5, bell: 0.5 },
        a4: { bpm: 100, base: 293.7, drum: 0.8, flute: 0.55, bell: 0.6 },
        boss: { bpm: 112, base: 246.9, drum: 1, flute: 0.45, bell: 0.3, minor: true },
        end: { bpm: 104, base: 293.7, drum: 0.9, flute: 0.75, bell: 0.8 }
      }[m] || { bpm: 90, base: 293.7, drum: 0.5, flute: 0.5, bell: 0.4 };
      const beat = 60 / cfg.bpm / 2;
      const sc = cfg.minor ? [0, 1, 5, 7, 8] : [0, 2, 5, 7, 9];
      const note = (n, oct) => cfg.base * Math.pow(2, (sc[((n % 5) + 5) % 5] + 12 * (Math.floor(n / 5) + (oct || 0))) / 12);
      // 8小節の ふし（毎周 すこし かわる）
      const phrase = [0, 2, 3, 2, 4, 3, 2, -1, 1, 2, 4, 5, 4, 3, 2, -1, 3, 4, 5, 7, 5, 4, 3, -1, 2, 3, 2, 1, 0, -1, -1, -1];
      while (this.nextNote < c.currentTime + 0.3) {
        const s = this.step++, t = this.nextNote;
        // たいこ：どん・かっ
        if (cfg.drum > 0) {
          const pat = [1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 0, 2, 2];
          const d = pat[s % 16];
          if (d === 1) { this.tone({ at: t, f: 95, f2: 55, dur: 0.22, v: 0.16 * cfg.drum, type: 'sine', bus: this.bgm, verb: 0.15 }); this.noise({ at: t, f: 300, f2: 80, dur: 0.1, v: 0.05 * cfg.drum, bus: this.bgm, verb: false }); }
          else if (d === 2) this.noise({ at: t, f: 2200, ft: 'bandpass', q: 3, dur: 0.04, v: 0.05 * cfg.drum, bus: this.bgm, verb: false });
        }
        // かね（ちゃんちき）
        if (cfg.bell > 0 && (s % 4 === 0 || (s % 8 === 3 && Math.random() < 0.5))) {
          this.tone({ at: t, f: 2350, dur: 0.12, v: 0.018 * cfg.bell, type: 'square', lp: 5000, bus: this.bgm, verb: 0.2 });
          this.tone({ at: t, f: 3520, dur: 0.08, v: 0.012 * cfg.bell, type: 'sine', bus: this.bgm, verb: 0.2 });
        }
        // 笛
        if (s % 2 === 0 && cfg.flute > 0) {
          const k = (s / 2) % phrase.length;
          const n = phrase[k];
          const cyc = Math.floor(s / 2 / phrase.length);
          if (n >= 0 && !(cyc % 3 === 2 && k >= 16)) {
            let len = 1;
            while (k + len < phrase.length && phrase[k + len] === -1 && len < 3) len++;
            this.tone({ at: t, f: note(n + (cyc % 2 && k < 8 ? 1 : 0), 1), dur: beat * 2 * len * 0.95, a: 0.04, v: 0.045 * cfg.flute, type: 'sine', vib: 5.5, bus: this.bgm, verb: 0.5, hold: beat * len });
            this.noise({ at: t, f: 2500, ft: 'bandpass', q: 1, dur: 0.06, v: 0.006 * cfg.flute, bus: this.bgm, verb: false });
          }
        }
        // ひくい音
        if (s % 16 === 0) this.tone({ at: t, f: note([0, 3, 2, 4][Math.floor(s / 16) % 4], -1), dur: beat * 14, a: 0.3, v: 0.04, type: 'triangle', bus: this.bgm, verb: 0.4 });
        this.nextNote += beat;
      }
    }
  };
  root.G10Audio = A;
})(window);
