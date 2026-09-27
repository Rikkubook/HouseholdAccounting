import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import {
  idSchema,
  memberDraftSchema,
  memberPatchSchema,
  setActiveSchema,
  type Member,
} from "@family-ledger/shared";
import { db } from "../db";
import { members, subscriptions } from "../db/schema";
import { generateResetCode } from "../lib/auth";
import { conflict, notFound } from "../lib/errors";
import { currentMonth } from "../lib/dates";
import { requireAdmin, requireAuth, type AppEnv } from "../middleware/auth";
import type { MemberRow } from "../db/schema";

/** passwordHash 與登入失敗計數永不外流。resetCode 明文回傳，供管理者轉達給成員。 */
export const toMember = (row: MemberRow): Member => ({
  id: row.id,
  name: row.name,
  account: row.account,
  role: row.role,
  isActive: row.isActive,
  color: row.color,
  joinedMonth: row.joinedMonth,
  resetCode: row.resetCode,
});

const idParam = zValidator("param", z.object({ id: idSchema }));

export const memberRoutes = new Hono<AppEnv>();
memberRoutes.use("/*", requireAuth);

// 記帳者下拉、篩選器都需要成員清單，故讀取開放給全員；寫入一律 ADMIN
memberRoutes.get("/", async (c) => {
  const rows = await db.select().from(members).orderBy(asc(members.id));
  return c.json(rows.map(toMember));
});

memberRoutes.post("/", requireAdmin, zValidator("json", memberDraftSchema), async (c) => {
  const draft = c.req.valid("json");

  const [dupe] = await db.select({ id: members.id }).from(members).where(eq(members.account, draft.account)).limit(1);
  if (dupe) throw conflict("此帳號已被使用", "account_taken");

  // 管理者不設定密碼：initialCode 存為重設碼，成員於重設密碼頁自設
  const [row] = await db
    .insert(members)
    .values({
      name: draft.name,
      account: draft.account,
      role: draft.role,
      color: draft.color,
      joinedMonth: currentMonth(),
      resetCode: draft.initialCode,
      passwordHash: null,
    })
    .returning();

  return c.json(toMember(row!), 201);
});

memberRoutes.patch("/:id", requireAdmin, idParam, zValidator("json", memberPatchSchema), async (c) => {
  const { id } = c.req.valid("param");
  const patch = c.req.valid("json");

  const [target] = await db.select().from(members).where(eq(members.id, id)).limit(1);
  if (!target) throw notFound("成員不存在");

  if (patch.account && patch.account !== target.account) {
    const [dupe] = await db.select({ id: members.id }).from(members).where(eq(members.account, patch.account)).limit(1);
    if (dupe) throw conflict("此帳號已被使用", "account_taken");
  }

  // 不得降權最後一位管理者
  if (patch.role === "member" && target.role === "admin") {
    await assertNotLastAdmin(id);
  }

  const [row] = await db.update(members).set(patch).where(eq(members.id, id)).returning();
  return c.json(toMember(row!));
});

/** 停用（軟刪除）。擋：最後一位管理者、目前登入者、名下仍有進行中訂閱。 */
memberRoutes.post("/:id/active", requireAdmin, idParam, zValidator("json", setActiveSchema), async (c) => {
  const { id } = c.req.valid("param");
  const { isActive } = c.req.valid("json");

  const [target] = await db.select().from(members).where(eq(members.id, id)).limit(1);
  if (!target) throw notFound("成員不存在");

  if (!isActive) {
    if (id === c.get("user").id) throw conflict("不能停用自己的帳號", "self_deactivate");
    if (target.role === "admin") await assertNotLastAdmin(id);

    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(and(eq(subscriptions.payerId, id), eq(subscriptions.isActive, true)));
    if (count > 0) {
      throw conflict("此成員仍是 " + count + " 筆進行中訂閱的扣款人，請先改由他人扣款", "member_has_subscriptions");
    }
  }

  const [row] = await db.update(members).set({ isActive }).where(eq(members.id, id)).returning();
  return c.json(toMember(row!));
});

/** 產生 6 位重設碼（不設期限）。管理者不會知道密碼。 */
memberRoutes.post("/:id/reset-request", requireAdmin, idParam, async (c) => {
  const { id } = c.req.valid("param");
  const code = generateResetCode();

  const [row] = await db.update(members).set({ resetCode: code }).where(eq(members.id, id)).returning();
  if (!row) throw notFound("成員不存在");

  return c.json({ resetCode: code });
});

memberRoutes.delete("/:id/reset-request", requireAdmin, idParam, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db.update(members).set({ resetCode: null }).where(eq(members.id, id)).returning();
  if (!row) throw notFound("成員不存在");
  return c.body(null, 204);
});

async function assertNotLastAdmin(excludeId: number): Promise<void> {
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(members)
    .where(and(eq(members.role, "admin"), eq(members.isActive, true), ne(members.id, excludeId)));
  if (count === 0) throw conflict("至少須保留一位管理者", "last_admin");
}
