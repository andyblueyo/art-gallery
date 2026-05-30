import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const cookieDomain = (process.env.NEXT_PUBLIC_SITE_URL ?? "").includes(
  "galleryclub.online"
)
  ? ".galleryclub.online"
  : undefined;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { domain: cookieDomain },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  if (!isSupabaseConfigured()) {
    return supabaseResponse;
  }

  if (pathname.startsWith("/dashboard") && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // if ((pathname === "/login" || pathname === "/signup") && user) {
  //   const dashUrl = request.nextUrl.clone();
  //   dashUrl.pathname = "/dashboard";
  //   dashUrl.search = "";
  //   return NextResponse.redirect(dashUrl);
  // }

  return supabaseResponse;
}
