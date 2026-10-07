<script setup lang="ts">
import { RouterLink } from "vue-router";
import { money, shortDate } from "@/utils/format";
import AppCard from "@/components/base/AppCard.vue";
import ProgressBar from "@/components/base/ProgressBar.vue";
import type { CategoryProgress } from "@/types/models";

defineProps<{ category: CategoryProgress }>();
</script>

<template>
  <AppCard pad="compact">
    <div class="flex items-center gap-2.5">
      <span class="w-8 h-8 rounded-md bg-surface-muted border flex items-center justify-center text-fg-2">
        <span class="material-symbols-rounded text-[18px]">{{ category.icon }}</span>
      </span>
      <div class="text-section font-bold text-fg-1">{{ category.name }}</div>

      <!-- 未設預算：提示放在分類名稱旁 -->
      <RouterLink
        v-if="category.budget === null"
        to="/budget"
        class="flex items-center gap-1 text-[11px] text-brand-500 whitespace-nowrap"
      >
        <span class="material-symbols-rounded text-[14px]">error</span>設定預算
      </RouterLink>

      <div class="ml-auto text-[12px] text-fg-3 tnum whitespace-nowrap">
        {{ money(category.spent) }} / {{ category.budget === null ? "未設預算" : money(category.budget) }}
      </div>
    </div>

    <div class="mt-3">
      <ProgressBar :spent="category.spent" :budget="category.budget" />
    </div>

    <div v-if="category.recent.length" class="mt-3 pt-3 border-t flex flex-col gap-2">
      <div v-for="tx in category.recent" :key="tx.id" class="flex items-baseline gap-2 text-[12px]">
        <span class="font-mono text-[11px] text-fg-4">{{ shortDate(tx.date) }}</span>
        <span class="text-fg-2 whitespace-nowrap">{{ tx.subCategoryName ?? tx.mainCategoryName }}</span>
        <span v-if="tx.note" class="text-note text-[11px] truncate min-w-0">{{ tx.note }}</span>
        <span class="text-fg-4 text-[11px] whitespace-nowrap">{{ tx.payerName }}</span>
        <span class="ml-auto pl-2 text-fg-1 tnum whitespace-nowrap">{{ money(tx.amount) }}</span>
      </div>
      <RouterLink to="/transactions" class="text-[12px] text-brand-500 self-start">查看完整歷史 →</RouterLink>
    </div>
  </AppCard>
</template>
