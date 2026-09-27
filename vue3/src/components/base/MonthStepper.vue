<script setup lang="ts">
import { monthLabel, addMonths } from "@/utils/format";

const props = defineProps<{ modelValue: string; max?: string; min?: string }>();
const emit = defineEmits<{ "update:modelValue": [string] }>();

function step(delta: number) {
  const next = addMonths(props.modelValue, delta);
  if (props.max && next > props.max) return;
  if (props.min && next < props.min) return;
  emit("update:modelValue", next);
}
</script>

<template>
  <div class="inline-flex items-center gap-0.5 bg-surface border rounded-lg p-1">
    <button
      type="button"
      aria-label="上個月"
      class="w-[38px] h-[34px] rounded-sm flex items-center justify-center text-fg-2 hover:bg-surface-subtle cursor-pointer"
      @click="step(-1)"
    >
      <span class="material-symbols-rounded text-[18px]">chevron_left</span>
    </button>
    <span class="min-w-[96px] text-center text-body font-bold text-fg-1 tnum">{{ monthLabel(modelValue) }}</span>
    <button
      type="button"
      aria-label="下個月"
      class="w-[38px] h-[34px] rounded-sm flex items-center justify-center text-fg-2 hover:bg-surface-subtle cursor-pointer disabled:opacity-30"
      :disabled="!!max && addMonths(modelValue, 1) > max"
      @click="step(1)"
    >
      <span class="material-symbols-rounded text-[18px]">chevron_right</span>
    </button>
  </div>
</template>
