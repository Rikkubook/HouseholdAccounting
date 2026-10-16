import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { badRequest } from "../lib/errors.js";
import type { MainCategory } from "@family-ledger/shared";
import { db } from "../db/index.js";
import { mainCategories, subCategories } from "../db/schema.js";
import { categoryScope, FAMILY, type Scope } from "./scope.js";

/** 組出巢狀的 MainCategory[]（含 subCategories），排序依 sortOrder。 */
export async function listCategories(includeArchived = true, scope: Scope = FAMILY): Promise<MainCategory[]> {
  const mains = await db
    .select()
    .from(mainCategories)
    .where(categoryScope(scope))
    .orderBy(asc(mainCategories.sortOrder), asc(mainCategories.id));
  const subs = mains.length
    ? await db
        .select()
        .from(subCategories)
        .where(
          inArray(
            subCategories.mainCategoryId,
            mains.map((m) => m.id)
          )
        )
        .orderBy(asc(subCategories.sortOrder), asc(subCategories.id))
    : [];

  const grouped = new Map<number, MainCategory["subCategories"]>();
  for (const s of subs) {
    const list = grouped.get(s.mainCategoryId) ?? [];
    list.push(s);
    grouped.set(s.mainCategoryId, list);
  }

  return mains
    .filter((m) => includeArchived || m.isActive)
    .map((m) => ({ ...m, subCategories: grouped.get(m.id) ?? [] }));
}

export async function findCategory(id: number): Promise<MainCategory | null> {
  const [main] = await db.select().from(mainCategories).where(eq(mainCategories.id, id)).limit(1);
  if (!main) return null;
  const subs = await db
    .select()
    .from(subCategories)
    .where(eq(subCategories.mainCategoryId, id))
    .orderBy(asc(subCategories.sortOrder), asc(subCategories.id));
  return { ...main, subCategories: subs };
}

/** 該帳本的系統分類「訂閱」（家庭：sql/0001；個人：第一次使用時自動建立）。訂閱沒指定分類時記在這裡。 */
export async function subscriptionCategoryId(scope: Scope): Promise<number> {
  if (scope.kind === "personal") await ensurePersonalDefaults(scope.ownerId);
  const [cat] = await db
    .select({ id: mainCategories.id })
    .from(mainCategories)
    .where(and(eq(mainCategories.systemKey, "subscription"), categoryScope(scope)))
    .limit(1);
  if (!cat) throw new Error("找不到系統分類「訂閱」，請先執行 db:push");
  return cat.id;
}

/**
 * 訂閱要記到的分類：沒指定就是「訂閱」；指定的話必須是同一本帳、啟用中的固定支出分類。
 * 停用的分類不能選，分類停用時底下的訂閱會改回「訂閱」，所以不會有訂閱記到停用分類。
 */
export async function resolveSubscriptionCategory(scope: Scope, requested?: number): Promise<number> {
  if (requested == null) return subscriptionCategoryId(scope);
  const [cat] = await db.select().from(mainCategories).where(eq(mainCategories.id, requested)).limit(1);
  if (!cat || !isInScope(cat, scope) || cat.type !== "expense" || cat.nature !== "fixed" || !cat.isActive) {
    throw badRequest("訂閱只能記在這本帳啟用中的固定支出分類");
  }
  return cat.id;
}

/** 分類是否屬於這個帳本：家庭分類 owner_id 為 null，個人分類 owner_id 為本人 */
export const isInScope = (cat: { ownerId: number | null }, scope: Scope) =>
  scope.kind === "family" ? cat.ownerId == null : cat.ownerId === scope.ownerId;

/** 分類所屬的帳本 */
export const scopeOfCategory = (cat: { ownerId: number | null }): Scope =>
  cat.ownerId == null ? FAMILY : { kind: "personal", ownerId: cat.ownerId };

/** 每本帳都有的系統分類：「其他」（浮動）與「訂閱」（固定，個人訂閱一律記在這裡） */
export const PERSONAL_SYSTEM_CATEGORIES = [
  { systemKey: "subscription" as const, name: "訂閱", icon: "autorenew", nature: "fixed" as const, sortOrder: 998 },
  { systemKey: "other" as const, name: "其他", icon: "category", nature: "floating" as const, sortOrder: 999 },
];

/**
 * 個人帳第一次使用時只建立必要的系統分類「其他」「訂閱」，其餘由本人自己新增
 * （2026-10-15 使用者決定）。可重複呼叫；併發時由 (owner_id, system_key) 唯一索引擋下重複。
 */
export async function ensurePersonalDefaults(ownerId: number): Promise<void> {
  const existing = await db
    .select({ systemKey: mainCategories.systemKey })
    .from(mainCategories)
    .where(and(eq(mainCategories.ownerId, ownerId), isNotNull(mainCategories.systemKey)));
  const missing = PERSONAL_SYSTEM_CATEGORIES.filter((d) => !existing.some((e) => e.systemKey === d.systemKey));
  if (!missing.length) return;

  await db
    .insert(mainCategories)
    .values(
      missing.map((d) => ({
        name: d.name,
        icon: d.icon,
        type: "expense" as const,
        nature: d.nature,
        sortOrder: d.sortOrder,
        isSystem: true,
        systemKey: d.systemKey,
        ownerId,
      }))
    )
    .onConflictDoNothing();
}
