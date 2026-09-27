import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { membersApi, type MemberDraft } from "@/api/members";
import type { Member } from "@/types/models";

export const useMembersStore = defineStore("members", () => {
  const items = ref<Member[]>([]);
  const loading = ref(false);

  /** 停用成員不出現在記帳者、扣款人與統計篩選。 */
  const active = computed(() => items.value.filter((m) => m.isActive));
  const activeAdmins = computed(() => active.value.filter((m) => m.role === "admin"));
  const archivedCount = computed(() => items.value.filter((m) => !m.isActive).length);

  function nameOf(id: number) {
    return items.value.find((m) => m.id === id)?.name ?? "—";
  }

  async function load() {
    loading.value = true;
    try {
      items.value = await membersApi.list();
    } finally {
      loading.value = false;
    }
  }

  function upsert(m: Member) {
    const i = items.value.findIndex((x) => x.id === m.id);
    if (i >= 0) items.value[i] = m;
    else items.value.push(m);
  }

  return {
    items,
    loading,
    active,
    activeAdmins,
    archivedCount,
    nameOf,
    load,
    upsert,
    create: async (d: MemberDraft) => upsert(await membersApi.create(d)),
    update: async (id: number, p: Partial<Omit<MemberDraft, "initialCode">>) =>
      upsert(await membersApi.update(id, p)),
    setActive: async (id: number, isActive: boolean) => upsert(await membersApi.setActive(id, isActive)),
    requestReset: async (id: number) => {
      const { resetCode } = await membersApi.requestPasswordReset(id);
      const m = items.value.find((x) => x.id === id);
      if (m) m.resetCode = resetCode;
      return resetCode;
    },
    cancelReset: async (id: number) => {
      await membersApi.cancelPasswordReset(id);
      const m = items.value.find((x) => x.id === id);
      if (m) m.resetCode = null;
    },
  };
});
