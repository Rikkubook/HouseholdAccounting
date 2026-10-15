<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { NAV_ITEMS } from "@/router/nav";
import { useAuthStore } from "@/stores/auth";
import { useScopeStore, type ScopeName } from "@/stores/scope";

/** 家庭帳／個人帳切換，所有成員都有。選中的一格白底、用目前帳本的品牌色。 */
const scope = useScopeStore();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

/**
 * 切換後若停在新帳本不顯示的頁面就回到首頁：切到個人帳時的成員管理；
 * 一般成員切回家庭帳時的分類設定（家庭分類限管理者）。
 */
function pick(v: ScopeName) {
  scope.set(v);
  const item = NAV_ITEMS.find((i) => i.name === route.name);
  if (!item) return;
  if (v === "personal" && item.familyOnly) router.push("/");
  if (v === "family" && item.adminOnly && !auth.isAdmin) router.push("/");
}

const OPTIONS: { value: ScopeName; label: string; icon: string }[] = [
  { value: "family", label: "家庭帳", icon: "family_restroom" },
  { value: "personal", label: "個人帳", icon: "person" },
];
</script>

<template>
  <div
    class="grid grid-cols-2 gap-1 bg-canvas border rounded-lg p-1"
    role="group"
    aria-label="帳本"
  >
    <button
      v-for="o in OPTIONS"
      :key="o.value"
      type="button"
      class="flex items-center justify-center gap-1.5 min-h-[36px] rounded-md text-[13px] cursor-pointer transition-colors"
      :class="o.value === scope.current ? 'bg-surface text-brand-600 font-bold' : 'text-fg-2 hover:text-fg-1'"
      :aria-pressed="o.value === scope.current"
      @click="pick(o.value)"
    >
      <span
        class="material-symbols-rounded text-[18px] leading-none"
        :style="o.value === 'personal' ? { fontVariationSettings: '\'FILL\' 1' } : undefined"
      >{{ o.icon }}</span>
      {{ o.label }}
    </button>
  </div>
</template>
