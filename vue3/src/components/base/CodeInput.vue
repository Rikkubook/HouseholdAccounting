<script setup lang="ts">
/** 6 位數字代碼：只收數字、等寬字距。 */
defineProps<{ modelValue: string; invalid?: boolean; placeholder?: string }>();
const emit = defineEmits<{ "update:modelValue": [string] }>();
</script>

<template>
  <input
    :value="modelValue"
    :placeholder="placeholder ?? '6 位代碼'"
    inputmode="numeric"
    maxlength="6"
    class="h-[46px] px-[13px] rounded-lg border font-mono text-[18px] tracking-[0.34em] text-fg-1 outline-none box-border w-full"
    :class="invalid ? 'border-[#c9718f]' : 'border-strong'"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6))"
  />
</template>
