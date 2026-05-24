import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Artwork, Profile } from "@/lib/types";
import { getDemoGallery } from "@/lib/demo-data";

export async function getProfileByHandle(
  handle: string
): Promise<Profile | null> {
  if (!isSupabaseConfigured()) {
    const demo = getDemoGallery(handle);
    return demo?.profile ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("handle", handle.toLowerCase())
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export async function getArtworksByArtistId(
  artistId: string
): Promise<Artwork[]> {
  if (!isSupabaseConfigured()) {
    const demo = getDemoGallery("maya-lin");
    return demo?.artworks ?? [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artworks")
    .select("*")
    .eq("artist_id", artistId)
    .order("display_order", { ascending: true });

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
