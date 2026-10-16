<script setup lang="ts">
defineProps<{ options: { value: string; label: string }[]; modelValue: string }>();
defineEmits<{ "update:modelValue": [string] }>();
</script>

<template>
  <!-- 選項放不下時改成左右滑動，不讓文字擠到換行 -->
  <div class="inline-flex max-w-full gap-1.5 overflow-x-auto bg-canvas border rounded-lg p-1">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      class="shrink-0 whitespace-nowrap px-4 py-2 rounded-sm text-[12.5px] cursor-pointer transition-colors"
      :class="o.value === modelValue ? 'bg-fg-1 text-fg-brand' : 'text-fg-2 hover:bg-surface-subtle'"
      @click="$emit('update:modelValue', o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>
