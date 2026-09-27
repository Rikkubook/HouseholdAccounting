import type { Meta, StoryObj } from "@storybook/vue3";
import AppCard from "./AppCard.vue";
import MetricStat from "./MetricStat.vue";

/** 白底 + 1px 邊框，永不加陰影。tone=brand 為紫漸層強調卡。 */
const meta = {
  title: "Base/AppCard",
  component: AppCard,
  argTypes: {
    tone: { control: "inline-radio", options: ["surface", "brand", "action"] },
    pad: { control: "inline-radio", options: ["default", "compact", "none"] },
  },
  args: { tone: "surface", pad: "default" },
} satisfies Meta<typeof AppCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 用右側 Controls 即時調整 props。 */
export const 互動調整: Story = {
  args: { default: "卡片內容" },
  render: (args) => ({
    components: { AppCard },
    setup: () => ({ args }),
    template: '<AppCard v-bind="args" style="width:240px">{{ args.default }}</AppCard>',
  }),
};

export const 三種色調: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    components: { AppCard, MetricStat },
    template: `
      <div style="display:grid;grid-template-columns:repeat(3,240px);gap:16px;align-items:start">
        <AppCard>
          <MetricStat label="總支出" :value="112340" size="md" hint="tone=surface" />
        </AppCard>
        <AppCard tone="brand" pad="compact">
          <div style="display:flex;flex-direction:column;gap:16px;min-height:118px;justify-content:space-between">
            <div style="font-size:11.5px;opacity:.85">本月固定支出總額</div>
            <MetricStat label="" :value="1890" size="md" on-brand hint="tone=brand" />
          </div>
        </AppCard>
        <AppCard tone="action" pad="compact" interactive>
          <div style="display:flex;flex-direction:column;gap:16px;min-height:118px;justify-content:space-between">
            <div style="width:38px;height:38px;border-radius:11px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-size:22px">+</div>
            <div><div style="font-size:15px;font-weight:700">快速記帳</div><div style="font-size:10.5px;opacity:.6;margin-top:2px">tone=action</div></div>
          </div>
        </AppCard>
      </div>
    `,
  }),
};
