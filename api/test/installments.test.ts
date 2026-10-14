import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Subscription, TransactionView } from "@family-ledger/shared";
import { runDueCharges } from "../src/services/charges.js";
import { api, freezeToday, reseed } from "./helpers.js";

/**
 * 年繳拆月分攤（docs/requirements G-6）：
 * 年費拆成 12 期，自扣款月起每月一期，每期 = 年費 ÷ 12 取整數，餘數放最後一期；
 * 期中改價下一期才生效；停用後已付期間繼續分攤到期滿；期中不能改週期與扣款日。
 */
beforeAll(() => freezeToday());
afterAll(() => reseed());

type Paid = { subscription: Subscription; transaction: TransactionView };

async function createYearly(name: string, amount: number, nextChargeDate: string) {
  const res = await api<Subscription>("/subscriptions", {
    method: "POST",
    body: { name, amount, cycle: "yearly", nextChargeDate, payerId: 2 },
  });
  expect(res.status).toBe(201);
  return res.body;
}

const markPaid = (id: number) => api<Paid>(`/subscriptions/${id}/mark-paid`, { method: "POST" });

async function payAll(id: number, times: number): Promise<Paid[]> {
  const out: Paid[] = [];
  for (let i = 0; i < times; i++) {
    const res = await markPaid(id);
    expect(res.status).toBe(200);
    out.push(res.body);
  }
  return out;
}

const fixedTotal = async (month: string) =>
  (await api<{ amount: number }>("/budgets/fixed-total?month=" + month)).body.amount;

describe("年繳拆成每月一期", () => {
  it("新增年繳時記住扣款月", async () => {
    const sub = await createYearly("扣款月測試", 1200, "2026-10-05");
    expect(sub).toMatchObject({ chargeMonth: 10, periodAmount: null, chargeDay: 5 });
  });

  it("1,000 元拆成 11 期 83 + 最後一期 87，每月同一天，記帳者為扣款人", async () => {
    const sub = await createYearly("網路年繳", 1000, "2026-10-05");
    const paid = await payAll(sub.id, 12);

    const tx = paid.map((p) => p.transaction);
    expect(tx.map((t) => t.amount)).toEqual([...Array(11).fill(83), 87]);
    expect(tx.reduce((s, t) => s + t.amount, 0)).toBe(1000);
    expect(tx[0]).toMatchObject({ date: "2026-10-05", note: "網路年繳（年繳 1/12）", payerId: 2 });
    expect(tx[2]!.date).toBe("2026-12-05");
    expect(tx[11]).toMatchObject({ date: "2027-09-05", note: "網路年繳（年繳 12/12）" });

    // 12 期分完，下一期就是下一次實際年繳
    expect(paid[11]!.subscription.nextChargeDate).toBe("2027-10-05");
    expect(paid[0]!.subscription).toMatchObject({ nextChargeDate: "2026-11-05", periodAmount: 1000 });
  });

  it("扣款日 31 日：小月夾到月底，下一個大月回到 31 日", async () => {
    const sub = await createYearly("月底年繳", 1200, "2026-10-31");
    const paid = await payAll(sub.id, 3);
    expect(paid.map((p) => p.transaction.date)).toEqual(["2026-10-31", "2026-11-30", "2026-12-31"]);
  });

  it("期中改價格：本期照舊金額拆完，下一期才用新金額", async () => {
    const sub = await createYearly("改價測試", 1200, "2026-10-05");
    await payAll(sub.id, 1);

    const patched = await api<Subscription>(`/subscriptions/${sub.id}`, { method: "PATCH", body: { amount: 2400 } });
    expect(patched.status).toBe(200);

    const rest = await payAll(sub.id, 11);
    expect(rest.every((p) => p.transaction.amount === 100)).toBe(true);

    const [nextPeriod] = await payAll(sub.id, 1);
    expect(nextPeriod!.transaction).toMatchObject({ date: "2027-10-05", amount: 200, note: "改價測試（年繳 1/12）" });
  });
});

describe("停用後已付期間繼續分攤", () => {
  it("第 3 期後停用：仍可產生第 4～12 期，但不會開始新的一期", async () => {
    const sub = await createYearly("停用分攤", 1200, "2026-10-05");
    await payAll(sub.id, 3);
    const off = await api(`/subscriptions/${sub.id}/active`, { method: "POST", body: { isActive: false } });
    expect(off.status).toBe(200);

    const rest = await payAll(sub.id, 9);
    expect(rest.at(-1)!.transaction.note).toBe("停用分攤（年繳 12/12）");
    expect((await markPaid(sub.id)).status).toBe(400);
  });

  it("每日 Cron 也會補停用年繳的已付分攤，一次補一期", async () => {
    const sub = await createYearly("Cron 分攤", 1200, "2026-08-05");
    await payAll(sub.id, 1);
    await api(`/subscriptions/${sub.id}/active`, { method: "POST", body: { isActive: false } });

    const first = (await runDueCharges("2026-10-31")).filter((r) => r.subscriptionId === sub.id);
    expect(first).toEqual([expect.objectContaining({ date: "2026-09-05", amount: 100 })]);
    const second = (await runDueCharges("2026-10-31")).filter((r) => r.subscriptionId === sub.id);
    expect(second).toEqual([expect.objectContaining({ date: "2026-10-05", amount: 100 })]);
    const none = (await runDueCharges("2026-10-31")).filter((r) => r.subscriptionId === sub.id);
    expect(none).toEqual([]);
  });

  it("固定支出攤提到下一次年繳的前一個月", async () => {
    const before = { aug: await fixedTotal("2027-08"), sep: await fixedTotal("2027-09") };
    const sub = await createYearly("攤提測試", 2400, "2026-09-05");
    await payAll(sub.id, 2);
    await api(`/subscriptions/${sub.id}/active`, { method: "POST", body: { isActive: false } });

    expect((await fixedTotal("2027-08")) - before.aug).toBe(200);
    expect((await fixedTotal("2027-09")) - before.sep).toBe(0);
  });
});

describe("分攤期間不能改週期與扣款日", () => {
  it("改週期或扣款日回 400；不改這兩項、或帶原值都可以", async () => {
    const sub = await createYearly("期中修改", 1200, "2026-10-05");
    const [first] = await payAll(sub.id, 1);
    const next = first!.subscription.nextChargeDate;

    const cycle = await api<{ message: string }>(`/subscriptions/${sub.id}`, {
      method: "PATCH",
      body: { cycle: "monthly" },
    });
    expect(cycle.status).toBe(400);
    expect(cycle.body.message).toContain("下次年繳 2027-10-05");

    const date = await api(`/subscriptions/${sub.id}`, { method: "PATCH", body: { nextChargeDate: "2026-11-20" } });
    expect(date.status).toBe(400);

    const same = await api<Subscription>(`/subscriptions/${sub.id}`, {
      method: "PATCH",
      body: { name: "期中修改（改名）", cycle: "yearly", nextChargeDate: next },
    });
    expect(same.status).toBe(200);
    expect(same.body).toMatchObject({ chargeMonth: 10, nextChargeDate: next });
  });

  it("還沒開始分攤時可以改扣款日，扣款月跟著改", async () => {
    const sub = await createYearly("改扣款日", 1200, "2026-10-05");
    const res = await api<Subscription>(`/subscriptions/${sub.id}`, {
      method: "PATCH",
      body: { nextChargeDate: "2027-03-15" },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ chargeMonth: 3, chargeDay: 15 });
  });

  it("月繳改年繳：扣款月取下次扣款日；年繳改月繳：清掉年繳欄位", async () => {
    const monthly = await api<Subscription>("/subscriptions", {
      method: "POST",
      body: { name: "改週期", amount: 100, cycle: "monthly", nextChargeDate: "2026-12-08", payerId: 1 },
    });
    const toYearly = await api<Subscription>(`/subscriptions/${monthly.body.id}`, {
      method: "PATCH",
      body: { cycle: "yearly", amount: 1200 },
    });
    expect(toYearly.body).toMatchObject({ cycle: "yearly", chargeMonth: 12 });

    const back = await api<Subscription>(`/subscriptions/${monthly.body.id}`, {
      method: "PATCH",
      body: { cycle: "monthly", amount: 100 },
    });
    expect(back.body).toMatchObject({ cycle: "monthly", chargeMonth: null, periodAmount: null });
  });
});
