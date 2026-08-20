# Phase 0 — Repository Audit and Migration Baseline

Audited repository: `tsazamohamed7/tabung-tracker` on `main` (baseline tree `52a9c4dbd0d38ef8863297eef1b165706a532170`).

## Scope and guardrail

This phase documents the existing implementation only. No application or Google Apps Script (GAS) behavior was changed. The only files introduced are the Phase 0 documents under `docs/migration/`.

## Frontend architecture

The client is a Vue 3 single-page application built with Vite, Tailwind CSS, Pinia, Vue Router, and a PWA Vite plugin.

- Entry and composition: `src/main.js` creates Vue, Pinia, and hash-based routing; `src/App.vue` provides shell navigation and loads app settings.
- Routing: dashboard, ledger, salary cycle, virtual funds, CC bridge, IPO, Bursa, house fund, partner, reconciliation, plus phone/welcome routes.
- State: focused Pinia composition stores own individual datasets and actions: `app`, `accounts`, `transactions`, `salary`, `cc`, `ipo`, `bursa`, `houseFund`, `wishlist`, and an older overlapping `finance` store.
- UI: views load their required stores on mount; reusable modal, stat, header, progress, toast, and alert components provide presentation and transaction entry.
- API boundary: `src/composables/useApi.js` adapts Sheet column names to client objects. Reads are JSONP script injections, and writes are `text/plain` POSTs to the GAS web-app URL supplied as `VITE_GAS_URL`.
- Client storage: the device-mode choice is persisted in `localStorage`; no application database exists in the frontend.

The frontend uses optimistic mutations in several stores. Local arrays are changed first and rolled back after an API error; backend writes are otherwise not transactional.

## GAS backend architecture

GAS is a single Apps Script project organized by concern.

- `Router.gs`: public `doGet`/ `doPost`, JSON/JSONP response wrapper, and resource switchboards.
- `Config.gs`: spreadsheet identifier/configuration, Sheet lookup, full-sheet object conversion, append, generic upsert, and delete helpers.
- Domain modules: accounts, app settings, transactions, salary plans, cycle budgets, CC bridge, IPO, Bursa, wishlist, and house fund.
- `Setup.gs`: primary nine-table schema setup, formatting, validations, sample data, setup menu, data reset, and balance resynchronization.
- `Setup_Addendum.gs`: separate House Fund table setup.

All normal reads are full `getDataRange().getValues()` reads. The router does not pass request filters to the data functions, so the frontend receives complete datasets and performs filtering/aggregation locally.

## Read API resources

| Resource | Backend module | Frontend API method |
|---|---|---|
| `app_settings` | AppSettings | `getSettings` |
| `accounts` | Accounts | `getAccounts` |
| `transactions` | Transactions | `getTransactions` |
| `salary_plans` | SalaryPlans | `getSalaryPlans` |
| `cycle_budgets` | CycleBudgets | `getCycleBudgets` |
| `ipos` | IpoTracker | `getIpos` |
| `bursa_trades` | BursaTracker | `getBursaTrades` |
| `cc_bridge` | CcBridge | `getCcBridge` |
| `wishlist` | Wishlist | `getWishlist` |
| `house_fund` | HouseFund | `getHouseFund` |

## CRUD inventory

| Domain | Create/update | Delete | Special behavior |
|---|---|---|---|
| Settings | `setSetting`, `setSettings` | — | key/value upsert |
| Accounts | `upsertAccount` | soft removal via `is_active=false` | balances are mutable cached values |
| Transactions | `addTransaction` | — | append-only; a CC entry creates a bridge row |
| Salary plans | `upsertSalaryPlan` | — | template only |
| Cycle budgets | `upsertCycleBudget` | `deleteCycleBudget` | blocks changes to strict Boolean locked rows |
| CC bridge | `upsertCcBridge` | — | `assignCcFunding` creates settlement transfer and marks original transaction |
| IPO | `upsertIpo` | — | lifecycle stages update one row |
| Bursa | `upsertBursaTrade` | — | buy/sell updates one row |
| Wishlist | `upsertWishlist` | — | status lifecycle lives in one row |
| House Fund | `upsertHouseFundTrx` | `deleteHouseFundTrx` | separate active-spreadsheet access path |

## Transaction flow

1. A view/modal calls `useTransactionStore.addTransaction`; virtual transfers, CC entry, IPO/Bursa flows, reconciliation adjustments, and salary-cycle actions all converge here (some legacy `finance` code duplicates this).
2. The frontend optimistically adds a mapped transaction, then posts to `resource=transactions`.
3. `Transactions.addTransaction` assigns an ID if absent. CC charges also create a `fact_cc_bridge` row and write its ID into `ref_id`.
4. It adjusts source and destination account balances, then appends the ledger row.
5. CC assignment later calls `assign_cc_funding`: it creates a new funding/transfer-style transaction, marks the original CC transaction settled, and updates the bridge row.

Transactions are logically append-only, except `updateTransactionStatus` mutates CC settlement state.

## Balance calculation flow

Normal operation maintains denormalized `dim_accounts.balance` incrementally. For each added transaction, source balance changes by the signed amount except transfer/loan/repayment-like transactions are forced negative; destination always receives absolute amount. The UI treats the stored balance as authoritative and aggregates virtual accounts by physical link.

`syncAllAccountBalances` is a manual repair utility. It resets each balance to `initial_balance`, rereads all transactions, then applies source/destination deltas. This is not the same exact rule set as `addTransaction` (notably the repair path recognizes only `Transfer`, while incremental logic recognizes `Loan` and `Repayment` too).

## Salary-cycle and budget flow

1. The app setting `current_cycle_id` identifies the active cycle.
2. `startNewCycle` prevents duplicate cycle-budget rows, copies every salary-plan template into `fact_cycle_budgets`, and appends the income transaction.
3. The frontend calculates envelope spend from the whole transaction ledger, largely by category (and in `transactions` store, sometimes envelope ID).
4. Users can upsert/delete unlocked cycle budgets.
5. `closeCycle` records requested rollover fields, creates transfer rows for positive `sweep` decisions, and writes `is_locked=true` for only the budgets represented in the submitted decisions.

## Full-dataset downloads

Every `api.get*` method returns an unpaginated, unfiltered table: settings, accounts, transactions, salary plans, cycle budgets, IPOs, Bursa trades, CC bridge, wishlist, and house fund. The largest growth risks are `fact_transactions`, `fact_cycle_budgets`, and tracker/bridge facts. The dashboard, ledger, salary, virtual-fund, CC, IPO, Bursa, partner, phone, and reconciliation views all initiate whole-table reads through their stores.

## Tests and commands

No test framework, test files, lint script, CI workflow, or `test` script is present in the audited tree.

Available package scripts:

```sh
npm install
npm run dev
npm run build
npm run preview
```

GAS has no automated test harness or local run command in this repository; setup and repair functions are run from the Apps Script editor after configuration/deployment.

See [current-schema.md](current-schema.md), [module-dependencies.md](module-dependencies.md), and [migration-risks.md](migration-risks.md).
