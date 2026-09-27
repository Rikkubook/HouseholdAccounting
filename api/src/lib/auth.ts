import { hash, verify } from "@node-rs/argon2";
import { SignJWT, jwtVerify } from "jose";
import { randomInt } from "node:crypto";
import { env } from "../env.js";

const secret = new TextEncoder().encode(env.JWT_SECRET);

/** Session 自首次登入起固定 6 個月，期間不因使用而續期（specs/01-登入頁.md 規則 3）。 */
export const SESSION_DAYS = 182;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

/** 連續失敗 5 次鎖 15 分鐘（specs/01-登入頁.md 規則 4）。 */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export const hashPassword = (plain: string) =>
  hash(plain, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

export async function verifyPassword(plain: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
}

/** 6 位數字，一次性使用，不設有效期限。 */
export const generateResetCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, "0");

export interface TokenPayload {
  sub: number;
  role: "admin" | "member";
}

/**
 * exp 錨定在首次登入時間，之後每次登入沿用同一到期時間。
 * 若錨點已逾期，重新錨定為現在——否則帳號會在 6 個月後永久登不進來。
 */
export async function signToken(
  member: { id: number; role: "admin" | "member"; firstLoginAt: Date | null },
  now = new Date()
): Promise<{ token: string; expiresIn: number; anchor: Date }> {
  const anchor =
    member.firstLoginAt && member.firstLoginAt.getTime() + SESSION_MS > now.getTime()
      ? member.firstLoginAt
      : now;

  const expiresAt = new Date(anchor.getTime() + SESSION_MS);
  const token = await new SignJWT({ role: member.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(member.id))
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret);

  return {
    token,
    expiresIn: Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)),
    anchor,
  };
}

export async function readToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const sub = Number(payload.sub);
    const role = payload.role;
    if (!Number.isInteger(sub) || (role !== "admin" && role !== "member")) return null;
    return { sub, role };
  } catch {
    return null;
  }
}
