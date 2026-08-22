import { createClient } from '@supabase/supabase-js'

// This client is intentionally unused in Phase 1. V1 continues to use GAS.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null
