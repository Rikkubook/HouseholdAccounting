import type { Meta, StoryObj } from "@storybook/vue3";
import SegmentedControl from "./SegmentedControl.vue";

/** 選中一律黑底白字。期間切換、收支切換、篩選都用這支。 */
const meta = {
  title: "Base/SegmentedControl",
  component: SegmentedControl,
  args: {
    modelValue: "2026-09",
    options: [
      { value: "2026-09", label: "本月" },
      { value: "2026-08", label: "上月" },
    ],
  },
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 期間切換: Story = {};

export const 收支切換: Story = {
  args: {
    modelValue: "expense",
    options: [
      { value: "expense", label: "支出" },
      { value: "income", label: "收入" },
    ],
  },
};

export const 四段篩選: Story = {
  args: {
    modelValue: "all",
    options: [
      { value: "all", label: "全部" },
      { value: "floating", label: "浮動支出" },
      { value: "fixed", label: "固定支出" },
      { value: "income", label: "收入" },
    ],
  },
};
