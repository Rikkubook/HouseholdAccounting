import type { Meta, StoryObj } from "@storybook/vue3";
import TokenSheet from "./TokenSheet.vue";

/**
 * tokens.css 是唯一數值來源；Tailwind 只做映射，元件不自行定義新色或新尺寸。
 */
const meta = {
  title: "Design Tokens/總覽",
  component: TokenSheet,
  parameters: { layout: "fullscreen", backgrounds: { default: "canvas" } },
} satisfies Meta<typeof TokenSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 色彩與尺度: Story = {};
