/* 賽駆け — 地図・大名データ
   座標は緯度経度（おおよそ）。画面座標への変換は mapgen.js が行う。
   k = 石高の格（1〜3）、d = 城の守り（1〜3）、g = 中立時の守備兵 */
(function (root) {
  'use strict';

  // 国（令制国。信濃・近江・越後は遊びのために二分割）
  const PROV = [
    // 中国
    { id: 'suo', n: '周防', c: '高嶺城', lat: 34.18, lon: 131.47, k: 2, d: 1, g: 3, x: [[34.25, 131.05], [34.03, 131.85]] },
    { id: 'iwami', n: '石見', c: '三本松城', lat: 34.92, lon: 132.22, k: 1, d: 1, g: 2, x: [[34.62, 131.82], [35.08, 132.48]] },
    { id: 'aki', n: '安芸', c: '吉田郡山城', lat: 34.67, lon: 132.71, k: 2, d: 2, g: 3, x: [[34.38, 132.45], [34.45, 132.95]] },
    { id: 'izumo', n: '出雲', c: '月山富田城', lat: 35.37, lon: 133.18, k: 2, d: 2, g: 3, x: [[35.36, 132.82], [35.18, 133.0]] },
    { id: 'bingo', n: '備後', c: '神辺城', lat: 34.62, lon: 133.18, k: 2, d: 1, g: 3, x: [[34.88, 133.02]] },
    { id: 'hoki', n: '伯耆', c: '羽衣石城', lat: 35.40, lon: 133.72, k: 1, d: 1, g: 2, x: [[35.22, 133.45]] },
    { id: 'bitchu', n: '備中', c: '備中松山城', lat: 34.80, lon: 133.54, k: 2, d: 1, g: 3, x: [[34.55, 133.6]] },
    { id: 'mimasaka', n: '美作', c: '津山', lat: 35.13, lon: 133.98, k: 1, d: 1, g: 2, x: [] },
    { id: 'bizen', n: '備前', c: '天神山城', lat: 34.70, lon: 134.16, k: 2, d: 1, g: 3, x: [[34.6, 133.9]] },
    { id: 'inaba', n: '因幡', c: '鳥取城', lat: 35.47, lon: 134.22, k: 1, d: 1, g: 2, x: [[35.3, 134.35]] },
    { id: 'tajima', n: '但馬', c: '此隅山城', lat: 35.46, lon: 134.80, k: 1, d: 1, g: 2, x: [[35.58, 134.7]] },
    { id: 'harima', n: '播磨', c: '置塩城', lat: 34.88, lon: 134.68, k: 3, d: 1, g: 4, x: [[34.75, 134.45], [35.02, 134.9]] },
    // 近畿
    { id: 'tango', n: '丹後', c: '建部山城', lat: 35.58, lon: 135.16, k: 1, d: 1, g: 2, x: [] },
    { id: 'tanba', n: '丹波', c: '八上城', lat: 35.11, lon: 135.36, k: 2, d: 2, g: 3, x: [[35.3, 135.55], [35.05, 135.08]] },
    { id: 'wakasa', n: '若狭', c: '後瀬山城', lat: 35.49, lon: 135.78, k: 1, d: 1, g: 2, x: [[35.55, 135.58], [35.58, 135.95]] },
    { id: 'settsu', n: '摂津', c: '芥川山城', lat: 34.78, lon: 135.42, k: 2, d: 1, g: 3, x: [] },
    { id: 'kawachi', n: '河内', c: '飯盛山城', lat: 34.64, lon: 135.67, k: 2, d: 2, g: 3, x: [] },
    { id: 'izumi', n: '和泉', c: '堺', lat: 34.36, lon: 135.32, k: 2, d: 1, g: 3, x: [] },
    { id: 'yamato', n: '大和', c: '信貴山城', lat: 34.52, lon: 135.88, k: 2, d: 2, g: 3, x: [[34.3, 135.9]] },
    { id: 'kii', n: '紀伊', c: '雑賀', lat: 34.06, lon: 135.45, k: 2, d: 1, g: 4, x: [[33.78, 135.42], [33.78, 135.95], [34.08, 135.85]] },
    { id: 'yamashiro', n: '山城', c: '京', lat: 35.01, lon: 135.76, k: 2, d: 1, g: 3, x: [], kyo: true },
    { id: 'kitaomi', n: '北近江', c: '小谷城', lat: 35.46, lon: 136.27, k: 2, d: 2, g: 4, x: [] },
    { id: 'minamiomi', n: '南近江', c: '観音寺城', lat: 35.12, lon: 136.15, k: 2, d: 2, g: 5, x: [] },
    { id: 'iga', n: '伊賀', c: '伊賀上野', lat: 34.77, lon: 136.14, k: 1, d: 1, g: 3, x: [] },
    { id: 'ise', n: '伊勢', c: '霧山城', lat: 34.66, lon: 136.45, k: 3, d: 1, g: 4, x: [[35.02, 136.6], [34.38, 136.68], [34.28, 136.4]] },
    // 東海・甲信
    { id: 'owari', n: '尾張', c: '清洲城', lat: 35.20, lon: 136.88, k: 3, d: 1, g: 3, x: [] },
    { id: 'mino', n: '美濃', c: '稲葉山城', lat: 35.48, lon: 136.78, k: 3, d: 2, g: 5, x: [[35.7, 136.95], [35.38, 137.2]] },
    { id: 'mikawa', n: '三河', c: '岡崎城', lat: 34.95, lon: 137.20, k: 2, d: 1, g: 3, x: [[35.15, 137.45]] },
    { id: 'totomi', n: '遠江', c: '曳馬城', lat: 34.80, lon: 137.85, k: 2, d: 1, g: 3, x: [[35.02, 137.85]] },
    { id: 'suruga', n: '駿河', c: '駿府', lat: 35.02, lon: 138.40, k: 2, d: 1, g: 3, x: [[35.28, 138.55]] },
    { id: 'izu', n: '伊豆', c: '韮山城', lat: 34.92, lon: 138.95, k: 1, d: 2, g: 2, x: [] },
    { id: 'hida', n: '飛騨', c: '松倉城', lat: 36.15, lon: 137.25, k: 1, d: 1, g: 2, x: [[36.35, 136.98], [35.95, 137.35]] },
    { id: 'kai', n: '甲斐', c: '躑躅ヶ崎館', lat: 35.67, lon: 138.58, k: 1, d: 2, g: 2, x: [[35.55, 138.85]] },
    { id: 'minamishinano', n: '南信濃', c: '高遠城', lat: 35.90, lon: 137.98, k: 2, d: 1, g: 3, x: [[35.55, 137.82], [36.2, 137.95]] },
    { id: 'kitashinano', n: '北信濃', c: '海津城', lat: 36.56, lon: 138.20, k: 2, d: 1, g: 4, x: [[36.3, 138.5], [36.8, 138.35]] },
    // 北陸
    { id: 'echizen', n: '越前', c: '一乗谷城', lat: 35.98, lon: 136.27, k: 2, d: 2, g: 3, x: [[35.75, 136.08]] },
    { id: 'kaga', n: '加賀', c: '尾山御坊', lat: 36.47, lon: 136.60, k: 2, d: 1, g: 5, x: [[36.25, 136.45]] },
    { id: 'noto', n: '能登', c: '七尾城', lat: 37.05, lon: 136.95, k: 1, d: 2, g: 2, x: [[37.3, 136.85], [37.4, 137.15]] },
    { id: 'etchu', n: '越中', c: '富山城', lat: 36.68, lon: 137.25, k: 2, d: 1, g: 3, x: [[36.75, 137.62]] },
    { id: 'echigo', n: '越後', c: '春日山城', lat: 37.15, lon: 138.25, k: 2, d: 2, g: 3, x: [[37.32, 138.6], [37.0, 138.7]] },
    { id: 'kitaechigo', n: '北越後', c: '新発田城', lat: 37.88, lon: 139.20, k: 2, d: 1, g: 3, x: [[37.6, 139.0], [38.15, 139.48]] },
    // 関東
    { id: 'kozuke', n: '上野', c: '箕輪城', lat: 36.40, lon: 139.00, k: 2, d: 1, g: 3, x: [[36.68, 139.02]] },
    { id: 'musashi', n: '武蔵', c: '河越城', lat: 35.90, lon: 139.45, k: 3, d: 1, g: 3, x: [[35.65, 139.65], [36.1, 139.25]] },
    { id: 'sagami', n: '相模', c: '小田原城', lat: 35.30, lon: 139.22, k: 2, d: 3, g: 3, x: [] },
    { id: 'shimotsuke', n: '下野', c: '宇都宮城', lat: 36.58, lon: 139.82, k: 2, d: 1, g: 3, x: [[36.85, 139.72]] },
    { id: 'hitachi', n: '常陸', c: '太田城', lat: 36.45, lon: 140.38, k: 3, d: 1, g: 4, x: [[36.78, 140.5]] },
    { id: 'shimousa', n: '下総', c: '臼井城', lat: 35.85, lon: 140.15, k: 2, d: 1, g: 3, x: [[36.08, 139.85]] },
    { id: 'kazusa', n: '上総', c: '久留里城', lat: 35.38, lon: 140.15, k: 2, d: 1, g: 3, x: [] },
    { id: 'awa', n: '安房', c: '稲村城', lat: 35.02, lon: 139.95, k: 1, d: 1, g: 2, x: [] },
  ];

  // 国境（R=街道 1歩, P=峠 2歩, S=海路 2歩）
  const EDGES = `
suo aki R; suo iwami P; iwami aki P; iwami izumo R; aki bingo R; bingo izumo P; izumo hoki R;
bingo bitchu R; hoki mimasaka P; hoki inaba R; hoki bitchu P; bitchu bizen R; bitchu mimasaka P;
mimasaka bizen R; mimasaka inaba P; mimasaka harima P; bizen harima R; inaba tajima R; tajima harima P;
tajima tango R; tajima tanba P; harima settsu R; harima tanba P; tango tanba R; tango wakasa R;
tanba wakasa P; tanba settsu R; tanba yamashiro R; wakasa echizen R; wakasa kitaomi P;
settsu yamashiro R; settsu kawachi R; settsu izumi R; kawachi izumi R; kawachi yamato P;
kawachi yamashiro R; kawachi kii P; izumi kii P; yamato yamashiro R; yamato kii P; yamato iga P;
yamato ise P; yamashiro minamiomi R; minamiomi kitaomi R; minamiomi iga P; minamiomi ise P;
kitaomi mino R; kitaomi echizen P; iga ise P; ise owari R; ise mino R; ise kii P; owari mino R;
owari mikawa R; mino hida P; mino minamishinano P; mino echizen P; mikawa totomi R;
mikawa minamishinano P; totomi suruga R; totomi minamishinano P; suruga izu R; suruga kai P;
suruga sagami P; izu sagami P; kai minamishinano R; kai sagami P; kai musashi P;
minamishinano kitashinano R; minamishinano hida P; hida etchu P; kitashinano echigo R;
kitashinano kozuke P; echizen kaga R; kaga noto R; kaga etchu P; noto etchu R; etchu echigo P;
echigo kitaechigo R; echigo kozuke P; sagami musashi R; musashi kozuke R; musashi shimotsuke R;
musashi shimousa R; kozuke shimotsuke R; shimotsuke hitachi R; shimousa hitachi R;
shimousa kazusa R; kazusa awa R; sagami awa S`;

  // 峠の名前（雰囲気づけ。無いものは「〇〇境」）
  const PASS_NAMES = {
    'kitaomi-mino': '関ヶ原', 'yamashiro-minamiomi': '逢坂', 'minamiomi-ise': '鈴鹿峠',
    'izu-sagami': '箱根', 'suruga-sagami': '足柄峠', 'kitashinano-kozuke': '碓氷峠',
    'echigo-kozuke': '三国峠', 'etchu-echigo': '親不知', 'kaga-etchu': '倶利伽羅峠',
    'kitaomi-echizen': '木ノ芽峠', 'totomi-minamishinano': '青崩峠', 'tanba-yamashiro': '老ノ坂',
    'kawachi-yamato': '暗峠', 'sagami-awa': '浦賀水道', 'owari-mikawa': '桶狭間',
    'kai-musashi': '雁坂峠', 'suruga-kai': '中道', 'kitashinano-minamishinano': '善光寺道',
    'kitashinano-echigo': '北国街道', 'mino-minamishinano': '神坂峠', 'hida-etchu': '越中街道',
    'ise-owari': '長島', 'kawachi-kii': '紀見峠', 'izumi-kii': '雄ノ山峠', 'settsu-harima': '西国街道',
  };

  // 大名（11家。すべて選べる）
  const CLANS = [
    {
      id: 'oda', n: '織田', who: '織田信長', mon: '織', col: '#d9a300', lvl: 3,
      trait: 'reroll', tn: '天下布武', td: '毎季1度、好きな賽を1つ振り直せる',
      start: ['owari'], armies: [['owari', 7], ['owari-mikawa', 6]],
      blurb: '尾張一国の小勢。東から今川の大軍が迫り、北には斎藤の美濃。',
    },
    {
      id: 'imagawa', n: '今川', who: '今川義元', mon: '今', col: '#7b4ba8', lvl: 2,
      trait: 'bigarmy', tn: '海道一の弓取り', td: '新しく出陣する軍勢の兵が多い（+2）',
      start: ['suruga', 'totomi', 'mikawa'], armies: [['mikawa', 7], ['totomi', 6], ['suruga', 5]],
      blurb: '東海道三国を治める大大名。上洛の途にある。',
    },
    {
      id: 'takeda', n: '武田', who: '武田信玄', mon: '武', col: '#c7302b', lvl: 3,
      trait: 'mountain', tn: '風林火山', td: '峠を平地と同じ1歩で越える（冬も）',
      start: ['kai', 'minamishinano'], armies: [['kai', 7], ['minamishinano', 7]],
      blurb: '山国の騎馬軍団。北信濃をめぐり上杉と争う。',
    },
    {
      id: 'uesugi', n: '上杉', who: '上杉謙信', mon: '上', col: '#2950a8', lvl: 1,
      trait: 'charge', tn: '軍神', td: '攻めるとき、つねに+1',
      start: ['echigo', 'kitaechigo'], armies: [['echigo', 7], ['kitaechigo', 5]],
      blurb: '越後の龍。義のために関東・信濃へ出陣する。',
    },
    {
      id: 'hojo', n: '北条', who: '北条氏康', mon: '北', col: '#2b9150', lvl: 1,
      trait: 'fortress', tn: '難攻不落', td: '自国の城の守りがすべて+1',
      start: ['sagami', 'izu', 'musashi'], armies: [['musashi', 6], ['sagami', 6], ['izu', 4]],
      blurb: '小田原を本拠に関東の覇を狙う。',
    },
    {
      id: 'asakura', n: '朝倉', who: '朝倉義景', mon: '朝', col: '#6e7e1c', lvl: 2,
      trait: 'meimon', tn: '名門の城下', td: '自国の守備兵の上限+1、毎季2ずつ戻る',
      start: ['echizen'], armies: [['echizen', 7], ['echizen-kaga', 5]],
      blurb: '一乗谷に栄える名門。北には一向一揆、南には浅井・六角の近江。',
    },
    {
      id: 'miyoshi', n: '三好', who: '三好長慶', mon: '三', col: '#b8467f', lvl: 1,
      trait: 'rich', tn: '畿内の富', td: '休んだ軍勢の兵の戻りが+1',
      start: ['settsu', 'yamashiro', 'kawachi'], armies: [['yamashiro', 6], ['settsu', 6], ['kawachi', 5]],
      blurb: '京を押さえる天下人。ただし四方から狙われる。',
    },
    {
      id: 'mori', n: '毛利', who: '毛利元就', mon: '毛', col: '#1d7070', lvl: 1,
      trait: 'arrows', tn: '三本の矢', td: '隣の味方の加勢が+2ではなく+3',
      start: ['aki', 'suo'], armies: [['aki', 7], ['suo', 5]],
      blurb: '謀神。尼子を下し、西国の覇者を目指す。',
    },
    {
      id: 'amago', n: '尼子', who: '尼子晴久', mon: '尼', col: '#d9734e', lvl: 2,
      trait: 'plunder', tn: '山陰の雄', td: '城を落とした軍勢の兵が+1',
      start: ['izumo', 'iwami', 'hoki'], armies: [['izumo', 6], ['iwami', 5], ['hoki', 4]],
      blurb: '八か国の守護。毛利の台頭を阻めるか。',
    },
  ];

  // 海岸線（緯度, 経度）。本州は南東北の一部まで含む
  const COAST = {
    honshu: [[33.95,130.92],[34.1,130.88],[34.3,130.86],[34.38,130.95],[34.42,131.2],[34.43,131.4],[34.55,131.55],[34.66,131.7],[34.7,131.85],[34.85,132.0],[34.95,132.13],[35.05,132.28],[35.15,132.42],[35.25,132.55],[35.4,132.63],[35.47,132.7],[35.53,132.95],[35.57,133.2],[35.55,133.32],[35.47,133.3],[35.43,133.38],[35.5,133.6],[35.52,133.85],[35.53,134.05],[35.55,134.25],[35.6,134.45],[35.63,134.65],[35.65,134.85],[35.7,135.05],[35.78,135.22],[35.68,135.28],[35.55,135.2],[35.52,135.32],[35.49,135.42],[35.53,135.55],[35.5,135.72],[35.58,135.9],[35.65,136.05],[35.75,136.02],[35.98,135.96],[36.1,136.08],[36.22,136.15],[36.4,136.4],[36.6,136.6],[36.75,136.72],[36.9,136.77],[37.1,136.73],[37.29,136.77],[37.4,136.9],[37.48,137.1],[37.53,137.35],[37.42,137.3],[37.3,137.18],[37.15,137.05],[37.05,136.97],[36.92,137.0],[36.8,137.05],[36.76,137.22],[36.82,137.4],[36.95,137.65],[37.03,137.85],[37.13,138.1],[37.2,138.25],[37.37,138.55],[37.55,138.72],[37.7,138.85],[37.92,139.05],[38.05,139.25],[38.22,139.45],[38.45,139.55],[38.9,139.75],[38.9,141.8],[38.3,141.1],[37.85,140.95],[37.4,141.03],[37.05,140.92],[36.9,140.8],[36.75,140.72],[36.55,140.65],[36.35,140.58],[36.1,140.6],[35.95,140.7],[35.72,140.87],[35.65,140.7],[35.5,140.45],[35.37,140.4],[35.15,140.32],[35.1,140.1],[34.95,139.95],[34.9,139.85],[35.0,139.82],[35.15,139.83],[35.3,139.8],[35.38,139.92],[35.55,140.05],[35.65,140.05],[35.69,139.95],[35.66,139.78],[35.53,139.72],[35.45,139.65],[35.3,139.68],[35.14,139.62],[35.25,139.55],[35.3,139.45],[35.28,139.25],[35.22,139.12],[35.1,139.08],[34.97,139.12],[34.82,139.05],[34.68,138.97],[34.6,138.85],[34.7,138.75],[34.85,138.76],[34.98,138.78],[35.1,138.86],[35.13,138.65],[35.05,138.5],[34.9,138.33],[34.75,138.27],[34.6,138.22],[34.65,138.0],[34.68,137.75],[34.7,137.55],[34.62,137.3],[34.58,137.02],[34.64,137.08],[34.7,137.25],[34.76,137.33],[34.82,137.22],[34.86,137.05],[34.8,136.98],[34.69,136.97],[34.78,136.87],[34.92,136.83],[35.04,136.84],[35.07,136.76],[35.05,136.69],[34.96,136.63],[34.85,136.58],[34.72,136.52],[34.58,136.55],[34.5,136.72],[34.48,136.85],[34.38,136.9],[34.28,136.9],[34.25,136.75],[34.25,136.55],[34.15,136.35],[34.07,136.2],[33.88,136.1],[33.72,135.99],[33.55,135.88],[33.44,135.76],[33.5,135.55],[33.62,135.42],[33.73,135.37],[33.88,135.15],[34.03,135.18],[34.15,135.1],[34.23,135.15],[34.33,135.25],[34.46,135.37],[34.57,135.45],[34.68,135.43],[34.7,135.3],[34.68,135.18],[34.64,135.0],[34.72,134.8],[34.75,134.6],[34.73,134.39],[34.65,134.2],[34.61,134.15],[34.55,134.0],[34.48,133.85],[34.5,133.65],[34.48,133.5],[34.42,133.38],[34.4,133.2],[34.4,133.05],[34.34,132.92],[34.23,132.58],[34.3,132.45],[34.25,132.3],[34.17,132.22],[34.0,132.12],[33.95,131.95],[34.05,131.8],[34.03,131.57],[33.98,131.4],[33.95,131.25],[33.95,131.05]],
    shikoku: [[33.34,132.02],[33.4,132.3],[33.5,132.4],[33.65,132.55],[33.85,132.7],[34.03,132.85],[34.08,133.0],[33.95,133.2],[33.97,133.35],[34.12,133.62],[34.25,133.75],[34.3,133.85],[34.35,134.05],[34.27,134.25],[34.23,134.45],[34.2,134.62],[34.07,134.6],[33.9,134.72],[33.75,134.58],[33.55,134.35],[33.25,134.18],[33.45,133.95],[33.52,133.6],[33.4,133.3],[33.2,133.15],[32.95,133.05],[32.72,133.02],[32.8,132.8],[32.92,132.68],[33.1,132.45],[33.22,132.5],[33.3,132.3]],
    kyushu: [[33.95,130.96],[33.9,130.75],[33.85,130.45],[33.7,130.3],[33.5,130.0],[32.5,129.8],[32.0,130.5],[32.5,131.6],[32.95,131.9],[33.25,131.88],[33.28,131.5],[33.45,131.7],[33.62,131.65],[33.7,131.2],[33.8,131.0]],
    awaji: [[34.6,135.0],[34.45,134.98],[34.33,134.92],[34.22,134.82],[34.25,134.68],[34.4,134.72],[34.52,134.88]],
    sado: [[38.32,138.5],[38.2,138.55],[38.05,138.52],[37.95,138.5],[37.82,138.32],[37.86,138.22],[38.0,138.3],[38.08,138.25],[38.22,138.32],[38.3,138.42]],
  };
  const LAKE = [[35.52,136.15],[35.47,136.22],[35.38,136.26],[35.28,136.18],[35.18,136.08],[35.08,135.98],[35.0,135.88],[35.05,135.86],[35.15,135.93],[35.27,136.0],[35.38,136.02],[35.48,136.05]];

  // 遊べない陸地（色だけ）
  const OUTER = [
    { n: '九州', isl: 'kyushu', pts: [[33.6, 130.7], [33.1, 131.4]] },
    { n: '四国', isl: 'shikoku', pts: [[33.75, 132.85], [34.15, 133.95], [33.9, 134.4], [33.45, 133.35], [33.0, 132.85]] },
    { n: '淡路', isl: 'awaji', pts: [[34.4, 134.85]] },
    { n: '佐渡', isl: 'sado', pts: [[38.05, 138.4]] },
    { n: '奥羽', isl: 'honshu', pts: [[37.45, 140.2], [37.1, 140.6], [38.3, 140.1], [37.7, 139.85], [38.4, 139.75], [38.2, 140.8]] },
  ];

  // 山がちな国（墨の山を多めに描く）
  const MOUNTAIN = { hida: 1, kai: 0.8, minamishinano: 1, kitashinano: 0.8, kozuke: 0.5, mimasaka: 0.6, tanba: 0.5, kii: 0.7, iga: 0.4, echigo: 0.4, iwami: 0.5, hoki: 0.4, yamato: 0.4, etchu: 0.4, izu: 0.3, suruga: 0.3, mino: 0.3, echizen: 0.4, kaga: 0.3, bingo: 0.3, aki: 0.3, tajima: 0.5, inaba: 0.3, bitchu: 0.3, wakasa: 0.3, totomi: 0.3, mikawa: 0.2, kitaechigo: 0.3, shimotsuke: 0.3 };

  const RULES = {
    maxTurn: 40,          // 永禄三年春〜永禄十二年冬
    winProv: 18,          // 京を含むこの数の国で天下布武
    armyMax: 10,
    newArmy: 4,
    momentumCap: 6,
    support: 2,
    passCost: 2, seaCost: 2, winterExtra: 1,
    passDefense: 1,
    garBonus: 0, garMul: 1, defBonus: 0, capGar: 1, capitalDef: 1, siegeAdj: 1, garWithArmy: 0, healCastle: 1, healK: 0.5, healField: 1, slotBase: 2, slotDiv: 3, slotMax: 6, lastStand: 2,
    coalitionMin: 12, coalitionRatio: 1.5,
  };

  const DATA = { PROV, EDGES, PASS_NAMES, CLANS, COAST, LAKE, OUTER, MOUNTAIN, RULES };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else { root.SG = root.SG || {}; root.SG.DATA = DATA; }
})(typeof window !== 'undefined' ? window : globalThis);
