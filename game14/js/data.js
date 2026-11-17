/* data.js — fixed scenario data: 20 provinces / 20 daimyo (1560 autumn, after Okehazama). */
(function (root) {
  'use strict';
  // stats: econ (経済力), mil (軍事力), def (守備力) — fixed by the brief (1..5)
  // snow: winter snowbound province (雪国)
  const PROVINCES = [
    { key: 'noto', name: '能登', econ: 2, mil: 2, def: 4, snow: true },
    { key: 'echigo', name: '越後', econ: 4, mil: 5, def: 4, snow: true },
    { key: 'izu', name: '伊豆', econ: 4, mil: 5, def: 4, snow: false },
    { key: 'kaga', name: '加賀', econ: 3, mil: 4, def: 3, snow: true },
    { key: 'etchu', name: '越中', econ: 2, mil: 2, def: 3, snow: true },
    { key: 'echizen', name: '越前', econ: 4, mil: 4, def: 3, snow: true },
    { key: 'wakasa', name: '若狭', econ: 2, mil: 2, def: 3, snow: false },
    { key: 'hida', name: '飛騨', econ: 1, mil: 2, def: 5, snow: true },
    { key: 'suruga', name: '遠江・駿河', econ: 4, mil: 3, def: 3, snow: false },
    { key: 'mikawa', name: '三河', econ: 3, mil: 3, def: 3, snow: false },
    { key: 'mino', name: '美濃', econ: 4, mil: 4, def: 4, snow: false },
    { key: 'yamato', name: '大和', econ: 2, mil: 1, def: 2, snow: false },
    { key: 'kitaomi', name: '北近江', econ: 3, mil: 3, def: 4, snow: false },
    { key: 'minamiomi', name: '南近江', econ: 4, mil: 4, def: 4, snow: false },
    { key: 'iga', name: '伊賀', econ: 1, mil: 2, def: 5, snow: false },
    { key: 'ise', name: '伊勢・志摩', econ: 3, mil: 3, def: 3, snow: false },
    { key: 'yamashiro', name: '山城', econ: 3, mil: 1, def: 2, snow: false },
    { key: 'settsu', name: '摂津・河内', econ: 5, mil: 5, def: 4, snow: false },
    { key: 'kai', name: '甲斐・信濃', econ: 3, mil: 5, def: 5, snow: true },
    { key: 'owari', name: '尾張', econ: 5, mil: 3, def: 3, snow: false },
  ];

  // daimyo i starts in province i. mon = banner character (旗印). color = clan colour.
  // ai: personality used by the CPU (aggr: willingness to attack, dev: preference for development, risk: accepted odds)
  const DAIMYO = [
    { clan: '畠山', name: '畠山義綱', mon: '畠', color: '#3E7F9A', ai: { aggr: 0.35, dev: 0.6, risk: 0.70 } },
    { clan: '上杉', name: '上杉謙信', mon: '毘', color: '#24407A', ai: { aggr: 0.85, dev: 0.3, risk: 0.55, rival: 'kai' } },
    { clan: '北条', name: '北条氏康', mon: '鱗', color: '#2E7D4A', ai: { aggr: 0.55, dev: 0.6, risk: 0.65 } },
    { clan: '本願寺', name: '本願寺顕如', short: '本願寺', mon: '本', color: '#6A4A8C', ai: { aggr: 0.55, dev: 0.4, risk: 0.60, zeal: true } },
    { clan: '神保', name: '神保長職', mon: '神', color: '#B58E3C', ai: { aggr: 0.45, dev: 0.5, risk: 0.65 } },
    { clan: '朝倉', name: '朝倉義景', mon: '朝', color: '#9A5530', ai: { aggr: 0.40, dev: 0.6, risk: 0.70 } },
    { clan: '若狭武田', name: '武田義統', mon: '若', color: '#84B39A', ai: { aggr: 0.35, dev: 0.6, risk: 0.70 } },
    { clan: '姉小路', name: '姉小路良頼', short: '姉小路', mon: '姉', color: '#7C8088', ai: { aggr: 0.40, dev: 0.5, risk: 0.65 } },
    { clan: '今川', name: '今川氏真', mon: '今', color: '#C04A6A', ai: { aggr: 0.40, dev: 0.6, risk: 0.70 } },
    { clan: '徳川', name: '徳川家康', mon: '徳', color: '#4F9ED6', ai: { aggr: 0.55, dev: 0.5, risk: 0.62 } },
    { clan: '斎藤', name: '斎藤義龍', mon: '斎', color: '#93B53A', ai: { aggr: 0.55, dev: 0.5, risk: 0.62 } },
    { clan: '筒井', name: '筒井順慶', mon: '筒', color: '#B39AD0', ai: { aggr: 0.40, dev: 0.5, risk: 0.65 } },
    { clan: '浅井', name: '浅井長政', mon: '浅', color: '#E8963A', ai: { aggr: 0.55, dev: 0.5, risk: 0.62 } },
    { clan: '六角', name: '六角義賢', mon: '六', color: '#5E4030', ai: { aggr: 0.50, dev: 0.5, risk: 0.64 } },
    { clan: '伊賀衆', name: '伊賀衆', short: '伊賀衆', mon: '忍', color: '#3A3A44', ai: { aggr: 0.45, dev: 0.4, risk: 0.60, ninja: true } },
    { clan: '北畠', name: '北畠具教', mon: '北', color: '#6F86A6', ai: { aggr: 0.45, dev: 0.5, risk: 0.65 } },
    { clan: '足利', name: '足利義輝', mon: '将', color: '#E3A2B4', ai: { aggr: 0.35, dev: 0.6, risk: 0.70 } },
    { clan: '三好', name: '三好長慶', mon: '三', color: '#7A2635', ai: { aggr: 0.50, dev: 0.6, risk: 0.66 } },
    { clan: '武田', name: '武田信玄', mon: '風', color: '#D8432A', ai: { aggr: 0.80, dev: 0.35, risk: 0.58, rival: 'echigo' } },
    { clan: '織田', name: '織田信長', mon: '織', color: '#E2B92C', ai: { aggr: 0.75, dev: 0.45, risk: 0.56 } },
  ];

  const ERA = { name: '永禄', baseYear: 1558 }; // 1560 = 永禄三年
  const SEASONS = ['春', '夏', '秋', '冬'];

  // difficulty 1 (easy) .. 5 (very hard) — calibrated from headless simulations (tools/sim.js)
  // difficulty index = mean rank - 0.05*win% + 0.04*(100-survival%), from bot players (default AI x40 + 1-step lookahead planner x12 per clan);
  // thresholds 3.2 / 5.5 / 8.5 / 12.8. Bot-based estimate, not measured on humans.
  const DIFF = [1, 2, 1, 4, 5, 4, 3, 2, 4, 5, 4, 5, 4, 3, 2, 5, 5, 1, 3, 3];
  const FLAVOR = [
    '能登の名門。隣国は二つだけで七尾城は堅い。<b>守りを固めて力を蓄え</b>、隣の隙を突け。',
    '越後の龍。精強な軍勢で越中・信濃へ。<b>冬は雪で動けない</b>ので秋までに攻め切れ。',
    '関東の雄。豊かで強く、隣国は今川・武田のみ。<b>背後が安全</b>な分、着実に版図を広げられる。',
    '一向一揆の国。兵は多いが国は並。北陸の要に立ち、越中・越前を狙え。',
    '上杉・本願寺に挟まれた小国。<b>低い出目の調略</b>で生き延び、隙を突け。',
    '北陸の名家。豊かな越前から近江・美濃・若狭を窺う。冬の雪に注意。',
    '朝倉・浅井に挟まれた小国。隣は二国のみで背後は安全。<b>守りを固め、奇襲の機</b>を待て。',
    '山国の守りは鉄壁（守備5）。だが貧しく兵も少ない。<b>開発</b>で国を富ませよ。',
    '義元亡き今川家。豊かだが武田・北条・徳川に囲まれる。守りを固めて反撃を。',
    '独立したばかりの三河。四方を強国に囲まれる苦難の道。<b>本城の守り</b>を活かせ。',
    '「美濃を制する者は天下を制す」。七国と接する要の地。攻めも守りも忙しい。',
    '三好の脅威にさらされる大和。兵は最少。<b>調略と開発</b>で耐え抜く最難関。',
    '若き当主。堅い小谷城を拠点に、近江・越前・美濃へ。',
    '近江の名門。京に近く、豊かで強い。上洛の好位置。',
    '忍びの里。貧しいが守りは堅い。<b>奇襲と調略</b>を極めよ。',
    '伊勢の国司。均整の取れた国力。五国と接し、どこへでも出られる。',
    '室町将軍。京を抱えるが兵はわずか。三好の脅威に<b>調略と守り</b>で抗え。',
    '天下人に最も近い男。豊かさと兵力で畿内を制し、天下へ。',
    '甲斐の虎。最強の軍勢と堅い守り。だが<b>六国と接し</b>、四方から狙われる。冬は雪で動けない。',
    '桶狭間の勝者。<b>経済5</b>の財力で兵を集め、美濃・伊勢・三河へ。',
  ];
  root.GAME_DATA = { PROVINCES, DAIMYO, ERA, SEASONS, DIFF, FLAVOR };
})(typeof window !== 'undefined' ? window : globalThis);
