-- Run after supabase db reset. This is a focused schema/RLS characterization check.
begin;
do $$ declare n integer; begin
  select count(*) into n from pg_tables where schemaname='public' and tablename in
    ('profiles','app_settings','accounts','salary_plans','salary_cycles','cycle_budgets','transactions','cc_bridges','ipo_tracker','bursa_trades','wishlist','house_fund');
  if n <> 12 then raise exception 'expected 12 Phase 1 tables, got %', n; end if;
  select count(*) into n from pg_tables where schemaname='public' and rowsecurity
    and tablename in ('profiles','app_settings','accounts','salary_plans','salary_cycles','cycle_budgets','transactions','cc_bridges','ipo_tracker','bursa_trades','wishlist','house_fund');
  if n <> 12 then raise exception 'RLS missing on one or more Phase 1 tables'; end if;
  select count(*) into n from pg_policies where schemaname='public' and tablename='transactions' and qual like '%auth.uid()%';
  if n = 0 then raise exception 'transactions owner policy missing'; end if;
end $$;
rollback;
