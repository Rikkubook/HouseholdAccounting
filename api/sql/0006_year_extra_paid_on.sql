-- 年度額外開銷加上付款日期。
-- 原本沒有日期、「記了就算整年都已付出」，戶頭對帳每個月的月初應有都先扣掉整年的總額，
-- 支出比例也算不到這筆。有了付款日期就能算進付款那個月（仍不列入首頁、預算、統計的單月分類數字）。
-- 舊資料維持 null（畫面顯示「未填日期」，計算時當作該年 1 月 1 日付款），由使用者自行補上。
-- 冪等：可重複執行。

begin;

alter table year_extra_expenses add column if not exists paid_on date;

-- 付款日期必須落在該筆的年度內
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'year_extra_paid_on_year_check') then
    alter table year_extra_expenses
      add constraint year_extra_paid_on_year_check
      check (paid_on is null or extract(year from paid_on)::int = year);
  end if;
end $$;

commit;
