// 專案路徑：src/content/match/matchParser.js
// 模組說明：比賽資料解析模組。負責將 play-by-play HTML 粗略解析成 matchData，供後續比賽分析模組使用。

function parseMatchPlayByPlayHtml(html, context = {}) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const playerLinks = extractPlayerLinksFromMatchDoc(doc);
  const tables = extractTablesSummaryFromMatchDoc(doc);
  const textEvents = parsePlayByPlayEventsFromText(doc);


  return {
    matchId: String(context.matchId || ""),
    sourceUrl: context.sourceUrl || "",
    parsedAt: new Date().toISOString(),
    playerLinks,
    tables,
    events: textEvents,
    diagnostics: {
      playerLinkCount: playerLinks.length,
      tableCount: tables.length,
      eventCount: textEvents.length,
      title: normalizeText(doc.title || "")
    }
  };
}
function parsePlayByPlayEventsFromText(doc) {
  const lines = extractUsefulPlayByPlayLines(doc);
  const events = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (!isClockLine(line)) {
      continue;
    }

    const quarterLine = lines[i - 1];

    if (!isQuarterOnlyLine(quarterLine)) {
      continue;
    }

    const quarter = parseQuarterNumber(quarterLine);
    const clock = line;

    const beforeQuarterLine = lines[i - 2] || "";
    const twoBeforeQuarterLine = lines[i - 3] || "";

    let team = "";
    let description = "";
    let layout = "";

    // 格式 A：description / team / 節 / clock
    if (isLikelyTeamLine(beforeQuarterLine) && isLikelyDescriptionLine(twoBeforeQuarterLine)) {
      team = beforeQuarterLine;
      description = twoBeforeQuarterLine;
      layout = "description-team-quarter-clock";
    }

    // 格式 B：team / description / 節 / clock
    if (!description && isLikelyDescriptionLine(beforeQuarterLine) && isLikelyTeamLine(twoBeforeQuarterLine)) {
      team = twoBeforeQuarterLine;
      description = beforeQuarterLine;
      layout = "team-description-quarter-clock";
    }

    // 如果還是解析不到，就保守取最近文字
    if (!description) {
      description = beforeQuarterLine;
      team = isLikelyTeamLine(twoBeforeQuarterLine) ? twoBeforeQuarterLine : "";
      layout = "fallback";
    }

    if (!isLikelyRealPlayByPlayDescription(description)) {
      continue;
    }

    const scoreInfo = extractScoreAfterClock(lines, i);

    events.push({
      index: events.length,
      sourceLineIndex: i,
      quarter,
      clock,
      team,
      description,
      score: scoreInfo.score,
      scoreSummary: scoreInfo.summary,
      layout,
      eventType: classifyPlayByPlayEvent(description, scoreInfo.summary),
      players: extractPlayerNamesFromEventText(description)
    });
  }

  return dedupeParsedPlayByPlayEvents(events);
}

function extractUsefulPlayByPlayLines(doc) {
  const text = doc.body?.innerText || doc.body?.textContent || "";
  const rawLines = text
    .split(/\n+/)
    .map(line => normalizeText(line))
    .filter(Boolean);

  const startIndex = findPlayByPlayStartLineIndex(rawLines);
  const endIndex = findPlayByPlayEndLineIndex(rawLines);

  return rawLines
    .slice(startIndex, endIndex)
    .filter(line => !isIgnoredPlayByPlayLine(line));
}

function findPlayByPlayStartLineIndex(lines) {
  const candidates = [];

  lines.forEach((line, index) => {
    if (/節\s*1\s*本節比賽開始/.test(line)) {
      candidates.push(index);
    }
  });

  if (candidates.length > 0) {
    return candidates[0];
  }

  const tabIndex = lines.findIndex(line => line === "比賽實況");

  return tabIndex >= 0 ? tabIndex + 1 : 0;
}

function findPlayByPlayEndLineIndex(lines) {
  const endIndex = lines.findIndex(line => /©\s*BASKETPULSE/i.test(line));

  return endIndex >= 0 ? endIndex : lines.length;
}

function isIgnoredPlayByPlayLine(line) {
  return [
    "basketpulselogo",
    "俱樂部",
    "財政",
    "球場",
    "排名",
    "記者會",
    "人事",
    "球員",
    "教練",
    "市場",
    "球探",
    "交易",
    "選秀",
    "核心球員",
    "訓練",
    "比賽",
    "戰術",
    "國內聯賽",
    "國際聯賽",
    "國家隊",
    "BasketPulse",
    "首頁",
    "聯盟",
    "公平競賽委員會",
    "信用點",
    "幫助",
    "玩家資訊",
    "搜尋",
    "Discord",
    "社群",
    "支持",
    "廣告",
    "投票給我們",
    "連絡",
    "翻譯",
    "資訊",
    "比賽實況",
    "統計數據",
    "備註",
    "書籤",
    "解釋"
  ].includes(line);
}

function isQuarterOnlyLine(line) {
  return /^節\s*[1-4]$/.test(line || "");
}

function parseQuarterNumber(line) {
  const match = String(line || "").match(/^節\s*([1-4])$/);
  return match ? Number(match[1]) : null;
}

function isClockLine(line) {
  const match = String(line || "").match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return false;
  }

  const minute = Number(match[1]);
  const second = Number(match[2]);

  return minute >= 0 && minute <= 10 && second >= 0 && second <= 59;
}

function isScoreLine(line) {
  const match = String(line || "").match(/^(\d{1,3}):(\d{1,3})$/);

  if (!match) {
    return false;
  }

  const left = Number(match[1]);
  const right = Number(match[2]);

  // 避免把 09:58 當比分
  if (left <= 10 && right <= 59 && String(line).padStart(5, "0").includes(":")) {
    return false;
  }

  return left >= 0 && right >= 0;
}

function extractScoreAfterClock(lines, clockLineIndex) {
  const nextLine = lines[clockLineIndex + 1] || "";
  const nextNextLine = lines[clockLineIndex + 2] || "";

  if (isScoreLine(nextLine)) {
    return {
      score: nextLine,
      summary: isLikelyDescriptionLine(nextNextLine) ? nextNextLine : ""
    };
  }

  return {
    score: "",
    summary: ""
  };
}

function isLikelyTeamLine(line) {
  if (!line) {
    return false;
  }

  if (isQuarterOnlyLine(line) || isClockLine(line) || isScoreLine(line)) {
    return false;
  }

  if (line.length > 30) {
    return false;
  }

  if (/[：:]/.test(line)) {
    return false;
  }

  if (/[()（）]/.test(line)) {
    return false;
  }

  if (/投籃|傳球|籃板|犯規|失誤|抄截|封蓋|阻攻|罰球|替換|替補|發邊線球|快攻|走步|踢球|助攻|灌籃|戰術|機會|球員|防守|進攻/.test(line)) {
    return false;
  }

  return true;
}

function isLikelyDescriptionLine(line) {
  if (!line) {
    return false;
  }

  if (isQuarterOnlyLine(line) || isClockLine(line) || isScoreLine(line)) {
    return false;
  }

  if (line.length < 2) {
    return false;
  }

  return true;
}

function isLikelyRealPlayByPlayDescription(line) {
  if (!line) {
    return false;
  }

  if (/本節比賽開始|本節比賽結束/.test(line)) {
    return false;
  }

  if (isLikelyTeamLine(line)) {
    return false;
  }

  return /[:：]|投籃|傳球|籃板|犯規|失誤|抄截|封蓋|阻攻|罰球|替換|替補|發邊線球|快攻|走步|踢球|助攻|灌籃|戰術|機會|球員|防守|進攻|違例|丟掉球權|爭球|暫停|清潔球場/.test(line);
}

function classifyPlayByPlayEvent(description, scoreSummary = "") {
  const text = `${description} ${scoreSummary}`;

  if (/先發/.test(text)) return "starter";
  if (/替換下場/.test(text)) return "sub_out";
  if (/替補上場|最好的球員替補上場/.test(text)) return "sub_in";
  if (/罰球未命中/.test(text)) return "free_throw_missed";
  if (/罰球/.test(text)) return "free_throw";
  if (/三分球投籃沒進|三分球投籃失手|三分球出手被蓋/.test(text)) return "three_point_missed";
  if (/三分球投籃|三分投籃/.test(text)) return "three_point_made_or_attempt";
  if (/投籃被蓋|被封蓋|被蓋火鍋/.test(text)) return "blocked_shot";
  if (/投籃沒進|投籃沒中|投籃失手|麵包/.test(text)) return "field_goal_missed";
  if (/2分球投籃|灌籃|成功的快攻/.test(text)) return "field_goal_made_or_attempt";
  if (/助攻/.test(text)) return "assist";
  if (/防守籃板/.test(text)) return "defensive_rebound";
  if (/進攻籃板/.test(text)) return "offensive_rebound";
  if (/籃板/.test(text)) return "rebound";
  if (/犯規/.test(text)) return "foul";
  if (/失誤|走步|違例|丟掉球權/.test(text)) return "turnover";
  if (/抄截|成功破壞對手球權/.test(text)) return "steal_or_disruption";
  if (/封蓋|阻攻/.test(text)) return "block";
  if (/傳球/.test(text)) return "pass";
  if (/發邊線球/.test(text)) return "inbound";
  if (/快攻|快打/.test(text)) return "transition";
  if (/戰術|擋拆|單打|切入/.test(text)) return "tactic";

  return "other";
}

function extractPlayerNamesFromEventText(text) {
  const result = [];

  const mainMatch = String(text || "").match(/[:：]\s*([^()（）]+?)(?:\s*\(|$)/);
  if (mainMatch?.[1]) {
    result.push(normalizeText(mainMatch[1]));
  }

  const arrowMatch = String(text || "").match(/→\s*([^()（）,，]+)/);
  if (arrowMatch?.[1]) {
    result.push(normalizeText(arrowMatch[1]));
  }

  const defenderMatch = String(text || "").match(/防守者[:：]\s*([^,)）]+)/);
  if (defenderMatch?.[1]) {
    result.push(normalizeText(defenderMatch[1]));
  }

  const opponentMatch = String(text || "").match(/最近的對手[:：]\s*([^,)）]+)/);
  if (opponentMatch?.[1]) {
    result.push(normalizeText(opponentMatch[1]));
  }

  return [...new Set(result.filter(Boolean))];
}

function dedupeParsedPlayByPlayEvents(events) {
  const seen = new Set();

  return events.filter(event => {
    const key = [
      event.quarter,
      event.clock,
      event.team,
      event.description,
      event.score
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function extractPlayerLinksFromMatchDoc(doc) {
  return [...doc.querySelectorAll('a[href*="/Player/"]')]
    .map((link, index) => {
      const href = link.getAttribute("href") || "";
      const match = href.match(/\/Player\/(\d+)/);

      return {
        index,
        playerId: match?.[1] || "",
        name: normalizeText(link.textContent || ""),
        href
      };
    })
    .filter(item => item.playerId || item.name);
}

function extractTablesSummaryFromMatchDoc(doc) {
  return [...doc.querySelectorAll("table")]
    .map((table, tableIndex) => {
      const rows = [...table.querySelectorAll("tr")];
      const headers = [...table.querySelectorAll("thead th, tr:first-child th")]
        .map(th => normalizeText(th.textContent || ""))
        .filter(Boolean);

      const sampleRows = rows.slice(0, 5).map(row => {
        return [...row.children]
          .map(cell => normalizeText(cell.textContent || ""))
          .filter(Boolean);
      });

      return {
        tableIndex,
        rowCount: rows.length,
        headers,
        sampleRows
      };
    });
}

function extractPossiblePlayByPlayTextEvents(doc) {
  const candidates = [
    ...doc.querySelectorAll(".play-by-play tr"),
    ...doc.querySelectorAll(".playbyplay tr"),
    ...doc.querySelectorAll(".match-events tr"),
    ...doc.querySelectorAll("table tr"),
    ...doc.querySelectorAll("li")
  ];

  const seen = new Set();

  return candidates
    .map((node, index) => {
      const text = normalizeText(node.textContent || "");

      return {
        index,
        text
      };
    })
    .filter(item => {
      if (!item.text || item.text.length < 4) {
        return false;
      }

      if (seen.has(item.text)) {
        return false;
      }

      seen.add(item.text);
      return true;
    })
    .slice(0, 500);
}

function findOfficialBoxScorePlayerRows() {
  const rows = [...document.querySelectorAll("table tr")];

  const playerRows = rows
    .map((row, index) => {
      const link = row.querySelector('a[href*="/Player/"]');
      const href = link?.getAttribute("href") || "";
      const match = href.match(/\/Player\/(\d+)/);

      if (!link || !match?.[1]) {
        return null;
      }

      const cells = [...row.children].map(cell => normalizeText(cell.textContent || ""));

      return {
        index,
        playerId: match[1],
        playerName: normalizeText(link.textContent || ""),
        href,
        cellCount: row.children.length,
        cells
      };
    })
    .filter(Boolean);

  return {
    playerRowCount: playerRows.length,
    playerRows
  };
}
