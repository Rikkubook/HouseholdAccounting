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

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
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

export function advanceCharge(date: string, cycle: "monthly" | "yearly"): string {
  const d = new Date(date + "T00:00:00");
  if (cycle === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
