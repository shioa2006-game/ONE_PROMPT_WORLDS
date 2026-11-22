/* 全国図の海岸・国境・街道。座標は緯度、経度の順。 */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const { DATA, E, SETOUCHI, KYUSHU, EAST_COAST, EAST_BORDERS } = node ? {
    DATA:require('./data.js'), E:require('./engine.js'), SETOUCHI:require('./setouchi.js'),
    KYUSHU:require('./kyushu.js'), EAST_COAST:require('./east-coast.js'), EAST_BORDERS:require('./east-borders.js'),
  } : root.SG;
  // 知多・渥美の基準点を全国で共有する。地方の境で座標の原点まで補間すると、
  // 伊豆のような細い地形が潰れ、関門から石見までが横に引き伸ばされる。
  function ramp(t) {
    const u = Math.max(0, Math.min(1,t));
    return u*u*(3-2*u);
  }
  function project(lat,lon) {
    const north = ramp((lat-35.6)/5.8);
    const x = 1092+(lon-136.70)*118*(1-0.085*north);
    // 伊良湖の緯度を軸に、畿内・東部瀬戸内と東海三国の既定の縦幅を保つ。
    const central = ramp((lon-132.0)/1.1)*ramp((139.55-lon)/1.22);
    const tokai = ramp((lon-136.28)/0.39);
    const delta = lat-34.575;
    // 中央帯の外では縦方向の倍率を徐々に147へ戻す。変位を積分して
    // つなぎ目で飛騨・加賀だけが南北に伸びるのを防ぐ。
    const limit = delta > 0 ? 0.92 : 1.22;
    const q = Math.min(1,Math.max(0,(Math.abs(delta)-limit)/0.80));
    const distance = Math.min(Math.abs(delta),limit)+0.80*(q-q**3+q**4/2);
    const y = 1090.275-147*delta+central*(8+16*tokai)*Math.sign(delta)*distance;
    const suonada = ramp((lon-130.35)/0.50)*ramp((132.75-lon)/0.70)*
      ramp((lat-33.50)/0.40)*ramp((35.12-lat)/0.56);
    return [x,y+12*(lat-34.25)*suonada];
  }
  function outline(points) {
    const out = [];
    for (let i=0; i<points.length; i++) {
      const a=points[i], b=points[(i+1)%points.length];
      const steps=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/0.08));
      for (let k=0;k<steps;k++) out.push(project(a[0]+(b[0]-a[0])*k/steps, a[1]+(b[1]-a[1])*k/steps));
    }
    return out;
  }
  const biwa = [
    [35.50,136.13],[35.48,136.17],[35.49,136.20],[35.45,136.22],
    [35.40,136.24],[35.35,136.22],[35.30,136.20],[35.25,136.15],
    [35.21,136.10],[35.18,136.08],[35.16,136.05],[35.12,136.04],
    [35.10,135.99],[35.07,135.96],[35.04,135.93],[35.01,135.91],
    [35.01,135.88],[35.04,135.87],[35.09,135.90],[35.13,135.93],
    [35.17,135.94],[35.21,135.97],[35.25,136.00],[35.29,136.01],
    [35.32,136.03],[35.36,136.03],[35.39,136.06],[35.43,136.07],
    [35.47,136.05],[35.49,136.08],[35.47,136.10],
  ];
  const coast = DATA.COAST.honshu.slice();
  function replaceCoast(from, to, points) {
    const at = q => coast.findIndex(p => p[0] === q[0] && p[1] === q[1]);
    const a = at(from), b = at(to);
    if (a < 0 || b <= a) throw Error('海岸の接続点を確認してください');
    coast.splice(a + 1, b - a - 1, ...points);
  }
  // 丹後半島・若狭湾。湾の奥と岬の先を交互に残す。
  replaceCoast([35.65,134.85], [35.75,136.02], [
    [35.65,135.00],[35.74,135.10],[35.77,135.20],[35.70,135.27],
    [35.62,135.26],[35.54,135.18],[35.52,135.21],[35.57,135.32],
    [35.48,135.34],[35.46,135.38],[35.55,135.44],[35.50,135.51],
    [35.49,135.56],[35.54,135.61],[35.48,135.63],[35.48,135.70],
    [35.54,135.74],[35.50,135.78],[35.52,135.83],[35.56,135.83],
    [35.55,135.91],[35.60,135.93],[35.61,135.97],[35.65,135.97],
    [35.68,135.96],[35.70,135.99],[35.73,136.00],
  ]);
  // 御前崎から遠州灘、渥美半島の外海と内海、衣浦湾、知多半島を経て伊勢湾奥へ。
  replaceCoast([34.9,138.33], [35.05,136.69], [
    [34.84,138.30],[34.79,138.26],[34.74,138.23],[34.69,138.21],[34.60,138.22],
    [34.63,138.12],[34.65,138.02],[34.66,137.92],[34.65,137.80],[34.65,137.71],
    [34.67,137.60],[34.67,137.49],[34.67,137.42],[34.65,137.32],[34.62,137.20],
    [34.59,137.10],[34.575,137.03],[34.60,137.02],[34.63,137.07],[34.65,137.10],
    [34.66,137.17],[34.69,137.22],[34.72,137.26],[34.74,137.27],[34.74,137.32],
    [34.78,137.34],[34.82,137.33],[34.84,137.30],[34.80,137.24],[34.80,137.19],
    [34.83,137.15],[34.79,137.11],[34.80,137.06],[34.85,137.04],[34.89,137.03],
    [34.93,136.99],[34.89,136.97],[34.85,136.94],[34.80,136.94],[34.76,136.94],
    [34.73,136.96],[34.705,136.98],[34.695,136.96],[34.71,136.91],[34.75,136.87],
    [34.81,136.85],[34.88,136.83],[34.95,136.82],[35.02,136.85],[35.06,136.84],
    [35.07,136.79],[35.05,136.75],
  ]);
  // 伊勢湾西岸から志摩、熊野灘、潮岬へ。
  replaceCoast([35.05,136.69], [33.5,135.55], [
    [34.99,136.66],[34.93,136.63],[34.86,136.58],[34.76,136.54],
    [34.68,136.53],[34.59,136.57],[34.55,136.65],[34.52,136.74],
    [34.48,136.81],[34.49,136.87],[34.43,136.91],[34.39,136.89],
    [34.36,136.93],[34.31,136.89],[34.27,136.88],[34.28,136.76],
    [34.32,136.71],[34.28,136.68],[34.30,136.61],[34.24,136.56],
    [34.25,136.50],[34.20,136.46],[34.18,136.35],[34.12,136.33],
    [34.10,136.24],[34.07,136.22],[34.05,136.28],[34.01,136.23],
    [34.00,136.16],[33.96,136.20],[33.92,136.15],[33.90,136.12],
    [33.85,136.09],[33.78,136.05],[33.72,136.00],[33.66,135.98],
    [33.63,135.94],[33.59,135.94],[33.55,135.89],[33.49,135.82],
    [33.48,135.77],[33.45,135.76],[33.44,135.75],[33.46,135.71],[33.48,135.64],
  ]);
  // 潮岬の西から田辺湾、日ノ御埼、紀ノ川の河口、加太まで。
  replaceCoast([33.5,135.55], [34.23,135.15], [
    [33.54,135.49],[33.56,135.45],[33.58,135.39],[33.64,135.39],
    [33.67,135.33],[33.69,135.34],[33.70,135.38],[33.72,135.36],
    [33.76,135.31],[33.78,135.25],[33.81,135.21],[33.84,135.17],
    [33.88,135.10],[33.88,135.06],[33.91,135.06],[33.95,135.11],
    [33.98,135.09],[34.03,135.15],[34.05,135.12],[34.09,135.15],
    [34.12,135.13],[34.15,135.18],[34.18,135.15],[34.20,135.14],
  ]);
  // 大阪湾。和泉側の斜面、湾奥、明石側の岸を描き分ける。
  replaceCoast([34.23,135.15], [34.72,134.8], [
    [34.26,135.10],[34.28,135.07],[34.31,135.13],[34.32,135.18],
    [34.34,135.20],[34.36,135.25],[34.40,135.29],[34.45,135.34],
    [34.49,135.38],[34.53,135.41],[34.56,135.44],[34.60,135.45],
    [34.65,135.45],[34.69,135.43],[34.71,135.40],[34.72,135.36],
    [34.71,135.32],[34.72,135.29],[34.70,135.24],[34.69,135.21],
    [34.66,135.18],[34.65,135.14],[34.64,135.11],[34.62,135.06],
    [34.62,135.04],[34.63,135.00],[34.65,134.98],[34.66,134.94],
  ]);
  const awaji = [
    [34.60,135.01],[34.57,135.02],[34.54,135.00],[34.51,134.99],
    [34.47,134.95],[34.43,134.91],[34.38,134.90],[34.35,134.91],
    [34.32,134.90],[34.28,134.95],[34.25,134.90],[34.23,134.85],
    [34.20,134.79],[34.19,134.73],[34.23,134.70],[34.24,134.66],
    [34.27,134.68],[34.30,134.67],[34.32,134.72],[34.34,134.74],
    [34.36,134.76],[34.40,134.78],[34.45,134.84],[34.49,134.88],
    [34.53,134.92],[34.57,134.97],
  ];

  // 三国の接点と海岸の外まで延ばした端点。外周は対象国外へ塗り出さない。
  const corners = {
    nw:[36.6,133.6], ne:[36.6,138], se:[33,138], sw:[33,133.6],
    tanbaWest:[34.93,133.6], wakasaWest:[35.57,133.6], wakasaNorth:[36.6,136.40],
    omiEast:[35.44,138], iseNorth:[35.30,138], kiiEast:[33.90,138],
    izumiNorth:[34.54,133.6], izumiSouth:[34.19,133.6],
    harimaTri:[34.95,135.17], harimaSea:[34.58,135.06], baySea:[34.55,135.22],
    kyotoWest:[34.97,135.61], kyotoNorth:[35.31,135.78], kyotoEast:[34.83,136.01],
    kyotoSouth:[34.72,136.04], kizu:[34.76,135.73], yawata:[34.875,135.65],
    tambaNorth:[35.38,135.76], omiWest:[35.39,135.84],
    igaEast:[34.87,136.29], igaSouth:[34.51,136.20],
    sakai:[34.56,135.505], katsuragi:[34.36,135.66], izumiHill:[34.345,135.48],
    yoshinoEast:[34.35,136.11],
    kiso:[35.34,136.72], seto:[35.27,137.135], inabu:[35.25,137.56],
    tenryu:[35.21,137.80], oiHead:[35.30,138.105], oiMouth:[34.77,138.27],
    enshuWest:[34.67,137.50], kinuura:[34.91,136.995], nagashima:[35.05,136.73],
    chitaSea:[34.51,136.78], mikawaBay:[34.49,137.00], enshuSea:[34.43,137.49],
    oiSea:[34.43,138.40], tokaiNE:[36.1,138.65], tokaiNW:[36.1,136.45],
    tokaiWest:[35.33,136.42], tokaiSW:[34.47,136.45], ridgeNorth:[36.1,137.60],
  };
  const lines = {
    'tanbaWest harimaTri':[[34.94,134.84],[34.96,135.05]],
    'harimaTri kyotoWest':[[34.93,135.25],[34.95,135.34],[34.94,135.43],[34.91,135.51],[34.94,135.56]],
    'harimaTri harimaSea':[[34.89,135.16],[34.83,135.13],[34.77,135.12],[34.73,135.11],[34.67,135.10]],
    'kyotoWest kyotoNorth':[[35.04,135.65],[35.10,135.66],[35.15,135.67],[35.20,135.72],[35.25,135.74]],
    'kyotoNorth kyotoEast':[[35.25,135.83],[35.18,135.83],[35.13,135.82],[35.07,135.83],[35.01,135.83],[34.96,135.85],[34.91,135.88],[34.875,135.94]],
    'kyotoEast kyotoSouth':[[34.79,136.02],[34.75,136.045]],
    'kyotoSouth kizu':[[34.72,135.99],[34.74,135.94],[34.72,135.87],[34.72,135.83],[34.74,135.78]],
    'kizu yawata':[[34.79,135.72],[34.82,135.70],[34.85,135.67]],
    'yawata kyotoWest':[[34.90,135.64],[34.94,135.62]],
    'kyotoNorth tambaNorth':[[35.31,135.76],[35.33,135.77]],
    'tambaNorth wakasaWest':[[35.39,135.68],[35.40,135.57],[35.44,135.50],[35.42,135.40],[35.47,135.34]],
    'omiWest wakasaNorth':[[35.43,135.90],[35.45,135.96],[35.48,136.00],[35.53,136.04]],
    'omiWest omiEast':[[35.33,135.92],[35.31,136.03],[35.30,136.18],[35.29,136.25],[35.32,136.35],[35.36,136.43]],
    'kyotoEast igaEast':[[34.85,136.055],[34.87,136.09],[34.89,136.14],[34.87,136.19],[34.90,136.235]],
    'igaEast iseNorth':[[34.97,136.35],[35.03,136.39],[35.09,136.43],[35.16,136.44],[35.22,136.48]],
    'igaEast igaSouth':[[34.82,136.29],[34.76,136.30],[34.70,136.29],[34.64,136.30],[34.59,136.28],[34.55,136.24]],
    'igaSouth kyotoSouth':[[34.55,136.15],[34.57,136.08],[34.63,136.08],[34.68,136.06]],
    'igaSouth yoshinoEast':[[34.47,136.22],[34.45,136.16],[34.41,136.10],[34.39,136.09]],
    'yoshinoEast kiiEast':[[34.29,136.14],[34.27,136.22],[34.30,136.26],[34.23,136.34],[34.19,136.36]],
    'yoshinoEast katsuragi':[[34.29,136.13],[34.23,136.14],[34.16,136.12],[34.08,136.12],[34.03,136.10],[33.99,136.02],[33.94,135.96],[33.91,135.91],[33.88,135.78],[33.90,135.71],[33.87,135.65],[33.91,135.62],[33.98,135.64],[34.06,135.57],[34.13,135.62],[34.18,135.66],[34.21,135.71],[34.27,135.68]],
    'katsuragi kizu':[[34.40,135.68],[34.46,135.69],[34.50,135.67],[34.56,135.70],[34.61,135.69],[34.66,135.71],[34.70,135.70]],
    'yawata sakai':[[34.81,135.63],[34.77,135.60],[34.73,135.56],[34.69,135.55],[34.66,135.52],[34.62,135.53]],
    'sakai izumiNorth':[[34.585,135.46],[34.58,135.39]],
    'sakai izumiHill':[[34.52,135.50],[34.48,135.49],[34.43,135.47],[34.40,135.46],[34.37,135.48]],
    'izumiHill izumiSouth':[[34.33,135.43],[34.31,135.37],[34.31,135.31],[34.29,135.22],[34.28,135.16],[34.27,135.09]],
    'nagashima kiso':[[35.10,136.71],[35.14,136.69],[35.19,136.70],[35.24,136.69],[35.28,136.73]],
    'kiso seto':[[35.36,136.78],[35.37,136.84],[35.39,136.91],[35.41,136.96],[35.37,137.00],[35.36,137.05],[35.32,137.07],[35.30,137.12]],
    'seto kinuura':[[35.23,137.13],[35.19,137.10],[35.15,137.10],[35.12,137.07],[35.08,137.07],[35.05,137.04],[35.02,137.02],[34.98,137.015],[34.95,136.99]],
    'kinuura mikawaBay':[[34.87,136.99],[34.79,136.995],[34.71,137.00],[34.66,136.995]],
    'seto inabu':[[35.27,137.21],[35.24,137.25],[35.26,137.32],[35.24,137.38],[35.27,137.42],[35.25,137.47],[35.28,137.51]],
    'inabu tenryu':[[35.24,137.60],[35.21,137.64],[35.23,137.69],[35.20,137.74],[35.22,137.77]],
    'tenryu enshuWest':[[35.15,137.80],[35.11,137.76],[35.065,137.765],[35.035,137.72],[35.01,137.67],[34.96,137.65],[34.93,137.61],[34.88,137.57],[34.85,137.54],[34.81,137.54],[34.77,137.505],[34.72,137.49]],
    'tenryu oiHead':[[35.21,137.85],[35.24,137.88],[35.26,137.93],[35.24,137.98],[35.27,138.015],[35.28,138.06]],
    'oiHead oiMouth':[[35.24,138.12],[35.20,138.10],[35.16,138.13],[35.12,138.12],[35.08,138.15],[35.04,138.13],[35.00,138.11],[34.96,138.09],[34.91,138.13],[34.88,138.14],[34.84,138.18],[34.80,138.22]],
  };
  const faces = {
    wakasa:'nw wakasaNorth omiWest tambaNorth wakasaWest',
    kitaomi:'wakasaNorth ne omiEast omiWest',
    minamiomi:'omiWest omiEast iseNorth igaEast kyotoEast kyotoNorth tambaNorth',
    tanba:'wakasaWest tambaNorth kyotoNorth kyotoWest harimaTri tanbaWest',
    settsu:'tanbaWest harimaTri kyotoWest yawata sakai izumiNorth',
    yamashiro:'kyotoWest kyotoNorth kyotoEast kyotoSouth kizu yawata',
    iga:'kyotoEast igaEast igaSouth kyotoSouth',
    kawachi:'yawata kizu katsuragi izumiHill sakai',
    izumi:'izumiNorth sakai izumiHill izumiSouth',
    yamato:'kizu kyotoSouth igaSouth yoshinoEast katsuragi',
    ise:'igaEast iseNorth kiiEast yoshinoEast igaSouth',
    kii:'izumiSouth izumiHill katsuragi yoshinoEast kiiEast se sw',
  };
  function facePath(ring, verticesByName = corners, edgesByName = lines) {
    const vertices = ring.split(' ');
    return vertices.flatMap((a, i) => {
      const b = vertices[(i + 1) % vertices.length];
      const line = edgesByName[a + ' ' + b] || (edgesByName[b + ' ' + a] || []).slice().reverse();
      return [verticesByName[a], ...line];
    });
  }
  replaceCoast([33.95,130.92], [35.65,134.85], SETOUCHI.northCoast);
  replaceCoast([34.72,134.80], [33.95,131.05], SETOUCHI.southCoast);
  replaceCoast([35.75,136.02], [35.22,139.12], EAST_COAST.honshu);
  // 熱海・真鶴側から石廊崎、西伊豆、湾奥の沼津、清水を経て大井川側へ戻る。
  replaceCoast([35.22,139.12], [34.9,138.33], [
    [35.18,139.14],[35.15,139.17],[35.14,139.13],[35.10,139.09],
    [35.05,139.08],[35.01,139.10],[34.98,139.09],[34.95,139.13],
    [34.91,139.14],[34.88,139.11],[34.86,139.08],[34.82,139.08],
    [34.78,139.05],[34.74,139.00],[34.70,138.99],[34.68,138.97],
    [34.67,138.94],[34.63,138.91],[34.60,138.85],[34.61,138.81],
    [34.64,138.80],[34.66,138.76],[34.70,138.74],[34.74,138.77],
    [34.78,138.76],[34.82,138.77],[34.85,138.75],[34.90,138.76],
    [34.94,138.79],[34.97,138.76],[35.00,138.79],[35.03,138.78],
    [35.03,138.84],[35.02,138.89],[35.04,138.90],[35.06,138.86],
    [35.09,138.86],[35.11,138.81],[35.13,138.74],[35.14,138.65],
    [35.13,138.58],[35.10,138.55],[35.06,138.52],[35.03,138.50],
    [35.00,138.52],[35.02,138.52],[35.00,138.53],[34.98,138.50],
    [34.96,138.46],[34.93,138.39],
  ]);
  const coastlines = { ...DATA.COAST, honshu:coast, awaji, shikoku:SETOUCHI.shikoku,
    shodo:SETOUCHI.shodo, ...SETOUCHI.islands, kyushu:KYUSHU.coast, ...KYUSHU.islands, ...EAST_COAST.islands };
  const straits = { 'harima-awaji':[34.611,135.025], 'awaji-awa':[34.216,134.645],
    'bizen-sanuki':[34.42,133.95], 'aki-iyo':[34.14,132.82], 'nagato-buzen':[33.935,130.925],
    'echigo-sado':[37.60,138.34], 'boshu-sagami':[35.19,139.77],
    'higo-nishihizen':[32.76,130.48], 'bungo-iyo':[33.33,131.93] };
  const lakes = [biwa, SETOUCHI.shinji, ...EAST_COAST.lakes];
  // 島原半島の日野江城、七尾湾を望む七尾城、佐渡の真野湾側の城を自国の陸に置く。
  const castleSites = {nishihizen:[32.665,130.25], noto:[37.01,136.99], sado:[38.01,138.365]};
  function castlePoint(province) {
    return castleSites[province.id] || [province.lat,province.lon];
  }
  const group = new Set(Object.keys(faces).map(id => E.PI[id]));
  // 湖の北端に接する湖北の稜線。現行図では越前の色がこの線を越える。
  const kohoku = [[35.48,135.96],[35.55,136.04],[35.56,136.13],
    [35.54,136.19],[35.56,136.23],[35.54,136.30],[35.53,136.36],
    [35.50,136.39],[35.47,136.40],[35.43,136.44],[35.39,136.43],
    [35.36,136.47],[35.335,136.45],[35.315,136.40],[35.32,136.36],
    [35.36,136.29],[35.41,136.07]];
  // 若狭湾東部の敦賀半島西岸から、熊川・遠敷を経て丹後との海辺の境まで。
  const wakasa = [[35.59,135.46],[35.63,135.48],[35.77,136.01],[35.77,136.05],
    [35.73,136.06],[35.69,136.064],[35.65,136.065],[35.62,136.066],[35.58,136.03],
    [35.54,136.00],[35.50,135.95],[35.49,135.91],[35.46,135.88],
    [35.42,135.85],[35.39,135.80],[35.35,135.76],[35.34,135.69],
    [35.35,135.62],[35.36,135.56],[35.40,135.50],[35.44,135.47],
    [35.46,135.44],[35.50,135.47],[35.54,135.45]];
  const tokaido = {
    owari:'kiso seto kinuura mikawaBay chitaSea nagashima',
    mikawa:'seto inabu tenryu enshuWest enshuSea mikawaBay kinuura',
    totomi:'tenryu oiHead oiMouth oiSea enshuSea enshuWest',
  };
  // 三国内に残る旧図の張り出しを、それぞれ国境の向こうの国に戻す。
  const outside = {
    ise:'tokaiWest kiso nagashima chitaSea tokaiSW',
    mino:'tokaiWest tokaiNW ridgeNorth inabu seto kiso',
    minamishinano:'inabu ridgeNorth tokaiNE oiHead tenryu',
    suruga:'oiHead tokaiNE oiSea oiMouth',
  };
  function paint(idx, land, width, height, scale, islandIds) {
    const patches = Object.entries(faces).map(([id,ring]) => [id, facePath(ring), group]);
    // 播磨との国境を丹波との三国境から明石側の海岸へ下ろす。
    patches.push(['harima',facePath('tanbaWest harimaTri harimaSea izumiNorth'),new Set([E.PI.settsu])]);
    patches.push(['settsu',facePath('harimaTri kyotoWest yawata sakai baySea harimaSea'),new Set([E.PI.harima])]);
    patches.push(['kitaomi', kohoku, new Set([E.PI.echizen,E.PI.mino])]);
    const three = new Set(Object.keys(tokaido).map(id => E.PI[id]));
    const neighbors = new Set([...three, ...Object.keys(outside).map(id => E.PI[id])]);
    for (const [id, ring] of Object.entries(outside)) patches.push([id, facePath(ring), three]);
    for (const [id, ring] of Object.entries(tokaido)) patches.push([id, facePath(ring), neighbors]);
    for (const region of [SETOUCHI, KYUSHU, EAST_BORDERS]) {
      for (const [island, provinces] of Object.entries(region.faces)) {
        const eligible = new Set(Object.keys(provinces).map(id => E.PI[id]));
        for (const [id, ring] of Object.entries(provinces)) {
          patches.push([id, facePath(ring, region.corners, region.lines), eligible, islandIds[island]]);
        }
      }
    }
    patches.push(['wakasa',wakasa,new Set(['wakasa','echizen','kitaomi','tanba','tango'].map(id=>E.PI[id]))]);
    for (const [id, polygon, eligible, island = islandIds.honshu] of patches) {
      const points = outline(polygon).map(([x,y]) => [x * scale, y * scale]);
      const yMin = Math.max(0, Math.ceil(Math.min(...points.map(p => p[1]))));
      const yMax = Math.min(height, Math.ceil(Math.max(...points.map(p => p[1]))));
      for (let y = yMin; y < yMax; y++) {
        const cuts = [];
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [ax,ay] = points[j], [bx,by] = points[i];
          if ((ay > y) !== (by > y)) cuts.push(ax + (y - ay) * (bx - ax) / (by - ay));
        }
        cuts.sort((a,b) => a-b);
        for (let k = 0; k + 1 < cuts.length; k += 2) {
          const end = y * width + Math.min(width, Math.ceil(cuts[k + 1]));
          for (let n = y * width + Math.max(0, Math.ceil(cuts[k])); n < end; n++) {
            if (land[n] === island && eligible.has(idx[n])) idx[n] = E.PI[id];
          }
        }
      }
    }
  }
  // 城から国境までの道筋。湖岸の曲がりは表示用で、歩数は元の経路に従う。
  const bends = new Map();
  function road(castle, border, via) {
    const a = E.nodeOf(castle), b = E.nodeOf(border);
    const points = via.map(([lat,lon]) => project(lat,lon));
    bends.set(a * E.N + b, points);
    bends.set(b * E.N + a, points.slice().reverse());
  }
  road('minamiomi', 'yamashiro-minamiomi', [[35.07,136.08],[35.015,135.98],[34.99,135.93],[34.99,135.88]]);
  road('kitaomi', 'wakasa-kitaomi', [[35.50,136.24],[35.515,136.18],[35.515,136.09],[35.495,136.025]]);
  road('ise', 'ise-owari', [[34.78,136.49],[34.88,136.54],[34.96,136.59],[35.03,136.63],[35.08,136.69]]);
  road('settsu', 'izumi-settsu', [[34.73,135.465],[34.66,135.48],[34.60,135.47]]);
  road('izumi', 'izumi-settsu', [[34.43,135.36],[34.49,135.405],[34.55,135.46],[34.58,135.46]]);
  road('tango', 'tango-wakasa', [[35.51,135.18],[35.47,135.24],[35.43,135.31],[35.42,135.37]]);
  road('wakasa', 'tango-wakasa', [[35.47,135.76],[35.45,135.67],[35.46,135.58],[35.44,135.49]]);
  road('wakasa', 'echizen-wakasa', [[35.47,135.82],[35.48,135.90],[35.53,135.97],[35.58,136.03]]);
  road('echizen', 'echizen-wakasa', [[35.83,136.16],[35.74,136.13],[35.67,136.11],[35.62,136.10],[35.59,136.07]]);
  // 高知から幡多への街道は土佐湾の西岸を回る。
  road('tosa', 'hatatosa-tosa', [[33.56,133.45],[33.49,133.32],[33.45,133.19],[33.38,133.12],[33.25,133.10]]);
  // 湾・湖を回る陸路。線の屈曲を道のマスとして数えない。
  const tokaidoBay = [[35.06,138.45],[35.10,138.49],[35.15,138.56],[35.18,138.67],[35.16,138.77]];
  road('suruga', 'izu-suruga', tokaidoBay);
  road('suruga', 'sagami-suruga', [...tokaidoBay,[35.21,138.88]]);
  road('sagami', 'izu-sagami', [[35.31,139.15],[35.29,139.08],[35.22,139.04],[35.14,139.03]]);
  road('echigo', 'echigo-kitaechigo', [[37.14,138.35],[37.19,138.46],[37.27,138.57],[37.31,138.71]]);
  road('hitachi', 'hitachi-shimousa', [[36.25,140.34],[36.17,140.28],[36.10,140.19],[36.04,140.22],[35.98,140.31]]);
  road('iyo', 'iyo-sanuki', [[33.85,133.00],[33.88,133.16],[33.93,133.43],[33.95,133.55],[33.98,133.63]]);
  road('osumi', 'osumi-satsuma', [[31.48,130.87],[31.62,130.83],[31.70,130.81],[31.76,130.77]]);
  road('nishihizen', 'hizen-nishihizen', [[32.73,130.27],[32.80,130.22],[32.824,130.15],[32.837,130.06],[32.91,130.08],[32.98,130.12]]);
  road('akita', 'akita-shonai', [[39.97,140.10],[39.78,140.12],[39.62,140.10],[39.46,140.08],[39.33,140.03],[39.20,139.97]]);
  road('kitaechigo', 'kitaechigo-shonai', [[38.07,139.34],[38.19,139.49],[38.31,139.53],[38.42,139.55]]);
  road('aizu', 'aizu-tamura', [[37.52,139.99],[37.56,140.06],[37.56,140.14],[37.53,140.17],[37.49,140.18],[37.44,140.18]]);
  const straight = [];
  function between(a,b) {
    return bends.get(a * E.N + b) || straight;
  }
  const geography = { coastlines, lakes, straits, project, outline, paint, between, castlePoint,
    islandProvince:{...SETOUCHI.islandProvince, notojima:'noto', hirado:'nishihizen', nagashima:'satsuma', sakurajima:'osumi'},
    outerIslands:{shimoTsushima:'tsushima', nakadori:'goto', hisaka:'goto', kamiAmakusa:'amakusa'} };
  if (node) module.exports = geography;
  else root.SG.GEO = geography;
})(typeof window !== 'undefined' ? window : globalThis);
