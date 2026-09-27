<script setup lang="ts">
/** 畫面正中央、最大 460px、圓角 18px；點面板不關閉，點背景才關閉。 */
defineProps<{ open: boolean; title: string; subtitle?: string }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] bg-[rgba(25,24,23,.42)] flex items-center justify-center p-5"
      @click="emit('close')"
    >
      <div
        class="w-full max-w-[460px] max-h-[88vh] overflow-y-auto overflow-x-hidden bg-surface rounded-dialog px-[22px] pt-5 pb-[26px] shadow-dialog"
        @click.stop
      >
        <div class="flex items-start gap-2.5">
          <div class="flex flex-col gap-0.5 min-w-0">
            <div class="text-[15px] font-bold text-fg-1">{{ title }}</div>
            <div v-if="subtitle" class="text-[11px] text-fg-3">{{ subtitle }}</div>
          </div>
          <button
            type="button"
            aria-label="關閉"
            class="ml-auto -mr-2 w-9 h-9 rounded-md flex items-center justify-center text-fg-3 hover:bg-surface-subtle cursor-pointer"
            @click="emit('close')"
          >
            <span class="material-symbols-rounded text-[20px]">close</span>
          </button>
        </div>
        <div class="mt-4 flex flex-col gap-3.5"><slot /></div>
        <div v-if="$slots.footer" class="mt-5 flex flex-col gap-2.5"><slot name="footer" /></div>
      </div>
    </div>
  </Teleport>
</template>
