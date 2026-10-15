import { and, eq, isNotNull, lte, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { mainCategories, subscriptions, transactions, type SubscriptionRow } from "../db/schema.js";
import { INSTALLMENTS, advanceChargeDate, installmentAmount, installmentIndex, today } from "../lib/dates.js";

export type ChargeResult = { subscriptionId: number; name: string; amount: number; date: string; transactionId: number };

/**
 * 這一期能不能產生交易。啟用中一律可以；停用後，年繳在已付的分攤期間內
 * （第 2～12 期）繼續產生到期滿（G6-05），不會開始新的一期。
 */
export function canCharge(sub: SubscriptionRow): boolean {
  if (sub.isActive) return true;
  return sub.cycle === "yearly" && sub.chargeMonth != null && installmentIndex(sub.nextChargeDate, sub.chargeMonth) !== 0;
}

/**
 * 本期要記的金額、備註，以及產生後要寫回訂閱的欄位。
 * 月繳：整筆。年繳：拆成 12 期分攤（docs/requirements G-6），下次日期每月推進；
 * 第 1 期把當時的年費固定成本期年費，之後各期都用它（G6-06 期中改價下一期才生效）。
 */
function chargePlan(sub: SubscriptionRow) {
  const nextChargeDate = advanceChargeDate(sub.nextChargeDate, "monthly", sub.chargeDay);
  if (sub.cycle !== "yearly" || sub.chargeMonth == null) {
    return {
      amount: sub.amount,
      note: sub.name,
      update: { nextChargeDate: advanceChargeDate(sub.nextChargeDate, sub.cycle, sub.chargeDay) },
    };
  }
  const index = installmentIndex(sub.nextChargeDate, sub.chargeMonth);
  const periodAmount = index === 0 ? sub.amount : (sub.periodAmount ?? sub.amount);
  return {
    amount: installmentAmount(periodAmount, index),
    note: sub.name + "（年繳 " + (index + 1) + "/" + INSTALLMENTS + "）",
    update: { nextChargeDate, periodAmount },
  };
}

/**
 * 為單筆訂閱產生扣款交易（年繳為當期分攤）並推進 nextChargeDate。
 * mark-paid（手動）與 run-due（Cron）共用同一條路徑，避免兩套邏輯漂移。
 * sourceSubscriptionId + date 的 unique index 是冪等保證：同一期重複執行不會產生第二筆。
 * createdBy：手動 mark-paid 傳操作的管理者；Cron 不傳（null = 系統自動產生）。
 */
export async function chargeOnce(subscriptionId: number, createdBy: number | null = null): Promise<ChargeResult | null> {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
  if (!sub || !canCharge(sub)) return null;
  const plan = chargePlan(sub);

  const [cat] = await db
    .select({ name: mainCategories.name, ownerId: mainCategories.ownerId })
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
        amount: plan.amount,
        date: sub.nextChargeDate,
        payerId: sub.payerId,
        createdBy,
        note: plan.note,
        sourceSubscriptionId: sub.id,
        // 個人訂閱掛在本人的「訂閱」分類：扣款交易記到他的個人帳（扣款人＝本人，符合 owner＝payer 的約束）
        ownerId: cat?.ownerId ?? null,
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
      .set(plan.update)
      .where(and(eq(subscriptions.id, sub.id), eq(subscriptions.nextChargeDate, sub.nextChargeDate)))
      .returning();
    if (!updated) return null;

    return { subscriptionId: sub.id, name: sub.name, amount: plan.amount, date: sub.nextChargeDate, transactionId: inserted[0].id };
  });
}

/**
 * 掃出所有「應扣日已到或已過、且尚未產生交易」的訂閱，逐筆補扣。
 * 年繳每月產生一期分攤，停用後仍補完已付期間（canCharge）；一筆訂閱若積欠多期，每次執行只補最舊的一期，
 * 由每日 Cron 逐日追上，避免單次執行塞爆 function 時限。
 */
export async function runDueCharges(asOf: string = today()): Promise<ChargeResult[]> {
  const due = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        or(eq(subscriptions.isActive, true), eq(subscriptions.cycle, "yearly")),
        lte(subscriptions.nextChargeDate, asOf)
      )
    );

  const results: ChargeResult[] = [];
  for (const row of due) {
    const r = await chargeOnce(row.id);
    if (r) results.push(r);
  }
  return results;
}
