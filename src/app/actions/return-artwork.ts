"use server";

import { createClient } from "@/lib/supabase/server";

export async function returnArtwork(
  inventoryItemId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase.rpc("return_artwork", {
    p_inventory_item: inventoryItemId,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}