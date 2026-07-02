// 專案路徑：src/content/training/trainingOverviewFetch.js
// 模組說明：訓練總覽抓取與快取模組。負責讀取 /tw/Training/overview、管理 chrome.storage.local 快取，並批次載入所有球員的潛力與訓練資料。

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
