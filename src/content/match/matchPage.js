// 專案路徑：src/content/match/matchPage.js
// 模組說明：比賽頁入口模組。負責在比賽 description 頁啟動正式版「強化數據顯示」功能。
// 功能流程：
// 1. 從目前網址取得 matchId。
// 2. 建立比賽頁工具列。
// 3. 使用者點擊「強化數據顯示」。
// 4. 透過隱藏 iframe 完整載入 play-by-play 頁。
// 5. 解析 rendered play-by-play DOM rows。
// 6. 產生 boxScoreRows。
// 7. 將強化數據補充到官方 Box Score 表格與表格下方補充區塊。

function initMatchProbePage() {
  bpDebugLog("[BasketPulse Helper] match page init");

  const matchId = getMatchIdFromCurrentUrl();

  if (!matchId) {
    console.warn("[BasketPulse Helper] 無法從目前網址取得 matchId:", location.href);
    return;
  }

  if (document.body.dataset.bpMatchProbeInit === "1") {
    bpDebugLog("[BasketPulse Helper] match page already initialized");
    return;
  }

  document.body.dataset.bpMatchProbeInit = "1";

  const boxScoreInfo = typeof findOfficialBoxScorePlayerRows === "function"
    ? findOfficialBoxScorePlayerRows()
    : {
        playerRowCount: 0,
        playerRows: []
      };

  addMatchProbeToolbar({
    matchId,
    boxScoreInfo
  });

  setMatchProbeStatus("可使用強化數據顯示");
}

function getMatchIdFromCurrentUrl() {
  const match = location.pathname.match(/\/Match\/(\d+)\/description/);

  if (match?.[1]) {
    return match[1];
  }

  const fallback = location.href.match(/\/Match\/(\d+)\//);

  return fallback?.[1] || "";
}

async function runEnhancedStatsDisplay(matchId) {
  setMatchProbeButtonBusy(true);

  try {
    if (!matchId) {
      throw new Error("缺少 matchId");
    }

    validateEnhancedStatsDependencies();

    setMatchProbeStatus("準備完整載入 play-by-play 頁...");

    const captureResult = await captureRenderedPlayByPlayPage(matchId, {
      waitAfterLoadMs: 30000
    });

    if (!captureResult?.domRows?.length) {
      throw new Error("沒有擷取到 play-by-play DOM rows");
    }

    setMatchProbeStatus("已完成 play-by-play 載入，正在解析逐球資料...");

    const parsedPlayByPlay = parseRenderedPlayByPlayDomRows(captureResult.domRows, {
      matchId
    });

    if (!parsedPlayByPlay?.rows?.length) {
      throw new Error("沒有解析到任何 play-by-play rows");
    }

    setMatchProbeStatus("逐球資料已解析，正在計算強化數據...");

    const boxScoreResult = generateMatchBoxScore(parsedPlayByPlay.rows, {
      matchId
    });

    if (!boxScoreResult?.boxScoreRows?.length) {
      throw new Error("BoxScore 計算結果為空");
    }

    setMatchProbeStatus("正在補充官方 Box Score...");

    const renderResult = renderMatchSupplementAnalysis(boxScoreResult.boxScoreRows, {
      matchId,
      parsedPlayByPlay,
      boxScoreResult
    });

    console.info("[BasketPulse Helper] 強化數據顯示完成", {
      matchId,
      renderResult,
      parsedPlayByPlay,
      boxScoreResult
    });

    setMatchProbeStatus("強化數據已顯示");
  } catch (error) {
    console.error("[BasketPulse Helper] 強化數據顯示失敗:", error);

    const message = error?.message || String(error);

    setMatchProbeStatus(`強化數據顯示失敗：${message}`);
    alert(`強化數據顯示失敗：${message}`);
  } finally {
    setMatchProbeButtonBusy(false);
  }
}

function validateEnhancedStatsDependencies() {
  const requiredFunctions = [
    {
      name: "captureRenderedPlayByPlayPage",
      value: typeof captureRenderedPlayByPlayPage
    },
    {
      name: "parseRenderedPlayByPlayDomRows",
      value: typeof parseRenderedPlayByPlayDomRows
    },
    {
      name: "generateMatchBoxScore",
      value: typeof generateMatchBoxScore
    },
    {
      name: "renderMatchSupplementAnalysis",
      value: typeof renderMatchSupplementAnalysis
    },
    {
      name: "setMatchProbeStatus",
      value: typeof setMatchProbeStatus
    },
    {
      name: "setMatchProbeButtonBusy",
      value: typeof setMatchProbeButtonBusy
    }
  ];

  const missing = requiredFunctions
    .filter(item => item.value !== "function")
    .map(item => item.name);

  if (missing.length) {
    throw new Error(`缺少必要函式：${missing.join(", ")}`);
  }
}
