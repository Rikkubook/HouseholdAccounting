import { http } from "./client";
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
    http.get<Paged<TransactionView>>("/transactions", { params: query }).then((r) => r.data),

  /** 省略 payerId＝登入者本人；管理者可指定他人（代記）。 */
  create: (draft: TransactionDraft) =>
    http.post<TransactionView>("/transactions", draft).then((r) => r.data),

  /** 收支別不可修改；記帳者僅管理者可改。每次修改寫入 revision。 */
  update: (id: number, patch: TransactionPatch) =>
    http.patch<TransactionView>("/transactions/" + id, patch).then((r) => r.data),

  /** 軟刪除，前台無復原入口。 */
  remove: (id: number) => http.delete<void>("/transactions/" + id).then((r) => r.data),

  revisions: (id: number) =>
    http.get<TransactionRevision[]>("/transactions/" + id + "/revisions").then((r) => r.data),
};
