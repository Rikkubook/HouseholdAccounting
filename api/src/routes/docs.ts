import { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
import { openApiDocument } from "../docs/openapi";
import type { AppEnv } from "../middleware/auth";

/**
 * 文件不需登入即可瀏覽（只描述形狀，不含任何資料）。
 * 要實際試打端點，在 Swagger UI 右上 Authorize 填 /auth/login 拿到的 token。
 */
export const docsRoutes = new Hono<AppEnv>();

docsRoutes.get("/openapi.json", (c) => c.json(openApiDocument));

docsRoutes.get(
  "/docs",
  swaggerUI({
    url: "/api/openapi.json",
    // 依 tag 分組收合，端點數量不少
    docExpansion: "list",
    persistAuthorization: true,
  })
);
