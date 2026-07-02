// 專案路徑：src/content/core/fetchClient.js
// 模組說明：全專案共用 HTML 抓取工具。透過 background service worker 發送 fetch，避免 content script 權限與 CORS 問題。

function fetchHtmlByBackground(url) {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== "string" || !url.trim()) {
      reject(new Error("fetchHtmlByBackground 收到空 URL"));
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "BP_FETCH_HTML",
        url
      },
      response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response && response.ok) {
          resolve(response.html);
          return;
        }

        reject(new Error(response?.error || "fetch html failed"));
      }
    );
  });
}
