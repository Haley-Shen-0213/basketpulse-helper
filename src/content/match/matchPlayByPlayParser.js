// 專案路徑：src/content/match/matchPlayByPlayParser.js
// 模組說明：play-by-play DOM rows 解析模組。依照舊版 Python process_html_file 邏輯，將 rendered DOM rows 轉成接近 CSV 的資料格式，並提供前 20 筆資料驗證輸出。

function parseRenderedPlayByPlayDomRows(domRows, options = {}) {
  const matchId = options.matchId || "";

  const rows = Array.isArray(domRows) ? domRows : [];
  const data = [];

  let recordId = 1;
  let previousEvent = null;
  let previousQuarter = null;

  for (const domRow of rows) {
    const parsed = parseSinglePlayByPlayDomRow(domRow, {
      recordId,
      matchId,
      previousEvent,
      previousQuarter
    });

    data.push(parsed);

    previousEvent = parsed.events;
    previousQuarter = parsed.quarter;

    recordId += 1;
  }

  return {
    ok: true,
    rowCount: data.length,
    eventRowCount: data.filter(row => row.events).length,
    scoreRowCount: data.filter(row => row.score).length,
    playerRowCount: data.filter(row => row.player_number).length,
    otherPlayerRowCount: data.filter(row => row.other_player_number).length,
    quarterStartRowCount: data.filter(row => row.events === "本節比賽開始").length,
    quarterEndRowCount: data.filter(row => row.events === "本節比賽結束").length,
    homeRowCount: data.filter(row => row.arena === "home").length,
    awayRowCount: data.filter(row => row.arena === "away").length,
    first20Events: data.slice(0, 20).map(projectValidationEventFields),
    rows: data,
    diagnostics: buildParsedDomRowsDiagnostics(data)
  };
}

function parseSinglePlayByPlayDomRow(domRow, context) {
  const recordId = context.recordId;
  const matchId = context.matchId;
  const previousEvent = context.previousEvent;
  const previousQuarter = context.previousQuarter;

  let arena = domRow.arena || null;
  let quarter = normalizeNullableNumber(domRow.quarter);
  let time = normalizeText(domRow.time || "") || null;
  let score = normalizeText(domRow.score || "") || null;

  const rawEventText = normalizeText(domRow.rawEventText || "");

  let events = "";

  if (domRow.isQuarterBoundary && domRow.boundaryEvent) {
    events = domRow.boundaryEvent;
  } else {
    events = extractLegacyEventName(rawEventText);
  }

  if (!events) {
    if (recordId === 1) {
      events = "比賽開始";
      quarter = 1;
      time = "10:00";
    } else if (previousEvent !== "本節比賽結束") {
      events = "本節比賽結束";
      quarter = previousQuarter;
      time = "00:00";
    } else {
      events = "本節比賽開始";
      quarter = previousQuarter ? previousQuarter + 1 : 1;
      time = "10:00";
    }
  }

  if (events === "本節比賽開始" && !time) {
    time = "10:00";
  }

  if (events === "本節比賽結束" && !time) {
    time = "00:00";
  }

  const firstPlayerLink = Array.isArray(domRow.playerLinks) && domRow.playerLinks.length > 0
    ? domRow.playerLinks[0]
    : null;

  const player = firstPlayerLink?.text || null;
  const playerNumber = firstPlayerLink?.playerNumber || null;

  const chronologyResult = extractLegacyChronologyInfo(domRow.chronologyElements || []);

  let otherPlayer = chronologyResult.otherPlayer;
  let otherPlayerNumber = chronologyResult.otherPlayerNumber;

  if (playerNumber && otherPlayerNumber && Number(playerNumber) === Number(otherPlayerNumber)) {
    otherPlayer = null;
    otherPlayerNumber = null;
  }

  return {
    id: recordId,
    match_id: matchId,
    arena,
    quarter,
    time,
    score,
    events,
    player,
    player_number: playerNumber,
    first_events: chronologyResult.firstEvents,
    second_events: chronologyResult.secondEvents,
    third_events: chronologyResult.thirdEvents,
    fourth_events: chronologyResult.fourthEvents,
    other_player: otherPlayer,
    other_player_number: otherPlayerNumber
  };
}

function projectValidationEventFields(row) {
  return {
    arena: row.arena,
    quarter: row.quarter,
    time: row.time,
    score: row.score,
    events: row.events,
    player: row.player,
    player_number: row.player_number,
    first_events: row.first_events,
    second_events: row.second_events,
    third_events: row.third_events,
    fourth_events: row.fourth_events,
    other_player: row.other_player,
    other_player_number: row.other_player_number
  };
}

function extractLegacyEventName(rawEventText) {
  const text = normalizeText(rawEventText || "");

  if (!text) {
    return "";
  }

  const quarterBoundaryMatch = text.match(/^節\s*[1-4]\s*(本節比賽開始|本節比賽結束)$/);
  if (quarterBoundaryMatch) {
    return quarterBoundaryMatch[1];
  }

  if (text.includes(":")) {
    return normalizeText(text.split(":", 1)[0]);
  }

  return text;
}

function extractLegacyChronologyInfo(chronologyElements) {
  let firstEvents = null;
  let secondEvents = null;
  let thirdEvents = null;
  let fourthEvents = null;
  let otherPlayer = null;
  let otherPlayerNumber = null;

  const elements = Array.isArray(chronologyElements) ? chronologyElements : [];

  elements.forEach((element, index) => {
    const text = normalizeText(element.text || "");

    if (element.hasPlayerLink) {
      if (index === elements.length - 1) {
        otherPlayer = element.playerText || null;
        otherPlayerNumber = element.playerNumber || null;
      } else {
        if (index === 0) firstEvents = text || null;
        if (index === 1) secondEvents = text || null;
        if (index === 2) thirdEvents = text || null;
        if (index === 3) fourthEvents = text || null;
      }

      return;
    }

    if (index === 0) firstEvents = text || null;
    if (index === 1) secondEvents = text || null;
    if (index === 2) thirdEvents = text || null;
    if (index === 3) fourthEvents = text || null;
  });

  return {
    firstEvents,
    secondEvents,
    thirdEvents,
    fourthEvents,
    otherPlayer,
    otherPlayerNumber
  };
}

function normalizeNullableNumber(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return null;
  }

  return numberValue;
}

function buildParsedDomRowsDiagnostics(rows) {
  const eventCounts = {};

  for (const row of rows) {
    const eventName = row.events || "";

    if (!eventName) {
      continue;
    }

    eventCounts[eventName] = (eventCounts[eventName] || 0) + 1;
  }

  return {
    rowCount: rows.length,
    eventRowCount: rows.filter(row => row.events).length,
    scoreRowCount: rows.filter(row => row.score).length,
    playerRowCount: rows.filter(row => row.player_number).length,
    otherPlayerRowCount: rows.filter(row => row.other_player_number).length,
    quarterStartRowCount: rows.filter(row => row.events === "本節比賽開始").length,
    quarterEndRowCount: rows.filter(row => row.events === "本節比賽結束").length,
    homeRowCount: rows.filter(row => row.arena === "home").length,
    awayRowCount: rows.filter(row => row.arena === "away").length,
    first20Events: rows.slice(0, 20).map(projectValidationEventFields),
    last20Events: rows.slice(-20).map(projectValidationEventFields),
    quarterBoundaryRowsPreview: rows
      .filter(row => row.events === "本節比賽開始" || row.events === "本節比賽結束")
      .map(projectValidationEventFields),
    scoreRowsPreview: rows.filter(row => row.score).slice(0, 20).map(projectValidationEventFields),
    playerRowsPreview: rows.filter(row => row.player_number).slice(0, 20).map(projectValidationEventFields),
    eventCountsPreview: Object.entries(eventCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([events, count]) => ({ events, count }))
  };
}
