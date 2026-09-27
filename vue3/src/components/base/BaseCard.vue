<script setup lang="ts">
type Tone = "surface" | "brand" | "action";
type Pad = "default" | "compact" | "mobile";

const props = withDefaults(defineProps<{ tone?: Tone; pad?: Pad; interactive?: boolean }>(), {
  tone: "surface",
  pad: "default",
  interactive: false,
});

// 卡片一律以 1px 邊框分層，永不加陰影
const TONE: Record<Tone, string> = {
  surface: "bg-surface border border-card text-fg-1",
  brand: "bg-brand-card border border-transparent text-white",
  action: "bg-action border border-transparent text-white",
};

const PAD: Record<Pad, string> = {
  default: "px-6 py-[22px]",
  compact: "px-5 py-[18px]",
  mobile: "p-4",
};
</script>

<template>
  <section
    class="rounded-card transition-colors duration-150"
    :class="[
      TONE[props.tone],
      PAD[props.pad],
      props.interactive && props.tone === 'surface' && 'cursor-pointer hover:border-card-hover',
      props.interactive && props.tone !== 'surface' && 'cursor-pointer',
    ]"
  >
    <slot />
  </section>
</template>
