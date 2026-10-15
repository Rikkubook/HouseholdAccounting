import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DashboardPayload, MainCategory, StatsPayload, TransactionView, YearSummaryPayload } from "@family-ledger/shared";
import { api, freezeToday, reseed } from "./helpers.js";
import { runDueCharges } from "../src/services/charges.js";

/**
 * 個人帳第 2 批：個人分類與投資類型（docs/requirements/personal-ledger.md 6.1、6.3）。
 * - 個人帳第一次使用只自動建立「其他」，其餘由本人新增。
 * - 個人分類每個人管自己的（一般成員也可以）；別人的個人分類當作不存在，管理者也一樣。
 * - 家庭分類照舊只有管理者能改；預算與年度額外開銷只能用家庭分類。
 * - 投資是第三種類型：不算支出、不算收入，結餘＝收入 − 支出，剩餘現金＝結餘 − 投資。
 */
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

beforeAll(() => freezeToday());
afterAll(async () => {
  await sql.end();
  reseed();
});

const personalList = (as: "dad" | "mom" | "sis" = "dad") =>
  api<MainCategory[]>("/categories?scope=personal", { as });

const create = (body: Record<string, unknown>, as: "dad" | "mom" | "sis" = "dad", scope = "personal") =>
  api<MainCategory>(`/categories?scope=${scope}`, { method: "POST", as, body: { icon: "category", ...body } });

describe("個人帳第一次使用", () => {
  it("只自動建立系統分類「訂閱」「其他」，重複讀取不會重複建立", async () => {
    const first = await personalList("mom");
    expect(first.status).toBe(200);
    expect(first.body.map((c) => [c.name, c.systemKey, c.nature])).toEqual([
      ["訂閱", "subscription", "fixed"],
      ["其他", "other", "floating"],
    ]);

    const again = await personalList("mom");
    expect(again.body.map((c) => c.id)).toEqual(first.body.map((c) => c.id));
  });

  it("家庭分類清單不受影響，也不含任何人的個人分類", async () => {
    await personalList("dad");
    const { body } = await api<MainCategory[]>("/categories");
    expect(body.filter((c) => c.name === "其他")).toHaveLength(1);
    expect(body.every((c) => (c as MainCategory & { ownerId: number | null }).ownerId == null)).toBe(true);
  });
});

describe("誰能改哪些分類", () => {
  let sisSnack: MainCategory;

  beforeAll(async () => {
    const res = await create({ name: "點心", type: "expense", nature: "floating" }, "sis");
    expect(res.status).toBe(201);
    sisSnack = res.body;
  });

  it("一般成員可以新增、改名、停用自己的個人分類與子分類", async () => {
    expect((await api(`/categories/${sisSnack.id}`, { method: "PATCH", as: "sis", body: { name: "零食" } })).status).toBe(200);
    const sub = await api<MainCategory>(`/categories/${sisSnack.id}/subs`, { method: "POST", as: "sis", body: { name: "餅乾" } });
    expect(sub.status).toBe(201);
    const subId = sub.body.subCategories[0]!.id;
    expect((await api(`/categories/subs/${subId}/archive`, { method: "POST", as: "sis" })).status).toBe(200);
    expect((await api(`/categories/${sisSnack.id}/archive`, { method: "POST", as: "sis" })).status).toBe(200);
    expect((await api(`/categories/${sisSnack.id}/restore`, { method: "POST", as: "sis" })).status).toBe(200);
  });

  it("一般成員仍不能新增或修改家庭分類（403）", async () => {
    expect((await create({ name: "家庭新分類", type: "expense", nature: "floating" }, "sis", "family")).status).toBe(403);
    expect((await api("/categories/1", { method: "PATCH", as: "sis", body: { name: "改名" } })).status).toBe(403);
    expect((await api("/categories/1/subs", { method: "POST", as: "sis", body: { name: "宵夜" } })).status).toBe(403);
  });

  it("別人的個人分類當作不存在（404），管理者也一樣", async () => {
    const opts = { as: "dad" as const };
    expect((await api(`/categories/${sisSnack.id}`, { ...opts, method: "PATCH", body: { name: "偷改" } })).status).toBe(404);
    expect((await api(`/categories/${sisSnack.id}/archive`, { ...opts, method: "POST" })).status).toBe(404);
    expect((await api(`/categories/${sisSnack.id}/subs`, { ...opts, method: "POST", body: { name: "偷加" } })).status).toBe(404);

    const dads = await personalList("dad");
    expect(dads.body.map((c) => c.id)).not.toContain(sisSnack.id);
  });

  it("排序只能排自己帳本的分類", async () => {
    const mine = (await personalList("sis")).body.map((c) => c.id);
    expect((await api("/categories/reorder?scope=personal", { method: "POST", as: "sis", body: { orderedIds: [...mine].reverse() } })).status).toBe(204);
    // 混進家庭分類
    expect((await api("/categories/reorder?scope=personal", { method: "POST", as: "sis", body: { orderedIds: [...mine, 1] } })).status).toBe(400);
  });

  it("個人預算（PL2-03）：本人可以設定自己個人分類的預算，只出現在自己的個人帳", async () => {
    const put = (as: "dad" | "sis", amount: number) =>
      api("/budgets", { method: "PUT", as, body: { month: "2026-10", mainCategoryId: sisSnack.id, amount } });
    expect((await put("sis", 1500)).status).toBe(200);
    // 別人的個人分類當作不存在，管理者也一樣
    expect((await put("dad", 1)).status).toBe(400);

    const mine = await api<{ mainCategoryId: number; amount: number }[]>("/budgets?month=2026-10&scope=personal", { as: "sis" });
    expect(mine.body).toEqual([expect.objectContaining({ mainCategoryId: sisSnack.id, amount: 1500 })]);
    const family = await api<{ mainCategoryId: number }[]>("/budgets?month=2026-10");
    expect(family.body.map((b) => b.mainCategoryId)).not.toContain(sisSnack.id);

    const dash = await api<DashboardPayload>("/summary/dashboard?month=2026-10&scope=personal", { as: "sis" });
    expect(dash.body.categories.find((c) => c.id === sisSnack.id)?.budget).toBe(1500);

    // 沿用上月也只動自己的個人帳
    const copy = await api<unknown[]>("/budgets/copy-previous?scope=personal", { method: "POST", as: "sis", body: { month: "2026-11" } });
    expect(copy.status).toBe(200);
    expect(copy.body).toHaveLength(1);
  });

  it("家庭預算仍限管理者", async () => {
    const res = await api("/budgets", { method: "PUT", as: "sis", body: { month: "2026-10", mainCategoryId: 1, amount: 100 } });
    expect(res.status).toBe(403);
  });
});

describe("個人年度額外開銷", () => {
  let sisFun: MainCategory;
  let extraId: number;
  const post = (body: Record<string, unknown>, as: "dad" | "sis" = "sis") =>
    api<{ id: number }>("/summary/year-extras", { method: "POST", as, body: { year: 2026, name: "旅遊", amount: 6995, ...body } });

  beforeAll(async () => {
    sisFun = (await create({ name: "樂", type: "expense", nature: "floating" }, "sis")).body;
  });

  it("一般成員可以在自己的個人分類記年度額外開銷，只算進自己的個人帳", async () => {
    const res = await post({ mainCategoryId: sisFun.id, payerId: 3 });
    expect(res.status).toBe(201);
    extraId = res.body.id;

    const mine = await api<YearSummaryPayload>("/summary/year?year=2026&scope=personal", { as: "sis" });
    expect(mine.body.extras.map((e) => e.id)).toEqual([extraId]);
    expect(mine.body.rows.find((r) => r.mainCategoryId === sisFun.id)).toMatchObject({ extra: 6995, total: 6995 });

    const family = await api<YearSummaryPayload>("/summary/year?year=2026");
    expect(family.body.extras.map((e) => e.id)).not.toContain(extraId);
  });

  it("個人帳的支付者只能是自己", async () => {
    expect((await post({ mainCategoryId: sisFun.id, payerId: 1 })).status).toBe(400);
  });

  it("不能用別人的個人分類，也不能刪別人的（管理者也一樣）", async () => {
    expect((await post({ mainCategoryId: sisFun.id, payerId: 1 }, "dad")).status).toBe(400);
    expect((await api(`/summary/year-extras/${extraId}`, { method: "DELETE" })).status).toBe(404);
  });

  it("家庭帳的年度額外開銷仍限管理者", async () => {
    expect((await post({ mainCategoryId: 1, payerId: 3 })).status).toBe(403);
  });

  it("本人可以修改名稱、金額、分類；分類只能換成自己的個人支出分類", async () => {
    const sisFood = (await create({ name: "食", type: "expense", nature: "floating" }, "sis")).body;
    const patch = (body: Record<string, unknown>, as: "dad" | "sis" = "sis") =>
      api<{ name: string; amount: number; mainCategoryId: number }>(`/summary/year-extras/${extraId}`, {
        method: "PATCH",
        as,
        body,
      });

    const ok = await patch({ name: "日本旅遊", amount: 7000, mainCategoryId: sisFood.id });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ name: "日本旅遊", amount: 7000, mainCategoryId: sisFood.id });

    // 不能搬到家庭帳、不能改成別人當支付者、別人（含管理者）改不了
    expect((await patch({ mainCategoryId: 1 })).status).toBe(400);
    expect((await patch({ payerId: 1 })).status).toBe(400);
    expect((await patch({ amount: 1 }, "dad")).status).toBe(404);
  });

  it("家庭帳的年度額外開銷只有管理者能改", async () => {
    const familyExtra = await api<{ id: number }>("/summary/year-extras", {
      method: "POST",
      body: { year: 2026, name: "家電", amount: 1000, mainCategoryId: 3, payerId: 1 },
    });
    expect(familyExtra.status).toBe(201);
    const path = `/summary/year-extras/${familyExtra.body.id}`;
    expect((await api(path, { method: "PATCH", as: "sis", body: { amount: 2 } })).status).toBe(403);
    expect((await api(path, { method: "PATCH", body: { amount: 2000, payerId: 2 } })).status).toBe(200);
    // 家庭帳的額外開銷也不能改成個人分類
    const dadCat = (await create({ name: "家具", type: "expense", nature: "floating" })).body;
    expect((await api(path, { method: "PATCH", body: { mainCategoryId: dadCat.id } })).status).toBe(400);
    expect((await api(path, { method: "DELETE" })).status).toBe(204);
  });

  it("本人可以刪除自己的個人額外開銷", async () => {
    expect((await api(`/summary/year-extras/${extraId}`, { method: "DELETE", as: "sis" })).status).toBe(204);
  });
});

describe("個人訂閱（PL2-02）", () => {
  type Sub = { id: number; mainCategoryId: number; payerId: number };
  let sisSub: Sub;
  const post = (body: Record<string, unknown>, as: "dad" | "sis" = "sis", scope = "personal") =>
    api<Sub>(`/subscriptions?scope=${scope}`, {
      method: "POST",
      as,
      body: { name: "共同費", amount: 10000, cycle: "monthly", nextChargeDate: "2026-10-05", ...body },
    });

  it("一般成員可以新增自己的個人訂閱，記在自己的「訂閱」分類", async () => {
    const res = await post({ payerId: 3 });
    expect(res.status).toBe(201);
    sisSub = res.body;
    const sisCats = (await personalList("sis")).body;
    expect(sisCats.find((c) => c.id === sisSub.mainCategoryId)?.systemKey).toBe("subscription");
  });

  it("只列在自己的個人帳；家庭帳與別人看不到", async () => {
    const mine = await api<Sub[]>("/subscriptions?scope=personal", { as: "sis" });
    expect(mine.body.map((s) => s.id)).toEqual([sisSub.id]);
    const family = await api<Sub[]>("/subscriptions");
    expect(family.body.map((s) => s.id)).not.toContain(sisSub.id);
    const dads = await api<Sub[]>("/subscriptions?scope=personal");
    expect(dads.body.map((s) => s.id)).not.toContain(sisSub.id);
  });

  it("扣款人只能是自己；別人（含管理者）改不了、看不到修改紀錄", async () => {
    expect((await post({ payerId: 1 })).status).toBe(400);
    expect((await api(`/subscriptions/${sisSub.id}`, { method: "PATCH", body: { amount: 1 } })).status).toBe(404);
    expect((await api(`/subscriptions/${sisSub.id}/revisions`)).status).toBe(404);
    expect((await api(`/subscriptions/${sisSub.id}`, { method: "PATCH", as: "sis", body: { payerId: 1 } })).status).toBe(400);
  });

  it("家庭帳的訂閱仍限管理者", async () => {
    expect((await post({ payerId: 3 }, "sis", "family")).status).toBe(403);
  });

  it("個人首頁的固定支出總額＝本人的個人訂閱", async () => {
    const { body } = await api<DashboardPayload>("/summary/dashboard?month=2026-10&scope=personal", { as: "sis" });
    expect(body.summary.fixedTotal).toBe(10000);
    const family = await api<DashboardPayload>("/summary/dashboard?month=2026-10");
    const familyBefore = family.body.summary.fixedTotal;
    expect(familyBefore).toBeGreaterThan(0);
  });

  it("自動扣款記到本人的個人帳", async () => {
    const charged = (await runDueCharges("2026-10-05")).filter((r) => r.subscriptionId === sisSub.id);
    expect(charged).toHaveLength(1);
    const mine = await api<{ items: TransactionView[] }>("/transactions?month=2026-10&scope=personal", { as: "sis" });
    expect(mine.body.items.find((t) => t.sourceSubscriptionId === sisSub.id)).toMatchObject({ ownerId: 3, payerId: 3, amount: 10000 });
    const family = await api<{ items: TransactionView[] }>("/transactions?month=2026-10");
    expect(family.body.items.some((t) => t.sourceSubscriptionId === sisSub.id)).toBe(false);
  });
});

describe("投資類型", () => {
  let stock: MainCategory;
  let food: MainCategory;
  let salary: MainCategory;

  beforeAll(async () => {
    stock = (await create({ name: "投資", type: "investment", nature: null })).body;
    food = (await create({ name: "食", type: "expense", nature: "floating" })).body;
    salary = (await create({ name: "薪資", type: "income", nature: null })).body;

    const tx = (type: string, mainCategoryId: number, amount: number, date: string) =>
      api<TransactionView>("/transactions", {
        method: "POST",
        body: { type, mainCategoryId, subCategoryId: null, amount, date, scope: "personal" },
      });
    expect((await tx("income", salary.id, 50000, "2026-08-05")).status).toBe(201);
    expect((await tx("expense", food.id, 8000, "2026-08-10")).status).toBe(201);
    expect((await tx("investment", stock.id, 20000, "2026-08-20")).status).toBe(201);
  });

  it("投資分類不得有性質；支出分類一定要有", async () => {
    expect((await create({ name: "定存", type: "investment", nature: "fixed" })).status).toBe(400);
    expect((await create({ name: "雜支", type: "expense", nature: null })).status).toBe(400);
    expect(stock).toMatchObject({ type: "investment", nature: null });
  });

  it("投資交易的類型必須和分類一致", async () => {
    const res = await api("/transactions", {
      method: "POST",
      body: { type: "expense", mainCategoryId: stock.id, subCategoryId: null, amount: 1, date: "2026-08-21", scope: "personal" },
    });
    expect(res.status).toBe(400);
  });

  it("首頁：投資不算支出，另外回傳投資金額", async () => {
    const { body } = await api<DashboardPayload>("/summary/dashboard?month=2026-08&scope=personal");
    expect(body.summary).toMatchObject({ income: 50000, expense: 8000, net: 42000, investment: 20000, hasInvestment: true });
    expect(body.categories.some((c) => c.id === stock.id)).toBe(false);
  });

  it("年度彙整：投資另計，每月也有投資金額", async () => {
    const { body } = await api<YearSummaryPayload>("/summary/year?year=2026&scope=personal");
    expect(body).toMatchObject({ income: 50000, expense: 8000, net: 42000, investment: 20000, hasInvestment: true });
    expect(body.monthly[7]).toEqual({ income: 50000, expense: 8000, investment: 20000, net: 42000 });
    expect(body.rows.some((r) => r.mainCategoryId === stock.id)).toBe(false);
  });

  it("統計只算支出，不含投資", async () => {
    const { body } = await api<StatsPayload>("/summary/stats?range=month&period=2026-08&scope=personal");
    expect(body.total).toBe(8000);
  });

  it("交易列表可以只篩投資", async () => {
    const { body } = await api<{ items: TransactionView[] }>("/transactions?month=2026-08&scope=personal&type=investment");
    expect(body.items.map((t) => t.amount)).toEqual([20000]);
  });

  it("家庭帳沒有投資分類：hasInvestment 為 false", async () => {
    const dash = await api<DashboardPayload>("/summary/dashboard?month=2026-08");
    expect(dash.body.summary).toMatchObject({ investment: 0, hasInvestment: false });
    const year = await api<YearSummaryPayload>("/summary/year?year=2026");
    expect(year.body).toMatchObject({ investment: 0, hasInvestment: false });
  });
});
