// 專案路徑：src/content/match/matchRenderer.js
// 模組說明：比賽資料探測結果渲染模組。負責將 matchId、play-by-play 抓取結果、matchData 摘要、官方 box score 球員列結果、完整渲染頁擷取結果顯示在頁面上，並提供一鍵複製完整探測結果功能。

function renderMatchProbeInitialSummary(context) {
  const panel = createOrGetMatchProbePanel();

  panel.innerHTML = "";

  const header = createMatchProbePanelHeader("比賽資料探測結果");

  const summary = document.createElement("pre");
  summary.className = "bp-match-probe-pre";

  const result = {
    step: "initial",
    matchId: context.matchId,
    descriptionPageStarted: true,
    officialBoxScorePlayerRowCount: context.boxScoreInfo?.playerRowCount || 0
  };

  summary.textContent = JSON.stringify(result, null, 2);
  panel.dataset.fullResultJson = JSON.stringify(result, null, 2);

  panel.appendChild(header);
  panel.appendChild(summary);
}

function renderMatchProbeResult(result) {
  const panel = createOrGetMatchProbePanel();

  panel.innerHTML = "";

  const header = createMatchProbePanelHeader("比賽資料探測結果");

  const summary = document.createElement("pre");
  summary.className = "bp-match-probe-pre";

  const displayResult = createDisplaySafeMatchProbeResult(result);

  summary.textContent = JSON.stringify(displayResult, null, 2);
  panel.dataset.fullResultJson = JSON.stringify(result, null, 2);

  panel.appendChild(header);
  panel.appendChild(summary);
}

function createDisplaySafeMatchProbeResult(result) {
  if (!result || typeof result !== "object") {
    return result;
  }

  const clone = JSON.parse(JSON.stringify(result));

  if (clone.rawText) {
    clone.rawText = `[已擷取 rawText，長度 ${String(result.rawText).length}，請使用「複製探測結果」取得完整內容]`;
  }

  if (clone.rawHtml) {
    clone.rawHtml = `[已擷取 rawHtml，長度 ${String(result.rawHtml).length}，請使用「複製探測結果」取得完整內容]`;
  }

  return clone;
}

function createMatchProbePanelHeader(titleText) {
  const header = document.createElement("div");
  header.className = "bp-match-probe-panel-header";

  const title = document.createElement("div");
  title.className = "bp-match-probe-panel-title";
  title.textContent = titleText;

  const buttonGroup = document.createElement("div");
  buttonGroup.className = "bp-match-probe-panel-actions";

  const copyButton = createMatchProbeCopyButton();

  buttonGroup.appendChild(copyButton);

  header.appendChild(title);
  header.appendChild(buttonGroup);

  return header;
}

function createMatchProbeCopyButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "bp-match-probe-copy-button";
  button.textContent = "複製探測結果";
  button.title = "將目前完整探測結果複製到剪貼簿，方便貼給 AI 分析";

  button.addEventListener("click", async () => {
    await copyCurrentMatchProbeResultToClipboard(button);
  });

  return button;
}

async function copyCurrentMatchProbeResultToClipboard(button) {
  const panel = document.querySelector("#bp-match-probe-panel");
  const pre = panel?.querySelector(".bp-match-probe-pre");
  const text = panel?.dataset.fullResultJson || pre?.textContent || "";

  if (!text.trim()) {
    alert("目前沒有可複製的探測結果。");
    return;
  }

  const originalText = button?.textContent || "複製探測結果";

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopyTextToClipboard(text);
    }

    showMatchProbeCopySuccess(button, originalText);

    if (typeof setMatchProbeStatus === "function") {
      setMatchProbeStatus("探測結果已複製到剪貼簿");
    }
  } catch (error) {
    console.error("[BasketPulse Helper] 複製探測結果失敗:", error);

    try {
      fallbackCopyTextToClipboard(text);

      showMatchProbeCopySuccess(button, originalText);

      if (typeof setMatchProbeStatus === "function") {
        setMatchProbeStatus("探測結果已複製到剪貼簿");
      }
    } catch (fallbackError) {
      console.error("[BasketPulse Helper] fallback copy failed:", fallbackError);
      alert(`複製失敗：${fallbackError.message || fallbackError}`);
    }
  }
}

function showMatchProbeCopySuccess(button, originalText) {
  if (!button) {
    return;
  }

  button.textContent = "已複製";
  button.disabled = true;

  setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
  }, 1200);
}

function fallbackCopyTextToClipboard(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const ok = document.execCommand("copy");

  textarea.remove();

  if (!ok) {
    throw new Error("document.execCommand copy failed");
  }
}

function createOrGetMatchProbePanel() {
  let panel = document.querySelector("#bp-match-probe-panel");

  if (panel) {
    return panel;
  }

  panel = document.createElement("div");
  panel.id = "bp-match-probe-panel";

  const toolbar = document.querySelector("#bp-match-probe-toolbar");

  if (toolbar) {
    toolbar.after(panel);
  } else {
    document.body.prepend(panel);
  }

  return panel;
}
