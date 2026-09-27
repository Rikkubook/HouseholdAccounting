<script setup lang="ts">
defineProps<{ label: string; hint?: string; error?: string; readonlyNote?: string }>();
</script>

<template>
  <label class="flex flex-col gap-[7px]">
    <span class="text-label text-fg-3">{{ label }}</span>
    <slot />
    <span v-if="error" class="text-[11px] text-danger">{{ error }}</span>
    <span v-else-if="hint" class="text-[10.5px] text-fg-4">{{ hint }}</span>
    <span v-if="readonlyNote" class="text-[10.5px] text-fg-4">{{ readonlyNote }}</span>
  </label>
</template>
