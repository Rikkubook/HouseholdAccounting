import type { ApiError } from "@family-ledger/shared";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** 前端 client.ts 以 { code, message } 呈現錯誤，message 直接給使用者看。 */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly extra?: Record<string, unknown>
  ) {
    super(message);
  }

  toJSON(): ApiError & Record<string, unknown> {
    return { code: this.code, message: this.message, ...this.extra };
  }
}

export const badRequest = (message: string, code = "bad_request") => new HttpError(400, code, message);
export const unauthorized = (message = "請重新登入") => new HttpError(401, "unauthorized", message);
export const forbidden = (message = "沒有此操作的權限") => new HttpError(403, "forbidden", message);
export const notFound = (message = "資料不存在") => new HttpError(404, "not_found", message);
export const conflict = (message: string, code = "conflict") => new HttpError(409, code, message);
