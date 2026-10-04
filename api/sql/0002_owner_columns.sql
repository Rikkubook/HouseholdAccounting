-- 個人帳第 0 批（打地基）：交易與分類加上 owner_id。
-- owner_id 為 null = 家庭帳；有值 = 該成員的個人帳。
-- 這一批所有既有資料都是 null，查詢一律只看 null，畫面與數字完全不變。
-- 預算、訂閱、年度額外支出不加欄位：它們掛在分類上，分類是誰的就是誰的。
-- 冪等：可重複執行。

begin;

/* ── transactions ─────────────────────────────────────── */
alter table transactions
  add column if not exists owner_id integer references members (id) on delete restrict;

-- 個人帳只能是本人記的（記帳者恆為登入者）
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_owner_payer_check') then
    alter table transactions
      add constraint transactions_owner_payer_check check (owner_id is null or owner_id = payer_id);
  end if;
end $$;

create index if not exists transactions_owner_date_idx on transactions (owner_id, date);

/* ── main_categories ──────────────────────────────────── */
alter table main_categories
  add column if not exists owner_id integer references members (id) on delete restrict;

create index if not exists main_categories_owner_idx on main_categories (owner_id);

-- 系統分類改為「每個範圍各一個」：家庭一組「其他／訂閱」，每位成員的個人帳也各一組。
-- NULLS NOT DISTINCT 讓 owner_id 為 null 的家庭分類之間也視為重複（需 PostgreSQL 15+）。
drop index if exists main_categories_system_key_idx;
create unique index if not exists main_categories_owner_system_key_idx
  on main_categories (owner_id, system_key) nulls not distinct
  where system_key is not null;

commit;
