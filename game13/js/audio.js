// からり、国盗り ― 音（すべて WebAudio で合成）
(function (root) {
  'use strict';
  var ac = null, master = null, bgmGain = null, on = true, vol = 0.7, bgmOn = true, bgmTimer = null, noiseBuf = null;

  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.gain.value = on ? vol : 0; master.connect(ac.destination);
    bgmGain = ac.createGain(); bgmGain.gain.value = 0.16; bgmGain.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function tone(f, t0, dur, type, g, f2, dest) {
    if (!ac) return;
    var o = ac.createOscillator(), a = ac.createGain(), t = ac.currentTime + t0;
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(g, t + 0.008); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(a); a.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t0, dur, g, freq, q, type) {
    if (!ac) return;
    var s = ac.createBufferSource(), f = ac.createBiquadFilter(), a = ac.createGain(), t = ac.currentTime + t0;
    s.buffer = noiseBuf; s.loop = true;
    f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(a); a.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // 琴のような撥弦
  function pluck(f, t0, g, dest) {
    tone(f, t0, 0.9, 'triangle', g, null, dest); tone(f * 2, t0, 0.35, 'sine', g * 0.4, null, dest); tone(f * 3.01, t0, 0.12, 'sine', g * 0.2, null, dest);
  }
  function taiko(t0, g, f) { tone(f || 95, t0, 0.35, 'sine', g, 42); noise(t0, 0.06, g * 0.5, 300, 0.7, 'lowpass'); }

  var SCALE = [293.66, 311.13, 392.0, 440.0, 466.16, 587.33, 622.25, 783.99]; // 都節っぽい音階
  var S = {
    click: function () { tone(880, 0, 0.05, 'triangle', 0.12); noise(0, 0.03, 0.08, 2500, 2); },
    pick: function () { noise(0, 0.05, 0.2, 1800, 3); tone(520, 0, 0.07, 'triangle', 0.14); },
    deny: function () { tone(160, 0, 0.14, 'square', 0.08, 120); },
    dice: function (n) { for (var i = 0; i < 6 + (n || 3) * 2; i++) { var t = i * 0.045 + Math.random() * 0.02; noise(t, 0.035, 0.25 + Math.random() * 0.15, 1500 + Math.random() * 2500, 5); tone(700 + Math.random() * 500, t, 0.03, 'triangle', 0.05); } },
    land: function (i) { noise(0, 0.06, 0.35, 900, 2); tone(300 + (i || 0) * 30, 0, 0.09, 'triangle', 0.14, 180); },
    flip: function () { noise(0, 0.05, 0.25, 2200, 4); tone(500, 0.02, 0.12, 'triangle', 0.14, 900); },
    coin: function () { tone(1568, 0, 0.12, 'square', 0.06); tone(2093, 0.06, 0.25, 'square', 0.06); },
    develop: function () { pluck(392, 0, 0.2); pluck(466.16, 0.09, 0.2); pluck(587.33, 0.18, 0.24); noise(0, 0.25, 0.06, 5000, 1, 'highpass'); },
    fortify: function () { for (var i = 0; i < 3; i++) { noise(i * 0.11, 0.05, 0.4, 700, 3); tone(210, i * 0.11, 0.07, 'square', 0.1, 140); } tone(330, 0.36, 0.3, 'triangle', 0.14); },
    recruit: function () { for (var i = 0; i < 4; i++) { noise(i * 0.07, 0.05, 0.22, 400 + i * 60, 2); } tone(196, 0.05, 0.3, 'sawtooth', 0.06, 262); },
    guard: function () { noise(0, 0.18, 0.3, 3000, 6); tone(660, 0, 0.3, 'triangle', 0.12); tone(990, 0.02, 0.25, 'sine', 0.07); },
    march: function () { for (var i = 0; i < 5; i++) taiko(i * 0.09, 0.3, 80 + i * 4); tone(175, 0, 0.5, 'sawtooth', 0.07, 233); },
    horn: function () { tone(147, 0, 0.7, 'sawtooth', 0.11, 220); tone(220, 0.25, 0.6, 'sawtooth', 0.07, 225); },
    clash: function () { noise(0, 0.25, 0.5, 3200, 3); noise(0.05, 0.3, 0.35, 900, 1); taiko(0, 0.5, 70); },
    win: function () { taiko(0, 0.5, 90); [0, 2, 3, 5, 7].forEach(function (k, i) { pluck(SCALE[k], 0.08 + i * 0.09, 0.22); }); tone(587.33, 0.55, 0.7, 'triangle', 0.14); tone(880, 0.55, 0.7, 'sine', 0.08); },
    bigwin: function () { taiko(0, 0.6, 90); taiko(0.18, 0.6, 90); [0, 2, 3, 5, 3, 5, 7].forEach(function (k, i) { pluck(SCALE[k], 0.3 + i * 0.1, 0.24); }); tone(587.33, 1.0, 1.2, 'triangle', 0.16); tone(783.99, 1.0, 1.2, 'triangle', 0.1); tone(1174.7, 1.0, 1.2, 'sine', 0.07); },
    lose: function () { tone(220, 0, 0.5, 'triangle', 0.16, 130); tone(207, 0.25, 0.7, 'triangle', 0.14, 98); taiko(0, 0.35, 60); },
    held: function () { noise(0, 0.15, 0.3, 2500, 5); tone(392, 0, 0.2, 'triangle', 0.14); tone(523, 0.12, 0.4, 'triangle', 0.14); },
    far: function () { taiko(0, 0.16, 70); noise(0, 0.1, 0.07, 2500, 3); },
    fall: function () { tone(196, 0, 1.0, 'sawtooth', 0.07, 73); taiko(0, 0.4, 55); taiko(0.3, 0.3, 50); },
    season: function () { pluck(587.33, 0, 0.2); pluck(440, 0.16, 0.18); pluck(392, 0.32, 0.18); },
    start: function () { S.horn(); taiko(0.7, 0.5); taiko(0.95, 0.5); taiko(1.1, 0.6, 100); }
  };
  function play(name, arg) { if (!on || !ensure()) return; try { S[name] && S[name](arg); } catch (e) { /* 音が出なくても遊べる */ } }

  // BGM：ゆっくりした琴の即興。毎回フレーズが変わるので単調なループにならない
  var step = 0, last = 3;
  function bgmTick() {
    if (!ac || !bgmOn || !on) return;
    var bar = step % 8;
    if (bar === 0) { tone(73.4, 0, 3.2, 'sine', 0.5, null, bgmGain); tone(146.8, 0, 2.6, 'triangle', 0.14, null, bgmGain); }
    if (bar === 4) { tone(98, 0, 3.0, 'sine', 0.4, null, bgmGain); }
    var n = Math.random() < 0.72 ? 1 : 0;
    if (bar === 0 || bar === 4) n = 1;
    if (n) {
      last = Math.max(0, Math.min(SCALE.length - 1, last + Math.floor(Math.random() * 5) - 2));
      pluck(SCALE[last] / 2, 0, 0.55, bgmGain);
      if (Math.random() < 0.3) pluck(SCALE[Math.max(0, last - 2)] / 2, 0.42, 0.35, bgmGain);
    }
    step++;
  }
  function bgmStart() { if (bgmTimer || !ensure()) return; bgmTimer = setInterval(bgmTick, 840); }

  root.KA = {
    play: play, unlock: function () { if (ensure()) bgmStart(); },
    setOn: function (v) { on = v; if (master) master.gain.value = on ? vol : 0; },
    isOn: function () { return on; },
    setBgm: function (v) { bgmOn = v; }, isBgm: function () { return bgmOn; }
  };
})(window);
