<script setup lang="ts">
import { money, shortDate } from "@/utils/format";
import IconButton from "@/components/base/IconButton.vue";
import { txGridColumns } from "./transactionGrid";
import type { TransactionView } from "@/types/models";

/**
 * canEdit：管理者，或該筆的記帳者本人。false 時操作圖示直接隱藏，不做灰階。
 * readonly：只看不改（首頁最近交易），桌機不留操作欄。
 */
defineProps<{
  tx: TransactionView;
  canEdit: boolean;
  showPayer?: boolean;
  readonly?: boolean;
}>();
defineEmits<{ edit: [TransactionView]; remove: [TransactionView] }>();
</script>

<template>
  <!-- 桌機：多欄表格列 -->
  <div
    class="hidden md:grid items-center gap-2 px-5 py-[11px] border-b border-[rgba(0,0,0,.04)] text-[12.5px] hover:bg-surface-subtle"
    :style="{ gridTemplateColumns: txGridColumns(readonly) }"
  >
    <span class="font-mono text-[11.5px] text-fg-4">{{ shortDate(tx.date) }}</span>
    <span class="w-[26px] h-[26px] rounded-sm bg-surface-muted border flex items-center justify-center text-fg-3">
      <span class="material-symbols-rounded text-[15px]">{{ tx.type === "income" ? "payments" : "receipt_long" }}</span>
    </span>
    <span class="text-fg-1 truncate">{{ tx.subCategoryName ?? tx.mainCategoryName ?? "—" }}</span>
    <!-- 不顯示記帳者時仍保留這一格，欄位才對得齊 -->
    <span class="text-fg-3 text-[12px] truncate">{{ showPayer ? tx.payerName : "" }}</span>
    <span class="text-note text-[11px] truncate">{{ tx.note }}</span>
    <span class="text-right text-fg-1 font-medium tnum">{{ money(tx.amount) }}</span>
    <span v-if="!readonly" class="flex justify-end gap-0.5">
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
      <span class="text-[10.5px] text-fg-4 truncate">
        {{ [tx.mainCategoryName, tx.payerName].filter(Boolean).join(" · ")
        }}<template v-if="tx.note"> · <span class="text-note">{{ tx.note }}</span></template>
      </span>
    </span>
    <span class="ml-auto shrink-0 text-body text-fg-1 font-medium tnum">{{ money(tx.amount) }}</span>
    <template v-if="canEdit && !readonly">
      <IconButton class="shrink-0" icon="edit" label="編輯這筆" :size="40" @click="$emit('edit', tx)" />
      <!-- 刪除前由頁面跳確認視窗，誤觸不會直接刪掉 -->
      <IconButton class="shrink-0" icon="delete" label="刪除這筆" variant="danger" :size="40" @click="$emit('remove', tx)" />
    </template>
  </div>
</template>
