import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
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
import { ensurePersonalDefaults } from "../services/categories.js";

/**
 * 依使用者的個人試算表建立個人分類，並匯入 2026 年 1～9 月的個人帳
 * （docs/requirements/personal-ledger.md 6.1、6.2）。
 *
 *   pnpm db:import-personal-2026 --owner=2            只試算：列出會建立／搬移／清掉／塞入什麼，不寫入
 *   pnpm db:import-personal-2026 --owner=2 --apply    真的執行
 *
 * 執行時（同一個 DB transaction，失敗整批還原）：
 * 1. 建立該成員的個人分類（已存在同名同類型的就沿用），含系統分類「其他」「訂閱」。
 * 2. 該成員記在家庭分類下的個人交易，搬到同名的個人分類（沒有同名的放「其他」）。
 * 3. 把要清掉的資料先存成 api/backups/*.json。
 * 4. 軟刪除該成員個人帳 2026-01-01～2026-09-30 的交易（家庭帳與別人的個人帳不動）。
 * 5. 塞入試算表資料：每個項目每月一筆，日期為該月最後一天，金額 0／空白略過。
 * 6. 試算表「額外開銷」欄改記為個人年度額外開銷（不分攤到單月）；先刪掉該成員 2026 年的個人額外開銷。
 * 7. 個人訂閱（10 月起每月 5 號）：記在同名的個人分類（共同費、交通費）；同名的已存在就只改正分類，不重建。
 *    扣款交易由每日 Cron 產生到個人帳。
 * 8. 個人預算（2026-10 起的浮動支出上限）：已設定的覆蓋。
 *
 * 記帳者與 owner 都是該成員本人（個人帳的 owner 必須等於記帳者）；created_by 留 null＝系統產生。
 * 金額已四捨五入成整數。可重複執行：上一次塞入的資料也在清除範圍內，結果相同。
 * 須先跑過 sql/0005（投資類型）。
 */

const APPLY = process.argv.includes("--apply");
const OWNER_ID = Number(process.argv.find((a) => a.startsWith("--owner="))?.slice("--owner=".length));
if (!Number.isInteger(OWNER_ID) || OWNER_ID <= 0) throw new Error("請用 --owner=<成員 id> 指定要匯入誰的個人帳");

const YEAR = 2026;
const RANGE = { start: "2026-01-01", end: "2026-10-01" };
const NOTE_SUFFIX = "（系統匯入）";

type CategoryDef = {
  name: string;
  icon: string;
  type: "expense" | "income" | "investment";
  nature: "floating" | "fixed" | null;
  subs?: string[];
};

/** 個人分類（規格 6.1）；「其他」是系統分類，另外建立 */
const CATEGORIES: CategoryDef[] = [
  { name: "食", icon: "restaurant", type: "expense", nature: "floating" },
  { name: "衣", icon: "apparel", type: "expense", nature: "floating" },
  { name: "住", icon: "home", type: "expense", nature: "floating" },
  { name: "行", icon: "directions_car", type: "expense", nature: "floating" },
  { name: "健康", icon: "favorite", type: "expense", nature: "floating" },
  { name: "育", icon: "school", type: "expense", nature: "floating" },
  { name: "樂", icon: "sports_esports", type: "expense", nature: "floating" },
  { name: "共同費", icon: "group", type: "expense", nature: "fixed" },
  { name: "交通費", icon: "commute", type: "expense", nature: "fixed" },
  { name: "電話費", icon: "smartphone", type: "expense", nature: "fixed" },
  { name: "孝親費", icon: "volunteer_activism", type: "expense", nature: "fixed" },
  // 收入只有「薪資」一個主分類（不開收入的「其他」）；新增交易時有子分類就必選，所以另開「本薪」
  { name: "薪資", icon: "payments", type: "income", nature: null, subs: ["本薪", "獎金", "被動收入", "其它收入"] },
  // 投資不算支出（規格 6.3）
  { name: "投資", icon: "trending_up", type: "investment", nature: null, subs: ["股票"] },
];

type Line = { label: string; category: string; sub?: string; amounts: number[] };

/** 1～9 月；小數已四捨五入（9 月「樂」5,692.5 → 5,693；6、7、9 月電話費） */
const LINES: Line[] = [
  { label: "薪資1", category: "薪資", sub: "本薪", amounts: [52733, 20678, 48655, 48655, 48655, 48912, 50608, 48008, 48875] },
  { label: "薪資2", category: "薪資", sub: "本薪", amounts: [0, 27069, 0, 0, 800, 0, 0, 0, 0] },
  { label: "獎金紅利", category: "薪資", sub: "獎金", amounts: [0, 0, 0, 0, 0, 0, 0, 0, 1000] },
  { label: "被動收入", category: "薪資", sub: "被動收入", amounts: [0, 12000, 0, 0, 0, 0, 0, 0, 0] },
  { label: "其它收入", category: "薪資", sub: "其它收入", amounts: [0, 7200, 0, 200, 0, 1000, 0, 500, 500] },
  { label: "食", category: "食", amounts: [5393, 4650, 4414, 3860, 5930, 4310, 4304, 4415, 6550] },
  { label: "衣", category: "衣", amounts: [0, 1000, 0, 0, 320, 2580, 1750, 0, 0] },
  // 3 月試算表顯示 #REF!，以 1,137 匯入（由當月小計反推，2026-10-15 使用者確認）
  { label: "住", category: "住", amounts: [2694, 1200, 1137, 738, 1050, 1255, 615, 0, 0] },
  { label: "行", category: "行", amounts: [0, 0, 720, 0, 0, 0, 0, 0, 0] },
  { label: "健康", category: "健康", amounts: [0, 0, 720, 0, 1300, 849, 450, 6040, 446] },
  { label: "育", category: "育", amounts: [0, 616, 3158, 699, 99, 3750, 1550, 0, 0] },
  { label: "樂", category: "樂", amounts: [2890, 1650, 5475, 5403, 1650, 2400, 4126, 2449, 5693] },
  { label: "共同費", category: "共同費", amounts: [10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000] },
  { label: "交通費", category: "交通費", amounts: [1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200] },
  { label: "電話費", category: "電話費", amounts: [1587, 932, 1389, 2368, 4394, 1868, 1139, 2986, 2518] },
  { label: "孝親費", category: "孝親費", amounts: [0, 10000, 0, 0, 1500, 0, 0, 0, 1100] },
  // 試算表固定支出區的「其他」→ 系統分類「其他」
  { label: "其他", category: "其他", amounts: [1386, 1386, 1372, 2409, 1372, 1170, 1170, 1770, 1800] },
  { label: "股票", category: "投資", sub: "股票", amounts: [20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000] },
];

/** 試算表「額外開銷」欄（2026-10-15 使用者決定做個人年度額外開銷） */
const EXTRAS: { category: string; amount: number }[] = [
  { category: "行", amount: 2153 },
  { category: "健康", amount: 27986 },
  { category: "育", amount: 8100 },
  { category: "樂", amount: 6995 },
];
const SHEET_EXTRA_TOTAL = 45234;

/** 個人訂閱（2026-10-16 使用者提供）；電話費金額不固定，不做成訂閱 */
const SUBSCRIPTIONS = [
  { name: "共同費", amount: 10000 },
  { name: "交通費", amount: 1200 },
];
const SUBSCRIPTION_START = "2026-10-05";

/** 個人預算：浮動支出每月上限（2026-10-16 使用者提供，試算表「每月預計」欄） */
const BUDGET_MONTH = "2026-10";
const BUDGETS: { category: string; amount: number }[] = [
  { category: "食", amount: 10000 },
  { category: "衣", amount: 1000 },
  { category: "住", amount: 1000 },
  { category: "行", amount: 500 },
  { category: "健康", amount: 500 },
  { category: "育", amount: 500 },
  { category: "樂", amount: 500 },
];

/** 試算表的「月收入合計」「月支出合計」，用來驗算（支出因四捨五入允許差 1） */
const SHEET_INCOME = [52733, 66947, 48655, 48855, 49455, 49912, 50608, 48508, 50375];
const SHEET_EXPENSE = [25150, 32634, 29585, 26677, 28815, 29382, 26304, 28860, 29306];

const lastDayOf = (month: number) => new Date(Date.UTC(YEAR, month, 0)).toISOString().slice(0, 10);

// ── 讀取現況 ──────────────────────────────────────────────

const [owner] = await db
  .select({ id: members.id, name: members.name, isActive: members.isActive })
  .from(members)
  .where(eq(members.id, OWNER_ID))
  .limit(1);
if (!owner) throw new Error("成員 #" + OWNER_ID + " 不存在");
if (!owner.isActive) throw new Error("成員「" + owner.name + "」已停用，請先確認");

const ownedMains = await db.select().from(mainCategories).where(eq(mainCategories.ownerId, OWNER_ID));
const ownedSubs = ownedMains.length
  ? await db
      .select()
      .from(subCategories)
      .where(
        inArray(
          subCategories.mainCategoryId,
          ownedMains.map((m) => m.id)
        )
      )
  : [];

/** 已存在的同名分類必須類型一致，否則停下來讓人確認 */
for (const def of CATEGORIES) {
  const found = ownedMains.find((m) => m.name === def.name);
  if (found && (found.type !== def.type || found.nature !== def.nature)) {
    throw new Error("個人分類「" + def.name + "」已存在但類型不同，請先確認");
  }
}
const toCreate = CATEGORIES.filter((d) => !ownedMains.some((m) => m.name === d.name));
const missingSystem = ["其他", "訂閱"].filter(
  (name) => !ownedMains.some((m) => m.isSystem && m.name === name)
);
const subsToCreate = CATEGORIES.flatMap((d) => {
  const main = ownedMains.find((m) => m.name === d.name);
  return (d.subs ?? []).filter((s) => !main || !ownedSubs.some((r) => r.mainCategoryId === main.id && r.name === s));
});

// 記在家庭分類下的個人交易（第 1 批還沒有個人分類時記的）
const familyMains = await db.select().from(mainCategories);
const familyCatIds = new Set(familyMains.filter((m) => m.ownerId == null).map((m) => m.id));
const misfiled = (
  await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.ownerId, OWNER_ID), eq(transactions.isDeleted, false)))
).filter((t) => t.mainCategoryId != null && familyCatIds.has(t.mainCategoryId));
const misfiledToMove = misfiled.filter((t) => !(t.date >= RANGE.start && t.date < RANGE.end));

const inRange = and(
  eq(transactions.ownerId, OWNER_ID),
  eq(transactions.isDeleted, false),
  gte(transactions.date, RANGE.start),
  lt(transactions.date, RANGE.end)
);
const oldTransactions = await db.select().from(transactions).where(inRange);
// 個人年度額外開銷沒有自己的 owner_id：掛在該成員個人分類上的就是他的
const ownedMainIds = ownedMains.map((m) => m.id);
const extrasInScope = ownedMainIds.length
  ? and(eq(yearExtraExpenses.year, YEAR), inArray(yearExtraExpenses.mainCategoryId, ownedMainIds))
  : undefined;
const oldExtras = extrasInScope ? await db.select().from(yearExtraExpenses).where(extrasInScope) : [];

const plannedRows = LINES.flatMap((line) => {
  const def = line.category === "其他" ? { type: "expense" as const } : CATEGORIES.find((d) => d.name === line.category);
  if (!def) throw new Error("試算表項目「" + line.label + "」對不到個人分類「" + line.category + "」");
  return line.amounts.flatMap((amount, i) =>
    amount > 0
      ? [{ line, type: def.type, amount, date: lastDayOf(i + 1), note: line.label + NOTE_SUFFIX, month: i }]
      : []
  );
});

// ── 驗算與報告 ───────────────────────────────────────────

const sum = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0);
const byType = (rows: { type: string; amount: number }[], type: string) => sum(rows.filter((r) => r.type === type));

const mismatches: string[] = [];
for (let i = 0; i < 9; i++) {
  const inMonth = plannedRows.filter((r) => r.month === i);
  const income = byType(inMonth, "income");
  const expense = byType(inMonth, "expense");
  if (income !== SHEET_INCOME[i]) mismatches.push(i + 1 + " 月收入 " + income + " ≠ 試算表 " + SHEET_INCOME[i]);
  if (Math.abs(expense - SHEET_EXPENSE[i]!) > 1) {
    mismatches.push(i + 1 + " 月支出 " + expense + " ≠ 試算表 " + SHEET_EXPENSE[i]);
  }
}
if (sum(EXTRAS) !== SHEET_EXTRA_TOTAL) mismatches.push("額外開銷合計 " + sum(EXTRAS) + " ≠ 試算表 " + SHEET_EXTRA_TOTAL);
for (const e of EXTRAS) {
  const def = CATEGORIES.find((d) => d.name === e.category);
  if (!def || def.type !== "expense") mismatches.push("額外開銷「" + e.category + "」對不到個人支出分類");
}
if (mismatches.length) throw new Error("和試算表合計對不起來：\n" + mismatches.join("\n"));

console.log(APPLY ? "【執行模式】" : "【試算模式】加上 --apply 才會寫入");
console.log("對象：成員 #" + owner.id + "「" + owner.name + "」的個人帳");
console.log(
  "個人分類：新建 " + (toCreate.length + missingSystem.length) + " 個主分類" +
    (toCreate.length + missingSystem.length
      ? "（" + [...toCreate.map((d) => d.name), ...missingSystem].join("、") + "）"
      : "") +
    "、" + subsToCreate.length + " 個子分類；沿用 " + (CATEGORIES.length - toCreate.length) + " 個"
);
console.log(
  "搬到個人分類：" + misfiledToMove.length + " 筆記在家庭分類下的個人交易" +
    (misfiledToMove.length
      ? "（" + misfiledToMove.map((t) => t.date + " " + t.mainCategoryName + " " + t.amount).join("、") + "）"
      : "")
);
console.log(
  "清除：個人帳 1～9 月交易 " + oldTransactions.length + " 筆（收入 " + byType(oldTransactions, "income") +
    "、支出 " + byType(oldTransactions, "expense") + "、投資 " + byType(oldTransactions, "investment") + "）"
);
console.log(
  "塞入：交易 " + plannedRows.length + " 筆（收入 " + byType(plannedRows, "income") + "、支出 " +
    byType(plannedRows, "expense") + "、投資 " + byType(plannedRows, "investment") + "）；各月合計與試算表一致"
);
console.log(
  "年度額外開銷（" + YEAR + "）：清除 " + oldExtras.length + " 筆（" + sum(oldExtras) + "）；塞入 " + EXTRAS.length +
    " 筆（" + EXTRAS.map((e) => e.category + " " + e.amount).join("、") + "，合計 " + sum(EXTRAS) + "）"
);

console.log(
  "個人訂閱：" + SUBSCRIPTIONS.map((s) => s.name + " " + s.amount).join("、") + "（月繳，" + SUBSCRIPTION_START + " 起每月扣款，扣款人「" + owner.name + "」）"
);
console.log(
  "個人預算（" + BUDGET_MONTH + "）：" + BUDGETS.map((b) => b.category + " " + b.amount).join("、") + "，合計 " + sum(BUDGETS)
);

if (!APPLY) {
  await sql.end();
  process.exit(0);
}

// ── 備份 ─────────────────────────────────────────────────

const backupDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../backups");
await mkdir(backupDir, { recursive: true });
const backupFile = resolve(
  backupDir,
  "import-personal-2026-owner" + OWNER_ID + "-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json"
);
await writeFile(
  backupFile,
  JSON.stringify({ transactions: oldTransactions, moved: misfiledToMove, yearExtraExpenses: oldExtras }, null, 2)
);
console.log("已備份要清除與搬移的資料：" + backupFile);

// ── 寫入（同一個 transaction） ────────────────────────────

// 系統分類「其他」「訂閱」與 App 第一次使用個人帳時建立的是同一組（冪等）
await ensurePersonalDefaults(OWNER_ID);
const [otherCat] = await db
  .select({ id: mainCategories.id })
  .from(mainCategories)
  .where(and(eq(mainCategories.ownerId, OWNER_ID), eq(mainCategories.systemKey, "other")))
  .limit(1);

await db.transaction(async (tx) => {
  // 1. 個人分類
  let sortOrder = Math.max(0, ...ownedMains.filter((m) => !m.isSystem).map((m) => m.sortOrder));
  const mainIdOf = new Map(ownedMains.map((m) => [m.name, m.id] as const));
  for (const def of toCreate) {
    const [row] = await tx
      .insert(mainCategories)
      .values({
        name: def.name,
        icon: def.icon,
        type: def.type,
        nature: def.nature,
        sortOrder: ++sortOrder,
        ownerId: OWNER_ID,
      })
      .returning({ id: mainCategories.id });
    mainIdOf.set(def.name, row!.id);
  }
  mainIdOf.set("其他", otherCat!.id);

  const subIdOf = new Map(ownedSubs.map((s) => [s.mainCategoryId + "|" + s.name, s.id] as const));
  for (const def of CATEGORIES) {
    const mainId = mainIdOf.get(def.name)!;
    for (const [i, name] of (def.subs ?? []).entries()) {
      if (subIdOf.has(mainId + "|" + name)) continue;
      const [row] = await tx
        .insert(subCategories)
        .values({ mainCategoryId: mainId, name, sortOrder: i + 1 })
        .returning({ id: subCategories.id });
      subIdOf.set(mainId + "|" + name, row!.id);
    }
  }

  // 2. 記在家庭分類下的個人交易搬到同名個人分類；子分類同名才保留
  for (const t of misfiledToMove) {
    const familyName = familyMains.find((m) => m.id === t.mainCategoryId)!.name;
    const mainName = mainIdOf.has(familyName) ? familyName : "其他";
    const mainId = mainIdOf.get(mainName)!;
    const subId = t.subCategoryName ? (subIdOf.get(mainId + "|" + t.subCategoryName) ?? null) : null;
    await tx
      .update(transactions)
      .set({
        mainCategoryId: mainId,
        subCategoryId: subId,
        mainCategoryName: mainName,
        subCategoryName: subId == null ? null : t.subCategoryName,
      })
      .where(eq(transactions.id, t.id));
  }

  // 3. 清掉該成員個人帳 1～9 月，4. 塞入試算表
  await tx.update(transactions).set({ isDeleted: true }).where(inRange);
  await tx.insert(transactions).values(
    plannedRows.map((r) => {
      const mainId = mainIdOf.get(r.line.category)!;
      const subId = r.line.sub ? subIdOf.get(mainId + "|" + r.line.sub)! : null;
      return {
        type: r.type,
        mainCategoryId: mainId,
        subCategoryId: subId,
        amount: r.amount,
        date: r.date,
        payerId: OWNER_ID,
        ownerId: OWNER_ID,
        createdBy: null,
        note: r.note,
        mainCategoryName: r.line.category,
        subCategoryName: r.line.sub ?? null,
      };
    })
  );

  // 6. 個人年度額外開銷（此表沒有軟刪除，靠上面的備份）
  if (extrasInScope) await tx.delete(yearExtraExpenses).where(extrasInScope);
  await tx.insert(yearExtraExpenses).values(
    EXTRAS.map((e) => ({
      year: YEAR,
      name: e.category + "額外開銷" + NOTE_SUFFIX,
      amount: e.amount,
      mainCategoryId: mainIdOf.get(e.category)!,
      payerId: OWNER_ID,
    }))
  );

  // 7. 個人訂閱：記在同名的個人固定支出分類（共同費、交通費），年度彙整跟 1～9 月同一列。
  //    與 App 新增訂閱的寫法相同（建立時寫入第一個版本）；已存在的同名訂閱只把分類改正（上一版記在「訂閱」）
  const ownSubs = await tx
    .select({ id: subscriptions.id, name: subscriptions.name })
    .from(subscriptions)
    .innerJoin(mainCategories, eq(mainCategories.id, subscriptions.mainCategoryId))
    .where(eq(mainCategories.ownerId, OWNER_ID));
  for (const s of SUBSCRIPTIONS) {
    const mainCategoryId = mainIdOf.get(s.name)!;
    const existing = ownSubs.find((e) => e.name === s.name);
    if (existing) {
      await tx.update(subscriptions).set({ mainCategoryId }).where(eq(subscriptions.id, existing.id));
      continue;
    }
    const [created] = await tx
      .insert(subscriptions)
      .values({
        name: s.name,
        amount: s.amount,
        cycle: "monthly",
        nextChargeDate: SUBSCRIPTION_START,
        chargeDay: Number(SUBSCRIPTION_START.slice(8, 10)),
        chargeMonth: null,
        mainCategoryId,
        payerId: OWNER_ID,
      })
      .returning({ id: subscriptions.id });
    await tx.insert(subscriptionRevisions).values({
      subscriptionId: created!.id,
      effectiveFrom: SUBSCRIPTION_START.slice(0, 7),
      amount: s.amount,
      cycle: "monthly",
    });
  }

  // 8. 個人預算
  for (const b of BUDGETS) {
    await tx
      .insert(budgets)
      .values({ month: BUDGET_MONTH, mainCategoryId: mainIdOf.get(b.category)!, amount: b.amount })
      .onConflictDoUpdate({ target: [budgets.month, budgets.mainCategoryId], set: { amount: b.amount } });
  }
});

console.log("完成。");
await sql.end();
