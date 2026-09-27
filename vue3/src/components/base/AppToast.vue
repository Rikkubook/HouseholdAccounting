<script setup lang="ts">
/** 深色浮動提示，畫面底部置中，約 3 秒自動消失（由 store 控制）。 */
import { useUiStore } from "@/stores/ui";
const ui = useUiStore();
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-200"
      leave-to-class="opacity-0"
    >
      <div v-if="ui.toast" class="fixed left-0 right-0 bottom-6 z-[70] flex justify-center px-5 pointer-events-none">
        <div
          class="flex items-center gap-2.5 px-4 py-[11px] rounded-lg shadow-toast text-[12.5px]"
          :class="ui.toast.tone === 'danger' ? 'bg-danger text-fg-brand' : 'bg-fg-1 text-fg-brand'"
        >
          <span class="material-symbols-rounded text-[18px]">
            {{ ui.toast.tone === "danger" ? "error" : "check_circle" }}
          </span>
          {{ ui.toast.message }}
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
