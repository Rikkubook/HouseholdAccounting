import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { YearCategoryRow, YearSummaryPayload } from "@family-ledger/shared";
import { db } from "../db/index.js";
import { budgets, mainCategories, members, transactions, yearExtraExpenses } from "../db/schema.js";
import { currentMonth, existsInMonth, yearRange } from "../lib/dates.js";
import { timed } from "../lib/timed.js";
import { listCategories } from "./categories.js";
import { budgetScope, txScope, yearExtraScope } from "./scope.js";
import { intSum, notFuture } from "./views.js";

/** 年度額外支出不分攤到個別月份，只計入 extra 與 total。 */
export async function buildYearSummary(year: number): Promise<YearSummaryPayload> {
  const { start, end } = yearRange(year);
  const months = Array.from({ length: 12 }, (_, i) => year + "-" + String(i + 1).padStart(2, "0"));
  const inYear = and(
    eq(transactions.isDeleted, false),
    txScope(),
    gte(transactions.date, start),
    lt(transactions.date, end),
    // 未來日期不計入年度彙整
    notFuture()
  );

  const monthExpr = sql<string>`to_char(${transactions.date}, 'YYYY-MM')`;

  const [byCatMonth, totals, monthsWithData, budgetRows, categories, extras, byTypeMonth] =
    await Promise.all([
      timed(
        "year.byCatMonth",
        db
          .select({
            mainCategoryId: transactions.mainCategoryId,
            month: monthExpr,
            amount: intSum(transactions.amount),
          })
          .from(transactions)
          .where(and(inYear, eq(transactions.type, "expense")))
          .groupBy(transactions.mainCategoryId, monthExpr)
      ),
      timed(
        "year.totals",
        db
          .select({ type: transactions.type, amount: intSum(transactions.amount) })
          .from(transactions)
          .where(inYear)
          .groupBy(transactions.type)
      ),
      timed("year.monthsWithData", db.selectDistinct({ month: monthExpr }).from(transactions).where(inYear)),
      timed("year.budgetRows", db.select().from(budgets).where(and(inArray(budgets.month, months), budgetScope()))),
      timed("year.categories", listCategories(true)),
      timed(
        "year.extras",
        db
          .select({
            id: yearExtraExpenses.id,
            year: yearExtraExpenses.year,
            name: yearExtraExpenses.name,
            amount: yearExtraExpenses.amount,
            mainCategoryId: yearExtraExpenses.mainCategoryId,
            payerId: yearExtraExpenses.payerId,
            categoryName: mainCategories.name,
            payerName: members.name,
          })
          .from(yearExtraExpenses)
          .innerJoin(mainCategories, eq(mainCategories.id, yearExtraExpenses.mainCategoryId))
          .innerJoin(members, eq(members.id, yearExtraExpenses.payerId))
          .where(and(eq(yearExtraExpenses.year, year), yearExtraScope()))
          // 明確排序：沒有 ORDER BY 時順序取決於查詢計畫，加條件就可能變
          .orderBy(asc(yearExtraExpenses.id))
      ),
      timed(
        "year.byTypeMonth",
        db
          .select({ type: transactions.type, month: monthExpr, amount: intSum(transactions.amount) })
          .from(transactions)
          .where(inYear)
          .groupBy(transactions.type, monthExpr)
      ),
    ]);

  const income = totals.find((t) => t.type === "income")?.amount ?? 0;
  const expense = totals.find((t) => t.type === "expense")?.amount ?? 0;

  /** 每月收支與結餘（不含年度額外開銷，與頂端的全年結餘同口徑）；該月沒有任何交易為 null。 */
  const monthly = months.map((m) => {
    const inMonth = byTypeMonth.filter((r) => r.month === m);
    if (inMonth.length === 0) return null;
    const mIncome = inMonth.find((r) => r.type === "income")?.amount ?? 0;
    const mExpense = inMonth.find((r) => r.type === "expense")?.amount ?? 0;
    return { income: mIncome, expense: mExpense, net: mIncome - mExpense };
  });

  const cellMap = new Map<string, number>();
  for (const r of byCatMonth) {
    if (r.mainCategoryId == null) continue;
    cellMap.set(r.mainCategoryId + "|" + r.month, r.amount);
  }

  const extraByCat = new Map<number, number>();
  for (const e of extras) extraByCat.set(e.mainCategoryId, (extraByCat.get(e.mainCategoryId) ?? 0) + e.amount);

  const nowMonth = currentMonth();

  const rows: YearCategoryRow[] = categories
    .filter((c) => c.type === "expense")
    .map((cat) => {
      const exists = months.map((m) => existsInMonth(cat, m));
      const startMonth = exists.indexOf(true);
      const endMonth = exists.lastIndexOf(true) + 1;

      /**
       * null = 該月沒有記錄；前端據此顯示「—」而非 0。
       * 有實際交易就一定顯示，即使落在分類生命週期之外（例如補登分類新增前的帳）——
       * 否則底部支出合計會少算，和頂端的全年支出對不起來。
       */
      const cells = months.map((m) => cellMap.get(cat.id + "|" + m) ?? null);

      // 該年度最後一次設定的月預算，作為未來月份的預估基準
      const catBudgets = budgetRows
        .filter((b) => b.mainCategoryId === cat.id && existsInMonth(cat, b.month))
        .sort((a, b) => a.month.localeCompare(b.month));
      const monthlyBudget = catBudgets.at(-1)?.amount ?? 0;
      const budgetByMonth = new Map(catBudgets.map((b) => [b.month, b.amount]));

      const extra = extraByCat.get(cat.id) ?? null;
      const recorded = cells.reduce<number>((sum, v) => sum + (v ?? 0), 0);

      /**
       * 已經過去的月份：加總「當時實際設定」的預算金額（月中若調整過金額，
       * 反映調整後的真實目標，未設定的月份視為 0）；還沒到的月份：用目前
       * 的月預算往後推算。兩段加起來才是年度預計。
       */
      let elapsedBudget = 0;
      let remainingMonths = 0;
      months.forEach((m, i) => {
        if (i < startMonth || i >= endMonth) return; // 分類當月不存在，不計入
        if (m < nowMonth) elapsedBudget += budgetByMonth.get(m) ?? 0;
        else remainingMonths += 1;
      });
      const planned =
        monthlyBudget > 0 || elapsedBudget > 0
          ? elapsedBudget + monthlyBudget * remainingMonths + (extra ?? 0)
          : null;

      return {
        mainCategoryId: cat.id,
        name: cat.name,
        icon: cat.icon,
        months: cells,
        extra,
        total: recorded + (extra ?? 0),
        planned,
        monthlyBudget,
        startMonth: startMonth < 0 ? 0 : startMonth,
        endMonth: startMonth < 0 ? 0 : endMonth,
      };
    })
    .filter((r) => r.total > 0 || r.monthlyBudget > 0);

  return {
    year,
    income,
    expense,
    net: income - expense,
    recordedMonths: monthsWithData.length,
    monthly,
    rows,
    extras,
  };
}
