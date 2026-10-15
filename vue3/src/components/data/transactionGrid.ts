/**
 * 交易列（桌機）的欄寬：日期、圖示、子項目、記帳者、備註、金額、操作。備註一律放在最後（金額前）。
 * 表頭與 TransactionRow 共用這一份，才不會對不齊；readonly（首頁最近交易）不留操作欄。
 */
export const txGridColumns = (readonly = false) =>
  readonly
    ? "84px 34px 120px 72px minmax(0,1fr) 104px"
    : "84px 34px 120px 72px minmax(0,1fr) 104px 72px";
