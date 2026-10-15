/**
 * 交易列（桌機）的欄寬：日期、圖示、子項目、記帳者、備註、金額、操作。備註一律放在最後（金額前）。
 * 表頭與 TransactionRow 共用這一份，才不會對不齊；readonly（首頁最近交易）不留操作欄。
 * 最窄的桌機（768px，扣掉側欄與留白約剩 452px）也要放得下：只有子項目、備註兩欄會伸縮，其餘固定。
 */
const BASE = "64px 26px minmax(56px,1fr) 56px minmax(48px,1.5fr) 80px";
export const txGridColumns = (readonly = false) => (readonly ? BASE : BASE + " 64px");
