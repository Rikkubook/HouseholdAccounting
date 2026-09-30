import type { ApiError } from "@/types/models";

/** AppLoading 失敗畫面的三種原因 */
export type LoadErrorKind = "offline" | "server" | "notfound";

/** 把 API 錯誤轉成失敗畫面要顯示的原因 */
export function toLoadErrorKind(error: ApiError | unknown): LoadErrorKind {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  const code = (error as ApiError | undefined)?.code;
  if (code === "not_found") return "notfound";
  return "server";
}
