<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import AppCard from "@/components/base/AppCard.vue";
import ExpenseShareCard from "@/components/data/ExpenseShareCard.vue";
import { summaryApi, type YearSummaryPayload } from "@/api/summary";
import { addMonths, currentMonth, money } from "@/utils/format";
import { loadMonthShares } from "@/utils/memberShares";
import { useMembersStore } from "@/stores/members";
import { toLoadErrorKind, type LoadErrorKind } from "@/utils/loadError";
import { buildReconcileRows } from "@/utils/reconcile";

/**
 * 家庭戶頭對帳：算出每個月月初戶頭「應該」有多少，讓使用者拿去和網銀的帳面金額人工核對。
 * 只看家庭帳（側欄在個人帳隱藏本頁，查詢也固定 scope=family）。公式見 utils/reconcile.ts。
 * 年初戶頭原有的錢記成 1 月收入，所以沒有期初餘額欄位。
 */
const now = new Date();
const thisYear = now.getFullYear();
const thisMonth = now.getMonth() + 1;

const year = ref(thisYear);
const yearOptions = computed(() => [thisYear, thisYear - 1, thisYear - 2]);
const data = ref<YearSummaryPayload | null>(null);
const initialLoading = ref(true);
const error = ref<LoadErrorKind | null>(null);

const extrasTotal = computed(() => (data.value?.extras ?? []).reduce((s, e) => s + e.amount, 0));
/** 今年算到本月；往年 12 個月都列出；未來年度不列 */
const lastMonth = computed(() => (year.value < thisYear ? 12 : year.value === thisYear ? thisMonth : 0));
const rows = computed(() =>
  data.value ? buildReconcileRows(data.value.monthly, extrasTotal.value, lastMonth.value) : []
);
/** 主卡片：今年顯示本月，往年顯示 12 月 */
const focus = computed(() => rows.value.at(-1) ?? null);

/** 上個月支出比例（同統計圖表頁的卡片），預設上個月，可自行切換月份。查不到不擋整頁。 */
const members = useMembersStore();
const shareMonth = ref(addMonths(currentMonth(), -1));
const shareTotal = ref(0);
const shareMemberTotals = ref<number[]>([]);
async function loadShares() {
  try {
    const res = await loadMonthShares(shareMonth.value, members.active, null);
    shareTotal.value = res.stats.total;
    shareMemberTotals.value = res.memberTotals;
  } catch {
    shareTotal.value = 0;
    shareMemberTotals.value = [];
  }
}
watch(shareMonth, loadShares);
/** 切到別的月份時標題跟著改，避免還寫「上個月」 */
const shareTitle = computed(() =>
  shareMonth.value === addMonths(currentMonth(), -1)
    ? "上個月支出比例"
    : Number(shareMonth.value.slice(5)) + "月支出比例"
);

async function load() {
  error.value = null;
  try {
    data.value = await summaryApi.year(year.value, "family");
  } catch (e) {
    error.value = toLoadErrorKind(e);
  } finally {
    initialLoading.value = false;
  }
}

watch(year, load);
onMounted(async () => {
  await members.load();
  await Promise.all([load(), loadShares()]);
});
</script>

<template>
  <AppShell
    title="戶頭對帳"
    subtitle="算出家庭戶頭月初應有金額，和網銀帳面核對"
    back-to="/"
    :loading="initialLoading"
    :error="error"
    @retry="load"
  >
    <template #actions>
      <select
        v-model.number="year"
        class="h-[38px] max-w-[240px] px-2.5 rounded-md border border-strong bg-surface text-[13px] text-fg-2 outline-none"
      >
        <option v-for="y in yearOptions" :key="y" :value="y">{{ y }} 年</option>
      </select>
    </template>

    <div class="md:hidden">
      <select
        v-model.number="year"
        class="w-full h-[44px] px-3 rounded-md border border-strong bg-surface text-[14px] text-fg-1 outline-none box-border"
      >
        <option v-for="y in yearOptions" :key="y" :value="y">{{ y }} 年</option>
      </select>
    </div>

    <AppCard>
      <div>
        <div v-if="focus" class="flex flex-col gap-3 min-w-0">
          <div class="flex flex-col gap-1.5">
            <span class="text-label text-fg-3">{{ focus.month }}月 月初戶頭應有（含本月收入）</span>
            <span class="text-metric font-bold text-fg-1 tnum">{{ money(focus.expected) }}</span>
          </div>
          <!-- 拆解：讓使用者對不上時知道從哪一項查起 -->
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px] max-w-[360px]">
            <dt class="text-fg-3">
              {{ focus.month === 1 ? "前月月結餘" : "1～" + (focus.month - 1) + "月 月結餘合計" }}
            </dt>
            <dd class="text-right font-mono tnum" :class="focus.priorNet < 0 ? 'text-danger' : 'text-fg-2'">
              {{ money(focus.priorNet) }}
            </dd>
            <dt class="text-fg-3">− 年度額外開銷</dt>
            <dd class="text-right font-mono tnum text-fg-2">{{ money(extrasTotal) }}</dd>
            <dt class="text-fg-3">＋ {{ focus.month }}月 收入</dt>
            <dd class="text-right font-mono tnum text-fg-2">{{ money(focus.income) }}</dd>
          </dl>
        </div>
        <div v-else class="text-[13px] text-fg-3">這一年還沒開始。</div>

      </div>
    </AppCard>

    <ExpenseShareCard
      v-model:month="shareMonth"
      :title="shareTitle"
      :total="shareTotal"
      :member-totals="shareMemberTotals"
    />

    <AppCard pad="none">
      <div class="px-5 py-4 border-b">
        <div class="text-section font-bold text-fg-1">每月月初應有</div>
        <div class="text-[11.5px] text-fg-3 mt-0.5">
          月初應有＝前面各月月結餘 − 年度額外開銷＋本月收入 · 月結餘＝收入 − 支出
        </div>
      </div>
      <div
        class="grid grid-cols-[56px_repeat(3,minmax(0,1fr))] items-center h-10 px-4 md:px-5 bg-surface border-b text-[11px] text-fg-4"
      >
        <span>月份</span>
        <span class="text-right">前面月結餘合計</span>
        <span class="text-right">本月收入</span>
        <span class="text-right text-fg-2">月初應有</span>
      </div>
      <div
        v-for="r in rows"
        :key="r.month"
        class="grid grid-cols-[56px_repeat(3,minmax(0,1fr))] items-center h-[48px] px-4 md:px-5 border-b border-[rgba(0,0,0,.04)] text-[12.5px]"
        :class="r.month === focus?.month ? 'bg-brand-tint' : 'bg-surface'"
      >
        <span class="font-mono text-fg-2">{{ r.month }}月</span>
        <span class="text-right font-mono tnum" :class="r.priorNet < 0 ? 'text-danger' : 'text-fg-2'">
          {{ money(r.priorNet) }}
        </span>
        <span class="text-right font-mono tnum text-fg-2">{{ money(r.income) }}</span>
        <span class="text-right font-bold tnum" :class="r.expected < 0 ? 'text-danger' : 'text-fg-1'">
          {{ money(r.expected) }}
        </span>
      </div>
    </AppCard>
  </AppShell>
</template>
