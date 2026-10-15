import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  idSchema,
  monthSchema,
  scopeSchema,
  statsQuerySchema,
  yearExtraDraftSchema,
  yearExtraPatchSchema,
  yearSchema,
  type YearExtraExpense,
} from "@family-ledger/shared";
import { db } from "../db/index.js";
import { mainCategories, members, yearExtraExpenses } from "../db/schema.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { requireAuth, type AppEnv, type AuthUser } from "../middleware/auth.js";
import { buildDashboard } from "../services/dashboard.js";
import { buildStats } from "../services/stats.js";
import { buildYearSummary } from "../services/year.js";
import { resolveScope } from "../services/scope.js";

export const summaryRoutes = new Hono<AppEnv>();
summaryRoutes.use("/*", requireAuth);

const scopeQuery = { scope: scopeSchema.default("family") };

summaryRoutes.get("/dashboard", zValidator("query", z.object({ month: monthSchema, ...scopeQuery })), async (c) => {
  const { month, scope } = c.req.valid("query");
  return c.json(await buildDashboard(month, resolveScope(c.get("user"), scope)));
});

summaryRoutes.get("/stats", zValidator("query", statsQuerySchema), async (c) => {
  const { range, period, payerId, scope } = c.req.valid("query");
  // range=month 需 YYYY-MM，range=year 需 YYYY
  if (range === "month" && period.length !== 7) throw badRequest("月份格式須為 YYYY-MM");
  if (range === "year" && period.length !== 4) throw badRequest("年度格式須為 YYYY");
  return c.json(await buildStats(range, period, payerId, resolveScope(c.get("user"), scope)));
});

summaryRoutes.get("/year", zValidator("query", z.object({ year: yearSchema, ...scopeQuery })), async (c) => {
  const { year, scope } = c.req.valid("query");
  return c.json(await buildYearSummary(year, resolveScope(c.get("user"), scope)));
});

/**
 * 年度額外開銷屬於哪本帳，看它掛的分類（沒有自己的 owner_id，見 services/scope.ts）：
 * 家庭分類＝家庭帳，限管理者；本人的個人分類＝個人帳，本人就能改（個人帳第 2 批）。
 * 別人的個人分類一律當作不存在，管理者也一樣。
 */
function assertCanWriteExtra(user: AuthUser, cat: { ownerId: number | null } | undefined) {
  if (!cat || (cat.ownerId != null && cat.ownerId !== user.id)) return "missing" as const;
  if (cat.ownerId == null && user.role !== "admin") throw forbidden("只有管理者可以修改家庭帳的年度額外開銷");
  return "ok" as const;
}

/** 年度額外支出：不分攤到個別月份，僅在年度彙整頁計入。 */
summaryRoutes.post("/year-extras", zValidator("json", yearExtraDraftSchema), async (c) => {
  const draft = c.req.valid("json");
  const user = c.get("user");

  const [cat] = await db.select().from(mainCategories).where(eq(mainCategories.id, draft.mainCategoryId)).limit(1);
  if (assertCanWriteExtra(user, cat) === "missing" || cat!.type !== "expense") {
    throw badRequest("額外支出只能歸屬支出分類");
  }
  // 個人帳的支付者固定是本人（與個人交易相同）
  if (cat!.ownerId != null && draft.payerId !== user.id) throw badRequest("個人帳的額外開銷支付者只能是自己");

  const [payer] = await db.select().from(members).where(eq(members.id, draft.payerId)).limit(1);
  if (!payer) throw badRequest("支付者不存在");

  const [row] = await db.insert(yearExtraExpenses).values(draft).returning();
  return c.json<YearExtraExpense>(row!, 201);
});

/**
 * 修改年度額外開銷：權限同新增、刪除。分類只能換成同一本帳的支出分類（不能在家庭帳與個人帳之間搬移），
 * 個人帳的支付者仍固定是本人。
 */
summaryRoutes.patch(
  "/year-extras/:id",
  zValidator("param", z.object({ id: idSchema })),
  zValidator("json", yearExtraPatchSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const patch = c.req.valid("json");
    const user = c.get("user");

    const [extra] = await db.select().from(yearExtraExpenses).where(eq(yearExtraExpenses.id, id)).limit(1);
    const [cat] = extra
      ? await db.select().from(mainCategories).where(eq(mainCategories.id, extra.mainCategoryId)).limit(1)
      : [];
    if (!extra || assertCanWriteExtra(user, cat) === "missing") throw notFound("項目不存在");

    if (patch.mainCategoryId !== undefined && patch.mainCategoryId !== extra.mainCategoryId) {
      const [next] = await db.select().from(mainCategories).where(eq(mainCategories.id, patch.mainCategoryId)).limit(1);
      if (!next || next.ownerId !== cat!.ownerId || next.type !== "expense") {
        throw badRequest("只能改成同一本帳的支出分類");
      }
    }
    if (patch.payerId !== undefined && patch.payerId !== extra.payerId) {
      if (cat!.ownerId != null) throw badRequest("個人帳的額外開銷支付者只能是自己");
      const [payer] = await db.select().from(members).where(eq(members.id, patch.payerId)).limit(1);
      if (!payer) throw badRequest("支付者不存在");
    }

    const [row] = await db.update(yearExtraExpenses).set(patch).where(eq(yearExtraExpenses.id, id)).returning();
    return c.json<YearExtraExpense>(row!);
  }
);

summaryRoutes.delete(
  "/year-extras/:id",
  zValidator("param", z.object({ id: idSchema })),
  async (c) => {
    const { id } = c.req.valid("param");
    const [extra] = await db.select().from(yearExtraExpenses).where(eq(yearExtraExpenses.id, id)).limit(1);
    const [cat] = extra
      ? await db.select().from(mainCategories).where(eq(mainCategories.id, extra.mainCategoryId)).limit(1)
      : [];
    if (!extra || assertCanWriteExtra(c.get("user"), cat) === "missing") throw notFound("項目不存在");

    const [row] = await db
      .delete(yearExtraExpenses)
      .where(eq(yearExtraExpenses.id, id))
      .returning({ id: yearExtraExpenses.id });
    if (!row) throw notFound("項目不存在");
    return c.body(null, 204);
  }
);
