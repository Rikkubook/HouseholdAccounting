<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import AppCard from "@/components/base/AppCard.vue";
import AppButton from "@/components/base/AppButton.vue";
import AppBadge from "@/components/base/AppBadge.vue";
import AppDialog from "@/components/base/AppDialog.vue";
import DetailTable from "@/components/base/DetailTable.vue";
import MetricStat from "@/components/base/MetricStat.vue";
import FormField from "@/components/base/FormField.vue";
import TextInput from "@/components/base/TextInput.vue";
import AmountInput from "@/components/base/AmountInput.vue";
import SegmentedControl from "@/components/base/SegmentedControl.vue";
import IconButton from "@/components/base/IconButton.vue";
import FloatingActionButton from "@/components/base/FloatingActionButton.vue";
import { summaryApi, type YearSummaryPayload } from "@/api/summary";
import { useScopeStore } from "@/stores/scope";
import { useAuthStore } from "@/stores/auth";
import { useCategoriesStore } from "@/stores/categories";
import { normalizeError } from "@/api/client";
import { useMembersStore } from "@/stores/members";
import { useUiStore } from "@/stores/ui";
import { money } from "@/utils/format";
import { toLoadErrorKind, type LoadErrorKind } from "@/utils/loadError";

const cats = useCategoriesStore();
const members = useMembersStore();
const ui = useUiStore();
const auth = useAuthStore();

const thisYear = new Date().getFullYear();
const year = ref(thisYear);
const data = ref<YearSummaryPayload | null>(null);
const loading = ref(false);
/** 只在第一次載入完成前為 true；切換年度重新查詢時維持 false。 */
const initialLoading = ref(true);
const error = ref<LoadErrorKind | null>(null);

interface ExtraForm {
  /** 有值＝編輯既有的項目 */
  id?: number;
  name: string;
  amount: string;
  mainCategoryId: number;
  payerId: number;
}
const form = ref<ExtraForm | null>(null);

const yearOptions = computed(() => [thisYear, thisYear - 1, thisYear - 2]);
/** 啟用中的支出分類；編輯時原本的分類若已停用也保留在選單裡 */
const categoryOptions = computed(() => {
  const options = cats.selectable.filter((c) => c.type === "expense");
  const original = form.value?.id ? cats.byId(form.value.mainCategoryId) : undefined;
  return original && !options.some((c) => c.id === original.id) ? [...options, original] : options;
});

/** 每月平均一律 ÷ 12（不看已記錄月份或分類存在月份），見 docs/requirements G-3。 */
const perMonth = (v: number) => money(v / 12);

/** 全年支出含年度額外開銷，與「結餘」卡片同口徑（G-2）。 */
const extrasTotal = computed(() => (data.value?.extras ?? []).reduce((s, e) => s + e.amount, 0));
const annualExpense = computed(() => (data.value ? data.value.expense + extrasTotal.value : null));

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

/**
 * 底部的收入合計、月結餘列（支出合計另外寫在模板裡，排第 2）。
 * 各月結餘不含年度額外開銷（它不分攤到單月）；月結餘列的年度總計＝年度結餘：
 * 全年收入 − 支出合計的年度總計（含額外開銷），額外開銷欄以負數列出差額。
 *
 * 帳本有投資分類時再加投資合計、剩餘現金兩列（個人帳規格 6.3）：投資不算支出，
 * 月結餘＝收入 − 支出，投資還沒扣，所以標成「月結餘（含投資）」；剩餘現金＝月結餘 − 投資。
 * 年度總計的算法和家庭帳一樣，含年度額外開銷。家庭帳沒有投資，不加這兩列。
 */
const balanceRows = computed(() => {
  const monthly = data.value?.monthly ?? [];
  const netExtra = footer.value.extra ? -footer.value.extra : null;
  const netTotal = (data.value?.income ?? 0) - footer.value.total;
  const rows = [
    {
      label: "收入合計",
      order: 1,
      months: monthly.map((m) => m?.income ?? null),
      extra: null as number | null,
      total: data.value?.income ?? 0,
      avg: perMonth,
      signed: false,
    },
    {
      label: netLabel.value,
      order: 4,
      months: monthly.map((m) => m?.net ?? null),
      extra: netExtra,
      total: netTotal,
      avg: perMonth,
      signed: true,
    },
  ];
  if (!data.value?.hasInvestment) return rows;
  return [
    ...rows,
    {
      label: "投資合計",
      order: 3,
      months: monthly.map((m) => m?.investment ?? null),
      extra: null as number | null,
      total: data.value.investment,
      avg: perMonth,
      signed: false,
    },
    {
      label: "剩餘現金",
      order: 5,
      months: monthly.map((m) => (m === null ? null : m.net - m.investment)),
      extra: netExtra,
      total: netTotal - data.value.investment,
      avg: perMonth,
      signed: true,
    },
  ];
});
/** 個人帳有投資時，月結餘還沒扣投資，標明「含投資」 */
const netLabel = computed(() => (data.value?.hasInvestment ? "月結餘（含投資）" : "月結餘"));
const yearNet = computed(() => balanceRows.value[1]!.total);

/** 結餘為負時標紅 */
const netClass = (v: number | null) => (v !== null && v < 0 ? "text-danger" : "text-fg-1");

/** 分類生命週期標記：N月新增 / N月起停用。 */
function lifecycleLabel(row: YearSummaryPayload["rows"][number]) {
  if (row.endMonth < 12) return row.endMonth + 1 + "月起停用";
  if (row.startMonth > 0) return row.startMonth + 1 + "月新增";
  return "";
}

function cellClass(row: YearSummaryPayload["rows"][number], value: number | null) {
  if (value === null) return "text-fg-disabled";
  if (row.monthlyBudget && value > row.monthlyBudget) return "text-state-near";
  return "text-fg-2";
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    data.value = await summaryApi.year(year.value);
  } catch (e) {
    error.value = toLoadErrorKind(e);
  } finally {
    loading.value = false;
    initialLoading.value = false;
  }
}

function openNew() {
  form.value = {
    name: "",
    amount: "",
    mainCategoryId: categoryOptions.value[0]?.id ?? 1,
    // 個人帳的支付者固定是本人
    payerId: (scope.isPersonal ? auth.user?.id : members.active[0]?.id) ?? 1,
  };
}

async function submitExtra() {
  const v = form.value;
  if (!v) return;
  if (!v.name.trim()) return ui.flash("請填寫項目名稱", "danger");
  if (!v.amount || Number(v.amount) <= 0) return ui.flash("請填寫金額", "danger");
  const fields = { name: v.name.trim(), amount: Number(v.amount), mainCategoryId: v.mainCategoryId, payerId: v.payerId };
  try {
    if (v.id) await summaryApi.updateYearExtra(v.id, fields);
    else await summaryApi.createYearExtra({ year: year.value, ...fields });
  } catch (e) {
    return ui.flash(normalizeError(e).message, "danger");
  }
  ui.flash((v.id ? "已更新年度額外開銷「" : "已新增年度額外開銷「") + fields.name + "」");
  form.value = null;
  await load();
}

function openEdit(extra: YearSummaryPayload["extras"][number]) {
  form.value = {
    id: extra.id,
    name: extra.name,
    amount: String(extra.amount),
    mainCategoryId: extra.mainCategoryId,
    payerId: extra.payerId,
  };
}

/** 待確認刪除的年度額外開銷；此表是實體刪除，刪了無法復原，一律先確認。 */
const confirmingExtra = ref<YearSummaryPayload["extras"][number] | null>(null);
const removingExtra = ref(false);

function removeExtra(extra: YearSummaryPayload["extras"][number]) {
  confirmingExtra.value = extra;
}

async function confirmRemoveExtra() {
  const extra = confirmingExtra.value;
  if (!extra || removingExtra.value) return;
  removingExtra.value = true;
  try {
    await summaryApi.removeYearExtra(extra.id);
    ui.flash("已刪除「" + extra.name + "」");
    confirmingExtra.value = null;
    await load();
  } finally {
    removingExtra.value = false;
  }
}

const scope = useScopeStore();
/**
 * 年度額外開銷跟著分類屬於哪本帳：家庭帳限管理者，個人帳本人就能新增、刪除（個人帳第 2 批）。
 */
const canEditExtras = computed(() => scope.isPersonal || auth.isAdmin);
watch(year, load);
// 換帳本：分類選單也換成那本帳的
watch(
  () => scope.current,
  () => Promise.all([cats.load(), load()])
);
onMounted(async () => {
  await Promise.all([cats.load(), members.load()]);
  await load();
});
</script>

<template>
  <AppShell
    title="年度彙整"
    subtitle="橫向檢視 12 個月各分類金額"
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
      <AppButton v-if="canEditExtras" variant="action" icon="add" @click="openNew">新增年度額外開銷</AppButton>
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
        <div class="md:pl-5 md:border-l"><MetricStat
            label="全年支出"
            :value="annualExpense"
            size="md"
            :hint="extrasTotal ? '包含年度額外開銷 ' + money(extrasTotal) : ''"
          /></div>
        <div class="md:pl-5 md:border-l">
          <MetricStat
            :label="data?.hasInvestment ? '結餘（含投資）' : '結餘'"
            :value="data ? yearNet : null"
            size="md"
            :hint="
              data?.hasInvestment
                ? '含投資；剩餘現金 ' + money(yearNet - data.investment)
                : '包含年度額外開銷' + (footer.extra ? ' ' + money(footer.extra) : '')
            "
          />
        </div>
        <div class="md:pl-5 md:border-l">
          <MetricStat
            label="已記錄月份"
            :value="data?.recordedMonths ?? null"
            size="md"
            :hint="annualExpense !== null ? '每月平均 ' + perMonth(annualExpense) : ''"
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
              {{ perMonth(row.total) }}
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

          <!-- 底部合計：收入合計 → 支出合計 →（投資合計）→ 月結餘 →（剩餘現金），對應試算表的順序 -->
          <div class="flex flex-col">
          <div
            class="order-2 grid items-center h-[52px] bg-surface border-t text-[12.5px]"
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
              {{ perMonth(footer.total) }}
            </span>
            <span class="text-right pr-4 font-mono text-[11px] text-fg-3">100.0%</span>
          </div>

          <div
            v-for="b in balanceRows"
            :key="b.label"
            class="grid items-center h-[52px] bg-surface border-t text-[12.5px]"
            :style="{ order: b.order, gridTemplateColumns: '150px repeat(12,minmax(72px,1fr)) 88px 108px 100px 96px 92px' }"
          >
            <span
              class="sticky left-0 z-[2] h-[52px] flex items-center px-4 bg-surface box-border shadow-[1px_0_0_rgba(0,0,0,.09)] font-bold text-fg-1"
            >
              {{ b.label }}
            </span>
            <span
              v-for="(v, i) in b.months"
              :key="i"
              class="text-right pr-1 font-mono tnum"
              :class="b.signed ? netClass(v) : 'text-fg-2'"
            >
              {{ v === null ? "—" : money(v) }}
            </span>
            <span class="text-right pr-1 font-mono tnum" :class="b.extra === null ? 'text-fg-4' : netClass(b.extra)">
              {{ b.extra === null ? "—" : money(b.extra) }}
            </span>
            <span class="text-right pr-1 font-bold tnum" :class="b.signed ? netClass(b.total) : 'text-fg-1'">
              {{ money(b.total) }}
            </span>
            <span class="text-right pr-1 font-mono tnum text-fg-4">—</span>
            <span class="text-right pr-1 font-mono tnum" :class="b.signed ? netClass(b.total) : 'text-fg-3'">
              {{ b.avg(b.total) }}
            </span>
            <span class="text-right pr-4 font-mono text-[11px] text-fg-4">—</span>
          </div>
          </div>
        </div>
      </div>
    </AppCard>

    <!-- 手機：每分類卡片 + 可橫捲的 12 月數字帶 -->
    <div class="md:hidden flex flex-col gap-3.5">
      <AppCard v-if="data" pad="compact">
        <div class="flex items-center gap-2">
          <span class="text-[14.5px] font-bold text-fg-1">{{ netLabel }}</span>
          <span class="ml-auto text-[16px] font-bold tnum" :class="netClass(yearNet)">
            年度結餘 {{ money(yearNet) }}
          </span>
        </div>
        <div v-if="data.hasInvestment" class="mt-1.5 flex gap-4 text-[11px] text-fg-3">
          <span>投資 {{ money(data.investment) }}</span>
          <span :class="netClass(yearNet - data.investment)">剩餘現金 {{ money(yearNet - data.investment) }}</span>
        </div>
        <div class="mt-3 pt-3 border-t overflow-x-auto">
          <div class="flex gap-3 min-w-max">
            <span v-for="(m, i) in data.monthly" :key="i" class="flex flex-col items-end gap-0.5">
              <span class="font-mono text-[10px] text-fg-4">{{ i + 1 }}月</span>
              <span class="font-mono text-[12px] tnum" :class="netClass(m?.net ?? null)">
                {{ m === null ? "—" : money(m.net) }}
              </span>
              <span class="font-mono text-[10px] text-fg-4 tnum">收 {{ m === null ? "—" : money(m.income) }}</span>
              <span class="font-mono text-[10px] text-fg-4 tnum">支 {{ m === null ? "—" : money(m.expense) }}</span>
              <span v-if="data.hasInvestment" class="font-mono text-[10px] text-fg-4 tnum">
                投 {{ m === null ? "—" : money(m.investment) }}
              </span>
            </span>
          </div>
        </div>
      </AppCard>
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
        :style="{ gridTemplateColumns: 'minmax(0,1fr) 96px 76px 120px 72px' }"
      >
        <span class="text-fg-1 truncate">{{ e.name }}</span>
        <span class="text-fg-3">{{ e.categoryName }}</span>
        <span class="text-fg-3">{{ e.payerName }}</span>
        <span class="text-right text-fg-1 font-medium tnum">{{ money(e.amount) }}</span>
        <span class="flex justify-end gap-0.5">
          <template v-if="canEditExtras">
            <IconButton icon="edit" label="編輯" :size="32" @click="openEdit(e)" />
            <IconButton icon="delete" label="刪除" variant="danger" :size="32" @click="removeExtra(e)" />
          </template>
        </span>
      </div>
    </AppCard>

    <AppDialog
      :open="!!form"
      :title="form?.id ? '編輯年度額外開銷' : '新增年度額外開銷'"
      subtitle="不列入任何單月，但計入該分類的年度總計"
      @close="form = null"
    >
      <template v-if="form">
        <FormField label="項目名稱"><TextInput v-model="form.name" placeholder="例如 日本家庭旅遊" /></FormField>
        <FormField label="金額"><AmountInput v-model="form.amount" /></FormField>
        <div v-if="!scope.isPersonal" class="flex flex-col gap-[7px]">
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
        <AppButton variant="primary" size="lg" full-width @click="submitExtra">{{ form?.id ? "儲存變更" : "新增" }}</AppButton>
        <AppButton size="lg" @click="form = null">取消</AppButton>
      </template>
    </AppDialog>

    <AppDialog
      :open="!!confirmingExtra"
      title="確定要刪除這筆年度額外開銷？"
      subtitle="刪除後無法復原"
      @close="confirmingExtra = null"
    >
      <DetailTable
        v-if="confirmingExtra"
        :columns="[
          { label: '項目', value: confirmingExtra.name, width: 'minmax(0,1fr)' },
          { label: '分類', value: confirmingExtra.categoryName },
          { label: '記帳者', value: confirmingExtra.payerName },
          { label: '金額', value: money(confirmingExtra.amount), align: 'right', emphasis: true },
        ]"
      />
      <template #footer>
        <AppButton variant="primary" size="lg" full-width :disabled="removingExtra" @click="confirmRemoveExtra">
          刪除
        </AppButton>
        <AppButton size="lg" @click="confirmingExtra = null">取消</AppButton>
      </template>
    </AppDialog>

    <template #fab>
      <FloatingActionButton v-if="canEditExtras" label="新增額外開銷" @click="openNew" />
    </template>
  </AppShell>
</template>
