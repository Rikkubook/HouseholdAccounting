-- 個人帳第 2 批：新增第三種類型「投資」（docs/requirements/personal-ledger.md 6.3）。
-- 投資是錢離開錢包但仍是自己的（現金變成股票），不算支出也不算收入；
-- 所有加總支出的查詢都以 type = 'expense' 篩選，投資自然不會被算進去。
-- 投資分類與收入分類一樣沒有性質（nature 為 null）。
-- 個人分類本身不需改表：main_categories.owner_id 已在 sql/0002 加上。
-- 冪等：可重複執行。

begin;

alter table main_categories drop constraint if exists main_categories_type_check;
alter table main_categories
  add constraint main_categories_type_check check (type in ('expense', 'income', 'investment'));

alter table main_categories drop constraint if exists main_categories_nature_check;
alter table main_categories
  add constraint main_categories_nature_check check (
    (type in ('income', 'investment') and nature is null) or
    (type = 'expense' and nature in ('floating', 'fixed'))
  );

alter table transactions drop constraint if exists transactions_type_check;
alter table transactions
  add constraint transactions_type_check check (type in ('expense', 'income', 'investment'));

commit;
