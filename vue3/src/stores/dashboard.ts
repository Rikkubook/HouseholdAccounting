import { defineStore } from "pinia";
import { ref } from "vue";
import { summaryApi, type DashboardPayload } from "@/api/summary";
import { currentMonth } from "@/utils/format";
import { toLoadErrorKind, type LoadErrorKind } from "@/utils/loadError";

export const useDashboardStore = defineStore("dashboard", () => {
  /** 期間僅本月與上月，不提供任意月份選擇器。 */
  const month = ref(currentMonth());
  const data = ref<DashboardPayload | null>(null);
  const loading = ref(false);
  /** 只在第一次載入完成前為 true；切換本月/上月重新查詢時維持 false。 */
  const initialLoading = ref(true);
  const error = ref<LoadErrorKind | null>(null);

  async function load(target = month.value) {
    loading.value = true;
    error.value = null;
    month.value = target;
    try {
      data.value = await summaryApi.dashboard(target);
    } catch (e) {
      error.value = toLoadErrorKind(e);
    } finally {
      loading.value = false;
      initialLoading.value = false;
    }
  }

  return { month, data, loading, initialLoading, error, load };
});
