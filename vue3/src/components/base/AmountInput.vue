<script setup lang="ts">
/** 大字級 + 貨幣前綴。手機以系統數字鍵盤輸入，不自製鍵盤。 */
defineProps<{ modelValue: string; invalid?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [string] }>();

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/[^\d]/g, "").slice(0, 9);
  emit("update:modelValue", raw);
}
</script>

<template>
  <div
    class="flex items-baseline gap-2 border rounded-lg px-[14px] py-2"
    :class="invalid ? 'border-[#c9718f]' : 'border-strong'"
  >
    <span class="text-[15px] text-fg-4 font-mono">NT$</span>
    <input
      :value="modelValue ? Number(modelValue).toLocaleString('en-US') : ''"
      inputmode="numeric"
      placeholder="0"
      class="flex-1 min-w-0 border-none outline-none bg-transparent text-metric-sm font-bold text-fg-1 tnum"
      @input="onInput"
    />
  </div>
</template>
