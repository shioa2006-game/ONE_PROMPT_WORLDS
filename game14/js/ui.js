/* ui.js — DOM rendering helpers for 天下賽配 (panels, cards, popups). Game flow lives in main.js. */
(function () {
  'use strict';
  const GD = window.GAME_DATA;
  const $ = s => document.querySelector(s);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const E = () => window.Engine;
  const D = GD.DAIMYO, P = GD.PROVINCES;
  const STAT = { econ: '経済', mil: '軍事', def: '守備' };

  function pips(n, max) {
    let s = '<span class="pips5">';
    for (let i = 1; i <= (max || 5); i++) s += i <= n ? '●' : '<span class="off">●</span>';
    return s + '</span>';
  }
  function flagStyle(d) { const c = D[d].color; return `background:${c};color:${window.MapView.lum(c) > 0.62 ? '#2a1a0a' : '#fffaf0'}`; }
  function clanName(d) { return D[d].short || D[d].clan; }

  const UI = {
    pips, flagStyle, clanName, STAT,

    // ---------------------------------------------------------------- header
    renderHeader(st, me) {
      const d = D[me];
      $('.ch-banner').setAttribute('style', flagStyle(me));
      $('.ch-mon').textContent = d.mon;
      $('.ch-clan').textContent = clanName(me) + (d.short ? '' : '家');
      $('.ch-lord').textContent = d.name + '（' + P[me].name + '）';
      const pw = E().power(st, me);
      const rk = E().rankings(st).find(r => r.id === me);
      this.setStat('#st-prov', E().countOwned(st, me));
      this.setStat('#st-troops', pw.troops);
      document.querySelector('#st-cap').textContent = '/' + E().troopCap(st, me);
      const dm = st.dmy[me];
      const left = dm.dice.filter(x => !x.used);
      const planning = st.phase === 'orders' && left.length > 0;
      const planned = planning ? Math.min(E().RULES.sonaeMax, Math.max(...left.map(x => x.v))) : dm.sonae;
      const sb = document.querySelector('#st-sonae');
      sb.textContent = planned ? planned : '—';
      sb.parentElement.classList.toggle('on', planned > 0);
      sb.parentElement.title = (planning ? '備え（予定）：季節を終えたとき残っている一番大きい目（最大5）。' : '備え：') + '次の自分の番まで、力攻めされたときの守りのサイコロがこの目より小さくならない（使うたびに1減る。奇襲・調略には効かない）';
      this.setStat('#st-gold', st.dmy[me].gold);
      const inc = E().income(st, me);
      $('#st-income').textContent = '+' + inc;
      this.setStat('#st-rank', rk.rank + '位');
      this.renderPowerbar(st, me);
    },
    setStat(sel, v) {
      const el = $(sel); const s = String(v);
      if (el.textContent !== s) { el.textContent = s; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    },
    renderPowerbar(st, me) {
      const bar = $('#powerbar'); bar.innerHTML = '';
      const rk = E().rankings(st).filter(r => r.provinces > 0);
      rk.forEach(r => {
        const s = h('span', r.id === me ? 'me' : '');
        s.style.flexGrow = r.provinces; s.style.background = D[r.id].color;
        s.title = clanName(r.id) + ' ' + r.provinces + '国';
        bar.appendChild(s);
      });
    },

    // ---------------------------------------------------------------- season badge
    renderSeason(st) {
      const dl = E().dateLabel(st);
      $('.sb-era').textContent = dl.era + '（' + dl.year + '）';
      const icon = ['🌸', '🌿', '🍁', '❄'][dl.s];
      const note = (E().RULES.truceFirst && st.turn === 0) ? '合戦なし' : dl.s === 2 ? '収穫：収入2倍' : dl.s === 3 ? '雪国は出陣不可' : '';
      $('.sb-season').innerHTML = dl.season + `<small>${icon} ${note}</small>`;
      const left = E().RULES.turns - st.turn;
      $('.sb-turn').textContent = `第${st.turn + 1}季 ／ 全${E().RULES.turns}季　残り${left}季`;
      const tr = $('.sb-track'); tr.innerHTML = '';
      for (let t = 0; t < E().RULES.turns; t++) {
        const i = h('i', t < st.turn ? 'done' : t === st.turn ? 'now' : '');
        if (t > 0 && (E().RULES.startSeason + t) % 4 === 0) i.classList.add('yr');
        tr.appendChild(i);
      }
    },

    // ---------------------------------------------------------------- mini log
    renderMiniLog(st, me) {
      const box = $('#minilog'); box.innerHTML = '';
      const items = st.log.slice(-5);
      items.forEach(e => {
        const mine = e.d === me || e.defender === me || (e.type === 'fall' && e.d === me);
        const bad = (e.defender === me && e.type === 'conquest') || (e.type === 'fall' && e.d === me);
        const dl = E().dateLabel(st, e.t);
        const div = h('div', bad ? 'bad' : mine ? 'me' : '', `<span class="t">${dl.season}</span>${e.text}`);
        box.appendChild(div);
      });
    },

    // ---------------------------------------------------------------- tooltip
    tooltip(st, pid, x, y, me, extra) {
      const tt = $('#tooltip');
      if (pid < 0) { tt.classList.add('hidden'); return; }
      const p = st.provs[pid], o = p.owner;
      const home = o === pid;
      tt.innerHTML = `<div class="tt-name">${P[pid].name}${home ? '<span class="tag home">本城</span>' : ''}${P[pid].snow ? '<span class="tag snow">雪国</span>' : ''}</div>
        <div class="tt-owner"><span class="mini-flag" style="${flagStyle(o)}">${D[o].mon}</span>${D[o].name}${o === me ? '（自軍）' : ''}</div>
        <div class="tt-row"><span>兵</span><b>${p.troops}</b></div>${o !== me && st.dmy[o].sonae ? `<div class="tt-row"><span>備え</span><b style="color:#8fe3ff">${st.dmy[o].sonae}</b></div>` : ''}
        <div class="tt-row"><span>経済</span>${pips(p.econ)}</div>
        <div class="tt-row"><span>軍事</span>${pips(p.mil)}</div>
        <div class="tt-row"><span>守備</span>${pips(p.def)}</div>${extra ? `<div class="tt-hint">${extra}</div>` : ''}`;
      tt.classList.remove('hidden');
      const w = 200, hgt = tt.offsetHeight || 150;
      let tx = x + 18, ty = y + 14;
      if (tx + w > 1050) tx = x - w - 14;
      if (ty + hgt > 890) ty = y - hgt - 10;
      tt.style.left = tx + 'px'; tt.style.top = ty + 'px';
    },

    // ---------------------------------------------------------------- center message
    center(text, sub, long) {
      const c = $('#center-msg');
      c.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
      c.classList.remove('hidden', 'show', 'long'); void c.offsetWidth;
      c.classList.add('show'); if (long) c.classList.add('long');
    },

    // ---------------------------------------------------------------- rank table
    rankTable(st, me, limit) {
      const rk = E().rankings(st);
      let html = '<table class="rtable"><tr><th>順位</th><th style="text-align:left">大名</th><th>領国</th><th>経済</th><th>軍事</th><th>守備</th><th>総兵</th><th>状態</th></tr>';
      rk.slice(0, limit || 20).forEach(r => {
        const cls = (r.id === me ? 'me ' : '') + (r.alive ? '' : 'dead');
        const status = r.alive ? '' : (E().dateLabel(st, r.diedTurn).era + E().dateLabel(st, r.diedTurn).season + ' 滅亡');
        html += `<tr class="${cls}"><td>${r.rank}</td><td class="nm"><span class="mini-flag" style="${flagStyle(r.id)}">${D[r.id].mon}</span>${D[r.id].name}</td><td><b>${r.provinces}</b></td><td>${r.econ}</td><td>${r.mil}</td><td>${r.def}</td><td>${r.troops}</td><td style="font-size:12px">${status}</td></tr>`;
      });
      return html + '</table>';
    },

    // ---------------------------------------------------------------- result chart (province counts over time)
    chart(st, me) {
      const H = st.history, T = E().RULES.turns;
      const final = E().rankings(st);
      const ids = new Set(final.slice(0, 6).map(r => r.id)); ids.add(me);
      const W = 520, HH = 320, L = 34, B = 26, R = 10, TOP = 12;
      const maxP = Math.max(4, ...H.map(row => Math.max(...row)));
      const x = t => L + (W - L - R) * t / T, y = v => TOP + (HH - TOP - B) * (1 - v / maxP);
      let s = `<svg viewBox="0 0 ${W} ${HH}" xmlns="http://www.w3.org/2000/svg">`;
      for (let v = 0; v <= maxP; v += Math.max(1, Math.round(maxP / 5))) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(90,65,40,.18)"/><text x="${L - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#5a4128">${v}</text>`;
      for (let t = 0; t <= T; t += 4) { const dl = E().dateLabel(st, t); s += `<text x="${x(t)}" y="${HH - 8}" font-size="11" text-anchor="middle" fill="#5a4128">${dl.year}</text>`; }
      [...ids].sort((a, b) => (a === me) - (b === me)).forEach(id => {
        const pts = H.map((row, t) => `${x(t).toFixed(1)},${y(row[id]).toFixed(1)}`).join(' ');
        const c = D[id].color;
        s += `<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="${id === me ? 4.5 : 2.4}" stroke-linejoin="round" ${id === me ? '' : 'opacity=".85"'}/>`;
        const last = H[H.length - 1][id];
        s += `<text x="${x(H.length - 1) + 4}" y="${y(last) + 4}" font-size="12" font-weight="800" fill="${window.MapView.shade(c, -0.25)}">${D[id].mon}</text>`;
      });
      return s + '</svg>';
    },

    // ---------------------------------------------------------------- how to play
    howtoHTML() {
      const R = E().RULES;
      return [
        ['目的', '', `<b>永禄三年秋〜八年夏の${R.turns}季</b>で、最も多くの国を支配した大名の勝ち。途中で20国を統一すれば<b>天下統一</b>。自分の国がすべて奪われると敗北。`],
        ['采配ダイス', '', `季節ごとに<b>賽を振り</b>、サイコロを1つずつ国に割り当てて命令。<b>出目（表）は攻めの力、裏の目（7−出目）は内政の力</b>。6は攻めに強く内政に弱い、1は攻めに弱く内政に強い。サイコロは${R.diceBase}個から、<b>領国${R.diceSteps.join('・')}国</b>で1個ずつ増える（最大${R.diceMax}個）。`],
        ['攻', 'attack', `<b>力攻め</b>：出陣する兵＋出目 が、敵の兵＋城（守備力）＋敵のサイコロ を上回れば勝ち。勝てばその国はあなたのものに。5以上の差なら<b>圧勝</b>で国衆が加わる。`],
        ['奇', 'raid', `<b>奇襲（出目1・2）</b>：最大6兵（ゾロ目9兵）で、兵＋出目が<b>敵兵＋城</b>を上回れば<b>確実に奪取・損害なし</b>（敵のサイコロと備えは無視）。手薄な国を狙え。大名の<b>本城</b>（最初の国）には効かない。本城の城は守備×2＋4。`],
        ['謀', 'plot', `<b>調略（出目1〜${R.plotMax}・金${R.plotCost}）</b>：隣の敵国の兵を寝返らせて自軍に加える。裏の目の半分、ただし敵兵の3分の1まで（最大${R.plotCap}、ゾロ目${R.plotCap + 1}）。同じ国へは1季1回。大軍ほど狙われやすい。`],
        ['募', 'recruit', `<b>徴兵</b>：<b>裏の目</b>の数だけ兵を集める（軍事力で増減、兵1人につき金${R.recruitCostMul}、兵の上限まで）。徴兵した国はその季節は出陣できない（力攻めに負けた国も同じ）。`],
        ['興', 'develop', `<b>開発</b>：<b>裏の目</b>の分だけ経済・軍事・守備のどれかが育つ。経済→収入、軍事→兵の回復と徴兵、守備→城の守り。`],
        ['移', 'move', `<b>移動</b>：自領伝いに、どの自国へでも兵を送る（どの出目でも可）。`],
        ['備', '', `<b>備え</b>：季節を終えたとき残った<b>一番大きい目</b>（最大5）が備えになり、次の番まで力攻めされたときの守りのサイコロがその目より小さくならない（使うたびに1減る）。他の残りの賽は金1に。`],
        ['技', '', `<b>ゾロ目</b>は重ねて1つの命令に（1個重ねるごとに＋${R.zoromeBonus}、${R.stackMax}個まで）。季節ごとに<b>1回無料で1個振り直し</b>、<b>金2で出目±1</b>（2回まで）、<b>軍資金で賽を1個追加</b>（6個まで）。最初の季節は合戦なし。秋は収入2倍、冬は雪国（北陸・甲信・飛騨）から／への出陣ができない。兵の上限は国ごとに${R.capBase}＋軍事力。`],
      ].map(([t, ic, body]) => `<div class="hw"><h4>${ic ? `<span class="ico ${ic}">${t}</span>` : ''}${ic ? ({ attack: '力攻め', raid: '奇襲', plot: '調略', recruit: '徴兵', develop: '開発', move: '移動' })[ic] : t}</h4><p>${body}</p></div>`).join('');
    },
  };
  window.UI = UI;
})();
