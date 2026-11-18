/* ONE PROMPT WORLDS — builds the WORLDS / BEYOND galleries from games.js and beyond.js, and runs the backdrop motes. */
(function () {
  'use strict';

  var games = Array.isArray(window.OPW_GAMES) ? window.OPW_GAMES : [];
  var beyond = Array.isArray(window.OPW_BEYOND) ? window.OPW_BEYOND : [];
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var STATUS = {
    dev: { label: '開発中', badge: '改修中', cls: 'is-dev' },
    released: { label: '完成', badge: '完成版', cls: 'is-released' }
  };

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

  // 'game3/index.html' -> 'game3'
  function folderOf(path) { return String(path || '').split('/')[0]; }

  function toList(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]); }

  function fullTitle(game) { return game.title + (game.subtitle ? ' ― ' + game.subtitle : ''); }

  function shortDate(iso) { return iso.slice(2).replace(/-/g, '/'); }

  function statusOf(entry) { return STATUS[entry.status] ? entry.status : 'dev'; }

  // BEYOND number comes from the folder name (beyond3/ -> 3), falling back to list order
  function beyondNo(entry, i) {
    var m = /^beyond(\d+)$/.exec(folderOf(entry.path));
    return m ? parseInt(m[1], 10) : i + 1;
  }

  function beyondId(entry, i) { return 'beyond' + beyondNo(entry, i); }

  /* ---------- shared card parts ---------- */

  // card rows (thumb, tags, title, text, foot) are direct children of the card
  // so that cards in one row can share row tracks via CSS subgrid and stay aligned
  function cardShell(game, i) {
    var li = el('li', 'card');
    li.style.setProperty('--i', i);
    if (game.accent) li.style.setProperty('--accent', game.accent);
    return li;
  }

  function thumbPart(game, i, label, no) {
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

    var tag = el('span', 'world-no');
    tag.appendChild(document.createTextNode(label + ' '));
    tag.appendChild(el('b', null, pad(no)));
    thumb.appendChild(tag);
    return thumb;
  }

  function tagsPart(game, first) {
    var tags = el('ul', 'tags');
    if (first) tags.appendChild(first);
    if (game.genre) tags.appendChild(el('li', 'tag tag-genre', game.genre));
    if (game.controls) {
      var ctl = el('li', 'tag tag-controls');
      ctl.appendChild(controlsIcon(game.controls));
      ctl.appendChild(document.createTextNode(game.controls));
      ctl.title = '主な操作';
      tags.appendChild(ctl);
    }
    return tags;
  }

  function titlePart(game) {
    var h3 = el('h3', 'card-title', game.title);
    if (game.subtitle) h3.appendChild(el('span', 'card-sub', game.subtitle));
    return h3;
  }

  function footPart(game, dateIso, dateSuffix) {
    var foot = el('div', 'card-foot');
    var maker = el('p', 'maker');
    maker.appendChild(el('span', 'maker-label', '制作AI'));
    maker.appendChild(el('span', 'maker-name', game.ai || 'Claude'));
    if (dateIso) {
      var date = el('time', 'maker-date', shortDate(dateIso) + ' ' + dateSuffix);
      date.dateTime = dateIso;
      maker.appendChild(date);
    }
    foot.appendChild(maker);

    var play = el('a', 'play');
    play.href = game.path;
    play.setAttribute('aria-label', '「' + fullTitle(game) + '」をプレイ');
    play.appendChild(svgIcon('0 0 10 12', 'M0 0l10 6-10 6z', 'play-icon'));
    play.appendChild(document.createTextNode('PLAY'));
    foot.appendChild(play);
    return foot;
  }

  /* ---------- WORLDS (one-prompt originals) ---------- */

  // reworks in BEYOND that started from this original folder
  function reworksOf(folder) {
    var found = [];
    beyond.forEach(function (entry, j) {
      if (toList(entry.basedOn).indexOf(folder) !== -1) found.push({ entry: entry, index: j });
    });
    return found;
  }

  function worldCard(game, i) {
    var li = cardShell(game, i);
    var thumb = thumbPart(game, i, 'WORLD', i + 1);

    var reworks = reworksOf(folderOf(game.path));
    if (reworks.length) {
      var links = el('div', 'beyond-links');
      reworks.forEach(function (r) {
        var st = STATUS[statusOf(r.entry)];
        var no = beyondNo(r.entry, r.index);
        var a = el('a', 'beyond-link ' + st.cls);
        a.href = 'beyond.html#' + beyondId(r.entry, r.index);
        a.setAttribute('aria-label', '「' + game.title + '」の改修版 BEYOND ' + pad(no) + '（' + st.label + '）を見る');
        a.appendChild(el('span', 'beyond-link-status', st.badge));
        a.appendChild(document.createTextNode('BEYOND ' + pad(no)));
        a.appendChild(el('span', 'beyond-link-arrow', '→'));
        links.appendChild(a);
      });
      thumb.appendChild(links);
    }

    li.appendChild(thumb);
    li.appendChild(tagsPart(game));
    li.appendChild(titlePart(game));
    li.appendChild(el('p', 'card-desc', game.description || ''));
    li.appendChild(footPart(game, game.createdDate, '作成'));
    return li;
  }

  function renderWorlds() {
    var list = document.getElementById('cards');
    var count = document.getElementById('world-count');
    if (!list) return;
    if (!games.length) {
      var empty = el('li', 'notice', '作品リストを読み込めませんでした。ページを再読み込みしてください。');
      list.appendChild(empty);
      return;
    }
    var frag = document.createDocumentFragment();
    games.forEach(function (g, i) { frag.appendChild(worldCard(g, i)); });
    list.appendChild(frag);
    if (count) count.textContent = pad(games.length) + (games.length === 1 ? ' WORLD' : ' WORLDS');
  }

  /* ---------- BEYOND ONE PROMPT (reworks) ---------- */

  // links back to the one-prompt original(s) on WORLDS, plus the changelog
  function originPart(entry) {
    var p = el('p', 'card-origin');
    var origins = toList(entry.basedOn);
    if (origins.length) {
      p.appendChild(el('span', 'card-origin-label', '原型'));
      origins.forEach(function (folder, k) {
        var idx = -1;
        for (var j = 0; j < games.length; j++) {
          if (folderOf(games[j].path) === folder) { idx = j; break; }
        }
        if (k > 0) p.appendChild(el('span', 'card-origin-sep', '・'));
        if (idx === -1) {
          p.appendChild(document.createTextNode(folder));
          return;
        }
        var a = el('a', null, 'WORLD ' + pad(idx + 1) + ' ' + games[idx].title);
        a.href = games[idx].path;
        a.setAttribute('aria-label', '原型「' + fullTitle(games[idx]) + '」をプレイ');
        p.appendChild(a);
      });
    }
    if (entry.changelog) {
      if (origins.length) p.appendChild(el('span', 'card-origin-sep', '／'));
      var log = el('a', null, '更新履歴');
      log.href = entry.changelog;
      p.appendChild(log);
    }
    return p;
  }

  function beyondCard(entry, i, order) {
    var li = cardShell(entry, order);
    li.id = beyondId(entry, i);

    var key = statusOf(entry);
    var status = el('li', 'tag tag-status ' + STATUS[key].cls, STATUS[key].label);
    if (entry.version) status.appendChild(el('span', 'tag-version', 'v' + entry.version));

    li.appendChild(thumbPart(entry, order, 'BEYOND', beyondNo(entry, i)));
    li.appendChild(tagsPart(entry, status));
    li.appendChild(titlePart(entry));

    var body = el('div', 'card-body');
    body.appendChild(el('p', 'card-desc', entry.description || ''));
    if (toList(entry.basedOn).length || entry.changelog) body.appendChild(originPart(entry));
    li.appendChild(body);

    li.appendChild(footPart(entry, entry.updatedDate, '更新'));
    return li;
  }

  function renderBeyond() {
    var root = document.getElementById('beyond');
    if (!root) return;

    var groups = { released: [], dev: [] };
    beyond.forEach(function (entry, i) { groups[statusOf(entry)].push({ entry: entry, index: i }); });

    ['released', 'dev'].forEach(function (key) {
      var section = document.getElementById('beyond-' + key);
      if (!section) return;
      var items = groups[key];
      section.hidden = !items.length;
      if (!items.length) return;
      var list = section.querySelector('.cards');
      var frag = document.createDocumentFragment();
      items.forEach(function (x, order) { frag.appendChild(beyondCard(x.entry, x.index, order)); });
      list.appendChild(frag);
      var count = section.querySelector('.gallery-count');
      if (count) count.textContent = pad(items.length) + (items.length === 1 ? ' WORLD' : ' WORLDS');
    });

    var empty = document.getElementById('beyond-empty');
    if (empty) empty.hidden = beyond.length > 0;

    // cards are built after parsing, so jump to beyond.html#beyondN by hand
    var id = decodeURIComponent(location.hash.slice(1));
    var target = id && document.getElementById(id);
    if (target && target.classList.contains('card')) {
      target.classList.add('is-target');
      target.scrollIntoView();
    }
  }

  function renderTabs() {
    var counts = { worlds: games.length, beyond: beyond.length };
    var nodes = document.querySelectorAll('[data-count]');
    for (var i = 0; i < nodes.length; i++) {
      var n = counts[nodes[i].getAttribute('data-count')];
      if (n != null) nodes[i].textContent = String(n);
    }
  }

  /* ---------- backdrop motes: one colour per world ---------- */
  function startMotes(list) {
    var canvas = document.getElementById('motes');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var colours = list.map(function (g) { return g.accent; }).filter(Boolean);
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

  renderTabs();
  renderWorlds();
  renderBeyond();
  var onBeyond = !!document.getElementById('beyond');
  try { startMotes(onBeyond && beyond.length ? beyond : games); } catch (e) { /* decoration only */ }
})();
