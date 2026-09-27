import type { Meta, StoryObj } from "@storybook/vue3";
import MetricStat from "./MetricStat.vue";

/** 金額一律整數、千分位、等寬數字，且永不因狀態變色。 */
const meta = {
  title: "Base/MetricStat",
  component: MetricStat,
  argTypes: { size: { control: "inline-radio", options: ["hero", "lg", "md", "sm"] } },
  args: { label: "總支出", value: 112340, size: "lg" },
} satisfies Meta<typeof MetricStat>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 用右側 Controls 即時調整 props。 */
export const 互動調整: Story = {};

export const 四種尺寸: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    components: { MetricStat },
    template: `
      <div style="display:flex;flex-direction:column;gap:20px">
        <MetricStat label="淨結餘（手機）" :value="56160" size="hero" />
        <MetricStat label="總支出（桌機 KPI）" :value="112340" size="lg" />
        <MetricStat label="固定支出" :value="1890" size="md" />
        <MetricStat label="已記錄月份" :value="9" size="sm" hint="每月平均 47,550" />
      </div>
    `,
  }),
};

export const 未有資料: Story = { args: { value: null, hint: "顯示破折號而非 0" } };
