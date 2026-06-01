"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface DashboardNavProps {
  handle: string;
}

function getGalleryUrlClient(handle: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (!origin) return `https://${handle}.galleryclub.online`;

  const url = new URL(origin);
  const hostname = url.hostname;

  if (hostname.includes("localhost")) {
    return `http://${handle}.localhost:3000`;
  }

  return `https://${handle}.${hostname}`;
}

export function DashboardNav({ handle }: DashboardNavProps) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const galleryUrl = getGalleryUrlClient(handle);

  return (
    <nav className="flex items-center justify-between border-b border-[#d8ceb8] pb-5">
      <Link href="https://galleryclub.online" className="font-serif text-xl text-[#2a2018]">
        gallery club
      </Link>
      <div className="flex items-center gap-4 sm:gap-6">
        <a
          href={galleryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#c8a040] hover:underline underline-offset-2"
        >
          view my gallery →
        </a>
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
