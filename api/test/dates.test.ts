import { afterEach, describe, expect, it, vi } from "vitest";
import { currentMonth, today } from "../src/lib/dates.js";

/**
 * 「今天」以台灣時間判斷，不看伺服器時區。
 * 每日 Cron 排在 UTC 18:00＝台灣凌晨 2 點，那時 UTC 還是前一天；
 * 若照伺服器時區（Vercel 是 UTC），11/5 的扣款會拖到 11/6 才產生。
 */
afterEach(() => vi.useRealTimers());

const at = (iso: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};

describe("today() 以台灣時間判斷", () => {
  it("Cron 執行時（UTC 11/4 18:00＝台灣 11/5 02:00）今天是 11/5", () => {
    at("2026-11-04T18:00:00Z");
    expect(today()).toBe("2026-11-05");
  });

  it("台灣 11/5 23:59 仍是 11/5", () => {
    at("2026-11-05T15:59:00Z");
    expect(today()).toBe("2026-11-05");
  });

  it("跨月：台灣 12/1 凌晨，本月已是 12 月", () => {
    at("2026-11-30T16:30:00Z");
    expect(today()).toBe("2026-12-01");
    expect(currentMonth()).toBe("2026-12");
  });
});
