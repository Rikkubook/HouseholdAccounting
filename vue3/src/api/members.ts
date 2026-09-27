import { http } from "./client";
import type { Member, Role } from "@/types/models";

export interface MemberDraft {
  name: string;
  account: string;
  /** 6 位初始代碼，成員憑此於重設密碼頁自設密碼 */
  initialCode: string;
  role: Role;
  color: string;
}

export const membersApi = {
  list: () => http.get<Member[]>("/members").then((r) => r.data),

  create: (draft: MemberDraft) => http.post<Member>("/members", draft).then((r) => r.data),

  update: (id: number, patch: Partial<Omit<MemberDraft, "initialCode">>) =>
    http.patch<Member>("/members/" + id, patch).then((r) => r.data),

  /**
   * 停用（軟刪除）。後端於下列情況擋下：
   * 最後一位管理者、目前登入者、名下仍有進行中訂閱（作為扣款人）。
   */
  setActive: (id: number, isActive: boolean) =>
    http.post<Member>("/members/" + id + "/active", { isActive }).then((r) => r.data),

  /** 產生 6 位重設碼（不設期限），管理者不會知道密碼。 */
  requestPasswordReset: (id: number) =>
    http.post<{ resetCode: string }>("/members/" + id + "/reset-request").then((r) => r.data),

  cancelPasswordReset: (id: number) =>
    http.delete<void>("/members/" + id + "/reset-request").then((r) => r.data),
};
