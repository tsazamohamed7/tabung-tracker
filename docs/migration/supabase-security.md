# Supabase Security Model

`auth.users → profiles → owner_id` is the ownership chain. Every financial row has a required `owner_id UUID` referencing `profiles(id)`.

RLS is enabled on profiles and every user-owned table. Authenticated users may select, insert, update, or delete only rows where `owner_id = auth.uid()`; profiles use `id = auth.uid()`. Policies enforce both `USING` and `WITH CHECK`, so changing ownership is blocked. Composite owner-aware foreign keys prevent referencing another user's account/cycle/plan from a valid row.

The browser config reads only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. No service-role key is present in frontend files or `.env.example`. A future privileged importer, if implemented, must keep credentials in its execution environment.
