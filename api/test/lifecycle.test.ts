import { afterAll, beforeAll, expect, it } from "vitest";
import type { DashboardPayload, YearSummaryPayload } from "@family-ledger/shared";
import { api, freezeToday, reseed } from "./helpers.js";

/**
 * 分類生命週期之外的實際交易（例如補登「教育」8 月新增之前的帳）不可被藏起來：
 * 年度彙整的格子與底部支出合計、首頁的分類卡片都要算進去，和全年支出對得起來。
 * seed：教育（id 7）2026-08 新增。
 */
beforeAll(() => freezeToday());
afterAll(() => reseed());

beforeAll(async () => {
  const res = await api("/transactions", {
    method: "POST",
    body: { type: "expense", mainCategoryId: 7, subCategoryId: null, amount: 1410, date: "2026-05-31" },
  });
  expect(res.status).toBe(201);
});

it("年度彙整：分類新增前的月份有交易就顯示，各分類加總等於全年支出", async () => {
  const { body } = await api<YearSummaryPayload>("/summary/year?year=2026");
  const edu = body.rows.find((r) => r.mainCategoryId === 7)!;
  expect(edu.months[4]).toBe(1410);
  // 生命週期標記不變：仍是 8 月新增
  expect(edu.startMonth).toBe(7);

  const rowsTotal = body.rows.reduce((s, r) => s + r.total, 0);
  const extras = body.extras.reduce((s, e) => s + e.amount, 0);
  expect(rowsTotal).toBe(body.expense + extras);
});

it("首頁：該月有花費的分類即使當時不存在也列出", async () => {
  const { body } = await api<DashboardPayload>("/summary/dashboard?month=2026-05");
  expect(body.categories.find((c) => c.id === 7)).toMatchObject({ spent: 1410 });
});
