import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Client anonyme réservé au rendu serveur des contenus déjà publics. Aucune
 * clé privilégiée n'est utilisée dans l'application Next.js. */
export function publicSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

