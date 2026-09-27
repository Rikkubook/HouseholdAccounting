<script setup lang="ts">
withDefaults(defineProps<{ tone?: "success" | "danger" | "warning" | "info" }>(), { tone: "info" });
const icons = { success: "check_circle", danger: "error", warning: "warning", info: "info" };
</script>

<template>
  <div
    class="flex items-start gap-2.5 px-3.5 py-[11px] rounded-lg border"
    :class="{
      'bg-action-tint border-[rgba(47,107,245,.24)] text-action-600': tone === 'success',
      'bg-danger-tint border-[var(--danger-border)] text-danger': tone === 'danger',
      'bg-warning-tint border-[var(--warning-border)] text-warning': tone === 'warning',
      'bg-surface-subtle border text-fg-3': tone === 'info',
    }"
  >
    <span class="material-symbols-rounded text-[18px]">{{ icons[tone] }}</span>
    <span class="text-[12.5px] leading-relaxed"><slot /></span>
  </div>
</template>
