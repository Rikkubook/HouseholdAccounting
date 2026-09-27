<script setup lang="ts">
import { money, shortDate } from "@/utils/format";
import IconButton from "@/components/base/IconButton.vue";
import type { TransactionView } from "@/types/models";

/** canEdit：管理者，或該筆的記帳者本人。false 時操作圖示直接隱藏，不做灰階。 */
defineProps<{ tx: TransactionView; canEdit: boolean; showPayer?: boolean }>();
defineEmits<{ edit: [TransactionView]; remove: [TransactionView] }>();
</script>

<template>
  <!-- 桌機：多欄表格列 -->
  <div
    class="hidden md:grid items-center gap-3 px-5 py-[11px] border-b border-[rgba(0,0,0,.04)] text-[12.5px] hover:bg-surface-subtle"
    :style="{ gridTemplateColumns: '84px 34px minmax(0,1fr) 72px 104px 72px' }"
  >
    <span class="font-mono text-[11.5px] text-fg-4">{{ shortDate(tx.date) }}</span>
    <span class="w-[26px] h-[26px] rounded-sm bg-surface-muted border flex items-center justify-center text-fg-3">
      <span class="material-symbols-rounded text-[15px]">{{ tx.type === "income" ? "payments" : "receipt_long" }}</span>
    </span>
    <span class="flex items-baseline gap-1.5 min-w-0">
      <span class="text-fg-1 whitespace-nowrap">{{ tx.subCategoryName ?? tx.mainCategoryName ?? "—" }}</span>
      <span v-if="tx.note" class="text-note text-[11px] truncate">{{ tx.note }}</span>
    </span>
    <span v-if="showPayer" class="text-fg-3 text-[12px]">{{ tx.payerName }}</span>
    <span class="text-right text-fg-1 font-medium tnum">{{ money(tx.amount) }}</span>
    <span class="flex justify-end gap-0.5">
      <template v-if="canEdit">
        <IconButton icon="edit" label="編輯這筆" :size="30" @click="$emit('edit', tx)" />
        <IconButton icon="delete" label="刪除這筆" variant="danger" :size="30" @click="$emit('remove', tx)" />
      </template>
    </span>
  </div>

  <!-- 手機：卡片化清單列 -->
  <div class="md:hidden flex items-center gap-2.5 px-4 py-3 border-b border-[rgba(0,0,0,.04)]">
    <span class="flex flex-col gap-0.5 min-w-0" @click="canEdit && $emit('edit', tx)">
      <span class="text-body text-fg-1 truncate">{{ tx.subCategoryName ?? tx.mainCategoryName ?? "—" }}</span>
      <span class="text-[10.5px] text-fg-4">
        {{ tx.mainCategoryName }} · {{ tx.payerName }}<template v-if="tx.note"> · {{ tx.note }}</template>
      </span>
    </span>
    <span class="ml-auto text-body text-fg-1 font-medium tnum">{{ money(tx.amount) }}</span>
    <IconButton v-if="canEdit" icon="edit" label="編輯這筆" :size="40" @click="$emit('edit', tx)" />
  </div>
</template>
