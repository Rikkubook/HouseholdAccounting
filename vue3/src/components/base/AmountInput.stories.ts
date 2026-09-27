import type { Meta, StoryObj } from "@storybook/vue3";
import AmountInput from "./AmountInput.vue";

/**
 * 大字級 + NT$ 前綴，只收數字並自動加千分位。
 * 手機以系統數字鍵盤輸入（inputmode="numeric"），不自製鍵盤。
 */
const meta = {
  title: "Base/AmountInput",
  component: AmountInput,
  args: { modelValue: "14000" },
} satisfies Meta<typeof AmountInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 已填寫: Story = {};
export const 空值: Story = { args: { modelValue: "" } };
export const 錯誤: Story = { args: { modelValue: "", invalid: true } };
