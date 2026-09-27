import { handle } from "hono/vercel";
import { app } from "../src/app";

/** Node runtime——argon2 與 postgres.js 都需要 Node API，不能用 edge。 */
export const config = { runtime: "nodejs" };

export default handle(app);
