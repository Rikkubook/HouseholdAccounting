<script setup lang="ts">
type Value = string | number | null;
defineProps<{ options: { value: Value; label: string }[]; modelValue: Value }>();
defineEmits<{ "update:modelValue": [Value] }>();
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="o in options"
      :key="String(o.value)"
      type="button"
      class="px-[14px] rounded-pill text-[13px] border cursor-pointer transition-colors min-h-[38px] md:min-h-0 md:py-[9px]"
      :class="
        o.value === modelValue
          ? 'bg-fg-1 border-fg-1 text-fg-brand'
          : 'bg-surface border-strong text-fg-2 hover:bg-surface-subtle'
      "
      @click="$emit('update:modelValue', o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>
