<script setup lang="ts">
/**
 * 旋轉圓環：track 底圈 + 品牌紫漸層弧。
 * stopped 時停在當下角度（不歸零），弧改成錯誤色——同一個元件從載入切到失敗，看起來像轉到一半卡住。
 */
import AppIcon from "@/components/base/AppIcon.vue";

withDefaults(defineProps<{ size?: number; stopped?: boolean; /** 圓環中間的 Material Symbols 圖示 */ icon?: string }>(), {
  size: 36,
  stopped: false,
});
</script>

<template>
  <div class="ring" :class="{ 'is-stopped': stopped }" :style="{ '--size': `${size}px` }" aria-hidden="true">
    <div class="arc" />
    <div v-if="icon" class="ring-icon"><AppIcon :name="icon" :size="Math.round(size * 0.46)" /></div>
  </div>
</template>

<style scoped>
.ring {
  --arc-start: var(--brand-500);
  --arc-end: var(--brand-magenta);
  position: relative;
  width: var(--size);
  height: var(--size);
  flex: none;
}
.arc {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    conic-gradient(from 0deg, transparent 0turn, var(--arc-start) 0.12turn, var(--arc-end) 0.72turn, transparent 0.72turn),
    var(--track);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px));
  animation: spin 0.9s linear infinite;
}
/* 弧頭圓端，落在 .72turn */
.arc::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--arc-end);
  transform: rotate(0.72turn) translateY(calc(var(--size) / -2 + 2px)) translate(-50%, -50%);
  transform-origin: 0 0;
}
.ring-icon {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--arc-end);
}
.is-stopped {
  --arc-start: var(--danger-fg);
  --arc-end: var(--danger-fg);
}
.is-stopped .arc {
  animation-play-state: paused;
}
@keyframes spin {
  to {
    transform: rotate(1turn);
  }
}
/* 減少動態：放慢而不停，仍看得出在載入 */
@media (prefers-reduced-motion: reduce) {
  .arc {
    animation-duration: 3s;
  }
}
</style>
