<script setup lang="ts">
import { computed } from "vue";
import AppCard from "@/components/base/AppCard.vue";
import { useMembersStore } from "@/stores/members";
import { currentMonth, money, percent } from "@/utils/format";

/**
 * 當月支出比例卡片：各成員佔當月總支出（含固定支出）。統計圖表頁、戶頭對帳頁共用。
 * memberTotals 的順序同 members.active（見 utils/memberShares.ts）。
 */
const props = withDefaults(
  defineProps<{ total: number; memberTotals: number[]; title?: string }>(),
  { title: "當月支出比例" }
);
const month = defineModel<string>("month", { required: true });
const members = useMembersStore();

/** 成員色沿用成員管理裡自選的頭像色；「其他」用灰色。 */
const OTHER_COLOR = "var(--dot-idle)";

/** 各成員支出佔比；不屬於任何啟用成員的支出（如「系統」匯入）併成「其他」排最後。 */
const shares = computed(() => {
  const list = members.active
    .map((m, i) => ({ key: "m" + m.id, name: m.name, amount: props.memberTotals[i] ?? 0, color: m.color }))
    .filter((s) => s.amount > 0);
  const other = props.total - list.reduce((sum, s) => sum + s.amount, 0);
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
</script>

<template>
  <AppCard>
    <div class="flex items-center gap-3 flex-wrap">
      <div>
        <div class="text-section font-bold text-fg-1">{{ title }}</div>
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
      <span class="text-metric-sm font-bold text-fg-1 tnum">{{ money(total) }}</span>
      <span class="text-[12px] text-fg-3">當月總支出</span>
    </div>

    <div class="mt-3 flex h-2 gap-[2px] rounded-pill bg-track overflow-hidden">
      <div
        v-for="s in shares"
        :key="s.key"
        class="h-full min-w-[3px] transition-[flex-grow] duration-500 ease-out"
        :style="{ flexGrow: s.amount, flexBasis: 0, background: s.color }"
        :title="`${s.name} ${money(s.amount)}（${percent(s.amount, total)}）`"
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
        <span class="font-mono text-[11px] text-fg-3 tnum">{{ percent(s.amount, total) }}</span>
      </li>
    </ul>
    <div v-else class="mt-3 text-[12px] text-fg-3">這個月還沒有支出</div>
  </AppCard>
</template>
