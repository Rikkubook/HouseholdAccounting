import { defineStore } from "pinia";
import { ref } from "vue";
import { summaryApi, type DashboardPayload } from "@/api/summary";
import { useScopeStore } from "@/stores/scope";
import { currentMonth } from "@/utils/format";
import { toLoadErrorKind, type LoadErrorKind } from "@/utils/loadError";

export const useDashboardStore = defineStore("dashboard", () => {
  const scope = useScopeStore();
  /** 期間僅本月與上月，不提供任意月份選擇器。 */
  const month = ref(currentMonth());
  const data = ref<DashboardPayload | null>(null);
  /** 正在等一份還沒有快取的資料：畫面要提示「載入中」，不然切換後數字不動，看起來像壞掉 */
  const loading = ref(false);
  /** 只在第一次載入完成前為 true；之後切換時改用 loading 在原畫面上提示。 */
  const initialLoading = ref(true);
  const error = ref<LoadErrorKind | null>(null);

  /**
   * 看過的月份先留著（依帳本＋月份）：第一次切到某個月份時載入（畫面提示載入中），
   * 之後切回去立刻顯示，同時在背景更新。不預先載入沒看過的月份（2026-10-16 使用者決定）。
   */
  const cache = new Map<string, DashboardPayload>();
  const keyOf = (target: string) => scope.current + "|" + target;
  /** 只採用最後一次要求的結果，快速來回切換時慢回來的舊資料不會蓋掉新的 */
  let latest = 0;

  async function fetchMonth(target: string): Promise<DashboardPayload> {
    const payload = await summaryApi.dashboard(target);
    cache.set(keyOf(target), payload);
    return payload;
  }

  async function load(target = month.value) {
    const ticket = ++latest;
    month.value = target;
    error.value = null;
    const cached = cache.get(keyOf(target));
    if (cached) data.value = cached;
    loading.value = !cached;
    try {
      const payload = await fetchMonth(target);
      if (ticket === latest) data.value = payload;
    } catch (e) {
      // 已經有快取在畫面上就不打斷，下次切換會再試；沒有資料才顯示失敗畫面
      if (ticket === latest && !cached) error.value = toLoadErrorKind(e);
    } finally {
      if (ticket === latest) {
        loading.value = false;
        initialLoading.value = false;
      }
    }
  }

  return { month, data, loading, initialLoading, error, load };
});
