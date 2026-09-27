<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import AppIcon from "@/components/base/AppIcon.vue";
import { NAV_ITEMS } from "./navItems";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const open = ref(false);
const items = computed(() => NAV_ITEMS.filter((i) => !i.admin || auth.isAdmin));
const currentTitle = computed(() => (route.meta.title as string | undefined) ?? "家庭帳");

// 換頁即收合
watch(() => route.path, () => (open.value = false));

async function signOut() {
  await auth.signOut();
  router.replace({ name: "login" });
}
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-black/[.08] bg-canvas/95 backdrop-blur-[8px]">
    <div class="flex items-center gap-2 px-4 py-2.5">
      <button
        type="button"
        class="-ml-2.5 flex h-hit w-hit flex-col items-center justify-center gap-[5px]"
        :aria-label="open ? '收合選單' : '展開選單'"
        :aria-expanded="open"
        @click="open = !open"
      >
        <span class="h-[1.5px] w-5 rounded-pill bg-fg-1 transition-all duration-200" />
        <span
          class="h-[1.5px] rounded-pill bg-fg-1 transition-all duration-200"
          :class="open ? 'w-5' : 'w-4'"
        />
        <span
          class="h-[1.5px] rounded-pill bg-fg-1 transition-all duration-200"
          :class="open ? 'w-5' : 'w-3.5'"
        />
      </button>

      <span class="h-6 w-6 flex-none rounded-md bg-brand" />
      <span class="truncate text-body font-bold text-fg-1">{{ open ? "家庭帳" : currentTitle }}</span>

      <div class="ml-auto flex flex-none items-center gap-1">
        <span
          class="flex h-8 w-8 items-center justify-center rounded-pill bg-[#e6e2d9] text-mono-sm text-[#6b665e]"
          >{{ auth.user?.name ?? "—" }}</span
        >
        <button
          type="button"
          class="-mr-2.5 flex h-hit w-hit items-center justify-center text-fg-3"
          aria-label="登出"
          @click="signOut"
        >
          <AppIcon name="logout" :size="20" />
        </button>
      </div>
    </div>

    <div v-if="open" class="max-h-[64vh] overflow-auto border-t border-divider bg-surface px-2 py-1.5">
      <RouterLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-[10px] px-3.5 py-[13px] text-[14px]"
        :class="route.path === item.to ? 'bg-brand-tint font-medium text-brand-600' : 'text-fg-2'"
      >
        <span
          class="h-1.5 w-1.5 flex-none rounded-pill"
          :class="route.path === item.to ? 'bg-brand-500' : 'bg-dot-idle'"
        />
        {{ item.name }}
        <span v-if="item.admin" class="ml-auto font-mono text-mono-xs text-fg-4">ADMIN</span>
      </RouterLink>
    </div>
  </header>
</template>
