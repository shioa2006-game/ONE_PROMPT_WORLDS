// GUILDWARD — 依頼ごと・編成ごとに「解き方の一例」をルールだけで通す（node tools/solve_check.js [依頼] [方針]）
// 探索は tools/routes.js の手順、戦いはボット（tools/bot.js）が戦う。
'use strict';
const path = require('path');
const S = require(path.join(__dirname, '..', 'js', 'sim.js'));
require(path.join(__dirname, '..', 'js', 'data.js'));
const D = globalThis.D21;
const BOT = require(path.join(__dirname, 'bot.js'));
const ROUTES = require(path.join(__dirname, 'routes.js'));
const PR = require(path.join(__dirname, 'plan_route.js'));   // m6 はボットが段取りを組めないので、想定攻略手順で戦う（v0.2）
const PARTY = { GS: ['riko', 'gard', 'sena'], GT: ['riko', 'gard', 'tobi'], ST: ['riko', 'sena', 'tobi'], GN: ['riko', 'gard', 'nagi'], SN: ['riko', 'sena', 'nagi'], TN: ['riko', 'tobi', 'nagi'] };

const only = process.argv[2];
const policy = process.argv[3] || 'greedy';
const verbose = process.argv.includes('-v');
let allOk = true;
// 依頼ごとの持ち物（その依頼を受けるころに必ず持っている物だけ）
const UP = { m1: {}, m2: {}, m3: { rope2: true }, m4: { rope2: true }, m5: { rope2: true }, m6: { rope2: true }, m7: { rope2: true }, m8: { rope2: true, hook: true } };
const HPB = { m1: 0, m2: 0, m3: 1, m4: 1, m5: 1, m6: 2, m7: 3, m8: 3 };
const extra = process.argv.find(a => a.startsWith('--up='));
// 手順をとばす条件：フラグの名前か、'ice:x,y'（その升がもう凍っている）
const skipped = (st, c) => c.startsWith('yle:') ? (() => { const [, id, y] = c.split(':'); const u = S.unitById(st, id); return !!u && u.y <= +y; })() : c.startsWith('down:') ? !!(S.objById(st, c.slice(5)) || {}).down : c.startsWith('gone:') ? (() => { const o = S.objById(st, c.slice(5)); return !o || o.gone; })() : c.startsWith('ice:') ? (() => { const [x, y] = c.slice(4).split(',').map(Number); return st.t[S.idx(st, x, y)] === 'i'; })() : !!st.flags[c];
for (const id of Object.keys(ROUTES)) {
  if (only && only !== id) continue;
  const def = D.MAPS[id];
  for (const pk of Object.keys(ROUTES[id])) {
    const up = Object.assign({}, UP[id]);
    if (extra) for (const k of extra.slice(5).split(',')) up[k] = true;
    // ナギ入りの編成は、第二章のあとの受けなおし（長い鉤縄・引き鉤・長弓を持っている。m2 のトビ＋ナギは大うちわも）
    if (pk.includes('N') && !['m7', 'm8'].includes(id)) Object.assign(up, { rope2: true, hook: true, bow: true }, ['m2', 'm3'].includes(id) ? { fan: true } : {});
    const party = PARTY[pk.split(':')[0]];   // 'GS:alt' のような別の手も、頭の二文字で編成を決める
    const st = S.create(def, { party, up, hpb: HPB[id] });
    if (def.startFight) S.startCombat(st, def.startFight, []);
    const log = [];
    let ok = true;
    const fightNow = () => {
      if (st.mode !== 'combat') return true;
      if (id === 'm6' && !process.argv.includes('--bot') && ['GS', 'GT', 'ST', 'GN'].includes(pk)) {
        // 参考：ボットだけで戦った結果（ボットは段取りを組めない。手番数を難しさとみなさない）
        const ref = BOT.fight(S.clone(st), policy, 40, false);
        log.push('（参考：ボットだけ）' + ref.result + ' 手番' + ref.turns + ' 受けた' + ref.taken + ' 倒れた' + ref.downs);
        const r = PR.fight(st, pk, verbose);
        log.push('戦い（想定攻略手順）:' + (r.win ? 'win' : r.lost ? 'lose' : 'timeout') + ' 大亀を倒した手番' + r.bossTurn + ' 受けた' + r.taken + ' 倒れた' + r.downs + ' ひっくり返し' + r.flips.length + ' [' + S.heroes(st).map(h => h.id + ':' + h.hp).join(' ') + ']');
        return r.win && r.ok;
      }
      if (id === 'm5' && ['GS', 'GT', 'ST'].includes(pk)) {
        // 大岩の想定手順（右を止め、橋の出口をふさいで並ばせ、まとめて転がす）も、同じ地図の写しで試す
        const r5 = PR.fight(S.clone(st), pk, false);
        log.push('（大岩の想定手順）' + (r5.win ? 'win' : 'NG') + ' 大岩ひとつで最多' + r5.bestRoll + '体 米俵' + r5.sacks + ' 手番' + r5.turns + ' 受けた' + r5.taken);
        if (!(r5.win && r5.bestRoll >= 3)) ok = false;
      }
      const r = BOT.fight(st, policy, 40, verbose);
      log.push('戦い:' + r.result + ' 手番' + r.turns + ' 受けた' + r.taken + ' 倒れた' + r.downs + (r.sacks !== null ? ' 米俵' + r.sacks : '') + ' [' + r.hp + ']');
      return r.result === 'win';
    };
    for (const step of ROUTES[id][pk]) {
      if (!fightNow()) { ok = false; break; }
      const [hero, intent, skipIf] = step;
      if (skipIf && skipped(st, skipIf)) { log.push('（' + skipIf + ' は済んでいる）'); continue; }
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
    // この通しで満たした腕だめしの印（初回として判定。③は初回ではつかない）
    const got = (D.STAMPS[id] || []).filter(s => { try { return s.test(st, { first: true, pair: party.slice(1).sort().join('+'), firstPair: null }); } catch (e) { return false; } }).map(s => s.id + '「' + s.name + '」');
    console.log((ok ? 'OK ' : 'NG ') + id + ' ' + def.name + ' ' + pk + (st.coins ? ' 銀貨' + st.coins : '') + '\n   ' + log.join('\n   ') + '\n   目的: ' + JSON.stringify(o) + '\n   印: ' + (got.join(' ') || 'なし'));
    if (!ok) allOk = false;
  }
}
console.log(allOk ? 'すべて通せた' : '通せないものがある');
process.exit(allOk ? 0 : 1);
