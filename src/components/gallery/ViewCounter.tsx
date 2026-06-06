"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

interface ViewCounterProps {
  galleryId: string;
  isOwner: boolean;
}

export function ViewCounter({ galleryId, isOwner }: ViewCounterProps) {
  useEffect(() => {
    if (!isSupabaseConfigured() || !galleryId || isOwner) return;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const row = user
        ? { gallery_id: galleryId, viewer_id: user.id }
        : { gallery_id: galleryId };
      supabase.from("gallery_views").insert(row as any);
    });
  }, [galleryId, isOwner]);

  return null;
}
