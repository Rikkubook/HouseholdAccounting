<script setup lang="ts">
/**
 * 通用載入頁：品牌字 + 旋轉圓環 + 一行說明；error 有值時切成失敗畫面，圓環停在當下角度。
 * fullscreen=false 用在內容區內（外面已有側欄），只佔中間一塊。
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import AppButton from "@/components/base/AppButton.vue";
import LoadingSpinner from "@/components/base/LoadingSpinner.vue";
import type { LoadErrorKind } from "@/utils/loadError";

const props = withDefaults(
  defineProps<{
    message?: string;
    /** 超過幾毫秒顯示「網路較慢」提示 */
    slowAfter?: number;
    error?: LoadErrorKind | null;
    fullscreen?: boolean;
  }>(),
  { message: "載入中", slowAfter: 8000, error: null, fullscreen: true },
);
const emit = defineEmits<{ retry: []; back: [] }>();

// 失敗畫面只換文字，版型固定
const FAILS: Record<LoadErrorKind, { icon: string; title: string; desc: string; code: string; retry: boolean }> = {
  offline: {
    icon: "cloud_off",
    title: "沒有網路連線",
    desc: "連上網路後再重新載入。已記的帳目不會遺失。",
    code: "OFFLINE",
    retry: true,
  },
  server: {
    icon: "priority_high",
    title: "伺服器暫時無法回應",
    desc: "稍等一下再重新載入。已記的帳目不會遺失。",
    code: "ERROR · 503",
    retry: true,
  },
  notfound: {
    icon: "question_mark",
    title: "找不到這個頁面",
    desc: "連結可能已失效，或頁面已移除。",
    code: "ERROR · 404",
    retry: false,
  },
};
const fail = computed(() => (props.error ? FAILS[props.error] : null));

const slow = ref(false);
let timer: number | undefined;
function armSlowTimer() {
  window.clearTimeout(timer);
  slow.value = false;
  if (!props.error) timer = window.setTimeout(() => (slow.value = true), props.slowAfter);
}
watch(() => props.error, armSlowTimer, { immediate: true });
onBeforeUnmount(() => window.clearTimeout(timer));
</script>

<template>
  <div
    class="grid place-items-center px-4"
    :class="fullscreen ? 'min-h-screen bg-canvas py-10' : 'py-20'"
  >
    <!-- 圓環在兩種狀態都保持掛載，失敗時才能停在原本角度 -->
    <div
      class="flex w-full flex-col items-center text-center"
      :class="fail ? 'max-w-[300px] gap-[18px]' : 'max-w-[220px] gap-[22px]'"
      :role="fail ? 'alert' : 'status'"
      aria-live="polite"
    >
      <span v-if="!fail" class="text-[17px] font-black tracking-[.02em] text-fg-1">家庭帳</span>

      <LoadingSpinner :size="fail ? 48 : 36" :stopped="!!fail" :icon="fail?.icon" />

      <template v-if="!fail">
        <div class="flex flex-col items-center gap-1">
          <span class="text-body text-fg-2">{{ message }}</span>
          <span v-if="slow" class="text-body text-fg-3">網路較慢，仍在讀取</span>
          <span class="font-mono text-mono tracking-[.12em] text-fg-4">LOADING</span>
        </div>
      </template>

      <template v-else>
        <div class="flex flex-col gap-1.5">
          <h1 class="m-0 text-title font-bold tracking-[-.01em] text-fg-1">{{ fail.title }}</h1>
          <p class="m-0 text-body text-fg-3">{{ fail.desc }}</p>
        </div>
        <div class="flex w-full gap-2">
          <AppButton :variant="fail.retry ? 'secondary' : 'primary'" class="flex-1" @click="emit('back')">
            回總覽
          </AppButton>
          <AppButton v-if="fail.retry" variant="primary" icon="refresh" class="flex-1" @click="emit('retry')">
            重新載入
          </AppButton>
        </div>
        <span class="font-mono text-mono tracking-[.12em] text-fg-4">{{ fail.code }}</span>
      </template>
    </div>
  </div>
</template>
