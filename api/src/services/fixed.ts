import { and, desc, eq, lte, or, sql } from "drizzle-orm";
import type { BillingCycle } from "@family-ledger/shared";
import { db } from "../db/index.js";
import { subscriptionRevisions, subscriptions } from "../db/schema.js";
import { monthOf, monthlyEquivalent } from "../lib/dates.js";
import { subscriptionScope } from "./scope.js";

export interface EffectiveSubscription {
  id: number;
  name: string;
  mainCategoryId: number;
  payerId: number;
  amount: number;
  cycle: BillingCycle;
  /** 該月的月攤提金額（年繳 ÷12） */
  monthly: number;
  /** 已停用但仍在已繳費期間內 */
  isWindingDown: boolean;
}

/**
 * 取每筆訂閱在指定月份「當時」的金額與週期：effective_from <= month 的最新一筆版本。
 * 金額變更後舊期間仍以當時金額計算（specs/08-訂閱管理頁.md）。
 *
 * 停用的訂閱不是立刻歸零：已繳的費用攤提到已付期間結束為止。
 * next_charge_date 在停用當下即凍結，恰好就是已繳費期間的終點——
 * 2028-03 扣了一年年費，next_charge_date = 2029-03，則 6 月停用後仍攤提到 2029-02。
 */
export async function effectiveSubscriptions(month: string): Promise<EffectiveSubscription[]> {
  const rows = await db
    .select({
      id: subscriptions.id,
      name: subscriptions.name,
      mainCategoryId: subscriptions.mainCategoryId,
      payerId: subscriptions.payerId,
      isActive: subscriptions.isActive,
      nextChargeDate: subscriptions.nextChargeDate,
      revAmount: subscriptionRevisions.amount,
      revCycle: subscriptionRevisions.cycle,
      effectiveFrom: subscriptionRevisions.effectiveFrom,
    })
    .from(subscriptions)
    .innerJoin(
      subscriptionRevisions,
      and(
        eq(subscriptionRevisions.subscriptionId, subscriptions.id),
        lte(subscriptionRevisions.effectiveFrom, month)
      )
    )
    .where(
      and(
        subscriptionScope(),
        or(
          eq(subscriptions.isActive, true),
          // 已停用：仍在已繳費期間內的月份繼續攤提
          sql`to_char(${subscriptions.nextChargeDate}, 'YYYY-MM') > ${month}`
        )
      )
    )
    .orderBy(desc(subscriptionRevisions.effectiveFrom), desc(subscriptionRevisions.id));

  const latest = new Map<number, EffectiveSubscription>();
  for (const r of rows) {
    if (latest.has(r.id)) continue; // 已排序，第一筆就是該月生效版本
    latest.set(r.id, {
      id: r.id,
      name: r.name,
      mainCategoryId: r.mainCategoryId,
      payerId: r.payerId,
      amount: r.revAmount,
      cycle: r.revCycle,
      monthly: monthlyEquivalent(r.revAmount, r.revCycle),
      isWindingDown: !r.isActive,
    });
  }
  return [...latest.values()];
}

/** 固定支出總額：訂閱月換算後加總（年繳 ÷12），含停用後尚在已繳期間的項目。 */
export async function fixedTotal(month: string): Promise<number> {
  const list = await effectiveSubscriptions(month);
  return list.reduce((sum, s) => sum + s.monthly, 0);
}

/** 已繳費期間的最後一個月——供訂閱頁顯示「攤提至 YYYY-MM」。 */
export function coverageEndMonth(nextChargeDate: string): string {
  const month = monthOf(nextChargeDate);
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1;
  return m === 0 ? y - 1 + "-12" : y + "-" + String(m).padStart(2, "0");
}
