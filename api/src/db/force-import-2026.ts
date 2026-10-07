import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { db, sql } from "./index.js";
import { mainCategories, members, subCategories, transactions, yearExtraExpenses } from "./schema.js";

/**
 * 以 2026 年 1～9 月的試算表為準，強制覆蓋正式資料庫的家庭帳。
 *
 *   pnpm db:force-import-2026            只試算：列出會清掉／會塞入什麼，不寫入
 *   pnpm db:force-import-2026 --apply    真的執行
 *
 * 執行時（同一個 DB transaction，失敗整批還原）：
 * 1. 把要清掉的資料先存成 api/backups/*.json。
 * 2. 軟刪除家庭帳 2026-01-01～2026-09-30 的全部交易（含訂閱自動產生的）。
 * 3. 刪除 2026 年的年度額外開銷（此表沒有軟刪除，靠第 1 步的備份）。
 * 4. 塞入試算表資料：每個項目每月一筆，日期為該月最後一天，金額 0／空白略過。
 *
 * 記帳者一律是停用成員「系統」（不存在就建立，不能登入）；created_by 留 null＝系統產生。
 * 可重複執行：上一次塞入的資料也在清除範圍內，結果相同。
 * 須先跑過 db:push（sql/0003 的 created_by 欄位）。
 */

const APPLY = process.argv.includes("--apply");
const YEAR = 2026;
const RANGE = { start: "2026-01-01", end: "2026-10-01" };
const NOTE_SUFFIX = "（系統匯入）";
const SYSTEM_MEMBER = { name: "系統", account: "system" };

type Line = { label: string; category: string; sub?: string; amounts: number[] };

/** 1～9 月 */
const LINES: Line[] = [
  { label: "薪資1", category: "薪資", sub: "部分月薪", amounts: [15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000] },
  { label: "薪資2", category: "薪資", sub: "部分月薪", amounts: [10000, 10001, 10000, 10000, 10000, 10000, 10000, 10000, 10000] },
  { label: "其它收入", category: "薪資", amounts: [31148, 0, 0, 0, 0, 0, 0, 0, 0] },
  { label: "食", category: "食", amounts: [15073, 10891, 18540, 17542, 15081, 13390, 17790, 17717, 14464] },
  { label: "健康", category: "健康", amounts: [3830, 0, 0, 100, 2488, 2928, 139, 6078, 9065] },
  { label: "育", category: "育", amounts: [0, 0, 0, 0, 1410, 0, 330, 0, 600] },
  { label: "樂", category: "樂", amounts: [12664, 660, 9385, 8379, 2536, 5681, 4585, 0, 10332] },
  { label: "網路", category: "訂閱", amounts: [1299, 1299, 1299, 1299, 1299, 1299, 1099, 1299, 1299] },
];

/** 年度額外開銷：不分攤到單月 */
const EXTRAS = [{ name: "健檢", category: "健康", amount: 9900 }];

const lastDayOf = (month: number) => new Date(Date.UTC(YEAR, month, 0)).toISOString().slice(0, 10);

// ── 讀取現況 ──────────────────────────────────────────────

const catRows = await db
  .select({ id: mainCategories.id, name: mainCategories.name, type: mainCategories.type })
  .from(mainCategories)
  .where(isNull(mainCategories.ownerId));
const subRows = await db
  .select({ id: subCategories.id, name: subCategories.name, mainCategoryId: subCategories.mainCategoryId })
  .from(subCategories);

const resolveCategory = (category: string, sub?: string) => {
  const main = catRows.find((c) => c.name === category);
  if (!main) throw new Error("找不到家庭帳分類「" + category + "」");
  const s = sub ? subRows.find((r) => r.mainCategoryId === main.id && r.name === sub) : undefined;
  if (sub && !s) throw new Error("找不到子分類「" + category + "／" + sub + "」");
  return { main, sub: s };
};

const inRange = and(
  isNull(transactions.ownerId),
  eq(transactions.isDeleted, false),
  gte(transactions.date, RANGE.start),
  lt(transactions.date, RANGE.end)
);
const oldTransactions = await db.select().from(transactions).where(inRange);
const oldExtras = await db.select().from(yearExtraExpenses).where(eq(yearExtraExpenses.year, YEAR));

const [existingSystem] = await db
  .select({ id: members.id, name: members.name, isActive: members.isActive })
  .from(members)
  .where(eq(members.account, SYSTEM_MEMBER.account))
  .limit(1);
if (existingSystem?.isActive) throw new Error("帳號 system 是啟用中的成員，不能當系統帳號，請先確認");

// 先把要塞入的資料算好（分類找不到會在這裡就失敗，不會清到一半）
const plannedRows = LINES.flatMap((line) => {
  const { main, sub } = resolveCategory(line.category, line.sub);
  return line.amounts.flatMap((amount, i) =>
    amount > 0
      ? [
          {
            type: main.type,
            mainCategoryId: main.id,
            subCategoryId: sub?.id ?? null,
            amount,
            date: lastDayOf(i + 1),
            note: line.label + NOTE_SUFFIX,
            mainCategoryName: main.name,
            subCategoryName: sub?.name ?? null,
          },
        ]
      : []
  );
});
const plannedExtras = EXTRAS.map((e) => ({
  year: YEAR,
  name: e.name,
  amount: e.amount,
  mainCategoryId: resolveCategory(e.category).main.id,
}));

// ── 報告 ─────────────────────────────────────────────────

const sum = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0);
const byType = (rows: { type: string; amount: number }[], type: string) => sum(rows.filter((r) => r.type === type));

console.log(APPLY ? "【執行模式】" : "【試算模式】加上 --apply 才會寫入");
console.log(
  "清除：交易 " + oldTransactions.length + " 筆（收入 " + byType(oldTransactions, "income") +
    "、支出 " + byType(oldTransactions, "expense") + "，其中訂閱產生 " +
    oldTransactions.filter((t) => t.sourceSubscriptionId != null).length + " 筆）；" +
    YEAR + " 年度額外開銷 " + oldExtras.length + " 筆（" + sum(oldExtras) + "）"
);
console.log(
  "塞入：交易 " + plannedRows.length + " 筆（收入 " + byType(plannedRows, "income") +
    "、支出 " + byType(plannedRows, "expense") + "）；年度額外開銷 " + plannedExtras.length +
    " 筆（" + sum(plannedExtras) + "）"
);
console.log(
  "記帳者：「" + SYSTEM_MEMBER.name + "」" + (existingSystem ? "（沿用既有成員 #" + existingSystem.id + "）" : "（將新建，停用、不能登入）")
);

if (!APPLY) {
  await sql.end();
  process.exit(0);
}

// ── 備份 ─────────────────────────────────────────────────

const backupDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../backups");
await mkdir(backupDir, { recursive: true });
const backupFile = resolve(backupDir, "force-import-2026-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json");
await writeFile(backupFile, JSON.stringify({ transactions: oldTransactions, yearExtraExpenses: oldExtras }, null, 2));
console.log("已備份要清除的資料：" + backupFile);

// ── 寫入（同一個 transaction） ────────────────────────────

await db.transaction(async (tx) => {
  let systemId = existingSystem?.id;
  if (!systemId) {
    const [created] = await tx
      .insert(members)
      .values({
        name: SYSTEM_MEMBER.name,
        account: SYSTEM_MEMBER.account,
        role: "member",
        color: "#8b857c",
        joinedMonth: "2026-01",
        isActive: false,
        passwordHash: null,
      })
      .returning({ id: members.id });
    systemId = created!.id;
  }

  await tx.update(transactions).set({ isDeleted: true }).where(inRange);
  await tx.delete(yearExtraExpenses).where(eq(yearExtraExpenses.year, YEAR));

  await tx.insert(transactions).values(plannedRows.map((r) => ({ ...r, payerId: systemId!, createdBy: null })));
  await tx.insert(yearExtraExpenses).values(plannedExtras.map((e) => ({ ...e, payerId: systemId! })));
});

console.log("完成。");
await sql.end();
