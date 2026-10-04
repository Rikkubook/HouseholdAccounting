import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { env } from "../env.js";

const here = dirname(fileURLToPath(import.meta.url));
const sqlDir = resolve(here, "../../sql");

// 多語句 DDL 必須跑在單一連線上（max: 1），否則 postgres.js 會拒絕當作不安全的隱性交易。
// onnotice：重複執行時的「已存在，略過」NOTICE 不印出來
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });

// 依檔名順序執行 sql/ 下所有檔案；每支都必須冪等，可對既有資料庫重複執行
const files = (await readdir(sqlDir)).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  await sql.unsafe(await readFile(resolve(sqlDir, file), "utf8"));
  console.log("已執行 sql/" + file);
}
await sql.end();
