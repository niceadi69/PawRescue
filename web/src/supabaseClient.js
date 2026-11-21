import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Don't crash the whole site when the host is missing these: the landing,
// donate and report pages still render, and data calls show an error instead.
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://not-configured.supabase.co',
  supabaseAnonKey || 'not-configured'
)
