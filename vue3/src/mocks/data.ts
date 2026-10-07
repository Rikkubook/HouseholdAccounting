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
];

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
  { id: 1, year: 2026, name: "日本家庭旅遊", amount: 86000, mainCategoryId: 6, payerId: 2 },
  { id: 2, year: 2026, name: "冷氣與冰箱更新", amount: 48000, mainCategoryId: 3, payerId: 1 },
  { id: 3, year: 2026, name: "汽車大保養", amount: 32000, mainCategoryId: 4, payerId: 1 },
  { id: 4, year: 2025, name: "沙發與床墊", amount: 62000, mainCategoryId: 3, payerId: 1 },
];

export const revisions: TransactionRevision[] = [];

/** 產生一整年的交易；教育只從 8 月起、健康只到 6 月（對應分類生命週期）。 */
function seedTransactions(): Transaction[] {
  const out: Transaction[] = [];
  let id = 0;
  const plan: { cat: number; subIdx: number; base: number; payer: number }[] = [
    { cat: 1, subIdx: 3, base: 1480, payer: 2 },
    { cat: 1, subIdx: 0, base: 320, payer: 1 },
    { cat: 3, subIdx: 0, base: 22000, payer: 1 },
    { cat: 3, subIdx: 1, base: 2860, payer: 1 },
    { cat: 4, subIdx: 0, base: 1500, payer: 1 },
    { cat: 6, subIdx: 2, base: 2100, payer: 2 },
    { cat: 2, subIdx: 0, base: 1880, payer: 2 },
    { cat: 5, subIdx: 0, base: 1200, payer: 2 },
    { cat: 7, subIdx: 0, base: 1600, payer: 2 },
    { cat: 8, subIdx: 0, base: 3200, payer: 1 },
  ];
  for (let m = 1; m <= 9; m++) {
    const mm = String(m).padStart(2, "0");
    plan.forEach((p, i) => {
      if (p.cat === 7 && m < 8) return; // 教育 8 月才新增
      if (p.cat === 5 && m >= 7) return; // 健康 7 月起停用
      const day = String(Math.min(28, 3 + i * 3)).padStart(2, "0");
      const cat = categories.find((c) => c.id === p.cat)!;
      out.push({
        id: ++id,
        type: "expense",
        mainCategoryId: p.cat,
        subCategoryId: cat.subCategories[p.subIdx]?.id ?? null,
        amount: Math.round((p.base * (0.85 + ((m * 7 + i * 3) % 30) / 100)) / 10) * 10,
        date: "2026-" + mm + "-" + day,
        payerId: p.payer,
        createdBy: p.payer,
        note: i === 0 ? "週末採買" : null,
        createdAt: "2026-" + mm + "-" + day + "T09:" + String(10 + i).padStart(2, "0") + ":00Z",
        isDeleted: false,
        sourceSubscriptionId: null,
      });
    });
    // 每月薪資
    [1, 2].forEach((payer, k) => {
      out.push({
        id: ++id,
        type: "income",
        mainCategoryId: 10,
        subCategoryId: categories.find((c) => c.id === 10)!.subCategories[0].id,
        amount: k === 0 ? 92000 : 76500,
        date: "2026-" + mm + "-05",
        payerId: payer,
        createdBy: payer,
        note: null,
        createdAt: "2026-" + mm + "-05T08:00:00Z",
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
