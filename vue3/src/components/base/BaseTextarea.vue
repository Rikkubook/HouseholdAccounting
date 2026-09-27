<script setup lang="ts">
const props = defineProps<{ modelValue: string; label?: string; placeholder?: string }>();
defineEmits<{ "update:modelValue": [string] }>();
</script>

<template>
  <label class="flex flex-col gap-2">
    <span v-if="props.label" class="text-label text-fg-3">{{ props.label }}</span>
    <textarea
      :value="props.modelValue"
      :placeholder="props.placeholder"
      class="min-h-[70px] resize-y rounded-lg border border-field bg-surface px-[13px] py-[11px] text-[15px] text-fg-1 outline-none md:min-h-[74px] md:text-[14px]"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </label>
</template>
