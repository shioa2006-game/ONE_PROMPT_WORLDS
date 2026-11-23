// がらり、迷宮ひらき — ルールだけで全編を回すボット（バランス確認用）
// 使い方: node tools/bot.js [回数=8] [戦い方=smart|one|none] [組み方=smart|random] [--v]
//   ボットが知っていること：盤面・魔物・壁・魔物の動き（画面に出ている情報）。次の回転の出目は知らない
//   smart: 魔力の範囲でずらし方を全部ためして最善（画面の「ヒント」と同じ）
//   one:   魔力を1までしか使わない   none: ずらさない
//   組み方 smart: 新しい紋は、その紋がいちばん少ないリールの空きへ。鍛え石は多く刻んだ紋へ
//          random: 置き場所も鍛える紋もでたらめ
const path = require('path');
const G = require(path.join(__dirname, '..', 'js', 'sim.js'));
const D = require(path.join(__dirname, '..', 'js', 'data.js'));
G.setData(D);

const N = +(process.argv[2] || 8);
const POL = process.argv[3] || 'smart';
const EDIT = process.argv[4] || 'smart';
const VERB = process.argv.includes('--v');

const ROUTE = ['s1_hall', 's1_bats', 's1_forge', 's1_thorn', 's1_cache', 's1_root', 's1_spring',
  's2_shore', 's2_cave', 's2_fall', 's2_shrine', 's2_ferry', 's2_isle', 's2_lift', 's2_vault',
  's3_in', 's3_hall', 's3_read', 's3_star', 's3_seal', 's3_tomb', 's3_deep', 's4_gate', 's4_blank'];

function chooseOffs(s) {
  if (POL === 'none') return s.reels.map(() => 0);
  const best = G.bestShift(s, POL === 'one' ? { mp: Math.min(1 + ((s.b && s.b.mpBonus) || 0), G.mpOf(s)) } : null);
  return best ? best.offs : s.reels.map(() => 0);
}

function fight(s, room, kind, rec) {
  const R = G.room(room);
  G.startBattle(s, R.battle, kind, room);
  const b = s.b;
  let turns = 0, best = 0, kills = 0, minHp = b.hp, walls = [];
  for (let g = 0; g < (kind === 'quiet' ? 12 : 60); g++) {
    G.spin(s);
    b.offs = chooseOffs(s);
    b.mp = s.mpMax - G.offTotal(b);
    const res = G.cast(s);
    turns++;
    best = Math.max(best, res.best); kills += res.kills; walls = walls.concat(res.walls);
    if (res.end === 'win') {
      G.winBattle(s);
      if (s.b.pick) { G.takePick(s, G.choosePick(s, s.b.pick, EDIT)); G.autoEdit(s, EDIT); }
      s.at = room; s.b = null;
      return { win: true, turns, best, kills, minHp, walls };
    }
    if (kind === 'quiet') {
      G.nextTurn(s);
      if (!G.roomWalls(s, room).length) break;
      continue;
    }
    G.enemyPhase(s);
    minHp = Math.min(minHp, b.hp);
    if (b.phase === 'lose') { s.b = null; return { win: false, turns, best, kills, minHp: 0, walls }; }
  }
  s.b = null;
  return { win: kind === 'quiet', turns, best, kills, minHp, walls, timeout: kind !== 'quiet' };
}

function canTryWall(s, w) {
  const els = new Set(s.reels[0].strip.map(c => c.k));
  if (els.has('star')) return true;
  const need = G.WALL[w.kind].need;
  if (need === 'any') return true;
  return els.has(need);
}

function run(seed) {
  const s = G.newGame(seed);
  const log = {};
  let losses = 0, guard = 0, ended = false;
  const battleOrder = [];
  while (!ended && guard++ < 200) {
    let progressed = false;
    for (const rid of ROUTE) {
      if (G.visited(s, rid) && G.roomDone(s, rid)) continue;
      // 壁だけが残っていて、もう試しつくした部屋は後回し
      if (G.visited(s, rid) && (!G.room(rid).battle || G.rs(s, rid).c) && (!G.room(rid).items || G.rs(s, rid).t)
        && G.roomWalls(s, rid).every(w => !canTryWall(s, w) || (log['q_' + w.id] && log['q_' + w.id].tries >= 3))) continue;
      const p = rid === s.at ? [s.at] : G.path(s, s.at, rid);
      if (!p) continue;
      // 歩く
      let ok = true;
      for (const id of p.slice(1)) {
        const prev = s.at;
        G.enterRoom(s, id);
        const R = G.room(id);
        if (R.battle && !G.rs(s, id).c) {
          s.at = prev;
          let tries = 0;
          while (tries < 8) {
            tries++;
            const r = fight(s, id, 'battle');
            const L = log[id] || (log[id] = { tries: 0, turns: 0, best: 0, kills: 0, minHp: 99, firstWin: null });
            L.tries++; L.turns += r.turns; L.best = Math.max(L.best, r.best); L.kills += r.kills; L.minHp = Math.min(L.minHp, r.minHp);
            if (L.firstWin === null) L.firstWin = r.win;
            if (r.win) { battleOrder.push(id); break; }
            losses++;
          }
          if (!G.rs(s, id).c) { ok = false; break; }
        }
        if (R.items && !G.rs(s, id).t) { for (const it of R.items) G.gain(s, it); G.rs(s, id).t = 1; G.autoEdit(s, EDIT); }
        if (R.kind === 'end') { ended = true; break; }
      }
      if (!ok) return { s, log, losses, stuck: rid, order: battleOrder };
      if (ended) break;
      if (s.forge > 0) G.autoEdit(s, EDIT);
      // 残っている壁を、静かな詠唱で狙う
      const here = s.at;
      for (const w of G.roomWalls(s, here)) {
        if (!G.rs(s, here).c || !canTryWall(s, w)) continue;
        const key = 'q_' + w.id;
        const L = log[key] || (log[key] = { tries: 0, turns: 0, opened: false });
        if (L.tries >= 3) continue;
        L.tries++;
        const r = fight(s, here, 'quiet');
        L.turns += r.turns;
        if (s.walls[w.id]) L.opened = true;
      }
      progressed = true;
      break;
    }
    if (!progressed) break;
  }
  return { s, log, losses, ended, order: battleOrder };
}

const agg = {};
let endedN = 0, lossesT = 0, turnsT = 0, roomsT = 0, hiddenT = 0;
const bestBy = { 1: [], 2: [], 3: [], 4: [] };
for (let i = 0; i < N; i++) {
  const r = run(1000 + i * 17);
  if (r.ended) endedN++;
  lossesT += r.losses;
  turnsT += r.s.stats.turns;
  const ids = Object.keys(D.ROOMS);
  roomsT += ids.filter(id => G.visited(r.s, id)).length;
  hiddenT += ids.filter(id => D.ROOMS[id].hidden && G.visited(r.s, id)).length;
  for (const k in r.s.stats.bestBy) bestBy[k].push(r.s.stats.bestBy[k]);
  for (const k in r.log) {
    const a = agg[k] || (agg[k] = { n: 0, tries: 0, turns: 0, best: 0, kills: 0, minHp: 0, first: 0, opened: 0 });
    const L = r.log[k];
    a.n++; a.tries += L.tries; a.turns += L.turns; a.best += L.best || 0; a.kills += L.kills || 0; a.minHp += (L.minHp === 99 ? 0 : (L.minHp || 0)); a.first += L.firstWin ? 1 : 0; a.opened += L.opened ? 1 : 0;
  }
  if (VERB) console.log('seed', 1000 + i * 17, 'ended', r.ended, 'losses', r.losses, 'turns', r.s.stats.turns, r.stuck ? 'STUCK ' + r.stuck : '', 'reels', r.s.reels.map(R => R.strip.map(c => c.k[0] + (c.lv > 1 ? c.lv : '')).join('')).join('|'));
}
console.log(`policy=${POL} edit=${EDIT} runs=${N} ended=${endedN}/${N} losses/run=${(lossesT / N).toFixed(2)} casts/run=${(turnsT / N).toFixed(1)} rooms=${(roomsT / N).toFixed(1)} hidden=${(hiddenT / N).toFixed(1)}`);
const avg = a => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(0) : '-');
console.log('best line by stratum:', [1, 2, 3, 4].map(k => avg(bestBy[k])).join(' / '));
console.log('room            n  first%  tries  turns/try  best  minHp');
for (const k of Object.keys(agg)) {
  const a = agg[k];
  if (k.startsWith('q_')) { console.log(`${k.padEnd(14)} ${String(a.n).padStart(2)}  opened ${a.opened}/${a.n}  casts/run ${(a.turns / a.n).toFixed(1)}`); continue; }
  console.log(`${k.padEnd(14)} ${String(a.n).padStart(2)}  ${String(Math.round(a.first / a.n * 100)).padStart(4)}%  ${(a.tries / a.n).toFixed(2).padStart(5)}  ${(a.turns / a.tries).toFixed(1).padStart(8)}  ${(a.best / a.n).toFixed(0).padStart(4)}  ${(a.minHp / a.n).toFixed(1).padStart(5)}`);
}
