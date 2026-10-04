import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MainCategory, Subscription } from "@family-ledger/shared";
import { api, freezeToday, reseed } from "./helpers.js";

/**
 * 訂閱的規則：
 * 1. 一律歸屬系統分類「訂閱」（不可停用、不可改名），不接受前端指定分類。
 * 2. 停用後攤提到已繳期間結束：
 *    月繳：10/5 已扣、10/25 停用（下次扣款 11/5）→ 10 月照算，11 月起不算。
 *    年繳：2026/5/1 繳一年（下次扣款 2027/5/1）→ 算到 2027 年 4 月，5 月起不算。
 */
beforeAll(() => freezeToday());
afterAll(() => reseed());

let subscriptionCategory: MainCategory;

beforeAll(async () => {
  const { body } = await api<MainCategory[]>("/categories");
  subscriptionCategory = body.find((c) => c.systemKey === "subscription")!;
});

const fixedTotal = async (month: string) =>
  (await api<{ amount: number }>("/budgets/fixed-total?month=" + month)).body.amount;

async function createSubscription(draft: Record<string, unknown>) {
  const res = await api<Subscription>("/subscriptions", { method: "POST", body: { payerId: 1, ...draft } });
  expect(res.status).toBe(201);
  return res.body;
}

const deactivate = (id: number) =>
  api<Subscription>(`/subscriptions/${id}/active`, { method: "POST", body: { isActive: false } });

describe("訂閱只能歸屬「訂閱」分類", () => {
  it("「訂閱」是系統分類", () => {
    expect(subscriptionCategory).toMatchObject({ name: "訂閱", isSystem: true, nature: "fixed" });
  });

  it("seed 的訂閱全部在「訂閱」分類", async () => {
    const { body } = await api<Subscription[]>("/subscriptions");
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((s) => s.mainCategoryId === subscriptionCategory.id)).toBe(true);
  });

  it("新增時就算帶了其他分類，也會歸到「訂閱」", async () => {
    const sub = await createSubscription({
      name: "網路費",
      amount: 999,
      cycle: "monthly",
      nextChargeDate: "2026-10-05",
      mainCategoryId: 3,
    });
    expect(sub.mainCategoryId).toBe(subscriptionCategory.id);
  });

  it("修改時帶分類會被忽略", async () => {
    const sub = await createSubscription({ name: "影音二號", amount: 270, cycle: "monthly", nextChargeDate: "2026-10-01" });
    const res = await api<Subscription>(`/subscriptions/${sub.id}`, {
      method: "PATCH",
      body: { name: "影音二號（家庭方案）", mainCategoryId: 3 },
    });
    expect(res.status).toBe(200);
    expect(res.body.mainCategoryId).toBe(subscriptionCategory.id);
  });

  it("「訂閱」分類不能停用", async () => {
    const res = await api<{ code: string }>(`/categories/${subscriptionCategory.id}/archive`, { method: "POST" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("system_category");
  });

  it("「訂閱」分類不能改名", async () => {
    const res = await api<{ code: string }>(`/categories/${subscriptionCategory.id}`, {
      method: "PATCH",
      body: { name: "固定月費" },
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("system_category");
  });
});

describe("停用後攤提到已繳期間結束", () => {
  it("月繳：10/25 停用、下次扣款 11/5 → 10 月照算，11 月起不算", async () => {
    const before = { oct: await fixedTotal("2026-10"), nov: await fixedTotal("2026-11") };
    const sub = await createSubscription({ name: "月繳測試", amount: 500, cycle: "monthly", nextChargeDate: "2026-11-05" });
    expect((await deactivate(sub.id)).status).toBe(200);

    expect((await fixedTotal("2026-10")) - before.oct).toBe(500);
    expect((await fixedTotal("2026-11")) - before.nov).toBe(0);
  });

  it("年繳：5/1 繳一年、下次扣款隔年 5/1 → 攤提到隔年 4 月，5 月起不算", async () => {
    const before = { apr: await fixedTotal("2027-04"), may: await fixedTotal("2027-05") };
    const sub = await createSubscription({ name: "年繳測試", amount: 2000, cycle: "yearly", nextChargeDate: "2027-05-01" });
    expect((await deactivate(sub.id)).status).toBe(200);

    // 2000 ÷ 12 = 166.67，四捨五入到元
    expect((await fixedTotal("2027-04")) - before.apr).toBe(167);
    expect((await fixedTotal("2027-05")) - before.may).toBe(0);
  });

  it("停用的訂閱不能標記扣款", async () => {
    const sub = await createSubscription({ name: "停用測試", amount: 100, cycle: "monthly", nextChargeDate: "2026-09-10" });
    await deactivate(sub.id);
    const res = await api(`/subscriptions/${sub.id}/mark-paid`, { method: "POST" });
    expect(res.status).toBe(400);
  });
});
