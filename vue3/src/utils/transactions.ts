import type { TransactionView } from "@/types/models";

/** 手機版交易清單：依日期分組（保持原本順序），附當日支出小計。交易列表與首頁最近交易共用。 */
export function groupByDate(items: TransactionView[]) {
  const map = new Map<string, TransactionView[]>();
  for (const tx of items) {
    const list = map.get(tx.date) ?? [];
    list.push(tx);
    map.set(tx.date, list);
  }
  return [...map.entries()].map(([date, list]) => ({
    date,
    items: list,
    subtotal: list.reduce((sum, t) => sum + (t.type === "expense" ? t.amount : 0), 0),
  }));
}
