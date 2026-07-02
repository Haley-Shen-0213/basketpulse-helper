// 專案路徑：src/content/core/pageRouter.js
// 模組說明：頁面路由判斷工具。負責判斷目前 BasketPulse 頁面是否支援球員訓練輔助功能，未來也可擴充比賽頁判斷。

/**
 * 判斷目前是否為 BasketPulse 網站。
 */
function isBasketPulseSite() {
  return location.hostname === "www.basketpulse.com";
}

/**
 * 判斷目前是否為球員相關插件支援頁面。
 *
 * 支援頁面：
 * 1. 球員技能頁
 *    https://www.basketpulse.com/tw/Players/skills
 *
 * 2. 籃球學校頁
 *    https://www.basketpulse.com/tw/School/main
 */
function isSupportedTrainingPage() {
  return isBasketPulseSite()
    && (
      location.pathname.includes("/Players/skills")
      || location.pathname.includes("/School/main")
    );
}

/**
 * 是否為球員技能頁。
 */
function isSkillsPage() {
  return isBasketPulseSite()
    && location.pathname.includes("/Players/skills");
}

/**
 * 是否為籃球學校頁。
 */
function isSchoolMainPage() {
  return isBasketPulseSite()
    && location.pathname.includes("/School/main");
}

/**
 * 預留：是否為比賽 description 頁。
 *
 * 目前比賽分析功能尚未啟用，先保留路由判斷。
 */
function isMatchDescriptionPage() {
  return isBasketPulseSite()
    && /\/tw\/Match\/\d+\/description/.test(location.pathname);
}
