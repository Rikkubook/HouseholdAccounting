import { http } from "./client";
import type { LoginResponse } from "@/types/models";

export const authApi = {
  /** 連續失敗 5 次由後端回 423 並附剩餘鎖定分鐘數。 */
  login: (account: string, password: string) =>
    http.post<LoginResponse>("/auth/login", { account, password }).then((r) => r.data),

  logout: () => http.post<void>("/auth/logout").then((r) => r.data),

  me: () => http.get<LoginResponse["user"]>("/auth/me").then((r) => r.data),

  /** 憑帳號 + 6 位重設碼自設新密碼；重設碼不設期限、用畢即失效。 */
  resetPassword: (account: string, code: string, newPassword: string) =>
    http.post<void>("/auth/reset-password", { account, code, newPassword }).then((r) => r.data),
};
