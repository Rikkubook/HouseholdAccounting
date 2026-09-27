import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db } from "../db";
import { mainCategories, subscriptions, transactions } from "../db/schema";
import { advanceChargeDate, today } from "../lib/dates";

export type ChargeResult = { subscriptionId: number; name: string; amount: number; date: string; transactionId: number };

/**
 * 為單筆訂閱產生扣款交易並推進 nextChargeDate。
 * mark-paid（手動）與 run-due（Cron）共用同一條路徑，避免兩套邏輯漂移。
 * sourceSubscriptionId + date 的 unique index 是冪等保證：同一期重複執行不會產生第二筆。
 */
export async function chargeOnce(subscriptionId: number): Promise<ChargeResult | null> {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
  if (!sub || !sub.isActive) return null;

  const [cat] = await db
    .select({ name: mainCategories.name })
    .from(mainCategories)
    .where(eq(mainCategories.id, sub.mainCategoryId))
    .limit(1);

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(transactions)
      .values({
        type: "expense",
        mainCategoryId: sub.mainCategoryId,
        subCategoryId: null,
        amount: sub.amount,
        date: sub.nextChargeDate,
        payerId: sub.payerId,
        note: sub.name,
        sourceSubscriptionId: sub.id,
        mainCategoryName: cat?.name ?? null,
        subCategoryName: null,
      })
      .onConflictDoNothing({
        target: [transactions.sourceSubscriptionId, transactions.date],
        // 對應 transactions_subscription_period_idx 的 partial 條件，否則 Postgres 推斷不到該索引
        where: and(isNotNull(transactions.sourceSubscriptionId), eq(transactions.isDeleted, false)),
      })
      .returning({ id: transactions.id });

    // 已存在同期交易（別的請求剛扣過）：不重複扣，也不推進日期
    if (!inserted[0]) return null;

    const [updated] = await tx
      .update(subscriptions)
      .set({ nextChargeDate: advanceChargeDate(sub.nextChargeDate, sub.cycle, sub.chargeDay) })
      .where(and(eq(subscriptions.id, sub.id), eq(subscriptions.nextChargeDate, sub.nextChargeDate)))
      .returning();
    if (!updated) return null;

    return { subscriptionId: sub.id, name: sub.name, amount: sub.amount, date: sub.nextChargeDate, transactionId: inserted[0].id };
  });
}

/**
 * 掃出所有「應扣日已到或已過、且尚未產生交易」的啟用訂閱，逐筆補扣。
 * 年繳訂閱同樣適用；一筆訂閱若積欠多期，每次執行只補最舊的一期，
 * 由每日 Cron 逐日追上，避免單次執行塞爆 function 時限。
 */
export async function runDueCharges(asOf: string = today()): Promise<ChargeResult[]> {
  const due = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.isActive, true), lte(subscriptions.nextChargeDate, asOf)));

  const results: ChargeResult[] = [];
  for (const row of due) {
    const r = await chargeOnce(row.id);
    if (r) results.push(r);
  }
  return results;
}
