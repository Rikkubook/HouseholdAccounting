import type { Meta, StoryObj } from "@storybook/vue3";
import SubscriptionRow from "./SubscriptionRow.vue";
import type { Subscription } from "@/types/models";

/**
 * 週期只有每月與每年；金額以月換算計入固定支出（年繳 ÷12）。
 * 到期由每日自動扣款產生交易（年繳為當月分攤），記帳者取扣款人；畫面上沒有手動扣款。
 * 停用不刪除。
 */
const monthly: Subscription = {
  id: 1,
  name: "影音串流",
  amount: 390,
  cycle: "monthly",
  nextChargeDate: "2026-09-10",
  chargeDay: 10,
  chargeMonth: null,
  periodAmount: null,
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
    sub: {
      ...monthly,
      id: 4,
      name: "健身房會員",
      amount: 12000,
      cycle: "yearly",
      nextChargeDate: "2027-03-01",
      chargeDay: 1,
      chargeMonth: 3,
    },
    categoryName: "健康",
    payerName: "太太",
    dueLabel: "",
  },
};

export const 已逾期: Story = { args: { sub: { ...monthly, nextChargeDate: "2026-08-28" }, dueLabel: "已逾期" } };

export const 已停用: Story = { args: { sub: { ...monthly, isActive: false }, dueLabel: "" } };

export const 手機版: Story = { parameters: { viewport: { defaultViewport: "mobile" } } };

/** 年繳分攤中：日期欄顯示下次年繳日，旁邊標已分攤期數。 */
export const 年繳分攤中: Story = {
  args: {
    sub: {
      ...monthly,
      id: 5,
      name: "網路年繳",
      amount: 6000,
      cycle: "yearly",
      nextChargeDate: "2026-12-05",
      chargeDay: 5,
      chargeMonth: 10,
      periodAmount: 6000,
    },
    categoryName: "訂閱",
    payerName: "先生",
    dueLabel: "",
  },
};
