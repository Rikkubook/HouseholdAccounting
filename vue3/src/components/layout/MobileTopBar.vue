<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { NAV_ITEMS } from "@/router/nav";
import { useScopeStore } from "@/stores/scope";
import ScopeSwitch from "@/components/layout/ScopeSwitch.vue";

defineProps<{ title: string }>();

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const scope = useScopeStore();
const drawerOpen = ref(false);
const appVersion = __APP_VERSION__;

function go(to: string) {
  drawerOpen.value = false;
  router.push(to);
}
</script>

<template>
  <div class="md:hidden">
    <div class="sticky top-0 z-20 bg-surface border-b px-4 py-2.5 flex items-center gap-2">
      <button
        type="button"
        aria-label="選單"
        class="w-hit h-hit -ml-2.5 flex items-center justify-center text-fg-2 cursor-pointer"
        @click="drawerOpen = true"
      >
        <span class="material-symbols-rounded text-[22px]">menu</span>
      </button>
      <div class="text-[14.5px] font-bold text-fg-1">{{ title }}</div>
      <span
        v-if="scope.isPersonal"
        class="ml-auto px-2.5 py-1 rounded-pill bg-brand-tint text-brand-600 text-[11.5px]"
      >
        個人帳
      </span>
    </div>

    <Teleport to="body">
      <div v-if="drawerOpen" class="fixed inset-0 z-[55] bg-[rgba(25,24,23,.42)]" @click="drawerOpen = false">
        <div class="absolute left-0 top-0 bottom-0 w-[268px] bg-surface flex flex-col py-5" @click.stop>
          <div class="flex items-center gap-2.5 px-5 pb-4 border-b">
            <div class="w-[30px] h-[30px] rounded-md bg-brand" />
            <div class="font-bold text-[15px] text-fg-1">家庭帳</div>
          </div>
          <ScopeSwitch class="mx-2.5 mt-3" />
          <div class="flex flex-col gap-0.5 py-3 overflow-auto">
            <template v-for="item in NAV_ITEMS" :key="item.name">
              <div
                v-if="item.adminDivider"
                class="mx-5 mt-2 mb-1 font-mono text-[10.5px] tracking-[0.14em] text-fg-4"
              >
                ADMIN
              </div>
              <button
                type="button"
                class="flex items-center gap-[11px] mx-2.5 px-3 min-h-hit rounded-md text-body text-left cursor-pointer"
                :class="route.name === item.name ? 'bg-brand-tint text-brand-600 font-medium' : 'text-fg-2'"
                @click="go(item.to)"
              >
                <span
                  class="w-1.5 h-1.5 rounded-pill"
                  :class="route.name === item.name ? 'bg-brand-500' : 'bg-dot'"
                />
                {{ item.label }}
              </button>
            </template>
          </div>
          <button
            type="button"
            class="mt-auto mx-2.5 px-3 min-h-hit flex items-center gap-2.5 rounded-md text-body text-fg-2 border-t cursor-pointer"
            @click="auth.logout()"
          >
            <span class="material-symbols-rounded text-[18px]">logout</span>登出
          </button>
          <div class="px-5 pt-2 font-mono text-[10px] text-fg-4">v{{ appVersion }}</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
