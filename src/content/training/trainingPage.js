// 專案路徑：src/content/training/trainingPage.js
// 模組說明：球員訓練頁入口模組。負責等待頁面表格載入、尋找球員表格、初始化工具列與增強球員資料列。

function initTrainingHelperPage() {
  waitForTableAndInit();
}

function waitForTableAndInit() {
  const tables = findPlayerSkillTables();

  if (tables.length > 0) {
    initPlayerTrainingPage(tables);
    return;
  }

  let retryCount = 0;
  const maxRetry = 20;

  const timer = setInterval(() => {
    const tables = findPlayerSkillTables();

    if (tables.length > 0) {
      clearInterval(timer);
      initPlayerTrainingPage(tables);
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

function initPlayerTrainingPage(tables) {
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
