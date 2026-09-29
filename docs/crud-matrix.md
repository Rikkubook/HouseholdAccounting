# 頁面 CRUD 對照表

依前端路由（`vue3/src/router/index.ts`）逐頁列出對應的主要實體、CRUD 操作與後端 API。權限欄位：`全員` 指所有已登入成員（一般成員 + 管理者），`ADMIN` 指僅管理者（後端以 `requireAdmin` 中介層強制）。

## 總覽

| 頁面 | 路徑 | 主要實體 | C | R | U | D | 權限 |
|---|---|---|:-:|:-:|:-:|:-:|---|
| 登入 | `/login` | Session（登入） | ✓ | – | – | – | 公開 |
| 忘記密碼 | `/reset-password` | 密碼 | – | – | ✓ | – | 公開（需重設碼） |
| 首頁儀表板 | `/` | 彙總資料 | – | ✓ | – | – | 全員 |
| 新增交易 | `/transactions/new` | 交易 | ✓ | – | – | – | 全員 |
| 交易列表 | `/transactions` | 交易 | – | ✓ | ✓ | 軟刪 | 全員（僅能改/刪自己的，ADMIN 不受限） |
| 統計圖表 | `/stats` | 彙總資料 | – | ✓ | – | – | 全員 |
| 年度彙整 | `/year` | 彙總資料、年度額外支出 | ✓ | ✓ | – | 硬刪 | 讀全員／額外支出寫 ADMIN |
| 預算管理 | `/budget` | 預算 | ✓(upsert) | ✓ | ✓(upsert) | 軟刪(金額設0) | 讀全員／寫 ADMIN |
| 訂閱管理 | `/subscriptions` | 訂閱 | ✓ | ✓ | ✓ | 僅軟停用 | 讀全員／寫 ADMIN |
| 成員管理 | `/members` | 成員 | ✓ | ✓ | ✓ | 僅軟停用 | 讀全員／寫 ADMIN |
| 分類設定 | `/categories` | 主/子分類 | ✓ | ✓ | ✓ | 僅軟停用 | 讀全員／寫 ADMIN |

**設計原則**：幾乎所有「刪除」都是軟刪／停用，不做實體刪除——成員、分類、訂閱都可能被歷史交易／預算引用，硬刪會破壞歷史資料的可回溯性。目前唯一的硬刪是「年度額外支出」（`year_extra_expenses`），因為它不被其他表引用。

---

## 登入 `LoginView.vue`（`/login`）

| 操作 | 方法 | 端點 | 說明 |
|---|---|---|---|
| C | `POST` | `/api/auth/login` | 帳密登入，回傳 JWT；失敗 5 次鎖定帳號一段時間 |

## 忘記密碼 `ResetPasswordView.vue`（`/reset-password`）

| 操作 | 方法 | 端點 | 說明 |
|---|---|---|---|
| U | `POST` | `/api/auth/reset-password` | 憑帳號 + 6 位重設碼設定新密碼；重設碼由 ADMIN 於成員管理頁產生，一次性、用完即失效 |

## 首頁儀表板 `DashboardView.vue`（`/`）

| 操作 | 方法 | 端點 | 說明 |
|---|---|---|---|
| R | `GET` | `/api/summary/dashboard?month=` | 當月收支總覽、分類預算進度、固定支出彙總 |

唯讀頁面，不提供任何寫入操作。

## 新增交易 `TransactionCreateView.vue`（`/transactions/new`）

| 操作 | 方法 | 端點 | 說明 |
|---|---|---|---|
| C | `POST` | `/api/transactions` | 記帳者一律取登入者本人（後端強制，不接受前端指定），不可代記他人 |

輔助讀取（下拉選單用）：`GET /api/categories`、當前登入者資訊。

## 交易列表 `TransactionListView.vue`（`/transactions`）

| 操作 | 方法 | 端點 | 說明 |
|---|---|---|---|
| R | `GET` | `/api/transactions` | 分頁、可依月份/收支類型/分類/記帳者/備註關鍵字篩選 |
| U | `PATCH` | `/api/transactions/:id` | 只能改金額/日期/分類/備註；收支別與記帳者不可改。一般成員只能改自己記的，ADMIN 不受限。每次異動寫一筆 revision |
| D（軟刪） | `DELETE` | `/api/transactions/:id` | 標記 `isDeleted`，不進任何統計；前台無復原入口。一般成員只能刪自己記的 |
| R（歷史） | `GET` | `/api/transactions/:id/revisions` | 查看單筆交易的欄位異動歷史 |

## 統計圖表 `StatsView.vue`（`/stats`）

| 操作 | 方法 | 端點 | 說明 |
|---|---|---|---|
| R | `GET` | `/api/summary/stats` | 依月／年、可選記帳者篩選的收支統計 |

唯讀頁面。

## 年度彙整 `YearSummaryView.vue`（`/year`）

| 操作 | 方法 | 端點 | 說明 |
|---|---|---|---|
| R | `GET` | `/api/summary/year?year=` | 全年各月收支彙總 |
| C | `POST` | `/api/summary/year-extras` | 新增「年度額外支出」（不分攤到個別月份，僅年度彙整計入），ADMIN 限定 |
| D（硬刪） | `DELETE` | `/api/summary/year-extras/:id` | 唯一有實體刪除的實體，ADMIN 限定 |

## 預算管理 `BudgetView.vue`（`/budget`，ADMIN 限定頁面）

| 操作 | 方法 | 端點 | 說明 |
|---|---|---|---|
| R | `GET` | `/api/budgets?month=` | 取得當月各分類預算 |
| R | `GET` | `/api/budgets/fixed-total?month=` | 固定支出總額（由訂閱換算，年繳 ÷12） |
| C/U（upsert） | `PUT` | `/api/budgets` | 單一分類單一月份的預算金額，存在則更新、不存在則新增；金額輸入 0 視同清除該筆（等同軟刪） |
| C（批次） | `POST` | `/api/budgets/copy-previous` | 沿用上個月已設定的預算到當月，僅複製在目標月份仍存在的分類 |

僅浮動支出分類可設預算（固定支出由訂閱推算、收入不設目標），且分類須在該月份存在（`existsInMonth`，對齊新增/停用月份）。

## 訂閱管理 `SubscriptionsView.vue`（`/subscriptions`，ADMIN 限定頁面）

| 操作 | 方法 | 端點 | 說明 |
|---|---|---|---|
| R | `GET` | `/api/subscriptions` | 依下次扣款日排序的訂閱清單 |
| C | `POST` | `/api/subscriptions` | 新增訂閱，同時寫入第一筆金額版本記錄 |
| U | `PATCH` | `/api/subscriptions/:id` | 金額或週期變更會寫入新的歷史版本（自當月生效），舊期間仍以當時金額計算 |
| U（軟停用） | `POST` | `/api/subscriptions/:id/active` | 只能停用/啟用，不提供刪除 |
| U（特殊動作） | `POST` | `/api/subscriptions/:id/mark-paid` | 標記本期已扣款：自動產生一筆交易、推算下次扣款日 |
| R（歷史） | `GET` | `/api/subscriptions/:id/revisions` | 查看金額/週期異動歷史 |

## 成員管理 `MembersView.vue`（`/members`，ADMIN 限定頁面）

| 操作 | 方法 | 端點 | 說明 |
|---|---|---|---|
| R | `GET` | `/api/members` | 成員清單（不含密碼雜湊） |
| C | `POST` | `/api/members` | 新增成員；ADMIN 不設密碼，以初始碼存為重設碼，成員自行到重設密碼頁設定 |
| U | `PATCH` | `/api/members/:id` | 改名稱/帳號/角色/顏色等；降級最後一位管理者會被擋下 |
| U（軟停用） | `POST` | `/api/members/:id/active` | 停用會擋：最後一位管理者、目前登入者本人、名下仍有進行中訂閱的扣款人 |
| C（重設碼） | `POST` | `/api/members/:id/reset-request` | 產生新的 6 位重設碼，交給成員本人去重設密碼頁使用 |
| D（僅清欄位） | `DELETE` | `/api/members/:id/reset-request` | 作廢目前的重設碼（清空欄位，非刪除成員） |

## 分類設定 `CategoriesView.vue`（`/categories`，ADMIN 限定頁面）

| 操作 | 方法 | 端點 | 說明 |
|---|---|---|---|
| R | `GET` | `/api/categories?includeArchived=` | 巢狀主分類＋子分類清單 |
| C（主） | `POST` | `/api/categories` | 新增主分類，自建立當月起存在 |
| U（主） | `PATCH` | `/api/categories/:id` | 系統分類（`isSystem`）不可改名 |
| U（主，軟停用） | `POST` | `/api/categories/:id/archive` | 只能停用不能刪除，系統分類不可停用；停用年月＝當月 |
| U（主，還原） | `POST` | `/api/categories/:id/restore` | 重新啟用已停用的主分類 |
| U（主，排序） | `POST` | `/api/categories/reorder` | 批次更新主分類顯示順序 |
| C（子） | `POST` | `/api/categories/:id/subs` | 新增子分類；歸屬主分類只在新增時決定，不可搬移 |
| U（子） | `PATCH` | `/api/categories/subs/:subId` | 改子分類名稱 |
| U（子，軟停用） | `POST` | `/api/categories/subs/:subId/archive` | 停用子分類 |
| U（子，還原） | `POST` | `/api/categories/subs/:subId/restore` | 重新啟用已停用的子分類 |
| U（子，排序） | `POST` | `/api/categories/:id/subs/reorder` | 批次更新子分類顯示順序 |

歷史交易保留原分類快照（`mainCategoryName`／`subCategoryName`），分類改名或停用不影響已記錄的交易顯示。
