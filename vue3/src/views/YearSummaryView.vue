<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import AppCard from "@/components/base/AppCard.vue";
import AppButton from "@/components/base/AppButton.vue";
import AppBadge from "@/components/base/AppBadge.vue";
import AppDialog from "@/components/base/AppDialog.vue";
import MetricStat from "@/components/base/MetricStat.vue";
import FormField from "@/components/base/FormField.vue";
import TextInput from "@/components/base/TextInput.vue";
import AmountInput from "@/components/base/AmountInput.vue";
import SegmentedControl from "@/components/base/SegmentedControl.vue";
import IconButton from "@/components/base/IconButton.vue";
import FloatingActionButton from "@/components/base/FloatingActionButton.vue";
import { summaryApi, type YearSummaryPayload } from "@/api/summary";
import { useCategoriesStore } from "@/stores/categories";
import { useMembersStore } from "@/stores/members";
import { useUiStore } from "@/stores/ui";
import { money } from "@/utils/format";

const cats = useCategoriesStore();
const members = useMembersStore();
const ui = useUiStore();

const thisYear = new Date().getFullYear();
const year = ref(thisYear);
const data = ref<YearSummaryPayload | null>(null);
const loading = ref(false);

interface ExtraForm {
  name: string;
  amount: string;
  mainCategoryId: number;
  payerId: number;
}
const form = ref<ExtraForm | null>(null);

const yearOptions = computed(() => [thisYear, thisYear - 1, thisYear - 2]);
const categoryOptions = computed(() => cats.selectable.filter((c) => c.type === "expense"));

/** 底部支出合計列：各月合計、額外開銷合計、全年合計。 */
const footer = computed(() => {
  const rows = data.value?.rows ?? [];
  return {
    months: Array.from({ length: 12 }, (_, i) =>
      rows.some((r) => r.months[i] !== null) ? rows.reduce((s, r) => s + (r.months[i] ?? 0), 0) : null
    ),
    extra: rows.reduce((s, r) => s + (r.extra ?? 0), 0),
    total: rows.reduce((s, r) => s + r.total, 0),
    planned: rows.reduce((s, r) => s + (r.planned ?? 0), 0),
  };
});

/** 分類生命週期標記：N月新增 / N月起停用。 */
function lifecycleLabel(row: YearSummaryPayload["rows"][number]) {
  if (row.endMonth < 12) return row.endMonth + 1 + "月起停用";
  if (row.startMonth > 0) return row.startMonth + 1 + "月新增";
  return "";
}

function cellClass(row: YearSummaryPayload["rows"][number], value: number | null) {
  if (value === null) return "text-fg-disabled";
  if (row.monthlyBudget && value >= row.monthlyBudget) return "text-state-over font-bold";
  if (row.monthlyBudget && value >= row.monthlyBudget * 0.7) return "text-state-near";
  return "text-fg-2";
}

const memberTotal = computed(() => (data.value?.byMember ?? []).reduce((s, m) => s + m.amount, 0));

async function load() {
  loading.value = true;
  try {
    data.value = await summaryApi.year(year.value);
  } finally {
    loading.value = false;
  }
}

function openNew() {
  form.value = {
    name: "",
    amount: "",
    mainCategoryId: categoryOptions.value[0]?.id ?? 1,
    payerId: members.active[0]?.id ?? 1,
  };
}

async function submitExtra() {
  const v = form.value;
  if (!v) return;
  if (!v.name.trim()) return ui.flash("請填寫項目名稱", "danger");
  if (!v.amount || Number(v.amount) <= 0) return ui.flash("請填寫金額", "danger");
  await summaryApi.createYearExtra({
    year: year.value,
    name: v.name.trim(),
    amount: Number(v.amount),
    mainCategoryId: v.mainCategoryId,
    payerId: v.payerId,
  });
  ui.flash("已新增年度額外開銷「" + v.name.trim() + "」");
  form.value = null;
  await load();
}

async function removeExtra(id: number, name: string) {
  await summaryApi.removeYearExtra(id);
  ui.flash("已刪除「" + name + "」");
  await load();
}

watch(year, load);
onMounted(async () => {
  await Promise.all([cats.load(), members.load()]);
  await load();
});
</script>

<template>
  <AppShell title="年度彙整" subtitle="橫向檢視 12 個月各分類金額" back-to="/">
    <template #actions>
      <select
        v-model.number="year"
        class="h-[38px] max-w-[240px] px-2.5 rounded-md border border-strong bg-surface text-[13px] text-fg-2 outline-none"
      >
        <option v-for="y in yearOptions" :key="y" :value="y">{{ y }} 年</option>
      </select>
      <AppButton variant="action" icon="add" @click="openNew">新增年度額外開銷</AppButton>
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
      <div class="grid grid-cols-2 gap-5 md:grid-cols-4">
        <MetricStat label="全年收入" :value="data?.income ?? null" size="md" />
        <div class="md:pl-5 md:border-l"><MetricStat label="全年支出" :value="data?.expense ?? null" size="md" /></div>
        <div class="md:pl-5 md:border-l"><MetricStat label="結餘" :value="data?.net ?? null" size="md" /></div>
        <div class="md:pl-5 md:border-l">
          <MetricStat
            label="已記錄月份"
            :value="data?.recordedMonths ?? null"
            size="md"
            :hint="data ? '每月平均 ' + money((data.expense || 0) / (data.recordedMonths || 1)) : ''"
          />
        </div>
      </div>
    </AppCard>

    <!-- 桌機：sticky 首欄 + 橫向捲動 -->
    <AppCard pad="none" class="hidden md:block">
      <div class="px-5 py-4 border-b">
        <div class="text-section font-bold text-fg-1">年度總表</div>
        <div class="text-[11.5px] text-fg-3 mt-0.5">
          含固定支出 · 年度額外開銷不列入單月，計入分類年度總計 · 橫向可捲動
        </div>
      </div>

      <div class="overflow-x-auto">
        <div class="min-w-[1180px]">
          <div
            class="grid items-center h-10 bg-surface border-b text-[11px] text-fg-4"
            :style="{ gridTemplateColumns: '150px repeat(12,minmax(72px,1fr)) 88px 108px 100px 96px 92px' }"
          >
            <span
              class="sticky left-0 z-[2] h-10 flex items-center px-4 bg-surface box-border shadow-[1px_0_0_rgba(0,0,0,.09)]"
            >
              分類
            </span>
            <span v-for="m in 12" :key="m" class="text-right font-mono pr-1">{{ m }}月</span>
            <span class="text-right pr-1">額外開銷</span>
            <span class="text-right pr-1 text-fg-2">年度總計</span>
            <span class="text-right pr-1">年度預計</span>
            <span class="text-right pr-1">每月平均</span>
            <span class="text-right pr-4">佔比</span>
          </div>

          <div
            v-for="row in data?.rows ?? []"
            :key="row.mainCategoryId"
            class="grid items-center h-[52px] bg-surface border-b border-[rgba(0,0,0,.04)] text-[12.5px]"
            :style="{ gridTemplateColumns: '150px repeat(12,minmax(72px,1fr)) 88px 108px 100px 96px 92px' }"
          >
            <span
              class="sticky left-0 z-[2] h-[52px] flex items-center gap-1.5 px-4 bg-surface box-border shadow-[1px_0_0_rgba(0,0,0,.09)] min-w-0"
            >
              <span class="font-bold text-fg-1 whitespace-nowrap">{{ row.name }}</span>
              <AppBadge v-if="lifecycleLabel(row)" small>{{ lifecycleLabel(row) }}</AppBadge>
            </span>
            <span
              v-for="(v, i) in row.months"
              :key="i"
              class="text-right pr-1 font-mono tnum"
              :class="cellClass(row, v)"
              :title="
                v === null
                  ? row.name + ' ' + (i + 1) + '月 尚未建立此分類或尚未記錄'
                  : row.name + ' ' + (i + 1) + '月 ' + money(v) + ' / 預計 ' + money(row.monthlyBudget)
              "
            >
              {{ v === null ? "—" : money(v) }}
            </span>
            <span class="text-right pr-1 font-mono tnum text-fg-2">{{ row.extra === null ? "—" : money(row.extra) }}</span>
            <span class="text-right pr-1 font-bold text-fg-1 tnum">{{ money(row.total) }}</span>
            <span class="text-right pr-1 font-mono tnum text-fg-3">{{ row.planned === null ? "—" : money(row.planned) }}</span>
            <span class="text-right pr-1 font-mono tnum text-fg-3">
              {{ money(row.total / Math.max(1, Math.min(row.endMonth, 12) - row.startMonth)) }}
            </span>
            <span class="flex flex-col items-end gap-1 pr-4">
              <span class="font-mono text-[11px] text-fg-3">
                {{ (((row.total || 0) / (footer.total || 1)) * 100).toFixed(1) }}%
              </span>
              <span class="w-16 h-1 rounded-pill bg-track overflow-hidden">
                <span
                  class="block h-full bg-brand"
                  :style="{ width: ((row.total || 0) / (footer.total || 1)) * 100 + '%' }"
                />
              </span>
            </span>
          </div>

          <!-- 底部支出合計列（白底） -->
          <div
            class="grid items-center h-[52px] bg-surface border-t text-[12.5px]"
            :style="{ gridTemplateColumns: '150px repeat(12,minmax(72px,1fr)) 88px 108px 100px 96px 92px' }"
          >
            <span
              class="sticky left-0 z-[2] h-[52px] flex items-center px-4 bg-surface box-border shadow-[1px_0_0_rgba(0,0,0,.09)] font-bold text-fg-1"
            >
              支出合計
            </span>
            <span v-for="(v, i) in footer.months" :key="i" class="text-right pr-1 font-mono tnum text-fg-2">
              {{ v === null ? "—" : money(v) }}
            </span>
            <span class="text-right pr-1 font-mono tnum text-fg-2">{{ money(footer.extra) }}</span>
            <span class="text-right pr-1 font-bold text-fg-1 tnum">{{ money(footer.total) }}</span>
            <span class="text-right pr-1 font-mono tnum text-fg-3">{{ money(footer.planned) }}</span>
            <span class="text-right pr-1 font-mono tnum text-fg-3">
              {{ money(footer.total / Math.max(1, data?.recordedMonths ?? 1)) }}
            </span>
            <span class="text-right pr-4 font-mono text-[11px] text-fg-3">100.0%</span>
          </div>
        </div>
      </div>
    </AppCard>

    <!-- 手機：每分類卡片 + 可橫捲的 12 月數字帶 -->
    <div class="md:hidden flex flex-col gap-3.5">
      <AppCard v-for="row in data?.rows ?? []" :key="row.mainCategoryId" pad="compact">
        <div class="flex items-center gap-2">
          <span class="text-[14.5px] font-bold text-fg-1">{{ row.name }}</span>
          <AppBadge v-if="lifecycleLabel(row)" small>{{ lifecycleLabel(row) }}</AppBadge>
          <span class="ml-auto text-[16px] font-bold text-fg-1 tnum">{{ money(row.total) }}</span>
        </div>
        <div class="mt-2 flex gap-4 text-[11px] text-fg-3">
          <span>年度預計 {{ row.planned === null ? "—" : money(row.planned) }}</span>
          <span>佔比 {{ (((row.total || 0) / (footer.total || 1)) * 100).toFixed(1) }}%</span>
        </div>
        <div class="mt-3 pt-3 border-t overflow-x-auto">
          <div class="flex gap-3 min-w-max">
            <span v-for="(v, i) in row.months" :key="i" class="flex flex-col items-end gap-0.5">
              <span class="font-mono text-[10px] text-fg-4">{{ i + 1 }}月</span>
              <span class="font-mono text-[12px] tnum" :class="cellClass(row, v)">
                {{ v === null ? "—" : money(v) }}
              </span>
            </span>
          </div>
        </div>
      </AppCard>
    </div>

    <AppCard v-if="data?.extras.length" pad="none">
      <div class="px-4 py-3.5 border-b md:px-5">
        <div class="text-section font-bold text-fg-1">年度額外開銷明細</div>
        <div class="text-[11.5px] text-fg-3 mt-0.5">不列入單月，計入分類年度總計</div>
      </div>
      <div
        v-for="e in data.extras"
        :key="e.id"
        class="grid items-center gap-3 px-4 py-3 border-b border-[rgba(0,0,0,.04)] text-[12.5px] md:px-5"
        :style="{ gridTemplateColumns: 'minmax(0,1fr) 96px 76px 120px 44px' }"
      >
        <span class="text-fg-1 truncate">{{ e.name }}</span>
        <span class="text-fg-3">{{ e.categoryName }}</span>
        <span class="text-fg-3">{{ e.payerName }}</span>
        <span class="text-right text-fg-1 font-medium tnum">{{ money(e.amount) }}</span>
        <span class="flex justify-end">
          <IconButton icon="delete" label="刪除" variant="danger" :size="32" @click="removeExtra(e.id, e.name)" />
        </span>
      </div>
    </AppCard>

    <!-- 成員年度花費：共用一條長條，以顏色區分 -->
    <AppCard>
      <div class="flex items-baseline gap-2.5 flex-wrap">
        <div class="text-section font-bold text-fg-1">成員年度花費</div>
        <div class="text-[11.5px] text-fg-3">依每一筆交易的記帳者加總 · 含年度額外開銷</div>
      </div>
      <div class="mt-4 flex h-2.5 rounded-pill overflow-hidden bg-track">
        <span
          v-for="(m, i) in data?.byMember ?? []"
          :key="m.memberId"
          :class="i === 0 ? 'bg-brand' : 'bg-budget-ok'"
          :style="{ width: (m.amount / (memberTotal || 1)) * 100 + '%' }"
        />
      </div>
      <div class="mt-2.5 flex justify-between text-[12px] text-fg-2">
        <span v-for="(m, i) in data?.byMember ?? []" :key="m.memberId" :class="i > 0 && 'text-right'">
          {{ m.name }} <span class="tnum font-medium">{{ money(m.amount) }}</span>
          <span class="text-[10.5px] text-fg-4"> · {{ m.count }} 筆</span>
        </span>
      </div>
    </AppCard>

    <AppDialog
      :open="!!form"
      title="新增年度額外開銷"
      subtitle="不列入任何單月，但計入該分類的年度總計"
      @close="form = null"
    >
      <template v-if="form">
        <FormField label="項目名稱"><TextInput v-model="form.name" placeholder="例如 日本家庭旅遊" /></FormField>
        <FormField label="金額"><AmountInput v-model="form.amount" /></FormField>
        <div class="flex flex-col gap-[7px]">
          <span class="text-label text-fg-3">記帳者</span>
          <SegmentedControl
            :options="members.active.map((m) => ({ value: String(m.id), label: m.name }))"
            :model-value="String(form.payerId)"
            @update:model-value="form.payerId = Number($event)"
          />
        </div>
        <FormField label="歸屬分類">
          <select
            v-model.number="form.mainCategoryId"
            class="h-[46px] px-2.5 rounded-lg border border-strong bg-surface text-[15px] text-fg-1 outline-none box-border w-full"
          >
            <option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </FormField>
      </template>
      <template #footer>
        <AppButton variant="primary" size="lg" full-width @click="submitExtra">新增</AppButton>
        <AppButton size="lg" @click="form = null">取消</AppButton>
      </template>
    </AppDialog>

    <template #fab>
      <FloatingActionButton label="新增額外開銷" @click="openNew" />
    </template>
  </AppShell>
</template>
