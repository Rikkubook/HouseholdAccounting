import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../env.js";
import * as schema from "./schema.js";

/**
 * Serverless（Vercel）：每個 function instance 各開自己的連線，由 Supabase
 * Supavisor（連接埠 6543，transaction mode）承擔真正的池化。
 * prepare: false 是 Supavisor transaction mode 的硬性要求。
 * 本機長駐時放寬到 10。
 *
 * 連線在 warm instance 之間重複使用（不像先前版本每個請求都強制換新連線）。
 * 曾經為了防「process 凍結期間連線悄悄斷線」而改成每請求都換新連線，
 * 但那個做法讓連線數暴增：每個請求各開最多 5 條全新連線，舊連線關閉時
 * 又不設逾時、無限期等待既有查詢結束，一旦某條連線卡住，它就永遠不會
 * 真的被回收，連線數只增不減，最終把 Supavisor 的連線額度卡滿，變成
 * 「不管哪個查詢量大的頁面，輪到的那個就卡 15 秒」。改回重複使用連線，
 * 只在偵測到真的卡住時才呼叫 resetConnection()（見下方），避免無謂的
 * 連線churn。
 */
export const serverless = Boolean(process.env.VERCEL);

function createClient() {
  return postgres(env.DATABASE_URL, {
    /**
     * 不能壓到 1：service 層多處用 Promise.all 平行送出好幾支查詢
     * （見 services/categories.ts、dashboard.ts、stats.ts、year.ts、
     * routes/budgets.ts、routes/transactions.ts）。單一連線下這些平行
     * 查詢會擠在同一條連線上用 pipelining 送出，Supavisor 的 transaction
     * 模式不保證正確處理同連線平行查詢，會讓其中一支永遠等不到回應、
     * 卡到我們自己的逾時才失敗——這才是 categories／dashboard／stats 等
     * 頁面間歇性卡死 15 秒的真正原因，不是連線新舊的問題。給一點餘裕
     * 讓平行查詢各自拿到自己的實體連線即可。
     */
    max: serverless ? 5 : 10,
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
 *
 * 關閉時給 20 秒的優雅期、不是立刻強殺：這條連線上可能還有查詢正在跑
 * （同一個 warm instance 上並發的其他請求，或這次逾時之前就已送出、
 * 仍在背景等待的那個查詢），太短的 timeout 強制 terminate 會讓那些查詢
 * 直接收到 CONNECTION_DESTROYED 而爆掉，變成使用者看到的 500，而不是
 * 我們設計中乾淨的 503。20 秒比 app.ts 的 15 秒應用層逾時長，給正常
 * 查詢足夠時間跑完；但也不是完全不設上限——真的卡死的連線 20 秒後
 * 還是會被強制回收，不會無限期占著連線數，這是先前「不設 timeout」
 * 版本的教訓：卡死的查詢永遠不結束，連線就永遠不會真的關閉。
 */
export function resetConnection() {
  const dying = currentSql;
  currentSql = createClient();
  currentDb = drizzle(currentSql, { schema });
  dying.end({ timeout: 20 }).catch(() => {});
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
