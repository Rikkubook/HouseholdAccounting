import type { Meta, StoryObj } from "@storybook/vue3";
import ProgressBar from "./ProgressBar.vue";

/**
 * 進度條顏色是唯一的預算狀態提醒：<70% 安全、≥70% 警示、≥100% 超支。
 * budget=null 代表該月未設預算：進度條留空、不顯示百分比。
 */
const meta = {
  title: "Base/ProgressBar",
  component: ProgressBar,
  args: { spent: 6200, budget: 14000, threshold: 70, height: 8, showMeta: true },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 用右側 Controls 即時調整 props。 */
export const 互動調整: Story = {};

export const 四種狀態: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    components: { ProgressBar },
    template: `
      <div style="display:flex;flex-direction:column;gap:22px;width:320px">
        <div><div style="font-size:13px;color:#5c5852;margin-bottom:7px">ok · 44%</div><ProgressBar :spent="6200" :budget="14000" /></div>
        <div><div style="font-size:13px;color:#5c5852;margin-bottom:7px">near · 80%</div><ProgressBar :spent="11240" :budget="14000" /></div>
        <div><div style="font-size:13px;color:#5c5852;margin-bottom:7px">over · 114%</div><ProgressBar :spent="15960" :budget="14000" /></div>
        <div><div style="font-size:13px;color:#5c5852;margin-bottom:7px">none · 未設預算</div><ProgressBar :spent="2400" :budget="null" /></div>
      </div>
    `,
  }),
};

export const 佔比細條: Story = { args: { spent: 62, budget: 100, height: 4, showMeta: false } };
