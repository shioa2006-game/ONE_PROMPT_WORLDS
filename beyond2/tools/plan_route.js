// GUILDWARD — 依頼5・依頼6を、想定攻略手順（tools/plans_lib.js）どおりにルールだけで通す（ネタバレ）
// 使い方: node tools/plan_route.js [m5|m6] [GS|GT|ST] [-v] [--hp=22] [--up=gauntlet,...]
// 毎手番、手を打つ前に、敵の次の動き（画面の赤い線と同じ S.intents）を確かめながら進める。手順が終わったら、残りはボットが戦う。
'use strict';
const path = require('path');
const S = require(path.join(__dirname, '..', 'js', 'sim.js'));
require(path.join(__dirname, '..', 'js', 'data.js'));
const D = globalThis.D21;
const PL = require('./plans_lib.js');

const PARTY = { GS: ['riko', 'gard', 'sena'], GT: ['riko', 'gard', 'tobi'], ST: ['riko', 'sena', 'tobi'], GN: ['riko', 'gard', 'nagi'] };
const HPB = { m5: 1, m6: 2 };
const flat = (evs) => { const o = []; const w = (l) => { for (const e of l) { if (e.k === 'group') w(e.evs); else o.push(e); } }; w(evs); return o; };

function fight(st, pk, verbose, log) {
  log = log || [];
  let taken = 0, bossAtk = 0, downs = 0, ok = true;
  const flips = [];
  const boss = st.units.find(u => u.boss);
  for (let guard = 0; guard < 30 && st.mode === 'combat' && !st.lost; guard++) {
    const pre = boss ? S.intents(st).find(r => r.id === boss.id) : null;
    const lines = ['T' + st.turn + (boss ? '  大亀' + boss.hp + (boss.flipped ? '(すき' + boss.flipped + ')' : '') + '  赤い線: 大亀→' + (pre ? (pre.to || '') + (pre.target ? ' ' + pre.target + '-' + pre.dmg : '') + (pre.rest ? ' 休む' : '') + (pre.rise ? ' 起きあがる' : '') : '-') : '  米俵 ' + (st.raid ? st.raid.sacks : '-'))];
    for (const a of PL.turnActions(st, pk)) {
      if (st.mode !== 'combat') break;
      if (a.expect !== undefined) {
        const it = boss ? S.intents(st).find(r => r.id === boss.id) : null;
        const got = it && it.to ? it.to.join(',') : '';
        if (got !== a.expect) { lines.push('  NG 赤い線: 大亀は ' + a.expect + ' へ来るはず → ' + got); ok = false; } else lines.push('  ✓ 赤い線: 大亀は ' + got + ' で止まる');
        continue;
      }
      if (a.skip) { lines.push('  ' + a.hero + ' 相手なし（とばす）'); continue; }
      if (a.fail) { lines.push('  NG ' + a.hero + ' ' + JSON.stringify(a.intent) + ' → ' + a.fail); if (!a.soft) ok = false; continue; }
      const p = S.plan(st, a.hero, a.intent);
      if (!p.ok) { lines.push('  NG ' + a.hero + ' ' + JSON.stringify(a.intent) + ' → ' + p.why); ok = false; continue; }
      const evs = flat(S.apply(st, p));
      const cap = evs.find(e => e.k === 'caption');
      for (const e of evs) if (e.k === 'flip') flips.push('T' + st.turn + ':' + a.hero);
      lines.push('  ' + a.hero + (a.bot ? '（ボット）' : '') + ' ' + a.intent.k + (cap ? '「' + cap.text + '」' : ''));
    }
    if (st.mode !== 'combat' || st.lost) { log.push(lines.join('\n')); break; }
    const evs = flat(S.endPlayerPhase(st));
    for (const e of evs) {
      const u = S.unitById(st, e.id);
      if (e.k === 'dmg' && u && u.team === 'h') taken += e.n;
      if (e.k === 'eatk' && boss && e.id === boss.id) bossAtk++;
      if (e.k === 'ko' && u && u.team === 'h') downs++;
    }
    lines.push('  （敵の手番）' + S.heroes(st).map(h => h.id + ':' + h.hp + '@' + h.x + ',' + h.y).join(' ') + '　敵 ' + S.liveEnemies(st).filter(e => e.active).map(e => e.k + e.hp + '@' + e.x + ',' + e.y + ',' + e.z).join(' '));
    log.push(lines.join('\n'));
  }
  if (verbose) console.log(log.join('\n'));
  const win = st.mode !== 'combat' && !st.lost;
  return { cleared: !!st.flags.cleared, bossKo: boss ? !!boss.ko : null, bossTurn: st.stats.bossTurn, taken, bossAtk, flips, downs, bestRoll: st.stats.bestRoll || 0, sacks: st.raid ? st.raid.sacks : null, turns: st.stats.turns + 1,
    ok: ok && win && (!boss || boss.ko), lost: !!st.lost, win };
}
module.exports = { fight, PARTY, HPB };

if (require.main === module) {
  const args = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const mission = ['m5', 'm6'].includes(args[0]) ? args.shift() : null;
  const only = args[0] || null;
  const verbose = process.argv.includes('-v');
  const hpArg = process.argv.find(a => a.startsWith('--hp='));
  const upArg = process.argv.find(a => a.startsWith('--up='));
  if (hpArg) S.ENEMY.turtle.hp = +hpArg.slice(5);
  let all = true;
  for (const id of ['m5', 'm6']) {
    if (mission && mission !== id) continue;
    for (const pk of Object.keys(PL.PLANS[id])) {
      if (only && only !== pk) continue;
      const up = { rope2: true };
      if (upArg) for (const k of upArg.slice(5).split(',')) up[k] = true;
      const st = S.create(D.MAPS[id], { party: PARTY[pk], up, hpb: HPB[id] });
      S.startCombat(st, D.MAPS[id].startFight, []);
      const r = fight(st, pk, verbose);
      const good = r.ok && (id !== 'm5' || r.bestRoll >= 3);
      if (!good) all = false;
      if (id === 'm6') console.log((good ? 'OK ' : 'NG ') + 'm6 ' + pk + '　大亀を倒した手番 ' + (r.bossTurn || '-') + '　受けた傷 ' + r.taken + '　大亀の攻撃 ' + r.bossAtk + '回　ひっくり返し ' + r.flips.length + '回（' + r.flips.join(' ') + '）　倒れた ' + r.downs + (r.cleared ? '　達成' : ''));
      else console.log((good ? 'OK ' : 'NG ') + 'm5 ' + pk + '　大岩ひとつで倒した最多 ' + r.bestRoll + '体　米俵 ' + r.sacks + '　手番 ' + r.turns + '　受けた傷 ' + r.taken + '　倒れた ' + r.downs + (r.cleared ? '　達成' : ''));
    }
  }
  console.log(all ? '手順どおりに通せた' : '通せないものがある');
  process.exit(all ? 0 : 1);
}
