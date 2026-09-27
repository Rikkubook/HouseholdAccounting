import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { loginBodySchema, resetPasswordBodySchema, type LoginResponse, type Member } from "@family-ledger/shared";
import { db } from "../db";
import { members } from "../db/schema";
import {
  LOCK_MINUTES,
  MAX_FAILED_ATTEMPTS,
  hashPassword,
  signToken,
  verifyPassword,
} from "../lib/auth";
import { HttpError, unauthorized } from "../lib/errors";
import { requireAuth, type AppEnv } from "../middleware/auth";
import { toMember } from "./members";

export const authRoutes = new Hono<AppEnv>();

/** 錯誤訊息不區分「帳號不存在」與「密碼錯誤」，避免帳號探測（specs/01 規則 2）。 */
const badCredentials = () => unauthorized("帳號或密碼錯誤");

authRoutes.post("/login", zValidator("json", loginBodySchema), async (c) => {
  const { account, password } = c.req.valid("json");
  const now = new Date();

  const [row] = await db.select().from(members).where(eq(members.account, account)).limit(1);

  // 帳號不存在時仍走一次雜湊比對，讓回應時間不洩漏帳號是否存在
  if (!row || !row.isActive) {
    await verifyPassword(password, null);
    throw badCredentials();
  }

  // 鎖定期間即使密碼正確也不放行（specs/01 規則 4）
  if (row.lockedUntil && row.lockedUntil > now) {
    const minutes = Math.ceil((row.lockedUntil.getTime() - now.getTime()) / 60000);
    throw new HttpError(423, "account_locked", "已連續登入失敗 " + MAX_FAILED_ATTEMPTS + " 次，請於 " + minutes + " 分鐘後再試", {
      lockedMinutes: minutes,
    });
  }

  if (!(await verifyPassword(password, row.passwordHash))) {
    const attempts = row.failedAttempts + 1;
    const lock = attempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCK_MINUTES * 60000) : null;
    await db
      .update(members)
      .set({ failedAttempts: attempts, lockedUntil: lock })
      .where(eq(members.id, row.id));

    if (lock) {
      throw new HttpError(423, "account_locked", "已連續登入失敗 " + MAX_FAILED_ATTEMPTS + " 次，請於 " + LOCK_MINUTES + " 分鐘後再試", {
        lockedMinutes: LOCK_MINUTES,
      });
    }
    throw badCredentials();
  }

  const { token, expiresIn, anchor } = await signToken(row, now);

  // 成功登入後計數歸零；首次登入時間為 token 到期錨點，之後不更新
  await db
    .update(members)
    .set({ failedAttempts: 0, lockedUntil: null, firstLoginAt: anchor })
    .where(eq(members.id, row.id));

  const payload: LoginResponse = { token, expiresIn, user: toMember({ ...row, firstLoginAt: anchor }) };
  return c.json(payload);
});

/** 前端只清 localStorage；此端點存在是為了讓 client.ts 的呼叫有對應，不做伺服器端狀態。 */
authRoutes.post("/logout", (c) => c.body(null, 204));

authRoutes.get("/me", requireAuth, async (c) => {
  const [row] = await db.select().from(members).where(eq(members.id, c.get("user").id)).limit(1);
  if (!row) throw unauthorized();
  return c.json<Member>(toMember(row));
});

/**
 * 憑帳號 + 6 位重設碼自設新密碼。碼一次性、不設期限（specs/02 規則 1）。
 * 錯誤訊息不區分「帳號錯」與「碼錯」；已停用帳號不接受重設。
 */
authRoutes.post("/reset-password", zValidator("json", resetPasswordBodySchema), async (c) => {
  const { account, code, newPassword } = c.req.valid("json");

  const [row] = await db.select().from(members).where(eq(members.account, account)).limit(1);
  if (!row || !row.isActive || !row.resetCode || row.resetCode !== code) {
    throw new HttpError(400, "invalid_reset", "帳號或重設碼不正確");
  }

  // 完成後重設碼立即失效，並清除失敗計數與鎖定狀態（規則 5）
  await db
    .update(members)
    .set({
      passwordHash: await hashPassword(newPassword),
      resetCode: null,
      failedAttempts: 0,
      lockedUntil: null,
    })
    .where(eq(members.id, row.id));

  return c.body(null, 204);
});
