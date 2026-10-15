import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { subscriptionsApi, type SubscriptionDraft } from "@/api/subscriptions";
import type { Subscription } from "@/types/models";
import { displayChargeDate, monthlyEquivalent, todayISO } from "@/utils/format";
import { toLoadErrorKind, type LoadErrorKind } from "@/utils/loadError";
import { activeScope, type ScopeName } from "@/stores/scope";

export const useSubscriptionsStore = defineStore("subscriptions", () => {
  const items = ref<Subscription[]>([]);
  /** items 是哪一本帳的訂閱（個人訂閱 PL2-02） */
  const scope = ref<ScopeName>("family");
  const loading = ref(false);
  /** 只在第一次載入完成前為 true，供頁面判斷是否顯示整頁載入畫面。 */
  const initialLoading = ref(true);
  const error = ref<LoadErrorKind | null>(null);

  const activeItems = computed(() => items.value.filter((s) => s.isActive));
  /** 首頁固定支出總額＝月換算合計（年繳 ÷12）。 */
  const monthlyTotal = computed(() =>
    activeItems.value.reduce((sum, s) => sum + monthlyEquivalent(s.amount, s.cycle), 0)
  );
  const yearlyTotal = computed(() => monthlyTotal.value * 12);

  /** 某成員名下進行中的訂閱筆數（成員停用前必須先改指定他人）。 */
  function activeCountByPayer(payerId: number) {
    return activeItems.value.filter((s) => s.payerId === payerId).length;
  }

  /** 到期提示看實際扣款日；年繳是下一次年繳日，不是每月的分攤日。 */
  function dueLabel(sub: Subscription): string {
    const today = todayISO();
    const date = displayChargeDate(sub);
    if (date < today) return "已逾期";
    if (date === today) return "今天";
    const days = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
    return days <= 7 ? days + " 天後" : "";
  }

  /** 預設載入目前帳本的訂閱；預算頁只看家庭帳，固定傳 "family"。換帳本時先清空 */
  async function load(target: ScopeName = activeScope()) {
    loading.value = true;
    error.value = null;
    if (target !== scope.value) items.value = [];
    scope.value = target;
    try {
      const list = await subscriptionsApi.list(target);
      if (scope.value === target) items.value = list;
    } catch (e) {
      error.value = toLoadErrorKind(e);
    } finally {
      loading.value = false;
      initialLoading.value = false;
    }
  }

  function upsert(s: Subscription) {
    const i = items.value.findIndex((x) => x.id === s.id);
    if (i >= 0) items.value[i] = s;
    else items.value.push(s);
  }

  return {
    items,
    loading,
    initialLoading,
    error,
    activeItems,
    monthlyTotal,
    yearlyTotal,
    activeCountByPayer,
    dueLabel,
    load,
    scope,
    create: async (d: SubscriptionDraft) => upsert(await subscriptionsApi.create(d, scope.value)),
    update: async (id: number, p: Partial<SubscriptionDraft>) => upsert(await subscriptionsApi.update(id, p)),
    setActive: async (id: number, isActive: boolean) => upsert(await subscriptionsApi.setActive(id, isActive)),
  };
});
