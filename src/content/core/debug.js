// 專案路徑：src/content/core/debug.js
// 模組說明：全專案共用 Debug 工具。可控制是否輸出除錯訊息與表格。

const BP_HELPER_DEBUG = false;

function bpDebugLog(...args) {
  if (BP_HELPER_DEBUG) {
    console.log(...args);
  }
}

function bpDebugTable(...args) {
  if (BP_HELPER_DEBUG) {
    console.table(...args);
  }
}
