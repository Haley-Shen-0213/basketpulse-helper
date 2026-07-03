// 專案路徑：src/content/match/matchFetch.js
// 模組說明：比賽資料抓取模組。負責根據 matchId 抓取 play-by-play HTML，並可透過隱藏 iframe 完整載入渲染後頁面再擷取 rawText / rawHtml / DOM rows。

async function fetchMatchPlayByPlayHtml(matchId) {
  if (!matchId) {
    throw new Error("fetchMatchPlayByPlayHtml 缺少 matchId");
  }

  const candidateUrls = buildPlayByPlayCandidateUrls(matchId);

  let lastError = null;

  for (const url of candidateUrls) {
    try {
      bpDebugLog("[BasketPulse Helper] try fetch play-by-play:", url);

      const html = await fetchHtmlByBackground(url);

      if (isLikelyPlayByPlayHtml(html)) {
        return {
          ok: true,
          url,
          html
        };
      }

      lastError = new Error(`HTML 不像 play-by-play 頁面：${url}`);
    } catch (error) {
      lastError = error;
      bpDebugLog("[BasketPulse Helper] play-by-play fetch failed:", url, error);
    }
  }

  throw lastError || new Error("所有 play-by-play URL 都抓取失敗");
}

function buildPlayByPlayCandidateUrls(matchId) {
  return [
    `${BP_BASE_URL}/tw/Match/${matchId}/play-by-play`,
    `${BP_BASE_URL}/tw/Match/${matchId}/playbyplay`,
    `${BP_BASE_URL}/tw/Match/${matchId}/pbp`,
    `${BP_BASE_URL}/tw/Match/${matchId}/report`,
    `${BP_BASE_URL}/tw/Match/${matchId}/description?tab=play-by-play`
  ];
}

function isLikelyPlayByPlayHtml(html) {
  const text = normalizeText(html || "");

  if (!text) {
    return false;
  }

  return text.includes("play-by-play")
    || text.includes("Play-by-play")
    || text.includes("逐球")
    || text.includes("逐回合")
    || text.includes("比賽紀錄")
    || text.includes("比賽實況")
    || text.includes("box score")
    || text.includes("Box Score")
    || text.includes("/Player/");
}

async function captureRenderedPlayByPlayPage(matchId, options = {}) {
  if (!matchId) {
    throw new Error("captureRenderedPlayByPlayPage 缺少 matchId");
  }

  const waitAfterLoadMs = Number(options.waitAfterLoadMs || 30000);
  const url = `${BP_BASE_URL}/tw/Match/${matchId}/play-by-play`;

  const iframe = createHiddenPlayByPlayIframe();

  try {
    setMatchProbeStatus("正在載入完整 play-by-play 頁面...");

    await loadUrlIntoIframe(iframe, url);

    setMatchProbeStatus(`play-by-play 頁已載入，等待 ${Math.round(waitAfterLoadMs / 1000)} 秒讓事件完整渲染...`);

    await sleep(waitAfterLoadMs);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!doc) {
      throw new Error("無法讀取 iframe 文件，可能受到瀏覽器安全限制");
    }

    const rawText = doc.body?.innerText || doc.body?.textContent || "";
    const rawHtml = doc.documentElement?.outerHTML || "";
    const domRows = extractRenderedPlayByPlayDomRows(doc);

    return {
      ok: true,
      url,
      capturedAt: new Date().toISOString(),
      waitAfterLoadMs,
      rawText,
      rawHtml,
      domRows,
      diagnostics: buildRenderedPlayByPlayCaptureDiagnostics(rawText, rawHtml, domRows)
    };
  } finally {
    iframe.remove();
  }
}

function createHiddenPlayByPlayIframe() {
  let iframe = document.querySelector("#bp-hidden-play-by-play-frame");

  if (iframe) {
    iframe.remove();
  }

  iframe = document.createElement("iframe");
  iframe.id = "bp-hidden-play-by-play-frame";
  iframe.title = "BasketPulse hidden play-by-play loader";
  iframe.style.position = "fixed";
  iframe.style.left = "-99999px";
  iframe.style.top = "0";
  iframe.style.width = "1200px";
  iframe.style.height = "900px";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.border = "0";
  iframe.style.zIndex = "-1";

  document.body.appendChild(iframe);

  return iframe;
}

function loadUrlIntoIframe(iframe, url) {
  return new Promise((resolve, reject) => {
    const timeoutMs = 45000;

    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;

      settled = true;
      reject(new Error(`iframe 載入逾時：${url}`));
    }, timeoutMs);

    iframe.addEventListener("load", () => {
      if (settled) return;

      settled = true;
      clearTimeout(timeoutId);
      resolve();
    }, { once: true });

    iframe.src = url;
  });
}

function extractRenderedPlayByPlayDomRows(doc) {
  const items = Array.from(doc.querySelectorAll(".match-play-by-play__events-item"));

  return items.map((item, index) => {
    const classList = Array.from(item.classList || []);

    const isHome = classList.includes("match-play-by-play__events-item--home");
    const isAway = classList.includes("match-play-by-play__events-item--away");
    const isQuarterBoundary = classList.includes("match-play-by-play__events-item-quarter-start-end");

    const arena = isHome ? "home" : isAway ? "away" : "";

    const boundaryText = isQuarterBoundary
      ? normalizeText(item.querySelector(".text-center")?.textContent || "")
      : "";

    const boundaryInfo = parsePlayByPlayQuarterBoundaryText(boundaryText);

    const quarterText = normalizeText(
      item.querySelector(".match-play-by-play__quarter")?.textContent || ""
    );

    const quarterMatch = quarterText.match(/\d+/);
    const quarterFromScoreBlock = quarterMatch ? Number(quarterMatch[0]) : null;

    const quarter = quarterFromScoreBlock || boundaryInfo.quarter || null;

    const timeFromScoreBlock = normalizeText(
      item.querySelector(".match-play-by-play__event-time")?.textContent || ""
    );

    const time = timeFromScoreBlock || boundaryInfo.time || "";

    const score = normalizeText(
      item.querySelector(".match-play-by-play__points")?.textContent || ""
    );

    const eventsElement = item.querySelector(".match-play-by-play__item-team-away")
      || item.querySelector(".match-play-by-play__item-team-home");

    const rawEventText = eventsElement
      ? normalizeText(eventsElement.textContent || "")
      : boundaryText;

    const rawEventHtml = eventsElement?.innerHTML || "";

    const playerLinks = eventsElement
      ? Array.from(eventsElement.querySelectorAll('a[href*="/tw/Player/"][href$="/description"]')).map(link => {
        const href = link.getAttribute("href") || "";
        const playerNumberMatch = href.match(/\/Player\/(\d+)\/description/);

        return {
          text: normalizeText(link.textContent || ""),
          title: normalizeText(link.getAttribute("title") || ""),
          href,
          playerNumber: playerNumberMatch ? Number(playerNumberMatch[1]) : null
        };
      })
      : [];

    const chronologyElements = eventsElement
      ? Array.from(eventsElement.querySelectorAll(".chronology_add_info")).map(element => {
        const link = element.querySelector('a[href*="/tw/Player/"][href$="/description"]');
        const href = link?.getAttribute("href") || "";
        const playerNumberMatch = href.match(/\/Player\/(\d+)\/description/);

        return {
          text: normalizeText(element.textContent || ""),
          hasPlayerLink: Boolean(link),
          playerText: normalizeText(link?.textContent || ""),
          playerHref: href,
          playerNumber: playerNumberMatch ? Number(playerNumberMatch[1]) : null
        };
      })
      : [];

    return {
      rowIndex: index,
      arena,
      quarter,
      quarterText: quarterText || boundaryInfo.quarterText || "",
      time,
      score,
      rawEventText,
      rawEventHtml,
      isQuarterBoundary,
      boundaryText,
      boundaryEvent: boundaryInfo.eventName,
      playerLinks,
      chronologyElements
    };
  }).filter(row => {
    return row.quarter || row.time || row.score || row.rawEventText;
  });
}

function parsePlayByPlayQuarterBoundaryText(text) {
  const normalizedText = normalizeText(text || "");

  const match = normalizedText.match(/^節\s*([1-4])\s*(本節比賽開始|本節比賽結束)$/);

  if (!match) {
    return {
      quarter: null,
      quarterText: "",
      eventName: "",
      time: ""
    };
  }

  const quarter = Number(match[1]);
  const eventName = match[2];

  return {
    quarter,
    quarterText: `節${quarter}`,
    eventName,
    time: eventName === "本節比賽開始" ? "10:00" : "00:00"
  };
}

function buildRenderedPlayByPlayCaptureDiagnostics(rawText, rawHtml, domRows = []) {
  const lines = String(rawText || "")
    .split(/\n+/)
    .map(line => normalizeText(line))
    .filter(Boolean);

  const eventLikeLineCount = lines.filter(line => {
    return /節\s*[1-4]|^\d{1,2}:\d{2}$|投籃|傳球|籃板|犯規|失誤|抄截|封蓋|阻攻|罰球|替換|替補|發邊線球|快攻|走步|踢球|助攻|灌籃|戰術|機會|球員|防守|進攻|違例|丟掉球權|爭球/.test(line);
  }).length;

  const clockLineCount = lines.filter(line => /^\d{1,2}:\d{2}$/.test(line)).length;
  const quarterLineCount = lines.filter(line => /^節\s*[1-4]$/.test(line)).length;

  const quarterBoundaryLineCount = lines.filter(line => {
    return /^節\s*[1-4]\s*(本節比賽開始|本節比賽結束)$/.test(line);
  }).length;

  const scoreLineCount = lines.filter(line => {
    if (!/^\d{1,3}:\d{1,3}$/.test(line)) {
      return false;
    }

    const [leftText, rightText] = line.split(":");
    const left = Number(leftText);
    const right = Number(rightText);

    if (left >= 0 && left <= 10 && right >= 0 && right <= 59) {
      return false;
    }

    return true;
  }).length;

  return {
    rawTextLength: String(rawText || "").length,
    rawHtmlLength: String(rawHtml || "").length,
    lineCount: lines.length,
    eventLikeLineCount,
    clockLineCount,
    quarterLineCount,
    quarterBoundaryLineCount,
    scoreLineCount,

    domRowCount: domRows.length,
    domEventRowCount: domRows.filter(row => row.rawEventText).length,
    domScoreRowCount: domRows.filter(row => row.score).length,
    domQuarterBoundaryRowCount: domRows.filter(row => row.isQuarterBoundary).length,

    firstLines: lines.slice(0, 80),
    lastLines: lines.slice(-80)
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
