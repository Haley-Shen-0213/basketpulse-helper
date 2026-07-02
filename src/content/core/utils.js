// 專案路徑：src/content/core/utils.js
// 模組說明：全專案共用工具函式。包含文字正規化、百分比文字正規化等基礎處理。

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizePercentValue(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim();
}
