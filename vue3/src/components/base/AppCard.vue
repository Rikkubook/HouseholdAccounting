<script setup lang="ts">
/** 白底 + 1px 邊框，永不加陰影。tone=brand 為紫漸層強調卡，tone=action 為深色可點卡。 */
withDefaults(
  defineProps<{
    tone?: "surface" | "brand" | "action";
    pad?: "default" | "compact" | "none";
    interactive?: boolean;
  }>(),
  { tone: "surface", pad: "default" }
);
</script>

<template>
  <div
    class="rounded-card"
    :class="[
      tone === 'surface' && 'bg-surface border',
      tone === 'brand' && 'bg-brand text-fg-brand',
      tone === 'action' && 'bg-fg-1 text-fg-brand',
      pad === 'default' && 'p-4 md:px-6 md:py-[22px]',
      pad === 'compact' && 'p-4',
      interactive && 'cursor-pointer transition-transform hover:-translate-y-px',
    ]"
  >
    <slot />
  </div>
</template>
