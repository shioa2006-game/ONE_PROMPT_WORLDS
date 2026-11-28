// GUILDWARD — 同じ依頼を編成ごとに攻略し（第二章は六組。v0.3）、使った手（働きかけ・倒し方・装置）を比べる（node tools/compare.js [依頼] [方針] [--up=gauntlet,...]）
// 探索は routes.js の手順、戦いはボット。数えるのは「だれが・何をして・何が起きたか」
'use strict';
const path = require('path');
const S = require(path.join(__dirname, '..', 'js', 'sim.js'));
require(path.join(__dirname, '..', 'js', 'data.js'));
const D = globalThis.D21;
const BOT = require(path.join(__dirname, 'bot.js'));
const ROUTES = require(path.join(__dirname, 'routes.js'));
const PARTY = { GS: ['riko', 'gard', 'sena'], GT: ['riko', 'gard', 'tobi'], ST: ['riko', 'sena', 'tobi'], GN: ['riko', 'gard', 'nagi'], SN: ['riko', 'sena', 'nagi'], TN: ['riko', 'tobi', 'nagi'] };
const only = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : null;
const policy = process.argv[3] && !process.argv[3].startsWith('-') ? process.argv[3] : 'greedy';
const extra = process.argv.find(a => a.startsWith('--up='));
const HPB = { m4: 1, m5: 1, m6: 2, m7: 3, m8: 3 };

function flat(evs) { const o = []; const w = (l) => { for (const e of l) { if (e.k === 'group') w(e.evs); else o.push(e); } }; w(evs); return o; }
function tally(rec, st, hero, intent, evs) {
  const f = flat(evs);
  if (intent && intent.k !== 'move') rec.acts[hero + ':' + intent.k] = (rec.acts[hero + ':' + intent.k] || 0) + 1;
  for (const e of f) {
    if (e.k === 'ko' && st.units.find(u => u.id === e.id && u.team === 'e')) rec.kos[e.how] = (rec.kos[e.how] || 0) + 1;
    if (e.k === 'flip') rec.flips.push(hero + ':' + (intent ? intent.k : '?'));
    if (e.k === 'rune') rec.runes.push(e.id + '(' + hero + ':' + intent.k + ')');
    if (e.k === 'steal') rec.steals++;
    if (e.k === 'caption' && e.combo) rec.combos.push(e.who.join('+'));
    if (e.k === 'dmg' && st.units.find(u => u.id === e.id && u.team === 'h')) rec.taken += e.n;
  }
}
for (const id of ['m4', 'm5', 'm6', 'm7', 'm8']) {
  if (only && only !== id) continue;
  console.log('==== ' + id + ' ' + D.MAPS[id].name + '（' + policy + (extra ? ' ' + extra : '') + '）');
  // m8 はナギがゲスト（選ぶ二人はガルド・セナ・トビから）。ほかは、ナギ入りの組もためす
  const pks = id === 'm8' ? ['GS', 'GT', 'ST'] : ['GS', 'GT', 'ST', 'GN', 'SN', 'TN'];
  for (const pk of pks) {
    const up = { rope2: true };
    if (pk.includes('N') || id === 'm7' || id === 'm8') Object.assign(up, { hook: id !== 'm7', bow: true });
    if (extra) for (const k of extra.slice(5).split(',')) up[k] = true;
    const st = S.create(D.MAPS[id], { party: PARTY[pk], up, hpb: HPB[id] });
    if (D.MAPS[id].startFight) S.startCombat(st, D.MAPS[id].startFight, []);
    const rec = { acts: {}, kos: {}, flips: [], runes: [], steals: 0, combos: [], taken: 0, turns: 0 };
    const fight = () => {
      let n = 0;
      while (st.mode === 'combat' && !st.lost && n++ < 40) {
        for (const pl of BOT.planPhase(st, policy)) {
          if (st.mode !== 'combat') break;
          const p = S.plan(st, pl.hero, pl.intent);
          if (!p.ok) continue;
          tally(rec, st, pl.hero, pl.intent, S.apply(st, p));
        }
        if (st.mode !== 'combat' || st.lost) break;
        tally(rec, st, null, null, S.endPlayerPhase(st));
        rec.turns++;
      }
    };
    fight();
    const rt = ROUTES[id][pk];
    if (!rt) { console.log(pk + '　（手順なし）'); continue; }
    for (const step of rt) {
      fight();
      const sk = step[2];
      if (sk && (sk.startsWith('ice:') ? st.t[S.idx(st, +sk.slice(4).split(',')[0], +sk.slice(4).split(',')[1])] === 'i' : sk.startsWith('gone:') ? !S.objById(st, sk.slice(5)) || S.objById(st, sk.slice(5)).gone : sk.startsWith('down:') ? !!(S.objById(st, sk.slice(5)) || {}).down : sk.startsWith('yle:') ? S.unitById(st, sk.split(':')[1]).y <= +sk.split(':')[2] : st.flags[sk])) continue;
      const p = S.plan(st, step[0], step[1]);
      if (!p.ok) { console.log('  NG', step); break; }
      tally(rec, st, step[0], step[1], S.apply(st, p));
    }
    fight();
    const fmt = (o) => Object.entries(o).map(([k, v]) => k + '×' + v).join(' ');
    console.log(pk + (st.flags.cleared ? ' 達成' : st.lost ? ' 敗北' : ' 未達') + '　手番' + rec.turns + '　受けた傷' + rec.taken + (st.raid ? '　米俵' + st.raid.sacks : ''));
    console.log('   行動: ' + fmt(rec.acts));
    console.log('   敵の倒れ方: ' + fmt(rec.kos) + (rec.steals ? '　盗まれた' + rec.steals : ''));
    if (rec.flips.length) console.log('   ひっくり返した手: ' + rec.flips.join(' '));
    if (rec.runes.length) console.log('   門の灯: ' + rec.runes.join(' '));
    if (rec.combos.length) console.log('   連携: ' + rec.combos.join(' '));
  }
}
