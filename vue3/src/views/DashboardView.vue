<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import AppShell from "@/components/layout/AppShell.vue";
import AppCard from "@/components/base/AppCard.vue";
import MetricStat from "@/components/base/MetricStat.vue";
import SegmentedControl from "@/components/base/SegmentedControl.vue";
import CategoryBudgetCard from "@/components/data/CategoryBudgetCard.vue";
import FloatingActionButton from "@/components/base/FloatingActionButton.vue";
import { useDashboardStore } from "@/stores/dashboard";
import { addMonths, currentMonth, money, shortDate } from "@/utils/format";

const store = useDashboardStore();
const thisMonth = currentMonth();
const lastMonth = addMonths(thisMonth, -1);

/** 期間僅本月與上月；更早的資料改由交易列表與年度彙整檢視。 */
const periodOptions = [
  { value: thisMonth, label: "本月" },
  { value: lastMonth, label: "上月" },
];
const summary = computed(() => store.data?.summary);

onMounted(() => store.load());
</script>

<template>
  <AppShell
    title="首頁儀表板"
    subtitle="本月收支與各浮動支出分類的預算使用狀況"
    :loading="store.initialLoading"
    :error="store.error"
    @retry="store.load()"
  >
    <template #actions>
      <SegmentedControl :options="periodOptions" :model-value="store.month" @update:model-value="store.load($event)" />
      <RouterLink
        to="/transactions/new"
        class="h-[38px] px-4 rounded-md bg-action text-fg-brand inline-flex items-center gap-[7px] text-body font-bold"
      >
        <span class="material-symbols-rounded text-[17px]">add</span>記一筆
      </RouterLink>
    </template>

    <!-- 手機期間切換放在內頁 -->
    <div class="md:hidden">
      <SegmentedControl :options="periodOptions" :model-value="store.month" @update:model-value="store.load($event)" />
    </div>

    <div class="grid gap-3.5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-4">
      <AppCard>
        <div class="grid grid-cols-2 gap-5 md:grid-cols-3">
          <MetricStat label="總收入" :value="summary?.income ?? null" size="md" />
          <div class="md:pl-5 md:border-l"><MetricStat label="總支出" :value="summary?.expense ?? null" size="md" /></div>
          <div class="col-span-2 md:col-span-1 md:pl-5 md:border-l">
            <MetricStat label="淨結餘" :value="summary?.net ?? null" size="md" />
          </div>
        </div>
      </AppCard>

      <AppCard tone="brand" pad="compact">
        <div class="flex h-full flex-col justify-between gap-4 min-h-[118px]">
          <div class="text-[11.5px] opacity-85 leading-snug">本月固定支出總額</div>
          <MetricStat label="" :value="summary?.fixedTotal ?? null" size="md" on-brand hint="訂閱月換算，年繳 ÷12" />
        </div>
      </AppCard>
    </div>

    <div class="flex items-baseline gap-2.5 mt-1">
      <h2 class="text-section font-bold text-fg-1 m-0">浮動支出分類</h2>
      <span class="text-[11.5px] text-fg-3">未設預算的分類會顯示設定提示</span>
    </div>

    <!-- 2 欄網格依分類排序自動換行，超過 6 類順勢往下 -->
    <div class="grid gap-3.5 md:grid-cols-2 md:gap-4">
      <CategoryBudgetCard v-for="c in store.data?.categories ?? []" :key="c.id" :category="c" />
    </div>

    <AppCard pad="none">
      <div class="px-4 py-3.5 border-b md:px-5">
        <div class="text-section font-bold text-fg-1">最近交易</div>
        <div class="text-[11.5px] text-fg-3 mt-0.5">依建立時間由近到遠，顯示 5 筆</div>
      </div>
      <div
        v-for="tx in store.data?.recent ?? []"
        :key="tx.id"
        class="flex items-baseline gap-2.5 px-4 py-3 border-b border-[rgba(0,0,0,.04)] text-[12.5px] md:px-5"
      >
        <span class="font-mono text-[11px] text-fg-4">{{ shortDate(tx.date) }}</span>
        <span class="text-fg-1 truncate">{{ tx.subCategoryName ?? tx.mainCategoryName }}</span>
        <span class="text-[11px] text-fg-4">{{ tx.payerName }}</span>
        <span class="ml-auto text-fg-1 font-medium tnum">{{ money(tx.amount) }}</span>
      </div>
      <RouterLink to="/transactions" class="block px-4 py-3 text-[12px] text-brand-500 md:px-5">
        查看完整歷史 →
      </RouterLink>
    </AppCard>

    <template #fab>
      <RouterLink to="/transactions/new"><FloatingActionButton label="記一筆" /></RouterLink>
    </template>
  </AppShell>
</template>
