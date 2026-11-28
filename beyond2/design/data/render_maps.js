// GUILDWARD 設計資料 — 地図の下書き（maps_draft.js）から、仕様書に載せる図と表をつくる
// 使い方: beyond2/ で  node design/data/render_maps.js
// missions/chapter2/*.md の中の  <!-- MAP:m7:begin --> 〜 <!-- MAP:m7:end -->  の間を書きかえる（何度実行しても同じ結果）。
// 地図を直したら、maps_draft.js を直す → check_maps.js → このスクリプト、の順に実行する。
'use strict';
const fs = require('fs');
const path = require('path');
const DRAFT = require('./maps_draft.js');
const DIR = path.join(__dirname, '..', 'missions', 'chapter2');

const OBJ = {
  crate: ['c', '木箱'], snowball: ['o', '雪玉'], boulder: ['O', '大岩'], block: ['K', '石のブロック'], icicle: ['^', 'つらら（その升の真上）'],
  lever: ['L', 'レバー'], chime: ['C', '風鳴り石'], icepillar: ['P', '氷の柱'], pillar: ['P', '石柱'], anchor: ['A', '鉄の輪'], chest: ['$', '宝箱'],
  crack: ['%', 'ひび割れた岩・封印石'], plate: ['_', '重さの床'], target: ['T', '的'], door: ['D', '門・扉'], crystal: ['X', '霜の水晶'],
  statue: ['+', '像・風の石（かたい）'], wagon: ['W', '荷馬車'], deco: ['d', '景色（立てない）'], torch: ['t', 'たいまつ（立てる）'], fall: ['F', '滝の上（f が下）'],
};
const FOE = { snowgob: ['g', '雪小鬼'], wolf: ['w', '雪狼'], archer: ['a', '骨の射手'], icegolem: ['I', '氷の岩人形'], bat: ['b', '洞コウモリ'], slime: ['s', '粘体'], wisp: ['~', '水霊'], boar: ['B', '雪喰い大猪'], goblin: ['g', '小鬼'], golem: ['G', '岩人形'] };
const pad = (s, n) => (String(s) + '      ').slice(0, n);

function grid(d, cellAt) {
  const out = [];
  let head = '      x ';
  for (let x = 0; x < d.W; x++) head += pad(x % 10, 2);
  out.push(head);
  for (let y = 0; y < d.H; y++) { let r = ' y=' + pad(y, 2) + '   '; for (let x = 0; x < d.W; x++) r += pad(cellAt(x, y), 2); out.push(r); }
  return out.join('\n');
}
function render(id) {
  const d = DRAFT[id]; const L = [];
  L.push('地図：' + d.W + '×' + d.H + '（x は列で左から 0、y は行で上から 0。`js/data.js` と同じ）。出どころ：`design/data/maps_draft.js` の `MAPS.' + id + '`');
  L.push(''); L.push('**高さ**（`hmap`。`.` は谷）'); L.push('```'); L.push(grid(d, (x, y) => d.hmap[y][x])); L.push('```');
  L.push(''); L.push('**地面**（`tmap`。f 石／g 草／d 土／p 板／m 石畳／k 暗い石／s 砂／n 深い雪／i 氷／w 水／x 立てない壁の上／`.` 谷）'); L.push('```'); L.push(grid(d, (x, y) => d.tmap[y][x])); L.push('```');
  // 配置
  const at = {}; const put = (x, y, c) => { at[x + ',' + y] = c; };
  const used = {};
  for (const o of d.objs) {
    if (o.k === 'bridge') { for (const c of o.cells) put(c[0], c[1], '='); used['='] = 'はね橋（下りるまでは谷）'; continue; }
    const s = OBJ[o.k] || ['?', o.k]; put(o.x, o.y, s[0]); used[s[0]] = s[1];
    if (o.k === 'fall') { put(o.bx, o.by, 'f'); }
  }
  for (const n of d.npcs || []) { put(n.x, n.y, 'N'); used.N = '助ける人'; }
  for (const e of d.enemies || []) { const s = FOE[e.k] || ['?', e.k]; put(e.x, e.y, s[0]); used[s[0]] = s[1] + '（はじめからいる）'; }
  (d.start || []).forEach((p, k) => { put(p[0], p[1], String(k + 1)); });
  used['1〜' + d.start.length] = '出発の升（1＝リコ、2・3＝同行の順' + (d.guest ? '、4＝ゲストのナギ' : '') + '）';
  L.push(''); L.push('**配置**（`-` は谷、`#` は立てない壁、`·` は何もない升）'); L.push('```'); L.push(grid(d, (x, y) => at[x + ',' + y] || (d.hmap[y][x] === '.' ? '-' : d.tmap[y][x] === 'x' ? '#' : '·'))); L.push('```');
  L.push('記号：' + Object.keys(used).map(k => '`' + k + '` ' + used[k]).join('／'));
  // 表
  L.push(''); L.push('| 物（id） | 種類 | 升 | そなえ |'); L.push('| --- | --- | --- | --- |');
  for (const o of d.objs) {
    if (o.k === 'deco' || o.k === 'torch') continue;
    const name = o.k === 'bridge' ? 'はね橋' : (OBJ[o.k] || ['', o.k])[1].replace(/（.*）/, '');
    const pos = o.k === 'bridge' ? o.cells.map(c => '(' + c + ')').join(' ') + ' 高さ' + o.z : o.k === 'fall' ? '上 (' + o.x + ',' + o.y + ') → 下 (' + o.bx + ',' + o.by + ')' : '(' + o.x + ',' + o.y + ')';
    const ex = [];
    if (o.item) ex.push('中身：' + o.item); if (o.coins) ex.push('銀貨' + o.coins); if (o.on) ex.push('`' + o.on + '`'); if (o.need) ex.push('`need: ' + o.need + '`');
    if (o.h) ex.push('高さ' + o.h); if (o.rh) ex.push('がれき' + o.rh + '段'); if (o.rubble === false) ex.push('がれきは残らない'); if (o.lamps) ex.push('灯 ' + o.lamps.length); if (o.up) ex.push('拾うと `up.' + o.up + '`');
    L.push('| ' + (o.id || '―') + ' | ' + name + ' | ' + pos + ' | ' + ex.join('・') + ' |');
  }
  if ((d.npcs || []).length) { L.push(''); L.push('| 助ける人（id） | 升 | そなえ |'); L.push('| --- | --- | --- |'); for (const n of d.npcs) L.push('| ' + n.name + '（' + n.id + '） | (' + n.x + ',' + n.y + ') | ' + [n.escort ? '護衛される' : '', n.onFound ? '見つけると `' + n.onFound + '`' : ''].filter(Boolean).join('・') + ' |'); }
  L.push(''); L.push('| 敵 | 升 | 起きる距離 | 組 |'); L.push('| --- | --- | --- | --- |');
  for (const e of d.enemies || []) L.push('| ' + (FOE[e.k] || ['', e.k])[1] + ' | (' + e.x + ',' + e.y + ') | ' + (e.wake === 99 ? 'はじめから戦い' : e.wake === 0 ? '0（合図で起きる）' : e.wake) + ' | ' + (e.grp || 1) + ' |');
  for (const w of d.waves || []) L.push('| **第' + w.turn + '手番の波**「' + w.text + '」 | ' + w.units.map(u => (FOE[u.k] || ['', u.k])[1] + '(' + u.x + ',' + u.y + ')').join(' ') + ' | ― | ― |');
  L.push(''); L.push('出発の升：' + d.start.map(p => '(' + p[0] + ',' + p[1] + ')').join('・') + (d.startFight ? '。入るとすぐ戦い' : '') + (d.guest ? '。四つめはゲストのナギ' : ''));
  L.push('目的（データ）：`' + JSON.stringify(d.objective) + '`');
  return L.join('\n');
}

let n = 0;
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.md')) continue;
  const p = path.join(DIR, f); let s = fs.readFileSync(p, 'utf8'); let changed = false;
  for (const id of Object.keys(DRAFT)) {
    const a = '<!-- MAP:' + id + ':begin -->', b = '<!-- MAP:' + id + ':end -->';
    const i = s.indexOf(a), j = s.indexOf(b);
    if (i < 0 || j < 0) continue;
    s = s.slice(0, i + a.length) + '\n' + render(id) + '\n' + s.slice(j); changed = true; n++;
  }
  if (changed) fs.writeFileSync(p, s);
}
console.log('地図の図を ' + n + ' か所、書きこんだ');
