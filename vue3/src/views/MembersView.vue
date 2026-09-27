<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import AppCard from "@/components/base/AppCard.vue";
import AppButton from "@/components/base/AppButton.vue";
import AppDialog from "@/components/base/AppDialog.vue";
import MetricStat from "@/components/base/MetricStat.vue";
import FormField from "@/components/base/FormField.vue";
import TextInput from "@/components/base/TextInput.vue";
import CodeInput from "@/components/base/CodeInput.vue";
import SegmentedControl from "@/components/base/SegmentedControl.vue";
import InlineAlert from "@/components/base/InlineAlert.vue";
import MemberRow from "@/components/data/MemberRow.vue";
import FloatingActionButton from "@/components/base/FloatingActionButton.vue";
import { useAuthStore } from "@/stores/auth";
import { useMembersStore } from "@/stores/members";
import { useUiStore } from "@/stores/ui";
import { normalizeError } from "@/api/client";
import { MEMBER_COLORS } from "@/constants/icons";
import type { Member, Role } from "@/types/models";

const auth = useAuthStore();
const store = useMembersStore();
const ui = useUiStore();

interface Form {
  id?: number;
  name: string;
  account: string;
  initialCode: string;
  role: Role;
  color: string;
}
const form = ref<Form | null>(null);

/** 停用者排在清單最後。 */
const sorted = computed(() => [...store.items].sort((a, b) => Number(b.isActive) - Number(a.isActive)));

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function openNew() {
  form.value = { name: "", account: "", initialCode: randomCode(), role: "member", color: MEMBER_COLORS[0] };
}

function openEdit(m: Member) {
  form.value = { id: m.id, name: m.name, account: m.account, initialCode: "", role: m.role, color: m.color };
}

async function submit() {
  const v = form.value;
  if (!v) return;
  if (!v.name.trim()) return ui.flash("請填寫名稱", "danger");
  if (!v.account.trim()) return ui.flash("請填寫帳號", "danger");
  try {
    if (v.id) {
      await store.update(v.id, { name: v.name.trim(), account: v.account.trim(), role: v.role, color: v.color });
      ui.flash("已更新「" + v.name.trim() + "」");
    } else {
      if (!/^\d{6}$/.test(v.initialCode)) return ui.flash("請輸入 6 位數字的初始代碼", "danger");
      await store.create({
        name: v.name.trim(),
        account: v.account.trim(),
        initialCode: v.initialCode,
        role: v.role,
        color: v.color,
      });
      ui.flash("已新增成員「" + v.name.trim() + "」，請轉達初始代碼 " + v.initialCode);
    }
    form.value = null;
  } catch (e) {
    ui.flash(normalizeError(e).message, "danger");
  }
}

async function requestReset(m: Member) {
  try {
    const code = await store.requestReset(m.id);
    ui.flash("已產生「" + m.name + "」的重設碼 " + code + "，請轉達本人自行設定新密碼");
  } catch (e) {
    ui.flash(normalizeError(e).message, "danger");
  }
}

async function toggle(m: Member, isActive: boolean) {
  try {
    await store.setActive(m.id, isActive);
    ui.flash(isActive ? "已啟用「" + m.name + "」" : "已停用「" + m.name + "」，歷史紀錄完整保留");
  } catch (e) {
    ui.flash(normalizeError(e).message, "danger");
  }
}

onMounted(() => store.load());
</script>

<template>
  <AppShell title="成員管理" subtitle="停用不刪除；歷史紀錄完整保留" back-to="/">
    <template #actions>
      <AppButton variant="action" icon="add" @click="openNew">新增成員</AppButton>
    </template>

    <AppCard>
      <div class="grid grid-cols-3 gap-5">
        <MetricStat label="啟用中成員" :value="store.active.length" size="md" />
        <div class="md:pl-5 md:border-l"><MetricStat label="管理者" :value="store.activeAdmins.length" size="md" /></div>
        <div class="md:pl-5 md:border-l"><MetricStat label="已停用" :value="store.archivedCount" size="md" /></div>
      </div>
    </AppCard>

    <InlineAlert tone="info">
      管理者不設定、也看不到成員密碼。新增成員只給 6 位初始代碼，成員在重設密碼頁自行設定；重設碼不設有效期限。
    </InlineAlert>

    <AppCard pad="none">
      <div class="overflow-x-auto">
        <div class="md:min-w-[852px]">
          <div
            class="hidden md:grid px-5 py-2.5 border-b text-[11px] tracking-[0.04em] text-fg-4"
            :style="{ gridTemplateColumns: '44px minmax(200px,1fr) 130px 108px 120px 150px' }"
          >
            <span></span><span>名稱</span><span>帳號</span><span>角色</span><span>狀態</span><span></span>
          </div>

          <MemberRow
            v-for="m in sorted"
            :key="m.id"
            :member="m"
            :is-self="m.id === auth.user?.id"
            @edit="openEdit"
            @request-reset="requestReset"
            @toggle="toggle"
          />
        </div>
      </div>
    </AppCard>

    <AppDialog
      :open="!!form"
      :title="form?.id ? '編輯成員' : '新增成員'"
      :subtitle="form?.id ? '不含密碼；如需重設請用列尾的鑰匙鍵' : '成員憑初始代碼自行設定密碼'"
      @close="form = null"
    >
      <template v-if="form">
        <FormField label="名稱"><TextInput v-model="form.name" placeholder="例如 小妹" /></FormField>
        <FormField label="帳號"><TextInput v-model="form.account" placeholder="例如 sis" /></FormField>
        <FormField
          v-if="!form.id"
          label="初始代碼"
          hint="成員以此代碼在重設密碼頁自行設定密碼，管理者不會知道密碼"
        >
          <CodeInput v-model="form.initialCode" placeholder="6 位數字" />
        </FormField>

        <div class="flex flex-col gap-[7px]">
          <span class="text-label text-fg-3">角色</span>
          <SegmentedControl
            :options="[
              { value: 'member', label: '一般成員' },
              { value: 'admin', label: '管理者' },
            ]"
            :model-value="form.role"
            @update:model-value="form.role = $event as Role"
          />
        </div>

        <div class="flex flex-col gap-[7px]">
          <span class="text-label text-fg-3">頭像顏色</span>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in MEMBER_COLORS"
              :key="c"
              type="button"
              class="w-hit h-hit rounded-lg border-2 cursor-pointer"
              :class="c === form.color ? 'border-fg-1' : 'border-transparent'"
              :style="{ background: c }"
              :aria-label="c"
              @click="form.color = c"
            />
          </div>
        </div>
      </template>

      <template #footer>
        <AppButton variant="primary" size="lg" full-width @click="submit">
          {{ form?.id ? "儲存變更" : "新增" }}
        </AppButton>
        <AppButton size="lg" @click="form = null">取消</AppButton>
      </template>
    </AppDialog>

    <template #fab>
      <FloatingActionButton label="新增成員" @click="openNew" />
    </template>
  </AppShell>
</template>
