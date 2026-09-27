import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { env } from "../env.js";

const here = dirname(fileURLToPath(import.meta.url));

// 多語句 DDL 必須跑在單一連線上（max: 1），否則 postgres.js 會拒絕當作不安全的隱性交易。
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

const ddl = await readFile(resolve(here, "../../sql/0000_init.sql"), "utf8");
await sql.unsafe(ddl);
console.log("schema 已建立（sql/0000_init.sql）");
await sql.end();
