import type { z } from "zod";
import type * as s from "./schema.js";

/**
 * 全部由 Zod schema 推導，與 vue3/src/types/models.ts 逐欄位等價。
 * 前端接上 workspace 後，models.ts 可改為 `export type { Member, ... } from "@family-ledger/shared"`。
 */

export type Role = z.infer<typeof s.roleSchema>;
export type TxType = z.infer<typeof s.txTypeSchema>;
export type CategoryNature = z.infer<typeof s.categoryNatureSchema>;
export type BillingCycle = z.infer<typeof s.billingCycleSchema>;
export type ScopeName = z.infer<typeof s.scopeSchema>;

export type Member = z.infer<typeof s.memberSchema>;
export type SubCategory = z.infer<typeof s.subCategorySchema>;
export type MainCategory = z.infer<typeof s.mainCategorySchema>;
export type Transaction = z.infer<typeof s.transactionSchema>;
export type TransactionView = z.infer<typeof s.transactionViewSchema>;
export type TransactionRevision = z.infer<typeof s.transactionRevisionSchema>;
export type Budget = z.infer<typeof s.budgetSchema>;
export type Subscription = z.infer<typeof s.subscriptionSchema>;
export type SubscriptionRevision = z.infer<typeof s.subscriptionRevisionSchema>;
export type YearExtraExpense = z.infer<typeof s.yearExtraExpenseSchema>;

export type TransactionDraft = z.infer<typeof s.transactionDraftSchema>;
export type TransactionPatch = z.infer<typeof s.transactionPatchSchema>;
export type TransactionQuery = z.infer<typeof s.transactionQuerySchema>;
export type MemberDraft = z.infer<typeof s.memberDraftSchema>;
export type MainCategoryDraft = z.infer<typeof s.mainCategoryDraftSchema>;
export type SubscriptionDraft = z.infer<typeof s.subscriptionDraftSchema>;
export type YearExtraDraft = z.infer<typeof s.yearExtraDraftSchema>;

export type ApiError = z.infer<typeof s.apiErrorSchema>;

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LoginResponse {
  token: string;
  /** token 有效期（秒）；自首次登入起固定 6 個月，不續期 */
  expiresIn: number;
  user: Member;
}

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  net: number;
  fixedTotal: number;
  /** 已排定但日期未到的支出，不含在 expense 內 */
  scheduledExpense: number;
}

export interface CategoryProgress {
  id: number;
  name: string;
  icon: string;
  /** null 表示該月未設預算 */
  budget: number | null;
  spent: number;
  /** 已排定但日期未到的金額，不含在 spent 內 */
  scheduled: number;
  recent: TransactionView[];
}

export interface DashboardPayload {
  summary: MonthSummary;
  categories: CategoryProgress[];
  recent: TransactionView[];
}

export interface StatsRow {
  mainCategoryId: number;
  name: string;
  icon: string;
  amount: number;
  budget: number | null;
  subs: { subCategoryId: number; name: string; amount: number }[];
}

export interface StatsPayload {
  range: "month" | "year";
  period: string;
  floating: StatsRow[];
  fixed: { name: string; amount: number }[];
  total: number;
}

export interface YearCategoryRow {
  mainCategoryId: number;
  name: string;
  icon: string;
  /** 12 欄；null = 分類當時不存在或該月尚未記錄 */
  months: (number | null)[];
  extra: number | null;
  total: number;
  planned: number | null;
  monthlyBudget: number;
  /** 該年度存在的月份區間（0-indexed，endMonth 為排他） */
  startMonth: number;
  endMonth: number;
}

export interface YearSummaryPayload {
  year: number;
  income: number;
  expense: number;
  net: number;
  recordedMonths: number;
  rows: YearCategoryRow[];
  extras: (YearExtraExpense & { categoryName: string; payerName: string })[];
  byMember: { memberId: number; name: string; amount: number; count: number }[];
}
