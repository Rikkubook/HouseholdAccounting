<script setup lang="ts">
withDefaults(
  defineProps<{ tone?: "neutral" | "brand" | "outline" | "success"; mono?: boolean; small?: boolean }>(),
  { tone: "neutral" }
);
</script>

<template>
  <span
    class="inline-flex items-center whitespace-nowrap"
    :class="[
      small ? 'text-[9.5px] px-[5px] py-[2px] rounded-[5px]' : 'text-[11.5px] px-[9px] py-[4px] rounded-pill',
      mono && 'font-mono tracking-[0.08em]',
      tone === 'neutral' && 'bg-surface-muted text-fg-3',
      tone === 'brand' && 'bg-brand-tint text-brand-600',
      tone === 'outline' && 'border border-strong text-fg-2',
      tone === 'success' && 'bg-success-tint text-success',
    ]"
  >
    <slot />
  </span>
</template>
