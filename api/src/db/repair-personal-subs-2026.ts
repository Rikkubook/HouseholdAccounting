import { readFile } from "node:fs/promises";
import { and, eq, inArray } from "drizzle-orm";
import { db, sql } from "./index.js";
import { mainCategories, subCategories, transactions } from "./schema.js";

/**
 * 補回 db:import-personal-2026 清掉的子項目。
 *
 * 舊版匯入把「記在家庭分類下的個人交易」搬到同名個人分類時，個人分類底下沒有同名子分類，
 * 就把子項目清空（例如「早餐」變成只剩「食」）。匯入當時的備份（api/backups/import-personal-2026-*.json）
 * 的 `moved` 存著搬移前的交易，含原本的子分類名稱，這支用它補回去。
 *
 *   pnpm db:repair-personal-subs-2026 --backup=api/backups/import-personal-2026-owner2-....json            只試算
 *   pnpm db:repair-personal-subs-2026 --backup=api/backups/import-personal-2026-owner2-....json --apply    真的執行
 *
 * 每一筆：交易已刪除、現在已經有子項目（可能已手動補過）、或搬到系統分類「其他」（不設子分類）的都跳過。
 * 個人分類底下沒有同名子分類就先建立。同一個 DB transaction，失敗整批還原；可重複執行。
 */

const APPLY = process.argv.includes("--apply");
const BACKUP = process.argv.find((a) => a.startsWith("--backup="))?.slice("--backup=".length);
if (!BACKUP) throw new Error("請用 --backup=<匯入時的備份檔路徑> 指定備份");

type MovedRow = { id: number; date: string; amount: number; mainCategoryName: string | null; subCategoryName: string | null };
const backup = JSON.parse(await readFile(BACKUP, "utf8")) as { moved?: MovedRow[] };
const moved = (backup.moved ?? []).filter((t) => t.subCategoryName);
console.log("備份裡搬移過的交易 " + (backup.moved?.length ?? 0) + " 筆，其中原本有子項目的 " + moved.length + " 筆");

const current = moved.length
  ? await db.select().from(transactions).where(inArray(transactions.id, moved.map((t) => t.id)))
  : [];
const mains = current.length
  ? await db
      .select()
      .from(mainCategories)
      .where(inArray(mainCategories.id, [...new Set(current.map((t) => t.mainCategoryId).filter((x): x is number => x != null))]))
  : [];

type Plan = { id: number; label: string; mainCategoryId: number; subName: string };
const plans: Plan[] = [];
const skipped: string[] = [];
for (const old of moved) {
  const t = current.find((x) => x.id === old.id);
  const label = old.date + " " + (t?.mainCategoryName ?? old.mainCategoryName) + "／" + old.subCategoryName + " " + old.amount;
  const main = mains.find((m) => m.id === t?.mainCategoryId);
  if (!t) skipped.push(label + "（交易不存在）");
  else if (t.isDeleted) skipped.push(label + "（已刪除）");
  else if (t.subCategoryId != null) skipped.push(label + "（已經有子項目「" + t.subCategoryName + "」）");
  else if (!main || main.isSystem) skipped.push(label + "（在系統分類「" + (main?.name ?? "—") + "」，不設子分類）");
  else plans.push({ id: t.id, label, mainCategoryId: main.id, subName: old.subCategoryName! });
}

console.log("\n要補回子項目：" + plans.length + " 筆");
for (const p of plans) console.log("  " + p.label);
if (skipped.length) {
  console.log("\n跳過：" + skipped.length + " 筆");
  for (const s of skipped) console.log("  " + s);
}

if (!APPLY) {
  console.log("\n只試算，沒有寫入。確認後加上 --apply 執行。");
  await sql.end();
  process.exit(0);
}

await db.transaction(async (tx) => {
  for (const p of plans) {
    let [sub] = await tx
      .select({ id: subCategories.id })
      .from(subCategories)
      .where(and(eq(subCategories.mainCategoryId, p.mainCategoryId), eq(subCategories.name, p.subName)))
      .limit(1);
    if (!sub) {
      const siblings = await tx.select({ id: subCategories.id }).from(subCategories).where(eq(subCategories.mainCategoryId, p.mainCategoryId));
      [sub] = await tx
        .insert(subCategories)
        .values({ mainCategoryId: p.mainCategoryId, name: p.subName, sortOrder: siblings.length + 1 })
        .returning({ id: subCategories.id });
    }
    await tx
      .update(transactions)
      .set({ subCategoryId: sub!.id, subCategoryName: p.subName })
      .where(eq(transactions.id, p.id));
  }
});

console.log("\n已補回 " + plans.length + " 筆的子項目。");
await sql.end();
