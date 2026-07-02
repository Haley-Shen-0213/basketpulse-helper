// 專案路徑：src/content/training/trainingRows.js
// 模組說明：球員表格增強模組。負責在原始球員列下方新增「潛力素質」與「訓練結果」列，並控制資料列的顯示狀態。

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
