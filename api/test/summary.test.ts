import { beforeAll, describe, expect, it } from "vitest";
import type { DashboardPayload } from "@family-ledger/shared";
import { api, freezeToday } from "./helpers.js";

/**
 * 加總類 API 的快照：seed 資料 + 固定「今天」= 2026-09-15。
 * 快照記錄的是目前的計算結果；數字經人工核對後，它就是之後重構（例如個人帳第 0 批）的對照組。
 * 改到計算邏輯、快照不同時，先確認新數字是對的，再用 `pnpm test -u` 更新。
 */
beforeAll(() => freezeToday());

describe("GET /summary/dashboard", () => {
  it("本月（9 月）", async () => {
    const res = await api<DashboardPayload>("/summary/dashboard?month=2026-09");
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
  });

  it("上月（8 月）", async () => {
    const res = await api<DashboardPayload>("/summary/dashboard?month=2026-08");
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
  });

  it("淨結餘 = 總收入 − 總支出", async () => {
    const { body } = await api<DashboardPayload>("/summary/dashboard?month=2026-09");
    expect(body.summary.net).toBe(body.summary.income - body.summary.expense);
  });

  it("未來日期的支出只算進「已排定」，不算進已花費", async () => {
    const { body } = await api<DashboardPayload>("/summary/dashboard?month=2026-09");
    const future = body.recent.filter((t) => t.type === "expense" && t.date > "2026-09-15");
    expect(future.length).toBeGreaterThan(0);
    const scheduledFromCards = body.categories.reduce((sum, c) => sum + c.scheduled, 0);
    expect(scheduledFromCards).toBeLessThanOrEqual(body.summary.scheduledExpense);
    expect(body.summary.scheduledExpense).toBeGreaterThan(0);
  });

  it("8 月新增的「教育」出現在 9 月、「健康」7 月停用後不出現", async () => {
    const { body } = await api<DashboardPayload>("/summary/dashboard?month=2026-09");
    const names = body.categories.map((c) => c.name);
    expect(names).toContain("教育");
    expect(names).not.toContain("健康");
  });

  it("一般成員也看得到首頁", async () => {
    const res = await api("/summary/dashboard?month=2026-09", { as: "sis" });
    expect(res.status).toBe(200);
  });
});

describe("GET /summary/stats", () => {
  it("月統計 · 全家", async () => {
    const res = await api("/summary/stats?range=month&period=2026-09");
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
  });

  it("月統計 · 只看先生", async () => {
    const res = await api("/summary/stats?range=month&period=2026-09&payerId=1");
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
  });

  it("年統計 · 全家", async () => {
    const res = await api("/summary/stats?range=year&period=2026");
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
  });

  it("月份與 range 不符時回 400", async () => {
    const res = await api("/summary/stats?range=month&period=2026");
    expect(res.status).toBe(400);
  });
});

describe("GET /summary/year", () => {
  it("2026 年度彙整", async () => {
    const res = await api("/summary/year?year=2026");
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
  });
});

describe("GET /budgets", () => {
  it("9 月預算", async () => {
    const res = await api("/budgets?month=2026-09");
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
  });

  it("9 月固定支出總額（訂閱月換算，年繳 ÷12）", async () => {
    const res = await api("/budgets/fixed-total?month=2026-09");
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
  });
});

describe("GET /transactions", () => {
  it("9 月第 1 頁", async () => {
    const res = await api("/transactions?month=2026-09");
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
  });

  it("依記帳者篩選", async () => {
    const res = await api<{ items: { payerId: number }[] }>("/transactions?month=2026-09&payerId=2");
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((t) => t.payerId === 2)).toBe(true);
  });
});

it("沒帶 token 回 401", async () => {
  const { app } = await import("../src/app.js");
  const res = await app.request("/api/summary/dashboard?month=2026-09");
  expect(res.status).toBe(401);
});
