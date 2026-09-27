import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  idSchema,
  setActiveSchema,
  subscriptionDraftSchema,
  subscriptionPatchSchema,
  type Subscription,
  type SubscriptionRevision,
} from "@family-ledger/shared";
import { db } from "../db";
import {
  mainCategories,
  members,
  subscriptionRevisions,
  subscriptions,
  transactions,
} from "../db/schema";
import { badRequest, notFound } from "../lib/errors";
import { currentMonth, monthOf } from "../lib/dates";
import { requireAdmin, requireAuth, type AppEnv } from "../middleware/auth";
import { findView } from "../services/views";
import { chargeOnce } from "../services/charges";

const idParam = zValidator("param", z.object({ id: idSchema }));

export const subscriptionRoutes = new Hono<AppEnv>();

// 儀表板固定支出需要訂閱資料，讀取開放全員；寫入 ADMIN
subscriptionRoutes.use("/*", requireAuth);

subscriptionRoutes.get("/", async (c) => {
  const rows = await db.select().from(subscriptions).orderBy(asc(subscriptions.nextChargeDate));
  return c.json<Subscription[]>(rows);
});

subscriptionRoutes.post("/", requireAdmin, zValidator("json", subscriptionDraftSchema), async (c) => {
  const draft = c.req.valid("json");
  await assertRefs(draft.mainCategoryId, draft.payerId);

  const row = await db.transaction(async (tx) => {
    // chargeDay 取首次扣款日的日數，作為之後推算的錨點
    const [created] = await tx
      .insert(subscriptions)
      .values({ ...draft, chargeDay: Number(draft.nextChargeDate.slice(8, 10)) })
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
  if (patch.mainCategoryId || patch.payerId) {
    await assertRefs(patch.mainCategoryId ?? current.mainCategoryId, patch.payerId ?? current.payerId);
  }

  const nextAmount = patch.amount ?? current.amount;
  const nextCycle = patch.cycle ?? current.cycle;
  const priceChanged = nextAmount !== current.amount || nextCycle !== current.cycle;

  const row = await db.transaction(async (tx) => {
    // 手动改扣款日時錨點跟著重設
    const nextDay = patch.nextChargeDate
      ? { chargeDay: Number(patch.nextChargeDate.slice(8, 10)) }
      : {};
    const [updated] = await tx
      .update(subscriptions)
      .set({ ...patch, ...nextDay })
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
 * 實際金額不同時由扣款人或管理者到交易列表修改該筆。
 */
subscriptionRoutes.post("/:id/mark-paid", requireAdmin, idParam, async (c) => {
  const { id } = c.req.valid("param");

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  if (!sub) throw notFound("訂閱不存在");
  if (!sub.isActive) throw badRequest("已停用的訂閱不能標記扣款");

  const result = await chargeOnce(id);
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

async function assertRefs(mainCategoryId: number, payerId: number): Promise<void> {
  const [cat] = await db.select().from(mainCategories).where(eq(mainCategories.id, mainCategoryId)).limit(1);
  if (!cat || cat.type !== "expense") throw badRequest("訂閱只能歸屬支出分類");

  const [payer] = await db.select().from(members).where(eq(members.id, payerId)).limit(1);
  if (!payer || !payer.isActive) throw badRequest("扣款人不存在或已停用");
}
