import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { transactionsApi, type Paged, type TransactionQuery } from "@/api/transactions";
import type { TransactionPatch, TransactionView } from "@/types/models";
import { currentMonth } from "@/utils/format";
import { toLoadErrorKind, type LoadErrorKind } from "@/utils/loadError";

export const PAGE_SIZE = 20;

export const useTransactionsStore = defineStore("transactions", () => {
  const query = ref<TransactionQuery>({
    month: currentMonth(),
    type: "all",
    mainCategoryId: null,
    payerId: null,
    keyword: "",
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const result = ref<Paged<TransactionView>>({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
  const loading = ref(false);
  /** 只在第一次載入完成前為 true；篩選/換頁重新查詢時維持 false，避免整個篩選列被 loading 畫面蓋掉。 */
  const initialLoading = ref(true);
  const error = ref<LoadErrorKind | null>(null);

  const isEmpty = computed(() => !loading.value && result.value.items.length === 0);

  /** 手機版按日期分組並附當日小計。 */
  const groupedByDate = computed(() => {
    const map = new Map<string, TransactionView[]>();
    for (const tx of result.value.items) {
      const list = map.get(tx.date) ?? [];
      list.push(tx);
      map.set(tx.date, list);
    }
    return [...map.entries()].map(([date, items]) => ({
      date,
      items,
      subtotal: items.reduce((sum, t) => sum + (t.type === "expense" ? t.amount : 0), 0),
    }));
  });

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      result.value = await transactionsApi.list(query.value);
    } catch (e) {
      error.value = toLoadErrorKind(e);
    } finally {
      loading.value = false;
      initialLoading.value = false;
    }
  }

  function setFilter(patch: Partial<TransactionQuery>) {
    query.value = { ...query.value, ...patch, page: patch.page ?? 1 };
    return load();
  }

  return {
    query,
    result,
    loading,
    initialLoading,
    error,
    isEmpty,
    groupedByDate,
    load,
    setFilter,
    update: async (id: number, patch: TransactionPatch) => {
      await transactionsApi.update(id, patch);
      await load();
    },
    /** 軟刪除，前台無復原入口。 */
    remove: async (id: number) => {
      await transactionsApi.remove(id);
      await load();
    },
    revisions: transactionsApi.revisions,
  };
});
