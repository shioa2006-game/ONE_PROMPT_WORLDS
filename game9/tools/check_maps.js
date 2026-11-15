// 地図の検査：行と列の数、はじめから浮いている岩がないか、おとしものの数
const S = require('../js/sim.js');
const D = require('../js/levels.js');
let ok = true;
for (const ch of D.CHAMBERS) {
  try {
    const w = new S.World(ch, { seed: 1 });
    const { out } = w.findFalling(w.g);
    const tre = [...w.item].filter((v) => v >= 0).length;
    const tcells = [...w.g].filter((t) => t === S.T.TREAS).length;
    const solid = [...w.g].filter((t) => t && t !== S.T.BED).length;
    const msg = `${ch.id} ${ch.name}: solid=${solid} floating=${out.length} treasures=${tre}/${tcells} items=${(ch.items||[]).length} monsters=${w.monsters.map(m=>m.kind).join(',')} anchors=${w.guardian ? w.guardian.total : '-'}`;
    if (out.length || tre !== (ch.items || []).length) { ok = false; console.log('NG', msg, out.map(i => [i % 20, (i / 20) | 0])); }
    else console.log('ok', msg);
  } catch (e) { ok = false; console.log('ERR', ch.id, e.message); }
}
process.exit(ok ? 0 : 1);
