// せーの、星見の露台へ — 区画ごとの「解き方の一例」を、ルールだけで通して確かめる（node tools/solve_check.js）
// 戦いは、決まった手順ではなく、簡単な方針のボット（tools/bot.js の greedy）で戦う
'use strict';
const path = require('path');
const S = require(path.join(__dirname, '..', 'js', 'sim.js'));
require(path.join(__dirname, '..', 'js', 'data.js'));
const D = globalThis.D19;
const BOT = require(path.join(__dirname, 'bot.js'));
const ROUTES = require(path.join(__dirname, 'routes.js'));

let carry = {};
let allOk = true;
const only = process.argv[2];
for (const def of D.SECTIONS) {
  const st = S.create(def, carry);
  if (def.startFight) S.startCombat(st, def.startFight, []);
  const route = ROUTES[def.id];
  if (!route) { console.log(def.id, '手順なし'); continue; }
  const log = [];
  let ok = true;
  for (const step of route) {
    if (st.mode === 'combat') { const r = BOT.fight(st, 'greedy', 40); log.push('戦い:' + r.result + ' 手番' + r.turns); if (r.result !== 'win') { ok = false; break; } }
    const [hero, intent] = step;
    const p = S.plan(st, hero, intent);
    if (!p.ok) { log.push('NG ' + hero + ' ' + JSON.stringify(intent) + ' → ' + p.why); ok = false; break; }
    const evs = S.apply(st, p);
    const flat = []; const w = (l) => { for (const e of l) { if (e.k === 'group') w(e.evs); else flat.push(e); } }; w(evs);
    const b = flat.find(e => e.k === 'bloom');
    const cap = flat.find(e => e.k === 'caption');
    log.push(hero + ':' + intent.k + (cap ? ' 「' + cap.text + '」' : '') + (b ? ' 道+' + b.cells.length : ''));
    if (st.mode === 'combat') { const r = BOT.fight(st, 'greedy', 40); log.push('戦い:' + r.result + ' 手番' + r.turns); if (r.result !== 'win') { ok = false; break; } }
    if (flat.some(e => e.k === 'exit')) { log.push('→ 出口'); break; }
  }
  const exited = !!st.flags.exited || !!st.flags.lit;
  if (!exited) ok = false;
  if (!only || only === def.id) console.log((ok ? 'OK ' : 'NG ') + def.id + ' ' + def.name + '\n   ' + log.join('\n   '));
  if (!ok) allOk = false;
  carry = { up: st.up, items: st.items, stats: st.stats, moments: st.moments };
}
console.log(allOk ? 'すべての区画を通せた' : '通せない区画がある');
process.exit(allOk ? 0 : 1);
