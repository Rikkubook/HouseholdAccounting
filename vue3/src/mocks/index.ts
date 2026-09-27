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
import { advanceCharge, monthlyEquivalent } from "@/utils/format";

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
  };
}

const live = () => db.transactions.filter((t) => !t.isDeleted);
const inMonth = (t: Transaction, month: string) => t.date.startsWith(month);
const inYear = (t: Transaction, year: number) => t.date.startsWith(String(year));
const budgetOf = (month: string, catId: number) =>
  db.budgets.find((b) => b.month === month && b.mainCategoryId === catId)?.amount ?? null;

function fixedTotalOf(): number {
  return db.subscriptions
    .filter((s) => s.isActive)
    .reduce((sum, s) => sum + monthlyEquivalent(s.amount, s.cycle), 0);
}

function ok<T>(data: T, config: AxiosRequestConfig): AxiosResponse<T> {
  return { data, status: 200, statusText: "OK", headers: {}, config: config as never };
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
  [/^\/categories$/, "get", () => db.categories],
  [/^\/categories$/, "post", (_m, body) => {
    const cat: MainCategory = {
      id: ++seq, name: body.name, icon: body.icon, type: body.type,
      nature: body.type === "income" ? null : body.nature,
      sortOrder: db.categories.length + 1, isActive: true, isSystem: false,
      activeFrom: new Date().toISOString().slice(0, 7), archivedFrom: null, subCategories: [],
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
    if (cat.isSystem) throw { code: "system_category", message: "「其他」為系統保留分類，不可停用" };
    cat.isActive = false;
    cat.archivedFrom = new Date().toISOString().slice(0, 7);
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

  // ── transactions ──────────────────────────────────────
  [/^\/transactions$/, "get", (_m, _b, q) => {
    let list = live();
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
    // 記帳者恆為登入者
    const tx: Transaction = {
      id: ++seq, type: body.type, mainCategoryId: body.mainCategoryId,
      subCategoryId: body.subCategoryId, amount: body.amount, date: body.date,
      payerId: currentUserId, note: body.note ?? null,
      createdAt: new Date().toISOString(), isDeleted: false, sourceSubscriptionId: null,
    };
    db.transactions.push(tx);
    return view(tx);
  }],
  [/^\/transactions\/(\d+)$/, "patch", (m, body) => {
    const tx = db.transactions.find((t) => t.id === Number(m[1]))!;
    const member = db.members.find((x) => x.id === currentUserId)!;
    if (member.role !== "admin" && tx.payerId !== currentUserId) {
      throw { code: "forbidden", message: "只能編輯自己記的交易" };
    }
    // 收支別與記帳者不可修改；每個欄位變更寫入 revision
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
    const tx = db.transactions.find((t) => t.id === Number(m[1]))!;
    tx.isDeleted = true; // 軟刪除，前台無復原入口
    return null;
  }],
  [/^\/transactions\/(\d+)\/revisions$/, "get", (m) =>
    db.revisions.filter((r) => r.transactionId === Number(m[1]))],

  // ── budgets ───────────────────────────────────────────
  [/^\/budgets$/, "get", (_m, _b, q) => db.budgets.filter((b) => b.month === q.month)],
  [/^\/budgets$/, "put", (_m, body) => {
    let b = db.budgets.find((x) => x.month === body.month && x.mainCategoryId === body.mainCategoryId);
    if (b) b.amount = body.amount;
    else {
      b = { id: ++seq, month: body.month, mainCategoryId: body.mainCategoryId, amount: body.amount };
      db.budgets.push(b);
    }
    return b;
  }],
  [/^\/budgets\/copy-previous$/, "post", (_m, body) => {
    const [y, mo] = (body.month as string).split("-").map(Number);
    const prev = new Date(y, mo - 2, 1);
    const prevMonth = prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0");
    for (const src of db.budgets.filter((b) => b.month === prevMonth)) {
      const exist = db.budgets.find((b) => b.month === body.month && b.mainCategoryId === src.mainCategoryId);
      if (exist) exist.amount = src.amount;
      else db.budgets.push({ id: ++seq, month: body.month, mainCategoryId: src.mainCategoryId, amount: src.amount });
    }
    return db.budgets.filter((b) => b.month === body.month);
  }],
  [/^\/budgets\/fixed-total$/, "get", (_m, _b, q) => ({ month: q.month, amount: fixedTotalOf() })],

  // ── subscriptions ─────────────────────────────────────
  [/^\/subscriptions$/, "get", () => db.subscriptions],
  [/^\/subscriptions$/, "post", (_m, body) => {
    const s: Subscription = { id: ++seq, isActive: true, ...body };
    db.subscriptions.push(s);
    return s;
  }],
  [/^\/subscriptions\/(\d+)$/, "patch", (m, body) => {
    const s = db.subscriptions.find((x) => x.id === Number(m[1]))!;
    if ((body.amount && body.amount !== s.amount) || (body.cycle && body.cycle !== s.cycle)) {
      // 金額／週期變更寫入歷史版本，舊期間仍以當時金額計算
      db.revisions.push({
        id: ++seq, transactionId: -s.id, editedBy: currentUserId,
        editedAt: new Date().toISOString(), field: "subscription",
        before: s.amount + "/" + s.cycle, after: (body.amount ?? s.amount) + "/" + (body.cycle ?? s.cycle),
      });
    }
    Object.assign(s, body);
    return s;
  }],
  [/^\/subscriptions\/(\d+)\/active$/, "post", (m, body) => {
    const s = db.subscriptions.find((x) => x.id === Number(m[1]))!;
    s.isActive = body.isActive; // 只能停用，不提供刪除
    return s;
  }],
  [/^\/subscriptions\/(\d+)\/mark-paid$/, "post", (m) => {
    const s = db.subscriptions.find((x) => x.id === Number(m[1]))!;
    const tx: Transaction = {
      id: ++seq, type: "expense", mainCategoryId: s.mainCategoryId, subCategoryId: null,
      amount: s.amount, date: s.nextChargeDate, payerId: s.payerId,
      note: s.name, createdAt: new Date().toISOString(), isDeleted: false, sourceSubscriptionId: s.id,
    };
    db.transactions.push(tx);
    s.nextChargeDate = advanceCharge(s.nextChargeDate, s.cycle);
    return { subscription: s, transaction: view(tx) };
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
    const rows = live().filter((t) => inMonth(t, month));
    const income = rows.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = rows.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const floating = db.categories.filter((c) => c.type === "expense" && c.nature === "floating" && !c.isSystem);
    return {
      summary: { month, income, expense, net: income - expense, fixedTotal: fixedTotalOf() },
      categories: floating.map((c) => {
        const mine = rows.filter((t) => t.mainCategoryId === c.id);
        return {
          id: c.id, name: c.name, icon: c.icon,
          budget: budgetOf(month, c.id),
          spent: mine.reduce((s, t) => s + t.amount, 0),
          recent: [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map(view),
        };
      }),
      recent: [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map(view),
    };
  }],
  [/^\/summary\/stats$/, "get", (_m, _b, q) => {
    const range = (q.range ?? "month") as "month" | "year";
    const period = q.period as string;
    let rows = live().filter((t) => t.type === "expense");
    rows = range === "month" ? rows.filter((t) => inMonth(t, period)) : rows.filter((t) => inYear(t, Number(period)));
    if (q.payerId) rows = rows.filter((t) => t.payerId === Number(q.payerId));
    const recordedMonths = new Set(rows.map((t) => t.date.slice(0, 7))).size || 1;
    const floating = db.categories.filter((c) => c.type === "expense" && c.nature === "floating");
    const fixed = db.categories.filter((c) => c.type === "expense" && c.nature === "fixed");
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
    const rows = live().filter((t) => inYear(t, year));
    const recordedMonths = new Set(rows.map((t) => t.date.slice(5, 7))).size;
    const monthIndex = (from: string | null, fallback: number) =>
      from && from.slice(0, 4) === String(year) ? Number(from.slice(5, 7)) - 1 : fallback;
    // 只列出該年度存在過的分類
    const cats = db.categories.filter((c) => {
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
      recordedMonths,
      rows: cats.map((c) => {
        const startMonth = monthIndex(c.activeFrom, 0);
        const endMonth = c.archivedFrom ? monthIndex(c.archivedFrom, 12) : 12;
        const months = Array.from({ length: 12 }, (_, i) => {
          if (i < startMonth || i >= endMonth) return null; // 分類當時不存在或已停用
          if (i >= recordedMonths) return null; // 尚未記錄
          const mm = String(i + 1).padStart(2, "0");
          return rows
            .filter((t) => t.mainCategoryId === c.id && t.date.slice(5, 7) === mm)
            .reduce((s, t) => s + t.amount, 0);
        });
        const extra = db.yearExtras
          .filter((e) => e.year === year && e.mainCategoryId === c.id)
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
      extras: db.yearExtras.filter((e) => e.year === year).map((e) => ({
        ...e,
        categoryName: db.categories.find((c) => c.id === e.mainCategoryId)?.name ?? "—",
        payerName: db.members.find((m) => m.id === e.payerId)?.name ?? "—",
      })),
      // 依每一筆交易的記帳者加總，年度額外開銷也帶記帳者一併計入
      byMember: db.members.filter((m) => m.isActive).map((m) => {
        const mine = rows.filter((t) => t.type === "expense" && t.payerId === m.id);
        const extras = db.yearExtras.filter((e) => e.year === year && e.payerId === m.id);
        return {
          memberId: m.id, name: m.name,
          amount: mine.reduce((s, t) => s + t.amount, 0) + extras.reduce((s, e) => s + e.amount, 0),
          count: mine.length + extras.length,
        };
      }).filter((r) => r.amount > 0),
    };
  }],
  [/^\/summary\/year-extras$/, "post", (_m, body) => {
    const e: YearExtraExpense = { id: ++seq, ...body };
    db.yearExtras.push(e);
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
