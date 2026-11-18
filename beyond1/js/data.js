/* 戦国すごろく全国版 — 地図・大名データ
   座標は緯度経度（おおよそ）。画面座標への変換は mapgen.js が行う。
   k = 石高（1 = 10万石の目安。開墾で増える）、d = 城の守り（1〜3）、r = 地方、x = 国の形を決める補助点 */
(function (root) {
  'use strict';

  // 国（令制国を基本に、大きな国や陸奥・出羽は遊びのために分割）
  const PROV = [
    // 中国
    { id: 'nagato', n: '長門', c: '勝山城', lat: 34.2, lon: 131.08, k: 1, d: 1, r: 'chugoku', x: [[34.38, 131.4]] },
    { id: 'suo', n: '周防', c: '高嶺城', lat: 34.18, lon: 131.52, k: 2, d: 1, r: 'chugoku', x: [[34.03, 131.85], [34.1, 132.05]] },
    { id: 'iwami', n: '石見', c: '山吹城', lat: 34.92, lon: 132.22, k: 1, d: 1, r: 'chugoku', x: [[34.62, 131.82], [35.08, 132.48]] },
    { id: 'aki', n: '安芸', c: '吉田郡山城', lat: 34.67, lon: 132.71, k: 2, d: 2, r: 'chugoku', x: [[34.38, 132.45], [34.45, 132.95]] },
    { id: 'izumo', n: '出雲', c: '月山富田城', lat: 35.37, lon: 133.18, k: 2, d: 2, r: 'chugoku', x: [[35.36, 132.82], [35.18, 133.0]] },
    { id: 'bingo', n: '備後', c: '神辺城', lat: 34.62, lon: 133.18, k: 2, d: 1, r: 'chugoku', x: [[34.88, 133.02]] },
    { id: 'hoki', n: '伯耆', c: '羽衣石城', lat: 35.42, lon: 133.62, k: 1, d: 1, r: 'chugoku', x: [[35.22, 133.45]] },
    { id: 'bitchu', n: '備中', c: '備中松山城', lat: 34.8, lon: 133.54, k: 2, d: 2, r: 'chugoku', x: [[34.55, 133.6]] },
    { id: 'mimasaka', n: '美作', c: '高田城', lat: 35.08, lon: 134.02, k: 2, d: 1, r: 'chugoku', x: [] },
    { id: 'bizen', n: '備前', c: '天神山城', lat: 34.7, lon: 134.16, k: 2, d: 1, r: 'chugoku', x: [[34.6, 133.9]] },
    { id: 'inaba', n: '因幡', c: '鳥取城', lat: 35.47, lon: 134.22, k: 1, d: 1, r: 'chugoku', x: [[35.3, 134.35]] },
    { id: 'tajima', n: '但馬', c: '此隅山城', lat: 35.46, lon: 134.8, k: 1, d: 1, r: 'chugoku', x: [[35.58, 134.7], [35.27, 134.74]] },
    { id: 'harima', n: '播磨', c: '置塩城', lat: 34.88, lon: 134.68, k: 4, d: 1, r: 'chugoku', x: [[34.75, 134.45], [35.02, 134.9]] },
    // 近畿
    { id: 'tango', n: '丹後', c: '建部山城', lat: 35.58, lon: 135.16, k: 1, d: 1, r: 'kinki', x: [[35.48, 135.36]] },
    { id: 'tanba', n: '丹波', c: '八上城', lat: 35.11, lon: 135.36, k: 3, d: 2, r: 'kinki', x: [[35.24, 135.5], [35.05, 135.08]] },
    { id: 'wakasa', n: '若狭', c: '後瀬山城', lat: 35.49, lon: 135.78, k: 1, d: 1, r: 'kinki', x: [[35.5, 135.52], [35.58, 135.95]] },
    { id: 'settsu', n: '摂津', c: '芥川山城', lat: 34.78, lon: 135.42, k: 4, d: 2, r: 'kinki', x: [] },
    { id: 'kawachi', n: '河内', c: '高屋城', lat: 34.62, lon: 135.66, k: 2, d: 2, r: 'kinki', x: [] },
    { id: 'izumi', n: '和泉', c: '岸和田城', lat: 34.36, lon: 135.32, k: 1, d: 1, r: 'kinki', x: [] },
    { id: 'yamato', n: '大和', c: '筒井城', lat: 34.52, lon: 135.88, k: 4, d: 1, r: 'kinki', x: [[34.3, 135.9]] },
    { id: 'kii', n: '紀伊', c: '雑賀', lat: 34.06, lon: 135.45, k: 2, d: 1, r: 'kinki', x: [[33.78, 135.42], [33.78, 135.95], [34.08, 135.85], [33.95, 136.12]] },
    { id: 'yamashiro', n: '山城', c: '京', lat: 35.01, lon: 135.76, k: 2, d: 1, r: 'kinki', x: [[34.8, 135.83]], kyo: true },
    { id: 'kitaomi', n: '北近江', c: '小谷城', lat: 35.46, lon: 136.27, k: 4, d: 2, r: 'kinki', x: [] },
    { id: 'minamiomi', n: '南近江', c: '観音寺城', lat: 35.12, lon: 136.15, k: 4, d: 2, r: 'kinki', x: [] },
    { id: 'iga', n: '伊賀', c: '伊賀上野', lat: 34.77, lon: 136.14, k: 1, d: 1, r: 'kinki', x: [] },
    { id: 'ise', n: '伊勢', c: '霧山城', lat: 34.66, lon: 136.45, k: 5, d: 1, r: 'kinki', x: [[35.02, 136.6], [34.38, 136.68], [34.28, 136.4]] },
    // 東海・甲信
    { id: 'owari', n: '尾張', c: '清洲城', lat: 35.2, lon: 136.88, k: 5, d: 1, r: 'tokai', x: [] },
    { id: 'mino', n: '美濃', c: '稲葉山城', lat: 35.48, lon: 136.78, k: 5, d: 2, r: 'tokai', x: [[35.7, 136.95], [35.38, 137.2]] },
    { id: 'mikawa', n: '三河', c: '岡崎城', lat: 34.95, lon: 137.2, k: 3, d: 1, r: 'tokai', x: [[35.15, 137.45]] },
    { id: 'totomi', n: '遠江', c: '曳馬城', lat: 34.78, lon: 137.95, k: 3, d: 1, r: 'tokai', x: [[35.02, 137.85], [35.22, 137.86]] },
    { id: 'suruga', n: '駿河', c: '駿府', lat: 35.02, lon: 138.4, k: 2, d: 1, r: 'tokai', x: [[35.28, 138.55]] },
    { id: 'izu', n: '伊豆', c: '韮山城', lat: 34.92, lon: 138.95, k: 1, d: 2, r: 'tokai', x: [] },
    { id: 'hida', n: '飛騨', c: '桜洞城', lat: 36.15, lon: 137.25, k: 1, d: 1, r: 'tokai', snow: true, x: [[36.35, 136.98], [35.95, 137.35]] },
    { id: 'kai', n: '甲斐', c: '躑躅ヶ崎館', lat: 35.67, lon: 138.58, k: 3, d: 2, r: 'tokai', x: [[35.55, 138.85]] },
    { id: 'minamishinano', n: '南信濃', c: '高遠城', lat: 35.9, lon: 137.98, k: 2, d: 2, r: 'tokai', x: [[35.55, 137.82], [36.2, 137.95], [35.4, 137.88]] },
    { id: 'kitashinano', n: '北信濃', c: '海津城', lat: 36.56, lon: 138.2, k: 2, d: 1, r: 'tokai', snow: true, x: [[36.3, 138.5], [36.8, 138.35]] },
    // 北陸
    { id: 'echizen', n: '越前', c: '一乗谷城', lat: 35.98, lon: 136.27, k: 4, d: 2, r: 'hokuriku', snow: true, x: [[35.75, 136.08], [35.88, 136.55]] },
    { id: 'kaga', n: '加賀', c: '尾山御坊', lat: 36.47, lon: 136.6, k: 4, d: 2, r: 'hokuriku', snow: true, x: [[36.25, 136.45]] },
    { id: 'noto', n: '能登', c: '七尾城', lat: 37.05, lon: 136.95, k: 2, d: 3, r: 'hokuriku', snow: true, x: [[37.3, 136.85], [37.4, 137.15]] },
    { id: 'etchu', n: '越中', c: '富山城', lat: 36.68, lon: 137.25, k: 4, d: 1, r: 'hokuriku', snow: true, x: [[36.75, 137.62]] },
    { id: 'echigo', n: '越後', c: '春日山城', lat: 37.15, lon: 138.25, k: 2, d: 2, r: 'hokuriku', snow: true, x: [[37.32, 138.6], [37.0, 138.7]] },
    { id: 'kitaechigo', n: '北越後', c: '新発田城', lat: 37.88, lon: 139.2, k: 2, d: 1, r: 'hokuriku', snow: true, x: [[37.6, 139.0], [38.15, 139.48]] },
    { id: 'sado', n: '佐渡', c: '河原田城', lat: 38.02, lon: 138.36, k: 1, d: 1, r: 'hokuriku', snow: true, x: [[38.2, 138.42]] },
    // 関東
    { id: 'kozuke', n: '上野', c: '箕輪城', lat: 36.4, lon: 139.0, k: 4, d: 2, r: 'kanto', x: [[36.68, 139.02]] },
    { id: 'musashi', n: '武蔵', c: '河越城', lat: 35.9, lon: 139.45, k: 6, d: 1, r: 'kanto', x: [[35.65, 139.65], [36.1, 139.25]] },
    { id: 'sagami', n: '相模', c: '小田原城', lat: 35.3, lon: 139.22, k: 2, d: 3, r: 'kanto', x: [] },
    { id: 'shimotsuke', n: '下野', c: '宇都宮城', lat: 36.58, lon: 139.82, k: 3, d: 1, r: 'kanto', x: [[36.85, 139.72]] },
    { id: 'hitachi', n: '常陸', c: '太田城', lat: 36.45, lon: 140.38, k: 5, d: 1, r: 'kanto', x: [[36.78, 140.5]] },
    { id: 'shimousa', n: '下総', c: '本佐倉城', lat: 35.85, lon: 140.15, k: 3, d: 1, r: 'kanto', x: [[36.08, 139.85]] },
    { id: 'kazusa', n: '上総', c: '久留里城', lat: 35.38, lon: 140.15, k: 3, d: 1, r: 'kanto', x: [] },
    { id: 'boshu', n: '安房', c: '稲村城', lat: 35.02, lon: 139.95, k: 1, d: 1, r: 'kanto', x: [] },
    // 奥羽
    { id: 'tsugaru', n: '津軽', c: '大浦城', lat: 40.62, lon: 140.38, k: 1, d: 1, r: 'ou', snow: true, x: [[40.95, 140.4], [41.1, 140.6]] },
    { id: 'nanbu', n: '糠部', c: '三戸城', lat: 40.38, lon: 141.26, k: 2, d: 2, r: 'ou', snow: true, x: [[40.75, 141.3], [41.2, 141.15], [40.05, 141.75], [40.2, 140.8]] },
    { id: 'iwate', n: '岩手', c: '高水寺城', lat: 39.62, lon: 141.17, k: 2, d: 1, r: 'ou', snow: true, x: [[39.45, 141.65], [39.85, 141.05]] },
    { id: 'kasai', n: '葛西', c: '寺池城', lat: 38.95, lon: 141.2, k: 2, d: 1, r: 'ou', snow: true, x: [[39.15, 141.05], [38.75, 141.45]] },
    { id: 'osaki', n: '大崎', c: '名生城', lat: 38.58, lon: 140.85, k: 2, d: 1, r: 'ou', snow: true, x: [[38.75, 140.95], [38.3, 140.85]] },
    { id: 'akita', n: '秋田', c: '檜山城', lat: 40.2, lon: 140.12, k: 1, d: 1, r: 'ou', snow: true, x: [[39.8, 140.1], [39.95, 139.85]] },
    { id: 'senboku', n: '仙北', c: '横手城', lat: 39.31, lon: 140.55, k: 1, d: 1, r: 'ou', snow: true, x: [[39.6, 140.55], [39.05, 140.45]] },
    { id: 'shonai', n: '庄内', c: '大宝寺城', lat: 38.73, lon: 139.83, k: 1, d: 1, r: 'ou', snow: true, x: [[38.95, 139.9], [39.2, 140.0]] },
    { id: 'mogami', n: '最上', c: '山形城', lat: 38.25, lon: 140.33, k: 2, d: 1, r: 'ou', snow: true, x: [[38.6, 140.35], [38.82, 140.32]] },
    { id: 'okitama', n: '置賜', c: '米沢城', lat: 37.91, lon: 140.12, k: 2, d: 2, r: 'ou', snow: true, x: [[38.05, 139.95]] },
    { id: 'shinobu', n: '信夫', c: '大森城', lat: 37.73, lon: 140.42, k: 2, d: 1, r: 'ou', snow: true, x: [[37.92, 140.6]] },
    { id: 'aizu', n: '会津', c: '黒川城', lat: 37.49, lon: 139.93, k: 2, d: 2, r: 'ou', snow: true, x: [[37.65, 139.7], [37.2, 139.7]] },
    { id: 'soma', n: '相馬', c: '小高城', lat: 37.56, lon: 140.99, k: 1, d: 1, r: 'ou', x: [[37.8, 140.92]] },
    { id: 'tamura', n: '田村', c: '三春城', lat: 37.44, lon: 140.49, k: 1, d: 1, r: 'ou', snow: true, x: [[37.6, 140.38]] },
    { id: 'shirakawa', n: '白河', c: '白川城', lat: 37.11, lon: 140.24, k: 1, d: 1, r: 'ou', snow: true, x: [[36.95, 140.35]] },
    { id: 'iwaki', n: '岩城', c: '大館城', lat: 37.05, lon: 140.89, k: 1, d: 1, r: 'ou', x: [[37.25, 140.95]] },
    // 四国
    { id: 'awaji', n: '淡路', c: '炬口城', lat: 34.35, lon: 134.88, k: 1, d: 1, r: 'shikoku', x: [] },
    { id: 'awa', n: '阿波', c: '勝瑞城', lat: 33.98, lon: 134.32, k: 2, d: 1, r: 'shikoku', x: [[33.85, 134.5], [34.0, 134.0]] },
    { id: 'sanuki', n: '讃岐', c: '十河城', lat: 34.22, lon: 133.92, k: 2, d: 1, r: 'shikoku', x: [[34.15, 133.65]] },
    { id: 'iyo', n: '伊予', c: '湯築城', lat: 33.85, lon: 132.79, k: 2, d: 1, r: 'shikoku', x: [[33.95, 133.1], [33.95, 133.45]] },
    { id: 'minamiiyo', n: '南伊予', c: '黒瀬城', lat: 33.37, lon: 132.53, k: 2, d: 1, r: 'shikoku', x: [[33.55, 132.6], [33.15, 132.55]] },
    { id: 'tosa', n: '土佐', c: '岡豊城', lat: 33.6, lon: 133.65, k: 2, d: 1, r: 'shikoku', x: [[33.55, 133.95], [33.45, 133.35]] },
    { id: 'hatatosa', n: '幡多', c: '中村御所', lat: 32.99, lon: 132.93, k: 1, d: 1, r: 'shikoku', x: [[33.2, 133.05]] },
    // 九州
    { id: 'buzen', n: '豊前', c: '香春岳城', lat: 33.62, lon: 130.95, k: 1, d: 2, r: 'kyushu', x: [[33.55, 131.2]] },
    { id: 'bungo', n: '豊後', c: '府内', lat: 33.2, lon: 131.55, k: 4, d: 1, r: 'kyushu', x: [[33.0, 131.4], [33.5, 131.6], [33.32, 131.0]] },
    { id: 'chikuzen', n: '筑前', c: '立花山城', lat: 33.66, lon: 130.47, k: 3, d: 2, r: 'kyushu', x: [[33.45, 130.7]] },
    { id: 'chikugo', n: '筑後', c: '柳川城', lat: 33.22, lon: 130.58, k: 3, d: 2, r: 'kyushu', x: [[33.3, 130.75]] },
    { id: 'hizen', n: '肥前', c: '村中城', lat: 33.27, lon: 130.12, k: 3, d: 1, r: 'kyushu', x: [[33.4, 129.95]] },
    { id: 'nishihizen', n: '西肥前', c: '日野江城', lat: 32.88, lon: 129.98, k: 1, d: 1, r: 'kyushu', x: [[33.3, 129.65], [32.75, 129.85], [32.65, 130.25]] },
    { id: 'higo', n: '肥後', c: '隈本城', lat: 32.83, lon: 130.8, k: 2, d: 1, r: 'kyushu', x: [[32.95, 131.1], [33.05, 130.75]] },
    { id: 'minamihigo', n: '南肥後', c: '人吉城', lat: 32.21, lon: 130.76, k: 1, d: 1, r: 'kyushu', x: [[32.5, 130.62]] },
    { id: 'hyuga', n: '日向', c: '都於郡城', lat: 32.08, lon: 131.38, k: 1, d: 1, r: 'kyushu', x: [[32.5, 131.55], [31.7, 131.3]] },
    { id: 'osumi', n: '大隅', c: '高山城', lat: 31.33, lon: 130.95, k: 2, d: 1, r: 'kyushu', x: [[31.7, 130.9]] },
    { id: 'satsuma', n: '薩摩', c: '内城', lat: 31.6, lon: 130.52, k: 3, d: 2, r: 'kyushu', x: [[31.85, 130.35], [31.35, 130.4]] },
  ];

  // 国境（R=街道 1歩, P=峠 2歩, S=海路 2歩）
  const EDGES = `
nagato suo R; nagato iwami P; nagato buzen S;
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
echigo kitaechigo R; echigo kozuke P; echigo sado S; sagami musashi R; musashi kozuke R; musashi shimotsuke R;
musashi shimousa R; kozuke shimotsuke R; shimotsuke hitachi R; shimousa hitachi R;
shimousa kazusa R; kazusa boshu R; sagami boshu S;
harima awaji S; awaji awa S; kii awa S; bizen sanuki S; aki iyo S; iyo bungo S;
awa sanuki P; awa tosa P; awa iyo P; sanuki iyo R; iyo tosa P; iyo minamiiyo R; minamiiyo hatatosa P; tosa hatatosa R;
buzen bungo R; buzen chikuzen R; chikuzen chikugo R; chikuzen hizen R; chikugo hizen R; chikugo higo R;
chikugo bungo P; bungo higo P; bungo hyuga P; higo hyuga P; higo minamihigo R; minamihigo hyuga P;
minamihigo satsuma P; minamihigo osumi P; hyuga osumi R; osumi satsuma R; hizen nishihizen R; nishihizen higo S;
tsugaru nanbu P; tsugaru akita P; nanbu iwate R; nanbu akita P; akita senboku R; senboku iwate P;
iwate kasai R; senboku kasai P; senboku mogami P; akita shonai R; shonai mogami R; kasai osaki R;
osaki mogami P; osaki shinobu R; osaki soma R; mogami okitama R; okitama shinobu P; okitama aizu P;
okitama kitaechigo P; shonai kitaechigo R; shinobu soma P; shinobu tamura R; aizu tamura P;
aizu shirakawa P; aizu kitaechigo P; aizu shimotsuke P; tamura shirakawa R; tamura soma P; tamura iwaki P;
shirakawa shimotsuke R; shirakawa hitachi P; shirakawa iwaki P; iwaki hitachi R; iwaki soma R`;

  // 峠・海路の名前（雰囲気づけ。無いものは「〇〇境」）
  const PASS_NAMES = {
    'kitaomi-mino': '関ヶ原', 'yamashiro-minamiomi': '逢坂', 'minamiomi-ise': '鈴鹿峠',
    'izu-sagami': '箱根', 'suruga-sagami': '足柄峠', 'kitashinano-kozuke': '碓氷峠',
    'echigo-kozuke': '三国峠', 'etchu-echigo': '親不知', 'kaga-etchu': '倶利伽羅峠',
    'kitaomi-echizen': '木ノ芽峠', 'totomi-minamishinano': '青崩峠', 'tanba-yamashiro': '老ノ坂',
    'kawachi-yamato': '暗峠', 'sagami-boshu': '浦賀水道', 'owari-mikawa': '桶狭間',
    'kai-musashi': '雁坂峠', 'suruga-kai': '中道', 'kitashinano-minamishinano': '善光寺道',
    'kitashinano-echigo': '北国街道', 'mino-minamishinano': '神坂峠', 'hida-etchu': '越中街道',
    'ise-owari': '長島', 'kawachi-kii': '紀見峠', 'izumi-kii': '雄ノ山峠', 'settsu-harima': '西国街道',
    'nagato-buzen': '関門海峡', 'harima-awaji': '明石海峡', 'awaji-awa': '鳴門', 'kii-awa': '紀伊水道',
    'bizen-sanuki': '備讃瀬戸', 'aki-iyo': '芸予の島々', 'iyo-bungo': '豊予海峡', 'echigo-sado': '佐渡海峡',
    'awa-sanuki': '大坂峠', 'shirakawa-shimotsuke': '白河関', 'iwaki-hitachi': '勿来関',
    'okitama-shinobu': '板谷峠', 'aizu-tamura': '中山峠', 'shonai-kitaechigo': '鼠ヶ関',
    'okitama-kitaechigo': '十三峠', 'senboku-iwate': '仙岩峠', 'osaki-mogami': '山刀伐峠',
    'senboku-mogami': '主寝坂', 'nishihizen-higo': '有明の海', 'aizu-kitaechigo': '阿賀野川',
    'aizu-shimotsuke': '山王峠', 'osaki-shinobu': '奥州道中', 'minamihigo-satsuma': '加久藤越',
    'bungo-higo': '阿蘇路', 'tsugaru-nanbu': '津軽坂', 'nanbu-akita': '鹿角',
  };

  // 大名。major = プレイヤーが選べる主要大名（本格的なCPU）。それ以外は簡易CPU。
  // start の先頭が本拠。armies を省いた家は、各国に1軍ずつ（本拠5・他4）。
  const CLANS = [
    { id: 'oda', n: '織田', who: '織田信長', mon: '織', col: '#d9a300', major: true, lvl: 1,
      trait: 'reroll', tn: '天下布武', td: '毎季1度、好きな賽を1つ振り直せる',
      start: ['owari'], armies: [['owari', 7], ['owari-mikawa', 6]],
      blurb: '尾張一国の小勢。東から今川の大軍が迫り、北には斎藤の美濃。' },
    { id: 'imagawa', n: '今川', who: '今川義元', mon: '今', col: '#7b4ba8', major: true, lvl: 2,
      trait: 'bigarmy', tn: '海道一の弓取り', td: '新しく出陣する軍勢の兵が多い（+2）',
      start: ['suruga', 'totomi', 'mikawa'], armies: [['mikawa', 7], ['totomi', 6], ['suruga', 5]],
      blurb: '東海道三国を治める大大名。上洛の途にある。' },
    { id: 'takeda', n: '武田', who: '武田信玄', mon: '武', col: '#c7302b', major: true, lvl: 2,
      trait: 'mountain', tn: '風林火山', td: '峠を平地と同じ1歩で越える（冬も）',
      start: ['kai', 'minamishinano', 'kitashinano'], armies: [['kai', 7], ['minamishinano', 6], ['kitashinano', 6]],
      blurb: '甲斐・信濃を治める騎馬軍団。川中島で上杉と向き合う。' },
    { id: 'uesugi', n: '上杉', who: '上杉謙信', mon: '上', col: '#2950a8', major: true, lvl: 3,
      trait: 'charge', tn: '軍神', td: '攻めるとき、つねに+1',
      start: ['echigo', 'kitaechigo'], armies: [['echigo', 7], ['kitaechigo', 5]],
      blurb: '越後の龍。義のために関東・信濃へ出陣する。' },
    { id: 'hojo', n: '北条', who: '北条氏康', mon: '北', col: '#2b9150', major: true, lvl: 1,
      trait: 'fortress', tn: '難攻不落', td: '自国の城の守りがすべて+1',
      start: ['sagami', 'izu', 'musashi'], armies: [['musashi', 6], ['sagami', 6], ['izu', 4]],
      blurb: '小田原を本拠に関東の覇を狙う。' },
    { id: 'asakura', n: '朝倉', who: '朝倉義景', mon: '朝', col: '#6e7e1c', major: true, lvl: 1,
      trait: 'meimon', tn: '名門の城下', td: '自国の守備兵の上限+1、毎季2ずつ戻る',
      start: ['echizen'], armies: [['echizen', 7], ['echizen-kaga', 4]],
      blurb: '一乗谷に栄える名門。北には加賀の一向一揆。' },
    { id: 'miyoshi', n: '三好', who: '三好長慶', mon: '三', col: '#b8467f', major: true, lvl: 2,
      trait: 'rich', tn: '畿内の富', td: '休んだ軍勢の兵の戻りが+1',
      start: ['settsu', 'yamashiro', 'izumi', 'awa', 'sanuki', 'awaji'], armies: [['yamashiro', 6], ['settsu', 6], ['awa', 5]],
      blurb: '畿内と四国東部を押さえる天下人。ただし四方から狙われる。' },
    { id: 'mori', n: '毛利', who: '毛利元就', mon: '毛', col: '#1d7070', major: true, lvl: 2,
      trait: 'arrows', tn: '三本の矢', td: '隣の味方の加勢が+2ではなく+3',
      start: ['aki', 'suo', 'nagato', 'bingo'], armies: [['aki', 7], ['suo', 5], ['bingo', 5]],
      blurb: '謀神。大内を滅ぼし、尼子と大友をにらむ。' },
    { id: 'amago', n: '尼子', who: '尼子晴久', mon: '尼', col: '#d9734e', major: true, lvl: 3,
      trait: 'plunder', tn: '山陰の雄', td: '城を落とした軍勢の兵が+1',
      start: ['izumo', 'iwami', 'hoki'], armies: [['izumo', 6], ['iwami', 5], ['hoki', 4]],
      blurb: '八か国の守護。毛利の台頭を阻めるか。' },
    { id: 'otomo', n: '大友', who: '大友宗麟', mon: '友', col: '#3d86c6', major: true, lvl: 3,
      trait: 'cannon', tn: '国崩し', td: '城を攻めるとき+2（南蛮渡来の大砲）',
      start: ['bungo', 'buzen', 'chikuzen'], armies: [['bungo', 7], ['chikuzen', 6], ['buzen', 4]],
      blurb: '北九州に覇を唱える。南蛮の富と大砲をもつ。' },
    { id: 'shimazu', n: '島津', who: '島津貴久', mon: '島', col: '#8a2232', major: true, lvl: 1,
      trait: 'ambush', tn: '釣り野伏せ', td: '奇襲で攻めるとき+2',
      start: ['satsuma'], armies: [['satsuma', 7], ['osumi-satsuma', 5]],
      blurb: '薩摩の雄。南九州の統一から始める。' },
    { id: 'chosokabe', n: '長宗我部', who: '長宗我部元親', mon: '長', col: '#8a5a2b', major: true, lvl: 2,
      trait: 'ichiryo', tn: '一領具足', td: '徴兵で集まる兵が+2',
      start: ['tosa'], armies: [['tosa', 7], ['hatatosa-tosa', 5]],
      blurb: '土佐の小領主。半農半兵の一領具足を率いて四国を目指す。' },
    { id: 'date', n: '伊達', who: '伊達晴宗', mon: '伊', col: '#4a4378', major: true, lvl: 3,
      trait: 'snow', tn: '奥州探題', td: '冬でも足が鈍らない（雪と冬の峠の追加なし）',
      start: ['okitama', 'shinobu'], armies: [['okitama', 6], ['shinobu', 6]],
      blurb: '奥州探題。南奥羽の諸家を従えにかかる。' },
    { id: 'ryuzoji', n: '龍造寺', who: '龍造寺隆信', mon: '龍', col: '#b5651d', major: true, lvl: 2,
      trait: 'mamushi', tn: '肥前の熊', td: '合戦に勝つと、敵の損害+1',
      start: ['hizen'], armies: [['hizen', 7], ['hizen-nishihizen', 5]],
      blurb: '肥前の熊。大友の影から抜け出せるか。' },
    { id: 'satake', n: '佐竹', who: '佐竹義重', mon: '佐', col: '#1f8fa8', major: true, lvl: 3,
      trait: 'gold', tn: '常陸の金山', td: '開墾と築城の進みが+2',
      start: ['hitachi'], armies: [['hitachi', 7], ['shirakawa-hitachi', 5]],
      blurb: '坂東太郎。金山の富で北条と奥州のあいだに勢力を広げる。' },

    // その他の大名（簡易CPU）
    { id: 'saito', n: '斎藤', who: '斎藤義龍', mon: '斎', col: '#8c6d4f', start: ['mino'] },
    { id: 'azai', n: '浅井', who: '浅井長政', mon: '浅', col: '#6d7f99', start: ['kitaomi'], armies: [['kitaomi', 6], ['kitaomi-wakasa', 4]] },
    { id: 'rokkaku', n: '六角', who: '六角義賢', mon: '角', col: '#9a8455', start: ['minamiomi'] },
    { id: 'kitabatake', n: '北畠', who: '北畠具教', mon: '勢', col: '#7d9a78', start: ['ise', 'iga'] },
    { id: 'hatakeyama', n: '畠山', who: '畠山高政', mon: '畠', col: '#a07a8c', start: ['kawachi', 'kii'] },
    { id: 'tsutsui', n: '筒井', who: '筒井順慶', mon: '筒', col: '#8a8f5a', start: ['yamato'] },
    { id: 'hatano', n: '波多野', who: '波多野元秀', mon: '波', col: '#6f8a8a', start: ['tanba'] },
    { id: 'isshiki', n: '一色', who: '一色義道', mon: '色', col: '#9c8a70', start: ['tango'] },
    { id: 'wtakeda', n: '若狭武田', who: '武田義統', mon: '若', col: '#b08a6a', start: ['wakasa'] },
    { id: 'yamana', n: '山名', who: '山名祐豊', mon: '名', col: '#7a8fae', start: ['tajima', 'inaba'] },
    { id: 'akamatsu', n: '赤松', who: '赤松義祐', mon: '赤', col: '#a8695d', start: ['harima'] },
    { id: 'urakami', n: '浦上', who: '浦上宗景', mon: '浦', col: '#6f8f6f', start: ['bizen', 'mimasaka'] },
    { id: 'mimura', n: '三村', who: '三村家親', mon: '備', col: '#a39a6b', start: ['bitchu'] },
    { id: 'honganji', n: '本願寺', who: '加賀一向一揆', mon: '願', col: '#7c6f9a', start: ['kaga'], armies: [['kaga', 6], ['etchu-kaga', 5]] },
    { id: 'nhatakeyama', n: '能登畠山', who: '畠山義綱', mon: '能', col: '#8fa08a', start: ['noto'] },
    { id: 'jinbo', n: '神保', who: '神保長職', mon: '神', col: '#a88f6a', start: ['etchu'] },
    { id: 'mitsuki', n: '三木', who: '三木良頼', mon: '木', col: '#7f9488', start: ['hida'] },
    { id: 'honma', n: '本間', who: '本間氏', mon: '間', col: '#7a90a0', start: ['sado'] },
    { id: 'nagano', n: '長野', who: '長野業正', mon: '野', col: '#a0906a', start: ['kozuke'] },
    { id: 'utsunomiya', n: '宇都宮', who: '宇都宮広綱', mon: '宇', col: '#8e7aa0', start: ['shimotsuke'] },
    { id: 'chiba', n: '千葉', who: '千葉胤富', mon: '千', col: '#a07d6a', start: ['shimousa'] },
    { id: 'satomi', n: '里見', who: '里見義堯', mon: '里', col: '#6a9a8f', start: ['kazusa', 'boshu'] },
    { id: 'nanbu', n: '南部', who: '南部晴政', mon: '南', col: '#8a7d5a', start: ['nanbu', 'tsugaru'] },
    { id: 'shiba', n: '斯波', who: '高水寺斯波氏', mon: '斯', col: '#7a8aa8', start: ['iwate'] },
    { id: 'ando', n: '安東', who: '安東愛季', mon: '安', col: '#a07f6a', start: ['akita'] },
    { id: 'onodera', n: '小野寺', who: '小野寺景道', mon: '小', col: '#6f9a7a', start: ['senboku'] },
    { id: 'kasai', n: '葛西', who: '葛西晴信', mon: '葛', col: '#a0886f', start: ['kasai'] },
    { id: 'osaki', n: '大崎', who: '大崎義直', mon: '崎', col: '#8a7aa0', start: ['osaki'] },
    { id: 'daihoji', n: '大宝寺', who: '大宝寺義増', mon: '宝', col: '#7aa08f', start: ['shonai'] },
    { id: 'mogami', n: '最上', who: '最上義光', mon: '最', col: '#a07a80', start: ['mogami'] },
    { id: 'ashina', n: '葦名', who: '葦名盛氏', mon: '葦', col: '#8f9a5f', start: ['aizu'] },
    { id: 'soma', n: '相馬', who: '相馬盛胤', mon: '相', col: '#6f8aa5', start: ['soma'] },
    { id: 'tamura', n: '田村', who: '田村隆顕', mon: '田', col: '#a5946a', start: ['tamura'] },
    { id: 'shirakawa', n: '白河結城', who: '白河晴綱', mon: '白', col: '#8a9fa8', start: ['shirakawa'] },
    { id: 'iwaki', n: '岩城', who: '岩城重隆', mon: '岩', col: '#9a7f9a', start: ['iwaki'] },
    { id: 'kono', n: '河野', who: '河野通宣', mon: '河', col: '#6f9a95', start: ['iyo'] },
    { id: 'saionji', n: '西園寺', who: '西園寺実充', mon: '西', col: '#a58a6a', start: ['minamiiyo'] },
    { id: 'ichijo', n: '一条', who: '一条兼定', mon: '一', col: '#8f8faf', start: ['hatatosa'] },
    { id: 'kamachi', n: '蒲池', who: '蒲池鑑盛', mon: '蒲', col: '#9a9a6a', start: ['chikugo'] },
    { id: 'arima', n: '有馬', who: '有馬義貞', mon: '有', col: '#7a9fa0', start: ['nishihizen'] },
    { id: 'aso', n: '阿蘇', who: '阿蘇惟将', mon: '阿', col: '#a08a8f', start: ['higo'] },
    { id: 'sagara', n: '相良', who: '相良義陽', mon: '良', col: '#7f9a6a', start: ['minamihigo'] },
    { id: 'ito', n: '伊東', who: '伊東義祐', mon: '東', col: '#9a7fa5', start: ['hyuga'] },
    { id: 'kimotsuki', n: '肝付', who: '肝付兼続', mon: '肝', col: '#a59a7a', start: ['osumi'] },
  ];

  // 海岸線（緯度, 経度）
  const COAST = {
    honshu: [[33.95,130.92],[34.1,130.88],[34.3,130.86],[34.38,130.95],[34.42,131.2],[34.43,131.4],[34.55,131.55],[34.66,131.7],[34.7,131.85],[34.85,132.0],[34.95,132.13],[35.05,132.28],[35.15,132.42],[35.25,132.55],[35.4,132.63],[35.47,132.7],[35.53,132.95],[35.57,133.2],[35.55,133.32],[35.47,133.3],[35.43,133.38],[35.5,133.6],[35.52,133.85],[35.53,134.05],[35.55,134.25],[35.6,134.45],[35.63,134.65],[35.65,134.85],[35.7,135.05],[35.78,135.22],[35.68,135.28],[35.55,135.2],[35.52,135.32],[35.49,135.42],[35.53,135.55],[35.5,135.72],[35.58,135.9],[35.65,136.05],[35.75,136.02],[35.98,135.96],[36.1,136.08],[36.22,136.15],[36.4,136.4],[36.6,136.6],[36.75,136.72],[36.9,136.77],[37.1,136.73],[37.29,136.77],[37.4,136.9],[37.48,137.1],[37.53,137.35],[37.42,137.3],[37.3,137.18],[37.15,137.05],[37.05,136.97],[36.92,137.0],[36.8,137.05],[36.76,137.22],[36.82,137.4],[36.95,137.65],[37.03,137.85],[37.13,138.1],[37.2,138.25],[37.37,138.55],[37.55,138.72],[37.7,138.85],[37.92,139.05],[38.05,139.25],[38.22,139.45],[38.45,139.55],[38.62,139.6],[38.92,139.82],[39.2,139.9],[39.4,140.03],[39.73,140.05],[39.85,139.95],[39.95,139.7],[40.0,139.85],[40.1,140.0],[40.22,140.02],[40.5,139.97],[40.65,139.92],[40.78,140.2],[41.0,140.3],[41.25,140.35],[41.1,140.55],[40.84,140.74],[40.9,140.88],[40.88,141.12],[41.05,141.25],[41.28,141.2],[41.15,140.82],[41.4,140.85],[41.53,140.92],[41.43,141.46],[41.2,141.42],[40.95,141.4],[40.68,141.42],[40.52,141.55],[40.2,141.8],[39.65,141.98],[39.27,141.9],[39.0,141.75],[38.85,141.62],[38.3,141.5],[38.4,141.25],[38.3,141.05],[38.1,140.98],[37.85,140.95],[37.4,141.03],[37.05,140.92],[36.9,140.8],[36.75,140.72],[36.55,140.65],[36.35,140.58],[36.1,140.6],[35.95,140.7],[35.72,140.87],[35.65,140.7],[35.5,140.45],[35.37,140.4],[35.15,140.32],[35.1,140.1],[34.95,139.95],[34.9,139.85],[35.0,139.82],[35.15,139.83],[35.3,139.8],[35.38,139.92],[35.55,140.05],[35.65,140.05],[35.69,139.95],[35.66,139.78],[35.53,139.72],[35.45,139.65],[35.3,139.68],[35.14,139.62],[35.25,139.55],[35.3,139.45],[35.28,139.25],[35.22,139.12],[35.1,139.08],[34.97,139.12],[34.82,139.05],[34.68,138.97],[34.6,138.85],[34.7,138.75],[34.85,138.76],[34.98,138.78],[35.1,138.86],[35.13,138.65],[35.05,138.5],[34.9,138.33],[34.75,138.27],[34.6,138.22],[34.65,138.0],[34.68,137.75],[34.7,137.55],[34.62,137.3],[34.58,137.02],[34.64,137.08],[34.7,137.25],[34.76,137.33],[34.82,137.22],[34.86,137.05],[34.8,136.98],[34.69,136.97],[34.78,136.87],[34.92,136.83],[35.04,136.84],[35.07,136.76],[35.05,136.69],[34.96,136.63],[34.85,136.58],[34.72,136.52],[34.58,136.55],[34.5,136.72],[34.48,136.85],[34.38,136.9],[34.28,136.9],[34.25,136.75],[34.25,136.55],[34.15,136.35],[34.07,136.2],[33.88,136.1],[33.72,135.99],[33.55,135.88],[33.44,135.76],[33.5,135.55],[33.62,135.42],[33.73,135.37],[33.88,135.15],[34.03,135.18],[34.15,135.1],[34.23,135.15],[34.33,135.25],[34.46,135.37],[34.57,135.45],[34.68,135.43],[34.7,135.3],[34.68,135.18],[34.64,135.0],[34.72,134.8],[34.75,134.6],[34.73,134.39],[34.65,134.2],[34.61,134.15],[34.55,134.0],[34.48,133.85],[34.5,133.65],[34.48,133.5],[34.42,133.38],[34.4,133.2],[34.4,133.05],[34.34,132.92],[34.23,132.58],[34.3,132.45],[34.25,132.3],[34.17,132.22],[34.0,132.12],[33.95,131.95],[34.05,131.8],[34.03,131.57],[33.98,131.4],[33.95,131.25],[33.95,131.05]],
    shikoku: [[34.35,134.05],[34.33,134.2],[34.23,134.4],[34.2,134.62],[34.05,134.6],[33.9,134.68],[33.75,134.58],[33.6,134.4],[33.25,134.18],[33.42,133.95],[33.5,133.55],[33.38,133.28],[33.2,133.12],[32.95,133.0],[32.72,133.02],[32.92,132.72],[33.2,132.53],[33.46,132.42],[33.34,132.02],[33.45,132.25],[33.6,132.5],[33.83,132.7],[33.98,132.78],[34.08,133.0],[33.92,133.18],[33.97,133.3],[34.02,133.55],[34.12,133.65],[34.3,133.8],[34.32,133.88]],
    kyushu: [[33.95,130.97],[33.9,130.88],[33.92,130.78],[33.85,130.55],[33.62,130.4],[33.6,130.18],[33.47,129.97],[33.55,129.88],[33.3,129.85],[33.35,129.55],[33.15,129.7],[32.95,129.68],[32.72,129.85],[32.58,129.75],[32.68,129.95],[32.72,130.2],[32.6,130.27],[32.78,130.37],[32.92,130.25],[33.12,130.25],[33.15,130.4],[33.0,130.43],[32.95,130.45],[32.8,130.6],[32.65,130.65],[32.5,130.58],[32.2,130.38],[32.08,130.3],[31.98,130.2],[31.82,130.22],[31.7,130.26],[31.5,130.3],[31.28,130.22],[31.27,130.3],[31.18,130.5],[31.23,130.65],[31.42,130.55],[31.6,130.57],[31.73,130.67],[31.72,130.77],[31.5,130.7],[31.32,130.75],[31.0,130.66],[31.05,130.85],[31.28,131.05],[31.47,131.1],[31.38,131.35],[31.6,131.38],[31.92,131.45],[32.13,131.52],[32.42,131.63],[32.58,131.7],[32.95,131.92],[33.13,131.82],[33.27,131.62],[33.3,131.5],[33.48,131.68],[33.66,131.6],[33.6,131.2],[33.72,131.0]],
    awaji: [[34.6,135.0],[34.45,134.98],[34.33,134.92],[34.22,134.82],[34.25,134.68],[34.4,134.72],[34.52,134.88]],
    sado: [[38.32,138.5],[38.2,138.55],[38.05,138.52],[37.95,138.5],[37.82,138.32],[37.86,138.22],[38.0,138.3],[38.08,138.25],[38.22,138.32],[38.3,138.42]],
    ezo: [[41.77,140.72],[41.68,140.43],[41.42,140.1],[41.55,140.0],[41.87,140.12],[42.1,140.0],[42.45,139.85],[42.7,140.05],[42.98,140.5],[43.35,140.35],[43.2,140.78],[43.2,141.0],[43.25,141.3],[43.6,141.4],[43.6,142.5],[42.5,143.3],[42.17,142.77],[42.33,142.37],[42.5,142.0],[42.62,141.6],[42.55,141.35],[42.42,141.1],[42.32,140.97],[42.47,140.85],[42.52,140.38],[42.25,140.27],[42.1,140.58],[42.03,140.82],[41.82,141.17],[41.73,140.95]],
    oki: [[36.33,133.2],[36.3,133.35],[36.2,133.35],[36.15,133.2],[36.25,133.1]],
    tsushima: [[34.65,129.2],[34.7,129.45],[34.2,129.35],[34.3,129.2]],
    iki: [[33.82,129.68],[33.8,129.78],[33.73,129.75],[33.75,129.66]],
    goto: [[32.75,128.75],[32.8,128.9],[32.62,128.85],[32.65,128.7]],
    amakusa: [[32.55,130.15],[32.5,130.35],[32.35,130.3],[32.2,130.1],[32.4,129.98]],
    shodo: [[34.52,134.18],[34.5,134.35],[34.45,134.38],[34.43,134.25],[34.47,134.15]],
    oshima: [[34.78,139.35],[34.75,139.42],[34.68,139.38],[34.72,139.33]],
  };
  const LAKES = [
    [[35.52,136.15],[35.47,136.22],[35.38,136.26],[35.28,136.18],[35.18,136.08],[35.08,135.98],[35.0,135.88],[35.05,135.86],[35.15,135.93],[35.27,136.0],[35.38,136.02],[35.48,136.05]],
    [[37.55,140.05],[37.52,140.15],[37.42,140.12],[37.43,140.03]],
  ];

  // 遊べない陸地（色だけ）
  const OUTER = [
    { n: '蝦夷', isl: 'ezo', pts: [[42.2, 140.4], [43.0, 141.5]] },
    { n: '隠岐', isl: 'oki', pts: [[36.24, 133.24]] },
    { n: '対馬', isl: 'tsushima', pts: [[34.45, 129.33]] },
    { n: '壱岐', isl: 'iki', pts: [[33.77, 129.72]] },
    { n: '五島', isl: 'goto', pts: [[32.7, 128.8]] },
    { n: '天草', isl: 'amakusa', pts: [[32.4, 130.15]] },
    { n: '小豆島', isl: 'shodo', pts: [[34.48, 134.26]] },
    { n: '伊豆大島', isl: 'oshima', pts: [[34.73, 139.38]] },
  ];

  // 山がちな国（墨の山を多めに描く）
  const MOUNTAIN = { hida: 1, kai: 0.8, minamishinano: 1, kitashinano: 0.8, kozuke: 0.5, mimasaka: 0.6, tanba: 0.5, kii: 0.7, iga: 0.4, echigo: 0.4, iwami: 0.5, hoki: 0.4, yamato: 0.4, etchu: 0.4, izu: 0.3, suruga: 0.3, mino: 0.3, echizen: 0.4, kaga: 0.3, bingo: 0.3, aki: 0.3, tajima: 0.5, inaba: 0.3, bitchu: 0.3, wakasa: 0.3, totomi: 0.3, mikawa: 0.2, kitaechigo: 0.3, shimotsuke: 0.3,
    tsugaru: 0.3, nanbu: 0.5, iwate: 0.6, kasai: 0.3, akita: 0.3, senboku: 0.5, mogami: 0.4, okitama: 0.4, aizu: 0.7, shinobu: 0.3, tamura: 0.3, shirakawa: 0.3, shonai: 0.3, osaki: 0.2,
    awa: 0.5, tosa: 0.7, iyo: 0.4, minamiiyo: 0.5, hatatosa: 0.5, sanuki: 0.2,
    bungo: 0.5, higo: 0.6, minamihigo: 0.7, hyuga: 0.6, osumi: 0.3, satsuma: 0.3, chikuzen: 0.2, buzen: 0.3, nishihizen: 0.2 };

  // 地方（移動ボタン・表示用）
  const REGIONS = [
    { id: 'ou', n: '奥羽' }, { id: 'kanto', n: '関東' }, { id: 'hokuriku', n: '北陸' }, { id: 'tokai', n: '東海・甲信' },
    { id: 'kinki', n: '近畿' }, { id: 'chugoku', n: '中国' }, { id: 'shikoku', n: '四国' }, { id: 'kyushu', n: '九州' },
  ];

  const RULES = {
    maxTurn: 40,          // 永禄三年春〜永禄十二年冬（最初の区切り）
    extTurns: 20,         // 延長1回あたり（5年）
    armyMax: 10,
    newArmy: 4,
    momentumCap: 6,
    support: 2,
    passCost: 2, seaCost: 2, winterExtra: 1, snowExtra: 1,
    passDefense: 1,
    capGar: 1, capitalDef: 1, siegeAdj: 1, garWithArmy: 0, lastStand: 2,
    // 国力（石高の合計）から賽と軍勢の枠
    diceBase: 3, diceDiv: 12, diceMax: 8,
    slotBase: 2, slotDiv: 7, slotMax: 12,
    // 内政
    recruitBase: 2, recruitDiv: 2, recruitAutumn: 1,
    devNeed0: 5, devNeedStep: 3, devCap: 2,
    fortNeed0: 3, fortNeedStep: 3, fortMax: 3,
    garBase: 1, garDiv: 2,
    healCastle: 1, healField: 0,
    // 臣従
    subMaxProv: 2, subRatio: 5, subMinKok: 20, subChance: 0.18, subFar: 0.03, subDom: 0.25, subDeclineWait: 8,
    // 包囲網
    coalitionKok: 45, coalitionRatio: 1.5,
    aiAggr: 0.15,         // CPU（主要大名）の攻めっ気の上乗せ
  };

  const DATA = { PROV, EDGES, PASS_NAMES, CLANS, COAST, LAKES, OUTER, MOUNTAIN, REGIONS, RULES };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else { root.SG = root.SG || {}; root.SG.DATA = DATA; }
})(typeof window !== 'undefined' ? window : globalThis);
