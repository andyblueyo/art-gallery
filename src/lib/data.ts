import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Artwork, GalleryPiece, Profile } from "@/lib/types";
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
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[data] getArtworksByArtistId error:", error);
  }
  console.log(
    "[data] getArtworksByArtistId returned",
    data?.length ?? 0,
    "rows:",
    data?.map((a) => ({ id: a.id, title: a.title, file_url: a.file_url }))
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
  const { data: { user } } = await supabase.auth.getUser();
  
  // don't record if not logged in or if owner is viewing own gallery
  if (!user || user.id === artistId) return;

  const { data: gallery } = await supabase
    .from("galleries")
    .select("id")
    .eq("user_id", artistId)
    .eq("is_primary", true)
    .single();

  if (!gallery) return;

  await supabase.from("gallery_views").insert({
    gallery_id: gallery.id,
    viewer_id: user.id,
  });
}

export async function getPrimaryGalleryId(userId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("galleries")
    .select("id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .single();
  return data?.id ?? null;
}

export async function getGalleryPieces(galleryId: string): Promise<GalleryPiece[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gallery_pieces")
    .select(`
      id, gallery_id, inventory_item_id, position_x, position_y, rotation, scale, z_index,
      inventory_item:inventory_items (
        id, owned_by, artwork_id, edition_number,
        artwork:artworks (
          id, artist_id, title, medium, description,
          file_url, file_type, frame_file, heart_count, created_at,
          for_sale, price_coins, edition_total, editions_remaining
        )
      )
    `)
    .eq("gallery_id", galleryId);
  if (error) {
    console.error("[data] getGalleryPieces error:", error);
    return [];
  }
  console.log("[getGalleryPieces] first piece raw:", JSON.stringify(data?.[0], null, 2));
  return (data ?? []) as unknown as GalleryPiece[];
}