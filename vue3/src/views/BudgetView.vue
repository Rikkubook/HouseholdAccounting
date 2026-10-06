<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import AppCard from "@/components/base/AppCard.vue";
import AppButton from "@/components/base/AppButton.vue";
import MetricStat from "@/components/base/MetricStat.vue";
import MonthStepper from "@/components/base/MonthStepper.vue";
import ProgressBar from "@/components/base/ProgressBar.vue";
import InlineAlert from "@/components/base/InlineAlert.vue";
import { useBudgetsStore } from "@/stores/budgets";
import { useCategoriesStore } from "@/stores/categories";
import { useSubscriptionsStore } from "@/stores/subscriptions";
import { useUiStore } from "@/stores/ui";
import { normalizeError } from "@/api/client";
import { existsInMonth, money } from "@/utils/format";

/** 本頁位於側欄 ADMIN 區，一般成員無法進入，頁內不再區分角色。 */
const budgets = useBudgetsStore();
const cats = useCategoriesStore();
const subs = useSubscriptionsStore();
const ui = useUiStore();

const drafts = ref<Record<number, string>>({});
const savingAll = ref(false);

const rows = computed(() =>
  cats.floating
    .filter((c) => existsInMonth(c, budgets.month))
    .map((c) => {
      const budget = budgets.amountOf(c.id);
      return {
        id: c.id,
        name: c.name,
        icon: c.icon,
        budget,
        spent: budgets.spentByCategory[c.id] ?? 0,
        draft: drafts.value[c.id] ?? (budget === null ? "" : String(budget)),
      };
    })
);
const missingCount = computed(() => rows.value.filter((r) => r.budget === null).length);

async function saveAll() {
  if (savingAll.value) return;

  const targets = rows.value.filter((r) => r.draft !== "");
  if (!targets.length) return ui.flash("沒有可儲存的變更", "danger");

  /** 資料庫規定預算金額必須大於 0；輸入 0 等同清除該分類本月的上限（改回「無設定」）。 */
  const cleared = targets.filter((r) => Number(r.draft) === 0);
  const updated = targets.filter((r) => Number(r.draft) > 0);

  savingAll.value = true;
  try {
    await Promise.all(targets.map((r) => budgets.save(r.id, Number(r.draft))));
    const parts = [];
    if (updated.length) parts.push("已更新 " + updated.length + " 個分類的預算");
    if (cleared.length) parts.push("已清除 " + cleared.map((r) => r.name).join("、") + " 的預算上限");
    ui.flash(parts.join("，"));
  } catch (e) {
    ui.flash(normalizeError(e).message, "danger");
  } finally {
    savingAll.value = false;
  }
}

async function copyPrevious() {
  await budgets.copyPrevious();
  drafts.value = {};
  ui.flash("已沿用上月預算");
}

async function load(month: string) {
  drafts.value = {};
  await budgets.load(month);
}

onMounted(async () => {
  await Promise.all([cats.load(), subs.load()]);
  await budgets.load();
});
</script>

<template>
  <AppShell
    title="預算管理"
    subtitle="每月各浮動支出分類的上限"
    back-to="/"
    :loading="budgets.initialLoading"
    :error="budgets.error"
    @retry="budgets.load()"
  >
    <template #actions>
      <MonthStepper :model-value="budgets.month" @update:model-value="load" />
      <AppButton icon="content_copy" @click="copyPrevious">沿用上月</AppButton>
    </template>

    <div class="md:hidden flex flex-col gap-3">
      <MonthStepper :model-value="budgets.month" @update:model-value="load" />
      <AppButton icon="content_copy" full-width @click="copyPrevious">沿用上月</AppButton>
    </div>

    <div class="grid gap-3.5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-4">
      <AppCard>
        <div class="grid grid-cols-2 gap-5">
          <MetricStat label="本月預算總額" :value="budgets.total" size="md" hint="含固定支出" />
          <div class="md:pl-5 md:border-l">
            <MetricStat
              label="固定支出（自動推算）"
              :value="budgets.fixedTotal"
              size="md"
              hint="訂閱月換算，年繳 ÷12"
            />
          </div>
        </div>
      </AppCard>

      <InlineAlert v-if="missingCount" tone="warning">
        還有 {{ missingCount }} 個浮動支出分類未設定本月上限，首頁會顯示設定提示。
      </InlineAlert>
      <InlineAlert v-else tone="info">所有浮動支出分類都已設定本月上限。</InlineAlert>
    </div>

    <AppCard pad="none">
      <div class="px-4 py-3.5 border-b md:px-5">
        <div class="text-section font-bold text-fg-1">浮動支出上限</div>
        <div class="text-[11.5px] text-fg-3 mt-0.5">每個分類都必須設定上限；未來月份的實際金額顯示 0</div>
      </div>

      <div
        v-for="row in rows"
        :key="row.id"
        class="px-4 py-3.5 border-b border-[rgba(0,0,0,.04)] md:px-5 md:grid md:items-center md:gap-4"
        :style="{ gridTemplateColumns: 'minmax(0,1fr) 170px 160px' }"
      >
        <div class="flex items-center gap-2.5">
          <span class="w-8 h-8 rounded-md bg-surface-muted border flex items-center justify-center text-fg-2">
            <span class="material-symbols-rounded text-[18px]">{{ row.icon }}</span>
          </span>
          <span class="text-body font-bold text-fg-1">{{ row.name }}</span>
          <span class="ml-auto text-[12px] text-fg-3 tnum md:hidden">
            已花 {{ money(row.spent) }}
          </span>
        </div>

        <div class="mt-3 md:mt-0">
          <ProgressBar :spent="row.spent" :budget="row.budget" />
        </div>

        <div class="mt-3 flex items-baseline gap-1.5 min-w-0 border border-strong rounded-lg px-3 py-1.5 md:mt-0">
          <span class="font-mono text-[12px] text-fg-4">NT$</span>
          <input
            :value="row.draft"
            inputmode="numeric"
            placeholder="無設定"
            class="flex-1 min-w-0 border-none outline-none bg-transparent text-[17px] font-bold text-fg-1 tnum"
            @input="drafts[row.id] = ($event.target as HTMLInputElement).value.replace(/[^\d]/g, '')"
          />
        </div>
      </div>

      <div class="px-4 py-3.5 flex justify-end md:px-5">
        <AppButton variant="primary" icon="save" :disabled="savingAll" @click="saveAll">
          {{ savingAll ? "儲存中…" : "全部儲存" }}
        </AppButton>
      </div>
    </AppCard>

    <AppCard pad="none">
      <div class="px-4 py-3.5 border-b md:px-5">
        <div class="text-section font-bold text-fg-1">固定支出（唯讀）</div>
        <div class="text-[11.5px] text-fg-3 mt-0.5">由訂閱資料自動推算，不可手填；如需調整請到訂閱管理</div>
      </div>
      <div
        v-for="s in subs.activeItems"
        :key="s.id"
        class="flex items-baseline gap-2.5 px-4 py-3 border-b border-[rgba(0,0,0,.04)] text-[12.5px] md:px-5"
      >
        <span class="text-fg-1">{{ s.name }}</span>
        <span class="text-[11px] text-fg-4">{{ s.cycle === "yearly" ? "每年" : "每月" }}</span>
        <span class="ml-auto text-fg-1 tnum">{{ money(budgets.monthlyEquivalent(s.amount, s.cycle)) }} / 月</span>
      </div>
    </AppCard>
  </AppShell>
</template>
