import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { budgetsApi } from "@/api/budgets";
import { summaryApi } from "@/api/summary";
import type { Budget } from "@/types/models";
import { currentMonth, monthlyEquivalent } from "@/utils/format";

export const BUDGET_THRESHOLD = 70;

export const useBudgetsStore = defineStore("budgets", () => {
  const month = ref(currentMonth());
  const items = ref<Budget[]>([]);
  /** 固定支出總額由訂閱月換算（年繳 ÷12），不可手填。 */
  const fixedTotal = ref(0);
  const spentByCategory = ref<Record<number, number>>({});
  const loading = ref(false);

  const total = computed(() => items.value.reduce((s, b) => s + b.amount, 0) + fixedTotal.value);

  function amountOf(mainCategoryId: number): number | null {
    return items.value.find((b) => b.mainCategoryId === mainCategoryId)?.amount ?? null;
  }

  async function load(target = month.value) {
    loading.value = true;
    month.value = target;
    try {
      const [list, fixed, stats] = await Promise.all([
        budgetsApi.byMonth(target),
        budgetsApi.fixedTotal(target),
        summaryApi.stats("month", target),
      ]);
      items.value = list;
      fixedTotal.value = fixed.amount;
      spentByCategory.value = Object.fromEntries(stats.floating.map((r) => [r.mainCategoryId, r.amount]));
    } finally {
      loading.value = false;
    }
  }

  return {
    month,
    items,
    fixedTotal,
    spentByCategory,
    loading,
    total,
    amountOf,
    load,
    /** 浮動支出必須設上限，不可停用預算。 */
    save: async (mainCategoryId: number, amount: number) => {
      const saved = await budgetsApi.upsert(month.value, mainCategoryId, amount);
      const i = items.value.findIndex((b) => b.mainCategoryId === mainCategoryId);
      if (i >= 0) items.value[i] = saved;
      else items.value.push(saved);
    },
    copyPrevious: async () => {
      items.value = await budgetsApi.copyFromPreviousMonth(month.value);
    },
    monthlyEquivalent,
  };
});
