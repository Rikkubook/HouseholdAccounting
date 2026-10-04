import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import postgres from "postgres";
import { TEST_DATABASE_URL, TEST_DB_PORT } from "../vitest.config.js";

const apiRoot = resolve(import.meta.dirname, "..");
const workDir = join(tmpdir(), "family-ledger-test-pg");
const dataDir = join(workDir, "data");

/**
 * PostgreSQL 執行檔來自 embedded-postgres 的平台套件，但不能在原地執行：
 * 專案路徑含中文，initdb 會把 cp950 編碼的路徑寫進 UTF-8 的 bootstrap SQL 而失敗。
 * 所以先把執行檔複製到暫存資料夾（純英文路徑），只在版本變了時重新複製。
 */
function postgresBinDir(): string {
  const req = createRequire(createRequire(import.meta.url).resolve("embedded-postgres"));
  const platform = process.platform === "win32" ? "windows" : process.platform;
  // 套件只匯出 dist/index.js，套件根目錄＝它的上兩層
  const pkgRoot = dirname(dirname(req.resolve(`@embedded-postgres/${platform}-${process.arch}`)));
  const { version } = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as { version: string };
  const target = join(tmpdir(), "family-ledger-pg-bin", version);
  if (!existsSync(join(target, "bin"))) {
    cpSync(join(pkgRoot, "native"), target, { recursive: true });
  }
  return join(target, "bin");
}

const exe = (bin: string, name: string) => join(bin, process.platform === "win32" ? name + ".exe" : name);

let pgCtl: string | undefined;

/**
 * 每次測試都從空資料夾起一個全新的本機 PostgreSQL，跑正式的建表 SQL 與 seed。
 * 只聽 127.0.0.1、用 trust 驗證，結束就刪掉，永遠不碰 .env 裡的 Supabase。
 */
export async function setup() {
  const bin = postgresBinDir();
  pgCtl = exe(bin, "pg_ctl");

  // 上次異常中斷留下的伺服器先停掉
  if (existsSync(dataDir)) {
    try {
      execFileSync(pgCtl, ["stop", "-D", dataDir, "-m", "immediate"], { stdio: "ignore" });
    } catch {}
  }
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });

  // 固定 UTF-8 + C locale：Windows 預設的中文語系會讓 initdb 失敗
  execFileSync(
    exe(bin, "initdb"),
    ["-D", dataDir, "-U", "postgres", "--auth=trust", "--encoding=UTF8", "--locale=C"],
    { stdio: "pipe" }
  );
  writeFileSync(join(dataDir, "postgresql.auto.conf"), `port = ${TEST_DB_PORT}\nlisten_addresses = '127.0.0.1'\n`);
  // stdio 必須是 ignore：Windows 上背景的 postgres 會繼承管線，用 pipe 會讓 execFileSync 永遠等不到結束
  execFileSync(pgCtl, ["start", "-D", dataDir, "-w", "-l", join(workDir, "server.log")], { stdio: "ignore" });

  const admin = postgres(`postgresql://postgres@127.0.0.1:${TEST_DB_PORT}/postgres`, { max: 1, onnotice: () => {} });
  await admin.unsafe("create database ledger_test");
  await admin.end();

  // 用 tsx 子程序跑 push.ts／seed.ts，和平常 `pnpm db:push`、`pnpm db:seed` 走同一條路
  const env = {
    ...process.env,
    DATABASE_URL: TEST_DATABASE_URL,
    JWT_SECRET: "test-secret-test-secret-test-secret-0000",
    SEED_ADMIN_PASSWORD: "1234",
    TZ: "Asia/Taipei",
  };
  const tsx = join(apiRoot, "node_modules", "tsx", "dist", "cli.mjs");
  for (const script of ["src/db/push.ts", "src/db/seed.ts"]) {
    execFileSync(process.execPath, [tsx, script], { cwd: apiRoot, env, stdio: "pipe" });
  }
}

export async function teardown() {
  if (pgCtl) execFileSync(pgCtl, ["stop", "-D", dataDir, "-m", "fast"], { stdio: "ignore" });
  rmSync(workDir, { recursive: true, force: true });
}
