# Migration Validation

Run the non-destructive representative dry run:

```sh
node scripts/migrate-google-sheets.mjs --input scripts/fixtures/google-sheets-representative.json
```

Representative result: Accounts 2/2 valid; Salary plans 1/1 valid; Cycles (derived from budgets) 1 valid; Transactions 2/2 valid; CC bridges 1/1 valid; all other fixture domains 0 rows. The validator reports duplicate legacy IDs, invalid amounts/dates/booleans, unknown account/cycle/template references, and unknown CC transaction references. It writes no Supabase data unless a future apply implementation is explicitly enabled.
