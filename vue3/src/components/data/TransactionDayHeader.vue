<script setup lang="ts">
import { money, weekdayLabel } from "@/utils/format";

/** 手機版交易清單的日期標題列：「10/06（二）」與當日支出小計。 */
defineProps<{ date: string; subtotal: number }>();
</script>

<template>
  <div class="flex items-baseline gap-2 px-4 py-2.5 bg-surface-subtle border-b">
    <span class="font-mono text-[11.5px] text-fg-3">{{ weekdayLabel(date) }}</span>
    <span class="ml-auto text-[11.5px] text-fg-3 tnum">當日小計 {{ money(subtotal) }}</span>
  </div>
</template>
