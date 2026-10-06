import { http } from "./client";
import { activeScope } from "@/stores/scope";
import type { TransactionDraft, TransactionPatch, TransactionRevision, TransactionView } from "@/types/models";

export interface TransactionQuery {
  month?: string;
  type?: "all" | "expense" | "income";
  mainCategoryId?: number | null;
  payerId?: number | null;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const transactionsApi = {
  list: (query: TransactionQuery) =>
    http.get<Paged<TransactionView>>("/transactions", { params: { ...query, scope: activeScope() } }).then((r) => r.data),

  /** 記帳者由後端取登入者，前端不送 payerId。 */
  create: (draft: TransactionDraft) =>
    http.post<TransactionView>("/transactions", { scope: activeScope(), ...draft }).then((r) => r.data),

  /** 收支別與記帳者不可修改。每次修改寫入 revision。 */
  update: (id: number, patch: TransactionPatch) =>
    http.patch<TransactionView>("/transactions/" + id, patch).then((r) => r.data),

  /** 軟刪除，前台無復原入口。 */
  remove: (id: number) => http.delete<void>("/transactions/" + id).then((r) => r.data),

  revisions: (id: number) =>
    http.get<TransactionRevision[]>("/transactions/" + id + "/revisions").then((r) => r.data),
};
