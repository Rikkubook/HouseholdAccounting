<script setup lang="ts">
import { computed } from "vue";
import AppCard from "@/components/base/AppCard.vue";
import { useMembersStore } from "@/stores/members";
import { currentMonth, money, percent, shortDate } from "@/utils/format";
import type { ShareExtra } from "@/utils/memberShares";

/**
 * 當月支出比例卡片：各成員佔當月總支出（含固定支出與年度額外開銷）。統計圖表頁、戶頭對帳頁共用。
 * memberTotals 的順序同 members.active，且已含各成員付的年度額外開銷（見 utils/memberShares.ts）；
 * total 也要含年度額外開銷。年度額外開銷在進度條上用該成員顏色的斜線標示，卡片底部列出明細。
 */
const props = withDefaults(
  defineProps<{ total: number; memberTotals: number[]; title?: string; extras?: ShareExtra[] }>(),
  { title: "當月支出比例", extras: () => [] }
);
const month = defineModel<string>("month", { required: true });
const members = useMembersStore();

/** 成員色沿用成員管理裡自選的頭像色；「其他」用灰色。 */
const OTHER_COLOR = "var(--dot-idle)";
/** 年度額外開銷：同一成員顏色的斜線，看得出是誰付的，也分得出不是一般支出 */
const striped = (color: string) =>
  `repeating-linear-gradient(135deg, ${color} 0 3px, color-mix(in srgb, ${color} 35%, var(--surface)) 3px 6px)`;

/** 各成員支出佔比；不屬於任何啟用成員的支出（如「系統」匯入）併成「其他」排最後。 */
const shares = computed(() => {
  const activeIds = new Set(members.active.map((m) => m.id));
  const extraOf = (ids: (id: number) => boolean) =>
    props.extras.filter((e) => ids(e.payerId)).reduce((sum, e) => sum + e.amount, 0);
  const list = members.active
    .map((m, i) => ({
      key: "m" + m.id,
      name: m.name,
      amount: props.memberTotals[i] ?? 0,
      extra: extraOf((id) => id === m.id),
      color: m.color,
    }))
    .filter((s) => s.amount > 0);
  const other = props.total - list.reduce((sum, s) => sum + s.amount, 0);
  if (other > 0) {
    list.push({ key: "other", name: "其他", amount: other, extra: extraOf((id) => !activeIds.has(id)), color: OTHER_COLOR });
  }
  return list;
});

/** 進度條線段：有年度額外開銷的成員拆成「一般支出（實心）＋額外開銷（斜線）」兩截 */
const segments = computed(() =>
  shares.value.flatMap((s) => {
    const normal = s.amount - s.extra;
    return [
      ...(normal > 0 ? [{ key: s.key, amount: normal, background: s.color, label: `${s.name} ${money(normal)}` }] : []),
      ...(s.extra > 0
        ? [{ key: s.key + "-extra", amount: s.extra, background: striped(s.color), label: `${s.name} 年度額外開銷 ${money(s.extra)}` }]
        : []),
    ];
  })
);

/** 標籤放在各成員（含額外開銷）合併範圍的中點正下方；太靠兩端時改貼齊左右邊，避免超出卡片。 */
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

/** 底部明細：哪一筆、誰付的，配色同進度條上的斜線 */
const extraNotes = computed(() =>
  props.extras.map((e) => ({
    ...e,
    payerName: members.active.find((m) => m.id === e.payerId)?.name ?? "其他",
    color: members.active.find((m) => m.id === e.payerId)?.color ?? OTHER_COLOR,
  }))
);
</script>

<template>
  <AppCard>
    <div class="flex items-center gap-3 flex-wrap">
      <div>
        <div class="text-section font-bold text-fg-1">{{ title }}</div>
        <div class="text-[11.5px] text-fg-3 mt-0.5">各成員佔當月總支出（含固定支出、年度額外開銷）</div>
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
        v-for="seg in segments"
        :key="seg.key"
        class="h-full min-w-[3px] transition-[flex-grow] duration-500 ease-out"
        :style="{ flexGrow: seg.amount, flexBasis: 0, background: seg.background }"
        :title="`${seg.label}（${percent(seg.amount, total)}）`"
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

    <!-- 年度額外開銷明細：斜線那一截是哪一筆 -->
    <ul v-if="extraNotes.length" class="mt-3 pt-2.5 border-t flex flex-col gap-1.5 text-[12px]">
      <li v-for="e in extraNotes" :key="e.id" class="flex items-center gap-2 min-w-0">
        <span class="shrink-0 w-[18px] h-2 rounded-pill" :style="{ background: striped(e.color) }" aria-hidden="true" />
        <span class="shrink-0 font-mono text-[11px] text-fg-4">{{ e.paidOn ? shortDate(e.paidOn) : "未填日期" }}</span>
        <span class="text-fg-2 truncate">{{ e.name }}</span>
        <span class="shrink-0 text-fg-3">{{ e.payerName }}</span>
        <span class="shrink-0 ml-auto text-fg-1 tnum">{{ money(e.amount) }}</span>
      </li>
      <li class="text-[11px] text-fg-4">斜線＝年度額外開銷，已含在上面各成員的金額裡</li>
    </ul>
  </AppCard>
</template>
