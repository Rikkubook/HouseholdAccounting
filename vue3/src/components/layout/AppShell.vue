<script setup lang="ts">
import { useRouter } from "vue-router";
import AppSidebar from "./AppSidebar.vue";
import MobileTopBar from "./MobileTopBar.vue";
import AppLoading from "@/components/base/AppLoading.vue";
import type { LoadErrorKind } from "@/utils/loadError";

/**
 * loading 為 true 時，內容區改顯示 AppLoading（非全螢幕）；error 有值時優先顯示失敗畫面。
 * header 與 actions 兩種狀態都維持可見。retry 交給頁面自己重新呼叫 load()；
 * back 預設導回首頁儀表板。
 */
defineProps<{ title: string; subtitle?: string; backTo?: string; loading?: boolean; error?: LoadErrorKind | null }>();
defineEmits<{ retry: [] }>();
const router = useRouter();

function handleBack() {
  router.push("/");
}
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

      <div class="flex flex-col gap-3.5 md:gap-4">
        <AppLoading
          v-if="error"
          :fullscreen="false"
          :error="error"
          @retry="$emit('retry')"
          @back="handleBack"
        />
        <AppLoading v-else-if="loading" :fullscreen="false" />
        <slot v-else />
      </div>
    </div>

    <slot name="fab" />
  </div>
</template>
