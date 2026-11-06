import type { YearSummaryPayload } from "@/api/summary";

export interface ReconcileRow {
  /** 1～12 */
  month: number;
  /** 1 月到上個月的月結餘合計（1 月為 0） */
  priorNet: number;
  /** 本月收入；該月沒有交易為 0 */
  income: number;
  /** 月初戶頭應有＝priorNet − 年度額外開銷＋本月收入 */
  expected: number;
}

/**
 * 家庭戶頭對帳：N 月的月初戶頭應有
 *   ＝ 1～(N−1) 月的月結餘（收入 − 支出，不含年度額外開銷）
 *   − 該年度的年度額外開銷（沒有日期，記了就算已付出）
 *   ＋ N 月收入
 * 年初戶頭原有的錢由使用者記成 1 月收入，所以不另設期初餘額。
 * 例：11 月＝1～10 月月結餘 − 額外開銷＋11 月收入，應等於戶頭帳面金額。
 *
 * lastMonth：算到第幾個月（今年＝本月，往年＝12），之後的月份還沒發生不列出。
 */
export function buildReconcileRows(
  monthly: YearSummaryPayload["monthly"],
  extrasTotal: number,
  lastMonth: number
): ReconcileRow[] {
  const rows: ReconcileRow[] = [];
  let priorNet = 0;
  for (let i = 0; i < lastMonth; i++) {
    const income = monthly[i]?.income ?? 0;
    rows.push({ month: i + 1, priorNet, income, expected: priorNet - extrasTotal + income });
    priorNet += monthly[i]?.net ?? 0;
  }
  return rows;
}
