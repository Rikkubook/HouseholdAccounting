import { eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { budgets, mainCategories, subscriptions, transactions, yearExtraExpenses } from "../db/schema.js";

/**
 * 帳本範圍：家庭帳（owner_id 為 null）或某位成員的個人帳（sql/0002）。
 *
 * 所有查交易、分類、預算、訂閱、年度額外支出的地方都必須套用這裡的條件，
 * 不要各自手寫 owner_id 判斷——漏掉一處，個人帳就會被算進全家數字，或被別人看到。
 * 個人帳第 0 批只有家庭帳，所有呼叫端都用預設的 FAMILY。
 */
export type Scope = { kind: "family" } | { kind: "personal"; ownerId: number };

export const FAMILY: Scope = { kind: "family" };

/** 交易：直接看 transactions.owner_id */
export const txScope = (scope: Scope = FAMILY) =>
  scope.kind === "family" ? isNull(transactions.ownerId) : eq(transactions.ownerId, scope.ownerId);

/** 分類：直接看 main_categories.owner_id */
export const categoryScope = (scope: Scope = FAMILY) =>
  scope.kind === "family" ? isNull(mainCategories.ownerId) : eq(mainCategories.ownerId, scope.ownerId);

/** 該範圍的分類 id（子查詢），供掛在分類上的表使用 */
const scopedCategoryIds = (scope: Scope) =>
  db.select({ id: mainCategories.id }).from(mainCategories).where(categoryScope(scope));

/** 預算、訂閱、年度額外支出沒有自己的 owner_id：分類屬於哪個範圍，它們就屬於哪個範圍 */
export const budgetScope = (scope: Scope = FAMILY) => inArray(budgets.mainCategoryId, scopedCategoryIds(scope));
export const subscriptionScope = (scope: Scope = FAMILY) =>
  inArray(subscriptions.mainCategoryId, scopedCategoryIds(scope));
export const yearExtraScope = (scope: Scope = FAMILY) =>
  inArray(yearExtraExpenses.mainCategoryId, scopedCategoryIds(scope));
