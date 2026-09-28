import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../env.js";
import * as schema from "./schema.js";

/**
 * Serverless（Vercel）：每個 function instance 各開自己的連線，故 max 壓到 1，
 * 由 Supabase Supavisor（連接埠 6543，transaction mode）承擔真正的池化。
 * prepare: false 是 Supavisor transaction mode 的硬性要求。
 * 本機長駐時放寬到 10。
 *
 * max_lifetime 刻意壓短：warm function instance 之間重複使用同一條連線時，
 * 如果連線在兩次呼叫之間悄悄斷線（Supavisor 主動斷開、或 function 被凍結
 * 期間網路層斷線），下一次查詢會卡在一條沒人發現已經死掉的連線上，
 * 一路卡到 Vercel 的 60 秒逾時（而非乾淨地丟出連線錯誤）。縮短存活時間、
 * 強迫定期換新連線，降低卡死機率——但無法百分之百根除，故搭配
 * app.ts 的逾時中介層，偵測到請求卡住就呼叫 resetConnection()。
 */
const serverless = Boolean(process.env.VERCEL);

function createClient() {
  return postgres(env.DATABASE_URL, {
    max: serverless ? 1 : 10,
    idle_timeout: serverless ? 10 : 20,
    max_lifetime: serverless ? 30 : undefined,
    connect_timeout: 10,
    prepare: false,
  });
}

let currentSql = createClient();
let currentDb = drizzle(currentSql, { schema });

/**
 * 強制汰換目前的連線。app.ts 的逾時中介層偵測到請求卡住太久時呼叫，
 * 懷疑當下這條連線已經悄悄斷線。用 Proxy 包一層 sql/db，讓既有的
 * `import { db, sql } from "./index.js"` 用法完全不用改——底層實際
 * 指向的 client 換掉後，下一次查詢就會自動用到新連線。
 * 舊連線背景關閉、不等待，避免它本身的關閉卡住新連線生效。
 */
export function resetConnection() {
  const dying = currentSql;
  currentSql = createClient();
  currentDb = drizzle(currentSql, { schema });
  dying.end({ timeout: 1 }).catch(() => {});
}

function bindIfFn(value: unknown, thisArg: unknown) {
  return typeof value === "function" ? value.bind(thisArg) : value;
}

export const sql: typeof currentSql = new Proxy(function () {} as unknown as typeof currentSql, {
  apply(_target, _thisArg, args) {
    return (currentSql as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop) {
    return bindIfFn(Reflect.get(currentSql as object, prop), currentSql);
  },
});

export const db: typeof currentDb = new Proxy({} as typeof currentDb, {
  get(_target, prop) {
    return bindIfFn(Reflect.get(currentDb as object, prop), currentDb);
  },
});

export { schema };
