<script setup lang="ts">
/**
 * 手機專用。藍漸層膠囊、必帶文字說明，全系統唯一帶陰影的元件，每畫面只一顆。
 */
defineProps<{ icon?: string; label: string }>();
</script>

<template>
  <button
    type="button"
    class="fixed right-[18px] bottom-[22px] z-40 h-[52px] px-5 rounded-pill bg-action text-fg-brand
           inline-flex items-center gap-2 text-[14px] font-bold shadow-fab cursor-pointer md:hidden"
  >
    <span class="material-symbols-rounded text-[22px]">{{ icon ?? "add" }}</span>
    {{ label }}
  </button>
</template>
