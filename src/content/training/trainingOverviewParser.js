// 專案路徑：src/content/training/trainingOverviewParser.js
// 模組說明：訓練總覽 HTML 解析模組。負責從 /tw/Training/overview 頁面 HTML 中解析指定球員的潛力素質與訓練結果。

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
