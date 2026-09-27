import type { Meta, StoryObj } from "@storybook/vue3";
import MemberRow from "./MemberRow.vue";
import type { Member } from "@/types/models";

/**
 * 管理者不設定、也看不到密碼；只能按鑰匙鍵產生 6 位重設碼（不設期限）。
 * 停用為軟刪除，歷史紀錄仍顯示該成員名稱。
 */
const admin: Member = {
  id: 1,
  name: "先生",
  account: "dad",
  role: "admin",
  isActive: true,
  color: "#6b5cf5",
  joinedMonth: "2025-01",
  resetCode: null,
};

const meta = {
  title: "Data/MemberRow",
  component: MemberRow,
  parameters: { layout: "fullscreen", backgrounds: { default: "surface" } },
  args: { member: admin, isSelf: true },
} satisfies Meta<typeof MemberRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 管理者_目前登入: Story = {};

export const 一般成員: Story = {
  args: {
    member: { ...admin, id: 3, name: "小妹", account: "sis", role: "member", color: "#f5b23c", joinedMonth: "2026-03" },
    isSelf: false,
  },
};

export const 待自行重設密碼: Story = {
  args: {
    member: { ...admin, id: 2, name: "太太", account: "mom", color: "#2bb3d9", resetCode: "980901" },
    isSelf: false,
  },
};

export const 已停用: Story = {
  args: {
    member: { ...admin, id: 4, name: "阿嬤", account: "grandma", role: "member", isActive: false, color: "#8b857c" },
    isSelf: false,
  },
};

export const 手機版: Story = { parameters: { viewport: { defaultViewport: "mobile" } } };
