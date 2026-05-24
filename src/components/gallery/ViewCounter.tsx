"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

interface ViewCounterProps {
  artistId: string;
}

export function ViewCounter({ artistId }: ViewCounterProps) {
  useEffect(() => {
    if (!isSupabaseConfigured() || !artistId) return;

    const supabase = createClient();
    supabase.from("page_views").insert({ artist_id: artistId });
  }, [artistId]);

  return null;
}
