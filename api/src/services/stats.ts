import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { StatsPayload, StatsRow } from "@family-ledger/shared";
import { db } from "../db/index.js";
import { budgets, transactions } from "../db/schema.js";
import { addMonths, existsInMonth, monthRange, yearRange } from "../lib/dates.js";
import { listCategories } from "./categories.js";
import { budgetScope, txScope } from "./scope.js";
import { effectiveSubscriptions } from "./fixed.js";
import { intSum, notFuture } from "./views.js";

/** month=YYYY-MM 取單月；year=YYYY 取整年 12 個月。 */
export async function buildStats(
  range: "month" | "year",
  period: string,
  payerId?: number | null
): Promise<StatsPayload> {
  const isYear = range === "year";
  const { start, end } = isYear ? yearRange(Number(period)) : monthRange(period);
  const months = isYear
    ? Array.from({ length: 12 }, (_, i) => period + "-" + String(i + 1).padStart(2, "0"))
    : [period];

  const where = and(
    eq(transactions.isDeleted, false),
    txScope(),
    eq(transactions.type, "expense"),
    gte(transactions.date, start),
    lt(transactions.date, end),
    // 未來日期不計入統計
    notFuture(),
    payerId ? eq(transactions.payerId, payerId) : undefined
  );

  const [rows, categories, budgetRows, ...fixedByMonth] = await Promise.all([
    db
      .select({
        mainCategoryId: transactions.mainCategoryId,
        subCategoryId: transactions.subCategoryId,
        amount: intSum(transactions.amount),
      })
      .from(transactions)
      .where(where)
      .groupBy(transactions.mainCategoryId, transactions.subCategoryId),
    listCategories(true),
    db.select().from(budgets).where(and(inArray(budgets.month, months), budgetScope())),
    ...months.map((m) => effectiveSubscriptions(m)),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const subName = new Map(categories.flatMap((c) => c.subCategories.map((s) => [s.id, s.name] as const)));

  /** 預算只累加分類存在的月份（specs/00）。 */
  const budgetTotals = new Map<number, number>();
  for (const b of budgetRows) {
    const cat = catMap.get(b.mainCategoryId);
    if (!cat || !existsInMonth(cat, b.month)) continue;
    budgetTotals.set(b.mainCategoryId, (budgetTotals.get(b.mainCategoryId) ?? 0) + b.amount);
  }

  const grouped = new Map<number, StatsRow>();
  for (const r of rows) {
    if (r.mainCategoryId == null) continue;
    const cat = catMap.get(r.mainCategoryId);
    if (!cat || cat.nature !== "floating") continue;

    let row = grouped.get(r.mainCategoryId);
    if (!row) {
      row = {
        mainCategoryId: cat.id,
        name: cat.name,
        icon: cat.icon,
        amount: 0,
        budget: budgetTotals.get(cat.id) ?? null,
        subs: [],
      };
      grouped.set(cat.id, row);
    }
    row.amount += r.amount;
    if (r.subCategoryId != null) {
      row.subs.push({
        subCategoryId: r.subCategoryId,
        name: subName.get(r.subCategoryId) ?? "未分類",
        amount: r.amount,
      });
    }
  }

  const floating = [...grouped.values()].sort((a, b) => b.amount - a.amount);
  for (const row of floating) row.subs.sort((a, b) => b.amount - a.amount);

  // 固定支出：逐月取當時生效版本再加總，避免用「現在的金額」回推過去
  const fixedTotals = new Map<string, number>();
  for (const list of fixedByMonth) {
    for (const s of list) {
      if (payerId && s.payerId !== payerId) continue;
      fixedTotals.set(s.name, (fixedTotals.get(s.name) ?? 0) + s.monthly);
    }
  }
  const fixed = [...fixedTotals.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const total =
    floating.reduce((sum, r) => sum + r.amount, 0) + fixed.reduce((sum, r) => sum + r.amount, 0);

  return { range, period, floating, fixed, total };
}

/** 統計頁的月份下拉需要「有資料的最早月份」。 */
export async function earliestMonth(): Promise<string | null> {
  const [row] = await db
    .select({ month: sql<string | null>`min(to_char(${transactions.date}, 'YYYY-MM'))` })
    .from(transactions)
    .where(and(eq(transactions.isDeleted, false), txScope()));
  return row?.month ?? null;
}

export const nextMonth = addMonths;
