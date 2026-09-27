import type { Meta, StoryObj } from "@storybook/vue3";
import InlineAlert from "./InlineAlert.vue";

/** 頁內提示：成功為藍色系、警告為黃色系、阻擋為粉色系、說明為中性。 */
const meta = {
  title: "Base/InlineAlert",
  component: InlineAlert,
  argTypes: { tone: { control: "inline-radio", options: ["success", "warning", "danger", "info"] } },
  args: { tone: "info", default: "說明文字" },
  render: (args) => ({
    components: { InlineAlert },
    setup: () => ({ args }),
    template: '<InlineAlert v-bind="args">{{ args.default }}</InlineAlert>',
  }),
} satisfies Meta<typeof InlineAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 用右側 Controls 即時調整 props。 */
export const 互動調整: Story = {};

export const 四種語氣: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    components: { InlineAlert },
    template: `
      <div style="display:flex;flex-direction:column;gap:12px;max-width:520px">
        <InlineAlert tone="success">已新增成員「小妹」，請轉達初始代碼 481203</InlineAlert>
        <InlineAlert tone="warning">還有 3 個浮動支出分類未設定本月上限，首頁會顯示設定提示。</InlineAlert>
        <InlineAlert tone="danger">「先生」名下還有 3 筆進行中的訂閱，請先在訂閱管理改指定其他扣款人</InlineAlert>
        <InlineAlert tone="info">管理者不設定、也看不到成員密碼；重設碼不設有效期限。</InlineAlert>
      </div>
    `,
  }),
};
