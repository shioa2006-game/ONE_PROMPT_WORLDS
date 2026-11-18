/* 各大名をCPUの思考で動かしたときの最大版図の分布（node tools/peaks.js [games] [--set=K=V ...]） */
'use strict';
const E = require('../js/engine.js');
const AI = require('../js/ai.js');
const args = process.argv.slice(2);
for (const a of args.filter(x => x.startsWith('--set='))) { const [k, v] = a.slice(6).split('='); E.R[k] = Number(v); }
const G = Number(args.find(a => /^\d+$/.test(a))) || 12;
let tot = { win: 0, lose: 0, top: 0, time: 0 };
for (const c of E.DATA.CLANS) {
  const peaks = [], fin = []; const k = { win: 0, top: 0, lose: 0, time: 0, fall: 0 };
  for (let g = 0; g < G; g++) {
    const s = E.newGame(c.id, 9000 + g * 131);
    while (!s.over) { E.beginClanTurn(s); AI.playTurn(s); if (s.over) break; E.advance(s); }
    peaks.push(s.clans[c.id].peak); fin.push(E.provCount(s, c.id));
    k[s.over.kind]++; tot[s.over.kind]++; if (s.over.reason === 'fall') k.fall++;
  }
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(c.id.padEnd(9), 'peak med', String(med(peaks)).padStart(2), 'max', String(Math.max(...peaks)).padStart(2), '| final med', String(med(fin)).padStart(2), '| win', k.win, 'top', k.top, 'fell', k.fall);
}
console.log(tot);
