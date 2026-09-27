<script setup lang="ts">
type Variant = "primary" | "action" | "secondary" | "ghost" | "link";
type Size = "sm" | "md" | "lg";

const props = withDefaults(
  defineProps<{ variant?: Variant; size?: Size; disabled?: boolean; fullWidth?: boolean }>(),
  { variant: "primary", size: "md", disabled: false, fullWidth: false },
);

const SKIN: Record<Variant, string> = {
  primary: "bg-fg-1 text-white hover:bg-[#2c2a26]",
  action: "bg-action text-white hover:bg-action-hover",
  secondary: "bg-surface text-fg-2 border border-card hover:border-card-hover",
  ghost: "bg-transparent text-fg-2 hover:bg-canvas",
  link: "bg-transparent text-brand-500 hover:text-brand-600 !p-0 text-label font-normal",
};

const SIZE: Record<Size, string> = {
  sm: "px-3.5 py-[7px] text-caption",
  md: "px-[18px] py-2.5 text-body",
  lg: "px-[22px] py-[13px] text-section min-h-hit rounded-lg",
};
</script>

<template>
  <button
    type="button"
    :disabled="props.disabled"
    class="inline-flex items-center justify-center gap-2 rounded-md font-bold transition-colors duration-150"
    :class="[
      SKIN[props.variant],
      SIZE[props.size],
      props.fullWidth && 'w-full',
      props.disabled && 'cursor-not-allowed opacity-45',
    ]"
  >
    <slot name="icon" />
    <slot />
  </button>
</template>
