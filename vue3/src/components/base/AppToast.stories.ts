import type { Meta, StoryObj } from "@storybook/vue3";
import AppToast from "./AppToast.vue";
import { useUiStore } from "@/stores/ui";

/**
 * 深色浮動提示，畫面底部置中，約 3 秒自動消失。
 * 由 ui store 統一觸發：ui.flash(訊息, "success" | "danger")。
 */
const meta = {
  title: "Base/AppToast",
  component: AppToast,
  // Toast 用 Teleport 固定貼在畫面最底部；desktop 900px 的預設 viewport 常比
  // Storybook 畫布面板還高，會被 Controls 面板擠出可視範圍外。用 reset 讓畫布
  // 貼合實際可視高度，fixed-bottom 元件才會一直留在看得到的地方。
  // Docs 頁預設把所有 story 直接畫在同一頁，fixed 會對整頁定位，Toast 全擠到頁尾疊在一起；
  // inline: false 讓每個 story 各自用 iframe 渲染，Toast 就貼在自己框的底部。
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "reset" },
    docs: { story: { inline: false, iframeHeight: 160 } },
  },
} satisfies Meta<typeof AppToast>;

export default meta;
type Story = StoryObj<typeof meta>;

function withToast(message: string, tone: "success" | "danger") {
  return () => ({
    components: { AppToast },
    setup() {
      // 用 Storybook preview.ts 裝好的全域 pinia，故事檔不再另建一份，
      // 否則 AppToast 實際掛載時讀到的是不同 instance，畫面永遠是空的。
      const ui = useUiStore();
      ui.toast = { message, tone };
    },
    template: "<AppToast />",
  });
}

export const 成功: Story = {
  render: withToast("已於 09/10 產生交易 390（訂閱 · 先生），下次扣款 10/10", "success"),
};

export const 阻擋: Story = {
  render: withToast("至少需保留一位管理者", "danger"),
};
