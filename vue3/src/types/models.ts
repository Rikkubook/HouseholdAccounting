/** 對映《家庭記帳App_資料庫設計.dbml》。金額一律整數（新台幣元，無小數）。 */

export type Role = "admin" | "member";
export type TxType = "expense" | "income";
export type CategoryNature = "floating" | "fixed";
export type BillingCycle = "monthly" | "yearly";

export interface Member {
  id: number;
  name: string;
  account: string;
  role: Role;
  isActive: boolean;
  /** 頭像底色（hex） */
  color: string;
  /** YYYY-MM */
  joinedMonth: string;
  /** 待成員自行重設的 6 位代碼；null 表示沒有待處理的重設要求 */
  resetCode: string | null;
}

export interface SubCategory {
  id: number;
  mainCategoryId: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MainCategory {
  id: number;
  name: string;
  icon: string;
  type: TxType;
  /** 收入分類為 null */
  nature: CategoryNature | null;
  sortOrder: number;
  isActive: boolean;
  /** 系統保留（其他、訂閱）：不可停用、不可改名 */
  isSystem: boolean;
  /** 系統分類識別碼：other =「其他」、subscription =「訂閱」（訂閱只能歸屬此分類） */
  systemKey?: "other" | "subscription" | null;
  /** 啟用年月 YYYY-MM，null 表示自始存在 */
  activeFrom: string | null;
  /** 停用年月 YYYY-MM，null 表示仍啟用 */
  archivedFrom: string | null;
  subCategories: SubCategory[];
}

export interface Transaction {
  id: number;
  type: TxType;
  mainCategoryId: number | null;
  subCategoryId: number | null;
  amount: number;
  /** YYYY-MM-DD，可為未來日期（預定支出） */
  date: string;
  /** 記帳者＝新增當下的登入者，不可代記他人 */
  payerId: number;
  note: string | null;
  createdAt: string;
  /** 軟刪除；前台無復原入口 */
  isDeleted: boolean;
  /** 由訂閱自動產生時記錄來源 */
  sourceSubscriptionId: number | null;
}

export interface TransactionRevision {
  id: number;
  transactionId: number;
  editedBy: number;
  editedAt: string;
  field: string;
  before: string;
  after: string;
}

export interface TransactionDraft {
  type: TxType;
  mainCategoryId: number | null;
  subCategoryId: number | null;
  amount: number;
  date: string;
  note?: string;
}

export interface TransactionPatch {
  mainCategoryId?: number | null;
  subCategoryId?: number | null;
  amount?: number;
  date?: string;
  note?: string | null;
}

export interface Budget {
  id: number;
  /** YYYY-MM */
  month: string;
  mainCategoryId: number;
  amount: number;
}

export interface Subscription {
  id: number;
  name: string;
  amount: number;
  cycle: BillingCycle;
  /** 下次扣款日 YYYY-MM-DD */
  nextChargeDate: string;
  mainCategoryId: number;
  /** 扣款人：標記已扣款時以此人為記帳者 */
  payerId: number;
  isActive: boolean;
}

export interface SubscriptionRevision {
  id: number;
  subscriptionId: number;
  effectiveFrom: string;
  amount: number;
  cycle: BillingCycle;
}

export interface YearExtraExpense {
  id: number;
  year: number;
  name: string;
  amount: number;
  mainCategoryId: number;
  payerId: number;
}

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  net: number;
  fixedTotal: number;
}

export interface CategoryProgress {
  id: number;
  name: string;
  icon: string;
  /** null 表示該月未設預算 */
  budget: number | null;
  spent: number;
  recent: TransactionView[];
}

export interface TransactionView extends Transaction {
  mainCategoryName: string | null;
  subCategoryName: string | null;
  payerName: string;
}

export interface LoginResponse {
  token: string;
  /** token 有效期（秒）；自首次登入起固定 6 個月，不續期 */
  expiresIn: number;
  user: Member;
}

export interface ApiError {
  code: string;
  message: string;
}
