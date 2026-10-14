<script setup lang="ts">
import { money, shortDate } from "@/utils/format";
import IconButton from "@/components/base/IconButton.vue";
import ToggleSwitch from "@/components/base/ToggleSwitch.vue";
import type { Subscription } from "@/types/models";

defineProps<{
  sub: Subscription;
  categoryName: string;
  payerName: string;
  /** 到期或逾期提示 */
  dueLabel: string;
}>();
defineEmits<{ edit: [Subscription]; markPaid: [Subscription]; toggle: [Subscription, boolean] }>();
</script>

<template>
  <div
    class="hidden md:grid items-center gap-3 px-5 py-3 border-b border-[rgba(0,0,0,.04)] text-[12.5px]"
    :class="!sub.isActive && 'opacity-55'"
    :style="{ gridTemplateColumns: '34px minmax(88px,1fr) 84px 64px 60px 104px 92px 76px' }"
  >
    <span class="w-[26px] h-[26px] rounded-sm bg-surface-muted border flex items-center justify-center text-fg-3">
      <span class="material-symbols-rounded text-[15px]">autorenew</span>
    </span>
    <span class="flex flex-col gap-0.5 min-w-0">
      <span class="text-fg-1 font-bold truncate">{{ sub.name }}</span>
      <span class="text-[11px] text-fg-4">{{ categoryName }}</span>
    </span>
    <span class="text-right text-fg-1 tnum">{{ money(sub.amount) }}</span>
    <span class="text-fg-2">{{ sub.cycle === "yearly" ? "每年" : "每月" }}</span>
    <span class="text-fg-2">{{ payerName }}</span>
    <span class="flex flex-col gap-0.5">
      <span class="font-mono text-[12px] text-fg-1">{{ shortDate(sub.nextChargeDate) }}</span>
      <span class="text-[10.5px] text-fg-4">{{ dueLabel }}</span>
    </span>
    <span><ToggleSwitch :model-value="sub.isActive" @update:model-value="$emit('toggle', sub, $event)" /></span>
    <span class="flex justify-end gap-0.5">
      <IconButton icon="event_available" label="標記已扣款" :size="30" @click="$emit('markPaid', sub)" />
      <IconButton icon="edit" label="編輯" :size="30" @click="$emit('edit', sub)" />
    </span>
  </div>

  <div class="md:hidden px-4 py-3.5 border-b border-[rgba(0,0,0,.04)]" :class="!sub.isActive && 'opacity-55'">
    <div class="flex items-center gap-2.5">
      <span class="w-9 h-9 rounded-lg bg-surface-muted border flex items-center justify-center text-fg-2">
        <span class="material-symbols-rounded text-[18px]">autorenew</span>
      </span>
      <span class="flex flex-col gap-0.5 min-w-0">
        <span class="text-[14px] font-bold text-fg-1 truncate">{{ sub.name }}</span>
        <span class="text-[10.5px] text-fg-4">
          {{ categoryName }} · {{ sub.cycle === "yearly" ? "每年" : "每月" }} · {{ payerName }}
        </span>
      </span>
      <span class="ml-auto text-[14px] font-bold text-fg-1 tnum">{{ money(sub.amount) }}</span>
    </div>
    <div class="mt-3 flex items-center gap-2">
      <span class="font-mono text-[12px] text-fg-2">{{ shortDate(sub.nextChargeDate) }}</span>
      <span class="text-[10.5px] text-fg-4">{{ dueLabel }}</span>
      <span class="ml-auto flex items-center gap-1">
        <IconButton icon="event_available" label="標記已扣款" :size="40" @click="$emit('markPaid', sub)" />
        <IconButton icon="edit" label="編輯" :size="40" @click="$emit('edit', sub)" />
      </span>
    </div>
  </div>
</template>
