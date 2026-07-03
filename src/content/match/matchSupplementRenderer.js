// 專案路徑：src/content/match/matchSupplementRenderer.js
// 模組說明：比賽官方 Box Score 強化顯示模組。負責將 boxScoreRows 補充到官方 Box 表格、補充列、底部分析區與自訂排序。

const BP_MATCH_SUPPLEMENT_STYLE_ID = "bp-match-supplement-style";
const BP_MATCH_SUPPLEMENT_ANALYSIS_ID = "bp-match-supplement-analysis";
const BP_MATCH_SUPPLEMENT_ENHANCED_TABLE_CLASS = "bp-match-supplement-enhanced-table";
const BP_MATCH_SUPPLEMENT_HIDDEN_CLASS = "bp-match-supplement-hidden";

const BP_MATCH_SUPPLEMENT_MAIN_COLUMNS = [
  {
    key: "dfga",
    label: "DFGA"
  },
  {
    key: "dtsPercent",
    label: "DTS%"
  }
];

function renderMatchSupplementAnalysis(boxScoreRows, context = {}) {
  injectMatchSupplementStyles();

  if (isMatchSupplementEnhanced()) {
    showMatchSupplementAnalysis();

    return {
      ok: true,
      reused: true,
      officialTableCount: document.querySelectorAll(`.${BP_MATCH_SUPPLEMENT_ENHANCED_TABLE_CLASS}`).length,
      playerCount: 0
    };
  }

  const playerRows = normalizeSupplementBoxScoreRows(boxScoreRows)
    .filter(row => isSupplementRealPlayerNumber(row.player_number));

  if (!playerRows.length) {
    throw new Error("沒有可顯示的球員 BoxScore rows");
  }

  const playerMap = createSupplementPlayerMap(playerRows);
  const officialTables = findOfficialBoxScoreTables();

  if (!officialTables.length) {
    throw new Error("找不到官方 Box Score 表格");
  }

  officialTables.forEach(table => {
    enhanceOfficialBoxScoreTable(table, playerMap);
  });

  renderBottomSupplementAnalysis(playerRows, officialTables[officialTables.length - 1], context);

  return {
    ok: true,
    reused: false,
    officialTableCount: officialTables.length,
    playerCount: playerRows.length
  };
}

function isMatchSupplementEnhanced() {
  return Boolean(document.querySelector(`.${BP_MATCH_SUPPLEMENT_ENHANCED_TABLE_CLASS}`));
}

function isMatchSupplementVisible() {
  const enhancedTable = document.querySelector(`.${BP_MATCH_SUPPLEMENT_ENHANCED_TABLE_CLASS}`);

  if (!enhancedTable) {
    return false;
  }

  return !enhancedTable.classList.contains(BP_MATCH_SUPPLEMENT_HIDDEN_CLASS);
}

function restoreMatchSupplementAnalysis() {
  setMatchSupplementVisibility(false);
}

function showMatchSupplementAnalysis() {
  setMatchSupplementVisibility(true);
}

function setMatchSupplementVisibility(isVisible) {
  const enhancedTables = Array.from(document.querySelectorAll(`.${BP_MATCH_SUPPLEMENT_ENHANCED_TABLE_CLASS}`));

  enhancedTables.forEach(table => {
    table.classList.toggle(BP_MATCH_SUPPLEMENT_HIDDEN_CLASS, !isVisible);
  });

  const analysis = document.querySelector(`#${BP_MATCH_SUPPLEMENT_ANALYSIS_ID}`);

  if (analysis) {
    analysis.classList.toggle(BP_MATCH_SUPPLEMENT_HIDDEN_CLASS, !isVisible);
  }
}

function normalizeSupplementBoxScoreRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map(row => {
    return {
      ...row,
      player_number: normalizeSupplementPlayerNumber(row.player_number),
      player_name: normalizeText(row.player_name || row.player || ""),
      arena: normalizeText(row.arena || "")
    };
  });
}

function normalizeSupplementPlayerNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const text = String(value).trim();

  if (/^\d+(\.0+)?$/.test(text)) {
    return String(Number(text));
  }

  return text;
}

function isSupplementRealPlayerNumber(playerNumber) {
  return /^\d{7}$/.test(String(playerNumber || ""));
}

function createSupplementPlayerMap(playerRows) {
  const map = new Map();

  playerRows.forEach(row => {
    if (row.player_number) {
      map.set(String(row.player_number), row);
    }

    if (row.player_name) {
      map.set(normalizeSupplementNameKey(row.player_name), row);
    }
  });

  return map;
}

function normalizeSupplementNameKey(value) {
  return normalizeText(value || "")
    .replace(/\s+/g, "")
    .replace(/[，,]/g, ".")
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9.]/g, "")
    .toLowerCase();
}

function findOfficialBoxScoreTables() {
  const tables = Array.from(document.querySelectorAll("table"));

  return tables.filter(table => {
    const text = normalizeText(table.textContent || "");

    return text.includes("姓名")
      && text.includes("分鐘")
      && text.includes("得分")
      && text.includes("2%")
      && text.includes("3%")
      && text.includes("1")
      && text.includes("效率")
      && text.includes("球隊合計");
  });
}

function enhanceOfficialBoxScoreTable(table, playerMap) {
  if (table.classList.contains(BP_MATCH_SUPPLEMENT_ENHANCED_TABLE_CLASS)) {
    return;
  }

  const headerRows = Array.from(table.querySelectorAll("thead tr"));

  if (headerRows.length) {
    appendSupplementHeaders(headerRows);
  } else {
    const firstRow = table.querySelector("tr");

    if (firstRow) {
      appendSupplementHeaderCells(firstRow);
    }
  }

  const bodyRows = Array.from(table.querySelectorAll("tbody tr"));

  bodyRows.forEach(row => {
    if (isOfficialTeamTotalRow(row)) {
      appendSupplementEmptyCells(row, BP_MATCH_SUPPLEMENT_MAIN_COLUMNS.length);
      return;
    }

    const boxRow = matchOfficialTableRowToBoxScoreRow(row, playerMap);

    if (!boxRow) {
      appendSupplementEmptyCells(row, BP_MATCH_SUPPLEMENT_MAIN_COLUMNS.length);
      return;
    }

    attachSupplementSortDataset(row, boxRow);
    appendSupplementDataCells(row, boxRow);
    insertSupplementDetailRow(row, boxRow);
  });

  table.classList.add(BP_MATCH_SUPPLEMENT_ENHANCED_TABLE_CLASS);
}

function appendSupplementHeaders(headerRows) {
  const lastHeaderRow = headerRows[headerRows.length - 1];

  if (!lastHeaderRow) {
    return;
  }

  BP_MATCH_SUPPLEMENT_MAIN_COLUMNS.forEach(column => {
    const th = document.createElement("th");
    th.className = "bp-match-supplement-header";
    th.textContent = column.label;
    lastHeaderRow.appendChild(th);
  });

  if (headerRows.length > 1) {
    const firstHeaderRow = headerRows[0];
    const groupTh = document.createElement("th");

    groupTh.className = "bp-match-supplement-header bp-match-supplement-header-empty-group";
    groupTh.colSpan = BP_MATCH_SUPPLEMENT_MAIN_COLUMNS.length;
    groupTh.textContent = "";

    firstHeaderRow.appendChild(groupTh);
  }
}

function appendSupplementHeaderCells(headerRow) {
  BP_MATCH_SUPPLEMENT_MAIN_COLUMNS.forEach(column => {
    const th = document.createElement("th");
    th.className = "bp-match-supplement-header";
    th.textContent = column.label;
    headerRow.appendChild(th);
  });
}

function appendSupplementDataCells(row, boxRow) {
  const dtsPercent = calculateSupplementDtsPercent(boxRow);

  const values = {
    dfga: {
      text: formatSupplementInteger(boxRow.total_defense_attempts),
      sortValue: toSupplementNumber(boxRow.total_defense_attempts)
    },
    dtsPercent: {
      text: formatSupplementPercent(dtsPercent),
      sortValue: dtsPercent
    }
  };

  BP_MATCH_SUPPLEMENT_MAIN_COLUMNS.forEach(column => {
    const td = document.createElement("td");
    td.className = `bp-match-supplement-cell bp-match-supplement-cell-${column.key}`;
    td.dataset.bpSortKey = column.key;
    td.dataset.sortingval = normalizeSupplementDatasetNumber(values[column.key].sortValue);
    td.textContent = values[column.key].text;
    row.appendChild(td);
  });
}

function appendSupplementEmptyCells(row, count) {
  for (let i = 0; i < count; i += 1) {
    const td = document.createElement("td");
    td.className = "bp-match-supplement-cell bp-match-supplement-cell-empty";
    td.textContent = "";
    row.appendChild(td);
  }
}

function isOfficialTeamTotalRow(row) {
  return normalizeText(row.textContent || "").includes("球隊合計");
}

function matchOfficialTableRowToBoxScoreRow(row, playerMap) {
  const playerNumber = extractOfficialRowPlayerNumber(row);

  if (playerNumber && playerMap.has(playerNumber)) {
    return playerMap.get(playerNumber);
  }

  const playerName = extractOfficialRowPlayerName(row);

  if (!playerName) {
    return null;
  }

  const nameKey = normalizeSupplementNameKey(playerName);

  if (playerMap.has(nameKey)) {
    return playerMap.get(nameKey);
  }

  for (const [key, boxRow] of playerMap.entries()) {
    if (/^\d+$/.test(key)) {
      continue;
    }

    if (key && nameKey && (key.includes(nameKey) || nameKey.includes(key))) {
      return boxRow;
    }
  }

  return null;
}

function extractOfficialRowPlayerNumber(row) {
  const link = row.querySelector('a[href*="/Player/"][href*="/description"]');

  if (!link) {
    return "";
  }

  const href = link.getAttribute("href") || "";
  const match = href.match(/\/Player\/(\d+)\/description/);

  return match?.[1] || "";
}

function extractOfficialRowPlayerName(row) {
  const link = row.querySelector('a[href*="/Player/"][href*="/description"]');

  if (link) {
    return normalizeText(link.textContent || "");
  }

  const firstCell = row.querySelector("td, th");

  if (!firstCell) {
    return "";
  }

  return normalizeText(firstCell.textContent || "")
    .replace(/\bMVP\b/gi, "")
    .replace(/\bC\b/g, "")
    .replace(/\bG\b/g, "")
    .trim();
}

function attachSupplementSortDataset(row, boxRow) {
  const tsPercent = calculateSupplementTsPercent(boxRow);
  const dtsPercent = calculateSupplementDtsPercent(boxRow);
  const nonOfficialEff = calculateSupplementNonOfficialEff(boxRow);

  row.dataset.bpSortTotalPlayTime = String(parseSupplementTimeToSeconds(boxRow.total_play_time));
  row.dataset.bpSortPgPlayTime = String(parseSupplementTimeToSeconds(boxRow.pg_play_time));
  row.dataset.bpSortSgPlayTime = String(parseSupplementTimeToSeconds(boxRow.sg_play_time));
  row.dataset.bpSortSfPlayTime = String(parseSupplementTimeToSeconds(boxRow.sf_play_time));
  row.dataset.bpSortPfPlayTime = String(parseSupplementTimeToSeconds(boxRow.pf_play_time));
  row.dataset.bpSortCPlayTime = String(parseSupplementTimeToSeconds(boxRow.c_play_time));

  row.dataset.bpSortPoints = normalizeSupplementDatasetNumber(boxRow.Point);
  row.dataset.bpSortLostPoints = normalizeSupplementDatasetNumber(boxRow.lost_points);
  row.dataset.bpSortTsPercent = normalizeSupplementDatasetNumber(tsPercent);

  row.dataset.bpSortDefensiveRebounds = normalizeSupplementDatasetNumber(boxRow.defensive_rebounds);
  row.dataset.bpSortDefensiveReboundRate = normalizeSupplementDatasetNumber(boxRow.defensive_rebound_rate);
  row.dataset.bpSortOffensiveRebounds = normalizeSupplementDatasetNumber(boxRow.offensive_rebounds);
  row.dataset.bpSortOffensiveReboundRate = normalizeSupplementDatasetNumber(boxRow.offensive_rebound_rate);
  row.dataset.bpSortTotalRebounds = normalizeSupplementDatasetNumber(boxRow.total_rebounds);

  row.dataset.bpSortAssists = normalizeSupplementDatasetNumber(boxRow.assists);
  row.dataset.bpSortSteals = normalizeSupplementDatasetNumber(boxRow.steals);
  row.dataset.bpSortBlocks = normalizeSupplementDatasetNumber(boxRow.blocks);

  row.dataset.bpSortOfficialEff = getOfficialCellNumericValue(row, "ranking");
  row.dataset.bpSortNonOfficialEff = normalizeSupplementDatasetNumber(nonOfficialEff);

  row.dataset.bpSortDfga = normalizeSupplementDatasetNumber(boxRow.total_defense_attempts);
  row.dataset.bpSortDtsPercent = normalizeSupplementDatasetNumber(dtsPercent);
}

function getOfficialCellNumericValue(row, name) {
  const cell = row.querySelector(`td[name="${name}"]`);

  if (!cell) {
    return "0";
  }

  const raw = cell.dataset.sortingval || cell.textContent || "";
  const normalized = normalizeText(raw)
    .replace(/%/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, "");

  const number = Number(normalized);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return String(number);
}

function normalizeSupplementDatasetNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return String(number);
}

function insertSupplementDetailRow(playerRow, boxRow) {
  const detailData = buildSupplementDetailData(boxRow);

  if (!detailData.hasAnyDetail) {
    return;
  }

  const tbody = playerRow.closest("tbody");

  if (!tbody) {
    return;
  }

  const table = playerRow.closest("table");
  const columnMap = buildOfficialBoxScoreColumnMap(table, playerRow);

  const detailRow = document.createElement("tr");
  detailRow.className = "bp-match-supplement-detail-row bp-match-supplement-detail-row-aligned";

  const cellCount = Math.max(1, playerRow.children.length);

  for (let index = 0; index < cellCount; index += 1) {
    const td = document.createElement("td");
    td.className = "bp-match-supplement-detail-cell-aligned";

    const contents = [];

    if (index === columnMap.minutes && detailData.positionText) {
      contents.push(createSupplementAlignedItem("位置", detailData.positionText));
    }

    if (index === columnMap.points && detailData.lostPointsText) {
      contents.push(createSupplementAlignedItem("", detailData.lostPointsText, "bp-match-supplement-detail-lost-points"));
    }

    if (index === columnMap.twoPoint && detailData.closeMidText) {
      contents.push(createSupplementAlignedItem("二分拆分", detailData.closeMidText));
    }

    if (index === columnMap.freeThrow && detailData.tsPercentText) {
      contents.push(createSupplementAlignedItem("", detailData.tsPercentText, "bp-match-supplement-detail-ts"));
    }

    if (index === columnMap.defensiveRebound && detailData.reboundDefenseText) {
      contents.push(createSupplementAlignedItem("", detailData.reboundDefenseText));
    }

    if (index === columnMap.offensiveRebound && detailData.reboundOffenseText) {
      contents.push(createSupplementAlignedItem("", detailData.reboundOffenseText));
    }

    if (index === columnMap.efficiency && detailData.nonOfficialEffText) {
      contents.push(createSupplementAlignedItem("", detailData.nonOfficialEffText, "bp-match-supplement-detail-non-eff"));
    }

    if (contents.length) {
      td.innerHTML = contents.join("");
      td.classList.add("bp-match-supplement-detail-cell-has-content");
    } else {
      td.innerHTML = "&nbsp;";
    }

    detailRow.appendChild(td);
  }

  tbody.insertBefore(detailRow, playerRow.nextSibling);
}

function buildSupplementDetailData(boxRow) {
  const positionText = buildSupplementAllPositionText(boxRow);
  const closeMidText = buildSupplementCloseMidText(boxRow);
  const reboundCompetition = buildSupplementReboundCompetitionParts(boxRow);

  const lostPointsText = `失 ${formatSupplementInteger(boxRow.lost_points)}`;
  const tsPercentText = `TS ${formatSupplementPercent(calculateSupplementTsPercent(boxRow))}`;
  const nonOfficialEffText = `非官 ${formatSupplementInteger(calculateSupplementNonOfficialEff(boxRow))}`;

  return {
    positionText,
    closeMidText,
    lostPointsText,
    tsPercentText,
    nonOfficialEffText,
    reboundDefenseText: reboundCompetition.defenseText,
    reboundOffenseText: reboundCompetition.offenseText,
    hasAnyDetail: Boolean(
      positionText
      || closeMidText
      || lostPointsText
      || tsPercentText
      || nonOfficialEffText
      || reboundCompetition.defenseText
      || reboundCompetition.offenseText
    )
  };
}

function createSupplementAlignedItem(label, value, extraClassName = "") {
  const labelHtml = label
    ? `<span class="bp-match-supplement-aligned-label">${escapeSupplementHtml(label)}</span>`
    : "";

  const className = [
    "bp-match-supplement-aligned-item",
    extraClassName
  ].filter(Boolean).join(" ");

  return `
    <div class="${className}">
      ${labelHtml}
      <span class="bp-match-supplement-aligned-value">${escapeSupplementHtml(value)}</span>
    </div>
  `;
}

function buildOfficialBoxScoreColumnMap(table, playerRow) {
  const fallback = buildFallbackOfficialBoxScoreColumnMap(playerRow);
  const nameMap = buildOfficialBoxScoreColumnMapByCellName(playerRow);

  return {
    minutes: nameMap.minutes >= 0 ? nameMap.minutes : fallback.minutes,
    points: nameMap.points >= 0 ? nameMap.points : fallback.points,
    twoPoint: nameMap.twoPoint >= 0 ? nameMap.twoPoint : fallback.twoPoint,
    freeThrow: nameMap.freeThrow >= 0 ? nameMap.freeThrow : fallback.freeThrow,
    defensiveRebound: nameMap.defensiveRebound >= 0 ? nameMap.defensiveRebound : fallback.defensiveRebound,
    offensiveRebound: nameMap.offensiveRebound >= 0 ? nameMap.offensiveRebound : fallback.offensiveRebound,
    totalRebound: nameMap.totalRebound >= 0 ? nameMap.totalRebound : fallback.totalRebound,

    // 關鍵修正：
    // 非官EFF 直接跟官方效率欄 td[name="ranking"] 對齊。
    // 不再用 header index，也不再用 +/- 前一欄推算。
    efficiency: nameMap.efficiency >= 0 ? nameMap.efficiency : fallback.efficiency,
    plusMinus: nameMap.plusMinus >= 0 ? nameMap.plusMinus : fallback.plusMinus
  };
}

function buildOfficialBoxScoreColumnMapByCellName(playerRow) {
  const cells = Array.from(playerRow?.children || []);

  function findIndexByName(name) {
    return cells.findIndex(cell => cell.getAttribute("name") === name);
  }

  return {
    minutes: findIndexByName("minutes"),
    points: findIndexByName("points"),
    twoPoint: findIndexByName("two-pointers"),
    threePoint: findIndexByName("three-pointers"),
    freeThrow: findIndexByName("free-throws"),
    defensiveRebound: findIndexByName("defensive-rebounds"),
    offensiveRebound: findIndexByName("offensive-rebounds"),
    totalRebound: findIndexByName("total-rebounds"),
    assists: findIndexByName("assists"),
    steals: findIndexByName("steals"),
    foulsReceived: findIndexByName("fouls-received"),
    foulsCommitted: findIndexByName("fouls-committed"),
    turnovers: findIndexByName("turnovers"),
    blockedShots: findIndexByName("blocked-shots"),
    blocksAgainst: findIndexByName("blocks-against"),
    efficiency: findIndexByName("ranking"),
    plusMinus: findIndexByName("plus-minus")
  };
}

function buildFallbackOfficialBoxScoreColumnMap(playerRow) {
  const cellCount = playerRow?.children?.length || 0;

  return {
    minutes: cellCount > 2 ? 2 : 0,
    points: cellCount > 3 ? 3 : 0,
    twoPoint: cellCount > 4 ? 4 : 0,
    freeThrow: cellCount > 6 ? 6 : 0,
    defensiveRebound: cellCount > 7 ? 7 : 0,
    offensiveRebound: cellCount > 8 ? 8 : 0,
    totalRebound: cellCount > 9 ? 9 : 0,
    efficiency: Math.max(0, cellCount - BP_MATCH_SUPPLEMENT_MAIN_COLUMNS.length - 2),
    plusMinus: Math.max(0, cellCount - BP_MATCH_SUPPLEMENT_MAIN_COLUMNS.length - 1)
  };
}

function buildSupplementAllPositionText(boxRow) {
  const positions = [
    ["PG", boxRow.pg_play_time],
    ["SG", boxRow.sg_play_time],
    ["SF", boxRow.sf_play_time],
    ["PF", boxRow.pf_play_time],
    ["C", boxRow.c_play_time]
  ];

  const activePositions = positions
    .map(([position, time]) => {
      return [position, normalizeSupplementTimeText(time)];
    })
    .filter(([, time]) => {
      return time && time !== "0:00" && time !== "0";
    });

  if (!activePositions.length) {
    return "";
  }

  return activePositions
    .map(([position, time]) => `${position} ${time}`)
    .join(" / ");
}


function buildSupplementCloseMidText(boxRow) {
  const midMade = toSupplementNumber(boxRow.mid_made);

  if (midMade <= 0) {
    return "";
  }

  return `近 ${formatSupplementInteger(boxRow.close_hit)}/${formatSupplementInteger(boxRow.close_made)}｜中 ${formatSupplementInteger(boxRow.mid_hit)}/${formatSupplementInteger(boxRow.mid_made)}`;
}

function buildSupplementReboundCompetitionParts(boxRow) {
  const offensiveRebounds = toSupplementNumber(boxRow.offensive_rebounds);
  const defensiveReboundsConceded = toSupplementNumber(boxRow.defensive_rebounds_conceded);

  const defensiveRebounds = toSupplementNumber(boxRow.defensive_rebounds);
  const offensiveReboundsConceded = toSupplementNumber(boxRow.offensive_rebounds_conceded);

  const offensiveChance = offensiveRebounds + defensiveReboundsConceded;
  const defensiveChance = defensiveRebounds + offensiveReboundsConceded;

  return {
    offenseText: offensiveChance > 0
      ? `攻 ${formatSupplementInteger(offensiveRebounds)}/${formatSupplementInteger(offensiveChance)} ${formatSupplementPercent(offensiveRebounds / offensiveChance)}`
      : "",
    defenseText: defensiveChance > 0
      ? `守 ${formatSupplementInteger(defensiveRebounds)}/${formatSupplementInteger(defensiveChance)} ${formatSupplementPercent(defensiveRebounds / defensiveChance)}`
      : "",
    offensiveChance,
    defensiveChance
  };
}

function sortMatchSupplementEnhancedTables(options = {}) {
  const sortKey = options.sortKey || "totalPlayTime";
  const order = options.order || "descending";
  const position = options.position || "PG";

  const tables = Array.from(document.querySelectorAll(`.${BP_MATCH_SUPPLEMENT_ENHANCED_TABLE_CLASS}`))
    .filter(table => !table.classList.contains(BP_MATCH_SUPPLEMENT_HIDDEN_CLASS));

  if (!tables.length) {
    return {
      ok: false,
      message: "目前沒有可排序的強化表格"
    };
  }

  tables.forEach(table => {
    sortSingleMatchSupplementEnhancedTable(table, {
      sortKey,
      order,
      position
    });
  });

  return {
    ok: true,
    tableCount: tables.length,
    sortKey,
    order,
    position
  };
}

function sortSingleMatchSupplementEnhancedTable(table, options = {}) {
  const tbody = table.querySelector("tbody");

  if (!tbody) {
    return;
  }

  const rowPairs = collectSupplementRowPairs(tbody);

  rowPairs.sort((a, b) => {
    const valuesA = getSupplementSortValues(a.mainRow, options);
    const valuesB = getSupplementSortValues(b.mainRow, options);

    const result = compareSupplementSortValueArrays(valuesA, valuesB);

    return options.order === "ascending" ? result : -result;
  });

  const fragment = document.createDocumentFragment();

  rowPairs.forEach(pair => {
    fragment.appendChild(pair.mainRow);

    if (pair.detailRow) {
      fragment.appendChild(pair.detailRow);
    }
  });

  tbody.appendChild(fragment);
}

function collectSupplementRowPairs(tbody) {
  const rows = Array.from(tbody.children);
  const pairs = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    if (row.classList.contains("bp-match-supplement-detail-row")) {
      continue;
    }

    if (isOfficialTeamTotalRow(row)) {
      continue;
    }

    const nextRow = rows[index + 1];
    const detailRow = nextRow && nextRow.classList.contains("bp-match-supplement-detail-row")
      ? nextRow
      : null;

    pairs.push({
      mainRow: row,
      detailRow
    });

    if (detailRow) {
      index += 1;
    }
  }

  return pairs;
}

function getSupplementSortValues(row, options = {}) {
  const sortKey = options.sortKey || "totalPlayTime";

  if (sortKey === "positionPlayTime") {
    return getPositionSortValues(row, options.position || "PG");
  }

  const datasetKey = toSupplementDatasetSortKey(sortKey);

  return [
    readSupplementSortNumber(row.dataset[datasetKey])
  ];
}

function getPositionSortValues(row, primaryPosition) {
  const orderMap = {
    PG: ["pgPlayTime", "sgPlayTime", "sfPlayTime", "pfPlayTime", "cPlayTime"],
    SG: ["sgPlayTime", "pgPlayTime", "sfPlayTime", "pfPlayTime", "cPlayTime"],
    SF: ["sfPlayTime", "sgPlayTime", "pgPlayTime", "pfPlayTime", "cPlayTime"],
    PF: ["pfPlayTime", "cPlayTime", "sfPlayTime", "sgPlayTime", "pgPlayTime"],
    C: ["cPlayTime", "pfPlayTime", "sfPlayTime", "sgPlayTime", "pgPlayTime"]
  };

  const keys = orderMap[primaryPosition] || orderMap.PG;

  return keys.map(key => {
    return readSupplementSortNumber(row.dataset[`bpSort${capitalizeSupplementKey(key)}`]);
  });
}

function toSupplementDatasetSortKey(sortKey) {
  const map = {
    totalPlayTime: "bpSortTotalPlayTime",
    points: "bpSortPoints",
    lostPoints: "bpSortLostPoints",
    tsPercent: "bpSortTsPercent",
    defensiveRebounds: "bpSortDefensiveRebounds",
    defensiveReboundRate: "bpSortDefensiveReboundRate",
    offensiveRebounds: "bpSortOffensiveRebounds",
    offensiveReboundRate: "bpSortOffensiveReboundRate",
    totalRebounds: "bpSortTotalRebounds",
    assists: "bpSortAssists",
    steals: "bpSortSteals",
    blocks: "bpSortBlocks",
    officialEff: "bpSortOfficialEff",
    nonOfficialEff: "bpSortNonOfficialEff",
    dfga: "bpSortDfga",
    dtsPercent: "bpSortDtsPercent"
  };

  return map[sortKey] || "bpSortTotalPlayTime";
}

function capitalizeSupplementKey(value) {
  const text = String(value || "");

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function readSupplementSortNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return Number.NEGATIVE_INFINITY;
  }

  return number;
}

function compareSupplementSortValueArrays(valuesA, valuesB) {
  const maxLength = Math.max(valuesA.length, valuesB.length);

  for (let index = 0; index < maxLength; index += 1) {
    const a = valuesA[index] ?? Number.NEGATIVE_INFINITY;
    const b = valuesB[index] ?? Number.NEGATIVE_INFINITY;

    if (a !== b) {
      return a - b;
    }
  }

  return 0;
}

function renderBottomSupplementAnalysis(playerRows, insertAfterElement, context = {}) {
  const old = document.querySelector(`#${BP_MATCH_SUPPLEMENT_ANALYSIS_ID}`);

  if (old) {
    old.remove();
  }

  const container = document.createElement("section");
  container.id = BP_MATCH_SUPPLEMENT_ANALYSIS_ID;

  container.innerHTML = `
    <div class="bp-match-supplement-analysis-header">
      <div>
        <h3>強化數據補充</h3>
        <p>以下資料由插件根據 play-by-play 逐球資料計算。</p>
      </div>
    </div>

    <div class="bp-match-supplement-tabs">
      <button type="button" class="bp-match-supplement-tab is-active" data-tab="offense-opportunity">出手機會品質</button>
      <button type="button" class="bp-match-supplement-tab" data-tab="defense-opportunity">防守出手機會品質</button>
      <button type="button" class="bp-match-supplement-tab" data-tab="passing">傳球品質</button>
    </div>

    <div class="bp-match-supplement-panel is-active" data-panel="offense-opportunity">
      ${renderSupplementOpportunitySection(playerRows, "offense")}
    </div>

    <div class="bp-match-supplement-panel" data-panel="defense-opportunity">
      ${renderSupplementOpportunitySection(playerRows, "defense")}
    </div>

    <div class="bp-match-supplement-panel" data-panel="passing">
      ${renderSupplementPassingSection(playerRows)}
    </div>
  `;

  bindSupplementTabs(container);

  if (insertAfterElement?.parentElement) {
    insertAfterElement.parentElement.insertBefore(container, insertAfterElement.nextSibling);
  } else {
    document.body.appendChild(container);
  }
}

function renderSupplementOpportunitySection(playerRows, mode) {
  const homeRows = playerRows.filter(row => row.arena === "home");
  const awayRows = playerRows.filter(row => row.arena === "away");

  return `
    ${renderSupplementOpportunityTable(homeRows, mode, "主隊")}
    ${renderSupplementOpportunityTable(awayRows, mode, "客隊")}
  `;
}

function renderSupplementOpportunityTable(rows, mode, title) {
  const columns = [
    ["poor", mode === "offense" ? "極差" : "對手極差"],
    ["bad", mode === "offense" ? "糟糕" : "對手糟糕"],
    ["normal", mode === "offense" ? "普通" : "對手普通"],
    ["good", mode === "offense" ? "良好" : "對手良好"],
    ["excellent", mode === "offense" ? "極佳" : "對手極佳"]
  ];

  const bodyHtml = rows.map(row => {
    const cells = columns.map(([key]) => {
      const hitKey = mode === "offense"
        ? `${key}_opportunity_hit`
        : `${key}_opportunity_defense_hit`;

      const madeKey = mode === "offense"
        ? `${key}_opportunity_made`
        : `${key}_opportunity_defense_made`;

      return `<td>${formatSupplementInteger(row[hitKey])}/${formatSupplementInteger(row[madeKey])}</td>`;
    }).join("");

    return `
      <tr>
        <td class="bp-match-supplement-left">${escapeSupplementHtml(row.player_name)}</td>
        ${cells}
      </tr>
    `;
  }).join("");

  return `
    <div class="bp-match-supplement-section">
      <h4>${escapeSupplementHtml(title)}</h4>
      <div class="bp-match-supplement-table-scroll">
        <table class="bp-match-supplement-table">
          <thead>
            <tr>
              <th class="bp-match-supplement-left">球員</th>
              ${columns.map(([, label]) => `<th>${escapeSupplementHtml(label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${bodyHtml || `<tr><td colspan="${columns.length + 1}">無資料</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSupplementPassingSection(playerRows) {
  const homeRows = playerRows.filter(row => row.arena === "home");
  const awayRows = playerRows.filter(row => row.arena === "away");

  return `
    ${renderSupplementPassingTable(homeRows, "主隊")}
    ${renderSupplementPassingTable(awayRows, "客隊")}
  `;
}

function renderSupplementPassingTable(rows, title) {
  const bodyHtml = rows.map(row => {
    const bad = toSupplementNumber(row.bad_passes);
    const normal = toSupplementNumber(row.normal_passes);
    const safe = toSupplementNumber(row.safe_passes);
    const good = toSupplementNumber(row.good_passes);
    const great = toSupplementNumber(row.great_passes);
    const total = bad + normal + safe + good + great;

    return `
      <tr>
        <td class="bp-match-supplement-left">${escapeSupplementHtml(row.player_name)}</td>
        <td>${formatSupplementInteger(bad)}</td>
        <td>${formatSupplementInteger(normal)}</td>
        <td>${formatSupplementInteger(safe)}</td>
        <td>${formatSupplementInteger(good)}</td>
        <td>${formatSupplementInteger(great)}</td>
        <td>${formatSupplementInteger(total)}</td>
        <td>${formatSupplementPercent(toSupplementNumber(row.touch_rate))}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="bp-match-supplement-section">
      <h4>${escapeSupplementHtml(title)}</h4>
      <div class="bp-match-supplement-table-scroll">
        <table class="bp-match-supplement-table">
          <thead>
            <tr>
              <th class="bp-match-supplement-left">球員</th>
              <th>糟</th>
              <th>普</th>
              <th>安</th>
              <th>好</th>
              <th>妙</th>
              <th>總傳</th>
              <th>觸球率</th>
            </tr>
          </thead>
          <tbody>
            ${bodyHtml || `<tr><td colspan="8">無資料</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindSupplementTabs(container) {
  const tabs = Array.from(container.querySelectorAll(".bp-match-supplement-tab"));
  const panels = Array.from(container.querySelectorAll(".bp-match-supplement-panel"));

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      tabs.forEach(item => {
        item.classList.toggle("is-active", item === tab);
      });

      panels.forEach(panel => {
        panel.classList.toggle("is-active", panel.dataset.panel === target);
      });
    });
  });
}

function calculateSupplementTsPercent(boxRow) {
  const points = toSupplementNumber(boxRow.Point);
  const totalAttempts = toSupplementNumber(boxRow.total_attempts);
  const ftMade = toSupplementNumber(boxRow.FT_made);

  const denominator = 2 * (totalAttempts + 0.44 * ftMade);

  if (denominator <= 0) {
    return null;
  }

  return points / denominator;
}

function calculateSupplementDtsPercent(boxRow) {
  const lostPoints = toSupplementNumber(boxRow.lost_points);
  const defenseAttempts = toSupplementNumber(boxRow.total_defense_attempts);

  if (defenseAttempts <= 0) {
    return null;
  }

  return lostPoints / (2 * defenseAttempts);
}

function calculateSupplementNonOfficialEff(boxRow) {
  const fieldGoalHit =
    toSupplementNumber(boxRow.close_hit)
    + toSupplementNumber(boxRow.mid_hit)
    + toSupplementNumber(boxRow.three_hit);

  return (
    toSupplementNumber(boxRow.Point)
    + toSupplementNumber(boxRow.total_rebounds)
    + toSupplementNumber(boxRow.assists)
    + toSupplementNumber(boxRow.steals)
    + toSupplementNumber(boxRow.blocks)
    + fieldGoalHit
    - toSupplementNumber(boxRow.total_attempts)
    + toSupplementNumber(boxRow.FT_hit)
    - toSupplementNumber(boxRow.FT_made)
    - toSupplementNumber(boxRow.turnovers)
  );
}

function parseSupplementTimeToSeconds(value) {
  const text = normalizeSupplementTimeText(value);

  const match = text.match(/^(\d+):(\d{2})$/);

  if (!match) {
    return 0;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function toSupplementNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
}

function formatSupplementInteger(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return String(Math.round(number));
}

function formatSupplementPercent(value) {
  if (value === null || value === undefined) {
    return "X";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "X";
  }

  return `${(number * 100).toFixed(1)}%`;
}

function normalizeSupplementTimeText(value) {
  const text = normalizeText(value || "");

  if (!text || text === "0" || text === "0:0") {
    return "0:00";
  }

  const match = text.match(/^(\d+):(\d{1,2})$/);

  if (!match) {
    return text;
  }

  return `${Number(match[1])}:${String(Number(match[2])).padStart(2, "0")}`;
}

function escapeSupplementHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function injectMatchSupplementStyles() {
  if (document.querySelector(`#${BP_MATCH_SUPPLEMENT_STYLE_ID}`)) {
    return;
  }

  const style = document.createElement("style");
  style.id = BP_MATCH_SUPPLEMENT_STYLE_ID;
  style.textContent = `
    .${BP_MATCH_SUPPLEMENT_HIDDEN_CLASS} .bp-match-supplement-header,
    .${BP_MATCH_SUPPLEMENT_HIDDEN_CLASS} .bp-match-supplement-cell,
    .${BP_MATCH_SUPPLEMENT_HIDDEN_CLASS}.bp-match-supplement-detail-row,
    .${BP_MATCH_SUPPLEMENT_HIDDEN_CLASS} .bp-match-supplement-detail-row {
      display: none !important;
    }

    #${BP_MATCH_SUPPLEMENT_ANALYSIS_ID}.${BP_MATCH_SUPPLEMENT_HIDDEN_CLASS} {
      display: none !important;
    }

    #bp-match-probe-toolbar select {
      font-size: 13px;
      line-height: 1.4;
      padding: 4px 8px;
      border: 1px solid #94a3b8;
      border-radius: 4px;
      background: #ffffff;
      color: #0f172a;
      cursor: pointer;
    }

    #bp-match-probe-toolbar select:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .bp-match-sort-label {
      color: #334155;
      font-weight: 700;
    }

    .${BP_MATCH_SUPPLEMENT_ENHANCED_TABLE_CLASS} .bp-match-supplement-header {
      background: #f7f1ef;
      color: #1f2937;
      font-weight: 700;
      text-align: center;
      white-space: nowrap;
      border-left: 1px solid rgba(0, 0, 0, 0.08);
    }

    .${BP_MATCH_SUPPLEMENT_ENHANCED_TABLE_CLASS} .bp-match-supplement-header-empty-group {
      background: #f7f1ef;
      color: transparent;
    }

    .${BP_MATCH_SUPPLEMENT_ENHANCED_TABLE_CLASS} .bp-match-supplement-cell {
      text-align: center;
      white-space: nowrap;
      font-weight: 700;
      border-left: 1px solid rgba(0, 0, 0, 0.08);
      font-variant-numeric: tabular-nums;
    }

    .${BP_MATCH_SUPPLEMENT_ENHANCED_TABLE_CLASS} .bp-match-supplement-cell-dfga,
    .${BP_MATCH_SUPPLEMENT_ENHANCED_TABLE_CLASS} .bp-match-supplement-cell-dtsPercent {
      min-width: 42px;
      font-variant-numeric: tabular-nums;
    }

    .bp-match-supplement-detail-row-aligned td {
      background: #fff8f5 !important;
      border-top: 0 !important;
      border-bottom: 1px solid #f3e2dc !important;
      vertical-align: top;
    }

    .bp-match-supplement-detail-cell-aligned {
      padding: 2px 2px !important;
      min-height: 20px;
      font-size: 10px;
      line-height: 1.25;
      color: #64748b;
      text-align: center;
      white-space: nowrap;
    }

    .bp-match-supplement-detail-cell-has-content {
      color: #1f2937;
    }

    .bp-match-supplement-aligned-item {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 2px;
      max-width: 100%;
      padding: 1px 3px;
      border: 1px solid #f0c9bd;
      border-radius: 999px;
      background: #ffffff;
      white-space: nowrap;
      font-size: 10px;
      line-height: 1.2;
    }

    .bp-match-supplement-aligned-label {
      color: #d94124;
      font-weight: 700;
    }

    .bp-match-supplement-aligned-value {
      color: #1f2937;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .bp-match-supplement-detail-lost-points .bp-match-supplement-aligned-value {
      color: #334155;
    }

    .bp-match-supplement-detail-ts .bp-match-supplement-aligned-value {
      color: #d94124;
    }

    .bp-match-supplement-detail-non-eff .bp-match-supplement-aligned-value {
      color: #6d28d9;
    }

    #${BP_MATCH_SUPPLEMENT_ANALYSIS_ID} {
      box-sizing: border-box;
      width: 100%;
      margin: 16px 0;
      padding: 12px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      color: #1f2937;
    }

    #${BP_MATCH_SUPPLEMENT_ANALYSIS_ID} .bp-match-supplement-analysis-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 10px;
    }

    #${BP_MATCH_SUPPLEMENT_ANALYSIS_ID} h3 {
      margin: 0;
      color: #d94124;
      font-size: 16px;
      font-weight: 800;
    }

    #${BP_MATCH_SUPPLEMENT_ANALYSIS_ID} p {
      margin: 4px 0 0;
      color: #64748b;
      font-size: 12px;
    }

    .bp-match-supplement-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding-bottom: 8px;
      margin-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
    }

    .bp-match-supplement-tab {
      appearance: none;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      background: #ffffff;
      color: #1f2937;
      padding: 5px 10px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }

    .bp-match-supplement-tab.is-active {
      color: #ffffff;
      background: #d94124;
      border-color: #c7351b;
    }

    .bp-match-supplement-panel {
      display: none;
    }

    .bp-match-supplement-panel.is-active {
      display: block;
    }

    .bp-match-supplement-section {
      margin-top: 12px;
    }

    .bp-match-supplement-section h4 {
      margin: 0 0 6px;
      font-size: 14px;
      font-weight: 800;
    }

    .bp-match-supplement-table-scroll {
      overflow-x: auto;
    }

    .bp-match-supplement-table {
      width: 100%;
      border-collapse: collapse;
      background: #ffffff;
      font-size: 12px;
    }

    .bp-match-supplement-table th,
    .bp-match-supplement-table td {
      padding: 6px 8px;
      border: 1px solid #e5e7eb;
      text-align: center;
      white-space: nowrap;
    }

    .bp-match-supplement-table th {
      background: #f8fafc;
      font-weight: 800;
    }

    .bp-match-supplement-table tbody tr:nth-child(even) {
      background: #f9fafb;
    }

    .bp-match-supplement-left {
      text-align: left !important;
    }
  `;

  document.head.appendChild(style);
}
