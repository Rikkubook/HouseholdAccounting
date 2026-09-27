import type { Meta, StoryObj } from "@storybook/vue3";
import FormField from "./FormField.vue";
import TextInput from "./TextInput.vue";

/** 欄位標籤 11.5px / letter-spacing .06em；錯誤訊息取代 hint。 */
const meta = {
  title: "Base/FormField",
  component: FormField,
  args: { label: "名稱" },
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 用右側 Controls 即時調整 props。 */
export const 互動調整: Story = {
  args: { hint: "", error: "", readonlyNote: "" },
  render: (args) => ({
    components: { FormField, TextInput },
    setup: () => ({ args }),
    template: '<div style="width:320px"><FormField v-bind="args"><TextInput model-value="週末採買" :invalid="!!args.error" /></FormField></div>',
  }),
};

export const 三種狀態: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    components: { FormField, TextInput },
    template: `
      <div style="display:flex;flex-direction:column;gap:16px;width:320px">
        <FormField label="名稱"><TextInput model-value="週末採買" /></FormField>
        <FormField label="日期" hint="這是未來日期，將作為預定支出紀錄">
          <TextInput model-value="2026-12-24" />
        </FormField>
        <FormField label="金額" error="請填寫金額，且須大於 0">
          <TextInput model-value="" placeholder="必填" invalid />
        </FormField>
        <FormField label="歸屬主分類" readonly-note="不可搬移到其他主分類">
          <TextInput model-value="食" readonly />
        </FormField>
      </div>
    `,
  }),
};
