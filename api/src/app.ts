import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { ZodError } from "zod";
import { corsOrigins, env } from "./env";
import { HttpError } from "./lib/errors";
import { authRoutes } from "./routes/auth";
import { budgetRoutes } from "./routes/budgets";
import { cronRoutes } from "./routes/cron";
import { docsRoutes } from "./routes/docs";
import { transactionRoutes } from "./routes/transactions";
import { categoryRoutes } from "./routes/categories";
import { memberRoutes } from "./routes/members";
import { subscriptionRoutes } from "./routes/subscriptions";
import { summaryRoutes } from "./routes/summary";
import type { AppEnv } from "./middleware/auth";

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
