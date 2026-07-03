// 專案路徑：src/content/match/matchRules.js
// 模組說明：比賽分析規則表。取代舊版 Python 依賴 0_shot_Freethrow.csv 的做法，將投籃、罰球、籃板、傳球、犯規、失誤等事件規則內建在擴充功能中。

const BP_SHOT_RULES = [
  { events: "主場優勢幫助球員投出精準的罰球", shot_hit: 1, Close: 0, Mid: 0, Three: 0, FT: 1 },
  { events: "罰球", shot_hit: 1, Close: 0, Mid: 0, Three: 0, FT: 1 },
  { events: "罰球未命中", shot_hit: 0, Close: 0, Mid: 0, Three: 0, FT: 1 },
  { events: "客場氣氛干擾導致罰球沒進", shot_hit: 0, Close: 0, Mid: 0, Three: 0, FT: 1 },

  { events: "三分球投籃沒進", shot_hit: 0, Close: 0, Mid: 0, Three: 1, FT: 0 },
  { events: "中距離投籃沒進", shot_hit: 0, Close: 0, Mid: 1, Three: 0, FT: 0 },
  { events: "近距離投籃失手", shot_hit: 0, Close: 1, Mid: 0, Three: 0, FT: 0 },
  { events: "運氣非常不好的近距離投籃", shot_hit: 0, Close: 1, Mid: 0, Three: 0, FT: 0 },
  { events: "近距離投籃被蓋火鍋", shot_hit: 0, Close: 1, Mid: 0, Three: 0, FT: 0 },
  { events: "運氣不好的三分投籃", shot_hit: 0, Close: 0, Mid: 0, Three: 1, FT: 0 },
  { events: "三分球出手被蓋火鍋", shot_hit: 0, Close: 0, Mid: 0, Three: 1, FT: 0 },
  { events: "中距離投籃被封蓋", shot_hit: 0, Close: 0, Mid: 1, Three: 0, FT: 0 },
  { events: "三分球投籃失手 - 籃外空心", shot_hit: 0, Close: 0, Mid: 0, Three: 1, FT: 0 },
  { events: "由於對手快速回防，快攻2分球投籃沒中", shot_hit: 0, Close: 0, Mid: 1, Three: 0, FT: 0 },
  { events: "運氣非常不好的中距離投籃", shot_hit: 0, Close: 0, Mid: 1, Three: 0, FT: 0 },
  { events: "近距離投籃沒進 - 連籃框都沒碰到", shot_hit: 0, Close: 1, Mid: 0, Three: 0, FT: 0 },
  { events: "中距離投籃沒中 - 麵包", shot_hit: 0, Close: 0, Mid: 1, Three: 0, FT: 0 },
  { events: "未過半場出手的遠射沒中", shot_hit: 0, Close: 0, Mid: 0, Three: 1, FT: 0 },
  { events: "近距離投籃沒進，體力下滑影響球員表現", shot_hit: 0, Close: 1, Mid: 0, Three: 0, FT: 0 },
  { events: "三分投籃沒中，體能下滑影響球員的表現", shot_hit: 0, Close: 0, Mid: 0, Three: 1, FT: 0 },
  { events: "中距離投籃沒中，體能下滑影響球員的表現", shot_hit: 0, Close: 0, Mid: 1, Three: 0, FT: 0 },
  { events: "在本節結束鈴聲響起時嘗試投籃", shot_hit: 0, Close: 1, Mid: 0, Three: 0, FT: 0 },
  { events: "客場氣氛干擾導致近距離投籃沒進", shot_hit: 0, Close: 1, Mid: 0, Three: 0, FT: 0 },
  { events: "未過半場的三分長射命中", shot_hit: 1, Close: 0, Mid: 0, Three: 1, FT: 0 },
  { events: "主場優勢幫助球員三分球投籃蓋火鍋", shot_hit: 0, Close: 0, Mid: 0, Three: 1, FT: 0 },
  { events: "主場優勢幫助球員近距離投籃蓋火鍋", shot_hit: 0, Close: 1, Mid: 0, Three: 0, FT: 0 },
  { events: "客場氣氛干擾導致中距離投籃沒進", shot_hit: 0, Close: 0, Mid: 1, Three: 0, FT: 0 },
  { events: "主場優勢幫助球員中距離投籃蓋火鍋", shot_hit: 0, Close: 0, Mid: 1, Three: 0, FT: 0 },
  { events: "客場氣氛干擾導致三分出手沒進", shot_hit: 0, Close: 0, Mid: 0, Three: 1, FT: 0 },
  { events: "24秒鈴響後嘗試出手", shot_hit: 0, Close: 1, Mid: 0, Three: 0, FT: 0 },

  { events: "三分球投籃", shot_hit: 1, Close: 0, Mid: 0, Three: 1, FT: 0 },
  { events: "近距離2分球投籃", shot_hit: 1, Close: 1, Mid: 0, Three: 0, FT: 0 },
  { events: "中距離2分球投籃", shot_hit: 1, Close: 0, Mid: 1, Three: 0, FT: 0 },
  { events: "灌籃", shot_hit: 1, Close: 1, Mid: 0, Three: 0, FT: 0 },
  { events: "成功的快攻", shot_hit: 1, Close: 1, Mid: 0, Three: 0, FT: 0 },
  { events: "精準的三分投籃，良好的心理準備的確有幫助", shot_hit: 1, Close: 0, Mid: 0, Three: 1, FT: 0 },
  { events: "近乎奇蹟精準的三分投籃", shot_hit: 1, Close: 0, Mid: 0, Three: 1, FT: 0 },
  { events: "幸運的中距離2分球投籃", shot_hit: 1, Close: 0, Mid: 1, Three: 0, FT: 0 },
  { events: "近距離2分球投籃，良好的心理準備確實有幫助", shot_hit: 1, Close: 1, Mid: 0, Three: 0, FT: 0 },
  { events: "令人驚嘆的扣籃", shot_hit: 1, Close: 1, Mid: 0, Three: 0, FT: 0 },
  { events: "中距離2分球投籃，良好的心理準備確實有幫助", shot_hit: 1, Close: 0, Mid: 1, Three: 0, FT: 0 },
  { events: "近乎奇蹟精準的近距離2分球投籃", shot_hit: 1, Close: 1, Mid: 0, Three: 0, FT: 0 },
  { events: "主場優勢幫助球員投出精準的中距離投籃", shot_hit: 1, Close: 0, Mid: 1, Three: 0, FT: 0 },
  { events: "主場優勢幫助球員投出精準的近距離投籃", shot_hit: 1, Close: 1, Mid: 0, Three: 0, FT: 0 },
  { events: "主場優勢幫助球員投出精準的三分球", shot_hit: 1, Close: 0, Mid: 0, Three: 1, FT: 0 }
];

const BP_SHOT_RULE_MAP = new Map(
  BP_SHOT_RULES.map(rule => [rule.events, rule])
);

function getShotRuleByEvent(eventName) {
  return BP_SHOT_RULE_MAP.get(eventName || "") || null;
}

const BP_OFFENSIVE_REBOUND_EVENTS = [
  "進攻籃板",
  "進攻籃板 - 球直接反彈到手中",
  "進攻籃板 - 因為對手卡位失敗",
  "主場優勢幫助球員抓下進攻籃板"
];

const BP_DEFENSIVE_REBOUND_EVENTS = [
  "防守籃板",
  "防守籃板 - 球直接反彈到手中",
  "主場優勢幫助球員抓下防守籃板"
];

const BP_PASS_EVENTS = {
  good_passes: "不錯的傳球",
  safe_passes: "安全的傳球",
  normal_passes: "普通的傳球",
  great_passes: "漂亮的妙傳",
  bad_passes: "糟糕的傳球"
};

const BP_BLOCK_EVENTS = [
  "封蓋",
  "封蓋！球被指尖輕輕碰到"
];

const BP_BLOCKED_EVENTS = [
  "三分球出手被蓋火鍋",
  "中距離投籃被封蓋",
  "主場優勢幫助球員三分球投籃蓋火鍋",
  "主場優勢幫助球員中距離投籃蓋火鍋",
  "主場優勢幫助球員近距離投籃蓋火鍋",
  "近距離投籃被蓋火鍋"
];

const BP_STEAL_EVENTS = [
  "主場優勢幫助球員抄截成功",
  "由於出色的防守，成功抄截",
  "由於球員技能高於對手，成功抄截對手的邊線發球",
  "抄截",
  "對手發邊線球後成功抄截",
  "壓迫防守成功抄截"
];

const BP_FOUL_EVENTS = [
  "切入上籃進攻犯規 (1 犯規 )",
  "切入上籃進攻犯規 (2 犯規 )",
  "切入上籃進攻犯規 (3 犯規 )",
  "切入上籃進攻犯規 (4 犯規 )",
  "切入上籃進攻犯規 (5 犯規 )",
  "切入上籃進攻犯規(因為緊迫防守) (1 犯規 )",
  "切入上籃進攻犯規(因為緊迫防守) (2 犯規 )",
  "切入上籃進攻犯規(因為緊迫防守) (3 犯規 )",
  "切入上籃進攻犯規(因為緊迫防守) (4 犯規 )",
  "切入上籃進攻犯規(因為緊迫防守) (5 犯規 )",
  "防守切入上籃犯規 (1 犯規 )",
  "防守切入上籃犯規 (2 犯規 )",
  "防守切入上籃犯規 (3 犯規 )",
  "防守切入上籃犯規 (4 犯規 )",
  "防守切入上籃犯規 (5 犯規 )",
  "戰術犯規 (1 犯規 )",
  "戰術犯規 (2 犯規 )",
  "戰術犯規 (3 犯規 )",
  "戰術犯規 (4 犯規 )",
  "戰術犯規 (5 犯規 )",
  "打手犯規 - 由於差勁的防守技巧 (1 犯規 )",
  "打手犯規 - 由於差勁的防守技巧 (2 犯規 )",
  "打手犯規 - 由於差勁的防守技巧 (3 犯規 )",
  "打手犯規 - 由於差勁的防守技巧 (4 犯規 )",
  "打手犯規 - 由於差勁的防守技巧 (5 犯規 )",
  "犯規！成功阻止對手在良好機會出手 (1 犯規 )",
  "犯規！成功阻止對手在良好機會出手 (2 犯規 )",
  "犯規！成功阻止對手在良好機會出手 (3 犯規 )",
  "犯規！成功阻止對手在良好機會出手 (4 犯規 )",
  "犯規！成功阻止對手在良好機會出手 (5 犯規 )",
  "防守投籃打手犯規 (1 犯規 )",
  "防守投籃打手犯規 (2 犯規 )",
  "防守投籃打手犯規 (3 犯規 )",
  "防守投籃打手犯規 (4 犯規 )",
  "防守投籃打手犯規 (5 犯規 )",
  "試圖抄截時犯規 (1 犯規 )",
  "試圖抄截時犯規 (2 犯規 )",
  "試圖抄截時犯規 (3 犯規 )",
  "試圖抄截時犯規 (4 犯規 )",
  "試圖抄截時犯規 (5 犯規 )",
  "非法掩護 (1 犯規 )",
  "非法掩護 (2 犯規 )",
  "非法掩護 (3 犯規 )",
  "非法掩護 (4 犯規 )",
  "非法掩護 (5 犯規 )",
  "爭搶籃板犯規，球員必須更加小心 (2 犯規 )",
  "爭搶籃板犯規，球員必須更加小心 (3 犯規 )",
  "爭搶籃板犯規，球員必須更加小心 (4 犯規 )",
  "爭搶籃板時犯規 (1 犯規 )",
  "爭搶籃板時犯規 (2 犯規 )",
  "爭搶籃板時犯規 (3 犯規 )",
  "爭搶籃板時犯規 (4 犯規 )",
  "爭搶籃板時犯規 (5 犯規 )"
];

const BP_FOULED_EVENTS = [
  "製造對手犯規",
  "主場優勢幫助球員製造犯規"
];

const BP_TURNOVER_EVENTS = [
  "切入上籃造成失誤(由於對手包夾防守)",
  "切入時發生失誤",
  "失誤！身體太累影響球員表現",
  "丟掉球權",
  "因為失誤導致快攻失敗",
  "在消耗時間時造成失誤",
  "走步違例",
  "不錯的傳球發生失誤",
  "勉強傳球造成失誤",
  "普通的傳球發生失誤",
  "製造妙傳發生失誤",
  "禁區3秒違例"
];

const BP_TEAM_TURNOVER_EVENTS = [
  "由於良好的防守智商，球隊無法在8秒內過半場",
  "由於防守方教練的良好技能，球隊無法在8秒內過半場",
  "由於球員技能問題，球隊無法在8秒內過半場",
  "球隊無法在8秒內過半場",
  "24秒進攻違例",
  "由於對手出色的防守，造成發球5秒違例",
  "防守方教練的良好佈陣造成發球5秒違例",
  "發球5秒違例"
];

const BP_OPPORTUNITY_MAPPING = {
  "良好機會": {
    hit: "good_opportunity_hit",
    made: "good_opportunity_made",
    defense_hit: "good_opportunity_defense_hit",
    defense_made: "good_opportunity_defense_made"
  },
  "普通機會": {
    hit: "normal_opportunity_hit",
    made: "normal_opportunity_made",
    defense_hit: "normal_opportunity_defense_hit",
    defense_made: "normal_opportunity_defense_made"
  },
  "極佳機會": {
    hit: "excellent_opportunity_hit",
    made: "excellent_opportunity_made",
    defense_hit: "excellent_opportunity_defense_hit",
    defense_made: "excellent_opportunity_defense_made"
  },
  "極差機會": {
    hit: "poor_opportunity_hit",
    made: "poor_opportunity_made",
    defense_hit: "poor_opportunity_defense_hit",
    defense_made: "poor_opportunity_defense_made"
  },
  "糟糕機會": {
    hit: "bad_opportunity_hit",
    made: "bad_opportunity_made",
    defense_hit: "bad_opportunity_defense_hit",
    defense_made: "bad_opportunity_defense_made"
  }
};
