import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from "axios";
import { http, TOKEN_KEY } from "@/api/client";
import * as db from "./data";
import type {
  MainCategory,
  Subscription,
  Transaction,
  TransactionView,
  YearExtraExpense,
} from "@/types/models";
import {
  INSTALLMENTS,
  installmentIndex,
  monthlyEquivalent,
  nextAnnualChargeDate,
} from "@/utils/format";

/**
 * 開發用假後端：直接替換 axios adapter，路由與回傳形狀與真後端一致，
 * 移除 VITE_USE_MOCK 即可切換到真 API，不需改動任何 store 或畫面。
 */

let currentUserId = 1;
let seq = 9000;

function view(tx: Transaction): TransactionView {
  const cat = db.categories.find((c) => c.id === tx.mainCategoryId);
  const sub = cat?.subCategories.find((s) => s.id === tx.subCategoryId);
  return {
    ...tx,
    mainCategoryName: cat?.name ?? null,
    subCategoryName: sub?.name ?? null,
    payerName: db.members.find((m) => m.id === tx.payerId)?.name ?? "—",
    createdByName: tx.createdBy == null ? null : db.members.find((m) => m.id === tx.createdBy)?.name ?? "—",
  };
}

/** 與後端一致：把交易記在別人名下僅限管理者，且對象須為啟用中的成員 */
function assertCanAssignPayer(payerId: number) {
  const me = db.members.find((x) => x.id === currentUserId)!;
  if (me.role !== "admin") throw { code: "forbidden", message: "只有管理者可以代記或更換記帳者" };
  const payer = db.members.find((x) => x.id === payerId);
  if (!payer || !payer.isActive) throw { code: "bad_request", message: "記帳者不存在或已停用" };
}

const live = () => db.transactions.filter((t) => !t.isDeleted);
/** 與後端一致：依日期、再依 id 由新到舊 */
const byDateDesc = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date) || b.id - a.id;

/** 與後端 services/scope.ts 相同：家庭帳看 ownerId 為 null；個人帳每人都有、只看自己的 */
function scopedLive(scope?: string) {
  if (scope !== "personal") return live().filter((t) => t.ownerId == null);
  return live().filter((t) => t.ownerId === currentUserId);
}
/** 別人的個人帳一律當作不存在 */
function findVisible(id: number) {
  const tx = db.transactions.find((t) => t.id === id);
  if (!tx || (tx.ownerId != null && tx.ownerId !== currentUserId)) throw { code: "not_found", message: "交易不存在" };
  return tx;
}
/** 與後端一致：分類 ownerId 為 null＝家庭分類，有值＝該成員的個人分類 */
type OwnedCategory = MainCategory & { ownerId?: number | null };
const ownerOf = (c: MainCategory) => (c as OwnedCategory).ownerId ?? null;

/** 個人帳第一次使用只自動建立系統分類「訂閱」「其他」，與後端一致 */
function ensurePersonalDefaults(ownerId: number) {
  const defs = [
    { systemKey: "subscription" as const, name: "訂閱", icon: "autorenew", nature: "fixed" as const, sortOrder: 998 },
    { systemKey: "other" as const, name: "其他", icon: "category", nature: "floating" as const, sortOrder: 999 },
  ];
  for (const d of defs) {
    if (db.categories.some((c) => ownerOf(c) === ownerId && c.systemKey === d.systemKey)) continue;
    const cat: OwnedCategory = {
      id: ++seq, name: d.name, icon: d.icon, type: "expense", nature: d.nature,
      sortOrder: d.sortOrder, isActive: true, isSystem: true, systemKey: d.systemKey,
      activeFrom: null, archivedFrom: null, subCategories: [], ownerId,
    };
    db.categories.push(cat);
  }
}

/** 該帳本的訂閱：訂閱屬於哪本帳，看它掛的「訂閱」分類是家庭的還是個人的 */
function scopedSubscriptions(scope?: string): Subscription[] {
  const ids = new Set(scopedCategories(scope).map((c) => c.id));
  return db.subscriptions.filter((s) => ids.has(s.mainCategoryId));
}

/** 該帳本的分類：家庭帳取家庭分類，個人帳只取登入者自己的 */
/** 與後端 resolveSubscriptionCategory 一致：沒指定就是「訂閱」；指定的要是同一本帳啟用中的固定支出分類 */
function subscriptionCategoryOf(scope: string | undefined, requested?: number): number {
  const mine = scopedCategories(scope);
  if (requested == null) return mine.find((c) => c.systemKey === "subscription")!.id;
  const cat = mine.find((c) => c.id === requested);
  if (!cat || cat.type !== "expense" || cat.nature !== "fixed" || !cat.isActive) {
    throw { code: "bad_request", message: "訂閱只能記在這本帳啟用中的固定支出分類" };
  }
  return cat.id;
}

function scopedCategories(scope?: string): MainCategory[] {
  if (scope !== "personal") return db.categories.filter((c) => ownerOf(c) == null);
  ensurePersonalDefaults(currentUserId);
  return db.categories
    .filter((c) => ownerOf(c) === currentUserId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/** 與後端一致：交易的分類必須屬於交易所在的帳本、且與類型一致 */
function assertCategoryInScope(mainCategoryId: number | null, type: string, ownerId: number | null) {
  if (mainCategoryId == null) return;
  const cat = db.categories.find((c) => c.id === mainCategoryId);
  if (!cat || ownerOf(cat) !== ownerId) throw { code: "bad_request", message: "分類不存在" };
  if (cat.type !== type) throw { code: "bad_request", message: "分類與收支別不符" };
}

const inMonth = (t: Transaction, month: string) => t.date.startsWith(month);
const inYear = (t: Transaction, year: number) => t.date.startsWith(String(year));
const budgetOf = (month: string, catId: number) =>
  db.budgets.find((b) => b.month === month && b.mainCategoryId === catId)?.amount ?? null;

/** 該帳本的預算：看預算掛的分類屬於哪本帳 */
function scopedBudgets(scope?: string) {
  const ids = new Set(scopedCategories(scope).map((c) => c.id));
  return db.budgets.filter((b) => ids.has(b.mainCategoryId));
}

function fixedTotalOf(scope?: string): number {
  return scopedSubscriptions(scope)
    .filter((s) => s.isActive)
    .reduce((sum, s) => sum + monthlyEquivalent(s.amount, s.cycle), 0);
}

/**
 * 回傳前先複製一份，跟真後端一樣每次都是新的 JSON。
 * 直接回傳假資料庫裡的物件的話，畫面拿到同一個參考，改動後 Vue 不會重畫（例如新增子分類後畫面不更新）。
 */
function ok<T>(data: T, config: AxiosRequestConfig): AxiosResponse<T> {
  const copy = data === undefined ? data : (JSON.parse(JSON.stringify(data)) as T);
  return { data: copy, status: 200, statusText: "OK", headers: {}, config: config as never };
}

function fail(code: string, message: string, status = 400, extra: Record<string, unknown> = {}) {
  return Promise.reject({ response: { status, data: { code, message, ...extra } } });
}

const routes: [RegExp, string, (m: RegExpMatchArray, body: any, params: any) => unknown][] = [
  // ── auth ──────────────────────────────────────────────
  [/^\/auth\/login$/, "post", (_m, body) => {
    const member = db.members.find((x) => x.account === body.account);
    if (!member || !member.isActive || db.passwords[body.account] !== body.password) {
      throw { code: "invalid_credentials", message: "帳號或密碼錯誤" };
    }
    currentUserId = member.id;
    // 自首次登入起固定 6 個月，不續期
    return { token: "mock-token-" + member.id, expiresIn: 60 * 60 * 24 * 182, user: member };
  }],
  [/^\/auth\/logout$/, "post", () => null],
  [/^\/auth\/me$/, "get", () => db.members.find((m) => m.id === currentUserId)!],
  [/^\/auth\/reset-password$/, "post", (_m, body) => {
    if (db.resetCodes[body.account] !== body.code) {
      throw { code: "invalid_reset_code", message: "帳號或重設碼不正確" };
    }
    db.passwords[body.account] = body.newPassword;
    delete db.resetCodes[body.account];
    const m = db.members.find((x) => x.account === body.account);
    if (m) m.resetCode = null;
    return null;
  }],

  // ── categories ────────────────────────────────────────
  [/^\/categories$/, "get", (_m, _b, q) => scopedCategories(q.scope)],
  [/^\/categories$/, "post", (_m, body, q) => {
    const cat: OwnedCategory = {
      id: ++seq, name: body.name, icon: body.icon, type: body.type,
      // 只有支出分類有性質；收入、投資一律為 null
      nature: body.type === "expense" ? body.nature : null,
      sortOrder: db.categories.length + 1, isActive: true, isSystem: false,
      activeFrom: new Date().toISOString().slice(0, 7), archivedFrom: null, subCategories: [],
      ownerId: q.scope === "personal" ? currentUserId : null,
    };
    db.categories.push(cat);
    return cat;
  }],
  [/^\/categories\/(\d+)$/, "patch", (m, body) => {
    const cat = db.categories.find((c) => c.id === Number(m[1]))!;
    if (cat.isSystem) throw { code: "system_category", message: "系統保留分類不可修改" };
    Object.assign(cat, body);
    return cat;
  }],
  [/^\/categories\/(\d+)\/archive$/, "post", (m) => {
    const cat = db.categories.find((c) => c.id === Number(m[1]))!;
    if (cat.isSystem) throw { code: "system_category", message: "系統保留分類不可停用" };
    cat.isActive = false;
    cat.archivedFrom = new Date().toISOString().slice(0, 7);
    // 與後端一致：掛在這個分類的訂閱改回同一本帳的「訂閱」
    const fallback = subscriptionCategoryOf((cat as OwnedCategory).ownerId == null ? "family" : "personal");
    db.subscriptions.filter((x) => x.mainCategoryId === cat.id).forEach((x) => (x.mainCategoryId = fallback));
    return cat;
  }],
  [/^\/categories\/(\d+)\/restore$/, "post", (m) => {
    const cat = db.categories.find((c) => c.id === Number(m[1]))!;
    cat.isActive = true;
    cat.archivedFrom = null;
    return cat;
  }],
  [/^\/categories\/reorder$/, "post", (_m, body) => {
    (body.orderedIds as number[]).forEach((id, i) => {
      const c = db.categories.find((x) => x.id === id);
      if (c) c.sortOrder = i + 1;
    });
    return null;
  }],
  [/^\/categories\/(\d+)\/subs$/, "post", (m, body) => {
    const cat = db.categories.find((c) => c.id === Number(m[1]))!;
    if (cat.subCategories.some((s) => s.name === body.name)) {
      throw { code: "duplicate_name", message: "「" + cat.name + "」底下已有「" + body.name + "」" };
    }
    cat.subCategories.push({
      id: ++seq, mainCategoryId: cat.id, name: body.name,
      sortOrder: cat.subCategories.length + 1, isActive: true,
    });
    return cat;
  }],
  [/^\/categories\/subs\/(\d+)$/, "patch", (m, body) => {
    const cat = db.categories.find((c) => c.subCategories.some((s) => s.id === Number(m[1])))!;
    const s = cat.subCategories.find((x) => x.id === Number(m[1]))!;
    s.name = body.name; // 歸屬主分類不可搬移
    return cat;
  }],
  [/^\/categories\/subs\/(\d+)\/archive$/, "post", (m) => {
    const cat = db.categories.find((c) => c.subCategories.some((s) => s.id === Number(m[1])))!;
    cat.subCategories.find((x) => x.id === Number(m[1]))!.isActive = false;
    return cat;
  }],
  [/^\/categories\/subs\/(\d+)\/restore$/, "post", (m) => {
    const cat = db.categories.find((c) => c.subCategories.some((s) => s.id === Number(m[1])))!;
    cat.subCategories.find((x) => x.id === Number(m[1]))!.isActive = true;
    return cat;
  }],

  // ── transactions ──────────────────────────────────────
  [/^\/transactions$/, "get", (_m, _b, q) => {
    let list = scopedLive(q.scope);
    if (q.month) list = list.filter((t) => inMonth(t, q.month));
    if (q.type && q.type !== "all") list = list.filter((t) => t.type === q.type);
    if (q.mainCategoryId) list = list.filter((t) => t.mainCategoryId === Number(q.mainCategoryId));
    if (q.payerId) list = list.filter((t) => t.payerId === Number(q.payerId));
    if (q.keyword) list = list.filter((t) => (t.note ?? "").includes(q.keyword));
    // 一律依建立時間由近到遠
    list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const page = Number(q.page ?? 1);
    const pageSize = Number(q.pageSize ?? 20);
    return {
      items: list.slice((page - 1) * pageSize, page * pageSize).map(view),
      total: list.length, page, pageSize,
    };
  }],
  [/^\/transactions$/, "post", (_m, body) => {
    // 記帳者省略＝登入者；管理者可代記他人，輸入者一律是登入者
    const payerId = body.payerId ?? currentUserId;
    if (payerId !== currentUserId) {
      // 與後端一致：個人帳的 owner 必須等於記帳者，不能替別人記到自己的個人帳
      if (body.scope === "personal") throw { code: "bad_request", message: "個人帳不可代記他人" };
      assertCanAssignPayer(payerId);
    }
    assertCategoryInScope(body.mainCategoryId, body.type, body.scope === "personal" ? currentUserId : null);
    const tx: Transaction = {
      id: ++seq, type: body.type, mainCategoryId: body.mainCategoryId,
      subCategoryId: body.subCategoryId, amount: body.amount, date: body.date,
      payerId, createdBy: currentUserId, note: body.note ?? null,
      createdAt: new Date().toISOString(), isDeleted: false, sourceSubscriptionId: null,
      ownerId: body.scope === "personal" ? currentUserId : null,
    };
    db.transactions.push(tx);
    return view(tx);
  }],
  [/^\/transactions\/(\d+)$/, "patch", (m, body) => {
    const tx = findVisible(Number(m[1]));
    const member = db.members.find((x) => x.id === currentUserId)!;
    if (member.role !== "admin" && tx.payerId !== currentUserId) {
      throw { code: "forbidden", message: "只能編輯自己記的交易" };
    }
    if (body.payerId !== undefined && body.payerId !== tx.payerId) {
      if (tx.sourceSubscriptionId != null) {
        throw { code: "bad_request", message: "訂閱產生的交易不可更換記帳者，請改訂閱的扣款人" };
      }
      if (tx.ownerId != null) throw { code: "bad_request", message: "個人帳交易不可更換記帳者" };
      assertCanAssignPayer(body.payerId);
    }
    // 收支別不可修改；每個欄位變更寫入 revision
    for (const [field, after] of Object.entries(body)) {
      const before = (tx as never as Record<string, unknown>)[field];
      if (before === after) continue;
      db.revisions.push({
        id: ++seq, transactionId: tx.id, editedBy: currentUserId,
        editedAt: new Date().toISOString(), field,
        before: String(before ?? ""), after: String(after ?? ""),
      });
      (tx as never as Record<string, unknown>)[field] = after;
    }
    return view(tx);
  }],
  [/^\/transactions\/(\d+)$/, "delete", (m) => {
    const tx = findVisible(Number(m[1]));
    const member = db.members.find((x) => x.id === currentUserId)!;
    if (member.role !== "admin" && tx.payerId !== currentUserId) {
      throw { code: "forbidden", message: "只能刪除自己記的交易" };
    }
    tx.isDeleted = true; // 軟刪除，前台無復原入口
    return null;
  }],
  [/^\/transactions\/(\d+)\/revisions$/, "get", (m) => {
    findVisible(Number(m[1]));
    return db.revisions.filter((r) => r.transactionId === Number(m[1]));
  }],

  // ── budgets ───────────────────────────────────────────
  // 預算屬於哪本帳看它的分類，與後端一致
  [/^\/budgets$/, "get", (_m, _b, q) => scopedBudgets(q.scope).filter((b) => b.month === q.month)],
  [/^\/budgets$/, "put", (_m, body) => {
    let b = db.budgets.find((x) => x.month === body.month && x.mainCategoryId === body.mainCategoryId);
    if (b) b.amount = body.amount;
    else {
      b = { id: ++seq, month: body.month, mainCategoryId: body.mainCategoryId, amount: body.amount };
      db.budgets.push(b);
    }
    return b;
  }],
  [/^\/budgets\/copy-previous$/, "post", (_m, body, q) => {
    const [y, mo] = (body.month as string).split("-").map(Number);
    const prev = new Date(y, mo - 2, 1);
    const prevMonth = prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0");
    for (const src of scopedBudgets(q.scope).filter((b) => b.month === prevMonth)) {
      const exist = db.budgets.find((b) => b.month === body.month && b.mainCategoryId === src.mainCategoryId);
      if (exist) exist.amount = src.amount;
      else db.budgets.push({ id: ++seq, month: body.month, mainCategoryId: src.mainCategoryId, amount: src.amount });
    }
    return scopedBudgets(q.scope).filter((b) => b.month === body.month);
  }],
  [/^\/budgets\/fixed-total$/, "get", (_m, _b, q) => ({ month: q.month, amount: fixedTotalOf(q.scope) })],

  // ── subscriptions ─────────────────────────────────────
  [/^\/subscriptions$/, "get", (_m, _b, q) => scopedSubscriptions(q.scope)],
  [/^\/subscriptions$/, "post", (_m, body, q) => {
    // 與後端一致：分類預設「訂閱」，可選同一本帳啟用中的固定支出分類；個人訂閱的扣款人只能是自己
    if (q.scope === "personal" && body.payerId !== currentUserId) {
      throw { code: "bad_request", message: "個人訂閱的扣款人只能是自己" };
    }
    const mainCategoryId = subscriptionCategoryOf(q.scope, body.mainCategoryId);
    const s: Subscription = {
      id: ++seq,
      isActive: true,
      ...body,
      mainCategoryId,
      chargeDay: Number(body.nextChargeDate.slice(8, 10)),
      chargeMonth: body.cycle === "yearly" ? Number(body.nextChargeDate.slice(5, 7)) : null,
      periodAmount: null,
    };
    db.subscriptions.push(s);
    return s;
  }],
  [/^\/subscriptions\/(\d+)$/, "patch", (m, body) => {
    const s = db.subscriptions.find((x) => x.id === Number(m[1]))!;
    if (body.mainCategoryId !== undefined) {
      const owner = (db.categories.find((c) => c.id === s.mainCategoryId) as OwnedCategory | undefined)?.ownerId;
      subscriptionCategoryOf(owner == null ? "family" : "personal", body.mainCategoryId);
    }
    // 年繳分攤進行中：週期與扣款日要等本期結束才能改（與後端一致）
    const midPeriod = s.cycle === "yearly" && s.chargeMonth != null && installmentIndex(s.nextChargeDate, s.chargeMonth) !== 0;
    const scheduleChanged =
      (body.cycle && body.cycle !== s.cycle) || (body.nextChargeDate && body.nextChargeDate !== s.nextChargeDate);
    if (midPeriod && scheduleChanged) {
      throw {
        code: "bad_request",
        message:
          "年繳分攤中（已分攤 " + installmentIndex(s.nextChargeDate, s.chargeMonth!) + "/" + INSTALLMENTS +
          " 期），週期與扣款日要等本期結束後才能改（下次年繳 " +
          nextAnnualChargeDate(s.nextChargeDate, s.chargeMonth!, s.chargeDay) + "）",
      };
    }
    if ((body.amount && body.amount !== s.amount) || (body.cycle && body.cycle !== s.cycle)) {
      // 金額／週期變更寫入歷史版本，舊期間仍以當時金額計算
      db.revisions.push({
        id: ++seq, transactionId: -s.id, editedBy: currentUserId,
        editedAt: new Date().toISOString(), field: "subscription",
        before: s.amount + "/" + s.cycle, after: (body.amount ?? s.amount) + "/" + (body.cycle ?? s.cycle),
      });
    }
    Object.assign(s, body);
    if (body.nextChargeDate) s.chargeDay = Number(body.nextChargeDate.slice(8, 10));
    if (s.cycle === "yearly") {
      if (!midPeriod) s.chargeMonth = Number(s.nextChargeDate.slice(5, 7));
    } else {
      s.chargeMonth = null;
      s.periodAmount = null;
    }
    return { ...s };
  }],
  [/^\/subscriptions\/(\d+)\/active$/, "post", (m, body) => {
    const s = db.subscriptions.find((x) => x.id === Number(m[1]))!;
    s.isActive = body.isActive; // 只能停用，不提供刪除
    return { ...s };
  }],
  [/^\/subscriptions\/(\d+)\/revisions$/, "get", () => []],

  // ── members ───────────────────────────────────────────
  [/^\/members$/, "get", () => db.members],
  [/^\/members$/, "post", (_m, body) => {
    if (db.members.some((x) => x.account === body.account)) {
      throw { code: "duplicate_account", message: "帳號「" + body.account + "」已存在" };
    }
    const m2 = {
      id: ++seq, name: body.name, account: body.account, role: body.role,
      isActive: true, color: body.color, joinedMonth: new Date().toISOString().slice(0, 7),
      resetCode: body.initialCode,
    };
    db.members.push(m2);
    db.passwords[body.account] = "";
    db.resetCodes[body.account] = body.initialCode;
    return m2;
  }],
  [/^\/members\/(\d+)$/, "patch", (m, body) => {
    const target = db.members.find((x) => x.id === Number(m[1]))!;
    if (body.role === "member" && target.role === "admin") {
      const admins = db.members.filter((x) => x.isActive && x.role === "admin");
      if (admins.length <= 1) throw { code: "last_admin", message: "至少需保留一位管理者" };
    }
    Object.assign(target, body);
    return target;
  }],
  [/^\/members\/(\d+)\/active$/, "post", (m, body) => {
    const target = db.members.find((x) => x.id === Number(m[1]))!;
    if (!body.isActive) {
      if (target.id === currentUserId) throw { code: "self_disable", message: "無法停用目前登入的帳號" };
      const admins = db.members.filter((x) => x.isActive && x.role === "admin");
      if (target.role === "admin" && admins.length <= 1) {
        throw { code: "last_admin", message: "至少需保留一位管理者" };
      }
      const subs = db.subscriptions.filter((s) => s.isActive && s.payerId === target.id).length;
      if (subs > 0) {
        throw {
          code: "has_active_subscriptions",
          message: "「" + target.name + "」名下還有 " + subs + " 筆進行中的訂閱，請先在訂閱管理改指定其他扣款人",
        };
      }
    }
    target.isActive = body.isActive; // 軟刪除，歷史紀錄仍顯示其名稱
    return target;
  }],
  [/^\/members\/(\d+)\/reset-request$/, "post", (m) => {
    const target = db.members.find((x) => x.id === Number(m[1]))!;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    target.resetCode = code; // 不設有效期限
    db.resetCodes[target.account] = code;
    return { resetCode: code };
  }],
  [/^\/members\/(\d+)\/reset-request$/, "delete", (m) => {
    const target = db.members.find((x) => x.id === Number(m[1]))!;
    target.resetCode = null;
    delete db.resetCodes[target.account];
    return null;
  }],

  // ── summary ───────────────────────────────────────────
  [/^\/summary\/dashboard$/, "get", (_m, _b, q) => {
    const month = q.month as string;
    const rows = scopedLive(q.scope).filter((t) => inMonth(t, month));
    const income = rows.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = rows.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const investment = rows.filter((t) => t.type === "investment").reduce((s, t) => s + t.amount, 0);
    const cats = scopedCategories(q.scope);
    // 與後端一致：系統分類「其他」也是浮動支出，照樣列出
    const floating = cats.filter((c) => c.type === "expense" && c.nature === "floating");
    return {
      // 個人帳尚無預算；投資不算支出，另外回傳
      summary: {
        month, income, expense, net: income - expense, investment,
        hasInvestment: cats.some((c) => c.type === "investment") || investment > 0,
        // 兩本帳都用訂閱月換算；個人帳算本人的個人訂閱
        fixedTotal: fixedTotalOf(q.scope),
      },
      categories: floating.map((c) => {
        const mine = rows.filter((t) => t.mainCategoryId === c.id);
        return {
          id: c.id, name: c.name, icon: c.icon,
          budget: budgetOf(month, c.id),
          spent: mine.reduce((s, t) => s + t.amount, 0),
          recent: [...mine].sort(byDateDesc).slice(0, 3).map(view),
        };
      }),
      // 與後端一致：最近交易依建立時間由新到舊取 5 筆
      recent: [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id).slice(0, 5).map(view),
    };
  }],
  [/^\/summary\/stats$/, "get", (_m, _b, q) => {
    const range = (q.range ?? "month") as "month" | "year";
    const period = q.period as string;
    let rows = scopedLive(q.scope).filter((t) => t.type === "expense");
    rows = range === "month" ? rows.filter((t) => inMonth(t, period)) : rows.filter((t) => inYear(t, Number(period)));
    if (q.payerId) rows = rows.filter((t) => t.payerId === Number(q.payerId));
    const recordedMonths = new Set(rows.map((t) => t.date.slice(0, 7))).size || 1;
    const cats = scopedCategories(q.scope);
    const floating = cats.filter((c) => c.type === "expense" && c.nature === "floating");
    const fixed = cats.filter((c) => c.type === "expense" && c.nature === "fixed");
    const build = (c: MainCategory) => {
      const mine = rows.filter((t) => t.mainCategoryId === c.id);
      const monthBudget = budgetOf(range === "month" ? period : period + "-08", c.id);
      return {
        mainCategoryId: c.id, name: c.name, icon: c.icon,
        amount: mine.reduce((s, t) => s + t.amount, 0),
        budget: monthBudget === null ? null : range === "month" ? monthBudget : monthBudget * recordedMonths,
        subs: c.subCategories.map((s) => ({
          subCategoryId: s.id, name: s.name,
          amount: mine.filter((t) => t.subCategoryId === s.id).reduce((x, t) => x + t.amount, 0),
        })).filter((s) => s.amount > 0),
      };
    };
    const floatingRows = floating.map(build).filter((r) => r.amount > 0);
    return {
      range, period, floating: floatingRows,
      fixed: fixed.map((c) => ({
        name: c.name,
        amount: rows.filter((t) => t.mainCategoryId === c.id).reduce((s, t) => s + t.amount, 0),
      })).filter((r) => r.amount > 0),
      total: floatingRows.reduce((s, r) => s + r.amount, 0),
    };
  }],
  [/^\/summary\/year$/, "get", (_m, _b, q) => {
    const year = Number(q.year);
    const rows = scopedLive(q.scope).filter((t) => inYear(t, year));
    // 個人帳尚無預算
    // 年度額外開銷屬於哪本帳看它的分類：家庭分類＝家庭帳，本人的個人分類＝個人帳
    const scopedIds = new Set(scopedCategories(q.scope).map((c) => c.id));
    const extrasOfYear = db.yearExtras.filter((e) => e.year === year && scopedIds.has(e.mainCategoryId));
    const recordedMonths = new Set(rows.map((t) => t.date.slice(5, 7))).size;
    const monthIndex = (from: string | null, fallback: number) =>
      from && from.slice(0, 4) === String(year) ? Number(from.slice(5, 7)) - 1 : fallback;
    const scoped = scopedCategories(q.scope);
    const sumOf = (list: Transaction[], type: string) =>
      list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
    const investment = sumOf(rows, "investment");
    // 只列出該年度存在過的分類
    const cats = scoped.filter((c) => {
      if (c.type !== "expense") return false;
      if (c.activeFrom && c.activeFrom.slice(0, 4) > String(year)) return false;
      if (c.archivedFrom && c.archivedFrom.slice(0, 4) < String(year)) return false;
      return true;
    });
    return {
      year,
      income: rows.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
      expense: rows.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      net:
        rows.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0) -
        rows.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      investment,
      hasInvestment: scoped.some((c) => c.type === "investment") || investment > 0,
      recordedMonths,
      monthly: Array.from({ length: 12 }, (_, i) => {
        const mm = String(i + 1).padStart(2, "0");
        const inM = rows.filter((t) => t.date.slice(5, 7) === mm);
        if (!inM.length) return null;
        const income = inM.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const expense = inM.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        return { income, expense, investment: sumOf(inM, "investment"), net: income - expense };
      }),
      rows: cats.map((c) => {
        const startMonth = monthIndex(c.activeFrom, 0);
        const endMonth = c.archivedFrom ? monthIndex(c.archivedFrom, 12) : 12;
        const months = Array.from({ length: 12 }, (_, i) => {
          if (i >= recordedMonths) return null; // 尚未記錄
          const mm = String(i + 1).padStart(2, "0");
          const mine = rows.filter((t) => t.mainCategoryId === c.id && t.date.slice(5, 7) === mm);
          // 與後端一致：有實際交易就顯示，即使分類當時不存在或已停用
          if (!mine.length && (i < startMonth || i >= endMonth)) return null;
          return mine.reduce((s, t) => s + t.amount, 0);
        });
        const extra = extrasOfYear
          .filter((e) => e.mainCategoryId === c.id)
          .reduce((s, e) => s + e.amount, 0);
        const monthlyBudget = budgetOf(year + "-08", c.id) ?? 0;
        const activeMonths = Math.max(0, Math.min(endMonth, 12) - startMonth);
        return {
          mainCategoryId: c.id, name: c.name, icon: c.icon, months,
          extra: extra || null,
          total: months.reduce<number>((s, v) => s + (v ?? 0), 0) + extra,
          planned: monthlyBudget ? monthlyBudget * activeMonths : null,
          monthlyBudget, startMonth, endMonth,
        };
      }),
      extras: extrasOfYear.map((e) => ({
        ...e,
        categoryName: db.categories.find((c) => c.id === e.mainCategoryId)?.name ?? "—",
        payerName: db.members.find((m) => m.id === e.payerId)?.name ?? "—",
      })),
    };
  }],
  [/^\/summary\/year-extras$/, "post", (_m, body) => {
    const e: YearExtraExpense = { id: ++seq, ...body };
    db.yearExtras.push(e);
    return e;
  }],
  [/^\/summary\/year-extras\/(\d+)$/, "patch", (m, body) => {
    const e = db.yearExtras.find((x) => x.id === Number(m[1]));
    if (!e) throw { code: "not_found", message: "項目不存在" };
    Object.assign(e, body);
    return e;
  }],
  [/^\/summary\/year-extras\/(\d+)$/, "delete", (m) => {
    const i = db.yearExtras.findIndex((e) => e.id === Number(m[1]));
    if (i >= 0) db.yearExtras.splice(i, 1);
    return null;
  }],
];

const mockAdapter: AxiosAdapter = async (config) => {
  const path = (config.url ?? "").replace(config.baseURL ?? "", "");
  const method = (config.method ?? "get").toLowerCase();
  const body = config.data ? JSON.parse(config.data as string) : {};
  const params = config.params ?? {};

  await new Promise((r) => setTimeout(r, 140));

  for (const [pattern, verb, handler] of routes) {
    if (verb !== method) continue;
    const m = path.match(pattern);
    if (!m) continue;
    try {
      return ok(handler(m, body, params), config);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      return fail(err.code ?? "bad_request", err.message ?? "操作失敗") as never;
    }
  }
  return fail("not_found", "找不到端點：" + method.toUpperCase() + " " + path, 404) as never;
};

export function installMocks() {
  http.defaults.adapter = mockAdapter;
  if (!localStorage.getItem(TOKEN_KEY)) localStorage.setItem(TOKEN_KEY, "mock-token-1");
}
