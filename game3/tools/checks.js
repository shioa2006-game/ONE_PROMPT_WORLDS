// Targeted system checks (node tools/checks.js)
const EMB = require('../js/sim.js');
let fails = 0;
function ok(name, c) { console.log((c ? 'PASS ' : 'FAIL ') + name); if (!c) fails++; }
function run(g, n, inp) { for (let i = 0; i < n; i++) g.update(1 / 60, i === 0 ? (inp || {}) : {}); }
function fresh(zone, x, y, weapons) { const g = new EMB.Game(null, 7); g.p.weapons = weapons || ['sword', 'spear', 'hammer']; g.enterZone(zone, x, y); g.z.enemies.length = 0; return g; }
function strike(g, wi, aim) { g.p.wi = wi; run(g, 40, { attack: true, aim: aim }); }
const sp = (g, k, x, y) => g.z.objs.find(o => o.k === k && o.x === x && o.y === y);

// far braziers: sword/hammer must NOT reach, spear must
for (const [z, bx, by, px, py, room, door] of [[0, 50, 39, 50.5, 36.69, 'rs'], [1, 21, 33, 21.5, 30.69, 'a1'], [1, 64, 33, 64.5, 30.69, 'b1']]) {
  let g = fresh(z, px, py); strike(g, 0, Math.PI / 2); ok(`z${z} far brazier: sword cannot reach`, !sp(g, 'brazier', bx, by).lit);
  strike(g, 2, Math.PI / 2); ok(`z${z} far brazier: hammer cannot reach`, !sp(g, 'brazier', bx, by).lit);
  strike(g, 1, Math.PI / 2); ok(`z${z} far brazier: spear reaches`, sp(g, 'brazier', bx, by).lit);
  g = fresh(z, px, py); g.p.hasFlare = true; g.p.flare = 100; run(g, 30, { flare: true }); ok(`z${z} far brazier: flare reaches`, sp(g, 'brazier', bx, by).lit);
  // light the other brazier(s) and check the seal opens
  for (const o of g.z.objs) if (o.k === 'brazier' && o.room === room && !o.lit) g.ignite(o);
  ok(`z${z} ${room}: seal door opens when room lit`, g.z.objs.filter(o => o.k === 'door' && o.s.cond === 'lit:' + room).every(o => o.open));
  // rolling toward the island must not land on it
  g = fresh(z, px, py); run(g, 80, { roll: true, my: 1, mx: 0 }); for (let i = 0; i < 80; i++) g.update(1 / 60, { my: 1 });
  ok(`z${z} far brazier: cannot be walked/rolled to`, g.p.y < by - 1.5);
}
// cracked walls: sword no, hammer yes
for (const [z, cx, cy, px, py, aim] of [[0, 22, 15, 22.5, 16.5, -Math.PI / 2], [1, 36, 9, 35.5, 9.5, 0], [1, 81, 28, 80.5, 28.5, 0]]) {
  const g = fresh(z, px, py); strike(g, 0, aim); ok(`z${z} crack: sword does not break`, !!sp(g, 'crack', cx, cy));
  strike(g, 1, aim); ok(`z${z} crack: spear does not break`, !!sp(g, 'crack', cx, cy));
  strike(g, 2, aim); ok(`z${z} crack: hammer breaks`, !sp(g, 'crack', cx, cy));
}
// shell guard: front blocked, hammer breaks guard, back hit works
{
  let g = fresh(1, 30.5, 28.5); let e = g.mk('shell', 31, 28, g.z.def.rooms.find(r => r.id === 'a1')); e.x = 31.9; e.y = 28.5; e.face = Math.PI; e.aggro = true; e.cd = 99;
  const hp = e.hp; g.p.wi = 0; run(g, 12, { attack: true, aim: 0 }); ok('shell: frontal sword hit is blocked', e.hp === hp);
  g = fresh(1, 30.5, 28.5); e = g.mk('shell', 31, 28, g.z.def.rooms.find(r => r.id === 'a1')); e.x = 31.9; e.y = 28.5; e.face = 0; e.cd = 99; e.stun = 5;
  g.p.wi = 0; run(g, 12, { attack: true, aim: 0 }); ok('shell: stunned/back hit lands', e.hp < e.maxhp);
  g = fresh(1, 30.5, 28.5); e = g.mk('shell', 31, 28, g.z.def.rooms.find(r => r.id === 'a1')); e.x = 31.9; e.y = 28.5; e.face = Math.PI; e.aggro = true; e.cd = 99;
  g.p.wi = 2; run(g, 25, { attack: true, aim: 0 }); ok('shell: hammer breaks guard', e.hp < e.maxhp && e.stun > 0);
}
// shell charge into wall stuns it; knockback into pit kills
{
  const g = fresh(1, 33.5, 28.5); const room = g.z.def.rooms.find(r => r.id === 'a1'); const e = g.mk('shell', 30, 28, room); e.face = 0; e.aggro = true; e.cd = 0;
  g.p.inv = 999; let crashed = false; for (let i = 0; i < 400 && !crashed; i++) { g.update(1 / 60, {}); if (g.ev.some(v => v.t === 'crash')) crashed = true; g.p.inv = 999; }
  ok('shell: charge crashes into wall and is stunned', crashed && e.stun > 1);
  const g2 = fresh(0, 42.3, 35.5); const r2 = g2.z.def.rooms.find(r => r.id === 'rs'); const b = g2.mk('blob', 43, 35, r2); b.x = 43.4; b.aggro = true; b.cd = 99;
  g2.p.wi = 2; run(g2, 90, { attack: true, aim: 0 }); ok('pit: enemy knocked into pit dies', b.dead === true);
}
// lit room: enemies do not respawn; unlit do
{
  const g = new EMB.Game(null, 3); const n0 = g.z.enemies.length;
  for (const e of g.z.enemies) if (e.room.id === 'r1' || e.room.id === 'r2') g.kill(e, 0);
  g.ignite(sp(g, 'brazier', 25, 21)); g.z.enemies = g.z.enemies.filter(e => !e.dead); g.rest('L1');
  const r1 = g.z.enemies.filter(e => e.room.id === 'r1').length, r2 = g.z.enemies.filter(e => e.room.id === 'r2').length;
  ok('respawn: lit room stays clear, unlit room refills', r1 === 0 && r2 === 3);
}
// death -> respawn keeps growth; save/load round trip
{
  const g = new EMB.Game(null, 5); g.p.lvl = 4; g.p.cry = 77; g.p.charms = ['magnet']; g.p.equipped = ['magnet']; g.flags.lamps.L2 = 1; g.p.lamp = 'L2';
  g.p.x = 28.2; g.p.y = 19.5; g.p.hp = 1; let died = false, resp = false;
  for (let i = 0; i < 1500; i++) { g.update(1 / 60, {}); if (g.ev.some(v => v.t === 'die')) died = true; if (g.ev.some(v => v.t === 'respawn')) { resp = true; break; } }
  ok('death: dies then respawns at last lamp with growth kept', died && resp && g.p.lvl === 4 && g.p.cry === 77 && g.p.hp === g.maxhp() && Math.abs(g.p.x - 60.5) < 0.1);
  const s = JSON.parse(JSON.stringify(g.serialize())); const h = new EMB.Game(s, 9);
  ok('save/load: level, crystals, charms, lamp restored', h.p.lvl === 4 && h.p.cry === 77 && h.has('magnet') && h.p.lamp === 'L2' && h.flags.lamps.L2 === 1 && Math.abs(h.p.x - 60.5) < 0.1);
}
// charms
{
  let g = fresh(0, 22.5, 22.5); g.p.equipped = ['iron']; g.hurt(3, 0, 0); ok('charm iron: 3 dmg -> 2', g.p.hp === 12);
  g = fresh(0, 22.5, 22.5); g.p.equipped = ['leech']; g.p.hp = 5; const e = g.mk('blob', 23, 22, g.z.def.rooms[1]); g.kill(e, 0); ok('charm leech: +1 hp on kill', g.p.hp === 6);
  g = fresh(0, 22.5, 22.5); g.p.equipped = ['retort']; const e2 = g.mk('blob', 23, 22, g.z.def.rooms[1]); g.hurt(1, 0, 0); ok('charm retort: nearby enemy damaged when hurt', e2.hp < e2.maxhp);
  g = fresh(0, 22.5, 22.5); g.p.equipped = ['trail']; run(g, 10, { roll: true, mx: 1 }); ok('charm trail: roll leaves fire', g.z.fires.length > 0);
}
console.log(fails ? fails + ' FAILED' : 'ALL PASS');
