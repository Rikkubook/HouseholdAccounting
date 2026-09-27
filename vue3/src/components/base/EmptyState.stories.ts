import type { Meta, StoryObj } from "@storybook/vue3";
import EmptyState from "./EmptyState.vue";

/** 虛線框空狀態，附一個可清除篩選的文字動作。 */
const meta = {
  title: "Base/EmptyState",
  component: EmptyState,
  args: { message: "沒有符合條件的紀錄", actionLabel: "清除篩選條件" },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 有動作: Story = {};
export const 純訊息: Story = { args: { actionLabel: undefined, message: "還沒有子分類" } };
