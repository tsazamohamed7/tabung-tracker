# Migration Risks

These are baseline observations, not changes proposed or applied in Phase 0.

## High risk

1. **Unbounded full-table reads.** Every read endpoint uses `getDataRange()` and returns the entire table through JSONP. The transaction ledger and cycle budgets are fetched wholesale, then sorted, filtered, and aggregated in the browser. This will increase Apps Script execution time, response size, JSONP parse work, and view load time as data grows.

2. **Denormalized balances with non-atomic updates.** A transaction write mutates account balance(s) and appends a ledger row as separate Sheet operations; simultaneous writes can race. A bridge-creation failure is caught and does not abort the transaction. No lock or transaction boundary protects multi-table workflows.

3. **Multiple, inconsistent financial calculations.** Backend incremental balance adjustment and manual `syncAllAccountBalances` differ in transfer-like category treatment. Frontend `finance`, `transactions`, and `salary` calculate spend with related but nonidentical category, envelope, CC-settlement, and cycle comparisons.

4. **Cycle ID format drift.** Schema/comments use `YYYY-MM`, but `salary.startNewCycle` posts `YYYY-MM-DD`. Several readers compare only the first seven characters, while others use exact equality. A database migration must explicitly preserve or normalize historical values.

5. **Cycle close can partially close a cycle.** `closeCycle` locks only budgets present in the submitted decisions and creates transfer rows one by one. A malformed/incomplete request or mid-operation failure can leave an inconsistent cycle.

## Medium risk

6. **Weak referential integrity.** Foreign keys are conventions only. Generic upserts can create dangling references; deactivated accounts can remain referenced by historical/current rows.

7. **Schema/setup drift.** `fact_house_fund` is added separately, does not use the configured spreadsheet ID, and is absent from `SHEETS`. Setup commentary says seven sheets while defining nine. A migration inventory must account for production sheets created at different times.

8. **Timestamp-derived IDs.** IDs based on `Date.now()` have collision/retry/idempotency risk, especially across client optimistic IDs and GAS-generated IDs.

9. **JSONP transport.** Read data is executable script-tag content with callback names; it has security, observability, caching, and error-handling constraints. Standard authenticated JSON endpoints will need a staged compatibility plan.

10. **Boolean and date coercion.** Sheet values can be strings, booleans, or Dates. Some safeguards only recognize strict `true`, which can make locks/cycle behavior dependent on representation.

11. **CC bridge semantic mismatch.** New CC charges create bridge status `Unassigned`; frontend pending logic recognizes Pending or Unassigned. CC assignment uses transaction/store fields with both mapped and raw property names, making data-shape compatibility sensitive.

12. **No automated regression suite.** There are no tests, linting script, or CI workflow. Build is available, but core accounting scenarios lack executable protection before later migration changes.

## Baseline controls before any behavioral migration

- Capture representative real Sheet exports and the deployed GAS version/URL/configuration.
- Add read-only characterization tests for balances, cycles, CC settlement, and transaction aggregates before moving logic.
- Define canonical identifiers, dates/time zone, amounts, Boolean serialization, account status, and cycle semantics.
- Introduce paginated/filterable read contracts behind compatibility endpoints before changing frontend data loading.
- Make multi-table write workflows idempotent and lock-protected, with reconciliation/audit reporting.
- Retain the ledger as immutable and derive/reconcile balances deterministically before replacing stored balance semantics.
