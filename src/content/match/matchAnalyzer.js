// 專案路徑：src/content/match/matchAnalyzer.js
// 模組說明：比賽 box score 分析模組。負責將 matchData rows，也就是 play-by-play CSV 格式 rows，轉換成球員 boxScore rows。
// 設計原則：
// 1. 不依賴外部 CSV 檔案。
// 2. 投籃、籃板、傳球、犯規、失誤、機會等規則由 matchRules.js 提供。
// 3. 第一版先移植 generate_box_score、analyze_and_update_box_score、record_opportunity_events。
// 4. 出場時間 calculate_play_time 之後獨立補上。

function generateMatchBoxScore(matchDataRows, options = {}) {
  const matchId = String(options.matchId || inferMatchIdFromRows(matchDataRows) || "");

  const rows = normalizeMatchDataRows(matchDataRows);

  const boxScoreRows = createInitialBoxScoreRows(rows, {
    matchId
  });

  analyzeAndUpdateBoxScoreRows(boxScoreRows, rows, {
    matchId
  });

  calculatePlayTimeForBoxScoreRows(boxScoreRows, rows);

  recordOpportunityEventsToBoxScoreRows(boxScoreRows, rows);

  const diagnostics = buildBoxScoreDiagnostics(boxScoreRows, rows);

  return {
    ok: true,
    matchId,
    boxScoreRowCount: boxScoreRows.length,
    playerBoxScoreRowCount: boxScoreRows.filter(row => isRealPlayerNumber(row.player_number)).length,
    teamBoxScoreRowCount: boxScoreRows.filter(row => isTeamPlayerNumber(row.player_number, matchId)).length,
    boxScoreRows,
    diagnostics
  };
}


function inferMatchIdFromRows(rows) {
  if (!Array.isArray(rows)) {
    return "";
  }

  const firstRow = rows.find(row => row?.match_id);

  return firstRow?.match_id || "";
}

function normalizeMatchDataRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map(row => {
    return {
      id: normalizeNullableNumberForAnalyzer(row.id),
      match_id: row.match_id == null ? "" : String(row.match_id),
      arena: row.arena || "",
      quarter: normalizeNullableNumberForAnalyzer(row.quarter),
      time: row.time || null,
      score: normalizeScoreForAnalyzer(row.score),
      events: normalizeText(row.events || ""),
      player: normalizeNullableText(row.player),
      player_number: normalizeNullableNumberForAnalyzer(row.player_number),
      first_events: normalizeNullableText(row.first_events),
      second_events: normalizeNullableText(row.second_events),
      third_events: normalizeNullableText(row.third_events),
      fourth_events: normalizeNullableText(row.fourth_events),
      other_player: normalizeNullableText(row.other_player),
      other_player_number: normalizeNullableNumberForAnalyzer(row.other_player_number)
    };
  });
}

function normalizeScoreForAnalyzer(value) {
  const text = normalizeText(value || "");

  return text || null;
}

function normalizeNullableText(value) {
  const text = normalizeText(value || "");

  return text || null;
}

function normalizeNullableNumberForAnalyzer(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return numberValue;
}

function createInitialBoxScoreRows(matchDataRows, options = {}) {
  const matchId = String(options.matchId || "");

  const uniquePlayerMap = new Map();

  for (const row of matchDataRows) {
    if (!row.player_number || !row.player) {
      continue;
    }

    const key = String(row.player_number);

    if (!uniquePlayerMap.has(key)) {
      uniquePlayerMap.set(key, {
        match_id: row.match_id || matchId,
        arena: row.arena || "",
        player_name: row.player,
        player_number: row.player_number
      });
    }
  }

  const boxScoreRows = Array.from(uniquePlayerMap.values()).map(player => {
    return createEmptyBoxScoreRow({
      matchId: player.match_id || matchId,
      arena: player.arena,
      playerName: player.player_name,
      playerNumber: player.player_number
    });
  });

  if (matchId) {
    boxScoreRows.push(createEmptyBoxScoreRow({
      matchId,
      arena: "home",
      playerName: "主隊團隊",
      playerNumber: Number(`${matchId}0`)
    }));

    boxScoreRows.push(createEmptyBoxScoreRow({
      matchId,
      arena: "away",
      playerName: "客隊團隊",
      playerNumber: Number(`${matchId}1`)
    }));
  }

  return boxScoreRows;
}

function createEmptyBoxScoreRow(context) {
  return {
    match_id: context.matchId,
    arena: context.arena,
    player_name: context.playerName,
    player_number: context.playerNumber,

    Point: 0,
    total_attempts: 0,

    close_hit: 0,
    close_made: 0,
    mid_hit: 0,
    mid_made: 0,
    three_hit: 0,
    three_made: 0,
    FT_hit: 0,
    FT_made: 0,

    lost_points: 0,
    total_defense_attempts: 0,

    defense_close_hit: 0,
    defense_close_made: 0,
    defense_mid_hit: 0,
    defense_mid_made: 0,
    defense_three_hit: 0,
    defense_three_made: 0,

    total_rebounds: 0,
    offensive_rebounds: 0,
    defensive_rebounds_conceded: 0,
    offensive_rebound_rate: 0,
    defensive_rebounds: 0,
    offensive_rebounds_conceded: 0,
    defensive_rebound_rate: 0,

    good_passes: 0,
    safe_passes: 0,
    normal_passes: 0,
    great_passes: 0,
    bad_passes: 0,
    touch_rate: 0,

    assists: 0,
    steals: 0,
    fouls: 0,
    fouled: 0,
    blocks: 0,
    blocked: 0,
    turnovers: 0,

    // 第一版先保留欄位，出場時間下一階段再計算。
    total_play_time: 0,
    pg_play_time: 0,
    sg_play_time: 0,
    sf_play_time: 0,
    pf_play_time: 0,
    c_play_time: 0,

    good_opportunity_hit: 0,
    normal_opportunity_hit: 0,
    excellent_opportunity_hit: 0,
    poor_opportunity_hit: 0,
    bad_opportunity_hit: 0,

    good_opportunity_made: 0,
    normal_opportunity_made: 0,
    excellent_opportunity_made: 0,
    poor_opportunity_made: 0,
    bad_opportunity_made: 0,

    good_opportunity_defense_hit: 0,
    normal_opportunity_defense_hit: 0,
    excellent_opportunity_defense_hit: 0,
    poor_opportunity_defense_hit: 0,
    bad_opportunity_defense_hit: 0,

    good_opportunity_defense_made: 0,
    normal_opportunity_defense_made: 0,
    excellent_opportunity_defense_made: 0,
    poor_opportunity_defense_made: 0,
    bad_opportunity_defense_made: 0
  };
}

function analyzeAndUpdateBoxScoreRows(boxScoreRows, matchDataRows, options = {}) {
  const matchId = String(options.matchId || "");

  const boxScoreMap = createBoxScoreRowMap(boxScoreRows);

  updateShotStats(boxScoreRows, boxScoreMap, matchDataRows);
  updateDefenseShotStats(boxScoreRows, boxScoreMap, matchDataRows);
  updatePointsAndLostPoints(boxScoreRows);
  updateReboundStats(boxScoreRows, boxScoreMap, matchDataRows);
  updatePassAndTouchStats(boxScoreRows, boxScoreMap, matchDataRows);
  updateSimpleCountingStats(boxScoreRows, boxScoreMap, matchDataRows);
  updateTeamTurnovers(boxScoreMap, matchDataRows, {
    matchId
  });
}

function createBoxScoreRowMap(boxScoreRows) {
  const map = new Map();

  for (const row of boxScoreRows) {
    if (row.player_number === null || row.player_number === undefined) {
      continue;
    }

    map.set(Number(row.player_number), row);
  }

  return map;
}

function updateShotStats(boxScoreRows, boxScoreMap, matchDataRows) {
  for (const row of matchDataRows) {
    if (!row.player_number) {
      continue;
    }

    const shotRule = getShotRuleByEvent(row.events);

    if (!shotRule) {
      continue;
    }

    const boxRow = boxScoreMap.get(Number(row.player_number));

    if (!boxRow) {
      continue;
    }

    if (shotRule.Close === 1) {
      boxRow.close_made += 1;

      if (isMadeByScoreOrRule(row, shotRule)) {
        boxRow.close_hit += 1;
      }
    }

    if (shotRule.Mid === 1) {
      boxRow.mid_made += 1;

      if (isMadeByScoreOrRule(row, shotRule)) {
        boxRow.mid_hit += 1;
      }
    }

    if (shotRule.Three === 1) {
      boxRow.three_made += 1;

      if (isMadeByScoreOrRule(row, shotRule)) {
        boxRow.three_hit += 1;
      }
    }

    if (shotRule.FT === 1) {
      boxRow.FT_made += 1;

      if (isMadeByScoreOrRule(row, shotRule)) {
        boxRow.FT_hit += 1;
      }
    }

    boxRow.total_attempts = boxRow.close_made + boxRow.mid_made + boxRow.three_made;
  }
}

function updateDefenseShotStats(boxScoreRows, boxScoreMap, matchDataRows) {
  for (const row of matchDataRows) {
    if (!row.other_player_number) {
      continue;
    }

    const shotRule = getShotRuleByEvent(row.events);

    if (!shotRule) {
      continue;
    }

    // 舊 Python 防守數據只計算 Close/Mid/Three，不計算 FT。
    if (shotRule.FT === 1) {
      continue;
    }

    const boxRow = boxScoreMap.get(Number(row.other_player_number));

    if (!boxRow) {
      continue;
    }

    if (shotRule.Close === 1) {
      boxRow.defense_close_made += 1;

      if (isMadeByScoreOrRule(row, shotRule)) {
        boxRow.defense_close_hit += 1;
      }
    }

    if (shotRule.Mid === 1) {
      boxRow.defense_mid_made += 1;

      if (isMadeByScoreOrRule(row, shotRule)) {
        boxRow.defense_mid_hit += 1;
      }
    }

    if (shotRule.Three === 1) {
      boxRow.defense_three_made += 1;

      if (isMadeByScoreOrRule(row, shotRule)) {
        boxRow.defense_three_hit += 1;
      }
    }

    boxRow.total_defense_attempts = boxRow.defense_close_made
      + boxRow.defense_mid_made
      + boxRow.defense_three_made;
  }
}

function isMadeByScoreOrRule(row, shotRule) {
  // 舊 Python 是用 score.notna() 判斷命中。
  // 這裡保留同樣行為，並以 shot_hit 作為補充保險。
  if (row.score) {
    return true;
  }

  return Number(shotRule.shot_hit) === 1;
}

function updatePointsAndLostPoints(boxScoreRows) {
  for (const row of boxScoreRows) {
    row.Point = row.close_hit * 2
      + row.mid_hit * 2
      + row.three_hit * 3
      + row.FT_hit;

    row.lost_points = row.defense_close_hit * 2
      + row.defense_mid_hit * 2
      + row.defense_three_hit * 3;
  }
}

function updateReboundStats(boxScoreRows, boxScoreMap, matchDataRows) {
  for (const boxRow of boxScoreRows) {
    const playerNumber = Number(boxRow.player_number);

    if (!playerNumber) {
      continue;
    }

    const offensiveRebounds = countRows(matchDataRows, row => {
      return Number(row.player_number) === playerNumber
        && BP_OFFENSIVE_REBOUND_EVENTS.includes(row.events);
    });

    const defensiveReboundsConceded = countRows(matchDataRows, row => {
      return Number(row.other_player_number) === playerNumber
        && BP_DEFENSIVE_REBOUND_EVENTS.includes(row.events);
    });

    const defensiveRebounds = countRows(matchDataRows, row => {
      return Number(row.player_number) === playerNumber
        && BP_DEFENSIVE_REBOUND_EVENTS.includes(row.events);
    });

    const offensiveReboundsConceded = countRows(matchDataRows, row => {
      return Number(row.other_player_number) === playerNumber
        && BP_OFFENSIVE_REBOUND_EVENTS.includes(row.events);
    });

    boxRow.offensive_rebounds = offensiveRebounds;
    boxRow.defensive_rebounds_conceded = defensiveReboundsConceded;
    boxRow.defensive_rebounds = defensiveRebounds;
    boxRow.offensive_rebounds_conceded = offensiveReboundsConceded;
    boxRow.total_rebounds = offensiveRebounds + defensiveRebounds;

    boxRow.offensive_rebound_rate = roundTo4(
      offensiveRebounds + defensiveReboundsConceded > 0
        ? offensiveRebounds / (offensiveRebounds + defensiveReboundsConceded)
        : 0
    );

    boxRow.defensive_rebound_rate = roundTo4(
      defensiveRebounds + offensiveReboundsConceded > 0
        ? defensiveRebounds / (defensiveRebounds + offensiveReboundsConceded)
        : 0
    );
  }
}

function updatePassAndTouchStats(boxScoreRows, boxScoreMap, matchDataRows) {
  const playerReceptions = new Map();
  const teamReceptions = {
    home: 0,
    away: 0
  };

  for (const boxRow of boxScoreRows) {
    if (boxRow.player_number !== null && boxRow.player_number !== undefined) {
      playerReceptions.set(Number(boxRow.player_number), 0);
    }
  }

  const passEventEntries = Object.entries(BP_PASS_EVENTS);

  for (const row of matchDataRows) {
    for (const [passColumn, passEventName] of passEventEntries) {
      if (row.events !== passEventName) {
        continue;
      }

      if (row.player_number) {
        const passerBoxRow = boxScoreMap.get(Number(row.player_number));

        if (passerBoxRow) {
          passerBoxRow[passColumn] += 1;
        }
      }

      if (row.other_player_number) {
        const receiverNumber = Number(row.other_player_number);

        playerReceptions.set(
          receiverNumber,
          (playerReceptions.get(receiverNumber) || 0) + 1
        );

        if (row.arena === "home") {
          teamReceptions.home += 1;
        }

        if (row.arena === "away") {
          teamReceptions.away += 1;
        }
      }
    }
  }

  for (const boxRow of boxScoreRows) {
    const playerNumber = Number(boxRow.player_number);

    if (!playerNumber) {
      continue;
    }

    const team = boxRow.arena;
    const totalTeamReceptions = teamReceptions[team] || 0;
    const receptionCount = playerReceptions.get(playerNumber) || 0;

    boxRow.touch_rate = roundTo4(
      totalTeamReceptions > 0
        ? receptionCount / totalTeamReceptions
        : 0
    );
  }
}

function updateSimpleCountingStats(boxScoreRows, boxScoreMap, matchDataRows) {
  for (const boxRow of boxScoreRows) {
    const playerNumber = Number(boxRow.player_number);

    if (!playerNumber) {
      continue;
    }

    boxRow.assists = countRows(matchDataRows, row => {
      return Number(row.player_number) === playerNumber
        && row.events === "助攻";
    });

    boxRow.steals = countRows(matchDataRows, row => {
      return Number(row.player_number) === playerNumber
        && BP_STEAL_EVENTS.includes(row.events);
    });

    boxRow.fouls = countRows(matchDataRows, row => {
      return Number(row.player_number) === playerNumber
        && BP_FOUL_EVENTS.includes(row.events);
    });

    boxRow.fouled = countRows(matchDataRows, row => {
      return Number(row.player_number) === playerNumber
        && BP_FOULED_EVENTS.includes(row.events);
    });

    boxRow.turnovers = countRows(matchDataRows, row => {
      return Number(row.player_number) === playerNumber
        && BP_TURNOVER_EVENTS.includes(row.events);
    });

    boxRow.blocks = countRows(matchDataRows, row => {
      return Number(row.player_number) === playerNumber
        && BP_BLOCK_EVENTS.includes(row.events);
    });

    boxRow.blocked = countRows(matchDataRows, row => {
      return Number(row.player_number) === playerNumber
        && BP_BLOCKED_EVENTS.includes(row.events);
    });
  }
}

function updateTeamTurnovers(boxScoreMap, matchDataRows, options = {}) {
  const matchId = String(options.matchId || "");

  if (!matchId) {
    return;
  }

  const homeTeamNumber = Number(`${matchId}0`);
  const awayTeamNumber = Number(`${matchId}1`);

  for (const row of matchDataRows) {
    if (!BP_TEAM_TURNOVER_EVENTS.includes(row.events)) {
      continue;
    }

    let teamNumber = null;

    if (row.arena === "home") {
      teamNumber = homeTeamNumber;
    }

    if (row.arena === "away") {
      teamNumber = awayTeamNumber;
    }

    if (!teamNumber) {
      continue;
    }

    const teamBoxRow = boxScoreMap.get(teamNumber);

    if (teamBoxRow) {
      teamBoxRow.turnovers += 1;
    }
  }
}

function calculatePlayTimeForBoxScoreRows(boxScoreRows, matchDataRows) {
  const boxScoreMap = createBoxScoreRowMap(boxScoreRows);

  const playersOnCourt = new Map();
  const totalPlayTime = new Map();

  const positionPlayTime = {
    PG: new Map(),
    SG: new Map(),
    SF: new Map(),
    PF: new Map(),
    C: new Map()
  };

  const onCourtEvents = [
    "先發控球後衛",
    "先發得分後衛",
    "先發小前鋒",
    "先發大前鋒",
    "先發中鋒",
    "替補上場",
    "最好的球員替補上場"
  ];

  const offCourtEvents = [
    "替換下場",
    "五犯畢業被替換出場",
    "犯規太多先替換下場，可能保留到比賽最後再上場"
  ];

  const positionChangeEvent = "球員換到不同位置";
  const quarterEndEvent = "本節比賽結束";

  for (const row of matchDataRows) {
    const eventName = row.events;
    const playerNumber = normalizeNullableNumberForAnalyzer(row.player_number);
    const position = normalizePlayTimePosition(row.first_events);
    const timeInSeconds = parsePlayByPlayClockToSeconds(row.time);

    if (timeInSeconds === null) {
      continue;
    }

    if (onCourtEvents.includes(eventName)) {
      if (!playerNumber) {
        continue;
      }

      if (!playersOnCourt.has(playerNumber)) {
        playersOnCourt.set(playerNumber, {
          position,
          startTime: timeInSeconds
        });
      }

      continue;
    }

    if (offCourtEvents.includes(eventName)) {
      if (!playerNumber) {
        continue;
      }

      if (!playersOnCourt.has(playerNumber)) {
        continue;
      }

      const currentState = playersOnCourt.get(playerNumber);
      const playTime = Math.max(0, currentState.startTime - timeInSeconds);

      addPlayTime(totalPlayTime, playerNumber, playTime);
      addPositionPlayTime(positionPlayTime, currentState.position, playerNumber, playTime);

      playersOnCourt.delete(playerNumber);

      continue;
    }

    if (eventName === positionChangeEvent) {
      if (!playerNumber) {
        continue;
      }

      if (!playersOnCourt.has(playerNumber)) {
        continue;
      }

      const currentState = playersOnCourt.get(playerNumber);
      const playTime = Math.max(0, currentState.startTime - timeInSeconds);

      addPlayTime(totalPlayTime, playerNumber, playTime);
      addPositionPlayTime(positionPlayTime, currentState.position, playerNumber, playTime);

      playersOnCourt.set(playerNumber, {
        position,
        startTime: timeInSeconds
      });

      continue;
    }

    if (eventName === quarterEndEvent) {
      for (const [onCourtPlayerNumber, currentState] of Array.from(playersOnCourt.entries())) {
        const playTime = Math.max(0, currentState.startTime);

        addPlayTime(totalPlayTime, onCourtPlayerNumber, playTime);
        addPositionPlayTime(positionPlayTime, currentState.position, onCourtPlayerNumber, playTime);

        playersOnCourt.delete(onCourtPlayerNumber);
      }
    }
  }

  for (const boxRow of boxScoreRows) {
    const playerNumber = normalizeNullableNumberForAnalyzer(boxRow.player_number);

    if (!playerNumber || !isRealPlayerNumber(playerNumber)) {
      continue;
    }

    const totalSeconds = totalPlayTime.get(playerNumber) || 0;

    boxRow.total_play_time = formatSecondsAsMinuteClock(totalSeconds);
    boxRow.pg_play_time = formatSecondsAsMinuteClock(positionPlayTime.PG.get(playerNumber) || 0);
    boxRow.sg_play_time = formatSecondsAsMinuteClock(positionPlayTime.SG.get(playerNumber) || 0);
    boxRow.sf_play_time = formatSecondsAsMinuteClock(positionPlayTime.SF.get(playerNumber) || 0);
    boxRow.pf_play_time = formatSecondsAsMinuteClock(positionPlayTime.PF.get(playerNumber) || 0);
    boxRow.c_play_time = formatSecondsAsMinuteClock(positionPlayTime.C.get(playerNumber) || 0);
  }
}

function normalizePlayTimePosition(position) {
  const text = normalizeText(position || "");

  if (text === "PG") return "PG";
  if (text === "SG") return "SG";
  if (text === "SF") return "SF";
  if (text === "PF") return "PF";
  if (text === "C") return "C";

  return "";
}

function parsePlayByPlayClockToSeconds(timeText) {
  const text = normalizeText(timeText || "");

  const match = text.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }

  return minutes * 60 + seconds;
}

function addPlayTime(totalPlayTime, playerNumber, seconds) {
  if (!playerNumber || !Number.isFinite(seconds) || seconds <= 0) {
    return;
  }

  totalPlayTime.set(
    Number(playerNumber),
    (totalPlayTime.get(Number(playerNumber)) || 0) + seconds
  );
}

function addPositionPlayTime(positionPlayTime, position, playerNumber, seconds) {
  const normalizedPosition = normalizePlayTimePosition(position);

  if (!normalizedPosition || !positionPlayTime[normalizedPosition]) {
    return;
  }

  if (!playerNumber || !Number.isFinite(seconds) || seconds <= 0) {
    return;
  }

  const positionMap = positionPlayTime[normalizedPosition];

  positionMap.set(
    Number(playerNumber),
    (positionMap.get(Number(playerNumber)) || 0) + seconds
  );
}

function formatSecondsAsMinuteClock(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));

  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function recordOpportunityEventsToBoxScoreRows(boxScoreRows, matchDataRows) {
  const boxScoreMap = createBoxScoreRowMap(boxScoreRows);

  for (const row of matchDataRows) {
    const opportunityRule = BP_OPPORTUNITY_MAPPING[row.first_events];

    if (!opportunityRule) {
      continue;
    }

    const shotRule = getShotRuleByEvent(row.events);

    if (!shotRule) {
      continue;
    }

    const shotHit = Number(shotRule.shot_hit) === 1 || Boolean(row.score);

    if (row.player_number) {
      const offensiveBoxRow = boxScoreMap.get(Number(row.player_number));

      if (offensiveBoxRow) {
        offensiveBoxRow[opportunityRule.made] += 1;

        if (shotHit) {
          offensiveBoxRow[opportunityRule.hit] += 1;
        }
      }
    }

    if (row.other_player_number) {
      const defensiveBoxRow = boxScoreMap.get(Number(row.other_player_number));

      if (defensiveBoxRow) {
        defensiveBoxRow[opportunityRule.defense_made] += 1;

        if (shotHit) {
          defensiveBoxRow[opportunityRule.defense_hit] += 1;
        }
      }
    }
  }
}

function countRows(rows, predicate) {
  let count = 0;

  for (const row of rows) {
    if (predicate(row)) {
      count += 1;
    }
  }

  return count;
}

function roundTo4(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.round(numberValue * 10000) / 10000;
}

function isRealPlayerNumber(playerNumber) {
  const text = String(playerNumber || "");

  return /^\d{7}$/.test(text);
}

function isTeamPlayerNumber(playerNumber, matchId) {
  const text = String(playerNumber || "");

  if (!matchId) {
    return false;
  }

  return text === `${matchId}0` || text === `${matchId}1`;
}

function buildBoxScoreDiagnostics(boxScoreRows, matchDataRows) {
  const shotEventCounts = {};
  const unknownShotLikeEvents = {};

  for (const row of matchDataRows) {
    const eventName = row.events || "";

    if (!eventName) {
      continue;
    }

    const shotRule = getShotRuleByEvent(eventName);

    if (shotRule) {
      shotEventCounts[eventName] = (shotEventCounts[eventName] || 0) + 1;
      continue;
    }

    if (isLikelyShotEventName(eventName)) {
      unknownShotLikeEvents[eventName] = (unknownShotLikeEvents[eventName] || 0) + 1;
    }
  }

  return {
    matchDataRowCount: matchDataRows.length,
    boxScoreRowCount: boxScoreRows.length,
    playerBoxScoreRowCount: boxScoreRows.filter(row => isRealPlayerNumber(row.player_number)).length,
    teamBoxScoreRowCount: boxScoreRows.filter(row => !isRealPlayerNumber(row.player_number)).length,

    totalPoints: sumRows(boxScoreRows, row => row.Point),
    totalAttempts: sumRows(boxScoreRows, row => row.total_attempts),
    totalThreeMade: sumRows(boxScoreRows, row => row.three_made),
    totalThreeHit: sumRows(boxScoreRows, row => row.three_hit),
    totalFtMade: sumRows(boxScoreRows, row => row.FT_made),
    totalFtHit: sumRows(boxScoreRows, row => row.FT_hit),

    shotEventCountsPreview: Object.entries(shotEventCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([events, count]) => ({ events, count })),

    unknownShotLikeEventsPreview: Object.entries(unknownShotLikeEvents)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([events, count]) => ({ events, count })),

    firstBoxScoreRows: boxScoreRows.slice(0, 20),
    playerBoxScorePreview: boxScoreRows
      .filter(row => isRealPlayerNumber(row.player_number))
      .slice(0, 20),
    teamBoxScoreRows: boxScoreRows.filter(row => !isRealPlayerNumber(row.player_number))
  };
}

function sumRows(rows, selector) {
  return rows.reduce((sum, row) => {
    const value = Number(selector(row) || 0);

    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function isLikelyShotEventName(eventName) {
  return /投籃|罰球|灌籃|快攻|出手|麵包|火鍋|封蓋|命中|沒進|沒中|失手|精準/.test(eventName || "");
}

function getBoxScoreCsvColumns() {
  return [
    "match_id",
    "arena",
    "player_name",
    "player_number",

    "Point",
    "total_attempts",

    "close_hit",
    "close_made",
    "mid_hit",
    "mid_made",
    "three_hit",
    "three_made",
    "FT_hit",
    "FT_made",

    "lost_points",
    "total_defense_attempts",

    "defense_close_hit",
    "defense_close_made",
    "defense_mid_hit",
    "defense_mid_made",
    "defense_three_hit",
    "defense_three_made",

    "total_rebounds",
    "offensive_rebounds",
    "defensive_rebounds_conceded",
    "offensive_rebound_rate",
    "defensive_rebounds",
    "offensive_rebounds_conceded",
    "defensive_rebound_rate",

    "good_passes",
    "safe_passes",
    "normal_passes",
    "great_passes",
    "bad_passes",
    "touch_rate",

    "assists",
    "steals",
    "fouls",
    "fouled",
    "blocks",
    "blocked",
    "turnovers",

    "total_play_time",
    "pg_play_time",
    "sg_play_time",
    "sf_play_time",
    "pf_play_time",
    "c_play_time",

    "good_opportunity_hit",
    "normal_opportunity_hit",
    "excellent_opportunity_hit",
    "poor_opportunity_hit",
    "bad_opportunity_hit",

    "good_opportunity_made",
    "normal_opportunity_made",
    "excellent_opportunity_made",
    "poor_opportunity_made",
    "bad_opportunity_made",

    "good_opportunity_defense_hit",
    "normal_opportunity_defense_hit",
    "excellent_opportunity_defense_hit",
    "poor_opportunity_defense_hit",
    "bad_opportunity_defense_hit",

    "good_opportunity_defense_made",
    "normal_opportunity_defense_made",
    "excellent_opportunity_defense_made",
    "poor_opportunity_defense_made",
    "bad_opportunity_defense_made"
  ];
}

function convertBoxScoreRowsToCsv(boxScoreRows) {
  const columns = getBoxScoreCsvColumns();

  const lines = [];

  lines.push(columns.map(escapeAnalyzerCsvCell).join(","));

  for (const row of boxScoreRows) {
    const line = columns.map(column => {
      return escapeAnalyzerCsvCell(row?.[column]);
    }).join(",");

    lines.push(line);
  }

  return `\uFEFF${lines.join("\r\n")}`;
}

function escapeAnalyzerCsvCell(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function buildTraditionalBoxScoreRows(boxScoreRows) {
  return boxScoreRows
    .filter(row => isRealPlayerNumber(row.player_number))
    .map(row => {
      const fieldGoalHit = row.close_hit + row.mid_hit + row.three_hit;

      return {
        arena: row.arena,
        player_name: row.player_name,
        player_number: row.player_number,
        MIN: row.total_play_time,
        PTS: row.Point,
        "FG%": row.total_attempts > 0
          ? roundTo2(fieldGoalHit / row.total_attempts * 100)
          : "X",
        "3FG%": row.three_made > 0
          ? roundTo2(row.three_hit / row.three_made * 100)
          : "X",
        "FT%": row.FT_made > 0
          ? roundTo2(row.FT_hit / row.FT_made * 100)
          : "X",
        "TS%": (row.total_attempts + row.FT_made) > 0
          ? roundTo2(row.Point / (2 * (row.total_attempts + 0.44 * row.FT_made)) * 100)
          : "X",
        lost_points: row.lost_points,
        "DTS%": row.total_defense_attempts > 0
          ? roundTo2(row.lost_points / (2 * row.total_defense_attempts) * 100)
          : "X",
        DFGA: row.total_defense_attempts,
        "O-R": row.offensive_rebounds,
        "D-R": row.defensive_rebounds,
        "T-R": row.total_rebounds,
        AST: row.assists,
        STL: row.steals,
        PF: row.fouls,
        TO: row.turnovers,
        BLK: row.blocks,
        EFF: row.Point
          + row.total_rebounds
          + row.assists
          + row.steals
          + row.blocks
          + fieldGoalHit
          - row.total_attempts
          + row.FT_hit
          - row.FT_made
          - row.turnovers,
        net_contribution: row.Point - row.lost_points
      };
    });
}

function roundTo2(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.round(numberValue * 100) / 100;
}
