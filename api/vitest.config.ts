import { defineConfig } from "vitest/config";

/**
 * 測試一律打本機的 embedded-postgres（見 test/global-setup.ts），永遠不碰 .env 裡的 Supabase。
 * 這裡的 env 會覆蓋 dotenv 讀到的值（dotenv 不覆寫已存在的變數）。
 */
export const TEST_DB_PORT = 54329;
export const TEST_DATABASE_URL = `postgresql://postgres:test@127.0.0.1:${TEST_DB_PORT}/ledger_test`;

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: "test-secret-test-secret-test-secret-0000",
      SEED_ADMIN_PASSWORD: "1234",
      // today() 用伺服器時區；固定成台灣，快照才不會因機器時區而變
      TZ: "Asia/Taipei",
      VERCEL: "",
    },
    // 所有測試共用同一個資料庫，不可平行跑
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
