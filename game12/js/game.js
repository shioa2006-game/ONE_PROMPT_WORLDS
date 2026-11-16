/*
 * ころころ、ひらけ列島 ― 進行（画面の きりかえ・ターンの 演出・入力・保存）
 */
(function () {
  'use strict';
  const KR = window.KR;
  const E = KR.E, M = KR.MAP, A = KR.ART, R = KR.R, S = KR.SND, AI = KR.AI, U = KR.UI;
  const canvas = document.getElementById('game');
  R.init(canvas);

  // ------------------------------------------------------------ 保存
  const SAVE_KEY = 'kr12_save_v1', PROF_KEY = 'kr12_profile_v1';
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できない環境 */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } },
  };
  const prof = Object.assign({ stamps: [], props: [], wins: 0, plays: 0, best: 0, seen: {}, vol: { bgm: 0.5, sfx: 0.8 }, muted: false, cpuSpeed: 1.8 }, store.get(PROF_KEY) || {});
  const saveProf = () => store.set(PROF_KEY, prof);
  S.vol = prof.vol; S.muted = prof.muted;

  // ------------------------------------------------------------ 状態
  const D = {
    G: null, screen: 'title', paused: false, speed: 1, hold: false, timers: [], human: null,
    autoRoll: false, follow: null, cur: 0, dice: null, stepsLeft: -1, run: 0, fast: false,
    titleG: null, titleT: 0, introPage: 0, overview: null, result: null, helpPage: 0, bookTab: 0, bookPage: 0,
    newStamps: 0, newProps: 0, cpuTurn: false, hintT: 0,
  };
  window.KR12 = { D, U, R, E, AI, prof };

  // ------------------------------------------------------------ 時間（演出の 待ち）
  const wait = (sec) => new Promise((res) => D.timers.push({ t: sec, res }));
  const tween = (sec, fn) => new Promise((res) => D.timers.push({ t: sec, total: sec, fn, res }));
  const timeScale = () => D.speed * (D.cpuTurn ? prof.cpuSpeed : 1) * (D.fast && !D.human ? 3 : 1);
  function tickTimers(dt) {
    const list = D.timers; D.timers = [];
    const keep = [];
    for (const t of list) {
      t.t -= dt;
      if (t.fn) t.fn(KR.clamp(1 - t.t / t.total, 0, 1));
      if (t.t <= 0) t.res(); else keep.push(t);
    }
    D.timers = keep.concat(D.timers);
  }

  // ------------------------------------------------------------ あなたの 入力を まつ
  function ask(kind, data) {
    return new Promise((res) => { D.human = Object.assign({ kind, res }, data || {}); });
  }
  function answer(d) {
    const h = D.human;
    if (!h) return;
    D.human = null;
    S.play('click');
    h.res(d);
  }

  // ------------------------------------------------------------ こむぎの ひとこと
  function hint(id, text, force) {
    if (!force && prof.seen[id]) return;
    prof.seen[id] = (prof.seen[id] || 0) + 1; saveProf();
    U.hint = { text, id, t: 0 };
  }

  // ------------------------------------------------------------ はじめる・つづき
  function newGame() {
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    D.G = E.create(seed);
    prof.plays++;
    if (prof.stamps.indexOf(M.stIdx.tokyo) < 0) prof.stamps.push(M.stIdx.tokyo); // 出発の駅
    saveProf();
    D.newStamps = 0; D.newProps = 0;
    resetView(D.G);
    D.screen = 'intro'; D.introPage = 0;
  }
  function resetView(G) {
    D.timers = []; D.human = null; D.autoRoll = false; D.follow = null; D.dice = null; D.stepsLeft = -1;
    U.panel = null; U.sub = null; U.banner = null; U.toasts = []; U.speech = []; U.hint = null; U.selCard = -1; U.snapCash = true;
    R.cands = null; R.candHover = -1; R.fx = []; R.texts = []; R.rings = [];
    R.season = KR.seasonOf(Math.min(G.turn, KR.TURNS - 1)); R.prevSeason = R.season; R.seasonT = 1;
    R.openAnim = KR.REGIONS.map(() => 0);
    R.tok.forEach((t) => { t.anim = false; t.hop = 0; t.vis = true; t.dir = 1; });
    R.placeTokens(G);
    const P = G.P[G.cur];
    R.camTo(M.nodes[P.node].x, M.nodes[P.node].y, 0.85, true);
    S.setSeason(R.season);
  }
  function continueGame() {
    const sv = store.get(SAVE_KEY);
    if (!sv || !sv.G) return;
    D.G = sv.G;
    D.newStamps = sv.newStamps || 0; D.newProps = sv.newProps || 0;
    resetView(D.G);
    D.screen = 'play';
    startDirector();
  }
  function saveGame(G) {
    if (G.over) return;
    store.set(SAVE_KEY, { G, at: Date.now(), newStamps: D.newStamps, newProps: D.newProps });
  }
  function startDirector() {
    const token = ++D.run;
    director(token).catch((e) => { console.error(e); });
  }
  function toTitle() {
    if (D.G && !D.G.over && D.screen === 'play') saveGame(D.G);
    D.run++; D.G = null; D.timers = []; D.human = null; D.paused = false;
    U.panel = null; U.sub = null; U.banner = null; U.hint = null;
    D.screen = 'title';
  }

  // ------------------------------------------------------------ 進行
  async function director(token) {
    const G = D.G;
    const alive = () => D.G === G && D.run === token;
    // さいしょの 目的地
    if (G.turn === 0 && G.cur === 0 && G.phase === 'start') {
      await destAnim(G, { st: G.dest, dist: G.destDist }, true);
      if (!alive()) return;
      hint('start', 'まずは サイコロを ふろう！ 目的地（赤い旗）に 一番乗りすると 賞金。3月の おわりに 総資産が いちばん 多い会社の かち！');
    }
    E.advance(G);
    while (alive()) {
      await playEvents(G, alive);
      if (!alive()) return;
      if (G.over) { await showResult(G); return; }
      const need = G.need;
      D.cpuTurn = need.p !== 0;
      let d;
      if (need.p === 0) d = await humanDecide(G, need);
      else d = await cpuDecide(G, need);
      if (!alive()) return;
      E.decide(G, d);
    }
  }
  async function playEvents(G, alive) {
    while (G.ev.length && alive()) {
      const e = G.ev.shift();
      await animate(G, e);
    }
  }

  // ------------------------------------------------------------ あなたの 番の 判断
  async function humanDecide(G, need) {
    const P = G.P[0];
    if (need.k === 'action') {
      if (D.autoRoll) { D.autoRoll = false; return { type: 'roll' }; }
      saveGame(G); saveProf();
      focus(0, 0.85);
      U.selCard = -1; U.sub = null;
      const dd = E.destDist(G, P.node);
      if (G.turn >= 1 && P.cards.length && !P.slow) hint('card', '下の きっぷを クリックで えらんで、サイコロを ふろう。快速きっぷなら サイコロ 2こ。きっぷは 1ターンに 1まいだけ。');
      const speedCard = P.cards.find((c) => ['kaisoku', 'tokkyu', 'kaisuu'].indexOf(c.id) >= 0);
      if (speedCard && dd >= 9 && !P.slow && G.turn >= 2 && (prof.seen.speed || 0) < 3 && G.turn - (D.lastSpeedHint || -9) >= 4) {
        D.lastSpeedHint = G.turn;
        hint('speed', '目的地まで ' + dd + ' マス。遠いときは ' + KR.CARDS[speedCard.id].name + ' で サイコロを ふやそう！ ライバルも どんどん 使ってくるよ。', true);
      }
      if (dd <= 6 && P.cards.some((c) => c.id === 'kakueki') && !P.slow && (prof.seen.exact || 0) < 3) hint('exact', '目的地まで あと ' + dd + ' マス！ 各停きっぷで ' + dd + ' を えらぶと「ぴったり到着」で 賞金 1.5倍。', true);
      U.mode = 'action';
      const d = await ask('action');
      U.mode = null; U.sub = null; R.cands = null;
      // この番の 操作についての ひとことは、ふったら 片づける
      if (U.hint && ['start', 'card', 'speed', 'exact'].indexOf(U.hint.id) >= 0 && (d.type === 'roll' || D.autoRoll)) U.hint = null;
      return d;
    }
    if (need.k === 'landing') {
      const opts = G.opts;
      R.cands = opts.map((o, i) => ({ opt: o, i }));
      R.candHover = -1; U.kbSel = -1;
      const pts = opts.map((o) => [M.nodes[o.node].x, M.nodes[o.node].y]);
      pts.push([M.nodes[P.node].x, M.nodes[P.node].y]);
      R.fit(pts, 90, 1.0, 0.2);
      if (opts.length === 1) {
        R.candHover = 0;
        await wait(0.55);
        R.cands = null;
        return { type: 'land', i: 0 };
      }
      hint('landing', '光っている マスから、とまる 場所を えらんでね。マウスを のせると 通る道と、何が おきるかが 下に 出るよ。');
      U.mode = 'landing';
      const d = await ask('landing', { total: need.total });
      U.mode = null; R.cands = null;
      if (U.hint && U.hint.id === 'landing') U.hint = null;
      return d;
    }
    if (need.k === 'buy') {
      const s = KR.STATIONS[need.st];
      const free = s.pi.filter((i) => G.own[i] < 0);
      const canTake = P.cards.some((c) => c.id === 'baishu') && s.pi.some((i) => G.own[i] > 0);
      const afford = free.some((i) => M.props[i].price <= P.cash);
      if (!U.panel || U.panel.kind !== 'station') {
        if (!free.length && !canTake) {
          const mono = E.monoOwner(G, need.st);
          U.toast(s.name + '駅：' + (mono >= 0 ? KR.COMPANIES[mono].name + ' の 独占駅' : '名物は ぜんぶ 持ち主が いる'), '#6b4a2b');
          await wait(0.7);
          return { type: 'done' };
        }
        U.panel = { kind: 'station', st: need.st, ro: !afford && !canTake };
        hint('station', '駅では 名物が 買える。季節の おわりの「決算」で 値段の 5% が 入るよ。旬の 季節は 3倍、駅の 名物を ぜんぶ 持つと 独占で 2倍！');
        if (!afford && !canTake) {
          U.panel.note = 'いま 買える 名物は ない';
          await wait(1.6);
          U.panel = null;
          return { type: 'done' };
        }
      }
      const d = await ask('buy');
      if (d.type === 'done') U.panel = null;
      return d;
    }
    if (need.k === 'event') {
      U.panel = { kind: 'event', inst: G.evInst, p: 0, phase: 'choose', t: 0 };
      S.play('event');
      return ask('event');
    }
    if (need.k === 'open') {
      const dist = need.options.map((r) => {
        const ov = G.open.map((o) => (o ? 1 : 0)); ov[r] = 1;
        const d = E.dist(G, P.node, ov);
        let m = 99; KR.STATIONS.forEach((s, i) => { if (M.nodes[i].r === r && d[i] >= 0) m = Math.min(m, d[i]); });
        return m;
      });
      U.panel = { kind: 'open', options: need.options, dist };
      const d = await ask('open');
      U.panel = null;
      return d;
    }
    return { type: 'done' };
  }

  // ------------------------------------------------------------ ライバルの 判断
  async function cpuDecide(G, need) {
    const key = KR.COMPANIES[need.p].key;
    const d = AI.decide(G, key);
    if (need.k === 'action') { await wait(0.3); }
    else if (need.k === 'landing') {
      const o = G.opts[d.i];
      R.cands = [{ opt: o, i: d.i }]; R.candHover = 0;
      const pts = [[M.nodes[o.node].x, M.nodes[o.node].y], [M.nodes[G.P[need.p].node].x, M.nodes[G.P[need.p].node].y]];
      R.fit(pts, 160, 0.95, 0.4);
      await wait(0.55);
      R.cands = null;
    } else if (need.k === 'buy') { await wait(d.type === 'done' ? 0.1 : 0.25); }
    else if (need.k === 'event') {
      U.panel = { kind: 'event', inst: G.evInst, p: need.p, phase: 'choose', t: 0 };
      S.play('event');
      await wait(1.1);
      U.panel.cpuPick = d.i;
      S.play('click');
      await wait(0.6);
    } else if (need.k === 'open') {
      U.say(need.p, KR.REGIONS[d.r].name + 'を ひらこう！');
      await wait(0.8);
    }
    return d;
  }

  // ------------------------------------------------------------ カメラ
  function focus(p, z) {
    const t = R.tok[p];
    R.camTo(t.x, t.y, z || Math.max(0.7, R.cam.tz));
  }

  // ------------------------------------------------------------ 起きたことの 演出
  async function animate(G, e) {
    const co = e.p != null ? KR.COMPANIES[e.p] : null;
    const human = e.p === 0;
    switch (e.t) {
      case 'turn': {
        D.cur = e.p; D.cpuTurn = e.p !== 0;
        R.placeTokens(G);
        focus(e.p, Math.max(0.75, R.cam.tz));
        if (human && e.turn === KR.TURNS - 2) {
          // さいごの 2ターン
          const rank = G.P.map((P, i) => ({ i, a: E.assets(G, i) })).sort((a, b) => b.a - a.a);
          const me = rank.findIndex((r) => r.i === 0);
          const sub = me === 0 ? 'いま 1位！ このまま 逃げきろう' : '1位の ' + KR.COMPANIES[rank[0].i].short + ' まで あと ' + KR.yen(rank[0].a - rank[me].a);
          U.setBanner('ラストスパート！ のこり 2ターン', { sub, col: '#c0392b', life: 2.2, big: true });
          S.play('whistle'); await wait(1.9);
        } else if (human) { U.setBanner(KR.turnLabel(e.turn) + '　あなたの番', { col: co.color, life: 1.1 }); S.play('turn'); await wait(0.6); }
        else {
          U.setBanner(co.boss + '（' + co.name + '）の番', { col: co.color, life: 0.8 });
          hint('ff', 'ライバルの 番は、クリックか スペースを おしたままで はやおくり できるよ。メニューで はやさも かえられる。');
          await wait(0.45);
        }
        break;
      }
      case 'season': await seasonAnim(e.s); break;
      case 'use': {
        const cd = KR.CARDS[e.card];
        const t = R.tok[e.p];
        S.play('card');
        if (!human) U.say(e.p, pickLine(e.p, e.card === 'fumikiri' ? 'fumikiri' : 'card') + '（' + cd.name + '）', 2.2);
        if (e.card === 'daruma') { R.addText(t.x, t.y - 40, '+' + KR.yen(e.money).replace('+', ''), '#ffe66b', 26); R.burst(t.x, t.y, 'coin', 14); S.play('coin', e.money); }
        if (e.card === 'fumikiri') { S.play('fumikiri'); U.toast(co.short + ' の ふみきり：' + KR.COMPANIES[e.target].name + ' は つぎの番、出目 1〜3', '#a0522d', 3.6); }
        if (e.card === 'kakueki') U.toast(co.short + '：各停きっぷで ' + e.value + ' マス', co.dark);
        if (e.card === 'tobinori') U.toast(co.short + '：とびのりきっぷ！', co.dark);
        await wait(human ? 0.35 : 0.8);
        break;
      }
      case 'roll': {
        D.dice = { vals: e.dice, t: 0, mode: e.mode, p: e.p, done: false };
        S.play('dice');
        await wait(human ? 0.6 : 0.45);
        D.dice.done = true; S.play('diceLand');
        const t = R.tok[e.p];
        R.ring(t.x, t.y, co.color, 50, 0.5);
        await wait(human ? 0.35 : 0.3);
        break;
      }
      case 'move': await moveAnim(G, e); break;
      case 'warp': {
        const t = R.tok[e.p];
        S.play('warp');
        R.burst(t.x, t.y, 'star', 16, { cols: ['#fff', '#9ad', '#f3c64a'] });
        await tween(0.3, (k) => { t.hop = k; });
        t.vis = false;
        const n = M.nodes[e.to];
        R.camTo(n.x, n.y, 0.8);
        await wait(0.5);
        t.x = n.x; t.y = n.y; t.vis = true; t.hop = 0; R.placeTokens(G);
        R.burst(n.x, n.y, 'star', 16, { cols: ['#fff', '#9ad', '#f3c64a'] });
        for (const m of e.marks) await markAnim(G, e.p, m, n);
        await wait(0.3);
        break;
      }
      case 'land': {
        const t = R.tok[e.p];
        if (e.kind === 'plus' || e.kind === 'gate') {
          R.addText(t.x, t.y - 40, '+' + KR.yen(e.money).replace('+', ''), '#ffe66b', human ? 28 : 22);
          R.burst(t.x, t.y - 10, 'coin', human ? 16 : 8, { speed: 180 });
          S.play('coin', e.money);
          await wait(human ? 0.7 : 0.45);
        } else if (e.kind === 'minus') {
          R.addText(t.x, t.y - 40, KR.yen(e.money), '#cfe3ff', human ? 26 : 22, { out: '#1f3d6e' });
          R.burst(t.x, t.y - 30, 'drop', 12, { speed: 60, up: -40, g: 300 });
          S.play('rain');
          await wait(human ? 0.7 : 0.45);
        } else if (e.kind === 'event') {
          R.ring(t.x, t.y, '#a46acb', 50, 0.5);
          await wait(0.2);
        }
        break;
      }
      case 'card': {
        const t = R.tok[e.p];
        const cd = KR.CARDS[e.card];
        S.play('card');
        if (e.why === 'oikaze') {
          U.toast('おいかぜ：目的地から いちばん遠い ' + co.name + ' に ' + cd.name, '#2f7a3a', 4);
          if (human) hint('oikaze', '目的地から いちばん 遠いと「おいかぜ」で きっぷが もらえるよ。あきらめずに 追いかけよう！');
        } else if (e.why !== 'event') {
          R.addText(t.x, t.y - 44, cd.name + '！', '#e9ffe9', human ? 22 : 18, { out: '#24753f' });
          if (human) U.toast(cd.name + ' を 手に入れた', '#24753f');
        }
        await wait(human ? 0.6 : 0.35);
        break;
      }
      case 'cardsold': U.toast(co.short + '：きっぷが いっぱい。' + KR.CARDS[e.card].name + ' を 換金 ' + KR.yen(e.money, true), '#6b4a2b'); await wait(0.4); break;
      case 'arrive': await arriveAnim(G, e); break;
      case 'open': await openAnim(G, e); break;
      case 'dest': await destAnim(G, e); break;
      case 'buy':
      case 'takeover': {
        const pr = M.props[e.prop];
        const sn = M.nodes[pr.st];
        if (human) {
          U.flash['prop' + e.prop] = 1.2;
          S.play('buy');
          if (prof.props.indexOf(e.prop) < 0) { prof.props.push(e.prop); D.newProps++; }
          if (U.panel && U.panel.rect) { const r = U.panel.rect; R.burst(r.x + r.w - 86, r.y + 140, 'ink', 10, { screen: true, cols: ['#e4502f'], speed: 120, up: 0, g: 0, life: 0.5 }); }
          if (e.t === 'takeover') U.toast('買収！ ' + pr.name + ' を ' + KR.COMPANIES[e.from].name + ' から 買いとった', '#6f5bb5');
          await wait(0.35);
        } else {
          U.say(e.p, pickLine(e.p, 'buy'), 1.6);
          U.toast(co.short + '：' + KR.STATIONS[pr.st].name + 'の「' + pr.name + '」を ' + (e.t === 'takeover' ? (e.from === 0 ? 'あなたから 買収！' : '買収') : '買った'), co.dark);
          R.burst(sn.x, sn.y, 'ink', 8, { cols: [co.color], speed: 90 });
          S.play('stamp');
          await wait(0.45);
        }
        if (e.mono) await monoAnim(G, e.p, pr.st);
        break;
      }
      case 'sell': {
        const pr = M.props[e.prop];
        U.toast(co.short + '：お金が たりず「' + pr.name + '」を 手放した（' + KR.yen(e.money, true) + '）', '#c0392b', 3.6);
        S.play('bad');
        await wait(0.6);
        break;
      }
      case 'evres': await evresAnim(G, e); break;
      case 'settle': await settleAnim(G, e); break;
      case 'over': break;
      default: break;
    }
  }
  function pickLine(p, k) {
    const L = KR.LINES_TALK[KR.COMPANIES[p].key];
    if (!L || !L[k]) return '';
    return L[k][Math.floor(Math.random() * L[k].length)];
  }

  async function moveAnim(G, e) {
    const t = R.tok[e.p];
    t.anim = true;
    D.follow = e.p;
    D.dice = null;
    const human = e.p === 0;
    const stepDur = human ? 0.17 : 0.13;
    let prev = M.nodes[e.from];
    t.x = prev.x; t.y = prev.y;
    R.cam.tz = Math.max(R.cam.tz, 0.75);
    for (let k = 0; k < e.path.length; k++) {
      const n = M.nodes[e.path[k]];
      if (Math.abs(n.x - prev.x) > 2) t.dir = n.x > prev.x ? 1 : -1;
      D.stepsLeft = e.path.length - k;
      const a = prev;
      await tween(stepDur, (u) => { t.x = KR.lerp(a.x, n.x, u); t.y = KR.lerp(a.y, n.y, u); t.hop = u; });
      t.hop = 0;
      S.play('step', k);
      if (k % 2 === 0) R.burst(n.x - t.dir * 14, n.y + 6, 'smoke', 1, { speed: 20, up: 20, g: -30, size: 5, life: 0.6 });
      for (const m of e.marks) if (m.k === k) await markAnim(G, e.p, m, n);
      prev = n;
    }
    D.stepsLeft = -1;
    t.anim = false; D.follow = null;
    R.placeTokens(G);
    if (D.dice) D.dice = null;
  }
  async function markAnim(G, p, m, n) {
    const human = p === 0;
    if (m.kind === 'stamp') {
      S.play('stamp');
      R.addText(n.x + 84 / R.cam.z, n.y - 6 / R.cam.z, 'スタンプ +' + m.money + '万', '#fff', human ? 18 : 14, { out: KR.REGIONS[M.nodes[m.st].r].ink, life: 1.2, rise: 30 });
      if (human) {
        if (prof.stamps.indexOf(m.st) < 0) { prof.stamps.push(m.st); D.newStamps++; }
        D.stampPop = { st: m.st, t: 0 };
        hint('stamp', 'はじめて 通った 駅で スタンプ！ 地方の 駅を ぜんぶ 集めると ボーナス。スタンプ帳は メニューから 見られるよ。');
        await wait(0.25);
      }
    } else if (m.kind === 'region') {
      S.play('mono');
      U.setBanner(KR.REGIONS[m.r].name + ' スタンプ制覇！', { col: KR.REGIONS[m.r].ink, sub: KR.COMPANIES[p].name, money: m.money, life: 1.8, p });
      await wait(human ? 1.4 : 0.8);
    } else if (m.kind === 'toll') {
      const g = M.gates[m.gate];
      const to = KR.COMPANIES[m.to];
      R.addText(n.x + 90 / R.cam.z, n.y + 4 / R.cam.z, '通行料 −' + m.money + '万', '#ffd2c8', human ? 20 : 16, { out: '#7a1f12', rise: 30 });
      R.burst(n.x, n.y, 'coin', 10, { speed: 140 });
      if (m.to === 0) { S.play('tollIn'); U.toast(g.name + '：' + KR.COMPANIES[p].short + ' から 通行料 +' + m.money + '万円', '#2f7a3a'); }
      else { S.play('toll'); U.toast(KR.COMPANIES[p].short + ' → ' + to.short + '：' + g.name + 'の 通行料 ' + m.money + '万円', to.dark); }
      if (m.to !== 0) U.say(m.to, pickLine(m.to, 'toll'), 1.4);
      if (human) hint('toll', '関所は ひらいた 会社の もの。通るたびに 通行料を はらうよ。目的地に 一番乗りして、関所を 自分のものに しよう！');
      await wait(human ? 0.45 : 0.3);
    }
  }

  async function seasonAnim(s) {
    R.prevSeason = R.season; R.season = s; R.seasonT = 0;
    S.setSeason(s); S.play('season');
    const kinds = [['petal', ['#f8bfd0', '#f4a3bb', '#fff0f5']], ['leaf', ['#5fb05a', '#8ccf6a', '#3f9a4a']], ['leaf', ['#e0602f', '#f0a030', '#c94a2a']], ['snow', ['#fff']]];
    R.rain(kinds[s][0], 70, kinds[s][1]);
    const notes = [
      '春の 名物（いちご・お花見・ほたるいか…）が 旬',
      '夏の 名物（海水浴・まつり・うなぎ…）が 旬',
      '秋の 名物（紅葉・ぶどう・りんご…）が 旬',
      '冬の 名物（温泉・スキー場・かに…）が 旬',
    ];
    U.setBanner(KR.SEASONS[s].name + 'が きた', { sub: notes[s] + '。つぎの 決算で 3倍！', col: KR.SEASONS[s].color, life: 2.2, big: true });
    await wait(2.0);
    hint('shun', '季節が かわると「旬」の 名物が かわるよ。駅の 画面で「いまが旬！」の 名物は、つぎの 決算で 3倍の 収益！');
  }

  async function arriveAnim(G, e) {
    const n = M.nodes[e.st], co = KR.COMPANIES[e.p];
    R.camTo(n.x, n.y, 0.9);
    S.play('arrive'); if (e.exact) setTimeout(() => S.play('exact'), 600);
    const cols = ['#f3c64a', '#e4502f', '#fff', co.color, '#7fd0f0'];
    for (let i = 0; i < 3; i++) setTimeout(() => { R.burst(n.x + (Math.random() - 0.5) * 120, n.y - 60 - Math.random() * 60, 'star', 26, { cols, speed: 220, g: 120 }); R.ring(n.x, n.y, co.color, 120, 0.8); }, i * 380);
    R.rain('confetti', 60, cols);
    U.setBanner('とうちゃく！', { sub: KR.STATIONS[e.st].name + '　一番乗りは ' + co.name + '（' + e.dist + 'マスの 旅）', col: co.color, big: true, life: 3.0, money: e.prize, p: e.p, stamp: e.exact ? 'ぴったり賞' : null });
    if (e.p !== 0) U.say(e.p, pickLine(e.p, 'arrive'), 2.6);
    await wait(2.9);
  }
  async function openAnim(G, e) {
    const r = e.r, reg = KR.REGIONS[r], co = KR.COMPANIES[e.p];
    const pts = [];
    KR.STATIONS.forEach((s, i) => { if (M.nodes[i].r === r) pts.push([M.nodes[i].x, M.nodes[i].y]); });
    for (const gi of e.gates) { const gn = M.nodes[M.gates[gi].node]; pts.push([gn.x, gn.y]); }
    R.fit(pts, 80, 0.7, 0.25);
    await wait(0.7);
    R.openAnim[r] = 0.001;
    S.play('open'); R.shake = 0.5;
    for (const gi of e.gates) { const gn = M.nodes[M.gates[gi].node]; R.ring(gn.x, gn.y, co.color, 140, 1.2); R.burst(gn.x, gn.y, 'star', 20, { cols: [co.color, '#fff', '#f3c64a'], speed: 200 }); }
    const gnames = e.gates.map((gi) => M.gates[gi].name).join('・');
    U.setBanner(reg.name + ' 開通！', { sub: '関所（' + gnames + '）は ' + co.name + ' のもの', col: reg.ink, big: true, life: 2.8, p: e.p });
    await wait(2.8);
    if (e.p !== 0) hint('open', '目的地に 着いた 会社が つぎの 地方を ひらいたよ。新しい 関所は その会社の もの：ほかの会社が 通るたびに 通行料が 入るんだ。');
  }
  async function destAnim(G, e, first) {
    const n = M.nodes[e.st];
    R.camTo(n.x, n.y, 0.8);
    await wait(0.6);
    S.play('whistle');
    R.ring(n.x, n.y, '#f3b21f', 110, 1.0);
    R.burst(n.x, n.y - 50, 'star', 18, { cols: ['#f3c64a', '#fff', '#e4402f'], speed: 160, g: 80 });
    const prize = Math.round((1000 + 120 * e.dist) * KR.inflation(G.turn) / 10) * 10;
    U.setBanner((first ? 'さいしょの' : 'つぎの') + '目的地は ' + KR.STATIONS[e.st].name + '！', { sub: '一番乗りの 賞金 約' + KR.yen(prize) + '（' + KR.STATIONS[e.st].tag + '）', col: '#c0392b', life: 2.2 });
    await wait(2.1);
    R.placeTokens(G);
    focus(G.cur, Math.max(0.75, R.cam.tz));
  }
  async function monoAnim(G, p, st) {
    const n = M.nodes[st], co = KR.COMPANIES[p];
    S.play('mono');
    R.burst(n.x, n.y - 20, 'star', 30, { cols: [co.color, '#fff', '#f3c64a'], speed: 200, g: 100 });
    R.ring(n.x, n.y, co.color, 100, 0.9);
    U.setBanner('独占！ ' + KR.STATIONS[st].name + '駅', { sub: co.name + '：この駅の 収益は 2倍', col: co.color, life: 1.8, p });
    if (p !== 0) U.say(p, pickLine(p, 'mono'), 2);
    await wait(p === 0 ? 1.6 : 1.1);
  }
  async function evresAnim(G, e) {
    if (!U.panel || U.panel.kind !== 'event') U.panel = { kind: 'event', inst: { id: e.id, rival: e.rival }, p: e.p, phase: 'choose', t: 0 };
    const pnl = U.panel;
    pnl.phase = 'result'; pnl.res = e.res; pnl.choice = e.choice; pnl.t = 0;
    if (e.res.dice || e.res.duel) { S.play('dice'); await wait(0.8); S.play('diceLand'); }
    const good = e.res.money > 0 || (e.res.cards && e.res.cards.length);
    S.play(e.res.money < 0 ? 'bad' : good ? (e.res.money >= 800 ? 'coin' : 'good') : 'click', e.res.money);
    const t = R.tok[e.p];
    if (e.res.money) R.addText(t.x, t.y - 40, (e.res.money > 0 ? '+' : '') + KR.yen(e.res.money), e.res.money > 0 ? '#ffe66b' : '#ffd2c8', 22);
    if (e.p === 0) await ask('evok');
    else await wait(1.5);
    U.panel = null;
  }
  async function settleAnim(G, e) {
    U.panel = { kind: 'settle', s: e.s, rows: e.rows, final: e.final, t: 0, ticks: 0 };
    S.play('register');
    R.rain('coin', 30, ['#f5c242']);
    hint('settle', '決算！ 持っている 名物の 値段の 5% が 入るよ。旬の 名物は 3倍、独占した 駅は 2倍。', false);
    await ask('settle');
    U.panel = null;
  }

  // ------------------------------------------------------------ 結果
  async function showResult(G) {
    store.del(SAVE_KEY);
    const rank = G.rank;
    const me = rank.findIndex((r) => r.p === 0) + 1;
    if (me === 1) prof.wins++;
    prof.best = Math.max(prof.best, E.assets(G, 0));
    saveProf();
    D.result = { rank, me, t: 0 };
    D.screen = 'result';
    R.fit(M.nodes.slice(0, KR.STATIONS.length).map((n) => [n.x, n.y]), 60, 0.4, 0.15);
    S.play(me === 1 ? 'win' : 'lose');
    if (me === 1) R.rain('confetti', 120, ['#f3c64a', '#e4502f', '#fff', '#7fd0f0', '#8a55cf']);
  }

  // ------------------------------------------------------------ 入力
  const toLogical = (ev) => { const r = canvas.getBoundingClientRect(); return [(ev.clientX - r.left) / R.cssSc, (ev.clientY - r.top) / R.cssSc]; };
  let drag = null;
  canvas.addEventListener('pointermove', (ev) => {
    const [x, y] = toLogical(ev);
    U.mouse.x = x; U.mouse.y = y;
    if (drag) {
      const dx = x - drag.x, dy = y - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true;
      if (drag.moved && drag.pan) {
        R.cam.tx = drag.cx - dx / R.cam.z; R.cam.ty = drag.cy - dy / R.cam.z;
        R.cam.x = R.cam.tx; R.cam.y = R.cam.ty;
      }
    }
  });
  function btnAt(x, y) {
    for (let i = U.btns.length - 1; i >= 0; i--) { const b = U.btns[i]; if (U.inRect(x, y, b)) return b; }
    return null;
  }
  function candAt(x, y) {
    if (!R.cands || U.mode !== 'landing') return -1;
    let best = -1, bd = 34;
    R.cands.forEach((c, i) => { if (c.sx == null) return; const d = Math.hypot(c.sx - x, c.sy - y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  canvas.addEventListener('pointerdown', (ev) => {
    S.init();
    if (D.screen === 'play' && !S.bgmOn) S.startBgm(R.season);
    const [x, y] = toLogical(ev);
    U.mouse.x = x; U.mouse.y = y; U.mouse.down = true;
    const onBtn = btnAt(x, y);
    const modal = U.panel && ['settle', 'pause', 'help', 'book', 'event', 'open'].indexOf(U.panel.kind) >= 0;
    drag = { x, y, cx: R.cam.x, cy: R.cam.y, moved: false, pan: !onBtn && !modal && (D.screen === 'play' || D.screen === 'result') };
    D.fast = true;
  });
  window.addEventListener('pointerup', (ev) => {
    U.mouse.down = false; D.fast = false;
    const d = drag; drag = null;
    if (!d) return;
    const [x, y] = toLogical(ev);
    if (d.moved && d.pan) return;
    const b = btnAt(x, y);
    if (b && b.on) { b.on(); return; }
    const ci = candAt(x, y);
    if (ci >= 0 && D.human && D.human.kind === 'landing') { answer({ type: 'land', i: R.cands[ci].i }); return; }
    // 画面の どこかを クリック：みじかい 演出を すすめる
    if (D.screen === 'intro') nextIntro();
  });
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    if (D.screen !== 'play' && D.screen !== 'result') return;
    if (U.panel && ['settle', 'pause', 'help', 'book'].indexOf(U.panel.kind) >= 0) return;
    const [x, y] = toLogical(ev);
    const [wx, wy] = R.s2w(x, y);
    const nz = R.clampZ(R.cam.tz * (ev.deltaY < 0 ? 1.15 : 1 / 1.15));
    R.cam.tz = nz; R.cam.z = nz;
    const [wx2, wy2] = R.s2w(x, y);
    R.cam.x += wx - wx2; R.cam.y += wy - wy2; R.cam.tx = R.cam.x; R.cam.ty = R.cam.y;
  }, { passive: false });
  window.addEventListener('keydown', (ev) => {
    S.init();
    const k = ev.key;
    if (k === ' ' || k === 'Enter') {
      ev.preventDefault();
      if (ev.repeat) return;
      D.fast = true;
      if (D.screen === 'intro') { nextIntro(); return; }
      if (U.mode === 'landing' && U.kbSel >= 0 && D.human) { answer({ type: 'land', i: R.cands[U.kbSel].i }); return; }
      const b = U.btns.slice().reverse().find((q) => q.key === 'スペース' && q.on);
      if (b) b.on();
      return;
    }
    if (k === 'Escape') {
      if (D.screen === 'play') togglePause();
      else if (U.panel && (U.panel.kind === 'help' || U.panel.kind === 'book')) U.panel = U.panel.back || null;
      return;
    }
    if (k === 'm' || k === 'M') { S.setMuted(!S.muted); prof.muted = S.muted; saveProf(); U.toast(S.muted ? '音：なし' : '音：あり'); return; }
    if (k === 'Tab') { ev.preventDefault(); if (D.screen === 'play') toggleOverview(); return; }
    if (/^[1-9]$/.test(k)) {
      const b = U.btns.slice().reverse().find((q) => q.key === k && q.on);
      if (b) { b.on(); return; }
      if (U.mode === 'action') { const i = +k - 1; const btn = U.btns.find((q) => q.id === 'card:' + i); if (btn) btn.on(); }
      return;
    }
    if (U.mode === 'landing' && R.cands && (k === 'ArrowRight' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowUp')) {
      ev.preventDefault();
      const n = R.cands.length;
      U.kbSel = ((U.kbSel < 0 ? -1 : U.kbSel) + (k === 'ArrowRight' || k === 'ArrowDown' ? 1 : n - 1)) % n;
      R.candHover = U.kbSel;
      const o = R.cands[U.kbSel].opt; R.camTo(M.nodes[o.node].x, M.nodes[o.node].y);
    }
  });
  window.addEventListener('keyup', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') D.fast = false; });
  window.addEventListener('blur', () => { D.fast = false; U.mouse.down = false; });

  function togglePause() {
    if (U.panel && U.panel.kind === 'pause') { U.panel = U.panel.back || null; D.paused = false; return; }
    if (U.panel && (U.panel.kind === 'help' || U.panel.kind === 'book')) { U.panel = U.panel.back || null; return; }
    U.panel = { kind: 'pause', back: U.panel };
    D.paused = true;
  }
  function toggleOverview() {
    if (D.overview) { R.camTo(D.overview.x, D.overview.y, D.overview.z); D.overview = null; return; }
    D.overview = { x: R.cam.tx, y: R.cam.ty, z: R.cam.tz };
    const pts = [];
    KR.STATIONS.forEach((s, i) => { if (D.G && E.active(D.G, i)) pts.push([M.nodes[i].x, M.nodes[i].y]); });
    R.fit(pts, 120, 0.6, 0.17);
  }

  // ------------------------------------------------------------ あなたの 番の ボタンの うごき
  const actionH = {
    onRoll() {
      if (!D.human || D.human.kind !== 'action') return;
      const G = D.G, P = G.P[0];
      const sc = U.selCard >= 0 ? P.cards[U.selCard] : null;
      if (sc && ['kaisoku', 'kaisuu', 'tokkyu'].indexOf(sc.id) >= 0 && E.canUseCard(G, P, U.selCard)) {
        D.autoRoll = true;
        const idx = U.selCard; U.selCard = -1;
        answer({ type: 'card', idx });
      } else { U.selCard = -1; answer({ type: 'roll' }); }
    },
    onCard(i) {
      if (!D.human || D.human.kind !== 'action') return;
      const G = D.G, P = G.P[0];
      const cd = P.cards[i];
      if (!cd || !E.canUseCard(G, P, i)) return;
      S.play('click');
      if (U.selCard === i) { U.selCard = -1; U.sub = null; R.cands = null; return; }
      U.selCard = i; U.sub = null; R.cands = null;
      if (cd.id === 'kakueki') U.sub = { kind: 'kakueki', idx: i, prev: {} };
      else if (cd.id === 'fumikiri') { U.sub = { kind: 'target', idx: i }; U.onPick = (t) => { if (t === 0) return; U.sub = null; U.selCard = -1; answer({ type: 'card', idx: i, target: t }); }; }
      else if (cd.id === 'daruma' || cd.id === 'tobinori') U.sub = { kind: 'confirm', idx: i };
    },
  };
  const kakH = {
    onNum(v) { const s = U.sub; if (!s || !D.human) return; U.sub = null; U.selCard = -1; R.cands = null; D.autoRoll = true; answer({ type: 'card', idx: s.idx, value: v }); },
    onHoverNum(v) {
      const s = U.sub; if (!s || s.hv === v) return;
      s.hv = v;
      const G = D.G;
      const opts = E.reach(G, 0, v);
      R.cands = opts.map((o, i) => ({ opt: o, i })); R.candHover = -1;
    },
    onCancel() { U.sub = null; U.selCard = -1; R.cands = null; },
  };
  const stationH = {
    get canAct() { return !!(D.human && D.human.kind === 'buy') && !(U.panel && U.panel.ro); },
    onBuy(pi) { if (D.human && D.human.kind === 'buy') answer({ type: 'buy', prop: pi }); },
    onTake(pi) { if (D.human && D.human.kind === 'buy') answer({ type: 'takeover', prop: pi }); },
    onDone() { if (D.human && D.human.kind === 'buy') answer({ type: 'done' }); },
  };
  const eventH = {
    get canAct() { return !!(D.human && (D.human.kind === 'event' || D.human.kind === 'evok')); },
    onChoice(i) { if (D.human && D.human.kind === 'event') answer({ type: 'choice', i }); },
    onOk() { if (D.human && D.human.kind === 'evok') answer({}); },
  };
  const openH = { onOpen(r) { if (D.human && D.human.kind === 'open') answer({ type: 'open', r }); } };
  const settleH = { onOk() { if (D.human && D.human.kind === 'settle') answer({}); } };

  // ------------------------------------------------------------ 毎フレーム
  let last = performance.now();
  function frame(now) {
    const dt = KR.clamp((now - last) / 1000, 0, 0.05); last = now;
    if (!D.hold) step(dt);
    draw();
    requestAnimationFrame(frame);
  }
  function step(dt) {
    const k = D.paused ? 0 : timeScale();
    tickTimers(dt * k);
    R.update(dt * Math.max(k, D.paused ? 0 : 1));
    U.update(dt * Math.max(1, k));
    if (U.panel && U.panel.t != null) {
      U.panel.t += dt * Math.max(1, k);
      if (U.panel.kind === 'settle') {
        const tt = U.panel.t;
        if (tt > 0.3 && tt < 2.2) { U.panel.ticks += dt; if (U.panel.ticks > 0.07) { U.panel.ticks = 0; S.play('tick'); } }
        if (tt > 2.2 && !U.panel.ding) { U.panel.ding = true; S.play('register'); }
      }
    }
    if (D.dice) D.dice.t += dt * Math.max(1, k);
    if (D.stampPop) { D.stampPop.t += dt; if (D.stampPop.t > 1.6) D.stampPop = null; }
    // ひとことは 12秒で 消える（いまの 操作についての ものは、その操作が おわるまで）
    if (U.hint) {
      U.hint.t += dt;
      const now = U.mode === 'action' && ['start', 'card', 'speed', 'exact'].indexOf(U.hint.id) >= 0;
      if (U.hint.t > 12 && !now) U.hint = null;
    }
    if (D.follow != null) { const t = R.tok[D.follow]; R.cam.tx = t.x; R.cam.ty = t.y; }
    if (D.screen === 'title') { D.titleT += dt; }
    if (D.result) D.result.t += dt;
    if (D.G && D.screen === 'play' && !R.tok.some((t) => t.anim)) R.placeTokens(D.G);
  }

  // ------------------------------------------------------------ 描画
  function draw() {
    const c = R.c;
    U.btns = [];
    U.hoverCard = -1;
    R.screenTransform();
    if (D.screen === 'title') return drawTitle();
    if (D.screen === 'intro') return drawIntro();
    const G = D.G;
    if (!G) return;
    R.drawMap(G);
    R.drawNodes(G);
    R.drawClouds(G);
    R.drawRegionNames(G);
    // 候補（あなたの 行き先えらび）
    if (R.cands && U.mode === 'landing') {
      const ci = candAt(U.mouse.x, U.mouse.y);
      if (ci >= 0) { R.candHover = ci; U.kbSel = ci; }
      else if (U.kbSel < 0) R.candHover = -1;
    }
    R.drawCands(G);
    R.drawTokens(G, D.screen === 'play' ? D.cur : -1);
    R.drawFx(false);
    if (D.screen === 'result') { drawResult(); R.drawFx(true); return; }
    // 画面の外の 目的地
    if (G.dest >= 0 && !U.panel) { const n = M.nodes[G.dest]; R.edgeArrow(n.x, n.y, '#d6402e', '目的地'); }
    drawHUD(G);
    R.drawFx(true);
  }

  function drawHUD(G) {
    const c = R.c;
    R.screenTransform();
    U.drawDate(G);
    U.drawDest(G);
    const pickable = U.sub && U.sub.kind === 'target' ? [1, 2] : null;
    U.drawCompanies(G, D.cur, pickable);
    // 小さな ボタン
    U.btn('menu', 12, 98, 104, 34, 'メニュー', { size: 14, r: 10, on: togglePause, key: null });
    U.btn('overview', 122, 98, 144, 34, D.overview ? '元にもどす' : '全体を見る', { size: 14, r: 10, on: toggleOverview });
    A.text(c, 'Esc', 100, 126, 9, '#9a7a5a', 'right', 700); A.text(c, 'Tab', 258, 126, 9, '#9a7a5a', 'right', 700);
    // サイコロの 出目
    if (D.dice) drawDice(D.dice);
    if (D.stepsLeft > 0) {
      const t = R.tok[D.cur];
      const [sx, sy] = R.w2s(t.x, t.y);
      A.textOutline(c, 'あと' + D.stepsLeft, sx, sy - 70 * R.tokenScale(), 18, '#fff', KR.COMPANIES[D.cur].dark, 5, 'center', 900);
    }
    if (D.stampPop) drawStampPop(D.stampPop);
    // あなたの 番の 操作
    if (U.mode === 'action' && !U.panel) {
      U.drawAction(G, actionH);
      if (U.sub && U.sub.kind === 'kakueki') U.drawKakueki(G, kakH);
      else if (U.sub && U.sub.kind === 'target') U.drawTarget(G, { onCancel() { U.sub = null; U.selCard = -1; } });
      else if (U.sub && U.sub.kind === 'confirm') drawConfirm(G);
    }
    if (U.mode === 'landing' && D.human) U.drawLanding(G, D.human.total);
    // 駅に マウスを のせると 名物の 一覧
    if (!U.panel && !U.sub && U.mode !== 'landing' && !U.mouse.down && !btnAt(U.mouse.x, U.mouse.y)) {
      const st = stationAt(G, U.mouse.x, U.mouse.y);
      if (st >= 0) drawStationTip(G, st);
    }
    if (D.cpuTurn && !U.panel && D.screen === 'play') {
      const ff = D.fast ? '▶▶ はやおくり中' : 'CPUの番：クリックか スペースを おしたままで ▶▶ はやおくり';
      c.font = KR.FONT(14, 800);
      const fw = c.measureText(ff).width + 32;
      c.fillStyle = D.fast ? 'rgba(228,80,47,0.92)' : 'rgba(255,250,238,0.9)'; A.rr(c, R.W / 2 - 70 - fw / 2, R.H - 42, fw, 30, 15); c.fill();
      c.strokeStyle = '#6b4a2b'; c.lineWidth = 1.5; A.rr(c, R.W / 2 - 70 - fw / 2, R.H - 42, fw, 30, 15); c.stroke();
      A.text(c, ff, R.W / 2 - 70, R.H - 26, 14, D.fast ? '#fff' : '#5a3b22', 'center', 800);
    }
    U.drawSpeech();
    U.drawToasts();
    if (!U.panel) U.drawHint();
    // パネル
    const p = U.panel;
    if (p) {
      if (p.kind === 'station') U.drawStation(G, p, stationH);
      else if (p.kind === 'event') U.drawEvent(G, p, eventH);
      else if (p.kind === 'open') U.drawOpen(G, p, openH);
      else if (p.kind === 'settle') U.drawSettle(G, p, settleH);
      else drawMenus(p);
      if (p.kind === 'station' && p.note) { const r = p.rect; if (r) A.textOutline(c, p.note, r.x + r.w / 2 - 60, r.y + r.h - 24, 16, '#c0392b', '#fffaf0', 5); }
      if (p.kind === 'station' && p.rect) U.drawHint(p.rect);
    }
    U.drawBanner();
  }
  function stationAt(G, x, y) {
    let best = -1, bd = 22;
    for (let i = 0; i < KR.STATIONS.length; i++) {
      if (!E.active(G, i)) continue;
      const [sx, sy] = R.w2s(M.nodes[i].x, M.nodes[i].y);
      const d = Math.hypot(sx - x, sy - y);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function drawStationTip(G, st) {
    const c = R.c, s = KR.STATIONS[st];
    const reg = KR.REGIONS.find((r) => r.id === s.r);
    const season = KR.seasonOf(Math.min(G.turn, KR.TURNS - 1));
    const w = 300, h = 58 + s.pi.length * 24 + 8;
    let x = U.mouse.x + 18, y = U.mouse.y + 14;
    if (x + w > R.W - 270) x = U.mouse.x - w - 18;
    if (y + h > R.H - 10) y = R.H - h - 10;
    U.box(x, y, w, h, { r: 10, plain: true, fill: '#fffdf6' });
    A.text(c, s.name + '駅', x + 14, y + 20, 17, A.INK, 'left', 900);
    c.font = KR.FONT(17, 900);
    A.text(c, reg.name, x + 20 + c.measureText(s.name + '駅').width, y + 22, 11, reg.ink, 'left', 800);
    const mono = E.monoOwner(G, st);
    if (mono >= 0) A.text(c, KR.COMPANIES[mono].short + 'の独占', x + w - 12, y + 20, 11, KR.COMPANIES[mono].dark, 'right', 900);
    A.text(c, s.tag, x + 14, y + 42, 11, '#7a5a3a', 'left', 700);
    s.pi.forEach((pi, k) => {
      const pr = M.props[pi], o = G.own[pi];
      const ry = y + 66 + k * 24;
      c.fillStyle = o >= 0 ? KR.COMPANIES[o].color : '#fff'; A.circle(c, x + 20, ry, 6); c.fill();
      c.strokeStyle = '#6b4a2b'; c.lineWidth = 1.2; c.stroke();
      A.text(c, pr.name, x + 32, ry, 13, A.INK, 'left', 800);
      A.seasonBadge(c, pr.season, x + 196, ry, 15, pr.season === season);
      A.text(c, KR.yenShort(pr.price), x + w - 12, ry, 12, '#5a4632', 'right', 800);
    });
  }
  function drawConfirm(G) {
    const c = R.c, P = G.P[0];
    const s = U.sub, cd = KR.CARDS[P.cards[s.idx].id];
    const w = 380, h = 96, x = R.W / 2 - 70 - w / 2, y = R.H - 270;
    U.box(x, y, w, h, { fill: '#fffdf6' });
    A.text(c, cd.name + ' を つかう？', x + w / 2, y + 28, 17, A.INK, 'center', 900);
    U.btn('cfYes', x + 40, y + 48, 140, 36, 'つかう', { kind: 'primary', size: 16, key: '1', on: () => { const i = s.idx; U.sub = null; U.selCard = -1; answer({ type: 'card', idx: i }); } });
    U.btn('cfNo', x + w - 180, y + 48, 140, 36, 'やめる', { size: 16, key: '2', on: () => { U.sub = null; U.selCard = -1; } });
  }
  function drawDice(d) {
    const c = R.c;
    const n = d.vals.length;
    const total = d.vals.reduce((a, b) => a + b, 0);
    if (!d.done) d.doneT = d.t;
    // ふっている あいだは 画面の まんなか。止まったら コマの 上へ 小さく うつる
    const k = d.done ? KR.easeInOut(KR.clamp((d.t - d.doneT - 0.35) / 0.35, 0, 1)) : 0;
    const tk = R.tok[d.p];
    const [tx, ty] = R.w2s(tk.x, tk.y);
    const cx = KR.lerp(R.W / 2 - 70, tx, k), cy = KR.lerp(R.H * 0.58, ty - 92 * R.tokenScale() - 20, k);
    const size = KR.lerp(72, 38, k), gap = KR.lerp(92, 44, k);
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * gap;
      if (!d.done) {
        const v = 1 + Math.floor((d.t * 18 + i * 2) % (d.mode === 'slow' ? 3 : 6));
        const yy = cy - Math.abs(Math.sin(d.t * 14 + i)) * 40;
        if (d.mode === 'slow') A.dieSlow(c, x, yy, size, v, d.t * 10 + i);
        else A.die(c, x, yy, size, v, d.t * 10 + i);
      } else {
        const pop = 1 + 0.12 * (1 - KR.clamp((d.t - d.doneT) * 6, 0, 1));
        if (d.mode === 'slow') A.dieSlow(c, x, cy, size * pop, d.vals[i], 0);
        else A.die(c, x, cy, size * pop, d.vals[i], 0);
      }
    }
    if (d.done) {
      const lab = d.mode === 'kakueki' ? '各停 ' + total + ' マス' : n > 1 ? '合計 ' + total : total + '';
      A.textOutline(c, lab, cx, cy + KR.lerp(66, 34, k), KR.lerp(n > 1 || d.mode === 'kakueki' ? 30 : 36, 20, k), '#fff', KR.COMPANIES[d.p].dark, 6, 'center', 900);
    }
  }
  function drawStampPop(sp) {
    const c = R.c;
    const t = sp.t;
    const k = t < 0.2 ? KR.easeOutBack(t / 0.2) : 1;
    const a = t > 1.2 ? 1 - (t - 1.2) / 0.4 : 1;
    c.save(); c.globalAlpha = Math.max(0, a);
    const bx = R.W - 262 - 128, by = 10;
    const x = bx + 56, y = by + 56;
    c.fillStyle = 'rgba(255,250,238,0.94)'; A.rr(c, bx, by, 112, 118, 12); c.fill();
    c.strokeStyle = '#6b4a2b'; c.lineWidth = 2; A.rr(c, bx, by, 112, 118, 12); c.stroke();
    A.text(c, 'スタンプ！', x, by + 106, 12, '#6b4a2b', 'center', 900);
    c.translate(x, y); c.scale(1.6 - 0.6 * k, 1.6 - 0.6 * k);
    A.stamp(c, sp.st, 0, 0, 42);
    c.restore();
  }

  // ------------------------------------------------------------ メニュー・あそびかた・帳
  function drawMenus(p) {
    const c = R.c;
    c.fillStyle = 'rgba(30,20,10,0.5)'; c.fillRect(0, 0, R.W, R.H);
    if (p.kind === 'pause') {
      const w = 420, h = 470, x = R.W / 2 - w / 2, y = R.H / 2 - h / 2;
      U.box(x, y, w, h);
      A.text(c, 'ひとやすみ', x + w / 2, y + 42, 28, A.INK, 'center', 900);
      let yy = y + 76;
      U.btn('resume', x + 60, yy, w - 120, 44, 'つづける', { kind: 'primary', size: 18, key: 'スペース', on: togglePause }); yy += 54;
      U.btn('help', x + 60, yy, w - 120, 40, 'あそびかた', { size: 16, on: () => { U.panel = { kind: 'help', back: p }; D.helpPage = 0; } }); yy += 48;
      U.btn('book', x + 60, yy, w - 120, 40, '駅スタンプ帳・名物帳', { size: 16, on: () => { U.panel = { kind: 'book', back: p }; D.bookTab = 0; D.bookPage = 0; } }); yy += 58;
      volRow(x + 40, yy, w - 80, 'BGM', 'bgm'); yy += 44;
      volRow(x + 40, yy, w - 80, '効果音', 'sfx'); yy += 44;
      A.text(c, 'CPUの 番の はやさ', x + 50, yy + 18, 15, A.INK, 'left', 800);
      U.btn('spd1', x + w - 210, yy, 80, 36, 'ふつう', { size: 14, sel: prof.cpuSpeed === 1, on: () => { prof.cpuSpeed = 1; saveProf(); } });
      U.btn('spd2', x + w - 120, yy, 80, 36, 'はやい', { size: 14, sel: prof.cpuSpeed !== 1, on: () => { prof.cpuSpeed = 1.8; saveProf(); } });
      yy += 56;
      U.btn('title', x + 60, yy, w - 120, 40, 'タイトルへ（とちゅうから 再開できる）', { size: 14, on: () => { D.paused = false; toTitle(); } });
    } else if (p.kind === 'help') drawHelp(p);
    else if (p.kind === 'book') drawBook(p);
  }
  function volRow(x, y, w, label, key) {
    const c = R.c;
    A.text(c, label, x + 10, y + 18, 15, A.INK, 'left', 800);
    const v = S.vol[key];
    const bx = x + 110, bw = w - 220;
    c.fillStyle = '#e8dcc4'; A.rr(c, bx, y + 12, bw, 12, 6); c.fill();
    c.fillStyle = '#e4502f'; A.rr(c, bx, y + 12, bw * v, 12, 6); c.fill();
    U.btn('vm' + key, x + w - 100, y, 44, 36, '−', { size: 20, on: () => { S.vol[key] = Math.max(0, Math.round((v - 0.1) * 10) / 10); S.apply(); prof.vol = S.vol; saveProf(); S.play('click'); } });
    U.btn('vp' + key, x + w - 50, y, 44, 36, '+', { size: 20, on: () => { S.vol[key] = Math.min(1, Math.round((v + 0.1) * 10) / 10); S.apply(); prof.vol = S.vol; saveProf(); S.play('click'); } });
  }

  const HELP = [
    { title: 'めざすこと', lines: ['あなたは「あかつき鉄道」の 社長。ライバルは きつねの コン社長（ゆうぐれ急行）と、たぬきの ポン社長（つきよ交通）。', '4月から 3月まで、1年（24ターン）で 日本を 走りまわる。', '3月の おわりに「総資産」（お金 ＋ 持っている 名物の 値段）が いちばん 多い 会社の かち！'], pic: 'goal' },
    { title: 'サイコロと 目的地', lines: ['サイコロを ふると、とまれる マスが 光る。好きな マスを クリック。', '目的地（赤い旗）に 一番乗りすると 賞金。とちゅうで 通っても とうちゃく。', '出目が 目的地までの マス数と ぴったり同じなら「ぴったり賞」で 賞金 1.5倍！'], pic: 'dice' },
    { title: '地方を ひらく', lines: ['はじめは 関東と 東海だけ。ほかの 地方は 雲の 下。', '目的地に 一番乗りした 会社が、つぎに ひらく 地方を えらぶ。つぎの 目的地は その地方に 出る。', 'ひらいた 地方への 関所は その会社の もの。ほかの 会社が 通るたびに 通行料が 入る。'], pic: 'open' },
    { title: '名物と 決算', lines: ['駅に とまると 名物を 買える。季節の おわり（6・9・12・3月）に「決算」。', '収益は 値段の 5%。名物の 旬の 季節なら 3倍。', '駅の 名物を ぜんぶ 持つと「独占」：その駅の 収益は 2倍。地図の 駅に マウスを のせると、名物と 持ち主が 見える。'], pic: 'buy' },
    { title: 'マスと きっぷ', lines: ['晴れ：お金。雨：出費。きっぷ：きっぷ1まい。できごと：その土地の できごと（どうするか えらぶ）。', 'きっぷは 1ターンに 1まい。快速（サイコロ2こ）・特急（3こ）・各停（すきな数）・ふみきり（相手を おそく）など。', 'はじめて 通った 駅で スタンプ。地方の 駅を ぜんぶ 集めると ボーナス。'], pic: 'squares' },
    { title: 'そうさ', lines: ['クリック：えらぶ・けってい。ドラッグ：地図を うごかす。ホイール：ズーム。', 'スペース：サイコロ・OK。Tab：全体を見る。Esc：メニュー。M：音の あり・なし。', 'CPUの 番は クリックや スペースを おしたままで はやおくり。進みぐあいは 自動で 保存。'], pic: 'keys' },
  ];
  function drawHelp(p) {
    const c = R.c;
    const w = Math.min(900, R.W - 60), h = 560, x = R.W / 2 - w / 2, y = R.H / 2 - h / 2;
    U.box(x, y, w, h);
    const pg = HELP[D.helpPage];
    A.text(c, 'あそびかた　' + (D.helpPage + 1) + ' / ' + HELP.length, x + 30, y + 34, 13, '#9a7a5a', 'left', 800);
    A.text(c, pg.title, x + w / 2, y + 66, 30, A.INK, 'center', 900);
    // 絵
    helpPic(pg.pic, x + w / 2, y + 190);
    let yy = y + 316;
    for (const l of pg.lines) {
      const ls = A.wrap(c, l, w - 120, 17, 700);
      ls.forEach((s, i) => { A.text(c, (i ? '　' : '・') + s, x + 60, yy, 17, '#3a2a1c', 'left', 700); yy += 28; });
      yy += 6;
    }
    U.btn('hprev', x + 30, y + h - 60, 120, 40, '← まえ', { size: 16, disabled: D.helpPage === 0, on: () => { D.helpPage--; } });
    U.btn('hnext', x + w - 150, y + h - 60, 120, 40, D.helpPage < HELP.length - 1 ? 'つぎ →' : 'とじる', { kind: 'primary', size: 16, key: 'スペース', on: () => { if (D.helpPage < HELP.length - 1) D.helpPage++; else U.panel = p.back || null; } });
    U.btn('hclose', x + w / 2 - 60, y + h - 60, 120, 40, 'とじる', { size: 16, on: () => { U.panel = p.back || null; } });
  }
  function helpPic(kind, x, y) {
    const c = R.c;
    if (kind === 'goal') {
      [0, 1, 2].forEach((i) => { A.portrait(c, i, x - 180 + i * 180, y - 10, 52, i === 0 ? 'happy' : null); A.text(c, KR.COMPANIES[i].name, x - 180 + i * 180, y + 62, 15, KR.COMPANIES[i].dark, 'center', 900); });
    } else if (kind === 'dice') {
      A.die(c, x - 200, y, 70, 4, -0.15);
      for (let i = 0; i < 5; i++) { const sx = x - 110 + i * 60; c.fillStyle = A.SQ[['plus', 'card', 'event', 'plus', 'minus'][i]].col; A.circle(c, sx, y, 18); c.fill(); A.sqIcon(c, ['plus', 'card', 'event', 'plus', 'minus'][i], sx, y, 15); }
      c.save(); c.translate(x + 200, y + 30); c.strokeStyle = '#4a3626'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -70); c.stroke(); c.fillStyle = '#e4402f'; c.beginPath(); c.moveTo(1, -68); c.lineTo(50, -56); c.lineTo(1, -44); c.closePath(); c.fill(); c.restore();
      A.text(c, 'ぴったり 1.5倍！', x + 200, y + 56, 15, '#c0392b', 'center', 900);
    } else if (kind === 'open') {
      c.fillStyle = '#f2efe8'; for (let i = 0; i < 7; i++) { A.circle(c, x + 90 + (i % 4) * 40, y - 30 + Math.floor(i / 4) * 50, 36); c.fill(); }
      A.textOutline(c, '未開通', x + 150, y, 22, '#8a7a66', '#f8f6f1', 5);
      c.strokeStyle = '#4a3a2c'; c.lineWidth = 7; c.beginPath(); c.moveTo(x - 260, y); c.lineTo(x + 40, y); c.stroke();
      c.strokeStyle = '#fbf3e2'; c.lineWidth = 3.4; c.setLineDash([11, 11]); c.stroke(); c.setLineDash([]);
      c.fillStyle = A.SQ.gate.col; A.circle(c, x - 40, y, 18); c.fill(); c.strokeStyle = KR.COMPANIES[0].color; c.lineWidth = 4; A.circle(c, x - 40, y, 18); c.stroke(); A.sqIcon(c, 'gate', x - 40, y, 14);
      A.text(c, '関所：通行料', x - 40, y + 38, 14, A.INK, 'center', 900);
      A.train(c, 1, x - 200, y - 20, 1.3, 1, 0);
    } else if (kind === 'buy') {
      const sts = [[0, 'もんじゃ焼き屋', -1, 'food'], [1, '港の観覧車', 1, 'sight'], [2, '温泉旅館', 3, 'inn']];
      sts.forEach((q, i) => { const sx = x - 220 + i * 220; c.fillStyle = q[2] < 0 ? '#b8ad9c' : KR.SEASONS[q[2]].color; A.circle(c, sx, y - 20, 34); c.fill(); A.catIcon(c, q[3], sx, y - 20, 22, '#fff'); A.text(c, q[1], sx, y + 34, 15, A.INK, 'center', 900); A.seasonBadge(c, q[2], sx - 22, y + 60, 20, q[2] === 1); });
    } else if (kind === 'squares') {
      ['plus', 'minus', 'card', 'event'].forEach((t, i) => { const sx = x - 240 + i * 120; c.fillStyle = A.SQ[t].col; A.circle(c, sx, y - 30, 26); c.fill(); c.strokeStyle = A.SQ[t].ring; c.lineWidth = 3; A.circle(c, sx, y - 30, 26); c.stroke(); A.sqIcon(c, t, sx, y - 30, 22); A.text(c, A.SQ[t].name, sx, y + 12, 14, A.INK, 'center', 900); });
      A.ticket(c, 'tokkyu', x + 230, y - 80, 74, 100, {});
      A.stamp(c, 0, x + 340, y - 30, 40);
    } else if (kind === 'keys') {
      const keys = [['クリック', 'えらぶ'], ['ドラッグ', '地図'], ['スペース', 'サイコロ'], ['Tab', '全体'], ['Esc', 'メニュー'], ['M', '音']];
      keys.forEach((k, i) => { const sx = x - 300 + i * 120; c.fillStyle = '#fff'; A.rr(c, sx - 48, y - 50, 96, 50, 10); c.fill(); c.strokeStyle = '#6b4a2b'; c.lineWidth = 2; A.rr(c, sx - 48, y - 50, 96, 50, 10); c.stroke(); A.text(c, k[0], sx, y - 25, 16, A.INK, 'center', 900); A.text(c, k[1], sx, y + 20, 14, '#7a5a3a', 'center', 800); });
    }
  }
  function drawBook(p) {
    const c = R.c;
    const w = Math.min(1060, R.W - 40), h = 620, x = R.W / 2 - w / 2, y = R.H / 2 - h / 2;
    U.box(x, y, w, h);
    U.btn('tab0', x + 24, y + 18, 190, 40, '駅スタンプ帳', { size: 16, sel: D.bookTab === 0, kind: D.bookTab === 0 ? 'gold' : 'paper', on: () => { D.bookTab = 0; D.bookPage = 0; } });
    U.btn('tab1', x + 224, y + 18, 150, 40, '名物帳', { size: 16, sel: D.bookTab === 1, kind: D.bookTab === 1 ? 'gold' : 'paper', on: () => { D.bookTab = 1; D.bookPage = 0; } });
    U.btn('bclose', x + w - 130, y + 18, 106, 40, 'とじる', { size: 16, key: 'スペース', on: () => { U.panel = p.back || null; } });
    if (D.bookTab === 0) {
      A.text(c, '集めた スタンプ ' + prof.stamps.length + ' / ' + KR.STATIONS.length + '（ゲームを こえて のこる）', x + w - 150, y + 38, 13, '#7a5a3a', 'right', 800);
      // 地方ごとに 2列で ならべる
      KR.REGIONS.forEach((reg, ri) => {
        const col = ri < 5 ? 0 : 1, row = ri < 5 ? ri : ri - 5;
        const ox = x + 26 + col * (w / 2 - 10), oy = y + 96 + row * 104;
        const sts = KR.STATIONS.map((s, i) => i).filter((i) => KR.STATIONS[i].r === reg.id);
        const got = sts.filter((si) => prof.stamps.indexOf(si) >= 0).length;
        A.text(c, reg.name, ox, oy - 18, 14, reg.ink, 'left', 900);
        A.text(c, got + '/' + sts.length, ox + w / 2 - 50, oy - 18, 12, got === sts.length ? '#c0392b' : '#9a7a5a', 'right', 900);
        sts.forEach((si, k) => {
          const has = prof.stamps.indexOf(si) >= 0;
          const sx = ox + 34 + k * 76, sy = oy + 28;
          A.stamp(c, si, sx, sy, 28, { gray: !has, alpha: has ? 0.95 : 0.55 });
          A.text(c, KR.STATIONS[si].name, sx, sy + 40, 11, has ? '#5a4632' : '#b3a690', 'center', 800);
        });
      });
    } else {
      const per = 54;
      const all = M.props;
      const pages = Math.ceil(all.length / per);
      D.bookPage = KR.clamp(D.bookPage, 0, pages - 1);
      A.text(c, '持ったことの ある 名物 ' + prof.props.length + ' / ' + all.length, x + w - 150, y + 38, 13, '#7a5a3a', 'right', 800);
      const list = all.slice(D.bookPage * per, D.bookPage * per + per);
      const colW = (w - 60) / 3;
      list.forEach((pr, k) => {
        const col = Math.floor(k / 18), row = k % 18;
        const px = x + 30 + col * colW, py = y + 86 + row * 27;
        const has = prof.props.indexOf(pr.i) >= 0;
        c.fillStyle = has ? (pr.season < 0 ? '#b8ad9c' : KR.SEASONS[pr.season].color) : '#ddd3c2';
        A.circle(c, px + 10, py, 10); c.fill();
        if (has) A.catIcon(c, pr.cat, px + 10, py, 7, '#fff');
        A.text(c, KR.STATIONS[pr.st].name, px + 28, py, 11, '#9a7a5a', 'left', 700);
        A.text(c, has ? pr.name : '？？？', px + 76, py, 13, has ? A.INK : '#b3a690', 'left', 800);
      });
      U.btn('bprev', x + 30, y + h - 54, 110, 36, '← まえ', { size: 14, disabled: D.bookPage === 0, on: () => { D.bookPage--; } });
      A.text(c, (D.bookPage + 1) + ' / ' + pages, x + w / 2, y + h - 36, 14, '#7a5a3a', 'center', 800);
      U.btn('bnext', x + w - 140, y + h - 54, 110, 36, 'つぎ →', { size: 14, disabled: D.bookPage >= pages - 1, on: () => { D.bookPage++; } });
    }
  }

  // ------------------------------------------------------------ タイトル
  function demoG() {
    if (!D.titleG) { D.titleG = E.create(7); D.titleG.open = D.titleG.open.map(() => true); D.titleG.dest = -1; }
    return D.titleG;
  }
  function drawTitle() {
    const c = R.c;
    const G = demoG();
    // 季節が めぐる
    const s = ((Math.floor(D.titleT / 7) % 4) + 4) % 4;
    if (s !== R.season) { R.prevSeason = R.season; R.season = s; R.seasonT = 0; }
    const t = D.titleT * 0.02;
    R.camTo(M.W * 0.55 + Math.sin(t) * 300, M.H * 0.52 + Math.cos(t * 0.8) * 260, 0.42, true);
    R.drawMap(G);
    R.drawNodes(G, { allNames: false });
    R.screenTransform();
    // ひだりの 帯
    const g = c.createLinearGradient(0, 0, 640, 0);
    g.addColorStop(0, 'rgba(251,243,226,0.96)'); g.addColorStop(0.75, 'rgba(251,243,226,0.85)'); g.addColorStop(1, 'rgba(251,243,226,0)');
    c.fillStyle = g; c.fillRect(0, 0, 700, R.H);
    const x = 70;
    A.text(c, 'ころころ、', x + 6, 120, 44, '#c0392b', 'left', 900);
    A.textOutline(c, 'ひらけ列島', x, 196, 86, '#3a2a1c', '#fff', 10, 'left', 900);
    A.text(c, '― 三つの鉄道と にっぽん開通すごろく ―', x + 6, 258, 20, '#7a5a3a', 'left', 800);
    [0, 1, 2].forEach((i) => A.train(c, i, x + 40 + i * 92, 312 + Math.sin(D.titleT * 3 + i) * 3, 1.3, 1, 0));
    const sv = store.get(SAVE_KEY);
    let by = 370;
    U.btn('start', x, by, 300, 56, 'はじめから', { kind: 'primary', size: 22, key: sv ? null : 'スペース', on: () => { S.init(); S.play('click'); if (sv) { D.confirmNew = true; } else newGame(); } });
    by += 66;
    if (sv) {
      const G2 = sv.G;
      U.btn('continue', x, by, 300, 56, 'つづきから', { kind: 'gold', size: 22, key: 'スペース', sub: KR.turnLabel(Math.min(G2.turn, 23)) + '・総資産 ' + KR.yenShort(E.assets(G2, 0)), on: () => { S.init(); S.play('click'); continueGame(); S.startBgm(R.season); } });
      by += 66;
    }
    U.btn('thelp', x, by, 145, 44, 'あそびかた', { size: 16, on: () => { U.panel = { kind: 'help' }; D.helpPage = 0; } });
    U.btn('tbook', x + 155, by, 145, 44, 'スタンプ帳', { size: 16, on: () => { U.panel = { kind: 'book' }; D.bookTab = 0; } });
    by += 64;
    A.text(c, 'スタンプ ' + prof.stamps.length + '/' + KR.STATIONS.length + '　名物 ' + prof.props.length + '/' + M.props.length + '　1位 ' + prof.wins + '回 / ' + prof.plays + '回', x + 4, by, 14, '#7a5a3a', 'left', 700);
    A.text(c, 'PC の ブラウザ向け・音が 出ます（M で 消音）・1回 20〜30分ほど', x + 4, by + 24, 12, '#9a7a5a', 'left', 700);
    if (D.confirmNew) {
      c.fillStyle = 'rgba(30,20,10,0.5)'; c.fillRect(0, 0, R.W, R.H);
      U.btns = [];
      const w = 460, h = 170, bx = R.W / 2 - w / 2, byy = R.H / 2 - h / 2;
      U.box(bx, byy, w, h);
      A.text(c, 'とちゅうの 記録が 消えます。はじめから？', bx + w / 2, byy + 50, 17, A.INK, 'center', 900);
      U.btn('cnYes', bx + 40, byy + 96, 170, 46, 'はじめから', { kind: 'primary', size: 17, on: () => { D.confirmNew = false; store.del(SAVE_KEY); newGame(); } });
      U.btn('cnNo', bx + w - 210, byy + 96, 170, 46, 'やめる', { size: 17, key: 'スペース', on: () => { D.confirmNew = false; } });
    }
    if (U.panel) drawMenus(U.panel);
  }

  // ------------------------------------------------------------ はじめの話
  const INTRO = [
    { p: 0, text: '4月1日。にっぽんの 線路は、まだ 東京の まわりと 東海だけ。ほかの 地方は 雲の 向こう。' },
    { p: 1, text: '三つの 鉄道会社が、1年かけて 目的地を めざし、地方を ひらきながら 日本じゅうを 走る。' },
    { p: 2, text: '3月の おわりに、いちばん 財産の 多い 会社が「にっぽん一の 鉄道会社」。さあ、出発しよう！' },
  ];
  function nextIntro() {
    S.play('click');
    D.introPage++;
    if (D.introPage >= INTRO.length) { D.screen = 'play'; S.startBgm(R.season); startDirector(); }
  }
  function drawIntro() {
    const c = R.c;
    const G = D.G;
    R.camTo(M.nodes[M.stIdx.tokyo].x - 200, M.nodes[M.stIdx.tokyo].y - 100, 0.42, false);
    R.drawMap(G); R.drawNodes(G); R.drawClouds(G);
    R.screenTransform();
    c.fillStyle = 'rgba(30,20,10,0.08)'; c.fillRect(0, 0, R.W, R.H);
    const pg = INTRO[D.introPage];
    const w = 760, h = 200, x = R.W / 2 - w / 2, y = R.H - h - 40;
    U.box(x, y, w, h);
    A.portrait(c, pg.p, x + 90, y + 100, 60, 'happy');
    const lines = A.wrap(c, pg.text, w - 220, 22, 800);
    lines.forEach((l, i) => A.text(c, l, x + 180, y + 64 + i * 36, 22, A.INK, 'left', 800));
    A.text(c, (D.introPage + 1) + ' / ' + INTRO.length + '　クリック・スペースで つぎへ', x + w - 20, y + h - 22, 12, '#9a7a5a', 'right', 700);
    U.btn('skip', R.W - 150, 20, 130, 40, 'とばす', { size: 15, on: () => { D.introPage = INTRO.length - 1; nextIntro(); } });
  }

  // ------------------------------------------------------------ 結果の 画面
  function drawResult() {
    const c = R.c, G = D.G, res = D.result;
    R.screenTransform();
    c.fillStyle = 'rgba(30,20,10,0.35)'; c.fillRect(0, 0, R.W, R.H);
    const w = Math.min(1080, R.W - 40), h = 640, x = R.W / 2 - w / 2, y = R.H / 2 - h / 2;
    U.box(x, y, w, h);
    const win = res.me === 1;
    c.fillStyle = win ? '#e4502f' : '#6b8cae'; A.rr(c, x + 10, y + 10, w - 20, 80, 12); c.fill();
    A.textOutline(c, win ? 'にっぽん一の 鉄道会社！' : 'あかつき鉄道は ' + res.me + '位', x + w / 2, y + 42, 34, '#fff', 'rgba(40,20,10,0.5)', 7, 'center', 900);
    const gap = res.rank[0].assets - E.assets(G, 0);
    A.text(c, win ? '1年の 旅が おわった。3月末の 総資産で 1位！' : '1年の 旅が おわった。1位まで あと ' + KR.yen(gap), x + w / 2, y + 74, 14, '#fff', 'center', 800);
    // 表彰台
    const order = [1, 0, 2];
    order.forEach((ri, k) => {
      const r = res.rank[ri]; if (!r) return;
      const px = x + w / 2 + (k - 1) * 230, base = y + 340;
      const ph = [120, 92, 70][ri];
      const co = KR.COMPANIES[r.p];
      c.fillStyle = co.light; A.rr(c, px - 90, base - ph, 180, ph, 8); c.fill();
      c.strokeStyle = co.color; c.lineWidth = 3; A.rr(c, px - 90, base - ph, 180, ph, 8); c.stroke();
      A.text(c, (ri + 1) + '位', px, base - ph + 30, 26, ri === 0 ? '#c0392b' : A.INK, 'center', 900);
      A.text(c, KR.yen(r.assets), px, base - ph + 62, 17, A.INK, 'center', 900);
      A.portrait(c, r.p, px, base - ph - 48, 42, ri === 0 ? 'happy' : null);
      A.text(c, co.name, px, base + 18, 15, co.dark, 'center', 900);
    });
    // あなたの 記録
    const P = G.P[0];
    const props = E.propsOf(G, 0).length;
    const stats = [
      ['目的地 一番乗り', P.st.dest + '回（ぴったり ' + P.st.exact + '回）'],
      ['あなたが ひらいた 地方', P.st.opened + 'つ'],
      ['独占した 駅', E.monoCount(G, 0) + '駅'],
      ['持っている 名物', props + '件'],
      ['決算の 収益', KR.yen(P.st.income)],
      ['通行料 収入', KR.yen(P.st.tollIn)],
      ['スタンプ', P.stamps.length + '駅（はじめて ' + D.newStamps + '）'],
      ['日本の 開通', G.open.filter((o) => o).length + ' / ' + KR.REGIONS.length + ' 地方' + (G.open.every((o) => o) ? '　全線 開通！' : '')],
    ];
    const sx = x + 60, sy = y + 384;
    A.text(c, 'あかつき鉄道の 1年', sx, sy, 15, '#e4502f', 'left', 900);
    stats.forEach((s, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const tx = sx + col * (w / 2 - 40), ty = sy + 34 + row * 34;
      A.text(c, s[0], tx, ty, 15, '#7a5a3a', 'left', 800);
      A.text(c, s[1], tx + 186, ty, 16, A.INK, 'left', 900);
    });
    U.btn('again', x + w / 2 - 250, y + h - 66, 230, 48, 'もういちど あそぶ', { kind: 'primary', size: 18, key: 'スペース', on: () => { newGame(); } });
    U.btn('rtitle', x + w / 2 + 20, y + h - 66, 230, 48, 'タイトルへ', { size: 18, on: () => { toTitle(); } });
  }

  // ------------------------------------------------------------ 画面の 大きさ
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    R.resize(window.innerWidth, window.innerHeight, dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // ------------------------------------------------------------ 検証用の 入口
  KR12.debug = {
    set speed(v) { D.speed = v; }, get speed() { return D.speed; },
    buttons() { return U.btns.map((b) => ({ id: b.id, label: b.label, x: (b.x + b.w / 2) * R.cssSc, y: (b.y + b.h / 2) * R.cssSc, key: b.key || null, on: !!b.on })); },
    cands() { return R.cands && U.mode === 'landing' ? R.cands.map((c) => ({ i: c.i, node: c.opt.node, dest: c.opt.dest, exact: c.opt.exact, x: c.sx * R.cssSc, y: c.sy * R.cssSc })) : null; },
    state() {
      const G = D.G;
      return { screen: D.screen, human: D.human ? D.human.kind : null, panel: U.panel ? U.panel.kind : null, sub: U.sub ? U.sub.kind : null, mode: U.mode, turn: G ? G.turn : -1, cur: G ? G.cur : -1, need: G && G.need ? G.need.k : null, over: G ? G.over : false };
    },
    hold(v) { D.hold = v; },
    run(n, dt) { for (let i = 0; i < (n || 1); i++) step(dt || 1 / 60); draw(); },
    G() { return D.G; },
    newGame, continueGame, toTitle,
    worldToScreen(x, y) { const p = R.w2s(x, y); return [p[0] * R.cssSc, p[1] * R.cssSc]; },
  };

  requestAnimationFrame(frame);
})();
