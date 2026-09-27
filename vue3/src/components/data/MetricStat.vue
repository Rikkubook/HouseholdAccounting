<script setup lang="ts">
type Size = "hero" | "lg" | "md" | "sm";

const props = withDefaults(
  defineProps<{
    label: string;
    /** 已格式化字串，用 money() 產生 */
    value: string;
    size?: Size;
    note?: string;
    /** 左側加分隔線，用於三欄並排 */
    divider?: boolean;
    /** 置於漸層卡上時改白色文字 */
    onBrand?: boolean;
  }>(),
  { size: "lg", divider: false, onBrand: false },
);

const SIZE: Record<Size, string> = {
  hero: "text-hero",
  lg: "text-metric",
  md: "text-metric-sm",
  sm: "text-value-sm",
};
</script>

<template>
  <div class="flex flex-col gap-1.5" :class="props.divider && 'border-l border-card pl-5'">
    <span class="text-label" :class="props.onBrand ? 'text-white/85' : 'text-fg-3'">{{ props.label }}</span>
    <span
      class="tabular-nums"
      :class="[SIZE[props.size], props.onBrand ? 'text-white' : 'text-fg-1']"
      >{{ props.value }}</span
    >
    <span v-if="props.note" class="text-mono-xs tracking-normal" :class="props.onBrand ? 'text-white/80' : 'text-fg-4'">
      {{ props.note }}
    </span>
  </div>
</template>
