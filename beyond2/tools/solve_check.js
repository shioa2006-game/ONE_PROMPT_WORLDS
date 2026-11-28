// GUILDWARD — 依頼ごと・編成ごとに「解き方の一例」をルールだけで通す（node tools/solve_check.js [依頼] [方針]）
// 探索は tools/routes.js の手順、戦いはボット（tools/bot.js）が戦う。
'use strict';
const path = require('path');
const S = require(path.join(__dirname, '..', 'js', 'sim.js'));
require(path.join(__dirname, '..', 'js', 'data.js'));
const D = globalThis.D21;
const BOT = require(path.join(__dirname, 'bot.js'));
const ROUTES = require(path.join(__dirname, 'routes.js'));
const PARTY = { GS: ['riko', 'gard', 'sena'], GT: ['riko', 'gard', 'tobi'], ST: ['riko', 'sena', 'tobi'] };

const only = process.argv[2];
const policy = process.argv[3] || 'greedy';
const verbose = process.argv.includes('-v');
let allOk = true;
// 依頼ごとの持ち物（その依頼を受けるころに必ず持っている物だけ）
const UP = { m1: {}, m2: {}, m3: { rope2: true }, m4: { rope2: true }, m5: { rope2: true }, m6: { rope2: true } };
const HPB = { m1: 0, m2: 0, m3: 1, m4: 1, m5: 1, m6: 2 };
const extra = process.argv.find(a => a.startsWith('--up='));
for (const id of Object.keys(ROUTES)) {
  if (only && only !== id) continue;
  const def = D.MAPS[id];
  for (const pk of Object.keys(ROUTES[id])) {
    const up = Object.assign({}, UP[id]);
    if (extra) for (const k of extra.slice(5).split(',')) up[k] = true;
    const st = S.create(def, { party: PARTY[pk], up, hpb: HPB[id] });
    if (def.startFight) S.startCombat(st, def.startFight, []);
    const log = [];
    let ok = true;
    const fightNow = () => {
      if (st.mode !== 'combat') return true;
      const r = BOT.fight(st, policy, 40, verbose);
      log.push('戦い:' + r.result + ' 手番' + r.turns + ' 受けた' + r.taken + ' 倒れた' + r.downs + (r.sacks !== null ? ' 米俵' + r.sacks : '') + ' [' + r.hp + ']');
      return r.result === 'win';
    };
    for (const step of ROUTES[id][pk]) {
      if (!fightNow()) { ok = false; break; }
      const [hero, intent, skipIf] = step;
      if (skipIf && st.flags[skipIf]) { log.push('（' + skipIf + ' は済んでいる）'); continue; }
      const p = S.plan(st, hero, intent);
      if (!p.ok) { log.push('NG ' + hero + ' ' + JSON.stringify(intent) + ' → ' + p.why); ok = false; break; }
      const evs = S.apply(st, p);
      const flat = []; const w = (l) => { for (const e of l) { if (e.k === 'group') w(e.evs); else flat.push(e); } }; w(evs);
      const b = flat.find(e => e.k === 'bloom');
      const cap = flat.find(e => e.k === 'caption');
      const extraEv = flat.filter(e => ['safe', 'rune', 'runesDone', 'cleared', 'collect', 'found', 'combat', 'flip', 'shatter'].includes(e.k)).map(e => e.k + (e.id ? ':' + e.id : '') + (e.item ? ':' + e.item : '') + (e.coins ? ':' + e.coins : ''));
      log.push(hero + ':' + intent.k + (cap ? ' 「' + cap.text + '」' : '') + (b ? ' 道+' + b.cells.length : '') + (extraEv.length ? ' ' + extraEv.join(' ') : ''));
    }
    if (ok && !fightNow()) ok = false;
    const o = S.objective(st);
    if (!st.flags.cleared) ok = false;
    console.log((ok ? 'OK ' : 'NG ') + id + ' ' + def.name + ' ' + pk + (st.coins ? ' 銀貨' + st.coins : '') + '\n   ' + log.join('\n   ') + '\n   目的: ' + JSON.stringify(o));
    if (!ok) allOk = false;
  }
}
console.log(allOk ? 'すべて通せた' : '通せないものがある');
process.exit(allOk ? 0 : 1);
