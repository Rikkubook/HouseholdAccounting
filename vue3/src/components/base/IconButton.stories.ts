import type { Meta, StoryObj } from "@storybook/vue3";
import IconButton from "./IconButton.vue";

/**
 * label 必填（無障礙）。他人紀錄上的操作圖示一律「直接隱藏」而非灰階，
 * 因此這裡沒有 disabled 變體。
 */
const meta = {
  title: "Base/IconButton",
  component: IconButton,
  argTypes: { variant: { control: "inline-radio", options: ["ghost", "subtle", "danger"] } },
  args: { icon: "edit", label: "編輯", variant: "ghost", size: 36 },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 用右側 Controls 即時調整 props。 */
export const 互動調整: Story = {};

export const 三種變體: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    components: { IconButton },
    template: `
      <div style="display:flex;gap:14px;align-items:center">
        <IconButton icon="edit" label="編輯" variant="ghost" />
        <IconButton icon="key" label="要求重新設定密碼" variant="subtle" />
        <IconButton icon="delete" label="刪除" variant="danger" />
      </div>
    `,
  }),
};

export const 手機尺寸: Story = { args: { size: 44, label: "編輯（44px 觸控）" } };
