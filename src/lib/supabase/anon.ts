import { createClient } from "@supabase/supabase-js";

// Cookie-free client for public-read data. Deliberately not the cookie-bound
// server client: cookies() is a dynamic API and cannot be called inside
// unstable_cache, which is where these reads live.
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}
