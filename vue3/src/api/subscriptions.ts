import { http } from "./client";
import type { BillingCycle, Subscription, SubscriptionRevision } from "@/types/models";
import type { ScopeName } from "@/stores/scope";

export interface SubscriptionDraft {
  name: string;
  amount: number;
  cycle: BillingCycle;
  nextChargeDate: string;
  /** 扣款記到的分類：同一本帳啟用中的固定支出分類；不傳＝系統分類「訂閱」 */
  mainCategoryId?: number;
  payerId: number;
}

export const subscriptionsApi = {
  /** 家庭帳的訂閱，或登入者自己的個人訂閱 */
  list: (scope: ScopeName) => http.get<Subscription[]>("/subscriptions", { params: { scope } }).then((r) => r.data),

  /** 個人訂閱的扣款人必須是自己；扣款交易記到個人帳 */
  create: (draft: SubscriptionDraft, scope: ScopeName) =>
    http.post<Subscription>("/subscriptions", draft, { params: { scope } }).then((r) => r.data),

  /** 金額或週期變更寫入歷史版本，舊期間仍以當時金額計算。 */
  update: (id: number, patch: Partial<SubscriptionDraft>) =>
    http.patch<Subscription>("/subscriptions/" + id, patch).then((r) => r.data),

  /** 只能停用，不提供刪除。 */
  setActive: (id: number, isActive: boolean) =>
    http.post<Subscription>("/subscriptions/" + id + "/active", { isActive }).then((r) => r.data),


  revisions: (id: number) =>
    http.get<SubscriptionRevision[]>("/subscriptions/" + id + "/revisions").then((r) => r.data),
};
