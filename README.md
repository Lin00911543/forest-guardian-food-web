# 森林守護隊：食物網行動卡

Phaser 4 + TypeScript 的遊戲式學習 MVP。專案根目錄的 `index.html` 直接進入遊戲，沒有另外的網站首頁。

## 開始遊玩

需要 Node.js 20.19+（或 22.12+）。

```bash
pnpm install
pnpm dev
```

Vite 顯示網址後，使用瀏覽器開啟即可。建立正式靜態檔案可執行 `pnpm build`，輸出會放在 `dist/`。

## 線上遊玩

遊戲已設定 GitHub Pages。推送到 `main` 分支後，GitHub Actions 會自動建置並發布：

https://lin00911543.github.io/forest-guardian-food-web/

## MVP 內容

- 每局從七張保育行動卡選五張並安排順序，完成五回合。
- 事件順序固定；行動卡先改變目標物種，再由食物網規則推演連鎖變化。
- 完成策略 A 後可用相同起始族群和事件重玩策略 B。
- 並排比較兩次族群折線圖，選擇根據圖表和食物網關係的解釋。
- 兩次策略紀錄會保存在目前瀏覽器的 `localStorage`，可在重新載入後繼續或查看比較。

## 專案文件

- [`docs/game-proposal.md`](docs/game-proposal.md)：遊戲企劃與分階段計畫。
- [`docs/asset-sources.md`](docs/asset-sources.md)：素材來源、作者和授權。
- `.codex/skills/game-based-learning/SKILL.md`：本專案遊戲式學習設計 Skill。
