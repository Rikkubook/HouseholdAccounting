<script setup lang="ts">
import { computed } from "vue";

/** 最多顯示 3 個頁碼、置中；桌機與手機相同。 */
const props = defineProps<{ page: number; total: number; pageSize: number }>();
const emit = defineEmits<{ "update:page": [number] }>();

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const window3 = computed(() => {
  const last = pageCount.value;
  let start = Math.min(Math.max(1, props.page - 1), Math.max(1, last - 2));
  return Array.from({ length: Math.min(3, last) }, (_, i) => start + i);
});
const rangeLabel = computed(() => {
  const from = (props.page - 1) * props.pageSize + 1;
  const to = Math.min(props.page * props.pageSize, props.total);
  return props.total ? "顯示第 " + from + "–" + to + " 筆 · 每頁 " + props.pageSize + " 筆" : "";
});
</script>

<template>
  <div class="flex flex-col items-center gap-2 py-3">
    <span class="text-[11px] text-fg-4">{{ rangeLabel }}</span>
    <div class="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="上一頁"
        class="w-8 h-8 rounded-md border border-strong bg-surface flex items-center justify-center text-fg-2 disabled:opacity-30 cursor-pointer"
        :disabled="page <= 1"
        @click="emit('update:page', page - 1)"
      >
        <span class="material-symbols-rounded text-[18px]">chevron_left</span>
      </button>
      <button
        v-for="p in window3"
        :key="p"
        type="button"
        class="min-w-8 h-8 px-2 rounded-md border text-[12.5px] flex items-center justify-center cursor-pointer"
        :class="p === page ? 'bg-fg-1 border-fg-1 text-fg-brand' : 'bg-surface border-strong text-fg-2'"
        @click="emit('update:page', p)"
      >
        {{ p }}
      </button>
      <button
        type="button"
        aria-label="下一頁"
        class="w-8 h-8 rounded-md border border-strong bg-surface flex items-center justify-center text-fg-2 disabled:opacity-30 cursor-pointer"
        :disabled="page >= pageCount"
        @click="emit('update:page', page + 1)"
      >
        <span class="material-symbols-rounded text-[18px]">chevron_right</span>
      </button>
    </div>
  </div>
</template>
