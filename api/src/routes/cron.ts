import { Hono } from "hono";
import { runDueCharges } from "../services/charges.js";
import { runBackup } from "../services/backup.js";
import { buildBudgetReminder, isReminderDay, sendLineMessage, taipeiToday } from "../services/budgetReminder.js";
import { env } from "../env.js";
import { today } from "../lib/dates.js";
import type { AppEnv } from "../middleware/auth.js";

/**
 * Vercel Cron 專用路由。serverless 沒有常駐 process，排程由平台定時打這支
 * （schedule 見 api/vercel.json 的 crons）。Vercel 會自動帶
 * Authorization: Bearer $CRON_SECRET，故不走成員 JWT 驗證。
 */
export const cronRoutes = new Hono<AppEnv>();

cronRoutes.use("/*", async (c, next) => {
  const expected = env.CRON_SECRET;
  // 未設 CRON_SECRET 時一律拒絕，避免端點在正式環境裸奔
  if (!expected) return c.json({ code: "forbidden", message: "CRON_SECRET 未設定" }, 403);
  if (c.req.header("Authorization") !== "Bearer " + expected) {
    return c.json({ code: "unauthorized", message: "排程憑證不正確" }, 401);
  }
  await next();
});

/** 掃出應扣未扣的訂閱並補上交易。冪等，重複執行不會重複扣。 */
cronRoutes.get("/run-due-charges", async (c) => {
  const asOf = today();
  const charged = await runDueCharges(asOf);
  console.log("[cron] run-due-charges " + asOf + " → " + charged.length + " 筆");
  return c.json({ asOf, charged });
});

/**
 * 每月 10、20、30 號（2 月改月底）在家庭 LINE 群組發剩餘額度。
 * 排程設在 10、20、28、29、30 號，不是發送日就跳過。
 * 手動測試：?date=YYYY-MM-DD 指定日期、?force=1 不看日期、?dryRun=1 只回傳訊息不發送。
 */
cronRoutes.get("/budget-reminder", async (c) => {
  const date = c.req.query("date") ?? taipeiToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ code: "bad_request", message: "date 格式須為 YYYY-MM-DD" }, 400);
  if (!c.req.query("force") && !isReminderDay(date)) return c.json({ date, skipped: true });

  const { text, message } = await buildBudgetReminder(date);
  const result = c.req.query("dryRun") ? { sent: false as const, reason: "dryRun" } : await sendLineMessage(message);
  console.log("[cron] budget-reminder " + date + " → " + (result.sent ? "已發送" : "未發送：" + result.reason));
  return c.json({ date, text, ...result });
});

/** 全庫 JSON 快照 → Supabase Storage 私有 bucket。免費方案無 PITR 的替代方案。 */
cronRoutes.get("/backup", async (c) => {
  const result = await runBackup();
  const total = Object.values(result.counts).reduce((s, n) => s + n, 0);
  console.log(
    "[cron] backup " + result.path + " " + result.bytes + " bytes / " + total + " 列" +
      (result.uploaded ? "" : "（未上傳：" + result.reason + "）")
  );
  return c.json(result);
});
