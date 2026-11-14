import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StatsPayload, YearSummaryPayload } from "@family-ledger/shared";
import { api, freezeToday, reseed } from "./helpers.js";

/**
 * 年度額外開銷的付款日期（sql/0006）：
 * - 新增必填、必須在該年度內；舊資料可為 null（當作該年 1/1）。
 * - 統計 API 依付款日期把年度額外開銷放進 extras（不算進 total／分類統計），供支出比例卡片標示。
 * 「今天」固定為 2026-09-15。
 */
beforeAll(() => freezeToday());
afterAll(() => reseed());

const create = (body: Record<string, unknown>) =>
  api<{ id: number; paidOn: string | null; code?: string }>("/summary/year-extras", {
    method: "POST",
    body: { year: 2026, name: "汽車保養", amount: 12000, mainCategoryId: 4, payerId: 1, ...body },
  });
const stats = (query: string) => api<StatsPayload>("/summary/stats?" + query);

describe("新增與修改", () => {
  it("付款日期必填", async () => {
    expect((await create({})).status).toBe(400);
  });

  it("付款日期必須在該年度內", async () => {
    expect((await create({ paidOn: "2025-12-31" })).status).toBe(400);
    const ok = await create({ paidOn: "2026-09-05" });
    expect(ok.status).toBe(201);
    expect(ok.body.paidOn).toBe("2026-09-05");

    const path = "/summary/year-extras/" + ok.body.id;
    expect((await api(path, { method: "PATCH", body: { paidOn: "2027-01-01" } })).status).toBe(400);
    const moved = await api<{ paidOn: string }>(path, { method: "PATCH", body: { paidOn: "2026-08-31" } });
    expect(moved.status).toBe(200);
    expect(moved.body.paidOn).toBe("2026-08-31");
    await api(path, { method: "DELETE" });
  });

  it("年度彙整回傳付款日期；舊資料沒填日期是 null", async () => {
    const { body } = await api<YearSummaryPayload>("/summary/year?year=2026");
    expect(body.extras.length).toBeGreaterThan(0);
    expect(body.extras.every((e) => e.paidOn === null)).toBe(true);
  });
});

describe("統計 API 依付款日期帶出年度額外開銷", () => {
  let paidId: number;
  let futureId: number;

  beforeAll(async () => {
    paidId = (await create({ paidOn: "2026-09-05", payerId: 1 })).body.id;
    futureId = (await create({ name: "旅遊訂金", amount: 5000, paidOn: "2026-09-20", payerId: 2 })).body.id;
  });

  it("算進付款那個月；不算進 total（分類統計不含年度額外開銷）", async () => {
    const before = (await stats("range=month&period=2026-08")).body;
    const sep = (await stats("range=month&period=2026-09")).body;
    expect(sep.extras.map((e) => e.id)).toEqual([paidId]);
    expect(sep.extras[0]).toMatchObject({ name: "汽車保養", amount: 12000, payerId: 1, paidOn: "2026-09-05", categoryName: "行" });
    expect(before.extras.map((e) => e.id)).not.toContain(paidId);
    expect(sep.total).toBe(sep.floating.reduce((s, r) => s + r.amount, 0) + sep.fixed.reduce((s, r) => s + r.amount, 0));
  });

  it("未來日期（9/20 > 今天 9/15）還不算", async () => {
    const sep = (await stats("range=month&period=2026-09")).body;
    expect(sep.extras.map((e) => e.id)).not.toContain(futureId);
  });

  it("依支付者篩選", async () => {
    expect((await stats("range=month&period=2026-09&payerId=1")).body.extras.map((e) => e.id)).toEqual([paidId]);
    expect((await stats("range=month&period=2026-09&payerId=2")).body.extras).toEqual([]);
  });

  it("未填日期的舊資料當作該年 1 月", async () => {
    const jan = (await stats("range=month&period=2026-01")).body;
    expect(jan.extras.length).toBeGreaterThan(0);
    expect(jan.extras.every((e) => e.paidOn === null)).toBe(true);
    const feb = (await stats("range=month&period=2026-02")).body;
    expect(feb.extras.every((e) => e.paidOn !== null)).toBe(true);
  });
});
