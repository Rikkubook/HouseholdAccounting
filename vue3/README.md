# 家庭帳 · Vue 3 前端

Vue 3 + TypeScript + Tailwind + Pinia + Vue Router。後端為 Node（camelCase JSON）。

## 啟動

\`\`\`bash
npm install
npm run dev     # 預設 VITE_USE_MOCK=true，走內建假後端
npm run build
\`\`\`

Demo 帳密：\`dad / 1234\`（管理者）、\`sis / 1234\`（一般成員）。
重設密碼頁可用 \`mom / 980901\`。

## Storybook

```bash
npm run storybook          # http://localhost:6006
npm run build-storybook
```

25 支元件 stories（Base 21 + Data 4）＋ Design Tokens 專頁。
內建手機 390／桌機 1280 兩個 viewport（對應全站唯一斷點 768px）與 a11y 檢查。
Storybook 沿用同一份 `tokens.css` 與 Tailwind 設定，`<RouterLink>` 在 preview 裡以 `<a>` 取代。

## 接真後端

把 \`.env.production\` 的 \`VITE_USE_MOCK\` 設為 \`false\`、\`VITE_API_BASE\` 指向後端即可，
不需改動任何 store 或畫面 —— \`src/api/*\` 的路由與回傳形狀就是契約。

## 環境變數

| 檔案 | 指令 | VITE_USE_MOCK | 用途 |
|---|---|---|---|
| `.env.development` | `pnpm dev:web` | `true` | 假後端，不需啟動 API 即可開發畫面 |
| `.env.real` | `pnpm dev:real` | `false` | 接本機 API，`/api` 經 vite proxy 轉 8787 |
| `.env.production` | `vite build` | `false` | 部署用，`VITE_API_BASE` 需填 API 網址 |

`VITE_API_BASE` 預設 `/api`（相對路徑，靠 proxy 或同源）。跨網域部署時填完整網址。

## 資料流

```
view ──► store（Pinia）──► api/*.ts（契約層）──► axios client ──► 後端
                                                     └─ mock 模式下由 src/mocks 攔截
```

- **`api/*.ts` 是契約層**：只做路徑與型別，不含業務邏輯。與 `api/src/routes/*` 逐一對應。
- **store 持有狀態與載入旗標**，view 不直接呼叫 `api/*`。
- **`client.ts`** 統一處理 token（localStorage）、401 導回登入頁、錯誤正規化成 `{ code, message }`。
- 切換真假後端只動 `client.ts` 的 adapter，store 與 view 零改動。

## 權限與路由

`router/index.ts` 以 `meta.requiresAdmin` 擋掉 ADMIN 頁面（預算、訂閱、成員、分類），
**頁內不再做唯讀模式**——一般成員根本進不去。唯一的頁內權限判斷在交易列表：一般成員只能編輯自己記的交易。

未登入一律導向 `/login`；`router/nav.ts` 是側欄與手機抽屜共用的導覽定義（含 ADMIN 分組）。

## 型別

`src/types/models.ts` 目前為獨立 interface。`shared/` 已納入 workspace，可改為：

```ts
export type { Member, Transaction, MainCategory /* … */ } from "@family-ledger/shared";
```

兩者已逐欄位等價（`shared/types.ts` 由 Zod schema 推導），改動後型別不會再兩邊漂移。

## 結構

| 路徑 | 說明 |
|---|---|
| \`src/assets/tokens.css\` | 唯一數值來源；Tailwind 只做映射，不自行定義新色 |
| \`src/api/\` | API 契約層（auth / transactions / categories / budgets / subscriptions / members / summary） |
| \`src/mocks/\` | 開發用假後端，替換 axios adapter，含所有業務規則的擋檢 |
| \`src/stores/\` | Pinia：auth / categories / members / dashboard / transactions / budgets / subscriptions / ui |
| \`src/components/base/\` | 共用元件（Button、Card、MetricStat、ProgressBar…） |
| \`src/components/layout/\` | AppShell（桌機側欄 216px＋手機頂部列與抽屜） |
| \`src/components/data/\` | 業務列（交易列、分類預算卡、訂閱列、成員列） |
| \`src/views/\` | 11 個頁面 |

## 貫穿全站的規則（詳見專案根目錄 \`specs/\`）

- **歷史不可改寫**：交易軟刪除且前台無復原；分類與成員只能停用；交易每次編輯寫 revision；訂閱金額變更存歷史版本。
- **記帳者**：恆為新增當下的登入者，不可代記、不可拆帳、不可事後修改；沒有「共同」。
- **預算**：浮動支出必須設上限；固定支出由訂閱月換算（年繳 ÷12）自動推算，不可手填；門檻 70%／100%。
- **權限**：ADMIN 頁面（預算、訂閱、成員、分類）由 router meta 擋掉，頁內不再做唯讀模式；一般成員在交易列表只能編輯自己記的交易。
- **樣式**：卡片一律 1px 邊框、不加陰影；唯一帶陰影的是手機浮動按鈕（藍漸層＋文字，每畫面一顆）。
- **斷點**：768px 單一斷點；手機觸控高度 ≥44px。
