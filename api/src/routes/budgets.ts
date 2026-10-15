import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { budgetUpsertSchema, monthSchema, scopeSchema, type Budget } from "@family-ledger/shared";
import { db } from "../db/index.js";
import { budgets, mainCategories } from "../db/schema.js";
import { badRequest, forbidden } from "../lib/errors.js";
import { existsInMonth, prevMonth } from "../lib/dates.js";
import { requireAuth, type AppEnv, type AuthUser } from "../middleware/auth.js";
import { scopeOfCategory } from "../services/categories.js";
import { fixedTotal } from "../services/fixed.js";
import { budgetScope, categoryScope, resolveScope, type Scope } from "../services/scope.js";

export const budgetRoutes = new Hono<AppEnv>();

/**
 * 預算沒有自己的 owner_id：分類屬於哪本帳，預算就屬於哪本帳（services/scope.ts）。
 * 家庭帳：讀取開放全員（儀表板要用），寫入限管理者。
 * 個人帳（個人帳第 2 批 PL2-03）：每位成員設定自己個人分類的預算；別人的個人分類當作不存在。
 */
budgetRoutes.use("/*", requireAuth);

const scopeField = { scope: scopeSchema.default("family") };

function assertCanWrite(user: AuthUser, scope: Scope): void {
  if (scope.kind === "family" && user.role !== "admin") throw forbidden("只有管理者可以修改家庭帳的預算");
}

budgetRoutes.get("/", zValidator("query", z.object({ month: monthSchema, ...scopeField })), async (c) => {
  const { month, scope } = c.req.valid("query");
  const rows = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.month, month), budgetScope(resolveScope(c.get("user"), scope))))
    .orderBy(asc(budgets.mainCategoryId));
  return c.json<Budget[]>(rows);
});

/** 固定支出總額（由訂閱月換算，年繳 ÷12）。 */
budgetRoutes.get("/fixed-total", zValidator("query", z.object({ month: monthSchema, ...scopeField })), async (c) => {
  const { month, scope } = c.req.valid("query");
  return c.json({ month, amount: await fixedTotal(month, resolveScope(c.get("user"), scope)) });
});

budgetRoutes.put("/", zValidator("json", budgetUpsertSchema), async (c) => {
  const { month, mainCategoryId, amount } = c.req.valid("json");
  const user = c.get("user");

  const [cat] = await db.select().from(mainCategories).where(eq(mainCategories.id, mainCategoryId)).limit(1);
  // 別人的個人分類當作不存在；家庭分類限管理者
  if (!cat || (cat.ownerId != null && cat.ownerId !== user.id)) throw badRequest("分類不存在");
  assertCanWrite(user, scopeOfCategory(cat));
  // 僅浮動支出可設預算；固定支出由訂閱推算，收入不設目標
  if (cat.type !== "expense" || cat.nature !== "floating") {
    throw badRequest("僅浮動支出分類可設定預算");
  }
  if (!existsInMonth(cat, month)) throw badRequest("該分類在此月份不存在");

  if (amount === 0) {
    await db.delete(budgets).where(and(eq(budgets.month, month), eq(budgets.mainCategoryId, mainCategoryId)));
    return c.json<Budget>({ id: 0, month, mainCategoryId, amount: 0 });
  }

  const [row] = await db
    .insert(budgets)
    .values({ month, mainCategoryId, amount })
    .onConflictDoUpdate({ target: [budgets.month, budgets.mainCategoryId], set: { amount } })
    .returning();

  return c.json<Budget>(row!);
});

/** 沿用上月：只複製有設定的分類，且該分類在目標月份仍存在。 */
budgetRoutes.post(
  "/copy-previous",
  zValidator("query", z.object(scopeField)),
  zValidator("json", z.object({ month: monthSchema })),
  async (c) => {
    const { month } = c.req.valid("json");
    const user = c.get("user");
    const scope = resolveScope(user, c.req.valid("query").scope);
    assertCanWrite(user, scope);
    const source = prevMonth(month);

    const [previous, categories] = await Promise.all([
      db.select().from(budgets).where(and(eq(budgets.month, source), budgetScope(scope))),
      db.select().from(mainCategories).where(categoryScope(scope)),
    ]);

    const catMap = new Map(categories.map((cat) => [cat.id, cat]));
    const rows = previous
      .filter((b) => {
        const cat = catMap.get(b.mainCategoryId);
        return cat != null && existsInMonth(cat, month);
      })
      .map((b) => ({ month, mainCategoryId: b.mainCategoryId, amount: b.amount }));

    if (rows.length === 0) throw badRequest("上個月沒有可沿用的預算設定");

    await db
      .insert(budgets)
      .values(rows)
      .onConflictDoNothing({ target: [budgets.month, budgets.mainCategoryId] });

    const result = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.month, month), budgetScope(scope)))
      .orderBy(asc(budgets.mainCategoryId));

    return c.json<Budget[]>(result);
  }
);
