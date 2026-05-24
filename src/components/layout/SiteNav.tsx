import Link from "next/link";
import { Wordmark } from "@/components/layout/Wordmark";

export function SiteNav() {
  return (
    <header className="border-b border-brown/10 bg-cream">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Wordmark size="sm" />
        <nav className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/explore"
            className="text-sm text-brown-muted hover:text-brown transition-colors hidden sm:inline"
          >
            explore
          </Link>
          <Link
            href="/login"
            className="text-sm px-3 sm:px-4 py-2 border border-brown/25 rounded-lg hover:border-brown/50 transition-colors whitespace-nowrap"
          >
            sign in
          </Link>
          <Link
            href="/signup"
            className="text-sm px-3 sm:px-4 py-2 bg-brown text-cream rounded-lg hover:bg-brown-light transition-colors whitespace-nowrap"
          >
            create your gallery
          </Link>
        </nav>
      </div>
    </header>
  );
}
