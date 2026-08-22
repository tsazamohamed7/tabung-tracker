-- Phase 1 foundation. Apply with the Supabase CLI; do not run against V1 Google Sheets.
create extension if not exists pgcrypto;

create type public.account_type as enum ('virtual','physical','cc');
create type public.cycle_status as enum ('draft','active','closed','archived');
create type public.cc_bridge_status as enum ('unassigned','assigned','settled');
create type public.bursa_trade_status as enum ('holding','sold');
create type public.wishlist_status as enum ('planned','saving','purchased');
create type public.house_fund_type as enum ('contribution','expense','withdrawal');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  setting_key text not null check (length(trim(setting_key)) > 0),
  setting_value text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, setting_key),
  unique (id, owner_id)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  legacy_id text,
  bank_name text not null,
  label text not null,
  account_type public.account_type not null,
  parent_account_id uuid,
  opening_balance numeric(14,2) not null default 0,
  legacy_balance numeric(14,2),
  goal_amount numeric(14,2),
  goal_date date,
  cc_expiry date,
  cc_last_4 text check (cc_last_4 is null or cc_last_4 ~ '^[0-9]{4}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique nulls not distinct (owner_id, legacy_id),
  foreign key (parent_account_id, owner_id) references public.accounts(id, owner_id) on delete restrict,
  check (goal_amount is null or goal_amount >= 0),
  check (parent_account_id is null or parent_account_id <> id)
);

create table public.salary_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  legacy_id text,
  item_name text not null,
  category text not null,
  planned_amount numeric(14,2) not null check (planned_amount >= 0),
  priority integer not null check (priority > 0),
  default_source_account_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique nulls not distinct (owner_id, legacy_id),
  foreign key (default_source_account_id, owner_id) references public.accounts(id, owner_id) on delete restrict
);

create table public.salary_cycles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  legacy_id text,
  cycle_code text not null check (cycle_code ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  start_date date not null,
  end_date date not null,
  status public.cycle_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, cycle_code),
  unique nulls not distinct (owner_id, legacy_id),
  check (end_date >= start_date)
);

create table public.cycle_budgets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  legacy_id text,
  salary_cycle_id uuid not null,
  salary_plan_id uuid,
  envelope_name text not null,
  category text not null,
  planned_amount numeric(14,2) not null check (planned_amount >= 0),
  source_account_id uuid,
  rollover_amount numeric(14,2),
  rollover_destination_account_id uuid,
  rollover_action text check (rollover_action is null or rollover_action in ('sweep','keep','overspent')),
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique nulls not distinct (owner_id, legacy_id),
  unique (salary_cycle_id, salary_plan_id),
  foreign key (salary_cycle_id, owner_id) references public.salary_cycles(id, owner_id) on delete restrict,
  foreign key (salary_plan_id, owner_id) references public.salary_plans(id, owner_id) on delete restrict,
  foreign key (source_account_id, owner_id) references public.accounts(id, owner_id) on delete restrict,
  foreign key (rollover_destination_account_id, owner_id) references public.accounts(id, owner_id) on delete restrict
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  legacy_id text,
  transaction_date date not null,
  salary_cycle_id uuid,
  description text not null,
  category text not null,
  salary_plan_id uuid,
  cycle_budget_id uuid,
  amount numeric(14,2) not null check (amount <> 0),
  source_account_id uuid,
  destination_account_id uuid,
  is_cc_transaction boolean not null default false,
  cc_settlement_status text check (cc_settlement_status is null or cc_settlement_status in ('pending','settled')),
  legacy_reference_id text,
  legacy_reference_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique nulls not distinct (owner_id, legacy_id),
  foreign key (salary_cycle_id, owner_id) references public.salary_cycles(id, owner_id) on delete restrict,
  foreign key (salary_plan_id, owner_id) references public.salary_plans(id, owner_id) on delete restrict,
  foreign key (cycle_budget_id, owner_id) references public.cycle_budgets(id, owner_id) on delete restrict,
  foreign key (source_account_id, owner_id) references public.accounts(id, owner_id) on delete restrict,
  foreign key (destination_account_id, owner_id) references public.accounts(id, owner_id) on delete restrict,
  check (source_account_id is not null or destination_account_id is not null)
);

create table public.cc_bridges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  legacy_id text,
  transaction_id uuid not null,
  funding_source_account_id uuid,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  charge_date date not null,
  settlement_date date,
  status public.cc_bridge_status not null default 'unassigned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique nulls not distinct (owner_id, legacy_id),
  unique (transaction_id),
  foreign key (transaction_id, owner_id) references public.transactions(id, owner_id) on delete restrict,
  foreign key (funding_source_account_id, owner_id) references public.accounts(id, owner_id) on delete restrict,
  check ((status = 'unassigned' and funding_source_account_id is null and settlement_date is null)
      or (status = 'assigned' and funding_source_account_id is not null and settlement_date is null)
      or (status = 'settled' and funding_source_account_id is not null and settlement_date is not null))
);

create table public.ipo_tracker (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  legacy_id text,
  stock_name text not null,
  apply_date date not null,
  apply_stock_price numeric(14,2) not null check (apply_stock_price >= 0),
  apply_lot integer not null check (apply_lot >= 0),
  apply_amount numeric(14,2) not null check (apply_amount >= 0),
  apply_source_fund_count integer check (apply_source_fund_count is null or apply_source_fund_count >= 0),
  apply_source_account_id uuid,
  ballot_date date,
  allocated_lot integer check (allocated_lot is null or allocated_lot >= 0),
  refund_amount numeric(14,2) check (refund_amount is null or refund_amount >= 0),
  listing_date date, sell_date date, sell_price numeric(14,2), brokerage_fee numeric(14,2),
  net_profit numeric(14,2),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, owner_id), unique nulls not distinct (owner_id, legacy_id),
  foreign key (apply_source_account_id, owner_id) references public.accounts(id, owner_id) on delete restrict,
  check (sell_price is null or sell_price >= 0), check (brokerage_fee is null or brokerage_fee >= 0)
);

create table public.bursa_trades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  legacy_id text,
  stock_name text not null,
  source_account_id uuid,
  status public.bursa_trade_status not null default 'holding',
  buy_date date not null, buy_lot integer not null check (buy_lot >= 0),
  buy_price numeric(14,2) not null check (buy_price >= 0), buy_fee numeric(14,2) not null default 0 check (buy_fee >= 0),
  total_invested numeric(14,2) not null check (total_invested >= 0),
  sell_date date, sell_price numeric(14,2), sell_fee numeric(14,2), total_revenue numeric(14,2), net_profit numeric(14,2),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, owner_id), unique nulls not distinct (owner_id, legacy_id),
  foreign key (source_account_id, owner_id) references public.accounts(id, owner_id) on delete restrict,
  check (sell_price is null or sell_price >= 0), check (sell_fee is null or sell_fee >= 0), check (total_revenue is null or total_revenue >= 0)
);

create table public.wishlist (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  legacy_id text,
  item_name text not null, emoji text,
  estimated_price numeric(14,2) not null check (estimated_price >= 0),
  target_account_id uuid,
  status public.wishlist_status not null default 'planned',
  target_date date, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, owner_id), unique nulls not distinct (owner_id, legacy_id),
  foreign key (target_account_id, owner_id) references public.accounts(id, owner_id) on delete restrict
);

create table public.house_fund (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  legacy_id text, transaction_date date not null,
  fund_type public.house_fund_type not null, funder text,
  amount numeric(14,2) not null check (amount <> 0), description text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, owner_id), unique nulls not distinct (owner_id, legacy_id)
);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id) values (new.id) on conflict (id) do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','app_settings','accounts','salary_plans','salary_cycles','cycle_budgets','transactions','cc_bridges','ipo_tracker','bursa_trades','wishlist','house_fund'] loop
    execute format('create trigger %I before update on public.%I for each row execute procedure public.set_updated_at()', 'set_'||t||'_updated_at', t);
  end loop;
end $$;

create index transactions_owner_date_idx on public.transactions(owner_id, transaction_date desc);
create index transactions_owner_cycle_idx on public.transactions(owner_id, salary_cycle_id);
create index transactions_source_account_idx on public.transactions(owner_id, source_account_id);
create index transactions_destination_account_idx on public.transactions(owner_id, destination_account_id);
create index cycle_budgets_cycle_idx on public.cycle_budgets(owner_id, salary_cycle_id);
create index cycle_budgets_plan_idx on public.cycle_budgets(owner_id, salary_plan_id);
create index cc_bridges_transaction_idx on public.cc_bridges(owner_id, transaction_id);
create index cc_bridges_funding_idx on public.cc_bridges(owner_id, funding_source_account_id);
create index accounts_owner_active_idx on public.accounts(owner_id) where is_active;

alter table public.profiles enable row level security;
create policy profiles_self on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $ declare t text; begin
  foreach t in array array['app_settings','accounts','salary_plans','salary_cycles','cycle_budgets','transactions','cc_bridges','ipo_tracker','bursa_trades','wishlist','house_fund'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t||'_owner', t);
  end loop;
end $;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
