import { Hono } from "hono";
import { runDueCharges } from "../services/charges";
import { runBackup } from "../services/backup";
import { env } from "../env";
import { today } from "../lib/dates";
import type { AppEnv } from "../middleware/auth";

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
