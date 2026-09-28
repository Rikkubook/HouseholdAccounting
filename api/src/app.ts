import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { ZodError } from "zod";
import { corsOrigins, env } from "./env.js";
import { resetConnection } from "./db/index.js";
import { HttpError } from "./lib/errors.js";
import { authRoutes } from "./routes/auth.js";
import { budgetRoutes } from "./routes/budgets.js";
import { cronRoutes } from "./routes/cron.js";
import { docsRoutes } from "./routes/docs.js";
import { transactionRoutes } from "./routes/transactions.js";
import { categoryRoutes } from "./routes/categories.js";
import { memberRoutes } from "./routes/members.js";
import { subscriptionRoutes } from "./routes/subscriptions.js";
import { summaryRoutes } from "./routes/summary.js";
import type { AppEnv } from "./middleware/auth.js";

const app = new Hono<AppEnv>();

app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: corsOrigins,
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

app.get("/health", (c) => c.json({ ok: true }));

/**
 * Serverless 環境下資料庫連線偶爾會悄悄斷線（見 db/index.ts 註解），
 * 卡住的查詢會一路等到 Vercel 60 秒逾時才有動靜。這裡先用應用層逾時
 * 擋在前面：request 卡太久就當作連線已死，強制換一條新連線並快速回
 * 錯誤，不讓使用者乾等一分鐘；換過的新連線會讓下一次請求（同一個
 * warm instance 也好、新的也好）恢復正常。
 *
 * 門檻必須明顯大於 db/index.ts 的 connect_timeout（10 秒）：cold
 * instance 建立全新連線本身就可能花到接近 10 秒，這是正常握手時間，
 * 不代表連線壞掉。之前這裡設 8 秒，比 connect_timeout 還短，等於在
 * 健康的冷連線握手途中就搶先誤判、強制重置並回 503——這正是「dashboard
 * 一次平行打好幾支 API、其中一兩支落在冷 instance 上就跳 503」的成因。
 */
const DB_TIMEOUT_MS = 15000;
app.use("/api/*", async (c, next) => {
  let finished = false;
  const timedOut = new Promise<"timeout">((resolve) => {
    setTimeout(() => resolve("timeout"), DB_TIMEOUT_MS);
  });
  const running = next()
    .then(() => {
      finished = true;
      return "done" as const;
    })
    .catch((err) => {
      finished = true;
      throw err;
    });
  // 逾時已經先回應時，這個 promise 才會變成「棄兒」；先接住避免
  // unhandled rejection，真正的錯誤仍會在上面 race 裡優先被丟出。
  running.catch(() => {});

  const result = await Promise.race([running, timedOut]);
  if (result === "timeout" && !finished) {
    resetConnection();
    if (!c.finalized) {
      return c.json({ code: "gateway_timeout", message: "伺服器忙碌，請重試一次" }, 503);
    }
  }
});

/** 前端 client.ts 的 baseURL 預設 /api。 */
const api = new Hono<AppEnv>();
// 文件先掛，避免被其他路由的 /* 中介層攔下
api.route("/", docsRoutes);
api.route("/auth", authRoutes);
api.route("/transactions", transactionRoutes);
api.route("/members", memberRoutes);
api.route("/categories", categoryRoutes);
api.route("/budgets", budgetRoutes);
api.route("/subscriptions", subscriptionRoutes);
api.route("/summary", summaryRoutes);
api.route("/cron", cronRoutes);
app.route("/api", api);

/** 一律回 { code, message }，對齊前端 ApiError 與 normalizeError()。 */
app.onError((err, c) => {
  if (err instanceof HttpError) return c.json(err.toJSON(), err.status);

  if (err instanceof ZodError) {
    const first = err.issues[0];
    return c.json({ code: "validation_error", message: first?.message ?? "輸入格式不正確" }, 400);
  }

  // @hono/zod-validator 的預設失敗回應會走這裡的 HTTPException 分支
  const status = (err as { status?: number }).status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return c.json({ code: "bad_request", message: err.message || "輸入格式不正確" }, status as 400);
  }

  console.error(err);
  return c.json({ code: "internal_error", message: "伺服器發生錯誤，請稍後再試" }, 500);
});

app.notFound((c) => c.json({ code: "not_found", message: "端點不存在" }, 404));

export { app };
export type AppType = typeof app;
