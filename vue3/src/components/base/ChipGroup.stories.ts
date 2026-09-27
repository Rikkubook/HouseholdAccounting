import type { Meta, StoryObj } from "@storybook/vue3";
import ChipGroup from "./ChipGroup.vue";

/** 成員篩選只有實際成員，沒有「共同」；停用成員也不出現。 */
const meta = {
  title: "Base/ChipGroup",
  component: ChipGroup,
  args: {
    modelValue: null,
    options: [
      { value: null, label: "全部成員" },
      { value: 1, label: "先生" },
      { value: 2, label: "太太" },
    ],
  },
} satisfies Meta<typeof ChipGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 成員篩選: Story = {};
export const 已選特定成員: Story = { args: { modelValue: 1 } };
