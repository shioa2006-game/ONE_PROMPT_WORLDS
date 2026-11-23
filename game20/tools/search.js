// 陣ごとに、持ち場の組み合わせを総当たり（4人以上は無作為抽出＋山登り）で迎撃し、勝てる配置の多さを調べる
// 使い方: node tools/search.js [陣ID...] [--n=3000] [--up=ilza_hp,...] [--top=8]
// 知っている情報: 陣の中身と持ち場の一覧だけ。同じ配置は必ず同じ結果（乱数なし）。
const { load, allWaves, waveById } = require('./lib');
const { D, S } = load();
const args = process.argv.slice(2);
let N = 3000, TOP = 6, up = {};
const ids = [];
for (const a of args) {
  if (a.startsWith('--n=')) N = +a.slice(4);
  else if (a.startsWith('--top=')) TOP = +a.slice(6);
  else if (a.startsWith('--up=')) for (const u of a.slice(5).split(',')) up[u] = true;
  else ids.push(a);
}
const waves = ids.length ? ids.map((i) => waveById(D, i)) : allWaves(D);
const slotIds = D.SLOTS.map((s) => s.id);

// 決まった種で並べかえる（結果を再現できるように）
let seed = 12345;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

function evalPl(wave, pl) {
  const st = S.create({ wave, placement: pl, upgrades: up, keepEvents: false });
  S.run(st, 400);
  const r = st.result;
  const downs = st.allies.filter((a) => a.down).length;
  return { win: r.win, lamps: r.lamps, max: r.lampsMax, t: r.t, downs, combos: Object.keys(st.stats.combos).length, score: (r.win ? 100 : 0) + r.lamps * 10 - downs * 3 + st.stats.killed * 0.1 };
}
function key(pl) { return Object.keys(pl).sort().map((k) => k + '=' + pl[k]).join(' '); }

function* allPlacements(allies) {
  const k = allies.length;
  const used = new Array(slotIds.length).fill(false);
  const cur = {};
  function* rec(i) {
    if (i === k) { yield Object.assign({}, cur); return; }
    for (let s = 0; s < slotIds.length; s++) {
      if (used[s]) continue;
      used[s] = true; cur[allies[i]] = slotIds[s];
      yield* rec(i + 1);
      used[s] = false;
    }
  }
  yield* rec(0);
}
function randomPl(allies) {
  const pool = slotIds.slice();
  const pl = {};
  for (const a of allies) { const i = Math.floor(rnd() * pool.length); pl[a] = pool.splice(i, 1)[0]; }
  return pl;
}

for (const wave of waves) {
  const allies = wave.allies;
  const res = [];
  const t0 = Date.now();
  const total = allies.length <= 3;
  let sampleWin = null, samplePerfect = null;
  if (total) {
    for (const pl of allPlacements(allies)) res.push({ pl, r: evalPl(wave, pl) });
  } else {
    const seen = new Set();
    for (let i = 0; i < N; i++) {
      const pl = randomPl(allies);
      const k = key(pl);
      if (seen.has(k)) continue;
      seen.add(k);
      res.push({ pl, r: evalPl(wave, pl) });
    }
    sampleWin = res.filter((x) => x.r.win).length / res.length;
    samplePerfect = res.filter((x) => x.r.win && x.r.lamps === x.r.max).length / res.length;
    // 山登り：上位から一人ずつ動かす
    res.sort((a, b) => b.r.score - a.r.score);
    const seeds = res.slice(0, 12);
    for (const s0 of seeds) {
      let cur = s0;
      for (let it = 0; it < 6; it++) {
        let improved = false;
        for (const a of allies) {
          for (const sid of slotIds) {
            if (Object.values(cur.pl).includes(sid)) continue;
            const pl = Object.assign({}, cur.pl, { [a]: sid });
            const k = key(pl);
            if (seen.has(k)) continue;
            seen.add(k);
            const r = evalPl(wave, pl);
            res.push({ pl, r });
            if (r.score > cur.r.score) { cur = { pl, r }; improved = true; }
          }
        }
        if (!improved) break;
      }
    }
  }
  res.sort((a, b) => b.r.score - a.r.score);
  const wins = res.filter((x) => x.r.win).length;
  const perfect = res.filter((x) => x.r.win && x.r.lamps === x.r.max).length;
  const ms = Date.now() - t0;
  console.log(`== ${wave.id} ${wave.title} allies=${allies.join(',')} tried=${res.length}${total ? '(all)' : '(sample+climb)'} win=${(100 * wins / res.length).toFixed(1)}% perfect=${(100 * perfect / res.length).toFixed(1)}%${sampleWin != null ? ` [random only: win=${(100 * sampleWin).toFixed(1)}% perfect=${(100 * samplePerfect).toFixed(1)}%]` : ''} (${ms}ms)`);
  for (const x of res.slice(0, TOP)) {
    console.log(`   ${x.r.win ? 'W' : 'L'} lamps=${x.r.lamps}/${x.r.max} downs=${x.r.downs} t=${x.r.t.toFixed(0)} combos=${x.r.combos}  ${key(x.pl)}`);
  }
  // 勝てる配置で、各仲間がどの持ち場にいたか（多様さの目安）
  const winners = res.filter((x) => x.r.win && x.r.lamps >= x.r.max - 1);
  const usage = {};
  for (const x of winners) for (const a in x.pl) { usage[a] = usage[a] || {}; usage[a][x.pl[a]] = (usage[a][x.pl[a]] || 0) + 1; }
  for (const a of allies) {
    const u = usage[a] || {};
    const top = Object.entries(u).sort((p, q) => q[1] - p[1]).slice(0, 5).map(([s, c]) => `${s}:${c}`).join(' ');
    console.log(`   ${a}: ${top}`);
  }
}
