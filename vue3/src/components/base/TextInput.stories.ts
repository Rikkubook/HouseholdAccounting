import type { Meta, StoryObj } from "@storybook/vue3";
import TextInput from "./TextInput.vue";

/** 高 46px、圓角 11px、1px 邊框。readonly 用於自動推算或不可搬移的欄位。 */
const meta = {
  title: "Base/TextInput",
  component: TextInput,
  args: { modelValue: "週末採買" },
} satisfies Meta<typeof TextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 一般: Story = {};
export const 未填寫: Story = { args: { modelValue: "", placeholder: "例如 日本家庭旅遊" } };
export const 錯誤: Story = { args: { modelValue: "", placeholder: "必填", invalid: true } };
export const 唯讀: Story = { args: { modelValue: "食", readonly: true } };
