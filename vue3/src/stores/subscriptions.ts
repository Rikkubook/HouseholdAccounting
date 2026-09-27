import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { subscriptionsApi, type SubscriptionDraft } from "@/api/subscriptions";
import type { Subscription } from "@/types/models";
import { monthlyEquivalent, todayISO } from "@/utils/format";

export const useSubscriptionsStore = defineStore("subscriptions", () => {
  const items = ref<Subscription[]>([]);
  const loading = ref(false);

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

  function dueLabel(sub: Subscription): string {
    const today = todayISO();
    if (sub.nextChargeDate < today) return "已逾期";
    if (sub.nextChargeDate === today) return "今天";
    const days = Math.round((Date.parse(sub.nextChargeDate) - Date.parse(today)) / 86400000);
    return days <= 7 ? days + " 天後" : "";
  }

  async function load() {
    loading.value = true;
    try {
      items.value = await subscriptionsApi.list();
    } finally {
      loading.value = false;
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
    activeItems,
    monthlyTotal,
    yearlyTotal,
    activeCountByPayer,
    dueLabel,
    load,
    create: async (d: SubscriptionDraft) => upsert(await subscriptionsApi.create(d)),
    update: async (id: number, p: Partial<SubscriptionDraft>) => upsert(await subscriptionsApi.update(id, p)),
    setActive: async (id: number, isActive: boolean) => upsert(await subscriptionsApi.setActive(id, isActive)),
    /** 依本期扣款日產生交易（金額取設定、記帳者取扣款人），再推算下次扣款日。 */
    markPaid: async (id: number) => {
      const { subscription } = await subscriptionsApi.markPaid(id);
      upsert(subscription);
      return subscription;
    },
  };
});
