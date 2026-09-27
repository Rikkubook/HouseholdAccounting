export interface NavItem {
  name: string;
  label: string;
  to: string;
  /** true 表示此項之前要插入 ADMIN 分隔標題 */
  adminDivider?: boolean;
  adminOnly?: boolean;
}

/** 側欄順序：全員五項，之後為 ADMIN 四項。一般成員看不到 ADMIN 區。 */
export const NAV_ITEMS: NavItem[] = [
  { name: "dashboard", label: "首頁儀表板", to: "/" },
  { name: "transaction-create", label: "新增交易", to: "/transactions/new" },
  { name: "transactions", label: "交易列表", to: "/transactions" },
  { name: "stats", label: "統計圖表", to: "/stats" },
  { name: "year-summary", label: "年度彙整", to: "/year" },
  { name: "budget", label: "預算管理", to: "/budget", adminDivider: true, adminOnly: true },
  { name: "subscriptions", label: "訂閱管理", to: "/subscriptions", adminOnly: true },
  { name: "members", label: "成員管理", to: "/members", adminOnly: true },
  { name: "categories", label: "分類設定", to: "/categories", adminOnly: true },
];
