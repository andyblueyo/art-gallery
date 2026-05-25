import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Artwork, Profile } from "@/lib/types";
import { getDemoGallery } from "@/lib/demo-data";

export async function getProfileByHandle(
  handle: string
): Promise<Profile | null> {
  if (!isSupabaseConfigured()) {
    console.log("[data] getProfileByHandle: Supabase NOT configured — using demo data for", handle);
    const demo = getDemoGallery(handle);
    return demo?.profile ?? null;
  }

  const supabase = await createClient();
  console.log("[data] getProfileByHandle querying profiles.handle =", handle.toLowerCase());
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("handle", handle.toLowerCase())
    .single();

  if (error) {
    console.error("[data] getProfileByHandle error:", error);
  }
  console.log("[data] getProfileByHandle result:", data ? { id: data.id, handle: data.handle } : null);
  if (error || !data) return null;
  return data as Profile;
}

export async function getArtworksByArtistId(
  artistId: string
): Promise<Artwork[]> {
  if (!isSupabaseConfigured()) {
    console.log("[data] getArtworksByArtistId: Supabase NOT configured — returning demo artworks");
    const demo = getDemoGallery("maya-lin");
    return demo?.artworks ?? [];
  }

  const supabase = await createClient();
  console.log("[data] getArtworksByArtistId querying artworks.artist_id =", artistId);
  const { data, error } = await supabase
    .from("artworks")
    .select("*")
    .eq("artist_id", artistId)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[data] getArtworksByArtistId error:", error);
  }
  console.log(
    "[data] getArtworksByArtistId returned",
    data?.length ?? 0,
    "rows:",
    data?.map((a) => ({ id: a.id, title: a.title, file_url: a.file_url, display_order: a.display_order }))
  );
  if (error || !data) return [];
  return data as Artwork[];
}

export async function getGalleryByHandle(handle: string): Promise<{
  profile: Profile;
  artworks: Artwork[];
} | null> {
  const normalizedHandle = handle.toLowerCase();

  if (!isSupabaseConfigured()) {
    return getDemoGallery(normalizedHandle);
  }

  const profile = await getProfileByHandle(normalizedHandle);
  if (!profile) return null;

  const artworks = await getArtworksByArtistId(profile.id);
  return { profile, artworks };
}

export async function recordPageView(artistId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  await supabase.from("page_views").insert({ artist_id: artistId });
}
