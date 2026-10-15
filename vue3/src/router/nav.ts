export interface NavItem {
  name: string;
  label: string;
  to: string;
  /** true 表示此項之前要插入 ADMIN 分隔標題 */
  adminDivider?: boolean;
  adminOnly?: boolean;
  /** true 表示個人帳模式下不顯示（成員是家庭的事） */
  familyOnly?: boolean;
  /** true 表示個人帳模式下一般成員也看得到（個人分類每人管自己的） */
  personalOpen?: boolean;
}

/** 側欄順序：全員五項，之後為 ADMIN 四項。一般成員看不到 ADMIN 區。 */
export const NAV_ITEMS: NavItem[] = [
  { name: "dashboard", label: "首頁儀表板", to: "/" },
  { name: "transaction-create", label: "新增交易", to: "/transactions/new" },
  { name: "transactions", label: "交易列表", to: "/transactions" },
  { name: "stats", label: "統計圖表", to: "/stats" },
  { name: "year-summary", label: "年度彙整", to: "/year" },
  { name: "budget", label: "預算管理", to: "/budget", adminDivider: true, adminOnly: true, personalOpen: true },
  { name: "subscriptions", label: "訂閱管理", to: "/subscriptions", adminOnly: true, personalOpen: true },
  { name: "members", label: "成員管理", to: "/members", adminOnly: true, familyOnly: true },
  { name: "categories", label: "分類設定", to: "/categories", adminOnly: true, personalOpen: true },
];

/**
 * 依角色與目前帳本過濾：一般成員看不到 ADMIN 區（個人帳的 personalOpen 項目除外）；
 * 個人帳隱藏 familyOnly 的項目。
 */
export const navItemsFor = (isAdmin: boolean, personal: boolean) =>
  NAV_ITEMS.filter(
    (i) => !(i.adminOnly && !isAdmin && !(personal && i.personalOpen)) && !(personal && i.familyOnly)
  );
