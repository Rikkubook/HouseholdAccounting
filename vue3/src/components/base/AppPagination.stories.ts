import type { Meta, StoryObj } from "@storybook/vue3";
import AppPagination from "./AppPagination.vue";

/** 最多顯示 3 個頁碼、置中；桌機與手機相同。每頁固定 20 筆，使用者不可調整。 */
const meta = {
  title: "Base/AppPagination",
  component: AppPagination,
  args: { page: 1, total: 138, pageSize: 20 },
} satisfies Meta<typeof AppPagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 第一頁: Story = {};
export const 中間頁: Story = { args: { page: 4 } };
export const 只有一頁: Story = { args: { total: 12 } };
