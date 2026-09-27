import { and, desc, eq, gte, lt } from "drizzle-orm";
import type { CategoryProgress, DashboardPayload, MonthSummary } from "@family-ledger/shared";
import { db } from "../db/index.js";
import { budgets, transactions } from "../db/schema.js";
import { existsInMonth, monthRange } from "../lib/dates.js";
import { listCategories } from "./categories.js";
import { fixedTotal } from "./fixed.js";
import {
  intSum,
  notFuture,
  onlyFuture,
  recentByCategory,
  toView,
  transactionViewQuery,
} from "./views.js";

const RECENT_PER_CATEGORY = 3;
const RECENT_OVERALL = 8;

/** 儀表板單頁需跨 4 張表，後端一次算完回傳，前端不再組合。 */
export async function buildDashboard(month: string): Promise<DashboardPayload> {
  const { start, end } = monthRange(month);
  const inMonth = and(eq(transactions.isDeleted, false), gte(transactions.date, start), lt(transactions.date, end));

  // 彙總只算日期已到的；未來日期另外統計為「已排定」
  const settled = and(inMonth, notFuture());
  const scheduled = and(inMonth, onlyFuture());

  const [totals, byCategory, scheduledByCategory, scheduledTotal, monthBudgets, categories, fixed, recentRows] =
    await Promise.all([
      db
        .select({ type: transactions.type, amount: intSum(transactions.amount) })
        .from(transactions)
        .where(settled)
        .groupBy(transactions.type),
      db
        .select({ mainCategoryId: transactions.mainCategoryId, amount: intSum(transactions.amount) })
        .from(transactions)
        .where(and(settled, eq(transactions.type, "expense")))
        .groupBy(transactions.mainCategoryId),
      db
        .select({ mainCategoryId: transactions.mainCategoryId, amount: intSum(transactions.amount) })
        .from(transactions)
        .where(and(scheduled, eq(transactions.type, "expense")))
        .groupBy(transactions.mainCategoryId),
      db
        .select({ amount: intSum(transactions.amount) })
        .from(transactions)
        .where(and(scheduled, eq(transactions.type, "expense"))),
      db.select().from(budgets).where(eq(budgets.month, month)),
      listCategories(true),
      fixedTotal(month),
      // 最近交易仍包含預定支出，讓使用者看得到自己排了什麼
      transactionViewQuery()
        .where(inMonth)
        .orderBy(desc(transactions.date), desc(transactions.id))
        .limit(RECENT_OVERALL),
    ]);

  const income = totals.find((t) => t.type === "income")?.amount ?? 0;
  const expense = totals.find((t) => t.type === "expense")?.amount ?? 0;
  const summary: MonthSummary = {
    month,
    income,
    expense,
    net: income - expense,
    fixedTotal: fixed,
    scheduledExpense: scheduledTotal[0]?.amount ?? 0,
  };

  const spentMap = new Map(byCategory.map((r) => [r.mainCategoryId, r.amount]));
  const scheduledMap = new Map(scheduledByCategory.map((r) => [r.mainCategoryId, r.amount]));
  const budgetMap = new Map(monthBudgets.map((b) => [b.mainCategoryId, b.amount]));

  /** 只列該月存在的浮動支出分類；已停用分類在未來月份不出現，不以 0 呈現。 */
  const visible = categories.filter(
    (c) => c.type === "expense" && c.nature === "floating" && existsInMonth(c, month)
  );

  const progress: CategoryProgress[] = await Promise.all(
    visible.map(async (c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      budget: budgetMap.get(c.id) ?? null,
      spent: spentMap.get(c.id) ?? 0,
      scheduled: scheduledMap.get(c.id) ?? 0,
      recent: await recentByCategory(c.id, start, end, RECENT_PER_CATEGORY),
    }))
  );

  return { summary, categories: progress, recent: recentRows.map(toView) };
}
