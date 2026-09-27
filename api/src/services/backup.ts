import { db } from "../db/index";
import {
  budgets,
  mainCategories,
  members,
  subCategories,
  subscriptionRevisions,
  subscriptions,
  transactionRevisions,
  transactions,
  yearExtraExpenses,
} from "../db/schema";
import { env } from "../env";

/**
 * 全庫快照備份。Supabase 免費方案不含 PITR，誤刪或程式寫壞無法還原到時間點，
 * 故每週匯出一份 JSON 到 Supabase Storage 的私有 bucket。
 *
 * 刻意選 JSON 而非 pg_dump：serverless 環境沒有 pg_dump 執行檔，
 * 且資料量極小（兩人家庭、數千筆交易），整庫塞進單一 JSON 遠低於 function 記憶體上限。
 */

const SCHEMA_VERSION = 1;

/** 匯出順序即還原順序：被參照的表在前，避免還原時撞外鍵。 */
const TABLES = [
  ["members", members],
  ["mainCategories", mainCategories],
  ["subCategories", subCategories],
  ["budgets", budgets],
  ["subscriptions", subscriptions],
  ["subscriptionRevisions", subscriptionRevisions],
  ["transactions", transactions],
  ["transactionRevisions", transactionRevisions],
  ["yearExtraExpenses", yearExtraExpenses],
] as const;

export type BackupPayload = {
  schemaVersion: number;
  exportedAt: string;
  counts: Record<string, number>;
  tables: Record<string, unknown[]>;
};

/**
 * members.passwordHash 與 resetCode 一併匯出——備份的用途是完整還原，
 * 少了雜湊值還原後全家都登不進去。bucket 必須為 private，切勿設成 public。
 */
export async function buildBackup(): Promise<BackupPayload> {
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const [name, table] of TABLES) {
    const rows = await db.select().from(table);
    tables[name] = rows;
    counts[name] = rows.length;
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    counts,
    tables,
  };
}

export type BackupResult = {
  path: string;
  bytes: number;
  counts: Record<string, number>;
  uploaded: boolean;
  reason?: string;
};

/** backups/2026/2026-09-15.json —— 依年份分層，同一天重跑會覆蓋（upsert）。 */
function backupPath(exportedAt: string): string {
  const day = exportedAt.slice(0, 10);
  return "backups/" + day.slice(0, 4) + "/" + day + ".json";
}

/**
 * 上傳到 Supabase Storage。需要 SUPABASE_URL 與 SUPABASE_SERVICE_KEY；
 * 未設定時只回傳統計不上傳，讓本機開發能驗證匯出內容而不需憑證。
 */
export async function runBackup(): Promise<BackupResult> {
  const payload = await buildBackup();
  const body = JSON.stringify(payload);
  const path = backupPath(payload.exportedAt);
  const base = { path, bytes: body.length, counts: payload.counts };

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return { ...base, uploaded: false, reason: "SUPABASE_URL / SUPABASE_SERVICE_KEY 未設定，僅試算未上傳" };
  }

  const url =
    env.SUPABASE_URL.replace(/\/$/, "") +
    "/storage/v1/object/" +
    env.BACKUP_BUCKET +
    "/" +
    path;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.SUPABASE_SERVICE_KEY,
      "Content-Type": "application/json",
      // 同一天重跑覆蓋前一份，不累積垃圾檔
      "x-upsert": "true",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("備份上傳失敗 " + res.status + " " + text.slice(0, 200));
  }

  return { ...base, uploaded: true };
}
