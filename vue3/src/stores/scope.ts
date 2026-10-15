import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { useAuthStore } from "@/stores/auth";

export type ScopeName = "family" | "personal";

const STORAGE_KEY = "family-ledger.scope";

function readStored(): ScopeName {
  try {
    return localStorage.getItem(STORAGE_KEY) === "personal" ? "personal" : "family";
  } catch {
    return "family";
  }
}

/**
 * 家庭帳／個人帳切換。個人帳只有管理者能用：一般成員（含被降級的管理者）一律是家庭帳。
 * 選擇記在這台裝置上，下次打開沿用。
 */
export const useScopeStore = defineStore("scope", () => {
  const auth = useAuthStore();
  const selected = ref<ScopeName>(readStored());

  const canUsePersonal = computed(() => auth.isAdmin);
  const current = computed<ScopeName>(() => (canUsePersonal.value ? selected.value : "family"));
  const isPersonal = computed(() => current.value === "personal");

  watch(selected, (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // 無痕模式等情況存不了，只影響下次打開的預設值
    }
  });

  function set(scope: ScopeName) {
    selected.value = scope;
  }

  return { current, isPersonal, canUsePersonal, set };
});

/** 給 api/ 模組用：目前的帳本範圍（pinia 掛上後才可呼叫）。 */
export const activeScope = (): ScopeName => useScopeStore().current;

export const SCOPE_OPTIONS = [
  { value: "family", label: "家庭" },
  { value: "personal", label: "個人" },
];
