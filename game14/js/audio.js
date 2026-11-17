/*
 * game14/js/audio.js - procedural sound for a Sengoku-era (1560) dice-and-conquest game.
 * Pure Web Audio API synthesis: no audio files, no libraries, no network.
 * Classic script (no modules), so it works from file://. Exposes window.Sound.
 *
 *   Sound.unlock()                 create/resume the AudioContext (call from a user gesture; idempotent).
 *                                  Any pointer/key/touch gesture on the page also unlocks automatically.
 *   Sound.play(name, opts)         opts {vol:1, rate:1, n:1, big:false}; ignored before unlock or while muted
 *   Sound.startBgm(mode)           'title' | 'map' | 'end'; crossfades; remembered if called before unlock
 *   Sound.stopBgm(fadeSeconds)
 *   Sound.setMaster(v) / setSfx(v) / setBgm(v)    0..1, persisted in localStorage
 *   Sound.setMuted(bool) / isMuted() / getSettings()
 *   Sound.names                    list of SFX names
 *   Sound._renderOffline(name | 'bgm:<mode>', seconds, opts)   QA: render through the full chain offline
 *   Sound._bgmPlan(mode, bars, seed)                           QA: generated BGM bar events (no audio)
 * Nothing here throws: every entry point is guarded and returns false/undefined on failure.
 * All audio is paused while the tab is hidden and resumed when it is visible again.
 *
 * Graph: voices -> sfx / bgm buses (+ shared convolution reverb, bgm ducking)
 *        -> glue compressor -> limiter -> soft-clip safety -> master gain -> destination
 */
(function (root) {
  'use strict';

  var AC = root.AudioContext || root.webkitAudioContext || null;
  var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext || null;
  var STORE_KEY = 'game14.sengoku.sound.v1';
  var DEF = { master: 0.8, sfx: 0.9, bgm: 0.45, muted: false };
  var settings = { master: DEF.master, sfx: DEF.sfx, bgm: DEF.bgm, muted: DEF.muted };
  var LOOKAHEAD = 0.3, TICK_MS = 100;

  function num(v, d, lo, hi) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return d;
    v = +v;
    if (v !== v || v === Infinity || v === -Infinity) return d;
    return v < lo ? lo : (v > hi ? hi : v);
  }
  function loadSettings() {
    try {
      var ls = root.localStorage, s = ls ? ls.getItem(STORE_KEY) : null, o = s ? JSON.parse(s) : null;
      if (!o || typeof o !== 'object') return;
      settings.master = num(o.master, DEF.master, 0, 1);
      settings.sfx = num(o.sfx, DEF.sfx, 0, 1);
      settings.bgm = num(o.bgm, DEF.bgm, 0, 1);
      settings.muted = o.muted === true;
    } catch (e) { /* storage blocked or corrupt: keep defaults */ }
  }
  function saveSettings() {
    try { if (root.localStorage) root.localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }

  // PRNGs (mulberry32). R: musical/performance randomness (seedable for QA).
  // RB: buffer synthesis, re-seeded from each cache key so every sample bank is identical whatever the play order.
  var seed = (Date.now() >>> 0) ^ 0x5bd1e995, bseed = 1;
  function mb32(s) {
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function R() { seed = (seed + 0x6D2B79F5) >>> 0; return mb32(seed); }
  function RB() { bseed = (bseed + 0x6D2B79F5) >>> 0; return mb32(bseed); }
  function rr(a, b) { return a + (b - a) * R(); }
  function ri(n) { return Math.floor(R() * n) % n; }
  function pick(a) { return a[ri(a.length)]; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // Scales (semitones above the tonic)
  var YO = [0, 2, 5, 7, 9];       // 陽旋法 (yo / minyo-ish), e.g. D E G A B
  var MIYAKO = [0, 1, 5, 7, 8];   // 都節 / 陰旋法 (in / miyako-bushi), e.g. E F A B C
  function deg(tonic, sc, d) {
    var n = sc.length, o = Math.floor(d / n);
    return tonic + 12 * o + sc[d - o * n];
  }

  // ---------------------------------------------------------------- buffers (synthesised once per sample rate)
  var CACHE = {};
  function cached(c, key, build) {
    var bank = CACHE[c.sampleRate] || (CACHE[c.sampleRate] = {}), h = 2166136261, i;
    if (!bank[key]) {
      for (i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
      bseed = h >>> 0;
      bank[key] = build(c);
    }
    return bank[key];
  }
  function mkBuf(c, ch, len) { return c.createBuffer(ch, Math.max(1, len | 0), c.sampleRate); }

  function noiseBuffer(c) {
    return cached(c, 'noise', function (c) {
      var b = mkBuf(c, 1, c.sampleRate * 2), d = b.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = RB() * 2 - 1;
      return b;
    });
  }

  // Small dark hall: decaying filtered noise + a few early reflections, energy-normalised (T60 ~1.7 s).
  function reverbIR(c) {
    return cached(c, 'ir', function (c) {
      var sr = c.sampleRate, len = Math.floor(sr * 1.7), pre = Math.floor(sr * 0.012), b = mkBuf(c, 2, len);
      for (var ch = 0; ch < 2; ch++) {
        var d = b.getChannelData(ch), lp = 0, e2 = 0, i, t;
        for (i = pre; i < len; i++) {
          t = (i - pre) / sr;
          lp += (0.72 * Math.exp(-t * 2.4) + 0.07) * ((RB() * 2 - 1) - lp);
          d[i] = lp * Math.exp(-t * 4.0);
        }
        for (i = 0; i < 6; i++) d[pre + Math.floor(sr * (0.006 + 0.049 * RB()))] += (RB() < 0.5 ? -1 : 1) * (0.15 + 0.2 * RB());
        for (i = 0; i < len; i++) e2 += d[i] * d[i];
        var g = 1 / Math.sqrt(e2 || 1);
        for (i = 0; i < len; i++) d[i] *= g;
      }
      return b;
    });
  }

  // Soft-clip safety curve after the limiter: linear to 0.85, then tanh saturation; max output ~0.96.
  function clipCurve() {
    var n = 4096, cv = new Float32Array(n), knee = 0.85, span = 0.99 - knee;
    for (var i = 0; i < n; i++) {
      var x = i * 2 / (n - 1) - 1, ax = x < 0 ? -x : x;
      var y = ax <= knee ? ax : knee + span * Math.tanh((ax - knee) / span);
      cv[i] = x < 0 ? -y : y;
    }
    return cv;
  }

  // Koto: Karplus-Strong plucked string rendered into a buffer. One buffer per "anchor" pitch
  // (every 3 semitones); other pitches are reached with playbackRate (max +-1.5 semitones).
  function kotoBuf(c, anchor) {
    return cached(c, 'k:' + anchor, function (c) {
      var sr = c.sampleRate, N = Math.max(8, Math.round(sr / mtof(anchor) - 0.5)), fa = sr / (N + 0.5);
      var dur = Math.max(1.2, Math.min(2.8, 2.4 * Math.pow(196 / fa, 0.4)));
      var len = Math.floor(sr * dur), b = mkBuf(c, 1, len), out = b.getChannelData(0);
      var ex = new Float32Array(N), tmp = new Float32Array(N), i, lp = 0, mean = 0, x;
      for (i = 0; i < N; i++) { lp += 0.5 * ((RB() * 2 - 1) - lp); tmp[i] = lp; mean += lp; }
      mean /= N;
      var P = Math.max(1, Math.round(N * 0.13));          // pluck near the bridge (tsume)
      for (i = 0; i < N; i++) ex[i] = (tmp[i] - mean) - 0.8 * (tmp[(i - P + N) % N] - mean);
      var T60 = Math.max(0.8, Math.min(3.0, 2.3 * Math.sqrt(220 / fa))), rho = Math.pow(0.001, 1 / (fa * T60));
      var idx = 0, prev = 0;
      for (i = 0; i < len; i++) {
        x = ex[idx]; out[i] = x;
        ex[idx] = rho * 0.5 * (x + prev); prev = x;
        if (++idx >= N) idx = 0;
      }
      var kn = Math.min(len, Math.floor(sr * 0.006));      // plectrum attack noise
      for (i = 0; i < kn; i++) out[i] += 0.3 * (RB() * 2 - 1) * Math.exp(-i / (sr * 0.0012));
      var x1 = 0, y1 = 0, pk = 1e-9, y, a;
      for (i = 0; i < len; i++) {                           // DC blocker + peak
        x = out[i]; y = x - x1 + 0.995 * y1; x1 = x; y1 = y; out[i] = y;
        a = y < 0 ? -y : y; if (a > pk) pk = a;
      }
      var g = 0.9 / pk, fl = Math.floor(sr * 0.1);
      for (i = 0; i < len; i++) out[i] *= (i > len - fl) ? g * (len - i) / fl : g;
      return { b: b, f: fa };
    });
  }

  // Modal impacts: exponentially decaying partials (optional downward bend) + short noise click.
  // m: [freq, amp, tau(s), bend]; k: [clickAmp, clickMs, lowpassCoef]
  var MODAL = {
    tick:  { d: 0.06, m: [[2650, 1, 0.009], [4250, 0.45, 0.005], [6900, 0.2, 0.003]], k: [0.5, 0.3] },
    clack: { d: 0.18, m: [[2150, 1, 0.028], [2330, 0.7, 0.024], [5900, 0.35, 0.009], [6450, 0.2, 0.007]], k: [0.7, 0.35] },
    hyo:   { d: 0.4, m: [[1830, 1, 0.07], [1990, 0.85, 0.06], [5050, 0.45, 0.028], [5480, 0.32, 0.022], [9700, 0.12, 0.009]], k: [0.9, 0.45] },
    soft:  { d: 0.18, m: [[1150, 1, 0.032], [1290, 0.55, 0.026], [3200, 0.16, 0.009]], k: [0.3, 0.9, 0.3] },
    knock: { d: 0.26, m: [[175, 1, 0.05, 0.35], [410, 0.75, 0.036], [790, 0.35, 0.02], [1350, 0.12, 0.01]], k: [0.5, 2.2, 0.1] },
    seal:  { d: 0.5, m: [[82, 1, 0.1, 0.8], [172, 0.6, 0.065, 0.5], [370, 0.35, 0.035], [830, 0.16, 0.018], [1700, 0.07, 0.008]], k: [0.6, 3.5, 0.07] }
  };
  function jit(f) { return f * (0.88 + 0.24 * RB()); }
  function variant(kind) {
    switch (kind) {
      case 'die': return { d: 0.16, m: [[jit(430), 0.5, 0.03], [jit(1080), 0.6, 0.02], [jit(1960), 0.45, 0.013], [jit(3350), 0.55, 0.008], [jit(5250), 0.4, 0.005], [jit(7700), 0.22, 0.0035]], k: [0.9, 0.3] };
      case 'dd': return { d: 0.07, m: [[jit(4200), 0.8, 0.007], [jit(6150), 0.5, 0.0045], [jit(8900), 0.3, 0.003]], k: [0.6, 0.25] };
      case 'cup': return { d: 0.1, m: [[jit(720), 0.8, 0.017], [jit(1380), 0.5, 0.012], [jit(2650), 0.35, 0.007]], k: [0.4, 0.5, 0.5] };
      case 'coin': return { d: 0.5, m: [[jit(3050), 1, 0.16], [jit(4550), 0.6, 0.11], [jit(6750), 0.4, 0.07], [jit(8250), 0.25, 0.045], [jit(1500), 0.15, 0.03]], k: [0.35, 0.3] };
      case 'metal': return { d: 1.0, m: [[jit(1520), 0.7, 0.3], [jit(2290), 0.9, 0.24], [jit(3470), 0.7, 0.17], [jit(5080), 0.5, 0.12], [jit(6900), 0.35, 0.08], [jit(9100), 0.2, 0.05]], k: [0.6, 0.6] };
    }
    return MODAL.tick;
  }
  function renderModal(c, sp) {
    var sr = c.sampleRate, len = Math.floor(sr * sp.d), b = mkBuf(c, 1, len), d = b.getChannelData(0), i, j;
    for (j = 0; j < sp.m.length; j++) {
      var md = sp.m[j];
      if (md[0] > sr * 0.45) continue;
      var w = 2 * Math.PI * md[0] / sr, amp = md[1], dk = Math.exp(-1 / (md[2] * sr));
      var bend = md[3] || 0, bk = Math.exp(-1 / (0.015 * sr)), ph = 0;
      for (i = 0; i < len && amp > 1e-5; i++) { d[i] += amp * Math.sin(ph); ph += w * (1 + bend); bend *= bk; amp *= dk; }
    }
    if (sp.k) {
      var kt = sp.k[1] * sr / 1000, kl = sp.k[2] || 1, lp = 0, kn = Math.min(len, Math.ceil(kt * 8));
      for (i = 0; i < kn; i++) { lp += kl * ((RB() * 2 - 1) - lp); d[i] += sp.k[0] * lp * Math.exp(-i / kt); }
    }
    var pk = 1e-9, a;
    for (i = 0; i < len; i++) { a = d[i] < 0 ? -d[i] : d[i]; if (a > pk) pk = a; }
    var g = 1 / pk, fl = Math.min(len, Math.ceil(sr * 0.005));
    for (i = 0; i < len; i++) d[i] *= g;
    for (i = 0; i < fl; i++) d[len - 1 - i] *= i / fl;
    return b;
  }
  function smpBuf(c, key) {
    return cached(c, 'm:' + key, function (c) { return renderModal(c, MODAL[key] || variant(key.replace(/\d+$/, ''))); });
  }

  // Pre-rendered drums for the BGM loops (1 buffer source per hit instead of ~8 live nodes).
  // Same recipe as taiko()/tsuzumi() below: swept membrane + overtone + filtered stick/palm noise.
  function drumBuf(c, kind) {
    return cached(c, 'drum:' + kind, function (c) {
      var sr = c.sampleRate, tk = kind === 'taiko', f = tk ? 80 : 300, dur = tk ? 1.3 : 0.6, TWO_PI = 2 * Math.PI;
      var len = Math.floor(sr * dur), b = mkBuf(c, 1, len), d = b.getChannelData(0);
      var i, t, f1, f2, a1, a2, ph1 = 0, ph2 = 0, lpA = 0, lpB = 0, x;
      for (i = 0; i < len; i++) {
        t = i / sr; x = RB() * 2 - 1;
        if (tk) {
          f1 = t < 0.045 ? f * 2.2 * Math.pow(1 / 2.2, t / 0.045) : f * Math.pow(0.88, (t - 0.045) / (dur - 0.045));
          f2 = t < 0.04 ? f * 2.4 * Math.pow(1.6 / 2.4, t / 0.04) : f * 1.6;
          a1 = t < 0.003 ? t / 0.003 : Math.exp(-(t - 0.003) / (dur * 0.18));
          a2 = 0.3 * (t < 0.002 ? t / 0.002 : Math.exp(-(t - 0.002) / (dur * 0.08)));
          lpA += 0.13 * (x - lpA);                                  // ~1 kHz stick noise
          d[i] = a1 * Math.sin(ph1) + a2 * (2 / Math.PI) * Math.asin(Math.sin(ph2)) + 0.4 * lpA * 2.2 * Math.exp(-t / 0.018);
        } else {
          f1 = t < 0.035 ? f * 1.32 * Math.pow(1 / 1.32, t / 0.035) : f * (0.96 + 0.04 * Math.exp(-Math.max(0, t - 0.05) / 0.15));
          f2 = f * 2.02;
          a1 = t < 0.003 ? t / 0.003 : Math.exp(-(t - 0.003) / 0.11);
          a2 = 0.22 * (t < 0.002 ? t / 0.002 : Math.exp(-(t - 0.002) / 0.045));
          lpA += 0.5 * (x - lpA); lpB += 0.15 * (x - lpB);         // ~1-5 kHz palm slap band
          d[i] = a1 * Math.sin(ph1) + a2 * Math.sin(ph2) + 0.45 * (lpA - lpB) * 2 * Math.exp(-t / 0.012);
        }
        ph1 += TWO_PI * f1 / sr; ph2 += TWO_PI * f2 / sr;
      }
      var fl = Math.floor(sr * 0.02);                             // natural level (matches the live-node version)
      for (i = len - fl; i < len; i++) d[i] *= (len - i) / fl;
      return { b: b, f: f };
    });
  }

  // ---------------------------------------------------------------- engine (one per context; also built offline for QA)
  function ap(p, v) { try { p.value = v; } catch (e) { /* ignore */ } }
  function gn(c, v, dst) { var g = c.createGain(); g.gain.value = v; if (dst) g.connect(dst); return g; }

  function Engine(c, offline, st) {
    st = st || settings;
    this.c = c; this.offline = !!offline; this.nyq = c.sampleRate / 2;
    this.noise = noiseBuffer(c);
    // DynamicsCompressorNode adds its own makeup gain (~+4.2 dB glue, ~+1.7 dB limiter): pre-trim by -6 dB.
    var mix = this.mix = gn(c, 0.5);
    var comp = c.createDynamicsCompressor(), lim = c.createDynamicsCompressor(), sh = c.createWaveShaper();
    ap(comp.threshold, -14); ap(comp.knee, 10); ap(comp.ratio, 2); ap(comp.attack, 0.006); ap(comp.release, 0.25);
    ap(lim.threshold, -3); ap(lim.knee, 0); ap(lim.ratio, 20); ap(lim.attack, 0.002); ap(lim.release, 0.15);
    sh.curve = clipCurve(); sh.oversample = 'none';
    this.master = gn(c, st.muted ? 0 : st.master, c.destination);
    if (st.raw) mix.connect(gn(c, 1.97, this.master));   // QA only: bypass dynamics (same nominal gain) to measure limiting
    else { mix.connect(comp); comp.connect(lim); lim.connect(sh); sh.connect(this.master); }
    var conv = this.conv = c.createConvolver();
    conv.normalize = false; conv.buffer = reverbIR(c);
    conv.connect(gn(c, 0.3, mix));
    this.sfxDry = gn(c, st.sfx, mix); this.sfxWet = gn(c, st.sfx, conv);
    this.duckD = gn(c, 1, mix); this.duckW = gn(c, 1, conv);
    this.bgmDry = gn(c, st.bgm, this.duckD); this.bgmWet = gn(c, st.bgm, this.duckW);
  }

  // A voice is one sound event: gain(vol) -> dry bus, plus a reverb send.
  function voice(E, dry, wet, vol, wetAmt, rate) {
    var c = E.c, out = gn(c, vol, dry), ws = wetAmt > 0 ? gn(c, wetAmt, wet) : null;
    if (ws) out.connect(ws);
    return { E: E, c: c, out: out, ws: ws, rate: rate || 1 };
  }

  // ---------------------------------------------------------------- synthesis primitives
  function fq(v, f) { var n = v.E.nyq * 0.9; return f < 20 ? 20 : (f > n ? n : f); }
  function hz(v, f) { return fq(v, f * v.rate); }
  function osc0(c, type, f) { var o = c.createOscillator(); o.type = type; o.frequency.value = f; return o; }
  function osc(v, type, f) { return osc0(v.c, type, hz(v, f)); }
  function filt(v, type, f, q) {
    var b = v.c.createBiquadFilter(); b.type = type; b.frequency.value = fq(v, f);
    if (q != null) b.Q.value = q;
    return b;
  }
  // 0 -> peak in `a` seconds, then exponential decay with time-constant tau
  function perc(p, t, a, peak, tau) { p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a); p.setTargetAtTime(0, t + a, tau); }
  function noise(v, t, dur) {
    var s = v.c.createBufferSource(); s.buffer = v.E.noise; s.loop = true;
    s.start(t, R() * 1.5); s.stop(t + dur + 0.02);
    return s;
  }
  function vk(kind, n) { return kind + ri(n); }

  // pre-rendered modal impact (dice, wood, coins, metal)
  function smp(v, t, key, vol, rate, dst) {
    var c = v.c, b = smpBuf(c, key), s = c.createBufferSource(), r = (rate || 1) * v.rate;
    s.buffer = b; s.playbackRate.value = r; s.connect(gn(c, vol, dst || v.out)); s.start(t);
    return t + b.duration / r;
  }

  // taiko / drum: membrane with a downward pitch sweep, second mode, stick noise
  function taiko(v, t, o) {
    var c = v.c, f = o.f || 80, vel = o.v == null ? 1 : o.v, dur = o.d || 1, dst = o.dst || v.out;
    var b = osc(v, 'sine', f * 2.2), g = gn(c, 0, dst);
    b.frequency.setValueAtTime(hz(v, f * 2.2), t);
    b.frequency.exponentialRampToValueAtTime(hz(v, f), t + 0.045);
    b.frequency.exponentialRampToValueAtTime(hz(v, f * 0.88), t + dur);
    perc(g.gain, t, 0.003, vel, dur * 0.18);
    b.connect(g); b.start(t); b.stop(t + dur + 0.05);
    var b2 = osc(v, 'triangle', f * 2.4), g2 = gn(c, 0, dst);
    b2.frequency.setValueAtTime(hz(v, f * 2.4), t);
    b2.frequency.exponentialRampToValueAtTime(hz(v, f * 1.6), t + 0.04);
    perc(g2.gain, t, 0.002, vel * 0.3, dur * 0.08);
    b2.connect(g2); b2.start(t); b2.stop(t + dur * 0.6 + 0.05);
    var n = noise(v, t, 0.12), lp = filt(v, 'lowpass', 1400 * (o.br || 1), 0.8), g3 = gn(c, 0, dst);
    perc(g3.gain, t, 0.001, vel * (o.sk == null ? 0.55 : o.sk), 0.018);
    n.connect(lp); lp.connect(g3);
    return t + dur;
  }

  // ko-tsuzumi 'pon': resonant hand drum with a quick pitch inflection and a palm slap
  function tsuzumi(v, t, o) {
    var c = v.c, f = o.f || 300, vel = o.v == null ? 0.8 : o.v, dur = o.d || 0.45, dst = o.dst || v.out;
    var a = osc(v, 'sine', f * 1.32), g = gn(c, 0, dst);
    a.frequency.setValueAtTime(hz(v, f * 1.32), t);
    a.frequency.exponentialRampToValueAtTime(hz(v, f), t + 0.035);
    a.frequency.setTargetAtTime(hz(v, f * 0.96), t + 0.05, 0.15);
    perc(g.gain, t, 0.003, vel, dur * 0.25);
    a.connect(g); a.start(t); a.stop(t + dur + 0.05);
    var h = osc(v, 'sine', f * 2.02), g2 = gn(c, 0, dst);
    perc(g2.gain, t, 0.002, vel * 0.22, dur * 0.1);
    h.connect(g2); h.start(t); h.stop(t + dur * 0.6);
    var n = noise(v, t, 0.06), bp = filt(v, 'bandpass', 2200, 0.9), g3 = gn(c, 0, dst);
    perc(g3.gain, t, 0.001, vel * 0.45, 0.012);
    n.connect(bp); bp.connect(g3);
    return t + dur;
  }

  // koto note (Karplus-Strong buffer); o.b = bend (oshide) in semitones
  function koto(v, t, m, o) {
    o = o || {};
    var c = v.c, kb = kotoBuf(c, Math.round(m / 3) * 3), r = mtof(m) * v.rate / kb.f;
    var s = c.createBufferSource(), vel = o.v == null ? 0.6 : o.v;
    var len = Math.min(o.d || 9, kb.b.duration / r), g = gn(c, 0, o.dst || v.out);
    s.buffer = kb.b; s.playbackRate.value = r;
    if (o.b) {
      s.playbackRate.setValueAtTime(r, t + 0.1);
      s.playbackRate.linearRampToValueAtTime(r * Math.pow(2, o.b / 12), t + 0.28);
    }
    g.gain.setValueAtTime(vel, t);
    g.gain.setTargetAtTime(0, t + len * 0.55, len * 0.09);
    s.connect(g); s.start(t); s.stop(t + len);
    return t + len;
  }

  // shakuhachi-like breathy tone: scoop up (meri -> kari), delayed vibrato, pitched breath noise
  function shaku(v, t, m, len, o) {
    o = o || {};
    var c = v.c, f = mtof(m), vel = o.v == null ? 0.5 : o.v, dst = o.dst || v.out, end = t + len + 0.45, i;
    var a = osc(v, 'sine', f), b = osc(v, 'triangle', f), fr = [a.frequency, b.frequency];
    var sc = Math.pow(2, -(o.sc == null ? 0.6 : o.sc) / 12);
    for (i = 0; i < 2; i++) {
      fr[i].setValueAtTime(hz(v, f * sc), t);
      fr[i].exponentialRampToValueAtTime(hz(v, f), t + 0.16);
      if (o.fall) {
        fr[i].setValueAtTime(hz(v, f), t + Math.max(0.17, len - 0.05));
        fr[i].exponentialRampToValueAtTime(hz(v, f * Math.pow(2, -o.fall / 12)), t + len + 0.35);
      }
    }
    var l = osc0(c, 'sine', rr(4.6, 5.6)), lg = gn(c, 0);
    l.connect(lg); lg.connect(a.frequency); lg.connect(b.frequency);
    lg.gain.setValueAtTime(0, t + Math.min(0.5, len * 0.4));
    lg.gain.linearRampToValueAtTime(hz(v, f) * 0.011, t + Math.max(len * 0.85, 0.6));
    var lp = filt(v, 'lowpass', Math.min(hz(v, f) * 5, 6000), 0), tone = gn(c, 0, lp);
    lp.connect(dst);
    a.connect(gn(c, 0.8, tone)); b.connect(gn(c, 0.16, tone));
    tone.gain.setValueAtTime(0, t);
    tone.gain.linearRampToValueAtTime(vel * 0.75, t + 0.12);
    tone.gain.linearRampToValueAtTime(vel, t + Math.max(0.2, len * 0.6));
    tone.gain.setTargetAtTime(0, t + len, 0.09);
    var br = o.br == null ? 1 : o.br, n = noise(v, t, len + 0.45);
    var bp = filt(v, 'bandpass', hz(v, f), 7), hp = filt(v, 'highpass', 2600, 0), gb = gn(c, 0, dst), gh = gn(c, 0, dst);
    n.connect(bp); bp.connect(gb); n.connect(hp); hp.connect(gh);
    gb.gain.setValueAtTime(0, t); gb.gain.linearRampToValueAtTime(vel * 1.6 * br, t + 0.05);
    gb.gain.setTargetAtTime(vel * 0.5 * br, t + 0.06, 0.12); gb.gain.setTargetAtTime(0, t + len, 0.08);
    gh.gain.setValueAtTime(0, t); gh.gain.linearRampToValueAtTime(vel * 0.1 * br, t + 0.04);
    gh.gain.setTargetAtTime(vel * 0.03 * br, t + 0.08, 0.1); gh.gain.setTargetAtTime(0, t + len, 0.06);
    a.start(t); b.start(t); l.start(t); a.stop(end); b.stop(end); l.stop(end);
    return end;
  }

  // 法螺貝 conch horn: brassy saw/square through moving lowpass + formants, breath noise, pitch scoop/drop
  function conch(v, t, len, o) {
    o = o || {};
    var c = v.c, f = o.f || 220, vel = o.v == null ? 0.7 : o.v, dst = o.dst || v.out, end = t + len + 0.4, i;
    var a = osc(v, 'sawtooth', f), b = osc(v, 'square', f), fr = [a.frequency, b.frequency];
    for (i = 0; i < 2; i++) {
      var ff = f * (i ? 1.004 : 1);
      fr[i].setValueAtTime(hz(v, ff * 0.8), t);
      fr[i].exponentialRampToValueAtTime(hz(v, ff), t + 0.16);
      fr[i].setValueAtTime(hz(v, ff), t + Math.max(0.17, len * 0.75));
      fr[i].exponentialRampToValueAtTime(hz(v, ff * 0.84), t + len + 0.3);
    }
    var l = osc0(c, 'sine', 5.3), lg = gn(c, hz(v, f) * 0.008);
    l.connect(lg); lg.connect(a.frequency); lg.connect(b.frequency);
    var lp = filt(v, 'lowpass', 500, 1.5), f1 = filt(v, 'peaking', 640, 2.2), f2 = filt(v, 'peaking', 1350, 3);
    f1.gain.value = 7; f2.gain.value = 5;
    lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(1900, t + 0.14);
    lp.frequency.linearRampToValueAtTime(1300, t + len * 0.6); lp.frequency.linearRampToValueAtTime(520, t + len + 0.3);
    var mx = gn(c, 1, lp), amp = gn(c, 0, dst);
    a.connect(gn(c, 0.55, mx)); b.connect(gn(c, 0.22, mx));
    lp.connect(f1); f1.connect(f2); f2.connect(amp);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(vel, t + 0.14);
    amp.gain.linearRampToValueAtTime(vel * 0.85, t + len * 0.5); amp.gain.linearRampToValueAtTime(vel * 0.95, t + len * 0.8);
    amp.gain.setTargetAtTime(0, t + len, 0.09);
    var n = noise(v, t, len + 0.4), bp = filt(v, 'bandpass', 1100, 0.7), gz = gn(c, 0, dst);
    n.connect(bp); bp.connect(gz);
    gz.gain.setValueAtTime(0, t); gz.gain.linearRampToValueAtTime(vel * 0.5, t + 0.05);
    gz.gain.setTargetAtTime(vel * 0.16, t + 0.07, 0.1); gz.gain.setTargetAtTime(0, t + len, 0.08);
    a.start(t); b.start(t); l.start(t); a.stop(end); b.stop(end); l.stop(end);
    return end;
  }

  // small bell / chime (rin): inharmonic partials, beating fundamental pair, strike tick
  var BELL = [[1, 1, 0.32], [2.71, 0.45, 0.18], [5.15, 0.22, 0.1], [8.1, 0.1, 0.06]];
  function bell(v, t, f, o) {
    o = o || {};
    var c = v.c, vel = o.v == null ? 0.5 : o.v, len = o.d || 1.6, dst = o.dst || v.out, i, k;
    for (i = 0; i < BELL.length; i++) {
      var fi = hz(v, f * BELL[i][0]), tau = len * BELL[i][2];
      if (fi >= v.E.nyq * 0.85) break;
      for (k = 0; k < (i ? 1 : 2); k++) {
        var s = osc0(c, 'sine', fi + (k ? rr(0.8, 2.2) : 0)), g = gn(c, 0, dst);
        perc(g.gain, t, 0.002, vel * BELL[i][1] * (i ? 1 : 0.6), tau);
        s.connect(g); s.start(t); s.stop(t + Math.min(len, tau * 7) + 0.02);
      }
    }
    var n = noise(v, t, 0.03), hp = filt(v, 'highpass', 5000, 0), gs = gn(c, 0, dst);
    perc(gs.gain, t, 0.0005, vel * 0.25, 0.004);
    n.connect(hp); hp.connect(gs);
    return t + len;
  }

  // 梵鐘 temple bell: soft log strike, inharmonic partials in detuned pairs (うなり beating), long decay
  var BON = [[0.5, 0.4, 3.2], [1, 0.75, 2.6], [1.21, 0.42, 2.1], [1.52, 0.38, 1.7], [2.03, 0.32, 1.25],
             [2.48, 0.22, 1.0], [2.97, 0.18, 0.8], [3.56, 0.11, 0.6], [4.3, 0.07, 0.45]];
  function templeBell(v, t, o) {
    o = o || {};
    var c = v.c, f = o.f || 98, vel = o.v == null ? 0.8 : o.v, len = o.d || 4.2, dst = o.dst || v.out, i, k;
    for (i = 0; i < BON.length; i++) {
      var fi = hz(v, f * BON[i][0]), tau = BON[i][2] * len / 4.2;
      for (k = 0; k < 2; k++) {
        var s = osc0(c, 'sine', fi + (k ? rr(0.4, 1.6) * (1 + i * 0.15) : 0)), g = gn(c, 0, dst);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vel * BON[i][1] * 0.5, t + 0.012);
        g.gain.setTargetAtTime(0, t + 0.012, tau);
        g.gain.setTargetAtTime(0, t + len - 0.7, 0.15);
        s.connect(g); s.start(t); s.stop(t + len + 0.05);
      }
    }
    var n = noise(v, t, 0.3), lp = filt(v, 'lowpass', 320, 0.8), gt = gn(c, 0, dst);
    perc(gt.gain, t, 0.004, vel * 0.9, 0.05);
    n.connect(lp); lp.connect(gt);
    var th = osc(v, 'sine', 62), gh = gn(c, 0, dst);
    perc(gh.gain, t, 0.004, vel * 0.6, 0.12);
    th.connect(gh); th.start(t); th.stop(t + 0.9);
    return t + len;
  }

  // 銅鑼 gong: partials settle slightly downward, noisy shimmer swell, mallet thud
  var GONG = [[1, 1, 1.0], [1.47, 0.62, 0.8], [1.98, 0.5, 0.7], [2.53, 0.4, 0.55], [3.18, 0.3, 0.45],
              [3.84, 0.24, 0.37], [4.62, 0.17, 0.3], [5.6, 0.12, 0.22]];
  function gong(v, t, o) {
    o = o || {};
    var c = v.c, f = o.f || 140, vel = o.v == null ? 0.7 : o.v, len = o.d || 2.6, dst = o.dst || v.out;
    for (var i = 0; i < GONG.length; i++) {
      var fi = hz(v, f * GONG[i][0]);
      if (fi > v.E.nyq * 0.85) break;
      var s = osc0(c, 'sine', fi * 1.025), g = gn(c, 0, dst);
      s.frequency.setTargetAtTime(fi, t, 0.25);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel * GONG[i][1] * 0.42, t + 0.006 + i * 0.004);
      g.gain.setTargetAtTime(0, t + 0.01 + i * 0.004, GONG[i][2] * len * 0.32);
      g.gain.setTargetAtTime(0, t + len * 0.75, len * 0.06);
      s.connect(g); s.start(t); s.stop(t + len + 0.05);
    }
    var n = noise(v, t, len), bp = filt(v, 'bandpass', 3200, 1.1), gs = gn(c, 0, dst);
    gs.gain.setValueAtTime(0, t); gs.gain.linearRampToValueAtTime(vel * 0.1, t + 0.04);
    gs.gain.linearRampToValueAtTime(vel * 0.16, t + 0.25); gs.gain.setTargetAtTime(0, t + 0.3, len * 0.2);
    n.connect(bp); bp.connect(gs);
    var m = noise(v, t, 0.1), lp = filt(v, 'lowpass', 700, 0.7), gm = gn(c, 0, dst);
    perc(gm.gain, t, 0.002, vel * 0.5, 0.03);
    m.connect(lp); lp.connect(gm);
    return t + len;
  }

  // gusty wind: band-passed noise with wandering centre and level
  function wind(v, t, len, o) {
    o = o || {};
    var c = v.c, vel = o.v == null ? 0.4 : o.v, f0 = o.f || 700, dst = o.dst || v.out, steps = Math.max(3, Math.round(len / 0.22)), i;
    var n = noise(v, t, len + 0.1), bp = filt(v, 'bandpass', f0, o.q || 1.1), lp = filt(v, 'lowpass', f0 * 3, 0), g = gn(c, 0, dst);
    n.connect(bp); bp.connect(lp); lp.connect(g);
    bp.frequency.setValueAtTime(fq(v, f0 * rr(0.8, 1.1)), t);
    for (i = 1; i <= steps; i++) bp.frequency.setTargetAtTime(fq(v, f0 * rr(0.7, 1.45)), t + len * i / (steps + 1), 0.12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.6, t + len * 0.25);
    for (i = 1; i < steps; i++) g.gain.setTargetAtTime(vel * rr(0.45, 1), t + len * (0.25 + 0.5 * i / steps), 0.1);
    g.gain.setTargetAtTime(0, t + len * 0.8, len * 0.07);
    return t + len;
  }

  // paper / fan swish: band-pass sweep with a soft swell
  function swish(v, t, len, o) {
    o = o || {};
    var c = v.c, vel = o.v == null ? 0.3 : o.v, f1 = o.f1 || 900, f2 = o.f2 || 4200, dst = o.dst || v.out;
    var n = noise(v, t, len), bp = filt(v, 'bandpass', f1, o.q || 1.4), g = gn(c, 0, dst);
    bp.frequency.setValueAtTime(hz(v, f1), t);
    bp.frequency.exponentialRampToValueAtTime(hz(v, f2), t + len);
    n.connect(bp); bp.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + len * 0.45); g.gain.linearRampToValueAtTime(0, t + len);
    return t + len;
  }

  // rising sparkle: tiny high sine pings
  function sparkle(v, t, o) {
    var c = v.c, cnt = o.n || 6, span = o.d || 0.45, f1 = o.f1 || 1800, f2 = o.f2 || 4800, vel = o.v == null ? 0.18 : o.v, end = t;
    for (var i = 0; i < cnt; i++) {
      var tt = t + span * i / cnt + rr(0, 0.02), fr = f1 * Math.pow(f2 / f1, i / Math.max(1, cnt - 1)) * rr(0.97, 1.03);
      var s = osc(v, 'sine', fr), g = gn(c, 0, o.dst || v.out);
      perc(g.gain, tt, 0.002, vel * rr(0.7, 1), 0.07);
      s.connect(g); s.start(tt); s.stop(tt + 0.45);
      end = tt + 0.45;
    }
    return end;
  }

  // hanko seal stamp: heavy low thud + wooden desk body + paper press
  function thud(v, t, o) {
    var c = v.c, vel = o.v == null ? 0.9 : o.v, big = !!o.big, dst = o.dst || v.out;
    var e = smp(v, t, 'seal', vel * 0.9, big ? 0.82 : 1, dst);
    var s = osc(v, 'sine', big ? 120 : 150), g = gn(c, 0, dst);
    s.frequency.setValueAtTime(hz(v, big ? 120 : 150), t);
    s.frequency.exponentialRampToValueAtTime(hz(v, big ? 44 : 55), t + 0.09);
    perc(g.gain, t, 0.002, vel * 0.8, big ? 0.12 : 0.08);
    s.connect(g); s.start(t); s.stop(t + 0.7);
    var n = noise(v, t, 0.08), lp = filt(v, 'lowpass', 1100, 0), gp = gn(c, 0, dst);
    perc(gp.gain, t, 0.001, vel * 0.35, 0.012);
    n.connect(lp); lp.connect(gp);
    return Math.max(e, t + 0.7);
  }

  // ---------------------------------------------------------------- SFX: fn(voice, time, opts) -> end time
  var SFX = {};

  // UI
  SFX.hover = function (v, t) { return smp(v, t, 'tick', 0.16, rr(0.95, 1.05)); };
  SFX.click = function (v, t) { return smp(v, t, 'clack', 0.5, rr(0.98, 1.02)); };
  SFX.cancel = function (v, t) { return smp(v, t, 'soft', 0.45, 0.94); };
  SFX.open = function (v, t) {
    var e = swish(v, t, 0.26, { f1: 700, f2: 3600, v: 0.22, q: 1.2 });
    smp(v, t + 0.2, 'tick', 0.1, 0.8);
    return e;
  };
  SFX.error = function (v, t) {
    var lp = filt(v, 'lowpass', 1200, 0); lp.connect(v.out);
    smp(v, t, 'knock', 0.55, 1, lp);
    return smp(v, t + 0.12, 'knock', 0.45, 0.92, lp);
  };

  // Dice
  SFX.shake = function (v, t, o) {          // dice rattling inside a wooden cup
    var n = Math.min(o.n, 8), lp = filt(v, 'lowpass', 3600, 0), pk = filt(v, 'peaking', 820, 2.5), end = t;
    pk.gain.value = 6; lp.connect(pk); pk.connect(v.out);
    var per = Math.min(2 + Math.round(n * 1.5), 9), amps = [0.75, 1, 0.85];
    for (var s = 0; s < 3; s++) {
      var t0 = t + s * 0.125 + rr(0, 0.01);
      for (var k = 0; k < per; k++) {
        end = Math.max(end, smp(v, t0 + Math.pow(R(), 1.6) * 0.07, vk(R() < 0.3 ? 'dd' : 'cup', 4),
          amps[s] * rr(0.25, 0.7), rr(0.9, 1.15), lp));
      }
    }
    return end + 0.05;
  };
  SFX.roll = function (v, t, o) {           // n dice clattering onto a lacquered tray
    var c = v.c, n = Math.max(1, Math.min(o.n, 12)), per = 1 / (1 + 0.16 * (n - 1)), end = t, i, b, k;
    var tb = osc(v, 'sine', 165), gb = gn(c, 0, v.out);   // tray body on first contact
    perc(gb.gain, t + 0.005, 0.002, 0.22 * Math.min(1.6, 0.8 + n * 0.12), 0.05);
    tb.connect(gb); tb.start(t); tb.stop(t + 0.4);
    for (i = 0; i < n; i++) {
      var dst = v.out;
      if (c.createStereoPanner) { dst = c.createStereoPanner(); dst.pan.value = rr(-0.5, 0.5); dst.connect(v.out); }
      var tt = t + (i ? rr(0, 0.06 + 0.012 * n) : 0), a = 0.9 * per, gap = rr(0.085, 0.12), bounces = 3 + ri(2);
      for (b = 0; b <= bounces; b++) {
        smp(v, tt, vk('die', 6), a * rr(0.85, 1.05), rr(0.93, 1.1), dst);
        tt += gap; gap *= rr(0.55, 0.68); a *= rr(0.42, 0.55);
      }
      var ticks = 2 + ri(3);                 // tumbling to rest
      for (k = 0; k < ticks; k++) {
        tt += rr(0.025, 0.06);
        smp(v, tt, vk('die', 6), 0.12 * per * (1 - k / (ticks + 1)), rr(1.05, 1.25), dst);
      }
      if (n > 1 && R() < 0.55) smp(v, t + rr(0.03, 0.25), vk('dd', 4), 0.35 * per, rr(0.95, 1.1), dst);
      end = Math.max(end, tt + 0.12);
    }
    return Math.max(end, t + 0.45);
  };
  SFX.land = function (v, t) {
    var e = smp(v, t, vk('die', 6), 0.85, rr(0.92, 0.98));
    var tb = osc(v, 'sine', 180), g = gn(v.c, 0, v.out);
    perc(g.gain, t, 0.002, 0.2, 0.04); tb.connect(g); tb.start(t); tb.stop(t + 0.3);
    smp(v, t + rr(0.07, 0.09), vk('die', 6), 0.12, 1.1);
    return Math.max(e, t + 0.3);
  };
  SFX.pick = function (v, t) {
    smp(v, t, 'tick', 0.2, 0.85);
    return smp(v, t + 0.012, vk('dd', 4), 0.08, 0.8);
  };
  SFX.place = function (v, t) {
    smp(v, t, vk('die', 6), 0.35, 0.95);
    return tsuzumi(v, t + 0.015, { f: 320, v: 0.7, d: 0.5 });
  };
  SFX.combine = function (v, t) {
    smp(v, t, vk('dd', 4), 0.75, 0.95);
    smp(v, t + 0.004, vk('die', 6), 0.5, 1);
    return bell(v, t + 0.035, 1760, { v: 0.32, d: 1.1 });
  };
  SFX.tweak = function (v, t) {
    smp(v, t, 'tick', 0.3, 1);
    return smp(v, t + 0.035, vk('coin', 4), 0.4, rr(0.95, 1.1));
  };
  SFX.zorome = function (v, t) {            // doubles: rising koto arpeggio (yo scale) + sparkle
    var seq = [0, 1, 2, 3, 4, 5, 6], end = t, i, tt = t;
    for (i = 0; i < seq.length; i++) { koto(v, tt, deg(62, YO, seq[i]), { v: 0.42 + i * 0.04, d: 1.0 }); tt += 0.058; }
    end = koto(v, tt + 0.03, deg(62, YO, 5), { v: 0.6, d: 1.4 });
    koto(v, tt + 0.03, deg(62, YO, 8), { v: 0.5, d: 1.4 });
    bell(v, tt + 0.04, 2349, { v: 0.14, d: 0.9 });
    return end;
  };

  // Orders
  SFX.march = function (v, t) {             // quick muffled drum roll / footfalls
    var lp = filt(v, 'lowpass', 1500, 0), end = t;
    lp.connect(v.out);
    for (var i = 0; i < 9; i++) {
      var tt = t + i * 0.068 + rr(-0.008, 0.008), a = (i % 2 ? 0.55 : 0.75) * (1 - i * 0.06);
      end = Math.max(end, taiko(v, tt, { f: i % 2 ? 128 : 112, v: a, d: 0.22, sk: 0.6, dst: lp }));
      var n = noise(v, tt, 0.07), bp = filt(v, 'bandpass', rr(500, 900), 0.9), g = gn(v.c, 0, lp);
      perc(g.gain, tt + 0.004, 0.006, a * 0.35, 0.02);
      n.connect(bp); bp.connect(g);
    }
    return end;
  };
  SFX.recruit = function (v, t) {
    taiko(v, t, { f: 68, v: 1, d: 1.0 });
    taiko(v, t + 0.2, { f: 82, v: 0.55, d: 0.6 });
    return conch(v, t + 0.12, 0.55, { f: 233, v: 0.38 });
  };
  SFX.develop = function (v, t) {
    var e = bell(v, t, 880, { v: 0.4, d: 1.6 });
    sparkle(v, t + 0.08, { n: 7, d: 0.42, f1: 1700, f2: 4600, v: 0.12 });
    return e;
  };
  SFX.statup = function (v, t) {            // koto glissando up the yo scale, then octave + bell
    var tt = t, gap = 0.05;
    for (var i = 0; i < 10; i++) { koto(v, tt, deg(50, YO, i + 2), { v: 0.36 + i * 0.03, d: 1.0 }); tt += gap; gap *= 0.9; }
    var e = koto(v, tt + 0.06, deg(50, YO, 12), { v: 0.62, d: 1.3 });
    koto(v, tt + 0.06, deg(50, YO, 7), { v: 0.4, d: 1.3 });
    bell(v, tt + 0.07, 1318.5, { v: 0.32, d: 1.4 });
    return Math.max(e, tt + 1.4);
  };
  SFX.gold = function (v, t) {
    var k = 3 + ri(2), end = t, tt = t;
    for (var i = 0; i < k; i++) {
      end = Math.max(end, smp(v, tt, vk('coin', 4), rr(0.4, 0.65), rr(0.92, 1.12)));
      tt += rr(0.045, 0.085);
    }
    return end;
  };

  // Battle
  SFX.horn = function (v, t) { return conch(v, t, 0.95, { f: 220, v: 0.75 }); };
  SFX.clash = function (v, t) {             // taiko impact + metallic crash
    taiko(v, t, { f: 72, v: 0.75, d: 0.9, sk: 0.6 });
    var e = smp(v, t + 0.012, vk('metal', 2), 0.6, rr(0.95, 1.05));
    var n = noise(v, t + 0.006, 0.5), hp = filt(v, 'highpass', 2400, 0), pk = filt(v, 'peaking', 5200, 1), g = gn(v.c, 0, v.out);
    pk.gain.value = 4; perc(g.gain, t + 0.006, 0.004, 0.3, 0.1);
    n.connect(hp); hp.connect(pk); pk.connect(g);
    return Math.max(e, t + 0.9);
  };
  SFX.win = function (v, t) {               // three strong taiko hits + bright accent
    taiko(v, t, { f: 76, v: 0.85, d: 0.7 });
    taiko(v, t + 0.2, { f: 76, v: 0.85, d: 0.7 });
    taiko(v, t + 0.42, { f: 66, v: 1, d: 1.1 });
    bell(v, t + 0.43, 1174.7, { v: 0.32, d: 1.2 });
    smp(v, t + 0.425, 'metal0', 0.32, 1.35);
    return t + 1.6;
  };
  SFX.lose = function (v, t) {              // low descending tone + muffled drum
    var c = v.c, s = osc(v, 'triangle', 233), lp = filt(v, 'lowpass', 900, 0), g = gn(c, 0, v.out), mf = filt(v, 'lowpass', 600, 0);
    s.frequency.setValueAtTime(hz(v, 233), t);
    s.frequency.exponentialRampToValueAtTime(hz(v, 104), t + 1.0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 0.06); g.gain.setTargetAtTime(0, t + 0.5, 0.25);
    s.connect(lp); lp.connect(g); s.start(t); s.stop(t + 1.8);
    shaku(v, t + 0.02, 57, 0.7, { v: 0.32, fall: 7, sc: 0.3 });
    mf.connect(v.out);
    taiko(v, t, { f: 64, v: 0.6, d: 0.8, sk: 0.2, dst: mf });
    taiko(v, t + 0.55, { f: 58, v: 0.5, d: 0.9, sk: 0.15, dst: mf });
    return t + 1.8;
  };
  SFX.conquest = function (v, t, o) {       // seal stamp + gong + koto flourish (o.big: grander)
    var big = !!o.big, i, tt = t + 0.28;
    thud(v, t, { v: big ? 0.8 : 0.7, big: big });
    taiko(v, t + 0.005, { f: big ? 56 : 62, v: big ? 0.9 : 0.6, d: big ? 1.4 : 1.0, sk: 0.2 });
    var end = gong(v, t + 0.03, { f: big ? 118 : 142, v: big ? 1.3 : 1.1, d: big ? 3.0 : 2.2 });
    var seq = big ? [0, 2, 3, 4, 5, 6, 7, 9] : [0, 2, 4, 5, 7];
    for (i = 0; i < seq.length; i++) { koto(v, tt, deg(62, YO, seq[i]), { v: 0.7 + 0.04 * i, d: 1.1 }); tt += big ? 0.05 : 0.055; }
    koto(v, tt + 0.05, deg(62, YO, 10), { v: 0.9, d: 1.5 });
    koto(v, tt + 0.05, deg(62, YO, 5), { v: 0.7, d: 1.5 });
    if (big) { taiko(v, tt + 0.05, { f: 66, v: 0.9, d: 1.0 }); bell(v, tt + 0.06, 1174.7, { v: 0.45, d: 1.6 }); }
    return Math.max(end, tt + 1.5);
  };
  SFX.stamp = function (v, t) { return thud(v, t, { v: 1 }); };
  SFX.fall = function (v, t) { return templeBell(v, t, { f: 98, v: 0.85, d: 4.2 }); };

  // Flow
  SFX.season = function (v, t) {
    wind(v, t, 1.4, { v: 0.32, f: 650 });
    return shaku(v, t + 0.18, 69, 0.85, { v: 0.32, sc: 0.8, br: 1.3 });
  };
  SFX.harvest = function (v, t) {
    SFX.gold(v, t);
    koto(v, t + 0.12, deg(62, YO, 2), { v: 0.45 });
    koto(v, t + 0.27, deg(62, YO, 3), { v: 0.45 });
    return koto(v, t + 0.42, deg(62, YO, 5), { v: 0.55, d: 1.2 });
  };
  SFX.snow = function (v, t) { return wind(v, t, 1.8, { v: 0.2, f: 1500, q: 2.2 }); };
  SFX.turnend = function (v, t) { smp(v, t, 'hyo', 0.6, 1); return smp(v, t + 0.17, 'hyo', 0.66, 1.02); };
  SFX.cpu = function (v, t) { return taiko(v, t, { f: 150, v: 0.4, d: 0.25, sk: 0.35 }); };
  SFX.warn = function (v, t) {              // low taiko rumble building to a hit
    var k = 12;
    for (var i = 0; i < k; i++) taiko(v, t + i * 0.055 + rr(-0.006, 0.006), { f: 62 + rr(-3, 3), v: 0.25 + 0.6 * i / k, d: 0.35, sk: 0.25 });
    return taiko(v, t + k * 0.055 + 0.02, { f: 56, v: 1, d: 1.0 });
  };
  SFX.diceup = function (v, t) {            // bright ascending chime
    var notes = [1174.7, 1318.5, 1568, 1760], end = t;
    for (var i = 0; i < 4; i++) end = bell(v, t + i * 0.07, notes[i], { v: 0.22 + i * 0.03, d: 1.0 });
    sparkle(v, t + 0.2, { n: 5, d: 0.3, f1: 3000, f2: 5200, v: 0.07 });
    return end;
  };
  SFX.victory = function (v, t) {           // taiko build-up, gong, koto + shakuhachi melody (yo scale)
    var hits = [[0, 0.55, 72], [0.3, 0.5, 72], [0.6, 0.55, 72], [0.75, 0.55, 72], [1.0, 0.7, 60]], i;
    for (i = 0; i < hits.length; i++) taiko(v, t + hits[i][0], { f: hits[i][2], v: hits[i][1], d: i === 4 ? 1.4 : 0.6 });
    gong(v, t + 1.02, { f: 130, v: 0.85, d: 3.0 });
    var mel = [[1.15, 3], [1.3, 4], [1.45, 5], [1.7, 6], [1.95, 5], [2.2, 7], [2.45, 6]];
    for (i = 0; i < mel.length; i++) koto(v, t + mel[i][0], deg(62, YO, mel[i][1]), { v: 0.6, d: 1.2 });
    koto(v, t + 2.75, deg(62, YO, 5), { v: 0.65, d: 1.6 });
    koto(v, t + 2.75, deg(62, YO, 10), { v: 0.6, d: 1.6 });
    shaku(v, t + 1.15, 74, 1.0, { v: 0.42, sc: 0.5 });
    shaku(v, t + 2.2, 76, 0.4, { v: 0.4, sc: 0.3 });
    shaku(v, t + 2.65, 74, 0.9, { v: 0.44, sc: 0.2 });
    taiko(v, t + 2.75, { f: 62, v: 0.6, d: 1.2 });
    return t + 4.0;
  };
  SFX.defeat = function (v, t) {            // somber: muffled drums, falling shakuhachi in miyako-bushi
    var mf = filt(v, 'lowpass', 700, 0);
    mf.connect(v.out);
    taiko(v, t, { f: 58, v: 0.75, d: 1.2, sk: 0.2, dst: mf });
    taiko(v, t + 1.6, { f: 52, v: 0.6, d: 1.4, sk: 0.15, dst: mf });
    koto(v, t + 0.05, deg(52, MIYAKO, 5), { v: 0.4, d: 2.2 });
    var ph = [[0.25, 9, 0.55], [0.85, 8, 0.45], [1.35, 6, 0.5], [1.9, 5, 0.9]];
    for (var i = 0; i < ph.length; i++) shaku(v, t + ph[i][0], deg(52, MIYAKO, ph[i][1]), ph[i][2], { v: 0.34, sc: 0.4, fall: i === 3 ? 1 : 0 });
    koto(v, t + 1.6, deg(52, MIYAKO, 0), { v: 0.4, d: 2.0 });
    koto(v, t + 1.62, deg(52, MIYAKO, 2), { v: 0.3, d: 2.0 });
    return t + 3.4;
  };
  SFX.title = function (v, t) {             // title sting: taiko + koto strum + answer phrase + soft gong
    taiko(v, t, { f: 62, v: 1, d: 1.3 });
    gong(v, t, { f: 150, v: 0.25, d: 2.0 });
    var ch = [0, 2, 3, 5, 7], i;
    for (i = 0; i < ch.length; i++) koto(v, t + 0.02 + i * 0.022, deg(62, YO, ch[i]), { v: 0.45, d: 1.8 });
    taiko(v, t + 0.5, { f: 78, v: 0.55, d: 0.6 });
    koto(v, t + 0.75, deg(62, YO, 8), { v: 0.5, d: 1.2 });
    koto(v, t + 0.95, deg(62, YO, 7), { v: 0.45, d: 1.2 });
    koto(v, t + 1.15, deg(62, YO, 5), { v: 0.55, d: 1.4 });
    return t + 2.6;
  };

  // ---------------------------------------------------------------- BGM: bar generators + lookahead step sequencer
  // Bar = 8 eighth-note steps. Event {s: step, k: 'k'oto|'s'hakuhachi|'d'rum|'t'suzumi|'b'ell, m: midi, v: vel, l: steps, b: bend}
  // Motif note: [step, scale degree, velocity factor, bend semitones] (bends only land on scale tones)

  // map: 都節 (miyako-bushi) on E, calm and sparse, low register, plenty of rests
  var MAP_A = [
    [[0, 7], [2, 6], [4, 5]],
    [[0, 8], [2, 9], [3, 8], [6, 7]],
    [[0, 5], [3, 7], [4, 8]],
    [[0, 6], [2, 5], [5, 2]],
    [[0, 3], [2, 5], [4, 7], [6, 5]],
    [[0, 7, 1, 2], [4, 8], [6, 7]],
    [[1, 5], [3, 6], [4, 5, 0.8]]
  ];
  var MAP_B = [
    [[0, 10], [1, 9, 0.7], [2, 8], [6, 7]],
    [[0, 7], [1, 8], [4, 8, 1, 1], [6, 8]],
    [[0, 8], [2, 7], [3, 6], [4, 5]],
    [[0, 12, 0.8], [2, 10], [5, 8]],
    [[0, 5], [1, 7], [2, 8], [3, 10], [6, 8]],
    [[0, 9], [2, 8], [4, 7, 1, 2], [7, 8, 0.7]]
  ];
  // title: 陽旋法 (yo) on D, brighter and a little busier, steady festival drum
  var TITLE_M = [
    [[0, 10], [1, 9], [2, 7], [4, 8], [6, 7]],
    [[0, 5], [2, 7], [3, 8], [4, 10], [6, 9]],
    [[0, 8], [1, 7], [2, 5], [3, 7], [4, 8, 1, 2], [6, 7]],
    [[0, 12, 0.8], [2, 10], [3, 9], [4, 10], [6, 8]],
    [[0, 7], [1, 8], [2, 10], [4, 11], [5, 10], [6, 8]],
    [[0, 10], [0, 5, 0.7], [4, 8], [5, 7], [6, 5]]
  ];
  var TITLE_CAD = [
    [[0, 8], [2, 7], [4, 6], [5, 5, 1.1], [5, 10, 0.8]],
    [[0, 9], [1, 8], [2, 7], [4, 5, 1.1], [4, 0, 0.7]]
  ];
  // end: 都節 on A, slow reflective arpeggios
  var END_M = [
    [[0, 5], [2, 7], [4, 8], [6, 10]],
    [[0, 10], [2, 9], [3, 8], [6, 5]],
    [[0, 8], [3, 7], [4, 6], [5, 5, 0.8]],
    [[0, 7], [2, 8], [4, 9], [5, 8], [7, 7, 0.8]],
    [[0, 12, 0.7], [1, 10], [4, 8], [6, 7]],
    [[0, 5], [0, 10, 0.6], [4, 8, 1, 1], [6, 7]]
  ];

  function addMotif(E, mot, tonic, sc, vel, shift) {
    for (var j = 0; j < mot.length; j++) {
      var n = mot[j];
      E.push({ s: n[0], k: 'k', m: deg(tonic, sc, n[1] + (shift || 0)), v: vel * (n[2] || 1) * rr(0.85, 1.05), b: n[3] || 0 });
    }
  }
  function pickNew(st, key, pool) {
    var i = ri(pool.length);
    if (i === st[key] && pool.length > 1) i = (i + 1 + ri(pool.length - 1)) % pool.length;
    st[key] = i;
    return pool[i];
  }

  function mapBar(p, i, st) {
    var E = [], T = 52, rest;
    if (i % 8 === 0) { st.sec = (st.sec || 0) + 1; st.pool = (st.sec % 3 === 2) ? MAP_B : MAP_A; st.sparse = R() < 0.3; }
    rest = !st.rested && ((st.sparse && R() < 0.5) || R() < 0.15);    // never two melody rests in a row
    st.rested = rest;
    if (i % 2 === 0) E.push({ s: 0, k: 'd', f: 64, v: 0.16, d: 0.9 });
    if (R() < 0.3) E.push({ s: pick([5, 6]), k: 't', f: 300, v: 0.09 });
    if (rest || R() < 0.6) E.push({ s: 0, k: 'k', m: deg(T, MIYAKO, pick([0, 0, 2, 3, -3])), v: 0.26 });
    if (!rest) addMotif(E, pickNew(st, 'last', st.pool), T, MIYAKO, 0.36);
    else if (R() < 0.6) E.push({ s: 4, k: 'k', m: deg(T, MIYAKO, pick([5, 7, 8])), v: 0.2 });
    if (st.cool > 0) st.cool--;
    else if (R() < 0.14) {
      st.cool = 5;
      E.push({ s: 2, k: 's', m: deg(T, MIYAKO, pick([7, 8, 5, 10])), v: 0.11, l: Math.round(rr(5, 9)), fall: R() < 0.4 ? 1 : 0 });
    }
    return E;
  }

  function titleBar(p, i, st) {
    var E = [], T = 50, ph = i % 4;
    E.push({ s: 0, k: 'd', f: 66, v: 0.42, d: 0.9 });
    E.push({ s: 3, k: 'd', f: 74, v: 0.2, d: 0.5 });
    E.push({ s: 6, k: 'd', f: 70, v: 0.28, d: 0.6 });
    if (ph === 3) { E.push({ s: 5, k: 't', f: 360, v: 0.16 }); E.push({ s: 7, k: 't', f: 330, v: 0.2 }); }
    else if (R() < 0.4) E.push({ s: 7, k: 't', f: 380, v: 0.12 });
    E.push({ s: 0, k: 'k', m: deg(T, YO, pick([-5, -5, -3, -2])), v: 0.32 });
    if (R() < 0.5) E.push({ s: 4, k: 'k', m: deg(T, YO, pick([0, -2])), v: 0.24 });
    if (ph === 0) st.shift = pick([0, 0, 0, 1, -1]);
    addMotif(E, ph === 3 ? pickNew(st, 'cad', TITLE_CAD) : pickNew(st, 'last', TITLE_M), T, YO, 0.4, ph === 3 ? 0 : st.shift);
    if (ph === 0 && i % 8 === 4 && R() < 0.7) {
      E.push({ s: 0, k: 's', m: deg(T, YO, pick([10, 12, 9])), v: 0.15, l: 6 });
      E.push({ s: 6, k: 's', m: deg(T, YO, pick([9, 10, 8])), v: 0.14, l: 8, fall: R() < 0.5 ? 2 : 0 });
    }
    return E;
  }

  function endBar(p, i, st) {
    var E = [], T = 45, rest = !st.rested && R() < 0.12;
    st.rested = rest;
    if (i % 4 === 0) E.push({ s: 0, k: 'd', f: 58, v: 0.12, d: 1.2, sk: 0.1 });
    if (i % 8 === 0) E.push({ s: 0, k: 'b', f: 880, v: 0.06, d: 3 });
    if (rest || R() < 0.75) E.push({ s: 0, k: 'k', m: deg(T, MIYAKO, pick([0, 2, 3])), v: 0.24 });
    if (!rest) addMotif(E, pickNew(st, 'last', END_M), T, MIYAKO, 0.32);
    if (st.cool > 0) st.cool--;
    else if (R() < 0.4) {
      st.cool = 2;
      var d0 = pick([10, 9, 8, 7]);
      E.push({ s: 1, k: 's', m: deg(T, MIYAKO, d0), v: 0.115, l: 4 });
      E.push({ s: 5, k: 's', m: deg(T, MIYAKO, d0 - 1), v: 0.105, l: 6, fall: R() < 0.5 ? 1 : 0 });
    }
    return E;
  }

  var BGM = {
    title: { bpm: 88, wet: 0.35, vol: 1.55, bar: titleBar },     // vol: player gain, calibrated so that at default
    map: { bpm: 66, wet: 0.5, vol: 2.2, bar: mapBar },           // settings the 95th-percentile 400 ms loudness is
    end: { bpm: 52, wet: 0.6, vol: 2.5, bar: endBar }            // about title -22 / map -26.5 / end -24 dBFS
  };

  // BGM drum hit from a pre-rendered buffer; len shortens the ring
  function drumHit(v, t, kind, f, vel, len) {
    var c = v.c, db = drumBuf(c, kind), s = c.createBufferSource(), g = gn(c, vel, v.out), r = f / db.f;
    var end = Math.min(t + db.b.duration / r, t + len + 0.3);
    s.buffer = db.b; s.playbackRate.value = r;
    g.gain.setValueAtTime(vel, t);
    g.gain.setTargetAtTime(0, t + len * 0.35, len * 0.15);
    s.connect(g); s.start(t); s.stop(end);
    return end;
  }

  function bgmEv(p, e, t) {
    var v = p.v;
    switch (e.k) {
      case 'k': return koto(v, t, e.m, { v: e.v, d: e.l ? e.l * p.sd : 0, b: e.b });
      case 's': return shaku(v, t, e.m, (e.l || 4) * p.sd, { v: e.v, sc: 0.5, fall: e.fall });
      case 'd': return drumHit(v, t, 'taiko', e.f, e.v, e.d || 0.8);
      case 't': return drumHit(v, t, 'tsuzumi', e.f, e.v, 0.4);
      case 'b': return bell(v, t, e.f, { v: e.v, d: e.d || 2 });
    }
    return t;
  }

  function Player(E, mode, t0) {
    var c = E.c;
    this.E = E; this.mode = BGM.hasOwnProperty(mode) ? mode : 'map'; this.cfg = BGM[this.mode];
    this.fade = gn(c, 0, E.bgmDry);
    this.fade.connect(gn(c, this.cfg.wet, E.bgmWet));
    this.v = { E: E, c: c, out: this.fade, rate: 1 };
    this.sd = 60 / this.cfg.bpm / 2;
    this.next = t0; this.step = 0; this.bar = 0; this.evs = []; this.st = { cool: 2 };
    this.lastEnd = t0; this.stopAt = Infinity;
  }
  Player.prototype.ramp = function (t, val, secs) {
    var g = this.fade.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
    else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
    g.linearRampToValueAtTime(val, t + Math.max(0.02, secs));
  };
  // schedule every step that starts before tEnd; silent = advance the music without making nodes
  Player.prototype.run = function (tEnd, silent) {
    var guard = 0;
    while (this.next < tEnd && guard++ < 4096) {
      var s = this.step % 8;
      if (s === 0) { this.evs = this.cfg.bar(this, this.bar, this.st); this.bar++; }
      if (!silent) {
        for (var i = 0; i < this.evs.length; i++) {
          if (this.evs[i].s !== s) continue;
          var end = bgmEv(this, this.evs[i], this.next + rr(0, 0.012));
          if (end > this.lastEnd) this.lastEnd = end;
        }
      }
      this.next += this.sd; this.step++;
    }
  };

  // ---------------------------------------------------------------- mixing table
  // [volume, reverb send, min retrigger ms, priority (0 = first to drop), bgm duck depth, duck seconds]
  var INFO = {
    hover: [0.67, 0, 60, 0], click: [0.72, 0.05, 40, 1], cancel: [0.46, 0.05, 40, 1], open: [2.1, 0.1, 80, 1], error: [0.63, 0.05, 150, 1],
    shake: [0.48, 0.08, 120, 1], roll: [1.19, 0.12, 90, 1], land: [0.77, 0.1, 35, 0], pick: [0.83, 0.05, 45, 0], place: [0.46, 0.15, 50, 1],
    combine: [0.88, 0.2, 80, 1], tweak: [1.3, 0.12, 60, 1], zorome: [1.54, 0.3, 250, 2],
    march: [0.91, 0.12, 150, 1], recruit: [0.6, 0.25, 200, 1], develop: [0.8, 0.35, 150, 1], statup: [1.52, 0.35, 200, 2], gold: [1.06, 0.2, 70, 0],
    horn: [1.36, 0.35, 500, 2, 0.6, 1.0], clash: [1.23, 0.25, 90, 2], win: [0.8, 0.3, 300, 2, 0.6, 1.2], lose: [1.18, 0.3, 300, 2, 0.6, 1.2],
    conquest: [1.25, 0.35, 300, 3, 0.45, 1.6], stamp: [0.88, 0.15, 90, 2], fall: [0.77, 0.45, 800, 3, 0.5, 3.0],
    season: [1.0, 0.35, 400, 1], harvest: [1.48, 0.3, 300, 1], snow: [3.8, 0.3, 400, 1], turnend: [1.13, 0.2, 200, 1], cpu: [0.47, 0.1, 70, 0],
    warn: [0.72, 0.2, 300, 2], diceup: [1.0, 0.35, 150, 1],
    victory: [1.35, 0.4, 1000, 3, 0.3, 4.0], defeat: [1.13, 0.4, 1000, 3, 0.3, 3.5], title: [0.85, 0.35, 500, 3, 0.5, 2.2]
  };
  var MAX_EVENTS = 24;

  function normOpts(o) {
    o = (o && typeof o === 'object') ? o : {};
    return { vol: num(o.vol, 1, 0, 4), rate: num(o.rate, 1, 0.25, 4), n: Math.round(num(o.n, 1, 1, 30)), big: !!o.big };
  }
  function duck(E, t, depth, secs) {          // overlapping ducks keep the deeper level and the later release
    var ps = [E.duckD.gain, E.duckW.gain], end = t + secs;
    if (E.duckEnd > t) { end = Math.max(end, E.duckEnd); depth = Math.min(depth, E.duckDepth); }
    E.duckEnd = end; E.duckDepth = depth;
    for (var i = 0; i < 2; i++) {
      ps[i].cancelScheduledValues(t);
      ps[i].setTargetAtTime(depth, t, 0.04);
      ps[i].setTargetAtTime(1, end, 0.5);
    }
  }
  // build one SFX event into engine E (shared by live play and offline QA render)
  function fire(E, name, t, o) {
    var info = INFO[name], v = voice(E, E.sfxDry, E.sfxWet, info[0] * o.vol, info[1], o.rate);
    var end = SFX[name](v, t, o);
    if (info[4]) duck(E, t, info[4], info[5]);
    return { v: v, end: end };
  }

  // ---------------------------------------------------------------- runtime
  var ctx = null, eng = null, timer = null, hiddenSuspended = false;
  var lastPlay = {}, active = [], bgm = { cur: null, old: [], want: null };

  function noop() {}
  function nowMs() { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  function running() { return !!(ctx && eng && ctx.state === 'running'); }
  function tryResume() {
    try {
      if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') { var p = ctx.resume(); if (p && p.then) p.then(noop, noop); }
    } catch (e) { /* ignore */ }
  }

  function prewarm() {   // synthesise koto / impact buffers in small idle slices after unlock
    if (typeof setTimeout !== 'function') return;
    var keys = [], m, i = 0;
    for (m = 45; m <= 90; m += 3) keys.push(m);
    keys.unshift('drum:taiko', 'drum:tsuzumi');
    keys.push('tick', 'clack', 'hyo', 'soft', 'knock', 'seal', 'metal0', 'metal1');
    for (m = 0; m < 6; m++) keys.push('die' + m);
    for (m = 0; m < 4; m++) keys.push('dd' + m, 'cup' + m, 'coin' + m);
    (function step() {
      if (!ctx || i >= keys.length) return;
      try {
        var k = keys[i++];
        if (typeof k === 'number') kotoBuf(ctx, k);
        else if (k.indexOf('drum:') === 0) drumBuf(ctx, k.slice(5));
        else smpBuf(ctx, k);
      } catch (e) { /* ignore */ }
      setTimeout(step, 25);
    })();
  }

  function unlock() {
    try {
      if (!AC) return false;
      if (!ctx) {
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e1) { ctx = new AC(); }
        eng = new Engine(ctx, false);
        try { ctx.onstatechange = function () { if (running() && bgm.want) startTimer(); }; } catch (e2) { /* ignore */ }
        prewarm();
      }
      if (ctx.state !== 'running') {
        tryResume();
        var s = ctx.createBufferSource();      // one-sample silent blip: unlocks audio on older iOS Safari
        s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); s.connect(ctx.destination); s.start(0);
      }
      if (bgm.want) startTimer();
      return true;
    } catch (e) { return false; }
  }

  function release(v, end) {                  // disconnect a finished voice (re-checks if the context was paused)
    if (typeof setTimeout !== 'function') return;
    (function later() {
      var left = end - ctx.currentTime;
      if (left > 0.2) { setTimeout(later, left * 1000 + 800); return; }
      try { v.out.disconnect(); if (v.ws) v.ws.disconnect(); } catch (e) { /* ignore */ }
    })();
  }

  function play(name, opts) {
    try {
      if (typeof name !== 'string' || !SFX.hasOwnProperty(name) || settings.muted) return false;
      if (!running()) { if (!hiddenSuspended) tryResume(); return false; }
      var info = INFO[name], ms = nowMs(), t = ctx.currentTime, same = 0, i;
      if (lastPlay[name] != null && ms - lastPlay[name] < info[2]) return false;
      for (i = active.length - 1; i >= 0; i--) {
        if (active[i].end < t) active.splice(i, 1);
        else if (active[i].n === name) same++;
      }
      if (info[3] < 2 && (same >= 4 || active.length >= (info[3] ? MAX_EVENTS : MAX_EVENTS - 8))) return false;
      lastPlay[name] = ms;
      var r = fire(eng, name, t + 0.01, normOpts(opts));
      active.push({ n: name, end: r.end });
      release(r.v, r.end);
      return true;
    } catch (e) { return false; }
  }

  // ---- BGM control (lookahead scheduler: setInterval ~100 ms, schedules ~0.3 s ahead)
  function startTimer() {
    if (!timer && typeof setInterval === 'function') timer = setInterval(tick, TICK_MS);
    tick();
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function retire(p, t, secs) { p.ramp(t, 0, secs); p.stopAt = t + secs; bgm.old.push(p); }
  function feed(p, now, until) {
    if (p.next < now) p.run(now + 0.03, true);    // fell behind (throttled timer): skip silently
    p.run(until, settings.muted);
  }
  function tick() {
    try {
      if (!running()) return;
      var now = ctx.currentTime, i, p;
      if (bgm.want && (!bgm.cur || bgm.cur.mode !== bgm.want)) {
        var xf = !!bgm.cur;
        if (xf) retire(bgm.cur, now + 0.05, 1.6);
        bgm.cur = new Player(eng, bgm.want, now + (xf ? 0.3 : 0.1));
        bgm.cur.ramp(now + 0.05, bgm.cur.cfg.vol, xf ? 1.8 : 1.0);
      }
      if (bgm.cur) feed(bgm.cur, now, now + LOOKAHEAD);
      for (i = bgm.old.length - 1; i >= 0; i--) {
        p = bgm.old[i];
        if (now > p.stopAt + 0.1) { try { p.fade.disconnect(); } catch (e) { /* ignore */ } bgm.old.splice(i, 1); }
        else feed(p, now, Math.min(now + LOOKAHEAD, p.stopAt));
      }
      if (!bgm.cur && !bgm.old.length && !bgm.want) stopTimer();
    } catch (e) { /* the scheduler never throws */ }
  }
  function startBgm(mode) {
    try {
      if (!BGM.hasOwnProperty(mode)) return false;
      bgm.want = mode;
      if (running()) startTimer();     // tick() performs the fade-in / crossfade
      return !!AC;
    } catch (e) { return false; }
  }
  function stopBgm(fadeSeconds) {
    try {
      bgm.want = null;
      if (bgm.cur && ctx) { retire(bgm.cur, ctx.currentTime + 0.02, num(fadeSeconds, 1.2, 0, 30)); bgm.cur = null; }
      return true;
    } catch (e) { return false; }
  }

  // ---- levels
  function applyLevels() {
    if (!eng) return;
    var t = ctx.currentTime, set = function (p, v) { p.cancelScheduledValues(t); p.setTargetAtTime(v, t, 0.03); };
    set(eng.master.gain, settings.muted ? 0 : settings.master);
    set(eng.sfxDry.gain, settings.sfx); set(eng.sfxWet.gain, settings.sfx);
    set(eng.bgmDry.gain, settings.bgm); set(eng.bgmWet.gain, settings.bgm);
  }
  function setLevel(key, v) {
    try { settings[key] = num(v, settings[key], 0, 1); saveSettings(); applyLevels(); } catch (e) { /* ignore */ }
  }

  // ---- page lifecycle: unlock on any gesture, pause audio while the tab is hidden
  function onGesture() { if (!running()) unlock(); }
  function onVisibility() {
    try {
      if (!ctx || !root.document) return;
      if (root.document.hidden) {
        if (ctx.state === 'running') { hiddenSuspended = true; var p = ctx.suspend(); if (p && p.then) p.then(noop, noop); }
      } else if (hiddenSuspended) { hiddenSuspended = false; tryResume(); }
    } catch (e) { /* ignore */ }
  }
  try {
    if (root.addEventListener) {
      var gev = ['pointerdown', 'pointerup', 'mousedown', 'touchend', 'keydown'];
      for (var gi = 0; gi < gev.length; gi++) root.addEventListener(gev[gi], onGesture, true);
    }
    if (root.document && root.document.addEventListener) root.document.addEventListener('visibilitychange', onVisibility);
  } catch (e) { /* ignore */ }

  // ---- QA: build a sound (or 'bgm:<mode>', or several joined with '+') with the full master chain into an
  // OfflineAudioContext (new one, or opts.context) and render it. Resolves {buffer, peak, rms}.
  // `seconds` is the length after a 0.5 s silent pre-roll (opts.at): a fresh DynamicsCompressorNode starts
  // fully clamped and needs ~0.3 s to relax. opts: seed, master/sfx/bgm, vol/rate/n/big, stagger, gain, raw.
  function renderOffline(name, seconds, opts) {
    try {
      opts = opts || {};
      if (!OAC && !opts.context) return Promise.reject(new Error('OfflineAudioContext unavailable'));
      var sr = num(opts.sampleRate, 44100, 8000, 96000), pre = num(opts.at, 0.5, 0, 60), secs = pre + num(seconds, 4, 0.1, 600);
      var oc = opts.context || new OAC(2, Math.ceil(sr * secs), sr), parts = String(name).split('+'), i, t0 = oc.currentTime;
      var st = { master: num(opts.master, DEF.master, 0, 1), sfx: num(opts.sfx, DEF.sfx, 0, 1), bgm: num(opts.bgm, DEF.bgm, 0, 1),
                 muted: false, raw: !!opts.raw };
      if (opts.seed != null) seed = opts.seed >>> 0;
      var E = new Engine(oc, true, st), o = normOpts(opts);
      o.vol *= num(opts.gain, 1, 0, 1000);      // QA-only calibration multiplier
      for (i = 0; i < parts.length; i++) {
        var nm = parts[i], at = t0 + pre + num(opts.stagger, 0, 0, 60) * i;
        if (nm.indexOf('bgm:') === 0 && BGM.hasOwnProperty(nm.slice(4))) {
          var p = new Player(E, nm.slice(4), at);
          p.ramp(at, p.cfg.vol * num(opts.gain, 1, 0, 1000), 1.0); p.run(t0 + secs, false);
        } else if (SFX.hasOwnProperty(nm)) fire(E, nm, at, o);
        else return Promise.reject(new Error('unknown sound: ' + nm));
      }
      if (typeof oc.startRendering !== 'function') return Promise.resolve(null);   // a realtime context was given
      return new Promise(function (res, rej) {
        oc.oncomplete = function (ev) { res(ev.renderedBuffer); };
        var pr = oc.startRendering();
        if (pr && pr.then) pr.then(res, rej);
      }).then(function (buf) {
        var pk = 0, ss = 0, n = 0, ch, j, d, a;
        for (ch = 0; ch < buf.numberOfChannels; ch++) {
          d = buf.getChannelData(ch); n += d.length;
          for (j = 0; j < d.length; j++) { a = d[j] < 0 ? -d[j] : d[j]; if (a > pk) pk = a; ss += d[j] * d[j]; }
        }
        return { buffer: buf, peak: pk, rms: Math.sqrt(ss / Math.max(1, n)) };
      });
    } catch (e) { return Promise.reject(e); }
  }

  // ---------------------------------------------------------------- public API
  loadSettings();
  var names = [];
  for (var key in SFX) if (SFX.hasOwnProperty(key)) names.push(key);

  root.Sound = {
    unlock: unlock,
    play: play,
    startBgm: startBgm,
    stopBgm: stopBgm,
    setMaster: function (v) { setLevel('master', v); },
    setSfx: function (v) { setLevel('sfx', v); },
    setBgm: function (v) { setLevel('bgm', v); },
    setMuted: function (b) { try { settings.muted = !!b; saveSettings(); applyLevels(); } catch (e) { /* ignore */ } },
    isMuted: function () { return !!settings.muted; },
    getSettings: function () {
      return { master: settings.master, sfx: settings.sfx, bgm: settings.bgm, muted: !!settings.muted,
               supported: !!AC, unlocked: running(), bgmMode: bgm.want };
    },
    names: names.slice(),
    _renderOffline: renderOffline,
    _bgmPlan: function (mode, bars, s) {     // QA: the bar events a BGM mode would generate (no audio)
      if (!BGM.hasOwnProperty(mode)) return [];
      if (s != null) seed = s >>> 0;
      var st = { cool: 2 }, out = [], n = num(bars, 16, 1, 10000);
      for (var i = 0; i < n; i++) out.push(BGM[mode].bar(null, i, st));
      return out;
    },
    _seed: function (s) { seed = (+s >>> 0); },
    _debug: function () {
      return { state: ctx ? ctx.state : 'none', active: active.length, bgm: bgm.cur ? bgm.cur.mode : null,
               fading: bgm.old.length, timer: !!timer, sampleRate: ctx ? ctx.sampleRate : 0 };
    }
  };
})(typeof window !== 'undefined' ? window : this);
