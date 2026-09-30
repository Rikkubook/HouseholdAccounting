import type { Meta, StoryObj } from "@storybook/vue3";
import AppLoading from "./AppLoading.vue";

/**
 * 通用載入頁。error 為 null 時是載入中（旋轉圓環），
 * 有值時切成失敗畫面，圓環停在當下角度並改成錯誤色。
 */
const meta = {
  title: "Base/AppLoading",
  component: AppLoading,
  args: { message: "載入中", slowAfter: 8000, error: null, fullscreen: true },
  argTypes: { error: { control: "select", options: [null, "offline", "server", "notfound"] } },
} satisfies Meta<typeof AppLoading>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 用右側 Controls 切換 error，可看到圓環停住的效果。 */
export const 互動調整: Story = {};

export const 自訂文字: Story = { args: { message: "讀取年度總結" } };

export const 網路較慢: Story = { args: { slowAfter: 0 } };

export const 失敗_離線: Story = { args: { error: "offline" } };

export const 失敗_伺服器: Story = { args: { error: "server" } };

export const 失敗_找不到: Story = { args: { error: "notfound" } };

export const 內容區: Story = { args: { fullscreen: false } };
