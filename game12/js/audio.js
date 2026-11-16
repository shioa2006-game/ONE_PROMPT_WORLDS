/*
 * ころころ、ひらけ列島 ― 音（Web Audio で その場で 合成。外部の 音声ファイルは 使わない）
 */
(function (root) {
  'use strict';
  const KR = root.KR;
  const S = KR.SND = { ctx: null, master: null, sfx: null, bgm: null, vol: { bgm: 0.5, sfx: 0.8 }, muted: false, bgmOn: false, season: 0 };

  S.init = function () {
    if (S.ctx) { if (S.ctx.state === 'suspended') S.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    S.ctx = new AC();
    S.master = S.ctx.createGain(); S.master.connect(S.ctx.destination);
    S.sfx = S.ctx.createGain(); S.sfx.connect(S.master);
    S.bgm = S.ctx.createGain(); S.bgm.connect(S.master);
    S.apply();
    // ノイズ
    const len = S.ctx.sampleRate * 1;
    S.noise = S.ctx.createBuffer(1, len, S.ctx.sampleRate);
    const d = S.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  };
  S.apply = function () {
    if (!S.ctx) return;
    S.master.gain.value = S.muted ? 0 : 1;
    S.sfx.gain.value = S.vol.sfx * 0.9;
    S.bgm.gain.value = S.vol.bgm * 0.32;
  };
  S.setMuted = function (m) { S.muted = m; S.apply(); };

  function tone(freq, t0, dur, type, vol, opt) {
    if (!S.ctx) return;
    opt = opt || {};
    const c = S.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t0 + (opt.slide || dur));
    if (opt.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = opt.vib; lg.gain.value = freq * 0.012; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.1); }
    const a = opt.a || 0.008;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(opt.out || S.sfx);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, vol, freq, q, type, out) {
    if (!S.ctx) return;
    const c = S.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = S.noise; f.type = type || 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = q || 1;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(out || S.sfx);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
  }
  const now = () => (S.ctx ? S.ctx.currentTime : 0);
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);

  S.play = function (name, arg) {
    if (!S.ctx || S.muted) return;
    const t = now() + 0.005;
    switch (name) {
      case 'click': tone(880, t, 0.06, 'triangle', 0.18); tone(1320, t + 0.02, 0.05, 'sine', 0.08); break;
      case 'hover': tone(1400, t, 0.03, 'sine', 0.04); break;
      case 'dice': // からから
        for (let i = 0; i < 7; i++) noise(t + i * 0.055 + Math.random() * 0.02, 0.04, 0.22, 2400 + Math.random() * 1600, 4);
        break;
      case 'diceLand':
        noise(t, 0.08, 0.4, 900, 1.5); tone(220, t, 0.12, 'triangle', 0.25, { to: 140 });
        break;
      case 'step': { // ガタン
        const k = arg || 0;
        const p = 1 + (k % 8) * 0.03;
        noise(t, 0.05, 0.28, 500 * p, 2); tone(95 * p, t, 0.09, 'triangle', 0.3, { to: 70 });
        noise(t + 0.075, 0.04, 0.18, 700 * p, 2); tone(120 * p, t + 0.075, 0.07, 'triangle', 0.2, { to: 85 });
        break;
      }
      case 'coin': { // 金額で 音が ふえる
        const n = arg >= 3000 ? 5 : arg >= 1000 ? 4 : arg >= 300 ? 3 : 2;
        const notes = [84, 88, 91, 96, 100];
        for (let i = 0; i < n; i++) { tone(N(notes[i]), t + i * 0.055, 0.25, 'triangle', 0.16); tone(N(notes[i] + 12), t + i * 0.055, 0.12, 'sine', 0.05); }
        break;
      }
      case 'minus':
        tone(330, t, 0.25, 'triangle', 0.22, { to: 160 }); tone(247, t + 0.1, 0.28, 'triangle', 0.18, { to: 120 });
        break;
      case 'rain': for (let i = 0; i < 6; i++) noise(t + i * 0.04, 0.05, 0.08, 3000 + Math.random() * 3000, 3); S.play('minus'); break;
      case 'card':
        noise(t, 0.12, 0.2, 3000, 0.8, 'highpass');
        tone(N(86), t + 0.08, 0.2, 'sine', 0.14); tone(N(93), t + 0.14, 0.25, 'sine', 0.12);
        break;
      case 'stamp': // ポン
        tone(180, t, 0.12, 'sine', 0.4, { to: 90 }); noise(t, 0.06, 0.3, 600, 1);
        tone(N(91), t + 0.06, 0.18, 'triangle', 0.12);
        break;
      case 'buy':
        tone(160, t, 0.12, 'sine', 0.4, { to: 80 }); noise(t, 0.05, 0.3, 700, 1);
        tone(N(88), t + 0.09, 0.12, 'triangle', 0.16); tone(N(95), t + 0.15, 0.3, 'triangle', 0.16);
        break;
      case 'mono': { // 独占
        const seq = [72, 76, 79, 84, 88];
        seq.forEach((m, i) => { tone(N(m), t + i * 0.09, 0.3, 'square', 0.07); tone(N(m), t + i * 0.09, 0.35, 'triangle', 0.14); });
        [72, 76, 79, 84].forEach((m) => tone(N(m), t + 0.5, 0.9, 'triangle', 0.1, { vib: 6 }));
        break;
      }
      case 'whistle': // ポッポー
        tone(N(81), t, 0.22, 'sine', 0.2, { vib: 9, a: 0.03 }); tone(N(85), t, 0.22, 'sine', 0.12, { vib: 9, a: 0.03 });
        tone(N(81), t + 0.28, 0.6, 'sine', 0.2, { vib: 9, a: 0.04 }); tone(N(85), t + 0.28, 0.6, 'sine', 0.12, { vib: 9, a: 0.04 });
        noise(t, 0.85, 0.05, 1800, 0.6);
        break;
      case 'arrive': {
        S.play('whistle');
        const seq = [67, 72, 76, 79, 84];
        seq.forEach((m, i) => { tone(N(m), t + 0.9 + i * 0.1, 0.4, 'triangle', 0.16); tone(N(m - 12), t + 0.9 + i * 0.1, 0.4, 'square', 0.04); });
        [72, 76, 79, 84, 88].forEach((m) => tone(N(m), t + 1.45, 1.2, 'triangle', 0.09, { vib: 5 }));
        break;
      }
      case 'exact':
        for (let i = 0; i < 8; i++) tone(N(96 + (i % 4) * 3), t + i * 0.05, 0.18, 'sine', 0.08);
        break;
      case 'toll':
        tone(N(88), t, 0.12, 'triangle', 0.15); tone(N(84), t + 0.08, 0.2, 'triangle', 0.13);
        noise(t + 0.02, 0.06, 0.12, 4000, 2);
        break;
      case 'tollIn': S.play('coin', 1000); break;
      case 'open': {
        noise(t, 1.2, 0.18, 120, 0.7, 'lowpass');
        tone(55, t, 1.2, 'sawtooth', 0.06, { to: 110, slide: 1.2 });
        const seq = [60, 64, 67, 72, 76, 79, 84];
        seq.forEach((m, i) => tone(N(m), t + 0.8 + i * 0.08, 0.6, 'triangle', 0.12));
        [60, 67, 72, 76].forEach((m) => tone(N(m), t + 1.4, 1.6, 'triangle', 0.08, { vib: 4 }));
        tone(N(96), t + 1.4, 1.4, 'sine', 0.06);
        break;
      }
      case 'season':
        [79, 84, 88, 91, 96, 100].forEach((m, i) => tone(N(m), t + i * 0.09, 0.8, 'sine', 0.07));
        break;
      case 'tick': tone(N(96), t, 0.04, 'square', 0.03); break;
      case 'register':
        tone(N(100), t, 0.1, 'triangle', 0.15); tone(N(103), t + 0.07, 0.4, 'triangle', 0.15); noise(t, 0.1, 0.15, 5000, 2);
        break;
      case 'event': tone(N(79), t, 0.3, 'sine', 0.14); tone(N(86), t + 0.1, 0.4, 'sine', 0.12); break;
      case 'good': [76, 81, 88].forEach((m, i) => tone(N(m), t + i * 0.07, 0.3, 'triangle', 0.14)); break;
      case 'bad': tone(200, t, 0.3, 'sawtooth', 0.05, { to: 120 }); tone(150, t + 0.12, 0.35, 'triangle', 0.15, { to: 90 }); break;
      case 'fumikiri':
        for (let i = 0; i < 6; i++) { tone(i % 2 ? 1250 : 1050, t + i * 0.16, 0.12, 'square', 0.05); tone(i % 2 ? 1250 : 1050, t + i * 0.16, 0.14, 'sine', 0.08); }
        break;
      case 'warp': tone(300, t, 0.5, 'sine', 0.15, { to: 1500 }); noise(t, 0.5, 0.1, 2000, 0.5); break;
      case 'turn': tone(N(84), t, 0.12, 'sine', 0.1); tone(N(91), t + 0.07, 0.16, 'sine', 0.08); break;
      case 'win': {
        const mel = [72, 72, 76, 79, 84, 79, 84, 88];
        mel.forEach((m, i) => { tone(N(m), t + i * 0.16, 0.35, 'triangle', 0.16); tone(N(m - 12), t + i * 0.16, 0.3, 'square', 0.04); });
        [72, 76, 79, 84, 88].forEach((m) => tone(N(m), t + 1.35, 2.0, 'triangle', 0.08, { vib: 5 }));
        break;
      }
      case 'lose': [72, 69, 67, 72].forEach((m, i) => tone(N(m), t + i * 0.22, 0.45, 'triangle', 0.14)); break;
      default: break;
    }
  };

  // ------------------------------------------------------------ BGM（季節ごとの みじかい くりかえし）
  // ことことと 走る 列車の リズムに、季節で かわる 五音音階の 旋律。
  const SCALES = [
    [60, 62, 64, 67, 69, 72, 74, 76], // 春：明るい
    [62, 64, 66, 69, 71, 74, 76, 78], // 夏：高め
    [57, 60, 62, 64, 67, 69, 72, 74], // 秋：おちついた
    [55, 57, 60, 62, 64, 67, 69, 72], // 冬：しずか
  ];
  const BASS = [[48, 45, 41, 43], [50, 47, 43, 45], [45, 41, 43, 40], [43, 40, 36, 38]];
  const TEMPO = [104, 112, 96, 88];
  function makeMelody(s) {
    const rnd = KR.rng(4100 + s * 17);
    const sc = SCALES[s];
    const out = [];
    let idx = 3;
    for (let bar = 0; bar < 8; bar++) {
      for (let b = 0; b < 8; b++) {
        if (bar % 4 === 3 && b >= 4) { out.push(b === 4 ? sc[bar === 7 ? 0 : 2] : -1); continue; }
        if (rnd() < 0.3 && b % 2 === 1) { out.push(-1); continue; }
        idx = KR.clamp(idx + Math.round((rnd() - 0.5) * 3.2), 0, sc.length - 1);
        out.push(sc[idx]);
      }
    }
    return out;
  }
  const MEL = [0, 1, 2, 3].map(makeMelody);
  S.startBgm = function (season) {
    S.season = season || 0;
    if (!S.ctx || S.bgmOn) return;
    S.bgmOn = true;
    S.step = 0; S.next = now() + 0.1;
    S.timer = setInterval(sched, 60);
  };
  S.stopBgm = function () { S.bgmOn = false; clearInterval(S.timer); };
  S.setSeason = function (s) { S.season = s; };
  function sched() {
    if (!S.ctx || !S.bgmOn) return;
    while (S.next < now() + 0.25) {
      const s = S.season;
      const spb = 60 / TEMPO[s] / 2; // 8分音符
      const i = S.step % 64;
      const t = S.next;
      const m = MEL[s][i];
      if (m > 0) {
        tone(N(m), t, spb * 1.8, s === 3 ? 'sine' : 'triangle', 0.16, { out: S.bgm, a: 0.015 });
        if (s === 1) tone(N(m + 12), t, spb * 0.8, 'sine', 0.03, { out: S.bgm });
      }
      if (i % 8 === 0) { const b = BASS[s][Math.floor(i / 16) % 4]; tone(N(b), t, spb * 6, 'triangle', 0.2, { out: S.bgm, a: 0.02 }); }
      if (i % 8 === 4) { const b = BASS[s][Math.floor(i / 16) % 4]; tone(N(b + 7), t, spb * 3, 'triangle', 0.1, { out: S.bgm, a: 0.02 }); }
      // ことこと（線路の リズム）
      if (i % 4 === 0 || i % 4 === 1) noise(t, 0.035, i % 4 === 0 ? 0.05 : 0.035, 2600, 2.5, 'bandpass', S.bgm);
      S.step++; S.next += spb;
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
