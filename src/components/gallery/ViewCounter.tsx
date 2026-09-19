"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const VISITOR_KEY_STORAGE = "gc_visitor_key";

// Random per-browser id so logged-out refreshes don't count twice.
// null when storage or crypto.randomUUID is unavailable (private mode, plain-http LAN dev).
function getVisitorKey(): string | null {
  try {
    let key = localStorage.getItem(VISITOR_KEY_STORAGE);
    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY_STORAGE, key);
    }
    return key;
  } catch {
    return null;
  }
}

interface ViewCounterProps {
  galleryId: string | null;
  isOwner: boolean;
}

export function ViewCounter({ galleryId, isOwner }: ViewCounterProps) {
  useEffect(() => {
    if (!isSupabaseConfigured() || !galleryId || isOwner) return;

    // Owner check and 30-minute dedupe are enforced inside record_gallery_view.
    createClient()
      .rpc("record_gallery_view", {
        p_gallery_id: galleryId,
        p_visitor_key: getVisitorKey(),
      })
      .then(({ error }) => {
        if (error) console.warn("[ViewCounter] failed to record view:", error.message);
      });
  }, [galleryId, isOwner]);

  return null;
}
