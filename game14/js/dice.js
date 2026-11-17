/* dice.js — CSS-3D ivory dice for 天下賽配 (no dependencies). */
(function () {
  'use strict';
  // face -> rotation that brings that face to the front (towards the viewer)
  const FRONT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  const PIPS = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[26, 26], [50, 50], [74, 74]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
    6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
  };
  // physical layout: 1 front, 6 back, 2 right, 5 left, 3 top, 4 bottom (opposites sum to 7)
  const FACE_TF = {
    1: 'rotateY(0deg)', 6: 'rotateY(180deg)', 2: 'rotateY(90deg)', 5: 'rotateY(-90deg)', 3: 'rotateX(90deg)', 4: 'rotateX(-90deg)',
  };
  function buildDie(size) {
    const d = document.createElement('div');
    d.className = 'die3d';
    d.style.setProperty('--s', size + 'px');
    const cube = document.createElement('div');
    cube.className = 'cube';
    for (let f = 1; f <= 6; f++) {
      const face = document.createElement('div');
      face.className = 'face f' + f;
      face.style.transform = `${FACE_TF[f]} translateZ(calc(var(--s) / 2))`;
      PIPS[f].forEach(([x, y]) => {
        const p = document.createElement('i');
        p.className = 'pip' + (f === 1 ? ' red' : '');
        p.style.left = x + '%'; p.style.top = y + '%';
        face.appendChild(p);
      });
      cube.appendChild(face);
    }
    d.appendChild(cube);
    d._cube = cube;
    return d;
  }
  function restTransform(v, tilt) {
    const [rx, ry] = FRONT[v];
    const t = tilt || 0;
    return `rotateX(${rx + t * 0.6}deg) rotateY(${ry - t}deg) rotateZ(${t * 1.5}deg)`;
  }
  function setFace(d, v, tilt) {
    d._cube.style.transition = 'none';
    d._cube.style.transform = restTransform(v, tilt);
    d.dataset.v = v;
  }
  function tumble(d, v, ms, delay) {
    // spin through several random orientations, ending on face v
    return new Promise(res => {
      const cube = d._cube;
      const [rx, ry] = FRONT[v];
      const spinsX = 360 * (2 + Math.floor(Math.random() * 2)), spinsY = 360 * (1 + Math.floor(Math.random() * 2));
      const tilt = (Math.random() * 2 - 1) * 7;
      cube.style.transition = 'none';
      cube.style.transform = `rotateX(${rx - spinsX + (Math.random() * 90 - 45)}deg) rotateY(${ry - spinsY + (Math.random() * 90 - 45)}deg) rotateZ(${Math.random() * 360}deg)`;
      d.classList.add('rolling');
      d.getBoundingClientRect();
      setTimeout(() => {
        cube.style.transition = `transform ${ms}ms cubic-bezier(.15,.75,.3,1.02)`;
        cube.style.transform = restTransform(v, tilt);
        d.dataset.v = v;
      }, delay || 0);
      setTimeout(() => { d.classList.remove('rolling'); res(); }, ms + (delay || 0));
    });
  }
  window.Dice3D = { buildDie, setFace, tumble, restTransform };
})();
