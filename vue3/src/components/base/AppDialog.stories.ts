import type { Meta, StoryObj } from "@storybook/vue3";
import { ref, watch } from "vue";
import AppDialog from "./AppDialog.vue";
import AppButton from "./AppButton.vue";
import FormField from "./FormField.vue";
import TextInput from "./TextInput.vue";

/**
 * 畫面正中央、最大 460px、圓角 18px。
 * 點面板不關閉，點背景才關閉——所有新增／編輯流程都走這支。
 */
const meta = {
  title: "Base/AppDialog",
  component: AppDialog,
  // 彈窗 Teleport 到 body 且 fixed 滿版；Docs 頁若直接內嵌會蓋住整頁無法操作，
  // 改用 iframe 讓遮罩只蓋在自己的框內。
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 560 } },
  },
  args: { open: true, title: "新增年度額外開銷", subtitle: "不列入任何單月，但計入該分類的年度總計" },
} satisfies Meta<typeof AppDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 表單彈窗: Story = {
  render: (args) => ({
    components: { AppDialog, AppButton, FormField, TextInput },
    setup() {
      // 本地開關狀態：點背景／關閉／取消可關閉，按「開啟彈窗」重開；Controls 的 open 仍會同步過來
      const open = ref(args.open);
      watch(() => args.open, (v) => (open.value = v));
      return { args, open };
    },
    template: `
      <div style="padding:24px">
        <AppButton variant="action" icon="add" @click="open = true">開啟彈窗</AppButton>
      </div>
      <AppDialog v-bind="args" :open="open" @close="open = false">
        <FormField label="項目名稱"><TextInput model-value="日本家庭旅遊" /></FormField>
        <FormField label="金額"><TextInput model-value="86,000" /></FormField>
        <template #footer>
          <AppButton variant="primary" size="lg" full-width>新增</AppButton>
          <AppButton size="lg" @click="open = false">取消</AppButton>
        </template>
      </AppDialog>
    `,
  }),
};
