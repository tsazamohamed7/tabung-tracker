# Current Google Sheet Schema

Source of truth: `gas/Setup.gs`, `gas/Setup_Addendum.gs`, and the domain module header constants. The setup file creates nine tables; `setupHouseFund()` creates a tenth separately.

## Tables

### `app_settings`

Primary key: `key`.

`key, value, updated_at, note`

Important keys seeded: `current_cycle_id`, `cycle_start_day`, `default_currency`, `partner_view_enabled`, and `app_version`. Values are persisted as strings.

### `dim_accounts`

Primary key: `account_id`.

`account_id, bank_name, label, type, physical_account_link, initial_balance, balance, goal_amount, goal_date, cc_expiry, cc_last_4, is_active`

`type` accepts Virtual, Physical, or CC. `physical_account_link` is a logical parent-bank reference, not an enforced Sheet foreign key. `balance` is mutable/denormalized; `initial_balance` is used by the balance-repair procedure.

### `fact_transactions`

Primary key: `transaction_id`.

`transaction_id, date, cycle_id, description, category, envelope_id, amount, source_account_id, destination_account_id, is_cc_transaction, cc_settlement_status, ref_id`

Relationships: `envelope_id → dim_salary_plans.template_id`; source/destination account IDs → `dim_accounts.account_id`; `ref_id` may target an IPO or CC bridge. Positive values are credits and negative values debits, although transfer semantics additionally depend on source/destination/category handling.

### `dim_salary_plans`

Primary key: `template_id`.

`template_id, item_name, category, planned_amount, priority, default_source_id`

`default_source_id → dim_accounts.account_id`. This is the reusable allocation template copied when a cycle starts.

### `fact_cycle_budgets`

Primary key: `budget_id`.

`budget_id, cycle_id, template_id, envelope_name, category, planned_amount, source_account_id, rollover_amount, rollover_dest_id, rollover_action, is_locked`

Relationships: `template_id → dim_salary_plans.template_id`; `source_account_id` and `rollover_dest_id → dim_accounts.account_id`; `cycle_id` corresponds to the active-cycle setting and ledger cycle IDs. `rollover_action` is intended to be sweep, keep, or overspent.

### `fact_ipo_tracker`

Primary key: `ipo_id`.

`ipo_id, stock_name, apply_date, apply_stock_price, apply_lot, apply_amount, apply_source_fund, apply_source_id, ballot_date, allocated_lot, refund_amount, listing_date, sell_date, sell_price, brokerage_fee, net_profit`

`apply_source_id → dim_accounts.account_id`. The lifecycle is applied, ballot/refund, listing, and sale; status is inferred in the frontend rather than stored in this schema.

### `fact_bursa_tracker`

Primary key: `trade_id`.

`trade_id, stock_name, source_fund_id, status, buy_date, buy_lot, buy_price, buy_fee, total_invested, sell_date, sell_price, sell_fee, total_revenue, net_profit`

`source_fund_id → dim_accounts.account_id`; status accepts Holding or Sold.

### `fact_cc_bridge`

Primary key: `bridge_id`.

`bridge_id, transaction_id, description, amount, charge_date, funding_source_id, settlement_date, status`

Relationships: `transaction_id → fact_transactions.transaction_id`; `funding_source_id → dim_accounts.account_id`. Status accepts Unassigned, Assigned, or Settled.

### `dim_wishlist`

Primary key: `item_id`.

`item_id, item_name, emoji, estimated_price, target_fund_id, status, target_date, notes`

`target_fund_id → dim_accounts.account_id`; status accepts Planned, Saving, or Purchased.

### `fact_house_fund`

Primary key: `trx_id`.

`trx_id, date, type, funder, amount, description`

This table is not in `SHEETS`, is not created by the primary setup, and uses `SpreadsheetApp.getActiveSpreadsheet()` rather than `SHEET_ID`. Types are Contribution, Expense, or Withdrawal; funder is an unconstrained label from the addendum's validation list.

## Integrity and representation notes

- Google Sheets provides no database-level primary-key, foreign-key, unique, or transactional constraints. IDs are generated from timestamps in several write paths.
- Boolean cells may arrive in client/backend code as JavaScript booleans or strings such as `'TRUE'`; some code only accepts a strict Boolean.
- Date/cycle values are represented inconsistently: seeded cycle IDs use `YYYY-MM`, while the salary UI now sends a full start-date `YYYY-MM-DD`. The frontend frequently normalizes comparison to the first seven characters.
- Setup says "all 7 sheets" but the current schema defines nine tables, plus the addendum table.
- The format routine omits some monetary columns (for example selected Bursa fees/totals), so presentation is not a complete type system.
