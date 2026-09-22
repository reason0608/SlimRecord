# 減脂紀錄儀表板

此網站是可部署到 GitHub Pages 的靜態 Next.js 網站。公開版只包含**示範資料**；登入 Google 後，瀏覽器會以唯讀權限即時讀取私人試算表，真實健康紀錄不會打包進公開網站。

## 本機執行

在 `web` 目錄執行：

```bash
npm ci
npm test
npm run dev
```

`npm test` 會檢查公開資料仍標記為示範資料，避免不小心把真實紀錄一起部署。

## 部署到 GitHub Pages

Repository 根目錄的 `.github/workflows/deploy-pages.yml` 會在推送到 `main` 時執行測試、靜態建置及部署。到 repository 的 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**，然後到 **Actions** 檢查 `Deploy static site to GitHub Pages` 的執行結果。

網站網址通常是 `https://reason0608.github.io/SlimRecord/`。

## 連接 Google 試算表

網站讀取固定試算表 `1CNn3qJeZ90h61oi9OlPiZxGvGPcl3pND_CKGjX7kHHE` 的 `DailyLogs`、`FoodLogs`、`ExerciseLogs`、`Goals` 四個工作表。第一列欄位名稱須維持目前標準格式。試算表可維持私人狀態；登入者必須本來就有該試算表的存取權。

1. 在 [Google Cloud Console](https://console.cloud.google.com/) 建立或選擇專案，啟用 **Google Sheets API**。
2. 到 **Google Auth Platform** 設定 Branding / Audience / Data Access。若選 External 且維持 Testing，將實際使用的 Google 帳號加入 Test users；授權範圍加入 `https://www.googleapis.com/auth/spreadsheets.readonly`。
3. 建立 **OAuth client ID → Web application**。Authorized JavaScript origins 加入 `https://reason0608.github.io` 及本機測試用 `http://localhost:3000`。不要填入 `/SlimRecord` 路徑，也不需要 client secret。
4. 到 GitHub repository 的 **Settings → Secrets and variables → Actions → Variables**，新增 `GOOGLE_OAUTH_CLIENT_ID`，值為剛取得的 Client ID（不是 Client Secret）。
5. 重新執行 Pages workflow 或推送新 commit。打開網站後點「連線 Google 試算表」，以有權限的 Google 帳號授權。

本機測試可在 `web/.env.local` 設定 `NEXT_PUBLIC_GOOGLE_CLIENT_ID=你的ClientID`，再重新啟動 `npm run dev`。`.env.local` 不應提交。OAuth access token 只在瀏覽器記憶體中使用，不會寫進 localStorage 或 GitHub。每次重開頁面需要重新連線。

## 本機資料

若要從 Google Sheets 匯出的 Excel 轉成 JSON，可在本機執行：

```bash
python scripts/export-fitness-data.py path/to/record.xlsx data/fitness-data.private.json
```

`fitness-data.private.json` 已被 Git 忽略。不要將真實資料覆蓋 `fitness-data.json` 後提交至公開 repository；GitHub Pages 網站即使來源 repository 為私人，頁面與前端資料仍可能公開存取。
