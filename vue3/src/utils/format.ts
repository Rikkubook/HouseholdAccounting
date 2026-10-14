/** 全站金額格式：整數、千分位、不縮寫（不使用 k）。 */
export function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export function percent(value: number, total: number, digits = 1): string {
  if (!total) return "0" + (digits ? "." + "0".repeat(digits) : "") + "%";
  return ((value / total) * 100).toFixed(digits) + "%";
}

/** 預算狀態：<70% ok、>=70% near、>=100% over。未設預算為 none。 */
export type BudgetState = "none" | "ok" | "near" | "over";

export function budgetState(spent: number, budget: number | null, threshold = 70): BudgetState {
  if (!budget) return "none";
  const pct = (spent / budget) * 100;
  if (pct >= 100) return "over";
  if (pct >= threshold) return "near";
  return "ok";
}

export function shortDate(iso: string): string {
  return iso.slice(5).replace("-", "/");
}

export function weekdayLabel(iso: string): string {
  const w = ["日", "一", "二", "三", "四", "五", "六"][new Date(iso + "T00:00:00").getDay()];
  return shortDate(iso) + "（" + w + "）";
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return y + " 年 " + Number(m) + " 月";
}

/** en-CA 的日期格式剛好是 YYYY-MM-DD；一律以台灣時間判斷，對齊後端 api/src/lib/dates.ts 的 today。 */
const dateInTaipei = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 今天（YYYY-MM-DD，台灣時間）。原本用 toISOString 是 UTC，台灣凌晨 0～8 點會變成前一天。 */
export function todayISO(): string {
  return dateInTaipei.format(new Date());
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

/** 分類在該月是否存在（對齊後端 api/src/lib/dates.ts 的 existsInMonth）。 */
export function existsInMonth(
  category: { activeFrom: string | null; archivedFrom: string | null },
  month: string
): boolean {
  if (category.activeFrom && month < category.activeFrom) return false;
  if (category.archivedFrom && month >= category.archivedFrom) return false;
  return true;
}

/** 訂閱月換算：年繳除以 12。 */
export function monthlyEquivalent(amount: number, cycle: "monthly" | "yearly"): number {
  return cycle === "yearly" ? Math.round(amount / 12) : amount;
}

/** 依週期推算下次扣款日（對齊後端 advanceChargeDate）：月底不足夾到最後一天，下一個大月回到原日。 */
export function advanceChargeDate(date: string, cycle: "monthly" | "yearly", anchorDay?: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const day = anchorDay ?? Number(date.slice(8, 10));
  const targetY = cycle === "yearly" ? y + 1 : m === 12 ? y + 1 : y;
  const targetM = cycle === "yearly" ? m : m === 12 ? 1 : m + 1;
  const lastDay = new Date(Date.UTC(targetY, targetM, 0)).getUTCDate();
  return targetY + "-" + String(targetM).padStart(2, "0") + "-" + String(Math.min(day, lastDay)).padStart(2, "0");
}

/**
 * 年繳分攤（docs/requirements G-6，對齊後端 api/src/lib/dates.ts，兩邊要一起改）：
 * 年費拆 12 期，自扣款月起每月一期；index 0 = 第 1 期（實際年繳扣款那個月）。
 */
export const INSTALLMENTS = 12;

export function installmentIndex(chargeDate: string, chargeMonth: number): number {
  return (Number(chargeDate.slice(5, 7)) - chargeMonth + 12) % 12;
}

/** 每期 = 年費 ÷ 12 取整數，餘數放在最後一期。 */
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

/** 訂閱頁顯示的「下次扣款日」：年繳顯示實際年繳日，月繳就是 nextChargeDate。 */
export function displayChargeDate(sub: {
  cycle: "monthly" | "yearly";
  nextChargeDate: string;
  chargeMonth: number | null;
  chargeDay: number;
}): string {
  return sub.cycle === "yearly" && sub.chargeMonth != null
    ? nextAnnualChargeDate(sub.nextChargeDate, sub.chargeMonth, sub.chargeDay)
    : sub.nextChargeDate;
}

/** 年繳本期已分攤幾期（1–11）；尚未開始或不是年繳為 null。 */
export function installmentsPaid(sub: { cycle: "monthly" | "yearly"; nextChargeDate: string; chargeMonth: number | null }): number | null {
  if (sub.cycle !== "yearly" || sub.chargeMonth == null) return null;
  return installmentIndex(sub.nextChargeDate, sub.chargeMonth) || null;
}
