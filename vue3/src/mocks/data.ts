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

/** chargeDay、chargeMonth 由首次扣款日推出，與後端 seed 一致。 */
export const subscriptions: Subscription[] = (
  [
    { id: 1, name: "影音串流", amount: 390, cycle: "monthly", nextChargeDate: "2026-09-10", mainCategoryId: 9, payerId: 1, isActive: true },
    { id: 2, name: "音樂訂閱", amount: 180, cycle: "monthly", nextChargeDate: "2026-09-08", mainCategoryId: 9, payerId: 2, isActive: true },
    { id: 3, name: "雲端空間", amount: 90, cycle: "monthly", nextChargeDate: "2026-09-12", mainCategoryId: 9, payerId: 1, isActive: true },
    { id: 4, name: "健身房會員", amount: 12000, cycle: "yearly", nextChargeDate: "2027-03-01", mainCategoryId: 9, payerId: 2, isActive: true },
    { id: 5, name: "新聞訂閱", amount: 1800, cycle: "yearly", nextChargeDate: "2026-11-20", mainCategoryId: 9, payerId: 1, isActive: true },
    { id: 6, name: "遊戲通行證", amount: 268, cycle: "monthly", nextChargeDate: "2026-09-20", mainCategoryId: 9, payerId: 2, isActive: false },
  ] satisfies Omit<Subscription, "chargeDay" | "chargeMonth" | "periodAmount">[]
).map((s) => ({
  ...s,
  chargeDay: Number(s.nextChargeDate.slice(8, 10)),
  chargeMonth: s.cycle === "yearly" ? Number(s.nextChargeDate.slice(5, 7)) : null,
  periodAmount: null,
}));

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
        ownerId: null,
      });
    });
  }
  return out;
}

/**
 * 太太（#2）的個人分類與 2026 年 1～9 月個人帳，與 api/src/db/import-personal-2026.ts 相同：
 * 個人分類只有本人看得到；「投資」是第三種類型，不算支出。
 */
const PERSONAL_OWNER = 2;
type PersonalDef = [name: string, icon: string, type: MainCategory["type"], nature: MainCategory["nature"], subs?: string[]];
const PERSONAL_CATEGORIES: PersonalDef[] = [
  ["食", "restaurant", "expense", "floating"],
  ["衣", "apparel", "expense", "floating"],
  ["住", "home", "expense", "floating"],
  ["行", "directions_car", "expense", "floating"],
  ["健康", "favorite", "expense", "floating"],
  ["育", "school", "expense", "floating"],
  ["樂", "sports_esports", "expense", "floating"],
  ["共同費", "group", "expense", "fixed"],
  ["交通費", "commute", "expense", "fixed"],
  ["電話費", "smartphone", "expense", "fixed"],
  ["孝親費", "volunteer_activism", "expense", "fixed"],
  ["薪資", "payments", "income", null, ["本薪", "獎金", "被動收入", "其它收入"]],
  ["投資", "trending_up", "investment", null, ["股票"]],
];
PERSONAL_CATEGORIES.forEach(([name, icon, type, nature, subs = []], i) => {
  const id = 201 + i;
  categories.push({
    id, name, icon, type, nature, sortOrder: i + 1, isActive: true, isSystem: false,
    activeFrom: null, archivedFrom: null,
    subCategories: subs.map((s, j) => sub(id, s, j + 1)),
    ownerId: PERSONAL_OWNER,
  } as MainCategory);
});
categories.push({
  id: 298, name: "訂閱", icon: "autorenew", type: "expense", nature: "fixed", sortOrder: 998,
  isActive: true, isSystem: true, systemKey: "subscription", activeFrom: null, archivedFrom: null, subCategories: [],
  ownerId: PERSONAL_OWNER,
} as MainCategory);
// 預覽用的個人訂閱範例（10 月起；正式匯入不會建立，由本人在訂閱管理新增）
subscriptions.push(
  { id: 201, name: "共同費", amount: 10000, cycle: "monthly", nextChargeDate: "2026-10-31", chargeDay: 31, chargeMonth: null, periodAmount: null, mainCategoryId: 298, payerId: PERSONAL_OWNER, isActive: true },
  { id: 202, name: "交通費", amount: 1200, cycle: "monthly", nextChargeDate: "2026-10-31", chargeDay: 31, chargeMonth: null, periodAmount: null, mainCategoryId: 298, payerId: PERSONAL_OWNER, isActive: true }
);
categories.push({
  id: 299, name: "其他", icon: "category", type: "expense", nature: "floating", sortOrder: 999,
  isActive: true, isSystem: true, systemKey: "other", activeFrom: null, archivedFrom: null, subCategories: [],
  ownerId: PERSONAL_OWNER,
} as MainCategory);

/** 試算表「額外開銷」欄：個人年度額外開銷，不分攤到單月 */
const PERSONAL_EXTRAS: [cat: string, amount: number][] = [
  ["行", 2153],
  ["健康", 27986],
  ["育", 8100],
  ["樂", 6995],
];
PERSONAL_EXTRAS.forEach(([cat, amount], i) => {
  const mainCategoryId = categories.find(
    (c) => c.name === cat && (c as MainCategory & { ownerId?: number }).ownerId === PERSONAL_OWNER
  )!.id;
  yearExtras.push({ id: 201 + i, year: 2026, name: cat + "額外開銷（系統匯入）", amount, mainCategoryId, payerId: PERSONAL_OWNER });
});

const PERSONAL_LINES: { label: string; cat: string; sub?: string; amounts: number[] }[] = [
  { label: "薪資1", cat: "薪資", sub: "本薪", amounts: [52733, 20678, 48655, 48655, 48655, 48912, 50608, 48008, 48875] },
  { label: "薪資2", cat: "薪資", sub: "本薪", amounts: [0, 27069, 0, 0, 800, 0, 0, 0, 0] },
  { label: "獎金紅利", cat: "薪資", sub: "獎金", amounts: [0, 0, 0, 0, 0, 0, 0, 0, 1000] },
  { label: "被動收入", cat: "薪資", sub: "被動收入", amounts: [0, 12000, 0, 0, 0, 0, 0, 0, 0] },
  { label: "其它收入", cat: "薪資", sub: "其它收入", amounts: [0, 7200, 0, 200, 0, 1000, 0, 500, 500] },
  { label: "食", cat: "食", amounts: [5393, 4650, 4414, 3860, 5930, 4310, 4304, 4415, 6550] },
  { label: "衣", cat: "衣", amounts: [0, 1000, 0, 0, 320, 2580, 1750, 0, 0] },
  { label: "住", cat: "住", amounts: [2694, 1200, 1137, 738, 1050, 1255, 615, 0, 0] },
  { label: "行", cat: "行", amounts: [0, 0, 720, 0, 0, 0, 0, 0, 0] },
  { label: "健康", cat: "健康", amounts: [0, 0, 720, 0, 1300, 849, 450, 6040, 446] },
  { label: "育", cat: "育", amounts: [0, 616, 3158, 699, 99, 3750, 1550, 0, 0] },
  { label: "樂", cat: "樂", amounts: [2890, 1650, 5475, 5403, 1650, 2400, 4126, 2449, 5693] },
  { label: "共同費", cat: "共同費", amounts: [10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000] },
  { label: "交通費", cat: "交通費", amounts: [1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200] },
  { label: "電話費", cat: "電話費", amounts: [1587, 932, 1389, 2368, 4394, 1868, 1139, 2986, 2518] },
  { label: "孝親費", cat: "孝親費", amounts: [0, 10000, 0, 0, 1500, 0, 0, 0, 1100] },
  { label: "其他", cat: "其他", amounts: [1386, 1386, 1372, 2409, 1372, 1170, 1170, 1770, 1800] },
  { label: "股票", cat: "投資", sub: "股票", amounts: [20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000] },
];

function seedPersonal(startId: number): Transaction[] {
  const out: Transaction[] = [];
  let id = startId;
  const mine = categories.filter((c) => (c as MainCategory & { ownerId?: number }).ownerId === PERSONAL_OWNER);
  for (let m = 1; m <= 9; m++) {
    const date = new Date(Date.UTC(2026, m, 0)).toISOString().slice(0, 10);
    PERSONAL_LINES.forEach((line) => {
      const amount = line.amounts[m - 1];
      if (!amount) return;
      const cat = mine.find((c) => c.name === line.cat)!;
      out.push({
        id: ++id,
        type: cat.type,
        mainCategoryId: cat.id,
        subCategoryId: line.sub ? cat.subCategories.find((s) => s.name === line.sub)!.id : null,
        amount,
        date,
        payerId: PERSONAL_OWNER,
        createdBy: null,
        note: line.label + "（系統匯入）",
        createdAt: date + "T00:00:00Z",
        isDeleted: false,
        sourceSubscriptionId: null,
        ownerId: PERSONAL_OWNER,
      });
    });
  }
  return out;
}

const familyTransactions = seedTransactions();
export const transactions: Transaction[] = [...familyTransactions, ...seedPersonal(familyTransactions.length)];

export const passwords: Record<string, string> = { dad: "1234", mom: "1234", sis: "1234" };
export const resetCodes: Record<string, string> = { mom: "980901" };
