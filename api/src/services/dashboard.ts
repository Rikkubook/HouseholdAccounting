import { and, desc, eq, gte, lt } from "drizzle-orm";
import type { CategoryProgress, DashboardPayload, MonthSummary, TransactionView } from "@family-ledger/shared";
import { db } from "../db/index.js";
import { budgets, transactions } from "../db/schema.js";
import { existsInMonth, monthRange } from "../lib/dates.js";
import { timed } from "../lib/timed.js";
import { listCategories } from "./categories.js";
import { budgetScope, FAMILY, txScope, type Scope } from "./scope.js";
import { fixedTotal } from "./fixed.js";
import { intSum, notFuture, onlyFuture, toView, transactionViewQuery } from "./views.js";

const RECENT_PER_CATEGORY = 3;
const RECENT_OVERALL = 8;

/** 儀表板單頁需跨 4 張表，後端一次算完回傳，前端不再組合。 */
export async function buildDashboard(month: string, scope: Scope = FAMILY): Promise<DashboardPayload> {
  const { start, end } = monthRange(month);
  const inMonth = and(
    eq(transactions.isDeleted, false),
    txScope(scope),
    gte(transactions.date, start),
    lt(transactions.date, end)
  );

  // 彙總只算日期已到的；未來日期另外統計為「已排定」
  const settled = and(inMonth, notFuture());
  const scheduled = and(inMonth, onlyFuture());

  const [totals, byCategory, scheduledByCategory, scheduledTotal, monthBudgets, categories, fixed, monthRows] =
    await Promise.all([
      timed(
        "dashboard.totals",
        db
          .select({ type: transactions.type, amount: intSum(transactions.amount) })
          .from(transactions)
          .where(settled)
          .groupBy(transactions.type)
      ),
      timed(
        "dashboard.byCategory",
        db
          .select({ mainCategoryId: transactions.mainCategoryId, amount: intSum(transactions.amount) })
          .from(transactions)
          .where(and(settled, eq(transactions.type, "expense")))
          .groupBy(transactions.mainCategoryId)
      ),
      timed(
        "dashboard.scheduledByCategory",
        db
          .select({ mainCategoryId: transactions.mainCategoryId, amount: intSum(transactions.amount) })
          .from(transactions)
          .where(and(scheduled, eq(transactions.type, "expense")))
          .groupBy(transactions.mainCategoryId)
      ),
      timed(
        "dashboard.scheduledTotal",
        db
          .select({ amount: intSum(transactions.amount) })
          .from(transactions)
          .where(and(scheduled, eq(transactions.type, "expense")))
      ),
      timed("dashboard.monthBudgets", db.select().from(budgets).where(and(eq(budgets.month, month), budgetScope(scope)))),
      // 第 1 批的個人交易沿用家庭分類，分類清單一律取家庭的；預算則依範圍（個人帳尚無預算）
      timed("dashboard.categories", listCategories(true)),
      timed("dashboard.fixedTotal", fixedTotal(month, scope)),
      /**
       * 一次抓整月交易（含預定支出），下面同時導出「整體最近交易」與
       * 「各分類最近交易」，不再對每個分類各發一支查詢。家用記帳單月
       * 交易量很小，一次抓全部比分開查詢便宜很多——原本每個分類各一支
       * 查詢，加上這裡原本就有的 6～7 支，單次首頁載入平行查詢數會超過
       * 連線池上限（max: 5），多出來的查詢要排隊，才會不時卡到逾時。
       */
      timed(
        "dashboard.monthRows",
        transactionViewQuery().where(inMonth).orderBy(desc(transactions.date), desc(transactions.id))
      ),
    ]);
  const recentRows = monthRows.slice(0, RECENT_OVERALL);

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

  /** monthRows 已依日期新到舊排序，逐筆分桶即為各分類的「最近交易」。 */
  const recentByCategoryMap = new Map<number, TransactionView[]>();
  for (const row of monthRows) {
    const view = toView(row);
    if (view.mainCategoryId == null) continue;
    const list = recentByCategoryMap.get(view.mainCategoryId) ?? [];
    if (list.length < RECENT_PER_CATEGORY) list.push(view);
    recentByCategoryMap.set(view.mainCategoryId, list);
  }

  const progress: CategoryProgress[] = visible.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    budget: budgetMap.get(c.id) ?? null,
    spent: spentMap.get(c.id) ?? 0,
    scheduled: scheduledMap.get(c.id) ?? 0,
    recent: recentByCategoryMap.get(c.id) ?? [],
  }));

  return { summary, categories: progress, recent: recentRows.map(toView) };
}
