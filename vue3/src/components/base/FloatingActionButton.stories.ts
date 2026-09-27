import type { Meta, StoryObj } from "@storybook/vue3";
import FloatingActionButton from "./FloatingActionButton.vue";

/**
 * 手機專用（md 以上隱藏）。藍漸層膠囊、必帶文字說明，
 * 是全系統唯一帶陰影的元件，每畫面只放一顆，固定右下 18px／底部 22px。
 */
const meta = {
  title: "Base/FloatingActionButton",
  component: FloatingActionButton,
  args: { label: "記一筆" },
  parameters: { viewport: { defaultViewport: "mobile" }, layout: "fullscreen" },
  render: (args, { viewMode }) => {
    // Docs 頁寬度 > 768px，md:hidden 會把按鈕藏起來，fixed 也會跑到整頁右下角。
    // 只在 Docs 模式放進手機寬的框：transform 讓 fixed 以框為定位基準，並強制顯示。
    const inDocs = viewMode === "docs";
    return {
      components: { FloatingActionButton },
      setup: () => ({ args, inDocs }),
      template: `
        <div v-if="inDocs" style="position:relative;width:390px;height:160px;margin:0 auto;transform:translateZ(0);
                                  background:#f6f4f0;border:1px solid #e4e0d8;border-radius:12px;overflow:hidden">
          <FloatingActionButton v-bind="args" style="display:inline-flex" />
        </div>
        <FloatingActionButton v-else v-bind="args" />
      `,
    };
  },
} satisfies Meta<typeof FloatingActionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 記一筆: Story = {};
export const 新增訂閱: Story = { args: { label: "新增訂閱" } };
export const 新增額外開銷: Story = { args: { label: "新增額外開銷" } };
