<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterView, useRouter } from "vue-router";
import AppLoading from "@/components/base/AppLoading.vue";
import AppToast from "@/components/base/AppToast.vue";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const router = useRouter();
// 第一次導覽要等 auth.restore()，這段期間 RouterView 是空的，先顯示載入頁
const ready = ref(false);
router.isReady().then(() => (ready.value = true));
onMounted(() => auth.restore());
</script>

<template>
  <RouterView v-if="ready" />
  <AppLoading v-else />
  <AppToast />
</template>
