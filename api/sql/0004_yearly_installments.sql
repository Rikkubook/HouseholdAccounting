-- 年繳訂閱拆成每月一筆分攤交易（docs/requirements G-6）。
-- 年繳的 next_charge_date 改為「下一期分攤」的日期（每月推進）；
-- charge_month 記住實際年繳扣款的月份，用來推算現在是第幾期（扣款月＝第 1 期）；
-- period_amount 是本期年費，在第 1 期產生時固定下來，期中改價格不影響本期剩下的分攤。
-- 正式庫目前沒有年繳訂閱，不需轉換既有的整筆年費交易。
-- 冪等：可重複執行。

begin;

alter table subscriptions
  add column if not exists charge_month integer,
  add column if not exists period_amount integer;

-- 既有年繳：next_charge_date 仍是年繳扣款日，所在月份就是扣款月
update subscriptions
   set charge_month = extract(month from next_charge_date)::integer
 where cycle = 'yearly'
   and charge_month is null;

alter table subscriptions drop constraint if exists subscriptions_charge_month_check;
alter table subscriptions
  add constraint subscriptions_charge_month_check check (
    (cycle = 'yearly' and charge_month between 1 and 12) or (cycle = 'monthly' and charge_month is null)
  );

alter table subscriptions drop constraint if exists subscriptions_period_amount_check;
alter table subscriptions
  add constraint subscriptions_period_amount_check check (period_amount is null or period_amount > 0);

commit;
