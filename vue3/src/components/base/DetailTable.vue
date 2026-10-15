<script setup lang="ts">
/**
 * 單筆資料的橫向表格：上列欄位名、下列值，樣式比照交易列表的表頭與資料列。
 * 確認視窗用來列出要刪除的那一筆。note 以備註色接在值後面；空值顯示「—」。
 */
defineProps<{
  columns: {
    label: string;
    value: string | null | undefined;
    note?: string | null;
    align?: "left" | "right";
    emphasis?: boolean;
    /** CSS grid 欄寬，預設 auto */
    width?: string;
  }[];
}>();
</script>

<template>
  <div
    class="grid rounded-lg border overflow-hidden text-[12.5px]"
    :style="{ gridTemplateColumns: columns.map((c) => c.width ?? 'auto').join(' ') }"
  >
    <span
      v-for="c in columns"
      :key="'h-' + c.label"
      class="px-2.5 py-2 bg-surface-subtle border-b text-[11px] text-fg-4 whitespace-nowrap"
      :class="c.align === 'right' ? 'text-right' : ''"
    >
      {{ c.label }}
    </span>
    <span
      v-for="c in columns"
      :key="'v-' + c.label"
      class="px-2.5 py-2.5 min-w-0 break-words tnum"
      :class="[c.align === 'right' ? 'text-right' : '', c.emphasis ? 'font-bold text-fg-1' : 'text-fg-1']"
    >
      {{ c.value || "—" }}
      <span v-if="c.note" class="text-note text-[11px] ml-1">{{ c.note }}</span>
    </span>
  </div>
</template>
