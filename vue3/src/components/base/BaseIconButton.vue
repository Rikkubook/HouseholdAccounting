<script setup lang="ts">
type Variant = "fab" | "ghost" | "subtle";

const props = withDefaults(defineProps<{ label: string; variant?: Variant; size?: number }>(), {
  variant: "ghost",
  size: 40,
});

const SKIN: Record<Variant, string> = {
  fab: "bg-brand text-white shadow-fab rounded-pill",
  ghost: "bg-transparent text-fg-3 hover:bg-canvas hover:text-fg-2 rounded-md",
  subtle: "bg-surface-muted text-fg-2 rounded-md",
};
</script>

<template>
  <button
    type="button"
    :aria-label="props.label"
    :title="props.label"
    class="inline-flex flex-none items-center justify-center transition-colors duration-150"
    :class="SKIN[props.variant]"
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
  >
    <slot />
  </button>
</template>
