import type { MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { members } from "../db/schema.js";
import { readToken } from "../lib/auth.js";
import { forbidden, unauthorized } from "../lib/errors.js";

export interface AuthUser {
  id: number;
  name: string;
  role: "admin" | "member";
}

export type AppEnv = { Variables: { user: AuthUser } };

/** 驗 token → 讀成員 → 檔停用帳號。停用者的既有 token 立即失效。 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw unauthorized();

  const payload = await readToken(token);
  if (!payload) throw unauthorized("登入已過期，請重新登入");

  const [row] = await db
    .select({ id: members.id, name: members.name, role: members.role, isActive: members.isActive })
    .from(members)
    .where(eq(members.id, payload.sub))
    .limit(1);

  if (!row || !row.isActive) throw unauthorized("帳號已停用");

  c.set("user", { id: row.id, name: row.name, role: row.role });
  await next();
};

/** ADMIN 頁面（預算、訂閱、成員、分類）的寫入端點；一般成員連端點都打不到。 */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get("user").role !== "admin") throw forbidden("僅管理者可執行此操作");
  await next();
};
