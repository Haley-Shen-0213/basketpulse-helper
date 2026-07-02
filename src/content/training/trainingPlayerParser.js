// 專案路徑：src/content/training/trainingPlayerParser.js
// 模組說明：球員表格解析模組。負責從球員技能頁與籃球學校頁的 table 中解析球員資料，並判斷主要球員 / 出借球員區塊。

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
 * 可同時支援：
 * - 球員技能頁
 * - 籃球學校頁 School/main
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

/**
 * 判斷球員列是否像是出借 / 租借球員。
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
 * 取得 table 附近上方的文字，用於判斷該表格是否為出借 / 租借區塊。
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
 * 判斷目前頁面是否有出借 / 租借球員區塊。
 *
 * 判斷規則：
 * 1. 如果有球員來自第二個以上 table，視為有出借區塊。
 * 2. 如果玩家列被判斷為 loan-like，也視為有出借區塊。
 */
function hasLoanPlayersSection(players) {
  if (!players || players.length === 0) {
    return false;
  }

  return players.some(player => {
    return Number(player.tableIndex) > 0 || player.isLoanLike === true;
  });
}
