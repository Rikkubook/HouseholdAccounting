import { env } from "../env.js";
import { buildDashboard } from "./dashboard.js";

/**
 * 每月 10、20、30 號在家庭 LINE 群組發「家庭帳剩餘額度」。
 * 2 月沒有 30 號，改在月底最後一天發。排程見 api/vercel.json（cron/budget-reminder）。
 */

/** 台灣今天（YYYY-MM-DD）。不依伺服器時區：Vercel 跑在 UTC。 */
export function taipeiToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(now);
}

const lastDayOfMonth = (date: string) =>
  new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).getUTCDate();

/** 這天要不要發：10、20、30 號；沒有 30 號的月份（2 月）改在最後一天。 */
export function isReminderDay(date: string): boolean {
  const day = Number(date.slice(8, 10));
  if (day === 10 || day === 20 || day === 30) return true;
  return lastDayOfMonth(date) < 30 && day === lastDayOfMonth(date);
}

const fmt = (n: number) => n.toLocaleString("en-US");
const remainLabel = (budget: number, spent: number) =>
  spent > budget ? "超出 " + fmt(spent - budget) : "剩 " + fmt(budget - spent);

const TITLE = "家庭帳剩餘額度  💰";
const RED = "#E53935";

/** 一行分類：main 是「食 14,943 / 18,000」，note 是括號內的剩餘／超出（Flex 版標紅字）。 */
type Row = { main: string; note?: string };

/** LINE 推播用的訊息物件（Flex Message）。 */
export type LineMessage = { type: "flex"; altText: string; contents: unknown };

/**
 * 訊息內容，例如：
 *   10/25 家庭帳剩餘額度  💰            ← 粗體
 *
 *   食 14,943 / 18,000（剩 3,057）      ← 括號內紅字
 *   其他 1,575 / 1,500（超出 75）
 *
 *   本月結餘: 11,475                   ← 粗體，與首頁「淨結餘」相同（收入 − 支出）
 * 只算已發生的支出（未來日期的預定支出不算），與首頁一致。
 * 有預算但本月還沒花錢的分類不列出，讓訊息短一點。
 * LINE 純文字訊息不能上色、加粗，所以發 Flex Message；text 是同內容的純文字版，
 * 用在通知預覽（altText）與 dryRun 回傳。
 */
export async function buildBudgetReminder(date: string): Promise<{ text: string; message: LineMessage }> {
  const { summary, categories } = await buildDashboard(date.slice(0, 7));
  const day = date.slice(5, 7) + "/" + date.slice(8, 10);
  const rows: Row[] = [];

  for (const c of categories) {
    if (c.spent === 0) continue;
    // 沒設預算但有花費的分類也列出來，不然這筆錢在通知裡看不到
    if (c.budget === null) rows.push({ main: c.name + " " + fmt(c.spent) + " / 未設預算" });
    else rows.push({ main: c.name + " " + fmt(c.spent) + " / " + fmt(c.budget), note: "（" + remainLabel(c.budget, c.spent) + "）" });
  }
  const net = "本月結餘: " + fmt(summary.net);

  const title = day + " " + TITLE;
  const text = [title, "", ...rows.map((r) => r.main + (r.note ?? "")), "", net].join("\n");
  const message: LineMessage = {
    type: "flex",
    altText: text,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: title, weight: "bold", wrap: true },
          ...rows.map((r, i) => ({
            type: "text",
            wrap: true,
            // 標題下空一行
            ...(i === 0 ? { margin: "xl" } : {}),
            contents: [
              { type: "span", text: r.main },
              ...(r.note ? [{ type: "span", text: r.note, color: RED }] : []),
            ],
          })),
          { type: "text", text: net, weight: "bold", margin: "xl" },
        ],
      },
    },
  };
  return { text, message };
}

export type SendResult = { sent: true } | { sent: false; reason: string };

/** 用家用機器人推播到家庭群組（LINE Messaging API push）。金鑰只從環境變數讀，不記進 log。 */
export async function sendLineMessage(message: LineMessage): Promise<SendResult> {
  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = env.LINE_NOTIFY_TO;
  if (!token || !to) return { sent: false, reason: "未設定 LINE_CHANNEL_ACCESS_TOKEN 或 LINE_NOTIFY_TO" };

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ to, messages: [message] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error("LINE 推播失敗（HTTP " + res.status + "）" + body.slice(0, 200));
  }
  return { sent: true };
}
