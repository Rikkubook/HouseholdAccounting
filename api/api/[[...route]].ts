import { handle } from "hono/vercel";
import { app } from "../src/app.js";

/**
 * Node.js 是獨立 Vercel Function 的預設 runtime（argon2 與 postgres.js
 * 都需要真正的 Node API，不能用 edge）。
 * 不可加 `export const config = { runtime: ... }`——那是 Next.js API
 * Routes 專屬慣例。
 *
 * 不可用 `export default`：Vercel 目前的 runtime 只看「有沒有具名的
 * fetch/GET/POST 等 export」來判斷是不是 Web 標準 handler，default
 * export 一律當成舊式 (req,res)=>void 處理，回傳的 Response 會被
 * 忽略、連線不結束，最後卡到逾時。改成具名的 fetch export。
 */
export const fetch = handle(app);
