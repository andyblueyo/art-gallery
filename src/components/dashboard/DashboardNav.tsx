"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface DashboardNavProps {
  handle: string;
}

export function DashboardNav({ handle }: DashboardNavProps) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="flex items-center justify-between border-b border-[#d8ceb8] pb-5">
      <Link href="/dashboard" className="font-serif text-xl text-[#2a2018]">
        gallery club
      </Link>
      <div className="flex items-center gap-4 sm:gap-6">
        <Link
          href={`/${handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#c8a040] hover:underline underline-offset-2"
        >
          view my gallery →
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="text-sm text-brown-muted hover:text-brown transition-colors"
        >
          sign out
        </button>
      </div>
    </nav>
  );
}
