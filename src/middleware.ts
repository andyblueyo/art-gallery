import { NextResponse, NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const ROOT_DOMAIN = "galleryclub.online";

function extractSubdomain(hostname: string): string | null {
  if (
    hostname === ROOT_DOMAIN ||
    hostname === `www.${ROOT_DOMAIN}` ||
    hostname === "localhost:3000"
  ) {
    return null;
  }

  const prodSuffix = `.${ROOT_DOMAIN}`;
  if (hostname.endsWith(prodSuffix)) {
    const candidate = hostname.slice(0, -prodSuffix.length);
    if (candidate && candidate !== "www") return candidate;
  }

  // Local dev: <handle>.localhost:3000
  const localSuffix = ".localhost:3000";
  if (hostname.endsWith(localSuffix)) {
    const candidate = hostname.slice(0, -localSuffix.length);
    if (candidate) return candidate;
  }

  return null;
}

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  const hostname = request.headers.get("host") ?? "";
  const subdomain = extractSubdomain(hostname);

  if (!subdomain) {
    return await updateSession(request);
  }

  // Rewrite e.g. artist.galleryclub.online/ → /artist
  const rewrittenUrl = request.nextUrl.clone();
  const originalPath = request.nextUrl.pathname;
  rewrittenUrl.pathname = `/${subdomain}${originalPath === "/" ? "" : originalPath}`;

  // Run session update against the rewritten path so auth guards see the correct route.
  // We copy the original headers (including Cookie) so updateSession can read and
  // refresh the session; after it runs, rewrittenRequest.headers will contain the
  // updated cookie values (NextRequest.cookies.set mutates the underlying Cookie header).
  const rewrittenRequest = new NextRequest(rewrittenUrl, {
    headers: new Headers(request.headers),
  });
  const sessionResponse = await updateSession(rewrittenRequest);

  // If the session middleware issued a redirect (e.g. login guard), honour it
  if (sessionResponse.headers.has("location")) {
    return sessionResponse;
  }

  // Rewrite to the gallery path.  Pass { request: { headers } } so Next.js forwards
  // the potentially-refreshed session headers to server components — without this,
  // server components see the original (possibly stale) Cookie header and getUser()
  // returns null for recently-refreshed tokens.
  const rewriteResponse = NextResponse.rewrite(rewrittenUrl, {
    request: { headers: rewrittenRequest.headers },
  });
  // Also copy set-cookie onto the response so the browser stores refreshed tokens
  sessionResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      rewriteResponse.headers.append("set-cookie", value);
    }
  });
  return rewriteResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|frames|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
