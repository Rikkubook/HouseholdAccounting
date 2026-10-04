import { vi } from "vitest";
import { app } from "../src/app.js";
import { signToken } from "../src/lib/auth.js";

/**
 * 測試裡的「今天」。seed 的交易落在 2026-01～09 每月 3～28 日，
 * 9/15 讓 9 月有一半是已發生、一半是未來日期（預定支出），兩種情況都測得到。
 */
export const TODAY = "2026-09-15T12:00:00+08:00";

/** 只假造 Date，不動 setTimeout：app.ts 的逾時中介層與 postgres.js 都靠真的計時器。 */
export function freezeToday() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(TODAY));
}

/** seed 的成員：1 先生（管理者）、2 太太（管理者）、3 小妹（一般成員） */
const MEMBERS = {
  dad: { id: 1, role: "admin" },
  mom: { id: 2, role: "admin" },
  sis: { id: 3, role: "member" },
} as const;

export type As = keyof typeof MEMBERS;

const tokens = new Map<As, string>();

async function tokenFor(who: As): Promise<string> {
  const cached = tokens.get(who);
  if (cached) return cached;
  const { token } = await signToken({ ...MEMBERS[who], firstLoginAt: null });
  tokens.set(who, token);
  return token;
}

/** 以指定成員身分呼叫 API，直接走 app.request，不需起 HTTP 伺服器。 */
export async function api<T = unknown>(
  path: string,
  { as = "dad", method = "GET", body }: { as?: As; method?: string; body?: unknown } = {}
): Promise<{ status: number; body: T }> {
  const res = await app.request("/api" + path, {
    method,
    headers: {
      Authorization: "Bearer " + (await tokenFor(as)),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}
