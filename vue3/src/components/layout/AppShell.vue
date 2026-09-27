<script setup lang="ts">
import AppSidebar from "./AppSidebar.vue";
import MobileTopBar from "./MobileTopBar.vue";

defineProps<{ title: string; subtitle?: string; backTo?: string }>();
</script>

<template>
  <div class="min-h-screen bg-canvas md:flex">
    <AppSidebar />
    <MobileTopBar :title="title" :back-to="backTo" />

    <div class="flex-1 min-w-0 max-w-content px-4 pt-3.5 pb-24 md:px-[30px] md:pt-[26px] md:pb-[60px]">
      <div class="hidden md:flex md:items-end md:justify-between md:gap-5 md:flex-wrap md:mb-4">
        <div>
          <h1 class="text-title font-bold text-fg-1 m-0">{{ title }}</h1>
          <p v-if="subtitle" class="text-[12.5px] text-fg-3 mt-[3px] m-0">{{ subtitle }}</p>
        </div>
        <div class="flex gap-2 flex-wrap"><slot name="actions" /></div>
      </div>

      <div class="flex flex-col gap-3.5 md:gap-4"><slot /></div>
    </div>

    <slot name="fab" />
  </div>
</template>
