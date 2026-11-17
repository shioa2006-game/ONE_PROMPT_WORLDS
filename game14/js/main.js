/* main.js — game flow controller for 天下賽配 */
(function () {
  'use strict';
  const GD = window.GAME_DATA, Engine = window.Engine, MapView = window.MapView, UI = window.UI;
  const D = GD.DAIMYO, P = GD.PROVINCES;
  const $ = s => document.querySelector(s);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const SAVE_KEY = 'tenka-saihai-save-v1';
  const PREF_KEY = 'tenka-saihai-prefs-v1';
  const S = window.Sound || { play() {}, unlock() {}, startBgm() {}, stopBgm() {}, setMaster() {}, setSfx() {}, setBgm() {}, setMuted() {}, isMuted() { return true; }, getSettings() { return { master: .8, sfx: .9, bgm: .45, muted: false }; } };
  const snd = (n, o) => { try { S.play(n, o); } catch (e) { /* ignore */ } };
  const ORDER_KANJI = { attack: '攻', raid: '奇', plot: '謀', recruit: '募', develop: '興', move: '移' };
  const ABORT = { abort: true };   // thrown by wait() when the game session changed mid-animation
  const guard = fn => async function (...a) { try { return await fn.apply(this, a); } catch (e) { if (e !== ABORT) throw e; } };
  const SNOW = new Set(P.map((p, i) => (p.snow ? i : -1)).filter(i => i >= 0));
  const MAPSCALE = 900 / window.MAPDATA.h, MAPOX = (1060 - window.MAPDATA.w * MAPSCALE) / 2;
  const toStage = (x, y) => [MAPOX + x * MAPSCALE, y * MAPSCALE];

  const A = {
    st: null, me: -1, phase: 'title', sel: [], prov: -1, src: null, commit: null, amount: null, busy: false, undo: [],
    speed: 1, skip: false, selPick: 19, firstGame: true, endArmed: false, hoverPid: -1, gen: 0,

    // ================================================================ boot
    init() {
      this.fit(); window.addEventListener('resize', () => this.fit());
      this.makeSea();
      MapView.init($('#map'), window.MAPDATA);
      FX.init($('#fxcanvas'), $('#clouds'));
      FX.setTransform(MAPSCALE, MAPOX, 0);
      this.loadPrefs();
      MapView.on('click', (pid, e) => this.onProvince(pid, e));
      MapView.on('rclick', () => this.clearSel());
      MapView.on('bg', () => { if (this.phase === 'orders' || this.phase === 'roll') { this.prov = -1; this.refresh(); } });
      MapView.on('hover', (pid, e) => this.onHover(pid, e));
      MapView.on('leave', pid => { MapView.hover(pid, false); this.hoverPid = -1; UI.tooltip(null, -1); });
      $('#map').addEventListener('mousemove', e => { if (this.hoverPid >= 0) this.moveTip(e); });
      // buttons
      $('#btn-new').onclick = () => { this.unlock(); snd('click'); this.showSelect(); };
      $('#btn-continue').onclick = () => { this.unlock(); snd('click'); this.continueGame(); };
      $('#btn-howto').onclick = () => { this.unlock(); snd('open'); this.showHowto(); };
      $('#btn-howto-close').onclick = () => { snd('cancel'); $('#scr-howto').classList.add('hidden'); };
      $('#btn-sel-back').onclick = () => { snd('cancel'); this.showTitle(); };
      $('#btn-sel-go').onclick = () => { snd('horn'); this.startGame(this.selPick); };
      $('#btn-roll').onclick = () => this.roll();
      $('#btn-end').onclick = () => this.tryEnd();
      $('#btn-sound').onclick = () => { this.unlock(); const m = !S.isMuted(); S.setMuted(m); this.syncSoundIcon(); this.savePrefs(); };
      $('#btn-menu').onclick = () => { snd('open'); this.openMenu(); };
      $('#btn-menu-close').onclick = () => { snd('cancel'); $('#scr-menu').classList.add('hidden'); };
      $('#btn-menu-howto').onclick = () => { snd('open'); this.showHowto(); };
      $('#btn-menu-rank').onclick = () => { snd('open'); this.showRank(); };
      $('#btn-menu-title').onclick = () => { snd('cancel'); $('#scr-menu').classList.add('hidden'); this.showTitle(); };
      $('#btn-rank-close').onclick = () => { snd('cancel'); $('#scr-rank').classList.add('hidden'); };
      $('#powerbar').onclick = () => { snd('open'); this.showRank(); };
      $('#minilog').onclick = () => { snd('open'); this.showRank(); };
      $('#btn-retry').onclick = () => { snd('horn'); $('#scr-result').classList.add('hidden'); this.startGame(this.me); };
      $('#btn-reselect').onclick = () => { snd('click'); $('#scr-result').classList.add('hidden'); this.showSelect(); };
      $('#btn-totitle').onclick = () => { snd('cancel'); $('#scr-result').classList.add('hidden'); this.showTitle(); };
      ['master', 'sfx', 'bgm'].forEach(k => { $('#vol-' + k).oninput = e => { const v = e.target.value / 100; S['set' + k[0].toUpperCase() + k.slice(1)](v); this.savePrefs(); }; });
      $('#vol-mute').onchange = e => { S.setMuted(e.target.checked); this.syncSoundIcon(); this.savePrefs(); };
      $('#opt-speed').onchange = e => { this.speed = +e.target.value; this.savePrefs(); };
      document.addEventListener('keydown', e => this.onKey(e));
      document.addEventListener('pointerdown', () => this.unlock(), { once: true });
      $('#mapwrap').addEventListener('click', () => { if (this.phase === 'cpu') this.skip = true; }, true);
      this.showTitle();
    },
    unlock() { try { S.unlock(); } catch (e) { /* ignore */ } },
    fit() {
      const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
      $('#stage').style.transform = `scale(${s})`;
      this.stageScale = s;
    },
    makeSea() {
      const c = document.createElement('canvas'); c.width = 96; c.height = 48;
      const g = c.getContext('2d'); g.fillStyle = '#122a47'; g.fillRect(0, 0, 96, 48);
      const draw = (x, y) => {
        g.beginPath(); g.arc(x, y, 24, Math.PI, 0); g.closePath(); g.fillStyle = '#122a47'; g.fill();
        for (let r = 24; r > 0; r -= 6) { g.beginPath(); g.arc(x, y, r, Math.PI, 0); g.strokeStyle = `rgba(130,180,225,${0.09 + 0.06 * (r / 24)})`; g.lineWidth = 1.4; g.stroke(); }
      };
      for (const y of [0, 12, 24, 36, 48, 60]) { const off = (y / 12) % 2 ? 24 : 0; for (let x = -48; x <= 144; x += 48) draw(x + off, y); }
      $('#sea').style.backgroundImage = `url(${c.toDataURL()})`;
    },
    loadPrefs() {
      let p = null; try { p = JSON.parse(localStorage.getItem(PREF_KEY) || 'null'); } catch (e) { p = null; }
      const s = S.getSettings ? S.getSettings() : { master: .8, sfx: .9, bgm: .45, muted: false };
      const v = Object.assign({ master: s.master, sfx: s.sfx, bgm: s.bgm, muted: s.muted, speed: 1, seen: false }, p || {});
      try { S.setMaster(v.master); S.setSfx(v.sfx); S.setBgm(v.bgm); S.setMuted(!!v.muted); } catch (e) { /* ignore */ }
      $('#vol-master').value = Math.round(v.master * 100); $('#vol-sfx').value = Math.round(v.sfx * 100); $('#vol-bgm').value = Math.round(v.bgm * 100);
      $('#vol-mute').checked = !!v.muted; this.speed = v.speed || 1; $('#opt-speed').value = String(this.speed);
      this.firstGame = !v.seen;
      this.syncSoundIcon();
    },
    savePrefs() {
      const v = { master: $('#vol-master').value / 100, sfx: $('#vol-sfx').value / 100, bgm: $('#vol-bgm').value / 100, muted: S.isMuted(), speed: this.speed, seen: !this.firstGame };
      try { localStorage.setItem(PREF_KEY, JSON.stringify(v)); } catch (e) { /* ignore */ }
    },
    syncSoundIcon() { $('#btn-sound').classList.toggle('muted', S.isMuted()); $('#vol-mute').checked = S.isMuted(); },
    wait(ms) {
      if (this.skip) ms = Math.min(ms, 25);
      const g = this.gen;
      return new Promise((res, rej) => setTimeout(() => (g === this.gen ? res() : rej(ABORT)), ms / this.speed));
    },
    newSession() { this.gen++; this.busy = false; this.skip = false; this.endArmed = false; $('#battle-pop').classList.add('hidden'); $('#cpu-skip').classList.add('hidden'); },

    // ================================================================ screens
    hideScreens() { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); },
    setWide(on) {
      $('#stage').classList.toggle('wide', on);
      const W = on ? 1600 : 1060; const cv = $('#fxcanvas'); cv.width = W; cv.style.width = W + 'px';
      FX.setTransform(MAPSCALE, (W - window.MAPDATA.w * MAPSCALE) / 2, 0);
      MapView.ox = (W - window.MAPDATA.w * MAPSCALE) / 2;
    },
    showTitle() {
      this.newSession();
      this.phase = 'title'; this.hideScreens(); $('#scr-title').classList.remove('hidden'); this.setWide(true);
      $('#side').classList.add('hidden'); $('#season-badge').classList.add('hidden');
      const st = Engine.create({ player: -1, seed: 1 }); this.syncMap(st, -1); MapView.clearMarks(); MapView.setSeason(2, SNOW); FX.setSeason(2);
      let has = false;
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) { let sv = null; try { sv = Engine.deserialize(raw); } catch (e2) { sv = null; } if (sv && !sv.over) has = true; else localStorage.removeItem(SAVE_KEY); }
      } catch (e) { has = false; }
      $('#btn-continue').disabled = !has;
      const td = $('#title-dice'); td.innerHTML = '';
      [6, 1, 3].forEach((v, i) => { const d = Dice3D.buildDie(62); td.appendChild(d); Dice3D.setFace(d, v, (i - 1) * 9); });
      try { S.startBgm('title'); } catch (e) { /* ignore */ }
    },
    showHowto() { $('#howto-body').innerHTML = UI.howtoHTML(); $('#scr-howto').classList.remove('hidden'); },
    showRank() { $('#rank-table').innerHTML = UI.rankTable(this.st, this.me); $('#scr-rank').classList.remove('hidden'); },
    openMenu() { this.syncSoundIcon(); $('#scr-menu').classList.remove('hidden'); },

    showSelect() {
      this.newSession();
      this.phase = 'select'; this.hideScreens(); $('#scr-select').classList.remove('hidden'); this.setWide(false);
      $('#side').classList.add('hidden'); $('#season-badge').classList.add('hidden');
      const st = Engine.create({ player: -1, seed: 1 }); this.selSt = st; this.syncMap(st, -1);
      const grid = $('#sel-grid'); grid.innerHTML = '';
      const order = D.map((_, i) => i).sort((a, b) => (GD.DIFF[a] || 3) - (GD.DIFF[b] || 3) || a - b);
      order.forEach(i => {
        const it = h('div', 'sg-item', `<div class="sg-flag" style="${UI.flagStyle(i)}">${D[i].mon}</div><div class="sg-name">${D[i].short || D[i].clan}</div><div class="sg-stars">${'★'.repeat(GD.DIFF[i] || 3)}</div>`);
        it.onclick = () => { snd('click'); this.pickDaimyo(i); };
        it.dataset.id = i; grid.appendChild(it);
      });
      this.pickDaimyo(this.selPick);
      try { S.startBgm('title'); } catch (e) { /* ignore */ }
    },
    pickDaimyo(i) {
      this.selPick = i;
      document.querySelectorAll('.sg-item').forEach(e => e.classList.toggle('sel', +e.dataset.id === i));
      MapView.clearMarks(); MapView.markSelected(i);
      const adj = Engine.adjacency()[i];
      adj.forEach(q => MapView.markTarget(q, i, 'enemy'));
      const p = P[i], d = D[i], diff = GD.DIFF[i] || 3;
      const DL = ['', '易しい', 'やや易しい', '普通', '難しい', '至難'];
      const nb = adj.map(q => `${P[q].name}<span style="color:#8a6a3a">(${D[q].short || D[q].clan} ${P[q].econ}/${P[q].mil}/${P[q].def})</span>`).join('、');
      $('#sel-card').innerHTML = `
        <div class="sc-top"><div class="sc-flag" style="${UI.flagStyle(i)}">${d.mon}</div>
          <div><div class="sc-clan">${d.short || d.clan + '家'}</div><div class="sc-lord">${d.name}</div><div class="sc-prov">本拠：${p.name}　兵 ${Engine.RULES.troopsStartBase + Engine.RULES.troopsStartMul * p.mil}</div></div></div>
        <div class="sc-diff"><div class="stars">${'★'.repeat(diff)}${'☆'.repeat(5 - diff)}</div><div class="lbl">難易度：${DL[diff]}</div></div>
        <div class="sc-stats">
          <span>経済力</span><div class="sc-bar econ"><i style="width:${p.econ * 20}%"></i></div><b>${p.econ}</b>
          <span>軍事力</span><div class="sc-bar mil"><i style="width:${p.mil * 20}%"></i></div><b>${p.mil}</b>
          <span>守備力</span><div class="sc-bar def"><i style="width:${p.def * 20}%"></i></div><b>${p.def}</b>
        </div>
        <div class="sc-text">${(GD.FLAVOR[i] || '')}</div>
        <div class="sc-nb">隣国（経済/軍事/守備）：${nb}</div>`;
    },
    startGame(pid) {
      this.newSession();
      this.unlock();
      this.me = pid; this.selPick = pid;
      const seed = (Math.random() * 4294967295) >>> 0;
      this.st = Engine.create({ player: pid, seed });
      this.hideScreens(); this.setWide(false); $('#side').classList.remove('hidden'); $('#season-badge').classList.remove('hidden');
      this.sel = []; this.prov = -1;
      try { S.startBgm('map'); } catch (e) { /* ignore */ }
      this.syncMap(this.st, pid);
      this.beginSeason(true);
    },
    continueGame() {
      this.newSession();
      let st = null; try { st = Engine.deserialize(localStorage.getItem(SAVE_KEY)); } catch (e) { st = null; }
      if (!st || st.over) { $('#btn-continue').disabled = true; return; }
      this.st = st; this.me = st.player; this.selPick = st.player;
      this.hideScreens(); this.setWide(false); $('#side').classList.remove('hidden'); $('#season-badge').classList.remove('hidden');
      this.sel = []; this.prov = -1;
      try { S.startBgm('map'); } catch (e) { /* ignore */ }
      this.syncMap(st, this.me);
      MapView.setSeason(Engine.seasonOf(st), SNOW); FX.setSeason(Engine.seasonOf(st));
      this.phase = st.dmy[this.me].dice.length ? 'orders' : 'roll';
      this.refresh(true);
      UI.center(Engine.dateLabel(st).era + ' ' + Engine.dateLabel(st).season, 'つづきから');
    },
    save() { try { localStorage.setItem(SAVE_KEY, Engine.serialize(this.st)); } catch (e) { /* ignore */ } },
    clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } },

    // ================================================================ map sync
    syncMap(st, me) {
      st.provs.forEach((p, i) => { MapView.setOwner(i, D[p.owner].color, D[p.owner].mon); MapView.setTroops(i, p.troops); });
      MapView.setPlayerProvinces(new Set(me >= 0 ? Engine.owned(st, me) : []));
    },

    // ================================================================ season flow
    beginSeason: guard(async function (first) {
      const st = this.st;
      this.phase = 'anim';
      const ev = Engine.startSeason(st);
      const dl = Engine.dateLabel(st);
      MapView.setSeason(dl.s, SNOW); FX.setSeason(dl.s);
      this.syncMap(st, this.me);
      this.refresh(true);
      snd(dl.s === 3 ? 'snow' : 'season');
      UI.center(dl.era + '　' + dl.season, first ? `${D[this.me].name}、${P[this.me].name}にて天下を窺う（この季節は合戦なし）` : (dl.s === 2 ? '収穫の秋 ― 収入二倍' : dl.s === 3 ? '雪国は出陣できない' : ''), first);
      const inc = ev.find(e => e.type === 'income');
      if (inc && inc.gold) {
        await this.wait(first ? 700 : 450);
        snd(inc.harvest ? 'harvest' : 'gold');
        MapView.floatText(this.me, `+${inc.gold}金`, '', -12);
      }
      await this.wait(first ? 900 : 500);
      this.phase = 'roll';
      this.sel = []; this.prov = -1;
      this.save();
      this.refresh();
      if (this.firstGame && first) this.firstHint = 1;
    }),
    roll: guard(async function () {
      if (this.phase !== 'roll' || this.busy) return;
      this.unlock();
      this.busy = true;
      const vals = Engine.rollDice(this.st, this.me);
      this.undo = [];
      this.phase = 'orders';
      snd('shake');
      this.renderDice(true);
      await this.wait(120);
      snd('roll', { n: vals.length });
      const slots = [...document.querySelectorAll('.die-slot')];
      const g0 = this.gen;
      await Promise.all(slots.map((s, i) => Dice3D.tumble(s.querySelector('.die3d'), vals[i], 700 + i * 70, i * 40)));
      if (g0 !== this.gen) return;
      const counts = {}; vals.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
      if (Object.values(counts).some(c => c >= 2)) { snd('zorome'); }
      this.busy = false;
      this.renderDice(false);
      this.save();
      this.refresh();
    }),
    tryEnd() {
      if (this.phase !== 'orders' && this.phase !== 'roll') return;
      if (this.busy) return;
      if (this.phase === 'roll') { this.roll(); return; }
      const left = this.st.dmy[this.me].dice.filter(d => !d.used).length;
      if (left > 0 && !this.endArmed) {
        this.endArmed = true; snd('error');
        const b = $('#btn-end'); b.innerHTML = `賽が${left}つ残っています<small>もう一度で終了：最大の目→備え、他は金</small>`;
        clearTimeout(this.endT); this.endT = setTimeout(() => { this.endArmed = false; this.refresh(); }, 2600);
        return;
      }
      this.endArmed = false;
      snd('turnend');
      this.endSeason();
    },
    endSeason: guard(async function () {
      const st = this.st;
      this.undo = [];
      const goldBefore = st.dmy[this.me].gold;
      const sonae = Engine.closeTurn(st, this.me);
      const gain = st.dmy[this.me].gold - goldBefore;
      this.phase = 'cpu'; this.sel = []; this.prov = -1; this.skip = false;
      MapView.clearMarks(); MapView.clearThreats(); UI.tooltip(null, -1);
      this.refresh();
      if (sonae) { snd('place'); MapView.floatText(this.me, `備え${sonae}`, 'blue', -14); }
      if (gain > 0) MapView.floatText(this.me, `+${gain}金`, '', 10);
      if (sonae || gain) await this.wait(450);
      $('#cpu-skip').classList.remove('hidden');
      const before = st.provs.map(p => ({ owner: p.owner, troops: p.troops }));
      const evs = Engine.runCPU(st);
      // replay from the "before" picture
      before.forEach((b, i) => { MapView.setOwner(i, D[b.owner].color, D[b.owner].mon); MapView.setTroops(i, b.troops); });
      const g = this.gen;
      await this.replayCPU(evs, before);
      if (g !== this.gen) return;
      $('#cpu-skip').classList.add('hidden');
      Engine.endSeason(st);
      this.syncMap(st, this.me);
      if (st.over) { this.finish(); return; }
      this.skip = false;
      this.beginSeason(false);
    }),
    async replayCPU(evs, before) {
      const me = this.me, st = this.st;
      const owners = before.map(b => b.owner);
      const pending = [];
      let shown = 0;
      for (const e of evs) {
        if (st.over && st.over.kind === 'defeat' && shown > 30) break;
        if (e.text && !['fall', 'coalition', 'coalition-end'].includes(e.type)) continue; // plain log entries
        if (e.type === 'battle') {
          if (e.defender === me) {
            await this.animBattle(e, true);
            owners[e.to] = e.win ? e.d : owners[e.to];
            shown++;
          } else if (e.win) {
            // CPU-vs-CPU capture: staggered, overlapping animations so busy seasons stay short
            snd('cpu');
            MapView.marchLine(e.from, e.to);
            const to = e.to, col = D[e.d].color, mon = D[e.d].mon, occ = e.occupy, from = e.from;
            await this.wait(90);
            MapView.setTroops(to, occ);
            const g1 = this.gen;
            const prom = MapView.inkSpread(to, col, from, 380 / this.speed).then(() => { if (g1 === this.gen) MapView.setOwner(to, col, mon); });
            MapView.stamp(to, mon, col, false);
            pending.push(prom);
            owners[to] = e.d;
            await this.wait(150);
            shown++;
          } else if (e.d !== me) {
            const done = MapView.battleMark(e.from, e.to);
            setTimeout(done, 260 / this.speed);
          }
        } else if (e.type === 'fall') {
          snd(e.d === me ? 'defeat' : 'fall');
          UI.center(`${D[e.d].short || D[e.d].clan}家 滅亡`, `${D[e.by].name}に滅ぼされる`);
          await this.wait(e.d === me ? 1100 : 650);
        } else if (e.type === 'coalition') {
          snd('warn');
          UI.center(`${D[e.d].short || D[e.d].clan}包囲網`, e.d === me ? '諸大名があなたを狙っている' : '諸大名が結束した', e.d === me);
          await this.wait(e.d === me ? 1300 : 700);
        } else if (e.type === 'plot' && e.defender === me) {
          snd('error');
          MapView.marchLine(e.to, e.from, 'own');
          MapView.floatText(e.to, `−${e.steal}兵 調略`, 'bad');
          MapView.setTroops(e.to, Math.max(0, +MapView.prov[e.to].num.textContent - e.steal));
          await this.wait(450);
        }
      }
      await Promise.all(pending);
      MapView.setPlayerProvinces(new Set(Engine.owned(st, me)));
      this.refresh();
    },

    // ================================================================ battle animation
    async animBattle(e, defending) {
      const me = this.me;
      const att = e.d, def = e.defender;
      const pop = $('#battle-pop');
      const [ax, ay] = toStage(...MapView.pt(e.to));
      let px = ax - 160, py = ay - 210;
      if (py < 8) py = ay + 40;
      px = Math.max(8, Math.min(1060 - 328, px));
      pop.style.left = px + 'px'; pop.style.top = py + 'px';
      const kind = e.raid ? '<span class="k raid">奇襲</span>' : (e.home ? '<span class="k siege">本城攻め</span>' : '<span class="k">力攻め</span>');
      pop.innerHTML = `<div class="bp-head"><span>${P[e.from].name} → ${P[e.to].name}</span>${kind}</div>
        <div class="bp-vs">
          <div class="bp-side"><div class="bp-who" style="color:${D[att].color}">${D[att].short || D[att].clan}</div><div class="bp-n">${e.ap}</div><div class="bp-f">兵${e.commit}＋出目${e.dv.v}</div></div>
          <div class="bp-mid" id="bp-die"></div>
          <div class="bp-side"><div class="bp-who" style="color:${D[def].color}">${D[def].short || D[def].clan}</div><div class="bp-n" id="bp-dn">${e.defTroops + e.castle}＋?</div><div class="bp-f">${e.raid ? `兵${e.defTroops}＋城${e.castle}（🎲なし）` : `兵${e.defTroops}＋城${e.castle}＋🎲${e.sonae ? '（備え' + e.sonae + '）' : ''}`}</div></div>
        </div><div class="bp-res" id="bp-res"></div>`;
      pop.classList.remove('hidden');
      const done = MapView.battleMark(e.from, e.to);
      snd(defending ? 'warn' : 'horn');
      if (e.raid) {
        $('#bp-die').innerHTML = '<span style="font-size:28px">🌙</span>';
        $('#bp-dn').textContent = e.defTroops;
        await this.wait(defending ? 300 : 420);
      } else {
        const die = Dice3D.buildDie(46); $('#bp-die').appendChild(die); Dice3D.setFace(die, 1, 0);
        await this.wait(defending ? 180 : 380);
        snd('roll', { n: 1 });
        await Promise.race([Dice3D.tumble(die, e.raw || e.roll, defending ? 380 : 620, 0), this.wait(defending ? 380 : 620)]);
        if (e.sonae && e.raw < e.sonae) {
          await this.wait(160);
          snd('stamp'); Dice3D.tumble(die, e.roll, 220, 0);
          $('#bp-die').insertAdjacentHTML('beforeend', `<div class="bp-sonae">備え${e.sonae}</div>`);
          await this.wait(240);
        }
      }
      $('#bp-dn').textContent = e.dp;
      snd('clash');
      const res = $('#bp-res');
      const iWon = (e.win && att === me) || (!e.win && def === me);
      res.textContent = e.win ? (att === me ? '勝利' : '落城') : (def === me ? '撃退' : '敗退');
      res.className = 'bp-res ' + (iWon ? 'win' : 'lose');
      await this.wait(260);
      done();
      if (e.win) {
        MapView.setTroops(e.to, e.occupy);
        const gB = this.gen;
        const prom = MapView.inkSpread(e.to, D[att].color, e.from, 620 / this.speed);
        snd(att === me ? 'conquest' : 'lose', att === me ? { big: e.defLoss >= 8 || this.st.dmy[def].alive === false } : undefined);
        MapView.stamp(e.to, D[att].mon, D[att].color, att === me, e.crush);
        const [x, y] = MapView.pt(e.to);
        if (att === me) { FX.burst(x, y, D[att].color, e.crush ? 80 : 48, 'petal'); FX.ring(x, y, '#ffe08a'); if (e.crush) { MapView.floatText(e.to, `圧勝！国衆+${Engine.RULES.crushBonus}`, 'good', -20); } else if (e.raid) MapView.floatText(e.to, '奇襲成功', 'blue', -20); }
        await prom;
        if (gB !== this.gen) throw ABORT;
        MapView.setOwner(e.to, D[att].color, D[att].mon);
        MapView.setPlayerProvinces(new Set(Engine.owned(this.st, me)));
        if (att === me) MapView.pulse(e.to);
      } else {
        snd(att === me ? 'lose' : 'win');
        MapView.floatText(e.from, `−${e.loss}兵`, 'bad');
        if (e.defLoss) MapView.floatText(e.to, `−${e.defLoss}兵`, 'bad', 16);
      }
      await this.wait(defending ? 300 : 520);
      pop.classList.add('hidden');
    },

    // ================================================================ input
    onKey(e) {
      const vis = id => !document.getElementById(id).classList.contains('hidden');
      const overlay = ['scr-rank', 'scr-howto', 'scr-menu'].find(vis);
      if (overlay || vis('scr-result') || this.phase === 'title' || this.phase === 'select') {
        if (e.key === 'Escape' && overlay) document.getElementById(overlay).classList.add('hidden');
        return; // let focused buttons work natively; no game hotkeys under overlays
      }
      if (this.phase === 'anim' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); return; }
      if (e.key === 'Escape') { if (!$('#scr-menu').classList.contains('hidden')) { $('#scr-menu').classList.add('hidden'); return; } this.clearSel(); return; }
      if (this.phase === 'cpu' && (e.key === ' ' || e.key === 'Enter')) { this.skip = true; e.preventDefault(); return; }
      if (this.phase !== 'roll' && this.phase !== 'orders') return;
      if (e.key === ' ') { e.preventDefault(); if (this.phase === 'roll') this.roll(); return; }
      if (e.key === 'Enter') { e.preventDefault(); this.tryEnd(); return; }
      if ((e.key === 'z' && (e.ctrlKey || e.metaKey)) || e.key === 'Backspace') { e.preventDefault(); this.undoLast(); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 6 && this.phase === 'orders') this.toggleDie(n - 1, e.shiftKey);
    },
    clearSel() { if (this.busy) return; this.sel = []; this.prov = -1; this.src = null; this.commit = null; this.amount = null; this.refresh(); },
    toggleDie(i, add) {
      if (this.phase !== 'orders' || this.busy) return;
      const dice = this.st.dmy[this.me].dice;
      if (!dice[i] || dice[i].used) return;
      snd('pick');
      if (this.sel.includes(i)) this.sel = this.sel.filter(x => x !== i);
      else if (this.sel.length && dice[this.sel[0]].v === dice[i].v && this.sel.length < Engine.RULES.stackMax) { this.sel = this.sel.concat([i]); snd('combine'); }
      else this.sel = [i];
      this.src = null; this.commit = null; this.amount = null;
      this.refresh();
    },
    onProvince(pid) {
      if (this.phase === 'select') { snd('click'); this.pickDaimyo(pid); return; }
      if (this.phase !== 'orders' && this.phase !== 'roll') return;
      if (this.busy) return;
      snd('click');
      this.prov = this.prov === pid && !this.sel.length ? -1 : pid;
      this.src = null; this.commit = null; this.amount = null;
      this.refresh();
    },
    onHover(pid, e) {
      MapView.hover(pid, true); snd('hover');
      if (this.phase === 'cpu' || this.phase === 'anim') { this.hoverPid = -1; UI.tooltip(null, -1); return; }
      this.hoverPid = pid;
      this.lastHoverEvent = e; this.moveTip(e);
    },
    moveTip(e) {
      const r = $('#stage').getBoundingClientRect();
      const x = (e.clientX - r.left) / this.stageScale, y = (e.clientY - r.top) / this.stageScale;
      const st = this.phase === 'select' || this.phase === 'title' ? this.selSt || Engine.create({ player: -1, seed: 1 }) : this.st;
      if (!st || this.phase === 'title') return;
      let extra = '';
      if (this.phase === 'orders' && this.sel.length) {
        const q = st.provs[this.hoverPid];
        if (q.owner !== this.me) {
          const best = this.bestAttack(this.hoverPid);
          if (best) extra = `${best.c.calc.raid ? '奇襲' : '力攻め'} 勝算 ${Math.round(best.c.calc.pWin * 100)}%`;
        }
      }
      UI.tooltip(st, this.hoverPid, x, y, this.me, extra);
    },

    // ================================================================ order helpers
    dv() { return this.sel.length ? Engine.dieValue(this.st, this.me, this.sel) : null; },
    sources(q) {
      const adj = Engine.adjacency()[q];
      return adj.filter(p => this.st.provs[p].owner === this.me);
    },
    bestAttack(q) {
      const st = this.st; if (!this.sel.length) return null;
      let best = null;
      for (const p of this.sources(q)) {
        const c = Engine.check(st, { type: 'attack', d: this.me, dice: this.sel, from: p, to: q });
        if (!c.ok) continue;
        if (!best || c.calc.pWin > best.c.calc.pWin || (c.calc.pWin === best.c.calc.pWin && c.commit > best.c.commit)) best = { p, c };
      }
      return best;
    },
    doOrder: guard(async function (o) {
      if (this.busy) return;
      const st = this.st;
      const chk = Engine.check(st, o);
      if (!chk.ok) { snd('error'); return; }
      this.busy = true;
      const deterministic = o.type !== 'attack' || chk.calc.raid;
      if (deterministic) { this.undo.push({ json: Engine.serialize(st), kanji: JSON.stringify(this.lastKanji || {}) }); if (this.undo.length > 12) this.undo.shift(); }
      else this.undo = [];
      MapView.clearMarks();
      const kanji = o.type === 'attack' ? (chk.calc.raid ? '奇' : '攻') : ORDER_KANJI[o.type];
      const prevDice = Engine.diceCount(st, this.me);
      const r = Engine.execute(st, o);
      this.lastKanji = this.lastKanji || {}; o.dice.forEach(i => { this.lastKanji[i] = kanji; });
      this.sel = []; this.src = null; this.commit = null; this.amount = null;
      this.renderDice(false);
      this.refresh(true);
      const g = this.gen;
      for (const e of r.events) await this.animOrder(e);
      if (g !== this.gen) return;
      this.syncMap(st, this.me);
      this.busy = false;
      if (st.over) { this.finish(); return; }
      const nowDice = Engine.diceCount(st, this.me);
      if (nowDice > prevDice) { snd('diceup'); UI.center('采配ダイス＋１', `領国${Engine.countOwned(st, this.me)}国 ― 次の季節から${nowDice}個`); }
      // keep province selected for quick repeated commands on own province
      this.prov = (o.type === 'recruit' || o.type === 'develop') ? o.at : -1;
      this.save();
      this.refresh();
    }),
    async animOrder(e) {
      const me = this.me;
      if (e.text && e.type !== 'fall') return; // log entries (conquest/plot/grow...) are not animated here
      switch (e.type) {
        case 'battle': await this.animBattle(e, false); break;
        case 'conquest': break;
        case 'fall':
          snd('fall');
          UI.center(`${D[e.d].short || D[e.d].clan}家 滅亡`, `${D[e.by].name}が滅ぼす`, true);
          { const [x, y] = MapView.pt(e.p); FX.burst(x, y, '#ffe08a', 70, 'spark'); }
          await this.wait(1000);
          break;
        case 'plot':
          snd('place');
          MapView.marchLine(e.to, e.from, 'own');
          await this.wait(260);
          MapView.floatText(e.to, `−${e.steal}`, 'bad');
          MapView.floatText(e.from, `+${e.steal}兵 寝返り`, 'blue');
          MapView.setTroops(e.to, this.st.provs[e.to].troops); MapView.setTroops(e.from, this.st.provs[e.from].troops);
          await this.wait(380);
          break;
        case 'recruit':
          snd('recruit');
          MapView.pulse(e.at);
          MapView.floatText(e.at, `+${e.gain}兵`, 'good');
          MapView.floatText(e.at, `−${e.cost}金`, '', 18);
          MapView.setTroops(e.at, this.st.provs[e.at].troops);
          await this.wait(420);
          break;
        case 'develop': {
          const nm = UI.STAT[e.stat];
          if (e.ups > 0) {
            snd('statup');
            MapView.floatText(e.at, `${nm}力 ${e.lvl}！`, 'good');
            const [x, y] = MapView.pt(e.at); FX.burst(x, y, '#9fe07a', 40, 'spark'); FX.ring(x, y, '#9fe07a');
            MapView.pulse(e.at);
          } else {
            snd('develop');
            MapView.floatText(e.at, `${nm} ${e.prog}/${e.need}`, '');
          }
          await this.wait(e.ups ? 650 : 360);
          break;
        }
        case 'move':
          snd('march');
          MapView.marchLine(e.from, e.to, 'own');
          await this.wait(300);
          MapView.setTroops(e.from, this.st.provs[e.from].troops); MapView.setTroops(e.to, this.st.provs[e.to].troops);
          MapView.floatText(e.to, `+${e.amount}`, 'blue');
          await this.wait(250);
          break;
      }
    },

    // ================================================================ rendering
    refresh(noCmd) {
      const st = this.st; if (!st) return;
      UI.renderHeader(st, this.me);
      UI.renderSeason(st);
      UI.renderMiniLog(st, this.me);
      this.renderDice(false);
      this.renderMarks();
      if (!noCmd) this.renderCmd();
      const b = $('#btn-end');
      const left = st.dmy[this.me].dice.filter(d => !d.used).length;
      b.disabled = !(this.phase === 'orders');
      b.classList.toggle('ready', this.phase === 'orders' && left === 0);
      if (!this.endArmed) b.innerHTML = '季節を終える<small>Enter</small>';
      $('#btn-roll').classList.toggle('hidden', this.phase !== 'roll');
      const n = Engine.diceCount(st, this.me), nx = Engine.nextDiceAt(st, this.me);
      $('#dice-count').textContent = `采配ダイス ${n}個`;
      $('#dice-next').textContent = nx ? `あと${nx - Engine.countOwned(st, this.me)}国で＋1個` : '最大';
    },
    renderDice(rolling) {
      const st = this.st; const row = $('#dice-row');
      const dice = st.dmy[this.me].dice;
      if (this.phase === 'roll' || !dice.length) {
        row.innerHTML = ''; this.lastKanji = {};
        const n0 = document.querySelector('#tray .tw-note'); if (n0) n0.remove();
        const b0 = document.querySelector('#tray .buy-btn'); if (b0) b0.remove();
        return;
      }
      const need = rolling || row.children.length !== dice.length;
      if (need) {
        row.innerHTML = '';
        dice.forEach((dd, i) => {
          const slot = h('div', 'die-slot');
          const die = Dice3D.buildDie(60);
          slot.appendChild(die);
          if (!rolling) Dice3D.setFace(die, dd.v, ((i * 37) % 13) - 6);
          const tip = h('div', 'face-tip'); slot.appendChild(tip);
          const mi = h('div', 'tw minus', '−'), pl = h('div', 'tw plus', '+'), rr = h('div', 'tw rr', '↻');
          mi.title = '金2で出目−1'; pl.title = '金2で出目+1'; rr.title = '無料で振り直し（季節に1回）';
          mi.onclick = ev => { ev.stopPropagation(); this.tweak(i, -1); };
          pl.onclick = ev => { ev.stopPropagation(); this.tweak(i, 1); };
          rr.onclick = ev => { ev.stopPropagation(); this.reroll(i); };
          slot.appendChild(mi); slot.appendChild(pl); slot.appendChild(rr);
          slot.onclick = ev => this.toggleDie(i, ev.shiftKey);
          row.appendChild(slot);
        });
      }
      if (rolling) return;
      const R = Engine.RULES;
      [...row.children].forEach((slot, i) => {
        const dd = dice[i];
        const die = slot.querySelector('.die3d');
        if (+die.dataset.v !== dd.v) Dice3D.setFace(die, dd.v, ((i * 37) % 13) - 6);
        slot.classList.toggle('used', dd.used);
        slot.classList.toggle('sel', this.sel.includes(i));
        slot.classList.toggle('lowface', dd.v <= R.plotMax);
        slot.classList.toggle('linked', this.sel.length > 1 && this.sel.includes(i));
        let tag = slot.querySelector('.used-tag');
        if (dd.used) { if (!tag) { tag = h('div', 'used-tag'); slot.appendChild(tag); } tag.textContent = (this.lastKanji && this.lastKanji[i]) || '済'; }
        else if (tag) tag.remove();
        const tip = slot.querySelector('.face-tip');
        tip.innerHTML = dd.used ? '' : `<span class="bu">攻${dd.v}</span><span class="se">政${7 - dd.v}</span>${dd.v <= R.raidMax ? '<span class="sp">奇</span>' : ''}`;
        const gold = st.dmy[this.me].gold, tw = st.dmy[this.me].tweaks || 0;
        const noTw = gold < R.tweakCost || this.sel.length > 1 || tw >= R.tweakMax;
        slot.querySelector('.minus').classList.toggle('off', dd.v <= 1 || noTw);
        slot.querySelector('.plus').classList.toggle('off', dd.v >= 6 || noTw);
        slot.querySelector('.rr').classList.toggle('off', !(st.dmy[this.me].rerolls > 0) || this.sel.length > 1);
      });
      let note = document.querySelector('#tray .tw-note');
      if (!note) { note = h('div', 'tw-note'); $('#tray').appendChild(note); }
      note.textContent = `↻振り直し 残り${st.dmy[this.me].rerolls || 0}　±采配替え(金${R.tweakCost}) 残り${Math.max(0, R.tweakMax - (st.dmy[this.me].tweaks || 0))}`;
      let buy = document.querySelector('#tray .buy-btn');
      if (!buy) { buy = h('button', 'buy-btn'); buy.onclick = ev => { ev.stopPropagation(); this.buyDie(); }; $('#tray').appendChild(buy); }
      const dm = st.dmy[this.me];
      const cost = Engine.buyDieCost(st, this.me);
      const canAfford = Engine.canBuyDie(st, this.me);
      const shown = !dm.bought && dm.dice.length < R.extraDieMax && R.extraDieCost > 0;
      buy.classList.toggle('hidden', !shown);
      buy.disabled = !canAfford;
      buy.innerHTML = `＋賽<small>軍資金${cost}</small>`;
      buy.title = `軍資金（金${cost}）でサイコロを1個追加して振る（季節に1回、6個まで）`;
    },
    buyDie() {
      if (this.busy || this.phase !== 'orders') return;
      const v = Engine.buyDie(this.st, this.me);
      if (!v) { snd('error'); return; }
      this.undo = [];
      snd('diceup'); setTimeout(() => snd('roll', { n: 1 }), 120);
      const row = $('#dice-row');
      row.innerHTML = '';
      this.renderDice(false);
      const slots = document.querySelectorAll('.die-slot');
      const last = slots[slots.length - 1];
      if (last) Dice3D.tumble(last.querySelector('.die3d'), v, 650, 0);
      this.refresh();
      this.save();
    },
    undoLast() {
      if (this.busy || this.phase !== 'orders' || !this.undo.length) return;
      const u = this.undo.pop();
      this.st = Engine.deserialize(u.json);
      this.lastKanji = JSON.parse(u.kanji);
      this.sel = []; this.prov = -1; this.src = null; this.commit = null; this.amount = null;
      snd('cancel');
      this.syncMap(this.st, this.me);
      $('#dice-row').innerHTML = '';
      this.refresh();
      this.save();
    },
    reroll(i) {
      if (this.busy || this.phase !== 'orders') return;
      const v = Engine.reroll(this.st, this.me, i);
      if (!v) { snd('error'); return; }
      this.undo = [];
      this.save();
      snd('roll', { n: 1 });
      const slot = document.querySelectorAll('.die-slot')[i];
      Dice3D.tumble(slot.querySelector('.die3d'), v, 520, 0);
      this.sel = [i];
      const g = this.gen;
      setTimeout(() => { if (g === this.gen && this.phase === 'orders') this.refresh(); }, 530);
    },
    tweak(i, delta) {
      if (this.busy || this.sel.length > 1) return;
      const snap = Engine.serialize(this.st);
      if (Engine.tweak(this.st, this.me, i, delta)) {
        this.undo.push({ json: snap, kanji: JSON.stringify(this.lastKanji || {}) });
        snd('tweak');
        const slot = document.querySelectorAll('.die-slot')[i];
        const die = slot.querySelector('.die3d');
        Dice3D.tumble(die, this.st.dmy[this.me].dice[i].v, 280, 0);
        this.sel = [i];
        this.save();
        const g = this.gen;
        setTimeout(() => { if (g === this.gen && this.phase === 'orders') this.refresh(); }, 290);
      } else snd('error');
    },
    showThreats() {
      MapView.clearThreats();
      const st = this.st, me = this.me;
      if (!st || (this.phase !== 'orders' && this.phase !== 'roll')) return;
      const R = Engine.RULES, adj = Engine.adjacency();
      const dm = st.dmy[me];
      const sonae = this.phase === 'orders' ? Math.min(R.sonaeMax, Math.max(0, ...dm.dice.filter(x => !x.used).map(x => x.v))) : dm.sonae;
      if (Engine.RULES.truceFirst && st.turn === 0) return;
      for (const p of Engine.owned(st, me)) {
        const P = st.provs[p]; const home = p === me;
        const castle = home ? P.def * R.homeMul + R.homeBonus : P.def;
        let worst = 0, from = -1;
        for (const q of adj[p]) {
          const Q = st.provs[q]; if (Q.owner === me || Q.troops < 2 || Engine.isSnowBlocked(st, q, p)) continue;
          const commit = Q.troops - 1;
          const pf = Engine.winProb(commit + 5, P.troops + castle, sonae);
          const pr = !home && Math.min(commit, R.raidCap(1)) + 2 > P.troops + (R.raidCastle ? P.def : 0) ? 0.5 : 0;
          const r = Math.max(pf, pr);
          if (r > worst) { worst = r; from = q; }
        }
        if (worst >= 0.3) { MapView.setThreat(p, Math.round(worst * 100)); if (worst >= 0.45 && from >= 0) MapView.threatArrow(from, p); }
      }
    },
    renderMarks() {
      MapView.clearMarks();
      const st = this.st, me = this.me;
      this.showThreats();
      if (this.phase !== 'orders' && this.phase !== 'roll') return;
      if (this.prov >= 0) MapView.markSelected(this.prov);
      if (this.phase !== 'orders' || !this.sel.length) return;
      const mine = Engine.owned(st, me);
      const targets = new Set();
      mine.forEach(p => Engine.adjacency()[p].forEach(q => { if (st.provs[q].owner !== me) targets.add(q); }));
      targets.forEach(q => {
        const best = this.bestAttack(q);
        const dv = this.dv();
        const plotOk = dv && dv.face <= Engine.RULES.plotMax;
        if (best && best.c.calc.raid) MapView.setRaidMark(q, true);
        if (q === this.prov) return;
        MapView.markTarget(q, best ? best.p : null, best && best.c.calc.raid ? 'raid' : best || plotOk ? 'enemy' : 'bad');
      });
    },

    // ---------------------------------------------------------------- command panel
    renderCmd() {
      const box = $('#cmd'); box.innerHTML = '';
      const st = this.st, me = this.me;
      if (this.phase === 'roll') {
        box.appendChild(h('div', 'cmd-hint', `<b>賽を振って</b>この季節の采配を始めよう。<br>出目（表）は<b style="color:#ff9a7a">攻め</b>の力、裏の目（7−出目）は<b style="color:#9fe07a">政（内政）</b>の力。`));
        box.appendChild(this.legend());
        return;
      }
      if (this.phase !== 'orders') {
        box.appendChild(h('div', 'cmd-hint', this.phase === 'cpu' ? '諸大名が動いている…<br><span style="font-size:13px">（地図をクリックで早送り）</span>' : ''));
        return;
      }
      const dv = this.dv();
      const left = st.dmy[me].dice.filter(d => !d.used).length;
      if (this.undo.length) {
        const ub = h('button', 'undo-btn', '↶ 一手戻す');
        ub.title = '直前の開発・徴兵・移動・調略・采配替えを取り消す（Ctrl+Z）。合戦や振り直しの後は戻せない';
        ub.onclick = () => this.undoLast();
        box.appendChild(ub);
      }
      if (!dv && this.prov < 0) {
        if (left === 0) box.appendChild(h('div', 'cmd-hint', `すべての賽を使った。<br><b>季節を終える</b>と、諸大名が動き出す。`));
        else box.appendChild(h('div', 'cmd-hint', `<b>サイコロを選び</b>、地図の<b>国をクリック</b>して命令。<br><span style="font-size:13px">大きい目は<b style="color:#ff9a7a">攻め</b>に、小さい目は裏の目が大きいので<b style="color:#9fe07a">内政</b>に強い。同じ目は重ねて選べる（ゾロ目＝合計＋${Engine.RULES.zoromeBonus}）。</span>`));
        box.appendChild(this.legend());
        return;
      }
      if (this.prov < 0) {
        const face = dv.face;
        const t = h('div', 'cmd-title', `出目 ${dv.stacked ? face + '×' + dv.n : face}　<span style="color:#ff9a7a">攻${dv.v}</span>・<span style="color:#9fe07a">政${dv.u}</span><span class="sub">の使い道</span><span class="x">取消 Esc</span>`);
        t.querySelector('.x').onclick = () => this.clearSel();
        box.appendChild(t);
        const lines = [];
        if (face <= Engine.RULES.raidMax) lines.push(['raid', '奇', `<b>奇襲</b>：敵の🎲と備えを無視して確実に奪う`]);
        if (face <= Engine.RULES.plotMax) lines.push(['plot', '謀', `<b>調略</b>：敵兵を最大${Math.min(Math.floor(dv.u / 2), Engine.RULES.plotCap + (dv.stacked ? 1 : 0))}人寝返らせる（金${Engine.RULES.plotCost}）`]);
        if (face > Engine.RULES.raidMax) lines.push(['attack', '攻', `<b>力攻め</b>：兵＋<b style="color:#ff9a7a">${dv.v}</b>で攻める`]);
        lines.push(['recruit', '募', `<b>徴兵</b>：兵を約<b style="color:#9fe07a">${dv.u}</b>人集める（金が要る）`]);
        lines.push(['develop', '興', `<b>開発</b>：国力を<b style="color:#9fe07a">${dv.u}</b>育てる`]);
        lines.push(['move', '移', `<b>移動</b>：自領伝いに兵を送る`]);
        const lg = h('div', 'legend');
        lines.forEach(([c, k, s]) => { lg.appendChild(h('span', 'ico ' + c, k)); lg.appendChild(h('span', '', s)); });
        box.appendChild(lg);
        box.appendChild(h('div', 'cmd-hint', `<span style="font-size:13px;margin-top:8px;display:block">赤い敵国＝攻撃・調略できる国（青い「奇」は確実に奇襲できる国）。自国をクリック＝徴兵・開発・移動。</span>`));
        return;
      }
      const q = this.prov, Q = st.provs[q];
      if (!dv) { this.renderProvInfo(box, q); return; }
      if (Q.owner === me) this.renderOwnCards(box, q, dv); else this.renderEnemyCards(box, q, dv);
    },
    legend() {
      const lg = h('div', 'legend');
      const R = Engine.RULES;
      [['attack', '攻', `<b>力攻め</b> 兵＋<b style="color:#ff9a7a">出目</b>で攻める`], ['raid', '奇', `<b>奇襲</b>（出目${R.raidMax === 1 ? '1' : '1・2'}）運に頼らず確実に奪う`], ['plot', '謀', `<b>調略</b>（出目1〜${R.plotMax}）敵兵を寝返らせる`],
        ['recruit', '募', `<b>徴兵</b> <b style="color:#9fe07a">裏の目</b>の数だけ兵を集める`], ['develop', '興', `<b>開発</b> <b style="color:#9fe07a">裏の目</b>だけ国力が育つ`], ['move', '移', '<b>移動</b> 隣の自国へ兵を送る（どの目でも）']]
        .forEach(([c, k, s]) => { lg.appendChild(h('span', 'ico ' + c, k)); lg.appendChild(h('span', '', s)); });
      return lg;
    },
    renderProvInfo(box, q) {
      const st = this.st, Q = st.provs[q], o = Q.owner;
      const t = h('div', 'cmd-title', `${P[q].name}<span class="sub">${D[o].name}${o === this.me ? '（自軍）' : ''}</span><span class="x">閉じる</span>`);
      t.querySelector('.x').onclick = () => { this.prov = -1; this.refresh(); };
      box.appendChild(t);
      const prog = s => Q[s] >= 5 ? '' : `<span style="font-size:12px;color:#9a8a6a">（育成 ${Q.prog[s]}/${Engine.RULES.devNeed(Q[s])}）</span>`;
      const nb = Engine.adjacency()[q].map(x => `<span style="color:${D[st.provs[x].owner].color};font-weight:800">${P[x].name}</span>`).join('・');
      box.appendChild(h('div', 'pinfo', `
        <div class="row"><span class="lbl">兵</span><b style="font-size:20px">${Q.troops}</b><span style="font-size:12px;color:#9a8a6a">（兵の上限に＋${Engine.RULES.capBase + Engine.RULES.capMul * Q.mil}）</span>${o === q ? `<span class="tag home">本城 城${Q.def * Engine.RULES.homeMul + Engine.RULES.homeBonus}</span>` : ''}${P[q].snow ? '<span class="tag snow">雪国</span>' : ''}</div>
        <div class="row"><span class="lbl">経済力</span>${UI.pips(Q.econ)}${prog('econ')}</div>
        <div class="row"><span class="lbl">軍事力</span>${UI.pips(Q.mil)}${prog('mil')}</div>
        <div class="row"><span class="lbl">守備力</span>${UI.pips(Q.def)}${prog('def')}</div>
        <div class="row"><span class="lbl">隣国</span><span style="font-size:13px">${nb}</span></div>
        <div class="note">${o === this.me ? 'サイコロを選ぶと、この国で徴兵・開発・移動ができる。' : 'サイコロを選ぶと、隣の自国からこの国を攻めたり調略できる。'}</div>`));
    },
    renderEnemyCards(box, q, dv) {
      const st = this.st, me = this.me, Q = st.provs[q], o = Q.owner;
      const t = h('div', 'cmd-title', `${P[q].name}<span class="sub">${D[o].name}・兵${Q.troops}${o === q ? '・本城' : ''}</span><span class="x">取消</span>`);
      t.querySelector('.x').onclick = () => { this.prov = -1; this.refresh(); };
      box.appendChild(t);
      const cards = h('div', 'cards'); box.appendChild(cards);
      const srcs = this.sources(q);
      if (!srcs.length) { cards.appendChild(h('div', 'cmd-hint', 'この国に隣接する自国がない。')); return; }
      // ---- attack card
      const best = this.bestAttack(q);
      const src = this.src != null && srcs.includes(this.src) ? this.src : (best ? best.p : srcs[0]);
      const P0 = st.provs[src];
      const maxC = Engine.maxOut(P0);
      const commit = this.commit == null ? maxC : Math.max(1, Math.min(maxC, this.commit));
      const chk = Engine.check(st, { type: 'attack', d: me, dice: this.sel, from: src, to: q, commit });
      let why = '';
      if (!chk.ok) {
        if (Engine.RULES.truceFirst && st.turn === 0) why = '最初の季節は合戦なし（内政・調略で備えよう）';
        else if (Engine.isSnowBlocked(st, src, q)) why = '冬の雪で出陣できない';
        else if (P0.tired) why = 'この国は今季、徴兵か合戦をしたため出陣できない';
        else if (maxC < 1) why = `兵が足りない（城兵${Engine.keepOf(P0)}は動かせない）`;
        else why = '出陣できない';
      }
      if (!chk.ok && chk.why === 'short') why = `奇襲は兵${chk.commit}＋出目${dv.v}＝${chk.calc.ap}で、敵兵${chk.calc.defTroops}＋城${chk.calc.castle}に届かない（最大${Engine.RULES.raidCap(dv.n)}兵）`;
      const c = chk.ok ? chk.calc : null;
      const raid = c ? c.raid : (dv.face <= Engine.RULES.raidMax && o !== q);
      const card = h('div', 'card attack' + (chk.ok ? '' : ' disabled'));
      const pct = c ? Math.round(c.pWin * 100) : 0;
      const title = raid ? '奇襲' : (o === q ? '本城攻め' : '力攻め');
      let detail = '';
      if (c && c.raid) detail = `<div class="calc">兵${c.commit}＋出目${dv.v}＝<b>${c.ap}</b> ＞ 敵兵${c.defTroops}＋城${c.castle}</div><div class="sure">敵のサイコロも備えも関係なく、確実に奪取・損害なし</div>`;
      else if (c) {
        const fl = c.sonae || 0;
        let band = '<div class="band">';
        for (let f = 1; f <= 6; f++) { const eff = Math.max(f, fl); const w = c.ap > c.base + eff; band += `<i class="${w ? 'w' : 'l'}" title="敵の出目${f}${eff > f ? '→備え' + eff : ''}">${f}</i>`; }
        band += '</div>';
        detail = `<div class="calc">自軍 兵${chk.commit}＋出目${dv.v}＝<b>${c.ap}</b> ／ 敵 兵${c.defTroops}＋城${c.castle}＋🎲${fl ? `（備え${fl}：${fl}未満は${fl}）` : ''}</div>${band}`;
      }
      card.innerHTML = `<span class="ico ${raid ? 'raid' : (o === q ? 'siege' : 'attack')}">${raid ? '奇' : '攻'}</span>
        <div class="c-name">${title}<small>${P[src].name}から</small></div>
        <div class="c-val">${c ? (c.raid ? '確実' : pct + '%') : '—'}<small>${c && c.raid ? '' : '勝算'}</small></div>
        ${c ? detail : `<div class="why">${why}</div>`}`;
      if (c && maxC > 1 && !c.raid) {
        const sr = h('div', 'slider-row', `<span>兵</span><input type="range" min="1" max="${maxC}" value="${chk.commit}"><b>${chk.commit}</b>`);
        const inp = sr.querySelector('input');
        inp.onclick = ev => ev.stopPropagation();
        inp.oninput = ev => { ev.stopPropagation(); this.commit = +ev.target.value; this.src = src; this.renderCmd(); };
        card.appendChild(sr);
      }
      if (srcs.length > 1) {
        const sr = h('div', 'slider-row', '<span>出陣元</span>');
        srcs.forEach(p => {
          const b = h('button', 'dev-btn', `${P[p].name} ${st.provs[p].troops}`);
          if (p === src) b.style.background = '#ffe7a8';
          b.onclick = ev => { ev.stopPropagation(); this.src = p; this.commit = null; snd('click'); this.renderCmd(); this.renderMarksFor(q, p); };
          sr.appendChild(b);
        });
        card.appendChild(sr);
      }
      if (chk.ok) card.onclick = () => this.doOrder({ type: 'attack', d: me, dice: this.sel.slice(), from: src, to: q, commit: chk.commit });
      cards.appendChild(card);
      // ---- plot card
      if (dv.face <= Engine.RULES.plotMax) {
        const psrc = srcs[0];
        const pc = Engine.check(st, { type: 'plot', d: me, dice: this.sel, from: psrc, to: q });
        const k = pc.ok ? pc.calc.steal : 0;
        const pcard = h('div', 'card plot' + (pc.ok && k > 0 ? '' : ' disabled'));
        const pwhy = pc.ok ? '' : pc.why === 'plotted' ? 'この国は今季すでに調略を受けた' : pc.why === 'gold' ? `金が足りない（金${Engine.RULES.plotCost}）` : '寝返らせる兵がいない';
        pcard.innerHTML = `<span class="ico plot">謀</span><div class="c-name">調略<small>金${Engine.RULES.plotCost}・${P[psrc].name}へ</small></div>
          <div class="c-val">+${k}<small>兵</small></div><div class="c-desc">${pc.ok ? `敵兵${Q.troops}→${Q.troops - k}　自軍${st.provs[psrc].troops}→${st.provs[psrc].troops + k}` : `<span style="color:#9a1a0e;font-weight:800">${pwhy}</span>`}</div>`;
        if (pc.ok && k > 0) pcard.onclick = () => this.doOrder({ type: 'plot', d: me, dice: this.sel.slice(), from: psrc, to: q });
        cards.appendChild(pcard);
      }
    },
    renderMarksFor(q, p) { MapView.clearMarks(); MapView.markSelected(q); MapView.markTarget(q, p, 'enemy'); },
    renderOwnCards(box, q, dv) {
      const st = this.st, me = this.me, Q = st.provs[q];
      const t = h('div', 'cmd-title', `${P[q].name}<span class="sub">兵${Q.troops}・金${st.dmy[me].gold}</span><span class="x">取消</span>`);
      t.querySelector('.x').onclick = () => { this.prov = -1; this.refresh(); };
      box.appendChild(t);
      const cards = h('div', 'cards'); box.appendChild(cards);
      // recruit
      const rc = Engine.check(st, { type: 'recruit', d: me, dice: this.sel, at: q });
      const calc = rc.calc || Engine.recruitCalc(st, q, dv);
      const r = h('div', 'card recruit' + (rc.ok ? '' : ' disabled'));
      r.innerHTML = `<span class="ico recruit">募</span><div class="c-name">徴兵<small>金${calc.cost}</small></div><div class="c-val">+${calc.gain}<small>兵</small></div>
        <div class="c-desc">${rc.ok ? `この国は今季、出陣できなくなる（上限まであと${calc.room}）` : (rc.why === 'gold' ? `<span style="color:#9a1a0e;font-weight:800">金が足りない（所持${st.dmy[me].gold}）</span>` : rc.why === 'cap' ? `<span style="color:#9a1a0e;font-weight:800">兵が上限（${Engine.troopCap(st, me)}）に達している</span>` : '')}</div>`;
      if (rc.ok) r.onclick = () => this.doOrder({ type: 'recruit', d: me, dice: this.sel.slice(), at: q });
      cards.appendChild(r);
      // develop
      const dcard = h('div', 'card develop');
      dcard.innerHTML = `<span class="ico develop">興</span><div class="c-name">開発<small>裏の目${dv.u}だけ育つ</small></div><div class="c-val" style="font-size:14px;color:#3c7a3a">経済→収入<br>軍事→兵<br>守備→城</div>`;
      const row = h('div', 'dev-row');
      ['econ', 'mil', 'def'].forEach(s => {
        const c = Engine.check(st, { type: 'develop', d: me, dice: this.sel, at: q, stat: s });
        const lvl = Q[s];
        const need = Engine.RULES.devNeed(Math.min(lvl, 4));
        const cur = lvl >= 5 ? 1 : Q.prog[s] / need;
        const gain = lvl >= 5 ? 0 : Math.min(1, (Q.prog[s] + dv.u) / need) - cur;
        const b = h('button', 'dev-btn' + (c.ok ? '' : ' maxed'), `${UI.STAT[s]} ${lvl}<span class="pips">${'●'.repeat(lvl)}${'○'.repeat(5 - lvl)}</span><span class="bar"><i style="width:${cur * 100}%"></i><i class="gain" style="left:${cur * 100}%;width:${gain * 100}%"></i></span><span class="up">${c.ok && c.calc.ups ? '▲' + c.calc.newLvl + 'へ' : (lvl >= 5 ? '最大' : `${Q.prog[s]}→${Math.min(need, Q.prog[s] + dv.u)}/${need}`)}</span>`);
        if (c.ok) b.onclick = ev => { ev.stopPropagation(); this.doOrder({ type: 'develop', d: me, dice: this.sel.slice(), at: q, stat: s }); };
        row.appendChild(b);
      });
      dcard.appendChild(row);
      dcard.style.cursor = 'default';
      cards.appendChild(dcard);
      // move
      const dests = Engine.reachable(st, q);
      if (dests.length) {
        const maxA = Engine.maxOut(Q);
        const amount = this.amount == null ? maxA : Math.max(1, Math.min(maxA, this.amount));
        const m = h('div', 'card move' + (maxA >= 1 ? '' : ' disabled'));
        m.style.cursor = 'default';
        m.innerHTML = `<span class="ico move">移</span><div class="c-name">移動<small>自領伝いにどこへでも</small></div><div class="c-val">${maxA >= 1 ? amount : 0}<small>兵</small></div>`;
        if (maxA >= 1) {
          if (maxA > 1) {
            const sr = h('div', 'slider-row', `<span>兵</span><input type="range" min="1" max="${maxA}" value="${amount}"><b>${amount}</b>`);
            sr.querySelector('input').oninput = ev => { this.amount = +ev.target.value; this.renderCmd(); };
            m.appendChild(sr);
          }
          const rr = h('div', 'dev-row');
          dests.forEach(x => {
            const b = h('button', 'dev-btn', `→ ${P[x].name}<span class="pips">兵${st.provs[x].troops}</span>`);
            b.onclick = ev => { ev.stopPropagation(); this.doOrder({ type: 'move', d: me, dice: this.sel.slice(), from: q, to: x, amount }); };
            rr.appendChild(b);
          });
          m.appendChild(rr);
        } else m.appendChild(h('div', 'why', `城兵${Engine.keepOf(Q)}は動かせない`));
        cards.appendChild(m);
      }
    },

    // ================================================================ end
    finish() {
      const st = this.st, me = this.me;
      if (!st || !st.over) return;
      this.phase = 'over';
      this.clearSave();
      this.firstGame = false; this.savePrefs();
      const rk = Engine.rankings(st);
      const mine = rk.find(r => r.id === me);
      const over = st.over;
      let title, sub, win = false;
      if (over.kind === 'unify') { title = '天下統一'; sub = `${D[me].name}、二十国を平定。戦国の世を終わらせた。`; win = true; }
      else if (over.kind === 'victory') {
        const tied = rk.filter(r => r.provinces === mine.provinces).length > 1;
        title = '天下第一'; win = true;
        sub = `${Engine.dateLabel(st, st.turn - 1).era}、${D[me].name}は${mine.provinces}国を従え、${tied ? '同じ国数の大名を国力で上回って' : ''}諸大名の頂点に立った。`;
      }
      else if (over.kind === 'defeat') { title = '落城'; sub = `${D[me].short || D[me].clan}家は滅亡した…（${Engine.dateLabel(st).era}${Engine.dateLabel(st).season}）`; }
      else if (over.kind === 'unify-cpu') { title = '敗北'; sub = `${D[over.winner].name}が天下を統一した。`; }
      else { const w = rk[0]; title = mine.rank <= 3 ? '雄飛' : '無念'; sub = `勝者は${D[w.id].name}（${w.provinces}国）。${D[me].short || D[me].clan}家は${mine.provinces}国・第${mine.rank}位。`; }
      const grades = [[10, '天下人'], [7, '覇王'], [5, '大大名'], [3, '戦国大名'], [2, '国主'], [1, '国人'], [0, '滅亡']];
      const grade = grades.find(g => mine.provinces >= g[0])[1];
      $('#res-title').textContent = title; $('#res-title').className = 'res-title' + (win ? ' win' : '');
      $('#res-sub').innerHTML = sub + `<br><span style="font-size:15px">称号：<b>${grade}</b>　最大領国 ${st.dmy[me].peak}国　攻略 ${st.dmy[me].conquests}回　（${D[me].name}・難易度${'★'.repeat(GD.DIFF[me] || 3)}）</span>`;
      $('#res-rank').innerHTML = UI.rankTable(st, me, 10);
      $('#res-chart').innerHTML = UI.chart(st, me);
      $('#scr-result').classList.remove('hidden');
      snd(win ? 'victory' : 'defeat');
      try { S.startBgm('end'); } catch (e) { /* ignore */ }
      if (win) { const [x, y] = MapView.pt(me); for (let k = 0; k < 4; k++) setTimeout(() => FX.burst(x + (k - 1.5) * 80, y, D[me].color, 60, 'petal'), k * 200); }
    },
  };
  window.App = A;
  window.addEventListener('DOMContentLoaded', () => A.init());
})();
