import type { Meta, StoryObj } from "@storybook/vue3";
import AppButton from "./AppButton.vue";

/**
 * primary＝表單送出（深墨色）｜action＝主要新增（藍漸層）｜secondary＝白底細框｜ghost｜link。
 * 手機觸控高度不低於 44px，故手機一律用 size="lg" 或 full-width。
 */
const meta = {
  title: "Base/AppButton",
  component: AppButton,
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "action", "secondary", "ghost", "link"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
  args: { variant: "primary", size: "md", default: "儲存" },
  render: (args) => ({
    components: { AppButton },
    setup: () => ({ args }),
    template: '<AppButton v-bind="args">{{ args.default }}</AppButton>',
  }),
} satisfies Meta<typeof AppButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 用右側 Controls 即時調整 props。 */
export const 互動調整: Story = {};

export const 全部變體: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    components: { AppButton },
    template: `
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <AppButton variant="primary" size="lg">表單送出</AppButton>
        <AppButton variant="action" icon="add">主要新增</AppButton>
        <AppButton variant="secondary" icon="content_copy">沿用上月</AppButton>
        <AppButton variant="ghost">ghost</AppButton>
        <AppButton variant="link">查看完整歷史 →</AppButton>
        <AppButton variant="primary" disabled>停用中</AppButton>
      </div>
    `,
  }),
};

export const 尺寸: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    components: { AppButton },
    template: `
      <div style="display:flex;gap:10px;align-items:center">
        <AppButton variant="primary" size="sm">sm</AppButton>
        <AppButton variant="primary" size="md">md</AppButton>
        <AppButton variant="primary" size="lg">lg 44px 以上</AppButton>
      </div>
    `,
  }),
};

export const 滿寬: Story = { args: { variant: "primary", size: "lg", fullWidth: true, default: "儲存" } };
