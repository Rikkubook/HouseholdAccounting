import { http } from "./client";
import type { BillingCycle, Subscription, SubscriptionRevision, TransactionView } from "@/types/models";

export interface SubscriptionDraft {
  name: string;
  amount: number;
  cycle: BillingCycle;
  nextChargeDate: string;
  /** 不傳分類：訂閱一律歸屬系統分類「訂閱」，由後端填入 */
  payerId: number;
}

export const subscriptionsApi = {
  list: () => http.get<Subscription[]>("/subscriptions").then((r) => r.data),

  create: (draft: SubscriptionDraft) =>
    http.post<Subscription>("/subscriptions", draft).then((r) => r.data),

  /** 金額或週期變更寫入歷史版本，舊期間仍以當時金額計算。 */
  update: (id: number, patch: Partial<SubscriptionDraft>) =>
    http.patch<Subscription>("/subscriptions/" + id, patch).then((r) => r.data),

  /** 只能停用，不提供刪除。 */
  setActive: (id: number, isActive: boolean) =>
    http.post<Subscription>("/subscriptions/" + id + "/active", { isActive }).then((r) => r.data),

  /**
   * 標記已扣款：後端以本期扣款日產生一筆交易（金額取訂閱設定、記帳者取扣款人），
   * 再推算下次扣款日。實際金額不同時由扣款人或管理者到交易列表修改該筆。
   */
  markPaid: (id: number) =>
    http
      .post<{ subscription: Subscription; transaction: TransactionView }>("/subscriptions/" + id + "/mark-paid")
      .then((r) => r.data),

  revisions: (id: number) =>
    http.get<SubscriptionRevision[]>("/subscriptions/" + id + "/revisions").then((r) => r.data),
};
