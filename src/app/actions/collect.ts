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

  const { error } = await supabase.rpc("transfer_coins", {
    buyer_id: user.id,
    inventory_item_id: inventoryItemId,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
