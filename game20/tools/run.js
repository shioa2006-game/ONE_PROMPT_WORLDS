// 一つの陣を、指定の持ち場で迎撃してみる
// 使い方: node tools/run.js 1-1 ilza=s_land ruu=w_sw [--up=ilza_hp,lamp] [-v]
const { load, waveById } = require('./lib');
const { D, S } = load();
const args = process.argv.slice(2);
const id = args[0];
const pl = {};
let up = {};
let verbose = false;
for (const a of args.slice(1)) {
  if (a === '-v') verbose = true;
  else if (a.startsWith('--up=')) for (const u of a.slice(5).split(',')) up[u] = true;
  else { const [k, v] = a.split('='); pl[k] = v; }
}
const wave = waveById(D, id);
if (!wave) { console.log('no wave', id); process.exit(1); }
const st = S.create({ wave, placement: pl, upgrades: up });
const names = (id) => (D.ALLIES[id] ? D.ALLIES[id].name : id);
while (!st.over) {
  S.step(st);
  if (verbose) {
    for (const e of st.events) {
      const t = e.t.toFixed(1);
      if (e.type === 'block') console.log(t, 'block', names(e.a.id), D.ENEMIES[e.e.type].name, '#' + e.e.uid);
      else if (e.type === 'explode') console.log(t, 'explode n=' + e.n, 'kills=' + e.kills);
      else if (e.type === 'leak') console.log(t, 'LEAK', e.e.r, D.ENEMIES[e.e.type].name);
      else if (e.type === 'down') console.log(t, 'DOWN', names(e.a.id), 'by', e.by);
      else if (e.type === 'combo') console.log(t, 'COMBO', e.id);
      else if (e.type === 'gatebreak') console.log(t, 'GATE BROKEN');
      else if (e.type === 'slip') console.log(t, 'slip', names(e.a.id), D.ENEMIES[e.e.type].name);
    }
  }
  st.events.length = 0;
}
const r = st.result;
console.log(`${id} ${r.win ? 'WIN' : 'LOSE'} lamps=${r.lamps}/${r.lampsMax} t=${r.t.toFixed(1)} killed=${st.stats.killed}/${st.stats.total}`);
console.log('leaks', JSON.stringify(st.stats.leaks), 'gate', st.stats.gateT ? st.stats.gateT.toFixed(1) : '-');
for (const a of st.allies) {
  const s = st.stats.allies[a.id];
  console.log(`  ${names(a.id)}@${a.slot.name} hp=${a.hp.toFixed(0)}/${a.maxhp} held=${s.held} kills=${s.kills} dmg=${s.dmg.toFixed(0)} assists=${s.assists} downs=${s.downs} burnBest=${s.burnBest}`);
}
console.log('combos', JSON.stringify(st.stats.combos));
const an = S.analyze(wave, pl, up);
for (const r in an.routes) {
  const i = an.routes[r];
  console.log(' plan', r, 'block', i.block ? names(i.block.ally) + '@' + i.block.d.toFixed(1) : 'none', 'cover', Object.keys(i.cover).join(','));
}
console.log(' links', an.links.map((l) => l.label + ':' + l.a + '-' + l.b).join(' '));
