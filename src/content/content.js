// 專案路徑：src/content/content.js
// 模組說明：Content Script 主入口。負責判斷目前頁面類型，並啟動對應的功能模組。

function main() {
  bpDebugLog("[BasketPulse Helper] content script loaded");

  if (isSupportedTrainingPage()) {
    initTrainingHelperPage();
    return;
  }

  if (isMatchDescriptionPage()) {
    initMatchProbePage();
    return;
  }

  bpDebugLog("[BasketPulse Helper] unsupported BasketPulse page");
}

main();
