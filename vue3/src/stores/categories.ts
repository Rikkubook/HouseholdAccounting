import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { categoriesApi, type MainCategoryDraft } from "@/api/categories";
import type { MainCategory } from "@/types/models";
import { toLoadErrorKind, type LoadErrorKind } from "@/utils/loadError";
import { activeScope, type ScopeName } from "@/stores/scope";

export const useCategoriesStore = defineStore("categories", () => {
  const items = ref<MainCategory[]>([]);
  /** items 是哪一本帳的分類：家庭分類與個人分類分開（個人帳第 2 批） */
  const scope = ref<ScopeName>("family");
  const loading = ref(false);
  /** 只在第一次載入完成前為 true，供頁面判斷是否顯示整頁載入畫面。 */
  const initialLoading = ref(true);
  const error = ref<LoadErrorKind | null>(null);

  /** 新增／編輯交易的選單只顯示啟用中的分類。 */
  const selectable = computed(() =>
    items.value
      .filter((c) => c.isActive)
      .map((c) => ({ ...c, subCategories: c.subCategories.filter((s) => s.isActive) }))
  );
  const floating = computed(() => items.value.filter((c) => c.type === "expense" && c.nature === "floating"));
  const fixed = computed(() => items.value.filter((c) => c.type === "expense" && c.nature === "fixed"));
  const hasInvestment = computed(() => items.value.some((c) => c.type === "investment"));

  function byId(id: number | null) {
    return id === null ? undefined : items.value.find((c) => c.id === id);
  }

  /**
   * 預設載入目前帳本的分類。預算、訂閱只有家庭帳，那兩頁固定傳 "family"。
   * 換帳本時先清空，避免畫面短暫顯示另一本帳的分類。
   */
  async function load(target: ScopeName = activeScope()) {
    loading.value = true;
    error.value = null;
    if (target !== scope.value) items.value = [];
    scope.value = target;
    try {
      const list = await categoriesApi.list(target, true);
      // 載入期間又切了帳本：丟掉舊的結果
      if (scope.value === target) items.value = list;
    } catch (e) {
      error.value = toLoadErrorKind(e);
    } finally {
      loading.value = false;
      initialLoading.value = false;
    }
  }

  function upsert(cat: MainCategory) {
    const i = items.value.findIndex((c) => c.id === cat.id);
    if (i >= 0) items.value[i] = cat;
    else items.value.push(cat);
  }

  return {
    items,
    scope,
    hasInvestment,
    loading,
    initialLoading,
    error,
    selectable,
    floating,
    fixed,
    byId,
    load,
    upsert,
    createMain: async (d: MainCategoryDraft) => upsert(await categoriesApi.createMain(d, scope.value)),
    updateMain: async (id: number, p: Partial<MainCategoryDraft>) => upsert(await categoriesApi.updateMain(id, p)),
    archiveMain: async (id: number) => upsert(await categoriesApi.archiveMain(id)),
    restoreMain: async (id: number) => upsert(await categoriesApi.restoreMain(id)),
    createSub: async (mainId: number, name: string) => upsert(await categoriesApi.createSub(mainId, name)),
    renameSub: async (subId: number, name: string) => upsert(await categoriesApi.renameSub(subId, name)),
    archiveSub: async (subId: number) => upsert(await categoriesApi.archiveSub(subId)),
    restoreSub: async (subId: number) => upsert(await categoriesApi.restoreSub(subId)),
  };
});
