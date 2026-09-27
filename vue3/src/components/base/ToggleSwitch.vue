<script setup lang="ts">
defineProps<{ modelValue: boolean; label?: string; disabled?: boolean }>();
defineEmits<{ "update:modelValue": [boolean] }>();
</script>

<template>
  <div class="flex items-center gap-2.5">
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled"
      class="w-[38px] h-[22px] rounded-pill p-[3px] box-border flex transition-colors"
      :class="[modelValue ? 'bg-brand justify-end' : 'bg-dot justify-start', disabled ? 'opacity-50' : 'cursor-pointer']"
      @click="!disabled && $emit('update:modelValue', !modelValue)"
    >
      <span class="w-4 h-4 rounded-pill bg-surface" />
    </button>
    <span v-if="label" class="text-[11.5px]" :class="modelValue ? 'text-brand-600' : 'text-fg-3'">{{ label }}</span>
  </div>
</template>
