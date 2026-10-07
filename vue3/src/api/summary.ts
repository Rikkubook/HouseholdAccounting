import { http } from "./client";
import type { CategoryProgress, MonthSummary, TransactionView, YearExtraExpense } from "@/types/models";

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
  /** null 表示未設預算 */
  budget: number | null;
  subs: { subCategoryId: number; name: string; amount: number }[];
}

export interface StatsPayload {
  range: "month" | "year";
  /** month=YYYY-MM；year=YYYY */
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
  /** 12 欄：每月收入、支出、結餘（不含年度額外開銷）；該月沒有交易為 null */
  monthly: ({ income: number; expense: number; net: number } | null)[];
  rows: YearCategoryRow[];
  extras: (YearExtraExpense & { categoryName: string; payerName: string })[];
}

export const summaryApi = {
  dashboard: (month: string) =>
    http.get<DashboardPayload>("/summary/dashboard", { params: { month } }).then((r) => r.data),

  stats: (range: "month" | "year", period: string, payerId?: number | null) =>
    http.get<StatsPayload>("/summary/stats", { params: { range, period, payerId } }).then((r) => r.data),

  year: (year: number) =>
    http.get<YearSummaryPayload>("/summary/year", { params: { year } }).then((r) => r.data),

  createYearExtra: (draft: Omit<YearExtraExpense, "id">) =>
    http.post<YearExtraExpense>("/summary/year-extras", draft).then((r) => r.data),

  removeYearExtra: (id: number) =>
    http.delete<void>("/summary/year-extras/" + id).then((r) => r.data),
};
