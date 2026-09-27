import { http } from "./client";
import type { Budget } from "@/types/models";

export const budgetsApi = {
  /** 浮動支出分類的當月上限；固定支出由訂閱自動推算，不在此清單。 */
  byMonth: (month: string) =>
    http.get<Budget[]>("/budgets", { params: { month } }).then((r) => r.data),

  upsert: (month: string, mainCategoryId: number, amount: number) =>
    http.put<Budget>("/budgets", { month, mainCategoryId, amount }).then((r) => r.data),

  /** 沿用上月：只複製有設定的分類。 */
  copyFromPreviousMonth: (month: string) =>
    http.post<Budget[]>("/budgets/copy-previous", { month }).then((r) => r.data),

  /** 固定支出總額（由訂閱月換算，年繳 ÷12）。 */
  fixedTotal: (month: string) =>
    http.get<{ month: string; amount: number }>("/budgets/fixed-total", { params: { month } }).then((r) => r.data),
};
