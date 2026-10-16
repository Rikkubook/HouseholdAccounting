import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MainCategory, Subscription } from "@family-ledger/shared";
import { api, freezeToday, reseed } from "./helpers.js";

/**
 * 訂閱的規則：
 * 1. 預設記在系統分類「訂閱」（不可停用、不可改名）；也可以選同一本帳、啟用中的固定支出分類。
 *    分類停用時，底下的訂閱自動改回「訂閱」。
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

describe("訂閱的分類", () => {
  // seed：3「住」是浮動支出、8「保險」是固定支出（都是家庭分類）
  const FLOATING = 3;
  const FIXED = 8;

  it("「訂閱」是系統分類", () => {
    expect(subscriptionCategory).toMatchObject({ name: "訂閱", isSystem: true, nature: "fixed" });
  });

  it("seed 的訂閱全部在「訂閱」分類", async () => {
    const { body } = await api<Subscription[]>("/subscriptions");
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((s) => s.mainCategoryId === subscriptionCategory.id)).toBe(true);
  });

  it("沒指定分類就記在「訂閱」", async () => {
    const sub = await createSubscription({ name: "網路費", amount: 999, cycle: "monthly", nextChargeDate: "2026-10-05" });
    expect(sub.mainCategoryId).toBe(subscriptionCategory.id);
  });

  it("可以選同一本帳的固定支出分類，扣款交易記在那個分類", async () => {
    const sub = await createSubscription({
      name: "車險月繳",
      amount: 1500,
      cycle: "monthly",
      nextChargeDate: "2026-10-05",
      mainCategoryId: FIXED,
    });
    expect(sub.mainCategoryId).toBe(FIXED);
    const paid = await api<{ transaction: { mainCategoryId: number; mainCategoryName: string } }>(
      `/subscriptions/${sub.id}/mark-paid`,
      { method: "POST" }
    );
    expect(paid.status).toBe(200);
    expect(paid.body.transaction).toMatchObject({ mainCategoryId: FIXED, mainCategoryName: "保險" });
  });

  it("浮動支出分類不能選", async () => {
    const res = await api("/subscriptions", {
      method: "POST",
      body: { payerId: 1, name: "早餐訂閱", amount: 100, cycle: "monthly", nextChargeDate: "2026-10-05", mainCategoryId: FLOATING },
    });
    expect(res.status).toBe(400);
  });

  it("只能選同一本帳的分類：家庭訂閱不能記到個人分類，反之亦然", async () => {
    const personal = await api<MainCategory>("/categories?scope=personal", {
      method: "POST",
      body: { name: "我的固定費", icon: "category", type: "expense", nature: "fixed" },
    });
    expect(personal.status).toBe(201);
    const res = await api("/subscriptions", {
      method: "POST",
      body: { payerId: 1, name: "跨帳本", amount: 100, cycle: "monthly", nextChargeDate: "2026-10-05", mainCategoryId: personal.body.id },
    });
    expect(res.status).toBe(400);

    // 個人訂閱則可以記到自己的固定支出分類（例如共同費），但不能記到家庭分類
    const mine = await api<Subscription>("/subscriptions?scope=personal", {
      method: "POST",
      body: { payerId: 1, name: "共同費", amount: 10000, cycle: "monthly", nextChargeDate: "2026-10-05", mainCategoryId: personal.body.id },
    });
    expect(mine.status).toBe(201);
    expect(mine.body.mainCategoryId).toBe(personal.body.id);
    const toFamily = await api("/subscriptions?scope=personal", {
      method: "POST",
      body: { payerId: 1, name: "記到家庭", amount: 100, cycle: "monthly", nextChargeDate: "2026-10-05", mainCategoryId: FIXED },
    });
    expect(toFamily.status).toBe(400);
  });

  it("修改時可以換分類，但同樣只能換到固定支出分類", async () => {
    const sub = await createSubscription({ name: "影音二號", amount: 270, cycle: "monthly", nextChargeDate: "2026-10-01" });
    const ok = await api<Subscription>(`/subscriptions/${sub.id}`, { method: "PATCH", body: { mainCategoryId: FIXED } });
    expect(ok.status).toBe(200);
    expect(ok.body.mainCategoryId).toBe(FIXED);
    const bad = await api(`/subscriptions/${sub.id}`, { method: "PATCH", body: { mainCategoryId: FLOATING } });
    expect(bad.status).toBe(400);
  });

  it("分類停用時，底下的訂閱改回「訂閱」；停用的分類不能再選", async () => {
    const sub = await createSubscription({
      name: "壽險月繳",
      amount: 2000,
      cycle: "monthly",
      nextChargeDate: "2026-10-05",
      mainCategoryId: FIXED,
    });
    expect((await api(`/categories/${FIXED}/archive`, { method: "POST" })).status).toBe(200);
    const { body } = await api<Subscription[]>("/subscriptions");
    expect(body.find((s) => s.id === sub.id)!.mainCategoryId).toBe(subscriptionCategory.id);
    expect(body.some((s) => s.mainCategoryId === FIXED)).toBe(false);

    const res = await api("/subscriptions", {
      method: "POST",
      body: { payerId: 1, name: "停用分類", amount: 100, cycle: "monthly", nextChargeDate: "2026-10-05", mainCategoryId: FIXED },
    });
    expect(res.status).toBe(400);
    await api(`/categories/${FIXED}/restore`, { method: "POST" });
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
