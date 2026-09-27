<script setup lang="ts">
import { computed } from "vue";
import { budgetState, money } from "@/utils/format";

const props = withDefaults(
  defineProps<{
    spent: number;
    /** null 表示該月未設預算：進度條留空、不顯示百分比 */
    budget: number | null;
    threshold?: number;
    height?: number;
    showMeta?: boolean;
  }>(),
  { threshold: 70, height: 8, showMeta: true }
);

const state = computed(() => budgetState(props.spent, props.budget, props.threshold));
const pct = computed(() => (props.budget ? (props.spent / props.budget) * 100 : 0));
const fill = computed(
  () =>
    ({
      ok: "bg-budget-ok",
      near: "bg-budget-near",
      over: "bg-budget-over",
      none: "",
    })[state.value]
);
const remainLabel = computed(() =>
  props.budget === null
    ? ""
    : props.spent > props.budget
      ? "超出 " + money(props.spent - props.budget)
      : "剩 " + money(props.budget - props.spent)
);
</script>

<template>
  <div class="flex flex-col gap-[7px]">
    <div class="rounded-pill bg-track overflow-hidden" :style="{ height: height + 'px' }">
      <div
        class="h-full rounded-pill transition-[width] duration-500 ease-out"
        :class="fill"
        :style="{ width: Math.min(pct, 100) + '%' }"
      />
    </div>
    <div v-if="showMeta && budget !== null" class="flex justify-between text-mono font-mono text-fg-3">
      <span>{{ Math.round(pct) }}%</span>
      <span>{{ remainLabel }}</span>
    </div>
  </div>
</template>
