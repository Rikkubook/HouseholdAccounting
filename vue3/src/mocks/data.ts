import type {
  Budget,
  MainCategory,
  Member,
  Subscription,
  Transaction,
  TransactionRevision,
  YearExtraExpense,
} from "@/types/models";

export const members: Member[] = [
  { id: 1, name: "先生", account: "dad", role: "admin", isActive: true, color: "#6b5cf5", joinedMonth: "2025-01", resetCode: null },
  { id: 2, name: "太太", account: "mom", role: "admin", isActive: true, color: "#2bb3d9", joinedMonth: "2025-01", resetCode: "980901" },
  { id: 3, name: "小妹", account: "sis", role: "member", isActive: true, color: "#f5b23c", joinedMonth: "2026-03", resetCode: null },
  { id: 4, name: "阿嬤", account: "grandma", role: "member", isActive: false, color: "#8b857c", joinedMonth: "2025-06", resetCode: null },
  // 對應 api/src/db/force-import-2026.ts 的「系統」成員：停用、不能登入
  { id: 5, name: "系統", account: "system", role: "member", isActive: false, color: "#8b857c", joinedMonth: "2026-01", resetCode: null },
];

const SYSTEM_ID = 5;

let sid = 100;
const sub = (mainCategoryId: number, name: string, sortOrder: number) => ({
  id: ++sid,
  mainCategoryId,
  name,
  sortOrder,
  isActive: true,
});

export const categories: MainCategory[] = [
  {
    id: 1, name: "食", icon: "restaurant", type: "expense", nature: "floating", sortOrder: 1,
    isActive: true, isSystem: false, activeFrom: null, archivedFrom: null,
    subCategories: [sub(1, "早餐", 1), sub(1, "午餐", 2), sub(1, "晚餐", 3), sub(1, "食材", 4), sub(1, "飲料", 5)],
  },
  {
    id: 2, name: "衣", icon: "apparel", type: "expense", nature: "floating", sortOrder: 2,
    isActive: true, isSystem: false, activeFrom: null, archivedFrom: null,
    subCategories: [sub(2, "衣物", 1), sub(2, "鞋類", 2), sub(2, "配件", 3)],
  },
  {
    id: 3, name: "住", icon: "home", type: "expense", nature: "floating", sortOrder: 3,
    isActive: true, isSystem: false, activeFrom: null, archivedFrom: null,
    subCategories: [sub(3, "房租", 1), sub(3, "水電", 2), sub(3, "瓦斯", 3), sub(3, "日用品", 4)],
  },
  {
    id: 4, name: "行", icon: "directions_car", type: "expense", nature: "floating", sortOrder: 4,
    isActive: true, isSystem: false, activeFrom: null, archivedFrom: null,
    subCategories: [sub(4, "加油", 1), sub(4, "大眾運輸", 2), sub(4, "停車", 3)],
  },
  {
    id: 5, name: "健康", icon: "favorite", type: "expense", nature: "floating", sortOrder: 5,
    isActive: false, isSystem: false, activeFrom: null, archivedFrom: "2026-07",
    subCategories: [sub(5, "看診", 1), sub(5, "藥品", 2), sub(5, "保健食品", 3)],
  },
  {
    id: 6, name: "育樂", icon: "sports_esports", type: "expense", nature: "floating", sortOrder: 6,
    isActive: true, isSystem: false, activeFrom: null, archivedFrom: null,
    subCategories: [sub(6, "電影", 1), sub(6, "旅遊", 2), sub(6, "聚餐", 3), sub(6, "書籍", 4)],
  },
  {
    id: 7, name: "教育", icon: "school", type: "expense", nature: "floating", sortOrder: 7,
    isActive: true, isSystem: false, activeFrom: "2026-08", archivedFrom: null,
    subCategories: [sub(7, "才藝課", 1), sub(7, "教材", 2), sub(7, "文具", 3)],
  },
  {
    id: 8, name: "保險", icon: "shield", type: "expense", nature: "fixed", sortOrder: 8,
    isActive: true, isSystem: false, activeFrom: null, archivedFrom: null,
    subCategories: [sub(8, "壽險", 1), sub(8, "車險", 2)],
  },
  {
    id: 9, name: "訂閱", icon: "autorenew", type: "expense", nature: "fixed", sortOrder: 9,
    isActive: true, isSystem: true, systemKey: "subscription", activeFrom: null, archivedFrom: null,
    subCategories: [],
  },
  {
    id: 10, name: "薪資", icon: "payments", type: "income", nature: null, sortOrder: 10,
    isActive: true, isSystem: false, activeFrom: null, archivedFrom: null,
    subCategories: [sub(10, "本薪", 1), sub(10, "獎金", 2)],
  },
  {
    id: 11, name: "其他", icon: "category", type: "expense", nature: "floating", sortOrder: 11,
    isActive: true, isSystem: true, systemKey: "other", activeFrom: null, archivedFrom: null, subCategories: [],
  },
];

/** 當月預算。教育（id 7）刻意未設，用來呈現「設定預算」提示。 */
export const budgets: Budget[] = [
  { id: 1, month: "2026-09", mainCategoryId: 1, amount: 14000 },
  { id: 2, month: "2026-09", mainCategoryId: 2, amount: 4000 },
  { id: 3, month: "2026-09", mainCategoryId: 3, amount: 28000 },
  { id: 4, month: "2026-09", mainCategoryId: 4, amount: 6000 },
  { id: 5, month: "2026-09", mainCategoryId: 6, amount: 6000 },
  { id: 6, month: "2026-08", mainCategoryId: 1, amount: 14000 },
  { id: 7, month: "2026-08", mainCategoryId: 2, amount: 4000 },
  { id: 8, month: "2026-08", mainCategoryId: 3, amount: 28000 },
  { id: 9, month: "2026-08", mainCategoryId: 4, amount: 6000 },
  { id: 10, month: "2026-08", mainCategoryId: 6, amount: 6000 },
];

export const subscriptions: Subscription[] = [
  { id: 1, name: "影音串流", amount: 390, cycle: "monthly", nextChargeDate: "2026-09-10", mainCategoryId: 9, payerId: 1, isActive: true },
  { id: 2, name: "音樂訂閱", amount: 180, cycle: "monthly", nextChargeDate: "2026-09-08", mainCategoryId: 9, payerId: 2, isActive: true },
  { id: 3, name: "雲端空間", amount: 90, cycle: "monthly", nextChargeDate: "2026-09-12", mainCategoryId: 9, payerId: 1, isActive: true },
  { id: 4, name: "健身房會員", amount: 12000, cycle: "yearly", nextChargeDate: "2027-03-01", mainCategoryId: 9, payerId: 2, isActive: true },
  { id: 5, name: "新聞訂閱", amount: 1800, cycle: "yearly", nextChargeDate: "2026-11-20", mainCategoryId: 9, payerId: 1, isActive: true },
  { id: 6, name: "遊戲通行證", amount: 268, cycle: "monthly", nextChargeDate: "2026-09-20", mainCategoryId: 9, payerId: 2, isActive: false },
];

export const yearExtras: YearExtraExpense[] = [
  { id: 1, year: 2026, name: "健檢", amount: 9900, mainCategoryId: 5, payerId: SYSTEM_ID },
  { id: 4, year: 2025, name: "沙發與床墊", amount: 62000, mainCategoryId: 3, payerId: 1 },
];

export const revisions: TransactionRevision[] = [];

/**
 * 2026 年 1～9 月，與 api/src/db/force-import-2026.ts 的試算表相同：
 * 每個項目每月一筆，日期為該月最後一天，金額 0 略過；記帳者為「系統」、created_by 為 null。
 */
const IMPORT_LINES: { label: string; cat: number; subIdx?: number; amounts: number[] }[] = [
  { label: "薪資1", cat: 10, subIdx: 0, amounts: [15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000] },
  { label: "薪資2", cat: 10, subIdx: 0, amounts: [10000, 10001, 10000, 10000, 10000, 10000, 10000, 10000, 10000] },
  { label: "其它收入", cat: 10, amounts: [31148, 0, 0, 0, 0, 0, 0, 0, 0] },
  { label: "食", cat: 1, amounts: [15073, 10891, 18540, 17542, 15081, 13390, 17790, 17717, 14464] },
  { label: "健康", cat: 5, amounts: [3830, 0, 0, 100, 2488, 2928, 139, 6078, 9065] },
  { label: "育", cat: 7, amounts: [0, 0, 0, 0, 1410, 0, 330, 0, 600] },
  { label: "樂", cat: 6, amounts: [12664, 660, 9385, 8379, 2536, 5681, 4585, 0, 10332] },
  { label: "網路", cat: 9, amounts: [1299, 1299, 1299, 1299, 1299, 1299, 1099, 1299, 1299] },
];

function seedTransactions(): Transaction[] {
  const out: Transaction[] = [];
  let id = 0;
  for (let m = 1; m <= 9; m++) {
    const date = new Date(Date.UTC(2026, m, 0)).toISOString().slice(0, 10);
    IMPORT_LINES.forEach((line) => {
      const amount = line.amounts[m - 1];
      if (!amount) return;
      const cat = categories.find((c) => c.id === line.cat)!;
      out.push({
        id: ++id,
        type: cat.type,
        mainCategoryId: cat.id,
        subCategoryId: line.subIdx == null ? null : cat.subCategories[line.subIdx].id,
        amount,
        date,
        payerId: SYSTEM_ID,
        createdBy: null,
        note: cat.name + "（系統匯入）",
        createdAt: date + "T00:00:00Z",
        isDeleted: false,
        sourceSubscriptionId: null,
      });
    });
  }
  return out;
}

export const transactions: Transaction[] = seedTransactions();

export const passwords: Record<string, string> = { dad: "1234", mom: "1234", sis: "1234" };
export const resetCodes: Record<string, string> = { mom: "980901" };
