import { asc, eq } from "drizzle-orm";
import type { MainCategory } from "@family-ledger/shared";
import { db } from "../db/index.js";
import { mainCategories, subCategories } from "../db/schema.js";
import { categoryScope } from "./scope.js";

/** 組出巢狀的 MainCategory[]（含 subCategories），排序依 sortOrder。 */
export async function listCategories(includeArchived = true): Promise<MainCategory[]> {
  const [mains, subs] = await Promise.all([
    db
      .select()
      .from(mainCategories)
      .where(categoryScope())
      .orderBy(asc(mainCategories.sortOrder), asc(mainCategories.id)),
    db.select().from(subCategories).orderBy(asc(subCategories.sortOrder), asc(subCategories.id)),
  ]);

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
