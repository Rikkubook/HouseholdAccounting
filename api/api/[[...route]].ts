import { handle } from "hono/vercel";
import { app } from "../src/app.js";

/**
 * Node.js 是獨立 Vercel Function 的預設 runtime（argon2 與 postgres.js
 * 都需要真正的 Node API，不能用 edge）。
 * 不可加 `export const config = { runtime: ... }`——那是 Next.js API
 * Routes 專屬慣例，寫在這裡會讓 Vercel 誤判成舊式 (req,res)=>void
 * 簽名，Hono 回傳的 Response 會被忽略，連線不結束直到逾時。
 */
export default handle(app);
