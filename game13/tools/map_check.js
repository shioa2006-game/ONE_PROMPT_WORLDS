// 地図の形と、データで決めた隣接（街道）が食い違っていないかを調べる
//   node tools/map_check.js
'use strict';
var D = require('../js/data.js'), M = require('../js/map.js');
var m = M.build(1), t = M.touching(m);
var area = D.PROV.map(function () { return 0; });
for (var i = 0; i < m.id.length; i++) if (m.id[i] >= 0) area[m.id[i]]++;
var bad = 0;
D.LINKS.forEach(function (l) {
  var k = Math.min(l[0], l[1]) + '-' + Math.max(l[0], l[1]);
  if (!t[k] || t[k] < 8) { bad++; console.log('街道があるのに接していない:', D.PROV[l[0]].name, D.PROV[l[1]].name, t[k] || 0); }
});
Object.keys(t).forEach(function (k) {
  var a = +k.split('-')[0], b = +k.split('-')[1];
  if (D.ADJ[a].indexOf(b) < 0 && t[k] >= 8) console.log('接しているが街道なし:', D.PROV[a].name, D.PROV[b].name, t[k]);
});
D.PROV.forEach(function (p, i) {
  var c = m.castle[i], on = m.id[Math.round(c.y) * m.W + Math.round(c.x)];
  console.log((p.name + '　　　　').slice(0, 5), '面積', area[i], '城', Math.round(c.x) + ',' + Math.round(c.y), on === i ? '' : '★城が自国の外 ' + on);
});
console.log(bad ? '街道の食い違い ' + bad + ' 件' : '街道はすべて地図上で接している');
