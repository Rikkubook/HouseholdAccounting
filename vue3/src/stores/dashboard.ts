import { defineStore } from "pinia";
import { ref } from "vue";
import { summaryApi, type DashboardPayload } from "@/api/summary";
import { currentMonth } from "@/utils/format";

export const useDashboardStore = defineStore("dashboard", () => {
  /** 期間僅本月與上月，不提供任意月份選擇器。 */
  const month = ref(currentMonth());
  const data = ref<DashboardPayload | null>(null);
  const loading = ref(false);

  async function load(target = month.value) {
    loading.value = true;
    month.value = target;
    try {
      data.value = await summaryApi.dashboard(target);
    } finally {
      loading.value = false;
    }
  }

  return { month, data, loading, load };
});
