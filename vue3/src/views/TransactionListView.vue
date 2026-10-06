<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import AppCard from "@/components/base/AppCard.vue";
import AppButton from "@/components/base/AppButton.vue";
import AppDialog from "@/components/base/AppDialog.vue";
import AppPagination from "@/components/base/AppPagination.vue";
import EmptyState from "@/components/base/EmptyState.vue";
import FormField from "@/components/base/FormField.vue";
import TextInput from "@/components/base/TextInput.vue";
import AmountInput from "@/components/base/AmountInput.vue";
import MonthStepper from "@/components/base/MonthStepper.vue";
import SegmentedControl from "@/components/base/SegmentedControl.vue";
import TransactionRow from "@/components/data/TransactionRow.vue";
import TransactionDayHeader from "@/components/data/TransactionDayHeader.vue";
import { txGridColumns } from "@/components/data/transactionGrid";
import FloatingActionButton from "@/components/base/FloatingActionButton.vue";
import { useAuthStore } from "@/stores/auth";
import { useCategoriesStore } from "@/stores/categories";
import { useMembersStore } from "@/stores/members";
import { useTransactionsStore } from "@/stores/transactions";
import { useUiStore } from "@/stores/ui";
import { normalizeError } from "@/api/client";
import { RouterLink } from "vue-router";
import { currentMonth } from "@/utils/format";
import type { TransactionView } from "@/types/models";

const auth = useAuthStore();
const cats = useCategoriesStore();
const members = useMembersStore();
const store = useTransactionsStore();
const ui = useUiStore();

const editing = ref<TransactionView | null>(null);
const editAmount = ref("");
const editDate = ref("");
const editNote = ref("");
const editMainId = ref<number | null>(null);
const editSubId = ref<number | null>(null);

const typeOptions = [
  { value: "all", label: "全部" },
  { value: "expense", label: "支出" },
  { value: "income", label: "收入" },
];

/** 管理者可編輯全部；一般成員只能編輯自己記的交易。 */
function canEdit(tx: TransactionView) {
  return auth.isAdmin || tx.payerId === auth.user?.id;
}

/**
 * 主分類：同收支別、仍啟用的分類；這筆原本的分類若已停用也保留在選單裡，不會變空白。
 * 子分類跟著選定的主分類走（只列啟用中的，原本選的若已停用也保留）。
 */
const editMainOptions = computed(() => {
  const tx = editing.value;
  if (!tx) return [];
  const options = cats.selectable.filter((c) => c.type === tx.type);
  const original = tx.mainCategoryId == null ? undefined : cats.byId(tx.mainCategoryId);
  return original && !options.some((c) => c.id === original.id) ? [...options, original] : options;
});
const editSubOptions = computed(() => {
  const main = editMainOptions.value.find((c) => c.id === editMainId.value);
  if (!main) return [];
  const active = main.subCategories.filter((sub) => sub.isActive);
  const original = main.subCategories.find((sub) => sub.id === editing.value?.subCategoryId);
  return original && !active.some((sub) => sub.id === original.id) ? [...active, original] : active;
});

function pickEditMain(id: number | null) {
  editMainId.value = id;
  editSubId.value = null; // 換主分類就重選子分類（子分類不可跨主分類搬移）
}

function openEdit(tx: TransactionView) {
  editing.value = tx;
  editAmount.value = String(tx.amount);
  editDate.value = tx.date;
  editNote.value = tx.note ?? "";
  editMainId.value = tx.mainCategoryId;
  editSubId.value = tx.subCategoryId;
}

async function saveEdit() {
  const tx = editing.value;
  if (!tx) return;
  if (editMainOptions.value.length && !editMainId.value) return ui.flash("請選擇主分類", "danger");
  if (editSubOptions.value.length && !editSubId.value) return ui.flash("請選擇子分類", "danger");

  // 分類有改才送：後端收到分類欄位就會重寫分類名稱快照
  const categoryChanged = editMainId.value !== tx.mainCategoryId || editSubId.value !== tx.subCategoryId;
  try {
    await store.update(tx.id, {
      amount: Number(editAmount.value),
      date: editDate.value,
      note: editNote.value.trim() || null,
      ...(categoryChanged ? { mainCategoryId: editMainId.value, subCategoryId: editSubId.value } : {}),
    });
  } catch (e) {
    return ui.flash(normalizeError(e).message, "danger");
  }
  ui.flash("已更新這筆交易，修改紀錄已保存");
  editing.value = null;
}

async function removeTx(tx: TransactionView) {
  await store.remove(tx.id);
  // 軟刪除，前台不提供復原
  ui.flash("已刪除這筆交易");
  editing.value = null;
}

onMounted(async () => {
  await Promise.all([cats.load(), members.load()]);
  await store.load();
});
</script>

<template>
  <AppShell
    title="交易列表"
    subtitle="依建立時間由近到遠"
    back-to="/"
    :loading="store.initialLoading"
    :error="store.error"
    @retry="store.load()"
  >
    <template #actions>
      <RouterLink
        to="/transactions/new"
        class="h-[38px] px-4 rounded-md bg-action text-fg-brand inline-flex items-center gap-[7px] text-body font-bold"
      >
        <span class="material-symbols-rounded text-[17px]">add</span>記一筆
      </RouterLink>
    </template>

    <!-- 篩選：桌機與手機都放在內頁 -->
    <AppCard pad="compact">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
        <MonthStepper
          :model-value="store.query.month ?? currentMonth()"
          :max="currentMonth()"
          @update:model-value="store.setFilter({ month: $event })"
        />
        <SegmentedControl
          :options="typeOptions"
          :model-value="store.query.type ?? 'all'"
          @update:model-value="store.setFilter({ type: $event as 'all' | 'expense' | 'income' })"
        />
        <div class="flex gap-2 md:ml-auto">
          <select
            :value="store.query.mainCategoryId ?? ''"
            class="h-[38px] px-2.5 rounded-md border border-strong bg-surface text-[12.5px] text-fg-2 outline-none"
            @change="store.setFilter({ mainCategoryId: Number(($event.target as HTMLSelectElement).value) || null })"
          >
            <option value="">全部分類</option>
            <option v-for="c in cats.selectable" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <select
            :value="store.query.payerId ?? ''"
            class="h-[38px] px-2.5 rounded-md border border-strong bg-surface text-[12.5px] text-fg-2 outline-none"
            @change="store.setFilter({ payerId: Number(($event.target as HTMLSelectElement).value) || null })"
          >
            <option value="">全部成員</option>
            <option v-for="m in members.active" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
        <div class="relative md:w-[220px]">
          <input
            :value="store.query.keyword"
            placeholder="搜尋備註內容"
            class="w-full h-[38px] pl-9 pr-3 rounded-md border border-strong bg-surface text-[13px] text-fg-1 outline-none box-border"
            @input="store.setFilter({ keyword: ($event.target as HTMLInputElement).value })"
          />
          <span class="material-symbols-rounded absolute left-2.5 top-2.5 text-[18px] text-fg-4">search</span>
        </div>
      </div>
    </AppCard>

    <AppCard pad="none">
      <div
        class="hidden md:grid px-5 py-2.5 border-b text-[11px] tracking-[0.04em] text-fg-4"
        :style="{ gridTemplateColumns: txGridColumns() }"
      >
        <span>日期</span><span></span><span>子項目</span><span>記帳者</span>
        <span class="text-right">金額</span><span></span>
      </div>

      <!-- 桌機：逐列 -->
      <div class="hidden md:block">
        <TransactionRow
          v-for="tx in store.result.items"
          :key="tx.id"
          :tx="tx"
          :can-edit="canEdit(tx)"
          show-payer
          @edit="openEdit"
          @remove="removeTx"
        />
      </div>

      <!-- 手機：按日期分組 + 當日小計 -->
      <div class="md:hidden">
        <div v-for="group in store.groupedByDate" :key="group.date">
          <TransactionDayHeader :date="group.date" :subtotal="group.subtotal" />
          <TransactionRow
            v-for="tx in group.items"
            :key="tx.id"
            :tx="tx"
            :can-edit="canEdit(tx)"
            @edit="openEdit"
            @remove="removeTx"
          />
        </div>
      </div>

      <div v-if="store.isEmpty" class="p-4">
        <EmptyState
          message="沒有符合條件的紀錄"
          action-label="清除篩選條件"
          @action="store.setFilter({ type: 'all', mainCategoryId: null, payerId: null, keyword: '' })"
        />
      </div>
    </AppCard>

    <!-- 頁碼在列表外、置中，最多 3 個 -->
    <AppPagination
      :page="store.result.page"
      :total="store.result.total"
      :page-size="store.result.pageSize"
      @update:page="store.setFilter({ page: $event })"
    />

    <AppDialog
      :open="!!editing"
      title="編輯交易"
      subtitle="收支別與記帳者不可修改；每次修改都會留下紀錄"
      @close="editing = null"
    >
      <FormField label="金額"><AmountInput v-model="editAmount" /></FormField>
      <FormField label="日期">
        <input
          v-model="editDate"
          type="date"
          class="h-[46px] px-3 rounded-lg border border-strong bg-surface text-[14px] text-fg-1 outline-none box-border"
        />
      </FormField>
      <FormField v-if="editMainOptions.length" label="主分類">
        <select
          :value="editMainId ?? ''"
          class="h-[46px] px-2.5 rounded-lg border border-strong bg-surface text-[15px] text-fg-1 outline-none"
          @change="pickEditMain(Number(($event.target as HTMLSelectElement).value) || null)"
        >
          <option value="" disabled>請選擇</option>
          <option v-for="c in editMainOptions" :key="c.id" :value="c.id">
            {{ c.name }}{{ c.isActive ? "" : "（已停用）" }}
          </option>
        </select>
      </FormField>
      <FormField v-if="editSubOptions.length" label="子分類">
        <select
          v-model.number="editSubId"
          class="h-[46px] px-2.5 rounded-lg border border-strong bg-surface text-[15px] text-fg-1 outline-none"
        >
          <option :value="null" disabled>請選擇</option>
          <option v-for="s in editSubOptions" :key="s.id" :value="s.id">
            {{ s.name }}{{ s.isActive ? "" : "（已停用）" }}
          </option>
        </select>
      </FormField>
      <FormField label="備註"><TextInput v-model="editNote" placeholder="例如：週末採買" /></FormField>
      <FormField label="記帳者" readonly-note="不可修改">
        <TextInput :model-value="editing?.payerName ?? ''" readonly />
      </FormField>

      <template #footer>
        <AppButton variant="primary" size="lg" full-width @click="saveEdit">儲存變更</AppButton>
        <AppButton
          v-if="editing && canEdit(editing)"
          size="lg"
          @click="editing && removeTx(editing)"
        >
          刪除
        </AppButton>
      </template>
    </AppDialog>

    <template #fab>
      <RouterLink to="/transactions/new"><FloatingActionButton label="記一筆" /></RouterLink>
    </template>
  </AppShell>
</template>
