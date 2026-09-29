# 生產環境問題排查紀錄

紀錄這次上線 Vercel 後遇到的所有問題、根本原因與對應修法，方便日後回顧或遇到類似狀況時查閱。

---

## 一、部署階段的建置失敗（一次性，已解決）

把專案搬上 Vercel 過程中的環境設定問題，跟後面的資料庫連線問題無關。

| 問題 | 原因 | 修法 |
|---|---|---|
| `Function Runtimes must have a valid version` | `vercel.json` 裡寫了無效的 `runtime: "@vercel/node@5"` | 移除該欄位，改用 Vercel 預設值 |
| TypeScript 建置錯誤 | `seed.ts`、`charges.ts` 型別不合 | 補上 `as const`、修正欄位命名 |
| `No Output Directory named "public"` | api 專案是純 function，沒有靜態輸出目錄 | 新增 `api/public/index.html` 佔位頁 + `vercel.json` 設定 `outputDirectory` |
| `ERR_MODULE_NOT_FOUND`（相對路徑） | Node 原生 ESM 要求 import 路徑要帶副檔名 | 全專案相對 import 補上 `.js` |
| `ERR_MODULE_NOT_FOUND`（`@family-ledger/shared`） | shared 套件沒有建置步驟，指向的是原始 `.ts` | 幫 shared 補上 `tsc` 建置步驟，`package.json` 指向 `dist/` |
| API function 卡滿 60 秒逾時 | `api/api/[...route].ts` 用 `export default`，Vercel 誤判成舊版 `(req,res)=>void` 簽章 | 改成 `export const fetch = handle(app)`（Web 標準 Request/Response 簽章） |
| 多層路徑路由（如 `/api/auth/login`）404 | 檔名慣例不夠，Vercel 沒有正確導向 catch-all function | 在 `api/vercel.json` 明確加 `rewrites` |
| 前端「上一頁」卡住、出現 Vercel 自己的 404 頁 | Vue Router history 模式需要伺服器端 fallback 到 `index.html`，Vercel 靜態網站預設不會 | 在 `vue3/vercel.json` 加 SPA fallback `rewrites` |

---

## 二、登入「帳號或密碼錯誤」（非 bug）

本機 `.env` 裡 `SEED_ADMIN_PASSWORD` 的值跟實際在用的密碼不一致，屬於環境設定落差，不是程式問題。

---

## 三、資料庫連線問題排查（這幾天的核心，過程曲折）

這是真正花最多時間的部分。症狀一路是：登入後畫面抓不到資料、API 間歇性卡住甚至到 60 秒逾時、`categories`／`dashboard`／`subscriptions` 等頁面時好時壞。中間走了三輪修正，前兩輪方向合理但沒打中真正的根因，第三輪才找到問題本體。

### 背景設定

- Vercel serverless function：每個 instance 理論上處理一個請求後可能被「凍結」，之後可能重複使用（warm）或直接銷毀
- 資料庫走 Supabase **Supavisor transaction pooler**（連接埠 6543）：這個模式是設計給「短生命週期連線」用的，不是給長駐連線用的
- 原始設定：每個 instance 的連線池 `max: 1`（一個 instance 只開一條連線），連線會在 warm instance 之間重複使用以省下重新建立連線的時間

### 第一輪修正：偵測連線疑似斷線就強制換新連線＋逾時保護

**假設**：warm instance 之間重複使用同一條連線，若連線在兩次呼叫之間悄悄斷線，下一次查詢會卡住直到 Vercel 60 秒硬上限才失敗。

**修法**：
- `api/src/db/index.ts` 用 Proxy 包一層 `sql`/`db`，讓底層連線可以被抽換而不用改任何 route 檔案的 import
- `api/src/app.ts` 加上應用層逾時中介層（原設 8 秒），請求卡太久就判定連線已死、呼叫 `resetConnection()`、快速回 503
- `vue3/src/api/client.ts` 加上「遇到 503 自動重試一次」邏輯

**結果**：只解決了一部分症狀，且意外製造了新問題（見下）。

### 第二輪修正：逾時門檻設定錯誤、強殺連線波及其他查詢

透過實際看 Vercel function log 才發現兩個具體 bug：

1. **逾時門檻比連線自身允許的握手時間還短**：應用層逾時設 8 秒，但 postgres.js 的 `connect_timeout` 允許連線握手花到 10 秒。也就是說一條「正常但握手較慢」的冷連線，會在真正建立完成前就被我們自己誤判成「連線已死」，強制重置並回 503。→ 調整為 15 秒。

2. **強制關閉舊連線時波及仍在使用該連線的查詢**：`resetConnection()` 原本用 `dying.end({ timeout: 1 })`，1 秒後不管三七二十一強制把舊連線砸斷（`terminate`）。如果那條連線上還有查詢正在跑（不管是同個請求自己的、還是同一 instance 上並發的其他請求），被砸斷的查詢會直接丟出 `CONNECTION_DESTROYED` 錯誤——這個錯誤沒有被歸類成「已知的連線問題」，於是被當成一般未預期錯誤回了 **500**，而不是我們設計中的 503。這是實際在 Vercel log 裡看到 `write CONNECTION_DESTROYED` 才確認的。→ 改成優雅關閉（不設強制 timeout），並在 `app.onError` 補上：只要是連線類錯誤（`CONNECTION_DESTROYED`／`CONNECTION_CLOSED`／`CONNECTION_ENDED`）一律轉成乾淨的 503，讓前端既有的自動重試邏輯接手。

**結果**：500 錯誤消失了，但間歇性卡 15 秒逾時的狀況仍然存在——代表連線新舊、強不強殺都不是真正的根因。

### 第三輪修正：serverless 凍結期間連線靜默斷線的理論，仍未命中根因

**假設**：Vercel 在兩次請求之間會把整個 process 凍結，凍結期間所有計時器都不會動；如果凍結期間網路路徑把連線悄悄斷開（沒有任何一方在監聽，收不到 FIN/RST），process 解凍後這條連線在程式眼中仍是「活著」的，直到真的送出查詢才發現對方沒反應，而且可能永遠等不到明確錯誤，只會無限卡住。`idle_timeout`／`max_lifetime` 這類計時器在凍結期間根本沒有在走，所以完全防不住這個情境。

**修法**：serverless 環境下，每個 HTTP 請求一開始就強制呼叫 `resetConnection()`，換一條保證沒有跨越過凍結期間的全新連線，不再嘗試沿用舊連線。

**結果**：問題依然存在——連新建立的連線也一樣卡整整 15 秒逾時。這證明前三輪的方向（連線新舊、強殺與否、要不要跨請求沿用）全都是錯的，問題根本不在連線本身。

### 真正的根因（第四輪，確認為止）

實際比對「哪些頁面會卡」跟「哪些頁面完全正常」：`categories`、`dashboard`、`stats`、`year`（年度彙總）、`budgets`、`transactions` 會間歇性卡死；單純查一筆資料的端點（如 `/me`）完全沒事。翻程式碼發現這些會卡的地方全部都用了同一種寫法：

```ts
// api/src/services/categories.ts
const [mains, subs] = await Promise.all([
  db.select().from(mainCategories)...,
  db.select().from(subCategories)...,
]);
```

用 `Promise.all` 同時對資料庫發出**兩支（以上）查詢**。而我們的連線池設定是 `max: 1`（一個 instance 只有一條實體連線），這些平行查詢只能擠在同一條連線上用 pipelining（不等前一支查詢回應就送出下一支）的方式送出。**Supavisor 的 transaction 模式並不保證能正確處理同一條連線上的平行查詢**——它是以「一個 transaction 對應一個後端連線」為單位設計的，pipelining 送出的第二支查詢在池化路由層可能就此石沉大海，永遠等不到回應，一路卡到我們自己設的逾時（15 秒）才失敗。

這才是這幾天「間歇性卡住」的真正原因：**跟連線新不新、有沒有斷線完全無關**，是連線數（`max: 1`）跟程式碼裡平行查詢寫法互相衝突。之所以「間歇性」，是因為只有剛好撞上 `Promise.all` 平行送出、且平行查詢數 > 1 的請求才會踩到，單一查詢的端點永遠不會有事。

**修法**：把 serverless 環境下的連線池上限從 `max: 1` 提高到 `max: 5`，讓平行查詢各自拿到自己的實體連線，不用再擠在同一條連線上搶著 pipelining。

**驗證狀態**：已推送部署，尚待實際重新測試確認。

---

## 四、經驗總結

1. **前三輪修正沒有錯，只是方向不對**：連線可能真的會在凍結期間悄悄斷線、強殺連線也真的會波及其他查詢，這些都是實際存在、值得修的問題，只是不是這次「間歇性卡死」的主因。這也是為什麼每次修完都短暫看起來有效、實際測試又復發。
2. **看實際的伺服器端 log（Vercel Function Logs）是轉折點**：光看前端 DevTools 只能看到「卡住、503、500」，看不到卡在哪一步；直到看到 Function log 裡完整的錯誤堆疊（`write CONNECTION_DESTROYED`），才第一次抓到具體、可驗證的證據，而不是靠猜測。
3. **`max: 1` 這個連線池設定，從一開始的假設就沒考慮到程式碼裡有平行查詢**：這個設定本身的立意（每個 instance 交給 Supavisor 池化，不需要 local pool）沒錯，但沒有考慮到 service 層普遍用 `Promise.all` 平行查詢的既有寫法，兩者一起用就會踩到 transaction pooler 的限制。
