/**
 * 暫時的診斷用計時器：首頁、年度彙整都曾整支卡到 15 秒逾時，代表卡住的
 * 是某個具體查詢真的沒有回應，不是單純變慢。用這個包住查詢，下次卡住
 * 時 Vercel function log 會直接顯示哪一支「start」了卻沒有對應的
 * 「done」。確認原因後這支檔案跟所有呼叫處可以一併拿掉。
 */
export function timed<T>(label: string, promise: Promise<T>): Promise<T> {
  const startedAt = Date.now();
  console.log("[timed] start " + label);
  return promise
    .then((result) => {
      console.log("[timed] done  " + label + " (" + (Date.now() - startedAt) + "ms)");
      return result;
    })
    .catch((err) => {
      console.log("[timed] fail  " + label + " (" + (Date.now() - startedAt) + "ms)");
      throw err;
    });
}
