import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { authApi } from "@/api/auth";
import { TOKEN_KEY } from "@/api/client";
import { router } from "@/router";
import type { Member } from "@/types/models";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<Member | null>(null);
  const loading = ref(false);
  /** 後端回 423 時附剩餘鎖定分鐘數（連續失敗 5 次鎖 15 分鐘） */
  const lockedMinutes = ref(0);
  const error = ref("");

  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === "admin");
  const roleLabel = computed(() => (isAdmin.value ? "管理者" : "一般成員"));

  async function login(account: string, password: string) {
    loading.value = true;
    error.value = "";
    lockedMinutes.value = 0;
    try {
      const res = await authApi.login(account.trim(), password);
      localStorage.setItem(TOKEN_KEY, res.token);
      user.value = res.user;
      await router.push({ name: "dashboard" });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string; lockedMinutes?: number };
      if (err.code === "account_locked") {
        lockedMinutes.value = err.lockedMinutes ?? 15;
        error.value = "已連續錯誤 5 次，請於 " + lockedMinutes.value + " 分鐘後再試";
      } else {
        // 不區分帳號不存在與密碼錯誤，避免帳號探測
        error.value = "帳號或密碼錯誤";
      }
    } finally {
      loading.value = false;
    }
  }

  /** Session 自首次登入起固定 6 個月到期，期間不因使用而續期。 */
  async function restore() {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    try {
      user.value = await authApi.me();
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      user.value = null;
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      user.value = null;
      await router.push({ name: "login" });
    }
  }

  return { user, loading, error, lockedMinutes, isAuthenticated, isAdmin, roleLabel, login, restore, logout };
});
