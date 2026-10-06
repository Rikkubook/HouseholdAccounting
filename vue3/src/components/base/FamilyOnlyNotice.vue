<script setup lang="ts">
import InlineAlert from "@/components/base/InlineAlert.vue";
import { useScopeStore } from "@/stores/scope";

/** 個人帳模式下，尚未支援個人版的頁面在頂端說明：這裡顯示的仍是家庭帳。 */
defineProps<{ feature: string }>();
const scope = useScopeStore();
</script>

<template>
  <InlineAlert v-if="scope.isPersonal">
    目前是個人帳。{{ feature }}還沒有個人版，這裡顯示與修改的都是家庭帳。
  </InlineAlert>
</template>
