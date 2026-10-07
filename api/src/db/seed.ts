import { db, sql } from "./index.js";
import {
  budgets,
  mainCategories,
  members,
  subCategories,
  subscriptionRevisions,
  subscriptions,
  transactions,
  yearExtraExpenses,
} from "./schema.js";
import { hashPassword } from "../lib/auth.js";
import { env } from "../env.js";
import { monthOf } from "../lib/dates.js";

/**
 * 由 vue3/src/mocks/data.ts 逐筆轉出，讓真後端接上後畫面與 mock 一致。
 * 三個啟用帳號的初始密碼取自 SEED_ADMIN_PASSWORD（預設 1234，僅供本機），阿嬤為停用帳號、無密碼。
 * 正式部署請在 Vercel 環境變數設一組隨機值，首次登入後於 App 內自行更換。
 * 冪等：每次執行先清空再重建，只在開發與初始化時跑。
 */

const pw = await hashPassword(env.SEED_ADMIN_PASSWORD);

const memberSeed = [
  { id: 1, name: "先生", account: "dad", role: "admin", color: "#6b5cf5", joinedMonth: "2025-01", isActive: true, passwordHash: pw, resetCode: null },
  { id: 2, name: "太太", account: "mom", role: "admin", color: "#2bb3d9", joinedMonth: "2025-01", isActive: true, passwordHash: pw, resetCode: "980901" },
  { id: 3, name: "小妹", account: "sis", role: "member", color: "#f5b23c", joinedMonth: "2026-03", isActive: true, passwordHash: pw, resetCode: null },
  { id: 4, name: "阿嬤", account: "grandma", role: "member", color: "#8b857c", joinedMonth: "2025-06", isActive: false, passwordHash: null, resetCode: null },
] as const;

const categorySeed = [
  { id: 1, name: "食", icon: "restaurant", type: "expense", nature: "floating", isSystem: false, activeFrom: null, archivedFrom: null, isActive: true, subs: ["早餐", "午餐", "晚餐", "食材", "飲料"] },
  { id: 2, name: "衣", icon: "apparel", type: "expense", nature: "floating", isSystem: false, activeFrom: null, archivedFrom: null, isActive: true, subs: ["衣物", "鞋類", "配件"] },
  { id: 3, name: "住", icon: "home", type: "expense", nature: "floating", isSystem: false, activeFrom: null, archivedFrom: null, isActive: true, subs: ["房租", "水電", "瓦斯", "日用品"] },
  { id: 4, name: "行", icon: "directions_car", type: "expense", nature: "floating", isSystem: false, activeFrom: null, archivedFrom: null, isActive: true, subs: ["加油", "大眾運輸", "停車"] },
  { id: 5, name: "健康", icon: "favorite", type: "expense", nature: "floating", isSystem: false, activeFrom: null, archivedFrom: "2026-07", isActive: false, subs: ["看診", "藥品", "保健食品"] },
  { id: 6, name: "育樂", icon: "sports_esports", type: "expense", nature: "floating", isSystem: false, activeFrom: null, archivedFrom: null, isActive: true, subs: ["電影", "旅遊", "聚餐", "書籍"] },
  { id: 7, name: "教育", icon: "school", type: "expense", nature: "floating", isSystem: false, activeFrom: "2026-08", archivedFrom: null, isActive: true, subs: ["才藝課", "教材", "文具"] },
  { id: 8, name: "保險", icon: "shield", type: "expense", nature: "fixed", isSystem: false, activeFrom: null, archivedFrom: null, isActive: true, subs: ["壽險", "車險"] },
  { id: 9, name: "訂閱", icon: "autorenew", type: "expense", nature: "fixed", isSystem: true, systemKey: "subscription", activeFrom: null, archivedFrom: null, isActive: true, subs: [] },
  { id: 10, name: "薪資", icon: "payments", type: "income", nature: null, isSystem: false, activeFrom: null, archivedFrom: null, isActive: true, subs: ["本薪", "獎金"] },
  { id: 11, name: "其他", icon: "category", type: "expense", nature: "floating", isSystem: true, systemKey: "other", activeFrom: null, archivedFrom: null, isActive: true, subs: [] },
] as const;

const budgetSeed = [
  { month: "2026-09", mainCategoryId: 1, amount: 14000 },
  { month: "2026-09", mainCategoryId: 2, amount: 4000 },
  { month: "2026-09", mainCategoryId: 3, amount: 28000 },
  { month: "2026-09", mainCategoryId: 4, amount: 6000 },
  { month: "2026-09", mainCategoryId: 6, amount: 6000 },
  { month: "2026-08", mainCategoryId: 1, amount: 14000 },
  { month: "2026-08", mainCategoryId: 2, amount: 4000 },
  { month: "2026-08", mainCategoryId: 3, amount: 28000 },
  { month: "2026-08", mainCategoryId: 4, amount: 6000 },
  { month: "2026-08", mainCategoryId: 6, amount: 6000 },
];

const subscriptionSeed = [
  { id: 1, name: "影音串流", amount: 390, cycle: "monthly", nextChargeDate: "2026-09-10", mainCategoryId: 9, payerId: 1, isActive: true },
  { id: 2, name: "音樂訂閱", amount: 180, cycle: "monthly", nextChargeDate: "2026-09-08", mainCategoryId: 9, payerId: 2, isActive: true },
  { id: 3, name: "雲端空間", amount: 90, cycle: "monthly", nextChargeDate: "2026-09-12", mainCategoryId: 9, payerId: 1, isActive: true },
  { id: 4, name: "健身房會員", amount: 12000, cycle: "yearly", nextChargeDate: "2027-03-01", mainCategoryId: 9, payerId: 2, isActive: true },
  { id: 5, name: "新聞訂閱", amount: 1800, cycle: "yearly", nextChargeDate: "2026-11-20", mainCategoryId: 9, payerId: 1, isActive: true },
  { id: 6, name: "遊戲通行證", amount: 268, cycle: "monthly", nextChargeDate: "2026-09-20", mainCategoryId: 9, payerId: 2, isActive: false },
] as const;

const yearExtraSeed = [
  { year: 2026, name: "日本家庭旅遊", amount: 86000, mainCategoryId: 6, payerId: 2 },
  { year: 2026, name: "冷氣與冰箱更新", amount: 48000, mainCategoryId: 3, payerId: 1 },
  { year: 2026, name: "汽車大保養", amount: 32000, mainCategoryId: 4, payerId: 1 },
  { year: 2025, name: "沙發與床墊", amount: 62000, mainCategoryId: 3, payerId: 1 },
];

console.log("清空既有資料…");
await sql`truncate table
  transaction_revisions, transactions, subscription_revisions, subscriptions,
  budgets, year_extra_expenses, sub_categories, main_categories, members
  restart identity cascade`;

console.log("寫入成員與分類…");
await db.insert(members).values(memberSeed.map((m) => ({ ...m })));

await db.insert(mainCategories).values(
  categorySeed.map((c, i) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    type: c.type,
    nature: c.nature,
    sortOrder: i + 1,
    isActive: c.isActive,
    isSystem: c.isSystem,
    systemKey: "systemKey" in c ? c.systemKey : null,
    activeFrom: c.activeFrom,
    archivedFrom: c.archivedFrom,
  }))
);

const subRows = categorySeed.flatMap((c) =>
  c.subs.map((name, i) => ({ mainCategoryId: c.id, name, sortOrder: i + 1, isActive: true }))
);
const insertedSubs = await db.insert(subCategories).values(subRows).returning();

/** 主分類 id → 其子分類（依 sortOrder），供交易 seed 挑選。 */
const subsByMain = new Map<number, typeof insertedSubs>();
for (const s of insertedSubs) {
  const list = subsByMain.get(s.mainCategoryId) ?? [];
  list.push(s);
  subsByMain.set(s.mainCategoryId, list);
}
for (const list of subsByMain.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

console.log("寫入預算、訂閱與年度額外支出…");
await db.insert(budgets).values(budgetSeed);
await db.insert(subscriptions).values(
  subscriptionSeed.map((s) => ({ ...s, chargeDay: Number(s.nextChargeDate.slice(8, 10)) }))
);
await db.insert(subscriptionRevisions).values(
  subscriptionSeed.map((s) => ({
    subscriptionId: s.id,
    // 首版自 2026-01 生效，讓整年的固定支出都有可回推的版本
    effectiveFrom: monthOf(s.nextChargeDate) > "2026-01" ? "2026-01" : monthOf(s.nextChargeDate),
    amount: s.amount,
    cycle: s.cycle,
  }))
);
await db.insert(yearExtraExpenses).values(yearExtraSeed);

console.log("產生一整年交易…");
const plan = [
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
] as const;

const txRows: (typeof transactions.$inferInsert)[] = [];
const catName = new Map(categorySeed.map((c) => [c.id, c.name]));
const subName = (mainId: number, idx: number) => subsByMain.get(mainId)?.[idx]?.name ?? null;

for (let m = 1; m <= 9; m++) {
  const mm = String(m).padStart(2, "0");
  plan.forEach((p, i) => {
    if (p.cat === 7 && m < 8) return; // 教育 8 月才新增
    if (p.cat === 5 && m >= 7) return; // 健康 7 月起停用
    const day = String(Math.min(28, 3 + i * 3)).padStart(2, "0");
    txRows.push({
      type: "expense",
      mainCategoryId: p.cat,
      subCategoryId: subsByMain.get(p.cat)?.[p.subIdx]?.id ?? null,
      amount: Math.round((p.base * (0.85 + ((m * 7 + i * 3) % 30) / 100)) / 10) * 10,
      date: "2026-" + mm + "-" + day,
      payerId: p.payer,
      createdBy: p.payer,
      note: i === 0 ? "週末採買" : null,
      mainCategoryName: catName.get(p.cat) ?? null,
      subCategoryName: subName(p.cat, p.subIdx),
      createdAt: new Date("2026-" + mm + "-" + day + "T09:" + String(10 + i).padStart(2, "0") + ":00Z"),
    });
  });
  [1, 2].forEach((payer, k) => {
    txRows.push({
      type: "income",
      mainCategoryId: 10,
      subCategoryId: subsByMain.get(10)?.[0]?.id ?? null,
      amount: k === 0 ? 92000 : 76500,
      date: "2026-" + mm + "-05",
      payerId: payer,
      createdBy: payer,
      note: null,
      mainCategoryName: catName.get(10) ?? null,
      subCategoryName: subName(10, 0),
      createdAt: new Date("2026-" + mm + "-05T08:00:00Z"),
    });
  });
}
await db.insert(transactions).values(txRows);

// 顯式指定 id 的表要把 identity 序列推到 max(id)，否則後續 insert 會撞主鍵
for (const table of ["members", "main_categories", "subscriptions"]) {
  await sql.unsafe(
    "select setval(pg_get_serial_sequence('" +
      table +
      "', 'id'), (select coalesce(max(id), 1) from " +
      table +
      "))"
  );
}

console.log(
  "完成：成員 " + memberSeed.length + "、分類 " + categorySeed.length + "、交易 " + txRows.length + " 筆"
);
console.log("登入：dad（管理者）、sis（一般成員），密碼為 SEED_ADMIN_PASSWORD");
console.log("初始密碼：" + env.SEED_ADMIN_PASSWORD + "　← 登入後請立即更換");
await sql.end();
