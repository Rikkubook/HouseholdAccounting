import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { categoriesApi, type MainCategoryDraft } from "@/api/categories";
import type { MainCategory } from "@/types/models";

export const useCategoriesStore = defineStore("categories", () => {
  const items = ref<MainCategory[]>([]);
  const loading = ref(false);
  /** 只在第一次載入完成前為 true，供頁面判斷是否顯示整頁載入畫面。 */
  const initialLoading = ref(true);

  /** 新增／編輯交易的選單只顯示啟用中的分類。 */
  const selectable = computed(() =>
    items.value
      .filter((c) => c.isActive)
      .map((c) => ({ ...c, subCategories: c.subCategories.filter((s) => s.isActive) }))
  );
  const floating = computed(() => items.value.filter((c) => c.type === "expense" && c.nature === "floating"));
  const fixed = computed(() => items.value.filter((c) => c.type === "expense" && c.nature === "fixed"));

  function byId(id: number | null) {
    return id === null ? undefined : items.value.find((c) => c.id === id);
  }

  async function load() {
    loading.value = true;
    try {
      items.value = await categoriesApi.list(true);
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
    loading,
    initialLoading,
    selectable,
    floating,
    fixed,
    byId,
    load,
    upsert,
    createMain: async (d: MainCategoryDraft) => upsert(await categoriesApi.createMain(d)),
    updateMain: async (id: number, p: Partial<MainCategoryDraft>) => upsert(await categoriesApi.updateMain(id, p)),
    archiveMain: async (id: number) => upsert(await categoriesApi.archiveMain(id)),
    restoreMain: async (id: number) => upsert(await categoriesApi.restoreMain(id)),
    createSub: async (mainId: number, name: string) => upsert(await categoriesApi.createSub(mainId, name)),
    renameSub: async (subId: number, name: string) => upsert(await categoriesApi.renameSub(subId, name)),
    archiveSub: async (subId: number) => upsert(await categoriesApi.archiveSub(subId)),
    restoreSub: async (subId: number) => upsert(await categoriesApi.restoreSub(subId)),
  };
});
