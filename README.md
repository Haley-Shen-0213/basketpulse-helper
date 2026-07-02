# BasketPulse Helper

BasketPulse Helper 是一個非官方 Chrome 擴充功能，用於改善 BasketPulse 球員技能頁的瀏覽與分享體驗。

它可以在球員技能頁中顯示來自訓練總覽的潛力素質與最新訓練結果，並支援將主要球員名單匯出成 PNG 圖片。

> 本工具不是 BasketPulse 官方工具，與 BasketPulse 官方無關。

---

## 功能

- 在球員技能頁加入「潛力素質」資料列
- 在球員技能頁加入「訓練結果」資料列
- 支援主要球員與出借球員
- 自動隱藏沒有資料的空白列
- 使用本機快取加快訓練總覽讀取速度
- 支援匯出主要球員名單為 PNG 圖片
- 不會將資料傳送到開發者或第三方伺服器

---

## 使用畫面

安裝後，進入 BasketPulse 的球員技能頁，頁面上方會出現 BasketPulse Helper 工具列。

工具列包含：

- 載入潛力 / 訓練資料
- 更新資料
- 匯出圖片
- 隱藏 / 顯示資料列

---

## 安裝方式：開發者模式安裝

目前本工具可透過 Chrome 開發者模式安裝。

### 1. 下載專案

請從 GitHub 下載本專案 ZIP，或使用 Git clone。

```bash
git clone https://github.com/YOUR_USERNAME/basketpulse-helper.git
```

### 2. 確認檔案結構

請確認資料夾內至少包含：

```text
basketpulse-helper/
├─ manifest.json
├─ src/
│  ├─ background/
│  │  └─ background.js
│  ├─ content/
│  │  ├─ content.js
│  │  └─ content.css
│  └─ vendor/
│     └─ html2canvas.min.js
```

### 3. 安裝到 Chrome

1. 開啟 Chrome
2. 前往：

```text
chrome://extensions/
```

3. 右上角開啟「開發人員模式」
4. 點選「載入未封裝項目」
5. 選擇本專案資料夾：

```text
basketpulse-helper/
```

6. 安裝完成

---

## 使用方式

### 1. 登入 BasketPulse

請先登入 BasketPulse。

### 2. 打開球員技能頁

前往：

```text
https://www.basketpulse.com/tw/Players/skills
```

### 3. 載入潛力 / 訓練資料

點選工具列中的：

```text
載入潛力 / 訓練資料
```

程式會讀取訓練總覽，並將資料顯示在球員技能表格中。

### 4. 更新資料

如果訓練資料已更新，請點選：

```text
更新資料
```

再重新點選：

```text
載入潛力 / 訓練資料
```

### 5. 匯出圖片

若要分享主要球員名單，可點選：

```text
匯出圖片
```

程式會將主要球員表格匯出為 PNG 圖片。

---

## 快取說明

BasketPulse Helper 會在瀏覽器本機使用 `chrome.storage.local` 暫存訓練總覽 HTML。

目的：

- 減少重複讀取訓練總覽
- 加快載入速度
- 降低網站伺服器負擔

目前快取時間約為 10 分鐘。

若要重新取得最新資料，請點選：

```text
更新資料
```

---

## 權限說明

本擴充功能使用以下權限：

### storage

用於在使用者瀏覽器本機儲存訓練總覽快取。

### host_permissions: https://www.basketpulse.com/*

用於在 BasketPulse 網站內讀取目前登入帳號可查看的球員技能頁與訓練總覽頁。

---

## 隱私權說明

BasketPulse Helper：

- 不會蒐集個人資料
- 不會傳送資料到開發者伺服器
- 不會傳送資料到第三方伺服器
- 只會在使用者瀏覽器本機處理頁面資料
- 只會在使用者本機暫存訓練總覽 HTML，以加快讀取速度

---

## 注意事項

- 本工具需要登入 BasketPulse 後使用
- 本工具只會讀取目前登入帳號可查看的資料
- 若 BasketPulse 網站結構更新，本工具可能需要同步更新
- 若 BasketPulse 伺服器暫時回應 502 / 503 / 504，請稍後再試
- 本工具不是 BasketPulse 官方工具

---

## 第三方套件

本工具使用：

- html2canvas

詳細授權資訊請見：

```text
THIRD_PARTY_LICENSES.txt
```

---

## 開發者

如果你想修改或協助改善本工具，歡迎 fork 專案並提交 Pull Request。

---

## License

本專案建議使用 MIT License。

若你要正式開源，請在專案根目錄新增 `LICENSE` 檔案。
