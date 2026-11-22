/* 地図データの確認：国境の参照・大名の所領の重複・つながり・投影後の間隔
   node tools/map_check.js */
'use strict';
const D = require('../js/data.js');
const PJ = require('../js/proj.js');
const geography = require('../js/geography.js');

let bad = 0;
const fail = m => { bad++; console.log('NG', m); };
const PI = {}; D.PROV.forEach((p, i) => { if (PI[p.id] !== undefined) fail('国IDの重複 ' + p.id); PI[p.id] = i; });

// 国境
const edges = [];
const seen = {};
D.EDGES.split(';').map(x => x.trim()).filter(Boolean).forEach(l => {
  const [a, b, t] = l.split(/\s+/);
  if (PI[a] === undefined || PI[b] === undefined) fail('不明な国 ' + l);
  if (!'RPS'.includes(t)) fail('不明な種類 ' + l);
  const k = [a, b].sort().join('-');
  if (seen[k]) fail('国境の重複 ' + k);
  seen[k] = 1;
  edges.push([PI[a], PI[b], t]);
});
for (const k in D.PASS_NAMES) { const [a, b] = k.split('-'); if (!seen[[a, b].sort().join('-')]) fail('名前だけの国境 ' + k); }

// 所領
const owner = {};
D.CLANS.forEach(c => c.start.forEach(p => { if (PI[p] === undefined) fail('不明な所領 ' + c.id + ' ' + p); if (owner[p]) fail('所領の重複 ' + p + ' ' + owner[p] + '/' + c.id); owner[p] = c.id; }));
D.PROV.forEach(p => { if (!owner[p.id]) fail('持ち主のいない国 ' + p.id); });
const mons = {}, ids = {};
D.CLANS.forEach(c => { if (mons[c.mon]) fail('紋の重複 ' + c.mon + ' ' + c.id + '/' + mons[c.mon]); mons[c.mon] = c.id; if (ids[c.id]) fail('家IDの重複 ' + c.id); ids[c.id] = 1; });
D.CLANS.forEach(c => (c.armies || []).forEach(([ref]) => {
  if (PI[ref] === undefined) { const [a, b] = ref.split('-'); if (!seen[[a, b].sort().join('-')]) fail('軍勢の位置が不明 ' + c.id + ' ' + ref); }
}));

// つながり（海路込み・海路なし）
function comps(useSea) {
  const P = D.PROV.length, adj = Array.from({ length: P }, () => []);
  edges.forEach(([a, b, t]) => { if (useSea || t !== 'S') { adj[a].push(b); adj[b].push(a); } });
  const cid = new Array(P).fill(-1); let n = 0;
  for (let s = 0; s < P; s++) { if (cid[s] >= 0) continue; const q = [s]; cid[s] = n; while (q.length) { const u = q.pop(); for (const v of adj[u]) if (cid[v] < 0) { cid[v] = n; q.push(v); } } n++; }
  return { n, cid, adj };
}
const all = comps(true);
if (all.n !== 1) fail('つながっていない国がある');
const land = comps(false);
const groups = {};
land.cid.forEach((c, i) => { (groups[c] = groups[c] || []).push(D.PROV[i].n); });
console.log('陸続きのかたまり', Object.values(groups).map(g => g.length + '国(' + g.slice(0, 3).join('・') + '…)').join(' / '));
const deg = all.adj.map(a => a.length);
console.log('国', D.PROV.length, '国境', edges.length, 'マス', D.PROV.length + edges.length, '隣国数 最小', Math.min(...deg), '最大', Math.max(...deg));

// 大名
const maj = D.CLANS.filter(c => c.major), mnr = D.CLANS.filter(c => !c.major);
const kokOf = c => c.start.reduce((x, p) => x + D.PROV[PI[p]].k, 0);
console.log('大名', D.CLANS.length, '（主要', maj.length, '・その他', mnr.length, '）');
console.log('主要大名の石高', maj.map(c => c.n + kokOf(c)).join(' '));

// 投影後の間隔
const pos = D.PROV.map(p => geography.project(...geography.castlePoint(p)));
let minC = Infinity, pair = null;
for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
  const d = Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]);
  if (d < minC) { minC = d; pair = [D.PROV[i].n, D.PROV[j].n]; }
}
const close = [];
for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
  const d = Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]);
  if (d < 70) close.push(D.PROV[i].n + '-' + D.PROV[j].n + ':' + d.toFixed(0));
}
const xs = pos.map(p => p[0]), ys = pos.map(p => p[1]);
console.log('世界', PJ.W, 'x', PJ.H, '城の範囲 x', Math.min(...xs).toFixed(0), '〜', Math.max(...xs).toFixed(0), ' y', Math.min(...ys).toFixed(0), '〜', Math.max(...ys).toFixed(0));
console.log('城どうしの最短', minC.toFixed(1), pair.join('-'));
console.log('70未満の組', close.length, close.join(' '));
console.log(bad ? '問題 ' + bad + ' 件' : '問題なし');
process.exit(bad ? 1 : 0);
