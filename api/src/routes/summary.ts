import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  idSchema,
  monthSchema,
  statsQuerySchema,
  yearExtraDraftSchema,
  yearSchema,
  type YearExtraExpense,
} from "@family-ledger/shared";
import { db } from "../db/index.js";
import { mainCategories, members, yearExtraExpenses } from "../db/schema.js";
import { badRequest, notFound } from "../lib/errors.js";
import { requireAdmin, requireAuth, type AppEnv } from "../middleware/auth.js";
import { buildDashboard } from "../services/dashboard.js";
import { buildStats } from "../services/stats.js";
import { buildYearSummary } from "../services/year.js";

export const summaryRoutes = new Hono<AppEnv>();
summaryRoutes.use("/*", requireAuth);

summaryRoutes.get("/dashboard", zValidator("query", z.object({ month: monthSchema })), async (c) =>
  c.json(await buildDashboard(c.req.valid("query").month))
);

summaryRoutes.get("/stats", zValidator("query", statsQuerySchema), async (c) => {
  const { range, period, payerId } = c.req.valid("query");
  // range=month 需 YYYY-MM，range=year 需 YYYY
  if (range === "month" && period.length !== 7) throw badRequest("月份格式須為 YYYY-MM");
  if (range === "year" && period.length !== 4) throw badRequest("年度格式須為 YYYY");
  return c.json(await buildStats(range, period, payerId));
});

summaryRoutes.get("/year", zValidator("query", z.object({ year: yearSchema })), async (c) =>
  c.json(await buildYearSummary(c.req.valid("query").year))
);

/** 年度額外支出：不分攤到個別月份，僅在年度彙整頁計入。 */
summaryRoutes.post("/year-extras", requireAdmin, zValidator("json", yearExtraDraftSchema), async (c) => {
  const draft = c.req.valid("json");

  const [cat] = await db.select().from(mainCategories).where(eq(mainCategories.id, draft.mainCategoryId)).limit(1);
  if (!cat || cat.type !== "expense") throw badRequest("額外支出只能歸屬支出分類");

  const [payer] = await db.select().from(members).where(eq(members.id, draft.payerId)).limit(1);
  if (!payer) throw badRequest("支付者不存在");

  const [row] = await db.insert(yearExtraExpenses).values(draft).returning();
  return c.json<YearExtraExpense>(row!, 201);
});

summaryRoutes.delete(
  "/year-extras/:id",
  requireAdmin,
  zValidator("param", z.object({ id: idSchema })),
  async (c) => {
    const { id } = c.req.valid("param");
    const [row] = await db
      .delete(yearExtraExpenses)
      .where(eq(yearExtraExpenses.id, id))
      .returning({ id: yearExtraExpenses.id });
    if (!row) throw notFound("項目不存在");
    return c.body(null, 204);
  }
);
