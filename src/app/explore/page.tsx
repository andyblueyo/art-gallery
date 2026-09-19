import type { Metadata } from "next";
import { getGalleryDirectory } from "@/lib/data";
import { getGalleryUrl } from "@/lib/url";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { GalleryDirectory } from "@/components/explore/GalleryDirectory";
import { SiteNav } from "@/components/layout/SiteNav";

export const metadata: Metadata = {
  title: "explore galleries",
  description: "Browse every artist's gallery on gallery club.",
};

async function isSignedIn(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}

export default async function ExplorePage() {
  const [directory, signedIn] = await Promise.all([
    getGalleryDirectory(),
    isSignedIn(),
  ]);
  const galleries = await Promise.all(
    directory.map(async (entry) => ({
      ...entry,
      url: await getGalleryUrl(entry.handle),
    }))
  );

  return (
    <div style={{ backgroundColor: "#F2EDE3" }} className="min-h-screen flex flex-col">
      <SiteNav signedIn={signedIn} active="explore" />

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-16">
        <h1
          style={{ fontFamily: "'Crooked', serif", fontSize: "48px", color: "#2C2A22" }}
          className="mb-4 text-center leading-tight"
        >
          explore galleries
        </h1>
        <p style={{ color: "#888780" }} className="text-center mb-10">
          every artist on gallery club, most recently updated first.
        </p>

        <GalleryDirectory galleries={galleries} />
      </main>
    </div>
  );
}
