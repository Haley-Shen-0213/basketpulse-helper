// 專案路徑：src/content/training/trainingExport.js
// 模組說明：球員名單匯出模組。負責匯出主要球員、出借球員、全部球員與自選球員為 PNG 圖片，並處理自選模式 checkbox。

function getSelectedExportRange() {
  return document.querySelector("#bp-helper-export-range")?.value || EXPORT_RANGE_ALL;
}

function updateExportCustomMode() {
  const range = getSelectedExportRange();
  const isSelectedMode = range === EXPORT_RANGE_SELECTED;
  const hasLoanSection = document.querySelector("#bp-helper-toolbar")?.dataset.hasLoanSection === "1";

  document.body.classList.toggle("bp-export-custom-mode", isSelectedMode);

  document.querySelectorAll(".bp-selected-only-control").forEach(button => {
    const requiresLoanSection = button.dataset.requiresLoanSection === "1";

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

async function exportPlayersTableImageByRange(range) {
  let restore = null;
  let temporaryElement = null;

  try {
    const hasLoanSection = document.querySelector("#bp-helper-toolbar")?.dataset.hasLoanSection === "1";

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
