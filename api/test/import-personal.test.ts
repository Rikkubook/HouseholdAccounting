import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MainCategory, Subscription, TransactionView } from "@family-ledger/shared";
import { api, freezeToday, reseed } from "./helpers.js";

/**
 * db:import-personal-2026（先生 id 1）：
 * - 記在家庭分類下的 10 月個人交易搬到同名個人分類時，子項目要保留（舊版會清空）
 * - 共同費、交通費的個人訂閱記在同名的個人分類
 */
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
beforeAll(() => freezeToday());
afterAll(async () => {
  await sql.end();
  reseed();
});

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const runImport = () =>
  execFileSync(
    process.execPath,
    [join(apiRoot, "node_modules", "tsx", "dist", "cli.mjs"), "src/db/import-personal-2026.ts", "--owner=1", "--apply"],
    { cwd: apiRoot, env: process.env, stdio: "pipe" }
  ).toString();

let misfiledId: number;

beforeAll(async () => {
  // 舊版留下的狀態：個人交易記在家庭分類「食／早餐」底下（App 現在已經不允許這樣記）
  const [{ id: subId }] = await sql<{ id: number }[]>`
    select s.id from sub_categories s join main_categories m on m.id = s.main_category_id
    where m.name = '食' and m.owner_id is null and s.name = '早餐'`;
  const [row] = await sql<{ id: number }[]>`
    insert into transactions (type, main_category_id, sub_category_id, amount, date, payer_id, owner_id,
                              main_category_name, sub_category_name)
    values ('expense', 1, ${subId}, 85, '2026-10-03', 1, 1, '食', '早餐')
    returning id`;
  misfiledId = row!.id;
  runImport();
});

describe("個人帳匯入", () => {
  it("搬到個人分類時保留子項目，個人分類底下沒有就先建立", async () => {
    const { body } = await api<{ items: TransactionView[] }>("/transactions?month=2026-10&scope=personal");
    const tx = body.items.find((t) => t.id === misfiledId)!;
    const cats = (await api<MainCategory[]>("/categories?scope=personal")).body;
    const food = cats.find((c) => c.name === "食")!;
    expect(tx).toMatchObject({ mainCategoryId: food.id, mainCategoryName: "食", subCategoryName: "早餐" });
    expect(food.subCategories.find((s) => s.id === tx.subCategoryId)?.name).toBe("早餐");
  });

  it("共同費、交通費的訂閱記在同名的個人分類", async () => {
    const cats = (await api<MainCategory[]>("/categories?scope=personal")).body;
    const subs = (await api<Subscription[]>("/subscriptions?scope=personal")).body;
    for (const name of ["共同費", "交通費"]) {
      const sub = subs.find((s) => s.name === name)!;
      expect(cats.find((c) => c.id === sub.mainCategoryId)?.name).toBe(name);
    }
  });

  it("重跑一次：訂閱不重複建立", async () => {
    runImport();
    const subs = (await api<Subscription[]>("/subscriptions?scope=personal")).body;
    expect(subs.filter((s) => s.name === "共同費")).toHaveLength(1);
  });
});
