<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  options: { value: string; label: string }[];
  /** 手機版縮小尺寸 */
  compact?: boolean;
}>();
defineEmits<{ "update:modelValue": [string] }>();
</script>

<template>
  <div
    class="inline-flex gap-1.5 rounded-md border border-card bg-surface"
    :class="props.compact ? 'p-[3px]' : 'p-1'"
  >
    <button
      v-for="o in props.options"
      :key="o.value"
      type="button"
      class="rounded-sm transition-colors duration-150"
      :class="[
        props.compact ? 'px-3 py-1.5 text-[12px]' : 'px-3.5 py-[7px] text-caption',
        o.value === props.modelValue ? 'bg-fg-1 text-white' : 'text-fg-2',
      ]"
      @click="$emit('update:modelValue', o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>
