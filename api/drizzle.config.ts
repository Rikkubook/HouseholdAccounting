import type { Config } from "drizzle-kit";
import { env } from "./src/env.js";

/** 權威 DDL 是 sql/0000_init.sql（含 check 約束與 RLS）。此設定僅供 drizzle-kit studio / 檢查漂移。 */
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: env.DATABASE_URL },
  verbose: true,
  strict: true,
} satisfies Config;
