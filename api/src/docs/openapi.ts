import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";
import {
  apiErrorSchema,
  budgetSchema,
  budgetUpsertSchema,
  loginBodySchema,
  mainCategoryDraftSchema,
  mainCategoryPatchSchema,
  mainCategorySchema,
  memberDraftSchema,
  memberPatchSchema,
  memberSchema,
  reorderSchema,
  resetPasswordBodySchema,
  setActiveSchema,
  subCategorySchema,
  subNameSchema,
  subscriptionDraftSchema,
  subscriptionPatchSchema,
  subscriptionRevisionSchema,
  subscriptionSchema,
  transactionDraftSchema,
  transactionPatchSchema,
  transactionRevisionSchema,
  transactionViewSchema,
  yearExtraDraftSchema,
  yearExtraPatchSchema,
  yearExtraExpenseSchema,
} from "@family-ledger/shared";

/**
 * OpenAPI 文件。schema 區塊直接由 shared/schema.ts 的 Zod 定義轉出，
 * 因此欄位與驗證規則不會與實作漂移；paths 區塊為手寫，需與 routes/* 同步維護。
 *
 * 刻意不改用 @hono/zod-openapi：那需要把每支路由改寫成 createRoute()，
 * 動到全部 8 個路由檔，風險遠大於維護這一份 paths 表。
 */

type JsonSchema = Record<string, unknown>;

/** 轉成 components/schemas 可用的形式：去掉 $schema，$ref 指向 components。 */
function toSchema(zod: ZodTypeAny): JsonSchema {
  const json = zodToJsonSchema(zod, { target: "openApi3", $refStrategy: "none" }) as JsonSchema;
  delete json.$schema;
  return json;
}

const ref = (name: string) => ({ $ref: "#/components/schemas/" + name });
const arrayOf = (name: string) => ({ type: "array", items: ref(name) });

/** TS interface（非 Zod）定義的回應形狀，手寫於此。 */
const handWritten: Record<string, JsonSchema> = {
  LoginResponse: {
    type: "object",
    required: ["token", "expiresIn", "user"],
    properties: {
      token: { type: "string", description: "JWT，前端存於 localStorage" },
      expiresIn: { type: "integer", description: "有效秒數。自首次登入起固定 6 個月，不續期" },
      user: ref("Member"),
    },
  },
  PagedTransactionView: {
    type: "object",
    required: ["items", "total", "page", "pageSize"],
    properties: {
      items: arrayOf("TransactionView"),
      total: { type: "integer" },
      page: { type: "integer" },
      pageSize: { type: "integer", description: "固定 20，使用者不可調整" },
    },
  },
  MonthSummary: {
    type: "object",
    required: ["month", "income", "expense", "net", "investment", "hasInvestment", "fixedTotal", "scheduledExpense"],
    properties: {
      month: { type: "string", example: "2026-08" },
      income: { type: "integer" },
      expense: { type: "integer" },
      net: { type: "integer", description: "收入 − 支出（不扣投資）" },
      investment: { type: "integer", description: "投資，不含在 expense 內；剩餘現金＝net − investment" },
      hasInvestment: { type: "boolean", description: "該帳本有投資分類，前端才顯示投資與剩餘現金" },
      fixedTotal: { type: "integer", description: "訂閱月換算總額（年繳 ÷12）" },
      scheduledExpense: { type: "integer", description: "已排定但日期未到，不含在 expense 內" },
    },
  },
  CategoryProgress: {
    type: "object",
    required: ["id", "name", "icon", "budget", "spent", "scheduled", "recent"],
    properties: {
      id: { type: "integer" },
      name: { type: "string" },
      icon: { type: "string", description: "Material Symbols 名稱" },
      budget: { type: ["integer", "null"], description: "null = 該月未設預算" },
      spent: { type: "integer" },
      scheduled: { type: "integer" },
      recent: arrayOf("TransactionView"),
    },
  },
  DashboardPayload: {
    type: "object",
    required: ["summary", "categories", "recent"],
    properties: {
      summary: ref("MonthSummary"),
      categories: arrayOf("CategoryProgress"),
      recent: arrayOf("TransactionView"),
    },
  },
  StatsPayload: {
    type: "object",
    required: ["range", "period", "floating", "fixed", "total"],
    properties: {
      range: { type: "string", enum: ["month", "year"] },
      period: { type: "string", description: "range=month 時 YYYY-MM；range=year 時 YYYY" },
      floating: {
        type: "array",
        items: {
          type: "object",
          required: ["mainCategoryId", "name", "icon", "amount", "budget", "subs"],
          properties: {
            mainCategoryId: { type: "integer" },
            name: { type: "string" },
            icon: { type: "string" },
            amount: { type: "integer" },
            budget: { type: ["integer", "null"] },
            subs: {
              type: "array",
              items: {
                type: "object",
                required: ["subCategoryId", "name", "amount"],
                properties: {
                  subCategoryId: { type: "integer" },
                  name: { type: "string" },
                  amount: { type: "integer" },
                },
              },
            },
          },
        },
      },
      fixed: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "amount"],
          properties: { name: { type: "string" }, amount: { type: "integer" } },
        },
      },
      total: { type: "integer", description: "僅浮動支出合計" },
    },
  },
  YearSummaryPayload: {
    type: "object",
    required: ["year", "income", "expense", "net", "investment", "hasInvestment", "recordedMonths", "monthly", "rows", "extras"],
    properties: {
      year: { type: "integer" },
      income: { type: "integer" },
      expense: { type: "integer" },
      net: { type: "integer", description: "收入 − 支出（不扣投資）" },
      investment: { type: "integer", description: "全年投資，不含在 expense 內" },
      hasInvestment: { type: "boolean", description: "該帳本有投資分類，年度總表才顯示投資合計與剩餘現金" },
      recordedMonths: { type: "integer" },
      monthly: {
        type: "array",
        description: "12 欄：每月收入、支出、投資、結餘（不含年度額外開銷）；該月沒有交易為 null",
        items: {
          type: "object",
          nullable: true,
          required: ["income", "expense", "investment", "net"],
          properties: {
            income: { type: "integer" },
            expense: { type: "integer" },
            investment: { type: "integer" },
            net: { type: "integer" },
          },
        },
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            mainCategoryId: { type: "integer" },
            name: { type: "string" },
            icon: { type: "string" },
            months: {
              type: "array",
              items: { type: ["integer", "null"] },
              description: "12 欄；null = 分類當時不存在或該月尚未記錄",
            },
            extra: { type: ["integer", "null"] },
            total: { type: "integer" },
            planned: { type: ["integer", "null"] },
            monthlyBudget: { type: "integer" },
            startMonth: { type: "integer", description: "0-indexed" },
            endMonth: { type: "integer", description: "0-indexed，排他" },
          },
        },
      },
      extras: {
        type: "array",
        items: {
          allOf: [
            ref("YearExtraExpense"),
            {
              type: "object",
              required: ["categoryName", "payerName"],
              properties: { categoryName: { type: "string" }, payerName: { type: "string" } },
            },
          ],
        },
      },
    },
  },
  FixedTotal: {
    type: "object",
    required: ["month", "amount"],
    properties: { month: { type: "string" }, amount: { type: "integer" } },
  },
  ResetCodeResponse: {
    type: "object",
    required: ["resetCode"],
    properties: { resetCode: { type: "string", example: "482915" } },
  },
  MarkPaidResponse: {
    type: "object",
    required: ["subscription", "transaction"],
    properties: { subscription: ref("Subscription"), transaction: ref("TransactionView") },
  },
  ChargeRunResponse: {
    type: "object",
    required: ["asOf", "charged"],
    properties: {
      asOf: { type: "string", example: "2026-09-15" },
      charged: {
        type: "array",
        items: {
          type: "object",
          properties: {
            subscriptionId: { type: "integer" },
            transactionId: { type: ["integer", "null"] },
            date: { type: "string" },
            amount: { type: "integer" },
            skipped: { type: "boolean", description: "true = 該期已存在交易，冪等跳過" },
          },
        },
      },
    },
  },
  BackupResult: {
    type: "object",
    required: ["path", "bytes", "counts", "uploaded"],
    properties: {
      path: { type: "string", example: "backups/2026/2026-09-15.json" },
      bytes: { type: "integer" },
      counts: { type: "object", additionalProperties: { type: "integer" } },
      uploaded: { type: "boolean" },
      reason: { type: "string", description: "uploaded=false 時說明原因" },
    },
  },
};

const schemas: Record<string, JsonSchema> = {
  Member: toSchema(memberSchema),
  SubCategory: toSchema(subCategorySchema),
  MainCategory: toSchema(mainCategorySchema),
  TransactionView: toSchema(transactionViewSchema),
  TransactionRevision: toSchema(transactionRevisionSchema),
  Budget: toSchema(budgetSchema),
  Subscription: toSchema(subscriptionSchema),
  SubscriptionRevision: toSchema(subscriptionRevisionSchema),
  YearExtraExpense: toSchema(yearExtraExpenseSchema),
  LoginBody: toSchema(loginBodySchema),
  ResetPasswordBody: toSchema(resetPasswordBodySchema),
  TransactionDraft: toSchema(transactionDraftSchema),
  TransactionPatch: toSchema(transactionPatchSchema),
  MemberDraft: toSchema(memberDraftSchema),
  MemberPatch: toSchema(memberPatchSchema),
  MainCategoryDraft: toSchema(mainCategoryDraftSchema),
  MainCategoryPatch: toSchema(mainCategoryPatchSchema),
  SubName: toSchema(subNameSchema),
  Reorder: toSchema(reorderSchema),
  SetActive: toSchema(setActiveSchema),
  SubscriptionDraft: toSchema(subscriptionDraftSchema),
  SubscriptionPatch: toSchema(subscriptionPatchSchema),
  BudgetUpsert: toSchema(budgetUpsertSchema),
  YearExtraDraft: toSchema(yearExtraDraftSchema),
  YearExtraPatch: toSchema(yearExtraPatchSchema),
  ApiError: toSchema(apiErrorSchema),
  ...handWritten,
};

/* ── paths 的組裝輔助 ────────────────────────────────── */

const json = (schema: unknown) => ({ content: { "application/json": { schema } } });

const err = (description: string) => ({ description, ...json(ref("ApiError")) });

const okJson = (schema: unknown, description = "成功") => ({ description, ...json(schema) });

const pathId = (name = "id", description = "") => ({
  name,
  in: "path",
  required: true,
  schema: { type: "integer", minimum: 1 },
  description,
});

const monthQuery = {
  name: "month",
  in: "query",
  required: true,
  schema: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
  example: "2026-08",
};

/** 家庭帳／個人帳。個人帳永遠是登入者自己的，所有成員都有，看不到別人的。 */
const scopeQuery = {
  name: "scope",
  in: "query",
  schema: { type: "string", enum: ["family", "personal"], default: "family" },
  description: "`family`＝家庭帳（預設，舊版前端不帶也不受影響）；`personal`＝登入者自己的個人帳",
};

const ADMIN = "**需管理者權限。**";
/** 分類：家庭分類需管理者；個人分類每位成員管自己的（個人帳第 2 批） */
/** 訂閱：家庭帳需管理者；個人訂閱每位成員管自己的（個人帳第 2 批 PL2-02） */
const SUB_WRITE = "**家庭帳的訂閱需管理者權限；個人訂閱每位成員可改自己的**，別人的個人訂閱一律回 404（管理者也一樣）。";
const CAT_WRITE = "**家庭分類需管理者權限；個人分類每位成員可改自己的**，別人的個人分類一律回 404（管理者也一樣）。";
const commonErrors = {
  400: err("輸入格式或業務規則不符"),
  401: err("未登入或 token 失效"),
  403: err("權限不足（非管理者）"),
};

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "家庭帳 API",
    version: "1.0.0",
    description: [
      "一個家庭共用的記帳 API。全家共記一本**家庭帳**，每位成員另有只有自己看得到的**個人帳**；管理者可設分類、預算、訂閱與成員。",
      "",
      "### 通則",
      "- 金額一律新台幣**整數元**，無小數。",
      "- 日期 `YYYY-MM-DD`，月份 `YYYY-MM`。",
      "- JSON 欄位為 **camelCase**（資料庫端為 snake_case，轉換只發生在 `db/schema.ts`）。",
      "- 錯誤一律回 `{ code, message }`，`message` 為可直接顯示的繁體中文。",
      "",
      "### 貫穿全站的規則",
      "- **歷史不可改寫**：交易軟刪除且無復原入口；分類與成員只能停用；交易每次編輯寫入 revision。",
      "- **記帳者**預設為登入者；管理者可代記他人（新增時傳 `payerId`）、事後也可更換，對象須為啟用中的成員。訂閱產生的交易與個人帳交易不可更換。實際輸入者記在 `createdBy`。",
      "- **個人帳**：查詢與新增帶 `scope=personal`。所有成員（含一般成員）都有，只看得到自己的；別人的個人帳交易一律回 404，管理者也一樣。個人帳不可代記、建立後不能搬到家庭帳。分類、預算、訂閱、年度額外開銷都分家庭與個人（看掛的分類屬於哪本帳），個人交易只能用自己的個人分類。",
      "- **投資**（`type=investment`）：錢離開錢包但仍是自己的，不算支出也不算收入。結餘＝收入 − 支出；剩餘現金＝結餘 − 投資。",
      "- **預算**僅浮動支出可設；固定支出由訂閱月換算（年繳 ÷12）自動推算。",
      "- **認證**：`POST /auth/login` 取得 JWT，後續請求帶 `Authorization: Bearer <token>`。",
    ].join("\n"),
  },
  servers: [
    { url: "http://localhost:8787/api", description: "本機" },
    { url: "/api", description: "同源部署" },
  ],
  tags: [
    { name: "auth", description: "登入、登出、重設密碼" },
    { name: "transactions", description: "交易記錄與修改歷程" },
    { name: "categories", description: "主分類與子分類（家庭分類 ADMIN；個人分類本人）" },
    { name: "budgets", description: "逐月預算（ADMIN 寫入）" },
    { name: "subscriptions", description: "訂閱與扣款（家庭帳 ADMIN；個人訂閱本人）" },
    { name: "members", description: "成員與密碼重設碼（ADMIN 寫入）" },
    { name: "summary", description: "儀表板、統計、年度彙整" },
    { name: "cron", description: "Vercel Cron 專用，驗 CRON_SECRET 而非成員 JWT" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      cronSecret: {
        type: "http",
        scheme: "bearer",
        description: "值為環境變數 CRON_SECRET。Vercel Cron 會自動帶上。",
      },
    },
    schemas,
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/auth/login": {
      post: {
        tags: ["auth"],
        summary: "登入",
        description: "連續失敗 5 次鎖定帳號，回 423 並附剩餘鎖定分鐘數。已停用帳號一律視為帳密錯誤。",
        security: [],
        requestBody: { required: true, ...json(ref("LoginBody")) },
        responses: {
          200: okJson(ref("LoginResponse")),
          401: err("帳號或密碼錯誤"),
          423: err("失敗次數過多，帳號暫時鎖定"),
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["auth"],
        summary: "登出",
        description: "不做伺服器端狀態，前端清除 localStorage 即可。此端點存在是為了讓呼叫有對應。",
        responses: { 204: { description: "無內容" } },
      },
    },
    "/auth/me": {
      get: {
        tags: ["auth"],
        summary: "取得登入者",
        responses: { 200: okJson(ref("Member")), 401: err("未登入或 token 失效") },
      },
    },
    "/auth/reset-password": {
      post: {
        tags: ["auth"],
        summary: "以重設碼自設新密碼",
        description:
          "重設碼由管理者產生後口頭轉達，一次性、不設期限。錯誤訊息刻意不區分「帳號錯」與「碼錯」。",
        security: [],
        requestBody: { required: true, ...json(ref("ResetPasswordBody")) },
        responses: { 204: { description: "重設成功" }, 400: err("帳號或重設碼不正確") },
      },
    },

    "/transactions": {
      get: {
        tags: ["transactions"],
        summary: "交易列表（分頁）",
        description: "一律依建立時間由近到遠。`keyword` 僅搜尋備註。已軟刪除的不會出現。",
        parameters: [
          { name: "month", in: "query", schema: { type: "string" }, example: "2026-08" },
          { name: "type", in: "query", schema: { type: "string", enum: ["all", "expense", "income", "investment"], default: "all" } },
          { name: "mainCategoryId", in: "query", schema: { type: "integer" } },
          { name: "payerId", in: "query", schema: { type: "integer" } },
          { name: "keyword", in: "query", schema: { type: "string", maxLength: 50 } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 }, description: "前端固定 20" },
          scopeQuery,
        ],
        responses: { 200: okJson(ref("PagedTransactionView")), 401: commonErrors[401] },
      },
      post: {
        tags: ["transactions"],
        summary: "新增交易",
        description: "`payerId` 省略＝登入者本人；指定他人**僅限管理者**（代記），且須為啟用中的成員。實際輸入者寫入 `createdBy`。日期可為未來（預定支出）。`scope=personal` 記在自己的個人帳，此時不可代記他人（400）。",
        requestBody: { required: true, ...json(ref("TransactionDraft")) },
        responses: { 200: okJson(ref("TransactionView")), 400: commonErrors[400], 401: commonErrors[401] },
      },
    },
    "/transactions/{id}": {
      patch: {
        tags: ["transactions"],
        summary: "修改交易",
        description:
          "可改欄位：金額、日期、分類、備註、記帳者；**收支別不可修改**。一般成員只能改自己記的，管理者不受限。記帳者僅管理者可換，且訂閱產生的交易與個人帳交易不可換。每個異動欄位寫一列 revision。",
        parameters: [pathId()],
        requestBody: { required: true, ...json(ref("TransactionPatch")) },
        responses: { 200: okJson(ref("TransactionView")), ...commonErrors, 404: err("交易不存在，或是別人的個人帳") },
      },
      delete: {
        tags: ["transactions"],
        summary: "刪除交易（軟刪除）",
        description: "前台無復原入口，已刪除紀錄不計入任何統計。",
        parameters: [pathId()],
        responses: { 204: { description: "已刪除" }, ...commonErrors, 404: err("交易不存在，或是別人的個人帳") },
      },
    },
    "/transactions/{id}/revisions": {
      get: {
        tags: ["transactions"],
        summary: "交易修改歷程",
        parameters: [pathId()],
        responses: {
          200: okJson(arrayOf("TransactionRevision")),
          401: commonErrors[401],
          404: err("交易不存在，或是別人的個人帳"),
        },
      },
    },

    "/categories": {
      get: {
        tags: ["categories"],
        summary: "分類清單（含子分類）",
        description: "記帳與篩選都需要，讀取開放全員。`scope=personal` 只回登入者自己的個人分類；第一次讀取時自動建立系統分類「其他」。",
        parameters: [
          scopeQuery,
          {
            name: "includeArchived",
            in: "query",
            schema: { type: "boolean", default: true },
            description: "false 只回啟用中的分類",
          },
        ],
        responses: { 200: okJson(arrayOf("MainCategory")), 401: commonErrors[401] },
      },
      post: {
        tags: ["categories"],
        summary: "新增主分類",
        description: CAT_WRITE + " 支出分類須指定浮動或固定；收入與投資分類不得有 `nature`。`scope=personal` 建立在登入者自己的個人帳。",
        parameters: [scopeQuery],
        requestBody: { required: true, ...json(ref("MainCategoryDraft")) },
        responses: { 200: okJson(ref("MainCategory")), ...commonErrors, 404: err("分類不存在，或是別人的個人分類") },
      },
    },
    "/categories/{id}": {
      patch: {
        tags: ["categories"],
        summary: "修改主分類",
        description: CAT_WRITE + " 只能改名稱與圖示；**收支別與性質建立後不可修改**，避免歷史統計錯位。系統保留分類「其他」不可修改。",
        parameters: [pathId()],
        requestBody: { required: true, ...json(ref("MainCategoryPatch")) },
        responses: { 200: okJson(ref("MainCategory")), ...commonErrors, 404: err("分類不存在，或是別人的個人分類") },
      },
    },
    "/categories/{id}/archive": {
      post: {
        tags: ["categories"],
        summary: "停用主分類",
        description: CAT_WRITE + " 只能停用不能刪除；歷史交易保留原分類。停用年月＝當月，之後的月份在年度表顯示「—」。",
        parameters: [pathId()],
        responses: { 200: okJson(ref("MainCategory")), ...commonErrors, 404: err("分類不存在，或是別人的個人分類") },
      },
    },
    "/categories/{id}/restore": {
      post: {
        tags: ["categories"],
        summary: "重新啟用主分類",
        description: CAT_WRITE,
        parameters: [pathId()],
        responses: { 200: okJson(ref("MainCategory")), ...commonErrors, 404: err("分類不存在，或是別人的個人分類") },
      },
    },
    "/categories/reorder": {
      post: {
        tags: ["categories"],
        summary: "主分類排序",
        description: CAT_WRITE + " `orderedIds` 必須都屬於 `scope` 指定的帳本。",
        parameters: [scopeQuery],
        requestBody: { required: true, ...json(ref("Reorder")) },
        responses: { 204: { description: "已更新" }, ...commonErrors, 404: err("分類不存在，或是別人的個人分類") },
      },
    },
    "/categories/{id}/subs": {
      post: {
        tags: ["categories"],
        summary: "新增子分類",
        description: CAT_WRITE + " 歸屬主分類只在新增時決定，**不可搬移**。同一主分類下名稱不可重複。",
        parameters: [pathId("id", "主分類 id")],
        requestBody: { required: true, ...json(ref("SubName")) },
        responses: { 200: okJson(ref("MainCategory")), ...commonErrors, 404: err("分類不存在，或是別人的個人分類") },
      },
    },
    "/categories/subs/{subId}": {
      patch: {
        tags: ["categories"],
        summary: "子分類改名",
        description: CAT_WRITE,
        parameters: [pathId("subId")],
        responses: { 200: okJson(ref("MainCategory")), ...commonErrors, 404: err("分類不存在，或是別人的個人分類") },
        requestBody: { required: true, ...json(ref("SubName")) },
      },
    },
    "/categories/subs/{subId}/archive": {
      post: {
        tags: ["categories"],
        summary: "停用子分類",
        description: CAT_WRITE,
        parameters: [pathId("subId")],
        responses: { 200: okJson(ref("MainCategory")), ...commonErrors, 404: err("分類不存在，或是別人的個人分類") },
      },
    },
    "/categories/{id}/subs/reorder": {
      post: {
        tags: ["categories"],
        summary: "子分類排序",
        description: CAT_WRITE,
        parameters: [pathId("id", "主分類 id")],
        requestBody: { required: true, ...json(ref("Reorder")) },
        responses: { 204: { description: "已更新" }, ...commonErrors, 404: err("分類不存在，或是別人的個人分類") },
      },
    },

    "/budgets": {
      get: {
        tags: ["budgets"],
        summary: "當月預算清單",
        description: "儀表板的分類進度需要，讀取開放全員。固定支出不在此清單（由訂閱推算）。`scope=personal` 只回自己個人分類的預算。",
        parameters: [monthQuery, scopeQuery],
        responses: { 200: okJson(arrayOf("Budget")), 401: commonErrors[401] },
      },
      put: {
        tags: ["budgets"],
        summary: "設定預算",
        description:
          "家庭分類**需管理者權限**；自己的個人分類任何成員都可設（別人的個人分類回 400）。僅浮動支出分類可設。`amount: 0` 表示清除該筆設定。",
        requestBody: { required: true, ...json(ref("BudgetUpsert")) },
        responses: { 200: okJson(ref("Budget")), ...commonErrors },
      },
    },
    "/budgets/fixed-total": {
      get: {
        tags: ["budgets"],
        summary: "固定支出總額",
        description: "由啟用中的訂閱月換算（年繳 ÷12）自動推算，不可手填。`scope=personal` 算自己的個人訂閱。",
        parameters: [monthQuery, scopeQuery],
        responses: { 200: okJson(ref("FixedTotal")), 401: commonErrors[401] },
      },
    },
    "/budgets/copy-previous": {
      post: {
        tags: ["budgets"],
        summary: "沿用上月預算",
        description:
          "家庭帳**需管理者權限**；`scope=personal` 沿用自己的個人預算。" +
          " **只補空白，不覆蓋**已手動填過的值（B.3 決議）。只複製上月有設定、且該分類在目標月份仍存在的項目。",
        parameters: [scopeQuery],
        requestBody: {
          required: true,
          ...json({ type: "object", required: ["month"], properties: { month: { type: "string", example: "2026-09" } } }),
        },
        responses: { 200: okJson(arrayOf("Budget"), "目標月份的完整預算清單"), ...commonErrors },
      },
    },

    "/subscriptions": {
      get: {
        tags: ["subscriptions"],
        summary: "訂閱清單",
        description: "依下次扣款日排序。`scope=personal` 只回登入者自己的個人訂閱。",
        parameters: [scopeQuery],
        responses: { 200: okJson(arrayOf("Subscription")), 401: commonErrors[401] },
      },
      post: {
        tags: ["subscriptions"],
        summary: "新增訂閱",
        description: SUB_WRITE + "\n\n`mainCategoryId` 是自動扣款記到的分類：同一本帳、啟用中的**固定支出**分類；省略＝該帳本的系統分類「訂閱」。分類停用時，底下的訂閱自動改回「訂閱」。`scope=personal` 建立在自己的個人帳，`payerId` 必須是自己，自動扣款的交易記到個人帳。",
        parameters: [scopeQuery],
        requestBody: { required: true, ...json(ref("SubscriptionDraft")) },
        responses: { 200: okJson(ref("Subscription")), ...commonErrors },
      },
    },
    "/subscriptions/{id}": {
      patch: {
        tags: ["subscriptions"],
        summary: "修改訂閱",
        description:
          SUB_WRITE +
          " 金額或週期變更會寫入歷史版本（自當月生效），**舊期間仍以當時金額計算**。" +
          "年繳分攤進行中（第 2～12 期）不能改週期與扣款日（400）；改金額從下一期起生效。" +
          "可換 `mainCategoryId`（同樣只能換到同一本帳、啟用中的固定支出分類），之後的扣款記到新分類，已產生的交易不動。",
        parameters: [pathId()],
        requestBody: { required: true, ...json(ref("SubscriptionPatch")) },
        responses: { 200: okJson(ref("Subscription")), ...commonErrors, 404: err("訂閱不存在，或是別人的個人訂閱") },
      },
    },
    "/subscriptions/{id}/active": {
      post: {
        tags: ["subscriptions"],
        summary: "啟用／停用訂閱",
        description: SUB_WRITE + " 只能停用，不提供刪除。",
        parameters: [pathId()],
        requestBody: { required: true, ...json(ref("SetActive")) },
        responses: { 200: okJson(ref("Subscription")), ...commonErrors },
      },
    },
    "/subscriptions/{id}/mark-paid": {
      post: {
        tags: ["subscriptions"],
        summary: "標記已扣款",
        description:
          SUB_WRITE +
          " 產生一筆交易（記帳者＝訂閱的扣款人）並推進下次扣款日。與每日 Cron 共用同一條路徑，冪等：同一期重複觸發不會扣兩次。實際金額不同時，到交易列表改那一筆。" +
          "\n\n**年繳**拆成 12 期分攤：每月產生一期（年費 ÷ 12 取整數，餘數放最後一期，備註「名稱（年繳 n/12）」），" +
          "`nextChargeDate` 每月推進；停用後已付期間的分攤仍可產生，不會開始新的一期。",
        parameters: [pathId()],
        responses: { 200: okJson(ref("MarkPaidResponse")), ...commonErrors },
      },
    },
    "/subscriptions/{id}/revisions": {
      get: {
        tags: ["subscriptions"],
        summary: "訂閱金額變更歷史",
        parameters: [pathId()],
        responses: { 200: okJson(arrayOf("SubscriptionRevision")), 401: commonErrors[401], 404: err("訂閱不存在，或是別人的個人訂閱") },
      },
    },

    "/members": {
      get: {
        tags: ["members"],
        summary: "成員清單",
        description: "記帳者下拉與篩選器都需要，讀取開放全員。`passwordHash` 永不出現在回應中。",
        responses: { 200: okJson(arrayOf("Member")), 401: commonErrors[401] },
      },
      post: {
        tags: ["members"],
        summary: "新增成員",
        description:
          ADMIN + " 管理者**不設定密碼**，只給 6 位 `initialCode`，成員憑此於重設密碼頁自設。",
        requestBody: { required: true, ...json(ref("MemberDraft")) },
        responses: { 200: okJson(ref("Member")), ...commonErrors },
      },
    },
    "/members/{id}": {
      patch: {
        tags: ["members"],
        summary: "修改成員",
        description: ADMIN + " 擋：把最後一位管理者降為一般成員。",
        parameters: [pathId()],
        requestBody: { required: true, ...json(ref("MemberPatch")) },
        responses: { 200: okJson(ref("Member")), ...commonErrors, 404: err("成員不存在") },
      },
    },
    "/members/{id}/active": {
      post: {
        tags: ["members"],
        summary: "啟用／停用成員",
        description:
          ADMIN +
          " 軟刪除，歷史紀錄仍顯示其名稱。停用會被擋的情況：最後一位管理者、目前登入者本人、名下仍有進行中的訂閱。",
        parameters: [pathId()],
        requestBody: { required: true, ...json(ref("SetActive")) },
        responses: { 200: okJson(ref("Member")), ...commonErrors },
      },
    },
    "/members/{id}/reset-request": {
      post: {
        tags: ["members"],
        summary: "產生密碼重設碼",
        description: ADMIN + " 6 位數字，不設期限，用畢即失效。**管理者不會知道成員的密碼。**",
        parameters: [pathId()],
        responses: { 200: okJson(ref("ResetCodeResponse")), ...commonErrors },
      },
      delete: {
        tags: ["members"],
        summary: "取消密碼重設碼",
        description: ADMIN,
        parameters: [pathId()],
        responses: { 200: okJson(ref("Member")), ...commonErrors },
      },
    },

    "/summary/dashboard": {
      get: {
        tags: ["summary"],
        summary: "首頁儀表板",
        description: "當月收支總覽、固定支出總額、浮動支出分類進度（各附最近交易）。",
        parameters: [monthQuery, scopeQuery],
        responses: { 200: okJson(ref("DashboardPayload")), 401: commonErrors[401] },
      },
    },
    "/summary/stats": {
      get: {
        tags: ["summary"],
        summary: "統計圖表",
        description: "只統計支出。`range=year` 時預算為月預算 × 有記錄的月數。",
        parameters: [
          { name: "range", in: "query", schema: { type: "string", enum: ["month", "year"], default: "month" } },
          {
            name: "period",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "range=month 時 YYYY-MM；range=year 時 YYYY",
            example: "2026-08",
          },
          { name: "payerId", in: "query", schema: { type: "integer" }, description: "不填為全家合計" },
          scopeQuery,
        ],
        responses: { 200: okJson(ref("StatsPayload")), 400: commonErrors[400], 401: commonErrors[401] },
      },
    },
    "/summary/year": {
      get: {
        tags: ["summary"],
        summary: "年度彙整",
        description: "12 欄矩陣。`null` 表示分類當時不存在、已停用，或該月尚未記錄。",
        parameters: [{ name: "year", in: "query", required: true, schema: { type: "integer" }, example: 2026 }, scopeQuery],
        responses: { 200: okJson(ref("YearSummaryPayload")), 401: commonErrors[401] },
      },
    },
    "/summary/year-extras": {
      post: {
        tags: ["summary"],
        summary: "新增年度額外支出",
        description:
          "不分攤到個別月份，僅在年度彙整頁計入。屬於哪本帳看 `mainCategoryId`：家庭分類**需管理者權限**；本人的個人分類任何成員都可以，且 `payerId` 必須是自己。",
        requestBody: { required: true, ...json(ref("YearExtraDraft")) },
        responses: { 200: okJson(ref("YearExtraExpense")), ...commonErrors },
      },
    },
    "/summary/year-extras/{id}": {
      patch: {
        tags: ["summary"],
        summary: "修改年度額外支出",
        description:
          "權限同新增：家庭帳的**需管理者權限**，個人帳的本人可改。年度不可改；分類只能換成同一本帳的支出分類；個人帳的支付者固定是本人。",
        parameters: [pathId()],
        requestBody: { required: true, ...json(ref("YearExtraPatch")) },
        responses: { 200: okJson(ref("YearExtraExpense")), ...commonErrors, 404: err("項目不存在，或是別人的個人帳") },
      },
      delete: {
        tags: ["summary"],
        summary: "刪除年度額外支出",
        description: "家庭帳的**需管理者權限**；個人帳的本人可刪。這是唯一真正硬刪除的資料（非交易紀錄）。",
        parameters: [pathId()],
        responses: { 204: { description: "已刪除" }, ...commonErrors, 404: err("項目不存在，或是別人的個人帳") },
      },
    },

    "/cron/run-due-charges": {
      get: {
        tags: ["cron"],
        summary: "訂閱自動扣款",
        description:
          "每日 02:00（台北）由 Vercel Cron 觸發。掃出「應扣日已到或已過、且尚未產生交易」的啟用訂閱，逐筆補扣。一筆訂閱若積欠多期，每次只補最舊一期，由每日 Cron 逐日追上。冪等。",
        security: [{ cronSecret: [] }],
        responses: {
          200: okJson(ref("ChargeRunResponse")),
          401: err("排程憑證不正確"),
          403: err("CRON_SECRET 未設定"),
        },
      },
    },
    "/cron/backup": {
      get: {
        tags: ["cron"],
        summary: "全庫備份",
        description:
          "每週日 02:30（台北）由 Vercel Cron 觸發。全庫匯成單一 JSON 上傳到 Supabase Storage 私有 bucket（`backups/<年>/<日期>.json`，同日重跑覆蓋）。未設 `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` 時只回傳各表列數不上傳。",
        security: [{ cronSecret: [] }],
        responses: {
          200: okJson(ref("BackupResult")),
          401: err("排程憑證不正確"),
          403: err("CRON_SECRET 未設定"),
        },
      },
    },
  },
} as const;
