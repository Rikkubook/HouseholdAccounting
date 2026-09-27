<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    type?: string;
    invalid?: boolean;
    readonly?: boolean;
    maxlength?: number;
    inputmode?: "text" | "numeric";
  }>(),
  { type: "text" }
);
defineEmits<{ "update:modelValue": [string] }>();
</script>

<template>
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :readonly="readonly"
    :maxlength="maxlength"
    :inputmode="inputmode"
    class="h-[46px] px-[13px] rounded-lg text-[15px] text-fg-1 outline-none box-border w-full border"
    :class="[
      invalid ? 'border-[#c9718f]' : 'border-strong',
      readonly && 'bg-canvas text-fg-3 cursor-default',
    ]"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
