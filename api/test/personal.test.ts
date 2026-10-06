import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DashboardPayload, TransactionView } from "@family-ledger/shared";
import { api, freezeToday, reseed } from "./helpers.js";

/**
 * 個人帳第 1 批：個人交易。
 * - 只有管理者能用個人帳，而且只看得到自己的。
 * - 個人交易不算進家庭帳；別人的個人交易當作不存在（404），另一位管理者也一樣。
 * - 角色以當下為準：被降級的管理者看不到自己的個人帳，改回管理者就重新出現。
 */
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

beforeAll(() => freezeToday());
afterAll(async () => {
  await sql.end();
  reseed();
});

type Paged = { items: TransactionView[]; total: number };

const familyBefore: Record<string, unknown> = {};
const FAMILY_ENDPOINTS = [
  "/summary/dashboard?month=2026-09",
  "/summary/stats?range=month&period=2026-09",
  "/summary/year?year=2026",
  "/transactions?month=2026-09",
];

let dadLunch: TransactionView;
let dadBonus: TransactionView;

beforeAll(async () => {
  for (const path of FAMILY_ENDPOINTS) familyBefore[path] = (await api(path)).body;

  const lunch = await api<TransactionView>("/transactions", {
    method: "POST",
    body: { type: "expense", mainCategoryId: 1, subCategoryId: null, amount: 380, date: "2026-09-02", scope: "personal" },
  });
  const bonus = await api<TransactionView>("/transactions", {
    method: "POST",
    body: { type: "income", mainCategoryId: 10, subCategoryId: null, amount: 5000, date: "2026-09-04", scope: "personal" },
  });
  expect(lunch.status).toBe(201);
  expect(bonus.status).toBe(201);
  dadLunch = lunch.body;
  dadBonus = bonus.body;
});

describe("記個人帳", () => {
  it("記帳者與 owner 都是本人", () => {
    expect(dadLunch).toMatchObject({ ownerId: 1, payerId: 1, amount: 380 });
  });

  it("不帶 scope 預設記在家庭帳", async () => {
    const res = await api<TransactionView>("/transactions", {
      method: "POST",
      as: "mom",
      body: { type: "expense", mainCategoryId: 1, subCategoryId: null, amount: 1, date: "2026-09-01" },
    });
    expect(res.status).toBe(201);
    expect(res.body.ownerId).toBeNull();
    await api(`/transactions/${res.body.id}`, { method: "DELETE", as: "mom" });
  });

  it("一般成員不能記個人帳，也不能查", async () => {
    const create = await api("/transactions", {
      method: "POST",
      as: "sis",
      body: { type: "expense", mainCategoryId: 1, subCategoryId: null, amount: 100, date: "2026-09-02", scope: "personal" },
    });
    expect(create.status).toBe(403);
    expect((await api("/transactions?scope=personal", { as: "sis" })).status).toBe(403);
    expect((await api("/summary/dashboard?month=2026-09&scope=personal", { as: "sis" })).status).toBe(403);
  });

  it("個人分類要到第 2 批才開放", async () => {
    const [cat] = await sql<{ id: number }[]>`
      insert into main_categories (name, icon, type, nature, sort_order, owner_id)
      values ('個人分類', 'category', 'expense', 'floating', 1, 1) returning id`;
    const res = await api("/transactions", {
      method: "POST",
      body: { type: "expense", mainCategoryId: cat!.id, subCategoryId: null, amount: 1, date: "2026-09-02", scope: "personal" },
    });
    expect(res.status).toBe(400);
    await sql`delete from main_categories where id = ${cat!.id}`;
  });
});

describe("家庭帳與個人帳互不影響", () => {
  it("家庭帳的首頁、統計、年度、交易列表完全不變", async () => {
    for (const path of FAMILY_ENDPOINTS) {
      expect((await api(path)).body, path).toEqual(familyBefore[path]);
    }
  });

  it("個人交易列表只有自己的個人交易", async () => {
    const { body } = await api<Paged>("/transactions?month=2026-09&scope=personal");
    expect(body.items.map((t) => t.id).sort()).toEqual([dadLunch.id, dadBonus.id].sort());
  });

  it("另一位管理者的個人帳看不到先生的交易", async () => {
    const { body } = await api<Paged>("/transactions?month=2026-09&scope=personal", { as: "mom" });
    expect(body.total).toBe(0);
  });

  it("個人首頁只算個人交易；沒有預算、沒有固定支出", async () => {
    const { body } = await api<DashboardPayload>("/summary/dashboard?month=2026-09&scope=personal");
    expect(body.summary).toMatchObject({ income: 5000, expense: 380, net: 4620, fixedTotal: 0, scheduledExpense: 0 });
    expect(body.categories.every((c) => c.budget === null)).toBe(true);
    expect(body.categories.find((c) => c.id === 1)?.spent).toBe(380);
    expect(body.recent.map((t) => t.id).sort()).toEqual([dadLunch.id, dadBonus.id].sort());
  });

  it("個人統計與年度彙整只算個人交易", async () => {
    const stats = await api<{ total: number }>("/summary/stats?range=month&period=2026-09&scope=personal");
    expect(stats.body.total).toBe(380);
    const year = await api<{ income: number; expense: number; extras: unknown[] }>("/summary/year?year=2026&scope=personal");
    expect(year.body).toMatchObject({ income: 5000, expense: 380, extras: [] });
  });
});

describe("別人的個人交易當作不存在", () => {
  it("另一位管理者不能改、不能刪、不能看修改紀錄（404）", async () => {
    const opts = { as: "mom" as const };
    expect((await api(`/transactions/${dadLunch.id}`, { ...opts, method: "PATCH", body: { amount: 1 } })).status).toBe(404);
    expect((await api(`/transactions/${dadLunch.id}`, { ...opts, method: "DELETE" })).status).toBe(404);
    expect((await api(`/transactions/${dadLunch.id}/revisions`, opts)).status).toBe(404);
  });

  it("本人可以修改；改動不會把交易搬到家庭帳", async () => {
    const res = await api<TransactionView>(`/transactions/${dadLunch.id}`, {
      method: "PATCH",
      body: { amount: 420, scope: "family" },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ amount: 420, ownerId: 1 });
    expect((await api(`/transactions/${dadLunch.id}/revisions`)).status).toBe(200);
  });
});

describe("角色以當下為準", () => {
  it("被降級成一般成員就看不到自己的個人帳，改回管理者後重新出現", async () => {
    await sql`update members set role = 'member' where id = 1`;
    expect((await api("/transactions?scope=personal")).status).toBe(403);
    expect((await api(`/transactions/${dadLunch.id}`, { method: "PATCH", body: { amount: 1 } })).status).toBe(404);

    await sql`update members set role = 'admin' where id = 1`;
    const { body } = await api<Paged>("/transactions?month=2026-09&scope=personal");
    expect(body.items.map((t) => t.id)).toContain(dadLunch.id);
  });
});
