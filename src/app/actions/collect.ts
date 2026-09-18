"use server";

import { createClient } from "@/lib/supabase/server";

export async function collectArtwork(
  inventoryItemId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Buyer, seller, artist and price are all derived inside transfer_coins from
  // auth.uid() and the item row. Do not pass them from here: a caller-supplied
  // buyer/seller/price is what made this function exploitable (migration 008).
  const { error } = await supabase.rpc("transfer_coins", {
    p_inventory_item: inventoryItemId,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
