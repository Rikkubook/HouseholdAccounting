<script setup lang="ts">
import { SCOPE_OPTIONS, useScopeStore, type ScopeName } from "@/stores/scope";

/** 家庭帳／個人帳切換，只有管理者看得到（個人帳僅限管理者）。 */
const scope = useScopeStore();
</script>

<template>
  <div v-if="scope.canUsePersonal" class="flex gap-1 bg-canvas border rounded-lg p-1" role="group" aria-label="帳本">
    <button
      v-for="o in SCOPE_OPTIONS"
      :key="o.value"
      type="button"
      class="flex-1 min-h-[32px] rounded-sm text-[12.5px] cursor-pointer transition-colors"
      :class="o.value === scope.current ? 'bg-fg-1 text-fg-brand' : 'text-fg-2 hover:bg-surface-subtle'"
      :aria-pressed="o.value === scope.current"
      @click="scope.set(o.value as ScopeName)"
    >
      {{ o.label }}帳
    </button>
  </div>
</template>
