import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DashboardPayload, MainCategory, TransactionView } from "@family-ledger/shared";
import { api, freezeToday, reseed } from "./helpers.js";

/**
 * 個人帳第 1 批：個人交易。
 * - 每位成員（含一般成員）都有自己的個人帳，而且只看得到自己的。
 * - 個人交易不算進家庭帳；別人的個人交易當作不存在（404），管理者也一樣。
 * - 個人帳與角色無關：改角色不影響看得到自己的個人帳。
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
/** 個人帳第 2 批起個人交易只能用本人的個人分類 */
let dadFood: MainCategory;
let dadSalary: MainCategory;
let sisFood: MainCategory;

const createPersonalCategory = async (
  body: { name: string; type: "expense" | "income"; nature: "floating" | null },
  as: "dad" | "sis" = "dad"
) => {
  const res = await api<MainCategory>("/categories?scope=personal", {
    method: "POST",
    as,
    body: { icon: "category", ...body },
  });
  expect(res.status).toBe(201);
  return res.body;
};

beforeAll(async () => {
  for (const path of FAMILY_ENDPOINTS) familyBefore[path] = (await api(path)).body;

  dadFood = await createPersonalCategory({ name: "午餐", type: "expense", nature: "floating" });
  dadSalary = await createPersonalCategory({ name: "薪資", type: "income", nature: null });
  sisFood = await createPersonalCategory({ name: "點心", type: "expense", nature: "floating" }, "sis");

  const lunch = await api<TransactionView>("/transactions", {
    method: "POST",
    body: { type: "expense", mainCategoryId: dadFood.id, subCategoryId: null, amount: 380, date: "2026-09-02", scope: "personal" },
  });
  const bonus = await api<TransactionView>("/transactions", {
    method: "POST",
    body: { type: "income", mainCategoryId: dadSalary.id, subCategoryId: null, amount: 5000, date: "2026-09-04", scope: "personal" },
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

  it("一般成員也有自己的個人帳；管理者看不到、改不了", async () => {
    const create = await api<TransactionView>("/transactions", {
      method: "POST",
      as: "sis",
      body: { type: "expense", mainCategoryId: sisFood.id, subCategoryId: null, amount: 100, date: "2026-09-02", scope: "personal" },
    });
    expect(create.status).toBe(201);
    expect(create.body).toMatchObject({ ownerId: 3, payerId: 3 });

    const mine = await api<Paged>("/transactions?month=2026-09&scope=personal", { as: "sis" });
    expect(mine.body.items.map((t) => t.id)).toEqual([create.body.id]);

    const dads = await api<Paged>("/transactions?month=2026-09&scope=personal");
    expect(dads.body.items.map((t) => t.id)).not.toContain(create.body.id);
    expect((await api(`/transactions/${create.body.id}`, { method: "PATCH", body: { amount: 1 } })).status).toBe(404);
    expect((await api(`/transactions/${create.body.id}`, { method: "DELETE" })).status).toBe(404);
  });

  it("個人帳不能代記他人，個人交易也不能更換記帳者", async () => {
    const create = await api("/transactions", {
      method: "POST",
      body: { type: "expense", mainCategoryId: dadFood.id, subCategoryId: null, amount: 1, date: "2026-09-01", scope: "personal", payerId: 2 },
    });
    expect(create.status).toBe(400);

    const patch = await api(`/transactions/${dadLunch.id}`, { method: "PATCH", body: { payerId: 2 } });
    expect(patch.status).toBe(400);
  });

  it("分類不能跨帳本：個人交易不能用家庭分類，家庭交易也不能用個人分類", async () => {
    const personalWithFamilyCat = await api("/transactions", {
      method: "POST",
      body: { type: "expense", mainCategoryId: 1, subCategoryId: null, amount: 1, date: "2026-09-02", scope: "personal" },
    });
    expect(personalWithFamilyCat.status).toBe(400);

    const familyWithPersonalCat = await api("/transactions", {
      method: "POST",
      body: { type: "expense", mainCategoryId: dadFood.id, subCategoryId: null, amount: 1, date: "2026-09-02" },
    });
    expect(familyWithPersonalCat.status).toBe(400);

    // 修改時也不能把個人交易改成家庭分類
    const patch = await api(`/transactions/${dadLunch.id}`, { method: "PATCH", body: { mainCategoryId: 1 } });
    expect(patch.status).toBe(400);
  });

  it("不能用別人的個人分類", async () => {
    const res = await api("/transactions", {
      method: "POST",
      body: { type: "expense", mainCategoryId: sisFood.id, subCategoryId: null, amount: 1, date: "2026-09-02", scope: "personal" },
    });
    expect(res.status).toBe(400);
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
    expect(body.categories.find((c) => c.id === dadFood.id)?.spent).toBe(380);
    // 個人首頁的分類卡片只列本人的個人分類，不會出現家庭分類
    expect(body.categories.some((c) => c.id === 1)).toBe(false);
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

describe("個人帳與角色無關", () => {
  it("被改成一般成員仍看得到自己的個人帳", async () => {
    await sql`update members set role = 'member' where id = 1`;
    try {
      const { body } = await api<Paged>("/transactions?month=2026-09&scope=personal");
      expect(body.items.map((t) => t.id)).toContain(dadLunch.id);
    } finally {
      await sql`update members set role = 'admin' where id = 1`;
    }
  });
});
