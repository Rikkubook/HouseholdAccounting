import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, freezeToday, reseed } from "./helpers.js";

/**
 * 個人帳第 0 批（sql/0002）：家庭帳的查詢一律只看 owner_id 為 null 的資料。
 * 驗法：先記下家庭帳每支 API 的回應，直接在資料庫塞進一整套個人帳資料
 * （交易、分類、預算、訂閱、年度額外支出），再打一次——回應必須一模一樣。
 * 有任何一處查詢漏套範圍條件，這裡就會抓到。
 */
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

const FAMILY_ENDPOINTS = [
  "/summary/dashboard?month=2026-09",
  "/summary/stats?range=month&period=2026-09",
  "/summary/stats?range=year&period=2026",
  "/summary/year?year=2026",
  "/budgets?month=2026-09",
  "/budgets/fixed-total?month=2026-09",
  "/transactions?month=2026-09",
  "/categories",
  "/subscriptions",
];

beforeAll(() => freezeToday());
afterAll(async () => {
  await sql.end();
  reseed();
});

describe("家庭帳不受個人帳資料影響", () => {
  it("塞進先生的個人帳資料後，家庭帳每支 API 回應完全相同", async () => {
    const before = await Promise.all(FAMILY_ENDPOINTS.map((path) => api(path)));
    expect(before.every((r) => r.status === 200)).toBe(true);

    // 先生（id 1）的個人分類：一般浮動支出 + 個人的「訂閱」系統分類
    const [personalFood] = await sql<{ id: number }[]>`
      insert into main_categories (name, icon, type, nature, sort_order, owner_id)
      values ('個人餐費', 'restaurant', 'expense', 'floating', 1, 1) returning id`;
    const [personalSub] = await sql<{ id: number }[]>`
      insert into main_categories (name, icon, type, nature, sort_order, is_system, system_key, owner_id)
      values ('訂閱', 'autorenew', 'expense', 'fixed', 2, true, 'subscription', 1) returning id`;

    // 個人交易：一筆用個人分類、一筆用家庭分類（第 1 批就是這樣），都落在 2026-09
    await sql`
      insert into transactions (type, main_category_id, amount, date, payer_id, owner_id, main_category_name)
      values ('expense', ${personalFood!.id}, 77777, '2026-09-02', 1, 1, '個人餐費'),
             ('expense', 1, 55555, '2026-09-03', 1, 1, '食'),
             ('income', 10, 33333, '2026-09-04', 1, 1, '薪資')`;
    await sql`insert into budgets (month, main_category_id, amount) values ('2026-09', ${personalFood!.id}, 9999)`;
    const [sub] = await sql<{ id: number }[]>`
      insert into subscriptions (name, amount, cycle, next_charge_date, charge_day, main_category_id, payer_id)
      values ('個人影音', 4321, 'monthly', '2026-10-01', 1, ${personalSub!.id}, 1) returning id`;
    await sql`
      insert into subscription_revisions (subscription_id, effective_from, amount, cycle)
      values (${sub!.id}, '2026-01', 4321, 'monthly')`;
    await sql`
      insert into year_extra_expenses (year, name, amount, main_category_id, payer_id)
      values (2026, '個人旅行', 66666, ${personalFood!.id}, 1)`;

    const after = await Promise.all(FAMILY_ENDPOINTS.map((path) => api(path)));
    FAMILY_ENDPOINTS.forEach((path, i) => {
      expect(after[i]!.body, path).toEqual(before[i]!.body);
    });
  });
});

describe("資料庫約束", () => {
  it("個人帳的 owner_id 必須等於記帳者", async () => {
    await expect(sql`
      insert into transactions (type, main_category_id, amount, date, payer_id, owner_id)
      values ('expense', 1, 100, '2026-09-01', 1, 2)`).rejects.toMatchObject({ code: "23514" });
  });

  it("家庭帳只能有一個「訂閱」系統分類", async () => {
    await expect(sql`
      insert into main_categories (name, icon, type, nature, sort_order, is_system, system_key)
      values ('訂閱二', 'autorenew', 'expense', 'fixed', 99, true, 'subscription')`).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("每位成員可以有自己的「訂閱」系統分類，但同一人只能一個", async () => {
    await sql`
      insert into main_categories (name, icon, type, nature, sort_order, is_system, system_key, owner_id)
      values ('訂閱', 'autorenew', 'expense', 'fixed', 1, true, 'subscription', 2)`;
    await expect(sql`
      insert into main_categories (name, icon, type, nature, sort_order, is_system, system_key, owner_id)
      values ('訂閱', 'autorenew', 'expense', 'fixed', 2, true, 'subscription', 2)`).rejects.toMatchObject({
      code: "23505",
    });
  });
});
