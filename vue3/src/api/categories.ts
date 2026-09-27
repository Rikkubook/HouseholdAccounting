import { http } from "./client";
import type { MainCategory, TxType, CategoryNature } from "@/types/models";

export interface MainCategoryDraft {
  name: string;
  icon: string;
  type: TxType;
  nature: CategoryNature | null;
}

export const categoriesApi = {
  list: (includeArchived = true) =>
    http.get<MainCategory[]>("/categories", { params: { includeArchived } }).then((r) => r.data),

  createMain: (draft: MainCategoryDraft) =>
    http.post<MainCategory>("/categories", draft).then((r) => r.data),

  updateMain: (id: number, patch: Partial<MainCategoryDraft>) =>
    http.patch<MainCategory>("/categories/" + id, patch).then((r) => r.data),

  /** 只能停用，不提供刪除；歷史交易保留原分類。 */
  archiveMain: (id: number) =>
    http.post<MainCategory>("/categories/" + id + "/archive").then((r) => r.data),

  restoreMain: (id: number) =>
    http.post<MainCategory>("/categories/" + id + "/restore").then((r) => r.data),

  reorderMain: (orderedIds: number[]) =>
    http.post<void>("/categories/reorder", { orderedIds }).then((r) => r.data),

  /** 歸屬主分類只在新增時決定，不可搬移。 */
  createSub: (mainCategoryId: number, name: string) =>
    http.post<MainCategory>("/categories/" + mainCategoryId + "/subs", { name }).then((r) => r.data),

  renameSub: (subId: number, name: string) =>
    http.patch<MainCategory>("/categories/subs/" + subId, { name }).then((r) => r.data),

  archiveSub: (subId: number) =>
    http.post<MainCategory>("/categories/subs/" + subId + "/archive").then((r) => r.data),

  restoreSub: (subId: number) =>
    http.post<MainCategory>("/categories/subs/" + subId + "/restore").then((r) => r.data),

  reorderSub: (mainCategoryId: number, orderedIds: number[]) =>
    http.post<void>("/categories/" + mainCategoryId + "/subs/reorder", { orderedIds }).then((r) => r.data),
};
