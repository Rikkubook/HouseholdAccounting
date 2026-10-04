import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { afterAll, expect, it } from "vitest";
import { reseed } from "./helpers.js";

/**
 * sql/0001：把正式資料庫從「訂閱可掛任何分類」轉成「只能歸屬系統分類『訂閱』」。
 * 先把資料庫做回舊狀態，再執行 migration 檢查結果；也確認重複執行不會出錯。
 */
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const migration = readFileSync(resolve(import.meta.dirname, "../sql/0001_subscription_category.sql"), "utf8");

afterAll(async () => {
  await sql.end();
  reseed();
});

it("舊資料：「訂閱」設為系統分類，散落在其他分類的訂閱搬進來；可重複執行", async () => {
  // 舊狀態：沒有 system_key、「訂閱」不是系統分類、健身房掛「健康」、新聞掛「育樂」
  await sql`update main_categories set system_key = null`;
  await sql`update main_categories set is_system = false where name = '訂閱'`;
  await sql`update subscriptions set main_category_id = 5 where name = '健身房會員'`;
  await sql`update subscriptions set main_category_id = 6 where name = '新聞訂閱'`;

  await sql.unsafe(migration);
  await sql.unsafe(migration);

  const cats = await sql`select id, name, is_system, system_key from main_categories where system_key is not null order by id`;
  expect(cats.map((c) => [c.name, c.is_system, c.system_key])).toEqual([
    ["訂閱", true, "subscription"],
    ["其他", true, "other"],
  ]);
  const subscriptionCategoryId = cats[0]!.id;

  const subs = await sql`select name, main_category_id from subscriptions`;
  expect(subs.every((s) => s.main_category_id === subscriptionCategoryId)).toBe(true);

  // 已產生的交易不動：分類名稱快照保留原樣
  const [{ count }] = await sql`select count(*)::int as count from transactions where main_category_name = '健康'`;
  expect(count).toBeGreaterThan(0);
});

it("沒有「訂閱」分類的資料庫會自動建立一個", async () => {
  await sql`update main_categories set system_key = null, is_system = false where name = '訂閱'`;
  await sql`update main_categories set name = '月費' where name = '訂閱'`;

  await sql.unsafe(migration);

  const rows = await sql`select name, nature, is_system from main_categories where system_key = 'subscription'`;
  expect(rows).toEqual([{ name: "訂閱", nature: "fixed", is_system: true }]);
  const [{ moved }] = await sql`
    select bool_and(main_category_id = (select id from main_categories where system_key = 'subscription')) as moved
      from subscriptions`;
  expect(moved).toBe(true);
});
