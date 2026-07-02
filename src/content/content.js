const BP_HELPER_DEBUG = false;

function bpDebugLog(...args) {
  if (BP_HELPER_DEBUG) {
    console.log(...args);
  }
}

function bpDebugTable(...args) {
  if (BP_HELPER_DEBUG) {
    console.table(...args);
  }
}

function main() {
  bpDebugLog("[BasketPulse Helper] content script loaded");

  if (!isSkillsPage()) {
    bpDebugLog("[BasketPulse Helper] not skills page");
    return;
  }

  waitForTableAndInit();
}

const BP_BASE_URL = "https://www.basketpulse.com";
const TRAINING_OVERVIEW_URL = `${BP_BASE_URL}/tw/Training/overview`;

const TRAINING_OVERVIEW_HTML_CACHE_KEY = "bp_training_overview_html";
const TRAINING_OVERVIEW_HTML_CACHE_TIME_KEY = "bp_training_overview_html_time";

/**
 * 訓練總覽 HTML 快取時間。
 * 目前設定 10 分鐘。
 */
const TRAINING_OVERVIEW_CACHE_MAX_AGE = 10 * 60 * 1000;

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

/**
 * 判斷目前是否為 BasketPulse 球員技能頁
 */
function isSkillsPage() {
  return location.hostname === "www.basketpulse.com"
    && location.pathname.includes("/Players/skills");
}

/**
 * 等待表格出現後初始化
 */
function waitForTableAndInit() {
  const tables = findPlayerSkillTables();

  if (tables.length > 0) {
    initSkillsPage(tables);
    return;
  }

  let retryCount = 0;
  const maxRetry = 20;

  const timer = setInterval(() => {
    const tables = findPlayerSkillTables();

    if (tables.length > 0) {
      clearInterval(timer);
      initSkillsPage(tables);
      return;
    }

    retryCount += 1;

    if (retryCount >= maxRetry) {
      clearInterval(timer);
      console.warn("[BasketPulse Helper] 找不到球員技能表格");
    }
  }, 500);
}

/**
 * 尋找頁面上所有球員技能表格。
 *
 * 包含：
 * 1. 上方球員名單
 * 2. 下方出借球員
 *
 * 判斷方式：
 * 只要 table 裡有 /Player/{id}/description 連結，就視為球員表格。
 */
function findPlayerSkillTables() {
  const tables = [...document.querySelectorAll("table")];

  return tables.filter(table => {
    return table.querySelector('a[href*="/Player/"][href*="/description"]');
  });
}

/**
 * 初始化球員技能頁
 *
 * 注意：
 * 這裡只建立工具列與擴充列。
 * 不會自動讀取訓練總覽。
 * 玩家需要自行按按鈕才會執行讀取。
 */
function initSkillsPage(tables) {
  if (!tables || tables.length === 0) {
    console.warn("[BasketPulse Helper] tables is empty");
    return;
  }

  if (document.body.dataset.bpHelperInit === "1") {
    bpDebugLog("[BasketPulse Helper] already initialized");
    return;
  }

  document.body.dataset.bpHelperInit = "1";

  bpDebugLog("[BasketPulse Helper] init skills page");

  const players = parsePlayersFromTables(tables);

  bpDebugLog("[BasketPulse Helper] players:", players.map(player => ({
    id: player.id,
    name: player.name,
    href: player.href,
    tableIndex: player.tableIndex,
    isLoanLike: player.isLoanLike
  })));

  if (players.length === 0) {
    console.warn("[BasketPulse Helper] 沒有解析到任何球員");
    return;
  }

  const firstTable = tables[0];

  addToolbar(firstTable, players);

  tables.forEach(table => {
    const tablePlayers = players.filter(player => player.table === table);
    enhanceTable(table, tablePlayers);
  });

  setStatusText(`已準備完成，共偵測到 ${players.length} 位球員，請點選「載入潛力 / 訓練資料」`);
}

/**
 * 從多個球員技能表格解析球員。
 *
 * 會包含：
 * - 球員名單
 * - 出借球員
 */
function parsePlayersFromTables(tables) {
  const seenPlayerIds = new Set();
  const players = [];

  tables.forEach((table, tableIndex) => {
    const tablePlayers = parsePlayersFromOneTable(table, tableIndex);

    tablePlayers.forEach(player => {
      /**
       * 如果同一個球員在頁面上重複出現，只保留第一筆。
       */
      if (seenPlayerIds.has(player.id)) {
        return;
      }

      seenPlayerIds.add(player.id);
      players.push(player);
    });
  });

  return players;
}

/**
 * 從單一 table 解析球員。
 */
function parsePlayersFromOneTable(table, tableIndex) {
  const rows = [...table.querySelectorAll("tbody tr")];

  return rows
    .map(row => {
      const link =
        row.querySelector("a.huge-table__player[href*='/Player/'][href*='/description']")
        || row.querySelector("a[href*='/Player/'][href*='/description']");

      const href = link?.getAttribute("href") || "";
      const match = href.match(/\/Player\/(\d+)\/description/);

      const playerId = match?.[1] || "";
      const playerName = normalizeText(link?.textContent || "");

      return {
        id: playerId,
        name: playerName,
        href,
        row,
        table,
        tableIndex,
        isLoanLike: isLoanLikePlayerRow(row, table)
      };
    })
    .filter(player => player.id && player.name);
}

/**
 * 判斷該列是否可能是出租 / 出借球員。
 * 目前只做標記，不影響功能。
 */
function isLoanLikePlayerRow(row, table) {
  const rowText = normalizeText(row?.textContent || "");
  const rowClassName = row?.getAttribute("class") || "";

  const tableTitleText = getTextNearTableTitle(table);

  return /出租|出借|租借|loan|Loan|LOAN/i.test(rowText)
    || /loan/i.test(rowClassName)
    || /出租|出借|租借|loan/i.test(tableTitleText);
}

/**
 * 取得 table 附近的標題文字。
 * 用於判斷該 table 是否為「出借球員」區塊。
 */
function getTextNearTableTitle(table) {
  if (!table) return "";

  let current = table.previousElementSibling;
  let depth = 0;
  const texts = [];

  while (current && depth < 5) {
    texts.push(normalizeText(current.textContent || ""));
    current = current.previousElementSibling;
    depth += 1;
  }

  return texts.join(" ");
}

/**
 * 新增工具列
 */
function addToolbar(table, players) {
  if (document.querySelector("#bp-helper-toolbar")) {
    return;
  }

  const toolbar = document.createElement("div");
  toolbar.id = "bp-helper-toolbar";

  const title = document.createElement("span");
  title.className = "bp-helper-title";
  title.textContent = "BasketPulse Helper";

  const loadAllBtn = document.createElement("button");
  loadAllBtn.textContent = "載入潛力 / 訓練資料";
  loadAllBtn.dataset.action = "load-training";
  loadAllBtn.title = "從訓練總覽載入主要球員與出借球員的潛力素質、最新訓練結果";
  loadAllBtn.addEventListener("click", async () => {
    await loadAllPlayersTrainingOverview(players);
  });

  const clearCacheBtn = document.createElement("button");
  clearCacheBtn.textContent = "更新資料";
  clearCacheBtn.title = "清除本機快取，下次載入時重新讀取訓練總覽";
  clearCacheBtn.addEventListener("click", async () => {
    await clearTrainingOverviewCache();

    setStatusText("已清除快取，請重新載入潛力 / 訓練資料");
    alert("已更新資料快取，請再次點選「載入潛力 / 訓練資料」。");
  });

  const exportMainImageBtn = document.createElement("button");
  exportMainImageBtn.textContent = "匯出圖片";
  exportMainImageBtn.title = "將主要球員名單匯出成 PNG 圖片";
  exportMainImageBtn.addEventListener("click", async () => {
    await exportMainPlayersTableImage();
  });

  const toggleBtn = document.createElement("button");
  toggleBtn.textContent = "隱藏資料列";
  toggleBtn.dataset.visible = "1";
  toggleBtn.title = "顯示或隱藏潛力素質與訓練結果列";

  toggleBtn.addEventListener("click", () => {
    const isVisible = toggleBtn.dataset.visible === "1";

    document
      .querySelectorAll(".bp-analysis-row, .bp-training-row")
      .forEach(row => {
        /**
         * 只有有資料的列才參與顯示 / 隱藏。
         * 沒資料的列永遠保持隱藏。
         */
        if (row.dataset.hasData !== "1") {
          row.style.display = "none";
          return;
        }

        row.classList.toggle("bp-helper-hidden", isVisible);
      });

    toggleBtn.dataset.visible = isVisible ? "0" : "1";
    toggleBtn.textContent = isVisible ? "顯示資料列" : "隱藏資料列";

    setStatusText(isVisible ? "已隱藏資料列" : "已顯示資料列");
  });

  const status = document.createElement("span");
  status.id = "bp-helper-status";
  status.className = "bp-helper-status";
  status.textContent = "已準備完成，請點選「載入潛力 / 訓練資料」";

  toolbar.appendChild(title);
  toolbar.appendChild(loadAllBtn);
  toolbar.appendChild(clearCacheBtn);
  toolbar.appendChild(exportMainImageBtn);
  toolbar.appendChild(toggleBtn);
  toolbar.appendChild(status);

  const insertTarget = findToolbarInsertTarget(table);
  insertTarget.after(toolbar);
}

/**
 * 找工具列插入位置
 */
function findToolbarInsertTarget(table) {
  const title = document.querySelector(".content-top__title");
  if (title) return title;

  const h1 = document.querySelector("h1");
  if (h1) return h1;

  return table;
}

/**
 * 增強表格：每個球員列下面插入兩列
 */
function enhanceTable(table, players) {
  players.forEach(player => {
    if (player.row.dataset.bpEnhanced === "1") {
      return;
    }

    player.row.dataset.bpEnhanced = "1";
    player.row.classList.add("bp-original-player-row");
    player.row.dataset.playerId = player.id;

    const analysisRow = createExtraRow(table, "潛力素質", "bp-analysis-row");
    const trainingRow = createExtraRow(table, "訓練結果", "bp-training-row");

    analysisRow.dataset.playerId = player.id;
    analysisRow.dataset.playerName = player.name;

    trainingRow.dataset.playerId = player.id;
    trainingRow.dataset.playerName = player.name;

    /**
     * 插入順序：
     * 原球員列
     * 潛力素質列
     * 訓練結果列
     */
    player.row.after(trainingRow);
    player.row.after(analysisRow);
  });
}

/**
 * 建立額外列
 *
 * 需求：
 * - 初始狀態隱藏。
 * - 沒資料時保持隱藏，不佔空間。
 * - 有資料時才顯示。
 */
function createExtraRow(table, label, className) {
  const headers = [...table.querySelectorAll("thead th")];

  const firstSkillIndex = headers.findIndex(th => {
    const name = th.getAttribute("name") || "";
    const dataColTitle = th.dataset.coltitle || "";
    const text = normalizeText(th.textContent || "");

    return name === "health"
      || dataColTitle === "health"
      || text === "健"
      || text.includes("健");
  });

  const safeFirstSkillIndex = firstSkillIndex === -1 ? 8 : firstSkillIndex;

  const tr = document.createElement("tr");
  tr.className = className;

  /**
   * 預設隱藏。
   * 讀取後若整列有資料，fillExtraRow() 會顯示。
   */
  tr.style.display = "none";
  tr.dataset.hasData = "0";

  const labelTd = document.createElement("td");
  labelTd.colSpan = safeFirstSkillIndex;
  labelTd.className = "bp-extra-label";
  labelTd.textContent = label;

  tr.appendChild(labelTd);

  SKILL_COLUMNS.forEach(skillKey => {
    const td = document.createElement("td");
    td.className = "bp-extra-cell bp-neutral";
    td.dataset.colName = skillKey;
    td.title = SKILL_LABELS[skillKey] || skillKey;

    /**
     * 初始狀態空白。
     */
    td.textContent = "";

    tr.appendChild(td);
  });

  return tr;
}

/**
 * 讀取全隊球員訓練總覽
 *
 * 加速重點：
 * - 只抓一次 Training overview HTML。
 * - 使用快取。
 * - 同一份 HTML 解析所有球員。
 */
async function loadAllPlayersTrainingOverview(players) {
  if (!players || players.length === 0) {
    alert("沒有球員可載入");
    return;
  }

  const loadAllBtn = [...document.querySelectorAll("#bp-helper-toolbar button")]
    .find(button => button.dataset.action === "load-training");

  setButtonBusy(loadAllBtn, true);

  try {
    setStatusText(`正在載入潛力 / 訓練資料，共 ${players.length} 位球員...`);

    const html = await getTrainingOverviewHtmlWithCache();

    let successCount = 0;
    let noDataCount = 0;
    let errorCount = 0;

    for (const player of players) {
      try {
        const ok = await loadOnePlayerTrainingOverviewFromHtml(player, html, {
          silentLoading: true
        });

        if (ok) {
          successCount += 1;
        } else {
          noDataCount += 1;
        }
      } catch (error) {
        console.error("[BasketPulse Helper] load player failed:", player, error);
        errorCount += 1;
      }
    }

    setStatusText(`載入完成：成功 ${successCount} 位，無資料 ${noDataCount} 位，錯誤 ${errorCount} 位`);
  } catch (error) {
    console.error("[BasketPulse Helper] 載入潛力 / 訓練資料失敗:", error);

    setStatusText(`載入失敗：${error.message || error}`);
    alert(`載入失敗：${error.message || error}`);
  } finally {
    setButtonBusy(loadAllBtn, false);
  }
}

/**
 * 載入單一球員的訓練總覽資料。
 *
 * 正式版工具列已不提供單一球員測試按鈕，
 * 但保留此 function 方便未來維護或擴充。
 */
async function loadOnePlayerTrainingOverview(player) {
  const analysisRow = document.querySelector(`.bp-analysis-row[data-player-id="${player.id}"]`);
  const trainingRow = document.querySelector(`.bp-training-row[data-player-id="${player.id}"]`);

  if (!analysisRow || !trainingRow) {
    console.warn("[BasketPulse Helper] 找不到擴充列:", player);
    return false;
  }

  setStatusText(`正在從訓練總覽讀取 ${player.name}...`);
  setRowLoading(analysisRow);
  setRowLoading(trainingRow);

  try {
    const data = await fetchAndParseTrainingOverviewForPlayer(player.id);

    bpDebugLog("[BasketPulse Helper] training overview player data:", {
      player,
      data
    });

    if (!data) {
      /**
       * 找不到資料時保持隱藏，不佔空間。
       */
      clearExtraRow(analysisRow);
      clearExtraRow(trainingRow);

      setStatusText(`訓練總覽找不到 ${player.name}，已略過`);
      return false;
    }

    fillExtraRow(analysisRow, data.potential);
    fillExtraRow(trainingRow, data.training);

    setStatusText(`已完成 ${player.name}：潛力與訓練成果已填入`);

    return true;
  } catch (error) {
    console.error("[BasketPulse Helper] 訓練總覽解析錯誤:", player, error);

    setRowError(analysisRow);
    setRowError(trainingRow);
    setStatusText(`讀取 ${player.name} 失敗：${error.message || error}`);

    return false;
  }
}

/**
 * 使用已抓好的 HTML 載入單一球員。
 * 給全隊讀取使用，避免每位球員都重新 fetch。
 */
async function loadOnePlayerTrainingOverviewFromHtml(player, html, options = {}) {
  const analysisRow = document.querySelector(`.bp-analysis-row[data-player-id="${player.id}"]`);
  const trainingRow = document.querySelector(`.bp-training-row[data-player-id="${player.id}"]`);

  if (!analysisRow || !trainingRow) {
    console.warn("[BasketPulse Helper] 找不到擴充列:", player);
    return false;
  }

  if (!options.silentLoading) {
    setStatusText(`正在解析 ${player.name}...`);
    setRowLoading(analysisRow);
    setRowLoading(trainingRow);
  }

  const data = parseTrainingOverviewHtmlForPlayer(html, player.id);

  bpDebugLog("[BasketPulse Helper] training overview player data:", {
    player,
    data
  });

  if (!data) {
    clearExtraRow(analysisRow);
    clearExtraRow(trainingRow);
    return false;
  }

  fillExtraRow(analysisRow, data.potential);
  fillExtraRow(trainingRow, data.training);

  /**
   * 如果該球員潛力與訓練都完全沒有資料，
   * 也算作無資料。
   */
  if (!hasAnySkillValue(data.potential) && !hasAnySkillValue(data.training)) {
    return false;
  }

  return true;
}

/**
 * 抓訓練總覽並解析指定球員
 */
async function fetchAndParseTrainingOverviewForPlayer(playerId) {
  bpDebugLog("[BasketPulse Helper] get training overview:", TRAINING_OVERVIEW_URL);

  const html = await getTrainingOverviewHtmlWithCache();

  const data = parseTrainingOverviewHtmlForPlayer(html, playerId);

  return data;
}

/**
 * 取得訓練總覽 HTML。
 *
 * 加速策略：
 * - 10 分鐘內使用 chrome.storage.local 快取。
 * - 避免反覆 fetch 重頁面。
 */
async function getTrainingOverviewHtmlWithCache() {
  const cached = await chrome.storage.local.get([
    TRAINING_OVERVIEW_HTML_CACHE_KEY,
    TRAINING_OVERVIEW_HTML_CACHE_TIME_KEY
  ]);

  const cachedHtml = cached[TRAINING_OVERVIEW_HTML_CACHE_KEY];
  const cachedTime = cached[TRAINING_OVERVIEW_HTML_CACHE_TIME_KEY] || 0;

  const now = Date.now();

  if (cachedHtml && now - cachedTime < TRAINING_OVERVIEW_CACHE_MAX_AGE) {
    bpDebugLog("[BasketPulse Helper] use cached training overview html");
    return cachedHtml;
  }

  bpDebugLog("[BasketPulse Helper] fetch fresh training overview html:", TRAINING_OVERVIEW_URL);

  const html = await fetchHtmlByBackground(TRAINING_OVERVIEW_URL);

  await chrome.storage.local.set({
    [TRAINING_OVERVIEW_HTML_CACHE_KEY]: html,
    [TRAINING_OVERVIEW_HTML_CACHE_TIME_KEY]: now
  });

  return html;
}

/**
 * 清除訓練總覽 HTML 快取
 */
async function clearTrainingOverviewCache() {
  await chrome.storage.local.remove([
    TRAINING_OVERVIEW_HTML_CACHE_KEY,
    TRAINING_OVERVIEW_HTML_CACHE_TIME_KEY
  ]);
}

/**
 * 從訓練總覽 HTML 解析指定球員
 *
 * 回傳格式：
 * {
 *   playerId,
 *   playerName,
 *   potential: {
 *     health: "+69%",
 *     jump: "+5%",
 *     ...
 *   },
 *   training: {
 *     health: "+2",
 *     exp: "+3",
 *     ...
 *   },
 *   values: {
 *     health: "100%",
 *     exp: "11",
 *     ...
 *   }
 * }
 */
function parseTrainingOverviewHtmlForPlayer(html, playerId) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const playerLink = findPlayerLinkInTrainingOverviewDoc(doc, playerId);

  if (!playerLink) {
    bpDebugLog("[BasketPulse Helper] training overview cannot find player link:", playerId);
    debugPrintTrainingOverviewPlayerLinks(doc);
    return null;
  }

  const row = playerLink.closest("tr");

  if (!row) {
    bpDebugLog("[BasketPulse Helper] player link has no row:", playerId);
    return null;
  }

  const table = row.closest("table");

  if (!table) {
    bpDebugLog("[BasketPulse Helper] player row has no table:", playerId);
    return null;
  }

  const headers = [...table.querySelectorAll("thead th")].map((th, index) => {
    return {
      index,
      key: normalizeTrainingOverviewHeaderKey(th),
      title: th.getAttribute("title") || normalizeText(th.textContent || "")
    };
  });

  bpDebugLog("[BasketPulse Helper] training overview headers:", headers);

  const cells = [...row.children];

  const potential = createEmptySkillData();
  const training = createEmptySkillData();
  const values = createEmptySkillData();

  headers.forEach(header => {
    const key = header.key;

    if (!SKILL_COLUMNS.includes(key)) {
      return;
    }

    const cell = cells[header.index];

    if (!cell) {
      return;
    }

    const mainValue = normalizeText(
      cell.querySelector(".training__skill-item--main")?.textContent || ""
    );

    const potentialValue = extractPotentialFromTrainingOverviewCell(cell);
    const trainingValue = extractTrainingGainFromTrainingOverviewCell(cell);

    values[key] = mainValue || null;

    /**
     * 潛力不是一定會有。
     * 沒有就保持 null，畫面會隱藏空資料列。
     */
    potential[key] = potentialValue || null;

    /**
     * 訓練成果不是一定會有。
     * 新球員或未訓練欄位保持 null，畫面會隱藏空資料列。
     */
    training[key] = trainingValue || null;
  });

  const playerName = normalizeText(playerLink.textContent || "");

  const result = {
    playerId: String(playerId),
    playerName,
    potential,
    training,
    values
  };

  bpDebugLog("[BasketPulse Helper] parsed training overview result:", result);

  return result;
}

/**
 * 在訓練總覽 HTML 裡尋找球員連結。
 *
 * 為了兼容不同語系或出租球員區塊，
 * 不限定 href 結尾完全一樣，只要包含 /Player/{id}/ 且含 description 即可。
 */
function findPlayerLinkInTrainingOverviewDoc(doc, playerId) {
  return doc.querySelector(`a[href*="/Player/${playerId}/"][href*="description"]`)
    || doc.querySelector(`a[href*="/Player/${playerId}/description"]`)
    || doc.querySelector(`a[href*="/Player/${playerId}"]`);
}

/**
 * 解析訓練總覽表頭 key
 */
function normalizeTrainingOverviewHeaderKey(th) {
  if (!th) return "";

  const dataColTitle = th.dataset.coltitle || "";
  const name = th.getAttribute("name") || "";
  const title = normalizeText(th.getAttribute("title") || "");
  const text = normalizeText(th.textContent || "");

  const raw = dataColTitle || name || title || text;

  const map = {
    health: "health",
    jump: "jump",
    speed: "speed",
    toughness: "toughness",
    "2c": "2c",
    "2m": "2m",
    "3pt": "3pt",
    rebounds: "rebounds",
    cs: "cs",
    diq: "diq",
    dribbling: "dribbling",
    passing: "passing",
    oiq: "oiq",
    exp: "exp",

    "健康": "health",
    "健": "health",
    "彈跳": "jump",
    "彈": "jump",
    "速度": "speed",
    "速": "speed",
    "韌性": "toughness",
    "韌": "toughness",
    "近投": "2c",
    "近": "2c",
    "中投": "2m",
    "中": "2m",
    "三分": "3pt",
    "三分球": "3pt",
    "3": "3pt",
    "籃板": "rebounds",
    "籃": "rebounds",
    "阻攻": "cs",
    "封阻": "cs",
    "破": "cs",
    "防守智商": "diq",
    "防I": "diq",
    "防i": "diq",
    "運球": "dribbling",
    "運": "dribbling",
    "傳球": "passing",
    "傳": "passing",
    "進攻智商": "oiq",
    "攻I": "oiq",
    "攻i": "oiq",
    "經驗": "exp",
    "經": "exp"
  };

  return map[raw] || map[text] || map[title] || raw;
}

/**
 * 從訓練總覽 td 解析潛力
 *
 * 來源範例：
 * <td title="潛力: +69%">
 *
 * 注意：
 * - 有些球員不會有潛力。
 * - 沒有時回傳 null。
 */
function extractPotentialFromTrainingOverviewCell(cell) {
  if (!cell) return null;

  const title = cell.getAttribute("title") || "";

  const match = title.match(/潛力\s*[:：]\s*([+-]?\d+\s*%)/);

  if (!match) {
    return null;
  }

  return normalizePercentValue(match[1]);
}

/**
 * 從訓練總覽 td 解析最新訓練進步點數
 *
 * 注意：
 * - 新球員可能沒有訓練資料。
 * - 沒資料時回傳 null。
 * - 不直接依賴整格文字，避免抓錯。
 */
function extractTrainingGainFromTrainingOverviewCell(cell) {
  if (!cell) return null;

  /**
   * 第一優先：
   * 從技能區塊中找 span[title="進步點數"]。
   */
  const skillBlock = cell.querySelector(".training__skill-block");

  if (skillBlock) {
    const values = [...skillBlock.querySelectorAll('span[title="進步點數"]')]
      .map(span => normalizeText(span.textContent || ""))
      .filter(value => /^[+-]\d+$/.test(value));

    if (values.length > 0) {
      return values[0];
    }
  }

  /**
   * 第二優先：
   * 直接從 cell 找所有進步點數。
   */
  const fallbackValues = [...cell.querySelectorAll('span[title="進步點數"]')]
    .map(span => normalizeText(span.textContent || ""))
    .filter(value => /^[+-]\d+$/.test(value));

  if (fallbackValues.length > 0) {
    return fallbackValues[0];
  }

  return null;
}

/**
 * 印出訓練總覽中所有球員連結。
 *
 * 正式版預設不輸出，只有 BP_HELPER_DEBUG = true 時才會印出。
 */
function debugPrintTrainingOverviewPlayerLinks(doc) {
  if (!BP_HELPER_DEBUG) {
    return;
  }

  const links = [...doc.querySelectorAll('a[href*="/Player/"]')]
    .map((a, index) => {
      const href = a.getAttribute("href") || "";
      const match = href.match(/\/Player\/(\d+)/);

      return {
        index,
        id: match?.[1] || "",
        name: normalizeText(a.textContent || ""),
        href
      };
    })
    .filter(item => item.id);

  bpDebugLog("[BasketPulse Helper] training overview player links:", links);
  bpDebugTable(links);
}

/**
 * 透過 background 抓 HTML
 */
function fetchHtmlByBackground(url) {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== "string" || !url.trim()) {
      reject(new Error("fetchHtmlByBackground 收到空 URL"));
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "BP_FETCH_HTML",
        url
      },
      response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response && response.ok) {
          resolve(response.html);
          return;
        }

        reject(new Error(response?.error || "fetch html failed"));
      }
    );
  });
}

/**
 * 填入額外列資料
 *
 * 重點：
 * - value 沒有時顯示空白。
 * - 不顯示 "-"。
 * - 如果整列都沒有資料，直接隱藏該列。
 */
function fillExtraRow(row, data) {
  if (!row) return;

  let hasAnyValue = false;

  row.querySelectorAll("td[data-col-name]").forEach(td => {
    const key = td.dataset.colName;
    const value = data?.[key];

    if (value !== null && value !== undefined && String(value).trim() !== "") {
      hasAnyValue = true;
    }

    td.textContent = value || "";

    td.classList.remove(
      "bp-positive",
      "bp-negative",
      "bp-neutral",
      "bp-loading",
      "bp-error"
    );

    if (String(value || "").startsWith("+")) {
      td.classList.add("bp-positive");
    } else if (String(value || "").startsWith("-")) {
      td.classList.add("bp-negative");
    } else {
      td.classList.add("bp-neutral");
    }
  });

  if (hasAnyValue) {
    row.style.display = "";
    row.dataset.hasData = "1";
  } else {
    row.style.display = "none";
    row.dataset.hasData = "0";
  }
}

/**
 * 清空額外列，並隱藏。
 */
function clearExtraRow(row) {
  if (!row) return;

  row.querySelectorAll("td[data-col-name]").forEach(td => {
    td.textContent = "";

    td.classList.remove(
      "bp-positive",
      "bp-negative",
      "bp-loading",
      "bp-error"
    );

    td.classList.add("bp-neutral");
  });

  row.style.display = "none";
  row.dataset.hasData = "0";
}

/**
 * 設定某列為讀取中
 */
function setRowLoading(row) {
  if (!row) return;

  row.style.display = "";
  row.dataset.hasData = "1";

  row.querySelectorAll("td[data-col-name]").forEach(td => {
    td.textContent = "...";

    td.classList.remove(
      "bp-positive",
      "bp-negative",
      "bp-neutral",
      "bp-error"
    );

    td.classList.add("bp-loading");
  });
}

/**
 * 設定某列為無資料。
 *
 * 需求：
 * - 無資料時完全隱藏。
 */
function setRowNoData(row) {
  clearExtraRow(row);
}

/**
 * 設定某列為錯誤
 */
function setRowError(row) {
  if (!row) return;

  row.style.display = "";
  row.dataset.hasData = "1";

  row.querySelectorAll("td[data-col-name]").forEach(td => {
    td.textContent = "!";

    td.classList.remove(
      "bp-positive",
      "bp-negative",
      "bp-neutral",
      "bp-loading"
    );

    td.classList.add("bp-error");
  });
}

/**
 * 建立空技能資料
 */
function createEmptySkillData() {
  return {
    health: null,
    jump: null,
    speed: null,
    toughness: null,
    "2c": null,
    "2m": null,
    "3pt": null,
    rebounds: null,
    cs: null,
    diq: null,
    dribbling: null,
    passing: null,
    oiq: null,
    exp: null
  };
}

/**
 * 檢查技能資料是否有任何有效值
 */
function hasAnySkillValue(data) {
  if (!data) return false;

  return SKILL_COLUMNS.some(key => {
    const value = data[key];
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
}

/**
 * 設定狀態文字
 */
function setStatusText(text) {
  const status = document.querySelector("#bp-helper-status");

  if (status) {
    status.textContent = text;
  }
}

/**
 * 設定按鈕忙碌狀態
 */
function setButtonBusy(button, isBusy) {
  if (!button) return;

  if (isBusy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = "載入中...";
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || "載入潛力 / 訓練資料";
  }
}

/**
 * 匯出主要球員表格為 PNG 圖片。
 *
 * 只匯出上方主要球員名單，不包含出借球員。
 */
async function exportMainPlayersTableImage() {
  let restore = null;

  try {
    if (typeof html2canvas !== "function") {
      alert("找不到 html2canvas，請確認 manifest.json 已載入 src/vendor/html2canvas.min.js");
      return;
    }

    setStatusText("正在產生主要球員圖片...");

    const exportTarget = findMainPlayersExportTarget();

    if (!exportTarget) {
      alert("找不到主要球員表格，無法匯出圖片");
      setStatusText("匯出失敗：找不到主要球員表格");
      return;
    }

    /**
     * 匯出前暫時調整，避免 sticky / transform / overflow 影響截圖。
     */
    restore = prepareElementForImageExport(exportTarget);

    const canvas = await html2canvas(exportTarget, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight
    });

    if (restore) {
      restore();
      restore = null;
    }

    const filename = createExportImageFilename();

    downloadCanvasAsPng(canvas, filename);

    setStatusText(`已匯出圖片：${filename}`);
  } catch (error) {
    if (restore) {
      restore();
    }

    console.error("[BasketPulse Helper] 匯出主要球員圖片失敗:", error);

    setStatusText(`匯出圖片失敗：${error.message || error}`);
    alert(`匯出圖片失敗：${error.message || error}`);
  }
}

/**
 * 找主要球員匯出目標。
 *
 * 目前邏輯：
 * 1. 找第一個球員技能 table。
 * 2. 盡量往外找包含標題「球員名單」的容器。
 * 3. 找不到容器時就只匯出 table。
 */
function findMainPlayersExportTarget() {
  const tables = findPlayerSkillTables();

  if (!tables || tables.length === 0) {
    return null;
  }

  const mainTable = tables[0];

  /**
   * 常見情況：表格外層會有 card / panel / content block。
   * 往上找較完整的容器，讓匯出包含「球員名單」標題。
   */
  const container =
    mainTable.closest(".content-box")
    || mainTable.closest(".box")
    || mainTable.closest(".panel")
    || mainTable.closest(".card")
    || mainTable.closest(".table-responsive")
    || mainTable.parentElement;

  return container || mainTable;
}

/**
 * 匯出前準備元素。
 *
 * 目的：
 * - 暫時讓 overflow 可見。
 * - 避免表格被捲動容器裁切。
 * - 匯出後恢復原本 style。
 */
function prepareElementForImageExport(element) {
  const changedElements = [];

  let current = element;

  while (current && current !== document.body) {
    const oldStyle = {
      element: current,
      overflow: current.style.overflow,
      overflowX: current.style.overflowX,
      overflowY: current.style.overflowY,
      maxHeight: current.style.maxHeight,
      height: current.style.height
    };

    changedElements.push(oldStyle);

    current.style.overflow = "visible";
    current.style.overflowX = "visible";
    current.style.overflowY = "visible";
    current.style.maxHeight = "none";

    current = current.parentElement;
  }

  return function restore() {
    changedElements.forEach(item => {
      item.element.style.overflow = item.overflow;
      item.element.style.overflowX = item.overflowX;
      item.element.style.overflowY = item.overflowY;
      item.element.style.maxHeight = item.maxHeight;
      item.element.style.height = item.height;
    });
  };
}

/**
 * 下載 canvas 成 PNG。
 */
function downloadCanvasAsPng(canvas, filename) {
  const dataUrl = canvas.toDataURL("image/png");

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * 建立匯出圖片檔名。
 */
function createExportImageFilename() {
  const now = new Date();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");

  return `BasketPulse_主要球員技能_${yyyy}-${mm}-${dd}_${hh}${mi}.png`;
}

/**
 * 文字整理
 */
function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 百分比整理
 */
function normalizePercentValue(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim();
}

main();
