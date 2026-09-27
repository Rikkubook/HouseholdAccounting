import type { Meta, StoryObj } from "@storybook/vue3";
import ToggleSwitch from "./ToggleSwitch.vue";

/** 啟用為紫漸層、停用為灰。訂閱與成員的啟用狀態共用同一支。 */
const meta = {
  title: "Base/ToggleSwitch",
  component: ToggleSwitch,
  args: { modelValue: true, label: "啟用中" },
} satisfies Meta<typeof ToggleSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 用右側 Controls 即時調整 props。 */
export const 互動調整: Story = {};

export const 兩種狀態: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    components: { ToggleSwitch },
    template: `
      <div style="display:flex;gap:24px;align-items:center">
        <ToggleSwitch :model-value="true" label="啟用中" />
        <ToggleSwitch :model-value="false" label="已停用" />
        <ToggleSwitch :model-value="true" label="不可變更" disabled />
      </div>
    `,
  }),
};
