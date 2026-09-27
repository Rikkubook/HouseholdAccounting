<script setup lang="ts">
import { money } from "@/utils/format";

withDefaults(
  defineProps<{
    label: string;
    value: number | null;
    hint?: string;
    size?: "hero" | "lg" | "md" | "sm";
    onBrand?: boolean;
  }>(),
  { size: "lg" }
);

const sizeClass: Record<string, string> = {
  hero: "text-hero font-bold",
  lg: "text-metric font-bold",
  md: "text-metric-sm font-bold",
  sm: "text-title font-bold",
};
</script>

<template>
  <div class="flex flex-col gap-1.5 min-w-0">
    <span class="text-label" :class="onBrand ? 'text-fg-brand/85' : 'text-fg-3'">{{ label }}</span>
    <span class="tnum" :class="[sizeClass[size], onBrand ? 'text-fg-brand' : 'text-fg-1']">{{ money(value) }}</span>
    <span v-if="hint" class="text-[10.5px]" :class="onBrand ? 'text-fg-brand/70' : 'text-fg-4'">{{ hint }}</span>
  </div>
</template>
