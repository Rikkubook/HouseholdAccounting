import type { Meta, StoryObj } from "@storybook/vue3";
import CategoryBudgetCard from "./CategoryBudgetCard.vue";
import type { CategoryProgress, TransactionView } from "@/types/models";

/**
 * 首頁的分類卡。budget=null 時在「分類名稱旁」顯示設定預算連結，
 * 進度條留空、不顯示百分比與剩餘。
 */
const tx = (id: number, sub: string, payer: string, amount: number, date: string): TransactionView => ({
  id,
  type: "expense",
  mainCategoryId: 1,
  subCategoryId: id,
  amount,
  date,
  payerId: 1,
  note: null,
  createdAt: date + "T09:00:00Z",
  isDeleted: false,
  sourceSubscriptionId: null,
  createdBy: 1,
  mainCategoryName: "食",
  subCategoryName: sub,
  payerName: payer,
  createdByName: payer,
});

const ok: CategoryProgress = {
  id: 1,
  name: "食",
  icon: "restaurant",
  budget: 14000,
  spent: 6180,
  recent: [tx(1, "食材", "太太", 1480, "2026-09-03"), tx(2, "早餐", "先生", 320, "2026-09-02")],
};

const meta = {
  title: "Data/CategoryBudgetCard",
  component: CategoryBudgetCard,
  parameters: { layout: "padded" },
  args: { category: ok },
} satisfies Meta<typeof CategoryBudgetCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 安全: Story = {};
export const 警示: Story = { args: { category: { ...ok, spent: 11240 } } };
export const 超支: Story = { args: { category: { ...ok, spent: 15960 } } };
export const 未設預算: Story = {
  args: {
    category: { ...ok, id: 7, name: "教育", icon: "school", budget: null, spent: 2400, recent: [] },
  },
};
export const 手機版: Story = { parameters: { viewport: { defaultViewport: "mobile" } } };
