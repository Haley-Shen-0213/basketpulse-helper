# BasketPulse Helper 架構說明

本文說明 BasketPulse Helper v0.2.0 的專案架構、檔案用途、模組分層與主要資料流程。

---

## 一、專案定位

BasketPulse Helper 是一個非官方 Chrome 擴充功能，主要用於改善 BasketPulse 的資料閱讀、整理、分析與分享體驗。

目前包含兩大功能模組：

1. **球員訓練輔助**
   - 支援球員技能頁。
   - 支援籃球學校頁。
   - 顯示潛力素質。
   - 顯示訓練結果。
   - 支援球員名單匯出 PNG。
   - 支援主要球員、出借球員、全部球員、自選球員匯出。

2. **比賽數據強化**
   - 支援比賽 description 頁。
   - 載入 rendered play-by-play。
   - 解析逐球資料。
   - 計算進階 box score。
   - 補強官方 Box Score。
   - 支援強化模式下的自訂排序。

---

## 二、目前支援頁面

### 1. 球員訓練輔助

```text
https://www.basketpulse.com/tw/Players/skills
https://www.basketpulse.com/tw/School/main
```

### 2. 比賽數據強化

```text
https://www.basketpulse.com/tw/Match/{matchId}/description
```

---

## 三、專案完整檔案樹與用途

```text
basketpulse-helper/
├── .gitignore
│   └── Git 忽略規則。
│       用於排除：
│       - 作業系統暫存檔
│       - log 檔
│       - build / dist 輸出
│       - IDE 設定
│       - node_modules
│       - zip / crx / pem
│       - ai_exports
│
├── manifest.json
│   └── Chrome Extension Manifest V3 設定檔。
│       定義：
│       - 擴充功能名稱
│       - 版本號
│       - 權限
│       - host permissions
│       - background service worker
│       - content scripts
│       - CSS 載入
│       - content script 載入順序
│
├── README.md
│   └── 專案使用說明。
│       包含：
│       - 功能介紹
│       - 支援頁面
│       - 安裝方式
│       - 使用方式
│       - 權限說明
│       - 隱私權說明
│       - 第三方套件說明
│
├── THIRD_PARTY_LICENSES.txt
│   └── 第三方套件授權說明。
│       目前主要記錄：
│       - html2canvas
│
├── project_export_for_ai.py
│   └── 專案輸出輔助工具。
│       用途：
│       - 輸出專案檔案樹。
│       - 統計指定範圍行數與字數。
│       - 輸出指定範圍程式碼內容。
│       - 方便提供給 AI 助手閱讀。
│
├── docs/
│   └── ARCHITECTURE.zh-TW.md
│       └── 本文件。
│           說明：
│           - 專案架構
│           - 檔案用途
│           - 模組分層
│           - 主要資料流程
│           - 開發注意事項
│
└── src/
    ├── background/
    │   └── background.js
    │       └── Background service worker。
    │           負責代替 content script 抓取 BasketPulse HTML。
    │           目前處理：
    │           - 接收 BP_FETCH_HTML message
    │           - 檢查 URL 是否允許
    │           - 使用 fetch 抓取 HTML
    │           - 使用 credentials: include 保留登入狀態
    │           - 針對 502 / 503 / 504 做 retry
    │           - 回傳 HTML 給 content script
    │
    ├── vendor/
    │   └── html2canvas.min.js
    │       └── 第三方套件。
    │           用途：
    │           - 將球員表格轉換為 canvas。
    │           - 匯出 PNG 圖片。
    │
    └── content/
        ├── content.js
        │   └── Content Script 主入口。
        │       職責：
        │       - 判斷目前頁面類型。
        │       - 啟動球員訓練輔助。
        │       - 啟動比賽數據強化。
        │
        ├── content.css
        │   └── Content Script 共用樣式。
        │       包含：
        │       - 球員訓練工具列樣式
        │       - 球員補充資料列樣式
        │       - 自選球員 checkbox 樣式
        │       - 匯出圖片臨時容器樣式
        │       - 比賽頁工具列樣式
        │       - 比賽探測 panel 樣式
        │       - hidden iframe 安全樣式
        │
        ├── core/
        │   ├── constants.js
        │   │   └── 全專案共用常數。
        │   │       目前包含：
        │   │       - BP_BASE_URL
        │   │
        │   ├── debug.js
        │   │   └── Debug 工具。
        │   │       包含：
        │   │       - BP_HELPER_DEBUG
        │   │       - bpDebugLog()
        │   │       - bpDebugTable()
        │   │
        │   ├── fetchClient.js
        │   │   └── Content script 端 HTML fetch client。
        │   │       職責：
        │   │       - 使用 chrome.runtime.sendMessage()
        │   │       - 發送 BP_FETCH_HTML 給 background service worker
        │   │       - 接收 HTML 或錯誤訊息
        │   │
        │   ├── pageRouter.js
        │   │   └── 頁面路由判斷工具。
        │   │       包含：
        │   │       - isBasketPulseSite()
        │   │       - isSupportedTrainingPage()
        │   │       - isSkillsPage()
        │   │       - isSchoolMainPage()
        │   │       - isMatchDescriptionPage()
        │   │
        │   ├── storageCache.js
        │   │   └── 預留快取模組。
        │   │       目前為空。
        │   │       訓練總覽快取目前仍在 trainingOverviewFetch.js 中處理。
        │   │
        │   └── utils.js
        │       └── 全專案共用工具函式。
        │           包含：
        │           - normalizeText()
        │           - normalizePercentValue()
        │
        ├── training/
        │   ├── trainingConstants.js
        │   │   └── 球員訓練功能常數。
        │   │       包含：
        │   │       - TRAINING_OVERVIEW_URL
        │   │       - TRAINING_OVERVIEW_HTML_CACHE_KEY
        │   │       - TRAINING_OVERVIEW_HTML_CACHE_TIME_KEY
        │   │       - TRAINING_OVERVIEW_CACHE_MAX_AGE
        │   │       - EXPORT_RANGE_MAIN
        │   │       - EXPORT_RANGE_LOAN
        │   │       - EXPORT_RANGE_ALL
        │   │       - EXPORT_RANGE_SELECTED
        │   │       - SKILL_COLUMNS
        │   │       - SKILL_LABELS
        │   │
        │   ├── trainingExport.js
        │   │   └── 球員名單匯出模組。
        │   │       職責：
        │   │       - 取得目前匯出範圍
        │   │       - 切換自選球員模式
        │   │       - 全選 / 取消全選
        │   │       - 只選主要 / 只選出借
        │   │       - 建立臨時匯出 DOM
        │   │       - 呼叫 html2canvas
        │   │       - 下載 PNG
        │   │       - 匯出主要球員、出借球員、全部球員、自選球員
        │   │
        │   ├── trainingOverviewFetch.js
        │   │   └── 訓練總覽抓取與快取模組。
        │   │       職責：
        │   │       - 抓取 /tw/Training/overview
        │   │       - 使用 chrome.storage.local 暫存 HTML
        │   │       - 控制快取有效時間
        │   │       - 批次載入所有球員潛力 / 訓練資料
        │   │       - 清除訓練總覽快取
        │   │
        │   ├── trainingOverviewParser.js
        │   │   └── 訓練總覽 HTML 解析模組。
        │   │       職責：
        │   │       - 在訓練總覽 HTML 中找到指定球員
        │   │       - 解析技能目前值
        │   │       - 解析潛力百分比
        │   │       - 解析訓練提升點數
        │   │       - 正規化訓練欄位 key
        │   │
        │   ├── trainingPage.js
        │   │   └── 球員訓練頁入口。
        │   │       職責：
        │   │       - 等待球員表格載入
        │   │       - 找出頁面上的球員表格
        │   │       - 解析球員清單
        │   │       - 建立工具列
        │   │       - 強化表格資料列
        │   │
        │   ├── trainingPlayerParser.js
        │   │   └── 球員表格解析模組。
        │   │       職責：
        │   │       - 從 table rows 解析球員 ID
        │   │       - 解析球員姓名
        │   │       - 解析球員 href
        │   │       - 判斷 table index
        │   │       - 判斷是否像出借 / 租借球員
        │   │       - 判斷頁面是否有出借球員區塊
        │   │
        │   ├── trainingRows.js
        │   │   └── 球員資料列強化模組。
        │   │       職責：
        │   │       - 標記原始球員列
        │   │       - 新增潛力素質列
        │   │       - 新增訓練結果列
        │   │       - 新增自選匯出 checkbox
        │   │       - 填入資料
        │   │       - 清除資料
        │   │       - 顯示 loading / error 狀態
        │   │
        │   └── trainingToolbar.js
        │       └── 球員訓練工具列模組。
        │           職責：
        │           - 建立 BasketPulse Helper 工具列
        │           - 載入潛力 / 訓練資料
        │           - 更新資料
        │           - 選擇匯出範圍
        │           - 匯出圖片
        │           - 顯示 / 隱藏資料列
        │           - 狀態文字更新
        │
        └── match/
            ├── matchAnalyzer.js
            │   └── 比賽 box score 分析模組。
            │       職責：
            │       - 將 play-by-play rows 轉換成 boxScoreRows
            │       - 建立球員初始 box score row
            │       - 計算投籃數據
            │       - 計算防守投籃數據
            │       - 計算得分 / 失分
            │       - 計算籃板與籃板率
            │       - 計算傳球與觸球率
            │       - 計算助攻、抄截、犯規、失誤、封蓋
            │       - 計算總出場時間
            │       - 計算 PG / SG / SF / PF / C 各位置時間
            │       - 計算出手機會品質
            │       - 建立 diagnostics
            │       - 提供 CSV 欄位轉換工具
            │
            ├── matchFetch.js
            │   └── 比賽資料抓取模組。
            │       職責：
            │       - 建立 play-by-play candidate URLs
            │       - 抓取 play-by-play HTML
            │       - 建立 hidden iframe
            │       - 完整載入 rendered play-by-play 頁
            │       - 等待頁面完整渲染
            │       - 擷取 rawText
            │       - 擷取 rawHtml
            │       - 擷取 rendered DOM rows
            │       - 建立 rendered capture diagnostics
            │
            ├── matchPage.js
            │   └── 比賽頁入口模組。
            │       職責：
            │       - 從 URL 取得 matchId
            │       - 初始化比賽工具列
            │       - 執行強化數據顯示流程
            │       - 檢查必要函式是否存在
            │       - 控制強化數據流程狀態
            │
            ├── matchParser.js
            │   └── 比賽資料解析輔助模組。
            │       職責：
            │       - 粗略解析 play-by-play HTML
            │       - 擷取 player links
            │       - 擷取 table summary
            │       - 擷取可能的 play-by-play text events
            │       - 找出官方 Box Score player rows
            │       - 用於 debug / probe
            │
            ├── matchPlayByPlayParser.js
            │   └── rendered play-by-play DOM rows 解析模組。
            │       職責：
            │       - 將 rendered DOM rows 轉成 match data rows
            │       - 解析 quarter
            │       - 解析 time
            │       - 解析 score
            │       - 解析 events
            │       - 解析 player
            │       - 解析 player_number
            │       - 解析 first_events / second_events / third_events / fourth_events
            │       - 解析 other_player
            │       - 解析 other_player_number
            │       - 建立 diagnostics
            │
            ├── matchRenderer.js
            │   └── 比賽探測結果渲染模組。
            │       目前主要用於 debug / probe。
            │       職責：
            │       - 建立探測結果 panel
            │       - 顯示 JSON summary
            │       - 隱藏過長 rawText / rawHtml 預覽
            │       - 複製完整探測結果到剪貼簿
            │
            ├── matchRows.js
            │   └── 預留檔案。
            │       目前為空。
            │       未來可放置：
            │       - 比賽 row 共用工具
            │       - 表格 row 處理
            │       - match row cache
            │
            ├── matchRules.js
            │   └── 比賽分析規則表。
            │       取代舊 Python 依賴 CSV 規則檔的做法。
            │       內建：
            │       - 投籃事件規則
            │       - 進攻籃板事件
            │       - 防守籃板事件
            │       - 傳球事件
            │       - 抄截事件
            │       - 犯規事件
            │       - 被犯規事件
            │       - 失誤事件
            │       - 團隊失誤事件
            │       - 封蓋事件
            │       - 被封蓋事件
            │       - 出手機會品質 mapping
            │
            ├── matchSupplementRenderer.js
            │   └── 比賽官方 Box Score 強化顯示模組。
            │       職責：
            │       - 尋找官方 Box Score 表格
            │       - 將 boxScoreRows 對應到官方球員列
            │       - 新增 DFGA / DTS% 欄位
            │       - 新增球員補充 detail row
            │       - 顯示位置時間
            │       - 顯示失分
            │       - 顯示 TS%
            │       - 顯示非官EFF
            │       - 顯示近距離 / 中距離拆分
            │       - 顯示籃板競爭
            │       - 渲染底部強化分析區
            │       - 掛載排序 dataset
            │       - 執行自訂排序
            │       - row pair 排序
            │       - 強化資料顯示 / 隱藏
            │
            └── matchToolbar.js
                └── 比賽頁工具列模組。
                    職責：
                    - 建立比賽頁工具列
                    - 強化數據顯示按鈕
                    - 隱藏 / 顯示強化資料
                    - 自訂排序欄位下拉選單
                    - 位置排序下拉選單
                    - 高到低排序按鈕
                    - 低到高排序按鈕
                    - 狀態文字更新
                    - 控制排序工具啟用 / 停用
```

---

## 四、模組分層說明

### 1. `src/content/content.js`

Content Script 主入口。

原則：

```text
只做頁面判斷與啟動
不放大量業務邏輯
不直接解析資料
不直接渲染表格
不直接抓取 HTML
```

目前流程：

```text
main()
├── 若為球員技能頁 / 學校頁
│   └── initTrainingHelperPage()
│
├── 若為比賽 description 頁
│   └── initMatchProbePage()
│
└── 其他頁面
    └── 不啟用功能
```

---

### 2. `src/content/core/`

共用核心層。

放置所有功能都可能共用的程式碼：

```text
網站常數
debug 工具
文字正規化
頁面判斷
background fetch client
```

---

### 3. `src/content/training/`

球員訓練輔助功能層。

負責：

```text
球員技能頁
籃球學校頁
球員表格解析
潛力素質列
訓練結果列
訓練總覽抓取與快取
球員名單匯出
工具列操作
```

---

### 4. `src/content/match/`

比賽數據強化功能層。

負責：

```text
比賽頁初始化
play-by-play 抓取
rendered DOM rows 擷取
play-by-play rows 解析
box score 分析
官方 Box Score 強化顯示
底部強化分析區
自訂排序
```

---

### 5. `src/background/background.js`

Background service worker。

負責統一處理 HTML 抓取：

```text
content script 發送 URL
background 檢查 URL
background fetch HTML
background retry
background 回傳 HTML
```

---

## 五、Manifest 載入順序

目前專案使用 Manifest V3 一般 content scripts，不是 ES Module。

因此：

```text
不使用 import
不使用 export
所有檔案依 manifest.json 順序載入
函式會存在同一個 content script execution environment
```

目前載入順序：

```text
1. src/vendor/html2canvas.min.js

2. core
   - constants.js
   - debug.js
   - utils.js
   - pageRouter.js
   - fetchClient.js

3. training
   - trainingConstants.js
   - trainingPlayerParser.js
   - trainingRows.js
   - trainingOverviewParser.js
   - trainingOverviewFetch.js
   - trainingExport.js
   - trainingToolbar.js
   - trainingPage.js

4. match
   - matchFetch.js
   - matchParser.js
   - matchToolbar.js
   - matchRules.js
   - matchPlayByPlayParser.js
   - matchAnalyzer.js
   - matchSupplementRenderer.js
   - matchPage.js

5. content.js
```

---

## 六、入口流程

## 1. Content Script 主入口

檔案：

```text
src/content/content.js
```

流程：

```text
main()
├── isSupportedTrainingPage()
│   └── initTrainingHelperPage()
│
├── isMatchDescriptionPage()
│   └── initMatchProbePage()
│
└── unsupported page
```

---

## 2. 球員訓練頁流程

```text
initTrainingHelperPage()
└── waitForTableAndInit()
    ├── findPlayerSkillTables()
    └── initPlayerTrainingPage(tables)
        ├── parsePlayersFromTables(tables)
        ├── addToolbar(firstTable, players)
        └── enhanceTable(table, tablePlayers)
```

使用者點擊：

```text
載入潛力 / 訓練資料
```

後：

```text
loadAllPlayersTrainingOverview(players)
├── getTrainingOverviewHtmlWithCache()
│   ├── chrome.storage.local 讀取快取
│   └── fetchHtmlByBackground(TRAINING_OVERVIEW_URL)
│
├── parseTrainingOverviewHtmlForPlayer(html, player.id)
└── fillExtraRow()
```

---

## 3. 球員匯出流程

使用者點擊：

```text
匯出圖片
```

後：

```text
exportPlayersTableImageByRange(range)
├── 判斷匯出範圍
├── 若為主要 / 出借
│   └── 找出對應 table container
│
├── 若為全部 / 自選
│   └── createTemporaryExportElementByRange()
│       ├── clone table
│       ├── 移除 checkbox
│       ├── 移除 helper-only hidden class
│       └── 組成臨時匯出 DOM
│
├── prepareElementForImageExport()
├── html2canvas()
├── downloadCanvasAsPng()
└── restore()
```

---

## 4. 比賽頁初始化流程

```text
initMatchProbePage()
├── getMatchIdFromCurrentUrl()
├── findOfficialBoxScorePlayerRows()
├── addMatchProbeToolbar()
└── setMatchProbeStatus()
```

---

## 5. 比賽強化數據流程

使用者點擊：

```text
強化數據顯示
```

後：

```text
runEnhancedStatsDisplay(matchId)
├── validateEnhancedStatsDependencies()
│
├── captureRenderedPlayByPlayPage(matchId)
│   ├── createHiddenPlayByPlayIframe()
│   ├── loadUrlIntoIframe()
│   ├── waitAfterLoadMs
│   ├── extractRenderedPlayByPlayDomRows()
│   └── buildRenderedPlayByPlayCaptureDiagnostics()
│
├── parseRenderedPlayByPlayDomRows(domRows)
│   ├── parseSinglePlayByPlayDomRow()
│   ├── extractLegacyEventName()
│   ├── extractLegacyChronologyInfo()
│   └── buildParsedDomRowsDiagnostics()
│
├── generateMatchBoxScore(rows)
│   ├── createInitialBoxScoreRows()
│   ├── analyzeAndUpdateBoxScoreRows()
│   │   ├── updateShotStats()
│   │   ├── updateDefenseShotStats()
│   │   ├── updatePointsAndLostPoints()
│   │   ├── updateReboundStats()
│   │   ├── updatePassAndTouchStats()
│   │   ├── updateSimpleCountingStats()
│   │   └── updateTeamTurnovers()
│   │
│   ├── calculatePlayTimeForBoxScoreRows()
│   ├── recordOpportunityEventsToBoxScoreRows()
│   └── buildBoxScoreDiagnostics()
│
└── renderMatchSupplementAnalysis(boxScoreRows)
    ├── normalizeSupplementBoxScoreRows()
    ├── createSupplementPlayerMap()
    ├── findOfficialBoxScoreTables()
    ├── enhanceOfficialBoxScoreTable()
    │   ├── appendSupplementHeaders()
    │   ├── matchOfficialTableRowToBoxScoreRow()
    │   ├── attachSupplementSortDataset()
    │   ├── appendSupplementDataCells()
    │   └── insertSupplementDetailRow()
    │
    └── renderBottomSupplementAnalysis()
```

---

## 七、比賽強化顯示架構

### 1. 官方 Box Score 主表

強化後會新增：

```text
DFGA
DTS%
```

這兩欄由 `matchSupplementRenderer.js` 插入。

相關函式：

```text
appendSupplementHeaders()
appendSupplementHeaderCells()
appendSupplementDataCells()
```

---

### 2. 球員補充 detail row

每位球員官方列後方會插入：

```html
<tr class="bp-match-supplement-detail-row">
```

補充內容依官方欄位垂直對齊：

```text
分鐘 → 位置時間
得分 → 失分
2% → 近距離 / 中距離二分拆分
1% → TS%
防守籃板 → 防守籃板競爭
進攻籃板 → 進攻籃板競爭
效率 → 非官EFF
```

相關函式：

```text
insertSupplementDetailRow()
buildSupplementDetailData()
createSupplementAlignedItem()
```

---

### 3. 官方欄位定位策略

比賽官方 Box Score 欄位定位優先使用：

```text
td[name="..."]
```

主要對應：

```text
td[name="minutes"]
td[name="points"]
td[name="two-pointers"]
td[name="free-throws"]
td[name="defensive-rebounds"]
td[name="offensive-rebounds"]
td[name="total-rebounds"]
td[name="ranking"]
td[name="plus-minus"]
```

相關函式：

```text
buildOfficialBoxScoreColumnMapByCellName()
```

---

### 4. 非官 EFF 對齊策略

非官 EFF 不使用表頭 index，也不使用 `+/-` 前一欄推算。

目前直接對齊：

```text
td[name="ranking"]
```

原因：

```text
官方表格可能有 rowspan
官方表格可能有 colspan
官方表格可能有雙層表頭
header index 容易偏移
```

---

### 5. 位置時間顯示策略

位置時間來源：

```text
pg_play_time
sg_play_time
sf_play_time
pf_play_time
c_play_time
```

顯示時只顯示有實際出場的位置。

例如：

```text
SF 18:35
SG 16:43 / SF 1:33
PF 7:10 / C 9:09
```

不顯示：

```text
PG 0:00 / SG 0:00 / SF 18:35 / PF 0:00 / C 0:00
```

相關函式：

```text
buildSupplementAllPositionText()
normalizeSupplementTimeText()
```

---

## 八、底部強化分析區

官方 Box Score 下方會新增：

```text
強化數據補充
```

目前包含三個分頁：

```text
出手機會品質
防守出手機會品質
傳球品質
```

相關函式：

```text
renderBottomSupplementAnalysis()
renderSupplementOpportunitySection()
renderSupplementOpportunityTable()
renderSupplementPassingSection()
renderSupplementPassingTable()
bindSupplementTabs()
```

---

## 九、自訂排序架構

### 1. 排序 UI

檔案：

```text
src/content/match/matchToolbar.js
```

建立：

```text
排序欄位 select
位置 select
高到低 button
低到高 button
```

排序控制在強化資料顯示後啟用。

相關函式：

```text
setMatchCustomSortControlsEnabled()
applyMatchCustomSortFromToolbar()
getMatchCustomSortLabel()
```

---

### 2. 可排序欄位

```text
總出場時間
各位置出場時間
得分
失分
TS%
防守籃板
防守籃板率
進攻籃板
進攻籃板率
總籃板
助攻
抄截
封蓋
效率
非官EFF
DFGA
DTS%
```

---

### 3. 排序資料來源

在強化官方球員列時，會把排序值掛到 row dataset。

相關函式：

```text
attachSupplementSortDataset()
```

主要 dataset：

```text
data-bp-sort-total-play-time
data-bp-sort-pg-play-time
data-bp-sort-sg-play-time
data-bp-sort-sf-play-time
data-bp-sort-pf-play-time
data-bp-sort-c-play-time
data-bp-sort-points
data-bp-sort-lost-points
data-bp-sort-ts-percent
data-bp-sort-defensive-rebounds
data-bp-sort-defensive-rebound-rate
data-bp-sort-offensive-rebounds
data-bp-sort-offensive-rebound-rate
data-bp-sort-total-rebounds
data-bp-sort-assists
data-bp-sort-steals
data-bp-sort-blocks
data-bp-sort-official-eff
data-bp-sort-non-official-eff
data-bp-sort-dfga
data-bp-sort-dts-percent
```

---

### 4. Row Pair 排序

強化後 DOM 結構：

```text
mainRow
detailRow
mainRow
detailRow
```

排序時會收集成：

```js
{
  mainRow,
  detailRow
}
```

排序後重新 append：

```text
tbody.appendChild(pair.mainRow)
tbody.appendChild(pair.detailRow)
```

確保：

```text
官方球員列與補充列不會分離
```

相關函式：

```text
collectSupplementRowPairs()
sortSingleMatchSupplementEnhancedTable()
sortMatchSupplementEnhancedTables()
```

---

### 5. 各位置時間排序

當 sortKey 為：

```text
positionPlayTime
```

會依使用者選擇的主要位置排序：

```text
PG
SG
SF
PF
C
```

並使用其他位置時間做次排序。

相關函式：

```text
getPositionSortValues()
```

---

## 十、Background Fetch 架構

由於 content script 直接 fetch 可能遇到權限或 CORS 限制，因此統一透過 background service worker 抓取 HTML。

流程：

```text
content script
└── fetchHtmlByBackground(url)
    └── chrome.runtime.sendMessage({
          type: "BP_FETCH_HTML",
          url
        })
        └── background.js
            ├── 檢查 URL 是否為 https://www.basketpulse.com/
            ├── fetch(url, { credentials: "include" })
            ├── 若遇到 502 / 503 / 504 則 retry
            └── 回傳 HTML
```

---

## 十一、資料隱私設計

BasketPulse Helper：

```text
不傳送資料到開發者伺服器
不傳送資料到第三方伺服器
只在使用者瀏覽器本機處理資料
```

唯一使用的瀏覽器儲存：

```text
chrome.storage.local
```

目前用途：

```text
暫存 Training overview HTML
```

---

## 十二、命名規則

### 1. 全域常數

```text
BP_*
TRAINING_*
EXPORT_*
```

### 2. Core 模組

```text
normalize*
fetch*
is*
bpDebug*
```

### 3. Training 模組

```text
training*
parsePlayers*
loadAllPlayers*
exportPlayers*
setStatusText*
```

### 4. Match 模組

```text
match*
renderMatch*
generateMatch*
calculateSupplement*
sortMatch*
captureRendered*
parseRendered*
```

---

## 十三、開發注意事項

### 1. 不使用 ES Module

目前 content script 不是 module。

因此：

```text
不要使用 import
不要使用 export
```

所有檔案依 manifest 載入後，函式會在相同 content script 執行環境中可見。

---

### 2. manifest 載入順序很重要

如果新增檔案，要確認：

```text
被依賴的檔案要排在前面
呼叫者要排在後面
content.js 永遠最後
```

---

### 3. 官方 DOM 可能變動

BasketPulse 若調整 DOM class、table 結構、欄位 name，可能影響：

```text
官方 box score 對應
play-by-play DOM 解析
訓練總覽解析
```

目前比賽 Box Score 對齊優先使用：

```text
td[name="..."]
```

比單純使用表頭 index 更穩定。

---

### 4. 比賽頁等待時間

目前完整載入 play-by-play 使用 hidden iframe，並等待固定時間：

```text
30000 ms
```

若未來要優化，可改為：

```text
觀察 DOM rows 數量穩定後再解析
MutationObserver
可設定等待秒數
```

---

### 5. 比賽數據不是官方數據

比賽強化數據來自插件根據 play-by-play 自行推算。

因此：

```text
可能與 BasketPulse 官方統計略有差異
應視為輔助分析資料
```

---

## 十四、後續可改善方向

### 1. 強化資料復原模式

目前「隱藏強化資料」主要使用 CSS 隱藏。

未來若要完全恢復官方排序，可改為：

```text
移除 detail rows
移除補充 headers
移除補充 cells
保留計算結果 cache
再次顯示時重新 render
```

---

### 2. 拆出 matchSupplementSorter.js

目前排序邏輯放在：

```text
matchSupplementRenderer.js
```

未來可拆為：

```text
matchSupplementSorter.js
```

讓 renderer 專注顯示，sorter 專注排序。

---

### 3. 拆出 matchSupplementStyles.css

目前比賽補充樣式由 JS 注入。

未來可改為：

```text
src/content/match/matchSupplement.css
```

但需要同步修改 manifest。

---

### 4. 優化 play-by-play 載入等待

目前固定等待 30 秒。

未來可改為：

```text
等待 DOM 出現
等待 row count 穩定
提供工具列設定
```

---

### 5. 加入測試資料

可新增：

```text
tests/
fixtures/
```

保存部分匿名 play-by-play rows，方便比對 analyzer 結果。

---

### 6. 改用建置工具

目前是原生 content script 依序載入。

未來若專案變大，可考慮：

```text
Vite
Rollup
Webpack
TypeScript
ES Module
```

但需要重新整理 manifest 與打包流程。

---

## 十五、版本 v0.2.0 重點

```text
v0.2.0
```

完成：

- 球員訓練功能維持穩定。
- 新增比賽頁強化數據顯示。
- 新增 play-by-play rendered DOM 擷取。
- 新增 match rows parser。
- 新增 box score analyzer。
- 新增 DFGA / DTS%。
- 新增失分。
- 新增 TS%。
- 新增非官EFF。
- 新增位置時間。
- 新增籃板競爭。
- 新增底部強化分析區。
- 新增自訂排序。
- 修正非官EFF 對齊官方效率欄。
- 優化位置時間顯示，只顯示有出場的位置。
- 補充專案架構文件。
- 補充第三方授權文件。
- 新增專案輸出給 AI 閱讀的輔助工具。
