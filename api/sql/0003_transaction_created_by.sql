-- 管理者可代記他人、可事後更換記帳者：記帳者（payer_id）不再等於「是誰輸入的」，
-- 另加 created_by 記錄實際輸入者。
-- null = 系統自動產生（Cron 訂閱扣款）。
-- 既有的手動交易當初記帳者恆為登入者，回填 created_by = payer_id；
-- 訂閱產生的交易無從得知是 Cron 還是誰按了 mark-paid，維持 null。
-- 記帳者改為可修改，revision 的欄位白名單一併加入 payerId。
-- 冪等：可重複執行。

begin;

alter table transactions
  add column if not exists created_by integer references members (id) on delete restrict;

update transactions
   set created_by = payer_id
 where created_by is null
   and source_subscription_id is null;

-- 收支別仍不可修改，不會出現在 revision
alter table transaction_revisions drop constraint if exists transaction_revisions_field_check;
alter table transaction_revisions
  add constraint transaction_revisions_field_check check (
    field in ('mainCategoryId', 'subCategoryId', 'amount', 'date', 'note', 'payerId')
  );

commit;
