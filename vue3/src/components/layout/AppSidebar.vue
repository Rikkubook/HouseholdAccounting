<script setup lang="ts">
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { NAV_ITEMS } from "@/router/nav";

const route = useRoute();
const auth = useAuthStore();
</script>

<template>
  <nav
    class="hidden md:flex w-sidebar shrink-0 flex-col gap-[26px] py-[22px] bg-surface border-r sticky top-0 h-screen box-border"
  >
    <div class="flex items-center gap-2.5 px-5">
      <div class="w-[30px] h-[30px] rounded-md bg-brand" />
      <div class="font-bold text-[15px] text-fg-1">家庭帳</div>
    </div>

    <div class="flex flex-col gap-0.5">
      <template v-for="item in NAV_ITEMS" :key="item.name">
        <div
          v-if="item.adminDivider"
          class="mx-5 mt-2 mb-1 font-mono text-[10.5px] tracking-[0.14em] text-fg-4"
        >
          ADMIN
        </div>
        <RouterLink
          :to="item.to"
          class="flex items-center gap-[11px] mx-2.5 px-3 py-2.5 rounded-md text-body transition-colors"
          :class="
            route.name === item.name
              ? 'bg-brand-tint text-brand-600 font-medium'
              : 'text-fg-2 hover:bg-surface-subtle'
          "
        >
          <span
            class="w-1.5 h-1.5 rounded-pill"
            :class="route.name === item.name ? 'bg-brand-500' : 'bg-dot'"
          />
          {{ item.label }}
        </RouterLink>
      </template>
    </div>

    <div class="mt-auto flex items-center gap-2.5 px-5 pt-3.5 border-t">
      <span
        class="w-7 h-7 rounded-pill flex items-center justify-center text-[11px] text-fg-brand"
        :style="{ background: auth.user?.color }"
      >
        {{ auth.user?.name }}
      </span>
      <span class="text-[12px] text-fg-2">{{ auth.user?.name }} · {{ auth.roleLabel }}</span>
      <button
        type="button"
        title="登出"
        aria-label="登出"
        class="ml-auto w-[30px] h-[30px] rounded-md flex items-center justify-center text-fg-3 hover:bg-surface-subtle cursor-pointer"
        @click="auth.logout()"
      >
        <span class="material-symbols-rounded text-[18px]">logout</span>
      </button>
    </div>
  </nav>
</template>
