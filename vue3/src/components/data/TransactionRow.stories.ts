import type { Meta, StoryObj } from "@storybook/vue3";
import TransactionRow from "./TransactionRow.vue";
import type { TransactionView } from "@/types/models";

/**
 * canEdit=false 時操作圖示「直接隱藏」而非灰階——一般成員看不到他人紀錄的編輯與刪除。
 * 刪除為軟刪除，前台不提供復原。
 */
const base: TransactionView = {
  id: 1,
  type: "expense",
  mainCategoryId: 1,
  subCategoryId: 104,
  amount: 1480,
  date: "2026-09-03",
  payerId: 2,
  note: "週末採買",
  createdAt: "2026-09-03T09:10:00Z",
  isDeleted: false,
  sourceSubscriptionId: null, ownerId: null,
  mainCategoryName: "食",
  subCategoryName: "食材",
  payerName: "太太",
};

const meta = {
  title: "Data/TransactionRow",
  component: TransactionRow,
  parameters: { layout: "fullscreen", backgrounds: { default: "surface" } },
  args: { tx: base, canEdit: true, showPayer: true },
} satisfies Meta<typeof TransactionRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 可編輯: Story = {};

export const 他人紀錄_圖示隱藏: Story = { args: { canEdit: false } };

export const 訂閱自動產生: Story = {
  args: {
    tx: {
      ...base,
      id: 2,
      amount: 390,
      subCategoryName: null,
      mainCategoryName: "訂閱",
      note: "影音串流",
      payerName: "先生",
      sourceSubscriptionId: 1,
    },
  },
};

export const 收入: Story = {
  args: {
    tx: {
      ...base,
      id: 3,
      type: "income",
      amount: 92000,
      mainCategoryName: "薪資",
      subCategoryName: "本薪",
      note: null,
      payerName: "先生",
    },
  },
};

export const 手機版: Story = { parameters: { viewport: { defaultViewport: "mobile" } } };
