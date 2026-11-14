import { summaryApi, type StatsPayload } from "@/api/summary";
import type { Member } from "@/types/models";

export type ShareExtra = StatsPayload["extras"][number];

/**
 * 查某個月的統計，以及各成員當月支出（含其負責的固定支出與年度額外開銷），順序同 activeMembers。
 * 年度額外開銷依付款日期歸月（未填日期當作該年 1 月），算進付款人的花費；
 * stats.total 本身不含年度額外開銷，所以另外回傳含額外開銷的 shareTotal 給支出比例卡片。
 * 個人帳只有自己的支出，不必逐一查各成員。
 */
export async function loadMonthShares(
  month: string,
  activeMembers: Member[],
  personalUserId: number | null
): Promise<{ stats: StatsPayload; memberTotals: number[]; shareTotal: number; extras: ShareExtra[] }> {
  const extrasOf = (stats: StatsPayload, payerId: number) =>
    stats.extras.filter((e) => e.payerId === payerId).reduce((sum, e) => sum + e.amount, 0);

  if (personalUserId !== null) {
    const stats = await summaryApi.stats("month", month);
    const extrasSum = stats.extras.reduce((sum, e) => sum + e.amount, 0);
    return {
      stats,
      memberTotals: activeMembers.map((m) => (m.id === personalUserId ? stats.total + extrasSum : 0)),
      shareTotal: stats.total + extrasSum,
      extras: stats.extras,
    };
  }
  const [stats, ...perMember] = await Promise.all([
    summaryApi.stats("month", month),
    ...activeMembers.map((m) => summaryApi.stats("month", month, m.id)),
  ]);
  const extrasSum = stats.extras.reduce((sum, e) => sum + e.amount, 0);
  return {
    stats,
    memberTotals: perMember.map((p, i) => p.total + extrasOf(stats, activeMembers[i]!.id)),
    shareTotal: stats.total + extrasSum,
    extras: stats.extras,
  };
}
