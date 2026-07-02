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

  if (!isSupportedBasketPulsePage()) {
    bpDebugLog("[BasketPulse Helper] not supported BasketPulse page");
    return;
  }

  waitForTableAndInit();
}


const BP_BASE_URL = "https://www.basketpulse.com";
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

/**
 * 判斷目前是否為 BasketPulse Helper 支援頁面。
 *
 * 支援頁面：
 * 1. 球員技能頁
 *    https://www.basketpulse.com/tw/Players/skills
 *
 * 2. 學校頁面
 *    https://www.basketpulse.com/tw/School/main
 */
function isSupportedBasketPulsePage() {
  return location.hostname === "www.basketpulse.com"
    && (
      location.pathname.includes("/Players/skills")
      || location.pathname.includes("/School/main")
    );
}

/**
 * 是否為球員技能頁
 */
function isSkillsPage() {
  return location.hostname === "www.basketpulse.com"
    && location.pathname.includes("/Players/skills");
}

/**
 * 是否為學校頁面
 */
function isSchoolMainPage() {
  return location.hostname === "www.basketpulse.com"
    && location.pathname.includes("/School/main");
}


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
 * 尋找頁面上所有包含球員的表格。
 *
 * 支援：
 * - /tw/Players/skills
 * - /tw/School/main
 *
 * 判斷方式：
 * 只要 table 裡面有 /Player/{id} 相關連結，就視為球員表格。
 */
function findPlayerSkillTables() {
  const tables = [...document.querySelectorAll("table")];

  return tables.filter(table => {
    return table.querySelector('a[href*="/Player/"]');
  });
}


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

  const players = parsePlayersFromTables(tables);

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

  const pageLabel = isSchoolMainPage() ? "學校頁面" : "球員技能頁";
  setStatusText(`${pageLabel} 已準備完成，共偵測到 ${players.length} 位球員`);
}

function parsePlayersFromTables(tables) {
  const seenPlayerIds = new Set();
  const players = [];

  tables.forEach((table, tableIndex) => {
    const tablePlayers = parsePlayersFromOneTable(table, tableIndex);

    tablePlayers.forEach(player => {
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
 *
 * 支援 href：
 * - /tw/Player/{id}/description
 * - /Player/{id}/description
 * - /tw/Player/{id}
 * - /Player/{id}
 *
 * 這樣可以同時支援：
 * - 球員技能頁
 * - 學校頁面 School/main
 */
function parsePlayersFromOneTable(table, tableIndex) {
  const rows = [...table.querySelectorAll("tbody tr")];

  return rows
    .map(row => {
      const link =
        row.querySelector("a.huge-table__player[href*='/Player/']")
        || row.querySelector("a[href*='/Player/']");

      const href = link?.getAttribute("href") || "";
      const match = href.match(/\/Player\/(\d+)/);

      const playerId = match?.[1] || "";
      const playerName = normalizeText(link?.textContent || "");

      return {
        id: playerId,
        name: playerName,
        href,
        row,
        table,
        tableIndex,
        isLoanLike: tableIndex > 0 || isLoanLikePlayerRow(row, table)
      };
    })
    .filter(player => player.id && player.name);
}


function isLoanLikePlayerRow(row, table) {
  const rowText = normalizeText(row?.textContent || "");
  const rowClassName = row?.getAttribute("class") || "";
  const tableTitleText = getTextNearTableTitle(table);

  return /出租|出借|租借|loan|Loan|LOAN/i.test(rowText)
    || /loan/i.test(rowClassName)
    || /出租|出借|租借|loan/i.test(tableTitleText);
}

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
 * 判斷目前頁面是否有出借 / 租借球員區塊。
 *
 * 判斷規則：
 * 1. 如果有球員來自第二個以上 table，視為有出借區塊。
 * 2. 如果玩家列被判斷為 loan-like，也視為有出借區塊。
 *
 * 用途：
 * - 有出借區塊時，匯出範圍顯示：
 *   主要球員 / 出借球員 / 全部球員 / 自選球員
 *
 * - 沒有出借區塊時，匯出範圍只顯示：
 *   全部球員 / 自選球員
 */
function hasLoanPlayersSection(players) {
  if (!players || players.length === 0) {
    return false;
  }

  return players.some(player => {
    return Number(player.tableIndex) > 0 || player.isLoanLike === true;
  });
}

function addToolbar(table, players) {
  if (document.querySelector("#bp-helper-toolbar")) {
    return;
  }

  const hasLoanSection = hasLoanPlayersSection(players);

  const toolbar = document.createElement("div");
  toolbar.id = "bp-helper-toolbar";
  toolbar.dataset.hasLoanSection = hasLoanSection ? "1" : "0";

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

  const exportRangeLabel = document.createElement("span");
  exportRangeLabel.className = "bp-export-range-label";
  exportRangeLabel.textContent = "匯出範圍";

  const exportRangeSelect = document.createElement("select");
  exportRangeSelect.id = "bp-helper-export-range";
  exportRangeSelect.title = "選擇要匯出的球員範圍";

  /**
   * 第二版修正：
   * 如果頁面沒有出借 / 租借球員區塊，
   * 就不顯示「主要球員」與「出借球員」。
   *
   * 沒有出借區塊時只保留：
   * - 全部球員
   * - 自選球員
   */
  if (hasLoanSection) {
    exportRangeSelect.innerHTML = `
      <option value="${EXPORT_RANGE_MAIN}">主要球員</option>
      <option value="${EXPORT_RANGE_LOAN}">出借球員</option>
      <option value="${EXPORT_RANGE_ALL}">全部球員</option>
      <option value="${EXPORT_RANGE_SELECTED}">自選球員</option>
    `;
  } else {
    exportRangeSelect.innerHTML = `
      <option value="${EXPORT_RANGE_ALL}">全部球員</option>
      <option value="${EXPORT_RANGE_SELECTED}">自選球員</option>
    `;
  }

  exportRangeSelect.addEventListener("change", () => {
    updateExportCustomMode();
  });

  const selectAllBtn = document.createElement("button");
  selectAllBtn.textContent = "全選";
  selectAllBtn.className = "bp-selected-only-control";
  selectAllBtn.title = "勾選所有球員";
  selectAllBtn.style.display = "none";
  selectAllBtn.addEventListener("click", () => {
    setAllExportCheckboxesChecked(true);
    setStatusText("已全選所有球員");
  });

  const unselectAllBtn = document.createElement("button");
  unselectAllBtn.textContent = "取消全選";
  unselectAllBtn.className = "bp-selected-only-control";
  unselectAllBtn.title = "取消勾選所有球員";
  unselectAllBtn.style.display = "none";
  unselectAllBtn.addEventListener("click", () => {
    setAllExportCheckboxesChecked(false);
    setStatusText("已取消全選所有球員");
  });

  const selectMainBtn = document.createElement("button");
  selectMainBtn.textContent = "只選主要";
  selectMainBtn.className = "bp-selected-only-control bp-loan-section-only-control";
  selectMainBtn.title = "只勾選主要球員";
  selectMainBtn.style.display = "none";
  selectMainBtn.dataset.requiresLoanSection = "1";
  selectMainBtn.addEventListener("click", () => {
    selectPlayersByTableType("main");
    setStatusText("已選取主要球員");
  });

  const selectLoanBtn = document.createElement("button");
  selectLoanBtn.textContent = "只選出借";
  selectLoanBtn.className = "bp-selected-only-control bp-loan-section-only-control";
  selectLoanBtn.title = "只勾選出借球員";
  selectLoanBtn.style.display = "none";
  selectLoanBtn.dataset.requiresLoanSection = "1";
  selectLoanBtn.addEventListener("click", () => {
    selectPlayersByTableType("loan");
    setStatusText("已選取出借球員");
  });

  const exportImageBtn = document.createElement("button");
  exportImageBtn.textContent = "匯出圖片";
  exportImageBtn.title = "依照匯出範圍匯出 PNG 圖片";
  exportImageBtn.addEventListener("click", async () => {
    const range = getSelectedExportRange();
    await exportPlayersTableImageByRange(range);
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
  toolbar.appendChild(exportRangeLabel);
  toolbar.appendChild(exportRangeSelect);
  toolbar.appendChild(selectAllBtn);
  toolbar.appendChild(unselectAllBtn);

  /**
   * 只有真的有出借 / 租借區塊時，
   * 才加入「只選主要」與「只選出借」兩個快速選取按鈕。
   */
  if (hasLoanSection) {
    toolbar.appendChild(selectMainBtn);
    toolbar.appendChild(selectLoanBtn);
  }

  toolbar.appendChild(exportImageBtn);
  toolbar.appendChild(toggleBtn);
  toolbar.appendChild(status);

  const insertTarget = findToolbarInsertTarget(table);
  insertTarget.after(toolbar);

  updateExportCustomMode();
}


function findToolbarInsertTarget(table) {
  const title = document.querySelector(".content-top__title");
  if (title) return title;

  const h1 = document.querySelector("h1");
  if (h1) return h1;

  return table;
}

function enhanceTable(table, players) {
  players.forEach(player => {
    if (player.row.dataset.bpEnhanced === "1") {
      return;
    }

    player.row.dataset.bpEnhanced = "1";
    player.row.classList.add("bp-original-player-row");
    player.row.dataset.playerId = player.id;
    player.row.dataset.playerName = player.name;
    player.row.dataset.tableIndex = String(player.tableIndex);
    player.row.dataset.exportGroup = player.tableIndex === 0 ? "main" : "loan";

    addPlayerExportCheckbox(player);

    const analysisRow = createExtraRow(table, "潛力素質", "bp-analysis-row");
    const trainingRow = createExtraRow(table, "訓練結果", "bp-training-row");

    analysisRow.dataset.playerId = player.id;
    analysisRow.dataset.playerName = player.name;
    analysisRow.dataset.tableIndex = String(player.tableIndex);
    analysisRow.dataset.exportGroup = player.tableIndex === 0 ? "main" : "loan";

    trainingRow.dataset.playerId = player.id;
    trainingRow.dataset.playerName = player.name;
    trainingRow.dataset.tableIndex = String(player.tableIndex);
    trainingRow.dataset.exportGroup = player.tableIndex === 0 ? "main" : "loan";

    player.row.after(trainingRow);
    player.row.after(analysisRow);
  });
}

function addPlayerExportCheckbox(player) {
  if (!player || !player.row) return;

  const firstCell = player.row.querySelector("td");

  if (!firstCell) return;

  if (firstCell.querySelector(".bp-export-checkbox-wrap")) {
    return;
  }

  const wrap = document.createElement("label");
  wrap.className = "bp-export-checkbox-wrap";
  wrap.title = "勾選後可用「自選球員」匯出";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "bp-export-player-checkbox";
  checkbox.dataset.playerId = player.id;
  checkbox.dataset.playerName = player.name;
  checkbox.dataset.tableIndex = String(player.tableIndex);
  checkbox.dataset.exportGroup = player.tableIndex === 0 ? "main" : "loan";
  checkbox.checked = true;

  wrap.appendChild(checkbox);

  firstCell.prepend(wrap);
}

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
    td.textContent = "";
    tr.appendChild(td);
  });

  return tr;
}

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

    if (!data) {
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

  if (!data) {
    clearExtraRow(analysisRow);
    clearExtraRow(trainingRow);
    return false;
  }

  fillExtraRow(analysisRow, data.potential);
  fillExtraRow(trainingRow, data.training);

  if (!hasAnySkillValue(data.potential) && !hasAnySkillValue(data.training)) {
    return false;
  }

  return true;
}

async function fetchAndParseTrainingOverviewForPlayer(playerId) {
  const html = await getTrainingOverviewHtmlWithCache();
  return parseTrainingOverviewHtmlForPlayer(html, playerId);
}

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

  const html = await fetchHtmlByBackground(TRAINING_OVERVIEW_URL);

  await chrome.storage.local.set({
    [TRAINING_OVERVIEW_HTML_CACHE_KEY]: html,
    [TRAINING_OVERVIEW_HTML_CACHE_TIME_KEY]: now
  });

  return html;
}

async function clearTrainingOverviewCache() {
  await chrome.storage.local.remove([
    TRAINING_OVERVIEW_HTML_CACHE_KEY,
    TRAINING_OVERVIEW_HTML_CACHE_TIME_KEY
  ]);
}

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
    return null;
  }

  const table = row.closest("table");

  if (!table) {
    return null;
  }

  const headers = [...table.querySelectorAll("thead th")].map((th, index) => {
    return {
      index,
      key: normalizeTrainingOverviewHeaderKey(th),
      title: th.getAttribute("title") || normalizeText(th.textContent || "")
    };
  });

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
    potential[key] = potentialValue || null;
    training[key] = trainingValue || null;
  });

  const playerName = normalizeText(playerLink.textContent || "");

  return {
    playerId: String(playerId),
    playerName,
    potential,
    training,
    values
  };
}

function findPlayerLinkInTrainingOverviewDoc(doc, playerId) {
  return doc.querySelector(`a[href*="/Player/${playerId}/"][href*="description"]`)
    || doc.querySelector(`a[href*="/Player/${playerId}/description"]`)
    || doc.querySelector(`a[href*="/Player/${playerId}"]`);
}

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

function extractPotentialFromTrainingOverviewCell(cell) {
  if (!cell) return null;

  const title = cell.getAttribute("title") || "";
  const match = title.match(/潛力\s*[:：]\s*([+-]?\d+\s*%)/);

  if (!match) {
    return null;
  }

  return normalizePercentValue(match[1]);
}

function extractTrainingGainFromTrainingOverviewCell(cell) {
  if (!cell) return null;

  const skillBlock = cell.querySelector(".training__skill-block");

  if (skillBlock) {
    const values = [...skillBlock.querySelectorAll('span[title="進步點數"]')]
      .map(span => normalizeText(span.textContent || ""))
      .filter(value => /^[+-]\d+$/.test(value));

    if (values.length > 0) {
      return values[0];
    }
  }

  const fallbackValues = [...cell.querySelectorAll('span[title="進步點數"]')]
    .map(span => normalizeText(span.textContent || ""))
    .filter(value => /^[+-]\d+$/.test(value));

  if (fallbackValues.length > 0) {
    return fallbackValues[0];
  }

  return null;
}

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

function setRowNoData(row) {
  clearExtraRow(row);
}

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

function hasAnySkillValue(data) {
  if (!data) return false;

  return SKILL_COLUMNS.some(key => {
    const value = data[key];
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
}

function setStatusText(text) {
  const status = document.querySelector("#bp-helper-status");

  if (status) {
    status.textContent = text;
  }
}

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
 * 第二版新增：
 * 取得目前選擇的匯出範圍
 */
function getSelectedExportRange() {
  return document.querySelector("#bp-helper-export-range")?.value || EXPORT_RANGE_ALL;
}


/**
 * 第二版新增：
 * 切換自選球員模式。
 * 選擇「自選球員」時顯示 checkbox 與輔助按鈕。
 */
function updateExportCustomMode() {
  const range = getSelectedExportRange();
  const isSelectedMode = range === EXPORT_RANGE_SELECTED;
  const hasLoanSection = document.querySelector("#bp-helper-toolbar")?.dataset.hasLoanSection === "1";

  document.body.classList.toggle("bp-export-custom-mode", isSelectedMode);

  document.querySelectorAll(".bp-selected-only-control").forEach(button => {
    const requiresLoanSection = button.dataset.requiresLoanSection === "1";

    /**
     * 第二版修正：
     * 自選模式下才顯示快速選取按鈕。
     * 但如果頁面沒有出借區塊，
     * 就不要顯示「只選主要」與「只選出借」。
     */
    if (!isSelectedMode) {
      button.style.display = "none";
      return;
    }

    if (requiresLoanSection && !hasLoanSection) {
      button.style.display = "none";
      return;
    }

    button.style.display = "";
  });

  if (isSelectedMode) {
    setStatusText("自選球員模式：請勾選要匯出的球員");
  } else {
    const labelMap = {
      [EXPORT_RANGE_MAIN]: "主要球員",
      [EXPORT_RANGE_LOAN]: "出借球員",
      [EXPORT_RANGE_ALL]: "全部球員"
    };

    setStatusText(`匯出範圍：${labelMap[range] || "全部球員"}`);
  }
}


function setAllExportCheckboxesChecked(checked) {
  document.querySelectorAll(".bp-export-player-checkbox").forEach(checkbox => {
    checkbox.checked = checked;
  });
}

function selectPlayersByTableType(type) {
  document.querySelectorAll(".bp-export-player-checkbox").forEach(checkbox => {
    const group = checkbox.dataset.exportGroup;

    if (type === "main") {
      checkbox.checked = group === "main";
    } else if (type === "loan") {
      checkbox.checked = group === "loan";
    }
  });
}

/**
 * 第二版新增：
 * 依照匯出範圍匯出圖片
 */
async function exportPlayersTableImageByRange(range) {
  let restore = null;
  let temporaryElement = null;

  try {
    const hasLoanSection = document.querySelector("#bp-helper-toolbar")?.dataset.hasLoanSection === "1";

    /**
     * 如果頁面沒有出借 / 租借球員區塊，
     * 不使用「主要球員」或「出借球員」這種分區匯出，
     * 一律轉成「全部球員」。
     */
    if (!hasLoanSection && (range === EXPORT_RANGE_MAIN || range === EXPORT_RANGE_LOAN)) {
      range = EXPORT_RANGE_ALL;
    }

    if (typeof html2canvas !== "function") {
      alert("找不到 html2canvas，請確認 manifest.json 已載入 src/vendor/html2canvas.min.js");
      return;
    }

    const rangeLabel = getExportRangeLabel(range);

    setStatusText(`正在產生圖片：${rangeLabel}...`);

    let exportTarget = null;

    if (range === EXPORT_RANGE_MAIN) {
      exportTarget = findMainPlayersExportTarget();
    } else if (range === EXPORT_RANGE_LOAN) {
      exportTarget = findLoanPlayersExportTarget();
    } else if (range === EXPORT_RANGE_ALL) {
      temporaryElement = createTemporaryExportElementByRange(EXPORT_RANGE_ALL);
      exportTarget = temporaryElement;
    } else if (range === EXPORT_RANGE_SELECTED) {
      temporaryElement = createTemporaryExportElementByRange(EXPORT_RANGE_SELECTED);
      exportTarget = temporaryElement;
    } else {
      /**
       * 預設改成全部球員。
       * 尤其 School/main 頁面通常沒有主要 / 出借分區，
       * 用全部球員會比較符合使用者期待。
       */
      temporaryElement = createTemporaryExportElementByRange(EXPORT_RANGE_ALL);
      exportTarget = temporaryElement;
    }

    if (!exportTarget) {
      alert(`找不到可匯出的範圍：${rangeLabel}`);
      setStatusText(`匯出失敗：找不到${rangeLabel}`);
      return;
    }

    if (temporaryElement) {
      document.body.appendChild(temporaryElement);
    }

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

    if (temporaryElement) {
      temporaryElement.remove();
      temporaryElement = null;
    }

    const filename = createExportImageFilename(rangeLabel);

    downloadCanvasAsPng(canvas, filename);

    setStatusText(`已匯出圖片：${filename}`);
  } catch (error) {
    if (restore) {
      restore();
    }

    if (temporaryElement) {
      temporaryElement.remove();
    }

    console.error("[BasketPulse Helper] 匯出圖片失敗:", error);

    setStatusText(`匯出圖片失敗：${error.message || error}`);
    alert(`匯出圖片失敗：${error.message || error}`);
  }
}

function getExportRangeLabel(range) {
  const map = {
    [EXPORT_RANGE_MAIN]: "主要球員",
    [EXPORT_RANGE_LOAN]: "出借球員",
    [EXPORT_RANGE_ALL]: "全部球員",
    [EXPORT_RANGE_SELECTED]: "自選球員"
  };

  return map[range] || "主要球員";
}

function findMainPlayersExportTarget() {
  const tables = findPlayerSkillTables();

  if (!tables || tables.length === 0) {
    return null;
  }

  return findBestExportContainerForTable(tables[0]);
}

function findLoanPlayersExportTarget() {
  const tables = findPlayerSkillTables();

  if (!tables || tables.length < 2) {
    return null;
  }

  return findBestExportContainerForTable(tables[1]);
}

function findBestExportContainerForTable(table) {
  if (!table) return null;

  const container =
    table.closest(".content-box")
    || table.closest(".box")
    || table.closest(".panel")
    || table.closest(".card")
    || table.closest(".table-responsive")
    || table.parentElement;

  return container || table;
}

/**
 * 第二版新增：
 * 建立臨時匯出元素。
 *
 * 用於：
 * - 全部球員
 * - 自選球員
 *
 * 好處：
 * - 匯出圖片不會包含 checkbox
 * - 不會包含工具列
 * - 不會截到頁面左側選單
 */
function createTemporaryExportElementByRange(range) {
  const tables = findPlayerSkillTables();

  if (!tables || tables.length === 0) {
    return null;
  }

  const selectedPlayerIds = range === EXPORT_RANGE_SELECTED
    ? getSelectedExportPlayerIds()
    : null;

  if (range === EXPORT_RANGE_SELECTED && selectedPlayerIds.length === 0) {
    alert("尚未勾選任何球員，請至少選擇一位球員。");
    return null;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "bp-temp-export-wrapper";

  const title = document.createElement("div");
  title.className = "bp-temp-export-title";
  title.textContent = `BasketPulse Helper - ${getExportRangeLabel(range)}`;
  wrapper.appendChild(title);

  let appendedTableCount = 0;

  tables.forEach((table, tableIndex) => {
    const tableGroup = tableIndex === 0 ? "main" : "loan";

    if (range === EXPORT_RANGE_ALL) {
      const clonedSection = cloneTableSectionForExport(table, {
        tableIndex,
        tableGroup,
        selectedPlayerIds: null
      });

      if (clonedSection) {
        wrapper.appendChild(clonedSection);
        appendedTableCount += 1;
      }

      return;
    }

    if (range === EXPORT_RANGE_SELECTED) {
      const clonedSection = cloneTableSectionForExport(table, {
        tableIndex,
        tableGroup,
        selectedPlayerIds
      });

      if (clonedSection) {
        wrapper.appendChild(clonedSection);
        appendedTableCount += 1;
      }
    }
  });

  if (appendedTableCount === 0) {
    return null;
  }

  return wrapper;
}

/**
 * 第二版新增：
 * 複製指定 table 裡要匯出的球員列。
 */
function cloneTableSectionForExport(table, options = {}) {
  const tableIndex = options.tableIndex || 0;
  const tableGroup = options.tableGroup || "main";
  const selectedPlayerIds = options.selectedPlayerIds || null;

  const playerRows = [...table.querySelectorAll("tbody tr.bp-original-player-row")];

  const exportPlayerRows = playerRows.filter(row => {
    const playerId = row.dataset.playerId;

    if (!playerId) return false;

    if (selectedPlayerIds) {
      return selectedPlayerIds.includes(playerId);
    }

    return true;
  });

  if (exportPlayerRows.length === 0) {
    return null;
  }

  const section = document.createElement("div");
  section.className = "bp-temp-export-section";

  const sectionTitle = document.createElement("div");
  sectionTitle.className = "bp-temp-export-section-title";
  sectionTitle.textContent = tableIndex === 0 ? "主要球員" : "出借球員";
  section.appendChild(sectionTitle);

  const clonedTable = table.cloneNode(false);
  clonedTable.classList.add("bp-temp-export-table");

  const originalThead = table.querySelector("thead");
  if (originalThead) {
    const clonedThead = originalThead.cloneNode(true);
    removeExportCheckboxesFromElement(clonedThead);
    clonedTable.appendChild(clonedThead);
  }

  const clonedTbody = document.createElement("tbody");

  exportPlayerRows.forEach(originalPlayerRow => {
    const playerId = originalPlayerRow.dataset.playerId;

    const clonedPlayerRow = originalPlayerRow.cloneNode(true);
    removeExportCheckboxesFromElement(clonedPlayerRow);
    removeHelperOnlyClassesForExport(clonedPlayerRow);
    clonedTbody.appendChild(clonedPlayerRow);

    const analysisRow = table.querySelector(`tr.bp-analysis-row[data-player-id="${playerId}"]`);
    const trainingRow = table.querySelector(`tr.bp-training-row[data-player-id="${playerId}"]`);

    if (analysisRow && analysisRow.dataset.hasData === "1" && !analysisRow.classList.contains("bp-helper-hidden")) {
      const clonedAnalysisRow = analysisRow.cloneNode(true);
      removeHelperOnlyClassesForExport(clonedAnalysisRow);
      clonedAnalysisRow.style.display = "";
      clonedTbody.appendChild(clonedAnalysisRow);
    }

    if (trainingRow && trainingRow.dataset.hasData === "1" && !trainingRow.classList.contains("bp-helper-hidden")) {
      const clonedTrainingRow = trainingRow.cloneNode(true);
      removeHelperOnlyClassesForExport(clonedTrainingRow);
      clonedTrainingRow.style.display = "";
      clonedTbody.appendChild(clonedTrainingRow);
    }
  });

  clonedTable.appendChild(clonedTbody);
  section.appendChild(clonedTable);

  return section;
}

function getSelectedExportPlayerIds() {
  return [...document.querySelectorAll(".bp-export-player-checkbox")]
    .filter(checkbox => checkbox.checked)
    .map(checkbox => checkbox.dataset.playerId)
    .filter(Boolean);
}

function removeExportCheckboxesFromElement(element) {
  if (!element) return;

  element.querySelectorAll(".bp-export-checkbox-wrap").forEach(node => {
    node.remove();
  });
}

function removeHelperOnlyClassesForExport(element) {
  if (!element) return;

  element.classList.remove("bp-helper-hidden");

  element.querySelectorAll(".bp-helper-hidden").forEach(node => {
    node.classList.remove("bp-helper-hidden");
  });
}

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

function downloadCanvasAsPng(canvas, filename) {
  const dataUrl = canvas.toDataURL("image/png");

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();
}

function createExportImageFilename(rangeLabel = "主要球員") {
  const now = new Date();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");

  const safeRangeLabel = String(rangeLabel || "主要球員")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();

  return `BasketPulse_${safeRangeLabel}_${yyyy}-${mm}-${dd}_${hh}${mi}.png`;
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizePercentValue(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim();
}

main();
