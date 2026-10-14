import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  idSchema,
  setActiveSchema,
  subscriptionDraftSchema,
  subscriptionPatchSchema,
  type Subscription,
  type SubscriptionRevision,
} from "@family-ledger/shared";
import { db } from "../db/index.js";
import {
  mainCategories,
  members,
  subscriptionRevisions,
  subscriptions,
  transactions,
} from "../db/schema.js";
import { badRequest, notFound } from "../lib/errors.js";
import { INSTALLMENTS, currentMonth, installmentIndex, monthOf, nextAnnualChargeDate } from "../lib/dates.js";
import { requireAdmin, requireAuth, type AppEnv } from "../middleware/auth.js";
import { findView } from "../services/views.js";
import { canCharge, chargeOnce } from "../services/charges.js";
import { categoryScope, subscriptionScope } from "../services/scope.js";

const idParam = zValidator("param", z.object({ id: idSchema }));

export const subscriptionRoutes = new Hono<AppEnv>();

// 儀表板固定支出需要訂閱資料，讀取開放全員；寫入 ADMIN
subscriptionRoutes.use("/*", requireAuth);

subscriptionRoutes.get("/", async (c) => {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(subscriptionScope())
    .orderBy(asc(subscriptions.nextChargeDate));
  return c.json<Subscription[]>(rows);
});

subscriptionRoutes.post("/", requireAdmin, zValidator("json", subscriptionDraftSchema), async (c) => {
  const draft = c.req.valid("json");
  await assertPayer(draft.payerId);
  const mainCategoryId = await subscriptionCategoryId();

  const row = await db.transaction(async (tx) => {
    // chargeDay 取首次扣款日的日數，作為之後推算的錨點
    const [created] = await tx
      .insert(subscriptions)
      .values({
        ...draft,
        mainCategoryId,
        chargeDay: Number(draft.nextChargeDate.slice(8, 10)),
        // 年繳：首次扣款日的月份就是之後每年的扣款月（第 1 期）
        chargeMonth: draft.cycle === "yearly" ? Number(draft.nextChargeDate.slice(5, 7)) : null,
      })
      .returning();
    // 建立時即寫入第一個版本，供固定支出逐月回推
    await tx.insert(subscriptionRevisions).values({
      subscriptionId: created!.id,
      effectiveFrom: monthOf(draft.nextChargeDate) < currentMonth() ? monthOf(draft.nextChargeDate) : currentMonth(),
      amount: draft.amount,
      cycle: draft.cycle,
    });
    return created!;
  });

  return c.json<Subscription>(row, 201);
});

/** 金額或週期變更寫入歷史版本（自當月生效），舊期間仍以當時金額計算。 */
subscriptionRoutes.patch("/:id", requireAdmin, idParam, zValidator("json", subscriptionPatchSchema), async (c) => {
  const { id } = c.req.valid("param");
  const patch = c.req.valid("json");

  const [current] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  if (!current) throw notFound("訂閱不存在");
  if (patch.payerId) await assertPayer(patch.payerId);

  const nextAmount = patch.amount ?? current.amount;
  const nextCycle = patch.cycle ?? current.cycle;
  const priceChanged = nextAmount !== current.amount || nextCycle !== current.cycle;

  // 年繳分攤進行中（第 2～12 期）：本期已付，週期與扣款日要等本期分攤結束才能改
  const midPeriod =
    current.cycle === "yearly" &&
    current.chargeMonth != null &&
    installmentIndex(current.nextChargeDate, current.chargeMonth) !== 0;
  const scheduleChanged =
    nextCycle !== current.cycle || (patch.nextChargeDate != null && patch.nextChargeDate !== current.nextChargeDate);
  if (midPeriod && scheduleChanged) {
    const paid = installmentIndex(current.nextChargeDate, current.chargeMonth!);
    throw badRequest(
      "年繳分攤中（已分攤 " + paid + "/" + INSTALLMENTS + " 期），週期與扣款日要等本期結束後才能改（下次年繳 " +
        nextAnnualChargeDate(current.nextChargeDate, current.chargeMonth!, current.chargeDay) + "）"
    );
  }
  const nextChargeDate = patch.nextChargeDate ?? current.nextChargeDate;

  const row = await db.transaction(async (tx) => {
    // 手动改扣款日時錨點跟著重設
    const nextDay = patch.nextChargeDate
      ? { chargeDay: Number(patch.nextChargeDate.slice(8, 10)) }
      : {};
    // 年繳的扣款月跟著扣款日；改成月繳時清掉年繳欄位（期中改週期已在上面擋下）
    const yearly =
      nextCycle === "yearly"
        ? { chargeMonth: midPeriod ? current.chargeMonth : Number(nextChargeDate.slice(5, 7)) }
        : { chargeMonth: null, periodAmount: null };
    const [updated] = await tx
      .update(subscriptions)
      .set({ ...patch, ...nextDay, ...yearly })
      .where(eq(subscriptions.id, id))
      .returning();
    if (priceChanged) {
      await tx
        .insert(subscriptionRevisions)
        .values({ subscriptionId: id, effectiveFrom: currentMonth(), amount: nextAmount, cycle: nextCycle })
        .onConflictDoUpdate({
          target: [subscriptionRevisions.subscriptionId, subscriptionRevisions.effectiveFrom],
          set: { amount: nextAmount, cycle: nextCycle },
        });
    }
    return updated!;
  });

  return c.json<Subscription>(row);
});

/** 只能停用，不提供刪除。 */
subscriptionRoutes.post("/:id/active", requireAdmin, idParam, zValidator("json", setActiveSchema), async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db
    .update(subscriptions)
    .set({ isActive: c.req.valid("json").isActive })
    .where(eq(subscriptions.id, id))
    .returning();
  if (!row) throw notFound("訂閱不存在");
  return c.json<Subscription>(row);
});

/**
 * 標記已扣款：以本期扣款日產生一筆交易（金額取訂閱設定、記帳者取扣款人），再推算下次扣款日。
 * 年繳產生的是當月那一期分攤（G6-08）；停用後已付期間的分攤仍可標記。
 * 實際金額不同時由扣款人或管理者到交易列表修改該筆。
 */
subscriptionRoutes.post("/:id/mark-paid", requireAdmin, idParam, async (c) => {
  const { id } = c.req.valid("param");

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  if (!sub) throw notFound("訂閱不存在");
  if (!canCharge(sub)) throw badRequest("已停用的訂閱不能標記扣款");

  const result = await chargeOnce(id, c.get("user").id);
  if (!result) throw badRequest("本期已扣款，無需重複標記");

  const [updated] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  const view = await findView(result.transactionId);
  return c.json({ subscription: updated!, transaction: view! });
});

subscriptionRoutes.get("/:id/revisions", idParam, async (c) => {
  const { id } = c.req.valid("param");
  const rows = await db
    .select()
    .from(subscriptionRevisions)
    .where(eq(subscriptionRevisions.subscriptionId, id))
    .orderBy(desc(subscriptionRevisions.effectiveFrom));
  return c.json<SubscriptionRevision[]>(rows);
});

/**
 * 訂閱一律歸屬系統分類「訂閱」（sql/0001）：它不可停用，
 * 所以不會發生「分類停用了、訂閱還在扣款與攤提」的情況。
 */
async function subscriptionCategoryId(): Promise<number> {
  const [cat] = await db
    .select({ id: mainCategories.id })
    .from(mainCategories)
    .where(and(eq(mainCategories.systemKey, "subscription"), categoryScope()))
    .limit(1);
  if (!cat) throw new Error("找不到系統分類「訂閱」，請先執行 db:push");
  return cat.id;
}

async function assertPayer(payerId: number): Promise<void> {
  const [payer] = await db.select().from(members).where(eq(members.id, payerId)).limit(1);
  if (!payer || !payer.isActive) throw badRequest("扣款人不存在或已停用");
}
