import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  idSchema,
  mainCategoryDraftSchema,
  mainCategoryPatchSchema,
  reorderSchema,
  queryBoolSchema,
  subNameSchema,
} from "@family-ledger/shared";
import { db } from "../db";
import { mainCategories, subCategories } from "../db/schema";
import { badRequest, conflict, notFound } from "../lib/errors";
import { currentMonth } from "../lib/dates";
import { requireAdmin, requireAuth, type AppEnv } from "../middleware/auth";
import { findCategory, listCategories } from "../services/categories";

const idParam = zValidator("param", z.object({ id: idSchema }));
const subIdParam = zValidator("param", z.object({ subId: idSchema }));

export const categoryRoutes = new Hono<AppEnv>();
categoryRoutes.use("/*", requireAuth);

// 記帳與篩選都需要分類清單，讀取開放全員
categoryRoutes.get(
  "/",
  zValidator("query", z.object({ includeArchived: queryBoolSchema.default(true) })),
  async (c) => c.json(await listCategories(c.req.valid("query").includeArchived))
);

// 以下皆為 ADMIN
categoryRoutes.post("/", requireAdmin, zValidator("json", mainCategoryDraftSchema), async (c) => {
  const draft = c.req.valid("json");
  const [{ max } = { max: 0 }] = await db
    .select({ max: sql<number>`coalesce(max(${mainCategories.sortOrder}), 0)::int` })
    .from(mainCategories);

  // 新分類自建立當月起存在，之前月份的預算與統計不受影響
  const [row] = await db
    .insert(mainCategories)
    .values({ ...draft, sortOrder: max + 1, activeFrom: currentMonth() })
    .returning({ id: mainCategories.id });

  return c.json((await findCategory(row!.id))!, 201);
});

categoryRoutes.patch("/:id", requireAdmin, idParam, zValidator("json", mainCategoryPatchSchema), async (c) => {
  const { id } = c.req.valid("param");
  const patch = c.req.valid("json");

  const [target] = await db.select().from(mainCategories).where(eq(mainCategories.id, id)).limit(1);
  if (!target) throw notFound("分類不存在");
  if (target.isSystem && patch.name) throw conflict("系統分類不可改名", "system_category");

  await db.update(mainCategories).set(patch).where(eq(mainCategories.id, id));
  return c.json((await findCategory(id))!);
});

/** 只能停用，不提供刪除；歷史交易保留原分類。停用年月＝當月，未來月份顯示「—」。 */
categoryRoutes.post("/:id/archive", requireAdmin, idParam, async (c) => {
  const { id } = c.req.valid("param");
  const [target] = await db.select().from(mainCategories).where(eq(mainCategories.id, id)).limit(1);
  if (!target) throw notFound("分類不存在");
  if (target.isSystem) throw conflict("系統分類不可停用", "system_category");

  await db
    .update(mainCategories)
    .set({ isActive: false, archivedFrom: currentMonth() })
    .where(eq(mainCategories.id, id));

  return c.json((await findCategory(id))!);
});

categoryRoutes.post("/:id/restore", requireAdmin, idParam, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db
    .update(mainCategories)
    .set({ isActive: true, archivedFrom: null })
    .where(eq(mainCategories.id, id))
    .returning({ id: mainCategories.id });
  if (!row) throw notFound("分類不存在");
  return c.json((await findCategory(id))!);
});

categoryRoutes.post("/reorder", requireAdmin, zValidator("json", reorderSchema), async (c) => {
  const { orderedIds } = c.req.valid("json");
  await db.transaction(async (tx) => {
    for (const [i, id] of orderedIds.entries()) {
      await tx.update(mainCategories).set({ sortOrder: i + 1 }).where(eq(mainCategories.id, id));
    }
  });
  return c.body(null, 204);
});

/** 歸屬主分類只在新增時決定，不可搬移。 */
categoryRoutes.post("/:id/subs", requireAdmin, idParam, zValidator("json", subNameSchema), async (c) => {
  const { id } = c.req.valid("param");
  const { name } = c.req.valid("json");

  const parent = await findCategory(id);
  if (!parent) throw notFound("主分類不存在");
  if (parent.subCategories.some((s) => s.name === name)) throw conflict("此子分類名稱已存在", "duplicate_name");

  const nextOrder = Math.max(0, ...parent.subCategories.map((s) => s.sortOrder)) + 1;
  await db.insert(subCategories).values({ mainCategoryId: id, name, sortOrder: nextOrder });
  return c.json((await findCategory(id))!, 201);
});

categoryRoutes.patch("/subs/:subId", requireAdmin, subIdParam, zValidator("json", subNameSchema), async (c) => {
  const { subId } = c.req.valid("param");
  const { name } = c.req.valid("json");

  const [target] = await db.select().from(subCategories).where(eq(subCategories.id, subId)).limit(1);
  if (!target) throw notFound("子分類不存在");

  const [dupe] = await db
    .select({ id: subCategories.id })
    .from(subCategories)
    .where(and(eq(subCategories.mainCategoryId, target.mainCategoryId), eq(subCategories.name, name)))
    .limit(1);
  if (dupe && dupe.id !== subId) throw conflict("此子分類名稱已存在", "duplicate_name");

  await db.update(subCategories).set({ name }).where(eq(subCategories.id, subId));
  return c.json((await findCategory(target.mainCategoryId))!);
});

categoryRoutes.post("/subs/:subId/archive", requireAdmin, subIdParam, async (c) => {
  const { subId } = c.req.valid("param");
  const [row] = await db
    .update(subCategories)
    .set({ isActive: false })
    .where(eq(subCategories.id, subId))
    .returning({ mainCategoryId: subCategories.mainCategoryId });
  if (!row) throw notFound("子分類不存在");
  return c.json((await findCategory(row.mainCategoryId))!);
});

categoryRoutes.post("/subs/:subId/restore", requireAdmin, subIdParam, async (c) => {
  const { subId } = c.req.valid("param");
  const [row] = await db
    .update(subCategories)
    .set({ isActive: true })
    .where(eq(subCategories.id, subId))
    .returning({ mainCategoryId: subCategories.mainCategoryId });
  if (!row) throw notFound("子分類不存在");
  return c.json((await findCategory(row.mainCategoryId))!);
});

categoryRoutes.post("/:id/subs/reorder", requireAdmin, idParam, zValidator("json", reorderSchema), async (c) => {
  const { id } = c.req.valid("param");
  const { orderedIds } = c.req.valid("json");

  const parent = await findCategory(id);
  if (!parent) throw notFound("主分類不存在");
  const owned = new Set(parent.subCategories.map((s) => s.id));
  if (orderedIds.some((sid) => !owned.has(sid))) throw badRequest("子分類不屬於此主分類");

  await db.transaction(async (tx) => {
    for (const [i, sid] of orderedIds.entries()) {
      await tx.update(subCategories).set({ sortOrder: i + 1 }).where(eq(subCategories.id, sid));
    }
  });
  return c.body(null, 204);
});
