"use server";

import { createClient } from "@/lib/supabase/server";

export async function collectArtwork(
  inventoryItemId: string,
  artworkId: string
): Promise<{ success: true } | { error: string }> {
  void artworkId;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Look up the inventory item to get seller, artist, and price
  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("owned_by, artwork_id, artworks(artist_id, price_coins)")
    .eq("id", inventoryItemId)
    .limit(1)
    .maybeSingle();

  if (itemError || !item) {
    return { error: "Could not find inventory item" };
  }

  const artwork = Array.isArray(item.artworks) ? item.artworks[0] : item.artworks;

  if (!artwork) {
    return { error: "Could not find artwork details" };
  }

  const { error } = await supabase.rpc("transfer_coins", {
    buyer_id: user.id,
    seller_id: item.owned_by,
    artist_id: artwork.artist_id,
    p_inventory_item: inventoryItemId,
    price: artwork.price_coins,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
