/* ONE PROMPT WORLDS — builds the gallery from games.js and runs the backdrop motes. */
(function () {
  'use strict';

  var games = Array.isArray(window.OPW_GAMES) ? window.OPW_GAMES : [];
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function svgIcon(viewBox, d, cls) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    if (cls) svg.setAttribute('class', cls);
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
    return svg;
  }

  // small line icons for the "controls" tag
  function controlsIcon(text) {
    var stroke = function (svg) {
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.6');
      svg.setAttribute('stroke-linecap', 'round');
      return svg;
    };
    if (/キーボード/.test(text)) {
      return stroke(svgIcon('0 0 16 16', 'M1.5 4.5h13v7h-13zM4 7h.01M6.5 7h.01M9 7h.01M11.5 7h.01M5 9.5h6'));
    }
    return stroke(svgIcon('0 0 16 16', 'M8 1.5c-2.5 0-4 1.8-4 4.2v4.6c0 2.4 1.5 4.2 4 4.2s4-1.8 4-4.2V5.7c0-2.4-1.5-4.2-4-4.2zM8 1.5V6'));
  }

  function card(game, i) {
    var li = el('li', 'card');
    li.style.setProperty('--i', i);
    if (game.accent) li.style.setProperty('--accent', game.accent);

    // thumbnail
    var thumb = el('div', 'thumb');
    var img = document.createElement('img');
    img.src = game.thumbnail;
    if (game.thumbnailSmall) {
      img.srcset = game.thumbnailSmall + ' 640w, ' + game.thumbnail + ' 1280w';
      img.sizes = '(min-width: 1248px) 380px, (min-width: 1024px) 31vw, (min-width: 640px) 47vw, 100vw';
    }
    img.width = 1280;
    img.height = 720;
    img.alt = game.thumbnailAlt || ('「' + game.title + '」のゲーム画面');
    img.decoding = 'async';
    if (i >= 3) img.loading = 'lazy';
    img.addEventListener('error', function () { thumb.classList.add('is-missing'); });
    thumb.appendChild(img);
    thumb.appendChild(el('span', 'thumb-fallback', game.title));
    thumb.appendChild(el('span', 'thumb-frame'));

    var no = el('span', 'world-no');
    no.appendChild(document.createTextNode('WORLD '));
    no.appendChild(el('b', null, pad(i + 1)));
    thumb.appendChild(no);
    li.appendChild(thumb);

    // text parts are direct children of the card (5 rows: thumb, tags, title, text, foot)
    // so that cards in one row can share row tracks via CSS subgrid and stay aligned
    var body = li;

    var tags = el('ul', 'tags');
    if (game.genre) {
      var genre = el('li', 'tag tag-genre', game.genre);
      tags.appendChild(genre);
    }
    if (game.controls) {
      var ctl = el('li', 'tag tag-controls');
      ctl.appendChild(controlsIcon(game.controls));
      ctl.appendChild(document.createTextNode(game.controls));
      ctl.title = '主な操作';
      tags.appendChild(ctl);
    }
    body.appendChild(tags);

    var h3 = el('h3', 'card-title', game.title);
    if (game.subtitle) h3.appendChild(el('span', 'card-sub', game.subtitle));
    body.appendChild(h3);

    body.appendChild(el('p', 'card-desc', game.description || ''));

    var foot = el('div', 'card-foot');
    var maker = el('p', 'maker');
    maker.appendChild(el('span', 'maker-label', '制作AI'));
    maker.appendChild(el('span', 'maker-name', game.ai || 'Claude'));
    if (game.createdDate) {
      var date = el('time', 'maker-date', game.createdDate.slice(2).replace(/-/g, '/') + ' 作成');
      date.dateTime = game.createdDate;
      maker.appendChild(date);
    }
    foot.appendChild(maker);

    var play = el('a', 'play');
    play.href = game.path;
    play.setAttribute('aria-label', '「' + game.title + (game.subtitle ? ' ― ' + game.subtitle : '') + '」をプレイ');
    play.appendChild(svgIcon('0 0 10 12', 'M0 0l10 6-10 6z', 'play-icon'));
    play.appendChild(document.createTextNode('PLAY'));
    foot.appendChild(play);

    body.appendChild(foot);
    return li;
  }

  function renderGallery() {
    var list = document.getElementById('cards');
    var count = document.getElementById('world-count');
    if (!list) return;
    if (!games.length) {
      var empty = el('li', 'notice', '作品リストを読み込めませんでした。ページを再読み込みしてください。');
      list.appendChild(empty);
      return;
    }
    var frag = document.createDocumentFragment();
    games.forEach(function (g, i) { frag.appendChild(card(g, i)); });
    list.appendChild(frag);
    if (count) count.textContent = pad(games.length) + (games.length === 1 ? ' WORLD' : ' WORLDS');
  }

  /* ---------- backdrop motes: one colour per world ---------- */
  function startMotes() {
    var canvas = document.getElementById('motes');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var colours = games.map(function (g) { return g.accent; }).filter(Boolean);
    colours.push('#ffd59a');
    var rgb = colours.map(function (hex) {
      var h = hex.replace('#', '');
      if (h.length === 3) h = h.replace(/./g, '$&$&');
      var n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    });

    var w = 0, h = 0, dpr = 1, motes = [], running = false, visible = true, last = 0, raf = 0;

    function spawn(m, anywhere) {
      m.x = Math.random() * w;
      m.y = anywhere ? Math.random() * h : h + 10;
      m.r = 0.6 + Math.random() * 1.8;
      m.vy = -(4 + Math.random() * 12);
      m.sway = 6 + Math.random() * 18;
      m.freq = 0.15 + Math.random() * 0.35;
      m.phase = Math.random() * Math.PI * 2;
      m.tw = 0.4 + Math.random() * 1.4;
      m.c = rgb[(Math.random() * rgb.length) | 0];
      return m;
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var target = Math.min(90, Math.round((w * h) / 16000));
      while (motes.length < target) motes.push(spawn({}, true));
      motes.length = target;
      if (!running) draw(0);
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        var x = m.x + Math.sin(t * m.freq + m.phase) * m.sway;
        var a = 0.35 + 0.35 * Math.sin(t * m.tw + m.phase);
        var c = m.c;
        var g = ctx.createRadialGradient(x, m.y, 0, x, m.y, m.r * 5);
        g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.55 * a).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, m.y, m.r * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,248,235,' + (0.8 * a).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(x, m.y, m.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function frame(now) {
      raf = 0;
      if (!running) return;
      var dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        m.y += m.vy * dt;
        if (m.y < -12) spawn(m, false);
      }
      draw(now / 1000);
      raf = requestAnimationFrame(frame);
    }

    function setRunning(on) {
      on = on && !reduce && visible && !document.hidden;
      if (on === running) return;
      running = on;
      if (running) { last = performance.now(); raf = requestAnimationFrame(frame); }
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    resize();
    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 120);
    });
    document.addEventListener('visibilitychange', function () { setRunning(true); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        setRunning(true);
      }).observe(canvas);
    }
    setRunning(true);
  }

  renderGallery();
  try { startMotes(); } catch (e) { /* decoration only */ }
})();
