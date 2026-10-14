import { z } from "zod";

/**
 * 唯一契約來源。前端 vue3/src/types/models.ts 的 interface 由此推導（見 types.ts）。
 * 業務規則直接編碼在 schema 裡：金額整數且大於 0、日期格式、收入分類無 nature…
 */

/* ── 基本型別 ───────────────────────────────────────── */

export const roleSchema = z.enum(["admin", "member"]);
export const txTypeSchema = z.enum(["expense", "income"]);
export const categoryNatureSchema = z.enum(["floating", "fixed"]);
export const billingCycleSchema = z.enum(["monthly", "yearly"]);

export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "月份格式須為 YYYY-MM");

export const dateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "日期格式須為 YYYY-MM-DD");

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "色碼須為 #RRGGBB");

/** 金額一律新台幣元整數，無小數（specs/00-全域規則.md）。 */
export const amountSchema = z.number().int("金額須為整數").positive("金額須大於 0");

/** 6 位數字，一次性使用，不設有效期限（specs/02-重設密碼頁.md 規則 1）。 */
export const resetCodeSchema = z.string().regex(/^\d{6}$/, "重設碼須為 6 位數字");

/** 至少 4 位，沿用登入頁下限（specs/02-重設密碼頁.md 規則 4）。 */
export const passwordSchema = z.string().min(4, "密碼至少 4 位");

export const accountSchema = z
  .string()
  .trim()
  .min(2, "帳號至少 2 個字元")
  .max(32)
  .regex(/^[a-zA-Z0-9_.-]+$/, "帳號僅接受英數與 _ . -");

export const idSchema = z.coerce.number().int().positive();
export const yearSchema = z.coerce.number().int().min(2000).max(2100);

/** query string 的布林值：z.coerce.boolean("false") 會得到 true，必須自己解析。 */
export const queryBoolSchema = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((v) => v === true || v === "true" || v === "1");

/* ── 實體 ───────────────────────────────────────────── */

export const memberSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  account: z.string(),
  role: roleSchema,
  isActive: z.boolean(),
  color: z.string(),
  joinedMonth: z.string(),
  /** 待成員自行重設的 6 位代碼；null 表示沒有待處理的重設要求 */
  resetCode: z.string().nullable(),
});

export const subCategorySchema = z.object({
  id: z.number().int(),
  mainCategoryId: z.number().int(),
  name: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});

export const mainCategorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  icon: z.string(),
  type: txTypeSchema,
  nature: categoryNatureSchema.nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  isSystem: z.boolean(),
  /** 系統分類識別碼：other =「其他」、subscription =「訂閱」 */
  systemKey: z.enum(["other", "subscription"]).nullable(),
  activeFrom: z.string().nullable(),
  archivedFrom: z.string().nullable(),
  subCategories: z.array(subCategorySchema),
});

export const transactionSchema = z.object({
  id: z.number().int(),
  type: txTypeSchema,
  mainCategoryId: z.number().int().nullable(),
  subCategoryId: z.number().int().nullable(),
  amount: z.number().int(),
  date: z.string(),
  payerId: z.number().int(),
  note: z.string().nullable(),
  createdAt: z.string(),
  isDeleted: z.boolean(),
  sourceSubscriptionId: z.number().int().nullable(),
  /** 實際輸入者；null = 系統自動產生（Cron 訂閱扣款） */
  createdBy: z.number().int().nullable(),
});

export const transactionViewSchema = transactionSchema.extend({
  /** 記帳當下的分類名稱快照；分類日後改名不改動歷史紀錄 */
  mainCategoryName: z.string().nullable(),
  subCategoryName: z.string().nullable(),
  payerName: z.string(),
  createdByName: z.string().nullable(),
});

export const transactionRevisionSchema = z.object({
  id: z.number().int(),
  transactionId: z.number().int(),
  editedBy: z.number().int(),
  editedAt: z.string(),
  field: z.string(),
  before: z.string(),
  after: z.string(),
});

export const budgetSchema = z.object({
  id: z.number().int(),
  month: z.string(),
  mainCategoryId: z.number().int(),
  amount: z.number().int(),
});

export const subscriptionSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  amount: z.number().int(),
  cycle: billingCycleSchema,
  nextChargeDate: z.string(),
  /** 原本的扣款日（1–31）；遇月底不足時下次推算的錨點 */
  chargeDay: z.number().int().min(1).max(31),
  mainCategoryId: z.number().int(),
  payerId: z.number().int(),
  isActive: z.boolean(),
});

export const subscriptionRevisionSchema = z.object({
  id: z.number().int(),
  subscriptionId: z.number().int(),
  effectiveFrom: z.string(),
  amount: z.number().int(),
  cycle: billingCycleSchema,
});

export const yearExtraExpenseSchema = z.object({
  id: z.number().int(),
  year: z.number().int(),
  name: z.string(),
  amount: z.number().int(),
  mainCategoryId: z.number().int(),
  payerId: z.number().int(),
});

/* ── 請求 payload ───────────────────────────────────── */

export const loginBodySchema = z.object({
  account: accountSchema,
  /** 密碼不做去空白處理（specs/01-登入頁.md 規則 7）。 */
  password: z.string().min(1, "請輸入密碼"),
});

export const resetPasswordBodySchema = z
  .object({
    account: accountSchema,
    code: resetCodeSchema,
    newPassword: passwordSchema,
  })
  .strict();

export const transactionDraftSchema = z.object({
  type: txTypeSchema,
  mainCategoryId: z.number().int().positive().nullable(),
  subCategoryId: z.number().int().positive().nullable(),
  amount: amountSchema,
  /** 可為未來日期（預定支出） */
  date: dateSchema,
  note: z.string().max(100).optional(),
  /** 記帳者；省略＝登入者本人。指定他人僅限管理者，且須為啟用中的成員。 */
  payerId: z.number().int().positive().optional(),
});

/**
 * 可修改欄位：金額、日期、分類、備註、記帳者；收支別不可改（specs/05-交易列表頁.md 規則 5、6）。
 * 記帳者僅管理者可改，訂閱產生的交易與個人帳交易不可改。
 */
export const transactionPatchSchema = z
  .object({
    mainCategoryId: z.number().int().positive().nullable(),
    subCategoryId: z.number().int().positive().nullable(),
    amount: amountSchema,
    date: dateSchema,
    note: z.string().max(100).nullable(),
    payerId: z.number().int().positive(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "沒有要修改的欄位");

export const transactionQuerySchema = z.object({
  month: monthSchema.optional(),
  type: z.enum(["all", "expense", "income"]).default("all"),
  mainCategoryId: idSchema.nullish(),
  payerId: idSchema.nullish(),
  /** 僅搜尋備註（specs/05-交易列表頁.md 規則 9）。 */
  keyword: z.string().trim().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  /** 每頁固定 20 筆，使用者不可調整（規則 7）；此處僅供內部呼叫。 */
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const memberDraftSchema = z.object({
  name: z.string().trim().min(1, "請輸入名稱").max(20),
  account: accountSchema,
  /** 成員憑此於重設密碼頁自設密碼；管理者不設定密碼。 */
  initialCode: resetCodeSchema,
  role: roleSchema,
  color: hexColorSchema,
});

export const memberPatchSchema = memberDraftSchema
  .omit({ initialCode: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "沒有要修改的欄位");

export const mainCategoryDraftSchema = z
  .object({
    name: z.string().trim().min(1, "請輸入名稱").max(20),
    icon: z.string().min(1),
    type: txTypeSchema,
    nature: categoryNatureSchema.nullable(),
  })
  .refine((v) => (v.type === "income" ? v.nature === null : v.nature !== null), {
    message: "支出分類須指定浮動或固定；收入分類不得有性質",
    path: ["nature"],
  });

export const mainCategoryPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(20),
    icon: z.string().min(1),
    /** 收支別與性質建立後不可修改，避免歷史統計錯位。 */
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "沒有要修改的欄位");

export const subscriptionDraftSchema = z.object({
  name: z.string().trim().min(1, "請輸入名稱").max(30),
  amount: amountSchema,
  cycle: billingCycleSchema,
  nextChargeDate: dateSchema,
  // 不接受 mainCategoryId：訂閱一律歸屬系統分類「訂閱」，由後端填入
  payerId: z.number().int().positive(),
});

export const subscriptionPatchSchema = subscriptionDraftSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "沒有要修改的欄位");

export const budgetUpsertSchema = z.object({
  month: monthSchema,
  mainCategoryId: z.number().int().positive(),
  /** 0 表示清除預算設定。 */
  amount: z.number().int().min(0),
});

export const yearExtraDraftSchema = z.object({
  year: yearSchema,
  name: z.string().trim().min(1, "請輸入名稱").max(30),
  amount: amountSchema,
  mainCategoryId: z.number().int().positive(),
  payerId: z.number().int().positive(),
});

export const statsQuerySchema = z.object({
  range: z.enum(["month", "year"]).default("month"),
  /** month=YYYY-MM；year=YYYY */
  period: z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, "期間格式錯誤"),
  payerId: idSchema.nullish(),
});

export const setActiveSchema = z.object({ isActive: z.boolean() });
export const reorderSchema = z.object({ orderedIds: z.array(z.number().int().positive()).min(1) });
export const subNameSchema = z.object({ name: z.string().trim().min(1, "請輸入名稱").max(20) });

export const apiErrorSchema = z.object({ code: z.string(), message: z.string() });
