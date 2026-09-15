# 呼吸群島 · 討論樹

IxDA 黑客鬆用的**單檔網頁**：本機語音辨識 → 討論長成一棵樹。

## 最快怎麼開

1. 用 **Google Chrome（桌面版）** 打開 `index.html`（雙擊或拖進視窗）
2. 按「開始聽」，允許麥克風
3. 說話（繁中）；定稿句子會長成樹節點
4. 接上每組螢幕後按 `F` 全螢幕

本機路徑：

`/Users/cheyuwu/Projects/ixda-discussion-tree/index.html`

若 Chrome 擋本地檔麥克風，可在該資料夾開一個靜態伺服：

```bash
cd ~/Projects/ixda-discussion-tree && python3 -m http.server 8766
```

然後開 http://localhost:8766/

## 現場用法（16 組）

- 每組一台筆電開同一頁，接該組螢幕
- 「島名」改成小組主題（便利商店島、加班島…）
- 收音用筆電／手機麥克風即可
- 吵雜時：人靠近筆電、降低冷氣噪音、必要時一組輪流靠近講

## 快捷鍵

- `Space` 聽／停
- `F` 全螢幕
- `C` 清空（會確認）

## 限制（誠實）

- 依賴瀏覽器 Web Speech API → **Chrome 最穩**；離線品質視 OS／瀏覽器而定
- 不是 16 路專業同步錄音系統；每組各自開一頁互不連線
- 節點切詞是輕量規則，不是語意分群模型

## 之後可進化

- 匯出樹圖 PNG／JSON
- 接上 Taiwan.md 關鍵詞著色
- 可選雲端 STT 備援（吵雜場）
