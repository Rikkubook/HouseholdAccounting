import { summaryApi, type StatsPayload } from "@/api/summary";
import type { Member } from "@/types/models";

/**
 * 查某個月的統計，以及各成員當月支出（含其負責的固定支出），順序同 activeMembers。
 * 個人帳只有自己的支出，不必逐一查各成員。
 */
export async function loadMonthShares(
  month: string,
  activeMembers: Member[],
  personalUserId: number | null
): Promise<{ stats: StatsPayload; memberTotals: number[] }> {
  if (personalUserId !== null) {
    const stats = await summaryApi.stats("month", month);
    return { stats, memberTotals: activeMembers.map((m) => (m.id === personalUserId ? stats.total : 0)) };
  }
  const [stats, ...perMember] = await Promise.all([
    summaryApi.stats("month", month),
    ...activeMembers.map((m) => summaryApi.stats("month", month, m.id)),
  ]);
  return { stats, memberTotals: perMember.map((p) => p.total) };
}
