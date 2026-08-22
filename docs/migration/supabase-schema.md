# Supabase Schema

Core tables: profiles, app_settings, accounts, salary_plans, salary_cycles, cycle_budgets, transactions, cc_bridges, ipo_tracker, bursa_trades, wishlist, house_fund.

```text
profiles -> accounts, settings, plans, cycles, transactions, trackers
accounts -> accounts.parent_account_id
salary_plans -> cycle_budgets
salary_cycles -> cycle_budgets, transactions
cycle_budgets -> transactions
transactions -> cc_bridges
```

Accounts replace the string physical link with owner-scoped `parent_account_id`. Transactions retain a nullable `legacy_reference_id/type` pair instead of a polymorphic V1 foreign key; direct V2 relationships are explicit (`cc_bridges.transaction_id`, account FKs, plan/budget/cycle FKs). Current account balance is not a V2 source of truth: `opening_balance` and `legacy_balance` preserve migration evidence; a later approved ledger-balance design will define deterministic calculation.

Indexes follow V1 access: transaction owner/date, owner/cycle, source/destination account; budgets by cycle/plan; bridges by transaction/funding account; and active accounts by owner. Schema has no frontend dependency and is designed for future targeted queries, pagination, aggregates, and RPC.
