import { createBrowserClient } from "@supabase/ssr";

const cookieDomain = (process.env.NEXT_PUBLIC_SITE_URL ?? "").includes(
  "galleryclub.online"
)
  ? ".galleryclub.online"
  : undefined;

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { domain: cookieDomain },
    }
  );
  return client;
}