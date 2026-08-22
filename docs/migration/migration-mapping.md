# Google Sheets to Supabase Mapping

| V1 Sheet | V2 table | Identity mapping |
|---|---|---|
| app_settings | app_settings | key → setting_key |
| dim_accounts | accounts | account_id → legacy_id; physical_account_link → parent_account_id after lookup |
| dim_salary_plans | salary_plans | template_id → legacy_id |
| fact_cycle_budgets | cycle_budgets | budget_id → legacy_id; cycle_id → salary_cycle_id |
| fact_transactions | transactions | transaction_id → legacy_id; date → transaction_date |
| fact_cc_bridge | cc_bridges | bridge_id → legacy_id; transaction_id → transaction_id FK |
| fact_ipo_tracker | ipo_tracker | ipo_id → legacy_id |
| fact_bursa_tracker | bursa_trades | trade_id → legacy_id |
| dim_wishlist | wishlist | item_id → legacy_id |
| fact_house_fund | house_fund | trx_id → legacy_id |

All V2 records receive UUID primary keys. Legacy IDs are unique per owner where supplied. V1 cycle values `YYYY-MM` map directly to `salary_cycles.cycle_code`; V1 `YYYY-MM-DD` becomes its month code plus a configured/validated start date. The importer must report rather than guess missing dates.
