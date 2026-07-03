// 專案路徑：src/content/match/matchToolbar.js
// 模組說明：比賽頁工具列模組。提供強化數據顯示、隱藏/顯示切換、自訂排序控制。

function addMatchProbeToolbar(context) {
  if (document.querySelector("#bp-match-probe-toolbar")) {
    return;
  }

  const toolbar = document.createElement("div");
  toolbar.id = "bp-match-probe-toolbar";

  const title = document.createElement("span");
  title.className = "bp-helper-title";
  title.textContent = "BasketPulse Helper";

  const matchIdText = document.createElement("span");
  matchIdText.className = "bp-match-probe-match-id";
  matchIdText.textContent = `Match ID：${context.matchId}`;

  const enhanceStatsBtn = document.createElement("button");
  enhanceStatsBtn.type = "button";
  enhanceStatsBtn.textContent = "強化數據顯示";
  enhanceStatsBtn.dataset.action = "enhance-stats-display";
  enhanceStatsBtn.dataset.mode = "enhance";
  enhanceStatsBtn.title = "完整載入 play-by-play，計算進階數據並補充到官方 Box Score";

  enhanceStatsBtn.addEventListener("click", async () => {
    const mode = enhanceStatsBtn.dataset.mode || "enhance";

    if (mode === "restore") {
      if (typeof restoreMatchSupplementAnalysis === "function") {
        restoreMatchSupplementAnalysis();
      }

      enhanceStatsBtn.dataset.mode = "show";
      enhanceStatsBtn.textContent = "顯示強化資料";
      enhanceStatsBtn.title = "顯示已載入的強化欄位與補充列，不重新載入 play-by-play";

      setMatchCustomSortControlsEnabled(false);
      setMatchProbeStatus("已切回官方表格，可使用官方排序");
      return;
    }

    if (mode === "show") {
      if (typeof showMatchSupplementAnalysis === "function") {
        showMatchSupplementAnalysis();
      }

      enhanceStatsBtn.dataset.mode = "restore";
      enhanceStatsBtn.textContent = "隱藏強化資料";
      enhanceStatsBtn.title = "隱藏強化欄位與補充列，切回官方表格";

      setMatchCustomSortControlsEnabled(true);
      setMatchProbeStatus("已顯示強化資料");
      return;
    }

    await runEnhancedStatsDisplay(context.matchId);

    if (typeof isMatchSupplementEnhanced === "function" && isMatchSupplementEnhanced()) {
      enhanceStatsBtn.dataset.mode = "restore";
      enhanceStatsBtn.textContent = "隱藏強化資料";
      enhanceStatsBtn.title = "隱藏強化欄位與補充列，切回官方表格";

      setMatchCustomSortControlsEnabled(true);
    }
  });

  const sortLabel = document.createElement("span");
  sortLabel.className = "bp-match-sort-label";
  sortLabel.textContent = "排序：";

  const sortSelect = document.createElement("select");
  sortSelect.id = "bp-match-custom-sort-key";
  sortSelect.title = "選擇強化模式排序欄位";
  sortSelect.disabled = true;

  const sortOptions = [
    ["totalPlayTime", "總出場時間"],
    ["positionPlayTime", "各位置出場時間"],
    ["points", "得分"],
    ["lostPoints", "失分"],
    ["tsPercent", "TS%"],
    ["defensiveRebounds", "防守籃板"],
    ["defensiveReboundRate", "防守籃板率"],
    ["offensiveRebounds", "進攻籃板"],
    ["offensiveReboundRate", "進攻籃板率"],
    ["totalRebounds", "總籃板"],
    ["assists", "助攻"],
    ["steals", "抄截"],
    ["blocks", "封蓋"],
    ["officialEff", "效率"],
    ["nonOfficialEff", "非官EFF"],
    ["dfga", "DFGA"],
    ["dtsPercent", "DTS%"]
  ];

  sortOptions.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    sortSelect.appendChild(option);
  });

  const positionSelect = document.createElement("select");
  positionSelect.id = "bp-match-custom-position-sort-key";
  positionSelect.title = "選擇位置時間排序優先位置";
  positionSelect.disabled = true;
  positionSelect.style.display = "none";

  ["PG", "SG", "SF", "PF", "C"].forEach(position => {
    const option = document.createElement("option");
    option.value = position;
    option.textContent = position;
    positionSelect.appendChild(option);
  });

  sortSelect.addEventListener("change", () => {
    const isPositionSort = sortSelect.value === "positionPlayTime";

    positionSelect.style.display = isPositionSort ? "" : "none";
    positionSelect.disabled = sortSelect.disabled || !isPositionSort;
  });

  const sortDescBtn = document.createElement("button");
  sortDescBtn.type = "button";
  sortDescBtn.id = "bp-match-custom-sort-desc";
  sortDescBtn.dataset.action = "custom-sort";
  sortDescBtn.dataset.order = "descending";
  sortDescBtn.textContent = "高到低";
  sortDescBtn.title = "依目前欄位由高到低排序";
  sortDescBtn.disabled = true;

  sortDescBtn.addEventListener("click", () => {
    applyMatchCustomSortFromToolbar("descending");
  });

  const sortAscBtn = document.createElement("button");
  sortAscBtn.type = "button";
  sortAscBtn.id = "bp-match-custom-sort-asc";
  sortAscBtn.dataset.action = "custom-sort";
  sortAscBtn.dataset.order = "ascending";
  sortAscBtn.textContent = "低到高";
  sortAscBtn.title = "依目前欄位由低到高排序";
  sortAscBtn.disabled = true;

  sortAscBtn.addEventListener("click", () => {
    applyMatchCustomSortFromToolbar("ascending");
  });

  const status = document.createElement("span");
  status.id = "bp-match-probe-status";
  status.className = "bp-helper-status";
  status.textContent = "已準備完成";

  toolbar.appendChild(title);
  toolbar.appendChild(matchIdText);
  toolbar.appendChild(enhanceStatsBtn);
  toolbar.appendChild(sortLabel);
  toolbar.appendChild(sortSelect);
  toolbar.appendChild(positionSelect);
  toolbar.appendChild(sortDescBtn);
  toolbar.appendChild(sortAscBtn);
  toolbar.appendChild(status);

  const insertTarget = findMatchToolbarInsertTarget();
  insertTarget.after(toolbar);
}

function applyMatchCustomSortFromToolbar(order) {
  const sortSelect = document.querySelector("#bp-match-custom-sort-key");
  const positionSelect = document.querySelector("#bp-match-custom-position-sort-key");

  if (!sortSelect) {
    return;
  }

  const sortKey = sortSelect.value;
  const position = positionSelect?.value || "PG";

  if (typeof sortMatchSupplementEnhancedTables !== "function") {
    setMatchProbeStatus("自訂排序功能尚未載入");
    return;
  }

  const result = sortMatchSupplementEnhancedTables({
    sortKey,
    order,
    position
  });

  if (result?.ok) {
    const orderText = order === "ascending" ? "低到高" : "高到低";
    const positionText = sortKey === "positionPlayTime" ? `，位置：${position}` : "";

    setMatchProbeStatus(`已套用自訂排序：${getMatchCustomSortLabel(sortKey)}${positionText}，${orderText}`);
  } else {
    setMatchProbeStatus(result?.message || "自訂排序失敗");
  }
}

function getMatchCustomSortLabel(sortKey) {
  const labels = {
    totalPlayTime: "總出場時間",
    positionPlayTime: "各位置出場時間",
    points: "得分",
    lostPoints: "失分",
    tsPercent: "TS%",
    defensiveRebounds: "防守籃板",
    defensiveReboundRate: "防守籃板率",
    offensiveRebounds: "進攻籃板",
    offensiveReboundRate: "進攻籃板率",
    totalRebounds: "總籃板",
    assists: "助攻",
    steals: "抄截",
    blocks: "封蓋",
    officialEff: "效率",
    nonOfficialEff: "非官EFF",
    dfga: "DFGA",
    dtsPercent: "DTS%"
  };

  return labels[sortKey] || sortKey;
}

function setMatchCustomSortControlsEnabled(isEnabled) {
  const sortSelect = document.querySelector("#bp-match-custom-sort-key");
  const positionSelect = document.querySelector("#bp-match-custom-position-sort-key");
  const sortButtons = document.querySelectorAll("#bp-match-custom-sort-desc, #bp-match-custom-sort-asc");

  if (sortSelect) {
    sortSelect.disabled = !isEnabled;
  }

  if (positionSelect) {
    const isPositionSort = sortSelect?.value === "positionPlayTime";

    positionSelect.disabled = !isEnabled || !isPositionSort;
    positionSelect.style.display = isPositionSort ? "" : "none";
  }

  sortButtons.forEach(button => {
    button.disabled = !isEnabled;
  });
}

function findMatchToolbarInsertTarget() {
  const title = document.querySelector(".content-top__title");
  if (title) return title;

  const h1 = document.querySelector("h1");
  if (h1) return h1;

  const firstTable = document.querySelector("table");
  if (firstTable) return firstTable;

  return document.body.firstElementChild || document.body;
}

function setMatchProbeStatus(text) {
  const status = document.querySelector("#bp-match-probe-status");

  if (status) {
    status.textContent = text;
  }
}

function setMatchProbeButtonBusy(isBusy) {
  const buttons = document.querySelectorAll("#bp-match-probe-toolbar button");

  buttons.forEach(button => {
    if (isBusy) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
      }

      button.disabled = true;

      if (button.dataset.action === "enhance-stats-display") {
        button.textContent = "強化數據產生中...";
      }

      return;
    }

    button.disabled = false;

    if (button.dataset.action === "enhance-stats-display") {
      if (button.dataset.mode === "restore") {
        button.textContent = "隱藏強化資料";
      } else if (button.dataset.mode === "show") {
        button.textContent = "顯示強化資料";
      } else {
        button.textContent = "強化數據顯示";
      }
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
    }

    delete button.dataset.originalText;
  });

  const enhanceButton = document.querySelector('#bp-match-probe-toolbar button[data-action="enhance-stats-display"]');

  if (!isBusy && enhanceButton?.dataset.mode === "restore") {
    setMatchCustomSortControlsEnabled(true);
  }

  if (isBusy) {
    setMatchCustomSortControlsEnabled(false);
  }
}
