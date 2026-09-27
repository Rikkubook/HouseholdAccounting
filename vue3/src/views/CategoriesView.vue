<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import AppCard from "@/components/base/AppCard.vue";
import AppButton from "@/components/base/AppButton.vue";
import AppBadge from "@/components/base/AppBadge.vue";
import AppDialog from "@/components/base/AppDialog.vue";
import FormField from "@/components/base/FormField.vue";
import TextInput from "@/components/base/TextInput.vue";
import SegmentedControl from "@/components/base/SegmentedControl.vue";
import IconButton from "@/components/base/IconButton.vue";
import IconPicker from "@/components/base/IconPicker.vue";
import InlineAlert from "@/components/base/InlineAlert.vue";
import EmptyState from "@/components/base/EmptyState.vue";
import FloatingActionButton from "@/components/base/FloatingActionButton.vue";
import { useCategoriesStore } from "@/stores/categories";
import { useUiStore } from "@/stores/ui";
import { normalizeError } from "@/api/client";
import type { CategoryNature, MainCategory, TxType } from "@/types/models";

const cats = useCategoriesStore();
const ui = useUiStore();

type Filter = "all" | "floating" | "fixed" | "income";
const filter = ref<Filter>("all");
const selectedId = ref<number | null>(null);

interface MainForm {
  kind: "main";
  id?: number;
  name: string;
  icon: string;
  type: TxType;
  nature: CategoryNature;
}
interface SubForm {
  kind: "sub";
  parentId: number;
  parentName: string;
  subId?: number;
  name: string;
}
const form = ref<MainForm | SubForm | null>(null);

const filterOptions = [
  { value: "all", label: "全部" },
  { value: "floating", label: "浮動支出" },
  { value: "fixed", label: "固定支出" },
  { value: "income", label: "收入" },
];

/** 停用的分類集中排在最下面，啟用與停用兩組各自維持原本順序。 */
function byActiveFirst<T extends { isActive: boolean }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(b.isActive) - Number(a.isActive));
}

const visible = computed(() =>
  byActiveFirst(
    cats.items.filter((c) => {
      if (filter.value === "all") return true;
      if (filter.value === "income") return c.type === "income";
      return c.type === "expense" && c.nature === filter.value;
    })
  )
);
const selected = computed(() => cats.items.find((c) => c.id === selectedId.value) ?? visible.value[0]);
const subs = computed(() => byActiveFirst(selected.value?.subCategories ?? []));

function tagOf(c: MainCategory) {
  if (c.type === "income") return { label: "收入", tone: "success" as const };
  return c.nature === "fixed"
    ? { label: "固定支出", tone: "neutral" as const }
    : { label: "浮動支出", tone: "brand" as const };
}

function openNewMain() {
  form.value = { kind: "main", name: "", icon: "category", type: "expense", nature: "floating" };
}

function openEditMain(c: MainCategory) {
  form.value = {
    kind: "main",
    id: c.id,
    name: c.name,
    icon: c.icon,
    type: c.type,
    nature: c.nature ?? "floating",
  };
}

function openNewSub() {
  if (!selected.value) return;
  form.value = { kind: "sub", parentId: selected.value.id, parentName: selected.value.name, name: "" };
}

function openEditSub(subId: number, name: string) {
  if (!selected.value) return;
  form.value = { kind: "sub", parentId: selected.value.id, parentName: selected.value.name, subId, name };
}

async function submit() {
  const v = form.value;
  if (!v) return;
  if (!v.name.trim()) return ui.flash("請填寫名稱", "danger");
  try {
    if (v.kind === "main") {
      const payload = { name: v.name.trim(), icon: v.icon, type: v.type, nature: v.type === "income" ? null : v.nature };
      if (v.id) {
        await cats.updateMain(v.id, payload);
        ui.flash("已更新主分類「" + payload.name + "」，全部期間同步顯示新名稱");
      } else {
        await cats.createMain(payload);
        ui.flash("已新增主分類「" + payload.name + "」，請到預算管理設定上限");
      }
    } else if (v.subId) {
      await cats.renameSub(v.subId, v.name.trim());
      ui.flash("已更新子分類「" + v.name.trim() + "」");
    } else {
      await cats.createSub(v.parentId, v.name.trim());
      ui.flash("已在「" + v.parentName + "」新增子分類「" + v.name.trim() + "」");
    }
    form.value = null;
  } catch (e) {
    ui.flash(normalizeError(e).message, "danger");
  }
}

/** 只能停用，不提供刪除；既有交易保留原分類。 */
async function archiveMain(c: MainCategory) {
  try {
    if (c.isActive) {
      await cats.archiveMain(c.id);
      ui.flash("已停用「" + c.name + "」，歷史紀錄不受影響");
    } else {
      await cats.restoreMain(c.id);
      ui.flash("已重新啟用「" + c.name + "」");
    }
  } catch (e) {
    ui.flash(normalizeError(e).message, "danger");
  }
}

async function toggleSub(s: { id: number; isActive: boolean; name: string }) {
  try {
    if (s.isActive) {
      await cats.archiveSub(s.id);
      ui.flash("已停用子分類「" + s.name + "」");
    } else {
      await cats.restoreSub(s.id);
      ui.flash("已重新啟用子分類「" + s.name + "」");
    }
  } catch (e) {
    ui.flash(normalizeError(e).message, "danger");
  }
}

onMounted(() => cats.load());
</script>

<template>
  <AppShell title="分類設定" subtitle="分類為主檔，異動立即全域生效" back-to="/">
    <template #actions>
      <AppButton variant="action" icon="add" @click="openNewMain">新增主分類</AppButton>
    </template>

    <SegmentedControl
      :options="filterOptions"
      :model-value="filter"
      @update:model-value="filter = $event as Filter"
    />

    <div class="grid gap-3.5 md:gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-start">
      <AppCard pad="none">
        <div class="px-4 py-3.5 border-b md:px-5">
          <div class="text-section font-bold text-fg-1">主分類</div>
          <div class="text-[11.5px] text-fg-3 mt-0.5">停用後不再出現在新增交易選單，歷史紀錄不變</div>
        </div>

        <div
          v-for="c in visible"
          :key="c.id"
          class="px-3 py-2.5 border-b border-[rgba(0,0,0,.04)] hover:bg-surface-subtle md:px-4"
          :class="!c.isActive && 'opacity-55'"
        >
          <div class="flex items-center gap-2.5 cursor-pointer" @click="selectedId = c.id">
            <span class="w-8 h-8 rounded-md bg-surface-muted border flex items-center justify-center text-fg-2">
              <span class="material-symbols-rounded text-[18px]">{{ c.icon }}</span>
            </span>
            <span class="flex flex-col gap-0.5 min-w-0">
              <span class="flex items-center gap-1.5">
                <span class="text-body font-bold text-fg-1 truncate">{{ c.name }}</span>
                <AppBadge v-if="c.isSystem" small>系統保留</AppBadge>
                <AppBadge v-if="!c.isActive" small>已停用</AppBadge>
              </span>
              <span class="text-[11px] text-fg-4">
                {{ c.subCategories.filter((s) => s.isActive).length || 0 }} 個子分類
              </span>
            </span>
            <span class="ml-auto flex items-center gap-1">
              <AppBadge :tone="tagOf(c).tone">{{ tagOf(c).label }}</AppBadge>
              <IconButton icon="edit" label="編輯" :size="32" @click.stop="openEditMain(c)" />
              <IconButton
                v-if="!c.isSystem"
                :icon="c.isActive ? 'archive' : 'unarchive'"
                :label="c.isActive ? '停用' : '重新啟用'"
                :size="32"
                @click.stop="archiveMain(c)"
              />
            </span>
          </div>

          <!-- 手機：子分類以 chip 呈現 -->
          <div v-if="c.subCategories.filter((s) => s.isActive).length" class="mt-2.5 flex flex-wrap gap-1.5 xl:hidden">
            <span
              v-for="s in c.subCategories.filter((x) => x.isActive)"
              :key="s.id"
              class="px-2.5 py-1.5 rounded-pill bg-canvas border text-[11.5px] text-fg-2"
            >
              {{ s.name }}
            </span>
          </div>
        </div>
      </AppCard>

      <AppCard pad="none" class="hidden xl:block">
        <div class="flex items-center gap-2.5 px-5 py-3.5 border-b">
          <div class="flex flex-col gap-0.5 min-w-0">
            <div class="text-section font-bold text-fg-1">{{ selected?.name ?? "子分類" }} · 子分類</div>
            <div class="text-[11.5px] text-fg-3">
              {{ selected?.isSystem ? "系統保留分類不設子分類" : "共 " + subs.filter((s) => s.isActive).length + " 項" }}
            </div>
          </div>
          <AppButton v-if="selected && !selected.isSystem" class="ml-auto" size="sm" icon="add" @click="openNewSub">
            新增子分類
          </AppButton>
        </div>

        <div
          v-for="s in subs"
          :key="s.id"
          class="flex items-center gap-2.5 px-4 py-2.5 border-b border-[rgba(0,0,0,.04)]"
          :class="!s.isActive && 'opacity-55'"
        >
          <span class="text-body text-fg-1 truncate">{{ s.name }}</span>
          <AppBadge v-if="!s.isActive" small>已停用</AppBadge>
          <span class="ml-auto flex gap-1">
            <IconButton icon="edit" label="編輯" :size="32" @click="openEditSub(s.id, s.name)" />
            <IconButton
              :icon="s.isActive ? 'archive' : 'unarchive'"
              :label="s.isActive ? '停用' : '重新啟用'"
              :size="32"
              @click="toggleSub(s)"
            />
          </span>
        </div>

        <div v-if="!subs.length" class="p-4">
          <EmptyState message="還沒有子分類" />
        </div>
      </AppCard>
    </div>

    <InlineAlert tone="info">
      分類只能停用、不提供刪除，既有交易永遠保留原分類，歷史統計與年度彙整不會被改動。子分類的歸屬主分類只在新增時決定，不可搬移。
    </InlineAlert>

    <AppDialog
      :open="!!form"
      :title="
        form?.kind === 'main'
          ? form.id
            ? '編輯主分類'
            : '新增主分類'
          : form?.subId
            ? '編輯子分類'
            : '新增子分類'
      "
      @close="form = null"
    >
      <template v-if="form">
        <FormField label="名稱">
          <TextInput v-model="form.name" :placeholder="form.kind === 'main' ? '例如 教育' : '例如 早餐'" />
        </FormField>

        <template v-if="form.kind === 'sub'">
          <FormField label="歸屬主分類" readonly-note="不可搬移到其他主分類">
            <TextInput :model-value="form.parentName" readonly />
          </FormField>
        </template>

        <template v-else>
          <div class="flex flex-col gap-[7px]">
            <span class="text-label text-fg-3">收支類型</span>
            <SegmentedControl
              :options="[
                { value: 'expense', label: '支出' },
                { value: 'income', label: '收入' },
              ]"
              :model-value="form.type"
              @update:model-value="form.type = $event as TxType"
            />
          </div>

          <div v-if="form.type === 'expense'" class="flex flex-col gap-[7px]">
            <span class="text-label text-fg-3">支出性質</span>
            <SegmentedControl
              :options="[
                { value: 'floating', label: '浮動支出' },
                { value: 'fixed', label: '固定支出' },
              ]"
              :model-value="form.nature"
              @update:model-value="form.nature = $event as CategoryNature"
            />
            <span class="text-[10.5px] text-fg-4">浮動支出會出現在首頁預算進度條</span>
          </div>

          <div class="flex flex-col gap-[7px]">
            <span class="text-label text-fg-3">圖示</span>
            <IconPicker v-model="form.icon" />
          </div>
        </template>
      </template>

      <template #footer>
        <AppButton variant="primary" size="lg" full-width @click="submit">
          {{ form && (form.kind === "sub" ? form.subId : form.id) ? "儲存變更" : "新增" }}
        </AppButton>
        <AppButton size="lg" @click="form = null">取消</AppButton>
      </template>
    </AppDialog>

    <template #fab>
      <FloatingActionButton label="新增主分類" @click="openNewMain" />
    </template>
  </AppShell>
</template>
