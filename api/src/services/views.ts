import { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { TransactionView } from "@family-ledger/shared";
import { db } from "../db/index.js";
import { members, transactions } from "../db/schema.js";
import { today } from "../lib/dates.js";
import { txScope } from "./scope.js";

/**
 * TransactionView 的分類名稱取自記帳當下的快照，不 join 分類表——
 * 分類日後改名不改動歷史紀錄的顯示（specs/13 待確認 1 已定案）。
 * 成員名稱仍然 join：成員改名是同一人換稱呼，不是換人。
 * 輸入者另外 left join（null = 系統自動產生），管理者代記時才看得出是誰輸入的。
 */
const creators = alias(members, "creators");

const viewColumns = {
  id: transactions.id,
  type: transactions.type,
  mainCategoryId: transactions.mainCategoryId,
  subCategoryId: transactions.subCategoryId,
  amount: transactions.amount,
  date: transactions.date,
  payerId: transactions.payerId,
  note: transactions.note,
  createdAt: transactions.createdAt,
  isDeleted: transactions.isDeleted,
  sourceSubscriptionId: transactions.sourceSubscriptionId,
  createdBy: transactions.createdBy,
  mainCategoryName: transactions.mainCategoryName,
  subCategoryName: transactions.subCategoryName,
  payerName: members.name,
  createdByName: creators.name,
};

type ViewRow = Awaited<ReturnType<typeof transactionViewQuery>>[number];

export const transactionViewQuery = () =>
  db
    .select(viewColumns)
    .from(transactions)
    .innerJoin(members, eq(members.id, transactions.payerId))
    .leftJoin(creators, eq(creators.id, transactions.createdBy));

export const toView = (row: ViewRow): TransactionView => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  payerName: row.payerName ?? "",
});

export async function findView(id: number): Promise<TransactionView | null> {
  const [row] = await transactionViewQuery().where(eq(transactions.id, id)).limit(1);
  return row ? toView(row) : null;
}

/** 某成員在期間內的最近 n 筆（供分類進度卡片的預覽用）。 */
export async function recentByCategory(
  mainCategoryId: number,
  start: string,
  end: string,
  limit: number
): Promise<TransactionView[]> {
  const rows = await transactionViewQuery()
    .where(
      and(
        eq(transactions.isDeleted, false),
        txScope(),
        eq(transactions.mainCategoryId, mainCategoryId),
        gte(transactions.date, start),
        lt(transactions.date, end)
      )
    )
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(limit);
  return rows.map(toView);
}

export const intSum = (column: typeof transactions.amount) =>
  sql<number>`coalesce(sum(${column}), 0)::int`;

/**
 * 未來日期的交易不計入任何彙總，等日期到達當天才計入（specs/04 規則 9）。
 * 交易列表仍會列出，只是不進統計——預定支出是「已排定」而非「已花」。
 */
export const notFuture = () => lte(transactions.date, today());

/** 反向條件：只取未來日期，供「已排定」金額單獨呈現。 */
export const onlyFuture = () => gte(transactions.date, nextDay());

function nextDay(): string {
  const d = new Date(today() + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type { ViewRow };
