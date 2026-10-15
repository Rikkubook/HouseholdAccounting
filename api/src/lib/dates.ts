/** 月份／日期一律以字串處理，避免時區位移。month = YYYY-MM，date = YYYY-MM-DD。 */

export const monthOf = (date: string): string => date.slice(0, 7);
export const yearOf = (value: string): number => Number(value.slice(0, 4));

/**
 * 「今天」一律以台灣時間判斷，不看伺服器時區：Vercel 跑在 UTC，
 * 台灣凌晨 0～8 點會被當成前一天，訂閱扣款就會晚一天產生。
 * 前端 vue3/src/utils/format.ts 的 todayISO 同樣以台灣時間判斷。
 */
export const APP_TIME_ZONE = "Asia/Taipei";

/** en-CA 的日期格式剛好是 YYYY-MM-DD */
const dateInAppZone = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 今天（YYYY-MM-DD，台灣時間）。 */
export function today(): string {
  return dateInAppZone.format(new Date());
}

/** 本月（YYYY-MM，台灣時間）。 */
export function currentMonth(): string {
  return today().slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + delta;
  const year = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return year + "-" + String(mm + 1).padStart(2, "0");
}

export const prevMonth = (month: string) => addMonths(month, -1);

/** 半開區間 [start, end)，供 date 欄位的 gte / lt 比較。 */
export function monthRange(month: string): { start: string; end: string } {
  return { start: month + "-01", end: addMonths(month, 1) + "-01" };
}

export function yearRange(year: number): { start: string; end: string } {
  return { start: year + "-01-01", end: year + 1 + "-01-01" };
}

/**
 * 依週期推算下次扣款日。anchorDay 是訂閱原本的扣款日期（1–31）：
 * 遇月底不足只在該月夾到最後一天，下一個足月份會回到原日——
 * 1/31 → 2/28 → 3/31，不會逐月往前漂。
 */
export function advanceChargeDate(
  date: string,
  cycle: "monthly" | "yearly",
  anchorDay?: number
): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const day = anchorDay ?? Number(date.slice(8, 10));

  const targetY = cycle === "yearly" ? y + 1 : m === 12 ? y + 1 : y;
  const targetM = cycle === "yearly" ? m : m === 12 ? 1 : m + 1;
  const lastDay = new Date(Date.UTC(targetY, targetM, 0)).getUTCDate();

  return (
    targetY +
    "-" +
    String(targetM).padStart(2, "0") +
    "-" +
    String(Math.min(day, lastDay)).padStart(2, "0")
  );
}

/**
 * 年繳分攤（docs/requirements G-6）：年費拆成 12 期，自扣款月起每月一期。
 * 第幾期由「分攤日所在月份」與「年繳扣款月」的差推算，0 = 第 1 期（實際年繳扣款那個月）。
 * 前端 vue3/src/utils/format.ts 有同一份實作，兩邊要一起改。
 */
export const INSTALLMENTS = 12;

export function installmentIndex(chargeDate: string, chargeMonth: number): number {
  return (Number(chargeDate.slice(5, 7)) - chargeMonth + 12) % 12;
}

/** 每期 = 年費 ÷ 12 取整數，除不盡的差額放在最後一期，12 期合計等於年費。 */
export function installmentAmount(periodAmount: number, index: number): number {
  const base = Math.floor(periodAmount / INSTALLMENTS);
  return index === INSTALLMENTS - 1 ? periodAmount - base * (INSTALLMENTS - 1) : base;
}

/** 下一次實際年繳扣款日：還沒開始本期分攤時就是 nextChargeDate，否則是本期結束後的扣款月。 */
export function nextAnnualChargeDate(nextChargeDate: string, chargeMonth: number, chargeDay: number): string {
  if (installmentIndex(nextChargeDate, chargeMonth) === 0) return nextChargeDate;
  const y = Number(nextChargeDate.slice(0, 4));
  const m = Number(nextChargeDate.slice(5, 7));
  const targetY = m > chargeMonth ? y + 1 : y;
  const lastDay = new Date(Date.UTC(targetY, chargeMonth, 0)).getUTCDate();
  return targetY + "-" + String(chargeMonth).padStart(2, "0") + "-" + String(Math.min(chargeDay, lastDay)).padStart(2, "0");
}

/** 年繳換算為月攤提，四捨五入到元。 */
export const monthlyEquivalent = (amount: number, cycle: "monthly" | "yearly") =>
  cycle === "yearly" ? Math.round(amount / 12) : amount;

export const toIso = (value: Date | string | null): string =>
  value == null ? "" : value instanceof Date ? value.toISOString() : value;

/** 分類在該月份是否存在（specs/00：預算與預測只計算分類存在的月份）。 */
export function existsInMonth(
  category: { activeFrom: string | null; archivedFrom: string | null },
  month: string
): boolean {
  if (category.activeFrom && month < category.activeFrom) return false;
  if (category.archivedFrom && month >= category.archivedFrom) return false;
  return true;
}
