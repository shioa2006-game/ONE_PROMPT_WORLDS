/* 賽駆け — 効果音とBGM（Web Audio で合成。外部素材なし） */
(function (root) {
  'use strict';
  let ac = null, master, sfx, bgm, noiseBuf, on = true, bgmOn = true, bgmTimer = null;
  const pluckCache = {};
  try { on = localStorage.getItem('saigake_sound') !== '0'; bgmOn = localStorage.getItem('saigake_bgm') !== '0'; } catch (e) { /* 保存できない環境 */ }

  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ac.destination);
    sfx = ac.createGain(); sfx.gain.value = 0.8; sfx.connect(master);
    bgm = ac.createGain(); bgm.gain.value = bgmOn ? 0.16 : 0; bgm.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startBgm();
    return true;
  }
  const now = () => ac.currentTime;

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone(type, f0, f1, t, dur, peak, dest, att) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, att || 0.004, peak, dur);
    o.connect(g); g.connect(dest || sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, peak, type, freq, q, dest) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 1500; f.Q.value = q || 1;
    const g = ac.createGain(); env(g, t, 0.003, peak, dur);
    s.connect(f); f.connect(g); g.connect(dest || sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  // 琴のような撥弦（カープラス・ストロング法をあらかじめ計算）
  function pluckBuf(freq) {
    const k = Math.round(freq);
    if (pluckCache[k]) return pluckCache[k];
    const sr = ac.sampleRate, len = Math.floor(sr * 1.6);
    const b = ac.createBuffer(1, len, sr), d = b.getChannelData(0);
    const N = Math.max(2, Math.round(sr / freq));
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let p = 0;
    for (let i = 0; i < len; i++) {
      const nx = (p + 1) % N;
      const v = (ring[p] + ring[nx]) * 0.5 * 0.996;
      d[i] = ring[p];
      ring[p] = v; p = nx;
    }
    pluckCache[k] = b;
    return b;
  }
  function pluck(freq, t, vol, dest) {
    const s = ac.createBufferSource(); s.buffer = pluckBuf(freq);
    const g = ac.createGain(); g.gain.value = vol;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200;
    s.connect(f); f.connect(g); g.connect(dest || sfx);
    s.start(t); s.stop(t + 1.6);
  }
  // 都節音階
  const SCALE = [0, 1, 5, 7, 8];
  const note = (deg, base) => { base = base || 293.66; const o = Math.floor(deg / 5), k = ((deg % 5) + 5) % 5; return base * Math.pow(2, o + SCALE[k] / 12); };

  const S = {
    click() { if (!ensure()) return; const t = now(); tone('triangle', 1400, 900, t, 0.04, 0.12); },
    select() { if (!ensure()) return; const t = now(); tone('sine', 880, 1320, t, 0.07, 0.15); noise(t, 0.03, 0.08, 'highpass', 4000); },
    deny() { if (!ensure()) return; const t = now(); tone('square', 160, 120, t, 0.12, 0.06); },
    roll(n) {
      if (!ensure()) return; const t = now();
      let tt = 0;
      for (let i = 0; i < 14; i++) { tt += 0.025 + i * 0.006 + Math.random() * 0.02; noise(t + tt, 0.03, 0.25 + Math.random() * 0.2, 'bandpass', 2400 + Math.random() * 1800, 3); }
      for (let i = 0; i < (n || 3); i++) { const lt = t + 0.62 + i * 0.07; tone('sine', 320, 130, lt, 0.09, 0.35); noise(lt, 0.05, 0.35, 'bandpass', 1300, 2); }
    },
    land() { if (!ensure()) return; const t = now(); tone('sine', 300, 120, t, 0.09, 0.3); noise(t, 0.04, 0.3, 'bandpass', 1200, 2); },
    step(i) {
      if (!ensure()) return; const t = now();
      const f = 520 + Math.min(10, i || 0) * 45;
      tone('sine', f, f * 0.7, t, 0.07, 0.22); noise(t, 0.03, 0.12, 'bandpass', 900, 1.5);
    },
    march() { if (!ensure()) return; const t = now(); noise(t, 0.08, 0.1, 'lowpass', 400, 0.7); },
    drum(v) { if (!ensure()) return; const t = now(); tone('sine', 110, 42, t, 0.45, 0.7 * (v || 1)); noise(t, 0.12, 0.25 * (v || 1), 'lowpass', 300, 0.7); },
    clash() {
      if (!ensure()) return; const t = now();
      noise(t, 0.12, 0.35, 'bandpass', 3200, 4); tone('square', 980, 760, t, 0.08, 0.06); tone('square', 1320, 990, t + 0.03, 0.08, 0.05);
    },
    win() { if (!ensure()) return; const t = now(); [0, 2, 3, 5, 7].forEach((d, i) => pluck(note(d + 5), t + i * 0.07, 0.5)); },
    big() { if (!ensure()) return; const t = now(); [0, 3, 5, 7, 10, 12].forEach((d, i) => pluck(note(d + 3), t + i * 0.06, 0.55)); this.drum(1); },
    lose() { if (!ensure()) return; const t = now(); [7, 5, 3, 1].forEach((d, i) => pluck(note(d, 196), t + i * 0.12, 0.45)); },
    fall() {
      if (!ensure()) return; const t = now();
      noise(t, 1.1, 0.5, 'lowpass', 220, 0.8);
      tone('sine', 95, 38, t, 0.7, 0.8);
      [180, 254, 331, 467].forEach((f, i) => tone('sine', f, f * 0.98, t + 0.02, 1.6 - i * 0.2, 0.12));
    },
    capture() { if (!ensure()) return; const t = now(); [5, 7, 10].forEach((d, i) => pluck(note(d), t + i * 0.05, 0.5)); },
    heal() { if (!ensure()) return; const t = now(); pluck(note(10), t, 0.25); pluck(note(12), t + 0.08, 0.2); },
    horn() {
      if (!ensure()) return; const t = now();
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(185, t); o.frequency.linearRampToValueAtTime(208, t + 0.35); o.frequency.linearRampToValueAtTime(196, t + 1.2);
      lfo.frequency.value = 5.5; lg.gain.value = 3; lfo.connect(lg); lg.connect(o.frequency);
      f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 2;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.25); g.gain.linearRampToValueAtTime(0.12, t + 1.0); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(f); f.connect(g); g.connect(sfx);
      o.start(t); lfo.start(t); o.stop(t + 1.5); lfo.stop(t + 1.5);
    },
    ambush() { if (!ensure()) return; const t = now(); noise(t, 0.25, 0.3, 'highpass', 2500, 1); [12, 10, 7].forEach((d, i) => pluck(note(d), t + 0.05 + i * 0.04, 0.4)); },
  };

  // BGM：まばらな琴の旋律と低い持続音
  function startBgm() {
    if (bgmTimer) return;
    let deg = 5, bar = 0;
    const drone = () => {
      const t = now();
      [146.83, 220].forEach(f => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 2); g.gain.linearRampToValueAtTime(0.0001, t + 7.8);
        o.connect(g); g.connect(bgm); o.start(t); o.stop(t + 8);
      });
    };
    const tick = () => {
      if (!ac) return;
      const t = now() + 0.05;
      if (bar % 16 === 0) drone();
      const r = Math.random();
      if (r < 0.62) {
        deg += [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)];
        deg = Math.max(0, Math.min(11, deg));
        pluck(note(deg), t, 0.33, bgm);
        if (Math.random() < 0.18) pluck(note(deg + 5), t + 0.22, 0.18, bgm);
      }
      if (bar % 8 === 7 && Math.random() < 0.5) pluck(note(deg - 5), t, 0.25, bgm);
      bar++;
    };
    bgmTimer = setInterval(tick, 460);
  }

  const A = {
    ensure, S,
    get on() { return on; }, get bgmOn() { return bgmOn; },
    setOn(v) { on = v; try { localStorage.setItem('saigake_sound', v ? '1' : '0'); } catch (e) { /* 無視 */ } if (master) master.gain.value = v ? 0.9 : 0; },
    setBgm(v) { bgmOn = v; try { localStorage.setItem('saigake_bgm', v ? '1' : '0'); } catch (e) { /* 無視 */ } if (bgm) bgm.gain.value = v ? 0.16 : 0; },
  };
  root.SG = root.SG || {}; root.SG.A = A;
})(window);
