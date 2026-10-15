<script setup lang="ts">
import { useScopeStore, type ScopeName } from "@/stores/scope";

/** 家庭帳／個人帳切換，只有管理者看得到（個人帳僅限管理者）。選中的一格白底、用目前帳本的品牌色。 */
const scope = useScopeStore();

const OPTIONS: { value: ScopeName; label: string; icon: string }[] = [
  { value: "family", label: "家庭帳", icon: "family_restroom" },
  { value: "personal", label: "個人帳", icon: "person" },
];
</script>

<template>
  <div
    v-if="scope.canUsePersonal"
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
      @click="scope.set(o.value)"
    >
      <span
        class="material-symbols-rounded text-[18px] leading-none"
        :style="o.value === 'personal' ? { fontVariationSettings: '\'FILL\' 1' } : undefined"
      >{{ o.icon }}</span>
      {{ o.label }}
    </button>
  </div>
</template>
