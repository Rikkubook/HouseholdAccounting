<script setup lang="ts">
const props = defineProps<{ selected?: boolean }>();
</script>

<template>
  <button
    type="button"
    class="rounded-pill border px-[15px] py-2.5 text-[13px] transition-colors duration-150 md:px-3.5 md:py-[9px]"
    :class="
      props.selected
        ? 'border-fg-1 bg-fg-1 text-white'
        : 'border-field bg-surface text-fg-2 hover:border-card-hover'
    "
  >
    <slot />
  </button>
</template>
