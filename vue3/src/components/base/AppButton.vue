<script setup lang="ts">
/** variant：primary 深墨色送出鍵｜action 藍漸層主要新增｜secondary 白底細框｜ghost｜link */
withDefaults(
  defineProps<{
    variant?: "primary" | "action" | "secondary" | "ghost" | "link";
    size?: "sm" | "md" | "lg";
    icon?: string;
    fullWidth?: boolean;
    disabled?: boolean;
    type?: "button" | "submit";
  }>(),
  { variant: "secondary", size: "md", type: "button" }
);

const shells: Record<string, string> = {
  primary: "bg-fg-1 text-fg-brand font-bold",
  action: "bg-action text-fg-brand font-bold hover:brightness-95",
  secondary: "bg-surface text-fg-2 border border-strong hover:bg-surface-subtle",
  ghost: "text-fg-3 hover:bg-surface-subtle",
  link: "text-brand-500 hover:underline px-0",
};
const sizes: Record<string, string> = {
  sm: "h-8 px-3 text-mono rounded-md",
  md: "h-[38px] px-4 text-body rounded-md",
  lg: "h-12 px-5 text-[14.5px] rounded-md",
};
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-[7px] cursor-pointer transition-colors whitespace-nowrap shrink-0"
    :class="[
      shells[variant],
      variant === 'link' ? 'text-[12px] h-auto' : sizes[size],
      fullWidth && 'w-full',
      disabled && 'bg-surface-muted text-fg-4 cursor-not-allowed hover:bg-surface-muted',
    ]"
  >
    <span v-if="icon" class="material-symbols-rounded text-[17px]">{{ icon }}</span>
    <slot />
  </button>
</template>
