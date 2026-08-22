# Phase 1 — Supabase Foundation

Phase 1 adds only V2 foundation assets. V1 Vue stores, GAS endpoints, and Google Sheets remain unchanged.

- SQL is reproducible from an empty Supabase database through `supabase/migrations/202608220001_phase_1_foundation.sql`.
- `src/lib/supabase.js` is public-key-only and deliberately unused in this phase.
- `scripts/migrate-google-sheets.mjs` is dry-run by default and requires an explicit confirmation flag before any future apply implementation.
- Amounts use `NUMERIC(14,2)`: two MYR decimal places and up to 999,999,999,999.99 without floating-point rounding.

No production migration has been run. See the accompanying schema, security, mapping, and validation documents.
