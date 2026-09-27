export interface NavItem {
  name: string;
  to: string;
  /** 僅管理者可見 */
  admin?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { name: "首頁儀表板", to: "/" },
  { name: "新增交易", to: "/transactions/new" },
  { name: "交易列表", to: "/transactions" },
  { name: "統計", to: "/stats" },
  { name: "預算管理", to: "/budgets" },
  { name: "訂閱管理", to: "/subscriptions" },
  { name: "年度彙整", to: "/year" },
  { name: "成員管理", to: "/members", admin: true },
  { name: "分類設定", to: "/categories", admin: true },
];
