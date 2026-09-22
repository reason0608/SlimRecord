# 減脂紀錄儀表板

此網站是可部署到 GitHub Pages 的靜態 Next.js 網站。公開版只包含**示範資料**，不包含 Reason 或 Chloe 的真實健康紀錄。

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

## 本機資料

若要從 Google Sheets 匯出的 Excel 轉成 JSON，可在本機執行：

```bash
python scripts/export-fitness-data.py path/to/record.xlsx data/fitness-data.private.json
```

`fitness-data.private.json` 已被 Git 忽略。不要將真實資料覆蓋 `fitness-data.json` 後提交至公開 repository；GitHub Pages 網站即使來源 repository 為私人，頁面與前端資料仍可能公開存取。
