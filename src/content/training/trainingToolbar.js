// 專案路徑：src/content/training/trainingToolbar.js
// 模組說明：球員訓練工具列模組。負責建立 BasketPulse Helper 工具列、按鈕事件、狀態文字，以及顯示 / 隱藏資料列。

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
