<script setup lang="ts">
import FamilyOnlyNotice from "@/components/base/FamilyOnlyNotice.vue";
import { onMounted, ref } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import AppCard from "@/components/base/AppCard.vue";
import AppButton from "@/components/base/AppButton.vue";
import AppDialog from "@/components/base/AppDialog.vue";
import MetricStat from "@/components/base/MetricStat.vue";
import FormField from "@/components/base/FormField.vue";
import TextInput from "@/components/base/TextInput.vue";
import AmountInput from "@/components/base/AmountInput.vue";
import SegmentedControl from "@/components/base/SegmentedControl.vue";
import EmptyState from "@/components/base/EmptyState.vue";
import SubscriptionRow from "@/components/data/SubscriptionRow.vue";
import FloatingActionButton from "@/components/base/FloatingActionButton.vue";
import { useCategoriesStore } from "@/stores/categories";
import { useMembersStore } from "@/stores/members";
import { useSubscriptionsStore } from "@/stores/subscriptions";
import { useUiStore } from "@/stores/ui";
import { normalizeError } from "@/api/client";
import { money, shortDate, todayISO } from "@/utils/format";
import type { BillingCycle, Subscription } from "@/types/models";

const cats = useCategoriesStore();
const members = useMembersStore();
const store = useSubscriptionsStore();
const ui = useUiStore();

interface Form {
  id?: number;
  name: string;
  amount: string;
  cycle: BillingCycle;
  nextChargeDate: string;
  payerId: number;
}
const form = ref<Form | null>(null);

function openNew() {
  form.value = {
    name: "",
    amount: "",
    cycle: "monthly",
    nextChargeDate: todayISO(),
    payerId: members.active[0]?.id ?? 1,
  };
}

function openEdit(sub: Subscription) {
  form.value = {
    id: sub.id,
    name: sub.name,
    amount: String(sub.amount),
    cycle: sub.cycle,
    nextChargeDate: sub.nextChargeDate,
    payerId: sub.payerId,
  };
}

async function submit() {
  const v = form.value;
  if (!v) return;
  if (!v.name.trim()) return ui.flash("請填寫名稱", "danger");
  if (!v.amount || Number(v.amount) <= 0) return ui.flash("請填寫金額", "danger");
  const payload = {
    name: v.name.trim(),
    amount: Number(v.amount),
    cycle: v.cycle,
    nextChargeDate: v.nextChargeDate,
    payerId: v.payerId,
  };
  if (v.id) {
    await store.update(v.id, payload);
    ui.flash("已更新「" + payload.name + "」，金額變更已存入歷史版本");
  } else {
    await store.create(payload);
    ui.flash("已新增訂閱「" + payload.name + "」");
  }
  form.value = null;
}

/** 標記已扣款：以本期扣款日產生交易（金額取設定、記帳者取扣款人）。 */
async function markPaid(sub: Subscription) {
  const paidOn = shortDate(sub.nextChargeDate);
  const next = await store.markPaid(sub.id);
  ui.flash(
    "已於 " +
      paidOn +
      " 產生交易 " +
      money(sub.amount) +
      "（" +
      members.nameOf(sub.payerId) +
      "），下次扣款 " +
      shortDate(next.nextChargeDate)
  );
}

async function toggle(sub: Subscription, isActive: boolean) {
  try {
    await store.setActive(sub.id, isActive);
    ui.flash(isActive ? "已啟用「" + sub.name + "」" : "已停用「" + sub.name + "」");
  } catch (e) {
    ui.flash(normalizeError(e).message, "danger");
  }
}

onMounted(async () => {
  await Promise.all([cats.load(), members.load()]);
  await store.load();
});
</script>

<template>
  <AppShell
    title="訂閱管理"
    subtitle="固定支出的來源；停用不刪除"
    back-to="/"
    :loading="store.initialLoading"
    :error="store.error"
    @retry="store.load()"
  >
    <FamilyOnlyNotice feature="訂閱" />
    <template #actions>
      <AppButton variant="action" icon="add" @click="openNew">新增訂閱</AppButton>
    </template>

    <div class="grid gap-3.5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-4">
      <AppCard>
        <div class="grid grid-cols-2 gap-5">
          <MetricStat label="每月固定支出" :value="store.monthlyTotal" size="md" hint="年繳 ÷12 後合計" />
          <div class="md:pl-5 md:border-l">
            <MetricStat label="年度固定支出" :value="store.yearlyTotal" size="md" hint="月換算 ×12" />
          </div>
        </div>
      </AppCard>
      <AppCard tone="brand" pad="compact">
        <div class="flex h-full flex-col justify-between gap-4 min-h-[118px]">
          <div class="text-[11.5px] opacity-85 leading-snug">進行中的訂閱</div>
          <MetricStat label="" :value="store.activeItems.length" size="md" on-brand hint="停用者不計入固定支出" />
        </div>
      </AppCard>
    </div>

    <AppCard pad="none">
      <div
        class="hidden md:grid px-5 py-2.5 border-b text-[11px] tracking-[0.04em] text-fg-4"
        :style="{ gridTemplateColumns: '34px minmax(88px,1fr) 84px 64px 60px 104px 92px 76px' }"
      >
        <span></span><span>名稱</span><span class="text-right">金額</span><span>週期</span>
        <span>扣款人</span><span>下次扣款日</span><span>狀態</span><span></span>
      </div>

      <SubscriptionRow
        v-for="sub in store.items"
        :key="sub.id"
        :sub="sub"
        :category-name="cats.byId(sub.mainCategoryId)?.name ?? '—'"
        :payer-name="members.nameOf(sub.payerId)"
        :due-label="store.dueLabel(sub)"
        @edit="openEdit"
        @mark-paid="markPaid"
        @toggle="toggle"
      />

      <div v-if="!store.items.length && !store.loading" class="p-4">
        <EmptyState message="還沒有任何訂閱" action-label="新增第一筆" @action="openNew" />
      </div>
    </AppCard>

    <AppDialog
      :open="!!form"
      :title="form?.id ? '編輯訂閱' : '新增訂閱'"
      subtitle="週期僅每月與每年；金額變更會存入歷史版本"
      @close="form = null"
    >
      <template v-if="form">
        <FormField label="名稱"><TextInput v-model="form.name" placeholder="例如 影音串流" /></FormField>
        <FormField label="金額"><AmountInput v-model="form.amount" /></FormField>

        <div class="flex flex-col gap-[7px]">
          <span class="text-label text-fg-3">週期</span>
          <SegmentedControl
            :options="[
              { value: 'monthly', label: '每月' },
              { value: 'yearly', label: '每年' },
            ]"
            :model-value="form.cycle"
            @update:model-value="form.cycle = $event as BillingCycle"
          />
        </div>

        <div class="flex flex-col gap-[7px]">
          <span class="text-label text-fg-3">扣款人</span>
          <SegmentedControl
            :options="members.active.map((m) => ({ value: String(m.id), label: m.name }))"
            :model-value="String(form.payerId)"
            @update:model-value="form.payerId = Number($event)"
          />
          <span class="text-[10.5px] text-fg-4">標記已扣款時會以此人為記帳者產生交易</span>
        </div>

        <FormField label="下次扣款日">
          <input
            v-model="form.nextChargeDate"
            type="date"
            class="h-[46px] px-3 rounded-lg border border-strong bg-surface text-[14px] text-fg-1 outline-none box-border w-full"
          />
        </FormField>

        <p class="m-0 text-[11.5px] text-fg-3">訂閱一律歸屬「訂閱」分類，停用後攤提到已繳期間結束</p>
      </template>

      <template #footer>
        <AppButton variant="primary" size="lg" full-width @click="submit">
          {{ form?.id ? "儲存變更" : "新增" }}
        </AppButton>
        <AppButton size="lg" @click="form = null">取消</AppButton>
      </template>
    </AppDialog>

    <template #fab>
      <FloatingActionButton label="新增訂閱" @click="openNew" />
    </template>
  </AppShell>
</template>
