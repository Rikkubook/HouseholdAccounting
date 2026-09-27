<script setup lang="ts">
import { CURATED_ICONS } from "@/constants/icons";

defineProps<{ modelValue: string }>();
defineEmits<{ "update:modelValue": [string] }>();
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="ic in CURATED_ICONS"
      :key="ic"
      type="button"
      class="w-hit h-hit rounded-lg border flex items-center justify-center cursor-pointer"
      :class="
        ic === modelValue
          ? 'bg-brand-tint border-[rgba(107,92,245,.4)] text-brand-600'
          : 'bg-surface-subtle border text-fg-3'
      "
      @click="$emit('update:modelValue', ic)"
    >
      <span class="material-symbols-rounded text-[20px]">{{ ic }}</span>
    </button>
  </div>
</template>
