<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import AppCard from "@/components/base/AppCard.vue";
import ProgressBar from "@/components/base/ProgressBar.vue";
import { summaryApi, type StatsPayload } from "@/api/summary";
import { useMembersStore } from "@/stores/members";
import { currentMonth, money, percent } from "@/utils/format";
import { toLoadErrorKind, type LoadErrorKind } from "@/utils/loadError";

const members = useMembersStore();

const month = ref(currentMonth());
const data = ref<StatsPayload | null>(null);
/** 各成員當月支出（含其負責的固定支出），順序同 members.active。 */
const memberTotals = ref<number[]>([]);
const openCategoryId = ref<number | null>(null);
const loading = ref(false);
/** 只在第一次載入完成前為 true；切換月份重新查詢時維持 false。 */
const initialLoading = ref(true);
const error = ref<LoadErrorKind | null>(null);

/** 成員色沿用成員管理裡自選的頭像色；「其他」用灰色。 */
const OTHER_COLOR = "var(--dot-idle)";

/** 當月各成員支出佔比；不屬於任何啟用成員的支出（如「系統」匯入）併成「其他」排最後。 */
const shares = computed(() => {
  if (!data.value) return [];
  const list = members.active
    .map((m, i) => ({
      key: "m" + m.id,
      name: m.name,
      amount: memberTotals.value[i] ?? 0,
      color: m.color,
    }))
    .filter((s) => s.amount > 0);
  const other = data.value.total - list.reduce((sum, s) => sum + s.amount, 0);
  if (other > 0) list.push({ key: "other", name: "其他", amount: other, color: OTHER_COLOR });
  return list;
});

/** 標籤放在各線段中點正下方；太靠兩端時改貼齊左右邊，避免超出卡片。 */
const shareLabels = computed(() => {
  const total = shares.value.reduce((sum, s) => sum + s.amount, 0);
  let start = 0;
  return shares.value.map((s) => {
    const width = (s.amount / total) * 100;
    const center = start + width / 2;
    start += width;
    const style =
      center < 15
        ? { left: "0" }
        : center > 85
          ? { right: "0" }
          : { left: center + "%", transform: "translateX(-50%)" };
    return { ...s, style };
  });
});

async function load() {
  loading.value = true;
  error.value = null;
  openCategoryId.value = null; // 切換月份時退回主分類層
  try {
    const [all, ...perMember] = await Promise.all([
      summaryApi.stats("month", month.value),
      ...members.active.map((m) => summaryApi.stats("month", month.value, m.id)),
    ]);
    data.value = all;
    memberTotals.value = perMember.map((p) => p.total);
  } catch (e) {
    error.value = toLoadErrorKind(e);
  } finally {
    loading.value = false;
    initialLoading.value = false;
  }
}

watch(month, load);
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
    <AppCard>
      <div class="flex items-center gap-3 flex-wrap">
        <div>
          <div class="text-section font-bold text-fg-1">當月支出比例</div>
          <div class="text-[11.5px] text-fg-3 mt-0.5">各成員佔當月總支出（含固定支出）</div>
        </div>
        <input
          v-model="month"
          type="month"
          :max="currentMonth()"
          class="ml-auto h-[38px] px-3 rounded-md border border-strong bg-surface text-[13px] text-fg-1 outline-none box-border"
        />
      </div>

      <div class="mt-4 flex items-baseline gap-2">
        <span class="text-metric-sm font-bold text-fg-1 tnum">{{ money(data?.total ?? 0) }}</span>
        <span class="text-[12px] text-fg-3">當月總支出</span>
      </div>

      <div class="mt-3 flex h-2 gap-[2px] rounded-pill bg-track overflow-hidden">
        <div
          v-for="s in shares"
          :key="s.key"
          class="h-full min-w-[3px] transition-[flex-grow] duration-500 ease-out"
          :style="{ flexGrow: s.amount, flexBasis: 0, background: s.color }"
          :title="`${s.name} ${money(s.amount)}（${percent(s.amount, data?.total ?? 0)}）`"
        />
      </div>

      <ul v-if="shares.length" class="relative mt-2 h-5">
        <li
          v-for="s in shareLabels"
          :key="s.key"
          class="absolute top-0 flex items-baseline gap-1.5 whitespace-nowrap text-[12px]"
          :style="s.style"
        >
          <span class="text-fg-2">{{ s.name }}</span>
          <span class="text-fg-1 tnum">{{ money(s.amount) }}</span>
          <span class="font-mono text-[11px] text-fg-3 tnum">{{ percent(s.amount, data?.total ?? 0) }}</span>
        </li>
      </ul>
      <div v-else class="mt-3 text-[12px] text-fg-3">這個月還沒有支出</div>
    </AppCard>

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
