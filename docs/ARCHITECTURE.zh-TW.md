# BasketPulse Helper 架構說明

本文說明 BasketPulse Helper 目前的專案架構、檔案用途與模組分類。

---

## 一、專案總覽

BasketPulse Helper 是一個 Chrome 擴充功能，目前主要功能是輔助 BasketPulse 的球員技能頁與籃球學校頁。

目前主要支援：

- 球員技能頁
- 籃球學校頁
- 潛力素質顯示
- 訓練結果顯示
- 訓練總覽快取
- 球員名單 PNG 匯出
- 自選球員匯出
- 主要球員 / 出借球員分類匯出

未來預留：

- 比賽頁分析
- play-by-play 解析
- 比賽 box score 輔助數據

---

## 二、目前建議架構樹

```text
basketpulse-helper/
├── manifest.json
│   └── Chrome 擴充功能設定檔，定義 content scripts、權限與 background service worker。
│
├── README.md
│   └── 專案使用說明。
│
├── LICENSE
│   └── 專案授權文件。
│
├── THIRD_PARTY_LICENSES.txt
│   └── 第三方套件授權說明，目前主要記錄 html2canvas。
│
├── project_export_for_ai.py
│   └── 開發輔助工具，用於將專案樹與程式碼輸出給 AI 閱讀。
│
├── docs/
│   └── ARCHITECTURE.zh-TW.md
│       └── 專案架構中文說明文件。
│
├── assets/
│   └── 擴充功能圖示或 README 圖片資源。
│
└── src/
    ├── background/
    │   └── background.js
    │       └── Background service worker。負責代替 content script 抓取 BasketPulse HTML。
    │
    ├── vendor/
    │   └── html2canvas.min.js
    │       └── 第三方套件，用於將球員表格匯出成 PNG 圖片。
    │
    └── content/
        ├── content.js
        │   └── Content script 主入口。只負責判斷頁面並啟動對應功能。
        │
        ├── content.css
        │   └── Content script 樣式。包含工具列、資料列、自選球員、匯出圖片樣式。
        │
        ├── core/
        │   ├── constants.js
        │   │   └── 全專案共用常數，例如 BasketPulse 基礎網址。
        │   │
        │   ├── debug.js
        │   │   └── Debug 工具函式。
        │   │
        │   ├── utils.js
        │   │   └── 共用工具函式，例如文字正規化。
        │   │
        │   ├── pageRouter.js
        │   │   └── 頁面判斷工具，判斷目前是否為球員頁、學校頁或比賽頁。
        │   │
        │   ├── fetchClient.js
        │   │   └── 透過 background 抓取 HTML 的共用工具。
        │   │
        │   └── storageCache.js
        │       └── 預留快取模組，目前訓練總覽快取仍在 trainingOverviewFetch.js。
        │
        ├── training/
        │   ├── trainingConstants.js
        │   │   └── 球員訓練功能常數，包含技能欄位、快取 key、匯出範圍。
        │   │
        │   ├── trainingPage.js
        │   │   └── 球員訓練功能入口，負責等待表格、初始化頁面。
        │   │
        │   ├── trainingPlayerParser.js
        │   │   └── 從頁面表格解析球員資料，並判斷主要球員與出借球員。
        │   │
        │   ├── trainingToolbar.js
        │   │   └── 建立 BasketPulse Helper 工具列與處理工具列事件。
        │   │
        │   ├── trainingRows.js
        │   │   └── 建立與更新潛力素質列、訓練結果列。
        │   │
        │   ├── trainingOverviewFetch.js
        │   │   └── 抓取訓練總覽 HTML、處理快取、批次載入球員訓練資料。
        │   │
        │   ├── trainingOverviewParser.js
        │   │   └── 解析訓練總覽 HTML，取得潛力與訓練結果。
        │   │
        │   └── trainingExport.js
        │       └── 處理球員名單匯出圖片、自選球員、匯出範圍。
        │
        └── match/
            ├── matchAnalyzer.js
            │   └── 預留：比賽分析主流程。
            │
            ├── matchFetch.js
            │   └── 預留：比賽 play-by-play HTML 抓取。
            │
            ├── matchPage.js
            │   └── 預留：比賽頁初始化。
            │
            ├── matchParser.js
            │   └── 預留：比賽事件解析。
            │
            ├── matchRenderer.js
            │   └── 預留：比賽分析結果渲染。
            │
            ├── matchRows.js
            │   └── 預留：比賽數據列或表格處理。
            │
            ├── matchRules.js
            │   └── 預留：比賽規則、事件判斷、統計規則。
            │
            └── matchToolbar.js
                └── 預留：比賽頁工具列。
```

---

## 三、模組分層說明

### 1. `src/content/content.js`

這是 content script 主入口。

原則：

- 不放大量業務邏輯
- 不直接解析球員
- 不直接抓 HTML
- 不直接渲染表格

只做：

```text
判斷頁面 → 啟動對應模組
```

---

### 2. `src/content/core/`

這裡放所有功能都可能共用的程式碼。

例如：

- 網站基礎網址
- Debug 工具
- 字串工具
- 頁面判斷
- background fetch client

未來比賽功能也會使用這裡的工具。

---

### 3. `src/content/training/`

這裡放「球員相關插件」的所有核心功能。

包含：

- 球員技能頁
- 籃球學校頁
- 球員表格解析
- 潛力素質
- 訓練結果
- 訓練總覽快取
- 工具列
- 匯出圖片

---

### 4. `src/content/match/`

這裡是未來比賽相關功能。

目前先保留空檔，暫時不載入或不啟用實作也可以。

未來預計功能：

- 比賽頁初始化
- 抓取 play-by-play
- 解析比賽事件
- 分析球員上場時間
- 計算進階數據
- 渲染分析結果

---

### 5. `src/background/background.js`

Background service worker。

目前主要負責：

```text
content script 發送 URL
background fetch HTML
回傳 HTML 給 content script
```

這樣可以統一處理：

- Cookie 登入狀態
- BasketPulse host permission
- 502 / 503 / 504 retry
- future match fetch

---

## 四、目前拆分策略

目前原本的 `src/content/content.js` 已經太大，包含：

- 頁面判斷
- 球員解析
- toolbar
- row 渲染
- 訓練總覽 fetch
- 訓練總覽 parser
- 匯出圖片

因此拆分目標是：

```text
content.js 保持極小
core/ 放共用工具
training/ 放球員插件
match/ 留給未來比賽功能
```

---

## 五、Manifest 載入順序原則

因為目前使用一般 content script，不是 ES Module，所以檔案順序很重要。

建議順序：

```text
1. vendor/html2canvas.min.js
2. core constants/debug/utils/pageRouter/fetchClient
3. training constants
4. training parser / rows / overview parser / overview fetch / export / toolbar / page
5. content.js
```

原因：

```text
content.js 依賴 trainingPage.js
trainingPage.js 依賴 parser、toolbar、rows
toolbar 依賴 overviewFetch、export
overviewFetch 依賴 overviewParser、rows、fetchClient
overviewParser 依賴 constants、utils
export 依賴 constants、page、rows
```

---

## 六、命名規則

### 共用核心

```text
core/
```

用於多功能共用邏輯。

### 球員訓練

```text
training/
```

用於球員技能頁、學校頁、訓練總覽、潛力與訓練結果。

### 比賽分析

```text
match/
```

用於未來比賽頁、play-by-play、box score 分析。

---

## 七、後續開發順序建議

建議開發順序：

```text
1. 完成球員功能拆檔
2. 確認既有功能完全正常
3. 再開始比賽功能
4. 比賽功能先做 fetch + parser
5. 再做 analyzer
6. 最後做 renderer / toolbar
```

---

## 八、目前球員功能拆分對照

```text
content.js
└── 主入口

core/debug.js
└── BP_HELPER_DEBUG, bpDebugLog, bpDebugTable

core/constants.js
└── BP_BASE_URL

core/utils.js
└── normalizeText, normalizePercentValue

core/pageRouter.js
└── isSupportedTrainingPage, isSkillsPage, isSchoolMainPage

core/fetchClient.js
└── fetchHtmlByBackground

training/trainingConstants.js
└── TRAINING_OVERVIEW_URL, SKILL_COLUMNS, SKILL_LABELS, EXPORT_RANGE_*

training/trainingPage.js
└── waitForTableAndInit, findPlayerSkillTables, initTrainingHelperPage

training/trainingPlayerParser.js
└── parsePlayersFromTables, parsePlayersFromOneTable, hasLoanPlayersSection

training/trainingToolbar.js
└── addToolbar, setStatusText, setButtonBusy

training/trainingRows.js
└── enhanceTable, createExtraRow, fillExtraRow, clearExtraRow

training/trainingOverviewFetch.js
└── getTrainingOverviewHtmlWithCache, loadAllPlayersTrainingOverview

training/trainingOverviewParser.js
└── parseTrainingOverviewHtmlForPlayer

training/trainingExport.js
└── exportPlayersTableImageByRange, createTemporaryExportElementByRange
```

---

## 九、注意事項

目前使用 Manifest V3 content scripts 的一般載入方式，不是 ES module。

因此：

- 不使用 `import`
- 不使用 `export`
- 所有函式會在 content script 的同一個執行環境中依序載入
- manifest 中的 JS 順序非常重要

若未來要改為打包工具，例如 Vite / Webpack / Rollup，才建議改成 ES module。
