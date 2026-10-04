import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, gte, ilike, lt, sql } from "drizzle-orm";
import { z } from "zod";
import {
  idSchema,
  transactionDraftSchema,
  transactionPatchSchema,
  transactionQuerySchema,
  type Paged,
  type TransactionRevision,
  type TransactionView,
} from "@family-ledger/shared";
import { db } from "../db/index.js";
import { mainCategories, subCategories, transactionRevisions, transactions } from "../db/schema.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { monthRange } from "../lib/dates.js";
import { requireAuth, type AppEnv } from "../middleware/auth.js";
import { findView, toView, transactionViewQuery } from "../services/views.js";
import { txScope } from "../services/scope.js";

const idParam = zValidator("param", z.object({ id: idSchema }));

export const transactionRoutes = new Hono<AppEnv>();
transactionRoutes.use("/*", requireAuth);

transactionRoutes.get("/", zValidator("query", transactionQuerySchema), async (c) => {
  const q = c.req.valid("query");
  const range = q.month ? monthRange(q.month) : null;

  const where = and(
    eq(transactions.isDeleted, false),
    txScope(),
    range ? gte(transactions.date, range.start) : undefined,
    range ? lt(transactions.date, range.end) : undefined,
    q.type !== "all" ? eq(transactions.type, q.type) : undefined,
    q.mainCategoryId ? eq(transactions.mainCategoryId, q.mainCategoryId) : undefined,
    q.payerId ? eq(transactions.payerId, q.payerId) : undefined,
    // 關鍵字僅搜尋備註，不搜尋金額與分類名稱（specs/05 規則 9）
    q.keyword ? ilike(transactions.note, "%" + q.keyword + "%") : undefined
  );

  const [rows, [totalRow]] = await Promise.all([
    transactionViewQuery()
      .where(where)
      .orderBy(desc(transactions.date), desc(transactions.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(transactions).where(where),
  ]);

  const payload: Paged<TransactionView> = {
    items: rows.map(toView),
    total: totalRow?.total ?? 0,
    page: q.page,
    pageSize: q.pageSize,
  };
  return c.json(payload);
});

/** 記帳者由後端取登入者，不接受前端傳入（不可代記他人）。 */
transactionRoutes.post("/", zValidator("json", transactionDraftSchema), async (c) => {
  const draft = c.req.valid("json");
  const names = await assertCategoryMatches(draft.type, draft.mainCategoryId, draft.subCategoryId);

  const [row] = await db
    .insert(transactions)
    .values({
      type: draft.type,
      mainCategoryId: draft.mainCategoryId,
      subCategoryId: draft.subCategoryId,
      amount: draft.amount,
      date: draft.date,
      payerId: c.get("user").id,
      note: draft.note ?? null,
      // 分類名稱在此凍結，日後改名不影響這筆
      mainCategoryName: names.main,
      subCategoryName: names.sub,
    })
    .returning({ id: transactions.id });

  const view = await findView(row!.id);
  return c.json(view!, 201);
});

/**
 * 可改欄位僅金額、日期、分類、備註；收支別與記帳者不可改。
 * 一般成員只能改自己記的交易，管理者不受此限。每個異動欄位寫一列 revision。
 */
transactionRoutes.patch("/:id", idParam, zValidator("json", transactionPatchSchema), async (c) => {
  const { id } = c.req.valid("param");
  const patch = c.req.valid("json");
  const user = c.get("user");

  const [current] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!current || current.isDeleted) throw notFound("交易不存在");
  if (user.role !== "admin" && current.payerId !== user.id) throw forbidden("只能修改自己記的交易");

  const nextMain = patch.mainCategoryId === undefined ? current.mainCategoryId : patch.mainCategoryId;
  const nextSub = patch.subCategoryId === undefined ? current.subCategoryId : patch.subCategoryId;
  const names = await assertCategoryMatches(current.type, nextMain, nextSub);

  const fields = ["mainCategoryId", "subCategoryId", "amount", "date", "note"] as const;
  const diffs = fields
    .filter((f) => patch[f] !== undefined && String(patch[f] ?? "") !== String(current[f] ?? ""))
    .map((f) => ({
      transactionId: id,
      editedBy: user.id,
      field: f,
      before: String(current[f] ?? ""),
      after: String(patch[f] ?? ""),
    }));

  if (diffs.length === 0) {
    const unchanged = await findView(id);
    return c.json(unchanged!);
  }

  // 使用者主動改分類時才重寫快照（分類改名不會走到這裡）
  const categoryChanged =
    patch.mainCategoryId !== undefined || patch.subCategoryId !== undefined;
  const snapshot = categoryChanged
    ? { mainCategoryName: names.main, subCategoryName: names.sub }
    : {};

  await db.transaction(async (tx) => {
    await tx
      .update(transactions)
      .set({ ...patch, ...snapshot })
      .where(eq(transactions.id, id));
    await tx.insert(transactionRevisions).values(diffs);
  });

  const view = await findView(id);
  return c.json(view!);
});

/** 軟刪除；前台無復原入口，已刪除紀錄不計入任何統計。 */
transactionRoutes.delete("/:id", idParam, async (c) => {
  const { id } = c.req.valid("param");
  const user = c.get("user");

  const [current] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!current || current.isDeleted) throw notFound("交易不存在");
  if (user.role !== "admin" && current.payerId !== user.id) throw forbidden("只能刪除自己記的交易");

  await db.update(transactions).set({ isDeleted: true }).where(eq(transactions.id, id));
  return c.body(null, 204);
});

transactionRoutes.get("/:id/revisions", idParam, async (c) => {
  const { id } = c.req.valid("param");
  const rows = await db
    .select()
    .from(transactionRevisions)
    .where(eq(transactionRevisions.transactionId, id))
    .orderBy(desc(transactionRevisions.editedAt), asc(transactionRevisions.id));

  const payload: TransactionRevision[] = rows.map((r) => ({ ...r, editedAt: r.editedAt.toISOString() }));
  return c.json(payload);
});

/**
 * 分類須與收支別一致，子分類須隸屬該主分類（歸屬不可搬移）。
 * 回傳當下的分類名稱，供寫入快照。
 */
async function assertCategoryMatches(
  type: "expense" | "income",
  mainCategoryId: number | null,
  subCategoryId: number | null
): Promise<{ main: string | null; sub: string | null }> {
  if (mainCategoryId == null) {
    if (subCategoryId != null) throw badRequest("未選主分類時不可指定子分類");
    return { main: null, sub: null };
  }

  const [main] = await db.select().from(mainCategories).where(eq(mainCategories.id, mainCategoryId)).limit(1);
  if (!main) throw badRequest("分類不存在");
  if (main.type !== type) throw badRequest("分類與收支別不符");

  if (subCategoryId == null) return { main: main.name, sub: null };

  const [sub] = await db.select().from(subCategories).where(eq(subCategories.id, subCategoryId)).limit(1);
  if (!sub || sub.mainCategoryId !== mainCategoryId) throw badRequest("子分類不屬於此主分類");
  return { main: main.name, sub: sub.name };
}
