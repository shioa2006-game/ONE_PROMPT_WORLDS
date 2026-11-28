// GUILDWARD — 受けなおしの編成で、探索の「道」がひらけるかを調べる（node tools/replay_pairs.js [依頼] [編成...] [--up=hook,fan]）
// 戦いは考えず（敵を眠らせたまま消して）、仲間の働きかけを幅優先で数手ためし、目的の升・物に届くかを見る。
// v0.3：v0.2 の持ち越し（m2 をガルドとトビで受けなおすと堀を渡れない）を、引き鉤・ナギで確かめるために作った。
'use strict';
const path = require('path');
const S = require(path.join(__dirname, '..', 'js', 'sim.js'));
require(path.join(__dirname, '..', 'js', 'data.js'));
const D = globalThis.D21;

const args = process.argv.slice(2);
const id = args[0] || 'm2';
const upArg = (args.find(a => a.startsWith('--up=')) || '--up=').slice(5).split(',').filter(Boolean);
const depthArg = +((args.find(a => a.startsWith('--depth=')) || '--depth=4').slice(8));
const pairs = args.slice(1).filter(a => !a.startsWith('--'));
// 目的の升（そこへ歩いて行ければ、道がひらけた）
const GOAL = { m2: [6, 7], m1: [3, 4], m3: [7, 7], m4: [7, 9] };
const goalArg = (args.find(a => a.startsWith('--goal=')) || '').slice(7);
const goal = goalArg ? goalArg.split(',').map(Number) : GOAL[id];
const key = (st) => JSON.stringify([st.units.map(u => [u.x, u.y, u.z]), st.objs.map(o => [o.x, o.y, o.z, !!o.gone, !!o.down]), st.t.join(''), st.links.length]);

function search(party, up) {
  const st0 = S.create(D.MAPS[id], { party: ['riko'].concat(party), up: Object.assign({ rope2: true }, up) });
  for (const e of S.enemies(st0)) { e.ko = true; e.gone = true; }
  const reachGoal = (st) => S.partyReach(st).has(S.idx(st, goal[0], goal[1]));
  if (reachGoal(st0)) return { ok: true, steps: [] };
  let frontier = [{ st: st0, steps: [] }];
  const seen = new Set([key(st0)]);
  for (let d = 0; d < depthArg; d++) {
    const next = [];
    for (const node of frontier) {
      for (const h of S.heroes(node.st)) {
        for (const p of S.options(node.st, h.id)) {
          const c = S.clone(node.st);
          try { S.apply(c, p); } catch (e) { continue; }
          const k = key(c);
          if (seen.has(k)) continue;
          seen.add(k);
          const steps = node.steps.concat([h.id + ':' + p.intent.k + JSON.stringify(p.intent.ref || p.intent.o || [p.intent.x, p.intent.y]) + (p.intent.dir !== undefined ? ' dir' + p.intent.dir : '')]);
          if (reachGoal(c)) return { ok: true, steps };
          next.push({ st: c, steps });
        }
      }
    }
    frontier = next;
    if (frontier.length > 4000) frontier = frontier.slice(0, 4000);
  }
  return { ok: false, tried: seen.size };
}

const list = pairs.length ? pairs.map(p => p.split('+')) : [['gard', 'tobi'], ['gard', 'nagi'], ['tobi', 'nagi'], ['gard', 'sena'], ['sena', 'tobi'], ['sena', 'nagi']];
const ups = { hook: upArg.includes('hook'), fan: upArg.includes('fan'), staff: upArg.includes('staff'), bigbomb: upArg.includes('bigbomb'), gauntlet: upArg.includes('gauntlet'), bow: true };
for (const party of list) {
  const r = search(party, ups);
  console.log((r.ok ? 'OK ' : 'NG ') + id + ' ' + party.join('+') + ' up=' + upArg.join(',') + (r.ok ? '  ' + r.steps.join(' → ') : '  （' + depthArg + '手まで ' + r.tried + ' 通り）'));
}
