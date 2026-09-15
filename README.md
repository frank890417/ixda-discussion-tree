# 呼吸群島 · 討論板（v2）

IxDA 黑客鬆用的**靜態網頁**：Chrome Web Speech（zh-TW）→ **規則凝結** → 主題簇 ideation board。  
不再把字詞隨機掛上樹；Tree 模式改為從 board 投影。

Repo：https://github.com/frank890417/ixda-discussion-tree  
Pages：https://frank890417.github.io/ixda-discussion-tree/

## 最快怎麼開

**建議（ES modules 需要 http）**

```bash
cd ~/Projects/ixda-discussion-tree && python3 -m http.server 8766
```

用 **Google Chrome（桌面版）** 開 http://localhost:8766/

或直接開 GitHub Pages（同樣需 Chrome）。

> 不要雙擊 `file://`：模組與麥克風都需要安全來源（https / localhost）。

## v2 行為（PR1a）

1. 按「開始聽」，允許麥克風；說話（繁中）
2. **只有 final（定稿）** 會進入凝結流水線：  
   `normalize → classifyKind → merge → cluster → localStorage → 重繪`
3. 預設畫面是 **Board**：主題簇欄＋ idea 卡片（kind 色標：主題／點子／結論／待決／問題）
4. **Tree** 可切換：從 board 投影（簇＝幹、idea＝枝），不再 tokenize 亂掛
5. 麥克風掛了 → 用底部**手動輸入**送出
6. **匯出／匯入 JSON**；重整頁面資料仍在（`localStorage` key：`breathing-islands:board:v1`）

### Kind 啟發式（無 LLM）

| Kind | 訊號 |
|------|------|
| question | `？`／嗎／怎麼／為什麼／如何… |
| conclusion | 應該／決定／就定／結論／定案… |
| open | 還沒／待決／不確定／之後再／再說… |
| theme | 主題是／我們在講… |
| idea | 其餘 |

相近句子會以字元 bigram 相似度合併（`score++`，保留較長文）。

## 現場用法

- 每組一台筆電開同一頁，接該組螢幕
- 「島名」改成小組主題（會寫入 board）
- Demo 可快速長出示範簇；清空會確認
- 快捷鍵：`Space` 聽／停 · `F` 全螢幕 · `C` 清空 · `B` Board · `T` Tree

## 架構（靜態可部署）

```
index.html              # shell + HUD
css/app.css
js/main.js
js/stt/adapter.js       # SttAdapter 介面
js/stt/web-speech.js    # WebSpeechAdapter
js/model/board.js       # Board CRUD + localStorage
js/condense/rules.js    # classify / merge / cluster
js/views/board-view.js
js/views/tree-view.js   # 從 board 投影
js/export.js
```

無需 build；GitHub Pages 相對路徑即可。之後可換雲端 STT：實作另一個 `SttAdapter` 即可。

## 驗證步驟

1. `python3 -m http.server 8766`，Chrome 開 localhost
2. 按 Demo 數次 → Board 出現簇與 kind 色標
3. 手動輸入「為什麼燈光這麼亮？」→ 應為 question
4. 再輸入相近句 → 應合併、score 增加
5. 重整頁面 → 資料仍在；匯出 JSON 再開匯入
6. 切 Tree → 看到由簇／idea 投影的樹
7.（可選）開始聽，確認 interim 只更新「正在聽」、final 才凝結

節點單元測試（無瀏覽器）：

```bash
node --input-type=module -e "
import { createEmptyBoard } from './js/model/board.js';
import { condenseFinal, classifyKind } from './js/condense/rules.js';
const b = createEmptyBoard('測試島');
condenseFinal(b, '今天主題是便利商店', { persist: false });
condenseFinal(b, '為什麼末班車總是讓人焦慮？', { persist: false });
condenseFinal(b, '我覺得應該決定加休息角', { persist: false });
console.log(JSON.stringify({ kinds: b.ideas.map(i=>i.kind), clusters: b.clusters.length, ideas: b.ideas.length }, null, 2));
console.log('q?', classifyKind('怎麼辦？'));
"
```

## 限制（誠實）

- Web Speech 依賴 Chrome＋網路；吵雜場請靠手動輸入／Demo
- 凝結是關鍵詞＋字元相似度，不是語意模型；誤分類之後可手動改 kind（PR2）
- PR1a **尚未**做完整語者分離 UI（模型已留 `speakerId` / `speakerSource`）
- 各組一頁互不連線

## PR 切片

- **PR1a（本分支）**：Board 凝結核心
- **PR1b**：語者標籤（手動 S1/S2/S3）
- 之後：拖曳換簇、PNG、房間同步、雲端 STT
