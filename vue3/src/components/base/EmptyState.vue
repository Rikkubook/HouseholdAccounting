<script setup lang="ts">
defineProps<{ message: string; actionLabel?: string }>();
defineEmits<{ action: [] }>();
</script>

<template>
  <div class="py-[34px] px-4 border border-dashed border-[rgba(0,0,0,.14)] rounded-[12px] text-center">
    <div class="text-body text-fg-2">{{ message }}</div>
    <button
      v-if="actionLabel"
      type="button"
      class="mt-2 text-[12px] text-brand-500 cursor-pointer hover:underline"
      @click="$emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>
