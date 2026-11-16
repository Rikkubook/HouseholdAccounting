import type { YearSummaryPayload } from "@/api/summary";

export interface ReconcileRow {
  /** 1～12 */
  month: number;
  /** 1 月到上個月的月結餘合計（收入 − 支出，不含年度額外開銷；1 月為 0） */
  priorNet: number;
  /** 1 月到上個月的投資合計（買股票等，錢離開戶頭但不算支出） */
  priorInvestment: number;
  /** 1 月到上個月付款的年度額外開銷合計 */
  priorExtras: number;
  /** 本月收入；該月沒有交易為 0 */
  income: number;
  /** 月初戶頭應有＝priorNet − priorInvestment − priorExtras＋本月收入 */
  expected: number;
}

/** 年度額外開銷的付款月份（1～12）；未填日期當作該年 1 月 */
export const extraPaidMonth = (extra: { paidOn: string | null }) =>
  extra.paidOn ? Number(extra.paidOn.slice(5, 7)) : 1;

/**
 * 家庭戶頭對帳：N 月的月初戶頭應有
 *   ＝ 1～(N−1) 月的月結餘（收入 − 支出）
 *   − 1～(N−1) 月的投資（月結餘沒扣投資，但錢已經從戶頭轉去買股票）
 *   − 1～(N−1) 月付款的年度額外開銷（依付款日期；未填日期當作 1 月）
 *   ＋ N 月收入
 * 月初是 1 號，當月付款的額外開銷那時還沒付出去，所以從下個月的月初起才扣。
 * 年初戶頭原有的錢由使用者記成 1 月收入，所以不另設期初餘額。
 * 例：11/5 付了 30,000 → 11 月月初不扣、12 月月初起扣。投資同理：11/5 買股票 25,000 → 12 月月初起扣。
 *
 * lastMonth：算到第幾個月（今年＝本月，往年＝12），之後的月份還沒發生不列出。
 */
export function buildReconcileRows(
  monthly: YearSummaryPayload["monthly"],
  extras: { amount: number; paidOn: string | null }[],
  lastMonth: number
): ReconcileRow[] {
  const extrasByMonth = Array.from({ length: 12 }, () => 0);
  for (const e of extras) extrasByMonth[extraPaidMonth(e) - 1]! += e.amount;

  const rows: ReconcileRow[] = [];
  let priorNet = 0;
  let priorInvestment = 0;
  let priorExtras = 0;
  for (let i = 0; i < lastMonth; i++) {
    const income = monthly[i]?.income ?? 0;
    rows.push({
      month: i + 1,
      priorNet,
      priorInvestment,
      priorExtras,
      income,
      expected: priorNet - priorInvestment - priorExtras + income,
    });
    priorNet += monthly[i]?.net ?? 0;
    priorInvestment += monthly[i]?.investment ?? 0;
    priorExtras += extrasByMonth[i]!;
  }
  return rows;
}
