<script setup lang="ts">
import { computed } from "vue";
import { money } from "@/utils/format";

const props = withDefaults(
  defineProps<{
    value: number;
    max: number;
    /** 變色門檻百分比 */
    threshold?: number;
    height?: number;
    showMeta?: boolean;
  }>(),
  { threshold: 70, height: 8, showMeta: true },
);

const pct = computed(() => (props.max > 0 ? Math.round((props.value / props.max) * 100) : 0));

// 進度條顏色是唯一的預算提醒手段
const fillClass = computed(() =>
  pct.value >= 100 ? "bg-budget-over" : pct.value >= props.threshold ? "bg-budget-near" : "bg-budget-ok",
);

const remainLabel = computed(() =>
  props.value > props.max ? `超出 ${money(props.value - props.max)}` : `剩 ${money(props.max - props.value)}`,
);
</script>

<template>
  <div>
    <div class="overflow-hidden rounded-pill bg-track" :style="{ height: `${props.height}px` }">
      <div
        class="h-full rounded-pill transition-[width] duration-500 ease-out-soft"
        :class="fillClass"
        :style="{ width: `${Math.min(pct, 100)}%` }"
      />
    </div>
    <div v-if="props.showMeta" class="mt-[7px] flex justify-between font-mono text-mono-sm text-fg-3">
      <span>{{ pct }}%</span>
      <span>{{ remainLabel }}</span>
    </div>
  </div>
</template>
