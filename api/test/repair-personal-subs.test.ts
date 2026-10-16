import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MainCategory, TransactionView } from "@family-ledger/shared";
import { api, freezeToday, reseed } from "./helpers.js";

/**
 * db:repair-personal-subs-2026：用匯入當時的備份補回被清掉的子項目。
 * 模擬舊版匯入的結果：交易已經在個人分類「食」底下、子項目是空的，備份記得它原本是「早餐」。
 */
beforeAll(() => freezeToday());
afterAll(() => reseed());

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const runRepair = (backup: string, apply: boolean) =>
  execFileSync(
    process.execPath,
    [join(apiRoot, "node_modules", "tsx", "dist", "cli.mjs"), "src/db/repair-personal-subs-2026.ts", "--backup=" + backup, ...(apply ? ["--apply"] : [])],
    { cwd: apiRoot, env: process.env, stdio: "pipe" }
  ).toString();

let food: MainCategory;
let cleared: TransactionView;
let deleted: TransactionView;
let backupFile: string;

beforeAll(async () => {
  const cat = await api<MainCategory>("/categories?scope=personal", {
    method: "POST",
    body: { name: "食", icon: "restaurant", type: "expense", nature: "floating" },
  });
  food = cat.body;
  const make = async (amount: number) =>
    (
      await api<TransactionView>("/transactions", {
        method: "POST",
        body: { type: "expense", mainCategoryId: food.id, subCategoryId: null, amount, date: "2026-10-03", scope: "personal" },
      })
    ).body;
  cleared = await make(85);
  deleted = await make(60);
  await api(`/transactions/${deleted.id}`, { method: "DELETE" });

  backupFile = join(mkdtempSync(join(tmpdir(), "repair-subs-")), "backup.json");
  writeFileSync(
    backupFile,
    JSON.stringify({
      moved: [
        { id: cleared.id, date: "2026-10-03", amount: 85, mainCategoryName: "食", subCategoryName: "早餐" },
        { id: deleted.id, date: "2026-10-03", amount: 60, mainCategoryName: "食", subCategoryName: "午餐" },
      ],
    })
  );
});

const findTx = async (id: number) =>
  (await api<{ items: TransactionView[] }>("/transactions?month=2026-10&scope=personal")).body.items.find((t) => t.id === id);

describe("補回被清掉的子項目", () => {
  it("只試算時不寫入", async () => {
    const out = runRepair(backupFile, false);
    expect(out).toContain("要補回子項目：1 筆");
    expect(out).toContain("已刪除");
    expect((await findTx(cleared.id))!.subCategoryName).toBeNull();
  });

  it("--apply 補回子項目，個人分類底下沒有的子分類會先建立", async () => {
    runRepair(backupFile, true);
    const tx = await findTx(cleared.id);
    expect(tx).toMatchObject({ subCategoryName: "早餐" });
    const cats = (await api<MainCategory[]>("/categories?scope=personal")).body;
    const sub = cats.find((c) => c.id === food.id)!.subCategories.find((s) => s.name === "早餐");
    expect(sub).toBeDefined();
    expect(tx!.subCategoryId).toBe(sub!.id);
  });

  it("可以重複執行：已經有子項目的就跳過", async () => {
    const out = runRepair(backupFile, true);
    expect(out).toContain("要補回子項目：0 筆");
    expect(out).toContain("已經有子項目「早餐」");
  });
});
