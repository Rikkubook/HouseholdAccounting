import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL 必須是完整連線字串"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET 至少 32 字元"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  PORT: z.coerce.number().int().default(8787),
  SEED_ADMIN_ACCOUNT: z.string().default("dad"),
  SEED_ADMIN_NAME: z.string().default("先生"),
  SEED_ADMIN_CODE: z.string().regex(/^\d{6}$/).default("123456"),
  // 初始管理者密碼。正式部署務必在 Vercel 環境變數改掉，登入後再於 App 內自行更換。
  SEED_ADMIN_PASSWORD: z.string().min(4, "SEED_ADMIN_PASSWORD 至少 4 字元").default("1234"),
  // Vercel Cron 的呼叫憑證。未設定時 /api/cron/* 一律回 403。
  CRON_SECRET: z.string().min(16).optional(),
  // 每週備份的上傳目標（Supabase Storage）。兩者缺一時備份端點只試算不上傳。
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().min(20).optional(),
  BACKUP_BUCKET: z.string().default("ledger-backups"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => "  " + i.path.join(".") + " — " + i.message);
  console.error("環境變數設定有誤：\n" + lines.join("\n"));
  // serverless 不能 process.exit（會讓 function 無訊息中止），拋錯讓平台記錄
  if (process.env.VERCEL) throw new Error("環境變數設定有誤");
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
