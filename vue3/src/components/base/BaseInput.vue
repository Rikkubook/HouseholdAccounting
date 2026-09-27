<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string;
    label?: string;
    hint?: string;
    /** 有值時邊框轉桃紅並取代 hint */
    error?: string;
    type?: string;
    placeholder?: string;
    /** 登入頁的「只有底線」變體 */
    underline?: boolean;
  }>(),
  { type: "text", underline: false },
);
defineEmits<{ "update:modelValue": [string] }>();
</script>

<template>
  <label class="flex flex-col gap-[7px]">
    <span v-if="props.label" class="text-label text-fg-3">{{ props.label }}</span>
    <span class="relative block">
      <input
        :type="props.type"
        :value="props.modelValue"
        :placeholder="props.placeholder"
        class="w-full bg-transparent text-fg-1 outline-none"
        :class="[
          props.underline
            ? 'h-[38px] border-0 border-b px-0.5 text-[15px] md:h-[38px]'
            : 'h-hit rounded-lg border bg-surface px-[13px] text-[15px] md:h-11 md:text-[14px]',
          props.error ? 'border-[#c9718f]' : 'border-field',
        ]"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <slot name="suffix" />
    </span>
    <span v-if="props.error || props.hint" class="text-label tracking-normal" :class="props.error ? 'text-[#b03356]' : 'text-fg-4'">
      {{ props.error || props.hint }}
    </span>
  </label>
</template>
