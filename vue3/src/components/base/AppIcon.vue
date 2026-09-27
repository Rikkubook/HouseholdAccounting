<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number; color?: string }>(), { size: 18 });
</script>

<template>
  <span
    class="material-symbols-rounded leading-none"
    :style="{ fontSize: `${size}px`, color }"
    aria-hidden="true"
    >{{ name }}</span
  >
</template>
