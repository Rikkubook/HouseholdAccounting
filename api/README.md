# 家庭記帳 App — 後端（Hono + Supabase）

前端 `vue3/` 的 API 契約即此後端的路由契約，端點與參數皆沿用 `vue3/src/api/*.ts`，前端零改動。
架構決策見 `specs/12-後端架構.md`，表結構見 `specs/13-資料庫Schema.md`。

## 啟動

```bash
pnpm install                # 於專案根目錄
cp api/.env.example api/.env
# 填入 Supabase 連線字串與 JWT_SECRET（openssl rand -base64 48）

pnpm db:push                # 建表（執行 api/sql/0000_init.sql）
pnpm db:seed                # 灌入與 mocks/data.ts 相同的範例資料
pnpm dev                    # http://localhost:8787/api（本機走 src/index.ts 長駐）
                            # API 文件：http://localhost:8787/api/docs
# 另開一個終端機跑前端：pnpm dev:real（見 vue3/README.md）
```

seed 後以 `dad`（管理者）或 `sis`（一般成員）登入，密碼為 `SEED_ADMIN_PASSWORD`（本機預設 `1234`）。

## 部署（Vercel）

API 以 serverless function 形式部署，進入點 `api/api/[[...route]].ts`（catch-all，路徑維持 `/api/*`）。

1. Vercel 新增 Project，**Root Directory 設為 `api`**，Framework Preset 選 Other。
2. 環境變數（Production 與 Preview 都要設）：

   | 變數 | 值 |
   |---|---|
   | `DATABASE_URL` | Supabase **Transaction pooler**（連接埠 **6543**），不可用 5432 直連 |
   | `JWT_SECRET` | `openssl rand -base64 48` |
   | `CORS_ORIGIN` | 前端 Vercel 網址，逗號分隔可多組 |
   | `SEED_ADMIN_PASSWORD` | `openssl rand -base64 12`，登入後於 App 內更換 |
   | `CRON_SECRET` | `openssl rand -hex 16`，兩支 Cron 端點共用的憑證 |
   | `SUPABASE_URL` | Supabase Project Settings → API 的 Project URL（備份用） |
   | `SUPABASE_SERVICE_KEY` | 同頁的 `service_role` key（備份用，勿外流） |
   | `BACKUP_BUCKET` | 預設 `ledger-backups`，需先在 Storage 手動建立且保持 **private** |

3. 建表與灌資料在**本機**跑（seed 會 truncate，不放進部署流程）：
   ```bash
   pnpm db:push && pnpm db:seed
   ```
4. 前端 `VITE_API_BASE` 指向 `https://<api-project>.vercel.app/api`。

### serverless 的三個約束

- **連線池 `max: 1`**（`src/db/index.ts` 依 `process.env.VERCEL` 自動切換），真正的池化交給 Supavisor。
- **`prepare: false`** 是 Supavisor transaction mode 的硬性要求，不可拿掉。
- **沒有常駐排程**，故訂閱自動扣款走 Vercel Cron（見下節），不可用 `setInterval`。

## 訂閱自動扣款（Vercel Cron）

`vercel.json` 宣告每日 02:00（台北）觸發 `GET /api/cron/run-due-charges`：

```json
"crons": [{ "path": "/api/cron/run-due-charges", "schedule": "0 18 * * *" }]
```

> schedule 是 **UTC**。`0 18` = 台北隔日 02:00。

- 端點掃出「`next_charge_date <= 今天` 且啟用」的訂閱，逐筆產生交易並推進下次扣款日。
- **憑證**：Vercel 自動帶 `Authorization: Bearer $CRON_SECRET`，須在環境變數設 `CRON_SECRET`（`openssl rand -hex 16`）。**未設定時端點一律回 403**，不會裸奔。
- **冪等**靠 `transactions_subscription_period_idx`（`source_subscription_id, date` 的 partial unique index）：同一期重複觸發會被 `onConflictDoNothing` 吞掉，不會扣兩次。手動 `mark-paid` 與 Cron 共用 `services/charges.ts` 的同一條路徑，兩套邏輯不會漂移。
- 一筆訂閱若積欠多期，每次執行只補最舊一期，由每日 Cron 逐日追上，避免單次執行撞 function 時限。
- 自動產生的金額取訂閱設定值；實際扣款金額不同時，到交易列表改那一筆即可。

本機測試：

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:8787/api/cron/run-due-charges
```

## API 文件（Swagger）

```
GET /api/docs           Swagger UI
GET /api/openapi.json   OpenAPI 3.0 文件本體
```

不需登入即可瀏覽（只描述形狀，不含資料）。要在 UI 裡實際試打：先展開 `POST /auth/login` 拿 token，再按右上 **Authorize** 貼上，之後所有請求會自動帶 `Authorization` header（`persistAuthorization` 已開，重新整理不會掉）。

`src/docs/openapi.ts` 的兩個區塊性質不同：

- **components.schemas** 由 `shared/schema.ts` 的 Zod 定義用 `zod-to-json-schema` 轉出——欄位與驗證規則不會與實作漂移。回應中 TS interface 定義的形狀（`DashboardPayload`、`StatsPayload`、`YearSummaryPayload` 等）為手寫。
- **paths** 全部手寫，**新增或改動路由時要同步這份**。刻意不改用 `@hono/zod-openapi`：那需要把 8 個路由檔全部改寫成 `createRoute()`，風險大於維護一份 paths 表。

## 備份（Vercel Cron）

Supabase 免費方案不含 PITR——硬體故障有多副本保護，但**誤刪、程式寫壞、`db:seed` 誤觸 truncate 都無法還原到時間點**。故每週日 02:30（台北）觸發 `GET /api/cron/backup`，把全庫匯成單一 JSON 上傳到 Supabase Storage 私有 bucket。

```json
"crons": [{ "path": "/api/cron/backup", "schedule": "30 18 * * 0" }]
```

- 路徑 `backups/<年>/<YYYY-MM-DD>.json`，同日重跑以 `x-upsert` 覆蓋，不累積垃圾檔。
- 匯出順序即還原順序（被參照的表在前），還原時不會撞外鍵。
- **含 `password_hash` 與 `reset_code`**——完整還原才登得進去，因此 bucket **務必 private**。
- 未設 `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` 時只回傳各表列數不上傳，可用於本機驗證匯出內容：

  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:8787/api/cron/backup
  ```

- 不用 `pg_dump`：serverless 環境沒有該執行檔，且兩人家庭的資料量整庫塞進 JSON 遠低於記憶體上限。
- **還原目前沒有自動化端點**，需手動把 JSON 依表順序灌回。真的要用到時告知，我補一支 CLI script。

> Vercel Hobby 方案的 Cron 有數量與頻率限制（每日各一次級別）。目前兩支排程分別為每日與每週，在額度內。

## 前端接上

前端以 `pnpm dev:real` 啟動即會載入 `vue3/.env.real`（`VITE_USE_MOCK=false`），
`/api` 由 vite proxy 轉到 `localhost:8787`。詳見 `vue3/README.md`。

`client.ts` 不需修改——token 存 localStorage、401 導回登入頁的機制照用。

## 目錄

```
shared/                     唯一契約來源（前後端共用）
  schema.ts                 Zod schema，業務規則編碼於此
  types.ts                  z.infer 匯出，等價 vue3/src/types/models.ts

api/
  api/[[...route]].ts       Vercel serverless 進入點（@hono/vercel）
  vercel.json               function runtime 與 build 設定
  sql/0000_init.sql         權威 DDL：表、check 約束、partial index、RLS
  src/
    app.ts                  組裝 Hono app（本機與 Vercel 共用）
    index.ts                本機長駐入口（@hono/node-server）
    env.ts                  環境變數以 Zod 驗證，缺漏直接結束程序
    db/schema.ts            Drizzle 表定義＝查詢的型別表面；命名轉換只在此
    db/push.ts, seed.ts     建表與灌測資
    lib/                    auth（argon2 + JWT）、dates（月份字串運算）、errors
    middleware/auth.ts      requireAuth / requireAdmin
    routes/                 一檔一資源，對齊 vue3/src/api/*.ts
    routes/cron.ts          Vercel Cron 端點，驗 CRON_SECRET 而非成員 JWT
    routes/docs.ts          Swagger UI 與 openapi.json
    docs/openapi.ts         OpenAPI 文件：schemas 由 Zod 轉出，paths 手寫
    services/               彙總計算：dashboard、stats、year、fixed、views
    services/charges.ts     訂閱扣款：手動 mark-paid 與 Cron 共用
    services/backup.ts      全庫 JSON 快照 → Supabase Storage
```

## 兩處真相分工

`sql/0000_init.sql` 是資料庫的權威 DDL（check 約束、partial index、RLS 無法在 Drizzle 完整表達）；
`db/schema.ts` 是查詢的型別表面。改欄位要同時改兩處——換得的是不必信任 ORM 產生的 migration。
`drizzle-kit` 僅供 studio 與漂移檢查，不用它產 migration。

## 與 spec 的三處修正

實作時對照前端契約，修正了 `specs/12` 初稿的判斷：

1. **重設碼明文存放**，不雜湊。成員管理頁需顯示待處理代碼給管理者轉達（`Member.resetCode`），雜湊後無法還原。風險以「一次性、僅管理者可讀、用畢即清空」控制。
2. **重設碼不設期限**（`specs/02` 規則 1），故無 `reset_code_expires_at` 欄位。
3. **彙總端點在 `/api/summary/*`**，不是 `/api/dashboard`；沿用前端 `summaryApi` 的既有路徑。

另新增登入鎖定所需的 `failed_attempts` / `locked_until` 欄位（`specs/01` 規則 4，初稿漏列）。

## 認證要點

- 密碼 argon2id，`password_hash` 永不出現在任何回應。新成員 `password_hash` 為 null，須先憑初始代碼於重設密碼頁自設。
- JWT `exp` 錨定 `first_login_at` + 6 個月，之後登入不續期。**若錨點已逾期則重新錨定為現在**——否則帳號會在 6 個月後永久登不進來，這是 spec 未涵蓋的邊界。
- 帳號不存在時仍執行一次雜湊比對，避免以回應時間探測帳號。
- 授權在 Hono middleware；RLS 全表 deny-all，僅作金鑰外流的最後防線。

## 尚未實作

- 還原用的 CLI script（目前只有備份，沒有自動還原）。
- Hono RPC client 匯出：`AppType` 已從 `src/index.ts` 匯出，前端要改用 `hc<AppType>()` 時可直接接。
