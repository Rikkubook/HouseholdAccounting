<script setup lang="ts">
import { RouterLink } from "vue-router";
import AppIcon from "@/components/base/AppIcon.vue";
import ProgressBar from "./ProgressBar.vue";
import TransactionRow from "./TransactionRow.vue";
import { money } from "@/utils/format";
import type { CategoryProgress } from "@/types/models";

const props = withDefaults(
  defineProps<{
    category: CategoryProgress;
    /** 顯示筆數：舒適 5、緊湊 3 */
    rowCount?: number;
    dense?: boolean;
  }>(),
  { rowCount: 5, dense: false },
);
</script>

<template>
  <section class="rounded-card border border-card bg-surface px-5 pb-2 pt-[18px] transition-colors duration-150 hover:border-card-hover">
    <header class="flex items-center gap-[11px]">
      <span
        class="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-black/5 bg-surface-muted text-fg-3 md:h-[30px] md:w-[30px]"
      >
        <AppIcon :name="props.category.icon" :size="17" />
      </span>
      <span class="text-section text-fg-1">{{ props.category.name }}</span>
      <span class="ml-auto whitespace-nowrap text-[12px] tabular-nums text-fg-3">
        {{ money(props.category.spent) }} / {{ money(props.category.budget) }}
      </span>
    </header>

    <ProgressBar
      class="mt-3"
      :value="props.category.spent"
      :max="props.category.budget"
      :threshold="props.category.threshold"
    />

    <div class="mt-3 border-t border-divider">
      <TransactionRow
        v-for="tx in props.category.recent.slice(0, props.rowCount)"
        :key="tx.id"
        :tx="tx"
        :dense="props.dense"
      />
    </div>

    <RouterLink
      :to="{ name: 'transactions', query: { category: props.category.id } }"
      class="block py-2.5 text-label tracking-normal text-brand-500"
      >查看完整歷史 →</RouterLink
    >
  </section>
</template>
