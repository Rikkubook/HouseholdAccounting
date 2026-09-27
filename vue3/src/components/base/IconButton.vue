<script setup lang="ts">
withDefaults(
  defineProps<{
    icon: string;
    label: string;
    variant?: "ghost" | "subtle" | "danger";
    size?: number;
  }>(),
  { variant: "ghost", size: 36 }
);
</script>

<template>
  <button
    type="button"
    :title="label"
    :aria-label="label"
    class="inline-flex items-center justify-center rounded-md cursor-pointer transition-colors"
    :class="{
      'text-fg-3 hover:bg-surface-muted': variant === 'ghost',
      'bg-surface border border-strong text-fg-2 hover:bg-surface-subtle': variant === 'subtle',
      'text-fg-disabled hover:bg-danger-tint hover:text-state-over': variant === 'danger',
    }"
    :style="{ width: size + 'px', height: size + 'px' }"
  >
    <span class="material-symbols-rounded" :style="{ fontSize: Math.round(size * 0.48) + 'px' }">{{ icon }}</span>
  </button>
</template>
