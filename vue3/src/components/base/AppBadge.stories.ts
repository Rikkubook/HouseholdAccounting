import type { Meta, StoryObj } from "@storybook/vue3";
import AppBadge from "./AppBadge.vue";

/** 分類屬性、角色、生命週期標記與一次性代碼都用 Badge。 */
const meta = {
  title: "Base/AppBadge",
  component: AppBadge,
  argTypes: { tone: { control: "inline-radio", options: ["neutral", "brand", "outline", "success"] } },
  args: { tone: "brand", default: "浮動支出" },
  render: (args) => ({
    components: { AppBadge },
    setup: () => ({ args }),
    template: '<AppBadge v-bind="args">{{ args.default }}</AppBadge>',
  }),
} satisfies Meta<typeof AppBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 用右側 Controls 即時調整 props。 */
export const 互動調整: Story = {};

export const 全部用法: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    components: { AppBadge },
    template: `
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
        <AppBadge tone="brand">浮動支出</AppBadge>
        <AppBadge tone="neutral">固定支出</AppBadge>
        <AppBadge tone="success">收入</AppBadge>
        <AppBadge tone="outline">目前登入中</AppBadge>
        <AppBadge small>系統保留</AppBadge>
        <AppBadge small>8月新增</AppBadge>
        <AppBadge small>7月起停用</AppBadge>
        <AppBadge tone="brand" mono>980901</AppBadge>
      </div>
    `,
  }),
};
