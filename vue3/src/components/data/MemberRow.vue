<script setup lang="ts">
import AppBadge from "@/components/base/AppBadge.vue";
import IconButton from "@/components/base/IconButton.vue";
import ToggleSwitch from "@/components/base/ToggleSwitch.vue";
import type { Member } from "@/types/models";

defineProps<{ member: Member; isSelf: boolean }>();
defineEmits<{ edit: [Member]; requestReset: [Member]; toggle: [Member, boolean] }>();
</script>

<template>
  <div
    class="hidden md:grid items-center gap-3 px-5 py-3 border-b border-[rgba(0,0,0,.04)] text-[12.5px]"
    :class="!member.isActive && 'opacity-55'"
    :style="{ gridTemplateColumns: '44px minmax(200px,1fr) 130px 108px 120px 150px' }"
  >
    <span
      class="w-9 h-9 rounded-pill flex items-center justify-center text-[11px] text-fg-brand"
      :style="{ background: member.color }"
    >
      {{ member.name }}
    </span>
    <span class="flex flex-col gap-0.5 min-w-0">
      <span class="flex items-center gap-2">
        <span class="text-body font-bold text-fg-1">{{ member.name }}</span>
        <AppBadge v-if="isSelf" tone="outline" small>目前登入中</AppBadge>
      </span>
      <span v-if="member.resetCode" class="flex items-center gap-1.5 text-[10.5px] text-brand-600 whitespace-nowrap">
        待成員自行重設
        <span class="font-mono tracking-[0.08em] px-1.5 rounded-[5px] bg-brand-tint">{{ member.resetCode }}</span>
      </span>
      <span v-else class="text-[10.5px] text-fg-4">{{ member.joinedMonth }} 加入</span>
    </span>
    <span class="font-mono text-[12px] text-fg-2">{{ member.account }}</span>
    <span>
      <AppBadge :tone="member.role === 'admin' ? 'brand' : 'neutral'">
        {{ member.role === "admin" ? "管理者" : "一般成員" }}
      </AppBadge>
    </span>
    <span>
      <ToggleSwitch
        :model-value="member.isActive"
        :label="member.isActive ? '啟用中' : '已停用'"
        @update:model-value="$emit('toggle', member, $event)"
      />
    </span>
    <span class="flex justify-end gap-0.5">
      <IconButton icon="key" label="要求重新設定密碼" :size="32" @click="$emit('requestReset', member)" />
      <IconButton icon="edit" label="編輯" :size="32" @click="$emit('edit', member)" />
    </span>
  </div>

  <div class="md:hidden px-4 py-3.5 border-b border-[rgba(0,0,0,.04)]" :class="!member.isActive && 'opacity-55'">
    <div class="flex items-center gap-2.5">
      <span
        class="w-10 h-10 rounded-pill flex items-center justify-center text-[12px] text-fg-brand"
        :style="{ background: member.color }"
      >
        {{ member.name }}
      </span>
      <span class="flex flex-col gap-0.5 min-w-0">
        <span class="text-[14px] font-bold text-fg-1">{{ member.name }}</span>
        <span class="font-mono text-[11px] text-fg-4">{{ member.account }}</span>
      </span>
      <AppBadge class="ml-auto" :tone="member.role === 'admin' ? 'brand' : 'neutral'">
        {{ member.role === "admin" ? "管理者" : "一般成員" }}
      </AppBadge>
    </div>
    <div class="mt-3 flex items-center gap-2">
      <ToggleSwitch
        :model-value="member.isActive"
        :label="member.isActive ? '啟用中' : '已停用'"
        @update:model-value="$emit('toggle', member, $event)"
      />
      <span class="ml-auto flex gap-1">
        <IconButton icon="key" label="要求重新設定密碼" :size="40" @click="$emit('requestReset', member)" />
        <IconButton icon="edit" label="編輯" :size="40" @click="$emit('edit', member)" />
      </span>
    </div>
  </div>
</template>
