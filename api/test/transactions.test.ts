import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Subscription, TransactionRevision, TransactionView } from "@family-ledger/shared";
import { api, freezeToday, reseed, type As } from "./helpers.js";

/**
 * 交易的記帳者規則（sql/0003）：
 * 1. 新增時省略 payerId ＝ 登入者本人；管理者可代記他人，一般成員不行。
 * 2. 修改時管理者可換記帳者，一般成員不行；訂閱產生的交易、個人帳交易不可換。
 * 3. 不可指定已停用的成員。
 * 4. createdBy 記實際輸入者，代記時看得出是誰輸入的。
 * seed：1 先生、2 太太（管理者）、3 小妹（一般成員）、4 阿嬤（已停用）。
 */
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

beforeAll(() => freezeToday());
afterAll(async () => {
  await sql.end();
  reseed();
});

const draft = { type: "expense", mainCategoryId: 1, subCategoryId: null, amount: 120, date: "2026-09-10" };

const create = (as: As, extra: Record<string, unknown> = {}) =>
  api<TransactionView>("/transactions", { as, method: "POST", body: { ...draft, ...extra } });

const patch = (as: As, id: number, body: Record<string, unknown>) =>
  api<TransactionView>("/transactions/" + id, { as, method: "PATCH", body });

describe("新增：代記他人", () => {
  it("省略 payerId 時記在登入者名下，輸入者也是本人", async () => {
    const res = await create("sis");
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ payerId: 3, payerName: "小妹", createdBy: 3, createdByName: "小妹" });
  });

  it("管理者可記在別人名下，輸入者仍是管理者", async () => {
    const res = await create("dad", { payerId: 3 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ payerId: 3, payerName: "小妹", createdBy: 1, createdByName: "先生" });
  });

  it("一般成員不可代記他人", async () => {
    const res = await create("sis", { payerId: 1 });
    expect(res.status).toBe(403);
  });

  it("一般成員指定自己沒問題", async () => {
    const res = await create("sis", { payerId: 3 });
    expect(res.status).toBe(201);
  });

  it("不可記在已停用或不存在的成員名下", async () => {
    expect((await create("dad", { payerId: 4 })).status).toBe(400);
    expect((await create("dad", { payerId: 999 })).status).toBe(400);
  });
});

describe("修改：更換記帳者", () => {
  it("管理者可換記帳者，並寫一列 revision", async () => {
    const { body: tx } = await create("sis");
    const res = await patch("mom", tx.id, { payerId: 1 });
    expect(res.status).toBe(200);
    // 換的是記帳者，輸入者不變
    expect(res.body).toMatchObject({ payerId: 1, payerName: "先生", createdBy: 3 });

    const { body: revisions } = await api<TransactionRevision[]>("/transactions/" + tx.id + "/revisions");
    expect(revisions).toEqual([
      expect.objectContaining({ field: "payerId", before: "3", after: "1", editedBy: 2 }),
    ]);
  });

  it("一般成員不可換記帳者，連自己的交易也不行", async () => {
    const { body: tx } = await create("sis");
    expect((await patch("sis", tx.id, { payerId: 1 })).status).toBe(403);
  });

  it("一般成員送出相同的記帳者視同沒改，不擋", async () => {
    const { body: tx } = await create("sis");
    const res = await patch("sis", tx.id, { payerId: 3, amount: 200 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ payerId: 3, amount: 200 });
  });

  it("不可換成已停用的成員", async () => {
    const { body: tx } = await create("dad");
    expect((await patch("dad", tx.id, { payerId: 4 })).status).toBe(400);
  });

  it("訂閱產生的交易不可換記帳者", async () => {
    const { body: subs } = await api<Subscription[]>("/subscriptions");
    const sub = subs.find((s) => s.isActive)!;
    const paid = await api<{ transaction: TransactionView }>(`/subscriptions/${sub.id}/mark-paid`, { method: "POST" });
    expect(paid.status).toBe(200);
    // mark-paid 的輸入者是按下的管理者
    expect(paid.body.transaction.createdBy).toBe(1);

    const other = sub.payerId === 1 ? 2 : 1;
    expect((await patch("dad", paid.body.transaction.id, { payerId: other })).status).toBe(400);
  });

  it("個人帳交易不可換記帳者", async () => {
    const [row] = await sql<{ id: number }[]>`
      insert into transactions (type, main_category_id, amount, date, payer_id, owner_id, created_by)
      values ('expense', 1, 100, '2026-09-10', 1, 1, 1) returning id`;
    expect((await patch("dad", row!.id, { payerId: 2 })).status).toBe(400);
  });
});
