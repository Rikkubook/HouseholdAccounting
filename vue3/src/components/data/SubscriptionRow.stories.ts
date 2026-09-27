import type { Meta, StoryObj } from "@storybook/vue3";
import SubscriptionRow from "./SubscriptionRow.vue";
import type { Subscription } from "@/types/models";

/**
 * 週期只有每月與每年；金額以月換算計入固定支出（年繳 ÷12）。
 * 「標記已扣款」會依本期扣款日產生一筆交易，記帳者取扣款人。
 * 停用不刪除。
 */
const monthly: Subscription = {
  id: 1,
  name: "影音串流",
  amount: 390,
  cycle: "monthly",
  nextChargeDate: "2026-09-10",
  mainCategoryId: 9,
  payerId: 1,
  isActive: true,
};

const meta = {
  title: "Data/SubscriptionRow",
  component: SubscriptionRow,
  parameters: { layout: "fullscreen", backgrounds: { default: "surface" } },
  args: { sub: monthly, categoryName: "訂閱", payerName: "先生", dueLabel: "6 天後" },
} satisfies Meta<typeof SubscriptionRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 每月: Story = {};

export const 每年: Story = {
  args: {
    sub: { ...monthly, id: 4, name: "健身房會員", amount: 12000, cycle: "yearly", nextChargeDate: "2027-03-01" },
    categoryName: "健康",
    payerName: "太太",
    dueLabel: "",
  },
};

export const 已逾期: Story = { args: { sub: { ...monthly, nextChargeDate: "2026-08-28" }, dueLabel: "已逾期" } };

export const 已停用: Story = { args: { sub: { ...monthly, isActive: false }, dueLabel: "" } };

export const 手機版: Story = { parameters: { viewport: { defaultViewport: "mobile" } } };
