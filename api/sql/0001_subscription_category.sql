-- 訂閱只能歸屬「訂閱」分類（系統保留：不可停用、不可改名）。
-- 起因：訂閱原本可掛任何支出分類，分類停用後訂閱仍在扣款與攤提。
-- 冪等：可重複執行；db:push 會在 0000 之後依檔名順序執行。

begin;

-- 系統分類的識別碼：is_system 只說明「不可停用、不可改名」，分不出是哪一個系統分類
alter table main_categories add column if not exists system_key text;
create unique index if not exists main_categories_system_key_idx
  on main_categories (system_key) where system_key is not null;

update main_categories set system_key = 'other'
 where is_system and system_key is null and nature = 'floating';

-- 沿用既有的「訂閱」固定支出分類；沒有就建立一個
update main_categories
   set is_system = true, system_key = 'subscription', is_active = true, archived_from = null
 where system_key is null and name = '訂閱' and type = 'expense' and nature = 'fixed'
   and not exists (select 1 from main_categories where system_key = 'subscription');

insert into main_categories (name, icon, type, nature, sort_order, is_active, is_system, system_key)
select '訂閱', 'autorenew', 'expense', 'fixed', coalesce(max(sort_order), 0) + 1, true, true, 'subscription'
  from main_categories
having not exists (select 1 from main_categories where system_key = 'subscription');

-- 既有訂閱一律搬進「訂閱」分類；已產生的扣款交易不動（交易存有分類名稱快照）
update subscriptions
   set main_category_id = (select id from main_categories where system_key = 'subscription')
 where main_category_id <> (select id from main_categories where system_key = 'subscription');

commit;
