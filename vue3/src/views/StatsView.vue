<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import AppCard from "@/components/base/AppCard.vue";
import ProgressBar from "@/components/base/ProgressBar.vue";
import SegmentedControl from "@/components/base/SegmentedControl.vue";
import ChipGroup from "@/components/base/ChipGroup.vue";
import { summaryApi, type StatsPayload } from "@/api/summary";
import { useMembersStore } from "@/stores/members";
import { currentMonth, money, percent } from "@/utils/format";

const members = useMembersStore();

const range = ref<"month" | "year">("month");
const month = ref(currentMonth());
const year = ref(new Date().getFullYear());
const payerId = ref<number | null>(null);
const data = ref<StatsPayload | null>(null);
const openCategoryId = ref<number | null>(null);
const loading = ref(false);

const thisYear = new Date().getFullYear();
const yearOptions = computed(() => [thisYear, thisYear - 1, thisYear - 2]);

/** 成員篩選以登入名稱定義，只有實際成員，沒有「共同」。 */
const payerOptions = computed(() => [
  { value: null as number | null, label: "全部成員" },
  ...members.active.map((m) => ({ value: m.id as number | null, label: m.name })),
]);

async function load() {
  loading.value = true;
  openCategoryId.value = null; // 切換範圍或成員時退回主分類層
  try {
    data.value = await summaryApi.stats(
      range.value,
      range.value === "month" ? month.value : String(year.value),
      payerId.value
    );
  } finally {
    loading.value = false;
  }
}

watch([range, month, year, payerId], load);
onMounted(async () => {
  await members.load();
  await load();
});
</script>

<template>
  <AppShell title="統計圖表" subtitle="消費結構與實際 vs 預計對照" back-to="/">
    <AppCard pad="compact">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
        <SegmentedControl
          :options="[
            { value: 'month', label: '月份' },
            { value: 'year', label: '年度' },
          ]"
          :model-value="range"
          @update:model-value="range = $event as 'month' | 'year'"
        />
        <input
          v-if="range === 'month'"
          v-model="month"
          type="month"
          :max="currentMonth()"
          class="h-[38px] px-3 rounded-md border border-strong bg-surface text-[13px] text-fg-1 outline-none box-border"
        />
        <select
          v-else
          v-model.number="year"
          class="h-[38px] px-2.5 rounded-md border border-strong bg-surface text-[13px] text-fg-2 outline-none"
        >
          <option v-for="y in yearOptions" :key="y" :value="y">{{ y }} 年</option>
        </select>
        <div class="md:ml-auto">
          <ChipGroup :options="payerOptions" :model-value="payerId" @update:model-value="payerId = $event as number | null" />
        </div>
      </div>
    </AppCard>

    <AppCard pad="none">
      <div class="px-4 py-3.5 border-b md:px-5">
        <div class="text-section font-bold text-fg-1">浮動支出 · 實際 vs 預計</div>
        <div class="text-[11.5px] text-fg-3 mt-0.5">
          點主分類可展開子分類；固定支出不列入此表
          <template v-if="range === 'year'"> · 年度預計＝月預算 × 已記錄月份</template>
        </div>
      </div>

      <div v-for="row in data?.floating ?? []" :key="row.mainCategoryId" class="border-b border-[rgba(0,0,0,.04)]">
        <button
          type="button"
          class="w-full px-4 py-3.5 text-left cursor-pointer hover:bg-surface-subtle md:px-5"
          @click="openCategoryId = openCategoryId === row.mainCategoryId ? null : row.mainCategoryId"
        >
          <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-md bg-surface-muted border flex items-center justify-center text-fg-2">
              <span class="material-symbols-rounded text-[18px]">{{ row.icon }}</span>
            </span>
            <span class="text-body font-bold text-fg-1">{{ row.name }}</span>
            <span class="ml-auto flex flex-col items-end gap-0.5">
              <span class="text-body text-fg-1 font-medium tnum">{{ money(row.amount) }}</span>
              <span class="font-mono text-[11px] text-fg-3">
                {{ percent(row.amount, data?.total ?? 0) }}
                <template v-if="row.budget"> · 預計 {{ money(row.budget) }}</template>
                <template v-else> · 未設預算</template>
              </span>
            </span>
            <span class="material-symbols-rounded text-[18px] text-fg-4">
              {{ openCategoryId === row.mainCategoryId ? "expand_less" : "expand_more" }}
            </span>
          </div>
          <div class="mt-2.5">
            <ProgressBar :spent="row.amount" :budget="row.budget" />
          </div>
        </button>

        <div v-if="openCategoryId === row.mainCategoryId" class="bg-surface-subtle px-4 pb-3 md:px-5">
          <div
            v-for="s in row.subs"
            :key="s.subCategoryId"
            class="flex items-baseline gap-2.5 py-2 border-b border-[rgba(0,0,0,.04)] last:border-0 text-[12.5px]"
          >
            <span class="text-fg-2">{{ s.name }}</span>
            <span class="ml-auto text-fg-1 tnum">{{ money(s.amount) }}</span>
            <span class="font-mono text-[11px] text-fg-4 w-[52px] text-right">{{ percent(s.amount, row.amount) }}</span>
          </div>
        </div>
      </div>
    </AppCard>

    <AppCard v-if="data?.fixed.length" pad="none">
      <div class="px-4 py-3.5 border-b md:px-5">
        <div class="text-section font-bold text-fg-1">固定支出</div>
        <div class="text-[11.5px] text-fg-3 mt-0.5">不另做圖，僅清單呈現</div>
      </div>
      <div
        v-for="row in data.fixed"
        :key="row.name"
        class="flex items-baseline gap-2.5 px-4 py-3 border-b border-[rgba(0,0,0,.04)] text-[12.5px] md:px-5"
      >
        <span class="text-fg-1">{{ row.name }}</span>
        <span class="ml-auto text-fg-1 font-medium tnum">{{ money(row.amount) }}</span>
      </div>
    </AppCard>
  </AppShell>
</template>
