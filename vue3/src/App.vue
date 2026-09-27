<script setup lang="ts">
import { onMounted } from "vue";
import { RouterView } from "vue-router";
import AppToast from "@/components/base/AppToast.vue";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
onMounted(() => auth.restore());
</script>

<template>
  <RouterView />
  <AppToast />
</template>
