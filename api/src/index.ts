import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./env.js";

/**
 * postgres.js 在查詢被取消（如 statement timeout）時，偶爾會在該查詢的 promise
 * 之外，於底層連線上再丟出同一個錯誤，變成未接住的例外，讓整個長駐程式當機。
 * 本機 tsx watch 只在存檔時重啟，process 死掉後不會自動復活，故加這道防線：
 * 記錄下來但不讓單一查詢的例外拖垮整台伺服器。
 */
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log("API listening on http://localhost:" + info.port + "/api");
});

export type { AppType } from "./app.js";
