import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  categoryScopeQuerySchema,
  idSchema,
  mainCategoryDraftSchema,
  mainCategoryPatchSchema,
  reorderSchema,
  queryBoolSchema,
  scopeSchema,
  subNameSchema,
} from "@family-ledger/shared";
import { db } from "../db/index.js";
import { mainCategories, subCategories, subscriptions } from "../db/schema.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { currentMonth } from "../lib/dates.js";
import { requireAuth, type AppEnv, type AuthUser } from "../middleware/auth.js";
import {
  ensurePersonalDefaults,
  findCategory,
  isInScope,
  listCategories,
  scopeOfCategory,
  subscriptionCategoryId,
} from "../services/categories.js";
import { categoryScope, resolveScope, type Scope } from "../services/scope.js";

const idParam = zValidator("param", z.object({ id: idSchema }));
const subIdParam = zValidator("param", z.object({ subId: idSchema }));
const scopeQuery = zValidator("query", categoryScopeQuerySchema);

export const categoryRoutes = new Hono<AppEnv>();
categoryRoutes.use("/*", requireAuth);

/** 家庭分類只有管理者能改；個人分類每個人只能改自己的（個人帳第 2 批） */
function assertCanWrite(user: AuthUser, scope: Scope): void {
  if (scope.kind === "family" && user.role !== "admin") throw forbidden("只有管理者可以修改家庭分類");
}

/**
 * 取出要修改的主分類並檢查權限。別人的個人分類一律當作不存在（404），
 * 不洩漏它的存在；管理者也不例外。
 */
async function loadWritableMain(user: AuthUser, id: number) {
  const [target] = await db.select().from(mainCategories).where(eq(mainCategories.id, id)).limit(1);
  if (!target || (target.ownerId != null && target.ownerId !== user.id)) throw notFound("分類不存在");
  assertCanWrite(user, scopeOfCategory(target));
  return target;
}

async function loadWritableSub(user: AuthUser, subId: number) {
  const [target] = await db.select().from(subCategories).where(eq(subCategories.id, subId)).limit(1);
  const [parent] = target
    ? await db.select().from(mainCategories).where(eq(mainCategories.id, target.mainCategoryId)).limit(1)
    : [];
  if (!target || !parent || (parent.ownerId != null && parent.ownerId !== user.id)) throw notFound("子分類不存在");
  assertCanWrite(user, scopeOfCategory(parent));
  return target;
}

// 記帳與篩選都需要分類清單，讀取開放全員；個人帳只回本人的分類
categoryRoutes.get(
  "/",
  zValidator(
    "query",
    z.object({ includeArchived: queryBoolSchema.default(true), scope: scopeSchema.default("family") })
  ),
  async (c) => {
    const q = c.req.valid("query");
    const scope = resolveScope(c.get("user"), q.scope);
    if (scope.kind === "personal") await ensurePersonalDefaults(scope.ownerId);
    return c.json(await listCategories(q.includeArchived, scope));
  }
);

categoryRoutes.post("/", scopeQuery, zValidator("json", mainCategoryDraftSchema), async (c) => {
  const user = c.get("user");
  const scope = resolveScope(user, c.req.valid("query").scope);
  assertCanWrite(user, scope);
  const draft = c.req.valid("json");
  const [{ max } = { max: 0 }] = await db
    .select({ max: sql<number>`coalesce(max(${mainCategories.sortOrder}), 0)::int` })
    .from(mainCategories)
    .where(categoryScope(scope));

  // 新分類自建立當月起存在，之前月份的預算與統計不受影響
  const [row] = await db
    .insert(mainCategories)
    .values({
      ...draft,
      sortOrder: max + 1,
      activeFrom: currentMonth(),
      ownerId: scope.kind === "personal" ? scope.ownerId : null,
    })
    .returning({ id: mainCategories.id });

  return c.json((await findCategory(row!.id))!, 201);
});

categoryRoutes.patch("/:id", idParam, zValidator("json", mainCategoryPatchSchema), async (c) => {
  const { id } = c.req.valid("param");
  const patch = c.req.valid("json");

  const target = await loadWritableMain(c.get("user"), id);
  if (target.isSystem && patch.name) throw conflict("系統分類不可改名", "system_category");

  await db.update(mainCategories).set(patch).where(eq(mainCategories.id, id));
  return c.json((await findCategory(id))!);
});

/**
 * 只能停用，不提供刪除；歷史交易保留原分類。停用年月＝當月，未來月份顯示「—」。
 * 掛在這個分類的訂閱改回該帳本的「訂閱」，之後的扣款不會記到停用的分類（已產生的交易不動）。
 */
categoryRoutes.post("/:id/archive", idParam, async (c) => {
  const { id } = c.req.valid("param");
  const target = await loadWritableMain(c.get("user"), id);
  if (target.isSystem) throw conflict("系統分類不可停用", "system_category");

  const fallback = await subscriptionCategoryId(scopeOfCategory(target));
  await db.transaction(async (tx) => {
    await tx
      .update(mainCategories)
      .set({ isActive: false, archivedFrom: currentMonth() })
      .where(eq(mainCategories.id, id));
    await tx.update(subscriptions).set({ mainCategoryId: fallback }).where(eq(subscriptions.mainCategoryId, id));
  });

  return c.json((await findCategory(id))!);
});

categoryRoutes.post("/:id/restore", idParam, async (c) => {
  const { id } = c.req.valid("param");
  await loadWritableMain(c.get("user"), id);
  await db.update(mainCategories).set({ isActive: true, archivedFrom: null }).where(eq(mainCategories.id, id));
  return c.json((await findCategory(id))!);
});

categoryRoutes.post("/reorder", scopeQuery, zValidator("json", reorderSchema), async (c) => {
  const user = c.get("user");
  const scope = resolveScope(user, c.req.valid("query").scope);
  assertCanWrite(user, scope);
  const { orderedIds } = c.req.valid("json");

  // 只能排自己帳本的分類，不能順手改到別本帳的排序
  const rows = await db.select({ id: mainCategories.id, ownerId: mainCategories.ownerId }).from(mainCategories);
  const owned = new Set(rows.filter((r) => isInScope(r, scope)).map((r) => r.id));
  if (orderedIds.some((id) => !owned.has(id))) throw badRequest("分類不屬於此帳本");

  await db.transaction(async (tx) => {
    for (const [i, id] of orderedIds.entries()) {
      await tx.update(mainCategories).set({ sortOrder: i + 1 }).where(eq(mainCategories.id, id));
    }
  });
  return c.body(null, 204);
});

/** 歸屬主分類只在新增時決定，不可搬移。 */
categoryRoutes.post("/:id/subs", idParam, zValidator("json", subNameSchema), async (c) => {
  const { id } = c.req.valid("param");
  const { name } = c.req.valid("json");

  await loadWritableMain(c.get("user"), id);
  const parent = (await findCategory(id))!;
  if (parent.subCategories.some((s) => s.name === name)) throw conflict("此子分類名稱已存在", "duplicate_name");

  const nextOrder = Math.max(0, ...parent.subCategories.map((s) => s.sortOrder)) + 1;
  await db.insert(subCategories).values({ mainCategoryId: id, name, sortOrder: nextOrder });
  return c.json((await findCategory(id))!, 201);
});

categoryRoutes.patch("/subs/:subId", subIdParam, zValidator("json", subNameSchema), async (c) => {
  const { subId } = c.req.valid("param");
  const { name } = c.req.valid("json");

  const target = await loadWritableSub(c.get("user"), subId);

  const [dupe] = await db
    .select({ id: subCategories.id })
    .from(subCategories)
    .where(and(eq(subCategories.mainCategoryId, target.mainCategoryId), eq(subCategories.name, name)))
    .limit(1);
  if (dupe && dupe.id !== subId) throw conflict("此子分類名稱已存在", "duplicate_name");

  await db.update(subCategories).set({ name }).where(eq(subCategories.id, subId));
  return c.json((await findCategory(target.mainCategoryId))!);
});

categoryRoutes.post("/subs/:subId/archive", subIdParam, async (c) => {
  const { subId } = c.req.valid("param");
  const target = await loadWritableSub(c.get("user"), subId);
  await db.update(subCategories).set({ isActive: false }).where(eq(subCategories.id, subId));
  return c.json((await findCategory(target.mainCategoryId))!);
});

categoryRoutes.post("/subs/:subId/restore", subIdParam, async (c) => {
  const { subId } = c.req.valid("param");
  const target = await loadWritableSub(c.get("user"), subId);
  await db.update(subCategories).set({ isActive: true }).where(eq(subCategories.id, subId));
  return c.json((await findCategory(target.mainCategoryId))!);
});

categoryRoutes.post("/:id/subs/reorder", idParam, zValidator("json", reorderSchema), async (c) => {
  const { id } = c.req.valid("param");
  const { orderedIds } = c.req.valid("json");

  await loadWritableMain(c.get("user"), id);
  const parent = (await findCategory(id))!;
  const owned = new Set(parent.subCategories.map((s) => s.id));
  if (orderedIds.some((sid) => !owned.has(sid))) throw badRequest("子分類不屬於此主分類");

  await db.transaction(async (tx) => {
    for (const [i, sid] of orderedIds.entries()) {
      await tx.update(subCategories).set({ sortOrder: i + 1 }).where(eq(subCategories.id, sid));
    }
  });
  return c.body(null, 204);
});
