<script setup lang="ts">
type Tone = "neutral" | "brand" | "outline";

const props = withDefaults(defineProps<{ tone?: Tone; mono?: boolean }>(), {
  tone: "neutral",
  mono: false,
});

const TONE: Record<Tone, string> = {
  neutral: "bg-surface-muted text-fg-2",
  brand: "bg-brand-tint text-brand-600",
  outline: "bg-transparent text-fg-3 border border-card",
};
</script>

<template>
  <span
    class="inline-flex items-center whitespace-nowrap rounded-pill px-[9px] py-[3px]"
    :class="[TONE[props.tone], props.mono ? 'font-mono text-mono-xs' : 'text-label tracking-normal']"
  >
    <slot />
  </span>
</template>
