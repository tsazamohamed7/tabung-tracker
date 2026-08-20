# Module Dependencies

## Runtime topology

```text
Vue views/components
  -> Pinia stores
  -> useApi.js (row mapping, JSONP reads, POST writes)
  -> GAS Router.gs
  -> domain GAS modules + Config.gs helpers
  -> Google Sheets tables
```

## Frontend module ownership

| Store/module | Owns | Depends on |
|---|---|---|
| `app` | settings, active-cycle metadata | useApi |
| `accounts` | account registry and liquid-balance aggregation | useApi |
| `transactions` | ledger, spend/income/debt/cycle calculations, unified client transaction entry | app, useApi |
| `salary` | salary templates, cycle budgets, rollover and cycle workflow | app, accounts, transactions, useApi |
| `cc` | CC bridge status/assignment | accounts, transactions, app, useApi |
| `virtualTabung` | virtual fund transfer/create/edit/deactivate | accounts, transactions, useApi |
| `ipo` | IPO lifecycle | accounts, transactions, useApi |
| `bursa` | Bursa trade lifecycle | accounts, transactions, useApi |
| `houseFund` | house-fund record CRUD | useApi |
| `wishlist` | shared wishlist CRUD | useApi |
| `finance` | older parallel multi-domain state and business calculations | useApi |

Views invoke their respective stores on mount. The dashboard combines app, accounts, transactions, salary, CC, and IPO data; Salary Cycle combines app, accounts, transactions, and salary; CC Bridge additionally uses salary; IPO and Bursa additionally use accounts/transactions. Modal components write mainly through the transactions store.

## Backend module ownership

| GAS module | Table(s) | Dependencies |
|---|---|---|
| Config | all configured tables | SpreadsheetApp, `SHEET_ID` |
| Router | none directly | all read/write domain functions |
| AppSettings | app_settings | Config |
| Accounts | dim_accounts | Config |
| Transactions | fact_transactions, fact_cc_bridge, dim_accounts | Config, Accounts, CcBridge |
| SalaryPlans | dim_salary_plans, fact_cycle_budgets, fact_transactions | CycleBudgets, Transactions |
| CycleBudgets | fact_cycle_budgets, fact_transactions | Config, Transactions |
| CcBridge | fact_cc_bridge, fact_transactions, dim_accounts | Config, Transactions |
| IpoTracker | fact_ipo_tracker | Config |
| BursaTracker | fact_bursa_tracker | Config |
| Wishlist | dim_wishlist | Config |
| HouseFund | fact_house_fund | Config's row helpers but bypasses configured Sheet access |
| Setup / Addendum | schema/table provisioning | SpreadsheetApp; Setup also invokes Accounts/Transactions for repair |

## Key cross-domain relationships

```text
dim_salary_plans --copied on payday--> fact_cycle_budgets
fact_cycle_budgets --category/template matching--> fact_transactions
fact_transactions --incremental balance mutation--> dim_accounts.balance
fact_transactions --CC charge--> fact_cc_bridge
fact_cc_bridge --assignment--> new fact_transactions row + original status update
dim_accounts --fund references--> IPO, Bursa, wishlist, CC bridge, budgets, transactions
app_settings.current_cycle_id --selects--> active frontend salary/budget view
```

## Coupling to preserve during migration

- `Transactions.addTransaction` is the most critical backend orchestration point: ledger append, CC bridge creation, and account balance adjustment are all coupled there.
- Salary-cycle commands rely on multiple tables and invoke transaction writes, so they cannot be migrated as isolated cycle-budget CRUD.
- Multiple stores independently calculate spending from the same ledger with nonidentical filters; centralizing this changes observable numbers unless compatibility is consciously defined.
- `finance` overlaps newer focused stores. It appears unused by current route imports but remains an alternate implementation and must be assessed before removal in a later phase.
