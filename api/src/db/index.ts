import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../env.js";
import * as schema from "./schema.js";

/**
 * Serverless（Vercel）：每個 function instance 各開自己的連線，故 max 壓到 1，
 * 由 Supabase Supavisor（連接埠 6543，transaction mode）承擔真正的池化。
 * prepare: false 是 Supavisor transaction mode 的硬性要求。
 * 本機長駐時放寬到 10。
 */
const serverless = Boolean(process.env.VERCEL);

export const sql = postgres(env.DATABASE_URL, {
  max: serverless ? 1 : 10,
  idle_timeout: serverless ? 10 : 20,
  connect_timeout: 10,
  prepare: false,
});

export const db = drizzle(sql, { schema });
export { schema };
