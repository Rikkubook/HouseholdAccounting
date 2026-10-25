import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { isReminderDay, taipeiToday } from "../src/services/budgetReminder.js";
import { freezeToday } from "./helpers.js";

/**
 * 每月 10、20、30 號（2 月改月底）用家用 LINE 機器人在家庭群組發剩餘額度。
 * LINE 的推播用 fetch 攔下來檢查內容，不會真的連到 LINE。
 */
beforeAll(() => freezeToday());
afterEach(() => vi.restoreAllMocks());

const cron = (query: string, secret = "test-cron-secret-0000") =>
  app.request("/api/cron/budget-reminder" + query, { headers: { Authorization: "Bearer " + secret } });

describe("哪幾天發", () => {
  it.each([
    ["2026-10-10", true],
    ["2026-10-20", true],
    ["2026-10-30", true],
    ["2026-10-28", false],
    ["2026-10-31", false],
    ["2027-02-28", true], // 平年 2 月沒有 30 號：月底發
    ["2028-02-28", false], // 閏年 2 月還有 29 號
    ["2028-02-29", true],
    ["2026-04-29", false], // 4 月有 30 號，29 號不發
  ])("%s → %s", (date, expected) => {
    expect(isReminderDay(date)).toBe(expected);
  });

  it("台灣日期不受伺服器時區影響：UTC 前一天 16:30 已是台灣隔天", () => {
    expect(taipeiToday(new Date("2026-10-19T16:30:00Z"))).toBe("2026-10-20");
  });
});

describe("GET /cron/budget-reminder", () => {
  it("沒帶排程憑證回 401", async () => {
    expect((await cron("?date=2026-09-10", "wrong")).status).toBe(401);
  });

  it("不是發送日就跳過，不發 LINE", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await cron("?date=2026-09-11");
    expect(await res.json()).toEqual({ date: "2026-09-11", skipped: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("訊息格式：日期、標題、分類 花費 / 預計（剩 N）、空行、本月結餘", async () => {
    const res = await cron("?date=2026-09-10&dryRun=1");
    const body = (await res.json()) as { text: string; sent: boolean };
    expect(body.sent).toBe(false);
    expect(body.text).toMatchSnapshot();
    const lines = body.text.split("\n");
    expect(lines[0]).toBe("09/10 家庭帳剩餘額度  💰");
    expect(lines[1]).toBe("");
    expect(lines.at(-2)).toBe("");
    expect(lines.at(-1)).toMatch(/^本月結餘: -?[\d,]+$/);
    for (const line of lines.slice(2, -2)) {
      expect(line).toMatch(/^\S+ [\d,]+ \/ ([\d,]+（(剩|超出) [\d,]+）|未設預算)$/);
      // 還沒花錢的分類不列
      expect(line).not.toMatch(/^\S+ 0 \//);
    }
    expect(body.text).not.toContain("衣 ");
  });

  it("發送：用機器人推播到 LINE_NOTIFY_TO，帶 Channel access token", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const res = await cron("?date=2026-09-20");
    const body = (await res.json()) as { text: string; sent: boolean };
    expect(body.sent).toBe(true);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.line.me/v2/bot/message/push");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer test-line-token");
    const sent = JSON.parse(init!.body as string);
    expect(sent.to).toBe("C0123456789abcdef0123456789abcdef");
    expect(sent.messages).toHaveLength(1);
    // 純文字不能上色、加粗，改發 Flex；通知預覽用純文字版
    const [msg] = sent.messages;
    expect(msg.type).toBe("flex");
    expect(msg.altText).toBe(body.text);

    const texts = msg.contents.body.contents;
    expect(texts[0]).toMatchObject({ text: "09/20 家庭帳剩餘額度  💰", weight: "bold" });
    expect(texts[0].color).toBeUndefined(); // 黑色（預設色）
    expect(texts.at(-1)).toMatchObject({ text: expect.stringMatching(/^本月結餘: /), weight: "bold" });
    // 括號內（剩／超出）標紅字，前面的「分類 花費 / 預計」不上色
    const spans = texts.flatMap((t: { contents?: { text: string; color?: string }[] }) => t.contents ?? []);
    const notes = spans.filter((s: { text: string }) => s.text.startsWith("（"));
    expect(notes.length).toBeGreaterThan(0);
    for (const s of spans) expect(s.color).toBe(s.text.startsWith("（") ? "#E53935" : undefined);
  });

  it("LINE 回錯誤時回 500，不吞掉", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"message":"Invalid token"}', { status: 401 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await cron("?date=2026-09-20")).status).toBe(500);
  });
});
