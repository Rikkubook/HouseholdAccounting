import { pgTable, integer, text, boolean, char, date, timestamp } from "drizzle-orm/pg-core";

/**
 * 查詢用的型別表面。權威 DDL 在 sql/0000_init.sql（check 約束、partial index、RLS 無法在此完整表達）。
 * 命名轉換只發生在這個檔案：JS 端 camelCase ↔ DB 端 snake_case。
 */

export const members = pgTable("members", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull(),
  account: text("account").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull(),
  color: char("color", { length: 7 }).notNull(),
  joinedMonth: char("joined_month", { length: 7 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  /** argon2id；永不出現在任何 API 回應。新成員為 null，須先用 resetCode 自設密碼。 */
  passwordHash: text("password_hash"),
  /** token 到期基準；後續登入不更新 */
  firstLoginAt: timestamp("first_login_at", { withTimezone: true }),
  /**
   * 6 位重設碼，明文存放。成員管理頁需顯示待處理代碼給管理者轉達，
   * 因此不可雜湊；風險以「一次性、僅管理者可讀、用畢即清空」控制。
   */
  resetCode: char("reset_code", { length: 6 }),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

export const mainCategories = pgTable("main_categories", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  type: text("type", { enum: ["expense", "income"] }).notNull(),
  /** 收入分類必為 null */
  nature: text("nature", { enum: ["floating", "fixed"] }),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  /** 系統保留「其他」：不可停用、不可改名 */
  isSystem: boolean("is_system").notNull().default(false),
  /** 系統分類識別碼：other =「其他」、subscription =「訂閱」（訂閱只能歸屬此分類） */
  systemKey: text("system_key", { enum: ["other", "subscription"] }),
  /** 啟用年月 YYYY-MM，null = 自始存在 */
  activeFrom: char("active_from", { length: 7 }),
  /** 停用年月 YYYY-MM，null = 仍啟用 */
  archivedFrom: char("archived_from", { length: 7 }),
});

export const subCategories = pgTable("sub_categories", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  mainCategoryId: integer("main_category_id").notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const transactions = pgTable("transactions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  /** 建立後不可修改 */
  type: text("type", { enum: ["expense", "income"] }).notNull(),
  mainCategoryId: integer("main_category_id"),
  subCategoryId: integer("sub_category_id"),
  amount: integer("amount").notNull(),
  /** 可為未來日期（預定支出） */
  date: date("date").notNull(),
  /** 記帳者＝新增當下登入者；不可代記、不可事後修改 */
  payerId: integer("payer_id").notNull(),
  note: text("note"),
  /**
   * 分類名稱快照：記帳當下凍結，分類之後改名也不影響歷史紀錄的顯示。
   * 只在使用者修正該筆的分類時重寫。
   */
  mainCategoryName: text("main_category_name"),
  subCategoryName: text("sub_category_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** 軟刪除；不計入任何統計 */
  isDeleted: boolean("is_deleted").notNull().default(false),
  sourceSubscriptionId: integer("source_subscription_id"),
});

export const transactionRevisions = pgTable("transaction_revisions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  transactionId: integer("transaction_id").notNull(),
  editedBy: integer("edited_by").notNull(),
  editedAt: timestamp("edited_at", { withTimezone: true }).notNull().defaultNow(),
  field: text("field").notNull(),
  before: text("before").notNull(),
  after: text("after").notNull(),
});

export const budgets = pgTable("budgets", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  month: char("month", { length: 7 }).notNull(),
  mainCategoryId: integer("main_category_id").notNull(),
  amount: integer("amount").notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  cycle: text("cycle", { enum: ["monthly", "yearly"] }).notNull(),
  nextChargeDate: date("next_charge_date").notNull(),
  /** 原本的扣款日（1–31）：遇月底不足只在該月夾齊，下一個足月份回到原日 */
  chargeDay: integer("charge_day").notNull(),
  mainCategoryId: integer("main_category_id").notNull(),
  /** 扣款人：標記已扣款時以此人為新增交易的記帳者 */
  payerId: integer("payer_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const subscriptionRevisions = pgTable("subscription_revisions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  subscriptionId: integer("subscription_id").notNull(),
  effectiveFrom: char("effective_from", { length: 7 }).notNull(),
  amount: integer("amount").notNull(),
  cycle: text("cycle", { enum: ["monthly", "yearly"] }).notNull(),
});

export const yearExtraExpenses = pgTable("year_extra_expenses", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  year: integer("year").notNull(),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  mainCategoryId: integer("main_category_id").notNull(),
  payerId: integer("payer_id").notNull(),
});

export type MemberRow = typeof members.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type MainCategoryRow = typeof mainCategories.$inferSelect;
export type SubCategoryRow = typeof subCategories.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
