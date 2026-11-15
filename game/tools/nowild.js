const { S, fresh } = require('./lib.js'); const { scan } = require('./window.js');
const { world, state } = fresh(); state.mush = state.mush.filter(m => m.kind !== 'wild');
for (const [g, box] of [[2,[2150,2400,760,1000]],[3,[3340,3700,850,1460]],[4,[4480,4960,1800,2110]],[5,[5440,5840,1090,1490]]]) console.log('no-wild/no-plant group', g, 'solutions:', scan(world, state, g, box, 40).length);
