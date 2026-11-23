// node から data.js と sim.js を読みこむ
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
function load() {
  const ctx = { console, Math, JSON, Object, Array, Set, Map };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['js/data.js', 'js/sim.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return { D: ctx.K20D, S: ctx.K20S };
}
function waveById(D, id) {
  for (const n of D.NIGHTS) for (const w of n.waves) if (w.id === id) return w;
  return null;
}
function allWaves(D) {
  const out = [];
  for (const n of D.NIGHTS) for (const w of n.waves) out.push(w);
  return out;
}
module.exports = { load, waveById, allWaves, ROOT };
