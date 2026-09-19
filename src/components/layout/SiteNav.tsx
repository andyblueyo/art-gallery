import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

interface SiteNavProps {
  signedIn: boolean;
  active?: "explore";
}

const linkClass = "hover:opacity-70 transition-opacity";

export function SiteNav({ signedIn, active }: SiteNavProps) {
  return (
    <nav className="border-b" style={{ borderColor: "#D3CEBF", color: "#2C2A22" }}>
      {/* Wraps instead of overflowing if the links don't fit beside the wordmark on narrow phones. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-y-2">
        <Link href="/" style={{ fontFamily: "'Crooked', serif", fontSize: "24px" }}>
          gallery club
        </Link>
        <div className="flex items-center gap-4 sm:gap-6 text-sm">
          <Link
            href="/explore"
            aria-current={active === "explore" ? "page" : undefined}
            className={`${linkClass} ${active === "explore" ? "underline underline-offset-4" : ""}`}
          >
            explore
          </Link>
          {signedIn ? (
            <>
              <Link href="/dashboard" className={linkClass}>
                dashboard
              </Link>
              <form action={signOut}>
                <button type="submit" className={linkClass}>
                  sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className={linkClass}>
              sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
