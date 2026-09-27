import type { Meta, StoryObj } from "@storybook/vue3";
import MonthStepper from "./MonthStepper.vue";

/** 月份切換器；max 用來擋掉未來月份。 */
const meta = {
  title: "Base/MonthStepper",
  component: MonthStepper,
  args: { modelValue: "2026-09", max: "2026-09" },
} satisfies Meta<typeof MonthStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 本月為上限: Story = {};
export const 可往後: Story = { args: { max: undefined } };
