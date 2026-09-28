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
 * Transaction mode 這個埠本來就是設計給「每次請求開新連線、用完即關」的
 * 短生命週期用法，不是拿來讓連線跨請求長駐重複使用。Vercel 在兩次請求
 * 之間會把整個 process 凍結，凍結期間所有計時器（包含這裡的 idle_timeout /
 * max_lifetime）都不會運作，如果凍結期間網路路徑把連線悄悄斷開（沒有任何
 * 一方在監聽，不會收到 FIN/RST），process 解凍後這條連線在程式眼中仍是
 * 「活著」的，直到真的送出查詢才會發現對方沒反應——而且往往永遠等不到
 * 明確的錯誤，只會無限卡住。所以 serverless 環境下不嘗試沿用舊連線，改成
 * 每個 HTTP 請求一開始就呼叫 resetConnection() 換一條保證沒跨越過凍結期間
 * 的全新連線（見 app.ts 的中介層）；這裡的 idle_timeout / max_lifetime 只當
 * 保底，不是主要防線。
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
 * 關閉時刻意不給短 timeout 強制砸斷：這條連線上可能還有查詢正在跑
 * （同一個 warm instance 上並發的其他請求，或這次逾時之前就已送出、
 * 仍在背景等待的那個查詢），強制 terminate 會讓那些查詢直接收到
 * CONNECTION_DESTROYED 而爆掉，變成使用者看到的 500，而不是我們設計
 * 中乾淨的 503。不傳 timeout 讓 postgres.js 優雅等待既有查詢自然結束
 * 再關閉；真正掛死的連線本來就不會再有新查詢送進來，多留一陣子也
 * 沒有實質壞處，最終會被 Supavisor 自己的 idle timeout 回收。
 */
export function resetConnection() {
  const dying = currentSql;
  currentSql = createClient();
  currentDb = drizzle(currentSql, { schema });
  dying.end().catch(() => {});
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
