<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import AppCard from "@/components/base/AppCard.vue";
import ProgressBar from "@/components/base/ProgressBar.vue";
import ExpenseShareCard from "@/components/data/ExpenseShareCard.vue";
import type { StatsPayload } from "@/api/summary";
import { useAuthStore } from "@/stores/auth";
import { useMembersStore } from "@/stores/members";
import { useScopeStore } from "@/stores/scope";
import { currentMonth, money, percent } from "@/utils/format";
import { loadMonthShares } from "@/utils/memberShares";
import { toLoadErrorKind, type LoadErrorKind } from "@/utils/loadError";

const auth = useAuthStore();
const members = useMembersStore();
const scope = useScopeStore();

const month = ref(currentMonth());
const data = ref<StatsPayload | null>(null);
/** 各成員當月支出（含其負責的固定支出），順序同 members.active。 */
const memberTotals = ref<number[]>([]);
const openCategoryId = ref<number | null>(null);
const loading = ref(false);
/** 只在第一次載入完成前為 true；切換月份重新查詢時維持 false。 */
const initialLoading = ref(true);
const error = ref<LoadErrorKind | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  openCategoryId.value = null; // 切換月份時退回主分類層
  try {
    const res = await loadMonthShares(month.value, members.active, scope.isPersonal ? auth.user?.id ?? null : null);
    data.value = res.stats;
    memberTotals.value = res.memberTotals;
  } catch (e) {
    error.value = toLoadErrorKind(e);
  } finally {
    loading.value = false;
    initialLoading.value = false;
  }
}

watch(month, load);
// 切換帳本後重新查詢
watch(() => scope.current, load);
onMounted(async () => {
  await members.load();
  await load();
});
</script>

<template>
  <AppShell
    title="統計圖表"
    subtitle="消費結構與實際 vs 預計對照"
    back-to="/"
    :loading="initialLoading"
    :error="error"
    @retry="load"
  >
    <ExpenseShareCard v-model:month="month" :total="data?.total ?? 0" :member-totals="memberTotals" />

    <AppCard pad="none">
      <div class="px-4 py-3.5 border-b md:px-5">
        <div class="text-section font-bold text-fg-1">浮動支出 · 實際 vs 預計</div>
        <div class="text-[11.5px] text-fg-3 mt-0.5">點主分類可展開子分類；固定支出不列入此表</div>
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
