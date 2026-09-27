import type { Meta, StoryObj } from "@storybook/vue3";
import IconPicker from "./IconPicker.vue";

/** 策展 14 個 Material Symbols，不開放全套。只在主分類彈窗出現。 */
const meta = {
  title: "Base/IconPicker",
  component: IconPicker,
  args: { modelValue: "restaurant" },
} satisfies Meta<typeof IconPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 策展清單: Story = {};
