import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { useAuthStore } from "@/stores/auth";

export type ScopeName = "family" | "personal";

/** 每個帳號各記各的：同一台裝置換人登入，不會沿用上一個人的帳本 */
const storageKey = (userId: number) => "family-ledger.scope." + userId;

function readStored(userId: number | undefined): ScopeName {
  if (userId == null) return "family";
  try {
    return localStorage.getItem(storageKey(userId)) === "personal" ? "personal" : "family";
  } catch {
    return "family";
  }
}

/**
 * 家庭帳／個人帳切換。個人帳只有管理者能用：一般成員（含被降級的管理者）一律是家庭帳。
 * 選擇依帳號記在這台裝置上，下次打開沿用。
 */
export const useScopeStore = defineStore("scope", () => {
  const auth = useAuthStore();
  const selected = ref<ScopeName>(readStored(auth.user?.id));
  // 登入、登出或換人時讀回該帳號上次的選擇
  watch(
    () => auth.user?.id,
    (id) => {
      selected.value = readStored(id);
    }
  );

  const canUsePersonal = computed(() => auth.isAdmin);
  const current = computed<ScopeName>(() => (canUsePersonal.value ? selected.value : "family"));
  const isPersonal = computed(() => current.value === "personal");

  // 讓 tokens.css 依帳本換品牌色
  watch(
    current,
    (v) => {
      document.documentElement.dataset.ledger = v;
    },
    { immediate: true }
  );

  function set(scope: ScopeName) {
    selected.value = scope;
    const id = auth.user?.id;
    if (id == null) return;
    try {
      localStorage.setItem(storageKey(id), scope);
    } catch {
      // 無痕模式等情況存不了，只影響下次打開的預設值
    }
  }

  return { current, isPersonal, canUsePersonal, set };
});

/** 給 api/ 模組用：目前的帳本範圍（pinia 掛上後才可呼叫）。 */
export const activeScope = (): ScopeName => useScopeStore().current;
