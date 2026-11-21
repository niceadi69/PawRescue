import { createClient } from "@supabase/supabase-js";

// Set these in web/.env (see web/.env.example). Never put the
// service-role key here: everything in the web app is public.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Without keys the dashboard falls back to its sample data.
export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;
