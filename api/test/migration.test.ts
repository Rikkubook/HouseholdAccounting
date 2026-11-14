import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { reseed } from "./helpers.js";

/**
 * sql/ 的 migration：db:push 每次都從 0000 依序重跑到最後一支，每一支都必須能在「已經跑過後面幾支」
 * 的資料庫上重跑。0001 曾在已有個人「訂閱」系統分類的正式資料庫上失敗（2026-11），這裡鎖住。
 */
const sqlDir = resolve(import.meta.dirname, "../sql");
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const file = (name: string) => readFileSync(resolve(sqlDir, name), "utf8");
const migration0001 = file("0001_subscription_category.sql");
const migration0002 = file("0002_owner_columns.sql");
const runAll = async () => {
  for (const f of readdirSync(sqlDir).filter((f) => f.endsWith(".sql")).sort()) await sql.unsafe(file(f));
};

afterAll(async () => {
  // 0001 的舊資料測試會把資料庫做回 0002 以前；跑回 0002 恢復每人各自的系統分類索引
  await sql.unsafe(migration0002);
  await sql.end();
  reseed();
});

describe("db:push 可以在目前的資料庫上重跑", () => {
  it("已有多位成員各自的「訂閱」系統分類：全部 migration 重跑不出錯，個人訂閱不會被搬進家庭帳", async () => {
    const [personalCat] = await sql<{ id: number }[]>`
      insert into main_categories (name, icon, type, nature, sort_order, is_system, system_key, owner_id)
      values ('訂閱', 'autorenew', 'expense', 'fixed', 99, true, 'subscription', 1) returning id`;
    const [personalSub] = await sql<{ id: number }[]>`
      insert into subscriptions (name, amount, cycle, next_charge_date, charge_day, main_category_id, payer_id)
      values ('個人影音', 150, 'monthly', '2026-12-01', 1, ${personalCat!.id}, 1) returning id`;

    await runAll();
    await runAll();

    const [sub] = await sql`select main_category_id from subscriptions where id = ${personalSub!.id}`;
    expect(sub!.main_category_id).toBe(personalCat!.id);
    // 舊的「全表只能一個」索引不會被 0001 建回來
    const old = await sql`select 1 from pg_indexes where indexname = 'main_categories_system_key_idx'`;
    expect(old.length).toBe(0);

    await sql`delete from subscriptions where id = ${personalSub!.id}`;
    await sql`delete from main_categories where id = ${personalCat!.id}`;
  });
});

describe("0001：0002 以前的舊資料庫才做一次性轉換", () => {
  /** 做回 0002 以前：沒有每人各自的系統分類索引（0001 依此判斷要不要轉換） */
  const toPre0002 = () => sql`drop index if exists main_categories_owner_system_key_idx`;

  it("舊資料：「訂閱」設為系統分類，散落在其他分類的訂閱搬進來；可重複執行", async () => {
    // 舊狀態：沒有 system_key、「訂閱」不是系統分類、健身房掛「健康」、新聞掛「育樂」
    await toPre0002();
    await sql`update main_categories set system_key = null`;
    await sql`update main_categories set is_system = false where name = '訂閱'`;
    await sql`update subscriptions set main_category_id = 5 where name = '健身房會員'`;
    await sql`update subscriptions set main_category_id = 6 where name = '新聞訂閱'`;

    await sql.unsafe(migration0001);
    await sql.unsafe(migration0001);

    const cats = await sql`select id, name, is_system, system_key from main_categories where system_key is not null order by id`;
    expect(cats.map((c) => [c.name, c.is_system, c.system_key])).toEqual([
      ["訂閱", true, "subscription"],
      ["其他", true, "other"],
    ]);
    const subscriptionCategoryId = cats[0]!.id;

    const subs = await sql`select name, main_category_id from subscriptions`;
    expect(subs.every((s) => s.main_category_id === subscriptionCategoryId)).toBe(true);

    // 已產生的交易不動：分類名稱快照保留原樣
    const [snapshot] = await sql<{ count: number }[]>`
      select count(*)::int as count from transactions where main_category_name = '健康'`;
    expect(snapshot!.count).toBeGreaterThan(0);
  });

  it("沒有「訂閱」分類的資料庫會自動建立一個", async () => {
    await toPre0002();
    await sql`update main_categories set system_key = null, is_system = false where name = '訂閱'`;
    await sql`update main_categories set name = '月費' where name = '訂閱'`;

    await sql.unsafe(migration0001);

    const rows = await sql`select name, nature, is_system from main_categories where system_key = 'subscription'`;
    expect(rows).toEqual([{ name: "訂閱", nature: "fixed", is_system: true }]);
    const [result] = await sql<{ moved: boolean }[]>`
      select bool_and(main_category_id = (select id from main_categories where system_key = 'subscription')) as moved
        from subscriptions`;
    expect(result!.moved).toBe(true);
  });
});
