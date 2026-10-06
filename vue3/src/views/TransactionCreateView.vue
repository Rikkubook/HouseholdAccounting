<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AppShell from "@/components/layout/AppShell.vue";
import AppCard from "@/components/base/AppCard.vue";
import AppButton from "@/components/base/AppButton.vue";
import SegmentedControl from "@/components/base/SegmentedControl.vue";
import FormField from "@/components/base/FormField.vue";
import TextInput from "@/components/base/TextInput.vue";
import AmountInput from "@/components/base/AmountInput.vue";
import InlineAlert from "@/components/base/InlineAlert.vue";
import { transactionsApi } from "@/api/transactions";
import { useAuthStore } from "@/stores/auth";
import { useCategoriesStore } from "@/stores/categories";
import { useUiStore } from "@/stores/ui";
import { SCOPE_OPTIONS, useScopeStore, type ScopeName } from "@/stores/scope";
import { todayISO } from "@/utils/format";
import type { TxType } from "@/types/models";

const router = useRouter();
const auth = useAuthStore();
const cats = useCategoriesStore();
const ui = useUiStore();
const scope = useScopeStore();
/** 預設記在目前切換的帳本；建立後不可改到另一本 */
const ledger = ref<ScopeName>(scope.current);

const type = ref<TxType>("expense");
const mainId = ref<number | null>(null);
const subId = ref<number | null>(null);
const amount = ref("");
const date = ref(todayISO());
const note = ref("");
const error = ref("");
const saving = ref(false);

const mainOptions = computed(() => cats.selectable.filter((c) => c.type === type.value));
const currentMain = computed(() => mainOptions.value.find((c) => c.id === mainId.value));
const subOptions = computed(() => currentMain.value?.subCategories ?? []);
const isFutureDate = computed(() => date.value > todayISO());

function switchType(next: string) {
  type.value = next as TxType;
  mainId.value = null;
  subId.value = null;
}

function pickMain(id: number) {
  mainId.value = id;
  subId.value = null;
  error.value = "";
}

async function submit() {
  if (saving.value) return;
  if (!amount.value || Number(amount.value) <= 0) return (error.value = "請填寫金額，且須大於 0");
  if (type.value === "expense" && !mainId.value) return (error.value = "請選擇主分類");
  if (subOptions.value.length && !subId.value) return (error.value = "請選擇子分類");

  saving.value = true;
  error.value = "";
  try {
    await transactionsApi.create({
      type: type.value,
      mainCategoryId: mainId.value,
      subCategoryId: subId.value,
      amount: Number(amount.value),
      date: date.value,
      note: note.value.trim() || undefined,
      scope: ledger.value,
    });
    ui.flash(ledger.value === "personal" ? "已記在個人帳" : "已記下一筆");
    // 儲存成功後回到交易列表，不停留連續記帳
    await router.push({ name: "transactions" });
  } catch {
    error.value = "儲存失敗，請稍後再試";
  } finally {
    saving.value = false;
  }
}

onMounted(() => cats.load());
</script>

<template>
  <AppShell
    title="新增交易"
    subtitle="記帳者自動帶入登入者"
    back-to="/"
    :loading="cats.initialLoading"
    :error="cats.error"
    @retry="cats.load()"
  >
    <AppCard>
      <div class="flex flex-col gap-4">
        <div v-if="scope.canUsePersonal" class="flex flex-col gap-[7px]">
          <span class="text-label text-fg-3">記在</span>
          <SegmentedControl
            :options="SCOPE_OPTIONS.map((o) => ({ value: o.value, label: o.label + '帳' }))"
            :model-value="ledger"
            @update:model-value="ledger = $event as ScopeName"
          />
          <span v-if="ledger === 'personal'" class="text-[10.5px] text-fg-4">只有自己看得到，不計入家庭帳；記下後不能改到家庭帳</span>
        </div>

        <SegmentedControl
          :options="[
            { value: 'expense', label: '支出' },
            { value: 'income', label: '收入' },
          ]"
          :model-value="type"
          @update:model-value="switchType"
        />

        <FormField label="金額" :error="error.includes('金額') ? error : undefined">
          <AmountInput v-model="amount" :invalid="error.includes('金額')" />
        </FormField>

        <div v-if="type === 'expense'" class="flex flex-col gap-2">
          <span class="text-label text-fg-3">主分類</span>
          <div class="grid grid-cols-3 gap-2 md:grid-cols-6">
            <button
              v-for="c in mainOptions"
              :key="c.id"
              type="button"
              class="flex flex-col items-center gap-1.5 py-3 rounded-lg border cursor-pointer min-h-hit"
              :class="
                c.id === mainId
                  ? 'bg-brand-tint border-[rgba(107,92,245,.4)] text-brand-600'
                  : 'bg-surface-subtle border text-fg-2'
              "
              @click="pickMain(c.id)"
            >
              <span class="material-symbols-rounded text-[20px]">{{ c.icon }}</span>
              <span class="text-[12px]">{{ c.name }}</span>
            </button>
          </div>
        </div>

        <div v-if="subOptions.length" class="flex flex-col gap-2">
          <span class="text-label text-fg-3">子分類</span>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="s in subOptions"
              :key="s.id"
              type="button"
              class="px-3.5 min-h-hit md:min-h-0 md:py-2.5 rounded-pill border text-[13px] cursor-pointer"
              :class="s.id === subId ? 'bg-fg-1 border-fg-1 text-fg-brand' : 'bg-surface border-strong text-fg-2'"
              @click="subId = s.id"
            >
              {{ s.name }}
            </button>
          </div>
        </div>

        <FormField label="日期" :hint="isFutureDate ? '這是未來日期，將作為預定支出紀錄' : undefined">
          <input
            v-model="date"
            type="date"
            class="h-[46px] px-3 rounded-lg border border-strong bg-surface text-[14px] text-fg-1 outline-none box-border"
          />
        </FormField>

        <div class="flex flex-col gap-[7px]">
          <span class="text-label text-fg-3">記帳者</span>
          <div class="flex items-center gap-2.5 flex-wrap">
            <span
              class="inline-flex items-center gap-2 pl-2 pr-3.5 py-2 rounded-pill bg-brand-tint text-brand-600 text-[13px]"
            >
              <span
                class="w-[26px] h-[26px] rounded-pill text-fg-brand flex items-center justify-center text-[11px]"
                :style="{ background: auth.user?.color }"
              >
                {{ auth.user?.name }}
              </span>
              {{ auth.user?.name }}
            </span>
            <span class="text-[11px] text-fg-4">自動帶入登入者，不可代記他人</span>
          </div>
        </div>

        <FormField label="備註">
          <TextInput v-model="note" placeholder="例如：週末採買" />
        </FormField>

        <InlineAlert v-if="error && !error.includes('金額')" tone="danger">{{ error }}</InlineAlert>

        <AppButton variant="primary" size="lg" full-width :disabled="saving" @click="submit">
          {{ saving ? "儲存中…" : "儲存" }}
        </AppButton>
      </div>
    </AppCard>
  </AppShell>
</template>
