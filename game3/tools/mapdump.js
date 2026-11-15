const EMB = require('../js/data.js');
const zs = EMB.buildZones();
for (const z of zs) {
  const g = []; for (let y = 0; y < z.h; y++) { g.push([]); for (let x = 0; x < z.w; x++) g[y].push(' .o#'[z.tiles[y * z.w + x]]); }
  const ch = { brazier: 'B', lamp: 'L', chest: 'C', crate: 'c', crack: 'X', stairs: '>', heart: 'H', enemy: 'e', door: 'D' };
  for (const s of z.spawns) { if (s.k === 'door') for (const t of s.tiles) g[t[1]][t[0]] = 'D'; else g[s.y][s.x] = s.k === 'enemy' ? s.type[0] : ch[s.k]; if (s.k!=='door' && s.k!=='brazier' && z.tiles[s.y*z.w+s.x]!==1) console.log('WARN not on floor', s.id, s.k, s.x, s.y); }
  console.log('== ' + z.name); console.log(g.map(r => r.join('').replace(/\s+$/, '')).join('\n'));
}
