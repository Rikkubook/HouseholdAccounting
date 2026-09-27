import type { Meta, StoryObj } from "@storybook/vue3";
import CodeInput from "./CodeInput.vue";

/**
 * 6 位數字代碼：只收數字、自動截斷、等寬字距 .34em。
 * 用於新增成員的初始代碼與重設密碼頁的重設碼；代碼不設有效期限。
 */
const meta = {
  title: "Base/CodeInput",
  component: CodeInput,
  args: { modelValue: "980901" },
} satisfies Meta<typeof CodeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 已填寫: Story = {};
export const 空值: Story = { args: { modelValue: "", placeholder: "6 位數字" } };
export const 錯誤: Story = { args: { modelValue: "1234", invalid: true } };
