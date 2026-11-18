/* 1局の行動の内訳（主要大名ごと） node tools/diag.js [seed] [turns] */
'use strict';
const E = require('../js/engine.js');
const AI = require('../js/ai.js');
const seed = Number(process.argv[2]) || 1000, T = Number(process.argv[3]) || 40;
const s = E.newGame(null, seed, { maxTurn: T }); s.autoEnd = true;
const st = {};
const g = c => (st[c] = st[c] || { turns: 0, dice: 0, used: 0, move: 0, atk: 0, win: 0, cap: 0, lostCap: 0, recruit: 0, develop: 0, fortify: 0 });
let guard = 0;
while (!s.over && guard++ < 20000) {
  E.beginClanTurn(s);
  const c = s.cur;
  const ev = AI.playTurn(s);
  const x = g(c); x.turns++;
  for (const e of ev) {
    if (e.type === 'roll') x.dice += e.dice.length;
    if (e.type === 'dice') x.used += e.used.length;
    if (e.type === 'move') x.move++;
    if (e.type === 'battle') { if (e.att.c === c) { x.atk++; if (e.win) x.win++; } }
    if (e.type === 'capture') { g(e.to).cap++; if (e.from) g(e.from).lostCap++; }
    if (e.type === 'govern') x[e.kind]++;
  }
  if (s.over) break;
  E.advance(s);
}
const kk = E.kokAll(s);
console.log('clan       turns dice used move atk win cap lost rec dev fort kok');
for (const c of E.DATA.CLANS) {
  const x = st[c.id]; if (!x) continue;
  if (!c.major && !process.argv.includes('-a')) continue;
  console.log(c.id.padEnd(10), [x.turns, x.dice, x.used, x.move, x.atk, x.win, x.cap, x.lostCap, x.recruit, x.develop, x.fortify, kk[c.id]].map(v => String(v).padStart(4)).join(' '));
}
