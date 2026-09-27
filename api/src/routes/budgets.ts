import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { budgetUpsertSchema, monthSchema, type Budget } from "@family-ledger/shared";
import { db } from "../db/index.js";
import { budgets, mainCategories } from "../db/schema.js";
import { badRequest } from "../lib/errors.js";
import { existsInMonth, prevMonth } from "../lib/dates.js";
import { requireAdmin, requireAuth, type AppEnv } from "../middleware/auth.js";
import { fixedTotal } from "../services/fixed.js";

export const budgetRoutes = new Hono<AppEnv>();

// 儀表板的分類進度需要預算，讀取開放全員；寫入 ADMIN
budgetRoutes.use("/*", requireAuth);

budgetRoutes.get("/", zValidator("query", z.object({ month: monthSchema })), async (c) => {
  const { month } = c.req.valid("query");
  const rows = await db
    .select()
    .from(budgets)
    .where(eq(budgets.month, month))
    .orderBy(asc(budgets.mainCategoryId));
  return c.json<Budget[]>(rows);
});

/** 固定支出總額（由訂閱月換算，年繳 ÷12）。 */
budgetRoutes.get("/fixed-total", zValidator("query", z.object({ month: monthSchema })), async (c) => {
  const { month } = c.req.valid("query");
  return c.json({ month, amount: await fixedTotal(month) });
});

budgetRoutes.put("/", requireAdmin, zValidator("json", budgetUpsertSchema), async (c) => {
  const { month, mainCategoryId, amount } = c.req.valid("json");

  const [cat] = await db.select().from(mainCategories).where(eq(mainCategories.id, mainCategoryId)).limit(1);
  if (!cat) throw badRequest("分類不存在");
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
budgetRoutes.post("/copy-previous", requireAdmin, zValidator("json", z.object({ month: monthSchema })), async (c) => {
  const { month } = c.req.valid("json");
  const source = prevMonth(month);

  const [previous, categories] = await Promise.all([
    db.select().from(budgets).where(eq(budgets.month, source)),
    db.select().from(mainCategories),
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
    .where(eq(budgets.month, month))
    .orderBy(asc(budgets.mainCategoryId));

  return c.json<Budget[]>(result);
});
