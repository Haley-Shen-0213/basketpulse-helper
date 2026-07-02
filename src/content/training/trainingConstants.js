// 專案路徑：src/content/training/trainingConstants.js
// 模組說明：球員訓練輔助功能專用常數。包含訓練總覽網址、快取 key、技能欄位、技能中文標籤與匯出範圍。

const TRAINING_OVERVIEW_URL = `${BP_BASE_URL}/tw/Training/overview`;

const TRAINING_OVERVIEW_HTML_CACHE_KEY = "bp_training_overview_html";
const TRAINING_OVERVIEW_HTML_CACHE_TIME_KEY = "bp_training_overview_html_time";
const TRAINING_OVERVIEW_CACHE_MAX_AGE = 10 * 60 * 1000;

const EXPORT_RANGE_MAIN = "main";
const EXPORT_RANGE_LOAN = "loan";
const EXPORT_RANGE_ALL = "all";
const EXPORT_RANGE_SELECTED = "selected";

const SKILL_COLUMNS = [
  "health",
  "jump",
  "speed",
  "toughness",
  "2c",
  "2m",
  "3pt",
  "rebounds",
  "cs",
  "diq",
  "dribbling",
  "passing",
  "oiq",
  "exp"
];

const SKILL_LABELS = {
  health: "健康",
  jump: "彈跳",
  speed: "速度",
  toughness: "韌性",
  "2c": "近投",
  "2m": "中投",
  "3pt": "三分",
  rebounds: "籃板",
  cs: "阻攻",
  diq: "防守智商",
  dribbling: "運球",
  passing: "傳球",
  oiq: "進攻智商",
  exp: "經驗"
};
